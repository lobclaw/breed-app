/**
 * 健康管理云对象
 * 管理疫苗、驱虫、疾病记录、用药任务
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
const DAY_MS = 86400000

const HEALTH_RECORD_LABEL_MAP = {
  vaccination: '疫苗记录',
  deworming: '驱虫记录',
  illness: '疾病记录',
}

async function logHealthOperation({ familyId, actorUserId, actionType, domain = 'health', targetType, targetId, targetName, summary, meta = null }) {
  await safeWriteOperationLog({
    familyId,
    actorUserId,
    actionType,
    domain,
    targetType,
    targetId,
    targetName,
    summary,
    meta,
  })
}

// ── 内部辅助函数（不能放在 module.exports 内，否则 _ 前缀会被当作生命周期钩子） ──

function getIdArg(input, ...keys) {
  if (typeof input === 'string') return input.trim()
  if (!input || typeof input !== 'object') return ''

  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return ''
}

function startOfDay(ts) {
  const offsetMs = 8 * 60 * 60 * 1000
  const sourceTs = Number.isFinite(Number(ts)) ? Number(ts) : Date.now()
  const beijingNow = new Date(sourceTs + offsetMs)
  const year = beijingNow.getUTCFullYear()
  const month = beijingNow.getUTCMonth()
  const day = beijingNow.getUTCDate()

  return Date.UTC(year, month, day, 0, 0, 0, 0) - offsetMs
}

function mapMedicationStatus(status) {
  if (status === '已完成' || status === 'completed') return 'completed'
  if (status === '已取消' || status === 'cancelled') return 'cancelled'
  return 'active'
}

function formatTimeHM(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function normalizeMedicationTaskDetail(task, protocolName) {
  const durationDays = Number(task?.duration_days) || 1
  const startDate = startOfDay(task?.actual_start_date || task?.start_date || task?.created_at || Date.now())
  const endDate = task?.end_date || (startDate + ((durationDays - 1) * DAY_MS))
  const frequency = Number(task?.frequency) || 1
  const completion = calculateMedicationCompletion(task)
  const completedDateSet = new Set()
  const completedMap = {}

  if (Array.isArray(task?.completed_dates)) {
    task.completed_dates.forEach((item) => {
      if (typeof item !== 'number') return
      const dayTs = startOfDay(item)
      completedDateSet.add(dayTs)
    })
  }

  const dailyDoses = task?.daily_doses || {}
  Object.entries(dailyDoses).forEach(([dayKey, rawValue]) => {
    const dayNum = Number(dayKey)
    const dosesGiven = Number(rawValue) || 0
    if (!dayNum || dosesGiven < frequency) return

    const dayTs = startDate + ((dayNum - 1) * DAY_MS)
    completedDateSet.add(dayTs)
    completedMap[dayTs] = {
      name: `已完成${Math.min(dosesGiven, frequency)}/${frequency}次`,
      time: '',
    }
  })

  if (task?.completed_map && typeof task.completed_map === 'object') {
    Object.entries(task.completed_map).forEach(([key, value]) => {
      const dayTs = Number(key)
      if (!dayTs || !value || typeof value !== 'object') return
      completedMap[dayTs] = {
        name: value.name || value.label || '',
        time: value.time || (value.completed_at ? formatTimeHM(value.completed_at) : ''),
      }
    })
  }

  return {
    ...task,
    source_record_id: typeof task?.source_record_id === 'string' && task.source_record_id.trim()
      ? task.source_record_id.trim()
      : null,
    start_date: startDate,
    end_date: endDate,
    status: mapMedicationStatus(task?.status),
    completed_dates: Array.from(completedDateSet).sort((a, b) => a - b),
    completed_map: completedMap,
    completed_dose_count: completion.completedDoseCount,
    total_dose_count: completion.totalDoseCount,
    is_fully_completed: completion.isFullyCompleted,
    protocol_name: protocolName || task?.protocol_name || null,
  }
}

function calculateMedicationCompletion(task) {
  const durationDays = Math.max(1, Number(task?.duration_days) || 1)
  const frequency = Math.max(1, Number(task?.frequency) || 1)
  const dailyDoses = task?.daily_doses || {}

  let completedDoseCount = 0
  for (let day = 1; day <= durationDays; day += 1) {
    completedDoseCount += Math.min(Number(dailyDoses[String(day)]) || 0, frequency)
  }

  const totalDoseCount = durationDays * frequency

  return {
    completedDoseCount,
    totalDoseCount,
    isFullyCompleted: completedDoseCount >= totalDoseCount,
  }
}

function getMedicationProgressInfo(task) {
  const startDate = startOfDay(task?.actual_start_date || task?.start_date || task?.created_at || Date.now())
  const targetDay = startOfDay(Date.now())
  const currentDay = Math.max(1, Math.floor((targetDay - startDate) / DAY_MS) + 1)

  return {
    day: currentDay,
    totalDays: Math.max(1, Number(task?.duration_days) || 1),
  }
}

function isMedicationTaskExpired(task) {
  const { day, totalDays } = getMedicationProgressInfo(task)
  return day > totalDays
}

function getMedicationHistorySortTs(task) {
  return Number(task?.actual_start_date) || Number(task?.updated_at) || Number(task?.created_at) || 0
}

function getMedicationHistoryStatusRank(task) {
  const status = mapMedicationStatus(task?.status)
  if (status === 'active') return 0
  if (status === 'completed') return 1
  return 2
}

function sortMedicationHistory(tasks = []) {
  return [...tasks].sort((a, b) => {
    const rankDiff = getMedicationHistoryStatusRank(a) - getMedicationHistoryStatusRank(b)
    if (rankDiff !== 0) return rankDiff
    return getMedicationHistorySortTs(b) - getMedicationHistorySortTs(a)
  })
}

async function normalizeExpiredMedicationTasks(tasks = []) {
  const normalizedTasks = []
  const now = Date.now()

  for (const task of tasks) {
    if (task?.status !== '进行中' || !isMedicationTaskExpired(task)) {
      normalizedTasks.push(task)
      continue
    }

    await db.collection('medication_tasks').doc(task._id).update({
      status: '已完成',
      updated_at: now,
    })

    normalizedTasks.push({
      ...task,
      status: '已完成',
      updated_at: now,
    })
  }

  return normalizedTasks
}

function validateDetails(type, details) {
  if (type === 'vaccination' && !details.vaccine_type) {
    throw new Error('请填写疫苗类型')
  }
  if (type === 'deworming' && !details.deworming_type) {
    throw new Error('请选择驱虫类型')
  }
  if (type === 'illness' && !getIllnessPrimaryCondition(details)) {
    throw new Error('请填写主疾病')
  }
}

function normalizeIllnessCondition(condition) {
  return typeof condition === 'string' ? condition.trim() : ''
}

function normalizeIllnessSymptomTags(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .map(item => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean))]
}

function getIllnessPrimaryCondition(source) {
  const details = source?.details && typeof source.details === 'object' ? source.details : source
  return normalizeIllnessCondition(details?.primary_condition || details?.condition)
}

function normalizeIllnessDetails(details = {}) {
  const normalized = details && typeof details === 'object' ? { ...details } : {}
  const primaryCondition = getIllnessPrimaryCondition(normalized)

  if (primaryCondition) {
    normalized.primary_condition = primaryCondition
    normalized.condition = primaryCondition
  } else {
    delete normalized.primary_condition
    delete normalized.condition
  }

  normalized.symptom_tags = normalizeIllnessSymptomTags(normalized.symptom_tags)
  return normalized
}

function getIllnessSymptomSummary(source, limit = 2) {
  const details = source?.details && typeof source.details === 'object' ? source.details : source
  const tags = normalizeIllnessSymptomTags(details?.symptom_tags)
  if (tags.length === 0) return ''
  if (tags.length <= limit) return tags.join(' / ')
  return `${tags.slice(0, limit).join(' / ')} 等${tags.length}项`
}

function mapIllnessDispositionToStatus(value) {
  if (value === 'recovered' || value === '已康复') return '已康复'
  if (value === 'keep_treating' || value === '保持治疗中') return '治疗中'
  if (value === 'observation' || value === '回到观察中' || value === '观察中') return '观察中'
  return ''
}

function buildLinkedIllnessSummary(record) {
  if (!record) return null
  const details = normalizeIllnessDetails(record.details || {})
  return {
    recordId: record._id,
    dogId: record.dog_id || '',
    dogName: record.dog_name || '',
    primaryCondition: getIllnessPrimaryCondition(details) || '疾病',
    symptomSummary: getIllnessSymptomSummary(details),
    treatmentStatus: details?.treatment_status || '观察中',
    date: record.date || null,
  }
}

function buildLinkedMedicationTaskSummary(task) {
  if (!task) return null
  const normalizedTask = normalizeMedicationTaskDetail(task, null)
  const todayTs = startOfDay(Date.now())
  return {
    taskId: task._id,
    medicationName: task.drug_name || '用药',
    status: normalizedTask.status,
    todayCompleted: normalizedTask.completed_dates.includes(todayTs),
    startedAt: normalizedTask.start_date || null,
    endedAt: normalizedTask.status === 'active'
      ? null
      : (task.updated_at || normalizedTask.end_date || null),
    relationType: task.source_record_id ? 'linked' : 'standalone',
  }
}

function normalizeMedicationIllnessLinks(value) {
  if (!Array.isArray(value)) return []

  const seenDogIds = new Set()
  return value
    .map((item) => {
      const dogId = getIdArg(item, 'dog_id', 'dogId')
      const illnessRecordId = getIdArg(item, 'illness_record_id', 'illnessRecordId')
      if (!dogId || !illnessRecordId || seenDogIds.has(dogId)) return null
      seenDogIds.add(dogId)
      return {
        dog_id: dogId,
        illness_record_id: illnessRecordId,
      }
    })
    .filter(Boolean)
}

function normalizeIdList(value) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value
    .map((item) => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean)))
}

function getEntityConflict(syncMeta, collection, entity) {
  const baseVersion = getBaseVersion(syncMeta, entity?._id)
  if (baseVersion === null) return null
  const serverVersion = getServerVersion(entity)
  if (baseVersion === serverVersion) return null
  return buildConflictAck(syncMeta, {
    collection,
    entityId: entity._id,
    baseVersion,
    serverVersion,
  })
}

function buildMedicationDailyDosePatch(task, nowTs) {
  const now = Number.isFinite(Number(nowTs)) ? Number(nowTs) : Date.now()
  const today = startOfDay(now)
  const startDate = startOfDay(task?.actual_start_date || task?.start_date || task?.created_at || now)
  const currentDay = Math.floor((today - startDate) / DAY_MS) + 1
  const durationDays = Math.max(1, Number(task?.duration_days) || 1)

  if (currentDay < 1 || currentDay > durationDays) return null

  const frequency = Math.max(1, Number(task?.frequency) || 1)
  const dayKey = String(currentDay)
  const currentDoses = Number(task?.daily_doses?.[dayKey]) || 0
  if (currentDoses >= frequency) return null

  const nextDailyDoses = {
    ...(task?.daily_doses && typeof task.daily_doses === 'object' ? task.daily_doses : {}),
    [dayKey]: frequency,
  }

  let allComplete = true
  for (let day = 1; day <= durationDays; day += 1) {
    if ((Number(nextDailyDoses[String(day)]) || 0) < frequency) {
      allComplete = false
      break
    }
  }

  return {
    dayKey,
    nextDailyDoses,
    allComplete,
  }
}

function isActiveIllnessRecord(record) {
  return record?.type === 'illness' && (record.details?.treatment_status || '观察中') !== '已康复'
}

function getRecordActivityTs(record) {
  return record?.updated_at || record?.date || record?.created_at || 0
}

function sortRecordsByActivityDesc(records = []) {
  return [...records].sort((a, b) => getRecordActivityTs(b) - getRecordActivityTs(a))
}

async function findDuplicateActiveIllnesses(familyId, { dogIds = [], condition, excludeRecordId } = {}) {
  const normalizedCondition = normalizeIllnessCondition(condition)
  if (!normalizedCondition || !Array.isArray(dogIds) || dogIds.length === 0) return []

  const { data: records } = await db.collection('health_records')
    .where({
      family_id: familyId,
      dog_id: dbCmd.in(dogIds),
      type: 'illness',
      deleted_at: null,
    })
    .get()

  return (records || [])
    .filter(record => record._id !== excludeRecordId)
    .filter(record => getIllnessPrimaryCondition(record) === normalizedCondition)
    .filter(isActiveIllnessRecord)
}

async function assertNoDuplicateActiveIllness(familyId, { dogIds = [], condition, excludeRecordId } = {}) {
  const duplicates = await findDuplicateActiveIllnesses(familyId, { dogIds, condition, excludeRecordId })
  if (duplicates.length > 0) {
    const label = normalizeIllnessCondition(condition) || '疾病'
    throw new Error(`已有进行中的「${label}」记录，请先更新原记录`)
  }
  return duplicates
}

async function cleanupDuplicateIllnessesForFamily(familyId, { dogId } = {}) {
  const where = {
    family_id: familyId,
    type: 'illness',
    deleted_at: null,
  }
  if (dogId) where.dog_id = dogId

  const { data: records } = await db.collection('health_records').where(where).get()
  const activeRecords = (records || []).filter(isActiveIllnessRecord)
  const groups = new Map()

  for (const record of activeRecords) {
    const condition = getIllnessPrimaryCondition(record) || '生病中'
    const key = `${record.dog_id}:${condition}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(record)
  }

  let cleanedRecords = 0
  let cleanedGroups = 0
  const now = Date.now()

  for (const groupRecords of groups.values()) {
    if (groupRecords.length <= 1) continue
    cleanedGroups += 1
    const sorted = sortRecordsByActivityDesc(groupRecords)
    const keeper = sorted[0]
    const duplicates = sorted.slice(1)

    for (const duplicate of duplicates) {
      await db.collection('tasks').where({
        family_id: familyId,
        type: 'illness',
        source_record_id: duplicate._id,
      }).update({
        source_record_id: keeper._id,
        updated_at: now,
      })

      await db.collection('health_records').doc(duplicate._id).update({
        'details.treatment_status': '已康复',
        'details.merged_into_record_id': keeper._id,
        'details.merge_reason': 'duplicate_active_condition',
        updated_at: now,
      })

      cleanedRecords += 1
    }
  }

  return { cleanedGroups, cleanedRecords }
}

async function getFamilySettings(familyId) {
  const { data } = await db.collection('families')
    .doc(familyId)
    .field({ settings: true })
    .get()

  const family = data[0] || data
  return family.settings || {
    default_weaning_days: 45,
    default_vaccine_interval_puppy: 21,
    default_vaccine_interval_adult: 365,
    default_deworming_interval_puppy: 14,
    default_deworming_interval_adult: 90,
  }
}

/**
 * 保存自定义疫苗/驱虫类型到家庭设置
 * 预设类型不保存，只保存用户新增的
 */
