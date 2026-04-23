import { describe, expect, it, vi } from 'vitest'
import {
  buildTimestampFromDateTimeStrings,
  buildTimestampFromDateString,
  buildTimestampFromDayOffset,
  buildTimestampFromTimeString,
  clampDayInMonth,
  formatDateInputValue,
  formatDateTimeInputValue,
  formatTimeInputValue,
  getDraftTimestamp,
  getBeijingDayDiff,
  getBeijingDayStart,
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

  it('timestamp 毫秒数应为正整数', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-22T15:16:17.123+08:00'))
    const now = Date.now()
    expect(now).toBeGreaterThan(0)
    expect(Number.isInteger(now)).toBe(true)
    vi.useRealTimers()
  })
})
