import { describe, expect, it } from 'vitest'

import {
  createCloudBusinessError,
  getCloudErrorCode,
  isAuthTokenError,
  isCloudConnectTimeout,
} from '@/utils/cloudError'

describe('cloudError helpers', () => {
  it('保留云对象业务错误的 errCode', () => {
    const error = createCloudBusinessError({
      errCode: 'NO_FAMILY',
      errMsg: '请先创建或加入家庭',
    })

    expect(error.message).toBe('请先创建或加入家庭')
    expect(error.code).toBe('NO_FAMILY')
    expect(error.errCode).toBe('NO_FAMILY')
    expect(getCloudErrorCode(error)).toBe('NO_FAMILY')
  })

  it('识别本地云函数连接超时', () => {
    expect(isCloudConnectTimeout(new Error('ConnectTimeoutError: Connect Timeout Error'))).toBe(true)
    expect(isCloudConnectTimeout({ message: '普通业务失败' })).toBe(false)
  })

  it('识别登录态过期错误', () => {
    expect(isAuthTokenError({ code: 'TOKEN_INVALID', message: '登录已过期' })).toBe(true)
    expect(isAuthTokenError({ errCode: 'uni-id-token-expired' })).toBe(true)
    expect(isAuthTokenError('登录状态失效，token已过期')).toBe(true)
    expect(isAuthTokenError({ message: '普通业务失败' })).toBe(false)
  })
})
