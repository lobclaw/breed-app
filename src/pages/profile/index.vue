<template>
  <view class="page">
    <!-- 页面标题 -->
    <view class="primary-page-header">
      <view class="primary-page-header__row">
        <text class="primary-page-header__title">我的</text>
      </view>
    </view>

    <!-- 个人信息卡片 -->
    <view :class="['profile-card', { 'profile-card--inactive': isInitialized && !hasFamily }]">
      <view class="profile-info">
        <view class="profile-avatar">
          <text class="material-icons-round" style="color: #fff; font-size: 28px;">person</text>
        </view>
        <view v-if="isInitialized" class="profile-info__body">
          <text class="profile-name">{{ hasFamily ? familyName : '未创建家庭' }}</text>
          <view class="profile-sub">
            <text v-if="hasFamily" class="profile-nickname">{{ userName }}</text>
            <text v-if="roleLabel" class="profile-role">{{ roleLabel }}</text>
          </view>
        </view>
        <text v-if="hasFamily" class="material-icons-round profile-edit-icon" @click="editNickname">edit</text>
      </view>
      <!-- 数据摘要 -->
      <view v-if="hasFamily" class="profile-stats">
        <view class="profile-stats__item">
          <text class="profile-stats__value">{{ stats.dogCount }}</text>
          <text class="profile-stats__label">总犬数</text>
        </view>
        <view class="profile-stats__divider" />
        <view class="profile-stats__item">
          <text class="profile-stats__value">{{ stats.pregnantLitters }}</text>
          <text class="profile-stats__label">在孕窝数</text>
        </view>
        <view class="profile-stats__divider" />
        <view class="profile-stats__item">
          <text class="profile-stats__value">{{ monthlyIncomeLabel }}</text>
          <text class="profile-stats__label">本月收入</text>
        </view>
      </view>
    </view>

    <!-- 未创建家庭时的引导 -->
    <view v-if="isInitialized && !hasFamily" class="menu-section">
      <view class="no-family-card">
        <view class="no-family-card__icon">
          <text class="material-icons-round" style="font-size: 32px; color: var(--primary);">pets</text>
        </view>
        <text class="no-family-card__title">开始管理你的犬舍</text>
        <text class="no-family-card__desc">创建或加入家庭后即可使用全部功能</text>
        <view class="no-family-card__actions">
          <button class="no-family-card__btn" @click="goTo('/pages/family/setup')">创建家庭</button>
          <button class="no-family-card__btn no-family-card__btn--outline" @click="goTo('/pages/family/join')">加入家庭</button>
        </view>
      </view>

      <view class="menu-group menu-group--offset">
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

    <!-- 已有家庭时的完整菜单 -->
    <view v-else class="menu-section">
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
        <view class="menu-item" @click="goTo('/pages/profile/operation-log')">
          <text class="material-icons-round mi-icon">history</text>
          <text class="mi-label">操作日志</text>
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

    <!-- 修改昵称弹窗 -->
    <BModal
      v-model:visible="showNicknameModal"
      title="修改昵称"
      :manualClose="true"
      @confirm="onNicknameConfirm"
    >
      <view class="custom-input-wrap">
        <input v-model="nicknameInput" class="custom-input" placeholder="请输入昵称" />
      </view>
    </BModal>

    <BModal
      v-model:visible="showLogoutConfirm"
      title="确认退出"
      content="退出后需要重新登录"
      confirmText="退出登录"
      :danger="true"
      @confirm="handleLogoutConfirm"
    />

    <!-- 底部导航栏 -->
    <BNavBar current="profile" />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import { useCloudCall } from '@/composables/useCloudCall'
import BNavBar from '@/components/layout/BNavBar.vue'
import BModal from '@/components/layout/BModal.vue'

const { currentFamily, currentUser, userRole, isInitialized, logout, loadFamily } = useAuth()

const hasFamily = computed(() => !!currentFamily.value)
const familyName = computed(() => currentFamily.value?.name || '')
const userName = computed(() => {
  const uid = currentUser.value?.uid
  if (!uid || !currentFamily.value) return '未创建家庭'
  const member = currentFamily.value.members.find(m => m.user_id === uid)
  return member?.nickname || familyName.value || '未创建家庭'
})
const roleLabel = computed(() => {
  const map: Record<string, string> = { creator: '创建者', admin: '管理员', helper: '协助者' }
  return map[userRole.value || ''] || ''
})

// 数据摘要
const stats = reactive({ dogCount: 0, pregnantLitters: 0, monthlyIncome: 0 })
const monthlyIncomeLabel = computed(() => {
  const v = stats.monthlyIncome
  if (v >= 10000) return `¥${(v / 10000).toFixed(1)}w`
  return `¥${v}`
})

