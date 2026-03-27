/**
 * 家庭云对象
 * 管理家庭创建、成员管理、设置
 */
const { verifyAndGetFamily, requireAdmin, requireFamily } = require('breed-auth/auth')

const db = uniCloud.database()
const dbCmd = db.command

// 家庭设置默认值
const DEFAULT_SETTINGS = {
  default_weaning_days: 45,
  default_vaccine_interval: 21,
  default_deworming_interval_puppy: 14,
  default_deworming_interval_adult: 90,
  morning_summary_time: '07:00',
}

module.exports = {
  _before: async function() {
    // createFamily 和 joinFamily 允许无家庭用户调用
    const skipFamilyCheck = ['createFamily', 'joinFamily']
    const { uid, familyId, role } = await verifyAndGetFamily(this.getUniIdToken())
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
      return { code: error.code || -1, message: error.message }
    }
    return { code: 0, ...result }
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
    return { data: { familyId: id } }
  },

  /**
   * 获取当前用户的家庭信息
   */
  async getFamilyInfo() {
    const { data } = await db.collection('families')
      .doc(this.familyId)
      .get()

    if (!data || data.length === 0) {
      throw new Error('家庭不存在')
    }

    return { data: data[0] || data }
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

    // 只允许更新已知的设置字段
    const allowedKeys = Object.keys(DEFAULT_SETTINGS)
    const updateData = {}
    for (const key of allowedKeys) {
      if (settings[key] !== undefined) {
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

    await db.collection('families')
      .doc(this.familyId)
      .update({
        name: name.trim(),
        updated_at: Date.now(),
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

    family.care_rules.splice(index, 1)

    await db.collection('families')
      .doc(this.familyId)
      .update({
        care_rules: family.care_rules,
        updated_at: Date.now(),
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

    await db.collection('families')
      .doc(this.familyId)
      .update({
        invite_code: code,
        invite_expires: now + 24 * 60 * 60 * 1000,
        updated_at: now,
      })

    return { data: { code } }
  },

  /**
   * 通过邀请码加入家庭
   */
  async joinFamily(inviteCode) {
    if (!inviteCode) throw new Error('请输入邀请码')
    if (this.familyId) throw new Error('您已加入家庭，V1 暂不支持多家庭')

    const now = Date.now()

    const { data: families } = await db.collection('families')
      .where({
        invite_code: inviteCode.toUpperCase(),
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

    member.role = newRole

    await db.collection('families').doc(this.familyId).update({
      members: family.members,
      updated_at: now,
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

    return { message: '成员已移除' }
  },
}
