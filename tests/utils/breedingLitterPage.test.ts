import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/breeding/litter.vue'), 'utf8')

describe('breeding litter page source contract', () => {
  it('窝利润应使用单窝利润汇总口径展示收入和支出', () => {
    expect(source).toContain('getLocalLitterDetail, getLocalLitterProfit')
    expect(source).toContain('getLocalLitterProfit(familyId, litterId)')
    expect(source).toContain('income: profit?.totalIncome ?? detail.litter.income')
    expect(source).toContain('expense: profit?.totalCost ?? detail.litter.expense')
  })

  it('幼崽去向应兼容当前中文状态并支持跳转单窝利润详情', () => {
    expect(source).toContain("for_sale: '待售'")
    expect(source).toContain("已预定: 'disp-reserved'")
    expect(source).toContain("已售: 'disp-sold'")
    expect(source).toContain('uni.navigateTo({ url: `/pages/finance/litter-profit?litterId=${litterId}${query}` })')
    expect(source).toContain('<BCard color="green" @click="goProfitDetail">')
  })
})
