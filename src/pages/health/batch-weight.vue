<template>
  <view class="page">
    <BPageHeader :title="pageTitle" :subtitle="pageSubtitle" />

    <!-- 骨架屏 -->
    <BSkeleton v-if="loading && !selectedLitter" :rows="3" />

    <!-- 选择窝次（未选窝时） -->
    <view v-else-if="!selectedLitter" class="content">
      <BEmpty
        v-if="loadError"
        icon="cloud_off"
        title="窝次加载失败"
        description="请检查网络后重试"
        actionText="重新加载"
        @action="loadLitters"
      />

      <BEmpty
        v-else-if="litters.length === 0"
        icon="child_care"
        title="暂无未断奶的窝"
        description="需要先有未断奶的窝才能记录体重"
      />

      <BEmpty
        v-else
        icon="monitor_weight"
        title="选择一窝开始记录"
        description="通过底部弹窗选择当前要录入体重的窝次"
        actionText="选择窝"
        @action="openLitterSelector"
      />
    </view>

    <!-- 录入体重（已选窝） -->
    <view v-else class="content content--with-fixed-submit">
      <view class="litter-card" @click="openLitterSelector">
        <view class="litter-info">
          <view class="litter-avatar">
            <BEntityIcon kind="litter" :size="22" color="#fff" />
          </view>
          <view class="litter-detail">
            <text class="litter-eyebrow">当前窝 · 点击切换</text>
            <text class="litter-name">{{ selectedLitter.dam_name }}{{ selectedLitter.litter_number ? `第${selectedLitter.litter_number}窝` : '窝' }}</text>
            <text class="litter-meta">出生日期 {{ formatDate(selectedLitter.birth_date) }} · 存活 {{ livePuppyCount }}/{{ totalPuppyCount }}</text>
          </view>
        </view>
        <view class="litter-card__side">
          <text class="litter-card__action">切换</text>
          <text class="material-icons-round litter-arrow">expand_more</text>
        </view>
      </view>

      <view class="section-label">
        <view class="section-dot" />
        <text>逐只体重录入</text>
      </view>

      <BSkeleton v-if="selectedLitterLoading" :rows="2" />

      <template v-else>
        <view
          v-for="(puppy, idx) in puppies"
          :id="`puppy-card-${idx}`"
          :key="puppy._id"
          class="puppy-card"
          :class="puppy.gender === '公' ? 'puppy-card--male' : 'puppy-card--female'"
        >
          <view class="puppy-header">
            <text class="puppy-name">{{ puppy.name || `${selectedLitter.dam_name}窝-${idx + 1}号` }}</text>
            <view class="puppy-gender" :class="puppy.gender === '公' ? 'puppy-gender--male' : 'puppy-gender--female'">
              <text>{{ puppy.gender }}</text>
            </view>
          </view>
          <view class="puppy-input-row">
            <view class="weight-input-group" :class="{ 'weight-input-group--empty': !weights[idx] }">
              <input
                class="weight-input"
                type="digit"
                :value="weights[idx]"
                :placeholder="!weights[idx] ? '输入体重' : ''"
                placeholder-class="weight-input__placeholder"
                @input="onWeightInput($event, idx)"
                @confirm="focusNext(idx)"
              />
              <text class="weight-unit">g</text>
            </view>
            <view class="weight-meta">
              <view class="weight-detail">
                <text class="weight-comparison">上次: {{ puppy.last_weight ? `${puppy.last_weight}g` : '无记录' }}<text v-if="puppy.last_weight_at"> · {{ formatWeightTime(puppy.last_weight_at) }}</text></text>
                <text
                  v-if="weights[idx] && puppy.last_weight"
                  class="weight-delta"
                  :class="weightDelta(idx) > 0 ? 'weight-delta--positive' : weightDelta(idx) < 0 ? 'weight-delta--negative' : ''"
                >
                  {{ weightDelta(idx) > 0 ? '↑' : weightDelta(idx) < 0 ? '↓' : '' }}{{ Math.abs(weightDelta(idx)) }}g{{ weightDelta(idx) < 0 ? ' ⚠️' : '' }}
                </text>
              </view>
              <view class="mini-trend" :class="`mini-trend--${getTrendTone(puppy, idx)}`">
                <view v-if="getTrendPoints(puppy, idx).length > 1" class="mini-trend__plot">
                  <view
                    v-for="(segment, segmentIdx) in getTrendSegments(puppy, idx)"
                    :key="`segment-${puppy._id}-${segmentIdx}`"
                    class="mini-trend__segment"
                    :style="segment"
                  />
                  <view
                    v-for="(point, pointIdx) in getTrendPoints(puppy, idx)"
                    :key="`point-${puppy._id}-${pointIdx}`"
                    class="mini-trend__point"
                    :class="{ 'mini-trend__point--latest': pointIdx === getTrendPoints(puppy, idx).length - 1 }"
                    :style="point"
                  />
                </view>
                <view v-else class="mini-trend__placeholder">
                  <view class="mini-trend__placeholder-line mini-trend__placeholder-line--one" />
                  <view class="mini-trend__placeholder-line mini-trend__placeholder-line--two" />
                  <view class="mini-trend__placeholder-line mini-trend__placeholder-line--three" />
                </view>
              </view>
            </view>
          </view>
        </view>
      </template>

      <view v-if="filledCount > 0" class="summary-bar">
        <view class="summary-item">
          <text class="summary-label-text">平均:</text>
          <text class="summary-value-text">{{ avgWeight }}g</text>
        </view>
        <view class="summary-divider" />
        <view class="summary-item">
          <text class="summary-label-text">最重:</text>
          <text class="summary-value-text">{{ maxWeight }}g</text>
        </view>
        <view class="summary-divider" />
        <view class="summary-item">
          <text class="summary-label-text">最轻:</text>
          <text class="summary-value-text" :class="{ 'summary-value-text--warning': isMinWarning }">{{ minWeight }}g{{ isMinWarning ? '⚠️' : '' }}</text>
        </view>
        <view class="summary-divider" />
        <view class="summary-item">
          <text class="summary-label-text">已录:</text>
          <text class="summary-value-text">{{ filledCount }}/{{ puppies.length }}</text>
        </view>
      </view>

      <view class="bottom-area">
        <view class="record-time-card">
          <view class="record-time-card__header">
            <text class="record-time-card__label">记录时间</text>
            <view class="record-time-card__picker" @click="showDateTimePicker = true">
              <text class="material-icons-round record-time-card__picker-icon">event</text>
              <text class="record-time-card__picker-text">{{ recordDateTimeText }}</text>
            </view>
          </view>
          <view class="date-chips">
            <text class="date-chip" :class="{ active: dateChipActive === 'today' }" @click="setDateChip('today')">今天</text>
            <text class="date-chip" :class="{ active: dateChipActive === 'yesterday' }" @click="setDateChip('yesterday')">昨天</text>
            <text class="date-chip" :class="{ active: dateChipActive === 'dayBefore' }" @click="setDateChip('dayBefore')">前天</text>
          </view>
        </view>

      </view>

      <view class="fixed-bottom">
        <text v-if="filledCount > 0 && filledCount < puppies.length" class="submit-hint submit-hint--fixed">未录入的幼崽不会被提交，后续可补录。</text>
        <text v-if="submitError" class="submit-error submit-error--fixed">{{ submitError }}</text>
        <BSubmitButton
          :loading="submitState === 'submitting'"
          :success="submitState === 'success'"
          :disabled="submitState === 'submitting'"
          :inactive="!hasAnyWeight"
          inactive-tip="请输入体重"
          @click="submit"
        >
          {{ submitButtonText }}
        </BSubmitButton>
      </view>
    </view>

    <BLitterSelector
      v-model:visible="showLitterSelector"
      :active-only="true"
      :selected-ids="selectedLitter ? [selectedLitter._id] : []"
      @select="handleLitterSelect"
    />

    <BDateTimePicker
      v-model:visible="showDateTimePicker"
      :model-value="recordDateTime"
      mode="datetime"
      value-type="timestamp"
      @confirm="onDateTimeConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import { getLocalLitterDetail, listLocalLitters } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import { queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BLitterSelector from '@/components/form/BLitterSelector.vue'
