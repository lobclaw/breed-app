import { localDb } from '@/localdb/db'
import { createClientMutationId, createStableEntityId } from '@/localdb/id'
import { LOCAL_MUTATION_TYPES, type LocalMutationPayload, type LocalMutationType } from '@/localdb/mutation-registry'
import { findLocal as findLocalRow } from '@/localdb/repository'
import { buildLocalMedicationExpense, normalizeDogName } from '@/localdb/runtime/local-builders'
import { buildLocalAck, buildSyncMeta, getFamilyId, getNow } from '@/localdb/runtime/mutation-helpers'
import type { BusinessCollectionName, LocalRowOf, SyncMetadata } from '@/localdb/types'
import { getBeijingDayStart, getBeijingOrdinalDay } from '@/utils/date'

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

function getTaskBaseVersion(task: Record<string, any> | null) {
  if (!task?._id) return {}
  return { [task._id]: Number(task.version || 0) }
}

async function getDogsByIds(dogIds: string[]) {
  const uniqueIds = [...new Set(dogIds.filter(Boolean))]
  if (!uniqueIds.length) return []
  const dogs = await localDb.query<any>('dogs', dog => uniqueIds.includes(dog._id))
  const dogMap = new Map(dogs.map(dog => [dog._id, dog]))
  return uniqueIds.map(id => dogMap.get(id)).filter(Boolean)
}

export async function batchStartMedicationLocally(ctx: RuntimeMutationContext, familyIdInput: string, data: Record<string, any>) {
  const familyId = getFamilyId(familyIdInput)
  if (!Array.isArray(data.dog_ids) || !data.dog_ids.length) throw new Error('请选择犬只')
  const dogs = await getDogsByIds(data.dog_ids)
  if (dogs.length !== [...new Set(data.dog_ids)].length) throw new Error('部分犬只未同步到本地，请联网刷新一次')

  const now = getNow()
  const durationDays = Number(data.duration_days || 1)
  const startDate = Number.isFinite(Number(data.actual_start_date)) ? Number(data.actual_start_date) : now
  const endDate = startDate + ((durationDays - 1) * 86400000)
  const illnessLinks = new Map((data.illness_links || data.illnessLinks || []).map((item: any) => [item.dog_id, item.illness_record_id]))
  const overrideDogIdSet = new Set(Array.isArray(data.override_dog_ids) ? data.override_dog_ids.filter(Boolean) : [])
  const overriddenMedicationTasks = overrideDogIdSet.size > 0
    ? await localDb.query<any>('medication_tasks', row =>
      row.family_id === familyId
      && overrideDogIdSet.has(row.dog_id)
      && row.drug_name === data.drug_name
      && row.status === '进行中',
    )
    : []
  const medicationTasks = dogs.map((dog) => ({
    _id: createStableEntityId('medication_task'),
    dog_id: dog._id,
    dog_name: normalizeDogName(dog),
    family_id: familyId,
    source_record_id: illnessLinks.get(dog._id) || (dogs.length === 1 ? (data.illnessRecordId || data.illness_record_id || null) : null),
    protocol_id: data.protocol_id || null,
    drug_name: data.drug_name,
    dosage: data.dosage || null,
    dosage_unit: data.dosage_unit || null,
    method: data.method || '口服',
    frequency: data.frequency || 1,
    duration_days: durationDays,
    start_date: startDate,
    actual_start_date: startDate,
    end_date: endDate,
    status: '进行中',
    daily_doses: {},
    notes: data.notes || null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
  }))
  const perDogCost = data.cost && Number(data.cost) > 0
    ? (dogs.length > 1 ? Math.round((Number(data.cost) / dogs.length) * 100) / 100 : Number(data.cost))
    : 0
  const expenseRows = perDogCost > 0
    ? dogs.map((dog, index) => buildLocalMedicationExpense(
      familyId,
      dog,
      data,
      medicationTasks[index]._id,
      perDogCost,
      durationDays,
      startDate,
      createStableEntityId('expense'),
      now,
    ))
    : []
  const linkedIllnessIds = medicationTasks.map(task => task.source_record_id).filter(Boolean)
  const linkedIllnessRows = linkedIllnessIds.length > 0
    ? await localDb.query<any>('health_records', row =>
      row.family_id === familyId
      && linkedIllnessIds.includes(row._id),
    )
    : []
  const syncMeta = buildSyncMeta({
    ...overriddenMedicationTasks.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = Number(row.version || 0)
      return acc
    }, {}),
    ...linkedIllnessRows.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = Number(row.version || 0)
      return acc
    }, {}),
  }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.CREATE_MEDICATION_TASKS),
    clientEntityIds: {
      medication_tasks: medicationTasks.map(task => task._id),
      ...(expenseRows.length ? { expenses: expenseRows.map(row => row._id) } : {}),
    },
  })

  await localDb.transactRows(['medication_tasks', 'health_records', 'expenses'] as const, async (rows) => {
    for (const task of overriddenMedicationTasks) {
      await rows.updateRow('medication_tasks', task._id, row => ({
        ...row,
        status: '已取消',
        updated_at: now,
        _local_pending: true,
      } as LocalRowOf<'medication_tasks'>))
    }
    for (const task of medicationTasks) {
      await rows.upsertRow('medication_tasks', task as unknown as LocalRowOf<'medication_tasks'>)
    }
    for (const expenseRow of expenseRows) {
      await rows.upsertRow('expenses', expenseRow as unknown as LocalRowOf<'expenses'>)
    }
    for (const illnessRow of linkedIllnessRows) {
      await rows.updateRow('health_records', illnessRow._id, row => ({
        ...row,
        details: { ...(row.details || {}), treatment_status: '治疗中' },
        updated_at: now,
      } as LocalRowOf<'health_records'>))
    }
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.CREATE_MEDICATION_TASKS,
    familyId,
    { ...data, _sync: syncMeta },
    ['medication_tasks', 'health_records', 'expenses'],
    syncMeta,
    { dogNames: dogs.map(dog => normalizeDogName(dog)), drugName: data.drug_name },
  )

  return {
    data: {
      count: medicationTasks.length,
      medications: medicationTasks.map(task => ({ medicationId: task._id, dog_id: task.dog_id })),
    },
    ...buildLocalAck(syncMeta, [
      ...medicationTasks.map(task => ({
        collection: 'medication_tasks' as BusinessCollectionName,
        id: task._id,
        version: 0,
        updatedAt: task.updated_at,
      })),
      ...overriddenMedicationTasks.map(task => ({
        collection: 'medication_tasks' as BusinessCollectionName,
        id: task._id,
        version: Number(task.version || 0),
        updatedAt: now,
      })),
      ...linkedIllnessRows.map(record => ({
        collection: 'health_records' as BusinessCollectionName,
        id: record._id,
        version: Number(record.version || 0),
        updatedAt: now,
      })),
      ...expenseRows.map(row => ({
        collection: 'expenses' as BusinessCollectionName,
        id: row._id,
        version: 0,
        updatedAt: row.updated_at,
      })),
    ]),
  }
}

