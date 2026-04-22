/**
 * finance-service 云对象测试
 * 测试财务分类分组、多选筛选与汇总口径
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createCloudObjectContext,
  createMockUniCloud,
  resetDB,
  seedCollection,
} from '../helpers/mock-unicloud'

const mockUniCloud = createMockUniCloud()
;(globalThis as any).uniCloud = mockUniCloud
process.env.NODE_ENV = 'test'
const financeService = require('../../uniCloud-alipay/cloudfunctions/finance-service/index.obj.js')

describe('finance-service', () => {
  const db = mockUniCloud.database()
  const familyId = 'fam_finance_1'
  const aprilTs = new Date('2026-04-20T10:00:00+08:00').getTime()

  beforeEach(() => {
    resetDB()
    seedCollection('families', [{
      _id: familyId,
      name: '测试犬舍',
      settings: {
        custom_expense_categories: ['美容'],
      },
    }])
    seedCollection('dogs', [
      { _id: 'dog_1', name: '花花', family_id: familyId, deleted_at: null },
      { _id: 'dog_2', name: '可可', family_id: familyId, deleted_at: null },
      { _id: 'dog_3', name: '糖糖', family_id: familyId, deleted_at: null },
    ])
    seedCollection('expenses', [])
    seedCollection('incomes', [])
  })

  it('获取分类时应兼容旧字符串数组，并默认归到其他分组', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    const result = await financeService.getExpenseCategories.call(ctx)
    const beautyCategory = result.data.find((item: any) => item.name === '美容')

    expect(beautyCategory).toMatchObject({
      name: '美容',
      parent_group: 'other',
      is_default: false,
    })
  })

  it('新增自定义分类时应写入 parent_group', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    await financeService.addExpenseCategory.call(ctx, {
      name: '玩具',
      parentGroup: 'operations',
    })

    const { data } = await db.collection('families').doc(familyId).get()
    expect(data[0].settings.custom_expense_categories).toEqual([
      { name: '美容', parent_group: 'other' },
      { name: '玩具', parent_group: 'operations' },
    ])
  })

  it('新增自定义分组时应写入 custom_expense_category_groups', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    const result = await financeService.addExpenseCategoryGroup.call(ctx, {
      label: '美容护理',
    })

    const { data } = await db.collection('families').doc(familyId).get()
    expect(result.data).toMatchObject({
      label: '美容护理',
      is_default: false,
    })
    expect(result.data.key).toMatch(/^custom_/)
    expect(data[0].settings.custom_expense_category_groups).toEqual([
      {
        key: result.data.key,
        label: '美容护理',
      },
    ])
  })

  it('自定义分类可挂到自定义分组', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('families', [{
      _id: familyId,
      name: '测试犬舍',
      settings: {
        custom_expense_category_groups: [{ key: 'beauty', label: '美容护理' }],
        custom_expense_categories: [],
      },
    }])

    await financeService.addExpenseCategory.call(ctx, {
      name: '洗护',
      parentGroup: 'beauty',
    })

    const result = await financeService.getExpenseCategories.call(ctx)
    expect(result.data.find((item: any) => item.name === '洗护')).toMatchObject({
      name: '洗护',
      parent_group: 'beauty',
      is_default: false,
    })
  })

  it('自定义分组改名后应保留 key 并用于统计展示', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('families', [{
      _id: familyId,
      name: '测试犬舍',
      settings: {
        custom_expense_category_groups: [{ key: 'beauty', label: '美容护理' }],
        custom_expense_categories: [{ name: '洗护', parent_group: 'beauty' }],
      },
    }])
    seedCollection('expenses', [{
      _id: 'exp_beauty',
      family_id: familyId,
      category: '洗护',
      total_amount: 180,
      deleted_at: null,
      date: aprilTs,
    }])

    await financeService.updateExpenseCategoryGroup.call(ctx, {
      key: 'beauty',
      label: '洗护美容',
    })

    const groups = await financeService.getExpenseCategoryGroups.call(ctx)
    const summary = await financeService.getFinancialSummary.call(ctx, {
      period: 'monthly',
      year: 2026,
      month: 4,
      expenseCategoryGroups: ['beauty'],
    })

    expect(groups.data.find((item: any) => item.key === 'beauty')).toMatchObject({
      key: 'beauty',
      label: '洗护美容',
      is_default: false,
    })
    expect(summary.data.categoryBreakdown).toEqual({
      洗护美容: 180,
    })
  })

  it('删除仍挂载分类的自定义分组时应被拒绝，清空后可删除', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('families', [{
      _id: familyId,
      name: '测试犬舍',
      settings: {
        custom_expense_category_groups: [{ key: 'beauty', label: '美容护理' }],
        custom_expense_categories: [{ name: '洗护', parent_group: 'beauty' }],
      },
    }])

    await expect(financeService.removeExpenseCategoryGroup.call(ctx, {
      key: 'beauty',
    })).rejects.toThrow('请先迁移或删除该分组下的分类')

    await financeService.removeExpenseCategory.call(ctx, { name: '洗护' })
    await financeService.removeExpenseCategoryGroup.call(ctx, { key: 'beauty' })

    const { data } = await db.collection('families').doc(familyId).get()
    expect(data[0].settings.custom_expense_category_groups).toEqual([])
  })

  it('支出分组筛选应支持自定义分组 key', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('families', [{
      _id: familyId,
      name: '测试犬舍',
      settings: {
        custom_expense_category_groups: [{ key: 'beauty', label: '美容护理' }],
        custom_expense_categories: [{ name: '洗护', parent_group: 'beauty' }],
      },
    }])
    seedCollection('expenses', [
      {
        _id: 'exp_beauty',
        family_id: familyId,
        category: '洗护',
        total_amount: 180,
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'exp_food',
        family_id: familyId,
        category: '食品',
        total_amount: 90,
        deleted_at: null,
        date: aprilTs,
      },
    ])

    const result = await financeService.getTransactionList.call(ctx, {
      type: 'expense',
      expenseCategoryGroups: ['beauty'],
      year: 2026,
      month: 4,
    })

    expect(result.data.map((item: any) => item._id)).toEqual(['exp_beauty'])
    expect(result.data[0].category_group_label).toBe('美容护理')
  })

  it('全部类型下可同时筛收入分类与支出分组/分类', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('expenses', [
      {
        _id: 'exp_medical',
        family_id: familyId,
        category: '医疗',
        total_amount: 500,
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'exp_food',
        family_id: familyId,
        category: '食品',
        total_amount: 200,
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'exp_transport',
        family_id: familyId,
        category: '交通',
        total_amount: 100,
        deleted_at: null,
        date: aprilTs,
      },
    ])
    seedCollection('incomes', [
      {
        _id: 'income_sale',
        family_id: familyId,
        dog_id: 'dog_1',
        type: '销售',
        amount: 3000,
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'income_keep',
        family_id: familyId,
        dog_id: 'dog_2',
        type: '定金保留',
        amount: 1000,
        deleted_at: null,
        date: aprilTs,
      },
    ])

    const result = await financeService.getTransactionList.call(ctx, {
      type: '',
      incomeTypes: ['销售'],
      expenseCategoryGroups: ['health'],
      expenseCategories: ['食品'],
      year: 2026,
      month: 4,
    })

    expect(result.data.map((item: any) => item._id).sort()).toEqual([
      'exp_food',
      'exp_medical',
      'income_sale',
    ].sort())
  })

  it('收入类型筛选时应忽略支出分类条件', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('expenses', [{
      _id: 'exp_medical',
      family_id: familyId,
      category: '医疗',
      total_amount: 500,
      deleted_at: null,
      date: aprilTs,
    }])
    seedCollection('incomes', [
      {
        _id: 'income_sale',
        family_id: familyId,
        dog_id: 'dog_1',
        type: '销售',
        amount: 3000,
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'income_keep',
        family_id: familyId,
        dog_id: 'dog_2',
        type: '定金保留',
        amount: 1000,
        deleted_at: null,
        date: aprilTs,
      },
    ])

    const result = await financeService.getTransactionList.call(ctx, {
      type: 'income',
      incomeTypes: ['销售'],
      expenseCategoryGroups: ['health'],
      expenseCategories: ['医疗'],
      year: 2026,
      month: 4,
    })

    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({
      _id: 'income_sale',
      _txType: 'income',
    })
  })

  it('犬只多选取并集，叠加窝筛选时按交集处理支出', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('expenses', [
      {
        _id: 'exp_match_1',
        family_id: familyId,
        category: '食品',
        total_amount: 100,
        linked_dog_ids: ['dog_1'],
        linked_litter_id: 'litter_1',
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'exp_match_2',
        family_id: familyId,
        category: '医疗',
        total_amount: 200,
        linked_dog_ids: ['dog_2'],
        linked_litter_id: 'litter_1',
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'exp_other_litter',
        family_id: familyId,
        category: '医疗',
        total_amount: 300,
        linked_dog_ids: ['dog_2'],
        linked_litter_id: 'litter_2',
        deleted_at: null,
        date: aprilTs,
      },
    ])

    const result = await financeService.getTransactionList.call(ctx, {
      type: 'expense',
      dogIds: ['dog_1', 'dog_2'],
      litterIds: ['litter_1'],
      year: 2026,
      month: 4,
    })

    expect(result.data.map((item: any) => item._id).sort()).toEqual(['exp_match_1', 'exp_match_2'].sort())
  })

  it('仅看无关联时应忽略其他关联对象条件，并同时返回无关联收入与支出', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('expenses', [
      {
        _id: 'exp_unlinked',
        family_id: familyId,
        category: '交通',
        total_amount: 60,
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'exp_linked',
        family_id: familyId,
        category: '食品',
        total_amount: 120,
        linked_dog_ids: ['dog_1'],
        deleted_at: null,
        date: aprilTs,
      },
    ])
    seedCollection('incomes', [
      {
        _id: 'income_unlinked',
        family_id: familyId,
        type: '其他',
        amount: 500,
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'income_linked',
        family_id: familyId,
        dog_id: 'dog_1',
        type: '销售',
        amount: 3000,
        deleted_at: null,
        date: aprilTs,
      },
    ])

    const result = await financeService.getTransactionList.call(ctx, {
      type: '',
      unlinkedOnly: true,
      dogIds: ['dog_1'],
      year: 2026,
      month: 4,
    })

    expect(result.data.map((item: any) => item._id)).toEqual(['exp_unlinked', 'income_unlinked'])
  })

  it('汇总应与多选筛选条件保持一致', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('expenses', [
      {
        _id: 'exp_medical',
        family_id: familyId,
        category: '医疗',
        total_amount: 500,
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'exp_food',
        family_id: familyId,
        category: '食品',
        total_amount: 200,
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'exp_transport',
        family_id: familyId,
        category: '交通',
        total_amount: 100,
        deleted_at: null,
        date: aprilTs,
      },
    ])
    seedCollection('incomes', [
      {
        _id: 'income_sale',
        family_id: familyId,
        dog_id: 'dog_1',
        type: '销售',
        amount: 3000,
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'income_keep',
        family_id: familyId,
        dog_id: 'dog_2',
        type: '定金保留',
        amount: 1000,
        deleted_at: null,
        date: aprilTs,
      },
    ])

    const result = await financeService.getFinancialSummary.call(ctx, {
      period: 'monthly',
      year: 2026,
      month: 4,
      incomeTypes: ['销售'],
      expenseCategoryGroups: ['health'],
      expenseCategories: ['食品'],
    })

    expect(result.data.totalIncome).toBe(3000)
    expect(result.data.totalExpense).toBe(700)
    expect(result.data.categoryBreakdown).toEqual({
      医疗健康: 500,
      喂养营养: 200,
    })
    expect(result.data.incomeBreakdown).toEqual({
      销售: 3000,
    })
  })

  it('单窝利润应避免同一笔生产费用在周期和窝级别重复统计', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('litters', [{
      _id: 'litter_1',
      family_id: familyId,
      cycle_id: 'cycle_1',
      dam_name: '花花',
    }])
    seedCollection('dogs', [
      { _id: 'puppy_1', name: '幼崽1', family_id: familyId, origin_litter_id: 'litter_1', gender: '公', disposition: '正常', deleted_at: null },
      { _id: 'puppy_2', name: '幼崽2', family_id: familyId, origin_litter_id: 'litter_1', gender: '母', disposition: '正常', deleted_at: null },
    ])
    seedCollection('sale_records', [])
    seedCollection('incomes', [])
    seedCollection('expenses', [{
      _id: 'expense_birth',
      family_id: familyId,
      total_amount: 1500,
      notes: '生产',
      linked_cycle_id: 'cycle_1',
      linked_litter_id: 'litter_1',
      deleted_at: null,
    }])

    const result = await financeService.getLitterProfit.call(ctx, { litter_id: 'litter_1' })

    expect(result.data.totalExpense).toBe(1500)
    expect(result.data.breedingCosts).toEqual([])
    expect(result.data.litterCosts).toEqual([
      expect.objectContaining({
        id: 'expense_birth',
        name: '生产',
        amount: 1500,
      }),
    ])
    expect(result.data.incomeItems).toEqual([
      expect.objectContaining({ id: 'puppy_1', gender: '公', status: 'pending' }),
      expect.objectContaining({ id: 'puppy_2', gender: '母', status: 'pending' }),
    ])
  })

  it('getDamRoi 别名调用应兼容 dog_id 入参', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('breeding_cycles', [])
    seedCollection('litters', [])

    const result = await financeService.getDamRoi.call(ctx, {
      dog_id: 'dog_1',
    })

    expect(result.data).toMatchObject({
      damId: 'dog_1',
      damName: '花花',
      totalBreedingIncome: 0,
      totalBreedingCost: 0,
      healthCost: 0,
      netProfit: 0,
      roiPercent: 0,
    })
  })
})
