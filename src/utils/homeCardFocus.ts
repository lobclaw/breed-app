import { useAuth } from '@/composables/useAuth'
import { getWorkspaceCacheKey } from '@/utils/authScopedCache'

export type HomeCardFocusTarget = 'sick_observation' | 'medication'

export interface HomeCardFocusPayload {
  target: HomeCardFocusTarget
  createdAt: number
  familyId?: string
}

export const HOME_CARD_FOCUS_EVENT = 'home:card-focus'

const STORAGE_KEY = 'home_card_focus_v1'
const MAX_AGE_MS = 10000

function getCurrentFamilyId() {
  const { currentFamily } = useAuth()
  return currentFamily.value?._id || ''
}

function getHomeCardFocusStorageKey(familyId = getCurrentFamilyId()) {
  return familyId ? getWorkspaceCacheKey('home-card-focus', familyId) : ''
}

export function queueHomeCardFocus(target: HomeCardFocusTarget) {
  const familyId = getCurrentFamilyId()
  const payload: HomeCardFocusPayload = {
    target,
    createdAt: Date.now(),
    familyId,
  }
  const storageKey = getHomeCardFocusStorageKey(familyId)
  if (!storageKey) return payload
  uni.removeStorageSync(STORAGE_KEY)
  uni.setStorageSync(storageKey, JSON.stringify(payload))
  return payload
}

export function consumeHomeCardFocus() {
  const familyId = getCurrentFamilyId()
  const storageKey = getHomeCardFocusStorageKey(familyId)
  if (!storageKey) return null
  try {
    const raw = uni.getStorageSync(storageKey)
    if (!raw) return null
    const payload = JSON.parse(raw) as HomeCardFocusPayload
    uni.removeStorageSync(storageKey)
    if (!payload?.target) return null
    if ((payload.familyId || '') !== familyId) return null
    if (Date.now() - (payload.createdAt || 0) > MAX_AGE_MS) return null
    return payload
  } catch {
    uni.removeStorageSync(storageKey)
    return null
  }
}

export function emitHomeCardFocus(target: HomeCardFocusTarget) {
  const familyId = getCurrentFamilyId()
  const payload: HomeCardFocusPayload = {
    target,
    createdAt: Date.now(),
    familyId,
  }
  uni.$emit(HOME_CARD_FOCUS_EVENT, payload)
  return payload
}
