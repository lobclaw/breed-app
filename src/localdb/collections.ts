import type { BusinessCollectionName } from '@/localdb/types'

export const HOME_SYNC_COLLECTIONS: BusinessCollectionName[] = [
  'dogs',
  'tasks',
  'health_records',
  'medication_tasks',
]

export const CORE_SYNC_COLLECTIONS: BusinessCollectionName[] = [
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
]

export const SOFT_DELETE_COLLECTIONS = new Set<BusinessCollectionName>([
  'dogs',
  'expenses',
  'incomes',
  'agents',
  'medication_protocols',
  'sale_records',
])

