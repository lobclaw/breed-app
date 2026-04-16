<template>
  <view class="page">
    <BPageHeader title="合作代理人">
      <template #right>
        <view class="header-add" @click="openSheet()">
          <text class="material-icons-round" style="font-size: 18px;">add</text>
          <text class="header-add__text">新建</text>
        </view>
      </template>
    </BPageHeader>

    <!-- 骨架屏 -->
    <view v-if="loading" class="agent-list">
      <view v-for="i in 3" :key="i" class="agent-card agent-card--skeleton">
        <view class="sk sk-avatar" />
        <view class="agent-info">
          <view class="sk sk-name" />
          <view class="sk sk-contact" />
        </view>
        <view class="sk sk-actions" />
      </view>
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
          <text class="material-icons-round agent-actions__edit" @click="openSheet(agent)">edit</text>
          <text class="material-icons-round agent-actions__delete" @click="askDelete(agent._id)">delete_outline</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <BEmpty
      v-else
      icon="handshake"
      title="暂无代理人"
      description="添加合作代理人，方便在销售记录中关联"
      actionText="新建代理人"
      @action="openSheet()"
    />

    <!-- 新建/编辑 BSheet -->
    <BSheet v-model:visible="showSheet" :title="editingId ? '编辑代理人' : '新建代理人'" height="auto">
      <view class="sheet-form">
        <view class="field-group">
          <text class="field-label">代理人姓名</text>
          <input v-model="form.name" class="form-input" placeholder="输入姓名" :focus="showSheet" />
        </view>
        <view class="field-group">
          <text class="field-label">联系方式 <text class="field-optional">（选填）</text></text>
          <input v-model="form.contact_info" class="form-input" placeholder="手机号/微信" />
        </view>
        <view class="sheet-actions">
          <button class="submit-btn" :disabled="!form.name.trim()" @click="save">
            {{ editingId ? '保存修改' : '新建代理人' }}
          </button>
        </view>
      </view>
    </BSheet>

    <!-- 删除确认 -->
    <BDeleteConfirm
      v-model:visible="showDeleteConfirm"
      title="删除代理人"
      content="删除后不可恢复，历史销售记录中的关联名称保持不变"
      @confirm="confirmDelete"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BDeleteConfirm from '@/components/layout/BDeleteConfirm.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'

const CACHE_KEY = 'agents_list_cache'
function readCache(): any[] {
  try { return JSON.parse(uni.getStorageSync(CACHE_KEY) || '[]') } catch { return [] }
}
function saveCache(data: any[]) {
  try { uni.setStorageSync(CACHE_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

const agentList = ref<any[]>(readCache())
const loading = ref(agentList.value.length === 0)
const showSheet = ref(false)
const showDeleteConfirm = ref(false)
const editingId = ref('')
const deletingId = ref('')
const form = reactive({ name: '', contact_info: '' })

const { run: fetchAgents } = useCloudCall<{ data: any[] }>('finance-service', 'getAgentList')
const { run: addAgent } = useCloudCall('finance-service', 'addAgent', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: updateAgent } = useCloudCall('finance-service', 'updateAgent', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: removeAgent } = useCloudCall('finance-service', 'removeAgent', { successMode: 'silent', loadingMode: 'local', throwOnError: true })

async function load() {
  const res = await fetchAgents()
  if (res?.data) {
    agentList.value = res.data
    saveCache(res.data)
  }
  loading.value = false
}

function openSheet(agent?: any) {
  editingId.value = agent?._id || ''
  form.name = agent?.name || ''
  form.contact_info = agent?.contact_info || ''
  showSheet.value = true
}

function save() {
  const name = form.name.trim()
  if (!name) return
  showSheet.value = false

  if (editingId.value) {
    // 乐观更新：重命名
    const idx = agentList.value.findIndex(a => a._id === editingId.value)
    if (idx !== -1) {
      const updated = [...agentList.value]
      updated[idx] = { ...updated[idx], name, contact_info: form.contact_info || null }
      agentList.value = updated
      saveCache(agentList.value)
    }
    const id = editingId.value
    updateAgent(id, { name, contact_info: form.contact_info || null }).catch(() => {
      load()
      uni.showToast({ title: '更新失败，请重试', icon: 'none' })
    })
  } else {
    // 乐观更新：新建（临时占位）
    const tempId = `tmp_${Date.now()}`
    const newAgent = { _id: tempId, name, contact_info: form.contact_info || null }
    agentList.value = [...agentList.value, newAgent]
    saveCache(agentList.value)
    addAgent({ name, contact_info: form.contact_info || null }).then(() => {
      load() // 刷新换真实 _id
    }).catch(() => {
      agentList.value = agentList.value.filter(a => a._id !== tempId)
      saveCache(agentList.value)
      uni.showToast({ title: '添加失败，请重试', icon: 'none' })
    })
  }
}

function askDelete(id: string) {
  deletingId.value = id
  showDeleteConfirm.value = true
}

function confirmDelete() {
  const id = deletingId.value
  const prev = [...agentList.value]
  agentList.value = agentList.value.filter(a => a._id !== id)
  saveCache(agentList.value)
  showDeleteConfirm.value = false
  removeAgent(id).catch(() => {
    agentList.value = prev
    saveCache(prev)
    uni.showToast({ title: '删除失败，请重试', icon: 'none' })
  })
}

onShow(() => {
  if (agentList.value.length > 0) {
    load() // 静默刷新
  } else {
    load()
  }
})
</script>

<style lang="scss" scoped>
/* ==================== AGENT LIST ==================== */
.agent-list {
  padding: 0 var(--space-page);
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

/* ==================== SKELETON ==================== */
.sk {
  border-radius: 4px;
  background: linear-gradient(90deg, var(--card-dim) 25%, var(--bg) 50%, var(--card-dim) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.sk-avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
.sk-name { height: 13px; border-radius: 6px; width: 70px; margin-bottom: 6px; }
.sk-contact { height: 11px; border-radius: 5px; width: 100px; }
.sk-actions { width: 60px; height: 28px; border-radius: 14px; flex-shrink: 0; }
.agent-card--skeleton .agent-info { display: flex; flex-direction: column; }

/* ==================== HEADER ADD ==================== */
.header-add {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--primary);
  padding: 6px 14px 6px 10px;
  border-radius: 20px;
  background: var(--primary-soft);
  transition: all 0.12s ease;
  &:active { transform: scale(0.92); background: var(--icon-rose); }
  &__text { font-size: 13px; font-weight: 700; }
}

/* ==================== SHEET FORM ==================== */
.sheet-form {
  padding: 0 var(--space-page) var(--space-page);
}

.field-group { margin-bottom: 16px; }

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 8px;
  display: block;
}

.field-optional {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-4);
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
  box-sizing: border-box;
}

.sheet-actions { margin-top: 8px; }
</style>
