<template>
  <view class="page">
    <BPageHeader title="数据备份" />

    <!-- 备份状态卡 -->
    <view class="status-card">
      <view class="info-row">
        <text class="info-row-label">上次备份</text>
        <view class="info-row-value" style="display: flex; align-items: center; gap: 6px;">
          <text>{{ lastBackupDate || '暂无' }}</text>
          <text v-if="lastBackupDate" class="material-icons-round" style="font-size: 16px; color: var(--green);">check_circle</text>
        </view>
      </view>
      <view class="info-row">
        <text class="info-row-label">自动备份</text>
        <view class="info-row-value" style="display: flex; align-items: center; gap: 10px;">
          <text style="font-size: 13px; color: var(--text-3);">每周一次</text>
          <view class="custom-toggle" :class="{ 'custom-toggle--on': autoBackup }" @click="toggleAutoBackup">
            <view class="custom-toggle__knob" />
          </view>
        </view>
      </view>
    </view>

    <view class="sync-warning-card" :class="{ 'sync-warning-card--ok': syncStatusReady && !hasUnsyncedData }">
      <view class="sync-warning-card__header">
        <view class="sync-warning-card__icon-wrap">
          <text class="material-icons-round sync-warning-card__icon">{{ syncStatusIcon }}</text>
        </view>
        <view class="sync-warning-card__main">
          <view class="sync-warning-card__title-row">
            <text class="sync-warning-card__title">{{ syncStatusTitle }}</text>
            <text class="sync-warning-card__badge">{{ syncStatusBadge }}</text>
          </view>
          <text class="sync-warning-card__desc">{{ syncStatusDescription }}</text>
        </view>
      </view>
      <view v-if="syncStatusReady && hasUnsyncedData" class="sync-warning-card__hint-row">
        <text class="material-icons-round sync-warning-card__hint-icon">info</text>
        <text class="sync-warning-card__hint">请先恢复联网并等待同步完成，再执行备份或导出，避免遗漏离线期间的数据。</text>
      </view>
      <view v-if="isDevMode && syncStatusReady && hasUnsyncedData && syncIssues.length" class="sync-warning-card__issues">
        <view v-for="issue in syncIssues" :key="issue._id" class="sync-warning-card__issue">
          <text class="sync-warning-card__issue-type">{{ issue.type }}</text>
          <text class="sync-warning-card__issue-error">{{ issue.lastError || '同步失败，等待重试' }}</text>
        </view>
      </view>
      <view class="sync-warning-card__actions">
        <button v-if="syncStatusReady && hasUnsyncedData" class="sync-warning-card__retry" :disabled="retryingSync" @click="retrySyncNow">
          <text class="material-icons-round sync-warning-card__retry-icon">{{ syncPrimaryActionIcon }}</text>
          <text>{{ syncPrimaryActionText }}</text>
        </button>
        <button class="sync-warning-card__detail" :class="{ 'sync-warning-card__detail--wide': !syncStatusReady || !hasUnsyncedData }" @click="goToSyncStatus">
          <text>查看同步状态</text>
          <text class="material-icons-round sync-warning-card__detail-icon">chevron_right</text>
        </button>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="backup-actions">
      <BSubmitButton :loading="backingUp" :disabled="!syncStatusReady || exporting || repairing || restoringBackup" @click="startBackup">
        <text v-if="!backingUp" class="material-icons-round" style="font-size: 18px; color: #fff; margin-right: 6px;">backup</text>
        立即备份
      </BSubmitButton>

      <button class="action-btn-ghost" :disabled="!syncStatusReady || backingUp || exporting || repairing || restoringBackup" @click="startExport">
        <text class="material-icons-round" style="font-size: 18px; color: var(--text-1); margin-right: 6px;">download</text>
        {{ exporting ? '导出中' : '导出到本地' }}
      </button>

      <button class="action-btn-dim" :disabled="backingUp || exporting || repairing || restoringBackup" @click="startRepair">
        <text class="material-icons-round" style="font-size: 18px; color: var(--text-3); margin-right: 6px;">build</text>
        {{ repairing ? '修复中' : '数据修复' }}
      </button>
    </view>

    <!-- 进度条 -->
    <view v-if="backingUp || exporting" class="progress-area">
      <view class="export-progress">
        <view class="export-progress__bar">
          <view class="export-progress__fill" :style="{ width: exportProgress + '%' }" />
        </view>
        <text class="export-progress__label">{{ backingUp ? '备份中' : '导出中' }}</text>
        <text class="export-progress__text">{{ exportProgress }}%</text>
      </view>
    </view>

    <!-- 备份历史 -->
    <view class="backup-history-section">
      <view class="backup-history-section__header">
        <text class="backup-history-section__title">备份历史</text>
        <text class="backup-history-section__count">{{ backupHistory.length }}/4</text>
      </view>
      <view v-if="backupHistoryLoading" class="backup-history-section__empty">
        <text>正在读取备份历史</text>
      </view>
      <view v-else-if="!backupHistory.length" class="backup-history-section__empty">
        <text>暂无备份</text>
      </view>
      <view v-else class="backup-history-section__list">
        <view v-for="(file, index) in backupHistory" :key="file.fileID" class="backup-history-item">
          <view class="backup-history-item__icon-wrap">
            <text class="material-icons-round backup-history-item__icon">cloud_done</text>
          </view>
          <view class="backup-history-item__main">
            <view class="backup-history-item__title-row">
              <text class="backup-history-item__title">{{ formatBackupHistoryTime(file.created_at) }}</text>
              <text v-if="index === 0" class="backup-history-item__badge">最新</text>
            </view>
            <text class="backup-history-item__desc">{{ file.name }}</text>
            <view class="backup-history-item__actions">
              <button class="backup-history-item__action" :disabled="exportResultDownloading || restoringBackup" @click="downloadBackupHistory(file)">
                <text class="material-icons-round backup-history-item__action-icon">download</text>
                <text>下载</text>
              </button>
              <button
                v-if="index === 0"
                class="backup-history-item__action backup-history-item__action--danger"
                :disabled="restoringBackup"
                @click="confirmRestoreBackup(file)"
              >
                <text class="material-icons-round backup-history-item__action-icon">settings_backup_restore</text>
                <text>{{ restoringBackup ? '恢复中' : '恢复' }}</text>
              </button>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 回收站 -->
    <view class="recycle-section">
      <text class="recycle-section__title">回收站</text>
      <text class="recycle-section__desc">30 天内删除的犬只、财务、代理人、用药方案可恢复</text>
      <text class="recycle-section__link" @click="goToRecycleBin">进入回收站 →</text>
    </view>

    <!-- 警告文字 -->
    <text class="warning-text">备份文件包含所有犬只、记录、财务数据，请妥善保管</text>

    <BModal
      v-model:visible="showRepairConfirm"
      title="数据修复"
      content="将检查并修复数据不一致问题，是否继续？"
      confirmText="开始修复"
      @confirm="handleRepairConfirm"
    />

    <BModal
      v-model:visible="showRestoreConfirm"
      title="恢复备份"
      content="恢复会用最近备份覆盖当前业务数据。系统会先自动创建一份恢复前备份，是否继续？"
      confirmText="恢复"
      :danger="true"
      :manualClose="true"
      @confirm="handleRestoreConfirm"
    />

    <BModal
      v-model:visible="showRepairResult"
      title="数据修复完成"
      confirmText="知道了"
      :showCancel="false"
    >
      <view class="repair-result">
        <view class="repair-result__icon-wrap" :class="{ 'repair-result__icon-wrap--warning': repairResult.warningCount > 0 }">
          <text class="material-icons-round repair-result__icon">{{ repairResult.warningCount > 0 ? 'priority_high' : 'check' }}</text>
        </view>
        <view class="repair-result__stats">
          <view class="repair-result__stat">
            <text class="repair-result__stat-value">{{ repairResult.checkedCount }}</text>
            <text class="repair-result__stat-label">已检查</text>
          </view>
          <view class="repair-result__stat">
            <text class="repair-result__stat-value">{{ repairResult.repairedCount }}</text>
            <text class="repair-result__stat-label">已修复</text>
          </view>
          <view class="repair-result__stat" :class="{ 'repair-result__stat--warning': repairResult.warningCount > 0 }">
            <text class="repair-result__stat-value">{{ repairResult.warningCount }}</text>
            <text class="repair-result__stat-label">需确认</text>
          </view>
        </view>
        <text class="repair-result__desc">
          {{ repairResult.warningCount > 0 ? `仍有 ${repairResult.warningCount} 项需要人工确认。` : '未发现需人工处理的问题。' }}
        </text>
      </view>
    </BModal>

    <BSheet v-model:visible="showExportSheet" title="导出到本地" height="auto">
      <view class="export-format-sheet">
        <view class="export-format-sheet__item export-format-sheet__item--json" @click="chooseExportFormat('json')">
          <view class="export-format-sheet__icon export-format-sheet__icon--json">
            <text class="material-icons-round export-format-sheet__icon-text">data_object</text>
          </view>
          <view class="export-format-sheet__info">
            <text class="export-format-sheet__title">JSON 格式</text>
            <text class="export-format-sheet__desc">完整归档，适合备份留存</text>
          </view>
          <text class="material-icons-round export-format-sheet__arrow">chevron_right</text>
        </view>

        <view class="export-format-sheet__item export-format-sheet__item--csv" @click="chooseExportFormat('csv')">
          <view class="export-format-sheet__icon export-format-sheet__icon--csv">
            <text class="material-icons-round export-format-sheet__icon-text">table_chart</text>
          </view>
          <view class="export-format-sheet__info">
            <text class="export-format-sheet__title">CSV 格式</text>
            <text class="export-format-sheet__desc">表格文件，适合查看统计</text>
          </view>
          <text class="material-icons-round export-format-sheet__arrow">chevron_right</text>
        </view>
      </view>
    </BSheet>

    <BSheet v-model:visible="showExportResultSheet" title="导出完成" height="auto">
      <view class="export-result-sheet">
        <view class="export-result-sheet__status">
          <view class="export-result-sheet__icon-wrap">
            <text class="material-icons-round export-result-sheet__icon">download_done</text>
          </view>
          <view class="export-result-sheet__main">
            <text class="export-result-sheet__title">{{ exportResultName }}</text>
            <text class="export-result-sheet__desc">平台未能自动保存，请手动下载或复制临时链接。</text>
          </view>
        </view>
        <view class="export-result-sheet__hint">
          <text class="material-icons-round export-result-sheet__hint-icon">lock_clock</text>
          <text class="export-result-sheet__hint-text">链接短期有效，备份文件包含敏感数据，请妥善保管。</text>
        </view>
        <button class="export-result-sheet__primary" :disabled="exportResultDownloading" @click="downloadExportResult">
          <text class="material-icons-round export-result-sheet__button-icon">download</text>
          <text>{{ exportResultDownloading ? '下载中' : '下载文件' }}</text>
        </button>
        <button class="export-result-sheet__secondary" @click="copyExportResultLink">
          <text class="material-icons-round export-result-sheet__button-icon">content_copy</text>
          <text>复制下载链接</text>
        </button>
      </view>
    </BSheet>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { useAuth } from '@/composables/useAuth'
