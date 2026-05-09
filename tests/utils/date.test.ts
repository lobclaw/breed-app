import { describe, expect, it, vi } from 'vitest'
import {
  buildBeijingTimestampFromParts,
  buildTimestampFromDateTimeStrings,
  buildTimestampFromDateString,
  buildTimestampFromMonthParts,
  buildTimestampFromDayOffset,
  buildTimestampFromTimeString,
  clampDayInMonth,
  formatDateInputValue,
  formatDateTimeInputValue,
  formatTimeInputValue,
  getBeijingDateParts,
  getBeijingDayDiff,
  getBeijingElapsedDays,
  getBeijingDayStart,
  getBeijingMonthRange,
  getBeijingOrdinalDay,
  getBeijingQuarterRange,
  getBeijingYearRange,
  getDraftTimestamp,
  normalizeMonthCursor,
  offsetMonthCursor,
  parseDateString,
  parseTimeString,
  replaceTimestampDateParts,
  replaceTimestampTimeParts,
} from '@/utils/date'

describe('日期工具函数', () => {
  it('日期选择应保留当前时分秒毫秒', () => {
    const baseTs = new Date('2026-04-22T15:16:17.123+08:00').getTime()
    const result = buildTimestampFromDateString('2026-05-01', baseTs)

    expect(result).toBe(new Date('2026-05-01T15:16:17.123+08:00').getTime())
  })

  it('北京时间构造不应依赖设备本地时区', () => {
    expect(buildBeijingTimestampFromParts(2026, 4, 1, 15, 16, 17, 123))
      .toBe(new Date('2026-05-01T15:16:17.123+08:00').getTime())
    expect(getBeijingDateParts(new Date('2026-04-30T17:30:00.456Z').getTime())).toMatchObject({
      year: 2026,
      month: 5,
      monthIndex: 4,
      day: 1,
      hours: 1,
      minutes: 30,
      seconds: 0,
      milliseconds: 456,
    })
  })

  it('北京时间月份、季度、年份范围应使用北京时间日边界', () => {
    expect(getBeijingMonthRange(2026, 4)).toEqual({
      startDate: new Date('2026-05-01T00:00:00.000+08:00').getTime(),
      endDate: new Date('2026-06-01T00:00:00.000+08:00').getTime(),
    })
    expect(getBeijingQuarterRange(2026, 3)).toEqual({
      startDate: new Date('2026-04-01T00:00:00.000+08:00').getTime(),
      endDate: new Date('2026-07-01T00:00:00.000+08:00').getTime(),
    })
    expect(getBeijingYearRange(2026)).toEqual({
      startDate: new Date('2026-01-01T00:00:00.000+08:00').getTime(),
      endDate: new Date('2027-01-01T00:00:00.000+08:00').getTime(),
    })
  })

  it('月份选择应固定落在当月 1 号，并保留当前时分秒毫秒', () => {
    const baseTs = new Date('2026-04-22T15:16:17.123+08:00').getTime()
    const result = buildTimestampFromMonthParts(2026, 4, baseTs)

    expect(result).toBe(new Date('2026-05-01T15:16:17.123+08:00').getTime())
  })

  it('快捷日期应保留当前时分秒毫秒', () => {
    const baseTs = new Date('2026-04-22T15:16:17.123+08:00').getTime()
    const result = buildTimestampFromDayOffset(-1, baseTs)

    expect(result).toBe(new Date('2026-04-21T15:16:17.123+08:00').getTime())
  })

  it('日期时间组合应保留来源秒和毫秒，只覆盖用户选定年月日时分', () => {
    const baseTs = new Date('2026-04-22T15:16:17.123+08:00').getTime()
    const result = buildTimestampFromDateTimeStrings('2026-05-01', '09:30', baseTs)

    expect(result).toBe(new Date('2026-05-01T09:30:17.123+08:00').getTime())
  })

  it('仅修改时间时应保留原有日期和秒毫秒', () => {
    const baseTs = new Date('2026-04-22T15:16:17.123+08:00').getTime()
    const result = buildTimestampFromTimeString('09:30', baseTs)

    expect(result).toBe(new Date('2026-04-22T09:30:17.123+08:00').getTime())
  })

  it('替换日期部分时应保留原时间与毫秒', () => {
    const baseTs = new Date('2026-04-22T15:16:17.123+08:00').getTime()
    const result = replaceTimestampDateParts(baseTs, 2026, 4, 1)

    expect(result).toBe(new Date('2026-05-01T15:16:17.123+08:00').getTime())
  })

  it('替换时间部分时应保留原日期与毫秒', () => {
    const baseTs = new Date('2026-04-22T15:16:17.123+08:00').getTime()
    const result = replaceTimestampTimeParts(baseTs, 8, 45)

    expect(result).toBe(new Date('2026-04-22T08:45:17.123+08:00').getTime())
  })

  it('日期与时间格式化应输出 picker 所需文案', () => {
    const baseTs = new Date('2026-04-22T15:16:17.123+08:00').getTime()

    expect(formatDateInputValue(baseTs)).toBe('2026-04-22 15:16')
    expect(formatTimeInputValue(baseTs)).toBe('15:16')
    expect(formatDateTimeInputValue(baseTs)).toBe('2026-04-22 15:16')
  })

  it('空值草稿应回退到当前本地时间', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-22T15:16:17.123+08:00'))

    expect(getDraftTimestamp(null)).toBe(new Date('2026-04-22T15:16:17.123+08:00').getTime())

    vi.useRealTimers()
  })

  it('日期与时间字符串解析应返回结构化结果', () => {
    expect(parseDateString('2026-04-22')).toEqual({
      year: 2026,
      month: 4,
      monthIndex: 3,
      day: 22,
    })
    expect(parseTimeString('09:30')).toEqual({ hours: 9, minutes: 30 })
  })

  it('月份变化时应自动夹紧月底天数并兼容闰年', () => {
    expect(clampDayInMonth(2026, 1, 31)).toBe(28)
    expect(clampDayInMonth(2028, 1, 31)).toBe(29)
  })

  it('月游标归一后应固定在当月 1 号', () => {
    const sourceTs = new Date('2026-01-31T15:16:17.123+08:00').getTime()

    expect(normalizeMonthCursor(sourceTs)).toBe(new Date('2026-01-01T15:16:17.123+08:00').getTime())
  })

  it('月底切月时不应因为 31 号而跨到下下个月', () => {
    const sourceTs = new Date('2026-01-31T15:16:17.123+08:00').getTime()
    const normalized = normalizeMonthCursor(sourceTs)

    expect(offsetMonthCursor(normalized, 1)).toBe(new Date('2026-02-01T15:16:17.123+08:00').getTime())
    expect(offsetMonthCursor(normalized, -1)).toBe(new Date('2025-12-01T15:16:17.123+08:00').getTime())
  })

  it('北京时间日边界计算应忽略业务字段的具体时分秒', () => {
    const targetTs = new Date('2026-04-22T23:59:59.999+08:00').getTime()
    const startTs = getBeijingDayStart(targetTs)

    expect(startTs).toBe(new Date('2026-04-22T00:00:00.000+08:00').getTime())
  })

  it('北京时间按天差值应基于日期而不是具体时分秒', () => {
    const baseTs = new Date('2026-04-22T23:59:59.999+08:00').getTime()
    const nextMorningTs = new Date('2026-04-23T00:00:00.001+08:00').getTime()

    expect(getBeijingDayDiff(nextMorningTs, baseTs)).toBe(1)
  })

  it('第 N 天应按北京时间日边界并从起始当天算第 1 天', () => {
    const startTs = new Date('2026-05-07T23:30:00+08:00').getTime()
    const nextMorningTs = new Date('2026-05-08T00:10:00+08:00').getTime()

    expect(getBeijingElapsedDays(startTs, nextMorningTs)).toBe(1)
    expect(getBeijingOrdinalDay(startTs, nextMorningTs)).toBe(2)
  })

  it('timestamp 毫秒数应为正整数', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-22T15:16:17.123+08:00'))
    const now = Date.now()
    expect(now).toBeGreaterThan(0)
    expect(Number.isInteger(now)).toBe(true)
    vi.useRealTimers()
  })
})
