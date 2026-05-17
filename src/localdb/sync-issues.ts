import { localDb } from '@/localdb/db'
import type { LocalCollectionName, OutboxMutation, SyncIssueRow } from '@/localdb/types'
import { isDataUrlImageRef, isVolatileImageRef } from '@/utils/imageAttachment'

const PENDING_UPLOAD_COLLECTION_LABELS: Record<string, string> = {
  expenses: '支出记录',
  incomes: '收入记录',
  health_records: '健康记录',
  breeding_records: '繁育记录',
  dogs: '犬只资料',
}

type PendingUploadBusinessRow = {
  _id: string
  family_id?: string
  dog_names?: unknown
  dog_name?: unknown
  dam_name?: unknown
  name?: unknown
  category?: unknown
  type?: unknown
  images?: unknown
  details?: {
    images?: unknown
  } | null
  _pending_upload?: boolean
  pending_upload?: boolean
  _upload_error?: unknown
  upload_error?: unknown
  deleted_at?: number | null
}

function getNow() {
  return Date.now()
}

function getRowDisplayName(row: PendingUploadBusinessRow) {
  const dogNames = Array.isArray(row.dog_names) ? row.dog_names.map(item => String(item || '').trim()).filter(Boolean) : []
  return String(
    row.dog_name
    || dogNames[0]
    || row.dam_name
    || row.name
    || row.category
    || row.type
    || '',
  ).trim()
}

function getPendingUploadTitle(collection: string, row: PendingUploadBusinessRow) {
  const label = PENDING_UPLOAD_COLLECTION_LABELS[collection] || '业务记录'
  const name = getRowDisplayName(row)
  return name ? `${label} · ${name}` : label
}

function getPendingUploadRefs(row: PendingUploadBusinessRow) {
  const detailsImages = row.details?.images
  const refs = [
    ...(Array.isArray(row.images) ? row.images : []),
    ...(Array.isArray(detailsImages) ? detailsImages : []),
  ]
  return refs.map(item => String(item || '').trim()).filter(Boolean)
}

function getPendingUploadError(row: PendingUploadBusinessRow) {
  const refs = getPendingUploadRefs(row)
  if (refs.some(ref => isVolatileImageRef(ref))) return '图片临时路径已失效，请重新选择图片'
  if (refs.some(ref => isDataUrlImageRef(ref))) return '图片已缓存在本机，等待上传'
  return String(row._upload_error || row.upload_error || '')
}

function issueIdForPendingUpload(collection: string, recordId: string) {
  return `pending_upload:${collection}:${recordId}`
}

function issueIdForOutbox(mutation: Pick<OutboxMutation, '_id' | 'client_mutation_id'>) {
  return `outbox:${mutation.client_mutation_id || mutation._id}`
}

async function upsertIssue(row: SyncIssueRow) {
  await localDb.upsertRows('sync_issues', [row])
}

async function resolveIssue(issueId: string, familyId = '') {
  const existing = await localDb.findById<SyncIssueRow>('sync_issues', issueId)
  if (!existing) return
  if (familyId && existing.family_id !== familyId) return
  await upsertIssue({
    ...existing,
    status: 'resolved',
    updated_at: getNow(),
  })
}

export const syncIssueService = {
  async refreshPendingUploadIssue(collection: LocalCollectionName, row: PendingUploadBusinessRow) {
    const recordId = String(row?._id || '')
    if (!recordId) return
    const familyId = String(row.family_id || (collection === 'families' ? row._id || '' : ''))
    const issueId = issueIdForPendingUpload(collection, recordId)
    const isPending = Boolean((row._pending_upload || row.pending_upload) && !row.deleted_at)
    if (!isPending) {
      await resolveIssue(issueId, familyId)
      return
    }
    const now = getNow()
    await upsertIssue({
      _id: issueId,
      family_id: familyId,
      kind: 'pending_upload',
      status: 'open',
      collection,
      record_id: recordId,
      mutation_id: null,
      title: getPendingUploadTitle(collection, row),
      last_error: getPendingUploadError(row),
      created_at: now,
      updated_at: now,
    })
  },

  async refreshPendingUploadIssuesForCollection(collection: LocalCollectionName, familyId: string) {
    if (!familyId) return
    const rows = await localDb.query<PendingUploadBusinessRow>(collection, row => (
      row.family_id === familyId
      && Boolean((row._pending_upload || row.pending_upload) || row._upload_error || row.upload_error)
    ))
    const pendingIssueIds = new Set(
      rows
        .filter(row => Boolean((row._pending_upload || row.pending_upload) && !row.deleted_at))
        .map(row => issueIdForPendingUpload(collection, String(row._id || ''))),
    )
    const openIssues = await localDb.query<SyncIssueRow>('sync_issues', issue => (
      issue.family_id === familyId
      && issue.kind === 'pending_upload'
      && issue.status === 'open'
      && issue.collection === collection
    ))
    await Promise.all([
      ...rows.map(row => this.refreshPendingUploadIssue(collection, row)),
      ...openIssues
        .filter(issue => !pendingIssueIds.has(issue._id))
        .map(issue => resolveIssue(issue._id, familyId)),
    ])
  },

  async refreshPendingUploadIssuesForRows(collection: LocalCollectionName, familyId: string, recordIds: string[]) {
    if (!familyId) return
    const uniqueRecordIds = [...new Set((recordIds || []).map(id => String(id || '').trim()).filter(Boolean))]
    await Promise.all(uniqueRecordIds.map(async (recordId) => {
      const row = await localDb.findById<PendingUploadBusinessRow>(collection, recordId)
      if (!row || row.family_id !== familyId) {
        await resolveIssue(issueIdForPendingUpload(collection, recordId), familyId)
        return
      }
      await this.refreshPendingUploadIssue(collection, row)
    }))
  },

  async refreshPendingUploadIssuesForCollections(collections: LocalCollectionName[], familyId: string) {
    const uniqueCollections = [...new Set(collections)]
    await Promise.all(uniqueCollections.map(collection => this.refreshPendingUploadIssuesForCollection(collection, familyId)))
  },

  async refreshOutboxIssue(mutation: OutboxMutation) {
    const issueId = issueIdForOutbox(mutation)
    const status = mutation.status
    if (status !== 'failed' && status !== 'conflict') {
      await resolveIssue(issueId, mutation.family_id)
      return
    }
    const now = getNow()
    await upsertIssue({
      _id: issueId,
      family_id: mutation.family_id,
      kind: status === 'conflict' ? 'conflict' : 'sync_failed',
      status: 'open',
      collection: mutation.collection_scope?.[0] || '',
      record_id: null,
      mutation_id: mutation.client_mutation_id || mutation._id,
      title: mutation.type,
      last_error: mutation.last_error || '',
      created_at: now,
      updated_at: now,
    })
  },
}
