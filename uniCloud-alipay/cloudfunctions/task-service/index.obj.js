/**
 * 任务云对象
 * 管理首页卡片生成、任务完成/推迟、每日审计
 */
const { verifyAndGetFamily, requireFamily } = require('breed-auth/auth')

const db = uniCloud.database()
const dbCmd = db.command

// 一天的毫秒数
const DAY_MS = 86400000
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
  const date = new Date(ts)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
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
    return `illness:${task.details?.condition || ''}`
  }
  return task.type || ''
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
    return task.details?.condition || task.title || '疾病'
  }
  return task.title || task.type || ''
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
    cards: [...workflow, ...extra_arrangements, ...reminders, ...therapy],
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

async function createAutoHealthRecord({ familyId, uid, task, now }) {
  if (!task || !['vaccination', 'deworming'].includes(task.type)) return false

  const details = {}
  if (task.type === 'vaccination') details.vaccine_type = task.details?.vaccine_type || null
  if (task.type === 'deworming') {
    details.deworming_type = task.details?.deworming_type || null
    details.drug_name = task.details?.drug_name || null
  }

  const recordData = {
    family_id: familyId,
    dog_id: task.dog_id,
    dog_name: task.dog_name,
    type: task.type,
    date: now,
    details,
    source: 'auto_complete',
    created_by: uid,
    created_at: now,
    updated_at: now,
  }
  await db.collection('health_records').add(recordData)
  return true
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
  const target = new Date(targetDate); target.setHours(0, 0, 0, 0)
  return activeMedications.map(med => {
    const start = new Date(med.actual_start_date); start.setHours(0, 0, 0, 0)
    const currentDay = Math.floor((target.getTime() - start.getTime()) / DAY_MS) + 1
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

function mergeTasks(tasks, todayCompleted = [], activeIllnesses = [], medItems = []) {
  const cards = []
  const consumed = new Set()
  const completedConsumed = new Set()

  for (const task of [...tasks, ...todayCompleted]) {
    task.display_title = getTaskDisplayTitle(task)
  }

  // 第 1 轮：健康关注卡（生病犬只 + 用药犬只合并）
  // 兼容旧数据：仍过滤 tasks 中的 medication 类型（旧记录），与 medItems（新记录）合并
  const oldMedTasks = tasks.filter(t => t.type === 'medication')
  oldMedTasks.forEach(t => consumed.add(t._id))
  const mergedMedItems = [...medItems, ...oldMedTasks.map(toLegacyMedItem)]

  // 1a: 先按犬归档疾病记录，后续按“观察/治疗”拆分到不同区块
  const illnessesByDog = new Map()

  for (const ill of activeIllnesses) {
    const status = ill.details?.treatment_status || '观察中'
    const dogId = ill.dog_id
    const cond = ill.details?.condition || '生病'
    const illStart = new Date(ill.date || ill.created_at); illStart.setHours(0, 0, 0, 0)
    const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0)
    const daysSick = Math.max(1, Math.round((todayMid.getTime() - illStart.getTime()) / DAY_MS) + 1)

    if (!illnessesByDog.has(dogId)) {
      illnessesByDog.set(dogId, [])
    }
    illnessesByDog.get(dogId).push({
      dogId,
      dogName: ill.dog_name || ill._dog_name || '',
      illness: cond,
      severity: ill.details?.severity || '轻微',
      illnessId: ill._id,
      daysSick,
      treatmentStatus: status,
      _createdAt: ill.date || ill.created_at || 0,
    })
  }

  // 1b: 从 medication_tasks 计算用药卡片数据（新模型）
  const unitMap = { ml: 'ml', mg: 'mg', tablet: '片' }
  const hasPendingMed = mergedMedItems.some(m => !m.isDoneToday)
  const medByDog = new Map()
  const medDogIds = new Set()

  for (const m of mergedMedItems) {
    if (!medByDog.has(m.dog_id)) medByDog.set(m.dog_id, [])
    medByDog.get(m.dog_id).push(m)
    medDogIds.add(m.dog_id)
  }

  // 疾病观察卡按疾病实例输出；同一只犬若还有其他观察中疾病，允许继续留在健康区
  const sickObserveDogs = activeIllnesses
    .map((ill) => {
      const status = ill.details?.treatment_status || '观察中'
      if (status === '治疗中' && medDogIds.has(ill.dog_id)) return null

      const illStart = new Date(ill.date || ill.created_at); illStart.setHours(0, 0, 0, 0)
      const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0)
      const daysSick = Math.max(1, Math.round((todayMid.getTime() - illStart.getTime()) / DAY_MS) + 1)

      return {
        dogId: ill.dog_id,
        dogName: ill.dog_name || ill._dog_name || '',
        state: 'sick_only',
        illness: ill.details?.condition || '生病',
        severity: ill.details?.severity || '轻微',
        illnessId: ill._id,
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
      const medicatedIllnesses = dogIllnesses.filter(ill => ill.treatmentStatus === '治疗中')
      const medicatedIllnessNames = [...new Set(medicatedIllnesses.map(ill => ill.illness).filter(Boolean))]

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

      dogMap.set(dogId, {
        dogId,
        dogName: primary.dog_name || '',
        state: isSickWithMed ? 'sick_with_med' : 'med_only',
        illness: medicatedIllnessNames[0] || '',
        illnessNames,
        illnessId: primaryIllnessId,
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
    const dayKey = new Date(t.due_date).toDateString()
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

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    // 并行查询：首页到期任务 + 主流程任务（允许未来） + 今日已完成 + 当前生病犬只 + 进行中的用药
    const [pendingRes, workflowRes, completedRes, illnessRes, medRes] = await Promise.all([
      db.collection('tasks')
        .where({ family_id: familyId, status: 'pending', due_date: dbCmd.lte(todayEnd.getTime()) })
        .orderBy('due_date', 'asc').limit(200).get(),
      db.collection('tasks')
        .where({ family_id: familyId, status: 'pending', type: 'breeding_milestone' })
        .orderBy('due_date', 'asc').limit(200).get(),
      db.collection('tasks')
        .where({ family_id: familyId, status: 'completed', completed_at: dbCmd.gte(todayStart.getTime()).and(dbCmd.lte(todayEnd.getTime())) })
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

    for (const task of pendingTasks) {
      if (task.due_date < todayStart.getTime()) {
        task.priority = 'overdue'
      } else if (task.due_date <= todayEnd.getTime()) {
        task.priority = 'today'
      } else {
        task.priority = 'upcoming'
      }
      task._completed = false
    }
    for (const task of todayCompletedTasks) {
      task.priority = 'today'
      task._completed = true
    }

    const medItems = computeMedItemsForDay(activeMedications, Date.now())
    const sectioned = buildSectionedCards(pendingTasks, todayCompletedTasks, activeIllnesses, medItems)
    const allCards = sectioned.cards

    // 计算 本周 和 30天 的 pending 任务数
    const sundayEnd = new Date(todayStart)
    const dayOfWeek = sundayEnd.getDay() // 0=日
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
    sundayEnd.setDate(sundayEnd.getDate() + daysToSunday)
    sundayEnd.setHours(23, 59, 59, 999)

    const day30End = new Date(todayStart)
    day30End.setDate(day30End.getDate() + 30)
          day30End.setHours(23, 59, 59, 999)

    // 并行查询 本周 和 30天 的 pending count
    const [weekRes, month30Res] = await Promise.all([
      db.collection('tasks')
        .where({ family_id: familyId, status: 'pending', due_date: dbCmd.lte(sundayEnd.getTime()) })
        .count(),
      db.collection('tasks')
        .where({ family_id: familyId, status: 'pending', due_date: dbCmd.lte(day30End.getTime()) })
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
        .field({ due_date: true })
        .get(),
      db.collection('medication_tasks')
        .where({ family_id: familyId, status: '进行中' })
        .get(),
    ])

    // 按天聚合
    const counts = {}
    for (const task of tasks) {
      const d = new Date(task.due_date)
      d.setHours(0, 0, 0, 0)
      const key = d.getTime()
      counts[key] = (counts[key] || 0) + 1
    }

    // 疗程状态也会出现在未来日期页：只要当天有用药卡，就给该天一个红点计数
    const seenMedicationDays = new Set()
    for (let d = new Date(startDate); d.getTime() <= endDate; d.setDate(d.getDate() + 1)) {
      const dayTs = new Date(d); dayTs.setHours(0, 0, 0, 0)
      const key = dayTs.getTime()
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

    const tasks = taskRes.data
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
    const realTodayStart = new Date()
    realTodayStart.setHours(0, 0, 0, 0)
    const dayGroups = new Map()
    for (const task of tasks) {
      const d = new Date(task.due_date)
      d.setHours(0, 0, 0, 0)
      const key = d.getTime()
      if (!dayGroups.has(key)) dayGroups.set(key, [])
      task.priority = task.due_date < realTodayStart.getTime() ? 'overdue' : 'today'
      task._completed = false
      dayGroups.get(key).push(task)
    }

    // 每天独立合并为卡片
    const todayMs = realTodayStart.getTime()
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
    for (let d = new Date(startDate); d.getTime() <= endDate; d.setDate(d.getDate() + 1)) {
      const dayTs = new Date(d); dayTs.setHours(0, 0, 0, 0)
      const key = dayTs.getTime()
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
  async batchCompleteTask(taskIds, autoRecord) {
    if (!taskIds || !taskIds.length) throw new Error('缺少任务 ID')

    const now = Date.now()
    let completed = 0

    for (const taskId of taskIds) {
      try {
        const { data: tasks } = await db.collection('tasks')
          .where({ _id: taskId, family_id: this.familyId })
          .get()
        if (!tasks || tasks.length === 0) continue

        const task = tasks[0]

        await db.collection('tasks').doc(taskId).update({
          status: 'completed',
          completed_by: this.uid,
          completed_at: now,
          updated_at: now,
        })

        if (autoRecord) {
          try {
            await createAutoHealthRecord({
              familyId: this.familyId,
              uid: this.uid,
              task,
              now,
            })
          } catch (e) {
            console.log('[batchCompleteTask] auto-record failed:', e.message)
          }
        }
        completed++
      } catch (e) {
        // 跳过不存在或已处理的任务
      }
    }

    return { data: { completed } }
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
      return { data: { doses_given: dosesSoFar, completed: true } }
    }

    return { data: { doses_given: dosesSoFar, completed: false } }
  },

  /**
   * 完成任务
   * autoRecord=true 时（健康类），自动创建 health_record，但不再无声续链
   */
  async completeTask(taskId, autoRecord) {
    if (!taskId) throw new Error('缺少任务 ID')

    const now = Date.now()
    const familyId = this.familyId

    const { data: tasks } = await db.collection('tasks')
      .where({ _id: taskId, family_id: familyId })
      .get()
    if (!tasks || tasks.length === 0) throw new Error('任务不存在')
    // 幂等
    if (tasks[0].status !== 'pending') return { message: '已完成' }

    const task = tasks[0]

    await db.collection('tasks').doc(taskId).update({
      status: 'completed',
      completed_by: this.uid,
      completed_at: now,
      updated_at: now,
    })

    // 健康类一键完成：自动创建记录，不再自动生成下次提醒
    const HEALTH_TYPES = ['vaccination', 'deworming']
    if (autoRecord && HEALTH_TYPES.includes(task.type)) {
      try {
        await createAutoHealthRecord({ familyId, uid: this.uid, task, now })
      } catch (e) {
        console.log('[completeTask] auto-record failed:', e.message)
        // 不影响任务完成，静默失败
      }
    }

    return { message: '已完成', autoRecorded: autoRecord && HEALTH_TYPES.includes(task.type) }
  },

  /**
   * 推迟任务
   */
  async postponeTask(taskId, newDate, reason) {
    if (!taskId) throw new Error('缺少任务 ID')
    if (!newDate) throw new Error('请选择新日期')

    const now = Date.now()

    const { data: tasks } = await db.collection('tasks')
      .where({ _id: taskId, family_id: this.familyId })
      .get()
    if (!tasks || tasks.length === 0) throw new Error('任务不存在')
    if (tasks[0].status !== 'pending') throw new Error('任务已处理')

    await db.collection('tasks').doc(taskId).update({
      due_date: newDate,
      postpone_count: dbCmd.inc(1),
      postpone_reason: reason || null,
      updated_at: now,
    })

    return { message: '已推迟' }
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

    const results = await Promise.all(dogsToCreate.map(async (dog) => {
      const taskTitle = data.title
        || (data.type === 'vaccination' ? (data.details?.vaccine_type ? `疫苗 · ${data.details.vaccine_type}` : '疫苗') : '')
        || (data.type === 'deworming'
          ? (data.details?.drug_name ? `驱虫 · ${data.details.drug_name}` : '驱虫')
          : '')
        || data.type
      const taskData = {
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
        created_at: now,
        updated_at: now,
      }
      const { id } = await db.collection('tasks').add(taskData)
      return { taskId: id, dog_id: dog.dog_id }
    }))

    return {
      data: {
        created: results.length,
        skipped: data.dogs.length - results.length,
        message: results.length > 0 ? '已创建待办' : '已有相同待办',
      }
    }
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
   * 晨间摘要推送（定时任务，每日 07:00）
   * 统计今日待办和逾期任务，通过 UniPush 推送给所有活跃成员
   */
  async _timing_morningSummary() {
    const now = Date.now()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const { data: families } = await db.collection('families').get()
    let pushCount = 0

    for (const family of families) {
      const familyId = family._id

      // 统计逾期 + 今日任务
      const [overdueRes, todayRes] = await Promise.all([
        db.collection('tasks').where({
          family_id: familyId,
          status: 'pending',
          due_date: dbCmd.lt(todayStart.getTime()),
        }).count(),
        db.collection('tasks').where({
          family_id: familyId,
          status: 'pending',
          due_date: dbCmd.gte(todayStart.getTime()).and(dbCmd.lte(todayEnd.getTime())),
        }).count(),
      ])

      const overdueCount = overdueRes.total || 0
      const todayCount = todayRes.total || 0

      if (overdueCount === 0 && todayCount === 0) continue

      // 构建推送内容
      const parts = []
      if (overdueCount > 0) parts.push(`${overdueCount}件逾期需处理`)
      if (todayCount > 0) parts.push(`${todayCount}件今日待办`)
      const content = `今日待办(${overdueCount + todayCount}件)：${parts.join(' · ')}`

      // UniPush 推送（需要在 manifest.json 配置 UniPush 2.0）
      // V1 先记录推送内容，实际推送需要配置厂商通道后启用
      // TODO: 配置 UniPush 后取消注释
      // const activeMembers = family.members.filter(m => m.status === 'active')
      // for (const member of activeMembers) {
      //   await uniCloud.sendSms({ ... }) 或 uni-push
      // }

      pushCount++
    }

    return { data: { pushCount } }
  },

}

// 测试用导出（仅在测试环境使用）
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  module.exports._mergeTasks = mergeTasks
}
