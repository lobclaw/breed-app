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

    <!-- 日志列表 -->
    <view v-if="logs.length" class="log-list">
      <view v-for="log in logs" :key="log._id" class="log-item">
        <view class="log-icon" :class="log.actionClass">
          <text class="material-icons-round">{{ log.actionIcon }}</text>
        </view>
        <view class="log-content">
          <view class="log-main">
            <text class="log-operator">{{ log.operator_name }}</text>
            <text class="log-action">{{ log.action_text }}</text>
            <text class="log-target">{{ log.target_name }}</text>
          </view>
          <text class="log-time">{{ log.time_text }}</text>
        </view>
      </view>
    </view>

    <!-- 加载更多 -->
    <view v-if="hasMore && logs.length" class="load-more" @click="loadMore">
      <text>{{ loadingMore ? '加载中...' : '加载更多' }}</text>
    </view>

    <!-- 空状态 -->
    <view v-if="!logs.length && !loading" class="empty-state">
      <text class="material-icons-round empty-icon">history</text>
      <text class="empty-text">暂无操作日志</text>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading && !logs.length" class="loading-state">
      <text class="loading-text">加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'

interface LogItem {
  _id: string
  operator_name: string
  action: string
  action_text: string
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

const filterOptions = [
  { label: '今天', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
]

const actionIcons: Record<string, string> = {
  'create': 'add_circle',
  'update': 'edit',
  'delete': 'delete',
}

const actionClasses: Record<string, string> = {
  'create': 'icon-green',
  'update': 'icon-blue',
  'delete': 'icon-red',
}

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
  const action = raw.action || 'update'
  return {
    _id: raw._id,
    operator_name: raw.operator_name || '未知用户',
    action: action,
    action_text: raw.action_text || action,
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
    })
    if (res) {
      const data = res as any
      const items = (data.list || []).map(processLog)
      if (reset) {
        logs.value = items
      } else {
        logs.value.push(...items)
      }
      hasMore.value = items.length >= pageSize
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
}

.log-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  line-height: 1.4;
}

.log-operator {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
}

.log-action {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
}

.log-target {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
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

/* ---- Loading State ---- */
.loading-state {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.loading-text {
  font-size: 14px;
  color: var(--text-3);
}
</style>