import BDateTimePicker from '@/components/form/BDateTimePicker.vue'
import { buildTimestampFromDayOffset, formatDateTimeInputValue, getBeijingDayDiff, getBeijingDayStart, getBeijingOrdinalDay } from '@/utils/date'

type DateChipKey = 'today' | 'yesterday' | 'dayBefore' | ''

interface WeightHistoryItem {
  weight: number
  date: number
}

type TrendPointStyle = CSSProperties
type TrendSegmentStyle = CSSProperties

interface PuppyWeightItem {
  _id: string
  name?: string
  gender?: string
  latest_weight?: number | null
  last_weight?: number | null
  last_weight_at?: number | null
  weight_history: WeightHistoryItem[]
}

const litters = ref<any[]>([])
const loading = ref(true)
const loadError = ref('')
const selectedLitter = ref<any | null>(null)
const puppies = ref<PuppyWeightItem[]>([])
const weights = ref<string[]>([])
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const submitError = ref('')
const dateChipActive = ref<DateChipKey>('today')
const recordDateTime = ref(Date.now())
const showLitterSelector = ref(false)
const showDateTimePicker = ref(false)
const selectedLitterLoading = ref(false)
const { currentFamily } = useAuth()
usePageSync({ routePath: 'pages/health/batch-weight' })

