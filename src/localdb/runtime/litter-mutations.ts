import { localDb } from '@/localdb/db'
import { createClientMutationId, createStableEntityId } from '@/localdb/id'
import { LOCAL_MUTATION_TYPES, type LocalMutationPayload, type LocalMutationType } from '@/localdb/mutation-registry'
import { findLocal as findLocalRow } from '@/localdb/repository'
import { buildLocalDog } from '@/localdb/runtime/local-builders'
import { buildLocalAck, buildSyncMeta, getFamilyId, getNow } from '@/localdb/runtime/mutation-helpers'
import type { BusinessCollectionName, LocalRowOf, SyncMetadata } from '@/localdb/types'

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

export async function addBirthRecordLocally(ctx: RuntimeMutationContext, familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const cycleId = String(data.cycle_id || data.cycleId || '').trim()
    if (!cycleId) throw new Error('缺少周期 ID')
    if (!data.birth_date) throw new Error('请选择生产日期')
    if (!Array.isArray(data.puppies) || data.puppies.length === 0) throw new Error('请至少录入一只幼崽')

    const cycle = await findLocalRow<any>('breeding_cycles', cycleId)
    if (!cycle || cycle.family_id !== familyId) throw new Error('周期不存在')
    const damDog = cycle.dam_id ? await findLocalRow<any>('dogs', cycle.dam_id) : null
    const family = await findLocalRow<any>('families', familyId)
    const settings = family?.settings || {}
    const now = getNow()
    const birthDate = Number(data.birth_date)
    const breedingRecordId = createStableEntityId('breeding_record')
    const litterId = createStableEntityId('litter')
    const expenseId = data.cost && Number(data.cost) > 0 ? createStableEntityId('expense') : null
    const existingOlderLitters = await localDb.query<any>('litters', row =>
      row.family_id === familyId
      && row.dam_id === cycle.dam_id
      && Number(row.birth_date || row.created_at || 0) < birthDate,
    )
    const litterNumber = existingOlderLitters.length + 1
    const damDisplayName = cycle.dam_name || '母犬'

    const normalizedPuppies = data.puppies.map((puppy: Record<string, any>, index: number) => {
      const alive = puppy.alive !== false
      const resolvedName = String(puppy.name || '').trim() || `${damDisplayName}${litterNumber}窝-${index + 1}号`
      return {
        name: resolvedName,
        gender: puppy.gender || '母',
        weight: puppy.weight ? Number(puppy.weight) : null,
        alive,
      }
    })
    const alivePuppies = normalizedPuppies.filter(item => item.alive)
    const puppyIds = alivePuppies.map(() => createStableEntityId('dog'))
    const weightIds = alivePuppies.filter(item => item.weight).map(() => createStableEntityId('dog_weight'))
    const taskIds = [
      createStableEntityId('task'),
      ...(
        data.create_first_deworming_task === true
          ? alivePuppies.map(() => createStableEntityId('task'))
          : []
      ),
      ...(
        data.create_first_vaccination_task === true
          ? alivePuppies.map(() => createStableEntityId('task'))
          : []
      ),
    ]

    const breedingRecord = {
      _id: breedingRecordId,
      type: 'birth',
      cycle_id: cycleId,
      dog_id: cycle.dam_id,
      family_id: familyId,
      date: birthDate,
      cost: data.cost || null,
      notes: data.birth_notes || null,
      details: {
        birth_type: data.birth_type || '顺产',
        total_born: normalizedPuppies.length,
        born_alive: alivePuppies.length,
        born_dead: normalizedPuppies.length - alivePuppies.length,
      },
      created_by: '',
      deleted_at: null,
      version: 0,
      created_at: now,
      updated_at: now,
      _local_pending: true,
    }
    const litter = {
      _id: litterId,
      cycle_id: cycleId,
      dam_id: cycle.dam_id,
      dam_name: cycle.dam_name,
      sire_id: cycle.sire_id || null,
      sire_name: cycle.sire_name || null,
      family_id: familyId,
      birth_date: birthDate,
      birth_type: data.birth_type || '顺产',
      birth_notes: data.birth_notes || null,
      notes: null,
      total_born: normalizedPuppies.length,
      born_alive: alivePuppies.length,
      born_dead: normalizedPuppies.length - alivePuppies.length,
      weaned_at: null,
      deleted_at: null,
      version: 0,
      created_by: '',
      created_at: now,
      updated_at: now,
      _local_pending: true,
    }

    const puppies = alivePuppies.map((puppy, index) => buildLocalDog(familyId, {
      name: puppy.name,
      gender: puppy.gender,
      role: '幼崽',
      disposition: '在养',
      species: '犬',
      breed: damDog?.breed || '',
      birth_date: birthDate,
      latest_weight: puppy.weight || null,
      origin_litter_id: litterId,
    }, puppyIds[index], now))

    let weightCursor = 0
    const weightRows = alivePuppies
      .filter(item => item.weight)
      .map((puppy, index) => {
        const id = weightIds[weightCursor]
        weightCursor += 1
        return {
          _id: id,
          family_id: familyId,
          dog_id: puppyIds[alivePuppies.indexOf(puppy)],
          weight: Number(puppy.weight),
          date: birthDate,
          measured_at: birthDate,
          notes: null,
          deleted_at: null,
          version: 0,
          created_at: now,
          updated_at: now,
          _local_pending: true,
        }
      })

    const dueWeaningDays = Number(settings.default_weaning_days || 45)
    const dueDewormingDays = Number(settings.default_deworming_interval_puppy || 14)
    const dueVaccinationDays = Number(settings.default_vaccine_interval_puppy || 21)
    const createdTasks: any[] = []
    createdTasks.push({
      _id: taskIds[0],
      card_type: 'individual',
      dog_id: cycle.dam_id,
      dog_name: cycle.dam_name || '',
      cycle_id: cycleId,
      litter_id: litterId,
      type: 'breeding_milestone',
      title: `${cycle.dam_name || '母犬'}窝 · 确认断奶`,
      due_date: birthDate + dueWeaningDays * 86400000,
      status: 'pending',
      priority: 'upcoming',
      source_record_id: litterId,
      source_collection: 'litters',
      family_id: familyId,
      postpone_count: 0,
      details: {
        step_type: 'weaning_confirm',
        birth_date: birthDate,
      },
      version: 0,
      created_at: now,
      updated_at: now,
      _local_pending: true,
    })

    let taskCursor = 1
    if (data.create_first_deworming_task === true) {
      alivePuppies.forEach((puppy, index) => {
        createdTasks.push({
          _id: taskIds[taskCursor],
          card_type: 'individual',
          dog_id: puppyIds[index],
          dog_name: puppy.name,
          cycle_id: cycleId,
          litter_id: litterId,
          type: 'deworming',
          title: '首次驱虫',
          due_date: birthDate + dueDewormingDays * 86400000,
          status: 'pending',
          priority: 'upcoming',
          source_record_id: litterId,
          source_collection: 'litters',
          family_id: familyId,
          postpone_count: 0,
          details: {},
          version: 0,
          created_at: now,
          updated_at: now,
          _local_pending: true,
        })
        taskCursor += 1
      })
    }
    if (data.create_first_vaccination_task === true) {
      alivePuppies.forEach((puppy, index) => {
        createdTasks.push({
          _id: taskIds[taskCursor],
          card_type: 'individual',
          dog_id: puppyIds[index],
          dog_name: puppy.name,
          cycle_id: cycleId,
          litter_id: litterId,
          type: 'vaccination',
          title: '首次疫苗',
          due_date: birthDate + dueVaccinationDays * 86400000,
          status: 'pending',
          priority: 'upcoming',
          source_record_id: litterId,
          source_collection: 'litters',
          family_id: familyId,
          postpone_count: 0,
          details: {},
          version: 0,
          created_at: now,
          updated_at: now,
          _local_pending: true,
        })
        taskCursor += 1
      })
    }

    const expenseRow = expenseId
      ? {
          _id: expenseId,
          family_id: familyId,
          total_amount: Number(data.cost),
          category: '生产育幼',
          date: birthDate,
          linked_cycle_id: cycleId,
          linked_litter_id: litterId,
          linked_dog_ids: [cycle.dam_id],
          source_type: 'auto',
          source_record_id: litterId,
          images: [],
          dam_name: cycle.dam_name || null,
          dog_names: cycle.dam_name ? [cycle.dam_name] : [],
          litter_number: undefined,
          notes: data.birth_notes ? `生产 · ${String(data.birth_notes).trim()}` : '生产',
          deleted_at: null,
          version: 0,
          created_by: '',
          created_at: now,
          updated_at: now,
          _local_pending: true,
        }
      : null

    const pendingMilestones = await localDb.query<any>('tasks', row =>
      row.family_id === familyId
      && row.cycle_id === cycleId
      && row.type === 'breeding_milestone'
      && row.status === 'pending',
    )

    const baseVersions = {
      [cycleId]: Number(cycle.version || 0),
      ...pendingMilestones.reduce<Record<string, number>>((acc, row) => {
        acc[row._id] = Number(row.version || 0)
        return acc
      }, {}),
    }
    const syncMeta = buildSyncMeta(baseVersions, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.ADD_BIRTH_RECORD),
      clientEntityIds: {
        breeding_records: breedingRecordId,
        litters: litterId,
        dogs: puppyIds,
        dog_weights: weightRows.map(row => row._id),
        tasks: createdTasks.map(row => row._id),
        ...(expenseId ? { expenses: expenseId } : {}),
      },
    })

    await localDb.transactRows(['breeding_records', 'litters', 'dogs', 'dog_weights', 'tasks', 'expenses', 'breeding_cycles'] as const, async (rows) => {
      await rows.upsertRow('breeding_records', breedingRecord as LocalRowOf<'breeding_records'>)
      await rows.upsertRow('litters', litter as LocalRowOf<'litters'>)
      if (cycle.dam_id) {
        await rows.updateRow('dogs', cycle.dam_id, row => ({ ...row, updated_at: now }))
      }
      for (const puppy of puppies) {
        await rows.upsertRow('dogs', puppy as LocalRowOf<'dogs'>)
      }
      for (const weightRow of weightRows) {
        await rows.upsertRow('dog_weights', weightRow as LocalRowOf<'dog_weights'>)
      }
      for (const milestone of pendingMilestones) {
        await rows.updateRow('tasks', milestone._id, row => ({
          ...row,
          status: 'cancelled',
          updated_at: now,
          _local_pending: true,
        }))
      }
      for (const task of createdTasks) {
        await rows.upsertRow('tasks', task as LocalRowOf<'tasks'>)
      }
      if (expenseRow) {
        await rows.upsertRow('expenses', expenseRow as LocalRowOf<'expenses'>)
      }
      await rows.updateRow('breeding_cycles', cycleId, row => ({
        ...row,
        status: '已生产',
        updated_at: now,
        _local_pending: true,
      }))
    })

    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.ADD_BIRTH_RECORD,
      familyId,
      {
        cycle_id: cycleId,
        birth_date: birthDate,
        birth_type: data.birth_type || '顺产',
        birth_notes: data.birth_notes || null,
        create_first_deworming_task: data.create_first_deworming_task === true,
        create_first_vaccination_task: data.create_first_vaccination_task === true,
        cost: data.cost && Number(data.cost) > 0 ? Number(data.cost) : null,
        puppies: normalizedPuppies.map(puppy => ({
          name: puppy.name,
          gender: puppy.gender,
          weight: puppy.weight,
          alive: puppy.alive,
        })),
        _sync: syncMeta,
      },
      ['breeding_records', 'breeding_cycles', 'litters', 'dogs', 'dog_weights', 'tasks', 'expenses'],
      syncMeta,
      { dogName: cycle.dam_name || '' },
    )

    return {
      data: {
        litterId,
        puppyIds,
        taskCount: createdTasks.length,
      },
      ...buildLocalAck(syncMeta, [
        { collection: 'breeding_records', id: breedingRecordId, version: 0, updatedAt: now },
        { collection: 'litters', id: litterId, version: 0, updatedAt: now },
        { collection: 'breeding_cycles', id: cycleId, version: Number(cycle.version || 0), updatedAt: now },
        ...puppies.map(row => ({ collection: 'dogs' as BusinessCollectionName, id: row._id, version: 0, updatedAt: now })),
        ...weightRows.map(row => ({ collection: 'dog_weights' as BusinessCollectionName, id: row._id, version: 0, updatedAt: now })),
        ...pendingMilestones.map(row => ({ collection: 'tasks' as BusinessCollectionName, id: row._id, version: Number(row.version || 0), updatedAt: now })),
        ...createdTasks.map(row => ({ collection: 'tasks' as BusinessCollectionName, id: row._id, version: 0, updatedAt: now })),
        ...(expenseRow ? [{ collection: 'expenses' as BusinessCollectionName, id: expenseRow._id, version: 0, updatedAt: now }] : []),
      ]),
    }
  }

