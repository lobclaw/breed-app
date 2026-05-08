import { describe, expect, it } from 'vitest'

import { deriveBreedingMilestoneViewModel } from '@/utils/breedingMilestone'

describe('deriveBreedingMilestoneViewModel', () => {
  const DAY_MS = 86400000
  const now = new Date('2026-04-17T09:00:00+08:00').getTime()

  it('卵泡检查应基于建议日期反推出发情天数', () => {
    const dueDate = new Date('2026-04-18T00:00:00+08:00').getTime()
    const viewModel = deriveBreedingMilestoneViewModel({
      title: '小米 · 建议卵泡检查',
      due_date: dueDate,
      details: { step_type: 'follicle_check' },
    }, now)

    expect(viewModel.stageTitle).toBe('建议卵泡检查')
    expect(viewModel.anchorLabel).toBe('发情')
    expect(viewModel.daysFromAnchor).toBe(10)
    expect(viewModel.dayLabel).toBe('发情第 10 天')
    expect(viewModel.suggestionStatus).toBe('normal')
    expect(viewModel.suggestionLabel).toBe('建议日期 4月18日')
  })

  it('未成熟卵泡检查应保留建议卵泡检查并回到发情天数口径', () => {
    const heatDate = new Date('2026-04-10T00:00:00+08:00').getTime()
    const latestFollicleDate = new Date('2026-04-16T00:00:00+08:00').getTime()
    const dueDate = new Date('2026-04-17T00:00:00+08:00').getTime()
    const viewModel = deriveBreedingMilestoneViewModel({
      title: '小米 · 建议卵泡检查',
      due_date: dueDate,
      details: {
        step_type: 'follicle_check',
        heat_date: heatDate,
        latest_follicle_check_date: latestFollicleDate,
        follicle_result: '发育中',
        abnormal_result: false,
      },
    }, now)

    expect(viewModel.stageTitle).toBe('建议卵泡检查')
    expect(viewModel.heatDayLabel).toBe('发情第 8 天')
    expect(viewModel.stageDayLabel).toBe('发情第 8 天')
    expect(viewModel.referenceDateLabel).toBe('建议日期 · 4月17日')
    expect(viewModel.alertLabel).toBe('')
  })

  it('发育不良的卵泡检查应返回异常强化文案', () => {
    const viewModel = deriveBreedingMilestoneViewModel({
      title: '小米 · 建议卵泡检查',
      due_date: new Date('2026-04-18T00:00:00+08:00').getTime(),
      details: {
        step_type: 'follicle_check',
        heat_date: new Date('2026-04-10T00:00:00+08:00').getTime(),
        latest_follicle_check_date: new Date('2026-04-16T00:00:00+08:00').getTime(),
        follicle_result: '发育不良',
        abnormal_result: true,
      },
    }, now)

    expect(viewModel.alertLabel).toBe('本次检查提示发育不良')
    expect(viewModel.isAlertDanger).toBe(true)
  })

  it('孕检应优先使用 expected_due_date 反推配种天数', () => {
    const expectedDueDate = new Date('2026-05-21T00:00:00+08:00').getTime()
    const dueDate = expectedDueDate - 34 * DAY_MS
    const viewModel = deriveBreedingMilestoneViewModel({
      title: '花花 · 建议孕检',
      due_date: dueDate,
      details: {
        step_type: 'pregnancy_check',
        expected_due_date: expectedDueDate,
        expected_checkup_date: dueDate,
      },
    }, now)

    expect(viewModel.anchorLabel).toBe('配种')
    expect(viewModel.daysFromAnchor).toBe(26)
    expect(viewModel.dayLabel).toBe('配种第 26 天')
  })

  it('配种节点应显示为卵泡检查后的当日推进', () => {
    const dueDate = new Date('2026-04-17T00:00:00+08:00').getTime()
    const viewModel = deriveBreedingMilestoneViewModel({
      title: '花花 · 配种',
      due_date: dueDate,
      details: { step_type: 'mating' },
    }, now)

    expect(viewModel.stageTitle).toBe('配种')
    expect(viewModel.anchorLabel).toBe('卵泡检查')
    expect(viewModel.daysFromAnchor).toBe(1)
    expect(viewModel.dayLabel).toBe('卵泡检查第 1 天')
    expect(viewModel.suggestionStatus).toBe('window_due')
    expect(viewModel.suggestionLabel).toBe('建议今日处理')
  })

  it('超过建议日期后应只增强文案，不变成逾期态', () => {
    const dueDate = new Date('2026-04-15T00:00:00+08:00').getTime()
    const viewModel = deriveBreedingMilestoneViewModel({
      title: '大桥 · 建议卵泡检查',
      due_date: dueDate,
      details: { step_type: 'follicle_check' },
    }, now)

    expect(viewModel.suggestionStatus).toBe('window_passed')
    expect(viewModel.suggestionLabel).toBe('建议日期已过 2 天')
    expect(viewModel.referenceDateLabel).toBe('建议日期 · 4月15日')
  })

  it('待产节点应显示待产与预产期文案', () => {
    const dueDate = new Date('2026-06-18T00:00:00+08:00').getTime()
    const viewModel = deriveBreedingMilestoneViewModel({
      title: '花花 · 生产',
      due_date: dueDate,
      details: {
        step_type: 'birth',
        mating_date: new Date('2026-04-20T00:00:00+08:00').getTime(),
        mating_number: 2,
      },
    }, now)

    expect(viewModel.stageTitle).toBe('待产')
    expect(viewModel.anchorLabel).toBe('配种')
    expect(viewModel.suggestionLabel).toBe('预产期 6月18日')
    expect(viewModel.referenceDateLabel).toBe('预产期 · 6月18日')
    expect(viewModel.stageDayLabel).toBe('第2脚配种第 1 天')
  })

  it('断奶节点应显示待断奶、哺乳天数与预计断奶日', () => {
    const birthDate = new Date('2026-04-17T00:00:00+08:00').getTime()
    const dueDate = new Date('2026-06-04T00:00:00+08:00').getTime()
    const viewModel = deriveBreedingMilestoneViewModel({
      title: '花花窝 · 确认断奶',
      due_date: dueDate,
      details: {
        step_type: 'weaning_confirm',
        birth_date: birthDate,
      },
    }, now)

    expect(viewModel.stageTitle).toBe('待断奶')
    expect(viewModel.anchorLabel).toBe('出生')
    expect(viewModel.daysFromAnchor).toBe(1)
    expect(viewModel.dayLabel).toBe('出生第 1 天')
    expect(viewModel.stageDayLabel).toBe('哺乳第 1 天')
    expect(viewModel.referenceDateLabel).toBe('预计 6月4日断奶')
    expect(viewModel.suggestionStatus).toBe('normal')
  })

  it('断奶节点缺少出生日期时应降级为待确认文案', () => {
    const viewModel = deriveBreedingMilestoneViewModel({
      title: '花花窝 · 确认断奶',
      details: {
        step_type: 'weaning_confirm',
      },
    }, now)

    expect(viewModel.stageTitle).toBe('待断奶')
    expect(viewModel.stageDayLabel).toBe('哺乳天数待确认')
    expect(viewModel.referenceDateLabel).toBe('预计断奶时间待确认')
    expect(viewModel.suggestionLabel).toBe('预计断奶时间待确认')
  })
})
