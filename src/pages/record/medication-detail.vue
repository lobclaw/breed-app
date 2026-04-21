<template>
  <view class="page">
    <BPageHeader title="用药任务详情" />
    <BSubmitBanner :message="submitBannerMessage" />

    <view v-if="loading" class="card-feed">
      <BSkeleton :rows="8" />
    </view>

    <template v-if="!loading && task">
      <view class="card-feed">
        <view class="detail-summary detail-summary--plum">
          <view class="detail-summary__main">
            <view class="detail-summary__tag">
              <text class="detail-summary__tag-text">{{ statusText }}</text>
            </view>
            <text class="detail-summary__title">{{ task.drug_name || '用药任务' }}</text>
            <text class="detail-summary__sub">{{ task.dog_name || '未知犬只' }} · {{ formatDate(task.start_date) }} 开始</text>
            <text v-if="completionSummaryText" class="detail-summary__completion">{{ completionSummaryText }}</text>
          </view>
          <view class="detail-summary__meta">
            <text class="detail-summary__meta-value">{{ currentDay }}/{{ task.duration_days }}</text>
            <text class="detail-summary__meta-label">天数进度</text>
          </view>
        </view>
      </view>

      <view class="status-banner" :style="{ background: statusBannerBg }">
        <text class="status-banner-left" :style="{ color: statusBannerColor }">
          {{ statusText }} · 第{{ currentDay }}天/共{{ task.duration_days }}天
        </text>
        <text class="status-banner-right" :style="{ color: statusBannerColor }">
          {{ progressPercent }}%
        </text>
      </view>

      <view class="progress-wrapper">
        <BProgress :value="currentDay" :max="task.duration_days" color="plum" :show-label="false" />
      </view>

      <view class="section-label">
        <view class="section-dot" style="background: var(--plum);" />
        <text class="section-text">核心信息</text>
      </view>
      <view class="card-feed">
        <BCard color="plum" :pressable="false">
          <view class="info-rows">
            <view class="info-row">
              <text class="info-row-label">犬只</text>
              <view class="info-row-value">
                <view class="mini-avatar">
                  <text class="material-icons-round" style="color: #fff; font-size: 14px;">pets</text>
                </view>
                <text>{{ task.dog_name || '未知' }}</text>
              </view>
            </view>
            <view class="info-row">
              <text class="info-row-label">药品</text>
              <text class="info-row-value">{{ task.drug_name || '—' }}</text>
            </view>
            <view class="info-row" v-if="dosageText">
              <text class="info-row-label">剂量</text>
              <text class="info-row-value">{{ dosageText }}</text>
            </view>
            <view class="info-row" v-if="task.method">
              <text class="info-row-label">方式</text>
              <text class="info-row-value">{{ task.method }}</text>
            </view>
            <view class="info-row" v-if="frequencyText">
              <text class="info-row-label">频率</text>
              <text class="info-row-value">{{ frequencyText }}</text>
            </view>
            <view class="info-row">
              <text class="info-row-label">开始日期</text>
              <text class="info-row-value">{{ formatDate(task.start_date) }}</text>
            </view>
            <view class="info-row">
              <text class="info-row-label">预计结束</text>
              <text class="info-row-value">{{ formatDate(task.end_date) }}</text>
            </view>
            <view class="info-row" v-if="completionDetailText">
              <text class="info-row-label">完成情况</text>
              <text class="info-row-value">{{ completionDetailText }}</text>
            </view>
            <view class="info-row" v-if="task.protocol_name">
              <text class="info-row-label">来源方案</text>
              <view class="info-row-value">
                <view class="link-text-row" @click="goToProtocol">
                  <text class="link-text">{{ task.protocol_name }}</text>
                  <text class="material-icons-round" style="font-size: 16px; color: var(--primary);">chevron_right</text>
                </view>
              </view>
            </view>
            <view class="info-row" v-if="task.notes">
              <text class="info-row-label">注意事项</text>
              <text class="info-row-value info-row-value--wrap">{{ task.notes }}</text>
            </view>
          </view>
        </BCard>
      </view>

      <view class="section-label">
        <view class="section-dot" style="background: var(--plum);" />
        <text class="section-text">执行记录</text>
      </view>
      <view class="card-feed">
        <BCard color="plum" :pressable="false">
          <view class="exec-log">
            <view
              v-for="(day, idx) in executionDays"
              :key="idx"
              class="exec-log-item"
              :class="{ today: day.isToday }"
            >
              <view class="exec-log-item__dot" :class="`exec-log-item__dot--${day.status}`" />
              <view class="exec-log-item__body">
                <view class="exec-log-item__head">
                  <text class="exec-day" :style="{ color: day.isToday ? 'var(--plum)' : 'var(--text-2)' }">
                    第{{ day.dayNum }}天
                  </text>
                  <text class="exec-date" :style="{ color: day.isToday ? 'var(--plum)' : 'var(--text-3)' }">
                    {{ day.dateStr }}
                  </text>
                  <text class="exec-status-tag" :class="`exec-status-tag--${day.status}`">{{ day.statusLabel }}</text>
                </view>
                <text
                  class="exec-detail"
                  :class="{ highlight: day.isToday && day.status === 'pending' }"
                  :style="day.status === 'future' ? { color: 'var(--text-4)' } : {}"
                >
                  {{ day.detail }}
                </text>
              </view>
            </view>
          </view>
        </BCard>
      </view>

      <view class="section-label">
        <view class="section-dot" style="background: var(--red);" />
        <text class="section-text">操作</text>
      </view>
      <view class="action-area">
        <view class="medication-action-card">
          <view class="medication-action-card__glow" />
          <view class="medication-action-card__body">
            <view class="medication-action__row">
              <view v-if="task.status === 'active'" class="medication-action__secondary-wrap">
                <BButton class="medication-action__secondary" variant="ghost" color="red" @click="confirmEndEarly">
                  <view class="medication-action__secondary-inner">
                    <text class="material-icons-round medication-action__secondary-icon">block</text>
                    <text>取消用药</text>
                  </view>
                </BButton>
              </view>
              <BButton
                v-if="canMarkToday"
                class="medication-action__primary"
                variant="filled"
                color="plum"
                size="large"
                @click="markTodayComplete"
              >
                <view class="medication-action__primary-inner">
                  <text class="material-icons-round medication-action__primary-icon">check_circle</text>
                  <text>标记今日完成</text>
                </view>
              </BButton>
            </view>
            <text class="action-note medication-action__note">当前不支持直接编辑历史用药任务；如需调整，请取消后重新创建。</text>
          </view>
        </view>
      </view>
    </template>

    <BEmpty
      v-if="!loading && !task"
      icon="search_off"
      title="任务不存在"
      description="可能已被删除"
    />

    <BModal
      v-model:visible="showCancelConfirm"
      title="确认取消"
      content="取消后将不再提醒每日用药，确定要取消这个用药任务吗？"
      confirmText="确认取消"
      :danger="true"
      @confirm="handleCancelConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { consumeSubmitFeedback, queueSubmitFeedback } from '@/composables/useSubmitFeedback'
