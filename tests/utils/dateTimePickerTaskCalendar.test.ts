import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/components/form/BDateTimePicker.vue'), 'utf8')

describe('date time picker task calendar contract', () => {
  it('应支持纯日期任务日历模式与日期红点输入', () => {
    expect(source).toContain('dateOnly?: boolean')
    expect(source).toContain('dayDotCounts?: Record<number, number>')
    expect(source).toContain("'calendar-range-change': [payload:")
  })

  it('dateOnly 打开后应收起时刻交互并显示日期标题', () => {
    expect(source).toContain("const isDateOnlyMode = computed(() => props.mode === 'date' && props.dateOnly)")
    expect(source).toContain("if (isDateOnlyMode.value) return '选择日期'")
    expect(source).toContain('<view v-if="!isDateOnlyMode" class="b-date-time-picker__time-card" @click="openTimePanel">')
    expect(source).toContain('if (isDateOnlyMode.value) return')
  })

  it('任务日历日期格应支持红点与过去日期禁用态', () => {
    expect(source).toContain('dayStartTs: number')
    expect(source).toContain('showDot: boolean')
    expect(source).toContain('isDisabled: boolean')
    expect(source).toContain("'b-date-time-picker__calendar-cell--disabled': cell.isDisabled")
    expect(source).toContain('<view v-if="cell.showDot" class="b-date-time-picker__calendar-dot" />')
  })
})
