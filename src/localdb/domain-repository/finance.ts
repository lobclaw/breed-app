import { localDb } from '@/localdb/db'
import type { LocalRowOf } from '@/localdb/types'
import type { Expense, ExpenseCategory, ExpenseCategoryGroup, Income, SaleRecord } from '@/types/finance'
import type { Family, FamilyMember } from '@/types/family'
import type { BreedingRecord, BreedingCycle, Litter } from '@/types/breeding'
import type { HealthRecord } from '@/types/health'
import { getBeijingDateParts, getBeijingDayStart, getBeijingMonthRange, getBeijingQuarterRange, getBeijingYearRange } from '@/utils/date'
import {
  buildExpenseCategoryGroups,
  getExpenseCategoryGroupKey,
  getExpenseCategoryGroupLabel,
  INCOME_FILTER_TYPES,
  normalizeExpenseCategoryName,
  normalizeExpenseCategories,
} from '@/constants/financeCategories'
import { getLocalLitterDetail } from './breeding'
import { getLocalFamilyRow } from './shared'

export { buildExpenseDisplayInfo } from '@/localdb/domain-services/financeDisplay'

const LEGACY_LOCAL_INCOME_TYPE_MAP: Record<string, string> = {
  定金: '定金保留',
  领养费: '领养',
  配种费收入: '其他',
}

type DogRow = LocalRowOf<'dogs'>
type ExpenseRow = LocalRowOf<'expenses'>
type IncomeRow = LocalRowOf<'incomes'>
type LitterRow = LocalRowOf<'litters'>

type LinkedDogSummary = Pick<DogRow, '_id' | 'name'>

type LocalFinanceDateRangeFilter = {
  value?: unknown
  kind?: unknown
  startDate?: unknown
  endDate?: unknown
}

type LocalFinanceFiltersInput = {
  category?: unknown
  customEndDate?: unknown
  customStartDate?: unknown
  cycleId?: unknown
  cycleIds?: unknown
  dateRange?: string | LocalFinanceDateRangeFilter
  dogId?: unknown
  dogIds?: unknown
  endDate?: unknown
  expenseCategories?: unknown
  expenseCategoryGroups?: unknown
  incomeTypes?: unknown
  litterId?: unknown
  litterIds?: unknown
  month?: unknown
  period?: unknown
  sort?: unknown
  startDate?: unknown
  subCategory?: unknown
  type?: unknown
  unlinkedOnly?: unknown
  year?: unknown
}

type LocalExpenseTransaction = Omit<ExpenseRow, 'category'> & {
  _txType: 'expense'
  category: string
  category_group_label?: string
}

type LocalIncomeTransaction = Omit<IncomeRow, 'type'> & {
  _txType: 'income'
  type: string
  type_label: string
}

type LocalTransaction = LocalExpenseTransaction | LocalIncomeTransaction

export async function getLocalDogFinanceSummary(familyId: string, dogId: string) {
  if (!familyId || !dogId) return null

  const [dog, expenses, incomes] = await Promise.all([
    localDb.findById<DogRow>('dogs', dogId),
    localDb.query<ExpenseRow>('expenses', row =>
      row.family_id === familyId
      && !row.deleted_at
      && Array.isArray(row.linked_dog_ids)
      && row.linked_dog_ids.includes(dogId),
    ),
    localDb.query<IncomeRow>('incomes', row =>
      row.family_id === familyId
      && !row.deleted_at
      && row.dog_id === dogId,
    ),
  ])

  if (!dog || dog.family_id !== familyId || dog.deleted_at) return null

  const purchaseCost = Number(dog.purchase_price || 0)
  const directExpenses = expenses.reduce((sum, expense) => {
    const linkedCount = Array.isArray(expense.linked_dog_ids) && expense.linked_dog_ids.length > 0
      ? expense.linked_dog_ids.length
      : 1
    return sum + (Number(expense.total_amount || 0) / linkedCount)
  }, 0)
  const salesIncome = incomes.reduce((sum, income) => sum + Number(income.amount || 0), 0)
  const recent = [
    ...expenses.map(expense => ({ ...expense, _txType: 'expense' as const })),
    ...incomes.map(income => ({
      ...income,
      _txType: 'income' as const,
      type: normalizeIncomeTypeLabel(income.type),
      type_label: normalizeIncomeTypeLabel(income.type),
    })),
  ]
    .sort((left, right) => Number(right.date || 0) - Number(left.date || 0))
    .slice(0, 10)

  return {
    purchaseCost,
    directExpenses,
    salesIncome,
    netProfit: salesIncome - purchaseCost - directExpenses,
    recent,
  }
}

