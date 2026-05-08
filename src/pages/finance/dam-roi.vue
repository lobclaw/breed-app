<template>
  <view class="page">
    <BPageHeader title="种母投资回报" />

    <!-- 种母选择器 -->
    <view class="dam-picker-area">
      <view class="dam-context-card" :class="{ 'dam-context-card--empty': !hasSelectedDam }" @click="showDamPickerVisible = true">
        <view class="dam-context-card__avatar">
          <BEntityIcon role="种狗" :size="22" color="#fff" />
        </view>
        <view class="dam-context-card__body">
          <text class="dam-context-card__title">{{ hasSelectedDam ? selectedDam.name : '选择种母' }}</text>
          <text class="dam-context-card__meta">
            {{ hasSelectedDam ? selectedDamMeta : '选择一只种母查看累计回报与各窝表现' }}
          </text>
        </view>
        <view class="dam-context-card__side">
          <text v-if="hasSelectedDam" class="dam-context-card__action">切换</text>
          <text class="material-icons-round dam-context-card__chevron">chevron_right</text>
        </view>
      </view>
    </view>

    <BDogPicker
      v-model:visible="showDamPickerVisible"
      roleFilter="种狗"
      genderFilter="母"
      :selected-ids="hasSelectedDam ? [selectedDam._id] : []"
      title="选择种母"
      @select="handleDamSelect"
    />

    <view v-if="loading && hasSelectedDam" class="loading-wrap">
      <BSkeleton :rows="4" />
    </view>

    <template v-else-if="roiData">
      <!-- ROI Hero -->
      <view class="roi-hero" :class="`roi-hero--${roiToneClass}`">
        <view class="roi-hero__header">
          <view>
            <text class="roi-hero__eyebrow">累计净收益</text>
            <view class="roi-hero__headline" :class="`roi-hero__headline--${roiToneClass}`">
              <text v-if="roiHeadline.sign" class="roi-hero__headline-sign">{{ roiHeadline.sign }}</text>
              <text class="roi-hero__headline-currency">{{ roiHeadline.currency }}</text>
              <text class="roi-hero__headline-number">{{ roiHeadline.number }}</text>
            </view>
            <text class="roi-hero__sub">{{ roiInsight }}</text>
          </view>
          <view class="roi-hero__rate-pill" :class="`roi-hero__rate-pill--${roiToneClass}`">
            <text class="roi-hero__rate-label">ROI</text>
            <text class="roi-hero__rate-value">{{ formatPercent(roiData.roiPercent) }}</text>
          </view>
        </view>

        <view v-if="summaryFacts.length" class="roi-hero__facts" :class="{ 'roi-hero__facts--single': summaryFacts.length === 1 }">
          <view
            v-for="fact in summaryFacts"
            :key="fact.label"
            class="roi-hero__fact"
            :class="{ 'roi-hero__fact--single': summaryFacts.length === 1 }"
          >
            <view class="roi-hero__fact-main">
              <view class="roi-hero__fact-head">
                <text class="roi-hero__fact-value">{{ fact.value }}</text>
                <text class="roi-hero__fact-label">{{ fact.label }}</text>
              </view>
              <text v-if="fact.helper" class="roi-hero__fact-helper">{{ fact.helper }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 金额构成 -->
      <view class="roi-section-card">
        <view class="roi-section-card__header">
          <view class="roi-section-card__title-wrap">
            <view class="roi-section-card__dot roi-section-card__dot--teal" />
            <view>
              <text class="roi-section-card__title">回报构成</text>
              <text class="roi-section-card__desc">先看投入和收入，再理解当前累计结果</text>
            </view>
          </view>
        </view>

        <view v-for="section in breakdownSections" :key="section.key" class="roi-breakdown">
          <view class="roi-breakdown__head">
            <text class="roi-breakdown__title">{{ section.title }}</text>
            <text class="roi-breakdown__total" :class="section.tone">{{ section.totalText }}</text>
          </view>
          <view class="roi-breakdown__list">
            <view v-for="item in section.items" :key="item.label" class="roi-breakdown__row">
              <text class="roi-breakdown__label">{{ item.label }}</text>
              <text class="roi-breakdown__value" :class="item.tone">{{ item.value }}</text>
            </view>
          </view>
        </view>

        <view class="roi-conclusion">
          <view class="roi-conclusion__divider" />
          <view class="roi-conclusion__row">
            <view>
              <text class="roi-conclusion__label">当前结果</text>
              <text class="roi-conclusion__note">{{ roiConclusionNote }}</text>
            </view>
            <view class="roi-conclusion__values">
              <text class="roi-conclusion__value" :class="roiToneClass">{{ formatFinanceAmount(roiData.netProfit, { scene: 'report' }) }}</text>
              <text class="roi-conclusion__roi" :class="roiToneClass">{{ formatPercent(roiData.roiPercent) }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 各窝利润 -->
      <view class="roi-section-card">
        <view class="roi-section-card__header">
          <view class="roi-section-card__title-wrap">
            <view class="roi-section-card__dot roi-section-card__dot--primary" />
            <view>
              <text class="roi-section-card__title">各窝表现</text>
              <text class="roi-section-card__desc">按时间顺序查看每窝当前利润与状态</text>
            </view>
          </view>
          <view v-if="litterList.length" class="roi-section-card__badge">
            <text class="roi-section-card__badge-text">{{ litterList.length }}</text>
          </view>
        </view>

        <view v-if="litterList.length" class="litter-list">
          <view v-for="litter in litterList" :key="litter.id" class="litter-item" @click="goToLitterProfit(litter)">
            <view class="litter-item__top">
              <view class="litter-item__body">
                <view class="litter-item__title-row">
                  <text class="litter-item__title">{{ litter.title }}</text>
                  <text class="litter-item__status" :class="`litter-item__status--${litter.statusTone}`">{{ litter.statusLabel }}</text>
                </view>
                <text class="litter-item__meta">{{ litter.meta }}</text>
              </view>
              <view class="litter-item__amounts">
                <text class="litter-item__profit" :class="litter.profitTone">{{ litter.profitText }}</text>
                <text class="litter-item__subprofit">{{ litter.profitHint }}</text>
              </view>
              <text class="material-icons-round litter-item__chevron">chevron_right</text>
            </view>
            <view class="litter-bar-track">
              <view
                class="litter-bar-fill"
                :class="`litter-bar-fill--${litter.statusTone}`"
                :style="{ width: litter.barWidth + '%' }"
              />
            </view>
          </view>
        </view>

        <view v-else class="roi-section-card__empty">
          <text>当前暂无可展示的各窝回报数据</text>
        </view>
      </view>
    </template>

    <!-- 空状态 -->
    <view v-else-if="!hasSelectedDam && !loading" class="roi-empty-state">
      <view class="roi-empty-state__icon">
        <text class="material-icons-round">insights</text>
      </view>
      <text class="roi-empty-state__title">先选择一只种母</text>
      <text class="roi-empty-state__desc">查看她的累计投入、累计收入和各窝回报表现</text>
    </view>

    <view v-else class="roi-empty-card">
      <view class="roi-empty-card__icon">
        <text class="material-icons-round">finance</text>
      </view>
      <text class="roi-empty-card__title">暂无繁育回报数据</text>
      <text class="roi-empty-card__desc">这只种母还没有可汇总的繁育收入或投入记录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import { getLocalDamRoi } from '@/localdb/domain-repository'
import { localDb } from '@/localdb/db'
import { localSyncRuntime } from '@/localdb/runtime'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import { getBeijingOrdinalDay } from '@/utils/date'
import { formatFinanceAmount, getFinanceAmountParts } from '@/utils/financeDisplay'

const { currentFamily } = useAuth()
usePageSync({ routePath: 'pages/finance/dam-roi' })

const selectedDam = ref<any>(null)
const showDamPickerVisible = ref(false)

interface RoiData {
  purchaseCost: number
  totalBreedingCost: number
  totalBreedingIncome: number
  healthCost: number
  netProfit: number
  roiPercent: number
  cycleCount?: number
  litterCount?: number
  puppyCount?: number
  litters: any[]
}

const loading = ref(false)
const roiData = ref<RoiData | null>(null)
const hasSelectedDam = computed(() => !!selectedDam.value?._id)
const selectedDamMeta = computed(() => {
  if (!selectedDam.value) return ''
  const parts = [
    selectedDam.value.breed || '马尔济斯',
    selectedDam.value.gender || '母',
    selectedDam.value.birth_date ? formatAge(selectedDam.value.birth_date) : '',
  ].filter(Boolean)
  return parts.join(' · ')
})

const roiToneClass = computed(() => {
  const value = roiData.value?.netProfit || 0
  if (value > 0) return 'primary'
  if (value < 0) return 'negative'
  return 'neutral'
})

// 当选择犬只变化时自动加载 ROI
watch(() => selectedDam.value?._id, (damId) => {
  if (damId) void loadRoi(damId)
})

const totalInvestment = computed(() => {
  if (!roiData.value) return 0
  return roiData.value.purchaseCost + roiData.value.totalBreedingCost + roiData.value.healthCost
})

const roiHeadline = computed(() => {
  return getFinanceAmountParts(roiData.value?.netProfit || 0, { scene: 'report' })
})

const roiInsight = computed(() => {
  if (!roiData.value) return ''
  if (roiData.value.netProfit > 0) return `当前累计已超过回本线 ${formatFinanceAmount(roiData.value.netProfit, { scene: 'report', absolute: true })}`
  if (roiData.value.netProfit < 0) return `距离回本还差 ${formatFinanceAmount(roiData.value.netProfit, { scene: 'report', absolute: true })}`
  return '当前累计刚好持平'
})

const roiConclusionNote = computed(() => {
  if (!roiData.value) return ''
  if (roiData.value.netProfit > 0) return '当前已进入累计盈利区间'
  if (roiData.value.netProfit < 0) return '当前仍处于累计投入回收阶段'
  return '当前投入与收入刚好相抵'
})

const summaryFacts = computed(() => {
  if (!roiData.value) return []
  return [
    roiData.value.litterCount ? { label: '窝次', value: `${roiData.value.litterCount}`, helper: '已纳入回报统计' } : null,
    roiData.value.cycleCount ? { label: '周期', value: `${roiData.value.cycleCount}`, helper: '已纳入回报统计' } : null,
    roiData.value.puppyCount ? { label: '幼崽', value: `${roiData.value.puppyCount}`, helper: '已纳入样本记录' } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; helper: string }>
})

const breakdownSections = computed(() => {
  if (!roiData.value) return []

  return [
    {
      key: 'investment',
      title: '累计投入',
      tone: 'negative',
      totalText: formatFinanceAmount(-totalInvestment.value, { scene: 'report' }),
      items: [
        { label: '购入成本', value: formatFinanceAmount(-roiData.value.purchaseCost, { scene: 'report' }), tone: 'negative' },
        { label: '繁育投入', value: formatFinanceAmount(-roiData.value.totalBreedingCost, { scene: 'report' }), tone: 'negative' },
        { label: '个体费用', value: formatFinanceAmount(-roiData.value.healthCost, { scene: 'report' }), tone: 'negative' },
      ],
    },
    {
      key: 'income',
      title: '累计收入',
      tone: 'positive',
      totalText: formatFinanceAmount(roiData.value.totalBreedingIncome, { scene: 'report' }),
      items: [
        { label: '繁育收入', value: formatFinanceAmount(roiData.value.totalBreedingIncome, { scene: 'report' }), tone: 'positive' },
      ],
    },
  ]
})

const litterList = computed(() => {
  if (!roiData.value?.litters) return []

  const sortedLitters = [...roiData.value.litters].sort((left: any, right: any) => {
    return (left.index || 0) - (right.index || 0)
  })
  const maxProfit = Math.max(...sortedLitters.map((l: any) => Math.abs(l.profit || 0)), 1)

  return sortedLitters.map((litter: any) => {
    let profitTone = 'positive'
    let profitText = formatFinanceAmount(litter.profit, { scene: 'report' })
    let profitHint = '当前累计盈利'
    let statusTone = 'positive'
    let statusLabel = '已结算'

    if (litter.status === 'failed') {
      profitTone = 'negative'
      profitText = formatFinanceAmount(litter.profit, { scene: 'report' })
      profitHint = '当前累计亏损'
      statusTone = 'negative'
      statusLabel = '亏损'
    } else if (litter.status === 'in_progress') {
      profitTone = 'neutral'
      profitText = `暂估 ${formatFinanceAmount(litter.profit, { scene: 'report' })}`
      profitHint = '当前仍在进行中'
      statusTone = 'neutral'
      statusLabel = '进行中'
    }

    return {
      id: litter.id,
      title: litter.title || `第${litter.index}窝`,
      meta: litter.meta || `${litter.puppyCount || 0}只`,
      profitTone,
      profitText,
      profitHint,
      statusTone,
      statusLabel,
      barWidth: Math.min(100, (Math.abs(litter.profit || 0) / maxProfit) * 100),
    }
  })
})

function formatPercent(val: number): string {
  if (!val) return '0%'
  const sign = val > 0 ? '+' : '-'
  return `${sign}${Math.abs(val)}%`
}

function formatAge(birthTs: number) {
  const days = getBeijingOrdinalDay(birthTs) || 1
  if (days < 30) return `${days}天`
  if (days < 365) return `${Math.floor(days / 30)}月龄`
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  return months > 0 ? `${years}岁${months}月` : `${years}岁`
}

function decodeRouteValue(value: unknown) {
  if (typeof value !== 'string') return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function handleDamSelect(dog: any) {
  selectedDam.value = dog
}

function goToLitterProfit(litter: any) {
  if (!litter?.id) {
    uni.showToast({ title: '窝信息缺失', icon: 'none' })
    return
  }
  const litterName = encodeURIComponent(litter.title || '')
  uni.navigateTo({
    url: `/pages/finance/litter-profit?litterId=${litter.id}&litterName=${litterName}`,
    fail() {
      uni.showToast({ title: '单窝利润打开失败', icon: 'none' })
    },
  })
}

async function hydrateSelectedDam(damId: string) {
  const localDam = await localDb.findById<any>('dogs', damId)
  if (!localDam || localDam.deleted_at) return
  selectedDam.value = {
    ...selectedDam.value,
    ...localDam,
  }
}

async function loadRoi(damId: string) {
  const familyId = currentFamily.value?._id || ''
  loading.value = true
  roiData.value = null
  try {
    if (!familyId) return
    localSyncRuntime.setCurrentFamilyId(familyId)
    roiData.value = await getLocalDamRoi(familyId, damId) as RoiData | null
  } finally {
    loading.value = false
  }
}

onLoad((query) => {
  const damId = decodeRouteValue(query?.damId || query?.dam_id)
  if (damId) {
    selectedDam.value = {
      _id: damId,
      name: decodeRouteValue(query?.damName || query?.dam_name),
      breed: decodeRouteValue(query?.breed),
      gender: '母',
      role: '种狗',
    }
    void hydrateSelectedDam(damId)
  }
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

/* ---- Dam Picker Area ---- */
.dam-picker-area {
  padding: 0 var(--space-page) 16px;
}

.dam-context-card {
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

.loading-wrap {
  padding: 0 var(--space-page) 16px;
}

/* ---- ROI Hero ---- */
.roi-hero {
  margin: 0 16px 14px;
  padding: 18px 18px 16px;
  border-radius: 22px;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(216, 203, 189, 0.22);
  box-shadow: 0 12px 30px rgba(99, 70, 49, 0.06);

  &--primary {
    background: linear-gradient(135deg, rgba(255, 243, 247, 0.98) 0%, rgba(255, 255, 255, 0.98) 58%);
    border-color: rgba(234, 62, 119, 0.14);
  }

  &--negative {
    background: linear-gradient(135deg, rgba(240, 255, 244, 0.98) 0%, rgba(255, 255, 255, 0.98) 58%);
    border-color: rgba(61, 174, 111, 0.18);
  }

  &--neutral {
    background: linear-gradient(135deg, rgba(255, 249, 246, 0.98) 0%, rgba(255, 255, 255, 0.98) 58%);
  }

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  &__eyebrow {
    display: block;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
    margin-bottom: 6px;
  }

  &__headline {
    display: inline-flex;
    align-items: flex-end;
    font-family: var(--font-display);
    line-height: 1.1;
    color: var(--text-1);

    &--primary {
      color: var(--primary);
    }

    &--negative {
      color: var(--green);
    }

    &--neutral {
      color: var(--text-1);
    }
  }

  &__headline-sign {
    font-size: 24px;
    font-weight: 800;
    margin-bottom: 1px;
  }

  &__headline-currency {
    font-size: 34px;
    font-weight: 800;
    line-height: 1.1;
    margin-right: 2px;
  }

  &__headline-number {
    font-size: 34px;
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  &__sub {
    display: block;
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-2);
  }

  &__rate-pill {
    flex-shrink: 0;
    min-width: 84px;
    padding: 10px 12px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.74);
    border: 1px solid rgba(216, 203, 189, 0.18);
    text-align: right;

    &--primary {
      .roi-hero__rate-value { color: var(--primary); }
    }

    &--negative {
      .roi-hero__rate-value { color: var(--green); }
    }

    &--neutral {
      .roi-hero__rate-value { color: var(--text-2); }
    }
  }

  &__rate-label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-3);
  }

  &__rate-value {
    display: block;
    margin-top: 4px;
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 800;
  }

  &__facts {
    margin-top: 14px;
    display: flex;
    gap: 10px;

    &--single {
      justify-content: flex-start;
    }
  }

  &__fact {
    flex: 1;
    min-width: 0;
    padding: 10px 12px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(216, 203, 189, 0.14);

    &--single {
      flex: 0 0 auto;
      min-width: 188px;
      max-width: 100%;
      padding: 12px 16px;
      display: inline-flex;
      align-items: center;
      border-color: rgba(61, 174, 111, 0.18);
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(245, 255, 249, 0.92) 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
    }
  }

  &__fact-main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
    min-width: 0;
  }

  &__fact-head {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
  }

  &__fact-value {
    display: block;
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 800;
    color: var(--text-1);
    line-height: 1;
  }

  &__fact--single &__fact-value {
    font-size: 24px;
  }

  &__fact-label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-3);
  }

  &__fact-helper {
    display: block;
    font-size: 10px;
    line-height: 1.35;
    color: var(--text-4);
    text-align: left;
  }
}

