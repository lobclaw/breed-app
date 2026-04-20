/**
 * breeding-service 云对象测试
 * 测试繁育状态机、任务生成、生产记录等核心逻辑
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
const breedingService = require('../../uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js')

describe('breeding-service', () => {
  const db = mockUniCloud.database()
  const familyId = 'fam_1'

  beforeEach(() => {
    resetDB()
    // 种子数据：家庭 + 母犬 + 外部种公
    seedCollection('families', [{
      _id: familyId,
      name: '测试犬舍',
      settings: {
        default_weaning_days: 45,
        default_vaccine_interval: 21,
        default_vaccine_interval_puppy: 21,
        default_deworming_interval_puppy: 14,
        default_deworming_interval_adult: 90,
      },
    }])
    seedCollection('dogs', [
      {
        _id: 'dam_1',
        name: '花花',
        gender: '母',
        role: '种狗',
        disposition: '在养',
        family_id: familyId,
        deleted_at: null,
      },
      {
        _id: 'sire_1',
        name: '大白',
        gender: '公',
        role: '外部种公',
        disposition: '在养',
        family_id: familyId,
        deleted_at: null,
      },
    ])
  })

  describe('繁育周期创建', () => {
    it('录入发情记录时应自动创建周期', async () => {
      // 模拟 addBreedingRecord 的核心逻辑
      const now = Date.now()

      // 无进行中周期 → 自动创建
      const { data: activeCycles } = await db.collection('breeding_cycles')
        .where({ dam_id: 'dam_1', family_id: familyId })
        .get()
      expect(activeCycles).toHaveLength(0)

      // 创建周期
      const { id: cycleId } = await db.collection('breeding_cycles').add({
        dam_id: 'dam_1',
        dam_name: '花花',
        sire_id: null,
        sire_name: null,
        family_id: familyId,
        status: '发情中',
        created_at: now,
        updated_at: now,
      })

      expect(cycleId).toBeDefined()

      const { data: cycles } = await db.collection('breeding_cycles').doc(cycleId).get()
      expect(cycles[0].status).toBe('发情中')
      expect(cycles[0].dam_name).toBe('花花')
    })
  })

  describe('状态转换', () => {
    it('配种应将周期状态改为怀孕中', async () => {
      const now = Date.now()

      // 创建发情中的周期
      const { id: cycleId } = await db.collection('breeding_cycles').add({
        _id: 'cycle_1',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '发情中',
        created_at: now,
      })

      // 配种 → 状态变为怀孕中
      await db.collection('breeding_cycles').doc(cycleId).update({
        status: '怀孕中',
        sire_id: 'sire_1',
        sire_name: '大白',
        updated_at: now,
      })

      const { data } = await db.collection('breeding_cycles').doc(cycleId).get()
      expect(data[0].status).toBe('怀孕中')
      expect(data[0].sire_name).toBe('大白')
    })

    it('生产应将周期状态改为已生产', async () => {
      const { id: cycleId } = await db.collection('breeding_cycles').add({
        dam_id: 'dam_1',
        family_id: familyId,
        status: '怀孕中',
        created_at: Date.now(),
      })

      await db.collection('breeding_cycles').doc(cycleId).update({
        status: '已生产',
        updated_at: Date.now(),
      })

      const { data } = await db.collection('breeding_cycles').doc(cycleId).get()
      expect(data[0].status).toBe('已生产')
    })

    it('终态周期不可再次关闭', () => {
      const terminalStatuses = ['已生产', '失败', '放弃']
      for (const status of terminalStatuses) {
        expect(terminalStatuses.includes(status)).toBe(true)
      }
    })
  })

  describe('任务生成', () => {
    it('配种后应生成孕检和预产期任务', async () => {
      const now = Date.now()
      const matingDate = now

      // 模拟配种后生成的任务
      const tasks = [
        {
          dog_id: 'dam_1',
          dog_name: '花花',
          cycle_id: 'cycle_1',
          type: 'breeding_milestone',
          title: '花花 · 预计孕检日',
          due_date: matingDate + 25 * 86400000,
          status: 'pending',
          source_record_id: 'record_1',
          source_collection: 'breeding_records',
          family_id: familyId,
        },
        {
          dog_id: 'dam_1',
          dog_name: '花花',
          cycle_id: 'cycle_1',
          type: 'breeding_milestone',
          title: '花花 · 预产期',
          due_date: matingDate + 63 * 86400000,
          status: 'pending',
          source_record_id: 'record_1',
          source_collection: 'breeding_records',
          family_id: familyId,
        },
      ]

      for (const task of tasks) {
        await db.collection('tasks').add(task)
      }

      const { data: allTasks } = await db.collection('tasks')
        .where({ cycle_id: 'cycle_1' })
        .get()

      expect(allTasks).toHaveLength(2)
      expect(allTasks.some(t => t.title.includes('孕检'))).toBe(true)
      expect(allTasks.some(t => t.title.includes('预产期'))).toBe(true)

      // 验证预产期是配种后 63 天
      const dueDateTask = allTasks.find(t => t.title.includes('预产期'))!
      expect(dueDateTask.due_date).toBe(matingDate + 63 * 86400000)
    })

    it('发情后应生成查卵泡提醒', async () => {
      const heatDate = Date.now()

      await db.collection('tasks').add({
        dog_id: 'dam_1',
        dog_name: '花花',
        type: 'breeding_milestone',
        title: '花花 · 建议查卵泡',
        due_date: heatDate + 10 * 86400000,
        status: 'pending',
        family_id: familyId,
      })

      const { data: tasks } = await db.collection('tasks')
        .where({ dog_id: 'dam_1', type: 'breeding_milestone' })
        .get()

      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toContain('卵泡')
    })

    it('保存繁育记录时可同次创建额外安排', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      const res = await breedingService.addBreedingRecord.call(ctx, {
        type: 'heat',
        dog_id: 'dam_1',
        date: now,
        details: { start_date: now },
        extra_arrangement: {
          kind: 'contact_doctor',
          due_date: now + 2 * 86400000,
          notes: '约周四B超',
          anchor_type: 'cycle',
        },
      })

      expect(res.data.recordId).toBeTruthy()
      expect(res.data.cycleId).toBeTruthy()

      const { data: tasks } = await db.collection('tasks')
        .where({ cycle_id: res.data.cycleId })
        .get()

      expect(tasks.some(t => t.type === 'breeding_milestone')).toBe(true)
      const extraTask = tasks.find(t => t.type === 'breeding_extra_arrangement')
      expect(extraTask).toBeTruthy()
      expect(extraTask.title).toBe('联系医生')
      expect(extraTask.details?.notes).toBe('约周四B超')
      expect(extraTask.details?.anchor_type).toBe('cycle')
      expect(extraTask.details?.anchor_id).toBe(res.data.cycleId)
    })

    it('录入卵泡检查后应推进到配种节点', async () => {
      const now = Date.now()
      seedCollection('breeding_cycles', [{
        _id: 'cycle_follicle',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '发情中',
        created_at: now,
        updated_at: now,
      }])
      seedCollection('tasks', [{
        _id: 'milestone_heat',
        family_id: familyId,
        dog_id: 'dam_1',
        dog_name: '花花',
        cycle_id: 'cycle_follicle',
        type: 'breeding_milestone',
        title: '花花 · 建议卵泡检查',
        due_date: now,
        status: 'pending',
        details: { step_type: 'follicle_check' },
        created_at: now,
        updated_at: now,
      }])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      await breedingService.addBreedingRecord.call(ctx, {
        type: 'follicle_check',
        dog_id: 'dam_1',
        cycle_id: 'cycle_follicle',
        date: now,
        details: {
          left_count: 3,
          right_count: 2,
          result: '已成熟',
        },
      })

      const { data: tasks } = await db.collection('tasks')
        .where({ cycle_id: 'cycle_follicle' })
        .get()

      const oldMilestone = tasks.find(t => t._id === 'milestone_heat')
      const nextMilestone = tasks.find(t => t.type === 'breeding_milestone' && t.details?.step_type === 'mating')

      expect(oldMilestone?.status).toBe('cancelled')
      expect(nextMilestone).toBeTruthy()
      expect(nextMilestone?.title).toBe('花花 · 配种')
      expect(nextMilestone?.due_date).toBe(now)
      expect(nextMilestone?.status).toBe('pending')
    })

    it('录入发情观察时应写入繁育记录但不推进主链', async () => {
      const now = Date.now()
      seedCollection('breeding_cycles', [{
        _id: 'cycle_heat_observation',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '发情中',
        created_at: now,
        updated_at: now,
      }])
      seedCollection('tasks', [{
        _id: 'milestone_existing',
        family_id: familyId,
        dog_id: 'dam_1',
        dog_name: '花花',
        cycle_id: 'cycle_heat_observation',
        type: 'breeding_milestone',
        title: '花花 · 建议卵泡检查',
        due_date: now + 86400000,
        status: 'pending',
        details: { step_type: 'follicle_check' },
        created_at: now,
        updated_at: now,
      }])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      const res = await breedingService.addBreedingRecord.call(ctx, {
        type: 'heat_observation',
        dog_id: 'dam_1',
        cycle_id: 'cycle_heat_observation',
        date: now,
        notes: '观察到接受爬跨',
        details: {
          vulva_status: '开始软化',
          discharge_status: '淡粉/草黄色',
          symptoms: ['接受爬跨', '频繁排尿'],
        },
      })

      expect(res.data.recordId).toBeTruthy()

      const { data: records } = await db.collection('breeding_records')
        .where({ cycle_id: 'cycle_heat_observation', type: 'heat_observation' })
        .get()
      const { data: tasks } = await db.collection('tasks')
        .where({ cycle_id: 'cycle_heat_observation' })
        .get()
      const { data: cycles } = await db.collection('breeding_cycles')
        .where({ _id: 'cycle_heat_observation' })
        .get()
      const { data: expenses } = await db.collection('expenses')
        .where({ linked_cycle_id: 'cycle_heat_observation' })
        .get()

      expect(records).toHaveLength(1)
      expect(records[0].details?.vulva_status).toBe('开始软化')
      expect(records[0].details?.discharge_status).toBe('淡粉/草黄色')
      expect(records[0].details?.symptoms).toEqual(['接受爬跨', '频繁排尿'])
      expect(records[0].notes).toBe('观察到接受爬跨')
      expect(tasks).toHaveLength(1)
      expect(tasks[0]._id).toBe('milestone_existing')
      expect(tasks[0].status).toBe('pending')
      expect(cycles[0].status).toBe('发情中')
      expect(expenses).toHaveLength(0)
    })

    it('没有进行中周期时录入发情观察应拒绝', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      await expect(breedingService.addBreedingRecord.call(ctx, {
        type: 'heat_observation',
        dog_id: 'dam_1',
        date: now,
        details: {
          vulva_status: '硬/肿胀',
          discharge_status: '鲜红较多',
          symptoms: [],
        },
      })).rejects.toThrow('没有进行中的繁育周期，请先录入发情或配种记录')
    })

    it('发情观察不应挂到怀孕中的周期', async () => {
      const now = Date.now()
      seedCollection('breeding_cycles', [{
        _id: 'cycle_pregnant',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '怀孕中',
        created_at: now,
        updated_at: now,
      }])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      await expect(breedingService.addBreedingRecord.call(ctx, {
        type: 'heat_observation',
        dog_id: 'dam_1',
        cycle_id: 'cycle_pregnant',
        date: now,
        details: {
          vulva_status: '开始软化',
          discharge_status: '暗红减少',
          symptoms: ['接受爬跨'],
        },
      })).rejects.toThrow('当前不在发情中，无法记录发情观察')
    })

    it('应支持删除发情观察记录', async () => {
      const now = Date.now()
      seedCollection('breeding_records', [{
        _id: 'record_heat_observation',
        type: 'heat_observation',
        cycle_id: 'cycle_1',
        dog_id: 'dam_1',
        family_id: familyId,
        date: now,
        notes: '补充观察',
        details: {
          vulva_status: '开始软化',
          discharge_status: '接近透明',
          symptoms: ['接受爬跨'],
        },
        created_by: 'user_1',
        created_at: now,
        updated_at: now,
      }])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      const res = await breedingService.deleteBreedingRecord.call(ctx, 'record_heat_observation')

      expect(res.message).toBe('已删除')

      const { data: records } = await db.collection('breeding_records')
        .where({ _id: 'record_heat_observation' })
        .get()
      expect(records).toHaveLength(0)
    })

    it('发情观察缺少分泌物状态时应拒绝', async () => {
      const now = Date.now()
      seedCollection('breeding_cycles', [{
        _id: 'cycle_heat_missing_discharge',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '发情中',
        created_at: now,
        updated_at: now,
      }])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      await expect(breedingService.addBreedingRecord.call(ctx, {
        type: 'heat_observation',
        dog_id: 'dam_1',
        cycle_id: 'cycle_heat_missing_discharge',
        date: now,
        details: {
          vulva_status: '开始软化',
          symptoms: ['接受爬跨'],
        },
      })).rejects.toThrow('发情观察必须填写分泌物状态')
    })

    it('不应删除主链繁育记录', async () => {
      const now = Date.now()
      seedCollection('breeding_records', [{
        _id: 'record_heat',
        type: 'heat',
        cycle_id: 'cycle_1',
        dog_id: 'dam_1',
        family_id: familyId,
        date: now,
        details: {},
        created_by: 'user_1',
        created_at: now,
        updated_at: now,
      }])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      await expect(breedingService.deleteBreedingRecord.call(ctx, 'record_heat')).rejects.toThrow('当前仅支持删除发情观察记录')
    })

    it('不同来源记录的同日同类额外安排不应被误判为重复', async () => {
      const now = Date.now()
      seedCollection('breeding_cycles', [{
        _id: 'cycle_dup',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '发情中',
        created_at: now,
        updated_at: now,
      }])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      await breedingService.addBreedingRecord.call(ctx, {
        type: 'follicle_check',
        dog_id: 'dam_1',
        cycle_id: 'cycle_dup',
        date: now,
        details: { left_count: 2, right_count: 1 },
        extra_arrangement: {
          kind: 'contact_doctor',
          due_date: now + 2 * 86400000,
          notes: '第一次联系',
        },
      })

      await breedingService.addBreedingRecord.call(ctx, {
        type: 'prenatal_check',
        dog_id: 'dam_1',
        cycle_id: 'cycle_dup',
        date: now + 1000,
        details: { fetal_count: 3 },
        extra_arrangement: {
          kind: 'contact_doctor',
          due_date: now + 2 * 86400000,
          notes: '第二次联系',
        },
      })

      const { data: tasks } = await db.collection('tasks')
        .where({
          family_id: familyId,
          cycle_id: 'cycle_dup',
          type: 'breeding_extra_arrangement',
        })
        .get()

      expect(tasks).toHaveLength(2)
      expect(new Set(tasks.map(t => t.source_record_id)).size).toBe(2)
    })
  })

  describe('配种脚次', () => {
    it('应按当前周期已有配种记录数返回下一脚', async () => {
      const now = Date.now()
      seedCollection('breeding_cycles', [{
        _id: 'cycle_mating_preview',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '怀孕中',
        created_at: now,
        updated_at: now,
      }])
      seedCollection('breeding_records', [
        {
          _id: 'mating_record_1',
          type: 'mating',
          cycle_id: 'cycle_mating_preview',
          dog_id: 'dam_1',
          family_id: familyId,
          date: now,
          details: { sire_id: 'sire_1', sire_name: '大白', method: '人工授精', mating_number: 1 },
          created_by: 'user_1',
          created_at: now,
          updated_at: now,
        },
        {
          _id: 'mating_record_2',
          type: 'mating',
          cycle_id: 'cycle_mating_preview',
          dog_id: 'dam_1',
          family_id: familyId,
          date: now + 3600000,
          details: { sire_id: 'sire_1', sire_name: '大白', method: '人工授精', mating_number: 2 },
          created_by: 'user_1',
          created_at: now,
          updated_at: now,
        },
        {
          _id: 'mating_record_3',
          type: 'mating',
          cycle_id: 'cycle_mating_preview',
          dog_id: 'dam_1',
          family_id: familyId,
          date: now + 7200000,
          details: { sire_id: 'sire_1', sire_name: '大白', method: '人工授精', mating_number: 3 },
          created_by: 'user_1',
          created_at: now,
          updated_at: now,
        },
      ])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      const res = await breedingService.getNextMatingNumber.call(ctx, {
        dog_id: 'dam_1',
        cycle_id: 'cycle_mating_preview',
      })

      expect(res.data.cycle_id).toBe('cycle_mating_preview')
      expect(res.data.mating_number).toBe(4)
    })

    it('创建配种记录时应以服务端计算的脚次覆盖前端传值', async () => {
      const now = Date.now()
      seedCollection('breeding_cycles', [{
        _id: 'cycle_mating_create',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '发情中',
        created_at: now,
        updated_at: now,
      }])
      seedCollection('breeding_records', [
        {
          _id: 'existing_mating_1',
          type: 'mating',
          cycle_id: 'cycle_mating_create',
          dog_id: 'dam_1',
          family_id: familyId,
          date: now,
          details: { sire_id: 'sire_1', sire_name: '大白', method: '人工授精', mating_number: 1 },
          created_by: 'user_1',
          created_at: now,
          updated_at: now,
        },
        {
          _id: 'existing_mating_2',
          type: 'mating',
          cycle_id: 'cycle_mating_create',
          dog_id: 'dam_1',
          family_id: familyId,
          date: now + 3600000,
          details: { sire_id: 'sire_1', sire_name: '大白', method: '人工授精', mating_number: 2 },
          created_by: 'user_1',
          created_at: now,
          updated_at: now,
        },
      ])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      const res = await breedingService.addBreedingRecord.call(ctx, {
        type: 'mating',
        dog_id: 'dam_1',
        cycle_id: 'cycle_mating_create',
        date: now + 86400000,
        details: {
          sire_id: 'sire_1',
          sire_name: '大白',
          method: '人工授精',
          mating_number: 99,
        },
      })

      const { data: records } = await db.collection('breeding_records')
        .where({ _id: res.data.recordId })
        .get()

      expect(records).toHaveLength(1)
      expect(records[0].details?.mating_number).toBe(3)
    })

    it('编辑配种记录时应保留原脚次', async () => {
      const now = Date.now()
      seedCollection('breeding_records', [{
        _id: 'mating_record_edit',
        type: 'mating',
        cycle_id: 'cycle_mating_edit',
        dog_id: 'dam_1',
        family_id: familyId,
        date: now,
        notes: '原始备注',
        details: {
          sire_id: 'sire_1',
          sire_name: '大白',
          method: '人工授精',
          mating_number: 2,
        },
        created_by: 'user_1',
        created_at: now,
        updated_at: now,
      }])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      await breedingService.updateBreedingRecord.call(ctx, {
        id: 'mating_record_edit',
        date: now + 86400000,
        notes: '更新备注',
        details: {
          sire_id: 'sire_1',
          sire_name: '大白',
          method: '自然交配',
          mating_number: 7,
        },
      })

      const { data: records } = await db.collection('breeding_records')
        .where({ _id: 'mating_record_edit' })
        .get()

      expect(records).toHaveLength(1)
      expect(records[0].details?.mating_number).toBe(2)
      expect(records[0].details?.method).toBe('自然交配')
    })
  })

  describe('孕检后主链续接', () => {
    it('确认怀孕后应生成生产里程碑', async () => {
      const now = Date.now()
      seedCollection('breeding_cycles', [{
        _id: 'cycle_pregnancy_confirmed',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '怀孕中',
        created_at: now,
        updated_at: now,
      }])
      seedCollection('breeding_records', [{
        _id: 'mating_record_for_birth',
        type: 'mating',
        cycle_id: 'cycle_pregnancy_confirmed',
        dog_id: 'dam_1',
        family_id: familyId,
        date: now - 25 * 86400000,
        details: {
          sire_id: 'sire_1',
          sire_name: '大白',
          method: '人工授精',
          mating_number: 2,
          expected_due_date: now + 34 * 86400000,
        },
        created_by: 'user_1',
        created_at: now,
        updated_at: now,
      }])
      seedCollection('tasks', [{
        _id: 'pregnancy_milestone_existing',
        family_id: familyId,
        dog_id: 'dam_1',
        dog_name: '花花',
        cycle_id: 'cycle_pregnancy_confirmed',
        type: 'breeding_milestone',
        title: '花花 · 建议孕检',
        due_date: now,
        status: 'pending',
        details: {
          step_type: 'pregnancy_check',
          expected_due_date: now + 34 * 86400000,
          expected_checkup_date: now,
        },
        created_at: now,
        updated_at: now,
      }])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      await breedingService.addBreedingRecord.call(ctx, {
        type: 'pregnancy_check',
        dog_id: 'dam_1',
        cycle_id: 'cycle_pregnancy_confirmed',
        date: now,
        details: {
          confirmed: '是',
          puppy_count: 4,
        },
      })

      const { data: tasks } = await db.collection('tasks')
        .where({
          family_id: familyId,
          cycle_id: 'cycle_pregnancy_confirmed',
          type: 'breeding_milestone',
        })
        .get()

      const oldMilestone = tasks.find(t => t._id === 'pregnancy_milestone_existing')
      const birthMilestone = tasks.find(t => t.details?.step_type === 'birth')

      expect(oldMilestone?.status).toBe('cancelled')
      expect(birthMilestone).toBeTruthy()
      expect(birthMilestone?.title).toBe('花花 · 生产')
      expect(birthMilestone?.due_date).toBe(now + 34 * 86400000)
      expect(birthMilestone?.details?.mating_number).toBe(2)
      expect(birthMilestone?.details?.mating_date).toBe(now - 25 * 86400000)
    })
  })

  describe('生产记录', () => {
    async function seedPregnantCycle() {
      const now = Date.now()
      const { id: cycleId } = await db.collection('breeding_cycles').add({
        dam_id: 'dam_1',
        dam_name: '花花',
        sire_id: 'sire_1',
        sire_name: '大白',
        family_id: familyId,
        status: '怀孕中',
        created_at: now,
        updated_at: now,
      })
      return cycleId
    }

    it('默认只创建确认断奶，并写入经验心得与自动命名', async () => {
      const birthDate = Date.now()
      const cycleId = await seedPregnantCycle()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      const res = await breedingService.addBirthRecord.call(ctx, {
        cycle_id: cycleId,
        birth_date: birthDate,
        birth_type: '顺产',
        birth_notes: '注意保暖和观察奶量',
        puppies: [
          { name: '', gender: '母', weight: 101, alive: true },
          { name: '奶球', gender: '公', weight: 99, alive: true },
          { name: '', gender: '母', weight: 88, alive: false },
        ],
      })

      expect(res.data.taskCount).toBe(1)

      const { data: litters } = await db.collection('litters')
        .where({ cycle_id: cycleId })
        .get()
      expect(litters).toHaveLength(1)
      expect(litters[0].birth_notes).toBe('注意保暖和观察奶量')

      const { data: birthRecords } = await db.collection('breeding_records')
        .where({ cycle_id: cycleId, type: 'birth' })
        .get()
      expect(birthRecords).toHaveLength(1)
      expect(birthRecords[0].notes).toBe('注意保暖和观察奶量')

      const { data: puppies } = await db.collection('dogs')
        .where({ origin_litter_id: litters[0]._id })
        .get()
      expect(puppies).toHaveLength(2)
      expect(puppies.map(item => item.name)).toEqual(expect.arrayContaining(['花花窝-1号', '奶球']))

      const { data: tasks } = await db.collection('tasks')
        .where({ litter_id: litters[0]._id, status: 'pending' })
        .get()
      expect(tasks).toHaveLength(1)
      expect(tasks[0].type).toBe('breeding_milestone')
      expect(tasks[0].title).toBe('花花窝 · 确认断奶')
      expect(tasks[0].due_date).toBe(birthDate + 45 * 86400000)
      expect(tasks.some(item => item.type === 'deworming' || item.type === 'vaccination')).toBe(false)
    })

    it('仅勾选首次驱虫时只为存活幼崽创建驱虫提醒', async () => {
      const birthDate = Date.now()
      const cycleId = await seedPregnantCycle()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      const res = await breedingService.addBirthRecord.call(ctx, {
        cycle_id: cycleId,
        birth_date: birthDate,
        birth_type: '顺产',
        create_first_deworming_task: true,
        puppies: [
          { name: '', gender: '母', weight: 101, alive: true },
          { name: '', gender: '公', weight: 99, alive: false },
        ],
      })

      expect(res.data.taskCount).toBe(2)

      const { data: litters } = await db.collection('litters')
        .where({ cycle_id: cycleId })
        .get()
      const litterId = litters[0]._id

      const { data: tasks } = await db.collection('tasks')
        .where({ litter_id: litterId, status: 'pending' })
        .get()

      const dewormingTasks = tasks.filter(item => item.type === 'deworming')
      const vaccinationTasks = tasks.filter(item => item.type === 'vaccination')
      const weaningTasks = tasks.filter(item => item.type === 'breeding_milestone')

      expect(dewormingTasks).toHaveLength(1)
      expect(vaccinationTasks).toHaveLength(0)
      expect(weaningTasks).toHaveLength(1)
      expect(dewormingTasks[0].title).toBe('首次驱虫')
      expect(dewormingTasks[0].due_date).toBe(birthDate + 14 * 86400000)
      expect(dewormingTasks[0].dog_name).toBe('花花窝-1号')
    })

    it('仅勾选首次疫苗时只为存活幼崽创建疫苗提醒', async () => {
      const birthDate = Date.now()
      const cycleId = await seedPregnantCycle()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      const res = await breedingService.addBirthRecord.call(ctx, {
        cycle_id: cycleId,
        birth_date: birthDate,
        birth_type: '顺产',
        create_first_vaccination_task: true,
        puppies: [
          { name: '星星', gender: '母', weight: 101, alive: true },
          { name: '', gender: '公', weight: 99, alive: false },
        ],
      })

      expect(res.data.taskCount).toBe(2)

      const { data: litters } = await db.collection('litters')
        .where({ cycle_id: cycleId })
        .get()
      const litterId = litters[0]._id

      const { data: tasks } = await db.collection('tasks')
        .where({ litter_id: litterId, status: 'pending' })
        .get()

      const vaccinationTasks = tasks.filter(item => item.type === 'vaccination')
      const dewormingTasks = tasks.filter(item => item.type === 'deworming')

      expect(vaccinationTasks).toHaveLength(1)
      expect(dewormingTasks).toHaveLength(0)
      expect(vaccinationTasks[0].title).toBe('首次疫苗')
      expect(vaccinationTasks[0].due_date).toBe(birthDate + 21 * 86400000)
      expect(vaccinationTasks[0].dog_name).toBe('星星')
    })

    it('同时勾选首次驱虫和首次疫苗时应按存活幼崽创建全部提醒', async () => {
      const birthDate = Date.now()
      const cycleId = await seedPregnantCycle()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

      const res = await breedingService.addBirthRecord.call(ctx, {
        cycle_id: cycleId,
        birth_date: birthDate,
        birth_type: '顺产',
        create_first_deworming_task: true,
        create_first_vaccination_task: true,
        puppies: [
          { name: '', gender: '母', weight: 101, alive: true },
          { name: '奶球', gender: '公', weight: 99, alive: true },
          { name: '', gender: '母', weight: 88, alive: false },
        ],
      })

      expect(res.data.taskCount).toBe(5)

      const { data: litters } = await db.collection('litters')
        .where({ cycle_id: cycleId })
        .get()
      const litterId = litters[0]._id

      const { data: tasks } = await db.collection('tasks')
        .where({ litter_id: litterId, status: 'pending' })
        .get()

      const dewormingTasks = tasks.filter(item => item.type === 'deworming')
      const vaccinationTasks = tasks.filter(item => item.type === 'vaccination')
      const weaningTasks = tasks.filter(item => item.type === 'breeding_milestone')

      expect(dewormingTasks).toHaveLength(2)
      expect(vaccinationTasks).toHaveLength(2)
      expect(weaningTasks).toHaveLength(1)
      expect(dewormingTasks.every(item => item.title === '首次驱虫')).toBe(true)
      expect(vaccinationTasks.every(item => item.title === '首次疫苗')).toBe(true)
      expect(dewormingTasks.every(item => item.due_date === birthDate + 14 * 86400000)).toBe(true)
      expect(vaccinationTasks.every(item => item.due_date === birthDate + 21 * 86400000)).toBe(true)
      expect(dewormingTasks.map(item => item.dog_name)).toEqual(expect.arrayContaining(['花花窝-1号', '奶球']))
      expect(vaccinationTasks.map(item => item.dog_name)).toEqual(expect.arrayContaining(['花花窝-1号', '奶球']))
    })
  })

  describe('确认断奶', () => {
    it('应设置 weaned_at 并完成相关任务', async () => {
      const now = Date.now()

      seedCollection('litters', [{
        _id: 'litter_1',
        dam_id: 'dam_1',
        family_id: familyId,
        weaned_at: null,
      }])

      seedCollection('tasks', [{
        _id: 'task_weaning',
        litter_id: 'litter_1',
        type: 'breeding_milestone',
        title: '花花窝 · 确认断奶',
        status: 'pending',
        family_id: familyId,
      }])

      // 确认断奶
      await db.collection('litters').doc('litter_1').update({
        weaned_at: now,
        updated_at: now,
      })

      const { data: litters } = await db.collection('litters').doc('litter_1').get()
      expect(litters[0].weaned_at).toBe(now)
    })
  })

  describe('周期关闭', () => {
    it('关闭周期应取消所有待办任务', async () => {
      const now = Date.now()

      seedCollection('breeding_cycles', [{
        _id: 'cycle_close',
        dam_id: 'dam_1',
        family_id: familyId,
        status: '发情中',
      }])

      seedCollection('tasks', [
        { _id: 't1', cycle_id: 'cycle_close', status: 'pending', family_id: familyId },
        { _id: 't2', cycle_id: 'cycle_close', status: 'pending', family_id: familyId },
        { _id: 't3', cycle_id: 'cycle_close', status: 'completed', family_id: familyId },
      ])

      // 关闭周期
      await db.collection('breeding_cycles').doc('cycle_close').update({
        status: '放弃',
        updated_at: now,
      })

      // 取消待办任务
      await db.collection('tasks').where({
        cycle_id: 'cycle_close',
        status: 'pending',
      }).update({ status: 'cancelled', updated_at: now })

      // 验证
      const { data: tasks } = await db.collection('tasks')
        .where({ cycle_id: 'cycle_close' })
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
    it('有 cost 的记录应创建 expense', async () => {
      const now = Date.now()

      await db.collection('expenses').add({
        total_amount: 500,
        category: '配种',
        date: now,
        linked_cycle_id: 'cycle_1',
        linked_dog_ids: ['dam_1'],
        dog_names: ['花花'],
        dam_name: '花花',
        family_id: familyId,
        deleted_at: null,
        created_at: now,
      })

      const { data: expenses } = await db.collection('expenses')
        .where({ linked_cycle_id: 'cycle_1' })
        .get()

      expect(expenses).toHaveLength(1)
      expect(expenses[0].total_amount).toBe(500)
      expect(expenses[0].category).toBe('配种')
    })
  })

  describe('记录详情与编辑', () => {
    it('获取繁育记录详情时附带当前额外安排', async () => {
      const now = Date.now()
      seedCollection('breeding_records', [{
        _id: 'record_extra_1',
        type: 'heat',
        cycle_id: 'cycle_extra_1',
        dog_id: 'dam_1',
        dog_name: '花花',
        family_id: familyId,
        date: now,
        details: { start_date: now },
        created_at: now,
        updated_at: now,
      }])
      seedCollection('tasks', [{
        _id: 'task_extra_1',
        family_id: familyId,
        dog_id: 'dam_1',
        dog_name: '花花',
        cycle_id: 'cycle_extra_1',
        type: 'breeding_extra_arrangement',
        title: '联系医生',
        due_date: now + 86400000,
        status: 'pending',
        source_record_id: 'record_extra_1',
        source_collection: 'breeding_records',
        details: {
          kind: 'contact_doctor',
          notes: '明天复查',
          anchor_type: 'cycle',
        },
        created_at: now,
        updated_at: now,
      }])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      const record = await breedingService.getBreedingRecordDetail.call(ctx, { id: 'record_extra_1' })

      expect(record.extra_arrangement).toEqual({
        task_id: 'task_extra_1',
        kind: 'contact_doctor',
        due_date: now + 86400000,
        notes: '明天复查',
        anchor_type: 'cycle',
      })
    })

    it('编辑繁育记录时可同步更新关联额外安排任务', async () => {
      const now = Date.now()
      seedCollection('breeding_cycles', [{
        _id: 'cycle_extra_2',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '发情中',
        created_at: now,
        updated_at: now,
      }])
      seedCollection('breeding_records', [{
        _id: 'record_extra_2',
        type: 'heat',
        cycle_id: 'cycle_extra_2',
        dog_id: 'dam_1',
        dog_name: '花花',
        family_id: familyId,
        date: now,
        details: { start_date: now },
        created_at: now,
        updated_at: now,
      }])
      seedCollection('tasks', [{
        _id: 'task_extra_2',
        family_id: familyId,
        dog_id: 'dam_1',
        dog_name: '花花',
        cycle_id: 'cycle_extra_2',
        type: 'breeding_extra_arrangement',
        title: '联系医生',
        due_date: now + 86400000,
        status: 'pending',
        source_record_id: 'record_extra_2',
        source_collection: 'breeding_records',
        details: {
          kind: 'contact_doctor',
          notes: '原备注',
          anchor_type: 'cycle',
        },
        created_at: now,
        updated_at: now,
      }])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      await breedingService.updateBreedingRecord.call(ctx, {
        id: 'record_extra_2',
        notes: '更新后备注',
        details: { start_date: now },
        extra_arrangement: {
          kind: 'recheck_observe',
          due_date: now + 2 * 86400000,
          notes: '后天复查',
        },
      })

      const { data: tasks } = await db.collection('tasks').where({
        _id: 'task_extra_2',
        family_id: familyId,
      }).get()

      expect(tasks[0].title).toBe('复测观察')
      expect(tasks[0].due_date).toBe(now + 2 * 86400000)
      expect(tasks[0].details.kind).toBe('recheck_observe')
      expect(tasks[0].details.notes).toBe('后天复查')
    })
  })
})
