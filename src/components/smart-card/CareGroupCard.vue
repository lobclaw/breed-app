<!--
  CareGroupCard — 状态群组卡片
  设计稿：home-v1-final.html Card 2 (bar-rose, 孕期护理)
  左色条 + 图标 + 群组标题 + 犬只行列表 + 批量完成按钮
-->
<template>
  <view class="card" :class="card.priority === 'overdue' ? 'card--red' : 'card--rose'">
    <view class="card-header">
      <view class="card-icon" :class="card.priority === 'overdue' ? 'card-icon--red' : 'card-icon--rose'">
        <text style="font-size: 20px;">🤰</text>
      </view>
      <view class="card-title-area">
        <text class="card-name">{{ card.groupTitle }} · {{ card.dogs?.length || 0 }}只</text>
        <text class="card-sub">{{ card.tasks?.[0]?.title || '' }}</text>
      </view>
    </view>

    <!-- 犬只行列表 -->
    <view class="group-items">
      <view v-for="dog in card.dogs" :key="dog.dogId" class="group-item">
        <text class="group-item-name">{{ dog.dogName }}</text>
        <text class="group-item-status" :class="statusClass(dog)">{{ dog.statusLabel || '' }}</text>
      </view>
    </view>

    <!-- 批量完成按钮 -->
    <view v-if="!acting" class="card-actions">
      <view class="btn btn--filled btn--primary" @click="batchComplete">
        <text class="btn-text btn-text--white">批量标记今日已完成</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ card: any }>()
const emit = defineEmits<{
  (e: 'complete', taskId: string): void
  (e: 'batch-complete', taskIds: string[]): void
}>()

const acting = ref(false)

function batchComplete() {
  if (acting.value) return
  acting.value = true
  const taskIds = props.card.tasks.map((t: any) => t._id)
  emit('batch-complete', taskIds)
}

function statusClass(dog: any) {
  if (dog.statusLabel?.includes('预产期')) return 'group-item-status--amber'
  return 'group-item-status--rose'
}
</script>

<style lang="scss" scoped>
.card {
  position: relative;
  background: var(--card);
  border-radius: 16px;
  padding: 16px 16px 16px 18px;
  border-left: 3.5px solid transparent;
  box-shadow: var(--shadow);
  overflow: hidden;
  /* 群组卡片整体不可点击，不加按压反馈 */

  &::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; }
  > * { position: relative; z-index: 1; }

  &--rose { border-left-color: var(--rose); &::before { background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%); } }
}

.card-header { display: flex; align-items: flex-start; gap: 12px; }
.card-icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  &--rose { background: var(--icon-rose); }
}
.card-title-area { flex: 1; }
.card-name { display: block; font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text-1); }
.card-sub { display: block; font-size: 12px; color: var(--text-2); margin-top: 1px; }

/* 群组行 — 一比一还原 .group-items/.group-item */
.group-items { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.group-item {
  display: flex; justify-content: space-between; align-items: center;
  background: var(--card-dim); border-radius: 14px; padding: 10px 14px;
  transition: filter 0.12s ease;
  &:active { filter: brightness(0.97); }
}
.group-item-name { font-size: 13px; font-weight: 600; color: var(--text-1); }
.group-item-status {
  font-size: 12px; font-weight: 600;
  &--rose { color: var(--rose); }
  &--amber { color: var(--amber); }
}

.card-actions { display: flex; gap: 8px; margin-top: 14px; }
.btn {
  padding: 8px 18px; border-radius: 999px; border: none;
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
  &--filled.btn--primary { background: var(--primary); }
}
.btn-text { font-family: var(--font-display); font-size: 13px; font-weight: 700; &--white { color: #FFFFFF; } }
</style>
