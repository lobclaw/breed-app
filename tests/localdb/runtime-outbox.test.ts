import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { localDb } from '../../src/localdb/db'
import { localSyncRuntime } from '../../src/localdb/runtime'

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('local sync runtime outbox diagnostics', () => {
  beforeEach(async () => {
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])
    await localDb.replaceTable('sync_conflicts', [])
    await localDb.replaceTable('sync_state', [])
    await localDb.replaceTable('local_meta', [])
    await localDb.replaceTable('dogs', [])
    await localDb.replaceTable('tasks', [])
    await localDb.replaceTable('health_records', [])
    await localDb.replaceTable('medication_tasks', [])
    localSyncRuntime.setCurrentFamilyId('')
  })

  afterEach(() => {
    delete (globalThis as any).uniCloud
    vi.restoreAllMocks()
  })

  it('应返回最近失败的 outbox 详情', async () => {
    await localDb.upsertRows('outbox_mutations', [
      {
        _id: 'outbox_1',
        type: 'task.complete',
        collection_scope: ['tasks'],
        payload: {},
        family_id: 'fam_1',
        status: 'failed',
        retry_count: 2,
        next_retry_at: 1000,
        last_error: '云端方法不存在',
        client_mutation_id: 'mutation_1',
        device_id: 'device_1',
        created_at: 1,
        updated_at: 10,
      },
      {
        _id: 'outbox_2',
        type: 'dog.create',
        collection_scope: ['dogs'],
        payload: {},
        family_id: 'fam_1',
        status: 'pending',
        retry_count: 0,
        next_retry_at: 0,
        last_error: null,
        client_mutation_id: 'mutation_2',
        device_id: 'device_1',
        created_at: 2,
        updated_at: 20,
      },
    ])

    expect(await localSyncRuntime.getOutboxIssues()).toEqual([{
      _id: 'outbox_1',
      type: 'task.complete',
      status: 'failed',
      retryCount: 2,
      nextRetryAt: 1000,
      lastError: '云端方法不存在',
      createdAt: 1,
      updatedAt: 10,
    }])
  })

  it('应用 sync_conflicts 详情替换冲突项的旧错误文案', async () => {
    await localDb.upsertRows('outbox_mutations', [{
      _id: 'outbox_1',
      type: 'task.batchComplete',
      collection_scope: ['tasks'],
      payload: {},
      family_id: 'fam_1',
      status: 'conflict',
      retry_count: 1,
      next_retry_at: 0,
      last_error: 'not found collection',
      client_mutation_id: 'mutation_1',
      device_id: 'device_1',
      created_at: 1,
      updated_at: 10,
    }])
    await localDb.upsertRows('sync_conflicts', [{
      _id: 'conflict_mutation_1',
      client_mutation_id: 'mutation_1',
      collection: 'tasks',
      entity_id: 'task_1',
      base_version: 0,
      server_version: 2,
      status: 'open',
      detail: null,
      created_at: 10,
      updated_at: 10,
    }])

    expect(await localSyncRuntime.getOutboxIssues()).toMatchObject([{
      _id: 'outbox_1',
      status: 'conflict',
      lastError: '版本冲突：tasks/task_1 本地 0，云端 2',
    }])
  })

  it('flush 时遇到版本冲突应自动更新 baseVersion 并继续同步', async () => {
    await localDb.upsertRows('outbox_mutations', [{
      _id: 'outbox_1',
      type: 'task.batchComplete',
      collection_scope: [],
      payload: {
        taskIds: ['task_1'],
        _sync: {
          clientMutationId: 'mutation_1',
          deviceId: 'device_1',
          clientTimestamp: 1,
          baseVersions: {
            task_1: 0,
          },
        },
      },
      family_id: 'fam_1',
      status: 'pending',
      retry_count: 0,
      next_retry_at: 0,
      last_error: null,
      client_mutation_id: 'mutation_1',
      device_id: 'device_1',
      created_at: 1,
      updated_at: 1,
    }])

    const dispatchSpy = vi.spyOn(localSyncRuntime as any, 'dispatchMutation')
      .mockResolvedValueOnce({
        ack: 'conflict',
        clientMutationId: 'mutation_1',
        touchedEntities: [],
        resyncScopes: [],
        conflict: {
          collection: 'tasks',
          entityId: 'task_1',
          baseVersion: 0,
          serverVersion: 2,
          reason: 'version_mismatch',
        },
      })
      .mockResolvedValueOnce({
        ack: 'accepted',
        clientMutationId: 'mutation_1',
        touchedEntities: [],
        resyncScopes: [],
        conflict: null,
      })

    await localSyncRuntime.flushOutbox('fam_1')

    expect(dispatchSpy).toHaveBeenCalledTimes(2)
    expect(dispatchSpy.mock.calls[1]?.[0].payload._sync.baseVersions.task_1).toBe(2)
    expect(await localDb.findById<any>('outbox_mutations', 'outbox_1')).toMatchObject({
      status: 'synced',
      retry_count: 1,
      last_error: null,
    })
    expect(await localDb.getTable('sync_conflicts')).toHaveLength(0)
  })

  it('flush 时只处理当前家庭的 outbox', async () => {
    await localDb.upsertRows('outbox_mutations', [
      {
        _id: 'outbox_fam_1',
        type: 'task.complete',
        collection_scope: [],
        payload: {},
        family_id: 'fam_1',
        status: 'pending',
        retry_count: 0,
        next_retry_at: 0,
        last_error: null,
        client_mutation_id: 'mutation_fam_1',
        device_id: 'device_1',
        created_at: 1,
        updated_at: 1,
      },
      {
        _id: 'outbox_fam_2',
        type: 'task.complete',
        collection_scope: [],
        payload: {},
        family_id: 'fam_2',
        status: 'pending',
        retry_count: 0,
        next_retry_at: 0,
        last_error: null,
        client_mutation_id: 'mutation_fam_2',
        device_id: 'device_1',
        created_at: 2,
        updated_at: 2,
      },
    ])

    const dispatchSpy = vi.spyOn(localSyncRuntime as any, 'dispatchMutation')
      .mockResolvedValue({
        ack: 'accepted',
        clientMutationId: 'mutation_fam_1',
        touchedEntities: [],
        resyncScopes: [],
        conflict: null,
      })

    await localSyncRuntime.flushOutbox('fam_1')

    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    expect(dispatchSpy.mock.calls[0]?.[0].family_id).toBe('fam_1')
    expect(await localDb.findById<any>('outbox_mutations', 'outbox_fam_1')).toMatchObject({
      status: 'synced',
    })
    expect(await localDb.findById<any>('outbox_mutations', 'outbox_fam_2')).toMatchObject({
      status: 'pending',
    })
  })

  it('outbox 问题列表应按当前家庭过滤', async () => {
    await localDb.upsertRows('outbox_mutations', [
      {
        _id: 'outbox_fam_1',
        type: 'task.complete',
        collection_scope: [],
        payload: {},
        family_id: 'fam_1',
        status: 'failed',
        retry_count: 1,
        next_retry_at: 0,
        last_error: 'fam_1 failed',
        client_mutation_id: 'mutation_fam_1',
        device_id: 'device_1',
        created_at: 1,
        updated_at: 1,
      },
      {
        _id: 'outbox_fam_2',
        type: 'task.complete',
        collection_scope: [],
        payload: {},
        family_id: 'fam_2',
        status: 'failed',
        retry_count: 1,
        next_retry_at: 0,
        last_error: 'fam_2 failed',
        client_mutation_id: 'mutation_fam_2',
        device_id: 'device_1',
        created_at: 2,
        updated_at: 2,
      },
    ])

    localSyncRuntime.setCurrentFamilyId('fam_1')

    expect(await localSyncRuntime.getOutboxIssues()).toMatchObject([{
      _id: 'outbox_fam_1',
      lastError: 'fam_1 failed',
    }])
  })

  it('冲突手动重试成功后应关闭 retrying 冲突记录', async () => {
    await localDb.upsertRows('outbox_mutations', [{
      _id: 'outbox_conflict',
      type: 'task.complete',
      collection_scope: [],
      payload: {
        taskId: 'task_1',
        _sync: {
          clientMutationId: 'mutation_conflict',
          deviceId: 'device_1',
          clientTimestamp: 1,
          baseVersions: {
            task_1: 0,
          },
        },
      },
      family_id: 'fam_1',
      status: 'conflict',
      retry_count: 1,
      next_retry_at: 0,
      last_error: '版本冲突',
      client_mutation_id: 'mutation_conflict',
      device_id: 'device_1',
      created_at: 1,
      updated_at: 1,
    }])
    await localDb.upsertRows('sync_conflicts', [{
      _id: 'conflict_mutation_conflict',
      client_mutation_id: 'mutation_conflict',
      collection: 'tasks',
      entity_id: 'task_1',
      base_version: 0,
      server_version: 2,
      status: 'open',
      detail: null,
      created_at: 1,
      updated_at: 1,
    }])

    vi.spyOn(localSyncRuntime as any, 'dispatchMutation')
      .mockResolvedValue({
        ack: 'accepted',
        clientMutationId: 'mutation_conflict',
        touchedEntities: [],
        resyncScopes: [],
        conflict: null,
      })

    await localSyncRuntime.retryFailedOutboxNow('fam_1')

    expect(await localDb.findById<any>('outbox_mutations', 'outbox_conflict')).toMatchObject({
      status: 'synced',
      last_error: null,
    })
    expect(await localDb.findById<any>('sync_conflicts', 'conflict_mutation_conflict')).toMatchObject({
      status: 'resolved',
    })
  })

  it('强制同步应复用同 scope 的 in-flight 请求', async () => {
    const releasePull = createDeferred()
    const getCalls: string[] = []

    ;(globalThis as any).uniCloud = {
      database: () => ({
        command: {
          gte: (value: number) => ({ $gte: value }),
        },
        collection: (collection: string) => {
          const chain = {
            where: vi.fn(() => chain),
            orderBy: vi.fn(() => chain),
            limit: vi.fn(() => chain),
            get: vi.fn(async () => {
              getCalls.push(collection)
              await releasePull.promise
              return { data: [] }
            }),
          }
          return chain
        },
      }),
    }

    localSyncRuntime.setCurrentFamilyId('fam_1')
    const firstSync = localSyncRuntime.syncScope('home', { force: true })
    await new Promise(resolve => setTimeout(resolve, 0))

    const forceSync = localSyncRuntime.forceSyncScope('home')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(getCalls).toHaveLength(4)
    releasePull.resolve()

    const [firstResult, forceResult] = await Promise.all([firstSync, forceSync])
    expect(forceResult).toBe(firstResult)
    expect(getCalls).toHaveLength(4)
  })
})
