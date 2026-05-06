import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const testDir = __dirname
const source = readFileSync(resolve(testDir, '../../src/pages/home/index.vue'), 'utf8')

describe('home card exit animation contract', () => {
  it('本地刷新前应等待首页卡片退场动画结束', () => {
    expect(source).toContain('const pendingCardExitPromises = new Set<Promise<void>>()')
    expect(source).toContain('function trackCardExit(promise: Promise<void>)')
    expect(source).toContain('async function waitForPendingCardExits()')
    expect(source).toContain('await waitForPendingCardExits()')
    expect(source).toContain('trackCardExit(new Promise((resolve) => {')
  })
})
