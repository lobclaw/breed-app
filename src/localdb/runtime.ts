import { localDb } from '@/localdb/db'
import { CORE_SYNC_COLLECTIONS, HOME_SYNC_COLLECTIONS } from '@/localdb/collections'
import {
  applyTouchedEntityVersions,
  buildLocalDateCounts,
  buildLocalHomeCards,
  buildLocalWeekCards,
  type HomeProjectionEntities,
} from '@/localdb/home-projection'
import { createClientMutationId, createStableEntityId, getOrCreateDeviceId } from '@/localdb/id'
import {
  dispatchRegisteredMutation,
  LOCAL_MUTATION_TYPES,
  type LocalMutationPayload,
  type LocalMutationType,
} from '@/localdb/mutation-registry'
import {
  findLocal as findLocalRow,
  mutateLocal as runLocalMutation,
  queryLocal as queryLocalRows,
  upsertLocalRows,
} from '@/localdb/repository'
import { getSyncStatus } from '@/localdb/sync-status'
import type {
  BusinessCollectionName,
  LocalCollectionName,
  MutationStatus,
  OutboxMutation,
  SyncAckPayload,
  SyncMetadata,
  SyncStateRow,
} from '@/localdb/types'

function startOfDay(ts: number) {
  const offsetMs = 8 * 60 * 60 * 1000
  const beijingNow = new Date(ts + offsetMs)
  return Date.UTC(
    beijingNow.getUTCFullYear(),
    beijingNow.getUTCMonth(),
    beijingNow.getUTCDate(),
    0,
    0,
    0,
    0,
  ) - offsetMs
}

const HOME_MUTATION_TYPES = LOCAL_MUTATION_TYPES
type HomeMutationType = LocalMutationType
type HomeMutationPayload = LocalMutationPayload

function isOnlineError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  return /network|timeout|offline|fail/i.test(message)
}

function getNow() {
  return Date.now()
}

function buildSyncMeta(baseVersions: Record<string, number> = {}, extras: Partial<SyncMetadata> = {}): SyncMetadata {
  return {
    clientMutationId: extras.clientMutationId || createClientMutationId('mutation'),
    deviceId: getOrCreateDeviceId(),
    baseVersions,
    clientTimestamp: getNow(),
    ...extras,
  }
}

function buildLocalAck(syncMeta: SyncMetadata, touchedEntities: SyncAckPayload['touchedEntities'] = []): SyncAckPayload {
  return {
    ack: 'accepted',
    clientMutationId: syncMeta.clientMutationId,
    touchedEntities,
    resyncScopes: touchedEntities?.map(entity => entity.collection) || [],
    conflict: null,
  }
}

function toSyncStateRow(collection: BusinessCollectionName, current?: Partial<SyncStateRow>): SyncStateRow {
  const now = getNow()
  return {
    _id: collection,
    collection,
    last_pulled_at: current?.last_pulled_at || 0,
    last_full_sync_at: current?.last_full_sync_at || 0,
    last_ack_at: current?.last_ack_at || 0,
    updated_at: now,
  }
}

async function getHomeEntities(): Promise<HomeProjectionEntities> {
  const [dogs, tasks, health_records, medication_tasks] = await Promise.all([
    localDb.getTable<any>('dogs'),
    localDb.getTable<any>('tasks'),
    localDb.getTable<any>('health_records'),
    localDb.getTable<any>('medication_tasks'),
  ])

  return { dogs, tasks, health_records, medication_tasks }
}

function normalizePulledRows<T extends Record<string, any>>(rows: T[]): Array<T & { _id: string; updated_at?: number; created_at?: number; version: number }> {
  return rows.map((row) => {
    const updatedAt = Number(row.updated_at || row.created_at || 0)
    return {
      ...row,
      _id: String(row._id || ''),
      version: Number(row.version || 0),
      updated_at: updatedAt || row.updated_at,
    }
  })
}

function getCollectionFamilyWhere(collection: BusinessCollectionName, familyId: string, lastPulledAt: number, dbCmd: any, forceFull = false) {
  if (collection === 'families') {
    return forceFull
      ? { _id: familyId }
      : { _id: familyId, updated_at: dbCmd.gte(lastPulledAt || 0) }
  }

  return forceFull
    ? { family_id: familyId }
    : {
        family_id: familyId,
        updated_at: dbCmd.gte(lastPulledAt || 0),
      }
}

const pullInFlight = new Map<string, Promise<Record<string, any>[]>>()

async function pullCollection(collection: BusinessCollectionName, familyId: string, forceFull = false) {
  const pullKey = `${collection}:${familyId}:${forceFull ? 'full' : 'delta'}`
  const runningPull = pullInFlight.get(pullKey)
  if (runningPull) return runningPull

  const run = (async () => {
    const currentState = await localDb.getSyncState(collection)
    const baseState = toSyncStateRow(collection, currentState || undefined)
    const lastPulledAt = forceFull ? 0 : baseState.last_pulled_at

    if (typeof uniCloud === 'undefined' || typeof uniCloud.database !== 'function') {
      return []
    }

    const db = uniCloud.database()
    const dbCmd = db.command
    const where = getCollectionFamilyWhere(collection, familyId, lastPulledAt ? lastPulledAt + 1 : 0, dbCmd, forceFull)
    const { data } = await db
      .collection(collection)
      .where(where)
      .orderBy('updated_at', 'asc')
      .limit(1000)
      .get()

    const rows = normalizePulledRows(Array.isArray(data) ? data : [])
    if (rows.length > 0) {
      await localDb.upsertRows(collection, rows)
    }

    const maxUpdatedAt = rows.reduce((max, row) => Math.max(max, Number(row.updated_at || row.created_at || 0)), lastPulledAt)
    await localDb.upsertSyncState({
      ...baseState,
      last_pulled_at: forceFull && maxUpdatedAt === 0 ? getNow() : maxUpdatedAt,
      last_full_sync_at: forceFull ? getNow() : baseState.last_full_sync_at,
      updated_at: getNow(),
    })

    return rows
  })()

  pullInFlight.set(pullKey, run)
  try {
    return await run
  } finally {
    pullInFlight.delete(pullKey)
  }
}

