/**
 * 家庭云对象
 * 管理家庭创建、成员管理、设置
 */
const { verifyAndGetFamily, requireAdmin, requireFamily } = require('breed-auth/auth')
let safeWriteOperationLog = async () => null
let isOperationLogCollectionMissingError = () => false
try {
  ;({ safeWriteOperationLog, isOperationLogCollectionMissingError } = require('breed-auth/operation-log'))
} catch (error) {
  ;({ safeWriteOperationLog, isOperationLogCollectionMissingError } = require('../common/breed-auth/operation-log'))
}
let syncUtils = null
try {
  syncUtils = require('breed-sync')
} catch (error) {
  syncUtils = require('../common/breed-sync')
}
const {
  getSyncMeta,
  buildTouchedEntity,
  buildSyncAck,
  findAppliedMutation,
  markMutationApplied,
  buildVersionUpdate,
} = syncUtils

const db = uniCloud.database()
const dbCmd = db.command

const DEFAULT_NOTIFICATION_TYPES = {
  breeding: true,
  vaccination: true,
  medication: true,
  care_group: true,
  overdue: true,
}

// 家庭设置默认值
const DEFAULT_SETTINGS = {
  default_weaning_days: 45,
  default_vaccine_interval_puppy: 21,
  default_vaccine_interval_adult: 365,
  default_deworming_interval_puppy: 14,
  default_deworming_interval_adult: 90,
  push_enabled: true,
  morning_summary_enabled: true,
  morning_summary_time: '09:00',
  notification_types: { ...DEFAULT_NOTIFICATION_TYPES },
  custom_vaccine_types: [],
  custom_deworming_drugs: { internal: [], external: [], combo: [] },
  custom_condition_types: [],
  custom_breed_types: [],
}

function mergeFamilySettings(settings = {}) {
  const safeSettings = settings && typeof settings === 'object' ? settings : {}

  return {
    ...DEFAULT_SETTINGS,
    ...safeSettings,
    notification_types: {
      ...DEFAULT_NOTIFICATION_TYPES,
      ...(safeSettings.notification_types && typeof safeSettings.notification_types === 'object' ? safeSettings.notification_types : {}),
      overdue: true,
    },
    custom_deworming_drugs: {
      ...DEFAULT_SETTINGS.custom_deworming_drugs,
      ...(safeSettings.custom_deworming_drugs && typeof safeSettings.custom_deworming_drugs === 'object' ? safeSettings.custom_deworming_drugs : {}),
    },
  }
}

function isValidTimeString(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)
}

function normalizeNotificationTypes(input, currentSettings) {
  const base = {
    ...DEFAULT_NOTIFICATION_TYPES,
    ...(currentSettings?.notification_types || {}),
  }

  if (input === undefined) {
    return {
      ...base,
      overdue: true,
    }
  }

  if (!input || typeof input !== 'object') {
    throw new Error('提醒类型参数无效')
  }

  const normalized = { ...base }
  for (const key of Object.keys(DEFAULT_NOTIFICATION_TYPES)) {
    if (key === 'overdue') continue
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'boolean') {
        throw new Error('提醒类型参数无效')
      }
      normalized[key] = input[key]
    }
  }

  normalized.overdue = true
  return normalized
}

const RECYCLE_RETENTION_DAYS = 30
const LEGACY_INCOME_TYPE_MAP = {
  定金: '定金保留',
  领养费: '领养',
  配种费收入: '其他',
}
const RECYCLE_SUPPORTED_TYPES = {
  dog: {
    collection: 'dogs',
    typeLabel: '犬只',
    name: item => item.name || '未命名犬只',
    summary: item => [item.breed, item.role, item.disposition].filter(Boolean).join(' · '),
  },
  expense: {
    collection: 'expenses',
    typeLabel: '支出',
    name: item => item.category || '未命名支出',
    summary: item => [item.category, formatCurrency(item.amount)].filter(Boolean).join(' · '),
  },
  income: {
    collection: 'incomes',
    typeLabel: '收入',
    name: item => normalizeIncomeType(item.type) || '未命名收入',
    summary: item => [normalizeIncomeType(item.type), formatCurrency(item.amount)].filter(Boolean).join(' · '),
  },
  agent: {
    collection: 'agents',
    typeLabel: '代理人',
    name: item => item.name || '未命名代理人',
    summary: item => item.contact_info || '',
  },
  medication_protocol: {
    collection: 'medication_protocols',
    typeLabel: '用药方案',
    name: item => item.name || '未命名方案',
    summary: item => [item.drug_name, item.duration_days ? `${item.duration_days}天疗程` : ''].filter(Boolean).join(' · '),
  },
}

