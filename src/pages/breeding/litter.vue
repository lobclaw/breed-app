<template>
  <view class="litter" v-if="litter">
    <!-- 窝头部 -->
    <view class="litter__header">
      <view class="litter__parents">
        <text class="litter__dam">{{ litter.dam_name }}</text>
        <text v-if="litter.sire_name" class="litter__sire">× {{ litter.sire_name }}</text>
      </view>
      <view class="litter__meta">
        <text>{{ formatDate(litter.birth_date) }} · {{ litter.birth_type }}</text>
      </view>
      <view class="litter__stats">
        <view class="litter__stat">
          <text class="litter__stat-num">{{ litter.total_born }}</text>
          <text class="litter__stat-label">总数</text>
        </view>
        <view class="litter__stat">
          <text class="litter__stat-num">{{ litter.born_alive }}</text>
          <text class="litter__stat-label">存活</text>
        </view>
        <view v-if="litter.born_dead > 0" class="litter__stat">
          <text class="litter__stat-num litter__stat-num--dead">{{ litter.born_dead }}</text>
          <text class="litter__stat-label">死胎</text>
        </view>
        <view class="litter__stat">
          <text class="litter__stat-num" :class="litter.weaned_at ? 'litter__stat-num--done' : 'litter__stat-num--pending'">
            {{ litter.weaned_at ? '已断奶' : '未断奶' }}
          </text>
          <text class="litter__stat-label">状态</text>
        </view>
      </view>
    </view>

    <!-- 幼崽列表 -->
    <view class="litter__section">
      <view class="litter__section-header">
        <text class="litter__section-title">幼崽（{{ puppies.length }}只）</text>
        <text class="litter__add-btn" @click="addPuppy">+ 添加</text>
      </view>

      <view v-for="puppy in puppies" :key="puppy._id" class="litter__puppy" @click="goToDog(puppy._id)">
        <view class="litter__puppy-avatar" :class="`litter__puppy-avatar--${puppy.gender}`">
          <text>{{ (puppy.name || '?')[0] }}</text>
        </view>
        <view class="litter__puppy-info">
          <text class="litter__puppy-name">{{ puppy.name || '未命名' }}</text>
          <text class="litter__puppy-meta">
            {{ puppy.gender }}
            <text v-if="puppy.latest_weight"> · {{ puppy.latest_weight }}g</text>
            <text> · {{ puppy.disposition }}</text>
          </text>
        </view>
        <text class="litter__puppy-arrow">›</text>
      </view>

      <view v-if="puppies.length === 0" class="litter__empty">
        <text>暂无幼崽记录</text>
      </view>
    </view>

    <!-- 断奶操作 -->
    <view v-if="!litter.weaned_at" class="litter__actions">
      <button class="litter__btn" :loading="weaning" @click="confirmWeaning">确认断奶</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'

const litter = ref<any>(null)
const puppies = ref<any[]>([])
const weaning = ref(false)
let litterId = ''

const { run: fetchDetail } = useCloudCall<{ data: any }>('breeding-service', 'getLitterDetail')
const { run: doWeaning } = useCloudCall('breeding-service', 'confirmWeaning', { successMessage: '已确认断奶' })
const { run: doAddPuppy } = useCloudCall('breeding-service', 'addPuppyToLitter', { successMessage: '已添加' })

function formatDate(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function goToDog(dogId: string) {
  uni.navigateTo({ url: `/pages/dog/detail?id=${dogId}` })
}

async function loadData() {
  const res = await fetchDetail(litterId)
  if (res?.data) {
    litter.value = res.data.litter
    puppies.value = res.data.puppies || []
  }
}

async function confirmWeaning() {
  uni.showModal({
    title: '确认断奶',
    content: '确认该窝幼崽已完成断奶？',
    success: async (res) => {
      if (res.confirm) {
        weaning.value = true
        try {
          await doWeaning(litterId)
          loadData()
        } finally {
          weaning.value = false
        }
      }
    },
  })
}

function addPuppy() {
  uni.showModal({
    title: '添加幼崽',
    editable: true,
    placeholderText: '幼崽名称（选填）',
    success: async (res) => {
      if (res.confirm) {
        await doAddPuppy(litterId, { name: res.content || '' })
        loadData()
      }
    },
  })
}

onLoad((query) => {
  litterId = query?.id || ''
  if (litterId) loadData()
})
</script>

<style scoped>
.litter {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 140rpx;
}

.litter__header {
  background: #fff;
  padding: 32rpx;
}

.litter__parents {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.litter__dam {
  font-size: 36rpx;
  font-weight: 700;
  color: #333;
}

.litter__sire {
  font-size: 28rpx;
  color: #999;
}

.litter__meta {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 24rpx;
}

.litter__stats {
  display: flex;
  gap: 32rpx;
}

.litter__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.litter__stat-num {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.litter__stat-num--dead {
  color: #FF3B30;
}

.litter__stat-num--done {
  color: #4CAF50;
  font-size: 24rpx;
}

.litter__stat-num--pending {
  color: #FF9500;
  font-size: 24rpx;
}

.litter__stat-label {
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
}

.litter__section {
  margin: 16rpx 32rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
}

.litter__section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.litter__section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.litter__add-btn {
  font-size: 26rpx;
  color: #007AFF;
}

.litter__puppy {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.litter__puppy:last-child {
  border-bottom: none;
}

.litter__puppy-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: #fff;
  flex-shrink: 0;
}

.litter__puppy-avatar--母 {
  background: #FF6B81;
}

.litter__puppy-avatar--公 {
  background: #54A0FF;
}

.litter__puppy-info {
  flex: 1;
}

.litter__puppy-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  display: block;
}

.litter__puppy-meta {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
}

.litter__puppy-arrow {
  font-size: 32rpx;
  color: #ccc;
}

.litter__empty {
  text-align: center;
  padding: 40rpx;
  color: #999;
  font-size: 28rpx;
}

.litter__actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 32rpx;
  background: #fff;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
}

.litter__btn {
  width: 100%;
  height: 80rpx;
  border-radius: 40rpx;
  background: #4CAF50;
  color: #fff;
  font-size: 28rpx;
}
</style>
