import { localDb } from '@/localdb/db'
import type { SyncIssueRow } from '@/localdb/types'

function toPendingUploadIssue(issue: SyncIssueRow) {
  return {
    _id: issue._id,
    type: `attachment.${issue.collection}`,
    status: 'pending_upload',
    title: issue.title,
    lastError: issue.last_error || '',
    collection: issue.collection,
    recordId: String(issue.record_id || ''),
  }
}

export async function getSyncStatus(options: { familyId?: string } = {}) {
  const familyId = String(options.familyId || '')
  const activeScopeMetaKey = familyId ? `sync:active-scope:${familyId}` : 'sync:active-scope'
  const [outbox, conflicts, syncStates, activeScope, issues] = await Promise.all([
    localDb.queryReadonly<any>('outbox_mutations', undefined, {
      sort: (a, b) => a.created_at - b.created_at,
    }),
    localDb.getReadonlyTable<any>('sync_conflicts'),
    familyId ? localDb.getRowsByFamilyReadonly<any>('sync_state', familyId) : localDb.getReadonlyTable<any>('sync_state'),
    localDb.getLocalMeta<string>(activeScopeMetaKey),
    familyId ? localDb.getRowsByFamilyReadonly<SyncIssueRow>('sync_issues', familyId) : localDb.getReadonlyTable<SyncIssueRow>('sync_issues'),
  ])
  const scopedSyncStates = familyId ? syncStates.filter(item => item.family_id === familyId) : syncStates
  const scopedOutbox = familyId ? outbox.filter(item => item.family_id === familyId) : outbox
  const scopedIssues = issues.filter(item => item.status === 'open' && (!familyId || item.family_id === familyId))
  const scopedMutationIds = new Set(scopedOutbox.map(item => item.client_mutation_id || item._id))
  const pendingUploadIssues = scopedIssues
    .filter(issue => issue.kind === 'pending_upload')
    .map(toPendingUploadIssue)
  const recentSyncAt = scopedSyncStates.reduce((max, item) => Math.max(max, Number(item.updated_at || item.last_pulled_at || 0)), 0)
  const conflictMutationIds = new Set<string>()
  scopedOutbox
    .filter(item => item.status === 'conflict')
    .forEach(item => conflictMutationIds.add(item.client_mutation_id || item._id))
  conflicts
    .filter(item => item.status === 'open' && (!familyId || scopedMutationIds.has(item.client_mutation_id || item._id)))
    .forEach(item => conflictMutationIds.add(item.client_mutation_id || item._id))
  scopedIssues
    .filter(issue => issue.kind === 'conflict' && issue.mutation_id)
    .forEach(issue => conflictMutationIds.add(String(issue.mutation_id)))

  return {
    pending: scopedOutbox.filter(item => item.status === 'pending').length,
    processing: scopedOutbox.filter(item => item.status === 'processing').length,
    failed: scopedOutbox.filter(item => item.status === 'failed').length,
    conflict: conflictMutationIds.size,
    pendingUpload: pendingUploadIssues.length,
    pendingUploadIssues,
    activeScope: activeScope || '',
    recentSyncAt,
    lastPulledAt: scopedSyncStates.reduce((max, item) => Math.max(max, Number(item.last_pulled_at || 0)), 0),
  }
}
