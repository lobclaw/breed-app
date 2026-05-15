<template>
  <view class="home">
    <HomeHeader
      :greeting-text="greetingText"
      :greeting-sub-text="greetingSubText"
      :summary-pills="summaryPills"
      @scroll-section="scrollToSection"
    />

    <!-- 7天预览条 -->
    <WeekStrip
      :selected-date="selectedDate"
      :day-counts="dayCounts"
      @select="onDateSelect"
      @jump-today="jumpToToday"
      @toggle-calendar="toggleCalendar"
    />

    <BSubmitToast
      :message="submitToastMessage"
      :dismissing="submitToastClosing"
    />

    <HomeCardSections
      :view-mode="viewMode"
      :cards="cards"
      :day-cards="dayCards"
      :today-sections="todaySections"
      :day-sections="daySections"
      :loading="loading"
      :selected-date="selectedDate"
      :scroll-top="cardAreaScrollTop"
      :focused-home-card-id="focusedHomeCardId"
      :completing-card-ids="completingCards"
      :completed-card-ids="completedCards"
      @scroll="onCardAreaScroll"
      @complete="onComplete"
      @postpone="onPostpone"
      @batch-complete="onBatchComplete"
      @batch-skip="onBatchSkip"
      @batch-complete-med="onBatchCompleteMed"
      @action="onAction"
      @record-dose="onRecordDose"
    />

    <!-- 底部导航栏 -->
    <BNavBar current="home" />

    <HomeTaskSheets
      v-model:show-quick-complete="showQuickComplete"
      v-model:quick-complete-notes="quickCompleteNotes"
      v-model:show-postpone-modal="showPostponeModal"
      v-model:show-batch-complete="showBatchComplete"
      v-model:show-sick-batch="showSickBatch"
      v-model:show-med-batch="showMedBatch"
      v-model:show-breeding-action-sheet="showBreedingActionSheet"
      v-model:show-sick-menu="showSickMenu"
      v-model:show-stop-confirm="showStopConfirm"
      :quick-complete-task="quickCompleteTask"
      :quick-complete-date-str="quickCompleteDateStr"
      :postpone-task-info="postponeTaskInfo"
      :postpone-date-str="postponeDateStr"
      :postpone-quick="postponeQuick"
      :batch-complete-title="batchCompleteTitle"
      :batch-dog-list="batchDogList"
      :batch-selected="batchSelected"
      :batch-selected-count="batchSelectedCount"
      :is-all-selected="isAllSelected"
      :sick-batch-list="sickBatchList"
      :sick-batch-selected="sickBatchSelected"
      :sick-batch-selected-count="sickBatchSelectedCount"
      :is-all-sick-batch-selected="isAllSickBatchSelected"
      :med-batch-list="medBatchList"
      :med-batch-selected="medBatchSelected"
      :med-batch-selected-count="medBatchSelectedCount"
      :med-batch-recover-count="medBatchRecoverCount"
      :is-all-med-batch-selected="isAllMedBatchSelected"
      :breeding-action-card="breedingActionCard"
      :breeding-action-summary="breedingActionSummary"
      :breeding-action-stage-title="breedingActionStageTitle"
      :breeding-action-alert-danger="breedingActionAlertDanger"
      :breeding-action-items="breedingActionItems"
      :sick-menu-dog="sickMenuDog"
      :sick-menu-items="sickMenuItems"
      :stop-confirm-data="stopConfirmData"
      @open-quick-complete-date="showQuickCompleteDatePicker = true"
      @open-postpone-date="showPostponeDatePicker = true"
      @confirm-quick-complete="confirmQuickComplete"
      @set-postpone-quick="setPostponeQuick"
      @confirm-postpone="doPostpone"
      @toggle-select-all="toggleSelectAll"
      @toggle-batch-dog="toggleBatchDog"
      @confirm-batch-complete="confirmBatchComplete"
      @toggle-select-all-sick-batch="toggleSelectAllSickBatch"
      @toggle-sick-batch-item="toggleSickBatchItem"
      @confirm-sick-batch-action="confirmSickBatchAction"
      @toggle-select-all-med-batch="toggleSelectAllMedBatch"
      @toggle-med-batch-item="toggleMedBatchItem"
      @confirm-med-batch-recover="confirmMedBatchRecover"
      @confirm-med-batch-complete="confirmMedBatchComplete"
      @select-breeding-action="selectBreedingAction"
      @select-sick-menu="onSickMenuSelect"
      @confirm-stop-medication="confirmStopMedication"
    />

    <BDateTimePicker
      v-model:visible="showHomeDatePicker"
      :model-value="selectedDate"
      :day-dot-counts="dayCounts"
      date-only
      mode="date"
      value-type="timestamp"
      @calendar-range-change="onHomeCalendarRangeChange"
      @confirm="onHomeCalendarConfirm"
    />

    <BDateTimePicker
      v-model:visible="showQuickCompleteDatePicker"
      :model-value="quickCompleteDate"
      mode="date"
      value-type="timestamp"
      @confirm="onQuickCompleteDateConfirm"
    />

    <BDateTimePicker
      v-model:visible="showPostponeDatePicker"
      :model-value="postponeDate"
      mode="date"
      value-type="timestamp"
      @confirm="onPostponeDateConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, getCurrentInstance, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import WeekStrip from '@/components/week-strip/WeekStrip.vue'
import BSubmitToast from '@/components/feedback/BSubmitToast.vue'
import BNavBar from '@/components/layout/BNavBar.vue'
import BDateTimePicker from '@/components/form/BDateTimePicker.vue'
import HomeHeader from './components/HomeHeader.vue'
import HomeCardSections from './components/HomeCardSections.vue'
import HomeTaskSheets from './components/HomeTaskSheets.vue'
import { usePageSync } from '@/composables/usePageSync'
import { useTaskStore } from '@/stores/taskStore'
import { localSyncRuntime } from '@/localdb/runtime'
import { consumeSubmitFeedback } from '@/composables/useSubmitFeedback'
import type { HomeCardFocusTarget } from '@/utils/homeCardFocus'
import type { HomeBreedingActionKey } from '@/utils/homeBreedingActions'
import { openHomeBreedingAction } from '@/utils/homeBreedingActions'
import { buildHomeWorkbench } from '@/utils/homeWorkbench'
import { mapWorkbenchGroupsToCards } from './composables/homeWorkbenchSections'
import { useHomeBatchProgress } from './composables/useHomeBatchProgress'
import { useHomeFocus } from './composables/useHomeFocus'
import { useHomeSheets, type SickBatchAction } from './composables/useHomeSheets'
import { useHomeSuppression } from './composables/useHomeSuppression'
import { useHomeTaskActions } from './composables/useHomeTaskActions'
import { getBeijingDayStart, getBeijingElapsedDays } from '@/utils/date'
import { buildMedicationDetailUrl } from '@/utils/dogDetailNavigation'
import type { MedicationRouteIllnessLink } from '@/utils/recordFormRoutes'

const { hasFamily, currentFamily, isFamilyVerified, loadFamily } = useAuth()
const taskStore = useTaskStore()
usePageSync({ routePath: 'pages/home/index' })

