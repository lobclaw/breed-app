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

<style scoped>
.members { min-height: 100vh; background: #f5f5f5; padding-bottom: 140rpx; }
.members__list { padding: 16rpx 32rpx; }
.members__item { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 12rpx; display: flex; justify-content: space-between; align-items: center; }
.members__info { flex: 1; }
.members__name { font-size: 30rpx; font-weight: 500; color: #333; display: block; }
.members__role { font-size: 24rpx; padding: 4rpx 12rpx; border-radius: 8rpx; margin-top: 8rpx; display: inline-block; }
.members__role--creator { background: #FFF3E0; color: #E65100; }
.members__role--admin { background: #E3F2FD; color: #1565C0; }
.members__role--helper { background: #f5f5f5; color: #666; }
.members__actions { display: flex; gap: 8rpx; }
.members__empty { text-align: center; padding: 80rpx; color: #999; font-size: 28rpx; }
.members__footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 20rpx 32rpx; background: #fff; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); }
.members__invite-btn { width: 100%; height: 88rpx; border-radius: 44rpx; background: #007AFF; color: #fff; font-size: 32rpx; }
</style>
