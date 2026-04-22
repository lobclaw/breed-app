<template>
  <view class="page">
    <BPageHeader title="编辑支出" />

    <view v-if="loading" class="finance-edit-skeleton">
      <view class="finance-edit-skeleton__amount">
        <view class="finance-edit-skeleton__amount-line finance-edit-skeleton__shimmer" />
        <view class="finance-edit-skeleton__amount-underline finance-edit-skeleton__shimmer" />
      </view>

      <view class="finance-edit-skeleton__row finance-edit-skeleton__row--single">
        <view class="finance-edit-skeleton__label finance-edit-skeleton__shimmer" />
        <view class="finance-edit-skeleton__value finance-edit-skeleton__value--tag finance-edit-skeleton__shimmer" />
      </view>

      <view class="finance-edit-skeleton__section">
        <view class="finance-edit-skeleton__row finance-edit-skeleton__row--single">
          <view class="finance-edit-skeleton__label finance-edit-skeleton__shimmer" />
          <view class="finance-edit-skeleton__value finance-edit-skeleton__value--date finance-edit-skeleton__shimmer" />
        </view>
        <view class="finance-edit-skeleton__chips">
          <view v-for="chip in 3" :key="chip" class="finance-edit-skeleton__chip finance-edit-skeleton__shimmer" />
        </view>
      </view>

      <view class="finance-edit-skeleton__row finance-edit-skeleton__row--single">
        <view class="finance-edit-skeleton__label finance-edit-skeleton__shimmer" />
        <view class="finance-edit-skeleton__value finance-edit-skeleton__value--link finance-edit-skeleton__shimmer" />
      </view>

      <view class="finance-edit-skeleton__row finance-edit-skeleton__row--single">
        <view class="finance-edit-skeleton__value finance-edit-skeleton__value--full finance-edit-skeleton__shimmer" />
      </view>

      <view class="finance-edit-skeleton__photos">
        <view v-for="photo in 2" :key="photo" class="finance-edit-skeleton__photo finance-edit-skeleton__shimmer" />
      </view>

      <view class="finance-edit-skeleton__note">
        <view class="finance-edit-skeleton__label finance-edit-skeleton__shimmer" />
        <view class="finance-edit-skeleton__textarea finance-edit-skeleton__shimmer" />
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

      <!-- 分类 -->
      <view class="form-row" @click="showCategorySheet = true">
        <text class="form-label">分类</text>
        <view class="form-right">
          <view class="category-tag">
            <text class="material-icons-round" style="font-size:16px;color:var(--text-1);">{{ categoryIcon }}</text>
            <text>{{ form.category }}</text>
            <text class="material-icons-round" style="font-size:14px;color:var(--text-3);">expand_more</text>
          </view>
        </view>
      </view>

      <!-- 日期 -->
      <view class="date-row-wrap">
        <view class="date-main">
          <text class="form-label">日期</text>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <view class="form-right">
              <text>{{ dateStr }}</text>
              <text class="material-icons-round" style="font-size:18px;color:var(--text-3);">calendar_today</text>
            </view>
          </picker>
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
        <view class="form-right" @click="pickLink">
          <text class="material-icons-round" style="font-size:18px;" :style="{ color: currentLinkText ? 'var(--text-2)' : 'var(--text-3)' }">link</text>
          <text style="font-size:14px;" :style="{ color: currentLinkText ? 'var(--text-2)' : 'var(--text-3)' }">
            {{ currentLinkText || '点击选择关联' }}
          </text>
          <text
            v-if="currentLinkText"
            class="material-icons-round"
            style="font-size:16px;color:var(--text-4);"
            @click.stop="clearLink"
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
      <view v-if="loading" class="finance-edit-skeleton__submit finance-edit-skeleton__shimmer" />
      <BSubmitButton
        v-else
        :loading="submitting"
        :disabled="!canSubmit || submitting"
        @click="submit"
      >
        保存修改
      </BSubmitButton>
    </view>

    <BExpenseCategorySheet
      v-model:visible="showCategorySheet"
      v-model="form.category"
      :categories="categories"
      :recent-categories="recentCategories"
      @manage="openExpenseCategoryManager"
    />

    <BFinanceLinkSheet
      v-model:visible="showLinkSheet"
      mode="expense"
      @select="onLinkKindSelect"
    />

    <BDogPicker
      v-model:visible="showDogPicker"
      :multiple="true"
      title="选择犬只"
      @selectMultiple="onDogsSelected"
    />

    <BLitterSelector
      v-model:visible="showLitterPicker"
      @select="onLitterSelected"
    />

    <BCycleSelector
      v-model:visible="showCyclePicker"
      @select="onCycleSelected"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BExpenseCategorySheet from '@/components/form/BExpenseCategorySheet.vue'
import BFinanceLinkSheet from '@/components/form/BFinanceLinkSheet.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BLitterSelector from '@/components/form/BLitterSelector.vue'
import BCycleSelector from '@/components/form/BCycleSelector.vue'

let expenseId = ''

