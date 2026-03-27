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

    <!-- 底部导航栏 -->
    <BNavBar current="home" @fab-click="showActionSheet = true" />

    <!-- ==================== FAB Action Sheet (R-0) ==================== -->
    <view v-if="showActionSheet" class="sheet-mask" @click.self="showActionSheet = false">
      <view class="sheet-panel">
        <view class="sheet-handle"><view class="sheet-bar" /></view>

        <!-- 智能推荐区 -->
        <text class="sheet-section-title">智能推荐</text>
        <view class="rec-list">
          <view
            v-for="rec in smartRecommendations"
            :key="rec.label"
            class="rec-card"
            @click="doAction(rec)"
          >
            <view class="rec-icon" :class="`rec-icon--${rec.iconColor}`">
              <text class="material-icons-round">{{ rec.materialIcon }}</text>
            </view>
            <view class="rec-text">
              <text class="rec-title">{{ rec.label }}</text>
              <text class="rec-sub">{{ rec.sub }}</text>
            </view>
            <view class="rec-right">
              <view v-if="rec.tag" class="rec-tag" :class="`rec-tag--${rec.tagColor}`">
                <text class="rec-tag-text">{{ rec.tag }}</text>
              </view>
              <text class="material-icons-round rec-chevron">chevron_right</text>
            </view>
          </view>
        </view>

        <view class="sheet-separator" />

        <!-- 常用录入（4 个快捷按钮） -->
        <text class="sheet-section-title">常用录入</text>
        <view class="quick-actions">
          <view
            v-for="qa in quickActionBtns"
            :key="qa.label"
            class="quick-action-btn"
            @click="doAction(qa)"
          >
            <view class="qa-icon" :class="`qa-icon--${qa.iconColor}`">
              <text class="material-icons-round">{{ qa.materialIcon }}</text>
            </view>
            <text class="qa-label">{{ qa.label }}</text>
          </view>
        </view>

        <view class="sheet-separator" />

        <!-- 全部记录类型 -->
        <view class="sheet-footer-link" @click="goToAllRecords">
          <text class="sheet-footer-link-text">全部记录类型</text>
          <text class="material-icons-round" style="font-size: 16px; color: var(--primary);">arrow_forward</text>
        </view>
      </view>
    </view>

    <!-- H-3: 快速完成任务 Sheet -->
    <BSheet v-model:visible="showQuickComplete" title="完成任务">
      <view class="task-sheet">
        <view v-if="quickCompleteTask" class="task-sheet__info">
          <BIconBox icon="check_circle" color="green" :size="36" />
          <view class="task-sheet__info-text">
            <text class="task-sheet__task-title">{{ quickCompleteTask.title || '任务' }}</text>
            <text class="task-sheet__dog-name">{{ quickCompleteTask.dog_name || '' }}</text>
          </view>
        </view>
        <view class="task-sheet__field">
          <text class="task-sheet__label">备注（选填）</text>
          <input v-model="quickCompleteNotes" class="task-sheet__input" placeholder="添加备注..." />
        </view>
        <view class="task-sheet__field">
          <text class="task-sheet__label">完成日期</text>
          <picker mode="date" :value="quickCompleteDateStr" @change="onQuickCompleteDateChange">
            <view class="task-sheet__picker">
              <text>{{ quickCompleteDateStr }}</text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
        </view>
        <view class="task-sheet__actions">
          <view class="task-sheet__btn task-sheet__btn--cancel" @click="showQuickComplete = false">
            <text style="color: var(--text-2); font-size: 14px; font-weight: 600;">取消</text>
          </view>
          <view class="task-sheet__btn task-sheet__btn--confirm" @click="confirmQuickComplete">
            <text style="color: #fff; font-size: 14px; font-weight: 600;">确认完成</text>
          </view>
        </view>
      </view>
    </BSheet>

    <!-- H-4: 推迟任务 Sheet -->
    <BSheet v-model:visible="showPostponeModal" title="推迟任务">
      <view class="task-sheet">
        <view class="task-sheet__field">
          <text class="task-sheet__label">推迟到</text>
          <picker mode="date" :value="postponeDateStr" @change="onPostponeDateChange">
            <view class="task-sheet__picker">
              <text>{{ postponeDateStr }}</text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
          <view class="task-sheet__quick-dates">
            <view class="task-sheet__quick-date" :class="{ active: postponeQuick === 'tomorrow' }" @click="setPostponeQuick('tomorrow')">
              <text>明天</text>
            </view>
            <view class="task-sheet__quick-date" :class="{ active: postponeQuick === 'dayAfter' }" @click="setPostponeQuick('dayAfter')">
              <text>后天</text>
            </view>
            <view class="task-sheet__quick-date" :class="{ active: postponeQuick === 'nextWeek' }" @click="setPostponeQuick('nextWeek')">
              <text>下周</text>
            </view>
          </view>
        </view>
        <view class="task-sheet__field">
          <text class="task-sheet__label">原因（选填）</text>
          <input v-model="postponeReason" class="task-sheet__input" placeholder="选填..." />
        </view>
        <view class="task-sheet__actions">
          <view class="task-sheet__btn task-sheet__btn--cancel" @click="showPostponeModal = false">
            <text style="color: var(--text-2); font-size: 14px; font-weight: 600;">取消</text>
          </view>
          <view class="task-sheet__btn task-sheet__btn--confirm" @click="doPostpone">
            <text style="color: #fff; font-size: 14px; font-weight: 600;">确认推迟</text>
          </view>
        </view>
      </view>
    </BSheet>

    <!-- H-5: 批量完成任务 Sheet -->
    <BSheet v-model:visible="showBatchComplete" :title="batchCompleteTitle">
      <view class="task-sheet">
        <view class="task-sheet__select-bar">
          <view class="task-sheet__select-toggle" @click="toggleSelectAll">
            <view class="task-sheet__checkbox" :class="{ checked: isAllSelected }">
              <text v-if="isAllSelected" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text>
            </view>
            <text class="task-sheet__select-label">
              {{ isAllSelected ? '取消全选' : '全选' }}（{{ batchSelectedCount }}/{{ batchDogList.length }}）
            </text>
          </view>
        </view>
        <scroll-view scroll-y class="task-sheet__dog-list">
          <view
            v-for="dog in batchDogList"
            :key="dog.id"
            class="task-sheet__dog-item"
            @click="toggleBatchDog(dog.id)"
          >
            <view class="task-sheet__checkbox" :class="{ checked: batchSelected[dog.id] }">
              <text v-if="batchSelected[dog.id]" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text>
            </view>
            <view class="task-sheet__dog-avatar">
              <text class="material-icons-round" style="color: #fff; font-size: 14px;">pets</text>
            </view>
            <text class="task-sheet__dog-name-text">{{ dog.name }}</text>
            <text v-if="dog.completed" class="task-sheet__done-badge">已完成</text>
          </view>
        </scroll-view>
        <view class="task-sheet__actions">
          <view class="task-sheet__btn task-sheet__btn--cancel" @click="showBatchComplete = false">
            <text style="color: var(--text-2); font-size: 14px; font-weight: 600;">取消</text>
          </view>
          <view
            class="task-sheet__btn task-sheet__btn--confirm"
            :class="{ disabled: batchSelectedCount === 0 }"
            @click="confirmBatchComplete"
          >
            <text style="color: #fff; font-size: 14px; font-weight: 600;">
              完成（{{ batchSelectedCount }}）
            </text>
          </view>
        </view>
      </view>
    </BSheet>
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
import BNavBar from '@/components/layout/BNavBar.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BIconBox from '@/components/base/BIconBox.vue'

