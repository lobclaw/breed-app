<template>
  <view class="group-card">
    <view
      v-for="item in items"
      :key="item.id"
      class="group-row"
      :class="{ 'group-row--passed': item.milestone.suggestionStatus === 'window_passed' }"
      @click="goProcess(item.card)"
    >
      <view class="group-avatar">🐩</view>
      <view class="group-main">
        <view class="group-name-row">
          <text class="group-name">{{ item.card.dogName }}</text>
          <view
            class="group-tag"
            :class="{ 'group-tag--passed': item.milestone.suggestionStatus === 'window_passed' }"
          >
            <text class="group-tag__text">{{ item.stageTag }}</text>
          </view>
        </view>
        <text class="group-copy">
          <text class="group-copy__strong">{{ item.milestone.dayLabel }}</text>
          <text> · </text>
          <text
            class="group-copy__secondary"
            :class="{ 'group-copy__secondary--passed': item.milestone.suggestionStatus === 'window_passed' }"
          >{{ item.secondaryLabel }}</text>
        </text>
      </view>
      <view class="group-actions">
        <view v-if="item.canObserve || item.canDirectMating" class="group-secondary-actions">
          <view
            v-if="item.canObserve"
            class="group-secondary-action"
            @click.stop="goObserve(item.card)"
          >
            <text class="group-secondary-action__text">观察</text>
          </view>
          <view
            v-if="item.canDirectMating"
            class="group-secondary-action"
            @click.stop="goDirectMating(item.card)"
          >
            <text class="group-secondary-action__text">直接配种</text>
          </view>
        </view>
        <view
          class="group-action"
          :class="{ 'group-action--passed': item.milestone.suggestionStatus === 'window_passed' }"
          @click.stop="goProcess(item.card)"
        >
          <text class="group-action__text">处理</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { deriveBreedingMilestoneViewModel } from '@/utils/breedingMilestone'
import {
  buildHomeDirectMatingUrl,
  buildHomeHeatObservationUrl,
  canOpenHomeDirectMating,
  canOpenHomeHeatObservation,
} from '@/utils/homeHeatObservation'

const props = defineProps<{ group: any }>()

const items = computed(() => {
  return (props.group?.cards || []).map((card: any) => {
    const task = card?.tasks?.[0] || {}
    const milestone = deriveBreedingMilestoneViewModel(task)
    return {
      id: card?.id || task?._id,
      card,
      milestone,
      stageTag: buildStageTag(milestone.stageTitle),
      secondaryLabel: buildSecondaryLabel(milestone),
      canObserve: canOpenHomeHeatObservation(card),
      canDirectMating: canOpenHomeDirectMating(card),
    }
  })
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
}

function buildStageTag(stageTitle: string) {
  return stageTitle
    .replace(/^建议/, '')
    .replace(/^确认/, '')
    .trim() || '流程'
}

function buildSecondaryLabel(milestone: ReturnType<typeof deriveBreedingMilestoneViewModel>) {
  if (milestone.suggestionStatus === 'window_passed') {
    return milestone.suggestionLabel.replace('建议日期已过 ', '已过 ')
  }
  if (milestone.suggestionStatus === 'window_due') {
    return milestone.suggestionLabel
  }
  return milestone.referenceDateLabel.replace('建议日期 · ', '建议')
}

function goProcess(card: any) {
  const task = card?.tasks?.[0]
  if (!task) return

  const params: string[] = []
  if (card.dogId) params.push(`dogId=${card.dogId}`)
  if (card.dogName) params.push(`dogName=${encodeURIComponent(card.dogName)}`)
  if (task._id) params.push(`taskId=${task._id}`)
  if (task.cycle_id) params.push(`cycleId=${task.cycle_id}`)

  let url = typeMap[task.type] || '/pages/record/health-vaccination'
  if (task.type === 'breeding_milestone') {
    params.push('locked=true')
    const stepType = task.details?.step_type
    if (stepType === 'follicle_check') {
      url = '/pages/record/breeding-follicle'
    } else if (stepType === 'mating') {
      url = '/pages/record/breeding-mating'
    } else if (stepType === 'pregnancy_check') {
      url = '/pages/record/breeding-pregnancy'
    } else if (stepType === 'weaning_confirm' && task.litter_id) {
      const litterParams = [`id=${task.litter_id}`]
      if (task._id) litterParams.push(`taskId=${task._id}`)
      uni.navigateTo({ url: `/pages/breeding/litter?${litterParams.join('&')}` })
      return
    } else {
      url = '/pages/record/breeding-heat'
    }
  }

  uni.navigateTo({ url: `${url}?${params.join('&')}` })
}

function goObserve(card: any) {
  if (!canOpenHomeHeatObservation(card)) return
  uni.navigateTo({ url: buildHomeHeatObservationUrl(card) })
}

function goDirectMating(card: any) {
  if (!canOpenHomeDirectMating(card)) return
  uni.navigateTo({ url: buildHomeDirectMatingUrl(card) })
}
</script>

<style lang="scss" scoped>
.group-card {
  background: var(--card);
  border-left: 3.5px solid var(--amber);
  border-radius: 20px;
  box-shadow: var(--shadow);
  overflow: hidden;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--amber-soft) 0%, transparent 34%);
    pointer-events: none;
  }
}

.group-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 68px;
  padding: 12px 16px;

  & + & {
    border-top: 1px solid rgba(216, 203, 189, 0.18);
  }
}

.group-row--passed {
  background: linear-gradient(135deg, rgba(224, 82, 82, 0.05) 0%, transparent 42%);
}

.group-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #ffe9cf;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}

.group-main {
  min-width: 0;
  flex: 1;
}

.group-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-name {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.2;
}

.group-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 16px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--amber-soft);
}

.group-tag--passed {
  background: var(--red-soft);
}

.group-tag__text {
  font-size: 9px;
  font-weight: 800;
  color: var(--amber);
  line-height: 1;
}

.group-tag--passed .group-tag__text {
  color: var(--red);
}

.group-copy {
  display: block;
  margin-top: 5px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.4;
}

.group-copy__strong {
  color: var(--text-2);
  font-weight: 700;
}

.group-copy__secondary {
  color: var(--amber);
  font-weight: 700;
}

.group-copy__secondary--passed {
  color: var(--red);
  font-weight: 800;
}

.group-action {
  min-width: 46px;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--amber-soft);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.group-action--passed {
  background: var(--red-soft);
}

.group-action__text {
  font-size: 11px;
  font-weight: 800;
  color: var(--amber);
}

.group-action--passed .group-action__text {
  color: var(--red);
}

.group-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.group-secondary-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.group-secondary-action {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
  flex-shrink: 0;
}

.group-secondary-action__text {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
}
</style>
