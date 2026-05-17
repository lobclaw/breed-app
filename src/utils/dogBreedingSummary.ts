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
import { getBeijingDateParts } from '@/utils/date'

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
  statusText: string
  statusTone: 'green' | 'red' | 'gray'
  statusIcon: string
}

type BreedingDetails = Record<string, unknown>
type LitterWithPupStats = Litter & {
  pupStats?: {
    kept?: number | string | null
  } | null
}

export function isUnweanedProducedCycle(cycle?: BreedingCycle | null, litter?: Litter | null) {
  return cycle?.status === '已生产' && !!litter && !litter.weaned_at
}

export function isDogDetailActiveBreedingCycle(cycle?: BreedingCycle | null, litter?: Litter | null) {
  if (!cycle?.status) return false
  if (cycle.status === '发情中' || cycle.status === '怀孕中') return true
  return isUnweanedProducedCycle(cycle, litter)
}

export function isDogDetailHistoryBreedingCycle(cycle?: BreedingCycle | null, litter?: Litter | null) {
  if (!cycle?.status) return false
  if (cycle.status === '失败' || cycle.status === '放弃') return true
  if (cycle.status === '已生产') return !isUnweanedProducedCycle(cycle, litter)
  return false
}

const RECORD_STAGE_SORT_ORDER: Record<string, number> = {
  birth: 70,
  pre_labor: 60,
  prenatal_check: 50,
  pregnancy_check: 40,
  mating: 30,
  follicle_check: 20,
  heat: 10,
}

