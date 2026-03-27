<!--
  BEmpty — 空状态提示
  居中布局：图标 + 标题 + 描述 + 操作按钮
  Props:
    icon — Material Icons 名称（默认 inbox）
    title — 标题文字
    description — 描述文字（可选）
    actionText — 操作按钮文字（可选）
-->
<template>
  <view class="b-empty">
    <text class="b-empty__icon material-icons-round">{{ icon }}</text>
    <text class="b-empty__title">{{ title }}</text>
    <text v-if="description" class="b-empty__desc">{{ description }}</text>
    <view v-if="actionText" class="b-empty__action" @click="$emit('action')">
      <text class="b-empty__action-text">{{ actionText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title: string
  description?: string
  actionText?: string
}>(), {
  icon: 'inbox',
})

defineEmits<{ action: [] }>()
</script>

<style lang="scss" scoped>
.b-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;

  &__icon {
    font-family: 'Material Icons Round';
    font-size: 48px;
    color: var(--text-4);
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
    line-height: 1.5;
    margin-bottom: 20px;
  }

  &__action {
    padding: 8px 18px;
    border-radius: var(--radius-btn);
    border: 1.5px solid var(--text-4);
    transition: transform 0.12s ease, opacity 0.12s ease;
    &:active { transform: scale(0.94); opacity: 0.85; }
  }

  &__action-text {
    font-size: 13px;
    font-weight: 600;
    color: var(--primary);
  }
}
</style>