import { useOnlineOnlyGuard } from '@/composables/useOnlineOnlyGuard'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BModal from '@/components/layout/BModal.vue'
import BSheet from '@/components/layout/BSheet.vue'
import { localSyncRuntime } from '@/localdb/runtime'
import { localDb } from '@/localdb/db'
import { isAuthTokenError } from '@/utils/cloudError'
import { getBeijingDateParts } from '@/utils/date'
import type { BusinessCollectionName } from '@/localdb/types'

const backingUp = ref(false)
const exporting = ref(false)
const repairing = ref(false)
const retryingSync = ref(false)
const exportProgress = ref(0)
const lastBackupDate = ref('')
const autoBackup = ref(true)
const showRepairConfirm = ref(false)
const showRepairResult = ref(false)
const showExportSheet = ref(false)
const showExportResultSheet = ref(false)
const showRestoreConfirm = ref(false)
const repairResult = ref({
  checkedCount: 0,
  repairedCount: 0,
  warningCount: 0,
})
const BACKUP_INFO_CACHE_PREFIX = 'breed_backup_info:'
const BACKUP_HISTORY_CACHE_PREFIX = 'breed_backup_history:'
const RESTORE_SYNC_COLLECTIONS: BusinessCollectionName[] = [
  'dogs',
  'breeding_cycles',
  'litters',
  'breeding_records',
  'health_records',
  'medication_tasks',
  'tasks',
  'expenses',
  'incomes',
  'sale_records',
  'agents',
  'dog_weights',
  'medication_protocols',
]
type ExportFormat = 'json' | 'csv'
type ExportMode = 'backup' | 'export'

