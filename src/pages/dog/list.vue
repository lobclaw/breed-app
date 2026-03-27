<!--
  犬只列表页 (D-1)
  设计稿：docs/ui/pages-list.html
  筛选 chips + 犬只卡片列表 + 状态标签 + FAB 添加
-->
<template>
  <view class="dog-list">
    <!-- 页面标题 -->
    <view class="dog-list__header">
      <view class="dog-list__header-row">
        <text class="dog-list__title">档案</text>
        <text class="dog-list__filter-icon material-icons-round" @click="onFilterClick">filter_list</text>
      </view>
    </view>

    <!-- 搜索栏 -->
    <view class="dog-list__search" @click="onSearchClick">
      <text class="dog-list__search-icon material-icons-round">search</text>
      <text class="dog-list__search-placeholder">搜索犬只...</text>
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
            :label="status.type"
            :color="statusColor(status.type)"
          />
        </view>
      </view>

      <!-- 空状态 -->
      <BEmpty
        v-if="filteredDogs.length === 0"
        icon="pets"
        title="暂无犬只"
        description="点击右下角添加第一只犬"
        action-text="添加犬只"
        @action="goToAdd"
      />
    </view>

    <!-- 页面级 FAB -->
    <view class="dog-list__fab" @click="goToAdd">
      <text class="dog-list__fab-icon material-icons-round">add</text>
    </view>

    <!-- 底部导航栏 -->
    <BNavBar current="dog" @fab-click="goToAdd" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import BTag from '@/components/base/BTag.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BNavBar from '@/components/layout/BNavBar.vue'
import { useCloudCall } from '@/composables/useCloudCall'
import type { DogWithStatus, DeriveStatusType } from '@/types/dog'

const dogs = ref<DogWithStatus[]>([])
const loading = ref(true)
const activeFilter = ref('all')

const { run: fetchDogs } = useCloudCall<{ data: DogWithStatus[] }>('dog-service', 'getDogListWithStatus')

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '种狗', value: 'breeding' },
  { label: '幼崽', value: 'puppy' },
  { label: '外部种公', value: 'external' },
]

const filteredDogs = computed(() => {
  if (activeFilter.value === 'all') return dogs.value
  if (activeFilter.value === 'breeding') return dogs.value.filter(d => d.role === '种狗')
  if (activeFilter.value === 'puppy') return dogs.value.filter(d => d.role === '幼崽')
  if (activeFilter.value === 'external') return dogs.value.filter(d => d.role === '外部种公')
  return dogs.value
})

/** 状态类型 → 功能色映射 */
function statusColor(type: DeriveStatusType): 'red' | 'amber' | 'green' | 'rose' | 'plum' | 'teal' {
  const map: Record<string, any> = {
    '发情中': 'amber',
    '怀孕中': 'rose',
    '哺乳中': 'green',
    '生病中': 'red',
    '用药中': 'plum',
  }
  return map[type] || 'green'
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

function onSearchClick() {
  // TODO: 搜索功能
}

function onFilterClick() {
  // TODO: 高级筛选
}

async function loadDogs() {
  loading.value = true
  const result = await fetchDogs()
  if (result?.data) {
    dogs.value = result.data
  }
  loading.value = false
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
.dog-list__filter-icon {
  font-family: 'Material Icons Round';
  font-size: 24px;
  color: var(--text-2);
}

/* ==================== 搜索栏 ==================== */
.dog-list__search {
  margin: 12px 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--card);
  border-radius: var(--radius-btn);
  padding: 10px 16px;
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
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dog-list__card-sub {
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

/* ==================== 页面级 FAB ==================== */
.dog-list__fab {
  position: fixed;
  bottom: 100px;
  right: 20px;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-fab);
  z-index: 5;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:active {
    transform: scale(0.88);
    box-shadow: 0 2px 8px rgba(234, 62, 119, 0.2);
  }
}
.dog-list__fab-icon {
  font-family: 'Material Icons Round';
  font-size: 28px;
  color: #FFFFFF;
}
</style>
