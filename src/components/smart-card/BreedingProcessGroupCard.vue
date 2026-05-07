<template>
  <view class="group-card">
    <view
      v-for="item in visibleItems"
      :key="item.id"
      class="group-row"
      :class="{ 'group-row--passed': item.milestone.suggestionStatus === 'window_passed' }"
      @click="goDetail(item.card)"
    >
      <view
        class="group-avatar"
        :class="{ 'group-avatar--detail': !!item.card?.dogId }"
        @click.stop="goDogDetail(item.card)"
      >
        <BEntityIcon :role="item.card?.role" color="var(--amber)" :size="16" />
      </view>
      <view class="group-main">
        <view class="group-name-row">
          <view class="group-title-wrap">
            <text class="group-name">{{ item.card.dogName }}</text>
            <template v-if="item.primaryLabel">
              <text class="group-title-divider">·</text>
              <text class="group-title-meta">{{ item.primaryLabel }}</text>
            </template>
          </view>
          <view
            class="group-tag"
            :class="{ 'group-tag--passed': item.milestone.suggestionStatus === 'window_passed' }"
          >
            <text class="group-tag__text">{{ item.stageTag }}</text>
          </view>
        </view>
        <text v-if="item.secondaryLabel" class="group-copy">
          <text class="group-copy__secondary">{{ item.secondaryLabel }}</text>
        </text>
        <text
          v-if="item.alertLabel"
          class="group-copy group-copy--alert"
          :class="{ 'group-copy--alert-passed': item.milestone.isAlertDanger }"
        >
          {{ item.alertLabel }}
        </text>
      </view>
      <view class="group-actions">
        <view
          class="group-action"
          :class="{ 'group-action--passed': item.milestone.suggestionStatus === 'window_passed' }"
          @click.stop="goProcess(item.card)"
        >
          <text class="group-action__text">处理</text>
        </view>
      </view>
    </view>
    <view
      v-if="hiddenCount > 0"
      class="group-expand"
      @click.stop="toggleExpanded"
    >
      <text class="group-expand__text">{{ expandText }}</text>
      <text class="material-icons-round group-expand__icon">{{ expanded ? 'expand_less' : 'expand_more' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import BEntityIcon from '@/components/base/BEntityIcon.vue'
import { deriveBreedingMilestoneViewModel } from '@/utils/breedingMilestone'
import { buildBreedingMilestoneSummary } from '@/utils/breedingMilestoneSummary'
import {
  hasMultipleHomeBreedingActions,
  openHomeBreedingAction,
  openHomeBreedingDetail,
} from '@/utils/homeBreedingActions'

const props = defineProps<{ group: any }>()
const emit = defineEmits<{
  (e: 'action', payload: { type: string; data: any }): void
}>()
const expanded = ref(false)

watch(() => props.group?.key, () => {
  expanded.value = false
}, { immediate: true })

watch(() => props.group?.hiddenCount, (hiddenCount) => {
  if (!hiddenCount) {
    expanded.value = false
  }
})

const allCards = computed(() => props.group?.cards || [])
const collapsedCards = computed(() => {
  const visibleCards = props.group?.visibleCards
  if (Array.isArray(visibleCards) && visibleCards.length > 0) return visibleCards
  return allCards.value.slice(0, 2)
})
const hiddenCount = computed(() => props.group?.hiddenCount || 0)
const displayCards = computed(() => (expanded.value ? allCards.value : collapsedCards.value))
const expandText = computed(() => (expanded.value ? '收起' : `还有 ${hiddenCount.value} 条，展开`))

const visibleItems = computed(() => {
  return displayCards.value.map((card: any) => {
    const task = card?.tasks?.[0] || {}
    const milestone = deriveBreedingMilestoneViewModel(task)
    return {
      id: card?.id || task?._id,
      card,
      milestone,
      ...buildBreedingMilestoneSummary(milestone),
    }
  })
})

function toggleExpanded() {
  expanded.value = !expanded.value
}

function goDetail(card: any) {
  openHomeBreedingDetail(card)
}

function goDogDetail(card: any) {
  if (!card?.dogId) return
  uni.navigateTo({ url: `/pages/dog/detail?id=${card.dogId}` })
}

function goProcess(card: any) {
  if (hasMultipleHomeBreedingActions(card)) {
    emit('action', { type: 'show_breeding_actions', data: { card } })
    return
  }

  openHomeBreedingAction(card, 'process')
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

.group-avatar--detail {
  transition: transform 0.12s ease, filter 0.12s ease;

  &:active {
    transform: scale(0.94);
    filter: brightness(0.98);
  }
}

.group-main {
  min-width: 0;
  flex: 1;
}

.group-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.group-title-wrap {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.group-name {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.2;
  flex-shrink: 0;
}

.group-title-divider {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  line-height: 1.2;
}

.group-title-meta {
  min-width: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.group-copy--alert {
  margin-top: 2px;
  color: var(--text-3);
}

.group-copy--alert-passed {
  color: var(--red);
  font-weight: 800;
}

.group-copy__strong {
  color: var(--text-2);
  font-weight: 700;
}

.group-copy__secondary {
  color: var(--amber);
  font-weight: 700;
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

.group-expand {
  position: relative;
  z-index: 1;
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-top: 1px solid rgba(216, 203, 189, 0.18);
}

.group-expand__text {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
}

.group-expand__icon {
  font-size: 14px;
  color: var(--text-3);
}
</style>
