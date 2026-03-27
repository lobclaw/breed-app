<!--
  BTag — 功能色标签
  小型彩色胶囊标签，用于状态标识（如"发情中"、"怀孕中"）
  Props:
    label — 标签文字
    color — 功能色名称
-->
<template>
  <view class="b-tag" :class="`b-tag--${color}`">
    <text class="b-tag__text">{{ label }}</text>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  color?: 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal' | 'primary'
}>(), {
  color: 'green',
})
</script>

<style lang="scss" scoped>
.b-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-tag);

  &__text {
    font-size: 11px;
    font-weight: 600;
    line-height: 1.2;
  }

  &--red { background: var(--red-soft); .b-tag__text { color: var(--red); } }
  &--amber { background: var(--amber-soft); .b-tag__text { color: var(--amber); } }
  &--green { background: var(--green-soft); .b-tag__text { color: var(--green); } }
  &--blue { background: var(--blue-soft); .b-tag__text { color: var(--blue); } }
  &--plum { background: var(--plum-soft); .b-tag__text { color: var(--plum); } }
  &--rose { background: var(--rose-soft); .b-tag__text { color: var(--rose); } }
  &--teal { background: var(--teal-soft); .b-tag__text { color: var(--teal); } }
  &--primary { background: var(--primary-soft); .b-tag__text { color: var(--primary); } }
}
</style>
