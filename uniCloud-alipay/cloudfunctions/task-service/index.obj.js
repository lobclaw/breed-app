/**
 * 任务云对象
 * 管理首页卡片生成、任务完成/推迟、每日审计
 */
const { verifyAndGetFamily, requireFamily } = require('breed-auth/auth')

const db = uniCloud.database()
const dbCmd = db.command

// 一天的毫秒数
const DAY_MS = 86400000

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
  async getHomeCards(date) {
    const familyId = this.familyId
    const now = date || Date.now()

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const weekLater = todayEnd.getTime() + 7 * DAY_MS

    const { data: tasks } = await db.collection('tasks')
      .where({
        family_id: familyId,
        status: 'pending',
        due_date: dbCmd.lte(weekLater),
      })
      .orderBy('due_date', 'asc')
      .limit(200)
      .get()

    // 标记优先级
    for (const task of tasks) {
      if (task.due_date < todayStart.getTime()) {
        task.priority = 'overdue'
      } else if (task.due_date <= todayEnd.getTime()) {
        task.priority = 'today'
      } else {
        task.priority = 'upcoming'
      }
    }

    // 智能合并为卡片
    const cards = this._mergeTasks(tasks)

    // 按优先级分组
    const overdue = cards.filter(c => c.priority === 'overdue')
    const today = cards.filter(c => c.priority === 'today')
    const upcoming = cards.filter(c => c.priority === 'upcoming')

    return {
      data: {
        overdue: overdue.slice(0, 8),
        today: today.slice(0, 8),
        upcoming: upcoming.slice(0, 8),
        counts: {
          overdue: overdue.length,
          today: today.length,
          upcoming: upcoming.length,
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
  async completeTask(taskId) {
    if (!taskId) throw new Error('缺少任务 ID')

    const now = Date.now()

    const { data: tasks } = await db.collection('tasks')
      .where({ _id: taskId, family_id: this.familyId })
      .get()
    if (!tasks || tasks.length === 0) throw new Error('任务不存在')
    if (tasks[0].status !== 'pending') throw new Error('任务已处理')

    await db.collection('tasks').doc(taskId).update({
      status: 'completed',
      completed_by: this.uid,
      completed_at: now,
      updated_at: now,
    })

    return { message: '已完成' }
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
        default_vaccine_interval: 21,
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

  /**
   * 智能合并任务为卡片
   * 合并优先级：窝级别 > 用药 > 护理群组 > 批量(3+同类同天) > 个体犬只
   */
  _mergeTasks(tasks) {
    const cards = []
    const consumed = new Set()

    // 第 1 轮：用药卡片（medication_daily 类型合并）
    const medTasks = tasks.filter(t => t.type === 'medication')
    if (medTasks.length > 0) {
      medTasks.forEach(t => consumed.add(t._id))
      // 按犬只分组，收集药品信息
      const dogMap = new Map()
      for (const t of medTasks) {
        if (!dogMap.has(t.dog_id)) {
          dogMap.set(t.dog_id, { dogId: t.dog_id, dogName: t.dog_name, drugName: t.title })
        }
      }
      cards.push({
        cardType: 'medication',
        id: 'med-' + Date.now(),
        priority: this._highestPriority(medTasks),
        groupTitle: '每日用药',
        dogs: Array.from(dogMap.values()),
        tasks: medTasks,
        progress: null,
      })
    }

    // 第 2 轮：护理群组卡片
    const careTasks = tasks.filter(t => t.type === 'care_group' && !consumed.has(t._id))
    if (careTasks.length > 0) {
      // 按 title 分组（同一规则的护理任务 title 相同）
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
          priority: this._highestPriority(group),
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
          priority: this._highestPriority(group),
          groupTitle: `${group[0].dog_name || ''}窝 · ${group[0].title}`,
          dogs,
          tasks: group,
          progress: { done: 0, total: dogs.length },
        })
      }
    }

    // 第 4 轮：批量合并（同 type + 同天 + 3只以上，非窝级别）
    const remaining = tasks.filter(t => !consumed.has(t._id))
    const batchGroups = new Map()
    for (const t of remaining) {
      const dayKey = new Date(t.due_date).toDateString()
      const key = `${t.type}__${dayKey}`
      if (!batchGroups.has(key)) batchGroups.set(key, [])
      batchGroups.get(key).push(t)
    }
    for (const [, group] of batchGroups) {
      // 去重犬只
      const dogIds = new Set(group.map(t => t.dog_id))
      if (dogIds.size >= 3) {
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
          id: `batch-${group[0].type}-${group[0].due_date}`,
          priority: this._highestPriority(group),
          groupTitle: `${group[0].title} · ${dogs.length}只`,
          dogs,
          tasks: group,
          progress: { done: 0, total: dogs.length },
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
        priority: this._highestPriority(group),
        dogName: group[0].dog_name,
        dogId: group[0].dog_id,
        statusLabel: '',
        tasks: group,
      })
    }

    return cards
  },

  /**
   * 取一组任务中的最高优先级
   */
  _highestPriority(tasks) {
    const order = { overdue: 0, today: 1, upcoming: 2 }
    let best = 'upcoming'
    for (const t of tasks) {
      if ((order[t.priority] || 2) < (order[best] || 2)) {
        best = t.priority
      }
    }
    return best
  },
}
