import {
  getCollectionStorageKey,
  getLocalDbAdapter,
  getMigrationStorageKey,
  getRevisionKey,
  MIGRATION_STALE_MS,
  STORAGE_V2_ENABLED_KEY,
  toLocalRowRecord,
  type LocalRowRecord,
  type LocalRowRecordSource,
} from '@/localdb/adapter'
import type {
  LocalCollectionName,
  LocalDbChangeEvent,
  LocalMetaRow,
  OutboxMutation,
  SyncConflictRow,
  SyncStateRow,
  LocalRowOf,
} from '@/localdb/types'

type LocalTransactionTables = { [C in LocalCollectionName]: LocalRowOf<C>[] }
type TransactionTables = LocalTransactionTables
type RowPatch<C extends LocalCollectionName> =
  | Partial<LocalRowOf<C>>
  | ((row: LocalRowOf<C>) => LocalRowOf<C> | null)
type LocalRowTransactionContext<C extends LocalCollectionName> = {
  getRow(id: string): Promise<LocalRowOf<C> | null>
  upsertRow(row: LocalRowOf<C> & { _id: string }): Promise<void>
  updateRow(id: string, patch: RowPatch<C>): Promise<LocalRowOf<C> | null>
  deleteRow(id: string): Promise<void>
}
type LocalMultiRowTransactionContext<C extends LocalCollectionName> = {
  getRow<T extends C>(collection: T, id: string): Promise<LocalRowOf<T> | null>
  upsertRow<T extends C>(collection: T, row: LocalRowOf<T> & { _id: string }): Promise<void>
  updateRow<T extends C>(collection: T, id: string, patch: RowPatch<T>): Promise<LocalRowOf<T> | null>
  deleteRow<T extends C>(collection: T, id: string): Promise<void>
}
type LocalDbListener = (event: LocalDbChangeEvent) => void
type StoredLocalRow = LocalRowRecordSource & {
  _id: string
  family_id?: string | null
}
type CacheEntry = { revision: number; rows: StoredLocalRow[] }
type TransactionSnapshot = {
  useV2: boolean
  revision: number
  originalRows: unknown[]
  workingRows?: unknown[]
  accessed: boolean
}

const LOCAL_DB_WRITE_CONFLICT = 'LOCAL_DB_WRITE_CONFLICT'
const MIGRATION_RETRY_KEY_PREFIX = 'breed-local-first:storage:v2:migration-retry'

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

