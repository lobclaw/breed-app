<template>
  <view class="page">
    <BPageHeader title="单窝利润" />

    <!-- 窝选择器 -->
    <view class="litter-picker-area">
      <view class="litter-context-card" :class="{ 'litter-context-card--empty': !hasSelectedLitter }" @click="showLitterPicker">
        <view class="litter-context-card__avatar">
          <text class="material-icons-round">bar_chart</text>
        </view>
        <view class="litter-context-card__body">
          <text class="litter-context-card__title">{{ hasSelectedLitter ? selectedLitterName : '选择一窝' }}</text>
          <text class="litter-context-card__meta">
            {{ hasSelectedLitter ? '查看这窝的累计收入、支出和净利润' : '先选择一窝，再查看这窝的利润明细' }}
          </text>
        </view>
        <view class="litter-context-card__side">
          <text v-if="hasSelectedLitter" class="litter-context-card__action">切换</text>
          <text class="material-icons-round litter-context-card__chevron">chevron_right</text>
        </view>
      </view>
    </view>

    <BLitterSelector v-model:visible="showLitterPickerVisible" @select="onLitterSelect" />

    <!-- 利润卡片 -->
    <view v-if="profitData" class="profit-card">
      <view class="profit-row">
        <text class="profit-label">收入</text>
        <text class="profit-value income">{{ formatFinanceAmount(profitData.totalIncome, { scene: 'report' }) }}</text>
      </view>
      <view class="profit-row">
        <text class="profit-label">支出</text>
        <text class="profit-value expense">{{ formatFinanceAmount(-profitData.totalCost, { scene: 'report' }) }}</text>
      </view>
      <view class="profit-divider" />
      <view class="profit-big">
        <text class="profit-label">净利润</text>
        <view class="profit-amount" :class="netProfitClass">
          <text v-if="netProfitParts.sign" class="profit-amount__sign">{{ netProfitParts.sign }}</text>
          <text class="profit-amount__currency">{{ netProfitParts.currency }}</text>
          <text class="profit-amount__number">{{ netProfitParts.number }}</text>
        </view>
      </view>
      <view class="profit-sub-row">
        <text class="profit-label">每只均摊成本</text>
        <text class="profit-value">{{ formatFinanceAmount(-profitData.costPerPuppy, { scene: 'report' }) }}</text>
      </view>
      <view class="profit-sub-row">
        <text class="profit-label">存活幼崽</text>
        <text class="profit-value">{{ profitData.aliveCount }}只</text>
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
          <view class="detail-item-top">
            <view class="detail-item-title-row">
              <text class="detail-item-name">{{ item.name }}</text>
              <text v-if="item.genderText" class="detail-item-gender">{{ item.genderText }}</text>
            </view>
            <text class="detail-item-status" :class="item.statusClass">{{ item.statusText }}</text>
          </view>
          <text class="detail-item-hint">{{ item.statusHint }}</text>
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
            <view class="expense-item-main">
              <text class="expense-item-name">{{ item.title || item.name }}</text>
              <text v-if="item.subtitle" class="expense-item-subtitle">{{ item.subtitle }}</text>
            </view>
            <text class="expense-item-amount">{{ formatFinanceAmount(-item.amount, { scene: 'report' }) }}</text>
          </view>
        </view>
      </view>

      <!-- 窝级别费用 -->
      <view v-if="litterCosts.length" class="expense-group">
        <text class="expense-group-title">窝级别费用</text>
        <view class="expense-items">
          <view v-for="item in litterCosts" :key="item.name" class="expense-item">
            <view class="expense-item-main">
              <text class="expense-item-name">{{ item.title || item.name }}</text>
              <text v-if="item.subtitle" class="expense-item-subtitle">{{ item.subtitle }}</text>
            </view>
            <text class="expense-item-amount">{{ formatFinanceAmount(-item.amount, { scene: 'report' }) }}</text>
          </view>
        </view>
      </view>

      <!-- 幼崽个体费用 -->
      <view v-if="puppyCosts.length" class="expense-group">
        <text class="expense-group-title">幼崽个体费用</text>
        <view class="expense-items">
          <view v-for="item in puppyCosts" :key="item.name" class="expense-item">
            <view class="expense-item-main">
              <text class="expense-item-name">{{ item.title || item.name }}</text>
              <text v-if="item.subtitle" class="expense-item-subtitle">{{ item.subtitle }}</text>
            </view>
            <text class="expense-item-amount">{{ formatFinanceAmount(-item.amount, { scene: 'report' }) }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="!profitData && !hasSelectedLitter && !loading" class="profit-empty-state">
      <view class="profit-empty-state__icon">
        <text class="material-icons-round">insights</text>
      </view>
      <text class="profit-empty-state__title">先选择一窝</text>
      <text class="profit-empty-state__desc">查看这一窝的累计收入、累计支出和净利润表现</text>
    </view>

    <view v-else-if="!profitData && hasSelectedLitter && !loading" class="profit-empty-card">
      <view class="profit-empty-card__icon">
        <text class="material-icons-round">finance</text>
      </view>
      <text class="profit-empty-card__title">暂无利润数据</text>
      <text class="profit-empty-card__desc">这窝目前还没有可汇总的收入或支出记录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import { getLocalLitterProfit } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BLitterSelector from '@/components/form/BLitterSelector.vue'
import { formatFinanceAmount, getFinanceAmountParts } from '@/utils/financeDisplay'

const { currentFamily } = useAuth()
usePageSync({ routePath: 'pages/finance/litter-profit' })

const showLitterPickerVisible = ref(false)

interface ProfitData {
  totalIncome: number
  totalCost: number
  netProfit: number
  costPerPuppy: number
  puppyCount: number
  aliveCount: number
  incomeItems: any[]
  breedingCosts: any[]
  litterCosts: any[]
  puppyCosts: any[]
}

const loading = ref(false)
const selectedLitterId = ref('')
const selectedLitterName = ref('')
const profitData = ref<ProfitData | null>(null)
const hasSelectedLitter = computed(() => !!selectedLitterId.value)

const netProfitClass = computed(() => {
  const value = profitData.value?.netProfit || 0
  if (value > 0) return 'primary'
  if (value < 0) return 'negative'
  return 'neutral'
})
const netProfitParts = computed(() => getFinanceAmountParts(profitData.value?.netProfit || 0, { scene: 'report' }))

const incomeItems = computed(() => {
  if (!profitData.value) return []
  return (profitData.value.incomeItems || []).map((item: any) => {
    let statusClass = 'pending'
    let statusText = '待售'
    let statusHint = '尚未产生实际收入'
    let amountClass = 'dash'
    let amountText = '—'

    if (item.status === 'sold') {
      statusClass = 'sold'
      statusText = '已售'
      statusHint = '已完成成交并计入收入'
      amountClass = 'income'
      amountText = formatFinanceAmount(item.amount, { scene: 'report' })
    } else if (item.status === 'received') {
      statusClass = 'received'
      statusText = '已收款'
      statusHint = '已计入收入，未标记成交'
      amountClass = 'income'
      amountText = formatFinanceAmount(item.amount, { scene: 'report' })
    } else if (item.status === 'reserved') {
      statusClass = 'reserved'
      statusText = '已预定'
      statusHint = item.estimated_amount ? '预计按当前约定金额成交' : '已进入预定流程'
      amountClass = item.estimated_amount ? 'estimated' : 'dash'
      amountText = item.estimated_amount ? `预计 ${formatFinanceAmount(item.estimated_amount, { scene: 'report' })}` : '—'
    } else if (item.status === 'pending') {
      statusClass = 'pending'
      statusText = '待售'
      statusHint = item.estimated_amount ? '预计按当前底价或意向价成交' : '待进入销售流程'
      amountClass = item.estimated_amount ? 'estimated' : 'dash'
      amountText = item.estimated_amount ? `预计 ${formatFinanceAmount(item.estimated_amount, { scene: 'report' })}` : '—'
    }

    return {
      id: item.id,
      name: item.name,
      genderText: formatPuppyGender(item.gender),
      statusClass,
      statusText,
      statusHint,
      amountClass,
      amountText,
    }
  })
})

const breedingCosts = computed(() => profitData.value?.breedingCosts || [])
const litterCosts = computed(() => profitData.value?.litterCosts || [])
const puppyCosts = computed(() => profitData.value?.puppyCosts || [])

function formatPuppyGender(gender?: string) {
  if (gender === '公') return '公'
  if (gender === '母') return '母'
  return ''
}

function showLitterPicker() {
  showLitterPickerVisible.value = true
}

function onLitterSelect(litter: any) {
  selectedLitterId.value = litter._id
  selectedLitterName.value = `${litter.damName || litter.dam_name}第${litter.litterNumber || litter.litter_number || '?'}窝`
  void loadProfit(litter._id)
}

async function loadProfit(litterId: string) {
  const familyId = currentFamily.value?._id || ''
  loading.value = true
  profitData.value = null
  try {
    if (!familyId) return
    localSyncRuntime.setCurrentFamilyId(familyId)
    profitData.value = await getLocalLitterProfit(familyId, litterId) as ProfitData | null
  } finally {
    loading.value = false
  }
}

onLoad((query) => {
  const litterId = query?.litterId || ''
  if (litterId) {
    selectedLitterId.value = litterId
    selectedLitterName.value = query?.litterName || ''
    void loadProfit(litterId)
  }
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

/* ---- Litter Picker ---- */
.litter-picker-area {
  padding: 0 var(--space-page) 16px;
}

.litter-context-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 18px;
  border: 1px solid rgba(216, 203, 189, 0.46);
  box-shadow: 0 10px 24px rgba(99, 70, 49, 0.05);
  transition: transform 0.12s ease, box-shadow 0.12s ease;

  &:active {
    transform: scale(0.985);
    box-shadow: 0 6px 18px rgba(99, 70, 49, 0.05);
  }

  &--empty {
    border-style: dashed;
  }

  &__avatar {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary), #f0789a);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .material-icons-round {
      font-size: 22px;
      color: #fff;
    }
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__title {
    display: block;
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__meta {
    display: block;
    margin-top: 3px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--text-2);
  }

  &__side {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  &__action {
    font-size: 11px;
    font-weight: 700;
    color: var(--primary);
  }

  &__chevron {
    font-size: 18px;
    color: var(--text-4);
  }
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

.profit-amount,
.profit-value.primary {
  display: inline-flex;
  align-items: flex-end;
  font-family: var(--font-display);
  font-variant-numeric: tabular-nums lining-nums;
  line-height: 1;
  color: var(--primary);
}

.profit-amount__sign {
  font-size: 18px;
  font-weight: 800;
  margin-bottom: 1px;
}

.profit-amount__currency {
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
  margin-right: 2px;
}

.profit-amount__number {
  font-size: 24px;
  font-weight: 800;
}

.profit-amount.negative { color: var(--red); }
.profit-amount.neutral { color: var(--text-2); }
.profit-value.negative { color: var(--red); }
.profit-value.neutral { color: var(--text-2); }

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
  gap: 10px;
}

.detail-item {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(255, 249, 246, 0.98) 100%);
  border-radius: 18px;
  padding: 14px 16px;
  border: 1px solid rgba(216, 203, 189, 0.18);
  box-shadow: 0 10px 22px rgba(99, 70, 49, 0.04);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.detail-item-left {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-width: 0;
}

.detail-item-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.detail-item-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.detail-item-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}

.detail-item-gender {
  min-height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  background: rgba(234, 62, 119, 0.08);
  color: var(--primary);
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.detail-item-status {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.detail-item-status.sold {
  color: var(--red);
  background: rgba(239, 96, 96, 0.1);
}

.detail-item-status.pending {
  color: var(--amber);
  background: rgba(245, 179, 65, 0.14);
}

.detail-item-status.reserved {
  color: var(--blue);
  background: rgba(78, 141, 255, 0.12);
}

.detail-item-status.received {
  color: var(--primary);
  background: rgba(234, 62, 119, 0.1);
}

.detail-item-hint {
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-3);
}

.detail-item-amount {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 800;
  flex-shrink: 0;
  text-align: right;
  padding-top: 2px;
}

.detail-item-amount.income { color: var(--red); }
.detail-item-amount.estimated {
  color: var(--amber);
  font-weight: 700;
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
  margin-bottom: 9px;
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
  gap: 12px;
  background: linear-gradient(180deg, rgba(255, 243, 236, 0.72) 0%, rgba(255, 247, 242, 0.9) 100%);
  border-radius: 14px;
  padding: 12px 14px;
}

.expense-item-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.expense-item-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
}

.expense-item-subtitle {
  font-size: 11px;
  line-height: 1.3;
  color: var(--text-3);
}

.expense-item-amount {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 800;
  color: var(--green);
  flex-shrink: 0;
}

/* ---- Empty State ---- */
.profit-empty-state,
.profit-empty-card {
  margin: 0 16px;
  padding: 24px 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px dashed rgba(216, 203, 189, 0.42);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.profit-empty-state__icon,
.profit-empty-card__icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(234, 62, 119, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;

  .material-icons-round {
    font-size: 24px;
    color: var(--primary);
  }
}

.profit-empty-state__title,
.profit-empty-card__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
}

.profit-empty-state__desc,
.profit-empty-card__desc {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-2);
}

</style>
