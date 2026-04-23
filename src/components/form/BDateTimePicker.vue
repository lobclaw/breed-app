<template>
  <view v-if="renderVisible" class="b-date-time-picker">
    <view class="b-date-time-picker__mask" :class="{ 'b-date-time-picker__mask--open': animOpen }" @click="close" @touchmove.prevent />
    <view class="b-date-time-picker__panel" :class="{ 'b-date-time-picker__panel--open': animOpen }">
      <view class="b-date-time-picker__toolbar">
        <text class="b-date-time-picker__toolbar-action" @click="handleToolbarLeft">
          {{ toolbarLeftLabel }}
        </text>
        <text class="b-date-time-picker__toolbar-title">{{ toolbarTitle }}</text>
        <text class="b-date-time-picker__toolbar-action b-date-time-picker__toolbar-action--primary" @click="handleToolbarRight">
          {{ toolbarRightLabel }}
        </text>
      </view>

      <view class="b-date-time-picker__body" @touchmove.stop>
        <template v-if="mode === 'time'">
          <view class="b-date-time-picker__time-card">
            <view class="b-date-time-picker__time-row">
              <text class="b-date-time-picker__time-label">时刻</text>
              <text class="b-date-time-picker__time-value">{{ draftTimeText }}</text>
            </view>
          </view>
          <picker-view
            class="b-date-time-picker__time-picker"
            :value="timePickerValue"
            :indicator-style="indicatorStyle"
            @change="onTimePickerChange"
          >
            <picker-view-column>
              <view v-for="hour in hours" :key="`hour-${hour}`" class="b-date-time-picker__picker-item">
                <text class="b-date-time-picker__picker-item-text">{{ pad2(hour) }}</text>
              </view>
            </picker-view-column>
            <picker-view-column>
              <view v-for="minute in minutes" :key="`minute-${minute}`" class="b-date-time-picker__picker-item">
                <text class="b-date-time-picker__picker-item-text">{{ pad2(minute) }}</text>
              </view>
            </picker-view-column>
          </picker-view>
        </template>

        <template v-else-if="currentView === 'calendar'">
          <view class="b-date-time-picker__month-nav">
            <view class="b-date-time-picker__nav-btn" @click="goPrevMonth">
              <text class="material-icons-round">chevron_left</text>
            </view>
            <view class="b-date-time-picker__month-title" @click="openMonthPanel">
              <text>{{ calendarMonthLabel }}</text>
              <text class="material-icons-round b-date-time-picker__month-title-icon">arrow_drop_down</text>
            </view>
            <view class="b-date-time-picker__nav-btn" @click="goNextMonth">
              <text class="material-icons-round">chevron_right</text>
            </view>
          </view>

          <view class="b-date-time-picker__weekdays">
            <text v-for="label in weekLabels" :key="label" class="b-date-time-picker__weekday">{{ label }}</text>
          </view>

          <view class="b-date-time-picker__calendar-grid">
            <view
              v-for="cell in calendarCells"
              :key="cell.key"
              class="b-date-time-picker__calendar-cell"
              :class="{
                'b-date-time-picker__calendar-cell--muted': !cell.isCurrentMonth,
                'b-date-time-picker__calendar-cell--today': cell.isToday && !cell.isSelected,
              }"
              @click="selectCalendarCell(cell)"
            >
              <view
                class="b-date-time-picker__calendar-day"
                :class="{ 'b-date-time-picker__calendar-day--selected': cell.isSelected }"
              >
                <text
                  class="b-date-time-picker__calendar-day-text"
                  :class="{ 'b-date-time-picker__calendar-day-text--selected': cell.isSelected }"
                >
                  {{ cell.day }}
                </text>
              </view>
            </view>
          </view>

          <view class="b-date-time-picker__time-card" @click="openTimePanel">
            <view class="b-date-time-picker__time-row">
              <text class="b-date-time-picker__time-label">时刻</text>
              <view class="b-date-time-picker__time-value-wrap">
                <text class="b-date-time-picker__time-value">{{ draftTimeText }}</text>
                <text class="material-icons-round b-date-time-picker__time-arrow">chevron_right</text>
              </view>
            </view>
          </view>
        </template>

        <template v-else-if="currentView === 'month'">
          <view class="b-date-time-picker__subpanel-header">
            <text class="b-date-time-picker__subpanel-kicker">当前选择</text>
            <text class="b-date-time-picker__subpanel-title">{{ monthPanelLabel }}</text>
          </view>
          <picker-view
            class="b-date-time-picker__month-picker b-date-time-picker__picker-view--wheel"
            :value="monthPickerValue"
            :indicator-style="indicatorStyle"
            @change="onMonthPickerChange"
          >
            <picker-view-column>
              <view
                v-for="year in years"
                :key="`year-${year}`"
                class="b-date-time-picker__picker-item"
                :class="{ 'b-date-time-picker__picker-item--selected': year === panelYear }"
              >
                <text
                  class="b-date-time-picker__picker-item-text"
                  :class="{ 'b-date-time-picker__picker-item-text--selected': year === panelYear }"
                >
                  {{ year }}年
                </text>
              </view>
            </picker-view-column>
            <picker-view-column>
              <view
                v-for="month in months"
                :key="`month-${month}`"
                class="b-date-time-picker__picker-item"
                :class="{ 'b-date-time-picker__picker-item--selected': month === panelMonth }"
              >
                <text
                  class="b-date-time-picker__picker-item-text"
                  :class="{ 'b-date-time-picker__picker-item-text--selected': month === panelMonth }"
                >
                  {{ pad2(month) }}月
                </text>
              </view>
            </picker-view-column>
          </picker-view>
        </template>

        <template v-else>
          <view class="b-date-time-picker__time-card">
            <view class="b-date-time-picker__time-row" @click="backToCalendar">
              <text class="b-date-time-picker__time-label">日期</text>
              <view class="b-date-time-picker__time-value-wrap">
                <text class="b-date-time-picker__time-value">{{ draftDateMetaText }}</text>
                <text class="material-icons-round b-date-time-picker__time-arrow">chevron_right</text>
              </view>
            </view>
            <view class="b-date-time-picker__time-row b-date-time-picker__time-row--active">
              <text class="b-date-time-picker__time-label">时刻</text>
              <text class="b-date-time-picker__time-value b-date-time-picker__time-value--strong">{{ draftTimeText }}</text>
            </view>
          </view>
          <picker-view
            class="b-date-time-picker__time-picker b-date-time-picker__picker-view--wheel"
            :value="timePickerValue"
            :indicator-style="indicatorStyle"
            @change="onTimePickerChange"
          >
            <picker-view-column>
              <view
                v-for="hour in hours"
                :key="`sub-hour-${hour}`"
                class="b-date-time-picker__picker-item"
                :class="{ 'b-date-time-picker__picker-item--selected': hour === selectedHour }"
              >
                <text
                  class="b-date-time-picker__picker-item-text"
                  :class="{ 'b-date-time-picker__picker-item-text--selected': hour === selectedHour }"
                >
                  {{ pad2(hour) }}
                </text>
              </view>
            </picker-view-column>
            <picker-view-column>
              <view
                v-for="minute in minutes"
                :key="`sub-minute-${minute}`"
                class="b-date-time-picker__picker-item"
                :class="{ 'b-date-time-picker__picker-item--selected': minute === normalizeMinute(selectedMinute) }"
              >
                <text
                  class="b-date-time-picker__picker-item-text"
                  :class="{ 'b-date-time-picker__picker-item-text--selected': minute === normalizeMinute(selectedMinute) }"
                >
                  {{ pad2(minute) }}
                </text>
              </view>
            </picker-view-column>
          </picker-view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  buildTimestampFromDateParts,
  clampDayInMonth,
  formatDateParts,
  formatTimeParts,
  getDaysInMonth,
  getDraftTimestamp,
  parseDateString,
  parseTimeString,
  replaceTimestampDateParts,
  replaceTimestampTimeParts,
} from '@/utils/date'

