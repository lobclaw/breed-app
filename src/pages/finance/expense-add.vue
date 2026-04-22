<template>
  <view class="page">
    <BPageHeader title="记账" />

    <view class="form-body">
      <!-- 支出/收入切换 -->
      <view class="seg-tabs">
        <view
          class="seg-tab"
          :class="{ 'seg-tab--active': mode === 'expense', 'seg-tab--expense': mode === 'expense' }"
          @click="switchMode('expense')"
        >
          <text>支出</text>
        </view>
        <view
          class="seg-tab"
          :class="{ 'seg-tab--active': mode === 'income', 'seg-tab--income': mode === 'income' }"
          @click="switchMode('income')"
        >
          <text>收入</text>
        </view>
      </view>

      <!-- 金额输入（大字） -->
      <view class="amount-section">
        <view class="amount-value" :class="mode === 'expense' ? 'amount-value--expense' : 'amount-value--income'">
          <text class="amount-value__currency">¥</text>
          <input
            v-model="amountInput"
            class="amount-value__input"
            type="digit"
            placeholder="0.00"
          />
        </view>
        <view class="amount-underline" :class="mode === 'expense' ? 'amount-underline--expense' : 'amount-underline--income'" />
      </view>

      <!-- 分类/类型 -->
      <view class="form-row" @click="showCategorySheet = true">
        <text class="form-label">分类</text>
        <view class="form-right">
          <view class="category-tag">
            <text class="material-icons-round" style="font-size:16px;color:var(--text-1);">{{ currentIcon }}</text>
            <text>{{ currentCategory }}</text>
            <text class="material-icons-round" style="font-size:14px;color:var(--text-3);">expand_more</text>
          </view>
        </view>
      </view>

      <!-- 日期 -->
      <view class="field-group">
        <view class="field-label"><text>日期</text></view>
        <picker mode="date" :value="dateStr" @change="onDateChange">
          <view class="form-input form-input--picker">
            <text>{{ dateStr || '请选择日期' }}</text>
            <text class="material-icons-round form-input__suffix">calendar_today</text>
          </view>
        </picker>
        <view class="date-chips">
          <text class="date-chip" :class="{ active: chipActive === 'today' }" @click="setChip('today')">今天</text>
          <text class="date-chip" :class="{ active: chipActive === 'yesterday' }" @click="setChip('yesterday')">昨天</text>
          <text class="date-chip" :class="{ active: chipActive === 'dayBefore' }" @click="setChip('dayBefore')">前天</text>
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
          v-model="notes"
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

    <BExpenseCategorySheet
      v-if="mode === 'expense'"
      v-model:visible="showCategorySheet"
      v-model="expenseCategory"
      :categories="expenseCategories"
      :recent-categories="recentExpenseCategories"
      @manage="openExpenseCategoryManager"
    />

    <!-- 分类/类型选择面板 -->
    <BIncomeTypeSheet
      v-else
      v-model:visible="showCategorySheet"
      v-model="incomeType"
      :types="incomeTypes"
      :recent-types="recentIncomeTypes"
    />

    <BFinanceLinkSheet
      v-model:visible="showLinkSheet"
      :mode="mode"
      @select="onLinkKindSelect"
    />

    <BDogPicker
      v-model:visible="showDogPicker"
      :multiple="mode === 'expense'"
      title="选择犬只"
      @select="onDogSelected"
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
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BExpenseCategorySheet from '@/components/form/BExpenseCategorySheet.vue'
import BIncomeTypeSheet from '@/components/form/BIncomeTypeSheet.vue'
import BFinanceLinkSheet from '@/components/form/BFinanceLinkSheet.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BLitterSelector from '@/components/form/BLitterSelector.vue'
import BCycleSelector from '@/components/form/BCycleSelector.vue'

// 模式：支出 / 收入
const mode = ref<'expense' | 'income'>('expense')

const amountInput = ref('')
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const photos = ref<string[]>([])
const showCategorySheet = ref(false)
const showLinkSheet = ref(false)
const showDogPicker = ref(false)
const showLitterPicker = ref(false)
const showCyclePicker = ref(false)
const notes = ref('')
const RECENT_EXPENSE_CATEGORY_KEY = 'finance_recent_expense_categories'
const RECENT_INCOME_TYPE_KEY = 'finance_recent_income_types'

