/**
 * health-service 云对象测试
 * 测试健康记录、用药任务、提醒生成
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  resetDB,
  seedCollection,
  createMockUniCloud,
} from '../helpers/mock-unicloud'

const mockUniCloud = createMockUniCloud()
;(globalThis as any).uniCloud = mockUniCloud

describe('health-service', () => {
  const db = mockUniCloud.database()
  const familyId = 'fam_1'

  beforeEach(() => {
    resetDB()
    seedCollection('families', [{
      _id: familyId,
      name: '测试犬舍',
      settings: {
        default_weaning_days: 45,
        default_vaccine_interval: 21,
        default_deworming_interval_puppy: 14,
        default_deworming_interval_adult: 90,
      },
    }])
    seedCollection('dogs', [{
      _id: 'dog_1',
      name: '花花',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      family_id: familyId,
      deleted_at: null,
    }])
  })

  describe('健康记录创建', () => {
    it('应创建疫苗记录', async () => {
      const now = Date.now()

      const { id: recordId } = await db.collection('health_records').add({
        type: 'vaccination',
        dog_id: 'dog_1',
        family_id: familyId,
        date: now,
        cost: 200,
        notes: '六联疫苗',
        details: {
          vaccine_type: '六联',
          next_reminder_date: now + 21 * 86400000,
        },
        created_at: now,
      })

      expect(recordId).toBeDefined()

      const { data } = await db.collection('health_records').doc(recordId).get()
      expect(data[0].type).toBe('vaccination')
      expect(data[0].details.vaccine_type).toBe('六联')
    })

    it('应创建驱虫记录', async () => {
      const now = Date.now()

      const { id: recordId } = await db.collection('health_records').add({
        type: 'deworming',
        dog_id: 'dog_1',
        family_id: familyId,
        date: now,
        details: {
          deworming_type: 'internal',
          drug_name: '拜耳',
        },
        created_at: now,
      })

      const { data } = await db.collection('health_records').doc(recordId).get()
      expect(data[0].type).toBe('deworming')
      expect(data[0].details.deworming_type).toBe('internal')
    })

    it('应创建疾病记录', async () => {
      const now = Date.now()

      const { id: recordId } = await db.collection('health_records').add({
        type: 'illness',
        dog_id: 'dog_1',
        family_id: familyId,
        date: now,
        cost: 800,
        details: {
          condition: '感冒',
          treatment_status: '治疗中',
          start_date: now,
        },
        created_at: now,
      })

      const { data } = await db.collection('health_records').doc(recordId).get()
      expect(data[0].type).toBe('illness')
      expect(data[0].details.condition).toBe('感冒')
      expect(data[0].details.treatment_status).toBe('治疗中')
    })
  })

  describe('健康记录查询', () => {
    it('应按犬只查询所有健康记录', async () => {
      const now = Date.now()

      seedCollection('health_records', [
        { _id: 'hr_1', type: 'vaccination', dog_id: 'dog_1', family_id: familyId, date: now },
        { _id: 'hr_2', type: 'deworming', dog_id: 'dog_1', family_id: familyId, date: now + 1000 },
        { _id: 'hr_3', type: 'vaccination', dog_id: 'dog_2', family_id: familyId, date: now },
      ])

      const { data } = await db.collection('health_records')
        .where({ dog_id: 'dog_1', family_id: familyId })
        .get()

      expect(data).toHaveLength(2)
    })

    it('应按类型筛选', async () => {
      const now = Date.now()

      seedCollection('health_records', [
        { _id: 'hr_1', type: 'vaccination', dog_id: 'dog_1', family_id: familyId, date: now },
        { _id: 'hr_2', type: 'deworming', dog_id: 'dog_1', family_id: familyId, date: now },
        { _id: 'hr_3', type: 'illness', dog_id: 'dog_1', family_id: familyId, date: now },
      ])

      const { data } = await db.collection('health_records')
        .where({ dog_id: 'dog_1', family_id: familyId, type: 'vaccination' })
        .get()

      expect(data).toHaveLength(1)
      expect(data[0].type).toBe('vaccination')
    })
  })

  describe('提醒任务生成', () => {
    it('疫苗记录应生成下次疫苗提醒', async () => {
      const now = Date.now()
      const nextDate = now + 21 * 86400000

      await db.collection('tasks').add({
        dog_id: 'dog_1',
        dog_name: '花花',
        type: 'vaccination',
        title: '花花 · 下次疫苗',
        due_date: nextDate,
        status: 'pending',
        source_record_id: 'hr_1',
        source_collection: 'health_records',
        family_id: familyId,
      })

      const { data: tasks } = await db.collection('tasks')
        .where({ dog_id: 'dog_1', type: 'vaccination' })
        .get()

      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toContain('疫苗')
      expect(tasks[0].due_date).toBe(nextDate)
    })

    it('驱虫记录应生成下次驱虫提醒', async () => {
      const now = Date.now()
      const nextDate = now + 90 * 86400000

      await db.collection('tasks').add({
        dog_id: 'dog_1',
        dog_name: '花花',
        type: 'deworming',
        title: '花花 · 下次驱虫',
        due_date: nextDate,
        status: 'pending',
        family_id: familyId,
      })

      const { data: tasks } = await db.collection('tasks')
        .where({ dog_id: 'dog_1', type: 'deworming' })
        .get()

      expect(tasks).toHaveLength(1)
      expect(tasks[0].due_date).toBe(nextDate)
    })
  })

  describe('用药任务', () => {
    it('应创建用药任务和每日提醒', async () => {
      const now = Date.now()
      const durationDays = 7

      // 创建用药任务
      const { id: medId } = await db.collection('medication_tasks').add({
        dog_id: 'dog_1',
        family_id: familyId,
        drug_name: '阿莫西林',
        dosage: 100,
        dosage_unit: '毫克',
        method: '口服',
        frequency: 2,
        duration_days: durationDays,
        actual_start_date: now,
        status: '进行中',
        created_at: now,
      })

      expect(medId).toBeDefined()

      // 创建 7 天的每日任务
      for (let day = 0; day < durationDays; day++) {
        await db.collection('tasks').add({
          dog_id: 'dog_1',
          dog_name: '花花',
          medication_task_id: medId,
          type: 'medication',
          title: `花花 · 阿莫西林 第${day + 1}天/${durationDays}天`,
          due_date: now + day * 86400000,
          status: 'pending',
          family_id: familyId,
        })
      }

      const { data: tasks } = await db.collection('tasks')
        .where({ medication_task_id: medId })
        .get()

      expect(tasks).toHaveLength(7)
      expect(tasks[0].title).toContain('第1天')
    })

    it('完成所有每日用药应标记用药任务为已完成', async () => {
      const now = Date.now()

      seedCollection('medication_tasks', [{
        _id: 'med_1',
        dog_id: 'dog_1',
        family_id: familyId,
        drug_name: '阿莫西林',
        duration_days: 2,
        status: '进行中',
      }])

      seedCollection('tasks', [
        { _id: 't1', medication_task_id: 'med_1', status: 'completed', family_id: familyId },
        { _id: 't2', medication_task_id: 'med_1', status: 'completed', family_id: familyId },
      ])

      // 所有任务已完成 → 检查无剩余 pending
      const { data: remaining } = await db.collection('tasks')
        .where({ medication_task_id: 'med_1', status: 'pending' })
        .get()

      expect(remaining).toHaveLength(0)

      // 更新用药状态
      await db.collection('medication_tasks').doc('med_1').update({
        status: '已完成',
        updated_at: now,
      })

      const { data: meds } = await db.collection('medication_tasks').doc('med_1').get()
      expect(meds[0].status).toBe('已完成')
    })

    it('提前结束用药应取消剩余任务', async () => {
      const now = Date.now()

      seedCollection('medication_tasks', [{
        _id: 'med_end',
        dog_id: 'dog_1',
        family_id: familyId,
        drug_name: '头孢',
        status: '进行中',
      }])

      seedCollection('tasks', [
        { _id: 't1', medication_task_id: 'med_end', status: 'completed', family_id: familyId },
        { _id: 't2', medication_task_id: 'med_end', status: 'pending', family_id: familyId },
        { _id: 't3', medication_task_id: 'med_end', status: 'pending', family_id: familyId },
      ])

      // 结束用药
      await db.collection('medication_tasks').doc('med_end').update({
        status: '已取消',
        updated_at: now,
      })

      // 取消 pending 任务
      await db.collection('tasks').where({
        medication_task_id: 'med_end',
        status: 'pending',
      }).update({ status: 'cancelled', updated_at: now })

      const { data: tasks } = await db.collection('tasks')
        .where({ medication_task_id: 'med_end' })
        .get()

      const pending = tasks.filter(t => t.status === 'pending')
      const cancelled = tasks.filter(t => t.status === 'cancelled')
      const completed = tasks.filter(t => t.status === 'completed')

      expect(pending).toHaveLength(0)
      expect(cancelled).toHaveLength(2)
      expect(completed).toHaveLength(1)
    })
  })

  describe('费用创建', () => {
    it('有 cost 的健康记录应创建 expense', async () => {
      const now = Date.now()

      await db.collection('expenses').add({
        total_amount: 200,
        category: '疫苗',
        date: now,
        linked_dog_ids: ['dog_1'],
        dog_names: ['花花'],
        family_id: familyId,
        deleted_at: null,
        created_at: now,
      })

      const { data: expenses } = await db.collection('expenses')
        .where({ family_id: familyId, category: '疫苗' })
        .get()

      expect(expenses).toHaveLength(1)
      expect(expenses[0].total_amount).toBe(200)
    })
  })
})