function getCreatorDisplayName(members: FamilyMember[] = [], createdBy?: string | null) {
  if (!createdBy) return ''
  const member = members.find(item => item.user_id === createdBy && item.status === 'active')
  return member?.nickname || createdBy
}

function normalizeIncomeTypeLabel(type?: string | null) {
  const normalized = String(type || '').trim()
  if (!normalized) return '其他'
  const mapped = LEGACY_LOCAL_INCOME_TYPE_MAP[normalized] || normalized
  return (INCOME_FILTER_TYPES as readonly string[]).includes(mapped) ? mapped : '其他'
}

function buildExpenseLinkedRef(expense: ExpenseRow, linkedDogs: LinkedDogSummary[]) {
  if (expense.linked_litter_id) {
    return expense.dam_name
      ? `${expense.dam_name}${expense.litter_number ? ` · 第${expense.litter_number}窝` : ' · 关联窝'}`
      : '关联窝'
  }
  if (expense.linked_cycle_id) {
    return expense.dam_name ? `${expense.dam_name} · 繁育周期` : '繁育周期'
  }
  if (linkedDogs.length) {
    return linkedDogs.length === 1 ? '单犬记录' : `${linkedDogs.length}只犬分摊`
  }
  return ''
}

export async function getLocalExpenseDetail(familyId: string, expenseId: string) {
  if (!familyId || !expenseId) return null

  const [expense, family] = await Promise.all([
    localDb.findById<ExpenseRow>('expenses', expenseId),
    localDb.findById<Family>('families', familyId),
  ])

  if (!expense || expense.family_id !== familyId || expense.deleted_at) return null

  const groups = buildExpenseCategoryGroups(family?.settings?.custom_expense_category_groups || [])
  const categories = normalizeExpenseCategories(family?.settings?.custom_expense_categories || [], groups)
  const linkedDogs = (await Promise.all(
    (expense.linked_dog_ids || []).map((dogId: string) => localDb.findById<DogRow>('dogs', dogId)),
  ))
    .filter((dog): dog is DogRow => !!dog && dog.family_id === familyId && !dog.deleted_at)
    .map(dog => ({ _id: dog._id, name: dog.name }))

  return {
    ...expense,
    category: normalizeExpenseCategoryName(expense.category, categories),
    amount: expense.total_amount || 0,
    source: expense.source_type,
    category_group_label: getExpenseCategoryGroupLabel(
      getExpenseCategoryGroupKey(expense.category, categories),
      groups,
    ),
    created_by_name: getCreatorDisplayName(family?.members || [], expense.created_by),
    linked_dogs: linkedDogs,
    linked_ref: buildExpenseLinkedRef(expense, linkedDogs),
  }
}

export async function getLocalIncomeDetail(familyId: string, incomeId: string) {
  if (!familyId || !incomeId) return null

  const [income, family] = await Promise.all([
    localDb.findById<IncomeRow>('incomes', incomeId),
    localDb.findById<Family>('families', familyId),
  ])

  if (!income || income.family_id !== familyId || income.deleted_at) return null

  const typeLabel = normalizeIncomeTypeLabel(income.type)
  return {
    ...income,
    type: typeLabel,
    created_by_name: getCreatorDisplayName(family?.members || [], income.created_by),
    type_label: typeLabel,
    linked_dog_name: income.dog_name || '',
    sale_id: income.source_sale_id || '',
    source: income.source_sale_id || income.source_type === 'auto' ? 'auto' : 'manual',
  }
}

function resolveFinanceDateRange(period: string, month?: number, year?: number) {
  const nowParts = getBeijingDateParts()
  const targetYear = Number(year) || nowParts.year
  const targetMonth = Math.max(1, Math.min(12, Number(month) || nowParts.month))

  if (period === 'yearly') {
    return getBeijingYearRange(targetYear)
  }

  return getBeijingMonthRange(targetYear, targetMonth - 1)
}

