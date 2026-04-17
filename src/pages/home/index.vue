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
              <view v-if="section.groups?.length" class="section-groups">
                <view v-for="group in section.groups" :key="group.key" v-show="group.cards.length > 0" class="section-group">
                  <view class="subsection-label">
                    <text class="subsection-text">{{ group.title }}</text>
                    <view class="subsection-badge"><text class="subsection-badge-text">{{ group.cards.length }}</text></view>
                  </view>
                  <view class="card-feed">
                    <SmartCard
                      v-for="card in group.cards" :key="card.id" :card="card"
                      :completing="completingCards.has(card.id)"
                      :completed="completedCards.has(card.id)"
                      @complete="onComplete" @postpone="onPostpone"
                      @batch-complete="onBatchComplete" @batch-skip="onBatchSkip" @batch-complete-med="onBatchCompleteMed"
                      @action="onAction" @record-dose="onRecordDose"
                    />
                  </view>
                </view>
              </view>
              <view v-else class="card-feed">
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

      <!-- ===== 指定日期模式：分层列表 ===== -->
      <template v-else>
        <view v-if="dayCards.length > 0">
          <view class="section-label">
            <view class="section-dot" style="background: var(--blue);" />
            <text class="section-text">{{ formatFullDate(selectedDate) }}</text>
            <view class="section-badge"><text class="section-badge-text">{{ dayCards.length }}</text></view>
          </view>
          <view v-for="section in daySections" :key="section.key">
            <view v-if="section.cards.length > 0" class="home-section">
              <view class="section-label section-label--nested">
                <view class="section-dot" :style="{ background: section.dotColor }" />
                <text class="section-text">{{ section.title }}</text>
                <view class="section-badge"><text class="section-badge-text">{{ section.cards.length }}</text></view>
              </view>
              <view v-if="section.groups?.length" class="section-groups">
                <view v-for="group in section.groups" :key="group.key" v-show="group.cards.length > 0" class="section-group">
                  <view class="subsection-label">
                    <text class="subsection-text">{{ group.title }}</text>
                    <view class="subsection-badge"><text class="subsection-badge-text">{{ group.cards.length }}</text></view>
                  </view>
                  <view class="card-feed">
                    <SmartCard
                      v-for="card in group.cards" :key="card.id" :card="card"
                      :completing="completingCards.has(card.id)"
                      :completed="completedCards.has(card.id)"
                      @complete="onComplete" @postpone="onPostpone"
                      @batch-complete="onBatchComplete" @batch-skip="onBatchSkip" @batch-complete-med="onBatchCompleteMed"
                      @action="onAction" @record-dose="onRecordDose"
                    />
                  </view>
                </view>
              </view>
              <view v-else class="card-feed">
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

    <BSheet v-model:visible="showSickBatch" title="疾病批量操作">
      <view class="task-sheet">
        <view class="task-sheet__select-bar">
          <view class="task-sheet__select-toggle" @click="toggleSelectAllSickBatch">
            <view class="task-sheet__checkbox" :class="{ checked: isAllSickBatchSelected }">
              <text v-if="isAllSickBatchSelected" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text>
            </view>
            <text class="task-sheet__select-label">
              {{ isAllSickBatchSelected ? '取消全选' : '全选' }}（{{ sickBatchSelectedCount }}/{{ sickBatchList.length }}）
            </text>
          </view>
        </view>
        <scroll-view scroll-y class="task-sheet__dog-list">
          <view
            v-for="item in sickBatchList"
            :key="item.id"
            class="task-sheet__dog-item"
            @click="toggleSickBatchItem(item.id)"
          >
            <view class="task-sheet__checkbox" :class="{ checked: sickBatchSelected[item.id] }">
              <text v-if="sickBatchSelected[item.id]" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text>
            </view>
            <view class="task-sheet__dog-avatar task-sheet__dog-avatar--illness">
              <text class="material-icons-round" style="color: #fff; font-size: 14px;">sick</text>
            </view>
            <view class="task-sheet__dog-copy">
              <text class="task-sheet__dog-name-text">{{ item.name }}</text>
              <text class="task-sheet__dog-detail-text">{{ item.illness }} · {{ item.treatmentStatus || '观察中' }} · 第{{ item.daysSick || 1 }}天</text>
            </view>
          </view>
        </scroll-view>
        <view class="task-sheet__actions task-sheet__actions--triple">
          <view
            class="task-sheet__btn task-sheet__btn--sick-secondary"
            :class="{ disabled: sickBatchSelectedCount === 0 }"
            @click="confirmSickBatchAction('recover')"
          >
            <text class="task-sheet__btn-label task-sheet__btn-label--success">康复</text>
          </view>
          <view
            class="task-sheet__btn task-sheet__btn--sick-warning"
            :class="{ disabled: sickBatchSelectedCount === 0 }"
            @click="confirmSickBatchAction('update_status')"
          >
            <text class="task-sheet__btn-label task-sheet__btn-label--warning">开始治疗</text>
          </view>
          <view
            class="task-sheet__btn task-sheet__btn--sick-primary"
            :class="{ disabled: sickBatchSelectedCount === 0 }"
            @click="confirmSickBatchAction('start_medication')"
          >
            <text class="task-sheet__btn-label task-sheet__btn-label--primary">开始用药</text>
          </view>
        </view>
      </view>
    </BSheet>

    <BSheet v-model:visible="showMedBatch" title="今日用药批量操作">
      <view class="task-sheet">
        <view class="task-sheet__select-bar">
          <view class="task-sheet__select-toggle" @click="toggleSelectAllMedBatch">
            <view class="task-sheet__checkbox" :class="{ checked: isAllMedBatchSelected }">
              <text v-if="isAllMedBatchSelected" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text>
            </view>
            <text class="task-sheet__select-label">
              {{ isAllMedBatchSelected ? '取消全选' : '全选' }}（{{ medBatchSelectedCount }}/{{ medBatchList.length }}）
            </text>
          </view>
        </view>
        <scroll-view scroll-y class="task-sheet__dog-list">
          <view
            v-for="item in medBatchList"
            :key="item.id"
            class="task-sheet__dog-item"
            @click="toggleMedBatchItem(item.id)"
          >
            <view class="task-sheet__checkbox" :class="{ checked: medBatchSelected[item.id] }">
              <text v-if="medBatchSelected[item.id]" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text>
            </view>
            <view class="task-sheet__dog-avatar task-sheet__dog-avatar--plum">
              <text class="material-icons-round" style="color: #fff; font-size: 14px;">medication</text>
            </view>
            <view class="task-sheet__dog-copy">
              <text class="task-sheet__dog-name-text">{{ item.name }}</text>
              <text class="task-sheet__dog-detail-text">{{ item.detail }}</text>
            </view>
          </view>
        </scroll-view>
        <view class="task-sheet__actions">
          <view
            class="task-sheet__btn task-sheet__btn--sick-secondary"
            :class="{ disabled: medBatchRecoverCount === 0 }"
            @click="confirmMedBatchRecover"
          >
            <text class="task-sheet__btn-label task-sheet__btn-label--success">批量康复</text>
          </view>
          <view
            class="task-sheet__btn task-sheet__btn--sick-primary"
            :class="{ disabled: medBatchSelectedCount === 0 }"
            @click="confirmMedBatchComplete"
          >
            <text class="task-sheet__btn-label task-sheet__btn-label--primary">完成今日用药</text>
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
          :class="`sick-menu-item--${getSickMenuTone(item.action)}`"
          @click="onSickMenuSelect(item)"
        >
          <view class="sick-menu-item__icon-wrap" :class="`sick-menu-item__icon-wrap--${getSickMenuTone(item.action)}`">
            <text class="material-icons-round sick-menu-item__icon" :class="`sick-menu-item__icon--${getSickMenuTone(item.action)}`">{{ item.icon }}</text>
          </view>
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
import { buildHomeWorkbench } from '@/utils/homeWorkbench'

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
const todayWorkbench = computed(() => buildHomeWorkbench(cards.value, { visibleRowLimit: 4 }))
const dayWorkbench = computed(() => buildHomeWorkbench(dayCards.value, { visibleRowLimit: 4 }))
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
    key: 'reminders',
    title: '健康提醒',
    dotColor: 'var(--blue)',
    cards: dayCards.value.filter(card => card.sectionType === 'reminders' && card.priority !== 'overdue'),
  },
  {
    key: 'therapy',
    title: '今日用药',
    dotColor: 'var(--plum)',
    cards: dayCards.value.filter(card => card.sectionType === 'therapy' && card.priority !== 'overdue'),
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
    key: 'reminders',
    title: '健康提醒',
    dotColor: 'var(--blue)',
    cards: cards.value.filter(card => card.sectionType === 'reminders' && card.priority !== 'overdue'),
  },
  {
    key: 'therapy',
    title: '今日用药',
    dotColor: 'var(--plum)',
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
    key: 'breeding',
    label: '繁育',
    count: breedingCardsCount.value,
    dotColor: 'var(--amber)',
    pillClass: 'pill-amber',
  },
  {
    key: 'reminders',
    label: '健康',
    count: todaySections.value.find(section => section.key === 'reminders')?.cards.length || 0,
    dotColor: 'var(--blue)',
    pillClass: 'pill-blue',
  },
  {
    key: 'therapy',
    label: '用药',
    count: todaySections.value.find(section => section.key === 'therapy')?.cards.length || 0,
    dotColor: 'var(--plum)',
    pillClass: 'pill-plum',
  },
])

