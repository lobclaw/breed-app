<template>
  <view class="page">
    <!-- 顶栏 -->
    <BPageHeader title="财务统计" />

    <!-- 切换 月度/年度 -->
    <view class="segmented-control">
      <view
        class="seg-item"
        :class="{ 'seg-item--active': period === 'monthly' }"
        @click="period = 'monthly'; load()"
      >
        <text>月度</text>
      </view>
      <view
        class="seg-item"
        :class="{ 'seg-item--active': period === 'yearly' }"
        @click="period = 'yearly'; load()"
      >
        <text>年度</text>
      </view>
    </view>

    <!-- 月份选择 -->
    <view class="month-selector">
      <text class="material-icons-round month-selector__arrow" @click="changeMonth(-1)">chevron_left</text>
      <text class="month-selector__text">{{ monthLabel }}</text>
      <text class="material-icons-round month-selector__arrow" @click="changeMonth(1)">chevron_right</text>
    </view>

    <!-- 骨架屏 -->
    <view v-if="loading" style="padding: 0 16px;">
      <BSkeleton :rows="3" />
    </view>

    <template v-else>
      <!-- 汇总 2x2 网格 -->
      <view class="summary-grid">
        <view class="summary-card">
          <text class="summary-card__label">总收入</text>
          <text class="summary-card__value summary-card__value--income">¥{{ formatNum(data.totalIncome) }}</text>
        </view>
        <view class="summary-card">
          <text class="summary-card__label">总支出</text>
          <text class="summary-card__value summary-card__value--expense">¥{{ formatNum(data.totalExpense) }}</text>
        </view>
        <view class="summary-card">
          <text class="summary-card__label">净利润</text>
          <text class="summary-card__value summary-card__value--primary">¥{{ formatNum(data.netProfit) }}</text>
        </view>
        <view class="summary-card">
          <text class="summary-card__label">利润率</text>
          <text class="summary-card__value summary-card__value--muted">{{ profitRate }}</text>
        </view>
      </view>

      <!-- 支出分类 -->
      <BSectionLabel title="支出分类" color="green" />
      <view class="bar-chart">
        <view v-for="(item, idx) in expenseItems" :key="item.cat" class="bar-row">
          <view class="bar-row__header">
            <text class="bar-row__name">{{ item.cat }}</text>
            <text class="bar-row__amount">¥{{ formatNum(item.amount) }}</text>
          </view>
          <view class="bar-track">
            <view
              class="bar-fill"
              :style="{ width: item.pct + '%', opacity: 1 - idx * 0.15 }"
            />
          </view>
        </view>
        <view v-if="expenseItems.length === 0" style="padding: 12px; text-align: center;">
          <text style="font-size: 13px; color: var(--text-3);">暂无数据</text>
        </view>
      </view>

      <!-- 收入来源 -->
      <BSectionLabel title="收入来源" color="red" />
      <view class="bar-chart">
        <view v-for="(item, idx) in incomeItems" :key="item.cat" class="bar-row">
          <view class="bar-row__header">
            <text class="bar-row__name">{{ item.cat }}</text>
            <text class="bar-row__amount">¥{{ formatNum(item.amount) }}</text>
          </view>
          <view class="bar-track">
            <view
              class="bar-fill bar-fill--income"
              :style="{ width: item.pct + '%', opacity: 1 - idx * 0.15 }"
            />
          </view>
        </view>
        <view v-if="incomeItems.length === 0" style="padding: 12px; text-align: center;">
          <text style="font-size: 13px; color: var(--text-3);">暂无数据</text>
        </view>
      </view>

      <!-- 详细报表导航 -->
      <BSectionLabel title="详细报表" color="rose" />
      <view class="nav-cards">
        <view class="nav-card" @click="goTo('/pages/finance/litter-profit')">
          <text class="nav-card__title">单窝利润</text>
          <text class="material-icons-round" style="font-size: 20px; color: var(--text-3);">chevron_right</text>
        </view>
        <view class="nav-card" @click="goTo('/pages/finance/dam-roi')">
          <text class="nav-card__title">种母投资回报</text>
          <text class="material-icons-round" style="font-size: 20px; color: var(--text-3);">chevron_right</text>
        </view>
        <view class="nav-card" @click="goTo('/pages/finance/projection')">
          <text class="nav-card__title">未来预估</text>
          <text class="material-icons-round" style="font-size: 20px; color: var(--text-3);">chevron_right</text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BSectionLabel from '@/components/base/BSectionLabel.vue'

