<!--
  WeekStrip — 7天日期预览条
  设计稿：home-v1-final.html .day-strip 区域
  月份标题 + 7天格子（星期标签 + 日期数字 + 事件圆点）
  今日高亮：品牌色底 + 白字 + 粉色阴影
-->
<template>
  <view class="day-strip-wrap">
    <!-- 月份标题：2026年3月 · -->
    <view class="month-header" @click="$emit('toggle-calendar')">
      <text class="month-text">{{ monthLabel }}</text>
      <text class="month-arrow">·</text>
    </view>

    <!-- 7天格子 -->
    <view class="day-strip">
      <view
        v-for="day in days"
        :key="day.ts"
        class="day-cell"
        :class="{ 'today': day.ts === selectedDate || (day.isToday && day.ts === selectedDate) }"
        @click="$emit('select', day.ts)"
      >
        <!-- 星期标签 -->
        <text class="day-label" :class="{ 'day-label--today': day.isToday && day.ts === selectedDate }">
          {{ day.label }}
        </text>
        <!-- 日期数字方块 -->
        <view class="day-num" :class="{ 'day-num--today': day.ts === selectedDate }">
          <text class="day-num-text" :class="{ 'day-num-text--today': day.ts === selectedDate }">
            {{ day.date }}
          </text>
        </view>
        <!-- 事件圆点 -->
        <view class="event-dots">
          <view v-if="day.count > 0" class="event-dot" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  selectedDate: number
  dayCounts?: Record<number, number>
}>()

defineEmits<{
  (e: 'select', ts: number): void
  (e: 'toggle-calendar'): void
}>()

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const today = computed(() => startOfDay(Date.now()))

const days = computed(() => {
  const result = []
  const DAY_MS = 86400000
  // 显示以今天为中心的7天（前3天 + 今天 + 后3天）
  const start = today.value - 3 * DAY_MS

  for (let i = 0; i < 7; i++) {
    const ts = start + i * DAY_MS
    const d = new Date(ts)
    const isToday = ts === today.value
    const count = props.dayCounts?.[ts] || 0

    result.push({
      ts,
      date: d.getDate(),
      label: isToday ? '今' : WEEK_LABELS[d.getDay()],
      isToday,
      count,
    })
  }

  return result
})

const monthLabel = computed(() => {
  const d = new Date(props.selectedDate || today.value)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})
</script>

<style lang="scss" scoped>
/* 一比一还原 home-v1-final.html .day-strip */
.day-strip-wrap {
  background: transparent;
}

/* 月份标题 */
.month-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 20px 8px;
}
.month-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.month-arrow {
  font-size: 16px;
  color: var(--text-3);
}

/* 7天格子行 */
.day-strip {
  display: flex;
  justify-content: space-between;
  padding: 0 20px 16px;
}

/* 单个日期格子 */
.day-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 40px;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.9); }
}

/* 星期标签 */
.day-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-3);
  text-transform: uppercase;

  &--today {
    color: var(--primary);
    font-weight: 700;
  }
}

/* 日期数字方块 */
.day-num {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;

  &--today {
    background: var(--primary);
    box-shadow: 0 3px 12px rgba(234, 62, 119, 0.3);
  }
}
.day-num-text {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);

  &--today {
    color: #FFFFFF;
  }
}

/* 事件圆点 */
.event-dots {
  display: flex;
  justify-content: center;
  height: 6px;
}
.event-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--red);
}
</style>
