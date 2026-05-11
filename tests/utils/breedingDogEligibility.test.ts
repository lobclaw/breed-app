import { describe, expect, it } from 'vitest'

import { getBirthCycleIdFromDog, getBreedingDogPickerEmptyState, getEligibleBreedingDogs, selectDefaultBreedingDog } from '@/utils/breedingDogEligibility'

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

  it('卵泡检查、配种候选应显示尚未配种的空闲与发情中种母', () => {
    const dogs = [
      createDog({ _id: 'dam_idle' }),
      createDog({ _id: 'dam_heat', statuses: [{ type: '发情中', cycleId: 'cycle_heat' }] }),
      createDog({ _id: 'dam_pregnant', statuses: [{ type: '怀孕中', cycleId: 'cycle_pregnant' }] }),
      createDog({ _id: 'dam_lactating', statuses: [{ type: '哺乳中', cycleId: 'cycle_litter' }] }),
    ]

    expect(getEligibleBreedingDogs(dogs as any, 'heat').map(dog => dog._id)).toEqual(['dam_idle'])
    expect(getEligibleBreedingDogs(dogs as any, 'follicle_check').map(dog => dog._id)).toEqual(['dam_idle', 'dam_heat'])
    expect(getEligibleBreedingDogs(dogs as any, 'mating').map(dog => dog._id)).toEqual(['dam_idle', 'dam_heat'])
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

  it('生产候选应只保留带怀孕中当前周期的种母', () => {
    const dogs = [
      createDog({ _id: 'dam_idle' }),
      createDog({ _id: 'dam_heat', statuses: [{ type: '发情中', cycleId: 'cycle_heat' }] }),
      createDog({ _id: 'dam_pregnant', statuses: [{ type: '怀孕中', cycleId: 'cycle_pregnant' }] }),
      createDog({ _id: 'dam_pregnant_legacy', statuses: [{ type: '怀孕中', cycle_id: 'cycle_legacy' }] }),
      createDog({ _id: 'dam_pregnant_no_cycle', statuses: [{ type: '怀孕中' }] }),
      createDog({ _id: 'sire_pregnant_bad_data', gender: '公', statuses: [{ type: '怀孕中', cycleId: 'cycle_sire' }] }),
    ]

    expect(getEligibleBreedingDogs(dogs as any, 'birth').map(dog => dog._id)).toEqual(['dam_pregnant', 'dam_pregnant_legacy'])
    expect(getBirthCycleIdFromDog(dogs[2] as any)).toBe('cycle_pregnant')
    expect(getBirthCycleIdFromDog(dogs[3] as any)).toBe('cycle_legacy')
  })

  it('生产、孕检、产检、临产默认选中最接近生产的怀孕中种母', () => {
    const dogs = [
      createDog({ _id: 'dam_due_later', statuses: [{ type: '怀孕中', cycleId: 'cycle_later', progress: { current: 36, total: 63 }, activityTs: 200 }] }),
      createDog({ _id: 'dam_due_soon', statuses: [{ type: '怀孕中', cycleId: 'cycle_soon', progress: { current: 58, total: 63 }, activityTs: 100 }] }),
      createDog({ _id: 'dam_heat', statuses: [{ type: '发情中', cycleId: 'cycle_heat', progress: { current: 7, total: 21 }, activityTs: 300 }] }),
    ]

    expect(selectDefaultBreedingDog(dogs as any, 'birth')?._id).toBe('dam_due_soon')
    expect(selectDefaultBreedingDog(dogs as any, 'pregnancy_check')?._id).toBe('dam_due_soon')
    expect(selectDefaultBreedingDog(dogs as any, 'prenatal_check')?._id).toBe('dam_due_soon')
    expect(selectDefaultBreedingDog(dogs as any, 'pre_labor')?._id).toBe('dam_due_soon')
  })

  it('卵泡检查、配种、发情观察默认优先当前发情周期，不自动选异常终止或发情批量入口', () => {
    const dogs = [
      createDog({ _id: 'dam_idle' }),
      createDog({ _id: 'dam_heat_early', statuses: [{ type: '发情中', cycleId: 'cycle_early', progress: { current: 3, total: 21 }, activityTs: 200 }] }),
      createDog({ _id: 'dam_heat_late', statuses: [{ type: '发情中', cycleId: 'cycle_late', progress: { current: 6, total: 21 }, activityTs: 100 }] }),
    ]

    expect(selectDefaultBreedingDog(dogs as any, 'follicle_check')?._id).toBe('dam_heat_late')
    expect(selectDefaultBreedingDog(dogs as any, 'mating')?._id).toBe('dam_heat_late')
    expect(selectDefaultBreedingDog(dogs as any, 'heat_observation')?._id).toBe('dam_heat_late')
    expect(selectDefaultBreedingDog(dogs as any, 'heat')).toBeNull()
    expect(selectDefaultBreedingDog(dogs as any, 'abnormal_termination')).toBeNull()
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
      description: '怀孕中、哺乳中的犬只已自动隐藏',
    })

    expect(getBreedingDogPickerEmptyState('mating', dams as any, [])).toEqual({
      title: '暂无可配种的种母',
      description: '怀孕中、哺乳中的犬只已自动隐藏',
    })

    expect(getBreedingDogPickerEmptyState('abnormal_termination', dams as any, [])).toEqual({
      title: '暂无可终止的繁育周期',
      description: '只有发情中或怀孕中的当前周期犬只才会显示在这里',
    })

    expect(getBreedingDogPickerEmptyState('birth', dams as any, [])).toEqual({
      title: '暂无可记录生产的种母',
      description: '只有怀孕中的当前周期犬只才会显示在这里',
    })
  })
})
