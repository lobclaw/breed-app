<template>
  <view v-if="message" class="submit-banner">
    <text class="material-icons-round submit-banner__icon">check_circle</text>
    <text class="submit-banner__text">{{ message }}</text>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  message: string
}>()
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

  &__icon {
    font-size: 16px;
    color: var(--green);
    flex-shrink: 0;
  }

  &__text {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
  }
}
</style>
