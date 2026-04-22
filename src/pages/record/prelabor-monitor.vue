<!--
  R-7 临产监测 — 快速监测日志模式
  录入临产监测数据：体温 + 趋势 + 征兆勾选 + 补充说明
-->
<template>
  <view class="prelabor-monitor">
    <!-- 页面标题栏 -->
    <BPageHeader title="录入临产监测" :subtitle="headerSubtitle" />

    <!-- 犬只选择 -->
    <view class="prelabor-monitor__dog-picker">
      <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" />
    </view>

    <!-- 主要内容 -->
    <view class="prelabor-monitor__content">

      <!-- 体温趋势卡片（上下文） -->
      <view v-if="tempHistory.length" class="prelabor-monitor__context-card">
        <view class="prelabor-monitor__context-bg" />
        <!-- 上次监测 -->
        <view class="prelabor-monitor__last-record">
          <view class="prelabor-monitor__last-icon">
            <text class="material-icons-round" style="font-size: 17px; color: var(--rose);">history</text>
          </view>
          <view class="prelabor-monitor__last-info">
            <text class="prelabor-monitor__last-label">上次监测 · {{ lastRecordTime }}</text>
            <text class="prelabor-monitor__last-value">{{ lastRecordSummary }}</text>
          </view>
        </view>

        <!-- 迷你趋势线 -->
        <view class="prelabor-monitor__trend">
          <view
            v-for="(item, idx) in tempHistory"
            :key="idx"
            class="prelabor-monitor__trend-item"
          >
            <text
              class="prelabor-monitor__trend-num"
              :class="{
                'prelabor-monitor__trend-num--current': idx === tempHistory.length - 1,
                'prelabor-monitor__trend-num--danger': item.temp < 37.2 && idx === tempHistory.length - 1,
              }"
            >{{ item.temp.toFixed(1) }}</text>
            <view
              class="prelabor-monitor__trend-bar"
              :class="getTempBarClass(item.temp)"
              :style="{ height: getTempBarHeight(item.temp) + 'px' }"
            />
            <text class="prelabor-monitor__trend-time" :class="{ 'prelabor-monitor__trend-time--current': idx === tempHistory.length - 1 }">{{ item.label }}</text>
          </view>
        </view>

        <!-- 警告 -->
        <view v-if="showLaborAlert" class="prelabor-monitor__alert">
          <text class="material-icons-round" style="font-size: 16px;">warning</text>
          <text class="prelabor-monitor__alert-text">体温持续下降至37.2°C以下，可能24小时内生产</text>
        </view>
      </view>

      <!-- 体温输入 -->
      <view class="prelabor-monitor__section">
        <view class="prelabor-monitor__label">
          <view class="prelabor-monitor__label-dot" />
          <text class="prelabor-monitor__label-text">本次体温</text>
        </view>
        <view class="prelabor-monitor__temp-card">
          <view class="prelabor-monitor__temp-left">
            <input
              v-model="temperature"
              class="prelabor-monitor__temp-input"
              type="digit"
              placeholder="37.5"
              :maxlength="4"
            />
            <text class="prelabor-monitor__temp-unit">°C</text>
          </view>
          <view class="prelabor-monitor__temp-right">
            <text class="prelabor-monitor__temp-time-label">测量时间</text>
            <text class="prelabor-monitor__temp-time" @click="pickTime">{{ displayTime }}</text>
          </view>
        </view>
      </view>

      <!-- 征兆勾选 -->
      <view class="prelabor-monitor__section">
        <view class="prelabor-monitor__label">
          <view class="prelabor-monitor__label-dot" />
          <text class="prelabor-monitor__label-text">观察到的征兆</text>
        </view>
        <view class="prelabor-monitor__symptom-grid">
          <view
            v-for="s in symptoms"
            :key="s"
            class="prelabor-monitor__symptom"
            :class="{ 'prelabor-monitor__symptom--selected': selectedSymptoms.includes(s) }"
            @click="toggleSymptom(s)"
          >
            <text
              v-if="selectedSymptoms.includes(s)"
              class="material-icons-round"
              style="font-size: 16px; color: var(--primary);"
            >check</text>
            <text class="prelabor-monitor__symptom-text">{{ s }}</text>
          </view>
        </view>
      </view>

      <!-- 补充说明 -->
      <view class="prelabor-monitor__section">
        <view class="prelabor-monitor__label">
          <view class="prelabor-monitor__label-dot" />
          <text class="prelabor-monitor__label-text">补充说明</text>
          <text class="prelabor-monitor__label-optional">（选填）</text>
        </view>
        <textarea
          v-model="notes"
          class="prelabor-monitor__textarea"
          placeholder="补充观察到的其他情况..."
          :maxlength="500"
        />
      </view>

      <!-- 时间 + 保存 -->
      <view class="prelabor-monitor__bottom">
        <view class="prelabor-monitor__save-btn" @click="handleSave">
          <text class="prelabor-monitor__save-text">{{ submitting ? '提交中...' : '保存记录' }}</text>
        </view>
        <view class="prelabor-monitor__time-display" @click="pickTime">
          <text class="material-icons-round" style="font-size: 14px; color: var(--text-3);">schedule</text>
          <text class="prelabor-monitor__time-display-text">{{ displayTime }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'

interface TempRecord {
  temp: number
  label: string
  time: number
}

const selectedDog = ref<any>(null)

// 体温
const temperature = ref('')
const recordTime = ref(new Date())
const submitting = ref(false)
const displayTime = computed(() => {
  const h = String(recordTime.value.getHours()).padStart(2, '0')
  const m = String(recordTime.value.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
})

// 历史体温趋势（最近4-6次）
const tempHistory = ref<TempRecord[]>([])

// 征兆
const symptoms = ['刨窝', '焦躁', '食欲减退', '喘气', '分泌物', '宫缩', '乳汁', '拒食']
const selectedSymptoms = ref<string[]>([])

// 备注
const notes = ref('')

// 当选择犬只变化时加载体温历史
watch(selectedDog, (dog: any) => {
  if (dog?._id) loadTempHistory(dog._id)
})

// 计算属性
const headerSubtitle = computed(() => {
  if (selectedDog.value) return `${selectedDog.value.gender || ''} · ${selectedDog.value.role || ''}`
  return ''
})

const lastRecordTime = computed(() => {
  if (!tempHistory.value.length) return ''
  return tempHistory.value[tempHistory.value.length - 1]?.label || ''
})

const lastRecordSummary = computed(() => {
  if (!tempHistory.value.length) return ''
  const last = tempHistory.value[tempHistory.value.length - 1]
  return `${last.temp.toFixed(1)}°C`
})

const showLaborAlert = computed(() => {
  if (tempHistory.value.length < 2) return false
  const last = tempHistory.value[tempHistory.value.length - 1]
  return last.temp < 37.2
})

onLoad((query: any) => {
  if (query?.dogId) {
    loadTempHistory(query.dogId)
    selectedDog.value = {
      _id: query.dogId,
      name: query?.dogName || '',
      gender: '母',
      role: '种狗',
    }
  }
})

async function loadTempHistory(id: string) {
  try {
    const db = uniCloud.database()
    const res = await db.collection('health_records')
      .where(`dog_id == "${id}" && type == "prelabor_monitor"`)
      .orderBy('record_time', 'desc')
      .limit(6)
      .get()

    const records = (res.result?.data || []).reverse()
    tempHistory.value = records.map((r: any) => ({
      temp: r.temperature || 0,
      label: formatTimeLabel(r.record_time),
      time: r.record_time,
    }))
  } catch (e) {
    console.error('加载体温记录失败', e)
  }
}

function formatTimeLabel(ts: number): string {
  const now = new Date()
  const d = new Date(ts)
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  const h = d.getHours()
  const period = h < 12 ? '早' : h < 18 ? '午' : '晚'

  if (diffDays === 0) return `今${period}`
  if (diffDays === 1) return `昨${period}`
  return `${diffDays}天前`
}

function getTempBarClass(temp: number): string {
  if (temp >= 37.8) return 'prelabor-monitor__trend-bar--high'
  if (temp >= 37.2) return 'prelabor-monitor__trend-bar--mid'
  return 'prelabor-monitor__trend-bar--low'
}

function getTempBarHeight(temp: number): number {
  // 映射 36.0-39.0 到 4-26px
  const clamped = Math.max(36, Math.min(39, temp))
  return 4 + ((clamped - 36) / 3) * 22
}

function toggleSymptom(s: string) {
  const idx = selectedSymptoms.value.indexOf(s)
  if (idx >= 0) {
    selectedSymptoms.value.splice(idx, 1)
  } else {
    selectedSymptoms.value.push(s)
  }
}

function pickTime() {
  uni.showActionSheet({
    itemList: ['使用当前时间'],
    success: () => {
      recordTime.value = new Date()
    },
  })
}

const { run: addBreedingRecord } = useCloudCall('breeding-service', 'addBreedingRecord', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

async function handleSave() {
  if (submitting.value) return
  if (!selectedDog.value) {
    uni.showToast({ title: '请选择犬只', icon: 'none' })
    return
  }
  const temp = parseFloat(temperature.value)
  if (!temp || temp < 35 || temp > 42) {
    uni.showToast({ title: '请输入有效体温', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const res = await addBreedingRecord({
      type: 'pre_labor',
      dog_id: selectedDog.value._id,
      date: recordTime.value.getTime(),
      details: {
        temperature: temp,
        symptoms: selectedSymptoms.value,
      },
      notes: notes.value || null,
    })
    if (res) {
      queueSubmitFeedback({
        message: '已保存临产监测',
        homeSection: 'breeding',
        homeAnchorKey: 'breeding-step:birth',
      })
      await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
      uni.navigateBack({ delta: 1 })
    }
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.prelabor-monitor {
  min-height: 100vh;
  background: var(--bg);

  /* 犬只选择器区域 */
  &__dog-picker {
    padding: 0 var(--space-page) 12px;
  }

  /* 内容 */
  &__content {
    padding: 0 var(--space-page) 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  &__section {}

  /* 标签 */
  &__label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__label-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--rose);
    flex-shrink: 0;
  }

  &__label-text {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
  }

  &__label-optional {
    font-size: 13px;
    font-weight: 400;
    color: var(--text-3);
  }

  /* 上下文卡片 */
  &__context-card {
    background: var(--card);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow);
    overflow: hidden;
    position: relative;
  }

  &__context-bg {
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 35%);
    pointer-events: none;
    border-radius: var(--radius-card);
  }

  &__last-record {
    padding: 14px 16px 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    position: relative;
    z-index: 1;
  }

  &__last-icon {
    width: 34px;
    height: 34px;
    border-radius: var(--radius-icon);
    background: var(--icon-rose);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__last-info {
    flex: 1;
  }

  &__last-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    display: block;
  }

  &__last-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
    display: block;
    margin-top: 1px;
  }

  /* 趋势线 */
  &__trend {
    padding: 10px 16px 8px;
    display: flex;
    align-items: flex-end;
    gap: 6px;
    position: relative;
    z-index: 1;
  }

  &__trend-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  &__trend-num {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
    color: var(--text-2);

    &--current {
      font-size: 15px;
      font-weight: 800;
      color: var(--rose);
    }

    &--danger {
      color: var(--red);
    }
  }

  &__trend-bar {
    width: 100%;
    border-radius: 4px;
    min-height: 4px;
    transition: all 0.2s ease;

    &--high { background: rgba(61, 174, 111, 0.2); }
    &--mid { background: rgba(232, 155, 62, 0.2); }
    &--low {
      background: linear-gradient(135deg, var(--rose), var(--red));
      box-shadow: 0 2px 8px rgba(224, 82, 82, 0.25);
    }
  }

  &__trend-time {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-4);

    &--current {
      color: var(--rose);
      font-weight: 700;
    }
  }

  /* 警告 */
  &__alert {
    padding: 10px 16px;
    border-top: 1px solid rgba(216, 203, 189, 0.15);
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--red);
    position: relative;
    z-index: 1;
  }

  &__alert-text {
    font-size: 12px;
    font-weight: 700;
    color: var(--red);
  }

  /* 体温输入 */
  &__temp-card {
    background: var(--card);
    border-radius: var(--radius-card);
    padding: 16px;
    box-shadow: var(--shadow);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__temp-left {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  &__temp-input {
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 800;
    color: var(--text-1);
    width: 90px;
    border: none;
    background: transparent;
  }

  &__temp-unit {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-3);
  }

  &__temp-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  &__temp-time-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-3);
  }

  &__temp-time {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }

  /* 征兆网格 */
  &__symptom-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  &__symptom {
    height: 44px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    border-radius: 14px;
    background: var(--card-dim);
    transition: all 0.12s ease;
    &:active { transform: scale(0.94); filter: brightness(0.95); }

    &--selected {
      background: var(--primary-soft);
    }
  }

  &__symptom-text {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-2);
  }

  &__symptom--selected &__symptom-text {
    color: var(--primary);
    font-weight: 600;
  }

  /* 文本域 */
  &__textarea {
    width: 100%;
    min-height: 60px;
    padding: 12px 14px;
    border: 1.5px solid var(--text-4);
    border-radius: 14px;
    background: var(--card);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    color: var(--text-1);
    transition: border-color 0.15s ease;
  }

  /* 底部 */
  &__bottom {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 4px;
  }

  &__save-btn {
    width: 100%;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-btn);
    background: var(--primary);
    box-shadow: 0 4px 16px rgba(234, 62, 119, 0.25);
    transition: all 0.12s ease;
    &:active { transform: scale(0.94); opacity: 0.85; }
  }

  &__save-text {
    font-size: 15px;
    font-weight: 700;
    color: #FFFFFF;
  }

  &__time-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  &__time-display-text {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
  }
}
</style>
