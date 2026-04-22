<template>
  <view class="page">
    <BPageHeader title="操作日志" />

    <!-- 日期筛选 -->
    <view class="filter-bar">
      <view
        v-for="f in filterOptions"
        :key="f.value"
        class="filter-chip"
        :class="{ active: activeFilter === f.value }"
        @click="setFilter(f.value)"
      >
        <text>{{ f.label }}</text>
      </view>
    </view>

    <view class="filter-bar filter-bar--secondary">
      <view class="filter-chip filter-chip--ghost" @click="openMemberFilter">
        <text>{{ activeMemberLabel }}</text>
      </view>
      <view class="filter-chip filter-chip--ghost" @click="openActionFilter">
        <text>{{ activeActionLabel }}</text>
      </view>
    </view>

    <!-- 日志列表 -->
    <view v-if="logs.length" class="log-list">
      <view v-for="log in logs" :key="log._id" class="log-item">
        <view class="log-icon" :class="log.actionClass">
          <text class="material-icons-round">{{ log.actionIcon }}</text>
        </view>
        <view class="log-content">
          <text class="log-summary">{{ log.summary }}</text>
          <text class="log-time">{{ log.time_text }}</text>
        </view>
      </view>
    </view>

    <!-- 加载更多 -->
    <view v-if="hasMore && logs.length && !loadingMore" class="load-more" @click="loadMore">
      <text>加载更多</text>
    </view>

    <view v-if="loadingMore && logs.length" class="log-list log-list--append">
      <view v-for="index in 2" :key="`append-${index}`" class="log-item log-item--skeleton">
        <view class="log-icon log-icon--skeleton log-skeleton__shimmer" />
        <view class="log-content">
          <view class="log-main log-main--skeleton">
            <view class="log-skeleton__line log-skeleton__line--main log-skeleton__shimmer" />
            <view class="log-skeleton__line log-skeleton__line--sub log-skeleton__shimmer" />
          </view>
          <view class="log-skeleton__line log-skeleton__line--time log-skeleton__shimmer" />
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="!logs.length && !loading" class="empty-state">
      <text class="material-icons-round empty-icon">history</text>
      <text class="empty-text">暂无操作日志</text>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading && !logs.length" class="log-list">
      <view v-for="index in 4" :key="`loading-${index}`" class="log-item log-item--skeleton">
        <view class="log-icon log-icon--skeleton log-skeleton__shimmer" />
        <view class="log-content">
          <view class="log-main log-main--skeleton">
            <view class="log-skeleton__line log-skeleton__line--main log-skeleton__shimmer" />
            <view class="log-skeleton__line log-skeleton__line--sub log-skeleton__shimmer" />
          </view>
          <view class="log-skeleton__line log-skeleton__line--time log-skeleton__shimmer" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { useAuth } from '@/composables/useAuth'
import BPageHeader from '@/components/layout/BPageHeader.vue'

interface LogItem {
  _id: string
  actor_user_id: string
  actor_name: string
  action_type: string
  summary: string
  target_name: string
  time_text: string
  actionClass: string
  actionIcon: string
  created_at: number
}

const loading = ref(false)
const loadingMore = ref(false)
const activeFilter = ref('today')
const logs = ref<LogItem[]>([])
const hasMore = ref(false)
const page = ref(1)
const pageSize = 20
const activeMemberId = ref('')
const activeActionType = ref('')

const { currentFamily } = useAuth()

