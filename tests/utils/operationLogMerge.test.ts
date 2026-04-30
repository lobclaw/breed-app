import { describe, expect, it } from 'vitest'
import { mergeOperationLogs } from '../../src/utils/operationLogMerge'

describe('operation log merge', () => {
  it('应在云端已确认后隐藏同一条本地待同步日志', () => {
    const merged = mergeOperationLogs(
      [{
        _id: 'local_1',
        actor_user_id: 'user_1',
        action_type: 'create',
        target_type: 'breeding_record',
        target_id: '',
        target_name: '十一',
        summary: '为 十一 新增了发情记录',
        created_at: 1000,
      }],
      [{
        _id: 'remote_1',
        actor_user_id: 'user_1',
        action_type: 'create',
        target_type: 'breeding_record',
        target_id: '',
        target_name: '十一',
        summary: '为 十一 新增了发情记录',
        created_at: 1500,
      }],
    )

    expect(merged).toHaveLength(1)
    expect(merged[0]?._id).toBe('remote_1')
  })

  it('应优先按 clientMutationId 去重', () => {
    const merged = mergeOperationLogs(
      [{
        _id: 'local_1',
        actor_user_id: 'user_1',
        action_type: 'complete',
        target_type: 'task',
        target_id: 'task_1',
        target_name: '十一 · 发情检查',
        summary: '完成了任务 十一 · 发情检查',
        clientMutationId: 'mutation_1',
        created_at: 1000,
      }],
      [{
        _id: 'remote_1',
        actor_user_id: 'user_1',
        action_type: 'complete',
        target_type: 'task',
        target_id: 'task_1',
        target_name: '十一 · 发情检查',
        summary: '完成了任务 十一 · 发情检查',
        clientMutationId: 'mutation_1',
        created_at: 5000,
      }],
    )

    expect(merged).toHaveLength(1)
    expect(merged[0]?._id).toBe('remote_1')
  })

  it('不应把稍后再次发生的同类操作误判成重复', () => {
    const merged = mergeOperationLogs(
      [{
        _id: 'local_1',
        actor_user_id: 'user_1',
        action_type: 'update',
        target_type: 'family_settings',
        target_id: '',
        target_name: '',
        summary: '更新了设置',
        created_at: 1000,
      }],
      [{
        _id: 'remote_1',
        actor_user_id: 'user_1',
        action_type: 'update',
        target_type: 'family_settings',
        target_id: '',
        target_name: '',
        summary: '更新了设置',
        created_at: 1000 + 180000,
      }],
    )

    expect(merged).toHaveLength(2)
    expect(merged.map(item => item._id)).toEqual(['remote_1', 'local_1'])
  })
})