export async function addPuppyToLitterLocally(ctx: RuntimeMutationContext, familyIdInput: string, litterIdInput: string, puppyData: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const litterId = String(litterIdInput || '').trim()
    if (!litterId) throw new Error('缺少窝 ID')
    const litter = await findLocalRow<any>('litters', litterId)
    if (!litter || litter.family_id !== familyId) throw new Error('窝不存在')
    const existingPuppyCount = (await localDb.query<any>('dogs', row =>
      row.family_id === familyId
      && row.origin_litter_id === litterId
      && !row.deleted_at,
    )).length
    const now = getNow()
    const puppyId = createStableEntityId('dog')
    const puppy = buildLocalDog(familyId, {
      name: puppyData.name || '',
      gender: puppyData.gender || '母',
      role: '幼崽',
      disposition: '在养',
      birth_date: litter.birth_date,
      latest_weight: puppyData.weight || null,
      origin_litter_id: litterId,
    }, puppyId, now)
    const nextTotalBorn = Math.max(Number(litter.total_born || 0), existingPuppyCount) + 1
    const nextBornAlive = Math.max(Number(litter.born_alive || 0), existingPuppyCount) + 1
    const nextLitter = {
      ...litter,
      total_born: nextTotalBorn,
      born_alive: nextBornAlive,
      updated_at: now,
      _local_pending: true,
    }
    const syncMeta = buildSyncMeta({ [litterId]: Number(litter.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.ADD_PUPPY_TO_LITTER),
      clientEntityIds: { dogs: puppyId },
    })
    await localDb.transactRows(['dogs', 'litters'] as const, async (rows) => {
      await rows.upsertRow('dogs', puppy as unknown as LocalRowOf<'dogs'>)
      await rows.upsertRow('litters', nextLitter as unknown as LocalRowOf<'litters'>)
    })
    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.ADD_PUPPY_TO_LITTER,
      familyId,
      { litterId, puppyData, _sync: syncMeta },
      ['dogs', 'litters'],
      syncMeta,
    )
    return {
      data: { puppyId },
      ...buildLocalAck(syncMeta, [
        { collection: 'dogs', id: puppyId, version: 0, updatedAt: now },
        { collection: 'litters', id: litterId, version: Number(litter.version || 0), updatedAt: now },
      ]),
    }
  }

