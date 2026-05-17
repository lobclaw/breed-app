import { localDb } from '@/localdb/db'
import type { LocalRowOf } from '@/localdb/types'
import type { BreedingCycle, BreedingCycleDetailResponse, BreedingRecord, Litter } from '@/types/breeding'
import type { Expense, Income, SaleRecord } from '@/types/finance'
import type { HealthRecord } from '@/types/health'
import type { DogWithStatus } from '@/types/dog'
import { getBeijingDateParts, getBeijingElapsedDays, getBeijingMonthRange, getBeijingOrdinalDay } from '@/utils/date'
import {
  getLatestMatingRecord,
  getMatingSireName,
} from '@/localdb/domain-services/breedingStatus'
import {
  buildExpenseDisplayInfo,
  type ExpenseSourceRecord,
} from '@/localdb/domain-services/financeDisplay'
import { listLocalDogsWithStatus } from './dogs'
import { sortByRecent } from './shared'

type BreedingCycleRow = LocalRowOf<'breeding_cycles'>
type BreedingRecordRow = LocalRowOf<'breeding_records'> & {
  dog_name?: string | null
  cycle_number?: number | null
}
type LitterRow = LocalRowOf<'litters'> & {
  _puppy_count?: number
  litter_number?: number | null
  puppies?: PuppyLike[]
}
type DogRow = LocalRowOf<'dogs'>
type DogWeightRow = LocalRowOf<'dog_weights'> & { date?: number | null }
type ExpenseRow = LocalRowOf<'expenses'>
type IncomeRow = LocalRowOf<'incomes'>
type SaleRow = LocalRowOf<'sale_records'>
type TaskRow = LocalRowOf<'tasks'>
type LitterProjection = LitterRow & ReturnType<typeof formatLitterProjection>

type BreedingDetails = Record<string, unknown> & {
  sire_id?: string | null
  sire_name?: string | null
}

type SireRefSource = {
  sire_id?: string | null
  sire_name?: string | null
}

type PuppyLike = {
  deleted_at?: number | null
}

type ExtraArrangementKind = 'other' | 'contact_doctor' | 'recheck_observe' | 'preparation'

function isExtraArrangementKind(value: string): value is ExtraArrangementKind {
  return value === 'other'
    || value === 'contact_doctor'
    || value === 'recheck_observe'
    || value === 'preparation'
}

function normalizeSireLookupName(value?: string | null) {
  return String(value || '').trim()
}

function getMatingSireId(record: { details?: BreedingDetails | null; sire_id?: string | null }) {
  const details = record?.details || {}
  return String(details.sire_id || record?.sire_id || '').trim()
}

function doesSireRefMatch(source: SireRefSource | null | undefined, sireId: string, sireName: string) {
  if (!source) return false
  const sourceSireId = String(source.sire_id || '').trim()
  const sourceSireName = normalizeSireLookupName(source.sire_name)
  return (!!sireId && sourceSireId === sireId)
    || (!!sireName && sourceSireName === sireName)
}

function doesMatingRecordSireMatch(record: BreedingRecordRow, sireId: string, sireName: string) {
  const recordSireId = getMatingSireId(record)
  const recordSireName = normalizeSireLookupName(getMatingSireName(record))
  return (!!sireId && recordSireId === sireId)
    || (!!sireName && recordSireName === sireName)
}

async function collectLocalSireCycleIds(familyId: string, sireId: string, sireName: string) {
  if (!familyId || (!sireId && !sireName)) return new Set<string>()

  const [cycles, matingRecords] = await Promise.all([
    localDb.query<BreedingCycleRow>('breeding_cycles', row =>
      row.family_id === familyId
      && !row.deleted_at
      && doesSireRefMatch(row, sireId, sireName),
    ),
    localDb.query<BreedingRecordRow>('breeding_records', row =>
      row.family_id === familyId
      && row.type === 'mating'
      && !row.deleted_at
      && !!row.cycle_id
      && doesMatingRecordSireMatch(row, sireId, sireName),
    ),
  ])

  return new Set([
    ...cycles.map(row => String(row._id || '')).filter(Boolean),
    ...matingRecords.map(row => String(row.cycle_id || '')).filter(Boolean),
  ])
}

function getRowPuppyCount(row: { puppies?: PuppyLike[] }) {
  if (Array.isArray(row.puppies)) {
    return row.puppies.filter(puppy => !puppy?.deleted_at).length
  }
  return 0
}

function normalizeLitterBirthCounts<T extends { born_alive?: number | null; puppies?: PuppyLike[]; total_born?: number | null }>(
  litter: T,
  puppyCountInput?: number,
): T & { born_alive: number; total_born: number } {
  const resolvedPuppyCount = Number(puppyCountInput ?? getRowPuppyCount(litter) ?? 0)
  const puppyCount = Number.isFinite(resolvedPuppyCount) ? Math.max(0, resolvedPuppyCount) : 0
  const totalBorn = Math.max(Number(litter.total_born || 0), puppyCount)
  const bornAlive = Math.max(Number(litter.born_alive || 0), puppyCount)
  return {
    ...litter,
    total_born: totalBorn,
    born_alive: bornAlive,
  }
}

function formatLitterProjection(row: LitterRow) {
  const puppyCount = Number(row._puppy_count ?? getRowPuppyCount(row) ?? 0)
  const normalized = normalizeLitterBirthCounts(row, puppyCount)
  return {
    ...normalized,
    damName: normalized.dam_name,
    litterNumber: normalized.litter_number || undefined,
    birthDate: normalized.birth_date,
    puppyCount: puppyCount || Number(normalized.born_alive || normalized.total_born || 0),
    aliveCount: Number(normalized.born_alive || normalized.total_born || 0),
    totalCount: Number(normalized.total_born || normalized.born_alive || 0),
  }
}

function getCycleStatusLabel(status?: string) {
  if (status === '发情中') return '发情中'
  if (status === '怀孕中') return '怀孕中'
  if (status === '已生产') return '已生产'
  if (status === '失败') return '失败'
  if (status === '放弃') return '已关闭'
  return status || '未知'
}

