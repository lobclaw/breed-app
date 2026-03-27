<template>
  <view class="page">
    <!-- 顶栏 -->
    <BPageHeader title="合作代理人" />

    <!-- 骨架屏 -->
    <view v-if="loading" style="padding: 0 16px;">
      <BSkeleton :rows="3" />
    </view>

    <!-- 代理人列表 -->
    <view v-else-if="agentList.length > 0" class="agent-list">
      <view v-for="agent in agentList" :key="agent._id" class="agent-card">
        <view class="agent-avatar">
          <text class="material-icons-round" style="color: #fff; font-size: 20px;">person</text>
        </view>
        <view class="agent-info">
          <text class="agent-name">{{ agent.name }}</text>
          <text v-if="agent.contact_info" class="agent-contact">{{ agent.contact_info }}</text>
        </view>
        <view class="agent-actions">
          <text class="material-icons-round agent-actions__edit" @click="startEdit(agent)">edit</text>
          <text class="material-icons-round agent-actions__delete" @click="remove(agent._id)">delete_outline</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <BEmpty
      v-else
      icon="handshake"
      title="暂无代理人"
      description="添加合作代理人，方便在销售记录中关联"
      actionText="+ 添加代理人"
      @action="showAdd = true"
    />

    <!-- 添加/编辑表单 -->
    <view class="form-area" v-if="showAdd">
      <view class="form-card">
        <view class="form-group">
          <text class="form-label">代理人姓名</text>
          <input v-model="form.name" class="form-input" placeholder="输入姓名" />
        </view>
        <view class="form-group">
          <text class="form-label">联系方式 <text style="font-weight: 500; color: var(--text-3); font-size: 11px;">（选填）</text></text>
          <input v-model="form.contact_info" class="form-input" placeholder="手机号/微信" />
        </view>
        <view class="form-actions">
          <button class="form-btn form-btn--ghost" @click="cancelForm">取消</button>
          <button class="form-btn form-btn--primary" :disabled="!form.name" @click="save">{{ editingId ? '更新' : '保存' }}</button>
        </view>
      </view>
    </view>

    <!-- FAB -->
    <view class="page-fab" v-if="!showAdd" @click="showAdd = true">
      <text class="material-icons-round" style="font-size: 28px; color: #fff;">add</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'

const agentList = ref<any[]>([])
const loading = ref(true)
const showAdd = ref(false)
const editingId = ref('')

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

function startEdit(agent: any) {
  editingId.value = agent._id
  form.name = agent.name
  form.contact_info = agent.contact_info || ''
  showAdd.value = true
}

function cancelForm() {
  showAdd.value = false
  editingId.value = ''
  form.name = ''
  form.contact_info = ''
}

async function save() {
  await addAgent({ name: form.name, contact_info: form.contact_info || null })
  cancelForm()
  load()
}

async function remove(id: string) {
  uni.showModal({
    title: '确认删除',
    content: '删除后不可恢复',
    success: async (res) => {
      if (res.confirm) {
        await removeAgent(id)
        load()
      }
    },
  })
}

onShow(() => load())
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

/* ==================== AGENT LIST ==================== */
.agent-list {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-card {
  background: var(--card);
  border-radius: var(--radius-row);
  padding: 14px 16px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  gap: 12px;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.agent-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  display: block;
}

.agent-contact {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
  display: block;
}

.agent-actions {
  display: flex;
  align-items: center;
  gap: 4px;

  &__edit {
    font-family: 'Material Icons Round';
    font-size: 20px;
    color: var(--text-3);
    padding: 4px;
    border-radius: 50%;
    transition: background 0.15s;
    &:active { background: var(--card-dim); }
  }

  &__delete {
    font-family: 'Material Icons Round';
    font-size: 20px;
    color: var(--red);
    padding: 4px;
    border-radius: 50%;
    transition: background 0.15s;
    &:active { background: var(--card-dim); }
  }
}

/* ==================== FORM ==================== */
.form-area {
  padding: 16px;
}

.form-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 20px 16px;
  box-shadow: var(--shadow);
}

.form-group {
  margin-bottom: 16px;
  &:last-of-type { margin-bottom: 0; }
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 8px;
  display: block;
}

.form-input {
  width: 100%;
  height: 44px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  padding: 0 14px;
  font-size: 15px;
  color: var(--text-1);
  background: var(--bg);
  transition: border-color 0.2s;
  &:focus { border-color: var(--primary); }
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.form-btn {
  flex: 1;
  height: 44px;
  border-radius: var(--radius-btn);
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  line-height: 44px;
  padding: 0;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.94); }

  &--primary {
    background: var(--primary);
    color: #fff;
  }

  &--ghost {
    background: transparent;
    border: 1.5px solid var(--text-4);
    color: var(--text-2);
  }

  &[disabled] { opacity: 0.5; }
}

/* ==================== PAGE FAB ==================== */
.page-fab {
  position: fixed;
  bottom: 40px;
  right: 20px;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-fab);
  z-index: 50;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:active {
    transform: scale(0.88);
    box-shadow: 0 2px 8px rgba(234, 62, 119, 0.2);
  }
}
</style>