/* ---- ROI Section Card ---- */
.roi-section-card {
  margin: 0 16px 14px;
  padding: 15px 15px 14px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(216, 203, 189, 0.22);
  box-shadow: 0 10px 26px rgba(99, 70, 49, 0.05);

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

    &--teal { background: var(--teal); }
    &--primary { background: var(--primary); }
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

  &__empty {
    padding: 6px 0 2px;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
  }
}

.roi-breakdown {
  & + & {
    margin-top: 12px;
  }

  &__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
  }

  &__title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
  }

  &__total {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 800;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 9px 12px;
    border-radius: 14px;
    background: rgba(255, 249, 245, 0.9);
  }

  &__label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
  }

  &__value {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 800;
  }
}

.roi-conclusion {
  margin-top: 14px;

  &__divider {
    height: 1px;
    background: rgba(216, 203, 189, 0.32);
    margin-bottom: 12px;
  }

  &__row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  &__label {
    display: block;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
  }

  &__note {
    display: block;
    margin-top: 3px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-2);
  }

  &__values {
    flex-shrink: 0;
    text-align: right;
  }

  &__value {
    display: block;
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 800;
  }

  &__roi {
    display: block;
    margin-top: 4px;
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 800;
  }
}

.positive {
  color: var(--primary);
}

