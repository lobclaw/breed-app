<template>
  <view class="dog-detail" v-if="dog">
    <!-- 头部信息 -->
    <view class="dog-detail__header">
      <DogAvatar :name="dog.name" :size="128" />
      <view class="dog-detail__header-info">
        <text class="dog-detail__name">{{ dog.name || '未命名' }}</text>
        <text class="dog-detail__meta">{{ dog.gender }} · {{ dog.role }} · {{ dog.breed }}</text>
        <view class="dog-detail__statuses">
          <text
            v-for="(s, idx) in statuses"
            :key="idx"
            class="dog-detail__status-tag"
            :class="`dog-detail__status-tag--${s.type}`"
          >
            {{ s.type }}
          </text>
        </view>
      </view>
    </view>

    <!-- 基础信息卡片 -->
    <view class="dog-detail__card">
      <view class="dog-detail__card-title">基础信息</view>
      <view class="dog-detail__field">
        <text class="dog-detail__label">出生日期</text>
        <text class="dog-detail__value">{{ dog.birth_date ? formatDate(dog.birth_date) : '未知' }}</text>
      </view>
      <view class="dog-detail__field" v-if="dog.birth_date">
        <text class="dog-detail__label">年龄</text>
        <text class="dog-detail__value">{{ formatAge(dog.birth_date) }}</text>
      </view>
      <view class="dog-detail__field">
        <text class="dog-detail__label">去向</text>
        <text class="dog-detail__value">{{ dog.disposition }}</text>
      </view>
      <view class="dog-detail__field" v-if="dog.latest_weight">
        <text class="dog-detail__label">最新体重</text>
        <text class="dog-detail__value">{{ formatWeight(dog.latest_weight) }}</text>
      </view>
      <view class="dog-detail__field" v-if="dog.owner_info">
        <text class="dog-detail__label">主人信息</text>
        <text class="dog-detail__value">{{ dog.owner_info }}</text>
      </view>
    </view>

    <!-- Tab 切换 -->
    <view class="dog-detail__tabs">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="dog-detail__tab"
        :class="{ 'dog-detail__tab--active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <!-- Tab 内容 -->
    <view class="dog-detail__tab-content">
      <!-- 繁育历史 -->
      <view v-if="activeTab === 'breeding'">
        <view v-if="cycles.length === 0" class="dog-detail__empty">暂无繁育记录</view>
        <view v-for="cycle in cycles" :key="cycle._id" class="dog-detail__record" @click="goToCycle(cycle._id)">
          <view class="dog-detail__record-header">
            <text class="dog-detail__record-title">繁育周期 · {{ cycle.status }}</text>
            <text class="dog-detail__record-date">{{ formatDate(cycle.created_at) }}</text>
          </view>
          <text v-if="cycle.sire_name" class="dog-detail__record-sub">种公: {{ cycle.sire_name }}</text>
        </view>
      </view>

      <!-- 健康记录 -->
      <view v-if="activeTab === 'health'">
        <view v-if="healthRecords.length === 0" class="dog-detail__empty">暂无健康记录</view>
        <view v-for="record in healthRecords" :key="record._id" class="dog-detail__record">
          <view class="dog-detail__record-header">
            <text class="dog-detail__record-title">{{ typeLabel(record.type) }}</text>
            <text class="dog-detail__record-date">{{ formatDate(record.date) }}</text>
          </view>
          <text v-if="record.notes" class="dog-detail__record-sub">{{ record.notes }}</text>
        </view>
      </view>

      <!-- 财务 -->
      <view v-if="activeTab === 'finance'">
        <view class="dog-detail__empty">财务功能将在第二批开发</view>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view class="dog-detail__actions">
      <button class="dog-detail__btn" @click="editDog">编辑</button>
      <button class="dog-detail__btn dog-detail__btn--primary" @click="addRecord">+ 添加记录</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import DogAvatar from '@/components/common/DogAvatar.vue'
import { useCloudCall } from '@/composables/useCloudCall'
import type { Dog, DeriveStatus } from '@/types/dog'

const dog = ref<Dog | null>(null)
const statuses = ref<DeriveStatus[]>([])
const cycles = ref<any[]>([])
const healthRecords = ref<any[]>([])
const activeTab = ref('breeding')
let dogId = ''

const tabs = [
  { key: 'breeding', label: '繁育' },
  { key: 'health', label: '健康' },
  { key: 'finance', label: '财务' },
]

