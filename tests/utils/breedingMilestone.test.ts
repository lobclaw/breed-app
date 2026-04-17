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
    expect(viewModel.daysFromAnchor).toBe(9)
    expect(viewModel.dayLabel).toBe('距发情第 9 天')
    expect(viewModel.suggestionStatus).toBe('normal')
    expect(viewModel.suggestionLabel).toBe('建议日期 4月18日')
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
    expect(viewModel.daysFromAnchor).toBe(25)
    expect(viewModel.dayLabel).toBe('距配种第 25 天')
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
})
