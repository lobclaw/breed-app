import { localDb } from '@/localdb/db'
import type { LocalCollectionName, LocalRowOf } from '@/localdb/types'

type LocalPredicate<T> = (row: T) => boolean
type LocalTransactionTables = { [C in LocalCollectionName]: LocalRowOf<C>[] }

let transactionQueue = Promise.resolve()

function runSerial<T>(task: () => Promise<T>): Promise<T> {
  const next = transactionQueue.then(task, task)
  transactionQueue = next.then(() => undefined, () => undefined)
  return next
}

export async function queryLocal<C extends LocalCollectionName>(
  collection: C,
  predicate?: LocalPredicate<LocalRowOf<C>>,
  options?: { sort?: (a: LocalRowOf<C>, b: LocalRowOf<C>) => number },
): Promise<LocalRowOf<C>[]>
export async function queryLocal<T>(
  collection: LocalCollectionName,
  predicate?: LocalPredicate<T>,
  options?: { sort?: (a: T, b: T) => number },
): Promise<T[]>
export async function queryLocal<T>(
  collection: LocalCollectionName,
  predicate?: LocalPredicate<T>,
  options: { sort?: (a: T, b: T) => number } = {},
) {
  return localDb.queryReadonly<T>(collection, predicate, options)
}

export async function findLocal<C extends LocalCollectionName>(collection: C, id: string): Promise<LocalRowOf<C> | null>
export async function findLocal<T extends { _id: string }>(collection: LocalCollectionName, id: string): Promise<T | null>
export async function findLocal<T extends { _id: string }>(collection: LocalCollectionName, id: string) {
  return localDb.findReadonlyById<T>(collection, id)
}

export async function upsertLocalRows<C extends LocalCollectionName>(
  collection: C,
  rows: Array<LocalRowOf<C> & { _id: string; updated_at?: number; created_at?: number }>,
): Promise<void>
export async function upsertLocalRows<T extends { _id: string; updated_at?: number; created_at?: number }>(
  collection: LocalCollectionName,
  rows: T[],
): Promise<void>
export async function upsertLocalRows<T extends { _id: string; updated_at?: number; created_at?: number }>(
  collection: LocalCollectionName,
  rows: T[],
) {
  return runSerial(() => localDb.upsertRows(collection, rows))
}

export async function mutateLocal<C extends LocalCollectionName, T>(
  collections: readonly C[],
  mutator: (tables: Pick<LocalTransactionTables, C>) => T | Promise<T>,
): Promise<T>
export async function mutateLocal<T>(
  collections: readonly LocalCollectionName[],
  mutator: (tables: LocalTransactionTables) => T | Promise<T>,
): Promise<T>
export async function mutateLocal<T>(
  collections: readonly LocalCollectionName[],
  mutator: (tables: LocalTransactionTables) => T | Promise<T>,
) {
  return runSerial(() => localDb.transact(collections, mutator))
}