// 首页业务卡片以 LocalDB/home snapshot 为事实源；taskStore 只承接 FAB 推荐输入。
const cards = ref<any[]>([])
const counts = reactive({
  today: 0,
  week: 0,
  month30: 0,
  hasOverdue: false,
})
const dayCards = ref<any[]>([])
const viewMode = ref<'today' | 'date'>('today')
const loading = ref(true)
const cardAreaScrollTop = ref(0)
const dayCounts = ref<Record<number, number>>({})
const submitToastMessage = ref('')
const submitToastClosing = ref(false)
let submitToastTimer: ReturnType<typeof setTimeout> | null = null
let submitToastHideTimer: ReturnType<typeof setTimeout> | null = null
const pageInstance = getCurrentInstance()
const HOME_SUBMIT_TOAST_DURATION_MS = 1800
const isHomeActive = ref(false)
const showHomeDatePicker = ref(false)

// 选中日期（0点 timestamp）
const selectedDate = ref(getBeijingDayStart(Date.now()))
const isSelectedToday = computed(() => selectedDate.value === getBeijingDayStart(Date.now()))
const todayWorkbench = computed(() => buildHomeWorkbench(cards.value, { visibleRowLimit: 2 }))
const dayWorkbench = computed(() => buildHomeWorkbench(dayCards.value, { visibleRowLimit: 2 }))
const breedingGroups = computed(() => mapWorkbenchGroupsToCards(todayWorkbench.value.sections.breeding.groups))
const breedingCardsCount = computed(() => breedingGroups.value.reduce((sum, group) => sum + group.cards.length, 0))
const dayBreedingGroups = computed(() => mapWorkbenchGroupsToCards(dayWorkbench.value.sections.breeding.groups))
const daySections = computed(() => [
  {
    key: 'breeding',
    title: '繁育流程',
    dotColor: 'var(--amber)',
    cards: dayBreedingGroups.value.flatMap(group => group.cards),
    groups: dayBreedingGroups.value,
  },
  {
    key: 'therapy',
    title: '今日用药',
    dotColor: 'var(--plum)',
    cards: dayCards.value.filter(card => card.sectionType === 'therapy' && card.priority !== 'overdue'),
  },
  {
    key: 'reminders',
    title: '健康提醒',
    dotColor: 'var(--blue)',
    cards: dayCards.value.filter(card => card.sectionType === 'reminders' && card.priority !== 'overdue'),
  },
])
const todaySections = computed(() => [
  {
    key: 'overdue',
    title: '逾期待处理',
    dotColor: 'var(--red)',
    cards: cards.value.filter(card => card.priority === 'overdue'),
  },
  {
    key: 'breeding',
    title: '繁育流程',
    dotColor: 'var(--amber)',
    cards: breedingGroups.value.flatMap(group => group.cards),
    groups: breedingGroups.value,
  },
  {
    key: 'therapy',
    title: '今日用药',
    dotColor: 'var(--plum)',
    cards: cards.value.filter(card => card.sectionType === 'therapy' && card.priority !== 'overdue'),
  },
  {
    key: 'reminders',
    title: '健康提醒',
    dotColor: 'var(--blue)',
    cards: cards.value.filter(card => card.sectionType === 'reminders' && card.priority !== 'overdue'),
  },
])
const activeSummarySections = computed(() => viewMode.value === 'today' ? todaySections.value : daySections.value)
const summaryPills = computed(() => [
  {
    key: 'overdue',
    label: '逾期',
    count: activeSummarySections.value.find(section => section.key === 'overdue')?.cards.length || 0,
    dotColor: 'var(--red)',
    pillClass: 'pill-red',
  },
  {
    key: 'breeding',
    label: '繁育',
    count: activeSummarySections.value.find(section => section.key === 'breeding')?.cards.length || 0,
    dotColor: 'var(--amber)',
    pillClass: 'pill-amber',
  },
  {
    key: 'reminders',
    label: '健康',
    count: activeSummarySections.value.find(section => section.key === 'reminders')?.cards.length || 0,
    dotColor: 'var(--blue)',
    pillClass: 'pill-blue',
  },
  {
    key: 'therapy',
    label: '用药',
    count: activeSummarySections.value.find(section => section.key === 'therapy')?.cards.length || 0,
    dotColor: 'var(--plum)',
    pillClass: 'pill-plum',
  },
])
const {
  showQuickComplete,
  quickCompleteTask,
  quickCompleteNotes,
  quickCompleteDate,
  showQuickCompleteDatePicker,
  quickCompleteDateStr,
  onQuickCompleteDateConfirm,
  showPostponeModal,
  postponeTaskId,
  postponeDate,
  postponeQuick,
  showPostponeDatePicker,
  postponeTaskInfo,
  postponeDateStr,
  setPostponeQuick,
  onPostponeDateConfirm,
  showBatchComplete,
  batchCompleteTitle,
  batchDogList,
  batchSelected,
  batchTaskIdByDogId,
  resetBatchTaskIds,
  showSickBatch,
  sickBatchList,
  sickBatchSelected,
  showMedBatch,
  medBatchList,
  medBatchSelected,
  showBreedingActionSheet,
  breedingActionCard,
  breedingActionItems,
  breedingActionStageTitle,
  breedingActionAlertDanger,
  breedingActionSummary,
  showSickMenu,
  sickMenuDog,
  sickMenuItems,
  showStopConfirm,
  stopConfirmData,
  batchSelectedCount,
  isAllSelected,
  sickBatchSelectedCount,
  isAllSickBatchSelected,
  medBatchSelectedCount,
  isAllMedBatchSelected,
  medBatchRecoverCount,
  toggleSelectAll,
  toggleBatchDog,
  toggleSelectAllSickBatch,
  toggleSickBatchItem,
  toggleSelectAllMedBatch,
  toggleMedBatchItem,
} = useHomeSheets()

function startOfDay(ts: number) {
  return getBeijingDayStart(ts)
}

function getOverdueDays(dueDate?: number | null) {
  if (!dueDate) return 1
  const diff = getBeijingElapsedDays(dueDate, Date.now())
  return Math.max(1, diff)
}

/** 问候语（按时段） */
const greetingText = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const greetingSubText = computed(() => {
  const suffix = isSelectedToday.value ? '今日概览' : '当日安排'
  return `${formatFullDate(selectedDate.value)} · ${suffix}`
})

