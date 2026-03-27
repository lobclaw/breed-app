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
      <view class="profile__menu-item" @click="goTo('/pages/family/members')">
        <text>成员管理</text>
        <text class="profile__arrow">›</text>
      </view>
      <view class="profile__menu-item" @click="goTo('/pages/family/invite')">
        <text>邀请成员</text>
        <text class="profile__arrow">›</text>
      </view>
    </view>

    <view class="profile__menu">
      <view class="profile__menu-item" @click="goTo('/pages/health/medication-protocols')">
        <text>用药方案库</text>
        <text class="profile__arrow">›</text>
      </view>
      <view class="profile__menu-item" @click="goTo('/pages/sale/agents')">
        <text>代理人管理</text>
        <text class="profile__arrow">›</text>
      </view>
      <view class="profile__menu-item" @click="goTo('/pages/health/batch-weight')">
        <text>批量体重录入</text>
        <text class="profile__arrow">›</text>
      </view>
    </view>

    <view class="profile__menu">
      <view class="profile__menu-item" @click="goTo('/pages/profile/notifications')">
        <text>通知设置</text>
        <text class="profile__arrow">›</text>
      </view>
      <view class="profile__menu-item" @click="toggleDarkMode">
        <text>暗色模式</text>
        <switch :checked="isDark" style="transform: scale(0.8);" @change="toggleDarkMode" />
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
import { useTheme } from '@/composables/useTheme'

const { currentFamily, userRole, logout } = useAuth()
const { isDark, setTheme } = useTheme()

function toggleDarkMode() {
  setTheme(isDark.value ? 'light' : 'dark')
}

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

<style lang="scss" scoped>
.profile {
  min-height: 100vh;
  background: var(--bg);
}

.profile__header {
  display: flex;
  gap: 12px;
  padding: 20px 16px;
  background: var(--card);
  align-items: center;
  box-shadow: var(--shadow);
}

.profile__avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile__avatar-text {
  font-size: 20px;
  font-family: var(--font-display);
  color: var(--card);
  font-weight: 600;
}

.profile__info {
  flex: 1;
}

.profile__name {
  font-size: 17px;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--text-1);
  display: block;
}

.profile__role {
  font-size: 13px;
  color: var(--text-3);
  margin-top: 2px;
  display: block;
}

.profile__menu {
  background: var(--card);
  margin-top: 8px;
  box-shadow: var(--shadow);
}

.profile__menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--bg);
  font-size: 15px;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.profile__menu-item:last-child {
  border-bottom: none;
}

.profile__arrow {
  color: var(--text-4);
  font-size: 18px;
}

.profile__logout-text {
  color: var(--red);
}
</style>
