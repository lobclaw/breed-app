import { localDb } from '@/localdb/db'
import { BUSINESS_COLLECTIONS } from '@/localdb/types'

export async function getSyncStatus(options: { familyId?: string } = {}) {
  const familyId = String(options.familyId || '')
  const [outbox, conflicts, syncStates, activeScope, localRows] = await Promise.all([
    localDb.getOutbox(),
    localDb.getTable<any>('sync_conflicts'),
    localDb.getTable<any>('sync_state'),
    localDb.getLocalMeta<string>('sync:active-scope'),
    Promise.all(BUSINESS_COLLECTIONS.map(collection => localDb.getTable<any>(collection))),
  ])
  const scopedOutbox = familyId ? outbox.filter(item => item.family_id === familyId) : outbox
  const scopedMutationIds = new Set(scopedOutbox.map(item => item.client_mutation_id || item._id))
  const pendingUpload = localRows
    .flat()
    .filter(row => (
      (row?._pending_upload || row?.pending_upload)
      && (!familyId || row?.family_id === familyId || row?._id === familyId)
    )).length
  const recentSyncAt = syncStates.reduce((max, item) => Math.max(max, Number(item.updated_at || item.last_pulled_at || 0)), 0)
  const conflictMutationIds = new Set<string>()
  scopedOutbox
    .filter(item => item.status === 'conflict')
    .forEach(item => conflictMutationIds.add(item.client_mutation_id || item._id))
  conflicts
    .filter(item => item.status === 'open' && (!familyId || scopedMutationIds.has(item.client_mutation_id || item._id)))
    .forEach(item => conflictMutationIds.add(item.client_mutation_id || item._id))

  return {
    pending: scopedOutbox.filter(item => item.status === 'pending').length,
    processing: scopedOutbox.filter(item => item.status === 'processing').length,
    failed: scopedOutbox.filter(item => item.status === 'failed').length,
    conflict: conflictMutationIds.size,
    pendingUpload,
    activeScope: activeScope || '',
    recentSyncAt,
    lastPulledAt: syncStates.reduce((max, item) => Math.max(max, Number(item.last_pulled_at || 0)), 0),
  }
}
