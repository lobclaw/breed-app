<!--
  全部记录类型 (R-1)
  设计稿：docs/ui/pages-fab-action-sheet.html (Frame 3)
  按分类展示所有记录类型的 icon grid，点击跳转到对应录入表单
-->
<template>
  <view class="record-types">
    <BPageHeader title="全部记录类型" />
    <BSubmitBanner :message="submitBannerMessage" />

    <scroll-view scroll-y class="record-types__body">
      <!-- 繁育记录 -->
      <view class="cat-card cat-card--rose">
        <view class="cat-header">
          <view class="cat-dot" style="background: var(--rose);" />
          <text class="cat-title">繁育记录</text>
          <view class="cat-badge"><text class="cat-badge-text">8</text></view>
        </view>
        <view class="cat-grid">
          <view
            v-for="item in breedingTypes"
            :key="item.label"
            class="cat-item"
            @click="goToRecord(item)"
          >
            <view class="cat-icon" :style="{ background: item.iconBg }">
              <text class="material-icons-round" :style="{ color: item.iconColor }">{{ item.icon }}</text>
            </view>
            <text class="cat-label">{{ item.label }}</text>
          </view>
        </view>
      </view>

      <!-- 健康记录 -->
      <view class="cat-card cat-card--green">
        <view class="cat-header">
          <view class="cat-dot" style="background: var(--green);" />
          <text class="cat-title">健康记录</text>
          <view class="cat-badge"><text class="cat-badge-text">4</text></view>
        </view>
        <view class="cat-grid">
          <view
            v-for="item in healthTypes"
            :key="item.label"
            class="cat-item"
            @click="goToRecord(item)"
          >
            <view class="cat-icon" :style="{ background: item.iconBg }">
              <text class="material-icons-round" :style="{ color: item.iconColor }">{{ item.icon }}</text>
            </view>
            <text class="cat-label">{{ item.label }}</text>
          </view>
        </view>
      </view>

      <!-- 财务记录 -->
      <view class="cat-card cat-card--amber">
        <view class="cat-header">
          <view class="cat-dot" style="background: var(--amber);" />
          <text class="cat-title">财务记录</text>
        </view>
        <view class="cat-grid">
          <view
            v-for="item in financeTypes"
            :key="item.label"
            class="cat-item"
            @click="goToRecord(item)"
          >
            <view class="cat-icon" :style="{ background: item.iconBg }">
              <text class="material-icons-round" :style="{ color: item.iconColor }">{{ item.icon }}</text>
            </view>
            <text class="cat-label">{{ item.label }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import { consumeSubmitFeedback } from '@/composables/useSubmitFeedback'

interface RecordType {
  icon: string
  iconBg: string
  iconColor: string
  label: string
  url: string
}

// 繁育记录（8 种）
const breedingTypes: RecordType[] = [
  { icon: 'whatshot', iconBg: 'var(--icon-rose)', iconColor: 'var(--rose)', label: '发情', url: '/pages/record/breeding-heat' },
  { icon: 'biotech', iconBg: 'var(--icon-teal)', iconColor: 'var(--teal)', label: '卵泡', url: '/pages/record/breeding-follicle' },
  { icon: 'favorite', iconBg: 'var(--icon-rose)', iconColor: 'var(--rose)', label: '配种', url: '/pages/record/breeding-mating' },
  { icon: 'stethoscope', iconBg: 'var(--icon-green)', iconColor: 'var(--green)', label: '孕检', url: '/pages/record/breeding-pregnancy' },
  { icon: 'assignment', iconBg: 'var(--icon-blue)', iconColor: 'var(--blue)', label: '产检', url: '/pages/record/breeding-prenatal' },
  { icon: 'thermostat', iconBg: 'var(--icon-plum)', iconColor: 'var(--plum)', label: '临产', url: '/pages/record/breeding-prelabor' },
  { icon: 'child_friendly', iconBg: 'var(--icon-rose)', iconColor: 'var(--rose)', label: '生产', url: '/pages/breeding/birth-wizard' },
  { icon: 'warning', iconBg: 'var(--icon-red)', iconColor: 'var(--red)', label: '异常终止', url: '/pages/record/breeding-termination' },
]

// 健康记录（5 种）
const healthTypes: RecordType[] = [
  { icon: 'vaccines', iconBg: 'var(--icon-blue)', iconColor: 'var(--blue)', label: '疫苗', url: '/pages/record/health-vaccination' },
  { icon: 'shield', iconBg: 'var(--icon-teal)', iconColor: 'var(--teal)', label: '驱虫', url: '/pages/record/health-deworming' },
  { icon: 'sick', iconBg: 'var(--icon-red)', iconColor: 'var(--red)', label: '疾病', url: '/pages/record/health-illness' },
  { icon: 'medication', iconBg: 'var(--icon-plum)', iconColor: 'var(--plum)', label: '用药', url: '/pages/record/health-medication' },
  { icon: 'monitor_weight', iconBg: 'var(--icon-teal)', iconColor: 'var(--teal)', label: '体重', url: '/pages/health/batch-weight' },
]

// 财务记录（2 种）
const financeTypes: RecordType[] = [
  { icon: 'payments', iconBg: 'var(--icon-green)', iconColor: 'var(--green)', label: '支出', url: '/pages/finance/expense-add' },
  { icon: 'account_balance', iconBg: 'var(--icon-red)', iconColor: 'var(--red)', label: '收入', url: '/pages/finance/expense-add?type=income' },
]

const submitBannerMessage = ref('')
let submitBannerTimer: ReturnType<typeof setTimeout> | null = null

function showSubmitBanner(message: string) {
  submitBannerMessage.value = message
  if (submitBannerTimer) clearTimeout(submitBannerTimer)
  submitBannerTimer = setTimeout(() => {
    submitBannerMessage.value = ''
  }, 2200)
}

function goToRecord(item: RecordType) {
  uni.navigateTo({ url: item.url })
}

onShow(() => {
  const feedback = consumeSubmitFeedback('/pages/record/index')
  if (feedback?.message) {
    showSubmitBanner(feedback.message)
  }
})
</script>

<style lang="scss" scoped>
.record-types {
  min-height: 100vh;
  background: var(--bg);
}

.record-types__body {
  padding: 0 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ==================== CATEGORY CARDS ==================== */
.cat-card {
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  overflow: hidden;
  position: relative;
  border-left: 3.5px solid transparent;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    border-radius: var(--radius-card);
    pointer-events: none;
  }
  & > * { position: relative; z-index: 1; }
}
.cat-card--rose {
  border-left-color: var(--rose);
  &::before { background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 35%); }
}
.cat-card--green {
  border-left-color: var(--green);
  &::before { background: linear-gradient(135deg, var(--green-soft) 0%, transparent 35%); }
}
.cat-card--amber {
  border-left-color: var(--amber);
  &::before { background: linear-gradient(135deg, var(--amber-soft) 0%, transparent 35%); }
}
.cat-card--teal {
  border-left-color: var(--teal);
  &::before { background: linear-gradient(135deg, var(--teal-soft) 0%, transparent 35%); }
}

.cat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px 6px;
}
.cat-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.cat-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.3px;
}
.cat-badge {
  margin-left: auto;
  background: var(--card-dim);
  padding: 1px 8px;
  border-radius: var(--radius-badge);
}
.cat-badge-text {
  font-size: 11px;
  font-weight: 800;
  color: var(--text-2);
}

.cat-grid {
  padding: 4px 10px 12px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
}
.cat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 8px 4px;
  border-radius: 12px;
  transition: all 0.12s ease;
  &:active {
    transform: scale(0.90);
    background: rgba(234, 62, 119, 0.04);
  }
}
.cat-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  .material-icons-round { font-size: 20px; }
}
.cat-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-1);
  text-align: center;
  line-height: 1.2;
}
</style>
