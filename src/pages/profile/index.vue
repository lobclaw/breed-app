<template>
  <view class="page">
    <!-- 页面标题 -->
    <view class="profile-header">
      <text class="profile-header__title">我的</text>
    </view>

    <!-- 个人信息卡片 -->
    <view class="profile-card">
      <view class="profile-info">
        <view class="profile-avatar">
          <text class="material-icons-round" style="color: #fff; font-size: 32px;">person</text>
        </view>
        <view>
          <text class="profile-name">{{ userName || '未登录' }}</text>
          <text v-if="roleLabel" class="profile-role">{{ roleLabel }}</text>
        </view>
      </view>
      <view class="profile-family" v-if="familyName">
        <view>
          <text class="profile-family__label">犬舍名称</text>
          <view class="profile-family__row">
            <text class="profile-family__name">{{ familyName }}</text>
          </view>
        </view>
        <text class="material-icons-round" style="font-size: 20px; color: var(--text-3);" @click="goTo('/pages/family/edit')">edit</text>
      </view>
    </view>

    <!-- 犬舍管理 -->
    <view class="menu-section">
      <text class="menu-group-label">犬舍管理</text>
      <view class="menu-group">
        <view class="menu-item" @click="goTo('/pages/family/members')">
          <text class="material-icons-round mi-icon">group</text>
          <text class="mi-label">家庭管理</text>
          <text class="material-icons-round mi-arrow">chevron_right</text>
        </view>
        <view class="menu-item" @click="goTo('/pages/profile/notifications')">
          <text class="material-icons-round mi-icon">notifications</text>
          <text class="mi-label">通知设置</text>
          <text class="material-icons-round mi-arrow">chevron_right</text>
        </view>
        <view class="menu-item" @click="goTo('/pages/profile/defaults')">
          <text class="material-icons-round mi-icon">tune</text>
          <text class="mi-label">默认参数</text>
          <text class="material-icons-round mi-arrow">chevron_right</text>
        </view>
      </view>

      <!-- 专业工具 -->
      <text class="menu-group-label">专业工具</text>
      <view class="menu-group">
        <view class="menu-item" @click="goTo('/pages/health/medication-protocols')">
          <text class="material-icons-round mi-icon">medication</text>
          <text class="mi-label">用药方案库</text>
          <text class="material-icons-round mi-arrow">chevron_right</text>
        </view>
        <view class="menu-item" @click="goTo('/pages/sale/agents')">
          <text class="material-icons-round mi-icon">handshake</text>
          <text class="mi-label">合作代理人</text>
          <text class="material-icons-round mi-arrow">chevron_right</text>
        </view>
        <view class="menu-item" @click="goTo('/pages/profile/care-rules')">
          <text class="material-icons-round mi-icon">rule</text>
          <text class="mi-label">护理规则</text>
          <text class="material-icons-round mi-arrow">chevron_right</text>
        </view>
        <view class="menu-item" @click="goTo('/pages/profile/expense-categories')">
          <text class="material-icons-round mi-icon">category</text>
          <text class="mi-label">支出分类管理</text>
          <text class="material-icons-round mi-arrow">chevron_right</text>
        </view>
      </view>

      <!-- 数据 -->
      <text class="menu-group-label">数据</text>
      <view class="menu-group">
        <view class="menu-item" @click="goTo('/pages/profile/backup')">
          <text class="material-icons-round mi-icon">backup</text>
          <text class="mi-label">数据备份/导出</text>
          <text class="material-icons-round mi-arrow">chevron_right</text>
        </view>
        <view class="menu-item" @click="goTo('/pages/profile/recycle')">
          <text class="material-icons-round mi-icon">delete_outline</text>
          <text class="mi-label">回收站</text>
          <text class="material-icons-round mi-arrow">chevron_right</text>
        </view>
      </view>

      <!-- 其他 -->
      <text class="menu-group-label">其他</text>
      <view class="menu-group">
        <view class="menu-item" @click="goTo('/pages/profile/about')">
          <text class="material-icons-round mi-icon">info</text>
          <text class="mi-label">关于</text>
          <text class="material-icons-round mi-arrow">chevron_right</text>
        </view>
        <view class="menu-item" @click="doLogout">
          <text class="material-icons-round mi-icon" style="color: var(--red);">logout</text>
          <text class="mi-label mi-label--red">退出登录</text>
          <text class="material-icons-round mi-arrow">chevron_right</text>
        </view>
      </view>
    </view>

    <!-- 底部导航栏 -->
    <BNavBar current="profile" />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import BNavBar from '@/components/layout/BNavBar.vue'

const { currentFamily, userRole, logout } = useAuth()

const familyName = computed(() => currentFamily.value?.name || '')
const userName = computed(() => currentFamily.value?.creator_name || familyName.value || '未创建家庭')
const roleLabel = computed(() => {
  const map: Record<string, string> = { creator: '创建者', admin: '管理员', helper: '协助者' }
  return map[userRole.value || ''] || ''
})

function goTo(url: string) {
  uni.navigateTo({ url })
}

function doLogout() {
  uni.showModal({
    title: '确认退出',
    content: '退出后需要重新登录',
    success: (res) => {
      if (res.confirm) logout()
    },
  })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

/* ==================== PROFILE HEADER ==================== */
.profile-header {
  padding: 8px var(--space-page) 0;
  text-align: center;

  &__title {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 800;
    color: var(--text-1);
  }
}

/* ==================== PROFILE CARD ==================== */
.profile-card {
  margin: 16px 16px 0;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 20px;
  box-shadow: var(--shadow);
}

.profile-info {
  display: flex;
  align-items: center;
  gap: 14px;
}

.profile-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-name {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 800;
  color: var(--text-1);
  display: block;
}

.profile-role {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  background: var(--primary-soft);
  padding: 2px 10px;
  border-radius: var(--radius-tag);
  display: inline-block;
  margin-top: 4px;
}

.profile-family {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--card-dim);

  &__label {
    font-size: 12px;
    color: var(--text-3);
    display: block;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 2px;
  }

  &__name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
  }
}

/* ==================== MENU SECTION ==================== */
.menu-section {
  padding: 0 16px;
  margin-top: 20px;
}

.menu-group-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.5px;
  padding: 0 4px 8px;
  display: block;
}

.menu-group {
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  overflow: hidden;
  margin-bottom: 16px;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  gap: 14px;
  transition: background 0.15s ease;

  &:not(:last-child) {
    border-bottom: 0.5px solid var(--card-dim);
  }

  &:active {
    background: var(--card-dim);
  }
}

.mi-icon {
  font-family: 'Material Icons Round';
  font-size: 22px;
  color: var(--text-3);
  width: 24px;
  text-align: center;
}

.mi-label {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);

  &--red { color: var(--red); }
}

.mi-arrow {
  font-family: 'Material Icons Round';
  font-size: 18px;
  color: var(--text-4);
}
</style>
