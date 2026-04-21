export type AddRecordKind = 'breeding' | 'health' | 'medication'

import {
  BREEDING_RECORD_ITEMS,
  HEALTH_RECORD_ITEMS,
  MEDICATION_RECORD_ITEMS,
} from '@/utils/iconRegistry'

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

export function createAllAddRecordGroups({ includeBreedingHint = false } = {}): AddRecordGroup[] {
  return [
    {
      key: 'breeding',
      title: '繁育',
      hint: includeBreedingHint ? '将自动带入当前周期' : '',
      items: breedingItems,
    },
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
  ]
}

export function createCycleBreedingAddRecordGroups(status?: string): AddRecordGroup[] {
  const allowedPages = status === '发情中'
    ? ['breeding-heat', 'heat-observation', 'breeding-follicle', 'breeding-mating', 'breeding-pregnancy', 'breeding-prenatal', 'breeding-prelabor', 'breeding-termination']
    : ['breeding-heat', 'breeding-follicle', 'breeding-mating', 'breeding-pregnancy', 'breeding-prenatal', 'breeding-prelabor', 'breeding-termination']

  return [
    {
      key: 'breeding',
      title: '繁育',
      hint: '将自动带入当前周期',
      items: breedingItems.filter(item => allowedPages.includes(item.page)),
    },
  ]
}
