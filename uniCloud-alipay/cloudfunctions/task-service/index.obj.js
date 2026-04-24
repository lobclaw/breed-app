/**
 * 任务云对象
 * 管理首页卡片生成、任务完成/推迟、每日审计
 */
const { verifyAndGetFamily, requireFamily } = require('breed-auth/auth')
let safeWriteOperationLog = async () => null
try {
  ;({ safeWriteOperationLog } = require('breed-auth/operation-log'))
} catch (error) {
  ;({ safeWriteOperationLog } = require('../common/breed-auth/operation-log'))
}
let syncUtils = null
try {
  syncUtils = require('breed-sync')
} catch (error) {
  syncUtils = require('../common/breed-sync')
}
const {
  getSyncMeta,
  buildTouchedEntity,
  buildSyncAck,
  buildConflictAck,
  findAppliedMutation,
  markMutationApplied,
  getBaseVersion,
  getServerVersion,
  buildVersionUpdate,
  buildVersionedCreate,
} = syncUtils

const db = uniCloud.database()
const dbCmd = db.command

// 一天的毫秒数
const DAY_MS = 86400000
const FOLLICLE_READY_RESULT = '已成熟'
const FOLLICLE_ABNORMAL_RESULT = '发育不良'
const DEFAULT_NOTIFICATION_SETTINGS = {
  push_enabled: true,
  morning_summary_enabled: true,
  morning_summary_time: '09:00',
  notification_types: {
    breeding: true,
    vaccination: true,
    medication: true,
    care_group: true,
    overdue: true,
  },
}
const BREEDING_EXTRA_TYPES = new Set([
  'breeding_extra_arrangement',
  'heat',
  'follicle_check',
  'mating',
  'pregnancy_check',
  'prenatal_check',
  'pre_labor',
  'abnormal_termination',
])

async function logTaskOperation({ familyId, actorUserId, actionType, targetType, targetId, targetName, summary, meta = null }) {
  await safeWriteOperationLog({
    familyId,
    actorUserId,
    actionType,
    domain: 'task',
    targetType,
    targetId,
    targetName,
    summary,
    meta,
  })
}

/**
 * 取一组任务中的最高优先级
 */
function highestPriority(tasks) {
  const order = { overdue: 1, today: 2, upcoming: 3 }
  let best = 'upcoming'
  for (const t of tasks) {
    if ((order[t.priority] || 3) < (order[best] || 3)) {
      best = t.priority
    }
  }
  return best
}

function startOfDay(ts) {
  return getBeijingDayContext(ts).dayStart
}

function getOverdueDays(dueDate, now = Date.now()) {
  if (!dueDate) return 1
  const diff = Math.floor((startOfDay(now) - startOfDay(dueDate)) / DAY_MS)
  return Math.max(1, diff)
}

function getTaskVariantKey(task) {
  if (!task) return ''
  if (task.type === 'breeding_extra_arrangement') {
    return `breeding_extra_arrangement:${task.details?.kind || ''}:${task.details?.anchor_id || task.cycle_id || ''}:${task.due_date || ''}`
  }
  if (task.type === 'vaccination') {
    return `vaccination:${task.details?.vaccine_type || ''}`
  }
  if (task.type === 'deworming') {
    return `deworming:${task.details?.deworming_type || ''}:${task.details?.drug_name || ''}`
  }
  if (task.type === 'illness') {
    return `illness:${getIllnessPrimaryCondition(task.details || {})}`
  }
  return task.type || ''
}

function normalizeIllnessCondition(condition) {
  return typeof condition === 'string' ? condition.trim() : ''
}

function getIllnessPrimaryCondition(source = {}) {
  return normalizeIllnessCondition(source?.primary_condition || source?.condition || '')
}

function getIllnessSymptomSummary(source = {}, limit = 2) {
  const tags = Array.isArray(source?.symptom_tags)
    ? source.symptom_tags
      .map(item => typeof item === 'string' ? item.trim() : '')
      .filter(Boolean)
    : []
  if (tags.length === 0) return ''
  if (tags.length <= limit) return tags.join(' / ')
  return `${tags.slice(0, limit).join(' / ')} 等${tags.length}项`
}

function isBreedingExtraTask(task) {
  return BREEDING_EXTRA_TYPES.has(task?.type)
}

function getTaskDomain(task) {
  if (!task) return 'health'
  if (task.type === 'medication') return 'medication'
  if (task.type === 'breeding_milestone' || task.type === 'care_group' || isBreedingExtraTask(task)) {
    return 'breeding'
  }
  return 'health'
}

function getTaskDisplayTitle(task) {
  if (!task) return ''
  if (task.type === 'breeding_extra_arrangement') {
    return task.title || '额外安排'
  }
  if (task.type === 'vaccination') {
    if (task.details?.vaccine_type) return `疫苗 · ${task.details.vaccine_type}`
    return task.title || '疫苗'
  }
  if (task.type === 'deworming') {
    const subtypeLabelMap = { internal: '内驱', external: '外驱', combo: '内外同驱' }
    if (task.details?.drug_name) return `驱虫 · ${task.details.drug_name}`
    if (task.details?.deworming_type) return `驱虫 · ${subtypeLabelMap[task.details.deworming_type] || task.details.deworming_type}`
    return task.title || '驱虫'
  }
  if (task.type === 'illness') {
    return getIllnessPrimaryCondition(task.details || {}) || task.title || '疾病'
  }
  return task.title || task.type || ''
}

function getTaskPriority(task, todayStartMs, todayEndMs) {
  if (!task) return 'upcoming'

  if (task.type === 'breeding_milestone') {
    return task.due_date <= todayEndMs ? 'today' : 'upcoming'
  }

  if (task.due_date < todayStartMs) return 'overdue'
  if (task.due_date <= todayEndMs) return 'today'
  return 'upcoming'
}

function getBreedingMilestoneIdentity(task) {
  if (task?.type !== 'breeding_milestone') return ''
  if (task.litter_id) return `breeding_milestone:litter:${task.litter_id}`
  if (task.cycle_id) return `breeding_milestone:cycle:${task.cycle_id}`
  return ''
}

function shouldPreferBreedingMilestone(candidate, current) {
  const candidateUpdated = candidate?.updated_at || candidate?.created_at || 0
  const currentUpdated = current?.updated_at || current?.created_at || 0
  if (candidateUpdated !== currentUpdated) return candidateUpdated > currentUpdated

  const candidateDueDate = candidate?.due_date || 0
  const currentDueDate = current?.due_date || 0
  if (candidateDueDate !== currentDueDate) return candidateDueDate > currentDueDate

  return `${candidate?._id || ''}` > `${current?._id || ''}`
}

function dedupeBreedingMilestones(tasks = []) {
  const deduped = []
  const indexMap = new Map()

  for (const task of tasks) {
    const identity = getBreedingMilestoneIdentity(task)
    if (!identity) {
      deduped.push(task)
      continue
    }

    if (!indexMap.has(identity)) {
      indexMap.set(identity, deduped.length)
      deduped.push(task)
      continue
    }

    const existingIndex = indexMap.get(identity)
    const existingTask = deduped[existingIndex]
    if (shouldPreferBreedingMilestone(task, existingTask)) {
      deduped[existingIndex] = task
    }
  }

  return deduped
}

function mergeNotificationSettings(settings = {}) {
  const safeSettings = settings && typeof settings === 'object' ? settings : {}

  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...safeSettings,
    notification_types: {
      ...DEFAULT_NOTIFICATION_SETTINGS.notification_types,
      ...(safeSettings.notification_types && typeof safeSettings.notification_types === 'object' ? safeSettings.notification_types : {}),
      overdue: true,
    },
  }
}

function getBeijingDayContext(now = Date.now()) {
  const offsetMs = 8 * 60 * 60 * 1000
  const beijingNow = new Date(now + offsetMs)
  const year = beijingNow.getUTCFullYear()
  const month = beijingNow.getUTCMonth()
  const day = beijingNow.getUTCDate()
  const hour = String(beijingNow.getUTCHours()).padStart(2, '0')
  const minute = String(beijingNow.getUTCMinutes()).padStart(2, '0')
  const start = Date.UTC(year, month, day, 0, 0, 0, 0) - offsetMs

  return {
    currentTime: `${hour}:${minute}`,
    dayStart: start,
    dayEnd: start + 86400000 - 1,
  }
}

function getBeijingDayDiff(laterTs, earlierTs) {
  return Math.floor((startOfDay(laterTs) - startOfDay(earlierTs)) / DAY_MS)
}

function computeMedItemsForBeijingDay(activeMedications, targetDate) {
  const targetDayStart = getBeijingDayContext(targetDate).dayStart
  return (activeMedications || []).map((med) => {
    const startDayStart = getBeijingDayContext(med.actual_start_date || med.start_date || med.created_at || targetDate).dayStart
    const currentDay = Math.floor((targetDayStart - startDayStart) / 86400000) + 1
    if (currentDay < 1 || currentDay > med.duration_days) return null
    const frequency = med.frequency || 1
    const todayDoses = med.daily_doses?.[String(currentDay)] || 0
    return {
      ...med,
      currentDay,
      todayDoses,
      isDoneToday: todayDoses >= frequency,
    }
  }).filter(Boolean)
}

