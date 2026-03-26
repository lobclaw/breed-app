<template>
  <view class="expense-add">
    <view class="expense-add__section">
      <view class="expense-add__field">
        <text class="expense-add__label">金额(¥)</text>
        <input v-model="amountInput" class="expense-add__input expense-add__input--big" type="digit" placeholder="0.00" />
      </view>

      <view class="expense-add__field">
        <text class="expense-add__label">分类</text>
        <view class="expense-add__categories">
          <view
            v-for="cat in categories"
            :key="cat"
            class="expense-add__cat"
            :class="{ 'expense-add__cat--active': form.category === cat }"
            @click="form.category = cat"
          >
            <text>{{ cat }}</text>
          </view>
        </view>
      </view>

      <view class="expense-add__field">
        <text class="expense-add__label">日期</text>
        <picker mode="date" :value="dateStr" @change="onDateChange">
          <text class="expense-add__picker">{{ dateStr }}</text>
        </picker>
      </view>

      <view class="expense-add__field">
        <text class="expense-add__label">备注</text>
        <input v-model="form.notes" class="expense-add__input" placeholder="选填" />
      </view>
    </view>

    <view class="expense-add__footer">
      <button class="expense-add__submit" :loading="submitting" :disabled="!canSubmit" @click="submit">
        保存支出
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'

const amountInput = ref('')
const submitting = ref(false)

const form = reactive({
  category: '食品',
  date: Date.now(),
  notes: '',
})

const categories = ['食品', '营养品', '消耗品', '日常用品', '固定开销', '交通', '医疗', '配种费', '其他']

const dateStr = computed(() => {
  const d = new Date(form.date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const canSubmit = computed(() => {
  const amount = parseFloat(amountInput.value)
  return amount > 0 && form.category
})

function onDateChange(e: any) {
  form.date = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
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

<style scoped>
.expense-add { min-height: 100vh; background: #f5f5f5; padding-bottom: 140rpx; }
.expense-add__section { background: #fff; margin: 16rpx 32rpx; border-radius: 16rpx; padding: 24rpx; }
.expense-add__field { padding: 20rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.expense-add__field:last-child { border-bottom: none; }
.expense-add__label { font-size: 28rpx; color: #333; margin-bottom: 12rpx; display: block; }
.expense-add__input { font-size: 28rpx; color: #333; }
.expense-add__input--big { font-size: 48rpx; font-weight: 700; color: #4CAF50; }
.expense-add__categories { display: flex; flex-wrap: wrap; gap: 12rpx; }
.expense-add__cat { padding: 10rpx 24rpx; border-radius: 20rpx; background: #f5f5f5; font-size: 26rpx; color: #666; }
.expense-add__cat--active { background: #4CAF50; color: #fff; }
.expense-add__picker { font-size: 28rpx; color: #333; }
.expense-add__footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 20rpx 32rpx; background: #fff; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); }
.expense-add__submit { width: 100%; height: 88rpx; border-radius: 44rpx; background: #4CAF50; color: #fff; font-size: 32rpx; }
.expense-add__submit[disabled] { opacity: 0.5; }
</style>
