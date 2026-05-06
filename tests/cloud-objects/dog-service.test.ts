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
      relationType: 'standalone',
      detail: '药2 · 5mg · 口服',
      meta: [
        { icon: 'link', text: '独立用药' },
        { icon: 'schedule', text: '每日3次' },
        { icon: 'check_circle', text: '已执行 1/9 次' },
      ],
    })
    expect(medicationStatuses[1]).toMatchObject({
      taskId: 'med_other_drug',
      relationType: 'standalone',
      detail: '药3 · 1片 · 口服',
      meta: [
        { icon: 'link', text: '独立用药' },
        { icon: 'schedule', text: '每日1次' },
        { icon: 'check_circle', text: '已执行 0/5 次' },
      ],
    })

    const { data: meds } = await db.collection('medication_tasks')
      .where({ dog_id: 'dog_1', family_id: familyId })
      .get()
    expect(meds).toHaveLength(3)
  })

  it('犬只详情的用药状态应标记关联来源', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    const now = new Date('2026-04-20T10:00:00+08:00').getTime()

    seedCollection('health_records', [{
      _id: 'ill_linked_1',
      type: 'illness',
      dog_id: 'dog_1',
      dog_name: '肉肉',
      family_id: familyId,
      deleted_at: null,
      date: now - 2 * 86400000,
      details: {
        primary_condition: '感冒',
        condition: '感冒',
        treatment_status: '治疗中',
      },
      created_at: now - 2 * 86400000,
      updated_at: now - 2 * 86400000,
    }])
    seedCollection('medication_tasks', [{
      _id: 'med_linked_status',
      dog_id: 'dog_1',
      dog_name: '肉肉',
      family_id: familyId,
      source_record_id: 'ill_linked_1',
      drug_name: '阿莫西林',
      dosage: '2',
      dosage_unit: 'tablet',
      method: 'oral',
      duration_days: 5,
      actual_start_date: now - 86400000,
      status: '进行中',
      created_at: now - 86400000,
      updated_at: now - 86400000,
    }])

    const result = await dogService.getDogDetail.call(ctx, 'dog_1')
    const medicationStatus = (result.data.statuses || []).find((item: any) => item.type === '用药中')

    expect(medicationStatus).toMatchObject({
      taskId: 'med_linked_status',
      relationType: 'linked',
      meta: [
        { icon: 'link', text: '关联疾病' },
        { icon: 'schedule', text: '每日1次' },
        { icon: 'check_circle', text: '已执行 0/5 次' },
      ],
    })
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
      relationType: 'standalone',
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
      relationType: 'standalone',
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

  it('犬只列表只应在存在当前有效疗程时显示用药中，且不显示任务数量', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('medication_tasks', [
      {
        _id: 'med_expired',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '旧疗程',
        duration_days: 3,
        actual_start_date: new Date('2026-04-10T09:00:00+08:00').getTime(),
        status: '进行中',
        created_at: new Date('2026-04-10T09:00:00+08:00').getTime(),
        updated_at: new Date('2026-04-10T09:00:00+08:00').getTime(),
      },
      {
        _id: 'med_active_a',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '药2',
        duration_days: 5,
        actual_start_date: new Date('2026-04-18T09:00:00+08:00').getTime(),
        status: '进行中',
        created_at: new Date('2026-04-18T09:00:00+08:00').getTime(),
        updated_at: new Date('2026-04-18T09:00:00+08:00').getTime(),
      },
      {
        _id: 'med_active_b',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '药3',
        duration_days: 7,
        actual_start_date: new Date('2026-04-19T09:00:00+08:00').getTime(),
        status: '进行中',
        created_at: new Date('2026-04-19T09:00:00+08:00').getTime(),
        updated_at: new Date('2026-04-19T09:00:00+08:00').getTime(),
      },
    ])

    const result = await dogService.getDogListWithStatus.call(ctx)
    const dog = result.data.find((item: any) => item._id === 'dog_1')
    const medicationStatus = (dog.statuses || []).find((item: any) => item.type === '用药中')

    expect(medicationStatus).toMatchObject({
      type: '用药中',
      label: '用药中',
      count: 2,
      relationType: 'standalone',
    })
  })

  it('犬只列表不应因超疗程未收口的旧任务而继续显示用药中', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    seedCollection('medication_tasks', [
      {
        _id: 'med_expired_only',
        dog_id: 'dog_1',
        dog_name: '肉肉',
        family_id: familyId,
        drug_name: '旧疗程',
        duration_days: 3,
        actual_start_date: new Date('2026-04-10T09:00:00+08:00').getTime(),
        status: '进行中',
        created_at: new Date('2026-04-10T09:00:00+08:00').getTime(),
        updated_at: new Date('2026-04-10T09:00:00+08:00').getTime(),
      },
    ])

    const result = await dogService.getDogListWithStatus.call(ctx)
    const dog = result.data.find((item: any) => item._id === 'dog_1')
    const medicationStatus = (dog.statuses || []).find((item: any) => item.type === '用药中')

    expect(medicationStatus).toBeUndefined()
  })

  it('犬只详情在未断奶且无活跃周期时，应返回可跳转的哺乳中状态与窝摘要', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    const birthTs = new Date('2026-04-15T00:00:00+08:00').getTime()

    seedCollection('litters', [
      {
        _id: 'litter_1',
        dam_id: 'dog_1',
        dam_name: '肉肉',
        sire_name: '弟弟1',
        family_id: familyId,
        cycle_id: 'cycle_1',
        birth_date: birthTs,
        total_born: 4,
        born_alive: 3,
        weaned_at: null,
        created_at: birthTs,
        updated_at: birthTs,
      },
    ])
    seedCollection('dogs', [
      {
        _id: 'dog_1',
        name: '肉肉',
        gender: '母',
        role: '种狗',
        disposition: '在养',
        family_id: familyId,
        deleted_at: null,
      },
      {
        _id: 'pup_1',
        name: '1号',
        role: '幼崽',
        disposition: '在养',
        family_id: familyId,
        origin_litter_id: 'litter_1',
        deleted_at: null,
      },
      {
        _id: 'pup_2',
        name: '2号',
        role: '幼崽',
        disposition: '自留',
        family_id: familyId,
        origin_litter_id: 'litter_1',
        deleted_at: null,
      },
      {
        _id: 'pup_3',
        name: '3号',
        role: '幼崽',
        disposition: '待售',
        family_id: familyId,
        origin_litter_id: 'litter_1',
        deleted_at: null,
      },
    ])

    const result = await dogService.getDogDetail.call(ctx, 'dog_1')
    const nursingStatus = (result.data.statuses || []).find((item: any) => item.type === '哺乳中')

    expect(nursingStatus).toMatchObject({
      type: '哺乳中',
      cycleId: 'cycle_1',
      detail: '种公: 弟弟1 · 本窝存活 3/4',
    })
    expect(nursingStatus.meta).toEqual([
      { icon: 'event', text: '生产于 2026-04-15' },
      { icon: 'schedule', text: '第6天' },
      { icon: 'favorite', text: '本窝存活 3/4' },
      { icon: 'pets', text: '在养 2 只' },
    ])
  })

  it('updateDog 不应允许通过普通编辑修改 role', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

    await expect(dogService.updateDog.call(ctx, 'dog_1', {
      role: '幼崽',
      birth_date: new Date('2024-01-01T00:00:00+08:00').getTime(),
    })).rejects.toThrow('角色不可通过普通编辑修改，请使用专门操作')

    const { data: dogs } = await db.collection('dogs')
      .where({ _id: 'dog_1', family_id: familyId })
      .get()
    expect(dogs[0].role).toBe('种狗')
  })

  it('updateDog 仍应允许更新普通档案字段', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    const birthDate = new Date('2024-01-02T00:00:00+08:00').getTime()

    const result = await dogService.updateDog.call(ctx, 'dog_1', {
      role: '种狗',
      birth_date: birthDate,
      purchase_price: 18888,
    })

    expect(result).toMatchObject({ message: '已更新' })

    const { data: dogs } = await db.collection('dogs')
      .where({ _id: 'dog_1', family_id: familyId })
      .get()
    expect(dogs[0]).toMatchObject({
      role: '种狗',
      birth_date: birthDate,
      purchase_price: 18888,
      updated_at: mockNow,
    })
  })

  it('createDog 应支持 _sync 稳定 ID 与幂等重放', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    const payload = {
      name: '豆豆',
      gender: '公',
      role: '种狗',
      purchase_price: 5200,
      _sync: {
        clientMutationId: 'dog-create-1',
        deviceId: 'device_1',
        clientTimestamp: mockNow,
        clientEntityIds: { dogs: 'dog_client_1', expenses: 'expense_client_1' },
      },
    }

    const first = await dogService.createDog.call(ctx, payload)
    const second = await dogService.createDog.call(ctx, payload)

    expect(first.ack).toBe('accepted')
    expect(second).toEqual(first)
    expect(first.data._id).toBe('dog_client_1')

    const { data: dogs } = await db.collection('dogs')
      .where({ _id: 'dog_client_1', family_id: familyId })
      .get()
    expect(dogs).toHaveLength(1)
    expect(dogs[0].version).toBe(1)

    const { data: expenses } = await db.collection('expenses')
      .where({ _id: 'expense_client_1', family_id: familyId })
      .get()
    expect(expenses).toHaveLength(1)
    expect(expenses[0].total_amount).toBe(5200)
  })

  it('updateDog 在 baseVersion 过期时应返回 conflict 且不覆盖', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    await db.collection('dogs').doc('dog_1').update({ version: 3, latest_weight: 2.5 })

    const result = await dogService.updateDog.call(ctx, 'dog_1', {
      latest_weight: 3.1,
      _sync: {
        clientMutationId: 'dog-update-conflict-1',
        deviceId: 'device_1',
        clientTimestamp: mockNow,
        baseVersions: { dog_1: 2 },
      },
    })

    expect(result.ack).toBe('conflict')
    expect(result.conflict).toMatchObject({
      collection: 'dogs',
      entityId: 'dog_1',
      baseVersion: 2,
      serverVersion: 3,
    })

    const { data: dogs } = await db.collection('dogs').doc('dog_1').get()
    expect(dogs[0].latest_weight).toBe(2.5)
  })

  it('changeDisposition 应支持 _sync 幂等重放', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    const payload = {
      id: 'dog_1',
      disposition: '已退休',
      disposition_date: mockNow,
      disposition_notes: '完成繁育',
      _sync: {
        clientMutationId: 'dog-disposition-1',
        deviceId: 'device_1',
        clientTimestamp: mockNow,
        baseVersions: { dog_1: 0 },
      },
    }

    const first = await dogService.changeDisposition.call(ctx, payload)
    const second = await dogService.changeDisposition.call(ctx, payload)

    expect(first.ack).toBe('accepted')
    expect(second).toEqual(first)

    const { data: dogs } = await db.collection('dogs').doc('dog_1').get()
    expect(dogs[0]).toMatchObject({
      disposition: '已退休',
      disposition_date: mockNow,
      disposition_notes: '完成繁育',
    })
  })

  it('changeDisposition 领养时应创建收入，改回在养时应回滚该收入', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    const adoptPayload = {
      id: 'dog_1',
      disposition: '已领养',
      disposition_date: mockNow,
      disposition_notes: '熟人安置；领养费用：¥888',
      adoption_fee: 888,
    }

    const adoptResult = await dogService.changeDisposition.call(ctx, adoptPayload)
    expect(adoptResult.ack).toBe('accepted')
    expect(adoptResult.touchedEntities).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: 'dogs', id: 'dog_1' }),
      expect.objectContaining({ collection: 'incomes' }),
    ]))

    const { data: incomesAfterAdoption } = await db.collection('incomes')
      .where({ family_id: familyId, dog_id: 'dog_1', type: '领养' })
      .get()
    expect(incomesAfterAdoption).toHaveLength(1)
    expect(incomesAfterAdoption[0]).toMatchObject({
      amount: 888,
      date: mockNow,
      notes: '熟人安置；领养费用：¥888',
    })

    const rollbackResult = await dogService.changeDisposition.call(ctx, {
      id: 'dog_1',
      disposition: '在养',
    })
    expect(rollbackResult.ack).toBe('accepted')
    expect(rollbackResult.touchedEntities).toEqual(expect.arrayContaining([
      expect.objectContaining({ collection: 'dogs', id: 'dog_1' }),
      expect.objectContaining({ collection: 'incomes', deletedAt: expect.any(Number) }),
    ]))

    const { data: incomesAfterRollback } = await db.collection('incomes')
      .where({ family_id: familyId, dog_id: 'dog_1', type: '领养' })
      .get()
    expect(incomesAfterRollback).toHaveLength(0)
  })

  it('upgradePuppyToBreeder 应支持 _sync 幂等重放', async () => {
    const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
    seedCollection('dogs', [{
      _id: 'pup_1',
      name: '奶油',
      gender: '母',
      role: '幼崽',
      disposition: '自留',
      family_id: familyId,
      deleted_at: null,
    }])

    const payload = {
      id: 'pup_1',
      _sync: {
        clientMutationId: 'dog-upgrade-1',
        deviceId: 'device_1',
        clientTimestamp: mockNow,
        baseVersions: { pup_1: 0 },
      },
    }

    const first = await dogService.upgradePuppyToBreeder.call(ctx, payload)
    const second = await dogService.upgradePuppyToBreeder.call(ctx, payload)

    expect(first.ack).toBe('accepted')
    expect(second).toEqual(first)

    const { data: dogs } = await db.collection('dogs').doc('pup_1').get()
    expect(dogs[0]).toMatchObject({
      role: '种狗',
      disposition: '在养',
    })
  })
})
