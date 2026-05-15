import { localDb } from '@/localdb/db'
import type { MedicationProtocol } from '@/stores/protocolStore'
import type { HealthRecord, MedicationTask } from '@/types/health'
import type { Task } from '@/types/task'
import { getBeijingDayStart } from '@/utils/date'
import {
  getIllnessPrimaryCondition,
  getMedicationTaskProgress,
  isTreatingIllness,
} from '@/localdb/domain-services/healthStatus'
import { sortByRecent } from './shared'

function startOfDay(ts: number) {
  return getBeijingDayStart(Number.isFinite(Number(ts)) ? Number(ts) : Date.now())
}

export async function listLocalMedicationProtocols(familyId: string): Promise<MedicationProtocol[]> {
  if (!familyId) return []
  const rows = await localDb.query<any>('medication_protocols', row =>
    row.family_id === familyId
    && !row.deleted_at,
    {
      sort: (left, right) => Number(right.updated_at || right.created_at || 0) - Number(left.updated_at || left.created_at || 0),
    },
  )
  return rows as MedicationProtocol[]
}

export async function listLocalDogHealthHistory(familyId: string, dogId: string, type?: string) {
  if (!familyId || !dogId) return []
  return localDb.query<any>('health_records', row => {
    if (row.family_id !== familyId) return false
    if (row.deleted_at) return false
    if (row.dog_id !== dogId) return false
    if (type && row.type !== type) return false
    return true
  }, {
    sort: (left, right) => Number(right.date || 0) - Number(left.date || 0),
  })
}

export async function listLocalLatestVaccinationDatesByDogIds(familyId: string, dogIds: string[]) {
  const dogIdSet = new Set((dogIds || []).map(id => String(id || '').trim()).filter(Boolean))
  if (!familyId || dogIdSet.size === 0) return {} as Record<string, number>

  const records = await localDb.query<HealthRecord & { deleted_at?: number | null }>('health_records', row =>
    row.family_id === familyId
    && row.type === 'vaccination'
    && dogIdSet.has(row.dog_id)
    && !row.deleted_at,
  )

  return records.reduce<Record<string, number>>((map, record) => {
    const dogId = String(record.dog_id || '')
    const date = Number(record.date || record.created_at || 0)
    if (!dogId || !Number.isFinite(date) || date <= 0) return map
    if (!map[dogId] || date > map[dogId]) {
      map[dogId] = date
    }
    return map
  }, {})
}

export async function listLocalLatestDewormingDatesByDogIds(familyId: string, dogIds: string[]) {
  const dogIdSet = new Set((dogIds || []).map(id => String(id || '').trim()).filter(Boolean))
  if (!familyId || dogIdSet.size === 0) return {} as Record<string, number>

  const records = await localDb.query<HealthRecord & { deleted_at?: number | null }>('health_records', row =>
    row.family_id === familyId
    && row.type === 'deworming'
    && dogIdSet.has(row.dog_id)
    && !row.deleted_at,
  )

  return records.reduce<Record<string, number>>((map, record) => {
    const dogId = String(record.dog_id || '')
    const date = Number(record.date || record.created_at || 0)
    if (!dogId || !Number.isFinite(date) || date <= 0) return map
    if (!map[dogId] || date > map[dogId]) {
      map[dogId] = date
    }
    return map
  }, {})
}

function getMedicationHistorySortTs(task: Record<string, any>) {
  return Number(task?.actual_start_date) || Number(task?.updated_at) || Number(task?.created_at) || 0
}

function getMedicationHistoryStatusRank(task: Record<string, any>) {
  const status = getMedicationDetailStatus(task?.status)
  if (status === 'active') return 0
  if (status === 'completed') return 1
  return 2
}

export async function listLocalDogMedicationHistory(familyId: string, dogId: string) {
  if (!familyId || !dogId) return []
  const tasks = await localDb.query<any>('medication_tasks', row =>
    row.family_id === familyId
    && row.dog_id === dogId
    && !row.deleted_at,
  )

  return tasks
    .map(task => {
      const normalizedTask = normalizeMedicationTaskDetail(task, null)
      const progress = getMedicationTaskProgress(task)
      return {
        ...normalizedTask,
        activity_ts: getMedicationHistorySortTs(task),
        progress: normalizedTask.status === 'active'
          ? {
              current: Math.min(progress.currentDay, progress.totalDays),
              total: progress.totalDays,
            }
          : null,
      }
    })
    .sort((left, right) => {
      const rankDiff = getMedicationHistoryStatusRank(left) - getMedicationHistoryStatusRank(right)
      if (rankDiff !== 0) return rankDiff
      return getMedicationHistorySortTs(right) - getMedicationHistorySortTs(left)
    })
}