const { run: fetchDogs } = useCloudCall<{ data: any[] }>('dog-service', 'getDogListWithStatus')
const { run: fetchLitters } = useCloudCall<{ data: any[] }>('breeding-service', 'getActiveLitters')
const { run: fetchFinance } = useCloudCall<{ data: any }>('finance-service', 'getFinancialSummary')

async function loadStats() {
  if (!hasFamily.value) return
  const [dogRes, litterRes, finRes] = await Promise.all([
    fetchDogs({}).catch(() => null),
    fetchLitters().catch(() => null),
    fetchFinance('month').catch(() => null),
  ])
  stats.dogCount = dogRes?.data?.length || 0
  stats.pregnantLitters = litterRes?.data?.filter((l: any) => !l.weaning_date)?.length || 0
  stats.monthlyIncome = finRes?.data?.totalIncome || 0
}

onShow(() => loadStats())

const { run: doUpdateNickname } = useCloudCall('family-service', 'updateNickname', {
  successMode: 'silent',
  throwOnError: true,
})

// 昵称编辑
const showNicknameModal = ref(false)
const nicknameInput = ref('')
const showLogoutConfirm = ref(false)
const updatingNickname = ref(false)

function getCurrentMember() {
  const uid = currentUser.value?.uid
  if (!uid || !currentFamily.value) return null
  return currentFamily.value.members.find(m => m.user_id === uid) || null
}

function editNickname() {
  const member = getCurrentMember()
  nicknameInput.value = member?.nickname || ''
  showNicknameModal.value = true
}

async function onNicknameConfirm() {
  if (updatingNickname.value) return

  const nextNickname = nicknameInput.value.trim()
  if (!nextNickname) return

  const member = getCurrentMember()
  const previousNickname = member?.nickname || ''

  if (nextNickname === previousNickname) {
    showNicknameModal.value = false
    return
  }

  if (!member) {
    showNicknameModal.value = false
    await doUpdateNickname(nextNickname)
    await loadFamily()
    return
  }

  member.nickname = nextNickname
  showNicknameModal.value = false
  updatingNickname.value = true

  try {
    await doUpdateNickname(nextNickname)
    await loadFamily()
  } catch {
    member.nickname = previousNickname
  } finally {
    updatingNickname.value = false
  }
}

function goTo(url: string) {
  uni.navigateTo({ url })
}

function doLogout() {
  showLogoutConfirm.value = true
}

function handleLogoutConfirm() {
  logout()
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

/* ==================== PROFILE CARD ==================== */
.profile-card {
  margin: 0 var(--space-page);
  background: linear-gradient(135deg, #c42d62 0%, #e85d7a 100%);
  border-radius: var(--radius-card);
  padding: 20px;
  box-shadow: 0 6px 24px rgba(196, 45, 98, 0.25);

  &--inactive {
    background: linear-gradient(135deg, #d4889e 0%, #e8a7b8 100%);
    box-shadow: 0 4px 16px rgba(234, 62, 119, 0.12);
  }
}

.profile-info {
  display: flex;
  align-items: center;
  gap: 14px;

  &__body {
    flex: 1;
    min-width: 0;
  }
}

.profile-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.profile-edit-icon {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.6);
  padding: 6px;
  flex-shrink: 0;
}

.profile-name {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 800;
  color: #fff;
  display: block;
  letter-spacing: 0.5px;
}

.profile-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 5px;
}

.profile-nickname {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.profile-role {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: var(--radius-tag);
}

/* ==================== PROFILE STATS ==================== */
.profile-stats {
  display: flex;
  align-items: center;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);

  &__item {
    flex: 1;
    text-align: center;
  }

  &__value {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 800;
    color: #fff;
    display: block;
  }

  &__label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 2px;
    display: block;
  }

  &__divider {
    width: 1px;
    height: 28px;
    background: rgba(255, 255, 255, 0.15);
    flex-shrink: 0;
  }
}

/* ==================== MENU SECTION ==================== */
.menu-section {
  padding: 0 var(--space-page);
  margin-top: var(--primary-page-section-gap);
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

  &--offset {
    margin-top: var(--primary-page-section-gap);
  }
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

/* ==================== NO FAMILY CARD ==================== */
.no-family-card {
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;

  &__icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--primary-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }

  &__title {
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 800;
    color: var(--text-1);
    display: block;
  }

  &__desc {
    font-size: 13px;
    color: var(--text-3);
    margin-top: 6px;
    display: block;
  }

  &__actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
  }

  &__btn {
    height: 42px;
    padding: 0 28px;
    border-radius: var(--radius-btn);
    font-size: 14px;
    font-weight: 700;
    border: none;
    color: #fff;
    background: var(--primary);
    box-shadow: 0 2px 8px rgba(234, 62, 119, 0.2);

    &--outline {
      background: transparent;
      color: var(--primary);
      border: 1.5px solid var(--primary);
      box-shadow: none;
    }
  }
}
</style>
