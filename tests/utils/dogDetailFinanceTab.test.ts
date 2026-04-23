import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/dog/detail.vue'), 'utf8')

describe('dog detail finance tab contract', () => {
  it('顶部快捷入口应只保留记录支出和记录收入', () => {
    expect(source).toContain('class="dog-detail__finance-link dog-detail__finance-link--expense" @click="goToExpenseAdd()"')
    expect(source).toContain('class="dog-detail__finance-link dog-detail__finance-link--income" @click="goToIncomeAdd()"')
    expect(source).not.toContain('class="dog-detail__finance-link" @click="goToDamRoi()"')
  })

  it('种母应改为投资回报标题右侧查看全部，并补拉 ROI 摘要数据', () => {
    expect(source).toContain(`const isDamFinanceDog = computed(() => dog.value?.role === '种狗' && dog.value?.gender === '母')`)
    expect(source).toContain(`const financeSummaryTitle = computed(() => isDamFinanceDog.value ? '投资回报' : '财务概览')`)
    expect(source).toContain('v-if="isDamFinanceDog" class="dog-detail__sec-link" @click="goToDamRoi()">查看全部</text>')
    expect(source).toContain("const { run: fetchDamRoi } = useCloudCall<{ data: any }>('finance-service', 'getDamRoi')")
    expect(source).toContain("label: '繁育支出'")
    expect(source).toContain("label: '个体费用'")
    expect(source).toContain("label: '繁育收入'")
    expect(source).toContain("label: '累计净收益'")
    expect(source).toContain("parts: formatFinanceOverviewAmountParts(netProfit)")
  })

  it('最近收支应支持查看全部并跳到带犬只筛选的财务页', () => {
    expect(source).toContain('<text class="dog-detail__sec-text">最近收支</text>')
    expect(source).toContain('<text class="dog-detail__sec-link" @click="goToFinanceList()">查看全部</text>')
    expect(source).toContain("uni.navigateTo({ url: `/pages/finance/index?dogId=${dogId}&dogName=${dogName}` })")
    expect(source).toContain("return tx?._txType === 'income' ? `+${formattedAmount}` : formattedAmount")
  })
})
