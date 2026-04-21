import type { BreedingCycle, BreedingRecord, Litter } from '@/types/breeding'
import { buildCompactBreedingCycleStatusTitle } from '@/utils/dogStatusCopy'
import {
  buildBreedingTimelineSyntheticItems,
  getBreedingTimelineExpectedDueDate,
  getBreedingTimelineRecordTone,
  getEarliestBreedingRecord,
  getLatestBreedingRecord,
  getOrderedMatingRecords,
  type BreedingTimelineKind,
  type BreedingTimelineTone,
} from '@/utils/breedingTimeline'

export interface ActiveCycleSummaryTimelineItem {
  key: string
  kind: BreedingTimelineKind
  type: string
  tone: BreedingTimelineTone
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
  meta: string
  result: string
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
  parts.push(buildCompactBreedingCycleStatusTitle(cycle, records, now))

  const dueDate = getBreedingTimelineExpectedDueDate(cycle, records)
  if (typeof dueDate === 'number') {
    parts.push(`预产期 ${formatDate(dueDate)}`)
  }

  return parts.join(' · ')
}

export function buildActiveCycleSummaryViewModel(
  cycle?: BreedingCycle | null,
  records: BreedingRecord[] = [],
  now = Date.now()
): ActiveCycleSummaryViewModel {
  const recordItems: ActiveCycleSummaryTimelineItem[] = []
  const heatRecord = getEarliestBreedingRecord(records, 'heat')
  const follicleRecord = getLatestBreedingRecord(records, 'follicle_check')
  const matingRecords = getOrderedMatingRecords(records)
  const pregnancyRecord = getLatestBreedingRecord(records, 'pregnancy_check')
  const prenatalRecord = getLatestBreedingRecord(records, 'prenatal_check')
  const preLaborRecord = getLatestBreedingRecord(records, 'pre_labor')

  if (heatRecord?.date) {
    recordItems.push({
      key: 'heat',
      kind: 'record',
      type: 'heat',
      tone: getBreedingTimelineRecordTone('heat'),
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
      tone: getBreedingTimelineRecordTone('follicle_check'),
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
      tone: getBreedingTimelineRecordTone('mating'),
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
      tone: getBreedingTimelineRecordTone('pregnancy_check'),
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
      tone: getBreedingTimelineRecordTone('prenatal_check'),
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
      tone: getBreedingTimelineRecordTone('pre_labor'),
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
    ...buildBreedingTimelineSyntheticItems(cycle, records, now),
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
  const metaParts = []
  const resultParts = []

  if (cycle) {
    metaParts.push(formatDate(cycle.start_date || cycle.created_at || null))
  }
  if (cycle?.sire_name) {
    metaParts.push(`种公: ${cycle.sire_name}`)
  }

  if (cycle?.status === '已生产') {
    if (litter) {
      resultParts.push(`存活 ${litter.born_alive || 0}/${litter.total_born || 0}`)
      const keptCount = Number((litter as any)?.pupStats?.kept)
      if (Number.isFinite(keptCount) && keptCount > 0) {
        resultParts.push(`在养 ${keptCount}`)
      }
    } else {
      resultParts.push('已生产')
    }
  } else if (cycle?.status === '失败') {
    resultParts.push('未成功')
  } else if (cycle?.status === '放弃') {
    resultParts.push('已放弃')
  }

  return {
    title,
    meta: metaParts.filter(Boolean).join(' · '),
    result: resultParts.filter(Boolean).join(' · '),
  }
}
