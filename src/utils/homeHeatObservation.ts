interface HomeBreedingCardLike {
  dogId?: string
  dogName?: string
  tasks?: Array<{
    _id?: string
    type?: string
    cycle_id?: string
    details?: Record<string, any> | null
  }>
}

function encodeQueryValue(value: string) {
  return encodeURIComponent(value)
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
  const task = card?.tasks?.[0]
  const params: string[] = []

  if (card.dogId) params.push(`dogId=${encodeQueryValue(card.dogId)}`)
  if (card.dogName) params.push(`dogName=${encodeQueryValue(card.dogName)}`)
  if (task?.cycle_id) params.push(`cycleId=${encodeQueryValue(task.cycle_id)}`)
  params.push('locked=true')

  return `/pages/record/heat-observation?${params.join('&')}`
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
  const task = card?.tasks?.[0]
  const params: string[] = []

  if (card.dogId) params.push(`dogId=${encodeQueryValue(card.dogId)}`)
  if (card.dogName) params.push(`dogName=${encodeQueryValue(card.dogName)}`)
  if (task?.cycle_id) params.push(`cycleId=${encodeQueryValue(task.cycle_id)}`)
  params.push('locked=true')

  return `/pages/record/breeding-mating?${params.join('&')}`
}
