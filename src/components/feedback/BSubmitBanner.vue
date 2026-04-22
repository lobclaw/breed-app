<template>
  <view
    v-if="message"
    class="submit-banner"
    :class="{
      'submit-banner--floating': floating,
      'submit-banner--dismissing': dismissing,
    }"
  >
    <view class="submit-banner__main">
      <text class="material-icons-round submit-banner__icon">check</text>
      <text class="submit-banner__text">{{ message }}</text>
    </view>
    <view v-if="actionLabel" class="submit-banner__action" @click="$emit('action')">
      <text class="submit-banner__action-text">{{ actionLabel }}</text>
      <text class="material-icons-round submit-banner__action-icon">chevron_right</text>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  message: string
  actionLabel?: string
  floating?: boolean
  dismissing?: boolean
}>()

defineEmits<{ action: [] }>()
</script>

<style lang="scss" scoped>
.submit-banner {
  margin: 0 var(--space-page) 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(79, 170, 115, 0.14), rgba(79, 170, 115, 0.08));
  border: 1px solid rgba(79, 170, 115, 0.18);
  display: flex;
  align-items: center;
  gap: 8px;
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.submit-banner__main {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.submit-banner__icon {
  font-size: 16px;
  color: var(--green);
  flex-shrink: 0;
}

.submit-banner__text {
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.submit-banner__action {
  display: none;
}

.submit-banner__action-text {
  font-size: 12px;
  font-weight: 700;
}

.submit-banner__action-icon {
  display: none;
}

.submit-banner--floating {
  position: fixed;
  left: 50%;
  top: 50%;
  right: auto;
  bottom: auto;
  z-index: 140;
  margin: 0;
  padding: 11px 16px;
  border-radius: 18px;
  background: rgba(255, 252, 253, 0.94);
  border-color: rgba(234, 62, 119, 0.07);
  box-shadow: 0 8px 18px rgba(45, 27, 20, 0.08);
  gap: 8px;
  transform: translate(-50%, -50%);
  width: auto;
  max-width: calc(100vw - 40px);
  animation: submit-banner-float-in 0.24s ease;
}

.submit-banner--floating .submit-banner__main {
  gap: 8px;
  justify-content: center;
}

.submit-banner--floating .submit-banner__icon {
  font-size: 16px;
  color: rgba(234, 62, 119, 0.88);
}

.submit-banner--floating .submit-banner__text {
  font-size: 12px;
  font-weight: 700;
  color: rgba(76, 56, 51, 0.92);
  letter-spacing: 0.1px;
  text-align: center;
}

.submit-banner--floating .submit-banner__action {
  display: block;
  flex-shrink: 0;
  min-height: auto;
  padding: 0 0 0 6px;
  border-radius: 0;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  gap: 0;
}

.submit-banner--floating .submit-banner__action:active {
  opacity: 0.68;
}

.submit-banner--floating .submit-banner__action-text {
  font-size: 11px;
  font-weight: 700;
  color: rgba(234, 62, 119, 0.82);
}

.submit-banner--floating .submit-banner__action-icon {
  display: block;
  font-size: 14px;
  line-height: 1;
  color: rgba(234, 62, 119, 0.56);
}

.submit-banner--dismissing {
  opacity: 0;
  transform: translateY(8px) scale(0.985);
  pointer-events: none;
}

.submit-banner--floating.submit-banner--dismissing {
  transform: translate(-50%, calc(-50% + 8px)) scale(0.985);
}

@keyframes submit-banner-float-in {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.submit-banner--floating {
  animation-name: submit-banner-float-in-center;
}

@keyframes submit-banner-float-in-center {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 12px)) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
</style>
