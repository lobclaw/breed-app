import { describe, expect, it } from 'vitest'

import {
  createAllAddRecordGroups,
  createCycleBreedingAddRecordGroups,
} from '@/utils/addRecordSheet'

describe('createAllAddRecordGroups', () => {
  it('幼崽模式下只返回健康和用药分组', () => {
    const groups = createAllAddRecordGroups({ allowBreeding: false })

    expect(groups.map(group => group.key)).toEqual(['health', 'medication'])
  })

  it('默认保留繁育、健康、用药三组', () => {
    const groups = createAllAddRecordGroups()

    expect(groups.map(group => group.key)).toEqual(['breeding', 'health', 'medication'])
  })
})

describe('createCycleBreedingAddRecordGroups', () => {
  it('发情中周期只保留发情阶段可追加的记录', () => {
    const groups = createCycleBreedingAddRecordGroups('发情中')

    expect(groups).toHaveLength(1)
    expect(groups[0].items.map(item => item.page)).toEqual([
      'heat-observation',
      'breeding-follicle',
      'breeding-mating',
      'breeding-termination',
    ])
  })

  it('怀孕中周期只保留怀孕阶段可追加的记录', () => {
    const groups = createCycleBreedingAddRecordGroups('怀孕中')

    expect(groups).toHaveLength(1)
    expect(groups[0].items.map(item => item.page)).toEqual([
      'breeding-pregnancy',
      'breeding-prenatal',
      'breeding-prelabor',
      'breeding-termination',
    ])
  })

  it('终态周期不再提供添加繁育记录入口', () => {
    expect(createCycleBreedingAddRecordGroups('已生产')).toEqual([])
    expect(createCycleBreedingAddRecordGroups('失败')).toEqual([])
    expect(createCycleBreedingAddRecordGroups('放弃')).toEqual([])
  })
})
