<template>
  <view class="page operation-log-page">
    <BPageHeader title="操作日志">
      <template #right>
        <view class="header-filter-btn primary-page-filter-action" @click="openFilterSheet">
          <text
            class="primary-page-filter-icon"
            :class="{ 'primary-page-filter-icon--active': hasActiveFilters }"
          >
            tune
          </text>
        </view>
      </template>
    </BPageHeader>

    <view v-if="activeFilterChips.length" class="active-filters">
      <view class="active-filters__clear-all" @click="clearAllFilters">
        <text>清空全部</text>
      </view>
      <scroll-view scroll-x class="active-filters__scroll" show-scrollbar="false" enhanced>
        <view class="active-filters__track">
          <view
            v-for="chip in activeFilterChips"
            :key="chip.key"
            class="active-filters__chip primary-page-applied-chip"
          >
            <text class="active-filters__chip-text primary-page-applied-chip-text">{{ chip.label }}</text>
            <text
              class="material-icons-round active-filters__chip-icon primary-page-applied-chip-icon"
              @click="clearFilterChip(chip.key)"
            >
              close
            </text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view v-if="displayLogs.length" class="timeline">
      <view v-for="group in groupedLogs" :key="group.key" class="timeline-group">
        <view class="timeline-group__header">
          <view class="timeline-group__title-wrap">
            <text class="timeline-group__title">{{ group.label }}</text>
            <text class="timeline-group__count">{{ group.items.length }} 条</text>
          </view>
        </view>

        <view class="timeline-group__list">
          <view v-for="log in group.items" :key="log._id" class="log-card">
            <view class="log-card__rail" />
            <view class="log-card__icon" :class="log.actionClass">
              <text class="material-icons-round">{{ log.actionIcon }}</text>
            </view>

            <view class="log-card__body">
              <view class="log-card__main">
                <text class="log-card__actor-inline">{{ log.actor_name }}</text>
                <text class="log-card__detail-text"> · {{ log.detail }}</text>
              </view>

              <view class="log-card__meta">
                <text class="log-card__meta-item log-card__meta-item--action">{{ log.actionLabel }}</text>
                <text v-if="log.syncStatusText" class="log-card__meta-divider">·</text>
                <text v-if="log.syncStatusText" class="log-card__meta-item" :class="`log-card__meta-item--sync log-card__meta-item--sync-${log.syncStatusTone}`">{{ log.syncStatusText }}</text>
                <text v-if="log.target_name" class="log-card__meta-divider">·</text>
                <text v-if="log.target_name" class="log-card__meta-item log-card__meta-item--target">{{ log.target_name }}</text>
                <text class="log-card__meta-divider">·</text>
                <text class="log-card__meta-item log-card__meta-item--time">{{ log.time_text }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="loadingMore && displayLogs.length" class="log-list log-list--append">
      <view class="timeline-group">
        <view class="timeline-group__list">
          <view v-for="index in 2" :key="`append-${index}`" class="log-item log-item--skeleton">
            <view class="log-card__rail" />
            <view class="log-icon log-icon--skeleton log-skeleton__shimmer" />
            <view class="log-card__body">
              <view class="log-skeleton__line log-skeleton__line--main log-skeleton__shimmer" />
              <view class="log-skeleton__line log-skeleton__line--meta log-skeleton__shimmer" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="hasMore && displayLogs.length && !loadingMore" class="load-more" @click="loadMore">
      <text>加载更多</text>
    </view>

    <view v-if="!displayLogs.length && !loading" class="empty-state">
      <view class="empty-state__icon-wrap">
        <text class="material-icons-round empty-state__icon">history</text>
      </view>
      <text class="empty-state__title">还没有操作记录</text>
      <text class="empty-state__desc">当前筛选范围内暂无日志，可尝试放宽时间或其他筛选条件。</text>
      <view v-if="hasActiveFilters" class="empty-state__action" @click="clearAllFilters">
        <text class="empty-state__action-text">清空筛选</text>
      </view>
    </view>

    <view v-if="loading && !displayLogs.length" class="log-list">
      <view class="timeline-group">
        <view class="timeline-group__list">
          <view v-for="index in 4" :key="`loading-${index}`" class="log-item log-item--skeleton">
            <view class="log-card__rail" />
            <view class="log-icon log-icon--skeleton log-skeleton__shimmer" />
            <view class="log-card__body">
              <view class="log-skeleton__line log-skeleton__line--main log-skeleton__shimmer" />
              <view class="log-skeleton__line log-skeleton__line--meta log-skeleton__shimmer" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <BSheet v-model:visible="showFilterSheet" title="筛选日志" height="78%">
      <view class="filter-sheet">
        <view class="filter-sheet__hero">
          <text class="filter-sheet__eyebrow">多条件组合筛选</text>
          <text class="filter-sheet__hint">按时间、成员和操作类型快速定位日志记录</text>
        </view>

        <view class="filter-sheet__content">
          <view class="filter-section filter-section--card">
            <view class="filter-section__head">
              <text class="filter-section__title">时间范围</text>
              <text v-if="draftDateRange !== 'all'" class="filter-section__meta">{{ dateRangeLabelMap[draftDateRange] }}</text>
            </view>
            <view class="filter-chip-row">
              <view
                v-for="option in dateRangeOptions"
                :key="option.value"
                class="filter-chip filter-chip--segment"
                :class="{ 'filter-chip--active': draftDateRange === option.value }"
                @click="setDraftDateRange(option.value)"
              >
                <text>{{ option.label }}</text>
              </view>
            </view>

            <view v-if="draftDateRange === 'custom'" class="custom-date-row">
              <view class="custom-date-card" @click="showDraftStartDatePicker = true">
                <text class="custom-date-card__label">开始日期</text>
                <text class="custom-date-card__value">{{ draftStartDateStr || '请选择' }}</text>
              </view>
              <view class="custom-date-card" @click="showDraftEndDatePicker = true">
                <text class="custom-date-card__label">结束日期</text>
                <text class="custom-date-card__value">{{ draftEndDateStr || '请选择' }}</text>
              </view>
            </view>
          </view>

          <view class="filter-section filter-section--card">
            <view class="filter-section__head">
              <text class="filter-section__title">成员</text>
              <text v-if="draftMemberIds.length" class="filter-section__meta">{{ draftMemberIds.length }} 项已选</text>
            </view>
            <text class="filter-section__helper">支持多选，不选默认查看全部成员</text>
            <view v-if="memberFilterOptions.length" class="filter-chip-row">
              <view
                v-for="item in memberFilterOptions"
                :key="item.value"
                class="filter-chip filter-chip--segment filter-chip--segment-compact"
                :class="{ 'filter-chip--active': draftMemberIds.includes(item.value) }"
                @click="toggleDraftMember(item.value)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
            <text v-else class="filter-section__empty">当前暂无可筛选成员</text>
          </view>

          <view class="filter-section filter-section--card">
            <view class="filter-section__head">
              <text class="filter-section__title">操作</text>
              <text v-if="draftActionTypes.length" class="filter-section__meta">{{ draftActionTypes.length }} 项已选</text>
            </view>
            <text class="filter-section__helper">支持多选，不选默认查看全部操作</text>
            <view class="filter-chip-row">
              <view
                v-for="item in actionFilterOptions"
                :key="item.value"
                class="filter-chip filter-chip--segment filter-chip--segment-compact"
                :class="{ 'filter-chip--active': draftActionTypes.includes(item.value) }"
                @click="toggleDraftAction(item.value)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <template #footer>
        <view class="filter-actions filter-actions--sheet-footer">
          <button class="filter-actions__reset" @click="resetDraftFilters">重置</button>
          <button class="filter-actions__apply" :disabled="!canApplyDraftFilters" @click="applyDraftFilters">应用筛选</button>
        </view>
      </template>
    </BSheet>

    <BDateTimePicker
      v-model:visible="showDraftStartDatePicker"
      :model-value="draftCustomStartDate"
      mode="date"
      value-type="timestamp"
      :date-only="true"
      @confirm="onDraftDateConfirm('start', $event)"
    />

    <BDateTimePicker
      v-model:visible="showDraftEndDatePicker"
      :model-value="draftCustomEndDate"
      mode="date"
      value-type="timestamp"
      :date-only="true"
      @confirm="onDraftDateConfirm('end', $event)"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onReachBottom } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { useAuth } from '@/composables/useAuth'
