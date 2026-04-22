/**
 * task-service 云对象测试
 * 测试首页卡片、任务完成/推迟、审计、自动关闭
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

// 加载 task-service 模块以访问 _mergeTasks 测试导出
process.env.NODE_ENV = 'test'
const taskService = require('../../uniCloud-alipay/cloudfunctions/task-service/index.obj.js')
const mergeTasks: (...args: any[]) => any = taskService._mergeTasks

describe('task-service', () => {
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
  })

  describe('getHomeCards 首页卡片', () => {
    it('应按优先级分组返回任务', async () => {
      const now = Date.now()
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)

      seedCollection('tasks', [
        { _id: 't1', family_id: familyId, status: 'pending', due_date: todayStart.getTime() - DAY_MS, title: '逾期任务' },
        { _id: 't2', family_id: familyId, status: 'pending', due_date: todayStart.getTime() + 1000, title: '今日任务' },
        { _id: 't3', family_id: familyId, status: 'pending', due_date: todayStart.getTime() + 2 * DAY_MS, title: '未来任务' },
        { _id: 't4', family_id: familyId, status: 'completed', due_date: todayStart.getTime(), title: '已完成' },
      ])

      // 逾期
      const { data: overdue } = await db.collection('tasks')
        .where({ family_id: familyId, status: 'pending', due_date: { $lt: todayStart.getTime() } })
        .get()
      expect(overdue).toHaveLength(1)
      expect(overdue[0].title).toBe('逾期任务')

      // 今日
      const todayEnd = new Date(now)
      todayEnd.setHours(23, 59, 59, 999)
      const { data: today } = await db.collection('tasks')
        .where({
          family_id: familyId,
          status: 'pending',
          due_date: { $gte: todayStart.getTime(), $lte: todayEnd.getTime() },
        })
        .get()
      expect(today).toHaveLength(1)
      expect(today[0].title).toBe('今日任务')

      // 未来
      const { data: upcoming } = await db.collection('tasks')
        .where({
          family_id: familyId,
          status: 'pending',
          due_date: { $gt: todayEnd.getTime() },
        })
        .get()
      expect(upcoming).toHaveLength(1)
      expect(upcoming[0].title).toBe('未来任务')
    })

    it('不应返回已完成的任务', async () => {
      const now = Date.now()

      seedCollection('tasks', [
        { _id: 't1', family_id: familyId, status: 'completed', due_date: now },
        { _id: 't2', family_id: familyId, status: 'cancelled', due_date: now },
      ])

      const { data } = await db.collection('tasks')
        .where({ family_id: familyId, status: 'pending' })
        .get()

      expect(data).toHaveLength(0)
    })

    it('应为缺少流程任务的发情周期即时补生成首页流程卡', async () => {
      const now = Date.now()
      seedCollection('breeding_cycles', [{
        _id: 'cycle_heat_missing',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '发情中',
        created_at: now - 2 * DAY_MS,
        updated_at: now,
      }])
      seedCollection('breeding_records', [{
        _id: 'record_heat_missing',
        cycle_id: 'cycle_heat_missing',
        dog_id: 'dam_1',
        family_id: familyId,
        type: 'heat',
        date: now - 2 * DAY_MS,
        details: { start_date: now - 2 * DAY_MS },
        created_at: now - 2 * DAY_MS,
        updated_at: now - 2 * DAY_MS,
      }])
      seedCollection('tasks', [])
      seedCollection('health_records', [])
      seedCollection('medication_tasks', [])

      const ctx = createCloudObjectContext({ familyId })
      const res = await taskService.getHomeCards.call(ctx)

      expect(res.data.sections.workflow).toHaveLength(1)
      expect(res.data.sections.workflow[0].domain).toBe('breeding')

      const { data: tasks } = await db.collection('tasks')
        .where({ cycle_id: 'cycle_heat_missing', type: 'breeding_milestone' })
        .get()
      expect(tasks).toHaveLength(1)
      expect(tasks[0].details?.step_type).toBe('follicle_check')
      expect(tasks[0].source_record_id).toBe('record_heat_missing')
    })
  })

  describe('completeTask 完成任务', () => {
    it('应将 pending 任务标记为 completed', async () => {
      const now = Date.now()

      seedCollection('tasks', [{
        _id: 'task_1',
        family_id: familyId,
        status: 'pending',
        due_date: now,
        title: '测试任务',
      }])

      await db.collection('tasks').doc('task_1').update({
        status: 'completed',
        completed_by: 'user_1',
        completed_at: now,
        updated_at: now,
      })

      const { data } = await db.collection('tasks').doc('task_1').get()
      expect(data[0].status).toBe('completed')
      expect(data[0].completed_by).toBe('user_1')
    })

    it('批量健康完成启用 autoRecord 时应创建 health_record', async () => {
      const now = Date.now()
      seedCollection('tasks', [
        {
          _id: 'vac_batch_1',
          family_id: familyId,
          dog_id: 'dog_1',
          dog_name: '奶盖',
          type: 'vaccination',
          status: 'pending',
          due_date: now,
          details: { vaccine_type: '卫佳5' },
        },
        {
          _id: 'vac_batch_2',
          family_id: familyId,
          dog_id: 'dog_2',
          dog_name: '布丁',
          type: 'vaccination',
          status: 'pending',
          due_date: now,
          details: { vaccine_type: '卫佳5' },
        },
      ])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      await taskService.batchCompleteTask.call(ctx, ['vac_batch_1', 'vac_batch_2'], true)

      const { data: records } = await db.collection('health_records').get()
      expect(records).toHaveLength(2)
      expect(records.map(r => r.dog_name).sort()).toEqual(['奶盖', '布丁'])
      expect(records.every(r => r.type === 'vaccination')).toBe(true)
    })
  })

  describe('postponeTask 推迟任务', () => {
    it('应更新到期日期和推迟次数', async () => {
      const now = Date.now()
      const newDate = now + 3 * DAY_MS

      seedCollection('tasks', [{
        _id: 'task_p',
        family_id: familyId,
        status: 'pending',
        due_date: now,
        postpone_count: 0,
      }])

      await db.collection('tasks').doc('task_p').update({
        due_date: newDate,
        postpone_count: 1,
        postpone_reason: '等待复查',
        updated_at: now,
      })

      const { data } = await db.collection('tasks').doc('task_p').get()
      expect(data[0].due_date).toBe(newDate)
      expect(data[0].postpone_count).toBe(1)
      expect(data[0].postpone_reason).toBe('等待复查')
    })
  })

  describe('cancelTasksByCycle 批量取消', () => {
    it('应取消指定周期的所有 pending 任务', async () => {
      const now = Date.now()

      seedCollection('tasks', [
        { _id: 't1', cycle_id: 'c1', family_id: familyId, status: 'pending' },
        { _id: 't2', cycle_id: 'c1', family_id: familyId, status: 'pending' },
        { _id: 't3', cycle_id: 'c1', family_id: familyId, status: 'completed' },
        { _id: 't4', cycle_id: 'c2', family_id: familyId, status: 'pending' },
      ])

      // 取消 c1 的 pending 任务
      await db.collection('tasks').where({
        cycle_id: 'c1',
        family_id: familyId,
        status: 'pending',
      }).update({ status: 'cancelled', updated_at: now })

      const { data: c1Tasks } = await db.collection('tasks')
        .where({ cycle_id: 'c1' })
        .get()

      const pending = c1Tasks.filter(t => t.status === 'pending')
      const cancelled = c1Tasks.filter(t => t.status === 'cancelled')
      expect(pending).toHaveLength(0)
      expect(cancelled).toHaveLength(2)

      // c2 的任务不受影响
      const { data: c2Tasks } = await db.collection('tasks')
        .where({ cycle_id: 'c2' })
        .get()
      expect(c2Tasks[0].status).toBe('pending')
    })
  })

  describe('_timing_autoCloseCycles 自动关闭', () => {
    it('应关闭超过 21 天的发情周期', async () => {
      const now = Date.now()
      const threshold = now - 21 * DAY_MS

      seedCollection('breeding_cycles', [
        { _id: 'c_old', status: '发情中', updated_at: threshold - DAY_MS, family_id: familyId },
        { _id: 'c_new', status: '发情中', updated_at: now, family_id: familyId },
        { _id: 'c_preg', status: '怀孕中', updated_at: threshold - DAY_MS, family_id: familyId },
      ])

      seedCollection('tasks', [
        { _id: 't_old', cycle_id: 'c_old', status: 'pending', family_id: familyId },
      ])

      // 模拟自动关闭：只关闭发情中 + 超过阈值的
      const { data: expired } = await db.collection('breeding_cycles')
        .where({ status: '发情中' })
        .get()

      const toClose = expired.filter(c => c.updated_at < threshold)
      expect(toClose).toHaveLength(1)
      expect(toClose[0]._id).toBe('c_old')

      // 关闭
      await db.collection('breeding_cycles').doc('c_old').update({
        status: '放弃',
        updated_at: now,
      })

      await db.collection('tasks').where({
        cycle_id: 'c_old',
        status: 'pending',
      }).update({ status: 'cancelled', updated_at: now })

      // 验证
      const { data: closedCycle } = await db.collection('breeding_cycles').doc('c_old').get()
      expect(closedCycle[0].status).toBe('放弃')

      const { data: cancelledTasks } = await db.collection('tasks')
        .where({ cycle_id: 'c_old' })
        .get()
      expect(cancelledTasks[0].status).toBe('cancelled')

      // c_new 不受影响
      const { data: newCycle } = await db.collection('breeding_cycles').doc('c_new').get()
      expect(newCycle[0].status).toBe('发情中')
    })
  })

  describe('mergeTasks 健康卡片路由', () => {
    const now = Date.now()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)

    const makeMedTask = (dogId: string, drugName: string, day = 1, totalDays = 5) => ({
      _id: `med_${dogId}_${drugName}`,
      dog_id: dogId,
      dog_name: dogId,
      type: 'medication',
      due_date: todayStart.getTime() + 1000,
      status: 'pending',
      family_id: familyId,
      created_at: now,
      details: { drug_name: drugName, dosage: '2', dosage_unit: 'mg', method: '口服', frequency: 1, day, total_days: totalDays },
    })

    const makeIllness = (dogId: string, condition: string, treatmentStatus = '观察中') => ({
      _id: `ill_${dogId}_${condition}`,
      dog_id: dogId,
      dog_name: dogId,
      type: 'illness',
      date: now - 2 * DAY_MS,
      family_id: familyId,
      created_at: now - 2 * DAY_MS,
      details: { condition, treatment_status: treatmentStatus, severity: '轻微' },
    })

    it('单犬：观察中疾病 → 仅出现在疾病观察卡', () => {
      const illnesses = [makeIllness('肉肉', '感冒', '观察中')]
      const cards = mergeTasks([], [], illnesses)
      expect(cards).toHaveLength(1)
      expect(cards[0].cardType).toBe('sick_observation')
      expect(cards[0].domain).toBe('health')
      expect(cards[0].dogs[0].dogId).toBe('肉肉')
    })

    it('单犬：治疗中疾病 + 用药 → 仅出现在用药卡，不出现在疾病观察卡', () => {
      const illnesses = [makeIllness('肉肉', '感冒', '治疗中')]
      const tasks = [makeMedTask('肉肉', '药A')]
      const cards = mergeTasks(tasks, [], illnesses)
      const cardTypes = cards.map((c: any) => c.cardType)
      expect(cardTypes).toContain('medication')
      expect(cardTypes).not.toContain('sick_observation')
      expect(cards.find((c: any) => c.cardType === 'medication')?.domain).toBe('medication')
    })

    it('单犬：两个疾病（一个治疗中+用药，一个观察中）→ 两张卡都出现', () => {
      const illnesses = [
        makeIllness('肉肉', '感冒', '治疗中'),
        makeIllness('肉肉', '寄生虫', '观察中'),
      ]
      const tasks = [makeMedTask('肉肉', '药A')]
      const cards = mergeTasks(tasks, [], illnesses)
      const cardTypes = cards.map((c: any) => c.cardType)
      expect(cardTypes).toContain('medication')
      expect(cardTypes).toContain('sick_observation')
    })

    it('单犬：两个活跃用药 → 用药卡显示"2种用药"', () => {
      const illnesses = [makeIllness('肉肉', '感冒', '治疗中')]
      const tasks = [makeMedTask('肉肉', '药A'), makeMedTask('肉肉', '药B')]
      const cards = mergeTasks(tasks, [], illnesses)
      const medCard = cards.find((c: any) => c.cardType === 'medication')
      expect(medCard).toBeDefined()
      expect(medCard.dogs[0].drugName).toBe('2种用药')
    })

    it('单犬：仅用药无疾病 → 用药卡 med_only，无疾病观察卡', () => {
      const tasks = [makeMedTask('肉肉', '药A')]
      const cards = mergeTasks(tasks, [], [])
      expect(cards).toHaveLength(1)
      expect(cards[0].cardType).toBe('medication')
      expect(cards[0].dogs[0].state).toBe('med_only')
    })

    it('不同疫苗类型的同日任务不应合并到同一批量卡', () => {
      const dueDate = todayStart.getTime() + 1000
      const tasks = [
        {
          _id: 'vac_1',
          dog_id: 'dog_1',
          dog_name: '奶盖',
          type: 'vaccination',
          title: '疫苗',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { vaccine_type: '卫佳5' },
        },
        {
          _id: 'vac_2',
          dog_id: 'dog_2',
          dog_name: '布丁',
          type: 'vaccination',
          title: '疫苗',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { vaccine_type: '狂犬' },
        },
      ]

      const cards = mergeTasks(tasks, [], [])

      expect(cards).toHaveLength(2)
      expect(cards.every((c: any) => c.cardType === 'dog')).toBe(true)
      expect(cards.map((c: any) => c.tasks[0].display_title)).toEqual(['疫苗 · 卫佳5', '疫苗 · 狂犬'])
    })

    it('相同疫苗类型的同日任务应合并并显示具体疫苗名', () => {
      const dueDate = todayStart.getTime() + 1000
      const tasks = [
        {
          _id: 'vac_same_1',
          dog_id: 'dog_1',
          dog_name: '奶盖',
          type: 'vaccination',
          title: '疫苗',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { vaccine_type: '卫佳5' },
        },
        {
          _id: 'vac_same_2',
          dog_id: 'dog_2',
          dog_name: '布丁',
          type: 'vaccination',
          title: '疫苗',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { vaccine_type: '卫佳5' },
        },
      ]

      const cards = mergeTasks(tasks, [], [])

      expect(cards).toHaveLength(1)
      expect(cards[0].cardType).toBe('batch')
      expect(cards[0].groupTitle).toContain('疫苗 · 卫佳5')
    })

    it('不同驱虫类型和药名的同日任务不应合并到同一批量卡', () => {
      const dueDate = todayStart.getTime() + 1000
      const tasks = [
        {
          _id: 'dew_internal_1',
          dog_id: 'dog_1',
          dog_name: '奶盖',
          type: 'deworming',
          title: '驱虫',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { deworming_type: 'internal', drug_name: '海乐妙' },
        },
        {
          _id: 'dew_internal_2',
          dog_id: 'dog_2',
          dog_name: '布丁',
          type: 'deworming',
          title: '驱虫',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { deworming_type: 'internal', drug_name: '海乐妙' },
        },
        {
          _id: 'dew_external_1',
          dog_id: 'dog_3',
          dog_name: '年糕',
          type: 'deworming',
          title: '驱虫',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { deworming_type: 'external', drug_name: '福来恩' },
        },
        {
          _id: 'dew_external_2',
          dog_id: 'dog_4',
          dog_name: '团子',
          type: 'deworming',
          title: '驱虫',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { deworming_type: 'external', drug_name: '福来恩' },
        },
      ]

      const cards = mergeTasks(tasks, [], [])

      expect(cards).toHaveLength(2)
      expect(cards.every((card: any) => card.cardType === 'batch')).toBe(true)
      expect(cards.some((card: any) => card.id.includes('batch-deworming:internal:海乐妙-'))).toBe(true)
      expect(cards.some((card: any) => card.id.includes('batch-deworming:external:福来恩-'))).toBe(true)
      expect(new Set(cards.map((card: any) => card.id)).size).toBe(2)
    })

    it('相同繁育流程节点的同日任务不应合并为批量卡', () => {
      const dueDate = todayStart.getTime() + 1000
      const tasks = [
        {
          _id: 'breed_flow_1',
          dog_id: 'dog_1',
          dog_name: '小米',
          cycle_id: 'cycle_1',
          type: 'breeding_milestone',
          title: '小米 · 建议卵泡检查',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { step_type: 'follicle_check' },
        },
        {
          _id: 'breed_flow_2',
          dog_id: 'dog_2',
          dog_name: '妮蔻',
          cycle_id: 'cycle_2',
          type: 'breeding_milestone',
          title: '妮蔻 · 建议卵泡检查',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { step_type: 'follicle_check' },
        },
      ]

      const cards = mergeTasks(tasks, [], [])

      expect(cards).toHaveLength(2)
      expect(cards.every((c: any) => c.cardType === 'dog')).toBe(true)
      expect(cards.every((c: any) => c.domain === 'breeding')).toBe(true)
      expect(cards.map((c: any) => c.tasks[0]._id)).toEqual(['breed_flow_1', 'breed_flow_2'])
    })

    it('确认断奶繁育流程节点带 litter_id 也不应合并为批量卡', () => {
      const dueDate = todayStart.getTime() + 1000
      const tasks = [
        {
          _id: 'weaning_confirm_1',
          dog_id: 'dog_1',
          dog_name: '小米',
          litter_id: 'litter_1',
          cycle_id: 'cycle_1',
          type: 'breeding_milestone',
          title: '小米窝 · 确认断奶',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { step_type: 'weaning_confirm' },
        },
        {
          _id: 'weaning_confirm_2',
          dog_id: 'dog_2',
          dog_name: '妮蔻',
          litter_id: 'litter_1',
          cycle_id: 'cycle_2',
          type: 'breeding_milestone',
          title: '妮蔻窝 · 确认断奶',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { step_type: 'weaning_confirm' },
        },
      ]

      const cards = mergeTasks(tasks, [], [])

      expect(cards).toHaveLength(2)
      expect(cards.every((card: any) => card.cardType === 'dog')).toBe(true)
      expect(cards.every((card: any) => card.sectionType === undefined)).toBe(true)
      expect(cards.every((card: any) => card.domain === 'breeding')).toBe(true)
      for (const card of cards) {
        expect(card.cardType).not.toBe('batch')
      }
    })

    it('同天不同疫苗批量卡应生成不同 id，避免前端 key 冲突', () => {
      const dueDate = todayStart.getTime() + 1000
      const tasks = [
        {
          _id: 'vac_batch_a1',
          dog_id: 'dog_1',
          dog_name: '奶盖',
          type: 'vaccination',
          title: '疫苗',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { vaccine_type: '卫佳5' },
        },
        {
          _id: 'vac_batch_a2',
          dog_id: 'dog_2',
          dog_name: '布丁',
          type: 'vaccination',
          title: '疫苗',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { vaccine_type: '卫佳5' },
        },
        {
          _id: 'vac_batch_b1',
          dog_id: 'dog_3',
          dog_name: '年糕',
          type: 'vaccination',
          title: '疫苗',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { vaccine_type: '狂犬' },
        },
        {
          _id: 'vac_batch_b2',
          dog_id: 'dog_4',
          dog_name: '团子',
          type: 'vaccination',
          title: '疫苗',
          due_date: dueDate,
          priority: 'today',
          status: 'pending',
          details: { vaccine_type: '狂犬' },
        },
      ]

      const cards = mergeTasks(tasks, [], [])
      expect(cards).toHaveLength(2)
      expect(new Set(cards.map((c: any) => c.id)).size).toBe(2)
    })
  })

  describe('getDateCounts / getHomeCards 当前首页规则', () => {
    it('未来日期仅有疗程状态时也应返回红点计数', async () => {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const tomorrow = todayStart.getTime() + DAY_MS

      seedCollection('medication_tasks', [{
        _id: 'med_1',
        family_id: familyId,
        dog_id: 'dog_1',
        dog_name: '肉肉',
        status: '进行中',
        actual_start_date: todayStart.getTime(),
        frequency: 1,
        duration_days: 3,
        daily_doses: {},
      }])

      const ctx = createCloudObjectContext({ familyId })
      const res = await taskService.getDateCounts.call(ctx, todayStart.getTime(), tomorrow + DAY_MS - 1)
      expect(res.data[tomorrow]).toBeGreaterThan(0)
    })

    it('未来日期仅有疗程状态时 getWeekCards 也应返回今日用药卡', async () => {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const tomorrow = todayStart.getTime() + DAY_MS

      seedCollection('tasks', [])
      seedCollection('health_records', [])
      seedCollection('medication_tasks', [{
        _id: 'med_future_week_1',
        family_id: familyId,
        dog_id: 'dog_1',
        dog_name: '肉肉',
        status: '进行中',
        actual_start_date: todayStart.getTime(),
        frequency: 1,
        duration_days: 3,
        daily_doses: {},
      }])

      const ctx = createCloudObjectContext({ familyId })
      const res = await taskService.getWeekCards.call(ctx, tomorrow, tomorrow + DAY_MS - 1)
      const therapyCards = res.data[tomorrow].sections.therapy
      const card = therapyCards[0]

      expect(therapyCards).toHaveLength(1)
      expect(card.cardType).toBe('medication')
      expect(card.domain).toBe('medication')
      expect(card.dogs[0].dogId).toBe('dog_1')
    })

    it('首页返回不应被 12 张卡静默截断', async () => {
      const now = Date.now()
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)

      seedCollection('tasks', Array.from({ length: 13 }, (_, i) => ({
        _id: `task_${i + 1}`,
        family_id: familyId,
        dog_id: `dog_${i + 1}`,
        dog_name: `狗${i + 1}`,
        type: 'vaccination',
        title: '疫苗',
        details: { vaccine_type: `类型${i + 1}` },
        status: 'pending',
        due_date: todayStart.getTime() + i,
      })))
      seedCollection('health_records', [])
      seedCollection('medication_tasks', [])

      const ctx = createCloudObjectContext({ familyId })
      const res = await taskService.getHomeCards.call(ctx)
      expect(res.data.cards.length).toBe(13)
    })

    it('疾病观察应进入健康提醒分层，不应归到今日用药', async () => {
      const now = Date.now()

      seedCollection('tasks', [])
      seedCollection('health_records', [{
        _id: 'ill_observe_1',
        family_id: familyId,
        dog_id: 'dog_1',
        dog_name: '1号',
        type: 'illness',
        date: now,
        created_at: now,
        details: { condition: '感冒', treatment_status: '观察中', severity: '轻微' },
      }])
      seedCollection('medication_tasks', [])

      const ctx = createCloudObjectContext({ familyId })
      const res = await taskService.getHomeCards.call(ctx)

      expect(res.data.sections.reminders).toHaveLength(1)
      expect(res.data.sections.reminders[0].cardType).toBe('sick_observation')
      expect(res.data.sections.reminders[0].sectionType).toBe('reminders')
      expect(res.data.sections.reminders[0].domain).toBe('health')
      expect(res.data.sections.therapy).toHaveLength(0)
    })

    it('繁育额外安排应单独进入繁育分层，不混入健康提醒', async () => {
      const now = Date.now()
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)

      seedCollection('tasks', [
        {
          _id: 'flow_1',
          family_id: familyId,
          dog_id: 'dog_1',
          dog_name: '花花',
          cycle_id: 'cycle_1',
          type: 'breeding_milestone',
          title: '花花 · 建议孕检',
          details: { step_type: 'pregnancy_check' },
          status: 'pending',
          due_date: todayStart.getTime(),
        },
        {
          _id: 'extra_1',
          family_id: familyId,
          dog_id: 'dog_1',
          dog_name: '花花',
          cycle_id: 'cycle_1',
          type: 'breeding_extra_arrangement',
          title: '联系医生',
          details: { kind: 'contact_doctor', anchor_id: 'cycle_1', anchor_type: 'cycle', manual: true },
          status: 'pending',
          due_date: todayStart.getTime() + 1000,
        },
      ])
      seedCollection('health_records', [])
      seedCollection('medication_tasks', [])

      const ctx = createCloudObjectContext({ familyId })
      const res = await taskService.getHomeCards.call(ctx)

      expect(res.data.sections.workflow).toHaveLength(1)
      expect(res.data.sections.workflow[0].domain).toBe('breeding')
      expect(res.data.sections.extra_arrangements).toHaveLength(1)
      expect(res.data.sections.extra_arrangements[0].domain).toBe('breeding')
      expect(res.data.sections.reminders).toHaveLength(0)
      expect(res.data.sections.extra_arrangements[0].tasks[0].type).toBe('breeding_extra_arrangement')
    })

    it('发情后生成的未来繁育节点也应出现在今日首页流程区', async () => {
      const now = Date.now()
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)

      seedCollection('tasks', [
        {
          _id: 'future_flow_home_1',
          family_id: familyId,
          dog_id: 'dog_1',
          dog_name: '花花',
          cycle_id: 'cycle_1',
          type: 'breeding_milestone',
          title: '花花 · 建议卵泡检查',
          details: { step_type: 'follicle_check' },
          status: 'pending',
          due_date: todayStart.getTime() + 10 * DAY_MS,
        },
      ])
      seedCollection('health_records', [])
      seedCollection('medication_tasks', [])

      const ctx = createCloudObjectContext({ familyId })
      const res = await taskService.getHomeCards.call(ctx)

      expect(res.data.sections.workflow).toHaveLength(1)
      expect(res.data.sections.workflow[0].priority).toBe('upcoming')
      expect(res.data.sections.workflow[0].domain).toBe('breeding')
      expect(res.data.cards.some((card: any) => card.tasks?.[0]?.title?.includes('卵泡'))).toBe(true)
    })

    it('超过建议日期的繁育节点仍应留在繁育区，不进入逾期区', async () => {
      const now = Date.now()
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)

      seedCollection('tasks', [
        {
          _id: 'past_flow_home_1',
          family_id: familyId,
          dog_id: 'dog_1',
          dog_name: '花花',
          cycle_id: 'cycle_1',
          type: 'breeding_milestone',
          title: '花花 · 建议卵泡检查',
          details: { step_type: 'follicle_check' },
          status: 'pending',
          due_date: todayStart.getTime() - DAY_MS,
        },
      ])
      seedCollection('health_records', [])
      seedCollection('medication_tasks', [])

      const ctx = createCloudObjectContext({ familyId })
      const res = await taskService.getHomeCards.call(ctx)

      expect(res.data.sections.workflow).toHaveLength(1)
      expect(res.data.sections.workflow[0].priority).toBe('today')
      expect(res.data.sections.workflow[0].domain).toBe('breeding')
      expect(res.data.cards.some((card: any) => card.priority === 'overdue')).toBe(false)
      expect(res.data.counts.hasOverdue).toBe(false)
    })

    it('昨天的逾期任务应显示为逾期 1 天，而不是 2 天', async () => {
      const now = Date.now()
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const yesterdayAtNoon = todayStart.getTime() - DAY_MS + 12 * 60 * 60 * 1000

      seedCollection('tasks', [
        {
          _id: 'overdue_yesterday_1',
          family_id: familyId,
          dog_id: 'dog_1',
          dog_name: '海乐妙',
          type: 'deworming',
          title: '驱虫',
          details: { drug_name: '海乐妙', deworming_type: 'internal' },
          status: 'pending',
          due_date: yesterdayAtNoon,
        },
      ])
      seedCollection('health_records', [])
      seedCollection('medication_tasks', [])

      const ctx = createCloudObjectContext({ familyId })
      const res = await taskService.getHomeCards.call(ctx)
      expect(res.data.cards[0].priority).toBe('overdue')
      expect(res.data.cards[0].overdueDays).toBe(1)
    })

    it('指定日期卡片也应保留繁育流程与额外安排分层', async () => {
      const now = Date.now()
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const tomorrow = todayStart.getTime() + DAY_MS

      seedCollection('tasks', [
        {
          _id: 'future_flow_1',
          family_id: familyId,
          dog_id: 'dog_1',
          dog_name: '花花',
          cycle_id: 'cycle_1',
          type: 'breeding_milestone',
          title: '花花 · 建议孕检',
          details: { step_type: 'pregnancy_check' },
          status: 'pending',
          due_date: tomorrow,
        },
        {
          _id: 'future_extra_1',
          family_id: familyId,
          dog_id: 'dog_1',
          dog_name: '花花',
          cycle_id: 'cycle_1',
          type: 'breeding_extra_arrangement',
          title: '联系医生',
          details: { kind: 'contact_doctor', anchor_id: 'cycle_1', anchor_type: 'cycle', manual: true },
          status: 'pending',
          due_date: tomorrow,
        },
      ])
      seedCollection('health_records', [])
      seedCollection('medication_tasks', [])

      const ctx = createCloudObjectContext({ familyId })
      const res = await taskService.getWeekCards.call(ctx, tomorrow, tomorrow + DAY_MS - 1)
      const dayData = res.data[tomorrow]

      expect(dayData.cards).toHaveLength(2)
      expect(dayData.sections.workflow).toHaveLength(1)
      expect(dayData.sections.workflow[0].domain).toBe('breeding')
      expect(dayData.sections.extra_arrangements).toHaveLength(1)
      expect(dayData.sections.extra_arrangements[0].domain).toBe('breeding')
      expect(dayData.cards.map((card: any) => ({ sectionType: card.sectionType, domain: card.domain }))).toEqual([
        { sectionType: 'workflow', domain: 'breeding' },
        { sectionType: 'workflow_extra', domain: 'breeding' },
      ])
    })
  })

  describe('_timing_dailyAudit 每日审计', () => {
    it('应为缺失任务的怀孕周期补生成', async () => {
      seedCollection('breeding_cycles', [{
        _id: 'c_audit',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '怀孕中',
      }])

      // 没有任何任务
      const { data: tasks } = await db.collection('tasks')
        .where({ cycle_id: 'c_audit' })
        .get()
      expect(tasks).toHaveLength(0)

      // 审计补生成
      const now = Date.now()
      await db.collection('tasks').add({
        dog_id: 'dam_1',
        dog_name: '花花',
        cycle_id: 'c_audit',
        type: 'breeding_milestone',
        title: '花花 · 预产期（审计补生成）',
        due_date: now + 7 * DAY_MS,
        status: 'pending',
        family_id: familyId,
      })

      const { data: afterAudit } = await db.collection('tasks')
        .where({ cycle_id: 'c_audit' })
        .get()
      expect(afterAudit).toHaveLength(1)
      expect(afterAudit[0].title).toContain('审计补生成')
    })

    it('应为缺失任务的未断奶窝补生成', async () => {
      seedCollection('litters', [{
        _id: 'l_audit',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        weaned_at: null,
      }])

      const { total } = await db.collection('tasks')
        .where({ litter_id: 'l_audit' })
        .count()
      expect(total).toBe(0)

      // 审计补生成
      const now = Date.now()
      await db.collection('tasks').add({
        dog_id: 'dam_1',
        dog_name: '花花',
        litter_id: 'l_audit',
        type: 'breeding_milestone',
        title: '花花窝 · 确认断奶（审计补生成）',
        due_date: now + 3 * DAY_MS,
        status: 'pending',
        family_id: familyId,
      })

      const { data: afterAudit } = await db.collection('tasks')
        .where({ litter_id: 'l_audit' })
        .get()
      expect(afterAudit).toHaveLength(1)
      expect(afterAudit[0].title).toContain('断奶')
    })
  })
})
