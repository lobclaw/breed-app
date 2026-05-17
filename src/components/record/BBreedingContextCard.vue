<template>
  <view
    class="b-breeding-context-card"
    :class="{ 'b-breeding-context-card--readonly': readonly }"
    @click="handleClick"
  >
    <view class="b-breeding-context-card__bg" />
    <view class="b-breeding-context-card__main">
      <view class="b-breeding-context-card__avatar">
        <BEntityIcon :role="dog?.role" :size="20" color="#fff" />
      </view>
      <view class="b-breeding-context-card__content">
        <view class="b-breeding-context-card__title-row">
          <text class="b-breeding-context-card__name">{{ dog?.name || placeholder }}</text>
          <text
            v-if="stageLabel"
            class="b-breeding-context-card__stage-tag"
            :class="`b-breeding-context-card__stage-tag--${stageTone}`"
          >
            {{ stageLabel }}
          </text>
        </view>
        <text class="b-breeding-context-card__meta">{{ metaText || emptyMeta }}</text>
      </view>
    </view>
    <text class="material-icons-round b-breeding-context-card__action">{{ readonly ? 'lock' : 'chevron_right' }}</text>
  </view>
</template>

<script setup lang="ts">
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import type { DogRole } from '@/types/dog'

interface BreedingContextDog {
  _id?: string
  name?: string
  role?: DogRole | string
}

const props = withDefaults(defineProps<{
  dog?: BreedingContextDog | null
  stageLabel?: string
  stageTone?: 'heat' | 'pregnant'
  metaText?: string
  readonly?: boolean
  placeholder?: string
  emptyMeta?: string
}>(), {
  dog: null,
  stageLabel: '',
  stageTone: 'pregnant',
  metaText: '',
  readonly: false,
  placeholder: '选择种母',
  emptyMeta: '繁育周期信息',
})

const emit = defineEmits<{
  click: []
}>()

function handleClick() {
  if (props.readonly) return
  emit('click')
}
</script>

<style lang="scss" scoped>
.b-breeding-context-card {
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--card);
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  position: relative;
  overflow: hidden;
  transition: all 0.15s ease;

  &:active {
    transform: scale(0.975);
    box-shadow: 0 1px 6px rgba(234, 62, 119, 0.04);
  }

  &--readonly:active {
    transform: none;
  }

  &__bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%);
    pointer-events: none;
  }

  &__main {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    position: relative;
    z-index: 1;
  }

  &__avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--rose), var(--amber));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  &__name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__stage-tag {
    max-width: 82px;
    padding: 2px 6px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;

    &--heat {
      color: #e89b3e;
      background: rgba(245, 179, 65, 0.12);
    }

    &--pregnant {
      color: var(--primary);
      background: var(--primary-soft);
    }
  }

  &__meta {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__action {
    font-size: 20px;
    color: var(--text-4);
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }
}
</style>