export async function recordMedicationDoseLocally(ctx: RuntimeMutationContext, familyId: string, medicationTaskId: string) {
  const task = await localDb.findById<any>('medication_tasks', medicationTaskId)
  if (!task || task.status !== '进行中') return null

  const now = getNow()
  const today = startOfDay(now)
  const startDate = startOfDay(task.actual_start_date || task.start_date || task.created_at || now)
  const currentDay = getBeijingOrdinalDay(startDate, today) || 0
  if (currentDay < 1 || currentDay > (task.duration_days || 1)) return null

  const nextDailyDoses = {
    ...(task.daily_doses || {}),
    [String(currentDay)]: Number(task.daily_doses?.[String(currentDay)] || 0) + 1,
  }
  const frequency = Number(task.frequency || 1)
  const todayComplete = Number(nextDailyDoses[String(currentDay)] || 0) >= frequency
  let allComplete = todayComplete
  if (allComplete) {
    for (let day = 1; day <= Number(task.duration_days || 1); day += 1) {
      if (Number(nextDailyDoses[String(day)] || 0) < frequency) {
        allComplete = false
        break
      }
    }
  }

  const syncMeta = buildSyncMeta(getTaskBaseVersion(task), {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.RECORD_MEDICATION_DOSE),
  })

  await localDb.transactRows('medication_tasks', async (rows) => {
    await rows.updateRow(medicationTaskId, row => ({
      ...row,
      daily_doses: nextDailyDoses,
      status: allComplete ? '已完成' : row.status,
      updated_at: now,
    } as LocalRowOf<'medication_tasks'>))
  })

  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.RECORD_MEDICATION_DOSE,
    familyId,
    { medicationTaskId, _sync: syncMeta },
    ['medication_tasks'],
    syncMeta,
    { medicationTitle: task.drug_name || task.title },
  )
  return { data: { completed: todayComplete, allComplete }, syncMeta }
}

