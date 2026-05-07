<template>
  <view class="page">
    <BPageHeader :title="pageTitle" />
    <BSubmitBanner :message="submitBannerMessage" />

    <template v-if="loading">
      <view class="card-feed">
        <view class="detail-skeleton-card detail-skeleton-card--summary">
          <view class="detail-skeleton-card__main">
            <view class="detail-skeleton detail-skeleton--tag" />
            <view class="detail-skeleton detail-skeleton--title" />
            <view class="detail-skeleton detail-skeleton--sub" />
            <view class="detail-skeleton detail-skeleton--completion" />
          </view>
          <view class="detail-skeleton-card__meta">
            <view class="detail-skeleton detail-skeleton--meta-value" />
            <view class="detail-skeleton detail-skeleton--meta-label" />
          </view>
        </view>
      </view>

      <view class="detail-skeleton-banner">
        <view class="detail-skeleton detail-skeleton--banner-main" />
        <view class="detail-skeleton detail-skeleton--banner-side" />
      </view>

      <view class="progress-wrapper">
        <view class="detail-skeleton-progress">
          <view class="detail-skeleton detail-skeleton--progress-fill" />
        </view>
      </view>

      <view class="section-label">
        <view class="section-dot" style="background: var(--plum);" />
        <text class="section-text">核心信息</text>
      </view>
      <view class="card-feed">
        <view class="detail-skeleton-panel">
          <view v-for="row in 7" :key="`medication-info-${row}`" class="detail-skeleton-row">
            <view class="detail-skeleton detail-skeleton--label" :class="{ 'detail-skeleton--label-short': row > 5 }" />
            <view class="detail-skeleton-row__value" :class="{ 'detail-skeleton-row__value--stack': row === 1 || row === 7 }">
              <template v-if="row === 1">
                <view class="detail-skeleton detail-skeleton--avatar" />
                <view class="detail-skeleton detail-skeleton--value" />
              </template>
              <template v-else-if="row === 7">
                <view class="detail-skeleton detail-skeleton--note-wide" />
              </template>
              <template v-else>
                <view class="detail-skeleton detail-skeleton--value" />
              </template>
            </view>
          </view>
        </view>
      </view>

      <view class="section-label">
        <view class="section-dot" style="background: var(--plum);" />
        <text class="section-text">执行记录</text>
      </view>
      <view class="card-feed">
        <view class="detail-skeleton-panel detail-skeleton-panel--timeline">
          <view v-for="item in 4" :key="`medication-log-${item}`" class="detail-skeleton-timeline">
            <view class="detail-skeleton detail-skeleton--timeline-dot" />
            <view class="detail-skeleton-timeline__body">
              <view class="detail-skeleton-timeline__head">
                <view class="detail-skeleton detail-skeleton--timeline-day" />
                <view class="detail-skeleton detail-skeleton--timeline-date" />
                <view class="detail-skeleton detail-skeleton--pill" />
              </view>
              <view class="detail-skeleton detail-skeleton--timeline-detail" />
            </view>
          </view>
        </view>
      </view>

      <view class="action-area">
        <view class="detail-skeleton-action">
          <view class="detail-skeleton-action__glow" />
          <view class="detail-skeleton-action__row">
            <view class="detail-skeleton detail-skeleton--button detail-skeleton--button-secondary" />
            <view class="detail-skeleton detail-skeleton--button detail-skeleton--button-primary" />
          </view>
          <view class="detail-skeleton detail-skeleton--action-note" />
        </view>
      </view>
    </template>

    <template v-if="!loading && task">
      <view class="card-feed">
        <view class="detail-summary detail-summary--plum">
          <view class="detail-summary__main">
            <view class="detail-summary__tag" :class="`detail-summary__tag--${statusTagTone}`">
              <text class="detail-summary__tag-text">{{ statusText }}</text>
            </view>
            <text class="detail-summary__title">{{ task.drug_name || '用药任务' }}</text>
            <text class="detail-summary__sub">{{ medicationMethodSummary }}</text>
            <text v-if="treatmentSummaryText" class="detail-summary__completion">{{ treatmentSummaryText }}</text>
          </view>
          <view class="detail-summary__meta">
            <text class="detail-summary__meta-value">{{ summaryMetaValue }}</text>
            <text class="detail-summary__meta-label">{{ summaryMetaLabel }}</text>
          </view>
        </view>
      </view>

      <view v-if="showDayProgress" class="status-banner" :style="{ background: statusBannerBg }">
        <text class="status-banner-left" :style="{ color: statusBannerColor }">
          {{ statusBannerText }}
        </text>
        <text class="status-banner-right" :style="{ color: statusBannerColor }">
          {{ progressPercent }}%
        </text>
      </view>

      <view v-if="showDayProgress" class="progress-wrapper">
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
              <text class="info-row-label">开始日期</text>
              <text class="info-row-value">{{ formatDate(task.start_date) }}</text>
            </view>
            <view class="info-row">
              <text class="info-row-label">预计结束</text>
              <text class="info-row-value">{{ formatDate(task.end_date) }} · {{ endDateRelativeText }}</text>
            </view>
            <view class="info-row">
              <text class="info-row-label">执行进度</text>
              <text class="info-row-value">{{ totalExecutionSummary }}</text>
            </view>
            <view class="info-row">
              <text class="info-row-label">关联来源</text>
              <text class="info-row-value" :class="{ 'info-row-value--wrap': relationType === 'fallback' }">{{ relationTypeLabel }}</text>
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

      <template v-if="linkedIllness">
        <view class="section-label">
          <view class="section-dot" style="background: var(--red);" />
          <text class="section-text">关联疾病</text>
        </view>
        <view class="card-feed">
          <BCard color="red" :pressable="false">
            <view class="linked-illness-card" @click="goToLinkedIllness">
              <view class="linked-illness-card__main">
                <text class="linked-illness-card__title">{{ linkedIllness.primaryCondition }}</text>
                <text v-if="linkedIllnessSymptomText" class="linked-illness-card__sub">{{ linkedIllnessSymptomText }}</text>
                <text v-if="linkedIllnessDateText" class="linked-illness-card__sub linked-illness-card__sub--secondary">{{ linkedIllnessDateText }}</text>
              </view>
              <view class="linked-illness-card__side">
                <BTag :label="linkedIllness.treatmentStatus || '观察中'" :color="linkedIllnessStatusColor" />
                <text class="material-icons-round linked-illness-card__chevron">chevron_right</text>
              </view>
            </view>
          </BCard>
        </view>
      </template>

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
                    {{ day.title }}
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
            <text v-if="actionNoteText" class="action-note medication-action__note">{{ actionNoteText }}</text>
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

    <BSheet v-model:visible="showCancelDispositionSheet" title="">
      <view class="form-sheet medication-stop-sheet">
        <view class="medication-stop-sheet__icon-wrap">
          <text class="material-icons-round medication-stop-sheet__icon">medication_liquid</text>
        </view>
        <text class="medication-stop-sheet__title">停止用药后，这条疾病怎么处理？</text>
        <text class="medication-stop-sheet__desc">{{ linkedIllness?.primaryCondition || '当前疾病' }} 当前状态为 {{ linkedIllness?.treatmentStatus || '治疗中' }}，请选择这次停药后的去向。</text>
        <view class="medication-stop-sheet__options">
          <view
            v-for="option in illnessDispositionOptions"
            :key="option.value"
            class="medication-stop-sheet__option"
            :class="{ 'medication-stop-sheet__option--active': selectedIllnessDisposition === option.value }"
            @click="selectedIllnessDisposition = option.value"
          >
            <view class="medication-stop-sheet__option-main">
              <text class="medication-stop-sheet__option-title">{{ option.label }}</text>
              <text class="medication-stop-sheet__option-sub">{{ option.desc }}</text>
            </view>
            <view class="medication-stop-sheet__radio" :class="{ 'medication-stop-sheet__radio--active': selectedIllnessDisposition === option.value }" />
          </view>
        </view>
      </view>
      <template #footer>
        <view class="form-sheet__footer">
          <button class="form-sheet__submit form-sheet__submit--danger" @click="confirmCancelWithDisposition">确认停止</button>
        </view>
      </template>
    </BSheet>

    <BModal
      v-model:visible="showCancelConfirm"
      title="确认取消"
      content="取消后将不再提醒每日用药，确定要取消这个用药任务吗？"
      confirmText="确认取消"
      :danger="true"
      @confirm="handleCancelConfirm()"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import { getLocalMedicationTaskDetail } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import { consumeSubmitFeedback, queueSubmitFeedback } from '@/composables/useSubmitFeedback'
