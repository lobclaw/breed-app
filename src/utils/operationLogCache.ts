import { DAY_MS, getBeijingDateParts, getBeijingDayStart } from './date'

export type OperationLogDateRangeValue = 'all' | 'today' | 'this_week' | 'this_month' | 'custom'

export interface OperationLogFilterSignatureOptions {
  range: OperationLogDateRangeValue
  customStartDate: number
  customEndDate: number
  actorUserIds?: string[]
  actionTypes?: string[]
  now?: number
}

export interface OperationLogCacheEntry<T = Record<string, any>> {
  signature: string
  cachedAt: number
  hasMore: boolean
  rawLogs: T[]
}

export const OPERATION_LOG_CACHE_PREFIX = 'breed_operation_log_cache:'
export const OPERATION_LOG_CACHE_LIMIT = 8

function startOfDay(timestamp: number): number {
  return getBeijingDayStart(timestamp)
}

function endOfDay(timestamp: number): number {
  return getBeijingDayStart(timestamp) + DAY_MS - 1
}

function getDateKey(timestamp: number): string {
  const d = getBeijingDateParts(timestamp)
  const month = String(d.month).padStart(2, '0')
  const date = String(d.day).padStart(2, '0')
  return `${d.year}-${month}-${date}`
}

export function normalizeOperationLogCacheSelection(values: string[] = []): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort()
}

export function buildOperationLogRangeKey(
  range: OperationLogDateRangeValue,
  customStartDate: number,
  customEndDate: number,
  now = Date.now(),
): string {
  if (range === 'today') {
    return `today:${getDateKey(now)}`
  }

  if (range === 'this_week') {
    const parts = getBeijingDateParts(now)
    const day = parts.weekday || 7
    const weekStart = getBeijingDayStart(now - (day - 1) * DAY_MS)
    return `week:${getDateKey(weekStart)}`
  }

  if (range === 'this_month') {
    const parts = getBeijingDateParts(now)
    const month = String(parts.month).padStart(2, '0')
    return `month:${parts.year}-${month}`
  }

  if (range === 'custom') {
    return `custom:${startOfDay(customStartDate)}:${endOfDay(customEndDate)}`
  }

  return 'all'
}

export function buildOperationLogFilterSignature(options: OperationLogFilterSignatureOptions): string {
  return JSON.stringify({
    rangeKey: buildOperationLogRangeKey(
      options.range,
      options.customStartDate,
      options.customEndDate,
      options.now,
    ),
    actorUserIds: normalizeOperationLogCacheSelection(options.actorUserIds),
    actionTypes: normalizeOperationLogCacheSelection(options.actionTypes),
  })
}

export function getOperationLogCacheKey(familyId: string) {
  return familyId ? `${OPERATION_LOG_CACHE_PREFIX}${familyId}` : ''
}

export function readOperationLogCacheEntry<T = Record<string, any>>(
  familyId: string,
  signature: string,
): OperationLogCacheEntry<T> | null {
  const key = getOperationLogCacheKey(familyId)
  if (!key || !signature) return null
  try {
    const raw = uni.getStorageSync(key)
    if (!raw) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : []
    const matched = entries.find((entry: any) => entry?.signature === signature)
    if (!matched || !Array.isArray(matched.rawLogs)) return null
    return matched as OperationLogCacheEntry<T>
  } catch {
    return null
  }
}

export function writeOperationLogCacheEntry<T = Record<string, any>>(
  familyId: string,
  signature: string,
  rawItems: T[],
  nextHasMore: boolean,
) {
  const key = getOperationLogCacheKey(familyId)
  if (!key || !signature) return
  try {
    const raw = uni.getStorageSync(key)
    const parsed = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : []
    const nextEntry: OperationLogCacheEntry<T> = {
      signature,
      cachedAt: Date.now(),
      hasMore: nextHasMore,
      rawLogs: rawItems,
    }
    const nextEntries = [
      nextEntry,
      ...entries.filter((entry: any) => entry?.signature !== signature),
    ].slice(0, OPERATION_LOG_CACHE_LIMIT)
    uni.setStorageSync(key, JSON.stringify({ entries: nextEntries }))
  } catch {
    // 缓存只是离线兜底，失败不影响操作日志展示。
  }
}
