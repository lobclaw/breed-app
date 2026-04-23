export interface ExpenseCategoryGroupOption {
  key: string
  label: string
  is_default?: boolean
}

export const PRESET_EXPENSE_CATEGORY_GROUPS: ExpenseCategoryGroupOption[] = [
  { key: 'feeding', label: '喂养营养', is_default: true },
  { key: 'health', label: '医疗健康', is_default: true },
  { key: 'breeding', label: '繁育投入', is_default: true },
  { key: 'operations', label: '日常运营', is_default: true },
  { key: 'other', label: '其他', is_default: true },
]

export const EXPENSE_CATEGORY_GROUPS = PRESET_EXPENSE_CATEGORY_GROUPS

export type ExpenseCategoryGroupKey = string

export interface ExpenseCategoryOption {
  name: string
  parent_group: ExpenseCategoryGroupKey
  is_default?: boolean
}

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryOption[] = [
  { name: '食品', parent_group: 'feeding', is_default: true },
  { name: '营养品', parent_group: 'feeding', is_default: true },
  { name: '医疗', parent_group: 'health', is_default: true },
  { name: '疫苗驱虫', parent_group: 'health', is_default: true },
  { name: '检查化验', parent_group: 'health', is_default: true },
  { name: '配种费', parent_group: 'breeding', is_default: true },
  { name: '孕检产检', parent_group: 'breeding', is_default: true },
  { name: '生产育幼', parent_group: 'breeding', is_default: true },
  { name: '消耗品', parent_group: 'operations', is_default: true },
  { name: '日常用品', parent_group: 'operations', is_default: true },
  { name: '固定开销', parent_group: 'operations', is_default: true },
  { name: '交通', parent_group: 'operations', is_default: true },
  { name: '洗护美容', parent_group: 'operations', is_default: true },
  { name: '设备器材', parent_group: 'operations', is_default: true },
  { name: '其他', parent_group: 'other', is_default: true },
]

export const LEGACY_EXPENSE_CATEGORY_MAP = {
  疫苗: '疫苗驱虫',
  驱虫: '疫苗驱虫',
  治疗: '医疗',
  卵泡检查: '检查化验',
  孕检: '孕检产检',
  产检: '孕检产检',
  临产监测: '孕检产检',
  配种: '配种费',
  生产: '生产育幼',
  异常终止: '生产育幼',
} as const

export const INCOME_TYPES = ['销售', '定金保留', '领养', '其他'] as const
export const INCOME_AUTO_TYPES = ['退款'] as const
export const INCOME_FILTER_TYPES = ['销售', '定金保留', '领养', '其他', '退款'] as const
export const LEGACY_INCOME_TYPES = ['定金', '领养费', '配种费收入'] as const

export type ManualIncomeType = typeof INCOME_TYPES[number]
export type AutoIncomeType = typeof INCOME_AUTO_TYPES[number]
export type IncomeFilterType = typeof INCOME_FILTER_TYPES[number]
export type LegacyIncomeType = typeof LEGACY_INCOME_TYPES[number]

const LEGACY_INCOME_TYPE_MAP: Record<LegacyIncomeType, ManualIncomeType> = {
  定金: '定金保留',
  领养费: '领养',
  配种费收入: '其他',
}

export const EXPENSE_CATEGORY_META: Record<string, { icon: string; bg: string }> = {
  食品: { icon: 'restaurant', bg: '#FFD4DE' },
  营养品: { icon: 'medication', bg: '#E4D8F4' },
  医疗: { icon: 'local_hospital', bg: '#D0F0DC' },
  疫苗驱虫: { icon: 'vaccines', bg: '#D9EEFF' },
  检查化验: { icon: 'science', bg: '#E3F2E1' },
  配种费: { icon: 'favorite', bg: '#FFD4DE' },
  孕检产检: { icon: 'monitor_heart', bg: '#F6D8E9' },
  生产育幼: { icon: 'child_care', bg: '#FFE7C7' },
  消耗品: { icon: 'shopping_bag', bg: '#D4E8F8' },
  日常用品: { icon: 'home', bg: '#D0F0EC' },
  固定开销: { icon: 'pin_drop', bg: '#FFD9D4' },
  交通: { icon: 'directions_car', bg: '#D4E8F8' },
  洗护美容: { icon: 'content_cut', bg: '#F6D8E9' },
  设备器材: { icon: 'build', bg: '#E8E1DA' },
  其他: { icon: 'more_horiz', bg: 'var(--card-dim)' },
}