export async function batchCompleteMedicationDayLocally(ctx: RuntimeMutationContext, familyId: string, medicationTaskIds: string[]) {
  const rows = await localDb.query<any>('medication_tasks', task => medicationTaskIds.includes(task._id))
  const activeRows = rows.filter(task => task.status === '进行中')
  if (!activeRows.length) return null

  const now = getNow()
  const baseVersions = activeRows.reduce<Record<string, number>>((acc, task) => {
    acc[task._id] = Number(task.version || 0)
    return acc
  }, {})
  const syncMeta = buildSyncMeta(baseVersions, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.BATCH_COMPLETE_MEDICATION_DAY),
  })
  const medicationPatches = activeRows.map((row) => {
    const today = startOfDay(now)
    const startDate = startOfDay(row.actual_start_date || row.start_date || row.created_at || now)
    const currentDay = getBeijingOrdinalDay(startDate, today) || 0
    if (currentDay < 1 || currentDay > Number(row.duration_days || 1)) return null

    const frequency = Number(row.frequency || 1)
    const nextDailyDoses = {
      ...(row.daily_doses || {}),
      [String(currentDay)]: frequency,
    }
    let allComplete = true
    for (let day = 1; day <= Number(row.duration_days || 1); day += 1) {
      if (Number(nextDailyDoses[String(day)] || 0) < frequency) {
        allComplete = false
        break
      }
    }

    return { id: row._id, nextDailyDoses, allComplete }
  }).filter(Boolean) as Array<{ id: string, nextDailyDoses: Record<string, number>, allComplete: boolean }>

  await localDb.transactRows('medication_tasks', async (rows) => {
    for (const patch of medicationPatches) {
      await rows.updateRow(patch.id, row => ({
        ...row,
        daily_doses: patch.nextDailyDoses,
        status: patch.allComplete ? '已完成' : row.status,
        updated_at: now,
      } as LocalRowOf<'medication_tasks'>))
    }
  })

  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.BATCH_COMPLETE_MEDICATION_DAY,
    familyId,
    { medicationTaskIds: activeRows.map(task => task._id), _sync: syncMeta },
    ['medication_tasks'],
    syncMeta,
    { medicationTitles: activeRows.map(task => task.drug_name || task.title).filter(Boolean) },
  )
  return {
    data: {
      completedMedicationTaskIds: medicationPatches.map(task => task.id),
      fullyCompletedMedicationTaskIds: medicationPatches.filter(task => task.allComplete).map(task => task.id),
    },
    syncMeta,
  }
}

