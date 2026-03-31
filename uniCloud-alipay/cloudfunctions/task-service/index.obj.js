/**
 * 任务云对象
 * 管理首页卡片生成、任务完成/推迟、每日审计
 */
const { verifyAndGetFamily, requireFamily } = require('breed-auth/auth')

const db = uniCloud.database()
const dbCmd = db.command

// 一天的毫秒数
const DAY_MS = 86400000

/**
 * 取一组任务中的最高优先级
 */
function highestPriority(tasks) {
  const order = { overdue: 1, today: 2, upcoming: 3 }
  let best = 'upcoming'
  for (const t of tasks) {
    if ((order[t.priority] || 3) < (order[best] || 3)) {
      best = t.priority
    }
  }
  return best
}

/**
 * 智能合并任务为卡片
 * 合并优先级：健康关注 > 窝级别 > 护理群组 > 批量(2+同类同天) > 个体犬只
 * @param {Array} tasks - pending 任务
 * @param {Array} todayCompleted - 今日已完成任务（用于保持批量卡片完整）
 * @param {Array} activeIllnesses - 当前生病中的 health_records（可选）
 */
function mergeTasks(tasks, todayCompleted = [], activeIllnesses = []) {
  const cards = []
  const consumed = new Set()
  const completedConsumed = new Set()

  // 第 1 轮：健康关注卡（生病犬只 + 用药犬只合并）
  const medTasks = tasks.filter(t => t.type === 'medication')
  const dogMap = new Map()

  // 1a: 生病犬只 → sick_only
  for (const ill of activeIllnesses) {
    if (dogMap.has(ill.dog_id)) continue
    // 按日历天数计算（不按小时数），第1天=记录当天
    const illStart = new Date(ill.date || ill.created_at); illStart.setHours(0, 0, 0, 0)
    const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0)
    const daysSick = Math.max(1, Math.round((todayMid.getTime() - illStart.getTime()) / DAY_MS) + 1)
    dogMap.set(ill.dog_id, {
      dogId: ill.dog_id,
      dogName: ill.dog_name || ill._dog_name || '',
      state: 'sick_only',
      illness: ill.details?.condition || '生病',
      severity: ill.details?.severity || '轻微',
      illnessId: ill._id,
      daysSick,
      treatmentStatus: ill.details?.treatment_status || '观察中',
      _createdAt: ill.date || ill.created_at || 0,
    })
  }

  // 1b: 用药犬只 → med_only 或升级 sick_only → sick_with_med
  // 同犬多条 task 时，优先取当天的展示（逾期 task 仍影响卡片优先级但不覆盖展示）
  // 包含今日已完成的 medication task（刷新后保持显示，标记为 completed）
  const completedMedTasks = todayCompleted.filter(t => t.type === 'medication')
  const allMedTasks = [...medTasks, ...completedMedTasks]
  if (allMedTasks.length > 0) {
    medTasks.forEach(t => consumed.add(t._id))
    completedMedTasks.forEach(t => completedConsumed.add(t._id))

    // 按犬只分组，每只犬取最适合展示的 task（当天 > 未来 > 逾期）
    const dogBestTask = new Map()
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
    for (const t of allMedTasks) {
      const prev = dogBestTask.get(t.dog_id)
      if (!prev) {
        dogBestTask.set(t.dog_id, t)
      } else {
        // 当天的 task 优先级最高
        const prevIsToday = prev.due_date >= todayStart.getTime() && prev.due_date <= todayEnd.getTime()
        const currIsToday = t.due_date >= todayStart.getTime() && t.due_date <= todayEnd.getTime()
        if (currIsToday && !prevIsToday) {
          dogBestTask.set(t.dog_id, t)
        }
      }
    }

    for (const t of dogBestTask.values()) {
      const d = t.details || {}
      const drugName = d.drug_name || '用药'
      const unitMap = { ml: 'ml', mg: 'mg', tablet: '片' }
      const dosageStr = d.dosage ? `${d.dosage}${unitMap[d.dosage_unit] || d.dosage_unit || 'mg'}` : ''
      const progress = d.day && d.total_days ? `${d.day}/${d.total_days}天` : ''
      const methodMap = { oral: '口服', injection: '注射' }
      const methodLabel = methodMap[d.method] || d.method || '口服'
      const freq = typeof d.frequency === 'number' ? d.frequency : 1
      const methodFreq = freq > 1 ? `${methodLabel} 日${freq}次` : methodLabel

      const isCompleted = !!t._completed

      if (dogMap.has(t.dog_id)) {
        const existing = dogMap.get(t.dog_id)
        if (existing.state === 'sick_only') {
          existing.state = 'sick_with_med'
          existing.drugName = drugName
          existing.dosageStr = dosageStr
          existing.progress = progress
          existing.methodFreq = methodFreq
          existing.completed = isCompleted
        }
      } else {
        dogMap.set(t.dog_id, {
          dogId: t.dog_id,
          dogName: t.dog_name,
          state: 'med_only',
          drugName,
          dosageStr,
          progress,
          methodFreq,
          completed: isCompleted,
          _createdAt: t.created_at || 0,
        })
      }
    }
  }

  // 输出两张健康卡（始终在"今日任务"区，不进"需处理"区）
  // - medication 卡：sick_with_med + med_only，有 checkbox 和完成/推迟按钮
  // - sick_observation 卡：sick_only，有康复按钮
  if (dogMap.size > 0) {
    const allDogs = Array.from(dogMap.values())
    const medDogs = allDogs
      .filter(d => d.state !== 'sick_only')
      .sort((a, b) => {
        const order = { sick_with_med: 0, med_only: 1 }
        const oa = order[a.state] ?? 1
        const ob = order[b.state] ?? 1
        if (oa !== ob) return oa - ob
        return (a._createdAt || 0) - (b._createdAt || 0)
      })
    const sickOnlyDogs = allDogs
      .filter(d => d.state === 'sick_only')
      .sort((a, b) => (a._createdAt || 0) - (b._createdAt || 0))

    if (medDogs.length > 0) {
      cards.push({
        cardType: 'medication',
        id: 'medication',
        priority: 'today',
        groupTitle: '今日用药',
        dogs: medDogs,
        tasks: medTasks,
        progress: null,
      })
    }
    if (sickOnlyDogs.length > 0) {
      cards.push({
        cardType: 'sick_observation',
        id: 'sick-observation',
        priority: 'today',
        groupTitle: '疾病观察',
        dogs: sickOnlyDogs,
        tasks: [],
      })
    }
  }

  // 第 2 轮：护理群组卡片
  const careTasks = tasks.filter(t => t.type === 'care_group' && !consumed.has(t._id))
  if (careTasks.length > 0) {
    const groupMap = new Map()
    for (const t of careTasks) {
      const key = t.title
      if (!groupMap.has(key)) groupMap.set(key, [])
      groupMap.get(key).push(t)
    }
    for (const [title, group] of groupMap) {
      group.forEach(t => consumed.add(t._id))
      const dogMap = new Map()
      for (const t of group) {
        if (!dogMap.has(t.dog_id)) {
          dogMap.set(t.dog_id, { dogId: t.dog_id, dogName: t.dog_name, statusLabel: '' })
        }
      }
      cards.push({
        cardType: 'care_group',
        id: 'care-' + title,
        priority: highestPriority(group),
        groupTitle: title,
        dogs: Array.from(dogMap.values()),
        tasks: group,
      })
    }
  }

  // 第 3 轮：窝级别合并（同 litter_id + 同 type）
  const litterTasks = tasks.filter(t => t.litter_id && !consumed.has(t._id))
  const litterGroups = new Map()
  for (const t of litterTasks) {
    const key = `${t.litter_id}__${t.type}`
    if (!litterGroups.has(key)) litterGroups.set(key, [])
    litterGroups.get(key).push(t)
  }
  for (const [, group] of litterGroups) {
    if (group.length >= 2) {
      group.forEach(t => consumed.add(t._id))
      const dogMap = new Map()
      for (const t of group) {
        if (!dogMap.has(t.dog_id)) {
          dogMap.set(t.dog_id, { dogId: t.dog_id, dogName: t.dog_name, completed: false })
        }
      }
      const dogs = Array.from(dogMap.values())
      cards.push({
        cardType: 'batch',
        id: `litter-${group[0].litter_id}-${group[0].type}`,
        priority: highestPriority(group),
        groupTitle: `${group[0].dog_name || ''}窝 · ${group[0].title}`,
        dogs,
        tasks: group,
        progress: { done: 0, total: dogs.length },
      })
    }
  }

  // 第 4 轮：批量合并（同 type + 同天 + 2只以上，含今日已完成）
  const remaining = tasks.filter(t => !consumed.has(t._id))
  // 将 pending 和今日已完成任务一起分组
  const allForBatch = [...remaining, ...todayCompleted.filter(t => !completedConsumed.has(t._id))]
  const batchGroups = new Map()
  for (const t of allForBatch) {
    const dayKey = new Date(t.due_date).toDateString()
    const key = `${t.type}__${dayKey}`
    if (!batchGroups.has(key)) batchGroups.set(key, [])
    batchGroups.get(key).push(t)
  }
  for (const [, group] of batchGroups) {
    const dogIds = new Set(group.map(t => t.dog_id))
    const pendingInGroup = group.filter(t => !t._completed)
    // 总数 >= 2 且至少 1 条 pending 才出批量卡片
    if (dogIds.size >= 2 && pendingInGroup.length > 0) {
      group.forEach(t => {
        if (t._completed) completedConsumed.add(t._id)
        else consumed.add(t._id)
      })
      // 按犬只去重，同一只犬有 pending 则标记未完成，否则标记已完成
      const dogMap = new Map()
      for (const t of group) {
        if (!dogMap.has(t.dog_id)) {
          dogMap.set(t.dog_id, { dogId: t.dog_id, dogName: t.dog_name, completed: !!t._completed })
        } else if (!t._completed) {
          // 如果该犬还有 pending 任务，标记为未完成
          dogMap.get(t.dog_id).completed = false
        }
      }
      const doneCount = Array.from(dogMap.values()).filter(d => d.completed).length
      const dogs = Array.from(dogMap.values())
      cards.push({
        cardType: 'batch',
        id: `batch-${group[0].type}-${group[0].due_date}`,
        priority: highestPriority(pendingInGroup),
        groupTitle: `${group[0].title} · ${dogs.length}只`,
        dogs,
        tasks: pendingInGroup,
        progress: { done: doneCount, total: dogs.length },
      })
    }
  }

  // 第 5 轮：剩余任务 → 按犬只合并为个体卡片
  const leftover = tasks.filter(t => !consumed.has(t._id))
  const dogGroups = new Map()
  for (const t of leftover) {
    const key = t.dog_id || t._id
    if (!dogGroups.has(key)) dogGroups.set(key, [])
    dogGroups.get(key).push(t)
  }
  for (const [dogId, group] of dogGroups) {
    cards.push({
      cardType: 'dog',
      id: `dog-${dogId}`,
      priority: highestPriority(group),
      dogName: group[0].dog_name,
      dogId: group[0].dog_id,
      statusLabel: '',
      tasks: group,
    })
  }

  return cards
}

