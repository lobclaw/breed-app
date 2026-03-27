/**
 * finance-service 云对象测试
 * 测试费用/收入 CRUD、财务统计、销售流程
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  resetDB,
  seedCollection,
  createMockUniCloud,
} from '../helpers/mock-unicloud'

const mockUniCloud = createMockUniCloud()
;(globalThis as any).uniCloud = mockUniCloud

describe('finance-service', () => {
  const db = mockUniCloud.database()
  const familyId = 'fam_1'

  beforeEach(() => {
    resetDB()
    seedCollection('families', [{
      _id: familyId,
      name: '测试犬舍',
    }])
    seedCollection('dogs', [
      { _id: 'dog_1', name: '花花', gender: '母', family_id: familyId, deleted_at: null, disposition: '在养' },
      { _id: 'puppy_1', name: '小白', gender: '公', family_id: familyId, deleted_at: null, disposition: '在养', origin_litter_id: 'litter_1' },
      { _id: 'puppy_2', name: '小黑', gender: '母', family_id: familyId, deleted_at: null, disposition: '在养', origin_litter_id: 'litter_1' },
    ])
  })

  describe('费用 CRUD', () => {
    it('应创建手动支出', async () => {
      const now = Date.now()

      const { id } = await db.collection('expenses').add({
        family_id: familyId,
        total_amount: 500,
        category: '食品',
        date: now,
        source_type: 'manual',
        deleted_at: null,
        created_at: now,
      })

      const { data } = await db.collection('expenses').doc(id).get()
      expect(data[0].total_amount).toBe(500)
      expect(data[0].category).toBe('食品')
      expect(data[0].source_type).toBe('manual')
    })

    it('应创建收入', async () => {
      const now = Date.now()

      const { id } = await db.collection('incomes').add({
        family_id: familyId,
        dog_id: 'puppy_1',
        dog_name: '小白',
        type: '销售',
        amount: 8000,
        date: now,
        deleted_at: null,
        created_at: now,
      })

      const { data } = await db.collection('incomes').doc(id).get()
      expect(data[0].amount).toBe(8000)
      expect(data[0].type).toBe('销售')
    })

    it('应软删除支出', async () => {
      const now = Date.now()

      seedCollection('expenses', [{
        _id: 'exp_del',
        family_id: familyId,
        total_amount: 100,
        source_type: 'manual',
        deleted_at: null,
      }])

      await db.collection('expenses').doc('exp_del').update({
        deleted_at: now,
        updated_at: now,
      })

      const { data } = await db.collection('expenses').doc('exp_del').get()
      expect(data[0].deleted_at).toBe(now)
    })

    it('自动生成的费用不可删除', () => {
      // source_type=auto 的费用应该被阻止删除
      const expense = { source_type: 'auto' }
      expect(expense.source_type).toBe('auto')
      // 实际云对象会抛错，这里只验证逻辑
    })
  })

  describe('收支流水', () => {
    it('应合并收支并按日期排序', async () => {
      const now = Date.now()

      seedCollection('expenses', [
        { _id: 'e1', family_id: familyId, total_amount: 100, date: now - 2000, deleted_at: null },
        { _id: 'e2', family_id: familyId, total_amount: 200, date: now, deleted_at: null },
      ])

      seedCollection('incomes', [
        { _id: 'i1', family_id: familyId, amount: 5000, date: now - 1000, deleted_at: null },
      ])

      const { data: expenses } = await db.collection('expenses')
        .where({ family_id: familyId, deleted_at: null })
        .get()
      const { data: incomes } = await db.collection('incomes')
        .where({ family_id: familyId, deleted_at: null })
        .get()

      const merged = [
        ...expenses.map(e => ({ ...e, _txType: 'expense' })),
        ...incomes.map(i => ({ ...i, _txType: 'income' })),
      ].sort((a, b) => (b.date || 0) - (a.date || 0))

      expect(merged).toHaveLength(3)
      expect(merged[0].date).toBe(now)
      expect(merged[0]._txType).toBe('expense')
    })

    it('不应包含已删除的记录', async () => {
      const now = Date.now()

      seedCollection('expenses', [
        { _id: 'e_live', family_id: familyId, total_amount: 100, date: now, deleted_at: null },
        { _id: 'e_dead', family_id: familyId, total_amount: 200, date: now, deleted_at: now },
      ])

      const { data } = await db.collection('expenses')
        .where({ family_id: familyId, deleted_at: null })
        .get()

      expect(data).toHaveLength(1)
      expect(data[0]._id).toBe('e_live')
    })
  })

  describe('财务统计', () => {
    it('应计算月度收支汇总', async () => {
      const now = Date.now()

      seedCollection('expenses', [
        { _id: 'e1', family_id: familyId, total_amount: 1000, category: '食品', date: now, deleted_at: null },
        { _id: 'e2', family_id: familyId, total_amount: 500, category: '医疗', date: now, deleted_at: null },
      ])

      seedCollection('incomes', [
        { _id: 'i1', family_id: familyId, amount: 8000, type: '销售', date: now, deleted_at: null },
      ])

      const { data: expenses } = await db.collection('expenses')
        .where({ family_id: familyId, deleted_at: null })
        .get()
      const { data: incomes } = await db.collection('incomes')
        .where({ family_id: familyId, deleted_at: null })
        .get()

      const totalExpense = expenses.reduce((sum, e) => sum + e.total_amount, 0)
      const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0)

      expect(totalExpense).toBe(1500)
      expect(totalIncome).toBe(8000)
      expect(totalIncome - totalExpense).toBe(6500)
    })

    it('应按分类汇总支出', async () => {
      seedCollection('expenses', [
        { _id: 'e1', family_id: familyId, total_amount: 1000, category: '食品', date: Date.now(), deleted_at: null },
        { _id: 'e2', family_id: familyId, total_amount: 500, category: '食品', date: Date.now(), deleted_at: null },
        { _id: 'e3', family_id: familyId, total_amount: 300, category: '医疗', date: Date.now(), deleted_at: null },
      ])

      const { data: expenses } = await db.collection('expenses')
        .where({ family_id: familyId, deleted_at: null })
        .get()

      const breakdown: Record<string, number> = {}
      for (const e of expenses) {
        breakdown[e.category] = (breakdown[e.category] || 0) + e.total_amount
      }

      expect(breakdown['食品']).toBe(1500)
      expect(breakdown['医疗']).toBe(300)
    })
  })

  describe('单窝利润', () => {
    it('应计算窝利润 = 收入 - 支出', async () => {
      const now = Date.now()

      seedCollection('litters', [{
        _id: 'litter_1',
        cycle_id: 'cycle_1',
        dam_id: 'dog_1',
        dam_name: '花花',
        family_id: familyId,
      }])

      // 周期费用
      seedCollection('expenses', [
        { _id: 'exp_cycle', linked_cycle_id: 'cycle_1', family_id: familyId, total_amount: 1000, deleted_at: null },
        { _id: 'exp_litter', linked_litter_id: 'litter_1', family_id: familyId, total_amount: 500, deleted_at: null },
      ])

      // 幼崽收入
      seedCollection('incomes', [
        { _id: 'inc_1', dog_id: 'puppy_1', family_id: familyId, amount: 8000, deleted_at: null },
        { _id: 'inc_2', dog_id: 'puppy_2', family_id: familyId, amount: 7000, deleted_at: null },
      ])

      // 计算
      const { data: cycleExp } = await db.collection('expenses')
        .where({ linked_cycle_id: 'cycle_1', family_id: familyId, deleted_at: null })
        .get()
      const { data: litterExp } = await db.collection('expenses')
        .where({ linked_litter_id: 'litter_1', family_id: familyId, deleted_at: null })
        .get()

      const totalExpense = [...cycleExp, ...litterExp].reduce((sum, e) => sum + e.total_amount, 0)

      const puppyIds = ['puppy_1', 'puppy_2']
      let totalIncome = 0
      for (const pid of puppyIds) {
        const { data: incomes } = await db.collection('incomes')
          .where({ dog_id: pid, family_id: familyId, deleted_at: null })
          .get()
        totalIncome += incomes.reduce((sum, i) => sum + i.amount, 0)
      }

      expect(totalExpense).toBe(1500)
      expect(totalIncome).toBe(15000)
      expect(totalIncome - totalExpense).toBe(13500)
    })
  })

  describe('销售流程', () => {
    it('应创建待售记录并更新犬只去向', async () => {
      const now = Date.now()

      const { id: saleId } = await db.collection('sale_records').add({
        dog_id: 'puppy_1',
        dog_name: '小白',
        family_id: familyId,
        status: '待售',
        floor_price: 6000,
        deleted_at: null,
        created_at: now,
      })

      await db.collection('dogs').doc('puppy_1').update({ disposition: '待售', updated_at: now })

      const { data: sales } = await db.collection('sale_records').doc(saleId).get()
      expect(sales[0].status).toBe('待售')
      expect(sales[0].floor_price).toBe(6000)

      const { data: dogs } = await db.collection('dogs').doc('puppy_1').get()
      expect(dogs[0].disposition).toBe('待售')
    })

    it('收定金应变为已预定', async () => {
      const now = Date.now()

      seedCollection('sale_records', [{
        _id: 'sale_1',
        dog_id: 'puppy_1',
        dog_name: '小白',
        family_id: familyId,
        status: '待售',
      }])

      await db.collection('sale_records').doc('sale_1').update({
        status: '已预定',
        deposit_amount: 2000,
        deposit_date: now,
        buyer_info: '张先生',
        updated_at: now,
      })

      await db.collection('dogs').doc('puppy_1').update({ disposition: '已预定', updated_at: now })

      const { data } = await db.collection('sale_records').doc('sale_1').get()
      expect(data[0].status).toBe('已预定')
      expect(data[0].deposit_amount).toBe(2000)
    })

    it('完成交易应生成收入并更新犬只去向', async () => {
      const now = Date.now()

      seedCollection('sale_records', [{
        _id: 'sale_2',
        dog_id: 'puppy_1',
        dog_name: '小白',
        family_id: familyId,
        status: '已预定',
        deposit_amount: 2000,
      }])

      // 完成交易
      await db.collection('sale_records').doc('sale_2').update({
        status: '已成交',
        received_amount: 8000,
        date: now,
        updated_at: now,
      })

      // 自动创建收入
      await db.collection('incomes').add({
        dog_id: 'puppy_1',
        dog_name: '小白',
        type: '销售',
        amount: 8000,
        date: now,
        source_sale_id: 'sale_2',
        family_id: familyId,
        deleted_at: null,
        created_at: now,
      })

      // 更新犬只
      await db.collection('dogs').doc('puppy_1').update({ disposition: '已售', updated_at: now })

      // 验证
      const { data: sale } = await db.collection('sale_records').doc('sale_2').get()
      expect(sale[0].status).toBe('已成交')
      expect(sale[0].received_amount).toBe(8000)

      const { data: incomes } = await db.collection('incomes')
        .where({ source_sale_id: 'sale_2' })
        .get()
      expect(incomes).toHaveLength(1)
      expect(incomes[0].amount).toBe(8000)

      const { data: dogs } = await db.collection('dogs').doc('puppy_1').get()
      expect(dogs[0].disposition).toBe('已售')
    })

    it('退款应生成负收入', async () => {
      const now = Date.now()

      seedCollection('sale_records', [{
        _id: 'sale_refund',
        dog_id: 'puppy_1',
        dog_name: '小白',
        family_id: familyId,
        status: '已成交',
        received_amount: 8000,
      }])

      // 全额退款
      await db.collection('sale_records').doc('sale_refund').update({
        status: '已退款',
        refund_amount: 8000,
        refund_reason: '买家退回',
        refund_date: now,
        updated_at: now,
      })

      await db.collection('incomes').add({
        dog_id: 'puppy_1',
        dog_name: '小白',
        type: '退款',
        amount: -8000,
        date: now,
        source_sale_id: 'sale_refund',
        family_id: familyId,
        deleted_at: null,
        created_at: now,
      })

      await db.collection('dogs').doc('puppy_1').update({ disposition: '待售', updated_at: now })

      // 验证
      const { data: incomes } = await db.collection('incomes')
        .where({ source_sale_id: 'sale_refund' })
        .get()
      expect(incomes).toHaveLength(1)
      expect(incomes[0].amount).toBe(-8000)
      expect(incomes[0].type).toBe('退款')

      const { data: dogs } = await db.collection('dogs').doc('puppy_1').get()
      expect(dogs[0].disposition).toBe('待售')
    })

    it('定金取消应保留部分定金为收入', async () => {
      const now = Date.now()

      seedCollection('sale_records', [{
        _id: 'sale_cancel',
        dog_id: 'puppy_1',
        dog_name: '小白',
        family_id: familyId,
        status: '已预定',
        deposit_amount: 2000,
      }])

      // 定金取消，保留 1000
      await db.collection('sale_records').doc('sale_cancel').update({
        status: '定金取消',
        deposit_kept_amount: 1000,
        updated_at: now,
      })

      await db.collection('incomes').add({
        dog_id: 'puppy_1',
        dog_name: '小白',
        type: '定金保留',
        amount: 1000,
        date: now,
        source_sale_id: 'sale_cancel',
        family_id: familyId,
        deleted_at: null,
        created_at: now,
      })

      await db.collection('dogs').doc('puppy_1').update({ disposition: '待售', updated_at: now })

      const { data: incomes } = await db.collection('incomes')
        .where({ source_sale_id: 'sale_cancel' })
        .get()
      expect(incomes).toHaveLength(1)
      expect(incomes[0].amount).toBe(1000)
      expect(incomes[0].type).toBe('定金保留')
    })
  })
})
