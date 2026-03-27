<!--
  BIconBox — 彩色图标方块
  36x36 圆角方块 + Material Icons Round 图标
  Props:
    icon — Material Icons 名称（如 'pets', 'vaccines'）
    color — 功能色名称（决定背景色）
    size — 方块尺寸（默认 36px）
-->
<template>
  <view class="b-icon-box" :class="`b-icon-box--${color}`" :style="{ width: size + 'px', height: size + 'px' }">
    <text class="b-icon-box__icon material-icons-round" :style="{ fontSize: iconSize + 'px' }">{{ icon }}</text>
  </view>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  icon: string
  color?: 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal'
  size?: number
}>(), {
  color: 'green',
  size: 36,
})

const iconSize = props.size <= 28 ? 16 : 20
</script>

<style lang="scss" scoped>
.b-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-icon);
  flex-shrink: 0;

  &__icon {
    font-family: 'Material Icons Round';
  }

  &--red { background: var(--icon-red); .b-icon-box__icon { color: var(--red); } }
  &--amber { background: var(--icon-amber); .b-icon-box__icon { color: var(--amber); } }
  &--green { background: var(--icon-green); .b-icon-box__icon { color: var(--green); } }
  &--blue { background: var(--icon-blue); .b-icon-box__icon { color: var(--blue); } }
  &--plum { background: var(--icon-plum); .b-icon-box__icon { color: var(--plum); } }
  &--rose { background: var(--icon-rose); .b-icon-box__icon { color: var(--rose); } }
  &--teal { background: var(--icon-teal); .b-icon-box__icon { color: var(--teal); } }
}
</style>
