import { localDb } from '@/localdb/db'
import { createClientMutationId, createStableEntityId } from '@/localdb/id'
import { LOCAL_MUTATION_TYPES, type LocalMutationPayload, type LocalMutationType } from '@/localdb/mutation-registry'
import { findLocal as findLocalRow } from '@/localdb/repository'
import {
  buildLocalAdoptionIncome,
  buildLocalDog,
  buildLocalDogPurchaseExpense,
  buildLocalDogPurchaseExpenseSnapshot,
  parseAdoptionFeeAmount,
} from '@/localdb/runtime/local-builders'
import { buildLocalAck, buildSyncMeta, getFamilyId, getNow } from '@/localdb/runtime/mutation-helpers'
import type { BusinessCollectionName, LocalRowOf, SyncMetadata } from '@/localdb/types'

type DogRow = LocalRowOf<'dogs'>
type ExpenseRow = LocalRowOf<'expenses'>
type IncomeRow = LocalRowOf<'incomes'>
type TaskRow = LocalRowOf<'tasks'>
type BreedingCycleRow = LocalRowOf<'breeding_cycles'>
type DogWeightRow = LocalRowOf<'dog_weights'> & { date?: number; notes?: string | null }
type RecycleCollection = 'dogs' | 'expenses' | 'incomes' | 'agents' | 'medication_protocols'
type DogPayloadTimestamp = number | string | null
type DogPayloadAmount = number | string | null

export interface CreateDogPayload {
  name?: string
  disposition?: string
  species?: string
  breed?: string
  gender?: string
  role?: string
  birth_date?: DogPayloadTimestamp
  source?: string | null
  purchase_price?: DogPayloadAmount
  purchase_date?: DogPayloadTimestamp
  latest_weight?: DogPayloadAmount
  origin_litter_id?: string | null
  owner_info?: string | null
}

export interface UpdateDogPayload {
  name?: string
  breed?: string
  gender?: string
  role?: string
  birth_date?: DogPayloadTimestamp
  purchase_price?: DogPayloadAmount
  purchase_date?: DogPayloadTimestamp
  latest_weight?: DogPayloadAmount
  origin_litter_id?: string | null
  owner_info?: string | null
}

export interface DogDispositionPayload {
  disposition_date?: number | string | null
  date?: number | string | null
  disposition_notes?: string | null
  reason?: string | null
  cause?: string | null
  notes?: string | null
  recipient?: string | null
  adoption_fee?: number | string | null
  adoptionFee?: number | string | null
}

export interface DogWeightPayload {
  dog_id?: string
  dogId?: string
  weight?: number | string
  date?: number | string
  notes?: string | null
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

export async function createDogLocally(ctx: RuntimeMutationContext, familyIdInput: string, data: CreateDogPayload) {
    const familyId = getFamilyId(familyIdInput)
    const now = getNow()
    const dogId = createStableEntityId('dog')
    const dog = buildLocalDog(familyId, data, dogId, now) as DogRow
    const expenseId = Number(data.purchase_price || 0) > 0 ? createStableEntityId('expense') : ''
    const expenseRow = expenseId ? buildLocalDogPurchaseExpense(familyId, data, dogId, expenseId, now) : null
    const syncMeta = buildSyncMeta({}, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.CREATE_DOG),
      clientEntityIds: {
        dogs: dogId,
        ...(expenseId ? { expenses: expenseId } : {}),
      },
    })

    await localDb.transactRows(['dogs', 'expenses'] as const, async (rows) => {
      await rows.upsertRow('dogs', dog)
      if (expenseRow) {
        await rows.upsertRow('expenses', expenseRow)
      }
    })
    await ctx.enqueueMutation(LOCAL_MUTATION_TYPES.CREATE_DOG, familyId, { ...data, _sync: syncMeta }, ['dogs', 'expenses'], syncMeta)
    return {
      data: { _id: dogId },
      ...buildLocalAck(syncMeta, [
        { collection: 'dogs', id: dogId, version: 0, updatedAt: now },
        ...(expenseRow ? [{ collection: 'expenses' as BusinessCollectionName, id: expenseRow._id, version: 0, updatedAt: now }] : []),
      ]),
    }
  }