/** 完整日期：3月22日 周六 */
const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
function formatFullDate(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekDays[d.getDay()]}`
}

function getCurrentFamilyId() {
  return currentFamily.value?._id || ''
}

const {
  addSuppressedTasks,
  filterSuppressibleTaskIds,
  isTaskSuppressed,
  pruneSuppressedTasks,
  resetSuppressedTasks,
} = useHomeSuppression()

const {
  clearLocalBatchCardProgress,
  filterSuppressedCards,
  hydrateLocalBatchCardProgress,
  isHealthBatchCard,
  localBatchCardProgressMap,
  markBatchDogCompleted,
  pruneLocalBatchCardProgress,
  resetLocalBatchCardProgress,
  syncCardMeta,
  syncTaskStoreHomeCache,
} = useHomeBatchProgress({
  cards,
  counts,
  getFamilyId: getCurrentFamilyId,
  isTaskSuppressed,
  taskStore,
})

async function fetchCards() {
  return localSyncRuntime.getHomeCards(getCurrentFamilyId())
}

async function fetchDateCounts(startDate: number, endDate: number) {
  return localSyncRuntime.getDateCounts(startDate, endDate, getCurrentFamilyId())
}

async function fetchWeekCards(startDate: number, endDate: number) {
  return localSyncRuntime.getWeekCards(startDate, endDate, getCurrentFamilyId())
}

async function fetchHomeSnapshot(dateCountsStartDate: number, dateCountsEndDate: number, weekStartDate: number, weekEndDate: number) {
  return localSyncRuntime.getHomeSnapshot({
    familyId: getCurrentFamilyId(),
    dateCountsStartDate,
    dateCountsEndDate,
    weekStartDate,
    weekEndDate,
  })
}

const {
  doCompleteTask,
  doPostponeTask,
  doBatchComplete,
  doBatchPostponeTask,
  doRecordMedDose,
  doBatchCompleteMedDay,
  recoverIllnesses,
  batchUpdateIllnessStatus,
  endMedication,
} = useHomeTaskActions({ getFamilyId: getCurrentFamilyId })

// 7天卡片缓存：{ [dayTimestamp]: Card[] }
type WeekCacheEntry = { cards: any[] }
const weekCache = ref<Record<number, WeekCacheEntry>>({})
const loadedDateCountRanges = new Set<string>()
let latestLoadToken = 0

type CalendarRangeChangePayload = {
  startDate: number
  endDate: number
  year: number
  month: number
}

function onCardAreaScroll(event: any) {
  cardAreaScrollTop.value = event?.detail?.scrollTop || 0
}

function scrollToSection(section: string) {
  const normalized = section === 'workflow' ? 'breeding' : section
  scrollToAnchor(`section-${normalized}`)
}

function scrollToAnchor(targetId: string) {
  if (!targetId || !pageInstance) return
  nextTick(() => {
    setTimeout(() => {
      const query = uni.createSelectorQuery().in(pageInstance)
      query.select('.card-area').boundingClientRect()
      query.select(`#${targetId}`).boundingClientRect()
      query.exec((result) => {
        const [scrollViewRect, targetRect] = result || []
        if (!scrollViewRect || !targetRect) return
        const nextTop = Math.max(0, cardAreaScrollTop.value + targetRect.top - scrollViewRect.top - 10)
        cardAreaScrollTop.value = nextTop
      })
    }, 20)
  })
}

function hydrateHomeSessionState() {
  const familyId = getCurrentFamilyId()
  if (!familyId || (taskStore.familyId && taskStore.familyId !== familyId)) {
    taskStore.clearCurrentSession()
    localBatchCardProgressMap.value = {}
    return
  }
  hydrateLocalBatchCardProgress()
}

function clearHomeForMissingFamily() {
  latestLoadToken += 1
  loadedDateCountRanges.clear()
  weekCache.value = {}
  resetLocalBatchCardProgress()
  resetSuppressedTasks()
  cards.value = []
  dayCards.value = []
  dayCounts.value = {}
  counts.today = 0
  counts.week = 0
  counts.month30 = 0
  counts.hasOverdue = false
  loading.value = false
  clearHomeCardFocus()
  taskStore.clearCurrentSession()
}

function openSickBatchFromCard(card: any) {
  sickBatchList.value = (card?.dogs || []).map((dog: any) => ({
    id: dog.illnessId || `${dog.dogId}-${dog.illness}-${dog._createdAt || 0}`,
    illnessId: dog.illnessId || '',
    dogId: dog.dogId,
    name: dog.dogName,
    illness: dog.illness || '生病',
    symptomSummary: dog.symptomSummary || '',
    treatmentStatus: dog.treatmentStatus || '观察中',
    daysSick: dog.daysSick || 1,
  }))
  Object.keys(sickBatchSelected).forEach(key => delete sickBatchSelected[key])
  sickBatchList.value.forEach((item) => {
    sickBatchSelected[item.id] = true
  })
  showSickBatch.value = true
}

function openMedBatchFromCard(card: any) {
  medBatchList.value = (card?.dogs || []).map((dog: any, index: number) => ({
    id: dog.dogId || `med-${index}`,
    dogId: dog.dogId,
    name: dog.dogName,
    detail: [dog.illnessNames || dog.illness, dog.drugName, dog.progress].filter(Boolean).join(' · '),
    medicationTaskIds: (dog.allMedTasks || []).map((task: any) => task._id).filter(Boolean),
    illnessId: dog.illnessId || '',
    illnessIds: Array.isArray(dog.illnessIds) ? dog.illnessIds.filter(Boolean) : (dog.illnessId ? [dog.illnessId] : []),
  }))
  Object.keys(medBatchSelected).forEach(key => delete medBatchSelected[key])
  medBatchList.value.forEach((item) => {
    medBatchSelected[item.id] = true
  })
  showMedBatch.value = true
}

function openHomeAggregateAction(target: HomeCardFocusTarget) {
  const targetCard = getHomeFocusCard(target)
  if (!targetCard) return false
  if (target === 'sick_observation') {
    openSickBatchFromCard(targetCard)
    return true
  }
  if (target === 'medication') {
    openMedBatchFromCard(targetCard)
    return true
  }
  return false
}

const {
  focusedHomeCardId,
  clearHomeCardFocus,
  disposeHomeFocus,
  getHomeFocusCard,
  scheduleHomeCardFocus,
} = useHomeFocus({
  cards,
  scrollToSection,
  scrollToAnchor,
  openAggregateAction: openHomeAggregateAction,
})

