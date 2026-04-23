<template>
  <view class="page">
    <BPageHeader title="编辑收入" />

    <view v-if="loading" class="finance-income-skeleton">
      <view class="finance-income-skeleton__amount">
        <view class="finance-income-skeleton__amount-line finance-income-skeleton__shimmer" />
        <view class="finance-income-skeleton__amount-underline finance-income-skeleton__shimmer" />
      </view>

      <view class="finance-income-skeleton__row finance-income-skeleton__row--single">
        <view class="finance-income-skeleton__label finance-income-skeleton__shimmer" />
        <view class="finance-income-skeleton__value finance-income-skeleton__value--tag finance-income-skeleton__shimmer" />
      </view>

      <view class="finance-income-skeleton__section">
        <view class="finance-income-skeleton__row finance-income-skeleton__row--single">
          <view class="finance-income-skeleton__label finance-income-skeleton__shimmer" />
          <view class="finance-income-skeleton__value finance-income-skeleton__value--date finance-income-skeleton__shimmer" />
        </view>
        <view class="finance-income-skeleton__chips">
          <view v-for="chip in 3" :key="chip" class="finance-income-skeleton__chip finance-income-skeleton__shimmer" />
        </view>
      </view>

      <view class="finance-income-skeleton__row finance-income-skeleton__row--single">
        <view class="finance-income-skeleton__label finance-income-skeleton__shimmer" />
        <view class="finance-income-skeleton__value finance-income-skeleton__value--link finance-income-skeleton__shimmer" />
      </view>

      <view class="finance-income-skeleton__row finance-income-skeleton__row--single">
        <view class="finance-income-skeleton__value finance-income-skeleton__value--full finance-income-skeleton__shimmer" />
      </view>

      <view class="finance-income-skeleton__photos">
        <view v-for="photo in 2" :key="photo" class="finance-income-skeleton__photo finance-income-skeleton__shimmer" />
      </view>

      <view class="finance-income-skeleton__note">
        <view class="finance-income-skeleton__label finance-income-skeleton__shimmer" />
        <view class="finance-income-skeleton__textarea finance-income-skeleton__shimmer" />
      </view>
    </view>

    <view v-else class="form-body">
      <!-- 金额输入（大字） -->
      <view class="amount-section">
        <view class="amount-value">
          <text class="amount-value__currency">¥</text>
          <input
            v-model="amountInput"
            class="amount-value__input"
            type="digit"
            placeholder="0.00"
          />
        </view>
        <view class="amount-underline" />
      </view>

      <!-- 收入分类 -->
      <view class="form-row" @click="showTypeSheet = true">
        <text class="form-label">分类</text>
        <view class="form-right">
          <view class="category-tag">
            <text class="material-icons-round" style="font-size:16px;color:var(--text-1);">{{ typeIcon }}</text>
            <text>{{ form.type }}</text>
            <text class="material-icons-round" style="font-size:14px;color:var(--text-3);">expand_more</text>
          </view>
        </view>
      </view>

      <!-- 日期 -->
      <view class="date-row-wrap">
        <view class="date-main">
          <text class="form-label">日期</text>
          <view class="form-right" @click="showDatePicker = true">
            <text>{{ dateStr }}</text>
            <text class="material-icons-round" style="font-size:18px;color:var(--text-3);">calendar_today</text>
          </view>
        </view>
        <view class="date-chips">
          <text
            class="date-chip"
            :class="{ active: dateChipActive === 'today' }"
            @click="setDateChip('today')"
          >今天</text>
          <text
            class="date-chip"
            :class="{ active: dateChipActive === 'yesterday' }"
            @click="setDateChip('yesterday')"
          >昨天</text>
          <text
            class="date-chip"
            :class="{ active: dateChipActive === 'dayBefore' }"
            @click="setDateChip('dayBefore')"
          >前天</text>
        </view>
      </view>

      <!-- 关联 -->
      <view class="form-row">
        <text class="form-label">关联</text>
        <view class="form-right" @click="showDogPicker = true">
          <text class="material-icons-round" style="font-size:18px;" :style="{ color: linkedDog?.name ? 'var(--text-2)' : 'var(--text-3)' }">link</text>
          <text style="font-size:14px;" :style="{ color: linkedDog?.name ? 'var(--text-2)' : 'var(--text-3)' }">
            {{ linkedDog?.name || '点击选择关联犬只' }}
          </text>
          <text
            v-if="linkedDog?.name"
            class="material-icons-round"
            style="font-size:16px;color:var(--text-4);"
            @click.stop="clearLinkedDog"
          >close</text>
        </view>
      </view>

      <!-- 拍照 -->
      <view class="photo-row" @click="addPhoto">
        <text class="material-icons-round">photo_camera</text>
        <text>添加图片凭证（选填）</text>
      </view>

      <!-- 照片预览 -->
      <view v-if="photos.length" class="photo-preview-row">
        <view v-for="(p, i) in photos" :key="i" class="photo-thumb-wrap">
          <image :src="p" class="photo-thumb" mode="aspectFill" />
          <view class="photo-thumb-del" @click.stop="photos.splice(i, 1)">
            <text class="material-icons-round" style="font-size:14px;color:#fff;">close</text>
          </view>
        </view>
      </view>

      <!-- 备注 -->
      <view class="note-section">
        <text class="note-label">备注（选填）</text>
        <textarea
          v-model="form.notes"
          class="note-textarea"
          placeholder="添加备注信息..."
        />
      </view>

    </view>

    <!-- 固定底部按钮 -->
    <view class="fixed-bottom">
      <view v-if="loading" class="finance-income-skeleton__submit finance-income-skeleton__shimmer" />
      <BSubmitButton
        v-else
        :loading="submitting"
        :disabled="!canSubmit || submitting"
        @click="submit"
      >
        保存修改
      </BSubmitButton>
    </view>

    <!-- 分类选择面板 -->
    <BIncomeTypeSheet
      v-model:visible="showTypeSheet"
      v-model="form.type"
      :types="incomeTypes"
      :recent-types="recentIncomeTypes"
    />

    <BDogPicker
      v-model:visible="showDogPicker"
      title="选择犬只"
      @select="onDogSelect"
    />

    <BDateTimePicker
      v-model:visible="showDatePicker"
      :model-value="form.date"
      mode="date"
      value-type="timestamp"
      @confirm="onDateConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import { buildTimestampFromDayOffset, formatDateInputValue } from '@/utils/date'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BIncomeTypeSheet from '@/components/form/BIncomeTypeSheet.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BDateTimePicker from '@/components/form/BDateTimePicker.vue'
