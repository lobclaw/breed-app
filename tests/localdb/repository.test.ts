import { describe, expect, it } from 'vitest'
import { localDb } from '../../src/localdb/db'
import { findLocal, mutateLocal, queryLocal, upsertLocalRows } from '../../src/localdb/repository'
import { getSyncStatus } from '../../src/localdb/sync-status'

describe('localdb repository public api', () => {
  it('本地事务应串行执行，避免并发写入互相覆盖', async () => {
    await localDb.replaceTable('dogs', [])

    const slowWrite = localDb.transact(['dogs'], async (tables) => {
      await new Promise(resolve => setTimeout(resolve, 10))
      tables.dogs = [...(tables.dogs as any[]), {
        _id: 'dog_slow',
        family_id: 'fam_tx',
        name: '慢写入',
        updated_at: 1,
      }]
    })
    const fastWrite = localDb.transact(['dogs'], (tables) => {
      tables.dogs = [...(tables.dogs as any[]), {
        _id: 'dog_fast',
        family_id: 'fam_tx',
        name: '快写入',
        updated_at: 2,
      }]
    })

    await Promise.all([slowWrite, fastWrite])

    expect((await localDb.getTable<any>('dogs')).map(row => row._id).sort()).toEqual(['dog_fast', 'dog_slow'])
  })

  it('应提供串行本地写入、查询和同步状态聚合', async () => {
    await localDb.replaceTable('dogs', [])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('sync_conflicts', [])
    await localDb.replaceTable('sync_state', [])

    await upsertLocalRows('dogs', [{
      _id: 'dog_local_1',
      name: '奶糖',
      family_id: 'fam_1',
      updated_at: 100,
    }, {
      _id: 'dog_local_pending_upload',
      name: '待传图片',
      family_id: 'fam_upload',
      updated_at: 100,
      _pending_upload: true,
    }])
    await mutateLocal(['dogs'], (tables) => {
      tables.dogs = tables.dogs.map((dog: any) => dog._id === 'dog_local_1'
        ? { ...dog, name: '奶糖 A', updated_at: 200 }
        : dog)
    })

    expect(await findLocal<any>('dogs', 'dog_local_1')).toMatchObject({ name: '奶糖 A' })
    expect(await queryLocal<any>('dogs', dog => dog.family_id === 'fam_1')).toHaveLength(1)

    await localDb.upsertRows('outbox_mutations', [{
      _id: 'outbox_1',
      type: 'dog.create',
      collection_scope: ['dogs'],
      payload: {},
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
    await localDb.upsertSyncState({
      _id: 'dogs',
      collection: 'dogs',
      last_pulled_at: 200,
      last_full_sync_at: 100,
      last_ack_at: 0,
      updated_at: 200,
    })
    await localDb.upsertLocalMeta('sync:active-scope', 'dog-list')

    expect(await getSyncStatus()).toMatchObject({
      pending: 1,
      failed: 0,
      pendingUpload: 1,
      lastPulledAt: 200,
      activeScope: 'dog-list',
      recentSyncAt: 200,
    })
  })

  it('同步状态中的冲突数量应按 mutation 去重', async () => {
    await localDb.replaceTable('dogs', [])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('sync_conflicts', [])
    await localDb.replaceTable('sync_state', [])

    await localDb.upsertRows('outbox_mutations', [{
      _id: 'outbox_1',
      type: 'task.batchComplete',
      collection_scope: ['tasks'],
      payload: {},
      family_id: 'fam_1',
      status: 'conflict',
      retry_count: 0,
      next_retry_at: 0,
      last_error: null,
      client_mutation_id: 'mutation_1',
      device_id: 'device_1',
      created_at: 1,
      updated_at: 1,
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
      created_at: 1,
      updated_at: 1,
    }])

    expect(await getSyncStatus()).toMatchObject({
      conflict: 1,
    })
  })

  it('同步状态支持按当前家庭过滤 outbox 与待上传', async () => {
    await localDb.replaceTable('dogs', [])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('sync_conflicts', [])
    await localDb.replaceTable('sync_state', [])

    await localDb.upsertRows('dogs', [
      {
        _id: 'dog_fam_1',
        family_id: 'fam_1',
        _pending_upload: true,
        updated_at: 1,
      },
      {
        _id: 'dog_fam_2',
        family_id: 'fam_2',
        _pending_upload: true,
        updated_at: 1,
      },
    ])
    await localDb.upsertRows('outbox_mutations', [
      {
        _id: 'outbox_fam_1',
        type: 'dog.create',
        collection_scope: ['dogs'],
        payload: {},
        family_id: 'fam_1',
        status: 'failed',
        retry_count: 1,
        next_retry_at: 0,
        last_error: '失败',
        client_mutation_id: 'mutation_fam_1',
        device_id: 'device_1',
        created_at: 1,
        updated_at: 1,
      },
      {
        _id: 'outbox_fam_2',
        type: 'dog.create',
        collection_scope: ['dogs'],
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
    await localDb.upsertRows('sync_conflicts', [{
      _id: 'conflict_mutation_fam_2',
      client_mutation_id: 'mutation_fam_2',
      collection: 'dogs',
      entity_id: 'dog_fam_2',
      base_version: 0,
      server_version: 2,
      status: 'open',
      detail: null,
      created_at: 2,
      updated_at: 2,
    }])

    expect(await getSyncStatus({ familyId: 'fam_1' })).toMatchObject({
      pending: 0,
      failed: 1,
      conflict: 0,
      pendingUpload: 1,
    })
  })
})
