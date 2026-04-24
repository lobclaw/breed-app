export type AddRecordKind = 'breeding' | 'health' | 'medication'

import {
  BREEDING_RECORD_ITEMS,
  HEALTH_RECORD_ITEMS,
  MEDICATION_RECORD_ITEMS,
} from '@/utils/iconRegistry'
import type { CycleStatus } from '@/types/breeding'
import type { DeriveStatus, DogGender, DogRole } from '@/types/dog'

export type AddRecordItem = {
  icon: string
  iconBg: string
  color: string
  label: string
  desc: string
  page: string
  url?: string
  kind: AddRecordKind
  layout?: 'default' | 'full'
}

export type AddRecordGroup = {
  key: string
  title: string
  hint?: string
  items: AddRecordItem[]
}

type DogDetailBreedingStatus = Extract<DeriveStatus['type'], '发情中' | '怀孕中' | '哺乳中'>

type CreateDogDetailAddRecordGroupsOptions = {
  role?: DogRole | string | null
  gender?: DogGender | string | null
  allowBreeding?: boolean
  activeCycleStatus?: CycleStatus | string | null
  statuses?: DeriveStatus[]
  includeBreedingHint?: boolean
}

const breedingItems: AddRecordItem[] = BREEDING_RECORD_ITEMS.map(item => ({
  icon: item.icon,
  iconBg: item.iconBg,
  color: item.iconColor,
  label: item.label,
  desc: item.desc || '',
  page: item.page || '',
  url: item.url,
  kind: item.kind as AddRecordKind,
  layout: item.layout,
}))

const healthItems: AddRecordItem[] = HEALTH_RECORD_ITEMS
  .filter(item => item.kind === 'health')
  .map(item => ({
    icon: item.icon,
    iconBg: item.iconBg,
    color: item.iconColor,
    label: item.label,
    desc: item.desc || '',
    page: item.page || '',
    url: item.url,
    kind: 'health',
    layout: item.layout,
  }))

const medicationItems: AddRecordItem[] = MEDICATION_RECORD_ITEMS.map(item => ({
  icon: item.icon,
  iconBg: item.iconBg,
  color: item.iconColor,
  label: item.label,
  desc: item.desc || '',
  page: item.page || '',
  url: item.url,
  kind: 'medication',
  layout: item.layout,
}))

function getActiveCycleBreedingPages(status: string | null | undefined, options: { includeBirth?: boolean } = {}) {
  if (status === '发情中') {
    return ['heat-observation', 'breeding-follicle', 'breeding-mating', 'breeding-termination']
  }

  if (status === '怀孕中') {
    return [
      'breeding-pregnancy',
      'breeding-prenatal',
      'breeding-prelabor',
      ...(options.includeBirth ? ['birth-wizard'] : []),
      'breeding-termination',
    ]
  }

  return []
}

export function createAllAddRecordGroups({
  includeBreedingHint = false,
  allowBreeding = true,
} = {}): AddRecordGroup[] {
  const groups: AddRecordGroup[] = []

  if (allowBreeding) {
    groups.push({
      key: 'breeding',
      title: '繁育',
      hint: includeBreedingHint ? '将自动带入当前周期' : '',
      items: breedingItems,
    })
  }

  groups.push(
    {
      key: 'health',
      title: '健康',
      items: healthItems,
    },
    {
      key: 'medication',
      title: '用药',
      items: medicationItems,
    },
  )

  return groups
}

function resolveDogDetailBreedingStatus({
  activeCycleStatus,
  statuses = [],
}: Pick<CreateDogDetailAddRecordGroupsOptions, 'activeCycleStatus' | 'statuses'>): DogDetailBreedingStatus | '' {
  if (activeCycleStatus === '发情中' || activeCycleStatus === '怀孕中') {
    return activeCycleStatus
  }

  const breedingStatuses = Array.isArray(statuses)
    ? statuses.map(status => status?.type).filter(Boolean)
    : []

  if (breedingStatuses.includes('怀孕中')) return '怀孕中'
  if (breedingStatuses.includes('哺乳中')) return '哺乳中'
  if (breedingStatuses.includes('发情中')) return '发情中'
  return ''
}

function getDogDetailBreedingPages(status: DogDetailBreedingStatus | '') {
  if (status === '哺乳中') {
    return []
  }

  return status ? getActiveCycleBreedingPages(status, { includeBirth: true }) : ['breeding-heat']
}

export function createDogDetailAddRecordGroups({
  role,
  gender,
  allowBreeding: allowBreedingInput,
  activeCycleStatus,
  statuses = [],
  includeBreedingHint = false,
}: CreateDogDetailAddRecordGroupsOptions): AddRecordGroup[] {
  const groups: AddRecordGroup[] = []
  const allowBreeding = (allowBreedingInput ?? true) && role === '种狗' && gender === '母'

  if (allowBreeding) {
    const breedingStatus = resolveDogDetailBreedingStatus({ activeCycleStatus, statuses })
    const breedingPages = getDogDetailBreedingPages(breedingStatus)
    const filteredBreedingItems = breedingItems.filter(item => breedingPages.includes(item.page))

    if (filteredBreedingItems.length > 0) {
      groups.push({
        key: 'breeding',
        title: '繁育',
        hint: includeBreedingHint && breedingStatus !== '' ? '将自动带入当前周期' : '',
        items: filteredBreedingItems,
      })
    }
  }

  groups.push(
    {
      key: 'health',
      title: '健康',
      items: healthItems,
    },
    {
      key: 'medication',
      title: '用药',
      items: medicationItems,
    },
  )

  return groups
}

export function createCycleBreedingAddRecordGroups(status?: string): AddRecordGroup[] {
  const allowedPages = getActiveCycleBreedingPages(status)
  const items = breedingItems.filter(item => allowedPages.includes(item.page))

  if (items.length === 0) return []

  return [
    {
      key: 'breeding',
      title: '繁育',
      hint: '将自动带入当前周期',
      items,
    },
  ]
}
