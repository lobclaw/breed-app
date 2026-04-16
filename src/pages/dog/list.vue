<!--
  犬只列表页 (D-1)
  设计稿：docs/ui/pages-list.html
  筛选 chips + 犬只卡片列表 + 状态标签 + FAB 添加
  + D-5 高级筛选 Sheet
-->
<template>
  <view class="dog-list">
    <!-- 页面标题 -->
    <view class="dog-list__header">
      <view class="dog-list__header-row">
        <text class="dog-list__title">档案</text>
        <view class="dog-list__header-actions">
          <view class="dog-list__header-add" @click="goToAdd">
            <text class="material-icons-round" style="font-size: 22px; color: var(--primary);">add</text>
          </view>
          <text class="dog-list__filter-icon material-icons-round" @click="showFilterSheet = true">filter_list</text>
        </view>
      </view>
    </view>

    <!-- 搜索栏 -->
    <view class="dog-list__search">
      <text class="dog-list__search-icon material-icons-round">search</text>
      <input
        v-model="searchKeyword"
        class="dog-list__search-input"
        placeholder="搜索犬只..."
        confirm-type="search"
      />
      <text
        v-if="searchKeyword"
        class="dog-list__search-clear material-icons-round"
        @click="searchKeyword = ''"
      >close</text>
    </view>

    <!-- 筛选 chips -->
    <scroll-view scroll-x class="dog-list__filters">
      <view class="dog-list__filters-inner">
        <view
          v-for="filter in filterOptions"
          :key="filter.value"
          class="dog-list__chip"
          :class="{ 'dog-list__chip--active': activeFilter === filter.value }"
          @click="activeFilter = filter.value"
        >
          <text class="dog-list__chip-text">{{ filter.label }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 已激活高级筛选提示 -->
    <view v-if="hasAdvancedFilter" class="dog-list__filter-active">
      <text class="dog-list__filter-active-text">已应用高级筛选</text>
      <text class="dog-list__filter-active-clear" @click="resetAdvancedFilters">清除</text>
    </view>

    <!-- 加载骨架屏 -->
    <view v-if="loading" class="dog-list__skeleton-wrap">
      <BSkeleton :rows="4" avatar />
    </view>

    <!-- 犬只列表 -->
    <view v-else class="dog-list__content">
      <view
        v-for="dog in filteredDogs"
        :key="dog._id"
        class="dog-list__card"
        :class="cardBarClass(dog)"
        @click="goToDetail(dog._id)"
      >
        <!-- 渐变背景层（CSS ::before 处理） -->
        <view class="dog-list__card-row">
          <!-- 左侧图标 -->
          <view
            class="dog-list__card-icon"
            :class="[cardIconBgClass(dog), cardRingClass(dog)]"
          >
            <text class="dog-list__card-emoji">{{ dog.role === '幼崽' ? '🐶' : '🐩' }}</text>
          </view>

          <!-- 中间信息 -->
          <view class="dog-list__card-middle">
            <text class="dog-list__card-name">{{ dog.name || '未命名' }}</text>
            <text class="dog-list__card-sub">
              {{ dog.breed || '马尔济斯' }}<text v-if="dog.birth_date"> · {{ formatAge(dog.birth_date) }}</text>
            </text>
          </view>

          <!-- 右侧标签 -->
          <view class="dog-list__card-right">
            <BTag :label="dispositionLabel(dog)" :color="dispositionColor(dog)" />
            <view class="dog-list__role-tag" :class="roleTagClass(dog)">
              <text class="dog-list__role-tag-text">{{ roleLabel(dog) }}</text>
            </view>
          </view>
        </view>

        <!-- 底部状态标签 -->
        <view v-if="dog.statuses?.length" class="dog-list__status-labels">
          <BTag
            v-for="(status, idx) in dog.statuses"
            :key="idx"
            :label="status.label || status.type"
            :color="statusColor(status.type)"
          />
        </view>
      </view>

      <!-- 空状态 -->
      <BEmpty
        v-if="filteredDogs.length === 0"
        icon="pets"
        title="暂无犬只"
        description="点击右上角 + 添加第一只犬"
        action-text="添加犬只"
        @action="goToAdd"
      />
    </view>

    <!-- 底部导航栏 -->
    <BNavBar current="dog" />

    <!-- ==================== D-5: 高级筛选 Sheet ==================== -->
    <BSheet v-model:visible="showFilterSheet" title="筛选">
      <view class="filter-panel">
        <!-- 性别 -->
        <view class="filter-section">
          <text class="filter-section__label">性别</text>
          <view class="filter-pills">
            <view
              v-for="opt in genderOptions"
              :key="opt.value"
              class="filter-pill"
              :class="{ 'filter-pill--active': advFilters.genders.includes(opt.value) }"
              @click="toggleFilter('genders', opt.value)"
            >
              <text class="filter-pill__text">{{ opt.label }}</text>
            </view>
          </view>
        </view>

        <!-- 角色 -->
        <view class="filter-section">
          <text class="filter-section__label">角色</text>
          <view class="filter-pills">
            <view
              v-for="opt in roleOptions"
              :key="opt.value"
              class="filter-pill"
              :class="{ 'filter-pill--active': advFilters.roles.includes(opt.value) }"
              @click="toggleFilter('roles', opt.value)"
            >
              <text class="filter-pill__text">{{ opt.label }}</text>
            </view>
          </view>
        </view>

        <!-- 去向 -->
        <view class="filter-section">
          <text class="filter-section__label">去向</text>
          <view class="filter-pills">
            <view
              v-for="opt in dispositionOptions"
              :key="opt.value"
              class="filter-pill"
              :class="{ 'filter-pill--active': advFilters.dispositions.includes(opt.value) }"
              @click="toggleFilter('dispositions', opt.value)"
            >
              <text class="filter-pill__text">{{ opt.label }}</text>
            </view>
          </view>
        </view>

        <!-- 状态 -->
        <view class="filter-section">
          <text class="filter-section__label">状态</text>
          <view class="filter-pills">
            <view
              v-for="opt in statusOptions"
              :key="opt.value"
              class="filter-pill"
              :class="{ 'filter-pill--active': advFilters.statuses.includes(opt.value) }"
              @click="toggleFilter('statuses', opt.value)"
            >
              <text class="filter-pill__text">{{ opt.label }}</text>
            </view>
          </view>
        </view>

        <!-- 按钮区 -->
        <view class="filter-actions">
          <view class="filter-actions__btn filter-actions__btn--primary" @click="applyAdvancedFilters">
            <text class="filter-actions__btn-text" style="color: #fff;">应用筛选</text>
          </view>
          <view class="filter-actions__btn filter-actions__btn--ghost" @click="resetAdvancedFilters">
            <text class="filter-actions__btn-text" style="color: var(--text-2);">重置</text>
          </view>
        </view>
      </view>
    </BSheet>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import BTag from '@/components/base/BTag.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BNavBar from '@/components/layout/BNavBar.vue'
import BSheet from '@/components/layout/BSheet.vue'
import { useCloudCall } from '@/composables/useCloudCall'
import type { DogWithStatus, DeriveStatusType } from '@/types/dog'
import { getDogStatusTone } from '@/utils/themeSemantics'

const dogs = ref<DogWithStatus[]>([])
const loading = ref(true)
const activeFilter = ref('all')
const showFilterSheet = ref(false)

import { useDogStore } from '@/stores/dogStore'
const dogStore = useDogStore()

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '种狗', value: 'breeding' },
  { label: '幼崽', value: 'puppy' },
  { label: '外部种公', value: 'external' },
]