import { INCOME_TYPES, getIncomeTypeMeta } from '@/constants/financeCategories'

let incomeId = ''

const amountInput = ref('')
const submitting = ref(false)
const photos = ref<string[]>([])
const loading = ref(true)
const showTypeSheet = ref(false)
const showDogPicker = ref(false)
const showDatePicker = ref(false)
const dateChipActive = ref('')
const recentIncomeTypes = ref<string[]>([])
const RECENT_INCOME_TYPE_KEY = 'finance_recent_income_types'
const linkedDog = ref<any | null>(null)

const form = reactive({
  type: '其他',
  date: Date.now(),
  notes: '',
})

const incomeTypes: string[] = [...INCOME_TYPES]
const typeIcon = computed(() => getIncomeTypeMeta(form.type).icon)

function readRecentIncomeTypes() {
  try {
    const raw = uni.getStorageSync(RECENT_INCOME_TYPE_KEY)
    return Array.isArray(raw) ? raw.filter(item => typeof item === 'string') : []
  } catch {
    return []
  }
}

function saveRecentIncomeType(name: string) {
  const next = [name, ...readRecentIncomeTypes().filter(item => item !== name)].slice(0, 2)
  recentIncomeTypes.value = next
  uni.setStorageSync(RECENT_INCOME_TYPE_KEY, next)
}

const dateStr = computed(() => {
  return formatDateInputValue(form.date)
})

const canSubmit = computed(() => {
  const amount = parseFloat(amountInput.value)
  return amount > 0 && form.type
})

function setDateChip(chip: string) {
  dateChipActive.value = chip
  const offsetMap: Record<string, number> = { today: 0, yesterday: -1, dayBefore: -2 }
  form.date = buildTimestampFromDayOffset(offsetMap[chip] || 0, form.date)
}

function onDateConfirm(value: number | string) {
  if (typeof value !== 'number') return
  form.date = value
  dateChipActive.value = ''
}

function onDogSelect(dog: any) {
  linkedDog.value = dog || null
}

function clearLinkedDog() {
  linkedDog.value = null
}

function addPhoto() {
  uni.chooseImage({
    count: 3,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      photos.value = [...photos.value, ...res.tempFilePaths]
    },
  })
}

const { run: getIncome } = useCloudCall('finance-service', 'getIncomeDetail', {
  showLoading: false,
})

