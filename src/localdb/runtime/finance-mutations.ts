import { localDb } from '@/localdb/db'
import { createClientMutationId, createStableEntityId } from '@/localdb/id'
import { LOCAL_MUTATION_TYPES, type LocalMutationPayload, type LocalMutationType } from '@/localdb/mutation-registry'
import { findLocal as findLocalRow } from '@/localdb/repository'
import { hasPendingUploadImages } from '@/localdb/runtime/attachments'
import { buildLocalAck, buildSyncMeta, getFamilyId, getNow } from '@/localdb/runtime/mutation-helpers'
import type { BusinessCollectionName, LocalRowOf, SyncMetadata } from '@/localdb/types'

type ExpenseRow = LocalRowOf<'expenses'>
type IncomeRow = LocalRowOf<'incomes'> & {
  source_sale_id?: string | null
  source_type?: string | null
}
type ExpenseMutationPayload = {
  id?: unknown
  total_amount?: unknown
  category?: unknown
  date?: unknown
  linked_cycle_id?: unknown
  linked_litter_id?: unknown
  linked_dog_ids?: unknown
  source_type?: unknown
  images?: unknown
  dam_name?: unknown
  dog_names?: unknown
  litter_number?: unknown
  notes?: unknown
} & Record<string, unknown>
type IncomeMutationPayload = {
  id?: unknown
  dog_id?: unknown
  dog_name?: unknown
  type?: unknown
  amount?: unknown
  date?: unknown
  source_sale_id?: unknown
  source_type?: unknown
  source_record_id?: unknown
  notes?: unknown
  images?: unknown
} & Record<string, unknown>

export interface RuntimeMutationContext {
  enqueueMutation(
    type: LocalMutationType,
    familyId: string,
    payload: LocalMutationPayload,
    collectionScope: BusinessCollectionName[],
    syncMeta: SyncMetadata,
  ): Promise<void>
}

export async function addExpenseLocally(ctx: RuntimeMutationContext, familyIdInput: string, data: ExpenseMutationPayload) {
  const familyId = getFamilyId(familyIdInput)
  const now = getNow()
  const pendingUpload = hasPendingUploadImages(data.images)
  const expense = {
    _id: createStableEntityId('expense'),
    family_id: familyId,
    total_amount: data.total_amount,
    category: data.category,
    date: data.date || now,
    linked_cycle_id: data.linked_cycle_id || null,
    linked_litter_id: data.linked_litter_id || null,
    linked_dog_ids: data.linked_dog_ids || [],
    source_type: data.source_type || 'manual',
    source_record_id: null,
    images: data.images || [],
    dam_name: data.dam_name || null,
    dog_names: data.dog_names || [],
    litter_number: data.litter_number || null,
    notes: data.notes || null,
    created_by: '',
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
    _pending_upload: pendingUpload,
    pending_upload: pendingUpload,
  } as unknown as ExpenseRow
  const syncMeta = buildSyncMeta({}, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.CREATE_EXPENSE),
    clientEntityIds: { expenses: expense._id },
  })
  await localDb.transactRows('expenses', async (rows) => {
    await rows.upsertRow(expense as ExpenseRow)
  })
  await ctx.enqueueMutation(LOCAL_MUTATION_TYPES.CREATE_EXPENSE, familyId, { ...data, _sync: syncMeta }, ['expenses'], syncMeta)
  return { data: { expenseId: expense._id }, ...buildLocalAck(syncMeta, [{ collection: 'expenses', id: expense._id, version: 0, updatedAt: now }]) }
}

