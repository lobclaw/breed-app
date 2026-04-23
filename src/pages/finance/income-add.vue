<template>
  <view class="page">
    <BPageHeader title="录入收入" />

    <view class="form-body">
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
      <view class="field-group">
        <view class="field-label"><text>日期</text></view>
        <view class="form-input form-input--picker" @click="showDatePicker = true">
          <text>{{ dateStr || '请选择日期' }}</text>
          <text class="material-icons-round form-input__suffix">calendar_today</text>
        </view>
        <view class="date-chips">
          <text class="date-chip" :class="{ active: chipActive === 'today' }" @click="setChip('today')">今天</text>
          <text class="date-chip" :class="{ active: chipActive === 'yesterday' }" @click="setChip('yesterday')">昨天</text>
          <text class="date-chip" :class="{ active: chipActive === 'dayBefore' }" @click="setChip('dayBefore')">前天</text>
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
      <BSubmitButton
        :loading="submitState === 'submitting'"
        :success="submitState === 'success'"
        :disabled="!canSubmit || submitState === 'submitting'"
        @click="submit"
      >
        {{ submitButtonText }}
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
      :model-value="date"
      mode="date"
      value-type="timestamp"
      @confirm="onDateConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useCloudCall } from '@/composables/useCloudCall'
import { queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import { buildTimestampFromDayOffset, formatDateInputValue, getLocalCalendarDayDiff } from '@/utils/date'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BDateTimePicker from '@/components/form/BDateTimePicker.vue'
import BIncomeTypeSheet from '@/components/form/BIncomeTypeSheet.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'
import { INCOME_TYPES, getIncomeTypeMeta } from '@/constants/financeCategories'

const amountInput = ref('')
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const photos = ref<string[]>([])
const showTypeSheet = ref(false)
const showDogPicker = ref(false)
const showDatePicker = ref(false)
const recentIncomeTypes = ref<string[]>([])
const RECENT_INCOME_TYPE_KEY = 'finance_recent_income_types'
const linkedDog = ref<any | null>(null)

// 日期
const date = ref<number>(buildTimestampFromDayOffset(0))
const chipActive = ref('today')

const dateStr = computed(() => {
  return formatDateInputValue(date.value)
})

function onDateConfirm(value: number | string) {
  if (typeof value !== 'number') return
  date.value = value
  chipActive.value = ''
  const diff = getLocalCalendarDayDiff(date.value)
  if (diff === 0) chipActive.value = 'today'
  else if (diff === -1) chipActive.value = 'yesterday'
  else if (diff === -2) chipActive.value = 'dayBefore'
}

function setChip(chip: string) {
  const map: Record<string, number> = { today: 0, yesterday: -1, dayBefore: -2 }
  date.value = buildTimestampFromDayOffset(map[chip] || 0, date.value)
  chipActive.value = chip
}

const form = reactive({
  type: '其他',
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

const canSubmit = computed(() => {
  const amount = parseFloat(amountInput.value)
  return amount > 0 && form.type && !!date.value
})

const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '提交中...'
  if (submitState.value === 'success') return '已保存'
  return '保存收入'
})

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

const { run: addIncome } = useCloudCall('finance-service', 'addIncome', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

async function submit() {
  submitState.value = 'submitting'
  try {
    const res = await addIncome({
      amount: parseFloat(amountInput.value),
      type: form.type,
      date: date.value,
      notes: form.notes || null,
      images: photos.value,
      dog_id: linkedDog.value?._id || null,
      dog_name: linkedDog.value?.name || null,
      source_type: 'manual',
    })
    if (res) {
      saveRecentIncomeType(form.type)
      submitState.value = 'success'
      queueSubmitFeedback({ message: '已保存收入' })
      await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
      uni.navigateBack()
    }
  } catch {
    submitState.value = 'idle'
  } finally {
    if (submitState.value !== 'success') submitState.value = 'idle'
  }
}

recentIncomeTypes.value = readRecentIncomeTypes()
</script>

<style lang="scss" scoped>

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