function mapWorkbenchGroupsToCards(groups: Array<{ key: string; title: string; rows: Array<{ sourceCard?: any }> }> = []) {
  return groups
    .map(group => ({
      key: group.key,
      title: group.title,
      cards: uniqueSourceCards(group.rows || []),
    }))
    .filter(group => group.cards.length > 0)
}

function uniqueSourceCards(rows: Array<{ sourceCard?: any }> = []) {
  const cardMap = new Map<string, any>()
  for (const row of rows) {
    const card = row?.sourceCard
    if (!card?.id || cardMap.has(card.id)) continue
    cardMap.set(card.id, card)
  }
  return Array.from(cardMap.values())
}

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
const showSickBatch = ref(false)
const sickBatchList = ref<Array<{ id: string; dogId: string; name: string; illness: string; treatmentStatus: string; daysSick: number; illnessId: string }>>([])
const sickBatchSelected = reactive<Record<string, boolean>>({})
const showMedBatch = ref(false)
const medBatchList = ref<Array<{ id: string; dogId: string; name: string; detail: string; medicationTaskIds: string[]; illnessId: string }>>([])
const medBatchSelected = reactive<Record<string, boolean>>({})

const batchSelectedCount = computed(() => Object.values(batchSelected).filter(Boolean).length)
const isAllSelected = computed(() => {
  const uncompleted = batchDogList.value.filter(d => !d.completed)
  return uncompleted.length > 0 && uncompleted.every(d => batchSelected[d.id])
})
const sickBatchSelectedCount = computed(() => Object.values(sickBatchSelected).filter(Boolean).length)
const isAllSickBatchSelected = computed(() => sickBatchList.value.length > 0 && sickBatchList.value.every(item => sickBatchSelected[item.id]))
const medBatchSelectedCount = computed(() => Object.values(medBatchSelected).filter(Boolean).length)
const isAllMedBatchSelected = computed(() => medBatchList.value.length > 0 && medBatchList.value.every(item => medBatchSelected[item.id]))
const medBatchRecoverCount = computed(() => medBatchList.value.filter(item => medBatchSelected[item.id] && !!item.illnessId).length)

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

