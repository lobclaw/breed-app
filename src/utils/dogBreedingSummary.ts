import type { BreedingCycle, BreedingRecord, Litter } from '@/types/breeding'

export type ActiveCycleSummaryTimelineKind = 'upcoming' | 'current' | 'record'
export type ActiveCycleSummaryTimelineTone = 'amber' | 'teal' | 'rose' | 'green' | 'blue' | 'gray'

export interface ActiveCycleSummaryTimelineItem {
  key: string
  kind: ActiveCycleSummaryTimelineKind
  type: string
  tone: ActiveCycleSummaryTimelineTone
  title: string
  summary: string
  date: number
}

export interface ActiveCycleSummaryViewModel {
  title: string
  subtitle: string
  timeline: ActiveCycleSummaryTimelineItem[]
  stageSummary: string
}

export interface HistoryCycleSummaryViewModel {
  title: string
  subtitle: string
}

const DAY_MS = 86400000

function startOfDay(ts: number) {
  const date = new Date(ts)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function formatDate(ts?: number | null) {
  if (typeof ts !== 'number') return '—'
  const date = new Date(ts)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatShortDate(ts?: number | null) {
  if (typeof ts !== 'number') return '—'
  const date = new Date(ts)
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function truncateText(text: string, maxLength = 18) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

function getRecordSortTimestamp(record: BreedingRecord) {
  return typeof record.date === 'number'
    ? record.date
    : (record.updated_at || record.created_at || 0)
}

function getLatestRecord(records: BreedingRecord[], type: string) {
  return records
    .filter(record => record.type === type)
    .sort((a, b) => {
      const dateDiff = getRecordSortTimestamp(b) - getRecordSortTimestamp(a)
      if (dateDiff !== 0) return dateDiff
      return `${b._id || ''}`.localeCompare(`${a._id || ''}`)
    })[0] || null
}

function getEarliestRecord(records: BreedingRecord[], type: string) {
  return records
    .filter(record => record.type === type)
    .sort((a, b) => {
      const dateDiff = getRecordSortTimestamp(a) - getRecordSortTimestamp(b)
      if (dateDiff !== 0) return dateDiff
      return `${a._id || ''}`.localeCompare(`${b._id || ''}`)
    })[0] || null
}

function getMatingRecords(records: BreedingRecord[]) {
  return records
    .filter(record => record.type === 'mating')
    .sort((a, b) => {
      const dateDiff = getRecordSortTimestamp(a) - getRecordSortTimestamp(b)
      if (dateDiff !== 0) return dateDiff
      return `${a._id || ''}`.localeCompare(`${b._id || ''}`)
    })
}

function getPregnancyResult(details: Record<string, any> = {}) {
  if (details.result) return String(details.result)
  if (details.confirmed === '是' || details.confirmed === true) return '确认怀孕'
  if (details.confirmed === '否' || details.confirmed === false) return '未怀孕'
  return ''
}

function getPregnancyCount(details: Record<string, any> = {}) {
  const value = Number(details.fetus_count || details.puppy_count || details.count)
  return value > 0 ? value : null
}

function getExpectedDueDate(records: BreedingRecord[]) {
  const latestMating = getLatestRecord(records, 'mating')
  const dueDate = latestMating?.details?.expected_due_date
  if (typeof dueDate === 'number') return dueDate
  return typeof latestMating?.date === 'number' ? latestMating.date + 59 * DAY_MS : null
}

function buildSubtitle(cycle?: BreedingCycle | null) {
  if (!cycle) return ''
  const parts = []
  if (cycle.sire_name) parts.push(`种公: ${cycle.sire_name}`)
  parts.push(cycle.status || '进行中')
  return parts.join(' · ')
}

function buildStageSummary(cycle?: BreedingCycle | null, records: BreedingRecord[] = [], now = Date.now()) {
  if (!cycle?.status) return ''
  const parts = []

  if (cycle.status === '发情中') {
    const startTs = cycle.start_date || cycle.created_at
    if (typeof startTs === 'number') {
      const dayCount = Math.max(1, Math.floor((startOfDay(now) - startOfDay(startTs)) / DAY_MS) + 1)
      parts.push(`发情第${dayCount}天`)
    } else {
      parts.push('发情进行中')
    }
  } else if (cycle.status === '怀孕中') {
    const latestMating = getLatestRecord(records, 'mating')
    const startTs = cycle.mated_at || latestMating?.date
    if (typeof startTs === 'number') {
      const dayCount = Math.max(1, Math.floor((startOfDay(now) - startOfDay(startTs)) / DAY_MS) + 1)
      parts.push(`怀孕第${dayCount}天`)
    } else {
      parts.push('怀孕进行中')
    }
  } else {
    parts.push(cycle.status)
  }

  const dueDate = getExpectedDueDate(records)
  if (typeof dueDate === 'number') {
    parts.push(`预产期 ${formatDate(dueDate)}`)
  }

  return parts.join(' · ')
}

function getCycleTone(status?: string | null): ActiveCycleSummaryTimelineTone {
  if (status === '发情中') return 'amber'
  if (status === '怀孕中') return 'rose'
  if (status === '已生产') return 'green'
  return 'gray'
}

function getCurrentStageDayCount(cycle?: BreedingCycle | null, records: BreedingRecord[] = [], now = Date.now()) {
  if (!cycle?.status) return null

  if (cycle.status === '发情中') {
    const startTs = cycle.start_date || cycle.created_at
    if (typeof startTs !== 'number') return null
    return Math.max(1, Math.floor((startOfDay(now) - startOfDay(startTs)) / DAY_MS) + 1)
  }

  if (cycle.status === '怀孕中') {
    const latestMating = getLatestRecord(records, 'mating')
    const startTs = cycle.mated_at || latestMating?.date
    if (typeof startTs !== 'number') return null
    return Math.max(1, Math.floor((startOfDay(now) - startOfDay(startTs)) / DAY_MS) + 1)
  }

  return null
}

function getUpcomingStageTitle(cycle?: BreedingCycle | null, records: BreedingRecord[] = []) {
  if (!cycle?.status) return ''

  if (cycle.status === '怀孕中') return '待产'
  if (cycle.status !== '发情中') return cycle.status

  const follicleRecord = getLatestRecord(records, 'follicle_check')
  const latestMating = getLatestRecord(records, 'mating')
  const pregnancyRecord = getLatestRecord(records, 'pregnancy_check')

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

function buildUpcomingSummary(cycle?: BreedingCycle | null, records: BreedingRecord[] = [], now = Date.now()) {
  const upcomingTitle = getUpcomingStageTitle(cycle, records)
  if (!upcomingTitle) return ''

  if (upcomingTitle === '待产') {
    const dueDate = getExpectedDueDate(records)
    if (typeof dueDate === 'number') return `预产期 ${formatDate(dueDate)} · ${formatRelativeDayLabel(dueDate, now)}`
    return '预产期待确认'
  }

  if (upcomingTitle === '建议卵泡检查') {
    const dayCount = getCurrentStageDayCount(cycle, records, now)
    return dayCount ? `发情第${dayCount}天` : '建议尽快检查'
  }

  if (upcomingTitle === '建议配种') {
    const follicleRecord = getLatestRecord(records, 'follicle_check')
    if (typeof follicleRecord?.date === 'number') {
      const delta = Math.max(1, Math.floor((startOfDay(now) - startOfDay(follicleRecord.date)) / DAY_MS) + 1)
      return `卵泡检查后第${delta}天`
    }
    return '建议尽快配种'
  }

  if (upcomingTitle === '建议孕检') {
    const latestMating = getLatestRecord(records, 'mating')
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

function buildCurrentStageTitle(cycle?: BreedingCycle | null, records: BreedingRecord[] = [], now = Date.now()) {
  if (!cycle?.status) return ''
  const dayCount = getCurrentStageDayCount(cycle, records, now)
  if (dayCount && (cycle.status === '发情中' || cycle.status === '怀孕中')) {
    return `${cycle.status} · 第${dayCount}天`
  }
  return cycle.status
}

function buildCurrentStageSummary(cycle?: BreedingCycle | null, records: BreedingRecord[] = []) {
  if (!cycle?.status) return ''

  if (cycle.status === '发情中') {
    const startTs = cycle.start_date || cycle.created_at
    return typeof startTs === 'number' ? `开始于 ${formatDate(startTs)}` : '当前周期进行中'
  }

  if (cycle.status === '怀孕中') {
    const dueDate = getExpectedDueDate(records)
    if (typeof dueDate === 'number') return `预产期 ${formatDate(dueDate)}`

    const latestMating = getLatestRecord(records, 'mating')
    const matingTs = cycle.mated_at || latestMating?.date
    return typeof matingTs === 'number' ? `配种于 ${formatDate(matingTs)}` : '怀孕进行中'
  }

  return cycle.status
}

function buildSyntheticTimelineItems(cycle?: BreedingCycle | null, records: BreedingRecord[] = [], now = Date.now()) {
  if (!cycle) return []

  const upcomingTitle = getUpcomingStageTitle(cycle, records)
  const currentTitle = buildCurrentStageTitle(cycle, records, now)
  const baseDate = cycle.updated_at || cycle.created_at || now
  const items: ActiveCycleSummaryTimelineItem[] = []

  if (upcomingTitle) {
    items.push({
      key: 'upcoming',
      kind: 'upcoming',
      type: 'upcoming',
      tone: 'gray',
      title: upcomingTitle,
      summary: buildUpcomingSummary(cycle, records, now),
      date: baseDate + 2,
    })
  }

  if (currentTitle) {
    items.push({
      key: 'current',
      kind: 'current',
      type: 'current',
      tone: getCycleTone(cycle.status),
      title: currentTitle,
      summary: buildCurrentStageSummary(cycle, records),
      date: baseDate + 1,
    })
  }

  return items
}

export function buildActiveCycleSummaryViewModel(
  cycle?: BreedingCycle | null,
  records: BreedingRecord[] = [],
  now = Date.now()
): ActiveCycleSummaryViewModel {
  const recordItems: ActiveCycleSummaryTimelineItem[] = []
  const heatRecord = getEarliestRecord(records, 'heat')
  const follicleRecord = getLatestRecord(records, 'follicle_check')
  const matingRecords = getMatingRecords(records)
  const pregnancyRecord = getLatestRecord(records, 'pregnancy_check')
  const prenatalRecord = getLatestRecord(records, 'prenatal_check')
  const preLaborRecord = getLatestRecord(records, 'pre_labor')

  if (heatRecord?.date) {
    recordItems.push({
      key: 'heat',
      kind: 'record',
      type: 'heat',
      tone: 'amber',
      title: '发情',
      summary: `${formatDate(heatRecord.date)} · 发情开始`,
      date: heatRecord.date,
    })
  }

  if (follicleRecord?.date) {
    const left = follicleRecord.details?.left_count ?? '—'
    const right = follicleRecord.details?.right_count ?? '—'
    const result = follicleRecord.details?.result ? ` · ${follicleRecord.details.result}` : ''
    recordItems.push({
      key: 'follicle_check',
      kind: 'record',
      type: 'follicle_check',
      tone: 'teal',
      title: '卵泡检查',
      summary: `${formatDate(follicleRecord.date)} · 左${left}右${right}${result}`,
      date: follicleRecord.date,
    })
  }

  if (matingRecords.length > 0) {
    const dateSummary = matingRecords.slice(0, 3).map(record => formatShortDate(record.date)).join(' / ')
    const suffix = matingRecords.length > 3 ? ` · 等${matingRecords.length}次` : ''
    recordItems.push({
      key: 'mating',
      kind: 'record',
      type: 'mating',
      tone: 'rose',
      title: `配种 ×${matingRecords.length}`,
      summary: `${dateSummary}${suffix}`,
      date: matingRecords[matingRecords.length - 1].date,
    })
  }

  if (pregnancyRecord?.date) {
    const result = getPregnancyResult(pregnancyRecord.details || {})
    const count = getPregnancyCount(pregnancyRecord.details || {})
    const detail = [result, count ? `${count}只` : ''].filter(Boolean).join(' · ')
    recordItems.push({
      key: 'pregnancy_check',
      kind: 'record',
      type: 'pregnancy_check',
      tone: 'green',
      title: '孕检',
      summary: `${formatDate(pregnancyRecord.date)}${detail ? ` · ${detail}` : ''}`,
      date: pregnancyRecord.date,
    })
  }

  if (prenatalRecord?.date && prenatalRecord.details?.results) {
    recordItems.push({
      key: 'prenatal_check',
      kind: 'record',
      type: 'prenatal_check',
      tone: 'blue',
      title: '产检',
      summary: `${formatDate(prenatalRecord.date)} · ${truncateText(String(prenatalRecord.details.results), 16)}`,
      date: prenatalRecord.date,
    })
  }

  if (preLaborRecord?.date) {
    const temperature = preLaborRecord.details?.temperature
    const signal = temperature !== undefined && temperature !== null
      ? `体温 ${temperature}°C`
      : `刨窝行为${preLaborRecord.details?.nesting_behavior ? '有' : '无'}`
    recordItems.push({
      key: 'pre_labor',
      kind: 'record',
      type: 'pre_labor',
      tone: 'amber',
      title: '临产监测',
      summary: `${formatDate(preLaborRecord.date)} · ${signal}`,
      date: preLaborRecord.date,
    })
  }

  recordItems.sort((a, b) => {
    const dateDiff = b.date - a.date
    if (dateDiff !== 0) return dateDiff
    return b.key.localeCompare(a.key)
  })

  const timeline = [
    ...buildSyntheticTimelineItems(cycle, records, now),
    ...recordItems,
  ]

  return {
    title: cycle?.cycle_number ? `第${cycle.cycle_number}次繁育周期` : '当前繁育周期',
    subtitle: buildSubtitle(cycle),
    timeline,
    stageSummary: buildStageSummary(cycle, records, now),
  }
}

export function buildHistoryCycleSummaryViewModel(
  cycle?: BreedingCycle | null,
  litter?: Litter | null
): HistoryCycleSummaryViewModel {
  const title = cycle?.cycle_number ? `第${cycle.cycle_number}次周期` : '繁育周期'
  const parts = []

  if (cycle) {
    parts.push(formatDate(cycle.start_date || cycle.created_at || null))
  }
  if (cycle?.sire_name) {
    parts.push(`种公: ${cycle.sire_name}`)
  }

  if (cycle?.status === '已生产') {
    if (litter) {
      parts.push(`存活 ${litter.born_alive || 0}/${litter.total_born || 0}`)
    } else {
      parts.push('已生产')
    }
  } else if (cycle?.status === '失败') {
    parts.push('未成功')
  } else if (cycle?.status === '放弃') {
    parts.push('已放弃')
  }

  return {
    title,
    subtitle: parts.filter(Boolean).join(' · '),
  }
}
