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
        <view class="pill pill-dim">
          <view class="pill-dot" style="background: var(--text-3);" />
          <text class="pill-label">本周</text>
          <text class="pill-num">{{ weekCount }}</text>
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
      <!-- ===== 今日模式：三区 ===== -->
      <template v-if="viewMode === 'today'">
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
              :completing="completingCards.has(card.id)"
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

        <!-- 空状态（今日模式） -->
        <BEmpty
          v-if="!loading && overdueCards.length === 0 && todayCards.length === 0"
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
              @complete="onComplete" @postpone="onPostpone"
              @batch-complete="onBatchComplete" @action="onAction"
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
import { useTaskStore } from '@/stores/taskStore'

const { hasFamily, loadFamily } = useAuth()
const taskStore = useTaskStore()

// stale-while-revalidate：先用 taskStore 缓存渲染，后台刷新
const overdueCards = ref<any[]>(taskStore.overdueCards)
const todayCards = ref<any[]>(taskStore.todayCards)
const counts = reactive({ overdue: taskStore.counts.overdue || 0, today: taskStore.counts.today || 0 })
const dayCards = ref<any[]>([])
const viewMode = ref<'today' | 'date'>('today')
const hasCachedData = overdueCards.value.length + todayCards.value.length > 0
const loading = ref(!hasCachedData)
const scrollTarget = ref('')
const dayCounts = ref<Record<number, number>>({})

// 选中日期（0点 timestamp）
const selectedDate = ref(startOfDay(Date.now()))
const isSelectedToday = computed(() => selectedDate.value === startOfDay(Date.now()))

// 本周任务数：从 dayCounts 中汇总未来 7 天（不含今天，避免和"今日"重复）
const weekCount = computed(() => {
  const todayTs = startOfDay(Date.now())
  const DAY = 86400000
  let total = 0
  for (let i = 1; i <= 7; i++) {
    total += dayCounts.value[todayTs + i * DAY] || 0
  }
  return total
})

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

// 7天卡片缓存：{ [dayTimestamp]: Card[] }
const weekCache = ref<Record<number, any[]>>({})

function scrollToSection(section: string) {
  scrollTarget.value = `section-${section}`
}

/** 加载今日模式（逾期 + 今日） */
async function loadTodayCards() {
  const hasData = overdueCards.value.length + todayCards.value.length > 0
  if (!hasData) loading.value = true

  const result = await fetchCards()
  if (result?.data) {
    overdueCards.value = result.data.overdue || []
    todayCards.value = result.data.today || []
    counts.overdue = result.data.counts?.overdue || 0
    counts.today = result.data.counts?.today || 0
    // 同步到 taskStore
    taskStore.overdueCards = overdueCards.value
    taskStore.todayCards = todayCards.value
    taskStore.counts = { overdue: counts.overdue, today: counts.today }
    taskStore.loaded = true
  }
  loading.value = false
}

/** 一次性加载 7 天卡片缓存 */
async function loadWeekCache() {
  const DAY_MS = 86400000
  const todayTs = startOfDay(Date.now())
  const start = todayTs - 3 * DAY_MS
  const end = todayTs + 3 * DAY_MS + DAY_MS - 1
  const result = await fetchWeekCards(start, end)
  if (result?.data) {
    // 后端返回的 key 是字符串，转为 number
    const cache: Record<number, any[]> = {}
    for (const [k, v] of Object.entries(result.data)) {
      cache[Number(k)] = v as any[]
    }
    weekCache.value = cache
  }
}

async function loadDateCounts() {
  const DAY_MS = 86400000
  const start = startOfDay(Date.now()) - 3 * DAY_MS
  const end = startOfDay(Date.now()) + 8 * DAY_MS - 1 // 覆盖前3天 + 今天 + 后7天
  const result = await fetchDateCounts(start, end)
  if (result?.data) {
    dayCounts.value = result.data
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

// 乐观更新：标记正在消失的卡片
const completingCards = ref(new Set<string>())

function removeCardLocally(taskId: string) {
  const lists = [overdueCards, todayCards, dayCards]
  for (const list of lists) {
    const idx = list.value.findIndex(c => c.tasks?.some((t: any) => t._id === taskId) || c.id === taskId)
    if (idx < 0) continue
    const card = list.value[idx]
    const remainingTasks = card.tasks?.filter((t: any) => t._id !== taskId) || []
    if (remainingTasks.length === 0) {
      completingCards.value.add(card.id)
      setTimeout(() => {
        const currentIdx = list.value.findIndex(c => c.id === card.id)
        if (currentIdx >= 0) list.value.splice(currentIdx, 1)
        completingCards.value.delete(card.id)
        if (card.priority === 'overdue') counts.overdue = Math.max(0, counts.overdue - 1)
        else counts.today = Math.max(0, counts.today - 1)
      }, 450)
    } else {
      card.tasks = remainingTasks
    }
    break
  }
  // 同步更新 weekCache
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
      card.tasks = remaining
    }
    // 更新 dayCounts
    const ts = Number(dayTs)
    if (dayCounts.value[ts]) {
      dayCounts.value[ts] = Math.max(0, dayCounts.value[ts] - 1)
    }
    break
  }
}