// ==================== D-5: 高级筛选 ====================

const genderOptions = [
  { label: '公', value: '公' },
  { label: '母', value: '母' },
]

const roleOptions = [
  { label: '种狗', value: '种狗' },
  { label: '幼崽', value: '幼崽' },
  { label: '外部种公', value: '外部种公' },
]

const dispositionOptions = [
  { label: '在养', value: '在养' },
  { label: '待售', value: '待售' },
  { label: '已预定', value: '已预定' },
  { label: '已成交', value: '已成交' },
  { label: '已退休', value: '已退休' },
  { label: '已领养', value: '已领养' },
  { label: '已赠送', value: '已赠送' },
  { label: '已故', value: '已故' },
]

const statusOptions = [
  { label: '发情中', value: '发情中' },
  { label: '怀孕中', value: '怀孕中' },
  { label: '哺乳中', value: '哺乳中' },
  { label: '生病中', value: '生病中' },
  { label: '用药中', value: '用药中' },
]

// 高级筛选状态
const advFilters = reactive({
  genders: [] as string[],
  roles: [] as string[],
  dispositions: [] as string[],
  statuses: [] as string[],
})

// 已应用的高级筛选（仅在点击"应用筛选"后生效）
const appliedFilters = reactive({
  genders: [] as string[],
  roles: [] as string[],
  dispositions: [] as string[],
  statuses: [] as string[],
})