export async function addIncomeLocally(ctx: RuntimeMutationContext, familyIdInput: string, data: IncomeMutationPayload) {
  const familyId = getFamilyId(familyIdInput)
  const now = getNow()
  const pendingUpload = hasPendingUploadImages(data.images)
  const income = {
    _id: createStableEntityId('income'),
    family_id: familyId,
    dog_id: data.dog_id || null,
    dog_name: data.dog_name || null,
    type: data.type,
    amount: data.amount,
    date: data.date || now,
    source_sale_id: data.source_sale_id || null,
    source_type: data.source_type || 'manual',
    source_record_id: data.source_record_id || null,
    notes: data.notes || null,
    images: data.images || [],
    created_by: '',
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
    _pending_upload: pendingUpload,
    pending_upload: pendingUpload,
  } as unknown as IncomeRow
  const syncMeta = buildSyncMeta({}, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.CREATE_INCOME),
    clientEntityIds: { incomes: income._id },
  })
  await localDb.transactRows('incomes', async (rows) => {
    await rows.upsertRow(income as IncomeRow)
  })
  await ctx.enqueueMutation(LOCAL_MUTATION_TYPES.CREATE_INCOME, familyId, { ...data, _sync: syncMeta }, ['incomes'], syncMeta)
  return { data: { incomeId: income._id }, ...buildLocalAck(syncMeta, [{ collection: 'incomes', id: income._id, version: 0, updatedAt: now }]) }
}