import BButton from '@/components/base/BButton.vue'
import BCard from '@/components/base/BCard.vue'
import BProgress from '@/components/base/BProgress.vue'
import BTag from '@/components/base/BTag.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BModal from '@/components/layout/BModal.vue'
import { buildHealthDetailUrl, resolveMedicationDetailId } from '@/utils/dogDetailNavigation'
import { getBeijingDayStart } from '@/utils/date'
import { formatMedicationDosage, formatMedicationFrequency } from '@/utils/medicationDisplay'
import { getMedicationDayState, getMedicationTodayProgress, getMedicationFrequency } from '@/utils/medicationState'

const task = ref<any>(null)
const loading = ref(true)
const submitBannerMessage = ref('')
const showCancelConfirm = ref(false)
const showCancelDispositionSheet = ref(false)
const selectedIllnessDisposition = ref<'observation' | 'recovered' | 'keep_treating'>('observation')

let taskId = ''
let hasShownOnce = false
let submitBannerTimer: ReturnType<typeof setTimeout> | null = null
const { currentFamily } = useAuth()
usePageSync({ routePath: 'pages/record/medication-detail' })

const DAY_MS = 86400000

function startOfDay(ts: number) {
  return getBeijingDayStart(ts)
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

const showDayProgress = computed(() => {
  return (task.value?.duration_days || 0) > 1
})

const pageTitle = computed(() => {
  const dogName = task.value?.dog_name
  return dogName ? `${dogName} · 用药详情` : '用药详情'
})

const statusText = computed(() => {
  if (!task.value) return ''
  if (task.value.status === 'completed') return '已完成'
  if (task.value.status === 'cancelled') return '已取消'
  return '进行中'
})
const statusTagTone = computed<'plum' | 'green' | 'gray'>(() => {
  if (task.value?.status === 'completed') return 'green'
  if (task.value?.status === 'cancelled') return 'gray'
  return 'plum'
})

const dosageText = computed(() => formatMedicationDosage(task.value?.dosage, task.value?.dosage_unit))
const frequencyText = computed(() => formatMedicationFrequency(task.value?.frequency))
const linkedIllness = computed(() => task.value?.linkedIllness || null)
const relationType = computed<'linked' | 'fallback' | 'standalone'>(() => {
  const raw = task.value?.relationType
  if (raw === 'linked' || raw === 'fallback') return raw
  return 'standalone'
})
const relationTypeLabel = computed(() => {
  if (relationType.value === 'linked') return '关联疾病'
  if (relationType.value === 'fallback') return '未明确关联'
  return '独立用药'
})
const linkedIllnessSymptomText = computed(() => {
  if (!linkedIllness.value) return ''
  return linkedIllness.value.symptomSummary || ''
})
const linkedIllnessDateText = computed(() => {
  if (!linkedIllness.value?.date) return linkedIllness.value ? '查看完整疾病记录' : ''
  return `发病日期：${formatDate(linkedIllness.value.date)}`
})
const linkedIllnessStatusColor = computed<'green' | 'amber' | 'red'>(() => {
  if (linkedIllness.value?.treatmentStatus === '已康复') return 'green'
  if (linkedIllness.value?.treatmentStatus === '治疗中') return 'amber'
  return 'red'
})
const canChooseIllnessDisposition = computed(() => {
  return task.value?.status === 'active'
    && relationType.value === 'linked'
    && !!linkedIllness.value
    && linkedIllness.value.treatmentStatus !== '已康复'
})
const illnessDispositionOptions = [
  { value: 'observation' as const, label: '回到观察中', desc: '结束本轮用药，疾病继续留在观察区。' },
  { value: 'recovered' as const, label: '标记已康复', desc: '本轮治疗已收口，这条疾病一并结束。' },
  { value: 'keep_treating' as const, label: '保持治疗中', desc: '只结束这轮药，疾病状态继续保留治疗中。' },
]
const medicationMethodSummary = computed(() => {
  const parts = [
    task.value?.method || '',
    dosageText.value,
    frequencyText.value,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '用药信息待补充'
})

const statusBannerBg = computed(() => {
  if (task.value?.status === 'completed') return 'var(--green-soft)'
  if (task.value?.status === 'cancelled') return 'var(--card-dim)'
  return 'var(--plum-soft)'
})

const statusBannerColor = computed(() => {
  if (task.value?.status === 'completed') return 'var(--green)'
  if (task.value?.status === 'cancelled') return 'var(--text-3)'
  return 'var(--plum)'
})
const statusBannerText = computed(() => {
  if (!task.value) return ''
  if (task.value.status === 'completed') return `疗程共${task.value.duration_days}天`
  if (task.value.status === 'cancelled') return `已在第${currentDay.value}天停止`
  return `第${currentDay.value}天/共${task.value.duration_days}天`
})

const canMarkToday = computed(() => {
  if (!task.value || task.value.status !== 'active') return false
  const completedDates = task.value.completed_dates || []
  return !completedDates.includes(todayTs.value)
})

const todayRequiredDoseCount = computed(() => getMedicationFrequency(task.value))
const todayCompletedDoseCount = computed(() => {
  if (!task.value) return 0
  if ((task.value.completed_dates || []).includes(todayTs.value)) return todayRequiredDoseCount.value
  const dayDoseCount = Number(task.value.daily_doses?.[String(currentDay.value)]) || 0
  return Math.min(dayDoseCount, todayRequiredDoseCount.value)
})

const summaryMetaValue = computed(() => {
  if (!task.value) return ''
  return `${todayCompletedDoseCount.value}/${todayRequiredDoseCount.value}`
})

const summaryMetaLabel = computed(() => {
  return '今日完成'
})

const totalExecutionSummary = computed(() => {
  if (!task.value) return '已执行 0/0 次'
  const completed = Number(task.value.completed_dose_count || 0)
  const total = Number(task.value.total_dose_count || 0)
  return `已执行 ${completed}/${total} 次`
})

const treatmentSummaryText = computed(() => {
  if (!task.value) return ''
  const parts = []
  if (task.value.status === 'active') {
    parts.push(`疗程第${currentDay.value}天`)
  } else {
    parts.push(statusText.value)
  }
  if (task.value.end_date) parts.push(`预计${endDateRelativeText.value}`)
  return parts.join(' · ')
})
const actionNoteText = computed(() => {
  if (!task.value) return ''
  if (task.value.status === 'completed') return '疗程已结束，可继续查看完整执行记录。'
  if (task.value.status === 'cancelled') return '用药已取消，已执行记录会继续保留。'
  if (canMarkToday.value) return `今天还需完成 ${todayRequiredDoseCount.value - todayCompletedDoseCount.value} 次。`
  return '今日用药已完成，可继续查看执行记录。'
})

const endDateRelativeText = computed(() => {
  if (!task.value?.end_date) return '结束时间待定'
  const diffDays = Math.floor((startOfDay(task.value.end_date) - todayTs.value) / DAY_MS)
  if (diffDays > 0) return `还有${diffDays}天`
  if (diffDays === 0) return '今天结束'
  return `已结束${Math.abs(diffDays)}天`
})

interface ExecutionDay {
  dayNum: number
  title: string
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
      detail = `待执行 · ${frequencyText.value}`
    } else if (status === 'missed') {
      detail = '当日未执行'
    } else if (status === 'future') {
      detail = frequencyText.value
    }

    const statusLabelMap: Record<ExecutionDay['status'], string> = {
      done: '已执行',
      pending: '待执行',
      partial: '执行中',
      missed: '未执行',
      future: '未开始',
    }
    const statusLabel = statusLabelMap[status]
    const title = isToday ? `今天 · 第${i + 1}天` : `第${i + 1}天`
    days.push({ dayNum: i + 1, title, dateStr, status, statusLabel, detail, isToday })
  }

  return days
})

