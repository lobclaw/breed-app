<!--
  DogCard — 个体犬只卡片
  设计稿：home-v1-final.html Card 1 (bar-red/green)
  左色条 + 渐变色晕 + 图标 + 犬名 + 状态标签 + 操作按钮
-->
<template>
  <view class="card" :class="`card--${barColor}`" @click="$emit('action', { type: 'viewDog', data: { dogId: card.dogId } })">
    <!-- 头部：图标 + 名称区 -->
    <view class="card-header">
      <view class="card-icon" :class="`card-icon--${barColor}`">
        <text style="font-size: 20px;">🐩</text>
      </view>
      <view class="card-title-area">
        <text class="card-name">{{ card.dogName }}</text>
        <text class="card-sub">{{ card.breed || '马尔济斯' }}<text v-if="card.statusLabel"> · {{ card.statusLabel }}</text></text>
      </view>
    </view>

    <!-- 状态标签 -->
    <view v-if="card.tasks?.length" class="tags">
      <view
        v-for="task in visibleTasks"
        :key="task._id"
        class="tag"
        :class="`tag--${taskColor(task)}`"
      >
        <text class="tag-text">{{ task.title }}</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="card-actions">
      <view class="btn btn--filled" :class="`btn--${barColor}`" @click.stop="$emit('complete', visibleTasks[0]?._id)">
        <text class="btn-text btn-text--white">{{ mainBtnText }}</text>
      </view>
      <view v-if="card.priority === 'overdue'" class="btn btn--ghost" @click.stop="$emit('postpone', visibleTasks[0]?._id)">
        <text class="btn-text btn-text--ghost">推迟</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ card: any }>()
defineEmits<{
  (e: 'complete', taskId: string): void
  (e: 'postpone', taskId: string): void
  (e: 'action', payload: { type: string; data: any }): void
}>()

const visibleTasks = computed(() => (props.card.tasks || []).slice(0, 3))

const barColor = computed(() => {
  if (props.card.priority === 'overdue') return 'red'
  return 'green'
})

const mainBtnText = computed(() => {
  const task = visibleTasks.value[0]
  if (!task) return '查看'
  if (props.card.priority === 'overdue') return '去处理'
  return '记录'
})

function taskColor(task: any) {
  if (task.priority === 'overdue') return 'red'
  if (task.type === 'vaccination' || task.type === 'deworming') return 'amber'
  return 'green'
}
</script>

<style lang="scss" scoped>
/* 卡片基础 — 一比一还原 home-v1-final.html .card */
.card {
  position: relative;
  background: var(--card);
  border-radius: 16px;
  padding: 16px 16px 16px 18px;
  border-left: 3.5px solid transparent;
  box-shadow: var(--shadow);
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:active { transform: scale(0.975); }

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none;
    z-index: 0;
  }
  > * { position: relative; z-index: 1; }

  &--red { border-left-color: var(--red); &::before { background: linear-gradient(135deg, var(--red-soft) 0%, transparent 40%); } }
  &--green { border-left-color: var(--green); &::before { background: linear-gradient(135deg, var(--green-soft) 0%, transparent 40%); } }
  &--amber { border-left-color: var(--amber); &::before { background: linear-gradient(135deg, var(--amber-soft) 0%, transparent 40%); } }
  &--rose { border-left-color: var(--rose); &::before { background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%); } }
}

.card-header { display: flex; align-items: flex-start; gap: 12px; }
.card-icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  &--red { background: var(--icon-red); }
  &--green { background: var(--icon-green); }
  &--amber { background: var(--icon-amber); }
  &--rose { background: var(--icon-rose); }
}
.card-title-area { flex: 1; min-width: 0; }
.card-name { display: block; font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text-1); line-height: 1.3; }
.card-sub { display: block; font-size: 12px; color: var(--text-2); margin-top: 1px; }

.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.tag {
  font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px;
  &--red { background: var(--red-soft); .tag-text { color: var(--red); } }
  &--amber { background: var(--amber-soft); .tag-text { color: var(--amber); } }
  &--green { background: var(--green-soft); .tag-text { color: var(--green); } }
  &--rose { background: var(--rose-soft); .tag-text { color: var(--rose); } }
}
.tag-text { font-size: 11px; font-weight: 600; }

.card-actions { display: flex; gap: 8px; margin-top: 14px; }
.btn {
  padding: 8px 18px; border-radius: 999px; border: none;
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
  &--filled { &.btn--red { background: var(--red); } &.btn--green { background: var(--green); } &.btn--amber { background: var(--amber); } &.btn--rose { background: var(--rose); } }
  &--ghost { background: transparent; border: 1.5px solid var(--text-4); }
}
.btn-text {
  font-family: var(--font-display); font-size: 13px; font-weight: 700;
  &--white { color: #FFFFFF; }
  &--ghost { color: var(--text-2); }
}
</style>
