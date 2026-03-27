<template>
  <view class="home">
    <!-- Header: 问候 + 头像 -->
    <view class="header">
      <view class="header-top">
        <view class="greeting-text">
          <text class="greeting-title">{{ greetingText }}</text>
          <text class="greeting-sub">{{ formatFullDate(selectedDate) }} · 犬舍状态一览</text>
        </view>
        <view class="avatar">
          <text class="material-icons-round" style="color: #fff; font-size: 22px;">pets</text>
        </view>
      </view>
      <!-- 摘要 Pills: ● 需处理 2 -->
      <view class="summary-pills">
        <view class="pill pill-red" @click="scrollToSection('overdue')">
          <view class="pill-dot" style="background: var(--red);" />
          <text class="pill-label">需处理</text>
          <text class="pill-num">{{ counts.overdue }}</text>
        </view>
        <view class="pill pill-amber" @click="scrollToSection('today')">
          <view class="pill-dot" style="background: var(--amber);" />
          <text class="pill-label">今日</text>
          <text class="pill-num">{{ counts.today }}</text>
        </view>
        <view class="pill pill-dim" @click="scrollToSection('upcoming')">
          <view class="pill-dot" style="background: var(--text-3);" />
          <text class="pill-label">本周</text>
          <text class="pill-num">{{ counts.upcoming }}</text>
        </view>
      </view>
    </view>

    <!-- 7天预览条 -->
    <WeekStrip
      :selected-date="selectedDate"
      :day-counts="dayCounts"
      @select="onDateSelect"
      @toggle-calendar="toggleCalendar"
    />

    <!-- 智能卡片区 -->
    <scroll-view scroll-y class="card-area" :scroll-into-view="scrollTarget">
      <!-- 逾期 -->
      <view v-if="overdueCards.length > 0" id="section-overdue">
        <view class="section-label">
          <view class="section-dot" style="background: var(--red);" />
          <text class="section-text">需立即处理</text>
          <view class="section-badge"><text class="section-badge-text">{{ counts.overdue }}</text></view>
        </view>
        <view class="card-feed">
          <SmartCard
            v-for="card in overdueCards" :key="card.id" :card="card"
            @complete="onComplete" @postpone="onPostpone"
            @batch-complete="onBatchComplete" @action="onAction"
          />
        </view>
      </view>

      <!-- 今日 -->
      <view v-if="todayCards.length > 0" id="section-today">
        <view class="section-label">
          <view class="section-dot" style="background: var(--amber);" />
          <text class="section-text">今日任务</text>
          <view class="section-badge"><text class="section-badge-text">{{ counts.today }}</text></view>
        </view>
        <view class="card-feed">
          <SmartCard
            v-for="card in todayCards" :key="card.id" :card="card"
            @complete="onComplete" @postpone="onPostpone"
            @batch-complete="onBatchComplete" @action="onAction"
          />
        </view>
      </view>

      <!-- 即将到来 -->
      <view v-if="upcomingCards.length > 0" id="section-upcoming">
        <view class="section-label">
          <view class="section-dot" style="background: var(--green);" />
          <text class="section-text">即将到来</text>
          <view class="section-badge"><text class="section-badge-text">{{ counts.upcoming }}</text></view>
        </view>
        <view class="card-feed">
          <SmartCard
            v-for="card in upcomingCards" :key="card.id" :card="card"
            @complete="onComplete" @postpone="onPostpone"
            @batch-complete="onBatchComplete" @action="onAction"
          />
        </view>
      </view>

      <!-- 加载骨架屏 -->
      <view v-if="loading" class="card-feed">
        <BSkeleton :rows="3" />
      </view>

      <!-- 空状态 -->
      <BEmpty
        v-if="!loading && overdueCards.length === 0 && todayCards.length === 0 && upcomingCards.length === 0"
        icon="pets"
        title="犬群一切正常"
        description="暂无待办事项"
      />
    </scroll-view>

    <!-- FAB 快速记录按钮 -->
    <view class="fab" @click="showActionSheet = true">
      <text class="material-icons-round" style="font-size: 28px; color: #fff;">add</text>
    </view>

    <!-- Action Sheet -->
    <view class="sheet-mask" v-if="showActionSheet" @click.self="showActionSheet = false">
      <view class="sheet-panel">
        <view class="sheet-handle"><view class="sheet-bar" /></view>
        <text class="sheet-title">快速记录</text>
        <view class="action-grid">
          <view class="action-item" v-for="action in quickActions" :key="action.label" @click="doAction(action)">
            <text class="action-icon">{{ action.icon }}</text>
            <text class="action-label">{{ action.label }}</text>
          </view>
        </view>
        <view class="action-all" @click="goToAllRecords">
          <text class="action-all-text">全部记录类型</text>
          <text class="material-icons-round" style="font-size: 16px; color: var(--primary);">chevron_right</text>
        </view>
        <view class="action-cancel" @click="showActionSheet = false">
          <text style="color: var(--text-3);">取消</text>
        </view>
      </view>
    </view>

    <!-- 推迟弹窗 -->
    <view class="modal-mask" v-if="showPostponeModal" @click.self="showPostponeModal = false">
      <view class="modal-panel">
        <text class="modal-title">推迟任务</text>
        <view class="modal-field">
          <text class="modal-label">推迟到</text>
          <picker mode="date" :value="postponeDateStr" @change="onPostponeDateChange">
            <text class="modal-picker">{{ postponeDateStr }}</text>
          </picker>
        </view>
        <view class="modal-field">
          <text class="modal-label">原因（选填）</text>
          <input v-model="postponeReason" class="modal-input" placeholder="选填..." />
        </view>
        <view class="modal-actions">
          <view class="modal-btn modal-btn--cancel" @click="showPostponeModal = false"><text class="modal-btn-text" style="color: var(--text-2);">取消</text></view>
          <view class="modal-btn modal-btn--confirm" @click="doPostpone"><text class="modal-btn-text" style="color: #fff;">确认推迟</text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { useAuth } from '@/composables/useAuth'
