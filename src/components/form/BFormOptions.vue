<!--
  BFormOptions — 表单通用选项组件
  封装三个功能：标记为待办 + 日期选择 + 下次提醒
  Props:
    date — 日期 timestamp (v-model:date)
    isTodo — 是否待办模式 (v-model:isTodo)
    enableReminder — 是否开启下次提醒 (v-model:enableReminder)
    reminderDays — 自动计算提醒间隔天数（默认 21）
    dateLabel — 日期字段标签（默认"日期"）
    reminderDate — 提醒日期 timestamp (v-model:reminderDate)
    reminderLabel — 提醒开关文案（默认"下次提醒"）
    reminderHint — 提醒辅助文案
    hideTodo — 隐藏"标记为待办"开关（从待办/批量入口进入时使用）
-->
<template>
  <!-- 标记为待办 -->
  <view v-if="!hideTodo" class="option-row" @click="toggleTodo">
    <text class="material-icons-round option-row__icon" style="color: var(--primary);">event_note</text>
    <text class="option-row__text">标记为待办</text>
    <view class="custom-toggle" :class="{ 'custom-toggle--on': isTodo }">
      <view class="custom-toggle__knob" />
    </view>
  </view>
  <view v-if="!hideTodo && isTodo" class="option-mode-hint">
    <text>将创建待办</text>
  </view>

  <!-- 日期 -->
  <slot name="before-date" />
  <view class="field-group">
    <view class="field-label"><text>{{ isTodo ? '计划日期' : dateLabel }}</text></view>
    <picker mode="date" :value="dateStr" @change="onDateChange">
      <view class="form-input form-input--picker">
        <text>{{ dateStr || '请选择日期' }}</text>
        <text class="material-icons-round form-input__suffix">calendar_today</text>
      </view>
    </picker>
    <view class="date-chips">
      <template v-if="isTodo">
        <text class="date-chip" :class="{ active: chipActive === 'today' }" @click="setChip('today')">今天</text>
        <text class="date-chip" :class="{ active: chipActive === 'tomorrow' }" @click="setChip('tomorrow')">明天</text>
        <text class="date-chip" :class="{ active: chipActive === 'dayAfter' }" @click="setChip('dayAfter')">后天</text>
      </template>
      <template v-else>
        <text class="date-chip" :class="{ active: chipActive === 'today' }" @click="setChip('today')">今天</text>
        <text class="date-chip" :class="{ active: chipActive === 'yesterday' }" @click="setChip('yesterday')">昨天</text>
        <text class="date-chip" :class="{ active: chipActive === 'dayBefore' }" @click="setChip('dayBefore')">前天</text>
      </template>
    </view>
  </view>

  <!-- 下次提醒 -->
  <view class="field-group">
    <view class="option-row option-row--with-sub" @click="toggleReminder">
      <text class="material-icons-round option-row__icon" style="color: var(--primary);">notifications_active</text>
      <text class="option-row__text">{{ reminderLabel }}</text>
      <view class="custom-toggle" :class="{ 'custom-toggle--on': enableReminder }">
        <view class="custom-toggle__knob" />
      </view>
    </view>
    <template v-if="enableReminder">
      <picker mode="date" :value="reminderDateStr" @change="onReminderDateChange">
        <view class="form-input form-input--picker">
          <text>{{ reminderDateStr }}</text>
          <text class="material-icons-round form-input__suffix">calendar_today</text>
        </view>
      </picker>
      <text class="helper-text">{{ reminderHint || `自动计算：+${reminderDays}天，可手动修改` }}</text>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = withDefaults(defineProps<{
  date: number | null
  isTodo: boolean
  enableReminder: boolean
  reminderDate?: number | null
  reminderDays?: number
  dateLabel?: string
  reminderLabel?: string
  reminderHint?: string
  hideTodo?: boolean
}>(), {
  reminderDate: null,
  reminderDays: 21,
  dateLabel: '日期',
  reminderLabel: '下次提醒',
  reminderHint: '',
  hideTodo: false,
})

const emit = defineEmits<{
  'update:date': [value: number | null]
  'update:isTodo': [value: boolean]
  'update:enableReminder': [value: boolean]
  'update:reminderDate': [value: number | null]
}>()

const chipActive = ref('today')
const DAY = 86400000

// 日期显示
const dateStr = computed(() => {
  if (!props.date) return ''
  const d = new Date(props.date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

// 提醒日期显示
const reminderDateStr = computed(() => {
  const ts = props.reminderDate || (props.date ? props.date + props.reminderDays * DAY : null)
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

// 快捷日期
function setChip(chip: string) {
  chipActive.value = chip
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  if (chip === 'yesterday') now.setDate(now.getDate() - 1)
  if (chip === 'dayBefore') now.setDate(now.getDate() - 2)
  if (chip === 'tomorrow') now.setDate(now.getDate() + 1)
  if (chip === 'dayAfter') now.setDate(now.getDate() + 2)
  emit('update:date', now.getTime())
}

function onDateChange(e: any) {
  emit('update:date', new Date(e.detail.value + 'T00:00:00+08:00').getTime())
  chipActive.value = ''
}

function onReminderDateChange(e: any) {
  emit('update:reminderDate', new Date(e.detail.value + 'T00:00:00+08:00').getTime())
}

function toggleTodo() {
  emit('update:isTodo', !props.isTodo)
}

function toggleReminder() {
  emit('update:enableReminder', !props.enableReminder)
}

// 切换待办模式时自动调整日期和 chip
watch(() => props.isTodo, (val) => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (val) {
    d.setDate(d.getDate() + 1)
    chipActive.value = 'tomorrow'
  } else {
    chipActive.value = 'today'
  }
  emit('update:date', d.getTime())
})

// 初始化
const today = new Date()
today.setHours(0, 0, 0, 0)
if (!props.date) {
  emit('update:date', today.getTime())
}
</script>

<style lang="scss" scoped>

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}

.form-input {
  width: 100%;
  height: 48px;
  border-radius: 14px;
  border: 1px solid var(--text-4);
  background: var(--card);
  padding: 0 16px;
  font-size: 14px;
  color: var(--text-1);
  display: flex;
  align-items: center;

  &--picker {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__suffix {
    font-size: 18px;
    color: var(--text-3);
  }
}

.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  &__icon {
    font-size: 16px;
    color: var(--text-3);
  }

  &__text {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-2);
  }

  &--with-sub {
    margin-bottom: 8px;
  }
}

.custom-toggle {
  width: 42px;
  height: 24px;
  border-radius: 12px;
  background: var(--text-4);
  position: relative;
  transition: background 0.2s ease;
  flex-shrink: 0;

  &__knob {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    position: absolute;
    top: 2px;
    left: 2px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    transition: left 0.2s ease;
  }

  &--on {
    background: var(--primary);
    .custom-toggle__knob { left: 20px; }
  }
}

.helper-text {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
  margin-top: 4px;
}

.option-mode-hint {
  display: inline-flex;
  align-items: center;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--rose-soft);
  color: var(--primary);
  font-size: 11px;
  font-weight: 700;
}
</style>
