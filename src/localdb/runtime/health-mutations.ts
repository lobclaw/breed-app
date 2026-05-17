import { localDb } from '@/localdb/db'
import { createClientMutationId, createStableEntityId } from '@/localdb/id'
import { LOCAL_MUTATION_TYPES, type LocalMutationPayload, type LocalMutationType } from '@/localdb/mutation-registry'
import { findLocal as findLocalRow } from '@/localdb/repository'
import { hasPendingUploadImages } from '@/localdb/runtime/attachments'
import {
  buildLocalHealthExpense,
  buildLocalHealthRecord,
  getHealthVariantKey,
  normalizeDogName,
  shouldSkipDuplicateHealthRecord,
} from '@/localdb/runtime/local-builders'
import { buildLocalAck, buildSyncMeta, getFamilyId, getNow } from '@/localdb/runtime/mutation-helpers'
import type { BusinessCollectionName, LocalRowOf, SyncMetadata } from '@/localdb/types'
import { getBeijingDayStart } from '@/utils/date'

type HealthTaskRow = LocalRowOf<'tasks'> & {
  type?: string | null
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

export interface BatchAddHealthRecordsPayload {
  dog_ids?: string[]
  type?: string
  date?: number | null
  cost?: number | string | null
  notes?: string | null
  details?: Record<string, unknown> | null
  source_task_ids?: string[]
  sourceTaskIds?: string[]
  create_task?: boolean
  skip_reminder?: boolean
}

export interface UpdateHealthRecordPayload {
  id: string
  date?: number | null
  cost?: number | string | null
  notes?: string | null
  details?: Record<string, unknown> | null
}

function startOfDay(ts: number) {
  return getBeijingDayStart(ts)
}

async function getDogsByIds(dogIds: string[]) {
  const uniqueIds = [...new Set(dogIds.filter(Boolean))]
  if (!uniqueIds.length) return []
  const dogs = await localDb.query('dogs', dog => uniqueIds.includes(dog._id))
  const dogMap = new Map(dogs.map(dog => [dog._id, dog]))
  return uniqueIds.map(id => dogMap.get(id)).filter((dog): dog is LocalRowOf<'dogs'> => Boolean(dog))
}

export async function batchAddHealthRecordsLocally(ctx: RuntimeMutationContext, familyIdInput: string, data: BatchAddHealthRecordsPayload) {
  const familyId = getFamilyId(familyIdInput)
  if (!Array.isArray(data.dog_ids) || !data.dog_ids.length) throw new Error('请选择犬只')
  const uniqueDogIds = [...new Set(data.dog_ids)]
  const dogs = await getDogsByIds(data.dog_ids)
  if (dogs.length !== [...new Set(data.dog_ids)].length) throw new Error('部分犬只未同步到本地，请联网刷新一次')

  const now = getNow()
  const recordType = String(data.type || '')
  const duplicateCandidates = shouldSkipDuplicateHealthRecord(recordType)
    ? await localDb.query('health_records', row =>
      row.family_id === familyId
      && !row.deleted_at
      && row.type === recordType
      && uniqueDogIds.includes(row.dog_id)
      && startOfDay(Number(row.date || 0)) === startOfDay(Number(data.date || 0)),
    )
    : []
  const expectedVariant = getHealthVariantKey(recordType, data.details || {})
  const duplicateDogIdSet = new Set(
    (duplicateCandidates || [])
      .filter(row => getHealthVariantKey(row.type, row.details || {}) === expectedVariant)
      .map(row => row.dog_id)
      .filter(Boolean),
  )
  const indexedDogs = dogs.map((dog, index) => ({ dog, index }))
  const dogsToCreate = indexedDogs.filter(({ dog }) => !duplicateDogIdSet.has(dog._id))
  const skippedDogs = indexedDogs
    .filter(({ dog }) => duplicateDogIdSet.has(dog._id))
    .map(({ dog }) => ({ dog_id: dog._id, dog_name: normalizeDogName(dog) }))

  if (dogsToCreate.length === 0) {
    return {
      data: {
        count: 0,
        skipped: skippedDogs.length,
        skippedDogs,
        records: [],
        completedTasks: [],
      },
      ...buildLocalAck(buildSyncMeta({}, {
        clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.CREATE_HEALTH_RECORDS),
      })),
    }
  }

  const totalCost = data.cost || null
  const perDogCost = totalCost && dogsToCreate.length > 1 ? Math.round(Number(totalCost) / dogsToCreate.length * 100) / 100 : totalCost
  const records = dogsToCreate.map(({ dog }) => buildLocalHealthRecord(
    familyId,
    dog,
    data,
    createStableEntityId('health_record'),
    now,
    perDogCost && Number(perDogCost) > 0 ? Number(perDogCost) : null,
  ))
  const expenseRows = perDogCost && Number(perDogCost) > 0
    ? dogsToCreate.map(({ dog }, index) => buildLocalHealthExpense(
      familyId,
      dog,
      data,
      records[index]._id,
      Number(perDogCost),
      createStableEntityId('expense'),
      now,
    ))
    : []
  const sourceTaskIds = Array.isArray(data.source_task_ids)
    ? data.source_task_ids.filter(Boolean)
    : Array.isArray(data.sourceTaskIds)
      ? data.sourceTaskIds.filter(Boolean)
      : []
  const sourceTaskIdSet = new Set(sourceTaskIds)
  const pendingTasks = await localDb.query<HealthTaskRow>('tasks', task =>
    task.family_id === familyId
    && task.status === 'pending'
    && task.type === recordType
    && dogsToCreate.some(({ dog }) => dog._id === task.dog_id)
    && (sourceTaskIdSet.size === 0 || sourceTaskIdSet.has(task._id)),
  )
  const completedTaskIds = pendingTasks.map(task => task._id)
  const createdDogIds = dogsToCreate.map(({ dog }) => dog._id)
  const syncMeta = buildSyncMeta(
    pendingTasks.reduce<Record<string, number>>((acc, task) => {
      acc[task._id] = Number(task.version || 0)
      return acc
    }, {}),
    {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.CREATE_HEALTH_RECORDS),
      clientEntityIds: {
        health_records: records.map(record => record._id),
        ...(expenseRows.length ? { expenses: expenseRows.map(row => row._id) } : {}),
      },
    },
  )

  await localDb.transactRows(['health_records', 'tasks', 'expenses'] as const, async (rows) => {
    for (const record of records) {
      await rows.upsertRow('health_records', record as LocalRowOf<'health_records'>)
    }
    for (const expenseRow of expenseRows) {
      await rows.upsertRow('expenses', expenseRow as LocalRowOf<'expenses'>)
    }
    for (const task of pendingTasks) {
      await rows.updateRow('tasks', task._id, row => ({
        ...row,
        status: 'completed',
        completed_at: now,
        updated_at: now,
      } as LocalRowOf<'tasks'>))
    }
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.CREATE_HEALTH_RECORDS,
    familyId,
    { ...data, dog_ids: createdDogIds, _sync: syncMeta },
    ['health_records', 'tasks', 'expenses'],
    syncMeta,
    { dogNames: dogsToCreate.map(({ dog }) => normalizeDogName(dog)) },
  )

  return {
    data: {
      count: records.length,
      skipped: skippedDogs.length,
      skippedDogs,
      records: records.map(record => ({ recordId: record._id, dog_id: record.dog_id })),
      completedTasks: pendingTasks,
    },
    ...buildLocalAck(syncMeta, [
      ...records.map(record => ({ collection: 'health_records' as BusinessCollectionName, id: record._id, version: 0, updatedAt: record.updated_at })),
      ...pendingTasks.map(task => ({ collection: 'tasks' as BusinessCollectionName, id: task._id, version: Number(task.version || 0), updatedAt: now })),
      ...expenseRows.map(row => ({ collection: 'expenses' as BusinessCollectionName, id: row._id, version: 0, updatedAt: row.updated_at })),
    ]),
  }
}