export async function updateDogLocally(ctx: RuntimeMutationContext, familyIdInput: string, dogId: string, data: UpdateDogPayload) {
    const familyId = getFamilyId(familyIdInput)
    const dog = await findLocalRow<DogRow>('dogs', dogId)
    if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')
    const linkedPurchaseExpenses = await localDb.query<ExpenseRow>('expenses', row =>
      row.family_id === familyId
      && !row.deleted_at
      && row.category === '购入'
      && row.source_record_id === dogId,
    )
    const now = getNow()
    const nextPurchasePrice = Object.prototype.hasOwnProperty.call(data, 'purchase_price')
      ? Number(data.purchase_price || 0)
      : Number(dog.purchase_price || 0)
    const nextPurchaseDate = Object.prototype.hasOwnProperty.call(data, 'purchase_date')
      ? Number(data.purchase_date || 0) || null
      : dog.purchase_date
    const createdExpenseId = nextPurchasePrice > 0 && linkedPurchaseExpenses.length === 0
      ? createStableEntityId('expense')
      : ''
    const syncMeta = buildSyncMeta({
      [dogId]: Number(dog.version || 0),
      ...linkedPurchaseExpenses.reduce<Record<string, number>>((acc, row) => {
        acc[row._id] = Number(row.version || 0)
        return acc
      }, {}),
    }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_DOG),
      clientEntityIds: createdExpenseId ? { expenses: createdExpenseId } : undefined,
    })
    const nextDog = {
      ...dog,
      ...data,
      _id: dogId,
      family_id: familyId,
      role: dog.role,
      disposition: dog.disposition,
      deleted_at: dog.deleted_at ?? null,
      updated_at: now,
      _local_pending: true,
    } as DogRow
    const nextExpenseRows = nextPurchasePrice > 0
      ? (linkedPurchaseExpenses.length > 0
          ? linkedPurchaseExpenses.map(row => buildLocalDogPurchaseExpenseSnapshot(
              familyId,
              nextDog,
              nextPurchasePrice,
              Number(nextPurchaseDate || 0) || null,
              row._id,
              now,
              {
                version: Number(row.version || 0),
                createdAt: Number(row.created_at || now),
              },
            ))
          : [buildLocalDogPurchaseExpenseSnapshot(
              familyId,
              nextDog,
              nextPurchasePrice,
              Number(nextPurchaseDate || 0) || null,
              createdExpenseId,
              now,
            )])
      : []

    await localDb.transactRows(['dogs', 'expenses'] as const, async (rows) => {
      await rows.updateRow('dogs', dogId, nextDog)
      for (const expense of linkedPurchaseExpenses) {
        if (nextExpenseRows.every(nextExpense => nextExpense._id !== expense._id)) {
          await rows.deleteRow('expenses', expense._id)
        }
      }
      for (const expense of nextExpenseRows) {
        await rows.upsertRow('expenses', expense)
      }
    })
    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.UPDATE_DOG,
      familyId,
      { id: dogId, patch: data, _sync: syncMeta },
      ['dogs', 'expenses'],
      syncMeta,
      { dogName: data.name || dog.name },
    )
    return {
      message: '已更新',
      ...buildLocalAck(syncMeta, [
        { collection: 'dogs', id: dogId, version: Number(dog.version || 0), updatedAt: now },
        ...nextExpenseRows.map(row => ({
          collection: 'expenses' as BusinessCollectionName,
          id: row._id,
          version: Number(linkedPurchaseExpenses.find(expense => expense._id === row._id)?.version || 0),
          updatedAt: now,
        })),
        ...linkedPurchaseExpenses
          .filter(row => !nextExpenseRows.some(expense => expense._id === row._id))
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

export async function updateDogNameLocally(ctx: RuntimeMutationContext, familyIdInput: string, dogId: string, name: string) {
    const familyId = getFamilyId(familyIdInput)
    const dog = await findLocalRow<DogRow>('dogs', dogId)
    if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')
    const trimmedName = String(name || '').trim()
    if (!trimmedName && dog.role !== '幼崽') throw new Error('请输入新名称')
    const now = getNow()
    const previousName = String(dog.name || '')
    const syncMeta = buildSyncMeta({ [dogId]: Number(dog.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_DOG_NAME),
    })
    const renameScopes: BusinessCollectionName[] = [
      'dogs',
      'tasks',
      'breeding_cycles',
      'litters',
      'health_records',
      'medication_tasks',
      'breeding_records',
      'expenses',
      'incomes',
      'sale_records',
    ]
    const renameDogNames = (row: ExpenseRow): ExpenseRow => {
      if (!Array.isArray(row.linked_dog_ids) || !row.linked_dog_ids.includes(dogId)) return row
      const dogNames = Array.isArray(row.dog_names) ? [...row.dog_names] : []
      row.linked_dog_ids.forEach((linkedDogId: string, index: number) => {
        if (linkedDogId === dogId) dogNames[index] = trimmedName
      })
      return {
        ...row,
        dog_names: dogNames.filter(Boolean),
        dam_name: row.dam_name === previousName ? trimmedName : row.dam_name,
        updated_at: now,
      }
    }
    const [
      taskRows,
      breedingCycleRows,
      litterRows,
      healthRecordRows,
      medicationTaskRows,
      breedingRecordRows,
      expenseRows,
      incomeRows,
      saleRows,
    ] = await Promise.all([
      localDb.query<LocalRowOf<'tasks'>>('tasks', row => row.dog_id === dogId),
      localDb.query<LocalRowOf<'breeding_cycles'>>('breeding_cycles', row => row.dam_id === dogId || row.sire_id === dogId),
      localDb.query<LocalRowOf<'litters'>>('litters', row => row.dam_id === dogId || row.sire_id === dogId),
      localDb.query<LocalRowOf<'health_records'>>('health_records', row => row.dog_id === dogId),
      localDb.query<LocalRowOf<'medication_tasks'>>('medication_tasks', row => row.dog_id === dogId),
      localDb.query<LocalRowOf<'breeding_records'>>('breeding_records', row => row.dog_id === dogId),
      localDb.query<ExpenseRow>('expenses', row => Array.isArray(row.linked_dog_ids) && row.linked_dog_ids.includes(dogId)),
      localDb.query<LocalRowOf<'incomes'>>('incomes', row => row.dog_id === dogId),
      localDb.query<LocalRowOf<'sale_records'>>('sale_records', row => row.dog_id === dogId),
    ])
    await localDb.transactRows(renameScopes, async (rows) => {
      await rows.updateRow('dogs', dogId, row => ({ ...row, name: trimmedName, updated_at: now, _local_pending: true } as DogRow))
      for (const row of taskRows) await rows.updateRow('tasks', row._id, current => ({ ...current, dog_name: trimmedName, updated_at: now } as LocalRowOf<'tasks'>))
      for (const row of breedingCycleRows) {
        await rows.updateRow('breeding_cycles', row._id, current => ({
          ...current,
          dam_name: current.dam_id === dogId ? trimmedName : current.dam_name,
          sire_name: current.sire_id === dogId ? trimmedName : current.sire_name,
          updated_at: now,
        } as LocalRowOf<'breeding_cycles'>))
      }
      for (const row of litterRows) {
        await rows.updateRow('litters', row._id, current => ({
          ...current,
          dam_name: current.dam_id === dogId ? trimmedName : current.dam_name,
          sire_name: current.sire_id === dogId ? trimmedName : current.sire_name,
          updated_at: now,
        } as LocalRowOf<'litters'>))
      }
      for (const row of healthRecordRows) await rows.updateRow('health_records', row._id, current => ({ ...current, dog_name: trimmedName, updated_at: now } as LocalRowOf<'health_records'>))
      for (const row of medicationTaskRows) await rows.updateRow('medication_tasks', row._id, current => ({ ...current, dog_name: trimmedName, updated_at: now } as LocalRowOf<'medication_tasks'>))
      for (const row of breedingRecordRows) await rows.updateRow('breeding_records', row._id, current => ({ ...current, dog_name: trimmedName, updated_at: now } as LocalRowOf<'breeding_records'>))
      for (const row of expenseRows) await rows.updateRow('expenses', row._id, current => renameDogNames(current as ExpenseRow))
      for (const row of incomeRows) await rows.updateRow('incomes', row._id, current => ({ ...current, dog_name: trimmedName, updated_at: now } as LocalRowOf<'incomes'>))
      for (const row of saleRows) await rows.updateRow('sale_records', row._id, current => ({ ...current, dog_name: trimmedName, updated_at: now } as LocalRowOf<'sale_records'>))
    })
    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.UPDATE_DOG_NAME,
      familyId,
      { id: dogId, name: trimmedName, _sync: syncMeta },
      renameScopes,
      syncMeta,
      { dogName: trimmedName },
    )
    return {
      message: '名称已更新',
      ...buildLocalAck(syncMeta, [{ collection: 'dogs', id: dogId, version: Number(dog.version || 0), updatedAt: now }]),
    }
  }

export async function changeDogDispositionLocally(ctx: RuntimeMutationContext, familyIdInput: string, dogId: string, newDisposition: string, data: DogDispositionPayload = {}) {
    const familyId = getFamilyId(familyIdInput)
    const dog = await findLocalRow<DogRow>('dogs', dogId)
    if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')

    const activeCycles = await localDb.query<BreedingCycleRow>('breeding_cycles', row =>
      row.family_id === familyId
      && row.dam_id === dogId
      && ['发情中', '怀孕中'].includes(row.status),
    )
    if (activeCycles.length > 0) {
      const pregnantCycle = activeCycles.find(row => row.status === '怀孕中')
      if (newDisposition === '已领养' || newDisposition === '已赠送') {
        throw new Error('该犬有进行中的繁育周期，请先完成或关闭')
      }
      if (newDisposition === '已退休' && pregnantCycle) {
        throw new Error('该犬当前怀孕中，请先完成生产或记录异常终止')
      }
    }

    const cycleIdsToCancel = new Set<string>()
    const cycleStatusMap = new Map<string, BreedingCycleRow['status']>()
    if (newDisposition === '已故') {
      activeCycles.forEach((cycle) => {
        cycleIdsToCancel.add(cycle._id)
        cycleStatusMap.set(cycle._id, '失败')
      })
    } else if (newDisposition === '已退休') {
      activeCycles
        .filter(cycle => cycle.status === '发情中')
        .forEach((cycle) => {
          cycleIdsToCancel.add(cycle._id)
          cycleStatusMap.set(cycle._id, '放弃')
        })
    }

    const taskRows = await localDb.query<TaskRow>('tasks', row => {
      if (row.family_id !== familyId || row.status !== 'pending') return false
      if (newDisposition === '已故') return row.dog_id === dogId || (!!row.cycle_id && cycleIdsToCancel.has(row.cycle_id))
      return !!row.cycle_id && cycleIdsToCancel.has(row.cycle_id)
    })

    const now = getNow()
    const touchedCycles = activeCycles.filter(cycle => cycleStatusMap.has(cycle._id))
    const dispositionDate = data.disposition_date || data.date || null
    const dispositionNotes = data.disposition_notes
      || data.reason
      || data.cause
      || data.notes
      || data.recipient
      || null
    const adoptionFeeAmount = newDisposition === '已领养' ? parseAdoptionFeeAmount({
      ...data,
      disposition_notes: dispositionNotes,
    }) : 0
    const adoptionIncomeDate = Number(dispositionDate || now)
    const rollbackAdoptionIncomes = dog.disposition === '已领养' && newDisposition !== '已领养'
      ? await localDb.query<IncomeRow>('incomes', row =>
        row.family_id === familyId
        && !row.deleted_at
        && row.type === '领养'
        && row.dog_id === dogId
        && Number(row.date || 0) === Number(dog.disposition_date || 0)
        && String(row.notes || '') === String(dog.disposition_notes || ''),
      )
      : []
    const createdAdoptionIncomeId = newDisposition === '已领养' && adoptionFeeAmount > 0
      ? createStableEntityId('income')
      : ''
    const baseVersions = {
      [dogId]: Number(dog.version || 0),
      ...touchedCycles.reduce<Record<string, number>>((acc, row) => {
        acc[row._id] = Number(row.version || 0)
        return acc
      }, {}),
      ...taskRows.reduce<Record<string, number>>((acc, row) => {
        acc[row._id] = Number(row.version || 0)
        return acc
      }, {}),
      ...rollbackAdoptionIncomes.reduce<Record<string, number>>((acc, row) => {
        acc[row._id] = Number(row.version || 0)
        return acc
      }, {}),
    }
    const syncMeta = buildSyncMeta(baseVersions, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.CHANGE_DOG_DISPOSITION),
      clientEntityIds: createdAdoptionIncomeId ? { incomes: createdAdoptionIncomeId } : undefined,
    })
    const nextAdoptionIncome = createdAdoptionIncomeId
      ? buildLocalAdoptionIncome(
          familyId,
          dog,
          adoptionFeeAmount,
          adoptionIncomeDate,
          dispositionNotes,
          createdAdoptionIncomeId,
          now,
        )
      : null
    const rollbackIncomeIds = new Set(rollbackAdoptionIncomes.map(row => row._id))

    await localDb.transactRows(['dogs', 'breeding_cycles', 'tasks', 'incomes'] as const, async (rows) => {
      await rows.updateRow('dogs', dogId, row => ({
        ...row,
        disposition: newDisposition as DogRow['disposition'],
        disposition_date: ['已故', '已领养', '已赠送', '已退休'].includes(newDisposition) ? Number(dispositionDate || now) : null,
        disposition_notes: ['已故', '已领养', '已赠送', '已退休'].includes(newDisposition) ? dispositionNotes : null,
        updated_at: now,
        _local_pending: true,
      }))
      for (const cycle of touchedCycles) {
        await rows.updateRow('breeding_cycles', cycle._id, row => ({
          ...row,
          status: cycleStatusMap.get(cycle._id) || row.status,
          updated_at: now,
        }))
      }
      for (const task of taskRows) {
        await rows.updateRow('tasks', task._id, row => ({
          ...row,
          status: 'cancelled',
          updated_at: now,
        }))
      }
      for (const incomeId of rollbackIncomeIds) {
        await rows.deleteRow('incomes', incomeId)
      }
      if (nextAdoptionIncome) {
        await rows.upsertRow('incomes', nextAdoptionIncome)
      }
    })

    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.CHANGE_DOG_DISPOSITION,
      familyId,
      {
        id: dogId,
        disposition: newDisposition,
        disposition_date: dispositionDate || undefined,
        disposition_notes: dispositionNotes,
        adoption_fee: adoptionFeeAmount > 0 ? adoptionFeeAmount : undefined,
        _sync: syncMeta,
      },
      ['dogs', 'breeding_cycles', 'tasks', 'incomes'],
      syncMeta,
      { dogName: dog.name },
    )

    return {
      message: '去向已更新',
      ...buildLocalAck(syncMeta, [
        { collection: 'dogs', id: dogId, version: Number(dog.version || 0), updatedAt: now },
        ...touchedCycles.map(row => ({ collection: 'breeding_cycles' as BusinessCollectionName, id: row._id, version: Number(row.version || 0), updatedAt: now })),
        ...taskRows.map(row => ({ collection: 'tasks' as BusinessCollectionName, id: row._id, version: Number(row.version || 0), updatedAt: now })),
        ...(nextAdoptionIncome ? [{ collection: 'incomes' as BusinessCollectionName, id: nextAdoptionIncome._id, version: 0, updatedAt: now }] : []),
        ...rollbackAdoptionIncomes.map(row => ({
          collection: 'incomes' as BusinessCollectionName,
          id: row._id,
          version: Number(row.version || 0),
          updatedAt: now,
          deletedAt: now,
        })),
      ]),
    }
  }