const PRESET_VACCINE_TYPES = ['卫佳5', '卫佳8', '卫佳10', '狂犬']
const PRESET_DEWORMING_DRUGS = {
  internal: ['拜宠清', '海乐妙', '犬心保'],
  external: ['福来恩', '大宠爱'],
  combo: ['超可信', '博来恩'],
}

async function saveCustomType(familyId, type, details) {
  try {
    if (type === 'vaccination' && details?.vaccine_type) {
      const vt = details.vaccine_type
      if (PRESET_VACCINE_TYPES.includes(vt)) return
      // 先读取已有自定义类型，去重后再写入
      const { data: familyData } = await db.collection('families').doc(familyId).field({ settings: true }).get()
      const family = familyData[0] || familyData || {}
      const existing = family.settings?.custom_vaccine_types || []
      if (existing.includes(vt)) return
      await db.collection('families').doc(familyId).update({
        'settings.custom_vaccine_types': dbCmd.push([vt]),
        updated_at: Date.now(),
      })
    }
    if (type === 'deworming' && details?.drug_name) {
      const drug = details.drug_name
      const subtype = details.deworming_type || 'internal'
      const presetList = PRESET_DEWORMING_DRUGS[subtype] || []
      if (presetList.includes(drug)) return
      const { data: familyData } = await db.collection('families').doc(familyId).field({ settings: true }).get()
      const family = familyData[0] || familyData || {}
      const existing = family.settings?.custom_deworming_drugs?.[subtype] || []
      if (existing.includes(drug)) return
      await db.collection('families').doc(familyId).update({
        [`settings.custom_deworming_drugs.${subtype}`]: dbCmd.push([drug]),
        updated_at: Date.now(),
      })
    }
  } catch (e) {
    console.log('[saveCustomType] failed:', e.message)
  }
}

function getHealthVariantKey(type, details = {}) {
  if (type === 'vaccination') {
    return `vaccination:${details.vaccine_type || ''}`
  }
  if (type === 'deworming') {
    return `deworming:${details.deworming_type || ''}:${details.drug_name || ''}`
  }
  if (type === 'illness') {
    return `illness:${getIllnessPrimaryCondition(details) || ''}`
  }
  return type || ''
}

/**
 * 检查是否已有同类型的 pending 任务在 ±7 天内
 */
async function hasDuplicateTask(familyId, dogId, taskType, dueDate, details) {
  const WEEK = 7 * 86400000
  const { data: tasks } = await db.collection('tasks')
    .where({
      family_id: familyId,
      dog_id: dogId,
      type: taskType,
      status: 'pending',
      due_date: dbCmd.gte(dueDate - WEEK).and(dbCmd.lte(dueDate + WEEK)),
    })
    .get()

  const expectedKey = getHealthVariantKey(taskType, details)
  return (tasks || []).some(task => getHealthVariantKey(task.type, task.details || {}) === expectedKey)
}

function shouldCreateReminder(data) {
  if (typeof data?.create_task === 'boolean') return data.create_task
  return !data?.skip_reminder
}

function getHealthTaskTitle(type, details = {}) {
  if (type === 'vaccination') {
    return details.vaccine_type ? `疫苗 · ${details.vaccine_type}` : '疫苗'
  }
  if (type === 'deworming') {
    const subtypeLabelMap = { internal: '内驱', external: '外驱', combo: '内外同驱' }
    if (details.drug_name) return `驱虫 · ${details.drug_name}`
    if (details.deworming_type) return `驱虫 · ${subtypeLabelMap[details.deworming_type] || details.deworming_type}`
    return '驱虫'
  }
  if (type === 'illness') {
    return `${getIllnessPrimaryCondition(details) || '疾病'}复查`
  }
  return type || '任务'
}

/**
 * 录入健康记录后，自动完成该犬同类型的 pending 任务
 * 匹配规则：同犬 + 同类型 + 子类型匹配（或任务无子类型）
 * 返回已完成的任务列表（用于前端提示）
 */
async function autoCompletePendingTasks(familyId, dogId, type, details) {
  const now = Date.now()

  // 查该犬同类型的 pending 任务，按到期日排序，只取最近 1 条
  const { data: tasks } = await db.collection('tasks')
    .where({
      family_id: familyId,
      dog_id: dogId,
      type: type,
      status: 'pending',
    })
    .orderBy('due_date', 'asc')
    .limit(5)
    .get()

  if (!tasks || tasks.length === 0) return []

  // 找第一条子类型匹配的任务
  for (const task of tasks) {
    let match = false
    if (type === 'vaccination') {
      // 任一方无子类型视为通配，或两方匹配
      match = !task.details?.vaccine_type || !details?.vaccine_type || task.details.vaccine_type === details.vaccine_type
    } else if (type === 'deworming') {
      const typeMatch = !task.details?.deworming_type || !details?.deworming_type || task.details.deworming_type === details.deworming_type
      const drugMatch = !task.details?.drug_name || !details?.drug_name || task.details.drug_name === details.drug_name
      match = typeMatch && drugMatch
    } else {
      match = true
    }

    if (match) {
      await db.collection('tasks').doc(task._id).update({
        status: 'completed',
        completed_at: now,
        updated_at: now,
      })
      return [{ _id: task._id, dog_name: task.dog_name, title: task.title }]
    }
  }
  return []
}

