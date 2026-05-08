import { describe, expect, it } from 'vitest'

import {
  buildBreedingTimelineCurrentTitle,
  buildBreedingTimelineSyntheticItems,
  getBreedingTimelineRecordTone,
  getBreedingTimelineStatusTone,
} from '@/utils/breedingTimeline'

describe('breedingTimeline', () => {
  const now = new Date('2026-04-21T10:00:00+08:00').getTime()

  function createCycle(overrides: Record<string, any> = {}) {
    return {
      _id: 'cycle-1',
      family_id: 'fam-1',
      dam_id: 'dog-1',
      dam_name: '花花',
      status: '怀孕中',
      created_at: new Date('2026-04-18T00:00:00+08:00').getTime(),
      updated_at: now,
      ...overrides,
    } as any
  }

  function createRecord(type: string, date: string, details: Record<string, any> = {}) {
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
    } as any
  }

  it('应为繁育记录类型和当前状态提供统一 tone 口径', () => {
    expect(getBreedingTimelineRecordTone('heat')).toBe('amber')
    expect(getBreedingTimelineRecordTone('heat_observation')).toBe('amber')
    expect(getBreedingTimelineRecordTone('mating')).toBe('rose')
    expect(getBreedingTimelineRecordTone('pregnancy_check')).toBe('green')
    expect(getBreedingTimelineStatusTone('发情中')).toBe('amber')
    expect(getBreedingTimelineStatusTone('怀孕中')).toBe('rose')
    expect(getBreedingTimelineStatusTone('失败')).toBe('red')
  })

  it('应为怀孕中的周期生成下一步和当前状态合成节点', () => {
    const items = buildBreedingTimelineSyntheticItems(createCycle({
      status: '怀孕中',
      mated_at: new Date('2026-03-01T00:00:00+08:00').getTime(),
    }), [
      createRecord('mating', '2026-03-03T00:00:00+08:00', {
        expected_due_date: new Date('2026-05-01T00:00:00+08:00').getTime(),
      }),
      createRecord('pregnancy_check', '2026-04-20T00:00:00+08:00', { confirmed: '是', puppy_count: 3 }),
    ], now)

    expect(items.map(item => item.key)).toEqual(['upcoming', 'current'])
    expect(items[0]).toMatchObject({
      kind: 'upcoming',
      tone: 'gray',
      label: '下一步',
      title: '待产',
      summary: '预产期 2026-05-01 · 还有10天',
    })
    expect(items[1]).toMatchObject({
      kind: 'current',
      tone: 'rose',
      label: '当前',
      title: '怀孕第52天',
      summary: '预产期 2026-05-01',
    })
  })

  it('应为发情中的周期生成与当前状态一致的标题', () => {
    const title = buildBreedingTimelineCurrentTitle(createCycle({
      status: '发情中',
      created_at: new Date('2026-04-18T00:00:00+08:00').getTime(),
    }), [], now)

    expect(title).toBe('发情第4天')
  })

  it('已生产但未断奶时应显示哺乳阶段，并把下一步指向断奶', () => {
    const birthDate = new Date('2026-04-16T00:00:00+08:00').getTime()
    const items = buildBreedingTimelineSyntheticItems(createCycle({
      status: '已生产',
    }), [], now, {
      litter: {
        birth_date: birthDate,
        weaned_at: null,
      } as any,
    })

    expect(items.map(item => item.key)).toEqual(['upcoming', 'current'])
    expect(items[0]).toMatchObject({
      kind: 'upcoming',
      tone: 'gray',
      label: '下一步',
      title: '待断奶',
      summary: '出生第6天',
    })
    expect(items[1]).toMatchObject({
      kind: 'current',
      tone: 'amber',
      label: '当前',
      title: '哺乳第6天',
      summary: '生产于 2026-04-16',
    })
  })

  it('已生产且已断奶时应显示已断奶，不再生成下一步', () => {
    const title = buildBreedingTimelineCurrentTitle(createCycle({
      status: '已生产',
    }), [], now, {
      litter: {
        birth_date: new Date('2026-04-16T00:00:00+08:00').getTime(),
        weaned_at: new Date('2026-04-21T00:00:00+08:00').getTime(),
      } as any,
    })

    const items = buildBreedingTimelineSyntheticItems(createCycle({
      status: '已生产',
    }), [], now, {
      litter: {
        birth_date: new Date('2026-04-16T00:00:00+08:00').getTime(),
        weaned_at: new Date('2026-04-21T00:00:00+08:00').getTime(),
      } as any,
    })

    expect(title).toBe('已断奶')
    expect(items.map(item => item.key)).toEqual(['current'])
    expect(items[0]).toMatchObject({
      kind: 'current',
      label: '完成',
      tone: 'green',
      title: '已断奶',
      summary: '断奶于 2026-04-21',
    })
  })

  it('失败或放弃的周期应把当前节点标记为终止', () => {
    const items = buildBreedingTimelineSyntheticItems(createCycle({
      status: '失败',
    }), [
      createRecord('abnormal_termination', '2026-04-20T00:00:00+08:00', {
        termination_type: '未怀孕',
      }),
    ], now)

    expect(items.map(item => item.key)).toEqual(['current'])
    expect(items[0]).toMatchObject({
      kind: 'current',
      label: '终止',
      tone: 'red',
      title: '本次繁育已终止',
      summary: '异常终止：未怀孕',
    })
  })

  it('放弃周期的当前节点应区分周期结果和记录事实', () => {
    const items = buildBreedingTimelineSyntheticItems(createCycle({
      status: '放弃',
    }), [
      createRecord('abnormal_termination', '2026-04-20T00:00:00+08:00', {
        termination_type: '放弃配种',
      }),
    ], now)

    expect(items.map(item => item.key)).toEqual(['current'])
    expect(items[0]).toMatchObject({
      kind: 'current',
      label: '终止',
      tone: 'red',
      title: '本次繁育已终止',
      summary: '异常终止：放弃配种',
    })
  })

  it('无异常终止记录的放弃周期应显示放弃日期', () => {
    const items = buildBreedingTimelineSyntheticItems(createCycle({
      status: '放弃',
      updated_at: new Date('2026-05-06T00:00:00+08:00').getTime(),
    }), [], now)

    expect(items[0]).toMatchObject({
      title: '本次繁育已放弃',
      summary: '放弃于 2026-05-06',
    })
  })
})
