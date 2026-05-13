import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import { localSyncRuntime } from '@/localdb/runtime'
import { resolveSyncScopeForRoute } from '@/localdb/scope-registry'

interface UsePageSyncOptions {
  routePath?: string
  resolveScope?: (query: Record<string, any>) => string | null
}

export function usePageSync(options: UsePageSyncOptions) {
  let scopeKey = ''

  async function persistActiveScope(scope: string) {
    const { currentFamily } = useAuth()
    const familyId = currentFamily.value?._id || ''
    if (!familyId || !scope) return
    localSyncRuntime.setCurrentFamilyId(familyId)
    await localSyncRuntime.setActiveScope(scope)
  }

  async function activateScope(query: Record<string, any> = {}) {
    if (options.resolveScope) {
      scopeKey = options.resolveScope(query) || ''
      if (scopeKey) {
        await persistActiveScope(scopeKey)
      }
      return scopeKey
    }

    if (!options.routePath) return ''
    const resolved = resolveSyncScopeForRoute(options.routePath, query)
    scopeKey = resolved?.key || ''
    if (!scopeKey) return ''
    await persistActiveScope(scopeKey)
    return scopeKey
  }

  async function syncCurrentScope(force = false) {
    const { currentFamily } = useAuth()
    const familyId = currentFamily.value?._id || ''
    if (!familyId || !scopeKey) return null
    localSyncRuntime.setCurrentFamilyId(familyId)
    return force
      ? localSyncRuntime.forceSyncScope(scopeKey)
      : localSyncRuntime.syncScope(scopeKey)
  }

  onLoad((query) => {
    void activateScope((query || {}) as Record<string, any>)
  })

  onShow(() => {
    void syncCurrentScope(false)
  })

  onPullDownRefresh(() => {
    void syncCurrentScope(true).finally(() => {
      uni.stopPullDownRefresh()
    })
  })

  return {
    getScopeKey: () => scopeKey,
    activateScope,
    syncCurrentScope,
  }
}
