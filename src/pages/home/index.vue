<template>
  <view class="home">
    <!-- Zone 1: 状态摘要栏 -->
    <view class="home__summary">
      <view class="home__summary-item home__summary-item--overdue" @click="scrollToSection('overdue')">
        <text class="home__summary-count">{{ counts.overdue }}</text>
        <text class="home__summary-label">需处理</text>
      </view>
      <view class="home__summary-item home__summary-item--today" @click="scrollToSection('today')">
        <text class="home__summary-count">{{ counts.today }}</text>
        <text class="home__summary-label">今日</text>
      </view>
      <view class="home__summary-item" @click="scrollToSection('upcoming')">
        <text class="home__summary-count">{{ counts.upcoming }}</text>
        <text class="home__summary-label">本周</text>
      </view>
    </view>

    <!-- 7天预览条 -->
    <WeekStrip
      :selected-date="selectedDate"
      :day-counts="dayCounts"
      @select="onDateSelect"
      @toggle-calendar="toggleCalendar"
    />

    <!-- Zone 2: 智能卡片区 -->
    <scroll-view scroll-y class="home__cards" :scroll-into-view="scrollTarget">
      <!-- 逾期 -->
      <view v-if="overdueCards.length > 0" id="section-overdue" class="home__section">
        <text class="home__section-title home__section-title--overdue">需立即处理</text>
        <SmartCard
          v-for="card in overdueCards"
          :key="card.id"
          :card="card"
          @complete="onComplete"
          @postpone="onPostpone"
          @batch-complete="onBatchComplete"
          @action="onAction"
        />
      </view>

      <!-- 今日 -->
      <view v-if="todayCards.length > 0" id="section-today" class="home__section">
        <text class="home__section-title home__section-title--today">今日待办</text>
        <SmartCard
          v-for="card in todayCards"
          :key="card.id"
          :card="card"
          @complete="onComplete"
          @postpone="onPostpone"
          @batch-complete="onBatchComplete"
          @action="onAction"
        />
      </view>

      <!-- 即将到来 -->
      <view v-if="upcomingCards.length > 0" id="section-upcoming" class="home__section">
        <text class="home__section-title">即将到来</text>
        <SmartCard
          v-for="card in upcomingCards"
          :key="card.id"
          :card="card"
          @complete="onComplete"
          @postpone="onPostpone"
          @batch-complete="onBatchComplete"
          @action="onAction"
        />
      </view>

      <!-- 空状态 -->
      <view v-if="overdueCards.length === 0 && todayCards.length === 0 && upcomingCards.length === 0 && !loading" class="home__empty">
        <text class="home__empty-text">犬群一切正常</text>
        <text class="home__empty-sub">暂无待办事项</text>
      </view>
    </scroll-view>

    <!-- FAB 快速记录按钮 -->
    <view class="home__fab" @click="showActionSheet = true">
      <text class="home__fab-icon">+</text>
    </view>

    <!-- Action Sheet -->
    <view class="home__action-sheet" v-if="showActionSheet" @click.self="showActionSheet = false">
      <view class="home__action-sheet-content">
        <view class="home__action-sheet-handle"><view class="home__action-sheet-bar" /></view>
        <text class="home__action-sheet-title">快速记录</text>

        <!-- 常用操作 -->
        <view class="home__action-grid">
          <view class="home__action-item" v-for="action in quickActions" :key="action.label" @click="doAction(action)">
            <text class="home__action-icon">{{ action.icon }}</text>
            <text class="home__action-label">{{ action.label }}</text>
          </view>
        </view>

        <!-- 全部记录类型 -->
        <view class="home__action-all" @click="goToAllRecords">
          <text class="home__action-all-text">全部记录类型</text>
          <text class="home__action-all-arrow">›</text>
        </view>

        <view class="home__action-cancel" @click="showActionSheet = false">
          <text>取消</text>
        </view>
      </view>
    </view>

    <!-- 快速完成 BottomSheet -->
    <view class="home__quick-sheet" v-if="showQuickComplete" @click.self="showQuickComplete = false">
      <view class="home__quick-sheet-content">
        <view class="home__quick-sheet-handle"><view class="home__quick-sheet-bar" /></view>
        <text class="home__quick-sheet-title">{{ quickCompleteTask?.title }}</text>
        <text class="home__quick-sheet-sub">{{ quickCompleteTask?.dog_name }}</text>
        <view class="home__quick-sheet-field">
          <text class="home__quick-sheet-label">备注（选填）</text>
          <input v-model="quickCompleteNotes" class="home__quick-sheet-input" placeholder="记录详情..." />
        </view>
        <view class="home__quick-sheet-actions">
          <button class="home__quick-sheet-btn" @click="showQuickComplete = false">取消</button>
          <button class="home__quick-sheet-btn home__quick-sheet-btn--primary" @click="confirmQuickComplete">确认完成</button>
        </view>
      </view>
    </view>

    <!-- 推迟弹窗 -->
    <view class="home__modal" v-if="showPostponeModal" @click.self="showPostponeModal = false">
      <view class="home__modal-content">
        <text class="home__modal-title">推迟任务</text>
        <view class="home__modal-field">
          <text class="home__modal-label">推迟到</text>
          <picker mode="date" :value="postponeDateStr" @change="onPostponeDateChange">
            <text class="home__modal-picker">{{ postponeDateStr }}</text>
          </picker>
        </view>
        <view class="home__modal-field">
          <text class="home__modal-label">原因</text>
          <input v-model="postponeReason" class="home__modal-input" placeholder="选填" />
        </view>
        <view class="home__modal-actions">
          <button class="home__modal-btn" @click="showPostponeModal = false">取消</button>
          <button class="home__modal-btn home__modal-btn--primary" @click="doPostpone">确认推迟</button>
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