const { run: fetchDetail } = useCloudCall<{ data: Dog }>('dog-service', 'getDogDetail')
const { run: fetchCycles } = useCloudCall<{ data: any[] }>('breeding-service', 'getCycleHistory')
const { run: fetchHealth } = useCloudCall<{ data: any[] }>('health-service', 'getHealthHistory')

function formatDate(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatAge(birthTs: number) {
  const days = Math.floor((Date.now() - birthTs) / 86400000)
  if (days < 30) return `${days}天`
  if (days < 365) return `${Math.floor(days / 30)}月龄`
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  return months > 0 ? `${years}岁${months}月` : `${years}岁`
}

function formatWeight(grams: number) {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)}kg` : `${grams}g`
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    vaccination: '疫苗',
    deworming: '驱虫',
    illness: '疾病',
  }
  return map[type] || type
}

function goToCycle(cycleId: string) {
  uni.navigateTo({ url: `/pages/breeding/cycle?id=${cycleId}` })
}

function editDog() {
  uni.navigateTo({ url: `/pages/dog/add?id=${dogId}` })
}

function addRecord() {
  uni.navigateTo({ url: `/pages/record/breeding?dogId=${dogId}` })
}

async function loadData() {
  const [detailRes, cyclesRes, healthRes] = await Promise.all([
    fetchDetail(dogId),
    fetchCycles(dogId),
    fetchHealth(dogId),
  ])

  if (detailRes?.data) {
    dog.value = detailRes.data
  }
  if (cyclesRes?.data) {
    cycles.value = cyclesRes.data
  }
  if (healthRes?.data) {
    healthRecords.value = healthRes.data
  }
}

onLoad((query) => {
  dogId = query?.id || ''
  if (dogId) loadData()
})
</script>

<style scoped>
.dog-detail {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 140rpx;
}

.dog-detail__header {
  display: flex;
  gap: 24rpx;
  padding: 32rpx;
  background: #fff;
  align-items: center;
}

.dog-detail__header-info {
  flex: 1;
}

.dog-detail__name {
  font-size: 36rpx;
  font-weight: 700;
  color: #333;
}

.dog-detail__meta {
  font-size: 26rpx;
  color: #999;
  margin-top: 6rpx;
}

.dog-detail__statuses {
  display: flex;
  gap: 8rpx;
  margin-top: 12rpx;
  flex-wrap: wrap;
}

.dog-detail__status-tag {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
  background: #f0f0f0;
  color: #666;
}

.dog-detail__status-tag--发情中 { background: #FFF3E0; color: #E65100; }
.dog-detail__status-tag--怀孕中 { background: #FCE4EC; color: #C62828; }
.dog-detail__status-tag--哺乳中 { background: #E8F5E9; color: #2E7D32; }
.dog-detail__status-tag--生病中 { background: #FFEBEE; color: #C62828; }
.dog-detail__status-tag--用药中 { background: #E3F2FD; color: #1565C0; }

.dog-detail__card {
  background: #fff;
  margin: 16rpx 32rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}

.dog-detail__card-title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 16rpx;
  color: #333;
}

.dog-detail__field {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.dog-detail__field:last-child {
  border-bottom: none;
}

.dog-detail__label {
  font-size: 28rpx;
  color: #999;
}

.dog-detail__value {
  font-size: 28rpx;
  color: #333;
}

.dog-detail__tabs {
  display: flex;
  background: #fff;
  margin-top: 16rpx;
  border-bottom: 1rpx solid #eee;
}

.dog-detail__tab {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 28rpx;
  color: #999;
  position: relative;
}

.dog-detail__tab--active {
  color: #007AFF;
  font-weight: 600;
}

.dog-detail__tab--active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 30%;
  right: 30%;
  height: 4rpx;
  background: #007AFF;
  border-radius: 2rpx;
}

.dog-detail__tab-content {
  padding: 16rpx 32rpx;
}

.dog-detail__record {
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
}

.dog-detail__record-header {
  display: flex;
  justify-content: space-between;
}

.dog-detail__record-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
}

.dog-detail__record-date {
  font-size: 24rpx;
  color: #999;
}

.dog-detail__record-sub {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
}

.dog-detail__empty {
  text-align: center;
  padding: 60rpx 0;
  color: #999;
  font-size: 28rpx;
}

.dog-detail__actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 20rpx;
  padding: 20rpx 32rpx;
  background: #fff;
  box-shadow: 0 -2rpx 8rpx rgba(0,0,0,0.05);
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
}

.dog-detail__btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  color: #333;
}

.dog-detail__btn--primary {
  background: #007AFF;
  color: #fff;
}
</style>