const pageTitle = computed(() => {
  if (!selectedLitter.value) return '幼犬体重记录'
  return `${selectedLitter.value.dam_name}${selectedLitter.value.litter_number ? `第${selectedLitter.value.litter_number}窝` : '窝'} · 体重记录`
})

const pageSubtitle = computed(() => {
  if (!selectedLitter.value) return ''
  return `出生第${daysSinceBirth.value}天 · ${puppies.value.length}只存活`
})

const recordDateTimeText = computed(() => formatDateTimeInputValue(recordDateTime.value))
const filledCount = computed(() => weights.value.filter(w => parseWeightValue(w) > 0).length)
const hasAnyWeight = computed(() => filledCount.value > 0)
const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '保存中...'
  if (submitState.value === 'success') return '已保存'
  if (filledCount.value > 0 && filledCount.value < puppies.value.length) {
    return `保存已录 ${filledCount.value}/${puppies.value.length}`
  }
  if (filledCount.value === puppies.value.length && puppies.value.length > 0) {
    return '保存全部'
  }
  return '保存体重'
})

const filledWeights = computed(() => weights.value.map(parseWeightValue).filter(w => w > 0))
const avgWeight = computed(() => {
  if (filledWeights.value.length === 0) return 0
  return Math.round(filledWeights.value.reduce((sum, weight) => sum + weight, 0) / filledWeights.value.length)
})
const maxWeight = computed(() => filledWeights.value.length ? Math.max(...filledWeights.value) : 0)
const minWeight = computed(() => filledWeights.value.length ? Math.min(...filledWeights.value) : 0)
const isMinWarning = computed(() => {
  if (filledWeights.value.length < 2) return false
  return minWeight.value < avgWeight.value * 0.7
})
const daysSinceBirth = computed(() => {
  if (!selectedLitter.value?.birth_date) return 0
  return getBeijingOrdinalDay(selectedLitter.value.birth_date) || 1
})
const livePuppyCount = computed(() => {
  const alive = Number(selectedLitter.value?.born_alive ?? selectedLitter.value?.aliveCount ?? selectedLitter.value?.pupStats?.alive)
  if (Number.isFinite(alive) && alive >= 0) return alive
  return puppies.value.length
})
const totalPuppyCount = computed(() => {
  const total = Number(selectedLitter.value?.total_born ?? selectedLitter.value?.totalCount ?? selectedLitter.value?.puppyCount ?? selectedLitter.value?.pupStats?.total)
  if (Number.isFinite(total) && total > 0) return total
  return puppies.value.length
})