module.exports = {
  _before: async function() {
    // _timing 方法不需要用户认证
    if (this.getMethodName().startsWith('_timing')) return

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
   * 获取首页卡片数据（智能合并版）
   * 将 raw tasks 合并为 SmartCard 数据结构
   */
  async getHomeCards() {
    const familyId = this.familyId

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    // 并行查询：pending 任务 + 今日已完成 + 当前生病犬只
    const [pendingRes, completedRes, illnessRes] = await Promise.all([
      db.collection('tasks')
        .where({ family_id: familyId, status: 'pending', due_date: dbCmd.lte(todayEnd.getTime()) })
        .orderBy('due_date', 'asc').limit(200).get(),
      db.collection('tasks')
        .where({ family_id: familyId, status: 'completed', completed_at: dbCmd.gte(todayStart.getTime()).and(dbCmd.lte(todayEnd.getTime())) })
        .limit(100).get(),
      db.collection('health_records')
        .where({ family_id: familyId, type: 'illness', 'details.treatment_status': dbCmd.neq('已康复') })
        .orderBy('date', 'desc').limit(50).get(),
    ])

    const pendingTasks = pendingRes.data
    const todayCompletedTasks = completedRes.data
    let activeIllnesses = illnessRes.data || []


    // 生病记录按犬只去重（取最新一条）
    const illnessMap = new Map()
    for (const ill of activeIllnesses) {
      if (!illnessMap.has(ill.dog_id)) illnessMap.set(ill.dog_id, ill)
    }
    activeIllnesses = Array.from(illnessMap.values())

    // 补充犬只名称（illness 记录不一定有 dog_name）
    const illDogIds = activeIllnesses.filter(i => !i.dog_name).map(i => i.dog_id)
    if (illDogIds.length > 0) {
      const { data: dogs } = await db.collection('dogs')
        .where({ _id: dbCmd.in(illDogIds) })
        .field({ _id: true, name: true })
        .get()
      const nameMap = new Map(dogs.map(d => [d._id, d.name]))
      for (const ill of activeIllnesses) {
        if (!ill.dog_name) ill.dog_name = nameMap.get(ill.dog_id) || ''
      }
    }

    for (const task of pendingTasks) {
      if (task.due_date < todayStart.getTime()) {
        task.priority = 'overdue'
      } else {
        task.priority = 'today'
      }
      task._completed = false
    }
    for (const task of todayCompletedTasks) {
      task.priority = 'today'
      task._completed = true
    }

    const cards = mergeTasks(pendingTasks, todayCompletedTasks, activeIllnesses)


    // 逾期卡片按逾期天数降序排列（最久的最上面），然后接今日卡片
    const overdue = cards.filter(c => c.priority === 'overdue')
    const todayCards = cards.filter(c => c.priority === 'today')
    // 为逾期卡片添加 overdueDays 信息
    for (const card of overdue) {
      const oldestDue = card.tasks?.reduce((min, t) => Math.min(min, t.due_date || Infinity), Infinity)
      card.overdueDays = oldestDue < Infinity ? Math.ceil((todayStart.getTime() - oldestDue) / DAY_MS) : 1
    }
    overdue.sort((a, b) => (b.overdueDays || 0) - (a.overdueDays || 0))
    const allCards = [...overdue, ...todayCards]

    // 计算 本周 和 30天 的 pending 任务数
    const sundayEnd = new Date(todayStart)
    const dayOfWeek = sundayEnd.getDay() // 0=日
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
    sundayEnd.setDate(sundayEnd.getDate() + daysToSunday)
    sundayEnd.setHours(23, 59, 59, 999)

    const day30End = new Date(todayStart)
    day30End.setDate(day30End.getDate() + 30)
    day30End.setHours(23, 59, 59, 999)

    // 并行查询 本周 和 30天 的 pending count
    const [weekRes, month30Res] = await Promise.all([
      db.collection('tasks')
        .where({ family_id: familyId, status: 'pending', due_date: dbCmd.lte(sundayEnd.getTime()) })
        .count(),
      db.collection('tasks')
        .where({ family_id: familyId, status: 'pending', due_date: dbCmd.lte(day30End.getTime()) })
        .count(),
    ])

    return {
      data: {
        cards: allCards.slice(0, 12),
        counts: {
          today: pendingTasks.length + (activeIllnesses.length > 0 ? 1 : 0), // 健康关注卡算1项
          week: weekRes.total + (activeIllnesses.length > 0 ? 1 : 0),
          month30: month30Res.total + (activeIllnesses.length > 0 ? 1 : 0),
          hasOverdue: overdue.length > 0,
        },
      }
    }
  },

  /**
   * 获取日期范围内每天的任务数（给 WeekStrip 用）
   */
  async getDateCounts(startDate, endDate) {
    const familyId = this.familyId

    const { data: tasks } = await db.collection('tasks')
      .where({
        family_id: familyId,
        status: 'pending',
        due_date: dbCmd.gte(startDate).and(dbCmd.lte(endDate)),
      })
      .field({ due_date: true })
      .get()

    // 按天聚合
    const counts = {}
    for (const task of tasks) {
      const d = new Date(task.due_date)
      d.setHours(0, 0, 0, 0)
      const key = d.getTime()
      counts[key] = (counts[key] || 0) + 1
    }

    return { data: counts }
  },

  /**
   * 获取一周的卡片数据（前端缓存，日期切换零延迟）
   * 返回 { [timestamp]: Card[] } 按天分组
   */
  async getWeekCards(startDate, endDate) {
    const familyId = this.familyId

    // 并行查询：周任务 + 当前生病犬只
    const [taskRes, illnessRes] = await Promise.all([
      db.collection('tasks')
        .where({ family_id: familyId, status: 'pending', due_date: dbCmd.gte(startDate).and(dbCmd.lte(endDate)) })
        .orderBy('due_date', 'asc').limit(200).get(),
      db.collection('health_records')
        .where({ family_id: familyId, type: 'illness', 'details.treatment_status': dbCmd.neq('已康复') })
        .orderBy('date', 'desc').limit(50).get(),
    ])

    const tasks = taskRes.data
    let activeIllnesses = illnessRes.data || []

    // 生病记录按犬只去重
    const illMap = new Map()
    for (const ill of activeIllnesses) {
      if (!illMap.has(ill.dog_id)) illMap.set(ill.dog_id, ill)
    }
    activeIllnesses = Array.from(illMap.values())

    // 补充犬只名称
    const illDogIds = activeIllnesses.filter(i => !i.dog_name).map(i => i.dog_id)
    if (illDogIds.length > 0) {
      const { data: dogs } = await db.collection('dogs')
        .where({ _id: dbCmd.in(illDogIds) }).field({ _id: true, name: true }).get()
      const nameMap = new Map(dogs.map(d => [d._id, d.name]))
      for (const ill of activeIllnesses) {
        if (!ill.dog_name) ill.dog_name = nameMap.get(ill.dog_id) || ''
      }
    }

    // 按天分组，正确标记 overdue
    const realTodayStart = new Date()
    realTodayStart.setHours(0, 0, 0, 0)
    const dayGroups = new Map()
    for (const task of tasks) {
      const d = new Date(task.due_date)
      d.setHours(0, 0, 0, 0)
      const key = d.getTime()
      if (!dayGroups.has(key)) dayGroups.set(key, [])
      task.priority = task.due_date < realTodayStart.getTime() ? 'overdue' : 'today'
      task._completed = false
      dayGroups.get(key).push(task)
    }

    // 每天独立合并为卡片
    // 今天：传完整 illness 列表（sick_only + sick_with_med 都显示）
    // 未来日期：只传有 medication task 的犬的 illness（sick_with_med 能显示病症，sick_only 不出现）
    const todayMs = realTodayStart.getTime()
    const result = {}
    for (const [dayTs, dayTasks] of dayGroups) {
      if (dayTs < todayMs) {
        // 过去日期不传 illness
        result[dayTs] = mergeTasks(dayTasks, [], [])
      } else {
        // 未来日期：只保留当天有 medication task 的犬的 illness
        const medDogIds = new Set(dayTasks.filter(t => t.type === 'medication').map(t => t.dog_id))
        const filteredIllnesses = medDogIds.size > 0
          ? activeIllnesses.filter(ill => medDogIds.has(ill.dog_id))
          : []
        result[dayTs] = mergeTasks(dayTasks, [], filteredIllnesses)
      }
    }

    return { data: result }
  },

  /**
   * 批量完成任务
   */
  async batchCompleteTask(taskIds) {
    if (!taskIds || !taskIds.length) throw new Error('缺少任务 ID')

    const now = Date.now()
    let completed = 0

    for (const taskId of taskIds) {
      try {
        const { data: tasks } = await db.collection('tasks')
          .where({ _id: taskId, family_id: this.familyId })
          .get()
        if (!tasks || tasks.length === 0) continue

        await db.collection('tasks').doc(taskId).update({
          status: 'completed',
          completed_by: this.uid,
          completed_at: now,
          updated_at: now,
        })
        completed++
      } catch (e) {
        // 跳过不存在或已处理的任务
      }
    }

    return { data: { completed } }
  },

  /**
   * 标记任务完成
   */
  /**
   * 完成任务
   * autoRecord=true 时（健康类），自动创建 health_record + 生成下次提醒
   */
  async completeTask(taskId, autoRecord) {
    if (!taskId) throw new Error('缺少任务 ID')

    const now = Date.now()
    const familyId = this.familyId

    const { data: tasks } = await db.collection('tasks')
      .where({ _id: taskId, family_id: familyId })
      .get()
    if (!tasks || tasks.length === 0) throw new Error('任务不存在')
    // 幂等
    if (tasks[0].status !== 'pending') return { message: '已完成' }

    const task = tasks[0]

    await db.collection('tasks').doc(taskId).update({
      status: 'completed',
      completed_by: this.uid,
      completed_at: now,
      updated_at: now,
    })

    // 健康类一键完成：自动创建记录 + 生成下次提醒
    const HEALTH_TYPES = ['vaccination', 'deworming']
    if (autoRecord && HEALTH_TYPES.includes(task.type)) {
      try {
        // 创建 health_record
        const details = {}
        if (task.type === 'vaccination') details.vaccine_type = task.details?.vaccine_type || null
        if (task.type === 'deworming') {
          details.deworming_type = task.details?.deworming_type || null
          details.drug_name = task.details?.drug_name || null
        }

        const recordData = {
          family_id: familyId,
          dog_id: task.dog_id,
          dog_name: task.dog_name,
          type: task.type,
          date: now,
          details,
          source: 'auto_complete',
          created_by: this.uid,
          created_at: now,
          updated_at: now,
        }
        const { id: recordId } = await db.collection('health_records').add(recordData)

        // 生成下次提醒（查犬只 role 决定间隔）
        const { data: dogData } = await db.collection('dogs').doc(task.dog_id).field({ role: true }).get()
        const dog = dogData[0] || dogData || {}

        const { data: familyData } = await db.collection('families').doc(familyId).field({ settings: true }).get()
        const family = familyData[0] || familyData || {}
        const settings = family.settings || {}

        const isAdult = dog.role === '种狗' || dog.role === '外部种公'
        let intervalDays
        if (task.type === 'vaccination') {
          intervalDays = isAdult ? (settings.default_vaccine_interval_adult || 365) : (settings.default_vaccine_interval_puppy || 21)
        } else {
          intervalDays = isAdult ? (settings.default_deworming_interval_adult || 90) : (settings.default_deworming_interval_puppy || 14)
        }

        const nextDue = now + intervalDays * DAY_MS
        // 去重：±7天内已有同类型 pending 任务则不创建
        const WEEK = 7 * DAY_MS
        const { total: dupCount } = await db.collection('tasks')
          .where({ family_id: familyId, dog_id: task.dog_id, type: task.type, status: 'pending', due_date: dbCmd.gte(nextDue - WEEK).and(dbCmd.lte(nextDue + WEEK)) })
          .count()

        if (dupCount === 0) {
          await db.collection('tasks').add({
            card_type: 'individual',
            dog_id: task.dog_id,
            dog_name: task.dog_name,
            type: task.type,
            title: `${task.dog_name} · 下次${task.type === 'vaccination' ? '疫苗' : '驱虫'}`,
            due_date: nextDue,
            status: 'pending',
            priority: 'upcoming',
            source_record_id: recordId,
            source_collection: 'health_records',
            family_id: familyId,
            postpone_count: 0,
            details: task.type === 'vaccination' ? { vaccine_type: details.vaccine_type } : { deworming_type: details.deworming_type, drug_name: details.drug_name },
            created_at: now,
            updated_at: now,
          })
        }
      } catch (e) {
        console.log('[completeTask] auto-record failed:', e.message)
        // 不影响任务完成，静默失败
      }
    }

    return { message: '已完成', autoRecorded: autoRecord && HEALTH_TYPES.includes(task.type) }
  },

  /**
   * 推迟任务
   */
  async postponeTask(taskId, newDate, reason) {
    if (!taskId) throw new Error('缺少任务 ID')
    if (!newDate) throw new Error('请选择新日期')

    const now = Date.now()

    const { data: tasks } = await db.collection('tasks')
      .where({ _id: taskId, family_id: this.familyId })
      .get()
    if (!tasks || tasks.length === 0) throw new Error('任务不存在')
    if (tasks[0].status !== 'pending') throw new Error('任务已处理')

    await db.collection('tasks').doc(taskId).update({
      due_date: newDate,
      postpone_count: dbCmd.inc(1),
      postpone_reason: reason || null,
      updated_at: now,
    })

    return { message: '已推迟' }
  },

  /**
   * 手动创建任务（从健康记录表单的「标记为待办」创建）
   */
  async createManualTask(data) {
    if (!data.title) throw new Error('请输入任务标题')
    if (!data.due_date) throw new Error('请选择日期')

    // 去重：同犬 + 同类型 + ±7天内已有 pending 任务则不创建
    if (data.dog_id && data.type) {
      const WEEK = 7 * 86400000
      const { total } = await db.collection('tasks')
        .where({
          family_id: this.familyId,
          dog_id: data.dog_id,
          type: data.type,
          status: 'pending',
          due_date: dbCmd.gte(data.due_date - WEEK).and(dbCmd.lte(data.due_date + WEEK)),
        })
        .count()
      if (total > 0) {
        return { data: { taskId: null, skipped: true, message: '该犬已有同类型待办' } }
      }
    }

    const now = Date.now()
    const taskData = {
      card_type: data.card_type || 'individual',
      dog_id: data.dog_id || null,
      dog_name: data.dog_name || '',
      type: data.type || 'custom',
      title: data.title,
      due_date: data.due_date,
      status: 'pending',
      priority: data.due_date <= now ? 'overdue' : 'upcoming',
      details: data.details || null,
      source_record_id: null,
      source_collection: null,
      family_id: this.familyId,
      postpone_count: 0,
      created_by: this.uid,
      created_at: now,
      updated_at: now,
    }

    const { id } = await db.collection('tasks').add(taskData)
    return { data: { taskId: id } }
  },

  /**
   * 获取单个任务详情（供表单预填使用）
   */
  async getTasksByIds(taskIds) {
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return { data: [] }
    }

    const { data } = await db.collection('tasks')
      .where({
        _id: dbCmd.in(taskIds),
        family_id: this.familyId,
      })
      .get()

    return { data: data || [] }
  },

  async getTask(taskId) {
    if (!taskId) throw new Error('缺少任务 ID')

    const { data } = await db.collection('tasks')
      .where({ _id: taskId, family_id: this.familyId })
      .get()
    if (!data || data.length === 0) throw new Error('任务不存在')

    return { data: data[0] }
  },

  /**
   * 按周期批量取消任务
   */
  async cancelTasksByCycle(cycleId) {
    if (!cycleId) throw new Error('缺少周期 ID')

    const now = Date.now()

    const { updated } = await db.collection('tasks').where({
      cycle_id: cycleId,
      family_id: this.familyId,
      status: 'pending',
    }).update({
      status: 'cancelled',
      updated_at: now,
    })

    return { data: { cancelled: updated || 0 } }
  },

  /**
   * 每日审计（三层保障第三层）
   * 定时任务：检查缺失的任务并补生成
   */
  async _timing_dailyAudit() {
    const now = Date.now()

    // 获取所有家庭
    const { data: families } = await db.collection('families').get()

    let auditCount = 0

    for (const family of families) {
      const familyId = family._id
      const settings = family.settings || {
        default_vaccine_interval_puppy: 21,
        default_vaccine_interval_adult: 365,
        default_deworming_interval_puppy: 14,
        default_deworming_interval_adult: 90,
      }

      // 审计 1：检查怀孕中的周期是否有预产期任务
      const { data: pregnantCycles } = await db.collection('breeding_cycles')
        .where({ family_id: familyId, status: '怀孕中' })
        .get()

      for (const cycle of pregnantCycles) {
        const { total } = await db.collection('tasks')
          .where({
            cycle_id: cycle._id,
            type: 'breeding_milestone',
            status: dbCmd.in(['pending', 'completed']),
          })
          .count()

        if (total === 0) {
          // 缺失任务 → 补生成预产期提醒
          await db.collection('tasks').add({
            card_type: 'individual',
            dog_id: cycle.dam_id,
            dog_name: cycle.dam_name,
            cycle_id: cycle._id,
            type: 'breeding_milestone',
            title: `${cycle.dam_name} · 预产期（审计补生成）`,
            due_date: now + 7 * DAY_MS,
            status: 'pending',
            priority: 'upcoming',
            family_id: familyId,
            postpone_count: 0,
            created_at: now,
            updated_at: now,
          })
          auditCount++
        }
      }

      // 审计 2：检查未断奶的窝是否有断奶任务
      const { data: unweanedLitters } = await db.collection('litters')
        .where({ family_id: familyId, weaned_at: null })
        .get()

      for (const litter of unweanedLitters) {
        const { total } = await db.collection('tasks')
          .where({
            litter_id: litter._id,
            type: 'breeding_milestone',
            status: dbCmd.in(['pending', 'completed']),
          })
          .count()

        if (total === 0) {
          await db.collection('tasks').add({
            card_type: 'individual',
            dog_id: litter.dam_id,
            dog_name: litter.dam_name,
            litter_id: litter._id,
            type: 'breeding_milestone',
            title: `${litter.dam_name}窝 · 确认断奶（审计补生成）`,
            due_date: now + 3 * DAY_MS,
            status: 'pending',
            priority: 'upcoming',
            family_id: familyId,
            postpone_count: 0,
            created_at: now,
            updated_at: now,
          })
          auditCount++
        }
      }

      // 审计 3：自动跳过逾期的每日用药 task
      // 昨天没喂的药不需要"补做"，标记为 skipped，今天继续喂今天的
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { data: overdueMedTasks } = await db.collection('tasks')
        .where({
          family_id: familyId,
          type: 'medication',
          status: 'pending',
          due_date: dbCmd.lt(todayStart.getTime()),
        })
        .limit(100)
        .get()

      for (const task of overdueMedTasks) {
        await db.collection('tasks').doc(task._id).update({
          status: 'skipped',
          updated_at: now,
        })
        auditCount++
      }
    }

    return { data: { auditCount } }
  },

  /**
   * 自动关闭过期发情周期
   * 定时任务：发情超过 21 天未操作 → 自动放弃
   */
  async _timing_autoCloseCycles() {
    const now = Date.now()
    const threshold = now - 21 * DAY_MS

    // 获取所有家庭的过期发情周期
    const { data: expiredCycles } = await db.collection('breeding_cycles')
      .where({
        status: '发情中',
        updated_at: dbCmd.lt(threshold),
      })
      .get()

    let closedCount = 0

    for (const cycle of expiredCycles) {
      // 关闭周期
      await db.collection('breeding_cycles').doc(cycle._id).update({
        status: '放弃',
        updated_at: now,
      })

      // 取消该周期的待办任务
      await db.collection('tasks').where({
        cycle_id: cycle._id,
        status: 'pending',
      }).update({
        status: 'cancelled',
        updated_at: now,
      })

      closedCount++
    }

    return { data: { closedCount } }
  },

  /**
   * 晨间摘要推送（定时任务，每日 07:00）
   * 统计今日待办和逾期任务，通过 UniPush 推送给所有活跃成员
   */
  async _timing_morningSummary() {
    const now = Date.now()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const { data: families } = await db.collection('families').get()
    let pushCount = 0

    for (const family of families) {
      const familyId = family._id

      // 统计逾期 + 今日任务
      const [overdueRes, todayRes] = await Promise.all([
        db.collection('tasks').where({
          family_id: familyId,
          status: 'pending',
          due_date: dbCmd.lt(todayStart.getTime()),
        }).count(),
        db.collection('tasks').where({
          family_id: familyId,
          status: 'pending',
          due_date: dbCmd.gte(todayStart.getTime()).and(dbCmd.lte(todayEnd.getTime())),
        }).count(),
      ])

      const overdueCount = overdueRes.total || 0
      const todayCount = todayRes.total || 0

      if (overdueCount === 0 && todayCount === 0) continue

      // 构建推送内容
      const parts = []
      if (overdueCount > 0) parts.push(`${overdueCount}件逾期需处理`)
      if (todayCount > 0) parts.push(`${todayCount}件今日待办`)
      const content = `今日待办(${overdueCount + todayCount}件)：${parts.join(' · ')}`

      // UniPush 推送（需要在 manifest.json 配置 UniPush 2.0）
      // V1 先记录推送内容，实际推送需要配置厂商通道后启用
      // TODO: 配置 UniPush 后取消注释
      // const activeMembers = family.members.filter(m => m.status === 'active')
      // for (const member of activeMembers) {
      //   await uniCloud.sendSms({ ... }) 或 uni-push
      // }

      pushCount++
    }

    return { data: { pushCount } }
  },

}
