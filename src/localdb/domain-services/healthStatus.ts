import type { DeriveStatus } from '@/types/dog'
import { getBeijingDateParts, getBeijingDayStart, getBeijingOrdinalDay } from '@/utils/date'

const LIST_STATUS_PRIORITY: Record<string, number> = {
  生病中: 0,
  用药中: 1,
  怀孕中: 2,
  哺乳中: 3,
  发情中: 4,
  正常: 5,
}

const DETAIL_STATUS_PRIORITY: Record<string, number> = {
  生病中: 0,
  用药中: 1,
  怀孕中: 2,
  哺乳中: 3,
  发情中: 4,
  正常: 5,
}

const MEDICATION_DOSAGE_UNIT_MAP: Record<string, string> = {
  ml: 'ml',
  mg: 'mg',
  tablet: '片',
}

const MEDICATION_METHOD_MAP: Record<string, string> = {
  oral: '口服',
  injection: '注射',
  topical: '外用',
  other: '其他',
}

export function sortListStatuses(statuses: DeriveStatus[] = []) {
  return [...statuses].sort((a, b) => {
    const left = LIST_STATUS_PRIORITY[a.type] ?? 99
    const right = LIST_STATUS_PRIORITY[b.type] ?? 99
    return left - right
  })
}

export function sortDetailStatuses(statuses: DeriveStatus[] = []) {
  return [...statuses].sort((a, b) => {
    const left = DETAIL_STATUS_PRIORITY[a.type] ?? 99
    const right = DETAIL_STATUS_PRIORITY[b.type] ?? 99
    if (left !== right) return left - right
    return Number(b.activityTs || 0) - Number(a.activityTs || 0)
  })
}

function startOfDay(ts: number) {
  return getBeijingDayStart(Number.isFinite(Number(ts)) ? Number(ts) : Date.now())
}

function formatMonthDay(ts?: number): string {
  if (!ts) return '--'
  const parts = getBeijingDateParts(ts)
  const month = String(parts.month).padStart(2, '0')
  const day = String(parts.day).padStart(2, '0')
  return `${month}月${day}日`
}

function normalizeIllnessLabel(label: unknown) {
  return typeof label === 'string' && label.trim() ? label.trim() : '生病中'
}

export function getIllnessPrimaryCondition(source: Record<string, any> = {}) {
  return normalizeIllnessLabel(source.primary_condition || source.condition || '生病中')
}

function getIllnessDayCount(startTs: number, nowTs = Date.now()) {
  return getBeijingOrdinalDay(startTs, nowTs)
}

export function isTreatingIllness(illness: any) {
  return String(illness?.details?.treatment_status || '观察中').trim() === '治疗中'
}

function buildIllnessRelationType(illness: any, activeMedicationTasks: any[]) {
  if (!isTreatingIllness(illness)) return 'standalone'
  const illnessId = illness?._id
  if (activeMedicationTasks.some(task => task?.source_record_id === illnessId)) return 'linked'
  if (activeMedicationTasks.some(task => !task?.source_record_id)) return 'fallback'
  return 'standalone'
}

function getIllnessRelationLabel(relationType: 'linked' | 'fallback' | 'standalone') {
  if (relationType === 'linked') return '关联用药'
  if (relationType === 'fallback') return '可能关联当前用药'
  return '未关联用药'
}

export function buildListIllnessStatuses(illnesses: any[] = [], activeMedicationTasks: any[] = []): DeriveStatus[] {
  const sortedRecords = [...illnesses].sort((a, b) => (b.updated_at || b.date || b.created_at || 0) - (a.updated_at || a.date || a.created_at || 0))
  const labels: string[] = []
  const seen = new Set<string>()
  let firstRecordId = ''

  for (const illness of sortedRecords) {
    const label = getIllnessPrimaryCondition(illness.details || {})
    if (seen.has(label)) continue
    seen.add(label)
    labels.push(label)
    if (!firstRecordId) firstRecordId = illness._id
  }

  if (!labels.length) return []

  const latest = sortedRecords[0]
  const illnessStartTs = latest?.details?.start_date || latest?.date || latest?.created_at || 0
  const illnessDay = labels.length === 1 ? getIllnessDayCount(illnessStartTs) : null
  const relationType = buildIllnessRelationType(latest, activeMedicationTasks)
  const meta = [
    ...(relationType === 'standalone' ? [] : [{ icon: 'link', text: getIllnessRelationLabel(relationType) }]),
    ...(illnessDay ? [{ icon: 'schedule', text: `第${illnessDay}天` }] : []),
  ]
  const label = labels.length === 1
    ? labels[0]
    : labels.length === 2
      ? `${labels[0]}/${labels[1]}`
      : `${labels[0]}/${labels[1]}等${labels.length}项`

  return [{
    type: '生病中',
    label,
    count: labels.length,
    recordId: firstRecordId,
    relationType,
    activityTs: latest?.updated_at || latest?.date || latest?.created_at || 0,
    meta,
  }]
}

