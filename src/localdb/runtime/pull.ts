import { localDb } from '@/localdb/db'
import { cloudCall } from '@/composables/useCloudCall'
import type { BusinessCollectionName, SyncStateRow } from '@/localdb/types'

interface PullCollectionPayload {
  ok?: boolean
  rows?: Array<Record<string, unknown>>
  cursor?: number
  cursorId?: string
  offset?: number
  hasMore?: boolean
  error?: string
}

interface PullCollectionsResponse {
  data?: {
    collections?: Partial<Record<BusinessCollectionName, PullCollectionPayload>>
  }
}

export type PulledRow = Record<string, unknown> & { _id: string; updated_at?: number; created_at?: number; version: number }

export interface PullCollectionFailure {
  collection: BusinessCollectionName
  error: string
}

export interface PullCollectionsBatchResult {
  rowsByCollection: Partial<Record<BusinessCollectionName, PulledRow[]>>
  failures: PullCollectionFailure[]
}

interface PullCollectionInFlightResult {
  rows: PulledRow[]
  failure: PullCollectionFailure | null
}

const pullInFlight = new Map<string, Promise<PullCollectionInFlightResult>>()

function getNow() {
  return Date.now()
}

function rowBelongsToFamily(row: { family_id?: unknown, _id?: unknown }, familyId: string) {
  if (!familyId) return true
  return row?.family_id === familyId || row?._id === familyId
}

function toSyncStateRow(collection: BusinessCollectionName, familyId = '', current?: Partial<SyncStateRow>): SyncStateRow {
  const now = getNow()
  return {
    _id: familyId ? `${familyId}:${collection}` : collection,
    family_id: familyId,
    collection,
    last_pulled_at: current?.last_pulled_at || 0,
    last_pulled_id: current?.last_pulled_id || '',
    last_full_sync_at: current?.last_full_sync_at || 0,
    last_ack_at: current?.last_ack_at || 0,
    updated_at: now,
  }
}

function normalizePulledRows<T extends Record<string, unknown>>(rows: T[]): Array<T & { _id: string; updated_at?: number; created_at?: number; version: number }> {
  return rows.map((row) => {
    const updatedAt = Number(row.updated_at || row.created_at || 0)
    return {
      ...row,
      _id: String(row._id || ''),
      version: Number(row.version || 0),
      updated_at: updatedAt || (typeof row.updated_at === 'number' ? row.updated_at : undefined),
      _local_pending: false,
    }
  })
}

function buildPullKey(collection: BusinessCollectionName, familyId: string, forceFull = false) {
  return `${collection}:${familyId}:${forceFull ? 'full' : 'delta'}`
}

export function formatPullFailures(failures: PullCollectionFailure[]) {
  return failures.map(failure => `${failure.collection}: ${failure.error || '同步失败'}`).join('；')
}