.negative {
  color: var(--green);
}

.neutral {
  color: var(--text-2);
}

/* ---- Litter List ---- */
.litter-item {
  padding: 14px 14px 12px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 249, 246, 0.98) 100%);
  border: 1px solid rgba(216, 203, 189, 0.18);
  transition: transform 0.12s ease, box-shadow 0.12s ease;

  &:active {
    transform: scale(0.985);
    box-shadow: inset 0 0 0 1px rgba(234, 62, 119, 0.12);
  }

  & + & {
    margin-top: 10px;
  }

  &__top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__status {
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;

    &--positive {
      background: rgba(234, 62, 119, 0.12);
      color: var(--primary);
    }

    &--negative {
      background: rgba(61, 174, 111, 0.12);
      color: var(--green);
    }

    &--neutral {
      background: rgba(216, 203, 189, 0.36);
      color: var(--text-2);
    }
  }

  &__meta {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-2);
  }

  &__amounts {
    flex-shrink: 0;
    text-align: right;
  }

  &__profit {
    display: block;
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 800;
  }

  &__chevron {
    flex-shrink: 0;
    font-size: 18px;
    color: var(--text-4);
    line-height: 1;
  }

  &__subprofit {
    display: block;
    margin-top: 3px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
  }
}

.litter-bar-track {
  height: 7px;
  background: rgba(255, 243, 236, 0.82);
  border-radius: var(--radius-progress);
  overflow: hidden;
}

