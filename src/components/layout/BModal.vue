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
-->
<template>
  <view v-if="visible" class="b-modal">
    <view class="b-modal__mask" @click="cancel" />
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
import { ref, computed, watch, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  visible: boolean
  title: string
  content?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}>(), {
  content: '',
  confirmText: '确定',
  cancelText: '取消',
  danger: false,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: []
  cancel: []
}>()

const animOpen = ref(false)

watch(() => props.visible, (val) => {
  if (val) nextTick(() => { animOpen.value = true })
  else animOpen.value = false
})

const btnClass = computed(() => props.danger ? 'b-modal__btn--danger' : '')
const btnTextClass = computed(() => props.danger ? 'b-modal__btn-text--danger' : '')

function cancel() {
  animOpen.value = false
  setTimeout(() => {
    emit('update:visible', false)
    emit('cancel')
  }, 200)
}

function confirm() {
  emit('confirm')
  emit('update:visible', false)
}
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
  }

  &__panel {
    position: relative;
    background: var(--card);
    border-radius: var(--radius-card);
    padding: 24px;
    width: 80%;
    max-width: 320px;
    transform: scale(0.9);
    opacity: 0;
    transition: transform 0.2s ease, opacity 0.2s ease;

    &--open {
      transform: scale(1);
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
