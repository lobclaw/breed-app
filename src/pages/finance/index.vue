<template>
  <view class="finance">
    <!-- 月度汇总 -->
    <view class="finance__summary">
      <view class="finance__summary-item">
        <text class="finance__summary-label">收入</text>
        <text class="finance__summary-amount finance__summary-amount--income">¥{{ summary.totalIncome }}</text>
      </view>
      <view class="finance__summary-item">
        <text class="finance__summary-label">支出</text>
        <text class="finance__summary-amount finance__summary-amount--expense">¥{{ summary.totalExpense }}</text>
      </view>
      <view class="finance__summary-item">
        <text class="finance__summary-label">净利润</text>
        <text class="finance__summary-amount" :class="summary.netProfit >= 0 ? 'finance__summary-amount--income' : 'finance__summary-amount--expense'">
          ¥{{ summary.netProfit }}
        </text>
      </view>
    </view>

    <!-- 操作栏 -->
    <view class="finance__actions">
      <button class="finance__action-btn finance__action-btn--expense" @click="goToExpenseAdd">+ 支出</button>
      <button class="finance__action-btn finance__action-btn--income" @click="goToIncomeAdd">+ 收入</button>
      <button class="finance__action-btn" @click="goToStats">统计</button>
      <button class="finance__action-btn" @click="goToSales">销售</button>
    </view>

    <!-- 流水列表 -->
    <view class="finance__list">
      <view v-for="tx in transactions" :key="tx._id" class="finance__tx" :class="`finance__tx--${tx._txType}`">
        <view class="finance__tx-left">
          <text class="finance__tx-category">{{ tx._txType === 'expense' ? tx.category : tx.type }}<text v-if="tx.source_type === 'auto'" class="finance__tx-auto">自动</text></text>
          <text class="finance__tx-notes" v-if="tx.notes || tx.dog_names?.length">
            {{ tx.dog_names?.join('、') || tx.dog_name || '' }} {{ tx.notes || '' }}
          </text>
        </view>
        <view class="finance__tx-right">
          <text class="finance__tx-amount" :class="`finance__tx-amount--${tx._txType}`">
            {{ tx._txType === 'income' ? '+' : '-' }}¥{{ tx._txType === 'expense' ? tx.total_amount : Math.abs(tx.amount) }}
          </text>
          <text class="finance__tx-date">{{ formatDate(tx.date) }}</text>
        </view>
      </view>

      <view v-if="transactions.length === 0 && !loading" class="finance__empty">
        <text>暂无收支记录</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'

const transactions = ref<any[]>([])
const loading = ref(true)
const summary = reactive({
  totalIncome: 0,
  totalExpense: 0,
  netProfit: 0,
})

const { run: fetchTransactions } = useCloudCall<{ data: any[] }>('finance-service', 'getTransactionList')
const { run: fetchSummary } = useCloudCall<{ data: any }>('finance-service', 'getFinancialSummary')

function formatDate(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function goToExpenseAdd() {
  uni.navigateTo({ url: '/pages/finance/expense-add' })
}

function goToIncomeAdd() {
  uni.navigateTo({ url: '/pages/finance/income-add' })
}

function goToStats() {
  uni.navigateTo({ url: '/pages/finance/stats' })
}

function goToSales() {
  uni.navigateTo({ url: '/pages/sale/list' })
}

async function loadData() {
  loading.value = true
  const [txResult, sumResult] = await Promise.all([
    fetchTransactions(),
    fetchSummary('monthly'),
  ])
  if (txResult?.data) transactions.value = txResult.data
  if (sumResult?.data) {
    summary.totalIncome = sumResult.data.totalIncome || 0
    summary.totalExpense = sumResult.data.totalExpense || 0
    summary.netProfit = sumResult.data.netProfit || 0
  }
  loading.value = false
}

onShow(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.finance {
  min-height: 100vh;
  background: var(--bg);
}

.finance__summary {
  display: flex;
  justify-content: space-around;
  padding: 16px;
  background: var(--card);
  box-shadow: var(--shadow);
}

.finance__summary-item {
  text-align: center;
}

.finance__summary-label {
  display: block;
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 4px;
}

.finance__summary-amount {
  font-size: 18px;
  font-weight: 700;
  font-family: var(--font-display);
}

.finance__summary-amount--income {
  color: var(--red);
}

.finance__summary-amount--expense {
  color: var(--green);
}

.finance__actions {
  display: flex;
  gap: 6px;
  padding: 8px 16px;
  background: var(--card);
  border-top: 1px solid var(--card-dim);
}

.finance__action-btn {
  flex: 1;
  height: 32px;
  border-radius: var(--radius-btn);
  font-size: 13px;
  background: var(--bg);
  color: var(--text-1);
  padding: 0;
  line-height: 32px;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.finance__action-btn--expense {
  background: var(--green-soft);
  color: var(--green);
}

.finance__action-btn--income {
  background: var(--red-soft);
  color: var(--red);
}

.finance__list {
  padding: 8px 16px;
}

.finance__tx {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--card);
  padding: 12px;
  border-radius: var(--radius-row);
  margin-bottom: 6px;
  box-shadow: var(--shadow);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.finance__tx-left {
  flex: 1;
}

.finance__tx-category {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-1);
  display: block;
}

.finance__tx-notes {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
  display: block;
}

.finance__tx-right {
  text-align: right;
}

.finance__tx-amount {
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-display);
  display: block;
}

.finance__tx-amount--income {
  color: var(--red);
}

.finance__tx-amount--expense {
  color: var(--green);
}

.finance__tx-date {
  font-size: 11px;
  color: var(--text-4);
  margin-top: 2px;
}

.finance__tx-auto {
  font-size: 10px;
  color: var(--text-3);
  background: var(--card-dim);
  padding: 1px 4px;
  border-radius: var(--radius-checkbox);
  margin-left: 4px;
}

.finance__empty {
  text-align: center;
  padding: 40px;
  color: var(--text-3);
  font-size: 14px;
}
</style>