const { hasFamily, loadFamily } = useAuth()

const showActionSheet = ref(false)

// 智能推荐（基于上下文的 3 条推荐）
const smartRecommendations = [
  {
    materialIcon: 'vaccines',
    iconColor: 'blue',
    label: '豆豆第3窝 · 第二针疫苗',
    sub: '今日待办 · 点击直接录入',
    tag: '待办',
    tagColor: 'amber',
    url: '/pages/record/health',
  },
  {
    materialIcon: 'payments',
    iconColor: 'green',
    label: '支出录入',
    sub: '最近常用',
    tag: '常用',
    tagColor: 'dim',
    url: '/pages/finance/expense-add',
  },
  {
    materialIcon: 'monitor_weight',
    iconColor: 'teal',
    label: '花花第3窝 · 记录体重',
    sub: '上次记录 3 天前',
    tag: '建议',
    tagColor: 'green',
    url: '/pages/record/health',
  },
]

// 常用录入快捷按钮（4 个）
const quickActionBtns = [
  { materialIcon: 'payments', iconColor: 'green', label: '支出', url: '/pages/finance/expense-add' },
  { materialIcon: 'vaccines', iconColor: 'blue', label: '疫苗', url: '/pages/record/health' },
  { materialIcon: 'shield', iconColor: 'teal', label: '驱虫', url: '/pages/record/health' },
  { materialIcon: 'monitor_weight', iconColor: 'teal', label: '体重', url: '/pages/record/health' },
]

