<template>
  <view class="agents">
    <view class="agents__list">
      <view v-for="agent in agentList" :key="agent._id" class="agents__item">
        <view class="agents__item-info">
          <text class="agents__item-name">{{ agent.name }}</text>
          <text v-if="agent.contact_info" class="agents__item-contact">{{ agent.contact_info }}</text>
        </view>
        <button size="mini" type="warn" @click="remove(agent._id)">删除</button>
      </view>
    </view>

    <view v-if="agentList.length === 0 && !loading" class="agents__empty">
      <text>暂无代理人，点击下方添加</text>
    </view>

    <!-- 添加表单 -->
    <view class="agents__add" v-if="showAdd">
      <view class="agents__form">
        <input v-model="form.name" class="agents__input" placeholder="代理人姓名" />
        <input v-model="form.contact_info" class="agents__input" placeholder="联系方式（选填）" />
        <view class="agents__form-actions">
          <button class="agents__btn" @click="showAdd = false">取消</button>
          <button class="agents__btn agents__btn--primary" :disabled="!form.name" @click="save">保存</button>
        </view>
      </view>
    </view>

    <view class="agents__fab" @click="showAdd = true" v-if="!showAdd">
      <text>+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'

const agentList = ref<any[]>([])
const loading = ref(true)
const showAdd = ref(false)

const form = reactive({ name: '', contact_info: '' })

const { run: fetchAgents } = useCloudCall<{ data: any[] }>('finance-service', 'getAgentList')
const { run: addAgent } = useCloudCall('finance-service', 'addAgent', { successMessage: '已添加' })
const { run: removeAgent } = useCloudCall('finance-service', 'removeAgent', { successMessage: '已删除' })

async function load() {
  loading.value = true
  const res = await fetchAgents()
  if (res?.data) agentList.value = res.data
  loading.value = false
}

async function save() {
  await addAgent({ name: form.name, contact_info: form.contact_info || null })
  form.name = ''
  form.contact_info = ''
  showAdd.value = false
  load()
}

async function remove(id: string) {
  uni.showModal({
    title: '确认删除',
    success: async (res) => {
      if (res.confirm) {
        await removeAgent(id)
        load()
      }
    }
  })
}

onShow(() => load())
</script>

<style scoped>
.agents { min-height: 100vh; background: #f5f5f5; padding-bottom: 120rpx; }
.agents__list { padding: 16rpx 32rpx; }
.agents__item { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 12rpx; display: flex; justify-content: space-between; align-items: center; }
.agents__item-info { flex: 1; }
.agents__item-name { font-size: 30rpx; font-weight: 500; color: #333; display: block; }
.agents__item-contact { font-size: 24rpx; color: #999; display: block; margin-top: 4rpx; }
.agents__empty { text-align: center; padding: 80rpx; color: #999; font-size: 28rpx; }
.agents__add { padding: 16rpx 32rpx; }
.agents__form { background: #fff; border-radius: 16rpx; padding: 24rpx; }
.agents__input { border-bottom: 1rpx solid #f0f0f0; padding: 20rpx 0; font-size: 28rpx; color: #333; }
.agents__form-actions { display: flex; gap: 16rpx; margin-top: 24rpx; }
.agents__btn { flex: 1; height: 72rpx; border-radius: 36rpx; font-size: 28rpx; background: #f5f5f5; color: #666; line-height: 72rpx; padding: 0; }
.agents__btn--primary { background: #007AFF; color: #fff; }
.agents__btn[disabled] { opacity: 0.5; }
.agents__fab { position: fixed; right: 32rpx; bottom: 120rpx; width: 96rpx; height: 96rpx; border-radius: 50%; background: #007AFF; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 48rpx; box-shadow: 0 4rpx 16rpx rgba(0,122,255,0.3); }
</style>
