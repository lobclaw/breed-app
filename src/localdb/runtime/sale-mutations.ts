import { localDb } from '@/localdb/db'
import { createClientMutationId, createStableEntityId } from '@/localdb/id'
import { LOCAL_MUTATION_TYPES, type LocalMutationPayload, type LocalMutationType } from '@/localdb/mutation-registry'
import { findLocal as findLocalRow } from '@/localdb/repository'
import { buildLocalAck, buildSyncMeta, getFamilyId, getNow } from '@/localdb/runtime/mutation-helpers'
import type { BusinessCollectionName, LocalRowOf, SyncMetadata } from '@/localdb/types'

type SaleIncomeRow = LocalRowOf<'incomes'> & {
  source_sale_id?: string | null
  source_type?: string | null
  source_record_id?: string | null
}

export interface RuntimeMutationContext {
  enqueueMutation(
    type: LocalMutationType,
    familyId: string,
    payload: LocalMutationPayload,
    collectionScope: BusinessCollectionName[],
    syncMeta: SyncMetadata,
    logSnapshot?: Record<string, unknown>,
  ): Promise<void>
}

type SaleModeValue = '自售' | '代理' | '代卖' | null

export interface CreateSaleRecordPayload {
  dog_id?: string
  dogId?: string
  sale_mode?: SaleModeValue
  saleMode?: SaleModeValue
  floor_price?: number | string | null
  buyer_info?: string | null
  notes?: string | null
}

export interface UpdateSaleModePayload {
  sale_mode?: SaleModeValue
  saleMode?: SaleModeValue
}

export interface ReceiveSaleDepositPayload extends UpdateSaleModePayload {
  deposit_amount?: number | string | null
  deposit_date?: number | string | null
  agreed_price?: number | string | null
  buyer_info?: string | null
  seller_agent_id?: string | null
  seller_agent_name?: string | null
  agent_id?: string | null
  agent_name?: string | null
  platform?: string | null
}

export interface CompleteSalePayload extends UpdateSaleModePayload {
  received_amount?: number | string | null
  date?: number | string | null
  agreed_price?: number | string | null
  delivery_date?: number | string | null
  seller_agent_id?: string | null
  seller_agent_name?: string | null
  agent_id?: string | null
  agent_name?: string | null
  platform?: string | null
  buyer_info?: string | null
}

export interface SettleSalePayload {
  received_amount?: number | string | null
  date?: number | string | null
  agreed_price?: number | string | null
  settlement_status?: '未结算' | '部分结算' | '已结算' | string | null
}

export interface CancelSalePayload {
  refund_amount?: number | string | null
  refund_reason?: string | null
  refund_date?: number | string | null
  deposit_kept_amount?: number | string | null
}

function hasOwnField(data: object, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key)
}

function parseSaleModePatch(data: UpdateSaleModePayload): { provided: boolean; value: SaleModeValue } {
  const hasSnakeKey = hasOwnField(data, 'sale_mode')
  const hasCamelKey = hasOwnField(data, 'saleMode')
  if (!hasSnakeKey && !hasCamelKey) return { provided: false, value: null }

  const raw = hasSnakeKey ? data.sale_mode : data.saleMode
  if (raw == null) return { provided: true, value: null }
  const mode = String(raw).trim()
  if (!mode || mode === '待定') return { provided: true, value: null }
  if (mode === '自售' || mode === '代理' || mode === '代卖') {
    return { provided: true, value: mode }
  }
  throw new Error('销售方式不合法')
}

