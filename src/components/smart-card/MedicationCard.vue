<template>
  <view class="med-card" :class="`med-card--${card.priority}`">
    <view class="med-card__header">
      <text class="med-card__title">💊 每日用药</text>
      <text class="med-card__day" v-if="card.progress">第{{ card.progress.done + 1 }}天/共{{ card.progress.total }}天</text>
    </view>

    <!-- 用药犬只列表 -->
    <view v-for="dog in card.dogs" :key="dog.dogId" class="med-card__dog">
      <text class="med-card__dog-name">{{ dog.dogName }}</text>
      <text class="med-card__drug-name">{{ dog.drugName }}</text>
    </view>

    <!-- 批量标记 -->
    <view class="med-card__actions">
      <button size="mini" type="primary" class="med-card__btn" @click="batchComplete">批量标记今日已完成</button>
    </view>
  </view>
</template>

<script setup lang="ts">
const props = defineProps<{
  card: any
}>()

const emit = defineEmits<{
  (e: 'complete', taskId: string): void
  (e: 'batch-complete', taskIds: string[]): void
}>()

function batchComplete() {
  const taskIds = props.card.tasks.map((t: any) => t._id)
  emit('batch-complete', taskIds)
}
</script>

<style scoped>
.med-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; }
.med-card--overdue { border-left: 6rpx solid #FF3B30; }
.med-card--today { border-left: 6rpx solid #FF9500; }
.med-card__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.med-card__title { font-size: 30rpx; font-weight: 600; color: #333; }
.med-card__day { font-size: 24rpx; color: #007AFF; background: #E3F2FD; padding: 4rpx 16rpx; border-radius: 8rpx; }
.med-card__dog { display: flex; justify-content: space-between; align-items: center; padding: 10rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.med-card__dog:last-child { border-bottom: none; }
.med-card__dog-name { font-size: 28rpx; color: #333; font-weight: 500; }
.med-card__drug-name { font-size: 24rpx; color: #666; }
.med-card__actions { margin-top: 16rpx; }
.med-card__btn { width: 100%; font-size: 26rpx !important; }
</style>
