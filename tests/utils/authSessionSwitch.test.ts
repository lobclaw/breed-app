import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('auth session switch source contract', () => {
  it('登录切换账号时应先清空家庭态和本地缓存，避免首页闪现上一账号数据', () => {
    const auth = source('src/composables/useAuth.ts')
    const taskStore = source('src/stores/taskStore.ts')
    const home = source('src/pages/home/index.vue')

    expect(auth).toContain('function clearAuthScopedLocalState()')
    expect(auth).toContain('cacheFamily(null)')
    expect(auth).toContain("localSyncRuntime.setCurrentFamilyId('')")
    expect(auth).toContain('useTaskStore().clearForAuthChange()')
    expect(auth).toContain('useDogStore().clearForAuthChange()')
    expect(auth).toContain('useProtocolStore().clearForAuthChange()')

    expect(taskStore).toContain('clearForAuthChange()')
    expect(taskStore).toContain('this.cards = []')
    expect(taskStore).toContain('this.counts = { today: 0, week: 0, month30: 0, hasOverdue: false }')

    expect(home).toContain('function clearHomeForMissingFamily()')
    expect(home).toContain('taskStore.clearForAuthChange()')
    expect(home).toContain('clearHomeForMissingFamily()')
    expect(home.indexOf('clearHomeForMissingFamily()')).toBeLessThan(home.indexOf('const loadResult = await loadFamily()'))
  })
})