function onDateSelect(ts: number) {
  selectedDate.value = ts
  loadCards()
}

function toggleCalendar() {
  // 月历展开功能后续迭代
}

async function onComplete(taskId: string) {
  await doCompleteTask(taskId)
  loadCards()
  loadDateCounts()
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
  loadCards()
  loadDateCounts()
}

async function onBatchComplete(taskIds: string[]) {
  await doBatchComplete(taskIds)
  loadCards()
  loadDateCounts()
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
  loadCards()
  loadDateCounts()
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
  loadCards()
  loadDateCounts()
})
</script>

<style scoped>
.home { min-height: 100vh; background: #f5f5f5; }

.home__summary { display: flex; justify-content: space-around; padding: 40rpx 32rpx 24rpx; background: #fff; }
.home__summary-item { text-align: center; padding: 16rpx 32rpx; border-radius: 16rpx; }
.home__summary-count { display: block; font-size: 48rpx; font-weight: 700; }
.home__summary-item--overdue .home__summary-count { color: #FF3B30; }
.home__summary-item--today .home__summary-count { color: #FF9500; }
.home__summary-label { font-size: 24rpx; color: #999; margin-top: 4rpx; }

.home__cards { padding: 24rpx 32rpx; height: calc(100vh - 320rpx); }
.home__section { margin-bottom: 32rpx; }
.home__section-title { font-size: 28rpx; font-weight: 600; color: #666; margin-bottom: 16rpx; display: block; }
.home__section-title--overdue { color: #FF3B30; }
.home__section-title--today { color: #FF9500; }

.home__empty { text-align: center; padding: 120rpx 0; }
.home__empty-text { display: block; font-size: 34rpx; color: #333; margin-bottom: 12rpx; }
.home__empty-sub { font-size: 28rpx; color: #999; }

/* 推迟弹窗 */
.home__modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.home__modal-content { background: #fff; border-radius: 24rpx; padding: 40rpx; width: 85%; max-width: 600rpx; }
.home__modal-title { font-size: 34rpx; font-weight: 700; color: #333; display: block; margin-bottom: 32rpx; text-align: center; }
.home__modal-field { margin-bottom: 24rpx; }
.home__modal-label { font-size: 26rpx; color: #666; margin-bottom: 8rpx; display: block; }
.home__modal-picker { font-size: 28rpx; color: #333; padding: 16rpx; border: 1rpx solid #e0e0e0; border-radius: 12rpx; display: block; }
.home__modal-input { border: 1rpx solid #e0e0e0; border-radius: 12rpx; padding: 16rpx; font-size: 28rpx; }
.home__modal-actions { display: flex; gap: 16rpx; margin-top: 32rpx; }
.home__modal-btn { flex: 1; height: 72rpx; border-radius: 36rpx; font-size: 28rpx; background: #f5f5f5; color: #666; line-height: 72rpx; padding: 0; }
.home__modal-btn--primary { background: #007AFF; color: #fff; }

/* FAB */
.home__fab { position: fixed; right: 32rpx; bottom: 180rpx; width: 100rpx; height: 100rpx; border-radius: 50%; background: #007AFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 6rpx 20rpx rgba(0,122,255,0.35); z-index: 50; }
.home__fab-icon { font-size: 52rpx; color: #fff; line-height: 1; }

/* Action Sheet */
.home__action-sheet { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 200; display: flex; align-items: flex-end; }
.home__action-sheet-content { background: #fff; border-radius: 24rpx 24rpx 0 0; width: 100%; padding-bottom: env(safe-area-inset-bottom); }
.home__action-sheet-handle { display: flex; justify-content: center; padding: 16rpx 0 8rpx; }
.home__action-sheet-bar { width: 64rpx; height: 8rpx; background: #e0e0e0; border-radius: 4rpx; }
.home__action-sheet-title { font-size: 32rpx; font-weight: 700; color: #333; text-align: center; padding: 16rpx 0 24rpx; }
.home__action-grid { display: flex; flex-wrap: wrap; padding: 0 32rpx; gap: 0; }
.home__action-item { width: 33.33%; display: flex; flex-direction: column; align-items: center; padding: 24rpx 0; }
.home__action-icon { font-size: 48rpx; margin-bottom: 8rpx; }
.home__action-label { font-size: 26rpx; color: #333; }
.home__action-all { display: flex; justify-content: center; align-items: center; gap: 8rpx; padding: 24rpx; border-top: 1rpx solid #f0f0f0; margin: 0 32rpx; }
.home__action-all-text { font-size: 28rpx; color: #007AFF; }
.home__action-all-arrow { font-size: 32rpx; color: #007AFF; }
.home__action-cancel { text-align: center; padding: 24rpx; border-top: 8rpx solid #f5f5f5; font-size: 30rpx; color: #999; }

/* Quick Complete Sheet */
.home__quick-sheet { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 200; display: flex; align-items: flex-end; }
.home__quick-sheet-content { background: #fff; border-radius: 24rpx 24rpx 0 0; width: 100%; padding: 0 32rpx; padding-bottom: env(safe-area-inset-bottom); }
.home__quick-sheet-handle { display: flex; justify-content: center; padding: 16rpx 0 8rpx; }
.home__quick-sheet-bar { width: 64rpx; height: 8rpx; background: #e0e0e0; border-radius: 4rpx; }
.home__quick-sheet-title { font-size: 32rpx; font-weight: 700; color: #333; display: block; text-align: center; padding-top: 16rpx; }
.home__quick-sheet-sub { font-size: 26rpx; color: #999; display: block; text-align: center; margin-bottom: 24rpx; }
.home__quick-sheet-field { margin-bottom: 24rpx; }
.home__quick-sheet-label { font-size: 26rpx; color: #666; display: block; margin-bottom: 8rpx; }
.home__quick-sheet-input { border: 1rpx solid #e0e0e0; border-radius: 12rpx; padding: 16rpx; font-size: 28rpx; }
.home__quick-sheet-actions { display: flex; gap: 16rpx; padding: 16rpx 0 24rpx; }
.home__quick-sheet-btn { flex: 1; height: 80rpx; border-radius: 40rpx; font-size: 28rpx; background: #f5f5f5; color: #666; line-height: 80rpx; padding: 0; }
.home__quick-sheet-btn--primary { background: #007AFF; color: #fff; }
</style>
