export const EXPENSE_CATEGORY_GROUPS = [
  { key: 'feeding', label: '喂养营养' },
  { key: 'health', label: '医疗健康' },
  { key: 'breeding', label: '繁育投入' },
  { key: 'operations', label: '日常运营' },
  { key: 'other', label: '其他' },
] as const

export type ExpenseCategoryGroupKey = typeof EXPENSE_CATEGORY_GROUPS[number]['key']

export interface ExpenseCategoryOption {
  name: string
  parent_group: ExpenseCategoryGroupKey
  is_default?: boolean
}

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryOption[] = [
  { name: '食品', parent_group: 'feeding', is_default: true },
  { name: '营养品', parent_group: 'feeding', is_default: true },
  { name: '医疗', parent_group: 'health', is_default: true },
  { name: '配种费', parent_group: 'breeding', is_default: true },
  { name: '消耗品', parent_group: 'operations', is_default: true },
  { name: '日常用品', parent_group: 'operations', is_default: true },
  { name: '固定开销', parent_group: 'operations', is_default: true },
  { name: '交通', parent_group: 'operations', is_default: true },
  { name: '其他', parent_group: 'other', is_default: true },
]

export const INCOME_TYPES = ['销售', '定金保留', '领养', '其他'] as const

export const FINANCE_SORT_OPTIONS = [
  { value: 'date_desc', label: '最近记录' },
  { value: 'amount_desc', label: '金额从高到低' },
  { value: 'amount_asc', label: '金额从低到高' },
] as const

export const FINANCE_DATE_RANGE_OPTIONS = [
  { value: 'this_month', label: '本月' },
  { value: 'last_month', label: '上月' },
  { value: 'this_quarter', label: '本季度' },
  { value: 'this_year', label: '本年' },
  { value: 'custom', label: '自定义' },
] as const

export function getExpenseCategoryGroupLabel(groupKey?: string | null) {
  return EXPENSE_CATEGORY_GROUPS.find(item => item.key === groupKey)?.label || '其他'
}

export function normalizeExpenseCategoryGroupKey(groupKey?: string | null): ExpenseCategoryGroupKey {
  return EXPENSE_CATEGORY_GROUPS.find(item => item.key === groupKey)?.key || 'other'
}

export function getExpenseCategoryGroupKey(categoryName?: string | null) {
  return DEFAULT_EXPENSE_CATEGORIES.find(item => item.name === categoryName)?.parent_group || 'other'
}

export function getExpenseCategoryGroupOptions(categories: ExpenseCategoryOption[]) {
  const seen = new Set<ExpenseCategoryGroupKey>()
  return categories
    .map(item => item.parent_group)
    .filter((groupKey): groupKey is ExpenseCategoryGroupKey => !!groupKey)
    .filter((groupKey) => {
      if (seen.has(groupKey)) return false
      seen.add(groupKey)
      return true
    })
    .map(groupKey => ({
      key: groupKey,
      label: getExpenseCategoryGroupLabel(groupKey),
    }))
}

export function groupExpenseCategories(categories: ExpenseCategoryOption[]) {
  return EXPENSE_CATEGORY_GROUPS.map(group => ({
    ...group,
    items: categories.filter(category => category.parent_group === group.key),
  })).filter(group => group.items.length > 0)
}
