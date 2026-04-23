import { buildTimestampFromDayOffset } from './date'

export const EXTRA_ARRANGEMENT_OPTIONS = [
  { value: 'contact_doctor', label: '联系医生' },
  { value: 'recheck_observe', label: '复测观察' },
  { value: 'preparation', label: '准备事项' },
  { value: 'other', label: '其他安排' },
] as const

export type ExtraArrangementKind = typeof EXTRA_ARRANGEMENT_OPTIONS[number]['value']

export function getExtraArrangementTitle(kind?: string | null) {
  const found = EXTRA_ARRANGEMENT_OPTIONS.find(option => option.value === kind)
  return found?.label || '其他安排'
}

export function getDefaultExtraArrangementDate() {
  return buildTimestampFromDayOffset(1)
}
