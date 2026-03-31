<template>
  <view class="page">
    <BPageHeader title="单窝利润" />

    <!-- 窝选择器 -->
    <view class="dropdown-selector" @click="showLitterPicker">
      <text class="dd-text">{{ selectedLitterName || '选择窝' }}</text>
      <text class="material-icons-round">expand_more</text>
    </view>

    <BLitterSelector v-model:visible="showLitterPickerVisible" @select="onLitterSelect" />

    <!-- 利润卡片 -->
    <view v-if="profitData" class="profit-card">
      <view class="profit-row">
        <text class="profit-label">收入</text>
        <text class="profit-value income">¥{{ formatMoney(profitData.totalIncome) }}</text>
      </view>
      <view class="profit-row">
        <text class="profit-label">支出</text>
        <text class="profit-value expense">¥{{ formatMoney(profitData.totalCost) }}</text>
      </view>
      <view class="profit-divider" />
      <view class="profit-big">
        <text class="profit-label">净利润</text>
        <text class="profit-value primary">¥{{ formatMoney(profitData.netProfit) }}</text>
      </view>
      <view class="profit-sub-row">
        <text class="profit-label">每只均摊成本</text>
        <text class="profit-value">¥{{ formatMoney(profitData.costPerPuppy) }}</text>
      </view>
      <view class="profit-sub-row">
        <text class="profit-label">存活幼崽</text>
        <text class="profit-value">{{ profitData.puppyCount }}只</text>
      </view>
    </view>

    <!-- 收入明细 -->
    <view v-if="profitData" class="section-label">
      <view class="section-dot" style="background:var(--red)" />
      <text>收入明细</text>
      <view class="section-badge">
        <text>{{ incomeItems.length }}</text>
      </view>
    </view>
    <view v-if="profitData" class="detail-list">
      <view v-for="item in incomeItems" :key="item.id" class="detail-item">
        <view class="detail-item-left">
          <text class="detail-item-name">{{ item.name }}</text>
          <text class="detail-item-status" :class="item.statusClass">{{ item.statusText }}</text>
        </view>
        <text class="detail-item-amount" :class="item.amountClass">{{ item.amountText }}</text>
      </view>
    </view>

    <!-- 支出明细 -->
    <view v-if="profitData" class="section-label">
      <view class="section-dot" style="background:var(--green)" />
      <text>支出明细</text>
    </view>

    <view v-if="profitData">
      <!-- 繁育周期费用 -->
      <view v-if="breedingCosts.length" class="expense-group">
        <text class="expense-group-title">繁育周期费用</text>
        <view class="expense-items">
          <view v-for="item in breedingCosts" :key="item.name" class="expense-item">
            <text class="expense-item-name">{{ item.name }}</text>
            <text class="expense-item-amount">¥{{ formatMoney(item.amount) }}</text>
          </view>
        </view>
      </view>

      <!-- 窝级别费用 -->
      <view v-if="litterCosts.length" class="expense-group">
        <text class="expense-group-title">窝级别费用</text>
        <view class="expense-items">
          <view v-for="item in litterCosts" :key="item.name" class="expense-item">
            <text class="expense-item-name">{{ item.name }}</text>
            <text class="expense-item-amount">¥{{ formatMoney(item.amount) }}</text>
          </view>
        </view>
      </view>

      <!-- 幼崽个体费用 -->
      <view v-if="puppyCosts.length" class="expense-group">
        <text class="expense-group-title">幼崽个体费用</text>
        <view class="expense-items">
          <view v-for="item in puppyCosts" :key="item.name" class="expense-item">
            <text class="expense-item-name">{{ item.name }}</text>
            <text class="expense-item-amount">¥{{ formatMoney(item.amount) }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="!profitData && !loading" class="empty-state">
      <text class="material-icons-round empty-icon">bar_chart</text>
      <text class="empty-text">请选择一窝查看利润详情</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BLitterSelector from '@/components/form/BLitterSelector.vue'

const showLitterPickerVisible = ref(false)

interface ProfitData {
  totalIncome: number
  totalCost: number
  netProfit: number
  costPerPuppy: number
  puppyCount: number
  incomeItems: any[]
  breedingCosts: any[]
  litterCosts: any[]
  puppyCosts: any[]
}

const loading = ref(false)
const selectedLitterId = ref('')
const selectedLitterName = ref('')
const profitData = ref<ProfitData | null>(null)

const incomeItems = computed(() => {
  if (!profitData.value) return []
  return (profitData.value.incomeItems || []).map((item: any) => {
    let statusClass = 'kept'
    let statusText = '自留'
    let amountClass = 'dash'
    let amountText = '—'

    if (item.status === 'sold') {
      statusClass = 'sold'
      statusText = '已售'
      amountClass = 'income'
      amountText = `¥${formatMoney(item.amount)}`
    } else if (item.status === 'pending') {
      statusClass = 'pending'
      statusText = '待售'
      amountClass = 'estimated'
      amountText = `预计 ¥${formatMoney(item.estimated_amount)}`
    }

    return {
      id: item.id,
      name: item.name,
      statusClass,
      statusText,
      amountClass,
      amountText,
    }
  })
})

const breedingCosts = computed(() => profitData.value?.breedingCosts || [])
const litterCosts = computed(() => profitData.value?.litterCosts || [])
const puppyCosts = computed(() => profitData.value?.puppyCosts || [])

function formatMoney(val: number): string {
  if (!val && val !== 0) return '0'
  return val.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function showLitterPicker() {
  showLitterPickerVisible.value = true
}

function onLitterSelect(litter: any) {
  selectedLitterId.value = litter._id
  selectedLitterName.value = `${litter.damName || litter.dam_name}第${litter.litterNumber || litter.litter_number || '?'}窝`
  loadProfit(litter._id)
}

const { run: getLitterProfit } = useCloudCall('finance-service', 'getLitterProfit', {
  showLoading: true,
  loadingText: '计算中...',
})

async function loadProfit(litterId: string) {
  loading.value = true
  try {
    const res = await getLitterProfit({ litter_id: litterId })
    if (res) {
      profitData.value = res as ProfitData
    }
  } finally {
    loading.value = false
  }
}

onLoad((query) => {
  const litterId = query?.litterId || ''
  if (litterId) {
    selectedLitterId.value = litterId
    selectedLitterName.value = query?.litterName || ''
    loadProfit(litterId)
  }
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

/* ---- Dropdown Selector ---- */
.dropdown-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 var(--space-page) 16px;
  background: var(--card);
  border-radius: 12px;
  padding: 10px 16px;
  box-shadow: var(--shadow);
  width: fit-content;
}

.dd-text {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
}

.dropdown-selector .material-icons-round {
  font-size: 18px;
  color: var(--text-3);
}

/* ---- Profit Card ---- */
.profit-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 20px;
  margin: 0 16px 16px;
  box-shadow: var(--shadow);
  position: relative;
  overflow: hidden;
  border-left: 3.5px solid var(--primary);
}

.profit-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%);
  pointer-events: none;
}

