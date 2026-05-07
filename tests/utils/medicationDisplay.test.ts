import { describe, expect, it } from 'vitest'
import { formatMedicationDosage, formatMedicationFrequency, formatMedicationMethod } from '@/utils/medicationDisplay'

describe('medicationDisplay', () => {
  it('formats medication protocol summary parts', () => {
    const parts = [
      '阿莫西林',
      formatMedicationDosage('3', 'mg', '毫克'),
      formatMedicationMethod('oral'),
      formatMedicationFrequency('three_daily'),
      '3天',
    ].filter(Boolean)

    expect(parts.join(' · ')).toBe('阿莫西林 · 3毫克 · 口服 · 每日3次 · 3天')
  })

  it('keeps numeric medication frequency readable', () => {
    expect(formatMedicationFrequency(2)).toBe('每日2次')
  })
})