function getFollicleResult(details = {}) {
  return typeof details?.result === 'string' ? details.result : ''
}

function isFollicleReady(details = {}) {
  return getFollicleResult(details) === FOLLICLE_READY_RESULT
}

function isFollicleAbnormal(details = {}) {
  return getFollicleResult(details) === FOLLICLE_ABNORMAL_RESULT
}

function buildMorningSummaryPayload(family, pendingTasks, activeMedications, now = Date.now()) {
  const settings = mergeNotificationSettings(family?.settings)
  const { currentTime, dayStart, dayEnd } = getBeijingDayContext(now)

  if (!settings.push_enabled || !settings.morning_summary_enabled) return null
  if (settings.morning_summary_time !== currentTime) return null

  const counts = {
    overdue: 0,
    breeding: 0,
    vaccination: 0,
    medication: 0,
    care_group: 0,
  }

  for (const task of pendingTasks || []) {
    if (!task || task.status !== 'pending') continue

    if (task.due_date < dayStart) {
      counts.overdue += 1
      continue
    }

    if (task.due_date > dayEnd) continue

    if (task.type === 'care_group') {
      counts.care_group += 1
      continue
    }

    if (task.type === 'vaccination' || task.type === 'deworming') {
      counts.vaccination += 1
      continue
    }

    if (task.type === 'breeding_milestone' || isBreedingExtraTask(task)) {
      counts.breeding += 1
    }
  }

  const medItems = computeMedItemsForBeijingDay(activeMedications, now)
  counts.medication = medItems.filter(item => !item.isDoneToday).length

  const enabledTypes = settings.notification_types || DEFAULT_NOTIFICATION_SETTINGS.notification_types
  const parts = []
  let total = 0

  if (enabledTypes.overdue && counts.overdue > 0) {
    parts.push(`${counts.overdue}件逾期需处理`)
    total += counts.overdue
  }
  if (enabledTypes.breeding && counts.breeding > 0) {
    parts.push(`${counts.breeding}项繁育提醒`)
    total += counts.breeding
  }
  if (enabledTypes.vaccination && counts.vaccination > 0) {
    parts.push(`${counts.vaccination}项疫苗/驱虫提醒`)
    total += counts.vaccination
  }
  if (enabledTypes.medication && counts.medication > 0) {
    parts.push(`${counts.medication}项今日用药`)
    total += counts.medication
  }
  if (enabledTypes.care_group && counts.care_group > 0) {
    parts.push(`${counts.care_group}项护理提醒`)
    total += counts.care_group
  }

  if (total === 0) return null

  return {
    total,
    parts,
    content: `今日待办(${total}件)：${parts.join(' · ')}`,
    counts,
    currentTime,
  }
}

async function ensureEstrusCycleMilestones(familyId, now = Date.now()) {
  const { data: estrusCycles } = await db.collection('breeding_cycles')
    .where({ family_id: familyId, status: '发情中' })
    .get()

  if (!estrusCycles || estrusCycles.length === 0) return []

  const cycleIds = estrusCycles.map(cycle => cycle._id).filter(Boolean)
  if (cycleIds.length === 0) return []

  const [{ data: pendingTasks }, { data: records }] = await Promise.all([
    db.collection('tasks')
      .where({
        family_id: familyId,
        type: 'breeding_milestone',
        status: 'pending',
        cycle_id: dbCmd.in(cycleIds),
      })
      .get(),
    db.collection('breeding_records')
      .where({
        family_id: familyId,
        cycle_id: dbCmd.in(cycleIds),
        type: dbCmd.in(['heat', 'follicle_check']),
      })
      .orderBy('date', 'asc')
      .get(),
  ])

  const cyclesWithPendingTask = new Set((pendingTasks || []).map(task => task.cycle_id).filter(Boolean))
  const recordMap = new Map()
  for (const record of records || []) {
    if (!recordMap.has(record.cycle_id)) recordMap.set(record.cycle_id, [])
    recordMap.get(record.cycle_id).push(record)
  }

  const createdTaskIds = []
  for (const cycle of estrusCycles) {
    if (!cycle?._id || cyclesWithPendingTask.has(cycle._id)) continue

    const cycleRecords = recordMap.get(cycle._id) || []
    const heatRecord = cycleRecords.find(record => record.type === 'heat') || null
    const follicleRecords = cycleRecords.filter(record => record.type === 'follicle_check')
    const latestFollicleRecord = follicleRecords.length > 0 ? follicleRecords[follicleRecords.length - 1] : null
    const heatDate = heatRecord?.date || cycle.start_date || cycle.created_at || now

    const taskPayload = latestFollicleRecord
      ? (isFollicleReady(latestFollicleRecord.details)
        ? {
            title: `${cycle.dam_name} · 配种`,
            due_date: latestFollicleRecord.date || now,
            details: {
              step_type: 'mating',
              follicle_check_date: latestFollicleRecord.date || null,
              heat_date: heatDate,
              follicle_result: getFollicleResult(latestFollicleRecord.details) || null,
            },
          }
        : {
            title: `${cycle.dam_name} · 建议卵泡检查`,
            due_date: (latestFollicleRecord.date || now) + DAY_MS,
            details: {
              step_type: 'follicle_check',
              heat_date: heatDate,
              follicle_check_count: follicleRecords.length,
              follicle_result: getFollicleResult(latestFollicleRecord.details) || null,
              latest_follicle_check_date: latestFollicleRecord.date || null,
              abnormal_result: isFollicleAbnormal(latestFollicleRecord.details),
            },
          })
      : {
          title: `${cycle.dam_name} · 建议卵泡检查`,
          due_date: heatDate + 10 * DAY_MS,
        details: {
          step_type: 'follicle_check',
          heat_date: heatDate,
          follicle_check_count: 0,
          follicle_result: null,
          latest_follicle_check_date: null,
          abnormal_result: false,
        },
      }

    const { id } = await db.collection('tasks').add({
      card_type: 'individual',
      dog_id: cycle.dam_id,
      dog_name: cycle.dam_name,
      cycle_id: cycle._id,
      type: 'breeding_milestone',
      status: 'pending',
      priority: taskPayload.due_date <= now ? 'overdue' : 'upcoming',
      source_record_id: latestFollicleRecord?._id || heatRecord?._id || null,
      source_collection: 'breeding_records',
      family_id: familyId,
      postpone_count: 0,
      created_at: now,
      updated_at: now,
      ...taskPayload,
    })
    createdTaskIds.push(id)
  }

  return createdTaskIds
}

function buildSectionedCards(pendingTasks, todayCompletedTasks, activeIllnesses, medItems) {
  const workflowPendingTasks = pendingTasks.filter(task => task.type === 'breeding_milestone')
  const workflowCompletedTasks = todayCompletedTasks.filter(task => task.type === 'breeding_milestone')
  const breedingExtraPendingTasks = pendingTasks.filter(task => isBreedingExtraTask(task))
  const breedingExtraCompletedTasks = todayCompletedTasks.filter(task => isBreedingExtraTask(task))
  const reminderPendingTasks = pendingTasks.filter(task => task.type !== 'breeding_milestone' && task.type !== 'medication' && !isBreedingExtraTask(task))
  const reminderCompletedTasks = todayCompletedTasks.filter(task => task.type !== 'breeding_milestone' && task.type !== 'medication' && !isBreedingExtraTask(task))

  const workflowCards = mergeTasks(workflowPendingTasks, workflowCompletedTasks, [], [])
  const breedingExtraCards = mergeTasks(breedingExtraPendingTasks, breedingExtraCompletedTasks, [], [])
  const reminderCards = mergeTasks(reminderPendingTasks, reminderCompletedTasks, [], [])
  const attentionCards = mergeTasks([], [], activeIllnesses, medItems)
  const therapyCards = attentionCards.filter(card => card.cardType === 'medication' || card.cardType === 'health_attention')
  const healthObservationCards = attentionCards.filter(card => card.cardType === 'sick_observation')

  const annotateOverdue = (cardList) => {
    const overdueCards = cardList.filter(card => card.priority === 'overdue')
    for (const card of overdueCards) {
      const oldestDue = card.tasks?.reduce((min, t) => Math.min(min, t.due_date || Infinity), Infinity)
      card.overdueDays = oldestDue < Infinity ? getOverdueDays(oldestDue) : 1
    }
    overdueCards.sort((a, b) => (b.overdueDays || 0) - (a.overdueDays || 0))
    const todayCards = cardList.filter(card => card.priority === 'today')
    const upcomingCards = cardList.filter(card => card.priority === 'upcoming')
    return [...overdueCards, ...todayCards, ...upcomingCards]
  }

  const workflow = annotateOverdue(workflowCards).map(card => ({ ...card, sectionType: 'workflow', domain: 'breeding' }))
  const extra_arrangements = annotateOverdue(breedingExtraCards).map(card => ({ ...card, sectionType: 'workflow_extra', domain: 'breeding' }))
  const reminders = annotateOverdue([...reminderCards, ...healthObservationCards]).map(card => ({ ...card, sectionType: 'reminders', domain: 'health' }))
  const therapy = annotateOverdue(therapyCards).map(card => ({ ...card, sectionType: 'therapy', domain: 'medication' }))

  return {
    workflow,
    extra_arrangements,
    reminders,
    therapy,
    cards: [...workflow, ...extra_arrangements, ...therapy, ...reminders],
  }
}

