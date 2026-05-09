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
      <view class="sync-card" :class="`sync-card--${syncTone}`">
        <view class="sync-card__header">
          <view class="sync-card__icon-wrap">
            <text class="material-icons-round sync-card__icon">{{ syncIcon }}</text>
          </view>
          <view class="sync-card__main">
            <text class="sync-card__title">{{ syncHeadline }}</text>
            <text class="sync-card__desc">{{ syncDescription }}</text>
          </view>
        </view>
        <view class="sync-card__rows">
          <view class="sync-card__row">
            <text class="sync-card__label">最近同步</text>
            <text class="sync-card__value">{{ recentSyncText }}</text>
          </view>
          <view class="sync-card__row">
            <text class="sync-card__label">当前状态</text>
            <text class="sync-card__value">{{ syncStateText }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="isDevMode" class="sync-section">
      <view class="sync-section__header">
        <text class="sync-section__title">开发信息</text>
        <text class="sync-section__meta">{{ activeScopeText }}</text>
      </view>
      <view class="scope-panel">
        <view class="scope-panel__row">
          <text class="scope-panel__label">当前 Scope</text>
          <text class="scope-panel__value">{{ activeScopeText }}</text>
        </view>
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
      <button class="sync-actions__primary" :disabled="syncActionDisabled" @click="handleSyncAction">
        <text class="material-icons-round sync-actions__icon">{{ syncActionIcon }}</text>
        <text>{{ syncActionText }}</text>
      </button>
    </view>

    <view class="sync-section">
      <view class="sync-section__header">
        <text class="sync-section__title">需要处理</text>
        <text class="sync-section__meta">{{ issueMetaText }}</text>
      </view>
      <view v-if="issues.length" class="issue-list">
        <view v-for="issue in issues" :key="issue._id" class="issue-row">
          <view class="issue-row__main">
            <text class="issue-row__title">{{ issueTitle(issue) }}</text>
            <text class="issue-row__desc">{{ issueDescription(issue) }}</text>
          </view>
          <text class="issue-row__badge" :class="`issue-row__badge--${issue.status}`">{{ issueStatusText(issue.status) }}</text>
        </view>
      </view>
      <view v-else class="empty-state">
        <text class="material-icons-round empty-state__icon">check_circle</text>
        <text class="empty-state__title">没有需要处理的同步问题</text>
        <text class="empty-state__desc">联网后会自动完成数据同步</text>
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
import { isAuthTokenError } from '@/utils/cloudError'
import { getBeijingDateParts } from '@/utils/date'

interface SyncIssue {
  _id: string
  type: string
  status: string
  lastError: string
}

const { currentFamily, navigateToLogin } = useAuth()
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
  { key: 'pending', label: '待同步', value: pendingSyncCount.value, tone: 'amber' },
  { key: 'failed', label: '同步失败', value: syncStatus.failed, tone: 'red' },
  { key: 'conflict', label: '需确认', value: syncStatus.conflict, tone: 'plum' },
  { key: 'pendingUpload', label: '附件上传', value: syncStatus.pendingUpload, tone: 'blue' },
])
const activeScopeText = computed(() => syncStatus.activeScope || '暂无')
const recentSyncText = computed(() => formatTime(scopeStatus.lastSyncedAt || syncStatus.recentSyncAt || syncStatus.lastPulledAt))
const scopeTtlText = computed(() => scopeStatus.ttlMs > 0 ? `${Math.round(scopeStatus.ttlMs / 1000)} 秒` : '不适用')
const scopeCollectionsText = computed(() => scopeStatus.collections.length ? scopeStatus.collections.join(' / ') : '暂无')
const canRetryIssues = computed(() => syncStatus.failed > 0 || syncStatus.conflict > 0)
const issueMetaText = computed(() => issues.value.length ? `${issues.value.length} 项` : '正常')
const hasAuthExpiredIssue = computed(() => issues.value.some(issue => isAuthTokenError(issue.lastError)))
const pendingSyncCount = computed(() => syncStatus.pending + syncStatus.processing)
const syncActionLoading = computed(() => syncingScope.value || retryingIssues.value)
const syncActionText = computed(() => {
  if (retryingIssues.value) return '正在重试'
  if (syncingScope.value) return '正在同步'
  if (hasAuthExpiredIssue.value) return '重新登录'
  if (canRetryIssues.value) return '重试同步'
  return '立即同步'
})
const syncActionIcon = computed(() => {
  if (hasAuthExpiredIssue.value) return 'login'
  if (canRetryIssues.value) return 'restart_alt'
  return 'sync'
})
const syncActionDisabled = computed(() => (
  syncActionLoading.value
  || (!hasAuthExpiredIssue.value && !canRetryIssues.value && !syncStatus.activeScope && syncStatus.pendingUpload === 0)
))
const isDevMode = computed(() => {
  const devFlag = typeof globalThis !== 'undefined' ? (globalThis as any).__DEV__ : undefined
  return devFlag === true || import.meta.env.DEV === true
})
const syncTone = computed(() => {
  if (syncStatus.conflict > 0) return 'plum'
  if (syncStatus.failed > 0) return 'red'
  if (syncStatus.pendingUpload > 0) return 'blue'
  if (pendingSyncCount.value > 0) return 'amber'
  return 'green'
})
const syncIcon = computed(() => {
  if (syncStatus.conflict > 0) return 'priority_high'
  if (syncStatus.failed > 0) return 'sync_problem'
  if (syncStatus.pendingUpload > 0) return 'cloud_upload'
  if (pendingSyncCount.value > 0) return 'cloud_sync'
  return 'cloud_done'
})
const syncHeadline = computed(() => {
  if (syncStatus.conflict > 0) return '有数据需要确认'
  if (syncStatus.failed > 0) return '有数据同步失败'
  if (syncStatus.pendingUpload > 0) return '有附件等待上传'
  if (pendingSyncCount.value > 0) return '有数据等待同步'
  return '数据已同步'
})
const syncDescription = computed(() => {
  if (syncStatus.conflict > 0) return '部分记录和云端版本不一致，请确认后再继续同步。'
  if (syncStatus.failed > 0) return '可能是网络或登录状态导致，恢复后可以手动重试。'
  if (syncStatus.pendingUpload > 0) return '图片或附件会在网络稳定后继续上传。'
  if (pendingSyncCount.value > 0) return '离线期间的改动已保存在本机，联网后会继续同步。'
  return '本机数据和云端保持一致，可以放心继续使用。'
})
const syncStateText = computed(() => {
  if (syncStatus.conflict > 0) return `${syncStatus.conflict} 项需要确认`
  if (syncStatus.failed > 0) return `${syncStatus.failed} 项同步失败`
  if (syncStatus.pendingUpload > 0) return `${syncStatus.pendingUpload} 项附件待上传`
  if (pendingSyncCount.value > 0) return `${pendingSyncCount.value} 项待同步`
  return '正常'
})

