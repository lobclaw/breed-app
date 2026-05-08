import { getBeijingDayDiff, getBeijingDayStart } from '@/utils/date'

const DAY_MS = 86400000

export type MedicationDayState = 'done' | 'pending' | 'missed' | 'future'
export type MedicationTodayProgress = 'empty' | 'partial' | 'done'

interface MedicationStateTask {
  _id?: string
  status?: string
  start_date?: number
  actual_start_date?: number
  duration_days?: number
  currentDay?: number
  doses_given?: number
  daily_doses?: Record<string, number>
  completed_dates?: number[]
  details?: {
    frequency?: number
    total_days?: number
  }
  frequency?: number
}

interface MedicationStateOptions {
  todayTs?: number
  localTodayDoses?: number
}

export function startOfMedicationDay(ts: number): number {
  return getBeijingDayStart(ts)
}

export function getMedicationFrequency(task: MedicationStateTask | null | undefined): number {
  return task?.details?.frequency || task?.frequency || 1
}

export function getMedicationStartDate(task: MedicationStateTask | null | undefined): number | null {
  const ts = task?.actual_start_date || task?.start_date
  return typeof ts === 'number' ? startOfMedicationDay(ts) : null
}

export function getMedicationDurationDays(task: MedicationStateTask | null | undefined): number {
  return task?.duration_days || task?.details?.total_days || 1
}

export function getMedicationDayIndex(task: MedicationStateTask | null | undefined, dayTs: number): number | null {
  const startTs = getMedicationStartDate(task)
  if (startTs === null) return null
  return getBeijingDayDiff(dayTs, startTs) + 1
}

function getMedicationDoseForDay(
  task: MedicationStateTask | null | undefined,
  dayTs: number,
  options: MedicationStateOptions = {},
): number {
  if (!task) return 0

  const normalizedDayTs = startOfMedicationDay(dayTs)
  const todayTs = options.todayTs ?? startOfMedicationDay(Date.now())
  const dayIndex = getMedicationDayIndex(task, normalizedDayTs)

  if (dayIndex !== null && dayIndex >= 1) {
    const dailyDoses = task.daily_doses?.[String(dayIndex)]
    if (typeof dailyDoses === 'number') {
      if (normalizedDayTs === todayTs && typeof options.localTodayDoses === 'number') {
        return options.localTodayDoses
      }
      return dailyDoses
    }
  }

  if (Array.isArray(task.completed_dates) && task.completed_dates.includes(normalizedDayTs)) {
    return getMedicationFrequency(task)
  }

  if (
    normalizedDayTs === todayTs
    && typeof options.localTodayDoses === 'number'
  ) {
    return options.localTodayDoses
  }

  if (
    typeof task.currentDay === 'number'
    && dayIndex === task.currentDay
    && typeof task.doses_given === 'number'
  ) {
    return task.doses_given
  }

  return 0
}

export function getMedicationTodayProgress(
  task: MedicationStateTask | null | undefined,
  options: MedicationStateOptions = {},
): MedicationTodayProgress {
  if (!task) return 'empty'
  if (task.status === 'completed') return 'done'

  const frequency = getMedicationFrequency(task)
  const doses = getMedicationDoseForDay(task, options.todayTs ?? startOfMedicationDay(Date.now()), options)

  if (doses >= frequency) return 'done'
  if (doses > 0) return 'partial'
  return 'empty'
}

export function getMedicationDayState(
  task: MedicationStateTask | null | undefined,
  dayTs: number,
  options: MedicationStateOptions = {},
): MedicationDayState {
  const normalizedDayTs = startOfMedicationDay(dayTs)
  const todayTs = options.todayTs ?? startOfMedicationDay(Date.now())
  const dayIndex = getMedicationDayIndex(task, normalizedDayTs)
  const durationDays = getMedicationDurationDays(task)

  if (dayIndex === null || dayIndex < 1 || dayIndex > durationDays) {
    return normalizedDayTs > todayTs ? 'future' : 'pending'
  }

  const frequency = getMedicationFrequency(task)
  const doses = getMedicationDoseForDay(task, normalizedDayTs, options)
  if (doses >= frequency) return 'done'
  if (normalizedDayTs > todayTs) return 'future'
  if (normalizedDayTs === todayTs) return 'pending'
  return 'missed'
}

export function hasMedicationMissedHistory(
  task: MedicationStateTask | null | undefined,
  options: MedicationStateOptions = {},
): boolean {
  const startTs = getMedicationStartDate(task)
  if (startTs === null) return false

  const todayTs = options.todayTs ?? startOfMedicationDay(Date.now())
  const currentDayIndex = getMedicationDayIndex(task, todayTs)
  if (currentDayIndex === null || currentDayIndex <= 1) return false

  const lastHistoryDay = Math.min(currentDayIndex - 1, getMedicationDurationDays(task))
  for (let day = 1; day <= lastHistoryDay; day += 1) {
    const dayTs = startTs + (day - 1) * DAY_MS
    if (getMedicationDayState(task, dayTs, { todayTs }) === 'missed') {
      return true
    }
  }
  return false
}
