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
    expect(source).toContain('mode="date"')
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
})
