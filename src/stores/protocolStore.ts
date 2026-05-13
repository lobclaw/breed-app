/**
 * 用药方案 Store
 * 两个消费者：方案库管理页 + 用药表单的方案选择器
 */
import { defineStore } from 'pinia'
import { useAuth } from '@/composables/useAuth'
import { listLocalMedicationProtocols } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'

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

export const useProtocolStore = defineStore('protocols', {
  state: () => ({
    list: [] as MedicationProtocol[],
    loaded: false,
  }),
  // @ts-ignore - pinia-plugin-unistorage
  unistorage: {
    paths: ['list'],
  },
  actions: {
    async fetchFromServer() {
      try {
        const { currentFamily } = useAuth()
        const familyId = currentFamily.value?._id || ''
        if (!familyId) return
        localSyncRuntime.setCurrentFamilyId(familyId)
        this.list = await listLocalMedicationProtocols(familyId)
        this.loaded = true
        void localSyncRuntime.syncScope('settings-local')
      } catch { /* 网络失败保留缓存 */ }
    },

    /** 确保数据可用（stale-while-revalidate） */
    async ensure() {
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

    clearForAuthChange() {
      this.list = []
      this.loaded = false
    },
  },
})