import BButton from '@/components/base/BButton.vue'
import BCard from '@/components/base/BCard.vue'
import BProgress from '@/components/base/BProgress.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BModal from '@/components/layout/BModal.vue'
import { resolveMedicationDetailId } from '@/utils/dogDetailNavigation'
import { formatMedicationDosage, formatMedicationFrequency } from '@/utils/medicationDisplay'
import { getMedicationDayState, getMedicationTodayProgress, getMedicationFrequency } from '@/utils/medicationState'

const task = ref<any>(null)
const loading = ref(true)
const submitBannerMessage = ref('')
const showCancelConfirm = ref(false)

let taskId = ''
let hasShownOnce = false
let submitBannerTimer: ReturnType<typeof setTimeout> | null = null

const DAY_MS = 86400000

function startOfDay(ts: number) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const todayTs = computed(() => startOfDay(Date.now()))

const currentDay = computed(() => {
  if (!task.value) return 0
  const elapsed = Math.floor((todayTs.value - task.value.start_date) / DAY_MS) + 1
  return Math.max(1, Math.min(elapsed, task.value.duration_days))
})

const progressPercent = computed(() => {
  if (!task.value) return 0
  return Math.round((currentDay.value / task.value.duration_days) * 100)
})

const statusText = computed(() => {
  if (!task.value) return ''
  if (task.value.status === 'completed') return '已完成'
  if (task.value.status === 'cancelled') return '已取消'
  return '进行中'
})

