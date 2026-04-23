import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const financeIndexSource = readFileSync(resolve(testDir, '../../src/pages/finance/index.vue'), 'utf8')
const damRoiSource = readFileSync(resolve(testDir, '../../src/pages/finance/dam-roi.vue'), 'utf8')
const litterProfitSource = readFileSync(resolve(testDir, '../../src/pages/finance/litter-profit.vue'), 'utf8')
const statsSource = readFileSync(resolve(testDir, '../../src/pages/finance/stats.vue'), 'utf8')

describe('finance amount page contract', () => {
  it('财务首页主金额应使用带 ¥ 的拆分渲染', () => {
    expect(financeIndexSource).toContain("getFinanceAmountParts(summary.netProfit, { scene: 'overview' })")
    expect(financeIndexSource).toContain('class="summary-board__amount"')
    expect(financeIndexSource).toContain('class="summary-board__amount-currency"')
  })

  it('种母 ROI 与单窝利润的大号金额应使用带 ¥ 的拆分渲染', () => {
    expect(damRoiSource).toContain("getFinanceAmountParts(roiData.value?.netProfit || 0, { scene: 'report' })")
    expect(damRoiSource).toContain('class="roi-hero__headline-currency"')
    expect(litterProfitSource).toContain("getFinanceAmountParts(profitData.value?.netProfit || 0, { scene: 'report' })")
    expect(litterProfitSource).toContain('class="profit-amount__currency"')
  })

  it('财务统计页主卡金额仍应统一走财务金额格式化', () => {
    expect(statsSource).toContain("formatFinanceAmount(data.netProfit, { scene: 'report' })")
    expect(statsSource).toContain("formatFinanceAmount(data.totalIncome, { scene: 'report' })")
    expect(statsSource).toContain("formatFinanceAmount(-data.totalExpense, { scene: 'report' })")
  })
})
