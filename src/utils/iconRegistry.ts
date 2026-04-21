import type { DogRole } from '@/types/dog'

export type IconTone = 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal'
export type UnifiedRecordKind = 'breeding' | 'health' | 'medication' | 'finance'
export type DogEntityKind = 'dog' | 'litter'

export interface UnifiedRecordItem {
  icon: string
  iconBg: string
  iconColor: string
  label: string
  url: string
  desc?: string
  page?: string
  kind: UnifiedRecordKind
  layout?: 'default' | 'full'
}

export interface QuickActionMeta {
  materialIcon: string
  iconColor: IconTone
  label: string
  url: string
}

export interface RecordCatalogGroup {
  label: string
  color: IconTone
  items: UnifiedRecordItem[]
}

export function getDogEntityIcon(options: { role?: string | null; kind?: DogEntityKind } = {}) {
  if (options.kind === 'litter') return 'child_friendly'
  if (options.role === '幼崽') return 'child_friendly'
  return 'pets'
}

export function getDogEntityTone(role?: string | null): IconTone {
  if (role === '幼崽') return 'amber'
  if (role === '外部种公') return 'blue'
  return 'green'
}

export const BREEDING_RECORD_ITEMS: UnifiedRecordItem[] = [
  { icon: 'whatshot', iconBg: 'var(--icon-rose)', iconColor: 'var(--rose)', label: '发情记录', desc: '记录发情开始', page: 'breeding-heat', url: '/pages/record/breeding-heat', kind: 'breeding' },
  { icon: 'monitor_heart', iconBg: 'var(--icon-amber)', iconColor: 'var(--amber)', label: '发情观察', desc: '补充观察日志', page: 'heat-observation', url: '/pages/record/heat-observation', kind: 'breeding' },
  { icon: 'biotech', iconBg: 'var(--icon-teal)', iconColor: 'var(--teal)', label: '卵泡检查', desc: '记录发育情况', page: 'breeding-follicle', url: '/pages/record/breeding-follicle', kind: 'breeding' },
  { icon: 'favorite', iconBg: 'var(--icon-rose)', iconColor: 'var(--rose)', label: '配种记录', desc: '进入配种节点', page: 'breeding-mating', url: '/pages/record/breeding-mating', kind: 'breeding' },
  { icon: 'pregnant_woman', iconBg: 'var(--icon-green)', iconColor: 'var(--green)', label: '孕检记录', desc: '确认怀孕结果', page: 'breeding-pregnancy', url: '/pages/record/breeding-pregnancy', kind: 'breeding' },
  { icon: 'medical_services', iconBg: 'var(--icon-blue)', iconColor: 'var(--blue)', label: '产检记录', desc: '补录产检结果', page: 'breeding-prenatal', url: '/pages/record/breeding-prenatal', kind: 'breeding' },
  { icon: 'schedule', iconBg: 'var(--icon-amber)', iconColor: 'var(--amber)', label: '临产监测', desc: '观察临产信号', page: 'breeding-prelabor', url: '/pages/record/breeding-prelabor', kind: 'breeding' },
  { icon: 'child_friendly', iconBg: 'var(--icon-rose)', iconColor: 'var(--rose)', label: '生产记录', desc: '记录分娩结果', page: 'birth-wizard', url: '/pages/breeding/birth-wizard', kind: 'breeding' },
  { icon: 'warning', iconBg: 'var(--icon-red)', iconColor: 'var(--red)', label: '异常终止', desc: '记录终止结果', page: 'breeding-termination', url: '/pages/record/breeding-termination', kind: 'breeding' },
]

