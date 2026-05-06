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

    <view v-if="hasUnsyncedData" class="sync-warning-card">
      <view class="sync-warning-card__header">
        <view class="sync-warning-card__icon-wrap">
          <text class="material-icons-round sync-warning-card__icon">cloud_sync</text>
        </view>
        <view class="sync-warning-card__main">
          <view class="sync-warning-card__title-row">
            <text class="sync-warning-card__title">备份前需完成同步</text>
            <text class="sync-warning-card__badge">{{ syncWarningCount }} 项</text>
          </view>
          <text class="sync-warning-card__desc">{{ syncWarningText }}</text>
        </view>
      </view>
      <view class="sync-warning-card__hint-row">
        <text class="material-icons-round sync-warning-card__hint-icon">info</text>
        <text class="sync-warning-card__hint">请先恢复联网并等待同步完成，再执行备份或导出，避免遗漏离线期间的数据。</text>
      </view>
      <view v-if="syncIssues.length" class="sync-warning-card__issues">
        <view v-for="issue in syncIssues" :key="issue._id" class="sync-warning-card__issue">
          <text class="sync-warning-card__issue-type">{{ issue.type }}</text>
          <text class="sync-warning-card__issue-error">{{ issue.lastError || '同步失败，等待重试' }}</text>
        </view>
      </view>
      <view class="sync-warning-card__actions">
        <button class="sync-warning-card__retry" :disabled="retryingSync" @click="retrySyncNow">
          <text class="material-icons-round sync-warning-card__retry-icon">sync</text>
          <text>{{ retryingSync ? '正在重试' : '立即重试同步' }}</text>
        </button>
        <button class="sync-warning-card__detail" @click="goToSyncStatus">
          <text>同步状态</text>
          <text class="material-icons-round sync-warning-card__detail-icon">chevron_right</text>
        </button>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="backup-actions">
      <BSubmitButton :loading="exporting" @click="startBackup">
        <text v-if="!exporting" class="material-icons-round" style="font-size: 18px; color: #fff; margin-right: 6px;">backup</text>
        立即备份
      </BSubmitButton>

      <button class="action-btn-ghost" @click="startExport">
        <text class="material-icons-round" style="font-size: 18px; color: var(--text-1); margin-right: 6px;">download</text>
        导出到本地
      </button>

      <button class="action-btn-dim" @click="startRepair">
        <text class="material-icons-round" style="font-size: 18px; color: var(--text-3); margin-right: 6px;">build</text>
        数据修复
      </button>
    </view>

    <!-- 进度条 -->
    <view v-if="exporting" class="progress-area">
      <view class="export-progress">
        <view class="export-progress__bar">
          <view class="export-progress__fill" :style="{ width: exportProgress + '%' }" />
        </view>
        <text class="export-progress__text">{{ exportProgress }}%</text>
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
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { useAuth } from '@/composables/useAuth'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BModal from '@/components/layout/BModal.vue'
import { localSyncRuntime } from '@/localdb/runtime'

const exporting = ref(false)
const retryingSync = ref(false)
const exportProgress = ref(0)
const lastBackupDate = ref('')
const autoBackup = ref(true)
const showRepairConfirm = ref(false)
interface SyncIssue {
  _id: string
  type: string
  status: string
  lastError: string
}

const syncIssues = ref<SyncIssue[]>([])
const syncStatus = ref({
  pending: 0,
  processing: 0,
  failed: 0,
  conflict: 0,
  pendingUpload: 0,
})

const { currentFamily } = useAuth()
const { run: getBackupInfo } = useCloudCall<{ data: { last_backup?: number; auto_backup?: boolean } }>('family-service', 'getBackupInfo')
const { run: exportData } = useCloudCall<{ data: { url: string } }>('family-service', 'exportData', {
  showLoading: false,
})
const { run: updateSettings } = useCloudCall('family-service', 'updateSettings')

