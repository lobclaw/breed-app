import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { getLocalDbAdapter, toLocalRowRecord } from '../../src/localdb/adapter'
import { localDb } from '../../src/localdb/db'
import { findLocal, mutateLocal, queryLocal, upsertLocalRows } from '../../src/localdb/repository'
import { syncIssueService } from '../../src/localdb/sync-issues'
import type { LocalRowOf } from '../../src/localdb/types'
import { getSyncStatus } from '../../src/localdb/sync-status'

describe('localdb repository public api', () => {
  it('LocalTableMap 类型应贯穿 LocalDb 与 repository 读取 API', async () => {
    const dogRowsPromise = localDb.getTable('dogs')
    const taskPromise = localDb.findById('tasks', 'task_1')
    const healthRowsPromise = queryLocal('health_records')
    const salePromise = findLocal('sale_records', 'sale_1')

    expectTypeOf(dogRowsPromise).toEqualTypeOf<Promise<LocalRowOf<'dogs'>[]>>()
    expectTypeOf(taskPromise).toEqualTypeOf<Promise<LocalRowOf<'tasks'> | null>>()
    expectTypeOf(healthRowsPromise).toEqualTypeOf<Promise<LocalRowOf<'health_records'>[]>>()
    expectTypeOf(salePromise).toEqualTypeOf<Promise<LocalRowOf<'sale_records'> | null>>()
    await Promise.all([dogRowsPromise, taskPromise, healthRowsPromise, salePromise])

    await mutateLocal(['dogs', 'tasks'] as const, (tables) => {
      expectTypeOf(tables.dogs).toEqualTypeOf<LocalRowOf<'dogs'>[]>()
      expectTypeOf(tables.tasks).toEqualTypeOf<LocalRowOf<'tasks'>[]>()
    })
  })

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

  it('集合 revision 应稳定递增，并支持按家庭读取行', async () => {
    await localDb.replaceTable('dogs', [])
    const emptyRevision = await localDb.getCollectionRevision('dogs')
    expect(await localDb.getCollectionRevision('dogs')).toBe(emptyRevision)

    await localDb.upsertRows('dogs', [
      { _id: 'dog_fam_a', family_id: 'fam_a', name: 'A', updated_at: 1 },
      { _id: 'dog_fam_b', family_id: 'fam_b', name: 'B', updated_at: 2 },
    ])

    expect(await localDb.getCollectionRevision('dogs')).toBeGreaterThan(emptyRevision)
    expect(await localDb.getRowsByFamily<any>('dogs', 'fam_a')).toEqual([
      expect.objectContaining({ _id: 'dog_fam_a', family_id: 'fam_a' }),
    ])
  })

  it('只读读取路径不应进行整表深拷贝，兼容读取仍返回隔离副本', async () => {
    await localDb.replaceTable('dogs', [{
      _id: 'dog_readonly',
      family_id: 'fam_readonly',
      name: '只读',
      updated_at: 1,
    }])

    const firstReadonly = await localDb.getReadonlyTable<any>('dogs')
    const secondReadonly = await localDb.getReadonlyTable<any>('dogs')
    expect(firstReadonly[0]).toBe(secondReadonly[0])

    const clonedRows = await localDb.getTable<any>('dogs')
    clonedRows[0].name = '被外部修改'
    expect((await localDb.findReadonlyById<any>('dogs', 'dog_readonly'))?.name).toBe('只读')

    const familyRows = await localDb.getRowsByFamilyReadonly<any>('dogs', 'fam_readonly')
    expect(familyRows).toEqual([expect.objectContaining({ _id: 'dog_readonly' })])
  })

  it('事务读取 v2 集合不应通过 getTable 触发整表深拷贝', async () => {
    await localDb.replaceTable('dogs', [{
      _id: 'dog_tx_read',
      family_id: 'fam_tx_read',
      name: '事务基线',
      updated_at: 1,
    }])

    const getTableSpy = vi.spyOn(localDb, 'getTable')
    await localDb.transact(['dogs'], (tables) => {
      tables.dogs = [...(tables.dogs as any[]), {
        _id: 'dog_tx_write',
        family_id: 'fam_tx_read',
        name: '事务新增',
        updated_at: 2,
      }]
    })

    expect(getTableSpy).not.toHaveBeenCalled()
    getTableSpy.mockRestore()
    expect((await localDb.getRowsByFamily<any>('dogs', 'fam_tx_read')).map(row => row._id).sort()).toEqual([
      'dog_tx_read',
      'dog_tx_write',
    ])
  })

  it('事务 diff 遇到不同 row revision 变化时应合并写入', async () => {
    await localDb.replaceTable('dogs', [{
      _id: 'dog_base',
      family_id: 'fam_tx_merge',
      name: '原始',
      updated_at: 1,
    }])

    await localDb.transact(['dogs'], async (tables) => {
      await getLocalDbAdapter().putRows('dogs', [
        toLocalRowRecord('dogs', {
          _id: 'dog_external',
          family_id: 'fam_tx_merge',
          name: '外部写入',
          updated_at: 2,
        }),
      ])
      tables.dogs = [...(tables.dogs as any[]), {
        _id: 'dog_local',
        family_id: 'fam_tx_merge',
        name: '事务写入',
        updated_at: 3,
      }]
    })

    expect((await localDb.getRowsByFamily<any>('dogs', 'fam_tx_merge')).map(row => row._id).sort()).toEqual([
      'dog_base',
      'dog_external',
      'dog_local',
    ])
  })

  it('事务 diff 遇到同 row revision 冲突时应拒绝覆盖', async () => {
    await localDb.replaceTable('dogs', [{
      _id: 'dog_conflict',
      family_id: 'fam_tx_conflict',
      name: '原始',
      updated_at: 1,
    }])

    await expect(localDb.transact(['dogs'], async (tables) => {
      await getLocalDbAdapter().putRows('dogs', [
        toLocalRowRecord('dogs', {
          _id: 'dog_conflict',
          family_id: 'fam_tx_conflict',
          name: '外部更新',
          updated_at: 2,
        }),
      ])
      tables.dogs = (tables.dogs as any[]).map(row => row._id === 'dog_conflict'
        ? { ...row, name: '事务更新', updated_at: 3 }
        : row)
    })).rejects.toThrow('LOCAL_DB_WRITE_CONFLICT')

    expect(await localDb.findById<any>('dogs', 'dog_conflict')).toMatchObject({
      name: '外部更新',
      updated_at: 2,
    })
  })

  it('事务 diff 遇到同 row 删除和更新并发时应拒绝覆盖', async () => {
    await localDb.replaceTable('dogs', [{
      _id: 'dog_delete_conflict',
      family_id: 'fam_tx_delete_conflict',
      name: '原始',
      updated_at: 1,
    }])

    await expect(localDb.transact(['dogs'], async (tables) => {
      await getLocalDbAdapter().putRows('dogs', [
        toLocalRowRecord('dogs', {
          _id: 'dog_delete_conflict',
          family_id: 'fam_tx_delete_conflict',
          name: '外部更新',
          updated_at: 2,
        }),
      ])
      tables.dogs = (tables.dogs as any[]).filter(row => row._id !== 'dog_delete_conflict')
    })).rejects.toThrow('LOCAL_DB_WRITE_CONFLICT')

    expect(await localDb.findById<any>('dogs', 'dog_delete_conflict')).toMatchObject({
      name: '外部更新',
      updated_at: 2,
    })
  })

  it('行级事务 API 应支持单行 update / insert / delete 且不触发 getTable', async () => {
    await localDb.replaceTable('dogs', [
      {
        _id: 'dog_row_update',
        family_id: 'fam_row_api',
        name: '原始',
        updated_at: 1,
      },
      {
        _id: 'dog_row_delete',
        family_id: 'fam_row_api',
        name: '待删除',
        updated_at: 1,
      },
    ])

    const getTableSpy = vi.spyOn(localDb, 'getTable')
    await localDb.transactRows('dogs', async (rows) => {
      await rows.updateRow('dog_row_update', { name: '已更新', updated_at: 2 })
      await rows.upsertRow({
        _id: 'dog_row_insert',
        family_id: 'fam_row_api',
        name: '新增',
        updated_at: 3,
      } as any)
      await rows.deleteRow('dog_row_delete')
    })

    expect(getTableSpy).not.toHaveBeenCalled()
    getTableSpy.mockRestore()
    expect((await localDb.getRowsByFamily<any>('dogs', 'fam_row_api')).map(row => row._id).sort()).toEqual([
      'dog_row_insert',
      'dog_row_update',
    ])
    await expect(localDb.findById<any>('dogs', 'dog_row_update')).resolves.toMatchObject({ name: '已更新' })
    await expect(localDb.findById<any>('dogs', 'dog_row_delete')).resolves.toBeNull()
  })

  it('多集合行级事务 API 应按 collection + id 细粒度读写', async () => {
    await localDb.replaceTable('dogs', [{
      _id: 'dog_multi_row',
      family_id: 'fam_multi_row',
      name: '多集合',
      updated_at: 1,
    }])
    await localDb.replaceTable('tasks', [{
      _id: 'task_multi_row',
      family_id: 'fam_multi_row',
      dog_id: 'dog_multi_row',
      title: '待处理',
      status: 'pending',
      updated_at: 1,
    }])

    const getTableSpy = vi.spyOn(localDb, 'getTable')
    await localDb.transactRows(['dogs', 'tasks'] as const, async (rows) => {
      await rows.updateRow('dogs', 'dog_multi_row', { name: '已更新', updated_at: 2 })
      await rows.updateRow('tasks', 'task_multi_row', { status: 'completed', updated_at: 2 })
      await rows.upsertRow('tasks', {
        _id: 'task_multi_insert',
        family_id: 'fam_multi_row',
        dog_id: 'dog_multi_row',
        title: '新增',
        status: 'pending',
        updated_at: 3,
      } as any)
    })

    expect(getTableSpy).not.toHaveBeenCalled()
    getTableSpy.mockRestore()
    await expect(localDb.findById<any>('dogs', 'dog_multi_row')).resolves.toMatchObject({ name: '已更新' })
    await expect(localDb.findById<any>('tasks', 'task_multi_row')).resolves.toMatchObject({ status: 'completed' })
    await expect(localDb.findById<any>('tasks', 'task_multi_insert')).resolves.toMatchObject({ title: '新增' })
  })

  it('行级事务 API 遇到同 row revision 冲突时应拒绝覆盖', async () => {
    await localDb.replaceTable('dogs', [{
      _id: 'dog_row_conflict',
      family_id: 'fam_row_api_conflict',
      name: '原始',
      updated_at: 1,
    }])

    await expect(localDb.transactRows('dogs', async (rows) => {
      await rows.updateRow('dog_row_conflict', { name: '事务更新', updated_at: 3 })
      await getLocalDbAdapter().putRows('dogs', [
        toLocalRowRecord('dogs', {
          _id: 'dog_row_conflict',
          family_id: 'fam_row_api_conflict',
          name: '外部更新',
          updated_at: 2,
        }),
      ])
    })).rejects.toThrow('LOCAL_DB_WRITE_CONFLICT')

    expect(await localDb.findById<any>('dogs', 'dog_row_conflict')).toMatchObject({
      name: '外部更新',
      updated_at: 2,
    })
  })

  it('刷新待上传问题时应清理已恢复或已删除的旧 open issue', async () => {
    await localDb.replaceTable('dogs', [
      {
        _id: 'dog_pending',
        family_id: 'fam_upload_cleanup',
        name: '待上传',
        images: ['wxfile://tmp/a.jpg'],
        _pending_upload: true,
        updated_at: 1,
      },
      {
        _id: 'dog_clean',
        family_id: 'fam_upload_cleanup',
        name: '已恢复',
        images: ['cloud://a.jpg'],
        _pending_upload: false,
        updated_at: 2,
      },
    ])
    await localDb.replaceTable('sync_issues', [
      {
        _id: 'pending_upload:dogs:dog_clean',
        family_id: 'fam_upload_cleanup',
        kind: 'pending_upload',
        status: 'open',
        collection: 'dogs',
        record_id: 'dog_clean',
        mutation_id: null,
        title: '犬只资料 · 已恢复',
        last_error: '',
        updated_at: 1,
      },
      {
        _id: 'pending_upload:dogs:dog_deleted',
        family_id: 'fam_upload_cleanup',
        kind: 'pending_upload',
        status: 'open',
        collection: 'dogs',
        record_id: 'dog_deleted',
        mutation_id: null,
        title: '犬只资料 · 已删除',
        last_error: '',
        updated_at: 1,
      },
    ])

    await syncIssueService.refreshPendingUploadIssuesForCollection('dogs', 'fam_upload_cleanup')
    const issues = await localDb.query<any>('sync_issues', row => row.family_id === 'fam_upload_cleanup')

    expect(issues.find(row => row._id === 'pending_upload:dogs:dog_pending')).toMatchObject({ status: 'open' })
    expect(issues.find(row => row._id === 'pending_upload:dogs:dog_clean')).toMatchObject({ status: 'resolved' })
    expect(issues.find(row => row._id === 'pending_upload:dogs:dog_deleted')).toMatchObject({ status: 'resolved' })
  })

  it('应提供串行本地写入、查询和同步状态聚合', async () => {
    await localDb.replaceTable('dogs', [])
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('sync_conflicts', [])
    await localDb.replaceTable('sync_state', [])
    await localDb.replaceTable('sync_issues', [])

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
      images: ['blob:http://localhost/stale-image'],
      _upload_error: '本地图片失效',
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
    await localDb.upsertRows('sync_issues', [{
      _id: 'pending_upload:dogs:dog_local_pending_upload',
      family_id: 'fam_upload',
      kind: 'pending_upload',
      status: 'open',
      collection: 'dogs',
      record_id: 'dog_local_pending_upload',
      mutation_id: null,
      title: '犬只资料 · 待传图片',
      last_error: '图片临时路径已失效，请重新选择图片',
      updated_at: 200,
    }])

    expect(await getSyncStatus()).toMatchObject({
      pending: 1,
      failed: 0,
      pendingUpload: 1,
      pendingUploadIssues: [{
        _id: 'pending_upload:dogs:dog_local_pending_upload',
        type: 'attachment.dogs',
        status: 'pending_upload',
        lastError: '图片临时路径已失效，请重新选择图片',
        collection: 'dogs',
        recordId: 'dog_local_pending_upload',
      }],
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
    await localDb.replaceTable('sync_issues', [])

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
    await localDb.replaceTable('sync_issues', [])

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
    await localDb.upsertRows('sync_issues', [{
      _id: 'pending_upload:dogs:dog_fam_1',
      family_id: 'fam_1',
      kind: 'pending_upload',
      status: 'open',
      collection: 'dogs',
      record_id: 'dog_fam_1',
      mutation_id: null,
      title: '犬只资料',
      last_error: '',
      updated_at: 1,
    }])

    expect(await getSyncStatus({ familyId: 'fam_1' })).toMatchObject({
      pending: 0,
      failed: 1,
      conflict: 0,
      pendingUpload: 1,
    })
    expect(await getSyncStatus({ familyId: 'fam_2' })).toMatchObject({
      pending: 1,
      failed: 0,
      conflict: 1,
      pendingUpload: 0,
    })
  })

  it('同步状态不应扫描业务集合', async () => {
    await localDb.replaceTable('outbox_mutations', [])
    await localDb.replaceTable('sync_conflicts', [])
    await localDb.replaceTable('sync_state', [])
    await localDb.replaceTable('sync_issues', [])

    const queryReadonlySpy = vi.spyOn(localDb, 'queryReadonly')
    const rowsByFamilySpy = vi.spyOn(localDb, 'getRowsByFamilyReadonly')
    const readonlyTableSpy = vi.spyOn(localDb, 'getReadonlyTable')
    const getTableSpy = vi.spyOn(localDb, 'getTable')
    await getSyncStatus({ familyId: 'fam_1' })

    const readCollections = [
      ...queryReadonlySpy.mock.calls.map(call => call[0]),
      ...rowsByFamilySpy.mock.calls.map(call => call[0]),
      ...readonlyTableSpy.mock.calls.map(call => call[0]),
    ]
    expect([...new Set(readCollections)].sort()).toEqual([
      'sync_conflicts',
      'sync_issues',
      'sync_state',
      'outbox_mutations',
    ].sort())
    expect(readCollections).not.toContain('dogs')
    expect(readCollections).not.toContain('tasks')
    expect(readCollections).not.toContain('health_records')
    expect(readCollections).not.toContain('medication_tasks')
    expect(getTableSpy).not.toHaveBeenCalled()
    queryReadonlySpy.mockRestore()
    rowsByFamilySpy.mockRestore()
    readonlyTableSpy.mockRestore()
    getTableSpy.mockRestore()
  })
})
