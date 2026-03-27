<template>
  <view class="page">
    <BPageHeader title="种母投资回报" />

    <!-- 种母选择器 -->
    <view class="dropdown-selector" @click="showDamPicker">
      <text class="dd-text">{{ selectedDamName || '选择种母' }}</text>
      <text class="material-icons-round">expand_more</text>
    </view>

    <!-- ROI 卡片 -->
    <view v-if="roiData" class="roi-card">
      <view class="roi-row">
        <text class="roi-label">购入成本</text>
        <text class="roi-value expense">¥{{ formatMoney(roiData.purchaseCost) }}</text>
      </view>
      <view class="roi-row">
        <text class="roi-label">总繁育支出</text>
        <text class="roi-value expense">¥{{ formatMoney(roiData.totalBreedingCost) }}</text>
      </view>
      <view class="roi-row">
        <text class="roi-label">总繁育收入</text>
        <text class="roi-value income">¥{{ formatMoney(roiData.totalBreedingIncome) }}</text>
      </view>
      <view class="roi-row">
        <text class="roi-label">个体健康支出</text>
        <text class="roi-value expense">¥{{ formatMoney(roiData.healthCost) }}</text>
      </view>
      <view class="roi-divider" />
      <view class="roi-big">
        <text class="roi-label">净收益</text>
        <text class="roi-value primary">¥{{ formatMoney(roiData.netProfit) }}</text>
      </view>
      <view class="roi-rate">
        <text class="roi-label">投资回报率</text>
        <text class="roi-value roi-pct">{{ roiData.roiPercent }}%</text>
      </view>
    </view>

    <!-- 各窝利润 -->
    <view v-if="roiData && litterList.length" class="section-label">
      <view class="section-dot" style="background:var(--primary)" />
      <text>各窝利润</text>
      <view class="section-badge">
        <text>{{ litterList.length }}</text>
      </view>
    </view>
    <view v-if="roiData" class="litter-list">
      <view v-for="litter in litterList" :key="litter.id" class="litter-item">
        <view class="litter-item-top">
          <view>
            <text class="litter-item-title">{{ litter.title }}</text>
            <text class="litter-item-meta">{{ litter.meta }}</text>
          </view>
          <text class="litter-item-profit" :class="litter.profitClass">{{ litter.profitText }}</text>
        </view>
        <view class="litter-bar-track">
          <view
            class="litter-bar-fill"
            :class="litter.barClass"
            :style="{ width: litter.barWidth + '%' }"
          />
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="!roiData && !loading" class="empty-state">
      <text class="material-icons-round empty-icon">pets</text>
      <text class="empty-text">请选择种母查看投资回报</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'

interface RoiData {
  purchaseCost: number
  totalBreedingCost: number
  totalBreedingIncome: number
  healthCost: number
  netProfit: number
  roiPercent: number
  litters: any[]
}

const loading = ref(false)
const selectedDamId = ref('')
const selectedDamName = ref('')
const roiData = ref<RoiData | null>(null)

const litterList = computed(() => {
  if (!roiData.value?.litters) return []

  const maxProfit = Math.max(...roiData.value.litters.map((l: any) => Math.abs(l.profit || 0)), 1)

  return roiData.value.litters.map((litter: any) => {
    let profitClass = 'income'
    let profitText = `净利润 ¥${formatMoney(litter.profit)}`
    let barClass = 'income'

    if (litter.status === 'failed') {
      profitClass = 'expense'
      profitText = `净亏损 -¥${formatMoney(Math.abs(litter.profit))}`
      barClass = 'expense'
    } else if (litter.status === 'in_progress') {
      profitClass = 'gray'
      profitText = `暂估 ¥${formatMoney(litter.profit)}`
      barClass = 'gray'
    }

    return {
      id: litter.id,
      title: litter.title || `第${litter.index}窝`,
      meta: litter.meta || `${litter.puppyCount || 0}只`,
      profitClass,
      profitText,
      barClass,
      barWidth: Math.min(100, (Math.abs(litter.profit || 0) / maxProfit) * 100),
    }
  })
})

function formatMoney(val: number): string {
  if (!val && val !== 0) return '0'
  return val.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function showDamPicker() {
  // 种母选择器 placeholder
}

const { run: getDamRoi } = useCloudCall('finance-service', 'getDamRoi', {
  showLoading: true,
  loadingText: '计算中...',
})

async function loadRoi(damId: string) {
  loading.value = true
  try {
    const res = await getDamRoi({ dog_id: damId })
    if (res) {
      roiData.value = res as RoiData
    }
  } finally {
    loading.value = false
  }
}

onLoad((query) => {
  const damId = query?.damId || ''
  if (damId) {
    selectedDamId.value = damId
    selectedDamName.value = query?.damName || ''
    loadRoi(damId)
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

/* ---- ROI Card ---- */
.roi-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 20px;
  margin: 0 16px 16px;
  box-shadow: var(--shadow);
  position: relative;
  overflow: hidden;
  border-left: 3.5px solid var(--green);
}

.roi-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  background: linear-gradient(135deg, var(--green-soft) 0%, transparent 40%);
  pointer-events: none;
}

.roi-card > * {
  position: relative;
  z-index: 1;
}

.roi-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.roi-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.roi-value {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 800;
}

.roi-value.expense { color: var(--green); }
.roi-value.income { color: var(--red); }

.roi-divider {
  border: none;
  border-top: 1px solid var(--card-dim);
  margin: 10px 0;
}

.roi-big {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.roi-big .roi-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}

.roi-big .roi-value,
.roi-value.primary {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: var(--primary);
}

.roi-rate {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.roi-rate .roi-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.roi-pct {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 800;
  color: var(--green);
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

/* ---- Litter List ---- */
.litter-list {
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.litter-item {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  box-shadow: var(--shadow);
}

.litter-item-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.litter-item-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}

.litter-item-meta {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}

.litter-item-profit {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 800;
}

.litter-item-profit.income { color: var(--red); }
.litter-item-profit.expense { color: var(--green); }
.litter-item-profit.gray { color: var(--text-3); }

.litter-bar-track {
  height: 6px;
  background: var(--card-dim);
  border-radius: var(--radius-progress);
  overflow: hidden;
}

.litter-bar-fill {
  height: 100%;
  border-radius: var(--radius-progress);
}

.litter-bar-fill.income { background: var(--red); }
.litter-bar-fill.expense { background: var(--green); }
.litter-bar-fill.gray {
  background: var(--text-3);
  background-image: repeating-linear-gradient(
    90deg,
    transparent,
    transparent 4px,
    var(--card-dim) 4px,
    var(--card-dim) 8px
  );
}

/* ---- Empty State ---- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 0;
  gap: 12px;
}

.empty-icon {
  font-size: 48px;
  color: var(--text-4);
}

.empty-text {
  font-size: 14px;
  color: var(--text-3);
}
</style>
