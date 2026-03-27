<!--
  BProgress — 进度条
  渐变填充 + 分数标签，用于用药进度等
  Props:
    value — 当前值
    max — 最大值
    color — 渐变起始色（默认 plum）
    showLabel — 是否显示分数标签
-->
<template>
  <view class="b-progress">
    <view class="b-progress__track">
      <view
        class="b-progress__fill"
        :class="`b-progress__fill--${color}`"
        :style="{ width: percentage + '%' }"
      />
    </view>
    <text v-if="showLabel" class="b-progress__label" :class="`b-progress__label--${color}`">
      {{ value }}/{{ max }}天
    </text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  value: number
  max: number
  color?: 'plum' | 'rose' | 'primary' | 'teal' | 'green'
  showLabel?: boolean
}>(), {
  color: 'plum',
  showLabel: true,
})

const percentage = computed(() => Math.min(100, Math.round((props.value / props.max) * 100)))
</script>

<style lang="scss" scoped>
.b-progress {
  display: flex;
  align-items: center;
  gap: 8px;

  &__track {
    flex: 1;
    height: 5px;
    background: var(--card-dim);
    border-radius: var(--radius-progress);
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: var(--radius-progress);
    transition: width 0.6s ease;

    &--plum { background: linear-gradient(90deg, var(--plum), var(--rose)); }
    &--rose { background: linear-gradient(90deg, var(--rose), var(--amber)); }
    &--primary { background: linear-gradient(90deg, var(--primary), var(--amber)); }
    &--teal { background: var(--teal); }
    &--green { background: var(--green); }
  }

  &__label {
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 800;
    flex-shrink: 0;

    &--plum { color: var(--plum); }
    &--rose { color: var(--rose); }
    &--primary { color: var(--primary); }
    &--teal { color: var(--teal); }
    &--green { color: var(--green); }
  }
}
</style>