import { getLocalOperationStatusText } from '@/localdb/local-operation-log'
import { localSyncRuntime } from '@/localdb/runtime'
import { mergeOperationLogs } from '@/utils/operationLogMerge'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BDateTimePicker from '@/components/form/BDateTimePicker.vue'

type LogDateRangeValue = 'all' | 'today' | 'this_week' | 'this_month' | 'custom'
type ActiveFilterChipKey = 'dateRange' | 'members' | 'actions'

interface FilterOption {
  label: string
  value: string
}

interface LogItem {
  _id: string
  actor_user_id: string
  actor_name: string
  action_type: string
  actionLabel: string
  detail: string
  target_name: string
  time_text: string
  actionClass: string
  actionIcon: string
  groupKey: string
  groupLabel: string
  created_at: number
  target_type?: string
  target_id?: string
  summary?: string
  clientMutationId?: string
  syncStatusText?: string
  syncStatusTone?: 'amber' | 'green' | 'red' | 'blue'
}

interface LogGroup {
  key: string
  label: string
  items: LogItem[]
}

const loading = ref(false)
const loadingMore = ref(false)
const logs = ref<LogItem[]>([])
const localLogs = ref<LogItem[]>([])
const hasMore = ref(false)
const page = ref(1)
const pageSize = 20