async function doPullCollections(collections: BusinessCollectionName[], familyId: string, forceFull = false): Promise<PullCollectionsBatchResult> {
  const uniqueCollections = [...new Set(collections)]
  const statePairs = await Promise.all(uniqueCollections.map(async (collection) => {
    const currentState = await localDb.getSyncState(collection, familyId)
    const baseState = toSyncStateRow(collection, familyId, currentState || undefined)
    return {
      collection,
      baseState,
      lastPulledAt: forceFull ? 0 : baseState.last_pulled_at,
      lastPulledId: forceFull ? '' : baseState.last_pulled_id || '',
    }
  }))
  const cursors: Partial<Record<BusinessCollectionName, number>> = Object.fromEntries(statePairs.map(({ collection, lastPulledAt }) => [
    collection,
    lastPulledAt || 0,
  ]))
  const cursorIds: Partial<Record<BusinessCollectionName, string>> = Object.fromEntries(statePairs.map(({ collection, lastPulledId }) => [
    collection,
    lastPulledId || '',
  ]))
  const accumulatedRows: Partial<Record<BusinessCollectionName, PulledRow[]>> = {}
  const finalCursors: Partial<Record<BusinessCollectionName, number>> = {}
  const finalCursorIds: Partial<Record<BusinessCollectionName, string>> = {}
  const rowsByCollection: Partial<Record<BusinessCollectionName, PulledRow[]>> = {}
  const failures: PullCollectionFailure[] = []
  const failedCollections = new Set<BusinessCollectionName>()
  let pendingCollections = [...uniqueCollections]

  while (pendingCollections.length > 0) {
    const response = await cloudCall<PullCollectionsResponse>('family-service', 'pullCollections', {
      collections: pendingCollections,
      cursors,
      cursorIds,
      forceFull,
      limit: 1000,
    })
    const pulledCollections = response?.data?.collections || {}
    const nextPendingCollections: BusinessCollectionName[] = []

    for (const collection of pendingCollections) {
      if (!Object.prototype.hasOwnProperty.call(pulledCollections, collection)) {
        failures.push({ collection, error: '同步响应缺少集合结果' })
        failedCollections.add(collection)
        continue
      }
      const payload = pulledCollections[collection] || {}
      if (payload.ok === false) {
        failures.push({ collection, error: payload.error || '同步失败' })
        failedCollections.add(collection)
        continue
      }
      const previousCursor = Number(cursors[collection] || 0)
      const previousCursorId = String(cursorIds[collection] || '')
      const rows = normalizePulledRows(Array.isArray(payload.rows) ? payload.rows : [])
        .filter(row => rowBelongsToFamily(row, familyId))
      accumulatedRows[collection] = [...(accumulatedRows[collection] || []), ...rows]
      const nextCursor = Number(payload.cursor || 0)
      const nextCursorId = String(payload.cursorId || '')
      finalCursors[collection] = nextCursor
      finalCursorIds[collection] = nextCursorId
      if (payload.hasMore) {
        if (rows.length === 0) {
          failures.push({ collection, error: '同步分页返回为空' })
          failedCollections.add(collection)
          continue
        }
        if (!nextCursorId || nextCursor < previousCursor || (nextCursor === previousCursor && nextCursorId <= previousCursorId)) {
          failures.push({ collection, error: '同步分页游标未前进' })
          failedCollections.add(collection)
          continue
        }
        cursors[collection] = nextCursor
        cursorIds[collection] = nextCursorId
        nextPendingCollections.push(collection)
        continue
      }
      rowsByCollection[collection] = accumulatedRows[collection] || []
    }

    pendingCollections = nextPendingCollections
  }

  for (const { collection, baseState, lastPulledAt } of statePairs) {
    if (failedCollections.has(collection) || !Object.prototype.hasOwnProperty.call(rowsByCollection, collection)) continue
    const rows = rowsByCollection[collection] || []
    if (rows.length > 0) {
      await localDb.upsertRows(collection, rows)
    }
    const maxUpdatedAt = rows.reduce((max, row) => Math.max(max, Number(row.updated_at || row.created_at || 0)), lastPulledAt)
    const responseCursor = rows.length > 0 ? Number(finalCursors[collection] || 0) : 0
    const nextCursor = Math.max(maxUpdatedAt, responseCursor)
    const nextCursorId = rows.length > 0 ? String(finalCursorIds[collection] || '') : (forceFull ? '' : baseState.last_pulled_id || '')
    await localDb.upsertSyncState({
      ...baseState,
      last_pulled_at: forceFull && nextCursor === 0 ? getNow() : nextCursor,
      last_pulled_id: nextCursorId,
      last_full_sync_at: forceFull ? getNow() : baseState.last_full_sync_at,
      updated_at: getNow(),
    })
  }

  return { rowsByCollection, failures }
}

export async function pullCollectionsBatch(collections: BusinessCollectionName[], familyId: string, forceFull = false): Promise<PullCollectionsBatchResult> {
  const uniqueCollections = [...new Set(collections)]
  const rowsByCollection: Partial<Record<BusinessCollectionName, PulledRow[]>> = {}
  const failures: PullCollectionFailure[] = []
  const pendingCollections: BusinessCollectionName[] = []
  const runningPulls: Array<Promise<void>> = []

  for (const collection of uniqueCollections) {
    const pullKey = buildPullKey(collection, familyId, forceFull)
    const runningPull = pullInFlight.get(pullKey)
    if (runningPull) {
      runningPulls.push(runningPull.then((result) => {
        if (result.failure) {
          failures.push(result.failure)
        } else {
          rowsByCollection[collection] = result.rows
        }
      }))
    } else {
      pendingCollections.push(collection)
    }
  }

  if (pendingCollections.length > 0) {
    const batchPromise = doPullCollections(pendingCollections, familyId, forceFull)
    for (const collection of pendingCollections) {
      const pullKey = buildPullKey(collection, familyId, forceFull)
      const collectionPromise = batchPromise.then((batch) => {
        const failure = batch.failures.find(item => item.collection === collection) || null
        return {
          rows: batch.rowsByCollection[collection] || [],
          failure,
        } satisfies PullCollectionInFlightResult
      })
      pullInFlight.set(pullKey, collectionPromise)
      collectionPromise.then(() => {
        if (pullInFlight.get(pullKey) === collectionPromise) {
          pullInFlight.delete(pullKey)
        }
      }, () => {
        if (pullInFlight.get(pullKey) === collectionPromise) {
          pullInFlight.delete(pullKey)
        }
      })
    }
    runningPulls.push(batchPromise.then((batch) => {
      Object.assign(rowsByCollection, batch.rowsByCollection)
      failures.push(...batch.failures)
    }))
  }

  await Promise.all(runningPulls)
  if (failures.length > 0 && Object.keys(rowsByCollection).length === 0) {
    throw new Error(formatPullFailures(failures))
  }
  return { rowsByCollection, failures }
}

export async function pullCollection(collection: BusinessCollectionName, familyId: string, forceFull = false) {
  const result = await pullCollectionsBatch([collection], familyId, forceFull)
  return result.rowsByCollection[collection] || []
}
