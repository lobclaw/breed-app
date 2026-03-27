/**
 * 繁育流程云对象
 * 管理繁育周期生命周期、8种记录类型、窝管理
 */
const { verifyAndGetFamily, requireFamily, requireAdmin } = require('breed-auth/auth')

const db = uniCloud.database()
const dbCmd = db.command

// 繁育记录类型 → 状态转换
const STATUS_TRANSITIONS = {
  heat: '发情中',
  follicle_check: null,       // 不触发状态变更
  mating: '怀孕中',
  pregnancy_check: null,
  prenatal_check: null,
  pre_labor: null,
  birth: '已生产',
  abnormal_termination: '失败',
}

// 需要自动创建周期的记录类型
const CYCLE_TRIGGER_TYPES = ['heat', 'follicle_check', 'mating']

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
   * 录入繁育记录（8种 type）
   * 核心方法：自动创建/更新周期 + 生成任务 + 创建费用
   */
  async addBreedingRecord(data) {
    if (!data.type) throw new Error('请选择记录类型')
    if (!data.dog_id) throw new Error('请选择犬只')
    if (!data.date) throw new Error('请选择日期')

    const now = Date.now()
    const familyId = this.familyId

    // 校验犬只存在
    const { data: dogs } = await db.collection('dogs')
      .where({ _id: data.dog_id, family_id: familyId, deleted_at: null })
      .get()
    if (!dogs || dogs.length === 0) throw new Error('犬只不存在')
    const dog = dogs[0]

    // 查找或创建繁育周期
    let cycleId = data.cycle_id
    if (!cycleId) {
      // 查找进行中的周期
      const { data: activeCycles } = await db.collection('breeding_cycles')
        .where({ dam_id: data.dog_id, status: dbCmd.in(['发情中', '怀孕中']), family_id: familyId })
        .orderBy('created_at', 'desc')
        .limit(1)
        .get()

      if (activeCycles && activeCycles.length > 0) {
        cycleId = activeCycles[0]._id
      } else if (CYCLE_TRIGGER_TYPES.includes(data.type)) {
        // 自动创建新周期
        const cycleData = {
          dam_id: data.dog_id,
          dam_name: dog.name,
          sire_id: null,
          sire_name: null,
          family_id: familyId,
          status: '发情中',
          created_at: now,
          updated_at: now,
        }
        const { id } = await db.collection('breeding_cycles').add(cycleData)
        cycleId = id
      } else {
        throw new Error('没有进行中的繁育周期，请先录入发情或配种记录')
      }
    }

    // 类型特有字段校验
    this._validateDetails(data.type, data.details || {})

    // 创建繁育记录
    const recordData = {
      type: data.type,
      cycle_id: cycleId,
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
    const { id: recordId } = await db.collection('breeding_records').add(recordData)

    // 状态转换
    const newStatus = STATUS_TRANSITIONS[data.type]
    if (newStatus) {
      const updateData = { status: newStatus, updated_at: now }

      // 配种时更新种公信息
      if (data.type === 'mating' && data.details?.sire_id) {
        updateData.sire_id = data.details.sire_id
        updateData.sire_name = data.details.sire_name || null
      }

      await db.collection('breeding_cycles').doc(cycleId).update(updateData)
    }

    // 生成任务
    await this._generateTasks(data.type, data, cycleId, dog, recordId)

    // 如有费用 → 创建 expense
    if (data.cost && data.cost > 0) {
      await this._createExpense(data, dog, cycleId, recordId)
    }

    // 写入后校验（三层保障第二层）
    await this._postWriteVerify(recordId, 'breeding_records')

    return { data: { recordId, cycleId } }
  },

  /**
   * 获取繁育周期详情 + 所有子记录
   */
  async getCycleDetail(cycleId) {
    if (!cycleId) throw new Error('缺少周期 ID')

    const { data: cycles } = await db.collection('breeding_cycles')
      .where({ _id: cycleId, family_id: this.familyId })
      .get()
    if (!cycles || cycles.length === 0) throw new Error('周期不存在')

    const cycle = cycles[0]

    // 获取子记录（按日期排序）
    const { data: records } = await db.collection('breeding_records')
      .where({ cycle_id: cycleId })
      .orderBy('date', 'asc')
      .get()

    // 获取关联的窝
    const { data: litters } = await db.collection('litters')
      .where({ cycle_id: cycleId })
      .get()

    return {
      data: {
        cycle,
        records,
        litter: litters.length > 0 ? litters[0] : null,
      }
    }
  },

  /**
   * 获取某母犬的繁育历史
   */
  async getCycleHistory(damId) {
    if (!damId) throw new Error('缺少犬只 ID')

    const { data: cycles } = await db.collection('breeding_cycles')
      .where({ dam_id: damId, family_id: this.familyId })
      .orderBy('created_at', 'desc')
      .get()

    return { data: cycles }
  },

  /**
   * 手动关闭周期
   */
  async closeCycle(cycleId, reason) {
    if (!cycleId) throw new Error('缺少周期 ID')

    const { data: cycles } = await db.collection('breeding_cycles')
      .where({ _id: cycleId, family_id: this.familyId })
      .get()
    if (!cycles || cycles.length === 0) throw new Error('周期不存在')

    const cycle = cycles[0]
    if (['已生产', '失败', '放弃'].includes(cycle.status)) {
      throw new Error('周期已结束，不可再次关闭')
    }

    const newStatus = reason === '放弃' ? '放弃' : '失败'
    await db.collection('breeding_cycles').doc(cycleId).update({
      status: newStatus,
      updated_at: Date.now(),
    })

    // 取消该周期的所有待办任务
    await db.collection('tasks').where({
      cycle_id: cycleId,
      status: 'pending',
    }).update({ status: 'cancelled', updated_at: Date.now() })

    return { message: '周期已关闭' }
  },

  /**
   * 生产记录（步骤式向导）
   * 创建 litter + 批量创建幼崽 + 生成任务
   */
  async addBirthRecord(data) {
    if (!data.cycle_id) throw new Error('缺少周期 ID')
    if (!data.birth_date) throw new Error('请选择生产日期')
    if (!data.puppies || !Array.isArray(data.puppies) || data.puppies.length === 0) {
      throw new Error('请至少录入一只幼崽')
    }

    const now = Date.now()
    const familyId = this.familyId

    // 获取周期信息
    const { data: cycles } = await db.collection('breeding_cycles')
      .where({ _id: data.cycle_id, family_id: familyId })
      .get()
    if (!cycles || cycles.length === 0) throw new Error('周期不存在')
    const cycle = cycles[0]

    // 创建 breeding_record (type=birth)
    const birthRecordData = {
      type: 'birth',
      cycle_id: data.cycle_id,
      dog_id: cycle.dam_id,
      family_id: familyId,
      date: data.birth_date,
      cost: data.cost || null,
      notes: data.birth_notes || null,
      details: {
        birth_type: data.birth_type || '顺产',
        total_born: data.puppies.length,
        born_alive: data.puppies.filter(p => p.alive !== false).length,
        born_dead: data.puppies.filter(p => p.alive === false).length,
      },
      created_by: this.uid,
      created_at: now,
      updated_at: now,
    }
    await db.collection('breeding_records').add(birthRecordData)

    // 创建 Litter
    const litterData = {
      cycle_id: data.cycle_id,
      dam_id: cycle.dam_id,
      dam_name: cycle.dam_name,
      sire_id: cycle.sire_id,
      sire_name: cycle.sire_name,
      family_id: familyId,
      birth_date: data.birth_date,
      birth_type: data.birth_type || '顺产',
      birth_notes: data.birth_notes || null,
      total_born: data.puppies.length,
      born_alive: data.puppies.filter(p => p.alive !== false).length,
      born_dead: data.puppies.filter(p => p.alive === false).length,
      weaned_at: null,
      created_by: this.uid,
      created_at: now,
      updated_at: now,
    }
    const { id: litterId } = await db.collection('litters').add(litterData)

    // 逐只创建幼崽（注意事务 10 文档限制，此处不用事务，用写入后校验）
    const puppyIds = []
    for (const puppy of data.puppies) {
      if (puppy.alive === false) continue // 死胎不建档

      const puppyData = {
        name: puppy.name || '',
        gender: puppy.gender || '母',
        role: '幼崽',
        disposition: '在养',
        species: '犬',
        breed: cycle.dam_name ? '' : '', // 继承品种（后续从母犬获取）
        birth_date: data.birth_date,
        purchase_date: null,
        purchase_price: null,
        latest_weight: puppy.weight || null,
        family_id: familyId,
        origin_litter_id: litterId,
        owner_info: null,
        disposition_date: null,
        disposition_notes: null,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      }
      const { id } = await db.collection('dogs').add(puppyData)
      puppyIds.push(id)

      // 如果有初始体重，创建体重记录
      if (puppy.weight) {
        await db.collection('dog_weights').add({
          dog_id: id,
          family_id: familyId,
          weight: puppy.weight,
          date: data.birth_date,
          created_at: now,
          updated_at: now,
        })
      }
    }

    // 周期状态 → 已生产
    await db.collection('breeding_cycles').doc(data.cycle_id).update({
      status: '已生产',
      updated_at: now,
    })

    // 生成窝级别任务
    const settings = await this._getFamilySettings()
    const birthTs = data.birth_date

    const tasks = [
      {
        card_type: 'batch',
        dog_id: cycle.dam_id,
        dog_name: cycle.dam_name,
        litter_id: litterId,
        cycle_id: data.cycle_id,
        type: 'deworming',
        title: `${cycle.dam_name}窝 · 首次驱虫`,
        due_date: birthTs + (settings.default_deworming_interval_puppy * 86400000),
        status: 'pending',
        priority: 'upcoming',
        source_record_id: litterId,
        source_collection: 'litters',
        family_id: familyId,
        postpone_count: 0,
        created_at: now,
        updated_at: now,
      },
      {
        card_type: 'batch',
        dog_id: cycle.dam_id,
        dog_name: cycle.dam_name,
        litter_id: litterId,
        cycle_id: data.cycle_id,
        type: 'vaccination',
        title: `${cycle.dam_name}窝 · 首次疫苗`,
        due_date: birthTs + (42 * 86400000),
        status: 'pending',
        priority: 'upcoming',
        source_record_id: litterId,
        source_collection: 'litters',
        family_id: familyId,
        postpone_count: 0,
        created_at: now,
        updated_at: now,
      },
      {
        card_type: 'individual',
        dog_id: cycle.dam_id,
        dog_name: cycle.dam_name,
        litter_id: litterId,
        cycle_id: data.cycle_id,
        type: 'breeding_milestone',
        title: `${cycle.dam_name}窝 · 确认断奶`,
        due_date: birthTs + (settings.default_weaning_days * 86400000),
        status: 'pending',
        priority: 'upcoming',
        source_record_id: litterId,
        source_collection: 'litters',
        family_id: familyId,
        postpone_count: 0,
        created_at: now,
        updated_at: now,
      },
    ]

    for (const task of tasks) {
      await db.collection('tasks').add(task)
    }

    // 如有费用
    if (data.cost && data.cost > 0) {
      await db.collection('expenses').add({
        total_amount: data.cost,
        category: '生产',
        date: data.birth_date,
        notes: data.birth_notes || null,
        linked_cycle_id: data.cycle_id,
        linked_litter_id: litterId,
        linked_dog_ids: [cycle.dam_id],
        dog_names: [cycle.dam_name],
        dam_name: cycle.dam_name,
        source_type: 'auto',
        source_record_id: litterId,
        family_id: familyId,
        created_by: this.uid,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      })
    }

    return {
      data: {
        litterId,
        puppyIds,
        taskCount: tasks.length,
      }
    }
  },

  /**
   * 获取窝详情 + 幼崽列表
   */
  async getLitterDetail(litterId) {
    if (!litterId) throw new Error('缺少窝 ID')

    const { data: litters } = await db.collection('litters')
      .where({ _id: litterId, family_id: this.familyId })
      .get()
    if (!litters || litters.length === 0) throw new Error('窝不存在')

    // 获取幼崽
    const { data: puppies } = await db.collection('dogs')
      .where({ origin_litter_id: litterId, deleted_at: null })
      .get()

    return {
      data: {
        litter: litters[0],
        puppies,
      }
    }
  },

  /**
   * 获取活跃窝列表（未断奶，含幼崽列表，给批量体重页面用）
   */
  async getActiveLitters() {
    const { data: litters } = await db.collection('litters')
      .where({ family_id: this.familyId, weaned_at: null })
      .orderBy('birth_date', 'desc')
      .get()

    // 给每个窝带上幼崽列表
    for (const litter of litters) {
      const { data: puppies } = await db.collection('dogs')
        .where({ origin_litter_id: litter._id, deleted_at: null })
        .field({ _id: true, name: true, gender: true })
        .get()
      litter.puppies = puppies
    }

    return { data: litters }
  },

  /**
   * 后续添加幼崽到窝
   */
  async addPuppyToLitter(litterId, puppyData) {
    if (!litterId) throw new Error('缺少窝 ID')

    const { data: litters } = await db.collection('litters')
      .where({ _id: litterId, family_id: this.familyId })
      .get()
    if (!litters || litters.length === 0) throw new Error('窝不存在')

    const now = Date.now()
    const litter = litters[0]

    const dogData = {
      name: puppyData.name || '',
      gender: puppyData.gender || '母',
      role: '幼崽',
      disposition: '在养',
      species: '犬',
      breed: '',
      birth_date: litter.birth_date,
      purchase_date: null,
      purchase_price: null,
      latest_weight: puppyData.weight || null,
      family_id: this.familyId,
      origin_litter_id: litterId,
      owner_info: null,
      disposition_date: null,
      disposition_notes: null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    }

    const { id } = await db.collection('dogs').add(dogData)

    return { data: { puppyId: id } }
  },

  /**
   * 确认断奶
   */
  async confirmWeaning(litterId) {
    if (!litterId) throw new Error('缺少窝 ID')

    const now = Date.now()

    await db.collection('litters')
      .where({ _id: litterId, family_id: this.familyId })
      .update({ weaned_at: now, updated_at: now })

    // 取消断奶确认任务
    await db.collection('tasks').where({
      litter_id: litterId,
      type: 'breeding_milestone',
      title: new RegExp('断奶'),
      status: 'pending',
    }).update({ status: 'completed', completed_by: this.uid, completed_at: now, updated_at: now })

    return { message: '已确认断奶' }
  },

  // ── 内部方法（以 _ 开头，客户端不可调用）──

  /**
   * 校验类型特有字段
   */
  _validateDetails(type, details) {
    if (type === 'mating' && !details.sire_id) {
      throw new Error('配种记录必须选择种公')
    }
    if (type === 'follicle_check' && details.left_count === undefined) {
      throw new Error('卵泡检查必须填写左侧数量')
    }
  },

  /**
   * 根据记录类型生成任务
   */
  async _generateTasks(type, data, cycleId, dog, recordId) {
    const now = Date.now()
    const familyId = this.familyId

    const tasksToCreate = []

    if (type === 'mating') {
      // 生成孕检提醒（配种后 25-30 天）
      const checkupDate = data.details?.expected_checkup_date || (data.date + 25 * 86400000)
      tasksToCreate.push({
        card_type: 'individual',
        dog_id: dog._id,
        dog_name: dog.name,
        cycle_id: cycleId,
        type: 'breeding_milestone',
        title: `${dog.name} · 预计孕检日`,
        due_date: checkupDate,
        status: 'pending',
        priority: 'upcoming',
        source_record_id: recordId,
        source_collection: 'breeding_records',
        family_id: familyId,
        postpone_count: 0,
        created_at: now,
        updated_at: now,
      })

      // 生成预产期提醒（配种后 63 天）
      const dueDate = data.details?.expected_due_date || (data.date + 63 * 86400000)
      tasksToCreate.push({
        card_type: 'individual',
        dog_id: dog._id,
        dog_name: dog.name,
        cycle_id: cycleId,
        type: 'breeding_milestone',
        title: `${dog.name} · 预产期`,
        due_date: dueDate,
        status: 'pending',
        priority: 'upcoming',
        source_record_id: recordId,
        source_collection: 'breeding_records',
        family_id: familyId,
        postpone_count: 0,
        created_at: now,
        updated_at: now,
      })
    }

    if (type === 'heat') {
      // 建议查卵泡提醒（发情后可配置天数，默认 10 天）
      tasksToCreate.push({
        card_type: 'individual',
        dog_id: dog._id,
        dog_name: dog.name,
        cycle_id: cycleId,
        type: 'breeding_milestone',
        title: `${dog.name} · 建议查卵泡`,
        due_date: data.date + 10 * 86400000,
        status: 'pending',
        priority: 'upcoming',
        source_record_id: recordId,
        source_collection: 'breeding_records',
        family_id: familyId,
        postpone_count: 0,
        created_at: now,
        updated_at: now,
      })
    }

    for (const task of tasksToCreate) {
      await db.collection('tasks').add(task)
    }
  },

  /**
   * 创建关联费用
   */
  async _createExpense(data, dog, cycleId, sourceRecordId) {
    const now = Date.now()
    const typeLabels = {
      heat: '发情', follicle_check: '卵泡检查', mating: '配种',
      pregnancy_check: '孕检', prenatal_check: '产检',
      pre_labor: '临产监测', birth: '生产', abnormal_termination: '异常终止',
    }

    await db.collection('expenses').add({
      total_amount: data.cost,
      category: typeLabels[data.type] || '繁育',
      date: data.date,
      notes: data.notes || null,
      linked_cycle_id: cycleId,
      linked_dog_ids: [data.dog_id],
      dog_names: [dog.name],
      dam_name: dog.name,
      source_type: 'auto',
      source_record_id: sourceRecordId || null,
      family_id: this.familyId,
      created_by: this.uid,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    })
  },

  /**
   * 写入后校验（三层保障第二层）
   */
  async _postWriteVerify(recordId, collection) {
    try {
      const { total } = await db.collection('tasks')
        .where({ source_record_id: recordId, source_collection: collection })
        .count()

      if (total === 0) {
        // 任务缺失，需要补生成（留给 Layer 3 审计处理）
        console.warn(`[PostWriteVerify] 记录 ${recordId} 缺少关联任务`)
      }
    } catch {
      // 校验超时，依赖 Layer 3 兜底
    }
  },

  /**
   * 获取家庭设置
   */
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
