<template>
  <view class="page">
    <!-- 顶栏 -->
    <BPageHeader title="财务统计" />

    <view class="stats-toolbar">
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
        <view class="month-selector__action" @click="changeMonth(-1)">
          <text class="material-icons-round month-selector__arrow">chevron_left</text>
        </view>
        <view class="month-selector__body">
          <text class="month-selector__eyebrow">{{ period === 'yearly' ? '统计年份' : '统计月份' }}</text>
          <text class="month-selector__text">{{ monthLabel }}</text>
        </view>
        <view class="month-selector__action" @click="changeMonth(1)">
          <text class="material-icons-round month-selector__arrow">chevron_right</text>
        </view>
      </view>
    </view>

    <!-- 骨架屏 -->
    <view v-if="loading" class="skeleton-wrap">
      <BSkeleton :rows="3" />
    </view>

    <template v-else>
      <!-- 汇总：净利润横跨全宽 + 收入/支出/利润率三格 -->
      <view class="summary-grid">
        <view class="summary-card summary-card--profit">
          <text class="summary-card__label">净利润</text>
          <text class="summary-card__value" :class="netProfitClass">{{ formatFinanceAmount(data.netProfit, { scene: 'report' }) }}</text>
          <view class="summary-card__meta-row">
            <text class="summary-card__rate">利润率 {{ profitRate }}</text>
            <text class="summary-card__hint">{{ periodSummaryHint }}</text>
          </view>
        </view>
        <view class="summary-card summary-card--income">
          <text class="summary-card__label">总收入</text>
          <text class="summary-card__value summary-card__value--income">{{ formatFinanceAmount(data.totalIncome, { scene: 'report' }) }}</text>
        </view>
        <view class="summary-card summary-card--expense">
          <text class="summary-card__label">总支出</text>
          <text class="summary-card__value summary-card__value--expense">{{ formatFinanceAmount(-data.totalExpense, { scene: 'report' }) }}</text>
        </view>
      </view>

      <!-- 支出分组 -->
      <view class="stats-section-card stats-section-card--green">
        <view class="stats-section-card__header">
          <view class="stats-section-card__title-wrap">
            <view class="stats-section-card__dot stats-section-card__dot--green" />
            <view class="stats-section-card__copy">
              <text class="stats-section-card__title">支出分组</text>
              <text class="stats-section-card__desc">按{{ periodSectionLabel }}支出金额排序</text>
            </view>
          </view>
          <view class="stats-section-card__badge">
            <text class="stats-section-card__badge-text">{{ expenseItems.length }}</text>
          </view>
        </view>

        <view class="bar-chart">
          <view
            v-for="(item, idx) in expenseItems"
            :key="item.cat"
            class="bar-row"
            :class="{ 'bar-row--leading': idx === 0 }"
          >
            <view class="bar-row__header">
              <text class="bar-row__name">{{ item.cat }}</text>
              <view class="bar-row__value-group">
                <text class="bar-row__amount">{{ formatFinanceAmount(-item.amount, { scene: 'report' }) }}</text>
                <text class="bar-row__share">{{ formatPercentLabel(item.sharePct) }}</text>
              </view>
            </view>
            <view class="bar-track">
              <view
                class="bar-fill"
                :style="{ width: item.pct + '%', opacity: 1 - idx * 0.12 }"
              />
            </view>
          </view>
          <view v-if="expenseItems.length === 0" class="bar-chart__empty">
            <text>当前{{ periodSectionLabel }}暂无支出分组数据</text>
          </view>
        </view>
      </view>

      <!-- 收入来源 -->
      <view class="stats-section-card stats-section-card--red">
        <view class="stats-section-card__header">
          <view class="stats-section-card__title-wrap">
            <view class="stats-section-card__dot stats-section-card__dot--red" />
            <view class="stats-section-card__copy">
              <text class="stats-section-card__title">收入来源</text>
              <text class="stats-section-card__desc">按{{ periodSectionLabel }}收入金额排序</text>
            </view>
          </view>
          <view class="stats-section-card__badge">
            <text class="stats-section-card__badge-text">{{ incomeItems.length }}</text>
          </view>
        </view>

        <view class="bar-chart">
          <view
            v-for="(item, idx) in incomeItems"
            :key="item.cat"
            class="bar-row"
            :class="{ 'bar-row--leading': idx === 0 }"
          >
            <view class="bar-row__header">
              <text class="bar-row__name">{{ item.cat }}</text>
              <view class="bar-row__value-group">
                <text class="bar-row__amount">{{ formatFinanceAmount(item.amount, { scene: 'report' }) }}</text>
                <text class="bar-row__share">{{ formatPercentLabel(item.sharePct) }}</text>
              </view>
            </view>
            <view class="bar-track">
              <view
                class="bar-fill bar-fill--income"
                :style="{ width: item.pct + '%', opacity: 1 - idx * 0.12 }"
              />
            </view>
          </view>
          <view v-if="incomeItems.length === 0" class="bar-chart__empty">
            <text>当前{{ periodSectionLabel }}暂无收入来源数据</text>
          </view>
        </view>
      </view>

    </template>

    <!-- 专项报表导航 -->
    <view class="report-hub">
      <view class="report-hub__header">
          <view class="report-hub__title-wrap">
            <view class="report-hub__dot" />
            <view class="report-hub__copy">
              <text class="report-hub__title">专项报表</text>
              <text class="report-hub__desc">以下报表按累计口径展示，不跟随上方月份或年份切换</text>
            </view>
          </view>
        </view>

      <view class="nav-cards">
        <view class="nav-card" @click="goTo('/pages/finance/litter-profit')">
          <view class="nav-card__copy">
            <text class="nav-card__eyebrow">按对象查看</text>
            <text class="nav-card__title">单窝利润</text>
            <text class="nav-card__desc">按窝查看累计收入、支出与净利润</text>
          </view>
          <text class="material-icons-round nav-card__chevron">chevron_right</text>
        </view>
        <view class="nav-card" @click="goTo('/pages/finance/dam-roi')">
          <view class="nav-card__copy">
            <text class="nav-card__eyebrow">按对象查看</text>
            <text class="nav-card__title">种母投资回报</text>
            <text class="nav-card__desc">按种母查看累计投入与回报</text>
          </view>
          <text class="material-icons-round nav-card__chevron">chevron_right</text>
        </view>
        <view class="nav-card" @click="goTo('/pages/finance/projection')">
          <view class="nav-card__copy">
            <text class="nav-card__eyebrow">经营预估</text>
            <text class="nav-card__title">未来预估</text>
            <text class="nav-card__desc">基于历史均值查看后续经营预估</text>
          </view>
          <text class="material-icons-round nav-card__chevron">chevron_right</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import { formatFinanceAmount } from '@/utils/financeDisplay'

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