export function buildDetailIllnessStatuses(illnesses: any[] = [], activeMedicationTasks: any[] = []): DeriveStatus[] {
  const sortedRecords = [...illnesses].sort((a, b) => (b.updated_at || b.date || b.created_at || 0) - (a.updated_at || a.date || a.created_at || 0))

  return sortedRecords.map((illness) => {
    const symptomTags = Array.isArray(illness?.details?.symptom_tags)
      ? illness.details.symptom_tags
        .map((item: unknown) => typeof item === 'string' ? item.trim() : '')
        .filter(Boolean)
      : []
    const symptomSummary = symptomTags.length <= 2
      ? symptomTags.join(' / ')
      : `${symptomTags.slice(0, 2).join(' / ')} 等${symptomTags.length}项`
    const treatmentStatus = illness?.details?.treatment_status || '观察中'
    const relationType = buildIllnessRelationType(illness, activeMedicationTasks)

    return {
      type: '生病中',
      label: getIllnessPrimaryCondition(illness.details || {}),
      count: 1,
      recordId: illness._id,
      relationType,
      activityTs: illness?.updated_at || illness?.date || illness?.created_at || 0,
      detail: symptomSummary || treatmentStatus,
      meta: [
        ...(relationType === 'standalone' ? [] : [{ icon: 'link', text: getIllnessRelationLabel(relationType) }]),
      ],
    } as DeriveStatus
  })
}

export function getMedicationTaskProgress(task: any, nowTs = Date.now()) {
  const startTs = startOfDay(task?.actual_start_date || task?.start_date || task?.created_at || nowTs)
  const todayTs = startOfDay(nowTs)
  const totalDays = Math.max(1, Number(task?.duration_days) || 1)
  const currentDay = getBeijingOrdinalDay(startTs, todayTs) || 0

  return {
    currentDay,
    totalDays,
  }
}

export function isMedicationTaskActive(task: any, nowTs = Date.now()) {
  if (task?.status !== '进行中') return false
  const { currentDay, totalDays } = getMedicationTaskProgress(task, nowTs)
  return currentDay >= 1 && currentDay <= totalDays
}

function pickPreferredMedicationTask(currentTask: any, nextTask: any) {
  if (!currentTask) return nextTask

  const currentStartTs = currentTask?.actual_start_date || currentTask?.updated_at || currentTask?.created_at || 0
  const nextStartTs = nextTask?.actual_start_date || nextTask?.updated_at || nextTask?.created_at || 0
  if (nextStartTs !== currentStartTs) {
    return nextStartTs > currentStartTs ? nextTask : currentTask
  }

  const currentUpdatedTs = currentTask?.updated_at || currentTask?.created_at || 0
  const nextUpdatedTs = nextTask?.updated_at || nextTask?.created_at || 0
  return nextUpdatedTs > currentUpdatedTs ? nextTask : currentTask
}

function buildMedicationRelationType(task: any, illnesses: any[]) {
  if (task?.source_record_id) return 'linked'
  if (illnesses.some(illness => isTreatingIllness(illness))) return 'fallback'
  return 'standalone'
}

function getMedicationRelationLabel(relationType: 'linked' | 'fallback' | 'standalone') {
  if (relationType === 'linked') return '关联疾病'
  if (relationType === 'fallback') return '可能关联当前疾病'
  return '独立用药'
}

function formatMedicationDose(task: any) {
  if (task?.dosage === null || task?.dosage === undefined || task?.dosage === '') return ''
  const unit = MEDICATION_DOSAGE_UNIT_MAP[task?.dosage_unit] || task?.dosage_unit || ''
  return `${task.dosage}${unit}`
}

function formatMedicationMethod(method: unknown) {
  if (typeof method !== 'string' || !method.trim()) return ''
  return MEDICATION_METHOD_MAP[method] || method
}

function formatMedicationFrequencyLabel(frequency: unknown) {
  const count = Math.max(1, Number(frequency) || 1)
  return `每日${count}次`
}

