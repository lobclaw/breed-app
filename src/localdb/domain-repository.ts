import { localDb } from '@/localdb/db'
import type { MedicationProtocol } from '@/stores/protocolStore'
import type { BreedingCycle, BreedingCycleDetailResponse, BreedingRecord, Litter } from '@/types/breeding'
import type { Agent, Expense, ExpenseCategory, ExpenseCategoryGroup, Income, SaleRecord } from '@/types/finance'
import type { CareRule, Family, FamilySettings } from '@/types/family'
import type { RecycleBinItem } from '@/types/recycle'
import type { DeriveStatus, DogWithStatus } from '@/types/dog'
import {
  buildExpenseCategoryGroups,
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
  const [cycle, records, litter, expenses] = await Promise.all([
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
  ])

  if (!cycle || cycle.family_id !== familyId || cycle.deleted_at) return null

  return {
    cycle,
    records,
    litter: litter[0] || null,
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