export async function endMedicationLocally(ctx: RuntimeMutationContext, familyId: string, medicationTaskId: string, data: Record<string, any> = {}) {
  const task = await findLocalRow<any>('medication_tasks', medicationTaskId)
  if (!task || task.family_id !== familyId) throw new Error('用药任务不存在')
  if (task.status !== '进行中') throw new Error('该用药已结束')

  const linkedIllness = task.source_record_id
    ? await findLocalRow<any>('health_records', task.source_record_id)
    : null
  const pendingDailyTasks = await localDb.query<any>('tasks', row =>
    row.family_id === familyId
    && row.medication_task_id === medicationTaskId
    && row.status === 'pending',
  )
  const illnessDisposition = String(data.illnessDisposition || data.illness_disposition || '').trim()
  const nextIllnessStatusMap: Record<string, string> = {
    observation: '观察中',
    recovered: '已康复',
    keep_treating: '治疗中',
  }
  const nextIllnessStatus = nextIllnessStatusMap[illnessDisposition] || null
  const shouldUpdateIllness = !!linkedIllness
    && linkedIllness.family_id === familyId
    && linkedIllness.type === 'illness'
    && !linkedIllness.deleted_at
    && nextIllnessStatus
    && String(linkedIllness.details?.treatment_status || '观察中') !== '已康复'

  const now = getNow()
  const baseVersions = {
    [task._id]: Number(task.version || 0),
    ...(shouldUpdateIllness && linkedIllness ? { [linkedIllness._id]: Number(linkedIllness.version || 0) } : {}),
    ...pendingDailyTasks.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = Number(row.version || 0)
      return acc
    }, {}),
  }
  const syncMeta = buildSyncMeta(baseVersions, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.END_MEDICATION),
  })

  await localDb.transactRows(['medication_tasks', 'health_records', 'tasks'] as const, async (rows) => {
    await rows.updateRow('medication_tasks', medicationTaskId, row => ({
      ...row,
      status: '已取消',
      updated_at: now,
      _local_pending: true,
    } as LocalRowOf<'medication_tasks'>))
    if (shouldUpdateIllness && linkedIllness) {
      await rows.updateRow('health_records', linkedIllness._id, row => ({
        ...row,
        details: { ...(row.details || {}), treatment_status: nextIllnessStatus },
        updated_at: now,
        _local_pending: true,
      } as LocalRowOf<'health_records'>))
    }
    for (const task of pendingDailyTasks) {
      await rows.updateRow('tasks', task._id, row => ({
        ...row,
        status: 'cancelled',
        updated_at: now,
        _local_pending: true,
      } as LocalRowOf<'tasks'>))
    }
  })

  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.END_MEDICATION,
    familyId,
    { id: medicationTaskId, ...data, _sync: syncMeta },
    ['medication_tasks', 'health_records', 'tasks'],
    syncMeta,
  )
  return {
    message: '用药已提前结束',
    ...buildLocalAck(syncMeta, [
      { collection: 'medication_tasks', id: medicationTaskId, version: Number(task.version || 0), updatedAt: now },
      ...(shouldUpdateIllness && linkedIllness
        ? [{ collection: 'health_records' as BusinessCollectionName, id: linkedIllness._id, version: Number(linkedIllness.version || 0), updatedAt: now }]
        : []),
      ...pendingDailyTasks.map(row => ({ collection: 'tasks' as BusinessCollectionName, id: row._id, version: Number(row.version || 0), updatedAt: now })),
    ]),
  }
}

export async function endMedicationByDogLocally(ctx: RuntimeMutationContext, familyId: string, dogId: string) {
  const rows = await localDb.query<any>('medication_tasks', row => row.dog_id === dogId && row.status === '进行中')
  if (!rows.length) return null
  const medicationTaskIds = rows.map(row => row._id)
  const pendingDailyTasks = await localDb.query<any>('tasks', row =>
    row.family_id === familyId
    && medicationTaskIds.includes(row.medication_task_id)
    && row.status === 'pending',
  )

  const now = getNow()
  const baseVersions = {
    ...rows.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = Number(row.version || 0)
      return acc
    }, {}),
    ...pendingDailyTasks.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = Number(row.version || 0)
      return acc
    }, {}),
  }
  const syncMeta = buildSyncMeta(baseVersions, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.END_MEDICATION_BY_DOG),
  })

  await localDb.transactRows(['medication_tasks', 'tasks'] as const, async (rowTx) => {
    for (const task of rows) {
      await rowTx.updateRow('medication_tasks', task._id, row => ({
        ...row,
        status: '已取消',
        updated_at: now,
      } as LocalRowOf<'medication_tasks'>))
    }
    for (const task of pendingDailyTasks) {
      await rowTx.updateRow('tasks', task._id, row => ({
        ...row,
        status: 'cancelled',
        updated_at: now,
        _local_pending: true,
      } as LocalRowOf<'tasks'>))
    }
  })

  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.END_MEDICATION_BY_DOG,
    familyId,
    { dogId, _sync: syncMeta },
    ['medication_tasks', 'tasks'],
    syncMeta,
  )
  return {
    data: {
      cancelledMedicationTaskIds: rows.map(row => row._id),
    },
    ...buildLocalAck(syncMeta, [
      ...rows.map(row => ({ collection: 'medication_tasks' as BusinessCollectionName, id: row._id, version: Number(row.version || 0), updatedAt: now })),
      ...pendingDailyTasks.map(row => ({ collection: 'tasks' as BusinessCollectionName, id: row._id, version: Number(row.version || 0), updatedAt: now })),
    ]),
  }
}