// 支出分类
const expenseCategory = ref('食品')
const DEFAULT_EXPENSE_CATEGORIES = ['食品', '营养品', '消耗品', '日常用品', '固定开销', '交通', '医疗', '配种费', '其他']
const customExpenseCategories = ref<string[]>([])
const expenseCategories = computed(() => [...DEFAULT_EXPENSE_CATEGORIES, ...customExpenseCategories.value])
const recentExpenseCategories = ref<string[]>([])
const expenseCategoryIcons: Record<string, string> = {
  '食品': 'restaurant', '营养品': 'medication', '消耗品': 'shopping_bag',
  '日常用品': 'home', '固定开销': 'pin_drop', '交通': 'directions_car',
  '医疗': 'local_hospital', '配种费': 'favorite', '其他': 'more_horiz',
}

// 收入类型
const incomeType = ref('其他')
const incomeTypes = ['销售', '定金保留', '领养', '其他']
const recentIncomeTypes = ref<string[]>([])
const incomeTypeIcons: Record<string, string> = {
  '销售': 'sell', '定金保留': 'savings', '领养': 'volunteer_activism', '其他': 'more_horiz',
}

const linkedDogs = ref<any[]>([])
const linkedLitter = ref<any | null>(null)
const linkedCycle = ref<any | null>(null)
const incomeLinkedDog = ref<any | null>(null)

// 动态字段
const currentCategory = computed(() => mode.value === 'expense' ? expenseCategory.value : incomeType.value)
const currentIcon = computed(() => {
  const icons = mode.value === 'expense' ? expenseCategoryIcons : incomeTypeIcons
  return icons[currentCategory.value] || 'more_horiz'
})

