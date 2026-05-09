import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('operation log page contract', () => {
  it('应合并读取本地待同步日志并展示同步状态', () => {
    const source = readSource('src/pages/profile/operation-log.vue')

    expect(source).toContain('localSyncRuntime.getLocalOperationLogs')
    expect(source).toContain('mergeOperationLogs')
    expect(source).toContain('syncStatusText')
    expect(source).toContain('displayLogs')
    expect(source).toContain('buildOperationLogFilterSignature')
    expect(source).toContain('readOperationLogCacheEntry')
    expect(source).toContain('writeOperationLogCacheEntry')
    expect(source).toContain('applyCachedOperationLogs')
    expect(source).toContain('offlineCacheMode')
  })

  it('操作日志离线缓存签名应交给稳定缓存工具生成', () => {
    const source = readSource('src/pages/profile/operation-log.vue')

    expect(source).toContain('buildOperationLogFilterSignature({')
    expect(source).toContain('range: activeDateRange.value')
    expect(source).toContain('actorUserIds: normalizeSelection(activeMemberIds.value)')
    expect(source).toContain('actionTypes: normalizeSelection(activeActionTypes.value)')
    expect(source).not.toContain('function getOperationLogFilterSignature(range')

    const signatureBlock = source.match(/function getOperationLogFilterSignature\(\) \{[\s\S]*?\n\}/)?.[0] || ''
    expect(signatureBlock).toContain('buildOperationLogFilterSignature')
    expect(signatureBlock).not.toContain('range.start')
    expect(signatureBlock).not.toContain('range.end')
  })
})
