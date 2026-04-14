<template>
  <view class="home">
    <!-- Header: 问候 + 头像 -->
    <view class="header">
        <view class="header-top">
        <view class="greeting-text">
          <text class="greeting-title">{{ greetingText }}</text>
          <text class="greeting-sub">{{ formatFullDate(selectedDate) }} · 今日概览</text>
        </view>
        <view class="avatar">
          <text class="material-icons-round" style="color: #fff; font-size: 22px;">pets</text>
        </view>
      </view>
      <!-- 摘要 Pills: 逾期 / 流程 / 提醒 / 疗程 -->
      <view class="summary-pills">
        <view
          v-for="pill in summaryPills"
          :key="pill.key"
          class="pill"
          :class="pill.pillClass"
          @click="scrollToSection(pill.key)"
        >
          <view class="pill-dot" :style="{ background: pill.dotColor }" />
          <text class="pill-label">{{ pill.label }}</text>
          <text class="pill-num">{{ pill.count }}</text>
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

    <BSubmitBanner :message="submitBannerMessage" />

    <!-- 智能卡片区 -->
    <scroll-view scroll-y class="card-area" :scroll-into-view="scrollTarget">
      <!-- ===== 今日模式：单列表（逾期在最上面，今日紧随其后） ===== -->
      <template v-if="viewMode === 'today'">
        <view v-if="cards.length > 0" id="section-today">
          <view v-for="section in todaySections" :key="section.key">
            <view v-if="section.cards.length > 0" class="home-section" :id="`section-${section.key}`">
              <view class="section-label">
                <view class="section-dot" :style="{ background: section.dotColor }" />
                <text class="section-text">{{ section.title }}</text>
                <view class="section-badge"><text class="section-badge-text">{{ section.cards.length }}</text></view>
              </view>
              <view class="card-feed">
                <SmartCard
                  v-for="card in section.cards" :key="card.id" :card="card"
                  :completing="completingCards.has(card.id)"
                  :completed="completedCards.has(card.id)"
                  @complete="onComplete" @postpone="onPostpone"
                  @batch-complete="onBatchComplete" @batch-skip="onBatchSkip" @batch-complete-med="onBatchCompleteMed"
                  @action="onAction" @record-dose="onRecordDose"
                />
              </view>
            </view>
          </view>
        </view>

        <!-- 空状态 -->
        <BEmpty
          v-if="!loading && cards.length === 0"
          icon="pets"
          title="犬群一切正常"
          description="暂无待办事项"
        />
      </template>

      <!-- ===== 指定日期模式：单列 ===== -->
      <template v-else>
        <view v-if="dayCards.length > 0">
          <view class="section-label">
            <view class="section-dot" style="background: var(--blue);" />
            <text class="section-text">{{ formatFullDate(selectedDate) }}</text>
            <view class="section-badge"><text class="section-badge-text">{{ dayCards.length }}</text></view>
          </view>
          <view class="card-feed">
            <SmartCard
              v-for="card in dayCards" :key="card.id" :card="card"
              :completing="completingCards.has(card.id)"
              :completed="completedCards.has(card.id)"
              @complete="onComplete" @postpone="onPostpone"
              @batch-complete="onBatchComplete" @batch-skip="onBatchSkip" @batch-complete-med="onBatchCompleteMed"
              @action="onAction" @record-dose="onRecordDose"
            />
          </view>
        </view>

        <!-- 空状态（指定日期） -->
        <BEmpty
          v-if="!loading && dayCards.length === 0"
          icon="event_available"
          :title="formatFullDate(selectedDate)"
          description="当天没有待办事项"
        />
      </template>

      <!-- 加载骨架屏 -->
      <view v-if="loading" class="card-feed">
        <BSkeleton :rows="3" />
      </view>
    </scroll-view>

    <!-- 底部导航栏 -->
    <BNavBar current="home" />

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
        <!-- 犬只信息 -->
        <view v-if="postponeTaskInfo" class="postpone-info">
          <text class="postpone-info__text">{{ postponeTaskInfo.title ? postponeTaskInfo.dogName + ' · ' + postponeTaskInfo.title : postponeTaskInfo.dogName }}</text>
          <view v-if="postponeTaskInfo.isOverdue" class="postpone-info__tag">
            <text>逾期{{ postponeTaskInfo.overdueDays }}天</text>
          </view>
        </view>

        <view class="task-sheet__field">
          <text class="task-sheet__label">推迟到</text>
          <picker mode="date" :value="postponeDateStr" @change="onPostponeDateChange">
            <view class="form-input form-input--picker">
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
        <view class="task-sheet__actions">
          <view class="task-sheet__btn task-sheet__btn--confirm" @click="doPostpone">
            <text style="color: #fff; font-size: 14px; font-weight: 600;">确认推迟</text>
          </view>
          <view class="task-sheet__btn task-sheet__btn--cancel" @click="showPostponeModal = false">
            <text style="color: var(--text-2); font-size: 14px; font-weight: 600;">取消</text>
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

    <!-- 健康关注卡：操作菜单 -->
    <BSheet v-model:visible="showSickMenu" :title="sickMenuDog?.dogName || ''">
      <view class="sick-menu-body">
        <view
          v-for="(item, idx) in sickMenuItems"
          :key="idx"
          class="sick-menu-item"
          @click="onSickMenuSelect(item)"
        >
          <text class="material-icons-round sick-menu-item__icon">{{ item.icon }}</text>
          <text class="sick-menu-item__label">{{ item.label }}</text>
        </view>
      </view>
    </BSheet>

    <!-- 健康关注卡：停止用药确认 -->
    <BSheet v-model:visible="showStopConfirm" title="">
      <view class="stop-confirm-body">
        <view class="stop-confirm-icon-wrap">
          <text class="material-icons-round stop-confirm-icon">medication_liquid</text>
        </view>
        <text class="stop-confirm-title">停止用药</text>
        <text class="stop-confirm-desc">确定停止 <text class="stop-confirm-bold">{{ stopConfirmData?.dogName }}</text> 的 <text class="stop-confirm-bold">{{ stopConfirmData?.drugName || '用药' }}</text> 吗？</text>
        <text class="stop-confirm-sub">{{ [stopConfirmData?.dosageStr, stopConfirmData?.progress].filter(Boolean).join(' · ') }}{{ stopConfirmData?.progress ? ' · 剩余任务将被取消' : '剩余用药任务将被取消' }}</text>
        <view class="stop-confirm-actions">
          <view class="stop-confirm-btn stop-confirm-btn--cancel" @click="showStopConfirm = false">
            <text>继续用药</text>
          </view>
          <view class="stop-confirm-btn stop-confirm-btn--danger" @click="confirmStopMedication">
            <text style="color: #fff;">确认停止</text>
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
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import BNavBar from '@/components/layout/BNavBar.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BIconBox from '@/components/base/BIconBox.vue'
import { useTaskStore } from '@/stores/taskStore'
import { consumeSubmitFeedback } from '@/composables/useSubmitFeedback'

