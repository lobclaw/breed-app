import { localDb } from '@/localdb/db'
import { getSyncScopeDefinition, type ResolvedSyncScope, type SyncScopeMode } from '@/localdb/scope-registry'
import type { BusinessCollectionName } from '@/localdb/types'

export interface StoredScopeFreshness {
  scopeKey: string
  routeKey: string
  routePath: string
  last_synced_at: number
  last_full_sync_at: number
  last_error: string | null
  last_skip_reason: string | null
  ttl_ms: number
  mode: SyncScopeMode
}

export interface SyncScopeResult {
  scopeKey: string
  routeKey: string
  pulledCollections: BusinessCollectionName[]
  skipped: boolean
  skipReason: string | null
  lastSyncedAt: number
  force: boolean
}

export function buildFamilyMetaKey(key: string, familyId: string) {
  return familyId ? `${key}:${familyId}` : key
}

export function buildScopeMetaKey(scopeKey: string, familyId = '') {
  return familyId ? `sync:scope:${familyId}:${scopeKey}` : `sync:scope:${scopeKey}`
}

function rowBelongsToFamily(row: Record<string, any>, familyId: string) {
  if (!familyId) return true
  return row?.family_id === familyId || row?._id === familyId
}

function getScopeRouteKey(scopeKey: string) {
  return scopeKey.split(':')[0] || scopeKey
}

export function createResolvedScope(scopeKey: string): ResolvedSyncScope {
  const routeKey = getScopeRouteKey(scopeKey)
  const definition = getSyncScopeDefinition(routeKey)
  if (!definition) {
    throw new Error(`未知 sync scope: ${scopeKey}`)
  }

  return {
    key: scopeKey,
    routeKey,
    routePath: '',
    mode: definition.mode,
    ttlMs: definition.ttlMs,
    collections: [...definition.collections],
  }
}

export function toScopeFreshness(scope: ResolvedSyncScope, current?: Partial<StoredScopeFreshness> | null): StoredScopeFreshness {
  return {
    scopeKey: scope.key,
    routeKey: scope.routeKey,
    routePath: scope.routePath,
    last_synced_at: Number(current?.last_synced_at || 0),
    last_full_sync_at: Number(current?.last_full_sync_at || 0),
    last_error: current?.last_error || null,
    last_skip_reason: current?.last_skip_reason || null,
    ttl_ms: scope.ttlMs,
    mode: scope.mode,
  }
}

export async function hasCollectionsData(collections: BusinessCollectionName[], familyId = '') {
  const uniqueCollections = [...new Set(collections)]
  const rows = await Promise.all(uniqueCollections.map(collection => localDb.getTable<any>(collection)))
  return rows.some(items => items.some(row => rowBelongsToFamily(row, familyId)))
}