function doAction(action: { url: string }) {
  showActionSheet.value = false
  uni.navigateTo({ url: action.url })
}

function goToAllRecords() {
  showActionSheet.value = false
  uni.navigateTo({ url: '/pages/record/index' })
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

/* ==================== ACTION SHEET (R-0) ==================== */
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
  border-radius: 24px 24px 0 0;
  width: 100%;
  padding: 12px 20px 34px;
  padding-bottom: env(safe-area-inset-bottom, 34px);
  box-shadow: 0 -6px 30px rgba(234, 62, 119, 0.1);
}
.sheet-handle {
  display: flex;
  justify-content: center;
  padding: 4px 0 12px;
}
.sheet-bar {
  width: 36px;
  height: 4px;
  background: var(--text-4);
  border-radius: 2px;
}
.sheet-section-title {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}
.sheet-separator {
  height: 0.5px;
  background: var(--card-dim);
  margin: 4px 0 16px;
}

/* ==================== RECOMMENDATION CARDS ==================== */
.rec-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 20px;
}
.rec-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 0.5px solid var(--card-dim);
  transition: background 0.12s ease;
  &:last-child { border-bottom: none; }
  &:active {
    background: var(--bg);
    border-radius: 12px;
    margin: 0 -8px;
    padding: 14px 8px;
  }
}
.rec-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  .material-icons-round { font-size: 20px; }
}
.rec-icon--blue { background: var(--icon-blue); .material-icons-round { color: var(--blue); } }
.rec-icon--green { background: var(--icon-green); .material-icons-round { color: var(--green); } }
.rec-icon--teal { background: var(--icon-teal); .material-icons-round { color: var(--teal); } }
.rec-icon--red { background: var(--icon-red); .material-icons-round { color: var(--red); } }
.rec-icon--amber { background: var(--icon-amber); .material-icons-round { color: var(--amber); } }
.rec-icon--rose { background: var(--icon-rose); .material-icons-round { color: var(--rose); } }
.rec-icon--plum { background: var(--icon-plum); .material-icons-round { color: var(--plum); } }

.rec-text {
  flex: 1;
  min-width: 0;
}
.rec-title {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.3;
}
.rec-sub {
  display: block;
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
}
.rec-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.rec-tag {
  padding: 3px 8px;
  border-radius: var(--radius-tag);
  white-space: nowrap;
}
.rec-tag-text {
  font-size: 11px;
  font-weight: 600;
}
.rec-tag--amber { background: var(--amber-soft); .rec-tag-text { color: var(--amber); } }
.rec-tag--dim { background: var(--card-dim); .rec-tag-text { color: var(--text-3); } }
.rec-tag--green { background: var(--green-soft); .rec-tag-text { color: var(--green); } }
.rec-chevron {
  color: var(--text-4);
  font-size: 20px;
  line-height: 1;
}

/* ==================== QUICK ACTION BUTTONS ==================== */
.quick-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
}
.quick-action-btn {
  flex: 1;
  height: 76px;
  background: var(--card-dim);
  border-radius: var(--radius-row);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: transform 0.12s ease, filter 0.12s ease;
  &:active { transform: scale(0.94); filter: brightness(0.95); }
}
.qa-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  .material-icons-round { font-size: 18px; }
}
.qa-icon--green { background: var(--icon-green); .material-icons-round { color: var(--green); } }
.qa-icon--blue { background: var(--icon-blue); .material-icons-round { color: var(--blue); } }
.qa-icon--teal { background: var(--icon-teal); .material-icons-round { color: var(--teal); } }
.qa-icon--amber { background: var(--icon-amber); .material-icons-round { color: var(--amber); } }
.qa-icon--rose { background: var(--icon-rose); .material-icons-round { color: var(--rose); } }
.qa-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}

/* ==================== FOOTER LINK ==================== */
.sheet-footer-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 0;
  border: 1.5px solid var(--primary);
  border-radius: var(--radius-btn);
  transition: all 0.12s ease;
  &:active { transform: scale(0.96); background: var(--primary-soft); }
}
.sheet-footer-link-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
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
