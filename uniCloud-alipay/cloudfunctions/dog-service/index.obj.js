/**
 * 犬只档案云对象
 * 负责犬只 CRUD、状态派生、disposition 变更
 */
const { verifyAndGetFamily, requireFamily, requireAdmin } = require('breed-auth/auth')
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

const LIST_STATUS_PRIORITY = {
  '生病中': 0,
  '用药中': 1,
  '怀孕中': 2,
  '哺乳中': 3,
  '发情中': 4,
  '正常': 5,
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

const DETAIL_STATUS_PRIORITY = {
  '生病中': 0,
  '用药中': 1,
  '怀孕中': 2,
  '哺乳中': 3,
  '发情中': 4,
}

const MEDICATION_DOSAGE_UNIT_MAP = {
  ml: 'ml',
  mg: 'mg',
  tablet: '片',
}

function formatDateYMD(ts) {
  if (typeof ts !== 'number') return ''
  const date = new Date(ts)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function buildLitterPupStats(litter, puppies = []) {
  const totalBorn = Number(litter?.total_born)
  const bornAlive = Number(litter?.born_alive)
  const total = Number.isFinite(totalBorn) && totalBorn > 0 ? totalBorn : puppies.length
  const alive = Number.isFinite(bornAlive) && bornAlive >= 0
    ? bornAlive
    : puppies.filter(p => p.disposition !== '已故').length

  return {
    total,
    alive,
    kept: puppies.filter(p => p.disposition === '自留' || p.disposition === '在养').length,
    sold: puppies.filter(p => ['已售', '已预定'].includes(p.disposition)).length,
    available: puppies.filter(p => p.disposition === '待售').length,
  }
}

function formatMedicationFrequency(frequency) {
  const count = Number(frequency) || 1
  return `每日${count}次`
}

async function logDogOperation({ familyId, actorUserId, actionType, targetId, targetName, summary, meta = null }) {
  await safeWriteOperationLog({
    familyId,
    actorUserId,
    actionType,
    domain: 'dog',
    targetType: 'dog',
    targetId,
    targetName,
    summary,
    meta,
  })
}

function parseAdoptionFeeAmount(data = {}) {
  const directAmount = Number(data.adoption_fee ?? data.adoptionFee)
  if (Number.isFinite(directAmount) && directAmount > 0) return directAmount

  const notesText = typeof data.disposition_notes === 'string' ? data.disposition_notes.trim() : ''
  const matchedAmount = notesText.match(/领养费用：¥\s*([0-9]+(?:\.[0-9]+)?)/)
  if (!matchedAmount?.[1]) return 0

  const parsedAmount = Number(matchedAmount[1])
  return Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0
}

async function findLinkedAdoptionIncomes(familyId, dogId, date, notes) {
  if (!dogId || !date) return []
  const { data: incomes } = await db.collection('incomes')
    .where({
      family_id: familyId,
      dog_id: dogId,
      type: '领养',
      date,
      notes: notes || null,
      deleted_at: null,
    })
    .get()

  return incomes || []
}

async function createAdoptionIncome({ familyId, uid, dog, amount, date, notes, incomeId = null }) {
  const now = Date.now()
  const incomeData = buildVersionedCreate({
    ...(incomeId ? { _id: incomeId } : {}),
    family_id: familyId,
    dog_id: dog._id,
    dog_name: dog.name || '',
    type: '领养',
    amount,
    date,
    source_sale_id: null,
    source_type: 'auto',
    source_record_id: dog._id,
    notes: notes || null,
    created_by: uid,
    deleted_at: null,
  }, now)
  const { id } = await db.collection('incomes').add(incomeData)
  return {
    id: incomeId || id,
    row: {
      ...incomeData,
      _id: incomeId || id,
    },
  }
}

async function findLinkedPurchaseExpenses(familyId, dogId) {
  if (!dogId) return []
  const { data: expenses } = await db.collection('expenses')
    .where({
      family_id: familyId,
      category: '购入',
      source_record_id: dogId,
      deleted_at: null,
    })
    .get()

  return expenses || []
}

function buildDogPurchaseExpensePayload({ familyId, uid, dog, amount, date, expenseId = null }) {
  const now = Date.now()
  const dogName = dog.name || ''
  return buildVersionedCreate({
    ...(expenseId ? { _id: expenseId } : {}),
    family_id: familyId,
    total_amount: amount,
    category: '购入',
    date: Number(date || now),
    linked_cycle_id: null,
    linked_litter_id: null,
    linked_dog_ids: [dog._id],
    source_type: 'auto',
    source_record_id: dog._id,
    images: [],
    dam_name: dogName || null,
    dog_names: [dogName],
    litter_number: null,
    notes: `购入${dog.role === '外部种公' ? '外部种公' : '种犬'}：${dogName}`,
    created_by: uid,
    deleted_at: null,
  }, now)
}

async function syncDogPurchaseExpense({ familyId, uid, dog, amount, date, linkedExpenses, clientExpenseId = null }) {
  if (!(amount > 0)) {
    const removed = []
    for (const expense of linkedExpenses || []) {
      await db.collection('expenses').doc(expense._id).remove()
      removed.push({
        collection: 'expenses',
        id: expense._id,
        version: getServerVersion(expense),
        updatedAt: Date.now(),
        deletedAt: Date.now(),
      })
    }
    return removed
  }

  if ((linkedExpenses || []).length > 0) {
    const updateNow = Date.now()
    for (const expense of linkedExpenses) {
      await db.collection('expenses').doc(expense._id).update({
        total_amount: amount,
        date: Number(date || updateNow),
        linked_dog_ids: [dog._id],
        dog_names: [dog.name || ''],
        dam_name: dog.name || null,
        notes: `购入${dog.role === '外部种公' ? '外部种公' : '种犬'}：${dog.name || ''}`,
        ...buildVersionUpdate(dbCmd, updateNow),
      })
    }
    const { data: updatedExpenses } = await db.collection('expenses')
      .where({ _id: dbCmd.in(linkedExpenses.map(expense => expense._id)), family_id: familyId })
      .get()
    return (updatedExpenses || []).map(expense => buildTouchedEntity('expenses', expense))
  }

  const expenseData = buildDogPurchaseExpensePayload({
    familyId,
    uid,
    dog,
    amount,
    date,
    expenseId: clientExpenseId,
  })
  const { id } = await db.collection('expenses').add(expenseData)
  return [buildTouchedEntity('expenses', { ...expenseData, _id: clientExpenseId || id })]
}

function sortListStatuses(statuses = []) {
  return [...statuses].sort((a, b) => {
    const aPriority = LIST_STATUS_PRIORITY[a.type] ?? 99
    const bPriority = LIST_STATUS_PRIORITY[b.type] ?? 99
    return aPriority - bPriority
  })
}

function getStatusActivityTs(status) {
  return status?.activityTs || 0
}

function sortDetailStatuses(statuses = []) {
  return [...statuses].sort((a, b) => {
    const aPriority = DETAIL_STATUS_PRIORITY[a.type] ?? 99
    const bPriority = DETAIL_STATUS_PRIORITY[b.type] ?? 99
    if (aPriority !== bPriority) return aPriority - bPriority
    return getStatusActivityTs(b) - getStatusActivityTs(a)
  })
}

function normalizeIllnessLabel(label) {
  return typeof label === 'string' ? label.trim() : '生病中'
}

function getIllnessPrimaryCondition(source = {}) {
  return normalizeIllnessLabel(source?.primary_condition || source?.condition || '生病中')
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

function isTreatingIllness(illness) {
  return String(illness?.details?.treatment_status || '观察中').trim() === '治疗中'
}

function buildMedicationRelationInfo(task, illnesses = []) {
  const illnessById = new Map((illnesses || []).map(illness => [illness._id, illness]))
  if (task?.source_record_id) {
    return {
      relationType: 'linked',
      relationLabel: '关联疾病',
      linkedIllness: illnessById.get(task.source_record_id) || null,
    }
  }
  const latestIllness = [...(illnesses || [])]
    .filter(isTreatingIllness)
    .sort((a, b) => (b.updated_at || b.date || b.created_at || 0) - (a.updated_at || a.date || a.created_at || 0))[0]
  if (latestIllness) {
    return {
      relationType: 'fallback',
      relationLabel: '可能关联当前疾病',
      linkedIllness: latestIllness,
    }
  }
  return {
    relationType: 'standalone',
    relationLabel: '独立用药',
    linkedIllness: null,
  }
}

function buildIllnessRelationInfo(illness, tasks = []) {
  if (!isTreatingIllness(illness)) {
    return { relationType: 'standalone', relationLabel: '未关联用药' }
  }
  if ((tasks || []).some(task => task?.source_record_id === illness?._id)) {
    return { relationType: 'linked', relationLabel: '关联用药' }
  }
  if ((tasks || []).some(task => !task?.source_record_id)) {
    return { relationType: 'fallback', relationLabel: '可能关联当前用药' }
  }
  return { relationType: 'standalone', relationLabel: '未关联用药' }
}

function buildDetailIllnessStatuses(illnesses = [], activeMedicationTasks = []) {
  const grouped = new Map()

  for (const illness of illnesses) {
    const label = getIllnessPrimaryCondition(illness.details || {})
    if (!grouped.has(label)) grouped.set(label, [])
    grouped.get(label).push(illness)
  }

  return Array.from(grouped.entries()).map(([label, records]) => {
    const sorted = [...records].sort((a, b) => (b.updated_at || b.date || b.created_at || 0) - (a.updated_at || a.date || a.created_at || 0))
    const latest = sorted[0]
    const relation = buildIllnessRelationInfo(latest, activeMedicationTasks)
    return {
      type: '生病中',
      label,
      recordId: latest._id,
      relationType: relation.relationType,
      meta: relation.relationType === 'standalone' ? [] : [{ icon: 'link', text: relation.relationLabel }],
      activityTs: latest.updated_at || latest.date || latest.created_at || 0,
    }
  })
}

function buildListIllnessStatuses(illnesses = [], activeMedicationTasks = []) {
  const sortedRecords = [...illnesses].sort((a, b) => (b.updated_at || b.date || b.created_at || 0) - (a.updated_at || a.date || a.created_at || 0))
  const labels = []
  const seen = new Set()
  let firstRecordId = null

  for (const illness of sortedRecords) {
    const label = getIllnessPrimaryCondition(illness.details || {})
    const dedupeKey = label
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    labels.push(label)
    if (!firstRecordId) firstRecordId = illness._id
  }

  if (labels.length === 0) return []

  const latest = sortedRecords[0]
  const illnessStartTs = latest?.details?.start_date || latest?.date || latest?.created_at || 0
  const illnessDay = illnessStartTs ? Math.max(1, Math.floor((Date.now() - illnessStartTs) / 86400000) + 1) : null
  const illnessMeta = illnessDay ? [{ icon: 'schedule', text: `第${illnessDay}天` }] : []
  const relation = buildIllnessRelationInfo(latest, activeMedicationTasks)
  const meta = relation.relationType === 'standalone'
    ? illnessMeta
    : [{ icon: 'link', text: relation.relationLabel }, ...illnessMeta]

  if (labels.length === 1) {
    return [{
      type: '生病中',
      label: labels[0],
      count: 1,
      recordId: firstRecordId,
      relationType: relation.relationType,
      activityTs: latest?.updated_at || latest?.date || latest?.created_at || 0,
      meta,
    }]
  }

  if (labels.length === 2) {
    return [{
      type: '生病中',
      label: `${labels[0]}/${labels[1]}`,
      count: 2,
      recordId: firstRecordId,
      relationType: relation.relationType,
      activityTs: latest?.updated_at || latest?.date || latest?.created_at || 0,
      meta,
    }]
  }

  return [{
    type: '生病中',
    label: `${labels[0]}/${labels[1]}等${labels.length}项`,
    count: labels.length,
    recordId: firstRecordId,
    relationType: relation.relationType,
    activityTs: latest?.updated_at || latest?.date || latest?.created_at || 0,
    meta,
  }]
}

function buildListMedicationStatus(tasks = [], nowTs = Date.now(), activeIllnesses = []) {
  if (!tasks.length) return []
  const preferredTask = tasks.reduce((currentTask, nextTask) => pickPreferredMedicationTask(currentTask, nextTask), null)
  const { currentDay, totalDays } = getMedicationTaskProgress(preferredTask, nowTs)
  const drugName = preferredTask?.drug_name || preferredTask?.details?.drug_name || '用药'
  const relation = buildMedicationRelationInfo(preferredTask, activeIllnesses)
  return [{
    type: '用药中',
    label: '用药中',
    count: tasks.length,
    taskId: preferredTask?._id,
    detail: drugName,
    relationType: relation.relationType,
    progress: { current: Math.min(currentDay, totalDays), total: totalDays },
    meta: [{ icon: 'link', text: relation.relationLabel }],
    activityTs: preferredTask?.updated_at || preferredTask?.created_at || 0,
  }]
}

function getMedicationTaskStartTs(task) {
  return task?.actual_start_date || task?.updated_at || task?.created_at || 0
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

function getMedicationTaskProgress(task, nowTs = Date.now()) {
  const startTs = startOfDay(task?.actual_start_date || task?.start_date || task?.created_at || nowTs)
  const todayTs = startOfDay(nowTs)
  const totalDays = Math.max(1, Number(task?.duration_days) || 1)
  const currentDay = Math.floor((todayTs - startTs) / 86400000) + 1

  return {
    currentDay,
    totalDays,
  }
}

function isMedicationTaskActiveForDetail(task, nowTs = Date.now()) {
  const { currentDay, totalDays } = getMedicationTaskProgress(task, nowTs)
  return currentDay >= 1 && currentDay <= totalDays
}

function getActiveMedicationTasks(tasks = [], nowTs = Date.now()) {
  return (tasks || []).filter(task => isMedicationTaskActiveForDetail(task, nowTs))
}

function getMedicationCompletionSummary(task) {
  const frequency = Math.max(1, Number(task?.frequency) || 1)
  const durationDays = Math.max(1, Number(task?.duration_days) || 1)
  const dailyDoses = task?.daily_doses || {}
  const completedDates = new Set(Array.isArray(task?.completed_dates) ? task.completed_dates : [])

  let completedDoseCount = 0
  for (let day = 1; day <= durationDays; day += 1) {
    const doses = Number(dailyDoses[String(day)])
    if (Number.isFinite(doses)) {
      completedDoseCount += Math.min(Math.max(0, doses), frequency)
      continue
    }

    const startTs = startOfDay(task?.actual_start_date || task?.start_date || task?.created_at || Date.now())
    const dayTs = startTs + ((day - 1) * 86400000)
    if (completedDates.has(dayTs)) {
      completedDoseCount += frequency
    }
  }

  return {
    completedDoseCount,
    totalDoseCount: durationDays * frequency,
    frequency,
  }
}

function pickPreferredMedicationTask(currentTask, nextTask) {
  if (!currentTask) return nextTask

  const currentStartTs = getMedicationTaskStartTs(currentTask)
  const nextStartTs = getMedicationTaskStartTs(nextTask)
  if (nextStartTs !== currentStartTs) {
    return nextStartTs > currentStartTs ? nextTask : currentTask
  }

  const currentUpdatedTs = currentTask?.updated_at || currentTask?.created_at || 0
  const nextUpdatedTs = nextTask?.updated_at || nextTask?.created_at || 0
  return nextUpdatedTs > currentUpdatedTs ? nextTask : currentTask
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
   * 获取犬只列表 + 实时派生状态
   * 集合级查询（非逐犬），30-50犬毫秒级完成
   */
  async getDogListWithStatus(filters = {}) {
    const now = Date.now()
    const where = {
      family_id: this.familyId,
      deleted_at: null,
    }

    // 可选筛选条件
    if (filters.gender) where.gender = filters.gender
    if (filters.role) where.role = filters.role
    if (filters.disposition) where.disposition = filters.disposition
    else where.disposition = dbCmd.in(['在养', '待售', '已预定', '自留'])

    // 并行查询犬只列表 + 状态源数据
    const [dogsRes, cyclesRes, illnessRes, medTasksRes, littersRes] = await Promise.all([
      // 犬只列表
      db.collection('dogs').where(where).orderBy('created_at', 'desc').get(),
      // 进行中的繁育周期
      db.collection('breeding_cycles').where({
        family_id: this.familyId,
        status: dbCmd.in(['发情中', '怀孕中', '已生产']),
      }).get(),
      // 未康复的疾病记录
      db.collection('health_records').where({
        family_id: this.familyId,
        type: 'illness',
        'details.treatment_status': dbCmd.neq('已康复'),
      }).get(),
      // 活跃用药任务
      db.collection('medication_tasks').where({
        family_id: this.familyId,
        status: '进行中',
      }).get(),
      // 未断奶的窝
      db.collection('litters').where({
        family_id: this.familyId,
        weaned_at: null,
      }).get(),
    ])

    const dogs = dogsRes.data
    const cycles = cyclesRes.data
    const illnesses = illnessRes.data
    const medTasks = medTasksRes.data
    const activeLitters = littersRes.data

    const breedingStatusMap = {}
    for (const cycle of cycles) {
      const damId = cycle.dam_id
      if (cycle.status === '发情中') {
        const startTs = cycle.start_date || cycle.created_at || now
        const day = Math.max(1, Math.floor((now - startTs) / 86400000) + 1)
        breedingStatusMap[damId] = [{
          type: '发情中',
          cycleId: cycle._id,
          activityTs: cycle.updated_at || cycle.created_at || 0,
          meta: [{ icon: 'schedule', text: `第${day}天` }],
        }]
      } else if (cycle.status === '怀孕中') {
        const startTs = cycle.mated_at || cycle.updated_at || cycle.created_at || now
        const daysPassed = Math.max(1, Math.floor((now - startTs) / 86400000))
        breedingStatusMap[damId] = [{
          type: '怀孕中',
          cycleId: cycle._id,
          progress: { current: Math.min(daysPassed, 63), total: 63 },
          activityTs: cycle.updated_at || cycle.created_at || 0,
        }]
      } else if (cycle.status === '已生产') {
        const latestLitter = activeLitters
          .filter(l => l.dam_id === damId)
          .sort((a, b) => (b.birth_date || b.created_at || 0) - (a.birth_date || a.created_at || 0))[0]
        if (latestLitter) {
          const startTs = latestLitter.birth_date || latestLitter.created_at || now
          const day = Math.max(1, Math.floor((now - startTs) / 86400000) + 1)
          breedingStatusMap[damId] = [{
            type: '哺乳中',
            cycleId: cycle._id,
            activityTs: latestLitter.updated_at || latestLitter.created_at || 0,
            meta: [{ icon: 'schedule', text: `第${day}天` }],
          }]
        }
      }
    }

    const illnessMap = {}
    for (const illness of illnesses) {
      const dogId = illness.dog_id
      if (!illnessMap[dogId]) illnessMap[dogId] = []
      illnessMap[dogId].push(illness)
    }

    const medicationMap = {}
    for (const task of medTasks) {
      if (!isMedicationTaskActiveForDetail(task, now)) continue
      const dogId = task.dog_id
      if (!medicationMap[dogId]) medicationMap[dogId] = []
      medicationMap[dogId].push(task)
    }

    // 组装结果
    const result = dogs.map(dog => ({
      ...dog,
      statuses: (() => {
        const statuses = [
          ...(buildListIllnessStatuses(illnessMap[dog._id] || [], medicationMap[dog._id] || [])),
          ...((breedingStatusMap[dog._id]) || []),
          ...(buildListMedicationStatus(medicationMap[dog._id] || [], now, illnessMap[dog._id] || [])),
        ]
        const sorted = sortListStatuses(statuses)
        return sorted.length > 0 ? sorted : [{ type: '正常' }]
      })(),
    }))

    return { data: result }
  },

  /**
   * 获取犬只详情
   */
  async getDogDetail(dogId) {
    if (!dogId) throw new Error('缺少犬只 ID')

    const familyId = this.familyId
    const now = Date.now()

    const [dogRes, cyclesRes, illnessRes, medTasksRes, littersRes] = await Promise.all([
      db.collection('dogs').where({ _id: dogId, family_id: familyId, deleted_at: null }).get(),
      db.collection('breeding_cycles').where({ dam_id: dogId, family_id: familyId }).get(),
      db.collection('health_records').where({ dog_id: dogId, family_id: familyId, type: 'illness' }).get(),
      db.collection('medication_tasks').where({ dog_id: dogId, family_id: familyId, status: '进行中' }).get(),
      db.collection('litters').where({ dam_id: dogId, family_id: familyId, weaned_at: null }).get(),
    ])

    if (!dogRes.data || dogRes.data.length === 0) throw new Error('犬只不存在')
    const dog = dogRes.data[0]
    const statuses = []
    const activeLitters = littersRes.data || []

    const methodMap = { oral: '口服', injection: '注射', topical: '外用', other: '其他' }

    // 繁育状态（取最近一条活跃周期）
    const activeCycle = (cyclesRes.data || []).find(c => c.status === '发情中' || c.status === '怀孕中')
    if (activeCycle) {
      if (activeCycle.status === '发情中') {
        statuses.push({
          type: '发情中',
          cycleId: activeCycle._id,
          activityTs: activeCycle.updated_at || activeCycle.created_at || 0,
        })
      } else if (activeCycle.status === '怀孕中') {
        const startTs = activeCycle.mated_at || activeCycle.updated_at || activeCycle.created_at
        const daysPassed = Math.max(1, Math.floor((now - startTs) / 86400000))
        const totalDays = 63
        const dueTs = startTs + totalDays * 86400000
        const dueDate = new Date(dueTs)
        const dueMd = `${dueDate.getMonth() + 1}月${dueDate.getDate()}日`
        statuses.push({
          type: '怀孕中',
          cycleId: activeCycle._id,
          detail: activeCycle.sire_name ? `种公: ${activeCycle.sire_name}` : '',
          progress: { current: Math.min(daysPassed, totalDays), total: totalDays },
          activityTs: activeCycle.updated_at || activeCycle.created_at || 0,
          meta: [
            { icon: 'event', text: `预产期 ${dueMd}` },
            { icon: 'schedule', text: `还有${Math.max(0, totalDays - daysPassed)}天` },
          ],
        })
      }
    }

    // 哺乳中（有未断奶的窝且无活跃繁育周期）
    if (activeLitters.length > 0 && !activeCycle) {
      let puppyMap = {}
      const litterIds = activeLitters.map(item => item._id).filter(Boolean)
      if (litterIds.length > 0) {
        const { data: puppies } = await db.collection('dogs')
          .where({ origin_litter_id: dbCmd.in(litterIds), family_id: familyId, deleted_at: null })
          .get()
        for (const puppy of (puppies || [])) {
          if (!puppyMap[puppy.origin_litter_id]) puppyMap[puppy.origin_litter_id] = []
          puppyMap[puppy.origin_litter_id].push(puppy)
        }
      }

      const latestLitter = [...activeLitters].sort((a, b) => {
        const aTs = a.birth_date || a.updated_at || a.created_at || 0
        const bTs = b.birth_date || b.updated_at || b.created_at || 0
        return bTs - aTs
      })[0]
      const birthTs = latestLitter?.birth_date || latestLitter?.created_at || 0
      const nursingDay = birthTs ? Math.max(1, Math.floor((now - birthTs) / 86400000) + 1) : null
      const pupStats = buildLitterPupStats(latestLitter, puppyMap[latestLitter?._id] || [])
      const aliveSummary = pupStats.total > 0 ? `本窝存活 ${pupStats.alive}/${pupStats.total}` : ''
      const detailParts = []
      if (latestLitter?.sire_name) detailParts.push(`种公: ${latestLitter.sire_name}`)
      if (aliveSummary) detailParts.push(aliveSummary)
      const meta = []
      if (birthTs) meta.push({ icon: 'event', text: `生产于 ${formatDateYMD(birthTs)}` })
      if (nursingDay) meta.push({ icon: 'schedule', text: `第${nursingDay}天` })
      if (aliveSummary) meta.push({ icon: 'favorite', text: aliveSummary })
      if (pupStats.kept > 0) meta.push({ icon: 'pets', text: `在养 ${pupStats.kept} 只` })

      statuses.push({
        type: '哺乳中',
        cycleId: latestLitter?.cycle_id || '',
        detail: detailParts.join(' · '),
        meta,
        activityTs: latestLitter?.updated_at || latestLitter?.created_at || 0,
      })
    }

    // 疾病状态（未康复的）
    const activeIllnesses = (illnessRes.data || []).filter(r => r.details?.treatment_status !== '已康复')

    // 用药状态（按药名去重，取进度最新的）
    const medTasks = getActiveMedicationTasks(medTasksRes.data || [], now)
    statuses.push(...buildDetailIllnessStatuses(activeIllnesses, medTasks))
    const medDrugMap = {}
    for (const task of medTasks) {
      const drug = task.drug_name || task.details?.drug_name || '用药'
      medDrugMap[drug] = pickPreferredMedicationTask(medDrugMap[drug], task)
    }
    for (const task of Object.values(medDrugMap)) {
      const parts = [
        task.drug_name,
        task.dosage ? `${task.dosage}${MEDICATION_DOSAGE_UNIT_MAP[task.dosage_unit] || task.dosage_unit || ''}` : null,
        methodMap[task.method] || task.method,
      ].filter(Boolean)
      const { currentDay, totalDays } = getMedicationTaskProgress(task, now)
      const { completedDoseCount, totalDoseCount, frequency } = getMedicationCompletionSummary(task)
      const relation = buildMedicationRelationInfo(task, activeIllnesses)
      statuses.push({
        type: '用药中',
        taskId: task._id,
        detail: parts.join(' · '),
        relationType: relation.relationType,
        progress: task.duration_days ? { current: Math.min(currentDay, totalDays), total: totalDays } : null,
        activityTs: task.updated_at || task.created_at || 0,
        meta: [
          { icon: 'link', text: relation.relationLabel },
          { icon: 'schedule', text: formatMedicationFrequency(frequency) },
          { icon: 'check_circle', text: `已执行 ${completedDoseCount}/${totalDoseCount} 次` },
        ],
      })
    }

    return { data: { ...dog, statuses: sortDetailStatuses(statuses) } }
  },

  /**
   * 创建犬只
   */
  async createDog(data) {
    if (!data.name && data.role !== '幼崽') {
      throw new Error('请输入犬只名称')
    }
    if (!data.gender) throw new Error('请选择性别')
    if (!data.role) throw new Error('请选择角色')

    const now = Date.now()
    const syncMeta = getSyncMeta(data)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response
    const clientDogId = typeof syncMeta?.clientEntityIds?.dogs === 'string' ? syncMeta.clientEntityIds.dogs : null
    const clientExpenseId = typeof syncMeta?.clientEntityIds?.expenses === 'string' ? syncMeta.clientEntityIds.expenses : null
    const dogData = buildVersionedCreate({
      ...(clientDogId ? { _id: clientDogId } : {}),
      name: data.name || '',
      gender: data.gender,
      role: data.role,
      disposition: data.disposition || '在养',
      species: data.species || '犬',
      breed: data.breed || '',
      birth_date: data.birth_date || null,
      purchase_date: data.purchase_date || null,
      purchase_price: data.purchase_price || null,
      latest_weight: data.latest_weight || null,
      family_id: this.familyId,
      origin_litter_id: data.origin_litter_id || null,
      owner_info: data.owner_info || null,
      disposition_date: null,
      disposition_notes: null,
      deleted_at: null,
    }, now)

    const { id } = await db.collection('dogs').add(dogData)
    const dogId = clientDogId || id

    // 如有购入价格，自动创建费用记录
    const createdExpenseTouchedEntities = data.purchase_price && data.purchase_price > 0
      ? await syncDogPurchaseExpense({
          familyId: this.familyId,
          uid: this.uid,
          dog: { ...dogData, _id: dogId },
          amount: Number(data.purchase_price),
          date: data.purchase_date || now,
          linkedExpenses: [],
          clientExpenseId,
        })
      : []

    await logDogOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'create',
      targetId: dogId,
      targetName: dogData.name || '未命名犬只',
      summary: `新增了犬只 ${dogData.name || '未命名犬只'}`,
      meta: {
        role: dogData.role,
        disposition: dogData.disposition,
      },
    })

    const savedDog = { ...dogData, _id: dogId }
    const response = {
      data: { _id: dogId },
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: [
          buildTouchedEntity('dogs', savedDog),
          ...createdExpenseTouchedEntities,
        ],
        resyncScopes: ['dogs', 'expenses'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 更新犬只基础信息
   */
  async updateDog(input, data = null) {
    const dogId = typeof input === 'object' ? (input.dogId || input.dog_id || input.id) : input
    data = typeof input === 'object' ? (input.data || input.patch || input) : data
    if (!dogId) throw new Error('缺少犬只 ID')
    const now = Date.now()
    const syncMeta = getSyncMeta(data)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response

    const { data: dogs } = await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .get()

    if (!dogs || dogs.length === 0) throw new Error('犬只不存在')

    const currentDog = dogs[0]
    const linkedPurchaseExpenses = await findLinkedPurchaseExpenses(this.familyId, dogId)
    const baseVersion = getBaseVersion(syncMeta, dogId)
    if (baseVersion !== null && baseVersion < getServerVersion(currentDog)) {
      return buildConflictAck(syncMeta, {
        collection: 'dogs',
        entityId: dogId,
        baseVersion,
        serverVersion: getServerVersion(currentDog),
      })
    }
    for (const expense of linkedPurchaseExpenses) {
      const expenseConflict = getEntityConflict(syncMeta, 'expenses', expense)
      if (expenseConflict) return expenseConflict
    }

    if (Object.prototype.hasOwnProperty.call(data, 'role') && data.role !== currentDog.role) {
      throw new Error('角色不可通过普通编辑修改，请使用专门操作')
    }

    // 禁止通过此方法修改 name（用 updateDogName）、disposition（用 changeDisposition）和 role（用专门流程）
    const { name, disposition, role, family_id, deleted_at, created_at, _id, ...updateFields } = data
    Object.assign(updateFields, buildVersionUpdate(dbCmd, Date.now()))

    await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .update(updateFields)

    const nextPurchasePrice = Object.prototype.hasOwnProperty.call(data, 'purchase_price')
      ? Number(data.purchase_price || 0)
      : Number(currentDog.purchase_price || 0)
    const nextPurchaseDate = Object.prototype.hasOwnProperty.call(data, 'purchase_date')
      ? data.purchase_date
      : currentDog.purchase_date
    const clientExpenseId = typeof syncMeta?.clientEntityIds?.expenses === 'string'
      ? syncMeta.clientEntityIds.expenses
      : null
    const expenseTouchedEntities = await syncDogPurchaseExpense({
      familyId: this.familyId,
      uid: this.uid,
      dog: {
        ...currentDog,
        ...updateFields,
        _id: dogId,
      },
      amount: nextPurchasePrice,
      date: nextPurchaseDate || now,
      linkedExpenses: linkedPurchaseExpenses,
      clientExpenseId,
    })

    await logDogOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'update',
      targetId: dogId,
      targetName: currentDog.name || '未命名犬只',
      summary: `更新了犬只 ${currentDog.name || '未命名犬只'} 的档案信息`,
    })

    const { data: updatedDogs } = await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .limit(1)
      .get()
    const response = {
      message: '已更新',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: [
          ...(updatedDogs?.[0] ? [buildTouchedEntity('dogs', updatedDogs[0])] : []),
          ...expenseTouchedEntities,
        ],
        resyncScopes: ['dogs', 'expenses'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 改名 + 批量更新冗余字段
   */
  async updateDogName(input, newName = '') {
    const dogId = typeof input === 'object' ? (input.dogId || input.dog_id || input.id) : input
    newName = typeof input === 'object' ? (input.name || input.newName || input.new_name || '') : newName
    if (!dogId) throw new Error('缺少犬只 ID')
    if (!newName || !newName.trim()) throw new Error('请输入新名称')

    const trimmedName = newName.trim()
    const now = Date.now()
    const syncMeta = getSyncMeta(input)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response

    const { data: dogs } = await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .limit(1)
      .get()
    const dog = dogs?.[0]
    if (!dog) throw new Error('犬只不存在')
    const previousName = dog.name || ''
    const baseVersion = getBaseVersion(syncMeta, dogId)
    if (baseVersion !== null && baseVersion < getServerVersion(dog)) {
      return buildConflictAck(syncMeta, {
        collection: 'dogs',
        entityId: dogId,
        baseVersion,
        serverVersion: getServerVersion(dog),
      })
    }

    // 更新犬只名称
    await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .update({ name: trimmedName, ...buildVersionUpdate(dbCmd, now) })

    // 批量更新冗余字段（顺序写入，审计兜底）
    const updates = [
      db.collection('tasks').where({ dog_id: dogId, family_id: this.familyId }).update({ dog_name: trimmedName, ...buildVersionUpdate(dbCmd, now) }),
      db.collection('breeding_cycles').where({ dam_id: dogId, family_id: this.familyId }).update({ dam_name: trimmedName, ...buildVersionUpdate(dbCmd, now) }),
      db.collection('breeding_cycles').where({ sire_id: dogId, family_id: this.familyId }).update({ sire_name: trimmedName, ...buildVersionUpdate(dbCmd, now) }),
      db.collection('litters').where({ dam_id: dogId, family_id: this.familyId }).update({ dam_name: trimmedName, ...buildVersionUpdate(dbCmd, now) }),
      db.collection('litters').where({ sire_id: dogId, family_id: this.familyId }).update({ sire_name: trimmedName, ...buildVersionUpdate(dbCmd, now) }),
      db.collection('health_records').where({ dog_id: dogId, family_id: this.familyId }).update({ dog_name: trimmedName, ...buildVersionUpdate(dbCmd, now) }),
      db.collection('medication_tasks').where({ dog_id: dogId, family_id: this.familyId }).update({ dog_name: trimmedName, ...buildVersionUpdate(dbCmd, now) }),
      db.collection('breeding_records').where({ dog_id: dogId, family_id: this.familyId }).update({ dog_name: trimmedName, ...buildVersionUpdate(dbCmd, now) }),
      db.collection('incomes').where({ dog_id: dogId, family_id: this.familyId }).update({ dog_name: trimmedName, ...buildVersionUpdate(dbCmd, now) }),
      db.collection('sale_records').where({ dog_id: dogId, family_id: this.familyId }).update({ dog_name: trimmedName, ...buildVersionUpdate(dbCmd, now) }),
    ]

    // 不用 Promise.all —— 顺序执行更安全，任一失败有审计兜底
    for (const update of updates) {
      try { await update } catch { /* 审计兜底 */ }
    }

    try {
      const { data: linkedExpenses } = await db.collection('expenses')
        .where({ family_id: this.familyId, linked_dog_ids: dogId, deleted_at: null })
        .get()
      for (const expense of linkedExpenses || []) {
        const dogNames = Array.isArray(expense.dog_names) ? [...expense.dog_names] : []
        ;(expense.linked_dog_ids || []).forEach((linkedDogId, index) => {
          if (linkedDogId === dogId) dogNames[index] = trimmedName
        })
        await db.collection('expenses').doc(expense._id).update({
          dog_names: dogNames.filter(Boolean),
          dam_name: expense.dam_name === previousName ? trimmedName : expense.dam_name,
          ...buildVersionUpdate(dbCmd, now),
        })
      }
    } catch { /* 审计兜底 */ }

    await logDogOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'update',
      targetId: dogId,
      targetName: trimmedName,
      summary: `将犬只 ${dog.name || dogId} 改名为 ${trimmedName}`,
    })

    const [
      updatedDogs,
      updatedTasks,
      damCycles,
      sireCycles,
      damLitters,
      sireLitters,
      updatedHealthRecords,
      updatedMedicationTasks,
      updatedBreedingRecords,
      updatedExpenses,
      updatedIncomes,
      updatedSales,
    ] = await Promise.all([
      db.collection('dogs').where({ _id: dogId, family_id: this.familyId }).limit(1).get(),
      db.collection('tasks').where({ dog_id: dogId, family_id: this.familyId }).get(),
      db.collection('breeding_cycles').where({ dam_id: dogId, family_id: this.familyId }).get(),
      db.collection('breeding_cycles').where({ sire_id: dogId, family_id: this.familyId }).get(),
      db.collection('litters').where({ dam_id: dogId, family_id: this.familyId }).get(),
      db.collection('litters').where({ sire_id: dogId, family_id: this.familyId }).get(),
      db.collection('health_records').where({ dog_id: dogId, family_id: this.familyId }).get(),
      db.collection('medication_tasks').where({ dog_id: dogId, family_id: this.familyId }).get(),
      db.collection('breeding_records').where({ dog_id: dogId, family_id: this.familyId }).get(),
      db.collection('expenses').where({ family_id: this.familyId, linked_dog_ids: dogId, deleted_at: null }).get(),
      db.collection('incomes').where({ dog_id: dogId, family_id: this.familyId }).get(),
      db.collection('sale_records').where({ dog_id: dogId, family_id: this.familyId }).get(),
    ])
    const uniqueRows = (rows = []) => Array.from(new Map((rows || []).map(row => [row._id, row])).values())
    const response = {
      message: '名称已更新',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: [
          ...(updatedDogs?.data?.[0] ? [buildTouchedEntity('dogs', updatedDogs.data[0])] : []),
          ...((updatedTasks?.data || []).map(row => buildTouchedEntity('tasks', row))),
          ...uniqueRows([...(damCycles?.data || []), ...(sireCycles?.data || [])]).map(row => buildTouchedEntity('breeding_cycles', row)),
          ...uniqueRows([...(damLitters?.data || []), ...(sireLitters?.data || [])]).map(row => buildTouchedEntity('litters', row)),
          ...((updatedHealthRecords?.data || []).map(row => buildTouchedEntity('health_records', row))),
          ...((updatedMedicationTasks?.data || []).map(row => buildTouchedEntity('medication_tasks', row))),
          ...((updatedBreedingRecords?.data || []).map(row => buildTouchedEntity('breeding_records', row))),
          ...((updatedExpenses?.data || []).map(row => buildTouchedEntity('expenses', row))),
          ...((updatedIncomes?.data || []).map(row => buildTouchedEntity('incomes', row))),
          ...((updatedSales?.data || []).map(row => buildTouchedEntity('sale_records', row))),
        ],
        resyncScopes: ['dogs', 'tasks', 'breeding_cycles', 'litters', 'health_records', 'medication_tasks', 'breeding_records', 'expenses', 'incomes', 'sale_records'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 变更犬只去向（disposition）
   * 包含异常状态转换处理
   */
  async changeDisposition(input, newDisposition = '', data = {}) {
    const dogId = typeof input === 'object' ? (input.dogId || input.dog_id || input.id) : input
    if (typeof input === 'object') {
      newDisposition = input.disposition || input.newDisposition || input.new_disposition || newDisposition
      data = input.data || input
    }
    if (!dogId) throw new Error('缺少犬只 ID')
    if (!newDisposition) throw new Error('请选择去向')
    const syncMeta = getSyncMeta(data)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response

    // 获取当前犬只信息
    const { data: dogs } = await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId, deleted_at: null })
      .get()

    if (!dogs || dogs.length === 0) throw new Error('犬只不存在')
    const dog = dogs[0]
    const dogConflict = getEntityConflict(syncMeta, 'dogs', dog)
    if (dogConflict) return dogConflict

    // 检查进行中的繁育周期
    const { data: activeCycles } = await db.collection('breeding_cycles')
      .where({ dam_id: dogId, family_id: this.familyId, status: dbCmd.in(['发情中', '怀孕中']) })
      .get()
    for (const cycle of activeCycles || []) {
      const conflict = getEntityConflict(syncMeta, 'breeding_cycles', cycle)
      if (conflict) return conflict
    }

    // 异常状态转换规则
    if (activeCycles.length > 0) {
      const cycle = activeCycles[0]

      if (newDisposition === '已领养' || newDisposition === '已赠送') {
        throw new Error('该犬有进行中的繁育周期，请先完成或关闭')
      }

      if (newDisposition === '已退休' && cycle.status === '怀孕中') {
        throw new Error('该犬当前怀孕中，请先完成生产或记录异常终止')
      }

      // 已故 或 退休(发情中) → 自动处理周期
      if (newDisposition === '已故') {
        for (const c of activeCycles) {
          await db.collection('breeding_cycles').doc(c._id).update({
            status: '失败',
            ...buildVersionUpdate(dbCmd, Date.now()),
          })
          // 取消该周期的所有待办任务
          const { data: cycleTasks } = await db.collection('tasks').where({
            cycle_id: c._id,
            family_id: this.familyId,
            status: 'pending',
          }).get()
          for (const task of cycleTasks || []) {
            const conflict = getEntityConflict(syncMeta, 'tasks', task)
            if (conflict) return conflict
          }
          await db.collection('tasks').where({
            cycle_id: c._id,
            family_id: this.familyId,
            status: 'pending',
          }).update({ status: 'cancelled', ...buildVersionUpdate(dbCmd, Date.now()) })
        }
      }

      if (newDisposition === '已退休') {
        const estrusCycles = activeCycles.filter(c => c.status === '发情中')
        for (const c of estrusCycles) {
          const { data: cycleTasks } = await db.collection('tasks').where({
            cycle_id: c._id,
            family_id: this.familyId,
            status: 'pending',
          }).get()
          for (const task of cycleTasks || []) {
            const conflict = getEntityConflict(syncMeta, 'tasks', task)
            if (conflict) return conflict
          }
          await db.collection('breeding_cycles').doc(c._id).update({
            status: '放弃',
            ...buildVersionUpdate(dbCmd, Date.now()),
          })
          await db.collection('tasks').where({
            cycle_id: c._id,
            family_id: this.familyId,
            status: 'pending',
          }).update({ status: 'cancelled', ...buildVersionUpdate(dbCmd, Date.now()) })
        }
      }
    }

    // 已故时取消所有未完成任务
    if (newDisposition === '已故') {
      const { data: dogTasks } = await db.collection('tasks').where({
        dog_id: dogId,
        family_id: this.familyId,
        status: 'pending',
      }).get()
      for (const task of dogTasks || []) {
        const conflict = getEntityConflict(syncMeta, 'tasks', task)
        if (conflict) return conflict
      }
      await db.collection('tasks').where({
        dog_id: dogId,
        family_id: this.familyId,
        status: 'pending',
      }).update({ status: 'cancelled', ...buildVersionUpdate(dbCmd, Date.now()) })
    }

    // 更新犬只
    const now = Date.now()
    const dispositionDate = data.disposition_date || now
    const dispositionNotes = data.disposition_notes || null
    const adoptionFeeAmount = newDisposition === '已领养'
      ? parseAdoptionFeeAmount({
          ...data,
          disposition_notes: dispositionNotes,
        })
      : 0
    const rollbackAdoptionIncomes = dog.disposition === '已领养' && newDisposition !== '已领养'
      ? await findLinkedAdoptionIncomes(this.familyId, dogId, dog.disposition_date, dog.disposition_notes || null)
      : []
    const clientIncomeId = typeof syncMeta?.clientEntityIds?.incomes === 'string'
      ? syncMeta.clientEntityIds.incomes
      : null
    let createdAdoptionIncome = null

    for (const income of rollbackAdoptionIncomes) {
      await db.collection('incomes').doc(income._id).remove()
    }

    const updateData = {
      disposition: newDisposition,
      updated_at: now,
    }

    if (['已故', '已领养', '已赠送', '已退休'].includes(newDisposition)) {
      updateData.disposition_date = dispositionDate
      updateData.disposition_notes = dispositionNotes
    }

    await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .update({
        ...updateData,
        ...buildVersionUpdate(dbCmd, now),
      })

    if (newDisposition === '已领养' && adoptionFeeAmount > 0) {
      createdAdoptionIncome = await createAdoptionIncome({
        familyId: this.familyId,
        uid: this.uid,
        dog,
        amount: adoptionFeeAmount,
        date: Number(dispositionDate || now),
        notes: dispositionNotes,
        incomeId: clientIncomeId,
      })
    }

    await logDogOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'status_change',
      targetId: dogId,
      targetName: dog.name || '未命名犬只',
      summary: `将犬只 ${dog.name || '未命名犬只'} 的去向更新为 ${newDisposition}`,
      meta: { disposition: newDisposition },
    })

    const [updatedDogRes, updatedCyclesRes, updatedTasksRes] = await Promise.all([
      db.collection('dogs').where({ _id: dogId, family_id: this.familyId }).limit(1).get(),
      db.collection('breeding_cycles').where({ dam_id: dogId, family_id: this.familyId, status: dbCmd.in(['发情中', '怀孕中', '失败', '放弃']) }).get(),
      db.collection('tasks').where({ dog_id: dogId, family_id: this.familyId }).get(),
    ])
    const response = {
      message: '去向已更新',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: [
          ...(updatedDogRes?.data?.[0] ? [buildTouchedEntity('dogs', updatedDogRes.data[0])] : []),
          ...((updatedCyclesRes?.data || []).map(row => buildTouchedEntity('breeding_cycles', row))),
          ...((updatedTasksRes?.data || []).map(row => buildTouchedEntity('tasks', row))),
          ...(createdAdoptionIncome?.row ? [buildTouchedEntity('incomes', createdAdoptionIncome.row)] : []),
          ...rollbackAdoptionIncomes.map(row => ({
            collection: 'incomes',
            id: row._id,
            version: Number(row.version || 0),
            updatedAt: now,
            deletedAt: now,
          })),
        ],
        resyncScopes: ['dogs', 'breeding_cycles', 'tasks', 'incomes'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  async updateDisposition(input, newDisposition = '', data = {}) {
    return this.changeDisposition(input, newDisposition, data)
  },

  /**
   * 软删除犬只
   */
  async softDeleteDog(input) {
    const dogId = typeof input === 'object' ? (input.dogId || input.dog_id || input.id) : input
    if (!dogId) throw new Error('缺少犬只 ID')
    requireAdmin(this.role)
    const syncMeta = getSyncMeta(input)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response

    const { data: dogs } = await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .limit(1)
      .get()
    const dog = dogs?.[0] || {}
    const baseVersion = getBaseVersion(syncMeta, dogId)
    if (baseVersion !== null && baseVersion < getServerVersion(dog)) {
      return buildConflictAck(syncMeta, {
        collection: 'dogs',
        entityId: dogId,
        baseVersion,
        serverVersion: getServerVersion(dog),
      })
    }
    const now = Date.now()

    await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .update({ deleted_at: now, ...buildVersionUpdate(dbCmd, now) })

    await logDogOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'delete',
      targetId: dogId,
      targetName: dog.name || '未命名犬只',
      summary: `删除了犬只 ${dog.name || '未命名犬只'}`,
    })

    const { data: updatedDogs } = await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .limit(1)
      .get()
    const response = {
      message: '已删除（可在回收站恢复）',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: updatedDogs?.[0] ? [buildTouchedEntity('dogs', updatedDogs[0])] : [],
        resyncScopes: ['dogs'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 恢复软删除的犬只
   */
  async restoreDog(input) {
    const dogId = typeof input === 'object' ? (input.dogId || input.dog_id || input.id) : input
    if (!dogId) throw new Error('缺少犬只 ID')
    requireAdmin(this.role)
    const syncMeta = getSyncMeta(input)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response

    const { data: dogs } = await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .limit(1)
      .get()
    const dog = dogs?.[0] || {}
    const baseVersion = getBaseVersion(syncMeta, dogId)
    if (baseVersion !== null && baseVersion < getServerVersion(dog)) {
      return buildConflictAck(syncMeta, {
        collection: 'dogs',
        entityId: dogId,
        baseVersion,
        serverVersion: getServerVersion(dog),
      })
    }

    await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .update({ deleted_at: null, ...buildVersionUpdate(dbCmd, Date.now()) })

    await logDogOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'restore',
      targetId: dogId,
      targetName: dog.name || '未命名犬只',
      summary: `恢复了犬只 ${dog.name || '未命名犬只'}`,
    })

    const { data: updatedDogs } = await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .limit(1)
      .get()
    const response = {
      message: '已恢复',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: updatedDogs?.[0] ? [buildTouchedEntity('dogs', updatedDogs[0])] : [],
        resyncScopes: ['dogs'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 幼崽升级为种狗
   */
  async upgradePuppyToBreeder(input) {
    const dogId = typeof input === 'object' ? (input.dogId || input.dog_id || input.id) : input
    if (!dogId) throw new Error('缺少犬只 ID')
    const syncMeta = getSyncMeta(input)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response

    const { data: dogs } = await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId, role: '幼崽', deleted_at: null })
      .get()

    if (!dogs || dogs.length === 0) throw new Error('犬只不存在或不是幼崽')

    const dog = dogs[0]
    const conflict = getEntityConflict(syncMeta, 'dogs', dog)
    if (conflict) return conflict

    await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .update({
        role: '种狗',
        disposition: '在养',
        ...buildVersionUpdate(dbCmd, Date.now()),
      })

    await logDogOperation({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'status_change',
      targetId: dogId,
      targetName: dog.name || '未命名犬只',
      summary: `将幼崽 ${dog.name || '未命名犬只'} 升级为种狗`,
      meta: { role: '种狗' },
    })

    const { data: updatedDogs } = await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .limit(1)
      .get()
    const response = {
      message: '已升级为种狗',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: updatedDogs?.[0] ? [buildTouchedEntity('dogs', updatedDogs[0])] : [],
        resyncScopes: ['dogs'],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  async promoteToBreeder(input) {
    return this.upgradePuppyToBreeder(input)
  },
}
