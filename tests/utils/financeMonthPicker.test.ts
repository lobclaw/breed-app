import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const financeIndexSource = readFileSync(resolve(testDir, '../../src/pages/finance/index.vue'), 'utf8')
const pickerSource = readFileSync(resolve(testDir, '../../src/components/form/BDateTimePicker.vue'), 'utf8')

describe('finance month picker contract', () => {
  it('财务首页顶部月份应接入年月选择器', () => {
    expect(financeIndexSource).toContain('@click="openMonthPicker"')
    expect(financeIndexSource).toContain('mode="month"')
    expect(financeIndexSource).toContain('@confirm="onMonthPickerConfirm"')
  })

  it('日期选择器应支持 month 模式直出年月确认', () => {
    expect(pickerSource).toContain("type PickerMode = 'date' | 'time' | 'datetime' | 'month'")
    expect(pickerSource).toContain("props.mode === 'month'")
    expect(pickerSource).toContain("} else if (props.mode === 'month') {")
  })
})