function formatDate(ts: number | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function loadTask() {
  loading.value = true
  const familyId = currentFamily.value?._id || ''
  if (!familyId) {
    task.value = null
    loading.value = false
    return
  }
  localSyncRuntime.setCurrentFamilyId(familyId)
  task.value = await getLocalMedicationTaskDetail(familyId, taskId)
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
  const result = await localSyncRuntime.batchCompleteMedicationDayLocally(currentFamily.value?._id || '', [taskId])
  if (result) {
    queueSubmitFeedback({ message: '已完成今日用药', homeSection: 'therapy' })
    showSubmitBanner('已完成今日用药')
    await loadTask()
  }
}

function goToProtocol() {
  if (task.value?.protocol_id) {
    uni.navigateTo({ url: `/pages/health/medication-protocols?id=${task.value.protocol_id}` })
  }
}

function goToLinkedIllness() {
  if (!linkedIllness.value?.recordId) return
  uni.navigateTo({ url: buildHealthDetailUrl(linkedIllness.value.recordId) })
}

function confirmEndEarly() {
  if (canChooseIllnessDisposition.value) {
    selectedIllnessDisposition.value = 'observation'
    showCancelDispositionSheet.value = true
    return
  }
  showCancelConfirm.value = true
}

async function handleCancelConfirm(illnessDisposition?: 'observation' | 'recovered' | 'keep_treating') {
  showCancelConfirm.value = false
  showCancelDispositionSheet.value = false
  const payload = illnessDisposition
    ? { id: taskId, illnessDisposition }
    : { id: taskId }
  const result = await localSyncRuntime.endMedicationLocally(currentFamily.value?._id || '', taskId, payload)
  if (result) {
    queueSubmitFeedback({ message: '已取消用药任务', homeSection: 'therapy' })
    showSubmitBanner('已取消用药任务')
    await loadTask()
  }
}

function confirmCancelWithDisposition() {
  handleCancelConfirm(selectedIllnessDisposition.value)
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
  padding-bottom: calc(188px + env(safe-area-inset-bottom));
}

.detail-skeleton-card,
.detail-skeleton-panel,
.detail-skeleton-action,
.detail-skeleton-banner,
.detail-skeleton-progress {
  position: relative;
  overflow: hidden;
  background: var(--card);
  border-radius: 16px;
  box-shadow: var(--shadow);
}
.detail-skeleton-card::after,
.detail-skeleton-panel::after,
.detail-skeleton-action::after,
.detail-skeleton-banner::after,
.detail-skeleton-progress::after,
.detail-skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.56) 50%, transparent 100%);
  animation: detail-skeleton-shimmer 1.5s infinite;
}
.detail-skeleton-card--summary {
  padding: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.detail-skeleton-card__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail-skeleton-card__meta {
  min-width: 68px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
}
.detail-skeleton-banner {
  margin: 4px 16px 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--plum-soft);
}
.detail-skeleton-progress {
  height: 10px;
  border-radius: 999px;
  background: rgba(134, 104, 176, 0.14);
  box-shadow: none;
}
.detail-skeleton-panel {
  padding: 2px 0;
}
.detail-skeleton-panel--timeline {
  padding: 10px 16px;
}
.detail-skeleton-row {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.detail-skeleton-row + .detail-skeleton-row {
  border-top: 1px solid rgba(216, 203, 189, 0.12);
}
.detail-skeleton-row__value {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 120px;
}
.detail-skeleton-row__value--stack {
  min-width: 140px;
}
.detail-skeleton-timeline {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
}
.detail-skeleton-timeline + .detail-skeleton-timeline {
  border-top: 1px solid rgba(216, 203, 189, 0.12);
}
.detail-skeleton-timeline__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.detail-skeleton-timeline__head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-skeleton-action {
  padding: 14px 16px 16px;
}
.detail-skeleton-action__glow {
  position: absolute;
  right: -18px;
  bottom: -22px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(243, 237, 255, 0.95) 0%, rgba(243, 237, 255, 0) 72%);
}
.detail-skeleton-action__row {
  position: relative;
  display: flex;
  gap: 12px;
}
.detail-skeleton {
  position: relative;
  overflow: hidden;
  border-radius: 999px;
  background: var(--card-dim);
}
.detail-skeleton--tag {
  width: 56px;
  height: 24px;
}
.detail-skeleton--title {
  width: 130px;
  max-width: 58%;
  height: 20px;
}
.detail-skeleton--sub {
  width: 166px;
  max-width: 72%;
  height: 13px;
}
.detail-skeleton--completion {
  width: 108px;
  height: 12px;
}
.detail-skeleton--meta-value {
  width: 42px;
  height: 18px;
}
.detail-skeleton--meta-label {
  width: 38px;
  height: 11px;
}
.detail-skeleton--banner-main {
  width: 62%;
  height: 14px;
}
.detail-skeleton--banner-side {
  width: 34px;
  height: 14px;
}
.detail-skeleton--progress-fill {
  width: 58%;
  height: 100%;
  border-radius: inherit;
  background: rgba(134, 104, 176, 0.32);
}
.detail-skeleton--label {
  width: 72px;
  height: 12px;
}
.detail-skeleton--label-short {
  width: 52px;
}
.detail-skeleton--value {
  width: 88px;
  height: 14px;
}
.detail-skeleton--avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}
.detail-skeleton--note-wide {
  width: 124px;
  height: 14px;
}
.detail-skeleton--timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 4px;
}
.detail-skeleton--timeline-day {
  width: 48px;
  height: 12px;
}
.detail-skeleton--timeline-date {
  width: 42px;
  height: 12px;
}
.detail-skeleton--timeline-detail {
  width: 120px;
  max-width: 72%;
  height: 12px;
}
.detail-skeleton--pill {
  width: 52px;
  height: 22px;
}
.detail-skeleton--button {
  height: 46px;
  border-radius: 999px;
}
.detail-skeleton--button-primary {
  flex: 1;
}
.detail-skeleton--button-secondary {
  width: 126px;
}
.detail-skeleton--action-note {
  width: 210px;
  max-width: 90%;
  height: 12px;
  margin-top: 14px;
}

