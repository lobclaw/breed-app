<template>
  <!-- 智能卡片壳：根据 card.cardType 分发到具体卡片 -->
  <DogCard v-if="card.cardType === 'dog'" :card="card" @complete="onComplete" @postpone="onPostpone" @action="onAction" />
  <CareGroupCard v-else-if="card.cardType === 'care_group'" :card="card" @complete="onComplete" @batch-complete="onBatchComplete" />
  <BatchCard v-else-if="card.cardType === 'batch'" :card="card" @complete="onComplete" @batch-complete="onBatchComplete" />
  <MedicationCard v-else-if="card.cardType === 'medication'" :card="card" @complete="onComplete" @batch-complete="onBatchComplete" />
</template>

<script setup lang="ts">
import DogCard from './DogCard.vue'
import CareGroupCard from './CareGroupCard.vue'
import BatchCard from './BatchCard.vue'
import MedicationCard from './MedicationCard.vue'

export interface SmartCardData {
  cardType: 'dog' | 'care_group' | 'batch' | 'medication'
  id: string
  priority: 'overdue' | 'today' | 'upcoming'
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
}>()

const emit = defineEmits<{
  (e: 'complete', taskId: string): void
  (e: 'postpone', taskId: string): void
  (e: 'batch-complete', taskIds: string[]): void
  (e: 'action', payload: { type: string; data: any }): void
}>()

function onComplete(taskId: string) { emit('complete', taskId) }
function onPostpone(taskId: string) { emit('postpone', taskId) }
function onBatchComplete(taskIds: string[]) { emit('batch-complete', taskIds) }
function onAction(payload: { type: string; data: any }) { emit('action', payload) }
</script>
