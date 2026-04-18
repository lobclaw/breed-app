/**
 * 认证状态管理
 * 管理登录状态、用户信息、家庭信息
 * 与 uni-id-pages 集成
 */
import { ref, computed } from 'vue'
import { cloudCall } from './useCloudCall'
import type { Family, MemberRole } from '@/types/family'
import { getCloudErrorCode, isCloudConnectTimeout } from '@/utils/cloudError'

// 全局响应式状态（跨组件共享）
const currentUser = ref<{ uid: string; token: string } | null>(null)
const currentFamily = ref<Family | null>(null)
const isInitialized = ref(false)

const FAMILY_CACHE_KEY = 'breed_family_cache'

function getTokenExpired(info: ReturnType<typeof uniCloud.getCurrentUserInfo>): number {
  const maybeInfo = info as typeof info & { tokenExpired?: number; token_expired?: number }
  return maybeInfo.tokenExpired ?? maybeInfo.token_expired ?? 0
}

function cacheFamily(family: Family | null) {
  if (family) {
    uni.setStorageSync(FAMILY_CACHE_KEY, JSON.stringify(family))
  } else {
    uni.removeStorageSync(FAMILY_CACHE_KEY)
  }
}

function restoreFamilyFromCache(): Family | null {
  try {
    const raw = uni.getStorageSync(FAMILY_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
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
  async function init() {
    if (isInitialized.value) return

    // 监听 uni-id-pages 登录成功事件
    uni.$on('uni-id-pages-login-success', async () => {
      const info = uniCloud.getCurrentUserInfo()
      if (info.uid) {
        const token = uni.getStorageSync('uni_id_token')
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
      currentUser.value = null
      currentFamily.value = null
      cacheFamily(null)
    })

    try {
      const info = uniCloud.getCurrentUserInfo()
      const token = uni.getStorageSync('uni_id_token')

      if (info.uid && getTokenExpired(info) > Date.now()) {
        currentUser.value = { uid: info.uid, token }
        // 先从缓存恢复，页面瞬间渲染正确状态
        const cached = restoreFamilyFromCache()
        if (cached) {
          currentFamily.value = cached
        }
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
    try {
      const result = await cloudCall<{ data: Family | null }>('family-service', 'getFamilyInfo')
      currentFamily.value = result.data || null
      cacheFamily(result.data || null)
      return result.data ? 'loaded' : 'no_family'
    } catch (e: any) {
      const code = getCloudErrorCode(e)
      if (code === 'NO_FAMILY') {
        currentFamily.value = null
        cacheFamily(null)
        return 'no_family'
      }

      if (code === 'TOKEN_INVALID' || code === 'TOKEN_MISSING') {
        currentUser.value = null
        currentFamily.value = null
        cacheFamily(null)
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

  /**
   * 创建家庭
   */
  async function createFamily(name: string) {
    const result = await cloudCall<{ data: { familyId: string } }>('family-service', 'createFamily', name)
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
    uni.navigateTo({ url: '/uni_modules/uni-id-pages/pages/login/login-withpwd' })
  }

  return {
    currentUser,
    currentFamily,
    isLoggedIn,
    hasFamily,
    userRole,
    isAdmin,
    isInitialized,
    init,
    loadFamily,
    createFamily,
    logout,
    navigateToLogin,
  }
}
