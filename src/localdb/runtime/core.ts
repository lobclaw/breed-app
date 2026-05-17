import { localDb } from '@/localdb/db'
import { CORE_SYNC_COLLECTIONS, HOME_SYNC_COLLECTIONS } from '@/localdb/collections'
import { createPendingLocalOperationLog } from '@/localdb/local-operation-log'
import {
  buildHomeSnapshot,
  clearHomeEntitiesCache,
  getMemoizedHomeCards,
  getMemoizedHomeDateCounts,
  getMemoizedHomeWeekCards,
  materializeBreedingMilestonesForFamily,
} from '@/localdb/runtime/home-snapshot'
import { uploadPendingAttachmentsForFamily } from '@/localdb/runtime/attachments'
import { formatPullFailures, pullCollection, pullCollectionsBatch } from '@/localdb/runtime/pull'
import {
  applySyncAck,
  buildOutboxMutation,
  recoverStaleProcessingOutbox,
  rebaseMutationForConflict,
  updateOutboxStatus,
  upsertOutboxMutation,
} from '@/localdb/runtime/outbox'
import * as agentMutations from '@/localdb/runtime/agent-mutations'
import * as breedingMutations from '@/localdb/runtime/breeding-mutations'
import * as dogMutations from '@/localdb/runtime/dog-mutations'
import * as financeMutations from '@/localdb/runtime/finance-mutations'
import * as healthMutations from '@/localdb/runtime/health-mutations'
import * as litterMutations from '@/localdb/runtime/litter-mutations'
import * as medicationMutations from '@/localdb/runtime/medication-mutations'
import * as saleMutations from '@/localdb/runtime/sale-mutations'
import * as settingsMutations from '@/localdb/runtime/settings-mutations'
import * as taskMutations from '@/localdb/runtime/task-mutations'
import type { AgentMutationPayload } from '@/localdb/runtime/agent-mutations'
import type { BreedingMutationPayload } from '@/localdb/runtime/breeding-mutations'
import type {
  CreateDogPayload,
  DogDispositionPayload,
  DogWeightPayload,
  UpdateDogPayload,
} from '@/localdb/runtime/dog-mutations'
import type { ExpenseMutationPayload, IncomeMutationPayload } from '@/localdb/runtime/finance-mutations'
import type { BatchAddHealthRecordsPayload, UpdateHealthRecordPayload } from '@/localdb/runtime/health-mutations'
import type { AddBirthRecordPayload, AddPuppyToLitterPayload, UpdateLitterPayload } from '@/localdb/runtime/litter-mutations'
import type { BatchStartMedicationPayload, EndMedicationPayload } from '@/localdb/runtime/medication-mutations'
import type {
  CancelSalePayload,
  CompleteSalePayload,
  CreateSaleRecordPayload,
  ReceiveSaleDepositPayload,
  SettleSalePayload,
  UpdateSaleModePayload,
} from '@/localdb/runtime/sale-mutations'
import type { CareRuleInput, FamilySettingsPatch, MedicationProtocolInput } from '@/localdb/runtime/settings-mutations'
import type { BatchCreateManualTasksPayload } from '@/localdb/runtime/task-mutations'
import { getFamilyId, getNow } from '@/localdb/runtime/mutation-helpers'
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
  resolveSyncScopeForRoute,
  type ResolvedSyncScope,
} from '@/localdb/scope-registry'
import { syncIssueService } from '@/localdb/sync-issues'
import { getSyncStatus } from '@/localdb/sync-status'
import { cloudCall } from '@/composables/useCloudCall'
import type {
  BusinessCollectionName,
  LocalCollectionName,
  MutationStatus,
  LocalOperationLogRow,
  OutboxMutation,
  SyncAckPayload,
  SyncConflictRow,
  SyncMetadata,
  SyncStateRow,
} from '@/localdb/types'
import {
  buildFamilyMetaKey,
  buildScopeMetaKey,
  createResolvedScope,
  hasCollectionsData,
  toScopeFreshness,
  type StoredScopeFreshness,
  type SyncScopeResult,
} from '@/localdb/runtime/scope-sync'

const ACTIVE_SCOPE_META_KEY = 'sync:active-scope'
const CORE_SYNC_META_KEY = 'sync:core'
const CORE_SYNC_INTERVAL_MS = 10 * 60 * 1000

