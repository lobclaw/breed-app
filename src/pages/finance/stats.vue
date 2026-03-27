<template>
  <view class="stats">
    <!-- 切换周期 -->
    <view class="stats__tabs">
      <view class="stats__tab" :class="{ 'stats__tab--active': period === 'monthly' }" @click="period = 'monthly'; load()">
        <text>月度</text>
      </view>
      <view class="stats__tab" :class="{ 'stats__tab--active': period === 'yearly' }" @click="period = 'yearly'; load()">
        <text>年度</text>
      </view>
    </view>

    <!-- 汇总 -->
    <view class="stats__summary">
      <view class="stats__card">
        <text class="stats__card-label">总收入</text>
        <text class="stats__card-amount stats__card-amount--income">¥{{ data.totalIncome }}</text>
      </view>
      <view class="stats__card">
        <text class="stats__card-label">总支出</text>
        <text class="stats__card-amount stats__card-amount--expense">¥{{ data.totalExpense }}</text>
      </view>
      <view class="stats__card stats__card--full">
        <text class="stats__card-label">净利润</text>
        <text class="stats__card-amount" :class="data.netProfit >= 0 ? 'stats__card-amount--income' : 'stats__card-amount--expense'">
          ¥{{ data.netProfit }}
        </text>
      </view>
    </view>

    <!-- 支出分类明细 -->
    <view class="stats__section">
      <text class="stats__section-title">支出分类</text>
      <view v-for="(amount, cat) in data.categoryBreakdown" :key="cat" class="stats__breakdown-item">
        <text class="stats__breakdown-label">{{ cat }}</text>
        <text class="stats__breakdown-amount">¥{{ amount }}</text>
      </view>
      <view v-if="Object.keys(data.categoryBreakdown).length === 0" class="stats__empty">
        <text>暂无数据</text>
      </view>
    </view>

    <!-- 收入分类明细 -->
    <view class="stats__section">
      <text class="stats__section-title">收入分类</text>
      <view v-for="(amount, type) in data.incomeBreakdown" :key="type" class="stats__breakdown-item">
        <text class="stats__breakdown-label">{{ type }}</text>
        <text class="stats__breakdown-amount stats__breakdown-amount--income">¥{{ amount }}</text>
      </view>
      <view v-if="Object.keys(data.incomeBreakdown).length === 0" class="stats__empty">
        <text>暂无数据</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useCloudCall } from '@/composables/useCloudCall'

const period = ref('monthly')
const data = reactive({
  totalIncome: 0,
  totalExpense: 0,
  netProfit: 0,
  categoryBreakdown: {} as Record<string, number>,
  incomeBreakdown: {} as Record<string, number>,
})

const { run: fetchSummary } = useCloudCall<{ data: any }>('finance-service', 'getFinancialSummary')

async function load() {
  const res = await fetchSummary(period.value)
  if (res?.data) {
    data.totalIncome = res.data.totalIncome || 0
    data.totalExpense = res.data.totalExpense || 0
    data.netProfit = res.data.netProfit || 0
    data.categoryBreakdown = res.data.categoryBreakdown || {}
    data.incomeBreakdown = res.data.incomeBreakdown || {}
  }
}

onMounted(() => load())
</script>

<style lang="scss" scoped>
.stats {
  min-height: 100vh;
  background: var(--bg);
}

.stats__tabs {
  display: flex;
  background: var(--card);
  padding: 8px 16px;
  gap: 8px;
}

.stats__tab {
  flex: 1;
  text-align: center;
  padding: 8px;
  border-radius: var(--radius-row);
  background: var(--bg);
  font-size: 14px;
  color: var(--text-2);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.stats__tab--active {
  background: var(--primary);
  color: var(--card);
}

.stats__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 16px;
}

.stats__card {
  flex: 1;
  min-width: 40%;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 12px;
  text-align: center;
  box-shadow: var(--shadow);
}

.stats__card--full {
  flex-basis: 100%;
}

.stats__card-label {
  display: block;
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 4px;
}

.stats__card-amount {
  font-size: 20px;
  font-weight: 700;
  font-family: var(--font-display);
}

.stats__card-amount--income {
  color: var(--red);
}

.stats__card-amount--expense {
  color: var(--green);
}

.stats__section {
  margin: 8px 16px;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 12px;
  box-shadow: var(--shadow);
}

.stats__section-title {
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--text-1);
  margin-bottom: 8px;
  display: block;
}

.stats__breakdown-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--bg);
  font-size: 14px;
}

.stats__breakdown-item:last-child {
  border-bottom: none;
}

.stats__breakdown-label {
  color: var(--text-2);
}

.stats__breakdown-amount {
  color: var(--text-1);
  font-weight: 500;
  font-family: var(--font-display);
}

.stats__breakdown-amount--income {
  color: var(--red);
}

.stats__empty {
  text-align: center;
  padding: 20px;
  color: var(--text-3);
  font-size: 13px;
}
</style>
