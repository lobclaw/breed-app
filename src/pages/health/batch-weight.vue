<template>
  <view class="batch-weight">
    <!-- 选择窝 -->
    <view class="batch-weight__section" v-if="!selectedLitter">
      <text class="batch-weight__title">选择窝次</text>
      <view v-for="litter in litters" :key="litter._id" class="batch-weight__litter" @click="selectLitter(litter)">
        <text class="batch-weight__litter-name">{{ litter.dam_name }}窝</text>
        <text class="batch-weight__litter-info">{{ litter.puppies?.length || 0 }}只幼崽</text>
      </view>
      <view v-if="litters.length === 0 && !loading" class="batch-weight__empty">
        <text>暂无未断奶的窝</text>
      </view>
    </view>

    <!-- 录入体重 -->
    <view class="batch-weight__section" v-if="selectedLitter">
      <view class="batch-weight__header">
        <text class="batch-weight__title">{{ selectedLitter.dam_name }}窝 · 体重录入</text>
        <text class="batch-weight__back" @click="selectedLitter = null">换一窝</text>
      </view>

      <view class="batch-weight__date">
        <text class="batch-weight__label">日期</text>
        <picker mode="date" :value="dateStr" @change="onDateChange">
          <text class="batch-weight__picker">{{ dateStr }}</text>
        </picker>
      </view>

      <view v-for="(puppy, idx) in puppies" :key="puppy._id" class="batch-weight__puppy">
        <text class="batch-weight__puppy-name">{{ puppy.name }}</text>
        <input
          v-model="weights[idx]"
          class="batch-weight__puppy-input"
          type="digit"
          placeholder="克"
        />
        <text class="batch-weight__unit">g</text>
      </view>

      <button class="batch-weight__submit" :loading="submitting" :disabled="!hasAnyWeight" @click="submit">
        保存体重
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'

const litters = ref<any[]>([])
const loading = ref(true)
const selectedLitter = ref<any>(null)
const puppies = ref<any[]>([])
const weights = ref<string[]>([])
const submitting = ref(false)
const weightDate = ref(Date.now())

const dateStr = computed(() => {
  const d = new Date(weightDate.value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const hasAnyWeight = computed(() => weights.value.some(w => parseFloat(w) > 0))

function onDateChange(e: any) {
  weightDate.value = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
}

const { run: fetchLitters } = useCloudCall<{ data: any[] }>('breeding-service', 'getActiveLitters')
const { run: batchAdd } = useCloudCall('health-service', 'batchAddWeights', { successMessage: '已保存', showLoading: true })

function selectLitter(litter: any) {
  selectedLitter.value = litter
  puppies.value = litter.puppies || []
  weights.value = puppies.value.map(() => '')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  weightDate.value = today.getTime()
}

async function loadLitters() {
  loading.value = true
  const res = await fetchLitters()
  if (res?.data) litters.value = res.data
  loading.value = false
}

async function submit() {
  if (!selectedLitter.value) return
  submitting.value = true

  const weightEntries = puppies.value
    .map((p: any, idx: number) => ({
      dog_id: p._id,
      weight: parseFloat(weights.value[idx]),
      date: weightDate.value,
    }))
    .filter(e => e.weight > 0)

  try {
    const res = await batchAdd(selectedLitter.value._id, weightEntries)
    if (res) {
      weights.value = puppies.value.map(() => '')
      uni.showToast({ title: `已保存${weightEntries.length}条`, icon: 'success' })
    }
  } finally {
    submitting.value = false
  }
}

onShow(() => loadLitters())
</script>

<style scoped>
.batch-weight { min-height: 100vh; background: #f5f5f5; }
.batch-weight__section { background: #fff; margin: 16rpx 32rpx; border-radius: 16rpx; padding: 24rpx; }
.batch-weight__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.batch-weight__title { font-size: 32rpx; font-weight: 700; color: #333; display: block; margin-bottom: 16rpx; }
.batch-weight__back { font-size: 26rpx; color: #007AFF; }
.batch-weight__litter { display: flex; justify-content: space-between; padding: 20rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.batch-weight__litter:last-child { border-bottom: none; }
.batch-weight__litter-name { font-size: 30rpx; color: #333; font-weight: 500; }
.batch-weight__litter-info { font-size: 26rpx; color: #999; }
.batch-weight__empty { text-align: center; padding: 40rpx; color: #999; font-size: 28rpx; }
.batch-weight__date { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid #f5f5f5; margin-bottom: 16rpx; }
.batch-weight__label { font-size: 28rpx; color: #333; }
.batch-weight__picker { font-size: 28rpx; color: #007AFF; }
.batch-weight__puppy { display: flex; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid #f5f5f5; gap: 16rpx; }
.batch-weight__puppy-name { font-size: 28rpx; color: #333; width: 150rpx; }
.batch-weight__puppy-input { flex: 1; font-size: 32rpx; font-weight: 600; color: #333; text-align: right; }
.batch-weight__unit { font-size: 26rpx; color: #999; }
.batch-weight__submit { margin-top: 24rpx; width: 100%; height: 88rpx; border-radius: 44rpx; background: #007AFF; color: #fff; font-size: 32rpx; }
.batch-weight__submit[disabled] { opacity: 0.5; }
</style>