function toLegacyMedItem(task) {
  const frequency = task.details?.frequency || 1
  const todayDoses = task.doses_given || 0
  return {
    _id: task._id,
    dog_id: task.dog_id,
    dog_name: task.dog_name,
    drug_name: task.details?.drug_name || '用药',
    dosage: task.details?.dosage || null,
    dosage_unit: task.details?.dosage_unit || null,
    method: task.details?.method || '口服',
    frequency,
    duration_days: task.details?.total_days || 1,
    actual_start_date: task.due_date || Date.now(),
    currentDay: task.details?.day || 1,
    todayDoses,
    isDoneToday: todayDoses >= frequency || task.status === 'completed',
    created_at: task.created_at || task.due_date || Date.now(),
  }
}

async function createAutoHealthRecord({ familyId, uid, task, now, recordId = '' }) {
  if (!task || !['vaccination', 'deworming'].includes(task.type)) return false

  const details = {}
  if (task.type === 'vaccination') details.vaccine_type = task.details?.vaccine_type || null
  if (task.type === 'deworming') {
    details.deworming_type = task.details?.deworming_type || null
    details.drug_name = task.details?.drug_name || null
  }

  const recordData = buildVersionedCreate({
    _id: recordId || undefined,
    family_id: familyId,
    dog_id: task.dog_id,
    dog_name: task.dog_name,
    type: task.type,
    date: now,
    details,
    source: 'auto_complete',
    created_by: uid,
  }, now)
  await db.collection('health_records').add(recordData)
  return recordData
}

function normalizeTaskIdList(taskIds = []) {
  return [...new Set(
    (Array.isArray(taskIds) ? taskIds : [taskIds])
      .map(taskId => typeof taskId === 'string' ? taskId.trim() : '')
      .filter(Boolean),
  )]
}

function parseCompleteTaskArgs(taskIdOrInput, autoRecord, maybeSync) {
  if (taskIdOrInput && typeof taskIdOrInput === 'object' && !Array.isArray(taskIdOrInput)) {
    return {
      taskId: taskIdOrInput.taskId || taskIdOrInput.task_id || taskIdOrInput.id || '',
      autoRecord: Boolean(taskIdOrInput.autoRecord ?? taskIdOrInput.auto_record),
      syncMeta: getSyncMeta(taskIdOrInput, maybeSync),
      autoHealthRecords: Array.isArray(taskIdOrInput?._sync?.autoHealthRecords) ? taskIdOrInput._sync.autoHealthRecords : [],
    }
  }

  return {
    taskId: taskIdOrInput,
    autoRecord: Boolean(autoRecord),
    syncMeta: getSyncMeta(null, maybeSync),
    autoHealthRecords: [],
  }
}

function parseBatchTaskArgs(taskIdsOrInput, autoRecord, maybeSync) {
  if (taskIdsOrInput && typeof taskIdsOrInput === 'object' && !Array.isArray(taskIdsOrInput)) {
    return {
      taskIds: normalizeTaskIdList(taskIdsOrInput.taskIds || taskIdsOrInput.task_ids || []),
      autoRecord: Boolean(taskIdsOrInput.autoRecord ?? taskIdsOrInput.auto_record),
      syncMeta: getSyncMeta(taskIdsOrInput, maybeSync),
      autoHealthRecords: Array.isArray(taskIdsOrInput?._sync?.autoHealthRecords) ? taskIdsOrInput._sync.autoHealthRecords : [],
    }
  }

  return {
    taskIds: normalizeTaskIdList(taskIdsOrInput),
    autoRecord: Boolean(autoRecord),
    syncMeta: getSyncMeta(null, maybeSync),
    autoHealthRecords: [],
  }
}

function parsePostponeArgs(taskIdOrInput, newDate, reason, maybeSync) {
  if (taskIdOrInput && typeof taskIdOrInput === 'object' && !Array.isArray(taskIdOrInput)) {
    return {
      taskId: taskIdOrInput.taskId || taskIdOrInput.task_id || taskIdOrInput.id || '',
      taskIds: normalizeTaskIdList(taskIdOrInput.taskIds || taskIdOrInput.task_ids || []),
      newDate: taskIdOrInput.newDate || taskIdOrInput.new_date || newDate,
      reason: taskIdOrInput.reason || null,
      syncMeta: getSyncMeta(taskIdOrInput, maybeSync),
    }
  }

  return {
    taskId: typeof taskIdOrInput === 'string' ? taskIdOrInput : '',
    taskIds: normalizeTaskIdList(taskIdOrInput),
    newDate,
    reason: reason || null,
    syncMeta: getSyncMeta(null, maybeSync),
  }
}

function getTaskConflict(syncMeta, task) {
  const baseVersion = getBaseVersion(syncMeta, task?._id)
  if (baseVersion === null) return null
  const serverVersion = getServerVersion(task)
  if (baseVersion === serverVersion) return null
  return buildConflictAck(syncMeta, {
    collection: 'tasks',
    entityId: task._id,
    baseVersion,
    serverVersion,
  })
}

/**
 * 智能合并任务为卡片
 * 合并优先级：健康关注 > 窝级别 > 护理群组 > 批量(2+同类同天) > 个体犬只
 * @param {Array} tasks - pending 任务
 * @param {Array} todayCompleted - 今日已完成任务（用于保持批量卡片完整）
 * @param {Array} activeIllnesses - 当前生病中的 health_records（可选）
 */
/**
 * 从 medication_tasks 计算指定日期的用药状态
 */
function computeMedItemsForDay(activeMedications, targetDate) {
  return computeMedItemsForBeijingDay(activeMedications || [], targetDate)
}

