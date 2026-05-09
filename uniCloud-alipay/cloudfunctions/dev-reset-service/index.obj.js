/**
 * 测试环境重置工具
 * 仅用于手动清空测试数据，不参与业务链路。
 */
const db = uniCloud.database()

const BUSINESS_COLLECTIONS = [
  'families',
  'dogs',
  'breeding_cycles',
  'litters',
  'breeding_records',
  'health_records',
  'medication_tasks',
  'tasks',
  'expenses',
  'incomes',
  'sale_records',
  'agents',
  'dog_weights',
  'medication_protocols',
  'operation_logs',
  'sync_mutations',
  'attachment_deletions',
]

const AUTH_COLLECTIONS = [
  'uni-id-users',
  'uni-id-log',
  'uni-id-device',
  'opendb-device',
  'opendb-verify-codes',
  'opendb-tempdata',
  'opendb-frv-logs',
]

const CONFIRM_TEXT = 'RESET_TEST_DATA'
const CONFIRM_AUTH_TEXT = 'RESET_TEST_DATA_AND_AUTH'
const MAX_BATCHES = 1000
const BATCH_SIZE = 100

function requireConfirmation(input = {}) {
  if (input.confirm !== CONFIRM_TEXT && input.confirm !== CONFIRM_AUTH_TEXT) {
    const error = new Error(`请输入确认参数 confirm="${CONFIRM_TEXT}"`)
    error.code = 'CONFIRM_REQUIRED'
    throw error
  }
}

function normalizeCollections(input = {}) {
  const includeAuth = Boolean(input.includeAuth) || input.confirm === CONFIRM_AUTH_TEXT
  return includeAuth
    ? [...BUSINESS_COLLECTIONS, ...AUTH_COLLECTIONS]
    : [...BUSINESS_COLLECTIONS]
}

function isMissingCollectionError(error) {
  const message = String(error?.message || error?.errMsg || error || '')
  return /collection.*not.*exist|not found collection|不存在|not exist/i.test(message)
}

async function clearCollection(collectionName) {
  let deleted = 0

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { data } = await db.collection(collectionName).limit(BATCH_SIZE).get()
    const rows = Array.isArray(data) ? data : []
    if (!rows.length) break

    for (const row of rows) {
      if (!row?._id) continue
      const result = await db.collection(collectionName).doc(row._id).remove()
      deleted += Number(result?.deleted || 1)
    }

    if (rows.length < BATCH_SIZE) break
  }

  return deleted
}

module.exports = {
  async resetTestData(input = {}) {
    requireConfirmation(input)

    const collections = normalizeCollections(input)
    const result = {
      ok: true,
      includeAuth: collections.some(name => AUTH_COLLECTIONS.includes(name)),
      deleted: {},
      skipped: [],
      totalDeleted: 0,
    }

    for (const collection of collections) {
      try {
        const count = await clearCollection(collection)
        result.deleted[collection] = count
        result.totalDeleted += count
      } catch (error) {
        if (isMissingCollectionError(error)) {
          result.skipped.push(collection)
          continue
        }
        throw error
      }
    }

    return result
  },
}
