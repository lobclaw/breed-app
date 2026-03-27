<template>
  <view class="page">
    <!-- 顶栏 -->
    <BPageHeader title="家庭成员" />

    <!-- 骨架屏 -->
    <BSkeleton v-if="loading" :rows="3" :avatar="true" />

    <!-- 空状态 -->
    <BEmpty
      v-if="!loading && memberList.length === 0"
      icon="group"
      title="暂无成员"
      description="邀请家人一起管理犬舍"
      actionText="邀请成员"
      @action="goToInvite"
    />

    <!-- 成员列表 -->
    <view class="list" v-if="memberList.length > 0">
      <view v-for="member in memberList" :key="member.user_id" class="member-card">
        <view class="member-left">
          <view class="member-avatar" :class="`member-avatar--${member.role}`">
            <text class="material-icons-round" style="font-size: 20px; color: #fff;">person</text>
          </view>
          <view class="member-info">
            <text class="member-name">{{ member.nickname || member.user_id }}</text>
            <BTag :label="roleLabel(member.role)" :color="roleColor(member.role)" />
          </view>
        </view>

        <view v-if="member.role !== 'creator'" class="member-actions">
          <view class="action-btn" @click="changeRole(member)">
            <text class="material-icons-round" style="font-size: 18px; color: var(--blue);">swap_horiz</text>
          </view>
          <view class="action-btn action-btn--danger" @click="remove(member)">
            <text class="material-icons-round" style="font-size: 18px;">person_remove</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部邀请按钮 -->
    <view class="footer">
      <button class="invite-btn" @click="goToInvite">
        <text class="material-icons-round" style="font-size: 18px; margin-right: 6px;">person_add</text>
        <text>邀请新成员</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BTag from '@/components/base/BTag.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'

const memberList = ref<any[]>([])
const loading = ref(true)

const { run: fetchMembers } = useCloudCall<{ data: any[] }>('family-service', 'getMemberList')
const { run: updateRole } = useCloudCall('family-service', 'updateMemberRole', { successMessage: '已更新' })
const { run: removeMember } = useCloudCall('family-service', 'removeMember', { successMessage: '已移除' })

function roleLabel(role: string) {
  const labels: Record<string, string> = { creator: '创建者', admin: '管理员', helper: '协助者' }
  return labels[role] || role
}

function roleColor(role: string) {
  const map: Record<string, any> = { creator: 'amber', admin: 'blue', helper: 'green' }
  return map[role] || 'green'
}

async function load() {
  loading.value = true
  const res = await fetchMembers()
  if (res?.data) memberList.value = res.data
  loading.value = false
}

async function changeRole(member: any) {
  const newRole = member.role === 'admin' ? 'helper' : 'admin'
  const label = newRole === 'admin' ? '管理员' : '协助者'
  uni.showModal({
    title: '更改角色',
    content: `将该成员设为${label}？`,
    success: async (res) => {
      if (res.confirm) {
        await updateRole(member.user_id, newRole)
        load()
      }
    }
  })
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
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

/* 成员列表 */
.list {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: var(--space-group-gap);
}

.member-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  box-shadow: var(--shadow);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.member-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.member-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &--creator {
    background: linear-gradient(135deg, #ea3e77, #e89b3e);
  }

  &--admin {
    background: var(--blue);
  }

  &--helper {
    background: var(--green);
  }
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.member-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--card-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
  color: var(--text-2);

  &:active {
    transform: scale(0.85);
  }

  &--danger {
    &:active {
      color: var(--red);
      background: var(--red-soft);
    }
  }
}

/* 底部邀请按钮 */
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px var(--space-page);
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  background: var(--bg);
}

.invite-btn {
  width: 100%;
  height: 50px;
  border-radius: var(--radius-btn);
  background: var(--primary);
  color: #fff;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-fab);
  transition: all 0.12s ease;

  &:active {
    transform: scale(0.94);
    opacity: 0.85;
  }
}
</style>
