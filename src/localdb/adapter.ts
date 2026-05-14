import type { LocalCollectionName } from '@/localdb/types'
import { LOCAL_COLLECTIONS } from '@/localdb/types'

declare const plus: any

export const STORAGE_V2_ENABLED_KEY = 'breed-local-first:storage:v2:enabled'

export type MigrationState = 'pending' | 'migrating' | 'migrated' | `failed:${string}`

export interface LocalRowRecord {
  collection: LocalCollectionName
  id: string
  family_id: string
  updated_at: number
  deleted_at: number
  flags: string
  value: string
}

export interface KeyValueAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export interface LocalRowAdapter {
  getAllRows(collection: LocalCollectionName): Promise<LocalRowRecord[]>
  getRow(collection: LocalCollectionName, id: string): Promise<LocalRowRecord | null>
  getRowsByIds(collection: LocalCollectionName, ids: string[]): Promise<LocalRowRecord[]>
  putRows(collection: LocalCollectionName, rows: LocalRowRecord[]): Promise<void>
  deleteRows(collection: LocalCollectionName, ids: string[]): Promise<void>
  deleteRowsByFamily(collection: LocalCollectionName, familyId: string): Promise<void>
  replaceRows(collection: LocalCollectionName, rows: LocalRowRecord[]): Promise<void>
  getCollectionRevision(collection: LocalCollectionName): Promise<number>
  resetForTest?(): Promise<void>
}

export type LocalDbAdapter = KeyValueAdapter & LocalRowAdapter

function normalizeCollection(collection: LocalCollectionName) {
  const isKnownCollection = (LOCAL_COLLECTIONS as readonly string[]).includes(collection)
  return isKnownCollection ? collection : 'unknown'
}

function buildRowKey(collection: LocalCollectionName, id: string) {
  return `${normalizeCollection(collection)}:${id}`
}

function getRevisionKey(collection: LocalCollectionName) {
  return `breed-local-first:storage:v2:revision:${normalizeCollection(collection)}`
}

function toRevision(value: string | null) {
  return Number(value || 0) || 0
}

function getRowsFromLegacyPayload(collection: LocalCollectionName, raw: string | null): LocalRowRecord[] {
  if (!raw) return []
  try {
    const rows = JSON.parse(raw)
    if (!Array.isArray(rows)) return []
    return rows
      .filter(row => row && typeof row === 'object' && row._id)
      .map(row => toLocalRowRecord(collection, row))
  } catch {
    return []
  }
}

export function getMigrationStorageKey(collection: LocalCollectionName) {
  return `breed-local-first:storage:v2:migration:${normalizeCollection(collection)}`
}

export function getCollectionStorageKey(collection: LocalCollectionName) {
  return `breed-local-first:${normalizeCollection(collection)}`
}

export function toLocalRowRecord(collection: LocalCollectionName, row: Record<string, any>): LocalRowRecord {
  const familyId = String(row.family_id || (collection === 'families' ? row._id || '' : ''))
  const pendingUpload = Boolean(row._pending_upload || row.pending_upload)
  const hasUploadError = Boolean(row._upload_error || row.upload_error)
  const flags = JSON.stringify({
    pending_upload: pendingUpload,
    upload_error: hasUploadError,
  })
  return {
    collection,
    id: String(row._id || ''),
    family_id: familyId,
    updated_at: Number(row.updated_at || row.created_at || 0),
    deleted_at: Number(row.deleted_at || 0),
    flags,
    value: JSON.stringify(row),
  }
}

class MemoryAdapter implements LocalDbAdapter {
  private store = new Map<string, string>()
  private rows = new Map<string, LocalRowRecord>()
  private revisions = new Map<LocalCollectionName, number>()

  async get(key: string) {
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string) {
    this.store.set(key, value)
  }

  async remove(key: string) {
    this.store.delete(key)
  }

  async getAllRows(collection: LocalCollectionName) {
    return Array.from(this.rows.values()).filter(row => row.collection === collection)
  }

  async getRow(collection: LocalCollectionName, id: string) {
    return this.rows.get(buildRowKey(collection, id)) ?? null
  }

  async getRowsByIds(collection: LocalCollectionName, ids: string[]) {
    return ids
      .map(id => this.rows.get(buildRowKey(collection, id)))
      .filter((row): row is LocalRowRecord => !!row)
  }