function mergeTasks(tasks, todayCompleted = [], activeIllnesses = [], medItems = []) {
  const cards = []
  const consumed = new Set()
  const completedConsumed = new Set()

  const todayDayStart = startOfDay(Date.now())

  for (const task of [...tasks, ...todayCompleted]) {
    task.display_title = getTaskDisplayTitle(task)
  }

  // 第 1 轮：健康关注卡（生病犬只 + 用药犬只合并）
  // 兼容旧数据：仍过滤 tasks 中的 medication 类型（旧记录），与 medItems（新记录）合并
  const oldMedTasks = tasks.filter(t => t.type === 'medication')
  oldMedTasks.forEach(t => consumed.add(t._id))
  const mergedMedItems = [...medItems, ...oldMedTasks.map(toLegacyMedItem)]

  const medByDog = new Map()
  const medDogIds = new Set()
  for (const m of mergedMedItems) {
    if (!medByDog.has(m.dog_id)) medByDog.set(m.dog_id, [])
    medByDog.get(m.dog_id).push(m)
    medDogIds.add(m.dog_id)
  }

  // 1a: 先按犬归档疾病记录，后续按“观察/治疗”拆分到不同区块
  const illnessesByDog = new Map()
  const illnessesById = new Map()

  for (const ill of activeIllnesses) {
    const status = ill.details?.treatment_status || '观察中'
    const dogId = ill.dog_id
    const cond = getIllnessPrimaryCondition(ill.details || {}) || '生病'
    const illStart = startOfDay(ill.date || ill.created_at)
    const daysSick = Math.max(1, getBeijingDayDiff(todayDayStart, illStart) + 1)
    const normalizedIllness = {
      dogId,
      dogName: ill.dog_name || ill._dog_name || '',
      illness: cond,
      symptomSummary: getIllnessSymptomSummary(ill.details || {}),
      severity: ill.details?.severity || '轻微',
      illnessId: ill._id,
      daysSick,
      treatmentStatus: status,
      _createdAt: ill.date || ill.created_at || 0,
    }

    if (!illnessesByDog.has(dogId)) {
      illnessesByDog.set(dogId, [])
    }
    illnessesByDog.get(dogId).push(normalizedIllness)
    illnessesById.set(ill._id, normalizedIllness)
  }

  // 1b: 从 medication_tasks 计算用药卡片数据（新模型）
  const unitMap = { ml: 'ml', mg: 'mg', tablet: '片' }
  const hasPendingMed = mergedMedItems.some(m => !m.isDoneToday)

  // 疾病观察卡按疾病实例输出；同一只犬若还有其他观察中疾病，允许继续留在健康区
  const sickObserveDogs = activeIllnesses
    .map((ill) => {
      const status = ill.details?.treatment_status || '观察中'
      const dogMedications = medByDog.get(ill.dog_id) || []
      const explicitLinkedMedication = dogMedications.find(m => m.source_record_id && m.source_record_id === ill._id) || null
      const hasExplicitLinkedMedication = !!explicitLinkedMedication
      const hasFallbackMedication = dogMedications.some(m => !m.source_record_id)
      if (status === '治疗中' && (hasExplicitLinkedMedication || hasFallbackMedication)) return null

      const illStart = startOfDay(ill.date || ill.created_at)
      const daysSick = Math.max(1, getBeijingDayDiff(todayDayStart, illStart) + 1)

      return {
        dogId: ill.dog_id,
        dogName: ill.dog_name || ill._dog_name || '',
        state: 'sick_only',
        illness: getIllnessPrimaryCondition(ill.details || {}) || '生病',
        symptomSummary: getIllnessSymptomSummary(ill.details || {}),
        severity: ill.details?.severity || '轻微',
        illnessId: ill._id,
        linkedMedicationTaskId: explicitLinkedMedication?._id || '',
        relationType: hasExplicitLinkedMedication ? 'linked' : (hasFallbackMedication ? 'fallback' : 'standalone'),
        daysSick,
        treatmentStatus: status,
        _createdAt: ill.date || ill.created_at || 0,
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a._createdAt || 0) - (b._createdAt || 0))

  const dogMap = new Map()
  if (mergedMedItems.length > 0) {
    for (const [dogId, meds] of medByDog) {
      const uniqueDrugs = [...new Set(meds.map(m => m.drug_name).filter(Boolean))]
      const isMultiDrug = uniqueDrugs.length > 1
      const primary = meds[0]
      const dogIllnesses = illnessesByDog.get(dogId) || []
      const explicitlyLinkedIllnesses = meds
        .map(m => (m.source_record_id ? illnessesById.get(m.source_record_id) : null))
        .filter(Boolean)
      const medicatedIllnesses = explicitlyLinkedIllnesses.length > 0
        ? explicitlyLinkedIllnesses
        : dogIllnesses.filter(ill => ill.treatmentStatus === '治疗中')
      const medicatedIllnessNames = [...new Set(medicatedIllnesses.map(ill => ill.illness).filter(Boolean))]
      const medicatedSymptomSummaries = [...new Set(medicatedIllnesses.map(ill => ill.symptomSummary).filter(Boolean))]
      const relationType = explicitlyLinkedIllnesses.length > 0
        ? 'linked'
        : (medicatedIllnesses.length > 0 ? 'fallback' : 'standalone')

      const drugName = isMultiDrug ? `${uniqueDrugs.length}种用药` : (primary.drug_name || '用药')
      const dosageStr = isMultiDrug ? '' : (primary.dosage ? `${primary.dosage}${unitMap[primary.dosage_unit] || primary.dosage_unit || 'mg'}` : '')
      const progress = isMultiDrug ? '' : `${primary.currentDay}/${primary.duration_days}天`
      const freq = primary.frequency || 1
      const methodFreq = isMultiDrug ? '' : (freq > 1 ? `${primary.method || '口服'} 日${freq}次` : (primary.method || '口服'))

      const allMedTasksForDog = meds.map(m => ({
        _id: m._id,
        dog_id: m.dog_id,
        currentDay: m.currentDay,
        status: m.isDoneToday ? 'completed' : 'pending',
        doses_given: m.todayDoses,
        details: { drug_name: m.drug_name || '用药', frequency: m.frequency || 1 },
        dosageStr: m.dosage ? `${m.dosage}${unitMap[m.dosage_unit] || m.dosage_unit || 'mg'}` : '',
        progress: `第${m.currentDay}/${m.duration_days}天`,
        methodFreq: (m.frequency || 1) > 1 ? `${m.method || '口服'} 日${m.frequency}次` : (m.method || '口服'),
      }))

      const isCompleted = meds.every(m => m.isDoneToday)
      const illnessNames = medicatedIllnessNames.join('/')
      const isSickWithMed = medicatedIllnessNames.length > 0
      const primaryIllnessId = medicatedIllnesses.length === 1 ? medicatedIllnesses[0].illnessId : ''
      const illnessIds = [...new Set(medicatedIllnesses.map(ill => ill.illnessId).filter(Boolean))]

      dogMap.set(dogId, {
        dogId,
        dogName: primary.dog_name || '',
        state: isSickWithMed ? 'sick_with_med' : 'med_only',
        illness: medicatedIllnessNames[0] || '',
        illnessNames,
        symptomSummary: medicatedSymptomSummaries[0] || '',
        illnessId: primaryIllnessId,
        illnessIds,
        relationType,
        treatmentStatus: isSickWithMed ? '治疗中' : '',
        drugName,
        dosageStr,
        progress,
        methodFreq,
        completed: isCompleted,
        allMedTasks: allMedTasksForDog,
        _createdAt: primary.created_at || 0,
      })
    }
  }

  // 输出两张健康卡
  const medDogs = Array.from(dogMap.values())
    .filter(d => d.state !== 'sick_only')
    .sort((a, b) => {
      const order = { sick_with_med: 0, med_only: 1 }
      const oa = order[a.state] ?? 1
      const ob = order[b.state] ?? 1
      if (oa !== ob) return oa - ob
      return (a._createdAt || 0) - (b._createdAt || 0)
    })

  const activeMedTaskIds = mergedMedItems.filter(m => !m.isDoneToday).map(m => m._id)

  if (medDogs.length > 0 && hasPendingMed) {
    cards.push({
      cardType: 'medication',
      id: 'medication',
      domain: 'medication',
      priority: 'today',
      groupTitle: '今日用药',
      dogs: medDogs,
      tasks: [],
      medicationTaskIds: activeMedTaskIds,
      progress: null,
    })
  }
  if (sickObserveDogs.length > 0) {
    cards.push({
      cardType: 'sick_observation',
      id: 'sick-observation',
      domain: 'health',
      priority: 'today',
      groupTitle: '疾病观察',
      dogs: sickObserveDogs,
      tasks: [],
    })
  }

  // 第 2 轮：护理群组卡片
  const careTasks = tasks.filter(t => t.type === 'care_group' && !consumed.has(t._id))
  if (careTasks.length > 0) {
    const groupMap = new Map()
    for (const t of careTasks) {
      const key = t.title
      if (!groupMap.has(key)) groupMap.set(key, [])
      groupMap.get(key).push(t)
    }
    for (const [title, group] of groupMap) {
      group.forEach(t => consumed.add(t._id))
      const dogMap = new Map()
      for (const t of group) {
        if (!dogMap.has(t.dog_id)) {
          dogMap.set(t.dog_id, { dogId: t.dog_id, dogName: t.dog_name, statusLabel: '' })
        }
      }
      cards.push({
        cardType: 'care_group',
        id: 'care-' + title,
        domain: 'breeding',
        priority: highestPriority(group),
        groupTitle: title,
        dogs: Array.from(dogMap.values()),
        tasks: group,
      })
    }
  }

  // 第 3 轮：窝级别合并（同 litter_id + 同 type）
  // 繁育流程是单犬/单窝推进器，不进入批量卡。
  const litterTasks = tasks.filter(t => t.litter_id && !consumed.has(t._id) && t.type !== 'breeding_milestone' && !isBreedingExtraTask(t))
  const litterGroups = new Map()
  for (const t of litterTasks) {
    const key = `${t.litter_id}__${getTaskVariantKey(t)}`
    if (!litterGroups.has(key)) litterGroups.set(key, [])
    litterGroups.get(key).push(t)
  }
  for (const [, group] of litterGroups) {
    if (group.length >= 2) {
      group.forEach(t => consumed.add(t._id))
      const dogMap = new Map()
      for (const t of group) {
        if (!dogMap.has(t.dog_id)) {
          dogMap.set(t.dog_id, { dogId: t.dog_id, dogName: t.dog_name, completed: false })
        }
      }
      const dogs = Array.from(dogMap.values())
      cards.push({
        cardType: 'batch',
        id: `litter-${group[0].litter_id}-${getTaskVariantKey(group[0])}`,
        domain: getTaskDomain(group[0]),
        priority: highestPriority(group),
        groupTitle: `${group[0].dog_name || ''}窝 · ${group[0].display_title || group[0].title}`,
        dogs,
        tasks: group,
        progress: { done: 0, total: dogs.length },
      })
    }
  }

  // 第 4 轮：批量合并（同 type + 同天 + 2只以上，含今日已完成）
  const remaining = tasks.filter(t => !consumed.has(t._id))
  // 将 pending 和今日已完成任务一起分组
  const allForBatch = [
    ...remaining.filter(t => t.type !== 'breeding_milestone' && !isBreedingExtraTask(t)),
    ...todayCompleted.filter(t => !completedConsumed.has(t._id) && t.type !== 'breeding_milestone' && !isBreedingExtraTask(t)),
  ]
  const batchGroups = new Map()
  for (const t of allForBatch) {
    const dayKey = String(startOfDay(t.due_date))
    const key = `${getTaskVariantKey(t)}__${dayKey}`
    if (!batchGroups.has(key)) batchGroups.set(key, [])
    batchGroups.get(key).push(t)
  }
  for (const [, group] of batchGroups) {
    const dogIds = new Set(group.map(t => t.dog_id))
    const pendingInGroup = group.filter(t => !t._completed)
    // 总数 >= 2 且至少 1 条 pending 才出批量卡片
    if (dogIds.size >= 2 && pendingInGroup.length > 0) {
      group.forEach(t => {
        if (t._completed) completedConsumed.add(t._id)
        else consumed.add(t._id)
      })
      // 只保留 pending 犬只，已完成的不再显示（角标从 0/N 开始，完成即消失）
      const dogMap = new Map()
      for (const t of pendingInGroup) {
        if (!dogMap.has(t.dog_id)) {
          dogMap.set(t.dog_id, { dogId: t.dog_id, dogName: t.dog_name, completed: false })
        }
      }
      const dogs = Array.from(dogMap.values())
      cards.push({
        cardType: 'batch',
        id: `batch-${getTaskVariantKey(group[0])}-${group[0].due_date}`,
        domain: getTaskDomain(group[0]),
        priority: highestPriority(pendingInGroup),
        groupTitle: `${group[0].display_title || group[0].title}`,
        dogs,
        tasks: pendingInGroup,
        progress: { done: 0, total: dogs.length },
      })
    }
  }

  // 第 5 轮：繁育流程/额外安排 → 一任务一卡，避免把流程推进误做成批量待办
  const leftover = tasks.filter(t => !consumed.has(t._id))
  const breedingStandaloneTasks = leftover.filter(t => t.type === 'breeding_milestone' || isBreedingExtraTask(t))
  for (const task of breedingStandaloneTasks) {
    consumed.add(task._id)
    cards.push({
      cardType: 'dog',
      id: `dog-${task.dog_id || task._id}-${task._id}`,
      domain: 'breeding',
      priority: task.priority,
      dogName: task.dog_name,
      dogId: task.dog_id,
      statusLabel: task.type === 'breeding_extra_arrangement' ? '手动安排' : '',
      tasks: [task],
    })
  }

  // 第 6 轮：剩余任务 → 按犬只合并为个体卡片
  const plainLeftover = tasks.filter(t => !consumed.has(t._id))
  const dogGroups = new Map()
  for (const t of plainLeftover) {
    const key = t.dog_id || t._id
    if (!dogGroups.has(key)) dogGroups.set(key, [])
    dogGroups.get(key).push(t)
  }
  for (const [dogId, group] of dogGroups) {
    cards.push({
      cardType: 'dog',
      id: `dog-${dogId}`,
      domain: getTaskDomain(group[0]),
      priority: highestPriority(group),
      dogName: group[0].dog_name,
      dogId: group[0].dog_id,
      statusLabel: '',
      tasks: group,
    })
  }

  return cards
}

module.exports = {
  _before: async function() {
    // _timing 方法不需要用户认证
    if (this.getMethodName().startsWith('_timing')) return

    const { uid, familyId, role } = await verifyAndGetFamily(this.getUniIdToken(), this.getClientInfo())
    this.uid = uid
    this.familyId = familyId
    this.role = role
    requireFamily(familyId)
  },

  _after: function(error, result) {
    if (error) {
      return { errCode: error.code || -1, errMsg: error.message }
    }
    return result
  },

  /**
   * 获取首页卡片数据（智能合并版）
   * 将 raw tasks 合并为 SmartCard 数据结构
   */
  async getHomeCards() {
    const familyId = this.familyId

    const todayContext = getBeijingDayContext(Date.now())
    const todayStartTs = todayContext.dayStart
    const todayEndTs = todayContext.dayEnd

    await ensureEstrusCycleMilestones(familyId, Date.now())

    // 并行查询：首页到期任务 + 主流程任务（允许未来） + 今日已完成 + 当前生病犬只 + 进行中的用药
    const [pendingRes, workflowRes, completedRes, illnessRes, medRes] = await Promise.all([
      db.collection('tasks')
        .where({ family_id: familyId, status: 'pending', due_date: dbCmd.lte(todayEndTs) })
        .orderBy('due_date', 'asc').limit(200).get(),
      db.collection('tasks')
        .where({ family_id: familyId, status: 'pending', type: 'breeding_milestone' })
        .orderBy('due_date', 'asc').limit(200).get(),
      db.collection('tasks')
        .where({ family_id: familyId, status: 'completed', completed_at: dbCmd.gte(todayStartTs).and(dbCmd.lte(todayEndTs)) })
        .limit(100).get(),
      db.collection('health_records')
        .where({ family_id: familyId, type: 'illness', 'details.treatment_status': dbCmd.neq('已康复') })
        .orderBy('date', 'desc').limit(50).get(),
      db.collection('medication_tasks')
        .where({ family_id: familyId, status: '进行中' })
        .get(),
    ])

    const workflowTasks = workflowRes.data || []
    const pendingTasks = [...pendingRes.data]
    const existingTaskIds = new Set(pendingTasks.map(task => task._id))
    for (const task of workflowTasks) {
      if (!existingTaskIds.has(task._id)) {
        pendingTasks.push(task)
        existingTaskIds.add(task._id)
      }
    }
    const normalizedPendingTasks = dedupeBreedingMilestones(pendingTasks)
    const todayCompletedTasks = completedRes.data
    const activeIllnesses = illnessRes.data || []
    const activeMedications = medRes.data || []

    // 补充犬只名称（illness 记录不一定有 dog_name）
    // 去重 dog_id 后批量查询
    const illDogIds = [...new Set(activeIllnesses.filter(i => !i.dog_name).map(i => i.dog_id))]
    if (illDogIds.length > 0) {
      const { data: dogs } = await db.collection('dogs')
        .where({ _id: dbCmd.in(illDogIds) })
        .field({ _id: true, name: true })
        .get()
      const nameMap = new Map(dogs.map(d => [d._id, d.name]))
      for (const ill of activeIllnesses) {
        if (!ill.dog_name) ill.dog_name = nameMap.get(ill.dog_id) || ''
      }
    }

    for (const task of normalizedPendingTasks) {
      task.priority = getTaskPriority(task, todayStartTs, todayEndTs)
      task._completed = false
    }
    for (const task of todayCompletedTasks) {
      task.priority = 'today'
      task._completed = true
    }

    const medItems = computeMedItemsForDay(activeMedications, Date.now())
    const sectioned = buildSectionedCards(normalizedPendingTasks, todayCompletedTasks, activeIllnesses, medItems)
    const allCards = sectioned.cards

    // 计算 本周 和 30天 的 pending 任务数
    const beijingToday = new Date(todayStartTs + (8 * 60 * 60 * 1000))
    const dayOfWeek = beijingToday.getUTCDay() // 0=日
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
    const sundayEndTs = todayStartTs + (daysToSunday * DAY_MS) + DAY_MS - 1
    const day30EndTs = todayStartTs + (30 * DAY_MS) + DAY_MS - 1

    // 并行查询 本周 和 30天 的 pending count
    const [weekRes, month30Res] = await Promise.all([
      db.collection('tasks')
        .where({ family_id: familyId, status: 'pending', due_date: dbCmd.lte(sundayEndTs) })
        .count(),
      db.collection('tasks')
        .where({ family_id: familyId, status: 'pending', due_date: dbCmd.lte(day30EndTs) })
        .count(),
    ])

    return {
      data: {
        cards: allCards,
        sections: {
          workflow: sectioned.workflow,
          extra_arrangements: sectioned.extra_arrangements,
          reminders: sectioned.reminders,
          therapy: sectioned.therapy,
        },
        counts: {
          today: allCards.length,
          week: weekRes.total + sectioned.therapy.length,
          month30: month30Res.total + sectioned.therapy.length,
          hasOverdue: allCards.some(card => card.priority === 'overdue'),
        },
      }
    }
  },

  /**
   * 获取日期范围内每天的任务数（给 WeekStrip 用）
   */
  async getDateCounts(startDate, endDate) {
    const familyId = this.familyId

    const [{ data: tasks }, { data: activeMedications }] = await Promise.all([
      db.collection('tasks')
        .where({
          family_id: familyId,
          status: 'pending',
          due_date: dbCmd.gte(startDate).and(dbCmd.lte(endDate)),
        })
        .field({ _id: true, type: true, cycle_id: true, litter_id: true, due_date: true, created_at: true, updated_at: true })
        .get(),
      db.collection('medication_tasks')
        .where({ family_id: familyId, status: '进行中' })
        .get(),
    ])

    // 按天聚合
    const counts = {}
    for (const task of dedupeBreedingMilestones(tasks)) {
      const key = startOfDay(task.due_date)
      counts[key] = (counts[key] || 0) + 1
    }

    // 疗程状态也会出现在未来日期页：只要当天有用药卡，就给该天一个红点计数
    const seenMedicationDays = new Set()
    for (let key = startOfDay(startDate); key <= endDate; key += DAY_MS) {
      const dayMedItems = computeMedItemsForDay(activeMedications || [], key)
      if (dayMedItems.length > 0 && !seenMedicationDays.has(key)) {
        counts[key] = Math.max(counts[key] || 0, 1)
        seenMedicationDays.add(key)
      }
    }

    return { data: counts }
  },

  /**
   * 获取一周的卡片数据（前端缓存，日期切换零延迟）
   * 返回 { [timestamp]: Card[] } 按天分组
   */
  async getWeekCards(startDate, endDate) {
    const familyId = this.familyId

    // 并行查询：周任务 + 当前生病犬只 + 进行中的用药
    const [taskRes, illnessRes, medRes] = await Promise.all([
      db.collection('tasks')
        .where({ family_id: familyId, status: 'pending', due_date: dbCmd.gte(startDate).and(dbCmd.lte(endDate)) })
        .orderBy('due_date', 'asc').limit(200).get(),
      db.collection('health_records')
        .where({ family_id: familyId, type: 'illness', 'details.treatment_status': dbCmd.neq('已康复') })
        .orderBy('date', 'desc').limit(50).get(),
      db.collection('medication_tasks')
        .where({ family_id: familyId, status: '进行中' })
        .get(),
    ])

    const tasks = dedupeBreedingMilestones(taskRes.data || [])
    const activeIllnesses = illnessRes.data || []
    const activeMedications = medRes.data || []

    // 补充犬只名称（去重 dog_id 后批量查询）
    const illDogIds = [...new Set(activeIllnesses.filter(i => !i.dog_name).map(i => i.dog_id))]
    if (illDogIds.length > 0) {
      const { data: dogs } = await db.collection('dogs')
        .where({ _id: dbCmd.in(illDogIds) }).field({ _id: true, name: true }).get()
      const nameMap = new Map(dogs.map(d => [d._id, d.name]))
      for (const ill of activeIllnesses) {
        if (!ill.dog_name) ill.dog_name = nameMap.get(ill.dog_id) || ''
      }
    }

    // 按天分组，正确标记 overdue
    const realTodayStart = startOfDay(Date.now())
    const realTodayEnd = realTodayStart + DAY_MS - 1
    const dayGroups = new Map()
    for (const task of tasks) {
      const key = startOfDay(task.due_date)
      if (!dayGroups.has(key)) dayGroups.set(key, [])
      task.priority = getTaskPriority(task, realTodayStart, realTodayEnd)
      task._completed = false
      dayGroups.get(key).push(task)
    }

    // 每天独立合并为卡片
    const todayMs = realTodayStart
    const result = {}
    for (const [dayTs, dayTasks] of dayGroups) {
      const dayMedItems = computeMedItemsForDay(activeMedications, dayTs)
      if (dayTs < todayMs) {
        const sectioned = buildSectionedCards(dayTasks, [], [], dayMedItems)
        result[dayTs] = {
          cards: sectioned.cards,
          sections: {
            workflow: sectioned.workflow,
            extra_arrangements: sectioned.extra_arrangements,
            reminders: sectioned.reminders,
            therapy: sectioned.therapy,
          },
        }
      } else {
        // 未来日期：只保留有用药的犬的 illness
        const medDogIds = new Set(dayMedItems.map(m => m.dog_id))
        const filteredIllnesses = medDogIds.size > 0
          ? activeIllnesses.filter(ill => medDogIds.has(ill.dog_id))
          : []
        const sectioned = buildSectionedCards(dayTasks, [], filteredIllnesses, dayMedItems)
        result[dayTs] = {
          cards: sectioned.cards,
          sections: {
            workflow: sectioned.workflow,
            extra_arrangements: sectioned.extra_arrangements,
            reminders: sectioned.reminders,
            therapy: sectioned.therapy,
          },
        }
      }
    }

    // 补充没有其他任务但有用药的日期
    for (let key = startOfDay(startDate); key <= endDate; key += DAY_MS) {
      if (!result[key]) {
        const dayMedItems = computeMedItemsForDay(activeMedications, key)
        if (dayMedItems.length > 0) {
          const medDogIds = new Set(dayMedItems.map(m => m.dog_id))
          const filteredIllnesses = medDogIds.size > 0
            ? activeIllnesses.filter(ill => medDogIds.has(ill.dog_id))
            : []
          const sectioned = buildSectionedCards([], [], filteredIllnesses, dayMedItems)
          result[key] = {
            cards: sectioned.cards,
            sections: {
              workflow: sectioned.workflow,
              extra_arrangements: sectioned.extra_arrangements,
              reminders: sectioned.reminders,
              therapy: sectioned.therapy,
            },
          }
        }
      }
    }

    return { data: result }
  },

  /**
   * 批量完成任务
   */
  async batchCompleteTask(taskIds, autoRecord, maybeSync) {
    const { taskIds: normalizedTaskIds, autoRecord: shouldAutoRecord, syncMeta, autoHealthRecords } = parseBatchTaskArgs(taskIds, autoRecord, maybeSync)
    if (!normalizedTaskIds.length) throw new Error('缺少任务 ID')
    if (syncMeta?.clientMutationId) {
      const existing = await findAppliedMutation(db, this.familyId, syncMeta.clientMutationId)
      if (existing?.response) return existing.response
    }

    const now = Date.now()
    const { data: tasks } = await db.collection('tasks')
      .where({
        _id: dbCmd.in(normalizedTaskIds),
        family_id: this.familyId,
      })
      .get()

    const pendingTasks = (tasks || []).filter(task => task?.status === 'pending')
    for (const task of pendingTasks) {
      const conflict = getTaskConflict(syncMeta, task)
      if (conflict) return conflict
    }
    const completedTaskIds = pendingTasks.map(task => task._id).filter(Boolean)

    if (completedTaskIds.length > 0) {
      await db.collection('tasks').where({
        _id: dbCmd.in(completedTaskIds),
        family_id: this.familyId,
        status: 'pending',
      }).update({
        status: 'completed',
        completed_by: this.uid,
        completed_at: now,
        ...buildVersionUpdate(dbCmd, now),
      })
    }

    const createdHealthRecords = []
    const autoRecordMap = new Map((autoHealthRecords || []).map(item => [item.taskId, item.recordId]))
    if (shouldAutoRecord && pendingTasks.length > 0) {
      await Promise.all(pendingTasks.map(async (task) => {
        try {
          const record = await createAutoHealthRecord({
            familyId: this.familyId,
            uid: this.uid,
            task,
            now,
            recordId: autoRecordMap.get(task._id) || '',
          })
          if (record) createdHealthRecords.push(record)
        } catch (e) {
          console.log('[batchCompleteTask] auto-record failed:', e.message)
        }
      }))
    }

    await logTaskOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'complete',
      targetType: 'task_batch',
      targetId: `batch:${Date.now()}`,
      targetName: `${completedTaskIds.length}个任务`,
      summary: `批量完成了 ${completedTaskIds.length} 个任务`,
      meta: { completed: completedTaskIds.length, completedTaskIds, autoRecord: Boolean(shouldAutoRecord) },
    })

    const { data: updatedTasks } = completedTaskIds.length > 0
      ? await db.collection('tasks').where({ _id: dbCmd.in(completedTaskIds), family_id: this.familyId }).get()
      : { data: [] }
    const touchedEntities = [
      ...(updatedTasks || []).map(task => buildTouchedEntity('tasks', task)),
      ...createdHealthRecords.map(record => buildTouchedEntity('health_records', record)),
    ]
    const response = {
      data: {
        completed: completedTaskIds.length,
        completedTaskIds,
        autoRecordedHealthRecordIds: createdHealthRecords.map(record => record._id),
      },
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities,
        resyncScopes: ['tasks', 'health_records'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 记录一次给药（用于每日多次用药追踪）
   * 每次调用将 doses_given +1，达到 details.frequency 时自动完成任务
   */
  async recordDose(taskId) {
    if (!taskId) throw new Error('缺少任务 ID')
    const familyId = this.familyId
    const now = Date.now()

    const { data: tasks } = await db.collection('tasks')
      .where({ _id: taskId, family_id: familyId, status: 'pending' })
      .get()
    if (!tasks || tasks.length === 0) return { data: { completed: false, already_done: true } }

    const task = tasks[0]
    const frequency = task.details?.frequency || 1

    // 原子 inc 避免并发双击导致计数丢失
    await db.collection('tasks').doc(taskId).update({
      doses_given: dbCmd.inc(1),
      updated_at: now,
    })

    // 重新读取判断是否达到完成阈值
    const { data: updated } = await db.collection('tasks').doc(taskId).get()
    const dosesSoFar = updated[0]?.doses_given || 1

    if (dosesSoFar >= frequency) {
      await db.collection('tasks').doc(taskId).update({
        status: 'completed',
        completed_at: now,
        completed_by: this.uid,
        updated_at: now,
      })
      await logTaskOperation({
        familyId,
        actorUserId: this.uid,
        actionType: 'complete',
        targetType: 'task',
        targetId: taskId,
        targetName: task.title || taskId,
        summary: `完成了任务 ${task.title || ''}`.trim(),
      })
      return { data: { doses_given: dosesSoFar, completed: true } }
    }

    await logTaskOperation({
      familyId,
      actorUserId: this.uid,
      actionType: 'update',
      targetType: 'task',
      targetId: taskId,
      targetName: task.title || taskId,
      summary: `记录了任务 ${task.title || ''} 的执行进度`.trim(),
      meta: { dosesSoFar },
    })

    return { data: { doses_given: dosesSoFar, completed: false } }
  },

  /**
   * 完成任务
   * autoRecord=true 时（健康类），自动创建 health_record，但不再无声续链
   */
  async completeTask(taskId, autoRecord, maybeSync) {
    const { taskId: normalizedTaskId, autoRecord: shouldAutoRecord, syncMeta, autoHealthRecords } = parseCompleteTaskArgs(taskId, autoRecord, maybeSync)
    if (!normalizedTaskId) throw new Error('缺少任务 ID')
    if (syncMeta?.clientMutationId) {
      const existing = await findAppliedMutation(db, this.familyId, syncMeta.clientMutationId)
      if (existing?.response) return existing.response
    }

    const now = Date.now()
    const familyId = this.familyId

    const { data: tasks } = await db.collection('tasks')
      .where({ _id: normalizedTaskId, family_id: familyId })
      .get()
    if (!tasks || tasks.length === 0) throw new Error('任务不存在')
    const conflict = getTaskConflict(syncMeta, tasks[0])
    if (conflict) return conflict
    // 幂等
    if (tasks[0].status !== 'pending') {
      return {
        message: '已完成',
        ...buildSyncAck(syncMeta, { ack: 'duplicate', resyncScopes: ['tasks'] }),
      }
    }

    const task = tasks[0]

    await db.collection('tasks').doc(normalizedTaskId).update({
      status: 'completed',
      completed_by: this.uid,
      completed_at: now,
      ...buildVersionUpdate(dbCmd, now),
    })

    // 健康类一键完成：自动创建记录，不再自动生成下次提醒
    const HEALTH_TYPES = ['vaccination', 'deworming']
    let createdHealthRecord = null
    if (shouldAutoRecord && HEALTH_TYPES.includes(task.type)) {
      try {
        const recordId = Array.isArray(autoHealthRecords) && autoHealthRecords.length > 0 ? autoHealthRecords[0].recordId : ''
        createdHealthRecord = await createAutoHealthRecord({ familyId, uid: this.uid, task, now, recordId })
      } catch (e) {
        console.log('[completeTask] auto-record failed:', e.message)
        // 不影响任务完成，静默失败
      }
    }

    await logTaskOperation({
      familyId,
      actorUserId: this.uid,
      actionType: 'complete',
      targetType: 'task',
      targetId: normalizedTaskId,
      targetName: task.title || normalizedTaskId,
      summary: `完成了任务 ${task.title || ''}`.trim(),
      meta: { autoRecord: Boolean(shouldAutoRecord) },
    })

    const { data: updatedTasks } = await db.collection('tasks').where({ _id: normalizedTaskId, family_id: familyId }).get()
    const touchedEntities = [
      ...(updatedTasks || []).map(item => buildTouchedEntity('tasks', item)),
      ...(createdHealthRecord ? [buildTouchedEntity('health_records', createdHealthRecord)] : []),
    ]
    const response = {
      message: '已完成',
      autoRecorded: shouldAutoRecord && HEALTH_TYPES.includes(task.type),
      data: {
        completedTaskIds: [normalizedTaskId],
        autoRecordedHealthRecordIds: createdHealthRecord ? [createdHealthRecord._id] : [],
      },
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities,
        resyncScopes: ['tasks', 'health_records'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 推迟任务
   */
  async postponeTask(taskId, newDate, reason, maybeSync) {
    const parsed = parsePostponeArgs(taskId, newDate, reason, maybeSync)
    if (!parsed.taskId) throw new Error('缺少任务 ID')
    if (!parsed.newDate) throw new Error('请选择新日期')
    if (parsed.syncMeta?.clientMutationId) {
      const existing = await findAppliedMutation(db, this.familyId, parsed.syncMeta.clientMutationId)
      if (existing?.response) return existing.response
    }

    const now = Date.now()

    const { data: tasks } = await db.collection('tasks')
      .where({ _id: parsed.taskId, family_id: this.familyId })
      .get()
    if (!tasks || tasks.length === 0) throw new Error('任务不存在')
    const conflict = getTaskConflict(parsed.syncMeta, tasks[0])
    if (conflict) return conflict
    if (tasks[0].status !== 'pending') throw new Error('任务已处理')

    const task = tasks[0]

    await db.collection('tasks').doc(parsed.taskId).update({
      due_date: parsed.newDate,
      postpone_count: dbCmd.inc(1),
      postpone_reason: parsed.reason || null,
      ...buildVersionUpdate(dbCmd, now),
    })

    await logTaskOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'postpone',
      targetType: 'task',
      targetId: parsed.taskId,
      targetName: task.title || parsed.taskId,
      summary: `推迟了任务 ${task.title || ''}`.trim(),
      meta: { dueDate: parsed.newDate, reason: parsed.reason || null },
    })

    const { data: updatedTasks } = await db.collection('tasks').where({ _id: parsed.taskId, family_id: this.familyId }).get()
    const response = {
      message: '已推迟',
      data: { postponedTaskIds: [parsed.taskId] },
      ...buildSyncAck(parsed.syncMeta, {
        ack: 'accepted',
        touchedEntities: (updatedTasks || []).map(item => buildTouchedEntity('tasks', item)),
        resyncScopes: ['tasks'],
      }),
    }
    if (parsed.syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, parsed.syncMeta.clientMutationId, response)
    }
    return response
  },

  async batchPostponeTask(taskIds, newDate, reason, maybeSync) {
    const parsed = parsePostponeArgs(taskIds, newDate, reason, maybeSync)
    const normalizedTaskIds = parsed.taskIds
    if (!normalizedTaskIds.length) throw new Error('缺少任务 ID')
    if (!parsed.newDate) throw new Error('请选择新日期')
    if (parsed.syncMeta?.clientMutationId) {
      const existing = await findAppliedMutation(db, this.familyId, parsed.syncMeta.clientMutationId)
      if (existing?.response) return existing.response
    }

    const now = Date.now()
    const { data: tasks } = await db.collection('tasks')
      .where({
        _id: dbCmd.in(normalizedTaskIds),
        family_id: this.familyId,
      })
      .get()

    const pendingTasks = (tasks || []).filter(task => task?.status === 'pending')
    for (const task of pendingTasks) {
      const conflict = getTaskConflict(parsed.syncMeta, task)
      if (conflict) return conflict
    }
    const postponedTaskIds = pendingTasks.map(task => task._id).filter(Boolean)

    if (postponedTaskIds.length > 0) {
      await db.collection('tasks').where({
        _id: dbCmd.in(postponedTaskIds),
        family_id: this.familyId,
        status: 'pending',
      }).update({
        due_date: parsed.newDate,
        postpone_count: dbCmd.inc(1),
        postpone_reason: parsed.reason || null,
        ...buildVersionUpdate(dbCmd, now),
      })
    }

    await logTaskOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'postpone',
      targetType: 'task_batch',
      targetId: `batch:${now}`,
      targetName: `${postponedTaskIds.length}个任务`,
      summary: `批量推迟了 ${postponedTaskIds.length} 个任务`,
      meta: { postponedTaskIds, dueDate: parsed.newDate, reason: parsed.reason || null },
    })

    const { data: updatedTasks } = postponedTaskIds.length > 0
      ? await db.collection('tasks').where({ _id: dbCmd.in(postponedTaskIds), family_id: this.familyId }).get()
      : { data: [] }
    const response = {
      data: { postponed: postponedTaskIds.length, postponedTaskIds },
      ...buildSyncAck(parsed.syncMeta, {
        ack: 'accepted',
        touchedEntities: (updatedTasks || []).map(item => buildTouchedEntity('tasks', item)),
        resyncScopes: ['tasks'],
      }),
    }
    if (parsed.syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, parsed.syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 手动创建任务（从健康记录表单的「标记为待办」创建）
   */
  async createManualTask(data) {
    if (!data.title) throw new Error('请输入任务标题')
    if (!data.due_date) throw new Error('请选择日期')

    const expectedVariant = getTaskVariantKey({ type: data.type, details: data.details || {} })

    // 去重：同犬 + 同类型同子类型 + ±7天内已有 pending 任务则不创建
    if (data.dog_id && data.type) {
      const WEEK = 7 * 86400000
      const { data: existingTasks } = await db.collection('tasks')
        .where({
          family_id: this.familyId,
          dog_id: data.dog_id,
          type: data.type,
          status: 'pending',
          due_date: dbCmd.gte(data.due_date - WEEK).and(dbCmd.lte(data.due_date + WEEK)),
        })
        .get()
      if ((existingTasks || []).some(task => getTaskVariantKey(task) === expectedVariant)) {
        return {
          data: {
            taskId: null,
            created: 0,
            skipped: 1,
            message: '该犬已有同类型待办',
          }
        }
      }
    }

    const now = Date.now()
    const taskData = {
      card_type: data.card_type || 'individual',
      dog_id: data.dog_id || null,
      dog_name: data.dog_name || '',
      type: data.type || 'custom',
      title: data.title,
      due_date: data.due_date,
      status: 'pending',
      priority: data.due_date <= now ? 'overdue' : 'upcoming',
      details: data.details || null,
      source_record_id: null,
      source_collection: null,
      family_id: this.familyId,
      postpone_count: 0,
      created_by: this.uid,
      created_at: now,
      updated_at: now,
    }

    const { id } = await db.collection('tasks').add(taskData)
    await logTaskOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'create',
      targetType: 'task',
      targetId: id,
      targetName: taskData.title,
      summary: `创建了待办 ${taskData.title}`,
    })
    return {
      data: {
        taskId: id,
        created: 1,
        skipped: 0,
        message: '已创建待办',
      }
    }
  },

  /**
   * 批量创建待办任务（多犬同类型）
   * 一次鉴权 + 一次去重查询 + 并行写入
   */
  async batchCreateManualTasks(data) {
    if (!data.dogs || !Array.isArray(data.dogs) || data.dogs.length === 0) throw new Error('请选择犬只')
    if (!data.due_date) throw new Error('请选择日期')
    if (!data.type) throw new Error('请选择类型')

    const familyId = this.familyId
    const uid = this.uid
    const now = Date.now()
    const syncMeta = getSyncMeta(data)
    const appliedMutation = await findAppliedMutation(db, familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response
    const clientTaskIds = Array.isArray(syncMeta?.clientEntityIds?.tasks)
      ? syncMeta.clientEntityIds.tasks
      : []

    // ① 一次查询批量去重
    const WEEK = 7 * DAY_MS
    const dogIds = data.dogs.map(d => d.dog_id)
    const { data: existingTasks } = await db.collection('tasks')
      .where({
        family_id: familyId,
        dog_id: dbCmd.in(dogIds),
        type: data.type,
        status: 'pending',
        due_date: dbCmd.gte(data.due_date - WEEK).and(dbCmd.lte(data.due_date + WEEK)),
      })
      .get()
    const expectedVariant = getTaskVariantKey({ type: data.type, details: data.details || {} })
    const existingDogIds = new Set(
      (existingTasks || [])
        .filter(task => getTaskVariantKey(task) === expectedVariant)
        .map(task => task.dog_id)
    )

    // ② 并行创建不重复的任务
    const dogsToCreate = data.dogs.filter(d => !existingDogIds.has(d.dog_id))

    const results = await Promise.all(dogsToCreate.map(async (dog, index) => {
      const taskTitle = data.title
        || (data.type === 'vaccination' ? (data.details?.vaccine_type ? `疫苗 · ${data.details.vaccine_type}` : '疫苗') : '')
        || (data.type === 'deworming'
          ? (data.details?.drug_name ? `驱虫 · ${data.details.drug_name}` : '驱虫')
          : '')
        || data.type
      const taskData = buildVersionedCreate({
        ...(clientTaskIds[index] ? { _id: clientTaskIds[index] } : {}),
        card_type: data.card_type || 'individual',
        dog_id: dog.dog_id,
        dog_name: dog.dog_name || '',
        type: data.type,
        title: taskTitle,
        due_date: data.due_date,
        status: 'pending',
        priority: data.due_date <= now ? 'overdue' : 'upcoming',
        next_reminder_date: data.next_reminder_date || null,
        details: data.details || null,
        source_record_id: null,
        source_collection: null,
        family_id: familyId,
        postpone_count: 0,
        created_by: uid,
      }, now)
      const { id } = await db.collection('tasks').add(taskData)
      const resolvedTaskId = clientTaskIds[index] || id
      return { taskId: resolvedTaskId, dog_id: dog.dog_id, task: { ...taskData, _id: resolvedTaskId } }
    }))

    await logTaskOperation({
      familyId,
      actorUserId: uid,
      actionType: 'create',
      targetType: 'task_batch',
      targetId: `batch:${now}`,
      targetName: `${results.length}个待办`,
      summary: `批量创建了 ${results.length} 个待办任务`,
      meta: { created: results.length, skipped: data.dogs.length - results.length },
    })

    const response = {
      data: {
        created: results.length,
        skipped: data.dogs.length - results.length,
        tasks: results.map(({ task }) => task),
        message: results.length > 0 ? '已创建待办' : '已有相同待办',
      },
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: results.map(result => buildTouchedEntity('tasks', result.task)),
        resyncScopes: ['tasks'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 获取单个任务详情（供表单预填使用）
   */
  async getTasksByIds(taskIds) {
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return { data: [] }
    }

    const { data } = await db.collection('tasks')
      .where({
        _id: dbCmd.in(taskIds),
        family_id: this.familyId,
      })
      .get()

    return { data: data || [] }
  },

  async getTask(taskId) {
    if (!taskId) throw new Error('缺少任务 ID')

    const { data } = await db.collection('tasks')
      .where({ _id: taskId, family_id: this.familyId })
      .get()
    if (!data || data.length === 0) throw new Error('任务不存在')

    return { data: data[0] }
  },

  /**
   * 按周期批量取消任务
   */
  async cancelTasksByCycle(cycleId) {
    if (!cycleId) throw new Error('缺少周期 ID')

    const now = Date.now()

    const { updated } = await db.collection('tasks').where({
      cycle_id: cycleId,
      family_id: this.familyId,
      status: 'pending',
    }).update({
      status: 'cancelled',
      updated_at: now,
    })

    return { data: { cancelled: updated || 0 } }
  },

  /**
   * 每日审计（三层保障第三层）
   * 定时任务：检查缺失的任务并补生成
   */
  async _timing_dailyAudit() {
    const now = Date.now()

    // 获取所有家庭
    const { data: families } = await db.collection('families').get()

    let auditCount = 0

    for (const family of families) {
      const familyId = family._id
      const settings = family.settings || {
        default_vaccine_interval_puppy: 21,
        default_vaccine_interval_adult: 365,
        default_deworming_interval_puppy: 14,
        default_deworming_interval_adult: 90,
      }

      const estrusCreated = await ensureEstrusCycleMilestones(familyId, now)
      auditCount += estrusCreated.length

      // 审计 1：检查怀孕中的周期是否有当前流程任务
      const { data: pregnantCycles } = await db.collection('breeding_cycles')
        .where({ family_id: familyId, status: '怀孕中' })
        .get()

      for (const cycle of pregnantCycles) {
        const { total } = await db.collection('tasks')
          .where({
            cycle_id: cycle._id,
            type: 'breeding_milestone',
            status: dbCmd.in(['pending', 'completed']),
          })
          .count()

        if (total === 0) {
          // 缺失任务 → 补生成孕检建议
          await db.collection('tasks').add({
            card_type: 'individual',
            dog_id: cycle.dam_id,
            dog_name: cycle.dam_name,
            cycle_id: cycle._id,
            type: 'breeding_milestone',
            title: `${cycle.dam_name} · 建议孕检（审计补生成）`,
            due_date: now + 3 * DAY_MS,
            status: 'pending',
            priority: 'upcoming',
            family_id: familyId,
            postpone_count: 0,
            created_at: now,
            updated_at: now,
          })
          auditCount++
        }
      }

      // 审计 2：检查未断奶的窝是否有断奶任务
      const { data: unweanedLitters } = await db.collection('litters')
        .where({ family_id: familyId, weaned_at: null })
        .get()

      for (const litter of unweanedLitters) {
        const { total } = await db.collection('tasks')
          .where({
            litter_id: litter._id,
            type: 'breeding_milestone',
            status: dbCmd.in(['pending', 'completed']),
          })
          .count()

        if (total === 0) {
          await db.collection('tasks').add({
            card_type: 'individual',
            dog_id: litter.dam_id,
            dog_name: litter.dam_name,
            litter_id: litter._id,
            type: 'breeding_milestone',
            title: `${litter.dam_name}窝 · 确认断奶（审计补生成）`,
            due_date: now + 3 * DAY_MS,
            status: 'pending',
            priority: 'upcoming',
            family_id: familyId,
            postpone_count: 0,
            created_at: now,
            updated_at: now,
          })
          auditCount++
        }
      }

    }

    return { data: { auditCount } }
  },

  /**
   * 自动关闭过期发情周期
   * 定时任务：发情超过 21 天未操作 → 自动放弃
   */
  async _timing_autoCloseCycles() {
    const now = Date.now()
    const threshold = now - 21 * DAY_MS

    // 获取所有家庭的过期发情周期
    const { data: expiredCycles } = await db.collection('breeding_cycles')
      .where({
        status: '发情中',
        updated_at: dbCmd.lt(threshold),
      })
      .get()

    let closedCount = 0

    for (const cycle of expiredCycles) {
      // 关闭周期
      await db.collection('breeding_cycles').doc(cycle._id).update({
        status: '放弃',
        updated_at: now,
      })

      // 取消该周期的待办任务
      await db.collection('tasks').where({
        cycle_id: cycle._id,
        status: 'pending',
      }).update({
        status: 'cancelled',
        updated_at: now,
      })

      closedCount++
    }

    return { data: { closedCount } }
  },

  /**
   * 晨间摘要推送（定时任务，按分钟检查）
   * 统计逾期、繁育、疫苗/驱虫、用药、护理提醒，通过 UniPush 推送给所有活跃成员
   */
  async _timing_morningSummary() {
    const now = Date.now()
    const { dayEnd } = getBeijingDayContext(now)

    const { data: families } = await db.collection('families').get()
    let pushCount = 0

    for (const family of families) {
      const familyId = family._id
      const [pendingRes, medRes] = await Promise.all([
        db.collection('tasks').where({
          family_id: familyId,
          status: 'pending',
          due_date: dbCmd.lte(dayEnd),
        }).get(),
        db.collection('medication_tasks').where({
          family_id: familyId,
          status: '进行中',
        }).get(),
      ])

      const summary = buildMorningSummaryPayload(
        family,
        pendingRes.data || [],
        medRes.data || [],
        now,
      )
      if (!summary) continue

      // UniPush 推送（需要在 manifest.json 配置 UniPush 2.0）
      // V1 先记录推送内容，实际推送需要配置厂商通道后启用
      // TODO: 配置 UniPush 后取消注释
      // const activeMembers = family.members.filter(m => m.status === 'active')
      // for (const member of activeMembers) {
      //   await uniCloud.sendSms({ ...summary.content }) 或 uni-push
      // }

      pushCount++
    }

    return { data: { pushCount } }
  },

}

// 测试用导出（仅在测试环境使用）
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  module.exports._mergeTasks = mergeTasks
  module.exports._buildMorningSummaryPayload = buildMorningSummaryPayload
  module.exports._getBeijingDayContext = getBeijingDayContext
}
