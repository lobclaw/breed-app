import {
  getBeijingDateParts,
  getBeijingDayDiff,
  getBeijingElapsedDays,
  getBeijingOrdinalDay,
} from '@/utils/date'

const DAY_MS = 86400000

export type BreedingMilestoneSuggestionStatus = 'normal' | 'window_due' | 'window_passed'

export interface BreedingMilestoneViewModel {
  stepType: string
  stageTitle: string
  anchorLabel: string
  now: number
  dueDate: number | null
  daysFromAnchor: number | null
  dayLabel: string
  suggestionStatus: BreedingMilestoneSuggestionStatus
  suggestionLabel: string
  referenceDateLabel: string
  heatDayLabel: string
  stageDayLabel: string
  passedWindowLabel: string
  alertLabel: string
  isAlertDanger: boolean
  follicleCheckCount: number
  latestFollicleResult: string
  latestFollicleCheckDate: number | null
  isFollicleAbnormal: boolean
}

interface BreedingMilestoneTaskLike {
  title?: string
  due_date?: number
  details?: Record<string, any> | null
}

interface StepMeta {
  stageTitle: string
  anchorLabel: string
  actionLabel: string
  getAnchorDate: (task: BreedingMilestoneTaskLike) => number | null
}

const STEP_META: Record<string, StepMeta> = {
  follicle_check: {
    stageTitle: '建议卵泡检查',
    anchorLabel: '发情',
    actionLabel: '检查',
    getAnchorDate: (task) => {
      const heatDate = getNumber(task.details?.heat_date)
      if (heatDate) return heatDate
      return typeof task.due_date === 'number' ? task.due_date - 10 * DAY_MS : null
    },
  },
  mating: {
    stageTitle: '配种',
    anchorLabel: '卵泡检查',
    actionLabel: '处理',
    getAnchorDate: (task) => (typeof task.due_date === 'number' ? task.due_date : null),
  },
  pregnancy_check: {
    stageTitle: '建议孕检',
    anchorLabel: '配种',
    actionLabel: '检查',
    getAnchorDate: (task) => {
      const expectedDueDate = getNumber(task.details?.expected_due_date)
      if (expectedDueDate) return expectedDueDate - 59 * DAY_MS

      const expectedCheckupDate = getNumber(task.details?.expected_checkup_date)
      if (expectedCheckupDate) return expectedCheckupDate - 25 * DAY_MS

      return typeof task.due_date === 'number' ? task.due_date - 25 * DAY_MS : null
    },
  },
  birth: {
    stageTitle: '待产',
    anchorLabel: '配种',
    actionLabel: '记录',
    getAnchorDate: (task) => {
      const matingDate = getNumber(task.details?.mating_date)
      if (matingDate) return matingDate

      const expectedDueDate = getNumber(task.details?.expected_due_date)
      if (expectedDueDate) return expectedDueDate - 59 * DAY_MS

      return typeof task.due_date === 'number' ? task.due_date - 59 * DAY_MS : null
    },
  },
  weaning_confirm: {
    stageTitle: '待断奶',
    anchorLabel: '出生',
    actionLabel: '确认',
    getAnchorDate: (task) => {
      const birthDate = getNumber(task.details?.birth_date)
      if (birthDate) return birthDate
      return typeof task.due_date === 'number' ? task.due_date - 45 * DAY_MS : null
    },
  },
}

