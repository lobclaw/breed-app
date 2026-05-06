import { localDb } from '@/localdb/db'
import { CORE_SYNC_COLLECTIONS, HOME_SYNC_COLLECTIONS } from '@/localdb/collections'
import { createPendingLocalOperationLog } from '@/localdb/local-operation-log'
import {
  applyTouchedEntityVersions,
  buildLocalDateCounts,
  buildLocalHomeCards,
  buildLocalWeekCards,
  type HomeProjectionEntities,
} from '@/localdb/home-projection'
import { createClientMutationId, createStableEntityId, getOrCreateDeviceId } from '@/localdb/id'
import {
  buildExpenseCategoryGroups,
  normalizeExpenseCategories,
  DEFAULT_EXPENSE_CATEGORIES,
  PRESET_EXPENSE_CATEGORY_GROUPS,
  normalizeExpenseCategoryName,
} from '@/constants/financeCategories'
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
import {
  getSyncScopeDefinition,
  resolveSyncScopeForRoute,
  type ResolvedSyncScope,
  type SyncScopeMode,
} from '@/localdb/scope-registry'
import { getSyncStatus } from '@/localdb/sync-status'
import type {
  BusinessCollectionName,
  LocalCollectionName,
  MutationStatus,
  LocalOperationLogRow,
  OutboxMutation,
  SyncAckPayload,
  SyncMetadata,
  SyncStateRow,
} from '@/localdb/types'

interface StoredScopeFreshness {
  scopeKey: string
  routeKey: string
  routePath: string
  last_synced_at: number
  last_full_sync_at: number
  last_error: string | null
  last_skip_reason: string | null
  ttl_ms: number
  mode: SyncScopeMode
}

interface SyncScopeResult {
  scopeKey: string
  routeKey: string
  pulledCollections: BusinessCollectionName[]
  skipped: boolean
  skipReason: string | null
  lastSyncedAt: number
  force: boolean
}

const ACTIVE_SCOPE_META_KEY = 'sync:active-scope'
const CORE_SYNC_META_KEY = 'sync:core'
const CORE_SYNC_INTERVAL_MS = 10 * 60 * 1000
const CORE_SYNC_BATCH_SIZE = 4
const EXTRA_ARRANGEMENT_TITLE_MAP: Record<string, string> = {
  contact_doctor: '联系医生',
  recheck_observe: '复测观察',
  preparation: '准备事项',
  other: '其他安排',
}

function buildScopeMetaKey(scopeKey: string) {
  return `sync:scope:${scopeKey}`
}

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

