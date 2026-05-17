import { localDb } from '@/localdb/db'
import {
  buildExpenseCategoryGroups,
  DEFAULT_EXPENSE_CATEGORIES,
  normalizeExpenseCategories,
  normalizeExpenseCategoryName,
  PRESET_EXPENSE_CATEGORY_GROUPS,
} from '@/constants/financeCategories'
import { createStableEntityId, createClientMutationId } from '@/localdb/id'
import { LOCAL_MUTATION_TYPES, type LocalMutationPayload, type LocalMutationType } from '@/localdb/mutation-registry'
import { findLocal as findLocalRow } from '@/localdb/repository'
import type { BusinessCollectionName, LocalRowOf, SyncMetadata } from '@/localdb/types'
import { buildLocalAck, buildSyncMeta, getFamilyId, getNow } from '@/localdb/runtime/mutation-helpers'
import type { CareRule, FamilyMember, FamilySettings } from '@/types/family'

type FamilyRow = LocalRowOf<'families'> & {
  members?: FamilyMember[]
  care_rules?: CareRule[]
  settings?: Partial<FamilySettings>
}
type ExpenseRow = LocalRowOf<'expenses'>
type MedicationProtocolRow = LocalRowOf<'medication_protocols'>
export type FamilySettingsPatch = Partial<FamilySettings> & {
  custom_symptom_tags?: unknown
}
export type CareRuleInput = Partial<CareRule>
type ExpenseCategoryGroup = NonNullable<FamilySettings['custom_expense_category_groups']>[number]
type ExpenseCategory = NonNullable<FamilySettings['custom_expense_categories']>[number]
export interface MedicationProtocolInput {
  name?: unknown
  drug_name?: unknown
  dosage?: unknown
  dosage_unit?: unknown
  method?: unknown
  frequency?: unknown
  duration_days?: unknown
  notes?: unknown
}

export interface RuntimeMutationContext {
  enqueueMutation(
    type: LocalMutationType,
    familyId: string,
    payload: LocalMutationPayload,
    collectionScope: BusinessCollectionName[],
    syncMeta: SyncMetadata,
  ): Promise<void>
}

function toOptionalText(value: unknown) {
  const normalized = String(value || '').trim()
  return normalized || null
}

function toOptionalNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return null
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : null
}