const amountInput = ref('')
const submitting = ref(false)
const photos = ref<string[]>([])
const loading = ref(true)
const showCategorySheet = ref(false)
const showLinkSheet = ref(false)
const showDogPicker = ref(false)
const showLitterPicker = ref(false)
const showCyclePicker = ref(false)
const dateChipActive = ref('')
const RECENT_EXPENSE_CATEGORY_KEY = 'finance_recent_expense_categories'

const form = reactive({
  category: '食品',
  date: Date.now(),
  notes: '',
})

const DEFAULT_EXPENSE_CATEGORIES = ['食品', '营养品', '消耗品', '日常用品', '固定开销', '交通', '医疗', '配种费', '其他']
const customCategories = ref<string[]>([])
const categories = computed(() => [...DEFAULT_EXPENSE_CATEGORIES, ...customCategories.value])
const recentCategories = ref<string[]>([])
const linkedDogs = ref<any[]>([])
const linkedLitter = ref<any | null>(null)
const linkedCycle = ref<any | null>(null)

const categoryIcons: Record<string, string> = {
  '食品': 'restaurant',
  '营养品': 'medication',
  '消耗品': 'shopping_bag',
  '日常用品': 'home',
  '固定开销': 'pin_drop',
  '交通': 'directions_car',
  '医疗': 'local_hospital',
  '配种费': 'favorite',
  '其他': 'more_horiz',
}

const categoryIcon = computed(() => categoryIcons[form.category] || 'more_horiz')
const currentLinkText = computed(() => {
  if (linkedDogs.value.length) {
    return linkedDogs.value.length === 1 ? linkedDogs.value[0].name : `${linkedDogs.value.length}只犬`
  }
  if (linkedLitter.value) {
    const damName = linkedLitter.value.damName || linkedLitter.value.dam_name || '未知母犬'
    const litterNumber = linkedLitter.value.litterNumber || linkedLitter.value.litter_number || '?'
    return `${damName} · 第${litterNumber}窝`
  }
  if (linkedCycle.value) {
    const damName = linkedCycle.value.damName || linkedCycle.value.dam_name || '未知母犬'
    const cycleNumber = linkedCycle.value.cycleNumber || linkedCycle.value.cycle_number || '?'
    return `${damName} · 第${cycleNumber}次繁育`
  }
  return ''
})

