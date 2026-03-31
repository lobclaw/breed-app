/**
 * 任务数据 Store
 * 自动持久化 + stale-while-revalidate
 * 首页加载时填充，BFabSheet 读取用于智能推荐
 */
import { defineStore } from 'pinia'
import { cloudCall } from '@/composables/useCloudCall'

interface TaskCard {
  id: string
  cardType: string
  priority: string
  overdueDays?: number
  dogName?: string
  dogId?: string
  groupTitle?: string
  title?: string
  tasks?: any[]
  [key: string]: any
}

const STORAGE_KEY = 'recent_actions'

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    cards: [] as TaskCard[],
    counts: { today: 0, week: 0, month30: 0, hasOverdue: false },
    loaded: false,
  }),

  // @ts-ignore
  unistorage: {
    paths: ['cards', 'counts'],
  },

  actions: {
    /** 从服务端加载 */
    async fetchFromServer() {
      try {
        const res = await cloudCall<{ data: any }>('task-service', 'getHomeCards')
        if (res?.data) {
          this.cards = res.data.cards || []
          this.counts = {
            today: res.data.counts?.today || 0,
            week: res.data.counts?.week || 0,
            month30: res.data.counts?.month30 || 0,
            hasOverdue: res.data.counts?.hasOverdue || false,
          }
          this.loaded = true
        }
      } catch { /* 网络失败保留缓存 */ }
    },

    /** 确保数据可用 */
    async ensure() {
      if (this.loaded || this.cards.length > 0) {
        this.loaded = true
        this.fetchFromServer()
      } else {
        await this.fetchFromServer()
      }
    },

    /** 获取最近操作记录（本地存储） */
    getRecentActions(): string[] {
      try {
        const raw = uni.getStorageSync(STORAGE_KEY)
        if (!raw) return []
        const list = JSON.parse(raw) as string[]
        const freq: Record<string, number> = {}
        list.forEach(k => { freq[k] = (freq[k] || 0) + 1 })
        return Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .map(e => e[0])
      } catch { return [] }
    },

    /** 记录用户操作 */
    trackAction(actionKey: string) {
      try {
        const raw = uni.getStorageSync(STORAGE_KEY)
        const list: string[] = raw ? JSON.parse(raw) : []
        list.unshift(actionKey)
        if (list.length > 30) list.length = 30
        uni.setStorageSync(STORAGE_KEY, JSON.stringify(list))
      } catch { /* ignore */ }
    },

    /** 本地移除卡片（乐观更新） */
    removeCardByTaskId(taskId: string) {
      const idx = this.cards.findIndex(c => c.tasks?.some((t: any) => t._id === taskId) || c.id === taskId)
      if (idx >= 0) {
        const card = this.cards[idx]
        if (!card.tasks || card.tasks.length <= 1) {
          this.cards.splice(idx, 1)
          this.counts.today = Math.max(0, this.counts.today - 1)
        } else {
          card.tasks = card.tasks.filter((t: any) => t._id !== taskId)
        }
      }
    },

    /** 构建智能推荐（3 槽位降级） */
    buildSmartRecommendations(): any[] {
      const ACTION_META: Record<string, { materialIcon: string; iconColor: string; label: string; url: string }> = {
        expense: { materialIcon: 'payments', iconColor: 'green', label: '支出录入', url: '/pages/finance/expense-add' },
        income: { materialIcon: 'account_balance', iconColor: 'red', label: '收入录入', url: '/pages/finance/expense-add?type=income' },
        vaccination: { materialIcon: 'vaccines', iconColor: 'blue', label: '疫苗记录', url: '/pages/record/health-vaccination' },
        deworming: { materialIcon: 'shield', iconColor: 'teal', label: '驱虫记录', url: '/pages/record/health-deworming' },
        illness: { materialIcon: 'sick', iconColor: 'plum', label: '疾病记录', url: '/pages/record/health-illness' },
        heat: { materialIcon: 'whatshot', iconColor: 'rose', label: '发情记录', url: '/pages/record/breeding-heat' },
        mating: { materialIcon: 'favorite', iconColor: 'rose', label: '配种记录', url: '/pages/record/breeding-mating' },
        weight: { materialIcon: 'monitor_weight', iconColor: 'teal', label: '体重记录', url: '/pages/health/batch-weight' },
      }

      const slots: any[] = []
      const usedUrls = new Set<string>()

      // 槽位 1：待办（排除健康关注卡）
      const actionableCards = this.cards.filter((c: any) => c.cardType !== 'health_attention')
      if (actionableCards.length > 0) {
        const task = actionableCards[0]
        slots.push({
          materialIcon: 'assignment_turned_in',
          iconColor: task.priority === 'overdue' ? 'red' : 'amber',
          label: task.groupTitle || task.title || task.dogName || '待处理任务',
          sub: task.priority === 'overdue' ? '已逾期 · 点击直接录入' : '今日待办 · 点击直接录入',
          tag: '待办', tagColor: task.priority === 'overdue' ? 'red' : 'amber',
          url: this._getTaskUrl(task),
        })
        usedUrls.add(slots[0].url)
      }

      // 补位：最近常用
      const recentKeys = this.getRecentActions()
      for (const key of recentKeys) {
        if (slots.length >= 3) break
        const meta = ACTION_META[key]
        if (!meta || usedUrls.has(meta.url)) continue
        slots.push({ ...meta, sub: '最近常用', tag: '常用', tagColor: 'green' })
        usedUrls.add(meta.url)
      }

      // 兜底
      const defaults = [
        { ...ACTION_META.expense, sub: '开始记账', tag: '常用', tagColor: 'green' },
        { ...ACTION_META.income, sub: '记录收入', tag: '常用', tagColor: 'green' },
        { ...ACTION_META.weight, sub: '记录体重', tag: '常用', tagColor: 'green' },
      ]
      for (const d of defaults) {
        if (slots.length >= 3) break
        if (usedUrls.has(d.url)) continue
        slots.push(d)
        usedUrls.add(d.url)
      }

      return slots
    },

    _getTaskUrl(task: any): string {
      const t = task.tasks?.[0]
      const taskType = t?.type || ''

      if (task.cardType === 'batch' && task.dogs?.length > 0) {
        const dogList = task.dogs
          .filter((d: any) => !d.completed)
          .map((d: any) => ({ _id: d.dogId, name: d.dogName }))
        const dogsParam = encodeURIComponent(JSON.stringify(dogList))
        const taskIds = task.tasks?.map((t: any) => t._id).join(',') || ''
        const typePageMap: Record<string, string> = {
          vaccination: '/pages/record/health-vaccination',
          deworming: '/pages/record/health-deworming',
          illness: '/pages/record/health-illness',
        }
        const page = typePageMap[taskType] || '/pages/record/health-vaccination'
        return `${page}?batchDogs=${dogsParam}&taskIds=${taskIds}`
      }

      const dogId = task.dogId || task.dog_id
      const dogParam = dogId ? `?dogId=${dogId}` : ''
      if (!t) return '/pages/record/health-vaccination' + dogParam
      switch (taskType) {
        case 'vaccination': return '/pages/record/health-vaccination' + dogParam
        case 'deworming': return '/pages/record/health-deworming' + dogParam
        case 'breeding_milestone': return `/pages/breeding/cycle${t.cycle_id ? '?id=' + t.cycle_id : ''}`
        case 'medication': return `/pages/record/medication-detail${t.source_record_id ? '?taskId=' + t.source_record_id : ''}`
        default: return '/pages/record/health-vaccination' + dogParam
      }
    },
  },
})
