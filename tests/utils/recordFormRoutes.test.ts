import { describe, expect, it } from 'vitest'

import {
  buildBreedingRecordEditUrl,
  resolveBatchDogs,
  resolveBreedingRecordEditBaseUrl,
  resolveBreedingRouteQuery,
  resolveHealthCreateRouteQuery,
  resolveMedicationRouteQuery,
  resolveRecordFormEditId,
  resolveSourceTaskIds,
} from '@/utils/recordFormRoutes'

describe('recordFormRoutes', () => {
  it('兼容 id 与历史 recordId/record_id 编辑参数', () => {
    expect(resolveRecordFormEditId({ id: 'record-new' })).toBe('record-new')
    expect(resolveRecordFormEditId({ recordId: 'record-camel' })).toBe('record-camel')
    expect(resolveRecordFormEditId({ record_id: 'record-snake' })).toBe('record-snake')
  })

  it('繁育编辑入口按记录类型直达对应表单页', () => {
    expect(resolveBreedingRecordEditBaseUrl('heat')).toBe('/pages/record/breeding-heat')
    expect(resolveBreedingRecordEditBaseUrl('pre_labor')).toBe('/pages/record/breeding-prelabor')
    expect(resolveBreedingRecordEditBaseUrl('heat_observation')).toBe('/pages/record/heat-observation')
    expect(resolveBreedingRecordEditBaseUrl('birth')).toBe('')
    expect(buildBreedingRecordEditUrl('pre_labor', 'record-1', { focus: 'images' })).toBe('/pages/record/breeding-prelabor?id=record-1&focus=images')
  })

  it('兼容 taskId 与 taskIds 批量来源参数', () => {
    expect(resolveSourceTaskIds({ taskId: 'task-1' })).toEqual(['task-1'])
    expect(resolveSourceTaskIds({ task_id: 'task-legacy' })).toEqual(['task-legacy'])
    expect(resolveSourceTaskIds({ taskIds: 'a,b,,c' })).toEqual(['a', 'b', 'c'])
  })

  it('优先解析 batchDogs，其次兼容单犬 dogId/dogName', () => {
    expect(resolveBatchDogs({
      batchDogs: encodeURIComponent(JSON.stringify([{ _id: 'dog-1', name: '花花' }])),
    })).toEqual([{ _id: 'dog-1', name: '花花' }])

    expect(resolveBatchDogs({
      dogId: 'dog-2',
      dogName: encodeURIComponent('小白'),
    })).toEqual([{ _id: 'dog-2', name: '小白' }])
  })

  it('健康新增路由保留 fromTask 与 details 预填兼容', () => {
    const result = resolveHealthCreateRouteQuery({
      taskId: 'task-1',
      details: encodeURIComponent(JSON.stringify({ condition: '感冒' })),
    })

    expect(result.fromTask).toBe(true)
    expect(result.sourceTaskIds).toEqual(['task-1'])
    expect(result.details).toEqual({ condition: '感冒' })
  })

  it('用药创建路由兼容 illnessRecordId 与 dogId', () => {
    const result = resolveMedicationRouteQuery({
      dogId: 'dog-3',
      dogName: encodeURIComponent('奶糖'),
      illnessRecordId: 'ill-1',
    })

    expect(result.selectedDogs).toEqual([{ _id: 'dog-3', name: '奶糖' }])
    expect(result.illnessRecordId).toBe('ill-1')
    expect(result.illnessLinks).toEqual([])
  })

  it('用药创建路由兼容批量 illnessLinks 参数', () => {
    const result = resolveMedicationRouteQuery({
      batchDogs: encodeURIComponent(JSON.stringify([
        { _id: 'dog-1', name: '花花' },
        { _id: 'dog-2', name: '奶糖' },
      ])),
      illness_links: encodeURIComponent(JSON.stringify([
        {
          dogId: 'dog-1',
          illnessRecordId: 'ill-1',
          primaryCondition: '感冒',
          symptomSummary: '流鼻涕 / 咳嗽',
          treatmentStatus: '观察中',
        },
        {
          dogId: 'dog-2',
          illnessRecordId: 'ill-2',
          primaryCondition: '肠胃炎',
        },
      ])),
    })

    expect(result.selectedDogs).toHaveLength(2)
    expect(result.illnessRecordId).toBe('')
    expect(result.illnessLinks).toEqual([
      {
        dogId: 'dog-1',
        illnessRecordId: 'ill-1',
        primaryCondition: '感冒',
        symptomSummary: '流鼻涕 / 咳嗽',
        treatmentStatus: '观察中',
      },
      {
        dogId: 'dog-2',
        illnessRecordId: 'ill-2',
        primaryCondition: '肠胃炎',
      },
    ])
  })

  it('繁育路由兼容 cycleId、taskId 与 locked 犬只上下文', () => {
    const result = resolveBreedingRouteQuery({
      cycleId: 'cycle-1',
      taskId: 'task-2',
      dogId: 'dog-4',
      dogName: encodeURIComponent('糯米'),
      locked: 'true',
    })

    expect(result.cycleId).toBe('cycle-1')
    expect(result.taskId).toBe('task-2')
    expect(result.dogLocked).toBe(true)
    expect(result.selectedDog).toEqual({
      _id: 'dog-4',
      name: '糯米',
      gender: '母',
      role: '种狗',
    })
  })
})
