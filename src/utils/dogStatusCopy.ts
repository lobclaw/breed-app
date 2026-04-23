import type { BreedingCycle, BreedingRecord } from '@/types/breeding'
import type { DeriveStatus } from '@/types/dog'
import { getBeijingDayStart } from '@/utils/date'

const DAY_MS = 86400000

const BREEDING_STATUS_BASE_TITLE: Record<string, string> = {
  发情中: '发情',
  怀孕中: '怀孕',
  哺乳中: '哺乳',
}

function startOfDay(ts: number) {
  return getBeijingDayStart(ts)
}

function normalizeDayCount(dayCount?: number | null) {
  const value = Number(dayCount)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.floor(value)
}

function normalizeName(name?: string | null) {
  const normalized = `${name || ''}`.trim()
  return normalized || ''
}

function parseDayCountFromMeta(meta?: Array<{ icon: string; text: string }>) {
  const text = meta?.find(item => /^第\d+天$/.test(item.text))?.text
  if (!text) return null

  const matched = text.match(/^第(\d+)天$/)
  return matched ? normalizeDayCount(Number(matched[1])) : null
}

function formatBreedingStatusTitle(statusType: string, dayCount?: number | null) {
  const baseTitle = BREEDING_STATUS_BASE_TITLE[statusType]
  if (!baseTitle) return statusType

  const normalizedDayCount = normalizeDayCount(dayCount)
  return normalizedDayCount ? `${baseTitle}第${normalizedDayCount}天` : statusType
}

function getLatestMatingRecord(records: BreedingRecord[]) {
  return records
    .filter(record => record.type === 'mating')
    .sort((a, b) => {
      const dateDiff = (b.date || b.updated_at || b.created_at || 0) - (a.date || a.updated_at || a.created_at || 0)
      if (dateDiff !== 0) return dateDiff
      return `${b._id || ''}`.localeCompare(`${a._id || ''}`)
    })[0] || null
}

export function getDeriveStatusDayCount(
  status: Pick<DeriveStatus, 'progress' | 'meta'>,
  fallbackDayCount?: number | null,
) {
  return normalizeDayCount(status.progress?.current)
    || parseDayCountFromMeta(status.meta)
    || normalizeDayCount(fallbackDayCount)
}

export function buildCompactDeriveStatusTitle(
  status: Pick<DeriveStatus, 'type' | 'label' | 'progress' | 'meta'>,
  options: {
    dayCount?: number | null
    nameOverride?: string | null
  } = {},
) {
  const dayCount = getDeriveStatusDayCount(status, options.dayCount)

  if (status.type === '发情中' || status.type === '怀孕中' || status.type === '哺乳中') {
    return formatBreedingStatusTitle(status.type, dayCount)
  }

  if (status.type === '生病中' || status.type === '用药中') {
    const specificName = normalizeName(options.nameOverride) || normalizeName(status.label)
    if (specificName && specificName !== status.type) {
      return dayCount ? `${specificName}第${dayCount}天` : specificName
    }
    return status.type
  }

  return status.label || status.type
}

export function getBreedingCycleCurrentDayCount(
  cycle?: BreedingCycle | null,
  records: BreedingRecord[] = [],
  now = Date.now(),
) {
  if (!cycle?.status) return null

  if (cycle.status === '发情中') {
    const startTs = cycle.start_date || cycle.created_at
    if (typeof startTs !== 'number') return null
    return Math.max(1, Math.floor((startOfDay(now) - startOfDay(startTs)) / DAY_MS) + 1)
  }

  if (cycle.status === '怀孕中') {
    const latestMating = getLatestMatingRecord(records)
    const startTs = cycle.mated_at || latestMating?.date
    if (typeof startTs !== 'number') return null
    return Math.max(1, Math.floor((startOfDay(now) - startOfDay(startTs)) / DAY_MS) + 1)
  }

  return null
}

export function buildCompactBreedingCycleStatusTitle(
  cycle?: BreedingCycle | null,
  records: BreedingRecord[] = [],
  now = Date.now(),
) {
  if (!cycle?.status) return ''
  return formatBreedingStatusTitle(cycle.status, getBreedingCycleCurrentDayCount(cycle, records, now))
}
