/**
 * 财务云对象
 * 管理费用/收入 CRUD、财务统计、销售流程
 */
const { verifyAndGetFamily, requireFamily } = require('breed-auth/auth')

const db = uniCloud.database()
const dbCmd = db.command

const DAY_MS = 86400000

// 默认支出分类
const DEFAULT_EXPENSE_CATEGORIES = ['食品', '营养品', '消耗品', '日常用品', '固定开销', '交通', '医疗', '配种费', '其他']

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
   * 收支流水列表（合并展示）
   */
  async getTransactionList(filters = {}) {
    const familyId = this.familyId
    const where = { family_id: familyId, deleted_at: null }

    if (filters.startDate) where.date = dbCmd.gte(filters.startDate)
    if (filters.endDate) {
      where.date = where.date
        ? dbCmd.and(where.date, dbCmd.lte(filters.endDate))
        : dbCmd.lte(filters.endDate)
    }

    // 并行查询收支
    const [expenseResult, incomeResult] = await Promise.all([
      db.collection('expenses').where(where).orderBy('date', 'desc').limit(100).get(),
      db.collection('incomes').where(where).orderBy('date', 'desc').limit(100).get(),
    ])

    // 合并并标记类型
    const transactions = [
      ...expenseResult.data.map(e => ({ ...e, _txType: 'expense' })),
      ...incomeResult.data.map(i => ({ ...i, _txType: 'income' })),
    ]

    // 按日期降序排序
    transactions.sort((a, b) => (b.date || 0) - (a.date || 0))

    return { data: transactions.slice(0, 100) }
  },

  /**
   * 软删除支出
   */
  async softDeleteExpense(id) {
    if (!id) throw new Error('缺少记录 ID')

    const { data: expenses } = await db.collection('expenses')
      .where({ _id: id, family_id: this.familyId })
      .get()
    if (!expenses || expenses.length === 0) throw new Error('记录不存在')
    if (expenses[0].source_type === 'auto') throw new Error('自动生成的费用不可删除，请在来源记录中操作')

    await db.collection('expenses').doc(id).update({
      deleted_at: Date.now(),
      updated_at: Date.now(),
    })

    return { message: '已删除' }
  },

  /**
   * 软删除收入
   */
  async softDeleteIncome(id) {
    if (!id) throw new Error('缺少记录 ID')

    const { data: incomes } = await db.collection('incomes')
      .where({ _id: id, family_id: this.familyId })
      .get()
    if (!incomes || incomes.length === 0) throw new Error('记录不存在')

    await db.collection('incomes').doc(id).update({
      deleted_at: Date.now(),
      updated_at: Date.now(),
    })

    return { message: '已删除' }
  },

  // ── 财务统计 ──

  /**
   * 月度/年度统计
   */
  async getFinancialSummary(period) {
    const familyId = this.familyId
    const now = new Date()
    let startDate, endDate

    if (period === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1).getTime()
      endDate = new Date(now.getFullYear() + 1, 0, 1).getTime()
    } else {
      // 默认月度
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
    }

    const dateFilter = { $gte: startDate, $lt: endDate }

    const [expenseResult, incomeResult] = await Promise.all([
      db.collection('expenses')
        .where({ family_id: familyId, deleted_at: null, date: dateFilter })
        .limit(1000)
        .get(),
      db.collection('incomes')
        .where({ family_id: familyId, deleted_at: null, date: dateFilter })
        .limit(1000)
        .get(),
    ])

    const totalExpense = expenseResult.data.reduce((sum, e) => sum + (e.total_amount || 0), 0)
    const totalIncome = incomeResult.data.reduce((sum, i) => sum + (i.amount || 0), 0)

    // 按分类汇总支出
    const categoryBreakdown = {}
    for (const e of expenseResult.data) {
      const cat = e.category || '其他'
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (e.total_amount || 0)
    }

    // 按类型汇总收入
    const incomeBreakdown = {}
    for (const i of incomeResult.data) {
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
        expenseCount: expenseResult.data.length,
        incomeCount: incomeResult.data.length,
      }
    }
  },

  /**
   * 单窝利润
   */
  async getLitterProfit(litterId) {
    if (!litterId) throw new Error('缺少窝 ID')

    const familyId = this.familyId

    // 获取窝信息
    const { data: litters } = await db.collection('litters')
      .where({ _id: litterId, family_id: familyId })
      .get()
    if (!litters || litters.length === 0) throw new Error('窝不存在')
    const litter = litters[0]

    // 获取该窝幼崽
    const { data: puppies } = await db.collection('dogs')
      .where({ origin_litter_id: litterId, deleted_at: null })
      .get()
    const puppyIds = puppies.map(p => p._id)

    // 收入：该窝幼崽的所有收入
    let totalIncome = 0
    if (puppyIds.length > 0) {
      for (const pid of puppyIds) {
        const { data: incomes } = await db.collection('incomes')
          .where({ dog_id: pid, family_id: familyId, deleted_at: null })
          .get()
        totalIncome += incomes.reduce((sum, i) => sum + (i.amount || 0), 0)
      }
    }

    // 支出：周期费用 + 窝级别费用 + 幼崽个体费用
    let totalExpense = 0

    // 周期费用
    if (litter.cycle_id) {
      const { data: cycleExpenses } = await db.collection('expenses')
        .where({ linked_cycle_id: litter.cycle_id, family_id: familyId, deleted_at: null })
        .get()
      totalExpense += cycleExpenses.reduce((sum, e) => sum + (e.total_amount || 0), 0)
    }

    // 窝级别费用
    const { data: litterExpenses } = await db.collection('expenses')
      .where({ linked_litter_id: litterId, family_id: familyId, deleted_at: null })
      .get()
    totalExpense += litterExpenses.reduce((sum, e) => sum + (e.total_amount || 0), 0)

    // 幼崽个体费用（通过 linked_dog_ids 关联，排除已通过 cycle/litter 计过的费用）
    const countedExpenseIds = new Set()
    if (litter.cycle_id) {
      const { data: ce } = await db.collection('expenses')
        .where({ linked_cycle_id: litter.cycle_id, family_id: familyId, deleted_at: null })
        .get()
      ce.forEach(e => countedExpenseIds.add(e._id))
    }
    litterExpenses.forEach(e => countedExpenseIds.add(e._id))

    const { data: allLinkedExpenses } = await db.collection('expenses')
      .where({ family_id: familyId, deleted_at: null })
      .limit(1000)
      .get()

    for (const e of allLinkedExpenses) {
      if (countedExpenseIds.has(e._id)) continue // 已计入，跳过避免重复
      if (e.linked_dog_ids && e.linked_dog_ids.length > 0) {
        const matchCount = e.linked_dog_ids.filter(id => puppyIds.includes(id)).length
        if (matchCount > 0) {
          // 分摊：该笔费用中属于该窝幼崽的部分
          totalExpense += (e.total_amount || 0) * matchCount / e.linked_dog_ids.length
        }
      }
    }

    const aliveCount = puppies.filter(p => p.disposition !== '已故').length
    const avgCostPerPuppy = aliveCount > 0 ? totalExpense / aliveCount : 0

    return {
      data: {
        litterId,
        damName: litter.dam_name,
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense,
        puppyCount: puppies.length,
        aliveCount,
        avgCostPerPuppy: Math.round(avgCostPerPuppy),
      }
    }
  },

  /**
   * 种母 ROI
   */
  async getDamROI(damId) {
    if (!damId) throw new Error('缺少犬只 ID')

    const familyId = this.familyId

    // 获取犬只信息
    const { data: dogs } = await db.collection('dogs')
      .where({ _id: damId, family_id: familyId })
      .get()
    if (!dogs || dogs.length === 0) throw new Error('犬只不存在')
    const dam = dogs[0]

    // 获取该犬所有繁育周期
    const { data: cycles } = await db.collection('breeding_cycles')
      .where({ dam_id: damId, family_id: familyId })
      .get()
    const cycleIds = cycles.map(c => c._id)

    // 获取所有窝
    const { data: litters } = await db.collection('litters')
      .where({ dam_id: damId, family_id: familyId })
      .get()
    const litterIds = litters.map(l => l._id)

    // 获取所有幼崽
    let allPuppyIds = []
    for (const lid of litterIds) {
      const { data: puppies } = await db.collection('dogs')
        .where({ origin_litter_id: lid, deleted_at: null })
        .get()
      allPuppyIds.push(...puppies.map(p => p._id))
    }

    // 总收入：所有幼崽收入
    let totalIncome = 0
    for (const pid of allPuppyIds) {
      const { data: incomes } = await db.collection('incomes')
        .where({ dog_id: pid, family_id: familyId, deleted_at: null })
        .get()
      totalIncome += incomes.reduce((sum, i) => sum + (i.amount || 0), 0)
    }

    // 总支出：买入价 + 周期费用 + 窝费用 + 个体费用
    let totalExpense = dam.purchase_price || 0

    // 周期费用
    for (const cid of cycleIds) {
      const { data: expenses } = await db.collection('expenses')
        .where({ linked_cycle_id: cid, family_id: familyId, deleted_at: null })
        .get()
      totalExpense += expenses.reduce((sum, e) => sum + (e.total_amount || 0), 0)
    }

    // 窝费用
    for (const lid of litterIds) {
      const { data: expenses } = await db.collection('expenses')
        .where({ linked_litter_id: lid, family_id: familyId, deleted_at: null })
        .get()
      totalExpense += expenses.reduce((sum, e) => sum + (e.total_amount || 0), 0)
    }

    // 种母个体费用（排除已通过 cycle/litter 计入的费用）
    const countedIds = new Set()
    for (const cid of cycleIds) {
      const { data: ce } = await db.collection('expenses')
        .where({ linked_cycle_id: cid, family_id: familyId, deleted_at: null })
        .get()
      ce.forEach(e => countedIds.add(e._id))
    }
    for (const lid of litterIds) {
      const { data: le } = await db.collection('expenses')
        .where({ linked_litter_id: lid, family_id: familyId, deleted_at: null })
        .get()
      le.forEach(e => countedIds.add(e._id))
    }

    const { data: allExpenses } = await db.collection('expenses')
      .where({ family_id: familyId, deleted_at: null })
      .limit(1000)
      .get()

    for (const e of allExpenses) {
      if (countedIds.has(e._id)) continue // 已通过 cycle/litter 计入，跳过
      if (e.linked_dog_ids && e.linked_dog_ids.includes(damId)) {
        totalExpense += (e.total_amount || 0) / e.linked_dog_ids.length
      }
    }

    return {
      data: {
        damId,
        damName: dam.name,
        purchasePrice: dam.purchase_price || 0,
        totalIncome,
        totalExpense,
        netReturn: totalIncome - totalExpense,
        cycleCount: cycles.length,
        litterCount: litters.length,
        puppyCount: allPuppyIds.length,
      }
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
      created_by: this.uid,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    }

    const { id } = await db.collection('agents').add(agentData)
    return { data: { agentId: id } }
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
}
