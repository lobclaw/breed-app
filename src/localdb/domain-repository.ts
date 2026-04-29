import { localDb } from '@/localdb/db'
import type { MedicationProtocol } from '@/stores/protocolStore'
import type { BreedingCycle, BreedingCycleDetailResponse, BreedingRecord, Litter } from '@/types/breeding'
import type { Agent, Expense, ExpenseCategory, ExpenseCategoryGroup, Income, SaleRecord } from '@/types/finance'
import type { CareRule, Family, FamilySettings } from '@/types/family'
import type { HealthRecord, MedicationTask } from '@/types/health'
import type { RecycleBinItem } from '@/types/recycle'
import type { DeriveStatus, DogWithStatus } from '@/types/dog'
import {
  buildExpenseCategoryGroups,
  getExpenseCategoryGroupKey,
  getExpenseCategoryGroupLabel,
  INCOME_FILTER_TYPES,
  normalizeExpenseCategoryName,
  normalizeExpenseCategories,
} from '@/constants/financeCategories'

const LIST_STATUS_PRIORITY: Record<string, number> = {
  生病中: 0,
  用药中: 1,
  怀孕中: 2,
  哺乳中: 3,
  发情中: 4,
  正常: 5,
}

function sortListStatuses(statuses: DeriveStatus[] = []) {
  return [...statuses].sort((a, b) => {
    const left = LIST_STATUS_PRIORITY[a.type] ?? 99
    const right = LIST_STATUS_PRIORITY[b.type] ?? 99
    return left - right
  })
}

const LEGACY_LOCAL_INCOME_TYPE_MAP: Record<string, string> = {
  定金: '定金保留',
  领养费: '领养',
  配种费收入: '其他',
}

function startOfDay(ts: number) {
  const offsetMs = 8 * 60 * 60 * 1000
  const sourceTs = Number.isFinite(Number(ts)) ? Number(ts) : Date.now()
  const beijingNow = new Date(sourceTs + offsetMs)
  return Date.UTC(
    beijingNow.getUTCFullYear(),
    beijingNow.getUTCMonth(),
    beijingNow.getUTCDate(),
    0,
    0,
    0,
    0,
  ) - offsetMs
}

function normalizeIllnessLabel(label: unknown) {
  return typeof label === 'string' && label.trim() ? label.trim() : '生病中'
}

function getIllnessPrimaryCondition(source: Record<string, any> = {}) {
  return normalizeIllnessLabel(source.primary_condition || source.condition || '生病中')
}

function buildIllnessRelationType(illnessId: string, activeMedicationTasks: any[]) {
  if (activeMedicationTasks.some(task => task?.source_record_id === illnessId)) return 'linked'
  if (activeMedicationTasks.some(task => !task?.source_record_id)) return 'fallback'
  return 'standalone'
}

function buildListIllnessStatuses(illnesses: any[] = [], activeMedicationTasks: any[] = []): DeriveStatus[] {
  const sortedRecords = [...illnesses].sort((a, b) => (b.updated_at || b.date || b.created_at || 0) - (a.updated_at || a.date || a.created_at || 0))
  const labels: string[] = []
  const seen = new Set<string>()
  let firstRecordId = ''

  for (const illness of sortedRecords) {
    const label = getIllnessPrimaryCondition(illness.details || {})
    if (seen.has(label)) continue
    seen.add(label)
    labels.push(label)
    if (!firstRecordId) firstRecordId = illness._id
  }

  if (!labels.length) return []

  const latest = sortedRecords[0]
  const illnessStartTs = latest?.details?.start_date || latest?.date || latest?.created_at || 0
  const illnessDay = illnessStartTs ? Math.max(1, Math.floor((Date.now() - illnessStartTs) / 86400000) + 1) : null
  const relationType = buildIllnessRelationType(firstRecordId, activeMedicationTasks)
  const meta = [
    ...(relationType === 'standalone' ? [] : [{ icon: 'link', text: relationType === 'linked' ? '已关联用药' : '按当前治疗状态推断关联' }]),
    ...(illnessDay ? [{ icon: 'schedule', text: `第${illnessDay}天` }] : []),
  ]
  const label = labels.length === 1
    ? labels[0]
    : labels.length === 2
      ? `${labels[0]}/${labels[1]}`
      : `${labels[0]}/${labels[1]}等${labels.length}项`

  return [{
    type: '生病中',
    label,
    count: labels.length,
    recordId: firstRecordId,
    relationType,
    activityTs: latest?.updated_at || latest?.date || latest?.created_at || 0,
    meta,
  }]
}

function getMedicationTaskProgress(task: any, nowTs = Date.now()) {
  const startTs = startOfDay(task?.actual_start_date || task?.start_date || task?.created_at || nowTs)
  const todayTs = startOfDay(nowTs)
  const totalDays = Math.max(1, Number(task?.duration_days) || 1)
  const currentDay = Math.floor((todayTs - startTs) / 86400000) + 1

  return {
    currentDay,
    totalDays,
  }
}

function isMedicationTaskActive(task: any, nowTs = Date.now()) {
  if (task?.status !== '进行中') return false
  const { currentDay, totalDays } = getMedicationTaskProgress(task, nowTs)
  return currentDay >= 1 && currentDay <= totalDays
}

