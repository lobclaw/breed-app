import type { DeriveStatus } from '@/types/dog'
import { getBeijingDateParts, getBeijingElapsedDays, getBeijingOrdinalDay } from '@/utils/date'

type BreedingCycleStatusRow = {
  _id?: string
  dam_id?: string
  status?: string
  start_date?: number | null
  mated_at?: number | null
  sire_name?: string | null
  updated_at?: number | null
  created_at?: number | null
}
type BreedingRecordStatusRow = {
  cycle_id?: string
  type?: string
  date?: number | null
  updated_at?: number | null
  created_at?: number | null
  deleted_at?: number | null
  sire_name?: string | null
  details?: Record<string, unknown> | null
}
type LitterStatusRow = {
  cycle_id?: string
  dam_id?: string
  sire_name?: string | null
  birth_date?: number | null
  total_born?: number | null
  born_alive?: number | null
  updated_at?: number | null
  created_at?: number | null
}

function formatDate(ts?: number): string {
  if (!ts) return '--'
  const date = getBeijingDateParts(ts)
  const y = date.year
  const m = String(date.month).padStart(2, '0')
  const d = String(date.day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getBreedingRecordTs(record: BreedingRecordStatusRow) {
  return Number(record?.date || record?.updated_at || record?.created_at || 0)
}

export function getLatestMatingRecord(cycleId: string, breedingRecords: BreedingRecordStatusRow[] = []) {
  if (!cycleId) return null
  return [...breedingRecords]
    .filter(record => record?.cycle_id === cycleId && record?.type === 'mating' && !record?.deleted_at)
    .sort((left, right) => getBreedingRecordTs(right) - getBreedingRecordTs(left))[0] || null
}

function getLatestBreedingRecordByType(cycleId: string, breedingRecords: BreedingRecordStatusRow[] = [], type: string) {
  if (!cycleId) return null
  return [...breedingRecords]
    .filter(record => record?.cycle_id === cycleId && record?.type === type && !record?.deleted_at)
    .sort((left, right) => getBreedingRecordTs(right) - getBreedingRecordTs(left))[0] || null
}

export function getMatingSireName(record?: BreedingRecordStatusRow | null) {
  const details = record?.details || {}
  return String(details.sire_name || details.male_name || record?.sire_name || '').trim()
}

function getMatingNumberText(record?: BreedingRecordStatusRow | null) {
  const details = record?.details || {}
  const matingNumber = Number(details.mating_number || details.mating_count)
  return Number.isFinite(matingNumber) && matingNumber > 0 ? `配种${matingNumber}次` : ''
}

export function buildDetailBreedingStatuses(
  cycles: BreedingCycleStatusRow[] = [],
  activeLitters: LitterStatusRow[] = [],
  breedingRecords: BreedingRecordStatusRow[] = [],
  now = Date.now(),
): DeriveStatus[] {
  const activeCycle = [...cycles]
    .filter(cycle => cycle.status === '发情中' || cycle.status === '怀孕中')
    .sort((left, right) => Number(right.updated_at || right.created_at || 0) - Number(left.updated_at || left.created_at || 0))[0]

  if (activeCycle?.status === '发情中') {
    const activeCycleId = activeCycle._id || ''
    const latestFollicle = getLatestBreedingRecordByType(activeCycleId, breedingRecords, 'follicle_check')
    const latestMating = getLatestMatingRecord(activeCycleId, breedingRecords)
    const follicleDay = latestFollicle?.date && !latestMating
      ? getBeijingOrdinalDay(Number(latestFollicle.date), now)
      : null
    return [{
      type: '发情中',
      cycleId: activeCycleId,
      activityTs: activeCycle.updated_at || activeCycle.created_at || 0,
      meta: follicleDay ? [{ icon: 'schedule', text: `卵检后第${follicleDay}天` }] : [],
    }]
  }

  if (activeCycle?.status === '怀孕中') {
    const activeCycleId = activeCycle._id || ''
    const latestMating = getLatestMatingRecord(activeCycleId, breedingRecords)
    const startTs = activeCycle.mated_at || latestMating?.date || activeCycle.updated_at || activeCycle.created_at || now
    const sireName = activeCycle.sire_name || getMatingSireName(latestMating)
    const matingNumberText = getMatingNumberText(latestMating)
    const totalDays = 63
    const currentDay = getBeijingOrdinalDay(startTs, now) || 1
    const dueTs = startTs + totalDays * 86400000
    const dueDate = getBeijingDateParts(dueTs)
    const dueMd = `${dueDate.month}月${dueDate.day}日`

    return [{
      type: '怀孕中',
      cycleId: activeCycleId,
      detail: [
        sireName ? `种公: ${sireName}` : '',
        matingNumberText,
      ].filter(Boolean).join(' · '),
      progress: { current: Math.min(currentDay, totalDays), total: totalDays },
      activityTs: activeCycle.updated_at || activeCycle.created_at || 0,
      meta: [
        { icon: 'event', text: `预产期 ${dueMd}` },
        { icon: 'schedule', text: `还有${getBeijingElapsedDays(now, dueTs)}天` },
      ],
    }]
  }

  if (activeLitters.length === 0) return []

  const latestLitter = [...activeLitters].sort((left, right) => {
    const leftTs = left.birth_date || left.updated_at || left.created_at || 0
    const rightTs = right.birth_date || right.updated_at || right.created_at || 0
    return rightTs - leftTs
  })[0]
  const birthTs = latestLitter?.birth_date || latestLitter?.created_at || 0
  const nursingDay = getBeijingOrdinalDay(birthTs, now)
  const totalBorn = Number(latestLitter?.total_born)
  const bornAlive = Number(latestLitter?.born_alive)
  const aliveSummary = Number.isFinite(totalBorn) && totalBorn > 0 && Number.isFinite(bornAlive)
    ? `本窝存活 ${bornAlive}/${totalBorn}`
    : ''
  const detail = [
    latestLitter?.sire_name ? `种公: ${latestLitter.sire_name}` : '',
    aliveSummary,
  ].filter(Boolean).join(' · ')
  const meta = [
    ...(birthTs ? [{ icon: 'event', text: `生产于 ${formatDate(birthTs)}` }] : []),
    ...(nursingDay ? [{ icon: 'schedule', text: `第${nursingDay}天` }] : []),
    ...(aliveSummary ? [{ icon: 'favorite', text: aliveSummary }] : []),
  ]

  return [{
    type: '哺乳中',
    cycleId: latestLitter?.cycle_id || '',
    detail,
    meta,
    activityTs: latestLitter?.updated_at || latestLitter?.created_at || 0,
  }]
}

export function buildBreedingStatusMap(cycles: BreedingCycleStatusRow[] = [], activeLitters: LitterStatusRow[] = [], now = Date.now()) {
  const breedingStatusMap = new Map<string, DeriveStatus[]>()

  for (const cycle of cycles) {
    const damId = cycle.dam_id
    if (!damId) continue
    if (cycle.status === '发情中') {
      const startTs = cycle.start_date || cycle.created_at || now
      const day = getBeijingOrdinalDay(startTs, now) || 1
      breedingStatusMap.set(damId, [{
        type: '发情中',
        cycleId: cycle._id,
        activityTs: cycle.updated_at || cycle.created_at || 0,
        meta: [{ icon: 'schedule', text: `第${day}天` }],
      }])
      continue
    }
    if (cycle.status === '怀孕中') {
      const startTs = cycle.mated_at || cycle.updated_at || cycle.created_at || now
      const currentDay = getBeijingOrdinalDay(startTs, now) || 1
      breedingStatusMap.set(damId, [{
        type: '怀孕中',
        cycleId: cycle._id,
        progress: { current: Math.min(currentDay, 63), total: 63 },
        activityTs: cycle.updated_at || cycle.created_at || 0,
      }])
      continue
    }
    if (cycle.status === '已生产') {
      const latestLitter = activeLitters
        .filter(litter => litter.dam_id === damId)
        .sort((left, right) => (right.birth_date || right.created_at || 0) - (left.birth_date || left.created_at || 0))[0]
      if (!latestLitter) continue
      const startTs = latestLitter.birth_date || latestLitter.created_at || now
      const day = getBeijingOrdinalDay(startTs, now) || 1
      breedingStatusMap.set(damId, [{
        type: '哺乳中',
        cycleId: cycle._id,
        activityTs: latestLitter.updated_at || latestLitter.created_at || 0,
        meta: [{ icon: 'schedule', text: `第${day}天` }],
      }])
    }
  }

  return breedingStatusMap
}
