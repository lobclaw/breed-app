import type { BreedingCycleFormContext } from '@/localdb/domain-repository'
import { getBeijingDateParts, getBeijingDayDiff } from '@/utils/date'

export interface BreedingStageTag {
  label: string
  tone: 'heat' | 'pregnant'
}

function formatDate(ts?: number | null) {
  if (!ts) return ''
  const parts = getBeijingDateParts(ts)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function formatMonthDay(ts?: number | null) {
  if (!ts) return ''
  const parts = getBeijingDateParts(ts)
  return `${parts.month}月${parts.day}日`
}

function buildDueRemainText(dueDate: number, now = Date.now()) {
  const diff = getBeijingDayDiff(dueDate, now)
  if (diff > 0) return `剩${diff}天`
  if (diff === 0) return '今天'
  return `已过${Math.abs(diff)}天`
}

export function buildBreedingCycleMetaText(context?: BreedingCycleFormContext | null, now = Date.now()) {
  if (!context) return ''
  const cycleText = context.cycle_number ? `第${context.cycle_number}次繁育` : '繁育周期'

  if (context.expected_due_date) {
    return [
      cycleText,
      `预产期 ${formatMonthDay(context.expected_due_date)}`,
      buildDueRemainText(context.expected_due_date, now),
    ].filter(Boolean).join(' · ')
  }

  if (context.heat_date) {
    return `${cycleText} · 上次发情：${formatDate(context.heat_date)}`
  }

  return context.status ? `${cycleText} · ${context.status}` : cycleText
}

export function buildBreedingStageTag(dog: Record<string, any> | null | undefined, cycleId = ''): BreedingStageTag | null {
  const statuses = dog && Array.isArray(dog.statuses) ? dog.statuses : []
  const breedingStatuses = statuses.filter((status: any) => status?.type === '发情中' || status?.type === '怀孕中')
  const status = cycleId
    ? breedingStatuses.find((item: any) => item?.cycleId === cycleId) || breedingStatuses[0]
    : breedingStatuses[0]
  if (!status) return null

  const day = Number(status?.progress?.current || 0)
  const dayText = Number.isFinite(day) && day > 0 ? `第${Math.floor(day)}天` : ''
  if (status.type === '发情中') {
    return { label: dayText ? `发情${dayText}` : '发情中', tone: 'heat' }
  }
  return { label: dayText ? `怀孕${dayText}` : '怀孕中', tone: 'pregnant' }
}

export function buildBreedingStageTagFromContext(context?: BreedingCycleFormContext | null, now = Date.now()): BreedingStageTag | null {
  if (!context) return null
  if (context.status === '发情中') {
    const day = context.heat_date ? getBeijingDayDiff(now, context.heat_date) + 1 : 0
    return { label: day > 0 ? `发情第${day}天` : '发情中', tone: 'heat' }
  }
  if (context.status === '怀孕中') {
    const day = context.mated_at ? getBeijingDayDiff(now, context.mated_at) + 1 : 0
    return { label: day > 0 ? `怀孕第${day}天` : '怀孕中', tone: 'pregnant' }
  }
  return null
}
