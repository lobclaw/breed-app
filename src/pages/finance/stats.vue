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

<style scoped>
.stats { min-height: 100vh; background: #f5f5f5; }
.stats__tabs { display: flex; background: #fff; padding: 16rpx 32rpx; gap: 16rpx; }
.stats__tab { flex: 1; text-align: center; padding: 16rpx; border-radius: 12rpx; background: #f5f5f5; font-size: 28rpx; color: #666; }
.stats__tab--active { background: #007AFF; color: #fff; }
.stats__summary { display: flex; flex-wrap: wrap; gap: 16rpx; padding: 16rpx 32rpx; }
.stats__card { flex: 1; min-width: 40%; background: #fff; border-radius: 16rpx; padding: 24rpx; text-align: center; }
.stats__card--full { flex-basis: 100%; }
.stats__card-label { display: block; font-size: 24rpx; color: #999; margin-bottom: 8rpx; }
.stats__card-amount { font-size: 40rpx; font-weight: 700; }
.stats__card-amount--income { color: #FF3B30; }
.stats__card-amount--expense { color: #4CAF50; }
.stats__section { margin: 16rpx 32rpx; background: #fff; border-radius: 16rpx; padding: 24rpx; }
.stats__section-title { font-size: 30rpx; font-weight: 600; color: #333; margin-bottom: 16rpx; display: block; }
.stats__breakdown-item { display: flex; justify-content: space-between; padding: 12rpx 0; border-bottom: 1rpx solid #f5f5f5; font-size: 28rpx; }
.stats__breakdown-item:last-child { border-bottom: none; }
.stats__breakdown-label { color: #666; }
.stats__breakdown-amount { color: #333; font-weight: 500; }
.stats__breakdown-amount--income { color: #FF3B30; }
.stats__empty { text-align: center; padding: 40rpx; color: #999; font-size: 26rpx; }
</style>