interface BackupInfoCache {
  lastBackupDate: number | null
  autoBackupEnabled: boolean
  cachedAt: number
}

interface BackupInfoResponse {
  last_backup?: number | null
  auto_backup?: boolean
  lastBackupDate?: number | null
  autoBackupEnabled?: boolean
}

interface ExportFileResult {
  url: string
  fileID?: string
  format: ExportFormat
  mode: ExportMode
  size?: number
  created_at?: number
}

interface BackupHistoryFile {
  fileID: string
  url: string
  name: string
  created_at: number
}

interface SyncIssue {
  _id: string
  type: string
  status: string
  lastError: string
}

const exportResult = ref<ExportFileResult | null>(null)
const exportResultDownloading = ref(false)
const backupHistory = ref<BackupHistoryFile[]>([])
const backupHistoryLoading = ref(false)
const restoreTarget = ref<BackupHistoryFile | null>(null)
const restoringBackup = ref(false)
const syncIssues = ref<SyncIssue[]>([])
const syncStatusReady = ref(false)
const syncStatusChecking = ref(false)
const syncStatus = ref({
  pending: 0,
  processing: 0,
  failed: 0,
  conflict: 0,
  pendingUpload: 0,
})

const { currentFamily, navigateToLogin } = useAuth()
const { ensureOnline } = useOnlineOnlyGuard()
const { run: getBackupInfo } = useCloudCall<{ data: BackupInfoResponse }>('family-service', 'getBackupInfo')
const { run: getBackupHistory } = useCloudCall<{ data: { files: BackupHistoryFile[] } }>('family-service', 'getBackupHistory', {
  showLoading: false,
})
const { run: exportData } = useCloudCall<{ data: ExportFileResult }>('family-service', 'exportData', {
  showLoading: false,
})
const { run: restoreBackup } = useCloudCall<{ data: { restored: boolean; restored_file_id: string; pre_restore_file_id: string; restored_collections: string[] } }>('family-service', 'restoreBackup', {
  showLoading: false,
})
const { run: repairData } = useCloudCall<{ data: { checkedCollections: string[]; repairedCount: number; warnings: unknown[]; details: unknown[] } }>('family-service', 'repairData', {
  showLoading: false,
})
const { run: updateSettings } = useCloudCall('family-service', 'updateSettings')

const hasUnsyncedData = computed(() => {
  if (!syncStatusReady.value) return false
  const current = syncStatus.value
  return current.pending > 0
    || current.processing > 0
    || current.failed > 0
    || current.conflict > 0
    || current.pendingUpload > 0
})

const syncWarningText = computed(() => {
  const parts: string[] = []
  if (syncStatus.value.pending > 0 || syncStatus.value.processing > 0) {
    parts.push(`待同步 ${syncStatus.value.pending + syncStatus.value.processing} 条`)
  }
  if (syncStatus.value.failed > 0) {
    parts.push(`失败 ${syncStatus.value.failed} 条`)
  }
  if (syncStatus.value.conflict > 0) {
    parts.push(`冲突 ${syncStatus.value.conflict} 条`)
  }
  if (syncStatus.value.pendingUpload > 0) {
    parts.push(`待上传 ${syncStatus.value.pendingUpload} 条`)
  }
  return parts.join(' · ') || '仍有未同步数据'
})

const syncWarningCount = computed(() => {
  const current = syncStatus.value
  return current.pending
    + current.processing
    + current.failed
    + current.conflict
    + current.pendingUpload
})
const hasAuthExpiredIssue = computed(() => syncIssues.value.some(issue => isAuthTokenError(issue.lastError)))
const hasPendingUploadIssue = computed(() => syncIssues.value.some(issue => issue.status === 'pending_upload'))
const hasStaleUploadIssue = computed(() => syncIssues.value.some(issue => issue.status === 'pending_upload' && issue.lastError.includes('临时路径已失效')))
const retryButtonText = computed(() => {
  if (retryingSync.value) return '正在重试'
  return hasAuthExpiredIssue.value ? '重新登录' : '立即重试同步'
})
const syncPrimaryActionText = computed(() => {
  if (hasAuthExpiredIssue.value) return '重新登录'
  if (hasStaleUploadIssue.value) return '处理附件问题'
  if (hasPendingUploadIssue.value) return retryingSync.value ? '正在上传' : '上传附件'
  return retryButtonText.value
})
const syncPrimaryActionIcon = computed(() => {
  if (hasAuthExpiredIssue.value) return 'login'
  if (hasStaleUploadIssue.value) return 'edit'
  if (hasPendingUploadIssue.value) return 'cloud_upload'
  return 'sync'
})
const syncStatusIcon = computed(() => {
  if (!syncStatusReady.value || syncStatusChecking.value) return 'sync'
  return hasUnsyncedData.value ? 'cloud_sync' : 'cloud_done'
})
const syncStatusTitle = computed(() => {
  if (!syncStatusReady.value) return '正在检查同步状态'
  return hasUnsyncedData.value ? '备份前需完成同步' : '同步状态'
})
const syncStatusBadge = computed(() => {
  if (!syncStatusReady.value) return '检查中'
  return hasUnsyncedData.value ? `${syncWarningCount.value} 项` : '已同步'
})
const syncStatusDescription = computed(() => {
  if (!syncStatusReady.value) return '正在读取本机同步状态，确认后再备份或导出。'
  return hasUnsyncedData.value ? syncWarningText.value : '所有本地数据已同步，可安心备份或导出。'
})
const isDevMode = computed(() => {
  const devFlag = typeof globalThis !== 'undefined' ? (globalThis as any).__DEV__ : undefined
  return devFlag === true || import.meta.env.DEV === true
})
const exportResultName = computed(() => {
  if (!exportResult.value) return '备份文件'
  return getExportFileName(exportResult.value)
})

