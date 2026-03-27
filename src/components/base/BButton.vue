<!--
  BButton — 按钮组件
  支持 filled（实心）和 ghost（描边）两种样式
  Props:
    variant — filled / ghost（默认 filled）
    color — 功能色名称（默认 primary）
    size — small / medium / large（默认 medium）
    loading — 加载中状态
    disabled — 禁用状态
-->
<template>
  <button
    class="b-btn"
    :class="[
      `b-btn--${variant}`,
      `b-btn--${size}`,
      `b-btn--${color}`,
      { 'b-btn--loading': loading, 'b-btn--disabled': disabled },
    ]"
    :disabled="disabled || loading"
    @click="$emit('click')"
  >
    <text v-if="loading" class="b-btn__spinner">...</text>
    <slot v-else />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'filled' | 'ghost'
  color?: 'primary' | 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal'
  size?: 'small' | 'medium' | 'large'
  loading?: boolean
  disabled?: boolean
}>(), {
  variant: 'filled',
  color: 'primary',
  size: 'medium',
  loading: false,
  disabled: false,
})

defineEmits<{ click: [] }>()
</script>

<style lang="scss" scoped>
.b-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-btn);
  font-family: var(--font-display);
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: transform 0.12s ease, opacity 0.12s ease;
  line-height: 1;

  &:active:not(.b-btn--disabled) {
    transform: scale(0.94);
    opacity: 0.85;
  }

  /* 尺寸 */
  &--small { padding: 6px 14px; font-size: 12px; }
  &--medium { padding: 8px 18px; font-size: 13px; }
  &--large { padding: 12px 24px; font-size: 15px; }

  /* Filled 变体 */
  &--filled {
    color: #FFFFFF;
    &.b-btn--primary { background: var(--primary); }
    &.b-btn--red { background: var(--red); }
    &.b-btn--amber { background: var(--amber); }
    &.b-btn--green { background: var(--green); }
    &.b-btn--blue { background: var(--blue); }
    &.b-btn--plum { background: var(--plum); }
    &.b-btn--rose { background: var(--rose); }
    &.b-btn--teal { background: var(--teal); }
  }

  /* Ghost 变体 */
  &--ghost {
    background: transparent;
    border: 1.5px solid var(--text-4);
    color: var(--text-2);
  }

  /* 禁用 */
  &--disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* 加载 */
  &__spinner {
    letter-spacing: 2px;
  }
}
</style>
