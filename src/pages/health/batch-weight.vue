<template>
  <view class="page">
    <!-- 顶栏 -->
    <view class="top-bar">
      <view class="back-btn" @click="goBack">
        <text class="material-icons-round" style="font-size: 24px; color: var(--text-1);">arrow_back_ios_new</text>
      </view>
      <view class="top-bar-text">
        <text class="top-bar-title">
          {{ selectedLitter ? `${selectedLitter.dam_name}第${selectedLitter.litter_number || ''}窝 · 体重记录` : '幼犬体重记录' }}
        </text>
        <text v-if="selectedLitter" class="top-bar-subtitle">
          出生第{{ daysSinceBirth }}天 · {{ puppies.length }}只存活
        </text>
      </view>
    </view>

    <!-- 骨架屏 -->
    <BSkeleton v-if="loading && !selectedLitter" :rows="3" />

    <!-- 选择窝次（未选窝时） -->
    <view v-if="!selectedLitter && !loading" class="content">
      <BEmpty
        v-if="litters.length === 0"
        icon="child_care"
        title="暂无未断奶的窝"
        description="需要先有未断奶的窝才能记录体重"
      />

      <view v-for="litter in litters" :key="litter._id">
        <view class="litter-card" @click="selectLitter(litter)">
          <view class="litter-info">
            <view class="litter-avatar">
              <BEntityIcon kind="litter" :size="22" color="#fff" />
            </view>
            <view class="litter-detail">
              <text class="litter-name">{{ litter.dam_name }}{{ litter.litter_number ? `第${litter.litter_number}窝` : '窝' }}</text>
              <text class="litter-meta">{{ (litter.puppies || []).length }}只幼崽</text>
            </view>
          </view>
          <text class="material-icons-round" style="font-size: 20px; color: var(--text-4);">chevron_right</text>
        </view>
      </view>
    </view>

    <!-- 录入体重（已选窝） -->
    <view v-if="selectedLitter" class="content">
      <!-- 窝选择卡片 -->
      <view class="litter-card" @click="selectedLitter = null">
        <view class="litter-info">
          <view class="litter-avatar">
            <BEntityIcon kind="litter" :size="22" color="#fff" />
          </view>
          <view class="litter-detail">
            <text class="litter-name">{{ selectedLitter.dam_name }}{{ selectedLitter.litter_number ? `第${selectedLitter.litter_number}窝` : '窝' }}</text>
            <text class="litter-meta">出生日期 {{ formatDate(selectedLitter.birth_date) }} · 存活 {{ puppies.length }}/{{ selectedLitter.total_born || puppies.length }}</text>
          </view>
        </view>
        <text class="material-icons-round" style="font-size: 20px; color: var(--text-4);">chevron_right</text>
      </view>

      <!-- 逐只体重录入标签 -->
      <view class="section-label">
        <view class="section-dot" style="background: var(--teal);" />
        <text>逐只体重录入</text>
      </view>

      <!-- 幼崽体重卡片 -->
      <view
        v-for="(puppy, idx) in puppies"
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
              :ref="(el: any) => { if (el) inputRefs[idx] = el }"
              class="weight-input"
              type="digit"
              :value="weights[idx]"
              :placeholder="!weights[idx] ? '输入体重' : ''"
              @input="onWeightInput($event, idx)"
              @confirm="focusNext(idx)"
              @focus="onInputFocus(idx)"
            />
            <text class="weight-unit">g</text>
          </view>
          <view class="weight-detail">
            <text class="weight-comparison">上次: {{ puppy.last_weight || '?' }}g · {{ puppy.last_weight_time || '无记录' }}</text>
            <text
              v-if="weights[idx] && puppy.last_weight"
              class="weight-delta"
              :class="weightDelta(idx) > 0 ? 'weight-delta--positive' : weightDelta(idx) < 0 ? 'weight-delta--negative' : ''"
            >
              {{ weightDelta(idx) > 0 ? '↑' : weightDelta(idx) < 0 ? '↓' : '' }}{{ Math.abs(weightDelta(idx)) }}g
              {{ weightDelta(idx) < 0 ? '⚠️' : '' }}
            </text>
          </view>
          <!-- 迷你趋势线：显示最近 3 次体重 -->
          <view v-if="puppy.weight_history && puppy.weight_history.length > 1" class="mini-trend">
            <text class="mini-trend-text">{{ formatWeightHistory(puppy.weight_history) }}</text>
          </view>
        </view>
      </view>

      <!-- 汇总栏 -->
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

      <!-- 保存按钮 + 时间 -->
      <view class="bottom-area">
        <button class="save-btn" :class="{ 'save-btn--success': submitState === 'success' }" :disabled="!hasAnyWeight || submitState === 'submitting'" @click="submit">
          <text>{{ submitButtonText }}</text>
        </button>
        <view class="time-display">
          <text class="material-icons-round" style="font-size: 14px;">schedule</text>
          <text>记录时间</text>
          <picker mode="time" :value="timeStr" @change="onTimeChange">
            <text class="time-value">{{ timeStr }}</text>
          </picker>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { wait } from '@/composables/useSubmitFeedback'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'

const litters = ref<any[]>([])
const loading = ref(true)
const selectedLitter = ref<any>(null)
const puppies = ref<any[]>([])
const weights = ref<string[]>([])
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const weightDate = ref(Date.now())
const timeStr = ref('')
const inputRefs = ref<any[]>([])

