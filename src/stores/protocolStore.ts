/**
 * 用药方案 Store
 * 两个消费者：方案库管理页 + 用药表单的方案选择器
 * 按家庭显式缓存，避免跨账号恢复旧快照。
 */
import { defineStore } from 'pinia'
import { useAuth } from '@/composables/useAuth'
import { listLocalMedicationProtocols } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import {
  getWorkspaceCacheKey,
  readStorageJson,
  WORKSPACE_CACHE_VERSION,
  writeStorageJson,
} from '@/utils/authScopedCache'

export interface MedicationProtocol {
  _id: string
  name: string
  drug_name: string
  dosage?: string
  dosage_unit?: string
  method?: string
  frequency?: string | number
  duration_days?: number
  notes?: string
}

interface ProtocolStoreSnapshot {
  cacheVersion: number
  familyId: string
  updatedAt: number
  list: MedicationProtocol[]
}

export const useProtocolStore = defineStore('protocols', {
  state: () => ({
    list: [] as MedicationProtocol[],
    loaded: false,
  }),
  actions: {
    async fetchFromServer() {
      try {
        const { currentFamily } = useAuth()
        const familyId = currentFamily.value?._id || ''
        if (!familyId) return
        localSyncRuntime.setCurrentFamilyId(familyId)
        const fresh = await listLocalMedicationProtocols(familyId)
        if (currentFamily.value?._id !== familyId) return
        this.list = fresh
        this.loaded = true
        this.persistForFamily(familyId)
        void localSyncRuntime.syncScope('settings-local')
      } catch { /* 网络失败保留缓存 */ }
    },

    /** 确保数据可用（stale-while-revalidate） */
    async ensure() {
      const { currentFamily } = useAuth()
      const familyId = currentFamily.value?._id || ''
      if (familyId && !this.loaded && this.list.length === 0) {
        this.restoreForFamily(familyId)
      }
      if (this.loaded || this.list.length > 0) {
        this.loaded = true
        this.fetchFromServer() // 后台刷新
      } else {
        await this.fetchFromServer()
      }
    },

    /** 清除并重新加载 */
    async reload() {
      await this.fetchFromServer()
    },

    restoreForFamily(familyId: string) {
      const snapshot = readStorageJson<ProtocolStoreSnapshot>(getWorkspaceCacheKey('protocols', familyId))
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
      writeStorageJson<ProtocolStoreSnapshot>(getWorkspaceCacheKey('protocols', familyId), {
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

  },
})
