type QueryValue = string | undefined
type QueryLike = Record<string, QueryValue>

const BREEDING_RECORD_EDIT_ROUTES: Record<string, string> = {
  heat: '/pages/record/breeding-heat',
  follicle_check: '/pages/record/breeding-follicle',
  mating: '/pages/record/breeding-mating',
  pregnancy_check: '/pages/record/breeding-pregnancy',
  prenatal_check: '/pages/record/breeding-prenatal',
  pre_labor: '/pages/record/breeding-prelabor',
  abnormal_termination: '/pages/record/breeding-termination',
  heat_observation: '/pages/record/heat-observation',
}

const HEALTH_RECORD_EDIT_ROUTES: Record<string, string> = {
  vaccination: '/pages/record/health-vaccination',
  deworming: '/pages/record/health-deworming',
  illness: '/pages/record/health-illness',
}

export interface MedicationRouteIllnessLink {
  dogId: string
  illnessRecordId: string
  primaryCondition?: string
  symptomSummary?: string
  treatmentStatus?: string
}

function getString(value?: string) {
  return typeof value === 'string' ? value : ''
}

function parseJsonParam<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(decodeURIComponent(value)) as T
  } catch {
    return fallback
  }
}

export function resolveSourceTaskIds(query: QueryLike = {}) {
  const taskId = getString(query.taskId || query.task_id)
  if (taskId) return [taskId]

  const taskIds = getString(query.taskIds || query.task_ids)
  return taskIds
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

export function resolveRecordFormEditId(query: QueryLike = {}) {
  return getString(query.id || query.recordId || query.record_id)
}

export function resolveBreedingRecordEditBaseUrl(type: string | undefined) {
  return BREEDING_RECORD_EDIT_ROUTES[getString(type)] || ''
}

export function buildBreedingRecordEditUrl(type: string | undefined, recordId: string | undefined, query: QueryLike = {}) {
  const baseUrl = resolveBreedingRecordEditBaseUrl(type)
  const id = getString(recordId)
  if (!baseUrl || !id) return ''

  const params = [`id=${encodeURIComponent(id)}`]
  const focus = getString(query.focus)
  if (focus) params.push(`focus=${encodeURIComponent(focus)}`)
  return `${baseUrl}?${params.join('&')}`
}

export function resolveHealthRecordEditBaseUrl(type: string | undefined) {
  return HEALTH_RECORD_EDIT_ROUTES[getString(type)] || ''
}

export function buildHealthRecordEditUrl(type: string | undefined, recordId: string | undefined, query: QueryLike = {}) {
  const baseUrl = resolveHealthRecordEditBaseUrl(type)
  const id = getString(recordId)
  if (!baseUrl || !id) return ''

  const params = [`id=${encodeURIComponent(id)}`]
  const focus = getString(query.focus)
  if (focus) params.push(`focus=${encodeURIComponent(focus)}`)
  return `${baseUrl}?${params.join('&')}`
}

export function resolveBatchDogs(query: QueryLike = {}) {
  const batchDogs = parseJsonParam<any[]>(query.batchDogs || query.batch_dogs, [])
  if (batchDogs.length > 0) return batchDogs

  const dogId = getString(query.dogId || query.dog_id)
  if (!dogId) return []

  return [{
    _id: dogId,
    name: query.dogName ? decodeURIComponent(query.dogName) : query.dog_name ? decodeURIComponent(query.dog_name) : '',
  }]
}

export function resolvePrefillDetails<T extends Record<string, any>>(query: QueryLike = {}) {
  return parseJsonParam<T>(query.details, {} as T)
}

export function resolveMedicationRouteQuery(query: QueryLike = {}) {
  return {
    selectedDogs: resolveBatchDogs(query),
    illnessRecordId: getString(query.illnessRecordId || query.illness_record_id),
    illnessLinks: parseJsonParam<MedicationRouteIllnessLink[]>(query.illnessLinks || query.illness_links, []),
  }
}

export function resolveHealthCreateRouteQuery(query: QueryLike = {}) {
  return {
    fromTask: Boolean(query.taskId || query.task_id || query.batchDogs || query.batch_dogs),
    sourceTaskIds: resolveSourceTaskIds(query),
    selectedDogs: resolveBatchDogs(query),
    details: resolvePrefillDetails(query),
  }
}

export function resolveBreedingRouteQuery(query: QueryLike = {}) {
  const dogId = getString(query.dogId || query.dog_id)
  const dogName = getString(query.dogName || query.dog_name)

  return {
    cycleId: getString(query.cycleId || query.cycle_id),
    taskId: getString(query.taskId || query.task_id),
    dogLocked: query.locked === 'true' || Boolean(dogName),
    selectedDog: dogId
      ? {
        _id: dogId,
        name: dogName ? decodeURIComponent(dogName) : '',
        gender: '母',
        role: '种狗',
      }
      : null,
  }
}
