import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/components/week-strip/WeekStrip.vue'), 'utf8')

describe('week strip selection contract', () => {
  it('WeekStrip 应按 selectedDate 所在周计算日期条', () => {
    expect(source).toContain('const mondayTs = getMonday(props.selectedDate || today.value)')
    expect(source).not.toContain('const mondayTs = getMonday(today.value)')
  })

  it('WeekStrip 应保留真实今天标签与选中日期高亮的分离语义', () => {
    expect(source).toContain("label: isToday ? '今' : WEEK_LABELS[d.getDay()]")
    expect(source).toContain("'today': day.ts === selectedDate")
    expect(source).toContain("'day-label--today': day.isToday && day.ts === selectedDate")
  })

  it('WeekStrip 仍保持过去日期不可点击', () => {
    expect(source).toContain('if (day.isPast) return // 过去日期不可点击')
  })

  it('WeekStrip 在非今天态应提供返回今日入口', () => {
    expect(source).toContain("v-if=\"!isSelectedToday\"")
    expect(source).toContain("@click=\"$emit('jump-today')\"")
    expect(source).toContain("(e: 'jump-today'): void")
    expect(source).toContain('const isSelectedToday = computed(() => props.selectedDate === today.value)')
    expect(source).toContain('class="material-icons-round month-header__today-icon">history</text>')
    expect(source).toContain('<text class="month-header__today-text">回到今日</text>')
  })

  it('WeekStrip 顶部应为月份主入口加固定日历按钮的导航条', () => {
    expect(source).toContain('class="month-header__month-btn" @click="$emit(\'toggle-calendar\')"')
    expect(source).toContain('class="material-icons-round month-header__month-icon">arrow_drop_down</text>')
    expect(source).toContain('class="month-header__calendar" @click="$emit(\'toggle-calendar\')"')
    expect(source).toContain('class="material-icons-round month-header__calendar-icon">calendar_month</text>')
    expect(source).toContain('.month-header__actions')
  })
})