function getMedicationStartTs(task: any) {
  const startTs = Number(task?.actual_start_date || task?.start_date || task?.created_at || 0)
  return Number.isFinite(startTs) && startTs > 0 ? startTs : null
}

function getMedicationStatusCompletionSummary(task: any) {
  const frequency = Math.max(1, Number(task?.frequency) || 1)
  const durationDays = Math.max(1, Number(task?.duration_days) || 1)
  const dailyDoses = task?.daily_doses || {}
  const completedDates = new Set(Array.isArray(task?.completed_dates) ? task.completed_dates : [])
  const startTs = startOfDay(task?.actual_start_date || task?.start_date || task?.created_at || Date.now())
  let completedDoseCount = 0

  for (let day = 1; day <= durationDays; day += 1) {
    const doses = Number(dailyDoses[String(day)])
    if (Number.isFinite(doses)) {
      completedDoseCount += Math.min(Math.max(0, doses), frequency)
      continue
    }

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

function getMedicationTodayDoseSummary(task: any, nowTs = Date.now()) {
  const frequency = Math.max(1, Number(task?.frequency) || 1)
  const { currentDay } = getMedicationTaskProgress(task, nowTs)
  const todayTs = startOfDay(nowTs)
  const completedDates = new Set(Array.isArray(task?.completed_dates) ? task.completed_dates.map((item: unknown) => startOfDay(Number(item))) : [])
  const dailyDoses = task?.daily_doses || {}
  const completedCount = completedDates.has(todayTs)
    ? frequency
    : Math.min(Math.max(0, Number(dailyDoses[String(currentDay)]) || 0), frequency)

  return {
    completedCount,
    requiredCount: frequency,
  }
}

export function buildListMedicationStatus(tasks: any[] = [], nowTs = Date.now(), activeIllnesses: any[] = []): DeriveStatus[] {
  if (!tasks.length) return []
  const preferredTask = tasks.reduce((currentTask, nextTask) => pickPreferredMedicationTask(currentTask, nextTask), null)
  const { currentDay, totalDays } = getMedicationTaskProgress(preferredTask, nowTs)
  const drugName = preferredTask?.drug_name || preferredTask?.details?.drug_name || '用药'
  const relationType = buildMedicationRelationType(preferredTask, activeIllnesses)

  return [{
    type: '用药中',
    label: '用药中',
    count: tasks.length,
    taskId: preferredTask?._id,
    detail: drugName,
    relationType,
    progress: { current: Math.min(currentDay, totalDays), total: totalDays },
    meta: relationType === 'standalone' ? [] : [{ icon: 'link', text: getMedicationRelationLabel(relationType) }],
    activityTs: preferredTask?.updated_at || preferredTask?.created_at || 0,
  }]
}

export function buildDetailMedicationStatuses(tasks: any[] = [], nowTs = Date.now(), activeIllnesses: any[] = []): DeriveStatus[] {
  const taskByDrug = new Map<string, any>()

  for (const task of tasks) {
    const drugName = task?.drug_name || task?.details?.drug_name || '用药'
    taskByDrug.set(drugName, pickPreferredMedicationTask(taskByDrug.get(drugName), task))
  }

  return Array.from(taskByDrug.values()).map((task) => {
    const { currentDay, totalDays } = getMedicationTaskProgress(task, nowTs)
    const relationType = buildMedicationRelationType(task, activeIllnesses)
    const { frequency } = getMedicationStatusCompletionSummary(task)
    const todayDose = getMedicationTodayDoseSummary(task, nowTs)
    const drugName = task?.drug_name || task?.details?.drug_name || '用药'
    const detail = [
      drugName,
      formatMedicationDose(task),
      formatMedicationMethod(task?.method),
      formatMedicationFrequencyLabel(frequency),
    ].filter(Boolean).join(' · ')

    return {
      type: '用药中',
      label: '用药中',
      taskId: task?._id,
      detail,
      relationType,
      progress: task?.duration_days
        ? { current: Math.min(currentDay, totalDays), total: totalDays }
        : undefined,
      meta: [
        { icon: 'link', text: getMedicationRelationLabel(relationType) },
        { icon: 'check_circle', text: `今日完成 ${todayDose.completedCount}/${todayDose.requiredCount} 次` },
        ...(getMedicationStartTs(task) ? [{ icon: 'event', text: `开始于 ${formatMonthDay(getMedicationStartTs(task) || 0)}` }] : []),
      ],
      activityTs: task?.updated_at || task?.created_at || 0,
    } as DeriveStatus
  })
}