const dosageText = computed(() => formatMedicationDosage(task.value?.dosage, task.value?.dosage_unit))
const frequencyText = computed(() => formatMedicationFrequency(task.value?.frequency))

const statusBannerBg = computed(() => {
  if (task.value?.status === 'completed') return 'var(--green-soft)'
  if (task.value?.status === 'cancelled') return 'var(--red-soft)'
  return 'var(--plum-soft)'
})

const statusBannerColor = computed(() => {
  if (task.value?.status === 'completed') return 'var(--green)'
  if (task.value?.status === 'cancelled') return 'var(--red)'
  return 'var(--plum)'
})

const canMarkToday = computed(() => {
  if (!task.value || task.value.status !== 'active') return false
  const completedDates = task.value.completed_dates || []
  return !completedDates.includes(todayTs.value)
})

const completionCounts = computed(() => {
  if (!task.value) return { completed: 0, total: 0 }
  return {
    completed: Number(task.value.completed_dose_count) || 0,
    total: Number(task.value.total_dose_count) || 0,
  }
})

const completionSummaryText = computed(() => {
  if (!task.value || completionCounts.value.total === 0) return ''

  const { completed, total } = completionCounts.value
  if (task.value.status === 'completed') {
    return completed >= total ? `已完成 · ${completed}/${total} 次` : `部分完成 · ${completed}/${total} 次`
  }

  if (task.value.status === 'cancelled') {
    return `已执行 ${completed}/${total} 次`
  }

  return completed > 0 ? `已执行 ${completed}/${total} 次` : ''
})

const completionDetailText = computed(() => {
  if (!task.value || completionCounts.value.total === 0) return ''
  const { completed, total } = completionCounts.value
  if (task.value.status === 'completed' && completed < total) return `部分完成 · ${completed}/${total} 次`
  if (task.value.status === 'completed') return `已完成 · ${completed}/${total} 次`
  if (task.value.status === 'cancelled') return `已执行 ${completed}/${total} 次`
  return `${completed}/${total} 次`
})

interface ExecutionDay {
  dayNum: number
  dateStr: string
  status: 'done' | 'pending' | 'partial' | 'missed' | 'future'
  statusLabel: string
  detail: string
  isToday: boolean
}

const executionDays = computed<ExecutionDay[]>(() => {
  if (!task.value) return []
  const completedDates = task.value.completed_dates || []
  const completedMap = task.value.completed_map || {}
  const days: ExecutionDay[] = []
  const showDays = Math.min(task.value.duration_days, 10)

  for (let i = 0; i < showDays; i++) {
    const dayTs = task.value.start_date + i * DAY_MS
    const d = new Date(dayTs)
    const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const isToday = dayTs === todayTs.value
    const isDone = completedDates.includes(dayTs)
    const baseState = getMedicationDayState(task.value, dayTs, { todayTs: todayTs.value })
    const todayProgress = isToday ? getMedicationTodayProgress(task.value, { todayTs: todayTs.value }) : 'empty'
    const frequency = getMedicationFrequency(task.value)
    const dayDoseCount = Number(task.value.daily_doses?.[String(i + 1)]) || 0

    let status: ExecutionDay['status'] = baseState
    if (isToday && todayProgress === 'partial') {
      status = 'partial'
    }

    let detail = '—'
    if (isDone && completedMap[dayTs]) {
      const info = completedMap[dayTs]
      detail = `${info.name || ''} ${info.time || ''}`.trim()
    } else if (status === 'partial') {
      detail = `已执行 ${dayDoseCount}/${frequency} 次`
    } else if (isToday && status === 'pending') {
      detail = '待执行'
    } else if (status === 'missed') {
      detail = '当日未执行'
    }

    const statusLabelMap: Record<ExecutionDay['status'], string> = {
      done: '已执行',
      pending: '待执行',
      partial: '执行中',
      missed: '未执行',
      future: '未开始',
    }
    const statusLabel = statusLabelMap[status]
    days.push({ dayNum: i + 1, dateStr, status, statusLabel, detail, isToday })
  }

  return days
})

