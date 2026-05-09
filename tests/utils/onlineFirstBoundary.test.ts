import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('online-first boundary contract', () => {
  const onlineFirstPages = [
    'src/pages/family/members.vue',
    'src/pages/profile/backup.vue',
    'src/pages/profile/operation-log.vue',
  ]

  it('在线优先页不应接入普通 usePageSync', () => {
    for (const file of onlineFirstPages) {
      const source = readSource(file)
      expect(source, `${file} should stay online-first`).not.toContain('usePageSync(')
    }
  })

  it('在线优先页的云端动作应使用统一联网守卫', () => {
    for (const file of onlineFirstPages) {
      const source = readSource(file)
      expect(source, `${file} should import guard`).toContain("useOnlineOnlyGuard")
      expect(source, `${file} should call ensureOnline`).toContain('ensureOnline(')
    }
  })

  it('操作日志应缓存第一页云端日志并支持离线展示缓存', () => {
    const source = readSource('src/pages/profile/operation-log.vue')

    expect(source).toContain('cacheOperationLogs')
    expect(source).toContain('readOperationLogCache')
    expect(source).toContain('applyCachedOperationLogs')
    expect(source).toContain('readOperationLogCacheEntry')
    expect(source).toContain('writeOperationLogCacheEntry')
    expect(source).toContain('离线，仅显示本地缓存和待同步操作')
    expect(source).toContain('!offlineCacheMode')
  })

  it('备份页应缓存备份历史并在进入页面时先回填缓存', () => {
    const source = readSource('src/pages/profile/backup.vue')

    expect(source).toContain('BACKUP_HISTORY_CACHE_PREFIX')
    expect(source).toContain('readCachedBackupHistory')
    expect(source).toContain('cacheBackupHistory')
    expect(source).toContain('hydrateBackupHistoryFromCache()')
    expect(source).toContain('cacheBackupHistory(backupHistory.value)')
  })

  it('useCloudCall 应复用统一网络检测工具', () => {
    const source = readSource('src/composables/useCloudCall.ts')

    expect(source).toContain("import { isNetworkAvailable, ONLINE_ONLY_MESSAGE } from '@/utils/network'")
    expect(source).not.toContain('async function isNetworkAvailable()')
  })
})