import WeekStrip from '@/components/week-strip/WeekStrip.vue'
import SmartCard from '@/components/smart-card/SmartCard.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'

const { hasFamily, loadFamily } = useAuth()

const showActionSheet = ref(false)

const quickActions = [
  { icon: '🐾', label: '繁育记录', url: '/pages/record/breeding' },
  { icon: '💉', label: '健康记录', url: '/pages/record/health' },
  { icon: '💰', label: '录入支出', url: '/pages/finance/expense-add' },
  { icon: '💵', label: '录入收入', url: '/pages/finance/income-add' },
  { icon: '🐶', label: '添加犬只', url: '/pages/dog/add' },
  { icon: '🏷️', label: '创建销售', url: '/pages/sale/create' },
]

function doAction(action: { url: string }) {
  showActionSheet.value = false
  uni.navigateTo({ url: action.url })
}

function goToAllRecords() {
  showActionSheet.value = false
  // V1 暂时跳转到繁育记录页
  uni.navigateTo({ url: '/pages/record/breeding' })
}

const overdueCards = ref<any[]>([])
const todayCards = ref<any[]>([])
const upcomingCards = ref<any[]>([])
const counts = reactive({ overdue: 0, today: 0, upcoming: 0 })
const loading = ref(true)
const scrollTarget = ref('')
const dayCounts = ref<Record<number, number>>({})

// 选中日期（0点 timestamp）
const selectedDate = ref(startOfDay(Date.now()))

// 快速完成
const showQuickComplete = ref(false)
const quickCompleteTask = ref<any>(null)
const quickCompleteNotes = ref('')

// 推迟弹窗
const showPostponeModal = ref(false)
const postponeTaskId = ref('')
const postponeDate = ref(Date.now() + 86400000) // 默认明天
const postponeReason = ref('')