const dateStr = computed(() => {
  const d = new Date(form.date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const canSubmit = computed(() => {
  const amount = parseFloat(amountInput.value)
  return amount > 0 && form.category
})

function setDateChip(chip: string) {
  dateChipActive.value = chip
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  if (chip === 'yesterday') now.setDate(now.getDate() - 1)
  if (chip === 'dayBefore') now.setDate(now.getDate() - 2)
  form.date = now.getTime()
}

function onDateChange(e: any) {
  form.date = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
  dateChipActive.value = ''
}

function readRecentExpenseCategories() {
  try {
    return JSON.parse(uni.getStorageSync(RECENT_EXPENSE_CATEGORY_KEY) || '[]')
  } catch {
    return []
  }
}

function syncRecentCategories() {
  recentCategories.value = readRecentExpenseCategories().filter((item: string) => categories.value.includes(item))
}

function saveRecentExpenseCategory(name: string) {
  const next = [name, ...recentCategories.value.filter(item => item !== name)].slice(0, 2)
  recentCategories.value = next
  try {
    uni.setStorageSync(RECENT_EXPENSE_CATEGORY_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

function openExpenseCategoryManager() {
  uni.navigateTo({ url: '/pages/profile/expense-categories' })
}

function pickLink() {
  showLinkSheet.value = true
}

function clearLink() {
  linkedDogs.value = []
  linkedLitter.value = null
  linkedCycle.value = null
}

function onLinkKindSelect(kind: 'dogs' | 'litter' | 'cycle' | 'none') {
  if (kind === 'none') {
    clearLink()
    return
  }
  if (kind === 'dogs') {
    linkedLitter.value = null
    linkedCycle.value = null
    showDogPicker.value = true
    return
  }
  if (kind === 'litter') {
    linkedDogs.value = []
    linkedCycle.value = null
    showLitterPicker.value = true
    return
  }
  linkedDogs.value = []
  linkedLitter.value = null
  showCyclePicker.value = true
}

function onDogsSelected(dogs: any[]) {
  linkedDogs.value = dogs || []
}

function onLitterSelected(litter: any) {
  linkedLitter.value = litter
}

function onCycleSelected(cycle: any) {
  linkedCycle.value = cycle
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

const { run: getExpense } = useCloudCall('finance-service', 'getExpenseDetail', {
  showLoading: false,
})

const { run: fetchCategories } = useCloudCall<{ data: Array<{ name: string; is_default: boolean }> }>('finance-service', 'getExpenseCategories', {
  showLoading: false,
})

const { run: updateExpense } = useCloudCall('finance-service', 'updateExpense', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

async function refreshCategoryOptions() {
  const catRes = await fetchCategories()
  if (catRes?.data) {
    customCategories.value = catRes.data.filter(item => !item.is_default).map(item => item.name)
  }
  syncRecentCategories()
}

async function loadExpense(id: string) {
  loading.value = true
  try {
    const [catRes, res] = await Promise.all([
      fetchCategories(),
      getExpense({ id }),
    ])
    if (catRes?.data) {
      customCategories.value = catRes.data.filter(item => !item.is_default).map(item => item.name)
      syncRecentCategories()
    }
    if (res?.data) {
      const data = res.data as any
      amountInput.value = String(data.total_amount || '')
      form.category = data.category || '食品'
      form.date = data.date || Date.now()
      form.notes = data.notes || ''
      photos.value = data.photos || data.images || []
      linkedDogs.value = data.linked_dogs || []
      if (data.linked_litter_id) {
        linkedLitter.value = {
          _id: data.linked_litter_id,
          damName: data.dam_name,
          litterNumber: data.litter_number,
        }
      } else {
        linkedLitter.value = null
      }
      if (data.linked_cycle_id) {
        linkedCycle.value = {
          _id: data.linked_cycle_id,
          damName: data.dam_name,
          cycleNumber: data.cycle_number,
        }
      } else {
        linkedCycle.value = null
      }
    }
  } finally {
    loading.value = false
  }
}

async function submit() {
  submitting.value = true
  try {
    const res = await updateExpense({
      id: expenseId,
      total_amount: parseFloat(amountInput.value),
      category: form.category,
      date: form.date,
      notes: form.notes || null,
      images: photos.value,
      linked_cycle_id: linkedCycle.value?._id || null,
      linked_litter_id: linkedLitter.value?._id || null,
      linked_dog_ids: linkedDogs.value.map((dog: any) => dog._id),
      dam_name: linkedCycle.value?.damName || linkedCycle.value?.dam_name || linkedLitter.value?.damName || linkedLitter.value?.dam_name || null,
      litter_number: linkedLitter.value?.litterNumber || linkedLitter.value?.litter_number || null,
      dog_names: linkedDogs.value.map((dog: any) => dog.name).filter(Boolean),
      source_type: 'manual',
    })
    if (res) {
      saveRecentExpenseCategory(form.category)
      queueSubmitFeedback({ message: '已更新支出记录' })
      await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
      uni.navigateBack()
    }
  } finally {
    submitting.value = false
  }
}

onLoad((query) => {
  expenseId = query?.id || ''
  if (expenseId) {
    loadExpense(expenseId)
  } else {
    loading.value = false
  }
})

onShow(() => {
  refreshCategoryOptions()
})
</script>

<style lang="scss" scoped>
.finance-edit-skeleton {
  padding: 8px 24px 24px;
}

.finance-edit-skeleton__shimmer {
  background: linear-gradient(
    90deg,
    var(--card-dim) 25%,
    rgba(255, 255, 255, 0.22) 50%,
    var(--card-dim) 75%
  );
  background-size: 200% 100%;
  animation: finance-expense-edit-skeleton-shimmer 1.5s infinite;
}

.finance-edit-skeleton__amount {
  padding: 16px 0 20px;
}

.finance-edit-skeleton__amount-line {
  width: 58%;
  height: 34px;
  border-radius: 12px;
}

.finance-edit-skeleton__amount-underline {
  width: 100%;
  height: 2px;
  margin-top: 8px;
  border-radius: 999px;
}

.finance-edit-skeleton__section {
  padding: 14px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.finance-edit-skeleton__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.finance-edit-skeleton__row--single {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.finance-edit-skeleton__label {
  width: 48px;
  height: 12px;
  border-radius: 999px;
}

.finance-edit-skeleton__value {
  height: 32px;
  border-radius: 14px;
}

.finance-edit-skeleton__value--tag {
  width: 128px;
}

.finance-edit-skeleton__value--date {
  width: 132px;
}

.finance-edit-skeleton__value--link {
  width: 156px;
}

.finance-edit-skeleton__value--full {
  width: 176px;
}

.finance-edit-skeleton__chips {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.finance-edit-skeleton__chip {
  width: 48px;
  height: 24px;
  border-radius: 999px;
}

.finance-edit-skeleton__photos {
  display: flex;
  gap: 8px;
  padding: 10px 0 4px;
}

.finance-edit-skeleton__photo {
  width: 64px;
  height: 64px;
  border-radius: 10px;
}

.finance-edit-skeleton__note {
  padding: 14px 0 4px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.finance-edit-skeleton__textarea {
  width: 100%;
  height: 96px;
  border-radius: 16px;
}

.finance-edit-skeleton__submit {
  width: 100%;
  height: 52px;
  border-radius: 999px;
}

@keyframes finance-expense-edit-skeleton-shimmer {
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
  color: var(--green);
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
    color: var(--green);
    background: transparent;
    border: none;
    outline: none;
  }
}

.amount-underline {
  height: 2px;
  margin-top: 8px;
  border-radius: 1px;
  background: linear-gradient(90deg, var(--green), transparent);
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

/* ---- Picker pills ---- */
.picker-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 4px 24px;
}

.picker-pill {
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 14px;
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