export function deriveBreedingMilestoneViewModel(
  task: BreedingMilestoneTaskLike,
  now = Date.now(),
): BreedingMilestoneViewModel {
  const stepType = getStepType(task)
  const meta = STEP_META[stepType]
  const dueDate = typeof task.due_date === 'number' ? task.due_date : null
  const anchorDate = meta ? meta.getAnchorDate(task) : null
  const daysFromAnchor = typeof anchorDate === 'number'
    ? getBeijingOrdinalDay(anchorDate, now)
    : null
  const suggestionStatus = getSuggestionStatus(dueDate, now)
  const actionLabel = meta?.actionLabel || '处理'

  return {
    stepType,
    stageTitle: meta?.stageTitle || getFallbackStageTitle(task.title),
    anchorLabel: meta?.anchorLabel || '流程',
    now,
    dueDate,
    daysFromAnchor,
    dayLabel: buildDayLabel(meta?.anchorLabel || '流程', daysFromAnchor),
    suggestionStatus,
    suggestionLabel: buildSuggestionLabel(stepType, suggestionStatus, dueDate, actionLabel, now),
    referenceDateLabel: buildReferenceDateLabel(stepType, dueDate),
    heatDayLabel: buildHeatDayLabel(task, now),
    stageDayLabel: buildStageDayLabel(stepType, task, daysFromAnchor, now),
    passedWindowLabel: buildPassedWindowLabel(stepType, suggestionStatus, dueDate, now),
    alertLabel: buildAlertLabel(stepType, task, suggestionStatus, dueDate, now),
    isAlertDanger: isDangerAlert(stepType, task, suggestionStatus),
    follicleCheckCount: getFollicleCheckCount(task),
    latestFollicleResult: getLatestFollicleResult(task),
    latestFollicleCheckDate: getLatestFollicleCheckDate(task),
    isFollicleAbnormal: !!task.details?.abnormal_result,
  }
}

function getStepType(task: BreedingMilestoneTaskLike): string {
  const stepType = task.details?.step_type
  return typeof stepType === 'string' && stepType ? stepType : 'other'
}

function getSuggestionStatus(dueDate: number | null, now: number): BreedingMilestoneSuggestionStatus {
  if (!dueDate) return 'normal'
  const diffDays = getBeijingDayDiff(now, dueDate)
  if (diffDays > 0) return 'window_passed'
  if (diffDays === 0) return 'window_due'
  return 'normal'
}

function buildSuggestionLabel(
  stepType: string,
  status: BreedingMilestoneSuggestionStatus,
  dueDate: number | null,
  actionLabel: string,
  now: number,
): string {
  if (!dueDate) {
    if (stepType === 'birth') return '预产期待确认'
    if (stepType === 'weaning_confirm') return '预计断奶时间待确认'
    return `建议尽快${actionLabel}`
  }

  if (stepType === 'birth') {
    if (status === 'window_due') return '预产期就在今天'
    if (status === 'window_passed') {
      const passedDays = Math.max(1, getBeijingElapsedDays(dueDate, now))
      return `预产期已过 ${passedDays} 天`
    }

    return `预产期 ${formatMonthDay(dueDate)}`
  }

  if (status === 'window_due') return `建议今日${actionLabel}`
  if (status === 'window_passed') {
    const passedDays = Math.max(1, getBeijingElapsedDays(dueDate, now))
    return `建议日期已过 ${passedDays} 天`
  }

  return `建议日期 ${formatMonthDay(dueDate)}`
}

function buildReferenceDateLabel(stepType: string, dueDate: number | null): string {
  if (!dueDate) {
    if (stepType === 'birth') return '预产期待确认'
    if (stepType === 'weaning_confirm') return '预计断奶时间待确认'
    return '建议日期待确认'
  }
  if (stepType === 'birth') return `预产期 · ${formatMonthDay(dueDate)}`
  if (stepType === 'weaning_confirm') return `预计 ${formatMonthDay(dueDate)}断奶`
  return `建议日期 · ${formatMonthDay(dueDate)}`
}

function buildDayLabel(anchorLabel: string, daysFromAnchor: number | null): string {
  if (!daysFromAnchor) return `${anchorLabel}时间待确认`
  return `${anchorLabel}第 ${daysFromAnchor} 天`
}