function toggleSelectAllSickBatch() {
  const nextValue = !isAllSickBatchSelected.value
  sickBatchList.value.forEach((item) => {
    sickBatchSelected[item.id] = nextValue
  })
}

function toggleSickBatchItem(id: string) {
  sickBatchSelected[id] = !sickBatchSelected[id]
}

function toggleSelectAllMedBatch() {
  const nextValue = !isAllMedBatchSelected.value
  medBatchList.value.forEach((item) => {
    medBatchSelected[item.id] = nextValue
  })
}

function toggleMedBatchItem(id: string) {
  medBatchSelected[id] = !medBatchSelected[id]
}

function startOfDay(ts: number) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function getOverdueDays(dueDate?: number | null) {
  if (!dueDate) return 1
  const diff = Math.floor((startOfDay(Date.now()) - startOfDay(dueDate)) / 86400000)
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
type WeekCacheEntry = { cards: any[] }
const weekCache = ref<Record<number, WeekCacheEntry>>({})
let latestLoadToken = 0

function scrollToSection(section: string) {
  const normalized = section === 'workflow' ? 'breeding' : section
  scrollTarget.value = `section-${normalized}`
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
    const cache: Record<number, WeekCacheEntry> = {}
    for (const [k, v] of Object.entries(result.data)) {
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
    dayCards.value = weekCache.value[ts]?.cards || []
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
    const remainingTasks = card.tasks?.filter((t: any) => t._id !== taskId) || []
    if (remainingTasks.length === 0 || forceRemoveCard) {
      if (showSuccess) {
        // 完成：极短确认后退场，优先保证首页操作流畅
        markCardCompleted(card.id)
        setTimeout(() => {
          clearCardCompleted(card.id)
          markCardCompleting(card.id)
          setTimeout(() => {
            const currentIdx = list.value.findIndex(c => c.id === card.id)
            if (currentIdx >= 0) list.value.splice(currentIdx, 1)
            clearCardCompleting(card.id)
            counts.today = Math.max(0, counts.today - 1)
            dayCounts.value[startOfDay(Date.now())] = counts.today
          }, 220)
        }, 280)
      } else {
        // 推迟/跳过：直接滑出
        markCardCompleting(card.id)
        setTimeout(() => {
          const currentIdx = list.value.findIndex(c => c.id === card.id)
          if (currentIdx >= 0) list.value.splice(currentIdx, 1)
          clearCardCompleting(card.id)
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
  for (const [dayTs, entry] of Object.entries(weekCache.value)) {
    const cachedCards = entry?.cards || []
    const cardIdx = cachedCards.findIndex(c => c.tasks?.some((t: any) => t._id === taskId))
    if (cardIdx < 0) continue
    const card = cachedCards[cardIdx]
    const remaining = card.tasks?.filter((t: any) => t._id !== taskId) || []
    if (remaining.length === 0) {
      cachedCards.splice(cardIdx, 1)
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
    overdueDays: card?.priority === 'overdue' && task?.due_date ? getOverdueDays(task.due_date) : 0,
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
        markCardCompleting(card.id)
        setTimeout(() => {
          const ci = list.value.findIndex(c => c.id === card.id)
          if (ci >= 0) list.value.splice(ci, 1)
          clearCardCompleting(card.id)
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

/** 乐观移除疾病观察卡中的观察项（带淡出动画） */
function removeSickDogLocally(dogId: string, illnessId?: string) {
  const list = cards
  const idx = list.value.findIndex(c => c.cardType === 'sick_observation')
  if (idx < 0) return
  const card = list.value[idx]
  const dog = (card.dogs || []).find((d: any) => (illnessId ? d.illnessId === illnessId : d.dogId === dogId))
  if (!dog) return

  // 标记淡出动画
  dog._removing = true

  setTimeout(() => {
    const remaining = (card.dogs || []).filter((d: any) => (illnessId ? d.illnessId !== illnessId : d.dogId !== dogId))
    if (remaining.length === 0) {
      // 最后一只：整张卡片滑出
      markCardCompleting(card.id)
      setTimeout(() => {
        const ci = list.value.findIndex(c => c.id === card.id)
        if (ci >= 0) list.value.splice(ci, 1)
        clearCardCompleting(card.id)
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
type SickBatchAction = 'recover' | 'update_status' | 'start_medication'

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
  } else if (payload.type === 'show_sick_batch') {
    sickBatchList.value = (payload.data?.dogs || []).map((dog: any) => ({
      id: dog.illnessId || `${dog.dogId}-${dog.illness}-${dog._createdAt || 0}`,
      illnessId: dog.illnessId || '',
      dogId: dog.dogId,
      name: dog.dogName,
      illness: dog.illness || '生病',
      treatmentStatus: dog.treatmentStatus || '观察中',
      daysSick: dog.daysSick || 1,
    }))
    Object.keys(sickBatchSelected).forEach(key => delete sickBatchSelected[key])
    sickBatchList.value.forEach((item) => {
      sickBatchSelected[item.id] = true
    })
    showSickBatch.value = true
  } else if (payload.type === 'show_med_batch') {
    medBatchList.value = (payload.data?.dogs || []).map((dog: any, index: number) => ({
      id: dog.dogId || `med-${index}`,
      dogId: dog.dogId,
      name: dog.dogName,
      detail: [dog.illnessNames || dog.illness, dog.drugName, dog.progress].filter(Boolean).join(' · '),
      medicationTaskIds: (dog.allMedTasks || []).map((task: any) => task._id).filter(Boolean),
      illnessId: dog.illnessId || '',
    }))
    Object.keys(medBatchSelected).forEach(key => delete medBatchSelected[key])
    medBatchList.value.forEach((item) => {
      medBatchSelected[item.id] = true
    })
    showMedBatch.value = true
  } else if (payload.type === 'show_stop_confirm') {
    // 打开停止用药确认 BSheet
    stopConfirmData.value = payload.data
    showStopConfirm.value = true
  } else if (payload.type === 'recover' && payload.data?.illnessId) {
    removeSickDogLocally(payload.data.dogId, payload.data.illnessId)
    updateIllnessStatus(payload.data.illnessId, '已康复')
  } else if (payload.type === 'update_status' && payload.data?.illnessId) {
    // 就地更新状态标签（不移除行）
    const sickCard = cards.value.find(c => c.cardType === 'sick_observation')
    if (sickCard) {
      const dog = (sickCard.dogs || []).find((d: any) => d.illnessId === payload.data.illnessId)
      if (dog) dog.treatmentStatus = payload.data.status
    }
    updateIllnessStatus(payload.data.illnessId, payload.data.status)
  } else if (payload.type === 'stop_medication' && payload.data?.dogId) {
    endMedication(payload.data.dogId).then(() => loadAll())
  }
}

async function confirmMedBatchComplete() {
  const selectedItems = medBatchList.value.filter(item => medBatchSelected[item.id])
  if (selectedItems.length === 0) return
  showMedBatch.value = false

  const medIds = selectedItems.flatMap(item => item.medicationTaskIds)
  if (medIds.length > 0) {
    removeCardLocally('medication', true)
    await doBatchCompleteMedDay(medIds)
    await loadTodayCards()
  }
}

async function confirmMedBatchRecover() {
  const selectedItems = medBatchList.value.filter(item => medBatchSelected[item.id] && item.illnessId)
  if (selectedItems.length === 0) return
  showMedBatch.value = false

  await Promise.all(selectedItems.map(item => updateIllnessStatus(item.illnessId, '已康复')))
  await loadAll()
}

async function confirmSickBatchAction(action: SickBatchAction) {
  const selectedItems = sickBatchList.value.filter(item => sickBatchSelected[item.id])
  if (selectedItems.length === 0) return

  showSickBatch.value = false

  if (action === 'recover') {
    selectedItems.forEach((item) => {
      removeSickDogLocally(item.dogId, item.illnessId)
      updateIllnessStatus(item.illnessId, '已康复')
    })
    return
  }

  if (action === 'update_status') {
    const sickCard = cards.value.find(c => c.cardType === 'sick_observation')
    if (sickCard) {
      selectedItems.forEach((item) => {
        const dog = (sickCard.dogs || []).find((d: any) => d.illnessId === item.illnessId)
        if (dog) dog.treatmentStatus = '治疗中'
      })
    }
    selectedItems.forEach((item) => {
      updateIllnessStatus(item.illnessId, '治疗中')
    })
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

  const dogList = selectedItems.map(item => ({ _id: item.dogId, name: item.name }))
  const illnessParam = selectedItems.length === 1 && selectedItems[0].illnessId
    ? `&illnessRecordId=${selectedItems[0].illnessId}`
    : ''
  uni.navigateTo({ url: `/pages/record/health-medication?batchDogs=${encodeURIComponent(JSON.stringify(dogList))}${illnessParam}` })
}

function getSickMenuTone(action?: string) {
  if (action === 'recover') return 'success'
  if (action === 'start_medication') return 'plum'
  return 'illness'
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
    const illnessParam = dog.illnessId ? `&illnessRecordId=${dog.illnessId}` : ''
    uni.navigateTo({ url: `/pages/record/health-medication?batchDogs=${encodeURIComponent(JSON.stringify(dogList))}${illnessParam}` })
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
.pill-blue {
  background: var(--blue-soft);
  .pill-label, .pill-num { color: var(--blue); }
}
.pill-plum {
  background: var(--plum-soft);
  .pill-label, .pill-num { color: var(--plum); }
}

/* ==================== SECTION LABELS ==================== */
.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px 10px;
}
.section-label--nested {
  padding-top: 2px;
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

.section-groups {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.subsection-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px 6px;
}

.subsection-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
}

.subsection-badge {
  background: var(--card-dim);
  border-radius: 999px;
  padding: 1px 7px;
}

.subsection-badge-text {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
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
.task-sheet__actions--triple {
  gap: 8px;
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
  &--warning { background: var(--amber); }
  &.disabled { opacity: 0.4; pointer-events: none; }
}
.task-sheet__btn-label {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.2px;
  &--success { color: #2f8f68; }
  &--warning { color: #fff; }
  &--primary { color: #fff; }
}
.task-sheet__btn--sick-secondary {
  background: linear-gradient(180deg, rgba(72, 190, 137, 0.14), rgba(72, 190, 137, 0.08));
  border: 1px solid rgba(72, 190, 137, 0.18);
}
.task-sheet__btn--sick-warning {
  background: linear-gradient(180deg, #f3b45a, #eda342);
  box-shadow: 0 6px 14px rgba(237, 163, 66, 0.18);
}
.task-sheet__btn--sick-primary {
  background: linear-gradient(135deg, rgba(147, 102, 201, 0.96), rgba(119, 86, 188, 0.96));
  box-shadow: 0 8px 18px rgba(132, 94, 194, 0.2);
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
.task-sheet__dog-avatar--illness {
  background: linear-gradient(135deg, var(--red), #ef8d70);
}
.task-sheet__dog-avatar--plum {
  background: linear-gradient(135deg, var(--plum), #8e7de2);
}
.task-sheet__dog-copy {
  flex: 1;
  min-width: 0;
}
.task-sheet__dog-name-text {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.task-sheet__dog-detail-text {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-3);
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
.sick-menu-body { padding: 4px 0 16px; }
.sick-menu-item {
  display: flex; align-items: center; gap: 14px;
  margin: 0 12px 8px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid transparent;
  transition: transform 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease;
  &:last-child { margin-bottom: 0; }
  &:active { transform: scale(0.98); opacity: 0.9; }
  &--success {
    background: linear-gradient(180deg, rgba(72, 190, 137, 0.12), rgba(72, 190, 137, 0.06));
    border-color: rgba(72, 190, 137, 0.14);
  }
  &--illness {
    background: linear-gradient(180deg, rgba(224, 82, 82, 0.1), rgba(224, 82, 82, 0.05));
    border-color: rgba(224, 82, 82, 0.12);
  }
  &--plum {
    background: linear-gradient(180deg, rgba(147, 102, 201, 0.12), rgba(147, 102, 201, 0.06));
    border-color: rgba(132, 94, 194, 0.14);
    box-shadow: 0 8px 18px rgba(132, 94, 194, 0.08);
  }
}
.sick-menu-item__icon-wrap {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  &--success { background: rgba(72, 190, 137, 0.14); }
  &--illness { background: rgba(224, 82, 82, 0.12); }
  &--plum { background: rgba(147, 102, 201, 0.14); }
}
.sick-menu-item__icon {
  font-size: 18px;
  &--success { color: #2f8f68; }
  &--illness { color: var(--red); }
  &--plum { color: var(--plum); }
}
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
