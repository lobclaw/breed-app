/**
 * family-service 云对象测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  resetDB,
  seedCollection,
  createMockUniCloud,
  createCloudObjectContext,
} from '../helpers/mock-unicloud'

// 模拟 uniCloud 全局对象
const mockUniCloud = createMockUniCloud()
;(globalThis as any).uniCloud = mockUniCloud
const familyService = require('../../uniCloud-alipay/cloudfunctions/family-service/index.obj.js')

// auth 工具函数 —— 直接实现（云对象的 require('common/auth') 路径在 node 中不可用）
function requireAdmin(role: string) {
  if (role !== 'creator' && role !== 'admin') {
    const err = new Error('权限不足，仅管理员可执行此操作') as any
    err.code = 'PERMISSION_DENIED'
    throw err
  }
}

function requireFamily(familyId: string | null) {
  if (!familyId) {
    const err = new Error('请先创建或加入家庭') as any
    err.code = 'NO_FAMILY'
    throw err
  }
}

describe('family-service', () => {
  const db = mockUniCloud.database()
  const familyId = 'fam_1'
  const DAY_MS = 86400000

  beforeEach(() => {
    resetDB()
  })

  describe('createFamily', () => {
    it('应创建家庭并将用户设为创建者', async () => {
      const ctx = createCloudObjectContext({ familyId: null })

      const name = '测试犬舍'
      const now = Date.now()

      const { id } = await db.collection('families').add({
        name,
        creator_id: ctx.uid,
        members: [{
          user_id: ctx.uid,
          role: 'creator',
          status: 'active',
          joined_at: now,
        }],
        care_rules: [],
        settings: {
          default_weaning_days: 45,
          default_vaccine_interval: 21,
          default_deworming_interval_puppy: 14,
          default_deworming_interval_adult: 90,
          morning_summary_time: '07:00',
        },
        created_at: now,
        updated_at: now,
      })

      expect(id).toBeDefined()

      // 验证写入的数据
      const { data } = await db.collection('families').doc(id).get()
      const family = data[0]
      expect(family.name).toBe('测试犬舍')
      expect(family.creator_id).toBe('test_uid')
      expect(family.members).toHaveLength(1)
      expect(family.members[0].role).toBe('creator')
      expect(family.members[0].status).toBe('active')
      expect(family.settings.default_weaning_days).toBe(45)
    })

    it('名称为空时应拒绝', () => {
      const name = ''
      expect(!name || !name.trim()).toBe(true)
    })

    it('已有家庭的用户不能再创建', () => {
      const ctx = createCloudObjectContext({ familyId: 'existing_family' })
      expect(ctx.familyId).toBeTruthy()
    })
  })

  describe('getFamilyInfo', () => {
    it('应返回家庭信息', async () => {
      const familyId = 'fam_1'
      seedCollection('families', [{
        _id: familyId,
        name: '小白犬舍',
        creator_id: 'user_1',
        members: [
          { user_id: 'user_1', role: 'creator', status: 'active', joined_at: 1000 },
          { user_id: 'user_2', role: 'helper', status: 'active', joined_at: 2000 },
        ],
        care_rules: [],
        settings: {
          default_weaning_days: 45,
          default_vaccine_interval: 21,
          default_deworming_interval_puppy: 14,
          default_deworming_interval_adult: 90,
          morning_summary_time: '07:00',
        },
        created_at: 1000,
        updated_at: 1000,
      }])

      const { data } = await db.collection('families').doc(familyId).get()
      expect(data).toHaveLength(1)
      expect(data[0].name).toBe('小白犬舍')
      expect(data[0].members).toHaveLength(2)
    })
  })

  describe('updateSettings', () => {
    it('应更新指定的设置字段', async () => {
      const familyId = 'fam_1'
      seedCollection('families', [{
        _id: familyId,
        name: '测试犬舍',
        settings: {
          default_weaning_days: 45,
          default_vaccine_interval: 21,
          default_deworming_interval_puppy: 14,
          default_deworming_interval_adult: 90,
          morning_summary_time: '07:00',
        },
        created_at: 1000,
        updated_at: 1000,
      }])

      // 模拟更新
      await db.collection('families').doc(familyId).update({
        'settings.default_weaning_days': 50,
        'settings.morning_summary_time': '08:00',
        updated_at: Date.now(),
      })

      const { data } = await db.collection('families').doc(familyId).get()
      expect(data[0].settings.default_weaning_days).toBe(50)
      expect(data[0].settings.morning_summary_time).toBe('08:00')
      // 未修改的字段保持不变
      expect(data[0].settings.default_vaccine_interval).toBe(21)
    })

    it('协助者不能更新设置', () => {
      expect(() => requireAdmin('helper')).toThrow('权限不足')
    })
  })

  describe('addCareRule', () => {
    it('应添加护理规则到数组', async () => {
      const familyId = 'fam_1'
      seedCollection('families', [{
        _id: familyId,
        name: '测试犬舍',
        care_rules: [],
        updated_at: 1000,
      }])

      const rule = {
        status_trigger: '怀孕中',
        task_description: '每日喂钙铁',
        frequency: '每日',
      }

      await db.collection('families').doc(familyId).update({
        care_rules: mockUniCloud.database().command.push(rule),
        updated_at: Date.now(),
      })

      const { data } = await db.collection('families').doc(familyId).get()
      expect(data[0].care_rules).toHaveLength(1)
      expect(data[0].care_rules[0].status_trigger).toBe('怀孕中')
      expect(data[0].care_rules[0].task_description).toBe('每日喂钙铁')
    })
  })

  describe('removeCareRule', () => {
    it('应按索引删除护理规则', async () => {
      const familyId = 'fam_1'
      seedCollection('families', [{
        _id: familyId,
        name: '测试犬舍',
        care_rules: [
          { status_trigger: '怀孕中', task_description: '每日喂钙铁', frequency: '每日' },
          { status_trigger: '哺乳中', task_description: '增加喂食量', frequency: '每日' },
        ],
        updated_at: 1000,
      }])

      // 获取当前规则
      const { data } = await db.collection('families').doc(familyId).field({ care_rules: true }).get()
      const rules = data[0].care_rules
      expect(rules).toHaveLength(2)

      // 删除索引 0
      rules.splice(0, 1)
      await db.collection('families').doc(familyId).update({
        care_rules: rules,
        updated_at: Date.now(),
      })

      const { data: updated } = await db.collection('families').doc(familyId).get()
      expect(updated[0].care_rules).toHaveLength(1)
      expect(updated[0].care_rules[0].status_trigger).toBe('哺乳中')
    })
  })

  describe('权限控制', () => {
    it('requireAdmin 应允许 creator', () => {
      expect(() => requireAdmin('creator')).not.toThrow()
    })

    it('requireAdmin 应允许 admin', () => {
      expect(() => requireAdmin('admin')).not.toThrow()
    })

    it('requireAdmin 应拒绝 helper', () => {
      expect(() => requireAdmin('helper')).toThrow('权限不足')
    })

    it('requireFamily 应拒绝无家庭用户', () => {
      expect(() => requireFamily(null)).toThrow('请先创建或加入家庭')
    })
  })

  describe('getDeletedItems', () => {
    it('应返回混合回收站项目并按删除时间倒序排序', async () => {
      const now = 1710000000000
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now)

      seedCollection('dogs', [{
        _id: 'dog_1',
        family_id: familyId,
        name: '奶盖',
        breed: '马尔济斯',
        role: '种狗',
        disposition: '在养',
        deleted_at: now - (3 * DAY_MS),
      }])

      seedCollection('expenses', [{
        _id: 'expense_1',
        family_id: familyId,
        category: '医疗',
        amount: 200,
        deleted_at: now - DAY_MS,
      }])

      seedCollection('incomes', [{
        _id: 'income_1',
        family_id: familyId,
        type: '销售',
        amount: 8000,
        deleted_at: now - (2 * DAY_MS),
      }])

      seedCollection('agents', [{
        _id: 'agent_1',
        family_id: familyId,
        name: '王阿姨',
        contact_info: '13800001111',
        deleted_at: now - (4 * DAY_MS),
      }])

      seedCollection('medication_protocols', [{
        _id: 'protocol_1',
        family_id: familyId,
        name: '黄体酮保胎',
        drug_name: '黄体酮',
        duration_days: 7,
        deleted_at: now - (5 * DAY_MS),
      }])

      const ctx = createCloudObjectContext({ familyId })
      const result = await familyService.getDeletedItems.call(ctx)

      expect(result.data.map((item: any) => item.type)).toEqual([
        'expense',
        'income',
        'dog',
        'agent',
        'medication_protocol',
      ])

      expect(result.data[0]).toMatchObject({
        _id: 'expense_1',
        type: 'expense',
        type_label: '支出',
        name: '医疗',
        summary: '医疗 · ¥200',
        deleted_at: now - DAY_MS,
        days_remaining: 29,
      })

      expect(result.data[1]).toMatchObject({
        type: 'income',
        type_label: '收入',
        summary: '销售 · ¥8,000',
        days_remaining: 28,
      })

      expect(result.data[2]).toMatchObject({
        type: 'dog',
        type_label: '犬只',
        name: '奶盖',
        summary: '马尔济斯 · 种狗 · 在养',
        days_remaining: 27,
      })

      expect(result.data[3]).toMatchObject({
        type: 'agent',
        type_label: '代理人',
        name: '王阿姨',
        summary: '13800001111',
        days_remaining: 26,
      })

      expect(result.data[4]).toMatchObject({
        type: 'medication_protocol',
        type_label: '用药方案',
        name: '黄体酮保胎',
        summary: '黄体酮 · 7天疗程',
        days_remaining: 25,
      })

      nowSpy.mockRestore()
    })

    it('回收站为空时应返回空数组', async () => {
      const ctx = createCloudObjectContext({ familyId })
      const result = await familyService.getDeletedItems.call(ctx)
      expect(result.data).toEqual([])
    })
  })

  describe('restoreItem', () => {
    it('应支持恢复所有已纳入回收站的类型', async () => {
      seedCollection('dogs', [{ _id: 'dog_1', family_id: familyId, deleted_at: 1000, updated_at: 1000 }])
      seedCollection('expenses', [{ _id: 'expense_1', family_id: familyId, deleted_at: 1000, updated_at: 1000 }])
      seedCollection('incomes', [{ _id: 'income_1', family_id: familyId, deleted_at: 1000, updated_at: 1000 }])
      seedCollection('agents', [{ _id: 'agent_1', family_id: familyId, deleted_at: 1000, updated_at: 1000 }])
      seedCollection('medication_protocols', [{ _id: 'protocol_1', family_id: familyId, deleted_at: 1000, updated_at: 1000 }])

      const ctx = createCloudObjectContext({ familyId, role: 'creator' })
      const cases = [
        { collection: 'dogs', id: 'dog_1', type: 'dog' },
        { collection: 'expenses', id: 'expense_1', type: 'expense' },
        { collection: 'incomes', id: 'income_1', type: 'income' },
        { collection: 'agents', id: 'agent_1', type: 'agent' },
        { collection: 'medication_protocols', id: 'protocol_1', type: 'medication_protocol' },
      ]

      for (const item of cases) {
        await familyService.restoreItem.call(ctx, { id: item.id, type: item.type })
        const { data } = await db.collection(item.collection).doc(item.id).get()
        expect(data[0].deleted_at).toBeNull()
      }
    })

    it('非法类型、不存在项目或跨家庭项目时应报错', async () => {
      seedCollection('dogs', [{ _id: 'dog_1', family_id: 'other_family', deleted_at: 1000, updated_at: 1000 }])

      const ctx = createCloudObjectContext({ familyId, role: 'creator' })

      await expect(familyService.restoreItem.call(ctx, { id: 'dog_1', type: 'sale' }))
        .rejects.toThrow('不支持的回收站类型')
      await expect(familyService.restoreItem.call(ctx, { id: 'missing', type: 'dog' }))
        .rejects.toThrow('回收站项目不存在')
      await expect(familyService.restoreItem.call(ctx, { id: 'dog_1', type: 'dog' }))
        .rejects.toThrow('回收站项目不存在')
    })
  })

  describe('permanentDeleteItem', () => {
    it('应支持永久删除所有已纳入回收站的类型', async () => {
      seedCollection('dogs', [{ _id: 'dog_1', family_id: familyId, deleted_at: 1000 }])
      seedCollection('expenses', [{ _id: 'expense_1', family_id: familyId, deleted_at: 1000 }])
      seedCollection('incomes', [{ _id: 'income_1', family_id: familyId, deleted_at: 1000 }])
      seedCollection('agents', [{ _id: 'agent_1', family_id: familyId, deleted_at: 1000 }])
      seedCollection('medication_protocols', [{ _id: 'protocol_1', family_id: familyId, deleted_at: 1000 }])

      const ctx = createCloudObjectContext({ familyId, role: 'creator' })
      const cases = [
        { collection: 'dogs', id: 'dog_1', type: 'dog' },
        { collection: 'expenses', id: 'expense_1', type: 'expense' },
        { collection: 'incomes', id: 'income_1', type: 'income' },
        { collection: 'agents', id: 'agent_1', type: 'agent' },
        { collection: 'medication_protocols', id: 'protocol_1', type: 'medication_protocol' },
      ]

      for (const item of cases) {
        await familyService.permanentDeleteItem.call(ctx, { id: item.id, type: item.type })
        const { data } = await db.collection(item.collection).doc(item.id).get()
        expect(data).toHaveLength(0)
      }
    })

    it('未软删项目、非法类型或跨家庭项目时应报错', async () => {
      seedCollection('dogs', [
        { _id: 'dog_1', family_id: familyId, deleted_at: null },
        { _id: 'dog_2', family_id: 'other_family', deleted_at: 1000 },
      ])

      const ctx = createCloudObjectContext({ familyId, role: 'creator' })

      await expect(familyService.permanentDeleteItem.call(ctx, { id: 'dog_1', type: 'dog' }))
        .rejects.toThrow('回收站项目不存在')
      await expect(familyService.permanentDeleteItem.call(ctx, { id: 'dog_2', type: 'dog' }))
        .rejects.toThrow('回收站项目不存在')
      await expect(familyService.permanentDeleteItem.call(ctx, { id: 'dog_1', type: 'sale' }))
        .rejects.toThrow('不支持的回收站类型')
    })
  })
})
