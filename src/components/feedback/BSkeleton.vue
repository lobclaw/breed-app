<!--
  BSkeleton — 骨架屏加载占位
  卡片式骨架占位符，带 shimmer 光扫动画
  Props:
    rows — 行数（默认 3）
    avatar — 是否显示头像占位（默认 false）
-->
<template>
  <view class="b-skeleton">
    <view v-for="i in rows" :key="i" class="b-skeleton__card">
      <view v-if="avatar" class="b-skeleton__avatar b-skeleton__shimmer" />
      <view class="b-skeleton__content">
        <view class="b-skeleton__line b-skeleton__line--title b-skeleton__shimmer" />
        <view class="b-skeleton__line b-skeleton__line--sub b-skeleton__shimmer" />
        <view class="b-skeleton__line b-skeleton__line--btn b-skeleton__shimmer" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  rows?: number
  avatar?: boolean
}>(), {
  rows: 3,
  avatar: false,
})
</script>

<style lang="scss" scoped>
.b-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);

  &__card {
    background: var(--card);
    border-radius: var(--radius-card);
    padding: var(--space-card);
    box-shadow: var(--shadow);
    display: flex;
    gap: 12px;
  }

  &__avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__line {
    border-radius: 4px;

    &--title { width: 60%; height: 14px; }
    &--sub { width: 40%; height: 12px; }
    &--btn { width: 30%; height: 32px; border-radius: var(--radius-btn); }
  }

  /* Shimmer 光扫动画 */
  &__shimmer {
    background: linear-gradient(
      90deg,
      var(--card-dim) 25%,
      rgba(255, 255, 255, 0.3) 50%,
      var(--card-dim) 75%
    );
    background-size: 200% 100%;
    animation: b-shimmer 1.5s infinite;
  }
}

@keyframes b-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
