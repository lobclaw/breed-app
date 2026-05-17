import { localDb } from '@/localdb/db'
import { createClientMutationId, createStableEntityId } from '@/localdb/id'
import { LOCAL_MUTATION_TYPES, type LocalMutationPayload, type LocalMutationType } from '@/localdb/mutation-registry'
import { findLocal as findLocalRow } from '@/localdb/repository'
import { hasPendingUploadImages } from '@/localdb/runtime/attachments'
import { materializeBreedingMilestonesForFamily } from '@/localdb/runtime/home-snapshot'
import {
  buildLocalBreedingExpense,
  buildLocalBreedingExtraTask,
  buildLocalBreedingRecord,
  getLatestLocalBreedingRecord,
  hasLocalPrenatalCheckContent,
  isLocalAbandonMatingTermination,
  isLocalPregnancyRejected,
  normalizeDogName,
  shouldClearLocalBreedingMilestones,
} from '@/localdb/runtime/local-builders'
import { buildLocalAck, buildSyncMeta, getFamilyId, getNow } from '@/localdb/runtime/mutation-helpers'
import type { BusinessCollectionName, LocalRowOf, SyncMetadata } from '@/localdb/types'

type DogRow = LocalRowOf<'dogs'>
type TaskRow = LocalRowOf<'tasks'> & {
  type?: string
  cycle_id?: string
  source_record_id?: string
}
type BreedingCycleRow = LocalRowOf<'breeding_cycles'>
type BreedingRecordRow = LocalRowOf<'breeding_records'> & {
  dog_name?: string
  extra_arrangement?: unknown
}
type ExpenseRow = LocalRowOf<'expenses'>
type BreedingPayloadTimestamp = number | string | null
type BreedingPayloadAmount = number | string | null

interface BreedingDetailsPayload {
  [key: string]: unknown
}

interface BreedingExtraArrangementPayload extends BreedingDetailsPayload {
  kind?: string
  due_date?: BreedingPayloadTimestamp
}

export interface BreedingMutationPayload {
  id?: string
  dog_id?: string
  dog_ids?: string[]
  cycle_id?: string
  type?: string
  date?: BreedingPayloadTimestamp
  cost?: BreedingPayloadAmount
  notes?: string | null
  images?: string[]
  details?: BreedingDetailsPayload
  extra_arrangement?: BreedingExtraArrangementPayload | null
}

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

const BREEDING_RECORD_LOG_LABELS: Record<string, string> = {
  heat: '发情记录',
  heat_observation: '发情观察',
  follicle_check: '卵泡检查记录',
  mating: '配种记录',
  pregnancy_check: '孕检记录',
  prenatal_check: '产检记录',
  pre_labor: '临产记录',
  abnormal_termination: '异常终止记录',
  birth: '生产记录',
}

async function getDogsByIds(dogIds: string[]) {
  const uniqueIds = [...new Set(dogIds.filter(Boolean))]
  if (!uniqueIds.length) return []
  const dogs = await localDb.query<DogRow>('dogs', dog => uniqueIds.includes(dog._id))
  const dogMap = new Map(dogs.map(dog => [dog._id, dog]))
  return uniqueIds.map(id => dogMap.get(id)).filter(Boolean)
}

