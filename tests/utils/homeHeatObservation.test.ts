import { describe, expect, it } from 'vitest'

import {
  buildHomeDirectMatingUrl,
  buildHomeHeatObservationUrl,
  canOpenHomeDirectMating,
  canOpenHomeHeatObservation,
} from '@/utils/homeHeatObservation'

describe('homeHeatObservation', () => {
  it('仅对首页发情周期中的建议卵泡检查行开放观察入口', () => {
    expect(canOpenHomeHeatObservation({
      dogId: 'dog-1',
      dogName: '奶糖',
      tasks: [{
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        details: { step_type: 'follicle_check' },
      }],
    })).toBe(true)

    expect(canOpenHomeHeatObservation({
      dogId: 'dog-1',
      dogName: '奶糖',
      tasks: [{
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        details: { step_type: 'mating' },
      }],
    })).toBe(false)

    expect(canOpenHomeHeatObservation({
      dogId: 'dog-1',
      dogName: '奶糖',
      tasks: [{
        type: 'breeding_milestone',
        details: { step_type: 'follicle_check' },
      }],
    })).toBe(false)
  })

  it('应生成锁定犬只和周期的发情观察页路由', () => {
    expect(buildHomeHeatObservationUrl({
      dogId: 'dog-1',
      dogName: '奶糖 A',
      tasks: [{
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        details: { step_type: 'follicle_check' },
      }],
    })).toBe('/pages/record/heat-observation?dogId=dog-1&dogName=%E5%A5%B6%E7%B3%96%20A&cycleId=cycle-1&locked=true')
  })

  it('仅对建议卵泡检查行开放直接配种入口，并保留来源 taskId', () => {
    expect(canOpenHomeDirectMating({
      dogId: 'dog-1',
      dogName: '奶糖',
      tasks: [{
        _id: 'task-1',
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        details: { step_type: 'follicle_check' },
      }],
    })).toBe(true)

    expect(canOpenHomeDirectMating({
      dogId: 'dog-1',
      dogName: '奶糖',
      tasks: [{
        _id: 'task-1',
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        details: { step_type: 'mating' },
      }],
    })).toBe(false)

    expect(buildHomeDirectMatingUrl({
      dogId: 'dog-1',
      dogName: '奶糖 A',
      tasks: [{
        _id: 'task-1',
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        details: { step_type: 'follicle_check' },
      }],
    })).toBe('/pages/record/breeding-mating?dogId=dog-1&dogName=%E5%A5%B6%E7%B3%96%20A&taskId=task-1&cycleId=cycle-1&locked=true')
  })
})