function getRemainingSyncToast() {
  if (!hasUnsyncedData.value) {
    return { title: '同步已完成', icon: 'success' as const }
  }
  if (syncStatus.value.failed > 0 || syncStatus.value.conflict > 0) {
    return { title: '仍有数据未同步成功', icon: 'none' as const }
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

function formatDate(ts: number): string {
  if (!ts) return ''
  const d = getBeijingDateParts(ts)
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')} ${String(d.hours).padStart(2, '0')}:${String(d.minutes).padStart(2, '0')}`
}

function formatBackupHistoryTime(ts: number): string {
  return ts ? formatDate(ts) : '未知时间'
}

function getBackupInfoCacheKey() {
  const familyId = currentFamily.value?._id || ''
  return familyId ? `${BACKUP_INFO_CACHE_PREFIX}${familyId}` : ''
}

function getBackupHistoryCacheKey() {
  const familyId = currentFamily.value?._id || ''
  return familyId ? `${BACKUP_HISTORY_CACHE_PREFIX}${familyId}` : ''
}

function normalizeBackupInfo(data: BackupInfoResponse = {}): BackupInfoCache {
  return {
    lastBackupDate: data.last_backup ?? data.lastBackupDate ?? null,
    autoBackupEnabled: !!(data.auto_backup ?? data.autoBackupEnabled),
    cachedAt: Date.now(),
  }
}

function applyBackupInfo(info: BackupInfoCache) {
  lastBackupDate.value = info.lastBackupDate ? formatDate(info.lastBackupDate) : ''
  autoBackup.value = info.autoBackupEnabled
}

function readCachedBackupInfo() {
  const key = getBackupInfoCacheKey()
  if (!key) return null
  try {
    const raw = uni.getStorageSync(key)
    if (!raw) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!parsed || typeof parsed !== 'object') return null
    return {
      lastBackupDate: parsed.lastBackupDate ? Number(parsed.lastBackupDate) : null,
      autoBackupEnabled: !!parsed.autoBackupEnabled,
      cachedAt: Number(parsed.cachedAt || 0),
    } satisfies BackupInfoCache
  } catch {
    return null
  }
}

function cacheBackupInfo(info: BackupInfoCache) {
  const key = getBackupInfoCacheKey()
  if (!key) return
  uni.setStorageSync(key, JSON.stringify(info))
}

function hydrateBackupInfoFromCache() {
  const cached = readCachedBackupInfo()
  if (!cached) return
  applyBackupInfo(cached)
}

function readCachedBackupHistory() {
  const key = getBackupHistoryCacheKey()
  if (!key) return []
  try {
    const raw = uni.getStorageSync(key)
    if (!raw) return []
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed?.files) ? parsed.files : []
  } catch {
    return []
  }
}

function cacheBackupHistory(files: BackupHistoryFile[]) {
  const key = getBackupHistoryCacheKey()
  if (!key) return
  uni.setStorageSync(key, JSON.stringify({
    files,
    cachedAt: Date.now(),
  }))
}

function hydrateBackupHistoryFromCache() {
  const files = readCachedBackupHistory()
  backupHistory.value = files
}

function formatDateForFileName(ts = Date.now()): string {
  const d = getBeijingDateParts(ts)
  return [
    d.year,
    String(d.month).padStart(2, '0'),
    String(d.day).padStart(2, '0'),
    String(d.hours).padStart(2, '0'),
    String(d.minutes).padStart(2, '0'),
  ].join('')
}

function getExportFileName(result: ExportFileResult): string {
  const extension = result.format === 'csv' ? 'zip' : 'json'
  const prefix = result.mode === 'backup' ? 'backup' : 'export'
  return `${prefix}-${formatDateForFileName(result.created_at)}.${extension}`
}

function getExportUrl(result: ExportFileResult | null): string {
  return String(result?.url || result?.fileID || '')
}

function normalizeSyncIssues(items: Array<Record<string, any>> = []): SyncIssue[] {
  return items.map(item => ({
    _id: String(item._id || ''),
    type: String(item.type || 'unknown'),
    status: String(item.status || ''),
    lastError: String(item.lastError || ''),
  }))
}

function applySyncSnapshot(currentSyncStatus: Record<string, any> | null | undefined, currentIssues: Array<Record<string, any>> = []) {
  syncStatus.value = {
    pending: Number(currentSyncStatus?.pending || 0),
    processing: Number(currentSyncStatus?.processing || 0),
    failed: Number(currentSyncStatus?.failed || 0),
    conflict: Number(currentSyncStatus?.conflict || 0),
    pendingUpload: Number(currentSyncStatus?.pendingUpload || 0),
  }
  syncIssues.value = normalizeSyncIssues([
    ...((currentSyncStatus?.pendingUploadIssues || []) as Array<Record<string, any>>),
    ...currentIssues,
  ])
  syncStatusReady.value = true
}

async function loadSyncSnapshot() {
  syncStatusChecking.value = true
  try {
    const [currentSyncStatus, currentIssues] = await Promise.all([
      localSyncRuntime.getSyncStatus(),
      localSyncRuntime.getOutboxIssues({ limit: 3 }),
    ])
    applySyncSnapshot(currentSyncStatus as Record<string, any>, currentIssues as Array<Record<string, any>>)
  } finally {
    syncStatusChecking.value = false
  }
}

async function loadBackupInfo() {
  if (!(await ensureOnline({ showToast: false }))) return
  const res = await getBackupInfo()
  const backupInfo = normalizeBackupInfo(res?.data)
  applyBackupInfo(backupInfo)
  cacheBackupInfo(backupInfo)
}

async function loadInfo() {
  const syncPromise = loadSyncSnapshot()
  const backupInfoPromise = loadBackupInfo()
  await Promise.allSettled([syncPromise, backupInfoPromise])
}