export async function getLocalFinancialSummary(
  familyId: string,
  params: {
    period?: string
    month?: number
    year?: number
  } = {},
) {
  if (!familyId) {
    return {
      period: params.period || 'monthly',
      totalExpense: 0,
      totalIncome: 0,
      netProfit: 0,
      categoryBreakdown: {} as Record<string, number>,
      incomeBreakdown: {} as Record<string, number>,
      startDate: 0,
      endDate: 0,
    }
  }

  const period = params.period || 'monthly'
  const { startDate, endDate } = resolveFinanceDateRange(period, params.month, params.year)
  const [family, expenses, incomes] = await Promise.all([
    localDb.findById<Family>('families', familyId),
    localDb.query<Expense>('expenses', row => (
      row.family_id === familyId
      && !row.deleted_at
      && Number(row.date || 0) >= startDate
      && Number(row.date || 0) < endDate
    )),
    localDb.query<Income>('incomes', row => (
      row.family_id === familyId
      && !row.deleted_at
      && Number(row.date || 0) >= startDate
      && Number(row.date || 0) < endDate
    )),
  ])

  const groups = buildExpenseCategoryGroups(family?.settings?.custom_expense_category_groups || [])
  const categories = normalizeExpenseCategories(family?.settings?.custom_expense_categories || [], groups)
  const totalExpense = expenses.reduce((sum, row) => sum + Number(row.total_amount || 0), 0)
  const totalIncome = incomes.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const categoryBreakdown = expenses.reduce<Record<string, number>>((map, row) => {
    const label = getExpenseCategoryGroupLabel(
      getExpenseCategoryGroupKey(row.category, categories),
      groups,
    )
    map[label] = (map[label] || 0) + Number(row.total_amount || 0)
    return map
  }, {})
  const incomeBreakdown = incomes.reduce<Record<string, number>>((map, row) => {
    const label = normalizeIncomeTypeLabel(row.type)
    map[label] = (map[label] || 0) + Number(row.amount || 0)
    return map
  }, {})

  return {
    period,
    startDate,
    endDate,
    totalExpense,
    totalIncome,
    netProfit: totalIncome - totalExpense,
    categoryBreakdown,
    incomeBreakdown,
  }
}

function normalizeLocalFinanceFilters(filters: LocalFinanceFiltersInput = {}) {
  const normalizeStringArray = (rawValue: unknown) => {
    if (!rawValue) return []
    const values = Array.isArray(rawValue) ? rawValue : [rawValue]
    return Array.from(new Set(
      values
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean),
    ))
  }

  const type = String(filters.type || '')
  const normalized = {
    type,
    incomeTypes: normalizeStringArray(filters.incomeTypes).map(item => normalizeIncomeTypeLabel(item)),
    expenseCategoryGroups: normalizeStringArray(filters.expenseCategoryGroups),
    expenseCategories: normalizeStringArray(filters.expenseCategories || filters.subCategory || filters.category),
    dogIds: normalizeStringArray(filters.dogIds || filters.dogId),
    litterIds: normalizeStringArray(filters.litterIds || filters.litterId),
    cycleIds: normalizeStringArray(filters.cycleIds || filters.cycleId),
    unlinkedOnly: !!filters.unlinkedOnly,
    sort: String(filters.sort || 'date_desc'),
  }

  if (type === 'income') {
    normalized.expenseCategoryGroups = []
    normalized.expenseCategories = []
    normalized.litterIds = []
    normalized.cycleIds = []
  }

  if (type === 'expense') {
    normalized.incomeTypes = []
  }

  if (normalized.unlinkedOnly) {
    normalized.dogIds = []
    normalized.litterIds = []
    normalized.cycleIds = []
  }

  return normalized
}

