/**
 * 财务云对象
 * 管理费用/收入 CRUD、财务统计、销售流程
 */
const { verifyAndGetFamily, requireFamily } = require('breed-auth/auth')

const db = uniCloud.database()
const dbCmd = db.command

const EXPENSE_CATEGORY_GROUPS = [
  { key: 'feeding', label: '喂养营养' },
  { key: 'health', label: '医疗健康' },
  { key: 'breeding', label: '繁育投入' },
  { key: 'operations', label: '日常运营' },
  { key: 'other', label: '其他' },
]

const DEFAULT_EXPENSE_CATEGORY_ITEMS = [
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

const DEFAULT_EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORY_ITEMS.map(item => item.name)

function normalizeExpenseCategoryGroupKey(groupKey) {
  return EXPENSE_CATEGORY_GROUPS.some(item => item.key === groupKey) ? groupKey : 'other'
}

function getExpenseCategoryGroupLabel(groupKey) {
  return EXPENSE_CATEGORY_GROUPS.find(item => item.key === groupKey)?.label || '其他'
}

function normalizeCustomExpenseCategories(rawCategories = []) {
  return (rawCategories || [])
    .map((item) => {
      if (!item) return null
      if (typeof item === 'string') {
        return {
          name: item,
          parent_group: 'other',
        }
      }
      if (!item.name || !String(item.name).trim()) return null
      return {
        name: String(item.name).trim(),
        parent_group: normalizeExpenseCategoryGroupKey(item.parent_group),
      }
    })
    .filter(Boolean)
}

function buildExpenseCategoryOptions(customCategories = []) {
  return [
    ...DEFAULT_EXPENSE_CATEGORY_ITEMS,
    ...normalizeCustomExpenseCategories(customCategories).map(item => ({ ...item, is_default: false })),
  ]
}

function getExpenseCategoryMetaMap(customCategories = []) {
  return buildExpenseCategoryOptions(customCategories).reduce((map, item) => {
    map[item.name] = item
    return map
  }, {})
}

function getExpenseCategoryGroupKeyByName(categoryName, categoryMetaMap = {}) {
  return categoryMetaMap[categoryName]?.parent_group || 'other'
}

function normalizeStringArray(rawValue) {
  if (!rawValue) return []
  const values = Array.isArray(rawValue) ? rawValue : [rawValue]
  return Array.from(new Set(
    values
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean),
  ))
}

