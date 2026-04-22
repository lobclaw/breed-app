<template>
  <view
    v-if="message"
    class="submit-toast"
    :class="{ 'submit-toast--dismissing': dismissing }"
  >
    <view class="submit-toast__bubble">
      <text class="material-icons-round submit-toast__icon">check</text>
      <text class="submit-toast__text">{{ message }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  message: string
  dismissing?: boolean
}>()
</script>

<style lang="scss" scoped>
.submit-toast {
  position: fixed;
  inset: 0;
  z-index: 180;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  pointer-events: none;
}

.submit-toast__bubble {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  max-width: calc(100vw - 48px);
  padding: 12px 16px;
  border-radius: 18px;
  background: rgba(255, 252, 253, 0.94);
  border: 1px solid rgba(234, 62, 119, 0.08);
  box-shadow: 0 10px 24px rgba(45, 27, 20, 0.1);
  animation: submit-toast-fade-in 0.22s ease;
}

.submit-toast__icon {
  flex-shrink: 0;
  font-size: 16px;
  color: rgba(234, 62, 119, 0.88);
}

.submit-toast__text {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  color: rgba(76, 56, 51, 0.94);
  text-align: center;
}

.submit-toast--dismissing .submit-toast__bubble {
  opacity: 0;
  transform: translateY(8px) scale(0.985);
  transition: opacity 0.22s ease, transform 0.22s ease;
}

@keyframes submit-toast-fade-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
