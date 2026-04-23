import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/finance/index.vue'), 'utf8')

describe('finance page entry dog filter contract', () => {
  it('应支持从路由 query 初始化犬只筛选', () => {
    expect(source).toContain("import { onLoad, onShow } from '@dcloudio/uni-app'")
    expect(source).toContain('function applyEntryDogFilter(query: Record<string, any> | undefined)')
    expect(source).toContain('const dogId = decodeQueryValue(query?.dogId)')
    expect(source).toContain('const dogName = decodeQueryValue(query?.dogName)')
    expect(source).toContain('selectedDogIds: [dogId]')
    expect(source).toContain('selectedDogNames: dogName ? [dogName] : []')
    expect(source).toContain('onLoad((query) => {')
    expect(source).toContain('applyEntryDogFilter(query as Record<string, any> | undefined)')
  })
})
