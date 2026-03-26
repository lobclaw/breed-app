<template>
  <view class="income-add">
    <view class="income-add__section">
      <view class="income-add__field">
        <text class="income-add__label">金额(¥)</text>
        <input v-model="amountInput" class="income-add__input income-add__input--big" type="digit" placeholder="0.00" />
      </view>

      <view class="income-add__field">
        <text class="income-add__label">收入类型</text>
        <view class="income-add__types">
          <view
            v-for="t in incomeTypes"
            :key="t"
            class="income-add__type"
            :class="{ 'income-add__type--active': form.type === t }"
            @click="form.type = t"
          >
            <text>{{ t }}</text>
          </view>
        </view>
      </view>

      <view class="income-add__field">
        <text class="income-add__label">日期</text>
        <picker mode="date" :value="dateStr" @change="onDateChange">
          <text class="income-add__picker">{{ dateStr }}</text>
        </picker>
      </view>

      <view class="income-add__field">
        <text class="income-add__label">备注</text>
        <input v-model="form.notes" class="income-add__input" placeholder="选填" />
      </view>
    </view>

    <view class="income-add__footer">
      <button class="income-add__submit" :loading="submitting" :disabled="!canSubmit" @click="submit">
        保存收入
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
  type: '其他',
  date: Date.now(),
  notes: '',
})

const incomeTypes = ['销售', '定金保留', '领养', '其他']

const dateStr = computed(() => {
  const d = new Date(form.date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const canSubmit = computed(() => {
  const amount = parseFloat(amountInput.value)
  return amount > 0 && form.type
})

function onDateChange(e: any) {
  form.date = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
}

const { run: addIncome } = useCloudCall('finance-service', 'addIncome', {
  successMessage: '已保存',
  showLoading: true,
})

async function submit() {
  submitting.value = true
  try {
    const res = await addIncome({
      amount: parseFloat(amountInput.value),
      type: form.type,
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
.income-add { min-height: 100vh; background: #f5f5f5; padding-bottom: 140rpx; }
.income-add__section { background: #fff; margin: 16rpx 32rpx; border-radius: 16rpx; padding: 24rpx; }
.income-add__field { padding: 20rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.income-add__field:last-child { border-bottom: none; }
.income-add__label { font-size: 28rpx; color: #333; margin-bottom: 12rpx; display: block; }
.income-add__input { font-size: 28rpx; color: #333; }
.income-add__input--big { font-size: 48rpx; font-weight: 700; color: #FF3B30; }
.income-add__types { display: flex; flex-wrap: wrap; gap: 12rpx; }
.income-add__type { padding: 10rpx 24rpx; border-radius: 20rpx; background: #f5f5f5; font-size: 26rpx; color: #666; }
.income-add__type--active { background: #FF3B30; color: #fff; }
.income-add__picker { font-size: 28rpx; color: #333; }
.income-add__footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 20rpx 32rpx; background: #fff; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); }
.income-add__submit { width: 100%; height: 88rpx; border-radius: 44rpx; background: #FF3B30; color: #fff; font-size: 32rpx; }
.income-add__submit[disabled] { opacity: 0.5; }
</style>
