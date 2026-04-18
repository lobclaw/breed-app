import { describe, expect, it } from 'vitest'

import { buildMedicationDetailUrl, resolveDogDetailStatusRoute, resolveMedicationDetailId } from '@/utils/dogDetailNavigation'

describe('dogDetailNavigation', () => {
  it('按状态分发到对应详情页或流程页', () => {
    expect(resolveDogDetailStatusRoute({
      type: '生病中',
      recordId: 'health-1',
      taskId: '',
      cycleId: '',
    })).toBe('/pages/record/health-detail?id=health-1')

    expect(resolveDogDetailStatusRoute({
      type: '用药中',
      recordId: '',
      taskId: 'med-1',
      cycleId: '',
    })).toBe('/pages/record/medication-detail?id=med-1')

    expect(resolveDogDetailStatusRoute({
      type: '怀孕中',
      recordId: '',
      taskId: '',
      cycleId: 'cycle-1',
    })).toBe('/pages/breeding/cycle?id=cycle-1')
  })

  it('缺少稳定标识时返回空串供页面回退处理', () => {
    expect(resolveDogDetailStatusRoute({
      type: '发情中',
      recordId: '',
      taskId: '',
      cycleId: '',
    })).toBe('')
  })

  it('兼容 snake_case 和 medication_task_id 等历史字段', () => {
    expect(resolveDogDetailStatusRoute({
      type: '生病中',
      record_id: 'ill-1',
    } as any)).toBe('/pages/record/health-detail?id=ill-1')

    expect(resolveDogDetailStatusRoute({
      type: '用药中',
      medication_task_id: 'med-legacy',
    } as any)).toBe('/pages/record/medication-detail?id=med-legacy')

    expect(resolveDogDetailStatusRoute({
      type: '发情中',
      cycle_id: 'cycle-legacy',
    } as any)).toBe('/pages/breeding/cycle?id=cycle-legacy')
  })

  it('兼容用药详情的 id 和旧 taskId 路由参数', () => {
    expect(resolveMedicationDetailId({ id: 'task-new', taskId: 'task-old' })).toBe('task-new')
    expect(resolveMedicationDetailId({ taskId: 'task-old' })).toBe('task-old')
    expect(resolveMedicationDetailId({ medicationTaskId: 'task-camel' })).toBe('task-camel')
    expect(resolveMedicationDetailId({ medication_task_id: 'task-snake' })).toBe('task-snake')
    expect(resolveMedicationDetailId({})).toBe('')
    expect(buildMedicationDetailUrl('med task')).toBe('/pages/record/medication-detail?id=med%20task')
  })
})