export const INCOME_TYPE_META: Record<IncomeFilterType | ManualIncomeType, { icon: string; bg: string; desc: string }> = {
  销售: { icon: 'sell', bg: '#FFD9E2', desc: '幼犬销售、尾款回收' },
  定金保留: { icon: 'savings', bg: '#FFE7C7', desc: '取消后保留的定金' },
  领养: { icon: 'volunteer_activism', bg: '#F6D8E9', desc: '领养费、安置费用' },
  其他: { icon: 'more_horiz', bg: '#E8E1DA', desc: '补录收入或其他进账' },
  退款: { icon: 'undo', bg: '#D9EEFF', desc: '销售退款或金额回冲' },
}

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

const EXPENSE_CATEGORY_GROUP_PRESET_COLORS: Record<string, string> = {
  feeding: '#f59a3f',
  health: '#e56767',
  breeding: '#d68ae8',
  operations: '#5d9ce8',
  other: '#9b8f86',
}

const EXPENSE_CATEGORY_GROUP_CUSTOM_COLORS = [
  '#7ab8ff',
  '#8bcf9b',
  '#f0aa63',
  '#d99ce6',
  '#e37d7d',
  '#87cfd2',
]

export function normalizeExpenseCategoryGroups(rawGroups: any[] = []) {
  return (rawGroups || [])
    .map((item): ExpenseCategoryGroupOption | null => {
      if (!item?.key || !item?.label) return null
      const key = String(item.key).trim()
      const label = String(item.label).trim()
      if (!key || !label) return null
      return {
        key,
        label,
        is_default: false,
      }
    })
    .filter((item): item is ExpenseCategoryGroupOption => !!item)
    .filter((item, index, list) => list.findIndex(group => group.key === item.key) === index)
}

export function buildExpenseCategoryGroups(rawCustomGroups: any[] = []) {
  const presetKeys = new Set(PRESET_EXPENSE_CATEGORY_GROUPS.map(item => item.key))
  const customGroups = normalizeExpenseCategoryGroups(rawCustomGroups)
    .filter(item => !presetKeys.has(item.key))

  return [
    ...PRESET_EXPENSE_CATEGORY_GROUPS,
    ...customGroups,
  ]
}

export function normalizeExpenseCategoryGroupKey(
  groupKey?: string | null,
  groups: ExpenseCategoryGroupOption[] = PRESET_EXPENSE_CATEGORY_GROUPS,
): ExpenseCategoryGroupKey {
  return groups.find(item => item.key === groupKey)?.key || 'other'
}

export function getExpenseCategoryGroupLabel(
  groupKey?: string | null,
  groups: ExpenseCategoryGroupOption[] = PRESET_EXPENSE_CATEGORY_GROUPS,
) {
  return groups.find(item => item.key === groupKey)?.label || '其他'
}

export function getExpenseCategoryGroupColor(groupKey?: string | null) {
  if (!groupKey) return EXPENSE_CATEGORY_GROUP_PRESET_COLORS.other
  if (EXPENSE_CATEGORY_GROUP_PRESET_COLORS[groupKey]) return EXPENSE_CATEGORY_GROUP_PRESET_COLORS[groupKey]

  let hash = 0
  for (const char of String(groupKey)) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0)
    hash |= 0
  }

  return EXPENSE_CATEGORY_GROUP_CUSTOM_COLORS[Math.abs(hash) % EXPENSE_CATEGORY_GROUP_CUSTOM_COLORS.length]
}

