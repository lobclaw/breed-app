import { ref } from 'vue'
import { isNetworkAvailable, ONLINE_ONLY_MESSAGE } from '@/utils/network'

interface OnlineOnlyGuardOptions {
  message?: string
  showToast?: boolean
}

export function useOnlineOnlyGuard(defaultOptions: OnlineOnlyGuardOptions = {}) {
  const checkingOnline = ref(false)

  async function ensureOnline(options: OnlineOnlyGuardOptions = {}) {
    const message = options.message || defaultOptions.message || ONLINE_ONLY_MESSAGE
    const showToast = options.showToast ?? defaultOptions.showToast ?? true
    checkingOnline.value = true
    try {
      const online = await isNetworkAvailable()
      if (!online && showToast && typeof uni !== 'undefined') {
        uni.showToast({ title: message, icon: 'none', duration: 2000 })
      }
      return online
    } finally {
      checkingOnline.value = false
    }
  }

  return {
    checkingOnline,
    ensureOnline,
  }
}