let preselectedLitterId = ''
let latestSelectionToken = 0

function getStartOfDay(ts: number) {
  return getBeijingDayStart(ts)
}

function parseWeightValue(value: string) {
  return parseFloat(value) || 0
}

function formatDate(ts: number) {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatWeightTime(ts: number) {
  const now = new Date()
  const target = new Date(ts)
  const todayStart = getStartOfDay(now.getTime())
  const targetStart = getStartOfDay(ts)
  const diffDays = getBeijingDayDiff(todayStart, targetStart)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays === 2) return '前天'
  return formatDate(ts)
}

function normalizeHistory(history: any[]) {
  return (history || [])
    .map(item => ({
      weight: Number(item.weight),
      date: Number(item.date),
    }))
    .filter(item => item.weight > 0 && item.date > 0)
    .sort((a, b) => a.date - b.date)
}

function normalizePuppy(puppy: any): PuppyWeightItem {
  const weightHistory = normalizeHistory(puppy.weight_history || [])
  const latestHistory = weightHistory[weightHistory.length - 1]
  return {
    ...puppy,
    latest_weight: puppy.latest_weight ?? latestHistory?.weight ?? null,
    last_weight: puppy.last_weight ?? puppy.latest_weight ?? latestHistory?.weight ?? null,
    last_weight_at: puppy.last_weight_at ?? latestHistory?.date ?? null,
    weight_history: weightHistory,
  }
}

function buildNormalizedPuppies(items: any[]) {
  return (items || []).map(normalizePuppy)
}

async function selectLitter(litter: any) {
  if (!litter?._id) return
  const selectionToken = ++latestSelectionToken
  selectedLitter.value = litter
  selectedLitterLoading.value = true
  puppies.value = []
  weights.value = []
  weights.value = puppies.value.map(() => '')
  submitError.value = ''
  recordDateTime.value = Date.now()
  syncDateChipActive()

  try {
    const familyId = currentFamily.value?._id || ''
    const detail = familyId ? await getLocalLitterDetail(familyId, litter._id) : null
    if (selectionToken !== latestSelectionToken) return
    const hydratedLitter = detail?.litter ? { ...litter, ...detail.litter } : litter
    selectedLitter.value = hydratedLitter
    puppies.value = buildNormalizedPuppies(detail?.puppies || litter.puppies || [])
    weights.value = puppies.value.map(() => '')
  } finally {
    if (selectionToken === latestSelectionToken) {
      selectedLitterLoading.value = false
    }
  }
}

function setDateChip(chip: Exclude<DateChipKey, ''>) {
  dateChipActive.value = chip
  const offsetMap = { today: 0, yesterday: -1, dayBefore: -2 }
  recordDateTime.value = buildTimestampFromDayOffset(offsetMap[chip])
}

function syncDateChipActive() {
  const today = getStartOfDay(Date.now())
  const diffDays = getBeijingDayDiff(today, recordDateTime.value)
  if (diffDays === 0) dateChipActive.value = 'today'
  else if (diffDays === 1) dateChipActive.value = 'yesterday'
  else if (diffDays === 2) dateChipActive.value = 'dayBefore'
  else dateChipActive.value = ''
}

function onDateTimeConfirm(value: number | string) {
  if (typeof value !== 'number') return
  recordDateTime.value = value
  syncDateChipActive()
}

function onWeightInput(e: any, idx: number) {
  weights.value[idx] = e.detail.value.replace(/\D/g, '')
  submitError.value = ''
}

function weightDelta(idx: number) {
  const current = parseWeightValue(weights.value[idx])
  const last = puppies.value[idx]?.last_weight || 0
  if (!current || !last) return 0
  return Math.round(current - last)
}

