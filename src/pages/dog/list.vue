<!--
  犬只列表页 (D-1)
  设计稿：docs/ui/pages-list.html
  筛选 chips + 犬只卡片列表 + 状态标签 + FAB 添加
-->
<template>
  <view class="dog-list">
    <!-- 页面标题 -->
    <view class="dog-list__header">
      <text class="dog-list__title">犬只档案</text>
      <text class="dog-list__count">{{ dogs.length }}只</text>
    </view>

    <!-- 筛选 chips -->
    <scroll-view scroll-x class="dog-list__filters">
      <view
        v-for="filter in filterOptions"
        :key="filter.value"
        class="dog-list__chip"
        :class="{ 'dog-list__chip--active': activeFilter === filter.value }"
        @click="activeFilter = filter.value"
      >
        <text class="dog-list__chip-text">{{ filter.label }}</text>
      </view>
    </scroll-view>

    <!-- 加载骨架屏 -->
    <BSkeleton v-if="loading" :rows="4" avatar />

    <!-- 犬只列表 -->
    <view v-else class="dog-list__content">
      <view
        v-for="dog in filteredDogs"
        :key="dog._id"
        class="dog-list__card"
        @click="goToDetail(dog._id)"
      >
        <!-- 左侧头像 -->
        <DogAvatar :name="dog.name" :size="42" />
        <!-- 中间信息 -->
        <view class="dog-list__info">
          <view class="dog-list__name-row">
            <text class="dog-list__name">{{ dog.name || '未命名' }}</text>
            <BTag v-if="dog.role === '外部种公'" label="外部" color="blue" />
          </view>
          <text class="dog-list__meta">
            {{ dog.gender }}
            <text v-if="dog.breed"> · {{ dog.breed }}</text>
            <text v-if="dog.birth_date"> · {{ formatAge(dog.birth_date) }}</text>
          </text>
          <!-- 状态标签 -->
          <view v-if="dog.statuses?.length" class="dog-list__tags">
            <BTag
              v-for="(status, idx) in dog.statuses"
              :key="idx"
              :label="status.type"
              :color="statusColor(status.type)"
            />
          </view>
        </view>
        <!-- 右侧箭头 -->
        <text class="dog-list__arrow material-icons-round">chevron_right</text>
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

    <!-- FAB 添加按钮 -->
    <view class="dog-list__fab" @click="goToAdd">
      <text class="dog-list__fab-icon material-icons-round">add</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import DogAvatar from '@/components/common/DogAvatar.vue'
import BTag from '@/components/base/BTag.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import { useCloudCall } from '@/composables/useCloudCall'
import type { DogWithStatus, DeriveStatusType } from '@/types/dog'

const dogs = ref<DogWithStatus[]>([])
const loading = ref(true)
const activeFilter = ref('all')

const { run: fetchDogs } = useCloudCall<{ data: DogWithStatus[] }>('dog-service', 'getDogListWithStatus')

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '种母', value: 'dam' },
  { label: '种公', value: 'sire' },
  { label: '幼崽', value: 'puppy' },
  { label: '外部种公', value: 'external' },
]

const filteredDogs = computed(() => {
  if (activeFilter.value === 'all') return dogs.value
  if (activeFilter.value === 'dam') return dogs.value.filter(d => d.role === '种狗' && d.gender === '母')
  if (activeFilter.value === 'sire') return dogs.value.filter(d => d.role === '种狗' && d.gender === '公')
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

/* 页面标题 */
.dog-list__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: var(--space-header-top) var(--space-page) 8px;
}
.dog-list__title {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: var(--text-1);
}
.dog-list__count {
  font-size: 13px;
  color: var(--text-3);
}

/* 筛选 chips */
.dog-list__filters {
  display: flex;
  gap: 8px;
  padding: 8px var(--space-page) 16px;
  white-space: nowrap;
}
.dog-list__chip {
  padding: 6px 16px;
  border-radius: var(--radius-tag);
  background: var(--card-dim);
  transition: transform 0.12s ease;
  &:active { transform: scale(0.94); }
}
.dog-list__chip--active {
  background: var(--primary);
  .dog-list__chip-text { color: #FFFFFF; }
}
.dog-list__chip-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

/* 列表内容区 */
.dog-list__content {
  padding: 0 var(--space-card);
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);
}

/* 犬只卡片 */
.dog-list__card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  box-shadow: var(--shadow);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.dog-list__info {
  flex: 1;
  min-width: 0;
}

.dog-list__name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dog-list__name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dog-list__meta {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 2px;
}

.dog-list__tags {
  display: flex;
  gap: var(--space-tag-gap);
  margin-top: 6px;
  flex-wrap: wrap;
}

.dog-list__arrow {
  font-family: 'Material Icons Round';
  font-size: 20px;
  color: var(--text-4);
  flex-shrink: 0;
}

/* FAB 添加按钮 */
.dog-list__fab {
  position: fixed;
  right: 20px;
  bottom: 100px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-fab);
  z-index: 50;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.88); }
}
.dog-list__fab-icon {
  font-family: 'Material Icons Round';
  font-size: 28px;
  color: #FFFFFF;
}
</style>