const { hasFamily, loadFamily } = useAuth()
const taskStore = useTaskStore()

// stale-while-revalidate：先用 taskStore 缓存渲染，后台刷新
const cards = ref<any[]>(taskStore.cards)
const counts = reactive({
  today: taskStore.counts.today || 0,
  week: taskStore.counts.week || 0,
  month30: taskStore.counts.month30 || 0,
  hasOverdue: taskStore.counts.hasOverdue || false,
})
const dayCards = ref<any[]>([])
const viewMode = ref<'today' | 'date'>('today')
const hasCachedData = cards.value.length > 0
const loading = ref(!hasCachedData)
const scrollTarget = ref('')
const dayCounts = ref<Record<number, number>>({})
const submitBannerMessage = ref('')
let submitBannerTimer: ReturnType<typeof setTimeout> | null = null
const suppressedTaskMap = ref<Record<string, number>>({})

// 选中日期（0点 timestamp）
const selectedDate = ref(startOfDay(Date.now()))
const isSelectedToday = computed(() => selectedDate.value === startOfDay(Date.now()))
const todaySections = computed(() => [
  {
    key: 'overdue',
    title: '逾期待处理',
    dotColor: 'var(--red)',
    cards: cards.value.filter(card => card.priority === 'overdue'),
  },
  {
    key: 'workflow',
    title: '繁育流程',
    dotColor: 'var(--amber)',
    cards: cards.value.filter(card => card.sectionType === 'workflow' && card.priority !== 'overdue'),
  },
  {
    key: 'reminders',
    title: '健康提醒',
    dotColor: 'var(--blue)',
    cards: cards.value.filter(card => card.sectionType === 'reminders' && card.priority !== 'overdue'),
  },
  {
    key: 'therapy',
    title: '今日用药',
    dotColor: 'var(--green)',
    cards: cards.value.filter(card => card.sectionType === 'therapy' && card.priority !== 'overdue'),
  },
])
const summaryPills = computed(() => [
  {
    key: 'overdue',
    label: '逾期',
    count: todaySections.value.find(section => section.key === 'overdue')?.cards.length || 0,
    dotColor: 'var(--red)',
    pillClass: 'pill-red',
  },
  {
    key: 'workflow',
    label: '繁育',
    count: todaySections.value.find(section => section.key === 'workflow')?.cards.length || 0,
    dotColor: 'var(--amber)',
    pillClass: 'pill-amber',
  },
  {
    key: 'reminders',
    label: '健康',
    count: todaySections.value.find(section => section.key === 'reminders')?.cards.length || 0,
    dotColor: 'var(--blue)',
    pillClass: 'pill-dim',
  },
  {
    key: 'therapy',
    label: '用药',
    count: todaySections.value.find(section => section.key === 'therapy')?.cards.length || 0,
    dotColor: 'var(--green)',
    pillClass: 'pill-dim',
  },
])

