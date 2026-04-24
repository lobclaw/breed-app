import type { LocalCollectionName } from '@/localdb/types'
import { LOCAL_COLLECTIONS } from '@/localdb/types'

declare const plus: any

export interface KeyValueAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

class MemoryAdapter implements KeyValueAdapter {
  private store = new Map<string, string>()

  async get(key: string) {
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string) {
    this.store.set(key, value)
  }

  async remove(key: string) {
    this.store.delete(key)
  }
}

class UniStorageAdapter implements KeyValueAdapter {
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
}

class IndexedDbAdapter implements KeyValueAdapter {
  private static readonly DB_NAME = 'breed-app-local-first'
  private static readonly STORE_NAME = 'kv'
  private dbPromise: Promise<IDBDatabase> | null = null
  private fallback = new UniStorageAdapter()

  private isSupported() {
    return typeof indexedDB !== 'undefined'
  }

  private async getDb() {
    if (!this.isSupported()) {
      throw new Error('IndexedDB unavailable')
    }
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(IndexedDbAdapter.DB_NAME, 1)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(IndexedDbAdapter.STORE_NAME)) {
            db.createObjectStore(IndexedDbAdapter.STORE_NAME)
          }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    }
    return this.dbPromise
  }

  private async run<T>(mode: IDBTransactionMode, executor: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void) {
    const db = await this.getDb()
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(IndexedDbAdapter.STORE_NAME, mode)
      const store = tx.objectStore(IndexedDbAdapter.STORE_NAME)
      executor(store, resolve, reject)
    })
  }

  async get(key: string) {
    if (!this.isSupported()) return this.fallback.get(key)
    try {
      return await this.run<string | null>('readonly', (store, resolve, reject) => {
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
      await this.run<void>('readwrite', (store, resolve, reject) => {
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
      await this.run<void>('readwrite', (store, resolve, reject) => {
        const request = store.delete(key)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch {
      await this.fallback.remove(key)
    }
  }
}

class SqliteAdapter implements KeyValueAdapter {
  private static readonly DB_NAME = 'breed_app_local_first.db'
  private static readonly TABLE_NAME = 'local_kv'
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
      `CREATE TABLE IF NOT EXISTS ${SqliteAdapter.TABLE_NAME} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
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
        `SELECT value FROM ${SqliteAdapter.TABLE_NAME} WHERE key = ? LIMIT 1`,
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
        `INSERT OR REPLACE INTO ${SqliteAdapter.TABLE_NAME} (key, value) VALUES (?, ?)`,
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
        `DELETE FROM ${SqliteAdapter.TABLE_NAME} WHERE key = ?`,
        [key],
      )
    } catch {
      await this.fallback.remove(key)
    }
  }
}

const MEMORY_ADAPTER = new MemoryAdapter()

function getEnvAdapter() {
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

let adapterInstance: KeyValueAdapter | null = null

export function getLocalDbAdapter() {
  if (!adapterInstance) {
    adapterInstance = getEnvAdapter()
  }
  return adapterInstance
}

export function getCollectionStorageKey(collection: LocalCollectionName) {
  const isKnownCollection = (LOCAL_COLLECTIONS as readonly string[]).includes(collection)
  const normalized = isKnownCollection ? collection : 'unknown'
  return `breed-local-first:${normalized}`
}

