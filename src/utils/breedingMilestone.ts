const DAY_MS = 86400000

export type BreedingMilestoneSuggestionStatus = 'normal' | 'window_due' | 'window_passed'

export interface BreedingMilestoneViewModel {
  stepType: string
  stageTitle: string
  anchorLabel: string
  daysFromAnchor: number | null
  dayLabel: string
  suggestionStatus: BreedingMilestoneSuggestionStatus
  suggestionLabel: string
  referenceDateLabel: string
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
    getAnchorDate: (task) => (typeof task.due_date === 'number' ? task.due_date - 10 * DAY_MS : null),
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
  weaning_confirm: {
    stageTitle: '确认断奶',
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
    ? Math.max(1, Math.floor((startOfDay(now) - startOfDay(anchorDate)) / DAY_MS))
    : null
  const suggestionStatus = getSuggestionStatus(dueDate, now)
  const actionLabel = meta?.actionLabel || '处理'

  return {
    stepType,
    stageTitle: meta?.stageTitle || getFallbackStageTitle(task.title),
    anchorLabel: meta?.anchorLabel || '流程',
    daysFromAnchor,
    dayLabel: buildDayLabel(meta?.anchorLabel || '流程', daysFromAnchor),
    suggestionStatus,
    suggestionLabel: buildSuggestionLabel(suggestionStatus, dueDate, actionLabel, now),
    referenceDateLabel: dueDate ? `建议日期 · ${formatMonthDay(dueDate)}` : '建议日期待确认',
  }
}

function getStepType(task: BreedingMilestoneTaskLike): string {
  const stepType = task.details?.step_type
  return typeof stepType === 'string' && stepType ? stepType : 'other'
}

function getSuggestionStatus(dueDate: number | null, now: number): BreedingMilestoneSuggestionStatus {
  if (!dueDate) return 'normal'
  const diffDays = Math.floor((startOfDay(now) - startOfDay(dueDate)) / DAY_MS)
  if (diffDays > 0) return 'window_passed'
  if (diffDays === 0) return 'window_due'
  return 'normal'
}

function buildSuggestionLabel(
  status: BreedingMilestoneSuggestionStatus,
  dueDate: number | null,
  actionLabel: string,
  now: number,
): string {
  if (!dueDate) return `建议尽快${actionLabel}`

  if (status === 'window_due') return `建议今日${actionLabel}`
  if (status === 'window_passed') {
    const passedDays = Math.max(1, Math.floor((startOfDay(now) - startOfDay(dueDate)) / DAY_MS))
    return `建议日期已过 ${passedDays} 天`
  }

  return `建议日期 ${formatMonthDay(dueDate)}`
}

function buildDayLabel(anchorLabel: string, daysFromAnchor: number | null): string {
  if (!daysFromAnchor) return `${anchorLabel}时间待确认`
  return `距${anchorLabel}第 ${daysFromAnchor} 天`
}

function getFallbackStageTitle(title?: string): string {
  if (!title) return '繁育流程'
  const parts = title.split('·').map(part => part.trim()).filter(Boolean)
  return parts[parts.length - 1] || title
}

function formatMonthDay(ts: number): string {
  const date = new Date(ts)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function startOfDay(ts: number): number {
  const date = new Date(ts)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