const period = ref('monthly')
const loading = ref(true)
const currentMonth = ref(new Date())

const data = reactive({
  totalIncome: 0,
  totalExpense: 0,
  netProfit: 0,
  categoryBreakdown: {} as Record<string, number>,
  incomeBreakdown: {} as Record<string, number>,
})

const monthLabel = computed(() => {
  const d = currentMonth.value
  if (period.value === 'yearly') return `${d.getFullYear()}年`
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

const profitRate = computed(() => {
  if (!data.totalIncome) return '0%'
  return ((data.netProfit / data.totalIncome) * 100).toFixed(1) + '%'
})

function toSortedItems(obj: Record<string, number>) {
  const entries = Object.entries(obj).sort((a, b) => b[1] - a[1])
  const max = entries.length > 0 ? entries[0][1] : 1
  return entries.map(([cat, amount]) => ({
    cat,
    amount,
    pct: max > 0 ? (amount / max) * 100 : 0,
  }))
}

const expenseItems = computed(() => toSortedItems(data.categoryBreakdown))
const incomeItems = computed(() => toSortedItems(data.incomeBreakdown))

function changeMonth(delta: number) {
  const d = new Date(currentMonth.value)
  if (period.value === 'yearly') {
    d.setFullYear(d.getFullYear() + delta)
  } else {
    d.setMonth(d.getMonth() + delta)
  }
  currentMonth.value = d
  load()
}

function formatNum(n: number) {
  if (n == null) return '0'
  return n.toLocaleString()
}

function goTo(url: string) {
  uni.navigateTo({ url })
}

const { run: fetchSummary } = useCloudCall<{ data: any }>('finance-service', 'getFinancialSummary')

async function load() {
  loading.value = true
  const res = await fetchSummary({
    period: period.value,
    month: currentMonth.value.getMonth() + 1,
    year: currentMonth.value.getFullYear(),
  })
  if (res?.data) {
    data.totalIncome = res.data.totalIncome || 0
    data.totalExpense = res.data.totalExpense || 0
    data.netProfit = res.data.netProfit || 0
    data.categoryBreakdown = res.data.categoryBreakdown || {}
    data.incomeBreakdown = res.data.incomeBreakdown || {}
  }
  loading.value = false
}

onMounted(() => load())
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

/* ==================== SEGMENTED CONTROL ==================== */
.segmented-control {
  display: flex;
  background: var(--card-dim);
  border-radius: 12px;
  padding: 3px;
  margin: 0 var(--space-page) 12px;
}

.seg-item {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-3);
  border-radius: 10px;
  transition: all 0.2s;

  &--active {
    background: var(--card);
    color: var(--primary);
    box-shadow: var(--shadow);
  }
}

/* ==================== MONTH SELECTOR ==================== */
.month-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin: 0 var(--space-page) 16px;

  &__text {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__arrow {
    font-family: 'Material Icons Round';
    font-size: 20px;
    color: var(--text-3);
    transition: transform 0.12s ease;
    &:active { transform: scale(0.85); }
  }
}

/* ==================== SUMMARY GRID ==================== */
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 0 16px 16px;
}

.summary-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 100%;
    pointer-events: none;
  }

  & > * { position: relative; z-index: 1; }

  &__label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
    display: block;
    margin-bottom: 6px;
  }

  &__value {
    font-family: var(--font-display);
    font-weight: 800;
    line-height: 1.2;
    display: block;

    &--income { color: var(--red); font-size: 20px; }
    &--expense { color: var(--green); font-size: 20px; }
    &--primary { color: var(--primary); font-size: 24px; }
    &--muted { color: var(--text-2); font-size: 20px; }
  }
}

/* ==================== BAR CHART ==================== */
.bar-chart {
  padding: 0 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bar-row {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }

  &__amount {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 800;
    color: var(--text-2);
  }
}

.bar-track {
  height: 8px;
  background: var(--card-dim);
  border-radius: var(--radius-progress);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: var(--radius-progress);
  background: var(--green);
  transition: width 0.6s ease;

  &--income {
    background: var(--red);
  }
}

/* ==================== NAV CARDS ==================== */
.nav-cards {
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nav-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 16px 18px;
  box-shadow: var(--shadow);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:active {
    transform: scale(0.975);
    box-shadow: 0 1px 6px rgba(234, 62, 119, 0.04);
  }

  &__title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
  }
}
</style>
