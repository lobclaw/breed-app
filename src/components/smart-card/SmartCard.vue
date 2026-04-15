<template>
  <!-- 智能卡片壳：根据 card.cardType 分发到具体卡片 -->
  <view class="smart-card-wrap" :class="{ 'smart-card--completing': completing, 'smart-card--completed': completed, 'smart-card--overdue': card.priority === 'overdue' }">
  <!-- 逾期标记 -->
  <view v-if="card.priority === 'overdue' && card.overdueDays" class="overdue-badge">
    <text class="material-icons-round overdue-badge-icon">schedule</text>
    <text class="overdue-badge-text">逾期{{ card.overdueDays }}天</text>
  </view>
  <DogCard v-if="card.cardType === 'dog'" :card="card" @complete="onComplete" @postpone="onPostpone" @action="onAction" />
  <CareGroupCard v-else-if="card.cardType === 'care_group'" :card="card" @complete="onComplete" @batch-complete="onBatchComplete" />
  <BatchCard v-else-if="card.cardType === 'batch'" :card="card" @complete="onComplete" @postpone="onPostpone" @batch-complete="onBatchComplete" @batch-skip="onBatchSkip" />
  <MedicationCard v-else-if="card.cardType === 'health_attention' || card.cardType === 'medication'" :card="card" @complete="onComplete" @batch-complete-med="onBatchCompleteMed" @action="onAction" @record-dose="onRecordDose" />
  <SickObservationCard v-else-if="card.cardType === 'sick_observation'" :card="card" @action="onAction" />
  </view>
</template>

<script setup lang="ts">
import DogCard from './DogCard.vue'
import CareGroupCard from './CareGroupCard.vue'
import BatchCard from './BatchCard.vue'
import MedicationCard from './MedicationCard.vue'
import SickObservationCard from './SickObservationCard.vue'

export interface SmartCardData {
  cardType: 'dog' | 'care_group' | 'batch' | 'medication' | 'health_attention' | 'sick_observation'
  domain?: 'breeding' | 'health' | 'medication'
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
  completed?: boolean
}>()

const emit = defineEmits<{
  (e: 'complete', taskId: string, mode?: boolean | string): void
  (e: 'postpone', taskIds: string | string[], title?: string): void
  (e: 'batch-complete', payload: { taskIds: string[]; autoRecord?: boolean } | string[]): void
  (e: 'batch-skip', taskIds: string[]): void
  (e: 'batch-complete-med', medicationTaskIds: string[]): void
  (e: 'action', payload: { type: string; data: any }): void
  (e: 'record-dose', payload: { medicationTaskId: string }): void
}>()

function onComplete(taskId: string, mode?: boolean | string) { emit('complete', taskId, mode) }
function onPostpone(taskIds: string | string[], title?: string) { emit('postpone', taskIds, title) }
function onBatchComplete(payload: { taskIds: string[]; autoRecord?: boolean } | string[]) { emit('batch-complete', payload) }
function onBatchSkip(taskIds: string[]) { emit('batch-skip', taskIds) }
function onBatchCompleteMed(medIds: string[]) { emit('batch-complete-med', medIds) }
function onAction(payload: { type: string; data: any }) { emit('action', payload) }
function onRecordDose(payload: { medicationTaskId: string }) { emit('record-dose', payload) }
</script>

<style lang="scss" scoped>
.smart-card-wrap {
  position: relative;
  transform: translateX(0) scale(1);
  opacity: 1;
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.22s ease;
}

.smart-card--completing {
  transform: translateX(-14%) scale(0.985);
  opacity: 0;
  pointer-events: none;
}

.smart-card--completed {
  pointer-events: none;
  animation: card-done-bounce 0.2s ease-out forwards;
}

@keyframes card-done-bounce {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.008); }
  100% { transform: scale(1); }
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
