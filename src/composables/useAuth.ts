/**
 * 认证状态管理
 * 管理登录状态、用户信息、家庭信息
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
   * 检查本地缓存的 token，如果有效则恢复登录状态
   */
  async function init() {
    if (isInitialized.value) return

    try {
      const token = uni.getStorageSync('uni_id_token')
      if (!token) {
        isInitialized.value = true
        return
      }

      // 验证 token 有效性
      const { result } = await uniCloud.callFunction({
        name: 'uni-id-co',
        data: { method: 'checkToken' }
      })

      if (result?.uid) {
        currentUser.value = { uid: result.uid, token }
        await loadFamily()
      } else {
        // token 过期，清除
        uni.removeStorageSync('uni_id_token')
      }
    } catch {
      // 静默失败，用户需要重新登录
    } finally {
      isInitialized.value = true
    }
  }

  /**
   * 登录成功后调用（uni-id-pages 登录成功回调中使用）
   */
  async function onLoginSuccess(uid: string, token: string) {
    currentUser.value = { uid, token }
    await loadFamily()
  }

  /**
   * 加载当前用户的家庭信息
   */
  async function loadFamily() {
    try {
      const result = await cloudCall<{ data: Family }>('family-service', 'getFamilyInfo')
      currentFamily.value = result.data
    } catch {
      // 用户可能还没有家庭
      currentFamily.value = null
    }
  }

  /**
   * 创建家庭
   */
  async function createFamily(name: string) {
    const result = await cloudCall<{ data: { familyId: string } }>('family-service', 'createFamily', name)
    // 创建后重新加载家庭信息
    await loadFamily()
    return result.data.familyId
  }

  /**
   * 退出登录
   */
  function logout() {
    currentUser.value = null
    currentFamily.value = null
    uni.removeStorageSync('uni_id_token')
    uni.reLaunch({ url: '/pages/index/index' })
  }

  /**
   * 跳转到登录页
   */
  function navigateToLogin() {
    uni.navigateTo({ url: '/uni_modules/uni-id-pages/pages/login/login-withoutpwd' })
  }

  return {
    // 状态
    currentUser,
    currentFamily,
    isLoggedIn,
    hasFamily,
    userRole,
    isAdmin,
    isInitialized,
    // 方法
    init,
    onLoginSuccess,
    loadFamily,
    createFamily,
    logout,
    navigateToLogin,
  }
}