function buildOutboxMutation<T extends HomeMutationPayload>(
  type: HomeMutationType,
  familyId: string,
  payload: T,
  collectionScope: BusinessCollectionName[],
  clientMutationId: string,
) {
  const now = getNow()
  return {
    _id: `outbox_${clientMutationId}`,
    type,
    collection_scope: collectionScope,
    payload,
    family_id: familyId,
    status: 'pending' as MutationStatus,
    retry_count: 0,
    next_retry_at: now,
    last_error: null,
    client_mutation_id: clientMutationId,
    device_id: getOrCreateDeviceId(),
    created_at: now,
    updated_at: now,
  } satisfies OutboxMutation<T>
}

function getTaskBaseVersion(task: Record<string, any> | null) {
  if (!task?._id) return {}
  return { [task._id]: Number(task.version || 0) }
}

function getFamilyId(familyId: string) {
  if (!familyId) throw new Error('缺少家庭 ID，无法执行本地优先写入')
  return familyId
}

function normalizeDogName(dog: Record<string, any> | null | undefined) {
  return dog?.name || dog?.dog_name || '未命名'
}

async function getDogsByIds(dogIds: string[]) {
  const uniqueIds = [...new Set(dogIds.filter(Boolean))]
  if (!uniqueIds.length) return []
  const dogs = await localDb.query<any>('dogs', dog => uniqueIds.includes(dog._id))
  const dogMap = new Map(dogs.map(dog => [dog._id, dog]))
  return uniqueIds.map(id => dogMap.get(id)).filter(Boolean)
}

function buildLocalTaskFromManualPayload(familyId: string, dog: Record<string, any>, data: Record<string, any>, taskId: string, now: number) {
  const title = data.title
    || (data.type === 'vaccination' ? (data.details?.vaccine_type ? `疫苗 · ${data.details.vaccine_type}` : '疫苗') : '')
    || (data.type === 'deworming' ? (data.details?.drug_name ? `驱虫 · ${data.details.drug_name}` : '驱虫') : '')
    || data.type

  return {
    _id: taskId,
    card_type: data.card_type || 'individual',
    dog_id: dog.dog_id || dog._id,
    dog_name: dog.dog_name || dog.name || '',
    type: data.type,
    title,
    due_date: data.due_date,
    status: 'pending',
    priority: data.due_date <= now ? 'overdue' : 'upcoming',
    next_reminder_date: data.next_reminder_date || null,
    details: data.details || null,
    source_record_id: null,
    source_collection: null,
    family_id: familyId,
    postpone_count: 0,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
  }
}

function buildLocalHealthRecord(familyId: string, dog: Record<string, any>, data: Record<string, any>, recordId: string, now: number, cost: number | null = null) {
  return {
    _id: recordId,
    type: data.type,
    dog_id: dog._id || dog.dog_id,
    dog_name: normalizeDogName(dog),
    family_id: familyId,
    date: data.date,
    cost,
    notes: data.notes || null,
    details: data.details || {},
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
  }
}

function buildLocalBreedingRecord(familyId: string, dog: Record<string, any>, data: Record<string, any>, recordId: string, cycleId: string, now: number) {
  return {
    _id: recordId,
    type: data.type,
    cycle_id: cycleId,
    dog_id: dog._id || data.dog_id,
    dog_name: normalizeDogName(dog),
    family_id: familyId,
    date: data.date,
    cost: data.cost || null,
    notes: data.notes || null,
    details: data.details || {},
    extra_arrangement: data.extra_arrangement || null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
  }
}

function buildLocalDog(familyId: string, data: Record<string, any>, dogId: string, now: number) {
  return {
    _id: dogId,
    name: data.name || '',
    gender: data.gender,
    role: data.role,
    disposition: data.disposition || '在养',
    species: data.species || '犬',
    breed: data.breed || '',
    birth_date: data.birth_date || null,
    purchase_date: data.purchase_date || null,
    purchase_price: data.purchase_price || null,
    latest_weight: data.latest_weight || null,
    family_id: familyId,
    origin_litter_id: data.origin_litter_id || null,
    owner_info: data.owner_info || null,
    disposition_date: null,
    disposition_notes: null,
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
  }
}

async function upsertOutboxMutation(mutation: OutboxMutation) {
  await localDb.upsertRows('outbox_mutations', [mutation])
}

async function updateOutboxStatus(mutationId: string, status: MutationStatus, extra: Partial<OutboxMutation> = {}) {
  await localDb.transact(['outbox_mutations'], (tables) => {
    tables.outbox_mutations = (tables.outbox_mutations as OutboxMutation[]).map((mutation) => {
      if (mutation._id !== mutationId) return mutation
      return {
        ...mutation,
        status,
        updated_at: getNow(),
        ...extra,
      }
    })
  })
}

function applyAckToCollectionRows(rows: Record<string, any>[], touchedEntities: NonNullable<SyncAckPayload['touchedEntities']>, collection: BusinessCollectionName) {
  return applyTouchedEntityVersions(rows, touchedEntities, collection)
}

async function applySyncAck(ack: SyncAckPayload, fallbackCollections: BusinessCollectionName[], familyId: string) {
  const touchedEntities = ack.touchedEntities || []
  const touchedCollections = [...new Set(touchedEntities.map(item => item.collection))]

  if (touchedEntities.length > 0) {
    await localDb.transact(
      touchedCollections as LocalCollectionName[],
      (tables) => {
        for (const collection of touchedCollections) {
          tables[collection] = applyAckToCollectionRows(tables[collection] || [], touchedEntities, collection)
        }
      },
    )
  }

  const resyncCollections = [...new Set(
    (ack.resyncScopes || [])
      .map(scope => scope.split(':')[0])
      .filter((scope): scope is BusinessCollectionName => (HOME_SYNC_COLLECTIONS as readonly string[]).includes(scope)),
  )]

  const collectionsToPull = resyncCollections.length > 0 ? resyncCollections : [...new Set([...fallbackCollections, ...touchedCollections])]
  await Promise.all(collectionsToPull.map(collection => pullCollection(collection, familyId, false)))
}

class LocalSyncRuntime {
  private started = false
  private processing = false
  private online = true
  private currentFamilyId = ''
  private homeSyncPromise: Promise<void> | null = null
  private coreSyncPromise: Promise<void> | null = null
  private lastHomeSyncAt = 0
  private lastCoreSyncAt = 0