export async function addBreedingRecordLocally(ctx: RuntimeMutationContext, familyIdInput: string, data: BreedingMutationPayload) {
    const familyId = getFamilyId(familyIdInput)
    const dogId = String(data.dog_id || '')
    const [dog] = await getDogsByIds([dogId])
    if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')

    const now = getNow()
    const currentCycles = await localDb.query<BreedingCycleRow>('breeding_cycles', cycle =>
      cycle.family_id === familyId
      && cycle.dam_id === data.dog_id
      && ['发情中', '怀孕中'].includes(cycle.status),
    )
    const existingCycle = data.cycle_id
      ? await localDb.findById<BreedingCycleRow>('breeding_cycles', data.cycle_id)
      : currentCycles[0]
    if (data.type === 'abnormal_termination' && existingCycle?.status === '发情中' && !isLocalAbandonMatingTermination(data.details || {})) {
      throw new Error('发情中周期只能选择放弃配种')
    }
    if (data.type === 'abnormal_termination' && existingCycle?.status === '怀孕中' && isLocalAbandonMatingTermination(data.details || {})) {
      throw new Error('放弃配种仅适用于发情中周期')
    }
    if (data.type === 'prenatal_check' && !hasLocalPrenatalCheckContent(data.details || {})) {
      throw new Error('产检记录必须填写检查结果或检查图片')
    }
    const cycleId = existingCycle?._id || createStableEntityId('breeding_cycle')
    const recordId = createStableEntityId('breeding_record')
    const nextStatus = data.type === 'heat'
      ? '发情中'
      : data.type === 'mating'
        ? '怀孕中'
        : data.type === 'abnormal_termination'
          ? isLocalAbandonMatingTermination(data.details || {}) ? '放弃' : '失败'
          : data.type === 'pregnancy_check' && isLocalPregnancyRejected(data.details || {})
            ? '失败'
            : existingCycle?.status || '发情中'
    const record = buildLocalBreedingRecord(familyId, dog, data, recordId, cycleId, now) as BreedingRecordRow
    const extraArrangementTask = data.extra_arrangement?.kind && data.extra_arrangement?.due_date
      ? buildLocalBreedingExtraTask(familyId, dog, cycleId, recordId, data.extra_arrangement, createStableEntityId('task'), now)
      : null
    const pendingMilestoneTasks = shouldClearLocalBreedingMilestones(data)
      ? await localDb.query<TaskRow>('tasks', row =>
        row.family_id === familyId
        && row.cycle_id === cycleId
        && row.type === 'breeding_milestone'
        && row.status === 'pending'
        && !row.deleted_at,
      )
      : []
    const expenseId = data.type !== 'heat_observation' && Number(data.cost || 0) > 0
      ? createStableEntityId('expense')
      : ''
    const expenseRow = expenseId
      ? buildLocalBreedingExpense(familyId, dog, data, cycleId, recordId, expenseId, now)
      : null
    const cycle = existingCycle
      ? { ...existingCycle, status: nextStatus, updated_at: now }
      : {
          _id: cycleId,
          dam_id: dog._id,
          dam_name: normalizeDogName(dog),
          sire_id: data.details?.sire_id ? String(data.details.sire_id) : undefined,
          sire_name: data.details?.sire_name ? String(data.details.sire_name) : undefined,
          family_id: familyId,
          status: nextStatus,
          version: 0,
          created_at: now,
          updated_at: now,
          _local_pending: true,
        } as BreedingCycleRow
    const syncMeta = buildSyncMeta(
      existingCycle ? { [cycleId]: Number(existingCycle.version || 0) } : {},
      {
        clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.CREATE_BREEDING_RECORD),
        clientEntityIds: {
          breeding_records: recordId,
          breeding_cycles: cycleId,
          ...(expenseId ? { expenses: expenseId } : {}),
        },
      },
    )

    await localDb.transactRows(['breeding_records', 'breeding_cycles', 'tasks', 'expenses'] as const, async (rows) => {
      await rows.upsertRow('breeding_records', record)
      await rows.upsertRow('breeding_cycles', cycle)
      for (const task of pendingMilestoneTasks) {
        await rows.updateRow('tasks', task._id, row => ({
          ...row,
          status: 'cancelled',
          updated_at: now,
          _local_pending: true,
        } as TaskRow))
      }
      if (extraArrangementTask) {
        await rows.upsertRow('tasks', extraArrangementTask)
      }
      if (expenseRow) {
        await rows.upsertRow('expenses', expenseRow)
      }
    })
    const materializedMilestoneTasks = await materializeBreedingMilestonesForFamily(familyId)
    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.CREATE_BREEDING_RECORD,
      familyId,
      { ...data, _sync: syncMeta },
      ['breeding_records', 'breeding_cycles', 'tasks', 'expenses', 'litters'],
      syncMeta,
      { dogName: normalizeDogName(dog) },
    )

    return {
      data: { recordId, cycleId },
      ...buildLocalAck(syncMeta, [
        { collection: 'breeding_records' as BusinessCollectionName, id: recordId, version: 0, updatedAt: now },
        { collection: 'breeding_cycles' as BusinessCollectionName, id: cycleId, version: Number(cycle.version || 0), updatedAt: now },
        ...pendingMilestoneTasks.map(task => ({ collection: 'tasks' as BusinessCollectionName, id: task._id, version: Number(task.version || 0), updatedAt: now })),
        ...materializedMilestoneTasks.map(task => ({ collection: 'tasks' as BusinessCollectionName, id: task._id, version: Number(task.version || 0), updatedAt: Number(task.updated_at || now) })),
        ...(expenseRow ? [{ collection: 'expenses' as BusinessCollectionName, id: expenseRow._id, version: 0, updatedAt: now }] : []),
      ]),
    }
  }

