/**
 * task-service 云对象测试
 * 测试首页卡片、任务完成/推迟、审计、自动关闭
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

// 加载 task-service 模块以访问 _mergeTasks 测试导出
process.env.NODE_ENV = 'test'
const taskService = require('../../uniCloud-alipay/cloudfunctions/task-service/index.obj.js')
const mergeTasks: (...args: any[]) => any = taskService._mergeTasks
const buildMorningSummaryPayload: (...args: any[]) => any = taskService._buildMorningSummaryPayload

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

  afterEach(() => {
    vi.restoreAllMocks()
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
      expect(tasks[0].details?.follicle_check_count).toBe(0)
      expect(tasks[0].source_record_id).toBe('record_heat_missing')
    })

    it('应根据最近一次卵泡检查结果补生成正确的首页流程卡', async () => {
      const now = Date.now()
      seedCollection('breeding_cycles', [{
        _id: 'cycle_follicle_missing',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '发情中',
        created_at: now - 4 * DAY_MS,
        updated_at: now,
      }])
      seedCollection('breeding_records', [
        {
          _id: 'record_heat_cycle',
          cycle_id: 'cycle_follicle_missing',
          dog_id: 'dam_1',
          family_id: familyId,
          type: 'heat',
          date: now - 4 * DAY_MS,
          created_at: now - 4 * DAY_MS,
          updated_at: now - 4 * DAY_MS,
        },
        {
          _id: 'record_follicle_cycle',
          cycle_id: 'cycle_follicle_missing',
          dog_id: 'dam_1',
          family_id: familyId,
          type: 'follicle_check',
          date: now - DAY_MS,
          details: { result: '发育中' },
          created_at: now - DAY_MS,
          updated_at: now - DAY_MS,
        },
      ])
      seedCollection('tasks', [])
      seedCollection('health_records', [])
      seedCollection('medication_tasks', [])

      const ctx = createCloudObjectContext({ familyId })
      const res = await taskService.getHomeCards.call(ctx)

      expect(res.data.sections.workflow).toHaveLength(1)

      const { data: tasks } = await db.collection('tasks')
        .where({ cycle_id: 'cycle_follicle_missing', type: 'breeding_milestone' })
        .get()

      expect(tasks).toHaveLength(1)
      expect(tasks[0].details?.step_type).toBe('follicle_check')
      expect(tasks[0].details?.follicle_check_count).toBe(1)
      expect(tasks[0].details?.follicle_result).toBe('发育中')
      expect(tasks[0].details?.latest_follicle_check_date).toBe(now - DAY_MS)
      expect(tasks[0].due_date).toBe(now)
    })

    it('多次卵泡检查时应记录累计检查次数并取最近一次结果', async () => {
      const now = Date.now()
      seedCollection('breeding_cycles', [{
        _id: 'cycle_follicle_multi_missing',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '发情中',
        created_at: now - 5 * DAY_MS,
        updated_at: now,
      }])
      seedCollection('breeding_records', [
        {
          _id: 'record_heat_multi_cycle',
          cycle_id: 'cycle_follicle_multi_missing',
          dog_id: 'dam_1',
          family_id: familyId,
          type: 'heat',
          date: now - 5 * DAY_MS,
          created_at: now - 5 * DAY_MS,
          updated_at: now - 5 * DAY_MS,
        },
        {
          _id: 'record_follicle_multi_1',
          cycle_id: 'cycle_follicle_multi_missing',
          dog_id: 'dam_1',
          family_id: familyId,
          type: 'follicle_check',
          date: now - 3 * DAY_MS,
          details: { result: '发育中' },
          created_at: now - 3 * DAY_MS,
          updated_at: now - 3 * DAY_MS,
        },
        {
          _id: 'record_follicle_multi_2',
          cycle_id: 'cycle_follicle_multi_missing',
          dog_id: 'dam_1',
          family_id: familyId,
          type: 'follicle_check',
          date: now - DAY_MS,
          details: { result: '其他' },
          created_at: now - DAY_MS,
          updated_at: now - DAY_MS,
        },
      ])
      seedCollection('tasks', [])
      seedCollection('health_records', [])
      seedCollection('medication_tasks', [])

      const ctx = createCloudObjectContext({ familyId })
      await taskService.getHomeCards.call(ctx)

      const { data: tasks } = await db.collection('tasks')
        .where({ cycle_id: 'cycle_follicle_multi_missing', type: 'breeding_milestone' })
        .get()

      expect(tasks).toHaveLength(1)
      expect(tasks[0].details?.step_type).toBe('follicle_check')
      expect(tasks[0].details?.follicle_check_count).toBe(2)
      expect(tasks[0].details?.follicle_result).toBe('其他')
      expect(tasks[0].details?.latest_follicle_check_date).toBe(now - DAY_MS)
    })

    it('应为发育不良的卵泡检查补生成异常强化标记', async () => {
      const now = Date.now()
      seedCollection('breeding_cycles', [{
        _id: 'cycle_follicle_abnormal_missing',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '发情中',
        created_at: now - 3 * DAY_MS,
        updated_at: now,
      }])
      seedCollection('breeding_records', [
        {
          _id: 'record_heat_abnormal_cycle',
          cycle_id: 'cycle_follicle_abnormal_missing',
          dog_id: 'dam_1',
          family_id: familyId,
          type: 'heat',
          date: now - 3 * DAY_MS,
          created_at: now - 3 * DAY_MS,
          updated_at: now - 3 * DAY_MS,
        },
        {
          _id: 'record_follicle_abnormal_cycle',
          cycle_id: 'cycle_follicle_abnormal_missing',
          dog_id: 'dam_1',
          family_id: familyId,
          type: 'follicle_check',
          date: now,
          details: { result: '发育不良' },
          created_at: now,
          updated_at: now,
        },
      ])
      seedCollection('tasks', [])
      seedCollection('health_records', [])
      seedCollection('medication_tasks', [])

      const ctx = createCloudObjectContext({ familyId })
      await taskService.getHomeCards.call(ctx)

      const { data: tasks } = await db.collection('tasks')
        .where({ cycle_id: 'cycle_follicle_abnormal_missing', type: 'breeding_milestone' })
        .get()

      expect(tasks).toHaveLength(1)
      expect(tasks[0].details?.step_type).toBe('follicle_check')
      expect(tasks[0].details?.follicle_check_count).toBe(1)
      expect(tasks[0].details?.abnormal_result).toBe(true)
      expect(tasks[0].details?.follicle_result).toBe('发育不良')
    })

    it('最近一次卵泡检查已成熟时应迁移为配种 milestone', async () => {
      const now = Date.now()
      seedCollection('breeding_cycles', [{
        _id: 'cycle_follicle_ready_missing',
        dam_id: 'dam_1',
        dam_name: '花花',
        family_id: familyId,
        status: '发情中',
        created_at: now - 4 * DAY_MS,
        updated_at: now,
      }])
      seedCollection('breeding_records', [
        {
          _id: 'record_heat_ready_cycle',
          cycle_id: 'cycle_follicle_ready_missing',
          dog_id: 'dam_1',
          family_id: familyId,
          type: 'heat',
          date: now - 4 * DAY_MS,
          created_at: now - 4 * DAY_MS,
          updated_at: now - 4 * DAY_MS,
        },
        {
          _id: 'record_follicle_ready_cycle',
          cycle_id: 'cycle_follicle_ready_missing',
          dog_id: 'dam_1',
          family_id: familyId,
          type: 'follicle_check',
          date: now - DAY_MS,
          details: { result: '已成熟' },
          created_at: now - DAY_MS,
          updated_at: now - DAY_MS,
        },
      ])
      seedCollection('tasks', [])
      seedCollection('health_records', [])
      seedCollection('medication_tasks', [])

      const ctx = createCloudObjectContext({ familyId })
      await taskService.getHomeCards.call(ctx)

      const { data: tasks } = await db.collection('tasks')
        .where({ cycle_id: 'cycle_follicle_ready_missing', type: 'breeding_milestone' })
        .get()

      expect(tasks).toHaveLength(1)
      expect(tasks[0].details?.step_type).toBe('mating')
      expect(tasks[0].details?.follicle_result).toBe('已成熟')
      expect(tasks[0].details?.follicle_check_count).toBeUndefined()
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
      const result = await taskService.batchCompleteTask.call(ctx, ['vac_batch_1', 'vac_batch_2'], true)

      const { data: records } = await db.collection('health_records').get()
      expect(result.data.completedTaskIds).toEqual(['vac_batch_1', 'vac_batch_2'])
      expect(records).toHaveLength(2)
      expect(records.map(r => r.dog_name).sort()).toEqual(['奶盖', '布丁'])
      expect(records.every(r => r.type === 'vaccination')).toBe(true)
    })

    it('批量健康完成启用 autoRecord 且带费用时应创建 expense', async () => {
      const now = Date.now()
      seedCollection('tasks', [
        {
          _id: 'vac_batch_cost_1',
          family_id: familyId,
          dog_id: 'dog_1',
          dog_name: '奶盖',
          type: 'vaccination',
          status: 'pending',
          due_date: now,
          details: { vaccine_type: '卫佳5', cost: 88, notes: '门店接种' },
        },
      ])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      const result = await taskService.batchCompleteTask.call(ctx, ['vac_batch_cost_1'], true)

      const { data: records } = await db.collection('health_records').get()
      const { data: expenses } = await db.collection('expenses').get()
      expect(result.touchedEntities).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'health_records' }),
        expect.objectContaining({ collection: 'expenses' }),
      ]))
      expect(records).toHaveLength(1)
      expect(records[0]).toMatchObject({ cost: 88, notes: '门店接种' })
      expect(expenses).toHaveLength(1)
      expect(expenses[0]).toMatchObject({
        category: '疫苗驱虫',
        total_amount: 88,
        notes: '疫苗 · 门店接种',
      })
    })

    it('批量完成没有 pending 任务时不应写入 0 条操作日志', async () => {
      const now = Date.now()
      seedCollection('tasks', [{
        _id: 'task_done_1',
        family_id: familyId,
        dog_id: 'dog_1',
        dog_name: '奶盖',
        type: 'vaccination',
        status: 'completed',
        due_date: now,
        title: '疫苗',
      }])
      seedCollection('operation_logs', [])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      const result = await taskService.batchCompleteTask.call(ctx, ['task_done_1'], false)

      const { data: logs } = await db.collection('operation_logs').where({ family_id: familyId }).get()
      expect(result.data.completed).toBe(0)
      expect(logs).toHaveLength(0)
    })

    it('completeTask 应支持 _sync 幂等重放并返回 touchedEntities', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      seedCollection('tasks', [{
        _id: 'task_sync_1',
        family_id: familyId,
        dog_id: 'dog_1',
        dog_name: '花花',
        type: 'vaccination',
        title: '疫苗',
        status: 'pending',
        due_date: now,
        version: 3,
        created_at: now - DAY_MS,
        updated_at: now - DAY_MS,
      }])

      const payload = {
        taskId: 'task_sync_1',
        autoRecord: false,
        _sync: {
          clientMutationId: 'mutation_task_sync_1',
          deviceId: 'device_a',
          baseVersions: { task_sync_1: 3 },
          clientTimestamp: now,
        },
      }

      const first = await taskService.completeTask.call(ctx, payload)
      expect(first.ack).toBe('accepted')
      expect(first.clientMutationId).toBe('mutation_task_sync_1')
      expect(first.touchedEntities).toEqual([
        expect.objectContaining({ collection: 'tasks', id: 'task_sync_1', version: 4 }),
      ])

      const second = await taskService.completeTask.call(ctx, payload)
      expect(second).toEqual(first)

      const { data: tasks } = await db.collection('tasks').doc('task_sync_1').get()
      expect(tasks[0].status).toBe('completed')
      expect(tasks[0].version).toBe(4)
    })

    it('completeTask 自动建疫苗记录且带费用时应创建 expense', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      seedCollection('tasks', [{
        _id: 'task_sync_cost_1',
        family_id: familyId,
        dog_id: 'dog_1',
        dog_name: '花花',
        type: 'vaccination',
        title: '疫苗',
        status: 'pending',
        due_date: now,
        details: {
          vaccine_type: '卫佳5',
          cost: 66,
          notes: '上门接种',
        },
        version: 1,
        created_at: now - DAY_MS,
        updated_at: now - DAY_MS,
      }])

      const result = await taskService.completeTask.call(ctx, {
        taskId: 'task_sync_cost_1',
        autoRecord: true,
      })

      expect(result.ack).toBe('accepted')
      expect(result.touchedEntities).toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'tasks', id: 'task_sync_cost_1' }),
        expect.objectContaining({ collection: 'health_records' }),
        expect.objectContaining({ collection: 'expenses' }),
      ]))

      const { data: expenses } = await db.collection('expenses').get()
      expect(expenses).toHaveLength(1)
      expect(expenses[0]).toMatchObject({
        category: '疫苗驱虫',
        total_amount: 66,
        notes: '疫苗 · 上门接种',
      })
    })
  })

  describe('batchCreateManualTasks 批量创建待办', () => {
    it('所有待办已存在时不应写入 0 条操作日志', async () => {
      const now = Date.now()
      seedCollection('tasks', [{
        _id: 'existing_task_1',
        family_id: familyId,
        dog_id: 'dog_1',
        dog_name: '奶盖',
        type: 'vaccination',
        status: 'pending',
        due_date: now,
        title: '疫苗',
        details: { vaccine_type: '卫佳5' },
      }])
      seedCollection('operation_logs', [])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      const result = await taskService.batchCreateManualTasks.call(ctx, {
        dogs: [{ dog_id: 'dog_1', dog_name: '奶盖' }],
        type: 'vaccination',
        due_date: now,
        details: { vaccine_type: '卫佳5' },
      })

      const { data: logs } = await db.collection('operation_logs').where({ family_id: familyId }).get()
      expect(result.data.created).toBe(0)
      expect(result.data.skipped).toBe(1)
      expect(logs).toHaveLength(0)
    })

    it('当天已存在相同健康记录时不应再次创建同日相同待办', async () => {
      const now = Date.now()
      seedCollection('health_records', [{
        _id: 'existing_health_record_1',
        family_id: familyId,
        dog_id: 'dog_1',
        dog_name: '奶盖',
        type: 'vaccination',
        date: now - 3600000,
        details: { vaccine_type: '卫佳5' },
        created_at: now - 3600000,
        updated_at: now - 3600000,
      }])
      seedCollection('operation_logs', [])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      const result = await taskService.batchCreateManualTasks.call(ctx, {
        dogs: [{ dog_id: 'dog_1', dog_name: '奶盖' }],
        type: 'vaccination',
        due_date: now,
        details: { vaccine_type: '卫佳5' },
      })

      const { data: tasks } = await db.collection('tasks').where({ family_id: familyId, dog_id: 'dog_1' }).get()
      const { data: logs } = await db.collection('operation_logs').where({ family_id: familyId }).get()
      expect(result.data.created).toBe(0)
      expect(result.data.skipped).toBe(1)
      expect(result.data.skippedDogs).toEqual([{
        dog_id: 'dog_1',
        dog_name: '奶盖',
        reason: 'existing_record',
      }])
      expect(tasks).toHaveLength(0)
      expect(logs).toHaveLength(0)
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

    it('batchPostponeTask 应一次性更新多个 pending 任务并返回 ids', async () => {
      const now = Date.now()
      const newDate = now + 2 * DAY_MS
      seedCollection('tasks', [
        {
          _id: 'task_batch_postpone_1',
          family_id: familyId,
          status: 'pending',
          due_date: now,
          postpone_count: 0,
        },
        {
          _id: 'task_batch_postpone_2',
          family_id: familyId,
          status: 'pending',
          due_date: now,
          postpone_count: 1,
        },
        {
          _id: 'task_batch_postpone_done',
          family_id: familyId,
          status: 'completed',
          due_date: now,
          postpone_count: 3,
        },
      ])

      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      const result = await taskService.batchPostponeTask.call(ctx, [
        'task_batch_postpone_1',
        'task_batch_postpone_2',
        'task_batch_postpone_done',
      ], newDate, '统一顺延')

      expect(result.data.postponedTaskIds).toEqual(['task_batch_postpone_1', 'task_batch_postpone_2'])

      const { data: tasks } = await db.collection('tasks').where({ family_id: familyId }).get()
      const taskMap = new Map(tasks.map(task => [task._id, task]))
      expect(taskMap.get('task_batch_postpone_1')?.due_date).toBe(newDate)
      expect(taskMap.get('task_batch_postpone_1')?.postpone_count).toBe(1)
      expect(taskMap.get('task_batch_postpone_2')?.postpone_count).toBe(2)
      expect(taskMap.get('task_batch_postpone_done')?.due_date).toBe(now)
      expect(taskMap.get('task_batch_postpone_done')?.postpone_count).toBe(3)
    })

    it('postponeTask 在 baseVersion 过期时应返回 conflict 且不写入', async () => {
      const now = Date.now()
      const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
      seedCollection('tasks', [{
        _id: 'task_conflict_1',
        family_id: familyId,
        status: 'pending',
        due_date: now,
        version: 5,
        created_at: now - DAY_MS,
        updated_at: now - DAY_MS,
      }])

      const result = await taskService.postponeTask.call(ctx, {
        taskId: 'task_conflict_1',
        newDate: now + DAY_MS,
        _sync: {
          clientMutationId: 'mutation_task_conflict_1',
          deviceId: 'device_a',
          baseVersions: { task_conflict_1: 4 },
          clientTimestamp: now,
        },
      })

      expect(result.ack).toBe('conflict')
      expect(result.conflict).toEqual(expect.objectContaining({
        collection: 'tasks',
        entityId: 'task_conflict_1',
        baseVersion: 4,
        serverVersion: 5,
      }))

      const { data: task } = await db.collection('tasks').doc('task_conflict_1').get()
      expect(task[0].due_date).toBe(now)
      expect(task[0].version).toBe(5)
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

    const makeIllness = (dogId: string, condition: string, treatmentStatus = '观察中', symptomTags: string[] = []) => ({
      _id: `ill_${dogId}_${condition}`,
      dog_id: dogId,
      dog_name: dogId,
      type: 'illness',
      date: now - 2 * DAY_MS,
      family_id: familyId,
      created_at: now - 2 * DAY_MS,
      details: { primary_condition: condition, condition, symptom_tags: symptomTags, treatment_status: treatmentStatus, severity: '轻微' },
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
      expect(cards.find((c: any) => c.cardType === 'medication')?.dogs[0].relationType).toBe('fallback')
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

    it('单犬多疾病时，应优先按 source_record_id 关联到正确疾病', () => {
      const illnesses = [
        makeIllness('肉肉', '感冒', '治疗中'),
        makeIllness('肉肉', '皮肤病', '观察中', ['抓挠', '皮屑']),
      ]
      const medItems = [{
        _id: 'med_linked_1',
        dog_id: '肉肉',
        dog_name: '肉肉',
        drug_name: '药A',
        dosage: '2',
        dosage_unit: 'mg',
        method: '口服',
        frequency: 1,
        duration_days: 5,
        currentDay: 1,
        todayDoses: 0,
        isDoneToday: false,
        created_at: now,
        source_record_id: 'ill_肉肉_感冒',
      }]

      const cards = mergeTasks([], [], illnesses, medItems)
      const medCard = cards.find((card: any) => card.cardType === 'medication')
      const sickCard = cards.find((card: any) => card.cardType === 'sick_observation')

      expect(medCard?.dogs[0].state).toBe('sick_with_med')
      expect(medCard?.dogs[0].illness).toBe('感冒')
      expect(medCard?.dogs[0].illnessId).toBe('ill_肉肉_感冒')
      expect(medCard?.dogs[0].relationType).toBe('linked')
      expect(sickCard?.dogs).toHaveLength(1)
      expect(sickCard?.dogs[0].illness).toBe('皮肤病')
      expect(sickCard?.dogs[0].symptomSummary).toBe('抓挠 / 皮屑')
    })

    it('单犬：两个活跃用药 → 用药卡显示"2种用药"', () => {
      const illnesses = [makeIllness('肉肉', '感冒', '治疗中')]
      const tasks = [makeMedTask('肉肉', '药A'), makeMedTask('肉肉', '药B')]
      const cards = mergeTasks(tasks, [], illnesses)
      const medCard = cards.find((c: any) => c.cardType === 'medication')
      expect(medCard).toBeDefined()
      expect(medCard.dogs[0].drugName).toBe('2种用药')
    })

    it('单犬：多条治疗中疾病合并到今日用药时，应保留全部 illnessIds 供批量康复使用', () => {
      const now = Date.now()
      const illnesses = [
        makeIllness('肉肉', '感冒', '治疗中'),
        makeIllness('肉肉', '腹泻', '治疗中'),
      ]
      const tasks = [
        {
          _id: 'med_linked_cold',
          dog_id: '肉肉',
          dog_name: '肉肉',
          drug_name: '药A',
          dosage: '1',
          dosage_unit: 'mg',
          method: '口服',
          frequency: 1,
          duration_days: 5,
          currentDay: 1,
          todayDoses: 0,
          isDoneToday: false,
          created_at: now,
          source_record_id: 'ill_肉肉_感冒',
        },
        {
          _id: 'med_linked_diarrhea',
          dog_id: '肉肉',
          dog_name: '肉肉',
          drug_name: '药B',
          dosage: '1',
          dosage_unit: 'mg',
          method: '口服',
          frequency: 1,
          duration_days: 5,
          currentDay: 1,
          todayDoses: 0,
          isDoneToday: false,
          created_at: now,
          source_record_id: 'ill_肉肉_腹泻',
        },
      ]

      const cards = mergeTasks([], [], illnesses, tasks)
      const medCard = cards.find((card: any) => card.cardType === 'medication')

      expect(medCard?.dogs[0].state).toBe('sick_with_med')
      expect(medCard?.dogs[0].illnessId).toBe('')
      expect(medCard?.dogs[0].illnessIds).toEqual(['ill_肉肉_感冒', 'ill_肉肉_腹泻'])
    })

    it('单犬：仅用药无疾病 → 用药卡 med_only，无疾病观察卡', () => {
      const tasks = [makeMedTask('肉肉', '药A')]
      const cards = mergeTasks(tasks, [], [])
      expect(cards).toHaveLength(1)
      expect(cards[0].cardType).toBe('medication')
      expect(cards[0].dogs[0].state).toBe('med_only')
      expect(cards[0].dogs[0].relationType).toBe('standalone')
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

    it('同一周期残留重复繁育里程碑时，首页与红点都应按单条流程卡展示', async () => {
      const now = Date.now()
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)

      seedCollection('tasks', [
        {
          _id: 'flow_duplicate_old',
          family_id: familyId,
          dog_id: 'dog_1',
          dog_name: '花花',
          cycle_id: 'cycle_duplicate_1',
          type: 'breeding_milestone',
          title: '花花 · 建议卵泡检查',
          details: { step_type: 'follicle_check' },
          status: 'pending',
          due_date: todayStart.getTime() + 10 * DAY_MS,
          created_at: now - 2000,
          updated_at: now - 2000,
        },
        {
          _id: 'flow_duplicate_new',
          family_id: familyId,
          dog_id: 'dog_1',
          dog_name: '花花',
          cycle_id: 'cycle_duplicate_1',
          type: 'breeding_milestone',
          title: '花花 · 建议卵泡检查',
          details: { step_type: 'follicle_check' },
          status: 'pending',
          due_date: todayStart.getTime() + 10 * DAY_MS,
          created_at: now - 1000,
          updated_at: now - 1000,
        },
      ])
      seedCollection('health_records', [])
      seedCollection('medication_tasks', [])

      const targetDay = todayStart.getTime() + 10 * DAY_MS
      const ctx = createCloudObjectContext({ familyId })
      const homeRes = await taskService.getHomeCards.call(ctx)
      const dateCountRes = await taskService.getDateCounts.call(ctx, targetDay, targetDay + DAY_MS - 1)
      const weekRes = await taskService.getWeekCards.call(ctx, targetDay, targetDay + DAY_MS - 1)

      expect(homeRes.data.sections.workflow).toHaveLength(1)
      expect(homeRes.data.sections.workflow[0].tasks[0]._id).toBe('flow_duplicate_new')
      expect(dateCountRes.data[targetDay]).toBe(1)
      expect(weekRes.data[targetDay].sections.workflow).toHaveLength(1)
      expect(weekRes.data[targetDay].sections.workflow[0].tasks[0]._id).toBe('flow_duplicate_new')
    })

    it('月历范围查询时，同一周期残留重复繁育里程碑也应只返回一个红点', async () => {
      const now = Date.now()
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)
      const targetDay = todayStart.getTime() + 10 * DAY_MS
      const monthStart = new Date(targetDay)
      monthStart.setDate(1)
      const nextMonthStart = new Date(monthStart)
      nextMonthStart.setMonth(nextMonthStart.getMonth() + 1)

      seedCollection('tasks', [
        {
          _id: 'flow_month_duplicate_old',
          family_id: familyId,
          dog_id: 'dog_1',
          dog_name: '花花',
          cycle_id: 'cycle_month_duplicate_1',
          type: 'breeding_milestone',
          title: '花花 · 建议卵泡检查',
          details: { step_type: 'follicle_check' },
          status: 'pending',
          due_date: targetDay,
          created_at: now - 2000,
          updated_at: now - 2000,
        },
        {
          _id: 'flow_month_duplicate_new',
          family_id: familyId,
          dog_id: 'dog_1',
          dog_name: '花花',
          cycle_id: 'cycle_month_duplicate_1',
          type: 'breeding_milestone',
          title: '花花 · 建议卵泡检查',
          details: { step_type: 'follicle_check' },
          status: 'pending',
          due_date: targetDay,
          created_at: now - 1000,
          updated_at: now - 1000,
        },
      ])
      seedCollection('health_records', [])
      seedCollection('medication_tasks', [])

      const ctx = createCloudObjectContext({ familyId })
      const res = await taskService.getDateCounts.call(ctx, monthStart.getTime(), nextMonthStart.getTime() - 1)

      expect(res.data[targetDay]).toBe(1)
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

  describe('晨间摘要通知设置', () => {
    it('buildMorningSummaryPayload 应按通知类型过滤并按北京时间命中', () => {
      const now = new Date('2026-04-22T09:00:00+08:00').getTime()
      const dayStart = new Date('2026-04-22T00:00:00+08:00').getTime()

      const family = {
        settings: {
          push_enabled: true,
          morning_summary_enabled: true,
          morning_summary_time: '09:00',
          notification_types: {
            breeding: true,
            vaccination: false,
            medication: true,
            care_group: false,
            overdue: true,
          },
        },
      }

      const tasks = [
        { _id: 'overdue_1', status: 'pending', type: 'vaccination', due_date: dayStart - 1000 },
        { _id: 'breed_1', status: 'pending', type: 'breeding_milestone', due_date: dayStart + 1000 },
        { _id: 'vac_1', status: 'pending', type: 'vaccination', due_date: dayStart + 2000 },
        { _id: 'care_1', status: 'pending', type: 'care_group', due_date: dayStart + 3000 },
      ]

      const activeMeds = [{
        _id: 'med_1',
        dog_id: 'dog_1',
        dog_name: '奶盖',
        actual_start_date: dayStart,
        duration_days: 5,
        frequency: 1,
        daily_doses: {},
      }]

      const summary = buildMorningSummaryPayload(family, tasks, activeMeds, now)

      expect(summary).toBeTruthy()
      expect(summary.total).toBe(3)
      expect(summary.parts).toEqual([
        '1件逾期需处理',
        '1项繁育提醒',
        '1项今日用药',
      ])
      expect(summary.counts).toMatchObject({
        overdue: 1,
        breeding: 1,
        vaccination: 1,
        medication: 1,
        care_group: 1,
      })
    })

    it('_timing_morningSummary 仅处理命中当前 HH:MM 且开关开启的家庭', async () => {
      const now = new Date('2026-04-22T09:00:00+08:00').getTime()
      vi.spyOn(Date, 'now').mockReturnValue(now)

      seedCollection('families', [
        {
          _id: 'fam_match',
          name: '命中家庭',
          members: [{ user_id: 'u1', status: 'active' }],
          settings: {
            push_enabled: true,
            morning_summary_enabled: true,
            morning_summary_time: '09:00',
            notification_types: {
              breeding: true,
              vaccination: true,
              medication: true,
              care_group: true,
              overdue: true,
            },
          },
        },
        {
          _id: 'fam_off',
          name: '关闭家庭',
          members: [{ user_id: 'u2', status: 'active' }],
          settings: {
            push_enabled: false,
            morning_summary_enabled: true,
            morning_summary_time: '09:00',
            notification_types: {
              breeding: true,
              vaccination: true,
              medication: true,
              care_group: true,
              overdue: true,
            },
          },
        },
        {
          _id: 'fam_other_time',
          name: '其他时间家庭',
          members: [{ user_id: 'u3', status: 'active' }],
          settings: {
            push_enabled: true,
            morning_summary_enabled: true,
            morning_summary_time: '08:00',
            notification_types: {
              breeding: true,
              vaccination: true,
              medication: true,
              care_group: true,
              overdue: true,
            },
          },
        },
      ])

      seedCollection('tasks', [
        { _id: 'task_match', family_id: 'fam_match', status: 'pending', type: 'breeding_milestone', due_date: now },
        { _id: 'task_off', family_id: 'fam_off', status: 'pending', type: 'breeding_milestone', due_date: now },
        { _id: 'task_other_time', family_id: 'fam_other_time', status: 'pending', type: 'breeding_milestone', due_date: now },
      ])
      seedCollection('medication_tasks', [])

      const result = await taskService._timing_morningSummary.call(createCloudObjectContext({ methodName: '_timing_morningSummary' }))
      expect(result.data.pushCount).toBe(1)
    })
  })
})