function resolveLocalFinanceDateRange(filters: LocalFinanceFiltersInput = {}) {
  if (filters.startDate != null && filters.endDate != null) {
    return {
      startDate: Number(filters.startDate),
      endDate: Number(filters.endDate),
    }
  }

  const rangeValue = typeof filters.dateRange === 'string'
    ? filters.dateRange
    : (filters.dateRange?.value || filters.dateRange?.kind || '')

  if (rangeValue === 'custom') {
    const dateRange = typeof filters.dateRange === 'object' ? filters.dateRange : null
    const startDate = Number(dateRange?.startDate || filters.customStartDate || 0)
    const endDate = Number(dateRange?.endDate || filters.customEndDate || 0)
    if (startDate && endDate) {
      return { startDate: getBeijingDayStart(startDate), endDate: getBeijingDayStart(endDate) + 86400000 }
    }
  }

  const nowParts = getBeijingDateParts()
  const year = Number(filters.year || nowParts.year)
  const month = Number(filters.month || nowParts.month)

  if (rangeValue === 'last_month') {
    return getBeijingMonthRange(year, month - 2)
  }

  if (rangeValue === 'this_quarter') {
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3
    return getBeijingQuarterRange(year, quarterStartMonth)
  }

  if (rangeValue === 'this_year' || filters.period === 'yearly') {
    return getBeijingYearRange(year)
  }

  return getBeijingMonthRange(year, month - 1)
}

function hasIntersection(left: string[] = [], right: string[] = []) {
  if (!left.length || !right.length) return false
  const rightSet = new Set(right)
  return left.some(item => rightSet.has(item))
}

function isExpenseUnlinked(expense: Pick<ExpenseRow, 'linked_cycle_id' | 'linked_dog_ids' | 'linked_litter_id'>) {
  return (!expense.linked_dog_ids || expense.linked_dog_ids.length === 0)
    && !expense.linked_litter_id
    && !expense.linked_cycle_id
}

function isIncomeUnlinked(income: Pick<IncomeRow, 'dog_id'>) {
  return !income.dog_id
}

export async function getLocalTransactionList(familyId: string, filters: LocalFinanceFiltersInput = {}) {
  if (!familyId) return []

  const family = await getLocalFamilyRow(familyId)
  const groups = buildExpenseCategoryGroups(family?.settings?.custom_expense_category_groups || [])
  const categories = normalizeExpenseCategories(family?.settings?.custom_expense_categories || [], groups)
  const { startDate, endDate } = resolveLocalFinanceDateRange(filters)
  const normalizedFilters = normalizeLocalFinanceFilters(filters)
  const [expenses, incomes] = await Promise.all([
    (!normalizedFilters.type || normalizedFilters.type === 'expense')
      ? localDb.query<ExpenseRow>('expenses', row => (
        row.family_id === familyId
        && !row.deleted_at
        && Number(row.date || 0) >= startDate
        && Number(row.date || 0) < endDate
      ))
      : Promise.resolve([] as ExpenseRow[]),
    (!normalizedFilters.type || normalizedFilters.type === 'income')
      ? localDb.query<IncomeRow>('incomes', row => (
        row.family_id === familyId
        && !row.deleted_at
        && Number(row.date || 0) >= startDate
        && Number(row.date || 0) < endDate
      ))
      : Promise.resolve([] as IncomeRow[]),
  ])

  const expenseItems = expenses
    .filter((expense) => {
      const hasCategoryFilter = normalizedFilters.expenseCategoryGroups.length > 0 || normalizedFilters.expenseCategories.length > 0
      if (hasCategoryFilter) {
        const normalizedCategory = normalizeExpenseCategoryName(expense.category, categories)
        const groupKey = getExpenseCategoryGroupKey(expense.category, categories)
        if (
          !normalizedFilters.expenseCategoryGroups.includes(groupKey)
          && !normalizedFilters.expenseCategories.includes(normalizedCategory)
        ) {
          return false
        }
      }
      if (normalizedFilters.unlinkedOnly) return isExpenseUnlinked(expense)
      if (normalizedFilters.dogIds.length > 0 && !hasIntersection(expense.linked_dog_ids || [], normalizedFilters.dogIds)) return false
      if (normalizedFilters.litterIds.length > 0 && !normalizedFilters.litterIds.includes(expense.linked_litter_id || '')) return false
      if (normalizedFilters.cycleIds.length > 0 && !normalizedFilters.cycleIds.includes(expense.linked_cycle_id || '')) return false
      return true
    })
    .map(expense => ({
      ...expense,
      category: normalizeExpenseCategoryName(expense.category, categories),
      _txType: 'expense' as const,
      category_group_label: getExpenseCategoryGroupLabel(
        getExpenseCategoryGroupKey(expense.category, categories),
        groups,
      ),
    }))

  const incomeItems = incomes
    .filter((income) => {
      const normalizedType = normalizeIncomeTypeLabel(income.type)
      if (normalizedFilters.incomeTypes.length > 0 && !normalizedFilters.incomeTypes.includes(normalizedType)) return false
      if (normalizedFilters.unlinkedOnly) return isIncomeUnlinked(income)
      if (normalizedFilters.dogIds.length > 0 && !normalizedFilters.dogIds.includes(income.dog_id || '')) return false
      return true
    })
    .map(income => ({
      ...income,
      _txType: 'income' as const,
      type: normalizeIncomeTypeLabel(income.type),
      type_label: normalizeIncomeTypeLabel(income.type),
    }))

  const transactions: LocalTransaction[] = [...expenseItems, ...incomeItems]
  transactions.sort((left, right) => {
    const leftAmount = left._txType === 'expense' ? Number(left.total_amount || 0) : Math.abs(Number(left.amount || 0))
    const rightAmount = right._txType === 'expense' ? Number(right.total_amount || 0) : Math.abs(Number(right.amount || 0))
    if (normalizedFilters.sort === 'amount_desc') return rightAmount - leftAmount
    if (normalizedFilters.sort === 'amount_asc') return leftAmount - rightAmount
    return Number(right.date || 0) - Number(left.date || 0)
  })

  return transactions.slice(0, 100)
}