function getTrendSamples(puppy: PuppyWeightItem, idx: number) {
  const history = puppy.weight_history.slice(-4).map(item => item.weight)
  const current = parseWeightValue(weights.value[idx] || '')
  if (current > 0) {
    history.push(current)
  }
  return history.slice(-4)
}

function getTrendTone(puppy: PuppyWeightItem, idx: number) {
  const current = parseWeightValue(weights.value[idx] || '')
  const previous = puppy.last_weight || 0
  if (!current || !previous) return 'idle'
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'idle'
}

function getTrendPoints(puppy: PuppyWeightItem, idx: number): TrendPointStyle[] {
  const samples = getTrendSamples(puppy, idx)
  if (samples.length <= 1) return []

  const width = 58
  const height = 30
  const padding = 2
  const max = Math.max(...samples)
  const min = Math.min(...samples)
  const range = max - min

  return samples.map((weight, sampleIdx) => {
    const x = samples.length === 1 ? width / 2 : (width / (samples.length - 1)) * sampleIdx
    const y = range === 0
      ? height / 2
      : padding + ((max - weight) / range) * (height - padding * 2)
    return {
      left: `${x}px`,
      top: `${y}px`,
    }
  })
}

function getTrendSegments(puppy: PuppyWeightItem, idx: number): TrendSegmentStyle[] {
  const points = getTrendPoints(puppy, idx)
  if (points.length <= 1) return []

  return points.slice(0, -1).map((point, pointIdx) => {
    const nextPoint = points[pointIdx + 1]
    const x1 = Number.parseFloat(String(point.left ?? 0))
    const y1 = Number.parseFloat(String(point.top ?? 0))
    const x2 = Number.parseFloat(String(nextPoint.left ?? 0))
    const y2 = Number.parseFloat(String(nextPoint.top ?? 0))
    const dx = x2 - x1
    const dy = y2 - y1
    const width = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)

    return {
      left: `${x1}px`,
      top: `${y1}px`,
      width: `${width}px`,
      transform: `translateY(-50%) rotate(${angle}rad)`,
    }
  })
}

function focusNext(idx: number) {
  const next = idx + 1
  if (next >= puppies.value.length) return
  uni.createSelectorQuery()
    .select(`#puppy-card-${next}`)
    .boundingClientRect((rect: any) => {
      if (!rect) return
      uni.pageScrollTo({
        scrollTop: Math.max(rect.top - 120, 0),
        duration: 200,
      })
    })
    .exec()
}

function buildFinalDate() {
  return recordDateTime.value
}

function applyLocalWeightUpdates(weightEntries: Array<{ dog_id: string; weight: number; date: number }>) {
  if (!selectedLitter.value || weightEntries.length === 0) return

  const updates = new Map(weightEntries.map(entry => [entry.dog_id, entry]))
  const nextPuppies = puppies.value.map((puppy) => {
    const entry = updates.get(puppy._id)
    if (!entry) return puppy
    const nextHistory = normalizeHistory([
      ...puppy.weight_history,
      { weight: entry.weight, date: entry.date },
    ])
    return {
      ...puppy,
      latest_weight: entry.weight,
      last_weight: entry.weight,
      last_weight_at: entry.date,
      weight_history: nextHistory,
    }
  })

  puppies.value = nextPuppies
  weights.value = nextPuppies.map(() => '')

  const litterIndex = litters.value.findIndex(item => item._id === selectedLitter.value?._id)
  if (litterIndex >= 0) {
    litters.value[litterIndex] = {
      ...litters.value[litterIndex],
      puppies: nextPuppies.map(puppy => ({ ...puppy })),
    }
    selectedLitter.value = litters.value[litterIndex]
  }
}

function openLitterSelector() {
  if (!litters.value.length || loading.value) return
  showLitterSelector.value = true
}

function handleLitterSelect(litter: any) {
  const match = litters.value.find(item => item._id === litter._id)
  void selectLitter(match || litter)
}

