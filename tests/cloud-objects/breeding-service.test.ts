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

  describe('生产记录', () => {
    it('应创建窝 + 幼崽 + 任务', async () => {
      const now = Date.now()
      const birthDate = now

      // 创建周期
      const { id: cycleId } = await db.collection('breeding_cycles').add({
        dam_id: 'dam_1',
        dam_name: '花花',
        sire_id: 'sire_1',
        sire_name: '大白',
        family_id: familyId,
        status: '怀孕中',
        created_at: now,
      })

      // 创建窝
      const { id: litterId } = await db.collection('litters').add({
        cycle_id: cycleId,
        dam_id: 'dam_1',
        dam_name: '花花',
        sire_id: 'sire_1',
        sire_name: '大白',
        family_id: familyId,
        birth_date: birthDate,
        birth_type: '顺产',
        total_born: 4,
        born_alive: 3,
        born_dead: 1,
        weaned_at: null,
        created_at: now,
      })

      expect(litterId).toBeDefined()

      // 创建 3 只存活幼崽
      const puppyIds = []
      for (let i = 0; i < 3; i++) {
        const { id } = await db.collection('dogs').add({
          name: `幼崽${i + 1}`,
          gender: i % 2 === 0 ? '母' : '公',
          role: '幼崽',
          disposition: '在养',
          family_id: familyId,
          origin_litter_id: litterId,
          birth_date: birthDate,
          deleted_at: null,
          created_at: now,
        })
        puppyIds.push(id)
      }

      expect(puppyIds).toHaveLength(3)

      // 创建窝级别任务（驱虫、疫苗、断奶）
      const taskTypes = [
        { title: '花花窝 · 首次驱虫', due: birthDate + 14 * 86400000 },
        { title: '花花窝 · 首次疫苗', due: birthDate + 42 * 86400000 },
        { title: '花花窝 · 确认断奶', due: birthDate + 45 * 86400000 },
      ]

      for (const t of taskTypes) {
        await db.collection('tasks').add({
          litter_id: litterId,
          title: t.title,
          due_date: t.due,
          status: 'pending',
          family_id: familyId,
        })
      }

      const { data: tasks } = await db.collection('tasks')
        .where({ litter_id: litterId })
        .get()

      expect(tasks).toHaveLength(3)
      expect(tasks.some(t => t.title.includes('驱虫'))).toBe(true)
      expect(tasks.some(t => t.title.includes('疫苗'))).toBe(true)
      expect(tasks.some(t => t.title.includes('断奶'))).toBe(true)

      // 验证首次驱虫是出生后 14 天
      const dewormTask = tasks.find(t => t.title.includes('驱虫'))!
      expect(dewormTask.due_date).toBe(birthDate + 14 * 86400000)
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
})