  async putRows(collection: LocalCollectionName, rows: LocalRowRecord[]) {
    rows.forEach(row => this.rows.set(buildRowKey(collection, row.id), row))
    this.bumpRevision(collection)
  }

  async deleteRows(collection: LocalCollectionName, ids: string[]) {
    ids.forEach(id => this.rows.delete(buildRowKey(collection, id)))
    this.bumpRevision(collection)
  }

  async deleteRowsByFamily(collection: LocalCollectionName, familyId: string) {
    Array.from(this.rows.entries()).forEach(([key, row]) => {
      if (row.collection === collection && row.family_id === familyId) this.rows.delete(key)
    })
    this.bumpRevision(collection)
  }

  async replaceRows(collection: LocalCollectionName, rows: LocalRowRecord[]) {
    Array.from(this.rows.entries()).forEach(([key, row]) => {
      if (row.collection === collection) this.rows.delete(key)
    })
    rows.forEach(row => this.rows.set(buildRowKey(collection, row.id), row))
    this.bumpRevision(collection)
  }

  async getCollectionRevision(collection: LocalCollectionName) {
    return this.revisions.get(collection) || 0
  }

  async resetForTest() {
    this.store.clear()
    this.rows.clear()
    this.revisions.clear()
  }

  private bumpRevision(collection: LocalCollectionName) {
    this.revisions.set(collection, (this.revisions.get(collection) || 0) + 1)
  }
}

class UniStorageAdapter implements LocalDbAdapter {
  private revisions = new Map<LocalCollectionName, number>()

  async get(key: string) {
    try {
      const value = uni.getStorageSync(key)
      return value ? String(value) : null
    } catch {
      return null
    }
  }

  async set(key: string, value: string) {
    uni.setStorageSync(key, value)
  }

  async remove(key: string) {
    uni.removeStorageSync(key)
  }

  async getAllRows(collection: LocalCollectionName) {
    return getRowsFromLegacyPayload(collection, await this.get(getCollectionStorageKey(collection)))
  }

  async getRow(collection: LocalCollectionName, id: string) {
    const rows = await this.getAllRows(collection)
    return rows.find(row => row.id === id) || null
  }

  async getRowsByIds(collection: LocalCollectionName, ids: string[]) {
    const idSet = new Set(ids)
    const rows = await this.getAllRows(collection)
    return rows.filter(row => idSet.has(row.id))
  }

  async putRows(collection: LocalCollectionName, rows: LocalRowRecord[]) {
    if (!rows.length) return
    const current = await this.getAllRows(collection)
    const rowMap = new Map(current.map(row => [row.id, row]))
    rows.forEach(row => rowMap.set(row.id, row))
    await this.persistRows(collection, Array.from(rowMap.values()))
  }

  async deleteRows(collection: LocalCollectionName, ids: string[]) {
    const idSet = new Set(ids)
    const rows = (await this.getAllRows(collection)).filter(row => !idSet.has(row.id))
    await this.persistRows(collection, rows)
  }

  async deleteRowsByFamily(collection: LocalCollectionName, familyId: string) {
    const rows = (await this.getAllRows(collection)).filter(row => row.family_id !== familyId)
    await this.persistRows(collection, rows)
  }

  async replaceRows(collection: LocalCollectionName, rows: LocalRowRecord[]) {
    await this.persistRows(collection, rows)
  }

  async getCollectionRevision(collection: LocalCollectionName) {
    return this.revisions.get(collection) || toRevision(await this.get(getRevisionKey(collection)))
  }

  private async persistRows(collection: LocalCollectionName, rows: LocalRowRecord[]) {
    const payload = rows.map(row => JSON.parse(row.value))
    await this.set(getCollectionStorageKey(collection), JSON.stringify(payload))
    const revision = (await this.getCollectionRevision(collection)) + 1
    this.revisions.set(collection, revision)
    await this.set(getRevisionKey(collection), String(revision))
  }
}

class IndexedDbAdapter implements LocalDbAdapter {
  private static readonly DB_NAME = 'breed-app-local-first'
  private static readonly KV_STORE_NAME = 'kv'
  private static readonly ROW_STORE_NAME = 'rows'
  private static readonly DB_VERSION = 2
  private dbPromise: Promise<IDBDatabase> | null = null
  private blocked = false
  private fallback = new UniStorageAdapter()

  private isSupported() {
    return typeof indexedDB !== 'undefined'
  }