const hasAdvancedFilter = computed(() => {
  return appliedFilters.genders.length > 0
    || appliedFilters.roles.length > 0
    || appliedFilters.dispositions.length > 0
    || appliedFilters.statuses.length > 0
})

function toggleFilter(group: 'genders' | 'roles' | 'dispositions' | 'statuses', value: string) {
  const idx = advFilters[group].indexOf(value)
  if (idx >= 0) {
    advFilters[group].splice(idx, 1)
  } else {
    advFilters[group].push(value)
  }
}

function applyAdvancedFilters() {
  appliedFilters.genders = [...advFilters.genders]
  appliedFilters.roles = [...advFilters.roles]
  appliedFilters.dispositions = [...advFilters.dispositions]
  appliedFilters.statuses = [...advFilters.statuses]
  showFilterSheet.value = false
}

function resetAdvancedFilters() {
  advFilters.genders = []
  advFilters.roles = []
  advFilters.dispositions = []
  advFilters.statuses = []
  appliedFilters.genders = []
  appliedFilters.roles = []
  appliedFilters.dispositions = []
  appliedFilters.statuses = []
  showFilterSheet.value = false
}

const filteredDogs = computed(() => {
  let result = dogs.value

  // 搜索过滤
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    result = result.filter(d => d.name?.toLowerCase().includes(kw))
  }

  // 快捷筛选
  if (activeFilter.value === 'breeding') result = result.filter(d => d.role === '种狗')
  else if (activeFilter.value === 'puppy') result = result.filter(d => d.role === '幼崽')
  else if (activeFilter.value === 'external') result = result.filter(d => d.role === '外部种公')

  // 高级筛选
  if (appliedFilters.genders.length > 0) {
    result = result.filter(d => appliedFilters.genders.includes(d.gender))
  }
  if (appliedFilters.roles.length > 0) {
    result = result.filter(d => appliedFilters.roles.includes(d.role))
  }
  if (appliedFilters.dispositions.length > 0) {
    result = result.filter(d => appliedFilters.dispositions.includes(d.disposition || '在养'))
  }
  if (appliedFilters.statuses.length > 0) {
    result = result.filter(d =>
      d.statuses?.some(s => appliedFilters.statuses.includes(s.type))
    )
  }

  return result
})

/** 状态类型 → 功能色映射 */
function statusColor(type: DeriveStatusType): 'red' | 'amber' | 'green' | 'rose' | 'plum' | 'teal' {
  const tone = getDogStatusTone(type)
  return tone.color === 'blue' ? 'green' : tone.color
}

/** 卡片左侧色条 class */
function cardBarClass(dog: DogWithStatus) {
  if (dog.statuses?.length) {
    const mainStatus = dog.statuses[0].type
    return `dog-list__card--bar-${statusColor(mainStatus)}`
  }
  if (dog.role === '外部种公') return 'dog-list__card--bar-blue'
  if (dog.role === '幼崽') return 'dog-list__card--bar-amber'
  return 'dog-list__card--bar-green'
}

/** 图标背景色 class */
function cardIconBgClass(dog: DogWithStatus) {
  if (dog.statuses?.length) {
    return `dog-list__card-icon--${statusColor(dog.statuses[0].type)}`
  }
  if (dog.role === '外部种公') return 'dog-list__card-icon--blue'
  if (dog.role === '幼崽') return 'dog-list__card-icon--amber'
  return 'dog-list__card-icon--green'
}

/** 图标状态环 class */
function cardRingClass(dog: DogWithStatus) {
  if (dog.statuses?.length) {
    return `dog-list__card-icon--ring-${statusColor(dog.statuses[0].type)}`
  }
  if (dog.role === '外部种公') return 'dog-list__card-icon--ring-blue'
  if (dog.role === '幼崽') return 'dog-list__card-icon--ring-amber'
  return 'dog-list__card-icon--ring-green'
}

/** 去向标签文字 */
function dispositionLabel(dog: DogWithStatus) {
  if (dog.disposition === '待售') return '待售'
  return '在养'
}

/** 去向标签颜色 */
function dispositionColor(dog: DogWithStatus): 'green' | 'amber' | 'blue' | 'rose' {
  if (dog.disposition === '待售') return 'amber'
  if (dog.role === '外部种公') return 'blue'
  return 'green'
}

/** 角色标签文字 */
function roleLabel(dog: DogWithStatus) {
  if (dog.role === '外部种公') return '外部种公'
  if (dog.role === '幼崽') return '幼崽'
  return '种狗'
}

