<template>
  <view class="dog-list">
    <!-- 筛选栏 -->
    <view class="dog-list__filters">
      <view
        v-for="filter in filterOptions"
        :key="filter.value"
        class="dog-list__filter"
        :class="{ 'dog-list__filter--active': activeFilter === filter.value }"
        @click="activeFilter = filter.value"
      >
        <text>{{ filter.label }}</text>
      </view>
    </view>

    <!-- 犬只列表 -->
    <scroll-view scroll-y class="dog-list__scroll">
      <view
        v-for="dog in filteredDogs"
        :key="dog._id"
        class="dog-list__item"
        @click="goToDetail(dog._id)"
      >
        <DogAvatar :name="dog.name" :size="96" />
        <view class="dog-list__info">
          <view class="dog-list__name-row">
            <text class="dog-list__name">{{ dog.name || '未命名' }}</text>
            <text class="dog-list__role">{{ dog.role }}</text>
          </view>
          <view class="dog-list__meta">
            <text>{{ dog.gender }}</text>
            <text v-if="dog.breed"> · {{ dog.breed }}</text>
            <text v-if="dog.birth_date"> · {{ formatAge(dog.birth_date) }}</text>
          </view>
          <!-- 状态标签 -->
          <view class="dog-list__statuses">
            <text
              v-for="(status, idx) in dog.statuses"
              :key="idx"
              class="dog-list__status"
              :class="statusClass(status.type)"
            >
              {{ status.type }}
            </text>
          </view>
        </view>
        <text class="dog-list__arrow">›</text>
      </view>

      <view v-if="filteredDogs.length === 0 && !loading" class="dog-list__empty">
        <text>暂无犬只</text>
      </view>
    </scroll-view>

    <!-- 添加按钮 -->
    <view class="dog-list__fab" @click="goToAdd">
      <text class="dog-list__fab-text">+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import DogAvatar from '@/components/common/DogAvatar.vue'
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

function formatAge(birthTs: number) {
  const now = Date.now()
  const days = Math.floor((now - birthTs) / 86400000)
  if (days < 30) return `${days}天`
  if (days < 365) return `${Math.floor(days / 30)}月龄`
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  return months > 0 ? `${years}岁${months}月` : `${years}岁`
}

function statusClass(type: DeriveStatusType) {
  const map: Record<string, string> = {
    '发情中': 'dog-list__status--heat',
    '怀孕中': 'dog-list__status--pregnant',
    '哺乳中': 'dog-list__status--nursing',
    '生病中': 'dog-list__status--sick',
    '用药中': 'dog-list__status--medication',
    '正常': 'dog-list__status--normal',
  }
  return map[type] || ''
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

<style scoped>
.dog-list {
  min-height: 100vh;
  background: #f5f5f5;
}

.dog-list__filters {
  display: flex;
  gap: 16rpx;
  padding: 20rpx 32rpx;
  background: #fff;
  overflow-x: auto;
}

.dog-list__filter {
  padding: 10rpx 28rpx;
  border-radius: 28rpx;
  background: #f0f0f0;
  font-size: 26rpx;
  white-space: nowrap;
  color: #666;
}

.dog-list__filter--active {
  background: #007AFF;
  color: #fff;
}

.dog-list__scroll {
  height: calc(100vh - 100rpx);
  padding: 16rpx 32rpx;
}

.dog-list__item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.dog-list__info {
  flex: 1;
}

.dog-list__name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.dog-list__name {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.dog-list__role {
  font-size: 22rpx;
  color: #999;
  background: #f5f5f5;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
}

.dog-list__meta {
  font-size: 24rpx;
  color: #999;
  margin-top: 6rpx;
}

.dog-list__statuses {
  display: flex;
  gap: 8rpx;
  margin-top: 8rpx;
  flex-wrap: wrap;
}

.dog-list__status {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background: #f0f0f0;
  color: #666;
}

.dog-list__status--heat { background: #FFF3E0; color: #E65100; }
.dog-list__status--pregnant { background: #FCE4EC; color: #C62828; }
.dog-list__status--nursing { background: #E8F5E9; color: #2E7D32; }
.dog-list__status--sick { background: #FFEBEE; color: #C62828; }
.dog-list__status--medication { background: #E3F2FD; color: #1565C0; }
.dog-list__status--normal { display: none; }

.dog-list__arrow {
  font-size: 36rpx;
  color: #ccc;
}

.dog-list__empty {
  text-align: center;
  padding: 120rpx 0;
  color: #999;
  font-size: 28rpx;
}

.dog-list__fab {
  position: fixed;
  right: 40rpx;
  bottom: 200rpx;
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: #007AFF;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 16rpx rgba(0, 122, 255, 0.4);
}

.dog-list__fab-text {
  font-size: 48rpx;
  color: #fff;
  font-weight: 300;
}
</style>
