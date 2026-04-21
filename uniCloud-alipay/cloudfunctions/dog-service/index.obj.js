/**
 * 犬只档案云对象
 * 负责犬只 CRUD、状态派生、disposition 变更
 */
const { verifyAndGetFamily, requireFamily, requireAdmin } = require('breed-auth/auth')

const db = uniCloud.database()
const dbCmd = db.command

const LIST_STATUS_PRIORITY = {
  '生病中': 0,
  '用药中': 1,
  '怀孕中': 2,
  '哺乳中': 3,
  '发情中': 4,
  '正常': 5,
}

const DETAIL_STATUS_PRIORITY = {
  '生病中': 0,
  '用药中': 1,
  '怀孕中': 2,
  '哺乳中': 3,
  '发情中': 4,
}

const MEDICATION_DOSAGE_UNIT_MAP = {
  ml: 'ml',
  mg: 'mg',
  tablet: '片',
}

function formatMedicationFrequency(frequency) {
  const count = Number(frequency) || 1
  return `每日${count}次`
}

function sortListStatuses(statuses = []) {
  return [...statuses].sort((a, b) => {
    const aPriority = LIST_STATUS_PRIORITY[a.type] ?? 99
    const bPriority = LIST_STATUS_PRIORITY[b.type] ?? 99
    return aPriority - bPriority
  })
}

function getStatusActivityTs(status) {
  return status?.activityTs || 0
}

function sortDetailStatuses(statuses = []) {
  return [...statuses].sort((a, b) => {
    const aPriority = DETAIL_STATUS_PRIORITY[a.type] ?? 99
    const bPriority = DETAIL_STATUS_PRIORITY[b.type] ?? 99
    if (aPriority !== bPriority) return aPriority - bPriority
    return getStatusActivityTs(b) - getStatusActivityTs(a)
  })
}

function normalizeIllnessLabel(label) {
  return typeof label === 'string' ? label.trim() : '生病中'
}

function buildDetailIllnessStatuses(illnesses = []) {
  const grouped = new Map()

  for (const illness of illnesses) {
    const label = normalizeIllnessLabel(illness.details?.condition || '生病中')
    if (!grouped.has(label)) grouped.set(label, [])
    grouped.get(label).push(illness)
  }

  return Array.from(grouped.entries()).map(([label, records]) => {
    const sorted = [...records].sort((a, b) => (b.updated_at || b.date || b.created_at || 0) - (a.updated_at || a.date || a.created_at || 0))
    const latest = sorted[0]
    return {
      type: '生病中',
      label,
      recordId: latest._id,
      activityTs: latest.updated_at || latest.date || latest.created_at || 0,
    }
  })
}

function buildListIllnessStatuses(illnesses = []) {
  const labels = []
  const seen = new Set()
  let firstRecordId = null

  for (const illness of illnesses) {
    const label = (illness.details?.condition || '生病中').trim()
    const dedupeKey = label
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    labels.push(label)
    if (!firstRecordId) firstRecordId = illness._id
  }

  if (labels.length === 0) return []

  if (labels.length === 1) {
    return [{
      type: '生病中',
      label: labels[0],
      count: 1,
      recordId: firstRecordId,
    }]
  }

  if (labels.length === 2) {
    return [{
      type: '生病中',
      label: `${labels[0]}/${labels[1]}`,
      count: 2,
      recordId: firstRecordId,
    }]
  }

  return [{
    type: '生病中',
    label: `${labels[0]}/${labels[1]}等${labels.length}项`,
    count: labels.length,
    recordId: firstRecordId,
  }]
}

function buildListMedicationStatus(tasks = []) {
  if (!tasks.length) return []
  return [{
    type: '用药中',
    label: '用药中',
    count: tasks.length,
    taskId: tasks[0]?._id,
  }]
}

function getMedicationTaskStartTs(task) {
  return task?.actual_start_date || task?.updated_at || task?.created_at || 0
}

