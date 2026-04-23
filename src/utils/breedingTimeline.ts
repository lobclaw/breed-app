import type { BreedingCycle, BreedingRecord } from '@/types/breeding'
import { getBeijingDayStart } from '@/utils/date'
import { buildCompactBreedingCycleStatusTitle, getBreedingCycleCurrentDayCount } from '@/utils/dogStatusCopy'

export type BreedingTimelineKind = 'upcoming' | 'current' | 'record'
export type BreedingTimelineTone = 'amber' | 'teal' | 'rose' | 'green' | 'blue' | 'gray' | 'red'

export interface BreedingTimelineSyntheticItem {
  key: string
  kind: 'upcoming' | 'current'
  type: 'upcoming' | 'current'
  tone: BreedingTimelineTone
  title: string
  summary: string
  date: number
}

const DAY_MS = 86400000

function startOfDay(ts: number) {
  return getBeijingDayStart(ts)
}

function formatDate(ts?: number | null) {
  if (typeof ts !== 'number') return '—'
  const date = new Date(ts)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getBreedingTimelineRecordTone(type?: string | null): BreedingTimelineTone {
  const map: Record<string, BreedingTimelineTone> = {
    heat: 'amber',
    heat_observation: 'amber',
    follicle_check: 'teal',
    mating: 'rose',
    pregnancy_check: 'green',
    prenatal_check: 'blue',
    pre_labor: 'amber',
    birth: 'green',
    abnormal_termination: 'red',
  }
  return map[type || ''] || 'gray'
}

export function getBreedingTimelineStatusTone(status?: string | null): BreedingTimelineTone {
  if (status === '发情中') return 'amber'
  if (status === '怀孕中') return 'rose'
  if (status === '已生产') return 'green'
  if (status === '失败' || status === '放弃') return 'red'
  return 'gray'
}

export function getBreedingTimelineSortTimestamp(record: BreedingRecord) {
  return typeof record.date === 'number'
    ? record.date
    : (record.updated_at || record.created_at || 0)
}

export function getLatestBreedingRecord(records: BreedingRecord[], type: string) {
  return records
    .filter(record => record.type === type)
    .sort((a, b) => {
      const dateDiff = getBreedingTimelineSortTimestamp(b) - getBreedingTimelineSortTimestamp(a)
      if (dateDiff !== 0) return dateDiff
      return `${b._id || ''}`.localeCompare(`${a._id || ''}`)
    })[0] || null
}

export function getEarliestBreedingRecord(records: BreedingRecord[], type: string) {
  return records
    .filter(record => record.type === type)
    .sort((a, b) => {
      const dateDiff = getBreedingTimelineSortTimestamp(a) - getBreedingTimelineSortTimestamp(b)
      if (dateDiff !== 0) return dateDiff
      return `${a._id || ''}`.localeCompare(`${b._id || ''}`)
    })[0] || null
}

export function getOrderedMatingRecords(records: BreedingRecord[]) {
  return records
    .filter(record => record.type === 'mating')
    .sort((a, b) => {
      const dateDiff = getBreedingTimelineSortTimestamp(a) - getBreedingTimelineSortTimestamp(b)
      if (dateDiff !== 0) return dateDiff
      return `${a._id || ''}`.localeCompare(`${b._id || ''}`)
    })
}

export function getBreedingTimelineExpectedDueDate(
  cycle?: BreedingCycle | null,
  records: BreedingRecord[] = [],
) {
  const latestMating = getLatestBreedingRecord(records, 'mating')
  const dueDate = latestMating?.details?.expected_due_date
  if (typeof dueDate === 'number') return dueDate

  const matingTs = cycle?.mated_at || latestMating?.date
  return typeof matingTs === 'number' ? matingTs + 59 * DAY_MS : null
}

export function buildBreedingTimelineCurrentTitle(
  cycle?: BreedingCycle | null,
  records: BreedingRecord[] = [],
  now = Date.now(),
) {
  return buildCompactBreedingCycleStatusTitle(cycle, records, now)
}

function buildBreedingTimelineCurrentSummary(cycle?: BreedingCycle | null, records: BreedingRecord[] = []) {
  if (!cycle?.status) return ''

  if (cycle.status === '发情中') {
    const startTs = cycle.start_date || cycle.created_at
    return typeof startTs === 'number' ? `开始于 ${formatDate(startTs)}` : '当前周期进行中'
  }

  if (cycle.status === '怀孕中') {
    const dueDate = getBreedingTimelineExpectedDueDate(cycle, records)
    if (typeof dueDate === 'number') return `预产期 ${formatDate(dueDate)}`

    const latestMating = getLatestBreedingRecord(records, 'mating')
    const matingTs = cycle.mated_at || latestMating?.date
    return typeof matingTs === 'number' ? `配种于 ${formatDate(matingTs)}` : '怀孕进行中'
  }

  return cycle.status
}

function getBreedingTimelineUpcomingTitle(cycle?: BreedingCycle | null, records: BreedingRecord[] = []) {
  if (!cycle?.status) return ''

  if (cycle.status === '怀孕中') return '待产'
  if (cycle.status !== '发情中') return cycle.status

  const follicleRecord = getLatestBreedingRecord(records, 'follicle_check')
  const latestMating = getLatestBreedingRecord(records, 'mating')
  const pregnancyRecord = getLatestBreedingRecord(records, 'pregnancy_check')

  if (!follicleRecord) return '建议卵泡检查'
  if (!latestMating) return '建议配种'
  if (!pregnancyRecord) return '建议孕检'
  return '待产'
}

function formatRelativeDayLabel(targetTs: number, now = Date.now()) {
  const diffDays = Math.floor((startOfDay(targetTs) - startOfDay(now)) / DAY_MS)
  if (diffDays > 0) return `还有${diffDays}天`
  if (diffDays === 0) return '就在今天'
  return `已过${Math.abs(diffDays)}天`
}

function buildBreedingTimelineUpcomingSummary(
  cycle?: BreedingCycle | null,
  records: BreedingRecord[] = [],
  now = Date.now(),
) {
  const upcomingTitle = getBreedingTimelineUpcomingTitle(cycle, records)
  if (!upcomingTitle) return ''

  if (upcomingTitle === '待产') {
    const dueDate = getBreedingTimelineExpectedDueDate(cycle, records)
    if (typeof dueDate === 'number') return `预产期 ${formatDate(dueDate)} · ${formatRelativeDayLabel(dueDate, now)}`
    return '预产期待确认'
  }

  if (upcomingTitle === '建议卵泡检查') {
    const dayCount = getBreedingCycleCurrentDayCount(cycle, records, now)
    return dayCount ? `发情第${dayCount}天` : '建议尽快检查'
  }

  if (upcomingTitle === '建议配种') {
    const follicleRecord = getLatestBreedingRecord(records, 'follicle_check')
    if (typeof follicleRecord?.date === 'number') {
      const delta = Math.max(1, Math.floor((startOfDay(now) - startOfDay(follicleRecord.date)) / DAY_MS) + 1)
      return `卵泡检查后第${delta}天`
    }
    return '建议尽快配种'
  }

  if (upcomingTitle === '建议孕检') {
    const latestMating = getLatestBreedingRecord(records, 'mating')
    if (typeof latestMating?.date === 'number') {
      const delta = Math.max(1, Math.floor((startOfDay(now) - startOfDay(latestMating.date)) / DAY_MS) + 1)
      const matingNumber = Number(latestMating.details?.mating_number)
      if (matingNumber > 0) return `距第${matingNumber}脚配种第${delta}天`
      return `距最近配种第${delta}天`
    }
    return '建议尽快孕检'
  }

  return ''
}

export function buildBreedingTimelineSyntheticItems(
  cycle?: BreedingCycle | null,
  records: BreedingRecord[] = [],
  now = Date.now(),
): BreedingTimelineSyntheticItem[] {
  if (!cycle) return []

  const upcomingTitle = getBreedingTimelineUpcomingTitle(cycle, records)
  const currentTitle = buildBreedingTimelineCurrentTitle(cycle, records, now)
  const baseDate = cycle.updated_at || cycle.created_at || now
  const items: BreedingTimelineSyntheticItem[] = []

  if (upcomingTitle) {
    items.push({
      key: 'upcoming',
      kind: 'upcoming',
      type: 'upcoming',
      tone: 'gray',
      title: upcomingTitle,
      summary: buildBreedingTimelineUpcomingSummary(cycle, records, now),
      date: baseDate + 2,
    })
  }

  if (currentTitle) {
    items.push({
      key: 'current',
      kind: 'current',
      type: 'current',
      tone: getBreedingTimelineStatusTone(cycle.status),
      title: currentTitle,
      summary: buildBreedingTimelineCurrentSummary(cycle, records),
      date: baseDate + 1,
    })
  }

  return items
}
