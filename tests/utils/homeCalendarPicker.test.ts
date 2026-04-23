import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/home/index.vue'), 'utf8')

describe('home calendar picker contract', () => {
  it('首页月份标题应接入日期月历', () => {
    expect(source).toContain('v-model:visible="showHomeDatePicker"')
    expect(source).toContain(':model-value="selectedDate"')
    expect(source).toContain(':day-dot-counts="dayCounts"')
    expect(source).toContain('date-only')
    expect(source).toContain('mode="date"')
    expect(source).toContain('@calendar-range-change="onHomeCalendarRangeChange"')
    expect(source).toContain('@confirm="onHomeCalendarConfirm"')
  })

  it('点击周历月份标题应打开月历而不是后续迭代提示', () => {
    expect(source).toContain(`function toggleCalendar() {
  showHomeDatePicker.value = true
}`)
    expect(source).not.toContain('月历功能后续迭代')
  })

  it('月历确认后应按北京时间日边界切换首页日期', () => {
    expect(source).toContain('function onHomeCalendarConfirm(value: number | string)')
    expect(source).toContain('const dayTs = getBeijingDayStart(value)')
    expect(source).toContain("uni.showToast({ title: '过去日期暂不可查看', icon: 'none' })")
    expect(source).toContain('void onDateSelect(dayTs)')
  })

  it('首页月历应按面板范围补拉并合并日期红点缓存', () => {
    expect(source).toContain('const loadedDateCountRanges = new Set<string>()')
    expect(source).toContain('async function onHomeCalendarRangeChange(payload: CalendarRangeChangePayload)')
    expect(source).toContain('await ensureDateCountsRange(payload.startDate, payload.endDate)')
    expect(source).toContain('function mergeDateCountsRange(startDate: number, endDate: number, nextCounts?: Record<number, number>)')
    expect(source).toContain('loadedDateCountRanges.clear()')
  })

  it('首页顶部副标题应随 selectedDate 在今日概览和当日安排之间切换', () => {
    expect(source).toContain('<text class="greeting-sub">{{ greetingSubText }}</text>')
    expect(source).toContain("const suffix = isSelectedToday.value ? '今日概览' : '当日安排'")
    expect(source).toContain('return `${formatFullDate(selectedDate.value)} · ${suffix}`')
  })

  it('首页应接住 WeekStrip 的返回今日入口并复用日期切换链路', () => {
    expect(source).toContain('@jump-today="jumpToToday"')
    expect(source).toContain('function jumpToToday() {')
    expect(source).toContain('void onDateSelect(startOfDay(Date.now()))')
  })
})