export async function createSaleRecordLocally(ctx: RuntimeMutationContext, familyIdInput: string, data: CreateSaleRecordPayload) {
  const familyId = getFamilyId(familyIdInput)
  const dogId = String(data.dog_id || data.dogId || '').trim()
  if (!dogId) throw new Error('请选择犬只')
  const saleModePatch = parseSaleModePatch(data)

  const dog = await findLocalRow('dogs', dogId)
  if (!dog || dog.family_id !== familyId || dog.deleted_at) throw new Error('犬只未同步到本地，请联网刷新一次')
  if (dog.role !== '幼崽') throw new Error('只有幼崽可以开始销售')
  if (!['在养', '自留', '待售'].includes(String(dog.disposition || ''))) throw new Error('当前犬只状态不可开始销售')

  const activeSale = await localDb.query('sale_records', row =>
    row.family_id === familyId
    && row.dog_id === dogId
    && !row.deleted_at
    && ['待售', '已预定'].includes(String(row.status || '')),
  )
  if (activeSale.length > 0) throw new Error('该犬只已有进行中的销售记录')

  const now = getNow()
  const saleId = createStableEntityId('sale_record')
  const sale = {
    _id: saleId,
    dog_id: dogId,
    dog_name: dog.name || '',
    family_id: familyId,
    status: '待售',
    sale_mode: saleModePatch.value,
    settlement_status: null,
    floor_price: data.floor_price ?? null,
    deposit_amount: null,
    deposit_date: null,
    agreed_price: null,
    received_amount: null,
    seller_agent_id: null,
    seller_agent_name: null,
    platform: null,
    date: null,
    delivery_date: null,
    buyer_info: data.buyer_info || null,
    refund_amount: null,
    refund_reason: null,
    refund_date: null,
    deposit_kept_amount: null,
    notes: data.notes || null,
    created_by: '',
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
  }
  const syncMeta = buildSyncMeta({ [dogId]: Number(dog.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.CREATE_SALE_RECORD),
    clientEntityIds: { sale_records: saleId },
  })

  await localDb.transactRows(['sale_records', 'dogs'] as const, async (rows) => {
    await rows.upsertRow('sale_records', sale as LocalRowOf<'sale_records'>)
    await rows.updateRow('dogs', dogId, row => ({
      ...row,
      disposition: '待售',
      disposition_date: now,
      updated_at: now,
    } as LocalRowOf<'dogs'>))
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.CREATE_SALE_RECORD,
    familyId,
    { ...data, dog_id: dogId, _sync: syncMeta },
    ['sale_records', 'dogs'],
    syncMeta,
    { dogName: dog.name },
  )
  return {
    data: { saleId },
    ...buildLocalAck(syncMeta, [
      { collection: 'sale_records', id: saleId, version: 0, updatedAt: now },
      { collection: 'dogs', id: dogId, version: Number(dog.version || 0), updatedAt: now },
    ]),
  }
}

export async function updateSaleModeLocally(ctx: RuntimeMutationContext, familyIdInput: string, saleId: string, data: UpdateSaleModePayload) {
  const familyId = getFamilyId(familyIdInput)
  const sale = await findLocalRow('sale_records', saleId)
  if (!sale || sale.family_id !== familyId || sale.deleted_at) throw new Error('记录不存在')
  if (!['待售', '已预定', '已成交'].includes(String(sale.status || ''))) {
    throw new Error('当前状态不可修改销售方式')
  }
  const saleModePatch = parseSaleModePatch(data)
  if (!saleModePatch.provided) throw new Error('请选择销售方式')

  const now = getNow()
  const syncMeta = buildSyncMeta({ [saleId]: Number(sale.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_SALE_MODE),
  })

  await localDb.transactRows('sale_records', async (rows) => {
    await rows.updateRow(saleId, row => ({
      ...row,
      sale_mode: saleModePatch.value,
      updated_at: now,
      _local_pending: true,
    } as LocalRowOf<'sale_records'>))
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.UPDATE_SALE_MODE,
    familyId,
    { id: saleId, saleId, sale_mode: saleModePatch.value, _sync: syncMeta },
    ['sale_records'],
    syncMeta,
  )
  return {
    message: '已修改销售方式',
    ...buildLocalAck(syncMeta, [
      { collection: 'sale_records', id: saleId, version: Number(sale.version || 0), updatedAt: now },
    ]),
  }
}

export async function receiveSaleDepositLocally(ctx: RuntimeMutationContext, familyIdInput: string, saleId: string, data: ReceiveSaleDepositPayload) {
  const familyId = getFamilyId(familyIdInput)
  const sale = await findLocalRow('sale_records', saleId)
  if (!sale || sale.family_id !== familyId || sale.deleted_at) throw new Error('记录不存在')
  if (sale.status !== '待售') throw new Error('只有待售状态可以收定金')
  const dog = await findLocalRow('dogs', sale.dog_id)
  if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')
  const amount = Number(data.deposit_amount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('请填写定金金额')
  const saleModePatch = parseSaleModePatch(data)

  const now = getNow()
  const baseVersions = {
    [saleId]: Number(sale.version || 0),
    [sale.dog_id]: Number(dog.version || 0),
  }
  const syncMeta = buildSyncMeta(baseVersions, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.RECEIVE_SALE_DEPOSIT),
  })

  await localDb.transactRows(['sale_records', 'dogs'] as const, async (rows) => {
    await rows.updateRow('sale_records', saleId, row => ({
      ...row,
      status: '已预定',
      ...(saleModePatch.provided ? { sale_mode: saleModePatch.value } : {}),
      deposit_amount: amount,
      deposit_date: data.deposit_date || now,
      agreed_price: data.agreed_price ?? null,
      buyer_info: data.buyer_info || row.buyer_info || null,
      seller_agent_id: data.seller_agent_id || data.agent_id || null,
      seller_agent_name: data.seller_agent_name || data.agent_name || row.seller_agent_name || null,
      platform: data.platform || null,
      updated_at: now,
      _local_pending: true,
    } as LocalRowOf<'sale_records'>))
    await rows.updateRow('dogs', sale.dog_id, row => ({
      ...row,
      disposition: '已预定',
      updated_at: now,
    } as LocalRowOf<'dogs'>))
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.RECEIVE_SALE_DEPOSIT,
    familyId,
    { id: saleId, saleId, ...data, _sync: syncMeta },
    ['sale_records', 'dogs'],
    syncMeta,
  )
  return {
    message: '已收定金',
    ...buildLocalAck(syncMeta, [
      { collection: 'sale_records', id: saleId, version: Number(sale.version || 0), updatedAt: now },
      { collection: 'dogs', id: sale.dog_id, version: Number(dog.version || 0), updatedAt: now },
    ]),
  }
}

export async function completeSaleLocally(ctx: RuntimeMutationContext, familyIdInput: string, saleId: string, data: CompleteSalePayload) {
  const familyId = getFamilyId(familyIdInput)
  const sale = await findLocalRow('sale_records', saleId)
  if (!sale || sale.family_id !== familyId || sale.deleted_at) throw new Error('记录不存在')
  if (!['待售', '已预定'].includes(String(sale.status || ''))) throw new Error('当前状态不可完成交易')
  const dog = await findLocalRow('dogs', sale.dog_id)
  if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')

  const hasReceivedAmount = data.received_amount !== '' && data.received_amount != null
  const receivedAmount = hasReceivedAmount ? Number(data.received_amount) : null
  if (hasReceivedAmount && (!Number.isFinite(receivedAmount) || Number(receivedAmount) <= 0)) {
    throw new Error('请填写有效的到手价')
  }
  const saleModePatch = parseSaleModePatch(data)

  const incomes = await localDb.query<SaleIncomeRow>('incomes', row =>
    row.family_id === familyId
    && !row.deleted_at
    && row.source_sale_id === saleId
    && row.type === '销售',
  )
  const existingIncome = incomes[0] || null
  const createdIncomeId = !existingIncome && receivedAmount != null ? createStableEntityId('income') : ''
  const settledDate = Number.isFinite(Number(data.date)) ? Number(data.date) : getNow()
  const now = getNow()
  const settlementStatus = receivedAmount != null ? '已结算' : '未结算'
  const baseVersions = {
    [saleId]: Number(sale.version || 0),
    [sale.dog_id]: Number(dog.version || 0),
    ...(existingIncome ? { [existingIncome._id]: Number(existingIncome.version || 0) } : {}),
  }
  const syncMeta = buildSyncMeta(baseVersions, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.COMPLETE_SALE),
    clientEntityIds: createdIncomeId ? { incomes: createdIncomeId } : undefined,
  })

  await localDb.transactRows(['sale_records', 'dogs', 'incomes'] as const, async (rows) => {
    await rows.updateRow('sale_records', saleId, row => ({
      ...row,
      status: '已成交',
      ...(saleModePatch.provided ? { sale_mode: saleModePatch.value } : {}),
      settlement_status: settlementStatus,
      received_amount: receivedAmount,
      agreed_price: data.agreed_price != null ? data.agreed_price : row.agreed_price || null,
      date: settledDate,
      delivery_date: data.delivery_date || null,
      seller_agent_id: data.seller_agent_id || row.seller_agent_id || null,
      seller_agent_name: data.seller_agent_name || data.agent_name || row.seller_agent_name || null,
      platform: data.platform || row.platform || null,
      buyer_info: data.buyer_info || row.buyer_info || null,
      updated_at: now,
      _local_pending: true,
    } as LocalRowOf<'sale_records'>))
    if (receivedAmount != null) {
      const nextIncome = existingIncome
        ? {
            ...existingIncome,
            amount: receivedAmount,
            date: settledDate,
            source_type: 'auto',
            source_record_id: saleId,
            updated_at: now,
          }
        : {
            _id: createdIncomeId,
            family_id: familyId,
            dog_id: sale.dog_id,
            dog_name: sale.dog_name,
            type: '销售',
            amount: receivedAmount,
            date: settledDate,
            source_sale_id: saleId,
            source_type: 'auto',
            source_record_id: saleId,
            notes: null,
            deleted_at: null,
            version: 0,
            created_by: '',
            created_at: now,
            updated_at: now,
            _local_pending: true,
          }
      await rows.upsertRow('incomes', nextIncome as LocalRowOf<'incomes'>)
    }
    await rows.updateRow('dogs', sale.dog_id, row => ({
      ...row,
      disposition: '已售',
      disposition_date: settledDate,
      updated_at: now,
    } as LocalRowOf<'dogs'>))
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.COMPLETE_SALE,
    familyId,
    { id: saleId, saleId, ...data, _sync: syncMeta },
    ['sale_records', 'dogs', 'incomes'],
    syncMeta,
  )
  return {
    message: '交易完成',
    ...buildLocalAck(syncMeta, [
      { collection: 'sale_records', id: saleId, version: Number(sale.version || 0), updatedAt: now },
      { collection: 'dogs', id: sale.dog_id, version: Number(dog.version || 0), updatedAt: now },
      ...(receivedAmount != null
        ? [{ collection: 'incomes' as BusinessCollectionName, id: existingIncome?._id || createdIncomeId, version: Number(existingIncome?.version || 0), updatedAt: now }]
        : []),
    ]),
  }
}

export async function settleSaleLocally(ctx: RuntimeMutationContext, familyIdInput: string, saleId: string, data: SettleSalePayload) {
  const familyId = getFamilyId(familyIdInput)
  const sale = await findLocalRow('sale_records', saleId)
  if (!sale || sale.family_id !== familyId || sale.deleted_at) throw new Error('记录不存在')
  if (sale.status !== '已成交') throw new Error('只有已成交状态可以补录结算')
  if (data.received_amount === '' || data.received_amount == null) throw new Error('请填写到手价')
  const receivedAmount = Number(data.received_amount)
  if (!Number.isFinite(receivedAmount) || receivedAmount <= 0) throw new Error('请填写有效的到手价')

  const incomes = await localDb.query<SaleIncomeRow>('incomes', row =>
    row.family_id === familyId
    && !row.deleted_at
    && row.source_sale_id === saleId
    && row.type === '销售',
  )
  const existingIncome = incomes[0] || null
  const createdIncomeId = existingIncome ? '' : createStableEntityId('income')
  const settlementDate = Number.isFinite(Number(data.date)) ? Number(data.date) : Number(sale.date || getNow())
  const now = getNow()
  const baseVersions = {
    [saleId]: Number(sale.version || 0),
    ...(existingIncome ? { [existingIncome._id]: Number(existingIncome.version || 0) } : {}),
  }
  const syncMeta = buildSyncMeta(baseVersions, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.SETTLE_SALE),
    clientEntityIds: createdIncomeId ? { incomes: createdIncomeId } : undefined,
  })

  await localDb.transactRows(['sale_records', 'incomes'] as const, async (rows) => {
    await rows.updateRow('sale_records', saleId, row => ({
      ...row,
      received_amount: receivedAmount,
      agreed_price: data.agreed_price != null ? data.agreed_price : row.agreed_price || null,
      settlement_status: data.settlement_status || '已结算',
      updated_at: now,
      _local_pending: true,
    } as LocalRowOf<'sale_records'>))
    const nextIncome = existingIncome
      ? {
          ...existingIncome,
          amount: receivedAmount,
          date: settlementDate,
          source_type: 'auto',
          source_record_id: saleId,
          updated_at: now,
        }
      : {
          _id: createdIncomeId,
          family_id: familyId,
          dog_id: sale.dog_id,
          dog_name: sale.dog_name,
          type: '销售',
          amount: receivedAmount,
          date: settlementDate,
          source_sale_id: saleId,
          source_type: 'auto',
          source_record_id: saleId,
          notes: null,
          deleted_at: null,
          version: 0,
          created_by: '',
          created_at: now,
          updated_at: now,
          _local_pending: true,
        }
    await rows.upsertRow('incomes', nextIncome as LocalRowOf<'incomes'>)
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.SETTLE_SALE,
    familyId,
    { id: saleId, saleId, ...data, _sync: syncMeta },
    ['sale_records', 'incomes'],
    syncMeta,
  )
  return {
    message: '已补录结算',
    ...buildLocalAck(syncMeta, [
      { collection: 'sale_records', id: saleId, version: Number(sale.version || 0), updatedAt: now },
      { collection: 'incomes', id: existingIncome?._id || createdIncomeId, version: Number(existingIncome?.version || 0), updatedAt: now },
    ]),
  }
}

