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

  return {
    pending: outbox.filter(item => item.status === 'pending').length,
    processing: outbox.filter(item => item.status === 'processing').length,
    failed: outbox.filter(item => item.status === 'failed').length,
    conflict: outbox.filter(item => item.status === 'conflict').length + conflicts.filter(item => item.status === 'open').length,
    pendingUpload,
    activeScope: activeScope || '',
    recentSyncAt,
    lastPulledAt: syncStates.reduce((max, item) => Math.max(max, Number(item.last_pulled_at || 0)), 0),
  }
}
