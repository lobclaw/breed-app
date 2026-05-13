/**
 * 犬只数据 Store
 * 自动持久化（pinia-plugin-unistorage）+ local-first
 */
import { defineStore } from 'pinia'
import { useAuth } from '@/composables/useAuth'
import { listLocalDogsWithStatus } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import type { DogWithStatus } from '@/types/dog'

export const useDogStore = defineStore('dogs', {
  state: () => ({
    list: [] as DogWithStatus[],
    loaded: false,
  }),

  // @ts-ignore — pinia-plugin-unistorage 选项
  unistorage: {
    paths: ['list'],  // 只持久化 list，不持久化 loaded
  },

  actions: {
    /** 从本地投影加载，并按页面 scope 后台同步 */
    async fetchFromServer() {
      try {
        const { currentFamily } = useAuth()
        const familyId = currentFamily.value?._id || ''
        if (!familyId) return
        localSyncRuntime.setCurrentFamilyId(familyId)
        const fresh = await listLocalDogsWithStatus(familyId)
        this.list = fresh
        this.loaded = true
        void localSyncRuntime.syncScope('dog-list')
      } catch {
        // 本地读取失败时保留缓存
      }
    },

    /** 确保数据可用（有缓存立即返回，后台刷新） */
    async ensure() {
      if (this.list.length > 0) {
        this.loaded = true
        // 后台静默刷新
        this.fetchFromServer()
      } else {
        // 无缓存：等待加载
        await this.fetchFromServer()
      }
    },

    clearForAuthChange() {
      this.list = []
      this.loaded = false
    },

    /** 按条件过滤 */
    getFiltered(roleFilter?: string, genderFilter?: string): DogWithStatus[] {
      let result = [...this.list]
      if (roleFilter) result = result.filter(d => d.role === roleFilter)
      if (genderFilter) result = result.filter(d => d.gender === genderFilter)
      return result
    },

    /** 新增犬只到缓存 */
    addDog(dog: DogWithStatus) {
      this.list.push(dog)
    },

    /** 更新缓存中的犬只 */
    updateDog(id: string, data: Partial<DogWithStatus>) {
      const idx = this.list.findIndex(d => d._id === id)
      if (idx >= 0) {
        this.list[idx] = { ...this.list[idx], ...data }
      }
    },

    /** 从缓存中移除犬只（软删除） */
    removeDog(id: string) {
      this.list = this.list.filter(d => d._id !== id)
    },
  },
})