export async function getLocalTaskById(familyId: string, taskId: string): Promise<Task | null> {
  if (!familyId || !taskId) return null
  const task = await localDb.findById<Task & { deleted_at?: number | null }>('tasks', taskId)
  if (!task || (task as any).family_id !== familyId || (task as any).deleted_at) return null
  return task
}

export async function listLocalTasksByIds(familyId: string, taskIds: string[]): Promise<Task[]> {
  if (!familyId || !Array.isArray(taskIds) || taskIds.length === 0) return []
  const taskIdSet = new Set(taskIds.filter(Boolean))
  const tasks = await localDb.query<Task & { deleted_at?: number | null }>('tasks', row =>
    (row as any).family_id === familyId
    && taskIdSet.has(row._id)
    && !(row as any).deleted_at,
  )
  const orderMap = new Map(taskIds.map((id, index) => [id, index]))
  return tasks.sort((left, right) => (orderMap.get(left._id) ?? 0) - (orderMap.get(right._id) ?? 0))
}

export async function findLocalDuplicateIllnesses(
  familyId: string,
  dogIds: string[],
  condition: string,
  excludeRecordId = '',
) {
  if (!familyId || !dogIds.length || !condition.trim()) return []
  const dogIdSet = new Set(dogIds.filter(Boolean))
  const normalizedCondition = condition.trim()
  const rows = await localDb.query<any>('health_records', row => {
    if (row.family_id !== familyId) return false
    if (row.deleted_at) return false
    if (row.type !== 'illness') return false
    if (!dogIdSet.has(row.dog_id)) return false
    if (excludeRecordId && row._id === excludeRecordId) return false
    const treatmentStatus = String(row?.details?.treatment_status || '观察中').trim()
    if (treatmentStatus === '已康复') return false
    const rowCondition = String(row?.details?.primary_condition || row?.details?.condition || '').trim()
    return rowCondition === normalizedCondition
  }, { sort: sortByRecent })

  return rows.map((row) => ({
    dogId: row.dog_id,
    recordId: row._id,
    condition: String(row?.details?.primary_condition || row?.details?.condition || '').trim(),
  }))
}

export async function findLocalDuplicateMedicationTasks(
  familyId: string,
  dogIds: string[],
  drugName: string,
) {
  if (!familyId || !dogIds.length || !drugName.trim()) return []
  const dogIdSet = new Set(dogIds.filter(Boolean))
  const normalizedDrugName = drugName.trim().toLowerCase()
  const tasks = await localDb.query<any>('medication_tasks', row =>
    row.family_id === familyId
    && !row.deleted_at,
  )

  return tasks
    .map(task => normalizeMedicationTaskDetail(task, null))
    .filter(task => dogIdSet.has(task.dog_id))
    .filter(task => task.status === 'active')
    .filter(task => String(task.drug_name || '').trim().toLowerCase() === normalizedDrugName)
    .sort((left, right) => sortByRecent(left, right))
    .map((task) => {
      const progress = getMedicationTaskProgress(task)

      return {
        dog_id: task.dog_id,
        dog_name: task.dog_name || '',
        dogName: task.dog_name || '',
        task_id: task._id,
        task_name: task.drug_name || '',
        start_date: task.start_date || null,
        status: task.status,
        day: Math.min(progress.currentDay, progress.totalDays),
        totalDays: progress.totalDays,
      }
    })
}

function getMedicationDetailStatus(status?: string) {
  if (status === '已完成' || status === 'completed') return 'completed'
  if (status === '已取消' || status === 'cancelled') return 'cancelled'
  return 'active'
}

function calculateMedicationCompletion(task: Record<string, any>) {
  const durationDays = Math.max(1, Number(task?.duration_days) || 1)
  const frequency = Math.max(1, Number(task?.frequency) || 1)
  const dailyDoses = task?.daily_doses || {}
  let completedDoseCount = 0

  for (let day = 1; day <= durationDays; day += 1) {
    completedDoseCount += Math.min(Number(dailyDoses[String(day)]) || 0, frequency)
  }

  return {
    completedDoseCount,
    totalDoseCount: durationDays * frequency,
  }
}