function hasRemainingSyncWork() {
  return syncStatus.pending > 0
    || syncStatus.processing > 0
    || syncStatus.failed > 0
    || syncStatus.conflict > 0
    || syncStatus.pendingUpload > 0
}

function getRemainingSyncToast() {
  if (!hasRemainingSyncWork()) {
    return { title: '同步已完成', icon: 'success' as const }
  }
  if (syncStatus.failed > 0 || syncStatus.conflict > 0) {
    return { title: '仍有待处理项', icon: 'none' as const }
  }
  return { title: '仍有数据待同步', icon: 'none' as const }
}

function isCurrentLoginExpired() {
  try {
    const info = uniCloud.getCurrentUserInfo()
    const expiredAt = Number((info as any)?.tokenExpired ?? (info as any)?.token_expired ?? uni.getStorageSync('uni_id_token_expired') ?? 0)
    return !info?.uid || (expiredAt > 0 && expiredAt <= Date.now())
  } catch {
    return false
  }
}

function promptLoginExpired() {
  uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
  navigateToLogin()
}

function formatTime(ts: number) {
  if (!ts) return '暂无'
  const d = getBeijingDateParts(ts)
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')} ${String(d.hours).padStart(2, '0')}:${String(d.minutes).padStart(2, '0')}`
}

function issueStatusText(status: string) {
  if (status === 'conflict') return '冲突'
  if (status === 'failed') return '失败'
  if (status === 'processing') return '同步中'
  if (status === 'pending') return '待同步'
  return '待处理'
}

function issueTypeText(type: string) {
  if (type.startsWith('dog.')) return '犬只资料'
  if (type.startsWith('breeding.')) return '繁育记录'
  if (type.startsWith('health.')) return '健康用药'
  if (type.startsWith('task.')) return '待办事项'
  if (type.startsWith('finance.')) return '财务销售'
  if (type.startsWith('family.')) return '犬舍设置'
  if (type.startsWith('recycle.')) return '回收站'
  return '同步数据'
}

function issueTitle(issue: SyncIssue) {
  return `${issueTypeText(issue.type)}未同步`
}