export async function batchAddBreedingRecordsLocally(ctx: RuntimeMutationContext, familyId: string, data: BreedingMutationPayload) {
    if (data.type !== 'heat') throw new Error('当前仅支持批量录入发情记录')
    const records = []
    const failed = []
    for (const dogId of [...new Set(data.dog_ids || [])]) {
      try {
        const result = await addBreedingRecordLocally(ctx, familyId, { ...data, dog_id: dogId, type: 'heat' })
        records.push({ dog_id: dogId, recordId: result.data.recordId, cycleId: result.data.cycleId })
      } catch (error) {
        failed.push({ dog_id: dogId, reason: error instanceof Error ? error.message : '保存失败' })
      }
    }
    return { data: { count: records.length, records, failed } }
  }

export async function updateBreedingRecordLocally(ctx: RuntimeMutationContext, familyIdInput: string, data: BreedingMutationPayload) {
    const familyId = getFamilyId(familyIdInput)
    const recordId = String(data.id || '').trim()
    if (!recordId) throw new Error('缺少记录 ID')
    const record = await findLocalRow<BreedingRecordRow>('breeding_records', recordId)
    if (!record || record.family_id !== familyId) throw new Error('记录不存在')
    const dog = (await getDogsByIds([record.dog_id]))[0] || { _id: record.dog_id, name: record.dog_name || '' }
    if (!dog?._id) throw new Error('犬只未同步到本地，请联网刷新一次')

    const now = getNow()
    const nextDetails = data.details !== undefined
      ? {
          ...(data.details || {}),
          ...(record.type === 'mating'
            ? { mating_number: Number(record.details?.mating_number || record.details?.mating_count) || 1 }
            : {}),
        }
      : (record.details || {})
    if (record.type === 'prenatal_check' && !hasLocalPrenatalCheckContent(nextDetails)) {
      throw new Error('产检记录必须填写检查结果或检查图片')
    }
    const nextRecord = {
      ...record,
      date: data.date !== undefined ? Number(data.date) : record.date,
      cost: data.cost !== undefined ? Number(data.cost || 0) : record.cost,
      notes: data.notes !== undefined ? data.notes || '' : record.notes,
      details: nextDetails,
      updated_at: now,
      _local_pending: true,
      _pending_upload: hasPendingUploadImages(nextDetails?.images),
      pending_upload: hasPendingUploadImages(nextDetails?.images),
    } as BreedingRecordRow

    const existingExtraTask = await localDb.query<TaskRow>('tasks', row =>
      row.family_id === familyId
      && row.type === 'breeding_extra_arrangement'
      && row.source_record_id === recordId
      && row.status === 'pending',
    )
    const nextExtraArrangement = record.type !== 'heat_observation' && data.extra_arrangement !== undefined
      ? data.extra_arrangement
      : undefined
    const nextExtraTask = nextExtraArrangement?.kind && nextExtraArrangement?.due_date
      ? buildLocalBreedingExtraTask(
          familyId,
          dog,
          record.cycle_id,
          recordId,
          nextExtraArrangement,
          existingExtraTask[0]?._id || createStableEntityId('task'),
          now,
        )
      : null
    const cycleRecords = await localDb.query<BreedingRecordRow>('breeding_records', row =>
      row.family_id === familyId
      && row.cycle_id === record.cycle_id
      && row.type === record.type
      && !row.deleted_at,
    )
    const latestRecordAfterEdit = getLatestLocalBreedingRecord(
      cycleRecords.map(row => row._id === recordId ? nextRecord : row),
      record.type,
    )
    const pendingMilestoneTasks = record.type === 'follicle_check' && latestRecordAfterEdit?._id === recordId
      ? await localDb.query<TaskRow>('tasks', row =>
        row.family_id === familyId
        && row.cycle_id === record.cycle_id
        && row.type === 'breeding_milestone'
        && row.status === 'pending'
        && !row.deleted_at,
      )
      : []
    const linkedExpenses = await localDb.query<ExpenseRow>('expenses', row =>
      row.family_id === familyId
      && !row.deleted_at
      && row.source_type === 'auto'
      && row.source_record_id === recordId,
    )
    const nextCost = record.type !== 'heat_observation' ? Number(nextRecord.cost || 0) : 0
    const createdExpenseId = linkedExpenses.length === 0 && nextCost > 0
      ? createStableEntityId('expense')
      : ''
    const nextExpenseRows = nextCost > 0
      ? (linkedExpenses.length > 0
          ? linkedExpenses.map((expense) => ({
              ...expense,
              ...buildLocalBreedingExpense(
                familyId,
                dog,
                {
                  type: record.type,
                  date: nextRecord.date,
                  cost: nextCost,
                  notes: nextRecord.notes,
                },
                record.cycle_id,
                recordId,
                expense._id,
                now,
              ),
              version: Number(expense.version || 0),
              created_at: expense.created_at,
              updated_at: now,
              _local_pending: true,
            }))
          : [buildLocalBreedingExpense(
              familyId,
              dog,
              {
                type: record.type,
                date: nextRecord.date,
                cost: nextCost,
                notes: nextRecord.notes,
              },
              record.cycle_id,
              recordId,
              createdExpenseId,
              now,
            )])
      : []
    const linkedExpenseIds = new Set(linkedExpenses.map(expense => expense._id))
    const syncMeta = buildSyncMeta({
      [recordId]: Number(record.version || 0),
      ...linkedExpenses.reduce<Record<string, number>>((acc, row) => {
        acc[row._id] = Number(row.version || 0)
        return acc
      }, {}),
    }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_BREEDING_RECORD),
      clientEntityIds: createdExpenseId ? { expenses: createdExpenseId } : undefined,
    })

    await localDb.transactRows(['breeding_records', 'tasks', 'expenses'] as const, async (rows) => {
      await rows.updateRow('breeding_records', recordId, nextRecord)
      for (const task of pendingMilestoneTasks) {
        await rows.updateRow('tasks', task._id, row => ({
          ...row,
          status: 'cancelled',
          updated_at: now,
          _local_pending: true,
        } as TaskRow))
      }
      for (const task of existingExtraTask) {
        if (!nextExtraTask || task._id !== nextExtraTask._id) {
          await rows.deleteRow('tasks', task._id)
        }
      }
      if (nextExtraTask) {
        await rows.upsertRow('tasks', nextExtraTask)
      }
      for (const expense of linkedExpenses) {
        if (nextExpenseRows.every(nextRow => nextRow._id !== expense._id)) {
          await rows.deleteRow('expenses', expense._id)
        }
      }
      for (const expense of nextExpenseRows) {
        await rows.upsertRow('expenses', expense)
      }
    })
    const materializedMilestoneTasks = await materializeBreedingMilestonesForFamily(familyId)

    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.UPDATE_BREEDING_RECORD,
      familyId,
      { ...data, _sync: syncMeta },
      ['breeding_records', 'tasks', 'expenses'],
      syncMeta,
      {
        dogName: normalizeDogName(dog),
        recordLabel: BREEDING_RECORD_LOG_LABELS[String(record.type || '')] || '繁育记录',
      },
    )
    return {
      message: '已更新',
      ...buildLocalAck(syncMeta, [
        { collection: 'breeding_records', id: recordId, version: Number(record.version || 0), updatedAt: now },
        ...pendingMilestoneTasks.map(task => ({
          collection: 'tasks' as BusinessCollectionName,
          id: task._id,
          version: Number(task.version || 0),
          updatedAt: now,
        })),
        ...materializedMilestoneTasks.map(task => ({
          collection: 'tasks' as BusinessCollectionName,
          id: task._id,
          version: Number(task.version || 0),
          updatedAt: Number(task.updated_at || now),
        })),
        ...nextExpenseRows.map(row => ({
          collection: 'expenses' as BusinessCollectionName,
          id: row._id,
          version: Number(linkedExpenses.find(expense => expense._id === row._id)?.version || 0),
          updatedAt: now,
        })),
        ...linkedExpenses
          .filter(row => nextExpenseRows.every(nextRow => nextRow._id !== row._id))
          .map(row => ({
            collection: 'expenses' as BusinessCollectionName,
            id: row._id,
            version: Number(row.version || 0),
            updatedAt: now,
            deletedAt: now,
          })),
      ]),
    }
  }

