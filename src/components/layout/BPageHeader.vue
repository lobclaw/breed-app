<!--
  BPageHeader — 页面标题栏
  标题 + 可选副标题 + 可选右侧操作按钮
  Props:
    title — 页面标题
    subtitle — 副标题（可选）
    showBack — 是否显示返回按钮（默认 true）
-->
<template>
  <view class="b-page-header">
    <view v-if="showBack" class="b-page-header__back" @click="goBack">
      <text class="material-icons-round" style="font-size: 24px; color: var(--text-1);">arrow_back</text>
    </view>
    <view class="b-page-header__center">
      <text class="b-page-header__title">{{ title }}</text>
      <text v-if="subtitle" class="b-page-header__subtitle">{{ subtitle }}</text>
    </view>
    <view class="b-page-header__right">
      <slot name="right" />
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  subtitle?: string
  showBack?: boolean
}>(), {
  showBack: true,
})

function goBack() {
  uni.navigateBack({ delta: 1 })
}
</script>

<style lang="scss" scoped>
.b-page-header {
  display: flex;
  align-items: center;
  padding: var(--space-header-top) var(--space-page) 12px;
  background: var(--bg);

  &__back {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;
    border-radius: 50%;
    transition: transform 0.12s ease;
    &:active { transform: scale(0.85); }
  }

  &__center {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 800;
    color: var(--text-1);
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__subtitle {
    font-size: 13px;
    color: var(--text-2);
    margin-top: 2px;
    display: block;
  }

  &__right {
    min-width: 36px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-left: 12px;
    flex-shrink: 0;
  }
}
</style>