function createLocalExpenseCategoryGroupKey() {
  return `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

async function updateFamilyRow(familyId: string, updater: (family: FamilyRow) => FamilyRow) {
  await localDb.transactRows('families', async (rows) => {
    const current = await rows.getRow(familyId)
    if (!current) throw new Error('家庭未同步到本地，请联网刷新一次')
    await rows.updateRow(familyId, row => updater(row as FamilyRow))
  })
}

export async function updateFamilySettingsLocally(ctx: RuntimeMutationContext, familyIdInput: string, settings: FamilySettingsPatch) {
  const familyId = getFamilyId(familyIdInput)
  const family = await findLocalRow<FamilyRow>('families', familyId)
  if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
  const now = getNow()
  const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_FAMILY_SETTINGS),
  })
  await updateFamilyRow(familyId, row => ({
    ...row,
    settings: {
      ...(row.settings || {}),
      ...settings,
    },
    updated_at: now,
    _local_pending: true,
  }))
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.UPDATE_FAMILY_SETTINGS,
    familyId,
    { ...settings, _sync: syncMeta },
    ['families'],
    syncMeta,
  )
  return {
    message: '设置已更新',
    ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
  }
}

export async function addCareRuleLocally(ctx: RuntimeMutationContext, familyIdInput: string, rule: CareRuleInput) {
  const familyId = getFamilyId(familyIdInput)
  const family = await findLocalRow<FamilyRow>('families', familyId)
  if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
  if (!rule?.status_trigger || !rule?.task_description || !rule?.frequency) {
    throw new Error('请填写完整的护理规则')
  }
  const nextRule = {
    status_trigger: rule.status_trigger,
    task_description: rule.task_description,
    frequency: rule.frequency,
  }
  const now = getNow()
  const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.ADD_CARE_RULE),
  })
  await updateFamilyRow(familyId, row => ({
    ...row,
    care_rules: [...(Array.isArray(row.care_rules) ? row.care_rules : []), nextRule],
    updated_at: now,
    _local_pending: true,
  }))
  await ctx.enqueueMutation(LOCAL_MUTATION_TYPES.ADD_CARE_RULE, familyId, { ...nextRule, _sync: syncMeta }, ['families'], syncMeta)
  return {
    message: '护理规则已添加',
    ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
  }
}

export async function removeCareRuleLocally(ctx: RuntimeMutationContext, familyIdInput: string, index: number) {
  const familyId = getFamilyId(familyIdInput)
  const family = await findLocalRow<FamilyRow>('families', familyId)
  if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
  if (!Array.isArray(family.care_rules) || index < 0 || index >= family.care_rules.length) {
    throw new Error('规则不存在')
  }
  const now = getNow()
  const nextRules = [...family.care_rules]
  nextRules.splice(index, 1)
  const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.REMOVE_CARE_RULE),
  })
  await updateFamilyRow(familyId, row => ({
    ...row,
    care_rules: nextRules,
    updated_at: now,
    _local_pending: true,
  }))
  await ctx.enqueueMutation(LOCAL_MUTATION_TYPES.REMOVE_CARE_RULE, familyId, { index, _sync: syncMeta }, ['families'], syncMeta)
  return {
    message: '护理规则已删除',
    ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
  }
}

export async function updateNicknameLocally(ctx: RuntimeMutationContext, familyIdInput: string, userId: string, nickname: string) {
  const familyId = getFamilyId(familyIdInput)
  const family = await findLocalRow<FamilyRow>('families', familyId)
  if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
  const nextNickname = String(nickname || '').trim()
  if (!nextNickname) throw new Error('请输入昵称')
  const members = Array.isArray(family.members) ? [...family.members] : []
  const memberIndex = members.findIndex(item => item.user_id === userId && item.status === 'active')
  if (memberIndex < 0) throw new Error('成员不存在')
  const previousNickname = String(members[memberIndex]?.nickname || '').trim()
  const now = getNow()
  members[memberIndex] = {
    ...members[memberIndex],
    nickname: nextNickname,
  }
  const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_NICKNAME),
  })
  await updateFamilyRow(familyId, row => ({
    ...row,
    members,
    updated_at: now,
    _local_pending: true,
  }))
  await ctx.enqueueMutation(LOCAL_MUTATION_TYPES.UPDATE_NICKNAME, familyId, {
    nickname: nextNickname,
    previousNickname,
    userId,
    _sync: syncMeta,
  }, ['families'], syncMeta)
  return {
    message: '昵称已更新',
    ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
  }
}

export async function addExpenseCategoryGroupLocally(ctx: RuntimeMutationContext, familyIdInput: string, labelInput: string) {
  const familyId = getFamilyId(familyIdInput)
  const family = await findLocalRow<FamilyRow>('families', familyId)
  if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
  const label = String(labelInput || '').trim()
  if (!label) throw new Error('请填写分组名称')

  const customGroups = Array.isArray(family.settings?.custom_expense_category_groups)
    ? family.settings.custom_expense_category_groups
    : []
  const allGroups = buildExpenseCategoryGroups(customGroups)
  if (allGroups.some(item => item.label === label)) throw new Error('分组名称已存在')

  const nextGroup = { key: createLocalExpenseCategoryGroupKey(), label }
  const now = getNow()
  const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.ADD_EXPENSE_CATEGORY_GROUP),
  })

  await updateFamilyRow(familyId, row => ({
    ...row,
    settings: {
      ...(row.settings || {}),
      custom_expense_category_groups: [...customGroups, nextGroup],
    },
    updated_at: now,
    _local_pending: true,
  }))
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.ADD_EXPENSE_CATEGORY_GROUP,
    familyId,
    { ...nextGroup, _sync: syncMeta },
    ['families'],
    syncMeta,
  )
  return {
    data: { ...nextGroup, is_default: false },
    message: '已添加',
    ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
  }
}

export async function updateExpenseCategoryGroupLocally(ctx: RuntimeMutationContext, familyIdInput: string, key: string, labelInput: string) {
  const familyId = getFamilyId(familyIdInput)
  const family = await findLocalRow<FamilyRow>('families', familyId)
  if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
  const label = String(labelInput || '').trim()
  if (!key || !label) throw new Error('参数不完整')
  if (PRESET_EXPENSE_CATEGORY_GROUPS.some(item => item.key === key)) throw new Error('预设分组不可编辑')

  const customGroups = Array.isArray(family.settings?.custom_expense_category_groups)
    ? family.settings.custom_expense_category_groups
    : []
  const current = customGroups.find((item: ExpenseCategoryGroup) => item.key === key)
  if (!current) throw new Error('分组不存在')
  if (customGroups.some((item: ExpenseCategoryGroup) => item.key !== key && item.label === label)) throw new Error('分组名称已存在')
  if (PRESET_EXPENSE_CATEGORY_GROUPS.some(item => item.label === label)) throw new Error('分组名称与预设分组重复')

  const now = getNow()
  const updatedGroups = customGroups.map((item: ExpenseCategoryGroup) => item.key === key ? { ...item, label } : item)
  const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_EXPENSE_CATEGORY_GROUP),
  })

  await updateFamilyRow(familyId, row => ({
    ...row,
    settings: {
      ...(row.settings || {}),
      custom_expense_category_groups: updatedGroups,
    },
    updated_at: now,
    _local_pending: true,
  }))
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.UPDATE_EXPENSE_CATEGORY_GROUP,
    familyId,
    { key, label, _sync: syncMeta },
    ['families'],
    syncMeta,
  )
  return {
    message: '已更新',
    ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
  }
}

export async function removeExpenseCategoryGroupLocally(ctx: RuntimeMutationContext, familyIdInput: string, key: string) {
  const familyId = getFamilyId(familyIdInput)
  const family = await findLocalRow<FamilyRow>('families', familyId)
  if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
  if (!key) throw new Error('请指定分组')
  if (PRESET_EXPENSE_CATEGORY_GROUPS.some(item => item.key === key)) throw new Error('预设分组不可删除')

  const customGroups = Array.isArray(family.settings?.custom_expense_category_groups)
    ? family.settings.custom_expense_category_groups
    : []
  const customCategories = normalizeExpenseCategories(family.settings?.custom_expense_categories || [], buildExpenseCategoryGroups(customGroups))
    .filter(category => !category.is_default)
  const current = customGroups.find((item: ExpenseCategoryGroup) => item.key === key)
  if (!current) throw new Error('分组不存在')
  if (customCategories.some(category => category.parent_group === key)) throw new Error('请先迁移或删除该分组下的分类')

  const now = getNow()
  const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.REMOVE_EXPENSE_CATEGORY_GROUP),
  })

  await updateFamilyRow(familyId, row => ({
    ...row,
    settings: {
      ...(row.settings || {}),
      custom_expense_category_groups: customGroups.filter((item: ExpenseCategoryGroup) => item.key !== key),
    },
    updated_at: now,
    _local_pending: true,
  }))
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.REMOVE_EXPENSE_CATEGORY_GROUP,
    familyId,
    { key, _sync: syncMeta },
    ['families'],
    syncMeta,
  )
  return {
    message: '已删除',
    ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
  }
}

export async function addExpenseCategoryLocally(ctx: RuntimeMutationContext, familyIdInput: string, nameInput: string, parentGroupInput: string) {
  const familyId = getFamilyId(familyIdInput)
  const family = await findLocalRow<FamilyRow>('families', familyId)
  if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
  const name = normalizeExpenseCategoryName(nameInput)
  const parentGroup = String(parentGroupInput || '').trim()
  if (!name) throw new Error('请填写分类名称')
  if (!parentGroup) throw new Error('请指定分组')
  if (DEFAULT_EXPENSE_CATEGORIES.some(item => item.name === name)) throw new Error('该分类名称与预设分类重复')

  const customGroups = Array.isArray(family.settings?.custom_expense_category_groups)
    ? family.settings.custom_expense_category_groups
    : []
  const allGroups = buildExpenseCategoryGroups(customGroups)
  const categories = normalizeExpenseCategories(family.settings?.custom_expense_categories || [], allGroups)
  if (categories.some(category => category.name === name)) throw new Error('分类名称已存在')

  const customCategories = Array.isArray(family.settings?.custom_expense_categories)
    ? family.settings.custom_expense_categories
    : []
  const nextCategory = { name, parent_group: parentGroup }
  const now = getNow()
  const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.ADD_EXPENSE_CATEGORY),
  })

  await updateFamilyRow(familyId, row => ({
    ...row,
    settings: {
      ...(row.settings || {}),
      custom_expense_categories: [...customCategories, nextCategory],
    },
    updated_at: now,
    _local_pending: true,
  }))
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.ADD_EXPENSE_CATEGORY,
    familyId,
    { name, parentGroup: parentGroup, _sync: syncMeta },
    ['families'],
    syncMeta,
  )
  return {
    message: '已添加',
    ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
  }
}

export async function updateExpenseCategoryLocally(ctx: RuntimeMutationContext, familyIdInput: string, oldNameInput: string, newNameInput: string, parentGroupInput: string) {
  const familyId = getFamilyId(familyIdInput)
  const family = await findLocalRow<FamilyRow>('families', familyId)
  if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
  const oldName = normalizeExpenseCategoryName(oldNameInput)
  const newName = normalizeExpenseCategoryName(newNameInput)
  const parentGroup = String(parentGroupInput || '').trim()
  if (!oldName || !newName || !parentGroup) throw new Error('参数不完整')
  if (DEFAULT_EXPENSE_CATEGORIES.some(item => item.name === oldName)) throw new Error('预设分类不可编辑')
  if (DEFAULT_EXPENSE_CATEGORIES.some(item => item.name === newName)) throw new Error('新名称与预设分类重复')

  const customGroups = Array.isArray(family.settings?.custom_expense_category_groups)
    ? family.settings.custom_expense_category_groups
    : []
  const allGroups = buildExpenseCategoryGroups(customGroups)
  const categories = normalizeExpenseCategories(family.settings?.custom_expense_categories || [], allGroups)
  const current = categories.find(category => !category.is_default && category.name === oldName)
  if (!current) throw new Error('分类不存在')
  if (oldName !== newName && categories.some(category => category.name === newName)) throw new Error('新名称已存在')

  const customCategories = Array.isArray(family.settings?.custom_expense_categories)
    ? family.settings.custom_expense_categories
    : []
  const nextCategories = customCategories.map((item: ExpenseCategory) => item.name === oldName
    ? { ...item, name: newName, parent_group: parentGroup }
    : item)
  const affectedExpenses = oldName !== newName
    ? await localDb.query<ExpenseRow>('expenses', expense =>
      expense.family_id === familyId
      && !expense.deleted_at
      && expense.category === oldName,
    )
    : []
  const now = getNow()
  const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_EXPENSE_CATEGORY),
  })

  await localDb.transactRows(['families', 'expenses'] as const, async (rows) => {
    await rows.updateRow('families', familyId, row => ({
      ...(row as FamilyRow),
      settings: {
        ...((row as FamilyRow).settings || {}),
        custom_expense_categories: nextCategories,
      },
      updated_at: now,
      _local_pending: true,
    }))
    if (oldName !== newName) {
      for (const expense of affectedExpenses) {
        await rows.updateRow('expenses', expense._id, row => ({
          ...expense,
          ...row,
          category: newName,
          updated_at: now,
          _local_pending: true,
        }))
      }
    }
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.UPDATE_EXPENSE_CATEGORY,
    familyId,
    { oldName, newName, parentGroup: parentGroup, _sync: syncMeta },
    ['families', 'expenses'],
    syncMeta,
  )
  return {
    message: '已更新',
    ...buildLocalAck(syncMeta, [
      { collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now },
      ...affectedExpenses.map(expense => ({
        collection: 'expenses' as BusinessCollectionName,
        id: expense._id,
        version: Number(expense.version || 0),
        updatedAt: now,
      })),
    ]),
  }
}

export async function removeExpenseCategoryLocally(ctx: RuntimeMutationContext, familyIdInput: string, nameInput: string) {
  const familyId = getFamilyId(familyIdInput)
  const family = await findLocalRow<FamilyRow>('families', familyId)
  if (!family) throw new Error('家庭未同步到本地，请联网刷新一次')
  const name = normalizeExpenseCategoryName(nameInput)
  if (!name) throw new Error('请指定分类名称')
  if (DEFAULT_EXPENSE_CATEGORIES.some(item => item.name === name)) throw new Error('预设分类不可删除')

  const customGroups = Array.isArray(family.settings?.custom_expense_category_groups)
    ? family.settings.custom_expense_category_groups
    : []
  const categories = normalizeExpenseCategories(family.settings?.custom_expense_categories || [], buildExpenseCategoryGroups(customGroups))
  if (!categories.some(category => !category.is_default && category.name === name)) throw new Error('分类不存在')

  const customCategories = Array.isArray(family.settings?.custom_expense_categories)
    ? family.settings.custom_expense_categories
    : []
  const now = getNow()
  const syncMeta = buildSyncMeta({ [familyId]: Number(family.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.REMOVE_EXPENSE_CATEGORY),
  })

  await updateFamilyRow(familyId, row => ({
    ...row,
    settings: {
      ...(row.settings || {}),
      custom_expense_categories: customCategories.filter((item: ExpenseCategory) => item.name !== name),
    },
    updated_at: now,
    _local_pending: true,
  }))
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.REMOVE_EXPENSE_CATEGORY,
    familyId,
    { name, _sync: syncMeta },
    ['families'],
    syncMeta,
  )
  return {
    message: '已删除',
    ...buildLocalAck(syncMeta, [{ collection: 'families', id: familyId, version: Number(family.version || 0), updatedAt: now }]),
  }
}

export async function addMedicationProtocolLocally(ctx: RuntimeMutationContext, familyIdInput: string, data: MedicationProtocolInput) {
  const familyId = getFamilyId(familyIdInput)
  if (!data?.name) throw new Error('请填写方案名称')
  if (!data?.drug_name) throw new Error('请填写药品名称')
  const now = getNow()
  const protocolId = createStableEntityId('medication_protocol')
  const protocol: MedicationProtocolRow = {
    _id: protocolId,
    name: String(data.name || '').trim(),
    target_condition: '',
    drugs: [],
    drug_name: String(data.drug_name || '').trim(),
    dosage: toOptionalText(data.dosage),
    dosage_unit: toOptionalText(data.dosage_unit),
    method: toOptionalText(data.method),
    frequency: toOptionalText(data.frequency),
    duration_days: toOptionalNumber(data.duration_days),
    notes: toOptionalText(data.notes),
    family_id: familyId,
    created_by: '',
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
  }
  const syncMeta = buildSyncMeta({}, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.ADD_MEDICATION_PROTOCOL),
    clientEntityIds: { medication_protocols: protocolId },
  })
  await localDb.transactRows('medication_protocols', async (rows) => {
    await rows.upsertRow(protocol)
  })
  await ctx.enqueueMutation(LOCAL_MUTATION_TYPES.ADD_MEDICATION_PROTOCOL, familyId, { ...data, _sync: syncMeta }, ['medication_protocols'], syncMeta)
  return {
    data: { protocolId },
    ...buildLocalAck(syncMeta, [{ collection: 'medication_protocols', id: protocolId, version: 0, updatedAt: now }]),
  }
}

export async function removeMedicationProtocolLocally(ctx: RuntimeMutationContext, familyIdInput: string, protocolId: string) {
  const familyId = getFamilyId(familyIdInput)
  const protocol = await findLocalRow<MedicationProtocolRow>('medication_protocols', protocolId)
  if (!protocol || protocol.family_id !== familyId) throw new Error('方案不存在')
  const now = getNow()
  const syncMeta = buildSyncMeta({ [protocolId]: Number(protocol.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.REMOVE_MEDICATION_PROTOCOL),
  })
  await localDb.transactRows('medication_protocols', async (rows) => {
    const current = await rows.getRow(protocolId)
    if (!current || current.family_id !== familyId) throw new Error('方案不存在')
    await rows.updateRow(protocolId, row => ({
      ...row,
      deleted_at: now,
      updated_at: now,
      _local_pending: true,
    }))
  })
  await ctx.enqueueMutation(LOCAL_MUTATION_TYPES.REMOVE_MEDICATION_PROTOCOL, familyId, { id: protocolId, _sync: syncMeta }, ['medication_protocols'], syncMeta)
  return {
    message: '已删除',
    ...buildLocalAck(syncMeta, [{ collection: 'medication_protocols', id: protocolId, version: Number(protocol.version || 0), updatedAt: now, deletedAt: now }]),
  }
}

export async function updateMedicationProtocolLocally(ctx: RuntimeMutationContext, familyIdInput: string, protocolId: string, data: MedicationProtocolInput) {
  const familyId = getFamilyId(familyIdInput)
  const protocol = await findLocalRow<MedicationProtocolRow>('medication_protocols', protocolId)
  if (!protocol || protocol.family_id !== familyId || protocol.deleted_at) throw new Error('方案不存在')
  const name = String(data.name || '').trim()
  const drugName = String(data.drug_name || '').trim()
  if (!name) throw new Error('请填写方案名称')
  if (!drugName) throw new Error('请填写药品名称')
  const now = getNow()
  const patch: Partial<MedicationProtocolRow> = {
    name,
    drug_name: drugName,
    dosage: toOptionalText(data.dosage),
    dosage_unit: toOptionalText(data.dosage_unit),
    method: toOptionalText(data.method),
    frequency: toOptionalText(data.frequency),
    duration_days: toOptionalNumber(data.duration_days),
    notes: toOptionalText(data.notes),
  }
  const syncMeta = buildSyncMeta({ [protocolId]: Number(protocol.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_MEDICATION_PROTOCOL),
  })
  await localDb.transactRows('medication_protocols', async (rows) => {
    const current = await rows.getRow(protocolId)
    if (!current || current.family_id !== familyId || current.deleted_at) throw new Error('方案不存在')
    await rows.updateRow(protocolId, row => ({
      ...row,
      ...patch,
      updated_at: now,
      _local_pending: true,
    }))
  })
  await ctx.enqueueMutation(
    LOCAL_MUTATION_TYPES.UPDATE_MEDICATION_PROTOCOL,
    familyId,
    { id: protocolId, ...patch, _sync: syncMeta },
    ['medication_protocols'],
    syncMeta,
  )
  return {
    message: '已更新',
    ...buildLocalAck(syncMeta, [{ collection: 'medication_protocols', id: protocolId, version: Number(protocol.version || 0), updatedAt: now }]),
  }
}