export async function updateLitterLocally(ctx: RuntimeMutationContext, familyIdInput: string, litterIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const litterId = String(litterIdInput || '').trim()
    if (!litterId) throw new Error('缺少窝 ID')
    const litter = await findLocalRow<any>('litters', litterId)
    if (!litter || litter.family_id !== familyId) throw new Error('窝不存在')
    const now = getNow()
    const nextLitter = {
      ...litter,
      ...(data.birth_notes !== undefined ? { birth_notes: data.birth_notes } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      updated_at: now,
      _local_pending: true,
    }
    const syncMeta = buildSyncMeta({ [litterId]: Number(litter.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_LITTER),
    })
    await localDb.transactRows('litters', async (rows) => {
      await rows.updateRow(litterId, nextLitter as unknown as LocalRowOf<'litters'>)
    })
    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.UPDATE_LITTER,
      familyId,
      { litterId, data, _sync: syncMeta },
      ['litters'],
      syncMeta,
    )
    return {
      message: '窝信息已更新',
      ...buildLocalAck(syncMeta, [{ collection: 'litters', id: litterId, version: Number(litter.version || 0), updatedAt: now }]),
    }
  }

export async function updateLitterBirthDateLocally(ctx: RuntimeMutationContext, familyIdInput: string, litterIdInput: string, birthDate: number) {
    const familyId = getFamilyId(familyIdInput)
    const litterId = String(litterIdInput || '').trim()
    if (!litterId) throw new Error('缺少窝 ID')
    const litter = await findLocalRow<any>('litters', litterId)
    if (!litter || litter.family_id !== familyId) throw new Error('窝不存在')
    if (!birthDate) throw new Error('请选择新日期')
    const diffDays = Math.abs(Number(birthDate) - Number(litter.birth_date || 0)) / 86400000
    if (diffDays > 3) throw new Error('生产日期只能调整 ±3 天，超出范围会影响窝号和关联费用')
    const now = getNow()
    const linkedExpenses = await localDb.query<any>('expenses', row =>
      row.family_id === familyId
      && !row.deleted_at
      && row.source_type === 'auto'
      && row.linked_litter_id === litterId
      && row.source_record_id === litterId,
    )
    const puppyRows = await localDb.query<LocalRowOf<'dogs'>>('dogs', row =>
      row.family_id === familyId
      && row.origin_litter_id === litterId
      && !row.deleted_at,
    )
    const syncMeta = buildSyncMeta({
      [litterId]: Number(litter.version || 0),
      ...puppyRows.reduce<Record<string, number>>((acc, row) => {
        acc[row._id] = Number(row.version || 0)
        return acc
      }, {}),
      ...linkedExpenses.reduce<Record<string, number>>((acc, row) => {
        acc[row._id] = Number(row.version || 0)
        return acc
      }, {}),
    }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_LITTER_BIRTH_DATE),
    })
    await localDb.transactRows(['litters', 'dogs', 'expenses'] as const, async (rows) => {
      await rows.updateRow('litters', litterId, row => ({
        ...row,
        birth_date: birthDate,
        updated_at: now,
        _local_pending: true,
      }))
      for (const puppy of puppyRows) {
        await rows.updateRow('dogs', puppy._id, row => ({
          ...row,
          birth_date: birthDate,
          updated_at: now,
          _local_pending: true,
        }))
      }
      for (const expense of linkedExpenses) {
        await rows.updateRow('expenses', expense._id, row => ({
          ...row,
          date: birthDate,
          updated_at: now,
          _local_pending: true,
        }))
      }
    })
    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.UPDATE_LITTER_BIRTH_DATE,
      familyId,
      { litterId, newBirthDate: birthDate, _sync: syncMeta },
      ['litters', 'dogs', 'expenses'],
      syncMeta,
    )
    return {
      message: '生产日期已更新',
      ...buildLocalAck(syncMeta, [
        { collection: 'litters', id: litterId, version: Number(litter.version || 0), updatedAt: now },
        ...puppyRows.map(row => ({
          collection: 'dogs' as BusinessCollectionName,
          id: row._id,
          version: Number(row.version || 0),
          updatedAt: now,
        })),
        ...linkedExpenses.map(row => ({
          collection: 'expenses' as BusinessCollectionName,
          id: row._id,
          version: Number(row.version || 0),
          updatedAt: now,
        })),
      ]),
    }
  }