async function loadLitters() {
  loading.value = true
  loadError.value = ''
  try {
    const familyId = currentFamily.value?._id || ''
    if (!familyId) {
      litters.value = []
      return
    }
    localSyncRuntime.setCurrentFamilyId(familyId)
    litters.value = await listLocalLitters(familyId, { activeOnly: true })

    if (preselectedLitterId) {
      const match = litters.value.find((item: any) => item._id === preselectedLitterId)
      if (match) {
        await selectLitter(match)
        preselectedLitterId = ''
        return
      }
      preselectedLitterId = ''
    }

    if (!selectedLitter.value && litters.value.length === 1) {
      await selectLitter(litters.value[0])
    }
  } catch (e: any) {
    litters.value = []
    loadError.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!selectedLitter.value) return

  submitState.value = 'submitting'
  submitError.value = ''

  const finalDate = buildFinalDate()
  const weightEntries = puppies.value
    .map((puppy, idx) => ({
      dog_id: puppy._id,
      weight: parseWeightValue(weights.value[idx]),
      date: finalDate,
    }))
    .filter(entry => entry.weight > 0)

  try {
    const familyId = currentFamily.value?._id || ''
    localSyncRuntime.setCurrentFamilyId(familyId)
    await Promise.all(weightEntries.map(entry => localSyncRuntime.addWeightRecordLocally(familyId, entry)))
    const savedCount = weightEntries.length
    applyLocalWeightUpdates(weightEntries)
    queueSubmitFeedback({
      message: savedCount > 1 ? `已保存 ${savedCount} 条体重记录` : '已保存体重记录',
    })
    submitState.value = 'success'
    await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
    submitState.value = 'idle'
  } catch (e: any) {
    submitState.value = 'idle'
    submitError.value = e?.message || '保存失败，请稍后重试'
  }
}

onLoad((query) => {
  preselectedLitterId = query?.litterId || ''
  loadLitters()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: calc(40px + env(safe-area-inset-bottom, 0px));
}

.content {
  padding: 0 var(--space-page) 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &--with-fixed-submit {
    padding-bottom: calc(118px + env(safe-area-inset-bottom, 0px));
  }
}

.litter-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
  transition: all 0.15s ease;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%);
    pointer-events: none;
  }

  & > * {
    position: relative;
    z-index: 1;
  }

  &:active {
    transform: scale(0.975);
    box-shadow: 0 1px 6px rgba(234, 62, 119, 0.04);
  }
}

.litter-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.litter-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--rose), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.litter-detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.litter-eyebrow {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
}

.litter-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
}

.litter-meta {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.litter-arrow {
  font-size: 20px;
  color: var(--text-4);
}

.litter-card__side {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.litter-card__action {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
}

.section-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: -4px;
}

.section-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--teal);
}

.puppy-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 16px 16px 16px 18px;
  box-shadow: var(--shadow);
  position: relative;
  overflow: hidden;
  border-left: 3.5px solid var(--blue);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  & > * {
    position: relative;
    z-index: 1;
  }

  &--male {
    border-left-color: var(--blue);

    &::before {
      background: linear-gradient(135deg, var(--blue-soft) 0%, transparent 40%);
    }
  }

  &--female {
    border-left-color: var(--rose);

    &::before {
      background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%);
    }
  }
}

.puppy-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.puppy-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}

.puppy-gender {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-tag);

  &--male {
    background: var(--blue-soft);
    color: var(--blue);
  }

  &--female {
    background: var(--rose-soft);
    color: var(--rose);
  }
}

.puppy-input-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.weight-input-group {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 96px;
  min-height: 48px;
  box-sizing: border-box;
  flex-shrink: 0;

  &--empty {
    border: 1.5px dashed var(--text-4);
    border-radius: 14px;

    .weight-input {
      border: none;
    }
  }
}

.weight-input {
  width: 72px;
  height: 48px;
  border: 1.5px solid var(--text-4);
  border-radius: 14px;
  background: var(--card);
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 800;
  color: var(--text-1);
  text-align: center;
  caret-color: var(--primary);
  transition: border-color 0.15s ease;

  &:focus {
    border-color: var(--primary);
  }
}

.weight-input__placeholder {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-4);
}