const HOME_MUTATION_TYPES = LOCAL_MUTATION_TYPES
type HomeMutationType = LocalMutationType
type HomeMutationPayload = LocalMutationPayload
const MAX_CONFLICT_REBASE_ATTEMPTS = 3
const PENDING_UPLOAD_COLLECTIONS = ['expenses', 'incomes', 'health_records', 'breeding_records', 'dogs'] as const satisfies readonly BusinessCollectionName[]
type PendingUploadCollectionName = typeof PENDING_UPLOAD_COLLECTIONS[number]
const PENDING_UPLOAD_COLLECTION_SET = new Set<BusinessCollectionName>(PENDING_UPLOAD_COLLECTIONS)
const PENDING_UPLOAD_ID_KEYS: Record<PendingUploadCollectionName, string[]> = {
  expenses: ['id', 'expenseId', 'expense_id'],
  incomes: ['id', 'incomeId', 'income_id'],
  health_records: ['id', 'recordId', 'record_id', 'healthRecordId', 'health_record_id'],
  breeding_records: ['id', 'recordId', 'record_id', 'breedingRecordId', 'breeding_record_id'],
  dogs: ['id', 'dogId', 'dog_id'],
}

type RuntimeRouteQuery = Record<string, unknown>
type NetworkTypeResult = { networkType?: string }
type RuntimeGlobal = typeof globalThis & { __DEV__?: boolean }

interface DirectCompleteSalePayload extends CreateSaleRecordPayload, CompleteSalePayload {
  agent_id?: string | null
  agent_name?: string | null
}