// H-3: 快速完成
const showQuickComplete = ref(false)
const quickCompleteTask = ref<any>(null)
const quickCompleteNotes = ref('')
const quickCompleteDate = ref(Date.now())

const quickCompleteDateStr = computed(() => {
  const d = new Date(quickCompleteDate.value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

function onQuickCompleteDateChange(e: any) {
  quickCompleteDate.value = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
}

// H-4: 推迟弹窗
const showPostponeModal = ref(false)
const postponeTaskId = ref<string | string[]>('')
const postponeDate = ref(Date.now() + 86400000)
const postponeQuick = ref('tomorrow')

const postponeDateStr = computed(() => {
  const d = new Date(postponeDate.value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

function setPostponeQuick(option: string) {
  postponeQuick.value = option
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  if (option === 'tomorrow') now.setDate(now.getDate() + 1)
  else if (option === 'dayAfter') now.setDate(now.getDate() + 2)
  else if (option === 'nextWeek') now.setDate(now.getDate() + 7)
  postponeDate.value = now.getTime()
}

// H-5: 批量完成
const showBatchComplete = ref(false)
const batchCompleteTitle = ref('批量完成')
const batchDogList = ref<Array<{ id: string; name: string; completed: boolean }>>([])
const batchSelected = reactive<Record<string, boolean>>({})
let batchTaskIds: string[] = []

const batchSelectedCount = computed(() => Object.values(batchSelected).filter(Boolean).length)
const isAllSelected = computed(() => {
  const uncompleted = batchDogList.value.filter(d => !d.completed)
  return uncompleted.length > 0 && uncompleted.every(d => batchSelected[d.id])
})

function toggleSelectAll() {
  const uncompleted = batchDogList.value.filter(d => !d.completed)
  if (isAllSelected.value) {
    uncompleted.forEach(d => { batchSelected[d.id] = false })
  } else {
    uncompleted.forEach(d => { batchSelected[d.id] = true })
  }
}

function toggleBatchDog(id: string) {
  const dog = batchDogList.value.find(d => d.id === id)
  if (dog?.completed) return
  batchSelected[id] = !batchSelected[id]
}

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
const { run: fetchWeekCards } = useCloudCall<{ data: any }>('task-service', 'getWeekCards')
const { run: doCompleteTask } = useCloudCall('task-service', 'completeTask')
const { run: doPostponeTask } = useCloudCall('task-service', 'postponeTask')
const { run: doBatchComplete } = useCloudCall('task-service', 'batchCompleteTask')
const { run: doRecordMedDose } = useCloudCall('health-service', 'recordMedicationDose')
const { run: doBatchCompleteMedDay } = useCloudCall('health-service', 'batchCompleteMedicationDay')

// 7天卡片缓存：{ [dayTimestamp]: Card[] }
const weekCache = ref<Record<number, any[]>>({})
let latestLoadToken = 0

function scrollToSection(section: string) {
  scrollTarget.value = `section-${section}`
}

/** 加载今日卡片（逾期+今日合并为单列表） */
async function loadTodayCards(loadToken = latestLoadToken) {
  const hasData = cards.value.length > 0
  if (!hasData) loading.value = true

  const result = await fetchCards()
  if (loadToken !== latestLoadToken) return
  if (result?.data) {
    pruneSuppressedTasks()
    cards.value = filterSuppressedCards(result.data.cards || [])
    counts.today = result.data.counts?.today || 0
    counts.week = result.data.counts?.week || 0
    counts.month30 = result.data.counts?.month30 || 0
    counts.hasOverdue = result.data.counts?.hasOverdue || false
    // 同步到 taskStore
    taskStore.cards = cards.value
    taskStore.counts = { today: counts.today, week: counts.week, month30: counts.month30, hasOverdue: counts.hasOverdue }
    taskStore.loaded = true
  }
  loading.value = false
}

/** 加载未来日期的卡片缓存（今天+未来6天，用于 WeekStrip 点击） */
async function loadWeekCache(loadToken = latestLoadToken) {
  const DAY_MS = 86400000
  const todayTs = startOfDay(Date.now())
  // 只缓存今天之后的未来日期（过去日期不可点击）
  const start = todayTs + DAY_MS
  const end = todayTs + 7 * DAY_MS - 1 // 未来 6 天
  const result = await fetchWeekCards(start, end)
  if (loadToken !== latestLoadToken) return
  if (result?.data) {
    pruneSuppressedTasks()
    const cache: Record<number, any[]> = {}
    for (const [k, v] of Object.entries(result.data)) {
      cache[Number(k)] = filterSuppressedCards(v as any[])
    }
    weekCache.value = cache
  }
}

async function loadDateCounts(loadToken = latestLoadToken) {
  const DAY_MS = 86400000
  const todayTs = startOfDay(Date.now())
  // 只查询今天到本周日的范围（过去日期不显示红点）
  const end = todayTs + 7 * DAY_MS - 1
  const result = await fetchDateCounts(todayTs, end)
  if (loadToken !== latestLoadToken) return
  if (result?.data) {
    dayCounts.value = result.data
  }
}

/** 并行加载所有首页数据 */
async function loadAll() {
  const loadToken = ++latestLoadToken
  await Promise.all([loadTodayCards(loadToken), loadWeekCache(loadToken), loadDateCounts(loadToken)])
  if (loadToken !== latestLoadToken) return
  // 两个请求都完成后：以实际可见卡片数修正今天的红点
  // 不依赖 counts.today（它含用药卡，即使今日剂量全给完仍为 1）
  const todayTs = startOfDay(Date.now())
  if (cards.value.length === 0) {
    dayCounts.value[todayTs] = 0
  } else if (!dayCounts.value[todayTs]) {
    dayCounts.value[todayTs] = 1
  }
}

function onDateSelect(ts: number) {
  selectedDate.value = ts
  const todayTs = startOfDay(Date.now())
  if (ts === todayTs) {
    // 切回今天：显示今日模式
    viewMode.value = 'today'
    dayCards.value = []
  } else {
    // 其他日期：从缓存读取，零延迟
    viewMode.value = 'date'
    dayCards.value = weekCache.value[ts] || []
  }
}

function toggleCalendar() {
  uni.showToast({ title: '月历功能后续迭代', icon: 'none' })
}

function showSubmitBanner(message: string) {
  submitBannerMessage.value = message
  if (submitBannerTimer) clearTimeout(submitBannerTimer)
  submitBannerTimer = setTimeout(() => {
    submitBannerMessage.value = ''
  }, 2200)
}

function pruneSuppressedTasks() {
  const now = Date.now()
  Object.entries(suppressedTaskMap.value).forEach(([taskId, expiresAt]) => {
    if (expiresAt <= now) delete suppressedTaskMap.value[taskId]
  })
}

function addSuppressedTasks(taskIds: string[] = [], duration = 2500) {
  if (!taskIds.length) return
  const expiresAt = Date.now() + duration
  taskIds.forEach(taskId => {
    if (taskId) suppressedTaskMap.value[taskId] = expiresAt
  })
}

function isTaskSuppressed(taskId?: string) {
  if (!taskId) return false
  pruneSuppressedTasks()
  return !!suppressedTaskMap.value[taskId]
}

function syncCardMeta(card: any, remainingTasks: any[]) {
  if (!card) return null
  card.tasks = remainingTasks

  if (card.cardType === 'batch' || card.cardType === 'care_group') {
    const dogIdSet = new Set(remainingTasks.map((t: any) => t.dog_id || t.dogId).filter(Boolean))
    card.dogs = (card.dogs || []).filter((dog: any) => dogIdSet.has(dog.dogId || dog.dog_id))
    if (card.progress) {
      card.progress = { ...card.progress, total: card.dogs.length }
    }
    if (card.cardType === 'batch' && typeof card.groupTitle === 'string') {
      card.groupTitle = card.groupTitle.replace(/ · \d+只$/, ` · ${card.dogs.length}只`)
    }
  }

  return card
}

function filterSuppressedCards(cardList: any[]) {
  return (cardList || []).map((card: any) => {
    if (!card?.tasks?.length) return card
    const remainingTasks = card.tasks.filter((task: any) => !isTaskSuppressed(task._id))
    if (remainingTasks.length === card.tasks.length) return card
    if (remainingTasks.length === 0) return null
    return syncCardMeta({ ...card, dogs: Array.isArray(card.dogs) ? [...card.dogs] : card.dogs }, remainingTasks)
  }).filter(Boolean)
}

// 乐观更新：标记正在消失的卡片
const completingCards = ref(new Set<string>())
const completedCards = ref(new Set<string>())

function removeCardLocally(taskId: string, forceRemoveCard = false, showSuccess = true) {
  const lists = [cards, dayCards]
  for (const list of lists) {
    const idx = list.value.findIndex(c => c.tasks?.some((t: any) => t._id === taskId) || c.id === taskId)
    if (idx < 0) continue
    const card = list.value[idx]
    const remainingTasks = card.tasks?.filter((t: any) => t._id !== taskId) || []
    if (remainingTasks.length === 0 || forceRemoveCard) {
      if (showSuccess) {
        // 完成：极短确认后退场，优先保证首页操作流畅
        completedCards.value.add(card.id)
        setTimeout(() => {
          completedCards.value.delete(card.id)
          completingCards.value.add(card.id)
          setTimeout(() => {
            const currentIdx = list.value.findIndex(c => c.id === card.id)
            if (currentIdx >= 0) list.value.splice(currentIdx, 1)
            completingCards.value.delete(card.id)
            counts.today = Math.max(0, counts.today - 1)
            dayCounts.value[startOfDay(Date.now())] = counts.today
          }, 220)
        }, 280)
      } else {
        // 推迟/跳过：直接滑出
        completingCards.value.add(card.id)
        setTimeout(() => {
          const currentIdx = list.value.findIndex(c => c.id === card.id)
          if (currentIdx >= 0) list.value.splice(currentIdx, 1)
          completingCards.value.delete(card.id)
          counts.today = Math.max(0, counts.today - 1)
          dayCounts.value[startOfDay(Date.now())] = counts.today
        }, 220)
      }
    } else {
      syncCardMeta(card, remainingTasks)
    }
    break
  }
  syncWeekCache(taskId)
}

/** 从 weekCache 中移除指定 task */
function syncWeekCache(taskId: string) {
  for (const [dayTs, cards] of Object.entries(weekCache.value)) {
    const cardIdx = (cards as any[]).findIndex(c => c.tasks?.some((t: any) => t._id === taskId))
    if (cardIdx < 0) continue
    const card = (cards as any[])[cardIdx]
    const remaining = card.tasks?.filter((t: any) => t._id !== taskId) || []
    if (remaining.length === 0) {
      (cards as any[]).splice(cardIdx, 1)
    } else {
      syncCardMeta(card, remaining)
    }
    // 更新 dayCounts
    const ts = Number(dayTs)
    if (dayCounts.value[ts]) {
      dayCounts.value[ts] = Math.max(0, dayCounts.value[ts] - 1)
    }
    break
  }
}

async function onComplete(taskId: string, mode?: boolean | string) {
  // 批量卡片全部勾完
  if (mode === true) {
    removeCardLocally(taskId)
    doCompleteTask(taskId)
    return
  }
  // 批量卡片部分勾选
  if (mode === false) {
    doCompleteTask(taskId)
    return
  }
  if (mode === 'batch-auto') {
    removeCardLocally(taskId)
    doCompleteTask(taskId, true)
    return
  }
  if (mode === 'batch-auto-partial') {
    doCompleteTask(taskId, true)
    return
  }
  // DogCard "完成" (mode='auto'): 一键完成 + 自动创建记录
  if (mode === 'auto') {
    removeCardLocally(taskId)
    doCompleteTask(taskId, true) // autoRecord=true
    return
  }
  // DogCard "跳过" (mode='skip'): 仅标记 done，不创建记录
  if (mode === 'skip') {
    removeCardLocally(taskId, false, false)
    doCompleteTask(taskId)
    return
  }
  // 兜底
  removeCardLocally(taskId)
  doCompleteTask(taskId)
}

const postponeTaskInfo = ref<any>(null)

function onPostpone(taskIds: string | string[], title?: string) {
  postponeTaskId.value = taskIds
  postponeDate.value = Date.now() + 86400000
  postponeQuick.value = 'tomorrow'

  const firstId = Array.isArray(taskIds) ? taskIds[0] : taskIds
  const allCards = [...cards.value, ...dayCards.value]
  const card = allCards.find(c => c.tasks?.some((t: any) => t._id === firstId))
  const task = card?.tasks?.find((t: any) => t._id === firstId)

  // 批量推迟显示批量标题，单条显示犬名
  const isBatch = Array.isArray(taskIds) && taskIds.length > 1
  postponeTaskInfo.value = {
    dogName: isBatch ? (title || card?.groupTitle || '') : (card?.dogName || task?.dog_name || ''),
    title: isBatch ? '' : (task?.title || card?.groupTitle || ''),
    isOverdue: card?.priority === 'overdue',
    overdueDays: card?.priority === 'overdue' && task?.due_date
      ? Math.ceil((Date.now() - task.due_date) / 86400000)
      : 0,
  }
  showPostponeModal.value = true
}

function onPostponeDateChange(e: any) {
  postponeDate.value = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
  postponeQuick.value = ''
}

async function doPostpone() {
  const taskIds = postponeTaskId.value
  showPostponeModal.value = false

  const ids = Array.isArray(taskIds) ? taskIds : [taskIds]

  if (ids.length > 1) {
    // 批量推迟：找到卡片直接整张移除
    const lists = [cards, dayCards]
    for (const list of lists) {
      const idx = list.value.findIndex(c => c.tasks?.some((t: any) => ids.includes(t._id)))
      if (idx >= 0) {
        const card = list.value[idx]
        completingCards.value.add(card.id)
        setTimeout(() => {
          const ci = list.value.findIndex(c => c.id === card.id)
          if (ci >= 0) list.value.splice(ci, 1)
          completingCards.value.delete(card.id)
          counts.today = Math.max(0, counts.today - 1)
        }, 450)
        break
      }
    }
    // 同步 weekCache（只用第一条 ID 定位卡片，避免重复减计数）
    syncWeekCache(ids[0])
  } else {
    // 单条推迟
    removeCardLocally(ids[0], false, false)
    syncWeekCache(ids[0])
  }

  // 后台静默调接口
  for (const id of ids) {
    doPostponeTask(id, postponeDate.value)
  }
}

async function onBatchComplete(payload: any) {
  // 打开批量完成 Sheet (H-5)
  if (payload && payload.dogs) {
    batchCompleteTitle.value = payload.title || '批量完成'
    batchDogList.value = payload.dogs
    batchTaskIds = payload.taskIds || []
    Object.keys(batchSelected).forEach(k => delete batchSelected[k])
    payload.dogs.forEach((d: any) => {
      if (!d.completed) batchSelected[d.id] = false
    })
    showBatchComplete.value = true
    return
  }
  // 数组方式（BatchCard/MedicationCard 的"完成"按钮）— 整张卡片移除
  const taskIds = Array.isArray(payload) ? payload : (payload?.taskIds || [])
  const autoRecord = !Array.isArray(payload) && !!payload?.autoRecord
  if (taskIds.length > 0) {
    removeCardLocally(taskIds[0], true)
  }
  doBatchComplete(taskIds, autoRecord)
}

function onBatchSkip(taskIds: string[]) {
  if (taskIds.length > 0) removeCardLocally(taskIds[0], true, false)
  doBatchComplete(taskIds)
}

async function onRecordDose({ medicationTaskId }: { medicationTaskId: string }) {
  await doRecordMedDose(medicationTaskId)
  await loadTodayCards()
}

async function onBatchCompleteMed(medicationTaskIds: string[]) {
  if (medicationTaskIds.length > 0) {
    removeCardLocally('medication', true)
  }
  await doBatchCompleteMedDay(medicationTaskIds)
  await loadTodayCards()
}

function applyHomeFeedback(payload: any) {
  addSuppressedTasks(payload?.suppressTaskIds || payload?.completedTaskIds || [])

  if (payload?.completedTaskIds?.length) {
    if (payload.removeBatchCard) {
      removeCardLocally(payload.completedTaskIds[0], true)
    } else {
      payload.completedTaskIds.forEach((taskId: string) => removeCardLocally(taskId))
    }
  }

  if (payload?.createdDate && payload?.createdCount) {
    const createdTs = startOfDay(payload.createdDate)
    dayCounts.value[createdTs] = (dayCounts.value[createdTs] || 0) + payload.createdCount
    if (createdTs === startOfDay(Date.now())) {
      counts.today += payload.createdCount
    }
  }
}

const { run: updateIllnessStatus } = useCloudCall('health-service', 'updateIllnessStatus')
const { run: endMedication } = useCloudCall('health-service', 'endMedicationByDog')

/** 乐观移除疾病观察卡中的犬只行（带淡出动画） */
function removeSickDogLocally(dogId: string) {
  const list = cards
  const idx = list.value.findIndex(c => c.cardType === 'sick_observation')
  if (idx < 0) return
  const card = list.value[idx]
  const dog = (card.dogs || []).find((d: any) => d.dogId === dogId)
  if (!dog) return

  // 标记淡出动画
  dog._removing = true

  setTimeout(() => {
    const remaining = (card.dogs || []).filter((d: any) => d.dogId !== dogId)
    if (remaining.length === 0) {
      // 最后一只：整张卡片滑出
      completingCards.value.add(card.id)
      setTimeout(() => {
        const ci = list.value.findIndex(c => c.id === card.id)
        if (ci >= 0) list.value.splice(ci, 1)
        completingCards.value.delete(card.id)
        counts.today = Math.max(0, counts.today - 1)
        dayCounts.value[startOfDay(Date.now())] = counts.today
      }, 450)
    } else {
      card.dogs = remaining
    }
  }, 350)
}

// 健康关注卡：操作菜单状态
const showSickMenu = ref(false)
const sickMenuDog = ref<any>(null)
const sickMenuItems = ref<any[]>([])

// 健康关注卡：停止用药确认状态
const showStopConfirm = ref(false)
const stopConfirmData = ref<any>(null)

function onAction(payload: { type: string; data: any }) {
  if (payload.type === 'viewDog' && payload.data?.dogId) {
    uni.navigateTo({ url: `/pages/dog/detail?id=${payload.data.dogId}` })
  } else if (payload.type === 'show_sick_menu') {
    // 打开操作菜单 BSheet
    sickMenuDog.value = payload.data.dog
    sickMenuItems.value = payload.data.items
    showSickMenu.value = true
  } else if (payload.type === 'show_stop_confirm') {
    // 打开停止用药确认 BSheet
    stopConfirmData.value = payload.data
    showStopConfirm.value = true
  } else if (payload.type === 'recover' && payload.data?.illnessId) {
    removeSickDogLocally(payload.data.dogId)
    updateIllnessStatus(payload.data.illnessId, '已康复')
  } else if (payload.type === 'update_status' && payload.data?.illnessId) {
    // 就地更新状态标签（不移除行）
    const sickCard = cards.value.find(c => c.cardType === 'sick_observation')
    if (sickCard) {
      const dog = (sickCard.dogs || []).find((d: any) => d.dogId === payload.data.dogId)
      if (dog) dog.treatmentStatus = payload.data.status
    }
    updateIllnessStatus(payload.data.illnessId, payload.data.status)
  } else if (payload.type === 'stop_medication' && payload.data?.dogId) {
    endMedication(payload.data.dogId).then(() => loadAll())
  }
}

function onSickMenuSelect(item: any) {
  showSickMenu.value = false
  const dog = sickMenuDog.value
  if (!dog) return

  if (item.action === 'recover') {
    onAction({ type: 'recover', data: { dogId: dog.dogId, dogName: dog.dogName, illnessId: dog.illnessId } })
  } else if (item.action === 'update_status') {
    onAction({ type: 'update_status', data: { dogId: dog.dogId, status: '治疗中', illnessId: dog.illnessId } })
  } else if (item.action === 'start_medication') {
    const dogList = [{ _id: dog.dogId, name: dog.dogName }]
    uni.navigateTo({ url: `/pages/record/health-medication?batchDogs=${encodeURIComponent(JSON.stringify(dogList))}` })
  }
}

function confirmStopMedication() {
  showStopConfirm.value = false
  if (stopConfirmData.value) {
    onAction({ type: 'stop_medication', data: stopConfirmData.value })
  }
}

async function confirmQuickComplete() {
  if (!quickCompleteTask.value) return
  const taskId = quickCompleteTask.value._id || quickCompleteTask.value.id
  showQuickComplete.value = false

  // 乐观更新：立即触发消失动画
  removeCardLocally(taskId)

  // 后台静默调接口
  doCompleteTask(taskId, quickCompleteDate.value, quickCompleteNotes.value || null)
  quickCompleteNotes.value = ''
  quickCompleteTask.value = null
}

async function confirmBatchComplete() {
  if (batchSelectedCount.value === 0) return
  const selectedIds = Object.entries(batchSelected)
    .filter(([, v]) => v)
    .map(([k]) => k)
  // 映射回 taskIds
  const taskIdsToComplete = batchTaskIds.length > 0
    ? batchTaskIds.filter((_id, idx) => {
        const dog = batchDogList.value[idx]
        return dog && selectedIds.includes(dog.id)
      })
    : selectedIds
  await doBatchComplete(taskIdsToComplete)
  showBatchComplete.value = false
  await loadAll()
}

onShow(async () => {
  const feedback = consumeSubmitFeedback('/pages/home/index')
  if (feedback?.message) {
    applyHomeFeedback(feedback)
    showSubmitBanner(feedback.message)
  }

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
  viewMode.value = 'today'
  dayCards.value = []
  await loadAll()
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
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 16px;
  padding-bottom: 16px;
}
.pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  padding: 8px 0;
  border-radius: 16px;
  transition: transform 0.12s ease, filter 0.12s ease;
  &:active { transform: scale(0.95); filter: brightness(0.95); }
}
.pill-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pill-label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
.pill-num {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
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

/* ==================== TASK SHEETS (H-3, H-4, H-5) ==================== */
.task-sheet {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 12px;
}
.task-sheet__info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0 8px;
}
.task-sheet__info-text {
  flex: 1;
}
.task-sheet__task-title {
  display: block;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
}
.task-sheet__dog-name {
  display: block;
  font-size: 13px;
  color: var(--text-2);
  margin-top: 2px;
}
/* ---- 推迟任务犬只信息 ---- */
.postpone-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--card-dim);
  border-radius: 12px;
  margin-bottom: 16px;

  &__text {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
  }

  &__tag {
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--red-soft);
    font-size: 11px;
    font-weight: 700;
    color: var(--red);
  }
}

.task-sheet__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.task-sheet__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
}
.task-sheet__input {
  width: 100%;
  font-size: 15px;
  color: var(--text-1);
  padding: 10px 14px;
  border: 1.5px solid var(--text-4);
  border-radius: 14px;
  background: var(--card);
}
.task-sheet__picker {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 15px;
  color: var(--text-1);
  padding: 10px 14px;
  border: 1.5px solid var(--text-4);
  border-radius: 14px;
}
.task-sheet__quick-dates {
  display: flex;
  gap: 8px;
}
.task-sheet__quick-date {
  padding: 6px 14px;
  border-radius: var(--radius-btn);
  background: var(--card-dim);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  transition: all 0.12s ease;
  &:active { transform: scale(0.92); }
  &.active {
    background: var(--primary);
    color: #fff;
    box-shadow: 0 2px 8px rgba(234, 62, 119, 0.25);
  }
}
.task-sheet__actions {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}
.task-sheet__btn {
  flex: 1;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-btn);
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
  &--cancel { background: var(--card-dim); }
  &--confirm { background: var(--primary); }
  &.disabled { opacity: 0.4; pointer-events: none; }
}

/* H-5: 批量完成 */
.task-sheet__select-bar {
  padding: 4px 0;
}
.task-sheet__select-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.95); }
}
.task-sheet__select-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
}
.task-sheet__checkbox {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-checkbox);
  border: 2px solid var(--text-4);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease;
  &.checked {
    background: var(--green);
    border-color: var(--green);
  }
}
.task-sheet__dog-list {
  max-height: 280px;
}
.task-sheet__dog-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(216, 203, 189, 0.2);
  transition: transform 0.12s ease;
  &:active { transform: scale(0.97); }
  &:last-child { border-bottom: none; }
}
.task-sheet__dog-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--rose), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.task-sheet__dog-name-text {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.task-sheet__done-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--green);
  background: var(--green-soft);
  padding: 2px 8px;
  border-radius: var(--radius-tag);
}