const dateStr = computed(() => {
  const d = new Date(weightDate.value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const hasAnyWeight = computed(() => weights.value.some(w => parseFloat(w) > 0))
const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '保存中...'
  if (submitState.value === 'success') return '已保存'
  return '保存全部'
})
const filledCount = computed(() => weights.value.filter(w => parseFloat(w) > 0).length)

const filledWeights = computed(() => weights.value.map(w => parseFloat(w)).filter(w => w > 0))
const avgWeight = computed(() => {
  if (filledWeights.value.length === 0) return 0
  return Math.round(filledWeights.value.reduce((s, w) => s + w, 0) / filledWeights.value.length)
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

function formatDate(ts: number) {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function weightDelta(idx: number) {
  const current = parseFloat(weights.value[idx])
  const last = puppies.value[idx]?.last_weight
  if (!current || !last) return 0
  return Math.round(current - last)
}

function formatWeightHistory(history: Array<{ weight: number }>) {
  // 取最近 3 条记录，显示为 "120g → 135g → 150g"
  const recent = history.slice(-3)
  return recent.map(h => `${h.weight}g`).join(' → ')
}

function onTimeChange(e: any) {
  timeStr.value = e.detail.value
}

function onWeightInput(e: any, idx: number) {
  const val = e.detail.value.replace(/\D/g, '')
  weights.value[idx] = val
  // 3位数字自动跳下一只
  if (val.length >= 3) {
    setTimeout(() => focusNext(idx), 150)
  }
}

function onInputFocus(_idx: number) {
  // UniApp 不支持 programmatic text selection，无法选中全部文字
}

function focusNext(idx: number) {
  const next = idx + 1
  if (next < puppies.value.length) {
    // UniApp 不支持 programmatic focus，改用 scrollIntoView 滚动到下一个输入框
    uni.createSelectorQuery()
      .select(`.puppy-card:nth-child(${next + 1})`)
      .boundingClientRect((rect: any) => {
        if (rect) {
          uni.pageScrollTo({
            scrollTop: rect.top - 120,
            duration: 200,
          })
        }
      })
      .exec()
  }
}

function goBack() {
  if (selectedLitter.value) {
    selectedLitter.value = null
  } else {
    uni.navigateBack({ delta: 1 })
  }
}

const { run: fetchLitters } = useCloudCall<{ data: any[] }>('breeding-service', 'getActiveLitters')
const { run: batchAdd } = useCloudCall('health-service', 'batchAddWeights', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

function selectLitter(litter: any) {
  selectedLitter.value = litter
  puppies.value = litter.puppies || []
  weights.value = puppies.value.map(() => '')
  inputRefs.value = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  weightDate.value = today.getTime()
  const now = new Date()
  timeStr.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

async function loadLitters() {
  loading.value = true
  const res = await fetchLitters()
  if (res?.data) {
    litters.value = res.data
    // 如果从窝详情进入，自动选中对应的窝
    if (preselectedLitterId && !selectedLitter.value) {
      const match = litters.value.find((l: any) => l._id === preselectedLitterId)
      if (match) selectLitter(match)
      preselectedLitterId = '' // 只自动选一次
    }
  }
  loading.value = false
}

async function submit() {
  if (!selectedLitter.value) return
  submitState.value = 'submitting'

  // 将 timeStr (HH:MM) 解析并加到 weightDate（midnight）上
  let finalDate = weightDate.value
  if (timeStr.value) {
    const [hours, minutes] = timeStr.value.split(':').map(Number)
    if (!isNaN(hours) && !isNaN(minutes)) {
      finalDate = weightDate.value + hours * 3600000 + minutes * 60000
    }
  }

  const weightEntries = puppies.value
    .map((p: any, idx: number) => ({
      dog_id: p._id,
      weight: parseFloat(weights.value[idx]),
      date: finalDate,
    }))
    .filter(e => e.weight > 0)

  try {
    const res = await batchAdd(selectedLitter.value._id, weightEntries)
    if (res) {
      weights.value = puppies.value.map(() => '')
      submitState.value = 'success'
      await wait(140)
    }
  } catch {
    submitState.value = 'idle'
  } finally {
    if (submitState.value !== 'success') submitState.value = 'idle'
  }
}

let preselectedLitterId = ''

onLoad((query) => {
  if (query?.litterId) {
    preselectedLitterId = query.litterId
    // 有预选窝时直接在 onLoad 加载，避免 onShow 先于 preselectedLitterId 赋值
    loadLitters()
  }
})

onShow(() => {
  // 无预选窝或已选窝后重新进入页面时刷新
  if (!preselectedLitterId) {
    loadLitters()
  }
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

/* 顶栏 */
.top-bar {
  padding: 8px var(--space-page) 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.back-btn {
  background: none;
  padding: 4px 0 0 0;
  display: flex;
  align-items: center;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.85); }
}

.top-bar-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.top-bar-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.3;
  font-family: var(--font-display);
}

.top-bar-subtitle {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  line-height: 1.3;
}

/* 内容区 */
.content {
  padding: 0 var(--space-page) 32px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 窝选择卡片 */
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
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%);
    border-radius: var(--radius-card);
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

/* 分区标签 */
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
}

/* 幼崽体重卡片 */
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
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  & > * {
    position: relative;
    z-index: 1;
  }

  &--male {
    border-left-color: var(--blue);
    &::before { background: linear-gradient(135deg, var(--blue-soft) 0%, transparent 40%); }
  }

  &--female {
    border-left-color: var(--rose);
    &::before { background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%); }
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

  &--positive { color: var(--red); }   /* 红涨 */
  &--negative { color: var(--green); } /* 绿跌 */
}

.mini-trend {
  flex-shrink: 0;
  max-width: 100px;
}

.mini-trend-text {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
  white-space: nowrap;
}

/* 汇总栏 */
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

/* 底部区域 */
.bottom-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 4px;
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

.time-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  transition: opacity 0.12s ease;
  &:active { opacity: 0.7; }
}

.time-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
</style>
