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

// ── 独立辅助函数（不能放在 module.exports 内，否则 _ 前缀会被 UniCloud 当作生命周期钩子）──

/**
 * 校验类型特有字段
 */
function validateDetails(type, details) {
  if (type === 'mating' && !details.sire_id) {
    throw new Error('配种记录必须选择种公')
  }
  if (type === 'follicle_check' && details.left_count === undefined) {
    throw new Error('卵泡检查必须填写左侧数量')
  }
}

function isPregnancyConfirmed(details = {}) {
  return details.confirmed === '是' || details.confirmed === true
}

function isPregnancyRejected(details = {}) {
  return details.confirmed === '否' || details.confirmed === false
}

async function clearPendingBreedingMilestones(familyId, { cycleId = null, litterId = null } = {}) {
  const where = {
    family_id: familyId,
    type: 'breeding_milestone',
    status: 'pending',
  }
  if (cycleId) where.cycle_id = cycleId
  if (litterId) where.litter_id = litterId

  await db.collection('tasks').where(where).update({
    status: 'cancelled',
    updated_at: Date.now(),
  })
}

async function createBreedingMilestoneTask(familyId, dog, {
  cycleId = null,
  litterId = null,
  title,
  dueDate,
  sourceRecordId = null,
  sourceCollection = 'breeding_records',
  details = null,
}) {
  const now = Date.now()
  await db.collection('tasks').add({
    card_type: 'individual',
    dog_id: dog._id,
    dog_name: dog.name,
    cycle_id: cycleId,
    litter_id: litterId,
    type: 'breeding_milestone',
    title,
    due_date: dueDate,
    status: 'pending',
    priority: dueDate <= now ? 'overdue' : 'upcoming',
    source_record_id: sourceRecordId,
    source_collection: sourceCollection,
    family_id: familyId,
    postpone_count: 0,
    details,
    created_at: now,
    updated_at: now,
  })
}

/**
 * 根据记录类型生成任务
 */
async function generateTasks(familyId, type, data, cycleId, dog, recordId) {
  if (type === 'mating') {
    await clearPendingBreedingMilestones(familyId, { cycleId })
    const checkupDate = data.details?.expected_checkup_date || (data.date + 25 * 86400000)
    const dueDate = data.details?.expected_due_date || (data.date + 59 * 86400000)
    await createBreedingMilestoneTask(familyId, dog, {
      cycleId,
      title: `${dog.name} · 建议孕检`,
      dueDate: checkupDate,
      sourceRecordId: recordId,
      details: {
        step_type: 'pregnancy_check',
        expected_due_date: dueDate,
        expected_checkup_date: checkupDate,
      },
    })
  }

  if (type === 'heat') {
    await clearPendingBreedingMilestones(familyId, { cycleId })
    await createBreedingMilestoneTask(familyId, dog, {
      cycleId,
      title: `${dog.name} · 建议卵泡检查`,
      dueDate: data.date + 10 * 86400000,
      sourceRecordId: recordId,
      details: {
        step_type: 'follicle_check',
      },
    })
  }
}

/**
 * 创建关联费用
 */
async function createExpense(familyId, uid, data, dog, cycleId, sourceRecordId) {
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
    family_id: familyId,
    created_by: uid,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  })
}

/**
 * 写入后校验（三层保障第二层）
 */
async function postWriteVerify(recordId, collection) {
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
}

/**
 * 计算窝号（动态排序，不存储）
 * 按同一母犬的 birth_date 升序排列，返回序号（从 1 开始）
 */
async function computeLitterNumber(familyId, damId, birthDate) {
  const { total } = await db.collection('litters')
    .where({
      dam_id: damId,
      family_id: familyId,
      birth_date: dbCmd.lt(birthDate),
    })
    .count()
  return total + 1
}

/**
 * 为窝列表批量计算窝号
 * 输入已按 birth_date 排序的窝列表，按 dam_id 分组计算
 */