export async function deleteBreedingRecordLocally(ctx: RuntimeMutationContext, familyIdInput: string, recordIdInput: string) {
    const familyId = getFamilyId(familyIdInput)
    const recordId = String(recordIdInput || '').trim()
    if (!recordId) throw new Error('缺少记录 ID')
    const record = await findLocalRow<BreedingRecordRow>('breeding_records', recordId)
    if (!record || record.family_id !== familyId) throw new Error('记录不存在')
    if (record.type !== 'heat_observation') throw new Error('当前仅支持删除发情观察记录')
    const now = getNow()
    const syncMeta = buildSyncMeta({ [recordId]: Number(record.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.DELETE_BREEDING_RECORD),
    })

    const linkedTasks = await localDb.query<TaskRow>('tasks', row => row.source_record_id === recordId)
    const linkedExpenses = await localDb.query<ExpenseRow>('expenses', row => row.source_record_id === recordId)
    await localDb.transactRows(['breeding_records', 'tasks', 'expenses'] as const, async (rows) => {
      await rows.deleteRow('breeding_records', recordId)
      for (const task of linkedTasks) {
        await rows.deleteRow('tasks', task._id)
      }
      for (const expense of linkedExpenses) {
        await rows.deleteRow('expenses', expense._id)
      }
    })
    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.DELETE_BREEDING_RECORD,
      familyId,
      { id: recordId, _sync: syncMeta },
      ['breeding_records', 'tasks', 'expenses'],
      syncMeta,
    )
    return {
      message: '已删除',
      ...buildLocalAck(syncMeta, [{ collection: 'breeding_records', id: recordId, version: Number(record.version || 0), updatedAt: now, deletedAt: now }]),
    }
  }

