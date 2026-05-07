import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('backup page contract', () => {
  it('应在备份前检查本地同步状态并跳转到回收站页', () => {
    const source = readSource('src/pages/profile/backup.vue')

    expect(source).toContain('BACKUP_INFO_CACHE_PREFIX')
    expect(source).toContain('hydrateBackupInfoFromCache()')
    expect(source).toContain('uni.getStorageSync(key)')
    expect(source).toContain('uni.setStorageSync(key, JSON.stringify(info))')
    expect(source).toContain('localSyncRuntime.getSyncStatus()')
    expect(source).toContain('localSyncRuntime.getOutboxIssues')
    expect(source).toContain('localSyncRuntime.retryFailedOutboxNow')
    expect(source).toContain('立即重试同步')
    expect(source).toContain('所有本地数据已同步，可安心备份或导出。')
    expect(source).toContain('查看同步状态')
    expect(source).toContain('仍有本地数据未同步')
    expect(source).toContain("uni.navigateTo({ url: '/pages/profile/recycle' })")
  })

  it('应将同步状态入口收纳到数据备份页，抽屉不再单独展示', () => {
    const backupSource = readSource('src/pages/profile/backup.vue')
    const profileSource = readSource('src/pages/profile/index.vue')

    expect(backupSource).toContain("uni.navigateTo({ url: '/pages/profile/sync-status' })")
    expect(profileSource).not.toContain("{ label: '同步状态', icon: 'sync', url: '/pages/profile/sync-status' }")
    expect(profileSource).toContain("{ label: '数据备份', icon: 'backup', url: '/pages/profile/backup' }")
    expect(profileSource).not.toContain('数据备份/导出')
  })

  it('应区分备份/导出模式并接入真实修复接口', () => {
    const source = readSource('src/pages/profile/backup.vue')

    expect(source).toContain("runExport('json', 'backup')")
    expect(source).toContain("runExport(format, 'export')")
    expect(source).toContain(':loading="backingUp"')
    expect(source).toContain("{{ exporting ? '导出中' : '导出到本地' }}")
    expect(source).toContain('v-model:visible="showExportSheet"')
    expect(source).toContain("chooseExportFormat('json')")
    expect(source).toContain("chooseExportFormat('csv')")
    expect(source).not.toContain('uni.showActionSheet')
    expect(source).toContain("if (mode === 'backup')")
    expect(source).toContain("title: '云端备份已完成'")
    expect(source).toContain('downloadToTempFile')
    expect(source).toContain('saveExportFile')
    expect(source).toContain('v-model:visible="showExportResultSheet"')
    expect(source).toContain('下载文件')
    expect(source).toContain('复制下载链接')
    expect(source).toContain('备份历史')
    expect(source).toContain("('family-service', 'getBackupHistory'")
    expect(source).toContain("('family-service', 'restoreBackup'")
    expect(source).toContain('handleRestoreConfirm')
    expect(source).toContain('clearLocalRestoredCollections')
    expect(source).toContain('localSyncRuntime.pullCollections(familyId, RESTORE_SYNC_COLLECTIONS, true)')
    expect(source).toContain("title: '链接已复制'")
    expect(source).not.toContain("title: '下载链接已复制'")
    expect(source).toContain('auto_backup_enabled')
    expect(source).toContain("useCloudCall<{ data: ExportFileResult }>")
    expect(source).toContain("useCloudCall<{ data: { checkedCollections")
    expect(source).toContain("('family-service', 'repairData'")
    expect(source).toContain('v-model:visible="showRepairResult"')
    expect(source).toContain(':showCancel="false"')
    expect(source).not.toContain('uni.showModal')
  })
})