function pickPreferredMedicationTask(currentTask: any, nextTask: any) {
  if (!currentTask) return nextTask

  const currentStartTs = currentTask?.actual_start_date || currentTask?.updated_at || currentTask?.created_at || 0
  const nextStartTs = nextTask?.actual_start_date || nextTask?.updated_at || nextTask?.created_at || 0
  if (nextStartTs !== currentStartTs) {
    return nextStartTs > currentStartTs ? nextTask : currentTask
  }

  const currentUpdatedTs = currentTask?.updated_at || currentTask?.created_at || 0
  const nextUpdatedTs = nextTask?.updated_at || nextTask?.created_at || 0
  return nextUpdatedTs > currentUpdatedTs ? nextTask : currentTask
}

function buildMedicationRelationType(task: any, illnesses: any[]) {
  if (task?.source_record_id) return 'linked'
  if (illnesses.length > 0) return 'fallback'
  return 'standalone'
}

function buildListMedicationStatus(tasks: any[] = [], nowTs = Date.now(), activeIllnesses: any[] = []): DeriveStatus[] {
  if (!tasks.length) return []
  const preferredTask = tasks.reduce((currentTask, nextTask) => pickPreferredMedicationTask(currentTask, nextTask), null)
  const { currentDay, totalDays } = getMedicationTaskProgress(preferredTask, nowTs)
  const drugName = preferredTask?.drug_name || preferredTask?.details?.drug_name || '用药'
  const relationType = buildMedicationRelationType(preferredTask, activeIllnesses)

  return [{
    type: '用药中',
    label: '用药中',
    count: tasks.length,
    taskId: preferredTask?._id,
    detail: drugName,
    relationType,
    progress: { current: Math.min(currentDay, totalDays), total: totalDays },
    meta: relationType === 'standalone' ? [] : [{ icon: 'link', text: relationType === 'linked' ? '关联疾病' : '按当前治疗状态推断关联' }],
    activityTs: preferredTask?.updated_at || preferredTask?.created_at || 0,
  }]
}

