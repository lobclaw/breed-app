<template>
  <view class="page">
    <BPageHeader title="未来预估" />

    <view v-if="loading" class="skeleton-wrap">
      <BSkeleton :rows="5" />
      <BSkeleton :rows="4" />
    </view>

    <template v-else>
      <!-- 预估参数 -->
      <view class="section-label">
        <view class="section-dot" style="background:var(--primary)" />
        <text>预估参数</text>
      </view>
      <view class="input-section">
        <view class="input-card">
          <view class="input-row">
            <text class="input-label">在役种母数</text>
            <view class="input-row-right">
              <input
                v-model="params.activeDams"
                class="input-value"
                type="number"
              />
              <text class="input-hint">来自系统</text>
            </view>
          </view>
          <view class="input-row">
            <text class="input-label">预计年均窝数</text>
            <view class="input-row-right">
              <input
                v-model="params.littersPerYear"
                class="input-value"
                type="number"
              />
              <text class="input-hint">系统建议</text>
            </view>
          </view>
          <view class="input-row">
            <text class="input-label">平均每窝收入</text>
            <view class="input-row-right">
              <input
                v-model="params.avgIncomePerLitter"
                class="input-value"
                type="digit"
              />
              <text class="input-hint">历史数据</text>
            </view>
          </view>
          <view class="input-row">
            <text class="input-label">平均每窝成本</text>
            <view class="input-row-right">
              <input
                v-model="params.avgCostPerLitter"
                class="input-value"
                type="digit"
              />
              <text class="input-hint">历史数据</text>
            </view>
          </view>
          <view class="input-row">
            <text class="input-label">月均共用开销</text>
            <view class="input-row-right">
              <input
                v-model="params.monthlySharedCost"
                class="input-value"
                type="digit"
              />
              <text class="input-hint">可编辑</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 收益预估 -->
      <view class="section-label">
        <view class="section-dot" style="background:var(--green)" />
        <text>收益预估</text>
      </view>
      <view class="projection-cards">
        <view v-for="year in projectionYears" :key="year.year" class="projection-card">
          <text class="projection-year">{{ year.year }}年</text>
          <view class="projection-row">
            <text class="p-label">收入</text>
            <text class="p-value income">+¥{{ formatMoney(year.income) }}</text>
          </view>
          <view class="projection-row">
            <text class="p-label">支出</text>
            <text class="p-value expense">-¥{{ formatMoney(year.cost) }}</text>
          </view>
          <view class="projection-row">
            <text class="p-label">利润</text>
            <text class="p-value" :class="getProfitClass(year.profit)">{{ formatSignedMoney(year.profit) }}</text>
          </view>
          <view class="projection-bars">
            <view
              class="p-bar income"
              :style="{ width: year.incomeBarPct + '%' }"
            />
            <view
              class="p-bar expense"
              :style="{ width: year.costBarPct + '%' }"
            />
          </view>
        </view>
      </view>

      <!-- 声明 -->
      <text class="disclaimer">预估基于历史数据和当前参数，实际情况可能不同</text>
    </template>
  </view>
</template>

<script setup lang="ts">
import { reactive, computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'

const DEFAULT_PARAMS = {
  activeDams: '5',
  littersPerYear: '8',
  avgIncomePerLitter: '16000',
  avgCostPerLitter: '4500',
  monthlySharedCost: '3000',
}

const loading = ref(true)
const params = reactive({ ...DEFAULT_PARAMS })

const projectionYears = computed(() => {
  const currentYear = new Date().getFullYear()
  const years = []

  for (let i = 0; i < 4; i++) {
    const year = currentYear + i
    const litters = parseInt(params.littersPerYear) || 0
    const incomePerLitter = parseFloat(params.avgIncomePerLitter) || 0
    const costPerLitter = parseFloat(params.avgCostPerLitter) || 0
    const monthlyShared = parseFloat(params.monthlySharedCost) || 0

    // 逐年增长系数（简单5%增长）
    const growthFactor = 1 + i * 0.05

    const income = Math.round(litters * incomePerLitter * growthFactor)
    const litterCost = Math.round(litters * costPerLitter * growthFactor)
    const sharedCost = Math.round(monthlyShared * 12 * (1 + i * 0.02))
    const cost = litterCost + sharedCost
    const profit = income - cost

    const total = income + cost
    const incomeBarPct = total > 0 ? Math.round((income / total) * 100) : 50
    const costBarPct = 100 - incomeBarPct

    years.push({
      year,
      income,
      cost,
      profit,
      incomeBarPct,
      costBarPct,
    })
  }

  return years
})

function formatMoney(val: number): string {
  if (!val && val !== 0) return '0'
  return val.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatSignedMoney(val: number): string {
  if (!val) return '¥0'
  const sign = val > 0 ? '+' : '-'
  return `${sign}¥${formatMoney(Math.abs(val))}`
}

function getProfitClass(val: number) {
  if (val > 0) return 'primary'
  if (val < 0) return 'negative'
  return 'neutral'
}

const { run: getProjectionParams } = useCloudCall('finance-service', 'getProjectionParams', {
  showLoading: false,
})

async function loadParams() {
  try {
    const res = await getProjectionParams()
    if (res?.data) {
      const data = res.data as any
      if (data.activeDams !== undefined && data.activeDams !== null) params.activeDams = String(data.activeDams)
      if (data.littersPerYear !== undefined && data.littersPerYear !== null) params.littersPerYear = String(data.littersPerYear)
      if (data.avgIncomePerLitter !== undefined && data.avgIncomePerLitter !== null) params.avgIncomePerLitter = String(data.avgIncomePerLitter)
      if (data.avgCostPerLitter !== undefined && data.avgCostPerLitter !== null) params.avgCostPerLitter = String(data.avgCostPerLitter)
      if (data.monthlySharedCost !== undefined && data.monthlySharedCost !== null) params.monthlySharedCost = String(data.monthlySharedCost)
    }
  } catch {
    Object.assign(params, DEFAULT_PARAMS)
  } finally {
    loading.value = false
  }
}

onLoad(() => {
  loadParams()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

.skeleton-wrap {
  padding: 8px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
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

/* ---- Input Section ---- */
.input-section {
  padding: 0 16px 16px;
}

.input-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow);
}

.input-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--card-dim);

  &:last-child {
    border-bottom: none;
  }
}

.input-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.input-row-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.input-value {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 800;
  color: var(--primary);
  background: none;
  border: none;
  text-align: right;
  width: 120px;
  outline: none;
}

.input-hint {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-3);
}

/* ---- Projection Cards ---- */
.projection-cards {
  padding: 0 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.projection-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow);
}

.projection-year {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-1);
  margin-bottom: 10px;
}

.projection-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
}

.p-label {
  color: var(--text-2);
}

.p-value {
  font-family: var(--font-display);
  font-weight: 800;
}

.p-value.income { color: var(--red); }
.p-value.expense { color: var(--green); }
.p-value.primary { color: var(--primary); }
.p-value.negative { color: var(--red); }
.p-value.neutral { color: var(--text-2); }

.projection-bars {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  height: 8px;
}

.p-bar {
  border-radius: var(--radius-progress);
  height: 100%;
}

.p-bar.income { background: var(--red); }
.p-bar.expense { background: var(--green); opacity: 0.7; }

/* ---- Disclaimer ---- */
.disclaimer {
  padding: 8px var(--space-page) 16px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
  text-align: center;
  line-height: 1.5;
}
</style>
