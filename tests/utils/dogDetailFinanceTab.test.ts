import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/dog/detail.vue'), 'utf8')
const financeSource = readFileSync(resolve(testDir, '../../src/pages/dog/composables/useDogDetailFinance.ts'), 'utf8')

describe('dog detail finance tab contract', () => {
  it('顶部快捷入口应只保留记录支出和记录收入', () => {
    expect(source).toContain('class="dog-detail__finance-link dog-detail__finance-link--expense" @click="goToExpenseAdd()"')
    expect(source).toContain('class="dog-detail__finance-link dog-detail__finance-link--income" @click="goToIncomeAdd()"')
    expect(source).not.toContain('class="dog-detail__finance-link" @click="goToDamRoi()"')
  })

  it('种母应改为投资回报标题右侧查看全部，并补拉 ROI 摘要数据', () => {
    expect(financeSource).toContain(`const isDamFinanceDog = computed(() => options.dog.value?.role === '种狗' && options.dog.value?.gender === '母')`)
    expect(financeSource).toContain(`const financeSummaryTitle = computed(() => isDamFinanceDog.value ? '投资回报' : '财务概览')`)
    expect(source).toContain('v-if="isDamFinanceDog" class="dog-detail__sec-link" @click="goToDamRoi()">查看全部</text>')
    expect(financeSource).toContain('getLocalDamRoi')
    expect(source).not.toContain("useCloudCall<{ data: any }>('finance-service', 'getDamRoi')")
    expect(financeSource).toContain("label: '繁育支出'")
    expect(financeSource).toContain("label: '个体费用'")
    expect(financeSource).toContain("label: '繁育收入'")
    expect(financeSource).toContain("label: '累计净收益'")
    expect(financeSource).toContain("parts: formatFinanceOverviewAmountParts(netProfit)")
  })

  it('种母 ROI 应在财务 tab 按需加载，不阻塞详情首屏', () => {
    const loadDataSource = source.slice(
      source.indexOf('async function loadData'),
      source.indexOf('watch([activeTab, activeCycleId]'),
    )

    expect(financeSource).toContain('async function ensureDamFinanceRoi(force = false)')
    expect(source).toContain("if (tab === 'finance')")
    expect(source).toContain('void ensureDamFinanceRoi()')
    expect(loadDataSource).not.toContain('getLocalDamRoi(')
    expect(loadDataSource).toContain('loadFinanceSummary({')
    expect(financeSource).toContain('getLocalDogFinanceSummary(input.familyId, input.dogId)')
  })

  it('最近收支应支持查看全部并跳到带犬只筛选的财务页', () => {
    expect(source).toContain('<text class="dog-detail__sec-text">最近收支</text>')
    expect(source).toContain('<text class="dog-detail__sec-link" @click="goToFinanceList()">查看全部</text>')
    expect(financeSource).toContain('const familyId = options.getFamilyId()')
    expect(financeSource).toContain("uni.setStorageSync(FINANCE_ENTRY_DOG_FILTER_KEY, JSON.stringify({ familyId, dogId, dogName }))")
    expect(financeSource).toContain("url: '/pages/finance/index'")
    expect(financeSource).toContain("return tx?._txType === 'income' ? `+${formattedAmount}` : formattedAmount")
  })

  it('最近收支标题应使用业务类型，备注只追加到副标题', () => {
    expect(financeSource).toContain("return category ? normalizeExpenseCategoryName(category) : '支出记录'")
    expect(financeSource).toContain("return type ? normalizeIncomeType(type) : '收入记录'")
    expect(financeSource).toContain('const FINANCE_RECENT_NOTE_MAX_LENGTH = 14')
    expect(financeSource).toContain('return appendFinanceRecentNote(subtitle, tx)')
    expect(financeSource).not.toContain("return tx?.notes || tx?.category || '支出记录'")
    expect(financeSource).not.toContain("return tx?.notes || tx?.type || '收入记录'")
  })

  it('财务 tab 数据和交互编排应下沉到 useDogDetailFinance', () => {
    expect(source.split('\n').length).toBeLessThan(5600)
    expect(source).toContain("import { useDogDetailFinance } from './composables/useDogDetailFinance'")
    expect(source).toContain('} = useDogDetailFinance({')
    expect(financeSource).toContain('export function useDogDetailFinance')
    expect(financeSource).toContain('async function loadFinanceSummary')
    expect(financeSource).toContain('function goToFinanceDetail')
  })
})