function formatCurrency(amount) {
  if (amount == null || amount === '') return ''
  const numericAmount = Number(amount)
  if (Number.isNaN(numericAmount)) return ''
  return `¥${numericAmount.toLocaleString()}`
}

function normalizeIncomeType(type) {
  const normalized = String(type || '').trim()
  if (!normalized) return '其他'
  return LEGACY_INCOME_TYPE_MAP[normalized] || normalized
}

function clampDaysRemaining(deletedAt) {
  if (!deletedAt) return 0
  const elapsedDays = Math.floor((Date.now() - deletedAt) / 86400000)
  return Math.max(0, RECYCLE_RETENTION_DAYS - elapsedDays)
}

function normalizeRecycleItem(type, item) {
  const config = RECYCLE_SUPPORTED_TYPES[type]
  if (!config) return null

  return {
    _id: item._id,
    type,
    type_label: config.typeLabel,
    name: config.name(item),
    summary: config.summary(item),
    deleted_at: item.deleted_at,
    days_remaining: clampDaysRemaining(item.deleted_at),
  }
}

async function getDeletedDocsByType(familyId, type) {
  const config = RECYCLE_SUPPORTED_TYPES[type]
  if (!config) return []

  const { data } = await db.collection(config.collection)
    .where({
      family_id: familyId,
      deleted_at: dbCmd.neq(null),
    })
    .get()

  return (data || [])
    .map(item => normalizeRecycleItem(type, item))
    .filter(Boolean)
}

async function getSoftDeletedDocByType(familyId, type, id) {
  const config = RECYCLE_SUPPORTED_TYPES[type]
  if (!config) throw new Error('不支持的回收站类型')

  const { data } = await db.collection(config.collection)
    .where({
      _id: id,
      family_id: familyId,
      deleted_at: dbCmd.neq(null),
    })
    .limit(1)
    .get()

  return {
    config,
    doc: data && data.length > 0 ? data[0] : null,
  }
}

function parseRecycleItemInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('回收站参数无效')
  }

  const id = typeof input.id === 'string' ? input.id.trim() : ''
  const type = typeof input.type === 'string' ? input.type.trim() : ''

  if (!id) throw new Error('缺少回收站项目 ID')
  if (!RECYCLE_SUPPORTED_TYPES[type]) throw new Error('不支持的回收站类型')

  return { id, type }
}

function normalizeOperationLogQuery(input = {}) {
  const page = Math.max(1, Number(input.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(input.pageSize) || 20))
  const actorUserId = typeof input.actorUserId === 'string' ? input.actorUserId.trim() : ''
  const actorUserIds = Array.isArray(input.actorUserIds)
    ? input.actorUserIds.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const actionTypes = Array.isArray(input.actionTypes)
    ? input.actionTypes.map(item => String(item || '').trim()).filter(Boolean)
    : []
  const normalizedActorUserIds = actorUserIds.length > 0
    ? Array.from(new Set(actorUserIds))
    : (actorUserId ? [actorUserId] : [])

  return {
    start: Number(input.start) || 0,
    end: Number(input.end) || Date.now(),
    page,
    pageSize,
    actorUserId,
    actorUserIds: normalizedActorUserIds,
    actionTypes,
  }
}