/* 健康关注操作菜单 */
.sick-menu-body { padding: 0 0 20px; }
.sick-menu-item {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 20px;
  border-bottom: 0.5px solid var(--card-dim);
  &:last-child { border-bottom: none; }
  &:active { background: var(--card-dim); }
}
.sick-menu-item__icon { font-size: 20px; color: var(--primary); }
.sick-menu-item__label { font-size: 15px; font-weight: 600; color: var(--text-1); }

/* 停止用药确认 */
.stop-confirm-body { padding: 4px 20px 24px; text-align: center; }
.stop-confirm-icon-wrap {
  width: 52px; height: 52px; border-radius: 16px;
  background: var(--red-soft);
  margin: 0 auto 14px;
  display: flex; align-items: center; justify-content: center;
}
.stop-confirm-icon { font-size: 26px; color: var(--red); }
.stop-confirm-title {
  display: block; font-size: 18px; font-weight: 800;
  color: var(--text-1); font-family: var(--font-display);
  margin-bottom: 10px;
}
.stop-confirm-desc {
  display: block; font-size: 15px; color: var(--text-2); line-height: 1.6;
}
.stop-confirm-bold { font-weight: 700; color: var(--text-1); }
.stop-confirm-sub {
  display: block; font-size: 13px; color: var(--text-3); margin-top: 6px;
}
.stop-confirm-actions { display: flex; gap: 12px; margin-top: 24px; }
.stop-confirm-btn {
  flex: 1; padding: 14px; border-radius: 14px; text-align: center;
  font-size: 15px; font-weight: 700;
  transition: transform 0.12s, opacity 0.12s;
  &:active { transform: scale(0.96); opacity: 0.85; }
  &--cancel { background: var(--card-dim); color: var(--text-2); }
  &--danger { background: var(--red); color: #fff; }
}
</style>