function normalizeFinanceFilters(filters = {}) {
  const type = filters.type || ''
  const normalized = {
    type,
    incomeTypes: normalizeStringArray(filters.incomeTypes),
    expenseCategoryGroups: normalizeStringArray(filters.expenseCategoryGroups).map(normalizeExpenseCategoryGroupKey),
    expenseCategories: normalizeStringArray(filters.expenseCategories || filters.subCategory || filters.category),
    dogIds: normalizeStringArray(filters.dogIds || filters.dogId),
    litterIds: normalizeStringArray(filters.litterIds || filters.litterId),
    cycleIds: normalizeStringArray(filters.cycleIds || filters.cycleId),
    unlinkedOnly: !!filters.unlinkedOnly,
    sort: filters.sort || 'date_desc',
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

function hasIntersection(left = [], right = []) {
  if (!left.length || !right.length) return false
  const rightSet = new Set(right)
  return left.some(item => rightSet.has(item))
}

function isExpenseUnlinked(expense = {}) {
  return (!expense.linked_dog_ids || expense.linked_dog_ids.length === 0)
    && !expense.linked_litter_id
    && !expense.linked_cycle_id
}

function isIncomeUnlinked(income = {}) {
  return !income.dog_id
}

function matchesExpenseCategoryFilter(expense, filters, categoryMetaMap = {}) {
  const hasCategoryFilter = filters.expenseCategoryGroups.length > 0 || filters.expenseCategories.length > 0
  if (!hasCategoryFilter) return true

  const groupKey = getExpenseCategoryGroupKeyByName(expense.category, categoryMetaMap)
  return filters.expenseCategoryGroups.includes(groupKey) || filters.expenseCategories.includes(expense.category)
}

function matchesExpenseLinkFilter(expense, filters) {
  if (filters.unlinkedOnly) return isExpenseUnlinked(expense)
  if (filters.dogIds.length > 0 && !hasIntersection(expense.linked_dog_ids || [], filters.dogIds)) return false
  if (filters.litterIds.length > 0 && !filters.litterIds.includes(expense.linked_litter_id || '')) return false
  if (filters.cycleIds.length > 0 && !filters.cycleIds.includes(expense.linked_cycle_id || '')) return false
  return true
}

function matchesIncomeLinkFilter(income, filters) {
  if (filters.unlinkedOnly) return isIncomeUnlinked(income)
  if (filters.dogIds.length > 0 && !filters.dogIds.includes(income.dog_id || '')) return false
  return true
}

function resolveDateRange(filters = {}) {
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
    const startDate = Number(filters.dateRange?.startDate || filters.customStartDate || 0)
    const endDate = Number(filters.dateRange?.endDate || filters.customEndDate || 0)
    if (startDate && endDate) {
      return { startDate, endDate: endDate + 86400000 }
    }
  }

  const now = new Date()
  const year = Number(filters.year || now.getFullYear())
  const month = Number(filters.month || (now.getMonth() + 1))
  const anchorDate = new Date(year, month - 1, 1)

  if (rangeValue === 'last_month') {
    return {
      startDate: new Date(year, month - 2, 1).getTime(),
      endDate: new Date(year, month - 1, 1).getTime(),
    }
  }

  if (rangeValue === 'this_quarter') {
    const quarterStartMonth = Math.floor(anchorDate.getMonth() / 3) * 3
    return {
      startDate: new Date(anchorDate.getFullYear(), quarterStartMonth, 1).getTime(),
      endDate: new Date(anchorDate.getFullYear(), quarterStartMonth + 3, 1).getTime(),
    }
  }

  if (rangeValue === 'this_year' || filters.period === 'yearly') {
    return {
      startDate: new Date(anchorDate.getFullYear(), 0, 1).getTime(),
      endDate: new Date(anchorDate.getFullYear() + 1, 0, 1).getTime(),
    }
  }

  return {
    startDate: new Date(year, month - 1, 1).getTime(),
    endDate: new Date(year, month, 1).getTime(),
  }
}

function getTransactionAmount(item) {
  return item._txType === 'expense' ? (item.total_amount || 0) : Math.abs(item.amount || 0)
}

function getIdArg(input, key) {
  if (!input) return ''
  if (typeof input === 'string') return input
  return input[key] || input.id || ''
}

function buildExpenseName(expense, fallback = '费用') {
  return expense.notes || expense.category || fallback
}

async function fetchDogsByIds(familyId, dogIds = []) {
  if (!dogIds.length) return []
  const { data } = await db.collection('dogs')
    .where({
      _id: dbCmd.in(dogIds),
      family_id: familyId,
      deleted_at: null,
    })
    .get()
  return data || []
}

async function calculateLitterProfit(familyId, litterId) {
  const { data: litters } = await db.collection('litters')
    .where({ _id: litterId, family_id: familyId })
    .get()
  if (!litters || litters.length === 0) throw new Error('窝不存在')

  const litter = litters[0]
  const { data: puppies } = await db.collection('dogs')
    .where({ origin_litter_id: litterId, family_id: familyId, deleted_at: null })
    .get()

  const puppyIds = puppies.map(item => item._id)
  const [incomeResult, saleResult, cycleExpenseResult, litterExpenseResult, allExpenseResult] = await Promise.all([
    puppyIds.length
      ? db.collection('incomes').where({ dog_id: dbCmd.in(puppyIds), family_id: familyId, deleted_at: null }).get()
      : { data: [] },
    puppyIds.length
      ? db.collection('sale_records').where({ dog_id: dbCmd.in(puppyIds), family_id: familyId, deleted_at: null }).get()
      : { data: [] },
    litter.cycle_id
      ? db.collection('expenses').where({ linked_cycle_id: litter.cycle_id, family_id: familyId, deleted_at: null }).get()
      : { data: [] },
    db.collection('expenses').where({ linked_litter_id: litterId, family_id: familyId, deleted_at: null }).get(),
    db.collection('expenses').where({ family_id: familyId, deleted_at: null }).limit(1000).get(),
  ])

  const incomes = incomeResult.data || []
  const sales = saleResult.data || []
  const cycleExpenses = cycleExpenseResult.data || []
  const litterExpenses = litterExpenseResult.data || []
  const allExpenses = allExpenseResult.data || []

  const incomeByDog = {}
  for (const income of incomes) {
    const dogId = income.dog_id
    incomeByDog[dogId] = (incomeByDog[dogId] || 0) + (income.amount || 0)
  }

  const saleByDog = {}
  for (const sale of sales) {
    const prev = saleByDog[sale.dog_id]
    if (!prev || (sale.updated_at || 0) > (prev.updated_at || 0)) {
      saleByDog[sale.dog_id] = sale
    }
  }

  const litterExpenseIds = new Set(litterExpenses.map(item => item._id))
  const exclusiveCycleExpenses = cycleExpenses.filter(expense => !litterExpenseIds.has(expense._id))

  const breedingCosts = exclusiveCycleExpenses.map(expense => ({
    id: expense._id,
    name: buildExpenseName(expense, '繁育费用'),
    amount: expense.total_amount || 0,
  }))

  const litterCosts = litterExpenses.map(expense => ({
    id: expense._id,
    name: buildExpenseName(expense, '窝费用'),
    amount: expense.total_amount || 0,
  }))

  const countedExpenseIds = new Set([
    ...exclusiveCycleExpenses.map(item => item._id),
    ...litterExpenses.map(item => item._id),
  ])

  const puppyCosts = []
  for (const expense of allExpenses) {
    if (countedExpenseIds.has(expense._id)) continue
    if (!Array.isArray(expense.linked_dog_ids) || expense.linked_dog_ids.length === 0) continue

    const matchedCount = expense.linked_dog_ids.filter(id => puppyIds.includes(id)).length
    if (!matchedCount) continue

    const shareAmount = (expense.total_amount || 0) * matchedCount / expense.linked_dog_ids.length
    puppyCosts.push({
      id: expense._id,
      name: buildExpenseName(expense, '幼崽费用'),
      amount: Math.round(shareAmount * 100) / 100,
    })
  }

  const totalIncome = incomes.reduce((sum, item) => sum + (item.amount || 0), 0)
  const totalExpense = [...breedingCosts, ...litterCosts, ...puppyCosts]
    .reduce((sum, item) => sum + (item.amount || 0), 0)

  const alivePuppies = puppies.filter(item => item.disposition !== '已故')
  const avgCostPerPuppy = alivePuppies.length > 0 ? totalExpense / alivePuppies.length : 0

  const incomeItems = puppies.map((puppy, index) => {
    const actualIncome = incomeByDog[puppy._id] || 0
    const sale = saleByDog[puppy._id]

    if (actualIncome !== 0) {
      return {
        id: puppy._id,
        name: puppy.name || `幼崽${index + 1}`,
        gender: puppy.gender || '',
        disposition: puppy.disposition || '',
        status: 'sold',
        amount: actualIncome,
        estimated_amount: 0,
      }
    }

    if (sale && sale.status === '已预定') {
      return {
        id: puppy._id,
        name: puppy.name || `幼崽${index + 1}`,
        gender: puppy.gender || '',
        disposition: puppy.disposition || '',
        status: 'reserved',
        amount: 0,
        estimated_amount: sale.agreed_price || sale.floor_price || 0,
      }
    }

    if ((sale && sale.status === '待售') || puppy.disposition === '已预定') {
      return {
        id: puppy._id,
        name: puppy.name || `幼崽${index + 1}`,
        gender: puppy.gender || '',
        disposition: puppy.disposition || '',
        status: puppy.disposition === '已预定' ? 'reserved' : 'pending',
        amount: 0,
        estimated_amount: sale?.agreed_price || sale?.floor_price || 0,
      }
    }

    return {
      id: puppy._id,
      name: puppy.name || `幼崽${index + 1}`,
      gender: puppy.gender || '',
      disposition: puppy.disposition || '',
      status: 'pending',
      amount: 0,
      estimated_amount: 0,
    }
  })

  return {
    litter,
    puppies,
    totalIncome,
    totalExpense,
    totalCost: totalExpense,
    netProfit: totalIncome - totalExpense,
    puppyCount: alivePuppies.length,
    totalPuppyCount: puppies.length,
    aliveCount: alivePuppies.length,
    costPerPuppy: Math.round(avgCostPerPuppy),
    avgCostPerPuppy: Math.round(avgCostPerPuppy),
    incomeItems,
    breedingCosts,
    litterCosts,
    puppyCosts,
  }
}

module.exports = {
  _before: async function() {
    const { uid, familyId, role } = await verifyAndGetFamily(this.getUniIdToken(), this.getClientInfo())
    this.uid = uid
    this.familyId = familyId
    this.role = role
    requireFamily(familyId)
  },

  _after: function(error, result) {
    if (error) {
      return { errCode: error.code || -1, errMsg: error.message }
    }
    return result
  },

  // ── 费用 CRUD ──

  /**
   * 手动录入支出
   */
  async addExpense(data) {
    if (!data.total_amount || data.total_amount <= 0) throw new Error('请填写金额')
    if (!data.category) throw new Error('请选择分类')

    const now = Date.now()

    const expenseData = {
      family_id: this.familyId,
      total_amount: data.total_amount,
      category: data.category,
      date: data.date || now,
      linked_cycle_id: data.linked_cycle_id || null,
      linked_litter_id: data.linked_litter_id || null,
      linked_dog_ids: data.linked_dog_ids || [],
      source_type: 'manual',
      source_record_id: null,
      images: data.images || [],
      dam_name: data.dam_name || null,
      dog_names: data.dog_names || [],
      litter_number: data.litter_number || null,
      notes: data.notes || null,
      created_by: this.uid,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    }

    const { id } = await db.collection('expenses').add(expenseData)
    return { data: { expenseId: id } }
  },

  /**
   * 手动录入收入
   */
  async addIncome(data) {
    if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0 || isNaN(data.amount)) throw new Error('请填写有效金额')
    if (!data.type) throw new Error('请选择收入类型')

    const now = Date.now()

    const incomeData = {
      family_id: this.familyId,
      dog_id: data.dog_id || null,
      dog_name: data.dog_name || null,
      type: data.type,
      amount: data.amount,
      date: data.date || now,
      source_sale_id: data.source_sale_id || null,
      notes: data.notes || null,
      created_by: this.uid,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    }

    const { id } = await db.collection('incomes').add(incomeData)
    return { data: { incomeId: id } }
  },

  /**
   * 单犬财务汇总（购入成本 + 个体支出 + 销售收入 + 净收益 + 近期流水）
   */
  async getDogFinanceSummary(dogId) {
    if (!dogId) throw new Error('缺少犬只 ID')
    const familyId = this.familyId

    const [dogRes, expenseRes, incomeRes] = await Promise.all([
      db.collection('dogs').where({ _id: dogId, family_id: familyId, deleted_at: null }).get(),
      db.collection('expenses').where({ linked_dog_ids: dogId, family_id: familyId, deleted_at: null }).orderBy('date', 'desc').limit(50).get(),
      db.collection('incomes').where({ dog_id: dogId, family_id: familyId, deleted_at: null }).orderBy('date', 'desc').limit(50).get(),
    ])

    const dog = dogRes.data?.[0] || {}
    const expenses = expenseRes.data || []
    const incomes = incomeRes.data || []

    const purchaseCost = dog.purchase_price || 0
    const directExpenses = expenses.reduce((sum, e) => {
      // 分摊：如果该费用关联多只犬，按比例算
      const share = e.linked_dog_ids?.length > 1 ? 1 / e.linked_dog_ids.length : 1
      return sum + (e.total_amount || 0) * share
    }, 0)
    const salesIncome = incomes.reduce((sum, i) => sum + (i.amount || 0), 0)
    const netProfit = salesIncome - purchaseCost - directExpenses

    // 最近流水（合并，按日期排序，取10条）
    const recent = [
      ...expenses.map(e => ({ ...e, _txType: 'expense' })),
      ...incomes.map(i => ({ ...i, _txType: 'income' })),
    ].sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 10)

    return { data: { purchaseCost, directExpenses, salesIncome, netProfit, recent } }
  },

  /**
   * 收支流水列表（合并展示）
   */
  async getTransactionList(filters = {}) {
    const familyId = this.familyId
    const { data: familyData } = await db.collection('families')
      .doc(familyId)
      .field({ settings: true })
      .get()
    const family = familyData[0] || familyData || {}
    const customCategories = family.settings?.custom_expense_categories || []
    const categoryMetaMap = getExpenseCategoryMetaMap(customCategories)

    const { startDate, endDate } = resolveDateRange(filters)
    const dateFilter = dbCmd.gte(startDate).and(dbCmd.lt(endDate))
    const normalizedFilters = normalizeFinanceFilters(filters)
    const baseWhere = { family_id: familyId, deleted_at: null, date: dateFilter }

    // 按类型决定查哪些集合
    const fetchExpenses = !normalizedFilters.type || normalizedFilters.type === 'expense'
    const fetchIncomes = !normalizedFilters.type || normalizedFilters.type === 'income'

    const [expenseResult, incomeResult] = await Promise.all([
      fetchExpenses
        ? db.collection('expenses').where(baseWhere).orderBy('date', 'desc').limit(1000).get()
        : { data: [] },
      fetchIncomes
        ? db.collection('incomes').where(baseWhere).orderBy('date', 'desc').limit(1000).get()
        : { data: [] },
    ])

    const transactions = [
      ...expenseResult.data
        .filter(expense => matchesExpenseCategoryFilter(expense, normalizedFilters, categoryMetaMap))
        .filter(expense => matchesExpenseLinkFilter(expense, normalizedFilters))
        .map((expense) => ({
        ...expense,
        _txType: 'expense',
        category_group_label: getExpenseCategoryGroupLabel(
          getExpenseCategoryGroupKeyByName(expense.category, categoryMetaMap),
        ),
      })),
      ...incomeResult.data
        .filter((income) => {
          if (normalizedFilters.incomeTypes.length > 0 && !normalizedFilters.incomeTypes.includes(income.type || '其他')) {
            return false
          }
          return matchesIncomeLinkFilter(income, normalizedFilters)
        })
        .map(i => ({ ...i, _txType: 'income' })),
    ]

    const sort = normalizedFilters.sort
    transactions.sort((a, b) => {
      if (sort === 'amount_desc') return getTransactionAmount(b) - getTransactionAmount(a)
      if (sort === 'amount_asc') return getTransactionAmount(a) - getTransactionAmount(b)
      return (b.date || 0) - (a.date || 0)
    })

    return { data: transactions.slice(0, 100) }
  },

  /**
   * 获取支出详情
   */
  async getExpenseDetail(id) {
    const expenseId = getIdArg(id, 'id')
    if (!expenseId) throw new Error('缺少记录 ID')

    const [expenseResult, familyResult] = await Promise.all([
      db.collection('expenses')
        .where({ _id: expenseId, family_id: this.familyId, deleted_at: null })
        .get(),
      db.collection('families')
        .doc(this.familyId)
        .field({ settings: true })
        .get(),
    ])
    const expenses = expenseResult.data
    if (!expenses || expenses.length === 0) throw new Error('记录不存在')

    const expense = expenses[0]
    const family = familyResult.data?.[0] || familyResult.data || {}
    const categoryMetaMap = getExpenseCategoryMetaMap(family.settings?.custom_expense_categories || [])
    const linkedDogs = await fetchDogsByIds(this.familyId, expense.linked_dog_ids || [])

    let linkedRef = ''
    if (expense.linked_litter_id) {
      linkedRef = expense.dam_name
        ? `${expense.dam_name}${expense.litter_number ? ` · 第${expense.litter_number}窝` : ' · 关联窝'}`
        : '关联窝'
    } else if (expense.linked_cycle_id) {
      linkedRef = expense.dam_name ? `${expense.dam_name} · 繁育周期` : '繁育周期'
    } else if (linkedDogs.length) {
      linkedRef = linkedDogs.length === 1 ? '单犬记录' : `${linkedDogs.length}只犬分摊`
    }

    return {
      data: {
        ...expense,
        amount: expense.total_amount || 0,
        source: expense.source_type,
        category_group_label: getExpenseCategoryGroupLabel(
          getExpenseCategoryGroupKeyByName(expense.category, categoryMetaMap),
        ),
        linked_dogs: linkedDogs,
        linked_ref: linkedRef,
      },
    }
  },

  /**
   * 获取收入详情
   */
  async getIncomeDetail(id) {
    const incomeId = getIdArg(id, 'id')
    if (!incomeId) throw new Error('缺少记录 ID')

    const { data: incomes } = await db.collection('incomes')
      .where({ _id: incomeId, family_id: this.familyId, deleted_at: null })
      .get()
    if (!incomes || incomes.length === 0) throw new Error('记录不存在')

    const income = incomes[0]

    return {
      data: {
        ...income,
        type_label: income.type || '其他',
        linked_dog_name: income.dog_name || '',
        sale_id: income.source_sale_id || '',
        source: income.source_sale_id ? 'auto' : 'manual',
      },
    }
  },

  /**
   * 软删除支出
   */
  async softDeleteExpense(id) {
    const expenseId = getIdArg(id, 'id')
    if (!expenseId) throw new Error('缺少记录 ID')

    const { data: expenses } = await db.collection('expenses')
      .where({ _id: expenseId, family_id: this.familyId })
      .get()
    if (!expenses || expenses.length === 0) throw new Error('记录不存在')
    if (expenses[0].source_type === 'auto') throw new Error('自动生成的费用不可删除，请在来源记录中操作')

    await db.collection('expenses').doc(expenseId).update({
      deleted_at: Date.now(),
      updated_at: Date.now(),
    })

    return { message: '已删除' }
  },

  /**
   * 软删除收入
   */
  async softDeleteIncome(id) {
    const incomeId = getIdArg(id, 'id')
    if (!incomeId) throw new Error('缺少记录 ID')

    const { data: incomes } = await db.collection('incomes')
      .where({ _id: incomeId, family_id: this.familyId })
      .get()
    if (!incomes || incomes.length === 0) throw new Error('记录不存在')
    if (incomes[0].source_sale_id) throw new Error('自动生成的收入不可删除，请在销售记录中操作')

    await db.collection('incomes').doc(incomeId).update({
      deleted_at: Date.now(),
      updated_at: Date.now(),
    })

    return { message: '已删除' }
  },

  // ── 财务统计 ──

  /**
   * 月度/年度统计
   */
  async getFinancialSummary(params = {}) {
    const familyId = this.familyId
    // 兼容旧调用（直接传字符串）和新调用（传对象）
    const period = typeof params === 'string' ? params : (params.period || 'monthly')
    const { data: familyData } = await db.collection('families')
      .doc(familyId)
      .field({ settings: true })
      .get()
    const family = familyData[0] || familyData || {}
    const customCategories = family.settings?.custom_expense_categories || []
    const categoryMetaMap = getExpenseCategoryMetaMap(customCategories)

    const { startDate, endDate } = resolveDateRange({
      ...(typeof params === 'object' ? params : {}),
      period,
    })

    const dateFilter = { $gte: startDate, $lt: endDate }
    const normalizedFilters = normalizeFinanceFilters(typeof params === 'object' ? params : {})
    const baseWhere = { family_id: familyId, deleted_at: null, date: dateFilter }
    const fetchExpenses = !normalizedFilters.type || normalizedFilters.type === 'expense'
    const fetchIncomes = !normalizedFilters.type || normalizedFilters.type === 'income'

    const [expenseResult, incomeResult] = await Promise.all([
      fetchExpenses
        ? db.collection('expenses')
          .where(baseWhere)
          .limit(1000)
          .get()
        : { data: [] },
      fetchIncomes
        ? db.collection('incomes')
          .where(baseWhere)
          .limit(1000)
          .get()
        : { data: [] },
    ])
    const filteredExpenses = expenseResult.data
      .filter(expense => matchesExpenseCategoryFilter(expense, normalizedFilters, categoryMetaMap))
      .filter(expense => matchesExpenseLinkFilter(expense, normalizedFilters))
    const filteredIncomes = incomeResult.data
      .filter((income) => {
        if (normalizedFilters.incomeTypes.length > 0 && !normalizedFilters.incomeTypes.includes(income.type || '其他')) {
          return false
        }
        return matchesIncomeLinkFilter(income, normalizedFilters)
      })

    const totalExpense = filteredExpenses.reduce((sum, e) => sum + (e.total_amount || 0), 0)
    const totalIncome = filteredIncomes.reduce((sum, i) => sum + (i.amount || 0), 0)

    // 按顶层分组汇总支出
    const categoryBreakdown = {}
    for (const e of filteredExpenses) {
      const groupLabel = getExpenseCategoryGroupLabel(
        getExpenseCategoryGroupKeyByName(e.category, categoryMetaMap),
      )
      categoryBreakdown[groupLabel] = (categoryBreakdown[groupLabel] || 0) + (e.total_amount || 0)
    }

    // 按类型汇总收入
    const incomeBreakdown = {}
    for (const i of filteredIncomes) {
      const type = i.type || '其他'
      incomeBreakdown[type] = (incomeBreakdown[type] || 0) + (i.amount || 0)
    }

    return {
      data: {
        period: period || 'monthly',
        startDate,
        endDate,
        totalExpense,
        totalIncome,
        netProfit: totalIncome - totalExpense,
        categoryBreakdown,
        incomeBreakdown,
        expenseCount: filteredExpenses.length,
        incomeCount: filteredIncomes.length,
      }
    }
  },

  /**
   * 单窝利润
   */
  async getLitterProfit(litterId) {
    const targetLitterId = getIdArg(litterId, 'litter_id') || getIdArg(litterId, 'litterId')
    if (!targetLitterId) throw new Error('缺少窝 ID')

    const result = await calculateLitterProfit(this.familyId, targetLitterId)

    return {
      data: {
        litterId: targetLitterId,
        damName: result.litter.dam_name,
        ...result,
      },
    }
  },

  /**
   * 种母 ROI
   */
  async getDamROI(damId) {
    const targetDamId = getIdArg(damId, 'dog_id') || getIdArg(damId, 'damId')
    if (!targetDamId) throw new Error('缺少犬只 ID')

    const familyId = this.familyId

    // 获取犬只信息
    const { data: dogs } = await db.collection('dogs')
      .where({ _id: targetDamId, family_id: familyId })
      .get()
    if (!dogs || dogs.length === 0) throw new Error('犬只不存在')
    const dam = dogs[0]

    // 获取该犬所有繁育周期
    const { data: cycles } = await db.collection('breeding_cycles')
      .where({ dam_id: targetDamId, family_id: familyId })
      .get()
    const cycleIds = cycles.map(c => c._id)

    // 获取所有窝
    const { data: litters } = await db.collection('litters')
      .where({ dam_id: targetDamId, family_id: familyId })
      .get()
    const litterIds = litters.map(item => item._id)

    const [allExpenseResult, puppiesResult] = await Promise.all([
      db.collection('expenses').where({ family_id: familyId, deleted_at: null }).limit(1000).get(),
      litterIds.length
        ? db.collection('dogs').where({ origin_litter_id: dbCmd.in(litterIds), family_id: familyId, deleted_at: null }).get()
        : { data: [] },
    ])

    const allExpenses = allExpenseResult.data || []
    const allPuppies = puppiesResult.data || []

    const litterSummaries = []
    let totalBreedingIncome = 0
    let totalBreedingCost = 0

    for (let index = 0; index < litters.length; index += 1) {
      const litter = litters[index]
      const summary = await calculateLitterProfit(familyId, litter._id)
      totalBreedingIncome += summary.totalIncome
      totalBreedingCost += summary.totalExpense

      const hasPending = summary.incomeItems.some(item => item.status === 'pending')
      let status = 'income'
      if (hasPending) status = 'in_progress'
      else if (summary.netProfit < 0) status = 'failed'

      litterSummaries.push({
        id: litter._id,
        index: index + 1,
        title: `${dam.name}第${index + 1}窝`,
        meta: `${summary.aliveCount}/${summary.totalPuppyCount}只存活`,
        puppyCount: summary.aliveCount,
        profit: summary.netProfit,
        status,
      })
    }

    const countedIds = new Set()
    for (const expense of allExpenses) {
      if (
        (expense.linked_cycle_id && cycleIds.includes(expense.linked_cycle_id))
        || (expense.linked_litter_id && litterIds.includes(expense.linked_litter_id))
      ) {
        countedIds.add(expense._id)
      }
    }

    let healthCost = 0
    for (const expense of allExpenses) {
      if (countedIds.has(expense._id)) continue
      if (expense.category === '购入') continue
      if (Array.isArray(expense.linked_dog_ids) && expense.linked_dog_ids.includes(targetDamId)) {
        healthCost += (expense.total_amount || 0) / expense.linked_dog_ids.length
      }
    }

    const purchaseCost = dam.purchase_price || 0
    const totalInvestment = purchaseCost + totalBreedingCost + healthCost
    const netProfit = totalBreedingIncome - totalInvestment
    const roiPercent = totalInvestment > 0
      ? Math.round((netProfit / totalInvestment) * 1000) / 10
      : 0

    return {
      data: {
        damId: targetDamId,
        damName: dam.name,
        purchasePrice: purchaseCost,
        purchaseCost,
        totalIncome: totalBreedingIncome,
        totalBreedingIncome,
        totalBreedingCost,
        healthCost,
        totalExpense: totalInvestment,
        netReturn: netProfit,
        netProfit,
        roiPercent,
        cycleCount: cycles.length,
        litterCount: litters.length,
        puppyCount: allPuppies.length,
        litters: litterSummaries,
      },
    }
  },

  async getDamRoi(damId) {
    const targetDamId = getIdArg(damId, 'dog_id') || getIdArg(damId, 'damId')
    if (!targetDamId) throw new Error('缺少犬只 ID')

    return module.exports.getDamROI.call(this, targetDamId)
  },

  async deleteExpense(id) {
    return this.softDeleteExpense(id)
  },

  async deleteIncome(id) {
    return this.softDeleteIncome(id)
  },

  async updateExpense(payload = {}, maybeData) {
    const data = typeof payload === 'string'
      ? { ...(maybeData || {}), id: payload }
      : payload
    const expenseId = getIdArg(data, 'id')
    if (!expenseId) throw new Error('缺少记录 ID')
    if (!data.total_amount || data.total_amount <= 0) throw new Error('请填写金额')
    if (!data.category) throw new Error('请选择分类')

    const { data: expenses } = await db.collection('expenses')
      .where({ _id: expenseId, family_id: this.familyId, deleted_at: null })
      .get()
    if (!expenses || expenses.length === 0) throw new Error('记录不存在')
    if (expenses[0].source_type === 'auto') throw new Error('自动生成的费用不可编辑，请在来源记录中操作')

    await db.collection('expenses').doc(expenseId).update({
      total_amount: data.total_amount,
      category: data.category,
      date: data.date || expenses[0].date,
      linked_cycle_id: data.linked_cycle_id || null,
      linked_litter_id: data.linked_litter_id || null,
      linked_dog_ids: data.linked_dog_ids || [],
      dam_name: data.dam_name || null,
      dog_names: data.dog_names || [],
      litter_number: data.litter_number || null,
      notes: data.notes || null,
      images: data.images || [],
      updated_at: Date.now(),
    })

    return { message: '已更新' }
  },

  async updateIncome(payload = {}, maybeData) {
    const data = typeof payload === 'string'
      ? { ...(maybeData || {}), id: payload }
      : payload
    const incomeId = getIdArg(data, 'id')
    if (!incomeId) throw new Error('缺少记录 ID')
    if (!data.amount || data.amount <= 0) throw new Error('请填写有效金额')
    if (!data.type) throw new Error('请选择收入类型')

    const { data: incomes } = await db.collection('incomes')
      .where({ _id: incomeId, family_id: this.familyId, deleted_at: null })
      .get()
    if (!incomes || incomes.length === 0) throw new Error('记录不存在')
    if (incomes[0].source_sale_id) throw new Error('自动生成的收入不可编辑，请在销售记录中操作')

    await db.collection('incomes').doc(incomeId).update({
      amount: data.amount,
      type: data.type,
      dog_id: data.dog_id || null,
      dog_name: data.dog_name || null,
      date: data.date || incomes[0].date,
      notes: data.notes || null,
      updated_at: Date.now(),
    })

    return { message: '已更新' }
  },

  async getProjectionParams() {
    const familyId = this.familyId
    const now = Date.now()
    const last180Days = now - 180 * 86400000

    const [damResult, litterResult, expenseResult] = await Promise.all([
      db.collection('dogs').where({
        family_id: familyId,
        role: '种狗',
        gender: '母',
        deleted_at: null,
      }).get(),
      db.collection('litters').where({ family_id: familyId }).get(),
      db.collection('expenses').where({
        family_id: familyId,
        deleted_at: null,
        date: dbCmd.gte(last180Days),
      }).limit(1000).get(),
    ])

    const activeDams = (damResult.data || []).filter(dog => !['已故', '已领养', '已赠送', '已退休'].includes(dog.disposition)).length
    const litters = litterResult.data || []
    const littersByYear = {}
    for (const litter of litters) {
      const year = new Date(litter.birth_date || litter.created_at || now).getFullYear()
      littersByYear[year] = (littersByYear[year] || 0) + 1
    }
    const yearlyCounts = Object.values(littersByYear)
    const littersPerYear = yearlyCounts.length
      ? Math.round((yearlyCounts.reduce((sum, count) => sum + count, 0) / yearlyCounts.length) * 10) / 10
      : Math.max(activeDams, 1)

    let avgIncomePerLitter = 0
    let avgCostPerLitter = 0
    if (litters.length > 0) {
      let totalIncome = 0
      let totalCost = 0
      for (const litter of litters) {
        const summary = await calculateLitterProfit(familyId, litter._id)
        totalIncome += summary.totalIncome
        totalCost += summary.totalExpense
      }
      avgIncomePerLitter = Math.round(totalIncome / litters.length)
      avgCostPerLitter = Math.round(totalCost / litters.length)
    }

    const sharedExpenses = (expenseResult.data || []).filter(expense => {
      const hasScopedLink = expense.linked_cycle_id || expense.linked_litter_id
      const hasDogLink = Array.isArray(expense.linked_dog_ids) && expense.linked_dog_ids.length > 0
      return !hasScopedLink && !hasDogLink
    })
    const monthlySharedCost = sharedExpenses.length
      ? Math.round(sharedExpenses.reduce((sum, expense) => sum + (expense.total_amount || 0), 0) / 6)
      : 0

    return {
      data: {
        activeDams,
        littersPerYear,
        avgIncomePerLitter,
        avgCostPerLitter,
        monthlySharedCost,
      },
    }
  },

  // ── 销售流程 ──

  /**
   * 创建销售记录（待售/意向阶段）
   */
  async createSaleRecord(data) {
    if (!data.dog_id) throw new Error('请选择犬只')

    const now = Date.now()
    const familyId = this.familyId

    // 校验犬只
    const { data: dogs } = await db.collection('dogs')
      .where({ _id: data.dog_id, family_id: familyId, deleted_at: null })
      .get()
    if (!dogs || dogs.length === 0) throw new Error('犬只不存在')
    const dog = dogs[0]

    const saleData = {
      dog_id: data.dog_id,
      dog_name: dog.name,
      family_id: familyId,
      status: '待售',
      floor_price: data.floor_price || null,
      deposit_amount: null,
      deposit_date: null,
      agreed_price: null,
      received_amount: null,
      seller_agent_id: null,
      platform: null,
      date: null,
      delivery_date: null,
      buyer_info: data.buyer_info || null,
      refund_amount: null,
      refund_reason: null,
      refund_date: null,
      deposit_kept_amount: null,
      notes: data.notes || null,
      created_by: this.uid,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    }

    const { id } = await db.collection('sale_records').add(saleData)

    // 更新犬只去向为待售
    await db.collection('dogs').doc(data.dog_id).update({
      disposition: '待售',
      updated_at: now,
    })

    return { data: { saleId: id } }
  },

  /**
   * 收定金 → 已预定
   */
  async receiveSaleDeposit(saleId, data) {
    if (!saleId) throw new Error('缺少销售记录 ID')
    if (!data.deposit_amount || data.deposit_amount <= 0) throw new Error('请填写定金金额')

    const now = Date.now()
    const familyId = this.familyId

    const { data: sales } = await db.collection('sale_records')
      .where({ _id: saleId, family_id: familyId })
      .get()
    if (!sales || sales.length === 0) throw new Error('记录不存在')
    const sale = sales[0]
    if (sale.status !== '待售') throw new Error('只有待售状态可以收定金')

    await db.collection('sale_records').doc(saleId).update({
      status: '已预定',
      deposit_amount: data.deposit_amount,
      deposit_date: data.deposit_date || now,
      agreed_price: data.agreed_price || null,
      buyer_info: data.buyer_info || sale.buyer_info,
      seller_agent_id: data.seller_agent_id || null,
      platform: data.platform || null,
      updated_at: now,
    })

    // 更新犬只去向
    await db.collection('dogs').doc(sale.dog_id).update({
      disposition: '已预定',
      updated_at: now,
    })

    return { message: '已收定金' }
  },

  /**
   * 完成交易 → 已成交
   */
  async completeSale(saleId, data) {
    if (!saleId) throw new Error('缺少销售记录 ID')
    if (!data.received_amount) throw new Error('请填写到手价')

    const now = Date.now()
    const familyId = this.familyId

    const { data: sales } = await db.collection('sale_records')
      .where({ _id: saleId, family_id: familyId })
      .get()
    if (!sales || sales.length === 0) throw new Error('记录不存在')
    const sale = sales[0]
    if (!['待售', '已预定'].includes(sale.status)) throw new Error('当前状态不可完成交易')

    await db.collection('sale_records').doc(saleId).update({
      status: '已成交',
      received_amount: data.received_amount,
      date: data.date || now,
      delivery_date: data.delivery_date || null,
      seller_agent_id: data.seller_agent_id || sale.seller_agent_id,
      platform: data.platform || sale.platform,
      buyer_info: data.buyer_info || sale.buyer_info,
      updated_at: now,
    })

    // 自动生成收入记录
    await db.collection('incomes').add({
      dog_id: sale.dog_id,
      dog_name: sale.dog_name,
      type: '销售',
      amount: data.received_amount,
      date: data.date || now,
      source_sale_id: saleId,
      notes: null,
      family_id: familyId,
      created_by: this.uid,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    })

    // 更新犬只去向
    await db.collection('dogs').doc(sale.dog_id).update({
      disposition: '已售',
      disposition_date: data.date || now,
      updated_at: now,
    })

    return { message: '交易完成' }
  },

  /**
   * 取消销售
   * 支持：退款（已成交）、定金取消（已预定）
   */
  async cancelSale(saleId, data) {
    if (!saleId) throw new Error('缺少销售记录 ID')

    const now = Date.now()
    const familyId = this.familyId

    const { data: sales } = await db.collection('sale_records')
      .where({ _id: saleId, family_id: familyId })
      .get()
    if (!sales || sales.length === 0) throw new Error('记录不存在')
    const sale = sales[0]

    if (sale.status === '已成交') {
      // 退款处理
      const refundAmount = data.refund_amount || sale.received_amount
      const isFullRefund = refundAmount >= sale.received_amount

      await db.collection('sale_records').doc(saleId).update({
        status: '已退款',
        refund_amount: refundAmount,
        refund_reason: data.refund_reason || null,
        refund_date: now,
        updated_at: now,
      })

      // 创建退款收入（负数）
      await db.collection('incomes').add({
        dog_id: sale.dog_id,
        dog_name: sale.dog_name,
        type: '退款',
        amount: -refundAmount,
        date: now,
        source_sale_id: saleId,
        notes: data.refund_reason || null,
        family_id: familyId,
        created_by: this.uid,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      })

      // 全额退款时犬只回到待售
      if (isFullRefund) {
        await db.collection('dogs').doc(sale.dog_id).update({
          disposition: '待售',
          disposition_date: null,
          updated_at: now,
        })
      }
    } else if (sale.status === '已预定') {
      // 定金取消
      const keptAmount = data.deposit_kept_amount || 0

      await db.collection('sale_records').doc(saleId).update({
        status: '定金取消',
        deposit_kept_amount: keptAmount,
        refund_reason: data.refund_reason || null,
        updated_at: now,
      })

      // 如果保留了部分定金，计为收入
      if (keptAmount > 0) {
        await db.collection('incomes').add({
          dog_id: sale.dog_id,
          dog_name: sale.dog_name,
          type: '定金保留',
          amount: keptAmount,
          date: now,
          source_sale_id: saleId,
          notes: data.refund_reason || null,
          family_id: familyId,
          created_by: this.uid,
          deleted_at: null,
          created_at: now,
          updated_at: now,
        })
      }

      // 犬只回到待售
      await db.collection('dogs').doc(sale.dog_id).update({
        disposition: '待售',
        updated_at: now,
      })
    } else {
      throw new Error('当前状态不可取消')
    }

    return { message: '已取消' }
  },

  /**
   * 销售记录列表
   */
  async getSaleList(filters = {}) {
    const where = { family_id: this.familyId, deleted_at: null }

    if (filters.status) where.status = filters.status
    if (filters.dog_id) where.dog_id = filters.dog_id

    const { data: sales } = await db.collection('sale_records')
      .where(where)
      .orderBy('created_at', 'desc')
      .limit(100)
      .get()

    return { data: sales }
  },

  /**
   * 销售记录详情
   */
  async getSaleDetail(saleId) {
    if (!saleId) throw new Error('缺少销售记录 ID')

    const { data: sales } = await db.collection('sale_records')
      .where({ _id: saleId, family_id: this.familyId, deleted_at: null })
      .get()
    if (!sales || sales.length === 0) throw new Error('记录不存在')

    return { data: sales[0] }
  },

  // ── 中间商管理 ──

  /**
   * 中间商列表
   */
  async getAgentList() {
    const { data: agents } = await db.collection('agents')
      .where({ family_id: this.familyId, deleted_at: null })
      .orderBy('created_at', 'desc')
      .get()

    return { data: agents }
  },

  /**
   * 添加中间商
   */
  async addAgent(data) {
    if (!data.name) throw new Error('请填写中间商姓名')

    const now = Date.now()

    const agentData = {
      family_id: this.familyId,
      name: data.name,
      contact_info: data.contact_info || null,
      created_by: this.uid,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    }

    const { id } = await db.collection('agents').add(agentData)
    return { data: { agentId: id } }
  },

  /**
   * 更新中间商信息
   */
  async updateAgent(id, data) {
    if (!id) throw new Error('缺少中间商 ID')
    if (!data.name) throw new Error('请填写中间商姓名')

    const { data: agents } = await db.collection('agents')
      .where({ _id: id, family_id: this.familyId, deleted_at: null })
      .get()
    if (!agents || agents.length === 0) throw new Error('中间商不存在')

    await db.collection('agents').doc(id).update({
      name: data.name,
      contact_info: data.contact_info || null,
      updated_at: Date.now(),
    })

    return { message: '已更新' }
  },

  /**
   * 软删除中间商
   */
  async removeAgent(id) {
    if (!id) throw new Error('缺少中间商 ID')

    const { data: agents } = await db.collection('agents')
      .where({ _id: id, family_id: this.familyId })
      .get()
    if (!agents || agents.length === 0) throw new Error('中间商不存在')

    await db.collection('agents').doc(id).update({
      deleted_at: Date.now(),
      updated_at: Date.now(),
    })

    return { message: '已删除' }
  },

  /**
   * 获取支出分类（默认 + 自定义）
   */
  async getExpenseCategories() {
    // 检查家庭是否有自定义分类
    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ settings: true })
      .get()

    const family = data[0] || data
    const categories = buildExpenseCategoryOptions(family.settings?.custom_expense_categories || [])

    return { data: categories }
  },

  /**
   * 新增自定义支出分类
   */
  async addExpenseCategory({ name, parentGroup } = {}) {
    if (!name || !name.trim()) throw new Error('请填写分类名称')
    name = name.trim()
    const normalizedParentGroup = normalizeExpenseCategoryGroupKey(parentGroup)

    if (DEFAULT_EXPENSE_CATEGORIES.includes(name)) throw new Error('该分类名称与预设分类重复')

    const { data } = await db.collection('families').doc(this.familyId).field({ settings: true }).get()
    const family = data[0] || data
    const custom = normalizeCustomExpenseCategories(family.settings?.custom_expense_categories || [])

    if (custom.some(item => item.name === name)) throw new Error('分类名称已存在')

    await db.collection('families').doc(this.familyId).update({
      'settings.custom_expense_categories': [
        ...custom,
        { name, parent_group: normalizedParentGroup },
      ],
    })

    return { message: '已添加' }
  },

  /**
   * 重命名自定义支出分类（同步迁移历史账单）
   */
  async updateExpenseCategory({ oldName, newName, parentGroup } = {}) {
    if (!oldName || !newName || !newName.trim()) throw new Error('参数不完整')
    newName = newName.trim()

    if (DEFAULT_EXPENSE_CATEGORIES.includes(oldName)) throw new Error('预设分类不可编辑')
    if (DEFAULT_EXPENSE_CATEGORIES.includes(newName)) throw new Error('新名称与预设分类重复')

    const { data } = await db.collection('families').doc(this.familyId).field({ settings: true }).get()
    const family = data[0] || data
    const custom = normalizeCustomExpenseCategories(family.settings?.custom_expense_categories || [])

    const current = custom.find(item => item.name === oldName)
    if (!current) throw new Error('分类不存在')
    if (oldName !== newName && custom.some(item => item.name === newName)) throw new Error('新名称已存在')

    const normalizedParentGroup = normalizeExpenseCategoryGroupKey(parentGroup || current.parent_group)
    if (newName === oldName && normalizedParentGroup === current.parent_group) return { message: '无变化' }
    const updated = custom.map((item) => (
      item.name === oldName
        ? { ...item, name: newName, parent_group: normalizedParentGroup }
        : item
    ))
    await db.collection('families').doc(this.familyId).update({
      'settings.custom_expense_categories': updated,
    })

    // 迁移历史账单中的分类名称
    if (newName !== oldName) {
      await db.collection('expenses').where({
        family_id: this.familyId,
        category: oldName,
        deleted_at: null,
      }).update({ category: newName })
    }

    return { message: '已更新' }
  },

  /**
   * 删除自定义支出分类
   */
  async removeExpenseCategory({ name } = {}) {
    if (!name) throw new Error('请指定分类名称')

    if (DEFAULT_EXPENSE_CATEGORIES.includes(name)) throw new Error('预设分类不可删除')

    const { data } = await db.collection('families').doc(this.familyId).field({ settings: true }).get()
    const family = data[0] || data
    const custom = normalizeCustomExpenseCategories(family.settings?.custom_expense_categories || [])

    if (!custom.some(item => item.name === name)) throw new Error('分类不存在')

    await db.collection('families').doc(this.familyId).update({
      'settings.custom_expense_categories': custom.filter(item => item.name !== name),
    })

    return { message: '已删除' }
  },
}
