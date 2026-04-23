import { describe, expect, it } from 'vitest'

import { buildActiveCycleSummaryViewModel, buildHistoryCycleSummaryViewModel } from '@/utils/dogBreedingSummary'

describe('dogBreedingSummary', () => {
  const now = new Date('2026-04-21T10:00:00+08:00').getTime()

  function createCycle(overrides: Record<string, any> = {}) {
    return {
      _id: 'cycle-1',
      family_id: 'fam-1',
      dam_id: 'dog-1',
      dam_name: '花花',
      status: '发情中',
      cycle_number: 1,
      created_at: new Date('2026-04-18T00:00:00+08:00').getTime(),
      updated_at: now,
      ...overrides,
    } as any
  }

  function createRecord(type: string, date: string, details: Record<string, any> = {}, overrides: Record<string, any> = {}) {
    const ts = new Date(date).getTime()
    return {
      _id: `${type}-${ts}`,
      family_id: 'fam-1',
      created_at: now,
      updated_at: now,
      type,
      cycle_id: 'cycle-1',
      dog_id: 'dog-1',
      date: ts,
      details,
      ...overrides,
    }
  }

  it('会把当前周期改造成下一步 + 当前状态 + 历史倒序时间线', () => {
    const summary = buildActiveCycleSummaryViewModel(createCycle({
      sire_name: '团团',
      status: '怀孕中',
      cycle_number: 3,
      start_date: new Date('2026-02-18T00:00:00+08:00').getTime(),
      mated_at: new Date('2026-02-25T00:00:00+08:00').getTime(),
      created_at: new Date('2026-02-18T00:00:00+08:00').getTime(),
    }), [
      createRecord('heat', '2026-02-18T00:00:00+08:00'),
      createRecord('follicle_check', '2026-02-24T00:00:00+08:00', { left_count: 3, right_count: 2, result: '已成熟' }),
      createRecord('mating', '2026-02-25T00:00:00+08:00'),
      createRecord('mating', '2026-02-27T00:00:00+08:00'),
      createRecord('mating', '2026-03-01T00:00:00+08:00'),
      createRecord('mating', '2026-03-03T00:00:00+08:00', { expected_due_date: new Date('2026-04-23T00:00:00+08:00').getTime() }),
      createRecord('pregnancy_check', '2026-03-20T00:00:00+08:00', { confirmed: '是', puppy_count: 5 }),
      createRecord('prenatal_check', '2026-04-10T00:00:00+08:00', { results: '胎心稳定，状态平稳，继续观察' }),
      createRecord('pre_labor', '2026-04-20T00:00:00+08:00', { nesting_behavior: true }),
    ] as any, now)

    expect(summary.title).toBe('第3次繁育周期')
    expect(summary.subtitle).toBe('种公: 团团 · 怀孕第56天')
    expect(summary.timeline.map(item => item.title)).toEqual([
      '待产',
      '怀孕第56天',
      '临产监测',
      '产检',
      '孕检',
      '配种 ×4',
      '卵泡检查',
      '发情',
    ])
    expect(summary.timeline[0]).toMatchObject({
      kind: 'upcoming',
      tone: 'gray',
      summary: '预产期 2026-04-23 · 还有2天',
    })
    expect(summary.timeline[1]).toMatchObject({
      kind: 'current',
      tone: 'rose',
      summary: '预产期 2026-04-23',
    })
    expect(summary.timeline[5].summary).toContain('02-25 / 02-27 / 03-01')
    expect(summary.timeline[5].summary).toContain('等4次')
    expect(summary.timeline[4].summary).toContain('确认怀孕 · 5只')
    expect(summary.stageSummary).toContain('怀孕第56天')
    expect(summary.stageSummary).toContain('预产期 2026-04-23')
  })

  it('发情中且只有发情记录时，顶部显示建议卵泡检查', () => {
    const summary = buildActiveCycleSummaryViewModel(createCycle(), [
      createRecord('heat', '2026-04-18T00:00:00+08:00'),
    ] as any, now)

    expect(summary.timeline.map(item => item.title)).toEqual([
      '建议卵泡检查',
      '发情第4天',
      '发情',
    ])
    expect(summary.timeline[0]).toMatchObject({
      kind: 'upcoming',
      summary: '发情第4天',
    })
    expect(summary.timeline[1]).toMatchObject({
      kind: 'current',
      tone: 'amber',
      summary: '开始于 2026-04-18',
    })
  })

  it('发情中且已有卵泡未配种时，顶部显示建议配种', () => {
    const summary = buildActiveCycleSummaryViewModel(createCycle(), [
      createRecord('heat', '2026-04-18T00:00:00+08:00'),
      createRecord('follicle_check', '2026-04-20T00:00:00+08:00', { left_count: 2, right_count: 2 }),
    ] as any, now)

    expect(summary.timeline[0]).toMatchObject({
      title: '建议配种',
      summary: '卵泡检查后第2天',
    })
  })

  it('发情中且已有配种未孕检时，顶部显示建议孕检', () => {
    const summary = buildActiveCycleSummaryViewModel(createCycle({
      start_date: new Date('2026-04-18T00:00:00+08:00').getTime(),
    }), [
      createRecord('heat', '2026-04-18T00:00:00+08:00'),
      createRecord('follicle_check', '2026-04-19T00:00:00+08:00', { left_count: 2, right_count: 1 }),
      createRecord('mating', '2026-04-20T00:00:00+08:00', { mating_number: 2 }),
    ] as any, now)

    expect(summary.timeline[0]).toMatchObject({
      title: '建议孕检',
      summary: '距第2脚配种第2天',
    })
  })

  it('会兼容孕检旧字段并保留当前状态节点', () => {
    const summary = buildActiveCycleSummaryViewModel(createCycle(), [
      createRecord('pregnancy_check', '2026-04-20T00:00:00+08:00', { result: '确认怀孕', fetus_count: 4 }, { _id: 'pregnancy-legacy' }),
    ] as any, now)

    expect(summary.timeline.map(item => item.kind)).toEqual(['upcoming', 'current', 'record'])
    expect(summary.timeline[2].summary).toContain('确认怀孕 · 4只')
    expect(summary.stageSummary).toBe('发情第4天')
  })

  it('会为历史周期生成轻量摘要', () => {
    const summary = buildHistoryCycleSummaryViewModel({
      _id: 'cycle-1',
      family_id: 'fam-1',
      dam_id: 'dog-1',
      dam_name: '花花',
      sire_name: '团团',
      status: '已生产',
      cycle_number: 2,
      start_date: new Date('2026-02-18T00:00:00+08:00').getTime(),
      created_at: new Date('2026-02-18T00:00:00+08:00').getTime(),
      updated_at: new Date('2026-04-21T00:00:00+08:00').getTime(),
    } as any, {
      _id: 'litter-1',
      family_id: 'fam-1',
      cycle_id: 'cycle-1',
      dam_id: 'dog-1',
      dam_name: '花花',
      birth_date: new Date('2026-04-20T00:00:00+08:00').getTime(),
      total_born: 4,
      born_alive: 3,
      born_dead: 1,
      pupStats: {
        kept: 2,
      },
      birth_type: '顺产',
      created_by: 'user-1',
      created_at: new Date('2026-04-20T00:00:00+08:00').getTime(),
      updated_at: new Date('2026-04-20T00:00:00+08:00').getTime(),
    } as any)

    expect(summary.title).toBe('第2次周期')
    expect(summary.meta).toBe('2026-02-18 · 种公: 团团')
    expect(summary.result).toBe('存活 3/4 · 在养 2')
  })
})
