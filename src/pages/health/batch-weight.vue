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
    <view v-else class="content">
      <view class="litter-card" @click="openLitterSelector">
        <view class="litter-info">
          <view class="litter-avatar">
            <BEntityIcon kind="litter" :size="22" color="#fff" />
          </view>
          <view class="litter-detail">
            <text class="litter-eyebrow">当前窝 · 点击切换</text>
            <text class="litter-name">{{ selectedLitter.dam_name }}{{ selectedLitter.litter_number ? `第${selectedLitter.litter_number}窝` : '窝' }}</text>
            <text class="litter-meta">出生日期 {{ formatDate(selectedLitter.birth_date) }} · 存活 {{ puppies.length }}/{{ selectedLitter.total_born || puppies.length }}</text>
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
          <view v-if="puppy.weight_history.length > 1" class="mini-trend">
            <text class="mini-trend-text">{{ formatWeightHistory(puppy.weight_history) }}</text>
          </view>
        </view>
      </view>

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

        <text v-if="filledCount > 0 && filledCount < puppies.length" class="submit-hint">未录入的幼崽不会被提交，后续可补录。</text>
        <text v-if="submitError" class="submit-error">{{ submitError }}</text>

        <button
          class="save-btn"
          :class="{ 'save-btn--success': submitState === 'success' }"
          :disabled="!hasAnyWeight || submitState === 'submitting'"
          @click="submit"
        >
          <text>{{ submitButtonText }}</text>
        </button>
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
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BLitterSelector from '@/components/form/BLitterSelector.vue'
import BDateTimePicker from '@/components/form/BDateTimePicker.vue'
import { buildTimestampFromDayOffset, formatDateTimeInputValue } from '@/utils/date'

type DateChipKey = 'today' | 'yesterday' | 'dayBefore' | ''

interface WeightHistoryItem {
  weight: number
  date: number
}

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
  return Math.floor((Date.now() - selectedLitter.value.birth_date) / 86400000)
})

const { run: fetchLitters } = useCloudCall<{ data: any[] }>('breeding-service', 'getActiveLitters')
const { run: batchAdd } = useCloudCall<{ data?: { count?: number } }>('health-service', 'batchAddWeights', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

let preselectedLitterId = ''

function getStartOfDay(ts: number) {
  const date = new Date(ts)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
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
  const diffDays = Math.floor((todayStart - targetStart) / 86400000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays === 2) return '前天'
  return formatDate(ts)
}

function formatWeightHistory(history: WeightHistoryItem[]) {
  return history.slice(-3).map(item => `${item.weight}g`).join(' → ')
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

function selectLitter(litter: any) {
  selectedLitter.value = litter
  puppies.value = buildNormalizedPuppies(litter.puppies || [])
  weights.value = puppies.value.map(() => '')
  submitError.value = ''
  recordDateTime.value = Date.now()
  syncDateChipActive()
}

function setDateChip(chip: Exclude<DateChipKey, ''>) {
  dateChipActive.value = chip
  const offsetMap = { today: 0, yesterday: -1, dayBefore: -2 }
  recordDateTime.value = buildTimestampFromDayOffset(offsetMap[chip], recordDateTime.value)
}

function syncDateChipActive() {
  const today = getStartOfDay(Date.now())
  const diffDays = Math.round((today - getStartOfDay(recordDateTime.value)) / 86400000)
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
  selectLitter(match || litter)
}

async function loadLitters() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await fetchLitters()
    litters.value = res?.data || []

    if (preselectedLitterId) {
      const match = litters.value.find((item: any) => item._id === preselectedLitterId)
      if (match) {
        selectLitter(match)
        preselectedLitterId = ''
        return
      }
      preselectedLitterId = ''
    }

    if (!selectedLitter.value && litters.value.length === 1) {
      selectLitter(litters.value[0])
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
    const res = await batchAdd(selectedLitter.value._id, weightEntries)
    const savedCount = res?.data?.count || weightEntries.length
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
  background: linear-gradient(135deg, #ea3e77, #e89b3e);
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
  align-items: center;
  gap: 10px;
}

.weight-input-group {
  display: flex;
  align-items: center;
  gap: 4px;
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
  font-size: 14px;
  font-weight: 600;
  color: var(--text-3);
}

.weight-detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.weight-comparison {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.weight-delta {
  font-size: 13px;
  font-weight: 700;

  &--positive { color: var(--red); }
  &--negative { color: var(--green); }
}

.mini-trend {
  flex-shrink: 0;
  max-width: 108px;
}

.mini-trend-text {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
  white-space: nowrap;
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
    background: var(--teal);
    color: #fff;
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

.save-btn {
  width: 100%;
  height: 48px;
  border-radius: var(--radius-btn);
  background: var(--teal);
  color: #fff;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  transition: all 0.12s ease;
  box-shadow: 0 4px 16px rgba(61, 168, 160, 0.25);

  &:active:not([disabled]) {
    transform: scale(0.94);
    opacity: 0.85;
  }

  &[disabled] {
    opacity: 0.5;
  }

  &.save-btn--success {
    background: var(--green);
    box-shadow: 0 4px 16px rgba(68, 170, 107, 0.22);
  }
}
</style>
