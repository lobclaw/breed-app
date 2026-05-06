<template>
  <view class="page sync-status-page">
    <BPageHeader title="同步状态" />

    <view class="sync-overview">
      <view
        v-for="item in statusItems"
        :key="item.key"
        class="sync-overview__item"
        :class="`sync-overview__item--${item.tone}`"
      >
        <text class="sync-overview__value">{{ item.value }}</text>
        <text class="sync-overview__label">{{ item.label }}</text>
      </view>
    </view>

    <view class="sync-section">
      <view class="sync-section__header">
        <text class="sync-section__title">当前 Scope</text>
        <text class="sync-section__meta">{{ activeScopeText }}</text>
      </view>
      <view class="scope-panel">
        <view class="scope-panel__row">
          <text class="scope-panel__label">最近同步</text>
          <text class="scope-panel__value">{{ recentSyncText }}</text>
        </view>
        <view class="scope-panel__row">
          <text class="scope-panel__label">TTL</text>
          <text class="scope-panel__value">{{ scopeTtlText }}</text>
        </view>
        <view class="scope-panel__row">
          <text class="scope-panel__label">集合</text>
          <text class="scope-panel__value">{{ scopeCollectionsText }}</text>
        </view>
        <view v-if="scopeStatus.lastError" class="scope-panel__error">
          <text>{{ scopeStatus.lastError }}</text>
        </view>
      </view>
    </view>

    <view class="sync-actions">
      <button class="sync-actions__primary" :disabled="syncingScope || !syncStatus.activeScope" @click="forceSyncActiveScope">
        <text class="material-icons-round sync-actions__icon">sync</text>
        <text>{{ syncingScope ? '正在同步' : '同步当前 Scope' }}</text>
      </button>
      <button class="sync-actions__secondary" :disabled="retryingIssues || !canRetryIssues" @click="retryIssues">
        <text class="material-icons-round sync-actions__icon">restart_alt</text>
        <text>{{ retryingIssues ? '正在重试' : '重试失败/冲突' }}</text>
      </button>
    </view>

    <view class="sync-section">
      <view class="sync-section__header">
        <text class="sync-section__title">待处理项</text>
        <text class="sync-section__meta">{{ issueMetaText }}</text>
      </view>
      <view v-if="issues.length" class="issue-list">
        <view v-for="issue in issues" :key="issue._id" class="issue-row">
          <view class="issue-row__main">
            <text class="issue-row__title">{{ issue.type }}</text>
            <text class="issue-row__desc">{{ issue.lastError || issueStatusText(issue.status) }}</text>
          </view>
          <text class="issue-row__badge" :class="`issue-row__badge--${issue.status}`">{{ issueStatusText(issue.status) }}</text>
        </view>
      </view>
      <view v-else class="empty-state">
        <text class="material-icons-round empty-state__icon">check_circle</text>
        <text class="empty-state__title">没有失败或冲突项</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import { localSyncRuntime } from '@/localdb/runtime'

interface SyncIssue {
  _id: string
  type: string
  status: string
  lastError: string
}

const { currentFamily } = useAuth()
const loading = ref(false)
const retryingIssues = ref(false)
const syncingScope = ref(false)
const issues = ref<SyncIssue[]>([])
const syncStatus = reactive({
  pending: 0,
  processing: 0,
  failed: 0,
  conflict: 0,
  pendingUpload: 0,
  activeScope: '',
  recentSyncAt: 0,
  lastPulledAt: 0,
})
const scopeStatus = reactive({
  ttlMs: 0,
  collections: [] as string[],
  lastSyncedAt: 0,
  lastError: '',
})

const statusItems = computed(() => [
  { key: 'pending', label: '待同步', value: syncStatus.pending + syncStatus.processing, tone: 'amber' },
  { key: 'failed', label: '失败', value: syncStatus.failed, tone: 'red' },
  { key: 'conflict', label: '冲突', value: syncStatus.conflict, tone: 'plum' },
  { key: 'pendingUpload', label: '待上传', value: syncStatus.pendingUpload, tone: 'blue' },
])
const activeScopeText = computed(() => syncStatus.activeScope || '暂无')
const recentSyncText = computed(() => formatTime(scopeStatus.lastSyncedAt || syncStatus.recentSyncAt || syncStatus.lastPulledAt))
const scopeTtlText = computed(() => scopeStatus.ttlMs > 0 ? `${Math.round(scopeStatus.ttlMs / 1000)} 秒` : '不适用')
const scopeCollectionsText = computed(() => scopeStatus.collections.length ? scopeStatus.collections.join(' / ') : '暂无')
const canRetryIssues = computed(() => syncStatus.failed > 0 || syncStatus.conflict > 0)
const issueMetaText = computed(() => issues.value.length ? `${issues.value.length} 项` : '正常')