async function attachLitterNumbers(familyId, litters) {
  // 按 dam_id 分组查询每个母犬的所有窝，一次性计算
  const damIds = [...new Set(litters.map(l => l.dam_id))]
  const damLittersMap = {}

  for (const damId of damIds) {
    const { data } = await db.collection('litters')
      .where({ dam_id: damId, family_id: familyId })
      .orderBy('birth_date', 'asc')
      .field({ _id: true, birth_date: true })
      .get()
    damLittersMap[damId] = data
  }

  // 为每个窝分配序号
  for (const litter of litters) {
    const damLitters = damLittersMap[litter.dam_id] || []
    const idx = damLitters.findIndex(l => l._id === litter._id)
    litter.litter_number = idx >= 0 ? idx + 1 : 1
  }
}

/**
 * 获取家庭设置
 */
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
    validateDetails(data.type, data.details || {})

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
    let newStatus = STATUS_TRANSITIONS[data.type]
    if (data.type === 'pregnancy_check' && isPregnancyRejected(data.details)) {
      newStatus = '失败'
    }
    if (newStatus) {
      const updateData = { status: newStatus, updated_at: now }

      // 配种时更新种公信息 + 记录配种日期（用于孕期进度计算）
      if (data.type === 'mating') {
        updateData.mated_at = data.date
        if (data.details?.sire_id) {
          updateData.sire_id = data.details.sire_id
          updateData.sire_name = data.details.sire_name || null
        }
      }

      await db.collection('breeding_cycles').doc(cycleId).update(updateData)
    }

    if (data.type === 'pregnancy_check') {
      if (isPregnancyRejected(data.details)) {
        await clearPendingBreedingMilestones(familyId, { cycleId })
      } else if (isPregnancyConfirmed(data.details)) {
        await clearPendingBreedingMilestones(familyId, { cycleId })
      }
    }

    if (data.type === 'abnormal_termination') {
      await clearPendingBreedingMilestones(familyId, { cycleId })
    }

    // 生成任务
    await generateTasks(familyId, data.type, data, cycleId, dog, recordId)

    // 如有费用 → 创建 expense
    if (data.cost && data.cost > 0) {
      await createExpense(familyId, this.uid, data, dog, cycleId, recordId)
    }

    // 写入后校验（三层保障第二层）
    await postWriteVerify(recordId, 'breeding_records')

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
      .where({ cycle_id: cycleId, family_id: this.familyId })
      .orderBy('date', 'asc')
      .get()

    // 获取关联的窝
    const { data: litters } = await db.collection('litters')
      .where({ cycle_id: cycleId })
      .get()

    // 动态计算窝号
    const litter = litters.length > 0 ? litters[0] : null
    if (litter) {
      litter.litter_number = await computeLitterNumber(this.familyId, litter.dam_id, litter.birth_date)
    }

    return {
      data: {
        cycle,
        records,
        litter,
      }
    }
  },

  /**
   * 获取某母犬的所有窝记录
   */
  async getLittersByDam(damId) {
    if (!damId) throw new Error('缺少犬只 ID')

    const { data: litters } = await db.collection('litters')
      .where({ dam_id: damId, family_id: this.familyId })
      .orderBy('birth_date', 'desc')
      .get()

    if (!litters || litters.length === 0) return { data: [] }

    // 为每窝附加幼崽统计
    const litterIds = litters.map(l => l._id)
    const { data: puppies } = await db.collection('dogs')
      .where({ origin_litter_id: dbCmd.in(litterIds), deleted_at: null })
      .get()

    const puppyMap = {}
    for (const p of puppies) {
      if (!puppyMap[p.origin_litter_id]) puppyMap[p.origin_litter_id] = []
      puppyMap[p.origin_litter_id].push(p)
    }

    const result = litters.map(l => {
      const pups = puppyMap[l._id] || []
      return {
        ...l,
        pupStats: {
          total: pups.length,
          alive: pups.filter(p => p.disposition !== '已故').length,
          sold: pups.filter(p => ['已售', '已预定'].includes(p.disposition)).length,
          kept: pups.filter(p => p.disposition === '自留' || p.disposition === '在养').length,
          available: pups.filter(p => p.disposition === '待售').length,
        },
      }
    })

    return { data: result }
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

    await clearPendingBreedingMilestones(familyId, { cycleId: data.cycle_id })

    // 生成窝级别流程终点任务
    const settings = await getFamilySettings(familyId)
    const birthTs = data.birth_date

    await createBreedingMilestoneTask(familyId, { _id: cycle.dam_id, name: cycle.dam_name }, {
      cycleId: data.cycle_id,
      litterId,
      title: `${cycle.dam_name}窝 · 确认断奶`,
      dueDate: birthTs + (settings.default_weaning_days * 86400000),
      sourceRecordId: litterId,
      sourceCollection: 'litters',
      details: {
        step_type: 'weaning_confirm',
        birth_date: birthTs,
      },
    })

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
        taskCount: 1,
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

    const litter = litters[0]

    // 动态计算窝号
    litter.litter_number = await computeLitterNumber(this.familyId, litter.dam_id, litter.birth_date)

    // 获取幼崽
    const { data: puppies } = await db.collection('dogs')
      .where({ origin_litter_id: litterId, deleted_at: null })
      .get()

    return {
      data: {
        litter,
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

    // 动态计算窝号
    await attachLitterNumbers(this.familyId, litters)

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
   * 获取所有窝列表（含窝号，给选择器用）
   */
  async getAllLitters() {
    const { data: litters } = await db.collection('litters')
      .where({ family_id: this.familyId })
      .orderBy('birth_date', 'desc')
      .limit(50)
      .get()

    // 动态计算窝号
    await attachLitterNumbers(this.familyId, litters)

    return { data: litters }
  },

  /**
   * 更新窝信息（备注等安全字段）
   */
  async updateLitter(litterId, data) {
    if (!litterId) throw new Error('缺少窝 ID')

    const { data: litters } = await db.collection('litters')
      .where({ _id: litterId, family_id: this.familyId })
      .get()
    if (!litters || litters.length === 0) throw new Error('窝不存在')

    // 只允许更新安全字段
    const safeFields = ['birth_notes', 'notes']
    const updateData = { updated_at: Date.now() }
    for (const field of safeFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field]
      }
    }

    await db.collection('litters').doc(litterId).update(updateData)

    return { message: '窝信息已更新' }
  },

  /**
   * 修改窝的生产日期（±3天限制）
   */
  async updateBirthDate(litterId, newBirthDate) {
    if (!litterId) throw new Error('缺少窝 ID')
    if (!newBirthDate) throw new Error('请选择新日期')

    const { data: litters } = await db.collection('litters')
      .where({ _id: litterId, family_id: this.familyId })
      .get()
    if (!litters || litters.length === 0) throw new Error('窝不存在')

    const litter = litters[0]
    const diffMs = Math.abs(newBirthDate - litter.birth_date)
    const diffDays = diffMs / 86400000

    if (diffDays > 3) {
      throw new Error('生产日期只能调整 ±3 天，超出范围会影响窝号和关联费用')
    }

    const now = Date.now()

    // 更新窝的生产日期
    await db.collection('litters').doc(litterId).update({
      birth_date: newBirthDate,
      updated_at: now,
    })

    // 同步更新该窝所有幼崽的出生日期
    await db.collection('dogs').where({
      origin_litter_id: litterId,
      deleted_at: null,
    }).update({
      birth_date: newBirthDate,
      updated_at: now,
    })

    return { message: '生产日期已更新' }
  },

  /**
   * 获取繁育记录详情
   */
  async getBreedingRecordDetail({ id }) {
    if (!id) throw new Error('缺少记录 ID')

    const { data: records } = await db.collection('breeding_records')
      .where({ _id: id, family_id: this.familyId })
      .get()
    if (!records || records.length === 0) throw new Error('记录不存在')

    return records[0]
  },

  /**
   * 更新繁育记录
   */
  async updateBreedingRecord({ id, date, cost, notes, details }) {
    if (!id) throw new Error('缺少记录 ID')

    const { data: records } = await db.collection('breeding_records')
      .where({ _id: id, family_id: this.familyId })
      .get()
    if (!records || records.length === 0) throw new Error('记录不存在')

    const updateData = { updated_at: Date.now() }
    if (date !== undefined) updateData.date = date
    if (cost !== undefined) updateData.cost = cost
    if (notes !== undefined) updateData.notes = notes
    if (details !== undefined) updateData.details = details

    await db.collection('breeding_records').doc(id).update(updateData)

    return { message: '已更新' }
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
}