export async function cancelSaleLocally(ctx: RuntimeMutationContext, familyIdInput: string, saleId: string, data: CancelSalePayload) {
  const familyId = getFamilyId(familyIdInput)
  const sale = await findLocalRow('sale_records', saleId)
  if (!sale || sale.family_id !== familyId || sale.deleted_at) throw new Error('记录不存在')
  const dog = await findLocalRow('dogs', sale.dog_id)
  if (!dog) throw new Error('犬只未同步到本地，请联网刷新一次')

  const now = getNow()
  const newIncomeId = createStableEntityId('income')
  const baseVersions = {
    [saleId]: Number(sale.version || 0),
    [sale.dog_id]: Number(dog.version || 0),
  }
  const syncMeta = buildSyncMeta(baseVersions, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.CANCEL_SALE),
    clientEntityIds: { incomes: newIncomeId },
  })

  await localDb.transactRows(['sale_records', 'dogs', 'incomes'] as const, async (rows) => {
    if (sale.status === '已成交') {
      const receivedAmount = Number(sale.received_amount)
      if (!Number.isFinite(receivedAmount) || receivedAmount <= 0) throw new Error('未结算成交请先补录结算')
      const refundAmount = data.refund_amount !== '' && data.refund_amount != null
        ? Number(data.refund_amount)
        : receivedAmount
      if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > receivedAmount) {
        throw new Error('退款金额不能超过到手价')
      }
      const refundDate = Number.isFinite(Number(data.refund_date)) ? Number(data.refund_date) : now
      const isFullRefund = refundAmount >= receivedAmount
      await rows.updateRow('sale_records', saleId, row => ({
        ...row,
        status: '已退款',
        refund_amount: refundAmount,
        refund_reason: data.refund_reason || null,
        refund_date: refundDate,
        updated_at: now,
        _local_pending: true,
      } as LocalRowOf<'sale_records'>))
      await rows.upsertRow('incomes', {
        _id: newIncomeId,
        dog_id: sale.dog_id,
        dog_name: sale.dog_name,
        type: '退款',
        amount: -refundAmount,
        date: refundDate,
        source_sale_id: saleId,
        source_type: 'auto',
        source_record_id: saleId,
        notes: data.refund_reason || null,
        family_id: familyId,
        created_by: '',
        deleted_at: null,
        version: 0,
        created_at: now,
        updated_at: now,
        _local_pending: true,
      } as LocalRowOf<'incomes'>)
      if (isFullRefund) {
        await rows.updateRow('dogs', sale.dog_id, row => ({
          ...row,
          disposition: '在养',
          disposition_date: null,
          updated_at: now,
        } as LocalRowOf<'dogs'>))
      }
    } else if (sale.status === '已预定') {
      const depositAmount = Number(sale.deposit_amount)
      if (!Number.isFinite(depositAmount) || depositAmount <= 0) throw new Error('定金金额异常，请刷新后重试')
      const keptAmount = data.deposit_kept_amount !== '' && data.deposit_kept_amount != null
        ? Number(data.deposit_kept_amount)
        : 0
      if (!Number.isFinite(keptAmount) || keptAmount < 0 || keptAmount > depositAmount) {
        throw new Error('保留定金不能超过定金总额')
      }
      const refundDate = Number.isFinite(Number(data.refund_date)) ? Number(data.refund_date) : now
      await rows.updateRow('sale_records', saleId, row => ({
        ...row,
        status: '定金取消',
        deposit_kept_amount: keptAmount,
        refund_reason: data.refund_reason || null,
        refund_date: refundDate,
        updated_at: now,
        _local_pending: true,
      } as LocalRowOf<'sale_records'>))
      if (keptAmount > 0) {
        await rows.upsertRow('incomes', {
          _id: newIncomeId,
          dog_id: sale.dog_id,
          dog_name: sale.dog_name,
          type: '定金保留',
          amount: keptAmount,
          date: refundDate,
          source_sale_id: saleId,
          source_type: 'auto',
          source_record_id: saleId,
          notes: data.refund_reason || null,
          family_id: familyId,
          created_by: '',
          deleted_at: null,
          version: 0,
          created_at: now,
          updated_at: now,
          _local_pending: true,
        } as LocalRowOf<'incomes'>)
      }
      await rows.updateRow('dogs', sale.dog_id, row => ({
        ...row,
        disposition: '在养',
        updated_at: now,
      } as LocalRowOf<'dogs'>))
    } else {
      throw new Error('当前状态不可取消')
    }
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.CANCEL_SALE,
    familyId,
    { id: saleId, saleId, ...data, _sync: syncMeta },
    ['sale_records', 'dogs', 'incomes'],
    syncMeta,
  )
  return {
    message: '已取消',
    ...buildLocalAck(syncMeta, [
      { collection: 'sale_records', id: saleId, version: Number(sale.version || 0), updatedAt: now },
      { collection: 'dogs', id: sale.dog_id, version: Number(dog.version || 0), updatedAt: now },
      ...(sale.status === '已成交' || Number(data.deposit_kept_amount || 0) > 0
        ? [{ collection: 'incomes' as BusinessCollectionName, id: newIncomeId, version: 0, updatedAt: now }]
        : []),
    ]),
  }
}
