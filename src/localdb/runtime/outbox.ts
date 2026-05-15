import { CORE_SYNC_COLLECTIONS } from '@/localdb/collections'
import { localDb } from '@/localdb/db'
import { applyTouchedEntityVersions } from '@/localdb/home-projection'
import type { LocalMutationPayload, LocalMutationType } from '@/localdb/mutation-registry'
import { materializeBreedingMilestonesForFamily } from '@/localdb/runtime/home-snapshot'
import { formatPullFailures, pullCollectionsBatch } from '@/localdb/runtime/pull'
import { syncIssueService } from '@/localdb/sync-issues'
import type {
  BusinessCollectionName,
  LocalCollectionName,
  LocalOperationLogRow,
  LocalRowOf,
  MutationStatus,
  OutboxMutation,
  SyncAckPayload,
  SyncMetadata,
} from '@/localdb/types'
import { getOrCreateDeviceId } from '@/localdb/id'

type AckMutationTables = Partial<{ [C in BusinessCollectionName]: LocalRowOf<C>[] }> & { [collection: string]: unknown }

function getNow() {
  return Date.now()
}

export function buildOutboxMutation<T extends LocalMutationPayload>(
  type: LocalMutationType,
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

export async function upsertOutboxMutation(mutation: OutboxMutation) {
  await localDb.upsertRows('outbox_mutations', [mutation])
}

export async function updateOutboxStatus(mutationId: string, status: MutationStatus, extra: Partial<OutboxMutation> = {}) {
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
  const mutation = await localDb.findById<OutboxMutation>('outbox_mutations', mutationId)
  if (mutation) await syncIssueService.refreshOutboxIssue(mutation)
}

export async function recoverStaleProcessingOutbox(familyId: string) {
  const now = getNow()
  await localDb.transact(['outbox_mutations', 'local_operation_logs'], (tables) => {
    const recoveringIds = new Set(
      (tables.outbox_mutations as OutboxMutation[])
        .filter(mutation => mutation.family_id === familyId && mutation.status === 'processing')
        .map(mutation => mutation.client_mutation_id)
        .filter(Boolean),
    )

    if (!recoveringIds.size) return

    tables.outbox_mutations = (tables.outbox_mutations as OutboxMutation[]).map((mutation) => {
      if (mutation.family_id !== familyId || mutation.status !== 'processing') return mutation
      return {
        ...mutation,
        status: 'pending',
        next_retry_at: 0,
        updated_at: now,
      }
    })

    tables.local_operation_logs = (tables.local_operation_logs as LocalOperationLogRow[]).map((log) => {
      if (!recoveringIds.has(log.client_mutation_id) || log.status !== 'processing') return log
      return {
        ...log,
        status: 'pending',
        updated_at: now,
      }
    })
  })
}

export function rebaseMutationForConflict(
  mutation: OutboxMutation<LocalMutationPayload>,
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
  } satisfies OutboxMutation<LocalMutationPayload>
}

function applyAckToCollectionRows<C extends BusinessCollectionName>(
  rows: LocalRowOf<C>[],
  touchedEntities: NonNullable<SyncAckPayload['touchedEntities']>,
  collection: C,
) {
  return applyTouchedEntityVersions(rows, touchedEntities, collection) as LocalRowOf<C>[]
}

function applyAckToMutableTables<C extends BusinessCollectionName>(
  tables: AckMutationTables,
  collection: C,
  touchedEntities: NonNullable<SyncAckPayload['touchedEntities']>,
) {
  const key = String(collection)
  tables[key] = applyAckToCollectionRows((tables[key] || []) as LocalRowOf<C>[], touchedEntities, collection)
}

export async function applySyncAck(ack: SyncAckPayload, fallbackCollections: BusinessCollectionName[], familyId: string) {
  const touchedEntities = ack.touchedEntities || []
  const touchedCollections = [...new Set(touchedEntities.map(item => item.collection))]

  if (touchedEntities.length > 0) {
    await localDb.transact(
      touchedCollections as LocalCollectionName[],
      (tables) => {
        const mutableTables = tables as AckMutationTables
        for (const collection of touchedCollections) {
          applyAckToMutableTables(mutableTables, collection, touchedEntities)
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
  const { failures } = await pullCollectionsBatch(collectionsToPull, familyId, false)
  if (failures.length > 0) {
    throw new Error(formatPullFailures(failures))
  }
  if (collectionsToPull.includes('breeding_cycles') || collectionsToPull.includes('breeding_records')) {
    await materializeBreedingMilestonesForFamily(familyId)
  }
}
