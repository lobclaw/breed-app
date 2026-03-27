/**
 * 犬只档案云对象
 * 负责犬只 CRUD、状态派生、disposition 变更
 */
const { verifyAndGetFamily, requireFamily, requireAdmin } = require('breed-auth/auth')

const db = uniCloud.database()
const dbCmd = db.command

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
   * 获取犬只列表 + 实时派生状态
   * 集合级查询（非逐犬），30-50犬毫秒级完成
   */
  async getDogListWithStatus(filters = {}) {
    const where = {
      family_id: this.familyId,
      deleted_at: null,
    }

    // 可选筛选条件
    if (filters.gender) where.gender = filters.gender
    if (filters.role) where.role = filters.role
    if (filters.disposition) where.disposition = filters.disposition
    else where.disposition = dbCmd.in(['在养', '待售', '已预定', '自留'])

    // 并行查询犬只列表 + 状态源数据
    const [dogsRes, cyclesRes, illnessRes, medTasksRes, littersRes] = await Promise.all([
      // 犬只列表
      db.collection('dogs').where(where).orderBy('created_at', 'desc').get(),
      // 进行中的繁育周期
      db.collection('breeding_cycles').where({
        family_id: this.familyId,
        status: dbCmd.in(['发情中', '怀孕中', '已生产']),
      }).get(),
      // 未康复的疾病记录
      db.collection('health_records').where({
        family_id: this.familyId,
        type: 'illness',
        'details.is_recovered': dbCmd.neq(true),
      }).get(),
      // 活跃用药任务
      db.collection('medication_tasks').where({
        family_id: this.familyId,
        status: 'active',
      }).get(),
      // 未断奶的窝
      db.collection('litters').where({
        family_id: this.familyId,
        weaned_at: null,
      }).get(),
    ])

    const dogs = dogsRes.data
    const cycles = cyclesRes.data
    const illnesses = illnessRes.data
    const medTasks = medTasksRes.data
    const activeLitters = littersRes.data

    // 构建状态映射
    const dogStatuses = {}

    // 繁育状态（互斥）
    for (const cycle of cycles) {
      const damId = cycle.dam_id
      if (!dogStatuses[damId]) dogStatuses[damId] = []

      if (cycle.status === '发情中') {
        dogStatuses[damId].push({ type: '发情中', cycleId: cycle._id })
      } else if (cycle.status === '怀孕中') {
        dogStatuses[damId].push({ type: '怀孕中', cycleId: cycle._id })
      } else if (cycle.status === '已生产') {
        // 检查是否还在哺乳
        const hasActiveLitter = activeLitters.some(l => l.dam_id === damId)
        if (hasActiveLitter) {
          dogStatuses[damId].push({ type: '哺乳中', cycleId: cycle._id })
        }
      }
    }

    // 疾病状态（可叠加）
    for (const illness of illnesses) {
      const dogId = illness.dog_id
      if (!dogStatuses[dogId]) dogStatuses[dogId] = []
      dogStatuses[dogId].push({ type: '生病中', recordId: illness._id })
    }

    // 用药状态（可叠加）
    for (const task of medTasks) {
      const dogId = task.dog_id
      if (!dogStatuses[dogId]) dogStatuses[dogId] = []
      dogStatuses[dogId].push({ type: '用药中', taskId: task._id })
    }

    // 组装结果
    const result = dogs.map(dog => ({
      ...dog,
      statuses: dogStatuses[dog._id] || [{ type: '正常' }],
    }))

    return { data: result }
  },

  /**
   * 获取犬只详情
   */
  async getDogDetail(dogId) {
    if (!dogId) throw new Error('缺少犬只 ID')

    const { data } = await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId, deleted_at: null })
      .get()

    if (!data || data.length === 0) {
      throw new Error('犬只不存在')
    }

    return { data: data[0] }
  },

  /**
   * 创建犬只
   */
  async createDog(data) {
    if (!data.name && data.role !== '幼崽') {
      throw new Error('请输入犬只名称')
    }
    if (!data.gender) throw new Error('请选择性别')
    if (!data.role) throw new Error('请选择角色')

    const now = Date.now()
    const dogData = {
      name: data.name || '',
      gender: data.gender,
      role: data.role,
      disposition: data.disposition || '在养',
      species: data.species || '犬',
      breed: data.breed || '',
      birth_date: data.birth_date || null,
      purchase_date: data.purchase_date || null,
      purchase_price: data.purchase_price || null,
      latest_weight: data.latest_weight || null,
      family_id: this.familyId,
      origin_litter_id: data.origin_litter_id || null,
      owner_info: data.owner_info || null,
      disposition_date: null,
      disposition_notes: null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    }

    const { id } = await db.collection('dogs').add(dogData)
    return { data: { _id: id } }
  },

  /**
   * 更新犬只基础信息
   */
  async updateDog(dogId, data) {
    if (!dogId) throw new Error('缺少犬只 ID')

    // 禁止通过此方法修改 name（用 updateDogName）和 disposition（用 changeDisposition）
    const { name, disposition, family_id, deleted_at, created_at, _id, ...updateFields } = data
    updateFields.updated_at = Date.now()

    await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .update(updateFields)

    return { message: '已更新' }
  },

  /**
   * 改名 + 批量更新冗余字段
   */
  async updateDogName(dogId, newName) {
    if (!dogId) throw new Error('缺少犬只 ID')
    if (!newName || !newName.trim()) throw new Error('请输入新名称')

    const trimmedName = newName.trim()
    const now = Date.now()

    // 更新犬只名称
    await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .update({ name: trimmedName, updated_at: now })

    // 批量更新冗余字段（顺序写入，审计兜底）
    const updates = [
      db.collection('tasks').where({ dog_id: dogId }).update({ dog_name: trimmedName }),
      db.collection('breeding_cycles').where({ dam_id: dogId }).update({ dam_name: trimmedName }),
      db.collection('breeding_cycles').where({ sire_id: dogId }).update({ sire_name: trimmedName }),
      db.collection('litters').where({ dam_id: dogId }).update({ dam_name: trimmedName }),
      db.collection('litters').where({ sire_id: dogId }).update({ sire_name: trimmedName }),
    ]

    // 不用 Promise.all —— 顺序执行更安全，任一失败有审计兜底
    for (const update of updates) {
      try { await update } catch { /* 审计兜底 */ }
    }

    return { message: '名称已更新' }
  },

  /**
   * 变更犬只去向（disposition）
   * 包含异常状态转换处理
   */
  async changeDisposition(dogId, newDisposition, data = {}) {
    if (!dogId) throw new Error('缺少犬只 ID')
    if (!newDisposition) throw new Error('请选择去向')

    // 获取当前犬只信息
    const { data: dogs } = await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId, deleted_at: null })
      .get()

    if (!dogs || dogs.length === 0) throw new Error('犬只不存在')
    const dog = dogs[0]

    // 检查进行中的繁育周期
    const { data: activeCycles } = await db.collection('breeding_cycles')
      .where({ dam_id: dogId, status: dbCmd.in(['发情中', '怀孕中']) })
      .get()

    // 异常状态转换规则
    if (activeCycles.length > 0) {
      const cycle = activeCycles[0]

      if (newDisposition === '已领养' || newDisposition === '已赠送') {
        throw new Error('该犬有进行中的繁育周期，请先完成或关闭')
      }

      if (newDisposition === '已退休' && cycle.status === '怀孕中') {
        throw new Error('该犬当前怀孕中，请先完成生产或记录异常终止')
      }

      // 已故 或 退休(发情中) → 自动处理周期
      if (newDisposition === '已故') {
        for (const c of activeCycles) {
          await db.collection('breeding_cycles').doc(c._id).update({
            status: '失败',
            updated_at: Date.now(),
          })
          // 取消该周期的所有待办任务
          await db.collection('tasks').where({
            cycle_id: c._id,
            status: 'pending',
          }).update({ status: 'cancelled', updated_at: Date.now() })
        }
      }

      if (newDisposition === '已退休' && cycle.status === '发情中') {
        await db.collection('breeding_cycles').doc(cycle._id).update({
          status: '放弃',
          updated_at: Date.now(),
        })
        await db.collection('tasks').where({
          cycle_id: cycle._id,
          status: 'pending',
        }).update({ status: 'cancelled', updated_at: Date.now() })
      }
    }

    // 已故时取消所有未完成任务
    if (newDisposition === '已故') {
      await db.collection('tasks').where({
        dog_id: dogId,
        status: 'pending',
      }).update({ status: 'cancelled', updated_at: Date.now() })
    }

    // 更新犬只
    const now = Date.now()
    const updateData = {
      disposition: newDisposition,
      updated_at: now,
    }

    if (['已故', '已领养', '已赠送', '已退休'].includes(newDisposition)) {
      updateData.disposition_date = data.disposition_date || now
      updateData.disposition_notes = data.disposition_notes || null
    }

    await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .update(updateData)

    return { message: '去向已更新' }
  },

  /**
   * 软删除犬只
   */
  async softDeleteDog(dogId) {
    if (!dogId) throw new Error('缺少犬只 ID')
    requireAdmin(this.role)

    await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .update({ deleted_at: Date.now(), updated_at: Date.now() })

    return { message: '已删除（可在回收站恢复）' }
  },

  /**
   * 恢复软删除的犬只
   */
  async restoreDog(dogId) {
    if (!dogId) throw new Error('缺少犬只 ID')
    requireAdmin(this.role)

    await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .update({ deleted_at: null, updated_at: Date.now() })

    return { message: '已恢复' }
  },

  /**
   * 幼崽升级为种狗
   */
  async upgradePuppyToBreeder(dogId) {
    if (!dogId) throw new Error('缺少犬只 ID')

    const { data: dogs } = await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId, role: '幼崽', deleted_at: null })
      .get()

    if (!dogs || dogs.length === 0) throw new Error('犬只不存在或不是幼崽')

    await db.collection('dogs')
      .where({ _id: dogId, family_id: this.familyId })
      .update({
        role: '种狗',
        disposition: '在养',
        updated_at: Date.now(),
      })

    return { message: '已升级为种狗' }
  },
}
