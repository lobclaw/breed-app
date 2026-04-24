import { localDb } from '@/localdb/db'

export async function getSyncStatus() {
  const [outbox, conflicts, syncStates] = await Promise.all([
    localDb.getOutbox(),
    localDb.getTable<any>('sync_conflicts'),
    localDb.getTable<any>('sync_state'),
  ])

  return {
    pending: outbox.filter(item => item.status === 'pending').length,
    processing: outbox.filter(item => item.status === 'processing').length,
    failed: outbox.filter(item => item.status === 'failed').length,
    conflict: outbox.filter(item => item.status === 'conflict').length + conflicts.filter(item => item.status === 'open').length,
    lastPulledAt: syncStates.reduce((max, item) => Math.max(max, Number(item.last_pulled_at || 0)), 0),
  }
}