function formatDate(ts: number | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const { run: fetchTask } = useCloudCall('health-service', 'getMedicationTaskDetail')
const { run: completeDay } = useCloudCall('health-service', 'batchCompleteMedicationDay', {
  successMode: 'silent',
  loadingMode: 'local',
})
const { run: cancelTask } = useCloudCall('health-service', 'endMedication', {
  successMode: 'silent',
  loadingMode: 'local',
  loadingText: '取消中...',
})

async function loadTask() {
  loading.value = true
  const result = await fetchTask({ id: taskId })
  if (result) {
    task.value = result.data || result
  }
  loading.value = false
}

function showSubmitBanner(message: string) {
  submitBannerMessage.value = message
  if (submitBannerTimer) clearTimeout(submitBannerTimer)
  submitBannerTimer = setTimeout(() => {
    submitBannerMessage.value = ''
  }, 2200)
}

async function markTodayComplete() {
  const result = await completeDay([taskId])
  if (result) {
    queueSubmitFeedback({ message: '已完成今日用药' })
    showSubmitBanner('已完成今日用药')
    await loadTask()
  }
}

function goToProtocol() {
  if (task.value?.protocol_id) {
    uni.navigateTo({ url: `/pages/health/medication-protocols?id=${task.value.protocol_id}` })
  }
}

function confirmEndEarly() {
  showCancelConfirm.value = true
}

async function handleCancelConfirm() {
  const result = await cancelTask(taskId)
  if (result) {
    queueSubmitFeedback({ message: '已取消用药任务' })
    showSubmitBanner('已取消用药任务')
    await loadTask()
  }
}

onLoad((query) => {
  taskId = resolveMedicationDetailId(query as Record<string, unknown>)
  if (taskId) {
    loadTask()
  } else {
    loading.value = false
  }
})

onShow(() => {
  const feedback = consumeSubmitFeedback('/pages/record/medication-detail')
  if (feedback?.message) {
    showSubmitBanner(feedback.message)
  }
  if (!hasShownOnce) {
    hasShownOnce = true
    return
  }
  if (taskId) loadTask()
})
</script>

<style lang="scss" scoped>
.page {
  padding-bottom: 40px;
}

.detail-summary {
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  box-shadow: var(--shadow);
  &--plum { background: linear-gradient(135deg, var(--plum-soft), rgba(255, 255, 255, 0.96)); }
}
.detail-summary__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.detail-summary__tag {
  width: fit-content;
  padding: 4px 10px;
  border-radius: var(--radius-tag);
  background: rgba(134, 104, 176, 0.14);
}
.detail-summary__tag-text {
  font-size: 11px;
  font-weight: 700;
  color: var(--plum);
}
.detail-summary__title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-1);
}
.detail-summary__sub {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
}
.detail-summary__completion {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.detail-summary__meta {
  min-width: 68px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.detail-summary__meta-value {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 800;
  color: var(--plum);
}
.detail-summary__meta-label {
  font-size: 11px;
  color: var(--text-3);
}

.status-banner {
  margin: 4px 16px 12px;
  padding: 12px 16px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.status-banner-left {
  font-size: 13px;
  font-weight: 700;
}
.status-banner-right {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 800;
}

.progress-wrapper {
  margin: 0 16px 16px;
}

.card-feed {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);
  margin-bottom: 8px;
}

.info-rows {
  display: flex;
  flex-direction: column;
}
.info-row-label {
  flex-shrink: 0;
}
.info-row-value {
  text-align: right;
  display: flex;
  align-items: center;
  gap: 6px;

  &--wrap {
    max-width: 180px;
    text-align: right;
    line-height: 1.4;
    font-weight: 500;
    color: var(--text-2);
  }
}

.mini-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--rose), var(--amber));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.link-text-row {
  display: flex;
  align-items: center;
  gap: 4px;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.95); }
}
.link-text {
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px var(--space-page) 10px;
}
.section-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.section-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.5px;
}

