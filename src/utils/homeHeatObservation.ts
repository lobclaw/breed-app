import { getBeijingDayDiff } from '@/utils/date'

interface HomeBreedingCardLike {
  dogId?: string
  dogName?: string
  tasks?: Array<{
    _id?: string
    type?: string
    cycle_id?: string
    due_date?: number
    details?: Record<string, any> | null
  }>
}

function encodeQueryValue(value: string) {
  return encodeURIComponent(value)
}

function getBirthMilestoneDueDate(task: NonNullable<HomeBreedingCardLike['tasks']>[number] | undefined): number | null {
  const expectedDueDate = task?.details?.expected_due_date
  if (typeof expectedDueDate === 'number' && Number.isFinite(expectedDueDate)) return expectedDueDate
  return typeof task?.due_date === 'number' && Number.isFinite(task.due_date) ? task.due_date : null
}

function buildLockedCycleUrl(baseUrl: string, card: HomeBreedingCardLike): string {
  const task = card?.tasks?.[0]
  const params: string[] = []

  if (card.dogId) params.push(`dogId=${encodeQueryValue(card.dogId)}`)
  if (card.dogName) params.push(`dogName=${encodeQueryValue(card.dogName)}`)
  if (task?.cycle_id) params.push(`cycleId=${encodeQueryValue(task.cycle_id)}`)
  params.push('locked=true')

  return `${baseUrl}?${params.join('&')}`
}

export function canOpenHomeHeatObservation(card: HomeBreedingCardLike | null | undefined): boolean {
  const task = card?.tasks?.[0]
  return Boolean(
    card?.dogId
    && task?.type === 'breeding_milestone'
    && task?.details?.step_type === 'follicle_check'
    && task?.cycle_id,
  )
}

export function canOpenHomeDirectMating(card: HomeBreedingCardLike | null | undefined): boolean {
  const task = card?.tasks?.[0]
  return Boolean(
    card?.dogId
    && task?._id
    && task?.type === 'breeding_milestone'
    && task?.details?.step_type === 'follicle_check'
    && task?.cycle_id,
  )
}

export function buildHomeHeatObservationUrl(card: HomeBreedingCardLike): string {
  return buildLockedCycleUrl('/pages/record/heat-observation', card)
}

export function buildHomeDirectMatingUrl(card: HomeBreedingCardLike): string {
  const task = card?.tasks?.[0]
  const params: string[] = []

  if (card.dogId) params.push(`dogId=${encodeQueryValue(card.dogId)}`)
  if (card.dogName) params.push(`dogName=${encodeQueryValue(card.dogName)}`)
  if (task?._id) params.push(`taskId=${encodeQueryValue(task._id)}`)
  if (task?.cycle_id) params.push(`cycleId=${encodeQueryValue(task.cycle_id)}`)
  params.push('locked=true')

  return `/pages/record/breeding-mating?${params.join('&')}`
}

export function canOpenHomeContinueMating(card: HomeBreedingCardLike | null | undefined): boolean {
  const task = card?.tasks?.[0]
  return Boolean(
    card?.dogId
    && task?.type === 'breeding_milestone'
    && task?.details?.step_type === 'pregnancy_check'
    && task?.cycle_id,
  )
}

export function buildHomeContinueMatingUrl(card: HomeBreedingCardLike): string {
  return buildLockedCycleUrl('/pages/record/breeding-mating', card)
}

export function canOpenHomePrenatal(card: HomeBreedingCardLike | null | undefined): boolean {
  const task = card?.tasks?.[0]
  return Boolean(
    card?.dogId
    && task?.type === 'breeding_milestone'
    && task?.details?.step_type === 'birth'
    && task?.cycle_id,
  )
}

export function buildHomePrenatalUrl(card: HomeBreedingCardLike): string {
  return buildLockedCycleUrl('/pages/record/breeding-prenatal', card)
}

export function canOpenHomePreLabor(card: HomeBreedingCardLike | null | undefined, now = Date.now()): boolean {
  const task = card?.tasks?.[0]
  if (!card?.dogId || task?.type !== 'breeding_milestone' || task?.details?.step_type !== 'birth' || !task?.cycle_id) {
    return false
  }

  const dueDate = getBirthMilestoneDueDate(task)
  if (!dueDate) return false

  const diffDays = getBeijingDayDiff(dueDate, now)
  return diffDays <= 5
}

export function buildHomePreLaborUrl(card: HomeBreedingCardLike): string {
  return buildLockedCycleUrl('/pages/record/breeding-prelabor', card)
}
