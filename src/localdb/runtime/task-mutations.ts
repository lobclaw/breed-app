import { localDb } from '@/localdb/db'
import { createClientMutationId, createStableEntityId } from '@/localdb/id'
import { LOCAL_MUTATION_TYPES, type LocalMutationPayload, type LocalMutationType } from '@/localdb/mutation-registry'
import { buildLocalHealthExpense, buildLocalTaskFromManualPayload, getHealthVariantKey, shouldSkipDuplicateHealthRecord } from '@/localdb/runtime/local-builders'
import { buildLocalAck, buildSyncMeta, getNow, getFamilyId } from '@/localdb/runtime/mutation-helpers'
import type { BusinessCollectionName, LocalRowOf, SyncMetadata } from '@/localdb/types'

type TaskRow = LocalRowOf<'tasks'> & {
  type: string
  details?: Record<string, unknown> | null
  dog_id?: string
  dog_name?: string
  postpone_count?: number
}
type HealthRecordRow = LocalRowOf<'health_records'>
type ExpenseRow = LocalRowOf<'expenses'>
type TaskPayloadTimestamp = number | string | null
type ManualTaskDogInput = {
  dog_id: string
  dog_name?: string
  [key: string]: unknown
}

interface ManualTaskDetailsPayload {
  [key: string]: unknown
}

export interface BatchCreateManualTasksPayload {
  dogs?: ManualTaskDogInput[]
  card_type?: string
  type?: string
  title?: string
  due_date?: TaskPayloadTimestamp
  next_reminder_date?: TaskPayloadTimestamp
  details?: ManualTaskDetailsPayload
}
import { getBeijingDayStart } from '@/utils/date'

export interface RuntimeMutationContext {
  enqueueMutation(
    type: LocalMutationType,
    familyId: string,
    payload: LocalMutationPayload,
    collectionScope: BusinessCollectionName[],
    syncMeta: SyncMetadata,
    logSnapshot?: Record<string, unknown>,
  ): Promise<void>
}

function startOfDay(ts: number) {
  return getBeijingDayStart(ts)
}

function getTaskBaseVersion(task: TaskRow | null) {
  if (!task?._id) return {}
  return { [task._id]: Number(task.version || 0) }
}

export async function batchCreateManualTasksLocally(ctx: RuntimeMutationContext, familyIdInput: string, data: BatchCreateManualTasksPayload) {
    const familyId = getFamilyId(familyIdInput)
    if (!Array.isArray(data.dogs) || !data.dogs.length) throw new Error('请选择犬只')
    const now = getNow()
    const taskType = String(data.type || '')
    const expectedVariant = getHealthVariantKey(taskType, data.details || {})
    const weekMs = 7 * 86400000
    const dogIds = data.dogs.map((dog) => dog.dog_id).filter((dogId): dogId is string => Boolean(dogId))
    const existingTasks = dogIds.length > 0
      ? await localDb.query<TaskRow>('tasks', row =>
        row.family_id === familyId
        && row.status === 'pending'
          && row.type === taskType
          && !!row.dog_id
          && dogIds.includes(row.dog_id)
          && Number(row.due_date || 0) >= Number(data.due_date || 0) - weekMs
          && Number(row.due_date || 0) <= Number(data.due_date || 0) + weekMs,
      )
      : []
    const duplicateDogIdSet = new Set(
      (existingTasks || [])
        .filter(task => getHealthVariantKey(task.type, task.details || {}) === expectedVariant)
        .map(task => task.dog_id)
        .filter((dogId): dogId is string => Boolean(dogId)),
    )
    const duplicateRecordedDogIdSet = shouldSkipDuplicateHealthRecord(taskType)
      ? new Set(
        (await localDb.query<HealthRecordRow>('health_records', row =>
          row.family_id === familyId
          && !row.deleted_at
          && row.type === taskType
          && !!row.dog_id
          && dogIds.includes(row.dog_id)
          && startOfDay(Number(row.date || 0)) === startOfDay(Number(data.due_date || 0)),
        ))
          .filter(row => getHealthVariantKey(row.type, row.details || {}) === expectedVariant)
          .map(row => row.dog_id)
          .filter((dogId): dogId is string => Boolean(dogId)),
      )
      : new Set<string>()
    const duplicateAnyDogIdSet = new Set<string>([
      ...duplicateDogIdSet,
      ...duplicateRecordedDogIdSet,
    ])

    const dogsToCreate = data.dogs.filter((dog) => !duplicateAnyDogIdSet.has(dog.dog_id))
    const skippedDogs = data.dogs
      .filter((dog) => duplicateAnyDogIdSet.has(dog.dog_id))
      .map((dog) => ({
        dog_id: dog.dog_id,
        dog_name: dog.dog_name || '',
        reason: duplicateRecordedDogIdSet.has(dog.dog_id) ? 'existing_record' : 'existing_task',
      }))
    const tasks = dogsToCreate.map((dog) => buildLocalTaskFromManualPayload(
      familyId,
      dog,
      data,
      createStableEntityId('task'),
      now,
    ))
    const syncMeta = buildSyncMeta({}, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.BATCH_CREATE_TASKS),
      clientEntityIds: { tasks: tasks.map(task => task._id) },
    })

    if (tasks.length > 0) {
      await localDb.transactRows('tasks', async (rows) => {
        for (const task of tasks) {
          await rows.upsertRow(task as unknown as TaskRow)
        }
      })
      await ctx.enqueueMutation(
        LOCAL_MUTATION_TYPES.BATCH_CREATE_TASKS,
        familyId,
        { ...data, dogs: dogsToCreate, _sync: syncMeta },
        ['tasks'],
        syncMeta,
      )
    }

    return {
      data: {
        created: tasks.length,
        skipped: skippedDogs.length,
        skippedDogs,
        tasks,
        message: tasks.length > 0 ? '已创建待办' : '已有相同待办',
      },
      ...buildLocalAck(syncMeta, tasks.map(task => ({
        collection: 'tasks' as BusinessCollectionName,
        id: task._id,
        version: 0,
        updatedAt: task.updated_at,
      }))),
    }
  }