export async function confirmWeaningLocally(ctx: RuntimeMutationContext, familyIdInput: string, litterIdInput: string) {
    const familyId = getFamilyId(familyIdInput)
    const litterId = String(litterIdInput || '').trim()
    if (!litterId) throw new Error('缺少窝 ID')
    const litter = await findLocalRow<any>('litters', litterId)
    if (!litter || litter.family_id !== familyId) throw new Error('窝不存在')
    const now = getNow()
    const pendingTasks = await localDb.query<any>('tasks', row =>
      row.family_id === familyId
      && row.litter_id === litterId
      && row.type === 'breeding_milestone'
      && row.status === 'pending',
    )
    const syncMeta = buildSyncMeta({
      [litterId]: Number(litter.version || 0),
      ...pendingTasks.reduce<Record<string, number>>((acc, row) => {
        acc[row._id] = Number(row.version || 0)
        return acc
      }, {}),
    }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.CONFIRM_WEANING),
    })
    const pendingTaskIds = new Set(pendingTasks.map(row => row._id))
    await localDb.transactRows(['litters', 'tasks'] as const, async (rows) => {
      await rows.updateRow('litters', litterId, row => ({
        ...row,
        weaned_at: now,
        updated_at: now,
        _local_pending: true,
      }))
      for (const taskId of pendingTaskIds) {
        await rows.updateRow('tasks', taskId, row => ({
          ...row,
          status: 'completed',
          completed_at: now,
          updated_at: now,
          _local_pending: true,
        }))
      }
    })
    await ctx.enqueueMutation(
      LOCAL_MUTATION_TYPES.CONFIRM_WEANING,
      familyId,
      { litterId, _sync: syncMeta },
      ['litters', 'tasks'],
      syncMeta,
    )
    return {
      message: '已确认断奶',
      ...buildLocalAck(syncMeta, [
        { collection: 'litters', id: litterId, version: Number(litter.version || 0), updatedAt: now },
        ...pendingTasks.map(row => ({ collection: 'tasks' as BusinessCollectionName, id: row._id, version: Number(row.version || 0), updatedAt: now })),
      ]),
    }
  }
