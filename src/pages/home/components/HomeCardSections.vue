<template>
  <scroll-view scroll-y scroll-with-animation class="card-area" :scroll-top="scrollTop" @scroll="$emit('scroll', $event)">
    <template v-if="viewMode === 'today'">
      <view v-if="cards.length > 0" id="section-today">
        <HomeSectionList
          :sections="todaySections"
          :focused-home-card-id="focusedHomeCardId"
          :completing-card-ids="completingCardIds"
          :completed-card-ids="completedCardIds"
          @complete="(...args) => $emit('complete', ...args)"
          @postpone="(...args) => $emit('postpone', ...args)"
          @batch-complete="$emit('batch-complete', $event)"
          @batch-skip="$emit('batch-skip', $event)"
          @batch-complete-med="$emit('batch-complete-med', $event)"
          @action="$emit('action', $event)"
          @record-dose="$emit('record-dose', $event)"
        />
      </view>
      <BEmpty v-if="!loading && cards.length === 0" icon="pets" title="犬群一切正常" description="暂无待办事项" />
    </template>

    <template v-else>
      <view v-if="dayCards.length > 0">
        <view class="section-label">
          <view class="section-dot" style="background: var(--blue);" />
          <text class="section-text">{{ formatFullDate(selectedDate) }}</text>
          <view class="section-badge"><text class="section-badge-text">{{ dayCards.length }}</text></view>
        </view>
        <HomeSectionList
          :sections="daySections"
          nested-label
          :focused-home-card-id="focusedHomeCardId"
          :completing-card-ids="completingCardIds"
          :completed-card-ids="completedCardIds"
          @complete="(...args) => $emit('complete', ...args)"
          @postpone="(...args) => $emit('postpone', ...args)"
          @batch-complete="$emit('batch-complete', $event)"
          @batch-skip="$emit('batch-skip', $event)"
          @batch-complete-med="$emit('batch-complete-med', $event)"
          @action="$emit('action', $event)"
          @record-dose="$emit('record-dose', $event)"
        />
      </view>
      <BEmpty v-if="!loading && dayCards.length === 0" icon="event_available" :title="formatFullDate(selectedDate)" description="当天没有待办事项" />
    </template>

    <view v-if="loading" class="card-feed">
      <BSkeleton :rows="3" />
    </view>
  </scroll-view>
</template>

<script setup lang="ts">
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import HomeSectionList from './HomeSectionList.vue'

type HomeSection = {
  key: string
  title: string
  dotColor: string
  cards: any[]
  groups?: Array<{ key: string; title: string; cards: any[] }>
}

defineProps<{
  viewMode: 'today' | 'date'
  cards: any[]
  dayCards: any[]
  todaySections: HomeSection[]
  daySections: HomeSection[]
  loading: boolean
  selectedDate: number
  scrollTop: number
  focusedHomeCardId: string
  completingCardIds: Set<string>
  completedCardIds: Set<string>
}>()

defineEmits<{
  (event: 'scroll', payload: any): void
  (event: 'complete', taskId: string, mode?: boolean | string): void
  (event: 'postpone', taskIds: string | string[], title?: string): void
  (event: 'batch-complete', payload: any): void
  (event: 'batch-skip', payload: any): void
  (event: 'batch-complete-med', payload: any): void
  (event: 'action', payload: any): void
  (event: 'record-dose', payload: any): void
}>()

const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function formatFullDate(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekDays[d.getDay()]}`
}

</script>

<style lang="scss" scoped>
.card-area {
  flex: 1;
}
.section-label { display: flex; align-items: center; gap: 8px; padding: 8px 20px 10px; border-radius: 16px; }
.section-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.section-text { font-size: 12px; font-weight: 700; color: var(--text-3); letter-spacing: 0.5px; }
.section-badge { display: inline-flex; align-items: center; justify-content: center; background: var(--card-dim); border-radius: 999px; padding: 2px 8px; }
.section-badge-text { font-family: var(--font-display); font-size: 12px; font-weight: 800; line-height: 1; color: var(--text-2); }
.card-feed { padding: 0 16px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 10px; }
</style>
