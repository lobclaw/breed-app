const DEVICE_ID_STORAGE_KEY = 'breed-local-first:device-id'

function randomPart(length = 10) {
  return Math.random().toString(36).slice(2, 2 + length)
}

export function getOrCreateDeviceId() {
  try {
    const cached = uni.getStorageSync(DEVICE_ID_STORAGE_KEY)
    if (cached) return String(cached)
  } catch {
    // ignore
  }

  const deviceId = `device_${Date.now().toString(36)}_${randomPart(8)}`
  try {
    uni.setStorageSync(DEVICE_ID_STORAGE_KEY, deviceId)
  } catch {
    // ignore
  }
  return deviceId
}

export function createClientMutationId(type: string) {
  return `${type}:${Date.now().toString(36)}:${randomPart(12)}`
}

export function createStableEntityId(collection: string) {
  return `${collection}_${Date.now().toString(36)}_${randomPart(8)}`
}

