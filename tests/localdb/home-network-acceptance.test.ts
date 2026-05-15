import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { localDb } from '../../src/localdb/db'
import { localSyncRuntime } from '../../src/localdb/runtime'

const HOME_COLLECTIONS = ['dogs', 'tasks', 'health_records', 'medication_tasks']
const NON_HOME_COLLECTIONS = ['breeding_cycles', 'breeding_records', 'expenses', 'incomes', 'sale_records']

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function installPullRecorder(options: { block?: boolean } = {}) {
  const release = options.block ? createDeferred() : null
  const calls: Array<{ collections: string[]; forceFull: boolean }> = []
  const pullCollections = vi.fn(async (input: { collections: string[]; forceFull?: boolean }) => {
    calls.push({
      collections: [...input.collections],
      forceFull: Boolean(input.forceFull),
    })
    if (release) await release.promise
    return {
      data: {
        collections: Object.fromEntries(input.collections.map(collection => [collection, {
          ok: true,
          rows: [],
          cursor: 0,
          cursorId: '',
          hasMore: false,
        }])),
      },
    }
  })

  ;(globalThis as any).uniCloud = {
    importObject: (serviceName: string) => {
      expect(serviceName).toBe('family-service')
      return { pullCollections }
    },
  }

  return { calls, pullCollections, release }
}

describe('home network acceptance', () => {
  beforeEach(async () => {
    await Promise.all([
      localDb.replaceTable('dogs', []),
      localDb.replaceTable('tasks', []),
      localDb.replaceTable('health_records', []),
      localDb.replaceTable('medication_tasks', []),
      localDb.replaceTable('sync_state', []),
      localDb.replaceTable('local_meta', []),
      localDb.replaceTable('outbox_mutations', []),
      localDb.replaceTable('sync_conflicts', []),
      localDb.replaceTable('sync_issues', []),
    ])
    localSyncRuntime.setCurrentFamilyId('')
  })

  afterEach(() => {
    delete (globalThis as any).uniCloud
    vi.restoreAllMocks()
  })

  it('首页进入、TTL 内重复进入、手动刷新都只请求 home scope 集合', async () => {
    const recorder = installPullRecorder()
    localSyncRuntime.setCurrentFamilyId('fam_home_network')

    const entry = await localSyncRuntime.syncScopeFromRoute('pages/home/index')
    expect(entry?.skipped).toBe(false)
    expect(entry?.pulledCollections).toEqual(HOME_COLLECTIONS)
    expect(recorder.calls).toEqual([{ collections: HOME_COLLECTIONS, forceFull: true }])

    const withinTtl = await localSyncRuntime.syncScopeFromRoute('pages/home/index')
    expect(withinTtl?.skipped).toBe(true)
    expect(withinTtl?.skipReason).toContain('ttl:')
    expect(recorder.pullCollections).toHaveBeenCalledTimes(1)

    const manualRefresh = await localSyncRuntime.forceSyncScope('home')
    expect(manualRefresh?.skipped).toBe(false)
    expect(recorder.pullCollections).toHaveBeenCalledTimes(2)
    expect(recorder.calls[1]).toEqual({ collections: HOME_COLLECTIONS, forceFull: true })

    for (const call of recorder.calls) {
      expect(call.collections).not.toEqual(expect.arrayContaining(NON_HOME_COLLECTIONS))
    }
  })

  it('同一 home scope 并发同步只发起一个 pullCollections 请求', async () => {
    const recorder = installPullRecorder({ block: true })
    localSyncRuntime.setCurrentFamilyId('fam_home_inflight')

    const firstSync = localSyncRuntime.syncScope('home', { force: true })
    await new Promise(resolve => setTimeout(resolve, 0))
    const secondSync = localSyncRuntime.forceSyncScope('home')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(recorder.calls).toEqual([{ collections: HOME_COLLECTIONS, forceFull: true }])
    recorder.release?.resolve()

    const [firstResult, secondResult] = await Promise.all([firstSync, secondSync])
    expect(secondResult).toBe(firstResult)
    expect(recorder.pullCollections).toHaveBeenCalledTimes(1)
  })
})