export async function upgradePuppyToBreederLocally(ctx: RuntimeMutationContext, familyIdInput: string, dogId: string) {
    const familyId = getFamilyId(familyIdInput)
    const dog = await findLocalRow<DogRow>('dogs', dogId)
    if (!dog || dog.deleted_at) throw new Error('犬只未同步到本地，请联网刷新一次')
    if (dog.role !== '幼崽') throw new Error('犬只不存在或不是幼崽')

    const now = getNow()
    const syncMeta = buildSyncMeta({ [dogId]: Number(dog.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPGRADE_PUPPY_TO_BREEDER),
    })

    await localDb.transactRows('dogs', async (rows) => {
      const current = await rows.getRow(dogId)
      if (!current || current.deleted_at || current.role !== '幼崽') throw new Error('犬只不存在或不是幼崽')
      await rows.updateRow(dogId, row => ({
        ...row,
        role: '种狗',
        disposition: '在养',
        updated_at: now,
        _local_pending: true,
      }))
    })
    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.UPGRADE_PUPPY_TO_BREEDER,
      familyId,
      { id: dogId, _sync: syncMeta },
      ['dogs'],
      syncMeta,
      { dogName: dog.name },
    )
    return {
      message: '已升级为种犬',
      ...buildLocalAck(syncMeta, [{ collection: 'dogs', id: dogId, version: Number(dog.version || 0), updatedAt: now }]),
    }
  }

