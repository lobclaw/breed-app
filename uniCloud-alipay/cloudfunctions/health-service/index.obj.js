/**
 * 健康管理云对象
 * 管理疫苗、驱虫、疾病记录、用药任务
 */
const { verifyAndGetFamily, requireFamily } = require('common/auth')

const db = uniCloud.database()
const dbCmd = db.command

module.exports = {
  _before: async function() {
    const { uid, familyId, role } = await verifyAndGetFamily(this.getUniIdToken())
    this.uid = uid
    this.familyId = familyId
    this.role = role
    requireFamily(familyId)
  },

  _after: function(error, result) {
    if (error) {
      return { code: error.code || -1, message: error.message }
    }
    return { code: 0, ...result }
  },

  /**
   * 录入健康记录（vaccination/deworming/illness）
   * 自动生成下次提醒任务 + 创建费用
   */
  async addHealthRecord(data) {
    if (!data.type) throw new Error('请选择记录类型')
    if (!data.dog_id) throw new Error('请选择犬只')
    if (!data.date) throw new Error('请选择日期')

    const validTypes = ['vaccination', 'deworming', 'illness']
    if (!validTypes.includes(data.type)) throw new Error('无效的记录类型')

    const now = Date.now()
    const familyId = this.familyId

    // 校验犬只
    const { data: dogs } = await db.collection('dogs')
      .where({ _id: data.dog_id, family_id: familyId, deleted_at: null })
      .get()
    if (!dogs || dogs.length === 0) throw new Error('犬只不存在')
    const dog = dogs[0]

    // 类型特有字段校验
    this._validateDetails(data.type, data.details || {})

    // 创建健康记录
    const recordData = {
      type: data.type,
      dog_id: data.dog_id,
      family_id: familyId,
      date: data.date,
      cost: data.cost || null,
      notes: data.notes || null,
      details: data.details || {},
      created_by: this.uid,
      created_at: now,
      updated_at: now,
    }
    const { id: recordId } = await db.collection('health_records').add(recordData)

    // 生成下次提醒任务
    await this._generateReminders(data.type, data, dog, recordId)

    // 如有费用 → 创建 expense
    if (data.cost && data.cost > 0) {
      await this._createExpense(data, dog, recordId)
    }

    return { data: { recordId } }
  },

  /**
   * 获取某犬的健康记录
   */
  async getHealthHistory(dogId, type) {
    if (!dogId) throw new Error('缺少犬只 ID')

    const where = { dog_id: dogId, family_id: this.familyId }
    if (type) where.type = type

    const { data: records } = await db.collection('health_records')
      .where(where)
      .orderBy('date', 'desc')
      .get()

    return { data: records }
  },

  /**
   * 开始连续用药
   */
  async startMedication(data) {
    if (!data.dog_id) throw new Error('请选择犬只')
    if (!data.drug_name) throw new Error('请填写药品名称')
    if (!data.duration_days || data.duration_days < 1) throw new Error('请填写用药天数')

    const now = Date.now()
    const familyId = this.familyId

    // 校验犬只
    const { data: dogs } = await db.collection('dogs')
      .where({ _id: data.dog_id, family_id: familyId, deleted_at: null })
      .get()
    if (!dogs || dogs.length === 0) throw new Error('犬只不存在')
    const dog = dogs[0]

    const startDate = data.actual_start_date || now

    // 创建用药任务
    const medicationData = {
      dog_id: data.dog_id,
      family_id: familyId,
      protocol_id: data.protocol_id || null,
      drug_name: data.drug_name,
      dosage: data.dosage || null,
      dosage_unit: data.dosage_unit || null,
      method: data.method || '口服',
      frequency: data.frequency || 1,
      duration_days: data.duration_days,
      actual_start_date: startDate,
      status: '进行中',
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
    }
    const { id: medicationId } = await db.collection('medication_tasks').add(medicationData)

    // 生成每日用药提醒任务
    for (let day = 0; day < data.duration_days; day++) {
      await db.collection('tasks').add({
        card_type: 'individual',
        dog_id: data.dog_id,
        dog_name: dog.name,
        medication_task_id: medicationId,
        type: 'medication',
        title: `${dog.name} · ${data.drug_name} 第${day + 1}天/${data.duration_days}天`,
        due_date: startDate + day * 86400000,
        status: 'pending',
        priority: day === 0 ? 'today' : 'upcoming',
        family_id: familyId,
        postpone_count: 0,
        created_at: now,
        updated_at: now,
      })
    }

    return { data: { medicationId } }
  },

  /**
   * 标记今日用药完成
   */
  async completeDailyMedication(taskId) {
    if (!taskId) throw new Error('缺少任务 ID')

    const now = Date.now()

    const { data: tasks } = await db.collection('tasks')
      .where({ _id: taskId, family_id: this.familyId })
      .get()
    if (!tasks || tasks.length === 0) throw new Error('任务不存在')

    await db.collection('tasks').doc(taskId).update({
      status: 'completed',
      completed_by: this.uid,
      completed_at: now,
      updated_at: now,
    })

    // 检查是否所有用药任务都已完成
    const task = tasks[0]
    if (task.medication_task_id) {
      const { data: remaining } = await db.collection('tasks')
        .where({
          medication_task_id: task.medication_task_id,
          family_id: this.familyId,
          status: 'pending',
        })
        .get()

      if (remaining.length === 0) {
        // 全部完成 → 更新 medication_task 状态
        await db.collection('medication_tasks').doc(task.medication_task_id).update({
          status: '已完成',
          updated_at: now,
        })
      }
    }

    return { message: '已标记完成' }
  },

  /**
   * 提前结束用药
   */
  async endMedication(medicationTaskId) {
    if (!medicationTaskId) throw new Error('缺少用药任务 ID')

    const now = Date.now()

    const { data: meds } = await db.collection('medication_tasks')
      .where({ _id: medicationTaskId, family_id: this.familyId })
      .get()
    if (!meds || meds.length === 0) throw new Error('用药任务不存在')
    if (meds[0].status !== '进行中') throw new Error('该用药已结束')

    // 更新用药状态
    await db.collection('medication_tasks').doc(medicationTaskId).update({
      status: '已取消',
      updated_at: now,
    })

    // 取消剩余用药提醒
    await db.collection('tasks').where({
      medication_task_id: medicationTaskId,
      status: 'pending',
    }).update({
      status: 'cancelled',
      updated_at: now,
    })

    return { message: '用药已提前结束' }
  },

  // ── 内部方法 ──

  _validateDetails(type, details) {
    if (type === 'vaccination' && !details.vaccine_type) {
      throw new Error('请填写疫苗类型')
    }
    if (type === 'deworming' && !details.deworming_type) {
      throw new Error('请选择驱虫类型')
    }
  },

  async _generateReminders(type, data, dog, recordId) {
    const now = Date.now()
    const familyId = this.familyId
    const settings = await this._getFamilySettings()

    if (type === 'vaccination' && data.details?.next_reminder_date) {
      await db.collection('tasks').add({
        card_type: 'individual',
        dog_id: dog._id,
        dog_name: dog.name,
        type: 'vaccination',
        title: `${dog.name} · 下次疫苗`,
        due_date: data.details.next_reminder_date,
        status: 'pending',
        priority: 'upcoming',
        source_record_id: recordId,
        source_collection: 'health_records',
        family_id: familyId,
        postpone_count: 0,
        created_at: now,
        updated_at: now,
      })
    } else if (type === 'vaccination') {
      // 默认间隔
      await db.collection('tasks').add({
        card_type: 'individual',
        dog_id: dog._id,
        dog_name: dog.name,
        type: 'vaccination',
        title: `${dog.name} · 下次疫苗`,
        due_date: data.date + (settings.default_vaccine_interval * 86400000),
        status: 'pending',
        priority: 'upcoming',
        source_record_id: recordId,
        source_collection: 'health_records',
        family_id: familyId,
        postpone_count: 0,
        created_at: now,
        updated_at: now,
      })
    }

    if (type === 'deworming') {
      const nextDate = data.details?.next_reminder_date ||
        (data.date + (settings.default_deworming_interval_adult * 86400000))

      await db.collection('tasks').add({
        card_type: 'individual',
        dog_id: dog._id,
        dog_name: dog.name,
        type: 'deworming',
        title: `${dog.name} · 下次驱虫`,
        due_date: nextDate,
        status: 'pending',
        priority: 'upcoming',
        source_record_id: recordId,
        source_collection: 'health_records',
        family_id: familyId,
        postpone_count: 0,
        created_at: now,
        updated_at: now,
      })
    }
  },

  /**
   * 获取用药方案列表
   */
  async getMedicationProtocols() {
    const { data: protocols } = await db.collection('medication_protocols')
      .where({ family_id: this.familyId, deleted_at: null })
      .orderBy('created_at', 'desc')
      .get()

    return { data: protocols }
  },

  /**
   * 新增用药方案
   */
  async addMedicationProtocol(data) {
    if (!data.name) throw new Error('请填写方案名称')
    if (!data.drug_name) throw new Error('请填写药品名称')

    const now = Date.now()

    const { id } = await db.collection('medication_protocols').add({
      name: data.name,
      drug_name: data.drug_name,
      duration_days: data.duration_days || null,
      notes: data.notes || null,
      family_id: this.familyId,
      created_by: this.uid,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    })

    return { data: { protocolId: id } }
  },

  /**
   * 软删除用药方案
   */
  async removeMedicationProtocol(id) {
    if (!id) throw new Error('缺少方案 ID')

    const { data: protocols } = await db.collection('medication_protocols')
      .where({ _id: id, family_id: this.familyId })
      .get()
    if (!protocols || protocols.length === 0) throw new Error('方案不存在')

    await db.collection('medication_protocols').doc(id).update({
      deleted_at: Date.now(),
    })

    return { message: '已删除' }
  },

  /**
   * 批量录入幼犬体重
   */
  async batchAddWeights(litterId, weights) {
    if (!litterId) throw new Error('缺少窝次 ID')
    if (!weights || !Array.isArray(weights) || weights.length === 0) throw new Error('请提供体重数据')

    const now = Date.now()
    const familyId = this.familyId

    // 校验窝次归属当前家庭
    const { data: litters } = await db.collection('litters')
      .where({ _id: litterId, family_id: familyId })
      .get()
    if (!litters || litters.length === 0) throw new Error('窝次不存在')

    // 校验所有 dog_id 归属当前家庭
    const dogIds = [...new Set(weights.map(w => w.dog_id))]
    const { data: dogs } = await db.collection('dogs')
      .where({ family_id: familyId, deleted_at: null })
      .get()
    const familyDogIds = new Set(dogs.map(d => d._id))
    for (const dogId of dogIds) {
      if (!familyDogIds.has(dogId)) throw new Error('犬只不属于当前家庭')
    }

    for (const entry of weights) {
      await db.collection('dog_weights').add({
        dog_id: entry.dog_id,
        litter_id: litterId,
        weight: Number(entry.weight),
        date: entry.date,
        family_id: familyId,
        created_by: this.uid,
        created_at: now,
        updated_at: now,
      })
    }

    return { data: { count: weights.length } }
  },

  /**
   * 获取某犬的体重历史
   */
  async getWeightHistory(dogId) {
    if (!dogId) throw new Error('缺少犬只 ID')

    const { data: records } = await db.collection('dog_weights')
      .where({ dog_id: dogId, family_id: this.familyId })
      .orderBy('date', 'asc')
      .get()

    return { data: records }
  },

  async _createExpense(data, dog, sourceRecordId) {
    const now = Date.now()
    const typeLabels = {
      vaccination: '疫苗',
      deworming: '驱虫',
      illness: '治疗',
    }

    await db.collection('expenses').add({
      total_amount: data.cost,
      category: typeLabels[data.type] || '健康',
      date: data.date,
      notes: data.notes || null,
      linked_dog_ids: [data.dog_id],
      dog_names: [dog.name],
      source_type: 'auto',
      source_record_id: sourceRecordId || null,
      family_id: this.familyId,
      created_by: this.uid,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    })
  },

  async _getFamilySettings() {
    const { data } = await db.collection('families')
      .doc(this.familyId)
      .field({ settings: true })
      .get()

    const family = data[0] || data
    return family.settings || {
      default_weaning_days: 45,
      default_vaccine_interval: 21,
      default_deworming_interval_puppy: 14,
      default_deworming_interval_adult: 90,
    }
  },
}