/** 角色标签样式 class */
function roleTagClass(dog: DogWithStatus) {
  if (dog.role === '种狗') return 'dog-list__role-tag--primary'
  return 'dog-list__role-tag--gray'
}

function formatAge(birthTs: number) {
  const now = Date.now()
  const days = Math.floor((now - birthTs) / 86400000)
  if (days < 30) return `${days}天`
  if (days < 365) return `${Math.floor(days / 30)}月龄`
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  return months > 0 ? `${years}岁${months}月` : `${years}岁`
}

function goToDetail(dogId: string) {
  uni.navigateTo({ url: `/pages/dog/detail?id=${dogId}` })
}

function goToAdd() {
  uni.navigateTo({ url: '/pages/dog/add' })
}


const searchKeyword = ref('')

async function loadDogs() {
  // 有缓存：瞬间显示
  if (dogStore.list.length > 0) {
    dogs.value = dogStore.list
    loading.value = false
    // 后台刷新
    dogStore.fetchFromServer().then(() => {
      dogs.value = dogStore.list
    })
  } else {
    loading.value = true
    await dogStore.ensure()
    dogs.value = dogStore.list
    loading.value = false
  }
}

onShow(() => {
  loadDogs()
})
</script>

<style lang="scss" scoped>
.dog-list {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

/* ==================== 页面标题 ==================== */
.dog-list__header {
  padding: 12px var(--space-page) 0;
}
.dog-list__header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.dog-list__title {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.3;
}
.dog-list__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.dog-list__header-add {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.12s ease;
  &:active { background: var(--primary-soft); }
}
.dog-list__filter-icon {
  font-family: 'Material Icons Round';
  font-size: 24px;
  color: var(--text-2);
  padding: 6px;
}

/* ==================== 搜索栏 ==================== */
.dog-list__search {
  margin: 12px 16px 0;
  height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--card);
  border-radius: var(--radius-btn);
  padding: 0 16px;
  box-shadow: var(--shadow);
}
.dog-list__search-icon {
  font-family: 'Material Icons Round';
  font-size: 20px;
  color: var(--text-3);
}
.dog-list__search-placeholder {
  font-size: 14px;
  color: var(--text-3);
}
.dog-list__search-input {
  flex: 1;
  height: 44px;
  line-height: 44px;
  font-size: 14px;
  color: var(--text-1);
  background: transparent;
  border: none;
  outline: none;
  font-family: var(--font-body);
}
.dog-list__search-clear {
  font-size: 18px;
  color: var(--text-3);
  padding: 4px;
}

/* ==================== 筛选 chips ==================== */
.dog-list__filters {
  white-space: nowrap;
}
.dog-list__filters-inner {
  display: flex;
  gap: 8px;
  padding: 14px 16px 0;
}
.dog-list__chip {
  font-size: 13px;
  font-weight: 600;
  padding: 6px 16px;
  border-radius: var(--radius-tag);
  white-space: nowrap;
  background: var(--card);
  color: var(--text-2);
  border: 1.5px solid var(--text-4);
  transition: transform 0.12s ease;
  &:active { transform: scale(0.94); }
}
.dog-list__chip--active {
  background: var(--primary);
  border-color: var(--primary);
  .dog-list__chip-text { color: #FFFFFF; }
}
.dog-list__chip-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.dog-list__chip--active .dog-list__chip-text {
  color: #FFFFFF;
}

/* ==================== 高级筛选已激活提示 ==================== */
.dog-list__filter-active {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 16px 0;
  padding: 8px 12px;
  background: var(--primary-soft);
  border-radius: var(--radius-date);
}
.dog-list__filter-active-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
}
.dog-list__filter-active-clear {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  text-decoration: underline;
}

/* ==================== 骨架屏容器 ==================== */
.dog-list__skeleton-wrap {
  padding: 14px 16px 0;
}

/* ==================== 列表内容区 ==================== */
.dog-list__content {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);
  margin-top: 14px;
}

/* ==================== 犬只卡片 ==================== */
.dog-list__card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: var(--space-card);
  padding-left: var(--space-card-left);
  position: relative;
  box-shadow: var(--shadow);
  overflow: hidden;
  border-left: 3.5px solid transparent;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  cursor: pointer;
  &:active {
    transform: scale(0.975);
    box-shadow: 0 1px 4px rgba(45, 27, 20, 0.08);
  }
}

/* 渐变背景层 */
.dog-list__card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  pointer-events: none;
}

