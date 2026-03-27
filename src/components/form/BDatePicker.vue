<!--
  BDatePicker — 日期选择器
  BSheet-based 月历日期选择，支持快捷选项
  Props:
    visible — 是否显示 (v-model)
    modelValue — 选中日期的时间戳（毫秒）
  Emits:
    update:modelValue(timestamp) — 确认选择
    update:visible — 关闭面板
-->
<template>
  <BSheet v-model:visible="sheetVisible" title="选择日期">
    <view class="b-date-picker">
      <!-- 快捷选项 -->
      <view class="b-date-picker__chips">
        <view
          v-for="chip in quickChips"
          :key="chip.label"
          class="b-date-picker__chip"
          :class="{ 'b-date-picker__chip--active': isChipActive(chip.date) }"
          @click="selectDate(chip.date)"
        >
          <text class="b-date-picker__chip-text">{{ chip.label }}</text>
        </view>
      </view>

      <!-- 月份导航 -->
      <view class="b-date-picker__nav">
        <view class="b-date-picker__nav-btn" @click="prevMonth">
          <text class="material-icons-round" style="font-size: 20px; color: var(--text-2);">chevron_left</text>
        </view>
        <text class="b-date-picker__nav-title">{{ currentYear }}年{{ currentMonth + 1 }}月</text>
        <view class="b-date-picker__nav-btn" @click="nextMonth">
          <text class="material-icons-round" style="font-size: 20px; color: var(--text-2);">chevron_right</text>
        </view>
      </view>

      <!-- 星期标签 -->
      <view class="b-date-picker__weekdays">
        <text v-for="w in weekdays" :key="w" class="b-date-picker__weekday">{{ w }}</text>
      </view>

      <!-- 日历网格 -->
      <view class="b-date-picker__grid">
        <!-- 前导空格 -->
        <view v-for="n in firstDayOffset" :key="'e' + n" class="b-date-picker__cell" />
        <!-- 日期 -->
        <view
          v-for="day in daysInMonth"
          :key="day"
          class="b-date-picker__cell"
          @click="selectDate(buildDate(currentYear, currentMonth, day))"
        >
          <view
            class="b-date-picker__day"
            :class="{
              'b-date-picker__day--selected': isSelected(day),
              'b-date-picker__day--today': isToday(day),
            }"
          >
            <text class="b-date-picker__day-text">{{ day }}</text>
          </view>
        </view>
      </view>

      <!-- 确认按钮 -->
      <view class="b-date-picker__footer">
        <view class="b-date-picker__confirm" @click="handleConfirm">
          <text class="b-date-picker__confirm-text">确定</text>
        </view>
      </view>
    </view>
  </BSheet>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BSheet from '../layout/BSheet.vue'

const props = defineProps<{
  visible: boolean
  modelValue?: number
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:modelValue': [value: number]
}>()

const sheetVisible = computed({
  get: () => props.visible,
  set: (val: boolean) => emit('update:visible', val),
})

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

// 当前显示的年月
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth())

// 当前选中日期
const selectedDate = ref<Date | null>(null)

// 快捷选项
const quickChips = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const dayBefore = new Date(today)
  dayBefore.setDate(dayBefore.getDate() - 2)

  return [
    { label: '今天', date: today },
    { label: '昨天', date: yesterday },
    { label: '前天', date: dayBefore },
  ]
})

// 初始化选中日期
watch(() => props.visible, (val) => {
  if (val) {
    const d = props.modelValue ? new Date(props.modelValue) : new Date()
    selectedDate.value = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    currentYear.value = d.getFullYear()
    currentMonth.value = d.getMonth()
  }
})

// 月历数据
const daysInMonth = computed(() => {
  return new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
})

const firstDayOffset = computed(() => {
  return new Date(currentYear.value, currentMonth.value, 1).getDay()
})

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function buildDate(y: number, m: number, d: number): Date {
  return new Date(y, m, d)
}

function selectDate(date: Date) {
  selectedDate.value = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  currentYear.value = date.getFullYear()
  currentMonth.value = date.getMonth()
}

function isSelected(day: number): boolean {
  if (!selectedDate.value) return false
  return (
    selectedDate.value.getFullYear() === currentYear.value &&
    selectedDate.value.getMonth() === currentMonth.value &&
    selectedDate.value.getDate() === day
  )
}

function isToday(day: number): boolean {
  const today = new Date()
  return (
    today.getFullYear() === currentYear.value &&
    today.getMonth() === currentMonth.value &&
    today.getDate() === day
  )
}

function isChipActive(date: Date): boolean {
  if (!selectedDate.value) return false
  return (
    selectedDate.value.getFullYear() === date.getFullYear() &&
    selectedDate.value.getMonth() === date.getMonth() &&
    selectedDate.value.getDate() === date.getDate()
  )
}

function handleConfirm() {
  if (selectedDate.value) {
    // 设置到北京时间当天开始（UTC+8）
    const ts = selectedDate.value.getTime()
    emit('update:modelValue', ts)
  }
  sheetVisible.value = false
}
</script>

<style lang="scss" scoped>
.b-date-picker {
  padding-bottom: 16px;

  /* 快捷选项 */
  &__chips {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__chip {
    padding: 6px 16px;
    border-radius: var(--radius-tag);
    background: var(--card-dim);
    transition: all 0.12s ease;

    &:active { transform: scale(0.94); filter: brightness(0.95); }

    &--active {
      background: var(--primary);
    }
  }

  &__chip-text {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
  }

  &__chip--active &__chip-text {
    color: #FFFFFF;
  }

  /* 月份导航 */
  &__nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  &__nav-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: transform 0.12s ease;
    &:active { transform: scale(0.85); }
  }

  &__nav-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    color: var(--text-1);
  }

  /* 星期 */
  &__weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-bottom: 8px;
  }

  &__weekday {
    text-align: center;
    font-size: 10px;
    font-weight: 500;
    color: var(--text-3);
  }

  /* 网格 */
  &__grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  &__cell {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
  }

  &__day {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-date);
    transition: all 0.12s ease;

    &:active { transform: scale(0.9); }

    &--today {
      border: 1.5px solid var(--primary);
    }

    &--selected {
      background: var(--primary);
      box-shadow: 0 3px 12px rgba(234, 62, 119, 0.3);
    }

    &--selected &-text {
      color: #FFFFFF;
    }
  }

  &__day-text {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__day--selected &__day-text {
    color: #FFFFFF;
  }

  /* 确认 */
  &__footer {
    margin-top: 16px;
  }

  &__confirm {
    width: 100%;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-btn);
    background: var(--primary);
    box-shadow: 0 4px 16px rgba(234, 62, 119, 0.25);
    transition: transform 0.12s ease, opacity 0.12s ease;
    &:active { transform: scale(0.94); opacity: 0.85; }
  }

  &__confirm-text {
    font-size: 15px;
    font-weight: 700;
    color: #FFFFFF;
  }
}
</style>
