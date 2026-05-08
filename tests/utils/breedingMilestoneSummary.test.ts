import { describe, expect, it } from 'vitest'

import { deriveBreedingMilestoneViewModel } from '@/utils/breedingMilestone'
import { buildBreedingMilestoneSummary } from '@/utils/breedingMilestoneSummary'

function buildFollicleSummary(task: Record<string, any>, now: number) {
  const milestone = deriveBreedingMilestoneViewModel(task, now)
  return buildBreedingMilestoneSummary(milestone)
}

function buildSummary(task: Record<string, any>, now: number) {
  const milestone = deriveBreedingMilestoneViewModel(task, now)
  return buildBreedingMilestoneSummary(milestone)
}

describe('breedingMilestoneSummary 卵泡检查摘要', () => {
  const now = new Date('2026-04-22T10:00:00+08:00').getTime()

  it('0 次检查时应显示待处理建议', () => {
    const summary = buildFollicleSummary({
      due_date: new Date('2026-04-22T09:00:00+08:00').getTime(),
      details: {
        step_type: 'follicle_check',
        heat_date: new Date('2026-04-17T09:00:00+08:00').getTime(),
        follicle_check_count: 0,
      },
    }, now)

    expect(summary.stageTag).toBe('卵泡检查')
    expect(summary.primaryLabel).toBe('发情第 6 天')
    expect(summary.secondaryLabel).toBe('尚未检查 · 建议今日处理')
    expect(summary.alertLabel).toBe('')
  })

  it('1 次检查且结果正常时应显示最近一次结果', () => {
    const summary = buildFollicleSummary({
      due_date: new Date('2026-04-22T09:00:00+08:00').getTime(),
      details: {
        step_type: 'follicle_check',
        heat_date: new Date('2026-04-16T09:00:00+08:00').getTime(),
        follicle_check_count: 1,
        follicle_result: '发育中',
        latest_follicle_check_date: new Date('2026-04-22T08:00:00+08:00').getTime(),
        abnormal_result: false,
      },
    }, now)

    expect(summary.primaryLabel).toBe('发情第 7 天')
    expect(summary.secondaryLabel).toBe('上次发育中 · 1天前')
    expect(summary.alertLabel).toBe('')
  })

  it('多次检查时应显示累计次数和最近一次距今天数', () => {
    const summary = buildFollicleSummary({
      due_date: new Date('2026-04-23T09:00:00+08:00').getTime(),
      details: {
        step_type: 'follicle_check',
        heat_date: new Date('2026-04-14T09:00:00+08:00').getTime(),
        follicle_check_count: 3,
        follicle_result: '发育中',
        latest_follicle_check_date: new Date('2026-04-22T08:00:00+08:00').getTime(),
        abnormal_result: false,
      },
    }, now)

    expect(summary.secondaryLabel).toBe('已查3次 · 发育中 · 1天前')
    expect(summary.alertLabel).toBe('')
  })

  it('最近一次发育不良时应显示异常提示', () => {
    const summary = buildFollicleSummary({
      due_date: new Date('2026-04-23T09:00:00+08:00').getTime(),
      details: {
        step_type: 'follicle_check',
        heat_date: new Date('2026-04-14T09:00:00+08:00').getTime(),
        follicle_check_count: 2,
        follicle_result: '发育不良',
        latest_follicle_check_date: new Date('2026-04-21T08:00:00+08:00').getTime(),
        abnormal_result: true,
      },
    }, now)

    expect(summary.secondaryLabel).toBe('已查2次 · 发育不良 · 2天前')
    expect(summary.alertLabel).toBe('最近一次检查提示发育不良')
  })

  it('无异常但已超窗时应显示复查超期提示', () => {
    const summary = buildFollicleSummary({
      due_date: new Date('2026-04-20T09:00:00+08:00').getTime(),
      details: {
        step_type: 'follicle_check',
        heat_date: new Date('2026-04-14T09:00:00+08:00').getTime(),
        follicle_check_count: 2,
        follicle_result: '发育中',
        latest_follicle_check_date: new Date('2026-04-19T08:00:00+08:00').getTime(),
        abnormal_result: false,
      },
    }, now)

    expect(summary.secondaryLabel).toBe('已查2次 · 发育中 · 4天前')
    expect(summary.alertLabel).toBe('建议复查已过 2 天')
  })

  it('缺失 follicle_check_count 时应按旧数据回退为单次检查', () => {
    const summary = buildFollicleSummary({
      due_date: new Date('2026-04-23T09:00:00+08:00').getTime(),
      details: {
        step_type: 'follicle_check',
        heat_date: new Date('2026-04-18T09:00:00+08:00').getTime(),
        follicle_result: '发育中',
        latest_follicle_check_date: new Date('2026-04-22T08:00:00+08:00').getTime(),
        abnormal_result: false,
      },
    }, now)

    expect(summary.primaryLabel).toBe('发情第 5 天')
    expect(summary.secondaryLabel).toBe('上次发育中 · 1天前')
    expect(summary.alertLabel).toBe('')
  })

  it('配种超窗时应显示紧凑风险提示', () => {
    const summary = buildSummary({
      due_date: new Date('2026-04-16T09:00:00+08:00').getTime(),
      details: {
        step_type: 'mating',
        heat_date: new Date('2026-04-13T09:00:00+08:00').getTime(),
        follicle_check_date: new Date('2026-04-10T09:00:00+08:00').getTime(),
      },
    }, now)

    expect(summary.primaryLabel).toBe('发情第 10 天')
    expect(summary.secondaryLabel).toBe('卵检后第13天')
    expect(summary.alertLabel).toBe('建议配种日期已过 6 天')
  })

  it('建议孕检应显示完整动作文案', () => {
    const summary = buildSummary({
      due_date: new Date('2026-05-13T09:00:00+08:00').getTime(),
      details: {
        step_type: 'pregnancy_check',
        expected_due_date: new Date('2026-06-17T09:00:00+08:00').getTime(),
        expected_checkup_date: new Date('2026-05-13T09:00:00+08:00').getTime(),
      },
    }, now)

    expect(summary.primaryLabel).toBe('配种第 4 天')
    expect(summary.secondaryLabel).toBe('建议 5月13日孕检')
    expect(summary.alertLabel).toBe('')
  })
})