@keyframes detail-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
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
.detail-summary__tag--green {
  background: var(--green-soft);
  .detail-summary__tag-text { color: var(--green); }
}
.detail-summary__tag--gray {
  background: var(--card-dim);
  .detail-summary__tag-text { color: var(--text-3); }
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

.linked-illness-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  &:active { opacity: 0.72; }
}

.linked-illness-card__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.linked-illness-card__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}

.linked-illness-card__sub {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.4;
}

.linked-illness-card__sub--secondary {
  color: var(--text-2);
  font-weight: 500;
}

.linked-illness-card__side {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.linked-illness-card__chevron {
  font-size: 18px;
  color: var(--text-3);
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

.medication-stop-sheet {
  padding-bottom: 12px;
}

.medication-stop-sheet__icon-wrap {
  width: 54px;
  height: 54px;
  margin: 4px auto 12px;
  border-radius: 18px;
  background: var(--plum-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.medication-stop-sheet__icon {
  font-size: 28px;
  color: var(--plum);
}

.medication-stop-sheet__title {
  display: block;
  text-align: center;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-1);
}

.medication-stop-sheet__desc {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-2);
  text-align: center;
}

.medication-stop-sheet__options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
}

.medication-stop-sheet__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(216, 203, 189, 0.3);
  background: rgba(255, 255, 255, 0.9);
  transition: border-color 0.15s ease, transform 0.12s ease;
  &:active { transform: scale(0.98); }
  &--active {
    border-color: rgba(134, 104, 176, 0.34);
    background: rgba(247, 242, 251, 0.98);
  }
}

.medication-stop-sheet__option-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.medication-stop-sheet__option-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}

.medication-stop-sheet__option-sub {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-3);
}

.medication-stop-sheet__radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(134, 104, 176, 0.22);
  flex-shrink: 0;
  position: relative;
  &--active {
    border-color: var(--plum);
    &::after {
      content: '';
      position: absolute;
      inset: 3px;
      border-radius: 50%;
      background: var(--plum);
    }
  }
}

.medication-stop-sheet__actions {
  display: flex;
  gap: 12px;
  margin-top: 18px;
}

.medication-stop-sheet__btn {
  flex: 1;
  min-height: 44px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  &:active { transform: scale(0.98); }
  &--cancel {
    background: var(--card-dim);
    color: var(--text-2);
  }
  &--danger {
    background: var(--red);
  }
}

.action-area {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  padding: 12px 16px calc(8px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(252, 248, 248, 0) 0%, rgba(252, 248, 248, 0.94) 18%, rgba(252, 248, 248, 0.98) 100%);
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