const periodSummaryHint = computed(() => (period.value === 'yearly' ? '当前年度汇总' : '当前月度汇总'))
const periodSectionLabel = computed(() => (period.value === 'yearly' ? '本年' : '本月'))

const profitRate = computed(() => {
  if (!data.totalIncome) return '0%'
  return ((data.netProfit / data.totalIncome) * 100).toFixed(1) + '%'
})

const netProfitClass = computed(() => {
  if (data.netProfit > 0) return 'summary-card__value--profit-positive'
  if (data.netProfit < 0) return 'summary-card__value--profit-negative'
  return 'summary-card__value--profit-neutral'
})

function toSortedItems(obj: Record<string, number>) {
  const entries = Object.entries(obj).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0)
  const max = entries.length > 0 ? entries[0][1] : 1
  return entries.map(([cat, amount], idx) => ({
    cat,
    amount,
    rank: idx + 1,
    pct: max > 0 ? (amount / max) * 100 : 0,
    sharePct: total > 0 ? (amount / total) * 100 : 0,
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

function formatPercentLabel(n: number) {
  if (!n) return '0%'
  return `${n.toFixed(n >= 10 ? 0 : 1)}%`
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

onShow(() => load())
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

.stats-toolbar {
  padding: 4px var(--space-page) 0;
}

/* ==================== SEGMENTED CONTROL ==================== */
.segmented-control {
  display: flex;
  background: linear-gradient(180deg, rgba(255, 243, 236, 0.98) 0%, rgba(255, 239, 231, 0.88) 100%);
  border-radius: 16px;
  padding: 4px;
  border: 1px solid rgba(216, 203, 189, 0.22);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.68);
}

.seg-item {
  flex: 1;
  text-align: center;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-3);
  border-radius: 12px;
  transition: all 0.2s;

  &--active {
    background: var(--card);
    color: var(--primary);
    box-shadow: 0 6px 18px rgba(234, 62, 119, 0.08);
  }
}

/* ==================== MONTH SELECTOR ==================== */
.month-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 14px 0 10px;

  &__body {
    min-width: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  &__eyebrow {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-3);
    letter-spacing: 0.04em;
  }

  &__text {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 800;
    color: var(--text-1);
  }

  &__action {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 250, 247, 0.9);
    border: 1px solid rgba(216, 203, 189, 0.18);
    transition: transform 0.12s ease, background 0.12s ease;

    &:active {
      transform: scale(0.92);
      background: rgba(255, 243, 236, 0.96);
    }
  }

  &__arrow {
    font-family: 'Material Icons Round';
    font-size: 20px;
    color: var(--text-2);
  }
}

/* ==================== SKELETON ==================== */
.skeleton-wrap {
  padding: 0 var(--space-page);
}

/* ==================== SUMMARY GRID ==================== */
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 2px var(--space-page) 18px;
}

