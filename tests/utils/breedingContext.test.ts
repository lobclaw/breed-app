import { describe, expect, it } from 'vitest'
import {
  buildBreedingCycleMetaText,
  buildBreedingStageTag,
  buildBreedingStageTagFromContext,
} from '../../src/utils/breedingContext'

describe('breeding context display helpers', () => {
  const baseTs = new Date('2026-05-11T10:00:00+08:00').getTime()

  it('已配种周期应展示预产期和剩余天数', () => {
    const dueTs = new Date('2026-07-06T10:00:00+08:00').getTime()

    expect(buildBreedingCycleMetaText({
      cycle_id: 'cycle_1',
      cycle_number: 2,
      status: '怀孕中',
      dam_id: 'dog_1',
      dam_name: '波妞',
      heat_date: new Date('2026-05-01T10:00:00+08:00').getTime(),
      start_date: new Date('2026-05-01T10:00:00+08:00').getTime(),
      mated_at: new Date('2026-05-08T10:00:00+08:00').getTime(),
      expected_due_date: dueTs,
    }, baseTs)).toBe('第2次繁育 · 预产期 7月6日 · 剩56天')
  })

  it('预产期当天和已过预产期应使用对应短文案', () => {
    const todayDue = new Date('2026-05-11T08:00:00+08:00').getTime()
    const pastDue = new Date('2026-05-09T08:00:00+08:00').getTime()
    const baseContext = {
      cycle_id: 'cycle_due',
      cycle_number: 1,
      status: '怀孕中',
      dam_id: 'dog_1',
      dam_name: '波妞',
      heat_date: null,
      start_date: null,
      mated_at: null,
    }

    expect(buildBreedingCycleMetaText({ ...baseContext, expected_due_date: todayDue }, baseTs)).toBe('第1次繁育 · 预产期 5月11日 · 今天')
    expect(buildBreedingCycleMetaText({ ...baseContext, expected_due_date: pastDue }, baseTs)).toBe('第1次繁育 · 预产期 5月9日 · 已过2天')
  })

  it('未配种周期应展示上次发情日期', () => {
    const heatTs = new Date('2026-10-10T10:00:00+08:00').getTime()

    expect(buildBreedingCycleMetaText({
      cycle_id: 'cycle_heat',
      cycle_number: 3,
      status: '发情中',
      dam_id: 'dog_2',
      dam_name: '肉肉',
      heat_date: heatTs,
      start_date: heatTs,
      mated_at: null,
      expected_due_date: null,
    }, baseTs)).toBe('第3次繁育 · 上次发情：2026-10-10')
  })

  it('犬只状态和周期上下文都能生成阶段标签', () => {
    expect(buildBreedingStageTag({
      statuses: [{
        type: '发情中',
        cycleId: 'cycle_heat',
        progress: { current: 4 },
      }],
    }, 'cycle_heat')).toEqual({ label: '发情第4天', tone: 'heat' })

    expect(buildBreedingStageTagFromContext({
      cycle_id: 'cycle_heat',
      cycle_number: 4,
      status: '发情中',
      dam_id: 'dog_2',
      dam_name: '肉肉',
      heat_date: new Date('2026-05-11T10:00:00+08:00').getTime(),
      start_date: new Date('2026-05-11T10:00:00+08:00').getTime(),
      mated_at: null,
      expected_due_date: null,
    }, baseTs)).toEqual({ label: '发情第1天', tone: 'heat' })

    expect(buildBreedingStageTagFromContext({
      cycle_id: 'cycle_pregnant',
      cycle_number: 1,
      status: '怀孕中',
      dam_id: 'dog_3',
      dam_name: '团子',
      heat_date: null,
      start_date: null,
      mated_at: new Date('2026-05-08T10:00:00+08:00').getTime(),
      expected_due_date: null,
    }, baseTs)).toEqual({ label: '怀孕第4天', tone: 'pregnant' })
  })
})
