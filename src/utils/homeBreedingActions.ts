import {
  buildHomeContinueMatingUrl,
  buildHomeDirectMatingUrl,
  buildHomeHeatObservationUrl,
  buildHomePreLaborUrl,
  buildHomePrenatalUrl,
  canOpenHomeContinueMating,
  canOpenHomeDirectMating,
  canOpenHomeHeatObservation,
  canOpenHomePreLabor,
  canOpenHomePrenatal,
} from '@/utils/homeHeatObservation'
import { BREEDING_RECORD_ITEMS } from '@/utils/iconRegistry'

export type HomeBreedingActionKey =
  | 'process'
  | 'observe'
  | 'direct_mating'
  | 'continue_mating'
  | 'prenatal'
  | 'pre_labor'

export interface HomeBreedingCardLike {
  dogId?: string
  dogName?: string
  tasks?: Array<{
    _id?: string
    type?: string
    cycle_id?: string
    litter_id?: string
    details?: Record<string, any> | null
  }>
}

export interface HomeBreedingActionItem {
  key: HomeBreedingActionKey
  label: string
  description: string
  icon: string
  iconBg: string
  iconColor: string
  tone: 'primary' | 'amber' | 'rose' | 'blue' | 'green'
}

const breedingRecordMetaMap = new Map(
  BREEDING_RECORD_ITEMS.map(item => [item.page, item]),
)

function getBreedingIconMeta(page: string, fallback: { icon: string; iconBg: string; iconColor: string }) {
  const meta = breedingRecordMetaMap.get(page)
  if (!meta) return fallback
  return {
    icon: meta.icon,
    iconBg: meta.iconBg,
    iconColor: meta.iconColor,
  }
}

function encodeQueryValue(value: string) {
  return encodeURIComponent(value)
}

function getTask(card: HomeBreedingCardLike | null | undefined) {
  return card?.tasks?.[0]
}

function getStepType(card: HomeBreedingCardLike | null | undefined) {
  return getTask(card)?.details?.step_type || ''
}

export function getHomeBreedingPrimaryAction(card: HomeBreedingCardLike | null | undefined): HomeBreedingActionItem | null {
  const task = getTask(card)
  if (!task) return null

  const stepType = getStepType(card)
  if (stepType === 'follicle_check') {
    const iconMeta = getBreedingIconMeta('breeding-follicle', {
      icon: 'biotech',
      iconBg: 'var(--icon-teal)',
      iconColor: 'var(--teal)',
    })
    return {
      key: 'process',
      label: '记录卵泡检查',
      description: '录入检查结果，继续判断最佳配种时机',
      ...iconMeta,
      tone: 'primary',
    }
  }
  if (stepType === 'pregnancy_check') {
    const iconMeta = getBreedingIconMeta('breeding-pregnancy', {
      icon: 'pregnant_woman',
      iconBg: 'var(--icon-green)',
      iconColor: 'var(--green)',
    })
    return {
      key: 'process',
      label: '记录孕检结果',
      description: '确认是否受孕，并承接后续待产流程',
      ...iconMeta,
      tone: 'primary',
    }
  }
  if (stepType === 'birth') {
    const iconMeta = getBreedingIconMeta('birth-wizard', {
      icon: 'child_friendly',
      iconBg: 'var(--icon-rose)',
      iconColor: 'var(--rose)',
    })
    return {
      key: 'process',
      label: '录入生产记录',
      description: '登记生产结果和幼崽信息',
      ...iconMeta,
      tone: 'primary',
    }
  }
  if (stepType === 'weaning_confirm') {
    return {
      key: 'process',
      label: '确认本窝断奶',
      description: '完成哺乳阶段并收口当前窝次',
      icon: 'pets',
      iconBg: 'var(--icon-green)',
      iconColor: 'var(--green)',
      tone: 'green',
    }
  }
  if (stepType === 'mating') {
    const iconMeta = getBreedingIconMeta('breeding-mating', {
      icon: 'favorite',
      iconBg: 'var(--icon-rose)',
      iconColor: 'var(--rose)',
    })
    return {
      key: 'process',
      label: '记录本次配种',
      description: '录入配种结果，继续推进本轮繁育',
      ...iconMeta,
      tone: 'primary',
    }
  }
  if (stepType === 'heat') {
    const iconMeta = getBreedingIconMeta('breeding-heat', {
      icon: 'whatshot',
      iconBg: 'var(--icon-rose)',
      iconColor: 'var(--rose)',
    })
    return {
      key: 'process',
      label: '记录发情开始',
      description: '补齐本轮发情起点，生成后续流程依据',
      ...iconMeta,
      tone: 'primary',
    }
  }

  return {
    key: 'process',
    label: '处理当前流程',
    description: '进入当前阶段表单并继续推进',
    icon: 'arrow_forward',
    iconBg: 'var(--icon-amber)',
    iconColor: 'var(--amber)',
    tone: 'primary',
  }
}

