import { describe, expect, it } from 'vitest'

import {
  createAllAddRecordGroups,
  createCycleBreedingAddRecordGroups,
  createDogDetailAddRecordGroups,
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

  it('怀孕中且尚未记录孕检时保留孕检入口', () => {
    const groups = createCycleBreedingAddRecordGroups('怀孕中')

    expect(groups).toHaveLength(1)
    expect(groups[0].items.map(item => item.page)).toEqual([
      'breeding-pregnancy',
      'breeding-prenatal',
      'breeding-prelabor',
      'birth-wizard',
      'breeding-termination',
    ])
  })

  it('怀孕中且已有孕检记录时不再展示孕检入口', () => {
    const groups = createCycleBreedingAddRecordGroups('怀孕中', {
      records: [{ type: 'pregnancy_check' }],
    })

    expect(groups).toHaveLength(1)
    expect(groups[0].items.map(item => item.page)).toEqual([
      'breeding-prenatal',
      'breeding-prelabor',
      'birth-wizard',
      'breeding-termination',
    ])
  })

  it('终态周期不再提供添加繁育记录入口', () => {
    expect(createCycleBreedingAddRecordGroups('已生产')).toEqual([])
    expect(createCycleBreedingAddRecordGroups('失败')).toEqual([])
    expect(createCycleBreedingAddRecordGroups('放弃')).toEqual([])
  })
})

describe('createDogDetailAddRecordGroups', () => {
  it('无活跃周期的种母只提供发情起始入口', () => {
    const groups = createDogDetailAddRecordGroups({ role: '种狗', gender: '母' })
    const breedingGroup = groups.find(group => group.key === 'breeding')

    expect(breedingGroup?.items.map(item => item.page)).toEqual(['breeding-heat'])
  })

  it('发情中的犬只详情只提供发情阶段可追加的记录', () => {
    const groups = createDogDetailAddRecordGroups({
      role: '种狗',
      gender: '母',
      statuses: [{ type: '发情中', cycleId: 'cycle-1' }],
    })
    const breedingGroup = groups.find(group => group.key === 'breeding')

    expect(breedingGroup?.items.map(item => item.page)).toEqual([
      'heat-observation',
      'breeding-follicle',
      'breeding-mating',
      'breeding-termination',
    ])
  })

  it('怀孕中的犬只详情和周期详情都通过添加记录提供生产入口', () => {
    const groups = createDogDetailAddRecordGroups({
      role: '种狗',
      gender: '母',
      activeCycleStatus: '怀孕中',
    })
    const breedingGroup = groups.find(group => group.key === 'breeding')

    expect(breedingGroup?.items.map(item => item.page)).toEqual([
      'breeding-pregnancy',
      'breeding-prenatal',
      'breeding-prelabor',
      'birth-wizard',
      'breeding-termination',
    ])
    expect(createCycleBreedingAddRecordGroups('怀孕中')[0].items.map(item => item.page)).toContain('birth-wizard')
    expect(createCycleBreedingAddRecordGroups('怀孕中', {
      records: [{ type: 'pregnancy_check' }],
    })[0].items.map(item => item.page)).not.toContain('breeding-pregnancy')
  })

  it('怀孕中的犬只详情已有孕检记录时同步隐藏孕检入口', () => {
    const groups = createDogDetailAddRecordGroups({
      role: '种狗',
      gender: '母',
      activeCycleStatus: '怀孕中',
      activeCycleRecords: [{ type: 'pregnancy_check' }],
    })
    const breedingGroup = groups.find(group => group.key === 'breeding')

    expect(breedingGroup?.items.map(item => item.page)).toEqual([
      'breeding-prenatal',
      'breeding-prelabor',
      'birth-wizard',
      'breeding-termination',
    ])
  })

  it('哺乳中的犬只详情不提供繁育新增入口', () => {
    const groups = createDogDetailAddRecordGroups({
      role: '种狗',
      gender: '母',
      statuses: [{ type: '哺乳中', cycleId: 'cycle-1' }],
    })

    expect(groups.map(group => group.key)).toEqual(['health', 'medication'])
  })
})
