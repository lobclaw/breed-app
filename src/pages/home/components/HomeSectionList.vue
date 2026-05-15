<template>
  <view>
    <view v-for="section in sections" :key="section.key">
      <view v-if="section.cards.length > 0" class="home-section" :class="`home-section--${section.key}`" :id="`section-${section.key}`">
        <view class="section-label" :class="{ 'section-label--nested': nestedLabel }">
          <view class="section-dot" :style="{ background: section.dotColor }" />
          <text class="section-text">{{ section.title }}</text>
          <view class="section-badge"><text class="section-badge-text">{{ section.cards.length }}</text></view>
        </view>
        <view v-if="section.groups?.length" class="section-groups">
          <view v-for="group in section.groups" :key="group.key" v-show="group.cards.length > 0" class="section-group">
            <view class="subsection-label">
              <text class="subsection-text">{{ group.title }}</text>
              <view class="subsection-badge"><text class="subsection-badge-text">{{ group.cards.length }}</text></view>
            </view>
            <BreedingProcessGroupCard v-if="isBreedingMilestoneGroup(group)" :group="group" @action="$emit('action', $event)" />
            <view v-else class="card-feed">
              <view v-for="card in group.cards" :id="`home-card-${card.id}`" :key="card.id" class="home-card-anchor" :class="{ 'home-card-anchor--focus': focusedHomeCardId === card.id }">
                <SmartCard
                  :card="card"
                  :completing="completingCardIds.has(card.id)"
                  :completed="completedCardIds.has(card.id)"
                  @complete="(...args) => $emit('complete', ...args)"
                  @postpone="(...args) => $emit('postpone', ...args)"
                  @batch-complete="$emit('batch-complete', $event)"
                  @batch-skip="$emit('batch-skip', $event)"
                  @batch-complete-med="$emit('batch-complete-med', $event)"
                  @action="$emit('action', $event)"
                  @record-dose="$emit('record-dose', $event)"
                />
              </view>
            </view>
          </view>
        </view>
        <view v-else class="card-feed">
          <view v-for="card in section.cards" :id="`home-card-${card.id}`" :key="card.id" class="home-card-anchor" :class="{ 'home-card-anchor--focus': focusedHomeCardId === card.id }">
            <SmartCard
              :card="card"
              :completing="completingCardIds.has(card.id)"
              :completed="completedCardIds.has(card.id)"
                @complete="(...args) => $emit('complete', ...args)"
                @postpone="(...args) => $emit('postpone', ...args)"
              @batch-complete="$emit('batch-complete', $event)"
              @batch-skip="$emit('batch-skip', $event)"
              @batch-complete-med="$emit('batch-complete-med', $event)"
              @action="$emit('action', $event)"
              @record-dose="$emit('record-dose', $event)"
            />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import BreedingProcessGroupCard from '@/components/smart-card/BreedingProcessGroupCard.vue'
import SmartCard from '@/components/smart-card/SmartCard.vue'
import { isBreedingMilestoneGroup } from '../composables/homeWorkbenchSections'

type HomeSection = {
  key: string
  title: string
  dotColor: string
  cards: any[]
  groups?: Array<{ key: string; title: string; cards: any[] }>
}

defineProps<{
  sections: HomeSection[]
  nestedLabel?: boolean
  focusedHomeCardId: string
  completingCardIds: Set<string>
  completedCardIds: Set<string>
}>()

defineEmits<{
  (event: 'complete', taskId: string, mode?: boolean | string): void
  (event: 'postpone', taskIds: string | string[], title?: string): void
  (event: 'batch-complete', payload: any): void
  (event: 'batch-skip', payload: any): void
  (event: 'batch-complete-med', payload: any): void
  (event: 'action', payload: any): void
  (event: 'record-dose', payload: any): void
}>()
</script>

<style lang="scss" scoped>
.section-label { display: flex; align-items: center; gap: 8px; padding: 8px 20px 10px; border-radius: 16px; transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease; }
.section-label--nested { padding-top: 2px; }
.section-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.section-text { font-size: 12px; font-weight: 700; color: var(--text-3); letter-spacing: 0.5px; }
.section-badge { display: inline-flex; align-items: center; justify-content: center; background: var(--card-dim); border-radius: 999px; padding: 2px 8px; }
.section-badge-text { font-family: var(--font-display); font-size: 12px; font-weight: 800; line-height: 1; color: var(--text-2); }
.section-groups { display: flex; flex-direction: column; gap: 10px; }
.section-group { display: flex; flex-direction: column; gap: 6px; }
.subsection-label { display: flex; align-items: center; gap: 8px; padding: 2px 20px 8px; border-radius: 14px; transition: background 0.18s ease, box-shadow 0.18s ease; }
.subsection-text { font-size: 12px; font-weight: 700; color: var(--text-2); }
.subsection-badge { display: inline-flex; align-items: center; justify-content: center; background: var(--card-dim); border-radius: 999px; padding: 2px 7px; }
.subsection-badge-text { font-family: var(--font-display); font-size: 11px; font-weight: 800; line-height: 1; color: var(--text-2); }
.card-feed { padding: 0 16px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 10px; }
.home-card-anchor { position: relative; border-radius: 20px; transition: box-shadow 0.18s ease, transform 0.18s ease; }
.home-card-anchor--focus { box-shadow: 0 0 0 2px rgba(234, 170, 69, 0.24), 0 12px 30px rgba(234, 170, 69, 0.16); transform: translateY(-2px); animation: home-card-focus-pulse 1.05s ease-out 1; }
.home-card-anchor--focus::after { content: ''; position: absolute; inset: -4px; border-radius: 24px; border: 2px solid rgba(234, 170, 69, 0.34); box-shadow: 0 0 0 6px rgba(234, 170, 69, 0.08); pointer-events: none; animation: home-card-focus-ring 1.05s ease-out 1; }
@keyframes home-card-focus-pulse { 0% { transform: translateY(0) scale(0.992); box-shadow: 0 0 0 0 rgba(234, 170, 69, 0); } 38% { transform: translateY(-2px) scale(1.01); box-shadow: 0 0 0 2px rgba(234, 170, 69, 0.24), 0 16px 34px rgba(234, 170, 69, 0.18); } 100% { transform: translateY(-2px) scale(1); box-shadow: 0 0 0 2px rgba(234, 170, 69, 0.24), 0 12px 30px rgba(234, 170, 69, 0.16); } }
@keyframes home-card-focus-ring { 0% { opacity: 0; transform: scale(0.98); } 28% { opacity: 1; transform: scale(1.01); } 100% { opacity: 0.72; transform: scale(1); } }
.home-section + .home-section { margin-top: 4px; }
.section-group > :deep(.group-card) { margin: 0 16px 10px; }
</style>
