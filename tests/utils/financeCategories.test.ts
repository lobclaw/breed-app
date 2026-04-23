import { describe, expect, it } from 'vitest'

import {
  DEFAULT_EXPENSE_CATEGORIES,
  getExpenseCategoryGroupKey,
  getIncomeTypeMeta,
  normalizeIncomeType,
} from '@/constants/financeCategories'

describe('financeCategories', () => {
  it('应包含新增的预设支出分类并映射到正确分组', () => {
    const categoryNames = DEFAULT_EXPENSE_CATEGORIES.map(item => item.name)

    expect(categoryNames).toContain('疫苗驱虫')
    expect(categoryNames).toContain('检查化验')
    expect(categoryNames).toContain('孕检产检')
    expect(categoryNames).toContain('生产育幼')
    expect(categoryNames).toContain('洗护美容')
    expect(categoryNames).toContain('设备器材')

    expect(getExpenseCategoryGroupKey('疫苗驱虫')).toBe('health')
    expect(getExpenseCategoryGroupKey('孕检产检')).toBe('breeding')
    expect(getExpenseCategoryGroupKey('洗护美容')).toBe('operations')
  })

  it('应将历史收入类型归一到当前展示口径', () => {
    expect(normalizeIncomeType('定金')).toBe('定金保留')
    expect(normalizeIncomeType('领养费')).toBe('领养')
    expect(normalizeIncomeType('配种费收入')).toBe('其他')
    expect(normalizeIncomeType('退款')).toBe('退款')
  })

  it('收入类型元数据应按归一后的类型返回', () => {
    expect(getIncomeTypeMeta('定金').icon).toBe('savings')
    expect(getIncomeTypeMeta('领养费').icon).toBe('volunteer_activism')
    expect(getIncomeTypeMeta('退款').icon).toBe('undo')
  })
})
