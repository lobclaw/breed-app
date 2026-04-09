/**
 * 健康管理云对象
 * 管理疫苗、驱虫、疾病记录、用药任务
 */
const { verifyAndGetFamily, requireFamily } = require('breed-auth/auth')

const db = uniCloud.database()
const dbCmd = db.command

// ── 内部辅助函数（不能放在 module.exports 内，否则 _ 前缀会被当作生命周期钩子） ──

function validateDetails(type, details) {
  if (type === 'vaccination' && !details.vaccine_type) {
    throw new Error('请填写疫苗类型')
  }
  if (type === 'deworming' && !details.deworming_type) {
    throw new Error('请选择驱虫类型')
  }
}

async function getFamilySettings(familyId) {
  const { data } = await db.collection('families')
    .doc(familyId)
    .field({ settings: true })
    .get()

  const family = data[0] || data
  return family.settings || {
    default_weaning_days: 45,
    default_vaccine_interval_puppy: 21,
    default_vaccine_interval_adult: 365,
    default_deworming_interval_puppy: 14,
    default_deworming_interval_adult: 90,
  }
}

/**
 * 保存自定义疫苗/驱虫类型到家庭设置
 * 预设类型不保存，只保存用户新增的
 */
const PRESET_VACCINE_TYPES = ['卫佳5', '卫佳8', '卫佳10', '狂犬']
const PRESET_DEWORMING_DRUGS = {
  internal: ['拜宠清', '海乐妙', '犬心保'],
  external: ['福来恩', '大宠爱'],
  combo: ['超可信', '博来恩'],
}

async function saveCustomType(familyId, type, details) {
  try {
    if (type === 'vaccination' && details?.vaccine_type) {
      const vt = details.vaccine_type
      if (PRESET_VACCINE_TYPES.includes(vt)) return
      // 先读取已有自定义类型，去重后再写入
      const { data: familyData } = await db.collection('families').doc(familyId).field({ settings: true }).get()
      const family = familyData[0] || familyData || {}
      const existing = family.settings?.custom_vaccine_types || []
      if (existing.includes(vt)) return
      await db.collection('families').doc(familyId).update({
        'settings.custom_vaccine_types': dbCmd.push([vt]),
        updated_at: Date.now(),
      })
    }
    if (type === 'deworming' && details?.drug_name) {
      const drug = details.drug_name
      const subtype = details.deworming_type || 'internal'
      const presetList = PRESET_DEWORMING_DRUGS[subtype] || []
      if (presetList.includes(drug)) return
      const { data: familyData } = await db.collection('families').doc(familyId).field({ settings: true }).get()
      const family = familyData[0] || familyData || {}
      const existing = family.settings?.custom_deworming_drugs?.[subtype] || []
      if (existing.includes(drug)) return
      await db.collection('families').doc(familyId).update({
        [`settings.custom_deworming_drugs.${subtype}`]: dbCmd.push([drug]),
        updated_at: Date.now(),
      })
    }
  } catch (e) {
    console.log('[saveCustomType] failed:', e.message)
  }
}

/**
 * 检查是否已有同类型的 pending 任务在 ±7 天内
 */
async function hasDuplicateTask(familyId, dogId, taskType, dueDate) {
  const WEEK = 7 * 86400000
  const { total } = await db.collection('tasks')
    .where({
      family_id: familyId,
      dog_id: dogId,
      type: taskType,
      status: 'pending',
      due_date: dbCmd.gte(dueDate - WEEK).and(dbCmd.lte(dueDate + WEEK)),
    })
    .count()
  return total > 0
}

/**
 * 录入健康记录后，自动完成该犬同类型的 pending 任务
 * 匹配规则：同犬 + 同类型 + 子类型匹配（或任务无子类型）
 * 返回已完成的任务列表（用于前端提示）
 */
