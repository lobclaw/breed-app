/**
 * 任务数据 Store
 * 自动持久化 + stale-while-revalidate
 * 首页加载时填充，BFabSheet 读取用于智能推荐
 */
import { defineStore } from 'pinia'
import { useAuth } from '@/composables/useAuth'
import { localSyncRuntime } from '@/localdb/runtime'
import type { HomeCardFocusTarget } from '@/utils/homeCardFocus'
import {
  buildFabTaskRecommendation,
  buildFabTaskUrl,
  hasBreedingMilestoneTask,
  type FabTaskRecommendation,
} from '@/utils/fabTaskRecommendation'
import { getTaskActionMeta } from '@/utils/iconRegistry'

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

interface SimpleRecommendation {
  category: 'common'
  kind?: 'simple'
  materialIcon: string
  iconColor: string
  label: string
  sub: string
  tag?: string
  tagColor?: string
  url: string
}

interface PersistedBatchCardProgress {
  dogs: any[]
  completedDogIds: string[]
}

const STORAGE_KEY = 'recent_actions'

function getRecommendationDedupKey(url: string): string {
  if (url.startsWith('/pages/record/') || url.startsWith('/pages/health/')) {
    return url.split('?')[0]
  }
  return url
}

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    cards: [] as TaskCard[],
    counts: { today: 0, week: 0, month30: 0, hasOverdue: false },
    batchCardProgress: {} as Record<string, PersistedBatchCardProgress>,
    pendingHomeTarget: '' as '' | HomeCardFocusTarget,
    loaded: false,
  }),

  // @ts-ignore
  unistorage: {
    paths: ['cards', 'counts', 'batchCardProgress'],
  },

  actions: {
    /** 从服务端加载 */
    async fetchFromServer() {
      try {
        const { currentFamily } = useAuth()
        const familyId = currentFamily.value?._id
        if (!familyId) return
        localSyncRuntime.setCurrentFamilyId(familyId)
        await localSyncRuntime.syncScope('home')
        const res = await localSyncRuntime.getHomeCards()
        if (res) {
          this.cards = (res.cards || []) as TaskCard[]
          this.counts = {
            today: res.counts?.today || 0,
            week: res.counts?.week || 0,
            month30: res.counts?.month30 || 0,
            hasOverdue: res.counts?.hasOverdue || false,
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

    setPendingHomeTarget(target: HomeCardFocusTarget) {
      this.pendingHomeTarget = target
    },

    consumePendingHomeTarget() {
      const target = this.pendingHomeTarget
      this.pendingHomeTarget = ''
      return target
    },

    clearForAuthChange() {
      this.cards = []
      this.counts = { today: 0, week: 0, month30: 0, hasOverdue: false }
      this.batchCardProgress = {}
      this.pendingHomeTarget = ''
      this.loaded = false
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
    buildSmartRecommendations(): Array<FabTaskRecommendation | SimpleRecommendation> {
      const ACTION_META = getTaskActionMeta()

      const slots: Array<FabTaskRecommendation | SimpleRecommendation> = []
      const usedUrls = new Set<string>()

      const todoCard = this.cards.find((card: any) => !hasBreedingMilestoneTask(card))
      const suggestionCard = this.cards.find((card: any) => hasBreedingMilestoneTask(card))

      const todoRecommendation = todoCard ? buildFabTaskRecommendation(todoCard) : null
      const suggestionRecommendation = suggestionCard ? buildFabTaskRecommendation(suggestionCard) : null

      if (todoRecommendation?.url) {
        slots.push(todoRecommendation)
        usedUrls.add(getRecommendationDedupKey(todoRecommendation.url))
      }

      if (suggestionRecommendation?.url && !usedUrls.has(getRecommendationDedupKey(suggestionRecommendation.url)) && slots.length < 3) {
        slots.push(suggestionRecommendation)
        usedUrls.add(getRecommendationDedupKey(suggestionRecommendation.url))
      }

      // 补位：最近常用
      const recentKeys = this.getRecentActions()
      for (const key of recentKeys) {
        if (slots.length >= 3) break
        const meta = ACTION_META[key]
        if (!meta || usedUrls.has(getRecommendationDedupKey(meta.url))) continue
        slots.push({ ...meta, category: 'common', kind: 'simple', sub: '最近常用', tag: '常用', tagColor: 'green' })
        usedUrls.add(getRecommendationDedupKey(meta.url))
      }

      // 兜底
      const defaults = [
        { ...ACTION_META.expense, category: 'common' as const, kind: 'simple' as const, sub: '开始记账', tag: '常用', tagColor: 'green' },
        { ...ACTION_META.income, category: 'common' as const, kind: 'simple' as const, sub: '记录收入', tag: '常用', tagColor: 'green' },
        { ...ACTION_META.weight, category: 'common' as const, kind: 'simple' as const, sub: '记录体重', tag: '常用', tagColor: 'green' },
      ]
      for (const d of defaults) {
        if (slots.length >= 3) break
        if (usedUrls.has(getRecommendationDedupKey(d.url))) continue
        slots.push(d)
        usedUrls.add(getRecommendationDedupKey(d.url))
      }

      return slots
    },

    _getTaskUrl(task: any): string {
      return buildFabTaskUrl(task)
    },
  },
})
