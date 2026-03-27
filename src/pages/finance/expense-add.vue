<template>
  <view class="page">
    <BPageHeader title="录入支出" />

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
          <text class="material-icons-round" style="font-size:18px;color:var(--text-3);">link</text>
          <text style="color:var(--text-3);font-size:14px;">点击选择关联</text>
        </view>
      </view>

      <!-- 拍照 -->
      <view class="photo-row" @click="addPhoto">
        <text class="material-icons-round">photo_camera</text>
        <text>添加图片凭证（选填）</text>
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

      <!-- 提交按钮 -->
      <button
        class="submit-btn"
        :loading="submitting"
        :disabled="!canSubmit"
        @click="submit"
      >
        保存支出
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'

const amountInput = ref('')
const submitting = ref(false)
const showCategorySheet = ref(false)
const dateChipActive = ref('today')

const form = reactive({
  category: '食品',
  date: Date.now(),
  notes: '',
})

const categories = ['食品', '营养品', '消耗品', '日常用品', '固定开销', '交通', '医疗', '配种费', '其他']

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

function pickLink() {
  // 关联选择器 placeholder
}

function addPhoto() {
  // 拍照/相册 placeholder
}

const { run: addExpense } = useCloudCall('finance-service', 'addExpense', {
  successMessage: '已保存',
  showLoading: true,
})

async function submit() {
  submitting.value = true
  try {
    const res = await addExpense({
      total_amount: parseFloat(amountInput.value),
      category: form.category,
      date: form.date,
      notes: form.notes || null,
    })
    if (res) uni.navigateBack()
  } finally {
    submitting.value = false
  }
}

onLoad(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  form.date = today.getTime()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
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

/* ---- Submit button ---- */
.submit-btn {
  display: block;
  width: 100%;
  margin-top: 24px;
  padding: 16px;
  border: none;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  background: var(--green);
  box-shadow: 0 4px 16px rgba(61, 174, 111, 0.25);
  text-align: center;
  font-family: var(--font-display);
  transition: transform 0.12s ease, opacity 0.12s ease;

  &:active {
    transform: scale(0.94);
    opacity: 0.85;
  }

  &[disabled] {
    opacity: 0.4;
  }
}
</style>