.exec-log {
  display: flex;
  flex-direction: column;
  position: relative;
  &::before {
    content: '';
    position: absolute;
    top: 14px;
    bottom: 14px;
    left: 8px;
    width: 2px;
    background: rgba(134, 104, 176, 0.14);
  }
}
.exec-log-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(216, 203, 189, 0.2);
  &:last-child { border-bottom: none; }

  &.today {
    background: var(--plum-soft);
    margin: 0 -16px 0 -18px;
    padding: 12px 16px 12px 18px;
    border-radius: 10px;
    border-bottom: none;
  }
}
.exec-log-item__dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  margin-top: 2px;
  border: 3px solid #fff;
  box-shadow: 0 0 0 1px rgba(216, 203, 189, 0.2);
  z-index: 1;
  flex-shrink: 0;
  &--done { background: var(--green); }
  &--pending { background: var(--plum); }
  &--partial { background: var(--plum); }
  &--missed { background: var(--red); }
  &--future { background: var(--text-4); }
}
.exec-log-item__body {
  flex: 1;
  min-width: 0;
}
.exec-log-item__head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.exec-day {
  font-size: 12px;
  font-weight: 700;
}
.exec-date {
  font-size: 11px;
  min-width: 40px;
}
.exec-status-tag {
  margin-left: auto;
  padding: 3px 8px;
  border-radius: var(--radius-tag);
  font-size: 11px;
  font-weight: 700;
  &--done { background: var(--green-soft); color: var(--green); }
  &--pending { background: var(--plum-soft); color: var(--plum); }
  &--partial { background: rgba(134, 104, 176, 0.14); color: var(--plum); }
  &--missed { background: rgba(224, 82, 82, 0.1); color: var(--red); }
  &--future { background: var(--card-dim); color: var(--text-3); }
}
.exec-detail {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  &.highlight {
    color: var(--plum);
    font-weight: 700;
  }
}

.action-area {
  padding: 0 16px 8px;
}

.medication-action-card {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  border: 1px solid rgba(134, 104, 176, 0.12);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 242, 251, 0.96));
  box-shadow: 0 10px 30px rgba(101, 74, 145, 0.08);
}

.medication-action-card__glow {
  position: absolute;
  top: -42px;
  right: -18px;
  width: 132px;
  height: 132px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(171, 133, 219, 0.18), rgba(171, 133, 219, 0));
  pointer-events: none;
}

.medication-action-card__body {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
}

.medication-action__row {
  display: flex;
  align-items: stretch;
  gap: 10px;
}

.medication-action__primary {
  flex: 1;
  min-width: 0;
  min-height: 52px;
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(124, 89, 181, 0.24);
}

.medication-action__primary-inner,
.medication-action__secondary-inner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.medication-action__primary-icon {
  font-size: 18px;
  color: #fff;
}

.medication-action__secondary-wrap {
  flex: 0 0 auto;
  display: flex;
}

.medication-action__secondary {
  min-width: 114px;
  min-height: 52px;
  padding: 0 10px;
  border-radius: 18px;
  border-color: rgba(224, 82, 82, 0.18);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 244, 244, 0.88));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  color: var(--red);
}

.medication-action__secondary-icon {
  font-size: 16px;
  color: var(--red);
}

.action-note {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-3);
}

.medication-action__note {
  margin-top: 2px;
}

@media (max-width: 360px) {
  .medication-action__row {
    flex-direction: column;
  }

  .medication-action__secondary {
    width: 100%;
  }
}
</style>
