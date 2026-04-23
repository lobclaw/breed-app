import { describe, expect, it } from 'vitest'

import { getBreedingDogPickerEmptyState, getEligibleBreedingDogs } from '@/utils/breedingDogEligibility'

function createDog(overrides: Record<string, any> = {}) {
  return {
    _id: overrides._id || 'dog_1',
    name: overrides.name || '花花',
    gender: overrides.gender || '母',
    role: overrides.role || '种狗',
    statuses: overrides.statuses || [],
    ...overrides,
  }
}

describe('breedingDogEligibility', () => {
  it('发情候选应隐藏发情中、怀孕中、哺乳中的种母', () => {
    const dogs = [
      createDog({ _id: 'dam_idle' }),
      createDog({ _id: 'dam_heat', statuses: [{ type: '发情中', cycleId: 'cycle_heat' }] }),
      createDog({ _id: 'dam_pregnant', statuses: [{ type: '怀孕中', cycleId: 'cycle_pregnant' }] }),
      createDog({ _id: 'dam_lactating', statuses: [{ type: '哺乳中', cycleId: 'cycle_litter' }] }),
    ]

    expect(getEligibleBreedingDogs(dogs as any, 'heat').map(dog => dog._id)).toEqual(['dam_idle'])
  })

  it('发情、卵泡检查、配种的自由入口候选应完全一致', () => {
    const dogs = [
      createDog({ _id: 'dam_idle' }),
      createDog({ _id: 'dam_heat', statuses: [{ type: '发情中', cycleId: 'cycle_heat' }] }),
      createDog({ _id: 'dam_pregnant', statuses: [{ type: '怀孕中', cycleId: 'cycle_pregnant' }] }),
      createDog({ _id: 'dam_lactating', statuses: [{ type: '哺乳中', cycleId: 'cycle_litter' }] }),
    ]

    expect(getEligibleBreedingDogs(dogs as any, 'heat').map(dog => dog._id)).toEqual(['dam_idle'])
    expect(getEligibleBreedingDogs(dogs as any, 'follicle_check').map(dog => dog._id)).toEqual(['dam_idle'])
    expect(getEligibleBreedingDogs(dogs as any, 'mating').map(dog => dog._id)).toEqual(['dam_idle'])
  })

  it('严格步骤候选应只保留带当前周期的怀孕中种母', () => {
    const dogs = [
      createDog({ _id: 'dam_idle' }),
      createDog({ _id: 'dam_heat', statuses: [{ type: '发情中', cycleId: 'cycle_heat' }] }),
      createDog({ _id: 'dam_pregnant', statuses: [{ type: '怀孕中', cycleId: 'cycle_pregnant' }] }),
      createDog({ _id: 'dam_pregnant_no_cycle', statuses: [{ type: '怀孕中' }] }),
    ]

    expect(getEligibleBreedingDogs(dogs as any, 'pregnancy_check').map(dog => dog._id)).toEqual(['dam_pregnant'])
    expect(getEligibleBreedingDogs(dogs as any, 'prenatal_check').map(dog => dog._id)).toEqual(['dam_pregnant'])
    expect(getEligibleBreedingDogs(dogs as any, 'pre_labor').map(dog => dog._id)).toEqual(['dam_pregnant'])
  })

  it('应返回对应记录类型的空态文案', () => {
    const dams = [
      createDog({ _id: 'dam_heat', statuses: [{ type: '发情中', cycleId: 'cycle_heat' }] }),
    ]

    expect(getBreedingDogPickerEmptyState('heat', dams as any, [])).toEqual({
      title: '暂无可录入的种母',
      description: '发情中、怀孕中、哺乳中的犬只已自动隐藏',
    })

    expect(getBreedingDogPickerEmptyState('follicle_check', dams as any, [])).toEqual({
      title: '暂无可检查的种母',
      description: '发情中、怀孕中、哺乳中的犬只已自动隐藏',
    })

    expect(getBreedingDogPickerEmptyState('mating', dams as any, [])).toEqual({
      title: '暂无可配种的种母',
      description: '发情中、怀孕中、哺乳中的犬只已自动隐藏',
    })

    expect(getBreedingDogPickerEmptyState('abnormal_termination', dams as any, [])).toEqual({
      title: '暂无可终止的繁育周期',
      description: '只有发情中或怀孕中的当前周期犬只才会显示在这里',
    })
  })
})
