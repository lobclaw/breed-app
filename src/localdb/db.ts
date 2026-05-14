import {
  getCollectionStorageKey,
  getLocalDbAdapter,
  getMigrationStorageKey,
  STORAGE_V2_ENABLED_KEY,
  toLocalRowRecord,
  type LocalRowRecord,
} from '@/localdb/adapter'
import type {
  LocalCollectionName,
  LocalDbChangeEvent,
  LocalMetaRow,
  OutboxMutation,
  SyncConflictRow,
  SyncStateRow,
} from '@/localdb/types'

type TransactionTables = Record<string, any[]>
type LocalDbListener = (event: LocalDbChangeEvent) => void
type CacheEntry = { revision: number; rows: any[] }

const LOCAL_DB_WRITE_CONFLICT = 'LOCAL_DB_WRITE_CONFLICT'

function cloneRows<T>(rows: T[]): T[] {
  return JSON.parse(JSON.stringify(rows || []))
}

function parseRow<T>(record: LocalRowRecord): T | null {
  try {
    return JSON.parse(record.value) as T
  } catch {
    return null
  }
}

function normalizeRows<T extends { _id?: string; updated_at?: number; created_at?: number }>(rows: T[]) {
  return [...(rows || [])]
    .filter(row => row && row._id)
    .sort((a, b) => {
      const aTs = Number(a.updated_at ?? a.created_at ?? 0)
      const bTs = Number(b.updated_at ?? b.created_at ?? 0)
      return aTs - bTs
    })
}

