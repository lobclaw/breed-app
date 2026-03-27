<template>
  <view class="members">
    <view class="members__list">
      <view v-for="member in memberList" :key="member.user_id" class="members__item">
        <view class="members__info">
          <text class="members__name">{{ member.user_id }}</text>
          <text class="members__role" :class="`members__role--${member.role}`">{{ roleLabel(member.role) }}</text>
        </view>
        <view class="members__actions" v-if="member.role !== 'creator'">
          <button size="mini" @click="changeRole(member)">
            {{ member.role === 'admin' ? '设为协助者' : '设为管理员' }}
          </button>
          <button size="mini" type="warn" @click="remove(member)">移除</button>
        </view>
      </view>
    </view>

    <view v-if="memberList.length === 0 && !loading" class="members__empty">
      <text>暂无成员</text>
    </view>

    <view class="members__footer">
      <button class="members__invite-btn" @click="goToInvite">邀请新成员</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'

const memberList = ref<any[]>([])
const loading = ref(true)

const { run: fetchMembers } = useCloudCall<{ data: any[] }>('family-service', 'getMemberList')
const { run: updateRole } = useCloudCall('family-service', 'updateMemberRole', { successMessage: '已更新' })
const { run: removeMember } = useCloudCall('family-service', 'removeMember', { successMessage: '已移除' })

function roleLabel(role: string) {
  const labels: Record<string, string> = { creator: '创建者', admin: '管理员', helper: '协助者' }
  return labels[role] || role
}

async function load() {
  loading.value = true
  const res = await fetchMembers()
  if (res?.data) memberList.value = res.data
  loading.value = false
}

async function changeRole(member: any) {
  const newRole = member.role === 'admin' ? 'helper' : 'admin'
  await updateRole(member.user_id, newRole)
  load()
}

async function remove(member: any) {
  uni.showModal({
    title: '确认移除',
    content: '移除后该成员将无法访问家庭数据',
    success: async (res) => {
      if (res.confirm) {
        await removeMember(member.user_id)
        load()
      }
    }
  })
}

function goToInvite() {
  uni.navigateTo({ url: '/pages/family/invite' })
}

onShow(() => load())
</script>

<style lang="scss" scoped>
.members {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 70px;
}

.members__list {
  padding: 8px 16px;
}

.members__item {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 12px;
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow);
}

.members__info {
  flex: 1;
}

.members__name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-1);
  display: block;
}

.members__role {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: var(--radius-tag);
  margin-top: 4px;
  display: inline-block;
}

.members__role--creator {
  background: var(--amber-soft);
  color: var(--amber);
}

.members__role--admin {
  background: var(--blue-soft);
  color: var(--blue);
}

.members__role--helper {
  background: var(--bg);
  color: var(--text-2);
}

.members__actions {
  display: flex;
  gap: 4px;
}

.members__empty {
  text-align: center;
  padding: 40px;
  color: var(--text-3);
  font-size: 14px;
}

.members__footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px 16px;
  background: var(--card);
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  box-shadow: var(--shadow);
}

.members__invite-btn {
  width: 100%;
  height: 44px;
  border-radius: var(--radius-btn);
  background: var(--primary);
  color: var(--card);
  font-size: 16px;
  font-family: var(--font-display);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}
</style>