function issueDescription(issue: SyncIssue) {
  if (hasAuthExpiredIssue.value && isAuthTokenError(issue.lastError)) {
    return '登录状态已过期，请重新登录后再同步。'
  }
  if (issue.status === 'conflict') return '这条记录需要确认后才能继续同步。'
  if (issue.status === 'failed') return issue.lastError || '同步失败，可以在网络恢复后重试。'
  if (issue.status === 'processing') return '正在同步，请稍候。'
  return '等待网络恢复后自动同步。'
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
  if (hasAuthExpiredIssue.value || isCurrentLoginExpired()) {
    promptLoginExpired()
    return
  }
  const familyId = currentFamily.value?._id || ''
  if (!familyId) {
    uni.showToast({ title: '缺少家庭信息', icon: 'none' })
    return
  }
  retryingIssues.value = true
  try {
    await localSyncRuntime.retryFailedOutboxNow(familyId)
    if (syncStatus.activeScope) {
      await localSyncRuntime.forceSyncScope(syncStatus.activeScope)
    }
    await loadStatus()
    uni.showToast(getRemainingSyncToast())
  } catch (error) {
    await loadStatus()
    if (isAuthTokenError(error)) {
      promptLoginExpired()
      return
    }
    uni.showToast({ title: error instanceof Error ? error.message : '重试失败', icon: 'none' })
  } finally {
    retryingIssues.value = false
  }
}

async function handleSyncAction() {
  if (syncActionLoading.value) return
  if (hasAuthExpiredIssue.value || isCurrentLoginExpired()) {
    promptLoginExpired()
    return
  }
  if (canRetryIssues.value) {
    await retryIssues()
    return
  }
  if (!syncStatus.activeScope && syncStatus.pendingUpload > 0) {
    await syncPendingUploads()
    return
  }
  await forceSyncActiveScope()
}

async function syncPendingUploads() {
  if (syncingScope.value) return
  const familyId = currentFamily.value?._id || ''
  if (!familyId) {
    uni.showToast({ title: '缺少家庭信息', icon: 'none' })
    return
  }
  syncingScope.value = true
  try {
    await localSyncRuntime.uploadPendingAttachments(familyId)
    await loadStatus()
    uni.showToast(getRemainingSyncToast())
  } catch (error) {
    await loadStatus()
    uni.showToast({ title: error instanceof Error ? error.message : '附件上传失败', icon: 'none' })
  } finally {
    syncingScope.value = false
  }
}

async function forceSyncActiveScope() {
  if (syncingScope.value || !syncStatus.activeScope) return
  syncingScope.value = true
  try {
    await localSyncRuntime.forceSyncScope(syncStatus.activeScope)
    await loadStatus()
    uni.showToast({ title: '同步完成', icon: 'success' })
  } catch (error) {
    await loadStatus()
    if (isAuthTokenError(error)) {
      promptLoginExpired()
      return
    }
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

  &__item--amber .sync-overview__value { color: var(--amber); }
  &__item--red .sync-overview__value { color: var(--red); }
  &__item--plum .sync-overview__value { color: var(--plum); }
  &__item--blue .sync-overview__value { color: var(--blue); }
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

.sync-card {
  border-radius: var(--radius-card);
  background: var(--card);
  box-shadow: var(--shadow);
  padding: 14px;

  &__header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  &__icon-wrap {
    width: 38px;
    height: 38px;
    border-radius: 19px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--green-soft);
  }

  &__icon {
    font-size: 22px;
    color: var(--green);
  }

  &__main {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  &__title {
    font-size: 16px;
    font-weight: 800;
    color: var(--text-1);
    line-height: 1.3;
  }

  &__desc {
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.45;
  }

  &__rows {
    margin-top: 13px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__label {
    font-size: 12px;
    color: var(--text-3);
  }

  &__value {
    flex: 1;
    text-align: right;
    font-size: 13px;
    color: var(--text-1);
    font-weight: 600;
    word-break: break-word;
  }

  &--amber .sync-card__icon-wrap { background: var(--amber-soft); }
  &--amber .sync-card__icon { color: var(--amber); }
  &--red .sync-card__icon-wrap { background: var(--red-soft); }
  &--red .sync-card__icon { color: var(--red); }
  &--plum .sync-card__icon-wrap { background: var(--plum-soft); }
  &--plum .sync-card__icon { color: var(--plum); }
  &--blue .sync-card__icon-wrap { background: var(--blue-soft); }
  &--blue .sync-card__icon { color: var(--blue); }
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

  &__primary {
    width: 100%;
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

  &__primary[disabled] {
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

  &__desc {
    font-size: 12px;
    color: var(--text-3);
  }
}
</style>