const activeDateRange = ref<LogDateRangeValue>('all')
const activeMemberIds = ref<string[]>([])
const activeActionTypes = ref<string[]>([])
const activeCustomStartDate = ref(startOfDay(Date.now()))
const activeCustomEndDate = ref(endOfDay(Date.now()))

const draftDateRange = ref<LogDateRangeValue>('all')
const draftMemberIds = ref<string[]>([])
const draftActionTypes = ref<string[]>([])
const draftCustomStartDate = ref(startOfDay(Date.now()))
const draftCustomEndDate = ref(endOfDay(Date.now()))

const showFilterSheet = ref(false)
const showDraftStartDatePicker = ref(false)
const showDraftEndDatePicker = ref(false)

const { currentFamily } = useAuth()

const dateRangeOptions: Array<{ label: string; value: LogDateRangeValue }> = [
  { label: '全部', value: 'all' },
  { label: '今天', value: 'today' },
  { label: '本周', value: 'this_week' },
  { label: '本月', value: 'this_month' },
  { label: '自定义', value: 'custom' },
]

const dateRangeLabelMap: Record<LogDateRangeValue, string> = {
  all: '全部',
  today: '今天',
  this_week: '本周',
  this_month: '本月',
  custom: '自定义时间',
}

const actionIcons: Record<string, string> = {
  create: 'add_circle',
  update: 'edit',
  delete: 'delete',
  complete: 'task_alt',
  restore: 'restore_from_trash',
  join: 'group_add',
  invite: 'share',
  role_change: 'swap_horiz',
  status_change: 'flag',
  postpone: 'event_repeat',
}

const actionLabels: Record<string, string> = {
  create: '新增',
  update: '更新',
  delete: '删除',
  complete: '完成',
  restore: '恢复',
  join: '加入',
  invite: '邀请',
  role_change: '角色变更',
  status_change: '状态变更',
  postpone: '推迟',
}

const actionClasses: Record<string, string> = {
  create: 'icon-green',
  update: 'icon-blue',
  delete: 'icon-red',
  complete: 'icon-green',
  restore: 'icon-teal',
  join: 'icon-green',
  invite: 'icon-amber',
  role_change: 'icon-blue',
  status_change: 'icon-amber',
  postpone: 'icon-amber',
}

const actionFilterOptions: FilterOption[] = [
  { label: '新增', value: 'create' },
  { label: '更新', value: 'update' },
  { label: '删除', value: 'delete' },
  { label: '完成', value: 'complete' },
  { label: '恢复', value: 'restore' },
  { label: '加入', value: 'join' },
  { label: '邀请', value: 'invite' },
  { label: '角色变更', value: 'role_change' },
  { label: '状态变更', value: 'status_change' },
  { label: '推迟', value: 'postpone' },
]

const memberFilterOptions = computed<FilterOption[]>(() => {
  return (currentFamily.value?.members || [])
    .filter(member => member.status === 'active')
    .map(member => ({
      label: member.nickname || member.user_id,
      value: member.user_id,
    }))
})