export async function completeTaskLocally(ctx: RuntimeMutationContext, familyId: string, taskId: string, autoRecord = false) {
    const task = await localDb.findById<TaskRow>('tasks', taskId)
    if (!task || task.status !== 'pending') return null

    const now = getNow()
    const autoHealthRecords = autoRecord && ['vaccination', 'deworming'].includes(task.type)
      ? [{
          taskId,
          recordId: createStableEntityId('health_record'),
          expenseId: Number(task.details?.cost || 0) > 0 ? createStableEntityId('expense') : '',
          dogId: task.dog_id,
          dogName: task.dog_name,
          type: task.type,
          date: now,
          cost: Number(task.details?.cost || 0) > 0 ? Number((task.details || {}).cost) : null,
          notes: task.details?.notes || null,
          details: task.details || {},
        }]
      : []
    const syncMeta = buildSyncMeta(
      getTaskBaseVersion(task),
      {
        clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.COMPLETE_TASK),
        autoHealthRecords,
      },
    )

    await localDb.transactRows(['tasks', 'health_records', 'expenses'] as const, async (rows) => {
      await rows.updateRow('tasks', taskId, currentTask => ({
        ...currentTask,
        status: 'completed',
        completed_at: now,
        updated_at: now,
      } as TaskRow))
      if (autoHealthRecords.length > 0) {
        for (const record of autoHealthRecords) {
          await rows.upsertRow('health_records', {
            _id: record.recordId,
            type: record.type,
            dog_id: record.dogId,
            dog_name: record.dogName || '',
            family_id: familyId,
            date: record.date,
            cost: record.cost,
            notes: record.notes,
            details: record.details || {},
            version: 0,
            created_at: now,
            updated_at: now,
            _local_pending: true,
          } as HealthRecordRow)
        }
        const expenseRows = autoHealthRecords
          .filter(record => record.expenseId && Number(record.cost || 0) > 0)
          .map((record) => buildLocalHealthExpense(
            familyId,
            { _id: record.dogId, name: record.dogName || '' },
            {
              type: record.type,
              date: record.date,
              notes: record.notes,
            },
            record.recordId,
            Number(record.cost),
            record.expenseId,
            now,
          ))
        for (const expenseRow of expenseRows) {
          await rows.upsertRow('expenses', expenseRow as unknown as ExpenseRow)
        }
      }
    })

    const payload = {
      taskId,
      autoRecord,
      _sync: syncMeta,
    }
    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.COMPLETE_TASK,
      familyId,
      payload,
      ['tasks', 'health_records', 'expenses'],
      syncMeta,
      { taskTitle: task.title },
    )
    return {
      message: '已完成',
      data: {
        completedTaskIds: [taskId],
        autoRecordedHealthRecordIds: autoHealthRecords.map(record => record.recordId),
      },
      syncMeta,
    }
  }