function getCycleStatusOrder(status?: string) {
  if (status === '发情中') return 0
  if (status === '怀孕中') return 1
  if (status === '已生产') return 2
  return 3
}

function buildCycleProjection(
  row: BreedingCycleRow & { _terminal_records?: BreedingRecordRow[]; birth_date?: number | null; record_count?: number | null },
  linkedLitter?: LitterRow | null,
) {
  const referenceTs = Number(row.mated_at || row.start_date || row.updated_at || row.created_at || 0)
  const currentDay = getBeijingOrdinalDay(referenceTs) || 0
  let detail = row.start_date ? formatDate(row.start_date) : `${Number(row.record_count || 0)}条记录`

  if (row.status === '发情中' && row.start_date) {
    detail = `发情第${getBeijingOrdinalDay(Number(row.start_date)) || 1}天`
  } else if (row.status === '怀孕中' && referenceTs) {
    detail = `怀孕第${currentDay || 1}天`
  } else if (row.status === '已生产' && linkedLitter) {
    const aliveCount = Number(linkedLitter.born_alive || linkedLitter.total_born || 0)
    const totalCount = Number(linkedLitter.total_born || linkedLitter.born_alive || 0)
    detail = `存活 ${aliveCount}/${totalCount}`
  } else if (row.status === '已生产' && row.birth_date) {
    detail = `生产于 ${formatDate(row.birth_date)}`
  }

  return {
    ...row,
    damName: row.dam_name,
    cycleNumber: row.cycle_number,
    statusLabel: getCycleStatusLabel(row.status),
    detail,
  }
}

