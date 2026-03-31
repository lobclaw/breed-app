<template>
  <!-- 智能卡片壳：根据 card.cardType 分发到具体卡片 -->
  <view class="smart-card-wrap" :class="{ 'smart-card--completing': completing, 'smart-card--overdue': card.priority === 'overdue' }">
  <!-- 逾期标记 -->
  <view v-if="card.priority === 'overdue' && card.overdueDays" class="overdue-badge">
    <text class="material-icons-round overdue-badge-icon">schedule</text>
    <text class="overdue-badge-text">逾期{{ card.overdueDays }}天</text>
  </view>
  <DogCard v-if="card.cardType === 'dog'" :card="card" @complete="onComplete" @postpone="onPostpone" @action="onAction" />
  <CareGroupCard v-else-if="card.cardType === 'care_group'" :card="card" @complete="onComplete" @batch-complete="onBatchComplete" />
  <BatchCard v-else-if="card.cardType === 'batch'" :card="card" @complete="onComplete" @postpone="onPostpone" @batch-complete="onBatchComplete" />
  <MedicationCard v-else-if="card.cardType === 'health_attention' || card.cardType === 'medication'" :card="card" @complete="onComplete" @postpone="onPostpone" @batch-complete="onBatchComplete" @action="onAction" />
  </view>
</template>

<script setup lang="ts">
import DogCard from './DogCard.vue'
import CareGroupCard from './CareGroupCard.vue'
import BatchCard from './BatchCard.vue'
import MedicationCard from './MedicationCard.vue'

export interface SmartCardData {
  cardType: 'dog' | 'care_group' | 'batch' | 'medication' | 'health_attention'
  id: string
  priority: 'overdue' | 'today' | 'upcoming'
  overdueDays?: number
  tasks: any[]
  dogName?: string
  dogId?: string
  statusLabel?: string
  groupTitle?: string
  dogs?: any[]
  progress?: { done: number; total: number }
  [key: string]: any
}

defineProps<{
  card: SmartCardData
  completing?: boolean
}>()

const emit = defineEmits<{
  (e: 'complete', taskId: string, mode?: boolean | string): void
  (e: 'postpone', taskIds: string | string[], title?: string): void
  (e: 'batch-complete', taskIds: string[]): void
  (e: 'action', payload: { type: string; data: any }): void
}>()

function onComplete(taskId: string, mode?: boolean | string) { emit('complete', taskId, mode) }
function onPostpone(taskIds: string | string[], title?: string) { emit('postpone', taskIds, title) }
function onBatchComplete(taskIds: string[]) { emit('batch-complete', taskIds) }
function onAction(payload: { type: string; data: any }) { emit('action', payload) }
</script>

<style lang="scss" scoped>
.smart-card-wrap {
  transform: translateX(0) scale(1);
  opacity: 1;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.3s ease;
}

.smart-card--completing {
  transform: translateX(-30%) scale(0.9);
  opacity: 0;
  pointer-events: none;
}

.smart-card--overdue {
  :deep(.card) {
    border-left: 3px solid var(--red);
  }
}

.overdue-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px 0;
}
.overdue-badge-icon {
  font-size: 13px;
  color: var(--red);
}
.overdue-badge-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--red);
}
</style>
