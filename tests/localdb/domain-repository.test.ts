import { describe, expect, it } from 'vitest'
import { localDb } from '../../src/localdb/db'
import {
  findLocalDuplicateIllnesses,
  findLocalDuplicateMedicationTasks,
  getLocalBreedingCycleDetail,
  getLocalDogDetail,
  getLocalDogFinanceSummary,
  getLocalExpenseDetail,
  getLocalFinancialSummary,
  getLocalIncomeDetail,
  getLocalKennelDashboardStats,
  getLocalLitterProfit,
  getLocalProjectionParams,
  getLocalSaleDetail,
  getLocalTaskById,
  getLocalTransactionList,
  getLocalDamRoi,
  listLocalBreedingCycles,
  listLocalDogHealthHistory,
  listLocalDogMedicationHistory,
  listLocalDogWeights,
  listLocalDogsWithStatus,
  listLocalLittersByDam,
  listLocalLitters,
  listLocalMedicationProtocols,
  listLocalTasksByIds,
} from '../../src/localdb/domain-repository'

describe('local domain repository', () => {
  it('应从本地集合投影出犬只状态', async () => {
    const now = Date.now()
    await localDb.replaceTable('dogs', [{
      _id: 'dog_1',
      family_id: 'fam_1',
      name: '奶糖',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      updated_at: now,
    }])
    await localDb.replaceTable('breeding_cycles', [{
      _id: 'cycle_1',
      family_id: 'fam_1',
      dam_id: 'dog_1',
      status: '怀孕中',
      mated_at: now - (20 * 86400000),
      updated_at: now,
    }])
    await localDb.replaceTable('health_records', [{
      _id: 'ill_1',
      family_id: 'fam_1',
      dog_id: 'dog_1',
      type: 'illness',
      date: now - 86400000,
      updated_at: now,
      details: {
        treatment_status: '观察中',
        primary_condition: '肠胃炎',
      },
    }])
    await localDb.replaceTable('medication_tasks', [{
      _id: 'med_1',
      family_id: 'fam_1',
      dog_id: 'dog_1',
      status: '进行中',
      drug_name: '益生菌',
      duration_days: 5,
      actual_start_date: now - 86400000,
      updated_at: now,
    }])
    await localDb.replaceTable('litters', [])

    const dogs = await listLocalDogsWithStatus('fam_1')
    expect(dogs).toHaveLength(1)
    expect(dogs[0].statuses.map(status => status.type)).toEqual(['生病中', '用药中', '怀孕中'])
  })

  it('应从本地方案库和犬舍总览集合读取数据', async () => {
    const monthTs = new Date('2026-04-10T10:00:00+08:00').getTime()
    await localDb.replaceTable('medication_protocols', [{
      _id: 'protocol_1',
      family_id: 'fam_1',
      name: '保胎',
      drug_name: '黄体酮',
      updated_at: monthTs,
    }])
    await localDb.replaceTable('dogs', [{
      _id: 'dog_1',
      family_id: 'fam_1',
      name: '奶糖',
      gender: '母',
      role: '种狗',
      disposition: '待售',
      updated_at: monthTs,
    }, {
      _id: 'dog_2',
      family_id: 'fam_1',
      name: '雪球',
      gender: '公',
      role: '种狗',
      disposition: '已售',
      updated_at: monthTs,
    }])
    await localDb.replaceTable('breeding_cycles', [])
    await localDb.replaceTable('health_records', [])
    await localDb.replaceTable('medication_tasks', [])
    await localDb.replaceTable('litters', [{
      _id: 'litter_1',
      family_id: 'fam_1',
      dam_id: 'dog_1',
      updated_at: monthTs,
    }])
    await localDb.replaceTable('sale_records', [{
      _id: 'sale_1',
      family_id: 'fam_1',
      status: '已成交',
      updated_at: monthTs,
    }])
    await localDb.replaceTable('expenses', [{
      _id: 'expense_1',
      family_id: 'fam_1',
      total_amount: 300,
      date: monthTs,
      updated_at: monthTs,
    }])
    await localDb.replaceTable('incomes', [{
      _id: 'income_1',
      family_id: 'fam_1',
      amount: 1000,
      date: monthTs,
      updated_at: monthTs,
    }])

    expect(await listLocalMedicationProtocols('fam_1')).toHaveLength(1)

    const stats = await getLocalKennelDashboardStats('fam_1')
    expect(stats.activeDogs).toHaveLength(1)
    expect(stats.soldDogs).toHaveLength(1)
    expect(stats.monthlyIncome).toBe(1000)
    expect(stats.monthlyExpense).toBe(300)
  })

  it('应从本地集合投影出窝列表、周期列表与周期详情', async () => {
    const now = new Date('2026-04-24T10:00:00+08:00').getTime()
    await localDb.replaceTable('breeding_cycles', [{
      _id: 'cycle_active',
      family_id: 'fam_2',
      dam_id: 'dog_10',
      dam_name: '奶酪',
      status: '怀孕中',
      cycle_number: 3,
      mated_at: now - (10 * 86400000),
      updated_at: now,
    }, {
      _id: 'cycle_closed',
      family_id: 'fam_2',
      dam_id: 'dog_11',
      dam_name: '年糕',
      status: '放弃',
      cycle_number: 2,
      start_date: now - (20 * 86400000),
      updated_at: now - 5000,
    }])
    await localDb.replaceTable('litters', [{
      _id: 'litter_10',
      family_id: 'fam_2',
      cycle_id: 'cycle_active',
      dam_id: 'dog_10',
      dam_name: '奶酪',
      birth_date: now - (3 * 86400000),
      litter_number: 4,
      total_born: 5,
      born_alive: 4,
      updated_at: now,
    }, {
      _id: 'litter_old',
      family_id: 'fam_2',
      cycle_id: 'cycle_closed',
      dam_id: 'dog_11',
      dam_name: '年糕',
      birth_date: now - (30 * 86400000),
      litter_number: 2,
      total_born: 3,
      born_alive: 3,
      weaned_at: now - (5 * 86400000),
      updated_at: now - 10000,
    }])
    await localDb.replaceTable('breeding_records', [{
      _id: 'record_10',
      family_id: 'fam_2',
      cycle_id: 'cycle_active',
      dog_id: 'dog_10',
      type: 'pregnancy_check',
      date: now - 86400000,
      updated_at: now,
      created_by: 'user_1',
    }])
    await localDb.replaceTable('expenses', [{
      _id: 'expense_10',
      family_id: 'fam_2',
      linked_cycle_id: 'cycle_active',
      total_amount: 200,
      date: now,
      updated_at: now,
      category: '产检',
      source_type: 'manual',
      created_by: 'user_1',
    }])

    const litters = await listLocalLitters('fam_2', { activeOnly: true })
    expect(litters).toHaveLength(1)
    expect(litters[0]).toMatchObject({
      _id: 'litter_10',
      damName: '奶酪',
      litterNumber: 4,
      aliveCount: 4,
      totalCount: 5,
    })

    const cycles = await listLocalBreedingCycles('fam_2', { includeClosed: true })
    expect(cycles.map(item => item._id)).toEqual(['cycle_active', 'cycle_closed'])
    expect(cycles[0]).toMatchObject({
      statusLabel: '怀孕中',
      damName: '奶酪',
      cycleNumber: 3,
    })

    const detail = await getLocalBreedingCycleDetail('fam_2', 'cycle_active')
    expect(detail).toMatchObject({
      cycle: { _id: 'cycle_active' },
      litter: { _id: 'litter_10' },
    })
    expect(detail?.records).toHaveLength(1)
    expect(detail?.expenses).toHaveLength(1)
  })

  it('应从本地集合归一化销售与财务详情字段', async () => {
    const now = new Date('2026-04-24T10:00:00+08:00').getTime()
    await localDb.replaceTable('families', [{
      _id: 'fam_3',
      members: [{
        user_id: 'user_1',
        status: 'active',
        nickname: '小莫',
      }],
      settings: {
        custom_expense_categories: [{ name: '保健品', parent_group: 'health' }],
        custom_expense_category_groups: [],
      },
      updated_at: now,
    }])
    await localDb.replaceTable('dogs', [{
      _id: 'dog_30',
      family_id: 'fam_3',
      name: '奶糖',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      breed: '马尔济斯',
      birth_date: now - (400 * 86400000),
      updated_at: now,
    }, {
      _id: 'dog_31',
      family_id: 'fam_3',
      name: '奶芙',
      gender: '母',
      role: '幼崽',
      disposition: '在养',
      origin_litter_id: 'litter_30',
      updated_at: now,
    }])
    await localDb.replaceTable('litters', [{
      _id: 'litter_30',
      family_id: 'fam_3',
      dam_id: 'dog_30',
      dam_name: '奶糖',
      birth_date: now,
      updated_at: now,
    }])
    await localDb.replaceTable('agents', [{
      _id: 'agent_30',
      family_id: 'fam_3',
      name: '阿琳',
      updated_at: now,
    }])
    await localDb.replaceTable('sale_records', [{
      _id: 'sale_30',
      family_id: 'fam_3',
      dog_id: 'dog_30',
      dog_name: '奶糖',
      status: '已成交',
      received_amount: 8800,
      seller_agent_id: 'agent_30',
      updated_at: now,
    }])
    await localDb.replaceTable('expenses', [{
      _id: 'expense_30',
      family_id: 'fam_3',
      total_amount: 320,
      category: '保健品',
      linked_dog_ids: ['dog_30'],
      source_type: 'manual',
      created_by: 'user_1',
      date: now,
      updated_at: now,
    }, {
      _id: 'expense_31',
      family_id: 'fam_3',
      total_amount: 500,
      category: '检查化验',
      linked_litter_id: 'litter_30',
      source_type: 'manual',
      created_by: 'user_1',
      date: now,
      updated_at: now,
    }, {
      _id: 'expense_32',
      family_id: 'fam_3',
      total_amount: 600,
      category: '其他',
      source_type: 'manual',
      created_by: 'user_1',
      date: now,
      updated_at: now,
    }])
    await localDb.replaceTable('incomes', [{
      _id: 'income_30',
      family_id: 'fam_3',
      type: '定金',
      amount: 2000,
      dog_name: '奶糖',
      source_sale_id: 'sale_30',
      created_by: 'user_1',
      date: now,
      updated_at: now,
    }, {
      _id: 'income_31',
      family_id: 'fam_3',
      type: '销售',
      amount: 3600,
      dog_id: 'dog_31',
      dog_name: '奶芙',
      created_by: 'user_1',
      date: now,
      updated_at: now,
    }])

    const sale = await getLocalSaleDetail('fam_3', 'sale_30')
    expect(sale).toMatchObject({
      sale_mode: '自售',
      settlement_status: '已结算',
      agent_name: '阿琳',
      breed: '马尔济斯',
      sex: '母',
    })
    expect(sale?.age_text).toContain('岁')

    const expense = await getLocalExpenseDetail('fam_3', 'expense_30')
    expect(expense).toMatchObject({
      amount: 320,
      category: '保健品',
      category_group_label: '医疗健康',
      created_by_name: '小莫',
      linked_ref: '单犬记录',
    })
    expect(expense?.linked_dogs).toEqual([{ _id: 'dog_30', name: '奶糖' }])

    const income = await getLocalIncomeDetail('fam_3', 'income_30')
    expect(income).toMatchObject({
      type: '定金保留',
      type_label: '定金保留',
      linked_dog_name: '奶糖',
      sale_id: 'sale_30',
      source: 'auto',
      created_by_name: '小莫',
    })

    const summary = await getLocalFinancialSummary('fam_3', {
      period: 'monthly',
      month: 4,
      year: 2026,
    })
    expect(summary).toMatchObject({
      totalIncome: 5600,
      totalExpense: 1420,
      netProfit: 4180,
      incomeBreakdown: { '定金保留': 2000, '销售': 3600 },
      categoryBreakdown: { '医疗健康': 820, '其他': 600 },
    })

    const projection = await getLocalProjectionParams('fam_3')
    expect(projection).toMatchObject({
      activeDams: 1,
      littersPerYear: 1,
      avgIncomePerLitter: 3600,
      avgCostPerLitter: 500,
      monthlySharedCost: 100,
    })

    const litterProfit = await getLocalLitterProfit('fam_3', 'litter_30')
    expect(litterProfit).toMatchObject({
      totalIncome: 3600,
      totalCost: 500,
      netProfit: 3100,
      puppyCount: 1,
      aliveCount: 1,
    })
    expect(litterProfit?.incomeItems).toHaveLength(1)

    const damRoi = await getLocalDamRoi('fam_3', 'dog_30')
    expect(damRoi).toMatchObject({
      totalBreedingIncome: 3600,
      totalBreedingCost: 500,
      healthCost: 320,
      cycleCount: 0,
      litterCount: 1,
      puppyCount: 1,
    })
    expect(damRoi?.litters).toHaveLength(1)

    const txList = await getLocalTransactionList('fam_3', {
      period: 'monthly',
      month: 4,
      year: 2026,
      type: 'expense',
      expenseCategoryGroups: ['health'],
      sort: 'amount_desc',
    })
    expect(txList.map(item => item._id)).toEqual(['expense_31', 'expense_30'])
    expect(txList[0]).toMatchObject({
      _txType: 'expense',
      category_group_label: '医疗健康',
    })
  })

  it('应为犬只详情页提供本地详情、历史、窝统计与体重投影', async () => {
    const now = new Date('2026-04-24T10:00:00+08:00').getTime()
    const runtimeNow = Date.now()
    await localDb.replaceTable('dogs', [{
      _id: 'dog_40',
      family_id: 'fam_4',
      name: '团子',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      purchase_price: 3200,
      birth_date: now - (500 * 86400000),
      updated_at: now,
    }, {
      _id: 'puppy_40_a',
      family_id: 'fam_4',
      name: '团子窝-1号',
      gender: '母',
      role: '幼崽',
      disposition: '在养',
      origin_litter_id: 'litter_40',
      updated_at: now,
    }, {
      _id: 'puppy_40_b',
      family_id: 'fam_4',
      name: '团子窝-2号',
      gender: '公',
      role: '幼崽',
      disposition: '已售',
      origin_litter_id: 'litter_40',
      updated_at: now,
    }])
    await localDb.replaceTable('breeding_cycles', [{
      _id: 'cycle_40',
      family_id: 'fam_4',
      dam_id: 'dog_40',
      dam_name: '团子',
      status: '已生产',
      birth_date: now - (12 * 86400000),
      updated_at: now,
      created_at: now - (60 * 86400000),
    }])
    await localDb.replaceTable('litters', [{
      _id: 'litter_40',
      family_id: 'fam_4',
      dam_id: 'dog_40',
      dam_name: '团子',
      cycle_id: 'cycle_40',
      birth_date: now - (12 * 86400000),
      born_alive: 2,
      total_born: 2,
      updated_at: now,
    }])
    await localDb.replaceTable('health_records', [{
      _id: 'ill_40',
      family_id: 'fam_4',
      dog_id: 'dog_40',
      type: 'illness',
      date: now - (2 * 86400000),
      updated_at: now,
      details: {
        treatment_status: '治疗中',
        primary_condition: '乳房炎',
      },
    }, {
      _id: 'vac_40',
      family_id: 'fam_4',
      dog_id: 'dog_40',
      type: 'vaccination',
      date: now - (30 * 86400000),
      updated_at: now - 1000,
      details: {
        vaccine_type: '四联',
      },
    }])
    await localDb.replaceTable('medication_tasks', [{
      _id: 'med_40',
      family_id: 'fam_4',
      dog_id: 'dog_40',
      dog_name: '团子',
      status: '进行中',
      drug_name: '头孢',
      frequency: 2,
      duration_days: 5,
      actual_start_date: runtimeNow - 86400000,
      updated_at: runtimeNow,
      daily_doses: { 1: 2 },
    }])
    await localDb.replaceTable('expenses', [{
      _id: 'expense_40',
      family_id: 'fam_4',
      total_amount: 240,
      category: '保健品',
      linked_dog_ids: ['dog_40'],
      date: now - 86400000,
      updated_at: now,
    }])
    await localDb.replaceTable('incomes', [{
      _id: 'income_40',
      family_id: 'fam_4',
      dog_id: 'dog_40',
      dog_name: '团子',
      type: '销售',
      amount: 900,
      date: now,
      updated_at: now,
    }])
    await localDb.replaceTable('dog_weights', [{
      _id: 'weight_40_a',
      family_id: 'fam_4',
      dog_id: 'dog_40',
      weight: 3200,
      date: now - (7 * 86400000),
      created_at: now - (7 * 86400000),
    }, {
      _id: 'weight_40_b',
      family_id: 'fam_4',
      dog_id: 'dog_40',
      weight: 3350,
      date: now - 86400000,
      created_at: now - 86400000,
    }])

    const detail = await getLocalDogDetail('fam_4', 'dog_40')
    expect(detail?.statuses.map(item => item.type)).toEqual(['生病中', '用药中', '哺乳中'])

    const history = await listLocalDogHealthHistory('fam_4', 'dog_40')
    expect(history.map(item => item._id)).toEqual(['ill_40', 'vac_40'])

    const medicationHistory = await listLocalDogMedicationHistory('fam_4', 'dog_40')
    expect(medicationHistory[0]).toMatchObject({
      _id: 'med_40',
      status: 'active',
      progress: {
        current: 2,
        total: 5,
      },
    })

    const litters = await listLocalLittersByDam('fam_4', 'dog_40')
    expect(litters[0]).toMatchObject({
      _id: 'litter_40',
      pupStats: {
        total: 2,
        alive: 2,
        sold: 1,
        kept: 1,
        available: 0,
      },
    })

    const finance = await getLocalDogFinanceSummary('fam_4', 'dog_40')
    expect(finance).toMatchObject({
      purchaseCost: 3200,
      directExpenses: 240,
      salesIncome: 900,
      netProfit: -2540,
    })
    expect(finance?.recent).toHaveLength(2)

    const weights = await listLocalDogWeights('fam_4', 'dog_40')
    expect(weights.map(item => item._id)).toEqual(['weight_40_b', 'weight_40_a'])
  })

  it('应支持本地任务读取与重复疾病/用药预检', async () => {
    const now = new Date('2026-04-28T10:00:00+08:00').getTime()
    await localDb.replaceTable('tasks', [{
      _id: 'task_50_a',
      family_id: 'fam_5',
      dog_id: 'dog_50',
      dog_name: '奶黄',
      title: '今日疫苗',
      type: 'vaccination',
      status: 'pending',
      due_date: now,
      created_at: now,
      updated_at: now,
    }, {
      _id: 'task_50_b',
      family_id: 'fam_5',
      dog_id: 'dog_51',
      dog_name: '奶盖',
      title: '今日驱虫',
      type: 'deworming',
      status: 'pending',
      due_date: now,
      created_at: now,
      updated_at: now,
    }])
    await localDb.replaceTable('health_records', [{
      _id: 'ill_50',
      family_id: 'fam_5',
      dog_id: 'dog_50',
      dog_name: '奶黄',
      type: 'illness',
      date: now,
      created_at: now,
      updated_at: now,
      details: {
        primary_condition: '皮肤炎',
        treatment_status: '治疗中',
      },
    }])
    await localDb.replaceTable('medication_tasks', [{
      _id: 'med_50',
      family_id: 'fam_5',
      dog_id: 'dog_50',
      dog_name: '奶黄',
      drug_name: '头孢',
      frequency: 2,
      duration_days: 5,
      actual_start_date: Date.now() - 86400000,
      status: '进行中',
      created_at: now,
      updated_at: now,
    }])

    const task = await getLocalTaskById('fam_5', 'task_50_a')
    expect(task?._id).toBe('task_50_a')

    const taskList = await listLocalTasksByIds('fam_5', ['task_50_b', 'task_50_a'])
    expect(taskList.map(item => item._id)).toEqual(['task_50_b', 'task_50_a'])

    const illnessDup = await findLocalDuplicateIllnesses('fam_5', ['dog_50'], '皮肤炎')
    expect(illnessDup).toEqual([{
      dogId: 'dog_50',
      recordId: 'ill_50',
      condition: '皮肤炎',
    }])

    const medicationDup = await findLocalDuplicateMedicationTasks('fam_5', ['dog_50'], '头孢')
    expect(medicationDup[0]).toMatchObject({
      dog_id: 'dog_50',
      dog_name: '奶黄',
      task_id: 'med_50',
      task_name: '头孢',
      status: 'active',
    })
  })
})
