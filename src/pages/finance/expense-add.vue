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

<style lang="scss" scoped>
.expense-add {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 70px;
}

.expense-add__section {
  background: var(--card);
  margin: 8px 16px;
  border-radius: var(--radius-card);
  padding: 12px;
  box-shadow: var(--shadow);
}

.expense-add__field {
  padding: 10px 0;
  border-bottom: 1px solid var(--bg);
}

.expense-add__field:last-child {
  border-bottom: none;
}

.expense-add__label {
  font-size: 14px;
  color: var(--text-1);
  margin-bottom: 6px;
  display: block;
}

.expense-add__input {
  font-size: 14px;
  color: var(--text-1);
}

.expense-add__input--big {
  font-size: 24px;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--green);
}

.expense-add__categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.expense-add__cat {
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  background: var(--bg);
  font-size: 13px;
  color: var(--text-2);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.expense-add__cat--active {
  background: var(--green);
  color: var(--card);
}

.expense-add__picker {
  font-size: 14px;
  color: var(--text-1);
}

.expense-add__footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px 16px;
  background: var(--card);
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  box-shadow: var(--shadow);
}

.expense-add__submit {
  width: 100%;
  height: 44px;
  border-radius: var(--radius-btn);
  background: var(--green);
  color: var(--card);
  font-size: 16px;
  font-family: var(--font-display);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.expense-add__submit[disabled] {
  opacity: 0.5;
}
</style>
