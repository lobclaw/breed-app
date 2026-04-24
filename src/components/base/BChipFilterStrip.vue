<!--
  BChipFilterStrip — 横向筛选胶囊条
  统一承接横向滚动、激活态和点击后自动定位
-->
<template>
  <view class="b-chip-filter-strip">
    <scroll-view
      scroll-x
      scroll-with-animation
      class="b-chip-filter-strip__scroll"
      :scroll-left="scrollLeft"
      show-scrollbar="false"
      enhanced
      @scroll="handleScroll"
    >
      <view class="b-chip-filter-strip__inner">
        <view
          v-for="option in options"
          :key="`${option.value}`"
          class="b-chip-filter-strip__chip primary-page-tab"
          :class="{
            'primary-page-tab--active': isActive(option.value),
            'b-chip-filter-strip__chip--active': isActive(option.value),
          }"
          @click="handleSelect(option.value)"
        >
          <text class="b-chip-filter-strip__text">{{ option.label }}</text>
        </view>
      </view>
    </scroll-view>
    <view v-if="showFade" class="b-chip-filter-strip__fade" />
  </view>
</template>

<script setup lang="ts">
import { getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type ChipValue = string | number

interface ChipOption {
  label: string
  value: ChipValue
}

type FocusMode = 'auto' | 'force'

type StripLayoutMetrics = {
  viewportWidth: number
  contentWidth: number
  currentScrollLeft: number
  chipLeft: number
  chipWidth: number
}

const props = withDefaults(defineProps<{
  modelValue: ChipValue
  options: ChipOption[]
  showFade?: boolean
}>(), {
  showFade: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: ChipValue]
  change: [value: ChipValue]
}>()

const instance = getCurrentInstance()
const scrollLeft = ref(0)
const FOCUS_RATIO = 0.38
const AUTO_TOLERANCE_PX = 12
const FORCE_MIN_DELTA_PX = 8
let focusTimer: ReturnType<typeof setTimeout> | null = null
let pendingFocusMode: FocusMode = 'auto'

function isActive(value: ChipValue) {
  return props.modelValue === value
}

function handleScroll(event: any) {
  scrollLeft.value = Number(event?.detail?.scrollLeft || 0)
}

function handleSelect(value: ChipValue) {
  if (props.modelValue === value) {
    scheduleFocusActiveChip('force')
    return
  }

  pendingFocusMode = 'force'
  emit('update:modelValue', value)
  emit('change', value)
}

function scheduleFocusActiveChip(mode: FocusMode = 'auto') {
  if (!instance) return
  if (focusTimer) clearTimeout(focusTimer)
  nextTick(() => {
    focusTimer = setTimeout(() => {
      focusActiveChip(mode)
    }, 20)
  })
}

function measureStripLayout(callback: (metrics: StripLayoutMetrics | null) => void) {
  if (!instance) {
    callback(null)
    return
  }

  const query = uni.createSelectorQuery().in(instance)
  query.select('.b-chip-filter-strip__scroll').boundingClientRect()
  query.select('.b-chip-filter-strip__inner').boundingClientRect()
  query.select('.b-chip-filter-strip__chip--active').boundingClientRect()
  query.exec((result) => {
    const [containerRect, contentRect, chipRect] = result || []
    if (!containerRect || !contentRect || !chipRect) {
      callback(null)
      return
    }

    callback({
      viewportWidth: Number(containerRect.width || 0),
      contentWidth: Number(contentRect.width || 0),
      currentScrollLeft: Math.max(0, Number(containerRect.left || 0) - Number(contentRect.left || 0)),
      chipLeft: Number(chipRect.left || 0) - Number(contentRect.left || 0),
      chipWidth: Number(chipRect.width || 0),
    })
  })
}

function computeTargetScrollLeft(metrics: StripLayoutMetrics, mode: FocusMode) {
  const desiredChipLeft = metrics.viewportWidth * FOCUS_RATIO - metrics.chipWidth / 2
  const maxScrollLeft = Math.max(0, metrics.contentWidth - metrics.viewportWidth)
  let targetScrollLeft = metrics.chipLeft - desiredChipLeft
  targetScrollLeft = Math.min(maxScrollLeft, Math.max(0, targetScrollLeft))

  const delta = targetScrollLeft - metrics.currentScrollLeft
  if (mode === 'force' && Math.abs(delta) > 0 && Math.abs(delta) < FORCE_MIN_DELTA_PX) {
    targetScrollLeft = metrics.currentScrollLeft + Math.sign(delta) * FORCE_MIN_DELTA_PX
    targetScrollLeft = Math.min(maxScrollLeft, Math.max(0, targetScrollLeft))
  }

  return targetScrollLeft
}

function isChipWithinCorridor(metrics: StripLayoutMetrics) {
  const chipCenter = metrics.chipLeft - metrics.currentScrollLeft + metrics.chipWidth / 2
  const desiredCenter = metrics.viewportWidth * FOCUS_RATIO
  return Math.abs(chipCenter - desiredCenter) <= AUTO_TOLERANCE_PX
}

function focusActiveChip(mode: FocusMode = 'auto', retryCount = 1) {
  measureStripLayout((metrics) => {
    if (!metrics) {
      if (retryCount > 0) {
        setTimeout(() => focusActiveChip(mode, retryCount - 1), 16)
      }
      return
    }

    if (mode === 'auto' && isChipWithinCorridor(metrics)) return

    const nextScrollLeft = computeTargetScrollLeft(metrics, mode)
    if (Math.abs(nextScrollLeft - metrics.currentScrollLeft) < 0.5) return
    scrollLeft.value = nextScrollLeft
  })
}

watch(() => props.modelValue, () => {
  const nextMode = pendingFocusMode
  pendingFocusMode = 'auto'
  scheduleFocusActiveChip(nextMode)
})

watch(() => props.options, () => {
  scheduleFocusActiveChip('auto')
}, { deep: true })

onMounted(() => {
  scheduleFocusActiveChip('auto')
})

onBeforeUnmount(() => {
  if (focusTimer) clearTimeout(focusTimer)
})
</script>

<style lang="scss" scoped>
.b-chip-filter-strip {
  position: relative;
}

.b-chip-filter-strip__scroll {
  white-space: nowrap;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  :deep(::-webkit-scrollbar) {
    display: none;
  }
}

.b-chip-filter-strip__inner {
  display: inline-flex;
  min-width: max-content;
  gap: 8px;
  padding: var(--primary-page-subsection-gap) var(--space-page) 0;
}

.b-chip-filter-strip__chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.b-chip-filter-strip__text {
  display: block;
  white-space: nowrap;
  line-height: 1.2;
}

.b-chip-filter-strip__fade {
  position: absolute;
  top: var(--primary-page-subsection-gap);
  right: 0;
  bottom: 0;
  width: 30px;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(250, 246, 246, 0) 0%, rgba(250, 246, 246, 0.88) 58%, var(--bg) 100%);
}
</style>
