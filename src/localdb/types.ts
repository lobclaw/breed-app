import type { BreedingCycle, BreedingRecord, Litter } from '@/types/breeding'
import type { Dog, DogWeight } from '@/types/dog'
import type { Family } from '@/types/family'
import type { Agent, Expense, Income, SaleRecord } from '@/types/finance'
import type { HealthRecord, MedicationProtocol, MedicationTask } from '@/types/health'
import type { Task } from '@/types/task'

export const BUSINESS_COLLECTIONS = [
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
  'families',
  'agents',
  'dog_weights',
  'medication_protocols',
] as const

export const SYSTEM_COLLECTIONS = [
  'outbox_mutations',
  'local_operation_logs',
  'sync_state',
  'sync_conflicts',
  'local_meta',
  'image_cache_entries',
  'sync_issues',
] as const

export const LOCAL_COLLECTIONS = [...BUSINESS_COLLECTIONS, ...SYSTEM_COLLECTIONS] as const

export type BusinessCollectionName = typeof BUSINESS_COLLECTIONS[number]
export type SystemCollectionName = typeof SYSTEM_COLLECTIONS[number]
export type LocalCollectionName = typeof LOCAL_COLLECTIONS[number]

export type MutationStatus = 'pending' | 'processing' | 'synced' | 'failed' | 'conflict'

export interface SyncMetadata {
  clientMutationId: string
  deviceId: string
  baseVersions?: Record<string, number>
  clientTimestamp: number
  clientEntityIds?: Record<string, string | string[]>
  autoHealthRecords?: Array<{
    taskId: string
    recordId: string
    dogId?: string
    dogName?: string
    type?: string
    date?: number
    details?: Record<string, unknown> | null
  }>
}

export interface OutboxMutation<T = Record<string, unknown>> {
  _id: string
  type: string
  collection_scope: BusinessCollectionName[]
  payload: T
  family_id: string
  status: MutationStatus
  retry_count: number
  next_retry_at: number
  last_error?: string | null
  client_mutation_id: string
  device_id: string
  created_at: number
  updated_at: number
}

export interface LocalOperationLogRow {
  _id: string
  family_id: string
  client_mutation_id: string
  mutation_type: string
  actor_user_id?: string | null
  actor_name?: string | null
  action_type: string
  domain: string
  target_type: string
  target_id: string
  target_name: string
  summary: string
  status: MutationStatus
  last_error?: string | null
  meta?: Record<string, unknown> | null
  created_at: number
  updated_at: number
}

export interface SyncStateRow {
  _id: string
  family_id?: string
  collection: BusinessCollectionName
  last_pulled_at: number
  last_pulled_id?: string
  last_full_sync_at: number
  last_ack_at: number
  updated_at: number
}

export interface SyncConflictRow {
  _id: string
  client_mutation_id: string
  collection: string
  entity_id: string
  base_version: number
  server_version: number
  status: 'open' | 'retrying' | 'resolved'
  detail?: Record<string, unknown> | null
  created_at: number
  updated_at: number
}

export interface LocalMetaRow {
  _id: string
  key: string
  value: unknown
  updated_at: number
}

export interface ImageCacheEntry {
  _id: string
  file_id: string
  family_id: string
  local_src: string
  size: number
  created_at: number
  last_accessed_at: number
  updated_at: number
}

export type SyncIssueKind = 'pending_upload' | 'sync_failed' | 'conflict'

export interface SyncIssueRow {
  _id: string
  family_id: string
  kind: SyncIssueKind
  status: 'open' | 'resolved'
  collection: string
  record_id?: string | null
  mutation_id?: string | null
  title: string
  last_error?: string | null
  created_at?: number
  updated_at: number
}

type LocalBusinessRow<T> = T & {
  deleted_at?: number | null
  version?: number
  _local_pending?: boolean
  _pending_upload?: boolean
  pending_upload?: boolean
  _upload_error?: string | null
  upload_error?: string | null
}

export interface LocalTableMap {
  dogs: LocalBusinessRow<Dog>
  breeding_cycles: LocalBusinessRow<BreedingCycle>
  litters: LocalBusinessRow<Litter>
  breeding_records: LocalBusinessRow<BreedingRecord>
  health_records: LocalBusinessRow<HealthRecord>
  medication_tasks: LocalBusinessRow<MedicationTask>
  tasks: LocalBusinessRow<Task>
  expenses: LocalBusinessRow<Expense>
  incomes: LocalBusinessRow<Income>
  sale_records: LocalBusinessRow<SaleRecord>
  families: LocalBusinessRow<Family>
  agents: LocalBusinessRow<Agent>
  dog_weights: LocalBusinessRow<DogWeight>
  medication_protocols: LocalBusinessRow<MedicationProtocol>
  outbox_mutations: OutboxMutation
  local_operation_logs: LocalOperationLogRow
  sync_state: SyncStateRow
  sync_conflicts: SyncConflictRow
  local_meta: LocalMetaRow
  image_cache_entries: ImageCacheEntry
  sync_issues: SyncIssueRow
}

export type LocalRowOf<C extends LocalCollectionName> = LocalTableMap[C]

export interface SyncTouchedEntity {
  collection: BusinessCollectionName
  id: string
  version: number
  updatedAt: number
  deletedAt?: number | null
}

export interface SyncConflictPayload {
  collection: string
  entityId: string
  baseVersion: number
  serverVersion: number
  reason?: string
}

export interface SyncAckPayload {
  ack?: 'accepted' | 'duplicate' | 'conflict'
  clientMutationId?: string | null
  touchedEntities?: SyncTouchedEntity[]
  resyncScopes?: string[]
  conflict?: SyncConflictPayload | null
}

export interface LocalDbChangeEvent {
  collections: LocalCollectionName[]
}