async function loadBackupHistory() {
  if (!(await ensureOnline({ showToast: false }))) {
    hydrateBackupHistoryFromCache()
    backupHistoryLoading.value = false
    return
  }
  backupHistoryLoading.value = true
  try {
    const res = await getBackupHistory()
    const files = res?.data?.files
    backupHistory.value = Array.isArray(files) ? files : []
    cacheBackupHistory(backupHistory.value)
  } catch {
    hydrateBackupHistoryFromCache()
  } finally {
    backupHistoryLoading.value = false
  }
}

async function toggleAutoBackup() {
  if (!(await ensureOnline())) return
  autoBackup.value = !autoBackup.value
  const cached = readCachedBackupInfo()
  cacheBackupInfo({
    lastBackupDate: cached?.lastBackupDate ?? null,
    autoBackupEnabled: autoBackup.value,
    cachedAt: Date.now(),
  })
  await updateSettings({ auto_backup_enabled: autoBackup.value })
}

async function clearLocalRestoredCollections(familyId: string) {
  if (!familyId) return
  for (const collection of RESTORE_SYNC_COLLECTIONS) {
    const rows = await localDb.getTable<any>(collection)
    await localDb.replaceTable(collection, rows.filter(row => row?.family_id !== familyId))
  }
}

async function ensureBackupReady() {
  const [currentSyncStatus, currentIssues] = await Promise.all([
    localSyncRuntime.getSyncStatus(),
    localSyncRuntime.getOutboxIssues({ limit: 3 }),
  ])
  applySyncSnapshot(currentSyncStatus as Record<string, any>, currentIssues as Array<Record<string, any>>)
  if (!hasUnsyncedData.value) return true
  uni.showToast({
    title: '仍有本地数据未同步，请稍后再备份',
    icon: 'none',
  })
  return false
}

function triggerH5Download(url: string, fileName: string) {
  // #ifdef H5
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.rel = 'noopener'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return true
  } catch (error) {
    console.warn('[backup] h5 download failed', error)
  }
  // #endif
  return false
}

function downloadToTempFile(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url,
      success: (res) => {
        const statusCode = Number(res.statusCode || 200)
        if (statusCode >= 200 && statusCode < 300 && res.tempFilePath) {
          resolve(res.tempFilePath)
          return
        }
        reject(new Error('下载文件失败'))
      },
      fail: reject,
    })
  })
}

function saveTempFile(tempFilePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const api = uni as typeof uni & {
      saveFile?: (options: {
        tempFilePath: string
        success?: (res: { savedFilePath?: string }) => void
        fail?: (error: unknown) => void
      }) => void
    }
    if (typeof api.saveFile !== 'function') {
      reject(new Error('当前平台不支持自动保存'))
      return
    }
    api.saveFile({
      tempFilePath,
      success: (res) => resolve(String(res.savedFilePath || tempFilePath)),
      fail: reject,
    })
  })
}

async function saveExportFile(
  result: ExportFileResult,
  successToast: { h5: string, saved: string } = {
    h5: '导出成功，已开始下载',
    saved: '已保存备份文件',
  },
) {
  const url = getExportUrl(result)
  if (!url) throw new Error('缺少下载链接')

  const fileName = getExportFileName(result)
  if (triggerH5Download(url, fileName)) {
    uni.showToast({ title: successToast.h5, icon: 'success' })
    return true
  }

  const tempFilePath = await downloadToTempFile(url)
  await saveTempFile(tempFilePath)
  uni.showToast({ title: successToast.saved, icon: 'success' })
  return true
}

function showExportFallback(result: ExportFileResult) {
  exportResult.value = result
  showExportResultSheet.value = true
}

async function trySaveExportFile(result: ExportFileResult) {
  try {
    await saveExportFile(result)
    return true
  } catch (error) {
    console.warn('[backup] direct export download failed', error)
    showExportFallback(result)
    return false
  }
}

async function downloadExportResult() {
  if (!exportResult.value || exportResultDownloading.value) return
  if (!(await ensureOnline())) return
  exportResultDownloading.value = true
  try {
    await saveExportFile(exportResult.value)
    showExportResultSheet.value = false
  } catch {
    uni.showToast({ title: '下载失败，可复制链接', icon: 'none' })
  } finally {
    exportResultDownloading.value = false
  }
}

async function downloadBackupHistory(file: BackupHistoryFile) {
  if (!file?.fileID || exportResultDownloading.value) return
  if (!(await ensureOnline())) return
  exportResultDownloading.value = true
  try {
    await saveExportFile({
      fileID: file.fileID,
      url: file.url,
      format: 'json',
      mode: 'backup',
      created_at: file.created_at,
    }, {
      h5: '备份文件已开始下载',
      saved: '备份文件已保存',
    })
  } catch {
    uni.showToast({ title: '下载失败', icon: 'none' })
  } finally {
    exportResultDownloading.value = false
  }
}

function copyExportResultLink() {
  const url = getExportUrl(exportResult.value)
  if (!url) {
    uni.showToast({ title: '缺少下载链接', icon: 'none' })
    return
  }
  uni.setClipboardData({
    data: url,
    success: () => {
      uni.showToast({ title: '链接已复制', icon: 'success' })
    },
  })
}

async function confirmRestoreBackup(file: BackupHistoryFile) {
  if (restoringBackup.value) return
  if (!(await ensureOnline())) return
  restoreTarget.value = file
  showRestoreConfirm.value = true
}

async function handleRestoreConfirm() {
  if (restoringBackup.value) return
  if (!(await ensureOnline())) return
  const target = restoreTarget.value || backupHistory.value[0]
  if (!target?.fileID) {
    uni.showToast({ title: '暂无可恢复的备份', icon: 'none' })
    showRestoreConfirm.value = false
    return
  }
  const ready = await ensureBackupReady()
  if (!ready) return
  const familyId = currentFamily.value?._id || ''
  if (!familyId) {
    uni.showToast({ title: '缺少家庭信息，无法恢复', icon: 'none' })
    return
  }

  restoringBackup.value = true
  try {
    await restoreBackup({ fileID: target.fileID })
    await clearLocalRestoredCollections(familyId)
    await localSyncRuntime.pullCollections(familyId, RESTORE_SYNC_COLLECTIONS, true)
    await Promise.all([loadInfo(), loadBackupHistory()])
    showRestoreConfirm.value = false
    uni.showToast({ title: '已恢复备份', icon: 'success' })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '恢复失败',
      icon: 'none',
    })
  } finally {
    restoringBackup.value = false
  }
}

