/**
 * 认证状态管理
 * 管理登录状态、用户信息、家庭信息
 * 与 uni-id-pages 集成
 */
import { ref, computed } from 'vue'
import { cloudCall } from './useCloudCall'
import type { Family, MemberRole } from '@/types/family'

// 全局响应式状态（跨组件共享）
const currentUser = ref<{ uid: string; token: string } | null>(null)
const currentFamily = ref<Family | null>(null)
const isInitialized = ref(false)

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
        await loadFamily()
        // 登录后如果没有家庭，跳转到创建家庭页
        if (!currentFamily.value) {
          uni.redirectTo({ url: '/pages/family/setup' })
        }
      }
    })

    // 监听退出登录事件
    uni.$on('uni-id-pages-logout', () => {
      currentUser.value = null
      currentFamily.value = null
    })

    try {
      const info = uniCloud.getCurrentUserInfo()
      const token = uni.getStorageSync('uni_id_token')

      if (info.uid && info.tokenExpired > Date.now()) {
        currentUser.value = { uid: info.uid, token }
        await loadFamily()
      }
    } catch {
      // 静默失败，uni-id-pages 的 uniIdRouter 会自动跳转登录页
    } finally {
      isInitialized.value = true
    }
  }

  /**
   * 加载当前用户的家庭信息
   */
  async function loadFamily() {
    try {
      const result = await cloudCall<{ data: Family }>('family-service', 'getFamilyInfo')
      currentFamily.value = result.data
    } catch (e: any) {
      currentFamily.value = null
      // 区分"没有家庭"和网络错误
      const code = e.code || e.errCode
      if (code && code !== 'NO_FAMILY') {
        console.warn('加载家庭信息失败:', e.message || e)
      }
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
