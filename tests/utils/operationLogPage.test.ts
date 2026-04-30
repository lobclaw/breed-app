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
  })
})
