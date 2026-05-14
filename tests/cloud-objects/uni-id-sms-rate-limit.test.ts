import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMockUniCloud,
  resetDB,
  seedCollection,
} from '../helpers/mock-unicloud'

const RATE_LIMIT_ERROR = 'uni-id-sms-send-too-frequent'
const NOW = 1760000000000

function loadSmsRateLimit() {
  vi.resetModules()
  ;(globalThis as any).uniCloud = createMockUniCloud()
  return require('../../uniCloud-alipay/cloudfunctions/uni-id-co/lib/utils/sms-rate-limit')
}

function createContext(overrides: Record<string, string> = {}) {
  return {
    getUniversalClientInfo() {
      return {
        clientIP: overrides.clientIP || '127.0.0.1',
        deviceId: overrides.deviceId || 'device-a',
        appId: overrides.appId || 'app-a',
      }
    },
  }
}

function verifyRecord(overrides: Record<string, unknown>) {
  return {
    _id: `verify_${Math.random()}`,
    mobile: '13300000000',
    scene: 'login-by-sms',
    code: '123456',
    state: 0,
    ip: '127.0.0.1',
    device_uuid: 'device-a',
    rate_limit_only: true,
    rate_limit_status: 'sent',
    created_date: NOW - 60000,
    expired_date: NOW + 240000,
    ...overrides,
  }
}