export async function softDeleteDogLocally(ctx: RuntimeMutationContext, familyIdInput: string, dogId: string) {
    const familyId = getFamilyId(familyIdInput)
    const dog = await findLocalRow<DogRow>('dogs', dogId)
    if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')
    const now = getNow()
    const syncMeta = buildSyncMeta({ [dogId]: Number(dog.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.SOFT_DELETE_DOG),
    })
    await localDb.transactRows('dogs', async (rows) => {
      const current = await rows.getRow(dogId)
      if (!current) throw new Error('犬只未同步到本地，请联网刷新一次')
      await rows.updateRow(dogId, row => ({ ...row, deleted_at: now, updated_at: now, _local_pending: true }))
    })
    await ctx.enqueueMutation(LOCAL_MUTATION_TYPES.SOFT_DELETE_DOG, familyId, { id: dogId, _sync: syncMeta }, ['dogs'], syncMeta, { dogName: dog.name })
    return {
      message: '已删除（可在回收站恢复）',
      ...buildLocalAck(syncMeta, [{ collection: 'dogs', id: dogId, version: Number(dog.version || 0), updatedAt: now, deletedAt: now }]),
    }
  }

export async function restoreRecycleItemLocally(ctx: RuntimeMutationContext, familyIdInput: string, type: string, id: string) {
    const familyId = getFamilyId(familyIdInput)
    const collectionMap: Record<string, RecycleCollection> = {
      dog: 'dogs',
      expense: 'expenses',
      income: 'incomes',
      agent: 'agents',
      medication_protocol: 'medication_protocols',
    }
    const collection = collectionMap[type]
    if (!collection) throw new Error('不支持的回收站类型')
    const item = await findLocalRow(collection, id)
    if (!item) throw new Error('回收站项目未同步到本地，请联网刷新一次')
    const now = getNow()
    const syncMeta = buildSyncMeta({ [id]: Number(item.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.RECYCLE_RESTORE),
    })
    await localDb.transactRows(collection, async (rows) => {
      const current = await rows.getRow(id)
      if (!current) throw new Error('回收站项目未同步到本地，请联网刷新一次')
      await rows.updateRow(id, row => ({ ...row, deleted_at: null, updated_at: now, _local_pending: true }))
    })
    await ctx.enqueueMutation(LOCAL_MUTATION_TYPES.RECYCLE_RESTORE, familyId, { id, type, _sync: syncMeta }, [collection], syncMeta)
    return {
      message: '已恢复',
      ...buildLocalAck(syncMeta, [{ collection, id, version: Number(item.version || 0), updatedAt: now, deletedAt: null }]),
    }
  }

