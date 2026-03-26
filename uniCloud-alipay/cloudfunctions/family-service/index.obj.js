/**
 * 家庭云对象
 * 管理家庭创建、成员管理、设置
 */
const { verifyAndGetFamily, requireAdmin, requireFamily } = require('common/auth')

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
}
