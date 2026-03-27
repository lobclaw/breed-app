<template>
  <view class="home">
    <!-- 顶部问候 -->
    <view class="home__header">
      <view class="home__greeting">
        <text class="home__greeting-title">犬舍管理</text>
        <text class="home__greeting-sub">{{ formatDate(selectedDate) }}</text>
      </view>
    </view>

    <!-- Zone 1: 状态摘要栏 -->
    <view class="home__summary">
      <BPill :count="counts.overdue" label="需处理" color="red" @click="scrollToSection('overdue')" />
      <BPill :count="counts.today" label="今日" color="amber" @click="scrollToSection('today')" />
      <BPill :count="counts.upcoming" label="本周" color="muted" @click="scrollToSection('upcoming')" />
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
        <BSectionLabel title="需立即处理" color="red" :badge="counts.overdue" />
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
        <BSectionLabel title="今日待办" color="amber" :badge="counts.today" />
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
        <BSectionLabel title="即将到来" color="green" :badge="counts.upcoming" />
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

      <!-- 加载骨架屏 -->
      <BSkeleton v-if="loading" :rows="3" />

      <!-- 空状态 -->
      <BEmpty
        v-if="!loading && overdueCards.length === 0 && todayCards.length === 0 && upcomingCards.length === 0"
        icon="pets"
        title="犬群一切正常"
        description="暂无待办事项"
      />
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
import BPill from '@/components/base/BPill.vue'
import BSectionLabel from '@/components/base/BSectionLabel.vue'
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

function formatDate(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
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
.home {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

/* 顶部问候 */
.home__header {
  padding: var(--space-header-top) var(--space-page) 0;
}
.home__greeting-title {
  display: block;
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.3;
}
.home__greeting-sub {
  display: block;
  font-size: 13px;
  color: var(--text-2);
  margin-top: 2px;
}

/* 状态摘要栏 */
.home__summary {
  display: flex;
  gap: var(--space-pill-gap);
  padding: 16px var(--space-page) 16px;
}

/* 卡片区 */
.home__cards {
  padding: 0 var(--space-card);
}
.home__section {
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);
}

/* 推迟弹窗 */
.home__modal {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--mask);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.home__modal-content {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 24px;
  width: 85%;
  max-width: 320px;
}
.home__modal-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
  display: block;
  margin-bottom: 20px;
  text-align: center;
}
.home__modal-field { margin-bottom: 16px; }
.home__modal-label {
  font-size: 14px;
  color: var(--text-2);
  margin-bottom: 6px;
  display: block;
}
.home__modal-picker {
  font-size: 15px;
  color: var(--text-1);
  padding: 10px 14px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-row);
  display: block;
}
.home__modal-input {
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-row);
  padding: 10px 14px;
  font-size: 15px;
  color: var(--text-1);
  width: 100%;
}
.home__modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}
.home__modal-btn {
  flex: 1;
  height: 40px;
  border-radius: var(--radius-btn);
  font-size: 14px;
  font-weight: 600;
  background: var(--card-dim);
  color: var(--text-2);
  line-height: 40px;
  padding: 0;
  border: none;
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
}
.home__modal-btn--primary {
  background: var(--primary);
  color: #FFFFFF;
}

/* FAB 按钮 */
.home__fab {
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
  box-shadow: var(--shadow-fab);
  z-index: 50;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.88); }
}
.home__fab-icon {
  font-size: 28px;
  color: #FFFFFF;
  line-height: 1;
}

/* Action Sheet */
.home__action-sheet {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--mask);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}
.home__action-sheet-content {
  background: var(--card);
  border-radius: 20px 20px 0 0;
  width: 100%;
  padding-bottom: env(safe-area-inset-bottom, 20px);
}
.home__action-sheet-handle {
  display: flex;
  justify-content: center;
  padding: 12px 0 8px;
}
.home__action-sheet-bar {
  width: 36px;
  height: 4px;
  background: var(--text-4);
  border-radius: 2px;
}
.home__action-sheet-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
  padding: 8px 0 16px;
}
.home__action-grid {
  display: flex;
  flex-wrap: wrap;
  padding: 0 var(--space-page);
}
.home__action-item {
  width: 33.33%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.9); }
}
.home__action-icon { font-size: 28px; margin-bottom: 6px; }
.home__action-label { font-size: 13px; color: var(--text-1); }
.home__action-all {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  padding: 16px;
  border-top: 1px solid var(--card-dim);
  margin: 0 var(--space-page);
}
.home__action-all-text { font-size: 14px; color: var(--primary); }
.home__action-all-arrow { font-size: 16px; color: var(--primary); }
.home__action-cancel {
  text-align: center;
  padding: 16px;
  border-top: 6px solid var(--bg);
  font-size: 15px;
  color: var(--text-3);
}

/* Quick Complete Sheet */
.home__quick-sheet {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--mask);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}
.home__quick-sheet-content {
  background: var(--card);
  border-radius: 20px 20px 0 0;
  width: 100%;
  padding: 0 var(--space-page);
  padding-bottom: env(safe-area-inset-bottom, 20px);
}
.home__quick-sheet-handle {
  display: flex;
  justify-content: center;
  padding: 12px 0 8px;
}
.home__quick-sheet-bar {
  width: 36px;
  height: 4px;
  background: var(--text-4);
  border-radius: 2px;
}
.home__quick-sheet-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
  display: block;
  text-align: center;
  padding-top: 8px;
}
.home__quick-sheet-sub {
  font-size: 13px;
  color: var(--text-2);
  display: block;
  text-align: center;
  margin-bottom: 16px;
}
.home__quick-sheet-field { margin-bottom: 16px; }
.home__quick-sheet-label {
  font-size: 14px;
  color: var(--text-2);
  display: block;
  margin-bottom: 6px;
}
.home__quick-sheet-input {
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-row);
  padding: 10px 14px;
  font-size: 15px;
  color: var(--text-1);
  width: 100%;
}
.home__quick-sheet-actions {
  display: flex;
  gap: 12px;
  padding: 12px 0 16px;
}
.home__quick-sheet-btn {
  flex: 1;
  height: 42px;
  border-radius: var(--radius-btn);
  font-size: 14px;
  font-weight: 600;
  background: var(--card-dim);
  color: var(--text-2);
  line-height: 42px;
  padding: 0;
  border: none;
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
}
.home__quick-sheet-btn--primary {
  background: var(--primary);
  color: #FFFFFF;
}
</style>