export async function batchCompleteTasksLocally(ctx: RuntimeMutationContext, familyId: string, taskIds: string[], autoRecord = false) {
    const rows = await localDb.query<TaskRow>('tasks', task => taskIds.includes(task._id))
    const pendingTasks = rows.filter(task => task.status === 'pending')
    if (!pendingTasks.length) return null

    const now = getNow()
    const autoHealthRecords = autoRecord
      ? pendingTasks
        .filter(task => ['vaccination', 'deworming'].includes(task.type))
        .map(task => ({
          taskId: task._id,
          recordId: createStableEntityId('health_record'),
          expenseId: Number(task.details?.cost || 0) > 0 ? createStableEntityId('expense') : '',
          dogId: task.dog_id,
          dogName: task.dog_name,
          type: task.type,
          date: now,
          cost: Number(task.details?.cost || 0) > 0 ? Number((task.details || {}).cost) : null,
          notes: task.details?.notes || null,
          details: task.details || {},
        }))
      : []

    const baseVersions = pendingTasks.reduce<Record<string, number>>((acc, task) => {
      acc[task._id] = Number(task.version || 0)
      return acc
    }, {})
    const syncMeta = buildSyncMeta(baseVersions, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.BATCH_COMPLETE_TASK),
      autoHealthRecords,
    })

    await localDb.transactRows(['tasks', 'health_records', 'expenses'] as const, async (rows) => {
      for (const task of pendingTasks) {
        await rows.updateRow('tasks', task._id, row => ({
          ...row,
          status: 'completed',
          completed_at: now,
          updated_at: now,
        } as TaskRow))
      }
      if (autoHealthRecords.length > 0) {
        for (const record of autoHealthRecords) {
          await rows.upsertRow('health_records', {
            _id: record.recordId,
            type: record.type,
            dog_id: record.dogId,
            dog_name: record.dogName || '',
            family_id: familyId,
            date: record.date,
            cost: record.cost,
            notes: record.notes,
            details: record.details || {},
            version: 0,
            created_at: now,
            updated_at: now,
            _local_pending: true,
          } as HealthRecordRow)
        }
        const expenseRows = autoHealthRecords
          .filter(record => record.expenseId && Number(record.cost || 0) > 0)
          .map((record) => buildLocalHealthExpense(
            familyId,
            { _id: record.dogId, name: record.dogName || '' },
            {
              type: record.type,
              date: record.date,
              notes: record.notes,
            },
            record.recordId,
            Number(record.cost),
            record.expenseId,
            now,
          ))
        for (const expenseRow of expenseRows) {
          await rows.upsertRow('expenses', expenseRow as unknown as ExpenseRow)
        }
      }
    })

    const payload = {
      taskIds: pendingTasks.map(task => task._id),
      autoRecord,
      _sync: syncMeta,
    }
    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.BATCH_COMPLETE_TASK,
      familyId,
      payload,
      ['tasks', 'health_records', 'expenses'],
      syncMeta,
      { taskTitles: pendingTasks.map(task => task.title).filter(Boolean) },
    )
    return {
      data: {
        completedTaskIds: pendingTasks.map(task => task._id),
        autoRecordedHealthRecordIds: autoHealthRecords.map(record => record.recordId),
      },
      syncMeta,
    }
  }

export async function postponeTasksLocally(ctx: RuntimeMutationContext, familyId: string, taskIds: string[], newDate: number) {
    const rows = await localDb.query<TaskRow>('tasks', task => taskIds.includes(task._id))
    const pendingTasks = rows.filter(task => task.status === 'pending')
    if (!pendingTasks.length) return null

    const now = getNow()
    const baseVersions = pendingTasks.reduce<Record<string, number>>((acc, task) => {
      acc[task._id] = Number(task.version || 0)
      return acc
    }, {})
    const isBatch = pendingTasks.length > 1
    const syncMeta = buildSyncMeta(baseVersions, {
      clientMutationId: createClientMutationId(isBatch ? LOCAL_MUTATION_TYPES.BATCH_POSTPONE_TASK : LOCAL_MUTATION_TYPES.POSTPONE_TASK),
    })

    await localDb.transactRows('tasks', async (rows) => {
      for (const task of pendingTasks) {
        await rows.updateRow(task._id, row => ({
          ...row,
          due_date: newDate,
          updated_at: now,
          postpone_count: Number((row as TaskRow).postpone_count || 0) + 1,
        } as TaskRow))
      }
    })

    const payload = isBatch
      ? { taskIds: pendingTasks.map(task => task._id), newDate, _sync: syncMeta }
      : { taskId: pendingTasks[0]._id, newDate, _sync: syncMeta }

    await ctx.enqueueMutation(
      isBatch ? LOCAL_MUTATION_TYPES.BATCH_POSTPONE_TASK : LOCAL_MUTATION_TYPES.POSTPONE_TASK,
      familyId,
      payload,
      ['tasks'],
      syncMeta,
      { taskTitles: pendingTasks.map(task => task.title).filter(Boolean) },
    )
    return {
      message: '已推迟',
      data: {
        postponedTaskIds: pendingTasks.map(task => task._id),
      },
      syncMeta,
    }
  }
