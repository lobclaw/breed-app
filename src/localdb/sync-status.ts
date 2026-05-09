import { localDb } from '@/localdb/db'
import { BUSINESS_COLLECTIONS } from '@/localdb/types'
import { isDataUrlImageRef, isVolatileImageRef } from '@/utils/imageAttachment'

const PENDING_UPLOAD_COLLECTION_LABELS: Record<string, string> = {
  expenses: '支出记录',
  incomes: '收入记录',
  health_records: '健康记录',
  breeding_records: '繁育记录',
  dogs: '犬只资料',
}

function getRowDisplayName(row: Record<string, any>) {
  const dogNames = Array.isArray(row.dog_names) ? row.dog_names.map((item: any) => String(item || '').trim()).filter(Boolean) : []
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

function getPendingUploadTitle(collection: string, row: Record<string, any>) {
  const label = PENDING_UPLOAD_COLLECTION_LABELS[collection] || '业务记录'
  const name = getRowDisplayName(row)
  return name ? `${label} · ${name}` : label
}

function getPendingUploadRefs(row: Record<string, any>) {
  const refs = [
    ...(Array.isArray(row.images) ? row.images : []),
    ...(Array.isArray(row.details?.images) ? row.details.images : []),
  ]
  return refs.map(item => String(item || '').trim()).filter(Boolean)
}

function getPendingUploadError(row: Record<string, any>) {
  const refs = getPendingUploadRefs(row)
  if (refs.some(ref => isVolatileImageRef(ref))) return '图片临时路径已失效，请重新选择图片'
  if (refs.some(ref => isDataUrlImageRef(ref))) return '图片已缓存在本机，等待上传'
  return String(row._upload_error || row.upload_error || '')
}

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
  const pendingUploadRows = localRows.flatMap((rows, index) => rows
    .filter(row => (
      (row?._pending_upload || row?.pending_upload)
      && (!familyId || row?.family_id === familyId || row?._id === familyId)
    ))
    .map(row => ({
      collection: BUSINESS_COLLECTIONS[index],
      row,
    })))
  const pendingUpload = pendingUploadRows.length
  const pendingUploadIssues = pendingUploadRows.map(({ collection, row }) => ({
    _id: `pending_upload:${collection}:${row._id}`,
    type: `attachment.${collection}`,
    status: 'pending_upload',
    title: getPendingUploadTitle(collection, row),
    lastError: getPendingUploadError(row),
    collection,
    recordId: String(row._id || ''),
  }))
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
    pendingUploadIssues,
    activeScope: activeScope || '',
    recentSyncAt,
    lastPulledAt: syncStates.reduce((max, item) => Math.max(max, Number(item.last_pulled_at || 0)), 0),
  }
}