/** 加载今日卡片（逾期+今日合并为单列表） */
async function loadTodayCards(loadToken = latestLoadToken) {
  const hasData = cards.value.length > 0
  if (!hasData) loading.value = true

  const result = await fetchCards()
  if (loadToken !== latestLoadToken) return
  if (result) {
    pruneSuppressedTasks()
    cards.value = filterSuppressedCards(result.cards || [])
    counts.today = result.counts?.today || 0
    counts.week = result.counts?.week || 0
    counts.month30 = result.counts?.month30 || 0
    counts.hasOverdue = result.counts?.hasOverdue || false
    pruneLocalBatchCardProgress(cards.value)
    syncTaskStoreHomeCache()
    syncTodayDayCountFromVisibleCards()
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
  if (result) {
    pruneSuppressedTasks()
    const cache: Record<number, WeekCacheEntry> = {}
    for (const [k, v] of Object.entries(result)) {
      const dayData = v as { cards?: any[] }
      cache[Number(k)] = {
        cards: filterSuppressedCards(dayData.cards || []),
      }
    }
    weekCache.value = cache
  }
}

async function loadDateCounts(loadToken = latestLoadToken) {
  const DAY_MS = 86400000
  const todayTs = startOfDay(Date.now())
  // 只查询今天到本周日的范围（过去日期不显示红点）
  const end = todayTs + 7 * DAY_MS - 1
  await ensureDateCountsRange(todayTs, end, { loadToken, force: true })
}

/** 并行加载所有首页数据 */
async function loadAll() {
  const DAY_MS = 86400000
  const loadToken = ++latestLoadToken
  const todayTs = startOfDay(Date.now())
  const weekStart = todayTs + DAY_MS
  const weekEnd = todayTs + 7 * DAY_MS - 1
  const hasData = cards.value.length > 0
  if (!hasData) loading.value = true
  loadedDateCountRanges.clear()
  try {
    const result = await fetchHomeSnapshot(todayTs, weekEnd, weekStart, weekEnd)
    if (loadToken !== latestLoadToken) return
    pruneSuppressedTasks()
    if (result?.home) {
      cards.value = filterSuppressedCards(result.home.cards || [])
      counts.today = result.home.counts?.today || 0
      counts.week = result.home.counts?.week || 0
      counts.month30 = result.home.counts?.month30 || 0
      counts.hasOverdue = result.home.counts?.hasOverdue || false
      pruneLocalBatchCardProgress(cards.value)
      syncTaskStoreHomeCache()
    }
    const cache: Record<number, WeekCacheEntry> = {}
    for (const [key, value] of Object.entries(result?.weekCards || {})) {
      const dayData = value as { cards?: any[] }
      cache[Number(key)] = {
        cards: filterSuppressedCards(dayData.cards || []),
      }
    }
    weekCache.value = cache
    mergeDateCountsRange(todayTs, weekEnd, result?.dateCounts || {})
    loadedDateCountRanges.add(buildDateCountRangeKey(todayTs, weekEnd))
    syncTodayDayCountFromVisibleCards()
  } finally {
    if (loadToken === latestLoadToken) loading.value = false
  }
}

async function onDateSelect(ts: number) {
  const normalizedTs = startOfDay(ts)
  selectedDate.value = normalizedTs
  const todayTs = startOfDay(Date.now())
  if (normalizedTs === todayTs) {
    // 切回今天：显示今日模式
    viewMode.value = 'today'
    dayCards.value = []
    loading.value = false
  } else {
    const cachedEntry = weekCache.value[normalizedTs]
    viewMode.value = 'date'
    if (cachedEntry) {
      // 已缓存日期：零延迟读取
      dayCards.value = cachedEntry.cards
      loading.value = false
      return
    }

    const loadToken = latestLoadToken
    dayCards.value = []
    loading.value = true
    try {
      const result = await fetchWeekCards(normalizedTs, normalizedTs + 86400000 - 1)
      if (loadToken !== latestLoadToken || selectedDate.value !== normalizedTs) return
      pruneSuppressedTasks()
      const dayData = (result as any)?.[normalizedTs] || (result as any)?.[String(normalizedTs)]
      const cardsForDay = filterSuppressedCards(dayData?.cards || [])
      weekCache.value = {
        ...weekCache.value,
        [normalizedTs]: { cards: cardsForDay },
      }
      dayCards.value = cardsForDay
    } finally {
      if (loadToken === latestLoadToken && selectedDate.value === normalizedTs && viewMode.value === 'date') {
        loading.value = false
      }
    }
  }
}

async function refreshDayCacheFromLocal(dayTs: number) {
  const normalizedTs = startOfDay(dayTs)
  const todayTs = startOfDay(Date.now())

  if (normalizedTs === todayTs) {
    await loadTodayCards()
    return
  }

  const result = await fetchWeekCards(normalizedTs, normalizedTs + 86400000 - 1)
  pruneSuppressedTasks()
  const dayData = (result as any)?.[normalizedTs] || (result as any)?.[String(normalizedTs)]
  const cardsForDay = filterSuppressedCards(dayData?.cards || [])
  weekCache.value = {
    ...weekCache.value,
    [normalizedTs]: { cards: cardsForDay },
  }

  const nextCounts = { ...dayCounts.value }
  if (cardsForDay.length > 0) {
    nextCounts[normalizedTs] = cardsForDay.length
  } else {
    delete nextCounts[normalizedTs]
  }
  dayCounts.value = nextCounts

  if (viewMode.value === 'date' && selectedDate.value === normalizedTs) {
    dayCards.value = cardsForDay
    loading.value = false
  }
}

async function refreshWeekCacheFromLocal(extraDays: number[] = []) {
  const DAY_MS = 86400000
  const todayTs = startOfDay(Date.now())
  const start = todayTs + DAY_MS
  const end = todayTs + 7 * DAY_MS - 1
  const result = await fetchWeekCards(start, end)
  const nextCache = { ...weekCache.value }

  Object.keys(nextCache).forEach((key) => {
    const ts = Number(key)
    if (ts >= start && ts <= end) delete nextCache[ts]
  })

  pruneSuppressedTasks()
  if (result) {
    for (const [key, value] of Object.entries(result)) {
      const dayData = value as { cards?: any[] }
      nextCache[Number(key)] = {
        cards: filterSuppressedCards(dayData.cards || []),
      }
    }
  }
  weekCache.value = nextCache
  await ensureDateCountsRange(todayTs, end, { force: true })

  const extraDaySet = new Set(
    extraDays
      .map(day => startOfDay(day))
      .filter(day => day !== todayTs && (day < start || day > end)),
  )
  for (const day of extraDaySet) {
    await refreshDayCacheFromLocal(day)
  }
}

async function refreshHomeAfterLocalMutation(extraDays: number[] = []) {
  const selectedTs = selectedDate.value
  await waitForPendingCardExits()
  await loadTodayCards()
  await refreshWeekCacheFromLocal(extraDays)
  if (selectedTs !== startOfDay(Date.now())) {
    await refreshDayCacheFromLocal(selectedTs)
  }
}

function toggleCalendar() {
  showHomeDatePicker.value = true
}

function jumpToToday() {
  void onDateSelect(startOfDay(Date.now()))
}

async function onHomeCalendarRangeChange(payload: CalendarRangeChangePayload) {
  await ensureDateCountsRange(payload.startDate, payload.endDate)
}

function onHomeCalendarConfirm(value: number | string) {
  if (typeof value !== 'number') return
  const dayTs = getBeijingDayStart(value)
  const todayTs = startOfDay(Date.now())
  if (dayTs < todayTs) {
    uni.showToast({ title: '过去日期暂不可查看', icon: 'none' })
    return
  }
  void onDateSelect(dayTs)
}

function buildDateCountRangeKey(startDate: number, endDate: number) {
  return `${startDate}:${endDate}`
}

function syncTodayDayCountFromVisibleCards() {
  const todayTs = startOfDay(Date.now())
  dayCounts.value[todayTs] = cards.value.length
}

function mergeDateCountsRange(startDate: number, endDate: number, nextCounts?: Record<number, number>) {
  const merged = { ...dayCounts.value }
  Object.keys(merged).forEach((key) => {
    const ts = Number(key)
    if (ts >= startDate && ts <= endDate) {
      delete merged[ts]
    }
  })
  Object.entries(nextCounts || {}).forEach(([key, count]) => {
    const ts = Number(key)
    if (count > 0) {
      merged[ts] = count
    }
  })
  dayCounts.value = merged
}

async function ensureDateCountsRange(
  startDate: number,
  endDate: number,
  options: { loadToken?: number; force?: boolean } = {},
) {
  const todayTs = startOfDay(Date.now())
  if (endDate < todayTs) return
  const normalizedStart = Math.max(startOfDay(startDate), todayTs)
  const normalizedEnd = Math.max(normalizedStart, endDate)

  const rangeKey = buildDateCountRangeKey(normalizedStart, normalizedEnd)
  if (!options.force && loadedDateCountRanges.has(rangeKey)) return

  const result = await fetchDateCounts(normalizedStart, normalizedEnd)
  if (options.loadToken !== undefined && options.loadToken !== latestLoadToken) return

  mergeDateCountsRange(normalizedStart, normalizedEnd, result || {})
  loadedDateCountRanges.add(rangeKey)
}

function dismissSubmitToast() {
  if (submitToastTimer) clearTimeout(submitToastTimer)
  if (submitToastHideTimer) clearTimeout(submitToastHideTimer)
  if (!submitToastMessage.value) {
    submitToastClosing.value = false
    return
  }
  submitToastClosing.value = true
  submitToastHideTimer = setTimeout(() => {
    submitToastMessage.value = ''
    submitToastClosing.value = false
  }, 220)
}

function showSubmitToast(message: string) {
  submitToastMessage.value = message
  submitToastClosing.value = false
  if (submitToastTimer) clearTimeout(submitToastTimer)
  if (submitToastHideTimer) clearTimeout(submitToastHideTimer)
  submitToastTimer = setTimeout(() => {
    dismissSubmitToast()
  }, HOME_SUBMIT_TOAST_DURATION_MS)
}

// 乐观更新：标记正在消失的卡片
const completingCards = ref(new Set<string>())
const completedCards = ref(new Set<string>())
const pendingCardExitPromises = new Set<Promise<void>>()
const CARD_COMPLETE_CONFIRM_MS = 280
const CARD_EXIT_MS = 220
const SICK_ROW_EXIT_MS = 350

function trackCardExit(promise: Promise<void>) {
  pendingCardExitPromises.add(promise)
  promise.finally(() => pendingCardExitPromises.delete(promise))
  return promise
}

async function waitForPendingCardExits() {
  if (!pendingCardExitPromises.size) return
  await Promise.allSettled(Array.from(pendingCardExitPromises))
}

function markCardCompleted(cardId: string) {
  const next = new Set(completedCards.value)
  next.add(cardId)
  completedCards.value = next
}

function clearCardCompleted(cardId: string) {
  const next = new Set(completedCards.value)
  next.delete(cardId)
  completedCards.value = next
}

function markCardCompleting(cardId: string) {
  const next = new Set(completingCards.value)
  next.add(cardId)
  completingCards.value = next
}

function clearCardCompleting(cardId: string) {
  const next = new Set(completingCards.value)
  next.delete(cardId)
  completingCards.value = next
}

function removeCardLocally(taskId: string, forceRemoveCard = false, showSuccess = true) {
  const lists = [cards, dayCards]
  for (const list of lists) {
    const idx = list.value.findIndex(c => c.tasks?.some((t: any) => t._id === taskId) || c.id === taskId)
    if (idx < 0) continue
    const card = list.value[idx]
    const isBatchPartialComplete = isHealthBatchCard(card) && !forceRemoveCard
    const remainingTasks = card.tasks?.filter((t: any) => t._id !== taskId) || []
    if (remainingTasks.length === 0 || forceRemoveCard) {
      clearLocalBatchCardProgress(card.id)
      if (showSuccess) {
        // 完成：极短确认后退场，优先保证首页操作流畅
        markCardCompleted(card.id)
        trackCardExit(new Promise((resolve) => {
          setTimeout(() => {
            clearCardCompleted(card.id)
            markCardCompleting(card.id)
            setTimeout(() => {
              const currentIdx = list.value.findIndex(c => c.id === card.id)
              if (currentIdx >= 0) {
                list.value.splice(currentIdx, 1)
                counts.today = Math.max(0, counts.today - 1)
                syncTodayDayCountFromVisibleCards()
              }
              clearCardCompleting(card.id)
              resolve()
            }, CARD_EXIT_MS)
          }, CARD_COMPLETE_CONFIRM_MS)
        }))
      } else {
        // 推迟/跳过：直接滑出
        markCardCompleting(card.id)
        trackCardExit(new Promise((resolve) => {
          setTimeout(() => {
            const currentIdx = list.value.findIndex(c => c.id === card.id)
            if (currentIdx >= 0) {
              list.value.splice(currentIdx, 1)
              counts.today = Math.max(0, counts.today - 1)
              syncTodayDayCountFromVisibleCards()
            }
            clearCardCompleting(card.id)
            resolve()
          }, CARD_EXIT_MS)
        }))
      }
    } else {
      if (isBatchPartialComplete) markBatchDogCompleted(card, taskId)
      syncCardMeta(card, remainingTasks)
    }
    break
  }
  syncWeekCache(taskId)
  syncTaskStoreHomeCache()
}

/** 从 weekCache 中移除指定 task */
function syncWeekCache(taskId: string) {
  for (const [dayTs, entry] of Object.entries(weekCache.value)) {
    const cachedCards = entry?.cards || []
    const cardIdx = cachedCards.findIndex(c => c.tasks?.some((t: any) => t._id === taskId))
    if (cardIdx < 0) continue
    const card = cachedCards[cardIdx]
    const isBatchPartialComplete = isHealthBatchCard(card)
    const remaining = card.tasks?.filter((t: any) => t._id !== taskId) || []
    if (remaining.length === 0) {
      clearLocalBatchCardProgress(card.id)
      cachedCards.splice(cardIdx, 1)
    } else {
      if (isBatchPartialComplete) markBatchDogCompleted(card, taskId)
      syncCardMeta(card, remaining)
    }
    // 更新 dayCounts
    const ts = Number(dayTs)
    if (remaining.length === 0 && dayCounts.value[ts]) {
      dayCounts.value[ts] = Math.max(0, dayCounts.value[ts] - 1)
    }
    break
  }
}

function isMedicationTaskPending(task: any) {
  const frequency = Number(task?.details?.frequency || 1)
  const dosesGiven = Number(task?.doses_given || 0)
  return task?.status !== 'completed' && dosesGiven < frequency
}

function patchMedicationCards(
  updater: (card: any) => { nextCard?: any; removeCard?: boolean } | null,
) {
  let shouldRemoveCard = false

  for (const list of [cards, dayCards]) {
    const idx = list.value.findIndex(card => card.cardType === 'medication')
    if (idx < 0) continue
    const currentCard = list.value[idx]
    const result = updater(currentCard)
    if (!result) continue
    if (result.removeCard) {
      shouldRemoveCard = true
      continue
    }
    if (result.nextCard) {
      list.value[idx] = result.nextCard
    }
  }

  if (shouldRemoveCard) {
    removeCardLocally('medication', true)
  }
}

function markMedicationTasksCompletedLocally(medicationTaskIds: string[] = []) {
  const taskIdSet = new Set(medicationTaskIds.filter(Boolean))
  if (!taskIdSet.size) return

  patchMedicationCards((card) => {
    let touched = false
    const nextDogs = (card.dogs || []).map((dog: any) => {
      const allMedTasks = Array.isArray(dog.allMedTasks) ? dog.allMedTasks : []
      const nextTasks = allMedTasks.map((task: any) => {
        if (!taskIdSet.has(task._id)) return task
        touched = true
        return {
          ...task,
          doses_given: Number(task?.details?.frequency || 1),
          status: 'completed',
        }
      })
      if (nextTasks === allMedTasks) return dog
      return {
        ...dog,
        completed: nextTasks.every((task: any) => !isMedicationTaskPending(task)),
        allMedTasks: nextTasks,
      }
    })

    if (!touched) return null

    const nextCard = {
      ...card,
      dogs: nextDogs,
      medicationTaskIds: (card.medicationTaskIds || []).filter((id: string) => !taskIdSet.has(id)),
    }
    const hasPendingMedication = nextDogs.some((dog: any) =>
      (dog.allMedTasks || []).some((task: any) => isMedicationTaskPending(task)),
    )

    return hasPendingMedication ? { nextCard } : { removeCard: true }
  })
}

function removeMedicationDogsLocally(dogIds: string[] = []) {
  const dogIdSet = new Set(dogIds.filter(Boolean))
  if (!dogIdSet.size) return

  patchMedicationCards((card) => {
    const currentDogs = Array.isArray(card.dogs) ? card.dogs : []
    const nextDogs = currentDogs.filter((dog: any) => !dogIdSet.has(dog.dogId))
    if (nextDogs.length === currentDogs.length) return null

    const nextMedicationTaskIds = nextDogs.flatMap((dog: any) =>
      (dog.allMedTasks || [])
        .filter((task: any) => isMedicationTaskPending(task))
        .map((task: any) => task._id)
        .filter(Boolean),
    )

    if (nextDogs.length === 0 || nextMedicationTaskIds.length === 0) {
      return { removeCard: true }
    }

    return {
      nextCard: {
        ...card,
        dogs: nextDogs,
        medicationTaskIds: nextMedicationTaskIds,
      },
    }
  })
}

function updateSickDogsStatusLocally(illnessIds: string[] = [], status = '治疗中') {
  const illnessIdSet = new Set(illnessIds.filter(Boolean))
  if (!illnessIdSet.size) return

  const sickCard = cards.value.find(card => card.cardType === 'sick_observation')
  if (!sickCard) return
  ;(sickCard.dogs || []).forEach((dog: any) => {
    if (illnessIdSet.has(dog.illnessId)) {
      dog.treatmentStatus = status
    }
  })
}

async function onComplete(taskId: string, mode?: boolean | string) {
  const completeAndRefresh = async (autoRecord = false) => {
    const result = await doCompleteTask(taskId, autoRecord)
    if (!result) {
      await loadTodayCards()
      return
    }
    addSuppressedTasks(result?.data?.completedTaskIds || [taskId])
    await refreshHomeAfterLocalMutation()
  }

  // 批量卡片全部勾完
  if (mode === true) {
    removeCardLocally(taskId)
    await completeAndRefresh()
    return
  }
  // 批量卡片部分勾选
  if (mode === false) {
    await completeAndRefresh()
    return
  }
  if (mode === 'batch-auto') {
    removeCardLocally(taskId, true)
    await completeAndRefresh(true)
    return
  }
  if (mode === 'batch-auto-partial') {
    const result = await doCompleteTask(taskId, true)
    if (!result) {
      await loadTodayCards()
      return
    }
    removeCardLocally(taskId, false, false)
    addSuppressedTasks(result?.data?.completedTaskIds || [taskId])
    await refreshHomeAfterLocalMutation()
    return
  }
  // DogCard "完成" (mode='auto'): 一键完成 + 自动创建记录
  if (mode === 'auto') {
    removeCardLocally(taskId)
    await completeAndRefresh(true)
    return
  }
  // DogCard "跳过" (mode='skip'): 仅标记 done，不创建记录
  if (mode === 'skip') {
    removeCardLocally(taskId, false, false)
    await completeAndRefresh()
    return
  }
  // 兜底
  removeCardLocally(taskId)
  await completeAndRefresh()
}

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
    overdueDays: card?.priority === 'overdue' && task?.due_date ? getOverdueDays(task.due_date) : 0,
  }
  showPostponeModal.value = true
}

