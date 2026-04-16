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
          <text class="material-icons-round" style="font-size:18px;color:var(--text-3);">link</text>
          <text style="color:var(--text-3);font-size:14px;">点击选择关联</text>
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
      <button
        class="submit-btn"
        :loading="submitState === 'submitting'"
        :class="{ 'submit-btn--success': submitState === 'success' }"
        :disabled="!canSubmit || submitState === 'submitting'"
        @click="submit"
      >
        {{ submitButtonText }}
      </button>
    </view>

    <!-- 分类/类型选择面板 -->
    <BSheet v-model:visible="showCategorySheet" title="选择分类">
      <view class="picker-pills">
        <text
          v-for="item in currentCategories"
          :key="item"
          class="picker-pill"
          :class="{ active: currentCategory === item }"
          @click="selectCategory(item)"
        >{{ item }}</text>
      </view>
    </BSheet>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { queueSubmitFeedback, wait } from '@/composables/useSubmitFeedback'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSheet from '@/components/layout/BSheet.vue'

// 模式：支出 / 收入
const mode = ref<'expense' | 'income'>('expense')

const amountInput = ref('')
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const photos = ref<string[]>([])
const showCategorySheet = ref(false)
const notes = ref('')

// 支出分类
const expenseCategory = ref('食品')
const expenseCategories = ['食品', '营养品', '消耗品', '日常用品', '固定开销', '交通', '医疗', '配种费', '其他']
const expenseCategoryIcons: Record<string, string> = {
  '食品': 'restaurant', '营养品': 'medication', '消耗品': 'shopping_bag',
  '日常用品': 'home', '固定开销': 'pin_drop', '交通': 'directions_car',
  '医疗': 'local_hospital', '配种费': 'favorite', '其他': 'more_horiz',
}

// 收入类型
const incomeType = ref('其他')
const incomeTypes = ['销售', '定金保留', '领养', '其他']
const incomeTypeIcons: Record<string, string> = {
  '销售': 'sell', '定金保留': 'savings', '领养': 'volunteer_activism', '其他': 'more_horiz',
}

// 动态字段
const currentCategory = computed(() => mode.value === 'expense' ? expenseCategory.value : incomeType.value)
const currentCategories = computed(() => mode.value === 'expense' ? expenseCategories : incomeTypes)
const currentIcon = computed(() => {
  const icons = mode.value === 'expense' ? expenseCategoryIcons : incomeTypeIcons
  return icons[currentCategory.value] || 'more_horiz'
})

function selectCategory(item: string) {
  if (mode.value === 'expense') expenseCategory.value = item
  else incomeType.value = item
  showCategorySheet.value = false
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
  uni.showToast({ title: '关联记录功能开发中', icon: 'none' })
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

async function submit() {
  submitState.value = 'submitting'
  try {
    let res
    if (mode.value === 'expense') {
      res = await addExpense({
        total_amount: parseFloat(amountInput.value),
        category: expenseCategory.value,
        date: date.value,
        notes: notes.value || null,
        images: photos.value,
        source_type: 'manual',
      })
    } else {
      res = await addIncome({
        amount: parseFloat(amountInput.value),
        type: incomeType.value,
        date: date.value,
        notes: notes.value || null,
        images: photos.value,
        source_type: 'manual',
      })
    }
    if (res) {
      submitState.value = 'success'
      queueSubmitFeedback({ message: mode.value === 'expense' ? '已保存支出' : '已保存收入' })
      await wait(140)
      uni.navigateBack()
    }
  } catch {
    submitState.value = 'idle'
  } finally {
    if (submitState.value !== 'success') submitState.value = 'idle'
  }
}

onLoad((query) => {
  if (query?.type === 'income') mode.value = 'income'
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
