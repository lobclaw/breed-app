<!--
  BNetworkError — 网络错误状态
  居中布局：WiFi 图标 + 标题 + 描述 + 重试按钮
  Props:
    visible — 是否显示
    onRetry — 重试回调
-->
<template>
  <view v-if="visible" class="b-network-error">
    <text class="b-network-error__icon material-icons-round">wifi_off</text>
    <text class="b-network-error__title">网络连接失败</text>
    <text class="b-network-error__desc">请检查网络后重试</text>
    <view class="b-network-error__btn" @click="handleRetry">
      <text class="b-network-error__btn-text">重试</text>
    </view>
  </view>
</template>

<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  onRetry?: () => void
}>()

function handleRetry() {
  if (props.onRetry) {
    props.onRetry()
  }
}
</script>

<style lang="scss" scoped>
.b-network-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;

  &__icon {
    font-family: 'Material Icons Round';
    font-size: 48px;
    color: var(--text-3);
    margin-bottom: 16px;
  }

  &__title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-1);
    margin-bottom: 6px;
    text-align: center;
  }

  &__desc {
    font-size: 13px;
    color: var(--text-2);
    text-align: center;
    margin-bottom: 24px;
  }

  &__btn {
    padding: 8px 18px;
    border-radius: var(--radius-btn);
    border: 1.5px solid var(--text-4);
    transition: transform 0.12s ease, opacity 0.12s ease;
    &:active { transform: scale(0.94); opacity: 0.85; }
  }

  &__btn-text {
    font-size: 13px;
    font-weight: 700;
    color: var(--primary);
  }
}
</style>