function buildHeatDayLabel(task: BreedingMilestoneTaskLike, now: number): string {
  const heatDate = getNumber(task.details?.heat_date)
  if (!heatDate) return ''

  const heatDay = getBeijingOrdinalDay(heatDate, now) || 1
  return `发情第 ${heatDay} 天`
}

function buildStageDayLabel(
  stepType: string,
  task: BreedingMilestoneTaskLike,
  daysFromAnchor: number | null,
  now: number,
): string {
  if (stepType === 'mating') {
    const follicleDate = getNumber(task.details?.follicle_check_date)
    const delta = typeof follicleDate === 'number'
      ? getBeijingOrdinalDay(follicleDate, now)
      : daysFromAnchor
    if (!delta) return ''
    return `卵泡检查后第 ${delta} 天`
  }

  if (stepType === 'pregnancy_check' || stepType === 'birth') {
    const matingNumber = getNumber(task.details?.mating_number)
    if (matingNumber && daysFromAnchor) {
      return `第${matingNumber}脚配种第 ${daysFromAnchor} 天`
    }
  }

  if (stepType === 'weaning_confirm') {
    if (!daysFromAnchor) return '哺乳天数待确认'
    return `哺乳第 ${daysFromAnchor} 天`
  }

  return buildDayLabel(STEP_META[stepType]?.anchorLabel || '流程', daysFromAnchor)
}

function buildPassedWindowLabel(
  stepType: string,
  suggestionStatus: BreedingMilestoneSuggestionStatus,
  dueDate: number | null,
  now: number,
): string {
  if (suggestionStatus !== 'window_passed' || !dueDate) return ''

  const passedDays = Math.max(1, getBeijingElapsedDays(dueDate, now))
  if (stepType === 'mating') return `建议配种窗已过 ${passedDays} 天`
  if (stepType === 'birth') return `预产期已过 ${passedDays} 天`
  if (stepType === 'weaning_confirm') return `预计断奶日已过 ${passedDays} 天`
  return `建议日期已过 ${passedDays} 天`
}

function buildAlertLabel(
  stepType: string,
  task: BreedingMilestoneTaskLike,
  suggestionStatus: BreedingMilestoneSuggestionStatus,
  dueDate: number | null,
  now: number,
) {
  if (stepType === 'follicle_check' && task.details?.abnormal_result) {
    return '本次检查提示发育不良'
  }

  if (stepType === 'mating') {
    return buildPassedWindowLabel(stepType, suggestionStatus, dueDate, now)
  }

  if (suggestionStatus === 'window_passed') {
    return buildSuggestionLabel(stepType, suggestionStatus, dueDate, STEP_META[stepType]?.actionLabel || '处理', now)
  }

  return ''
}

function isDangerAlert(
  stepType: string,
  task: BreedingMilestoneTaskLike,
  suggestionStatus: BreedingMilestoneSuggestionStatus,
) {
  return (stepType === 'follicle_check' && !!task.details?.abnormal_result)
    || suggestionStatus === 'window_passed'
}

function getFallbackStageTitle(title?: string): string {
  if (!title) return '繁育流程'
  const parts = title.split('·').map(part => part.trim()).filter(Boolean)
  return parts[parts.length - 1] || title
}

function formatMonthDay(ts: number): string {
  const date = getBeijingDateParts(ts)
  return `${date.month}月${date.day}日`
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getLatestFollicleCheckDate(task: BreedingMilestoneTaskLike): number | null {
  return getNumber(task.details?.latest_follicle_check_date)
}

function getLatestFollicleResult(task: BreedingMilestoneTaskLike): string {
  return typeof task.details?.follicle_result === 'string' ? task.details.follicle_result : ''
}

function getFollicleCheckCount(task: BreedingMilestoneTaskLike): number {
  const count = getNumber(task.details?.follicle_check_count)
  if (typeof count === 'number' && count >= 0) return Math.floor(count)
  if (getLatestFollicleCheckDate(task)) return 1
  return 0
}
