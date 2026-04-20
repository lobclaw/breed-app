/**
 * dog-service 云对象测试
 * 测试犬只详情状态聚合
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
const dogService = require('../../uniCloud-alipay/cloudfunctions/dog-service/index.obj.js')

describe('dog-service', () => {
  const db = mockUniCloud.database()
  const familyId = 'fam_1'
  const mockNow = new Date('2026-04-20T10:00:00+08:00').getTime()

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(mockNow)
    resetDB()
    seedCollection('dogs', [{
      _id: 'dog_1',
      name: '肉肉',
      gender: '母',
      role: '种狗',
      disposition: '在养',
      family_id: familyId,
      deleted_at: null,
    }])
    seedCollection('breeding_cycles', [])
    seedCollection('health_records', [])
    seedCollection('litters', [])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('犬只详情应保留不同药名的多条用药状态，并按最新疗程优先', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    const firstStart = new Date('2026-04-10T09:00:00+08:00').getTime()
    const secondStart = new Date('2026-04-18T09:00:00+08:00').getTime()
    const thirdStart = new Date('2026-04-19T09:00:00+08:00').getTime()

    seedCollection('medication_tasks', [
      {
        _id: 'med_old_same_drug',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '药2',
        dosage: '3mg',
        method: 'oral',
        duration_days: 9,
        actual_start_date: firstStart,
        status: '进行中',
        created_at: firstStart,
        updated_at: firstStart,
      },
      {
        _id: 'med_new_same_drug',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '药2',
        dosage: '5mg',
        method: 'oral',
        frequency: 3,
        duration_days: 3,
        actual_start_date: thirdStart,
        status: '进行中',
        daily_doses: {
          1: 1,
          2: 0,
          3: 0,
        },
        created_at: thirdStart,
        updated_at: thirdStart,
      },
      {
        _id: 'med_other_drug',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '药3',
        dosage: '1片',
        method: 'oral',
        duration_days: 5,
        actual_start_date: secondStart,
        status: '进行中',
        created_at: secondStart,
        updated_at: secondStart,
      },
    ])

    const result = await dogService.getDogDetail.call(ctx, 'dog_1')
    const medicationStatuses = (result.data.statuses || []).filter((item: any) => item.type === '用药中')

    expect(medicationStatuses).toHaveLength(2)
    expect(medicationStatuses[0]).toMatchObject({
      taskId: 'med_new_same_drug',
      detail: '药2 · 5mg · 口服',
      meta: [
        { icon: 'schedule', text: '每日3次' },
        { icon: 'check_circle', text: '已执行 1/9 次' },
      ],
    })
    expect(medicationStatuses[1]).toMatchObject({
      taskId: 'med_other_drug',
      detail: '药3 · 1片 · 口服',
      meta: [
        { icon: 'schedule', text: '每日1次' },
        { icon: 'check_circle', text: '已执行 0/5 次' },
      ],
    })

    const { data: meds } = await db.collection('medication_tasks')
      .where({ dog_id: 'dog_1', family_id: familyId })
      .get()
    expect(meds).toHaveLength(3)
  })

  it('犬只详情不应显示已超疗程但仍为进行中的用药任务', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('medication_tasks', [
      {
        _id: 'med_expired',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '阿莫西林',
        dosage: '3',
        dosage_unit: 'tablet',
        method: 'oral',
        duration_days: 3,
        actual_start_date: new Date('2026-04-10T09:00:00+08:00').getTime(),
        status: '进行中',
        created_at: new Date('2026-04-10T09:00:00+08:00').getTime(),
        updated_at: new Date('2026-04-10T09:00:00+08:00').getTime(),
      },
      {
        _id: 'med_active',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '切克闹',
        dosage: '8',
        dosage_unit: 'tablet',
        method: 'oral',
        duration_days: 5,
        actual_start_date: new Date('2026-04-18T09:00:00+08:00').getTime(),
        status: '进行中',
        created_at: new Date('2026-04-18T09:00:00+08:00').getTime(),
        updated_at: new Date('2026-04-18T09:00:00+08:00').getTime(),
      },
    ])

    const result = await dogService.getDogDetail.call(ctx, 'dog_1')
    const medicationStatuses = (result.data.statuses || []).filter((item: any) => item.type === '用药中')

    expect(medicationStatuses).toHaveLength(1)
    expect(medicationStatuses[0]).toMatchObject({
      taskId: 'med_active',
      detail: '切克闹 · 8片 · 口服',
    })
  })

  it('同药名新旧疗程并存时，应只显示最新且仍在有效期内的任务', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('medication_tasks', [
      {
        _id: 'med_same_drug_expired',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '药2',
        dosage: '3mg',
        method: 'oral',
        duration_days: 5,
        actual_start_date: new Date('2026-04-10T09:00:00+08:00').getTime(),
        status: '进行中',
        created_at: new Date('2026-04-10T09:00:00+08:00').getTime(),
        updated_at: new Date('2026-04-10T09:00:00+08:00').getTime(),
      },
      {
        _id: 'med_same_drug_active',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '药2',
        dosage: '5mg',
        method: 'oral',
        duration_days: 3,
        actual_start_date: new Date('2026-04-19T09:00:00+08:00').getTime(),
        status: '进行中',
        created_at: new Date('2026-04-19T09:00:00+08:00').getTime(),
        updated_at: new Date('2026-04-19T09:00:00+08:00').getTime(),
      },
    ])

    const result = await dogService.getDogDetail.call(ctx, 'dog_1')
    const medicationStatuses = (result.data.statuses || []).filter((item: any) => item.type === '用药中')

    expect(medicationStatuses).toHaveLength(1)
    expect(medicationStatuses[0]).toMatchObject({
      taskId: 'med_same_drug_active',
      detail: '药2 · 5mg · 口服',
    })
  })

  it('5条进行中任务中有2条超疗程时，详情只应返回3条当前用药状态', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('medication_tasks', [
      {
        _id: 'med_1',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '阿莫西林',
        dosage: '3',
        dosage_unit: 'tablet',
        method: 'oral',
        duration_days: 3,
        actual_start_date: new Date('2026-04-10T09:00:00+08:00').getTime(),
        status: '进行中',
        created_at: new Date('2026-04-10T09:00:00+08:00').getTime(),
        updated_at: new Date('2026-04-10T09:00:00+08:00').getTime(),
      },
      {
        _id: 'med_2',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '药2',
        dosage: '3mg',
        method: 'oral',
        duration_days: 9,
        actual_start_date: new Date('2026-04-11T09:00:00+08:00').getTime(),
        status: '进行中',
        created_at: new Date('2026-04-11T09:00:00+08:00').getTime(),
        updated_at: new Date('2026-04-11T09:00:00+08:00').getTime(),
      },
      {
        _id: 'med_3',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '药3',
        dosage: '4mg',
        method: 'oral',
        duration_days: 7,
        actual_start_date: new Date('2026-04-14T09:00:00+08:00').getTime(),
        status: '进行中',
        created_at: new Date('2026-04-14T09:00:00+08:00').getTime(),
        updated_at: new Date('2026-04-14T09:00:00+08:00').getTime(),
      },
      {
        _id: 'med_4',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '切克闹',
        dosage: '8',
        dosage_unit: 'tablet',
        method: 'oral',
        duration_days: 3,
        actual_start_date: new Date('2026-04-18T09:00:00+08:00').getTime(),
        status: '进行中',
        created_at: new Date('2026-04-18T09:00:00+08:00').getTime(),
        updated_at: new Date('2026-04-18T09:00:00+08:00').getTime(),
      },
      {
        _id: 'med_5',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '大胃王',
        dosage: '4mg',
        method: 'oral',
        duration_days: 1,
        actual_start_date: new Date('2026-04-20T09:00:00+08:00').getTime(),
        status: '进行中',
        created_at: new Date('2026-04-20T09:00:00+08:00').getTime(),
        updated_at: new Date('2026-04-20T09:00:00+08:00').getTime(),
      },
    ])

    const result = await dogService.getDogDetail.call(ctx, 'dog_1')
    const medicationStatuses = (result.data.statuses || []).filter((item: any) => item.type === '用药中')

    expect(medicationStatuses).toHaveLength(3)
    expect(medicationStatuses.map((item: any) => item.taskId)).toEqual(['med_5', 'med_4', 'med_3'])
  })
})