async function generateReminders(familyId, type, data, dog, recordId, preloadedSettings) {
  const now = Date.now()
  const settings = preloadedSettings || await getFamilySettings(familyId)

  if (type === 'vaccination') {
    const vaccineInterval = (dog.role === '种狗' || dog.role === '外部种公')
      ? (settings.default_vaccine_interval_adult || 365)
      : (settings.default_vaccine_interval_puppy || 21)
    const dueDate = data.details?.next_reminder_date || (data.date + (vaccineInterval * 86400000))
    // 去重：该犬 ±7 天内已有同类型 pending 任务则不创建
    if (await hasDuplicateTask(familyId, dog._id, 'vaccination', dueDate, data.details)) return

    await db.collection('tasks').add({
      card_type: 'individual',
      dog_id: dog._id,
      dog_name: dog.name,
      type: 'vaccination',
      title: getHealthTaskTitle('vaccination', data.details),
      due_date: dueDate,
      status: 'pending',
      priority: 'upcoming',
      source_record_id: recordId,
      source_collection: 'health_records',
      family_id: familyId,
      postpone_count: 0,
      details: { vaccine_type: data.details?.vaccine_type || null },
      created_at: now,
      updated_at: now,
    })
  }

  if (type === 'deworming') {
    const dewormInterval = (dog.role === '种狗' || dog.role === '外部种公')
      ? (settings.default_deworming_interval_adult || 90)
      : (settings.default_deworming_interval_puppy || 14)
    const nextDate = data.details?.next_reminder_date ||
      (data.date + (dewormInterval * 86400000))

    if (await hasDuplicateTask(familyId, dog._id, 'deworming', nextDate, data.details)) return

    await db.collection('tasks').add({
      card_type: 'individual',
      dog_id: dog._id,
      dog_name: dog.name,
      type: 'deworming',
      title: getHealthTaskTitle('deworming', data.details),
      due_date: nextDate,
      status: 'pending',
      priority: 'upcoming',
      source_record_id: recordId,
      source_collection: 'health_records',
      family_id: familyId,
      postpone_count: 0,
      details: { deworming_type: data.details?.deworming_type || null, drug_name: data.details?.drug_name || null },
      created_at: now,
      updated_at: now,
    })
  }

  if (type === 'illness' && data.details?.next_reminder_date) {
    await db.collection('tasks').add({
      card_type: 'individual',
      dog_id: dog._id,
      dog_name: dog.name,
      type: 'illness',
      title: getHealthTaskTitle('illness', data.details),
      due_date: data.details.next_reminder_date,
      status: 'pending',
      priority: 'upcoming',
      source_record_id: recordId,
      source_collection: 'health_records',
      family_id: familyId,
      postpone_count: 0,
      details: {
        primary_condition: getIllnessPrimaryCondition(data.details || {}) || null,
        condition: data.details?.condition || null,
        symptom_tags: normalizeIllnessSymptomTags(data.details?.symptom_tags),
        severity: data.details?.severity || null,
        treatment_status: data.details?.treatment_status || null,
      },
      created_at: now,
      updated_at: now,
    })
  }
}

async function createExpense(familyId, uid, data, dog, sourceRecordId) {
  const now = Date.now()
  const sourceLabels = {
    vaccination: '疫苗',
    deworming: '驱虫',
    illness: '治疗',
  }
  const categoryMap = {
    vaccination: '疫苗驱虫',
    deworming: '疫苗驱虫',
    illness: '医疗',
  }
  const sourceLabel = sourceLabels[data.type] || '健康'
  const category = categoryMap[data.type] || '其他'
  const noteText = typeof data.notes === 'string' ? data.notes.trim() : ''

  await db.collection('expenses').add({
    total_amount: data.cost,
    category,
    date: data.date,
    notes: noteText
      ? (sourceLabel !== category ? `${sourceLabel} · ${noteText}` : noteText)
      : (sourceLabel !== category ? sourceLabel : null),
    linked_dog_ids: [data.dog_id],
    dog_names: [dog.name],
    source_type: 'auto',
    source_record_id: sourceRecordId || null,
    family_id: familyId,
    created_by: uid,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  })
}