function sameRow(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function buildMap<T extends { _id: string }>(rows: T[]) {
  return new Map(rows.map(row => [String(row._id), row]))
}

export class LocalDb {
  private cache = new Map<LocalCollectionName, CacheEntry>()
  private listeners = new Set<LocalDbListener>()
  private transactionQueue: Promise<unknown> = Promise.resolve()

  subscribe(listener: LocalDbListener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(collections: LocalCollectionName[]) {
    const payload = { collections }
    this.listeners.forEach(listener => listener(payload))
  }

  private async isV2Enabled() {
    const adapter = getLocalDbAdapter()
    const raw = await adapter.get(STORAGE_V2_ENABLED_KEY)
    return raw !== 'false'
  }

  private async ensureCollectionStorage(collection: LocalCollectionName) {
    const adapter = getLocalDbAdapter()
    if (!(await this.isV2Enabled())) return false

    const stateKey = getMigrationStorageKey(collection)
    const state = await adapter.get(stateKey)
    if (state === 'migrated') return true
    if (state?.startsWith('failed:') || state === 'migrating') return false

    try {
      await adapter.set(stateKey, 'migrating')
      const raw = await adapter.get(getCollectionStorageKey(collection))
      const rows = raw ? JSON.parse(raw) : []
      const normalizedRows = Array.isArray(rows)
        ? rows
          .filter(row => row && typeof row === 'object' && row._id)
          .map(row => toLocalRowRecord(collection, row))
        : []
      await adapter.replaceRows(collection, normalizedRows)
      await adapter.set(stateKey, 'migrated')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'unknown')
      await adapter.set(stateKey, `failed:${message}`)
      return false
    }
  }

  private async readLegacyTable<T>(collection: LocalCollectionName): Promise<T[]> {
    const adapter = getLocalDbAdapter()
    const raw = await adapter.get(getCollectionStorageKey(collection))
    const rows = raw ? (JSON.parse(raw) as T[]) : []
    return normalizeRows(rows as any) as T[]
  }

  private async writeLegacyTable<T>(collection: LocalCollectionName, rows: T[]) {
    const adapter = getLocalDbAdapter()
    const normalized = normalizeRows(rows as any)
    await adapter.set(getCollectionStorageKey(collection), JSON.stringify(normalized))
    this.cache.set(collection, { revision: Date.now(), rows: normalized })
  }

  private async readV2Table<T>(collection: LocalCollectionName): Promise<T[]> {
    const adapter = getLocalDbAdapter()
    const revision = await adapter.getCollectionRevision(collection)
    const cached = this.cache.get(collection)
    if (cached && cached.revision === revision) {
      return cached.rows as T[]
    }
    const records = await adapter.getAllRows(collection)
    const rows = normalizeRows(records.map(record => parseRow<T>(record)).filter(Boolean) as any)
    this.cache.set(collection, { revision, rows })
    return rows as T[]
  }

  async getTable<T>(collection: LocalCollectionName): Promise<T[]>
  async getTable<T>(collection: LocalCollectionName): Promise<T[]> {
    const useV2 = await this.ensureCollectionStorage(collection)
    const rows = useV2
      ? await this.readV2Table<T>(collection)
      : await this.readLegacyTable<T>(collection)
    return cloneRows(rows)
  }

  private async replaceV2Table<T extends { _id?: string }>(collection: LocalCollectionName, rows: T[]) {
    const adapter = getLocalDbAdapter()
    const normalized = normalizeRows(rows as any)
    await adapter.replaceRows(collection, normalized.map(row => toLocalRowRecord(collection, row as any)))
    const revision = await adapter.getCollectionRevision(collection)
    this.cache.set(collection, { revision, rows: normalized })
  }

  async replaceTable<T>(collection: LocalCollectionName, rows: T[]) {
    const runReplace = async () => {
      const useV2 = await this.ensureCollectionStorage(collection)
      if (useV2) {
        await this.replaceV2Table(collection, rows as any)
      } else {
        await this.writeLegacyTable(collection, rows)
      }
      this.emit([collection])
    }
    const transaction = this.transactionQueue.then(runReplace, runReplace)
    this.transactionQueue = transaction.then(() => undefined, () => undefined)
    return transaction
  }

  async deleteRowsByFamily(collection: LocalCollectionName, familyId: string) {
    if (!familyId) return
    const runDelete = async () => {
      const useV2 = await this.ensureCollectionStorage(collection)
      if (useV2) {
        const adapter = getLocalDbAdapter()
        await adapter.deleteRowsByFamily(collection, familyId)
        this.cache.delete(collection)
      } else {
        const rows = await this.readLegacyTable<any>(collection)
        await this.writeLegacyTable(collection, rows.filter(row => row.family_id !== familyId))
      }
      this.emit([collection])
    }
    const transaction = this.transactionQueue.then(runDelete, runDelete)
    this.transactionQueue = transaction.then(() => undefined, () => undefined)
    return transaction
  }

  async transact<T>(
    collections: LocalCollectionName[],
    mutator: (tables: TransactionTables) => T | Promise<T>,
  ): Promise<T> {
    const runTransaction = async () => {
      const uniqueCollections = [...new Set(collections)] as LocalCollectionName[]
      const tables = {} as TransactionTables
      const originalTables = {} as TransactionTables
      const revisions = new Map<LocalCollectionName, number>()
      const v2Collections = new Set<LocalCollectionName>()
      const adapter = getLocalDbAdapter()

      for (const collection of uniqueCollections) {
        const useV2 = await this.ensureCollectionStorage(collection)
        if (useV2) {
          v2Collections.add(collection)
          revisions.set(collection, await adapter.getCollectionRevision(collection))
        }
        const rows = await this.getTable<any>(collection)
        tables[collection] = rows
        originalTables[collection] = cloneRows(rows)
      }

      const workingCopy = Object.fromEntries(
        uniqueCollections.map(collection => [collection, cloneRows(tables[collection])]),
      ) as TransactionTables

      const result = await mutator(workingCopy)

      for (const collection of uniqueCollections) {
        if (v2Collections.has(collection)) {
          await this.commitV2Diff(collection, originalTables[collection] || [], workingCopy[collection] || [], revisions.get(collection) || 0)
        } else {
          await this.writeLegacyTable(collection, workingCopy[collection] || [])
        }
      }

      this.emit(uniqueCollections)
      return result
    }

    const transaction = this.transactionQueue.then(runTransaction, runTransaction)
    this.transactionQueue = transaction.then(() => undefined, () => undefined)
    return transaction
  }

  private async commitV2Diff(collection: LocalCollectionName, originalRows: any[], workingRows: any[], originalRevision: number) {
    const adapter = getLocalDbAdapter()
    const currentRevision = await adapter.getCollectionRevision(collection)
    const originalMap = buildMap(originalRows)
    const workingMap = buildMap(workingRows.filter(row => row && row._id))
    const allIds = new Set([...originalMap.keys(), ...workingMap.keys()])
    const changedIds = Array.from(allIds).filter(id => !sameRow(originalMap.get(id) || null, workingMap.get(id) || null))
    if (!changedIds.length) return

    if (currentRevision !== originalRevision) {
      const currentRows = (await adapter.getRowsByIds(collection, changedIds))
        .map(record => parseRow<any>(record))
        .filter(Boolean)
      const currentMap = buildMap(currentRows)
      for (const id of changedIds) {
        const currentRow = currentMap.get(id) || null
        const originalRow = originalMap.get(id) || null
        const nextRow = workingMap.get(id) || null
        if (!sameRow(currentRow, originalRow) && !sameRow(currentRow, nextRow)) {
          throw new Error(LOCAL_DB_WRITE_CONFLICT)
        }
      }
    }

    const rowsToPut = changedIds
      .map(id => workingMap.get(id))
      .filter(Boolean)
      .map(row => toLocalRowRecord(collection, row as any))
    const idsToDelete = changedIds.filter(id => !workingMap.has(id))

    if (rowsToPut.length) await adapter.putRows(collection, rowsToPut)
    if (idsToDelete.length) await adapter.deleteRows(collection, idsToDelete)
    this.cache.delete(collection)
  }

  async query<T>(
    collection: LocalCollectionName,
    predicate?: (row: T) => boolean,
    options?: { sort?: (a: T, b: T) => number },
  ): Promise<T[]>
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
    const runUpsert = async () => {
      const normalizedRows = rows.filter(row => row && row._id)
      if (!normalizedRows.length) return
      const useV2 = await this.ensureCollectionStorage(collection)
      if (!useV2) {
        const currentRows = await this.readLegacyTable<T>(collection)
        const nextMap = new Map(currentRows.map(row => [row._id, row]))
        normalizedRows.forEach((row) => {
          nextMap.set(row._id, {
            ...(nextMap.get(row._id) || {}),
            ...row,
          })
        })
        await this.writeLegacyTable(collection, Array.from(nextMap.values()))
        this.emit([collection])
        return
      }

      const adapter = getLocalDbAdapter()
      const currentRows = await adapter.getRowsByIds(collection, normalizedRows.map(row => row._id))
      const currentMap = new Map(
        currentRows
          .map(record => parseRow<T>(record))
          .filter(Boolean)
          .map(row => [row!._id, row!]),
      )
      const nextRows = normalizedRows.map(row => ({
        ...(currentMap.get(row._id) || {}),
        ...row,
      }))
      await adapter.putRows(collection, nextRows.map(row => toLocalRowRecord(collection, row as any)))
      this.cache.delete(collection)
      this.emit([collection])
    }

    const transaction = this.transactionQueue.then(runUpsert, runUpsert)
    this.transactionQueue = transaction.then(() => undefined, () => undefined)
    return transaction
  }

  async findById<T extends { _id: string }>(collection: LocalCollectionName, id: string): Promise<T | null>
  async findById<T extends { _id: string }>(collection: LocalCollectionName, id: string) {
    const useV2 = await this.ensureCollectionStorage(collection)
    if (useV2) {
      const row = await getLocalDbAdapter().getRow(collection, id)
      const parsed = row ? parseRow<T>(row) : null
      return parsed ? cloneRows([parsed])[0] : null
    }
    const rows = await this.getTable<T>(collection)
    return rows.find(row => row._id === id) || null
  }

  async getOutbox() {
    return this.query<OutboxMutation>('outbox_mutations', undefined, {
      sort: (a, b) => a.created_at - b.created_at,
    })
  }

  async getSyncState(collection: SyncStateRow['collection'], familyId = '') {
    return this.findById<SyncStateRow>('sync_state', familyId ? `${familyId}:${collection}` : collection)
  }

  async upsertSyncState(row: SyncStateRow) {
    await this.upsertRows('sync_state', [row])
  }

  async upsertConflict(row: SyncConflictRow) {
    await this.upsertRows('sync_conflicts', [row])
  }

  async getLocalMeta<T = unknown>(key: string): Promise<T | null> {
    const row = await this.findById<LocalMetaRow>('local_meta', key)
    return (row?.value as T | undefined) ?? null
  }

  async upsertLocalMeta<T = unknown>(key: string, value: T) {
    await this.upsertRows('local_meta', [{
      _id: key,
      key,
      value,
      updated_at: Date.now(),
    }])
  }

  async getCollectionRevision(collection: LocalCollectionName) {
    const useV2 = await this.ensureCollectionStorage(collection)
    if (!useV2) return Date.now()
    return getLocalDbAdapter().getCollectionRevision(collection)
  }

  async resetForTest() {
    const adapter = getLocalDbAdapter()
    if (adapter.resetForTest) await adapter.resetForTest()
    this.cache.clear()
    this.transactionQueue = Promise.resolve()
  }
}

export const localDb = new LocalDb()