export async function closeBreedingCycleLocally(ctx: RuntimeMutationContext, familyIdInput: string, cycleIdInput: string, reasonInput: string) {
    const familyId = getFamilyId(familyIdInput)
    const cycleId = String(cycleIdInput || '').trim()
    if (!cycleId) throw new Error('缺少周期 ID')
    const cycle = await findLocalRow<BreedingCycleRow>('breeding_cycles', cycleId)
    if (!cycle || cycle.family_id !== familyId) throw new Error('周期不存在')
    if (['已生产', '失败', '放弃'].includes(cycle.status)) throw new Error('周期已结束，不可再次关闭')
    const newStatus = reasonInput === '放弃' ? '放弃' : '失败'
    const now = getNow()
    const pendingTasks = await localDb.query<TaskRow>('tasks', row =>
      row.family_id === familyId
      && row.cycle_id === cycleId
      && row.status === 'pending',
    )
    const syncMeta = buildSyncMeta({
      [cycleId]: Number(cycle.version || 0),
      ...pendingTasks.reduce<Record<string, number>>((acc, row) => {
        acc[row._id] = Number(row.version || 0)
        return acc
      }, {}),
    }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.CLOSE_BREEDING_CYCLE),
    })
    const pendingTaskIds = new Set(pendingTasks.map(row => row._id))
    await localDb.transactRows(['breeding_cycles', 'tasks'] as const, async (rows) => {
      await rows.updateRow('breeding_cycles', cycleId, row => ({
        ...row,
        status: newStatus,
        updated_at: now,
        _local_pending: true,
      } as BreedingCycleRow))
      for (const task of pendingTasks) {
        await rows.updateRow('tasks', task._id, row => ({
          ...row,
          status: 'cancelled',
          updated_at: now,
          _local_pending: true,
        } as TaskRow))
      }
    })
    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.CLOSE_BREEDING_CYCLE,
      familyId,
      { cycleId, reason: newStatus, _sync: syncMeta },
      ['breeding_cycles', 'tasks'],
      syncMeta,
    )
    return {
      message: '周期已关闭',
      ...buildLocalAck(syncMeta, [
        { collection: 'breeding_cycles', id: cycleId, version: Number(cycle.version || 0), updatedAt: now },
        ...pendingTasks.map(row => ({ collection: 'tasks' as BusinessCollectionName, id: row._id, version: Number(row.version || 0), updatedAt: now })),
      ]),
    }
  }
