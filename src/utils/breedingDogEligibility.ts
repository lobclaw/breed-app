import type { BreedingRecordType } from '@/types/breeding'
import type { DeriveStatus, DogWithStatus } from '@/types/dog'

type PickerCopy = {
  title: string
  description: string
}

const BREEDING_STATUS_TYPES = new Set<DeriveStatus['type']>(['发情中', '怀孕中', '哺乳中'])
const BLOCKED_HEAT_STATUSES = new Set<DeriveStatus['type']>(['发情中', '怀孕中', '哺乳中'])

function isBreedingDam(dog: DogWithStatus) {
  return dog.role === '种狗' && dog.gender === '母'
}

function getStatusCycleId(status: DeriveStatus | Record<string, any>) {
  const legacyCycleId = (status as Record<string, any>)?.cycle_id
  return typeof status?.cycleId === 'string'
    ? status.cycleId
    : typeof legacyCycleId === 'string'
      ? legacyCycleId
      : ''
}

function getBreedingStatuses(dog: DogWithStatus) {
  return (Array.isArray(dog.statuses) ? dog.statuses : []).filter(status => BREEDING_STATUS_TYPES.has(status.type))
}

function hasBlockedBreedingStatus(dog: DogWithStatus, blockedStatuses: Set<DeriveStatus['type']>) {
  return getBreedingStatuses(dog).some(status => blockedStatuses.has(status.type))
}

function hasQualifiedCycleStatus(dog: DogWithStatus, allowedStatuses: DeriveStatus['type'][]) {
  return getBreedingStatuses(dog).some(status => allowedStatuses.includes(status.type) && !!getStatusCycleId(status))
}

export function getBirthCycleIdFromDog(dog: DogWithStatus | Record<string, any> | null | undefined) {
  const rawStatuses = dog?.statuses
  const statuses = Array.isArray(rawStatuses) ? rawStatuses : []
  const pregnantStatus = statuses.find(status => status?.type === '怀孕中' && !!getStatusCycleId(status))
  return pregnantStatus ? getStatusCycleId(pregnantStatus) : ''
}

export function isEligibleBreedingDog(dog: DogWithStatus, type: BreedingRecordType) {
  if (!isBreedingDam(dog)) return false

  if (type === 'heat') {
    return !hasBlockedBreedingStatus(dog, BLOCKED_HEAT_STATUSES)
  }

  if (type === 'heat_observation') {
    return hasQualifiedCycleStatus(dog, ['发情中'])
  }

  if (type === 'follicle_check') {
    return !hasBlockedBreedingStatus(dog, BLOCKED_HEAT_STATUSES)
  }

  if (type === 'mating') {
    return !hasBlockedBreedingStatus(dog, BLOCKED_HEAT_STATUSES)
  }

  if (type === 'pregnancy_check' || type === 'prenatal_check' || type === 'pre_labor' || type === 'birth') {
    return hasQualifiedCycleStatus(dog, ['怀孕中'])
  }

  if (type === 'abnormal_termination') {
    return hasQualifiedCycleStatus(dog, ['发情中', '怀孕中'])
  }

  return false
}

export function getEligibleBreedingDogs(dogs: DogWithStatus[], type: BreedingRecordType) {
  return (dogs || []).filter(dog => isEligibleBreedingDog(dog, type))
}

export function getBreedingDogPickerEmptyState(
  type: BreedingRecordType,
  allDogs: DogWithStatus[],
  eligibleDogs: DogWithStatus[],
): PickerCopy {
  const dams = (allDogs || []).filter(isBreedingDam)

  if (type === 'heat') {
    if (dams.length > 0 && eligibleDogs.length === 0) {
      return {
        title: '暂无可录入的种母',
        description: '发情中、怀孕中、哺乳中的犬只已自动隐藏',
      }
    }
    return {
      title: '暂无可录入的种母',
      description: '没有符合条件的种母',
    }
  }

  if (type === 'heat_observation') {
    return {
      title: '暂无发情中种母',
      description: '只有带当前发情周期的种母才会显示在这里',
    }
  }

  if (type === 'follicle_check') {
    return {
      title: '暂无可检查的种母',
      description: '发情中、怀孕中、哺乳中的犬只已自动隐藏',
    }
  }

  if (type === 'mating') {
    return {
      title: '暂无可配种的种母',
      description: '发情中、怀孕中、哺乳中的犬只已自动隐藏',
    }
  }

  if (type === 'pregnancy_check') {
    return {
      title: '暂无可录入孕检的种母',
      description: '只有怀孕中的当前周期犬只才会显示在这里',
    }
  }

  if (type === 'prenatal_check') {
    return {
      title: '暂无可录入产检的种母',
      description: '只有怀孕中的当前周期犬只才会显示在这里',
    }
  }

  if (type === 'pre_labor') {
    return {
      title: '暂无可录入临产监测的种母',
      description: '只有怀孕中的当前周期犬只才会显示在这里',
    }
  }

  if (type === 'birth') {
    return {
      title: '暂无可记录生产的种母',
      description: '只有怀孕中的当前周期犬只才会显示在这里',
    }
  }

  if (type === 'abnormal_termination') {
    return {
      title: '暂无可终止的繁育周期',
      description: '只有发情中或怀孕中的当前周期犬只才会显示在这里',
    }
  }

  return {
    title: '暂无犬只',
    description: '没有符合条件的犬只',
  }
}
