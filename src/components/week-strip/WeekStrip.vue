<!--
  WeekStrip — 周历条（周一到周日）
  过去日期灰色不可点击，今天高亮，未来日期可点击
  参考 Things 3 / Apple Reminders 面向未来的设计
-->
<template>
  <view class="day-strip-wrap">
    <!-- 月份标题 -->
    <view class="month-header" @click="$emit('toggle-calendar')">
      <text class="month-text">{{ monthLabel }}</text>
      <text class="month-arrow">·</text>
    </view>

    <!-- 周一到周日 -->
    <view class="day-strip">
      <view
        v-for="day in days"
        :key="day.ts"
        class="day-cell"
        :class="{
          'today': day.ts === selectedDate,
          'past': day.isPast,
        }"
        @click="onDayClick(day)"
      >
        <!-- 星期标签 -->
        <text class="day-label" :class="{
          'day-label--today': day.isToday && day.ts === selectedDate,
          'day-label--past': day.isPast,
        }">
          {{ day.label }}
        </text>
        <!-- 日期数字方块 -->
        <view class="day-num" :class="{ 'day-num--today': day.ts === selectedDate }">
          <text class="day-num-text" :class="{
            'day-num-text--today': day.ts === selectedDate,
            'day-num-text--past': day.isPast,
          }">
            {{ day.date }}
          </text>
        </view>
        <!-- 事件圆点（过去日期不显示） -->
        <view class="event-dots">
          <view v-if="!day.isPast && day.count > 0" class="event-dot" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getBeijingDayStart } from '@/utils/date'

const props = defineProps<{
  selectedDate: number
  dayCounts?: Record<number, number>
}>()

const emit = defineEmits<{
  (e: 'select', ts: number): void
  (e: 'toggle-calendar'): void
}>()

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function startOfDay(ts: number): number {
  return getBeijingDayStart(ts)
}

// 依赖 selectedDate，确保 onShow 重置日期时重新计算（Date.now() 无响应式依赖）
const today = computed(() => {
  void props.selectedDate
  return startOfDay(Date.now())
})

// 计算本周一的时间戳
function getMonday(ts: number): number {
  const d = new Date(ts)
  const day = d.getDay() // 0=日 1=一 ... 6=六
  const diff = day === 0 ? -6 : 1 - day // 周日时回退6天，其他回退到周一
  d.setDate(d.getDate() + diff)
  return startOfDay(d.getTime())
}

const days = computed(() => {
  const result = []
  const DAY_MS = 86400000
  const mondayTs = getMonday(today.value)

  for (let i = 0; i < 7; i++) {
    const ts = mondayTs + i * DAY_MS
    const d = new Date(ts)
    const isToday = ts === today.value
    const isPast = ts < today.value
    const count = props.dayCounts?.[ts] || 0

    result.push({
      ts,
      date: d.getDate(),
      label: isToday ? '今' : WEEK_LABELS[d.getDay()],
      isToday,
      isPast,
      count,
    })
  }

  return result
})

const monthLabel = computed(() => {
  const d = new Date(props.selectedDate || today.value)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

function onDayClick(day: any) {
  if (day.isPast) return // 过去日期不可点击
  emit('select', day.ts)
}
</script>

<style lang="scss" scoped>
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
  &:active:not(.past) { transform: scale(0.9); }
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
  &--past {
    color: var(--text-4, #ccc);
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
  &--past {
    color: var(--text-4, #ccc);
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
