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

  it('addExpenseCategoryGroup 应支持 _sync 幂等重放并保留客户端 key', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    seedCollection('families', [{
      _id: familyId,
      name: '测试犬舍',
      version: 1,
      settings: {
        custom_expense_categories: [],
        custom_expense_category_groups: [],
      },
    }])

    const payload = {
      key: 'custom_local_group_1',
      label: '美容护理',
      _sync: {
        clientMutationId: 'expense-group-sync-1',
        deviceId: 'device_1',
        clientTimestamp: aprilTs,
        baseVersions: { [familyId]: 1 },
      },
    }

    const first = await financeService.addExpenseCategoryGroup.call(ctx, payload)
    const second = await financeService.addExpenseCategoryGroup.call(ctx, payload)

    expect(first.ack).toBe('accepted')
    expect(second).toEqual(first)
    expect(first.data.key).toBe('custom_local_group_1')

    const { data } = await db.collection('families').doc(familyId).get()
    expect(data[0].settings.custom_expense_category_groups).toEqual([
      { key: 'custom_local_group_1', label: '美容护理' },
    ])
    expect(data[0].version).toBe(2)
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

  it('updateExpenseCategory 应支持 _sync 幂等重放并同步本地账单分类名', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    seedCollection('families', [{
      _id: familyId,
      name: '测试犬舍',
      version: 2,
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
      version: 1,
      deleted_at: null,
      date: aprilTs,
    }])

    const payload = {
      oldName: '洗护',
      newName: '洗澡美容',
      parentGroup: 'beauty',
      _sync: {
        clientMutationId: 'expense-category-sync-1',
        deviceId: 'device_1',
        clientTimestamp: aprilTs,
        baseVersions: { [familyId]: 2 },
      },
    }

    const first = await financeService.updateExpenseCategory.call(ctx, payload)
    const second = await financeService.updateExpenseCategory.call(ctx, payload)

    expect(first.ack).toBe('accepted')
    expect(second).toEqual(first)
    expect(first.touchedEntities).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: 'families', id: familyId }),
      expect.objectContaining({ collection: 'expenses', id: 'exp_beauty' }),
    ]))

    const { data: familyRows } = await db.collection('families').doc(familyId).get()
    expect(familyRows[0].settings.custom_expense_categories).toEqual([
      { name: '洗澡美容', parent_group: 'beauty' },
    ])
    expect(familyRows[0].version).toBe(3)

    const { data: expenses } = await db.collection('expenses').doc('exp_beauty').get()
    expect(expenses[0].category).toBe('洗澡美容')
  })

  it('removeExpenseCategoryGroup 在 baseVersion 过期时应返回 conflict', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    seedCollection('families', [{
      _id: familyId,
      name: '测试犬舍',
      version: 4,
      settings: {
        custom_expense_category_groups: [{ key: 'beauty', label: '美容护理' }],
        custom_expense_categories: [],
      },
    }])

    const result = await financeService.removeExpenseCategoryGroup.call(ctx, {
      key: 'beauty',
      _sync: {
        clientMutationId: 'expense-group-conflict-1',
        deviceId: 'device_1',
        clientTimestamp: aprilTs,
        baseVersions: { [familyId]: 3 },
      },
    })

    expect(result.ack).toBe('conflict')
    expect(result.conflict).toEqual(expect.objectContaining({
      collection: 'families',
      entityId: familyId,
      baseVersion: 3,
      serverVersion: 4,
    }))
  })

  it('updateExpense 应支持 _sync 幂等重放', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    seedCollection('expenses', [{
      _id: 'exp_sync_1',
      family_id: familyId,
      total_amount: 120,
      category: '食品',
      date: aprilTs,
      linked_cycle_id: null,
      linked_litter_id: null,
      linked_dog_ids: ['dog_1'],
      dog_names: ['花花'],
      images: [],
      notes: null,
      source_type: 'manual',
      deleted_at: null,
      version: 1,
    }])

    const payload = {
      id: 'exp_sync_1',
      total_amount: 188,
      category: '医疗',
      date: aprilTs + 1000,
      linked_dog_ids: ['dog_2'],
      dog_names: ['可可'],
      images: ['img://1'],
      notes: '复查',
      _sync: {
        clientMutationId: 'finance-update-expense-1',
        deviceId: 'device_1',
        clientTimestamp: aprilTs,
        baseVersions: { exp_sync_1: 1 },
      },
    }

    const first = await financeService.updateExpense.call(ctx, payload)
    const second = await financeService.updateExpense.call(ctx, payload)

    expect(first.ack).toBe('accepted')
    expect(second).toEqual(first)

    const { data } = await db.collection('expenses').doc('exp_sync_1').get()
    expect(data[0]).toMatchObject({
      total_amount: 188,
      category: '医疗',
      linked_dog_ids: ['dog_2'],
      dog_names: ['可可'],
      notes: '复查',
      version: 2,
    })
  })

  it('updateIncome 应支持 _sync 幂等重放', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    seedCollection('incomes', [{
      _id: 'income_sync_1',
      family_id: familyId,
      dog_id: 'dog_1',
      dog_name: '花花',
      type: '销售',
      amount: 800,
      date: aprilTs,
      source_sale_id: null,
      notes: null,
      deleted_at: null,
      version: 1,
    }])

    const payload = {
      id: 'income_sync_1',
      amount: 960,
      type: '领养',
      dog_id: 'dog_2',
      dog_name: '可可',
      date: aprilTs + 1000,
      notes: '改为领养款',
      _sync: {
        clientMutationId: 'finance-update-income-1',
        deviceId: 'device_1',
        clientTimestamp: aprilTs,
        baseVersions: { income_sync_1: 1 },
      },
    }

    const first = await financeService.updateIncome.call(ctx, payload)
    const second = await financeService.updateIncome.call(ctx, payload)

    expect(first.ack).toBe('accepted')
    expect(second).toEqual(first)

    const { data } = await db.collection('incomes').doc('income_sync_1').get()
    expect(data[0]).toMatchObject({
      amount: 960,
      type: '领养',
      dog_id: 'dog_2',
      dog_name: '可可',
      notes: '改为领养款',
      version: 2,
    })
  })

  it('自动收入不可从财务入口编辑或删除', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    seedCollection('incomes', [{
      _id: 'income_auto_guard_1',
      family_id: familyId,
      dog_id: 'dog_1',
      dog_name: '花花',
      type: '领养',
      amount: 800,
      date: aprilTs,
      source_sale_id: null,
      source_type: 'auto',
      source_record_id: 'dog_1',
      deleted_at: null,
      version: 1,
    }])

    await expect(financeService.updateIncome.call(ctx, {
      id: 'income_auto_guard_1',
      amount: 900,
      type: '领养',
      date: aprilTs,
    })).rejects.toThrow('自动生成的收入不可编辑')
    await expect(financeService.deleteIncome.call(ctx, {
      id: 'income_auto_guard_1',
    })).rejects.toThrow('自动生成的收入不可删除')
  })

  it('deleteExpense 应支持 _sync 幂等重放', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    seedCollection('expenses', [{
      _id: 'exp_delete_sync_1',
      family_id: familyId,
      total_amount: 88,
      category: '交通',
      date: aprilTs,
      source_type: 'manual',
      deleted_at: null,
      version: 2,
    }])

    const payload = {
      id: 'exp_delete_sync_1',
      _sync: {
        clientMutationId: 'finance-delete-expense-1',
        deviceId: 'device_1',
        clientTimestamp: aprilTs,
        baseVersions: { exp_delete_sync_1: 2 },
      },
    }

    const first = await financeService.deleteExpense.call(ctx, payload)
    const second = await financeService.deleteExpense.call(ctx, payload)

    expect(first.ack).toBe('accepted')
    expect(second).toEqual(first)

    const { data } = await db.collection('expenses').doc('exp_delete_sync_1').get()
    expect(data[0].deleted_at).toBeTruthy()
    expect(data[0].version).toBe(3)
  })

  it('deleteIncome 在 baseVersion 过期时应返回 conflict', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    seedCollection('incomes', [{
      _id: 'income_delete_sync_1',
      family_id: familyId,
      dog_id: 'dog_1',
      dog_name: '花花',
      type: '其他',
      amount: 66,
      date: aprilTs,
      source_sale_id: null,
      deleted_at: null,
      version: 3,
    }])

    const result = await financeService.deleteIncome.call(ctx, {
      id: 'income_delete_sync_1',
      _sync: {
        clientMutationId: 'finance-delete-income-conflict-1',
        deviceId: 'device_1',
        clientTimestamp: aprilTs,
        baseVersions: { income_delete_sync_1: 2 },
      },
    })

    expect(result.ack).toBe('conflict')
    expect(result.conflict).toEqual(expect.objectContaining({
      collection: 'incomes',
      entityId: 'income_delete_sync_1',
      baseVersion: 2,
      serverVersion: 3,
    }))
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

  it('历史收入类型应按当前口径归一后参与筛选、统计与详情展示', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('incomes', [
      {
        _id: 'income_deposit_legacy',
        family_id: familyId,
        dog_id: 'dog_1',
        type: '定金',
        amount: 500,
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'income_adoption_legacy',
        family_id: familyId,
        dog_id: 'dog_2',
        type: '领养费',
        amount: 800,
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'income_service_legacy',
        family_id: familyId,
        type: '配种费收入',
        amount: 300,
        deleted_at: null,
        date: aprilTs,
      },
    ])

    const listResult = await financeService.getTransactionList.call(ctx, {
      type: 'income',
      incomeTypes: ['定金保留', '领养', '其他'],
      year: 2026,
      month: 4,
    })
    const summaryResult = await financeService.getFinancialSummary.call(ctx, {
      period: 'monthly',
      year: 2026,
      month: 4,
      incomeTypes: ['定金保留', '领养', '其他'],
    })
    const detailResult = await financeService.getIncomeDetail.call(ctx, { id: 'income_adoption_legacy' })

    expect(listResult.data.map((item: any) => item.type).sort()).toEqual(['定金保留', '领养', '其他'].sort())
    expect(summaryResult.data.incomeBreakdown).toEqual({
      定金保留: 500,
      领养: 800,
      其他: 300,
    })
    expect(detailResult.data).toMatchObject({
      type: '领养',
      type_label: '领养',
    })
  })

  it('退款应作为独立收入类型参与筛选与统计', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

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
        _id: 'income_refund',
        family_id: familyId,
        dog_id: 'dog_1',
        type: '退款',
        amount: -600,
        deleted_at: null,
        date: aprilTs,
      },
    ])

    const listResult = await financeService.getTransactionList.call(ctx, {
      type: 'income',
      incomeTypes: ['退款'],
      year: 2026,
      month: 4,
    })
    const summaryResult = await financeService.getFinancialSummary.call(ctx, {
      period: 'monthly',
      year: 2026,
      month: 4,
      incomeTypes: ['退款'],
    })

    expect(listResult.data).toHaveLength(1)
    expect(listResult.data[0]).toMatchObject({
      _id: 'income_refund',
      type: '退款',
    })
    expect(summaryResult.data).toMatchObject({
      totalIncome: -600,
      incomeBreakdown: {
        退款: -600,
      },
    })
  })

  it('历史细粒度自动支出分类应按稳定财务分类参与筛选、统计与详情展示', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('expenses', [
      {
        _id: 'exp_vaccine_legacy',
        family_id: familyId,
        category: '疫苗',
        total_amount: 200,
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'exp_pregnancy_legacy',
        family_id: familyId,
        category: '孕检',
        total_amount: 300,
        deleted_at: null,
        date: aprilTs,
      },
      {
        _id: 'exp_birth_legacy',
        family_id: familyId,
        category: '生产',
        total_amount: 500,
        deleted_at: null,
        date: aprilTs,
      },
    ])

    const listResult = await financeService.getTransactionList.call(ctx, {
      type: 'expense',
      expenseCategories: ['疫苗驱虫', '孕检产检', '生产育幼'],
      year: 2026,
      month: 4,
    })
    const summaryResult = await financeService.getFinancialSummary.call(ctx, {
      period: 'monthly',
      year: 2026,
      month: 4,
      expenseCategories: ['疫苗驱虫', '孕检产检', '生产育幼'],
    })
    const detailResult = await financeService.getExpenseDetail.call(ctx, { id: 'exp_pregnancy_legacy' })

    expect(listResult.data.map((item: any) => item.category).sort()).toEqual(['疫苗驱虫', '孕检产检', '生产育幼'].sort())
    expect(summaryResult.data.categoryBreakdown).toEqual({
      医疗健康: 200,
      繁育投入: 800,
    })
    expect(detailResult.data).toMatchObject({
      category: '孕检产检',
      category_group_label: '繁育投入',
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

  it('单窝利润应按后补幼崽纠偏窝出生与存活统计', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('litters', [{
      _id: 'litter_count_fix',
      family_id: familyId,
      cycle_id: 'cycle_count_fix',
      dam_name: '肉肉',
      total_born: 3,
      born_alive: 3,
    }])
    seedCollection('dogs', [
      { _id: 'puppy_count_fix_1', name: '幼崽1', family_id: familyId, origin_litter_id: 'litter_count_fix', gender: '公', disposition: '正常', deleted_at: null },
      { _id: 'puppy_count_fix_2', name: '幼崽2', family_id: familyId, origin_litter_id: 'litter_count_fix', gender: '母', disposition: '正常', deleted_at: null },
      { _id: 'puppy_count_fix_3', name: '幼崽3', family_id: familyId, origin_litter_id: 'litter_count_fix', gender: '母', disposition: '正常', deleted_at: null },
      { _id: 'puppy_count_fix_4', name: '幼崽4', family_id: familyId, origin_litter_id: 'litter_count_fix', gender: '母', disposition: '正常', deleted_at: null },
      { _id: 'puppy_count_fix_deleted', name: '已删除幼崽', family_id: familyId, origin_litter_id: 'litter_count_fix', gender: '母', disposition: '正常', deleted_at: Date.now() },
    ])
    seedCollection('sale_records', [])
    seedCollection('incomes', [])
    seedCollection('expenses', [])

    const result = await financeService.getLitterProfit.call(ctx, { litter_id: 'litter_count_fix' })

    expect(result.data).toMatchObject({
      puppyCount: 4,
      totalPuppyCount: 4,
      aliveCount: 4,
      litter: {
        total_born: 4,
        born_alive: 4,
      },
    })
    expect(result.data.incomeItems).toHaveLength(4)
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

  it('addIncome 应支持 _sync 稳定 ID 与幂等重放', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    const payload = {
      amount: 1888,
      type: '销售',
      dog_id: 'dog_1',
      dog_name: '花花',
      date: aprilTs,
      _sync: {
        clientMutationId: 'income-sync-1',
        deviceId: 'device_1',
        clientTimestamp: aprilTs,
        clientEntityIds: { incomes: 'income_client_1' },
      },
    }

    const first = await financeService.addIncome.call(ctx, payload)
    const second = await financeService.addIncome.call(ctx, payload)

    expect(first.ack).toBe('accepted')
    expect(second).toEqual(first)
    expect(first.data.incomeId).toBe('income_client_1')

    const { data: incomes } = await db.collection('incomes')
      .where({ _id: 'income_client_1', family_id: familyId })
      .get()
    expect(incomes).toHaveLength(1)
    expect(incomes[0]).toMatchObject({
      amount: 1888,
      type: '销售',
    })
  })

  it('createSaleRecord 应支持 _sync 稳定 ID 与幂等重放', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    seedCollection('dogs', [{
      _id: 'puppy_sale_1',
      name: '奶油',
      role: '幼崽',
      disposition: '在养',
      family_id: familyId,
      deleted_at: null,
    }])

    const payload = {
      dog_id: 'puppy_sale_1',
      floor_price: 2888,
      buyer_info: '张三',
      _sync: {
        clientMutationId: 'sale-sync-1',
        deviceId: 'device_1',
        clientTimestamp: aprilTs,
        clientEntityIds: { sale_records: 'sale_client_1' },
        baseVersions: { puppy_sale_1: 0 },
      },
    }

    const first = await financeService.createSaleRecord.call(ctx, payload)
    const second = await financeService.createSaleRecord.call(ctx, payload)

    expect(first.ack).toBe('accepted')
    expect(second).toEqual(first)
    expect(first.data.saleId).toBe('sale_client_1')

    const { data: sales } = await db.collection('sale_records')
      .where({ _id: 'sale_client_1', family_id: familyId })
      .get()
    expect(sales).toHaveLength(1)
    expect(sales[0]).toMatchObject({
      dog_id: 'puppy_sale_1',
      status: '待售',
      sale_mode: null,
      floor_price: 2888,
    })

    const { data: dogs } = await db.collection('dogs').doc('puppy_sale_1').get()
    expect(dogs[0].disposition).toBe('待售')
  })

  it('updateSaleMode 应支持 _sync 幂等、冲突与非法值校验', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    seedCollection('sale_records', [{
      _id: 'sale_mode_1',
      family_id: familyId,
      dog_id: 'puppy_sale_mode_1',
      dog_name: '奶油',
      status: '待售',
      sale_mode: null,
      deleted_at: null,
      version: 1,
    }, {
      _id: 'sale_mode_refunded',
      family_id: familyId,
      dog_id: 'puppy_sale_mode_2',
      dog_name: '奶糖',
      status: '已退款',
      sale_mode: '自售',
      deleted_at: null,
      version: 0,
    }])

    const payload = {
      saleId: 'sale_mode_1',
      sale_mode: '代理',
      _sync: {
        clientMutationId: 'sale-mode-sync-1',
        deviceId: 'device_1',
        clientTimestamp: aprilTs,
        baseVersions: { sale_mode_1: 1 },
      },
    }
    const first = await financeService.updateSaleMode.call(ctx, payload)
    const second = await financeService.updateSaleMode.call(ctx, payload)

    expect(first.ack).toBe('accepted')
    expect(second).toEqual(first)
    const { data: sales } = await db.collection('sale_records').doc('sale_mode_1').get()
    expect(sales[0]).toMatchObject({
      sale_mode: '代理',
      version: 2,
    })

    await expect(financeService.updateSaleMode.call(ctx, {
      saleId: 'sale_mode_1',
      sale_mode: '未知',
    })).rejects.toThrow('销售方式不合法')
    await expect(financeService.updateSaleMode.call(ctx, {
      saleId: 'sale_mode_refunded',
      sale_mode: '代卖',
    })).rejects.toThrow('当前状态不可修改销售方式')

    const conflict = await financeService.updateSaleMode.call(ctx, {
      saleId: 'sale_mode_1',
      sale_mode: null,
      _sync: {
        clientMutationId: 'sale-mode-sync-conflict',
        deviceId: 'device_1',
        clientTimestamp: aprilTs,
        baseVersions: { sale_mode_1: 1 },
      },
    })
    expect(conflict).toMatchObject({
      ack: 'conflict',
      conflict: {
        collection: 'sale_records',
        entityId: 'sale_mode_1',
        baseVersion: 1,
        serverVersion: 2,
      },
    })
  })

  it('receiveSaleDeposit 和 completeSale 应支持更新或保留销售方式', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    seedCollection('dogs', [{
      _id: 'puppy_sale_mode_flow_1',
      name: '奶油',
      role: '幼崽',
      disposition: '待售',
      family_id: familyId,
      deleted_at: null,
      version: 0,
    }, {
      _id: 'puppy_sale_mode_flow_2',
      name: '奶糖',
      role: '幼崽',
      disposition: '待售',
      family_id: familyId,
      deleted_at: null,
      version: 0,
    }])
    seedCollection('sale_records', [{
      _id: 'sale_mode_deposit_cloud',
      family_id: familyId,
      dog_id: 'puppy_sale_mode_flow_1',
      dog_name: '奶油',
      status: '待售',
      sale_mode: null,
      deleted_at: null,
      version: 0,
    }, {
      _id: 'sale_mode_complete_cloud',
      family_id: familyId,
      dog_id: 'puppy_sale_mode_flow_2',
      dog_name: '奶糖',
      status: '待售',
      sale_mode: '自售',
      deleted_at: null,
      version: 0,
    }])

    await financeService.receiveSaleDeposit.call(ctx, {
      saleId: 'sale_mode_deposit_cloud',
      deposit_amount: 500,
      sale_mode: '代卖',
    })
    await financeService.completeSale.call(ctx, {
      saleId: 'sale_mode_complete_cloud',
      received_amount: '',
    })

    await expect(db.collection('sale_records').doc('sale_mode_deposit_cloud').get()).resolves.toMatchObject({
      data: [expect.objectContaining({ sale_mode: '代卖', status: '已预定' })],
    })
    await expect(db.collection('sale_records').doc('sale_mode_complete_cloud').get()).resolves.toMatchObject({
      data: [expect.objectContaining({ sale_mode: '自售', status: '已成交' })],
    })
  })

  it('cancelSale 应校验退款金额不超过已结算到手价', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    seedCollection('dogs', [{
      _id: 'puppy_refund_1',
      name: '奶油',
      role: '幼崽',
      disposition: '已售',
      family_id: familyId,
      deleted_at: null,
    }])
    seedCollection('sale_records', [{
      _id: 'sale_refund_unsettled',
      family_id: familyId,
      dog_id: 'puppy_refund_1',
      dog_name: '奶油',
      status: '已成交',
      received_amount: null,
      deleted_at: null,
      version: 0,
    }, {
      _id: 'sale_refund_settled',
      family_id: familyId,
      dog_id: 'puppy_refund_1',
      dog_name: '奶油',
      status: '已成交',
      received_amount: 1000,
      deleted_at: null,
      version: 0,
    }])

    await expect(financeService.cancelSale.call(ctx, {
      saleId: 'sale_refund_unsettled',
      refund_amount: 100,
    })).rejects.toThrow('未结算成交请先补录结算')
    await expect(financeService.cancelSale.call(ctx, {
      saleId: 'sale_refund_settled',
      refund_amount: 1200,
    })).rejects.toThrow('退款金额不能超过到手价')
  })

  it('cancelSale 应校验保留定金不能超过原定金', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    seedCollection('dogs', [{
      _id: 'puppy_deposit_cancel_1',
      name: '奶油',
      role: '幼崽',
      disposition: '已预定',
      family_id: familyId,
      deleted_at: null,
    }])
    seedCollection('sale_records', [{
      _id: 'sale_deposit_cancel_1',
      family_id: familyId,
      dog_id: 'puppy_deposit_cancel_1',
      dog_name: '奶油',
      status: '已预定',
      deposit_amount: 500,
      deleted_at: null,
      version: 0,
    }])

    await expect(financeService.cancelSale.call(ctx, {
      saleId: 'sale_deposit_cancel_1',
      deposit_kept_amount: 600,
    })).rejects.toThrow('保留定金不能超过定金总额')
  })

  it('addAgent 与 removeAgent 应支持 _sync 幂等重放', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    const addPayload = {
      name: '代理小王',
      contact_info: 'wx-001',
      _sync: {
        clientMutationId: 'agent-sync-add-1',
        deviceId: 'device_1',
        clientTimestamp: aprilTs,
        clientEntityIds: { agents: 'agent_client_1' },
      },
    }

    const firstAdd = await financeService.addAgent.call(ctx, addPayload)
    const secondAdd = await financeService.addAgent.call(ctx, addPayload)
    expect(firstAdd.ack).toBe('accepted')
    expect(secondAdd).toEqual(firstAdd)

    const removePayload = {
      id: 'agent_client_1',
      _sync: {
        clientMutationId: 'agent-sync-remove-1',
        deviceId: 'device_1',
        clientTimestamp: aprilTs,
        baseVersions: { agent_client_1: 1 },
      },
    }
    const firstRemove = await financeService.removeAgent.call(ctx, removePayload)
    const secondRemove = await financeService.removeAgent.call(ctx, removePayload)
    expect(firstRemove.ack).toBe('accepted')
    expect(secondRemove).toEqual(firstRemove)

    const { data: agents } = await db.collection('agents').doc('agent_client_1').get()
    expect(agents[0].deleted_at).toBeTruthy()
  })
})
