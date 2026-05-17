import type { SaleRecord } from '@/types/finance'

type SaleDogLike = {
  role?: string | null
  disposition?: string | null
}

export function normalizeSaleMode(mode?: string | null): SaleRecord['sale_mode'] {
  const normalized = String(mode || '').trim()
  return normalized === '代理' || normalized === '代卖' || normalized === '自售' ? normalized : null
}

export function canDogEnterSaleFlow(dog?: SaleDogLike | null) {
  return dog?.role === '幼崽' && ['在养', '自留', '待售'].includes(String(dog.disposition || ''))
}

function getSaleRestartActivityTs(sale: Partial<SaleRecord>) {
  return Number(sale.refund_date || sale.updated_at || sale.date || sale.created_at || 0)
}

function compareRestartSale(left: Partial<SaleRecord>, right: Partial<SaleRecord>) {
  const tsDiff = getSaleRestartActivityTs(left) - getSaleRestartActivityTs(right)
  if (tsDiff !== 0) return tsDiff
  return String(left._id || '').localeCompare(String(right._id || ''))
}

export function buildLatestRestartSaleIds(cancelledSales: SaleRecord[] = []) {
  const latestByDog = new Map<string, SaleRecord>()
  for (const sale of cancelledSales) {
    if (sale.status !== '定金取消' || !sale.dog_id || !sale._id) continue
    const existing = latestByDog.get(sale.dog_id)
    if (!existing || compareRestartSale(sale, existing) > 0) {
      latestByDog.set(sale.dog_id, sale)
    }
  }
  return new Set([...latestByDog.values()].map(sale => sale._id))
}

export function canRestartSaleRecord(
  sale: SaleRecord,
  dog?: SaleDogLike | null,
  activeSaleDogIds = new Set<string>(),
  latestRestartSaleIds = new Set<string>(),
) {
  return sale.status === '定金取消'
    && canDogEnterSaleFlow(dog)
    && !activeSaleDogIds.has(sale.dog_id)
    && latestRestartSaleIds.has(sale._id)
}

export function deriveSaleSettlementStatus(sale: Partial<SaleRecord>): SaleRecord['settlement_status'] {
  const normalized = String(sale.settlement_status || '').trim()
  if (normalized === '未结算' || normalized === '部分结算' || normalized === '已结算') return normalized
  if (sale.status === '已成交') {
    return sale.received_amount != null ? '已结算' : '未结算'
  }
  return null
}