export function getExpenseCategoryGroupKey(
  categoryName?: string | null,
  categories: ExpenseCategoryOption[] = DEFAULT_EXPENSE_CATEGORIES,
) {
  const normalizedName = normalizeExpenseCategoryName(categoryName, categories)
  return categories.find(item => item.name === normalizedName)?.parent_group || 'other'
}

export function normalizeExpenseCategories(
  rawCategories: any[] = [],
  groups: ExpenseCategoryGroupOption[] = PRESET_EXPENSE_CATEGORY_GROUPS,
) {
  const merged = new Map<string, ExpenseCategoryOption>()

  for (const item of DEFAULT_EXPENSE_CATEGORIES) {
    merged.set(item.name, { ...item })
  }

  for (const item of rawCategories || []) {
    if (!item) continue
    const name = typeof item === 'string' ? item : item.name
    if (!name) continue
    const normalizedName = String(name).trim()
    if (!normalizedName) continue
    const parentGroup = typeof item === 'string'
      ? 'other'
      : normalizeExpenseCategoryGroupKey(item.parent_group || getExpenseCategoryGroupKey(normalizedName), groups)
    merged.set(normalizedName, {
      name: normalizedName,
      parent_group: parentGroup,
      is_default: !!merged.get(normalizedName)?.is_default,
    })
  }

  return Array.from(merged.values())
}

export function getExpenseCategoryGroupOptions(
  categories: ExpenseCategoryOption[],
  groups: ExpenseCategoryGroupOption[] = PRESET_EXPENSE_CATEGORY_GROUPS,
) {
  const seen = new Set<ExpenseCategoryGroupKey>()
  return categories
    .map(item => item.parent_group)
    .filter(Boolean)
    .filter((groupKey) => {
      if (seen.has(groupKey)) return false
      seen.add(groupKey)
      return true
    })
    .map(groupKey => ({
      key: groupKey,
      label: getExpenseCategoryGroupLabel(groupKey, groups),
      is_default: !!groups.find(item => item.key === groupKey)?.is_default,
    }))
}

export function groupExpenseCategories(
  categories: ExpenseCategoryOption[],
  groups: ExpenseCategoryGroupOption[] = PRESET_EXPENSE_CATEGORY_GROUPS,
  includeEmpty = false,
) {
  return groups
    .map(group => ({
      ...group,
      items: categories.filter(category => category.parent_group === group.key),
    }))
    .filter(group => includeEmpty || group.items.length > 0)
}

export function normalizeExpenseCategoryName(
  categoryName?: string | null,
  categories: ExpenseCategoryOption[] = DEFAULT_EXPENSE_CATEGORIES,
) {
  const normalized = String(categoryName || '').trim()
  if (!normalized) return '其他'
  if (categories.some(item => item.name === normalized)) return normalized
  return LEGACY_EXPENSE_CATEGORY_MAP[normalized as keyof typeof LEGACY_EXPENSE_CATEGORY_MAP] || normalized
}

export function getExpenseCategoryMeta(name?: string | null) {
  const normalized = normalizeExpenseCategoryName(name)
  return EXPENSE_CATEGORY_META[normalized] || { icon: 'category', bg: 'var(--amber-soft)' }
}

export function normalizeIncomeType(type?: string | null): IncomeFilterType | ManualIncomeType {
  const normalized = String(type || '').trim()
  if (!normalized) return '其他'
  if (normalized in LEGACY_INCOME_TYPE_MAP) {
    return LEGACY_INCOME_TYPE_MAP[normalized as LegacyIncomeType]
  }
  return (INCOME_FILTER_TYPES as readonly string[]).includes(normalized) ? normalized as IncomeFilterType : '其他'
}

export function isManualIncomeType(type?: string | null): type is ManualIncomeType {
  return (INCOME_TYPES as readonly string[]).includes(normalizeIncomeType(type))
}

export function getIncomeTypeMeta(type?: string | null) {
  const normalized = normalizeIncomeType(type)
  return INCOME_TYPE_META[normalized] || { icon: 'payments', bg: '#FFD9E2', desc: '手动记录收入' }
}