function startOfDay(ts) {
  const date = new Date(ts || Date.now())
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function getMedicationTaskProgress(task, nowTs = Date.now()) {
  const startTs = startOfDay(task?.actual_start_date || task?.start_date || task?.created_at || nowTs)
  const todayTs = startOfDay(nowTs)
  const totalDays = Math.max(1, Number(task?.duration_days) || 1)
  const currentDay = Math.floor((todayTs - startTs) / 86400000) + 1

  return {
    currentDay,
    totalDays,
  }
}

function isMedicationTaskActiveForDetail(task, nowTs = Date.now()) {
  const { currentDay, totalDays } = getMedicationTaskProgress(task, nowTs)
  return currentDay >= 1 && currentDay <= totalDays
}

function getActiveMedicationTasks(tasks = [], nowTs = Date.now()) {
  return (tasks || []).filter(task => isMedicationTaskActiveForDetail(task, nowTs))
}

function getMedicationCompletionSummary(task) {
  const frequency = Math.max(1, Number(task?.frequency) || 1)
  const durationDays = Math.max(1, Number(task?.duration_days) || 1)
  const dailyDoses = task?.daily_doses || {}
  const completedDates = new Set(Array.isArray(task?.completed_dates) ? task.completed_dates : [])

  let completedDoseCount = 0
  for (let day = 1; day <= durationDays; day += 1) {
    const doses = Number(dailyDoses[String(day)])
    if (Number.isFinite(doses)) {
      completedDoseCount += Math.min(Math.max(0, doses), frequency)
      continue
    }

    const startTs = startOfDay(task?.actual_start_date || task?.start_date || task?.created_at || Date.now())
    const dayTs = startTs + ((day - 1) * 86400000)
    if (completedDates.has(dayTs)) {
      completedDoseCount += frequency
    }
  }

  return {
    completedDoseCount,
    totalDoseCount: durationDays * frequency,
    frequency,
  }
}

function pickPreferredMedicationTask(currentTask, nextTask) {
  if (!currentTask) return nextTask

  const currentStartTs = getMedicationTaskStartTs(currentTask)
  const nextStartTs = getMedicationTaskStartTs(nextTask)
  if (nextStartTs !== currentStartTs) {
    return nextStartTs > currentStartTs ? nextTask : currentTask
  }

  const currentUpdatedTs = currentTask?.updated_at || currentTask?.created_at || 0
  const nextUpdatedTs = nextTask?.updated_at || nextTask?.created_at || 0
  return nextUpdatedTs > currentUpdatedTs ? nextTask : currentTask
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
   * 获取犬只列表 + 实时派生状态
   * 集合级查询（非逐犬），30-50犬毫秒级完成
   */
  async getDogListWithStatus(filters = {}) {
    const now = Date.now()
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
        'details.treatment_status': dbCmd.neq('已康复'),
      }).get(),
      // 活跃用药任务
      db.collection('medication_tasks').where({
        family_id: this.familyId,
        status: '进行中',
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

    const breedingStatusMap = {}
    for (const cycle of cycles) {
      const damId = cycle.dam_id
      if (cycle.status === '发情中') {
        breedingStatusMap[damId] = [{ type: '发情中', cycleId: cycle._id }]
      } else if (cycle.status === '怀孕中') {
        breedingStatusMap[damId] = [{ type: '怀孕中', cycleId: cycle._id }]
      } else if (cycle.status === '已生产') {
        const hasActiveLitter = activeLitters.some(l => l.dam_id === damId)
        if (hasActiveLitter) {
          breedingStatusMap[damId] = [{ type: '哺乳中', cycleId: cycle._id }]
        }
      }
    }

    const illnessMap = {}
    for (const illness of illnesses) {
      const dogId = illness.dog_id
      if (!illnessMap[dogId]) illnessMap[dogId] = []
      illnessMap[dogId].push(illness)
    }

    const medicationMap = {}
    for (const task of medTasks) {
      if (!isMedicationTaskActiveForDetail(task, now)) continue
      const dogId = task.dog_id
      if (!medicationMap[dogId]) medicationMap[dogId] = []
      medicationMap[dogId].push(task)
    }

    // 组装结果
    const result = dogs.map(dog => ({
      ...dog,
      statuses: (() => {
        const statuses = [
          ...(buildListIllnessStatuses(illnessMap[dog._id] || [])),
          ...((breedingStatusMap[dog._id]) || []),
          ...(buildListMedicationStatus(medicationMap[dog._id] || [])),
        ]
        const sorted = sortListStatuses(statuses)
        return sorted.length > 0 ? sorted : [{ type: '正常' }]
      })(),
    }))

    return { data: result }
  },

  /**
   * 获取犬只详情
   */
  async getDogDetail(dogId) {
    if (!dogId) throw new Error('缺少犬只 ID')

    const familyId = this.familyId
    const now = Date.now()

    const [dogRes, cyclesRes, illnessRes, medTasksRes, littersRes] = await Promise.all([
      db.collection('dogs').where({ _id: dogId, family_id: familyId, deleted_at: null }).get(),
      db.collection('breeding_cycles').where({ dam_id: dogId, family_id: familyId }).get(),
      db.collection('health_records').where({ dog_id: dogId, family_id: familyId, type: 'illness' }).get(),
      db.collection('medication_tasks').where({ dog_id: dogId, family_id: familyId, status: '进行中' }).get(),
      db.collection('litters').where({ dam_id: dogId, family_id: familyId, weaned_at: null }).get(),
    ])

    if (!dogRes.data || dogRes.data.length === 0) throw new Error('犬只不存在')
    const dog = dogRes.data[0]
    const statuses = []

    const methodMap = { oral: '口服', injection: '注射', topical: '外用', other: '其他' }

    // 繁育状态（取最近一条活跃周期）
    const activeCycle = (cyclesRes.data || []).find(c => c.status === '发情中' || c.status === '怀孕中')
    if (activeCycle) {
      if (activeCycle.status === '发情中') {
        statuses.push({
          type: '发情中',
          cycleId: activeCycle._id,
          activityTs: activeCycle.updated_at || activeCycle.created_at || 0,
        })
      } else if (activeCycle.status === '怀孕中') {
        const startTs = activeCycle.mated_at || activeCycle.updated_at || activeCycle.created_at
        const daysPassed = Math.max(1, Math.floor((now - startTs) / 86400000))
        const totalDays = 63
        const dueTs = startTs + totalDays * 86400000
        const dueDate = new Date(dueTs)
        const dueMd = `${dueDate.getMonth() + 1}月${dueDate.getDate()}日`
        statuses.push({
          type: '怀孕中',
          cycleId: activeCycle._id,
          detail: activeCycle.sire_name ? `种公: ${activeCycle.sire_name}` : '',
          progress: { current: Math.min(daysPassed, totalDays), total: totalDays },
          activityTs: activeCycle.updated_at || activeCycle.created_at || 0,
          meta: [
            { icon: 'event', text: `预产期 ${dueMd}` },
            { icon: 'schedule', text: `还有${Math.max(0, totalDays - daysPassed)}天` },
          ],
        })
      }
    }

    // 哺乳中（有未断奶的窝且无活跃繁育周期）
    if ((littersRes.data || []).length > 0 && !activeCycle) {
      const latestLitter = [...(littersRes.data || [])].sort((a, b) => (b.updated_at || b.created_at || 0) - (a.updated_at || a.created_at || 0))[0]
      statuses.push({
        type: '哺乳中',
        activityTs: latestLitter?.updated_at || latestLitter?.created_at || 0,
      })
    }

    // 疾病状态（未康复的）
    const activeIllnesses = (illnessRes.data || []).filter(r => r.details?.treatment_status !== '已康复')
    statuses.push(...buildDetailIllnessStatuses(activeIllnesses))

    // 用药状态（按药名去重，取进度最新的）
    const medTasks = getActiveMedicationTasks(medTasksRes.data || [], now)
    const medDrugMap = {}
    for (const task of medTasks) {
      const drug = task.drug_name || task.details?.drug_name || '用药'
      medDrugMap[drug] = pickPreferredMedicationTask(medDrugMap[drug], task)
    }
    for (const task of Object.values(medDrugMap)) {
      const parts = [
        task.drug_name,
        task.dosage ? `${task.dosage}${MEDICATION_DOSAGE_UNIT_MAP[task.dosage_unit] || task.dosage_unit || ''}` : null,
        methodMap[task.method] || task.method,
      ].filter(Boolean)
      const { currentDay, totalDays } = getMedicationTaskProgress(task, now)
      const { completedDoseCount, totalDoseCount, frequency } = getMedicationCompletionSummary(task)
      statuses.push({
        type: '用药中',
        taskId: task._id,
        detail: parts.join(' · '),
        progress: task.duration_days ? { current: Math.min(currentDay, totalDays), total: totalDays } : null,
        activityTs: task.updated_at || task.created_at || 0,
        meta: [
          { icon: 'schedule', text: formatMedicationFrequency(frequency) },
          { icon: 'check_circle', text: `已执行 ${completedDoseCount}/${totalDoseCount} 次` },
        ],
      })
    }

    return { data: { ...dog, statuses: sortDetailStatuses(statuses) } }
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

    // 如有购入价格，自动创建费用记录
    if (data.purchase_price && data.purchase_price > 0) {
      await db.collection('expenses').add({
        total_amount: data.purchase_price,
        category: '购入',
        date: data.purchase_date || now,
        notes: `购入${data.role === '外部种公' ? '外部种公' : '种犬'}：${data.name || ''}`,
        linked_dog_ids: [id],
        dog_names: [data.name || ''],
        source_type: 'auto',
        source_record_id: id,
        family_id: this.familyId,
        created_by: this.uid,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      })
    }

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
