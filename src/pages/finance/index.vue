<template>
  <view class="page">
    <!-- 页面标题 + 统计图标 -->
    <view class="page-header">
      <view class="page-header__row">
        <text class="page-header__title">财务</text>
        <view class="page-header__actions">
          <view class="page-header__btn" @click="showAddSheet = true">
            <text class="material-icons-round" style="font-size: 22px; color: var(--primary);">add</text>
          </view>
          <view class="page-header__icon" @click="goToStats">
            <text class="material-icons-round" style="font-size: 22px; color: var(--text-2);">bar_chart</text>
          </view>
        </view>
      </view>
      <!-- 月份选择 -->
      <view class="month-selector">
        <text class="material-icons-round month-selector__arrow" @click="changeMonth(-1)">chevron_left</text>
        <text class="month-selector__text">{{ monthLabel }}</text>
        <text class="material-icons-round month-selector__arrow" @click="changeMonth(1)">chevron_right</text>
      </view>
    </view>

    <!-- 汇总卡片 -->
    <view class="summary-card">
      <view class="summary-card__item">
        <text class="summary-card__label">本月收入</text>
        <text class="summary-card__amount summary-card__amount--income">¥{{ formatNum(summary.totalIncome) }}</text>
      </view>
      <view class="summary-card__divider" />
      <view class="summary-card__item">
        <text class="summary-card__label">本月支出</text>
        <text class="summary-card__amount summary-card__amount--expense">¥{{ formatNum(summary.totalExpense) }}</text>
      </view>
      <view class="summary-card__divider" />
      <view class="summary-card__item">
        <text class="summary-card__label">净利润</text>
        <text class="summary-card__amount summary-card__amount--profit">¥{{ formatNum(summary.netProfit) }}</text>
      </view>
    </view>

    <!-- 筛选 Tabs -->
    <view class="filter-tabs">
      <view
        v-for="f in typeFilters"
        :key="f.value"
        class="filter-tab"
        :class="{ 'filter-tab--active': activeFilter === f.value }"
        @click="switchFilter(f.value)"
      >
        <text>{{ f.label }}</text>
      </view>
      <view v-if="activeFilter !== 'income'" style="margin-left: auto; padding-right: 4px;" @click="showCategoryFilter = true">
        <text class="material-icons-round" :style="{ fontSize: '22px', color: selectedCategory ? 'var(--primary)' : 'var(--text-2)' }">tune</text>
      </view>
    </view>

    <!-- 骨架屏 -->
    <view v-if="loading" style="padding: 0 16px;">
      <BSkeleton :rows="4" />
    </view>

    <!-- 流水列表 -->
    <view v-else-if="transactions.length > 0" class="card-feed">
      <view
        v-for="tx in transactions"
        :key="tx._id"
        class="flow-card"
        :class="tx._txType === 'income' ? 'flow-card--income' : 'flow-card--expense'"
        @click="goToTxDetail(tx)"
      >
        <view class="flow-item">
          <view class="flow-dot" :class="tx._txType === 'income' ? 'flow-dot--income' : 'flow-dot--expense'" />
          <BIconBox
            :icon="getFlowIcon(tx)"
            :color="getFlowIconColor(tx)"
          />
          <view class="flow-middle">
            <text class="flow-desc">{{ tx._txType === 'expense' ? tx.category : tx.type }}</text>
            <text class="flow-dog">{{ tx.dog_names?.join('、') || tx.dog_name || '' }}</text>
          </view>
          <view class="flow-right">
            <text class="flow-amount" :class="tx._txType === 'income' ? 'flow-amount--income' : 'flow-amount--expense'">
              {{ tx._txType === 'income' ? '+' : '-' }}¥{{ formatNum(tx._txType === 'expense' ? tx.total_amount : Math.abs(tx.amount)) }}
            </text>
            <text class="flow-date">{{ formatDate(tx.date) }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <BEmpty
      v-else
      icon="receipt_long"
      title="暂无收支记录"
      description="点击右下角 + 开始记录"
    />

    <!-- 添加收支 Sheet -->
    <BSheet v-model:visible="showAddSheet" title="添加记录" height="auto">
      <view class="add-sheet">
        <view class="add-sheet__item" @click="goToExpenseAdd">
          <view class="add-sheet__icon add-sheet__icon--expense">
            <text class="material-icons-round" style="font-size: 20px; color: var(--red);">remove_circle</text>
          </view>
          <view class="add-sheet__info">
            <text class="add-sheet__title">记录支出</text>
            <text class="add-sheet__desc">食品、医疗、日常开销等</text>
          </view>
          <text class="material-icons-round" style="font-size: 18px; color: var(--text-4);">chevron_right</text>
        </view>
        <view class="add-sheet__item" @click="goToIncomeAdd">
          <view class="add-sheet__icon add-sheet__icon--income">
            <text class="material-icons-round" style="font-size: 20px; color: var(--green);">add_circle</text>
          </view>
          <view class="add-sheet__info">
            <text class="add-sheet__title">记录收入</text>
            <text class="add-sheet__desc">幼犬销售、定金等</text>
          </view>
          <text class="material-icons-round" style="font-size: 18px; color: var(--text-4);">chevron_right</text>
        </view>
      </view>
    </BSheet>

    <!-- 分类筛选 Sheet -->
    <BSheet v-model:visible="showCategoryFilter" title="按分类筛选" height="auto">
      <view class="category-filter">
        <view
          class="category-pill"
          :class="{ 'category-pill--active': !selectedCategory }"
          @click="applyCategory('')"
        >
          <text class="category-pill__text">全部分类</text>
        </view>
        <view
          v-for="cat in expenseCategoryOptions"
          :key="cat"
          class="category-pill"
          :class="{ 'category-pill--active': selectedCategory === cat }"
          @click="applyCategory(cat)"
        >
          <text class="category-pill__text">{{ cat }}</text>
        </view>
      </view>
    </BSheet>

    <!-- 底部导航 -->
    <BNavBar current="finance" />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BNavBar from '@/components/layout/BNavBar.vue'
import BIconBox from '@/components/base/BIconBox.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSheet from '@/components/layout/BSheet.vue'

const transactions = ref<any[]>([])
const loading = ref(false)
const activeFilter = ref('')
const showCategoryFilter = ref(false)
const showAddSheet = ref(false)
const selectedCategory = ref('')

const DEFAULT_EXPENSE_CATEGORIES = ['食品', '营养品', '消耗品', '日常用品', '固定开销', '交通', '医疗', '配种费', '其他']
const customExpenseCategories = ref<string[]>([])
const expenseCategoryOptions = computed(() => [...DEFAULT_EXPENSE_CATEGORIES, ...customExpenseCategories.value])

const { run: fetchCategories } = useCloudCall<{ data: Array<{ name: string; is_default: boolean }> }>('finance-service', 'getExpenseCategories')

async function loadCategories() {
  const res = await fetchCategories()
  if (res?.data) {
    customExpenseCategories.value = res.data.filter((c: any) => !c.is_default).map((c: any) => c.name)
  }
}

function switchFilter(type: string) {
  activeFilter.value = type
  if (type === 'income') selectedCategory.value = ''
  loadData()
}

function applyCategory(cat: string) {
  selectedCategory.value = cat
  showCategoryFilter.value = false
  loadData()
}
const currentMonth = ref(new Date())

const summary = reactive({
  totalIncome: 0,
  totalExpense: 0,
  netProfit: 0,
})

const typeFilters = [
  { label: '全部', value: '' },
  { label: '收入', value: 'income' },
  { label: '支出', value: 'expense' },
]

const monthLabel = computed(() => {
  const d = currentMonth.value
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

function changeMonth(delta: number) {
  const d = new Date(currentMonth.value)
  d.setMonth(d.getMonth() + delta)
  currentMonth.value = d
  loadData()
}

const { run: fetchTransactions } = useCloudCall<{ data: any[] }>('finance-service', 'getTransactionList')
const { run: fetchSummary } = useCloudCall<{ data: any }>('finance-service', 'getFinancialSummary')

function formatDate(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function formatNum(n: number) {
  if (n == null) return '0'
  return n.toLocaleString()
}

function getFlowIcon(tx: any) {
  if (tx._txType === 'income') {
    if (tx.type === '定金保留') return 'savings'
    return 'paid'
  }
  const map: Record<string, string> = {
    '食品': 'restaurant',
    '医疗': 'medication',
    '配种费': 'favorite',
    '固定开销': 'home',
  }
  return map[tx.category] || 'receipt_long'
}

function getFlowIconColor(tx: any): 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal' {
  if (tx._txType === 'income') {
    if (tx.type === '定金保留') return 'amber'
    return 'green'
  }
  const map: Record<string, any> = {
    '食品': 'red',
    '医疗': 'plum',
    '配种费': 'rose',
  }
  return map[tx.category] || 'green'
}


function goToStats() {
  uni.navigateTo({ url: '/pages/finance/stats' })
}

function goToExpenseAdd() {
  showAddSheet.value = false
  uni.navigateTo({ url: '/pages/finance/expense-add' })
}

function goToIncomeAdd() {
  showAddSheet.value = false
  uni.navigateTo({ url: '/pages/finance/income-add' })
}

function goToTxDetail(tx: any) {
  if (tx._txType === 'expense') {
    uni.navigateTo({ url: '/pages/finance/expense-detail?id=' + tx._id })
  } else {
    uni.navigateTo({ url: '/pages/finance/income-detail?id=' + tx._id })
  }
}

async function loadData() {
  // 无闪烁切换：有数据时不显示骨架屏，直接替换
  const hasData = transactions.value.length > 0
  if (!hasData) loading.value = true

  const monthParams = {
    month: currentMonth.value.getMonth() + 1,
    year: currentMonth.value.getFullYear(),
  }
  const [txResult, sumResult] = await Promise.all([
    fetchTransactions({
      type: activeFilter.value || undefined,
      category: selectedCategory.value || undefined,
      ...monthParams,
    }),
    fetchSummary({ period: 'monthly', ...monthParams }),
  ])
  if (txResult?.data) {
    transactions.value = txResult.data
  }
  if (sumResult?.data) {
    summary.totalIncome = sumResult.data.totalIncome || 0
    summary.totalExpense = sumResult.data.totalExpense || 0
    summary.netProfit = sumResult.data.netProfit || 0
  }
  loading.value = false
}

onShow(() => {
  loadData()
  loadCategories()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

/* ==================== PAGE HEADER ==================== */
.page-header {
  padding: 12px var(--space-page) 0;

  &__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__title {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 800;
    color: var(--text-1);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background 0.12s ease;
    &:active { background: var(--primary-soft); }
  }

  &__icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: transform 0.12s ease;
    &:active { transform: scale(0.85); }
  }
}

/* ==================== MONTH SELECTOR ==================== */
.month-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 8px 0 0;

  &__text {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__arrow {
    font-family: 'Material Icons Round';
    font-size: 20px;
    color: var(--text-2);
    transition: transform 0.12s ease;
    &:active { transform: scale(0.85); }
  }
}

/* ==================== SUMMARY CARD ==================== */
.summary-card {
  margin: 14px 16px 0;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 18px 20px;
  box-shadow: var(--shadow);
  display: flex;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
  border-left: 3.5px solid var(--primary);

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 100%;
    background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%);
    pointer-events: none;
  }

  & > * { position: relative; z-index: 1; }

  &__item {
    text-align: center;
    flex: 1;
  }

  &__label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    display: block;
    margin-bottom: 4px;
  }

  &__amount {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 800;
  }

  &__amount--income { color: var(--red); }
  &__amount--expense { color: var(--green); }
  &__amount--profit { color: var(--primary); }

  &__divider {
    width: 1px;
    background: var(--text-4);
    opacity: 0.5;
    margin: 0 8px;
  }
}

/* ==================== FILTER TABS ==================== */
.filter-tabs {
  display: flex;
  gap: 8px;
  padding: 14px 16px 0;
  overflow-x: auto;
  align-items: center;
}

.filter-tab {
  font-size: 13px;
  font-weight: 600;
  padding: 6px 16px;
  border-radius: var(--radius-tag);
  white-space: nowrap;
  background: var(--card);
  color: var(--text-2);
  border: 1.5px solid var(--text-4);
  transition: transform 0.12s ease;
  &:active { transform: scale(0.94); }

  &--active {
    background: var(--primary);
    color: #fff;
    border-color: var(--primary);
  }
}

/* ==================== CARD FEED ==================== */
.card-feed {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.flow-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: var(--space-card);
  padding-left: var(--space-card-left);
  position: relative;
  box-shadow: var(--shadow);
  overflow: hidden;
  border-left: 3.5px solid transparent;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:active {
    transform: scale(0.975);
    box-shadow: 0 1px 4px rgba(234, 62, 119, 0.04);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 100%;
    pointer-events: none;
  }

  & > * { position: relative; z-index: 1; }

  &--income {
    border-left-color: var(--red);
    &::before { background: linear-gradient(135deg, var(--red-soft) 0%, transparent 40%); }
  }

  &--expense {
    border-left-color: var(--green);
    &::before { background: linear-gradient(135deg, var(--green-soft) 0%, transparent 40%); }
  }
}

.flow-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.flow-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  &--income { background: var(--red); }
  &--expense { background: var(--green); }
}