/* 卡片左色条颜色 */
.dog-list__card--bar-red { border-left-color: var(--red); }
.dog-list__card--bar-rose { border-left-color: var(--rose); }
.dog-list__card--bar-green { border-left-color: var(--green); }
.dog-list__card--bar-blue { border-left-color: var(--blue); }
.dog-list__card--bar-plum { border-left-color: var(--plum); }
.dog-list__card--bar-teal { border-left-color: var(--teal); }
.dog-list__card--bar-amber { border-left-color: var(--amber); }

/* 渐变背景 */
.dog-list__card--bar-red::before { background: linear-gradient(135deg, var(--red-soft) 0%, transparent 40%); }
.dog-list__card--bar-rose::before { background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%); }
.dog-list__card--bar-green::before { background: linear-gradient(135deg, var(--green-soft) 0%, transparent 40%); }
.dog-list__card--bar-blue::before { background: linear-gradient(135deg, var(--blue-soft) 0%, transparent 40%); }
.dog-list__card--bar-plum::before { background: linear-gradient(135deg, var(--plum-soft) 0%, transparent 40%); }
.dog-list__card--bar-teal::before { background: linear-gradient(135deg, var(--teal-soft) 0%, transparent 40%); }
.dog-list__card--bar-amber::before { background: linear-gradient(135deg, var(--amber-soft) 0%, transparent 40%); }

/* 确保内容在渐变层之上 */
.dog-list__card > * {
  position: relative;
  z-index: 1;
}

/* 卡片行布局 */
.dog-list__card-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 左侧图标 */
.dog-list__card-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2.5px solid transparent;
}
.dog-list__card-emoji {
  font-size: 18px;
}

/* 图标背景色 */
.dog-list__card-icon--red { background: var(--icon-red); }
.dog-list__card-icon--rose { background: var(--icon-rose); }
.dog-list__card-icon--green { background: var(--icon-green); }
.dog-list__card-icon--blue { background: var(--icon-blue); }
.dog-list__card-icon--plum { background: var(--icon-plum); }
.dog-list__card-icon--teal { background: var(--icon-teal); }
.dog-list__card-icon--amber { background: var(--icon-amber); }

/* 图标状态环 */
.dog-list__card-icon--ring-red { border-color: var(--red); }
.dog-list__card-icon--ring-rose { border-color: var(--rose); }
.dog-list__card-icon--ring-green { border-color: var(--green); }
.dog-list__card-icon--ring-blue { border-color: var(--blue); }
.dog-list__card-icon--ring-plum { border-color: var(--plum); }
.dog-list__card-icon--ring-teal { border-color: var(--teal); }
.dog-list__card-icon--ring-amber { border-color: var(--amber); }

/* 中间信息 */
.dog-list__card-middle {
  flex: 1;
  min-width: 0;
}
.dog-list__card-name {
  display: block;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dog-list__card-sub {
  display: block;
  font-size: 12px;
  color: var(--text-2);
  margin-top: 1px;
}

/* 右侧标签列 */
.dog-list__card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

/* 角色小标签 */
.dog-list__role-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-tag);
}
.dog-list__role-tag-text {
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
}
.dog-list__role-tag--primary {
  background: var(--primary-soft);
  .dog-list__role-tag-text { color: var(--primary); }
}
.dog-list__role-tag--gray {
  background: var(--card-dim);
  .dog-list__role-tag-text { color: var(--text-3); }
}

/* 底部状态标签 */
.dog-list__status-labels {
  display: flex;
  gap: var(--space-tag-gap);
  margin-top: 8px;
  flex-wrap: wrap;
}


/* ==================== D-5: 筛选面板样式 ==================== */
.filter-panel {
  padding-bottom: 16px;
}
.filter-section {
  margin-bottom: 16px;
}
.filter-section__label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  margin-bottom: 8px;
}
.filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.filter-pill {
  padding: 6px 14px;
  border-radius: var(--radius-tag);
  font-size: 12px;
  font-weight: 600;
  border: 1.5px solid var(--text-4);
  background: transparent;
  color: var(--text-2);
  transition: all 0.12s ease;
  &:active { transform: scale(0.94); }
}
.filter-pill--active {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--primary);
  .filter-pill__text { color: var(--primary); }
}
.filter-pill__text {
  font-size: 12px;
  font-weight: 600;
}
.filter-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}
.filter-actions__btn {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-btn);
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
}
.filter-actions__btn--primary {
  background: var(--primary);
}
.filter-actions__btn--ghost {
  background: transparent;
  border: 1.5px solid var(--text-4);
}
.filter-actions__btn-text {
  font-size: 15px;
  font-weight: 600;
}
</style>
