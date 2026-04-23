import { describe, expect, it } from 'vitest'

import {
  buildHomeBreedingProcessUrl,
  getHomeBreedingPrimaryAction,
  type HomeBreedingCardLike,
} from '@/utils/homeBreedingActions'

function makeCard(stepType: string, overrides: Partial<HomeBreedingCardLike> = {}): HomeBreedingCardLike {
  return {
    dogId: 'dog-1',
    dogName: '花花',
    tasks: [{
      _id: 'task-1',
      type: 'breeding_milestone',
      cycle_id: 'cycle-1',
      details: { step_type: stepType },
    }],
    ...overrides,
  }
}

describe('homeBreedingActions', () => {
  it('卵泡检查流程应返回锁定录入页与主动作文案', () => {
    const card = makeCard('follicle_check')

    expect(getHomeBreedingPrimaryAction(card)).toMatchObject({
      label: '记录卵泡检查',
      description: '录入检查结果，继续判断最佳配种时机',
    })
    expect(buildHomeBreedingProcessUrl(card)).toBe(
      '/pages/record/breeding-follicle?dogId=dog-1&dogName=%E8%8A%B1%E8%8A%B1&taskId=task-1&cycleId=cycle-1&locked=true',
    )
  })

  it('配种与孕检流程应返回锁定录入页', () => {
    expect(buildHomeBreedingProcessUrl(makeCard('mating'))).toBe(
      '/pages/record/breeding-mating?dogId=dog-1&dogName=%E8%8A%B1%E8%8A%B1&taskId=task-1&cycleId=cycle-1&locked=true',
    )
    expect(buildHomeBreedingProcessUrl(makeCard('pregnancy_check'))).toBe(
      '/pages/record/breeding-pregnancy?dogId=dog-1&dogName=%E8%8A%B1%E8%8A%B1&taskId=task-1&cycleId=cycle-1&locked=true',
    )
  })

  it('生产与断奶流程应保留例外跳转', () => {
    const birthCard = makeCard('birth')
    const weaningCard = makeCard('weaning_confirm', {
      tasks: [{
        _id: 'task-1',
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        litter_id: 'litter-1',
        details: { step_type: 'weaning_confirm' },
      }],
    })

    expect(buildHomeBreedingProcessUrl(birthCard)).toBe(
      '/pages/breeding/birth-wizard?cycleId=cycle-1&damName=%E8%8A%B1%E8%8A%B1',
    )
    expect(buildHomeBreedingProcessUrl(weaningCard)).toBe(
      '/pages/breeding/litter?id=litter-1&taskId=task-1',
    )
  })
})