function normalizeRows<T extends StoredLocalRow>(rows: readonly T[]) {
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

function sameRows(left: unknown[], right: unknown[]) {
  return JSON.stringify(left || []) === JSON.stringify(right || [])
}

function buildMap<T extends { _id: string }>(rows: T[]) {
  return new Map(rows.map(row => [String(row._id), row]))
}

function isRowWithId(row: unknown): row is { _id: string } {
  return typeof row === 'object' && row !== null && typeof (row as { _id?: unknown })._id === 'string'
}

function isStoredLocalRow(row: unknown): row is StoredLocalRow {
  return isRowWithId(row)
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

function getRowId(row: unknown) {
  return isRowWithId(row) ? row._id : ''
}

function buildTypedRowMap<T>(rows: readonly T[]) {
  const map = new Map<string, T>()
  for (const row of rows) {
    const id = getRowId(row)
    if (id) map.set(id, row)
  }
  return map
}

function parseRowsPayload(raw: string | null): StoredLocalRow[] {
  if (!raw) return []
  const parsed = JSON.parse(raw) as unknown
  return Array.isArray(parsed) ? parsed.filter(isStoredLocalRow) : []
}

function typedRows<T>(rows: StoredLocalRow[]): T[] {
  return rows as T[]
}

function createTransactionTables(
  collections: LocalCollectionName[],
  snapshots: Map<LocalCollectionName, TransactionSnapshot>,
): TransactionTables {
  const tables = {} as Partial<Record<LocalCollectionName, unknown[]>>
  for (const collection of collections) {
    Object.defineProperty(tables, collection, {
      enumerable: true,
      configurable: true,
      get() {
        const snapshot = snapshots.get(collection)
        if (!snapshot) return []
        snapshot.accessed = true
        if (!snapshot.workingRows) {
          snapshot.workingRows = cloneRows(snapshot.originalRows)
        }
        return snapshot.workingRows
      },
      set(value) {
        const snapshot = snapshots.get(collection)
        if (!snapshot) return
        snapshot.accessed = true
        snapshot.workingRows = Array.isArray(value) ? value : []
      },
    })
  }
  return tables as TransactionTables
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
    if (state === 'migrating') {
      await adapter.set(stateKey, `migrating:${Date.now()}`)
      return false
    }
    if (state?.startsWith('migrating:')) {
      const startedAt = Number(state.split(':')[1] || 0)
      if (startedAt && Date.now() - startedAt < MIGRATION_STALE_MS) return false
    }
    if (state?.startsWith('failed:')) {
      const retryKey = `${MIGRATION_RETRY_KEY_PREFIX}:${collection}`
      const retryRequested = await adapter.get(retryKey)
      if (retryRequested !== '1') return false
      await adapter.remove(retryKey)
    }

    try {
      await adapter.set(stateKey, `migrating:${Date.now()}`)
      const raw = await adapter.get(getCollectionStorageKey(collection))
      const normalizedRows = parseRowsPayload(raw).map(row => toLocalRowRecord(collection, row))
      await adapter.replaceRows(collection, normalizedRows)
      await adapter.set(stateKey, 'migrated')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'unknown')
      await adapter.set(stateKey, `failed:${Date.now()}:${message}`)
      throw error
    }
  }

  private async readLegacyTable<T>(collection: LocalCollectionName): Promise<T[]> {
    const adapter = getLocalDbAdapter()
    const raw = await adapter.get(getCollectionStorageKey(collection))
    return typedRows<T>(normalizeRows(parseRowsPayload(raw)))
  }

  private async writeLegacyTable<T>(collection: LocalCollectionName, rows: T[]) {
    const adapter = getLocalDbAdapter()
    const storedRows = rows.filter((row): row is T & StoredLocalRow => isStoredLocalRow(row))
    const normalized = normalizeRows(storedRows)
    await adapter.set(getCollectionStorageKey(collection), JSON.stringify(normalized))
    const revision = (await adapter.getCollectionRevision(collection)) + 1
    await adapter.set(getRevisionKey(collection), String(revision))
    this.cache.set(collection, { revision, rows: normalized })
  }

  private async readV2Table<T>(collection: LocalCollectionName): Promise<T[]> {
    const adapter = getLocalDbAdapter()
    const revision = await adapter.getCollectionRevision(collection)
    const cached = this.cache.get(collection)
    if (cached && cached.revision === revision) {
      return typedRows<T>(cached.rows)
    }
    const records = await adapter.getAllRows(collection)
    const rows = normalizeRows(records.map(record => parseRow<StoredLocalRow>(record)).filter(isStoredLocalRow))
    this.cache.set(collection, { revision, rows })
    return typedRows<T>(rows)
  }

  async getReadonlyTable<C extends LocalCollectionName>(collection: C): Promise<readonly LocalRowOf<C>[]>
  async getReadonlyTable<T>(collection: LocalCollectionName): Promise<readonly T[]>
  async getReadonlyTable<T>(collection: LocalCollectionName): Promise<readonly T[]> {
    const useV2 = await this.ensureCollectionStorage(collection)
    return useV2
      ? await this.readV2Table<T>(collection)
      : await this.readLegacyTable<T>(collection)
  }

  async getTable<C extends LocalCollectionName>(collection: C): Promise<LocalRowOf<C>[]>
  async getTable<T>(collection: LocalCollectionName): Promise<T[]>
  async getTable<T>(collection: LocalCollectionName): Promise<T[]> {
    return cloneRows(await this.getReadonlyTable<T>(collection) as T[])
  }

  private async replaceV2Table<T>(collection: LocalCollectionName, rows: T[]) {
    const adapter = getLocalDbAdapter()
    const storedRows = rows.filter((row): row is T & StoredLocalRow => isStoredLocalRow(row))
    const normalized = normalizeRows(storedRows)
    await adapter.replaceRows(collection, normalized.map(row => toLocalRowRecord(collection, row)))
    const revision = await adapter.getCollectionRevision(collection)
    this.cache.set(collection, { revision, rows: normalized })
  }

  async replaceTable<C extends LocalCollectionName>(collection: C, rows: LocalRowOf<C>[]): Promise<void>
  async replaceTable<T>(collection: LocalCollectionName, rows: T[]): Promise<void>
  async replaceTable<T>(collection: LocalCollectionName, rows: T[]) {
    const runReplace = async () => {
      const useV2 = await this.ensureCollectionStorage(collection)
      if (useV2) {
        await this.replaceV2Table(collection, rows)
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
        const rows = await this.readLegacyTable<StoredLocalRow>(collection)
        await this.writeLegacyTable(collection, rows.filter(row => row.family_id !== familyId))
      }
      this.emit([collection])
    }
    const transaction = this.transactionQueue.then(runDelete, runDelete)
    this.transactionQueue = transaction.then(() => undefined, () => undefined)
    return transaction
  }

  async transact<C extends LocalCollectionName, T>(
    collections: readonly C[],
    mutator: (tables: Pick<LocalTransactionTables, C>) => T | Promise<T>,
  ): Promise<T>
  async transact<T>(
    collections: readonly LocalCollectionName[],
    mutator: (tables: TransactionTables) => T | Promise<T>,
  ): Promise<T> {
    const runTransaction = async () => {
      const uniqueCollections = [...new Set(collections)] as LocalCollectionName[]
      const snapshots = new Map<LocalCollectionName, TransactionSnapshot>()
      const adapter = getLocalDbAdapter()

      for (const collection of uniqueCollections) {
        const useV2 = await this.ensureCollectionStorage(collection)
        const revision = useV2 ? await adapter.getCollectionRevision(collection) : 0
        const originalRows = useV2
          ? [...await this.getReadonlyTable<StoredLocalRow>(collection)]
          : await this.readLegacyTable<StoredLocalRow>(collection)
        snapshots.set(collection, {
          useV2,
          revision,
          originalRows,
          accessed: false,
        })
      }

      const workingCopy = createTransactionTables(uniqueCollections, snapshots)
      const result = await mutator(workingCopy)
      const changedCollections: LocalCollectionName[] = []

      for (const collection of uniqueCollections) {
        const snapshot = snapshots.get(collection)
        if (!snapshot?.accessed) continue
        const workingRows = snapshot.workingRows || snapshot.originalRows
        if (snapshot.useV2) {
          if (await this.commitV2Diff(collection, snapshot.originalRows, workingRows, snapshot.revision)) {
            changedCollections.push(collection)
          }
        } else if (!sameRows(snapshot.originalRows, workingRows)) {
          await this.writeLegacyTable(collection, workingRows)
          changedCollections.push(collection)
        } else {
          continue
        }
      }

      if (changedCollections.length) this.emit(changedCollections)
      return result
    }

    const transaction = this.transactionQueue.then(runTransaction, runTransaction)
    this.transactionQueue = transaction.then(() => undefined, () => undefined)
    return transaction
  }

  async transactRows<C extends LocalCollectionName, T>(
    collection: C,
    mutator: (ctx: LocalRowTransactionContext<C>) => T | Promise<T>,
  ): Promise<T>
  async transactRows<C extends LocalCollectionName, T>(
    collections: readonly C[],
    mutator: (ctx: LocalMultiRowTransactionContext<C>) => T | Promise<T>,
  ): Promise<T>
  async transactRows<C extends LocalCollectionName, T>(
    collectionOrCollections: C | readonly C[],
    mutator: ((ctx: LocalRowTransactionContext<C>) => T | Promise<T>) | ((ctx: LocalMultiRowTransactionContext<C>) => T | Promise<T>),
  ): Promise<T> {
    if (typeof collectionOrCollections !== 'string') {
      return this.transactMultiRows(collectionOrCollections, mutator as (ctx: LocalMultiRowTransactionContext<C>) => T | Promise<T>)
    }
    const collection = collectionOrCollections
    const runTransaction = async () => {
      const adapter = getLocalDbAdapter()
      const useV2 = await this.ensureCollectionStorage(collection)
      const revision = useV2 ? await adapter.getCollectionRevision(collection) : 0
      const originalMap = new Map<string, LocalRowOf<C> | null>()
      const workingMap = new Map<string, LocalRowOf<C> | null>()
      let legacyRows: LocalRowOf<C>[] | null = null

      const readLegacyRows = async () => {
        if (!legacyRows) legacyRows = await this.readLegacyTable<LocalRowOf<C>>(collection)
        return legacyRows
      }

      const loadOriginalRow = async (id: string) => {
        if (originalMap.has(id)) return originalMap.get(id) || null
        const record = useV2 ? await adapter.getRow(collection, id) : null
        const row = useV2
          ? record ? parseRow<LocalRowOf<C>>(record) : null
          : (await readLegacyRows()).find(item => item._id === id) || null
        originalMap.set(id, row)
        workingMap.set(id, row ? cloneRows([row])[0] : null)
        return workingMap.get(id) || null
      }

      const ctx: LocalRowTransactionContext<C> = {
        async getRow(id) {
          if (workingMap.has(id)) return workingMap.get(id) || null
          return loadOriginalRow(id)
        },
        async upsertRow(row) {
          if (!row?._id) throw new Error('LOCAL_DB_ROW_ID_REQUIRED')
          await loadOriginalRow(row._id)
          workingMap.set(row._id, row)
        },
        async updateRow(id, patch) {
          const current = await this.getRow(id)
          if (!current) return null
          const next = typeof patch === 'function'
            ? patch(current)
            : { ...current, ...patch }
          workingMap.set(id, next)
          return next
        },
        async deleteRow(id) {
          await loadOriginalRow(id)
          workingMap.set(id, null)
        },
      }

      const result = await (mutator as (ctx: LocalRowTransactionContext<C>) => T | Promise<T>)(ctx)
      const originalRows = Array.from(originalMap.values()).filter(isPresent)
      const workingRows = Array.from(workingMap.values()).filter(isPresent)
      const changed = !sameRows(originalRows, workingRows)

      if (changed && useV2) {
        if (await this.commitV2Diff(collection, originalRows, workingRows, revision)) {
          this.emit([collection])
        }
      } else if (changed) {
        const nextMap = buildTypedRowMap<LocalRowOf<C>>(legacyRows || [])
        for (const [id, row] of workingMap.entries()) {
          if (row) nextMap.set(id, row)
          else nextMap.delete(id)
        }
        await this.writeLegacyTable(collection, Array.from(nextMap.values()))
        this.emit([collection])
      }

      return result
    }

    const transaction = this.transactionQueue.then(runTransaction, runTransaction)
    this.transactionQueue = transaction.then(() => undefined, () => undefined)
    return transaction
  }

  private async transactMultiRows<C extends LocalCollectionName, T>(
    collections: readonly C[],
    mutator: (ctx: LocalMultiRowTransactionContext<C>) => T | Promise<T>,
  ): Promise<T> {
    const runTransaction = async () => {
      const adapter = getLocalDbAdapter()
      const uniqueCollections = [...new Set(collections)] as C[]
      const states = new Map<C, {
        useV2: boolean
        revision: number
        originalMap: Map<string, LocalRowOf<C> | null>
        workingMap: Map<string, LocalRowOf<C> | null>
        legacyRows: LocalRowOf<C>[] | null
      }>()

      for (const collection of uniqueCollections) {
        const useV2 = await this.ensureCollectionStorage(collection)
        states.set(collection, {
          useV2,
          revision: useV2 ? await adapter.getCollectionRevision(collection) : 0,
          originalMap: new Map(),
          workingMap: new Map(),
          legacyRows: null,
        })
      }

      const getState = <TCollection extends C>(collection: TCollection) => {
        const state = states.get(collection)
        if (!state) throw new Error(`LOCAL_DB_ROW_COLLECTION_NOT_IN_TRANSACTION:${collection}`)
        return state as {
          useV2: boolean
          revision: number
          originalMap: Map<string, LocalRowOf<TCollection> | null>
          workingMap: Map<string, LocalRowOf<TCollection> | null>
          legacyRows: LocalRowOf<TCollection>[] | null
        }
      }

      const readLegacyRows = async <TCollection extends C>(collection: TCollection) => {
        const state = getState(collection)
        if (!state.legacyRows) state.legacyRows = await this.readLegacyTable<LocalRowOf<TCollection>>(collection)
        return state.legacyRows
      }

      const loadOriginalRow = async <TCollection extends C>(collection: TCollection, id: string) => {
        const state = getState(collection)
        if (state.originalMap.has(id)) return state.originalMap.get(id) || null
        const record = state.useV2 ? await adapter.getRow(collection, id) : null
        const row = state.useV2
          ? record ? parseRow<LocalRowOf<TCollection>>(record) : null
          : (await readLegacyRows(collection)).find(item => item._id === id) || null
        state.originalMap.set(id, row)
        state.workingMap.set(id, row ? cloneRows([row])[0] : null)
        return state.workingMap.get(id) || null
      }

      const ctx: LocalMultiRowTransactionContext<C> = {
        async getRow(collection, id) {
          const state = getState(collection)
          if (state.workingMap.has(id)) return state.workingMap.get(id) || null
          return loadOriginalRow(collection, id)
        },
        async upsertRow(collection, row) {
          if (!row?._id) throw new Error('LOCAL_DB_ROW_ID_REQUIRED')
          const state = getState(collection)
          await loadOriginalRow(collection, row._id)
          state.workingMap.set(row._id, row)
        },
        async updateRow(collection, id, patch) {
          const current = await this.getRow(collection, id)
          if (!current) return null
          const next = typeof patch === 'function'
            ? patch(current)
            : { ...current, ...patch }
          getState(collection).workingMap.set(id, next)
          return next
        },
        async deleteRow(collection, id) {
          await loadOriginalRow(collection, id)
          getState(collection).workingMap.set(id, null)
        },
      }

      const result = await mutator(ctx)
      const changedCollections: LocalCollectionName[] = []

      for (const collection of uniqueCollections) {
        const state = getState(collection)
        const originalRows = Array.from(state.originalMap.values()).filter(isPresent)
        const workingRows = Array.from(state.workingMap.values()).filter(isPresent)
        const changed = !sameRows(originalRows, workingRows)
        if (!changed) continue

        if (state.useV2) {
          if (await this.commitV2Diff(collection, originalRows, workingRows, state.revision)) {
            changedCollections.push(collection)
          }
        } else {
          const nextMap = buildTypedRowMap<LocalRowOf<typeof collection>>(state.legacyRows || [])
          for (const [id, row] of state.workingMap.entries()) {
            if (row) nextMap.set(id, row)
            else nextMap.delete(id)
          }
          await this.writeLegacyTable(collection, Array.from(nextMap.values()))
          changedCollections.push(collection)
        }
      }

      if (changedCollections.length) this.emit(changedCollections)
      return result
    }

    const transaction = this.transactionQueue.then(runTransaction, runTransaction)
    this.transactionQueue = transaction.then(() => undefined, () => undefined)
    return transaction
  }

  private async commitV2Diff(collection: LocalCollectionName, originalRows: unknown[], workingRows: unknown[], originalRevision: number) {
    const adapter = getLocalDbAdapter()
    const currentRevision = await adapter.getCollectionRevision(collection)
    const originalMap = buildMap(originalRows.filter(isRowWithId))
    const workingMap = buildMap(workingRows.filter(isRowWithId))
    const allIds = new Set([...originalMap.keys(), ...workingMap.keys()])
    const changedIds = Array.from(allIds).filter(id => !sameRow(originalMap.get(id) || null, workingMap.get(id) || null))
    if (!changedIds.length) return false

    if (currentRevision !== originalRevision) {
      const currentRows = (await adapter.getRowsByIds(collection, changedIds))
        .map(record => parseRow<StoredLocalRow>(record))
        .filter(isStoredLocalRow)
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
      .filter(isStoredLocalRow)
      .map(row => toLocalRowRecord(collection, row))
    const idsToDelete = changedIds.filter(id => !workingMap.has(id))

    if (rowsToPut.length) await adapter.putRows(collection, rowsToPut)
    if (idsToDelete.length) await adapter.deleteRows(collection, idsToDelete)
    this.cache.delete(collection)
    return true
  }

  async query<C extends LocalCollectionName>(
    collection: C,
    predicate?: (row: LocalRowOf<C>) => boolean,
    options?: { sort?: (a: LocalRowOf<C>, b: LocalRowOf<C>) => number },
  ): Promise<LocalRowOf<C>[]>
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

  async queryReadonly<C extends LocalCollectionName>(
    collection: C,
    predicate?: (row: LocalRowOf<C>) => boolean,
    options?: { sort?: (a: LocalRowOf<C>, b: LocalRowOf<C>) => number },
  ): Promise<LocalRowOf<C>[]>
  async queryReadonly<T>(
    collection: LocalCollectionName,
    predicate?: (row: T) => boolean,
    options?: { sort?: (a: T, b: T) => number },
  ): Promise<T[]>
  async queryReadonly<T>(
    collection: LocalCollectionName,
    predicate?: (row: T) => boolean,
    options: {
      sort?: (a: T, b: T) => number
    } = {},
  ): Promise<T[]> {
    const rows = await this.getReadonlyTable<T>(collection)
    const filtered = predicate ? rows.filter(predicate) : [...rows]
    return options.sort ? [...filtered].sort(options.sort) : filtered as T[]
  }

  async getRowsByFamilyReadonly<C extends LocalCollectionName>(collection: C, familyId: string): Promise<readonly LocalRowOf<C>[]>
  async getRowsByFamilyReadonly<T>(collection: LocalCollectionName, familyId: string): Promise<readonly T[]>
  async getRowsByFamilyReadonly<T>(collection: LocalCollectionName, familyId: string): Promise<readonly T[]> {
    if (!familyId) return []
    const useV2 = await this.ensureCollectionStorage(collection)
    if (useV2) {
      const records = await getLocalDbAdapter().getRowsByFamily(collection, familyId)
      return typedRows<T>(normalizeRows(records.map(record => parseRow<StoredLocalRow>(record)).filter(isStoredLocalRow)))
    }
    const rows = await this.readLegacyTable<T>(collection)
    return rows.filter((row) => {
      if (!isStoredLocalRow(row)) return false
      return row.family_id === familyId || row._id === familyId
    })
  }

  async getRowsByFamily<C extends LocalCollectionName>(collection: C, familyId: string): Promise<LocalRowOf<C>[]>
  async getRowsByFamily<T>(collection: LocalCollectionName, familyId: string): Promise<T[]>
  async getRowsByFamily<T>(collection: LocalCollectionName, familyId: string): Promise<T[]> {
    return cloneRows(await this.getRowsByFamilyReadonly<T>(collection, familyId) as T[])
  }

  async findReadonlyById<C extends LocalCollectionName>(collection: C, id: string): Promise<LocalRowOf<C> | null>
  async findReadonlyById<T extends { _id: string }>(collection: LocalCollectionName, id: string): Promise<T | null>
  async findReadonlyById<T extends { _id: string }>(collection: LocalCollectionName, id: string) {
    if (!id) return null
    const useV2 = await this.ensureCollectionStorage(collection)
    if (useV2) {
      const row = await getLocalDbAdapter().getRow(collection, id)
      return row ? parseRow<T>(row) : null
    }
    const rows = await this.getReadonlyTable<T>(collection)
    return rows.find(row => row._id === id) || null
  }

  async upsertRows<C extends LocalCollectionName>(
    collection: C,
    rows: Array<LocalRowOf<C> & { _id: string; updated_at?: number; created_at?: number }>,
  ): Promise<void>
  async upsertRows<T extends { _id: string; updated_at?: number; created_at?: number }>(
    collection: LocalCollectionName,
    rows: T[],
  ): Promise<void>
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
          .filter((row): row is T => isRowWithId(row))
          .map(row => [row._id, row]),
      )
      const nextRows = normalizedRows.map(row => ({
        ...(currentMap.get(row._id) || {}),
        ...row,
      }))
      await adapter.putRows(collection, nextRows.filter(isStoredLocalRow).map(row => toLocalRowRecord(collection, row)))
      this.cache.delete(collection)
      this.emit([collection])
    }

    const transaction = this.transactionQueue.then(runUpsert, runUpsert)
    this.transactionQueue = transaction.then(() => undefined, () => undefined)
    return transaction
  }

  async findById<C extends LocalCollectionName>(collection: C, id: string): Promise<LocalRowOf<C> | null>
  async findById<T extends { _id: string }>(collection: LocalCollectionName, id: string): Promise<T | null>
  async findById<T extends { _id: string }>(collection: LocalCollectionName, id: string) {
    const parsed = await this.findReadonlyById<T>(collection, id)
    return parsed ? cloneRows([parsed])[0] : null
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
    return getLocalDbAdapter().getCollectionRevision(collection)
  }

  async retryStorageMigration(collection: LocalCollectionName) {
    const adapter = getLocalDbAdapter()
    await adapter.set(`${MIGRATION_RETRY_KEY_PREFIX}:${collection}`, '1')
    await adapter.remove(getMigrationStorageKey(collection))
    this.cache.delete(collection)
  }

  async resetForTest() {
    const adapter = getLocalDbAdapter()
    if (adapter.resetForTest) await adapter.resetForTest()
    this.cache.clear()
    this.transactionQueue = Promise.resolve()
  }
}

export const localDb = new LocalDb()
