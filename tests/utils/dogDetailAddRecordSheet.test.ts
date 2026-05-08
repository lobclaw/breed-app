import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/dog/detail.vue'), 'utf8')

describe('dog detail add record sheet source contract', () => {
  it('应把当前周期记录传给添加记录弹窗过滤器', () => {
    expect(source).toContain('createDogDetailAddRecordGroups({')
    expect(source).toContain('activeCycleRecords: activeCycleSummaryDetail.value?.records || []')
  })
})
