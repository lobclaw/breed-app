/**
 * 云对象错误辅助
 * 统一保留业务 errCode，并识别本地调试常见的连接超时
 */

export function createCloudBusinessError(result: any): Error & { code?: string | number; errCode?: string | number } {
  const error = new Error(result?.errMsg || result?.message || '操作失败') as Error & {
    code?: string | number
    errCode?: string | number
  }

  if (result?.errCode !== undefined) {
    error.code = result.errCode
    error.errCode = result.errCode
  }

  return error
}

export function getCloudErrorCode(error: any): string | number | undefined {
  return error?.code ?? error?.errCode
}

export function isCloudConnectTimeout(error: any): boolean {
  const message = String(error?.message || error?.errMsg || error || '')
  return message.includes('ConnectTimeoutError') || message.includes('Connect Timeout Error')
}

export function isAuthTokenError(error: any): boolean {
  const code = getCloudErrorCode(error)
  const message = String(error?.message || error?.errMsg || error || '')
  return code === 'TOKEN_INVALID'
    || code === 'TOKEN_MISSING'
    || code === 'uni-id-token-expired'
    || code === 'uni-id-check-token-failed'
    || code === 30203
    || code === 30202
    || message.includes('登录状态失效')
    || message.includes('token已过期')
    || message.includes('登录已过期')
    || message.includes('请先登录')
}
