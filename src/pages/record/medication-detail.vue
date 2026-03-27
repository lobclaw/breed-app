<template>
  <view class="page">
    <BPageHeader title="用药任务详情" />

    <!-- 加载中 -->
    <view v-if="loading" class="card-feed">
      <BSkeleton :rows="8" />
    </view>

    <!-- 详情内容 -->
    <template v-if="!loading && task">
      <!-- 状态横幅 -->
      <view class="status-banner" :style="{ background: statusBannerBg }">
        <text class="status-banner-left" :style="{ color: statusBannerColor }">
          {{ statusText }} · 第{{ currentDay }}天/共{{ task.duration_days }}天
        </text>
        <text class="status-banner-right" :style="{ color: statusBannerColor }">
          {{ progressPercent }}%
        </text>
      </view>

      <!-- 进度条 -->
      <view class="progress-wrapper">
        <BProgress :value="currentDay" :max="task.duration_days" color="plum" :show-label="false" />
      </view>

      <!-- 任务信息卡片 -->
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
            <view class="info-row" v-if="task.dosage">
              <text class="info-row-label">剂量</text>
              <text class="info-row-value">{{ task.dosage }}</text>
            </view>
            <view class="info-row" v-if="task.method">
              <text class="info-row-label">方式</text>
              <text class="info-row-value">{{ task.method }}</text>
            </view>
            <view class="info-row" v-if="task.frequency">
              <text class="info-row-label">频率</text>
              <text class="info-row-value">{{ task.frequency }}</text>
            </view>
            <view class="info-row">
              <text class="info-row-label">开始日期</text>
              <text class="info-row-value">{{ formatDate(task.start_date) }}</text>
            </view>
            <view class="info-row">
              <text class="info-row-label">预计结束</text>
              <text class="info-row-value">{{ formatDate(task.end_date) }}</text>
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

      <!-- 执行记录 -->
      <view class="section-label" style="margin-top: 8px;">
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
              <text class="exec-day" :style="{ color: day.isToday ? 'var(--plum)' : 'var(--text-2)' }">
                第{{ day.dayNum }}天
              </text>
              <text class="exec-date" :style="{ color: day.isToday ? 'var(--plum)' : 'var(--text-3)' }">
                {{ day.dateStr }}
              </text>
              <text v-if="day.status === 'done'" class="exec-status done">&#x2705;</text>
              <text v-else-if="day.status === 'pending'" class="exec-status pending" style="font-size: 14px;">&#x2B1C;</text>
              <text v-else class="exec-status future">&#x25CB;</text>
              <text
                class="exec-detail"
                :class="{ highlight: day.isToday && day.status === 'pending' }"
                :style="day.status === 'future' ? { color: 'var(--text-4)' } : {}"
              >
                {{ day.detail }}
              </text>
            </view>
          </view>
        </BCard>
      </view>

      <!-- 操作按钮 -->
      <view class="action-area">
        <BButton
          v-if="canMarkToday"
          variant="filled"
          color="plum"
          size="large"
          @click="markTodayComplete"
          style="width: 100%;"
        >
          标记今日完成
        </BButton>
        <view class="btn-row">
          <BButton variant="ghost" @click="goEdit">编辑</BButton>
          <BButton variant="ghost" color="red" @click="confirmEndEarly">取消用药</BButton>
        </view>
      </view>
    </template>

    <!-- 空状态 -->
    <BEmpty
      v-if="!loading && !task"
      icon="search_off"
      title="任务不存在"
      description="可能已被删除"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BCard from '@/components/base/BCard.vue'
import BButton from '@/components/base/BButton.vue'
import BProgress from '@/components/base/BProgress.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'

const task = ref<any>(null)
const loading = ref(true)

let taskId = ''

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

interface ExecutionDay {
  dayNum: number
  dateStr: string
  status: 'done' | 'pending' | 'future'
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
    const isFuture = dayTs > todayTs.value

