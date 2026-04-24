import { describe, expect, it, beforeEach } from 'vitest'
import {
  createMockUniCloud,
  resetDB,
  seedCollection,
} from '../helpers/mock-unicloud'

const mockUniCloud = createMockUniCloud()
;(globalThis as any).uniCloud = mockUniCloud
const devResetService = require('../../uniCloud-alipay/cloudfunctions/dev-reset-service/index.obj.js')

describe('dev-reset-service', () => {
  const db = mockUniCloud.database()

  beforeEach(() => {
    resetDB()
  })

  it('缺少确认参数时拒绝清库', async () => {
    await expect(devResetService.resetTestData()).rejects.toMatchObject({
      code: 'CONFIRM_REQUIRED',
    })
  })

  it('默认清空业务与同步集合，保留登录账号集合', async () => {
    seedCollection('families', [{ _id: 'fam_1' }])
    seedCollection('dogs', [{ _id: 'dog_1' }])
    seedCollection('sync_mutations', [{ _id: 'sync_1' }])
    seedCollection('uni-id-users', [{ _id: 'user_1' }])

    const result = await devResetService.resetTestData({ confirm: 'RESET_TEST_DATA' })

    expect(result.totalDeleted).toBe(3)
    expect((await db.collection('families').get()).data).toHaveLength(0)
    expect((await db.collection('dogs').get()).data).toHaveLength(0)
    expect((await db.collection('sync_mutations').get()).data).toHaveLength(0)
    expect((await db.collection('uni-id-users').get()).data).toHaveLength(1)
  })

  it('显式 includeAuth 时连账号集合一起清空', async () => {
    seedCollection('families', [{ _id: 'fam_1' }])
    seedCollection('uni-id-users', [{ _id: 'user_1' }])

    const result = await devResetService.resetTestData({
      confirm: 'RESET_TEST_DATA_AND_AUTH',
      includeAuth: true,
    })

    expect(result.includeAuth).toBe(true)
    expect(result.totalDeleted).toBe(2)
    expect((await db.collection('families').get()).data).toHaveLength(0)
    expect((await db.collection('uni-id-users').get()).data).toHaveLength(0)
  })
})