.profit-card > * {
  position: relative;
  z-index: 1;
}

.profit-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.profit-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.profit-value {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 800;
}

.profit-value.income { color: var(--red); }
.profit-value.expense { color: var(--green); }

.profit-divider {
  border: none;
  border-top: 1px solid var(--card-dim);
  margin: 12px 0;
}

.profit-big {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.profit-big .profit-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}

.profit-big .profit-value,
.profit-value.primary {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: var(--primary);
}

.profit-sub-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.profit-sub-row .profit-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.profit-sub-row .profit-value {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
}

/* ---- Section Label ---- */
.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px var(--space-page) 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.5px;
}

.section-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.section-badge {
  background: var(--card-dim);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: var(--radius-badge);
}

/* ---- Detail List ---- */
.detail-list {
  padding: 0 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  background: var(--card);
  border-radius: var(--radius-row);
  padding: 12px 16px;
  box-shadow: var(--shadow);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-item-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.detail-item-status {
  font-size: 11px;
  font-weight: 600;
}

.detail-item-status.sold { color: var(--green); }
.detail-item-status.pending { color: var(--amber); }
.detail-item-status.kept { color: var(--text-3); }

.detail-item-amount {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 800;
}

.detail-item-amount.income { color: var(--red); }
.detail-item-amount.estimated {
  color: var(--text-3);
  font-style: italic;
  font-weight: 600;
  font-size: 13px;
}
.detail-item-amount.dash {
  color: var(--text-4);
  font-size: 16px;
}

/* ---- Expense Groups ---- */
.expense-group {
  padding: 0 16px 8px;
}

.expense-group-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  margin-bottom: 8px;
  padding-left: 4px;
}

.expense-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.expense-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--card-dim);
  border-radius: 12px;
  padding: 10px 14px;
}

.expense-item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.expense-item-amount {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 800;
  color: var(--text-2);
}

</style>