export async function updateHealthRecordLocally(ctx: RuntimeMutationContext, familyId: string, data: UpdateHealthRecordPayload) {
  const recordId = String(data.id || '').trim()
  if (!recordId) throw new Error('缺少记录 ID')
  const record = await findLocalRow('health_records', recordId)
  if (!record || record.family_id !== familyId || record.deleted_at) throw new Error('记录不存在')
  const dog = (await getDogsByIds([record.dog_id]))[0] || { _id: record.dog_id, name: record.dog_name || '' }

  const now = getNow()
  const nextRecord = {
    ...record,
    ...(data.date !== undefined ? { date: data.date } : {}),
    ...(data.cost !== undefined ? { cost: data.cost } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(data.details !== undefined ? { details: data.details } : {}),
    updated_at: now,
    _local_pending: true,
    _pending_upload: hasPendingUploadImages(data.details?.images || record.details?.images),
    pending_upload: hasPendingUploadImages(data.details?.images || record.details?.images),
  }
  const linkedExpenses = await localDb.query('expenses', row =>
    row.family_id === familyId
    && !row.deleted_at
    && row.source_type === 'auto'
    && row.source_record_id === recordId,
  )
  const nextCost = Number(nextRecord.cost || 0)
  const createdExpenseId = linkedExpenses.length === 0 && nextCost > 0
    ? createStableEntityId('expense')
    : ''
  const nextExpenseRows = nextCost > 0
    ? (linkedExpenses.length > 0
        ? linkedExpenses.map((expense) => ({
            ...expense,
            ...buildLocalHealthExpense(
              familyId,
              dog,
              {
                type: record.type,
                date: nextRecord.date,
                notes: nextRecord.notes,
              },
              recordId,
              nextCost,
              expense._id,
              now,
            ),
            version: Number(expense.version || 0),
            created_at: expense.created_at,
            updated_at: now,
            _local_pending: true,
          }))
        : [buildLocalHealthExpense(
            familyId,
            dog,
            {
              type: record.type,
              date: nextRecord.date,
              notes: nextRecord.notes,
            },
            recordId,
            nextCost,
            createdExpenseId,
            now,
          )])
    : []
  const syncMeta = buildSyncMeta({
    [recordId]: Number(record.version || 0),
    ...linkedExpenses.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = Number(row.version || 0)
      return acc
    }, {}),
  }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_HEALTH_RECORD),
    clientEntityIds: createdExpenseId ? { expenses: createdExpenseId } : undefined,
  })
  await localDb.transactRows(['health_records', 'expenses'] as const, async (rows) => {
    await rows.updateRow('health_records', recordId, nextRecord as LocalRowOf<'health_records'>)
    for (const expense of linkedExpenses) {
      if (nextExpenseRows.every(nextRow => nextRow._id !== expense._id)) {
        await rows.deleteRow('expenses', expense._id)
      }
    }
    for (const expense of nextExpenseRows) {
      await rows.upsertRow('expenses', expense as LocalRowOf<'expenses'>)
    }
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.UPDATE_HEALTH_RECORD,
    familyId,
    { ...data, id: recordId, _sync: syncMeta },
    ['health_records', 'expenses'],
    syncMeta,
    { dogName: normalizeDogName(dog) },
  )
  return {
    message: '已更新',
    ...buildLocalAck(syncMeta, [
      { collection: 'health_records', id: recordId, version: Number(record.version || 0), updatedAt: now },
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

export async function deleteHealthRecordLocally(ctx: RuntimeMutationContext, familyId: string, recordIdInput: string) {
  const recordId = String(recordIdInput || '').trim()
  if (!recordId) throw new Error('缺少记录 ID')
  const record = await findLocalRow('health_records', recordId)
  if (!record || record.family_id !== familyId || record.deleted_at) throw new Error('记录不存在')

  const linkedReminderTasks = await localDb.query('tasks', row =>
    row.family_id === familyId
    && row.source_record_id === recordId
    && row.status === 'pending',
  )
  const linkedExpenses = await localDb.query('expenses', row =>
    row.family_id === familyId
    && !row.deleted_at
    && row.source_type === 'auto'
    && row.source_record_id === recordId,
  )
  const now = getNow()
  const baseVersions = {
    [recordId]: Number(record.version || 0),
    ...linkedReminderTasks.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = Number(row.version || 0)
      return acc
    }, {}),
    ...linkedExpenses.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = Number(row.version || 0)
      return acc
    }, {}),
  }
  const syncMeta = buildSyncMeta(baseVersions, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.DELETE_HEALTH_RECORD),
  })

  await localDb.transactRows(['health_records', 'tasks', 'expenses'] as const, async (rows) => {
    await rows.updateRow('health_records', recordId, row => ({
      ...row,
      deleted_at: now,
      updated_at: now,
      _local_pending: true,
    } as LocalRowOf<'health_records'>))
    for (const task of linkedReminderTasks) {
      await rows.updateRow('tasks', task._id, row => ({
        ...row,
        status: 'cancelled',
        updated_at: now,
        _local_pending: true,
      } as LocalRowOf<'tasks'>))
    }
    for (const expense of linkedExpenses) {
      await rows.deleteRow('expenses', expense._id)
    }
  })

  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.DELETE_HEALTH_RECORD,
    familyId,
    { id: recordId, _sync: syncMeta },
    ['health_records', 'tasks', 'expenses'],
    syncMeta,
  )
  return {
    message: '已删除',
    ...buildLocalAck(syncMeta, [
      { collection: 'health_records', id: recordId, version: Number(record.version || 0), updatedAt: now, deletedAt: now },
      ...linkedReminderTasks.map(row => ({ collection: 'tasks' as BusinessCollectionName, id: row._id, version: Number(row.version || 0), updatedAt: now })),
      ...linkedExpenses.map(row => ({
        collection: 'expenses' as BusinessCollectionName,
        id: row._id,
        version: Number(row.version || 0),
        updatedAt: now,
        deletedAt: now,
      })),
    ]),
  }
}