type PickerMode = 'date' | 'time' | 'datetime' | 'month'
type PickerValueType = 'timestamp' | 'date-string' | 'time-string'
type PickerViewMode = 'calendar' | 'month' | 'time'

interface CalendarCell {
  key: string
  year: number
  month: number
  day: number
  monthIndex: number
  isCurrentMonth: boolean
  isSelected: boolean
  isToday: boolean
}

const props = withDefaults(defineProps<{
  visible: boolean
  modelValue?: number | string | null
  mode?: PickerMode
  valueType?: PickerValueType
  yearStart?: number
  yearEnd?: number
  minuteStep?: number
}>(), {
  modelValue: null,
  mode: 'date',
  valueType: 'timestamp',
  yearStart: 1990,
  yearEnd: new Date().getFullYear() + 10,
  minuteStep: 1,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:modelValue': [value: number | string]
  confirm: [value: number | string]
}>()

const PICKER_ANIMATION_MS = 250
const indicatorStyle = 'height: 54px; background: transparent;'
const weekLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const renderVisible = ref(props.visible)
const animOpen = ref(false)
const currentView = ref<PickerViewMode>('calendar')
const draftTimestamp = ref(Date.now())
const calendarYear = ref(new Date().getFullYear())
const calendarMonth = ref(new Date().getMonth() + 1)
const panelYear = ref(calendarYear.value)
const panelMonth = ref(calendarMonth.value)
const monthPickerValue = ref([0, 0])
const timePickerValue = ref([0, 0])
let closeTimer: ReturnType<typeof setTimeout> | null = null

const years = computed(() => {
  const start = props.yearStart
  const end = Math.max(props.yearEnd, start)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})

const months = computed(() => Array.from({ length: 12 }, (_, index) => index + 1))
const hours = Array.from({ length: 24 }, (_, index) => index)

const minutes = computed(() => {
  const step = Math.min(Math.max(props.minuteStep, 1), 30)
  const result: number[] = []
  for (let value = 0; value < 60; value += step) {
    result.push(value)
  }
  return result
})

const draftDate = computed(() => new Date(draftTimestamp.value))
const mode = computed(() => props.mode)
const isMonthOnlyMode = computed(() => props.mode === 'month')
const selectedYear = computed(() => draftDate.value.getFullYear())
const selectedMonth = computed(() => draftDate.value.getMonth() + 1)
const selectedMonthIndex = computed(() => draftDate.value.getMonth())
const selectedDay = computed(() => draftDate.value.getDate())
const selectedHour = computed(() => draftDate.value.getHours())
const selectedMinute = computed(() => draftDate.value.getMinutes())

const toolbarLeftLabel = computed(() => {
  if (props.mode === 'time') return '取消'
  if (isMonthOnlyMode.value) return '取消'
  return currentView.value === 'calendar' ? '取消' : '返回'
})

const toolbarRightLabel = computed(() => {
  if (props.mode === 'time') return '完成'
  if (isMonthOnlyMode.value) return '确定'
  return currentView.value === 'calendar' ? '完成' : '确定'
})

const toolbarTitle = computed(() => {
  if (props.mode === 'time') return '选择时间'
  if (isMonthOnlyMode.value) return '选择年月'
  if (currentView.value === 'month') return '选择年月'
  if (currentView.value === 'time') return '选择时间'
  return '选择日期时间'
})

const calendarMonthLabel = computed(() => `${calendarYear.value}年${calendarMonth.value}月`)
const monthPanelLabel = computed(() => `${panelYear.value}年${panelMonth.value}月`)
const draftTimeText = computed(() => formatTimeParts(selectedHour.value, selectedMinute.value))
const draftDateMetaText = computed(() => {
  const weekday = weekLabels[draftDate.value.getDay()]
  return `${selectedYear.value}年${selectedMonth.value}月${selectedDay.value}日 ${weekday}`
})

const calendarCells = computed<CalendarCell[]>(() => {
  const cells: CalendarCell[] = []
  const year = calendarYear.value
  const month = calendarMonth.value
  const monthIndex = month - 1
  const firstWeekday = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = getDaysInMonth(year, monthIndex)
  const prevMonthYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const nextMonthYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const prevMonthDays = getDaysInMonth(prevMonthYear, prevMonth - 1)
  const today = new Date()

  for (let index = 0; index < 42; index += 1) {
    const offset = index - firstWeekday + 1
    let cellYear = year
    let cellMonth = month
    let cellDay = offset
    let isCurrentMonth = true

    if (offset <= 0) {
      cellYear = prevMonthYear
      cellMonth = prevMonth
      cellDay = prevMonthDays + offset
      isCurrentMonth = false
    } else if (offset > daysInMonth) {
      cellYear = nextMonthYear
      cellMonth = nextMonth
      cellDay = offset - daysInMonth
      isCurrentMonth = false
    }

    cells.push({
      key: `${cellYear}-${cellMonth}-${cellDay}`,
      year: cellYear,
      month: cellMonth,
      monthIndex: cellMonth - 1,
      day: cellDay,
      isCurrentMonth,
      isSelected: cellYear === selectedYear.value && cellMonth === selectedMonth.value && cellDay === selectedDay.value,
      isToday: cellYear === today.getFullYear() && cellMonth === today.getMonth() + 1 && cellDay === today.getDate(),
    })
  }

  return cells
})

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function clearCloseTimer() {
  if (!closeTimer) return
  clearTimeout(closeTimer)
  closeTimer = null
}

function lockScroll(lock: boolean) {
  // #ifdef H5
  document.body.style.overflow = lock ? 'hidden' : ''
  // #endif
}

function openPanel() {
  clearCloseTimer()
  renderVisible.value = true
  lockScroll(true)
  nextTick(() => {
    animOpen.value = true
  })
}

function closePanel() {
  animOpen.value = false
  clearCloseTimer()
  closeTimer = setTimeout(() => {
    renderVisible.value = false
    lockScroll(false)
    closeTimer = null
  }, PICKER_ANIMATION_MS)
}

function normalizeMinute(minuteValue: number) {
  const list = minutes.value
  if (!list.length) return 0
  if (list.includes(minuteValue)) return minuteValue
  return list.reduce((closest, current) => {
    return Math.abs(current - minuteValue) < Math.abs(closest - minuteValue) ? current : closest
  }, list[0])
}

function syncTimePickerValue() {
  timePickerValue.value = [
    Math.min(Math.max(selectedHour.value, 0), 23),
    Math.max(0, minutes.value.indexOf(normalizeMinute(selectedMinute.value))),
  ]
}

function syncMonthPickerValue() {
  monthPickerValue.value = [
    Math.max(0, years.value.indexOf(panelYear.value)),
    Math.max(0, months.value.indexOf(panelMonth.value)),
  ]
}

function syncCalendarCursorToDraft() {
  calendarYear.value = selectedYear.value
  calendarMonth.value = selectedMonth.value
  panelYear.value = calendarYear.value
  panelMonth.value = calendarMonth.value
  syncMonthPickerValue()
  syncTimePickerValue()
}

function syncDraftFromValue() {
  const nowTs = Date.now()
  let nextDraftTs = getDraftTimestamp(
    typeof props.modelValue === 'number' ? props.modelValue : null,
    nowTs,
  )

  if (props.mode === 'time') {
    if (typeof props.modelValue === 'string') {
      const parsed = parseTimeString(props.modelValue)
      if (parsed) {
        nextDraftTs = replaceTimestampTimeParts(nowTs, parsed.hours, parsed.minutes, nowTs)
      }
    }
  } else if (typeof props.modelValue === 'string') {
    const parsed = parseDateString(props.modelValue)
    if (parsed) {
      nextDraftTs = buildTimestampFromDateParts(
        parsed.year,
        parsed.monthIndex,
        parsed.day,
        nowTs,
      )
    }
  }

  draftTimestamp.value = nextDraftTs
  currentView.value = props.mode === 'time'
    ? 'time'
    : props.mode === 'month'
      ? 'month'
      : 'calendar'
  syncCalendarCursorToDraft()
}

function goPrevMonth() {
  if (calendarMonth.value === 1) {
    calendarYear.value -= 1
    calendarMonth.value = 12
    return
  }
  calendarMonth.value -= 1
}

function goNextMonth() {
  if (calendarMonth.value === 12) {
    calendarYear.value += 1
    calendarMonth.value = 1
    return
  }
  calendarMonth.value += 1
}

function selectCalendarCell(cell: CalendarCell) {
  draftTimestamp.value = replaceTimestampDateParts(
    draftTimestamp.value,
    cell.year,
    cell.monthIndex,
    cell.day,
  )
  calendarYear.value = cell.year
  calendarMonth.value = cell.month
  panelYear.value = cell.year
  panelMonth.value = cell.month
  syncMonthPickerValue()
}

function openMonthPanel() {
  panelYear.value = calendarYear.value
  panelMonth.value = calendarMonth.value
  syncMonthPickerValue()
  currentView.value = 'month'
}

function openTimePanel() {
  syncTimePickerValue()
  currentView.value = 'time'
}

function backToCalendar() {
  currentView.value = 'calendar'
}

function onMonthPickerChange(event: any) {
  const nextValue = event?.detail?.value || []
  panelYear.value = years.value[nextValue[0] || 0] ?? panelYear.value
  panelMonth.value = months.value[nextValue[1] || 0] ?? panelMonth.value
  syncMonthPickerValue()
}

function onTimePickerChange(event: any) {
  const nextValue = event?.detail?.value || []
  const nextHour = hours[nextValue[0] || 0] ?? selectedHour.value
  const nextMinute = minutes.value[nextValue[1] || 0] ?? normalizeMinute(selectedMinute.value)
  draftTimestamp.value = replaceTimestampTimeParts(draftTimestamp.value, nextHour, nextMinute)
  syncTimePickerValue()
}

function handleToolbarLeft() {
  if (isMonthOnlyMode.value) {
    close()
    return
  }
  if (props.mode !== 'time' && currentView.value !== 'calendar') {
    currentView.value = 'calendar'
    return
  }
  close()
}

function handleToolbarRight() {
  if (isMonthOnlyMode.value) {
    handleConfirm()
    return
  }
  if (props.mode !== 'time' && currentView.value === 'month') {
    calendarYear.value = panelYear.value
    calendarMonth.value = panelMonth.value
    currentView.value = 'calendar'
    return
  }
  if (props.mode !== 'time' && currentView.value === 'time') {
    currentView.value = 'calendar'
    return
  }
  handleConfirm()
}

function close() {
  if (!renderVisible.value) return
  emit('update:visible', false)
}

function handleConfirm() {
  let nextValue: number | string

  if (props.mode === 'time') {
    if (props.valueType === 'time-string') {
      nextValue = formatTimeParts(selectedHour.value, selectedMinute.value)
    } else {
      nextValue = replaceTimestampTimeParts(draftTimestamp.value, selectedHour.value, selectedMinute.value)
    }
  } else if (props.mode === 'month') {
    const nextTimestamp = buildTimestampFromDateParts(
      panelYear.value,
      panelMonth.value - 1,
      1,
      draftTimestamp.value,
    )

    nextValue = props.valueType === 'date-string'
      ? formatDateParts(panelYear.value, panelMonth.value - 1, 1)
      : nextTimestamp
  } else if (props.valueType === 'date-string') {
    nextValue = formatDateParts(selectedYear.value, selectedMonthIndex.value, selectedDay.value)
  } else {
    nextValue = draftTimestamp.value
  }

  emit('update:modelValue', nextValue)
  emit('confirm', nextValue)
  close()
}

watch(() => props.visible, (value) => {
  if (value) {
    syncDraftFromValue()
    openPanel()
  } else if (renderVisible.value) {
    closePanel()
  } else {
    animOpen.value = false
    lockScroll(false)
  }
}, { immediate: true })

watch(() => props.modelValue, () => {
  if (props.visible) syncDraftFromValue()
})

watch(() => [props.yearStart, props.yearEnd, props.minuteStep], () => {
  if (!props.visible) return
  const clampedYear = Math.min(Math.max(selectedYear.value, props.yearStart), props.yearEnd)
  panelYear.value = Math.min(Math.max(panelYear.value, props.yearStart), props.yearEnd)
  calendarYear.value = Math.min(Math.max(calendarYear.value, props.yearStart), props.yearEnd)
  draftTimestamp.value = replaceTimestampDateParts(
    draftTimestamp.value,
    clampedYear,
    selectedMonthIndex.value,
    clampDayInMonth(clampedYear, selectedMonthIndex.value, selectedDay.value),
  )
  syncCalendarCursorToDraft()
})

onBeforeUnmount(() => {
  clearCloseTimer()
  lockScroll(false)
})
</script>

<style lang="scss" scoped>
.b-date-time-picker {
  position: fixed;
  inset: 0;
  z-index: 1001;

  &__mask {
    position: absolute;
    inset: 0;
    background: var(--mask);
    opacity: 0;
    transition: opacity 0.25s ease;

    &--open {
      opacity: 1;
    }
  }

  &__panel {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--card);
    border-radius: 20px 20px 0 0;
    transform: translateY(28px) scale(0.98);
    transform-origin: center bottom;
    opacity: 0;
    transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease;

    &--open {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
  }

  &__toolbar {
    display: grid;
    grid-template-columns: 64px 1fr 64px;
    align-items: center;
    padding: 18px 20px 12px;
    border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  }

  &__toolbar-action {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-2);

    &--primary {
      text-align: right;
      color: var(--primary);
    }
  }

  &__toolbar-title {
    text-align: center;
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__body {
    padding: 16px 20px calc(env(safe-area-inset-bottom, 0px) + 18px);
  }

  &__month-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  &__nav-btn {
    width: 36px;
    height: 36px;
    border-radius: 18px;
    background: var(--card-dim);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-2);
  }

  &__month-title {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 14px;
    border-radius: 999px;
    background: rgba(217, 119, 6, 0.10);
    color: var(--text-1);
    font-size: 18px;
    font-weight: 700;
  }

  &__month-title-icon {
    font-size: 22px;
    color: var(--text-1);
  }

  &__weekdays {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
    margin-bottom: 10px;
  }

  &__weekday {
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
    padding: 6px 0;
  }

  &__calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px 4px;
  }

  &__calendar-cell {
    display: flex;
    justify-content: center;
    padding: 2px 0;

    &--muted {
      opacity: 0.4;
    }

    &--today .b-date-time-picker__calendar-day {
      border-color: rgba(217, 119, 6, 0.26);
      background: rgba(217, 119, 6, 0.08);
    }
  }

  &__calendar-day {
    width: 38px;
    height: 38px;
    border-radius: 19px;
    border: 1px solid transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;

    &--selected {
      background: linear-gradient(135deg, rgba(239, 148, 77, 0.94), rgba(241, 170, 94, 0.92));
      box-shadow: 0 10px 20px rgba(239, 148, 77, 0.22);
    }
  }

  &__calendar-day-text {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-1);

    &--selected {
      color: #fff;
    }
  }

  &__time-card {
    margin-top: 18px;
    border: 1px solid rgba(15, 23, 42, 0.06);
    border-radius: 18px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 244, 238, 0.96));
    overflow: hidden;
  }

  &__time-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px;

    & + & {
      border-top: 1px solid rgba(15, 23, 42, 0.06);
    }

    &--active {
      background: rgba(217, 119, 6, 0.06);
    }
  }

  &__time-label {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-2);
  }

  &__time-value-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  &__time-value {
    font-size: 15px;
    color: var(--text-1);
    text-align: right;

    &--strong {
      font-weight: 700;
    }
  }

  &__time-arrow {
    font-size: 18px;
    color: var(--text-3);
  }

  &__subpanel-header {
    padding: 8px 0 6px;
  }

  &__subpanel-kicker {
    display: block;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  &__subpanel-title {
    display: block;
    text-align: center;
    font-size: 28px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__month-picker,
  &__time-picker {
    width: 100%;
    height: 260px;
    margin-top: 12px;
  }

  &__picker-item {
    height: 54px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 8px;
    border-radius: 18px;
    transition: background 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;

    &--selected {
      background: linear-gradient(180deg, rgba(244, 232, 218, 0.96), rgba(255, 255, 255, 0.98));
      box-shadow: inset 0 0 0 1px rgba(217, 119, 6, 0.10), 0 8px 18px rgba(15, 23, 42, 0.04);
      transform: scale(1.01);
    }
  }

  &__picker-item-text {
    font-size: 22px;
    font-weight: 500;
    color: rgba(15, 23, 42, 0.30);
    transition: color 0.16s ease, font-size 0.16s ease, font-weight 0.16s ease;

    &--selected {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-1);
    }
  }
}

:deep(.b-date-time-picker__picker-view--wheel .uni-picker-view-indicator) {
  left: 0;
  right: 0;
  height: 54px;
  border-radius: 0;
  border: 0;
  background: transparent;
}

:deep(.b-date-time-picker__picker-view--wheel .uni-picker-view-content .uni-picker-view-mask) {
  background-image: none;
}
</style>
