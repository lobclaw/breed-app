/**
 * health-service 云对象测试
 * 测试健康记录、用药任务、提醒生成
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  resetDB,
  seedCollection,
  createMockUniCloud,
  createCloudObjectContext,
} from '../helpers/mock-unicloud'

const mockUniCloud = createMockUniCloud()
;(globalThis as any).uniCloud = mockUniCloud
process.env.NODE_ENV = 'test'
const healthService = require('../../uniCloud-alipay/cloudfunctions/health-service/index.obj.js')

describe('health-service', () => {
  const db = mockUniCloud.database()
  const familyId = 'fam_1'
  const DAY_MS = 86400000

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

  afterEach(() => {
    vi.restoreAllMocks()
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

    it('应保存主疾病与症状，并同步兼容 condition 字段', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      const result = await healthService.batchAddHealthRecords.call(ctx, {
        dog_ids: ['dog_1'],
        type: 'illness',
        date: now,
        details: {
          primary_condition: '感冒',
          symptom_tags: ['咳嗽', '流鼻涕', '咳嗽'],
          treatment_status: '观察中',
          severity: '轻微',
        },
      })

      expect(result.data.count).toBe(1)

      const createdRecordId = result.data.records[0].recordId
      const { data: records } = await db.collection('health_records').doc(createdRecordId).get()
      expect(records[0].details.primary_condition).toBe('感冒')
      expect(records[0].details.condition).toBe('感冒')
      expect(records[0].details.symptom_tags).toEqual(['咳嗽', '流鼻涕'])
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

  describe('疾病状态批量更新', () => {
    it('batchUpdateIllnessStatus 应批量更新疾病状态并返回 ids', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('health_records', [
        {
          _id: 'ill_batch_status_1',
          type: 'illness',
          dog_id: 'dog_1',
          family_id: familyId,
          deleted_at: null,
          details: { treatment_status: '观察中', primary_condition: '感冒', condition: '感冒' },
          date: now,
          created_at: now,
          updated_at: now,
        },
        {
          _id: 'ill_batch_status_2',
          type: 'illness',
          dog_id: 'dog_1',
          family_id: familyId,
          deleted_at: null,
          details: { treatment_status: '观察中', primary_condition: '皮肤病', condition: '皮肤病' },
          date: now,
          created_at: now,
          updated_at: now,
        },
      ])

      const result = await healthService.batchUpdateIllnessStatus.call(ctx, {
        illnessIds: ['ill_batch_status_1', 'ill_batch_status_2'],
        status: '治疗中',
      })

      expect(result.data.updatedIllnessIds).toEqual(['ill_batch_status_1', 'ill_batch_status_2'])

      const { data: records } = await db.collection('health_records').where({ type: 'illness', family_id: familyId }).get()
      expect(records.every(record => record.details?.treatment_status === '治疗中')).toBe(true)
    })

    it('batchUpdateIllnessStatus 应支持 _sync 幂等重放并返回 touchedEntities', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('health_records', [{
        _id: 'ill_sync_status_1',
        type: 'illness',
        dog_id: 'dog_1',
        family_id: familyId,
        deleted_at: null,
        details: { treatment_status: '观察中', primary_condition: '感冒', condition: '感冒' },
        date: now,
        version: 2,
        created_at: now,
        updated_at: now,
      }])

      const payload = {
        illnessIds: ['ill_sync_status_1'],
        status: '治疗中',
        _sync: {
          clientMutationId: 'mutation_health_sync_1',
          deviceId: 'device_a',
          baseVersions: { ill_sync_status_1: 2 },
          clientTimestamp: now,
        },
      }

      const first = await healthService.batchUpdateIllnessStatus.call(ctx, payload)
      expect(first.ack).toBe('accepted')
      expect(first.touchedEntities).toEqual([
        expect.objectContaining({ collection: 'health_records', id: 'ill_sync_status_1', version: 3 }),
      ])

      const second = await healthService.batchUpdateIllnessStatus.call(ctx, payload)
      expect(second).toEqual(first)

      const { data: records } = await db.collection('health_records').doc('ill_sync_status_1').get()
      expect(records[0].details.treatment_status).toBe('治疗中')
      expect(records[0].version).toBe(3)
    })
  })

  describe('用药任务', () => {
    it('超期未全量完成的旧疗程不应再算重复，并自动收口为已完成', async () => {
      const now = new Date('2026-04-15T10:00:00+08:00').getTime()
      vi.spyOn(Date, 'now').mockReturnValue(now)
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('medication_tasks', [{
        _id: 'med_overdue_partial',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        drug_name: '阿莫西林',
        frequency: 1,
        duration_days: 3,
        actual_start_date: new Date('2026-04-10T09:00:00+08:00').getTime(),
        status: '进行中',
        daily_doses: {
          1: 1,
          2: 0,
          3: 0,
        },
        created_at: now,
        updated_at: now,
      }])

      const result = await healthService.batchCheckDuplicateMedication.call(ctx, ['dog_1'], '阿莫西林')
      expect(result.data).toEqual([])

      const { data: meds } = await db.collection('medication_tasks').doc('med_overdue_partial').get()
      expect(meds[0].status).toBe('已完成')
    })

    it('超期且已全量完成的旧疗程不应再算重复，并保持已完成', async () => {
      const now = new Date('2026-04-15T10:00:00+08:00').getTime()
      vi.spyOn(Date, 'now').mockReturnValue(now)
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('medication_tasks', [{
        _id: 'med_overdue_done',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        drug_name: '阿莫西林',
        frequency: 2,
        duration_days: 3,
        actual_start_date: new Date('2026-04-10T09:00:00+08:00').getTime(),
        status: '进行中',
        daily_doses: {
          1: 2,
          2: 2,
          3: 2,
        },
        created_at: now,
        updated_at: now,
      }])

      const result = await healthService.batchCheckDuplicateMedication.call(ctx, ['dog_1'], '阿莫西林')
      expect(result.data).toEqual([])

      const { data: meds } = await db.collection('medication_tasks').doc('med_overdue_done').get()
      expect(meds[0].status).toBe('已完成')
    })

    it('未超期且进行中的同名任务仍应返回重复项', async () => {
      const now = new Date('2026-04-12T10:00:00+08:00').getTime()
      vi.spyOn(Date, 'now').mockReturnValue(now)
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('medication_tasks', [{
        _id: 'med_active_dup',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        drug_name: '阿莫西林',
        frequency: 1,
        duration_days: 3,
        actual_start_date: new Date('2026-04-10T09:00:00+08:00').getTime(),
        status: '进行中',
        daily_doses: {
          1: 1,
        },
        created_at: now,
        updated_at: now,
      }])

      const result = await healthService.batchCheckDuplicateMedication.call(ctx, ['dog_1'], '阿莫西林')
      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toMatchObject({
        dog_id: 'dog_1',
        dogName: '花花',
        drugName: '阿莫西林',
        day: 3,
        totalDays: 3,
      })
    })

    it('批量创建遇到超期旧疗程时，应自动收口后正常创建新任务', async () => {
      const now = new Date('2026-04-15T10:00:00+08:00').getTime()
      vi.spyOn(Date, 'now').mockReturnValue(now)
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('medication_tasks', [{
        _id: 'med_expired_before_create',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        drug_name: '阿莫西林',
        frequency: 1,
        duration_days: 3,
        actual_start_date: new Date('2026-04-10T09:00:00+08:00').getTime(),
        status: '进行中',
        daily_doses: {
          1: 1,
        },
        created_at: now,
        updated_at: now,
      }])

      const result = await healthService.batchStartMedication.call(ctx, {
        dog_ids: ['dog_1'],
        drug_name: '阿莫西林',
        dosage: '1',
        dosage_unit: 'tablet',
        method: '口服',
        frequency: 1,
        duration_days: 5,
        actual_start_date: now,
      })

      expect(result.data.count).toBe(1)

      const { data: meds } = await db.collection('medication_tasks')
        .where({ dog_id: 'dog_1', family_id: familyId, drug_name: '阿莫西林' })
        .get()

      expect(meds).toHaveLength(2)
      const statuses = meds.map(item => item.status).sort()
      expect(statuses).toEqual(['已完成', '进行中'])
    })

    it('从疾病发起用药时，应写入 source_record_id 且仅升级对应疾病', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('health_records', [
        {
          _id: 'ill_target',
          type: 'illness',
          dog_id: 'dog_1',
          dog_name: '花花',
          family_id: familyId,
          date: now - DAY_MS,
          details: { primary_condition: '感冒', condition: '感冒', treatment_status: '观察中', severity: '轻微' },
          created_at: now - DAY_MS,
          updated_at: now - DAY_MS,
        },
        {
          _id: 'ill_other',
          type: 'illness',
          dog_id: 'dog_1',
          dog_name: '花花',
          family_id: familyId,
          date: now - DAY_MS,
          details: { primary_condition: '皮肤病', condition: '皮肤病', treatment_status: '观察中', severity: '轻微' },
          created_at: now - DAY_MS,
          updated_at: now - DAY_MS,
        },
      ])

      const result = await healthService.batchStartMedication.call(ctx, {
        dog_ids: ['dog_1'],
        drug_name: '阿莫西林',
        dosage: '1',
        dosage_unit: 'tablet',
        method: '口服',
        frequency: 1,
        duration_days: 3,
        actual_start_date: now,
        illnessRecordId: 'ill_target',
      })

      expect(result.data.count).toBe(1)

      const { data: meds } = await db.collection('medication_tasks').where({ dog_id: 'dog_1', family_id: familyId }).get()
      expect(meds).toHaveLength(1)
      expect(meds[0].source_record_id).toBe('ill_target')

      const { data: illnesses } = await db.collection('health_records').where({ family_id: familyId, dog_id: 'dog_1', type: 'illness' }).get()
      const illnessMap = new Map(illnesses.map(item => [item._id, item]))
      expect(illnessMap.get('ill_target')?.details?.treatment_status).toBe('治疗中')
      expect(illnessMap.get('ill_other')?.details?.treatment_status).toBe('观察中')
    })

    it('独立创建用药时，source_record_id 为空且仍保留兜底升级逻辑', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('health_records', [{
        _id: 'ill_fallback',
        type: 'illness',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        deleted_at: null,
        date: now - DAY_MS,
        details: { primary_condition: '感冒', condition: '感冒', treatment_status: '观察中', severity: '轻微' },
        created_at: now - DAY_MS,
        updated_at: now - DAY_MS,
      }])

      const result = await healthService.batchStartMedication.call(ctx, {
        dog_ids: ['dog_1'],
        drug_name: '阿莫西林',
        dosage: '1',
        dosage_unit: 'tablet',
        method: '口服',
        frequency: 1,
        duration_days: 3,
        actual_start_date: now,
      })

      expect(result.data.count).toBe(1)

      const { data: meds } = await db.collection('medication_tasks').where({ dog_id: 'dog_1', family_id: familyId }).get()
      expect(meds[0].source_record_id || null).toBeNull()

      const { data: illnesses } = await db.collection('health_records').doc('ill_fallback').get()
      expect(illnesses[0].details.treatment_status).toBe('治疗中')
    })

    it('批量疾病发起批量用药时，应按犬只分别写入 source_record_id 并只升级各自疾病', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      await db.collection('dogs').add({
        _id: 'dog_2',
        name: '奶糖',
        gender: '母',
        role: '种狗',
        disposition: '在养',
        family_id: familyId,
        deleted_at: null,
      })

      seedCollection('health_records', [
        {
          _id: 'ill_dog1_target',
          type: 'illness',
          dog_id: 'dog_1',
          dog_name: '花花',
          family_id: familyId,
          deleted_at: null,
          date: now - DAY_MS,
          details: { primary_condition: '感冒', condition: '感冒', treatment_status: '观察中', severity: '轻微' },
          created_at: now - DAY_MS,
          updated_at: now - DAY_MS,
        },
        {
          _id: 'ill_dog1_other',
          type: 'illness',
          dog_id: 'dog_1',
          dog_name: '花花',
          family_id: familyId,
          deleted_at: null,
          date: now - DAY_MS,
          details: { primary_condition: '皮肤病', condition: '皮肤病', treatment_status: '观察中', severity: '轻微' },
          created_at: now - DAY_MS,
          updated_at: now - DAY_MS,
        },
        {
          _id: 'ill_dog2_target',
          type: 'illness',
          dog_id: 'dog_2',
          dog_name: '奶糖',
          family_id: familyId,
          deleted_at: null,
          date: now - DAY_MS,
          details: { primary_condition: '感冒', condition: '感冒', treatment_status: '观察中', severity: '轻微' },
          created_at: now - DAY_MS,
          updated_at: now - DAY_MS,
        },
      ])

      const result = await healthService.batchStartMedication.call(ctx, {
        dog_ids: ['dog_1', 'dog_2'],
        drug_name: '阿莫西林',
        dosage: '1',
        dosage_unit: 'tablet',
        method: '口服',
        frequency: 1,
        duration_days: 3,
        actual_start_date: now,
        illness_links: [
          { dog_id: 'dog_1', illness_record_id: 'ill_dog1_target' },
          { dog_id: 'dog_2', illness_record_id: 'ill_dog2_target' },
        ],
      })

      expect(result.data.count).toBe(2)

      const { data: meds } = await db.collection('medication_tasks')
        .where({ family_id: familyId, drug_name: '阿莫西林' })
        .get()
      const sourceMap = new Map(meds.map(item => [item.dog_id, item.source_record_id]))
      expect(sourceMap.get('dog_1')).toBe('ill_dog1_target')
      expect(sourceMap.get('dog_2')).toBe('ill_dog2_target')

      const { data: illnesses } = await db.collection('health_records')
        .where({ family_id: familyId, type: 'illness' })
        .get()
      const illnessMap = new Map(illnesses.map(item => [item._id, item]))
      expect(illnessMap.get('ill_dog1_target')?.details?.treatment_status).toBe('治疗中')
      expect(illnessMap.get('ill_dog2_target')?.details?.treatment_status).toBe('治疗中')
      expect(illnessMap.get('ill_dog1_other')?.details?.treatment_status).toBe('观察中')
    })

    it('批量独立创建用药时，应保持 source_record_id 为空且不自动推进疾病状态', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      await db.collection('dogs').add({
        _id: 'dog_2',
        name: '奶糖',
        gender: '母',
        role: '种狗',
        disposition: '在养',
        family_id: familyId,
        deleted_at: null,
      })

      seedCollection('health_records', [
        {
          _id: 'ill_batch_1',
          type: 'illness',
          dog_id: 'dog_1',
          dog_name: '花花',
          family_id: familyId,
          deleted_at: null,
          date: now - DAY_MS,
          details: { primary_condition: '感冒', condition: '感冒', treatment_status: '观察中', severity: '轻微' },
          created_at: now - DAY_MS,
          updated_at: now - DAY_MS,
        },
        {
          _id: 'ill_batch_2',
          type: 'illness',
          dog_id: 'dog_2',
          dog_name: '奶糖',
          family_id: familyId,
          deleted_at: null,
          date: now - DAY_MS,
          details: { primary_condition: '肠胃炎', condition: '肠胃炎', treatment_status: '观察中', severity: '轻微' },
          created_at: now - DAY_MS,
          updated_at: now - DAY_MS,
        },
      ])

      const result = await healthService.batchStartMedication.call(ctx, {
        dog_ids: ['dog_1', 'dog_2'],
        drug_name: '益生菌',
        dosage: '1',
        dosage_unit: 'tablet',
        method: '口服',
        frequency: 1,
        duration_days: 3,
        actual_start_date: now,
      })

      expect(result.data.count).toBe(2)

      const { data: meds } = await db.collection('medication_tasks')
        .where({ family_id: familyId, drug_name: '益生菌' })
        .get()
      expect(meds.every(item => !item.source_record_id)).toBe(true)

      const { data: illnessOne } = await db.collection('health_records').doc('ill_batch_1').get()
      const { data: illnessTwo } = await db.collection('health_records').doc('ill_batch_2').get()
      expect(illnessOne[0].details.treatment_status).toBe('观察中')
      expect(illnessTwo[0].details.treatment_status).toBe('观察中')
    })

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

    it('batchCompleteMedicationDay 应去重并仅完成当天未满剂量的任务', async () => {
      const now = new Date('2026-04-21T10:00:00+08:00').getTime()
      vi.spyOn(Date, 'now').mockReturnValue(now)
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('medication_tasks', [
        {
          _id: 'med_batch_day_1',
          dog_id: 'dog_1',
          family_id: familyId,
          drug_name: '阿莫西林',
          frequency: 2,
          duration_days: 2,
          actual_start_date: new Date('2026-04-20T09:00:00+08:00').getTime(),
          status: '进行中',
          daily_doses: { 1: 2, 2: 1 },
          created_at: now,
          updated_at: now,
        },
        {
          _id: 'med_batch_day_2',
          dog_id: 'dog_1',
          family_id: familyId,
          drug_name: '益生菌',
          frequency: 1,
          duration_days: 2,
          actual_start_date: new Date('2026-04-20T09:00:00+08:00').getTime(),
          status: '进行中',
          daily_doses: { 1: 1, 2: 0 },
          created_at: now,
          updated_at: now,
        },
        {
          _id: 'med_batch_day_done',
          dog_id: 'dog_1',
          family_id: familyId,
          drug_name: '维生素',
          frequency: 1,
          duration_days: 2,
          actual_start_date: new Date('2026-04-20T09:00:00+08:00').getTime(),
          status: '进行中',
          daily_doses: { 1: 1, 2: 1 },
          created_at: now,
          updated_at: now,
        },
      ])

      const result = await healthService.batchCompleteMedicationDay.call(ctx, [
        'med_batch_day_1',
        'med_batch_day_1',
        'med_batch_day_2',
        'med_batch_day_done',
      ])

      expect(result.data.completedMedicationTaskIds).toEqual(['med_batch_day_1', 'med_batch_day_2'])
      expect(result.data.fullyCompletedMedicationTaskIds).toEqual(['med_batch_day_1', 'med_batch_day_2'])

      const { data: meds } = await db.collection('medication_tasks').where({ family_id: familyId }).get()
      const medMap = new Map(meds.map(item => [item._id, item]))
      expect(medMap.get('med_batch_day_1')?.daily_doses?.['2']).toBe(2)
      expect(medMap.get('med_batch_day_1')?.status).toBe('已完成')
      expect(medMap.get('med_batch_day_2')?.daily_doses?.['2']).toBe(1)
      expect(medMap.get('med_batch_day_2')?.status).toBe('已完成')
      expect(medMap.get('med_batch_day_done')?.status).toBe('进行中')
    })

    it('recoverIllnesses 应返回康复疾病与取消的用药 ids', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('health_records', [{
        _id: 'ill_recover_batch',
        type: 'illness',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        deleted_at: null,
        date: now - DAY_MS,
        details: {
          primary_condition: '感冒',
          condition: '感冒',
          treatment_status: '治疗中',
        },
        created_at: now - DAY_MS,
        updated_at: now - DAY_MS,
      }])
      seedCollection('medication_tasks', [{
        _id: 'med_recover_batch',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        source_record_id: 'ill_recover_batch',
        drug_name: '头孢',
        frequency: 1,
        duration_days: 3,
        actual_start_date: now - DAY_MS,
        status: '进行中',
        created_at: now - DAY_MS,
        updated_at: now - DAY_MS,
      }])
      seedCollection('tasks', [
        { _id: 'recover_daily_1', medication_task_id: 'med_recover_batch', family_id: familyId, status: 'pending' },
        { _id: 'recover_daily_2', medication_task_id: 'med_recover_batch', family_id: familyId, status: 'completed' },
      ])

      const result = await healthService.recoverIllnesses.call(ctx, { illnessIds: ['ill_recover_batch'] })

      expect(result.data.recoveredIllnessIds).toEqual(['ill_recover_batch'])
      expect(result.data.cancelledMedicationTaskIds).toEqual(['med_recover_batch'])
    })

    it('recoverIllnesses 在 baseVersion 过期时应返回 conflict', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('health_records', [{
        _id: 'ill_recover_conflict',
        type: 'illness',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        deleted_at: null,
        date: now - DAY_MS,
        details: {
          primary_condition: '感冒',
          condition: '感冒',
          treatment_status: '治疗中',
        },
        version: 4,
        created_at: now - DAY_MS,
        updated_at: now - DAY_MS,
      }])

      const result = await healthService.recoverIllnesses.call(ctx, {
        illnessIds: ['ill_recover_conflict'],
        _sync: {
          clientMutationId: 'mutation_health_conflict_1',
          deviceId: 'device_a',
          baseVersions: { ill_recover_conflict: 3 },
          clientTimestamp: now,
        },
      })

      expect(result.ack).toBe('conflict')
      expect(result.conflict).toEqual(expect.objectContaining({
        collection: 'health_records',
        entityId: 'ill_recover_conflict',
        baseVersion: 3,
        serverVersion: 4,
      }))

      const { data: illness } = await db.collection('health_records').doc('ill_recover_conflict').get()
      expect(illness[0].details.treatment_status).toBe('治疗中')
      expect(illness[0].version).toBe(4)
    })

    it('endMedicationByDog 应批量取消该犬进行中的用药并返回 ids', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('medication_tasks', [
        {
          _id: 'med_stop_dog_1',
          dog_id: 'dog_1',
          family_id: familyId,
          drug_name: '阿莫西林',
          status: '进行中',
          created_at: now,
          updated_at: now,
        },
        {
          _id: 'med_stop_dog_2',
          dog_id: 'dog_1',
          family_id: familyId,
          drug_name: '益生菌',
          status: '进行中',
          created_at: now,
          updated_at: now,
        },
        {
          _id: 'med_stop_other_dog',
          dog_id: 'dog_2',
          family_id: familyId,
          drug_name: '维生素',
          status: '进行中',
          created_at: now,
          updated_at: now,
        },
      ])
      seedCollection('tasks', [
        { _id: 'stop_daily_1', medication_task_id: 'med_stop_dog_1', family_id: familyId, status: 'pending' },
        { _id: 'stop_daily_2', medication_task_id: 'med_stop_dog_2', family_id: familyId, status: 'pending' },
        { _id: 'stop_daily_3', medication_task_id: 'med_stop_other_dog', family_id: familyId, status: 'pending' },
      ])

      const result = await healthService.endMedicationByDog.call(ctx, 'dog_1')

      expect(result.data.cancelledMedicationTaskIds).toEqual(['med_stop_dog_1', 'med_stop_dog_2'])

      const { data: meds } = await db.collection('medication_tasks').where({ family_id: familyId }).get()
      const medMap = new Map(meds.map(item => [item._id, item]))
      expect(medMap.get('med_stop_dog_1')?.status).toBe('已取消')
      expect(medMap.get('med_stop_dog_2')?.status).toBe('已取消')
      expect(medMap.get('med_stop_other_dog')?.status).toBe('进行中')

      const { data: tasks } = await db.collection('tasks').where({ family_id: familyId }).get()
      const taskMap = new Map(tasks.map(item => [item._id, item]))
      expect(taskMap.get('stop_daily_1')?.status).toBe('cancelled')
      expect(taskMap.get('stop_daily_2')?.status).toBe('cancelled')
      expect(taskMap.get('stop_daily_3')?.status).toBe('pending')
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

    it('单条关联用药结束时，应按 illnessDisposition 回写疾病状态', async () => {
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('health_records', [{
        _id: 'ill_end_1',
        type: 'illness',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        deleted_at: null,
        date: Date.now() - DAY_MS,
        details: {
          primary_condition: '感冒',
          condition: '感冒',
          symptom_tags: ['咳嗽'],
          treatment_status: '治疗中',
        },
        created_at: Date.now() - DAY_MS,
        updated_at: Date.now() - DAY_MS,
      }])
      seedCollection('medication_tasks', [{
        _id: 'med_end_linked',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        source_record_id: 'ill_end_1',
        drug_name: '头孢',
        frequency: 1,
        duration_days: 3,
        actual_start_date: Date.now() - DAY_MS,
        status: '进行中',
        created_at: Date.now() - DAY_MS,
        updated_at: Date.now() - DAY_MS,
      }])
      seedCollection('tasks', [
        { _id: 'med_end_task_1', medication_task_id: 'med_end_linked', status: 'pending', family_id: familyId },
        { _id: 'med_end_task_2', medication_task_id: 'med_end_linked', status: 'completed', family_id: familyId },
      ])

      await healthService.endMedication.call(ctx, { id: 'med_end_linked', illnessDisposition: 'recovered' })

      const { data: medTasks } = await db.collection('medication_tasks').doc('med_end_linked').get()
      expect(medTasks[0].status).toBe('已取消')

      const { data: illnessRecords } = await db.collection('health_records').doc('ill_end_1').get()
      expect(illnessRecords[0].details.treatment_status).toBe('已康复')

      const { data: dailyTasks } = await db.collection('tasks').where({ medication_task_id: 'med_end_linked' }).get()
      expect(dailyTasks.find(item => item._id === 'med_end_task_1')?.status).toBe('cancelled')
      expect(dailyTasks.find(item => item._id === 'med_end_task_2')?.status).toBe('completed')
    })

    it('endMedication 应支持 _sync 幂等重放', async () => {
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      seedCollection('health_records', [{
        _id: 'ill_end_sync_1',
        type: 'illness',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        deleted_at: null,
        date: Date.now() - DAY_MS,
        details: { primary_condition: '感冒', condition: '感冒', treatment_status: '治疗中' },
        created_at: Date.now() - DAY_MS,
        updated_at: Date.now() - DAY_MS,
        version: 1,
      }])
      seedCollection('medication_tasks', [{
        _id: 'med_end_sync_1',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        source_record_id: 'ill_end_sync_1',
        drug_name: '头孢',
        frequency: 1,
        duration_days: 3,
        actual_start_date: Date.now() - DAY_MS,
        status: '进行中',
        created_at: Date.now() - DAY_MS,
        updated_at: Date.now() - DAY_MS,
        version: 1,
      }])
      seedCollection('tasks', [
        { _id: 'med_end_sync_task_1', medication_task_id: 'med_end_sync_1', status: 'pending', family_id: familyId, version: 1 },
      ])

      const payload = {
        id: 'med_end_sync_1',
        illnessDisposition: 'recovered',
        _sync: {
          clientMutationId: 'health-end-medication-sync-1',
          deviceId: 'device_1',
          clientTimestamp: Date.now(),
          baseVersions: {
            med_end_sync_1: 1,
            ill_end_sync_1: 1,
          },
        },
      }

      const first = await healthService.endMedication.call(ctx, payload)
      const second = await healthService.endMedication.call(ctx, payload)

      expect(first.ack).toBe('accepted')
      expect(second).toEqual(first)

      const { data: medRows } = await db.collection('medication_tasks').doc('med_end_sync_1').get()
      expect(medRows[0].status).toBe('已取消')
      expect(medRows[0].version).toBe(2)
    })

    it('独立用药结束时，不应误改疾病状态', async () => {
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('health_records', [{
        _id: 'ill_end_fallback',
        type: 'illness',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        deleted_at: null,
        date: Date.now() - DAY_MS,
        details: {
          primary_condition: '皮肤病',
          condition: '皮肤病',
          treatment_status: '治疗中',
        },
        created_at: Date.now() - DAY_MS,
        updated_at: Date.now() - DAY_MS,
      }])
      seedCollection('medication_tasks', [{
        _id: 'med_end_standalone',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        source_record_id: null,
        drug_name: '外用药',
        frequency: 1,
        duration_days: 3,
        actual_start_date: Date.now() - DAY_MS,
        status: '进行中',
        created_at: Date.now() - DAY_MS,
        updated_at: Date.now() - DAY_MS,
      }])

      await healthService.endMedication.call(ctx, { id: 'med_end_standalone', illnessDisposition: 'observation' })

      const { data: illnessRecords } = await db.collection('health_records').doc('ill_end_fallback').get()
      expect(illnessRecords[0].details.treatment_status).toBe('治疗中')
    })

    it('应返回兼容详情页的用药任务详情字段', async () => {
      const startDate = new Date('2026-04-18T09:30:00+08:00').getTime()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('medication_tasks', [{
        _id: 'med_detail_1',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        protocol_id: 'protocol_1',
        drug_name: '阿莫西林',
        dosage: '1片',
        method: '口服',
        frequency: 2,
        duration_days: 3,
        actual_start_date: startDate,
        status: '进行中',
        daily_doses: {
          1: 2,
          2: 1,
        },
        notes: '饭后服用',
        created_at: startDate,
        updated_at: startDate,
      }])
      seedCollection('medication_protocols', [{
        _id: 'protocol_1',
        family_id: familyId,
        name: '感冒方案',
        deleted_at: null,
      }])

      const result = await healthService.getMedicationTaskDetail.call(ctx, { medication_task_id: 'med_detail_1' })
      const normalizedStartDate = new Date(startDate)
      normalizedStartDate.setHours(0, 0, 0, 0)
      const expectedStartDate = normalizedStartDate.getTime()

      expect(result.data.protocol_name).toBe('感冒方案')
      expect(result.data.status).toBe('active')
      expect(result.data.start_date).toBe(expectedStartDate)
      expect(result.data.end_date).toBe(expectedStartDate + 2 * 86400000)
      expect(result.data.completed_dates).toEqual([expectedStartDate])
      expect(result.data.completed_dose_count).toBe(3)
      expect(result.data.total_dose_count).toBe(6)
      expect(result.data.is_fully_completed).toBe(false)
      expect(result.data.completed_map[expectedStartDate]).toMatchObject({
        name: '已完成2/2次',
      })
    })

    it('用药详情应返回 linkedIllness 与 relationType', async () => {
      const now = new Date('2026-04-23T10:00:00+08:00').getTime()
      vi.spyOn(Date, 'now').mockReturnValue(now)
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('health_records', [{
        _id: 'ill_med_detail',
        type: 'illness',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        deleted_at: null,
        date: now - DAY_MS,
        details: {
          primary_condition: '感冒',
          condition: '感冒',
          symptom_tags: ['咳嗽', '流鼻涕'],
          treatment_status: '治疗中',
        },
        created_at: now - DAY_MS,
        updated_at: now - DAY_MS,
      }])
      seedCollection('medication_tasks', [{
        _id: 'med_detail_linked',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        source_record_id: 'ill_med_detail',
        drug_name: '阿莫西林',
        frequency: 1,
        duration_days: 3,
        actual_start_date: now - DAY_MS,
        status: '进行中',
        created_at: now - DAY_MS,
        updated_at: now - DAY_MS,
      }])

      const result = await healthService.getMedicationTaskDetail.call(ctx, { id: 'med_detail_linked' })

      expect(result.data.relationType).toBe('linked')
      expect(result.data.linkedIllness).toMatchObject({
        recordId: 'ill_med_detail',
        primaryCondition: '感冒',
        symptomSummary: '咳嗽 / 流鼻涕',
        treatmentStatus: '治疗中',
      })
    })

    it('疾病详情应返回关联中的用药与历史疗程', async () => {
      const now = new Date('2026-04-23T10:00:00+08:00').getTime()
      vi.spyOn(Date, 'now').mockReturnValue(now)
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('health_records', [{
        _id: 'ill_detail_with_tasks',
        type: 'illness',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        deleted_at: null,
        date: now - 3 * DAY_MS,
        details: {
          primary_condition: '肠胃炎',
          condition: '肠胃炎',
          symptom_tags: ['腹泻'],
          treatment_status: '治疗中',
        },
        created_at: now - 3 * DAY_MS,
        updated_at: now - 3 * DAY_MS,
      }])
      seedCollection('medication_tasks', [
        {
          _id: 'med_detail_active',
          dog_id: 'dog_1',
          dog_name: '花花',
          family_id: familyId,
          source_record_id: 'ill_detail_with_tasks',
          drug_name: '益生菌',
          frequency: 1,
          duration_days: 5,
          actual_start_date: now - DAY_MS,
          status: '进行中',
          daily_doses: { 1: 1, 2: 1 },
          created_at: now - DAY_MS,
          updated_at: now - DAY_MS,
        },
        {
          _id: 'med_detail_completed',
          dog_id: 'dog_1',
          dog_name: '花花',
          family_id: familyId,
          source_record_id: 'ill_detail_with_tasks',
          drug_name: '蒙脱石散',
          frequency: 1,
          duration_days: 2,
          actual_start_date: now - 3 * DAY_MS,
          status: '已完成',
          daily_doses: { 1: 1, 2: 1 },
          created_at: now - 3 * DAY_MS,
          updated_at: now - DAY_MS,
        },
      ])

      const result = await healthService.getHealthRecordDetail.call(ctx, { id: 'ill_detail_with_tasks' })

      expect(result.linkedMedicationTasks).toHaveLength(2)
      expect(result.linkedMedicationTasks[0]).toMatchObject({
        taskId: 'med_detail_active',
        medicationName: '益生菌',
        status: 'active',
        relationType: 'linked',
      })
      expect(result.linkedMedicationTasks[1]).toMatchObject({
        taskId: 'med_detail_completed',
        medicationName: '蒙脱石散',
        status: 'completed',
      })
    })

    it('应返回全部用药记录并按状态优先级排序', async () => {
      const now = new Date('2026-04-21T10:00:00+08:00').getTime()
      vi.spyOn(Date, 'now').mockReturnValue(now)
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      seedCollection('medication_tasks', [{
        _id: 'med_active_1',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        drug_name: '阿莫西林',
        dosage: '1',
        dosage_unit: 'tablet',
        method: '口服',
        frequency: 2,
        duration_days: 5,
        actual_start_date: new Date('2026-04-20T09:00:00+08:00').getTime(),
        status: '进行中',
        daily_doses: { 1: 2, 2: 1 },
        created_at: now,
        updated_at: now,
      }, {
        _id: 'med_completed_1',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        drug_name: '头孢',
        frequency: 1,
        duration_days: 3,
        actual_start_date: new Date('2026-04-18T09:00:00+08:00').getTime(),
        status: '已完成',
        daily_doses: { 1: 1, 2: 1, 3: 1 },
        created_at: now,
        updated_at: now,
      }, {
        _id: 'med_overdue_1',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        drug_name: '益生菌',
        frequency: 1,
        duration_days: 3,
        actual_start_date: new Date('2026-04-10T09:00:00+08:00').getTime(),
        status: '进行中',
        daily_doses: { 1: 1 },
        created_at: now,
        updated_at: now,
      }, {
        _id: 'med_cancelled_1',
        dog_id: 'dog_1',
        dog_name: '花花',
        family_id: familyId,
        drug_name: '止咳糖浆',
        frequency: 1,
        duration_days: 5,
        actual_start_date: new Date('2026-04-21T09:00:00+08:00').getTime(),
        status: '已取消',
        daily_doses: {},
        created_at: now,
        updated_at: now,
      }])

      const result = await healthService.getMedicationHistory.call(ctx, 'dog_1')

      expect(result.data.map((item: any) => item._id)).toEqual([
        'med_active_1',
        'med_completed_1',
        'med_overdue_1',
        'med_cancelled_1',
      ])
      expect(result.data.map((item: any) => item.status)).toEqual([
        'active',
        'completed',
        'completed',
        'cancelled',
      ])
      expect(result.data[0].progress).toEqual({ current: 2, total: 5 })
      expect(result.data[1].progress).toBeNull()
      expect(result.data[3].progress).toBeNull()

      const { data: overdueTask } = await db.collection('medication_tasks').doc('med_overdue_1').get()
      expect(overdueTask[0].status).toBe('已完成')
    })
  })

  it('updateHealthRecord 应支持 _sync 幂等重放', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    seedCollection('health_records', [{
      _id: 'health_update_sync_1',
      type: 'vaccination',
      dog_id: 'dog_1',
      dog_name: '花花',
      family_id: familyId,
      deleted_at: null,
      date: Date.now() - DAY_MS,
      cost: 50,
      notes: '原始备注',
      details: { vaccine_type: '二联' },
      created_at: Date.now() - DAY_MS,
      updated_at: Date.now() - DAY_MS,
      version: 1,
    }])

    const payload = {
      id: 'health_update_sync_1',
      date: Date.now(),
      cost: 88,
      notes: '补充加强针',
      details: { vaccine_type: '四联' },
      _sync: {
        clientMutationId: 'health-update-record-sync-1',
        deviceId: 'device_1',
        clientTimestamp: Date.now(),
        baseVersions: { health_update_sync_1: 1 },
      },
    }

    const first = await healthService.updateHealthRecord.call(ctx, payload)
    const second = await healthService.updateHealthRecord.call(ctx, payload)

    expect(first.ack).toBe('accepted')
    expect(second).toEqual(first)

    const { data } = await db.collection('health_records').doc('health_update_sync_1').get()
    expect(data[0]).toMatchObject({
      cost: 88,
      notes: '补充加强针',
      details: { vaccine_type: '四联' },
      version: 2,
    })
  })

  it('deleteHealthRecord 应支持 _sync 幂等重放并取消关联提醒任务', async () => {
    const now = Date.now()
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('health_records', [{
      _id: 'health_delete_sync_1',
      type: 'vaccination',
      dog_id: 'dog_1',
      dog_name: '花花',
      family_id: familyId,
      deleted_at: null,
      date: now - DAY_MS,
      details: { vaccine_type: '四联' },
      created_at: now - DAY_MS,
      updated_at: now - DAY_MS,
      version: 3,
    }])
    seedCollection('tasks', [{
      _id: 'task_health_delete_sync_1',
      family_id: familyId,
      dog_id: 'dog_1',
      dog_name: '花花',
      type: 'vaccination',
      title: '花花 · 下次疫苗',
      status: 'pending',
      due_date: now + DAY_MS,
      source_record_id: 'health_delete_sync_1',
      source_collection: 'health_records',
      deleted_at: null,
      created_at: now - DAY_MS,
      updated_at: now - DAY_MS,
      version: 4,
    }])

    const payload = {
      id: 'health_delete_sync_1',
      _sync: {
        clientMutationId: 'health-delete-record-sync-1',
        deviceId: 'device_1',
        clientTimestamp: now,
        baseVersions: {
          health_delete_sync_1: 3,
          task_health_delete_sync_1: 4,
        },
      },
    }

    const first = await healthService.deleteHealthRecord.call(ctx, payload)
    const second = await healthService.deleteHealthRecord.call(ctx, payload)

    expect(first.ack).toBe('accepted')
    expect(second).toEqual(first)
    expect(first.touchedEntities).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: 'health_records', id: 'health_delete_sync_1', deletedAt: expect.any(Number) }),
      expect.objectContaining({ collection: 'tasks', id: 'task_health_delete_sync_1', version: 5 }),
    ]))

    const { data: records } = await db.collection('health_records').doc('health_delete_sync_1').get()
    expect(records[0].deleted_at).toEqual(expect.any(Number))
    expect(records[0].version).toBe(4)

    const { data: tasks } = await db.collection('tasks').doc('task_health_delete_sync_1').get()
    expect(tasks[0].status).toBe('cancelled')
    expect(tasks[0].version).toBe(5)
  })

  describe('费用创建', () => {
    it('录入疫苗记录时应创建归一后的自动支出分类', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      await healthService.addHealthRecord.call(ctx, {
        type: 'vaccination',
        dog_id: 'dog_1',
        date: now,
        cost: 200,
        notes: '六联',
        details: {
          vaccine_type: '六联',
        },
      })

      const { data: expenses } = await db.collection('expenses')
        .where({ family_id: familyId })
        .get()

      expect(expenses).toHaveLength(1)
      expect(expenses[0]).toMatchObject({
        category: '疫苗驱虫',
        notes: '疫苗 · 六联',
        source_type: 'auto',
      })
    })

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

  describe('用药方案同步', () => {
    it('addMedicationProtocol 应支持 _sync 稳定 ID 与幂等重放', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      const payload = {
        name: '消炎常规',
        drug_name: '阿莫西林',
        duration_days: 5,
        _sync: {
          clientMutationId: 'protocol-sync-add-1',
          deviceId: 'device_1',
          clientTimestamp: now,
          clientEntityIds: { medication_protocols: 'protocol_client_1' },
        },
      }

      const first = await healthService.addMedicationProtocol.call(ctx, payload)
      const second = await healthService.addMedicationProtocol.call(ctx, payload)

      expect(first.ack).toBe('accepted')
      expect(second).toEqual(first)
      expect(first.data.protocolId).toBe('protocol_client_1')

      const { data: protocols } = await db.collection('medication_protocols')
        .where({ _id: 'protocol_client_1', family_id: familyId })
        .get()
      expect(protocols).toHaveLength(1)
      expect(protocols[0]).toMatchObject({
        name: '消炎常规',
        drug_name: '阿莫西林',
        version: 1,
      })
    })

    it('removeMedicationProtocol 应支持 _sync 幂等重放', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      seedCollection('medication_protocols', [{
        _id: 'protocol_remove_1',
        family_id: familyId,
        name: '保胎方案',
        drug_name: '黄体酮',
        deleted_at: null,
        version: 1,
        created_at: now - DAY_MS,
        updated_at: now - DAY_MS,
      }])

      const payload = {
        id: 'protocol_remove_1',
        _sync: {
          clientMutationId: 'protocol-sync-remove-1',
          deviceId: 'device_1',
          clientTimestamp: now,
          baseVersions: { protocol_remove_1: 1 },
        },
      }

      const first = await healthService.removeMedicationProtocol.call(ctx, payload)
      const second = await healthService.removeMedicationProtocol.call(ctx, payload)

      expect(first.ack).toBe('accepted')
      expect(second).toEqual(first)

      const { data: protocols } = await db.collection('medication_protocols').doc('protocol_remove_1').get()
      expect(protocols[0].deleted_at).toBeTruthy()
      expect(protocols[0].version).toBe(2)
    })

    it('removeMedicationProtocol 在 baseVersion 过期时应返回 conflict', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      seedCollection('medication_protocols', [{
        _id: 'protocol_conflict_1',
        family_id: familyId,
        name: '冲突方案',
        drug_name: '甲硝唑',
        deleted_at: null,
        version: 3,
        created_at: now - DAY_MS,
        updated_at: now - DAY_MS,
      }])

      const result = await healthService.removeMedicationProtocol.call(ctx, {
        id: 'protocol_conflict_1',
        _sync: {
          clientMutationId: 'protocol-sync-conflict-1',
          deviceId: 'device_1',
          clientTimestamp: now,
          baseVersions: { protocol_conflict_1: 2 },
        },
      })

      expect(result.ack).toBe('conflict')
      expect(result.conflict).toEqual(expect.objectContaining({
        collection: 'medication_protocols',
        entityId: 'protocol_conflict_1',
        baseVersion: 2,
        serverVersion: 3,
      }))
    })
  })

  describe('体重同步', () => {
    it('addWeightRecord 应支持 _sync 稳定 ID 与幂等重放', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      const payload = {
        dog_id: 'dog_1',
        weight: 3500,
        date: now,
        notes: '晚餐前',
        _sync: {
          clientMutationId: 'weight-sync-1',
          deviceId: 'device_1',
          clientTimestamp: now,
          clientEntityIds: { dog_weights: 'weight_client_1' },
          baseVersions: { dog_1: 0 },
        },
      }

      const first = await healthService.addWeightRecord.call(ctx, payload)
      const second = await healthService.addWeightRecord.call(ctx, payload)

      expect(first.ack).toBe('accepted')
      expect(second).toEqual(first)

      const { data: weights } = await db.collection('dog_weights')
        .where({ _id: 'weight_client_1', family_id: familyId })
        .get()
      expect(weights).toHaveLength(1)
      expect(weights[0]).toMatchObject({
        dog_id: 'dog_1',
        weight: 3500,
      })

      const { data: dogs } = await db.collection('dogs').doc('dog_1').get()
      expect(dogs[0].latest_weight).toBe(3500)
    })
  })
})
