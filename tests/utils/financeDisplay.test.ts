import { describe, expect, it } from 'vitest'

import { formatFinanceAmount, getFinanceAmountParts } from '@/utils/financeDisplay'

describe('financeDisplay', () => {
  it('应默认输出带人民币符号的金额字符串', () => {
    expect(formatFinanceAmount(0)).toBe('¥0')
    expect(formatFinanceAmount(122)).toBe('¥122')
    expect(formatFinanceAmount(-122)).toBe('-¥122')
    expect(formatFinanceAmount(32000)).toBe('¥32,000')
  })

  it('大额缩写与 absolute 模式仍应保留人民币符号', () => {
    expect(formatFinanceAmount(120000)).toBe('¥12万')
    expect(formatFinanceAmount(-120000, { absolute: true })).toBe('¥12万')
    expect(formatFinanceAmount(-122, { absolute: true })).toBe('¥122')
  })

  it('应支持为大号金额提供拆分渲染结构', () => {
    expect(getFinanceAmountParts(-122)).toEqual({
      sign: '-',
      currency: '¥',
      number: '122',
      fullText: '-¥122',
      detail: '',
      abbreviated: false,
    })

    expect(getFinanceAmountParts(120000)).toEqual({
      sign: '',
      currency: '¥',
      number: '12万',
      fullText: '¥12万',
      detail: '完整：¥120,000',
      abbreviated: true,
    })
  })
})
