import { localDb } from '@/localdb/db'
import type { ExpenseCategory, ExpenseCategoryGroup } from '@/types/finance'
import type { CareRule, FamilySettings } from '@/types/family'
import type { RecycleBinItem } from '@/types/recycle'
import { getBeijingElapsedDays } from '@/utils/date'
import {
  buildExpenseCategoryGroups,
  normalizeExpenseCategories,
} from '@/constants/financeCategories'
import { getLocalFamilyRow } from './shared'

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
    days_remaining: Math.max(0, 30 - getBeijingElapsedDays(deletedAt)),
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