.weight-unit {
  min-width: 14px;
  font-size: 14px;
  font-weight: 600;
  line-height: 48px;
  text-align: center;
  color: var(--text-3);
}

.weight-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 2px;
}

.weight-detail {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.weight-comparison {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  line-height: 1.45;
}

.weight-delta {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;

  &--positive { color: var(--red); }
  &--negative { color: var(--green); }
}

.mini-trend {
  width: 64px;
  height: 42px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  --trend-color: rgba(216, 203, 189, 0.95);
  --trend-soft: rgba(216, 203, 189, 0.16);

  &::after {
    content: '';
    position: absolute;
    right: 2px;
    bottom: 1px;
    width: 28px;
    height: 22px;
    background: linear-gradient(180deg, transparent 0%, var(--trend-soft) 100%);
    border-radius: 999px 999px 4px 4px;
    pointer-events: none;
  }

  &--up {
    --trend-color: rgba(224, 82, 82, 0.95);
    --trend-soft: rgba(224, 82, 82, 0.16);
  }

  &--down {
    --trend-color: rgba(61, 174, 111, 0.95);
    --trend-soft: rgba(61, 174, 111, 0.16);
  }
}

.mini-trend__plot {
  width: 58px;
  height: 30px;
  position: relative;
}

.mini-trend__segment {
  position: absolute;
  height: 2px;
  border-radius: 999px;
  background: var(--trend-color);
  transform-origin: left center;
}

.mini-trend__point {
  position: absolute;
  width: 4px;
  height: 4px;
  margin-left: -2px;
  margin-top: -2px;
  border-radius: 50%;
  background: var(--trend-color);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.92);

  &--latest {
    width: 6px;
    height: 6px;
    margin-left: -3px;
    margin-top: -3px;
  }
}

.mini-trend__placeholder {
  width: 58px;
  height: 30px;
  position: relative;
}

.mini-trend__placeholder-line {
  position: absolute;
  height: 2px;
  border-radius: 999px;
  background: var(--trend-color);
  opacity: 0.58;

  &--one {
    left: 8px;
    top: 20px;
    width: 16px;
    transform: rotate(-24deg);
  }

  &--two {
    left: 22px;
    top: 15px;
    width: 18px;
    transform: rotate(-18deg);
  }

  &--three {
    left: 38px;
    top: 9px;
    width: 14px;
    transform: rotate(-28deg);
  }
}

.summary-bar {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 12px 16px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  flex-wrap: wrap;
}

.summary-item {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

.summary-label-text {
  color: var(--text-3);
  font-weight: 500;
}

.summary-value-text {
  font-weight: 800;
  color: var(--text-1);
  font-family: var(--font-display);

  &--warning {
    color: var(--red);
  }
}

.summary-divider {
  width: 1px;
  height: 14px;
  background: var(--text-4);
  flex-shrink: 0;
}

.bottom-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.record-time-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  box-shadow: var(--shadow);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  &__label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
  }

  &__picker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 999px;
    background: var(--card-dim);
  }

  &__picker-icon {
    font-size: 14px;
    color: var(--text-3);
  }

  &__picker-text {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-2);
  }
}

.date-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.date-chip {
  padding: 6px 14px;
  border-radius: var(--radius-tag);
  background: var(--card-dim);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  transition: transform 0.12s ease, filter 0.12s ease, background 0.12s ease;

  &:active {
    transform: scale(0.94);
    filter: brightness(0.96);
  }

  &.active {
    background: var(--primary);
    color: #fff;
    box-shadow: 0 2px 8px rgba(234, 62, 119, 0.25);
  }
}

.time-display {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);

  &__icon {
    font-size: 14px;
  }

  &__label {
    color: var(--text-3);
  }
}

.time-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.submit-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-3);
}

.submit-error {
  font-size: 12px;
  line-height: 1.5;
  color: var(--red);
}

.fixed-bottom {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.submit-hint--fixed,
.submit-error--fixed {
  padding: 0 2px;
}
</style>