const currentLinkText = computed(() => {
  if (mode.value === 'income') {
    return incomeLinkedDog.value?.name || ''
  }
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

function readRecentExpenseCategories() {
  try {
    return JSON.parse(uni.getStorageSync(RECENT_EXPENSE_CATEGORY_KEY) || '[]')
  } catch {
    return []
  }
}

function syncRecentExpenseCategories() {
  recentExpenseCategories.value = readRecentExpenseCategories().filter((item: string) =>
    expenseCategories.value.includes(item),
  )
}

function readRecentIncomeTypes() {
  try {
    return JSON.parse(uni.getStorageSync(RECENT_INCOME_TYPE_KEY) || '[]')
  } catch {
    return []
  }
}

function syncRecentIncomeTypes() {
  recentIncomeTypes.value = readRecentIncomeTypes().filter((item: string) => incomeTypes.includes(item))
}

function saveRecentExpenseCategory(name: string) {
  const next = [name, ...recentExpenseCategories.value.filter(item => item !== name)].slice(0, 2)
  recentExpenseCategories.value = next
  try {
    uni.setStorageSync(RECENT_EXPENSE_CATEGORY_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

function saveRecentIncomeType(name: string) {
  const next = [name, ...recentIncomeTypes.value.filter(item => item !== name)].slice(0, 2)
  recentIncomeTypes.value = next
  try {
    uni.setStorageSync(RECENT_INCOME_TYPE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

function openExpenseCategoryManager() {
  uni.navigateTo({ url: '/pages/profile/expense-categories' })
}

function switchMode(m: 'expense' | 'income') {
  mode.value = m
}

// 日期
const today = new Date()
today.setHours(0, 0, 0, 0)
const date = ref<number>(today.getTime())
const chipActive = ref('today')

const dateStr = computed(() => {
  if (!date.value) return ''
  const d = new Date(date.value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

function onDateChange(e: any) {
  date.value = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
  chipActive.value = ''
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const diff = (now.getTime() - date.value) / 86400000
  if (diff === 0) chipActive.value = 'today'
  else if (diff === 1) chipActive.value = 'yesterday'
  else if (diff === 2) chipActive.value = 'dayBefore'
}

function setChip(chip: string) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const map: Record<string, number> = { today: 0, yesterday: -1, dayBefore: -2 }
  date.value = now.getTime() + (map[chip] || 0) * 86400000
  chipActive.value = chip
}

const canSubmit = computed(() => {
  const amount = parseFloat(amountInput.value)
  return amount > 0 && !!date.value
})

const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '提交中...'
  if (submitState.value === 'success') return '已保存'
  return '保存记录'
})

function pickLink() {
  showLinkSheet.value = true
}

function clearLink() {
  linkedDogs.value = []
  linkedLitter.value = null
  linkedCycle.value = null
  incomeLinkedDog.value = null
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

function onDogSelected(dog: any) {
  if (mode.value === 'income') {
    incomeLinkedDog.value = dog
    return
  }
  linkedDogs.value = dog ? [dog] : []
}

function onDogsSelected(dogs: any[]) {
  if (mode.value === 'income') {
    incomeLinkedDog.value = dogs?.[0] || null
    return
  }
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

const { run: addExpense } = useCloudCall('finance-service', 'addExpense', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

const { run: addIncome } = useCloudCall('finance-service', 'addIncome', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

const { run: fetchCategories } = useCloudCall<{ data: Array<{ name: string; is_default: boolean }> }>('finance-service', 'getExpenseCategories')
const { run: fetchDogDetail } = useCloudCall<{ data: any }>('dog-service', 'getDogDetail', {
  showLoading: false,
})

async function loadCategories() {
  const res = await fetchCategories()
  if (res?.data) {
    customExpenseCategories.value = res.data.filter(item => !item.is_default).map(item => item.name)
  }
  syncRecentExpenseCategories()
  syncRecentIncomeTypes()
}

async function submit() {
  submitState.value = 'submitting'
  try {
    let res
    if (mode.value === 'expense') {
      saveRecentExpenseCategory(expenseCategory.value)
      res = await addExpense({
        total_amount: parseFloat(amountInput.value),
        category: expenseCategory.value,
        date: date.value,
        notes: notes.value || null,
        images: photos.value,
        linked_cycle_id: linkedCycle.value?._id || null,
        linked_litter_id: linkedLitter.value?._id || null,
        linked_dog_ids: linkedDogs.value.map((dog: any) => dog._id),
        dam_name: linkedCycle.value?.damName || linkedCycle.value?.dam_name || linkedLitter.value?.damName || linkedLitter.value?.dam_name || null,
        litter_number: linkedLitter.value?.litterNumber || linkedLitter.value?.litter_number || null,
        dog_names: linkedDogs.value.map((dog: any) => dog.name).filter(Boolean),
        source_type: 'manual',
      })
    } else {
      saveRecentIncomeType(incomeType.value)
      res = await addIncome({
        amount: parseFloat(amountInput.value),
        type: incomeType.value,
        date: date.value,
        notes: notes.value || null,
        images: photos.value,
        dog_id: incomeLinkedDog.value?._id || null,
        dog_name: incomeLinkedDog.value?.name || null,
        source_type: 'manual',
      })
    }
    if (res) {
      submitState.value = 'success'
      queueSubmitFeedback({ message: mode.value === 'expense' ? '已保存支出' : '已保存收入' })
      await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
      uni.navigateBack()
    }
  } catch {
    submitState.value = 'idle'
  } finally {
    if (submitState.value !== 'success') submitState.value = 'idle'
  }
}

onLoad(async (query) => {
  if (query?.type === 'income') mode.value = 'income'
  if (!query?.dogId) return
  const dogId = String(query.dogId)
  let dogName = query?.dogName ? decodeURIComponent(String(query.dogName)) : ''
  if (!dogName) {
    const dogRes = await fetchDogDetail(dogId)
    dogName = dogRes?.data?.name || ''
  }
  if (mode.value === 'income') {
    incomeLinkedDog.value = { _id: dogId, name: dogName || '未命名' }
  } else {
    linkedDogs.value = [{ _id: dogId, name: dogName || '未命名' }]
  }
})

onShow(() => {
  loadCategories()
})
</script>

<style lang="scss" scoped>
.form-body {
  padding: 8px 24px 24px;
}

/* ---- Segmented Tabs ---- */
.seg-tabs {
  display: flex;
  background: var(--card-dim);
  border-radius: 12px;
  padding: 3px;
  margin-bottom: 8px;
}

.seg-tab {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-3);
  transition: all 0.2s ease;

  &--active {
    background: var(--card);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  }

  &--expense {
    color: var(--green);
  }

  &--income {
    color: var(--red);
  }
}

/* ---- Amount section ---- */
.amount-section {
  padding: 16px 0 20px;
}

.amount-value {
  font-size: 28px;
  font-weight: 800;
  display: flex;
  align-items: baseline;
  gap: 4px;

  &--expense { color: var(--green); }
  &--income { color: var(--red); }

  &__currency {
    font-size: 20px;
    font-weight: 700;
  }

  &__input {
    flex: 1;
    font-size: 28px;
    font-weight: 800;
    font-family: var(--font-display);
    color: inherit;
    background: transparent;
    border: none;
    outline: none;
  }
}

.amount-underline {
  height: 2px;
  margin-top: 8px;
  border-radius: 1px;

  &--expense { background: linear-gradient(90deg, var(--green), transparent); }
  &--income { background: linear-gradient(90deg, var(--red), transparent); }
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
