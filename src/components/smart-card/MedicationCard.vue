<!--
  MedicationCard — 每日用药卡片
  设计稿：home-v1-final.html Card 5 (bar-plum, 每日用药)
  左色条(紫) + 图标 + 进度(第X天/共N天) + checkbox 列表 + 进度条 + 批量按钮
-->
<template>
  <view class="card card--plum">
    <view class="card-header">
      <view class="card-icon card-icon--plum">
        <text style="font-size: 20px;">💊</text>
      </view>
      <view class="card-title-area">
        <text class="card-name">每日用药</text>
        <text class="card-sub">{{ card.dogs?.length || 0 }}只犬需喂药</text>
      </view>
      <!-- 分数角标 -->
      <view v-if="card.progress" class="fraction-badge">
        <text class="fraction-badge-text">{{ pendingCount }}/{{ card.progress.total }}</text>
      </view>
    </view>

    <!-- 进度信息 -->
    <view v-if="card.progress" class="progress-info">
      <text class="progress-label">第{{ card.progress.done + 1 }}天 / 共{{ card.progress.total }}天</text>
    </view>

    <!-- 进度条 -->
    <view v-if="card.progress" class="progress-area">
      <view class="progress-track">
        <view class="progress-fill" :style="{ width: progressPct + '%' }" />
      </view>
    </view>

    <!-- 用药犬只 checkbox 列表 -->
    <view class="checkbox-list">
      <view
        v-for="dog in card.dogs"
        :key="dog.dogId"
        class="checkbox-item"
      >
        <view class="cb-box cb-box--empty">
        </view>
        <text class="cb-label">{{ dog.dogName }}</text>
        <text class="cb-drug">{{ dog.drugName }}</text>
      </view>
    </view>

    <!-- 批量标记按钮 -->
    <view class="card-actions">
      <view class="btn btn--filled btn--plum" @click="batchComplete">
        <text class="btn-text btn-text--white">批量标记今日已完成</text>
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
}>()

const pendingCount = computed(() => (props.card.progress?.total || 0) - (props.card.progress?.done || 0))
const progressPct = computed(() => {
  if (!props.card.progress) return 0
  return Math.round((props.card.progress.done / props.card.progress.total) * 100)
})

function batchComplete() {
  const taskIds = props.card.tasks.map((t: any) => t._id)
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
  &--plum { border-left-color: var(--plum); &::before { background: linear-gradient(135deg, var(--plum-soft) 0%, transparent 40%); } }
}

.card-header { display: flex; align-items: flex-start; gap: 12px; }
.card-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; &--plum { background: var(--icon-plum); } }
.card-title-area { flex: 1; }
.card-name { display: block; font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text-1); }
.card-sub { display: block; font-size: 12px; color: var(--text-2); margin-top: 1px; }

.fraction-badge { background: var(--primary-soft); padding: 3px 10px; border-radius: 999px; }
.fraction-badge-text { font-family: var(--font-display); font-size: 13px; font-weight: 800; color: var(--primary); }

/* 进度信息 */
.progress-info { margin-top: 10px; }
.progress-label { font-family: var(--font-display); font-size: 12px; font-weight: 800; color: var(--plum); }

/* 进度条 */
.progress-area { margin-top: 6px; }
.progress-track { height: 5px; background: var(--card-dim); border-radius: 999px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--plum), var(--rose)); transition: width 0.6s ease; }

/* Checkbox 列表 */
.checkbox-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.checkbox-item { display: flex; align-items: center; gap: 8px; }
.cb-box {
  width: 18px; height: 18px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: transform 0.15s ease; &:active { transform: scale(0.85); }
  &--done { background: var(--green); }
  &--empty { border: 2px solid var(--text-4); background: transparent; }
}
.cb-label { font-size: 12px; font-weight: 600; color: var(--text-1); flex: 1; }
.cb-drug { font-size: 11px; color: var(--text-3); }

.card-actions { display: flex; gap: 8px; margin-top: 14px; }
.btn {
  padding: 8px 18px; border-radius: 999px; border: none; flex: 1;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
  &--filled.btn--plum { background: var(--plum); }
}
.btn-text { font-family: var(--font-display); font-size: 13px; font-weight: 700; &--white { color: #FFFFFF; } }
</style>