const filterOptions = [
  { label: '今天', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
]

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

const actionFilterOptions = [
  { label: '全部操作', value: '' },
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

const memberFilterOptions = computed(() => {
  const members = (currentFamily.value?.members || [])
    .filter(member => member.status === 'active')
    .map(member => ({
      label: member.nickname || member.user_id,
      value: member.user_id,
    }))

  return [{ label: '全部成员', value: '' }, ...members]
})

const activeMemberLabel = computed(() => {
  return memberFilterOptions.value.find(item => item.value === activeMemberId.value)?.label || '全部成员'
})

const activeActionLabel = computed(() => {
  return actionFilterOptions.find(item => item.value === activeActionType.value)?.label || '全部操作'
})

function getFilterRange(filter: string): { start: number; end: number } {
  const now = new Date()
  const end = now.getTime()

  if (filter === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    return { start, end }
  }

  if (filter === 'week') {
    const day = now.getDay() || 7
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1).getTime()
    return { start, end }
  }

  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return { start, end }
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')

  if (isToday) {
    return `今天 ${hours}:${minutes}`
  }

  const month = d.getMonth() + 1
  const date = d.getDate()
  return `${month}月${date}日 ${hours}:${minutes}`
}

function processLog(raw: any): LogItem {
  const action = raw.action_type || 'update'
  return {
    _id: raw._id,
    actor_user_id: raw.actor_user_id || '',
    actor_name: raw.actor_name || '未知用户',
    action_type: action,
    summary: raw.summary
      ? `${raw.actor_name || '未知用户'} ${raw.summary}`
      : `${raw.actor_name || '未知用户'} ${raw.target_name || ''}`.trim(),
    target_name: raw.target_name || '',
    time_text: formatTime(raw.created_at),
    actionClass: actionClasses[action] || 'icon-blue',
    actionIcon: actionIcons[action] || 'edit',
    created_at: raw.created_at,
  }
}

const { run: fetchLogs } = useCloudCall('family-service', 'getOperationLogs', {
  showLoading: false,
})

async function loadLogs(reset = true) {
  if (reset) {
    page.value = 1
    logs.value = []
    loading.value = true
  } else {
    loadingMore.value = true
  }

  try {
    const range = getFilterRange(activeFilter.value)
    const res = await fetchLogs({
      start: range.start,
      end: range.end,
      page: page.value,
      pageSize,
      actorUserId: activeMemberId.value || undefined,
      actionTypes: activeActionType.value ? [activeActionType.value] : undefined,
    })
    if (res) {
      const data = res as any
      const items = (data.list || []).map(processLog)
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

function setFilter(filter: string) {
  activeFilter.value = filter
  loadLogs(true)
}

function openMemberFilter() {
  uni.showActionSheet({
    itemList: memberFilterOptions.value.map(item => item.label),
    success: ({ tapIndex }) => {
      activeMemberId.value = memberFilterOptions.value[tapIndex]?.value || ''
      loadLogs(true)
    },
  })
}

function openActionFilter() {
  uni.showActionSheet({
    itemList: actionFilterOptions.map(item => item.label),
    success: ({ tapIndex }) => {
      activeActionType.value = actionFilterOptions[tapIndex]?.value || ''
      loadLogs(true)
    },
  })
}

function loadMore() {
  if (loadingMore.value) return
  page.value++
  loadLogs(false)
}

onLoad(() => {
  loadLogs(true)
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

/* ---- Filter Bar ---- */
.filter-bar {
  display: flex;
  gap: 8px;
  padding: 4px var(--space-page) 16px;
}

.filter-bar--secondary {
  padding-top: 0;
}

.filter-chip {
  padding: 6px 16px;
  border-radius: var(--radius-btn);
  background: var(--card);
  box-shadow: var(--shadow);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  transition: all 0.15s ease;

  &:active {
    transform: scale(0.92);
  }

  &.active {
    background: var(--primary);
    color: #fff;
    box-shadow: 0 2px 8px rgba(234, 62, 119, 0.25);
  }

  &--ghost {
    background: var(--card-dim);
    box-shadow: none;
  }
}

/* ---- Log List ---- */
.log-list {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-item {
  background: var(--card);
  border-radius: var(--radius-row);
  padding: 14px 16px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.log-item--skeleton {
  pointer-events: none;
}

.log-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .material-icons-round {
    font-size: 18px;
  }

  &.icon-green {
    background: var(--icon-green);
    .material-icons-round { color: var(--green); }
  }

  &.icon-blue {
    background: var(--icon-blue);
    .material-icons-round { color: var(--blue); }
  }

  &.icon-red {
    background: var(--icon-red);
    .material-icons-round { color: var(--red); }
  }

  &.icon-teal {
    background: var(--icon-teal);
    .material-icons-round { color: var(--teal); }
  }

  &.icon-amber {
    background: var(--icon-amber);
    .material-icons-round { color: var(--amber); }
  }
}

.log-icon--skeleton {
  border-radius: var(--radius-icon);
}

.log-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-summary {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-1);
}

.log-time {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
}

/* ---- Load More ---- */
.load-more {
  text-align: center;
  padding: 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
}
.log-list--append {
  padding-top: 0;
}

.log-main--skeleton {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.log-skeleton__line {
  border-radius: 999px;
}

.log-skeleton__line--main {
  width: 72%;
  height: 13px;
}

.log-skeleton__line--sub {
  width: 44%;
  height: 11px;
}

.log-skeleton__line--time {
  width: 88px;
  height: 10px;
}

.log-skeleton__shimmer {
  background: linear-gradient(
    90deg,
    var(--card-dim) 25%,
    rgba(255, 255, 255, 0.22) 50%,
    var(--card-dim) 75%
  );
  background-size: 200% 100%;
  animation: operation-log-skeleton-shimmer 1.5s infinite;
}

@keyframes operation-log-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