const hasActiveFilters = computed(() => {
  return activeDateRange.value !== 'all'
    || activeMemberIds.value.length > 0
    || activeActionTypes.value.length > 0
})

const activeFilterChips = computed<Array<{ key: ActiveFilterChipKey; label: string }>>(() => {
  const chips: Array<{ key: ActiveFilterChipKey; label: string }> = []
  if (activeDateRange.value !== 'all') {
    chips.push({ key: 'dateRange', label: dateRangeLabelMap[activeDateRange.value] })
  }
  if (activeMemberIds.value.length) {
    chips.push({ key: 'members', label: `成员 ${activeMemberIds.value.length}项` })
  }
  if (activeActionTypes.value.length) {
    chips.push({ key: 'actions', label: `操作 ${activeActionTypes.value.length}项` })
  }
  return chips
})

const groupedLogs = computed<LogGroup[]>(() => {
  const groups: LogGroup[] = []

  displayLogs.value.forEach((log) => {
    const lastGroup = groups[groups.length - 1]
    if (!lastGroup || lastGroup.key !== log.groupKey) {
      groups.push({
        key: log.groupKey,
        label: log.groupLabel,
        items: [log],
      })
      return
    }

    lastGroup.items.push(log)
  })

  return groups
})

const displayLogs = computed(() => {
  return mergeOperationLogs(localLogs.value, logs.value)
})

const draftStartDateStr = computed(() => formatDateInput(draftCustomStartDate.value))
const draftEndDateStr = computed(() => formatDateInput(draftCustomEndDate.value))

const canApplyDraftFilters = computed(() => {
  if (draftDateRange.value !== 'custom') return true
  return Boolean(draftCustomStartDate.value)
    && Boolean(draftCustomEndDate.value)
    && draftCustomEndDate.value >= draftCustomStartDate.value
})

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeSelection(values: string[]): string[] {
  return dedupe(values).sort()
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((item, index) => item === right[index])
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime()
}

function endOfDay(timestamp: number): number {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime()
}

function getTodayRange() {
  const now = Date.now()
  return {
    start: startOfDay(now),
    end: now,
  }
}

function getWeekRange() {
  const now = new Date()
  const day = now.getDay() || 7
  return {
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1, 0, 0, 0, 0).getTime(),
    end: Date.now(),
  }
}

function getMonthRange() {
  const now = new Date()
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime(),
    end: Date.now(),
  }
}

function getFilterRange(range: LogDateRangeValue, customStartDate: number, customEndDate: number): { start: number; end: number } {
  if (range === 'today') return getTodayRange()
  if (range === 'this_week') return getWeekRange()
  if (range === 'this_month') return getMonthRange()
  if (range === 'custom') {
    return {
      start: startOfDay(customStartDate),
      end: endOfDay(customEndDate),
    }
  }

  return {
    start: 0,
    end: Date.now(),
  }
}

