<template>
  <view class="dog-card" :class="`dog-card--${card.priority}`">
    <!-- 头部：犬只名 + 状态 -->
    <view class="dog-card__header">
      <view class="dog-card__name-wrap">
        <text class="dog-card__name">{{ card.dogName }}</text>
        <text v-if="card.statusLabel" class="dog-card__status">{{ card.statusLabel }}</text>
      </view>
      <text v-if="card.priority === 'overdue'" class="dog-card__badge dog-card__badge--overdue">逾期</text>
    </view>

    <!-- 任务列表（最多3个） -->
    <view v-for="(task, idx) in visibleTasks" :key="task._id" class="dog-card__task">
      <view class="dog-card__task-row">
        <text class="dog-card__task-icon" :class="taskIconClass(task)">{{ taskIcon(task) }}</text>
        <text class="dog-card__task-title">{{ task.title }}</text>
      </view>
      <view class="dog-card__task-actions">
        <button size="mini" type="primary" class="dog-card__btn" @click="$emit('complete', task._id)">完成</button>
        <button v-if="card.priority === 'overdue'" size="mini" class="dog-card__btn dog-card__btn--secondary" @click="$emit('postpone', task._id)">推迟</button>
      </view>
    </view>

    <!-- 更多任务 -->
    <view v-if="card.tasks.length > 3" class="dog-card__more">
      <text class="dog-card__more-text" @click="$emit('action', { type: 'viewDog', data: { dogId: card.dogId } })">
        还有{{ card.tasks.length - 3 }}项
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  card: any
}>()

defineEmits<{
  (e: 'complete', taskId: string): void
  (e: 'postpone', taskId: string): void
  (e: 'action', payload: { type: string; data: any }): void
}>()

const visibleTasks = computed(() => props.card.tasks.slice(0, 3))

function taskIcon(task: any) {
  const icons: Record<string, string> = {
    vaccination: '💉',
    deworming: '💊',
    breeding_milestone: '🐾',
    medication_daily: '💊',
    care_group: '🏥',
  }
  return icons[task.type] || '📋'
}

function taskIconClass(task: any) {
  if (task.priority === 'overdue' || task.postpone_count >= 3) return 'dog-card__task-icon--overdue'
  return ''
}
</script>

<style scoped>
.dog-card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 16rpx; }
.dog-card--overdue { border-left: 6rpx solid #FF3B30; }
.dog-card--today { border-left: 6rpx solid #FF9500; }
.dog-card--upcoming { opacity: 0.85; }
.dog-card__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.dog-card__name-wrap { display: flex; align-items: center; gap: 12rpx; }
.dog-card__name { font-size: 32rpx; font-weight: 700; color: #333; }
.dog-card__status { font-size: 22rpx; color: #666; background: #f0f0f0; padding: 4rpx 12rpx; border-radius: 8rpx; }
.dog-card__badge--overdue { font-size: 22rpx; color: #FF3B30; background: #FFF0F0; padding: 4rpx 12rpx; border-radius: 8rpx; }
.dog-card__task { padding: 12rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.dog-card__task:last-child { border-bottom: none; }
.dog-card__task-row { display: flex; align-items: center; gap: 8rpx; margin-bottom: 8rpx; }
.dog-card__task-icon { font-size: 28rpx; }
.dog-card__task-icon--overdue { filter: saturate(2); }
.dog-card__task-title { font-size: 28rpx; color: #333; flex: 1; }
.dog-card__task-actions { display: flex; gap: 12rpx; }
.dog-card__btn { min-height: 52rpx !important; font-size: 24rpx !important; padding: 0 20rpx !important; }
.dog-card__btn--secondary { background: #f5f5f5 !important; color: #666 !important; }
.dog-card__more { padding-top: 12rpx; text-align: center; }
.dog-card__more-text { font-size: 24rpx; color: #007AFF; }
</style>
