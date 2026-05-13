/**
 * 认证状态管理
 * 管理登录状态、用户信息、家庭信息
 * 与 uni-id-pages 集成
 */
import { ref, computed } from 'vue'
import { cloudCall } from './useCloudCall'
import type { Family, MemberRole } from '@/types/family'
import { getCloudErrorCode, isCloudConnectTimeout } from '@/utils/cloudError'
import { localDb } from '@/localdb/db'
import { localSyncRuntime } from '@/localdb/runtime'
import { useDogStore } from '@/stores/dogStore'
import { useProtocolStore } from '@/stores/protocolStore'
import { useTaskStore } from '@/stores/taskStore'
import {
  getFamilyCacheKey,
  isFamilyAccessibleToUid,
  readStorageJson,
  removeStorageKey,
  writeStorageJson,
} from '@/utils/authScopedCache'

// 全局响应式状态（跨组件共享）
const currentUser = ref<{ uid: string; token: string } | null>(null)
const currentFamily = ref<Family | null>(null)
const isInitialized = ref(false)
const isFamilyVerified = ref(false)
let authSessionVersion = 0

function bumpAuthSessionVersion() {
  authSessionVersion += 1
  return authSessionVersion
}

function getTokenExpired(info: ReturnType<typeof uniCloud.getCurrentUserInfo>): number {
  const maybeInfo = info as typeof info & { tokenExpired?: number; token_expired?: number }
  return maybeInfo.tokenExpired ?? maybeInfo.token_expired ?? 0
}

function getCurrentUid() {
  try {
    return String((uniCloud as any)?.getCurrentUserInfo?.()?.uid || currentUser.value?.uid || '').trim()
  } catch {
    return currentUser.value?.uid || ''
  }
}

function isStaleAuthRequest(uid: string, version: number) {
  const currentUid = currentUser.value?.uid || getCurrentUid()
  return version !== authSessionVersion || (!!uid && !!currentUid && uid !== currentUid)
}

function cacheFamily(family: Family, uidInput?: string) {
  const uid = uidInput || currentUser.value?.uid || getCurrentUid()
  if (!uid || !isFamilyAccessibleToUid(family, uid)) return
  writeStorageJson(getFamilyCacheKey(uid), family)
}

function removeFamilyCache(uidInput?: string) {
  const uid = uidInput || currentUser.value?.uid || getCurrentUid()
  if (!uid) return
  removeStorageKey(getFamilyCacheKey(uid))
}

function restoreFamilyFromCache(uidInput?: string): Family | null {
  const uid = uidInput || currentUser.value?.uid || getCurrentUid()
  if (!uid) return null
  const family = readStorageJson<Family>(getFamilyCacheKey(uid))
  if (!isFamilyAccessibleToUid(family, uid)) {
    removeStorageKey(getFamilyCacheKey(uid))
    return null
  }
  return family
}

function shouldSkipAuthProbeInH5Dev(): boolean {
  // #ifdef H5
  return typeof window !== 'undefined' && window.location.hostname === 'localhost'
  // #endif
  return false
}

type LoadFamilyResult = 'loaded' | 'no_family' | 'error'

