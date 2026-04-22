<!--
  BDeleteConfirm — 通用删除确认弹窗 (GM-1 ~ GM-5)
  基于 BModal 的危险操作确认弹窗，带红色确认按钮和 30 天恢复提示
  Props:
    visible — 是否显示
    title — 标题（默认 "确认删除"）
    content — 描述文字
    itemName — 被删除项的名称（可选，用于描述生成）
  Events:
    confirm — 确认删除
    cancel — 取消
    update:visible — v-model 绑定
-->
<template>
  <view v-if="renderVisible" class="b-delete-confirm">
    <view class="b-delete-confirm__mask" :class="{ 'b-delete-confirm__mask--open': animOpen }" @click="cancel" @touchmove.prevent />
    <view class="b-delete-confirm__panel" :class="{ 'b-delete-confirm__panel--open': animOpen }">
      <!-- 警告图标 -->
      <view class="b-delete-confirm__icon-wrap">
        <text class="material-icons-round b-delete-confirm__icon">warning</text>
      </view>
      <!-- 标题 -->
      <text class="b-delete-confirm__title">{{ title }}</text>
      <!-- 描述 -->
      <text v-if="content" class="b-delete-confirm__content">{{ content }}</text>
      <!-- 恢复提示 -->
      <view class="b-delete-confirm__notice">
        <text class="material-icons-round b-delete-confirm__notice-icon">schedule</text>
        <text class="b-delete-confirm__notice-text">30天内可恢复</text>
      </view>
      <!-- 按钮区 -->
      <view class="b-delete-confirm__actions">
        <view class="b-delete-confirm__btn b-delete-confirm__btn--cancel" @click="cancel">
          <text class="b-delete-confirm__btn-text b-delete-confirm__btn-text--muted">取消</text>
        </view>
        <view class="b-delete-confirm__btn b-delete-confirm__btn--danger" @click="doConfirm">
          <text class="b-delete-confirm__btn-text b-delete-confirm__btn-text--white">确认删除</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  visible: boolean
  title?: string
  content?: string
  itemName?: string
}>(), {
  title: '确认删除',
  content: '',
  itemName: '',
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: []
  cancel: []
}>()

const animOpen = ref(false)
const renderVisible = ref(props.visible)
const DELETE_CONFIRM_ANIMATION_MS = 200
let closeTimer: ReturnType<typeof setTimeout> | null = null

function clearCloseTimer() {
  if (!closeTimer) return
  clearTimeout(closeTimer)
  closeTimer = null
}

function openDialog() {
  clearCloseTimer()
  renderVisible.value = true
  nextTick(() => { animOpen.value = true })
}

function closeDialog() {
  animOpen.value = false
  clearCloseTimer()
  closeTimer = setTimeout(() => {
    renderVisible.value = false
    closeTimer = null
  }, DELETE_CONFIRM_ANIMATION_MS)
}

watch(() => props.visible, (val) => {
  if (val) {
    openDialog()
  } else if (renderVisible.value) {
    closeDialog()
  } else {
    animOpen.value = false
  }
}, { immediate: true })

function cancel() {
  if (!renderVisible.value) return
  animOpen.value = false
  emit('update:visible', false)
  emit('cancel')
}

function doConfirm() {
  emit('confirm')
  emit('update:visible', false)
}

onBeforeUnmount(() => {
  clearCloseTimer()
})
</script>

<style lang="scss" scoped>
.b-delete-confirm {
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

  &__icon-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 12px;
  }

  &__icon {
    font-family: 'Material Icons Round';
    font-size: 36px;
    color: var(--red);
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
    margin-bottom: 12px;
    line-height: 1.5;
  }

  &__notice {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 12px;
    background: var(--amber-soft);
    border-radius: var(--radius-date);
    margin-bottom: 20px;
  }

  &__notice-icon {
    font-family: 'Material Icons Round';
    font-size: 14px;
    color: var(--amber);
  }

  &__notice-text {
    font-size: 12px;
    font-weight: 600;
    color: var(--amber);
  }

  &__actions {
    display: flex;
    flex-direction: row;
    gap: 10px;
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
  }

  &__btn--danger {
    background: var(--red);
  }

  &__btn--cancel {
    background: var(--card-dim);
  }

  &__btn-text {
    font-size: 14px;
    font-weight: 600;
  }

  &__btn-text--white {
    color: #FFFFFF;
  }

  &__btn-text--muted {
    color: var(--text-2);
  }
}
</style>