async function doPostpone() {
  const taskIds = postponeTaskId.value
  showPostponeModal.value = false

  const ids = Array.isArray(taskIds) ? taskIds : [taskIds]
  const targetDayTs = startOfDay(postponeDate.value)

  if (ids.length > 1) {
    // 批量推迟：找到卡片直接整张移除
    const lists = [cards, dayCards]
    for (const list of lists) {
      const idx = list.value.findIndex(c => c.tasks?.some((t: any) => ids.includes(t._id)))
      if (idx >= 0) {
        const card = list.value[idx]
        markCardCompleting(card.id)
        trackCardExit(new Promise((resolve) => {
          setTimeout(() => {
            const ci = list.value.findIndex(c => c.id === card.id)
            if (ci >= 0) {
              list.value.splice(ci, 1)
              counts.today = Math.max(0, counts.today - 1)
              syncTodayDayCountFromVisibleCards()
            }
            clearCardCompleting(card.id)
            resolve()
          }, 450)
        }))
        break
      }
    }
    // 同步 weekCache（只用第一条 ID 定位卡片，避免重复减计数）
    syncWeekCache(ids[0])
  } else {
    // 单条推迟
    removeCardLocally(ids[0], false, false)
  }

  // 后台静默调接口
  let result: any = null
  if (ids.length > 1) {
    result = await doBatchPostponeTask(ids, postponeDate.value)
  } else if (ids[0]) {
    result = await doPostponeTask(ids[0], postponeDate.value)
  }

  if (!result) {
    await loadTodayCards()
    return
  }

  await refreshHomeAfterLocalMutation([targetDayTs])
}