.flow-middle {
  flex: 1;
  min-width: 0;
}

.flow-desc {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  display: block;
}

.flow-dog {
  font-size: 11px;
  color: var(--text-2);
  margin-top: 1px;
  display: block;
}

.flow-right {
  text-align: right;
  flex-shrink: 0;
}

.flow-amount {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  display: block;
  &--income { color: var(--red); }
  &--expense { color: var(--green); }
}

.flow-date {
  font-size: 10px;
  color: var(--text-3);
  margin-top: 2px;
  display: block;
}

/* ==================== CATEGORY FILTER ==================== */
.category-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px var(--space-page) 24px;
}

.category-pill {
  padding: 7px 16px;
  border-radius: 999px;
  background: var(--card-dim);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  transition: all 0.12s ease;
  &:active { transform: scale(0.94); }

  &--active {
    background: var(--primary-soft);
    color: var(--primary);
  }

  &__text {
    font-size: 13px;
    font-weight: 600;
    color: inherit;
  }
}

/* ==================== ADD SHEET ==================== */
.add-sheet {
  padding: 0 var(--space-page) var(--space-page);
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--card-dim);
    border-radius: var(--radius-card);
    transition: opacity 0.12s ease;
    &:active { opacity: 0.75; }
  }

  &__icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-icon);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    &--expense { background: var(--red-soft); }
    &--income { background: var(--green-soft); }
  }

  &__info { flex: 1; }

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
    display: block;
  }

  &__desc {
    font-size: 12px;
    color: var(--text-3);
    margin-top: 2px;
    display: block;
  }
}
</style>