export async function updateIllnessStatusLocally(ctx: RuntimeMutationContext, familyId: string, illnessIds: string[], status: string) {
  const rows = await localDb.query('health_records', row => illnessIds.includes(row._id))
  if (!rows.length) return null

  const now = getNow()
  const targetIds = new Set(rows.map(row => row._id))
  const baseVersions = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row._id] = Number(row.version || 0)
    return acc
  }, {})
  const syncMeta = buildSyncMeta(baseVersions, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_ILLNESS_STATUS),
  })

  await localDb.transactRows('health_records', async (rowTx) => {
    for (const row of rows) {
      await rowTx.updateRow(row._id, current => ({
        ...current,
        details: { ...(current.details || {}), treatment_status: status },
        updated_at: now,
      } as LocalRowOf<'health_records'>))
    }
  })

  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.UPDATE_ILLNESS_STATUS,
    familyId,
    { illnessIds: [...targetIds], status, _sync: syncMeta },
    ['health_records'],
    syncMeta,
  )
  return {
    data: {
      success: true,
      updatedIllnessIds: [...targetIds],
    },
    syncMeta,
  }
}

export async function recoverIllnessesLocally(ctx: RuntimeMutationContext, familyId: string, illnessIds: string[], medicationTaskIds: string[] = [], recoveryDate?: number) {
  const illnessRows = await localDb.query('health_records', row => illnessIds.includes(row._id))
  if (!illnessRows.length) return null
  const linkedMedicationRows = await localDb.query('medication_tasks', row =>
    medicationTaskIds.includes(row._id)
    || (!!row.source_record_id && illnessIds.includes(row.source_record_id)),
  )

  const now = getNow()
  const resolvedRecoveryDate = Number.isFinite(Number(recoveryDate)) ? Number(recoveryDate) : now
  const baseVersions = {
    ...illnessRows.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = Number(row.version || 0)
      return acc
    }, {}),
    ...linkedMedicationRows.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = Number(row.version || 0)
      return acc
    }, {}),
  }
  const syncMeta = buildSyncMeta(baseVersions, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.RECOVER_ILLNESSES),
  })

  await localDb.transactRows(['health_records', 'medication_tasks'] as const, async (rows) => {
    for (const illness of illnessRows) {
      await rows.updateRow('health_records', illness._id, row => ({
        ...row,
        details: { ...(row.details || {}), treatment_status: '已康复', recovery_date: resolvedRecoveryDate },
        updated_at: now,
      } as LocalRowOf<'health_records'>))
    }
    for (const task of linkedMedicationRows) {
      await rows.updateRow('medication_tasks', task._id, row => ({
        ...row,
        status: '已取消',
        updated_at: now,
      } as LocalRowOf<'medication_tasks'>))
    }
  })

  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.RECOVER_ILLNESSES,
    familyId,
    {
      illnessIds: illnessRows.map(row => row._id),
      medicationTaskIds: linkedMedicationRows.map(row => row._id),
      recoveryDate: resolvedRecoveryDate,
      _sync: syncMeta,
    },
    ['health_records', 'medication_tasks'],
    syncMeta,
  )
  return {
    data: {
      recoveredIllnessIds: illnessRows.map(row => row._id),
      cancelledMedicationTaskIds: linkedMedicationRows.map(row => row._id),
    },
    syncMeta,
  }
}