export function getHomeBreedingActionItems(card: HomeBreedingCardLike | null | undefined): HomeBreedingActionItem[] {
  const items: HomeBreedingActionItem[] = []
  const primaryAction = getHomeBreedingPrimaryAction(card)
  if (primaryAction) items.push(primaryAction)

  if (canOpenHomeHeatObservation(card)) {
    const iconMeta = getBreedingIconMeta('heat-observation', {
      icon: 'monitor_heart',
      iconBg: 'var(--icon-amber)',
      iconColor: 'var(--amber)',
    })
    items.push({
      key: 'observe',
      label: '补充发情观察',
      description: '记录出血、站立等观察情况',
      ...iconMeta,
      tone: 'amber',
    })
  }
  if (canOpenHomeDirectMating(card)) {
    const iconMeta = getBreedingIconMeta('breeding-mating', {
      icon: 'favorite',
      iconBg: 'var(--icon-rose)',
      iconColor: 'var(--rose)',
    })
    items.push({
      key: 'direct_mating',
      label: '直接进入配种',
      description: '跳过卵泡检查，直接记录本次配种',
      ...iconMeta,
      tone: 'rose',
    })
  }
  if (canOpenHomeContinueMating(card)) {
    const iconMeta = getBreedingIconMeta('breeding-mating', {
      icon: 'favorite',
      iconBg: 'var(--icon-rose)',
      iconColor: 'var(--rose)',
    })
    items.push({
      key: 'continue_mating',
      label: '补记继续配种',
      description: '继续记录本轮后续配种安排',
      ...iconMeta,
      tone: 'rose',
    })
  }
  if (canOpenHomePrenatal(card)) {
    const iconMeta = getBreedingIconMeta('breeding-prenatal', {
      icon: 'medical_services',
      iconBg: 'var(--icon-blue)',
      iconColor: 'var(--blue)',
    })
    items.push({
      key: 'prenatal',
      label: '记录产前检查',
      description: '补充待产前的检查结果',
      ...iconMeta,
      tone: 'blue',
    })
  }
  if (canOpenHomePreLabor(card)) {
    const iconMeta = getBreedingIconMeta('breeding-prelabor', {
      icon: 'schedule',
      iconBg: 'var(--icon-amber)',
      iconColor: 'var(--amber)',
    })
    items.push({
      key: 'pre_labor',
      label: '进入临产监测',
      description: '记录宫缩、体温等临产信号',
      ...iconMeta,
      tone: 'amber',
    })
  }

  return items
}

export function hasMultipleHomeBreedingActions(card: HomeBreedingCardLike | null | undefined) {
  return getHomeBreedingActionItems(card).length > 1
}

export function openHomeBreedingDetail(card: HomeBreedingCardLike | null | undefined) {
  const task = getTask(card)
  if (!task) return

  if (task.cycle_id) {
    uni.navigateTo({ url: `/pages/breeding/cycle?id=${encodeQueryValue(task.cycle_id)}` })
    return
  }

  if (getStepType(card) === 'weaning_confirm' && task.litter_id) {
    const params = [`id=${encodeQueryValue(task.litter_id)}`]
    if (task._id) params.push(`taskId=${encodeQueryValue(task._id)}`)
    uni.navigateTo({ url: `/pages/breeding/litter?${params.join('&')}` })
    return
  }

  if (card?.dogId) {
    uni.navigateTo({ url: `/pages/dog/detail?id=${encodeQueryValue(card.dogId)}` })
  }
}

export function buildHomeBreedingProcessUrl(card: HomeBreedingCardLike | null | undefined) {
  const task = getTask(card)
  if (!task) return ''

  const params: string[] = []
  if (card?.dogId) params.push(`dogId=${encodeQueryValue(card.dogId)}`)
  if (card?.dogName) params.push(`dogName=${encodeQueryValue(card.dogName)}`)
  if (task._id) params.push(`taskId=${encodeQueryValue(task._id)}`)
  if (task.cycle_id) params.push(`cycleId=${encodeQueryValue(task.cycle_id)}`)

  if (task.type === 'breeding_milestone') {
    params.push('locked=true')
    const stepType = getStepType(card)
    if (stepType === 'follicle_check') return `/pages/record/breeding-follicle?${params.join('&')}`
    if (stepType === 'mating') return `/pages/record/breeding-mating?${params.join('&')}`
    if (stepType === 'pregnancy_check') return `/pages/record/breeding-pregnancy?${params.join('&')}`
    if (stepType === 'birth') {
      const birthParams: string[] = []
      if (task.cycle_id) birthParams.push(`cycleId=${encodeQueryValue(task.cycle_id)}`)
      if (card?.dogName) birthParams.push(`damName=${encodeQueryValue(card.dogName)}`)
      return `/pages/breeding/birth-wizard?${birthParams.join('&')}`
    }
    if (stepType === 'weaning_confirm' && task.litter_id) {
      const litterParams = [`id=${encodeQueryValue(task.litter_id)}`]
      if (task._id) litterParams.push(`taskId=${encodeQueryValue(task._id)}`)
      return `/pages/breeding/litter?${litterParams.join('&')}`
    }
    return `/pages/record/breeding-heat?${params.join('&')}`
  }

  return ''
}

export function openHomeBreedingAction(card: HomeBreedingCardLike | null | undefined, actionKey: HomeBreedingActionKey) {
  if (!card) return

  if (actionKey === 'process') {
    const processUrl = buildHomeBreedingProcessUrl(card)
    if (processUrl) uni.navigateTo({ url: processUrl })
    return
  }

  if (actionKey === 'observe' && canOpenHomeHeatObservation(card)) {
    uni.navigateTo({ url: buildHomeHeatObservationUrl(card) })
    return
  }

  if (actionKey === 'direct_mating' && canOpenHomeDirectMating(card)) {
    uni.navigateTo({ url: buildHomeDirectMatingUrl(card) })
    return
  }

  if (actionKey === 'continue_mating' && canOpenHomeContinueMating(card)) {
    uni.navigateTo({ url: buildHomeContinueMatingUrl(card) })
    return
  }

  if (actionKey === 'prenatal' && canOpenHomePrenatal(card)) {
    uni.navigateTo({ url: buildHomePrenatalUrl(card) })
    return
  }

  if (actionKey === 'pre_labor' && canOpenHomePreLabor(card)) {
    uni.navigateTo({ url: buildHomePreLaborUrl(card) })
  }
}
