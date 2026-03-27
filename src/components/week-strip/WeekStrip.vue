<template>
  <view class="week-strip">
    <!-- 月份标题 -->
    <view class="week-strip__header" @click="$emit('toggle-calendar')">
      <text class="week-strip__month">{{ monthLabel }}</text>
      <text class="week-strip__arrow">&#9662;</text>
    </view>

    <!-- 7天导航 -->
    <scroll-view scroll-x class="week-strip__days" :scroll-left="scrollLeft">
      <view
        v-for="day in days"
        :key="day.ts"
        class="week-strip__day"
        :class="{
          'week-strip__day--active': day.ts === selectedDate,
          'week-strip__day--today': day.isToday,
        }"
        @click="$emit('select', day.ts)"
      >
        <text class="week-strip__day-label">{{ day.label }}</text>
        <text class="week-strip__day-num">{{ day.date }}</text>
        <view v-if="day.count > 0" class="week-strip__day-dot">
          <text class="week-strip__day-count">{{ day.count > 9 ? '9+' : day.count }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  /** 当前选中日期 timestamp（毫秒，0点） */
  selectedDate: number
  /** 每天事件数 Record<timestamp, count> */
  dayCounts?: Record<number, number>
}>()

defineEmits<{
  (e: 'select', ts: number): void
  (e: 'toggle-calendar'): void
}>()

const scrollLeft = ref(0)
const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

/** 获取日期 0 点 timestamp */
function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const today = computed(() => startOfDay(Date.now()))

const days = computed(() => {
  const result = []
  const DAY_MS = 86400000
  // 显示过去2天 + 今天 + 未来11天 = 14天
  const start = today.value - 2 * DAY_MS

  for (let i = 0; i < 14; i++) {
    const ts = start + i * DAY_MS
    const d = new Date(ts)
    const dayOfWeek = d.getDay()
    const isToday = ts === today.value

    result.push({
      ts,
      date: d.getDate(),
      label: isToday ? '今' : WEEK_LABELS[dayOfWeek],
      isToday,
      count: props.dayCounts?.[ts] || 0,
    })
  }

  return result
})

const monthLabel = computed(() => {
  const d = new Date(props.selectedDate || today.value)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

// 初始滚动到"今天"附近
watch(
  () => days.value,
  () => {
    // 今天是第3个元素（index=2），每个元素约90rpx宽
    // 滚动使今天居中偏左
    scrollLeft.value = 0
  },
  { immediate: true }
)
</script>

<style scoped>
.week-strip { background: #fff; border-bottom: 1rpx solid #f0f0f0; }
.week-strip__header { display: flex; align-items: center; justify-content: center; padding: 12rpx 0 4rpx; gap: 8rpx; }
.week-strip__month { font-size: 26rpx; color: #333; font-weight: 500; }
.week-strip__arrow { font-size: 20rpx; color: #999; }
.week-strip__days { display: flex; white-space: nowrap; padding: 8rpx 16rpx 16rpx; }
.week-strip__day { display: inline-flex; flex-direction: column; align-items: center; width: 90rpx; min-width: 90rpx; padding: 8rpx 0; border-radius: 16rpx; position: relative; }
.week-strip__day--active { background: #007AFF; }
.week-strip__day--active .week-strip__day-label { color: #fff; }
.week-strip__day--active .week-strip__day-num { color: #fff; }
.week-strip__day--today .week-strip__day-num { color: #007AFF; font-weight: 700; }
.week-strip__day--active.week-strip__day--today .week-strip__day-num { color: #fff; }
.week-strip__day-label { font-size: 22rpx; color: #999; }
.week-strip__day-num { font-size: 32rpx; color: #333; font-weight: 500; margin-top: 4rpx; }
.week-strip__day-dot { position: absolute; top: 2rpx; right: 10rpx; min-width: 28rpx; height: 28rpx; border-radius: 14rpx; background: #FF3B30; display: flex; align-items: center; justify-content: center; }
.week-strip__day-count { font-size: 18rpx; color: #fff; font-weight: 600; }
</style>