export const HEALTH_RECORD_ITEMS: UnifiedRecordItem[] = [
  { icon: 'vaccines', iconBg: 'var(--icon-blue)', iconColor: 'var(--blue)', label: '疫苗记录', desc: '接种与提醒', page: 'health-vaccination', url: '/pages/record/health-vaccination', kind: 'health' },
  { icon: 'shield', iconBg: 'var(--icon-teal)', iconColor: 'var(--teal)', label: '驱虫记录', desc: '内驱外驱补录', page: 'health-deworming', url: '/pages/record/health-deworming', kind: 'health' },
  { icon: 'sick', iconBg: 'var(--icon-red)', iconColor: 'var(--red)', label: '疾病记录', desc: '症状与治疗状态', page: 'health-illness', url: '/pages/record/health-illness', kind: 'health' },
  { icon: 'medication', iconBg: 'var(--icon-plum)', iconColor: 'var(--plum)', label: '用药', desc: '创建连续用药任务', page: 'health-medication', url: '/pages/record/health-medication', kind: 'medication', layout: 'full' },
  { icon: 'monitor_weight', iconBg: 'var(--icon-teal)', iconColor: 'var(--teal)', label: '体重', desc: '记录体重变化', page: 'batch-weight', url: '/pages/health/batch-weight', kind: 'health' },
]

export const MEDICATION_RECORD_ITEMS: UnifiedRecordItem[] = [
  { icon: 'medication', iconBg: 'var(--icon-plum)', iconColor: 'var(--plum)', label: '开始用药', desc: '创建连续用药任务', page: 'health-medication', url: '/pages/record/health-medication', kind: 'medication', layout: 'full' },
]

export const FINANCE_RECORD_ITEMS: UnifiedRecordItem[] = [
  { icon: 'payments', iconBg: 'var(--icon-green)', iconColor: 'var(--green)', label: '支出', url: '/pages/finance/expense-add', kind: 'finance' },
  { icon: 'account_balance', iconBg: 'var(--icon-red)', iconColor: 'var(--red)', label: '收入', url: '/pages/finance/expense-add?type=income', kind: 'finance' },
]

export function getRecordCatalogGroups(): RecordCatalogGroup[] {
  return [
    { label: '繁育记录', color: 'rose', items: BREEDING_RECORD_ITEMS.filter(item => item.page !== 'heat-observation').map(toCatalogItem) },
    { label: '健康记录', color: 'green', items: HEALTH_RECORD_ITEMS.map(toCatalogItem) },
    { label: '财务记录', color: 'amber', items: FINANCE_RECORD_ITEMS },
  ]
}

export function getQuickActionButtons(): QuickActionMeta[] {
  return [
    { materialIcon: 'payments', iconColor: 'green', label: '记账', url: '/pages/finance/expense-add' },
    { materialIcon: 'vaccines', iconColor: 'blue', label: '疫苗', url: '/pages/record/health-vaccination' },
    { materialIcon: 'shield', iconColor: 'teal', label: '驱虫', url: '/pages/record/health-deworming' },
    { materialIcon: 'monitor_weight', iconColor: 'teal', label: '体重', url: '/pages/health/batch-weight' },
  ]
}

export function getTaskActionMeta(): Record<string, QuickActionMeta> {
  return {
    expense: { materialIcon: 'payments', iconColor: 'green', label: '支出录入', url: '/pages/finance/expense-add' },
    income: { materialIcon: 'account_balance', iconColor: 'red', label: '收入录入', url: '/pages/finance/expense-add?type=income' },
    vaccination: { materialIcon: 'vaccines', iconColor: 'blue', label: '疫苗记录', url: '/pages/record/health-vaccination' },
    deworming: { materialIcon: 'shield', iconColor: 'teal', label: '驱虫记录', url: '/pages/record/health-deworming' },
    illness: { materialIcon: 'sick', iconColor: 'red', label: '疾病记录', url: '/pages/record/health-illness' },
    heat: { materialIcon: 'whatshot', iconColor: 'rose', label: '发情记录', url: '/pages/record/breeding-heat' },
    mating: { materialIcon: 'favorite', iconColor: 'rose', label: '配种记录', url: '/pages/record/breeding-mating' },
    weight: { materialIcon: 'monitor_weight', iconColor: 'teal', label: '体重记录', url: '/pages/health/batch-weight' },
  }
}

export function getDogRoleLabel(role?: DogRole | string | null) {
  if (role === '外部种公') return '外部种公'
  if (role === '幼崽') return '幼崽'
  return '种狗'
}

function toCatalogItem(item: UnifiedRecordItem): UnifiedRecordItem {
  return {
    ...item,
    label: item.label.replace(/记录$/, ''),
  }
}
