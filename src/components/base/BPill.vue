<!--
  BPill — 摘要数字胶囊
  用于首页状态摘要栏：需处理(2) / 今日(7) / 本周(12)
  Props:
    label — 标签文字（如"需处理"）
    count — 数字
    color — red(紧急) / amber(今日) / muted(本周)
-->
<template>
  <view class="b-pill" :class="`b-pill--${color}`">
    <text class="b-pill__count">{{ count }}</text>
    <text class="b-pill__label">{{ label }}</text>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  count: number
  color?: 'red' | 'amber' | 'muted'
}>(), {
  color: 'muted',
})
</script>

<style lang="scss" scoped>
.b-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  transition: transform 0.12s ease;

  &:active { transform: scale(0.95); }

  &__count {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 800;
    line-height: 1;
  }

  &__label {
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
  }

  &--red {
    background: var(--red-soft);
    .b-pill__count, .b-pill__label { color: var(--red); }
  }
  &--amber {
    background: var(--amber-soft);
    .b-pill__count, .b-pill__label { color: var(--amber); }
  }
  &--muted {
    background: var(--card-dim);
    .b-pill__count, .b-pill__label { color: var(--text-3); }
  }
}
</style>