describe('uni-id sms rate limit', () => {
  beforeEach(() => {
    resetDB()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  it('同手机号并发占位会被确定性 _id 拦截', async () => {
    const { createSmsSendReservation } = loadSmsRateLimit()

    await expect(createSmsSendReservation.call(createContext(), {
      mobile: '13300000000',
      scene: 'login-by-sms',
    })).resolves.toMatchObject({
      id: expect.stringContaining('sms_send_login-by-sms_13300000000_'),
    })
    await expect(createSmsSendReservation.call(createContext(), {
      mobile: '13300000000',
      scene: 'login-by-sms',
    })).rejects.toMatchObject({
      errCode: RATE_LIMIT_ERROR,
    })
  })

  it('同手机号同场景 5 分钟内只能获取 1 次', async () => {
    const { assertSmsSendRateLimit } = loadSmsRateLimit()
    seedCollection('opendb-verify-codes', [
      verifyRecord({
        mobile: '13300000000',
        scene: 'login-by-sms',
        created_date: NOW - 60000,
      }),
    ])

    await expect(assertSmsSendRateLimit.call(createContext(), {
      mobile: '13300000000',
      scene: 'login-by-sms',
    })).rejects.toMatchObject({
      errCode: RATE_LIMIT_ERROR,
    })
  })

  it('发送失败占位不参与后续限流', async () => {
    const { assertSmsSendRateLimit } = loadSmsRateLimit()
    seedCollection('opendb-verify-codes', [
      verifyRecord({
        mobile: '13300000000',
        scene: 'login-by-sms',
        rate_limit_status: 'failed',
      }),
    ])

    await expect(assertSmsSendRateLimit.call(createContext(), {
      mobile: '13300000000',
      scene: 'login-by-sms',
    })).resolves.toBeUndefined()
  })

  it('发送失败占位允许同一手机号在同一窗口内重新占位', async () => {
    const {
      createSmsSendReservation,
      RATE_LIMIT_STATUS,
      updateSmsSendReservation,
    } = loadSmsRateLimit()

    const firstReservation = await createSmsSendReservation.call(createContext(), {
      mobile: '13300000000',
      scene: 'login-by-sms',
    })
    await updateSmsSendReservation.call(createContext(), {
      reservation: firstReservation,
      status: RATE_LIMIT_STATUS.FAILED,
      reason: 'mock_send_failed',
    })

    await expect(createSmsSendReservation.call(createContext(), {
      mobile: '13300000000',
      scene: 'login-by-sms',
    })).resolves.toEqual(firstReservation)

    const res = await (globalThis as any).uniCloud
      .database()
      .collection('opendb-verify-codes')
      .doc(firstReservation.id)
      .get()

    expect(res.data[0]).toMatchObject({
      rate_limit_status: 'pending',
      rate_limit_reason: '',
    })
    await expect(createSmsSendReservation.call(createContext(), {
      mobile: '13300000000',
      scene: 'login-by-sms',
    })).rejects.toMatchObject({
      errCode: RATE_LIMIT_ERROR,
    })
  })

  it('手机号窗口外允许重新获取', async () => {
    const { assertSmsSendRateLimit } = loadSmsRateLimit()
    seedCollection('opendb-verify-codes', [
      verifyRecord({
        mobile: '13300000000',
        scene: 'login-by-sms',
        created_date: NOW - 301000,
      }),
    ])

    await expect(assertSmsSendRateLimit.call(createContext(), {
      mobile: '13300000000',
      scene: 'login-by-sms',
    })).resolves.toBeUndefined()
  })

  it('同设备切换不同手机号达到阈值后拦截', async () => {
    const { assertSmsSendRateLimit } = loadSmsRateLimit()
    seedCollection('opendb-verify-codes', [
      verifyRecord({ mobile: '13300000001', device_uuid: 'device-a' }),
      verifyRecord({ mobile: '13300000002', device_uuid: 'device-a' }),
      verifyRecord({ mobile: '13300000003', device_uuid: 'device-a' }),
    ])

    await expect(assertSmsSendRateLimit.call(createContext(), {
      mobile: '13300000004',
      scene: 'login-by-sms',
    })).rejects.toMatchObject({
      errCode: RATE_LIMIT_ERROR,
    })
  })

  it('同 IP 切换不同手机号达到阈值后拦截', async () => {
    const { assertSmsSendRateLimit } = loadSmsRateLimit()
    seedCollection('opendb-verify-codes', [
      verifyRecord({ mobile: '13300000001', ip: '10.0.0.1', device_uuid: 'device-1' }),
      verifyRecord({ mobile: '13300000002', ip: '10.0.0.1', device_uuid: 'device-2' }),
      verifyRecord({ mobile: '13300000003', ip: '10.0.0.1', device_uuid: 'device-3' }),
      verifyRecord({ mobile: '13300000004', ip: '10.0.0.1', device_uuid: 'device-4' }),
      verifyRecord({ mobile: '13300000005', ip: '10.0.0.1', device_uuid: 'device-5' }),
    ])

    await expect(assertSmsSendRateLimit.call(createContext({
      clientIP: '10.0.0.1',
      deviceId: 'device-6',
    }), {
      mobile: '13300000006',
      scene: 'login-by-sms',
    })).rejects.toMatchObject({
      errCode: RATE_LIMIT_ERROR,
    })
  })

  it('多手机号切换命中后保留 30 分钟冷却', async () => {
    const { assertSmsSendRateLimit } = loadSmsRateLimit()
    seedCollection('opendb-verify-codes', [
      verifyRecord({ mobile: '13300000001', device_uuid: 'device-a', created_date: NOW - 1200000 }),
      verifyRecord({ mobile: '13300000002', device_uuid: 'device-a', created_date: NOW - 1260000 }),
      verifyRecord({ mobile: '13300000003', device_uuid: 'device-a', created_date: NOW - 1320000 }),
    ])

    await expect(assertSmsSendRateLimit.call(createContext(), {
      mobile: '13300000004',
      scene: 'login-by-sms',
    })).rejects.toMatchObject({
      errCode: RATE_LIMIT_ERROR,
    })
  })

  it('找回密码手机号未注册时返回不发送，并写入不可用计数记录', async () => {
    const {
      createSmsSendReservation,
      RATE_LIMIT_STATUS,
      shouldSendSmsCode,
      updateSmsSendReservation,
    } = loadSmsRateLimit()
    seedCollection('uni-id-users', [])
    const reservation = await createSmsSendReservation.call(createContext(), {
      mobile: '13300000000',
      scene: 'reset-pwd-by-sms',
    })

    await expect(shouldSendSmsCode.call(createContext(), {
      mobile: '13300000000',
      scene: 'reset-pwd-by-sms',
    })).resolves.toBe(false)
    await updateSmsSendReservation.call(createContext(), {
      reservation,
      status: RATE_LIMIT_STATUS.SENT,
      reason: 'reset_pwd_mobile_not_found',
    })

    const res = await (globalThis as any).uniCloud
      .database()
      .collection('opendb-verify-codes')
      .where({
        mobile: '13300000000',
        scene: 'reset-pwd-by-sms',
        rate_limit_only: true,
        rate_limit_status: 'sent',
      })
      .get()

    expect(res.data).toHaveLength(1)
    expect(res.data[0]).toMatchObject({
      code: '',
      state: 2,
      rate_limit_reason: 'reset_pwd_mobile_not_found',
      device_uuid: 'device-a',
      ip: '127.0.0.1',
    })
  })
})
