/**
 * 犬只数据 Store
 * 按家庭显式缓存 + local-first
 */
import { defineStore } from 'pinia'
import { useAuth } from '@/composables/useAuth'
import { listLocalDogsWithStatus } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import type { DogWithStatus } from '@/types/dog'
import {
  getWorkspaceCacheKey,
  readStorageJson,
  WORKSPACE_CACHE_VERSION,
  writeStorageJson,
} from '@/utils/authScopedCache'

interface DogStoreSnapshot {
  cacheVersion: number
  familyId: string
  updatedAt: number
  list: DogWithStatus[]
}

export const useDogStore = defineStore('dogs', {
  state: () => ({
    list: [] as DogWithStatus[],
    loaded: false,
  }),

  actions: {
    /** 从本地投影加载，并按页面 scope 后台同步 */
    async fetchFromServer() {
      try {
        const { currentFamily } = useAuth()
        const familyId = currentFamily.value?._id || ''
        if (!familyId) return
        localSyncRuntime.setCurrentFamilyId(familyId)
        const fresh = await listLocalDogsWithStatus(familyId)
        if (currentFamily.value?._id !== familyId) return
        this.list = fresh
        this.loaded = true
        this.persistForFamily(familyId)
        void localSyncRuntime.syncScope('dog-list')
      } catch {
        // 本地读取失败时保留缓存
      }
    },

    /** 确保数据可用（有缓存立即返回，后台刷新） */
    async ensure() {
      const { currentFamily } = useAuth()
      const familyId = currentFamily.value?._id || ''
      if (familyId && !this.loaded && this.list.length === 0) {
        this.restoreForFamily(familyId)
      }
      if (this.list.length > 0) {
        this.loaded = true
        // 后台静默刷新
        this.fetchFromServer()
      } else {
        // 无缓存：等待加载
        await this.fetchFromServer()
      }
    },

    restoreForFamily(familyId: string) {
      const snapshot = readStorageJson<DogStoreSnapshot>(getWorkspaceCacheKey('dogs', familyId))
      if (!snapshot || snapshot.familyId !== familyId || snapshot.cacheVersion !== WORKSPACE_CACHE_VERSION) {
        this.clearCurrentSession()
        return false
      }
      this.list = snapshot.list || []
      this.loaded = true
      return true
    },

    persistForFamily(familyId: string) {
      if (!familyId) return
      writeStorageJson<DogStoreSnapshot>(getWorkspaceCacheKey('dogs', familyId), {
        cacheVersion: WORKSPACE_CACHE_VERSION,
        familyId,
        updatedAt: Date.now(),
        list: this.list,
      })
    },

    clearCurrentSession() {
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
      const { currentFamily } = useAuth()
      this.persistForFamily(currentFamily.value?._id || '')
    },

    /** 更新缓存中的犬只 */
    updateDog(id: string, data: Partial<DogWithStatus>) {
      const idx = this.list.findIndex(d => d._id === id)
      if (idx >= 0) {
        this.list[idx] = { ...this.list[idx], ...data }
        const { currentFamily } = useAuth()
        this.persistForFamily(currentFamily.value?._id || '')
      }
    },

    /** 从缓存中移除犬只（软删除） */
    removeDog(id: string) {
      this.list = this.list.filter(d => d._id !== id)
      const { currentFamily } = useAuth()
      this.persistForFamily(currentFamily.value?._id || '')
    },
  },
})
