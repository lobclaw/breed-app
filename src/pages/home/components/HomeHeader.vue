<template>
  <view class="header">
    <view class="header-top">
      <view class="greeting-text">
        <text class="greeting-title">{{ greetingText }}</text>
        <text class="greeting-sub">{{ greetingSubText }}</text>
      </view>
      <view class="avatar">
        <text class="material-icons-round" style="color: #fff; font-size: 22px;">pets</text>
      </view>
    </view>
    <view class="summary-pills">
      <view
        v-for="pill in summaryPills"
        :key="pill.key"
        class="pill"
        :class="pill.pillClass"
        @click="$emit('scroll-section', pill.key)"
      >
        <view class="pill-dot" :style="{ background: pill.dotColor }" />
        <text class="pill-label">{{ pill.label }}</text>
        <text class="pill-num">{{ pill.count }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  greetingText: string
  greetingSubText: string
  summaryPills: Array<{
    key: string
    label: string
    count: number
    dotColor: string
    pillClass: string
  }>
}>()

defineEmits<{
  (event: 'scroll-section', key: string): void
}>()
</script>

<style lang="scss" scoped>
.header {
  padding: 12px 20px 0;
}
.header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.greeting-title {
  display: block;
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.3;
}
.greeting-sub {
  display: block;
  font-size: 13px;
  color: var(--text-2);
  margin-top: 2px;
}
.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.summary-pills {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 16px;
  padding-bottom: 16px;
}
.pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  padding: 8px 0;
  border-radius: 16px;
  transition: transform 0.12s ease, filter 0.12s ease;
  &:active { transform: scale(0.95); filter: brightness(0.95); }
}
.pill-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pill-label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
.pill-num {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}
.pill-red {
  background: var(--red-soft);
  .pill-label, .pill-num { color: var(--red); }
}
.pill-amber {
  background: var(--amber-soft);
  .pill-label, .pill-num { color: var(--amber); }
}
.pill-blue {
  background: var(--blue-soft);
  .pill-label, .pill-num { color: var(--blue); }
}
.pill-plum {
  background: var(--plum-soft);
  .pill-label, .pill-num { color: var(--plum); }
}
</style>