export async function cleanupDuplicateIllnessesLocally(ctx: RuntimeMutationContext, familyId: string, dogId?: string) {
  const illnessRows = await localDb.query('health_records', row =>
    row.family_id === familyId
    && row.type === 'illness'
    && !row.deleted_at
    && (!dogId || row.dog_id === dogId),
  )
  const activeRows = illnessRows.filter((row) => String(row.details?.treatment_status || '观察中') !== '已康复')
  const groups = new Map<string, Array<LocalRowOf<'health_records'>>>()

  for (const row of activeRows) {
    const condition = String(row.details?.primary_condition || row.details?.condition || '').trim() || '生病中'
    const key = `${row.dog_id}:${condition}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)?.push(row)
  }

  let cleanedGroups = 0
  let cleanedRecords = 0
  const now = getNow()
  const duplicateToKeeper = new Map<string, string>()
  const duplicateIds = new Set<string>()

  for (const groupRows of groups.values()) {
    if (groupRows.length <= 1) continue
    cleanedGroups += 1
    const sorted = [...groupRows].sort((left, right) => {
      const rightTs = right.updated_at || right.date || right.created_at || 0
      const leftTs = left.updated_at || left.date || left.created_at || 0
      return rightTs - leftTs
    })
    const keeper = sorted[0]
    for (const duplicate of sorted.slice(1)) {
      duplicateToKeeper.set(duplicate._id, keeper._id)
      duplicateIds.add(duplicate._id)
      cleanedRecords += 1
    }
  }

  if (!cleanedRecords) {
    return { data: { cleanedGroups: 0, cleanedRecords: 0 } }
  }

  const affectedTasks = await localDb.query('tasks', row =>
    row.family_id === familyId
    && !!row.source_record_id
    && duplicateIds.has(row.source_record_id),
  )
  await localDb.transactRows(['health_records', 'tasks'] as const, async (rows) => {
    for (const task of affectedTasks) {
      const keeperId = task.source_record_id ? duplicateToKeeper.get(task.source_record_id) : ''
      if (!keeperId) continue
      await rows.updateRow('tasks', task._id, row => ({
        ...row,
        source_record_id: keeperId,
        updated_at: now,
        _local_pending: true,
      } as LocalRowOf<'tasks'>))
    }
    for (const row of activeRows.filter(row => duplicateIds.has(row._id))) {
      await rows.updateRow('health_records', row._id, current => ({
        ...current,
        details: {
          ...(current.details || {}),
          treatment_status: '已康复',
          merged_into_record_id: duplicateToKeeper.get(row._id) || null,
          merge_reason: 'duplicate_active_condition',
        },
        updated_at: now,
        _local_pending: true,
      } as LocalRowOf<'health_records'>))
    }
  })

  const baseVersions = {
    ...activeRows.reduce<Record<string, number>>((acc, row) => {
      if (duplicateIds.has(row._id)) acc[row._id] = Number(row.version || 0)
      return acc
    }, {}),
    ...affectedTasks.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = Number(row.version || 0)
      return acc
    }, {}),
  }
  const syncMeta = buildSyncMeta(baseVersions, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.CLEANUP_DUPLICATE_ILLNESSES),
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.CLEANUP_DUPLICATE_ILLNESSES,
    familyId,
    { dog_id: dogId || null, _sync: syncMeta },
    ['health_records', 'tasks'],
    syncMeta,
  )

  return {
    data: { cleanedGroups, cleanedRecords },
    ...buildLocalAck(syncMeta, [
      ...activeRows
        .filter(row => duplicateIds.has(row._id))
        .map(row => ({ collection: 'health_records' as BusinessCollectionName, id: row._id, version: Number(row.version || 0), updatedAt: now })),
      ...affectedTasks.map(row => ({ collection: 'tasks' as BusinessCollectionName, id: row._id, version: Number(row.version || 0), updatedAt: now })),
    ]),
  }
}