function normalizeMedicationTaskDetail(task: Record<string, any>, protocolName: string | null) {
  const durationDays = Math.max(1, Number(task?.duration_days) || 1)
  const startDate = startOfDay(task?.actual_start_date || task?.start_date || task?.created_at || Date.now())
  const endDate = task?.end_date || (startDate + ((durationDays - 1) * 86400000))
  const frequency = Math.max(1, Number(task?.frequency) || 1)
  const completion = calculateMedicationCompletion(task)
  const completedDateSet = new Set<number>()
  const completedMap: Record<string, { name: string; time: string }> = {}

  if (Array.isArray(task?.completed_dates)) {
    task.completed_dates.forEach((item: unknown) => {
      if (typeof item !== 'number') return
      completedDateSet.add(startOfDay(item))
    })
  }

  const dailyDoses = task?.daily_doses || {}
  Object.entries(dailyDoses).forEach(([dayKey, rawValue]) => {
    const dayNum = Number(dayKey)
    const dosesGiven = Number(rawValue) || 0
    if (!dayNum || dosesGiven < frequency) return
    const dayTs = startDate + ((dayNum - 1) * 86400000)
    completedDateSet.add(dayTs)
    completedMap[String(dayTs)] = {
      name: `已完成${Math.min(dosesGiven, frequency)}/${frequency}次`,
      time: '',
    }
  })

  if (task?.completed_map && typeof task.completed_map === 'object') {
    Object.entries(task.completed_map).forEach(([key, value]) => {
      const dayTs = Number(key)
      if (!dayTs || !value || typeof value !== 'object') return
      const valueObject = value as Record<string, any>
      completedMap[String(dayTs)] = {
        name: valueObject.name || valueObject.label || '',
        time: valueObject.time || '',
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
    status: getMedicationDetailStatus(task?.status),
    completed_dates: Array.from(completedDateSet).sort((a, b) => a - b),
    completed_map: completedMap,
    completed_dose_count: completion.completedDoseCount,
    total_dose_count: completion.totalDoseCount,
    is_fully_completed: completion.completedDoseCount >= completion.totalDoseCount,
    protocol_name: protocolName || task?.protocol_name || null,
  } as Record<string, any>
}

function normalizeIllnessSymptomTags(tags: unknown) {
  if (!Array.isArray(tags)) return []
  return Array.from(new Set(tags
    .map(item => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean)))
}

function isActiveIllnessRecord(record: Record<string, any>) {
  return record?.type === 'illness'
    && !record?.deleted_at
    && (record?.details?.treatment_status || '观察中') !== '已康复'
}

function buildLinkedIllnessSummary(record?: Record<string, any> | null) {
  if (!record) return null
  const symptomTags = normalizeIllnessSymptomTags(record?.details?.symptom_tags)
  return {
    recordId: record._id,
    title: getIllnessPrimaryCondition(record?.details || record),
    treatmentStatus: record?.details?.treatment_status || '观察中',
    symptomSummary: symptomTags.join(' / '),
    date: Number(record?.date || 0) || null,
  }
}

function buildLinkedMedicationTaskSummary(task: Record<string, any>) {
  const normalized = normalizeMedicationTaskDetail(task, null)
  return {
    taskId: normalized._id,
    medicationName: normalized.drug_name || normalized.details?.drug_name || '用药任务',
    status: normalized.status,
    startedAt: normalized.start_date,
    endedAt: normalized.status === 'completed' ? normalized.end_date : null,
    todayCompleted: normalized.completed_dates.includes(startOfDay(Date.now())),
  }
}

export async function getLocalHealthRecordDetail(familyId: string, recordId: string) {
  if (!familyId || !recordId) return null
  const [record, dogs, medicationTasks] = await Promise.all([
    localDb.findById<HealthRecord>('health_records', recordId),
    localDb.query<any>('dogs', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<any>('medication_tasks', row =>
      row.family_id === familyId && row.source_record_id === recordId,
      { sort: sortByRecent },
    ),
  ])
  if (!record || record.family_id !== familyId) return null
  const dogMap = new Map(dogs.map(item => [item._id, item]))
  return {
    ...record,
    dog_name: record.dog_name || dogMap.get(record.dog_id)?.name || '',
    linkedMedicationTasks: record.type === 'illness'
      ? medicationTasks.map(buildLinkedMedicationTaskSummary)
      : [],
  }
}

export async function getLocalMedicationTaskDetail(familyId: string, taskId: string) {
  if (!familyId || !taskId) return null
  const [task, protocols, illnesses] = await Promise.all([
    localDb.findById<MedicationTask>('medication_tasks', taskId),
    localDb.query<any>('medication_protocols', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<any>('health_records', row => row.family_id === familyId && row.type === 'illness' && !row.deleted_at),
  ])
  if (!task || task.family_id !== familyId) return null
  const protocolName = protocols.find(item => item._id === (task as any).protocol_id)?.name || null
  const normalizedTask = normalizeMedicationTaskDetail(task as Record<string, any>, protocolName)

  let linkedIllness = null
  let relationType: 'linked' | 'fallback' | 'standalone' = normalizedTask.source_record_id ? 'linked' : 'standalone'
  if (normalizedTask.source_record_id) {
    linkedIllness = buildLinkedIllnessSummary(illnesses.find(item => item._id === normalizedTask.source_record_id) || null)
  } else {
    const fallback = illnesses
      .filter(item => item.dog_id === task.dog_id)
      .filter(isActiveIllnessRecord)
      .filter(isTreatingIllness)
      .sort(sortByRecent)[0]
    if (fallback) relationType = 'fallback'
  }

  return {
    ...normalizedTask,
    linkedIllness,
    relationType,
  }
}
