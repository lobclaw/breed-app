import { getCollectionStorageKey, getLocalDbAdapter } from '@/localdb/adapter'
import type {
  LocalCollectionName,
  LocalDbChangeEvent,
  OutboxMutation,
  SyncConflictRow,
  SyncStateRow,
} from '@/localdb/types'

type TransactionTables = Record<string, any[]>
type LocalDbListener = (event: LocalDbChangeEvent) => void

function cloneRows<T>(rows: T[]): T[] {
  return JSON.parse(JSON.stringify(rows || []))
}

function sortRowsByUpdatedAt<T extends { updated_at?: number; created_at?: number }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const aTs = Number(a.updated_at ?? a.created_at ?? 0)
    const bTs = Number(b.updated_at ?? b.created_at ?? 0)
    return aTs - bTs
  })
}

export class LocalDb {
  private cache = new Map<LocalCollectionName, any[]>()
  private listeners = new Set<LocalDbListener>()

  subscribe(listener: LocalDbListener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(collections: LocalCollectionName[]) {
    const payload = { collections }
    this.listeners.forEach(listener => listener(payload))
  }

  async getTable<T>(collection: LocalCollectionName): Promise<T[]> {
    if (this.cache.has(collection)) {
      return cloneRows<T>(this.cache.get(collection) as T[])
    }

    const adapter = getLocalDbAdapter()
    const raw = await adapter.get(getCollectionStorageKey(collection))
    const rows = raw ? (JSON.parse(raw) as T[]) : []
    this.cache.set(collection, rows)
    return cloneRows(rows)
  }

  private async writeTable<T>(collection: LocalCollectionName, rows: T[]) {
    const normalized = cloneRows(rows)
    const adapter = getLocalDbAdapter()
    this.cache.set(collection, normalized)
    await adapter.set(getCollectionStorageKey(collection), JSON.stringify(normalized))
  }

  async replaceTable<T>(collection: LocalCollectionName, rows: T[]) {
    await this.writeTable(collection, rows)
    this.emit([collection])
  }

  async transact<T>(
    collections: LocalCollectionName[],
    mutator: (tables: TransactionTables) => T | Promise<T>,
  ): Promise<T> {
    const uniqueCollections = [...new Set(collections)] as LocalCollectionName[]
    const tables = {} as TransactionTables

    for (const collection of uniqueCollections) {
      tables[collection] = await this.getTable(collection)
    }

    const workingCopy = Object.fromEntries(
      uniqueCollections.map(collection => [collection, cloneRows(tables[collection])]),
    ) as TransactionTables

    const result = await mutator(workingCopy)

    for (const collection of uniqueCollections) {
      await this.writeTable(collection, workingCopy[collection] || [])
    }

    this.emit(uniqueCollections)
    return result
  }

  async query<T>(
    collection: LocalCollectionName,
    predicate?: (row: T) => boolean,
    options: {
      sort?: (a: T, b: T) => number
    } = {},
  ): Promise<T[]> {
    const rows = await this.getTable<T>(collection)
    const filtered = predicate ? rows.filter(predicate) : rows
    return options.sort ? [...filtered].sort(options.sort) : filtered
  }

  async upsertRows<T extends { _id: string; updated_at?: number; created_at?: number }>(
    collection: LocalCollectionName,
    rows: T[],
  ) {
    if (!rows.length) return
    await this.transact([collection], (tables) => {
      const currentRows = tables[collection] as T[]
      const nextMap = new Map(currentRows.map(row => [row._id, row]))
      rows.forEach((row) => {
        nextMap.set(row._id, {
          ...(nextMap.get(row._id) || {}),
          ...row,
        })
      })
      tables[collection] = sortRowsByUpdatedAt(Array.from(nextMap.values()))
    })
  }

  async findById<T extends { _id: string }>(collection: LocalCollectionName, id: string) {
    const rows = await this.getTable<T>(collection)
    return rows.find(row => row._id === id) || null
  }

  async getOutbox() {
    return this.query<OutboxMutation>('outbox_mutations', undefined, {
      sort: (a, b) => a.created_at - b.created_at,
    })
  }

  async getSyncState(collection: SyncStateRow['collection']) {
    return this.findById<SyncStateRow>('sync_state', collection)
  }

  async upsertSyncState(row: SyncStateRow) {
    await this.upsertRows('sync_state', [row])
  }

  async upsertConflict(row: SyncConflictRow) {
    await this.upsertRows('sync_conflicts', [row])
  }
}

export const localDb = new LocalDb()