function formatDate(ts?: number | null) {
  if (typeof ts !== 'number') return '—'
  const date = getBeijingDateParts(ts)
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

function truncateText(text: string, maxLength = 18) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

function getPregnancyResult(details: BreedingDetails = {}) {
  if (details.result) return String(details.result)
  if (details.confirmed === '是' || details.confirmed === true) return '确认怀孕'
  if (details.confirmed === '否' || details.confirmed === false) return '未怀孕'
  return ''
}

function getPregnancyCount(details: BreedingDetails = {}) {
  const value = Number(details.fetus_count || details.puppy_count || details.count)
  return value > 0 ? value : null
}

function getMatingSireName(record?: BreedingRecord | null) {
  const details = record?.details || {}
  return String(details.sire_name || details.male_name || '').trim()
}

function normalizePreLaborSymptoms(details: BreedingDetails = {}) {
  const legacyLabelMap: Record<string, string> = {
    刨窝: '刨窝/做窝',
    焦躁: '焦躁不安',
    喘气: '喘气加快',
    分泌物: '阴道分泌物',
    宫缩: '可见宫缩',
    乳汁: '乳汁分泌',
  }
  const normalize = (item: unknown) => {
    const label = String(item || '').trim()
    return legacyLabelMap[label] || label
  }

  if (Array.isArray(details.symptoms)) {
    return details.symptoms.map(normalize).filter(Boolean)
  }

  const normalized = String(details.symptoms || '').split(/[、，,\s]+/).map(normalize).filter(Boolean)
  if (details.nesting_behavior && !normalized.includes('刨窝/做窝')) normalized.push('刨窝/做窝')
  const appetiteChange = normalize(details.appetite_change)
  if (appetiteChange && !normalized.includes(appetiteChange)) normalized.push(appetiteChange)
  String(details.other_signs || '')
    .split(/[、，,\s]+/)
    .map(normalize)
    .filter(Boolean)
    .forEach((item) => {
      if (!normalized.includes(item)) normalized.push(item)
    })
  return normalized
}

function buildSubtitle(cycle?: BreedingCycle | null, records: BreedingRecord[] = [], now = Date.now()) {
  if (!cycle) return ''
  const parts = []
  const matingRecords = getOrderedMatingRecords(records)
  const latestMating = getLatestBreedingRecord(records, 'mating')
  const sireName = String(cycle.sire_name || '').trim() || getMatingSireName(latestMating)
  if (sireName) parts.push(`种公: ${sireName}`)
  if (matingRecords.length > 0) parts.push(`配种${matingRecords.length}次`)
  if (!parts.length) parts.push(buildCompactBreedingCycleStatusTitle(cycle, records, now) || cycle.status || '进行中')
  return parts.join(' · ')
}

function buildStageSummary(
  cycle?: BreedingCycle | null,
  records: BreedingRecord[] = [],
  now = Date.now(),
  litter?: Litter | null,
) {
  if (!cycle?.status) return ''
  const parts = []
  parts.push(buildCompactBreedingCycleStatusTitle(cycle, records, now))

  if (cycle.status === '已生产') {
    const birthRecord = getLatestBreedingRecord(records, 'birth')
    const birthDate = birthRecord?.date || litter?.birth_date
    if (typeof birthDate === 'number') {
      parts.push(`生产日期 ${formatDate(birthDate)}`)
    }
  } else {
    const dueDate = getBreedingTimelineExpectedDueDate(cycle, records)
    if (typeof dueDate === 'number') {
      parts.push(`预产期 ${formatDate(dueDate)}`)
    }
  }

  return parts.join(' · ')
}

export function buildActiveCycleSummaryViewModel(
  cycle?: BreedingCycle | null,
  records: BreedingRecord[] = [],
  now = Date.now(),
  litter?: Litter | null,
): ActiveCycleSummaryViewModel {
  const recordItems: ActiveCycleSummaryTimelineItem[] = []
  const heatRecord = getEarliestBreedingRecord(records, 'heat')
  const follicleRecord = getLatestBreedingRecord(records, 'follicle_check')
  const matingRecords = getOrderedMatingRecords(records)
  const pregnancyRecord = getLatestBreedingRecord(records, 'pregnancy_check')
  const prenatalRecord = getLatestBreedingRecord(records, 'prenatal_check')
  const preLaborRecord = getLatestBreedingRecord(records, 'pre_labor')
  const birthRecord = getLatestBreedingRecord(records, 'birth')

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
    const dateSummary = matingRecords.slice(0, 3).map(record => formatDate(record.date)).join(' / ')
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
    const symptoms = normalizePreLaborSymptoms(preLaborRecord.details || {})
    const signal = temperature !== undefined && temperature !== null
      ? `体温 ${temperature}°C`
      : symptoms.length > 0 ? `${symptoms.length}项征兆` : '临产监测'
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

  const birthDate = birthRecord?.date || litter?.birth_date
  if (birthDate) {
    const details = birthRecord?.details || {}
    const aliveCount = Number(details.born_alive ?? litter?.born_alive)
    const totalCount = Number(details.total_born ?? litter?.total_born)
    const countSummary = Number.isFinite(aliveCount) && Number.isFinite(totalCount) && totalCount > 0
      ? `存活 ${aliveCount}/${totalCount}`
      : ''
    const birthType = details.birth_type || litter?.birth_type || ''
    const detail = [birthType, countSummary].filter(Boolean).join(' · ')

    recordItems.push({
      key: 'birth',
      kind: 'record',
      type: 'birth',
      tone: getBreedingTimelineRecordTone('birth'),
      title: '生产',
      summary: `${formatDate(birthDate)}${detail ? ` · ${detail}` : ''}`,
      date: birthDate,
    })
  }

  recordItems.sort((a, b) => {
    const dateDiff = b.date - a.date
    if (dateDiff !== 0) return dateDiff
    const stageDiff = (RECORD_STAGE_SORT_ORDER[b.type] || 0) - (RECORD_STAGE_SORT_ORDER[a.type] || 0)
    if (stageDiff !== 0) return stageDiff
    return b.key.localeCompare(a.key)
  })

  const timeline = [
    ...buildBreedingTimelineSyntheticItems(cycle, records, now, { litter }),
    ...recordItems,
  ]

  return {
    title: cycle?.cycle_number ? `第${cycle.cycle_number}次繁育周期` : '当前繁育周期',
    subtitle: buildSubtitle(cycle, records, now),
    timeline,
    stageSummary: buildStageSummary(cycle, records, now, litter),
  }
}

export function buildHistoryCycleSummaryViewModel(
  cycle?: BreedingCycle | null,
  litter?: LitterWithPupStats | null,
  records: BreedingRecord[] = [],
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
      const keptCount = Number(litter.pupStats?.kept)
      if (Number.isFinite(keptCount) && keptCount > 0) {
        resultParts.push(`在养 ${keptCount}`)
      }
    } else {
      resultParts.push('已生产')
    }
  } else if (cycle?.status === '失败' || cycle?.status === '放弃') {
    const abnormalTermination = getLatestBreedingRecord(records, 'abnormal_termination')
    resultParts.push(abnormalTermination ? '异常终止' : cycle.status === '失败' ? '未成功' : '已放弃')
  }

  const statusText = getHistoryCycleStatusText(cycle, litter)
  const statusTone = getHistoryCycleStatusTone(statusText)

  return {
    title,
    meta: metaParts.filter(Boolean).join(' · '),
    result: resultParts.filter(Boolean).join(' · '),
    statusText,
    statusTone,
    statusIcon: statusTone === 'green' ? 'check_circle' : 'close',
  }
}

function getHistoryCycleStatusText(cycle?: BreedingCycle | null, litter?: Litter | null) {
  if (cycle?.status === '已生产' && typeof litter?.weaned_at === 'number') return '已完成'
  if (cycle?.status === '失败' || cycle?.status === '放弃') return '已终止'
  return cycle?.status || ''
}

function getHistoryCycleStatusTone(statusText: string): HistoryCycleSummaryViewModel['statusTone'] {
  if (statusText === '已完成' || statusText === '已生产') return 'green'
  if (statusText === '已终止') return 'red'
  return 'gray'
}
