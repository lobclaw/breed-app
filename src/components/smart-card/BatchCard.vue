<!--
  BatchCard — 批量操作卡片
  设计稿：home-v1-final.html Card 4 (bar-blue, 月度驱虫)
  左色条(蓝) + 图标 + 标题 + checkbox 列表 + 进度条 + 批量按钮
-->
<template>
  <view class="card card--blue">
    <view class="card-header">
      <view class="card-icon card-icon--blue">
        <text style="font-size: 20px;">💉</text>
      </view>
      <view class="card-title-area">
        <text class="card-name">{{ card.groupTitle }}</text>
        <text class="card-sub">{{ card.dogs?.length || 0 }}只犬</text>
      </view>
      <!-- 分数角标 -->
      <view v-if="card.progress" class="fraction-badge">
        <text class="fraction-badge-text">{{ pendingCount }}/{{ card.progress.total }}</text>
      </view>
    </view>

    <!-- Checkbox 列表 -->
    <view class="checkbox-list">
      <view
        v-for="dog in visibleDogs"
        :key="dog.dogId"
        class="checkbox-item"
        :class="{ 'checkbox-item--checked': dog.completed }"
      >
        <view class="cb-box" :class="dog.completed ? 'cb-box--done' : 'cb-box--empty'">
          <text v-if="dog.completed" class="cb-check">✓</text>
        </view>
        <text class="cb-label">{{ dog.dogName }}</text>
      </view>
    </view>

    <!-- 进度条 -->
    <view v-if="card.progress" class="progress-area">
      <view class="progress-track">
        <view class="progress-fill" :style="{ width: progressPct + '%' }" />
      </view>
    </view>

    <!-- 批量操作按钮 -->
    <view class="card-actions">
      <view class="btn btn--filled btn--blue" @click="batchComplete">
        <text class="btn-text btn-text--white">{{ pendingCount > 0 ? `批量处理剩余${pendingCount}只` : '全部完成 ✓' }}</text>
      </view>
      <view class="btn btn--ghost" @click="$emit('action', { type: 'viewAll' })">
        <text class="btn-text btn-text--ghost">逐只查看</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ card: any }>()
const emit = defineEmits<{
  (e: 'complete', taskId: string): void
  (e: 'batch-complete', taskIds: string[]): void
  (e: 'action', payload: any): void
}>()

const visibleDogs = computed(() => (props.card.dogs || []).slice(0, 12))
const pendingCount = computed(() => (props.card.progress?.total || 0) - (props.card.progress?.done || 0))
const progressPct = computed(() => {
  if (!props.card.progress) return 0
  return Math.round((props.card.progress.done / props.card.progress.total) * 100)
})

function batchComplete() {
  const taskIds = props.card.tasks.filter((t: any) => t.status === 'pending').map((t: any) => t._id)
  emit('batch-complete', taskIds)
}
</script>

<style lang="scss" scoped>
.card {
  position: relative; background: var(--card); border-radius: 16px;
  padding: 16px 16px 16px 18px; border-left: 3.5px solid transparent;
  box-shadow: var(--shadow); overflow: hidden;
  transition: transform 0.15s ease; &:active { transform: scale(0.975); }
  &::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; }
  > * { position: relative; z-index: 1; }
  &--blue { border-left-color: var(--blue); &::before { background: linear-gradient(135deg, var(--blue-soft) 0%, transparent 40%); } }
}

.card-header { display: flex; align-items: flex-start; gap: 12px; }
.card-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; &--blue { background: var(--icon-blue); } }
.card-title-area { flex: 1; }
.card-name { display: block; font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text-1); }
.card-sub { display: block; font-size: 12px; color: var(--text-2); margin-top: 1px; }

/* 分数角标 */
.fraction-badge { background: var(--primary-soft); padding: 3px 10px; border-radius: 999px; }
.fraction-badge-text { font-family: var(--font-display); font-size: 13px; font-weight: 800; color: var(--primary); }

/* Checkbox 列表 */
.checkbox-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.checkbox-item { display: flex; align-items: center; gap: 5px; }
.checkbox-item--checked .cb-label { color: var(--text-3); text-decoration: line-through; }
.cb-box {
  width: 18px; height: 18px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: transform 0.15s ease; &:active { transform: scale(0.85); }
  &--done { background: var(--green); }
  &--empty { border: 2px solid var(--text-4); background: transparent; }
}
.cb-check { font-size: 10px; color: #FFFFFF; font-weight: 700; }
.cb-label { font-size: 12px; font-weight: 600; color: var(--text-1); }

/* 进度条 */
.progress-area { margin-top: 12px; }
.progress-track { height: 5px; background: var(--card-dim); border-radius: 999px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--primary), var(--amber)); transition: width 0.6s ease; }

.card-actions { display: flex; gap: 8px; margin-top: 14px; }
.btn {
  padding: 8px 18px; border-radius: 999px; border: none;
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
  &--filled.btn--blue { background: var(--blue); }
  &--ghost { background: transparent; border: 1.5px solid var(--text-4); }
}
.btn-text { font-family: var(--font-display); font-size: 13px; font-weight: 700; &--white { color: #FFFFFF; } &--ghost { color: var(--text-2); } }
</style>
