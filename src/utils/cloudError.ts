/**
 * 云对象错误辅助
 * 统一保留业务 errCode，并识别本地调试常见的连接超时
 */

type CloudErrorLike = {
  code?: string | number
  errCode?: string | number
  message?: string
  errMsg?: string
}

function toCloudErrorLike(value: unknown): CloudErrorLike {
  return typeof value === 'object' && value !== null ? value as CloudErrorLike : {}
}

export function createCloudBusinessError(result: unknown): Error & { code?: string | number; errCode?: string | number } {
  const source = toCloudErrorLike(result)
  const error = new Error(source.errMsg || source.message || '操作失败') as Error & {
    code?: string | number
    errCode?: string | number
  }

  if (source.errCode !== undefined) {
    error.code = source.errCode
    error.errCode = source.errCode
  }

  return error
}

export function getCloudErrorCode(error: unknown): string | number | undefined {
  const source = toCloudErrorLike(error)
  return source.code ?? source.errCode
}

export function isCloudConnectTimeout(error: unknown): boolean {
  const source = toCloudErrorLike(error)
  const message = String(source.message || source.errMsg || error || '')
  return message.includes('ConnectTimeoutError') || message.includes('Connect Timeout Error')
}

export function isAuthTokenError(error: unknown): boolean {
  const code = getCloudErrorCode(error)
  const source = toCloudErrorLike(error)
  const message = String(source.message || source.errMsg || error || '')
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
