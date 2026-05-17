import { localDb } from '@/localdb/db'
import { syncIssueService } from '@/localdb/sync-issues'
import type { BusinessCollectionName, LocalRowOf } from '@/localdb/types'
import { cacheUploadedImageLocalRef, isUploadedImageRef, uploadLocalImage } from '@/utils/imageAttachment'

const uploadCollections = ['expenses', 'incomes', 'health_records', 'breeding_records'] as const satisfies readonly BusinessCollectionName[]
type AttachmentCollectionName = typeof uploadCollections[number]
type AttachmentTransactionCollection = AttachmentCollectionName | 'outbox_mutations'
type AttachmentRow = {
  _id: string
  family_id: string
  images?: unknown
  details?: Record<string, unknown> | null
  _pending_upload?: boolean
  pending_upload?: boolean
  _upload_error?: string | null
  deleted_at?: number | null
  updated_at?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function hasPendingUploadImages(images: unknown) {
  return Array.isArray(images)
    && images.some(item => typeof item === 'string' && item.trim() && !isUploadedImageRef(item))
}

function getPendingImageRefs(images: unknown) {
  if (!Array.isArray(images)) return []
  return images
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0 && !isUploadedImageRef(item))
}

function replaceImageRefs(images: unknown, uploadedRefMap: Map<string, string>) {
  if (!Array.isArray(images)) return images
  return images.map((item) => {
    if (typeof item !== 'string') return item
    return uploadedRefMap.get(item) || item
  })
}

function replaceUploadedRefsDeep(value: unknown, uploadedRefMap: Map<string, string>): unknown {
  if (typeof value === 'string') return uploadedRefMap.get(value) || value
  if (Array.isArray(value)) return value.map(item => replaceUploadedRefsDeep(item, uploadedRefMap))
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, replaceUploadedRefsDeep(item, uploadedRefMap)]),
  )
}

function buildNextAttachmentRow(
  row: AttachmentRow,
  uploadedRefMap: Map<string, string>,
  uploadErrorMap: Map<string, string>,
  now: number,
): AttachmentRow {
  const nextDetails = isRecord(row.details)
    ? { ...row.details, images: replaceImageRefs(row.details.images, uploadedRefMap) }
    : row.details
  const nextRow = {
    ...row,
    images: replaceImageRefs(row.images, uploadedRefMap),
    ...(nextDetails !== row.details ? { details: nextDetails } : {}),
  }
  const stillPending = hasPendingUploadImages(nextRow.images) || hasPendingUploadImages(nextRow.details?.images)
  const pendingRefs = [
    ...getPendingImageRefs(nextRow.images),
    ...getPendingImageRefs(nextRow.details?.images),
  ]
  const uploadError = pendingRefs.map(ref => uploadErrorMap.get(ref)).find(Boolean) || row._upload_error || null
  return {
    ...nextRow,
    _pending_upload: stillPending,
    pending_upload: stillPending,
    _upload_error: stillPending ? uploadError : null,
    updated_at: now,
  }
}

async function upsertAttachmentRow(
  rows: {
    upsertRow<T extends AttachmentTransactionCollection>(
      collection: T,
      row: LocalRowOf<T> & { _id: string },
    ): Promise<void>
  },
  collection: AttachmentCollectionName,
  row: AttachmentRow,
) {
  if (collection === 'expenses') {
    await rows.upsertRow('expenses', row as LocalRowOf<'expenses'>)
  } else if (collection === 'incomes') {
    await rows.upsertRow('incomes', row as LocalRowOf<'incomes'>)
  } else if (collection === 'health_records') {
    await rows.upsertRow('health_records', row as LocalRowOf<'health_records'>)
  } else {
    await rows.upsertRow('breeding_records', row as LocalRowOf<'breeding_records'>)
  }
}

export async function uploadPendingAttachmentsForFamily(familyId: string) {
  const rowsByCollection: Array<{ collection: AttachmentCollectionName, rows: AttachmentRow[] }> = await Promise.all(
    uploadCollections.map(async (collection) => {
      const rows = await localDb.getRowsByFamilyReadonly<AttachmentRow>(collection, familyId)
      return {
        collection,
        rows: rows.filter(row => (
          (row._pending_upload === true || row.pending_upload === true)
          && !row.deleted_at
        )),
      }
    }),
  )
  const uploadTargets: Array<{
    collection: AttachmentCollectionName
    row: AttachmentRow
    localRef: string
    index: number
  }> = []

  for (const { collection, rows } of rowsByCollection) {
    for (const row of rows) {
      const refs = [
        ...getPendingImageRefs(row.images),
        ...getPendingImageRefs(row.details?.images),
      ]
      refs.forEach((localRef, index) => {
        uploadTargets.push({ collection, row, localRef, index })
      })
    }
  }
  if (!rowsByCollection.some(item => item.rows.length > 0)) return { uploaded: 0 }

  const uniqueTargets = [
    ...new Map(uploadTargets.map(target => [`${target.collection}:${target.row._id}:${target.localRef}`, target])).values(),
  ]

  const uploadedRefMap = new Map<string, string>()
  const uploadErrorMap = new Map<string, string>()
  for (const target of uniqueTargets) {
    if (uploadedRefMap.has(target.localRef) || uploadErrorMap.has(target.localRef)) continue
    try {
      const uploadedRef = await uploadLocalImage(target.localRef, {
        familyId,
        collection: target.collection,
        rowId: target.row._id,
        index: target.index,
      })
      uploadedRefMap.set(target.localRef, uploadedRef)
    } catch (error) {
      uploadErrorMap.set(target.localRef, error instanceof Error ? error.message : '附件上传失败')
    }
  }

  const now = Date.now()
  const pendingOutbox = (await localDb.getOutbox()).filter(mutation => (
    mutation.family_id === familyId && mutation.status !== 'synced'
  ))
  await localDb.transactRows([...uploadCollections, 'outbox_mutations'] as const, async (rows) => {
    for (const collection of uploadCollections) {
      const collectionRows = rowsByCollection.find(item => item.collection === collection)?.rows || []
      for (const sourceRow of collectionRows) {
        const current = await rows.getRow(collection, sourceRow._id)
        if (!current || current.family_id !== familyId || !(current._pending_upload || current.pending_upload) || current.deleted_at) {
          continue
        }
        await upsertAttachmentRow(
          rows,
          collection,
          buildNextAttachmentRow(current as AttachmentRow, uploadedRefMap, uploadErrorMap, now),
        )
      }
    }

    for (const mutation of pendingOutbox) {
      await rows.updateRow('outbox_mutations', mutation._id, row => ({
        ...row,
        payload: replaceUploadedRefsDeep(row.payload, uploadedRefMap) as Record<string, unknown>,
        updated_at: now,
      }))
    }
  })

  await syncIssueService.refreshPendingUploadIssuesForCollections([...uploadCollections], familyId)

  await Promise.all([...uploadedRefMap.entries()].map(([localRef, uploadedRef]) => (
    cacheUploadedImageLocalRef(uploadedRef, localRef, { familyId })
  )))

  if (uploadErrorMap.size > 0) {
    throw new Error([...uploadErrorMap.values()][0] || '附件上传失败')
  }

  return { uploaded: uploadedRefMap.size }
}
