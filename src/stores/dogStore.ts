/**
 * 犬只数据 Store
 * 自动持久化（pinia-plugin-unistorage）+ stale-while-revalidate
 */
import { defineStore } from 'pinia'
import { cloudCall } from '@/composables/useCloudCall'

interface Dog {
  _id: string
  name: string
  gender: string
  role: string
  breed?: string
  birth_date?: number
  disposition?: string
  [key: string]: any
}

export const useDogStore = defineStore('dogs', {
  state: () => ({
    list: [] as Dog[],
    loaded: false,
  }),

  // @ts-ignore — pinia-plugin-unistorage 选项
  unistorage: {
    paths: ['list'],  // 只持久化 list，不持久化 loaded
  },

  actions: {
    /** 从服务端加载最新数据 */
    async fetchFromServer() {
      try {
        const res = await cloudCall<{ data: any }>('dog-service', 'getDogListWithStatus')
        const fresh: Dog[] = res?.data?.dogs || res?.data || []
        this.list = fresh
        this.loaded = true
      } catch {
        // 网络失败，保留已有缓存
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

    /** 按条件过滤 */
    getFiltered(roleFilter?: string, genderFilter?: string): Dog[] {
      let result = [...this.list]
      if (roleFilter) result = result.filter(d => d.role === roleFilter)
      if (genderFilter) result = result.filter(d => d.gender === genderFilter)
      return result
    },

    /** 新增犬只到缓存 */
    addDog(dog: Dog) {
      this.list.push(dog)
    },

    /** 更新缓存中的犬只 */
    updateDog(id: string, data: Partial<Dog>) {
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
