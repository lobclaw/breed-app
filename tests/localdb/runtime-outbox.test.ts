import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { localDb } from '../../src/localdb/db'
import { localSyncRuntime } from '../../src/localdb/runtime'

describe('local sync runtime outbox diagnostics', () => {
  beforeEach(async () => {
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('local_operation_logs', [])
    await localDb.replaceTable('sync_conflicts', [])
  })

  afterEach(() => {
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
})
