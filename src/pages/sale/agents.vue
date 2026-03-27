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

<style lang="scss" scoped>
.agents {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 60px;
}

.agents__list {
  padding: 8px 16px;
}

.agents__item {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 12px;
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.agents__item-info {
  flex: 1;
}

.agents__item-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-1);
  display: block;
}

.agents__item-contact {
  font-size: 12px;
  color: var(--text-3);
  display: block;
  margin-top: 2px;
}

.agents__empty {
  text-align: center;
  padding: 40px;
  color: var(--text-3);
  font-size: 14px;
}

.agents__add {
  padding: 8px 16px;
}

.agents__form {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 12px;
  box-shadow: var(--shadow);
}

.agents__input {
  border-bottom: 1px solid var(--card-dim);
  padding: 10px 0;
  font-size: 14px;
  color: var(--text-1);
}

.agents__form-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.agents__btn {
  flex: 1;
  height: 36px;
  border-radius: var(--radius-btn);
  font-size: 14px;
  background: var(--bg);
  color: var(--text-2);
  line-height: 36px;
  padding: 0;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.agents__btn--primary {
  background: var(--primary);
  color: var(--card);
}

.agents__btn[disabled] {
  opacity: 0.5;
}

.agents__fab {
  position: fixed;
  right: 16px;
  bottom: 60px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--card);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: var(--shadow-fab);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}
</style>
