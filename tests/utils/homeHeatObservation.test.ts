import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  buildHomeContinueMatingUrl,
  buildHomeDirectMatingUrl,
  buildHomeHeatObservationUrl,
  buildHomePreLaborUrl,
  buildHomePrenatalUrl,
  canOpenHomeContinueMating,
  canOpenHomeDirectMating,
  canOpenHomeHeatObservation,
  canOpenHomePreLabor,
  canOpenHomePrenatal,
} from '@/utils/homeHeatObservation'

const testDir = dirname(fileURLToPath(import.meta.url))

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

  it('仅对建议孕检行开放继续配种入口，并不携带 taskId', () => {
    expect(canOpenHomeContinueMating({
      dogId: 'dog-1',
      dogName: '奶糖',
      tasks: [{
        _id: 'task-1',
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        details: { step_type: 'pregnancy_check' },
      }],
    })).toBe(true)

    expect(canOpenHomeContinueMating({
      dogId: 'dog-1',
      dogName: '奶糖',
      tasks: [{
        _id: 'task-1',
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        details: { step_type: 'birth' },
      }],
    })).toBe(false)

    expect(buildHomeContinueMatingUrl({
      dogId: 'dog-1',
      dogName: '奶糖 A',
      tasks: [{
        _id: 'task-1',
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        details: { step_type: 'pregnancy_check' },
      }],
    })).toBe('/pages/record/breeding-mating?dogId=dog-1&dogName=%E5%A5%B6%E7%B3%96%20A&cycleId=cycle-1&locked=true')
  })

  it('仅对带周期的待产行开放产检入口', () => {
    expect(canOpenHomePrenatal({
      dogId: 'dog-1',
      dogName: '奶糖',
      tasks: [{
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        details: { step_type: 'birth' },
      }],
    })).toBe(true)

    expect(canOpenHomePrenatal({
      dogId: 'dog-1',
      dogName: '奶糖',
      tasks: [{
        type: 'breeding_milestone',
        details: { step_type: 'birth' },
      }],
    })).toBe(false)

    expect(canOpenHomePrenatal({
      dogId: 'dog-1',
      dogName: '奶糖',
      tasks: [{
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        details: { step_type: 'pregnancy_check' },
      }],
    })).toBe(false)

    expect(buildHomePrenatalUrl({
      dogId: 'dog-1',
      dogName: '奶糖 A',
      tasks: [{
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        details: { step_type: 'birth' },
      }],
    })).toBe('/pages/record/breeding-prenatal?dogId=dog-1&dogName=%E5%A5%B6%E7%B3%96%20A&cycleId=cycle-1&locked=true')
  })

  it('仅在距预产期 5 天内对待产行开放临产入口', () => {
    const now = new Date('2026-06-12T09:00:00+08:00').getTime()

    expect(canOpenHomePreLabor({
      dogId: 'dog-1',
      dogName: '奶糖',
      tasks: [{
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        due_date: new Date('2026-06-20T00:00:00+08:00').getTime(),
        details: { step_type: 'birth' },
      }],
    }, now)).toBe(false)

    expect(canOpenHomePreLabor({
      dogId: 'dog-1',
      dogName: '奶糖',
      tasks: [{
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        due_date: new Date('2026-06-17T00:00:00+08:00').getTime(),
        details: { step_type: 'birth' },
      }],
    }, now)).toBe(true)

    expect(canOpenHomePreLabor({
      dogId: 'dog-1',
      dogName: '奶糖',
      tasks: [{
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        details: {
          step_type: 'birth',
          expected_due_date: new Date('2026-06-10T00:00:00+08:00').getTime(),
        },
      }],
    }, now)).toBe(true)

    expect(canOpenHomePreLabor({
      dogId: 'dog-1',
      dogName: '奶糖',
      tasks: [{
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        details: { step_type: 'birth' },
      }],
    }, now)).toBe(false)

    expect(canOpenHomePreLabor({
      dogId: 'dog-1',
      dogName: '奶糖',
      tasks: [{
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        due_date: new Date('2026-06-17T00:00:00+08:00').getTime(),
        details: { step_type: 'pregnancy_check' },
      }],
    }, now)).toBe(false)

    expect(buildHomePreLaborUrl({
      dogId: 'dog-1',
      dogName: '奶糖 A',
      tasks: [{
        type: 'breeding_milestone',
        cycle_id: 'cycle-1',
        details: { step_type: 'birth' },
      }],
    })).toBe('/pages/record/breeding-prelabor?dogId=dog-1&dogName=%E5%A5%B6%E7%B3%96%20A&cycleId=cycle-1&locked=true')
  })

  it('首页繁育卡两个渲染路径都接入待产弱入口', () => {
    const groupCardSource = readFileSync(resolve(testDir, '../../src/components/smart-card/BreedingProcessGroupCard.vue'), 'utf8')
    const singleCardSource = readFileSync(resolve(testDir, '../../src/components/smart-card/BreedingProcessCard.vue'), 'utf8')

    expect(groupCardSource).toContain('canOpenHomePrenatal')
    expect(groupCardSource).toContain('canOpenHomePreLabor')
    expect(groupCardSource).toContain('>产检<')
    expect(groupCardSource).toContain('>临产<')

    expect(singleCardSource).toContain('canOpenHomePrenatal')
    expect(singleCardSource).toContain('canOpenHomePreLabor')
    expect(singleCardSource).toContain('>产检<')
    expect(singleCardSource).toContain('>临产<')
  })
})