  async init() {
    if (this.started) return
    this.started = true

    try {
      const network = await new Promise<any>((resolve) => {
        uni.getNetworkType({
          success: resolve,
          fail: () => resolve({ networkType: 'unknown' }),
        })
      })
      this.online = network?.networkType !== 'none'
    } catch {
      this.online = true
    }

    try {
      uni.onNetworkStatusChange((result) => {
        this.online = !!result?.isConnected
        if (this.online && this.currentFamilyId) {
          void this.syncHome(this.currentFamilyId)
        }
      })
    } catch {
      // ignore
    }
  }

  async resume(familyId: string) {
    if (!familyId) return
    this.currentFamilyId = familyId
    await this.syncCore(familyId)
  }

  async syncHome(familyId: string, options: { force?: boolean; minIntervalMs?: number } = {}) {
    if (!familyId) return
    await this.init()
    this.currentFamilyId = familyId
    const minIntervalMs = options.minIntervalMs ?? 10000
    const now = getNow()
    if (!options.force && this.homeSyncPromise) return this.homeSyncPromise
    if (!options.force && now - this.lastHomeSyncAt < minIntervalMs) {
      await this.flushOutbox(familyId)
      return
    }

    this.homeSyncPromise = (async () => {
      const needsFullPull = options.force || !(await this.hasHomeData())
      await this.pullHomeCollections(familyId, needsFullPull)
      await this.flushOutbox(familyId)
      this.lastHomeSyncAt = getNow()
    })()

    try {
      await this.homeSyncPromise
    } finally {
      this.homeSyncPromise = null
    }
  }

  async syncCore(familyId: string, options: { force?: boolean; minIntervalMs?: number } = {}) {
    if (!familyId) return
    await this.init()
    this.currentFamilyId = familyId
    const minIntervalMs = options.minIntervalMs ?? 60000
    const now = getNow()
    if (!options.force && this.coreSyncPromise) return this.coreSyncPromise
    if (!options.force && now - this.lastCoreSyncAt < minIntervalMs) {
      await this.flushOutbox(familyId)
      return
    }

    this.coreSyncPromise = (async () => {
      await this.pullCoreCollections(familyId, Boolean(options.force))
      await this.flushOutbox(familyId)
      this.lastCoreSyncAt = getNow()
    })()

    try {
      await this.coreSyncPromise
    } finally {
      this.coreSyncPromise = null
    }
  }

  async pullHomeCollections(familyId: string, forceFull = false) {
    this.currentFamilyId = familyId
    await Promise.all(HOME_SYNC_COLLECTIONS.map(collection => pullCollection(collection, familyId, forceFull)))
  }

  async pullCoreCollections(familyId: string, forceFull = false) {
    this.currentFamilyId = familyId
    const results = await Promise.allSettled(CORE_SYNC_COLLECTIONS.map(collection => pullCollection(collection, familyId, forceFull)))
    return results.filter(result => result.status === 'fulfilled').length
  }

  async pullCollections(familyId: string, collections: BusinessCollectionName[], forceFull = false) {
    this.currentFamilyId = familyId
    const uniqueCollections = [...new Set(collections)]
    const results = await Promise.allSettled(uniqueCollections.map(collection => pullCollection(collection, familyId, forceFull)))
    return results.filter(result => result.status === 'fulfilled').length
  }

  async queryLocal<T>(collection: LocalCollectionName, predicate?: (row: T) => boolean) {
    return queryLocalRows<T>(collection, predicate)
  }

  async findLocal<T extends { _id: string }>(collection: LocalCollectionName, id: string) {
    return findLocalRow<T>(collection, id)
  }

  async mutateLocal<T>(collections: LocalCollectionName[], mutator: Parameters<typeof runLocalMutation<T>>[1]) {
    return runLocalMutation(collections, mutator)
  }

  async upsertLocalRows<T extends { _id: string; updated_at?: number; created_at?: number }>(collection: LocalCollectionName, rows: T[]) {
    return upsertLocalRows(collection, rows)
  }

  async getSyncStatus() {
    return getSyncStatus()
  }

