<!--
  BSectionLabel — 分区标题
  彩色圆点 + 标题 + 角标数字，用于首页卡片区分隔
  Props:
    title — 标题文字（如"需立即处理"）
    color — 圆点颜色（默认 red）
    badge — 角标数字（如 2，可选）
-->
<template>
  <view class="b-section-label">
    <view class="b-section-label__dot" :class="`b-section-label__dot--${color}`" />
    <text class="b-section-label__title">{{ title }}</text>
    <view v-if="badge != null" class="b-section-label__badge">
      <text class="b-section-label__badge-text">{{ badge }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  color?: 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal'
  badge?: number | null
}>(), {
  color: 'red',
  badge: null,
})
</script>

<style lang="scss" scoped>
.b-section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0 10px;

  &__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;

    &--red { background: var(--red); }
    &--amber { background: var(--amber); }
    &--green { background: var(--green); }
    &--blue { background: var(--blue); }
    &--plum { background: var(--plum); }
    &--rose { background: var(--rose); }
    &--teal { background: var(--teal); }
  }

  &__title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  &__badge {
    background: var(--card-dim);
    border-radius: var(--radius-badge);
    padding: 2px 8px;
  }

  &__badge-text {
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 800;
    color: var(--text-2);
    line-height: 1.2;
  }
}
</style>