export async function permanentDeleteRecycleItemLocally(ctx: RuntimeMutationContext, familyIdInput: string, type: string, id: string) {
    const familyId = getFamilyId(familyIdInput)
    const collectionMap: Record<string, RecycleCollection> = {
      dog: 'dogs',
      expense: 'expenses',
      income: 'incomes',
      agent: 'agents',
      medication_protocol: 'medication_protocols',
    }
    const collection = collectionMap[type]
    if (!collection) throw new Error('不支持的回收站类型')
    const item = await findLocalRow(collection, id)
    if (!item) throw new Error('回收站项目未同步到本地，请联网刷新一次')
    const now = getNow()
    const syncMeta = buildSyncMeta({ [id]: Number(item.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.RECYCLE_PERMANENT_DELETE),
    })
    await localDb.transactRows(collection, async (rows) => {
      await rows.deleteRow(id)
    })
    await ctx.enqueueMutation(LOCAL_MUTATION_TYPES.RECYCLE_PERMANENT_DELETE, familyId, { id, type, _sync: syncMeta }, [collection], syncMeta)
    return {
      message: '已永久删除',
      ...buildLocalAck(syncMeta, [{ collection, id, version: Number(item.version || 0), updatedAt: now, deletedAt: now }]),
    }
  }

export async function addWeightRecordLocally(ctx: RuntimeMutationContext, familyIdInput: string, data: DogWeightPayload) {
    const familyId = getFamilyId(familyIdInput)
    const dogId = String(data.dog_id || data.dogId || '').trim()
    if (!dogId) throw new Error('缺少犬只 ID')
    const weight = Number(data.weight)
    if (!Number.isFinite(weight) || weight <= 0) throw new Error('请输入有效体重')

    const dog = await findLocalRow<DogRow>('dogs', dogId)
    if (!dog || dog.deleted_at) throw new Error('犬只未同步到本地，请联网刷新一次')

    const now = getNow()
    const weightId = createStableEntityId('dog_weight')
    const recordDate = Number(data.date || now)
    const weightRecord = {
      _id: weightId,
      family_id: familyId,
      dog_id: dogId,
      weight,
      measured_at: recordDate,
      date: recordDate,
      notes: data.notes || null,
      deleted_at: null,
      version: 0,
      created_at: now,
      updated_at: now,
      _local_pending: true,
    }

    const existingWeights = await localDb.query<DogWeightRow>('dog_weights', row => row.family_id === familyId && row.dog_id === dogId)
    const latestWeightRecord = [...existingWeights, weightRecord].sort((left, right) => {
      const rightDate = Number(right.date || right.measured_at || 0)
      const leftDate = Number(left.date || left.measured_at || 0)
      if (rightDate !== leftDate) return rightDate - leftDate
      return (right.created_at || 0) - (left.created_at || 0)
    })[0]

    const syncMeta = buildSyncMeta({ [dogId]: Number(dog.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.ADD_DOG_WEIGHT),
      clientEntityIds: { dog_weights: weightId },
    })

    await localDb.transactRows(['dog_weights', 'dogs'] as const, async (rows) => {
      await rows.upsertRow('dog_weights', weightRecord as DogWeightRow)
      await rows.updateRow('dogs', dogId, row => ({
        ...row,
        latest_weight: latestWeightRecord?.weight || weight,
        updated_at: now,
      }))
    })

    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.ADD_DOG_WEIGHT,
      familyId,
      {
        dog_id: dogId,
        weight,
        date: recordDate,
        notes: data.notes || null,
        _sync: syncMeta,
      },
      ['dog_weights', 'dogs'],
      syncMeta,
      { dogName: dog.name },
    )

    return {
      message: '已保存',
      ...buildLocalAck(syncMeta, [
        { collection: 'dog_weights', id: weightId, version: 0, updatedAt: now },
        { collection: 'dogs', id: dogId, version: Number(dog.version || 0), updatedAt: now },
      ]),
    }
  }