async function onBatchComplete(payload: any) {
  // 打开批量完成 Sheet (H-5)
  if (payload && payload.dogs) {
    batchCompleteTitle.value = payload.title || '批量完成'
    resetBatchTaskIds((payload.dogs || []).reduce((map: Record<string, string>, dog: any) => {
      if (dog?.id && dog?.taskId) map[dog.id] = dog.taskId
      return map
    }, {}))
    batchDogList.value = (payload.dogs || []).map((dog: any) => ({
      ...dog,
      taskId: dog?.taskId || batchTaskIdByDogId[dog?.id] || '',
    }))
    Object.keys(batchSelected).forEach(k => delete batchSelected[k])
    batchDogList.value.forEach((d: any) => {
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
  const result = await doBatchComplete(taskIds, autoRecord)
  if (!result) {
    await loadTodayCards()
    return
  }
  addSuppressedTasks(result?.data?.completedTaskIds || taskIds)
  await refreshHomeAfterLocalMutation()
}

async function onBatchSkip(taskIds: string[]) {
  if (taskIds.length > 0) removeCardLocally(taskIds[0], true, false)
  const result = await doBatchComplete(taskIds)
  if (!result) {
    await loadTodayCards()
    return
  }
  addSuppressedTasks(result?.data?.completedTaskIds || taskIds)
  await refreshHomeAfterLocalMutation()
}

async function onRecordDose({ medicationTaskId }: { medicationTaskId: string }) {
  const result = await doRecordMedDose(medicationTaskId)
  if (!result) {
    await loadTodayCards()
    return
  }
  if (result?.data?.completed || result?.data?.allComplete) {
    await refreshHomeAfterLocalMutation()
  }
}

async function onBatchCompleteMed(medicationTaskIds: string[]) {
  if (medicationTaskIds.length === 0) return
  markMedicationTasksCompletedLocally(medicationTaskIds)
  const result = await doBatchCompleteMedDay(medicationTaskIds)
  if (!result) {
    await loadTodayCards()
    return
  }
  const completedMedicationTaskIds = result?.data?.completedMedicationTaskIds || medicationTaskIds
  const fullyCompletedMedicationTaskIds = result?.data?.fullyCompletedMedicationTaskIds || []
  if (
    completedMedicationTaskIds.length !== medicationTaskIds.length
    || fullyCompletedMedicationTaskIds.length > 0
  ) {
    await refreshHomeAfterLocalMutation()
    return
  }
  await refreshHomeAfterLocalMutation()
}

function applyHomeFeedback(payload: any) {
  addSuppressedTasks(filterSuppressibleTaskIds(payload?.suppressTaskIds || payload?.completedTaskIds || []))
  const shouldKeepBreedingCardInPlace = payload?.homeSection === 'breeding'
    && typeof payload?.homeAnchorKey === 'string'
    && payload.homeAnchorKey.startsWith('breeding-step:')

  if (payload?.completedTaskIds?.length && !shouldKeepBreedingCardInPlace) {
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

/** 乐观移除疾病观察卡中的观察项（带淡出动画） */
function removeSickDogLocally(dogId: string, illnessId?: string) {
  const list = cards
  const idx = list.value.findIndex(c => c.cardType === 'sick_observation')
  if (idx < 0) return
  const card = list.value[idx]
  const currentDogs = Array.isArray(card.dogs) ? card.dogs : []
  let touched = false
  const nextDogs = currentDogs.map((dog: any) => {
    if (!(illnessId ? dog.illnessId === illnessId : dog.dogId === dogId)) return dog
    touched = true
    return { ...dog, _removing: true }
  })
  if (!touched) return

  // 标记淡出动画
  list.value[idx] = { ...card, dogs: nextDogs }

  trackCardExit(new Promise((resolve) => {
    setTimeout(() => {
      const currentIdx = list.value.findIndex(c => c.id === card.id)
      if (currentIdx < 0) {
        resolve()
        return
      }
      const currentCard = list.value[currentIdx]
      const remaining = (currentCard.dogs || []).filter((dog: any) => (
        illnessId ? dog.illnessId !== illnessId : dog.dogId !== dogId
      ))
      if (remaining.length === 0) {
        // 最后一只：整张卡片滑出
        markCardCompleting(currentCard.id)
        setTimeout(() => {
          const ci = list.value.findIndex(c => c.id === currentCard.id)
          if (ci >= 0) {
            list.value.splice(ci, 1)
            counts.today = Math.max(0, counts.today - 1)
            syncTodayDayCountFromVisibleCards()
            syncTaskStoreHomeCache()
          }
          clearCardCompleting(currentCard.id)
          resolve()
        }, CARD_EXIT_MS)
      } else {
        list.value[currentIdx] = { ...currentCard, dogs: remaining }
        syncTaskStoreHomeCache()
        resolve()
      }
    }, SICK_ROW_EXIT_MS)
  }))
}

function selectBreedingAction(actionKey: HomeBreedingActionKey) {
  const card = breedingActionCard.value
  showBreedingActionSheet.value = false
  if (!card) return
  openHomeBreedingAction(card, actionKey)
}

function onAction(payload: { type: string; data: any }) {
  if (payload.type === 'viewDog' && payload.data?.dogId) {
    uni.navigateTo({ url: `/pages/dog/detail?id=${payload.data.dogId}` })
  } else if (payload.type === 'show_breeding_actions' && payload.data?.card) {
    breedingActionCard.value = payload.data.card
    showBreedingActionSheet.value = true
  } else if (payload.type === 'show_sick_menu') {
    // 打开操作菜单 BSheet
    sickMenuDog.value = payload.data.dog
    sickMenuItems.value = payload.data.items
    showSickMenu.value = true
  } else if (payload.type === 'show_sick_batch') {
    openSickBatchFromCard({ dogs: payload.data?.dogs || [] })
  } else if (payload.type === 'show_med_batch') {
    openMedBatchFromCard({ dogs: payload.data?.dogs || [] })
  } else if (payload.type === 'show_stop_confirm') {
    // 打开停止用药确认 BSheet
    stopConfirmData.value = payload.data
    showStopConfirm.value = true
  } else if (payload.type === 'recover') {
    const rawIllnessIds: unknown[] = [
      ...(Array.isArray(payload.data?.illnessIds) ? payload.data.illnessIds : []),
      payload.data?.illnessId,
    ]
    const illnessIds: string[] = [...new Set(
      rawIllnessIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0),
    )]
    const rawMedicationTaskIds: unknown[] = Array.isArray(payload.data?.medicationTaskIds)
      ? payload.data.medicationTaskIds
      : []
    const medicationTaskIds: string[] = [...new Set(
      rawMedicationTaskIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0),
    )]
    if (!illnessIds.length) return

    if (medicationTaskIds.length > 0) {
      removeMedicationDogsLocally(payload.data?.dogId ? [payload.data.dogId] : [])
    } else {
      removeSickDogLocally(payload.data?.dogId, illnessIds[0])
    }

    void recoverIllnesses({ illnessIds, medicationTaskIds }).then(async (result) => {
      if (!result) {
        await loadTodayCards()
        return
      }
      await refreshHomeAfterLocalMutation()
    })
  } else if (payload.type === 'update_status' && payload.data?.illnessId) {
    // 就地更新状态标签（不移除行）
    updateSickDogsStatusLocally([payload.data.illnessId], payload.data.status)
    void batchUpdateIllnessStatus({ illnessIds: [payload.data.illnessId], status: payload.data.status }).then(async (result) => {
      if (!result) await loadTodayCards()
    })
  } else if (payload.type === 'stop_medication' && payload.data?.dogId) {
    endMedication(payload.data.dogId).then(async (result) => {
      if (!result) {
        return loadTodayCards()
      }
      const cancelledMedicationTaskIds = result?.data?.cancelledMedicationTaskIds || []
      if (cancelledMedicationTaskIds.length > 0) {
        removeMedicationDogsLocally([payload.data.dogId])
        await refreshHomeAfterLocalMutation()
      } else {
        return loadTodayCards()
      }
      return null
    })
  }
}

async function confirmMedBatchComplete() {
  const selectedItems = medBatchList.value.filter(item => medBatchSelected[item.id])
  if (selectedItems.length === 0) return
  showMedBatch.value = false

  const medIds = selectedItems.flatMap(item => item.medicationTaskIds)
  if (medIds.length > 0) {
    markMedicationTasksCompletedLocally(medIds)
    const result = await doBatchCompleteMedDay(medIds)
    if (!result) {
      await loadTodayCards()
      return
    }
    const completedMedicationTaskIds = result?.data?.completedMedicationTaskIds || medIds
    if (completedMedicationTaskIds.length !== medIds.length) {
      await refreshHomeAfterLocalMutation()
      return
    }
    await refreshHomeAfterLocalMutation()
  }
}

async function confirmMedBatchRecover() {
  const selectedItems = medBatchList.value.filter(item => medBatchSelected[item.id] && item.illnessIds.length > 0)
  if (selectedItems.length === 0) return
  showMedBatch.value = false

  const illnessIds = [...new Set(selectedItems.flatMap(item => item.illnessIds).filter(Boolean))]
  const medicationTaskIds = [...new Set(selectedItems.flatMap(item => item.medicationTaskIds).filter(Boolean))]

  const result = await recoverIllnesses({ illnessIds, medicationTaskIds })
  if (!result) {
    await loadTodayCards()
    return
  }
  if (result?.data?.recoveredIllnessIds?.length) {
    removeMedicationDogsLocally(selectedItems.map(item => item.dogId))
    await refreshHomeAfterLocalMutation()
  } else {
    await loadTodayCards()
  }
}

async function confirmSickBatchAction(action: SickBatchAction) {
  const selectedItems = sickBatchList.value.filter(item => sickBatchSelected[item.id])
  if (selectedItems.length === 0) return

  showSickBatch.value = false

  if (action === 'recover') {
    const illnessIds = [...new Set(selectedItems.map(item => item.illnessId).filter(Boolean))]
    selectedItems.forEach((item) => {
      removeSickDogLocally(item.dogId, item.illnessId)
    })
    const result = await recoverIllnesses({ illnessIds })
    if (!result) {
      await loadTodayCards()
      return
    }
    await refreshHomeAfterLocalMutation()
    return
  }

  if (action === 'update_status') {
    const illnessIds = [...new Set(selectedItems.map(item => item.illnessId).filter(Boolean))]
    updateSickDogsStatusLocally(illnessIds, '治疗中')
    const result = await batchUpdateIllnessStatus({ illnessIds, status: '治疗中' })
    if (!result) await loadTodayCards()
    return
  }

  const duplicateDogIds = new Set<string>()
  const seenDogIds = new Set<string>()
  selectedItems.forEach((item) => {
    if (seenDogIds.has(item.dogId)) duplicateDogIds.add(item.dogId)
    seenDogIds.add(item.dogId)
  })
  if (duplicateDogIds.size > 0) {
    uni.showToast({ title: '同一犬多条疾病请逐条开始用药', icon: 'none' })
    return
  }

  navigateToMedicationFromIllnesses(selectedItems)
}

function onSickMenuSelect(item: any) {
  showSickMenu.value = false
  const dog = sickMenuDog.value
  if (!dog) return

  if (item.action === 'recover') {
    const rawIllnessIds: unknown[] = [
      ...(Array.isArray(dog.illnessIds) ? dog.illnessIds : []),
      dog.illnessId,
    ]
    const illnessIds: string[] = [...new Set(
      rawIllnessIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0),
    )]
    const medicationTaskIds = (dog.allMedTasks || [])
      .map((task: any) => task?._id)
      .filter(Boolean)
    onAction({
      type: 'recover',
      data: {
        dogId: dog.dogId,
        dogName: dog.dogName,
        illnessId: illnessIds[0] || '',
        illnessIds,
        medicationTaskIds,
      },
    })
  } else if (item.action === 'update_status') {
    onAction({ type: 'update_status', data: { dogId: dog.dogId, status: '治疗中', illnessId: dog.illnessId } })
  } else if (item.action === 'view_medication' && dog.linkedMedicationTaskId) {
    uni.navigateTo({ url: buildMedicationDetailUrl(dog.linkedMedicationTaskId) })
  } else if (item.action === 'start_medication') {
    navigateToMedicationFromIllnesses([{
      dogId: dog.dogId,
      name: dog.dogName,
      illnessId: dog.illnessId || '',
      illness: dog.illness || '生病',
      symptomSummary: dog.symptomSummary || '',
      treatmentStatus: dog.treatmentStatus || '观察中',
    }])
  }
}

function navigateToMedicationFromIllnesses(items: Array<{
  dogId: string
  name: string
  illnessId?: string
  illness?: string
  symptomSummary?: string
  treatmentStatus?: string
}>) {
  const dogList = items.map(item => ({ _id: item.dogId, name: item.name }))
  const illnessParam = items.length === 1 && items[0].illnessId
    ? `&illnessRecordId=${items[0].illnessId}`
    : ''
  const illnessLinks = items.reduce<MedicationRouteIllnessLink[]>((list, item) => {
    const illnessRecordId = typeof item.illnessId === 'string' ? item.illnessId.trim() : ''
    if (!illnessRecordId) return list

    list.push({
      dogId: item.dogId,
      illnessRecordId,
      primaryCondition: item.illness || '生病',
      symptomSummary: item.symptomSummary || '',
      treatmentStatus: item.treatmentStatus || '观察中',
    })
    return list
  }, [])
  const illnessLinksParam = illnessLinks.length > 1
    ? `&illnessLinks=${encodeURIComponent(JSON.stringify(illnessLinks))}`
    : ''

  uni.navigateTo({ url: `/pages/record/health-medication?batchDogs=${encodeURIComponent(JSON.stringify(dogList))}${illnessParam}${illnessLinksParam}` })
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
  const result = await doCompleteTask(taskId)
  if (!result) {
    await loadTodayCards()
  } else {
    addSuppressedTasks(result?.data?.completedTaskIds || [taskId])
    await refreshHomeAfterLocalMutation()
  }
  quickCompleteNotes.value = ''
  quickCompleteTask.value = null
}

async function confirmBatchComplete() {
  if (batchSelectedCount.value === 0) return
  const selectedIds = Object.entries(batchSelected)
    .filter(([, v]) => v)
    .map(([k]) => k)

  const taskIdsToComplete = selectedIds
    .map(id => batchTaskIdByDogId[id] || batchDogList.value.find(dog => dog.id === id)?.taskId || '')
    .filter(Boolean)
  const result = await doBatchComplete(taskIdsToComplete)
  if (!result) {
    await loadTodayCards()
    return
  }
  addSuppressedTasks(result?.data?.completedTaskIds || taskIdsToComplete)
  showBatchComplete.value = false

  if (taskIdsToComplete.length === batchDogList.value.filter(dog => !dog.completed).length) {
    if (taskIdsToComplete.length > 0) removeCardLocally(taskIdsToComplete[0], true)
  } else {
    taskIdsToComplete.forEach(taskId => removeCardLocally(taskId))
  }
  await refreshHomeAfterLocalMutation()
}

onShow(async () => {
  isHomeActive.value = true
  const pendingTarget = taskStore.consumePendingHomeTarget()
  let deferredTarget: HomeCardFocusTarget | '' = ''

  // 确保家庭信息已加载
  if (!hasFamily.value || !isFamilyVerified.value) {
    clearHomeForMissingFamily()
    const loadResult = await loadFamily()
    if (loadResult === 'error' && !hasFamily.value) {
      return
    }
  }
  // 没有家庭则跳转创建页
  if (!hasFamily.value) {
    uni.reLaunch({ url: '/pages/family/setup' })
    return
  }
  const familyId = getCurrentFamilyId()
  if (!familyId) return
  localSyncRuntime.setCurrentFamilyId(familyId)
  await localSyncRuntime.setActiveScope('home')
  const feedback = consumeSubmitFeedback('/pages/home/index')
  if (feedback?.message) {
    applyHomeFeedback(feedback)
    showSubmitToast(feedback.message)
  }
  selectedDate.value = startOfDay(Date.now())
  viewMode.value = 'today'
  dayCards.value = []
  hydrateHomeSessionState()

  if (pendingTarget) {
    if (getHomeFocusCard(pendingTarget)) {
      scheduleHomeCardFocus(pendingTarget)
    } else {
      deferredTarget = pendingTarget
    }
  }

  // 首页回到前台先读本地事实源，云端同步只做后台校正，避免表单返回后卡片延迟出现。
  await loadAll()
  void localSyncRuntime.flushOutbox(familyId)
    .then(() => localSyncRuntime.syncScope('home'))
    .then(() => {
      if (isHomeActive.value) void loadAll()
    })
  if (deferredTarget) {
    scheduleHomeCardFocus(deferredTarget)
  }
})

onHide(() => {
  isHomeActive.value = false
  disposeHomeFocus()
})

watch(() => taskStore.pendingHomeTarget, (target) => {
  if (!isHomeActive.value || !target) return
  taskStore.consumePendingHomeTarget()
  scheduleHomeCardFocus(target)
})
</script>

<style lang="scss" scoped>
/* 首页 — 一比一还原 home-v1-final.html */
.home {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

/* Sheets and card sections live in pages/home/components. */


</style>