async function retrySyncNow() {
  if (retryingSync.value) return
  if (!(await ensureOnline())) return
  if (hasAuthExpiredIssue.value || isCurrentLoginExpired()) {
    promptLoginExpired()
    return
  }
  if (hasStaleUploadIssue.value) {
    goToSyncStatus()
    return
  }
  const familyId = currentFamily.value?._id || ''
  if (!familyId) {
    uni.showToast({ title: '缺少家庭信息，无法同步', icon: 'none' })
    return
  }

  retryingSync.value = true
  try {
    if (hasPendingUploadIssue.value) {
      await localSyncRuntime.syncPendingAttachmentsNow(familyId)
    } else {
      await localSyncRuntime.retryFailedOutboxNow(familyId)
    }
    await loadInfo()
    uni.showToast(getRemainingSyncToast())
  } catch (error) {
    await loadInfo()
    if (isAuthTokenError(error)) {
      promptLoginExpired()
      return
    }
    uni.showToast({
      title: error instanceof Error ? error.message : '重试同步失败',
      icon: 'none',
    })
  } finally {
    retryingSync.value = false
  }
}

async function autoSyncPendingAttachments() {
  if (!syncStatusReady.value || !hasPendingUploadIssue.value || hasStaleUploadIssue.value || retryingSync.value) return
  if (!(await ensureOnline({ showToast: false }))) return
  const familyId = currentFamily.value?._id || ''
  if (!familyId) return
  retryingSync.value = true
  try {
    await localSyncRuntime.syncPendingAttachmentsNow(familyId)
    await loadInfo()
  } catch {
    await loadInfo()
  } finally {
    retryingSync.value = false
  }
}

async function runExport(format: ExportFormat, mode: ExportMode) {
  if (backingUp.value || exporting.value || repairing.value || restoringBackup.value) return
  if (!(await ensureOnline())) return
  const ready = await ensureBackupReady()
  if (!ready) return

  if (mode === 'backup') {
    backingUp.value = true
  } else {
    exporting.value = true
  }
  exportProgress.value = 0

  const timer = setInterval(() => {
    if (exportProgress.value < 90) {
      exportProgress.value += Math.floor(Math.random() * 15) + 5
      if (exportProgress.value > 90) exportProgress.value = 90
    }
  }, 300)

  try {
    const res = await exportData({ format, mode })
    exportProgress.value = 100
    clearInterval(timer)

    if (mode === 'backup') {
      uni.showToast({ title: '云端备份已完成', icon: 'success' })
    } else if (res?.data && getExportUrl(res.data)) {
      await trySaveExportFile(res.data)
    } else {
      uni.showToast({ title: '导出已完成', icon: 'success' })
    }
    loadInfo()
    if (mode === 'backup') {
      loadBackupHistory()
    }
  } catch {
    clearInterval(timer)
    uni.showToast({ title: '操作失败', icon: 'none' })
  } finally {
    setTimeout(() => {
      backingUp.value = false
      exporting.value = false
      exportProgress.value = 0
    }, 1000)
  }
}

function startBackup() {
  runExport('json', 'backup')
}

async function startExport() {
  if (backingUp.value || exporting.value || repairing.value || restoringBackup.value) return
  if (!(await ensureOnline())) return
  showExportSheet.value = true
}

function chooseExportFormat(format: 'json' | 'csv') {
  showExportSheet.value = false
  runExport(format, 'export')
}

async function startRepair() {
  if (restoringBackup.value) return
  if (!(await ensureOnline())) return
  showRepairConfirm.value = true
}

async function handleRepairConfirm() {
  if (repairing.value) return
  if (!(await ensureOnline())) return
  const ready = await ensureBackupReady()
  if (!ready) return

  repairing.value = true
  try {
    const res = await repairData({ dryRun: false })
    const repairedCount = Number(res?.data?.repairedCount || 0)
    const checkedCount = Number(res?.data?.checkedCollections?.length || 0)
    const warningCount = Number(res?.data?.warnings?.length || 0)
    repairResult.value = { checkedCount, repairedCount, warningCount }
    showRepairResult.value = true
    await loadInfo()
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '数据修复失败',
      icon: 'none',
    })
  } finally {
    repairing.value = false
  }
}

function goToRecycleBin() {
  uni.navigateTo({ url: '/pages/profile/recycle' })
}

function goToSyncStatus() {
  uni.navigateTo({ url: '/pages/profile/sync-status' })
}

onShow(() => {
  hydrateBackupInfoFromCache()
  hydrateBackupHistoryFromCache()
  void loadInfo().then(() => autoSyncPendingAttachments())
  loadBackupHistory()
})
</script>

<style lang="scss" scoped>
/* ==================== STATUS CARD ==================== */
.status-card {
  margin: 0 var(--space-page) 20px;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 4px 16px;
  box-shadow: var(--shadow);
}

