export type AddRecordKind = 'breeding' | 'health' | 'medication'

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

const breedingItems: AddRecordItem[] = [
  { icon: 'whatshot', iconBg: 'var(--icon-rose)', color: 'var(--rose)', label: '发情记录', desc: '记录发情开始', page: 'breeding-heat', kind: 'breeding' },
  { icon: 'monitor_heart', iconBg: 'var(--icon-amber)', color: 'var(--amber)', label: '发情观察', desc: '补充观察日志', page: 'heat-observation', kind: 'breeding' },
  { icon: 'biotech', iconBg: 'var(--icon-teal)', color: 'var(--teal)', label: '卵泡检查', desc: '记录发育情况', page: 'breeding-follicle', kind: 'breeding' },
  { icon: 'favorite', iconBg: 'var(--icon-rose)', color: 'var(--rose)', label: '配种记录', desc: '进入配种节点', page: 'breeding-mating', kind: 'breeding' },
  { icon: 'pregnant_woman', iconBg: 'var(--icon-green)', color: 'var(--green)', label: '孕检记录', desc: '确认怀孕结果', page: 'breeding-pregnancy', kind: 'breeding' },
  { icon: 'medical_services', iconBg: 'var(--icon-blue)', color: 'var(--blue)', label: '产检记录', desc: '补录产检结果', page: 'breeding-prenatal', kind: 'breeding' },
  { icon: 'schedule', iconBg: 'var(--icon-amber)', color: 'var(--amber)', label: '临产监测', desc: '观察临产信号', page: 'breeding-prelabor', kind: 'breeding' },
  { icon: 'child_friendly', iconBg: 'var(--icon-rose)', color: 'var(--rose)', label: '生产记录', desc: '记录分娩结果', page: 'birth-wizard', url: '/pages/breeding/birth-wizard', kind: 'breeding' },
  { icon: 'warning', iconBg: 'var(--icon-red)', color: 'var(--red)', label: '异常终止', desc: '记录终止结果', page: 'breeding-termination', kind: 'breeding' },
]

const healthItems: AddRecordItem[] = [
  { icon: 'vaccines', iconBg: 'var(--icon-blue)', color: 'var(--blue)', label: '疫苗记录', desc: '接种与提醒', page: 'health-vaccination', kind: 'health' },
  { icon: 'shield', iconBg: 'var(--icon-teal)', color: 'var(--teal)', label: '驱虫记录', desc: '内驱外驱补录', page: 'health-deworming', kind: 'health' },
  { icon: 'sick', iconBg: 'var(--icon-red)', color: 'var(--red)', label: '疾病记录', desc: '症状与治疗状态', page: 'health-illness', kind: 'health', layout: 'full' },
]

const medicationItems: AddRecordItem[] = [
  { icon: 'medication', iconBg: 'var(--icon-plum)', color: 'var(--plum)', label: '开始用药', desc: '创建连续用药任务', page: 'health-medication', kind: 'medication', layout: 'full' },
]

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
