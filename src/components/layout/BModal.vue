<!--
  BModal — 居中确认弹窗
  遮罩 + 居中白色面板，用于删除确认、状态变更等
  Props:
    visible — 是否显示
    title — 标题
    content — 描述文字（可选）
    confirmText — 确认按钮文字（默认"确定"）
    cancelText — 取消按钮文字（默认"取消"）
    confirmColor — 确认按钮颜色（默认 primary）
    danger — 是否为危险操作（确认按钮变红）
    manualClose — 设为 true 时点确认不自动关闭，由父组件控制 visible
-->
<template>
  <view v-if="renderVisible" class="b-modal">
    <view class="b-modal__mask" :class="{ 'b-modal__mask--open': animOpen }" @click="cancel" @touchmove.prevent />
    <view class="b-modal__panel" :class="{ 'b-modal__panel--open': animOpen }">
      <text class="b-modal__title">{{ title }}</text>
      <text v-if="content" class="b-modal__content">{{ content }}</text>
      <slot />
      <view class="b-modal__actions">
        <view class="b-modal__btn b-modal__btn--cancel" @click="cancel">
          <text class="b-modal__btn-text b-modal__btn-text--cancel">{{ cancelText }}</text>
        </view>
        <view class="b-modal__btn b-modal__btn--confirm" :class="btnClass" @click="confirm">
          <text class="b-modal__btn-text b-modal__btn-text--confirm" :class="btnTextClass">{{ confirmText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  visible: boolean
  title: string
  content?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  manualClose?: boolean
}>(), {
  content: '',
  confirmText: '确定',
  cancelText: '取消',
  danger: false,
  manualClose: false,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: []
  cancel: []
}>()

const animOpen = ref(false)
const renderVisible = ref(props.visible)
const MODAL_ANIMATION_MS = 200
let closeTimer: ReturnType<typeof setTimeout> | null = null

function clearCloseTimer() {
  if (!closeTimer) return
  clearTimeout(closeTimer)
  closeTimer = null
}

function lockScroll(lock: boolean) {
  // #ifdef H5
  document.body.style.overflow = lock ? 'hidden' : ''
  // #endif
}

function openModal() {
  clearCloseTimer()
  renderVisible.value = true
  lockScroll(true)
  nextTick(() => { animOpen.value = true })
}

function closeModal() {
  animOpen.value = false
  clearCloseTimer()
  closeTimer = setTimeout(() => {
    renderVisible.value = false
    lockScroll(false)
    closeTimer = null
  }, MODAL_ANIMATION_MS)
}

watch(() => props.visible, (val) => {
  if (val) {
    openModal()
  } else if (renderVisible.value) {
    closeModal()
  } else {
    animOpen.value = false
    lockScroll(false)
  }
}, { immediate: true })

const btnClass = computed(() => props.danger ? 'b-modal__btn--danger' : '')
const btnTextClass = computed(() => props.danger ? 'b-modal__btn-text--danger' : '')

function cancel() {
  if (!renderVisible.value) return
  animOpen.value = false
  emit('update:visible', false)
  emit('cancel')
}

function confirm() {
  emit('confirm')
  if (!props.manualClose) {
    emit('update:visible', false)
  }
}

onBeforeUnmount(() => {
  clearCloseTimer()
  lockScroll(false)
})
</script>

<style lang="scss" scoped>
.b-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;

  &__mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--mask);
    opacity: 0;
    transition: opacity 0.2s ease;

    &--open {
      opacity: 1;
    }
  }

  &__panel {
    position: relative;
    background: var(--card);
    border-radius: var(--radius-card);
    padding: 24px;
    width: 80%;
    max-width: 320px;
    transform: translateY(16px) scale(0.94);
    transform-origin: center center;
    opacity: 0;
    transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease;

    &--open {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  &__title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
    color: var(--text-1);
    text-align: center;
    display: block;
    margin-bottom: 8px;
  }

  &__content {
    font-size: 14px;
    color: var(--text-2);
    text-align: center;
    display: block;
    margin-bottom: 20px;
    line-height: 1.5;
  }

  &__actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
  }

  &__btn {
    flex: 1;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-btn);
    transition: transform 0.12s ease, opacity 0.12s ease;
    &:active { transform: scale(0.94); opacity: 0.85; }

    &--cancel {
      background: var(--card-dim);
    }
    &--confirm {
      background: var(--primary);
    }
    &--danger {
      background: var(--red);
    }
  }

  &__btn-text {
    font-size: 14px;
    font-weight: 600;
    &--cancel { color: var(--text-2); }
    &--confirm { color: #FFFFFF; }
    &--danger { color: #FFFFFF; }
  }
}
</style>