async function autoCompletePendingTasks(familyId, dogId, type, details) {
  const now = Date.now()

  // 查该犬同类型的 pending 任务，按到期日排序，只取最近 1 条
  const { data: tasks } = await db.collection('tasks')
    .where({
      family_id: familyId,
      dog_id: dogId,
      type: type,
      status: 'pending',
    })
    .orderBy('due_date', 'asc')
    .limit(5)
    .get()

  if (!tasks || tasks.length === 0) return []

  // 找第一条子类型匹配的任务
  for (const task of tasks) {
    let match = false
    if (type === 'vaccination') {
      // 任一方无子类型视为通配，或两方匹配
      match = !task.details?.vaccine_type || !details?.vaccine_type || task.details.vaccine_type === details.vaccine_type
    } else if (type === 'deworming') {
      match = !task.details?.deworming_type || !details?.deworming_type || task.details.deworming_type === details.deworming_type
    } else {
      match = true
    }

    if (match) {
      await db.collection('tasks').doc(task._id).update({
        status: 'completed',
        completed_at: now,
        updated_at: now,
      })
      return [{ _id: task._id, dog_name: task.dog_name, title: task.title }]
    }
  }
  return []
}

async function generateReminders(familyId, type, data, dog, recordId, preloadedSettings) {
  const now = Date.now()
  const settings = preloadedSettings || await getFamilySettings(familyId)

  if (type === 'vaccination') {
    const vaccineInterval = (dog.role === '种狗' || dog.role === '外部种公')
      ? (settings.default_vaccine_interval_adult || 365)
      : (settings.default_vaccine_interval_puppy || 21)
    const dueDate = data.details?.next_reminder_date || (data.date + (vaccineInterval * 86400000))
    // 去重：该犬 ±7 天内已有同类型 pending 任务则不创建
    if (await hasDuplicateTask(familyId, dog._id, 'vaccination', dueDate)) return

    await db.collection('tasks').add({
      card_type: 'individual',
      dog_id: dog._id,
      dog_name: dog.name,
      type: 'vaccination',
      title: data.details?.vaccine_type ? `疫苗 · ${data.details.vaccine_type}` : '疫苗',
      due_date: dueDate,
      status: 'pending',
      priority: 'upcoming',
      source_record_id: recordId,
      source_collection: 'health_records',
      family_id: familyId,
      postpone_count: 0,
      details: { vaccine_type: data.details?.vaccine_type || null },
      created_at: now,
      updated_at: now,
    })
  }

  if (type === 'deworming') {
    const dewormInterval = (dog.role === '种狗' || dog.role === '外部种公')
      ? (settings.default_deworming_interval_adult || 90)
      : (settings.default_deworming_interval_puppy || 14)
    const nextDate = data.details?.next_reminder_date ||
      (data.date + (dewormInterval * 86400000))

    if (await hasDuplicateTask(familyId, dog._id, 'deworming', nextDate)) return

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
      details: { deworming_type: data.details?.deworming_type || null, drug_name: data.details?.drug_name || null },
      created_at: now,
      updated_at: now,
    })
  }

  if (type === 'illness' && data.details?.next_reminder_date) {
    await db.collection('tasks').add({
      card_type: 'individual',
      dog_id: dog._id,
      dog_name: dog.name,
      type: 'illness',
      title: `${dog.name} · ${data.details?.condition || '疾病'}复查`,
      due_date: data.details.next_reminder_date,
      status: 'pending',
      priority: 'upcoming',
      source_record_id: recordId,
      source_collection: 'health_records',
      family_id: familyId,
      postpone_count: 0,
      details: {
        condition: data.details?.condition || null,
        severity: data.details?.severity || null,
        treatment_status: data.details?.treatment_status || null,
      },
      created_at: now,
      updated_at: now,
    })
  }
}

async function createExpense(familyId, uid, data, dog, sourceRecordId) {
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
    family_id: familyId,
    created_by: uid,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  })
}

