/**
 * UniCloud API mock
 * 模拟云数据库操作，用于 vitest 测试云对象逻辑
 */
import { vi } from 'vitest'

// 内存数据库
const collections: Record<string, any[]> = {}

function getCollection(name: string) {
  if (!collections[name]) {
    collections[name] = []
  }
  return collections[name]
}

/** 重置所有集合 */
export function resetDB() {
  for (const key of Object.keys(collections)) {
    delete collections[key]
  }
}

/** 种子数据 */
export function seedCollection(name: string, docs: any[]) {
  collections[name] = [...docs]
}

/** 创建 mock db command */
function createDbCommand() {
  return {
    push: (val: any) => ({ $push: val }),
    pull: (val: any) => ({ $pull: val }),
    inc: (val: number) => ({ $inc: val }),
    set: (val: any) => ({ $set: val }),
    lte: (val: any) => ({ $lte: val }),
    gte: (val: any) => ({ $gte: val }),
    eq: (val: any) => ({ $eq: val }),
    neq: (val: any) => ({ $neq: val }),
    in: (val: any[]) => ({ $in: val }),
  }
}

/** 模拟查询链 */
function createQueryChain(collectionName: string) {
  let filterFn: ((doc: any) => boolean) | null = null
  let fieldProjection: Record<string, boolean> | null = null
  let sortField: string | null = null
  let sortOrder: 'asc' | 'desc' = 'asc'
  let limitCount = 0
  let docId: string | null = null

  const chain: any = {
    doc(id: string) {
      docId = id
      return chain
    },
    where(condition: any) {
      if (typeof condition === 'function') {
        filterFn = condition
      } else {
        filterFn = (doc: any) => {
          for (const [key, val] of Object.entries(condition)) {
            // 支持嵌套点号路径查询，如 'members.user_id'
            const docVal = getNestedValue(doc, key)
            if (val && typeof val === 'object' && '$lte' in (val as any)) {
              if (docVal > (val as any).$lte) return false
            } else if (val && typeof val === 'object' && '$in' in (val as any)) {
              if (!(val as any).$in.includes(docVal)) return false
            } else if (Array.isArray(docVal)) {
              // 数组字段包含查询（如 members.user_id 匹配嵌入数组）
              if (!docVal.includes(val)) return false
            } else {
              if (docVal !== val) return false
            }
          }
          return true
        }
      }
      return chain
    },
    field(projection: Record<string, boolean>) {
      fieldProjection = projection
      return chain
    },
    orderBy(field: string, order: 'asc' | 'desc') {
      sortField = field
      sortOrder = order
      return chain
    },
    limit(n: number) {
      limitCount = n
      return chain
    },
    async get() {
      const col = getCollection(collectionName)

      if (docId) {
        const doc = col.find(d => d._id === docId)
        return { data: doc ? [doc] : [] }
      }

      let results = filterFn ? col.filter(filterFn) : [...col]

      if (sortField) {
        const sf = sortField
        results.sort((a, b) => {
          const av = a[sf], bv = b[sf]
          return sortOrder === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
        })
      }

      if (limitCount > 0) {
        results = results.slice(0, limitCount)
      }

      if (fieldProjection) {
        const fp = fieldProjection
        results = results.map(doc => {
          const projected: any = { _id: doc._id }
          for (const key of Object.keys(fp)) {
            if (fp[key] && doc[key] !== undefined) {
              projected[key] = doc[key]
            }
          }
          return projected
        })
      }

      return { data: results }
    },
    async count() {
      const col = getCollection(collectionName)
      const results = filterFn ? col.filter(filterFn) : col
      return { total: results.length }
    },
    async add(data: any) {
      const col = getCollection(collectionName)
      const id = data._id || `mock_${collectionName}_${col.length + 1}`
      const doc = { ...data, _id: id }
      col.push(doc)
      return { id }
    },
    async update(data: any) {
      const col = getCollection(collectionName)
      let targets: any[]

      if (docId) {
        targets = col.filter(d => d._id === docId)
      } else if (filterFn) {
        targets = col.filter(filterFn)
      } else {
        targets = []
      }

      for (const doc of targets) {
        for (const [key, val] of Object.entries(data)) {
          if (val && typeof val === 'object' && '$push' in (val as any)) {
            if (!Array.isArray(doc[key])) doc[key] = []
            doc[key].push((val as any).$push)
          } else if (val && typeof val === 'object' && '$inc' in (val as any)) {
            doc[key] = (doc[key] || 0) + (val as any).$inc
          } else {
            // 支持点号路径更新，如 'settings.default_weaning_days'
            setNestedValue(doc, key, val)
          }
        }
      }

      return { updated: targets.length }
    },
    async remove() {
      const col = getCollection(collectionName)
      const idx = docId ? col.findIndex(d => d._id === docId) : -1
      if (idx >= 0) {
        col.splice(idx, 1)
        return { deleted: 1 }
      }
      return { deleted: 0 }
    },
  }

  return chain
}

function getNestedValue(obj: any, path: string) {
  // 处理嵌入数组的查询（如 'members.user_id' 在 members 数组中查找）
  const parts = path.split('.')
  let current = obj
  for (let i = 0; i < parts.length; i++) {
    if (current === undefined || current === null) return undefined
    if (Array.isArray(current)) {
      // 在数组中查找：返回所有元素的该字段值数组
      const remaining = parts.slice(i).join('.')
      return current.map(item => getNestedValue(item, remaining))
    }
    current = current[parts[i]]
  }
  return current
}

function setNestedValue(obj: any, path: string, value: any) {
  const parts = path.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined) current[parts[i]] = {}
    current = current[parts[i]]
  }
  current[parts[parts.length - 1]] = value
}

/** 创建 mock uniCloud 全局对象 */
export function createMockUniCloud() {
  const mockDb = {
    collection: (name: string) => createQueryChain(name),
    command: createDbCommand(),
  }

  const uniCloud = {
    database: () => mockDb,
    auth: () => ({
      getUserInfo: vi.fn().mockResolvedValue({ uid: 'test_uid' }),
    }),
    request: vi.fn(),
  }

  return uniCloud
}

/**
 * 将云对象文件加载为可测试的模块
 * 模拟 this 上下文（uid, familyId, role, getUniIdToken, getMethodName）
 */
export function createCloudObjectContext(overrides?: {
  uid?: string
  familyId?: string | null
  role?: string | null
  token?: string
  methodName?: string
}) {
  return {
    uid: overrides?.uid ?? 'test_uid',
    familyId: overrides?.familyId ?? 'test_family_id',
    role: overrides?.role ?? 'creator',
    getUniIdToken: () => overrides?.token ?? 'mock_token',
    getMethodName: () => overrides?.methodName ?? '',
  }
}