    let status: 'done' | 'pending' | 'future' = 'future'
    if (isDone) status = 'done'
    else if (!isFuture) status = 'pending'

    let detail = '—'
    if (isDone && completedMap[dayTs]) {
      const info = completedMap[dayTs]
      detail = `${info.name || ''} ${info.time || ''}`.trim()
    } else if (isToday && status === 'pending') {
      detail = '待完成'
    }

    days.push({ dayNum: i + 1, dateStr, status, detail, isToday })
  }

  return days
})

function formatDate(ts: number | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const { run: fetchTask } = useCloudCall('medication-service', 'getMedicationTask')
const { run: completeDay } = useCloudCall('medication-service', 'completeMedicationDay', {
  successMessage: '已完成',
  showLoading: true,
})
const { run: cancelTask } = useCloudCall('medication-service', 'cancelMedicationTask', {
  successMessage: '已取消',
  showLoading: true,
  loadingText: '取消中...',
})

async function loadTask() {
  loading.value = true
  const result = await fetchTask(taskId)
  if (result?.data) {
    task.value = result.data
  }
  loading.value = false
}

async function markTodayComplete() {
  const result = await completeDay(taskId, todayTs.value)
  if (result) {
    await loadTask()
  }
}

function goEdit() {
  uni.navigateTo({ url: `/pages/health/medication-protocols?taskId=${taskId}` })
}

function goToProtocol() {
  if (task.value?.protocol_id) {
    uni.navigateTo({ url: `/pages/health/medication-protocols?id=${task.value.protocol_id}` })
  }
}

function confirmEndEarly() {
  uni.showModal({
    title: '确认取消',
    content: '取消后将不再提醒每日用药，确定要取消这个用药任务吗？',
    confirmColor: '#e05252',
    async success(res) {
      if (res.confirm) {
        const result = await cancelTask(taskId)
        if (result) {
          await loadTask()
        }
      }
    },
  })
}

onLoad((query) => {
  taskId = query?.id || ''
  if (taskId) {
    loadTask()
  } else {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

/* ==================== STATUS BANNER ==================== */
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

/* ==================== PROGRESS ==================== */
.progress-wrapper {
  margin: 0 16px 16px;
}

/* ==================== CARD FEED ==================== */
.card-feed {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);
  margin-bottom: 8px;
}

/* ==================== INFO ROWS ==================== */
.info-rows {
  display: flex;
  flex-direction: column;
}
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(216, 203, 189, 0.3);
  &:last-child { border-bottom: none; }
}
.info-row-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-3);
  flex-shrink: 0;
}
.info-row-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
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

/* ==================== MINI AVATAR ==================== */
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

/* ==================== LINK ==================== */
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

/* ==================== SECTION LABEL ==================== */
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

/* ==================== EXECUTION LOG ==================== */
.exec-log {
  display: flex;
  flex-direction: column;
}
.exec-log-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(216, 203, 189, 0.2);
  &:last-child { border-bottom: none; }

  &.today {
    background: var(--plum-soft);
    margin: 0 -16px 0 -18px;
    padding: 10px 16px 10px 18px;
    border-radius: 10px;
    border-bottom: none;
  }
}
.exec-day {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
  min-width: 28px;
}
.exec-date {
  font-size: 11px;
  color: var(--text-3);
  min-width: 40px;
}
.exec-status {
  font-size: 16px;
  flex-shrink: 0;
  width: 22px;
  text-align: center;
  &.done { color: var(--green); }
  &.pending { color: var(--plum); }
  &.future { color: var(--text-4); }
}
.exec-detail {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  flex: 1;
  &.highlight {
    color: var(--plum);
    font-weight: 700;
  }
}

/* ==================== ACTION AREA ==================== */
.action-area {
  padding: 16px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.btn-row {
  display: flex;
  gap: 10px;
  :deep(.b-btn) { flex: 1; }
}
</style>