.summary-card {
  background: var(--card);
  border-radius: 20px;
  padding: 16px 16px 14px;
  box-shadow: 0 10px 28px rgba(99, 70, 49, 0.06);
  border: 1px solid rgba(216, 203, 189, 0.2);

  &--profit {
    grid-column: 1 / -1;
    background: linear-gradient(135deg, rgba(255, 243, 247, 0.96) 0%, rgba(255, 255, 255, 0.98) 62%);
    border: 1px solid rgba(234, 62, 119, 0.14);
  }

  &--income {
    border-top: 3px solid var(--red);
  }

  &--expense {
    border-top: 3px solid var(--green);
  }

  &__label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
    display: block;
    margin-bottom: 8px;
  }

  &__value {
    font-family: var(--font-display);
    font-weight: 800;
    line-height: 1.2;
    display: block;

    &--income { color: var(--red); font-size: 20px; }
    &--expense { color: var(--green); font-size: 20px; }
    &--profit-positive { color: var(--primary); font-size: 28px; }
    &--profit-negative { color: var(--red); font-size: 28px; }
    &--profit-neutral { color: var(--text-2); font-size: 28px; }
  }

  &__meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 6px;
  }

  &__rate,
  &__hint {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
    display: block;
  }

  &__hint {
    text-align: right;
  }
}

/* ==================== STATS SECTION ==================== */
.stats-section-card {
  margin: 0 var(--space-page) 14px;
  padding: 14px 14px 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(216, 203, 189, 0.22);
  box-shadow: 0 10px 26px rgba(99, 70, 49, 0.055);

  &--green {
    border-color: rgba(61, 174, 111, 0.16);
  }

  &--red {
    border-color: rgba(224, 82, 82, 0.14);
  }

  &--rose {
    border-color: rgba(234, 62, 119, 0.14);
  }

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  &__title-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-top: 5px;
    flex-shrink: 0;

    &--green { background: var(--green); }
    &--red { background: var(--red); }
    &--rose { background: var(--rose); }
  }

  &__copy {
    min-width: 0;
  }

  &__title {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-2);
  }

  &__desc {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    line-height: 1.45;
    color: var(--text-3);
  }

  &__badge {
    flex-shrink: 0;
    min-width: 28px;
    height: 24px;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(255, 243, 236, 0.92);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  &__badge-text {
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 800;
    color: var(--text-2);
  }
}

/* ==================== BAR CHART ==================== */
.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__empty {
    padding: 14px 0 10px;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
  }
}

.bar-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 2px;

  &--leading {
    .bar-row__name {
      color: var(--text-1);
    }

    .bar-row__amount {
      color: var(--text-1);
    }
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
  }

  &__name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-1);
    flex: 1;
    min-width: 0;
  }

  &__value-group {
    flex-shrink: 0;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  &__amount {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 800;
    color: var(--text-2);
  }

  &__share {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-3);
    min-width: 36px;
    text-align: right;
  }
}

.bar-track {
  height: 9px;
  background: linear-gradient(180deg, rgba(255, 243, 236, 0.9) 0%, rgba(255, 239, 231, 0.72) 100%);
  border-radius: var(--radius-progress);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: var(--radius-progress);
  background: linear-gradient(90deg, #44b773 0%, #53c784 100%);
  transition: width 0.6s ease;

  &--income {
    background: linear-gradient(90deg, #ef6060 0%, #f36d7f 100%);
  }
}

/* ==================== REPORT HUB ==================== */
.report-hub {
  margin: 12px var(--space-page) 0;
  padding-top: 12px;
  border-top: 1px solid rgba(234, 62, 119, 0.12);

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  &__title-wrap {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-top: 5px;
    flex-shrink: 0;
    background: var(--rose);
  }

  &__copy {
    min-width: 0;
  }

  &__title {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-2);
  }

  &__desc {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    line-height: 1.45;
    color: var(--text-3);
  }

}

/* ==================== NAV CARDS ==================== */
.nav-cards {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-card {
  min-height: 78px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(255, 250, 247, 0.98) 100%);
  border-radius: 18px;
  border: 1px solid rgba(216, 203, 189, 0.22);
  box-shadow: 0 10px 22px rgba(99, 70, 49, 0.04);
  padding: 13px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;

  &:active {
    transform: scale(0.975);
    box-shadow: 0 8px 18px rgba(234, 62, 119, 0.07);
    border-color: rgba(234, 62, 119, 0.14);
  }

  &__copy {
    flex: 1;
    min-width: 0;
  }

  &__eyebrow {
    display: block;
    font-size: 10px;
    font-weight: 700;
    color: var(--text-4);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  &__title {
    display: block;
    margin-top: 3px;
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__desc {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-3);
  }

  &__chevron {
    font-size: 20px;
    color: var(--text-3);
    flex-shrink: 0;
  }
}
</style>