const { run: updateIncome } = useCloudCall('finance-service', 'updateIncome', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

async function loadIncome(id: string) {
  loading.value = true
  try {
    const res = await getIncome({ id })
    if (res?.data) {
      const data = res.data as any
      amountInput.value = String(data.amount || '')
      form.type = data.type || '其他'
      form.date = data.date || Date.now()
      form.notes = data.notes || ''
      photos.value = data.photos || data.images || []
      linkedDog.value = data.dog_id ? { _id: data.dog_id, name: data.dog_name || '未命名' } : null
    }
  } finally {
    loading.value = false
  }
}

async function submit() {
  submitting.value = true
  try {
    const res = await updateIncome({
      id: incomeId,
      amount: parseFloat(amountInput.value),
      type: form.type,
      date: form.date,
      notes: form.notes || null,
      images: photos.value,
      dog_id: linkedDog.value?._id || null,
      dog_name: linkedDog.value?.name || null,
      source_type: 'manual',
    })
    if (res) {
      saveRecentIncomeType(form.type)
      queueSubmitFeedback({ message: '已更新收入记录' })
      await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
      uni.navigateBack()
    }
  } finally {
    submitting.value = false
  }
}

onLoad((query) => {
  recentIncomeTypes.value = readRecentIncomeTypes()
  incomeId = query?.id || ''
  if (incomeId) {
    loadIncome(incomeId)
  } else {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.finance-income-skeleton {
  padding: 8px 24px 24px;
}

.finance-income-skeleton__shimmer {
  background: linear-gradient(
    90deg,
    var(--card-dim) 25%,
    rgba(255, 255, 255, 0.22) 50%,
    var(--card-dim) 75%
  );
  background-size: 200% 100%;
  animation: finance-income-edit-skeleton-shimmer 1.5s infinite;
}

.finance-income-skeleton__amount {
  padding: 16px 0 20px;
}

.finance-income-skeleton__amount-line {
  width: 54%;
  height: 34px;
  border-radius: 12px;
}

.finance-income-skeleton__amount-underline {
  width: 100%;
  height: 2px;
  margin-top: 8px;
  border-radius: 999px;
}

.finance-income-skeleton__section {
  padding: 14px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.finance-income-skeleton__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.finance-income-skeleton__row--single {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.finance-income-skeleton__label {
  width: 48px;
  height: 12px;
  border-radius: 999px;
}

.finance-income-skeleton__value {
  height: 32px;
  border-radius: 14px;
}

.finance-income-skeleton__value--tag {
  width: 120px;
}

.finance-income-skeleton__value--date {
  width: 132px;
}

.finance-income-skeleton__value--link {
  width: 148px;
}

.finance-income-skeleton__value--full {
  width: 176px;
}

.finance-income-skeleton__chips {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.finance-income-skeleton__chip {
  width: 48px;
  height: 24px;
  border-radius: 999px;
}

.finance-income-skeleton__photos {
  display: flex;
  gap: 8px;
  padding: 10px 0 4px;
}

.finance-income-skeleton__photo {
  width: 64px;
  height: 64px;
  border-radius: 10px;
}

.finance-income-skeleton__note {
  padding: 14px 0 4px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.finance-income-skeleton__textarea {
  width: 100%;
  height: 96px;
  border-radius: 16px;
}

.finance-income-skeleton__submit {
  width: 100%;
  height: 52px;
  border-radius: 999px;
}

@keyframes finance-income-edit-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.form-body {
  padding: 8px 24px 24px;
}

/* ---- Amount section ---- */
.amount-section {
  padding: 16px 0 20px;
}

.amount-value {
  font-size: 28px;
  font-weight: 800;
  color: var(--red);
  display: flex;
  align-items: baseline;
  gap: 4px;

  &__currency {
    font-size: 20px;
    font-weight: 700;
  }

  &__input {
    flex: 1;
    font-size: 28px;
    font-weight: 800;
    font-family: var(--font-display);
    color: var(--red);
    background: transparent;
    border: none;
    outline: none;
  }
}

.amount-underline {
  height: 2px;
  margin-top: 8px;
  border-radius: 1px;
  background: linear-gradient(90deg, var(--red), transparent);
}

/* ---- Form rows ---- */
.form-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
  flex-shrink: 0;
}

.form-right {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--text-1);
  font-weight: 500;
}

/* ---- Category tag ---- */
.category-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--card-dim);
  border-radius: 14px;
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

/* ---- Date row ---- */
.date-row-wrap {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: 14px 0;
}

.date-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.date-chips {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.date-chip {
  padding: 4px 12px;
  border-radius: var(--radius-btn);
  font-size: 11px;
  font-weight: 600;
  background: var(--card-dim);
  color: var(--text-2);
  transition: all 0.12s ease;

  &:active {
    transform: scale(0.92);
  }

  &.active {
    background: var(--primary);
    color: #fff;
    box-shadow: 0 2px 8px rgba(234, 62, 119, 0.25);
  }
}

/* ---- Photo row ---- */
.photo-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  font-size: 14px;
  color: var(--text-3);
  font-weight: 500;

  .material-icons-round {
    font-size: 20px;
    color: var(--text-3);
  }
}

/* ---- Photo preview ---- */
.photo-preview-row {
  display: flex;
  gap: 8px;
  padding: 10px 0 4px;
  flex-wrap: wrap;
}

.photo-thumb-wrap {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 10px;
  overflow: hidden;
}

.photo-thumb {
  width: 100%;
  height: 100%;
}

.photo-thumb-del {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ---- Note section ---- */
.note-section {
  padding: 14px 0 4px;
}

.note-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 10px;
}

.note-textarea {
  width: 100%;
  min-height: 72px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 14px;
  font-family: var(--font-body);
  color: var(--text-1);
  background: var(--card);
  resize: none;
  outline: none;

  &::placeholder {
    color: var(--text-4);
  }
}

</style>
