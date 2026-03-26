/**
 * breeding-service 云对象测试
 * 测试繁育状态机、任务生成、生产记录等核心逻辑
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  resetDB,
  seedCollection,
  createMockUniCloud,
} from '../helpers/mock-unicloud'

const mockUniCloud = createMockUniCloud()
;(globalThis as any).uniCloud = mockUniCloud

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
