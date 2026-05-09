import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildOperationLogFilterSignature,
  readOperationLogCacheEntry,
  writeOperationLogCacheEntry,
} from '../../src/utils/operationLogCache'

describe('operation log cache', () => {
  const familyId = 'family_1'
  let storage: Map<string, string>

  beforeEach(() => {
    storage = new Map()
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn((key: string) => storage.get(key) || ''),
      setStorageSync: vi.fn((key: string, value: string) => {
        storage.set(key, value)
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('全部筛选在线写入缓存后，离线刷新应使用同一稳定签名读出缓存', () => {
    const onlineSignature = buildOperationLogFilterSignature({
      range: 'all',
      customStartDate: 0,
      customEndDate: 0,
      actorUserIds: ['u2', 'u1', 'u1'],
      actionTypes: ['update', 'create'],
      now: 1762333200000,
    })
    const rawLogs = [
      { _id: 'log_1', action_type: 'update', summary: '修改资料', created_at: 1762333200000 },
    ]

    writeOperationLogCacheEntry(familyId, onlineSignature, rawLogs, true)

    const offlineSignature = buildOperationLogFilterSignature({
      range: 'all',
      customStartDate: 0,
      customEndDate: 0,
      actorUserIds: ['u1', 'u2'],
      actionTypes: ['create', 'update'],
      now: 1762336800000,
    })
    const cached = readOperationLogCacheEntry(familyId, offlineSignature)

    expect(offlineSignature).toBe(onlineSignature)
    expect(cached?.rawLogs).toEqual(rawLogs)
    expect(cached?.hasMore).toBe(true)
  })

  it('今天筛选同一北京时间日期内应稳定命中缓存', () => {
    const onlineSignature = buildOperationLogFilterSignature({
      range: 'today',
      customStartDate: 0,
      customEndDate: 0,
      now: Date.UTC(2026, 4, 9, 1),
    })
    const rawLogs = [
      { _id: 'log_today', action_type: 'create', summary: '新增记录', created_at: Date.UTC(2026, 4, 9, 1) },
    ]

    writeOperationLogCacheEntry(familyId, onlineSignature, rawLogs, false)

    const offlineSignature = buildOperationLogFilterSignature({
      range: 'today',
      customStartDate: 0,
      customEndDate: 0,
      now: Date.UTC(2026, 4, 9, 10),
    })
    const cached = readOperationLogCacheEntry(familyId, offlineSignature)

    expect(offlineSignature).toBe(onlineSignature)
    expect(cached?.rawLogs).toEqual(rawLogs)
    expect(cached?.hasMore).toBe(false)
  })
})