const postponeDateStr = computed(() => {
  const d = new Date(postponeDate.value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

function startOfDay(ts: number) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 问候语（按时段） */
const greetingText = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
})

/** 完整日期：3月22日 周六 */
const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
function formatFullDate(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekDays[d.getDay()]}`
}

const { run: fetchCards } = useCloudCall<{ data: any }>('task-service', 'getHomeCards')
const { run: fetchDateCounts } = useCloudCall<{ data: any }>('task-service', 'getDateCounts')
const { run: doCompleteTask } = useCloudCall('task-service', 'completeTask', { successMessage: '已完成' })
const { run: doPostponeTask } = useCloudCall('task-service', 'postponeTask')
const { run: doBatchComplete } = useCloudCall('task-service', 'batchCompleteTask', { successMessage: '已完成' })

function scrollToSection(section: string) {
  scrollTarget.value = `section-${section}`
}

async function loadCards() {
  loading.value = true
  const result = await fetchCards(selectedDate.value)
  if (result?.data) {
    overdueCards.value = result.data.overdue || []
    todayCards.value = result.data.today || []
    upcomingCards.value = result.data.upcoming || []
    counts.overdue = result.data.counts?.overdue || 0
    counts.today = result.data.counts?.today || 0
    counts.upcoming = result.data.counts?.upcoming || 0
  }
  loading.value = false
}

async function loadDateCounts() {
  const DAY_MS = 86400000
  const start = startOfDay(Date.now()) - 2 * DAY_MS
  const end = start + 14 * DAY_MS
  const result = await fetchDateCounts(start, end)
  if (result?.data) {
    dayCounts.value = result.data
  }
}

async function onDateSelect(ts: number) {
  selectedDate.value = ts
  await loadCards()
}

function toggleCalendar() {
  // 月历展开功能后续迭代
}

async function onComplete(taskId: string) {
  await doCompleteTask(taskId)
  await loadCards()
  await loadDateCounts()
}

function onPostpone(taskId: string) {
  postponeTaskId.value = taskId
  postponeDate.value = Date.now() + 86400000
  postponeReason.value = ''
  showPostponeModal.value = true
}

function onPostponeDateChange(e: any) {
  postponeDate.value = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
}

async function doPostpone() {
  await doPostponeTask(postponeTaskId.value, postponeDate.value, postponeReason.value || null)
  showPostponeModal.value = false
  await loadCards()
  await loadDateCounts()
}

async function onBatchComplete(taskIds: string[]) {
  await doBatchComplete(taskIds)
  await loadCards()
  await loadDateCounts()
}

function onAction(payload: { type: string; data: any }) {
  if (payload.type === 'viewDog' && payload.data?.dogId) {
    uni.navigateTo({ url: `/pages/dog/detail?id=${payload.data.dogId}` })
  }
}

async function confirmQuickComplete() {
  if (!quickCompleteTask.value) return
  await doCompleteTask(quickCompleteTask.value._id)
  showQuickComplete.value = false
  quickCompleteNotes.value = ''
  await loadCards()
  await loadDateCounts()
}

onShow(async () => {
  // 确保家庭信息已加载
  if (!hasFamily.value) {
    await loadFamily()
  }
  // 没有家庭则跳转创建页
  if (!hasFamily.value) {
    uni.navigateTo({ url: '/pages/family/setup' })
    return
  }
  selectedDate.value = startOfDay(Date.now())
  await loadCards()
  await loadDateCounts()
})
</script>

<style lang="scss" scoped>
/* 首页 — 一比一还原 home-v1-final.html */
.home {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

/* ==================== HEADER ==================== */
.header {
  padding: 12px 20px 0;
}
.header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.greeting-title {
  display: block;
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.3;
}
.greeting-sub {
  display: block;
  font-size: 13px;
  color: var(--text-2);
  margin-top: 2px;
}
.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ==================== SUMMARY PILLS ==================== */
.summary-pills {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-bottom: 16px;
}
.pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 16px;
  transition: transform 0.12s ease, filter 0.12s ease;
  &:active { transform: scale(0.95); filter: brightness(0.95); }
}
.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pill-label {
  font-size: 13px;
  font-weight: 600;
}
.pill-num {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
}
.pill-red {
  background: var(--red-soft);
  .pill-label, .pill-num { color: var(--red); }
}
.pill-amber {
  background: var(--amber-soft);
  .pill-label, .pill-num { color: var(--amber); }
}
.pill-dim {
  background: var(--card-dim);
  .pill-label, .pill-num { color: var(--text-3); }
}

/* ==================== SECTION LABELS ==================== */
.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px 10px;
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
.section-badge {
  background: var(--card-dim);
  border-radius: 999px;
  padding: 2px 8px;
}
.section-badge-text {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 800;
  color: var(--text-2);
}

/* ==================== CARD FEED ==================== */
.card-area {
  flex: 1;
}
.card-feed {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 8px;
}

/* ==================== FAB ==================== */
.fab {
  position: fixed;
  right: 20px;
  bottom: 100px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(234, 62, 119, 0.3);
  z-index: 50;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:active {
    transform: scale(0.88);
    box-shadow: 0 2px 8px rgba(234, 62, 119, 0.2);
  }
}

/* ==================== ACTION SHEET ==================== */
.sheet-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--mask);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}
.sheet-panel {
  background: var(--card);
  border-radius: 20px 20px 0 0;
  width: 100%;
  padding-bottom: env(safe-area-inset-bottom, 20px);
}
.sheet-handle {
  display: flex;
  justify-content: center;
  padding: 12px 0 8px;
}
.sheet-bar {
  width: 36px;
  height: 4px;
  background: var(--text-4);
  border-radius: 2px;
}
.sheet-title {
  display: block;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
  padding: 8px 0 16px;
}
.action-grid {
  display: flex;
  flex-wrap: wrap;
  padding: 0 20px;
}
.action-item {
  width: 33.33%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.9); }
}
.action-icon { font-size: 28px; margin-bottom: 6px; }
.action-label { font-size: 13px; color: var(--text-1); }
.action-all {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  padding: 16px;
  border-top: 1px solid var(--card-dim);
  margin: 0 20px;
}
.action-all-text { font-size: 14px; color: var(--primary); font-weight: 600; }
.action-cancel {
  text-align: center;
  padding: 16px;
  border-top: 6px solid var(--bg);
  font-size: 15px;
}

/* ==================== MODAL ==================== */
.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--mask);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}
.modal-panel {
  background: var(--card);
  border-radius: 16px;
  padding: 24px;
  width: 85%;
  max-width: 320px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}
.modal-title {
  display: block;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
  margin-bottom: 20px;
}
.modal-field { margin-bottom: 16px; }
.modal-label {
  display: block;
  font-size: 14px;
  color: var(--text-2);
  margin-bottom: 6px;
}
.modal-picker {
  display: block;
  font-size: 15px;
  color: var(--text-1);
  padding: 10px 14px;
  border: 1.5px solid var(--text-4);
  border-radius: 14px;
}
.modal-input {
  width: 100%;
  font-size: 15px;
  color: var(--text-1);
  padding: 10px 14px;
  border: 1.5px solid var(--text-4);
  border-radius: 14px;
}
.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}
.modal-btn {
  flex: 1;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
}
.modal-btn--cancel { background: var(--card-dim); }
.modal-btn--confirm { background: var(--primary); }
.modal-btn-text {
  font-size: 14px;
  font-weight: 600;
}
</style>