.litter-bar-fill {
  height: 100%;
  border-radius: var(--radius-progress);

  &--positive {
    background: linear-gradient(90deg, #ef6060 0%, #f36d7f 100%);
  }

  &--negative {
    background: linear-gradient(90deg, #44b773 0%, #53c784 100%);
  }

  &--neutral {
    background: var(--text-3);
    background-image: repeating-linear-gradient(
      90deg,
      transparent,
      transparent 4px,
      rgba(255, 255, 255, 0.36) 4px,
      rgba(255, 255, 255, 0.36) 8px
    );
  }
}

/* ---- Empty State ---- */
.roi-empty-state,
.roi-empty-card {
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

.roi-empty-state__icon,
.roi-empty-card__icon {
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

.roi-empty-state__title,
.roi-empty-card__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
}

.roi-empty-state__desc,
.roi-empty-card__desc {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-2);
}

@media (max-width: 360px) {
  .roi-hero__header,
  .roi-conclusion__row,
  .litter-item__top {
    flex-direction: column;
  }

  .roi-hero__rate-pill,
  .roi-conclusion__values,
  .litter-item__amounts {
    width: 100%;
    text-align: left;
  }

  .roi-hero__facts {
    flex-direction: column;
  }

  .roi-hero__fact--single {
    width: auto;
    min-width: 160px;
    max-width: 100%;
  }

  .roi-breakdown__head {
    align-items: flex-start;
    flex-direction: column;
  }
}

</style>
