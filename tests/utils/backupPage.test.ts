import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('backup page contract', () => {
  it('应在备份前检查本地同步状态并跳转到回收站页', () => {
    const source = readSource('src/pages/profile/backup.vue')

    expect(source).toContain('localSyncRuntime.getSyncStatus()')
    expect(source).toContain('localSyncRuntime.getOutboxIssues')
    expect(source).toContain('localSyncRuntime.retryFailedOutboxNow')
    expect(source).toContain('立即重试同步')
    expect(source).toContain('仍有本地数据未同步')
    expect(source).toContain("uni.navigateTo({ url: '/pages/profile/recycle' })")
  })
})
