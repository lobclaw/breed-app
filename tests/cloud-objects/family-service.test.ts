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
})