function formatTime(ts: number) {
  if (!ts) return '暂无'
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function issueStatusText(status: string) {
  if (status === 'conflict') return '冲突'
  if (status === 'failed') return '失败'
  if (status === 'processing') return '同步中'
  if (status === 'pending') return '待同步'
  return '待处理'
}

function normalizeIssues(items: Array<Record<string, any>> = []): SyncIssue[] {
  return items.map(item => ({
    _id: String(item._id || ''),
    type: String(item.type || 'unknown'),
    status: String(item.status || ''),
    lastError: String(item.lastError || ''),
  }))
}

async function loadStatus() {
  loading.value = true
  try {
    const [currentStatus, currentIssues] = await Promise.all([
      localSyncRuntime.getSyncStatus(),
      localSyncRuntime.getOutboxIssues({ limit: 20 }),
    ])
    syncStatus.pending = Number(currentStatus?.pending || 0)
    syncStatus.processing = Number(currentStatus?.processing || 0)
    syncStatus.failed = Number(currentStatus?.failed || 0)
    syncStatus.conflict = Number(currentStatus?.conflict || 0)
    syncStatus.pendingUpload = Number(currentStatus?.pendingUpload || 0)
    syncStatus.activeScope = String(currentStatus?.activeScope || '')
    syncStatus.recentSyncAt = Number(currentStatus?.recentSyncAt || 0)
    syncStatus.lastPulledAt = Number(currentStatus?.lastPulledAt || 0)
    issues.value = normalizeIssues(currentIssues as Array<Record<string, any>>)

    if (syncStatus.activeScope) {
      const currentScope = await localSyncRuntime.getScopeStatus(syncStatus.activeScope)
      scopeStatus.ttlMs = Number(currentScope?.ttlMs || 0)
      scopeStatus.collections = Array.isArray(currentScope?.collections) ? currentScope.collections : []
      scopeStatus.lastSyncedAt = Number(currentScope?.lastSyncedAt || 0)
      scopeStatus.lastError = String(currentScope?.lastError || '')
    } else {
      scopeStatus.ttlMs = 0
      scopeStatus.collections = []
      scopeStatus.lastSyncedAt = 0
      scopeStatus.lastError = ''
    }
  } finally {
    loading.value = false
  }
}

async function retryIssues() {
  if (retryingIssues.value) return
  const familyId = currentFamily.value?._id || ''
  if (!familyId) {
    uni.showToast({ title: '缺少家庭信息', icon: 'none' })
    return
  }
  retryingIssues.value = true
  try {
    await localSyncRuntime.retryFailedOutboxNow(familyId)
    await loadStatus()
    uni.showToast({ title: canRetryIssues.value ? '仍有待处理项' : '同步已完成', icon: canRetryIssues.value ? 'none' : 'success' })
  } catch (error) {
    await loadStatus()
    uni.showToast({ title: error instanceof Error ? error.message : '重试失败', icon: 'none' })
  } finally {
    retryingIssues.value = false
  }
}

async function forceSyncActiveScope() {
  if (syncingScope.value || !syncStatus.activeScope) return
  syncingScope.value = true
  try {
    await localSyncRuntime.forceSyncScope(syncStatus.activeScope)
    await loadStatus()
    uni.showToast({ title: '已同步当前 Scope', icon: 'success' })
  } catch (error) {
    await loadStatus()
    uni.showToast({ title: error instanceof Error ? error.message : '同步失败', icon: 'none' })
  } finally {
    syncingScope.value = false
  }
}

onShow(() => {
  void loadStatus()
})
</script>

<style lang="scss" scoped>
.sync-status-page {
  padding-bottom: 24px;
}

.sync-overview {
  margin: 0 var(--space-page) 16px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;

  &__item {
    min-height: 76px;
    border-radius: var(--radius-card);
    background: var(--card);
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
  }

  &__value {
    font-size: 22px;
    font-weight: 800;
    color: var(--text-1);
  }

  &__label {
    font-size: 12px;
    color: var(--text-3);
  }
}

.sync-section {
  margin: 0 var(--space-page) 16px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  &__title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__meta {
    font-size: 12px;
    color: var(--text-3);
  }
}

.scope-panel {
  border-radius: var(--radius-card);
  background: var(--card);
  box-shadow: var(--shadow);
  padding: 4px 14px;

  &__row {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid var(--border);
  }

  &__row:last-child {
    border-bottom: 0;
  }

  &__label {
    font-size: 13px;
    color: var(--text-3);
  }

  &__value {
    flex: 1;
    text-align: right;
    font-size: 13px;
    color: var(--text-1);
    word-break: break-word;
  }

  &__error {
    margin: 10px 0;
    padding: 9px 10px;
    border-radius: var(--radius-row);
    background: rgba(214, 65, 65, 0.08);
    color: var(--red);
    font-size: 12px;
    line-height: 1.5;
  }
}

.sync-actions {
  margin: 0 var(--space-page) 18px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  &__primary,
  &__secondary {
    height: 42px;
    border: 0;
    border-radius: var(--radius-row);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 13px;
    font-weight: 700;
    line-height: 42px;
  }

  &__primary {
    color: #fff;
    background: var(--primary);
  }

  &__secondary {
    color: var(--text-1);
    background: var(--card-dim);
  }

  &__primary[disabled],
  &__secondary[disabled] {
    opacity: 0.45;
  }

  &__icon {
    font-size: 17px;
  }
}

.issue-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-row {
  border-radius: var(--radius-card);
  background: var(--card);
  box-shadow: var(--shadow);
  padding: 12px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  &__main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
    word-break: break-word;
  }

  &__desc {
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.45;
    word-break: break-word;
  }

  &__badge {
    flex-shrink: 0;
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 11px;
    color: var(--text-1);
    background: var(--card-dim);
  }

  &__badge--failed {
    color: var(--red);
    background: rgba(214, 65, 65, 0.10);
  }

  &__badge--conflict {
    color: var(--plum);
    background: rgba(143, 91, 178, 0.12);
  }
}

.empty-state {
  min-height: 132px;
  border-radius: var(--radius-card);
  background: var(--card);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;

  &__icon {
    font-size: 30px;
    color: var(--green);
  }

  &__title {
    font-size: 14px;
    color: var(--text-2);
  }
}
</style>