function formatDateInput(timestamp: number) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatClock(timestamp: number): string {
  const d = new Date(timestamp)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function getDateKey(timestamp: number): string {
  const d = new Date(timestamp)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}

function formatGroupLabel(timestamp: number): string {
  const now = new Date()
  const todayKey = getDateKey(now.getTime())
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const yesterdayKey = getDateKey(yesterday.getTime())
  const currentKey = getDateKey(timestamp)

  if (currentKey === todayKey) return '今天'
  if (currentKey === yesterdayKey) return '昨天'

  const d = new Date(timestamp)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function buildLogDetail(raw: Record<string, any>): string {
  const summary = String(raw.summary || '').trim()
  const actorName = String(raw.actor_name || '').trim()

  if (summary && actorName && summary.startsWith(actorName)) {
    return summary.slice(actorName.length).trim() || '进行了操作'
  }

  if (summary) return summary
  if (raw.target_name) return String(raw.target_name)
  return '进行了操作'
}

function resolveDisplayActorName(raw: Record<string, any>, fallback = '未知用户'): string {
  const actorUserId = String(raw.actor_user_id || '').trim()
  const actorName = String(raw.actor_name || '').trim()
  const member = (currentFamily.value?.members || []).find(item => item.user_id === actorUserId && item.status === 'active')
  const memberName = String(member?.nickname || '').trim()
  if (memberName && (!actorName || actorName === actorUserId)) return memberName
  return actorName || memberName || fallback
}

function processLog(raw: Record<string, any>): LogItem {
  const action = String(raw.action_type || 'update')
  const createdAt = Number(raw.created_at || Date.now())
  const clientMutationId = String(
    raw.client_mutation_id
      || raw.clientMutationId
      || raw.meta?.clientMutationId
      || raw.meta?.client_mutation_id
      || '',
  ).trim()

  return {
    _id: String(raw._id || createdAt),
    actor_user_id: String(raw.actor_user_id || ''),
    actor_name: resolveDisplayActorName(raw),
    action_type: action,
    actionLabel: actionLabels[action] || '操作',
    detail: buildLogDetail(raw),
    target_name: String(raw.target_name || ''),
    time_text: formatClock(createdAt),
    actionClass: actionClasses[action] || 'icon-blue',
    actionIcon: actionIcons[action] || 'edit',
    groupKey: getDateKey(createdAt),
    groupLabel: formatGroupLabel(createdAt),
    created_at: createdAt,
    target_type: String(raw.target_type || ''),
    target_id: String(raw.target_id || ''),
    summary: String(raw.summary || ''),
    clientMutationId,
  }
}

function processLocalLog(raw: Record<string, any>): LogItem {
  const action = String(raw.action_type || 'update')
  const createdAt = Number(raw.created_at || Date.now())
  const status = String(raw.status || 'pending')
  const clientMutationId = String(raw.client_mutation_id || raw.clientMutationId || '').trim()
  const syncStatusText = getLocalOperationStatusText(status as any)
  const syncStatusTone = status === 'failed' || status === 'conflict'
    ? 'red'
    : status === 'processing'
      ? 'blue'
      : status === 'synced'
        ? 'green'
        : 'amber'

  return {
    _id: String(raw._id || createdAt),
    actor_user_id: String(raw.actor_user_id || ''),
    actor_name: resolveDisplayActorName(raw, '我'),
    action_type: action,
    actionLabel: actionLabels[action] || '操作',
    detail: buildLogDetail(raw),
    target_name: String(raw.target_name || ''),
    time_text: formatClock(createdAt),
    actionClass: actionClasses[action] || 'icon-blue',
    actionIcon: actionIcons[action] || 'edit',
    groupKey: getDateKey(createdAt),
    groupLabel: formatGroupLabel(createdAt),
    created_at: createdAt,
    target_type: String(raw.target_type || ''),
    target_id: String(raw.target_id || ''),
    summary: String(raw.summary || ''),
    clientMutationId,
    syncStatusText,
    syncStatusTone,
  }
}

function setDraftDateRange(value: LogDateRangeValue) {
  draftDateRange.value = value
  if (value !== 'custom') return
  if (!draftCustomStartDate.value) draftCustomStartDate.value = startOfDay(Date.now())
  if (!draftCustomEndDate.value) draftCustomEndDate.value = endOfDay(Date.now())
}

function toggleDraftMember(value: string) {
  if (draftMemberIds.value.includes(value)) {
    draftMemberIds.value = draftMemberIds.value.filter(item => item !== value)
    return
  }

  draftMemberIds.value = [...draftMemberIds.value, value]
}

function toggleDraftAction(value: string) {
  if (draftActionTypes.value.includes(value)) {
    draftActionTypes.value = draftActionTypes.value.filter(item => item !== value)
    return
  }

  draftActionTypes.value = [...draftActionTypes.value, value]
}

function onDraftDateConfirm(kind: 'start' | 'end', value: number | string) {
  if (typeof value !== 'number') return
  if (kind === 'start') draftCustomStartDate.value = startOfDay(value)
  else draftCustomEndDate.value = endOfDay(value)
}

function syncDraftWithActive() {
  draftDateRange.value = activeDateRange.value
  draftMemberIds.value = [...activeMemberIds.value]
  draftActionTypes.value = [...activeActionTypes.value]
  draftCustomStartDate.value = activeCustomStartDate.value
  draftCustomEndDate.value = activeCustomEndDate.value
}

const { run: fetchLogs } = useCloudCall('family-service', 'getOperationLogs', {
  showLoading: false,
})

async function loadLogs(reset = true) {
  if (reset) {
    page.value = 1
    logs.value = []
    localLogs.value = []
    loading.value = true
  } else {
    if (loading.value || loadingMore.value || !hasMore.value) return
    loadingMore.value = true
  }

  try {
    const range = getFilterRange(activeDateRange.value, activeCustomStartDate.value, activeCustomEndDate.value)
    const familyId = currentFamily.value?._id || ''
    if (familyId) {
      const localRows = await localSyncRuntime.getLocalOperationLogs(familyId, {
        start: range.start,
        end: range.end,
        actorUserIds: activeMemberIds.value.length > 0 ? activeMemberIds.value : undefined,
        actionTypes: activeActionTypes.value.length > 0 ? activeActionTypes.value : undefined,
      })
      localLogs.value = (localRows || []).map((item: any) => processLocalLog(item))
    }
    const res = await fetchLogs({
      start: range.start,
      end: range.end,
      page: page.value,
      pageSize,
      actorUserIds: activeMemberIds.value.length > 0 ? activeMemberIds.value : undefined,
      actionTypes: activeActionTypes.value.length > 0 ? activeActionTypes.value : undefined,
    })

    if (res) {
      const data = res as Record<string, any>
      const items = ((data.list as Array<Record<string, any>>) || []).map(processLog)
      if (reset) {
        logs.value = items
      } else {
        logs.value.push(...items)
      }
      hasMore.value = Boolean(data.hasMore)
    }
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function openFilterSheet() {
  syncDraftWithActive()
  showFilterSheet.value = true
}

function resetDraftFilters() {
  draftDateRange.value = 'all'
  draftMemberIds.value = []
  draftActionTypes.value = []
  draftCustomStartDate.value = startOfDay(Date.now())
  draftCustomEndDate.value = endOfDay(Date.now())
}

function applyDraftFilters() {
  if (!canApplyDraftFilters.value) {
    uni.showToast({ title: '请先选择完整的自定义日期', icon: 'none' })
    return
  }

  const nextDateRange = draftDateRange.value
  const nextMemberIds = normalizeSelection(draftMemberIds.value)
  const nextActionTypes = normalizeSelection(draftActionTypes.value)
  const nextCustomStartDate = draftCustomStartDate.value
  const nextCustomEndDate = draftCustomEndDate.value
  const currentMemberIds = normalizeSelection(activeMemberIds.value)
  const currentActionTypes = normalizeSelection(activeActionTypes.value)

  showFilterSheet.value = false

  if (
    nextDateRange === activeDateRange.value
    && arraysEqual(nextMemberIds, currentMemberIds)
    && arraysEqual(nextActionTypes, currentActionTypes)
    && nextCustomStartDate === activeCustomStartDate.value
    && nextCustomEndDate === activeCustomEndDate.value
  ) {
    return
  }

  activeDateRange.value = nextDateRange
  activeMemberIds.value = nextMemberIds
  activeActionTypes.value = nextActionTypes
  activeCustomStartDate.value = nextCustomStartDate
  activeCustomEndDate.value = nextCustomEndDate
  loadLogs(true)
}

function clearFilterChip(key: ActiveFilterChipKey) {
  if (key === 'dateRange') {
    activeDateRange.value = 'all'
    activeCustomStartDate.value = startOfDay(Date.now())
    activeCustomEndDate.value = endOfDay(Date.now())
  }
  if (key === 'members') activeMemberIds.value = []
  if (key === 'actions') activeActionTypes.value = []
  loadLogs(true)
}

function clearAllFilters() {
  if (!hasActiveFilters.value) return
  activeDateRange.value = 'all'
  activeMemberIds.value = []
  activeActionTypes.value = []
  activeCustomStartDate.value = startOfDay(Date.now())
  activeCustomEndDate.value = endOfDay(Date.now())
  resetDraftFilters()
  loadLogs(true)
}

function loadMore() {
  if (loading.value || loadingMore.value || !hasMore.value) return
  page.value += 1
  loadLogs(false)
}

onLoad(() => {
  loadLogs(true)
})

onReachBottom(() => {
  loadMore()
})
</script>

<style lang="scss" scoped>
.operation-log-page {
  min-height: 100vh;
  background:
    linear-gradient(180deg, rgba(255, 240, 242, 0.9) 0%, var(--bg) 120px),
    var(--bg);
  padding-bottom: calc(40px + env(safe-area-inset-bottom, 0px));
}

.header-filter-btn {
  width: 40px;
  height: 40px;
  border-radius: 20px;
}

.active-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 var(--space-page) 10px;

  &__clear-all {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-2);
  }

  &__scroll {
    flex: 1;
    min-width: 0;
  }

  &__track {
    display: inline-flex;
    gap: 8px;
    padding-right: 2px;
  }

  &__chip {
    flex-shrink: 0;
  }

  &__chip-text {
    color: inherit;
  }

  &__chip-icon {
    color: inherit;
  }
}

.log-card__meta-item--sync {
  font-weight: 700;
}

.log-card__meta-item--sync-amber {
  color: var(--amber);
}

.log-card__meta-item--sync-blue {
  color: var(--blue);
}

.log-card__meta-item--sync-red {
  color: var(--red);
}

.log-card__meta-item--sync-green {
  color: var(--green);
}

.timeline {
  padding: 0 var(--space-page);

  &--append {
    padding-top: 0;
  }
}

.log-list {
  @extend .timeline;

  &--append {
    padding-top: 0;
  }
}

.timeline-group {
  margin-bottom: 14px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  &__title-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__title {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 800;
    color: var(--text-1);
    line-height: 1.2;
  }

  &__count {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-3);
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}

.log-card,
.log-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px 11px;
  border-radius: 16px;
  background: var(--card);
  box-shadow: var(--shadow);
  overflow: hidden;

  &--skeleton {
    pointer-events: none;
  }
}

.log-icon {
  position: relative;
  z-index: 1;
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.log-card {
  &__rail {
    position: absolute;
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 3px;
    border-radius: 999px;
    background: var(--primary-soft);
  }

  &__icon {
    position: relative;
    z-index: 1;
    width: 34px;
    height: 34px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .material-icons-round {
      font-size: 17px;
    }

    &.icon-green {
      background: var(--icon-green);

      .material-icons-round {
        color: var(--green);
      }
    }

    &.icon-blue {
      background: var(--icon-blue);

      .material-icons-round {
        color: var(--blue);
      }
    }

    &.icon-red {
      background: var(--icon-red);

      .material-icons-round {
        color: var(--red);
      }
    }

    &.icon-teal {
      background: var(--icon-teal);

      .material-icons-round {
        color: var(--teal);
      }
    }

    &.icon-amber {
      background: var(--icon-amber);

      .material-icons-round {
        color: var(--amber);
      }
    }

    &--skeleton {
      border-radius: 12px;
    }
  }

  &__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__main {
    min-width: 0;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.45;
    color: var(--text-1);
    word-break: break-word;
  }

  &__actor-inline {
    color: var(--primary);
  }

  &__detail-text {
    color: var(--text-1);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    flex-wrap: nowrap;
  }

  &__meta-item,
  &__meta-divider {
    font-size: 10px;
    line-height: 1.3;
    color: var(--text-3);
    flex-shrink: 0;
  }

  &__meta-item--action {
    color: var(--text-2);
    font-weight: 700;
  }

  &__meta-item--target {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  &__meta-item--time {
    font-weight: 600;
  }
}

.empty-state {
  margin: 0 var(--space-page);
  padding: 24px 20px;
  border-radius: 20px;
  background: var(--card);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;

  &__icon-wrap {
    width: 56px;
    height: 56px;
    border-radius: 18px;
    background: var(--primary-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
  }

  &__icon {
    font-size: 26px;
    color: var(--primary);
  }

  &__title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 800;
    color: var(--text-1);
    line-height: 1.3;
  }

  &__desc {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.55;
    color: var(--text-2);
  }

  &__action {
    margin-top: 16px;
    padding: 10px 16px;
    border-radius: 999px;
    background: var(--primary);
  }

  &__action-text {
    font-size: 12px;
    font-weight: 700;
    color: #FFFFFF;
  }
}

.filter-sheet {
  padding: 0 0 24px;

  &__hero {
    margin: 0 2px 14px;
    padding: 2px 0 16px;
  }

  &__eyebrow {
    display: block;
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--primary);
  }

  &__hint {
    display: block;
    font-size: 12px;
    line-height: 1.55;
    color: var(--text-3);
  }

  &__content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
}

.filter-section {
  &--card {
    padding: 16px 14px 15px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.98);
    border: 1px solid rgba(216, 203, 189, 0.4);
    box-shadow: 0 10px 24px rgba(99, 70, 49, 0.045);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  &__title {
    display: block;
    font-size: 14px;
    font-weight: 800;
    color: var(--text-1);
  }

  &__meta {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 700;
    color: var(--primary);
    padding: 4px 8px;
    border-radius: 999px;
    background: rgba(240, 88, 136, 0.1);
  }

  &__helper {
    display: block;
    margin: -2px 0 14px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-3);
  }

  &__empty {
    display: block;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-3);
    padding: 2px 0;
  }
}

