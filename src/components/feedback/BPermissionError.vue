<!--
  BPermissionError — 权限不足状态
  居中布局：锁图标 + 标题 + 描述 + 返回按钮
  Props:
    visible — 是否显示
-->
<template>
  <view v-if="visible" class="b-permission-error">
    <text class="b-permission-error__icon material-icons-round">lock</text>
    <text class="b-permission-error__title">无权访问</text>
    <text class="b-permission-error__desc">此功能仅管理员可用</text>
    <view class="b-permission-error__btn" @click="goBack">
      <text class="b-permission-error__btn-text">返回</text>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

function goBack() {
  uni.navigateBack({ delta: 1 })
}
</script>

<style lang="scss" scoped>
.b-permission-error {
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
    color: var(--text-2);
  }
}
</style>
