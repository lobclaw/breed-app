<!--
  BTabBar — 页面内 Tab 切换
  下划线指示器 + 滑动切换
  Props:
    tabs — Tab 项数组 [{ key, label }]
    modelValue — 当前选中的 key
-->
<template>
  <view class="b-tab-bar">
    <view
      v-for="tab in tabs"
      :key="tab.key"
      class="b-tab-bar__item"
      :class="{ 'b-tab-bar__item--active': modelValue === tab.key }"
      @click="$emit('update:modelValue', tab.key)"
    >
      <text class="b-tab-bar__label">{{ tab.label }}</text>
    </view>
    <!-- 下划线指示器 -->
    <view
      class="b-tab-bar__indicator"
      :style="{ left: indicatorLeft, width: indicatorWidth }"
    />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface TabItem {
  key: string
  label: string
}

const props = defineProps<{
  tabs: TabItem[]
  modelValue: string
}>()

defineEmits<{ 'update:modelValue': [key: string] }>()

const activeIndex = computed(() => props.tabs.findIndex(t => t.key === props.modelValue))
const indicatorWidth = computed(() => (100 / props.tabs.length) + '%')
const indicatorLeft = computed(() => (activeIndex.value * 100 / props.tabs.length) + '%')
</script>

<style lang="scss" scoped>
.b-tab-bar {
  position: relative;
  display: flex;
  border-bottom: 1px solid var(--card-dim);
  background: var(--card);

  &__item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 0;
    cursor: pointer;
    transition: color 0.2s ease;

    &--active .b-tab-bar__label {
      color: var(--primary);
      font-weight: 700;
    }
  }

  &__label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-3);
  }

  &__indicator {
    position: absolute;
    bottom: 0;
    height: 2px;
    background: var(--primary);
    border-radius: 1px;
    transition: left 0.25s ease;
  }
}
</style>