module.exports = {
  _before: async function() {
    // createFamily 和 joinFamily 允许无家庭用户调用
    const skipFamilyCheck = ['createFamily', 'joinFamily', 'getFamilyInfo']
    const { uid, familyId, role } = await verifyAndGetFamily(this.getUniIdToken(), this.getClientInfo())
    this.uid = uid
    this.familyId = familyId
    this.role = role

    const methodName = this.getMethodName()
    if (!skipFamilyCheck.includes(methodName)) {
      requireFamily(familyId)
    }
  },

  _after: function(error, result) {
    if (error) {
      return { errCode: error.code || -1, errMsg: error.message }
    }
    return result
  },

  /**
   * 创建家庭
   * @param {string} name - 家庭/犬舍名称
   */
  async createFamily(name) {
    if (!name || !name.trim()) {
      throw new Error('请输入家庭名称')
    }

    // 检查用户是否已有家庭（单家庭模式）
    if (this.familyId) {
      throw new Error('您已有家庭，V1 版本暂不支持多家庭')
    }

    const now = Date.now()
    const familyData = {
      name: name.trim(),
      creator_id: this.uid,
      members: [{
        user_id: this.uid,
        role: 'creator',
        status: 'active',
        joined_at: now,
      }],
      care_rules: [],
      settings: { ...DEFAULT_SETTINGS },
      created_at: now,
      updated_at: now,
    }

    const { id } = await db.collection('families').add(familyData)
    await safeWriteOperationLog({
      familyId: id,
      actorUserId: this.uid,
      actionType: 'create',
      domain: 'family',
      targetType: 'family',
      targetId: id,
      targetName: familyData.name,
      summary: `创建了家庭 ${familyData.name}`,
      createdAt: now,
    })
    return { data: { familyId: id } }
  },

  /**
   * 获取当前用户的家庭信息
   */
  async getFamilyInfo() {
    // 用户可能还没有家庭（登录后首次检查）
    if (!this.familyId) {
      return { data: null }
    }

    const { data } = await db.collection('families')
      .doc(this.familyId)
      .get()

    if (!data || data.length === 0) {
      throw new Error('家庭不存在')
    }

    const family = data[0] || data

    return {
      data: {
        ...family,
        settings: mergeFamilySettings(family.settings),
      },
    }
  },

  /**
   * 更新家庭设置
   * @param {object} settings - 要更新的设置字段
   */
  async updateSettings(settings) {
    requireAdmin(this.role)

    if (!settings || typeof settings !== 'object') {
      throw new Error('设置参数无效')
    }

    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ settings: true })
      .get()

    const family = data[0] || data
    if (!family) {
      throw new Error('家庭不存在')
    }

    const currentSettings = mergeFamilySettings(family.settings)

    // 只允许更新已知的设置字段
    const allowedKeys = Object.keys(DEFAULT_SETTINGS)
    const updateData = {}
    for (const key of allowedKeys) {
      if (settings[key] !== undefined) {
        if (key === 'push_enabled' || key === 'morning_summary_enabled') {
          if (typeof settings[key] !== 'boolean') {
            throw new Error('设置参数无效')
          }
          updateData[`settings.${key}`] = settings[key]
          continue
        }

        if (key === 'morning_summary_time') {
          if (!isValidTimeString(settings[key])) {
            throw new Error('推送时间格式无效')
          }
          updateData['settings.morning_summary_time'] = settings[key]
          continue
        }

        if (key === 'notification_types') {
          updateData['settings.notification_types'] = normalizeNotificationTypes(settings.notification_types, currentSettings)
          continue
        }

        updateData[`settings.${key}`] = settings[key]
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('没有可更新的设置')
    }

    updateData.updated_at = Date.now()

    await db.collection('families')
      .doc(this.familyId)
      .update(updateData)

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'update',
      domain: 'family',
      targetType: 'settings',
      targetId: this.familyId,
      targetName: '家庭设置',
      summary: '更新了家庭设置',
      meta: {
        keys: Object.keys(updateData).filter(key => key !== 'updated_at'),
      },
    })

    return { message: '设置已更新' }
  },

  /**
   * 更新家庭名称
   * @param {string} name - 新名称
   */
  async updateFamilyName(name) {
    requireAdmin(this.role)

    if (!name || !name.trim()) {
      throw new Error('请输入家庭名称')
    }

    const { data: families } = await db.collection('families')
      .doc(this.familyId)
      .field({ name: true })
      .get()
    const family = families?.[0] || families || {}
    const nextName = name.trim()

    await db.collection('families')
      .doc(this.familyId)
      .update({
        name: nextName,
        updated_at: Date.now(),
      })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'update',
      domain: 'family',
      targetType: 'family',
      targetId: this.familyId,
      targetName: nextName,
      summary: `将家庭名称从 ${family.name || '未命名家庭'} 更新为 ${nextName}`,
    })

    return { message: '名称已更新' }
  },

  /**
   * 添加/更新护理规则
   * @param {object} rule - 护理规则 { status_trigger, task_description, frequency }
   */
  async addCareRule(rule) {
    requireAdmin(this.role)

    if (!rule || !rule.status_trigger || !rule.task_description || !rule.frequency) {
      throw new Error('请填写完整的护理规则')
    }

    const careRule = {
      status_trigger: rule.status_trigger,
      task_description: rule.task_description,
      frequency: rule.frequency,
    }

    await db.collection('families')
      .doc(this.familyId)
      .update({
        care_rules: dbCmd.push(careRule),
        updated_at: Date.now(),
      })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'create',
      domain: 'family',
      targetType: 'care_rule',
      targetId: `${this.familyId}:${careRule.status_trigger}:${careRule.task_description}`,
      targetName: careRule.task_description,
      summary: `添加了护理规则 ${careRule.task_description}`,
      meta: careRule,
    })

    return { message: '护理规则已添加' }
  },

  /**
   * 删除护理规则
   * @param {number} index - 规则在数组中的索引
   */
  async removeCareRule(index) {
    requireAdmin(this.role)

    if (typeof index !== 'number' || index < 0) {
      throw new Error('无效的规则索引')
    }

    // 先获取当前规则列表
    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ care_rules: true })
      .get()

    const family = data[0] || data
    if (!family.care_rules || index >= family.care_rules.length) {
      throw new Error('规则不存在')
    }

    const removedRule = family.care_rules[index]
    family.care_rules.splice(index, 1)

    await db.collection('families')
      .doc(this.familyId)
      .update({
        care_rules: family.care_rules,
        updated_at: Date.now(),
      })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'delete',
      domain: 'family',
      targetType: 'care_rule',
      targetId: `${this.familyId}:${index}`,
      targetName: removedRule.task_description || '护理规则',
      summary: `删除了护理规则 ${removedRule.task_description || ''}`.trim(),
      meta: removedRule,
    })

    return { message: '护理规则已删除' }
  },

  // ── 协作 ──

  /**
   * 生成邀请码（6位随机码，24小时有效）
   */
  async generateInviteLink() {
    requireAdmin(this.role)

    const crypto = require('crypto')
    const code = crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase()
    const now = Date.now()
    const inviteExpires = now + 24 * 60 * 60 * 1000

    await db.collection('families')
      .doc(this.familyId)
      .update({
        invite_code: code,
        invite_expires: inviteExpires,
        updated_at: now,
      })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'invite',
      domain: 'family',
      targetType: 'invite_code',
      targetId: code,
      targetName: code,
      summary: `生成了邀请码 ${code}`,
      createdAt: now,
    })

    return { data: { code, invite_expires: inviteExpires } }
  },

  /**
   * 通过邀请码加入家庭
   */
  async joinFamily(inviteCode) {
    const normalizedInviteCode = typeof inviteCode === 'string'
      ? inviteCode.trim()
      : String(inviteCode?.invite_code || inviteCode?.code || '').trim()
    if (!normalizedInviteCode) throw new Error('请输入邀请码')
    if (this.familyId) throw new Error('您已加入家庭，V1 暂不支持多家庭')

    const now = Date.now()

    const { data: families } = await db.collection('families')
      .where({
        invite_code: normalizedInviteCode.toUpperCase(),
        invite_expires: dbCmd.gt(now),
      })
      .limit(1)
      .get()

    if (!families || families.length === 0) throw new Error('邀请码无效或已过期')

    const family = families[0]

    // 检查是否已是成员
    const existing = family.members.find(m => m.user_id === this.uid)
    if (existing) {
      if (existing.status === 'active') throw new Error('您已是该家庭成员')
      // 重新激活：需要 read-modify-write（修改现有数组元素）
      existing.status = 'active'
      existing.joined_at = now
      existing.removed_at = null
      await db.collection('families').doc(family._id).update({
        members: family.members,
        updated_at: now,
      })
    } else {
      // 新成员：使用 dbCmd.push 避免并发竞争
      await db.collection('families').doc(family._id).update({
        members: dbCmd.push({
          user_id: this.uid,
          role: 'helper',
          status: 'active',
          joined_at: now,
        }),
        updated_at: now,
      })
    }

    await safeWriteOperationLog({
      familyId: family._id,
      actorUserId: this.uid,
      actionType: 'join',
      domain: 'family',
      targetType: 'family_member',
      targetId: this.uid,
      targetName: family.name,
      summary: `加入了家庭 ${family.name}`,
      createdAt: now,
    })

    return { data: { familyId: family._id, familyName: family.name } }
  },

  /**
   * 获取成员列表
   */
  async getMemberList() {
    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ members: true, name: true, creator_id: true })
      .get()

    const family = data[0] || data
    const activeMembers = (family.members || []).filter(m => m.status === 'active')

    return { data: activeMembers }
  },

  /**
   * 更新成员角色
   */
  async updateMemberRole(userId, newRole) {
    requireAdmin(this.role)
    if (!userId) throw new Error('缺少用户 ID')
    if (!['admin', 'helper'].includes(newRole)) throw new Error('无效角色')

    const now = Date.now()

    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ members: true, creator_id: true })
      .get()

    const family = data[0] || data
    const member = family.members.find(m => m.user_id === userId && m.status === 'active')
    if (!member) throw new Error('成员不存在')
    if (member.role === 'creator') throw new Error('不能更改创建者角色')

    // 非创建者不能设置管理员
    if (newRole === 'admin' && this.role !== 'creator') {
      throw new Error('仅创建者可设置管理员')
    }

    const previousRole = member.role
    member.role = newRole

    await db.collection('families').doc(this.familyId).update({
      members: family.members,
      updated_at: now,
    })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'role_change',
      domain: 'family',
      targetType: 'family_member',
      targetId: userId,
      targetName: member.nickname || userId,
      summary: `将成员 ${member.nickname || userId} 的角色从 ${previousRole} 改为 ${newRole}`,
      meta: { previousRole, newRole },
      createdAt: now,
    })

    return { message: '角色已更新' }
  },

  /**
   * 移除成员
   */
  async removeMember(userId) {
    requireAdmin(this.role)
    if (!userId) throw new Error('缺少用户 ID')
    if (userId === this.uid) throw new Error('不能移除自己')

    const now = Date.now()

    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ members: true, creator_id: true })
      .get()

    const family = data[0] || data
    const member = family.members.find(m => m.user_id === userId && m.status === 'active')
    if (!member) throw new Error('成员不存在')
    if (member.role === 'creator') throw new Error('不能移除创建者')

    // 非创建者不能移除管理员
    if (member.role === 'admin' && this.role !== 'creator') {
      throw new Error('仅创建者可移除管理员')
    }

    member.status = 'removed'
    member.removed_at = now

    await db.collection('families').doc(this.familyId).update({
      members: family.members,
      updated_at: now,
    })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'delete',
      domain: 'family',
      targetType: 'family_member',
      targetId: userId,
      targetName: member.nickname || userId,
      summary: `移除了成员 ${member.nickname || userId}`,
      createdAt: now,
    })

    return { message: '成员已移除' }
  },

  /**
   * 更新当前用户昵称
   * @param {string} nickname - 新昵称
   */
  async updateNickname(nickname) {
    if (!nickname || !nickname.trim()) {
      throw new Error('请输入昵称')
    }

    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ members: true })
      .get()

    const family = data[0] || data
    const member = family.members.find(m => m.user_id === this.uid && m.status === 'active')
    if (!member) throw new Error('成员不存在')

    const nextNickname = nickname.trim()
    member.nickname = nextNickname

    await db.collection('families').doc(this.familyId).update({
      members: family.members,
      updated_at: Date.now(),
    })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actorName: nextNickname,
      actionType: 'update',
      domain: 'family',
      targetType: 'family_member',
      targetId: this.uid,
      targetName: nextNickname,
      summary: `将昵称更新为 ${nextNickname}`,
    })

    return { message: '昵称已更新' }
  },

  // ── 操作日志 / 回收站 / 备份 / 护理规则 ──

  /**
   * 获取操作日志
   */
  async getOperationLogs(input = {}) {
    const query = normalizeOperationLogQuery(input)
    const where = {
      family_id: this.familyId,
      created_at: dbCmd.gte(query.start).and(dbCmd.lte(query.end)),
    }

    if (query.actorUserIds.length > 0) {
      where.actor_user_id = dbCmd.in(query.actorUserIds)
    }

    if (query.actionTypes.length > 0) {
      where.action_type = dbCmd.in(query.actionTypes)
    }

    let logs = []
    try {
      const result = await db.collection('operation_logs')
        .where(where)
        .orderBy('created_at', 'desc')
        .limit(1000)
        .get()
      logs = result.data || []
    } catch (error) {
      if (!isOperationLogCollectionMissingError(error)) {
        throw error
      }

      console.warn('[operation-log] collection missing, return empty logs')
      return {
        list: [],
        hasMore: false,
        total: 0,
      }
    }

    const sortedLogs = logs.sort((left, right) => (right.created_at || 0) - (left.created_at || 0))
    const total = sortedLogs.length
    const startIndex = (query.page - 1) * query.pageSize
    const list = sortedLogs.slice(startIndex, startIndex + query.pageSize)

    return {
      list,
      hasMore: startIndex + query.pageSize < total,
      total,
    }
  },

  /**
   * 获取已删除项目（回收站）
   */
  async getDeletedItems() {
    const lists = await Promise.all(
      Object.keys(RECYCLE_SUPPORTED_TYPES).map(type => getDeletedDocsByType(this.familyId, type)),
    )

    return {
      data: lists
        .flat()
        .sort((left, right) => (right.deleted_at || 0) - (left.deleted_at || 0)),
    }
  },

  /**
   * 恢复回收站项目
   * @param {{ id: string, type: string }} input
   */
  async restoreItem(input) {
    requireAdmin(this.role)

    const syncMeta = getSyncMeta(input)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response
    const { id, type } = parseRecycleItemInput(input)
    const { config, doc } = await getSoftDeletedDocByType(this.familyId, type, id)

    if (!doc) {
      throw new Error('回收站项目不存在')
    }

    const now = Date.now()
    await db.collection(config.collection).doc(id).update({
      deleted_at: null,
      ...buildVersionUpdate(dbCmd, now),
    })

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'restore',
      domain: 'recycle',
      targetType: type,
      targetId: id,
      targetName: config.name(doc),
      summary: `恢复了回收站项目 ${config.typeLabel}：${config.name(doc)}`,
    })

    const restoredDoc = { ...doc, deleted_at: null, updated_at: now, version: Number(doc.version || 0) + 1 }
    const response = {
      message: '已恢复',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: [buildTouchedEntity(config.collection, restoredDoc)],
        resyncScopes: [config.collection],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 永久删除回收站项目
   * @param {{ id: string, type: string }} input
   */
  async permanentDeleteItem(input) {
    requireAdmin(this.role)

    const syncMeta = getSyncMeta(input)
    const appliedMutation = await findAppliedMutation(db, this.familyId, syncMeta?.clientMutationId)
    if (appliedMutation?.response) return appliedMutation.response
    const { id, type } = parseRecycleItemInput(input)
    const { config, doc } = await getSoftDeletedDocByType(this.familyId, type, id)

    if (!doc) {
      throw new Error('回收站项目不存在')
    }

    await db.collection(config.collection).doc(id).remove()

    await safeWriteOperationLog({
      familyId: this.familyId,
      actorUserId: this.uid,
      actionType: 'delete',
      domain: 'recycle',
      targetType: type,
      targetId: id,
      targetName: config.name(doc),
      summary: `永久删除了回收站项目 ${config.typeLabel}：${config.name(doc)}`,
    })

    const response = {
      message: '已永久删除',
      ...buildSyncAck(syncMeta, {
        ack: 'accepted',
        touchedEntities: [{
          collection: config.collection,
          id,
          version: Number(doc.version || 0),
          updatedAt: Date.now(),
          deletedAt: Date.now(),
        }],
        resyncScopes: [config.collection],
      }),
    }
    if (syncMeta?.clientMutationId) {
      await markMutationApplied(db, this.familyId, syncMeta.clientMutationId, response)
    }
    return response
  },

  /**
   * 获取备份信息
   */
  async getBackupInfo() {
    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ settings: true, created_at: true })
      .get()

    const family = data[0] || data
    return {
      data: {
        lastBackupDate: family.settings?.last_backup_date || null,
        autoBackupEnabled: family.settings?.auto_backup_enabled || false,
      }
    }
  },

  /**
   * 获取护理规则
   */
  async getCareRules() {
    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ care_rules: true })
      .get()

    const family = data[0] || data
    return { data: family.care_rules || [] }
  },
}
