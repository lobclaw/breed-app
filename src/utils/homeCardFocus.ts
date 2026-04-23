export type HomeCardFocusTarget = 'sick_observation' | 'medication'

export interface HomeCardFocusPayload {
  target: HomeCardFocusTarget
  createdAt: number
}

export const HOME_CARD_FOCUS_EVENT = 'home:card-focus'

const STORAGE_KEY = 'home_card_focus_v1'
const MAX_AGE_MS = 10000

export function queueHomeCardFocus(target: HomeCardFocusTarget) {
  const payload: HomeCardFocusPayload = {
    target,
    createdAt: Date.now(),
  }
  uni.setStorageSync(STORAGE_KEY, JSON.stringify(payload))
  return payload
}

export function consumeHomeCardFocus() {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (!raw) return null
    const payload = JSON.parse(raw) as HomeCardFocusPayload
    uni.removeStorageSync(STORAGE_KEY)
    if (!payload?.target) return null
    if (Date.now() - (payload.createdAt || 0) > MAX_AGE_MS) return null
    return payload
  } catch {
    uni.removeStorageSync(STORAGE_KEY)
    return null
  }
}

export function emitHomeCardFocus(target: HomeCardFocusTarget) {
  const payload: HomeCardFocusPayload = {
    target,
    createdAt: Date.now(),
  }
  uni.$emit(HOME_CARD_FOCUS_EVENT, payload)
  return payload
}
