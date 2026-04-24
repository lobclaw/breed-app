import { cloudCall } from '@/composables/useCloudCall'
import type { BusinessCollectionName, OutboxMutation, SyncMetadata } from '@/localdb/types'

export const LOCAL_MUTATION_TYPES = {
  CREATE_HEALTH_RECORDS: 'health.batchAddHealthRecords',
  CREATE_MEDICATION_TASKS: 'health.batchStartMedication',
  CREATE_BREEDING_RECORD: 'breeding.addBreedingRecord',
  BATCH_CREATE_BREEDING_RECORDS: 'breeding.batchAddBreedingRecords',
  CREATE_EXPENSE: 'finance.addExpense',
  CREATE_INCOME: 'finance.addIncome',
  BATCH_CREATE_TASKS: 'task.batchCreateManualTasks',
  CREATE_DOG: 'dog.create',
  UPDATE_DOG: 'dog.update',
  UPDATE_DOG_NAME: 'dog.updateName',
  SOFT_DELETE_DOG: 'dog.softDelete',
  RESTORE_DOG: 'dog.restore',
  RECYCLE_RESTORE: 'recycle.restore',
  RECYCLE_PERMANENT_DELETE: 'recycle.permanentDelete',
  COMPLETE_TASK: 'task.complete',
  BATCH_COMPLETE_TASK: 'task.batchComplete',
  POSTPONE_TASK: 'task.postpone',
  BATCH_POSTPONE_TASK: 'task.batchPostpone',
  RECORD_MEDICATION_DOSE: 'health.recordMedicationDose',
  BATCH_COMPLETE_MEDICATION_DAY: 'health.batchCompleteMedicationDay',
  RECOVER_ILLNESSES: 'health.recoverIllnesses',
  UPDATE_ILLNESS_STATUS: 'health.batchUpdateIllnessStatus',
  END_MEDICATION_BY_DOG: 'health.endMedicationByDog',
} as const

export type LocalMutationType = typeof LOCAL_MUTATION_TYPES[keyof typeof LOCAL_MUTATION_TYPES]
export type LocalMutationPayload = Record<string, any>

export interface LocalMutationDefinition {
  service: string
  method: string
  defaultScopes: BusinessCollectionName[]
}

export const LOCAL_MUTATION_REGISTRY: Record<LocalMutationType, LocalMutationDefinition> = {
  [LOCAL_MUTATION_TYPES.CREATE_HEALTH_RECORDS]: { service: 'health-service', method: 'batchAddHealthRecords', defaultScopes: ['health_records', 'tasks', 'expenses'] },
  [LOCAL_MUTATION_TYPES.CREATE_MEDICATION_TASKS]: { service: 'health-service', method: 'batchStartMedication', defaultScopes: ['medication_tasks', 'health_records', 'expenses'] },
  [LOCAL_MUTATION_TYPES.CREATE_BREEDING_RECORD]: { service: 'breeding-service', method: 'addBreedingRecord', defaultScopes: ['breeding_records', 'breeding_cycles', 'tasks', 'expenses', 'litters'] },
  [LOCAL_MUTATION_TYPES.BATCH_CREATE_BREEDING_RECORDS]: { service: 'breeding-service', method: 'batchAddBreedingRecords', defaultScopes: ['breeding_records', 'breeding_cycles', 'tasks'] },
  [LOCAL_MUTATION_TYPES.CREATE_EXPENSE]: { service: 'finance-service', method: 'addExpense', defaultScopes: ['expenses'] },
  [LOCAL_MUTATION_TYPES.CREATE_INCOME]: { service: 'finance-service', method: 'addIncome', defaultScopes: ['incomes'] },
  [LOCAL_MUTATION_TYPES.BATCH_CREATE_TASKS]: { service: 'task-service', method: 'batchCreateManualTasks', defaultScopes: ['tasks'] },
  [LOCAL_MUTATION_TYPES.CREATE_DOG]: { service: 'dog-service', method: 'createDog', defaultScopes: ['dogs', 'expenses'] },
  [LOCAL_MUTATION_TYPES.UPDATE_DOG]: { service: 'dog-service', method: 'updateDog', defaultScopes: ['dogs'] },
  [LOCAL_MUTATION_TYPES.UPDATE_DOG_NAME]: { service: 'dog-service', method: 'updateDogName', defaultScopes: ['dogs', 'tasks', 'breeding_cycles', 'litters'] },
  [LOCAL_MUTATION_TYPES.SOFT_DELETE_DOG]: { service: 'dog-service', method: 'softDeleteDog', defaultScopes: ['dogs'] },
  [LOCAL_MUTATION_TYPES.RESTORE_DOG]: { service: 'dog-service', method: 'restoreDog', defaultScopes: ['dogs'] },
  [LOCAL_MUTATION_TYPES.RECYCLE_RESTORE]: { service: 'family-service', method: 'restoreItem', defaultScopes: ['dogs', 'expenses', 'incomes', 'agents', 'medication_protocols'] },
  [LOCAL_MUTATION_TYPES.RECYCLE_PERMANENT_DELETE]: { service: 'family-service', method: 'permanentDeleteItem', defaultScopes: ['dogs', 'expenses', 'incomes', 'agents', 'medication_protocols'] },
  [LOCAL_MUTATION_TYPES.COMPLETE_TASK]: { service: 'task-service', method: 'completeTask', defaultScopes: ['tasks', 'health_records'] },
  [LOCAL_MUTATION_TYPES.BATCH_COMPLETE_TASK]: { service: 'task-service', method: 'batchCompleteTask', defaultScopes: ['tasks', 'health_records'] },
  [LOCAL_MUTATION_TYPES.POSTPONE_TASK]: { service: 'task-service', method: 'postponeTask', defaultScopes: ['tasks'] },
  [LOCAL_MUTATION_TYPES.BATCH_POSTPONE_TASK]: { service: 'task-service', method: 'batchPostponeTask', defaultScopes: ['tasks'] },
  [LOCAL_MUTATION_TYPES.RECORD_MEDICATION_DOSE]: { service: 'health-service', method: 'recordMedicationDose', defaultScopes: ['medication_tasks'] },
  [LOCAL_MUTATION_TYPES.BATCH_COMPLETE_MEDICATION_DAY]: { service: 'health-service', method: 'batchCompleteMedicationDay', defaultScopes: ['medication_tasks'] },
  [LOCAL_MUTATION_TYPES.RECOVER_ILLNESSES]: { service: 'health-service', method: 'recoverIllnesses', defaultScopes: ['health_records', 'medication_tasks'] },
  [LOCAL_MUTATION_TYPES.UPDATE_ILLNESS_STATUS]: { service: 'health-service', method: 'batchUpdateIllnessStatus', defaultScopes: ['health_records'] },
  [LOCAL_MUTATION_TYPES.END_MEDICATION_BY_DOG]: { service: 'health-service', method: 'endMedicationByDog', defaultScopes: ['medication_tasks'] },
}

export function buildSyncPayload<T extends LocalMutationPayload>(payload: T, syncMeta: SyncMetadata): T & { _sync: SyncMetadata } {
  return { ...payload, _sync: syncMeta }
}

export async function dispatchRegisteredMutation(mutation: OutboxMutation<LocalMutationPayload>) {
  const definition = LOCAL_MUTATION_REGISTRY[mutation.type as LocalMutationType]
  if (!definition) throw new Error(`未知 mutation 类型: ${mutation.type}`)
  return cloudCall(definition.service, definition.method, mutation.payload)
}
