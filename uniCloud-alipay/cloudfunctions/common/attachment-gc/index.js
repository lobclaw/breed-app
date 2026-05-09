const ATTACHMENT_DELETE_RETENTION_MS = 30 * 86400000
const ATTACHMENT_COLLECTIONS = ['expenses', 'incomes', 'health_records', 'breeding_records']

function getAttachmentDeleteRetryDelayMs(attempts = 0) {
  const retryStep = Math.max(1, Number(attempts || 1))
  return Math.min((2 ** Math.min(retryStep - 1, 8)) * 60000, 86400000)
}

function normalizeImageRefs(images = []) {
  if (!Array.isArray(images)) return []
  const result = []
  for (const item of images) {
    const ref = String(item || '').trim()
    if (ref && !result.includes(ref)) result.push(ref)
  }
  return result
}

function isManagedAttachmentRef(ref = '') {
  const text = String(ref || '').trim()
  if (!text) return false
  if (/^https?:\/\//i.test(text)) return false
  return /(^|\/)attachments\//.test(text)
}

function getRemovedManagedAttachmentRefs(previousImages = [], nextImages = []) {
  const nextSet = new Set(normalizeImageRefs(nextImages))
  return normalizeImageRefs(previousImages)
    .filter(ref => isManagedAttachmentRef(ref) && !nextSet.has(ref))
}

function getRowImageRefs(row = {}) {
  return [
    ...normalizeImageRefs(row.images),
    ...normalizeImageRefs(row.details?.images),
  ]
}

function getAttachmentDeletionId(familyId, fileID) {
  let hash = 0
  const input = `${familyId}:${fileID}`
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0
  }
  return `attachment_delete_${String(familyId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Math.abs(hash)}`
}

async function enqueueRemovedAttachments(db, {
  familyId,
  refs = [],
  sourceCollection = '',
  sourceId = '',
  now = Date.now(),
} = {}) {
  const queued = []
  try {
    const fileIDs = normalizeImageRefs(refs).filter(isManagedAttachmentRef)
    if (!familyId || fileIDs.length === 0) return []

    for (const fileID of fileIDs) {
      const id = getAttachmentDeletionId(familyId, fileID)
      const sourceKey = `${sourceCollection}:${sourceId}`
      const { data } = await db.collection('attachment_deletions').doc(id).get()
      const existing = data?.[0] || null
      const sourceRefs = normalizeImageRefs([...(existing?.source_refs || []), sourceKey])
      const row = {
        _id: id,
        family_id: familyId,
        file_id: fileID,
        status: 'pending',
        source_refs: sourceRefs,
        scheduled_delete_at: now + ATTACHMENT_DELETE_RETENTION_MS,
        next_retry_at: null,
        attempts: Number(existing?.attempts || 0),
        first_seen_at: existing?.first_seen_at || now,
        updated_at: now,
        last_error: null,
      }

      if (existing) {
        const { _id, ...updateData } = row
        await db.collection('attachment_deletions').doc(id).update(updateData)
      } else {
        await db.collection('attachment_deletions').add(row)
      }
      queued.push(row)
    }
  } catch (error) {
    console.warn('[attachment-gc] enqueue removed attachments failed', error)
  }
  return queued
}

async function isAttachmentReferenced(db, familyId, fileID) {
  for (const collection of ATTACHMENT_COLLECTIONS) {
    const { data } = await db.collection(collection)
      .where({ family_id: familyId })
      .get()
    if ((data || []).some(row => getRowImageRefs(row).includes(fileID))) {
      return true
    }
  }
  return false
}

async function cleanupPendingAttachmentDeletions(db, {
  familyId = '',
  now = Date.now(),
  limit = 50,
  dryRun = false,
} = {}) {
  const dbCmd = db.command
  const where = {
    status: dbCmd.in(['pending', 'failed']),
    scheduled_delete_at: dbCmd.lte(now),
    ...(familyId ? { family_id: familyId } : {}),
  }
  const { data } = await db.collection('attachment_deletions')
    .where(where)
    .orderBy('scheduled_delete_at', 'asc')
    .limit(limit)
    .get()

  const result = { deleted: 0, skipped: 0, failed: 0, dryRun: !!dryRun, items: [] }
  for (const row of data || []) {
    const fileID = String(row.file_id || '').trim()
    if (!fileID) continue
    const nextRetryAt = Number(row.next_retry_at || 0)
    if (nextRetryAt && nextRetryAt > now) {
      result.skipped += 1
      result.items.push({ fileID, status: 'retry_later' })
      continue
    }

    const referenced = await isAttachmentReferenced(db, row.family_id, fileID)
    if (referenced) {
      result.skipped += 1
      result.items.push({ fileID, status: 'skipped_referenced' })
      if (!dryRun) {
        await db.collection('attachment_deletions').doc(row._id).update({
          status: 'skipped_referenced',
          skipped_at: now,
          updated_at: now,
          last_error: 'still_referenced',
        })
      }
      continue
    }

    if (dryRun) {
      result.deleted += 1
      result.items.push({ fileID, status: 'would_delete' })
      continue
    }

    try {
      if (typeof uniCloud === 'undefined' || typeof uniCloud.deleteFile !== 'function') {
        throw new Error('当前环境不支持删除云文件')
      }
      await uniCloud.deleteFile({ fileList: [fileID] })
      result.deleted += 1
      result.items.push({ fileID, status: 'deleted' })
      await db.collection('attachment_deletions').doc(row._id).update({
        status: 'deleted',
        deleted_at: now,
        attempts: Number(row.attempts || 0) + 1,
        updated_at: now,
        last_error: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const attempts = Number(row.attempts || 0) + 1
      result.failed += 1
      result.items.push({ fileID, status: 'failed', error: message })
      await db.collection('attachment_deletions').doc(row._id).update({
        status: 'pending',
        attempts,
        next_retry_at: now + getAttachmentDeleteRetryDelayMs(attempts),
        updated_at: now,
        last_error: message,
      })
    }
  }
  return result
}

module.exports = {
  ATTACHMENT_DELETE_RETENTION_MS,
  getAttachmentDeleteRetryDelayMs,
  normalizeImageRefs,
  isManagedAttachmentRef,
  getRemovedManagedAttachmentRefs,
  enqueueRemovedAttachments,
  cleanupPendingAttachmentDeletions,
}