  private notifyBlocked() {
    if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
      uni.showToast({
        title: '本地数据库升级被其他窗口占用，请关闭其他标签页后刷新',
        icon: 'none',
      })
    }
  }

  private async getDb() {
    if (!this.isSupported() || this.blocked) {
      throw new Error('IndexedDB unavailable')
    }
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(IndexedDbAdapter.DB_NAME, IndexedDbAdapter.DB_VERSION)
        request.onblocked = () => {
          this.blocked = true
          this.notifyBlocked()
          reject(new Error('INDEXED_DB_BLOCKED'))
        }
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(IndexedDbAdapter.KV_STORE_NAME)) {
            db.createObjectStore(IndexedDbAdapter.KV_STORE_NAME)
          }
          if (!db.objectStoreNames.contains(IndexedDbAdapter.ROW_STORE_NAME)) {
            const rowStore = db.createObjectStore(IndexedDbAdapter.ROW_STORE_NAME, { keyPath: 'key' })
            rowStore.createIndex('collection', 'collection', { unique: false })
            rowStore.createIndex('collection_family', ['collection', 'family_id'], { unique: false })
            rowStore.createIndex('collection_updated_id', ['collection', 'updated_at', 'id'], { unique: false })
          }
        }
        request.onsuccess = () => {
          const db = request.result
          db.onversionchange = () => db.close()
          resolve(db)
        }
        request.onerror = () => reject(request.error)
      })
    }
    return this.dbPromise
  }

  private async runKv<T>(mode: IDBTransactionMode, executor: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void) {
    const db = await this.getDb()
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(IndexedDbAdapter.KV_STORE_NAME, mode)
      const store = tx.objectStore(IndexedDbAdapter.KV_STORE_NAME)
      executor(store, resolve, reject)
    })
  }

  private async runRows<T>(mode: IDBTransactionMode, executor: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void) {
    const db = await this.getDb()
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(IndexedDbAdapter.ROW_STORE_NAME, mode)
      const store = tx.objectStore(IndexedDbAdapter.ROW_STORE_NAME)
      executor(store, resolve, reject)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  }

  async get(key: string) {
    if (!this.isSupported()) return this.fallback.get(key)
    try {
      return await this.runKv<string | null>('readonly', (store, resolve, reject) => {
        const request = store.get(key)
        request.onsuccess = () => resolve(request.result ? String(request.result) : null)
        request.onerror = () => reject(request.error)
      })
    } catch {
      return this.fallback.get(key)
    }
  }

  async set(key: string, value: string) {
    if (!this.isSupported()) return this.fallback.set(key, value)
    try {
      await this.runKv<void>('readwrite', (store, resolve, reject) => {
        const request = store.put(value, key)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch {
      await this.fallback.set(key, value)
    }
  }

  async remove(key: string) {
    if (!this.isSupported()) return this.fallback.remove(key)
    try {
      await this.runKv<void>('readwrite', (store, resolve, reject) => {
        const request = store.delete(key)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch {
      await this.fallback.remove(key)
    }
  }

  async getAllRows(collection: LocalCollectionName) {
    try {
      return await this.runRows<LocalRowRecord[]>('readonly', (store, resolve, reject) => {
        const index = store.index('collection')
        const request = index.getAll(collection)
        request.onsuccess = () => resolve((request.result || []).map(this.fromIndexedRow))
        request.onerror = () => reject(request.error)
      })
    } catch {
      return this.fallback.getAllRows(collection)
    }
  }

  async getRow(collection: LocalCollectionName, id: string) {
    try {
      return await this.runRows<LocalRowRecord | null>('readonly', (store, resolve, reject) => {
        const request = store.get(buildRowKey(collection, id))
        request.onsuccess = () => resolve(request.result ? this.fromIndexedRow(request.result) : null)
        request.onerror = () => reject(request.error)
      })
    } catch {
      return this.fallback.getRow(collection, id)
    }
  }

  async getRowsByIds(collection: LocalCollectionName, ids: string[]) {
    const uniqueIds = [...new Set(ids.filter(Boolean))]
    if (!uniqueIds.length) return []
    try {
      return await this.runRows<LocalRowRecord[]>('readonly', (store, resolve, reject) => {
        const rows: LocalRowRecord[] = []
        let remaining = uniqueIds.length
        uniqueIds.forEach((id) => {
          const request = store.get(buildRowKey(collection, id))
          request.onsuccess = () => {
            if (request.result) rows.push(this.fromIndexedRow(request.result))
            remaining -= 1
            if (remaining === 0) resolve(rows)
          }
          request.onerror = () => reject(request.error)
        })
      })
    } catch {
      return this.fallback.getRowsByIds(collection, uniqueIds)
    }
  }

  async putRows(collection: LocalCollectionName, rows: LocalRowRecord[]) {
    if (!rows.length) return
    try {
      await this.runRows<void>('readwrite', (store, resolve, reject) => {
        rows.forEach(row => store.put(this.toIndexedRow(row)))
        this.bumpRevision(collection).then(() => resolve(), reject)
      })
    } catch {
      await this.fallback.putRows(collection, rows)
    }
  }

  async deleteRows(collection: LocalCollectionName, ids: string[]) {
    const uniqueIds = [...new Set(ids.filter(Boolean))]
    if (!uniqueIds.length) return
    try {
      await this.runRows<void>('readwrite', (store, resolve, reject) => {
        uniqueIds.forEach(id => store.delete(buildRowKey(collection, id)))
        this.bumpRevision(collection).then(() => resolve(), reject)
      })
    } catch {
      await this.fallback.deleteRows(collection, uniqueIds)
    }
  }

  async deleteRowsByFamily(collection: LocalCollectionName, familyId: string) {
    try {
      const rows = await this.getAllRows(collection)
      await this.deleteRows(collection, rows.filter(row => row.family_id === familyId).map(row => row.id))
    } catch {
      await this.fallback.deleteRowsByFamily(collection, familyId)
    }
  }

  async replaceRows(collection: LocalCollectionName, rows: LocalRowRecord[]) {
    try {
      await this.runRows<void>('readwrite', (store, resolve, reject) => {
        const index = store.index('collection')
        const request = index.getAllKeys(collection)
        request.onsuccess = () => {
          ;(request.result || []).forEach(key => store.delete(key))
          rows.forEach(row => store.put(this.toIndexedRow(row)))
          this.bumpRevision(collection).then(() => resolve(), reject)
        }
        request.onerror = () => reject(request.error)
      })
    } catch {
      await this.fallback.replaceRows(collection, rows)
    }
  }

  async getCollectionRevision(collection: LocalCollectionName) {
    return toRevision(await this.get(getRevisionKey(collection)))
  }

  private async bumpRevision(collection: LocalCollectionName) {
    const revision = (await this.getCollectionRevision(collection)) + 1
    await this.set(getRevisionKey(collection), String(revision))
  }

  private toIndexedRow(row: LocalRowRecord) {
    return { ...row, key: buildRowKey(row.collection, row.id) }
  }

  private fromIndexedRow(row: any): LocalRowRecord {
    return {
      collection: row.collection,
      id: row.id,
      family_id: row.family_id || '',
      updated_at: Number(row.updated_at || 0),
      deleted_at: Number(row.deleted_at || 0),
      flags: row.flags || '{}',
      value: row.value || '{}',
    }
  }
}

class SqliteAdapter implements LocalDbAdapter {
  private static readonly DB_NAME = 'breed_app_local_first.db'
  private static readonly KV_TABLE_NAME = 'local_kv'
  private static readonly ROW_TABLE_NAME = 'local_rows'
  private opened = false
  private fallback = new UniStorageAdapter()

  private isSupported() {
    return typeof plus !== 'undefined' && !!plus?.sqlite
  }

  private async open() {
    if (!this.isSupported() || this.opened) return

    const dbPath = '_doc/breed_app_local_first.db'
    await new Promise<void>((resolve, reject) => {
      plus.sqlite.openDatabase({
        name: SqliteAdapter.DB_NAME,
        path: dbPath,
        success: () => resolve(),
        fail: (error: unknown) => reject(error),
      })
    })
    await this.execute(
      `CREATE TABLE IF NOT EXISTS ${SqliteAdapter.KV_TABLE_NAME} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    )
    await this.execute(
      `CREATE TABLE IF NOT EXISTS ${SqliteAdapter.ROW_TABLE_NAME} (collection TEXT NOT NULL, id TEXT NOT NULL, family_id TEXT, updated_at INTEGER, deleted_at INTEGER, flags TEXT, value TEXT NOT NULL, PRIMARY KEY(collection, id))`,
    )
    await this.execute(
      `CREATE INDEX IF NOT EXISTS idx_local_rows_collection_family ON ${SqliteAdapter.ROW_TABLE_NAME} (collection, family_id)`,
    )
    await this.execute(
      `CREATE INDEX IF NOT EXISTS idx_local_rows_collection_updated_id ON ${SqliteAdapter.ROW_TABLE_NAME} (collection, updated_at, id)`,
    )
    this.opened = true
  }

  private async execute(sql: string, args: unknown[] = []) {
    await new Promise<void>((resolve, reject) => {
      plus.sqlite.executeSql({
        name: SqliteAdapter.DB_NAME,
        sql,
        args,
        success: () => resolve(),
        fail: (error: unknown) => reject(error),
      })
    })
  }

  private async select(sql: string, args: unknown[] = []) {
    return new Promise<any[]>((resolve, reject) => {
      plus.sqlite.selectSql({
        name: SqliteAdapter.DB_NAME,
        sql,
        args,
        success: (rows: any[]) => resolve(rows || []),
        fail: (error: unknown) => reject(error),
      })
    })
  }

  async get(key: string) {
    if (!this.isSupported()) return this.fallback.get(key)
    try {
      await this.open()
      const rows = await this.select(
        `SELECT value FROM ${SqliteAdapter.KV_TABLE_NAME} WHERE key = ? LIMIT 1`,
        [key],
      )
      return rows[0]?.value ? String(rows[0].value) : null
    } catch {
      return this.fallback.get(key)
    }
  }

  async set(key: string, value: string) {
    if (!this.isSupported()) return this.fallback.set(key, value)
    try {
      await this.open()
      await this.execute(
        `INSERT OR REPLACE INTO ${SqliteAdapter.KV_TABLE_NAME} (key, value) VALUES (?, ?)`,
        [key, value],
      )
    } catch {
      await this.fallback.set(key, value)
    }
  }

  async remove(key: string) {
    if (!this.isSupported()) return this.fallback.remove(key)
    try {
      await this.open()
      await this.execute(
        `DELETE FROM ${SqliteAdapter.KV_TABLE_NAME} WHERE key = ?`,
        [key],
      )
    } catch {
      await this.fallback.remove(key)
    }
  }

  async getAllRows(collection: LocalCollectionName) {
    if (!this.isSupported()) return this.fallback.getAllRows(collection)
    try {
      await this.open()
      const rows = await this.select(
        `SELECT collection, id, family_id, updated_at, deleted_at, flags, value FROM ${SqliteAdapter.ROW_TABLE_NAME} WHERE collection = ?`,
        [collection],
      )
      return rows.map(row => this.fromSqlRow(row))
    } catch {
      return this.fallback.getAllRows(collection)
    }
  }

  async getRow(collection: LocalCollectionName, id: string) {
    if (!this.isSupported()) return this.fallback.getRow(collection, id)
    try {
      await this.open()
      const rows = await this.select(
        `SELECT collection, id, family_id, updated_at, deleted_at, flags, value FROM ${SqliteAdapter.ROW_TABLE_NAME} WHERE collection = ? AND id = ? LIMIT 1`,
        [collection, id],
      )
      return rows[0] ? this.fromSqlRow(rows[0]) : null
    } catch {
      return this.fallback.getRow(collection, id)
    }
  }

  async getRowsByIds(collection: LocalCollectionName, ids: string[]) {
    const uniqueIds = [...new Set(ids.filter(Boolean))]
    if (!uniqueIds.length) return []
    if (!this.isSupported()) return this.fallback.getRowsByIds(collection, uniqueIds)
    try {
      await this.open()
      const placeholders = uniqueIds.map(() => '?').join(',')
      const rows = await this.select(
        `SELECT collection, id, family_id, updated_at, deleted_at, flags, value FROM ${SqliteAdapter.ROW_TABLE_NAME} WHERE collection = ? AND id IN (${placeholders})`,
        [collection, ...uniqueIds],
      )
      return rows.map(row => this.fromSqlRow(row))
    } catch {
      return this.fallback.getRowsByIds(collection, uniqueIds)
    }
  }

  async putRows(collection: LocalCollectionName, rows: LocalRowRecord[]) {
    if (!rows.length) return
    if (!this.isSupported()) return this.fallback.putRows(collection, rows)
    try {
      await this.open()
      await this.execute('BEGIN IMMEDIATE')
      for (const row of rows) {
        await this.execute(
          `INSERT OR REPLACE INTO ${SqliteAdapter.ROW_TABLE_NAME} (collection, id, family_id, updated_at, deleted_at, flags, value) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [collection, row.id, row.family_id, row.updated_at, row.deleted_at, row.flags, row.value],
        )
      }
      await this.bumpRevision(collection)
      await this.execute('COMMIT')
    } catch (error) {
      try { await this.execute('ROLLBACK') } catch {}
      await this.fallback.putRows(collection, rows)
    }
  }

  async deleteRows(collection: LocalCollectionName, ids: string[]) {
    const uniqueIds = [...new Set(ids.filter(Boolean))]
    if (!uniqueIds.length) return
    if (!this.isSupported()) return this.fallback.deleteRows(collection, uniqueIds)
    try {
      await this.open()
      const placeholders = uniqueIds.map(() => '?').join(',')
      await this.execute('BEGIN IMMEDIATE')
      await this.execute(
        `DELETE FROM ${SqliteAdapter.ROW_TABLE_NAME} WHERE collection = ? AND id IN (${placeholders})`,
        [collection, ...uniqueIds],
      )
      await this.bumpRevision(collection)
      await this.execute('COMMIT')
    } catch {
      try { await this.execute('ROLLBACK') } catch {}
      await this.fallback.deleteRows(collection, uniqueIds)
    }
  }

  async deleteRowsByFamily(collection: LocalCollectionName, familyId: string) {
    if (!familyId) return
    if (!this.isSupported()) return this.fallback.deleteRowsByFamily(collection, familyId)
    try {
      await this.open()
      await this.execute('BEGIN IMMEDIATE')
      await this.execute(
        `DELETE FROM ${SqliteAdapter.ROW_TABLE_NAME} WHERE collection = ? AND family_id = ?`,
        [collection, familyId],
      )
      await this.bumpRevision(collection)
      await this.execute('COMMIT')
    } catch {
      try { await this.execute('ROLLBACK') } catch {}
      await this.fallback.deleteRowsByFamily(collection, familyId)
    }
  }

  async replaceRows(collection: LocalCollectionName, rows: LocalRowRecord[]) {
    if (!this.isSupported()) return this.fallback.replaceRows(collection, rows)
    try {
      await this.open()
      await this.execute('BEGIN IMMEDIATE')
      await this.execute(`DELETE FROM ${SqliteAdapter.ROW_TABLE_NAME} WHERE collection = ?`, [collection])
      for (const row of rows) {
        await this.execute(
          `INSERT OR REPLACE INTO ${SqliteAdapter.ROW_TABLE_NAME} (collection, id, family_id, updated_at, deleted_at, flags, value) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [collection, row.id, row.family_id, row.updated_at, row.deleted_at, row.flags, row.value],
        )
      }
      await this.bumpRevision(collection)
      await this.execute('COMMIT')
    } catch {
      try { await this.execute('ROLLBACK') } catch {}
      await this.fallback.replaceRows(collection, rows)
    }
  }

  async getCollectionRevision(collection: LocalCollectionName) {
    return toRevision(await this.get(getRevisionKey(collection)))
  }

  private async bumpRevision(collection: LocalCollectionName) {
    const revision = (await this.getCollectionRevision(collection)) + 1
    await this.set(getRevisionKey(collection), String(revision))
  }

  private fromSqlRow(row: any): LocalRowRecord {
    return {
      collection: row.collection,
      id: String(row.id || ''),
      family_id: String(row.family_id || ''),
      updated_at: Number(row.updated_at || 0),
      deleted_at: Number(row.deleted_at || 0),
      flags: row.flags || '{}',
      value: row.value || '{}',
    }
  }
}

const MEMORY_ADAPTER = new MemoryAdapter()

function getEnvAdapter(): LocalDbAdapter {
  const appPlatform = typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function'
    ? uni.getSystemInfoSync().uniPlatform
    : ''

  if (appPlatform === 'app') {
    return new SqliteAdapter()
  }

  if (appPlatform === 'web' || typeof indexedDB !== 'undefined') {
    return new IndexedDbAdapter()
  }

  if (typeof uni !== 'undefined') {
    return new UniStorageAdapter()
  }

  return MEMORY_ADAPTER
}

let adapterInstance: LocalDbAdapter | null = null

export function getLocalDbAdapter() {
  if (!adapterInstance) {
    adapterInstance = getEnvAdapter()
  }
  return adapterInstance
}
