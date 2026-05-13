import type { Family } from '@/types/family'
import { getBeijingDayStart } from '@/utils/date'

export const FAMILY_CACHE_KEY_PREFIX = 'breed_family_cache:'
export const WORKSPACE_CACHE_KEY_PREFIX = 'breed_workspace_cache:'
export const WORKSPACE_CACHE_VERSION = 1

export type WorkspaceCacheKind = 'tasks' | 'dogs' | 'protocols'

export function getFamilyCacheKey(uid: string) {
  return `${FAMILY_CACHE_KEY_PREFIX}${uid}`
}

export function getWorkspaceCacheKey(kind: WorkspaceCacheKind, familyId: string) {
  return `${WORKSPACE_CACHE_KEY_PREFIX}${kind}:${familyId}`
}

export function getTodayWorkspaceDayKey(now = Date.now()) {
  return String(getBeijingDayStart(now))
}

export function readStorageJson<T>(key: string): T | null {
  try {
    const raw = uni.getStorageSync(key)
    if (!raw) return null
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T
  } catch {
    return null
  }
}

export function writeStorageJson<T>(key: string, value: T) {
  uni.setStorageSync(key, JSON.stringify(value))
}

export function removeStorageKey(key: string) {
  uni.removeStorageSync(key)
}

export function isFamilyAccessibleToUid(family: Family | null | undefined, uid: string) {
  if (!family || !uid) return false
  if (family.creator_id === uid) return true
  return (family.members || []).some(member => member.user_id === uid && member.status === 'active')
}