  async createDogLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const now = getNow()
    const dogId = createStableEntityId('dog')
    const dog = buildLocalDog(familyId, data, dogId, now)
    const syncMeta = buildSyncMeta({}, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.CREATE_DOG),
      clientEntityIds: { dogs: dogId },
    })

    await upsertLocalRows('dogs', [dog])
    await this.enqueueMutation(HOME_MUTATION_TYPES.CREATE_DOG, familyId, { ...data, _sync: syncMeta }, ['dogs', 'expenses'], syncMeta)
    return {
      data: { _id: dogId },
      ...buildLocalAck(syncMeta, [{ collection: 'dogs', id: dogId, version: 0, updatedAt: now }]),
    }
  }

  async updateDogLocally(familyIdInput: string, dogId: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const dog = await findLocalRow<any>('dogs', dogId)
    if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')
    const now = getNow()
    const syncMeta = buildSyncMeta({ [dogId]: Number(dog.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.UPDATE_DOG),
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
    }

    await upsertLocalRows('dogs', [nextDog])
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.UPDATE_DOG,
      familyId,
      { id: dogId, patch: data, _sync: syncMeta },
      ['dogs'],
      syncMeta,
    )
    return {
      message: '已更新',
      ...buildLocalAck(syncMeta, [{ collection: 'dogs', id: dogId, version: Number(dog.version || 0), updatedAt: now }]),
    }
  }

  async updateDogNameLocally(familyIdInput: string, dogId: string, name: string) {
    const familyId = getFamilyId(familyIdInput)
    const dog = await findLocalRow<any>('dogs', dogId)
    if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')
    const trimmedName = String(name || '').trim()
    if (!trimmedName && dog.role !== '幼崽') throw new Error('请输入新名称')
    const now = getNow()
    const syncMeta = buildSyncMeta({ [dogId]: Number(dog.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.UPDATE_DOG_NAME),
    })
    await runLocalMutation(['dogs', 'tasks', 'breeding_cycles', 'litters'], (tables) => {
      tables.dogs = (tables.dogs as any[]).map(row => row._id === dogId ? { ...row, name: trimmedName, updated_at: now, _local_pending: true } : row)
      tables.tasks = (tables.tasks as any[]).map(row => row.dog_id === dogId ? { ...row, dog_name: trimmedName, updated_at: now } : row)
      tables.breeding_cycles = (tables.breeding_cycles as any[]).map(row => ({
        ...row,
        dam_name: row.dam_id === dogId ? trimmedName : row.dam_name,
        sire_name: row.sire_id === dogId ? trimmedName : row.sire_name,
        updated_at: row.dam_id === dogId || row.sire_id === dogId ? now : row.updated_at,
      }))
      tables.litters = (tables.litters as any[]).map(row => ({
        ...row,
        dam_name: row.dam_id === dogId ? trimmedName : row.dam_name,
        sire_name: row.sire_id === dogId ? trimmedName : row.sire_name,
        updated_at: row.dam_id === dogId || row.sire_id === dogId ? now : row.updated_at,
      }))
    })
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.UPDATE_DOG_NAME,
      familyId,
      { id: dogId, name: trimmedName, _sync: syncMeta },
      ['dogs', 'tasks', 'breeding_cycles', 'litters'],
      syncMeta,
    )
    return {
      message: '名称已更新',
      ...buildLocalAck(syncMeta, [{ collection: 'dogs', id: dogId, version: Number(dog.version || 0), updatedAt: now }]),
    }
  }

  async softDeleteDogLocally(familyIdInput: string, dogId: string) {
    const familyId = getFamilyId(familyIdInput)
    const dog = await findLocalRow<any>('dogs', dogId)
    if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')
    const now = getNow()
    const syncMeta = buildSyncMeta({ [dogId]: Number(dog.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.SOFT_DELETE_DOG),
    })
    await upsertLocalRows('dogs', [{ ...dog, deleted_at: now, updated_at: now, _local_pending: true }])
    await this.enqueueMutation(HOME_MUTATION_TYPES.SOFT_DELETE_DOG, familyId, { id: dogId, _sync: syncMeta }, ['dogs'], syncMeta)
    return {
      message: '已删除（可在回收站恢复）',
      ...buildLocalAck(syncMeta, [{ collection: 'dogs', id: dogId, version: Number(dog.version || 0), updatedAt: now, deletedAt: now }]),
    }
  }

  async restoreRecycleItemLocally(familyIdInput: string, type: string, id: string) {
    const familyId = getFamilyId(familyIdInput)
    const collectionMap: Record<string, BusinessCollectionName> = {
      dog: 'dogs',
      expense: 'expenses',
      income: 'incomes',
      agent: 'agents',
      medication_protocol: 'medication_protocols',
    }
    const collection = collectionMap[type]
    if (!collection) throw new Error('不支持的回收站类型')
    const item = await findLocalRow<any>(collection, id)
    if (!item) throw new Error('回收站项目未同步到本地，请联网刷新一次')
    const now = getNow()
    const syncMeta = buildSyncMeta({ [id]: Number(item.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.RECYCLE_RESTORE),
    })
    await upsertLocalRows(collection, [{ ...item, deleted_at: null, updated_at: now, _local_pending: true }])
    await this.enqueueMutation(HOME_MUTATION_TYPES.RECYCLE_RESTORE, familyId, { id, type, _sync: syncMeta }, [collection], syncMeta)
    return {
      message: '已恢复',
      ...buildLocalAck(syncMeta, [{ collection, id, version: Number(item.version || 0), updatedAt: now, deletedAt: null }]),
    }
  }

  async permanentDeleteRecycleItemLocally(familyIdInput: string, type: string, id: string) {
    const familyId = getFamilyId(familyIdInput)
    const collectionMap: Record<string, BusinessCollectionName> = {
      dog: 'dogs',
      expense: 'expenses',
      income: 'incomes',
      agent: 'agents',
      medication_protocol: 'medication_protocols',
    }
    const collection = collectionMap[type]
    if (!collection) throw new Error('不支持的回收站类型')
    const item = await findLocalRow<any>(collection, id)
    if (!item) throw new Error('回收站项目未同步到本地，请联网刷新一次')
    const now = getNow()
    const syncMeta = buildSyncMeta({ [id]: Number(item.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.RECYCLE_PERMANENT_DELETE),
    })
    await runLocalMutation([collection], (tables) => {
      tables[collection] = (tables[collection] as any[]).filter(row => row._id !== id)
    })
    await this.enqueueMutation(HOME_MUTATION_TYPES.RECYCLE_PERMANENT_DELETE, familyId, { id, type, _sync: syncMeta }, [collection], syncMeta)
    return {
      message: '已永久删除',
      ...buildLocalAck(syncMeta, [{ collection, id, version: Number(item.version || 0), updatedAt: now, deletedAt: now }]),
    }
  }

  async ensureHomeData(familyId: string) {
    await this.init()
    this.currentFamilyId = familyId

    if (await this.hasHomeData()) return
    await this.pullHomeCollections(familyId, true)
  }

  private async hasHomeData() {
    const entities = await getHomeEntities()
    const hasLocalData = entities.tasks.length > 0 || entities.medication_tasks.length > 0 || entities.health_records.length > 0 || entities.dogs.length > 0
    return hasLocalData
  }

  async getHomeCards() {
    return buildLocalHomeCards(await getHomeEntities())
  }

  async getDateCounts(startDate: number, endDate: number) {
    return buildLocalDateCounts(await getHomeEntities(), startDate, endDate)
  }

  async getWeekCards(startDate: number, endDate: number) {
    return buildLocalWeekCards(await getHomeEntities(), startDate, endDate)
  }

  async enqueueMutation(type: HomeMutationType, familyId: string, payload: HomeMutationPayload, collectionScope: BusinessCollectionName[], syncMeta: SyncMetadata) {
    const mutation = buildOutboxMutation(type, familyId, payload, collectionScope, syncMeta.clientMutationId)
    await upsertOutboxMutation(mutation)
    if (this.online) {
      void this.flushOutbox(familyId)
    }
  }

  private async dispatchMutation(mutation: OutboxMutation<HomeMutationPayload>) {
    return dispatchRegisteredMutation(mutation)
  }

  async flushOutbox(familyId: string) {
    if (!this.online || this.processing) return
    this.processing = true

    try {
      const outbox = await localDb.getOutbox()
      const now = getNow()
      const pendingMutations = outbox.filter(mutation =>
        (mutation.status === 'pending' || mutation.status === 'failed')
        && mutation.next_retry_at <= now,
      )

      for (const mutation of pendingMutations) {
        await updateOutboxStatus(mutation._id, 'processing')
        try {
          const result = await this.dispatchMutation(mutation)
          const ack = (result || {}) as SyncAckPayload

          if (ack.conflict) {
            await localDb.upsertConflict({
              _id: `conflict_${mutation.client_mutation_id}`,
              client_mutation_id: mutation.client_mutation_id,
              collection: ack.conflict.collection,
              entity_id: ack.conflict.entityId,
              base_version: ack.conflict.baseVersion,
              server_version: ack.conflict.serverVersion,
              status: 'open',
              detail: ack.conflict ? { ...ack.conflict } : null,
              created_at: now,
              updated_at: now,
            })
            await updateOutboxStatus(mutation._id, 'conflict')
            continue
          }

          await applySyncAck(ack, mutation.collection_scope, familyId)
          await updateOutboxStatus(mutation._id, 'synced')
        } catch (error) {
          const retryCount = mutation.retry_count + 1
          const retryAt = now + Math.min(60000, 1000 * (2 ** Math.min(retryCount, 6)))
          await updateOutboxStatus(
            mutation._id,
            isOnlineError(error) ? 'failed' : 'failed',
            {
              retry_count: retryCount,
              next_retry_at: retryAt,
              last_error: error instanceof Error ? error.message : String(error || '同步失败'),
            },
          )
          if (isOnlineError(error)) break
        }
      }
    } finally {
      this.processing = false
    }
  }

  async batchCreateManualTasksLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    if (!Array.isArray(data.dogs) || !data.dogs.length) throw new Error('请选择犬只')
    const now = getNow()
    const tasks = data.dogs.map((dog: any) => buildLocalTaskFromManualPayload(
      familyId,
      dog,
      data,
      createStableEntityId('task'),
      now,
    ))
    const syncMeta = buildSyncMeta({}, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.BATCH_CREATE_TASKS),
      clientEntityIds: { tasks: tasks.map(task => task._id) },
    })

    await localDb.upsertRows('tasks', tasks)
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.BATCH_CREATE_TASKS,
      familyId,
      { ...data, _sync: syncMeta },
      ['tasks'],
      syncMeta,
    )

    return {
      data: {
        created: tasks.length,
        skipped: 0,
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

  async batchAddHealthRecordsLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    if (!Array.isArray(data.dog_ids) || !data.dog_ids.length) throw new Error('请选择犬只')
    const dogs = await getDogsByIds(data.dog_ids)
    if (dogs.length !== [...new Set(data.dog_ids)].length) throw new Error('部分犬只未同步到本地，请联网刷新一次')

    const now = getNow()
    const totalCost = data.cost || null
    const perDogCost = totalCost && dogs.length > 1 ? Math.round(totalCost / dogs.length * 100) / 100 : totalCost
    const records = dogs.map(dog => buildLocalHealthRecord(
      familyId,
      dog,
      data,
      createStableEntityId('health_record'),
      now,
      perDogCost && perDogCost > 0 ? perDogCost : null,
    ))
    const pendingTasks = await localDb.query<any>('tasks', task =>
      task.family_id === familyId
      && task.status === 'pending'
      && task.type === data.type
      && data.dog_ids.includes(task.dog_id),
    )
    const completedTaskIds = pendingTasks.map(task => task._id)
    const syncMeta = buildSyncMeta(
      pendingTasks.reduce<Record<string, number>>((acc, task) => {
        acc[task._id] = Number(task.version || 0)
        return acc
      }, {}),
      {
        clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.CREATE_HEALTH_RECORDS),
        clientEntityIds: { health_records: records.map(record => record._id) },
      },
    )

    await localDb.transact(['health_records', 'tasks'], (tables) => {
      tables.health_records = [...(tables.health_records as any[]), ...records]
      if (completedTaskIds.length > 0) {
        const taskIdSet = new Set(completedTaskIds)
        tables.tasks = (tables.tasks as any[]).map(task => taskIdSet.has(task._id)
          ? { ...task, status: 'completed', completed_at: now, updated_at: now }
          : task)
      }
    })
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.CREATE_HEALTH_RECORDS,
      familyId,
      { ...data, _sync: syncMeta },
      ['health_records', 'tasks', 'expenses'],
      syncMeta,
    )

    return {
      data: {
        count: records.length,
        records: records.map(record => ({ recordId: record._id, dog_id: record.dog_id })),
        completedTasks: pendingTasks,
      },
      ...buildLocalAck(syncMeta, [
        ...records.map(record => ({ collection: 'health_records' as BusinessCollectionName, id: record._id, version: 0, updatedAt: record.updated_at })),
        ...pendingTasks.map(task => ({ collection: 'tasks' as BusinessCollectionName, id: task._id, version: Number(task.version || 0), updatedAt: now })),
      ]),
    }
  }

  async batchStartMedicationLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    if (!Array.isArray(data.dog_ids) || !data.dog_ids.length) throw new Error('请选择犬只')
    const dogs = await getDogsByIds(data.dog_ids)
    if (dogs.length !== [...new Set(data.dog_ids)].length) throw new Error('部分犬只未同步到本地，请联网刷新一次')

    const now = getNow()
    const durationDays = Number(data.duration_days || 1)
    const startDate = Number.isFinite(Number(data.actual_start_date)) ? Number(data.actual_start_date) : now
    const endDate = startDate + ((durationDays - 1) * 86400000)
    const illnessLinks = new Map((data.illness_links || data.illnessLinks || []).map((item: any) => [item.dog_id, item.illness_record_id]))
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
    const linkedIllnessIds = medicationTasks.map(task => task.source_record_id).filter(Boolean)
    const syncMeta = buildSyncMeta({}, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.CREATE_MEDICATION_TASKS),
      clientEntityIds: { medication_tasks: medicationTasks.map(task => task._id) },
    })

    await localDb.transact(['medication_tasks', 'health_records'], (tables) => {
      tables.medication_tasks = [...(tables.medication_tasks as any[]), ...medicationTasks]
      if (linkedIllnessIds.length > 0) {
        const illnessIdSet = new Set(linkedIllnessIds)
        tables.health_records = (tables.health_records as any[]).map(record => illnessIdSet.has(record._id)
          ? { ...record, details: { ...(record.details || {}), treatment_status: '治疗中' }, updated_at: now }
          : record)
      }
    })
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.CREATE_MEDICATION_TASKS,
      familyId,
      { ...data, _sync: syncMeta },
      ['medication_tasks', 'health_records', 'expenses'],
      syncMeta,
    )

    return {
      data: {
        count: medicationTasks.length,
        medications: medicationTasks.map(task => ({ medicationId: task._id, dog_id: task.dog_id })),
      },
      ...buildLocalAck(syncMeta, medicationTasks.map(task => ({
        collection: 'medication_tasks' as BusinessCollectionName,
        id: task._id,
        version: 0,
        updatedAt: task.updated_at,
      }))),
    }
  }

  async addBreedingRecordLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const [dog] = await getDogsByIds([data.dog_id])
    if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')

    const now = getNow()
    const currentCycles = await localDb.query<any>('breeding_cycles', cycle =>
      cycle.family_id === familyId
      && cycle.dam_id === data.dog_id
      && ['发情中', '怀孕中'].includes(cycle.status),
    )
    const existingCycle = data.cycle_id
      ? await localDb.findById<any>('breeding_cycles', data.cycle_id)
      : currentCycles[0]
    const cycleId = existingCycle?._id || createStableEntityId('breeding_cycle')
    const recordId = createStableEntityId('breeding_record')
    const nextStatus = data.type === 'heat'
      ? '发情中'
      : data.type === 'mating'
        ? '怀孕中'
        : data.type === 'abnormal_termination'
          ? '失败'
          : existingCycle?.status || '发情中'
    const record = buildLocalBreedingRecord(familyId, dog, data, recordId, cycleId, now)
    const cycle = existingCycle
      ? { ...existingCycle, status: nextStatus, updated_at: now }
      : {
          _id: cycleId,
          dam_id: dog._id,
          dam_name: normalizeDogName(dog),
          sire_id: data.details?.sire_id || null,
          sire_name: data.details?.sire_name || null,
          family_id: familyId,
          status: nextStatus,
          version: 0,
          created_at: now,
          updated_at: now,
          _local_pending: true,
        }
    const syncMeta = buildSyncMeta(
      existingCycle ? { [cycleId]: Number(existingCycle.version || 0) } : {},
      {
        clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.CREATE_BREEDING_RECORD),
        clientEntityIds: { breeding_records: recordId, breeding_cycles: cycleId },
      },
    )

    await localDb.transact(['breeding_records', 'breeding_cycles'], (tables) => {
      tables.breeding_records = [...(tables.breeding_records as any[]), record]
      const cycleMap = new Map((tables.breeding_cycles as any[]).map(row => [row._id, row]))
      cycleMap.set(cycleId, { ...(cycleMap.get(cycleId) || {}), ...cycle })
      tables.breeding_cycles = Array.from(cycleMap.values())
    })
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.CREATE_BREEDING_RECORD,
      familyId,
      { ...data, _sync: syncMeta },
      ['breeding_records', 'breeding_cycles', 'tasks', 'expenses', 'litters'],
      syncMeta,
    )

    return {
      data: { recordId, cycleId },
      ...buildLocalAck(syncMeta, [
        { collection: 'breeding_records' as BusinessCollectionName, id: recordId, version: 0, updatedAt: now },
        { collection: 'breeding_cycles' as BusinessCollectionName, id: cycleId, version: Number(cycle.version || 0), updatedAt: now },
      ]),
    }
  }

  async batchAddBreedingRecordsLocally(familyId: string, data: Record<string, any>) {
    if (data.type !== 'heat') throw new Error('当前仅支持批量录入发情记录')
    const records = []
    const failed = []
    for (const dogId of [...new Set(data.dog_ids || [])]) {
      try {
        const result = await this.addBreedingRecordLocally(familyId, { ...data, dog_id: dogId, type: 'heat' })
        records.push({ dog_id: dogId, recordId: result.data.recordId, cycleId: result.data.cycleId })
      } catch (error) {
        failed.push({ dog_id: dogId, reason: error instanceof Error ? error.message : '保存失败' })
      }
    }
    return { data: { count: records.length, records, failed } }
  }

  async addExpenseLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const now = getNow()
    const expense = {
      _id: createStableEntityId('expense'),
      family_id: familyId,
      total_amount: data.total_amount,
      category: data.category,
      date: data.date || now,
      linked_cycle_id: data.linked_cycle_id || null,
      linked_litter_id: data.linked_litter_id || null,
      linked_dog_ids: data.linked_dog_ids || [],
      source_type: data.source_type || 'manual',
      source_record_id: null,
      images: data.images || [],
      dam_name: data.dam_name || null,
      dog_names: data.dog_names || [],
      litter_number: data.litter_number || null,
      notes: data.notes || null,
      deleted_at: null,
      version: 0,
      created_at: now,
      updated_at: now,
      _local_pending: true,
    }
    const syncMeta = buildSyncMeta({}, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.CREATE_EXPENSE),
      clientEntityIds: { expenses: expense._id },
    })
    await localDb.upsertRows('expenses', [expense])
    await this.enqueueMutation(HOME_MUTATION_TYPES.CREATE_EXPENSE, familyId, { ...data, _sync: syncMeta }, ['expenses'], syncMeta)
    return { data: { expenseId: expense._id }, ...buildLocalAck(syncMeta, [{ collection: 'expenses', id: expense._id, version: 0, updatedAt: now }]) }
  }

  async addIncomeLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const now = getNow()
    const income = {
      _id: createStableEntityId('income'),
      family_id: familyId,
      dog_id: data.dog_id || null,
      dog_name: data.dog_name || null,
      type: data.type,
      amount: data.amount,
      date: data.date || now,
      source_sale_id: data.source_sale_id || null,
      notes: data.notes || null,
      deleted_at: null,
      version: 0,
      created_at: now,
      updated_at: now,
      _local_pending: true,
    }
    const syncMeta = buildSyncMeta({}, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.CREATE_INCOME),
      clientEntityIds: { incomes: income._id },
    })
    await localDb.upsertRows('incomes', [income])
    await this.enqueueMutation(HOME_MUTATION_TYPES.CREATE_INCOME, familyId, { ...data, _sync: syncMeta }, ['incomes'], syncMeta)
    return { data: { incomeId: income._id }, ...buildLocalAck(syncMeta, [{ collection: 'incomes', id: income._id, version: 0, updatedAt: now }]) }
  }

  async completeTaskLocally(familyId: string, taskId: string, autoRecord = false) {
    const task = await localDb.findById<any>('tasks', taskId)
    if (!task || task.status !== 'pending') return null

    const now = getNow()
    const autoHealthRecords = autoRecord && ['vaccination', 'deworming'].includes(task.type)
      ? [{
          taskId,
          recordId: createStableEntityId('health_record'),
          dogId: task.dog_id,
          dogName: task.dog_name,
          type: task.type,
          date: now,
          details: task.details || {},
        }]
      : []
    const syncMeta = buildSyncMeta(
      getTaskBaseVersion(task),
      {
        clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.COMPLETE_TASK),
        autoHealthRecords,
      },
    )

    await localDb.transact(['tasks', 'health_records'], (tables) => {
      tables.tasks = (tables.tasks as any[]).map((currentTask) => currentTask._id === taskId
        ? {
            ...currentTask,
            status: 'completed',
            completed_at: now,
            updated_at: now,
          }
        : currentTask)

      if (autoHealthRecords.length > 0) {
        const nextRecords = [...(tables.health_records as any[])]
        autoHealthRecords.forEach((record) => {
          nextRecords.push({
            _id: record.recordId,
            type: record.type,
            dog_id: record.dogId,
            dog_name: record.dogName || '',
            family_id: familyId,
            date: record.date,
            details: record.details || {},
            version: 0,
            created_at: now,
            updated_at: now,
            _local_pending: true,
          })
        })
        tables.health_records = nextRecords
      }
    })

    const payload = {
      taskId,
      autoRecord,
      _sync: syncMeta,
    }
    await this.enqueueMutation(HOME_MUTATION_TYPES.COMPLETE_TASK, familyId, payload, ['tasks', 'health_records'], syncMeta)
    return {
      message: '已完成',
      data: {
        completedTaskIds: [taskId],
        autoRecordedHealthRecordIds: autoHealthRecords.map(record => record.recordId),
      },
      syncMeta,
    }
  }

  async batchCompleteTasksLocally(familyId: string, taskIds: string[], autoRecord = false) {
    const rows = await localDb.query<any>('tasks', task => taskIds.includes(task._id))
    const pendingTasks = rows.filter(task => task.status === 'pending')
    if (!pendingTasks.length) return null

    const now = getNow()
    const autoHealthRecords = autoRecord
      ? pendingTasks
        .filter(task => ['vaccination', 'deworming'].includes(task.type))
        .map(task => ({
          taskId: task._id,
          recordId: createStableEntityId('health_record'),
          dogId: task.dog_id,
          dogName: task.dog_name,
          type: task.type,
          date: now,
          details: task.details || {},
        }))
      : []

    const baseVersions = pendingTasks.reduce<Record<string, number>>((acc, task) => {
      acc[task._id] = Number(task.version || 0)
      return acc
    }, {})
    const syncMeta = buildSyncMeta(baseVersions, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.BATCH_COMPLETE_TASK),
      autoHealthRecords,
    })

    await localDb.transact(['tasks', 'health_records'], (tables) => {
      const targetIds = new Set(pendingTasks.map(task => task._id))
      tables.tasks = (tables.tasks as any[]).map((task) => targetIds.has(task._id)
        ? {
            ...task,
            status: 'completed',
            completed_at: now,
            updated_at: now,
          }
        : task)

      if (autoHealthRecords.length > 0) {
        tables.health_records = [
          ...(tables.health_records as any[]),
          ...autoHealthRecords.map(record => ({
            _id: record.recordId,
            type: record.type,
            dog_id: record.dogId,
            dog_name: record.dogName || '',
            family_id: familyId,
            date: record.date,
            details: record.details || {},
            version: 0,
            created_at: now,
            updated_at: now,
            _local_pending: true,
          })),
        ]
      }
    })

    const payload = {
      taskIds: pendingTasks.map(task => task._id),
      autoRecord,
      _sync: syncMeta,
    }
    await this.enqueueMutation(HOME_MUTATION_TYPES.BATCH_COMPLETE_TASK, familyId, payload, ['tasks', 'health_records'], syncMeta)
    return {
      data: {
        completedTaskIds: pendingTasks.map(task => task._id),
        autoRecordedHealthRecordIds: autoHealthRecords.map(record => record.recordId),
      },
      syncMeta,
    }
  }

  async postponeTasksLocally(familyId: string, taskIds: string[], newDate: number) {
    const rows = await localDb.query<any>('tasks', task => taskIds.includes(task._id))
    const pendingTasks = rows.filter(task => task.status === 'pending')
    if (!pendingTasks.length) return null

    const now = getNow()
    const baseVersions = pendingTasks.reduce<Record<string, number>>((acc, task) => {
      acc[task._id] = Number(task.version || 0)
      return acc
    }, {})
    const isBatch = pendingTasks.length > 1
    const syncMeta = buildSyncMeta(baseVersions, {
      clientMutationId: createClientMutationId(isBatch ? HOME_MUTATION_TYPES.BATCH_POSTPONE_TASK : HOME_MUTATION_TYPES.POSTPONE_TASK),
    })

    await localDb.transact(['tasks'], (tables) => {
      const targetIds = new Set(pendingTasks.map(task => task._id))
      tables.tasks = (tables.tasks as any[]).map((task) => targetIds.has(task._id)
        ? {
            ...task,
            due_date: newDate,
            updated_at: now,
            postpone_count: Number(task.postpone_count || 0) + 1,
          }
        : task)
    })

    const payload = isBatch
      ? { taskIds: pendingTasks.map(task => task._id), newDate, _sync: syncMeta }
      : { taskId: pendingTasks[0]._id, newDate, _sync: syncMeta }

    await this.enqueueMutation(
      isBatch ? HOME_MUTATION_TYPES.BATCH_POSTPONE_TASK : HOME_MUTATION_TYPES.POSTPONE_TASK,
      familyId,
      payload,
      ['tasks'],
      syncMeta,
    )
    return {
      message: '已推迟',
      data: {
        postponedTaskIds: pendingTasks.map(task => task._id),
      },
      syncMeta,
    }
  }

  async recordMedicationDoseLocally(familyId: string, medicationTaskId: string) {
    const task = await localDb.findById<any>('medication_tasks', medicationTaskId)
    if (!task || task.status !== '进行中') return null

    const now = getNow()
    const today = startOfDay(now)
    const startDate = startOfDay(task.actual_start_date || task.start_date || task.created_at || now)
    const currentDay = Math.floor((today - startDate) / 86400000) + 1
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
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.RECORD_MEDICATION_DOSE),
    })

    await localDb.transact(['medication_tasks'], (tables) => {
      tables.medication_tasks = (tables.medication_tasks as any[]).map((row) => row._id === medicationTaskId
        ? {
            ...row,
            daily_doses: nextDailyDoses,
            status: allComplete ? '已完成' : row.status,
            updated_at: now,
          }
        : row)
    })

    await this.enqueueMutation(
      HOME_MUTATION_TYPES.RECORD_MEDICATION_DOSE,
      familyId,
      { medicationTaskId, _sync: syncMeta },
      ['medication_tasks'],
      syncMeta,
    )
    return { data: { completed: todayComplete, allComplete }, syncMeta }
  }

  async batchCompleteMedicationDayLocally(familyId: string, medicationTaskIds: string[]) {
    const rows = await localDb.query<any>('medication_tasks', task => medicationTaskIds.includes(task._id))
    const activeRows = rows.filter(task => task.status === '进行中')
    if (!activeRows.length) return null

    const now = getNow()
    const baseVersions = activeRows.reduce<Record<string, number>>((acc, task) => {
      acc[task._id] = Number(task.version || 0)
      return acc
    }, {})
    const syncMeta = buildSyncMeta(baseVersions, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.BATCH_COMPLETE_MEDICATION_DAY),
    })

    await localDb.transact(['medication_tasks'], (tables) => {
      const byId = new Map(activeRows.map(row => [row._id, row]))
      tables.medication_tasks = (tables.medication_tasks as any[]).map((row) => {
        const target = byId.get(row._id)
        if (!target) return row

        const today = startOfDay(now)
        const startDate = startOfDay(target.actual_start_date || target.start_date || target.created_at || now)
        const currentDay = Math.floor((today - startDate) / 86400000) + 1
        if (currentDay < 1 || currentDay > Number(target.duration_days || 1)) return row

        const frequency = Number(target.frequency || 1)
        const nextDailyDoses = {
          ...(target.daily_doses || {}),
          [String(currentDay)]: frequency,
        }
        let allComplete = true
        for (let day = 1; day <= Number(target.duration_days || 1); day += 1) {
          if (Number(nextDailyDoses[String(day)] || 0) < frequency) {
            allComplete = false
            break
          }
        }

        return {
          ...row,
          daily_doses: nextDailyDoses,
          status: allComplete ? '已完成' : row.status,
          updated_at: now,
        }
      })
    })

    await this.enqueueMutation(
      HOME_MUTATION_TYPES.BATCH_COMPLETE_MEDICATION_DAY,
      familyId,
      { medicationTaskIds: activeRows.map(task => task._id), _sync: syncMeta },
      ['medication_tasks'],
      syncMeta,
    )
    return {
      data: {
        completedMedicationTaskIds: activeRows.map(task => task._id),
        fullyCompletedMedicationTaskIds: [],
      },
      syncMeta,
    }
  }

  async updateIllnessStatusLocally(familyId: string, illnessIds: string[], status: string) {
    const rows = await localDb.query<any>('health_records', row => illnessIds.includes(row._id))
    if (!rows.length) return null

    const now = getNow()
    const targetIds = new Set(rows.map(row => row._id))
    const baseVersions = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = Number(row.version || 0)
      return acc
    }, {})
    const syncMeta = buildSyncMeta(baseVersions, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.UPDATE_ILLNESS_STATUS),
    })

    await localDb.transact(['health_records'], (tables) => {
      tables.health_records = (tables.health_records as any[]).map((row) => targetIds.has(row._id)
        ? {
            ...row,
            details: { ...(row.details || {}), treatment_status: status },
            updated_at: now,
          }
        : row)
    })

    await this.enqueueMutation(
      HOME_MUTATION_TYPES.UPDATE_ILLNESS_STATUS,
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

  async recoverIllnessesLocally(familyId: string, illnessIds: string[], medicationTaskIds: string[] = []) {
    const illnessRows = await localDb.query<any>('health_records', row => illnessIds.includes(row._id))
    if (!illnessRows.length) return null
    const linkedMedicationRows = await localDb.query<any>('medication_tasks', row =>
      medicationTaskIds.includes(row._id)
      || illnessIds.includes(row.source_record_id),
    )

    const now = getNow()
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
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.RECOVER_ILLNESSES),
    })

    await localDb.transact(['health_records', 'medication_tasks'], (tables) => {
      const illnessIdSet = new Set(illnessRows.map(row => row._id))
      const medicationIdSet = new Set(linkedMedicationRows.map(row => row._id))
      tables.health_records = (tables.health_records as any[]).map((row) => illnessIdSet.has(row._id)
        ? {
            ...row,
            details: { ...(row.details || {}), treatment_status: '已康复' },
            updated_at: now,
          }
        : row)
      tables.medication_tasks = (tables.medication_tasks as any[]).map((row) => medicationIdSet.has(row._id)
        ? {
            ...row,
            status: '已取消',
            updated_at: now,
          }
        : row)
    })

    await this.enqueueMutation(
      HOME_MUTATION_TYPES.RECOVER_ILLNESSES,
      familyId,
      {
        illnessIds: illnessRows.map(row => row._id),
        medicationTaskIds: linkedMedicationRows.map(row => row._id),
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

  async endMedicationByDogLocally(familyId: string, dogId: string) {
    const rows = await localDb.query<any>('medication_tasks', row => row.dog_id === dogId && row.status === '进行中')
    if (!rows.length) return null

    const now = getNow()
    const baseVersions = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = Number(row.version || 0)
      return acc
    }, {})
    const syncMeta = buildSyncMeta(baseVersions, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.END_MEDICATION_BY_DOG),
    })

    await localDb.transact(['medication_tasks'], (tables) => {
      const targetIds = new Set(rows.map(row => row._id))
      tables.medication_tasks = (tables.medication_tasks as any[]).map((row) => targetIds.has(row._id)
        ? {
            ...row,
            status: '已取消',
            updated_at: now,
          }
        : row)
    })

    await this.enqueueMutation(
      HOME_MUTATION_TYPES.END_MEDICATION_BY_DOG,
      familyId,
      { dogId, _sync: syncMeta },
      ['medication_tasks'],
      syncMeta,
    )
    return {
      data: {
        cancelledMedicationTaskIds: rows.map(row => row._id),
      },
      syncMeta,
    }
  }
}

export const localSyncRuntime = new LocalSyncRuntime()