.sync-warning-card {
  margin: 0 var(--space-page) 18px;
  padding: 14px;
  border-radius: var(--radius-card);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 248, 246, 0.94) 100%),
    var(--card);
  border: 1px solid rgba(224, 82, 82, 0.12);
  box-shadow: 0 10px 28px rgba(224, 82, 82, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 16px;
    right: 16px;
    height: 3px;
    border-radius: 0 0 999px 999px;
    background: linear-gradient(90deg, var(--red), var(--amber));
    opacity: 0.88;
  }

  &__header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    position: relative;
    z-index: 1;
  }

  &__icon-wrap {
    width: 38px;
    height: 38px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(224, 82, 82, 0.14), rgba(232, 155, 62, 0.12));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__icon {
    font-size: 21px;
    line-height: 1;
    color: var(--red);
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 3px;
  }

  &__title {
    font-size: 15px;
    font-weight: 800;
    line-height: 1.35;
    color: var(--text-1);
  }

  &__badge {
    padding: 3px 8px;
    border-radius: var(--radius-badge);
    background: rgba(224, 82, 82, 0.10);
    color: var(--red);
    font-size: 11px;
    font-weight: 800;
    line-height: 1.2;
    flex-shrink: 0;
  }

  &__desc {
    display: block;
    font-size: 12px;
    color: var(--text-2);
    line-height: 1.45;
  }

  &__hint-row {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    padding: 9px 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.62);
    border: 1px solid rgba(216, 203, 189, 0.42);
    position: relative;
    z-index: 1;
  }

  &__hint-icon {
    font-size: 15px;
    line-height: 1.35;
    color: var(--amber);
    flex-shrink: 0;
  }

  &__hint {
    flex: 1;
    font-size: 12px;
    color: var(--text-2);
    line-height: 1.45;
  }

  &__issues {
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: relative;
    z-index: 1;
  }

  &__issue {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 9px 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.78);
    border: 1px solid rgba(224, 82, 82, 0.08);
  }

  &__issue-type {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-2);
  }

  &__issue-error {
    font-size: 11px;
    line-height: 1.4;
    color: var(--red);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
    z-index: 1;
  }

  &__retry {
    flex: 1;
    height: 42px;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: var(--radius-btn);
    background: linear-gradient(135deg, var(--red), #e97862);
    color: #fff;
    font-size: 13px;
    font-weight: 800;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    box-shadow: 0 8px 18px rgba(224, 82, 82, 0.18);
    transition: transform 0.12s ease, opacity 0.12s ease;

    &::after {
      border: 0;
    }

    &:active {
      transform: scale(0.97);
    }

    &[disabled] {
      opacity: 0.72;
    }
  }

  &__retry-icon {
    font-size: 16px;
    color: #fff;
  }

  &__detail {
    min-width: 104px;
    height: 42px;
    box-sizing: border-box;
    margin: 0;
    padding: 0 12px;
    border: 0;
    border-radius: var(--radius-btn);
    background: rgba(255, 255, 255, 0.72);
    color: var(--text-2);
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    box-shadow: inset 0 0 0 1px rgba(216, 203, 189, 0.5);
    transition: transform 0.12s ease, opacity 0.12s ease;

    &::after {
      border: 0;
    }

    &:active {
      transform: scale(0.97);
      opacity: 0.86;
    }

    &--wide {
      flex: 1;
    }
  }

  &__detail-icon {
    font-size: 16px;
    color: var(--text-3);
  }

  &--ok {
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(245, 253, 249, 0.94) 100%),
      var(--card);
    border-color: rgba(61, 174, 111, 0.12);
    box-shadow: 0 10px 28px rgba(61, 174, 111, 0.07);

    &::before {
      background: linear-gradient(90deg, var(--green), #7fcfb0);
    }

    .sync-warning-card__icon-wrap {
      background: linear-gradient(135deg, rgba(61, 174, 111, 0.14), rgba(61, 174, 111, 0.08));
    }

    .sync-warning-card__icon {
      color: var(--green);
    }

    .sync-warning-card__badge {
      background: rgba(61, 174, 111, 0.10);
      color: var(--green);
    }
  }
}

/* ==================== CUSTOM TOGGLE ==================== */
.custom-toggle {
  width: 42px;
  height: 24px;
  border-radius: 12px;
  background: var(--text-4);
  position: relative;
  transition: background 0.2s ease;
  flex-shrink: 0;

  &__knob {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    position: absolute;
    top: 2px;
    left: 2px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    transition: left 0.2s ease;
  }

  &--on {
    background: var(--primary);
    .custom-toggle__knob { left: 20px; }
  }
}

/* ==================== BACKUP ACTIONS ==================== */
.backup-actions {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 24px;
}

.action-btn-ghost {
  width: 100%;
  height: 50px;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border-radius: var(--radius-btn);
  border: 1.5px solid var(--text-4);
  background: var(--card);
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  color: var(--text-1);
  font-family: var(--font-display);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;

  &::after {
    border: 0;
  }

  &[disabled] {
    color: var(--text-3);
    opacity: 1;
    background: rgba(255, 255, 255, 0.72);
    border-color: rgba(216, 203, 189, 0.42);
  }

  &:not([disabled]):active { transform: scale(0.94); opacity: 0.85; }
}

.action-btn-dim {
  width: 100%;
  height: 50px;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border-radius: var(--radius-btn);
  border: none;
  background: var(--card-dim);
  box-shadow: inset 0 0 0 1px rgba(216, 203, 189, 0.28);
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  color: var(--text-2);
  font-family: var(--font-display);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;

  &::after {
    border: 0;
  }

  &[disabled] {
    background: rgba(245, 242, 238, 0.96);
    color: var(--text-3);
    opacity: 1;
    box-shadow: inset 0 0 0 1px rgba(216, 203, 189, 0.2);
  }

  &:not([disabled]):active { transform: scale(0.94); opacity: 0.85; }
}

/* ==================== PROGRESS ==================== */
.progress-area {
  padding: 0 var(--space-page);
  margin-bottom: 20px;
}

.export-progress {
  display: flex;
  align-items: center;
  gap: 12px;

  &__bar {
    flex: 1;
    height: 6px;
    border-radius: var(--radius-progress);
    background: var(--card-dim);
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: var(--radius-progress);
    background: var(--primary);
    transition: width 0.3s ease;
  }

  &__label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
    white-space: nowrap;
  }

  &__text {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
    color: var(--primary);
    min-width: 40px;
    text-align: right;
  }
}

