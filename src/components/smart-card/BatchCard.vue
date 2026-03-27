<template>
  <view class="batch-card" :class="`batch-card--${card.priority}`">
    <view class="batch-card__header">
      <text class="batch-card__title">{{ card.groupTitle }}</text>
      <text class="batch-card__progress" v-if="card.progress">{{ card.progress.done }}/{{ card.progress.total }}只已完成</text>
    </view>

    <!-- 犬只进度列表（最多12只） -->
    <view class="batch-card__dogs">
      <view v-for="dog in visibleDogs" :key="dog.dogId" class="batch-card__dog" :class="{ 'batch-card__dog--done': dog.completed }">
        <text class="batch-card__dog-check">{{ dog.completed ? '✅' : '⬜' }}</text>
        <text class="batch-card__dog-name">{{ dog.dogName }}</text>
      </view>
      <text v-if="(card.dogs?.length || 0) > 12" class="batch-card__more">还有{{ card.dogs.length - 12 }}只</text>
    </view>

    <!-- 操作 -->
    <view class="batch-card__actions">
      <button size="mini" type="primary" class="batch-card__btn" @click="batchComplete">
        批量处理{{ pendingCount > 0 ? `剩余${pendingCount}只` : '全部' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  card: any
}>()

const emit = defineEmits<{
  (e: 'complete', taskId: string): void
  (e: 'batch-complete', taskIds: string[]): void
}>()

const visibleDogs = computed(() => (props.card.dogs || []).slice(0, 12))
const pendingCount = computed(() => {
  const total = props.card.progress?.total || 0
  const done = props.card.progress?.done || 0
  return total - done
})

function batchComplete() {
  const pendingTaskIds = props.card.tasks
    .filter((t: any) => t.status === 'pending')
    .map((t: any) => t._id)
  emit('batch-complete', pendingTaskIds)
}
</script>

<style scoped>
.batch-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; }
.batch-card--overdue { border-left: 6rpx solid #FF3B30; }
.batch-card--today { border-left: 6rpx solid #FF9500; }
.batch-card__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.batch-card__title { font-size: 30rpx; font-weight: 600; color: #333; }
.batch-card__progress { font-size: 24rpx; color: #999; }
.batch-card__dogs { display: flex; flex-wrap: wrap; gap: 8rpx; margin-bottom: 16rpx; }
.batch-card__dog { display: flex; align-items: center; gap: 4rpx; padding: 6rpx 12rpx; background: #f5f5f5; border-radius: 12rpx; }
.batch-card__dog--done { background: #E8F5E9; }
.batch-card__dog-check { font-size: 24rpx; }
.batch-card__dog-name { font-size: 24rpx; color: #333; }
.batch-card__more { font-size: 24rpx; color: #999; padding: 6rpx 12rpx; }
.batch-card__actions { margin-top: 8rpx; }
.batch-card__btn { width: 100%; font-size: 26rpx !important; }
</style>