const hasUnsyncedData = computed(() => {
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

function formatDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function normalizeSyncIssues(items: Array<Record<string, any>> = []): SyncIssue[] {
  return items.map(item => ({
    _id: String(item._id || ''),
    type: String(item.type || 'unknown'),
    status: String(item.status || ''),
    lastError: String(item.lastError || ''),
  }))
}

async function loadInfo() {
  const [res, currentSyncStatus, currentIssues] = await Promise.all([
    getBackupInfo(),
    localSyncRuntime.getSyncStatus(),
    localSyncRuntime.getOutboxIssues({ limit: 3 }),
  ])
  if (res?.data?.last_backup) {
    lastBackupDate.value = formatDate(res.data.last_backup)
  }
  if (res?.data?.auto_backup !== undefined) {
    autoBackup.value = res.data.auto_backup
  }
  syncStatus.value = {
    pending: Number(currentSyncStatus?.pending || 0),
    processing: Number(currentSyncStatus?.processing || 0),
    failed: Number(currentSyncStatus?.failed || 0),
    conflict: Number(currentSyncStatus?.conflict || 0),
    pendingUpload: Number(currentSyncStatus?.pendingUpload || 0),
  }
  syncIssues.value = normalizeSyncIssues(currentIssues as Array<Record<string, any>>)
}

async function toggleAutoBackup() {
  autoBackup.value = !autoBackup.value
  await updateSettings({ auto_backup: autoBackup.value })
}

async function ensureBackupReady() {
  const currentSyncStatus = await localSyncRuntime.getSyncStatus()
  syncIssues.value = normalizeSyncIssues(await localSyncRuntime.getOutboxIssues({ limit: 3 }))
  syncStatus.value = {
    pending: Number(currentSyncStatus?.pending || 0),
    processing: Number(currentSyncStatus?.processing || 0),
    failed: Number(currentSyncStatus?.failed || 0),
    conflict: Number(currentSyncStatus?.conflict || 0),
    pendingUpload: Number(currentSyncStatus?.pendingUpload || 0),
  }
  if (!hasUnsyncedData.value) return true
  uni.showToast({
    title: '仍有本地数据未同步，请稍后再备份',
    icon: 'none',
  })
  return false
}

async function retrySyncNow() {
  if (retryingSync.value) return
  const familyId = currentFamily.value?._id || ''
  if (!familyId) {
    uni.showToast({ title: '缺少家庭信息，无法同步', icon: 'none' })
    return
  }

  retryingSync.value = true
  try {
    await localSyncRuntime.retryFailedOutboxNow(familyId)
    await loadInfo()
    const hasRemainingIssues = syncStatus.value.failed > 0 || syncStatus.value.conflict > 0
    uni.showToast({
      title: hasRemainingIssues ? '仍有数据未同步成功' : '同步已完成',
      icon: hasRemainingIssues ? 'none' : 'success',
    })
  } catch (error) {
    await loadInfo()
    uni.showToast({
      title: error instanceof Error ? error.message : '重试同步失败',
      icon: 'none',
    })
  } finally {
    retryingSync.value = false
  }
}

async function runExport(format: string) {
  const ready = await ensureBackupReady()
  if (!ready) return

  exporting.value = true
  exportProgress.value = 0

  const timer = setInterval(() => {
    if (exportProgress.value < 90) {
      exportProgress.value += Math.floor(Math.random() * 15) + 5
      if (exportProgress.value > 90) exportProgress.value = 90
    }
  }, 300)

  try {
    const res = await exportData({ format })
    exportProgress.value = 100
    clearInterval(timer)

    if (res?.data?.url) {
      uni.setClipboardData({
        data: res.data.url,
        success: () => {
          uni.showToast({ title: '下载链接已复制', icon: 'success' })
        },
      })
    } else {
      uni.showToast({ title: '操作完成', icon: 'success' })
    }
    loadInfo()
  } catch {
    clearInterval(timer)
    uni.showToast({ title: '操作失败', icon: 'none' })
  } finally {
    setTimeout(() => {
      exporting.value = false
      exportProgress.value = 0
    }, 1000)
  }
}

function startBackup() {
  runExport('json')
}

function startExport() {
  uni.showActionSheet({
    itemList: ['JSON 格式', 'CSV 格式'],
    success: (res) => {
      runExport(res.tapIndex === 0 ? 'json' : 'csv')
    },
  })
}

function startRepair() {
  showRepairConfirm.value = true
}

function handleRepairConfirm() {
  uni.showToast({ title: '修复中...', icon: 'loading' })
}

function goToRecycleBin() {
  uni.navigateTo({ url: '/pages/profile/recycle' })
}

function goToSyncStatus() {
  uni.navigateTo({ url: '/pages/profile/sync-status' })
}

onShow(() => loadInfo())
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
    border: none;
    border-radius: var(--radius-btn);
    background: linear-gradient(135deg, var(--red), #e97862);
    color: #fff;
    font-size: 13px;
    font-weight: 800;
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
    border: 0;
    border-radius: var(--radius-btn);
    background: rgba(255, 255, 255, 0.72);
    color: var(--text-2);
    font-size: 13px;
    font-weight: 700;
    line-height: 42px;
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
  }

  &__detail-icon {
    font-size: 16px;
    color: var(--text-3);
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
  border-radius: var(--radius-btn);
  border: 1.5px solid var(--text-4);
  background: var(--card);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  font-family: var(--font-display);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
}

.action-btn-dim {
  width: 100%;
  height: 50px;
  border-radius: var(--radius-btn);
  border: none;
  background: var(--card-dim);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-2);
  font-family: var(--font-display);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
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

  &__text {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
    color: var(--primary);
    min-width: 40px;
    text-align: right;
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
