<!--
  BCard — 功能色卡片
  左色条 + 渐变色晕 + 阴影，所有列表/详情卡片的基础容器
  Props:
    color — 功能色名称：red/amber/green/blue/plum/rose/teal（默认 green）
    pressable — 是否有按压缩放效果（默认 true）
-->
<template>
  <view
    class="b-card"
    :class="[`b-card--${color}`, { 'b-card--pressable': pressable }]"
  >
    <slot />
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  color?: 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal'
  pressable?: boolean
}>(), {
  color: 'green',
  pressable: true,
})
</script>

<style lang="scss" scoped>
.b-card {
  position: relative;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: var(--space-card) var(--space-card) var(--space-card) var(--space-card-left);
  border-left: 3.5px solid var(--green);
  box-shadow: var(--shadow);
  overflow: hidden;

  /* 左上角渐变色晕 */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: var(--radius-card);
    pointer-events: none;
    z-index: 0;
  }

  /* 内容浮于渐变之上 */
  :deep(> *) {
    position: relative;
    z-index: 1;
  }

  &--pressable {
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    &:active {
      transform: scale(0.975);
      box-shadow: 0 1px 6px rgba(234, 62, 119, 0.04);
    }
  }

  /* 功能色变体 */
  &--red {
    border-left-color: var(--red);
    &::before { background: linear-gradient(135deg, var(--red-soft) 0%, transparent 40%); }
  }
  &--amber {
    border-left-color: var(--amber);
    &::before { background: linear-gradient(135deg, var(--amber-soft) 0%, transparent 40%); }
  }
  &--green {
    border-left-color: var(--green);
    &::before { background: linear-gradient(135deg, var(--green-soft) 0%, transparent 40%); }
  }
  &--blue {
    border-left-color: var(--blue);
    &::before { background: linear-gradient(135deg, var(--blue-soft) 0%, transparent 40%); }
  }
  &--plum {
    border-left-color: var(--plum);
    &::before { background: linear-gradient(135deg, var(--plum-soft) 0%, transparent 40%); }
  }
  &--rose {
    border-left-color: var(--rose);
    &::before { background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%); }
  }
  &--teal {
    border-left-color: var(--teal);
    &::before { background: linear-gradient(135deg, var(--teal-soft) 0%, transparent 40%); }
  }
}
</style>