function createLocalExpenseCategoryGroupKey() {
  return `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

const HOME_MUTATION_TYPES = LOCAL_MUTATION_TYPES
type HomeMutationType = LocalMutationType
type HomeMutationPayload = LocalMutationPayload
const MAX_CONFLICT_REBASE_ATTEMPTS = 3

function isOnlineError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  return /network|timeout|offline|fail/i.test(message)
}

async function detectOnline() {
  try {
    const network = await new Promise<any>((resolve) => {
      uni.getNetworkType({
        success: resolve,
        fail: () => resolve({ networkType: 'unknown' }),
      })
    })
    return network?.networkType !== 'none'
  } catch {
    return true
  }
}

function getNow() {
  return Date.now()
}

function getScopeRouteKey(scopeKey: string) {
  return scopeKey.split(':')[0] || scopeKey
}

function createResolvedScope(scopeKey: string): ResolvedSyncScope {
  const routeKey = getScopeRouteKey(scopeKey)
  const definition = getSyncScopeDefinition(routeKey)
  if (!definition) {
    throw new Error(`未知 sync scope: ${scopeKey}`)
  }

  return {
    key: scopeKey,
    routeKey,
    routePath: '',
    mode: definition.mode,
    ttlMs: definition.ttlMs,
    collections: [...definition.collections],
  }
}

function toScopeFreshness(scope: ResolvedSyncScope, current?: Partial<StoredScopeFreshness> | null): StoredScopeFreshness {
  return {
    scopeKey: scope.key,
    routeKey: scope.routeKey,
    routePath: scope.routePath,
    last_synced_at: Number(current?.last_synced_at || 0),
    last_full_sync_at: Number(current?.last_full_sync_at || 0),
    last_error: current?.last_error || null,
    last_skip_reason: current?.last_skip_reason || null,
    ttl_ms: scope.ttlMs,
    mode: scope.mode,
  }
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
  const [dogs, tasks, health_records, medication_tasks, breeding_cycles, breeding_records] = await Promise.all([
    localDb.getTable<any>('dogs'),
    localDb.getTable<any>('tasks'),
    localDb.getTable<any>('health_records'),
    localDb.getTable<any>('medication_tasks'),
    localDb.getTable<any>('breeding_cycles'),
    localDb.getTable<any>('breeding_records'),
  ])

  return { dogs, tasks, health_records, medication_tasks, breeding_cycles, breeding_records }
}

function normalizePulledRows<T extends Record<string, any>>(rows: T[]): Array<T & { _id: string; updated_at?: number; created_at?: number; version: number }> {
  return rows.map((row) => {
    const updatedAt = Number(row.updated_at || row.created_at || 0)
    return {
      ...row,
      _id: String(row._id || ''),
      version: Number(row.version || 0),
      updated_at: updatedAt || row.updated_at,
      _local_pending: false,
    }
  })
}

function isUploadedImageRef(value: string) {
  const text = String(value || '').trim()
  return /^https?:\/\//.test(text)
    || /^cloud:\/\//.test(text)
    || /^unicloud:\/\//i.test(text)
}

function hasPendingUploadImages(images: any) {
  return Array.isArray(images)
    && images.some(item => typeof item === 'string' && item.trim() && !isUploadedImageRef(item))
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

function getHealthVariantKey(type: string, details: Record<string, any> = {}) {
  if (type === 'vaccination') {
    return `vaccination:${details.vaccine_type || ''}`
  }
  if (type === 'deworming') {
    return `deworming:${details.deworming_type || ''}:${details.drug_name || ''}`
  }
  if (type === 'illness') {
    return `illness:${details.primary_condition || details.condition || ''}`
  }
  return type || ''
}

function shouldSkipDuplicateHealthRecord(type: string) {
  return type === 'vaccination' || type === 'deworming'
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
  const pendingUpload = hasPendingUploadImages(data.details?.images || data.images)
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
    _pending_upload: pendingUpload,
    pending_upload: pendingUpload,
  }
}

function buildLocalBreedingRecord(familyId: string, dog: Record<string, any>, data: Record<string, any>, recordId: string, cycleId: string, now: number) {
  const pendingUpload = hasPendingUploadImages(data.details?.images || data.images)
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
    _pending_upload: pendingUpload,
    pending_upload: pendingUpload,
  }
}

function isLocalPregnancyConfirmed(details: Record<string, any> = {}) {
  return details.confirmed === '是' || details.confirmed === true
}

function isLocalPregnancyRejected(details: Record<string, any> = {}) {
  return details.confirmed === '否' || details.confirmed === false
}

function shouldClearLocalBreedingMilestones(data: Record<string, any>) {
  if (['heat', 'follicle_check', 'mating', 'abnormal_termination'].includes(data.type)) return true
  if (data.type === 'pregnancy_check') {
    return isLocalPregnancyConfirmed(data.details || {}) || isLocalPregnancyRejected(data.details || {})
  }
  return false
}

function getLatestLocalBreedingRecord(records: Record<string, any>[], type: string) {
  return records
    .filter(record => !record.deleted_at && record.type === type)
    .slice()
    .sort((left, right) => {
      const dateDiff = Number(right.date || 0) - Number(left.date || 0)
      if (dateDiff !== 0) return dateDiff
      const updatedDiff = Number(right.updated_at || right.created_at || 0) - Number(left.updated_at || left.created_at || 0)
      if (updatedDiff !== 0) return updatedDiff
      return `${right._id || ''}`.localeCompare(`${left._id || ''}`)
    })[0] || null
}

function buildLocalBreedingExtraTask(
  familyId: string,
  dog: Record<string, any>,
  cycleId: string,
  recordId: string,
  extraArrangement: Record<string, any>,
  taskId: string,
  now: number,
) {
  const title = EXTRA_ARRANGEMENT_TITLE_MAP[extraArrangement.kind] || EXTRA_ARRANGEMENT_TITLE_MAP.other
  const dueDate = Number(extraArrangement.due_date || 0)
  return {
    _id: taskId,
    card_type: 'individual',
    dog_id: dog._id,
    dog_name: normalizeDogName(dog),
    cycle_id: cycleId,
    type: 'breeding_extra_arrangement',
    title,
    due_date: dueDate,
    status: 'pending',
    priority: dueDate <= now ? 'overdue' : 'upcoming',
    source_record_id: recordId,
    source_collection: 'breeding_records',
    family_id: familyId,
    postpone_count: 0,
    details: {
      kind: extraArrangement.kind,
      notes: extraArrangement.notes || null,
      anchor_type: extraArrangement.anchor_type || 'cycle',
      anchor_id: cycleId,
      dog_id: dog._id,
      source_record_id: recordId,
      manual: true,
    },
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
  }
}

function buildLocalBreedingExpense(
  familyId: string,
  dog: Record<string, any>,
  data: Record<string, any>,
  cycleId: string,
  recordId: string,
  expenseId: string,
  now: number,
) {
  const sourceLabels: Record<string, string> = {
    heat: '发情',
    heat_observation: '发情观察',
    follicle_check: '卵泡检查',
    mating: '配种',
    pregnancy_check: '孕检',
    prenatal_check: '产检',
    pre_labor: '临产监测',
    birth: '生产',
    abnormal_termination: '异常终止',
  }
  const categoryMap: Record<string, string> = {
    follicle_check: '检查化验',
    mating: '配种费',
    pregnancy_check: '孕检产检',
    prenatal_check: '孕检产检',
    pre_labor: '孕检产检',
    birth: '生产育幼',
    abnormal_termination: '生产育幼',
  }
  const sourceLabel = sourceLabels[data.type] || '繁育'
  const category = categoryMap[data.type] || '其他'
  const noteText = typeof data.notes === 'string' ? data.notes.trim() : ''

  return {
    _id: expenseId,
    family_id: familyId,
    total_amount: Number(data.cost),
    category,
    date: Number(data.date || now),
    linked_cycle_id: cycleId,
    linked_litter_id: null,
    linked_dog_ids: [dog._id],
    source_type: 'auto',
    source_record_id: recordId,
    images: [],
    dam_name: normalizeDogName(dog),
    dog_names: [normalizeDogName(dog)],
    litter_number: null,
    notes: noteText
      ? (sourceLabel !== category ? `${sourceLabel} · ${noteText}` : noteText)
      : (sourceLabel !== category ? sourceLabel : null),
    created_by: null,
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
    _pending_upload: false,
    pending_upload: false,
  }
}

function buildLocalDogPurchaseExpense(
  familyId: string,
  data: Record<string, any>,
  dogId: string,
  expenseId: string,
  now: number,
) {
  const dogName = String(data.name || '').trim()
  return {
    _id: expenseId,
    family_id: familyId,
    total_amount: Number(data.purchase_price),
    category: '购入',
    date: Number(data.purchase_date || now),
    linked_cycle_id: null,
    linked_litter_id: null,
    linked_dog_ids: [dogId],
    source_type: 'auto',
    source_record_id: dogId,
    images: [],
    dam_name: dogName || null,
    dog_names: [dogName],
    litter_number: null,
    notes: `购入${data.role === '外部种公' ? '外部种公' : '种犬'}：${dogName}`,
    created_by: null,
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
    _pending_upload: false,
    pending_upload: false,
  }
}

function buildLocalDogPurchaseExpenseSnapshot(
  familyId: string,
  dog: Record<string, any>,
  amount: number,
  purchaseDate: number | null,
  expenseId: string,
  now: number,
  options: {
    version?: number
    createdAt?: number
  } = {},
) {
  const dogName = normalizeDogName(dog)
  return {
    _id: expenseId,
    family_id: familyId,
    total_amount: amount,
    category: '购入',
    date: Number(purchaseDate || now),
    linked_cycle_id: null,
    linked_litter_id: null,
    linked_dog_ids: [dog._id],
    source_type: 'auto',
    source_record_id: dog._id,
    images: [],
    dam_name: dogName || null,
    dog_names: [dogName],
    litter_number: null,
    notes: `购入${dog.role === '外部种公' ? '外部种公' : '种犬'}：${dogName}`,
    created_by: null,
    deleted_at: null,
    version: Number(options.version || 0),
    created_at: Number(options.createdAt || now),
    updated_at: now,
    _local_pending: true,
    _pending_upload: false,
    pending_upload: false,
  }
}

function buildLocalHealthExpense(
  familyId: string,
  dog: Record<string, any>,
  data: Record<string, any>,
  recordId: string,
  amount: number,
  expenseId: string,
  now: number,
) {
  const sourceLabels: Record<string, string> = {
    vaccination: '疫苗',
    deworming: '驱虫',
    illness: '治疗',
  }
  const categoryMap: Record<string, string> = {
    vaccination: '疫苗驱虫',
    deworming: '疫苗驱虫',
    illness: '医疗',
  }
  const sourceLabel = sourceLabels[data.type] || '健康'
  const category = categoryMap[data.type] || '其他'
  const noteText = typeof data.notes === 'string' ? data.notes.trim() : ''

  return {
    _id: expenseId,
    family_id: familyId,
    total_amount: amount,
    category,
    date: Number(data.date || now),
    linked_cycle_id: null,
    linked_litter_id: null,
    linked_dog_ids: [dog._id],
    source_type: 'auto',
    source_record_id: recordId,
    images: [],
    dam_name: normalizeDogName(dog),
    dog_names: [normalizeDogName(dog)],
    litter_number: null,
    notes: noteText
      ? (sourceLabel !== category ? `${sourceLabel} · ${noteText}` : noteText)
      : (sourceLabel !== category ? sourceLabel : null),
    created_by: null,
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
    _pending_upload: false,
    pending_upload: false,
  }
}

function buildLocalMedicationExpense(
  familyId: string,
  dog: Record<string, any>,
  data: Record<string, any>,
  medicationTaskId: string,
  amount: number,
  durationDays: number,
  startDate: number,
  expenseId: string,
  now: number,
) {
  return {
    _id: expenseId,
    family_id: familyId,
    total_amount: amount,
    category: '医疗',
    date: startDate,
    linked_cycle_id: null,
    linked_litter_id: null,
    linked_dog_ids: [dog._id],
    source_type: 'auto',
    source_record_id: medicationTaskId,
    images: [],
    dam_name: normalizeDogName(dog),
    dog_names: [normalizeDogName(dog)],
    litter_number: null,
    notes: `${data.drug_name} ${durationDays}天`,
    created_by: null,
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
    _pending_upload: false,
    pending_upload: false,
  }
}

function parseAdoptionFeeAmount(data: Record<string, any>) {
  const directAmount = Number(data.adoption_fee ?? data.adoptionFee)
  if (Number.isFinite(directAmount) && directAmount > 0) return directAmount

  const notesText = String(data.disposition_notes || '').trim()
  const matchedAmount = notesText.match(/领养费用：¥\s*([0-9]+(?:\.[0-9]+)?)/)
  if (!matchedAmount?.[1]) return 0

  const parsedAmount = Number(matchedAmount[1])
  return Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0
}

function buildLocalAdoptionIncome(
  familyId: string,
  dog: Record<string, any>,
  amount: number,
  date: number,
  notes: string | null,
  incomeId: string,
  now: number,
) {
  return {
    _id: incomeId,
    family_id: familyId,
    dog_id: dog._id,
    dog_name: normalizeDogName(dog),
    type: '领养',
    amount,
    date,
    source_sale_id: null,
    source_type: 'auto',
    source_record_id: dog._id,
    notes: notes || null,
    images: [],
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
    _pending_upload: false,
    pending_upload: false,
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
  await localDb.transact(['outbox_mutations', 'local_operation_logs', 'sync_conflicts'], (tables) => {
    let clientMutationId = mutationId.replace(/^outbox_/, '')
    tables.outbox_mutations = (tables.outbox_mutations as OutboxMutation[]).map((mutation) => {
      if (mutation._id !== mutationId) return mutation
      clientMutationId = mutation.client_mutation_id || clientMutationId
      const nextLastError = extra.last_error ?? (status === 'failed' ? mutation.last_error ?? null : null)
      return {
        ...mutation,
        status,
        updated_at: getNow(),
        last_error: nextLastError,
        ...extra,
      }
    })
    const logId = `local_operation_${clientMutationId}`
    if (status === 'synced') {
      tables.local_operation_logs = (tables.local_operation_logs as LocalOperationLogRow[]).filter(log => log._id !== logId)
      tables.sync_conflicts = (tables.sync_conflicts as any[]).map((conflict) => {
        if (String(conflict.client_mutation_id || '') !== clientMutationId || conflict.status === 'resolved') return conflict
        return {
          ...conflict,
          status: 'resolved',
          updated_at: getNow(),
        }
      })
      return
    }
    tables.local_operation_logs = (tables.local_operation_logs as LocalOperationLogRow[]).map((log) => {
      if (log._id !== logId) return log
      return {
        ...log,
        status,
        last_error: extra.last_error ?? (status === 'failed' ? log.last_error ?? null : null),
        updated_at: getNow(),
      }
    })
  })
}

function rebaseMutationForConflict(
  mutation: OutboxMutation<HomeMutationPayload>,
  conflict: NonNullable<SyncAckPayload['conflict']>,
) {
  if (!conflict.entityId || conflict.serverVersion === undefined || conflict.serverVersion === null) return null
  const currentSyncMeta = (mutation.payload?._sync && typeof mutation.payload._sync === 'object'
    ? mutation.payload._sync
    : {}) as SyncMetadata

  return {
    ...mutation,
    payload: {
      ...mutation.payload,
      _sync: {
        ...currentSyncMeta,
        baseVersions: {
          ...(currentSyncMeta.baseVersions || {}),
          [conflict.entityId]: Number(conflict.serverVersion || 0),
        },
      },
    },
    retry_count: mutation.retry_count + 1,
    next_retry_at: 0,
    last_error: null,
    updated_at: getNow(),
  } satisfies OutboxMutation<HomeMutationPayload>
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
      .filter((scope): scope is BusinessCollectionName => (
        !scope.includes(':')
        && !scope.includes('/')
        && (CORE_SYNC_COLLECTIONS as readonly string[]).includes(scope)
      )),
  )]

  const collectionsToPull = resyncCollections.length > 0 ? resyncCollections : [...new Set([...fallbackCollections, ...touchedCollections])]
  await Promise.all(collectionsToPull.map(collection => pullCollection(collection, familyId, false)))
}

class LocalSyncRuntime {
  private started = false
  private processing = false
  private online = true
  private currentFamilyId = ''
  private activeScopeKey = ''
  private scopeSyncPromises = new Map<string, Promise<SyncScopeResult>>()
  private coreSyncPromise: Promise<void> | null = null

  async init() {
    if (this.started) return
    this.started = true

    this.online = await detectOnline()

    try {
      uni.onNetworkStatusChange((result) => {
        this.online = !!result?.isConnected
        if (this.online && this.currentFamilyId) {
          void this.flushOutbox(this.currentFamilyId).then(() => this.syncActiveScope())
        }
      })
    } catch {
      // ignore
    }

    const persistedActiveScope = await localDb.getLocalMeta<string>(ACTIVE_SCOPE_META_KEY)
    if (persistedActiveScope) {
      this.activeScopeKey = persistedActiveScope
    }
  }

  async resume(familyId: string) {
    if (!familyId) return
    this.currentFamilyId = familyId
    await this.flushOutbox(familyId)
    await this.syncActiveScope()
  }

  private logScope(scope: string, payload: Record<string, any>) {
    const devFlag = typeof globalThis !== 'undefined' ? (globalThis as any).__DEV__ : undefined
    if (devFlag !== true) return
    console.info('[local-sync]', scope, payload)
  }

  private async getStoredScopeFreshness(scopeKey: string, fallbackScope?: ResolvedSyncScope) {
    const scope = fallbackScope || createResolvedScope(scopeKey)
    const value = await localDb.getLocalMeta<StoredScopeFreshness>(buildScopeMetaKey(scopeKey))
    return toScopeFreshness(scope, value)
  }

  private async setStoredScopeFreshness(scope: ResolvedSyncScope, patch: Partial<StoredScopeFreshness>) {
    const current = await this.getStoredScopeFreshness(scope.key, scope)
    await localDb.upsertLocalMeta(buildScopeMetaKey(scope.key), {
      ...current,
      ...patch,
      scopeKey: scope.key,
      routeKey: scope.routeKey,
      routePath: scope.routePath,
      ttl_ms: scope.ttlMs,
      mode: scope.mode,
    } satisfies StoredScopeFreshness)
  }

  private async hasCollectionsData(collections: BusinessCollectionName[]) {
    const uniqueCollections = [...new Set(collections)]
    const rows = await Promise.all(uniqueCollections.map(collection => localDb.getTable<any>(collection)))
    return rows.some((items) => items.length > 0)
  }

  async setActiveScope(scopeKey: string) {
    if (!scopeKey) return
    this.activeScopeKey = scopeKey
    await localDb.upsertLocalMeta(ACTIVE_SCOPE_META_KEY, scopeKey)
  }

  setCurrentFamilyId(familyId: string) {
    this.currentFamilyId = familyId || ''
  }

  async setActiveScopeFromRoute(routePath: string, query: Record<string, any> = {}) {
    const resolved = resolveSyncScopeForRoute(routePath, query)
    if (!resolved) return null
    await this.setActiveScope(resolved.key)
    return resolved
  }

  async getActiveScope() {
    if (this.activeScopeKey) return this.activeScopeKey
    const persisted = await localDb.getLocalMeta<string>(ACTIVE_SCOPE_META_KEY)
    this.activeScopeKey = persisted || ''
    return this.activeScopeKey
  }

  async getScopeStatus(scopeKey: string) {
    const scope = createResolvedScope(scopeKey)
    const freshness = await this.getStoredScopeFreshness(scopeKey, scope)
    return {
      scopeKey,
      routeKey: scope.routeKey,
      mode: scope.mode,
      ttlMs: scope.ttlMs,
      collections: scope.collections,
      inFlight: this.scopeSyncPromises.has(scopeKey),
      lastSyncedAt: freshness.last_synced_at,
      lastFullSyncAt: freshness.last_full_sync_at,
      lastError: freshness.last_error,
      lastSkipReason: freshness.last_skip_reason,
    }
  }

  async syncScope(scopeKey: string, options: { force?: boolean; forceFull?: boolean; skipTtl?: boolean; reason?: string } = {}) {
    const familyId = this.currentFamilyId
    if (!familyId) return null
    await this.init()
    const scope = createResolvedScope(scopeKey)
    await this.setActiveScope(scope.key)

    if (scope.mode === 'static' || scope.mode === 'redirect-deprecated') {
      const skipReason = scope.mode === 'redirect-deprecated' ? 'redirect-deprecated' : 'static-scope'
      await this.setStoredScopeFreshness(scope, {
        last_skip_reason: skipReason,
        last_error: null,
      })
      return {
        scopeKey: scope.key,
        routeKey: scope.routeKey,
        pulledCollections: [],
        skipped: true,
        skipReason,
        lastSyncedAt: 0,
        force: Boolean(options.force),
      } satisfies SyncScopeResult
    }

    if (this.scopeSyncPromises.has(scope.key)) {
      this.logScope(scope.key, { skip: 'in-flight-dedupe' })
      return this.scopeSyncPromises.get(scope.key) || null
    }

    const freshness = await this.getStoredScopeFreshness(scope.key, scope)
    const now = getNow()
    if (!options.force && !options.skipTtl && scope.ttlMs > 0 && freshness.last_synced_at > 0 && now - freshness.last_synced_at < scope.ttlMs) {
      const skipReason = options.reason || `ttl:${scope.ttlMs}`
      await this.setStoredScopeFreshness(scope, {
        last_skip_reason: skipReason,
        last_error: null,
      })
      this.logScope(scope.key, { skip: skipReason, collections: scope.collections })
      await this.flushOutbox(familyId)
      return {
        scopeKey: scope.key,
        routeKey: scope.routeKey,
        pulledCollections: [],
        skipped: true,
        skipReason,
        lastSyncedAt: freshness.last_synced_at,
        force: false,
      } satisfies SyncScopeResult
    }

    const runningSync = (async () => {
      const needsFullPull = Boolean(options.forceFull) || !(await this.hasCollectionsData(scope.collections))
      await this.flushOutbox(familyId)
      const results = await Promise.allSettled(scope.collections.map(collection => pullCollection(collection, familyId, needsFullPull)))
      const pulledCollections = scope.collections.filter((_, index) => results[index]?.status === 'fulfilled')
      const syncedAt = getNow()
      await this.setStoredScopeFreshness(scope, {
        last_synced_at: syncedAt,
        last_full_sync_at: needsFullPull ? syncedAt : freshness.last_full_sync_at,
        last_error: null,
        last_skip_reason: null,
      })
      this.logScope(scope.key, {
        collections: scope.collections,
        pulledCollections,
        force: Boolean(options.force),
        full: needsFullPull,
      })
      if (scope.routeKey === 'home') {
        this.scheduleCoreSync(familyId)
      }
      return {
        scopeKey: scope.key,
        routeKey: scope.routeKey,
        pulledCollections,
        skipped: false,
        skipReason: null,
        lastSyncedAt: syncedAt,
        force: Boolean(options.force),
      } satisfies SyncScopeResult
    })().catch(async (error) => {
      await this.setStoredScopeFreshness(scope, {
        last_error: error instanceof Error ? error.message : String(error || '同步失败'),
        last_skip_reason: null,
      })
      throw error
    })

    this.scopeSyncPromises.set(scope.key, runningSync)

    try {
      return await runningSync
    } finally {
      this.scopeSyncPromises.delete(scope.key)
    }
  }

  async forceSyncScope(scopeKey: string) {
    return this.syncScope(scopeKey, { force: true, skipTtl: true })
  }

  async syncScopeFromRoute(routePath: string, query: Record<string, any> = {}, options: { force?: boolean } = {}) {
    const resolved = resolveSyncScopeForRoute(routePath, query)
    if (!resolved) return null
    await this.setActiveScope(resolved.key)
    if (resolved.mode === 'local-first') {
      return this.syncScope(resolved.key, { force: options.force })
    }
    return {
      scopeKey: resolved.key,
      routeKey: resolved.routeKey,
      pulledCollections: [],
      skipped: true,
      skipReason: resolved.mode,
      lastSyncedAt: 0,
      force: Boolean(options.force),
    } satisfies SyncScopeResult
  }

  async syncActiveScope(options: { force?: boolean } = {}) {
    const scopeKey = await this.getActiveScope()
    if (!scopeKey) return null
    return this.syncScope(scopeKey, { force: options.force })
  }

  private scheduleCoreSync(familyId: string) {
    if (!familyId) return
    setTimeout(() => {
      void this.syncCore(familyId)
    }, 400)
  }

  async syncHome(familyId: string, options: { force?: boolean } = {}) {
    if (!familyId) return null
    this.currentFamilyId = familyId
    return this.syncScope('home', { force: options.force })
  }

  async syncCore(familyId: string, options: { force?: boolean; minIntervalMs?: number } = {}) {
    if (!familyId) return
    await this.init()
    this.currentFamilyId = familyId
    const minIntervalMs = options.minIntervalMs ?? CORE_SYNC_INTERVAL_MS
    if (!options.force && this.coreSyncPromise) return this.coreSyncPromise

    const meta = await localDb.getLocalMeta<{ last_synced_at?: number }>(CORE_SYNC_META_KEY)
    const lastSyncedAt = Number(meta?.last_synced_at || 0)
    if (!options.force && lastSyncedAt > 0 && getNow() - lastSyncedAt < minIntervalMs) {
      return
    }

    this.coreSyncPromise = (async () => {
      for (let index = 0; index < CORE_SYNC_COLLECTIONS.length; index += CORE_SYNC_BATCH_SIZE) {
        const batch = CORE_SYNC_COLLECTIONS.slice(index, index + CORE_SYNC_BATCH_SIZE)
        await this.pullCollections(familyId, batch, Boolean(options.force))
      }
      await localDb.upsertLocalMeta(CORE_SYNC_META_KEY, {
        last_synced_at: getNow(),
      })
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

  async getSyncStatus(options: { familyId?: string } = {}) {
    return getSyncStatus({ familyId: options.familyId || this.currentFamilyId })
  }

  async getOutboxIssues(options: { limit?: number; familyId?: string } = {}) {
    const limit = options.limit ?? 5
    const familyId = options.familyId || this.currentFamilyId
    const [outbox, conflicts] = await Promise.all([
      localDb.getOutbox(),
      localDb.getTable<any>('sync_conflicts'),
    ])
    const conflictMap = new Map(
      conflicts
        .filter(conflict => conflict.status === 'open')
        .map(conflict => [String(conflict.client_mutation_id || ''), conflict]),
    )
    return outbox
      .filter(mutation => !familyId || mutation.family_id === familyId)
      .filter(mutation => mutation.status === 'failed' || mutation.status === 'conflict')
      .sort((left, right) => Number(right.updated_at || 0) - Number(left.updated_at || 0))
      .slice(0, limit)
      .map((mutation) => {
        const conflict = conflictMap.get(mutation.client_mutation_id)
        const conflictMessage = conflict
          ? `版本冲突：${conflict.collection}/${conflict.entity_id} 本地 ${conflict.base_version}，云端 ${conflict.server_version}`
          : ''
        return {
          _id: mutation._id,
          type: mutation.type,
          status: mutation.status,
          retryCount: mutation.retry_count,
          nextRetryAt: mutation.next_retry_at,
          lastError: mutation.status === 'conflict' ? conflictMessage : mutation.last_error || '',
          createdAt: mutation.created_at,
          updatedAt: mutation.updated_at,
        }
      })
  }

  async retryFailedOutboxNow(familyIdInput: string) {
    const familyId = getFamilyId(familyIdInput || this.currentFamilyId)
    await this.init()
    this.currentFamilyId = familyId
    this.online = await detectOnline()
    if (!this.online) throw new Error('当前网络不可用')

    const now = getNow()
    await localDb.transact(['outbox_mutations', 'local_operation_logs', 'sync_conflicts'], (tables) => {
      const conflictMap = new Map(
        (tables.sync_conflicts as any[])
          .filter(conflict => conflict.status === 'open')
          .map(conflict => [String(conflict.client_mutation_id || ''), conflict]),
      )
      const retryingIds = new Set(
        (tables.outbox_mutations as OutboxMutation[])
          .filter(mutation => mutation.family_id === familyId && (mutation.status === 'failed' || mutation.status === 'conflict'))
          .map(mutation => mutation.client_mutation_id),
      )

      tables.outbox_mutations = (tables.outbox_mutations as OutboxMutation[]).map((mutation) => {
        if (mutation.family_id !== familyId || (mutation.status !== 'failed' && mutation.status !== 'conflict')) return mutation
        const conflict = conflictMap.get(mutation.client_mutation_id)
        const currentSyncMeta = (mutation.payload?._sync && typeof mutation.payload._sync === 'object'
          ? mutation.payload._sync
          : {}) as SyncMetadata
        const payload = conflict?.entity_id && conflict?.server_version !== undefined
          ? {
              ...mutation.payload,
              _sync: {
                ...currentSyncMeta,
                baseVersions: {
                  ...(currentSyncMeta.baseVersions || {}),
                  [conflict.entity_id]: Number(conflict.server_version || 0),
                },
              },
            }
          : mutation.payload
        return {
          ...mutation,
          payload,
          status: 'pending',
          next_retry_at: 0,
          last_error: null,
          updated_at: now,
        }
      })

      tables.sync_conflicts = (tables.sync_conflicts as any[]).map((conflict) => {
        if (!retryingIds.has(String(conflict.client_mutation_id || ''))) return conflict
        return {
          ...conflict,
          status: 'retrying',
          updated_at: now,
        }
      })

      tables.local_operation_logs = (tables.local_operation_logs as LocalOperationLogRow[]).map((log) => {
        if (!retryingIds.has(log.client_mutation_id)) return log
        return {
          ...log,
          status: 'pending',
          last_error: null,
          updated_at: now,
        }
      })
    })

    await this.flushOutbox(familyId)
    await this.syncActiveScope({ force: true })
    return this.getSyncStatus()
  }

  async createDogLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const now = getNow()
    const dogId = createStableEntityId('dog')
    const dog = buildLocalDog(familyId, data, dogId, now)
    const expenseId = Number(data.purchase_price || 0) > 0 ? createStableEntityId('expense') : ''
    const expenseRow = expenseId ? buildLocalDogPurchaseExpense(familyId, data, dogId, expenseId, now) : null
    const syncMeta = buildSyncMeta({}, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.CREATE_DOG),
      clientEntityIds: {
        dogs: dogId,
        ...(expenseId ? { expenses: expenseId } : {}),
      },
    })

    await localDb.transact(['dogs', 'expenses'], (tables) => {
      tables.dogs = [...(tables.dogs as any[]), dog]
      if (expenseRow) {
        tables.expenses = [...(tables.expenses as any[]), expenseRow]
      }
    })
    await this.enqueueMutation(HOME_MUTATION_TYPES.CREATE_DOG, familyId, { ...data, _sync: syncMeta }, ['dogs', 'expenses'], syncMeta)
    return {
      data: { _id: dogId },
      ...buildLocalAck(syncMeta, [
        { collection: 'dogs', id: dogId, version: 0, updatedAt: now },
        ...(expenseRow ? [{ collection: 'expenses' as BusinessCollectionName, id: expenseRow._id, version: 0, updatedAt: now }] : []),
      ]),
    }
  }

  async updateDogLocally(familyIdInput: string, dogId: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const dog = await findLocalRow<any>('dogs', dogId)
    if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')
    const linkedPurchaseExpenses = await localDb.query<any>('expenses', row =>
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
      ? data.purchase_date
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
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.UPDATE_DOG),
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
    }
    const nextExpenseRows = nextPurchasePrice > 0
      ? (linkedPurchaseExpenses.length > 0
          ? linkedPurchaseExpenses.map(row => buildLocalDogPurchaseExpenseSnapshot(
              familyId,
              nextDog,
              nextPurchasePrice,
              nextPurchaseDate,
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
              nextPurchaseDate,
              createdExpenseId,
              now,
            )])
      : []

    await localDb.transact(['dogs', 'expenses'], (tables) => {
      tables.dogs = (tables.dogs as any[]).map(row => row._id === dogId ? nextDog : row)
      if (linkedPurchaseExpenses.length === 0 && nextExpenseRows.length === 0) return
      const linkedExpenseIds = new Set(linkedPurchaseExpenses.map(row => row._id))
      tables.expenses = (tables.expenses as any[])
        .filter(row => !linkedExpenseIds.has(row._id))
      if (nextExpenseRows.length > 0) {
        tables.expenses = [...(tables.expenses as any[]), ...nextExpenseRows]
      }
    })
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.UPDATE_DOG,
      familyId,
      { id: dogId, patch: data, _sync: syncMeta },
      ['dogs', 'expenses'],
      syncMeta,
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

  async updateDogNameLocally(familyIdInput: string, dogId: string, name: string) {
    const familyId = getFamilyId(familyIdInput)
    const dog = await findLocalRow<any>('dogs', dogId)
    if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')
    const trimmedName = String(name || '').trim()
    if (!trimmedName && dog.role !== '幼崽') throw new Error('请输入新名称')
    const now = getNow()
    const previousName = String(dog.name || '')
    const syncMeta = buildSyncMeta({ [dogId]: Number(dog.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.UPDATE_DOG_NAME),
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
    const renameDogNames = (row: any) => {
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
    await runLocalMutation(renameScopes, (tables) => {
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
      tables.health_records = (tables.health_records as any[]).map(row => row.dog_id === dogId ? { ...row, dog_name: trimmedName, updated_at: now } : row)
      tables.medication_tasks = (tables.medication_tasks as any[]).map(row => row.dog_id === dogId ? { ...row, dog_name: trimmedName, updated_at: now } : row)
      tables.breeding_records = (tables.breeding_records as any[]).map(row => row.dog_id === dogId ? { ...row, dog_name: trimmedName, updated_at: now } : row)
      tables.expenses = (tables.expenses as any[]).map(renameDogNames)
      tables.incomes = (tables.incomes as any[]).map(row => row.dog_id === dogId ? { ...row, dog_name: trimmedName, updated_at: now } : row)
      tables.sale_records = (tables.sale_records as any[]).map(row => row.dog_id === dogId ? { ...row, dog_name: trimmedName, updated_at: now } : row)
    })
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.UPDATE_DOG_NAME,
      familyId,
      { id: dogId, name: trimmedName, _sync: syncMeta },
      renameScopes,
      syncMeta,
    )
    return {
      message: '名称已更新',
      ...buildLocalAck(syncMeta, [{ collection: 'dogs', id: dogId, version: Number(dog.version || 0), updatedAt: now }]),
    }
  }

  async changeDogDispositionLocally(familyIdInput: string, dogId: string, newDisposition: string, data: Record<string, any> = {}) {
    const familyId = getFamilyId(familyIdInput)
    const dog = await findLocalRow<any>('dogs', dogId)
    if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')

    const activeCycles = await localDb.query<any>('breeding_cycles', row =>
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
    const cycleStatusMap = new Map<string, string>()
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

    const taskRows = await localDb.query<any>('tasks', row => {
      if (row.family_id !== familyId || row.status !== 'pending') return false
      if (newDisposition === '已故') return row.dog_id === dogId || cycleIdsToCancel.has(row.cycle_id)
      return cycleIdsToCancel.has(row.cycle_id)
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
      ? await localDb.query<any>('incomes', row =>
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
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.CHANGE_DOG_DISPOSITION),
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

    await runLocalMutation(['dogs', 'breeding_cycles', 'tasks', 'incomes'], (tables) => {
      tables.dogs = (tables.dogs as any[]).map((row) => row._id === dogId
        ? {
            ...row,
            disposition: newDisposition,
            disposition_date: ['已故', '已领养', '已赠送', '已退休'].includes(newDisposition) ? (dispositionDate || now) : null,
            disposition_notes: ['已故', '已领养', '已赠送', '已退休'].includes(newDisposition) ? dispositionNotes : null,
            updated_at: now,
            _local_pending: true,
          }
        : row)
      tables.breeding_cycles = (tables.breeding_cycles as any[]).map((row) => cycleStatusMap.has(row._id)
        ? {
            ...row,
            status: cycleStatusMap.get(row._id),
            updated_at: now,
          }
        : row)
      tables.tasks = (tables.tasks as any[]).map((row) => taskRows.some(task => task._id === row._id)
        ? {
            ...row,
            status: 'cancelled',
            updated_at: now,
          }
        : row)
      if (rollbackIncomeIds.size > 0) {
        tables.incomes = (tables.incomes as any[]).filter((row) => !rollbackIncomeIds.has(row._id))
      }
      if (nextAdoptionIncome) {
        tables.incomes = [...(tables.incomes as any[]), nextAdoptionIncome]
      }
    })

    await this.enqueueMutation(
      HOME_MUTATION_TYPES.CHANGE_DOG_DISPOSITION,
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

  async upgradePuppyToBreederLocally(familyIdInput: string, dogId: string) {
    const familyId = getFamilyId(familyIdInput)
    const dog = await findLocalRow<any>('dogs', dogId)
    if (!dog || dog.deleted_at) throw new Error('犬只未同步到本地，请联网刷新一次')
    if (dog.role !== '幼崽') throw new Error('犬只不存在或不是幼崽')

    const now = getNow()
    const syncMeta = buildSyncMeta({ [dogId]: Number(dog.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.UPGRADE_PUPPY_TO_BREEDER),
    })

    await upsertLocalRows('dogs', [{
      ...dog,
      role: '种狗',
      disposition: '在养',
      updated_at: now,
      _local_pending: true,
    }])
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.UPGRADE_PUPPY_TO_BREEDER,
      familyId,
      { id: dogId, _sync: syncMeta },
      ['dogs'],
      syncMeta,
    )
    return {
      message: '已升级为种狗',
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

    const hasHomeData = await this.hasCollectionsData(HOME_SYNC_COLLECTIONS)
    if (hasHomeData) return
    await this.syncScope('home', { force: true, forceFull: true })
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
    const localOperationLog = await createPendingLocalOperationLog(type, familyId, payload, syncMeta)
    if (localOperationLog) {
      await localDb.upsertRows('local_operation_logs', [localOperationLog])
    }
    if (this.online) {
      void this.flushOutbox(familyId)
    }
  }

  async getLocalOperationLogs(familyId: string, options: {
    start?: number
    end?: number
    actorUserIds?: string[]
    actionTypes?: string[]
    statuses?: MutationStatus[]
  } = {}) {
    const actorUserIds = new Set((options.actorUserIds || []).filter(Boolean))
    const actionTypes = new Set((options.actionTypes || []).filter(Boolean))
    const statuses = new Set((options.statuses || ['pending', 'processing', 'failed', 'conflict']).filter(Boolean) as MutationStatus[])
    const start = Number(options.start || 0)
    const end = Number(options.end || Date.now())

    return localDb.query<LocalOperationLogRow>('local_operation_logs', (row) => {
      if (row.family_id !== familyId) return false
      if (!statuses.has(row.status)) return false
      if (row.created_at < start || row.created_at > end) return false
      if (actorUserIds.size > 0 && !actorUserIds.has(String(row.actor_user_id || ''))) return false
      if (actionTypes.size > 0 && !actionTypes.has(String(row.action_type || ''))) return false
      return true
    }, {
      sort: (left, right) => Number(right.created_at || 0) - Number(left.created_at || 0),
    })
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
        mutation.family_id === familyId
        &&
        (mutation.status === 'pending' || mutation.status === 'failed')
        && mutation.next_retry_at <= now,
      )

      for (const mutation of pendingMutations) {
        let currentMutation = mutation
        await updateOutboxStatus(currentMutation._id, 'processing')
        try {
          for (let attempt = 0; attempt < MAX_CONFLICT_REBASE_ATTEMPTS; attempt += 1) {
            const result = await this.dispatchMutation(currentMutation)
            const ack = (result || {}) as SyncAckPayload

            if (ack.conflict) {
              const rebasedMutation = rebaseMutationForConflict(currentMutation, ack.conflict)
              if (rebasedMutation && attempt < MAX_CONFLICT_REBASE_ATTEMPTS - 1) {
                currentMutation = rebasedMutation
                await localDb.upsertRows('outbox_mutations', [{
                  ...currentMutation,
                  status: 'processing',
                  updated_at: getNow(),
                }])
                continue
              }

              await localDb.upsertConflict({
                _id: `conflict_${currentMutation.client_mutation_id}`,
                client_mutation_id: currentMutation.client_mutation_id,
                collection: ack.conflict.collection,
                entity_id: ack.conflict.entityId,
                base_version: ack.conflict.baseVersion,
                server_version: ack.conflict.serverVersion,
                status: 'open',
                detail: ack.conflict ? { ...ack.conflict } : null,
                created_at: now,
                updated_at: getNow(),
              })
              await updateOutboxStatus(currentMutation._id, 'conflict')
              break
            }

            await applySyncAck(ack, currentMutation.collection_scope, familyId)
            await updateOutboxStatus(currentMutation._id, 'synced')
            break
          }
        } catch (error) {
          const retryCount = currentMutation.retry_count + 1
          const retryAt = now + Math.min(60000, 1000 * (2 ** Math.min(retryCount, 6)))
          await updateOutboxStatus(
            currentMutation._id,
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
    const expectedVariant = getHealthVariantKey(data.type, data.details || {})
    const weekMs = 7 * 86400000
    const dogIds = data.dogs.map((dog: any) => dog.dog_id).filter(Boolean)
    const existingTasks = dogIds.length > 0
      ? await localDb.query<any>('tasks', row =>
        row.family_id === familyId
        && row.status === 'pending'
        && row.type === data.type
        && dogIds.includes(row.dog_id)
        && Number(row.due_date || 0) >= Number(data.due_date) - weekMs
        && Number(row.due_date || 0) <= Number(data.due_date) + weekMs,
      )
      : []
    const duplicateDogIdSet = new Set(
      (existingTasks || [])
        .filter(task => getHealthVariantKey(task.type, task.details || {}) === expectedVariant)
        .map(task => task.dog_id)
        .filter(Boolean),
    )
    const duplicateRecordedDogIdSet = shouldSkipDuplicateHealthRecord(data.type)
      ? new Set(
        (await localDb.query<any>('health_records', row =>
          row.family_id === familyId
          && !row.deleted_at
          && row.type === data.type
          && dogIds.includes(row.dog_id)
          && startOfDay(Number(row.date || 0)) === startOfDay(Number(data.due_date || 0)),
        ))
          .filter(row => getHealthVariantKey(row.type, row.details || {}) === expectedVariant)
          .map(row => row.dog_id)
          .filter(Boolean),
      )
      : new Set<string>()
    const duplicateAnyDogIdSet = new Set<string>([
      ...duplicateDogIdSet,
      ...duplicateRecordedDogIdSet,
    ])

    const dogsToCreate = data.dogs.filter((dog: any) => !duplicateAnyDogIdSet.has(dog.dog_id))
    const skippedDogs = data.dogs
      .filter((dog: any) => duplicateAnyDogIdSet.has(dog.dog_id))
      .map((dog: any) => ({
        dog_id: dog.dog_id,
        dog_name: dog.dog_name || '',
        reason: duplicateRecordedDogIdSet.has(dog.dog_id) ? 'existing_record' : 'existing_task',
      }))
    const tasks = dogsToCreate.map((dog: any) => buildLocalTaskFromManualPayload(
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

    if (tasks.length > 0) {
      await localDb.upsertRows('tasks', tasks)
      await this.enqueueMutation(
        HOME_MUTATION_TYPES.BATCH_CREATE_TASKS,
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

  async batchAddHealthRecordsLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    if (!Array.isArray(data.dog_ids) || !data.dog_ids.length) throw new Error('请选择犬只')
    const uniqueDogIds = [...new Set(data.dog_ids)]
    const dogs = await getDogsByIds(data.dog_ids)
    if (dogs.length !== [...new Set(data.dog_ids)].length) throw new Error('部分犬只未同步到本地，请联网刷新一次')

    const now = getNow()
    const duplicateCandidates = shouldSkipDuplicateHealthRecord(data.type)
      ? await localDb.query<any>('health_records', row =>
        row.family_id === familyId
        && !row.deleted_at
        && row.type === data.type
        && uniqueDogIds.includes(row.dog_id)
        && startOfDay(Number(row.date || 0)) === startOfDay(Number(data.date || 0)),
      )
      : []
    const expectedVariant = getHealthVariantKey(data.type, data.details || {})
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
          clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.CREATE_HEALTH_RECORDS),
        })),
      }
    }

    const totalCost = data.cost || null
    const perDogCost = totalCost && dogsToCreate.length > 1 ? Math.round(totalCost / dogsToCreate.length * 100) / 100 : totalCost
    const records = dogsToCreate.map(({ dog }) => buildLocalHealthRecord(
      familyId,
      dog,
      data,
      createStableEntityId('health_record'),
      now,
      perDogCost && perDogCost > 0 ? perDogCost : null,
    ))
    const expenseRows = perDogCost && perDogCost > 0
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
    const pendingTasks = await localDb.query<any>('tasks', task =>
      task.family_id === familyId
      && task.status === 'pending'
      && task.type === data.type
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
        clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.CREATE_HEALTH_RECORDS),
        clientEntityIds: {
          health_records: records.map(record => record._id),
          ...(expenseRows.length ? { expenses: expenseRows.map(row => row._id) } : {}),
        },
      },
    )

    await localDb.transact(['health_records', 'tasks', 'expenses'], (tables) => {
      tables.health_records = [...(tables.health_records as any[]), ...records]
      if (expenseRows.length > 0) {
        tables.expenses = [...(tables.expenses as any[]), ...expenseRows]
      }
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
      { ...data, dog_ids: createdDogIds, _sync: syncMeta },
      ['health_records', 'tasks', 'expenses'],
      syncMeta,
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
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.CREATE_MEDICATION_TASKS),
      clientEntityIds: {
        medication_tasks: medicationTasks.map(task => task._id),
        ...(expenseRows.length ? { expenses: expenseRows.map(row => row._id) } : {}),
      },
    })

    await localDb.transact(['medication_tasks', 'health_records', 'expenses'], (tables) => {
      const overriddenMedicationIds = new Set(overriddenMedicationTasks.map(row => row._id))
      tables.medication_tasks = [
        ...(tables.medication_tasks as any[]).map(row => overriddenMedicationIds.has(row._id)
          ? { ...row, status: '已取消', updated_at: now, _local_pending: true }
          : row),
        ...medicationTasks,
      ]
      if (expenseRows.length > 0) {
        tables.expenses = [...(tables.expenses as any[]), ...expenseRows]
      }
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
          : data.type === 'pregnancy_check' && isLocalPregnancyRejected(data.details || {})
            ? '失败'
            : existingCycle?.status || '发情中'
    const record = buildLocalBreedingRecord(familyId, dog, data, recordId, cycleId, now)
    const extraArrangementTask = data.extra_arrangement?.kind && data.extra_arrangement?.due_date
      ? buildLocalBreedingExtraTask(familyId, dog, cycleId, recordId, data.extra_arrangement, createStableEntityId('task'), now)
      : null
    const pendingMilestoneTasks = shouldClearLocalBreedingMilestones(data)
      ? await localDb.query<any>('tasks', row =>
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
        clientEntityIds: {
          breeding_records: recordId,
          breeding_cycles: cycleId,
          ...(expenseId ? { expenses: expenseId } : {}),
        },
      },
    )

    await localDb.transact(['breeding_records', 'breeding_cycles', 'tasks', 'expenses'], (tables) => {
      tables.breeding_records = [...(tables.breeding_records as any[]), record]
      const cycleMap = new Map((tables.breeding_cycles as any[]).map(row => [row._id, row]))
      cycleMap.set(cycleId, { ...(cycleMap.get(cycleId) || {}), ...cycle })
      tables.breeding_cycles = Array.from(cycleMap.values())
      if (pendingMilestoneTasks.length > 0) {
        const pendingMilestoneIds = new Set(pendingMilestoneTasks.map(task => task._id))
        tables.tasks = (tables.tasks as any[]).map(row => pendingMilestoneIds.has(row._id)
          ? { ...row, status: 'cancelled', updated_at: now, _local_pending: true }
          : row)
      }
      if (extraArrangementTask) {
        tables.tasks = [...(tables.tasks as any[]), extraArrangementTask]
      }
      if (expenseRow) {
        tables.expenses = [...(tables.expenses as any[]), expenseRow]
      }
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
        ...pendingMilestoneTasks.map(task => ({ collection: 'tasks' as BusinessCollectionName, id: task._id, version: Number(task.version || 0), updatedAt: now })),
        ...(expenseRow ? [{ collection: 'expenses' as BusinessCollectionName, id: expenseRow._id, version: 0, updatedAt: now }] : []),
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

  async addBirthRecordLocally(familyIdInput: string, data: Record<string, any>) {
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

    const normalizedPuppies = data.puppies.map((puppy: Record<string, any>, index: number) => {
      const alive = puppy.alive !== false
      const resolvedName = String(puppy.name || '').trim() || `${cycle.dam_name || '母犬'}窝-${index + 1}号`
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
          litter_number: null,
          notes: data.birth_notes ? `生产 · ${String(data.birth_notes).trim()}` : '生产',
          deleted_at: null,
          version: 0,
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

    await localDb.transact(['breeding_records', 'litters', 'dogs', 'dog_weights', 'tasks', 'expenses', 'breeding_cycles'], (tables) => {
      tables.breeding_records = [...(tables.breeding_records as any[]), breedingRecord]
      tables.litters = [...(tables.litters as any[]), litter]
      tables.dogs = [
        ...(tables.dogs as any[]).map(row => row._id === cycle.dam_id ? { ...row, updated_at: now } : row),
        ...puppies,
      ]
      tables.dog_weights = [...(tables.dog_weights as any[]), ...weightRows]
      tables.tasks = [
        ...(tables.tasks as any[]).map(row =>
          pendingMilestones.some(item => item._id === row._id)
            ? { ...row, status: 'cancelled', updated_at: now, _local_pending: true }
            : row),
        ...createdTasks,
      ]
      if (expenseRow) {
        tables.expenses = [...(tables.expenses as any[]), expenseRow]
      }
      tables.breeding_cycles = (tables.breeding_cycles as any[]).map(row => row._id === cycleId
        ? { ...row, status: '已生产', updated_at: now, _local_pending: true }
        : row)
    })

    await this.enqueueMutation(
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

  async updateBreedingRecordLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const recordId = String(data.id || '').trim()
    if (!recordId) throw new Error('缺少记录 ID')
    const record = await findLocalRow<any>('breeding_records', recordId)
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
    const nextRecord = {
      ...record,
      date: data.date !== undefined ? data.date : record.date,
      cost: data.cost !== undefined ? data.cost : record.cost,
      notes: data.notes !== undefined ? data.notes : record.notes,
      details: nextDetails,
      updated_at: now,
      _local_pending: true,
      _pending_upload: hasPendingUploadImages(nextDetails?.images),
      pending_upload: hasPendingUploadImages(nextDetails?.images),
    }

    const existingExtraTask = await localDb.query<any>('tasks', row =>
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
    const cycleRecords = await localDb.query<any>('breeding_records', row =>
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
      ? await localDb.query<any>('tasks', row =>
        row.family_id === familyId
        && row.cycle_id === record.cycle_id
        && row.type === 'breeding_milestone'
        && row.status === 'pending'
        && !row.deleted_at,
      )
      : []
    const linkedExpenses = await localDb.query<any>('expenses', row =>
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

    await localDb.transact(['breeding_records', 'tasks', 'expenses'], (tables) => {
      tables.breeding_records = (tables.breeding_records as any[]).map(row => row._id === recordId ? nextRecord : row)
      tables.tasks = (tables.tasks as any[]).map(row => (
        pendingMilestoneTasks.some(task => task._id === row._id)
          ? { ...row, status: 'cancelled', updated_at: now, _local_pending: true }
          : row
      ))
      tables.tasks = (tables.tasks as any[]).filter(row => {
        if (row.type !== 'breeding_extra_arrangement' || row.source_record_id !== recordId) return true
        return !!nextExtraTask && row._id === nextExtraTask._id
      })
      if (nextExtraTask) {
        const existingIndex = (tables.tasks as any[]).findIndex(row => row._id === nextExtraTask._id)
        if (existingIndex >= 0) {
          ;(tables.tasks as any[])[existingIndex] = {
            ...(tables.tasks as any[])[existingIndex],
            ...nextExtraTask,
          }
        } else {
          tables.tasks = [...(tables.tasks as any[]), nextExtraTask]
        }
      }
      if (linkedExpenseIds.size > 0) {
        tables.expenses = (tables.expenses as any[]).filter(row => !linkedExpenseIds.has(row._id))
      }
      if (nextExpenseRows.length > 0) {
        tables.expenses = [...(tables.expenses as any[]), ...nextExpenseRows]
      }
    })

    await this.enqueueMutation(
      LOCAL_MUTATION_TYPES.UPDATE_BREEDING_RECORD,
      familyId,
      { ...data, _sync: syncMeta },
      ['breeding_records', 'tasks', 'expenses'],
      syncMeta,
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

  async deleteBreedingRecordLocally(familyIdInput: string, recordIdInput: string) {
    const familyId = getFamilyId(familyIdInput)
    const recordId = String(recordIdInput || '').trim()
    if (!recordId) throw new Error('缺少记录 ID')
    const record = await findLocalRow<any>('breeding_records', recordId)
    if (!record || record.family_id !== familyId) throw new Error('记录不存在')
    if (record.type !== 'heat_observation') throw new Error('当前仅支持删除发情观察记录')
    const now = getNow()
    const syncMeta = buildSyncMeta({ [recordId]: Number(record.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.DELETE_BREEDING_RECORD),
    })

    await localDb.transact(['breeding_records', 'tasks', 'expenses'], (tables) => {
      tables.breeding_records = (tables.breeding_records as any[]).filter(row => row._id !== recordId)
      tables.tasks = (tables.tasks as any[]).filter(row => row.source_record_id !== recordId)
      tables.expenses = (tables.expenses as any[]).filter(row => row.source_record_id !== recordId)
    })
    await this.enqueueMutation(
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

  async closeBreedingCycleLocally(familyIdInput: string, cycleIdInput: string, reasonInput: string) {
    const familyId = getFamilyId(familyIdInput)
    const cycleId = String(cycleIdInput || '').trim()
    if (!cycleId) throw new Error('缺少周期 ID')
    const cycle = await findLocalRow<any>('breeding_cycles', cycleId)
    if (!cycle || cycle.family_id !== familyId) throw new Error('周期不存在')
    if (['已生产', '失败', '放弃'].includes(cycle.status)) throw new Error('周期已结束，不可再次关闭')
    const newStatus = reasonInput === '放弃' ? '放弃' : '失败'
    const now = getNow()
    const pendingTasks = await localDb.query<any>('tasks', row =>
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
    await localDb.transact(['breeding_cycles', 'tasks'], (tables) => {
      tables.breeding_cycles = (tables.breeding_cycles as any[]).map(row => row._id === cycleId
        ? { ...row, status: newStatus, updated_at: now, _local_pending: true }
        : row)
      tables.tasks = (tables.tasks as any[]).map(row =>
        pendingTaskIds.has(row._id)
          ? { ...row, status: 'cancelled', updated_at: now, _local_pending: true }
          : row)
    })
    await this.enqueueMutation(
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

  async addPuppyToLitterLocally(familyIdInput: string, litterIdInput: string, puppyData: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const litterId = String(litterIdInput || '').trim()
    if (!litterId) throw new Error('缺少窝 ID')
    const litter = await findLocalRow<any>('litters', litterId)
    if (!litter || litter.family_id !== familyId) throw new Error('窝不存在')
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
    const syncMeta = buildSyncMeta({ [litterId]: Number(litter.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.ADD_PUPPY_TO_LITTER),
      clientEntityIds: { dogs: puppyId },
    })
    await upsertLocalRows('dogs', [puppy])
    await this.enqueueMutation(
      LOCAL_MUTATION_TYPES.ADD_PUPPY_TO_LITTER,
      familyId,
      { litterId, puppyData, _sync: syncMeta },
      ['dogs', 'litters'],
      syncMeta,
    )
    return {
      data: { puppyId },
      ...buildLocalAck(syncMeta, [{ collection: 'dogs', id: puppyId, version: 0, updatedAt: now }]),
    }
  }

  async updateLitterLocally(familyIdInput: string, litterIdInput: string, data: Record<string, any>) {
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
    await upsertLocalRows('litters', [nextLitter])
    await this.enqueueMutation(
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

  async updateLitterBirthDateLocally(familyIdInput: string, litterIdInput: string, birthDate: number) {
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
    const syncMeta = buildSyncMeta({
      [litterId]: Number(litter.version || 0),
      ...linkedExpenses.reduce<Record<string, number>>((acc, row) => {
        acc[row._id] = Number(row.version || 0)
        return acc
      }, {}),
    }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_LITTER_BIRTH_DATE),
    })
    await localDb.transact(['litters', 'dogs', 'expenses'], (tables) => {
      tables.litters = (tables.litters as any[]).map(row => row._id === litterId
        ? { ...row, birth_date: birthDate, updated_at: now, _local_pending: true }
        : row)
      tables.dogs = (tables.dogs as any[]).map(row =>
        row.origin_litter_id === litterId && !row.deleted_at
          ? { ...row, birth_date: birthDate, updated_at: now, _local_pending: true }
          : row)
      tables.expenses = (tables.expenses as any[]).map(row =>
        linkedExpenses.some(expense => expense._id === row._id)
          ? { ...row, date: birthDate, updated_at: now, _local_pending: true }
          : row)
    })
    await this.enqueueMutation(
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
        ...linkedExpenses.map(row => ({
          collection: 'expenses' as BusinessCollectionName,
          id: row._id,
          version: Number(row.version || 0),
          updatedAt: now,
        })),
      ]),
    }
  }

  async confirmWeaningLocally(familyIdInput: string, litterIdInput: string) {
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
    await localDb.transact(['litters', 'tasks'], (tables) => {
      tables.litters = (tables.litters as any[]).map(row => row._id === litterId
        ? { ...row, weaned_at: now, updated_at: now, _local_pending: true }
        : row)
      tables.tasks = (tables.tasks as any[]).map(row =>
        pendingTaskIds.has(row._id)
          ? { ...row, status: 'completed', completed_at: now, updated_at: now, _local_pending: true }
          : row)
    })
    await this.enqueueMutation(
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

  async addExpenseLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const now = getNow()
    const pendingUpload = hasPendingUploadImages(data.images)
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
      _pending_upload: pendingUpload,
      pending_upload: pendingUpload,
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
    const pendingUpload = hasPendingUploadImages(data.images)
    const income = {
      _id: createStableEntityId('income'),
      family_id: familyId,
      dog_id: data.dog_id || null,
      dog_name: data.dog_name || null,
      type: data.type,
      amount: data.amount,
      date: data.date || now,
      source_sale_id: data.source_sale_id || null,
      source_type: data.source_type || 'manual',
      source_record_id: data.source_record_id || null,
      notes: data.notes || null,
      images: data.images || [],
      deleted_at: null,
      version: 0,
      created_at: now,
      updated_at: now,
      _local_pending: true,
      _pending_upload: pendingUpload,
      pending_upload: pendingUpload,
    }
    const syncMeta = buildSyncMeta({}, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.CREATE_INCOME),
      clientEntityIds: { incomes: income._id },
    })
    await localDb.upsertRows('incomes', [income])
    await this.enqueueMutation(HOME_MUTATION_TYPES.CREATE_INCOME, familyId, { ...data, _sync: syncMeta }, ['incomes'], syncMeta)
    return { data: { incomeId: income._id }, ...buildLocalAck(syncMeta, [{ collection: 'incomes', id: income._id, version: 0, updatedAt: now }]) }
  }

  async updateExpenseLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const expenseId = String(data.id || '').trim()
    if (!expenseId) throw new Error('缺少记录 ID')
    const expense = await findLocalRow<any>('expenses', expenseId)
    if (!expense || expense.family_id !== familyId || expense.deleted_at) throw new Error('记录不存在')
    if (expense.source_type === 'auto') throw new Error('自动生成的费用不可编辑，请在来源记录中操作')

    const now = getNow()
    const pendingUpload = hasPendingUploadImages(data.images)
    const nextExpense = {
      ...expense,
      total_amount: data.total_amount,
      category: data.category,
      date: data.date || expense.date,
      linked_cycle_id: data.linked_cycle_id || null,
      linked_litter_id: data.linked_litter_id || null,
      linked_dog_ids: data.linked_dog_ids || [],
      dam_name: data.dam_name || null,
      dog_names: data.dog_names || [],
      litter_number: data.litter_number || null,
      notes: data.notes || null,
      images: data.images || [],
      updated_at: now,
      _local_pending: true,
      _pending_upload: pendingUpload,
      pending_upload: pendingUpload,
    }
    const syncMeta = buildSyncMeta({ [expenseId]: Number(expense.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_EXPENSE),
    })
    await upsertLocalRows('expenses', [nextExpense])
    await this.enqueueMutation(
      LOCAL_MUTATION_TYPES.UPDATE_EXPENSE,
      familyId,
      { ...data, id: expenseId, _sync: syncMeta },
      ['expenses'],
      syncMeta,
    )
    return {
      message: '已更新',
      ...buildLocalAck(syncMeta, [{ collection: 'expenses', id: expenseId, version: Number(expense.version || 0), updatedAt: now }]),
    }
  }

  async updateIncomeLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const incomeId = String(data.id || '').trim()
    if (!incomeId) throw new Error('缺少记录 ID')
    const income = await findLocalRow<any>('incomes', incomeId)
    if (!income || income.family_id !== familyId || income.deleted_at) throw new Error('记录不存在')
    if (income.source_sale_id || income.source_type === 'auto') throw new Error('自动生成的收入不可编辑，请在来源记录中操作')

    const now = getNow()
    const pendingUpload = hasPendingUploadImages(data.images)
    const nextIncome = {
      ...income,
      amount: data.amount,
      type: data.type,
      dog_id: data.dog_id || null,
      dog_name: data.dog_name || null,
      date: data.date || income.date,
      notes: data.notes || null,
      images: data.images || [],
      updated_at: now,
      _local_pending: true,
      _pending_upload: pendingUpload,
      pending_upload: pendingUpload,
    }
    const syncMeta = buildSyncMeta({ [incomeId]: Number(income.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_INCOME),
    })
    await upsertLocalRows('incomes', [nextIncome])
    await this.enqueueMutation(
      LOCAL_MUTATION_TYPES.UPDATE_INCOME,
      familyId,
      { ...data, id: incomeId, _sync: syncMeta },
      ['incomes'],
      syncMeta,
    )
    return {
      message: '已更新',
      ...buildLocalAck(syncMeta, [{ collection: 'incomes', id: incomeId, version: Number(income.version || 0), updatedAt: now }]),
    }
  }

  async deleteExpenseLocally(familyIdInput: string, expenseIdInput: string) {
    const familyId = getFamilyId(familyIdInput)
    const expenseId = String(expenseIdInput || '').trim()
    if (!expenseId) throw new Error('缺少记录 ID')
    const expense = await findLocalRow<any>('expenses', expenseId)
    if (!expense || expense.family_id !== familyId || expense.deleted_at) throw new Error('记录不存在')
    if (expense.source_type === 'auto') throw new Error('自动生成的费用不可删除，请在来源记录中操作')

    const now = getNow()
    const syncMeta = buildSyncMeta({ [expenseId]: Number(expense.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.DELETE_EXPENSE),
    })
    await upsertLocalRows('expenses', [{
      ...expense,
      deleted_at: now,
      updated_at: now,
      _local_pending: true,
    }])
    await this.enqueueMutation(
      LOCAL_MUTATION_TYPES.DELETE_EXPENSE,
      familyId,
      { id: expenseId, _sync: syncMeta },
      ['expenses'],
      syncMeta,
    )
    return {
      message: '已删除',
      ...buildLocalAck(syncMeta, [{ collection: 'expenses', id: expenseId, version: Number(expense.version || 0), updatedAt: now, deletedAt: now }]),
    }
  }

  async deleteIncomeLocally(familyIdInput: string, incomeIdInput: string) {
    const familyId = getFamilyId(familyIdInput)
    const incomeId = String(incomeIdInput || '').trim()
    if (!incomeId) throw new Error('缺少记录 ID')
    const income = await findLocalRow<any>('incomes', incomeId)
    if (!income || income.family_id !== familyId || income.deleted_at) throw new Error('记录不存在')
    if (income.source_sale_id || income.source_type === 'auto') throw new Error('自动生成的收入不可删除，请在来源记录中操作')

    const now = getNow()
    const syncMeta = buildSyncMeta({ [incomeId]: Number(income.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.DELETE_INCOME),
    })
    await upsertLocalRows('incomes', [{
      ...income,
      deleted_at: now,
      updated_at: now,
      _local_pending: true,
    }])
    await this.enqueueMutation(
      LOCAL_MUTATION_TYPES.DELETE_INCOME,
      familyId,
      { id: incomeId, _sync: syncMeta },
      ['incomes'],
      syncMeta,
    )
    return {
      message: '已删除',
      ...buildLocalAck(syncMeta, [{ collection: 'incomes', id: incomeId, version: Number(income.version || 0), updatedAt: now, deletedAt: now }]),
    }
  }

  async createSaleRecordLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const dogId = String(data.dog_id || data.dogId || '').trim()
    if (!dogId) throw new Error('请选择犬只')

    const dog = await findLocalRow<any>('dogs', dogId)
    if (!dog || dog.family_id !== familyId || dog.deleted_at) throw new Error('犬只未同步到本地，请联网刷新一次')
    if (dog.role !== '幼崽') throw new Error('只有幼崽可以开始销售')
    if (!['在养', '自留'].includes(String(dog.disposition || ''))) throw new Error('当前犬只状态不可开始销售')

    const activeSale = await localDb.query<any>('sale_records', row =>
      row.family_id === familyId
      && row.dog_id === dogId
      && !row.deleted_at
      && ['待售', '已预定'].includes(String(row.status || '')),
    )
    if (activeSale.length > 0) throw new Error('该犬只已有进行中的销售记录')

    const now = getNow()
    const saleId = createStableEntityId('sale_record')
    const sale = {
      _id: saleId,
      dog_id: dogId,
      dog_name: dog.name || '',
      family_id: familyId,
      status: '待售',
      sale_mode: data.sale_mode || '自售',
      settlement_status: null,
      floor_price: data.floor_price ?? null,
      deposit_amount: null,
      deposit_date: null,
      agreed_price: null,
      received_amount: null,
      seller_agent_id: null,
      seller_agent_name: null,
      platform: null,
      date: null,
      delivery_date: null,
      buyer_info: data.buyer_info || null,
      refund_amount: null,
      refund_reason: null,
      refund_date: null,
      deposit_kept_amount: null,
      notes: data.notes || null,
      created_by: '',
      deleted_at: null,
      version: 0,
      created_at: now,
      updated_at: now,
      _local_pending: true,
    }
    const syncMeta = buildSyncMeta({ [dogId]: Number(dog.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.CREATE_SALE_RECORD),
      clientEntityIds: { sale_records: saleId },
    })

    await runLocalMutation(['sale_records', 'dogs'], (tables) => {
      tables.sale_records = [...(tables.sale_records as any[]), sale]
      tables.dogs = (tables.dogs as any[]).map(row => row._id === dogId
        ? {
            ...row,
            disposition: '待售',
            disposition_date: now,
            updated_at: now,
          }
        : row)
    })
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.CREATE_SALE_RECORD,
      familyId,
      { ...data, dog_id: dogId, _sync: syncMeta },
      ['sale_records', 'dogs'],
      syncMeta,
    )
    return {
      data: { saleId },
      ...buildLocalAck(syncMeta, [
        { collection: 'sale_records', id: saleId, version: 0, updatedAt: now },
        { collection: 'dogs', id: dogId, version: Number(dog.version || 0), updatedAt: now },
      ]),
    }
  }

  async receiveSaleDepositLocally(familyIdInput: string, saleId: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const sale = await findLocalRow<any>('sale_records', saleId)
    if (!sale || sale.family_id !== familyId || sale.deleted_at) throw new Error('记录不存在')
    if (sale.status !== '待售') throw new Error('只有待售状态可以收定金')
    const dog = await findLocalRow<any>('dogs', sale.dog_id)
    if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')
    const amount = Number(data.deposit_amount)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('请填写定金金额')

    const now = getNow()
    const baseVersions = {
      [saleId]: Number(sale.version || 0),
      [sale.dog_id]: Number(dog.version || 0),
    }
    const syncMeta = buildSyncMeta(baseVersions, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.RECEIVE_SALE_DEPOSIT),
    })

    await runLocalMutation(['sale_records', 'dogs'], (tables) => {
      tables.sale_records = (tables.sale_records as any[]).map(row => row._id === saleId
        ? {
            ...row,
            status: '已预定',
            deposit_amount: amount,
            deposit_date: data.deposit_date || now,
            agreed_price: data.agreed_price ?? null,
            buyer_info: data.buyer_info || row.buyer_info || null,
            seller_agent_id: data.seller_agent_id || data.agent_id || null,
            seller_agent_name: data.seller_agent_name || data.agent_name || row.seller_agent_name || null,
            platform: data.platform || null,
            updated_at: now,
            _local_pending: true,
          }
        : row)
      tables.dogs = (tables.dogs as any[]).map(row => row._id === sale.dog_id
        ? {
            ...row,
            disposition: '已预定',
            updated_at: now,
          }
        : row)
    })
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.RECEIVE_SALE_DEPOSIT,
      familyId,
      { id: saleId, saleId, ...data, _sync: syncMeta },
      ['sale_records', 'dogs'],
      syncMeta,
    )
    return {
      message: '已收定金',
      ...buildLocalAck(syncMeta, [
        { collection: 'sale_records', id: saleId, version: Number(sale.version || 0), updatedAt: now },
        { collection: 'dogs', id: sale.dog_id, version: Number(dog.version || 0), updatedAt: now },
      ]),
    }
  }

  async completeSaleLocally(familyIdInput: string, saleId: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const sale = await findLocalRow<any>('sale_records', saleId)
    if (!sale || sale.family_id !== familyId || sale.deleted_at) throw new Error('记录不存在')
    if (!['待售', '已预定'].includes(String(sale.status || ''))) throw new Error('当前状态不可完成交易')
    const dog = await findLocalRow<any>('dogs', sale.dog_id)
    if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')

    const hasReceivedAmount = data.received_amount !== '' && data.received_amount != null
    const receivedAmount = hasReceivedAmount ? Number(data.received_amount) : null
    if (hasReceivedAmount && (!Number.isFinite(receivedAmount) || Number(receivedAmount) <= 0)) {
      throw new Error('请填写有效的到手价')
    }

    const incomes = await localDb.query<any>('incomes', row =>
      row.family_id === familyId
      && !row.deleted_at
      && row.source_sale_id === saleId
      && row.type === '销售',
    )
    const existingIncome = incomes[0] || null
    const createdIncomeId = !existingIncome && receivedAmount != null ? createStableEntityId('income') : ''
    const settledDate = Number.isFinite(Number(data.date)) ? Number(data.date) : getNow()
    const now = getNow()
    const settlementStatus = receivedAmount != null ? '已结算' : '未结算'
    const baseVersions = {
      [saleId]: Number(sale.version || 0),
      [sale.dog_id]: Number(dog.version || 0),
      ...(existingIncome ? { [existingIncome._id]: Number(existingIncome.version || 0) } : {}),
    }
    const syncMeta = buildSyncMeta(baseVersions, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.COMPLETE_SALE),
      clientEntityIds: createdIncomeId ? { incomes: createdIncomeId } : undefined,
    })

    await runLocalMutation(['sale_records', 'dogs', 'incomes'], (tables) => {
      tables.sale_records = (tables.sale_records as any[]).map(row => row._id === saleId
        ? {
            ...row,
            status: '已成交',
            settlement_status: settlementStatus,
            received_amount: receivedAmount,
            agreed_price: data.agreed_price != null ? data.agreed_price : row.agreed_price || null,
            date: settledDate,
            delivery_date: data.delivery_date || null,
            seller_agent_id: data.seller_agent_id || row.seller_agent_id || null,
            seller_agent_name: data.seller_agent_name || data.agent_name || row.seller_agent_name || null,
            platform: data.platform || row.platform || null,
            buyer_info: data.buyer_info || row.buyer_info || null,
            updated_at: now,
            _local_pending: true,
          }
        : row)
      if (receivedAmount != null) {
        const nextIncome = existingIncome
          ? {
              ...existingIncome,
              amount: receivedAmount,
              date: settledDate,
              source_type: 'auto',
              source_record_id: saleId,
              updated_at: now,
            }
          : {
              _id: createdIncomeId,
              family_id: familyId,
              dog_id: sale.dog_id,
              dog_name: sale.dog_name,
              type: '销售',
              amount: receivedAmount,
              date: settledDate,
              source_sale_id: saleId,
              source_type: 'auto',
              source_record_id: saleId,
              notes: null,
              deleted_at: null,
              version: 0,
              created_by: '',
              created_at: now,
              updated_at: now,
              _local_pending: true,
            }
        tables.incomes = existingIncome
          ? (tables.incomes as any[]).map(row => row._id === existingIncome._id ? nextIncome : row)
          : [...(tables.incomes as any[]), nextIncome]
      }
      tables.dogs = (tables.dogs as any[]).map(row => row._id === sale.dog_id
        ? {
            ...row,
            disposition: '已售',
            disposition_date: settledDate,
            updated_at: now,
          }
        : row)
    })
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.COMPLETE_SALE,
      familyId,
      { id: saleId, saleId, ...data, _sync: syncMeta },
      ['sale_records', 'dogs', 'incomes'],
      syncMeta,
    )
    return {
      message: '交易完成',
      ...buildLocalAck(syncMeta, [
        { collection: 'sale_records', id: saleId, version: Number(sale.version || 0), updatedAt: now },
        { collection: 'dogs', id: sale.dog_id, version: Number(dog.version || 0), updatedAt: now },
        ...(receivedAmount != null
          ? [{ collection: 'incomes' as BusinessCollectionName, id: existingIncome?._id || createdIncomeId, version: Number(existingIncome?.version || 0), updatedAt: now }]
          : []),
      ]),
    }
  }

  async settleSaleLocally(familyIdInput: string, saleId: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const sale = await findLocalRow<any>('sale_records', saleId)
    if (!sale || sale.family_id !== familyId || sale.deleted_at) throw new Error('记录不存在')
    if (sale.status !== '已成交') throw new Error('只有已成交状态可以补录结算')
    if (data.received_amount === '' || data.received_amount == null) throw new Error('请填写到手价')
    const receivedAmount = Number(data.received_amount)
    if (!Number.isFinite(receivedAmount) || receivedAmount <= 0) throw new Error('请填写有效的到手价')

    const incomes = await localDb.query<any>('incomes', row =>
      row.family_id === familyId
      && !row.deleted_at
      && row.source_sale_id === saleId
      && row.type === '销售',
    )
    const existingIncome = incomes[0] || null
    const createdIncomeId = existingIncome ? '' : createStableEntityId('income')
    const settlementDate = Number.isFinite(Number(data.date)) ? Number(data.date) : Number(sale.date || getNow())
    const now = getNow()
    const baseVersions = {
      [saleId]: Number(sale.version || 0),
      ...(existingIncome ? { [existingIncome._id]: Number(existingIncome.version || 0) } : {}),
    }
    const syncMeta = buildSyncMeta(baseVersions, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.SETTLE_SALE),
      clientEntityIds: createdIncomeId ? { incomes: createdIncomeId } : undefined,
    })

    await runLocalMutation(['sale_records', 'incomes'], (tables) => {
      tables.sale_records = (tables.sale_records as any[]).map(row => row._id === saleId
        ? {
            ...row,
            received_amount: receivedAmount,
            agreed_price: data.agreed_price != null ? data.agreed_price : row.agreed_price || null,
            settlement_status: data.settlement_status || '已结算',
            updated_at: now,
            _local_pending: true,
          }
        : row)
      const nextIncome = existingIncome
        ? {
            ...existingIncome,
            amount: receivedAmount,
            date: settlementDate,
            source_type: 'auto',
            source_record_id: saleId,
            updated_at: now,
          }
        : {
            _id: createdIncomeId,
            family_id: familyId,
            dog_id: sale.dog_id,
            dog_name: sale.dog_name,
            type: '销售',
            amount: receivedAmount,
            date: settlementDate,
            source_sale_id: saleId,
            source_type: 'auto',
            source_record_id: saleId,
            notes: null,
            deleted_at: null,
            version: 0,
            created_by: '',
            created_at: now,
            updated_at: now,
            _local_pending: true,
          }
      tables.incomes = existingIncome
        ? (tables.incomes as any[]).map(row => row._id === existingIncome._id ? nextIncome : row)
        : [...(tables.incomes as any[]), nextIncome]
    })
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.SETTLE_SALE,
      familyId,
      { id: saleId, saleId, ...data, _sync: syncMeta },
      ['sale_records', 'incomes'],
      syncMeta,
    )
    return {
      message: '已补录结算',
      ...buildLocalAck(syncMeta, [
        { collection: 'sale_records', id: saleId, version: Number(sale.version || 0), updatedAt: now },
        { collection: 'incomes', id: existingIncome?._id || createdIncomeId, version: Number(existingIncome?.version || 0), updatedAt: now },
      ]),
    }
  }

  async cancelSaleLocally(familyIdInput: string, saleId: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const sale = await findLocalRow<any>('sale_records', saleId)
    if (!sale || sale.family_id !== familyId || sale.deleted_at) throw new Error('记录不存在')
    const dog = await findLocalRow<any>('dogs', sale.dog_id)
    if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')

    const now = getNow()
    const newIncomeId = createStableEntityId('income')
    const baseVersions = {
      [saleId]: Number(sale.version || 0),
      [sale.dog_id]: Number(dog.version || 0),
    }
    const syncMeta = buildSyncMeta(baseVersions, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.CANCEL_SALE),
      clientEntityIds: { incomes: newIncomeId },
    })

    await runLocalMutation(['sale_records', 'dogs', 'incomes'], (tables) => {
      if (sale.status === '已成交') {
        const refundAmount = Number(data.refund_amount || sale.received_amount || 0)
        const refundDate = Number.isFinite(Number(data.refund_date)) ? Number(data.refund_date) : now
        const isFullRefund = refundAmount >= Number(sale.received_amount || 0)
        tables.sale_records = (tables.sale_records as any[]).map(row => row._id === saleId
          ? {
              ...row,
              status: '已退款',
              refund_amount: refundAmount,
              refund_reason: data.refund_reason || null,
              refund_date: refundDate,
              updated_at: now,
              _local_pending: true,
            }
          : row)
        tables.incomes = [...(tables.incomes as any[]), {
          _id: newIncomeId,
          dog_id: sale.dog_id,
          dog_name: sale.dog_name,
          type: '退款',
          amount: -refundAmount,
          date: refundDate,
          source_sale_id: saleId,
          source_type: 'auto',
          source_record_id: saleId,
          notes: data.refund_reason || null,
          family_id: familyId,
          created_by: '',
          deleted_at: null,
          version: 0,
          created_at: now,
          updated_at: now,
          _local_pending: true,
        }]
        if (isFullRefund) {
          tables.dogs = (tables.dogs as any[]).map(row => row._id === sale.dog_id
            ? {
                ...row,
                disposition: '待售',
                disposition_date: null,
                updated_at: now,
              }
            : row)
        }
      } else if (sale.status === '已预定') {
        const keptAmount = Number(data.deposit_kept_amount || 0)
        const refundDate = Number.isFinite(Number(data.refund_date)) ? Number(data.refund_date) : now
        tables.sale_records = (tables.sale_records as any[]).map(row => row._id === saleId
          ? {
              ...row,
              status: '定金取消',
              deposit_kept_amount: keptAmount,
              refund_reason: data.refund_reason || null,
              refund_date: refundDate,
              updated_at: now,
              _local_pending: true,
            }
          : row)
        if (keptAmount > 0) {
          tables.incomes = [...(tables.incomes as any[]), {
            _id: newIncomeId,
            dog_id: sale.dog_id,
            dog_name: sale.dog_name,
            type: '定金保留',
            amount: keptAmount,
            date: refundDate,
            source_sale_id: saleId,
            source_type: 'auto',
            source_record_id: saleId,
            notes: data.refund_reason || null,
            family_id: familyId,
            created_by: '',
            deleted_at: null,
            version: 0,
            created_at: now,
            updated_at: now,
            _local_pending: true,
          }]
        }
        tables.dogs = (tables.dogs as any[]).map(row => row._id === sale.dog_id
          ? {
              ...row,
              disposition: '待售',
              updated_at: now,
            }
          : row)
      } else {
        throw new Error('当前状态不可取消')
      }
    })
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.CANCEL_SALE,
      familyId,
      { id: saleId, saleId, ...data, _sync: syncMeta },
      ['sale_records', 'dogs', 'incomes'],
      syncMeta,
    )
    return {
      message: '已取消',
      ...buildLocalAck(syncMeta, [
        { collection: 'sale_records', id: saleId, version: Number(sale.version || 0), updatedAt: now },
        { collection: 'dogs', id: sale.dog_id, version: Number(dog.version || 0), updatedAt: now },
        ...(sale.status === '已成交' || Number(data.deposit_kept_amount || 0) > 0
          ? [{ collection: 'incomes' as BusinessCollectionName, id: newIncomeId, version: 0, updatedAt: now }]
          : []),
      ]),
    }
  }

  async addAgentLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const name = String(data.name || '').trim()
    if (!name) throw new Error('请填写中间商姓名')
    const now = getNow()
    const agentId = createStableEntityId('agent')
    const agent = {
      _id: agentId,
      family_id: familyId,
      name,
      contact_info: data.contact_info || null,
      created_by: '',
      deleted_at: null,
      version: 0,
      created_at: now,
      updated_at: now,
      _local_pending: true,
    }
    const syncMeta = buildSyncMeta({}, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.CREATE_AGENT),
      clientEntityIds: { agents: agentId },
    })
    await upsertLocalRows('agents', [agent])
    await this.enqueueMutation(HOME_MUTATION_TYPES.CREATE_AGENT, familyId, { ...data, name, _sync: syncMeta }, ['agents'], syncMeta)
    return {
      data: { agentId },
      ...buildLocalAck(syncMeta, [{ collection: 'agents', id: agentId, version: 0, updatedAt: now }]),
    }
  }

  async updateAgentLocally(familyIdInput: string, agentId: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const agent = await findLocalRow<any>('agents', agentId)
    if (!agent || agent.family_id !== familyId || agent.deleted_at) throw new Error('中间商不存在')
    const name = String(data.name || '').trim()
    if (!name) throw new Error('请填写中间商姓名')
    const now = getNow()
    const syncMeta = buildSyncMeta({ [agentId]: Number(agent.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.UPDATE_AGENT),
    })
    await upsertLocalRows('agents', [{
      ...agent,
      name,
      contact_info: data.contact_info || null,
      updated_at: now,
      _local_pending: true,
    }])
    await this.enqueueMutation(HOME_MUTATION_TYPES.UPDATE_AGENT, familyId, { id: agentId, ...data, name, _sync: syncMeta }, ['agents'], syncMeta)
    return {
      message: '已更新',
      ...buildLocalAck(syncMeta, [{ collection: 'agents', id: agentId, version: Number(agent.version || 0), updatedAt: now }]),
    }
  }

  async removeAgentLocally(familyIdInput: string, agentId: string) {
    const familyId = getFamilyId(familyIdInput)
    const agent = await findLocalRow<any>('agents', agentId)
    if (!agent || agent.family_id !== familyId) throw new Error('中间商不存在')
    const now = getNow()
    const syncMeta = buildSyncMeta({ [agentId]: Number(agent.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.REMOVE_AGENT),
    })
    await upsertLocalRows('agents', [{
      ...agent,
      deleted_at: now,
      updated_at: now,
      _local_pending: true,
    }])
    await this.enqueueMutation(HOME_MUTATION_TYPES.REMOVE_AGENT, familyId, { id: agentId, _sync: syncMeta }, ['agents'], syncMeta)
    return {
      message: '已删除',
      ...buildLocalAck(syncMeta, [{ collection: 'agents', id: agentId, version: Number(agent.version || 0), updatedAt: now, deletedAt: now }]),
    }
  }

  async updateFamilySettingsLocally(familyIdInput: string, settings: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const family = await findLocalRow<any>('families', familyId)
    if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
    const now = getNow()
    const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.UPDATE_FAMILY_SETTINGS),
    })
    await upsertLocalRows('families', [{
      ...family,
      settings: {
        ...(family.settings || {}),
        ...settings,
      },
      updated_at: now,
      _local_pending: true,
    }])
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.UPDATE_FAMILY_SETTINGS,
      familyId,
      { ...settings, _sync: syncMeta },
      ['families'],
      syncMeta,
    )
    return {
      message: '设置已更新',
      ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
    }
  }

  async addCareRuleLocally(familyIdInput: string, rule: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const family = await findLocalRow<any>('families', familyId)
    if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
    if (!rule?.status_trigger || !rule?.task_description || !rule?.frequency) {
      throw new Error('请填写完整的护理规则')
    }
    const nextRule = {
      status_trigger: rule.status_trigger,
      task_description: rule.task_description,
      frequency: rule.frequency,
    }
    const now = getNow()
    const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.ADD_CARE_RULE),
    })
    await upsertLocalRows('families', [{
      ...family,
      care_rules: [...(Array.isArray(family.care_rules) ? family.care_rules : []), nextRule],
      updated_at: now,
      _local_pending: true,
    }])
    await this.enqueueMutation(HOME_MUTATION_TYPES.ADD_CARE_RULE, familyId, { ...nextRule, _sync: syncMeta }, ['families'], syncMeta)
    return {
      message: '护理规则已添加',
      ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
    }
  }

  async removeCareRuleLocally(familyIdInput: string, index: number) {
    const familyId = getFamilyId(familyIdInput)
    const family = await findLocalRow<any>('families', familyId)
    if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
    if (!Array.isArray(family.care_rules) || index < 0 || index >= family.care_rules.length) {
      throw new Error('规则不存在')
    }
    const now = getNow()
    const nextRules = [...family.care_rules]
    nextRules.splice(index, 1)
    const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.REMOVE_CARE_RULE),
    })
    await upsertLocalRows('families', [{
      ...family,
      care_rules: nextRules,
      updated_at: now,
      _local_pending: true,
    }])
    await this.enqueueMutation(HOME_MUTATION_TYPES.REMOVE_CARE_RULE, familyId, { index, _sync: syncMeta }, ['families'], syncMeta)
    return {
      message: '护理规则已删除',
      ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
    }
  }

  async updateNicknameLocally(familyIdInput: string, userId: string, nickname: string) {
    const familyId = getFamilyId(familyIdInput)
    const family = await findLocalRow<any>('families', familyId)
    if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
    const nextNickname = String(nickname || '').trim()
    if (!nextNickname) throw new Error('请输入昵称')
    const members = Array.isArray(family.members) ? [...family.members] : []
    const memberIndex = members.findIndex(item => item.user_id === userId && item.status === 'active')
    if (memberIndex < 0) throw new Error('成员不存在')
    const now = getNow()
    members[memberIndex] = {
      ...members[memberIndex],
      nickname: nextNickname,
    }
    const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.UPDATE_NICKNAME),
    })
    await upsertLocalRows('families', [{
      ...family,
      members,
      updated_at: now,
      _local_pending: true,
    }])
    await this.enqueueMutation(HOME_MUTATION_TYPES.UPDATE_NICKNAME, familyId, { nickname: nextNickname, _sync: syncMeta }, ['families'], syncMeta)
    return {
      message: '昵称已更新',
      ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
    }
  }

  async addExpenseCategoryGroupLocally(familyIdInput: string, labelInput: string) {
    const familyId = getFamilyId(familyIdInput)
    const family = await findLocalRow<any>('families', familyId)
    if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
    const label = String(labelInput || '').trim()
    if (!label) throw new Error('请填写分组名称')

    const customGroups = Array.isArray(family.settings?.custom_expense_category_groups)
      ? family.settings.custom_expense_category_groups
      : []
    const allGroups = buildExpenseCategoryGroups(customGroups)
    if (allGroups.some(item => item.label === label)) throw new Error('分组名称已存在')

    const nextGroup = { key: createLocalExpenseCategoryGroupKey(), label }
    const now = getNow()
    const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.ADD_EXPENSE_CATEGORY_GROUP),
    })

    await upsertLocalRows('families', [{
      ...family,
      settings: {
        ...(family.settings || {}),
        custom_expense_category_groups: [...customGroups, nextGroup],
      },
      updated_at: now,
      _local_pending: true,
    }])
    await this.enqueueMutation(
      LOCAL_MUTATION_TYPES.ADD_EXPENSE_CATEGORY_GROUP,
      familyId,
      { ...nextGroup, _sync: syncMeta },
      ['families'],
      syncMeta,
    )
    return {
      data: { ...nextGroup, is_default: false },
      message: '已添加',
      ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
    }
  }

  async updateExpenseCategoryGroupLocally(familyIdInput: string, key: string, labelInput: string) {
    const familyId = getFamilyId(familyIdInput)
    const family = await findLocalRow<any>('families', familyId)
    if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
    const label = String(labelInput || '').trim()
    if (!key || !label) throw new Error('参数不完整')
    if (PRESET_EXPENSE_CATEGORY_GROUPS.some(item => item.key === key)) throw new Error('预设分组不可编辑')

    const customGroups = Array.isArray(family.settings?.custom_expense_category_groups)
      ? family.settings.custom_expense_category_groups
      : []
    const current = customGroups.find((item: any) => item.key === key)
    if (!current) throw new Error('分组不存在')
    if (customGroups.some((item: any) => item.key !== key && item.label === label)) throw new Error('分组名称已存在')
    if (PRESET_EXPENSE_CATEGORY_GROUPS.some(item => item.label === label)) throw new Error('分组名称与预设分组重复')

    const now = getNow()
    const updatedGroups = customGroups.map((item: any) => item.key === key ? { ...item, label } : item)
    const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_EXPENSE_CATEGORY_GROUP),
    })

    await upsertLocalRows('families', [{
      ...family,
      settings: {
        ...(family.settings || {}),
        custom_expense_category_groups: updatedGroups,
      },
      updated_at: now,
      _local_pending: true,
    }])
    await this.enqueueMutation(
      LOCAL_MUTATION_TYPES.UPDATE_EXPENSE_CATEGORY_GROUP,
      familyId,
      { key, label, _sync: syncMeta },
      ['families'],
      syncMeta,
    )
    return {
      message: '已更新',
      ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
    }
  }

  async removeExpenseCategoryGroupLocally(familyIdInput: string, key: string) {
    const familyId = getFamilyId(familyIdInput)
    const family = await findLocalRow<any>('families', familyId)
    if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
    if (!key) throw new Error('请指定分组')
    if (PRESET_EXPENSE_CATEGORY_GROUPS.some(item => item.key === key)) throw new Error('预设分组不可删除')

    const customGroups = Array.isArray(family.settings?.custom_expense_category_groups)
      ? family.settings.custom_expense_category_groups
      : []
    const customCategories = normalizeExpenseCategories(family.settings?.custom_expense_categories || [], buildExpenseCategoryGroups(customGroups))
      .filter(category => !category.is_default)
    const current = customGroups.find((item: any) => item.key === key)
    if (!current) throw new Error('分组不存在')
    if (customCategories.some(category => category.parent_group === key)) throw new Error('请先迁移或删除该分组下的分类')

    const now = getNow()
    const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.REMOVE_EXPENSE_CATEGORY_GROUP),
    })

    await upsertLocalRows('families', [{
      ...family,
      settings: {
        ...(family.settings || {}),
        custom_expense_category_groups: customGroups.filter((item: any) => item.key !== key),
      },
      updated_at: now,
      _local_pending: true,
    }])
    await this.enqueueMutation(
      LOCAL_MUTATION_TYPES.REMOVE_EXPENSE_CATEGORY_GROUP,
      familyId,
      { key, _sync: syncMeta },
      ['families'],
      syncMeta,
    )
    return {
      message: '已删除',
      ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
    }
  }

  async addExpenseCategoryLocally(familyIdInput: string, nameInput: string, parentGroupInput: string) {
    const familyId = getFamilyId(familyIdInput)
    const family = await findLocalRow<any>('families', familyId)
    if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
    const name = normalizeExpenseCategoryName(nameInput)
    const parentGroup = String(parentGroupInput || '').trim()
    if (!name) throw new Error('请填写分类名称')
    if (!parentGroup) throw new Error('请指定分组')
    if (DEFAULT_EXPENSE_CATEGORIES.some(item => item.name === name)) throw new Error('该分类名称与预设分类重复')

    const customGroups = Array.isArray(family.settings?.custom_expense_category_groups)
      ? family.settings.custom_expense_category_groups
      : []
    const allGroups = buildExpenseCategoryGroups(customGroups)
    const categories = normalizeExpenseCategories(family.settings?.custom_expense_categories || [], allGroups)
    if (categories.some(category => category.name === name)) throw new Error('分类名称已存在')

    const customCategories = Array.isArray(family.settings?.custom_expense_categories)
      ? family.settings.custom_expense_categories
      : []
    const nextCategory = { name, parent_group: parentGroup }
    const now = getNow()
    const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.ADD_EXPENSE_CATEGORY),
    })

    await upsertLocalRows('families', [{
      ...family,
      settings: {
        ...(family.settings || {}),
        custom_expense_categories: [...customCategories, nextCategory],
      },
      updated_at: now,
      _local_pending: true,
    }])
    await this.enqueueMutation(
      LOCAL_MUTATION_TYPES.ADD_EXPENSE_CATEGORY,
      familyId,
      { name, parentGroup: parentGroup, _sync: syncMeta },
      ['families'],
      syncMeta,
    )
    return {
      message: '已添加',
      ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
    }
  }

  async updateExpenseCategoryLocally(familyIdInput: string, oldNameInput: string, newNameInput: string, parentGroupInput: string) {
    const familyId = getFamilyId(familyIdInput)
    const family = await findLocalRow<any>('families', familyId)
    if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
    const oldName = normalizeExpenseCategoryName(oldNameInput)
    const newName = normalizeExpenseCategoryName(newNameInput)
    const parentGroup = String(parentGroupInput || '').trim()
    if (!oldName || !newName || !parentGroup) throw new Error('参数不完整')
    if (DEFAULT_EXPENSE_CATEGORIES.some(item => item.name === oldName)) throw new Error('预设分类不可编辑')
    if (DEFAULT_EXPENSE_CATEGORIES.some(item => item.name === newName)) throw new Error('新名称与预设分类重复')

    const customGroups = Array.isArray(family.settings?.custom_expense_category_groups)
      ? family.settings.custom_expense_category_groups
      : []
    const allGroups = buildExpenseCategoryGroups(customGroups)
    const categories = normalizeExpenseCategories(family.settings?.custom_expense_categories || [], allGroups)
    const current = categories.find(category => !category.is_default && category.name === oldName)
    if (!current) throw new Error('分类不存在')
    if (oldName !== newName && categories.some(category => category.name === newName)) throw new Error('新名称已存在')

    const customCategories = Array.isArray(family.settings?.custom_expense_categories)
      ? family.settings.custom_expense_categories
      : []
    const nextCategories = customCategories.map((item: any) => item.name === oldName
      ? { ...item, name: newName, parent_group: parentGroup }
      : item)
    const affectedExpenses = oldName !== newName
      ? await localDb.query<any>('expenses', expense =>
        expense.family_id === familyId
        && !expense.deleted_at
        && expense.category === oldName,
      )
      : []
    const now = getNow()
    const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_EXPENSE_CATEGORY),
    })

    await localDb.transact(['families', 'expenses'], (tables) => {
      tables.families = (tables.families as any[]).map(row => row._id === familyId
        ? {
            ...row,
            settings: {
              ...(row.settings || {}),
              custom_expense_categories: nextCategories,
            },
            updated_at: now,
            _local_pending: true,
          }
        : row)
      if (oldName !== newName) {
        tables.expenses = (tables.expenses as any[]).map((expense) => {
          if (expense.family_id !== familyId || expense.deleted_at || expense.category !== oldName) return expense
          return {
            ...expense,
            category: newName,
            updated_at: now,
            _local_pending: true,
          }
        })
      }
    })
    await this.enqueueMutation(
      LOCAL_MUTATION_TYPES.UPDATE_EXPENSE_CATEGORY,
      familyId,
      { oldName, newName, parentGroup: parentGroup, _sync: syncMeta },
      ['families', 'expenses'],
      syncMeta,
    )
    return {
      message: '已更新',
      ...buildLocalAck(syncMeta, [
        { collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now },
        ...affectedExpenses.map(expense => ({
          collection: 'expenses' as BusinessCollectionName,
          id: expense._id,
          version: Number(expense.version || 0),
          updatedAt: now,
        })),
      ]),
    }
  }

  async removeExpenseCategoryLocally(familyIdInput: string, nameInput: string) {
    const familyId = getFamilyId(familyIdInput)
    const family = await findLocalRow<any>('families', familyId)
    if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
    const name = normalizeExpenseCategoryName(nameInput)
    if (!name) throw new Error('请指定分类名称')
    if (DEFAULT_EXPENSE_CATEGORIES.some(item => item.name === name)) throw new Error('预设分类不可删除')

    const customGroups = Array.isArray(family.settings?.custom_expense_category_groups)
      ? family.settings.custom_expense_category_groups
      : []
    const categories = normalizeExpenseCategories(family.settings?.custom_expense_categories || [], buildExpenseCategoryGroups(customGroups))
    if (!categories.some(category => !category.is_default && category.name === name)) throw new Error('分类不存在')

    const customCategories = Array.isArray(family.settings?.custom_expense_categories)
      ? family.settings.custom_expense_categories
      : []
    const now = getNow()
    const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
      clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.REMOVE_EXPENSE_CATEGORY),
    })

    await upsertLocalRows('families', [{
      ...family,
      settings: {
        ...(family.settings || {}),
        custom_expense_categories: customCategories.filter((item: any) => item.name !== name),
      },
      updated_at: now,
      _local_pending: true,
    }])
    await this.enqueueMutation(
      LOCAL_MUTATION_TYPES.REMOVE_EXPENSE_CATEGORY,
      familyId,
      { name, _sync: syncMeta },
      ['families'],
      syncMeta,
    )
    return {
      message: '已删除',
      ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
    }
  }

  async addMedicationProtocolLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    if (!data?.name) throw new Error('请填写方案名称')
    if (!data?.drug_name) throw new Error('请填写药品名称')
    const now = getNow()
    const protocolId = createStableEntityId('medication_protocol')
    const protocol = {
      _id: protocolId,
      name: data.name,
      drug_name: data.drug_name,
      dosage: data.dosage || null,
      dosage_unit: data.dosage_unit || null,
      method: data.method || null,
      frequency: data.frequency || null,
      duration_days: data.duration_days || null,
      notes: data.notes || null,
      family_id: familyId,
      created_by: '',
      deleted_at: null,
      version: 0,
      created_at: now,
      updated_at: now,
      _local_pending: true,
    }
    const syncMeta = buildSyncMeta({}, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.ADD_MEDICATION_PROTOCOL),
      clientEntityIds: { medication_protocols: protocolId },
    })
    await upsertLocalRows('medication_protocols', [protocol])
    await this.enqueueMutation(HOME_MUTATION_TYPES.ADD_MEDICATION_PROTOCOL, familyId, { ...data, _sync: syncMeta }, ['medication_protocols'], syncMeta)
    return {
      data: { protocolId },
      ...buildLocalAck(syncMeta, [{ collection: 'medication_protocols', id: protocolId, version: 0, updatedAt: now }]),
    }
  }

  async removeMedicationProtocolLocally(familyIdInput: string, protocolId: string) {
    const familyId = getFamilyId(familyIdInput)
    const protocol = await findLocalRow<any>('medication_protocols', protocolId)
    if (!protocol || protocol.family_id !== familyId) throw new Error('方案不存在')
    const now = getNow()
    const syncMeta = buildSyncMeta({ [protocolId]: Number(protocol.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.REMOVE_MEDICATION_PROTOCOL),
    })
    await upsertLocalRows('medication_protocols', [{
      ...protocol,
      deleted_at: now,
      updated_at: now,
      _local_pending: true,
    }])
    await this.enqueueMutation(HOME_MUTATION_TYPES.REMOVE_MEDICATION_PROTOCOL, familyId, { id: protocolId, _sync: syncMeta }, ['medication_protocols'], syncMeta)
    return {
      message: '已删除',
      ...buildLocalAck(syncMeta, [{ collection: 'medication_protocols', id: protocolId, version: Number(protocol.version || 0), updatedAt: now, deletedAt: now }]),
    }
  }

  async addWeightRecordLocally(familyIdInput: string, data: Record<string, any>) {
    const familyId = getFamilyId(familyIdInput)
    const dogId = String(data.dog_id || data.dogId || '').trim()
    if (!dogId) throw new Error('缺少犬只 ID')
    const weight = Number(data.weight)
    if (!Number.isFinite(weight) || weight <= 0) throw new Error('请输入有效体重')

    const dog = await findLocalRow<any>('dogs', dogId)
    if (!dog || dog.deleted_at) throw new Error('犬只未同步到本地，请联网刷新一次')

    const now = getNow()
    const weightId = createStableEntityId('dog_weight')
    const recordDate = Number(data.date || now)
    const weightRecord = {
      _id: weightId,
      family_id: familyId,
      dog_id: dogId,
      weight,
      date: recordDate,
      notes: data.notes || null,
      deleted_at: null,
      version: 0,
      created_at: now,
      updated_at: now,
      _local_pending: true,
    }

    const existingWeights = await localDb.query<any>('dog_weights', row => row.family_id === familyId && row.dog_id === dogId)
    const latestWeightRecord = [...existingWeights, weightRecord].sort((left, right) => {
      if (right.date !== left.date) return right.date - left.date
      return (right.created_at || 0) - (left.created_at || 0)
    })[0]

    const syncMeta = buildSyncMeta({ [dogId]: Number(dog.version || 0) }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.ADD_DOG_WEIGHT),
      clientEntityIds: { dog_weights: weightId },
    })

    await runLocalMutation(['dog_weights', 'dogs'], (tables) => {
      tables.dog_weights = [...(tables.dog_weights as any[]), weightRecord]
      tables.dogs = (tables.dogs as any[]).map(row => row._id === dogId
        ? {
            ...row,
            latest_weight: latestWeightRecord?.weight || weight,
            updated_at: now,
          }
        : row)
    })

    await this.enqueueMutation(
      HOME_MUTATION_TYPES.ADD_DOG_WEIGHT,
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
    )

    return {
      message: '已保存',
      ...buildLocalAck(syncMeta, [
        { collection: 'dog_weights', id: weightId, version: 0, updatedAt: now },
        { collection: 'dogs', id: dogId, version: Number(dog.version || 0), updatedAt: now },
      ]),
    }
  }

  async completeTaskLocally(familyId: string, taskId: string, autoRecord = false) {
    const task = await localDb.findById<any>('tasks', taskId)
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
          cost: Number(task.details?.cost || 0) > 0 ? Number(task.details.cost) : null,
          notes: task.details?.notes || null,
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

    await localDb.transact(['tasks', 'health_records', 'expenses'], (tables) => {
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
            cost: record.cost,
            notes: record.notes,
            details: record.details || {},
            version: 0,
            created_at: now,
            updated_at: now,
            _local_pending: true,
          })
        })
        tables.health_records = nextRecords
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
        if (expenseRows.length > 0) {
          tables.expenses = [...(tables.expenses as any[]), ...expenseRows]
        }
      }
    })

    const payload = {
      taskId,
      autoRecord,
      _sync: syncMeta,
    }
    await this.enqueueMutation(HOME_MUTATION_TYPES.COMPLETE_TASK, familyId, payload, ['tasks', 'health_records', 'expenses'], syncMeta)
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
          expenseId: Number(task.details?.cost || 0) > 0 ? createStableEntityId('expense') : '',
          dogId: task.dog_id,
          dogName: task.dog_name,
          type: task.type,
          date: now,
          cost: Number(task.details?.cost || 0) > 0 ? Number(task.details.cost) : null,
          notes: task.details?.notes || null,
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

    await localDb.transact(['tasks', 'health_records', 'expenses'], (tables) => {
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
            cost: record.cost,
            notes: record.notes,
            details: record.details || {},
            version: 0,
            created_at: now,
            updated_at: now,
            _local_pending: true,
          })),
        ]
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
        if (expenseRows.length > 0) {
          tables.expenses = [...(tables.expenses as any[]), ...expenseRows]
        }
      }
    })

    const payload = {
      taskIds: pendingTasks.map(task => task._id),
      autoRecord,
      _sync: syncMeta,
    }
    await this.enqueueMutation(HOME_MUTATION_TYPES.BATCH_COMPLETE_TASK, familyId, payload, ['tasks', 'health_records', 'expenses'], syncMeta)
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
    const medicationPatches = activeRows.map((row) => {
      const today = startOfDay(now)
      const startDate = startOfDay(row.actual_start_date || row.start_date || row.created_at || now)
      const currentDay = Math.floor((today - startDate) / 86400000) + 1
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

    await localDb.transact(['medication_tasks'], (tables) => {
      const patchById = new Map(medicationPatches.map(row => [row.id, row]))
      tables.medication_tasks = (tables.medication_tasks as any[]).map((row) => {
        const patch = patchById.get(row._id)
        if (!patch) return row
        return {
          ...row,
          daily_doses: patch.nextDailyDoses,
          status: patch.allComplete ? '已完成' : row.status,
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
        completedMedicationTaskIds: medicationPatches.map(task => task.id),
        fullyCompletedMedicationTaskIds: medicationPatches.filter(task => task.allComplete).map(task => task.id),
      },
      syncMeta,
    }
  }

  async updateHealthRecordLocally(familyId: string, data: Record<string, any>) {
    const recordId = String(data.id || '').trim()
    if (!recordId) throw new Error('缺少记录 ID')
    const record = await findLocalRow<any>('health_records', recordId)
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
    const linkedExpenses = await localDb.query<any>('expenses', row =>
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
    const linkedExpenseIds = new Set(linkedExpenses.map(expense => expense._id))
    const syncMeta = buildSyncMeta({
      [recordId]: Number(record.version || 0),
      ...linkedExpenses.reduce<Record<string, number>>((acc, row) => {
        acc[row._id] = Number(row.version || 0)
        return acc
      }, {}),
    }, {
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.UPDATE_HEALTH_RECORD),
      clientEntityIds: createdExpenseId ? { expenses: createdExpenseId } : undefined,
    })
    await localDb.transact(['health_records', 'expenses'], (tables) => {
      tables.health_records = (tables.health_records as any[]).map((row) => row._id === recordId ? nextRecord : row)
      if (linkedExpenseIds.size > 0) {
        tables.expenses = (tables.expenses as any[]).filter((row) => !linkedExpenseIds.has(row._id))
      }
      if (nextExpenseRows.length > 0) {
        tables.expenses = [...(tables.expenses as any[]), ...nextExpenseRows]
      }
    })
    await this.enqueueMutation(
      HOME_MUTATION_TYPES.UPDATE_HEALTH_RECORD,
      familyId,
      { ...data, id: recordId, _sync: syncMeta },
      ['health_records', 'expenses'],
      syncMeta,
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

  async deleteHealthRecordLocally(familyId: string, recordIdInput: string) {
    const recordId = String(recordIdInput || '').trim()
    if (!recordId) throw new Error('缺少记录 ID')
    const record = await findLocalRow<any>('health_records', recordId)
    if (!record || record.family_id !== familyId || record.deleted_at) throw new Error('记录不存在')

    const linkedReminderTasks = await localDb.query<any>('tasks', row =>
      row.family_id === familyId
      && row.source_record_id === recordId
      && row.status === 'pending',
    )
    const linkedExpenses = await localDb.query<any>('expenses', row =>
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
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.DELETE_HEALTH_RECORD),
    })

    const linkedTaskIdSet = new Set(linkedReminderTasks.map(row => row._id))
    const linkedExpenseIdSet = new Set(linkedExpenses.map(row => row._id))
    await localDb.transact(['health_records', 'tasks', 'expenses'], (tables) => {
      tables.health_records = (tables.health_records as any[]).map((row) => row._id === recordId
        ? {
            ...row,
            deleted_at: now,
            updated_at: now,
            _local_pending: true,
          }
        : row)
      tables.tasks = (tables.tasks as any[]).map((row) => linkedTaskIdSet.has(row._id)
        ? {
            ...row,
            status: 'cancelled',
            updated_at: now,
            _local_pending: true,
          }
        : row)
      if (linkedExpenseIdSet.size > 0) {
        tables.expenses = (tables.expenses as any[]).filter((row) => !linkedExpenseIdSet.has(row._id))
      }
    })

    await this.enqueueMutation(
      HOME_MUTATION_TYPES.DELETE_HEALTH_RECORD,
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

  async endMedicationLocally(familyId: string, medicationTaskId: string, data: Record<string, any> = {}) {
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
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.END_MEDICATION),
    })

    await localDb.transact(['medication_tasks', 'health_records', 'tasks'], (tables) => {
      tables.medication_tasks = (tables.medication_tasks as any[]).map((row) => row._id === medicationTaskId
        ? { ...row, status: '已取消', updated_at: now, _local_pending: true }
        : row)
      if (shouldUpdateIllness && linkedIllness) {
        tables.health_records = (tables.health_records as any[]).map((row) => row._id === linkedIllness._id
          ? {
              ...row,
              details: { ...(row.details || {}), treatment_status: nextIllnessStatus },
              updated_at: now,
              _local_pending: true,
            }
          : row)
      }
      const pendingTaskIdSet = new Set(pendingDailyTasks.map(row => row._id))
      tables.tasks = (tables.tasks as any[]).map((row) => pendingTaskIdSet.has(row._id)
        ? { ...row, status: 'cancelled', updated_at: now, _local_pending: true }
        : row)
    })

    await this.enqueueMutation(
      HOME_MUTATION_TYPES.END_MEDICATION,
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

  async cleanupDuplicateIllnessesLocally(familyId: string, dogId?: string) {
    const illnessRows = await localDb.query<any>('health_records', row =>
      row.family_id === familyId
      && row.type === 'illness'
      && !row.deleted_at
      && (!dogId || row.dog_id === dogId),
    )
    const activeRows = illnessRows.filter((row) => String(row.details?.treatment_status || '观察中') !== '已康复')
    const groups = new Map<string, any[]>()

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

    const affectedTasks = await localDb.query<any>('tasks', row =>
      row.family_id === familyId
      && duplicateIds.has(row.source_record_id),
    )
    await localDb.transact(['health_records', 'tasks'], (tables) => {
      tables.tasks = (tables.tasks as any[]).map((row) => {
        const keeperId = duplicateToKeeper.get(row.source_record_id)
        return keeperId
          ? { ...row, source_record_id: keeperId, updated_at: now, _local_pending: true }
          : row
      })
      tables.health_records = (tables.health_records as any[]).map((row) => duplicateIds.has(row._id)
        ? {
            ...row,
            details: {
              ...(row.details || {}),
              treatment_status: '已康复',
              merged_into_record_id: duplicateToKeeper.get(row._id) || null,
              merge_reason: 'duplicate_active_condition',
            },
            updated_at: now,
            _local_pending: true,
          }
        : row)
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
    await this.enqueueMutation(
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

  async endMedicationByDogLocally(familyId: string, dogId: string) {
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
      clientMutationId: createClientMutationId(HOME_MUTATION_TYPES.END_MEDICATION_BY_DOG),
    })

    await localDb.transact(['medication_tasks', 'tasks'], (tables) => {
      const targetIds = new Set(rows.map(row => row._id))
      tables.medication_tasks = (tables.medication_tasks as any[]).map((row) => targetIds.has(row._id)
        ? {
            ...row,
            status: '已取消',
            updated_at: now,
          }
        : row)
      const pendingTaskIds = new Set(pendingDailyTasks.map(row => row._id))
      tables.tasks = (tables.tasks as any[]).map((row) => pendingTaskIds.has(row._id)
        ? { ...row, status: 'cancelled', updated_at: now, _local_pending: true }
        : row)
    })

    await this.enqueueMutation(
      HOME_MUTATION_TYPES.END_MEDICATION_BY_DOG,
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
}

export const localSyncRuntime = new LocalSyncRuntime()
