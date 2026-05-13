import { beforeEach, describe, expect, it, vi } from 'vitest'
import { localDb } from '../../src/localdb/db'
import { createPendingLocalOperationLog, getLocalOperationStatusText } from '../../src/localdb/local-operation-log'
import { LOCAL_MUTATION_TYPES } from '../../src/localdb/mutation-registry'

describe('local operation log', () => {
  beforeEach(async () => {
    await localDb.replaceTable('families', [{
      _id: 'fam_1',
      members: [{ user_id: 'user_1', nickname: 'mooling', status: 'active' }],
      updated_at: 1,
    } as any])
    await localDb.replaceTable('dogs', [{
      _id: 'dog_1',
      name: '十一',
      family_id: 'fam_1',
      updated_at: 1,
    } as any])
    await localDb.replaceTable('tasks', [{
      _id: 'task_1',
      title: '十一 · 发情检查',
      family_id: 'fam_1',
      updated_at: 1,
    } as any])

    ;(globalThis as any).uniCloud = {
      getCurrentUserInfo: vi.fn(() => ({ uid: 'user_1' })),
    }
    ;(globalThis as any).uni = {
      getStorageSync: vi.fn(() => ''),
    }
  })

  it('应为新增繁育记录生成本地待同步日志', async () => {
    const row = await createPendingLocalOperationLog(
      LOCAL_MUTATION_TYPES.CREATE_BREEDING_RECORD,
      'fam_1',
      { dog_id: 'dog_1', type: 'heat' },
      {
        clientMutationId: 'mutation_1',
        deviceId: 'device_1',
        clientTimestamp: 1000,
      },
    )

    expect(row).toMatchObject({
      client_mutation_id: 'mutation_1',
      actor_name: 'mooling',
      action_type: 'create',
      domain: 'breeding',
      target_name: '十一',
      summary: '为 十一 新增了发情记录',
      status: 'pending',
    })
  })

  it('应为更新繁育记录生成具体记录类型和犬只名', async () => {
    await localDb.upsertRows('breeding_records', [{
      _id: 'record_pregnancy_1',
      family_id: 'fam_1',
      dog_id: 'dog_1',
      dog_name: '波妞',
      type: 'pregnancy_check',
      updated_at: 1,
    } as any])

    const row = await createPendingLocalOperationLog(
      LOCAL_MUTATION_TYPES.UPDATE_BREEDING_RECORD,
      'fam_1',
      { id: 'record_pregnancy_1' },
      {
        clientMutationId: 'mutation_pregnancy_update',
        deviceId: 'device_1',
        clientTimestamp: 1005,
      },
    )

    expect(row).toMatchObject({
      action_type: 'update',
      domain: 'breeding',
      target_name: '波妞',
      summary: '为 波妞 更新了孕检记录',
    })
  })

  it('应为完成任务生成本地待同步日志', async () => {
    const row = await createPendingLocalOperationLog(
      LOCAL_MUTATION_TYPES.COMPLETE_TASK,
      'fam_1',
      { taskId: 'task_1' },
      {
        clientMutationId: 'mutation_2',
        deviceId: 'device_1',
        clientTimestamp: 1001,
      },
    )

    expect(row).toMatchObject({
      action_type: 'complete',
      domain: 'task',
      target_name: '十一 · 发情检查',
      summary: '完成了任务 十一 · 发情检查',
    })
  })

  it('昵称更新日志应使用修改前昵称作为历史操作者快照', async () => {
    const row = await createPendingLocalOperationLog(
      LOCAL_MUTATION_TYPES.UPDATE_NICKNAME,
      'fam_1',
      {
        userId: 'user_1',
        previousNickname: 'mooling',
        nickname: 'mooling99',
      },
      {
        clientMutationId: 'mutation_nickname',
        deviceId: 'device_1',
        clientTimestamp: 1004,
      },
    )

    expect(row).toMatchObject({
      actor_name: 'mooling',
      action_type: 'update',
      domain: 'family',
      target_type: 'family_member',
      target_id: 'user_1',
      target_name: 'mooling99',
      summary: '将昵称从 mooling 更新为 mooling99',
    })
  })

  it('应按 dogs 数组数量生成批量待办日志文案', async () => {
    const row = await createPendingLocalOperationLog(
      LOCAL_MUTATION_TYPES.BATCH_CREATE_TASKS,
      'fam_1',
      {
        dogs: [{ _id: 'dog_1' }, { _id: 'dog_2' }],
      },
      {
        clientMutationId: 'mutation_3',
        deviceId: 'device_1',
        clientTimestamp: 1002,
      },
    )

    expect(row).toMatchObject({
      action_type: 'create',
      domain: 'task',
      target_name: '2个任务',
      summary: '批量创建了 2 个任务',
    })
  })

  it('本地家庭表缺少成员昵称时，应从家庭缓存兜底生成操作者昵称', async () => {
    await localDb.replaceTable('families', [{
      _id: 'fam_1',
      members: [],
      updated_at: 2,
    } as any])
    ;(globalThis as any).uni.getStorageSync = vi.fn((key: string) => {
      if (key !== 'breed_family_cache:user_1') return ''
      return JSON.stringify({
        _id: 'fam_1',
        members: [{ user_id: 'user_1', nickname: '缓存昵称', status: 'active' }],
      })
    })

    const row = await createPendingLocalOperationLog(
      LOCAL_MUTATION_TYPES.CREATE_BREEDING_RECORD,
      'fam_1',
      { dog_id: 'dog_1', type: 'follicle_check' },
      {
        clientMutationId: 'mutation_4',
        deviceId: 'device_1',
        clientTimestamp: 1003,
      },
    )

    expect(row).toMatchObject({
      actor_name: '缓存昵称',
      summary: '为 十一 新增了卵泡检查记录',
    })
  })

  it('应暴露本地同步状态文案', () => {
    expect(getLocalOperationStatusText('pending')).toBe('待同步')
    expect(getLocalOperationStatusText('processing')).toBe('同步中')
    expect(getLocalOperationStatusText('failed')).toBe('同步失败')
    expect(getLocalOperationStatusText('conflict')).toBe('同步冲突')
  })
})
