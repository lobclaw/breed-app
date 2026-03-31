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

    <!-- 任务标签（可点击跳转录入） -->
    <view v-if="card.tasks?.length" class="tags">
      <view
        v-for="task in visibleTasks"
        :key="task._id"
        class="tag tag--clickable"
        :class="`tag--${taskColor(task)}`"
        @click.stop="goRecordTask(task)"
      >
        <text class="tag-text">{{ task.title }}</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="card-actions">
      <view class="btn btn--ghost-green" @click.stop="$emit('complete', visibleTasks[0]?._id)">
        <text class="btn-text btn-text--green">完成</text>
      </view>
      <view class="btn btn--ghost" @click.stop="$emit('postpone', visibleTasks[0]?._id)">
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

const typeMap: Record<string, string> = {
  vaccination: '/pages/record/health-vaccination',
  deworming: '/pages/record/health-deworming',
  illness: '/pages/record/health-illness',
  heat: '/pages/record/breeding-heat',
  follicle_check: '/pages/record/breeding-follicle',
  mating: '/pages/record/breeding-mating',
  pregnancy_check: '/pages/record/breeding-pregnancy',
  prenatal_check: '/pages/record/breeding-prenatal',
  pre_labor: '/pages/record/breeding-prelabor',
  breeding_milestone: '/pages/record/breeding-heat',
}

function goRecordTask(task: any) {
  if (!task) return
  const params: string[] = []
  if (props.card.dogId) params.push(`dogId=${props.card.dogId}`)
  if (task._id) params.push(`taskId=${task._id}`)
  const url = typeMap[task.type] || '/pages/record/health-vaccination'
  uni.navigateTo({ url: url + '?' + params.join('&') })
}

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
  font-size: 11px; font-weight: 700; padding: 6px 14px; border-radius: 999px;
  &--red { background: var(--red-soft); box-shadow: 0 1px 4px rgba(224, 82, 82, 0.2); .tag-text { color: var(--red); } }
  &--amber { background: var(--amber-soft); box-shadow: 0 1px 4px rgba(232, 155, 62, 0.2); .tag-text { color: var(--amber); } }
  &--green { background: var(--green-soft); box-shadow: 0 1px 4px rgba(61, 174, 111, 0.2); .tag-text { color: var(--green); } }
  &--rose { background: var(--rose-soft); box-shadow: 0 1px 4px rgba(234, 62, 119, 0.2); .tag-text { color: var(--rose); } }
  &--clickable {
    transition: transform 0.12s ease, box-shadow 0.12s ease;
    &:active { transform: scale(0.9); box-shadow: none; }
  }
}
.tag-text { font-size: 11px; font-weight: 600; }

.card-actions { display: flex; gap: 8px; margin-top: 14px; }
.btn {
  padding: 8px 18px; border-radius: 999px; border: none;
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
  &--filled { &.btn--red { background: var(--red); } &.btn--green { background: var(--green); } &.btn--amber { background: var(--amber); } &.btn--rose { background: var(--rose); } }
  &--ghost { background: transparent; border: 1.5px solid var(--text-4); }
  &--ghost-green { background: transparent; border: 1.5px solid var(--green); }
}
.btn-text {
  font-family: var(--font-display); font-size: 13px; font-weight: 700;
  &--white { color: #FFFFFF; }
  &--ghost { color: var(--text-2); }
  &--green { color: var(--green); }
}
</style>
