/**
 * 云对象调用封装
 * 统一处理 loading / error / retry / toast 提示
 */
import { ref } from 'vue'

interface CloudCallOptions {
  /** 成功后的提示文字（不设置则不提示） */
  successMessage?: string
  /** 失败后是否自动 toast 提示，默认 true */
  showError?: boolean
  /** 是否在调用前显示 loading，默认 false */
  showLoading?: boolean
  /** loading 提示文字 */
  loadingText?: string
}

interface CloudCallResult<T> {
  /** 是否正在请求 */
  loading: ReturnType<typeof ref<boolean>>
  /** 最近一次错误 */
  error: ReturnType<typeof ref<string | null>>
  /** 执行云对象方法 */
  run: (...args: any[]) => Promise<T | null>
}

/**
 * 封装云对象调用
 * @param serviceName 云对象名称（如 'dog-service'）
 * @param methodName 方法名（如 'getDogListWithStatus'）
 * @param options 配置项
 *
 * @example
 * const { loading, error, run } = useCloudCall('dog-service', 'getDogListWithStatus')
 * const data = await run()
 */
export function useCloudCall<T = any>(
  serviceName: string,
  methodName: string,
  options: CloudCallOptions = {}
): CloudCallResult<T> {
  const loading = ref(false)
  const error = ref<string | null>(null)

  const {
    successMessage,
    showError = true,
    showLoading = false,
    loadingText = '加载中...',
  } = options

  async function run(...args: any[]): Promise<T | null> {
    loading.value = true
    error.value = null

    if (showLoading) {
      uni.showLoading({ title: loadingText, mask: true })
    }

    try {
      const service = uniCloud.importObject(serviceName)
      const result = await (service as any)[methodName](...args)

      if (result.code !== 0) {
        throw new Error(result.message || '操作失败')
      }

      if (successMessage) {
        uni.showToast({ title: successMessage, icon: 'success' })
      }

      return result as T
    } catch (e: any) {
      const msg = e.message || '网络错误，请稍后重试'
      error.value = msg

      if (showError) {
        uni.showToast({ title: msg, icon: 'none', duration: 2000 })
      }

      return null
    } finally {
      loading.value = false
      if (showLoading) {
        uni.hideLoading()
      }
    }
  }

  return { loading, error, run }
}

/**
 * 简单版：一次性调用，返回 Promise
 * 适合不需要跟踪 loading 状态的场景
 *
 * @example
 * const result = await cloudCall('family-service', 'getFamilyInfo')
 */
export async function cloudCall<T = any>(
  serviceName: string,
  methodName: string,
  ...args: any[]
): Promise<T> {
  const service = uniCloud.importObject(serviceName)
  const result = await (service as any)[methodName](...args)

  if (result.code !== 0) {
    throw new Error(result.message || '操作失败')
  }

  return result as T
}
