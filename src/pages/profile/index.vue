<template>
  <view class="profile">
    <view class="profile__header">
      <view class="profile__avatar">
        <text class="profile__avatar-text">{{ userInitial }}</text>
      </view>
      <view class="profile__info">
        <text class="profile__name">{{ familyName || '未创建家庭' }}</text>
        <text class="profile__role">{{ roleLabel }}</text>
      </view>
    </view>

    <view class="profile__menu">
      <view class="profile__menu-item" @click="goTo('/pages/family/setup')">
        <text>家庭管理</text>
        <text class="profile__arrow">›</text>
      </view>
      <view class="profile__menu-item">
        <text>通知设置</text>
        <text class="profile__arrow">›</text>
      </view>
      <view class="profile__menu-item">
        <text>用药方案库</text>
        <text class="profile__hint">第四批</text>
      </view>
      <view class="profile__menu-item">
        <text>代理人管理</text>
        <text class="profile__hint">第四批</text>
      </view>
    </view>

    <view class="profile__menu">
      <view class="profile__menu-item" @click="logout">
        <text class="profile__logout-text">退出登录</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth'

const { currentFamily, userRole, logout } = useAuth()

const familyName = computed(() => currentFamily.value?.name || '')
const userInitial = computed(() => familyName.value.charAt(0) || '?')
const roleLabel = computed(() => {
  const map: Record<string, string> = { creator: '创建者', admin: '管理员', helper: '协助者' }
  return map[userRole.value || ''] || ''
})

function goTo(url: string) {
  uni.navigateTo({ url })
}
</script>

<style scoped>
.profile { min-height: 100vh; background: #f5f5f5; }
.profile__header { display: flex; gap: 24rpx; padding: 40rpx 32rpx; background: #fff; align-items: center; }
.profile__avatar { width: 100rpx; height: 100rpx; border-radius: 50%; background: #007AFF; display: flex; align-items: center; justify-content: center; }
.profile__avatar-text { font-size: 40rpx; color: #fff; font-weight: 600; }
.profile__info { flex: 1; }
.profile__name { font-size: 34rpx; font-weight: 600; color: #333; }
.profile__role { font-size: 26rpx; color: #999; margin-top: 4rpx; }
.profile__menu { background: #fff; margin-top: 16rpx; }
.profile__menu-item { display: flex; justify-content: space-between; align-items: center; padding: 28rpx 32rpx; border-bottom: 1rpx solid #f5f5f5; font-size: 30rpx; }
.profile__arrow { color: #ccc; font-size: 36rpx; }
.profile__hint { font-size: 24rpx; color: #ccc; }
.profile__logout-text { color: #FF3B30; }
</style>
