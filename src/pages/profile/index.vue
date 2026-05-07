<template>
  <view class="page">
    <!-- 页面标题 -->
    <view class="primary-page-header dashboard-header">
      <view class="primary-page-header__row">
        <view class="dashboard-header__menu" @click="openDrawer">
          <text class="material-icons-round dashboard-header__menu-icon">menu</text>
        </view>
        <view class="dashboard-header__title-wrap">
          <text class="primary-page-header__title dashboard-header__title">{{ pageTitle }}</text>
          <text class="dashboard-header__subtitle">{{ headerSubtitle }}</text>
        </view>
        <view v-if="hasFamily" class="dashboard-header__edit" @click="editNickname">
          <text class="material-icons-round dashboard-header__edit-icon">edit</text>
        </view>
      </view>
    </view>

    <!-- 左侧管理抽屉 -->
    <view v-if="drawerRendered" class="profile-drawer">
      <view class="profile-drawer__mask" :class="{ 'profile-drawer__mask--open': drawerOpen }" @click="closeDrawer" @touchmove.prevent />
      <view class="profile-drawer__panel" :class="{ 'profile-drawer__panel--open': drawerOpen }">
        <view class="profile-drawer__header">
          <view class="profile-drawer__identity">
            <view class="profile-drawer__avatar">
              <text class="material-icons-round profile-drawer__avatar-icon">person</text>
            </view>
            <view class="profile-drawer__copy">
              <text class="profile-drawer__title">{{ hasFamily ? familyName : '未创建家庭' }}</text>
              <text class="profile-drawer__subtitle">{{ drawerSubtitle }}</text>
            </view>
          </view>
          <view class="profile-drawer__close" @click="closeDrawer">
            <text class="material-icons-round profile-drawer__close-icon">close</text>
          </view>
        </view>

        <scroll-view scroll-y class="profile-drawer__body" enhanced :show-scrollbar="false">
          <template v-if="hasFamily">
            <view v-for="group in drawerMenuGroups" :key="group.label" class="drawer-menu-group">
              <text class="drawer-menu-group__label">{{ group.label }}</text>
              <view class="drawer-menu-group__list">
                <view
                  v-for="item in group.items"
                  :key="item.label"
                  class="drawer-menu-item"
                  :class="{ 'drawer-menu-item--danger': item.danger }"
                  @click="handleDrawerItem(item)"
                >
                  <view class="drawer-menu-item__icon-wrap">
                    <text class="material-icons-round drawer-menu-item__icon">{{ item.icon }}</text>
                  </view>
                  <text class="drawer-menu-item__label">{{ item.label }}</text>
                  <text class="material-icons-round drawer-menu-item__arrow">chevron_right</text>
                </view>
              </view>
            </view>
          </template>

          <view v-else class="drawer-menu-group">
            <text class="drawer-menu-group__label">其他</text>
            <view class="drawer-menu-group__list">
              <view class="drawer-menu-item" @click="goTo('/pages/profile/about')">
                <view class="drawer-menu-item__icon-wrap">
                  <text class="material-icons-round drawer-menu-item__icon">info</text>
                </view>
                <text class="drawer-menu-item__label">关于</text>
                <text class="material-icons-round drawer-menu-item__arrow">chevron_right</text>
              </view>
              <view class="drawer-menu-item drawer-menu-item--danger" @click="doLogout">
                <view class="drawer-menu-item__icon-wrap">
                  <text class="material-icons-round drawer-menu-item__icon">logout</text>
                </view>
                <text class="drawer-menu-item__label">退出登录</text>
                <text class="material-icons-round drawer-menu-item__arrow">chevron_right</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 未创建家庭时的引导 -->
    <view v-if="isInitialized && !hasFamily" class="dashboard-content">
      <view class="no-family-card">
        <view class="no-family-card__icon">
          <text class="material-icons-round no-family-card__icon-text">pets</text>
        </view>
        <text class="no-family-card__title">先建立一个家庭档案</text>
        <text class="no-family-card__desc">之后这里会显示犬舍库存、繁育状态和本月收支。</text>
        <view class="no-family-card__actions">
          <button class="no-family-card__btn" @click="goTo('/pages/family/setup')">创建家庭</button>
          <button class="no-family-card__btn no-family-card__btn--outline" @click="goTo('/pages/family/join')">加入家庭</button>
        </view>
      </view>
    </view>

    <view v-else class="dashboard-content" style="display: flex; flex-direction: column;">
      <!-- 犬舍总览 -->
      <view class="dashboard-section" style="background: var(--card); border-radius: var(--radius-card); padding: 15px;">
        <view class="dashboard-section__header" style="display: flex; align-items: flex-start; justify-content: space-between;">
          <view>
            <text class="dashboard-section__title">犬舍总览</text>
            <text class="dashboard-section__desc">库存、种犬与销售去向</text>
          </view>
          <view class="dashboard-section__badge">
            <text class="dashboard-section__badge-text">{{ stats.dogCount }}只</text>
          </view>
        </view>
        <view class="metric-grid" style="display: flex; flex-wrap: wrap; justify-content: space-between;">
          <view
            v-for="item in kennelMetrics"
            :key="item.label"
            class="metric-card"
            :class="`metric-card--${item.tone}`"
            style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 31.5%; min-height: 92px; margin-bottom: 9px; border-radius: var(--radius-card); background: var(--card-dim);"
          >
            <view class="metric-card__icon" style="display: flex; align-items: center; justify-content: center;">
              <text class="material-icons-round metric-card__icon-text" style="font-size: 18px;">{{ item.icon }}</text>
            </view>
            <text class="metric-card__value">{{ item.value }}</text>
            <text class="metric-card__label">{{ item.label }}</text>
          </view>
        </view>
      </view>

      <!-- 本月收支 -->
      <view class="dashboard-section" style="background: var(--card); border-radius: var(--radius-card); padding: 15px;">
        <view class="dashboard-section__header" style="display: flex; align-items: flex-start; justify-content: space-between;">
          <view>
            <text class="dashboard-section__title">本月收支</text>
            <text class="dashboard-section__desc">{{ currentMonthLabel }}经营表现</text>
          </view>
          <view class="dashboard-section__link" style="display: flex; align-items: center;" @click="goTo('/pages/finance/stats')">
            <text class="dashboard-section__link-text">详情</text>
            <text class="material-icons-round dashboard-section__link-icon">arrow_forward</text>
          </view>
        </view>
        <view class="finance-summary-card" style="display: flex; align-items: stretch;">
          <view class="finance-summary-card__main" style="display: flex; flex-direction: column; justify-content: center; flex: 1.15;">
            <text class="finance-summary-card__label">净收支</text>
            <text class="finance-summary-card__value" :class="monthlyNetClass">{{ monthlyNetLabel }}</text>
            <text class="finance-summary-card__hint">利润率 {{ profitRateLabel }}</text>
          </view>
          <view class="finance-summary-card__side" style="display: flex; flex-direction: column; flex: 0.85;">
            <view class="finance-mini finance-mini--income">
              <text class="finance-mini__label">收入</text>
              <text class="finance-mini__value">{{ monthlyIncomeLabel }}</text>
            </view>
            <view class="finance-mini finance-mini--expense">
              <text class="finance-mini__label">支出</text>
              <text class="finance-mini__value">{{ monthlyExpenseLabel }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 繁育状态 -->
      <view class="dashboard-section" style="background: var(--card); border-radius: var(--radius-card); padding: 15px;">
        <view class="dashboard-section__header" style="display: flex; align-items: flex-start; justify-content: space-between;">
          <view>
            <text class="dashboard-section__title">繁育状态</text>
            <text class="dashboard-section__desc">当前需要理解的繁育阶段</text>
          </view>
        </view>
        <view class="status-strip" style="display: flex; justify-content: space-between;">
          <view
            v-for="item in breedingStatusItems"
            :key="item.label"
            class="status-pill"
            :class="`status-pill--${item.tone}`"
            style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 23.5%; min-height: 78px; border-radius: var(--radius-card); background: var(--card-dim);"
          >
            <text class="material-icons-round status-pill__icon" style="font-size: 20px;">{{ item.icon }}</text>
            <text class="status-pill__value">{{ item.value }}</text>
            <text class="status-pill__label">{{ item.label }}</text>
          </view>
        </view>
      </view>

      <!-- 销售状态 -->
      <view class="dashboard-section" style="background: var(--card); border-radius: var(--radius-card); padding: 15px;">
        <view class="dashboard-section__header" style="display: flex; align-items: flex-start; justify-content: space-between;">
          <view>
            <text class="dashboard-section__title">销售状态</text>
            <text class="dashboard-section__desc">待售、预定与成交进度</text>
          </view>
          <view class="dashboard-section__link" style="display: flex; align-items: center;" @click="goTo('/pages/sale/list')">
            <text class="dashboard-section__link-text">销售管理</text>
            <text class="material-icons-round dashboard-section__link-icon">arrow_forward</text>
          </view>
        </view>
        <view class="sales-summary" style="display: flex; justify-content: space-between;">
          <view
            v-for="item in saleStatusItems"
            :key="item.label"
            class="sales-summary__item"
            :class="`sales-summary__item--${item.tone}`"
            style="display: flex; flex-direction: column; justify-content: center; width: 31.5%; min-height: 72px; border-radius: var(--radius-card); background: var(--card-dim);"
          >
            <text class="sales-summary__value">{{ item.value }}</text>
            <text class="sales-summary__label">{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view v-if="statsLoading" class="dashboard-loading">
        <text class="dashboard-loading__text">正在更新数据...</text>
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
import { ref, reactive, computed, nextTick, onBeforeUnmount } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import BNavBar from '@/components/layout/BNavBar.vue'
import BModal from '@/components/layout/BModal.vue'
import { getLocalKennelDashboardStats } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'

type DrawerMenuItem = {
  label: string
  icon: string
  url?: string
  action?: 'logout'
  danger?: boolean
}

type DrawerMenuGroup = {
  label: string
  items: DrawerMenuItem[]
}

const {
  currentFamily,
  currentUser,
  userRole,
  isInitialized,
  logout,
  setCurrentFamily,
  refreshFamilyFromLocal,
  ensureFamilyLocalMirror,
} = useAuth()
usePageSync({ routePath: 'pages/profile/index' })

const hasFamily = computed(() => !!currentFamily.value)
const familyName = computed(() => currentFamily.value?.name || '')
function getAccountUsername() {
  try {
    const userInfo = uni.getStorageSync('uni-id-pages-userInfo') || {}
    return String(userInfo.username || '').trim()
  } catch {
    return ''
  }
}

function getMemberDisplayName(member?: { nickname?: string } | null) {
  return String(member?.nickname || '').trim() || getAccountUsername()
}

const userName = computed(() => {
  const uid = currentUser.value?.uid
  if (!uid || !currentFamily.value) return '未创建家庭'
  const member = currentFamily.value.members.find(m => m.user_id === uid)
  return getMemberDisplayName(member) || familyName.value || '未创建家庭'
})
const roleLabel = computed(() => {
  const map: Record<string, string> = { creator: '创建者', admin: '管理员', helper: '协助者' }
  return map[userRole.value || ''] || ''
})
const pageTitle = computed(() => {
  if (!isInitialized.value) return '犬舍总览'
  return hasFamily.value ? familyName.value : '犬舍总览'
})
const headerSubtitle = computed(() => {
  if (!isInitialized.value) return '正在读取家庭信息'
  if (!hasFamily.value) return '未创建家庭'
  return [userName.value, roleLabel.value].filter(Boolean).join(' · ')
})
const drawerSubtitle = computed(() => {
  if (!hasFamily.value) return '创建或加入家庭后启用完整菜单'
  return [userName.value, roleLabel.value].filter(Boolean).join(' · ')
})

const drawerMenuGroups: DrawerMenuGroup[] = [
  {
    label: '犬舍管理',
    items: [
      { label: '家庭管理', icon: 'group', url: '/pages/family/members' },
      { label: '通知设置', icon: 'notifications', url: '/pages/profile/notifications' },
      { label: '默认参数', icon: 'tune', url: '/pages/profile/defaults' },
    ],
  },
  {
    label: '专业工具',
    items: [
      { label: '用药方案库', icon: 'medication', url: '/pages/health/medication-protocols' },
      { label: '合作代理人', icon: 'handshake', url: '/pages/sale/agents' },
      { label: '支出分类管理', icon: 'category', url: '/pages/profile/expense-categories' },
    ],
  },
  {
    label: '数据',
    items: [
      { label: '数据备份', icon: 'backup', url: '/pages/profile/backup' },
      { label: '回收站', icon: 'delete_outline', url: '/pages/profile/recycle' },
      { label: '操作日志', icon: 'history', url: '/pages/profile/operation-log' },
    ],
  },
  {
    label: '其他',
    items: [
      { label: '关于', icon: 'info', url: '/pages/profile/about' },
      { label: '退出登录', icon: 'logout', action: 'logout', danger: true },
    ],
  },
]

const statsLoading = ref(false)
const stats = reactive({
  dogCount: 0,
  forSaleCount: 0,
  soldCount: 0,
  damCount: 0,
  sireCount: 0,
  dueSoonCount: 0,
  heatCount: 0,
  pregnantCount: 0,
  nursingCount: 0,
  monthlyIncome: 0,
  monthlyExpense: 0,
  monthlyNet: 0,
  salePendingCount: 0,
  saleReservedCount: 0,
  saleCompletedCount: 0,
})

const currentMonthLabel = computed(() => {
  const now = new Date()
  return `${now.getMonth() + 1}月`
})
const monthlyIncomeLabel = computed(() => formatMoney(stats.monthlyIncome))
const monthlyExpenseLabel = computed(() => formatMoney(-stats.monthlyExpense))
const monthlyNetLabel = computed(() => formatMoney(stats.monthlyNet))
const monthlyNetClass = computed(() => {
  if (stats.monthlyNet > 0) return 'finance-summary-card__value--positive'
  if (stats.monthlyNet < 0) return 'finance-summary-card__value--negative'
  return 'finance-summary-card__value--neutral'
})
const profitRateLabel = computed(() => {
  if (!stats.monthlyIncome) return '0%'
  const rate = (stats.monthlyNet / stats.monthlyIncome) * 100
  return `${rate >= 10 || rate <= -10 ? rate.toFixed(0) : rate.toFixed(1)}%`
})

const kennelMetrics = computed(() => [
  { label: '总犬数', value: stats.dogCount, icon: 'pets', tone: 'blue' },
  { label: '待售', value: stats.forSaleCount, icon: 'sell', tone: 'amber' },
  { label: '已售', value: stats.soldCount, icon: 'verified', tone: 'teal' },
  { label: '种母', value: stats.damCount, icon: 'female', tone: 'rose' },
  { label: '种公', value: stats.sireCount, icon: 'male', tone: 'plum' },
  { label: '待产', value: stats.dueSoonCount, icon: 'child_friendly', tone: 'red' },
])
const breedingStatusItems = computed(() => [
  { label: '发情中', value: stats.heatCount, icon: 'whatshot', tone: 'rose' },
  { label: '怀孕中', value: stats.pregnantCount, icon: 'pregnant_woman', tone: 'amber' },
  { label: '哺乳中', value: stats.nursingCount, icon: 'child_care', tone: 'teal' },
  { label: '待产', value: stats.dueSoonCount, icon: 'child_friendly', tone: 'red' },
])
const saleStatusItems = computed(() => [
  { label: '待售', value: stats.salePendingCount, tone: 'amber' },
  { label: '已预定', value: stats.saleReservedCount, tone: 'blue' },
  { label: '已成交', value: stats.saleCompletedCount, tone: 'teal' },
])

async function loadStats() {
  const familyId = currentFamily.value?._id || ''
  if (!familyId) return
  statsLoading.value = true
  const result = await getLocalKennelDashboardStats(familyId)
  const activeDogs = result.activeDogs || []
  const soldDogs = result.soldDogs || []
  const litters = result.litters || []
  const sales = result.sales || []
  const activeAndSoldDogs = [...activeDogs, ...soldDogs]
  const ownedActiveAndSoldDogs = activeAndSoldDogs.filter(dog => dog.role !== '外部种公')

  stats.dogCount = ownedActiveAndSoldDogs.length
  stats.forSaleCount = activeDogs.filter(dog => dog.disposition === '待售').length
  stats.soldCount = Math.max(
    soldDogs.length,
    sales.filter(sale => sale.status === '已成交').length,
  )
  stats.damCount = activeDogs.filter(dog => dog.role === '种狗' && dog.gender === '母').length
  stats.sireCount = activeDogs.filter(dog => dog.role === '种狗' && dog.gender === '公').length
  stats.heatCount = countDogsByStatus(activeDogs, '发情中')
  stats.pregnantCount = countDogsByStatus(activeDogs, '怀孕中')
  stats.nursingCount = Math.max(countDogsByStatus(activeDogs, '哺乳中'), litters.length)
  stats.dueSoonCount = countDueSoonDogs(activeDogs)
  stats.monthlyIncome = result.monthlyIncome || 0
  stats.monthlyExpense = result.monthlyExpense || 0
  stats.monthlyNet = stats.monthlyIncome - stats.monthlyExpense
  stats.salePendingCount = sales.filter(sale => sale.status === '待售').length || stats.forSaleCount
  stats.saleReservedCount = sales.filter(sale => sale.status === '已预定').length
  stats.saleCompletedCount = sales.filter(sale => sale.status === '已成交').length || stats.soldCount
  statsLoading.value = false
}

onShow(async () => {
  await loadStats()
})

const showNicknameModal = ref(false)
const nicknameInput = ref('')
const showLogoutConfirm = ref(false)
const updatingNickname = ref(false)
const drawerRendered = ref(false)
const drawerOpen = ref(false)
let drawerCloseTimer: ReturnType<typeof setTimeout> | null = null

function getCurrentMember() {
  const uid = currentUser.value?.uid
  if (!uid || !currentFamily.value) return null
  return currentFamily.value.members.find(m => m.user_id === uid) || null
}

function buildFamilyWithCurrentMemberNickname(nickname: string) {
  const family = currentFamily.value
  const uid = currentUser.value?.uid
  if (!family || !uid) return null
  return {
    ...family,
    members: family.members.map(member => (
      member.user_id === uid && member.status === 'active'
        ? { ...member, nickname }
        : member
    )),
  }
}

function editNickname() {
  const member = getCurrentMember()
  nicknameInput.value = getMemberDisplayName(member)
  showNicknameModal.value = true
}

async function onNicknameConfirm() {
  if (updatingNickname.value) return

  const nextNickname = nicknameInput.value.trim()
  if (!nextNickname) return

  const member = getCurrentMember()
  const previousNickname = member?.nickname || ''
  const familyId = currentFamily.value?._id || ''
  const userId = currentUser.value?.uid || ''

  if (nextNickname === previousNickname) {
    showNicknameModal.value = false
    return
  }

  if (!member || !familyId || !userId) {
    uni.showToast({ title: '成员信息异常，请刷新后重试', icon: 'none' })
    return
  }

  const previousFamily = currentFamily.value
    ? {
        ...currentFamily.value,
        members: currentFamily.value.members.map(item => ({ ...item })),
      }
    : null
  const nextFamily = buildFamilyWithCurrentMemberNickname(nextNickname)
  if (nextFamily) setCurrentFamily(nextFamily)
  showNicknameModal.value = false
  updatingNickname.value = true

  try {
    await ensureFamilyLocalMirror(familyId)
    await localSyncRuntime.updateNicknameLocally(familyId, userId, nextNickname)
    await refreshFamilyFromLocal(familyId)
  } catch (e: any) {
    setCurrentFamily(previousFamily)
    uni.showToast({ title: e?.message || '昵称保存失败', icon: 'none' })
  } finally {
    updatingNickname.value = false
  }
}

function openDrawer() {
  clearDrawerCloseTimer()
  drawerRendered.value = true
  lockScroll(true)
  nextTick(() => {
    drawerOpen.value = true
  })
}

function closeDrawer() {
  drawerOpen.value = false
  clearDrawerCloseTimer()
  drawerCloseTimer = setTimeout(() => {
    drawerRendered.value = false
    lockScroll(false)
    drawerCloseTimer = null
  }, 240)
}

function clearDrawerCloseTimer() {
  if (!drawerCloseTimer) return
  clearTimeout(drawerCloseTimer)
  drawerCloseTimer = null
}

function lockScroll(lock: boolean) {
  // #ifdef H5
  document.body.style.overflow = lock ? 'hidden' : ''
  // #endif
}

function handleDrawerItem(item: DrawerMenuItem) {
  if (item.action === 'logout') {
    doLogout()
    return
  }
  if (item.url) goTo(item.url)
}

function goTo(url: string) {
  if (drawerOpen.value) closeDrawer()
  uni.navigateTo({ url })
}

function doLogout() {
  if (drawerOpen.value) closeDrawer()
  showLogoutConfirm.value = true
}

function handleLogoutConfirm() {
  logout()
}

function formatMoney(value: number) {
  const sign = value < 0 ? '-' : ''
  const absValue = Math.abs(Math.round(value || 0))
  if (absValue >= 10000) return `${sign}¥${(absValue / 10000).toFixed(1)}w`
  return `${sign}¥${absValue}`
}

function countDogsByStatus(dogs: any[], type: string) {
  return dogs.filter(dog => Array.isArray(dog.statuses) && dog.statuses.some((status: any) => status?.type === type)).length
}

function countDueSoonDogs(dogs: any[]) {
  return dogs.filter((dog) => {
    const pregnantStatus = Array.isArray(dog.statuses)
      ? dog.statuses.find((status: any) => status?.type === '怀孕中')
      : null
    if (!pregnantStatus) return false
    const progress = pregnantStatus.progress
    if (progress?.total && progress?.current) return progress.total - progress.current <= 5
    const remainText = (pregnantStatus.meta || [])
      .map((item: any) => item?.text || '')
      .find((text: string) => text.includes('还有'))
    if (!remainText) return false
    const matched = remainText.match(/还有(\d+)天/)
    return matched ? Number(matched[1]) <= 5 : false
  }).length
}

onBeforeUnmount(() => {
  clearDrawerCloseTimer()
  lockScroll(false)
})
</script>

<style lang="scss">
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

.dashboard-header {
  margin-bottom: 10px;

  &__menu,
  &__edit {
    width: 40px;
    height: 40px;
    border-radius: 20px;
    background: var(--card);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 14px rgba(45, 27, 20, 0.05);
    transition: transform 0.12s ease, background 0.12s ease;

    &:active {
      transform: scale(0.92);
      background: var(--card-dim);
    }
  }

  &__menu-icon,
  &__edit-icon {
    font-family: 'Material Icons Round';
    font-size: 22px;
    color: var(--text-2);
  }

  &__title-wrap {
    flex: 1;
    min-width: 0;
  }

  &__title {
    display: block;
  }

  &__subtitle {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

/* ==================== 左侧抽屉 ==================== */
.profile-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 999;

  &__mask {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: var(--mask);
    opacity: 0;
    transition: opacity 0.24s ease;

    &--open {
      opacity: 1;
    }
  }

  &__panel {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 82vw;
    max-width: 330px;
    background: var(--card);
    border-radius: 0 18px 18px 0;
    transform: translateX(-100%);
    opacity: 0.92;
    transition: transform 0.24s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.24s ease;
    display: flex;
    flex-direction: column;
    box-shadow: 10px 0 28px rgba(45, 27, 20, 0.14);
    overflow: hidden;

    &--open {
      transform: translateX(0);
      opacity: 1;
    }
  }

  &__header {
    padding: calc(env(safe-area-inset-top, 0px) + 18px) 18px 16px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid var(--card-dim);
  }

  &__identity {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  &__avatar {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary), var(--amber));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__avatar-icon {
    font-family: 'Material Icons Round';
    font-size: 24px;
    color: #fff;
  }

  &__copy {
    min-width: 0;
  }

  &__title {
    display: block;
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 800;
    color: var(--text-1);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__subtitle {
    display: block;
    margin-top: 3px;
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.35;
  }

  &__close {
    width: 32px;
    height: 32px;
    border-radius: 16px;
    background: var(--card-dim);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__close-icon {
    font-family: 'Material Icons Round';
    font-size: 20px;
    color: var(--text-3);
  }

  &__body {
    flex: 1;
    min-height: 0;
    height: 0;
    padding: 14px 14px calc(env(safe-area-inset-bottom, 0px) + 20px);
    box-sizing: border-box;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
}

.drawer-menu-group {
  margin-bottom: 16px;

  &__label {
    display: block;
    padding: 0 6px 8px;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
  }

  &__list {
    background: var(--card);
    border: 1px solid var(--card-dim);
    border-radius: var(--radius-card);
    overflow: hidden;
  }
}

.drawer-menu-item {
  min-height: 50px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 13px;
  transition: background 0.12s ease, transform 0.12s ease;

  &:not(:last-child) {
    border-bottom: 1px solid var(--card-dim);
  }

  &:active {
    background: var(--card-dim);
  }

  &__icon-wrap {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    background: var(--card-dim);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__icon {
    font-family: 'Material Icons Round';
    font-size: 18px;
    color: var(--text-2);
  }

  &__label {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__arrow {
    font-family: 'Material Icons Round';
    font-size: 18px;
    color: var(--text-4);
  }

  &--danger {
    .drawer-menu-item__icon,
    .drawer-menu-item__label {
      color: var(--red);
    }
  }
}

/* ==================== DASHBOARD ==================== */
.dashboard-content {
  padding: 0 var(--space-page);
  margin-top: var(--primary-page-section-gap);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dashboard-section {
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  padding: 15px;

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 13px;
  }

  &__title {
    display: block;
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 800;
    color: var(--text-1);
    line-height: 1.3;
  }

  &__desc {
    display: block;
    margin-top: 3px;
    font-size: 12px;
    color: var(--text-3);
    line-height: 1.35;
  }

  &__badge {
    padding: 5px 10px;
    border-radius: var(--radius-tag);
    background: var(--primary-soft);
    flex-shrink: 0;
  }

  &__badge-text {
    font-size: 12px;
    font-weight: 800;
    color: var(--primary);
  }

  &__link {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 30px;
    padding: 5px 9px;
    border-radius: var(--radius-tag);
    background: var(--card-dim);
    flex-shrink: 0;
    transition: transform 0.12s ease;

    &:active {
      transform: scale(0.94);
    }
  }

  &__link-text {
    font-size: 12px;
    font-weight: 800;
    color: var(--primary);
    white-space: nowrap;
  }

  &__link-icon {
    font-family: 'Material Icons Round';
    font-size: 15px;
    color: var(--primary);
  }
}

.metric-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-bottom: -9px;
}

.metric-card {
  width: 31.5%;
  min-height: 92px;
  border-radius: var(--radius-card);
  padding: 11px 8px;
  margin-bottom: 9px;
  background: var(--card-dim);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;

  &__icon {
    width: 30px;
    height: 30px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 7px;
  }

  &__icon-text {
    font-family: 'Material Icons Round';
    font-size: 18px;
  }

  &__value {
    display: block;
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 800;
    color: var(--text-1);
    line-height: 1.15;
  }

  &__label {
    display: block;
    margin-top: 3px;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-3);
  }

  &--blue {
    .metric-card__icon { background: var(--blue-soft); }
    .metric-card__icon-text { color: var(--blue); }
  }

  &--amber {
    .metric-card__icon { background: var(--amber-soft); }
    .metric-card__icon-text { color: var(--amber); }
  }

  &--teal {
    .metric-card__icon { background: var(--teal-soft); }
    .metric-card__icon-text { color: var(--teal); }
  }

  &--rose {
    .metric-card__icon { background: var(--rose-soft); }
    .metric-card__icon-text { color: var(--rose); }
  }

  &--plum {
    .metric-card__icon { background: var(--plum-soft); }
    .metric-card__icon-text { color: var(--plum); }
  }

  &--red {
    .metric-card__icon { background: var(--red-soft); }
    .metric-card__icon-text { color: var(--red); }
  }
}

.finance-summary-card {
  display: flex;
  align-items: stretch;
  gap: 10px;

  &__main {
    flex: 1.15;
    min-width: 0;
    min-height: 118px;
    border-radius: var(--radius-card);
    padding: 15px;
    background: linear-gradient(135deg, rgba(232, 93, 122, 0.12) 0%, rgba(240, 163, 95, 0.14) 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  &__label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
  }

  &__value {
    display: block;
    margin-top: 8px;
    font-family: var(--font-display);
    font-size: 25px;
    font-weight: 800;
    line-height: 1.15;

    &--positive { color: var(--red); }
    &--negative { color: var(--green); }
    &--neutral { color: var(--text-1); }
  }

  &__hint {
    display: block;
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-3);
  }

  &__side {
    flex: 0.85;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
}

.finance-mini {
  flex: 1;
  min-height: 54px;
  border-radius: var(--radius-card);
  padding: 11px;
  background: var(--card-dim);

  &__label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-3);
  }

  &__value {
    display: block;
    margin-top: 6px;
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 800;
    color: var(--text-1);
    line-height: 1.2;
  }

  &--income .finance-mini__value {
    color: var(--red);
  }

  &--expense .finance-mini__value {
    color: var(--green);
  }
}

.status-strip {
  display: flex;
  justify-content: space-between;
}

.status-pill {
  width: 23.5%;
  min-height: 78px;
  border-radius: var(--radius-card);
  background: var(--card-dim);
  padding: 10px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;

  &__icon {
    font-family: 'Material Icons Round';
    font-size: 20px;
    margin-bottom: 5px;
  }

  &__value {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 800;
    color: var(--text-1);
    line-height: 1.15;
  }

  &__label {
    margin-top: 3px;
    font-size: 10px;
    font-weight: 700;
    color: var(--text-3);
  }

  &--rose .status-pill__icon { color: var(--rose); }
  &--amber .status-pill__icon { color: var(--amber); }
  &--teal .status-pill__icon { color: var(--teal); }
  &--red .status-pill__icon { color: var(--red); }
}

.sales-summary {
  display: flex;
  justify-content: space-between;

  &__item {
    width: 31.5%;
    min-height: 72px;
    border-radius: var(--radius-card);
    background: var(--card-dim);
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: center;
  }

  &__value {
    font-family: var(--font-display);
    font-size: 21px;
    font-weight: 800;
    color: var(--text-1);
    line-height: 1.15;
  }

  &__label {
    margin-top: 4px;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-3);
  }

  &__item--amber .sales-summary__value { color: var(--amber); }
  &__item--blue .sales-summary__value { color: var(--blue); }
  &__item--teal .sales-summary__value { color: var(--teal); }
}

.dashboard-loading {
  padding: 4px 0 0;
  text-align: center;

  &__text {
    font-size: 12px;
    color: var(--text-3);
  }
}

/* ==================== NO FAMILY CARD ==================== */
.no-family-card {
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  padding: 30px 22px;
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

  &__icon-text {
    font-family: 'Material Icons Round';
    font-size: 32px;
    color: var(--primary);
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
    margin-top: 7px;
    line-height: 1.45;
    display: block;
  }

  &__actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
  }

  &__btn {
    height: 42px;
    padding: 0 24px;
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

@media (max-width: 360px) {
  .metric-grid {
    display: flex;
    flex-wrap: wrap;
  }

  .metric-card,
  .status-pill {
    width: 48.5%;
  }

  .status-strip {
    flex-wrap: wrap;
    margin-bottom: -8px;
  }

  .status-pill {
    margin-bottom: 8px;
  }

  .finance-summary-card {
    flex-direction: column;
  }
}
</style>