function isOnlineError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  return /network|timeout|offline|fail/i.test(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeIdList(value: unknown) {
  const values = Array.isArray(value) ? value : [value]
  return values
    .map(item => String(item || '').trim())
    .filter(Boolean)
}

function collectPendingUploadRecordIds(collection: PendingUploadCollectionName, payload: unknown, syncMeta: SyncMetadata) {
  const ids = new Set<string>()
  normalizeIdList(syncMeta.clientEntityIds?.[collection]).forEach(id => ids.add(id))

  if (isRecord(payload)) {
    for (const key of PENDING_UPLOAD_ID_KEYS[collection]) {
      normalizeIdList(payload[key]).forEach(id => ids.add(id))
    }
  }

  return [...ids]
}

async function detectOnline() {
  try {
    const network = await new Promise<NetworkTypeResult>((resolve) => {
      uni.getNetworkType({
        success: result => resolve(result as NetworkTypeResult),
        fail: () => resolve({ networkType: 'unknown' }),
      })
    })
    return network?.networkType !== 'none'
  } catch {
    return true
  }
}

class LocalSyncRuntime {
  private started = false
  private processing = false
  private online = true
  private deferOutboxFlushDepth = 0
  private currentFamilyId = ''
  private activeScopeKey = ''
  private scopeSyncPromises = new Map<string, Promise<SyncScopeResult>>()
  private coreSyncPromises = new Map<string, Promise<void>>()
  private attachmentUploadPromises = new Map<string, Promise<{ uploaded: number }>>()

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

    const persistedActiveScope = await localDb.getLocalMeta<string>(buildFamilyMetaKey(ACTIVE_SCOPE_META_KEY, this.currentFamilyId))
    if (persistedActiveScope) {
      this.activeScopeKey = persistedActiveScope
    }
  }

  async resume(familyId: string) {
    if (!familyId) return
    this.setCurrentFamilyId(familyId)
    await this.flushOutbox(familyId)
    await this.syncActiveScope()
  }

  private logScope(scope: string, payload: Record<string, unknown>) {
    const devFlag = typeof globalThis !== 'undefined' ? (globalThis as RuntimeGlobal).__DEV__ : undefined
    if (devFlag !== true) return
    console.info('[local-sync]', scope, payload)
  }

  private async getStoredScopeFreshness(scopeKey: string, familyId = this.currentFamilyId, fallbackScope?: ResolvedSyncScope) {
    const scope = fallbackScope || createResolvedScope(scopeKey)
    const value = await localDb.getLocalMeta<StoredScopeFreshness>(buildScopeMetaKey(scopeKey, familyId))
    return toScopeFreshness(scope, value)
  }

  private async setStoredScopeFreshness(scope: ResolvedSyncScope, familyId: string, patch: Partial<StoredScopeFreshness>) {
    const current = await this.getStoredScopeFreshness(scope.key, familyId, scope)
    await localDb.upsertLocalMeta(buildScopeMetaKey(scope.key, familyId), {
      ...current,
      ...patch,
      scopeKey: scope.key,
      routeKey: scope.routeKey,
      routePath: scope.routePath,
      ttl_ms: scope.ttlMs,
      mode: scope.mode,
    } satisfies StoredScopeFreshness)
  }

  async setActiveScope(scopeKey: string) {
    if (!scopeKey) return
    this.activeScopeKey = scopeKey
    if (!this.currentFamilyId) return
    await localDb.upsertLocalMeta(buildFamilyMetaKey(ACTIVE_SCOPE_META_KEY, this.currentFamilyId), scopeKey)
  }

  setCurrentFamilyId(familyId: string) {
    const nextFamilyId = familyId || ''
    if (this.currentFamilyId !== nextFamilyId) {
      this.activeScopeKey = ''
      clearHomeEntitiesCache()
    }
    this.currentFamilyId = nextFamilyId
  }

  async setActiveScopeFromRoute(routePath: string, query: RuntimeRouteQuery = {}) {
    const resolved = resolveSyncScopeForRoute(routePath, query)
    if (!resolved) return null
    await this.setActiveScope(resolved.key)
    return resolved
  }

  async getActiveScope() {
    if (this.activeScopeKey) return this.activeScopeKey
    if (!this.currentFamilyId) return ''
    const persisted = await localDb.getLocalMeta<string>(buildFamilyMetaKey(ACTIVE_SCOPE_META_KEY, this.currentFamilyId))
    this.activeScopeKey = persisted || ''
    return this.activeScopeKey
  }

  async getScopeStatus(scopeKey: string) {
    const scope = createResolvedScope(scopeKey)
    const freshness = await this.getStoredScopeFreshness(scopeKey, this.currentFamilyId, scope)
    const familyId = this.currentFamilyId
    return {
      scopeKey,
      routeKey: scope.routeKey,
      mode: scope.mode,
      ttlMs: scope.ttlMs,
      collections: scope.collections,
      inFlight: this.scopeSyncPromises.has(`${familyId}:${scopeKey}`),
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
      await this.setStoredScopeFreshness(scope, familyId, {
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

    const scopePromiseKey = `${familyId}:${scope.key}`
    if (this.scopeSyncPromises.has(scopePromiseKey)) {
      this.logScope(scope.key, { skip: 'in-flight-dedupe' })
      return this.scopeSyncPromises.get(scopePromiseKey) || null
    }

    const freshness = await this.getStoredScopeFreshness(scope.key, familyId, scope)
    const now = getNow()
    if (!options.force && !options.skipTtl && !freshness.last_error && scope.ttlMs > 0 && freshness.last_synced_at > 0 && now - freshness.last_synced_at < scope.ttlMs) {
      const skipReason = options.reason || `ttl:${scope.ttlMs}`
      await this.setStoredScopeFreshness(scope, familyId, {
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
      const needsFullPull = Boolean(options.forceFull) || !(await hasCollectionsData(scope.collections, familyId))
      await this.flushOutbox(familyId)
      const { rowsByCollection, failures } = await pullCollectionsBatch(scope.collections, familyId, needsFullPull)
      const pulledCollections = scope.collections.filter(collection => Array.isArray(rowsByCollection[collection]))
      if (pulledCollections.includes('breeding_cycles') || pulledCollections.includes('breeding_records')) {
        await materializeBreedingMilestonesForFamily(familyId)
      }
      const syncedAt = getNow()
      const lastError = failures.length > 0 ? formatPullFailures(failures) : null
      await this.setStoredScopeFreshness(scope, familyId, failures.length > 0
        ? {
            last_error: lastError,
            last_skip_reason: null,
          }
        : {
            last_synced_at: syncedAt,
            last_full_sync_at: needsFullPull ? syncedAt : freshness.last_full_sync_at,
            last_error: null,
            last_skip_reason: null,
          })
      this.logScope(scope.key, {
        collections: scope.collections,
        pulledCollections,
        failures: failures.map(failure => failure.collection),
        force: Boolean(options.force),
        full: needsFullPull,
      })
      return {
        scopeKey: scope.key,
        routeKey: scope.routeKey,
        pulledCollections,
        skipped: false,
        skipReason: null,
        lastSyncedAt: failures.length > 0 ? freshness.last_synced_at : syncedAt,
        force: Boolean(options.force),
      } satisfies SyncScopeResult
    })().catch(async (error) => {
      await this.setStoredScopeFreshness(scope, familyId, {
        last_error: error instanceof Error ? error.message : String(error || '同步失败'),
        last_skip_reason: null,
      })
      throw error
    })

    this.scopeSyncPromises.set(scopePromiseKey, runningSync)

    try {
      return await runningSync
    } finally {
      this.scopeSyncPromises.delete(scopePromiseKey)
    }
  }

  async forceSyncScope(scopeKey: string) {
    return this.syncScope(scopeKey, { force: true, skipTtl: true })
  }

  async syncScopeFromRoute(routePath: string, query: RuntimeRouteQuery = {}, options: { force?: boolean } = {}) {
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

  async syncHome(familyId: string, options: { force?: boolean } = {}) {
    if (!familyId) return null
    this.setCurrentFamilyId(familyId)
    return this.syncScope('home', { force: options.force })
  }

  async syncCore(familyId: string, options: { force?: boolean; minIntervalMs?: number } = {}) {
    if (!familyId) return
    await this.init()
    this.setCurrentFamilyId(familyId)
    const minIntervalMs = options.minIntervalMs ?? CORE_SYNC_INTERVAL_MS
    const corePromiseKey = familyId
    const runningCoreSync = this.coreSyncPromises.get(corePromiseKey)
    if (!options.force && runningCoreSync) return runningCoreSync

    const meta = await localDb.getLocalMeta<{ last_synced_at?: number }>(buildFamilyMetaKey(CORE_SYNC_META_KEY, familyId))
    const lastSyncedAt = Number(meta?.last_synced_at || 0)
    if (!options.force && lastSyncedAt > 0 && getNow() - lastSyncedAt < minIntervalMs) {
      return
    }

    const coreSyncPromise = (async () => {
      await this.pullCollections(familyId, CORE_SYNC_COLLECTIONS, Boolean(options.force))
      await localDb.upsertLocalMeta(buildFamilyMetaKey(CORE_SYNC_META_KEY, familyId), {
        last_synced_at: getNow(),
      })
    })()
    this.coreSyncPromises.set(corePromiseKey, coreSyncPromise)

    try {
      await coreSyncPromise
    } finally {
      if (this.coreSyncPromises.get(corePromiseKey) === coreSyncPromise) {
        this.coreSyncPromises.delete(corePromiseKey)
      }
    }
  }

  async pullHomeCollections(familyId: string, forceFull = false) {
    this.setCurrentFamilyId(familyId)
    const { failures } = await pullCollectionsBatch(HOME_SYNC_COLLECTIONS, familyId, forceFull)
    if (failures.length > 0) {
      throw new Error(formatPullFailures(failures))
    }
  }

  async pullCollections(familyId: string, collections: BusinessCollectionName[], forceFull = false) {
    this.setCurrentFamilyId(familyId)
    const uniqueCollections = [...new Set(collections)]
    const { rowsByCollection, failures } = await pullCollectionsBatch(uniqueCollections, familyId, forceFull)
    if (failures.length > 0) {
      throw new Error(formatPullFailures(failures))
    }
    return uniqueCollections.filter(collection => Array.isArray(rowsByCollection[collection])).length
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
      localDb.getTable('sync_conflicts'),
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

  async uploadPendingAttachments(familyIdInput: string) {
    const familyId = getFamilyId(familyIdInput || this.currentFamilyId)
    const running = this.attachmentUploadPromises.get(familyId)
    if (running) return running
    const uploadPromise = uploadPendingAttachmentsForFamily(familyId)
    this.attachmentUploadPromises.set(familyId, uploadPromise)
    try {
      return await uploadPromise
    } finally {
      this.attachmentUploadPromises.delete(familyId)
    }
  }

  async retryFailedOutboxNow(familyIdInput: string) {
    const familyId = getFamilyId(familyIdInput || this.currentFamilyId)
    await this.init()
    this.setCurrentFamilyId(familyId)
    this.online = await detectOnline()
    if (!this.online) throw new Error('当前网络不可用')

    const now = getNow()
    const [outbox, conflicts, logs] = await Promise.all([
      localDb.getOutbox(),
      localDb.getReadonlyTable<SyncConflictRow>('sync_conflicts'),
      localDb.getRowsByFamilyReadonly<LocalOperationLogRow>('local_operation_logs', familyId),
    ])
    const retryingMutations = outbox.filter(
      mutation => mutation.family_id === familyId && (mutation.status === 'failed' || mutation.status === 'conflict'),
    )
    const retryingIds = new Set(retryingMutations.map(mutation => mutation.client_mutation_id).filter(Boolean))
    const conflictMap = new Map(
      conflicts
        .filter(conflict => conflict.status === 'open')
        .map(conflict => [String(conflict.client_mutation_id || ''), conflict]),
    )
    const retryingConflicts = conflicts.filter(conflict => retryingIds.has(String(conflict.client_mutation_id || '')))
    const retryingLogs = logs.filter(log => retryingIds.has(log.client_mutation_id))

    await localDb.transactRows(['outbox_mutations', 'local_operation_logs', 'sync_conflicts'] as const, async (rows) => {
      for (const mutation of retryingMutations) {
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
        await rows.updateRow('outbox_mutations', mutation._id, row => ({
          ...row,
          payload,
          status: 'pending',
          next_retry_at: 0,
          last_error: null,
          updated_at: now,
        }))
      }

      for (const conflict of retryingConflicts) {
        await rows.updateRow('sync_conflicts', conflict._id, row => ({
          ...row,
          status: 'retrying',
          updated_at: now,
        }))
      }

      for (const log of retryingLogs) {
        await rows.updateRow('local_operation_logs', log._id, row => ({
          ...row,
          status: 'pending',
          last_error: null,
          updated_at: now,
        }))
      }
    })

    await this.flushOutbox(familyId)
    await this.syncActiveScope({ force: true })
    return this.getSyncStatus()
  }

  async syncPendingAttachmentsNow(familyIdInput: string) {
    const familyId = getFamilyId(familyIdInput || this.currentFamilyId)
    await this.init()
    this.setCurrentFamilyId(familyId)
    this.online = await detectOnline()
    if (!this.online) throw new Error('当前网络不可用')

    await this.uploadPendingAttachments(familyId)
    await this.flushOutbox(familyId)
    await this.syncActiveScope({ force: true })
    return this.getSyncStatus()
  }

  async createDogLocally(familyIdInput: string, data: CreateDogPayload) {
    return dogMutations.createDogLocally(this, familyIdInput, data)
  }

  async updateDogLocally(familyIdInput: string, dogId: string, data: UpdateDogPayload) {
    return dogMutations.updateDogLocally(this, familyIdInput, dogId, data)
  }

  async updateDogNameLocally(familyIdInput: string, dogId: string, name: string) {
    return dogMutations.updateDogNameLocally(this, familyIdInput, dogId, name)
  }

  async changeDogDispositionLocally(familyIdInput: string, dogId: string, newDisposition: string, data: DogDispositionPayload = {}) {
    return dogMutations.changeDogDispositionLocally(this, familyIdInput, dogId, newDisposition, data)
  }

  async upgradePuppyToBreederLocally(familyIdInput: string, dogId: string) {
    return dogMutations.upgradePuppyToBreederLocally(this, familyIdInput, dogId)
  }

  async softDeleteDogLocally(familyIdInput: string, dogId: string) {
    return dogMutations.softDeleteDogLocally(this, familyIdInput, dogId)
  }

  async restoreRecycleItemLocally(familyIdInput: string, type: string, id: string) {
    return dogMutations.restoreRecycleItemLocally(this, familyIdInput, type, id)
  }

  async permanentDeleteRecycleItemLocally(familyIdInput: string, type: string, id: string) {
    return dogMutations.permanentDeleteRecycleItemLocally(this, familyIdInput, type, id)
  }

  async ensureHomeData(familyId: string) {
    await this.init()
    this.setCurrentFamilyId(familyId)

    const hasHomeData = await hasCollectionsData(HOME_SYNC_COLLECTIONS, familyId)
    if (hasHomeData) return
    await this.syncScope('home', { force: true, forceFull: true })
  }

  async getHomeCards(familyIdInput = '') {
    const familyId = familyIdInput || this.currentFamilyId
    return getMemoizedHomeCards(familyId, Date.now())
  }

  async getDateCounts(startDate: number, endDate: number, familyIdInput = '') {
    const familyId = familyIdInput || this.currentFamilyId
    return getMemoizedHomeDateCounts(familyId, startDate, endDate)
  }

  async getWeekCards(startDate: number, endDate: number, familyIdInput = '') {
    const familyId = familyIdInput || this.currentFamilyId
    return getMemoizedHomeWeekCards(familyId, startDate, endDate, Date.now())
  }

  async getHomeSnapshot(options: {
    familyId?: string
    dateCountsStartDate: number
    dateCountsEndDate: number
    weekStartDate: number
    weekEndDate: number
    now?: number
  }) {
    const familyId = options.familyId || this.currentFamilyId
    const now = options.now || Date.now()
    return buildHomeSnapshot({ ...options, familyId, now })
  }

  async enqueueMutation(type: HomeMutationType, familyId: string, payload: HomeMutationPayload, collectionScope: BusinessCollectionName[], syncMeta: SyncMetadata, logSnapshot: Record<string, unknown> = {}) {
    const mutation = buildOutboxMutation(type, familyId, payload, collectionScope, syncMeta.clientMutationId)
    await upsertOutboxMutation(mutation)
    const localOperationLog = await createPendingLocalOperationLog(type, familyId, payload, syncMeta, logSnapshot)
    if (localOperationLog) {
      await localDb.upsertRows('local_operation_logs', [localOperationLog])
    }
    await this.refreshPendingUploadIssuesForMutation(collectionScope, familyId, payload, syncMeta)
    if (this.online && this.deferOutboxFlushDepth === 0) {
      void this.flushOutbox(familyId)
    }
  }

  private async refreshPendingUploadIssuesForMutation(
    collectionScope: BusinessCollectionName[],
    familyId: string,
    payload: HomeMutationPayload,
    syncMeta: SyncMetadata,
  ) {
    if (!familyId) return
    const pendingCollections = collectionScope.filter(
      (collection): collection is PendingUploadCollectionName => PENDING_UPLOAD_COLLECTION_SET.has(collection),
    )
    await Promise.all(pendingCollections.map((collection) => {
      const recordIds = collectPendingUploadRecordIds(collection, payload, syncMeta)
      if (!recordIds.length) return Promise.resolve()
      return syncIssueService.refreshPendingUploadIssuesForRows(collection, familyId, recordIds)
    }))
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
      await recoverStaleProcessingOutbox(familyId)
      try {
        await this.uploadPendingAttachments(familyId)
      } catch (error) {
        console.warn('附件上传失败，已保留待上传状态', error)
        return
      }
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


  async batchCreateManualTasksLocally(familyIdInput: string, data: BatchCreateManualTasksPayload) {
    return taskMutations.batchCreateManualTasksLocally(this, familyIdInput, data)
  }

  async batchAddHealthRecordsLocally(familyIdInput: string, data: BatchAddHealthRecordsPayload) {
    return healthMutations.batchAddHealthRecordsLocally(this, familyIdInput, data)
  }

  async batchStartMedicationLocally(familyIdInput: string, data: BatchStartMedicationPayload) {
    return medicationMutations.batchStartMedicationLocally(this, familyIdInput, data)
  }


  async addBreedingRecordLocally(familyIdInput: string, data: BreedingMutationPayload) {
    return breedingMutations.addBreedingRecordLocally(this, familyIdInput, data)
  }

  async batchAddBreedingRecordsLocally(familyId: string, data: BreedingMutationPayload) {
    return breedingMutations.batchAddBreedingRecordsLocally(this, familyId, data)
  }

  async addBirthRecordLocally(familyIdInput: string, data: AddBirthRecordPayload) {
    return litterMutations.addBirthRecordLocally(this, familyIdInput, data)
  }

  async updateBreedingRecordLocally(familyIdInput: string, data: BreedingMutationPayload) {
    return breedingMutations.updateBreedingRecordLocally(this, familyIdInput, data)
  }

  async deleteBreedingRecordLocally(familyIdInput: string, recordIdInput: string) {
    return breedingMutations.deleteBreedingRecordLocally(this, familyIdInput, recordIdInput)
  }

  async closeBreedingCycleLocally(familyIdInput: string, cycleIdInput: string, reasonInput: string) {
    return breedingMutations.closeBreedingCycleLocally(this, familyIdInput, cycleIdInput, reasonInput)
  }

  async addPuppyToLitterLocally(familyIdInput: string, litterIdInput: string, puppyData: AddPuppyToLitterPayload) {
    return litterMutations.addPuppyToLitterLocally(this, familyIdInput, litterIdInput, puppyData)
  }

  async updateLitterLocally(familyIdInput: string, litterIdInput: string, data: UpdateLitterPayload) {
    return litterMutations.updateLitterLocally(this, familyIdInput, litterIdInput, data)
  }

  async updateLitterBirthDateLocally(familyIdInput: string, litterIdInput: string, birthDate: number) {
    return litterMutations.updateLitterBirthDateLocally(this, familyIdInput, litterIdInput, birthDate)
  }

  async confirmWeaningLocally(familyIdInput: string, litterIdInput: string) {
    return litterMutations.confirmWeaningLocally(this, familyIdInput, litterIdInput)
  }

  async addExpenseLocally(familyIdInput: string, data: ExpenseMutationPayload) {
    return financeMutations.addExpenseLocally(this, familyIdInput, data)
  }

  async addIncomeLocally(familyIdInput: string, data: IncomeMutationPayload) {
    return financeMutations.addIncomeLocally(this, familyIdInput, data)
  }

  async updateExpenseLocally(familyIdInput: string, data: ExpenseMutationPayload) {
    return financeMutations.updateExpenseLocally(this, familyIdInput, data)
  }

  async updateIncomeLocally(familyIdInput: string, data: IncomeMutationPayload) {
    return financeMutations.updateIncomeLocally(this, familyIdInput, data)
  }

  async deleteExpenseLocally(familyIdInput: string, expenseIdInput: string) {
    return financeMutations.deleteExpenseLocally(this, familyIdInput, expenseIdInput)
  }

  async deleteIncomeLocally(familyIdInput: string, incomeIdInput: string) {
    return financeMutations.deleteIncomeLocally(this, familyIdInput, incomeIdInput)
  }

  async createSaleRecordLocally(familyIdInput: string, data: CreateSaleRecordPayload) {
    return saleMutations.createSaleRecordLocally(this, familyIdInput, data)
  }

  async directCompleteSaleLocally(familyIdInput: string, data: DirectCompleteSalePayload) {
    const familyId = getFamilyId(familyIdInput)
    const hasReceivedAmount = data.received_amount !== '' && data.received_amount != null
    const receivedAmount = hasReceivedAmount ? Number(data.received_amount) : null
    if (hasReceivedAmount && (!Number.isFinite(receivedAmount) || Number(receivedAmount) <= 0)) {
      throw new Error('请填写有效的到手价')
    }

    this.deferOutboxFlushDepth += 1
    try {
      const createResult = await this.createSaleRecordLocally(familyId, {
        dog_id: data.dog_id,
        sale_mode: data.sale_mode,
        floor_price: data.floor_price ?? null,
        buyer_info: data.buyer_info || null,
        notes: data.notes || null,
      })
      const saleId = createResult?.data?.saleId
      if (!saleId) throw new Error('销售记录创建失败')

      const completeResult = await this.completeSaleLocally(familyId, saleId, {
        received_amount: receivedAmount,
        agreed_price: data.agreed_price ?? null,
        buyer_info: data.buyer_info || null,
        sale_mode: data.sale_mode,
        platform: data.platform || null,
        seller_agent_id: data.seller_agent_id || data.agent_id || null,
        seller_agent_name: data.seller_agent_name || data.agent_name || null,
        agent_id: data.agent_id || null,
        agent_name: data.agent_name || null,
        delivery_date: data.delivery_date || null,
        date: data.date || getNow(),
      })

      return {
        ...completeResult,
        data: { saleId },
      }
    } finally {
      this.deferOutboxFlushDepth = Math.max(0, this.deferOutboxFlushDepth - 1)
      if (this.online && this.deferOutboxFlushDepth === 0) {
        void this.flushOutbox(familyId)
      }
    }
  }

  async updateSaleModeLocally(familyIdInput: string, saleId: string, data: UpdateSaleModePayload) {
    return saleMutations.updateSaleModeLocally(this, familyIdInput, saleId, data)
  }

  async receiveSaleDepositLocally(familyIdInput: string, saleId: string, data: ReceiveSaleDepositPayload) {
    return saleMutations.receiveSaleDepositLocally(this, familyIdInput, saleId, data)
  }

  async completeSaleLocally(familyIdInput: string, saleId: string, data: CompleteSalePayload) {
    return saleMutations.completeSaleLocally(this, familyIdInput, saleId, data)
  }

  async settleSaleLocally(familyIdInput: string, saleId: string, data: SettleSalePayload) {
    return saleMutations.settleSaleLocally(this, familyIdInput, saleId, data)
  }

  async cancelSaleLocally(familyIdInput: string, saleId: string, data: CancelSalePayload) {
    return saleMutations.cancelSaleLocally(this, familyIdInput, saleId, data)
  }

  async addAgentLocally(familyIdInput: string, data: AgentMutationPayload) {
    return agentMutations.addAgentLocally(this, familyIdInput, data)
  }

  async updateAgentLocally(familyIdInput: string, agentId: string, data: AgentMutationPayload) {
    return agentMutations.updateAgentLocally(this, familyIdInput, agentId, data)
  }

  async removeAgentLocally(familyIdInput: string, agentId: string) {
    return agentMutations.removeAgentLocally(this, familyIdInput, agentId)
  }

  async updateFamilySettingsLocally(familyIdInput: string, settings: FamilySettingsPatch) {
    return settingsMutations.updateFamilySettingsLocally(this, familyIdInput, settings)
  }

  async addCareRuleLocally(familyIdInput: string, rule: CareRuleInput) {
    return settingsMutations.addCareRuleLocally(this, familyIdInput, rule)
  }

  async removeCareRuleLocally(familyIdInput: string, index: number) {
    return settingsMutations.removeCareRuleLocally(this, familyIdInput, index)
  }

  async updateNicknameLocally(familyIdInput: string, userId: string, nickname: string) {
    return settingsMutations.updateNicknameLocally(this, familyIdInput, userId, nickname)
  }

  async addExpenseCategoryGroupLocally(familyIdInput: string, labelInput: string) {
    return settingsMutations.addExpenseCategoryGroupLocally(this, familyIdInput, labelInput)
  }

  async updateExpenseCategoryGroupLocally(familyIdInput: string, key: string, labelInput: string) {
    return settingsMutations.updateExpenseCategoryGroupLocally(this, familyIdInput, key, labelInput)
  }

  async removeExpenseCategoryGroupLocally(familyIdInput: string, key: string) {
    return settingsMutations.removeExpenseCategoryGroupLocally(this, familyIdInput, key)
  }

  async addExpenseCategoryLocally(familyIdInput: string, nameInput: string, parentGroupInput: string) {
    return settingsMutations.addExpenseCategoryLocally(this, familyIdInput, nameInput, parentGroupInput)
  }

  async updateExpenseCategoryLocally(familyIdInput: string, oldNameInput: string, newNameInput: string, parentGroupInput: string) {
    return settingsMutations.updateExpenseCategoryLocally(this, familyIdInput, oldNameInput, newNameInput, parentGroupInput)
  }

  async removeExpenseCategoryLocally(familyIdInput: string, nameInput: string) {
    return settingsMutations.removeExpenseCategoryLocally(this, familyIdInput, nameInput)
  }

  async addMedicationProtocolLocally(familyIdInput: string, data: MedicationProtocolInput) {
    return settingsMutations.addMedicationProtocolLocally(this, familyIdInput, data)
  }

  async removeMedicationProtocolLocally(familyIdInput: string, protocolId: string) {
    return settingsMutations.removeMedicationProtocolLocally(this, familyIdInput, protocolId)
  }

  async updateMedicationProtocolLocally(familyIdInput: string, protocolId: string, data: MedicationProtocolInput) {
    return settingsMutations.updateMedicationProtocolLocally(this, familyIdInput, protocolId, data)
  }


  async addWeightRecordLocally(familyIdInput: string, data: DogWeightPayload) {
    return dogMutations.addWeightRecordLocally(this, familyIdInput, data)
  }

  async completeTaskLocally(familyId: string, taskId: string, autoRecord = false) {
    return taskMutations.completeTaskLocally(this, familyId, taskId, autoRecord)
  }

  async batchCompleteTasksLocally(familyId: string, taskIds: string[], autoRecord = false) {
    return taskMutations.batchCompleteTasksLocally(this, familyId, taskIds, autoRecord)
  }

  async postponeTasksLocally(familyId: string, taskIds: string[], newDate: number) {
    return taskMutations.postponeTasksLocally(this, familyId, taskIds, newDate)
  }

  async recordMedicationDoseLocally(familyId: string, medicationTaskId: string) {
    return medicationMutations.recordMedicationDoseLocally(this, familyId, medicationTaskId)
  }

  async batchCompleteMedicationDayLocally(familyId: string, medicationTaskIds: string[]) {
    return medicationMutations.batchCompleteMedicationDayLocally(this, familyId, medicationTaskIds)
  }

  async updateHealthRecordLocally(familyId: string, data: UpdateHealthRecordPayload) {
    return healthMutations.updateHealthRecordLocally(this, familyId, data)
  }

  async deleteHealthRecordLocally(familyId: string, recordIdInput: string) {
    return healthMutations.deleteHealthRecordLocally(this, familyId, recordIdInput)
  }

  async updateIllnessStatusLocally(familyId: string, illnessIds: string[], status: string) {
    return healthMutations.updateIllnessStatusLocally(this, familyId, illnessIds, status)
  }

  async recoverIllnessesLocally(familyId: string, illnessIds: string[], medicationTaskIds: string[] = [], recoveryDate?: number) {
    return healthMutations.recoverIllnessesLocally(this, familyId, illnessIds, medicationTaskIds, recoveryDate)
  }

  async endMedicationLocally(familyId: string, medicationTaskId: string, data: EndMedicationPayload = {}) {
    return medicationMutations.endMedicationLocally(this, familyId, medicationTaskId, data)
  }

  async cleanupDuplicateIllnessesLocally(familyId: string, dogId?: string) {
    return healthMutations.cleanupDuplicateIllnessesLocally(this, familyId, dogId)
  }

  async endMedicationByDogLocally(familyId: string, dogId: string) {
    return medicationMutations.endMedicationByDogLocally(this, familyId, dogId)
  }
}

export const localSyncRuntime = new LocalSyncRuntime()
