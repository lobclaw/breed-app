export const DAY_MS = 86400000
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

function toDate(value: number | Date = Date.now()) {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value)
}

function resolveSourceTimestamp(
  value?: number | Date | null,
  fallback: number | Date = Date.now(),
) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value instanceof Date) return value.getTime()
  return toDate(fallback).getTime()
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

export function parseDateString(dateStr: string) {
  const [year, month, day] = String(dateStr).split('-').map(Number)
  if (!year || !month || !day) return null
  return {
    year,
    month,
    monthIndex: month - 1,
    day,
  }
}

export function parseTimeString(timeStr: string) {
  const [hours, minutes] = String(timeStr).split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return { hours, minutes }
}

export function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function clampDayInMonth(year: number, monthIndex: number, day: number) {
  if (day <= 0) return 1
  return Math.min(day, getDaysInMonth(year, monthIndex))
}

export function formatDateParts(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

export function formatTimeParts(hours: number, minutes: number) {
  return `${pad2(hours)}:${pad2(minutes)}`
}

export function buildTimestampFromDateTimeParts(
  year: number,
  monthIndex: number,
  day: number,
  hours: number,
  minutes: number,
  timeSource: number | Date = Date.now(),
) {
  const base = toDate(timeSource)
  return new Date(
    year,
    monthIndex,
    day,
    hours,
    minutes,
    base.getSeconds(),
    base.getMilliseconds(),
  ).getTime()
}

export function buildTimestampFromDateParts(
  year: number,
  monthIndex: number,
  day: number,
  timeSource: number | Date = Date.now(),
) {
  const base = toDate(resolveSourceTimestamp(timeSource))
  return new Date(
    year,
    monthIndex,
    day,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds(),
  ).getTime()
}

export function buildTimestampFromDateString(dateStr: string, timeSource: number | Date = Date.now()) {
  const parsed = parseDateString(dateStr)
  if (!parsed) return NaN
  return buildTimestampFromDateParts(parsed.year, parsed.monthIndex, parsed.day, timeSource)
}

export function buildTimestampFromTimeParts(
  hours: number,
  minutes: number,
  dateSource: number | Date = Date.now(),
) {
  const base = toDate(resolveSourceTimestamp(dateSource))
  return buildTimestampFromDateTimeParts(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    hours,
    minutes,
    dateSource,
  )
}

export function buildTimestampFromTimeString(timeStr: string, dateSource: number | Date = Date.now()) {
  const parsed = parseTimeString(timeStr)
  if (!parsed) return NaN
  return buildTimestampFromTimeParts(parsed.hours, parsed.minutes, dateSource)
}

export function buildTimestampFromDateTimeStrings(
  dateStr: string,
  timeStr: string,
  timeSource: number | Date = Date.now(),
) {
  const date = parseDateString(dateStr)
  const time = parseTimeString(timeStr)
  if (!date || !time) return NaN
  return buildTimestampFromDateTimeParts(
    date.year,
    date.monthIndex,
    date.day,
    time.hours,
    time.minutes,
    timeSource,
  )
}

export function buildTimestampFromDayOffset(offsetDays: number, timeSource: number | Date = Date.now()) {
  const base = toDate(resolveSourceTimestamp(timeSource))
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + offsetDays,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds(),
  ).getTime()
}

export function replaceTimestampDateParts(
  baseValue: number | Date | null | undefined,
  year: number,
  monthIndex: number,
  day: number,
  fallback: number | Date = Date.now(),
) {
  return buildTimestampFromDateParts(year, monthIndex, day, resolveSourceTimestamp(baseValue, fallback))
}

export function replaceTimestampTimeParts(
  baseValue: number | Date | null | undefined,
  hours: number,
  minutes: number,
  fallback: number | Date = Date.now(),
) {
  return buildTimestampFromTimeParts(hours, minutes, resolveSourceTimestamp(baseValue, fallback))
}

export function getDraftTimestamp(value?: number | Date | null, fallback: number | Date = Date.now()) {
  return resolveSourceTimestamp(value, fallback)
}

export function formatDateInputValue(ts?: number | null) {
  if (!ts) return ''
  const date = new Date(ts)
  return `${formatDateParts(date.getFullYear(), date.getMonth(), date.getDate())} ${formatTimeParts(date.getHours(), date.getMinutes())}`
}

export function formatTimeInputValue(value?: number | string | null) {
  if (!value && value !== 0) return ''
  if (typeof value === 'string') {
    const parsed = parseTimeString(value)
    if (!parsed) return ''
    return formatTimeParts(parsed.hours, parsed.minutes)
  }
  const date = new Date(value)
  return formatTimeParts(date.getHours(), date.getMinutes())
}

export function formatDateTimeInputValue(ts?: number | null) {
  if (!ts) return ''
  return formatDateInputValue(ts)
}

export function getLocalCalendarDayDiff(targetTs: number, baseTs: number = Date.now()) {
  const target = new Date(targetTs)
  const base = new Date(baseTs)
  const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime()
  const baseStart = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime()
  return Math.round((targetStart - baseStart) / DAY_MS)
}

export function getBeijingDayStart(ts: number) {
  const shifted = ts + BEIJING_OFFSET_MS
  const beijingDate = new Date(shifted)
  return Date.UTC(
    beijingDate.getUTCFullYear(),
    beijingDate.getUTCMonth(),
    beijingDate.getUTCDate(),
  ) - BEIJING_OFFSET_MS
}

export function getBeijingDayEnd(ts: number) {
  return getBeijingDayStart(ts) + DAY_MS - 1
}

export function getBeijingDayDiff(targetTs: number, baseTs: number = Date.now()) {
  return Math.floor((getBeijingDayStart(targetTs) - getBeijingDayStart(baseTs)) / DAY_MS)
}

export function isSameBeijingDay(leftTs: number, rightTs: number) {
  return getBeijingDayStart(leftTs) === getBeijingDayStart(rightTs)
}
