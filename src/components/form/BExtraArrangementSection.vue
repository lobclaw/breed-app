<template>
  <view class="field-group">
    <view class="option-row option-row--with-sub" @click="toggleEnabled">
      <text class="material-icons-round option-row__icon" style="color: var(--primary);">playlist_add_check</text>
      <text class="option-row__text">添加额外安排</text>
      <view class="custom-toggle" :class="{ 'custom-toggle--on': enabled }">
        <view class="custom-toggle__knob" />
      </view>
    </view>

    <template v-if="enabled">
      <view class="field-group field-group--compact">
        <view class="field-label"><text>安排类型</text></view>
        <view class="pill-select">
          <view
            v-for="option in arrangementOptions"
            :key="option.value"
            class="pill-select__item"
            :class="{ 'pill-select__item--active': kind === option.value }"
            @click="selectKind(option.value)"
          >
            <text>{{ option.label }}</text>
          </view>
        </view>
      </view>

      <view class="field-group field-group--compact">
        <view class="field-label"><text>安排日期</text></view>
        <view class="form-input form-input--picker" @click="showDatePicker = true">
          <text>{{ dateStr || '请选择日期' }}</text>
          <text class="material-icons-round form-input__suffix">calendar_today</text>
        </view>
        <view class="date-chips">
          <text class="date-chip" :class="{ active: chipActive === 'today' }" @click="setChip('today')">今天</text>
          <text class="date-chip" :class="{ active: chipActive === 'tomorrow' }" @click="setChip('tomorrow')">明天</text>
          <text class="date-chip" :class="{ active: chipActive === 'dayAfter' }" @click="setChip('dayAfter')">后天</text>
        </view>
      </view>

      <view class="field-group field-group--compact">
        <view class="field-label">
          <text>安排说明</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <textarea
          :value="notes"
          class="form-textarea"
          :auto-height="true"
          placeholder="补充这项安排的细节，例如：约周四B超、准备产箱和尿垫"
          @input="onNotesInput"
        />
      </view>
    </template>
  </view>

  <BDateTimePicker
    v-model:visible="showDatePicker"
    :model-value="dueDate"
    mode="date"
    value-type="timestamp"
    @confirm="onDateConfirm"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  EXTRA_ARRANGEMENT_OPTIONS,
  getDefaultExtraArrangementDate,
  type ExtraArrangementKind,
} from '@/utils/breedingExtraArrangement'
import {
  buildTimestampFromDayOffset,
  formatDateInputValue,
  getLocalCalendarDayDiff,
} from '@/utils/date'
import BDateTimePicker from './BDateTimePicker.vue'

const props = withDefaults(defineProps<{
  enabled: boolean
  kind: ExtraArrangementKind | ''
  dueDate: number | null
  notes: string
}>(), {
  kind: 'contact_doctor',
  dueDate: null,
  notes: '',
})

const emit = defineEmits<{
  'update:enabled': [value: boolean]
  'update:kind': [value: ExtraArrangementKind]
  'update:dueDate': [value: number | null]
  'update:notes': [value: string]
}>()

const arrangementOptions = EXTRA_ARRANGEMENT_OPTIONS
const chipActive = ref('tomorrow')
const showDatePicker = ref(false)

const dateStr = computed(() => {
  return formatDateInputValue(props.dueDate)
})

function toggleEnabled() {
  const next = !props.enabled
  emit('update:enabled', next)
  if (next) {
    if (!props.kind) emit('update:kind', 'contact_doctor')
    if (!props.dueDate) emit('update:dueDate', getDefaultExtraArrangementDate())
    chipActive.value = 'tomorrow'
  }
}

function selectKind(value: ExtraArrangementKind) {
  emit('update:kind', value)
}

function setChip(chip: 'today' | 'tomorrow' | 'dayAfter') {
  chipActive.value = chip
  const offsetMap = { today: 0, tomorrow: 1, dayAfter: 2 }
  emit('update:dueDate', buildTimestampFromDayOffset(offsetMap[chip]))
}

function onDateConfirm(value: number | string) {
  if (typeof value !== 'number') return
  chipActive.value = ''
  emit('update:dueDate', value)
}

function onNotesInput(e: any) {
  emit('update:notes', e.detail?.value || '')
}

watch(() => props.dueDate, (value) => {
  if (!value) return
  const diff = getLocalCalendarDayDiff(value)
  if (diff === 0) chipActive.value = 'today'
  else if (diff === 1) chipActive.value = 'tomorrow'
  else if (diff === 2) chipActive.value = 'dayAfter'
  else chipActive.value = ''
}, { immediate: true })
</script>

<style lang="scss" scoped>
.field-group--compact {
  margin-top: 12px;
}

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

    .custom-toggle__knob {
      left: 20px;
    }
  }
}

.date-chips {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.date-chip {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--card-dim);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);

  &.active {
    background: var(--primary-soft);
    color: var(--primary);
  }
}
</style>
