import { localDb } from '@/localdb/db'
import { BUSINESS_COLLECTIONS } from '@/localdb/types'

export async function getSyncStatus() {
  const [outbox, conflicts, syncStates, activeScope, localRows] = await Promise.all([
    localDb.getOutbox(),
    localDb.getTable<any>('sync_conflicts'),
    localDb.getTable<any>('sync_state'),
    localDb.getLocalMeta<string>('sync:active-scope'),
    Promise.all(BUSINESS_COLLECTIONS.map(collection => localDb.getTable<any>(collection))),
  ])
  const pendingUpload = localRows.flat().filter(row => row?._pending_upload || row?.pending_upload).length
  const recentSyncAt = syncStates.reduce((max, item) => Math.max(max, Number(item.updated_at || item.last_pulled_at || 0)), 0)
  const conflictMutationIds = new Set<string>()
  outbox
    .filter(item => item.status === 'conflict')
    .forEach(item => conflictMutationIds.add(item.client_mutation_id || item._id))
  conflicts
    .filter(item => item.status === 'open')
    .forEach(item => conflictMutationIds.add(item.client_mutation_id || item._id))

  return {
    pending: outbox.filter(item => item.status === 'pending').length,
    processing: outbox.filter(item => item.status === 'processing').length,
    failed: outbox.filter(item => item.status === 'failed').length,
    conflict: conflictMutationIds.size,
    pendingUpload,
    activeScope: activeScope || '',
    recentSyncAt,
    lastPulledAt: syncStates.reduce((max, item) => Math.max(max, Number(item.last_pulled_at || 0)), 0),
  }
}
