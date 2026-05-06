import { describe, expect, it } from 'vitest'

import {
  buildActiveCycleSummaryViewModel,
  buildHistoryCycleSummaryViewModel,
  isDogDetailActiveBreedingCycle,
  isDogDetailHistoryBreedingCycle,
} from '@/utils/dogBreedingSummary'

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

  function createLitter(overrides: Record<string, any> = {}) {
    return {
      _id: 'litter-1',
      family_id: 'fam-1',
      cycle_id: 'cycle-1',
      dam_id: 'dog-1',
      dam_name: '花花',
      birth_date: new Date('2026-04-16T00:00:00+08:00').getTime(),
      total_born: 3,
      born_alive: 3,
      born_dead: 0,
      birth_type: '顺产',
      created_by: 'user-1',
      created_at: new Date('2026-04-16T00:00:00+08:00').getTime(),
      updated_at: new Date('2026-04-16T00:00:00+08:00').getTime(),
      ...overrides,
    } as any
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
    expect(summary.subtitle).toBe('种公: 团团 · 配种4次')
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
    expect(summary.timeline[5].summary).toContain('2026-02-25 / 2026-02-27 / 2026-03-01')
    expect(summary.timeline[5].summary).toContain('等4次')
    expect(summary.timeline[4].summary).toContain('确认怀孕 · 5只')
    expect(summary.stageSummary).toContain('怀孕第56天')
    expect(summary.stageSummary).toContain('预产期 2026-04-23')
  })

  it('怀孕中的当前周期摘要应从最近配种记录回填种公名', () => {
    const summary = buildActiveCycleSummaryViewModel(createCycle({
      status: '怀孕中',
      cycle_number: 1,
      mated_at: new Date('2026-05-06T00:00:00+08:00').getTime(),
    }), [
      createRecord('mating', '2026-05-06T00:00:00+08:00', {
        sire_name: '弟弟',
        mating_number: 1,
      }),
    ] as any, now)

    expect(summary.subtitle).toBe('种公: 弟弟 · 配种1次')
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

  it('已生产但未断奶的当前周期摘要应显示待断奶、哺乳阶段和生产节点', () => {
    const summary = buildActiveCycleSummaryViewModel(createCycle({
      status: '已生产',
    }), [
      createRecord('pregnancy_check', '2026-04-15T00:00:00+08:00', { result: '确认怀孕', fetus_count: 3 }),
      createRecord('birth', '2026-04-16T00:00:00+08:00', { birth_type: '顺产', total_born: 3, born_alive: 3 }),
    ] as any, now, createLitter({
      weaned_at: null,
    }))

    expect(summary.timeline.map(item => item.title)).toEqual(['待断奶', '哺乳第6天', '生产', '孕检'])
    expect(summary.timeline[0]).toMatchObject({
      kind: 'upcoming',
      summary: '出生第6天',
    })
    expect(summary.timeline[1]).toMatchObject({
      kind: 'current',
      tone: 'amber',
      summary: '生产于 2026-04-16',
    })
    expect(summary.timeline[2]).toMatchObject({
      kind: 'record',
      tone: 'green',
      summary: '2026-04-16 · 顺产 · 存活 3/3',
    })
    expect(summary.stageSummary).toBe('已生产 · 生产日期 2026-04-16')
  })

  it('已生产且已断奶的当前周期摘要不再显示待断奶', () => {
    const summary = buildActiveCycleSummaryViewModel(createCycle({
      status: '已生产',
    }), [], now, createLitter({
      weaned_at: new Date('2026-05-20T00:00:00+08:00').getTime(),
    }))

    expect(summary.timeline.map(item => item.title)).toEqual(['已断奶', '生产'])
    expect(summary.timeline[1]).toMatchObject({
      title: '生产',
      summary: '2026-04-16 · 顺产 · 存活 3/3',
    })
    expect(summary.stageSummary).toBe('已生产 · 生产日期 2026-04-16')
  })

  it('没有生产记录但已有窝时，应使用窝信息补出生产节点', () => {
    const summary = buildActiveCycleSummaryViewModel(createCycle({
      status: '已生产',
    }), [
      createRecord('pregnancy_check', '2026-04-15T00:00:00+08:00', { result: '确认怀孕', fetus_count: 3 }),
    ] as any, now, createLitter({
      weaned_at: null,
    }))

    expect(summary.timeline.map(item => item.title)).toEqual(['待断奶', '哺乳第6天', '生产', '孕检'])
    expect(summary.timeline[2]).toMatchObject({
      title: '生产',
      summary: '2026-04-16 · 顺产 · 存活 3/3',
    })
  })

  it('同一天只有日期粒度时，应按繁育阶段排序而不是按 key 排序', () => {
    const sameDay = '2026-04-20T00:00:00+08:00'
    const summary = buildActiveCycleSummaryViewModel(createCycle({
      status: '已生产',
    }), [
      createRecord('mating', sameDay, { mating_number: 1 }),
      createRecord('pregnancy_check', sameDay, { result: '确认怀孕', fetus_count: 5 }),
      createRecord('birth', sameDay, { birth_type: '剖腹产', total_born: 3, born_alive: 3 }),
      createRecord('follicle_check', '2026-04-17T00:00:00+08:00', { left_count: 2, right_count: 2 }),
    ] as any, now, createLitter({
      birth_date: new Date(sameDay).getTime(),
      weaned_at: null,
    }))

    expect(summary.timeline.map(item => item.title)).toEqual([
      '待断奶',
      '哺乳第2天',
      '生产',
      '孕检',
      '配种 ×1',
      '卵泡检查',
    ])
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

  it('已生产但未断奶的周期应归为当前进行中，不进入繁育历史', () => {
    const cycle = createCycle({ status: '已生产' })
    const litter = createLitter({ weaned_at: null })

    expect(isDogDetailActiveBreedingCycle(cycle, litter)).toBe(true)
    expect(isDogDetailHistoryBreedingCycle(cycle, litter)).toBe(false)
  })

  it('已生产且已断奶的周期应进入繁育历史', () => {
    const cycle = createCycle({ status: '已生产' })
    const litter = createLitter({
      weaned_at: new Date('2026-05-20T00:00:00+08:00').getTime(),
    })

    expect(isDogDetailActiveBreedingCycle(cycle, litter)).toBe(false)
    expect(isDogDetailHistoryBreedingCycle(cycle, litter)).toBe(true)
  })

  it('失败和放弃的周期始终进入繁育历史', () => {
    const failedCycle = createCycle({ status: '失败' })
    const abandonedCycle = createCycle({ status: '放弃' })

    expect(isDogDetailActiveBreedingCycle(failedCycle, null)).toBe(false)
    expect(isDogDetailHistoryBreedingCycle(failedCycle, null)).toBe(true)
    expect(isDogDetailActiveBreedingCycle(abandonedCycle, null)).toBe(false)
    expect(isDogDetailHistoryBreedingCycle(abandonedCycle, null)).toBe(true)
  })
})