async function onComplete(taskId: string, allDone?: boolean) {
  if (allDone === true) {
    // 批量卡片全部勾完 → 动画移除整张卡片
    removeCardLocally(taskId)
    doCompleteTask(taskId)
    return
  }
  if (allDone === false) {
    // 批量卡片部分勾选 → 只调接口，不移除卡片（本地 checkbox 已更新）
    doCompleteTask(taskId)
    return
  }
  // DogCard 的完成按钮 → 打开快速完成 Sheet (H-3)
  const allCards = [...overdueCards.value, ...todayCards.value, ...dayCards.value]
  const card = allCards.find(c => c.tasks?.some((t: any) => t._id === taskId))
  if (card) {
    const task = card.tasks?.find((t: any) => t._id === taskId)
    quickCompleteTask.value = { ...task, dog_name: card.dogName }
    quickCompleteNotes.value = ''
    quickCompleteDate.value = startOfDay(Date.now())
    showQuickComplete.value = true
    return
  }
  // 兜底：直接完成
  removeCardLocally(taskId)
  doCompleteTask(taskId)
}

const postponeTaskInfo = ref<any>(null)

function onPostpone(taskIds: string | string[], title?: string) {
  postponeTaskId.value = taskIds
  postponeDate.value = Date.now() + 86400000
  postponeQuick.value = 'tomorrow'

  const firstId = Array.isArray(taskIds) ? taskIds[0] : taskIds
  const allCards = [...overdueCards.value, ...todayCards.value, ...dayCards.value]
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
    const lists = [overdueCards, todayCards, dayCards]
    for (const list of lists) {
      const idx = list.value.findIndex(c => c.tasks?.some((t: any) => ids.includes(t._id)))
      if (idx >= 0) {
        const card = list.value[idx]
        completingCards.value.add(card.id)
        setTimeout(() => {
          const ci = list.value.findIndex(c => c.id === card.id)
          if (ci >= 0) list.value.splice(ci, 1)
          completingCards.value.delete(card.id)
          if (card.priority === 'overdue') counts.overdue = Math.max(0, counts.overdue - 1)
          else counts.today = Math.max(0, counts.today - 1)
        }, 450)
        // 同步 taskStore（用第一条 ID 定位整张卡片）
        taskStore.removeCardByTaskId(ids[0])
        break
      }
    }
    // 同步 weekCache（只用第一条 ID 定位卡片，避免重复减计数）
    syncWeekCache(ids[0])
  } else {
    // 单条推迟
    removeCardLocally(ids[0])
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
  // 数组方式（BatchCard/MedicationCard 的"完成"按钮）— 用第一条 ID 移除整张卡片
  const taskIds = Array.isArray(payload) ? payload : []
  if (taskIds.length > 0) {
    removeCardLocally(taskIds[0])
    syncWeekCache(taskIds[0])
    taskStore.removeCardByTaskId(taskIds[0])
  }
  doBatchComplete(taskIds)
}

const { run: updateIllnessStatus } = useCloudCall('health-service', 'updateIllnessStatus')

function onAction(payload: { type: string; data: any }) {
  if (payload.type === 'viewDog' && payload.data?.dogId) {
    uni.navigateTo({ url: `/pages/dog/detail?id=${payload.data.dogId}` })
  } else if (payload.type === 'recover' && payload.data?.illnessId) {
    // 标记康复
    uni.showModal({
      title: '确认康复',
      content: `确定 ${payload.data.dogName} 已经康复了吗？`,
      success: async (res) => {
        if (res.confirm) {
          await updateIllnessStatus(payload.data.illnessId, '已康复')
          uni.showToast({ title: '已标记康复', icon: 'success' })
          // 刷新首页
          await Promise.all([loadTodayCards(), loadWeekCache(), loadDateCounts()])
        }
      },
    })
  } else if (payload.type === 'update_status' && payload.data?.illnessId) {
    // 更新治疗状态
    updateIllnessStatus(payload.data.illnessId, payload.data.status).then(() => {
      uni.showToast({ title: '已更新', icon: 'success' })
      Promise.all([loadTodayCards(), loadWeekCache(), loadDateCounts()])
    })
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
  await Promise.all([loadTodayCards(), loadWeekCache(), loadDateCounts()])
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
  viewMode.value = 'today'
  dayCards.value = []
  // 并行加载：今日卡片 + 周缓存 + 日期计数
  await Promise.all([loadTodayCards(), loadWeekCache(), loadDateCounts()])
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
</style>