export function useAuth() {
  const isLoggedIn = computed(() => !!currentUser.value)
  const hasFamily = computed(() => !!currentFamily.value)
  const userRole = computed<MemberRole | null>(() => {
    if (!currentFamily.value || !currentUser.value) return null
    const member = currentFamily.value.members.find(
      m => m.user_id === currentUser.value!.uid && m.status === 'active'
    )
    return member?.role ?? null
  })
  const isAdmin = computed(() => userRole.value === 'creator' || userRole.value === 'admin')

  /**
   * 初始化认证状态（App 启动时调用）
   * 监听 uni-id-pages 登录成功事件
   */
  function clearCurrentSession() {
    currentFamily.value = null
    isFamilyVerified.value = false
    localSyncRuntime.setCurrentFamilyId('')
    useTaskStore().clearCurrentSession()
    useDogStore().clearCurrentSession()
    useProtocolStore().clearCurrentSession()
  }

  function clearAuthScopedLocalState() {
    clearCurrentSession()
  }

  function restoreWorkspaceForFamily(familyId: string) {
    if (!familyId) return
    useTaskStore().restoreForFamily(familyId)
    useDogStore().restoreForFamily(familyId)
    useProtocolStore().restoreForFamily(familyId)
  }

  function shouldRestoreWorkspaceForFamily(family: Family) {
    const previousFamilyId = currentFamily.value?._id || ''
    return !isFamilyVerified.value || previousFamilyId !== family._id
  }

  async function init() {
    if (isInitialized.value) return

    // 监听 uni-id-pages 登录成功事件
    uni.$on('uni-id-pages-login-success', async () => {
      const info = uniCloud.getCurrentUserInfo()
      if (info.uid) {
        const token = uni.getStorageSync('uni_id_token')
        bumpAuthSessionVersion()
        clearCurrentSession()
        currentUser.value = { uid: info.uid, token }
        const loadResult = await loadFamily()
        // 登录后如果没有家庭，跳转到创建家庭页
        if (loadResult === 'no_family') {
          uni.redirectTo({ url: '/pages/family/setup' })
        }
      }
    })

    // 监听退出登录事件
    uni.$on('uni-id-pages-logout', () => {
      bumpAuthSessionVersion()
      currentUser.value = null
      clearCurrentSession()
    })

    if (shouldSkipAuthProbeInH5Dev()) {
      isInitialized.value = true
      return
    }

    try {
      const info = uniCloud.getCurrentUserInfo()
      const token = uni.getStorageSync('uni_id_token')

      if (info.uid && getTokenExpired(info) > Date.now()) {
        bumpAuthSessionVersion()
        currentUser.value = { uid: info.uid, token }
        // 只探测当前 uid 的家庭身份缓存；业务响应式状态需等待 loadFamily 权限确认后恢复。
        restoreFamilyFromCache(info.uid)
        isInitialized.value = true
        // 后台静默刷新最新数据
        loadFamily()
      } else {
        isInitialized.value = true
      }
    } catch {
      // 静默失败，uni-id-pages 的 uniIdRouter 会自动跳转登录页
      isInitialized.value = true
    }
  }

  /**
   * 加载当前用户的家庭信息
   */
  async function loadFamily(): Promise<LoadFamilyResult> {
    const requestUid = currentUser.value?.uid || getCurrentUid()
    const requestVersion = authSessionVersion
    try {
      const result = await cloudCall<{ data: Family | null }>('family-service', 'getFamilyInfo')
      if (isStaleAuthRequest(requestUid, requestVersion)) return 'error'
      const family = result.data || null
      const shouldRestoreWorkspace = family ? shouldRestoreWorkspaceForFamily(family) : false
      currentFamily.value = family
      if (family) {
        cacheFamily(family)
        isFamilyVerified.value = true
        if (shouldRestoreWorkspace) restoreWorkspaceForFamily(family._id)
        return 'loaded'
      }
      removeFamilyCache()
      clearCurrentSession()
      isFamilyVerified.value = true
      return 'no_family'
    } catch (e: any) {
      if (isStaleAuthRequest(requestUid, requestVersion)) return 'error'
      const code = getCloudErrorCode(e)
      if (code === 'NO_FAMILY') {
        removeFamilyCache()
        clearCurrentSession()
        isFamilyVerified.value = true
        return 'no_family'
      }

      if (code === 'TOKEN_INVALID' || code === 'TOKEN_MISSING') {
        bumpAuthSessionVersion()
        currentUser.value = null
        clearCurrentSession()
        console.warn('加载家庭信息失败:', e.message || e)
        return 'error'
      }

      if (isCloudConnectTimeout(e)) {
        console.warn('加载家庭信息失败，本地云函数连接超时:', e.message || e)
      } else {
        console.warn('加载家庭信息失败:', e.message || e)
      }
      return 'error'
    }
  }

  function setCurrentFamily(family: Family | null) {
    currentFamily.value = family
    if (family) {
      cacheFamily(family)
      isFamilyVerified.value = true
    } else {
      removeFamilyCache()
      isFamilyVerified.value = true
    }
  }

  async function refreshFamilyFromLocal(familyIdInput?: string): Promise<boolean> {
    const familyId = familyIdInput || currentFamily.value?._id || ''
    if (!familyId) return false
    const localFamily = await localDb.findById<Family>('families', familyId)
    if (!localFamily) return false
    setCurrentFamily(localFamily)
    return true
  }

  async function ensureFamilyLocalMirror(familyIdInput?: string): Promise<boolean> {
    const family = currentFamily.value
    const familyId = familyIdInput || family?._id || ''
    if (!familyId) return false
    const localFamily = await localDb.findById<Family>('families', familyId)
    if (localFamily) return true
    if (!family || family._id !== familyId) return false
    await localDb.upsertRows('families', [{
      ...family,
      updated_at: Number(family.updated_at || Date.now()),
    }])
    return true
  }

  /**
   * 创建家庭
   */
  async function createFamily(input: string | { name: string; nickname?: string }) {
    const result = await cloudCall<{ data: { familyId: string } }>('family-service', 'createFamily', input)
    await loadFamily()
    return result.data.familyId
  }

  /**
   * 退出登录（调用 uni-id-pages 的 logout）
   */
  async function logout() {
    // @ts-ignore
    const { mutations } = await import('@/uni_modules/uni-id-pages/common/store.js')
    mutations.logout()
  }

  /**
   * 跳转到登录页
   */
  function navigateToLogin() {
    uni.navigateTo({ url: '/uni_modules/uni-id-pages/pages/login/login-withoutpwd' })
  }

  return {
    currentUser,
    currentFamily,
    isFamilyVerified,
    isLoggedIn,
    hasFamily,
    userRole,
    isAdmin,
    isInitialized,
    init,
    loadFamily,
    setCurrentFamily,
    refreshFamilyFromLocal,
    ensureFamilyLocalMirror,
    createFamily,
    logout,
    navigateToLogin,
    clearAuthScopedLocalState,
    clearCurrentSession,
  }
}