export async function listLocalDogsWithStatus(familyId: string, filters: Record<string, any> = {}): Promise<DogWithStatus[]> {
  if (!familyId) return []
  const now = Date.now()
  const allowedDispositions = ['在养', '待售', '已预定', '自留']
  const dogDisposition = filters.disposition || null

  const [dogs, cycles, illnesses, medicationTasks, activeLitters] = await Promise.all([
    localDb.query<any>('dogs', (dog) => {
      if (dog.family_id !== familyId) return false
      if (dog.deleted_at) return false
      if (filters.gender && dog.gender !== filters.gender) return false
      if (filters.role && dog.role !== filters.role) return false
      if (dogDisposition) return dog.disposition === dogDisposition
      return allowedDispositions.includes(dog.disposition)
    }),
    localDb.query<any>('breeding_cycles', cycle =>
      cycle.family_id === familyId
      && ['发情中', '怀孕中', '已生产'].includes(cycle.status),
    ),
    localDb.query<any>('health_records', record =>
      record.family_id === familyId
      && record.type === 'illness'
      && record?.details?.treatment_status !== '已康复',
    ),
    localDb.query<any>('medication_tasks', task =>
      task.family_id === familyId
      && isMedicationTaskActive(task, now),
    ),
    localDb.query<any>('litters', litter =>
      litter.family_id === familyId
      && !litter.weaned_at,
    ),
  ])

  const breedingStatusMap = new Map<string, DeriveStatus[]>()
  for (const cycle of cycles) {
    const damId = cycle.dam_id
    if (!damId) continue
    if (cycle.status === '发情中') {
      const startTs = cycle.start_date || cycle.created_at || now
      const day = Math.max(1, Math.floor((now - startTs) / 86400000) + 1)
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
      const daysPassed = Math.max(1, Math.floor((now - startTs) / 86400000))
      breedingStatusMap.set(damId, [{
        type: '怀孕中',
        cycleId: cycle._id,
        progress: { current: Math.min(daysPassed, 63), total: 63 },
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
      const day = Math.max(1, Math.floor((now - startTs) / 86400000) + 1)
      breedingStatusMap.set(damId, [{
        type: '哺乳中',
        cycleId: cycle._id,
        activityTs: latestLitter.updated_at || latestLitter.created_at || 0,
        meta: [{ icon: 'schedule', text: `第${day}天` }],
      }])
    }
  }

  const illnessMap = new Map<string, any[]>()
  for (const illness of illnesses) {
    const bucket = illnessMap.get(illness.dog_id) || []
    bucket.push(illness)
    illnessMap.set(illness.dog_id, bucket)
  }

  const medicationMap = new Map<string, any[]>()
  for (const task of medicationTasks) {
    const bucket = medicationMap.get(task.dog_id) || []
    bucket.push(task)
    medicationMap.set(task.dog_id, bucket)
  }

  return dogs.map((dog) => {
    const statuses = sortListStatuses([
      ...buildListIllnessStatuses(illnessMap.get(dog._id) || [], medicationMap.get(dog._id) || []),
      ...(breedingStatusMap.get(dog._id) || []),
      ...buildListMedicationStatus(medicationMap.get(dog._id) || [], now, illnessMap.get(dog._id) || []),
    ])
    return {
      ...dog,
      statuses: statuses.length > 0 ? statuses : [{ type: '正常' }],
    }
  })
}

export async function listLocalMedicationProtocols(familyId: string): Promise<MedicationProtocol[]> {
  if (!familyId) return []
  const rows = await localDb.query<any>('medication_protocols', row =>
    row.family_id === familyId
    && !row.deleted_at,
    {
      sort: (left, right) => Number(right.updated_at || right.created_at || 0) - Number(left.updated_at || left.created_at || 0),
    },
  )
  return rows as MedicationProtocol[]
}

function sortByRecent(left: Record<string, any>, right: Record<string, any>) {
  return Number(right.updated_at || right.date || right.created_at || 0) - Number(left.updated_at || left.date || left.created_at || 0)
}

function formatLitterProjection(row: Record<string, any>) {
  return {
    ...row,
    damName: row.dam_name,
    litterNumber: row.litter_number,
    birthDate: row.birth_date,
    puppyCount: Array.isArray(row.puppies) && row.puppies.length ? row.puppies.length : Number(row.born_alive || row.total_born || 0),
    aliveCount: Number(row.born_alive || (Array.isArray(row.puppies) ? row.puppies.length : 0) || row.total_born || 0),
    totalCount: Number(row.total_born || row.born_alive || (Array.isArray(row.puppies) ? row.puppies.length : 0) || 0),
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

function buildCycleProjection(row: Record<string, any>) {
  const referenceTs = Number(row.mated_at || row.start_date || row.updated_at || row.created_at || 0)
  const daysPassed = referenceTs ? Math.max(1, Math.floor((Date.now() - referenceTs) / 86400000) + (row.status === '怀孕中' ? 0 : 1)) : 0
  let detail = row.start_date ? formatDate(row.start_date) : `${Number(row.record_count || 0)}条记录`

  if (row.status === '发情中' && row.start_date) {
    detail = `发情第${Math.max(1, Math.floor((Date.now() - Number(row.start_date)) / 86400000) + 1)}天`
  } else if (row.status === '怀孕中' && referenceTs) {
    detail = `怀孕第${daysPassed}天`
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
  const date = new Date(ts)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function listLocalLitters(
  familyId: string,
  options: {
    activeOnly?: boolean
    damId?: string
  } = {},
) {
  if (!familyId) return [] as Array<Litter & ReturnType<typeof formatLitterProjection>>
  const rows = await localDb.query<any>('litters', (row) => {
    if (row.family_id !== familyId) return false
    if (row.deleted_at) return false
    if (options.activeOnly && row.weaned_at) return false
    if (options.damId && row.dam_id !== options.damId) return false
    return true
  }, {
    sort: sortByRecent,
  })
  return rows.map(row => formatLitterProjection(row)) as Array<Litter & ReturnType<typeof formatLitterProjection>>
}

export async function listLocalBreedingCycles(
  familyId: string,
  options: {
    damId?: string
    includeClosed?: boolean
  } = {},
) {
  if (!familyId) return [] as Array<BreedingCycle & ReturnType<typeof buildCycleProjection>>
  const rows = await localDb.query<any>('breeding_cycles', (row) => {
    if (row.family_id !== familyId) return false
    if (row.deleted_at) return false
    if (options.damId && row.dam_id !== options.damId) return false
    if (!options.includeClosed && ['失败', '放弃'].includes(row.status)) return false
    return true
  }, {
    sort: (left, right) => {
      const orderDiff = getCycleStatusOrder(left.status) - getCycleStatusOrder(right.status)
      if (orderDiff !== 0) return orderDiff
      return sortByRecent(left, right)
    },
  })
  return rows.map(row => buildCycleProjection(row)) as Array<BreedingCycle & ReturnType<typeof buildCycleProjection>>
}

export async function getLocalBreedingCycleDetail(familyId: string, cycleId: string): Promise<BreedingCycleDetailResponse | null> {
  if (!familyId || !cycleId) return null
  const [cycle, records, litter, expenses, cycleSiblings, litterSiblings] = await Promise.all([
    localDb.findById<BreedingCycle & { deleted_at?: number | null }>('breeding_cycles', cycleId),
    localDb.query<BreedingRecord & { deleted_at?: number | null }>('breeding_records', row =>
      row.family_id === familyId && row.cycle_id === cycleId && !row.deleted_at,
      { sort: sortByRecent },
    ),
    localDb.query<Litter & { deleted_at?: number | null }>('litters', row =>
      row.family_id === familyId && row.cycle_id === cycleId && !row.deleted_at,
      { sort: sortByRecent },
    ),
    localDb.query<Expense>('expenses', row =>
      row.family_id === familyId && row.linked_cycle_id === cycleId && !row.deleted_at,
      { sort: sortByRecent },
    ),
    localDb.query<any>('breeding_cycles', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<any>('litters', row => row.family_id === familyId && !row.deleted_at),
  ])

  if (!cycle || cycle.family_id !== familyId || cycle.deleted_at) return null
  const numberedCycles = attachCycleNumbers(cycleSiblings)
  const numberedLitters = attachLitterNumbers(litterSiblings)
  const currentCycle = (numberedCycles.find(item => item._id === cycleId) || cycle) as BreedingCycle
  const currentLitter = litter[0]
    ? ((numberedLitters.find(item => item._id === litter[0]._id) || litter[0]) as Litter)
    : null

  return {
    cycle: currentCycle,
    records,
    litter: currentLitter,
    expenses,
  }
}

function getCurrentMonthRange(now = Date.now()) {
  const date = new Date(now)
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime()
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
  return { start, end }
}

export async function getLocalKennelDashboardStats(familyId: string) {
  if (!familyId) {
    return {
      dogs: [] as DogWithStatus[],
      litters: [] as any[],
      sales: [] as any[],
      monthlyIncome: 0,
      monthlyExpense: 0,
    }
  }

  const [activeDogs, soldDogs, litters, sales, expenses, incomes] = await Promise.all([
    listLocalDogsWithStatus(familyId),
    listLocalDogsWithStatus(familyId, { disposition: '已售' }),
    localDb.query<any>('litters', litter => litter.family_id === familyId && !litter.weaned_at),
    localDb.query<any>('sale_records', sale => sale.family_id === familyId && !sale.deleted_at),
    localDb.query<any>('expenses', expense => expense.family_id === familyId && !expense.deleted_at),
    localDb.query<any>('incomes', income => income.family_id === familyId && !income.deleted_at),
  ])
  const monthRange = getCurrentMonthRange()
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
    sales,
    monthlyIncome,
    monthlyExpense,
  }
}

export async function listLocalAgents(familyId: string): Promise<Agent[]> {
  if (!familyId) return []
  return localDb.query<Agent>('agents', row =>
    row.family_id === familyId && !row.deleted_at,
    { sort: sortByRecent },
  )
}

export async function listLocalSales(
  familyId: string,
  filters: {
    status?: string
    dogId?: string
  } = {},
): Promise<SaleRecord[]> {
  if (!familyId) return []
  return localDb.query<SaleRecord>('sale_records', row => {
    if (row.family_id !== familyId) return false
    if (row.deleted_at) return false
    if (filters.status && row.status !== filters.status) return false
    if (filters.dogId && row.dog_id !== filters.dogId) return false
    return true
  }, {
    sort: sortByRecent,
  })
}

function formatDogAgeText(birthTs?: number | null) {
  if (!birthTs) return ''
  const days = Math.floor((Date.now() - birthTs) / 86400000)
  if (days < 30) return `${days}天`
  if (days < 365) return `${Math.floor(days / 30)}月龄`
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  return months > 0 ? `${years}岁${months}月` : `${years}岁`
}

function normalizeSaleMode(mode?: string | null) {
  const normalized = String(mode || '').trim()
  return normalized ? normalized : '自售'
}

function deriveSaleSettlementStatus(sale: Partial<SaleRecord> & Record<string, any>) {
  const normalized = String(sale.settlement_status || '').trim()
  if (normalized === '未结算' || normalized === '部分结算' || normalized === '已结算') return normalized
  if (sale.status === '已成交') {
    return sale.received_amount != null ? '已结算' : '未结算'
  }
  return null
}

function normalizeSaleRecordProjection(
  sale: SaleRecord & Record<string, any>,
  dog?: Record<string, any> | null,
  agent?: Record<string, any> | null,
) {
  return {
    ...sale,
    sale_mode: normalizeSaleMode(sale.sale_mode),
    settlement_status: deriveSaleSettlementStatus(sale),
    agent_name: sale.seller_agent_name || sale.agent_name || agent?.name || null,
    breed: dog?.breed || '马尔济斯',
    sex: dog?.gender || dog?.sex || '',
    age_text: formatDogAgeText(dog?.birth_date),
  }
}

export async function getLocalSaleDetail(familyId: string, saleId: string) {
  if (!familyId || !saleId) return null
  const sale = await localDb.findById<SaleRecord>('sale_records', saleId)
  if (!sale || sale.family_id !== familyId || sale.deleted_at) return null

  const [dog, agent] = await Promise.all([
    sale.dog_id ? localDb.findById<any>('dogs', sale.dog_id) : Promise.resolve(null),
    sale.seller_agent_id ? localDb.findById<any>('agents', sale.seller_agent_id) : Promise.resolve(null),
  ])

  return normalizeSaleRecordProjection(sale as SaleRecord & Record<string, any>, dog, agent)
}

function getCreatorDisplayName(members: Array<Record<string, any>> = [], createdBy?: string | null) {
  if (!createdBy) return ''
  const member = members.find(item => item.user_id === createdBy && item.status === 'active')
  return member?.nickname || createdBy
}

function normalizeIncomeTypeLabel(type?: string | null) {
  const normalized = String(type || '').trim()
  if (!normalized) return '其他'
  const mapped = LEGACY_LOCAL_INCOME_TYPE_MAP[normalized] || normalized
  return INCOME_FILTER_TYPES.includes(mapped as any) ? mapped : '其他'
}

function buildExpenseLinkedRef(expense: Expense & Record<string, any>, linkedDogs: Array<Record<string, any>>) {
  if (expense.linked_litter_id) {
    return expense.dam_name
      ? `${expense.dam_name}${expense.litter_number ? ` · 第${expense.litter_number}窝` : ' · 关联窝'}`
      : '关联窝'
  }
  if (expense.linked_cycle_id) {
    return expense.dam_name ? `${expense.dam_name} · 繁育周期` : '繁育周期'
  }
  if (linkedDogs.length) {
    return linkedDogs.length === 1 ? '单犬记录' : `${linkedDogs.length}只犬分摊`
  }
  return ''
}

export async function getLocalExpenseDetail(familyId: string, expenseId: string) {
  if (!familyId || !expenseId) return null

  const [expense, family] = await Promise.all([
    localDb.findById<Expense>('expenses', expenseId),
    localDb.findById<Family>('families', familyId),
  ])

  if (!expense || expense.family_id !== familyId || expense.deleted_at) return null

  const groups = buildExpenseCategoryGroups(family?.settings?.custom_expense_category_groups || [])
  const categories = normalizeExpenseCategories(family?.settings?.custom_expense_categories || [], groups)
  const linkedDogs = (await Promise.all(
    (expense.linked_dog_ids || []).map((dogId: string) => localDb.findById<any>('dogs', dogId)),
  ))
    .filter((dog): dog is Record<string, any> => !!dog && dog.family_id === familyId && !dog.deleted_at)
    .map(dog => ({ _id: dog._id, name: dog.name }))

  return {
    ...expense,
    category: normalizeExpenseCategoryName(expense.category, categories),
    amount: expense.total_amount || 0,
    source: expense.source_type,
    category_group_label: getExpenseCategoryGroupLabel(
      getExpenseCategoryGroupKey(expense.category, categories),
      groups,
    ),
    created_by_name: getCreatorDisplayName(family?.members || [], expense.created_by),
    linked_dogs: linkedDogs,
    linked_ref: buildExpenseLinkedRef(expense as Expense & Record<string, any>, linkedDogs),
  }
}

export async function getLocalIncomeDetail(familyId: string, incomeId: string) {
  if (!familyId || !incomeId) return null

  const [income, family] = await Promise.all([
    localDb.findById<Income>('incomes', incomeId),
    localDb.findById<Family>('families', familyId),
  ])

  if (!income || income.family_id !== familyId || income.deleted_at) return null

  const typeLabel = normalizeIncomeTypeLabel(income.type)
  return {
    ...income,
    type: typeLabel,
    created_by_name: getCreatorDisplayName(family?.members || [], income.created_by),
    type_label: typeLabel,
    linked_dog_name: income.dog_name || '',
    sale_id: (income as any).source_sale_id || '',
    source: (income as any).source_sale_id ? 'auto' : 'manual',
  }
}

function resolveFinanceDateRange(period: string, month?: number, year?: number) {
  const now = new Date()
  const targetYear = Number(year) || now.getFullYear()
  const targetMonth = Math.max(1, Math.min(12, Number(month) || (now.getMonth() + 1)))

  if (period === 'yearly') {
    return {
      startDate: new Date(targetYear, 0, 1, 0, 0, 0, 0).getTime(),
      endDate: new Date(targetYear + 1, 0, 1, 0, 0, 0, 0).getTime(),
    }
  }

  return {
    startDate: new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0).getTime(),
    endDate: new Date(targetYear, targetMonth, 1, 0, 0, 0, 0).getTime(),
  }
}

export async function getLocalFinancialSummary(
  familyId: string,
  params: {
    period?: string
    month?: number
    year?: number
  } = {},
) {
  if (!familyId) {
    return {
      period: params.period || 'monthly',
      totalExpense: 0,
      totalIncome: 0,
      netProfit: 0,
      categoryBreakdown: {} as Record<string, number>,
      incomeBreakdown: {} as Record<string, number>,
      startDate: 0,
      endDate: 0,
    }
  }

  const period = params.period || 'monthly'
  const { startDate, endDate } = resolveFinanceDateRange(period, params.month, params.year)
  const [family, expenses, incomes] = await Promise.all([
    localDb.findById<Family>('families', familyId),
    localDb.query<Expense>('expenses', row => (
      row.family_id === familyId
      && !row.deleted_at
      && Number(row.date || 0) >= startDate
      && Number(row.date || 0) < endDate
    )),
    localDb.query<Income>('incomes', row => (
      row.family_id === familyId
      && !row.deleted_at
      && Number(row.date || 0) >= startDate
      && Number(row.date || 0) < endDate
    )),
  ])

  const groups = buildExpenseCategoryGroups(family?.settings?.custom_expense_category_groups || [])
  const categories = normalizeExpenseCategories(family?.settings?.custom_expense_categories || [], groups)
  const totalExpense = expenses.reduce((sum, row) => sum + Number(row.total_amount || 0), 0)
  const totalIncome = incomes.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const categoryBreakdown = expenses.reduce<Record<string, number>>((map, row) => {
    const label = getExpenseCategoryGroupLabel(
      getExpenseCategoryGroupKey(row.category, categories),
      groups,
    )
    map[label] = (map[label] || 0) + Number(row.total_amount || 0)
    return map
  }, {})
  const incomeBreakdown = incomes.reduce<Record<string, number>>((map, row) => {
    const label = normalizeIncomeTypeLabel(row.type)
    map[label] = (map[label] || 0) + Number(row.amount || 0)
    return map
  }, {})

  return {
    period,
    startDate,
    endDate,
    totalExpense,
    totalIncome,
    netProfit: totalIncome - totalExpense,
    categoryBreakdown,
    incomeBreakdown,
  }
}

export async function getLocalProjectionParams(familyId: string) {
  if (!familyId) {
    return {
      activeDams: 0,
      littersPerYear: 1,
      avgIncomePerLitter: 0,
      avgCostPerLitter: 0,
      monthlySharedCost: 0,
    }
  }

  const now = Date.now()
  const last180Days = now - (180 * 86400000)
  const [dogs, litters, expenses] = await Promise.all([
    localDb.query<any>('dogs', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<Litter>('litters', row => row.family_id === familyId),
    localDb.query<Expense>('expenses', row => (
      row.family_id === familyId
      && !row.deleted_at
      && Number(row.date || 0) >= last180Days
    )),
  ])

  const activeDams = dogs.filter(dog =>
    dog.role === '种狗'
    && dog.gender === '母'
    && !['已故', '已领养', '已赠送', '已退休'].includes(dog.disposition),
  ).length

  const littersByYear = litters.reduce<Record<string, number>>((map, litter) => {
    const year = new Date(litter.birth_date || litter.created_at || now).getFullYear()
    map[String(year)] = (map[String(year)] || 0) + 1
    return map
  }, {})
  const yearlyCounts = Object.values(littersByYear)
  const littersPerYear = yearlyCounts.length
    ? Math.round((yearlyCounts.reduce((sum, count) => sum + count, 0) / yearlyCounts.length) * 10) / 10
    : Math.max(activeDams, 1)

  let avgIncomePerLitter = 0
  let avgCostPerLitter = 0
  if (litters.length > 0) {
    const litterDetails = await Promise.all(litters.map(litter => getLocalLitterDetail(familyId, litter._id)))
    const totals = litterDetails.reduce((sum, detail) => {
      sum.income += Number(detail?.litter?.income || 0)
      sum.cost += Number(detail?.litter?.expense || 0)
      return sum
    }, { income: 0, cost: 0 })
    avgIncomePerLitter = Math.round(totals.income / litters.length)
    avgCostPerLitter = Math.round(totals.cost / litters.length)
  }

  const sharedExpenses = expenses.filter((expense) => {
    const hasScopedLink = expense.linked_cycle_id || expense.linked_litter_id
    const hasDogLink = Array.isArray(expense.linked_dog_ids) && expense.linked_dog_ids.length > 0
    return !hasScopedLink && !hasDogLink
  })
  const monthlySharedCost = sharedExpenses.length
    ? Math.round(sharedExpenses.reduce((sum, expense) => sum + Number(expense.total_amount || 0), 0) / 6)
    : 0

  return {
    activeDams,
    littersPerYear,
    avgIncomePerLitter,
    avgCostPerLitter,
    monthlySharedCost,
  }
}

function getMedicationDetailStatus(status?: string) {
  if (status === '已完成' || status === 'completed') return 'completed'
  if (status === '已取消' || status === 'cancelled') return 'cancelled'
  return 'active'
}

function calculateMedicationCompletion(task: Record<string, any>) {
  const durationDays = Math.max(1, Number(task?.duration_days) || 1)
  const frequency = Math.max(1, Number(task?.frequency) || 1)
  const dailyDoses = task?.daily_doses || {}
  let completedDoseCount = 0

  for (let day = 1; day <= durationDays; day += 1) {
    completedDoseCount += Math.min(Number(dailyDoses[String(day)]) || 0, frequency)
  }

  return {
    completedDoseCount,
    totalDoseCount: durationDays * frequency,
  }
}

function normalizeMedicationTaskDetail(task: Record<string, any>, protocolName: string | null) {
  const durationDays = Math.max(1, Number(task?.duration_days) || 1)
  const startDate = startOfDay(task?.actual_start_date || task?.start_date || task?.created_at || Date.now())
  const endDate = task?.end_date || (startDate + ((durationDays - 1) * 86400000))
  const frequency = Math.max(1, Number(task?.frequency) || 1)
  const completion = calculateMedicationCompletion(task)
  const completedDateSet = new Set<number>()
  const completedMap: Record<string, { name: string; time: string }> = {}

  if (Array.isArray(task?.completed_dates)) {
    task.completed_dates.forEach((item: unknown) => {
      if (typeof item !== 'number') return
      completedDateSet.add(startOfDay(item))
    })
  }

  const dailyDoses = task?.daily_doses || {}
  Object.entries(dailyDoses).forEach(([dayKey, rawValue]) => {
    const dayNum = Number(dayKey)
    const dosesGiven = Number(rawValue) || 0
    if (!dayNum || dosesGiven < frequency) return
    const dayTs = startDate + ((dayNum - 1) * 86400000)
    completedDateSet.add(dayTs)
    completedMap[String(dayTs)] = {
      name: `已完成${Math.min(dosesGiven, frequency)}/${frequency}次`,
      time: '',
    }
  })

  if (task?.completed_map && typeof task.completed_map === 'object') {
    Object.entries(task.completed_map).forEach(([key, value]) => {
      const dayTs = Number(key)
      if (!dayTs || !value || typeof value !== 'object') return
      const valueObject = value as Record<string, any>
      completedMap[String(dayTs)] = {
        name: valueObject.name || valueObject.label || '',
        time: valueObject.time || '',
      }
    })
  }

  return {
    ...task,
    source_record_id: typeof task?.source_record_id === 'string' && task.source_record_id.trim()
      ? task.source_record_id.trim()
      : null,
    start_date: startDate,
    end_date: endDate,
    status: getMedicationDetailStatus(task?.status),
    completed_dates: Array.from(completedDateSet).sort((a, b) => a - b),
    completed_map: completedMap,
    completed_dose_count: completion.completedDoseCount,
    total_dose_count: completion.totalDoseCount,
    is_fully_completed: completion.completedDoseCount >= completion.totalDoseCount,
    protocol_name: protocolName || task?.protocol_name || null,
  } as Record<string, any>
}

function normalizeIllnessSymptomTags(tags: unknown) {
  if (!Array.isArray(tags)) return []
  return Array.from(new Set(tags
    .map(item => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean)))
}

function isActiveIllnessRecord(record: Record<string, any>) {
  return record?.type === 'illness'
    && !record?.deleted_at
    && (record?.details?.treatment_status || '观察中') !== '已康复'
}

function buildLinkedIllnessSummary(record?: Record<string, any> | null) {
  if (!record) return null
  const symptomTags = normalizeIllnessSymptomTags(record?.details?.symptom_tags)
  return {
    recordId: record._id,
    title: getIllnessPrimaryCondition(record?.details || record),
    treatmentStatus: record?.details?.treatment_status || '观察中',
    symptomSummary: symptomTags.join(' / '),
    date: Number(record?.date || 0) || null,
  }
}

function buildLinkedMedicationTaskSummary(task: Record<string, any>) {
  const normalized = normalizeMedicationTaskDetail(task, null)
  return {
    taskId: normalized._id,
    medicationName: normalized.drug_name || normalized.details?.drug_name || '用药任务',
    status: normalized.status,
    startedAt: normalized.start_date,
    endedAt: normalized.status === 'completed' ? normalized.end_date : null,
    todayCompleted: normalized.completed_dates.includes(startOfDay(Date.now())),
  }
}

function attachCycleNumbers(cycles: Array<Record<string, any>>) {
  const groups = new Map<string, Array<Record<string, any>>>()
  cycles.forEach((cycle) => {
    const key = cycle.dam_id || '__unknown__'
    const bucket = groups.get(key) || []
    bucket.push(cycle)
    groups.set(key, bucket)
  })

  groups.forEach((bucket) => {
    bucket
      .sort((left, right) => Number(left.start_date || left.created_at || 0) - Number(right.start_date || right.created_at || 0))
      .forEach((cycle, index) => {
        cycle.cycle_number = index + 1
      })
  })

  return cycles
}

function attachLitterNumbers(litters: Array<Record<string, any>>) {
  const groups = new Map<string, Array<Record<string, any>>>()
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

export async function getLocalBreedingRecordDetail(familyId: string, recordId: string) {
  if (!familyId || !recordId) return null
  const [record, tasks, dog] = await Promise.all([
    localDb.findById<BreedingRecord>('breeding_records', recordId),
    localDb.query<any>('tasks', row =>
      row.family_id === familyId
      && row.type === 'breeding_extra_arrangement'
      && row.source_record_id === recordId
      && row.status === 'pending',
      { sort: sortByRecent },
    ),
    localDb.query<any>('dogs', row => row.family_id === familyId && !row.deleted_at),
  ])
  if (!record || record.family_id !== familyId) return null
  const dogMap = new Map(dog.map(item => [item._id, item]))
  return {
    ...record,
    dog_name: (record as any).dog_name || dogMap.get(record.dog_id)?.name || '',
    extra_arrangement: tasks[0]
      ? {
        task_id: tasks[0]._id,
        kind: tasks[0].details?.kind || null,
        due_date: tasks[0].due_date || null,
        notes: tasks[0].details?.notes || null,
        anchor_type: tasks[0].details?.anchor_type || 'cycle',
      }
      : null,
  }
}

export async function getLocalHealthRecordDetail(familyId: string, recordId: string) {
  if (!familyId || !recordId) return null
  const [record, dogs, medicationTasks] = await Promise.all([
    localDb.findById<HealthRecord>('health_records', recordId),
    localDb.query<any>('dogs', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<any>('medication_tasks', row =>
      row.family_id === familyId && row.source_record_id === recordId,
      { sort: sortByRecent },
    ),
  ])
  if (!record || record.family_id !== familyId) return null
  const dogMap = new Map(dogs.map(item => [item._id, item]))
  return {
    ...record,
    dog_name: record.dog_name || dogMap.get(record.dog_id)?.name || '',
    linkedMedicationTasks: record.type === 'illness'
      ? medicationTasks.map(buildLinkedMedicationTaskSummary)
      : [],
  }
}

export async function getLocalMedicationTaskDetail(familyId: string, taskId: string) {
  if (!familyId || !taskId) return null
  const [task, protocols, illnesses] = await Promise.all([
    localDb.findById<MedicationTask>('medication_tasks', taskId),
    localDb.query<any>('medication_protocols', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<any>('health_records', row => row.family_id === familyId && row.type === 'illness' && !row.deleted_at),
  ])
  if (!task || task.family_id !== familyId) return null
  const protocolName = protocols.find(item => item._id === (task as any).protocol_id)?.name || null
  const normalizedTask = normalizeMedicationTaskDetail(task as Record<string, any>, protocolName)

  let linkedIllness = null
  let relationType: 'linked' | 'fallback' | 'standalone' = normalizedTask.source_record_id ? 'linked' : 'standalone'
  if (normalizedTask.source_record_id) {
    linkedIllness = buildLinkedIllnessSummary(illnesses.find(item => item._id === normalizedTask.source_record_id) || null)
  } else {
    const fallback = illnesses
      .filter(item => item.dog_id === task.dog_id)
      .filter(isActiveIllnessRecord)
      .sort(sortByRecent)[0]
    if (fallback) relationType = 'fallback'
  }

  return {
    ...normalizedTask,
    linkedIllness,
    relationType,
  }
}

export async function getLocalLitterDetail(familyId: string, litterId: string) {
  if (!familyId || !litterId) return null
  const [litter, puppies, weights, expenses, incomes] = await Promise.all([
    localDb.findById<Litter>('litters', litterId),
    localDb.query<any>('dogs', row => row.family_id === familyId && row.origin_litter_id === litterId && !row.deleted_at),
    localDb.query<any>('dog_weights', row => row.family_id === familyId && !!row.dog_id),
    localDb.query<any>('expenses', row => row.family_id === familyId && !row.deleted_at),
    localDb.query<any>('incomes', row => row.family_id === familyId && !row.deleted_at),
  ])
  if (!litter || litter.family_id !== familyId) return null

  const numberedLitters = attachLitterNumbers([litter])
  const puppyIds = puppies.map(item => item._id)
  const weightMap = new Map<string, Array<Record<string, any>>>()
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
    .filter(item => puppyIds.includes(item.dog_id))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)

  return {
    litter: {
      ...numberedLitters[0],
      expense: expenseTotal,
      income: incomeTotal,
    },
    puppies: normalizedPuppies,
  }
}

async function getLocalFamilyRow(familyId: string): Promise<Family | null> {
  if (!familyId) return null
  const family = await localDb.findById<Family>('families', familyId)
  return family && family._id === familyId ? family : null
}

export async function getLocalFamilySettings(familyId: string): Promise<FamilySettings | null> {
  const family = await getLocalFamilyRow(familyId)
  return family?.settings || null
}

export async function listLocalCareRules(familyId: string): Promise<CareRule[]> {
  const family = await getLocalFamilyRow(familyId)
  return [...(family?.care_rules || [])]
}

export async function getLocalExpenseCategoryGroups(familyId: string): Promise<ExpenseCategoryGroup[]> {
  const settings = await getLocalFamilySettings(familyId)
  return buildExpenseCategoryGroups(settings?.custom_expense_category_groups || []) as ExpenseCategoryGroup[]
}

export async function getLocalExpenseCategories(familyId: string): Promise<ExpenseCategory[]> {
  const settings = await getLocalFamilySettings(familyId)
  const groups = await getLocalExpenseCategoryGroups(familyId)
  return normalizeExpenseCategories(settings?.custom_expense_categories || [], groups) as ExpenseCategory[]
}

function buildRecycleSummary(type: RecycleBinItem['type'], row: Record<string, any>) {
  if (type === 'dog') {
    const role = row.role ? ` · ${row.role}` : ''
    return `${row.gender || '未知性别'}${role}`
  }
  if (type === 'expense') {
    return row.category ? `${row.category} · ¥${Number(row.total_amount || 0)}` : `¥${Number(row.total_amount || 0)}`
  }
  if (type === 'income') {
    return row.type ? `${row.type} · ¥${Number(row.amount || 0)}` : `¥${Number(row.amount || 0)}`
  }
  if (type === 'agent') {
    return row.contact_info || row.phone || row.wechat || ''
  }
  if (type === 'medication_protocol') {
    return row.drug_name || row.notes || ''
  }
  return ''
}

function buildRecycleItem(type: RecycleBinItem['type'], row: Record<string, any>): RecycleBinItem {
  const deletedAt = Number(row.deleted_at || 0)
  return {
    _id: row._id,
    type,
    type_label: ({
      dog: '犬只',
      expense: '支出',
      income: '收入',
      agent: '代理人',
      medication_protocol: '用药方案',
    } as Record<RecycleBinItem['type'], string>)[type],
    name: String(
      row.name
      || row.dog_name
      || row.title
      || row.protocol_name
      || row.drug_name
      || '未命名',
    ),
    summary: buildRecycleSummary(type, row),
    deleted_at: deletedAt,
    days_remaining: Math.max(0, 30 - Math.floor((Date.now() - deletedAt) / 86400000)),
  }
}

export async function listLocalRecycleItems(familyId: string): Promise<RecycleBinItem[]> {
  if (!familyId) return []
  const [dogs, expenses, incomes, agents, protocols] = await Promise.all([
    localDb.query<any>('dogs', row => row.family_id === familyId && !!row.deleted_at),
    localDb.query<any>('expenses', row => row.family_id === familyId && !!row.deleted_at),
    localDb.query<any>('incomes', row => row.family_id === familyId && !!row.deleted_at),
    localDb.query<any>('agents', row => row.family_id === familyId && !!row.deleted_at),
    localDb.query<any>('medication_protocols', row => row.family_id === familyId && !!row.deleted_at),
  ])

  return [
    ...dogs.map(row => buildRecycleItem('dog', row)),
    ...expenses.map(row => buildRecycleItem('expense', row)),
    ...incomes.map(row => buildRecycleItem('income', row)),
    ...agents.map(row => buildRecycleItem('agent', row)),
    ...protocols.map(row => buildRecycleItem('medication_protocol', row)),
  ].sort((left, right) => right.deleted_at - left.deleted_at)
}
