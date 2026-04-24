import { localDb } from '@/localdb/db'
import type { LocalCollectionName } from '@/localdb/types'

type LocalPredicate<T> = (row: T) => boolean
type LocalTransactionTables = Record<string, any[]>

let transactionQueue = Promise.resolve()

function runSerial<T>(task: () => Promise<T>): Promise<T> {
  const next = transactionQueue.then(task, task)
  transactionQueue = next.then(() => undefined, () => undefined)
  return next
}

export async function queryLocal<T>(
  collection: LocalCollectionName,
  predicate?: LocalPredicate<T>,
  options: { sort?: (a: T, b: T) => number } = {},
) {
  return localDb.query<T>(collection, predicate, options)
}

export async function findLocal<T extends { _id: string }>(collection: LocalCollectionName, id: string) {
  return localDb.findById<T>(collection, id)
}

export async function upsertLocalRows<T extends { _id: string; updated_at?: number; created_at?: number }>(
  collection: LocalCollectionName,
  rows: T[],
) {
  return runSerial(() => localDb.upsertRows(collection, rows))
}

export async function mutateLocal<T>(
  collections: LocalCollectionName[],
  mutator: (tables: LocalTransactionTables) => T | Promise<T>,
) {
  return runSerial(() => localDb.transact(collections, mutator))
}