.filter-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-chip {
  padding: 8px 13px;
  border-radius: 999px;
  background: rgba(255, 244, 236, 0.86);
  border: 1px solid rgba(216, 203, 189, 0.18);
  transition: all 0.16s ease;

  &:active {
    transform: scale(0.96);
  }

  text {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
  }

  &--segment {
    min-height: 38px;
    padding: 9px 15px;
    background: rgba(252, 239, 229, 0.96);
    border-color: rgba(216, 203, 189, 0.32);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);

    text {
      font-weight: 700;
    }
  }

  &--segment-compact {
    min-height: 36px;
    padding: 8px 14px;

    text {
      font-size: 12px;
    }
  }

  &--active {
    background: linear-gradient(135deg, rgba(240, 88, 136, 0.16) 0%, rgba(255, 240, 242, 0.95) 100%);
    border-color: rgba(240, 88, 136, 0.4);
    box-shadow: 0 6px 16px rgba(240, 88, 136, 0.1);

    text {
      color: var(--primary);
    }
  }
}

.custom-date-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.custom-date-card {
  padding: 13px 12px;
  border-radius: 18px;
  background: rgba(255, 250, 246, 0.98);
  border: 1px solid rgba(216, 203, 189, 0.32);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);

  &__label {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--text-3);
  }

  &__value {
    display: block;
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }
}

