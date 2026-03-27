<!--
  BSheet — 底部弹出面板
  带把手 + 遮罩 + 滑入动画的通用底部面板
  Props:
    visible — 是否显示
    title — 面板标题（可选）
    height — 面板高度（默认 auto）
-->
<template>
  <view v-if="visible" class="b-sheet" @click.self="close">
    <view class="b-sheet__mask" @click="close" />
    <view class="b-sheet__panel" :class="{ 'b-sheet__panel--open': animOpen }" :style="panelStyle">
      <!-- 把手 -->
      <view class="b-sheet__handle">
        <view class="b-sheet__handle-bar" />
      </view>
      <!-- 标题 -->
      <view v-if="title" class="b-sheet__header">
        <text class="b-sheet__title">{{ title }}</text>
        <view class="b-sheet__close" @click="close">
          <text class="material-icons-round" style="font-size: 20px; color: var(--text-3);">close</text>
        </view>
      </view>
      <!-- 内容 -->
      <scroll-view scroll-y class="b-sheet__body">
        <slot />
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  visible: boolean
  title?: string
  height?: string
}>(), {
  title: '',
  height: 'auto',
})

const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const animOpen = ref(false)

watch(() => props.visible, (val) => {
  if (val) {
    nextTick(() => { animOpen.value = true })
  } else {
    animOpen.value = false
  }
})

const panelStyle = computed(() => {
  if (props.height === 'auto') return {}
  return { height: props.height, maxHeight: '85vh' }
})

function close() {
  animOpen.value = false
  setTimeout(() => emit('update:visible', false), 250)
}
</script>

<style lang="scss" scoped>
.b-sheet {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;

  &__mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--mask);
  }

  &__panel {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--card);
    border-radius: 20px 20px 0 0;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    transform: translateY(100%);
    transition: transform 0.25s ease;

    &--open { transform: translateY(0); }
  }

  &__handle {
    display: flex;
    justify-content: center;
    padding: 12px 0 8px;
  }

  &__handle-bar {
    width: 36px;
    height: 4px;
    background: var(--text-4);
    border-radius: 2px;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-page) 12px;
  }

  &__title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--card-dim);
  }

  &__body {
    flex: 1;
    padding: 0 var(--space-page) env(safe-area-inset-bottom, 20px);
    overflow-y: auto;
  }
}
</style>
