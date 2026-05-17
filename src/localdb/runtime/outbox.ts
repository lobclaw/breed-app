import { CORE_SYNC_COLLECTIONS } from '@/localdb/collections'
import { localDb } from '@/localdb/db'
import type { LocalMutationPayload, LocalMutationType } from '@/localdb/mutation-registry'
import { materializeBreedingMilestonesForFamily } from '@/localdb/runtime/home-snapshot'
import { formatPullFailures, pullCollectionsBatch } from '@/localdb/runtime/pull'
import { syncIssueService } from '@/localdb/sync-issues'
import type {
  BusinessCollectionName,
  MutationStatus,
  OutboxMutation,
  SyncAckPayload,
  SyncConflictRow,
  SyncMetadata,
} from '@/localdb/types'
import { getOrCreateDeviceId } from '@/localdb/id'

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
  const currentMutation = await localDb.findById<OutboxMutation>('outbox_mutations', mutationId)
  const clientMutationId = currentMutation?.client_mutation_id || mutationId.replace(/^outbox_/, '')
  const logId = `local_operation_${clientMutationId}`
  const conflictRows = status === 'synced'
    ? (await localDb.getReadonlyTable<SyncConflictRow>('sync_conflicts'))
        .filter(conflict => String(conflict.client_mutation_id || '') === clientMutationId && conflict.status !== 'resolved')
    : []
  const now = getNow()

  await localDb.transactRows(['outbox_mutations', 'local_operation_logs', 'sync_conflicts'] as const, async (rows) => {
    await rows.updateRow('outbox_mutations', mutationId, (mutation) => {
      const nextLastError = extra.last_error ?? (status === 'failed' ? mutation.last_error ?? null : null)
      return {
        ...mutation,
        status,
        updated_at: now,
        last_error: nextLastError,
        ...extra,
      }
    })

    if (status === 'synced') {
      await rows.deleteRow('local_operation_logs', logId)
      for (const conflict of conflictRows) {
        await rows.updateRow('sync_conflicts', conflict._id, row => ({
          ...row,
          status: 'resolved',
          updated_at: now,
        }))
      }
      return
    }

    await rows.updateRow('local_operation_logs', logId, (log) => ({
      ...log,
      status,
      last_error: extra.last_error ?? (status === 'failed' ? log.last_error ?? null : null),
      updated_at: now,
    }))
  })
  const mutation = await localDb.findById<OutboxMutation>('outbox_mutations', mutationId)
  if (mutation) await syncIssueService.refreshOutboxIssue(mutation)
}

export async function recoverStaleProcessingOutbox(familyId: string) {
  const now = getNow()
  const processingMutations = (await localDb.getOutbox())
    .filter(mutation => mutation.family_id === familyId && mutation.status === 'processing')
  if (!processingMutations.length) return

  const recoveringIds = new Set(processingMutations.map(mutation => mutation.client_mutation_id).filter(Boolean))
  const processingLogs = (await localDb.getRowsByFamilyReadonly('local_operation_logs', familyId))
    .filter(log => recoveringIds.has(log.client_mutation_id) && log.status === 'processing')

  await localDb.transactRows(['outbox_mutations', 'local_operation_logs'] as const, async (rows) => {
    for (const mutation of processingMutations) {
      await rows.updateRow('outbox_mutations', mutation._id, row => ({
        ...row,
        status: 'pending',
        next_retry_at: 0,
        updated_at: now,
      }))
    }

    for (const log of processingLogs) {
      await rows.updateRow('local_operation_logs', log._id, row => ({
        ...row,
        status: 'pending',
        updated_at: now,
      }))
    }
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

export async function applySyncAck(ack: SyncAckPayload, fallbackCollections: BusinessCollectionName[], familyId: string) {
  const touchedEntities = ack.touchedEntities || []
  const touchedCollections = [...new Set(touchedEntities.map(item => item.collection))]

  if (touchedEntities.length > 0) {
    await localDb.transactRows(touchedCollections, async (rows) => {
      for (const touched of touchedEntities) {
        await rows.updateRow(touched.collection, touched.id, row => ({
          ...row,
          version: touched.version,
          updated_at: touched.updatedAt,
          deleted_at: touched.deletedAt ?? row.deleted_at ?? null,
          _local_pending: false,
        }))
      }
    })
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