export async function getLocalProjectionParams(familyId: string) {
  if (!familyId) {
    return {
      activeDams: 0,
      littersPerYear: 1,
      avgIncomePerLitter: 0,
      avgCostPerLitter: 0,
      monthlySharedCost: 0,
    }
  }

  const now = Date.now()
  const last180Days = now - (180 * 86400000)
  const [dogs, litters, expenses] = await Promise.all([
    localDb.query<DogRow>('dogs', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<LitterRow>('litters', row => row.family_id === familyId),
    localDb.query<ExpenseRow>('expenses', row => (
      row.family_id === familyId
      && !row.deleted_at
      && Number(row.date || 0) >= last180Days
    )),
  ])

  const activeDams = dogs.filter(dog =>
    dog.role === '种狗'
    && dog.gender === '母'
    && !['已故', '已领养', '已赠送', '已退休'].includes(dog.disposition),
  ).length

  const littersByYear = litters.reduce<Record<string, number>>((map, litter) => {
    const year = getBeijingDateParts(litter.birth_date || litter.created_at || now).year
    map[String(year)] = (map[String(year)] || 0) + 1
    return map
  }, {})
  const yearlyCounts = Object.values(littersByYear)
  const littersPerYear = yearlyCounts.length
    ? Math.round((yearlyCounts.reduce((sum, count) => sum + count, 0) / yearlyCounts.length) * 10) / 10
    : Math.max(activeDams, 1)

  let avgIncomePerLitter = 0
  let avgCostPerLitter = 0
  if (litters.length > 0) {
    const litterDetails = await Promise.all(litters.map(litter => getLocalLitterDetail(familyId, litter._id)))
    const totals = litterDetails.reduce((sum, detail) => {
      sum.income += Number(detail?.litter?.income || 0)
      sum.cost += Number(detail?.litter?.expense || 0)
      return sum
    }, { income: 0, cost: 0 })
    avgIncomePerLitter = Math.round(totals.income / litters.length)
    avgCostPerLitter = Math.round(totals.cost / litters.length)
  }

  const sharedExpenses = expenses.filter((expense) => {
    const hasScopedLink = expense.linked_cycle_id || expense.linked_litter_id
    const hasDogLink = Array.isArray(expense.linked_dog_ids) && expense.linked_dog_ids.length > 0
    return !hasScopedLink && !hasDogLink
  })
  const monthlySharedCost = sharedExpenses.length
    ? Math.round(sharedExpenses.reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0) / 6)
    : 0

  return {
    activeDams,
    littersPerYear,
    avgIncomePerLitter,
    avgCostPerLitter,
    monthlySharedCost,
  }
}
