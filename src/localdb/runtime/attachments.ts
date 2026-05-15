import { localDb } from '@/localdb/db'
import { syncIssueService } from '@/localdb/sync-issues'
import type { BusinessCollectionName, OutboxMutation } from '@/localdb/types'
import { cacheUploadedImageLocalRef, isUploadedImageRef, uploadLocalImage } from '@/utils/imageAttachment'

export function hasPendingUploadImages(images: any) {
  return Array.isArray(images)
    && images.some(item => typeof item === 'string' && item.trim() && !isUploadedImageRef(item))
}

function getPendingImageRefs(images: any) {
  if (!Array.isArray(images)) return []
  return images
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0 && !isUploadedImageRef(item))
}

function replaceImageRefs(images: any, uploadedRefMap: Map<string, string>) {
  if (!Array.isArray(images)) return images
  return images.map((item) => {
    if (typeof item !== 'string') return item
    return uploadedRefMap.get(item) || item
  })
}

function replaceUploadedRefsDeep(value: any, uploadedRefMap: Map<string, string>): any {
  if (typeof value === 'string') return uploadedRefMap.get(value) || value
  if (Array.isArray(value)) return value.map(item => replaceUploadedRefsDeep(item, uploadedRefMap))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, replaceUploadedRefsDeep(item, uploadedRefMap)]),
  )
}

export async function uploadPendingAttachmentsForFamily(familyId: string) {
  const uploadCollections: BusinessCollectionName[] = ['expenses', 'incomes', 'health_records', 'breeding_records']
  const rowsByCollection = await Promise.all(
    uploadCollections.map(async collection => ({
      collection,
      rows: await localDb.query<any>(collection, row => (
        row.family_id === familyId
        && (row._pending_upload || row.pending_upload)
        && !row.deleted_at
      )),
    })),
  )
  const uploadTargets: Array<{
    collection: BusinessCollectionName
    row: Record<string, any>
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
  await localDb.transact([...uploadCollections, 'outbox_mutations'], (tables) => {
    for (const collection of uploadCollections) {
      tables[collection] = (tables[collection] as any[]).map((row) => {
        if (row.family_id !== familyId || !(row._pending_upload || row.pending_upload) || row.deleted_at) return row
        const nextDetails = row.details && typeof row.details === 'object'
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
      })
    }

    tables.outbox_mutations = (tables.outbox_mutations as OutboxMutation[]).map((mutation) => {
      if (mutation.family_id !== familyId || mutation.status === 'synced') return mutation
      return {
        ...mutation,
        payload: replaceUploadedRefsDeep(mutation.payload, uploadedRefMap),
        updated_at: now,
      }
    })
  })

  await syncIssueService.refreshPendingUploadIssuesForCollections(uploadCollections, familyId)

  await Promise.all([...uploadedRefMap.entries()].map(([localRef, uploadedRef]) => (
    cacheUploadedImageLocalRef(uploadedRef, localRef, { familyId })
  )))

  if (uploadErrorMap.size > 0) {
    throw new Error([...uploadErrorMap.values()][0] || '附件上传失败')
  }

  return { uploaded: uploadedRefMap.size }
}
