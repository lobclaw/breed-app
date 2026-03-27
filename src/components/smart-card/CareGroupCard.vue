<template>
  <view class="care-card" :class="`care-card--${card.priority}`">
    <view class="care-card__header">
      <text class="care-card__title">{{ card.groupTitle }}</text>
      <text class="care-card__count">{{ card.dogs?.length || 0 }}只</text>
    </view>

    <!-- 犬只列表 + 状态 -->
    <view v-for="dog in card.dogs" :key="dog.dogId" class="care-card__dog">
      <text class="care-card__dog-name">{{ dog.dogName }}</text>
      <text class="care-card__dog-status">{{ dog.statusLabel }}</text>
    </view>

    <!-- 批量完成按钮 -->
    <view class="care-card__actions">
      <button size="mini" type="primary" class="care-card__btn" @click="batchComplete">批量标记今日已完成</button>
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
.care-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; }
.care-card--overdue { border-left: 6rpx solid #FF3B30; }
.care-card--today { border-left: 6rpx solid #FF9500; }
.care-card__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.care-card__title { font-size: 30rpx; font-weight: 600; color: #333; }
.care-card__count { font-size: 24rpx; color: #999; }
.care-card__dog { display: flex; justify-content: space-between; align-items: center; padding: 10rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.care-card__dog:last-child { border-bottom: none; }
.care-card__dog-name { font-size: 28rpx; color: #333; }
.care-card__dog-status { font-size: 24rpx; color: #666; }
.care-card__actions { margin-top: 16rpx; }
.care-card__btn { width: 100%; font-size: 26rpx !important; }
</style>
