import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const testDir = __dirname
const source = readFileSync(resolve(testDir, '../../src/pages/home/index.vue'), 'utf8')

describe('home local-first entry contract', () => {
  it('首页进入时应先读取本地渲染，再后台同步 home scope', () => {
    expect(source).toContain('await loadAll()')
    expect(source).toContain("void localSyncRuntime.syncScope('home').then(() => {")
    expect(source).not.toContain("await localSyncRuntime.syncScope('home')")
  })
})