.filter-actions {
  display: flex;
  gap: 10px;
  margin-top: 0;

  &--sheet-footer {
    padding: 10px var(--space-page) calc(env(safe-area-inset-bottom, 0px) + 10px);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 252, 249, 0.52) 38%, rgba(255, 255, 255, 0.78) 72%, rgba(255, 255, 255, 0.9) 100%);
    border-top: 1px solid rgba(216, 203, 189, 0.1);
    box-shadow: 0 -6px 16px rgba(77, 52, 31, 0.03);
    backdrop-filter: blur(12px);
  }

  &__reset,
  &__apply {
    flex: 1;
    height: 48px;
    border-radius: 18px;
    border: none;
    padding: 0 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    box-sizing: border-box;
    -webkit-appearance: none;

    &::after {
      border: none;
    }
  }

  &__reset {
    background: rgba(255, 244, 236, 0.98);
    border: 1px solid rgba(216, 203, 189, 0.72);
    color: var(--text-2);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
  }

  &__apply {
    background: linear-gradient(135deg, var(--primary) 0%, #ff6f98 100%);
    color: #fff;
    border: 1px solid rgba(240, 88, 136, 0.2);
    box-shadow: 0 12px 24px rgba(240, 88, 136, 0.22);

    &[disabled] {
      opacity: 0.45;
      color: #fff;
    }
  }
}

.log-skeleton__line {
  border-radius: 999px;
}

.log-skeleton__line--main {
  width: 74%;
  height: 12px;
}

.log-skeleton__line--meta {
  width: 58%;
  height: 10px;
}

.log-skeleton__shimmer {
  background: linear-gradient(
    90deg,
    var(--card-dim) 25%,
    rgba(255, 255, 255, 0.24) 50%,
    var(--card-dim) 75%
  );
  background-size: 200% 100%;
  animation: operation-log-skeleton-shimmer 1.5s infinite;
}

@keyframes operation-log-skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}
</style>
