<template>
  <view
    class="card card--amber"
    :class="{ 'card--window-passed': milestone.suggestionStatus === 'window_passed' }"
    @click="onCardTap"
  >
    <view class="card-header">
      <view class="card-icon card-icon--amber card-icon--detail" @click.stop="onAvatarTap">
        <BEntityIcon :role="props.card?.role" color="var(--amber)" :size="20" />
      </view>
      <view class="card-title-area">
        <text class="card-name">{{ card.dogName }}</text>
        <text class="card-sub">{{ card.breed || '马尔济斯' }}</text>
      </view>
    </view>

    <view class="process-body">
      <view class="process-copy">
        <text class="process-stage" :class="`process-stage--${milestone.suggestionStatus}`">{{ milestone.stageTitle }}</text>
        <text class="process-day">{{ milestoneSummary.primaryLabel }}</text>
        <text v-if="milestoneSummary.secondaryLabel" class="process-reference">{{ milestoneSummary.secondaryLabel }}</text>
        <text
          v-if="milestoneSummary.alertLabel"
          class="process-alert"
          :class="milestone.isAlertDanger ? 'process-alert--window_passed' : ''"
        >{{ milestoneSummary.alertLabel }}</text>
      </view>
      <view v-if="showSuggestionChip" class="process-chip" :class="`process-chip--${milestone.suggestionStatus}`">
        <text class="process-chip__text" :class="`process-chip__text--${milestone.suggestionStatus}`">{{ milestone.suggestionLabel }}</text>
      </view>
    </view>

    <view class="card-actions">
      <view class="btn btn--primary btn--primary-amber" @click.stop="onPrimaryActionTap">
        <text class="material-icons-round btn-icon btn-icon--white">arrow_forward</text>
        <text class="btn-text btn-text--white">处理</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import BEntityIcon from '@/components/base/BEntityIcon.vue'
import { deriveBreedingMilestoneViewModel } from '@/utils/breedingMilestone'
import { buildBreedingMilestoneSummary } from '@/utils/breedingMilestoneSummary'
import {
  hasMultipleHomeBreedingActions,
  openHomeBreedingAction,
  openHomeBreedingDetail,
} from '@/utils/homeBreedingActions'

const props = defineProps<{ card: any }>()
const emit = defineEmits<{
  (e: 'action', payload: { type: string; data: any }): void
}>()

const milestone = computed(() => deriveBreedingMilestoneViewModel(props.card?.tasks?.[0] || {}))
const milestoneSummary = computed(() => buildBreedingMilestoneSummary(milestone.value))
const showSuggestionChip = computed(() => {
  if (milestone.value.stepType === 'follicle_check') return false
  return !(milestone.value.stepType === 'mating' && milestone.value.suggestionStatus === 'window_passed')
})
const hasMultipleActions = computed(() => hasMultipleHomeBreedingActions(props.card))

function onCardTap() {
  openHomeBreedingDetail(props.card)
}

function onAvatarTap() {
  if (!props.card?.dogId) return
  uni.navigateTo({ url: `/pages/dog/detail?id=${encodeURIComponent(props.card.dogId)}` })
}

function onPrimaryActionTap() {
  if (hasMultipleActions.value) {
    emit('action', { type: 'show_breeding_actions', data: { card: props.card } })
    return
  }

  openHomeBreedingAction(props.card, 'process')
}
</script>

<style lang="scss" scoped>
.card {
  position: relative;
  background: var(--card);
  border-radius: 16px;
  padding: 16px 16px 16px 18px;
  border-left: 3.5px solid var(--amber);
  box-shadow: var(--shadow);
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:active { transform: scale(0.975); }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background: linear-gradient(135deg, var(--amber-soft) 0%, transparent 40%);
  }

  > * { position: relative; z-index: 1; }
}

.card--window-passed {
  border-left-color: rgba(224, 82, 82, 0.72);

  &::before {
    background: linear-gradient(135deg, rgba(224, 82, 82, 0.12) 0%, transparent 34%);
  }
}

.card-header { display: flex; align-items: flex-start; gap: 12px; }

.card-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-icon--amber { background: var(--icon-amber); }
.card-icon--detail {
  transition: transform 0.12s ease, filter 0.12s ease;

  &:active {
    transform: scale(0.94);
    filter: brightness(0.98);
  }
}

.card-title-area { flex: 1; min-width: 0; }
.card-name { display: block; font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text-1); line-height: 1.3; }
.card-sub { display: block; font-size: 12px; color: var(--text-2); margin-top: 1px; }

.process-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.process-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.process-stage {
  font-size: 14px;
  font-weight: 700;
  color: var(--amber);
}

.process-stage--window_due { color: var(--amber); }
.process-stage--window_passed { color: var(--red); }

.process-day {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.process-reference {
  font-size: 12px;
  color: var(--text-3);
}

.process-alert {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
}

.process-alert--window_passed {
  color: var(--red);
}

.process-chip {
  align-self: flex-start;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--amber-soft);
  box-shadow: 0 1px 4px rgba(232, 155, 62, 0.18);
}

.process-chip--window_due {
  background: rgba(242, 167, 62, 0.16);
}

.process-chip--window_passed {
  background: rgba(224, 82, 82, 0.12);
  box-shadow: 0 1px 4px rgba(224, 82, 82, 0.16);
}

.process-chip__text {
  font-size: 11px;
  font-weight: 700;
}

.process-chip__text--normal,
.process-chip__text--window_due { color: var(--amber); }
.process-chip__text--window_passed { color: var(--red); }

.card-actions { display: flex; align-items: center; gap: 8px; margin-top: 14px; }

.btn {
  min-height: 34px;
  padding: 8px 18px;
  min-width: 64px;
  border-radius: 999px;
  border: none;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: transform 0.12s ease, opacity 0.12s ease;

  &:active {
    transform: scale(0.94);
    opacity: 0.85;
  }
}

.btn--weak {
  background: rgba(255, 244, 236, 0.92);
  color: var(--text-2);
}

.btn--primary-amber {
  background: linear-gradient(135deg, rgba(242, 167, 62, 0.92), rgba(255, 192, 108, 0.92));
}

.btn--text {
  min-width: 0;
  padding: 8px 4px;
  background: transparent;
}

.btn-icon { font-size: 16px; flex-shrink: 0; }
.btn-icon--white { color: #fff; }
.btn-text { font-family: var(--font-display); font-size: 13px; font-weight: 700; }
.btn-text--white { color: #fff; }
.btn-text--muted { color: var(--text-3); }
</style>