export async function updateExpenseLocally(ctx: RuntimeMutationContext, familyIdInput: string, data: ExpenseMutationPayload) {
  const familyId = getFamilyId(familyIdInput)
  const expenseId = String(data.id || '').trim()
  if (!expenseId) throw new Error('缺少记录 ID')
  const expense = await findLocalRow<ExpenseRow>('expenses', expenseId)
  if (!expense || expense.family_id !== familyId || expense.deleted_at) throw new Error('记录不存在')
  if (expense.source_type === 'auto') throw new Error('自动生成的费用不可编辑，请在来源记录中操作')

  const now = getNow()
  const pendingUpload = hasPendingUploadImages(data.images)
  const nextExpense = {
    ...expense,
    total_amount: data.total_amount,
    category: data.category,
    date: data.date || expense.date,
    linked_cycle_id: data.linked_cycle_id || null,
    linked_litter_id: data.linked_litter_id || null,
    linked_dog_ids: data.linked_dog_ids || [],
    dam_name: data.dam_name || null,
    dog_names: data.dog_names || [],
    litter_number: data.litter_number || null,
    notes: data.notes || null,
    images: data.images || [],
    updated_at: now,
    _local_pending: true,
    _pending_upload: pendingUpload,
    pending_upload: pendingUpload,
  } as unknown as ExpenseRow
  const syncMeta = buildSyncMeta({ [expenseId]: Number(expense.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_EXPENSE),
  })
  await localDb.transactRows('expenses', async (rows) => {
    const current = await rows.getRow(expenseId)
    if (!current || current.family_id !== familyId || current.deleted_at) throw new Error('记录不存在')
    if (current.source_type === 'auto') throw new Error('自动生成的费用不可编辑，请在来源记录中操作')
    await rows.updateRow(expenseId, nextExpense)
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.UPDATE_EXPENSE,
    familyId,
    { ...data, id: expenseId, _sync: syncMeta },
    ['expenses'],
    syncMeta,
  )
  return {
    message: '已更新',
    ...buildLocalAck(syncMeta, [{ collection: 'expenses', id: expenseId, version: Number(expense.version || 0), updatedAt: now }]),
  }
}

export async function updateIncomeLocally(ctx: RuntimeMutationContext, familyIdInput: string, data: IncomeMutationPayload) {
  const familyId = getFamilyId(familyIdInput)
  const incomeId = String(data.id || '').trim()
  if (!incomeId) throw new Error('缺少记录 ID')
  const income = await findLocalRow<IncomeRow>('incomes', incomeId)
  if (!income || income.family_id !== familyId || income.deleted_at) throw new Error('记录不存在')
  if (income.source_sale_id || income.source_type === 'auto') throw new Error('自动生成的收入不可编辑，请在来源记录中操作')

  const now = getNow()
  const pendingUpload = hasPendingUploadImages(data.images)
  const nextIncome = {
    ...income,
    amount: data.amount,
    type: data.type,
    dog_id: data.dog_id || null,
    dog_name: data.dog_name || null,
    date: data.date || income.date,
    notes: data.notes || null,
    images: data.images || [],
    updated_at: now,
    _local_pending: true,
    _pending_upload: pendingUpload,
    pending_upload: pendingUpload,
  } as unknown as IncomeRow
  const syncMeta = buildSyncMeta({ [incomeId]: Number(income.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_INCOME),
  })
  await localDb.transactRows('incomes', async (rows) => {
    const current = await rows.getRow(incomeId)
    if (!current || current.family_id !== familyId || current.deleted_at) throw new Error('记录不存在')
    const currentIncome = current as IncomeRow
    if (currentIncome.source_sale_id || currentIncome.source_type === 'auto') throw new Error('自动生成的收入不可编辑，请在来源记录中操作')
    await rows.updateRow(incomeId, nextIncome)
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.UPDATE_INCOME,
    familyId,
    { ...data, id: incomeId, _sync: syncMeta },
    ['incomes'],
    syncMeta,
  )
  return {
    message: '已更新',
    ...buildLocalAck(syncMeta, [{ collection: 'incomes', id: incomeId, version: Number(income.version || 0), updatedAt: now }]),
  }
}

export async function deleteExpenseLocally(ctx: RuntimeMutationContext, familyIdInput: string, expenseIdInput: string) {
  const familyId = getFamilyId(familyIdInput)
  const expenseId = String(expenseIdInput || '').trim()
  if (!expenseId) throw new Error('缺少记录 ID')
  const expense = await findLocalRow<ExpenseRow>('expenses', expenseId)
  if (!expense || expense.family_id !== familyId || expense.deleted_at) throw new Error('记录不存在')
  if (expense.source_type === 'auto') throw new Error('自动生成的费用不可删除，请在来源记录中操作')

  const now = getNow()
  const syncMeta = buildSyncMeta({ [expenseId]: Number(expense.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.DELETE_EXPENSE),
  })
  await localDb.transactRows('expenses', async (rows) => {
    const current = await rows.getRow(expenseId)
    if (!current || current.family_id !== familyId || current.deleted_at) throw new Error('记录不存在')
    if (current.source_type === 'auto') throw new Error('自动生成的费用不可删除，请在来源记录中操作')
    await rows.updateRow(expenseId, row => ({
      ...row,
      deleted_at: now,
      updated_at: now,
      _local_pending: true,
    }))
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.DELETE_EXPENSE,
    familyId,
    { id: expenseId, _sync: syncMeta },
    ['expenses'],
    syncMeta,
  )
  return {
    message: '已删除',
    ...buildLocalAck(syncMeta, [{ collection: 'expenses', id: expenseId, version: Number(expense.version || 0), updatedAt: now, deletedAt: now }]),
  }
}

export async function deleteIncomeLocally(ctx: RuntimeMutationContext, familyIdInput: string, incomeIdInput: string) {
  const familyId = getFamilyId(familyIdInput)
  const incomeId = String(incomeIdInput || '').trim()
  if (!incomeId) throw new Error('缺少记录 ID')
  const income = await findLocalRow<IncomeRow>('incomes', incomeId)
  if (!income || income.family_id !== familyId || income.deleted_at) throw new Error('记录不存在')
  if (income.source_sale_id || income.source_type === 'auto') throw new Error('自动生成的收入不可删除，请在来源记录中操作')

  const now = getNow()
  const syncMeta = buildSyncMeta({ [incomeId]: Number(income.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.DELETE_INCOME),
  })
  await localDb.transactRows('incomes', async (rows) => {
    const current = await rows.getRow(incomeId)
    if (!current || current.family_id !== familyId || current.deleted_at) throw new Error('记录不存在')
    const currentIncome = current as IncomeRow
    if (currentIncome.source_sale_id || currentIncome.source_type === 'auto') throw new Error('自动生成的收入不可删除，请在来源记录中操作')
    await rows.updateRow(incomeId, row => ({
      ...row,
      deleted_at: now,
      updated_at: now,
      _local_pending: true,
    }))
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.DELETE_INCOME,
    familyId,
    { id: incomeId, _sync: syncMeta },
    ['incomes'],
    syncMeta,
  )
  return {
    message: '已删除',
    ...buildLocalAck(syncMeta, [{ collection: 'incomes', id: incomeId, version: Number(income.version || 0), updatedAt: now, deletedAt: now }]),
  }
}
