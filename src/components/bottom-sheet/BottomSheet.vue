<template>
  <uni-popup ref="popupRef" type="bottom" :mask-click="maskClose" @change="onPopupChange">
    <view class="bottom-sheet" :style="{ maxHeight: maxHeight }">
      <!-- 拖拽指示条 -->
      <view class="bottom-sheet__handle">
        <view class="bottom-sheet__handle-bar" />
      </view>

      <!-- 标题栏 -->
      <view v-if="title || $slots.header" class="bottom-sheet__header">
        <slot name="header">
          <text class="bottom-sheet__title">{{ title }}</text>
          <text v-if="showClose" class="bottom-sheet__close" @click="close">×</text>
        </slot>
      </view>

      <!-- 内容区 -->
      <scroll-view scroll-y class="bottom-sheet__content">
        <slot />
      </scroll-view>

      <!-- 底部按钮区 -->
      <view v-if="$slots.footer || showConfirm" class="bottom-sheet__footer">
        <slot name="footer">
          <button
            v-if="showCancel"
            class="bottom-sheet__btn bottom-sheet__btn--cancel"
            @click="close"
          >
            {{ cancelText }}
          </button>
          <button
            v-if="showConfirm"
            class="bottom-sheet__btn bottom-sheet__btn--confirm"
            :disabled="confirmDisabled"
            :loading="confirmLoading"
            @click="$emit('confirm')"
          >
            {{ confirmText }}
          </button>
        </slot>
      </view>

      <!-- 安全区域 -->
      <view class="bottom-sheet__safe-area" />
    </view>
  </uni-popup>
</template>

<script setup lang="ts">
import { ref } from 'vue'

withDefaults(defineProps<{
  /** 标题 */
  title?: string
  /** 最大高度 */
  maxHeight?: string
  /** 点击遮罩关闭 */
  maskClose?: boolean
  /** 显示关闭按钮 */
  showClose?: boolean
  /** 显示确认按钮 */
  showConfirm?: boolean
  /** 显示取消按钮 */
  showCancel?: boolean
  /** 确认按钮文字 */
  confirmText?: string
  /** 取消按钮文字 */
  cancelText?: string
  /** 确认按钮禁用 */
  confirmDisabled?: boolean
  /** 确认按钮 loading */
  confirmLoading?: boolean
}>(), {
  title: '',
  maxHeight: '80vh',
  maskClose: true,
  showClose: true,
  showConfirm: false,
  showCancel: false,
  confirmText: '确定',
  cancelText: '取消',
  confirmDisabled: false,
  confirmLoading: false,
})

const emit = defineEmits<{
  confirm: []
  close: []
  change: [{ show: boolean }]
}>()

const popupRef = ref()

function open() {
  popupRef.value?.open()
}

function close() {
  popupRef.value?.close()
  emit('close')
}

function onPopupChange(e: { show: boolean }) {
  emit('change', e)
}

defineExpose({ open, close })
</script>

<style scoped>
.bottom-sheet {
  background: #ffffff;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
}

.bottom-sheet__handle {
  display: flex;
  justify-content: center;
  padding: 16rpx 0 8rpx;
}

.bottom-sheet__handle-bar {
  width: 64rpx;
  height: 8rpx;
  background: #e0e0e0;
  border-radius: 4rpx;
}

.bottom-sheet__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 32rpx 24rpx;
}

.bottom-sheet__title {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
}

.bottom-sheet__close {
  font-size: 48rpx;
  color: #999;
  line-height: 1;
  padding: 0 8rpx;
}

.bottom-sheet__content {
  flex: 1;
  padding: 0 32rpx;
  max-height: 60vh;
}

.bottom-sheet__footer {
  display: flex;
  gap: 20rpx;
  padding: 24rpx 32rpx;
  border-top: 1rpx solid #f0f0f0;
}

.bottom-sheet__btn {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bottom-sheet__btn--cancel {
  background: #f5f5f5;
  color: #666;
}

.bottom-sheet__btn--confirm {
  background: #007AFF;
  color: #ffffff;
}

.bottom-sheet__btn--confirm[disabled] {
  opacity: 0.5;
}

.bottom-sheet__safe-area {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
