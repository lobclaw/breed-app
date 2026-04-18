import type { DeriveStatus } from '@/types/dog'

type StatusRouteSource = Pick<DeriveStatus, 'type' | 'recordId' | 'taskId' | 'cycleId'>

const BREEDING_STATUS_TYPES = new Set<DeriveStatus['type']>(['发情中', '怀孕中', '哺乳中'])

function normalizeRouteId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getStatusField(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = normalizeRouteId(source[key])
    if (value) return value
  }
  return ''
}

export function buildMedicationDetailUrl(id: string) {
  return `/pages/record/medication-detail?id=${encodeURIComponent(id)}`
}

export function resolveMedicationDetailId(query?: Record<string, unknown> | null) {
  const id = normalizeRouteId(query?.id)
  if (id) return id
  const taskId = normalizeRouteId(query?.taskId)
  if (taskId) return taskId
  const medicationTaskId = normalizeRouteId(query?.medicationTaskId)
  if (medicationTaskId) return medicationTaskId
  return normalizeRouteId(query?.medication_task_id)
}

export function resolveDogDetailStatusRoute(status: StatusRouteSource | (Record<string, unknown> & { type: string })) {
  const source = status as Record<string, unknown>
  const recordId = getStatusField(source, 'recordId', 'record_id')
  const taskId = getStatusField(source, 'taskId', 'task_id', 'medicationTaskId', 'medication_task_id')
  const cycleId = getStatusField(source, 'cycleId', 'cycle_id')

  if (status.type === '生病中' && recordId) {
    return `/pages/record/health-detail?id=${encodeURIComponent(recordId)}`
  }

  if (status.type === '用药中' && taskId) {
    return buildMedicationDetailUrl(taskId)
  }

  if (BREEDING_STATUS_TYPES.has(status.type as DeriveStatus['type']) && cycleId) {
    return `/pages/breeding/cycle?id=${encodeURIComponent(cycleId)}`
  }

  return ''
}
