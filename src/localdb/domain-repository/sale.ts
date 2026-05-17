import { localDb } from '@/localdb/db'
import type { LocalRowOf } from '@/localdb/types'
import type { Agent, SaleRecord } from '@/types/finance'
import type { DogWithStatus } from '@/types/dog'
import { getBeijingOrdinalDay } from '@/utils/date'
import {
  buildLatestRestartSaleIds,
  canDogEnterSaleFlow,
  canRestartSaleRecord,
  deriveSaleSettlementStatus,
  normalizeSaleMode,
} from '@/localdb/domain-services/sale'
import { listLocalDogsWithStatus } from './dogs'
import { sortByRecent } from './shared'

type DogRow = LocalRowOf<'dogs'> & {
  sex?: string | null
}

type AgentRow = LocalRowOf<'agents'>
type SaleRow = LocalRowOf<'sale_records'>

type SaleProjectionSource = SaleRow & {
  agent_name?: string | null
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
  const sales = await localDb.query<SaleRecord>('sale_records', row => {
    if (row.family_id !== familyId) return false
    if (row.deleted_at) return false
    if (filters.status && row.status !== filters.status) return false
    if (filters.dogId && row.dog_id !== filters.dogId) return false
    return true
  }, {
    sort: sortByRecent,
  })
  const dogIds = [...new Set(sales.map(row => row.dog_id).filter(Boolean))]
  const agentIds = [...new Set(sales.map(row => row.seller_agent_id).filter(Boolean))]
  const [dogs, agents, activeSales, cancelledSales] = await Promise.all([
    dogIds.length
      ? localDb.query<DogRow>('dogs', row => row.family_id === familyId && dogIds.includes(row._id))
      : Promise.resolve([]),
    agentIds.length
      ? localDb.query<AgentRow>('agents', row => row.family_id === familyId && agentIds.includes(row._id) && !row.deleted_at)
      : Promise.resolve([]),
    dogIds.length
      ? localDb.query<SaleRow>('sale_records', row =>
          row.family_id === familyId
          && dogIds.includes(row.dog_id)
          && !row.deleted_at
          && ['待售', '已预定'].includes(String(row.status || '')),
        )
      : Promise.resolve([]),
    dogIds.length
      ? localDb.query<SaleRecord>('sale_records', row =>
          row.family_id === familyId
          && dogIds.includes(row.dog_id)
          && !row.deleted_at
          && row.status === '定金取消',
        )
      : Promise.resolve([]),
  ])
  const dogById = new Map(dogs.map(row => [row._id, row]))
  const agentById = new Map(agents.map(row => [row._id, row]))
  const activeSaleDogIds = new Set(activeSales.map(row => row.dog_id).filter(Boolean))
  const latestRestartSaleIds = buildLatestRestartSaleIds(cancelledSales)
  return sales.map(sale => normalizeSaleRecordProjection(
    sale,
    dogById.get(sale.dog_id),
    sale.seller_agent_id ? agentById.get(sale.seller_agent_id) : null,
    activeSaleDogIds,
    latestRestartSaleIds,
  ))
}

export async function listLocalSaleCandidateDogs(familyId: string): Promise<DogWithStatus[]> {
  if (!familyId) return []
  const [dogs, activeSales] = await Promise.all([
    listLocalDogsWithStatus(familyId),
    localDb.query<SaleRow>('sale_records', row =>
      row.family_id === familyId
      && !row.deleted_at
      && ['待售', '已预定'].includes(String(row.status || '')),
    ),
  ])
  const activeSaleDogIds = new Set(activeSales.map(row => row.dog_id).filter(Boolean))
  return dogs.filter(dog =>
    canDogEnterSaleFlow(dog)
    && !activeSaleDogIds.has(dog._id),
  )
}

function formatDogAgeText(birthTs?: number | null) {
  if (!birthTs) return ''
  const days = getBeijingOrdinalDay(birthTs) || 1
  if (days < 30) return `${days}天`
  if (days < 365) return `${Math.floor(days / 30)}月龄`
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  return months > 0 ? `${years}岁${months}月` : `${years}岁`
}

function normalizeSaleRecordProjection(
  sale: SaleProjectionSource,
  dog?: DogRow | null,
  agent?: AgentRow | null,
  activeSaleDogIds = new Set<string>(),
  latestRestartSaleIds = new Set<string>(),
) {
  return {
    ...sale,
    sale_mode: normalizeSaleMode(sale.sale_mode),
    settlement_status: deriveSaleSettlementStatus(sale),
    agent_name: sale.seller_agent_name || sale.agent_name || agent?.name || null,
    breed: dog?.breed || '马尔济斯',
    sex: dog?.gender || dog?.sex || '',
    age_text: formatDogAgeText(dog?.birth_date),
    can_restart_sale: canRestartSaleRecord(sale, dog, activeSaleDogIds, latestRestartSaleIds),
  }
}

export async function getLocalSaleDetail(familyId: string, saleId: string) {
  if (!familyId || !saleId) return null
  const sale = await localDb.findById<SaleRecord>('sale_records', saleId)
  if (!sale || sale.family_id !== familyId || sale.deleted_at) return null

  const [dog, agent, activeSales, cancelledSales] = await Promise.all([
    sale.dog_id ? localDb.findById<DogRow>('dogs', sale.dog_id) : Promise.resolve(null),
    sale.seller_agent_id ? localDb.findById<AgentRow>('agents', sale.seller_agent_id) : Promise.resolve(null),
    sale.dog_id
      ? localDb.query<SaleRow>('sale_records', row =>
          row.family_id === familyId
          && row.dog_id === sale.dog_id
          && !row.deleted_at
          && ['待售', '已预定'].includes(String(row.status || '')),
        )
      : Promise.resolve([]),
    sale.dog_id
      ? localDb.query<SaleRecord>('sale_records', row =>
          row.family_id === familyId
          && row.dog_id === sale.dog_id
          && !row.deleted_at
          && row.status === '定金取消',
        )
      : Promise.resolve([]),
  ])
  const activeSaleDogIds = new Set(activeSales.map(row => row.dog_id).filter(Boolean))
  const latestRestartSaleIds = buildLatestRestartSaleIds(cancelledSales)

  return normalizeSaleRecordProjection(sale, dog, agent, activeSaleDogIds, latestRestartSaleIds)
}
