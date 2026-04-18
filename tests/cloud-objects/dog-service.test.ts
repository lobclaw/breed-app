/**
 * dog-service 云对象测试
 * 测试犬只详情状态聚合
 */
import { describe, it, expect, beforeEach } from 'vitest'
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

  beforeEach(() => {
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
        duration_days: 3,
        actual_start_date: thirdStart,
        status: '进行中',
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
    })
    expect(medicationStatuses[1]).toMatchObject({
      taskId: 'med_other_drug',
      detail: '药3 · 1片 · 口服',
    })

    const { data: meds } = await db.collection('medication_tasks')
      .where({ dog_id: 'dog_1', family_id: familyId })
      .get()
    expect(meds).toHaveLength(3)
  })
})