function formatDate(ts?: number): string {
  if (!ts) return '--'
  const date = getBeijingDateParts(ts)
  const y = date.year
  const m = String(date.month).padStart(2, '0')
  const d = String(date.day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatMonthDay(ts?: number): string {
  if (!ts) return '--'
  const date = getBeijingDateParts(ts)
  const m = String(date.month).padStart(2, '0')
  const d = String(date.day).padStart(2, '0')
  return `${m}月${d}日`
}

export async function listLocalLitters(
  familyId: string,
  options: {
    activeOnly?: boolean
    damId?: string
    sireId?: string
    sireName?: string
  } = {},
) {
  if (!familyId) return [] as LitterProjection[]
  const normalizedSireId = String(options.sireId || '').trim()
  const normalizedSireName = normalizeSireLookupName(options.sireName)
  const sireCycleIds = await collectLocalSireCycleIds(familyId, normalizedSireId, normalizedSireName)
  const rows = await localDb.query<LitterRow>('litters', (row) => {
    if (row.family_id !== familyId) return false
    if (row.deleted_at) return false
    if (options.activeOnly && row.weaned_at) return false
    if (options.damId && row.dam_id !== options.damId) return false
    if (normalizedSireId || normalizedSireName) {
      const matchedByLitter = doesSireRefMatch(row, normalizedSireId, normalizedSireName)
      const matchedByCycle = !!row.cycle_id && sireCycleIds.has(row.cycle_id)
      if (!matchedByLitter && !matchedByCycle) return false
    }
    return true
  }, {
    sort: sortByRecent,
  })
  let normalizedRows = rows
  if (rows.some(row => !Number(row.litter_number))) {
    const damIds = Array.from(new Set(rows.map(row => row.dam_id).filter(Boolean)))
    const siblings = await localDb.query<LitterRow>('litters', row =>
      row.family_id === familyId
      && !row.deleted_at
      && damIds.includes(row.dam_id),
    )
    const numberedMap = new Map(
      attachLitterNumbers(siblings.map(item => ({ ...item }))).map(item => [item._id, item]),
    )
    normalizedRows = rows.map((row) => {
      if (Number(row.litter_number) > 0) return row
      const computedNumber = Number(numberedMap.get(row._id)?.litter_number)
      return computedNumber > 0 ? { ...row, litter_number: computedNumber } : row
    })
  }
  const litterIds = normalizedRows.map(row => row._id).filter((id): id is string => !!id)
  const puppies = litterIds.length
    ? await localDb.query<DogRow>('dogs', row =>
      row.family_id === familyId
      && !row.deleted_at
      && !!row.origin_litter_id
      && litterIds.includes(row.origin_litter_id),
    )
    : []
  const puppyCountByLitter = puppies.reduce<Record<string, number>>((map, puppy) => {
    const sourceLitterId = String(puppy.origin_litter_id || '')
    map[sourceLitterId] = (map[sourceLitterId] || 0) + 1
    return map
  }, {})
  return normalizedRows.map(row => formatLitterProjection({
    ...row,
    _puppy_count: puppyCountByLitter[row._id] || 0,
  })) as LitterProjection[]
}

export async function listLocalBreedingCycles(
  familyId: string,
  options: {
    damId?: string
    sireId?: string
    sireName?: string
    includeClosed?: boolean
  } = {},
) {
  if (!familyId) return [] as Array<BreedingCycle & ReturnType<typeof buildCycleProjection>>
  const normalizedSireId = String(options.sireId || '').trim()
  const normalizedSireName = normalizeSireLookupName(options.sireName)
  const sireCycleIds = await collectLocalSireCycleIds(familyId, normalizedSireId, normalizedSireName)
  const [rows, familyCycles] = await Promise.all([
    localDb.query<BreedingCycleRow>('breeding_cycles', (row) => {
      if (row.family_id !== familyId) return false
      if (row.deleted_at) return false
      if (options.damId && row.dam_id !== options.damId) return false
      if (normalizedSireId || normalizedSireName) {
        const matchedByCycle = doesSireRefMatch(row, normalizedSireId, normalizedSireName)
        const matchedByRecord = sireCycleIds.has(row._id)
        if (!matchedByCycle && !matchedByRecord) return false
      }
      if (!options.includeClosed && ['失败', '放弃'].includes(row.status)) return false
      return true
    }, {
      sort: (left, right) => {
        const orderDiff = getCycleStatusOrder(left.status) - getCycleStatusOrder(right.status)
        if (orderDiff !== 0) return orderDiff
        return sortByRecent(left, right)
      },
    }),
    localDb.query<BreedingCycleRow>('breeding_cycles', (row) => {
      if (row.family_id !== familyId) return false
      if (row.deleted_at) return false
      if (options.damId && row.dam_id !== options.damId) return false
      return true
    }),
  ])
  const cycleIds = rows.map(row => row._id).filter((id): id is string => !!id)
  const litters = cycleIds.length
    ? await localDb.query<LitterRow>('litters', row =>
      row.family_id === familyId
      && !row.deleted_at
      && cycleIds.includes(row.cycle_id),
      { sort: sortByRecent },
    )
    : []
  const terminalRecords = cycleIds.length
    ? await localDb.query<BreedingRecordRow>('breeding_records', row =>
      row.family_id === familyId
      && !row.deleted_at
      && cycleIds.includes(row.cycle_id)
      && row.type === 'abnormal_termination',
      { sort: sortByRecent },
    )
    : []
  const litterIds = litters.map(row => row._id).filter(Boolean)
  const puppies = litterIds.length
    ? await localDb.query<DogRow>('dogs', row =>
      row.family_id === familyId
      && !row.deleted_at
      && !!row.origin_litter_id
      && litterIds.includes(row.origin_litter_id),
    )
    : []
  const puppyCountByLitter = puppies.reduce<Record<string, number>>((map, puppy) => {
    const sourceLitterId = String(puppy.origin_litter_id || '')
    map[sourceLitterId] = (map[sourceLitterId] || 0) + 1
    return map
  }, {})
  const litterByCycleId = new Map<string, LitterRow & { born_alive: number; total_born: number }>()
  litters.forEach((litter) => {
    const cycleId = String(litter.cycle_id || '')
    if (!cycleId || litterByCycleId.has(cycleId)) return
    litterByCycleId.set(cycleId, normalizeLitterBirthCounts(litter, puppyCountByLitter[litter._id] || 0))
  })
  const cycleNumberById = new Map(attachCycleNumbers(familyCycles.map(row => ({ ...row }))).map(row => [row._id, row.cycle_number]))
  const terminalRecordsByCycleId = terminalRecords.reduce<Record<string, BreedingRecordRow[]>>((map, record) => {
    const cycleId = String(record.cycle_id || '')
    if (!cycleId) return map
    map[cycleId] = [...(map[cycleId] || []), record]
    return map
  }, {})
  return rows.map(row => buildCycleProjection({
    ...row,
    cycle_number: cycleNumberById.get(row._id) || row.cycle_number,
    _terminal_records: terminalRecordsByCycleId[row._id] || [],
  }, litterByCycleId.get(row._id))) as Array<BreedingCycle & ReturnType<typeof buildCycleProjection>>
}

export async function listLocalMatingRecordsBySire(familyId: string, input: { sireId?: string; sireName?: string } = {}) {
  const sireId = String(input.sireId || '').trim()
  const sireName = String(input.sireName || '').trim()
  if (!familyId || (!sireId && !sireName)) return []

  return localDb.query<BreedingRecord & { deleted_at?: number | null }>('breeding_records', row =>
    row.family_id === familyId
    && row.type === 'mating'
    && !row.deleted_at
    && doesMatingRecordSireMatch(row, sireId, sireName),
    { sort: sortByRecent },
  )
}

export async function listLocalLatestHeatDatesByDogIds(familyId: string, dogIds: string[]) {
  const dogIdSet = new Set((dogIds || []).map(id => String(id || '').trim()).filter(Boolean))
  if (!familyId || dogIdSet.size === 0) return {} as Record<string, number>

  const records = await localDb.query<BreedingRecord & { deleted_at?: number | null }>('breeding_records', row =>
    row.family_id === familyId
    && row.type === 'heat'
    && dogIdSet.has(row.dog_id)
    && !row.deleted_at,
  )

  return records.reduce<Record<string, number>>((map, record) => {
    const dogId = String(record.dog_id || '')
    const date = Number(record.date || record.details?.start_date || 0)
    if (!dogId || !Number.isFinite(date) || date <= 0) return map
    if (!map[dogId] || date > map[dogId]) {
      map[dogId] = date
    }
    return map
  }, {})
}

export async function getLocalBreedingCycleDetail(familyId: string, cycleId: string): Promise<BreedingCycleDetailResponse | null> {
  if (!familyId || !cycleId) return null
  const [cycle, records, litter, expenses, cycleSiblings, litterSiblings, puppies] = await Promise.all([
    localDb.findById<BreedingCycleRow>('breeding_cycles', cycleId),
    localDb.query<BreedingRecordRow>('breeding_records', row =>
      row.family_id === familyId && row.cycle_id === cycleId && !row.deleted_at,
      { sort: sortByRecent },
    ),
    localDb.query<LitterRow>('litters', row =>
      row.family_id === familyId && row.cycle_id === cycleId && !row.deleted_at,
      { sort: sortByRecent },
    ),
    localDb.query<ExpenseRow>('expenses', row =>
      row.family_id === familyId && row.linked_cycle_id === cycleId && !row.deleted_at,
      { sort: sortByRecent },
    ),
    localDb.query<BreedingCycleRow>('breeding_cycles', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<LitterRow>('litters', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<DogRow>('dogs', row => row.family_id === familyId && !row.deleted_at && !!row.origin_litter_id),
  ])

  if (!cycle || cycle.family_id !== familyId || cycle.deleted_at) return null
  const numberedCycles = attachCycleNumbers(cycleSiblings)
  const numberedLitters = attachLitterNumbers(litterSiblings)
  const currentCycle = (numberedCycles.find(item => item._id === cycleId) || cycle) as BreedingCycle
  const currentLitter = litter[0]
    ? (normalizeLitterBirthCounts(
      (numberedLitters.find(item => item._id === litter[0]._id) || litter[0]) as Litter,
      puppies.filter(item => item.origin_litter_id === litter[0]._id).length,
    ) as Litter)
    : null

  return {
    cycle: currentCycle,
    records,
    litter: currentLitter,
    expenses,
  }
}

function getCurrentMonthRange(now = Date.now()) {
  const date = getBeijingDateParts(now)
  const range = getBeijingMonthRange(date.year, date.monthIndex)
  return { start: range.startDate, end: range.endDate - 1 }
}

export async function getLocalKennelDashboardStats(familyId: string, options: { now?: number } = {}) {
  if (!familyId) {
    return {
      dogs: [] as DogWithStatus[],
      litters: [] as LitterRow[],
      sales: [] as SaleRow[],
      deliveredCount: 0,
      monthlyIncome: 0,
      monthlyExpense: 0,
    }
  }

  const [activeDogs, soldDogs, litters, allLitters, sales, expenses, incomes] = await Promise.all([
    listLocalDogsWithStatus(familyId),
    listLocalDogsWithStatus(familyId, { disposition: '已售' }),
    localDb.query<LitterRow>('litters', litter => litter.family_id === familyId && !litter.deleted_at && !litter.weaned_at),
    localDb.query<LitterRow>('litters', litter => litter.family_id === familyId && !litter.deleted_at),
    localDb.query<SaleRow>('sale_records', sale => sale.family_id === familyId && !sale.deleted_at),
    localDb.query<ExpenseRow>('expenses', expense => expense.family_id === familyId && !expense.deleted_at),
    localDb.query<IncomeRow>('incomes', income => income.family_id === familyId && !income.deleted_at),
  ])
  const monthRange = getCurrentMonthRange(options.now)
  const monthlyIncome = incomes
    .filter(item => Number(item.date || item.created_at || 0) >= monthRange.start && Number(item.date || item.created_at || 0) <= monthRange.end)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const monthlyExpense = expenses
    .filter(item => Number(item.date || item.created_at || 0) >= monthRange.start && Number(item.date || item.created_at || 0) <= monthRange.end)
    .reduce((sum, item) => sum + Number(item.total_amount || 0), 0)

  return {
    dogs: [...activeDogs, ...soldDogs],
    activeDogs,
    soldDogs,
    litters,
    deliveredCount: allLitters.length,
    sales,
    monthlyIncome,
    monthlyExpense,
  }
}

function buildLitterPupStats(puppies: DogRow[] = []) {
  return {
    total: puppies.length,
    alive: puppies.filter(puppy => puppy.disposition !== '已故').length,
    sold: puppies.filter(puppy => ['已售', '已预定'].includes(puppy.disposition)).length,
    kept: puppies.filter(puppy => puppy.disposition === '自留' || puppy.disposition === '在养').length,
    available: puppies.filter(puppy => puppy.disposition === '待售').length,
  }
}

export async function listLocalLittersByDam(familyId: string, damId: string) {
  if (!familyId || !damId) return []
  const litters = await listLocalLitters(familyId, { damId })
  if (!litters.length) return []

  return hydrateLittersWithPupStats(familyId, litters)
}

export async function listLocalLittersBySire(familyId: string, input: { sireId?: string; sireName?: string } = {}) {
  const sireId = String(input.sireId || '').trim()
  const sireName = String(input.sireName || '').trim()
  if (!familyId || (!sireId && !sireName)) return []

  const litters = await listLocalLitters(familyId, { sireId, sireName })
  if (!litters.length) return []

  return hydrateLittersWithPupStats(familyId, litters)
}

async function hydrateLittersWithPupStats(familyId: string, litters: LitterProjection[]) {
  const litterIds = litters.map(item => item._id)
  const cycleIds = Array.from(new Set(litters.map(item => item.cycle_id).filter((id): id is string => !!id)))
  const [puppies, cycles, matingRecords] = await Promise.all([
    localDb.query<DogRow>('dogs', row =>
      row.family_id === familyId
      && !row.deleted_at
      && !!row.origin_litter_id
      && litterIds.includes(row.origin_litter_id),
    ),
    localDb.query<BreedingCycleRow>('breeding_cycles', row =>
      row.family_id === familyId
      && !row.deleted_at
      && cycleIds.includes(row._id),
    ),
    localDb.query<BreedingRecordRow>('breeding_records', row =>
      row.family_id === familyId
      && row.type === 'mating'
      && !row.deleted_at
      && cycleIds.includes(row.cycle_id),
    ),
  ])
  const cycleMap = new Map(cycles.map(item => [item._id, item]))
  const puppyMap = new Map<string, DogRow[]>()
  puppies.forEach((puppy) => {
    const litterId = typeof puppy.origin_litter_id === 'string' ? puppy.origin_litter_id : ''
    if (!litterId) return
    const bucket = puppyMap.get(litterId) || []
    bucket.push(puppy)
    puppyMap.set(litterId, bucket)
  })

  return litters.map(litter => ({
    ...litter,
    sire_name: String(litter.sire_name || '').trim()
      || String(cycleMap.get(litter.cycle_id)?.sire_name || '').trim()
      || getMatingSireName(getLatestMatingRecord(litter.cycle_id, matingRecords))
      || null,
    pupStats: buildLitterPupStats(puppyMap.get(litter._id) || []),
  }))
}

export async function getLocalNextMatingNumberPreview(
  familyId: string,
  input: {
    dogId?: string
    cycleId?: string
  } = {},
) {
  const dogId = String(input.dogId || '').trim()
  let cycleId = String(input.cycleId || '').trim()
  if (!familyId || !dogId) {
    return { mating_number: 1, cycle_id: cycleId || null }
  }

  if (!cycleId) {
    const activeCycles = await localDb.query<BreedingCycleRow>('breeding_cycles', row =>
      row.family_id === familyId
      && row.dam_id === dogId
      && ['发情中', '怀孕中'].includes(row.status),
      { sort: sortByRecent },
    )
    cycleId = activeCycles[0]?._id || ''
  }

  if (!cycleId) {
    return { mating_number: 1, cycle_id: null }
  }

  const matingRecords = await localDb.query<BreedingRecordRow>('breeding_records', row =>
    row.family_id === familyId
    && row.cycle_id === cycleId
    && row.type === 'mating'
    && !row.deleted_at,
  )

  const maxMatingNumber = matingRecords.reduce((max, row) => {
    const details = row?.details || {}
    const candidate = Number(details.mating_number || details.mating_count || 0)
    return Math.max(max, Number.isFinite(candidate) ? candidate : 0)
  }, 0)

  return {
    mating_number: maxMatingNumber + 1,
    cycle_id: cycleId,
  }
}

export async function listLocalPreLaborTemperatureHistory(familyId: string, dogId: string) {
  if (!familyId || !dogId) return []
  const records = await localDb.query<BreedingRecordRow>('breeding_records', row =>
    row.family_id === familyId
    && row.dog_id === dogId
    && row.type === 'pre_labor'
    && !row.deleted_at,
    { sort: sortByRecent },
  )

  return records
    .map((row) => ({
      id: String(row._id || ''),
      temp: Number(row?.details?.temperature || 0),
      label: '',
      time: Number(row.date || row.created_at || 0),
      symptoms: normalizePreLaborSymptoms(row?.details || {}),
    }))
    .filter(item => item.temp > 0 && item.time > 0)
    .sort((left, right) => left.time - right.time)
    .slice(-6)
}

function normalizePreLaborSymptoms(details: Record<string, unknown>) {
  const legacyLabelMap: Record<string, string> = {
    刨窝: '刨窝/做窝',
    焦躁: '焦躁不安',
    喘气: '喘气加快',
    分泌物: '阴道分泌物',
    宫缩: '可见宫缩',
    乳汁: '乳汁分泌',
  }
  const normalize = (item: unknown) => {
    const label = String(item || '').trim()
    return legacyLabelMap[label] || label
  }

  if (Array.isArray(details.symptoms)) {
    return details.symptoms
      .map(normalize)
      .filter(Boolean)
  }

  const normalized = String(details.symptoms || '')
    .split(/[、，,\s]+/)
    .map(normalize)
    .filter(Boolean)

  if (details.nesting_behavior && !normalized.includes('刨窝/做窝')) {
    normalized.push('刨窝/做窝')
  }
  const appetiteChange = normalize(details.appetite_change)
  if (appetiteChange && !normalized.includes(appetiteChange)) {
    normalized.push(appetiteChange)
  }
  if (details.other_signs) {
    String(details.other_signs)
      .split(/[、，,\s]+/)
      .map(normalize)
      .filter(Boolean)
      .forEach((item) => {
        if (!normalized.includes(item)) normalized.push(item)
      })
  }

  return normalized
}

type PuppyRow = DogRow
type LitterProfitContext = {
  incomesByDogId: Map<string, IncomeRow[]>
  salesByDogId: Map<string, SaleRow[]>
  expenses: ExpenseRow[]
  expensesByCycleId: Map<string, ExpenseRow[]>
  expensesByLitterId: Map<string, ExpenseRow[]>
  expensesByDogId: Map<string, ExpenseRow[]>
  sourceRecordMap: Map<string, ExpenseSourceRecord>
}

function pushGroupedRow<T>(map: Map<string, T[]>, key: string | null | undefined, row: T) {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey) return
  const bucket = map.get(normalizedKey) || []
  bucket.push(row)
  map.set(normalizedKey, bucket)
}

function buildLitterProfitContext(
  incomes: IncomeRow[],
  sales: SaleRow[],
  expenses: ExpenseRow[],
  breedingRecords: BreedingRecordRow[],
  healthRecords: Array<HealthRecord & { deleted_at?: number | null }>,
): LitterProfitContext {
  const incomesByDogId = new Map<string, IncomeRow[]>()
  const salesByDogId = new Map<string, SaleRow[]>()
  const expensesByCycleId = new Map<string, ExpenseRow[]>()
  const expensesByLitterId = new Map<string, ExpenseRow[]>()
  const expensesByDogId = new Map<string, ExpenseRow[]>()

  incomes.forEach(income => pushGroupedRow(incomesByDogId, income.dog_id, income))
  sales.forEach(sale => pushGroupedRow(salesByDogId, sale.dog_id, sale))
  expenses.forEach((expense) => {
    pushGroupedRow(expensesByCycleId, expense.linked_cycle_id, expense)
    pushGroupedRow(expensesByLitterId, expense.linked_litter_id, expense)
    if (Array.isArray(expense.linked_dog_ids)) {
      expense.linked_dog_ids.forEach(dogId => pushGroupedRow(expensesByDogId, dogId, expense))
    }
  })

  return {
    incomesByDogId,
    salesByDogId,
    expenses,
    expensesByCycleId,
    expensesByLitterId,
    expensesByDogId,
    sourceRecordMap: new Map<string, ExpenseSourceRecord>([
      ...breedingRecords.map(record => [record._id, record] as [string, ExpenseSourceRecord]),
      ...healthRecords.map(record => [record._id, record] as [string, ExpenseSourceRecord]),
    ]),
  }
}

function buildLocalLitterProfitFromRows(
  familyId: string,
  litter: LitterRow | null,
  puppies: PuppyRow[],
  context: LitterProfitContext,
) {
  if (!litter || litter.family_id !== familyId) return null

  const puppyIds = puppies.map(item => item._id)
  const litterIncomes = puppyIds.flatMap(dogId => context.incomesByDogId.get(dogId) || [])
  const litterSales = puppyIds.flatMap(dogId => context.salesByDogId.get(dogId) || [])
  const cycleExpenses = litter.cycle_id
    ? context.expensesByCycleId.get(litter.cycle_id) || []
    : []
  const litterExpenses = context.expensesByLitterId.get(litter._id) || []

  const incomeByDog = litterIncomes.reduce<Record<string, number>>((map, income) => {
    const dogId = income.dog_id || ''
    if (!dogId) return map
    map[dogId] = (map[dogId] || 0) + Number(income.amount || 0)
    return map
  }, {})

  const saleByDog = litterSales.reduce<Record<string, SaleRow>>((map, sale) => {
    const existing = map[sale.dog_id]
    if (!existing || Number(sale.updated_at || 0) > Number(existing.updated_at || 0)) {
      map[sale.dog_id] = sale
    }
    return map
  }, {})

  const litterExpenseIds = new Set(litterExpenses.map(item => item._id))
  const exclusiveCycleExpenses = cycleExpenses.filter(expense => !litterExpenseIds.has(expense._id))

  const breedingCosts = exclusiveCycleExpenses.map((expense) => {
    const display = buildExpenseDisplayInfo(expense, context.sourceRecordMap, '繁育费用')
    return {
      id: expense._id,
      ...display,
      amount: Number(expense.total_amount || 0),
    }
  })
  const litterCosts = litterExpenses.map((expense) => {
    const display = buildExpenseDisplayInfo(expense, context.sourceRecordMap, '窝费用')
    return {
      id: expense._id,
      ...display,
      amount: Number(expense.total_amount || 0),
    }
  })

  const countedExpenseIds = new Set([
    ...exclusiveCycleExpenses.map(item => item._id),
    ...litterExpenses.map(item => item._id),
  ])
  const puppyCosts: Array<{ id: string; title: string; subtitle: string; name: string; amount: number }> = []
  const puppyExpenseIds = new Set<string>()
  for (const dogId of puppyIds) {
    for (const expense of context.expensesByDogId.get(dogId) || []) {
      puppyExpenseIds.add(expense._id)
    }
  }

  for (const expense of context.expenses) {
    if (!puppyExpenseIds.has(expense._id)) continue
    if (countedExpenseIds.has(expense._id)) continue
    if (!Array.isArray(expense.linked_dog_ids) || !expense.linked_dog_ids.length) continue
    const matchedCount = expense.linked_dog_ids.filter(id => puppyIds.includes(id)).length
    if (!matchedCount) continue
    const shareAmount = Number(expense.total_amount || 0) * matchedCount / expense.linked_dog_ids.length
    const display = buildExpenseDisplayInfo(expense, context.sourceRecordMap, '幼崽费用')
    puppyCosts.push({
      id: expense._id,
      ...display,
      amount: Math.round(shareAmount * 100) / 100,
    })
  }

  const totalIncome = litterIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const totalExpense = [...breedingCosts, ...litterCosts, ...puppyCosts]
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const alivePuppies = puppies.filter(item => item.disposition !== '已故')
  const avgCostPerPuppy = alivePuppies.length > 0 ? totalExpense / alivePuppies.length : 0
  const normalizedLitter = normalizeLitterBirthCounts(litter, puppies.length) as Litter
  const incomeItems = puppies.map((puppy, index) => {
    const actualIncome = incomeByDog[puppy._id] || 0
    const sale = saleByDog[puppy._id]
    const isCompletedSale = sale?.status === '已成交' || puppy.disposition === '已售'
    if (actualIncome !== 0) {
      return {
        id: puppy._id,
        name: puppy.name || `幼崽${index + 1}`,
        gender: puppy.gender || '',
        disposition: puppy.disposition || '',
        status: isCompletedSale ? 'sold' : 'received',
        amount: actualIncome,
        estimated_amount: 0,
      }
    }
    if (sale && sale.status === '已预定') {
      return {
        id: puppy._id,
        name: puppy.name || `幼崽${index + 1}`,
        gender: puppy.gender || '',
        disposition: puppy.disposition || '',
        status: 'reserved',
        amount: 0,
        estimated_amount: sale.agreed_price || sale.floor_price || 0,
      }
    }
    if ((sale && sale.status === '待售') || puppy.disposition === '已预定') {
      return {
        id: puppy._id,
        name: puppy.name || `幼崽${index + 1}`,
        gender: puppy.gender || '',
        disposition: puppy.disposition || '',
        status: puppy.disposition === '已预定' ? 'reserved' : 'pending',
        amount: 0,
        estimated_amount: sale?.agreed_price || sale?.floor_price || 0,
      }
    }
    return {
      id: puppy._id,
      name: puppy.name || `幼崽${index + 1}`,
      gender: puppy.gender || '',
      disposition: puppy.disposition || '',
      status: 'pending',
      amount: 0,
      estimated_amount: 0,
    }
  })

  return {
    litter: normalizedLitter,
    puppies,
    totalIncome,
    totalExpense,
    totalCost: totalExpense,
    netProfit: totalIncome - totalExpense,
    puppyCount: alivePuppies.length,
    totalPuppyCount: puppies.length,
    aliveCount: alivePuppies.length,
    costPerPuppy: Math.round(avgCostPerPuppy),
    avgCostPerPuppy: Math.round(avgCostPerPuppy),
    incomeItems,
    breedingCosts,
    litterCosts,
    puppyCosts,
  }
}

export async function getLocalLitterProfit(familyId: string, litterId: string) {
  if (!familyId || !litterId) return null

  const [litter, puppies, incomes, sales, expenses, breedingRecords, healthRecords] = await Promise.all([
    localDb.findById<LitterRow>('litters', litterId),
    localDb.query<DogRow>('dogs', row => row.family_id === familyId && row.origin_litter_id === litterId && !row.deleted_at),
    localDb.query<IncomeRow>('incomes', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<SaleRow>('sale_records', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<ExpenseRow>('expenses', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<BreedingRecordRow>('breeding_records', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<HealthRecord & { deleted_at?: number | null }>('health_records', row => row.family_id === familyId && !row.deleted_at),
  ])

  return buildLocalLitterProfitFromRows(
    familyId,
    litter,
    puppies,
    buildLitterProfitContext(incomes, sales, expenses, breedingRecords, healthRecords),
  )
}

export async function getLocalDamRoi(familyId: string, damId: string) {
  if (!familyId || !damId) return null

  const [dam, cycles, litters, allExpenses, allPuppies, allIncomes, allSales, breedingRecords, healthRecords] = await Promise.all([
    localDb.findById<DogRow>('dogs', damId),
    localDb.query<BreedingCycleRow>('breeding_cycles', row => row.family_id === familyId && row.dam_id === damId),
    localDb.query<LitterRow>('litters', row => row.family_id === familyId && row.dam_id === damId),
    localDb.query<ExpenseRow>('expenses', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<DogRow>('dogs', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<IncomeRow>('incomes', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<SaleRow>('sale_records', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<BreedingRecordRow>('breeding_records', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<HealthRecord & { deleted_at?: number | null }>('health_records', row => row.family_id === familyId && !row.deleted_at),
  ])

  if (!dam || dam.family_id !== familyId || dam.deleted_at) return null

  const cycleIds = cycles.map(item => item._id)
  const litterIds = litters.map(item => item._id)
  const litterIdSet = new Set(litterIds)
  const puppiesByLitterId = new Map<string, PuppyRow[]>()
  allPuppies.forEach((puppy) => {
    const litterId = String(puppy.origin_litter_id || '')
    if (!litterIdSet.has(litterId)) return
    const bucket = puppiesByLitterId.get(litterId) || []
    bucket.push(puppy)
    puppiesByLitterId.set(litterId, bucket)
  })
  const profitContext = buildLitterProfitContext(allIncomes, allSales, allExpenses, breedingRecords, healthRecords)
  const litterSummaries = litters
    .map(litter => buildLocalLitterProfitFromRows(familyId, litter, puppiesByLitterId.get(litter._id) || [], profitContext))
    .filter((item): item is NonNullable<typeof item> => !!item)
  const totalBreedingIncome = litterSummaries.reduce((sum, item) => sum + Number(item.totalIncome || 0), 0)
  const totalBreedingCost = litterSummaries.reduce((sum, item) => sum + Number(item.totalExpense || 0), 0)

  const litterList = litterSummaries.map((summary, index) => {
    const hasUnsettledPuppy = (summary.incomeItems || []).some(item => item.status !== 'sold')
    let status = 'income'
    if (hasUnsettledPuppy) status = 'in_progress'
    else if (summary.netProfit < 0) status = 'failed'
    return {
      id: summary.litter._id,
      index: index + 1,
      title: `${summary.litter.dam_name || dam.name}第${index + 1}窝`,
      meta: `${summary.aliveCount}/${summary.totalPuppyCount}只存活`,
      puppyCount: summary.aliveCount,
      profit: summary.netProfit,
      status,
    }
  })

  const countedIds = new Set<string>()
  for (const expense of allExpenses) {
    if (
      (expense.linked_cycle_id && cycleIds.includes(expense.linked_cycle_id))
      || (expense.linked_litter_id && litterIds.includes(expense.linked_litter_id))
    ) {
      countedIds.add(expense._id)
    }
  }

  let healthCost = 0
  for (const expense of allExpenses) {
    if (countedIds.has(expense._id)) continue
    if (expense.category === '购入') continue
    if (Array.isArray(expense.linked_dog_ids) && expense.linked_dog_ids.includes(damId)) {
      healthCost += Number(expense.total_amount || 0) / expense.linked_dog_ids.length
    }
  }

  const purchaseCost = Number(dam.purchase_price || 0)
  const totalInvestment = purchaseCost + totalBreedingCost + healthCost
  const netProfit = totalBreedingIncome - totalInvestment
  const roiPercent = totalInvestment > 0
    ? Math.round((netProfit / totalInvestment) * 1000) / 10
    : 0

  return {
    damId,
    damName: dam.name,
    purchasePrice: purchaseCost,
    purchaseCost,
    totalIncome: totalBreedingIncome,
    totalBreedingIncome,
    totalBreedingCost,
    healthCost,
    totalExpense: totalInvestment,
    netReturn: netProfit,
    netProfit,
    roiPercent,
    cycleCount: cycles.length,
    litterCount: litters.length,
    puppyCount: allPuppies.filter(item => !!item.origin_litter_id && litterIds.includes(item.origin_litter_id)).length,
    litters: litterList,
  }
}

function attachCycleNumbers<T extends BreedingCycleRow>(cycles: T[]) {
  const groups = new Map<string, T[]>()
  cycles.forEach((cycle) => {
    const key = cycle.dam_id || '__unknown__'
    const bucket = groups.get(key) || []
    bucket.push(cycle)
    groups.set(key, bucket)
  })

  groups.forEach((bucket) => {
    bucket
      .sort((left, right) => {
        const startDiff = Number(left.start_date || left.created_at || 0) - Number(right.start_date || right.created_at || 0)
        if (startDiff !== 0) return startDiff
        const createdDiff = Number(left.created_at || 0) - Number(right.created_at || 0)
        if (createdDiff !== 0) return createdDiff
        return String(left._id || '').localeCompare(String(right._id || ''))
      })
      .forEach((cycle, index) => {
        cycle.cycle_number = index + 1
      })
  })

  return cycles
}

function attachLitterNumbers<T extends LitterRow>(litters: T[]) {
  const groups = new Map<string, T[]>()
  litters.forEach((litter) => {
    const key = litter.dam_id || '__unknown__'
    const bucket = groups.get(key) || []
    bucket.push(litter)
    groups.set(key, bucket)
  })

  groups.forEach((bucket) => {
    bucket
      .sort((left, right) => Number(left.birth_date || left.created_at || 0) - Number(right.birth_date || right.created_at || 0))
      .forEach((litter, index) => {
        litter.litter_number = index + 1
      })
  })

  return litters
}

export interface BreedingCycleFormContext {
  cycle_id: string
  cycle_number: number | null
  status: string
  dam_id: string
  dam_name: string
  heat_date: number | null
  start_date: number | null
  mated_at: number | null
  expected_due_date: number | null
}

export async function getLocalBreedingCycleFormContext(familyId: string, cycleId: string): Promise<BreedingCycleFormContext | null> {
  if (!familyId || !cycleId) return null
  const [cycle, cycleSiblings, records] = await Promise.all([
    localDb.findById<BreedingCycleRow>('breeding_cycles', cycleId),
    localDb.query<BreedingCycleRow>('breeding_cycles', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<BreedingRecordRow>('breeding_records', row =>
      row.family_id === familyId && row.cycle_id === cycleId && !row.deleted_at,
    ),
  ])

  if (!cycle || cycle.family_id !== familyId || cycle.deleted_at) return null
  const numberedCycles = attachCycleNumbers(cycleSiblings)
  const currentCycle = numberedCycles.find(item => item._id === cycleId) || cycle
  const heatRecords = records
    .filter(record => record.type === 'heat')
    .sort((left, right) => Number(left.date || left.created_at || 0) - Number(right.date || right.created_at || 0))
  const latestMating = records
    .filter(record => record.type === 'mating')
    .sort((left, right) => Number(right.date || right.created_at || 0) - Number(left.date || left.created_at || 0))[0]
  const matingDate = Number(currentCycle.mated_at || latestMating?.date || 0)
  const expectedDueDate = Number(latestMating?.details?.expected_due_date || 0) || (matingDate > 0 ? matingDate + 59 * 86400000 : 0)

  return {
    cycle_id: cycleId,
    cycle_number: Number(currentCycle.cycle_number || 0) || null,
    status: String(currentCycle.status || ''),
    dam_id: String(currentCycle.dam_id || ''),
    dam_name: String(currentCycle.dam_name || ''),
    heat_date: Number(heatRecords[0]?.date || currentCycle.start_date || 0) || null,
    start_date: Number(currentCycle.start_date || 0) || null,
    mated_at: matingDate > 0 ? matingDate : null,
    expected_due_date: expectedDueDate > 0 ? expectedDueDate : null,
  }
}

export async function getLocalBreedingRecordDetail(familyId: string, recordId: string) {
  if (!familyId || !recordId) return null
  const [record, tasks, dog, cycleSiblings] = await Promise.all([
    localDb.findById<BreedingRecordRow>('breeding_records', recordId),
    localDb.query<TaskRow>('tasks', row =>
      row.family_id === familyId
      && row.type === 'breeding_extra_arrangement'
      && row.source_record_id === recordId
      && row.status === 'pending',
      { sort: sortByRecent },
    ),
    localDb.query<DogRow>('dogs', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<BreedingCycleRow>('breeding_cycles', row => row.family_id === familyId && !row.deleted_at),
  ])
  if (!record || record.family_id !== familyId) return null
  const dogMap = new Map(dog.map(item => [item._id, item]))
  const numberedCycles = attachCycleNumbers(cycleSiblings)
  const currentCycle = numberedCycles.find(item => item._id === record.cycle_id) || null
  const extraTask = tasks[0]
  const extraDetails = extraTask?.details || {}
  const extraKind = String(extraDetails.kind || '').trim()
  return {
    ...record,
    dog_name: record.dog_name || dogMap.get(record.dog_id)?.name || '',
    cycle_number: currentCycle?.cycle_number || record.cycle_number || null,
    extra_arrangement: extraTask
      ? {
        task_id: extraTask._id,
        kind: isExtraArrangementKind(extraKind) ? extraKind : null,
        due_date: Number(extraTask.due_date || 0) || null,
        notes: typeof extraDetails.notes === 'string' ? extraDetails.notes : null,
        anchor_type: typeof extraDetails.anchor_type === 'string' ? extraDetails.anchor_type : 'cycle',
      }
      : null,
  }
}

export async function getLocalLitterDetail(familyId: string, litterId: string) {
  if (!familyId || !litterId) return null
  const [litter, puppies, weights, expenses, incomes, allLitters, cycles, breedingRecords] = await Promise.all([
    localDb.findById<LitterRow>('litters', litterId),
    localDb.query<DogRow>('dogs', row => row.family_id === familyId && row.origin_litter_id === litterId && !row.deleted_at),
    localDb.query<DogWeightRow>('dog_weights', row => row.family_id === familyId && !!row.dog_id),
    localDb.query<ExpenseRow>('expenses', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<IncomeRow>('incomes', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<LitterRow>('litters', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<BreedingCycleRow>('breeding_cycles', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<BreedingRecordRow>('breeding_records', row => row.family_id === familyId && row.type === 'mating' && !row.deleted_at),
  ])
  if (!litter || litter.family_id !== familyId) return null

  const numberedLitters = attachLitterNumbers(allLitters)
  const numberedLitter = numberedLitters.find(item => item._id === litterId) || litter
  const linkedCycle = cycles.find(item => item._id === litter.cycle_id) || null
  const latestMating = getLatestMatingRecord(litter.cycle_id, breedingRecords)
  const sireName = String(litter.sire_name || '').trim()
    || String(linkedCycle?.sire_name || '').trim()
    || getMatingSireName(latestMating)
  const puppyIds = puppies.map(item => item._id)
  const weightMap = new Map<string, DogWeightRow[]>()
  weights
    .filter(item => puppyIds.includes(item.dog_id))
    .forEach((item) => {
      const bucket = weightMap.get(item.dog_id) || []
      bucket.push(item)
      weightMap.set(item.dog_id, bucket)
    })

  const normalizedPuppies = puppies.map((puppy) => {
    const history = (weightMap.get(puppy._id) || [])
      .sort((left, right) => Number(right.date || right.created_at || 0) - Number(left.date || left.created_at || 0))
      .slice(0, 3)
    const latest = history[0]
    return {
      ...puppy,
      last_weight: latest?.weight || puppy.latest_weight || null,
      last_weight_at: latest?.date || null,
      weight_history: history.slice().reverse().map(item => ({
        weight: item.weight,
        date: item.date,
      })),
    }
  })

  const expenseTotal = expenses
    .filter(item => item.linked_litter_id === litterId)
    .reduce((sum, item) => sum + Number(item.total_amount || 0), 0)
  const incomeTotal = incomes
    .filter(item => !!item.dog_id && puppyIds.includes(item.dog_id))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)

  return {
    litter: {
      ...normalizeLitterBirthCounts(numberedLitter, normalizedPuppies.length),
      sire_name: sireName || numberedLitter.sire_name || null,
      expense: expenseTotal,
      income: incomeTotal,
    },
    puppies: normalizedPuppies,
  }
}