module.exports = {
  _before: async function() {
    const { uid, familyId, role } = await verifyAndGetFamily(this.getUniIdToken(), this.getClientInfo())
    this.uid = uid
    this.familyId = familyId
    this.role = role
    requireFamily(familyId)
  },

  _after: function(error, result) {
    if (error) {
      return { errCode: error.code || -1, errMsg: error.message }
    }
    return result
  },

  /**
   * 预热接口（App 启动时静默调用，消除冷启动）
   */
  async ping() {
    return { data: { ok: true } }
  },

  /**
   * 录入健康记录（vaccination/deworming/illness）
   * 自动生成下次提醒任务 + 创建费用
   */
  /**
   * 更新疾病记录的治疗状态（标记康复/改为治疗中等）
   */
  async updateIllnessStatus(recordId, newStatus) {
    const familyId = this.familyId
    await db.collection('health_records').where({
      _id: recordId,
      family_id: familyId,
    }).update({
      'details.treatment_status': newStatus,
      updated_at: Date.now(),
    })
    return { data: { success: true } }
  },

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
    validateDetails(data.type, data.details || {})

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

    // 保存自定义类型到家庭设置（如果是新类型）
    await saveCustomType(familyId, data.type, data.details)

    // 自动完成该犬同类型的 pending 待办（在创建新提醒之前）
    const completedTasks = await autoCompletePendingTasks(familyId, data.dog_id, data.type, data.details)

    // 生成下次提醒任务（skip_reminder 时跳过）
    if (!data.skip_reminder) {
      await generateReminders(familyId, data.type, data, dog, recordId)
    }

    // 如有费用 → 创建 expense
    if (data.cost && data.cost > 0) {
      await createExpense(familyId, this.uid, data, dog, recordId)
    }

    return { data: { recordId, completedTasks } }
  },

  /**
   * 批量录入健康记录（多犬同类型）
   * 一次鉴权 + 一次犬只校验 + 一次读 settings + 并行写入
   */
  async batchAddHealthRecords(data) {
    if (!data.type) throw new Error('请选择记录类型')
    if (!data.dog_ids || !Array.isArray(data.dog_ids) || data.dog_ids.length === 0) throw new Error('请选择犬只')
    if (!data.date) throw new Error('请选择日期')

    const validTypes = ['vaccination', 'deworming', 'illness']
    if (!validTypes.includes(data.type)) throw new Error('无效的记录类型')

    validateDetails(data.type, data.details || {})

    const now = Date.now()
    const familyId = this.familyId
    const uid = this.uid

    // ① 一次查询校验所有犬只
    const { data: dogs } = await db.collection('dogs')
      .where({ _id: dbCmd.in(data.dog_ids), family_id: familyId, deleted_at: null })
      .get()
    if (dogs.length !== data.dog_ids.length) throw new Error('部分犬只不存在或不属于当前家庭')

    // ② 一次读取 family settings
    const settings = await getFamilySettings(familyId)

    // ③ 一次保存自定义类型
    await saveCustomType(familyId, data.type, data.details)

    // ④ 费用分摊
    const totalCost = data.cost || null
    const perDogCost = totalCost && dogs.length > 1
      ? Math.round(totalCost / dogs.length * 100) / 100
      : totalCost

    // ⑤ 并行处理每只犬
    const results = await Promise.all(dogs.map(async (dog) => {
      const recordData = {
        type: data.type,
        dog_id: dog._id,
        family_id: familyId,
        date: data.date,
        cost: perDogCost && perDogCost > 0 ? perDogCost : null,
        notes: data.notes || null,
        details: data.details || {},
        created_by: uid,
        created_at: now,
        updated_at: now,
      }
      const { id: recordId } = await db.collection('health_records').add(recordData)

      // 自动完成该犬同类型的 pending 待办
      const completedTasks = await autoCompletePendingTasks(familyId, dog._id, data.type, data.details)

      // 生成下次提醒任务（传入预加载的 settings）
      if (!data.skip_reminder) {
        await generateReminders(familyId, data.type, data, dog, recordId, settings)
      }

      // 创建费用
      if (perDogCost && perDogCost > 0) {
        await createExpense(familyId, uid, {
          type: data.type, date: data.date, cost: perDogCost,
          dog_id: dog._id, notes: data.notes || null,
        }, dog, recordId)
      }

      return { recordId, dog_id: dog._id, completedTasks }
    }))

    return {
      data: {
        count: results.length,
        records: results.map(r => ({ recordId: r.recordId, dog_id: r.dog_id })),
        completedTasks: results.flatMap(r => r.completedTasks),
      }
    }
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
  /**
   * 检查犬只是否已有同药名的进行中用药任务
   */
  async checkDuplicateMedication(dogId, drugName) {
    if (!dogId || !drugName) return { data: null }
    const { data: existing } = await db.collection('medication_tasks')
      .where({
        family_id: this.familyId,
        dog_id: dogId,
        drug_name: drugName,
        status: '进行中',
      })
      .limit(1)
      .get()
    if (existing && existing.length > 0) {
      const task = existing[0]
      const daysPassed = Math.max(1, Math.ceil((Date.now() - task.actual_start_date) / 86400000))
      return {
        data: {
          exists: true,
          dogName: task.dog_name || '',
          drugName: task.drug_name,
          day: daysPassed,
          totalDays: task.duration_days,
        }
      }
    }
    return { data: null }
  },

  /**
   * 批量检查重复用药（一次查询）
   */
  async batchCheckDuplicateMedication(dogIds, drugName) {
    if (!dogIds || !Array.isArray(dogIds) || !drugName) return { data: [] }

    const { data: existing } = await db.collection('medication_tasks')
      .where({
        family_id: this.familyId,
        dog_id: dbCmd.in(dogIds),
        drug_name: drugName,
        status: '进行中',
      })
      .get()

    const results = (existing || []).map(task => {
      const daysPassed = Math.max(1, Math.ceil((Date.now() - task.actual_start_date) / 86400000))
      return {
        dog_id: task.dog_id,
        dogName: task.dog_name || '',
        drugName: task.drug_name,
        day: daysPassed,
        totalDays: task.duration_days,
      }
    })

    return { data: results }
  },

  /**
   * 批量创建用药任务（多犬同药）
   * 一次校验 + 并行创建 medication_tasks + 费用 + 疾病升级
   */
  async batchStartMedication(data) {
    if (!data.dog_ids || !Array.isArray(data.dog_ids) || data.dog_ids.length === 0) throw new Error('请选择犬只')
    if (!data.drug_name) throw new Error('请填写药品名称')
    const durationDays = (data.duration_days && data.duration_days >= 1) ? data.duration_days : 1

    const now = Date.now()
    const familyId = this.familyId
    const uid = this.uid
    const startDate = data.actual_start_date || now

    // ① 一次校验所有犬只
    const { data: dogs } = await db.collection('dogs')
      .where({ _id: dbCmd.in(data.dog_ids), family_id: familyId, deleted_at: null })
      .get()
    if (dogs.length !== data.dog_ids.length) throw new Error('部分犬只不存在或不属于当前家庭')

    // ② 费用分摊
    const totalCost = data.cost || null
    const perDogCost = totalCost && dogs.length > 1
      ? Math.round(totalCost / dogs.length * 100) / 100
      : totalCost

    // ③ 并行创建
    const results = await Promise.all(dogs.map(async (dog) => {
      // 覆盖模式：先取消该犬的同名进行中任务
      if (data.override_dog_ids && data.override_dog_ids.includes(dog._id)) {
        const { data: existingMeds } = await db.collection('medication_tasks')
          .where({ dog_id: dog._id, family_id: familyId, drug_name: data.drug_name, status: '进行中' })
          .get()
        await Promise.all((existingMeds || []).map(med =>
          db.collection('medication_tasks').doc(med._id).update({ status: '已取消', updated_at: now })
        ))
      }

      const medicationData = {
        dog_id: dog._id,
        dog_name: dog.name,
        family_id: familyId,
        protocol_id: data.protocol_id || null,
        drug_name: data.drug_name,
        dosage: data.dosage || null,
        dosage_unit: data.dosage_unit || null,
        method: data.method || '口服',
        frequency: data.frequency || 1,
        duration_days: durationDays,
        actual_start_date: startDate,
        status: '进行中',
        daily_doses: {},
        notes: data.notes || null,
        created_at: now,
        updated_at: now,
      }
      const { id: medicationId } = await db.collection('medication_tasks').add(medicationData)

      // 创建费用
      if (perDogCost && perDogCost > 0) {
        await db.collection('expenses').add({
          family_id: familyId, dog_id: dog._id, dog_name: dog.name,
          category: '医疗', sub_category: '用药',
          amount: perDogCost, date: startDate,
          notes: `${data.drug_name} ${durationDays}天`,
          source_type: 'medication_task', source_id: medicationId,
          created_by: uid, created_at: now, updated_at: now,
        })
      }

      // 疾病升级：观察中 → 治疗中
      if (data.illnessRecordId && dogs.length === 1) {
        // 单犬从疾病表单跳转：只升级指定疾病记录
        const { data: ill } = await db.collection('health_records')
          .where({ _id: data.illnessRecordId, family_id: familyId })
          .get()
        if (ill && ill.length > 0) {
          await db.collection('health_records').doc(data.illnessRecordId).update({
            'details.treatment_status': '治疗中', updated_at: now,
          })
        }
      } else {
        // 批量或无指定：升级该犬所有观察中的疾病
        const { data: activeIllnesses } = await db.collection('health_records')
          .where({
            family_id: familyId, dog_id: dog._id, type: 'illness',
            'details.treatment_status': '观察中', deleted_at: null,
          })
          .get()
        if (activeIllnesses && activeIllnesses.length > 0) {
          for (const r of activeIllnesses) {
            await db.collection('health_records').doc(r._id).update({
              'details.treatment_status': '治疗中', updated_at: now,
            })
          }
        }
      }

      return { medicationId, dog_id: dog._id }
    }))

    return { data: { count: results.length, medications: results } }
  },

  async startMedication(data) {
    if (!data.dog_id) throw new Error('请选择犬只')
    if (!data.drug_name) throw new Error('请填写药品名称')
    const durationDays = (data.duration_days && data.duration_days >= 1) ? data.duration_days : 1

    const now = Date.now()
    const familyId = this.familyId

    // 校验犬只
    const { data: dogs } = await db.collection('dogs')
      .where({ _id: data.dog_id, family_id: familyId, deleted_at: null })
      .get()
    if (!dogs || dogs.length === 0) throw new Error('犬只不存在')
    const dog = dogs[0]

    const startDate = data.actual_start_date || now

    // 创建用药任务（单条记录，不预生成每日 task）
    const medicationData = {
      dog_id: data.dog_id,
      dog_name: dog.name,
      family_id: familyId,
      protocol_id: data.protocol_id || null,
      drug_name: data.drug_name,
      dosage: data.dosage || null,
      dosage_unit: data.dosage_unit || null,
      method: data.method || '口服',
      frequency: data.frequency || 1,
      duration_days: durationDays,
      actual_start_date: startDate,
      status: '进行中',
      daily_doses: {},
      notes: data.notes || null,
      created_at: now,
      updated_at: now,
    }
    const { id: medicationId } = await db.collection('medication_tasks').add(medicationData)

    // 如有费用 → 创建 expense
    if (data.cost && data.cost > 0) {
      await db.collection('expenses').add({
        family_id: familyId,
        dog_id: data.dog_id,
        dog_name: dog.name,
        category: '医疗',
        sub_category: '用药',
        amount: data.cost,
        date: startDate,
        notes: `${data.drug_name} ${durationDays}天`,
        source_type: 'medication_task',
        source_id: medicationId,
        created_by: this.uid,
        created_at: now,
        updated_at: now,
      })
    }

    // 自动将该犬"观察中"的活跃疾病记录升级为"治疗中"
    if (data.illnessRecordId) {
      // 从疾病表单跳转过来：只升级指定记录，校验归属
      const { data: ill } = await db.collection('health_records')
        .where({ _id: data.illnessRecordId, family_id: familyId })
        .get()
      if (ill && ill.length > 0) {
        await db.collection('health_records').doc(data.illnessRecordId).update({
          'details.treatment_status': '治疗中',
          updated_at: now,
        })
      }
    } else {
      // 独立创建用药：查找该犬所有"观察中"的活跃疾病记录，一并升级
      const { data: activeIllnesses } = await db.collection('health_records')
        .where({
          family_id: familyId,
          dog_id: data.dog_id,
          type: 'illness',
          'details.treatment_status': '观察中',
          deleted_at: null,
        })
        .get()
      if (activeIllnesses && activeIllnesses.length > 0) {
        for (const r of activeIllnesses) {
          await db.collection('health_records').doc(r._id).update({
            'details.treatment_status': '治疗中',
            updated_at: now,
          })
        }
      }
    }

    return { data: { medicationId } }
  },

  /**
   * 记录一次给药（打卡模式）
   * 原子递增 daily_doses.{day}，达到 frequency 时当天完成，全部天数完成时结束用药
   */
  async recordMedicationDose(medicationTaskId) {
    if (!medicationTaskId) throw new Error('缺少用药任务 ID')

    const familyId = this.familyId
    const now = Date.now()

    const { data: meds } = await db.collection('medication_tasks')
      .where({ _id: medicationTaskId, family_id: familyId, status: '进行中' })
      .get()
    if (!meds || meds.length === 0) return { data: { completed: false, already_done: true } }

    const med = meds[0]
    const frequency = med.frequency || 1

    // 计算今天是第几天
    const startDate = new Date(med.actual_start_date); startDate.setHours(0, 0, 0, 0)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const currentDay = Math.floor((today.getTime() - startDate.getTime()) / 86400000) + 1
    if (currentDay < 1 || currentDay > med.duration_days) {
      return { data: { completed: false, out_of_range: true } }
    }

    const dayKey = String(currentDay)

    // 原子递增当天给药次数
    await db.collection('medication_tasks').doc(medicationTaskId).update({
      [`daily_doses.${dayKey}`]: dbCmd.inc(1),
      updated_at: now,
    })

    // 重新读取判断完成状态
    const { data: updated } = await db.collection('medication_tasks').doc(medicationTaskId).get()
    const updatedMed = updated[0] || updated
    const todayDoses = updatedMed.daily_doses?.[dayKey] || 0
    const todayComplete = todayDoses >= frequency

    // 检查是否所有天数都已完成
    let allComplete = false
    if (todayComplete) {
      allComplete = true
      for (let d = 1; d <= med.duration_days; d++) {
        if ((updatedMed.daily_doses?.[String(d)] || 0) < frequency) {
          allComplete = false
          break
        }
      }
      if (allComplete) {
        await db.collection('medication_tasks').doc(medicationTaskId).update({
          status: '已完成',
          updated_at: now,
        })
      }
    }

    return { data: { doses_given: todayDoses, completed: todayComplete, allComplete } }
  },

  /**
   * 批量完成今日用药（卡片底部"完成"按钮）
   * 将指定的 medication_tasks 今天的 doses 全部补满
   */
  async batchCompleteMedicationDay(medicationTaskIds) {
    if (!medicationTaskIds || !Array.isArray(medicationTaskIds) || medicationTaskIds.length === 0) {
      throw new Error('缺少用药任务 ID')
    }

    const familyId = this.familyId
    const now = Date.now()
    const today = new Date(); today.setHours(0, 0, 0, 0)

    const { data: meds } = await db.collection('medication_tasks')
      .where({ _id: dbCmd.in(medicationTaskIds), family_id: familyId, status: '进行中' })
      .get()

    for (const med of meds) {
      const startDate = new Date(med.actual_start_date); startDate.setHours(0, 0, 0, 0)
      const currentDay = Math.floor((today.getTime() - startDate.getTime()) / 86400000) + 1
      if (currentDay < 1 || currentDay > med.duration_days) continue

      const dayKey = String(currentDay)
      const frequency = med.frequency || 1
      const currentDoses = med.daily_doses?.[dayKey] || 0
      if (currentDoses >= frequency) continue

      // 直接设置为 frequency（补满）
      await db.collection('medication_tasks').doc(med._id).update({
        [`daily_doses.${dayKey}`]: frequency,
        updated_at: now,
      })

      // 检查全部完成
      const updatedDoses = { ...med.daily_doses, [dayKey]: frequency }
      let allComplete = true
      for (let d = 1; d <= med.duration_days; d++) {
        if ((updatedDoses[String(d)] || 0) < frequency) {
          allComplete = false
          break
        }
      }
      if (allComplete) {
        await db.collection('medication_tasks').doc(med._id).update({
          status: '已完成',
          updated_at: now,
        })
      }
    }

    return { data: { completed: meds.length } }
  },

  /**
   * 标记今日用药完成（旧接口，兼容已有 daily tasks）
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

    // 兼容旧数据：取消关联的 daily tasks（新记录没有，旧记录可能有）
    await db.collection('tasks').where({
      medication_task_id: medicationTaskId,
      status: 'pending',
    }).update({
      status: 'cancelled',
      updated_at: now,
    })

    return { message: '用药已提前结束' }
  },

  /**
   * 按犬只停止所有进行中的用药（从首页健康关注卡调用）
   */
  async endMedicationByDog(dogId) {
    if (!dogId) throw new Error('缺少犬只 ID')

    const now = Date.now()
    const familyId = this.familyId

    // 找到该犬所有进行中的用药方案
    const { data: meds } = await db.collection('medication_tasks')
      .where({ dog_id: dogId, family_id: familyId, status: '进行中' })
      .get()

    let cancelled = 0
    for (const med of meds) {
      await db.collection('medication_tasks').doc(med._id).update({
        status: '已取消',
        updated_at: now,
      })
      // 兼容旧数据：取消关联的 daily tasks
      await db.collection('tasks').where({
        medication_task_id: med._id,
        status: 'pending',
      }).update({
        status: 'cancelled',
        updated_at: now,
      })
      cancelled++
    }

    return { message: `已停止 ${cancelled} 个用药方案` }
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
   * 获取健康记录详情
   */
  async getHealthRecordDetail({ id }) {
    if (!id) throw new Error('缺少记录 ID')

    const { data: records } = await db.collection('health_records')
      .where({ _id: id, family_id: this.familyId })
      .get()
    if (!records || records.length === 0) throw new Error('记录不存在')

    return records[0]
  },

  /**
   * 更新健康记录
   */
  async updateHealthRecord({ id, date, cost, notes, details }) {
    if (!id) throw new Error('缺少记录 ID')

    const { data: records } = await db.collection('health_records')
      .where({ _id: id, family_id: this.familyId })
      .get()
    if (!records || records.length === 0) throw new Error('记录不存在')

    const updateData = { updated_at: Date.now() }
    if (date !== undefined) updateData.date = date
    if (cost !== undefined) updateData.cost = cost
    if (notes !== undefined) updateData.notes = notes
    if (details !== undefined) updateData.details = details

    await db.collection('health_records').doc(id).update(updateData)

    return { message: '已更新' }
  },

  /**
   * 获取某犬的体重历史
   */
  /**
   * 单犬体重录入
   */
  async addWeightRecord({ dog_id, weight, date, notes } = {}) {
    if (!dog_id) throw new Error('缺少犬只 ID')
    if (!weight || Number(weight) <= 0) throw new Error('请输入有效体重')

    const now = Date.now()
    const familyId = this.familyId

    const { data: dogs } = await db.collection('dogs')
      .where({ _id: dog_id, family_id: familyId, deleted_at: null })
      .get()
    if (!dogs || dogs.length === 0) throw new Error('犬只不存在')

    await db.collection('dog_weights').add({
      dog_id,
      weight: Number(weight),
      date: date || now,
      notes: notes || null,
      family_id: familyId,
      created_by: this.uid,
      created_at: now,
      updated_at: now,
    })

    // 更新犬只 latest_weight（取最新日期的记录）
    const { data: latest } = await db.collection('dog_weights')
      .where({ dog_id, family_id: familyId })
      .orderBy('date', 'desc')
      .limit(1)
      .get()
    if (latest?.[0]?.weight) {
      await db.collection('dogs').doc(dog_id).update({ latest_weight: latest[0].weight })
    }

    return { message: '已保存' }
  },

  async getWeightHistory(dogId) {
    if (!dogId) throw new Error('缺少犬只 ID')

    const { data: records } = await db.collection('dog_weights')
      .where({ dog_id: dogId, family_id: this.familyId })
      .orderBy('date', 'asc')
      .get()

    return { data: records }
  },
}
