import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('auth session switch source contract', () => {
  it('登录切换账号时应先清空会话态，家庭权限确认后才恢复当前家庭快照', () => {
    const auth = source('src/composables/useAuth.ts')
    const taskStore = source('src/stores/taskStore.ts')
    const dogStore = source('src/stores/dogStore.ts')
    const protocolStore = source('src/stores/protocolStore.ts')
    const home = source('src/pages/home/index.vue')

    expect(auth).toContain('function clearCurrentSession()')
    expect(auth).toContain('const isFamilyVerified = ref(false)')
    expect(auth).toContain('restoreFamilyFromCache(info.uid)')
    expect(auth).toContain("localSyncRuntime.setCurrentFamilyId('')")
    expect(auth).toContain('useTaskStore().clearCurrentSession()')
    expect(auth).toContain('useDogStore().clearCurrentSession()')
    expect(auth).toContain('useProtocolStore().clearCurrentSession()')
    expect(auth).toContain('function shouldRestoreWorkspaceForFamily(family: Family)')
    expect(auth).toContain('if (shouldRestoreWorkspace) restoreWorkspaceForFamily(family._id)')
    expect(auth).toContain('getFamilyCacheKey(uid)')

    const setCurrentFamilyStart = auth.indexOf('function setCurrentFamily(family: Family | null)')
    const setCurrentFamilyEnd = auth.indexOf('async function refreshFamilyFromLocal', setCurrentFamilyStart)
    const setCurrentFamilyMethod = auth.slice(setCurrentFamilyStart, setCurrentFamilyEnd)
    expect(setCurrentFamilyMethod).not.toContain('restoreWorkspaceForFamily')

    expect(taskStore).toContain('restoreForFamily(familyId: string)')
    expect(taskStore).toContain('persistForFamily(familyId: string)')
    expect(taskStore).toContain('clearCurrentSession()')
    expect(taskStore).toContain('this.cards = []')
    expect(taskStore).toContain('this.counts = { today: 0, week: 0, month30: 0, hasOverdue: false }')
    expect(taskStore).toContain('snapshot.dayKey !== getTodayWorkspaceDayKey()')
    expect(taskStore).not.toContain('unistorage:')

    expect(dogStore).toContain('restoreForFamily(familyId: string)')
    expect(dogStore).toContain('persistForFamily(familyId: string)')
    expect(dogStore).toContain('clearCurrentSession()')
    expect(dogStore).not.toContain('unistorage:')

    expect(protocolStore).toContain('restoreForFamily(familyId: string)')
    expect(protocolStore).toContain('persistForFamily(familyId: string)')
    expect(protocolStore).toContain('clearCurrentSession()')
    expect(protocolStore).not.toContain('unistorage:')

    expect(home).toContain('function clearHomeForMissingFamily()')
    expect(home).toContain('taskStore.clearCurrentSession()')
    expect(home).toContain('!hasFamily.value || !isFamilyVerified.value')
    expect(home).toContain('clearHomeForMissingFamily()')
    expect(home.indexOf('clearHomeForMissingFamily()')).toBeLessThan(home.indexOf('const loadResult = await loadFamily()'))
    expect(home).toContain('taskStore.persistForFamily(familyId)')
  })
})