module.exports = {
  _before: async function() {
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
   * 预热接口（App 启动时静默调用，消除冷启动）
   */
  async ping() {
    return { data: { ok: true } }
  },

  /**
   * 录入健康记录（vaccination/deworming/illness）
   * 自动生成下次提醒任务 + 创建费用
   */
  /**
   * 更新疾病记录的治疗状态（标记康复/改为治疗中等）
   */
  async updateIllnessStatus(recordId, newStatus) {
    const familyId = this.familyId
    await db.collection('health_records').where({
      _id: recordId,
      family_id: familyId,
    }).update({
      'details.treatment_status': newStatus,
      updated_at: Date.now(),
    })
    return { data: { success: true } }
  },

  async batchUpdateIllnessStatus(input = {}) {
    const familyId = this.familyId
    const now = Date.now()
    const syncMeta = getSyncMeta(input)
    if (syncMeta?.clientMutationId) {
      const existing = await findAppliedMutation(db, familyId, syncMeta.clientMutationId)
      if (existing?.response) return existing.response
    }
    const status = typeof input?.status === 'string' ? input.status.trim() : ''
    const requestedIllnessIds = normalizeIdList([
      ...(Array.isArray(input?.illnessIds) ? input.illnessIds : []),
      ...(Array.isArray(input?.illness_ids) ? input.illness_ids : []),
      getIdArg(input, 'id', 'recordId', 'record_id', 'illnessId', 'illness_id'),
    ])

    if (!requestedIllnessIds.length) throw new Error('缺少疾病记录 ID')
    if (!status) throw new Error('缺少疾病状态')

    const { data: illnessRecords } = await db.collection('health_records')
      .where({
        _id: dbCmd.in(requestedIllnessIds),
        family_id: familyId,
        type: 'illness',
        deleted_at: null,
      })
      .get()
    const validIllnessIds = (illnessRecords || []).map(record => record._id).filter(Boolean)
    if (validIllnessIds.length === 0) throw new Error('疾病记录不存在')
    for (const record of illnessRecords || []) {
      const conflict = getEntityConflict(syncMeta, 'health_records', record)
      if (conflict) return conflict
    }

    await db.collection('health_records').where({
      _id: dbCmd.in(validIllnessIds),
      family_id: familyId,
      type: 'illness',
      deleted_at: null,
    }).update({
      'details.treatment_status': status,
      ...buildVersionUpdate(dbCmd, now),
    })

    await logHealthOperation({
      familyId,
      actorUserId: this.uid,
      actionType: 'status_change',
      domain: 'health',
      targetType: 'illness_batch',
      targetId: `batch:${now}`,
      targetName: `${validIllnessIds.length}条疾病记录`,
      summary: `批量更新了 ${validIllnessIds.length} 条疾病状态`,
      meta: { illnessIds: validIllnessIds, status },
    })

    const { data: updatedRecords } = await db.collection('health_records')
      .where({
        _id: dbCmd.in(validIllnessIds),
        family_id: familyId,
        type: 'illness',
        deleted_at: null,
      })
      .get()

    const response = {
      data: { success: true, updatedIllnessIds: validIllnessIds },
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: (updatedRecords || []).map(record => buildTouchedEntity('health_records', record)),
        resyncScopes: ['health_records'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 疾病康复收口：标记疾病康复，并停止显式关联的进行中用药。
   */
  async recoverIllnesses(input = {}) {
    const familyId = this.familyId
    const now = Date.now()
    const syncMeta = getSyncMeta(input)
    if (syncMeta?.clientMutationId) {
      const existing = await findAppliedMutation(db, familyId, syncMeta.clientMutationId)
      if (existing?.response) return existing.response
    }
    const singleIllnessId = getIdArg(input, 'id', 'recordId', 'record_id', 'illnessId', 'illness_id')
    const illnessIds = normalizeIdList([
      ...(Array.isArray(input?.illnessIds) ? input.illnessIds : []),
      ...(Array.isArray(input?.illness_ids) ? input.illness_ids : []),
      singleIllnessId,
    ])
    const medicationTaskIds = normalizeIdList([
      ...(Array.isArray(input?.medicationTaskIds) ? input.medicationTaskIds : []),
      ...(Array.isArray(input?.medication_task_ids) ? input.medication_task_ids : []),
    ])

    if (illnessIds.length === 0) throw new Error('缺少疾病记录 ID')

    const { data: illnessRecords } = await db.collection('health_records')
      .where({
        _id: dbCmd.in(illnessIds),
        family_id: familyId,
        type: 'illness',
        deleted_at: null,
      })
      .get()
    const validIllnessIds = (illnessRecords || []).map(record => record._id).filter(Boolean)
    if (validIllnessIds.length === 0) throw new Error('疾病记录不存在')
    for (const record of illnessRecords || []) {
      const conflict = getEntityConflict(syncMeta, 'health_records', record)
      if (conflict) return conflict
    }

    await db.collection('health_records').where({
      _id: dbCmd.in(validIllnessIds),
      family_id: familyId,
      type: 'illness',
    }).update({
      'details.treatment_status': '已康复',
      ...buildVersionUpdate(dbCmd, now),
    })

    const medicationMap = new Map()
    if (validIllnessIds.length > 0) {
      const { data: linkedMeds } = await db.collection('medication_tasks')
        .where({
          family_id: familyId,
          source_record_id: dbCmd.in(validIllnessIds),
          status: '进行中',
        })
        .get()
      ;(linkedMeds || []).forEach(med => medicationMap.set(med._id, med))
    }
    if (medicationTaskIds.length > 0) {
      const { data: selectedMeds } = await db.collection('medication_tasks')
        .where({
          _id: dbCmd.in(medicationTaskIds),
          family_id: familyId,
          status: '进行中',
        })
        .get()
      ;(selectedMeds || []).forEach(med => medicationMap.set(med._id, med))
    }

    const activeMedicationIds = Array.from(medicationMap.keys()).filter(Boolean)
    for (const med of medicationMap.values()) {
      const conflict = getEntityConflict(syncMeta, 'medication_tasks', med)
      if (conflict) return conflict
    }
    if (activeMedicationIds.length > 0) {
      await db.collection('medication_tasks').where({
        _id: dbCmd.in(activeMedicationIds),
        family_id: familyId,
        status: '进行中',
      }).update({
        status: '已取消',
        ...buildVersionUpdate(dbCmd, now),
      })

      // 兼容旧数据：取消关联的 daily tasks（新记录没有，旧记录可能有）
      await db.collection('tasks').where({
        medication_task_id: dbCmd.in(activeMedicationIds),
        status: 'pending',
      }).update({
        status: 'cancelled',
        updated_at: now,
      })
    }

    await logHealthOperation({
      familyId,
      actorUserId: this.uid,
      actionType: 'status_change',
      domain: 'health',
      targetType: 'illness_batch',
      targetId: `batch:${now}`,
      targetName: `${validIllnessIds.length}条疾病记录`,
      summary: `标记 ${validIllnessIds.length} 条疾病康复，并停止 ${activeMedicationIds.length} 个关联用药任务`,
      meta: { illnessCount: validIllnessIds.length, medicationTaskCount: activeMedicationIds.length },
    })

    const { data: updatedIllnesses } = await db.collection('health_records')
      .where({
        _id: dbCmd.in(validIllnessIds),
        family_id: familyId,
        type: 'illness',
      })
      .get()
    const { data: updatedMeds } = activeMedicationIds.length > 0
      ? await db.collection('medication_tasks')
        .where({
          _id: dbCmd.in(activeMedicationIds),
          family_id: familyId,
        })
        .get()
      : { data: [] }

    const response = {
      data: {
        recovered: validIllnessIds.length,
        cancelledMedicationTasks: activeMedicationIds.length,
        recoveredIllnessIds: validIllnessIds,
        cancelledMedicationTaskIds: activeMedicationIds,
      },
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: [
          ...(updatedIllnesses || []).map(record => buildTouchedEntity('health_records', record)),
          ...(updatedMeds || []).map(record => buildTouchedEntity('medication_tasks', record)),
        ],
        resyncScopes: ['health_records', 'medication_tasks'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  async checkDuplicateIllness({ dog_ids, condition, exclude_record_id } = {}) {
    const duplicates = await findDuplicateActiveIllnesses(this.familyId, {
      dogIds: Array.isArray(dog_ids) ? dog_ids : [],
      condition,
      excludeRecordId: exclude_record_id || null,
    })

    return {
      data: {
        duplicates: duplicates.map(record => ({
          recordId: record._id,
          dogId: record.dog_id,
          condition: getIllnessPrimaryCondition(record) || '生病中',
        })),
      },
    }
  },

  async cleanupDuplicateIllnesses({ dog_id } = {}) {
    const result = await cleanupDuplicateIllnessesForFamily(this.familyId, {
      dogId: dog_id || null,
    })
    return { data: result }
  },

  async addHealthRecord(data) {
    if (!data.type) throw new Error('请选择记录类型')
    if (!data.dog_id) throw new Error('请选择犬只')
    if (!data.date) throw new Error('请选择日期')

    const validTypes = ['vaccination', 'deworming', 'illness']
    if (!validTypes.includes(data.type)) throw new Error('无效的记录类型')

    const now = Date.now()
    const familyId = this.familyId

    // 校验犬只
    const { data: dogs } = await db.collection('dogs')
      .where({ _id: data.dog_id, family_id: familyId, deleted_at: null })
      .get()
    if (!dogs || dogs.length === 0) throw new Error('犬只不存在')
    const dog = dogs[0]

    // 类型特有字段校验
    const normalizedDetails = data.type === 'illness'
      ? normalizeIllnessDetails(data.details || {})
      : (data.details || {})

    validateDetails(data.type, normalizedDetails)

    if (data.type === 'illness' && (normalizedDetails?.treatment_status || '观察中') !== '已康复') {
      await assertNoDuplicateActiveIllness(familyId, {
        dogIds: [data.dog_id],
        condition: getIllnessPrimaryCondition(normalizedDetails),
      })
    }

    // 创建健康记录
    const recordData = {
      type: data.type,
      dog_id: data.dog_id,
      family_id: familyId,
      date: data.date,
      cost: data.cost || null,
      notes: data.notes || null,
      details: normalizedDetails,
      created_by: this.uid,
      created_at: now,
      updated_at: now,
    }
    const { id: recordId } = await db.collection('health_records').add(recordData)

    // 保存自定义类型到家庭设置（如果是新类型）
    await saveCustomType(familyId, data.type, normalizedDetails)

    // 自动完成该犬同类型的 pending 待办（在创建新提醒之前）
    const completedTasks = await autoCompletePendingTasks(familyId, data.dog_id, data.type, normalizedDetails)

    // 生成下次提醒任务（skip_reminder 时跳过）
    if (shouldCreateReminder(data)) {
      await generateReminders(familyId, data.type, { ...data, details: normalizedDetails }, dog, recordId)
    }

    // 如有费用 → 创建 expense
    if (data.cost && data.cost > 0) {
      await createExpense(familyId, this.uid, data, dog, recordId)
    }

    await logHealthOperation({
      familyId,
      actorUserId: this.uid,
      actionType: 'create',
      targetType: 'health_record',
      targetId: recordId,
      targetName: dog.name || '未命名犬只',
      summary: `为 ${dog.name || '未命名犬只'} 新增了${HEALTH_RECORD_LABEL_MAP[data.type] || '健康记录'}`,
      meta: { type: data.type },
    })

    return { data: { recordId, completedTasks } }
  },

  /**
   * 批量录入健康记录（多犬同类型）
   * 一次鉴权 + 一次犬只校验 + 一次读 settings + 并行写入
   */
  async batchAddHealthRecords(data) {
    if (!data.type) throw new Error('请选择记录类型')
    if (!data.dog_ids || !Array.isArray(data.dog_ids) || data.dog_ids.length === 0) throw new Error('请选择犬只')
    if (!data.date) throw new Error('请选择日期')

    const validTypes = ['vaccination', 'deworming', 'illness']
    if (!validTypes.includes(data.type)) throw new Error('无效的记录类型')

    const now = Date.now()
    const familyId = this.familyId
    const uid = this.uid
    const syncMeta = getSyncMeta(data)
    const appliedMutation = await findAppliedMutation(db, familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response
    const clientRecordIds = Array.isArray(syncMeta?.clientEntityIds?.health_records)
      ? syncMeta.clientEntityIds.health_records
      : []

    const normalizedDetails = data.type === 'illness'
      ? normalizeIllnessDetails(data.details || {})
      : (data.details || {})

    validateDetails(data.type, normalizedDetails)

    if (data.type === 'illness' && (normalizedDetails?.treatment_status || '观察中') !== '已康复') {
      await assertNoDuplicateActiveIllness(familyId, {
        dogIds: data.dog_ids,
        condition: getIllnessPrimaryCondition(normalizedDetails),
      })
    }

    // ① 一次查询校验所有犬只
    const { data: dogs } = await db.collection('dogs')
      .where({ _id: dbCmd.in(data.dog_ids), family_id: familyId, deleted_at: null })
      .get()
    if (dogs.length !== data.dog_ids.length) throw new Error('部分犬只不存在或不属于当前家庭')
    const dogMap = new Map(dogs.map(dog => [dog._id, dog]))
    const orderedDogs = data.dog_ids.map(dogId => dogMap.get(dogId)).filter(Boolean)

    // ② 一次读取 family settings
    const settings = await getFamilySettings(familyId)

    // ③ 一次保存自定义类型
    await saveCustomType(familyId, data.type, normalizedDetails)

    // ④ 费用分摊
    const totalCost = data.cost || null
    const perDogCost = totalCost && orderedDogs.length > 1
      ? Math.round(totalCost / orderedDogs.length * 100) / 100
      : totalCost

    // ⑤ 并行处理每只犬
    const results = await Promise.all(orderedDogs.map(async (dog, index) => {
      const recordData = buildVersionedCreate({
        ...(clientRecordIds[index] ? { _id: clientRecordIds[index] } : {}),
        type: data.type,
        dog_id: dog._id,
        family_id: familyId,
        date: data.date,
        cost: perDogCost && perDogCost > 0 ? perDogCost : null,
        notes: data.notes || null,
        details: normalizedDetails,
        created_by: uid,
      }, now)
      const { id: recordId } = await db.collection('health_records').add(recordData)
      const resolvedRecordId = clientRecordIds[index] || recordId

      // 自动完成该犬同类型的 pending 待办
      const completedTasks = await autoCompletePendingTasks(familyId, dog._id, data.type, normalizedDetails)

      // 生成下次提醒任务（传入预加载的 settings）
      if (shouldCreateReminder(data)) {
        await generateReminders(familyId, data.type, { ...data, details: normalizedDetails }, dog, resolvedRecordId, settings)
      }

      // 创建费用
      if (perDogCost && perDogCost > 0) {
        await createExpense(familyId, uid, {
          type: data.type, date: data.date, cost: perDogCost,
          dog_id: dog._id, notes: data.notes || null,
        }, dog, resolvedRecordId)
      }

      return { recordId: resolvedRecordId, dog_id: dog._id, completedTasks, record: { ...recordData, _id: resolvedRecordId } }
    }))

    await logHealthOperation({
      familyId,
      actorUserId: uid,
      actionType: 'create',
      targetType: 'health_record_batch',
      targetId: `batch:${Date.now()}`,
      targetName: `${results.length}条健康记录`,
      summary: `批量新增了 ${results.length} 条${HEALTH_RECORD_LABEL_MAP[data.type] || '健康记录'}`,
      meta: { type: data.type, count: results.length },
    })

    const touchedTasks = results.flatMap(r => r.completedTasks || [])
    const response = {
      data: {
        count: results.length,
        records: results.map(r => ({ recordId: r.recordId, dog_id: r.dog_id })),
        completedTasks: touchedTasks,
      },
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: [
          ...results.map(r => buildTouchedEntity('health_records', r.record)),
          ...touchedTasks.map(task => buildTouchedEntity('tasks', task)),
        ],
        resyncScopes: ['health_records', 'tasks', 'expenses'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 获取某犬的健康记录
   */
  async getHealthHistory(dogId, type) {
    if (!dogId) throw new Error('缺少犬只 ID')

    const where = { dog_id: dogId, family_id: this.familyId }
    if (type) where.type = type

    const { data: records } = await db.collection('health_records')
      .where(where)
      .orderBy('date', 'desc')
      .get()

    return {
      data: (records || []).map((record) => {
        if (record?.type !== 'illness') return record
        return {
          ...record,
          details: normalizeIllnessDetails(record.details || {}),
        }
      })
    }
  },

  /**
   * 获取某犬的全部用药记录
   */
  async getMedicationHistory(dogId) {
    if (!dogId) throw new Error('缺少犬只 ID')

    const { data: tasks } = await db.collection('medication_tasks')
      .where({ dog_id: dogId, family_id: this.familyId })
      .get()

    const normalizedTasks = await normalizeExpiredMedicationTasks(tasks || [])
    const records = sortMedicationHistory(normalizedTasks).map((task) => {
      const normalizedTask = normalizeMedicationTaskDetail(task, null)
      const progress = getMedicationProgressInfo(task)

      return {
        ...normalizedTask,
        activity_ts: getMedicationHistorySortTs(task),
        progress: normalizedTask.status === 'active'
          ? {
              current: Math.min(progress.day, progress.totalDays),
              total: progress.totalDays,
            }
          : null,
      }
    })

    return { data: records }
  },

  /**
   * 开始连续用药
   */
  /**
   * 检查犬只是否已有同药名的进行中用药任务
   */
  async checkDuplicateMedication(dogId, drugName) {
    if (!dogId || !drugName) return { data: null }
    const { data: existing } = await db.collection('medication_tasks')
      .where({
        family_id: this.familyId,
        dog_id: dogId,
        drug_name: drugName,
        status: '进行中',
      })
      .get()
    const normalizedExisting = await normalizeExpiredMedicationTasks(existing || [])
    const activeTask = normalizedExisting.find(task => task.status === '进行中')
    if (activeTask) {
      const progress = getMedicationProgressInfo(activeTask)
      return {
        data: {
          exists: true,
          dogName: activeTask.dog_name || '',
          drugName: activeTask.drug_name,
          day: progress.day,
          totalDays: progress.totalDays,
        }
      }
    }
    return { data: null }
  },

  /**
   * 批量检查重复用药（一次查询）
   */
  async batchCheckDuplicateMedication(dogIds, drugName) {
    if (!dogIds || !Array.isArray(dogIds) || !drugName) return { data: [] }

    const { data: existing } = await db.collection('medication_tasks')
      .where({
        family_id: this.familyId,
        dog_id: dbCmd.in(dogIds),
        drug_name: drugName,
        status: '进行中',
      })
      .get()

    const normalizedExisting = await normalizeExpiredMedicationTasks(existing || [])
    const results = normalizedExisting
      .filter(task => task.status === '进行中')
      .map(task => {
        const progress = getMedicationProgressInfo(task)
        return {
          dog_id: task.dog_id,
          dogName: task.dog_name || '',
          drugName: task.drug_name,
          day: progress.day,
          totalDays: progress.totalDays,
        }
      })

    return { data: results }
  },

  /**
   * 批量创建用药任务（多犬同药）
   * 一次校验 + 并行创建 medication_tasks + 费用 + 疾病升级
   */
  async batchStartMedication(data) {
    if (!data.dog_ids || !Array.isArray(data.dog_ids) || data.dog_ids.length === 0) throw new Error('请选择犬只')
    if (!data.drug_name) throw new Error('请填写药品名称')
    const durationDays = (data.duration_days && data.duration_days >= 1) ? data.duration_days : 1

    const now = Date.now()
    const familyId = this.familyId
    const uid = this.uid
    const syncMeta = getSyncMeta(data)
    const appliedMutation = await findAppliedMutation(db, familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response
    const clientMedicationIds = Array.isArray(syncMeta?.clientEntityIds?.medication_tasks)
      ? syncMeta.clientEntityIds.medication_tasks
      : []
    const startDate = Number.isFinite(Number(data.actual_start_date)) ? Number(data.actual_start_date) : now
    const endDate = startDate + ((durationDays - 1) * DAY_MS)
    const normalizedIllnessLinks = normalizeMedicationIllnessLinks(data.illness_links || data.illnessLinks)
    const illnessLinkMap = new Map(normalizedIllnessLinks.map(item => [item.dog_id, item.illness_record_id]))
    const singleIllnessRecordId = getIdArg(data, 'illnessRecordId', 'illness_record_id')

    // ① 一次校验所有犬只
    const { data: dogs } = await db.collection('dogs')
      .where({ _id: dbCmd.in(data.dog_ids), family_id: familyId, deleted_at: null })
      .get()
    if (dogs.length !== data.dog_ids.length) throw new Error('部分犬只不存在或不属于当前家庭')
    const dogMap = new Map(dogs.map(dog => [dog._id, dog]))
    const orderedDogs = data.dog_ids.map(dogId => dogMap.get(dogId)).filter(Boolean)

    const { data: duplicateTasks } = await db.collection('medication_tasks')
      .where({
        family_id: familyId,
        dog_id: dbCmd.in(data.dog_ids),
        drug_name: data.drug_name,
        status: '进行中',
      })
      .get()
    await normalizeExpiredMedicationTasks(duplicateTasks || [])

    // ② 费用分摊
    const totalCost = data.cost || null
    const perDogCost = totalCost && dogs.length > 1
      ? Math.round(totalCost / orderedDogs.length * 100) / 100
      : totalCost

    // ③ 并行创建
    const results = await Promise.all(orderedDogs.map(async (dog, index) => {
      const linkedIllnessRecordId = illnessLinkMap.get(dog._id)
        || ((orderedDogs.length === 1 && singleIllnessRecordId) ? singleIllnessRecordId : '')

      // 覆盖模式：先取消该犬的同名进行中任务
      if (data.override_dog_ids && data.override_dog_ids.includes(dog._id)) {
        const { data: existingMeds } = await db.collection('medication_tasks')
          .where({ dog_id: dog._id, family_id: familyId, drug_name: data.drug_name, status: '进行中' })
          .get()
        await Promise.all((existingMeds || []).map(med =>
          db.collection('medication_tasks').doc(med._id).update({ status: '已取消', updated_at: now })
        ))
      }

      const medicationData = buildVersionedCreate({
        ...(clientMedicationIds[index] ? { _id: clientMedicationIds[index] } : {}),
        dog_id: dog._id,
        dog_name: dog.name,
        family_id: familyId,
        source_record_id: linkedIllnessRecordId || null,
        protocol_id: data.protocol_id || null,
        drug_name: data.drug_name,
        dosage: data.dosage || null,
        dosage_unit: data.dosage_unit || null,
        method: data.method || '口服',
        frequency: data.frequency || 1,
        duration_days: durationDays,
        start_date: startDate,
        actual_start_date: startDate,
        end_date: endDate,
        status: '进行中',
        daily_doses: {},
        notes: data.notes || null,
      }, now)
      const { id: medicationId } = await db.collection('medication_tasks').add(medicationData)
      const resolvedMedicationId = clientMedicationIds[index] || medicationId

      // 创建费用
      if (perDogCost && perDogCost > 0) {
        await db.collection('expenses').add({
          total_amount: perDogCost,
          category: '医疗',
          date: startDate,
          linked_dog_ids: [dog._id],
          dog_names: [dog.name],
          notes: `${data.drug_name} ${durationDays}天`,
          source_type: 'auto',
          source_record_id: resolvedMedicationId,
          family_id: familyId,
          created_by: uid,
          deleted_at: null,
          created_at: now,
          updated_at: now,
        })
      }

      // 疾病升级：观察中 → 治疗中
      if (linkedIllnessRecordId) {
        // 显式关联：只升级当前犬对应的疾病记录
        const { data: ill } = await db.collection('health_records')
          .where({ _id: linkedIllnessRecordId, family_id: familyId, dog_id: dog._id, type: 'illness' })
          .get()
        if (ill && ill.length > 0) {
          await db.collection('health_records').doc(linkedIllnessRecordId).update({
            'details.treatment_status': '治疗中', updated_at: now,
          })
        }
      } else if (orderedDogs.length === 1 && normalizedIllnessLinks.length === 0 && !singleIllnessRecordId) {
        // 兼容旧单犬入口：未显式绑定疾病时，仍保留单犬兜底升级逻辑
        const { data: activeIllnesses } = await db.collection('health_records')
          .where({
            family_id: familyId, dog_id: dog._id, type: 'illness',
            'details.treatment_status': '观察中', deleted_at: null,
          })
          .get()
        if (activeIllnesses && activeIllnesses.length > 0) {
          for (const r of activeIllnesses) {
            await db.collection('health_records').doc(r._id).update({
              'details.treatment_status': '治疗中', updated_at: now,
            })
          }
        }
      }

      return { medicationId: resolvedMedicationId, dog_id: dog._id, medication: { ...medicationData, _id: resolvedMedicationId } }
    }))

    await logHealthOperation({
      familyId,
      actorUserId: uid,
      actionType: 'create',
      domain: 'medication',
      targetType: 'medication_task_batch',
      targetId: `batch:${Date.now()}`,
      targetName: data.drug_name,
      summary: `批量开始了 ${results.length} 条 ${data.drug_name} 用药方案`,
      meta: { count: results.length, drugName: data.drug_name },
    })

    const response = {
      data: { count: results.length, medications: results.map(({ medicationId, dog_id }) => ({ medicationId, dog_id })) },
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: results.map(result => buildTouchedEntity('medication_tasks', result.medication)),
        resyncScopes: ['medication_tasks', 'health_records', 'expenses'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  async startMedication(data) {
    if (!data.dog_id) throw new Error('请选择犬只')
    if (!data.drug_name) throw new Error('请填写药品名称')
    const durationDays = (data.duration_days && data.duration_days >= 1) ? data.duration_days : 1

    const now = Date.now()
    const familyId = this.familyId

    // 校验犬只
    const { data: dogs } = await db.collection('dogs')
      .where({ _id: data.dog_id, family_id: familyId, deleted_at: null })
      .get()
    if (!dogs || dogs.length === 0) throw new Error('犬只不存在')
    const dog = dogs[0]

    const startDate = Number.isFinite(Number(data.actual_start_date)) ? Number(data.actual_start_date) : now
    const endDate = startDate + ((durationDays - 1) * DAY_MS)

    // 创建用药任务（单条记录，不预生成每日 task）
    const medicationData = {
      dog_id: data.dog_id,
      dog_name: dog.name,
      family_id: familyId,
      source_record_id: data.illnessRecordId || null,
      protocol_id: data.protocol_id || null,
      drug_name: data.drug_name,
      dosage: data.dosage || null,
      dosage_unit: data.dosage_unit || null,
      method: data.method || '口服',
      frequency: data.frequency || 1,
      duration_days: durationDays,
      start_date: startDate,
      actual_start_date: startDate,
      end_date: endDate,
      status: '进行中',
      daily_doses: {},
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
    }
    const { id: medicationId } = await db.collection('medication_tasks').add(medicationData)

    // 如有费用 → 创建 expense
    if (data.cost && data.cost > 0) {
      await db.collection('expenses').add({
        total_amount: data.cost,
        category: '医疗',
        date: startDate,
        linked_dog_ids: [data.dog_id],
        dog_names: [dog.name],
        notes: `${data.drug_name} ${durationDays}天`,
        source_type: 'auto',
        source_record_id: medicationId,
        family_id: familyId,
        created_by: this.uid,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      })
    }

    // 自动将该犬"观察中"的活跃疾病记录升级为"治疗中"
    if (data.illnessRecordId) {
      // 从疾病表单跳转过来：只升级指定记录，校验归属
      const { data: ill } = await db.collection('health_records')
        .where({ _id: data.illnessRecordId, family_id: familyId })
        .get()
      if (ill && ill.length > 0) {
        await db.collection('health_records').doc(data.illnessRecordId).update({
          'details.treatment_status': '治疗中',
          updated_at: now,
        })
      }
    } else {
      // 独立创建用药：查找该犬所有"观察中"的活跃疾病记录，一并升级
      const { data: activeIllnesses } = await db.collection('health_records')
        .where({
          family_id: familyId,
          dog_id: data.dog_id,
          type: 'illness',
          'details.treatment_status': '观察中',
          deleted_at: null,
        })
        .get()
      if (activeIllnesses && activeIllnesses.length > 0) {
        for (const r of activeIllnesses) {
          await db.collection('health_records').doc(r._id).update({
            'details.treatment_status': '治疗中',
            updated_at: now,
          })
        }
      }
    }

    await logHealthOperation({
      familyId,
      actorUserId: this.uid,
      actionType: 'create',
      domain: 'medication',
      targetType: 'medication_task',
      targetId: medicationId,
      targetName: dog.name || '未命名犬只',
      summary: `为 ${dog.name || '未命名犬只'} 开始了 ${data.drug_name} 用药方案`,
      meta: { drugName: data.drug_name },
    })

    return { data: { medicationId } }
  },

  /**
   * 记录一次给药（打卡模式）
   * 原子递增 daily_doses.{day}，达到 frequency 时当天完成，全部天数完成时结束用药
   */
  async recordMedicationDose(input) {
    const medicationTaskId = getIdArg(input, 'id', 'taskId', 'task_id', 'medicationTaskId', 'medication_task_id') || (typeof input === 'string' ? input : '')
    if (!medicationTaskId) throw new Error('缺少用药任务 ID')

    const familyId = this.familyId
    const now = Date.now()
    const syncMeta = getSyncMeta(input)
    if (syncMeta?.clientMutationId) {
      const existing = await findAppliedMutation(db, familyId, syncMeta.clientMutationId)
      if (existing?.response) return existing.response
    }

    const { data: meds } = await db.collection('medication_tasks')
      .where({ _id: medicationTaskId, family_id: familyId, status: '进行中' })
      .get()
    if (!meds || meds.length === 0) return { data: { completed: false, already_done: true } }

    const med = meds[0]
    const conflict = getEntityConflict(syncMeta, 'medication_tasks', med)
    if (conflict) return conflict
    const frequency = med.frequency || 1

    // 计算今天是第几天
    const startDate = startOfDay(med.actual_start_date || med.start_date || med.created_at)
    const today = startOfDay(now)
    const currentDay = Math.floor((today - startDate) / DAY_MS) + 1
    if (currentDay < 1 || currentDay > med.duration_days) {
      return { data: { completed: false, out_of_range: true } }
    }

    const dayKey = String(currentDay)

    // 原子递增当天给药次数
    await db.collection('medication_tasks').doc(medicationTaskId).update({
      [`daily_doses.${dayKey}`]: dbCmd.inc(1),
      ...buildVersionUpdate(dbCmd, now),
    })

    // 重新读取判断完成状态
    const { data: updated } = await db.collection('medication_tasks').doc(medicationTaskId).get()
    const updatedMed = updated[0] || updated
    const todayDoses = updatedMed.daily_doses?.[dayKey] || 0
    const todayComplete = todayDoses >= frequency

    // 检查是否所有天数都已完成
    let allComplete = false
    if (todayComplete) {
      allComplete = true
      for (let d = 1; d <= med.duration_days; d++) {
        if ((updatedMed.daily_doses?.[String(d)] || 0) < frequency) {
          allComplete = false
          break
        }
      }
      if (allComplete) {
        await db.collection('medication_tasks').doc(medicationTaskId).update({
          status: '已完成',
          ...buildVersionUpdate(dbCmd, now),
        })
      }
    }

    await logHealthOperation({
      familyId,
      actorUserId: this.uid,
      actionType: 'complete',
      domain: 'medication',
      targetType: 'medication_task',
      targetId: medicationTaskId,
      targetName: med.dog_name || medicationTaskId,
      summary: `记录了 ${med.dog_name || '未命名犬只'} 的 ${med.drug_name} 给药执行`,
      meta: { drugName: med.drug_name, currentDay, dosesGiven: todayDoses },
    })

    const { data: updatedMeds } = await db.collection('medication_tasks')
      .where({ _id: medicationTaskId, family_id: familyId })
      .get()
    const response = {
      data: { doses_given: todayDoses, completed: todayComplete, allComplete },
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: (updatedMeds || []).map(record => buildTouchedEntity('medication_tasks', record)),
        resyncScopes: ['medication_tasks'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 批量完成今日用药（卡片底部"完成"按钮）
   * 将指定的 medication_tasks 今天的 doses 全部补满
   */
  async batchCompleteMedicationDay(medicationTaskIds) {
    const syncMeta = getSyncMeta(medicationTaskIds)
    const normalizedTaskIds = normalizeIdList(
      Array.isArray(medicationTaskIds)
        ? medicationTaskIds
        : (medicationTaskIds?.medicationTaskIds || medicationTaskIds?.medication_task_ids || []),
    )
    if (normalizedTaskIds.length === 0) {
      throw new Error('缺少用药任务 ID')
    }

    const familyId = this.familyId
    const now = Date.now()
    if (syncMeta?.clientMutationId) {
      const existing = await findAppliedMutation(db, familyId, syncMeta.clientMutationId)
      if (existing?.response) return existing.response
    }

    const { data: meds } = await db.collection('medication_tasks')
      .where({ _id: dbCmd.in(normalizedTaskIds), family_id: familyId, status: '进行中' })
      .get()
    for (const med of meds || []) {
      const conflict = getEntityConflict(syncMeta, 'medication_tasks', med)
      if (conflict) return conflict
    }

    const patchableMeds = (meds || [])
      .map(med => ({ med, patch: buildMedicationDailyDosePatch(med, now) }))
      .filter(item => !!item.patch)

    await Promise.all(patchableMeds.map(({ med, patch }) => (
      db.collection('medication_tasks').doc(med._id).update({
        daily_doses: patch.nextDailyDoses,
        status: patch.allComplete ? '已完成' : med.status,
        ...buildVersionUpdate(dbCmd, now),
      })
    )))

    const completedMedicationTaskIds = patchableMeds.map(({ med }) => med._id).filter(Boolean)
    const fullyCompletedMedicationTaskIds = patchableMeds
      .filter(({ patch }) => patch.allComplete)
      .map(({ med }) => med._id)
      .filter(Boolean)

    await logHealthOperation({
      familyId,
      actorUserId: this.uid,
      actionType: 'complete',
      domain: 'medication',
      targetType: 'medication_task_batch',
      targetId: `batch:${Date.now()}`,
      targetName: `${completedMedicationTaskIds.length}个用药方案`,
      summary: `批量完成了 ${completedMedicationTaskIds.length} 个今日用药`,
      meta: { count: completedMedicationTaskIds.length, completedMedicationTaskIds, fullyCompletedMedicationTaskIds },
    })

    const { data: updatedMeds } = completedMedicationTaskIds.length > 0
      ? await db.collection('medication_tasks')
        .where({ _id: dbCmd.in(completedMedicationTaskIds), family_id: familyId })
        .get()
      : { data: [] }

    const response = {
      data: {
        completed: completedMedicationTaskIds.length,
        completedMedicationTaskIds,
        fullyCompletedMedicationTaskIds,
      },
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: (updatedMeds || []).map(record => buildTouchedEntity('medication_tasks', record)),
        resyncScopes: ['medication_tasks'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 标记今日用药完成（旧接口，兼容已有 daily tasks）
   */
  async completeDailyMedication(taskId) {
    if (!taskId) throw new Error('缺少任务 ID')

    const now = Date.now()

    const { data: tasks } = await db.collection('tasks')
      .where({ _id: taskId, family_id: this.familyId })
      .get()
    if (!tasks || tasks.length === 0) throw new Error('任务不存在')

    await db.collection('tasks').doc(taskId).update({
      status: 'completed',
      completed_by: this.uid,
      completed_at: now,
      updated_at: now,
    })

    // 检查是否所有用药任务都已完成
    const task = tasks[0]
    if (task.medication_task_id) {
      const { data: remaining } = await db.collection('tasks')
        .where({
          medication_task_id: task.medication_task_id,
          family_id: this.familyId,
          status: 'pending',
        })
        .get()

      if (remaining.length === 0) {
        // 全部完成 → 更新 medication_task 状态
        await db.collection('medication_tasks').doc(task.medication_task_id).update({
          status: '已完成',
          updated_at: now,
        })
      }
    }

    await logHealthOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'complete',
      domain: 'medication',
      targetType: 'task',
      targetId: taskId,
      targetName: task.title || taskId,
      summary: `完成了今日用药任务 ${task.title || ''}`.trim(),
    })

    return { message: '已标记完成' }
  },

  /**
   * 提前结束用药
   */
  async endMedication(input) {
    const medicationTaskId = getIdArg(input, 'id', 'taskId', 'task_id', 'medicationTaskId', 'medication_task_id')
    if (!medicationTaskId) throw new Error('缺少用药任务 ID')

    const now = Date.now()
    const syncMeta = getSyncMeta(input)
    if (syncMeta?.clientMutationId) {
      const existing = await findAppliedMutation(db, this.familyId, syncMeta.clientMutationId)
      if (existing?.response) return existing.response
    }
    const nextIllnessStatus = mapIllnessDispositionToStatus(input?.illnessDisposition || input?.illness_disposition)

    const { data: meds } = await db.collection('medication_tasks')
      .where({ _id: medicationTaskId, family_id: this.familyId })
      .get()
    if (!meds || meds.length === 0) throw new Error('用药任务不存在')
    if (meds[0].status !== '进行中') throw new Error('该用药已结束')
    const medicationConflict = getEntityConflict(syncMeta, 'medication_tasks', meds[0])
    if (medicationConflict) return medicationConflict

    // 更新用药状态
    await db.collection('medication_tasks').doc(medicationTaskId).update({
      status: '已取消',
      ...buildVersionUpdate(dbCmd, now),
    })

    // 兼容旧数据：取消关联的 daily tasks（新记录没有，旧记录可能有）
    await db.collection('tasks').where({
      medication_task_id: medicationTaskId,
      status: 'pending',
    }).update({
      status: 'cancelled',
      ...buildVersionUpdate(dbCmd, now),
    })

    let linkedIllnessId = null
    if (meds[0].source_record_id && nextIllnessStatus) {
      const { data: linkedIllnesses } = await db.collection('health_records')
        .where({
          _id: meds[0].source_record_id,
          family_id: this.familyId,
          type: 'illness',
          deleted_at: null,
        })
        .limit(1)
        .get()

      const linkedIllness = linkedIllnesses?.[0]
      if (linkedIllness && (linkedIllness.details?.treatment_status || '观察中') !== '已康复') {
        const illnessConflict = getEntityConflict(syncMeta, 'health_records', linkedIllness)
        if (illnessConflict) return illnessConflict
        linkedIllnessId = linkedIllness._id
        await db.collection('health_records').doc(linkedIllness._id).update({
          'details.treatment_status': nextIllnessStatus,
          ...buildVersionUpdate(dbCmd, now),
        })
      }
    }

    await logHealthOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'status_change',
      domain: 'medication',
      targetType: 'medication_task',
      targetId: medicationTaskId,
      targetName: meds[0].dog_name || medicationTaskId,
      summary: `提前结束了 ${meds[0].dog_name || '未命名犬只'} 的 ${meds[0].drug_name} 用药方案`,
      meta: { drugName: meds[0].drug_name },
    })

    const [updatedMeds, updatedTasks, updatedIllnesses] = await Promise.all([
      db.collection('medication_tasks').where({ _id: medicationTaskId, family_id: this.familyId }).get(),
      db.collection('tasks').where({ medication_task_id: medicationTaskId, family_id: this.familyId }).get(),
      linkedIllnessId
        ? db.collection('health_records').where({ _id: linkedIllnessId, family_id: this.familyId }).get()
        : Promise.resolve({ data: [] }),
    ])
    const response = {
      message: '用药已提前结束',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: [
          ...(updatedMeds.data || []).map(record => buildTouchedEntity('medication_tasks', record)),
          ...(updatedTasks.data || []).map(record => buildTouchedEntity('tasks', record)),
          ...(updatedIllnesses.data || []).map(record => buildTouchedEntity('health_records', record)),
        ],
        resyncScopes: ['medication_tasks', 'tasks', 'health_records'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 按犬只停止所有进行中的用药（从首页健康关注卡调用）
   */
  async endMedicationByDog(input) {
    const dogId = getIdArg(input, 'dogId', 'dog_id', 'id') || (typeof input === 'string' ? input : '')
    if (!dogId) throw new Error('缺少犬只 ID')

    const now = Date.now()
    const familyId = this.familyId
    const syncMeta = getSyncMeta(input)
    if (syncMeta?.clientMutationId) {
      const existing = await findAppliedMutation(db, familyId, syncMeta.clientMutationId)
      if (existing?.response) return existing.response
    }

    // 找到该犬所有进行中的用药方案
    const { data: meds } = await db.collection('medication_tasks')
      .where({ dog_id: dogId, family_id: familyId, status: '进行中' })
      .get()
    for (const med of meds || []) {
      const conflict = getEntityConflict(syncMeta, 'medication_tasks', med)
      if (conflict) return conflict
    }

    const cancelledMedicationTaskIds = (meds || []).map(med => med._id).filter(Boolean)
    if (cancelledMedicationTaskIds.length > 0) {
      await db.collection('medication_tasks').where({
        _id: dbCmd.in(cancelledMedicationTaskIds),
        family_id: familyId,
        status: '进行中',
      }).update({
        status: '已取消',
        ...buildVersionUpdate(dbCmd, now),
      })

      // 兼容旧数据：取消关联的 daily tasks
      await db.collection('tasks').where({
        medication_task_id: dbCmd.in(cancelledMedicationTaskIds),
        status: 'pending',
      }).update({
        status: 'cancelled',
        updated_at: now,
      })
    }

    const { data: updatedMeds } = cancelledMedicationTaskIds.length > 0
      ? await db.collection('medication_tasks')
        .where({ _id: dbCmd.in(cancelledMedicationTaskIds), family_id: familyId })
        .get()
      : { data: [] }
    const response = {
      message: `已停止 ${cancelledMedicationTaskIds.length} 个用药方案`,
      data: { cancelled: cancelledMedicationTaskIds.length, cancelledMedicationTaskIds },
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: (updatedMeds || []).map(record => buildTouchedEntity('medication_tasks', record)),
        resyncScopes: ['medication_tasks'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 获取单个用药任务详情
   */
  async getMedicationTaskDetail(input) {
    const medicationTaskId = getIdArg(input, 'id', 'taskId', 'task_id', 'medicationTaskId', 'medication_task_id')
    if (!medicationTaskId) throw new Error('缺少用药任务 ID')

    const { data: meds } = await db.collection('medication_tasks')
      .where({ _id: medicationTaskId, family_id: this.familyId })
      .get()
    if (!meds || meds.length === 0) throw new Error('用药任务不存在')

    const task = meds[0]
    let protocolName = null

    if (task.protocol_id) {
      const { data: protocols } = await db.collection('medication_protocols')
        .where({ _id: task.protocol_id, family_id: this.familyId, deleted_at: null })
        .limit(1)
        .get()
      protocolName = protocols?.[0]?.name || null
    }

    const normalizedTask = normalizeMedicationTaskDetail(task, protocolName)
    let linkedIllness = null
    let relationType = normalizedTask.source_record_id ? 'linked' : 'standalone'

    if (normalizedTask.source_record_id) {
      const { data: illnessRecords } = await db.collection('health_records')
        .where({
          _id: normalizedTask.source_record_id,
          family_id: this.familyId,
          type: 'illness',
          deleted_at: null,
        })
        .limit(1)
        .get()
      linkedIllness = buildLinkedIllnessSummary(illnessRecords?.[0])
    } else if (task.dog_id) {
      const { data: activeIllnesses } = await db.collection('health_records')
        .where({
          family_id: this.familyId,
          dog_id: task.dog_id,
          type: 'illness',
          deleted_at: null,
        })
        .get()
      const latestFallbackIllness = sortRecordsByActivityDesc((activeIllnesses || []).filter(isActiveIllnessRecord))[0]
      if (latestFallbackIllness) relationType = 'fallback'
    }

    return {
      data: {
        ...normalizedTask,
        linkedIllness,
        relationType,
      },
    }
  },

  /**
   * 获取用药方案列表
   */
  async getMedicationProtocols() {
    const { data: protocols } = await db.collection('medication_protocols')
      .where({ family_id: this.familyId, deleted_at: null })
      .orderBy('created_at', 'desc')
      .get()

    return { data: protocols }
  },

  /**
   * 新增用药方案
   */
  async addMedicationProtocol(data) {
    if (!data.name) throw new Error('请填写方案名称')
    if (!data.drug_name) throw new Error('请填写药品名称')

    const now = Date.now()
    const syncMeta = getSyncMeta(data)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response
    const clientProtocolId = typeof syncMeta?.clientEntityIds?.medication_protocols === 'string'
      ? syncMeta.clientEntityIds.medication_protocols
      : null

    const protocol = buildVersionedCreate({
      ...(clientProtocolId ? { _id: clientProtocolId } : {}),
      name: data.name,
      drug_name: data.drug_name,
      dosage: data.dosage || null,
      dosage_unit: data.dosage_unit || null,
      method: data.method || null,
      frequency: data.frequency || null,
      duration_days: data.duration_days || null,
      notes: data.notes || null,
      family_id: this.familyId,
      created_by: this.uid,
      deleted_at: null,
    }, now)
    const { id } = await db.collection('medication_protocols').add(protocol)
    const protocolId = clientProtocolId || id

    await logHealthOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'create',
      domain: 'medication',
      targetType: 'medication_protocol',
      targetId: protocolId,
      targetName: data.name,
      summary: `新增了用药方案 ${data.name}`,
      meta: { drugName: data.drug_name },
    })

    const response = {
      data: { protocolId },
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: [buildTouchedEntity('medication_protocols', { ...protocol, _id: protocolId })],
        resyncScopes: ['medication_protocols'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 软删除用药方案
   */
  async removeMedicationProtocol(input) {
    const id = getIdArg(input, 'id', 'protocolId', 'protocol_id')
    if (!id) throw new Error('缺少方案 ID')
    const syncMeta = getSyncMeta(input)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response

    const { data: protocols } = await db.collection('medication_protocols')
      .where({ _id: id, family_id: this.familyId })
      .get()
    if (!protocols || protocols.length === 0) throw new Error('方案不存在')
    const protocol = protocols[0]
    const conflict = getEntityConflict(syncMeta, 'medication_protocols', protocol)
    if (conflict) return conflict
    const now = Date.now()

    await db.collection('medication_protocols').doc(id).update({
      deleted_at: now,
      ...buildVersionUpdate(dbCmd, now),
    })

    await logHealthOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'delete',
      domain: 'medication',
      targetType: 'medication_protocol',
      targetId: id,
      targetName: protocol.name || id,
      summary: `删除了用药方案 ${protocol.name || id}`,
    })

    const response = {
      message: '已删除',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: [buildTouchedEntity('medication_protocols', {
          ...protocol,
          deleted_at: now,
          updated_at: now,
          version: Number(protocol.version || 0) + 1,
        })],
        resyncScopes: ['medication_protocols'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 批量录入幼犬体重
   */
  async batchAddWeights(litterId, weights) {
    if (!litterId) throw new Error('缺少窝次 ID')
    if (!weights || !Array.isArray(weights) || weights.length === 0) throw new Error('请提供体重数据')

    const now = Date.now()
    const familyId = this.familyId

    // 校验窝次归属当前家庭
    const { data: litters } = await db.collection('litters')
      .where({ _id: litterId, family_id: familyId })
      .get()
    if (!litters || litters.length === 0) throw new Error('窝次不存在')

    // 校验所有 dog_id 归属当前家庭
    const dogIds = [...new Set(weights.map(w => w.dog_id))]
    const { data: dogs } = await db.collection('dogs')
      .where({ family_id: familyId, deleted_at: null })
      .get()
    const familyDogIds = new Set(dogs.map(d => d._id))
    for (const dogId of dogIds) {
      if (!familyDogIds.has(dogId)) throw new Error('犬只不属于当前家庭')
    }

    for (const entry of weights) {
      await db.collection('dog_weights').add({
        dog_id: entry.dog_id,
        litter_id: litterId,
        weight: Number(entry.weight),
        date: entry.date,
        family_id: familyId,
        created_by: this.uid,
        created_at: now,
        updated_at: now,
      })
    }

    // 同步刷新最新体重，保持与单犬录入口径一致
    for (const dogId of dogIds) {
      const { data: latest } = await db.collection('dog_weights')
        .where({ dog_id: dogId, family_id: familyId })
        .orderBy('date', 'desc')
        .orderBy('created_at', 'desc')
        .limit(1)
        .get()

      if (latest?.[0]?.weight) {
        await db.collection('dogs').doc(dogId).update({
          latest_weight: latest[0].weight,
          updated_at: now,
        })
      }
    }

    await logHealthOperation({
      familyId,
      actorUserId: this.uid,
      actionType: 'create',
      targetType: 'dog_weight_batch',
      targetId: litterId,
      targetName: `${weights.length}条体重记录`,
      summary: `批量录入了 ${weights.length} 条幼崽体重`,
      meta: { litterId, count: weights.length },
    })

    return { data: { count: weights.length } }
  },

  /**
   * 获取健康记录详情
   */
  async getHealthRecordDetail(input) {
    const id = getIdArg(input, 'id', 'recordId', 'record_id')
    if (!id) throw new Error('缺少记录 ID')

    const { data: records } = await db.collection('health_records')
      .where({ _id: id, family_id: this.familyId })
      .get()
    if (!records || records.length === 0) throw new Error('记录不存在')

    const record = records[0]

    // 兼容历史疾病记录未冗余 dog_name 的情况，详情页按 dog_id 补犬名
    if (!record.dog_name && record.dog_id) {
      const { data: dogs } = await db.collection('dogs')
        .where({ _id: record.dog_id, family_id: this.familyId })
        .field({ name: true })
        .get()
      if (dogs && dogs.length > 0) {
        record.dog_name = dogs[0].name || ''
      }
    }

    if (record.type === 'illness') {
      record.details = normalizeIllnessDetails(record.details || {})
      const { data: tasks } = await db.collection('medication_tasks')
        .where({ family_id: this.familyId, source_record_id: id })
        .get()
      const normalizedTasks = await normalizeExpiredMedicationTasks(tasks || [])
      record.linkedMedicationTasks = sortMedicationHistory(normalizedTasks).map(buildLinkedMedicationTaskSummary).filter(Boolean)
    }

    return record
  },

  /**
   * 更新健康记录
   */
  async updateHealthRecord(input = {}) {
    const { id, date, cost, notes, details } = input
    if (!id) throw new Error('缺少记录 ID')
    const syncMeta = getSyncMeta(input)
    if (syncMeta?.clientMutationId) {
      const existing = await findAppliedMutation(db, this.familyId, syncMeta.clientMutationId)
      if (existing?.response) return existing.response
    }

    const { data: records } = await db.collection('health_records')
      .where({ _id: id, family_id: this.familyId })
      .get()
    if (!records || records.length === 0) throw new Error('记录不存在')
    const record = records[0]
    const conflict = getEntityConflict(syncMeta, 'health_records', record)
    if (conflict) return conflict

    const normalizedDetails = record.type === 'illness' && details !== undefined
      ? normalizeIllnessDetails(details)
      : details

    if (record.type === 'illness' && normalizedDetails !== undefined) {
      const nextCondition = getIllnessPrimaryCondition(normalizedDetails) || getIllnessPrimaryCondition(record)
      const nextTreatmentStatus = normalizedDetails?.treatment_status || record.details?.treatment_status || '观察中'
      if (nextCondition && nextTreatmentStatus !== '已康复') {
        await assertNoDuplicateActiveIllness(this.familyId, {
          dogIds: [record.dog_id],
          condition: nextCondition,
          excludeRecordId: id,
        })
      }
    }

    const now = Date.now()
    const updateData = { ...buildVersionUpdate(dbCmd, now) }
    if (date !== undefined) updateData.date = date
    if (cost !== undefined) updateData.cost = cost
    if (notes !== undefined) updateData.notes = notes
    if (normalizedDetails !== undefined) updateData.details = normalizedDetails

    await db.collection('health_records').doc(id).update(updateData)

    await logHealthOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'update',
      targetType: 'health_record',
      targetId: id,
      targetName: record.dog_name || record.dog_id || id,
      summary: `更新了 ${record.dog_name || '未命名犬只'} 的${HEALTH_RECORD_LABEL_MAP[record.type] || '健康记录'}`,
      meta: { type: record.type },
    })

    const { data: updatedRecords } = await db.collection('health_records')
      .where({ _id: id, family_id: this.familyId })
      .get()
    const response = {
      message: '已更新',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: (updatedRecords || []).map(item => buildTouchedEntity('health_records', item)),
        resyncScopes: ['health_records'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 删除健康记录，并取消关联提醒任务
   */
  async deleteHealthRecord(input = {}) {
    const id = getIdArg(input, 'id', 'recordId', 'record_id')
    if (!id) throw new Error('缺少记录 ID')
    const syncMeta = getSyncMeta(input)
    if (syncMeta?.clientMutationId) {
      const existing = await findAppliedMutation(db, this.familyId, syncMeta.clientMutationId)
      if (existing?.response) return existing.response
    }

    const { data: records } = await db.collection('health_records')
      .where({ _id: id, family_id: this.familyId })
      .get()
    if (!records || records.length === 0 || records[0].deleted_at) throw new Error('记录不存在')
    const record = records[0]
    const conflict = getEntityConflict(syncMeta, 'health_records', record)
    if (conflict) return conflict

    const { data: linkedReminderTasks } = await db.collection('tasks')
      .where({
        family_id: this.familyId,
        source_record_id: id,
        status: 'pending',
        deleted_at: null,
      })
      .get()
    if (syncMeta?.clientMutationId) {
      for (const task of (linkedReminderTasks || [])) {
        const taskConflict = getEntityConflict(syncMeta, 'tasks', task)
        if (taskConflict) return taskConflict
      }
    }

    const now = Date.now()
    await db.collection('health_records').doc(id).update({
      deleted_at: now,
      ...buildVersionUpdate(dbCmd, now),
    })

    if (linkedReminderTasks && linkedReminderTasks.length > 0) {
      await db.collection('tasks').where({
        _id: dbCmd.in(linkedReminderTasks.map(task => task._id)),
        family_id: this.familyId,
      }).update({
        status: 'cancelled',
        ...buildVersionUpdate(dbCmd, now),
      })
    }

    await logHealthOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'delete',
      targetType: 'health_record',
      targetId: id,
      targetName: record.dog_name || record.dog_id || id,
      summary: `删除了 ${record.dog_name || '未命名犬只'} 的${HEALTH_RECORD_LABEL_MAP[record.type] || '健康记录'}`,
      meta: { type: record.type },
    })

    const [updatedRecordRes, updatedTasksRes] = await Promise.all([
      db.collection('health_records').where({ _id: id, family_id: this.familyId }).get(),
      linkedReminderTasks && linkedReminderTasks.length > 0
        ? db.collection('tasks').where({
            _id: dbCmd.in(linkedReminderTasks.map(task => task._id)),
            family_id: this.familyId,
          }).get()
        : Promise.resolve({ data: [] }),
    ])

    const response = {
      message: '已删除',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: [
          ...(updatedRecordRes.data || []).map(item => buildTouchedEntity('health_records', item)),
          ...((updatedTasksRes.data || []).map(item => buildTouchedEntity('tasks', item))),
        ],
        resyncScopes: ['health_records', 'tasks'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 获取某犬的体重历史
   */
  /**
   * 单犬体重录入
   */
  async addWeightRecord(input = {}) {
    const dog_id = input.dog_id || input.dogId
    const weight = input.weight
    const date = input.date
    const notes = input.notes
    if (!dog_id) throw new Error('缺少犬只 ID')
    if (!weight || Number(weight) <= 0) throw new Error('请输入有效体重')

    const now = Date.now()
    const familyId = this.familyId
    const syncMeta = getSyncMeta(input)
    const appliedMutation = await findAppliedMutation(db, familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response

    const { data: dogs } = await db.collection('dogs')
      .where({ _id: dog_id, family_id: familyId, deleted_at: null })
      .get()
    if (!dogs || dogs.length === 0) throw new Error('犬只不存在')
    const dogConflict = getEntityConflict(syncMeta, 'dogs', dogs[0])
    if (dogConflict) return dogConflict

    const clientWeightId = typeof syncMeta?.clientEntityIds?.dog_weights === 'string'
      ? syncMeta.clientEntityIds.dog_weights
      : null
    const weightRecord = buildVersionedCreate({
      ...(clientWeightId ? { _id: clientWeightId } : {}),
      dog_id,
      weight: Number(weight),
      date: date || now,
      notes: notes || null,
      family_id: familyId,
      created_by: this.uid,
      deleted_at: null,
    }, now)
    const { id } = await db.collection('dog_weights').add(weightRecord)
    const resolvedWeightId = clientWeightId || id

    // 更新犬只 latest_weight（取最新日期的记录）
    const { data: latest } = await db.collection('dog_weights')
      .where({ dog_id, family_id: familyId })
      .orderBy('date', 'desc')
      .orderBy('created_at', 'desc')
      .limit(1)
      .get()
    if (latest?.[0]?.weight) {
      await db.collection('dogs').doc(dog_id).update({ latest_weight: latest[0].weight, ...buildVersionUpdate(dbCmd, now) })
    }

    await logHealthOperation({
      familyId,
      actorUserId: this.uid,
      actionType: 'create',
      targetType: 'dog_weight',
      targetId: dog_id,
      targetName: dogs[0].name || dog_id,
      summary: `为 ${dogs[0].name || '未命名犬只'} 新增了体重记录`,
      meta: { weight: Number(weight), date: date || now },
    })

    const { data: updatedDogs } = await db.collection('dogs')
      .where({ _id: dog_id, family_id: familyId })
      .limit(1)
      .get()
    const response = {
      message: '已保存',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: [
          buildTouchedEntity('dog_weights', { ...weightRecord, _id: resolvedWeightId }),
          ...(updatedDogs?.[0] ? [buildTouchedEntity('dogs', updatedDogs[0])] : []),
        ],
        resyncScopes: ['dog_weights', 'dogs'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  async getWeightHistory(dogId) {
    if (!dogId) throw new Error('缺少犬只 ID')

    const { data: records } = await db.collection('dog_weights')
      .where({ dog_id: dogId, family_id: this.familyId })
      .orderBy('date', 'desc')
      .orderBy('created_at', 'desc')
      .get()

    return { data: records }
  },
}
