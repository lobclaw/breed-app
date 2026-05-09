import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { localDb } from '../../src/localdb/db'
import { localSyncRuntime } from '../../src/localdb/runtime'
import { createMockUniCloud } from '../helpers/mock-unicloud'

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
    await localDb.replaceTable('image_cache_entries', [])
    await localDb.replaceTable('dogs', [])
    await localDb.replaceTable('tasks', [])
    await localDb.replaceTable('health_records', [])
    await localDb.replaceTable('breeding_records', [])
    await localDb.replaceTable('medication_tasks', [])
    await localDb.replaceTable('expenses', [])
    await localDb.replaceTable('incomes', [])
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

  it('上传待传附件后应替换本地记录与 outbox payload', async () => {
    const mockUniCloud = createMockUniCloud()
    ;(globalThis as any).uniCloud = mockUniCloud
    const localImage = 'wxfile://tmp/receipt.jpg'

    await localDb.replaceTable('expenses', [{
      _id: 'expense_upload_1',
      family_id: 'fam_upload',
      total_amount: 120,
      category: '医疗',
      images: [localImage],
      date: 1000,
      updated_at: 1000,
      _pending_upload: true,
      pending_upload: true,
    }])
    await localDb.replaceTable('outbox_mutations', [{
      _id: 'outbox_upload_1',
      type: 'finance.addExpense',
      collection_scope: ['expenses'],
      payload: {
        total_amount: 120,
        category: '医疗',
        images: [localImage],
        _sync: { clientMutationId: 'upload_1', deviceId: 'device_1', clientTimestamp: 1000 },
      },
      family_id: 'fam_upload',
      status: 'pending',
      retry_count: 0,
      next_retry_at: 0,
      last_error: null,
      client_mutation_id: 'upload_1',
      device_id: 'device_1',
      created_at: 1000,
      updated_at: 1000,
    }])

    const result = await localSyncRuntime.uploadPendingAttachments('fam_upload')
    const [expense] = await localDb.getTable<any>('expenses')
    const [mutation] = await localDb.getOutbox()
    const uploadedFiles = (mockUniCloud as any).__getUploadedFiles()
    const uploadedRef = uploadedFiles[0].fileID

    expect(result.uploaded).toBe(1)
    expect(uploadedFiles[0].cloudPath).toContain('attachments/fam_upload/expenses/expense_upload_1/')
    expect(uploadedFiles[0].fileContent.toString()).toBe(localImage)
    expect(expense.images).toEqual([uploadedRef])
    expect(expense._pending_upload).toBe(false)
    expect(expense.pending_upload).toBe(false)
    expect(mutation.payload.images).toEqual([uploadedRef])
    const imageCache = await localDb.getTable<any>('image_cache_entries')
    expect(imageCache).toEqual([expect.objectContaining({
      file_id: uploadedRef,
      family_id: 'fam_upload',
      local_src: localImage,
    })])
  })

  it('待传标记遇到已上传图片时应自动清理', async () => {
    ;(globalThis as any).uniCloud = createMockUniCloud()
    await localDb.replaceTable('expenses', [{
      _id: 'expense_uploaded_1',
      family_id: 'fam_upload',
      total_amount: 80,
      category: '医疗',
      images: ['cloud://receipt.jpg'],
      date: 1000,
      updated_at: 1000,
      _pending_upload: true,
      pending_upload: true,
    }])

    const result = await localSyncRuntime.uploadPendingAttachments('fam_upload')
    const [expense] = await localDb.getTable<any>('expenses')

    expect(result.uploaded).toBe(0)
    expect(expense._pending_upload).toBe(false)
    expect(expense.pending_upload).toBe(false)
  })

  it('附件上传失败时应保留待上传状态和错误原因', async () => {
    const mockUniCloud = createMockUniCloud()
    ;(mockUniCloud.uploadFile as any).mockRejectedValueOnce(new Error('upload denied'))
    ;(globalThis as any).uniCloud = mockUniCloud
    const localImage = 'wxfile://tmp/failed.jpg'

    await localDb.replaceTable('expenses', [{
      _id: 'expense_upload_failed',
      family_id: 'fam_upload',
      total_amount: 120,
      category: '医疗',
      images: [localImage],
      date: 1000,
      updated_at: 1000,
      _pending_upload: true,
      pending_upload: true,
    }])
    await localDb.replaceTable('outbox_mutations', [{
      _id: 'outbox_upload_failed',
      type: 'finance.addExpense',
      collection_scope: ['expenses'],
      payload: {
        images: [localImage],
        _sync: { clientMutationId: 'upload_failed', deviceId: 'device_1', clientTimestamp: 1000 },
      },
      family_id: 'fam_upload',
      status: 'pending',
      retry_count: 0,
      next_retry_at: 0,
      last_error: null,
      client_mutation_id: 'upload_failed',
      device_id: 'device_1',
      created_at: 1000,
      updated_at: 1000,
    }])

    await expect(localSyncRuntime.uploadPendingAttachments('fam_upload')).rejects.toThrow('upload denied')
    const [expense] = await localDb.getTable<any>('expenses')
    const [mutation] = await localDb.getOutbox()

    expect(expense.images).toEqual([localImage])
    expect(expense._pending_upload).toBe(true)
    expect(expense.pending_upload).toBe(true)
    expect(expense._upload_error).toBe('upload denied')
    expect(mutation.payload.images).toEqual([localImage])
  })

  it('并发触发附件上传时应复用同一个上传任务', async () => {
    const mockUniCloud = createMockUniCloud()
    ;(globalThis as any).uniCloud = mockUniCloud
    const localImage = 'wxfile://tmp/concurrent.jpg'

    await localDb.replaceTable('expenses', [{
      _id: 'expense_upload_concurrent',
      family_id: 'fam_upload',
      total_amount: 120,
      category: '医疗',
      images: [localImage],
      date: 1000,
      updated_at: 1000,
      _pending_upload: true,
      pending_upload: true,
    }])

    const [left, right] = await Promise.all([
      localSyncRuntime.uploadPendingAttachments('fam_upload'),
      localSyncRuntime.uploadPendingAttachments('fam_upload'),
    ])
    const uploadedFiles = (mockUniCloud as any).__getUploadedFiles()

    expect(left.uploaded).toBe(1)
    expect(right.uploaded).toBe(1)
    expect(uploadedFiles).toHaveLength(1)
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

  it('手动重试应恢复遗留 processing outbox 并重新同步', async () => {
    await localDb.upsertRows('outbox_mutations', [{
      _id: 'outbox_processing',
      type: 'task.complete',
      collection_scope: [],
      payload: {
        taskId: 'task_processing',
        _sync: {
          clientMutationId: 'mutation_processing',
          deviceId: 'device_1',
          clientTimestamp: 1,
          baseVersions: {},
        },
      },
      family_id: 'fam_1',
      status: 'processing',
      retry_count: 0,
      next_retry_at: 999999,
      last_error: null,
      client_mutation_id: 'mutation_processing',
      device_id: 'device_1',
      created_at: 1,
      updated_at: 1,
    }])
    await localDb.upsertRows('local_operation_logs', [{
      _id: 'local_operation_mutation_processing',
      family_id: 'fam_1',
      client_mutation_id: 'mutation_processing',
      action_type: 'task.complete',
      status: 'processing',
      actor_user_id: '',
      title: '完成任务',
      summary: '',
      entity_refs: [],
      detail: null,
      last_error: null,
      created_at: 1,
      updated_at: 1,
    }])

    const dispatchSpy = vi.spyOn(localSyncRuntime as any, 'dispatchMutation')
      .mockResolvedValue({
        ack: 'accepted',
        clientMutationId: 'mutation_processing',
        touchedEntities: [],
        resyncScopes: [],
        conflict: null,
      })

    await localSyncRuntime.retryFailedOutboxNow('fam_1')

    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    expect(await localDb.findById<any>('outbox_mutations', 'outbox_processing')).toMatchObject({
      status: 'synced',
      next_retry_at: 0,
    })
    expect(await localDb.findById<any>('local_operation_logs', 'local_operation_mutation_processing')).toBeNull()
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
