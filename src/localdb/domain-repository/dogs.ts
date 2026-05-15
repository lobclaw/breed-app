import { localDb } from '@/localdb/db'
import type { BreedingRecord } from '@/types/breeding'
import type { DeriveStatus, DogWithStatus } from '@/types/dog'
import {
  buildBreedingStatusMap,
} from '@/localdb/domain-services/breedingStatus'
import {
  buildDetailBreedingStatuses,
} from '@/localdb/domain-services/breedingStatus'
import {
  buildDetailIllnessStatuses,
  buildDetailMedicationStatuses,
  buildListIllnessStatuses,
  buildListMedicationStatus,
  isMedicationTaskActive,
  sortDetailStatuses,
  sortListStatuses,
} from '@/localdb/domain-services/healthStatus'

function groupRowsByDogId(rows: Array<Record<string, any>> = []) {
  const grouped = new Map<string, any[]>()
  rows.forEach((row) => {
    const dogId = typeof row?.dog_id === 'string' ? row.dog_id : ''
    if (!dogId) return
    const bucket = grouped.get(dogId) || []
    bucket.push(row)
    grouped.set(dogId, bucket)
  })
  return grouped
}

function buildDogStatuses(
  dog: Record<string, any>,
  breedingStatusMap: Map<string, DeriveStatus[]>,
  illnessMap: Map<string, any[]>,
  medicationMap: Map<string, any[]>,
  now = Date.now(),
  options: { aggregateIllnesses?: boolean } = {},
) {
  const illnesses = illnessMap.get(dog._id) || []
  const medicationTasks = medicationMap.get(dog._id) || []
  const statuses = sortListStatuses([
    ...(options.aggregateIllnesses === false
      ? buildDetailIllnessStatuses(illnesses, medicationTasks)
      : buildListIllnessStatuses(illnesses, medicationTasks)),
    ...(breedingStatusMap.get(dog._id) || []),
    ...buildListMedicationStatus(medicationTasks, now, illnesses),
  ])

  return statuses.length > 0 ? statuses : [{ type: '正常' as const }]
}

export async function listLocalDogsWithStatus(familyId: string, filters: Record<string, any> = {}): Promise<DogWithStatus[]> {
  if (!familyId) return []
  const now = Date.now()
  const allowedDispositions = ['在养', '待售', '已预定', '自留']
  const dogDispositions = Array.isArray(filters.dispositions)
    ? filters.dispositions.filter(Boolean)
    : filters.disposition
      ? [filters.disposition]
      : null
  const dogDispositionSet = dogDispositions?.length ? new Set(dogDispositions) : null

  const [dogs, cycles, illnesses, medicationTasks, activeLitters] = await Promise.all([
    localDb.query<any>('dogs', (dog) => {
      if (dog.family_id !== familyId) return false
      if (dog.deleted_at) return false
      if (filters.gender && dog.gender !== filters.gender) return false
      if (filters.role && dog.role !== filters.role) return false
      if (dogDispositionSet) return dogDispositionSet.has(dog.disposition)
      return allowedDispositions.includes(dog.disposition)
    }),
    localDb.query<any>('breeding_cycles', cycle =>
      cycle.family_id === familyId
      && ['发情中', '怀孕中', '已生产'].includes(cycle.status),
    ),
    localDb.query<any>('health_records', record =>
      record.family_id === familyId
      && record.type === 'illness'
      && record?.details?.treatment_status !== '已康复',
    ),
    localDb.query<any>('medication_tasks', task =>
      task.family_id === familyId
      && isMedicationTaskActive(task, now),
    ),
    localDb.query<any>('litters', litter =>
      litter.family_id === familyId
      && !litter.weaned_at,
    ),
  ])
  const breedingStatusMap = buildBreedingStatusMap(cycles, activeLitters, now)
  const illnessMap = groupRowsByDogId(illnesses)
  const medicationMap = groupRowsByDogId(medicationTasks)

  return dogs.map((dog) => {
    return {
      ...dog,
      statuses: buildDogStatuses(dog, breedingStatusMap, illnessMap, medicationMap, now),
    }
  })
}

export async function getLocalDogDetail(familyId: string, dogId: string): Promise<DogWithStatus | null> {
  if (!familyId || !dogId) return null

  const now = Date.now()
  const [dog, cycles, illnesses, medicationTasks, activeLitters, breedingRecords] = await Promise.all([
    localDb.findById<DogWithStatus & { deleted_at?: number | null }>('dogs', dogId),
    localDb.query<any>('breeding_cycles', cycle =>
      cycle.family_id === familyId
      && cycle.dam_id === dogId
      && ['发情中', '怀孕中', '已生产'].includes(cycle.status),
    ),
    localDb.query<any>('health_records', record =>
      record.family_id === familyId
      && record.dog_id === dogId
      && record.type === 'illness'
      && record?.details?.treatment_status !== '已康复',
    ),
    localDb.query<any>('medication_tasks', task =>
      task.family_id === familyId
      && task.dog_id === dogId
      && isMedicationTaskActive(task, now),
    ),
    localDb.query<any>('litters', litter =>
      litter.family_id === familyId
      && litter.dam_id === dogId
      && !litter.weaned_at,
    ),
    localDb.query<BreedingRecord & { deleted_at?: number | null }>('breeding_records', record =>
      record.family_id === familyId
      && record.dog_id === dogId
      && ['follicle_check', 'mating'].includes(record.type)
      && !record.deleted_at,
    ),
  ])

  if (!dog || dog.family_id !== familyId || dog.deleted_at) return null

  const illnessMap = groupRowsByDogId(illnesses)
  const medicationMap = groupRowsByDogId(medicationTasks)
  const statuses = sortDetailStatuses([
    ...buildDetailIllnessStatuses(illnessMap.get(dogId) || [], medicationMap.get(dogId) || []),
    ...buildDetailMedicationStatuses(medicationMap.get(dogId) || [], now, illnessMap.get(dogId) || []),
    ...buildDetailBreedingStatuses(cycles, activeLitters, breedingRecords, now),
  ])

  return {
    ...dog,
    statuses: statuses.length > 0 ? statuses : [{ type: '正常' as const }],
  }
}

export async function listLocalDogWeights(familyId: string, dogId: string) {
  if (!familyId || !dogId) return []
  const weights = await localDb.query<any>('dog_weights', row =>
    row.family_id === familyId
    && row.dog_id === dogId,
  )
  return weights
    .map(item => ({
      ...item,
      date: Number(item.date || item.measured_at || item.created_at || 0),
    }))
    .sort((left, right) => {
      if (right.date !== left.date) return right.date - left.date
      return Number(right.created_at || 0) - Number(left.created_at || 0)
    })
}