/* ==================== BACKUP HISTORY ==================== */
.backup-history-section {
  margin: 0 var(--space-page) 16px;
  padding: 16px;
  border-radius: var(--radius-card);
  background: var(--card);
  box-shadow: var(--shadow);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  &__title {
    font-size: 15px;
    font-weight: 800;
    color: var(--text-1);
  }

  &__count {
    padding: 3px 8px;
    border-radius: var(--radius-badge);
    background: var(--card-dim);
    color: var(--text-3);
    font-size: 11px;
    font-weight: 800;
  }

  &__empty {
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: var(--card-dim);
    color: var(--text-3);
    font-size: 13px;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
}

.backup-history-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 14px;
  background: var(--card-dim);

  &__icon-wrap {
    width: 38px;
    height: 38px;
    border-radius: 14px;
    background: rgba(61, 174, 111, 0.14);
    color: var(--green);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__icon {
    font-size: 19px;
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__title {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    line-height: 1.35;
    font-weight: 800;
    color: var(--text-1);
  }

  &__badge {
    padding: 2px 7px;
    border-radius: var(--radius-badge);
    background: rgba(61, 174, 111, 0.12);
    color: var(--green);
    font-size: 10px;
    font-weight: 800;
    flex-shrink: 0;
  }

  &__desc {
    display: block;
    margin-top: 3px;
    font-size: 11px;
    line-height: 1.35;
    color: var(--text-3);
    word-break: break-all;
  }

  &__actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  &__action {
    flex: 1;
    min-width: 0;
    height: 34px;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.78);
    color: var(--text-2);
    font-size: 12px;
    font-weight: 800;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    box-shadow: inset 0 0 0 1px rgba(216, 203, 189, 0.4);

    &::after {
      border: 0;
    }

    &[disabled] {
      opacity: 0.56;
    }

    &--danger {
      color: var(--red);
      background: rgba(224, 82, 82, 0.08);
      box-shadow: inset 0 0 0 1px rgba(224, 82, 82, 0.12);
    }
  }

  &__action-icon {
    font-size: 15px;
    line-height: 1;
  }
}

/* ==================== REPAIR RESULT ==================== */
.repair-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  margin-top: 8px;

  &__icon-wrap {
    width: 48px;
    height: 48px;
    border-radius: 18px;
    background: var(--green-soft);
    display: flex;
    align-items: center;
    justify-content: center;

    &--warning {
      background: var(--amber-soft);
    }
  }

  &__icon {
    font-size: 26px;
    color: var(--green);

    .repair-result__icon-wrap--warning & {
      color: var(--amber);
    }
  }

  &__stats {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  &__stat {
    min-width: 0;
    border-radius: 14px;
    background: var(--card-dim);
    padding: 10px 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;

    &--warning {
      background: var(--amber-soft);
    }
  }

  &__stat-value {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 800;
    color: var(--text-1);
    line-height: 1;
  }

  &__stat-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    line-height: 1.2;
  }

  &__desc {
    display: block;
    width: 100%;
    font-size: 13px;
    line-height: 1.5;
    text-align: center;
    color: var(--text-2);
  }
}

/* ==================== EXPORT FORMAT SHEET ==================== */
.export-format-sheet {
  padding: 0 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__item {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 70px;
    padding: 12px 14px;
    border-radius: var(--radius-card);
    border: 1px solid transparent;
    transition: transform 0.12s ease, opacity 0.12s ease;

    &:active {
      transform: scale(0.985);
      opacity: 0.82;
    }

    &--json {
      background: linear-gradient(135deg, rgba(234, 62, 119, 0.11), rgba(234, 62, 119, 0.05));
      border-color: rgba(234, 62, 119, 0.12);
    }

    &--csv {
      background: linear-gradient(135deg, rgba(61, 174, 111, 0.12), rgba(61, 174, 111, 0.05));
      border-color: rgba(61, 174, 111, 0.12);
    }
  }

  &__icon {
    width: 42px;
    height: 42px;
    border-radius: var(--radius-icon);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &--json {
      background: rgba(234, 62, 119, 0.16);
      color: var(--primary);
    }

    &--csv {
      background: rgba(61, 174, 111, 0.16);
      color: var(--green);
    }
  }

  &__icon-text {
    font-size: 20px;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__title {
    display: block;
    font-size: 15px;
    font-weight: 800;
    color: var(--text-1);
    line-height: 1.3;
  }

  &__desc {
    display: block;
    margin-top: 3px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-3);
  }

  &__arrow {
    font-size: 18px;
    color: var(--text-4);
    flex-shrink: 0;
  }
}

/* ==================== EXPORT RESULT SHEET ==================== */
.export-result-sheet {
  padding: 0 0 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__status {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
    border-radius: var(--radius-card);
    background: linear-gradient(135deg, rgba(61, 174, 111, 0.12), rgba(255, 255, 255, 0.82));
    border: 1px solid rgba(61, 174, 111, 0.14);
  }

  &__icon-wrap {
    width: 42px;
    height: 42px;
    border-radius: var(--radius-icon);
    background: rgba(61, 174, 111, 0.16);
    color: var(--green);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__icon {
    font-size: 21px;
    line-height: 1;
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__title {
    display: block;
    font-size: 15px;
    font-weight: 800;
    line-height: 1.35;
    color: var(--text-1);
    word-break: break-all;
  }

  &__desc {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--text-2);
  }

  &__hint {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--card-dim);
  }

  &__hint-icon {
    font-size: 15px;
    line-height: 1.35;
    color: var(--amber);
    flex-shrink: 0;
  }

  &__hint-text {
    flex: 1;
    font-size: 12px;
    line-height: 1.45;
    color: var(--text-2);
  }

  &__primary,
  &__secondary {
    width: 100%;
    height: 48px;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border-radius: var(--radius-btn);
    border: 0;
    font-size: 14px;
    font-weight: 800;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: transform 0.12s ease, opacity 0.12s ease;

    &::after {
      border: 0;
    }

    &:not([disabled]):active {
      transform: scale(0.96);
      opacity: 0.86;
    }
  }

  &__primary {
    background: var(--primary);
    color: #fff;

    &[disabled] {
      opacity: 0.72;
    }
  }

  &__secondary {
    background: var(--card-dim);
    color: var(--text-1);
    box-shadow: inset 0 0 0 1px rgba(216, 203, 189, 0.34);
  }

  &__button-icon {
    font-size: 17px;
    line-height: 1;
  }
}

/* ==================== RECYCLE SECTION ==================== */
.recycle-section {
  margin: 0 var(--space-page) 16px;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow);

  &__title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
    display: block;
    margin-bottom: 4px;
  }

  &__desc {
    font-size: 12px;
    color: var(--text-3);
    display: block;
    margin-bottom: 10px;
  }

  &__link {
    font-size: 13px;
    font-weight: 700;
    color: var(--primary);
  }
}

/* ==================== WARNING TEXT ==================== */
.warning-text {
  display: block;
  text-align: center;
  font-size: 11px;
  color: var(--text-3);
  padding: 0 var(--space-page);
  line-height: 1.5;
}
</style>
