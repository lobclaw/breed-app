<template>
  <view class="page">
    <BPageHeader title="开始销售" />

    <view class="dog-picker-area">
      <BDogPicker
        v-model="selectedDog"
        title="选择犬只"
        :readonly="dogLocked"
        :candidate-dogs="lockedDogCandidates"
        :empty-title="dogLocked ? '犬只信息缺失' : '暂无犬只'"
        :empty-description="dogLocked ? '请返回来源页重新进入' : '没有符合条件的犬只'"
      />
    </view>

    <view class="form-section">
      <view class="form-card">
        <view class="form-group">
          <text class="form-label">销售方式</text>
          <view class="sale-mode-pills">
            <view
              v-for="mode in saleModeOptions"
              :key="mode"
              class="sale-mode-pill"
              :class="{ 'sale-mode-pill--active': form.sale_mode === mode }"
              @click="form.sale_mode = mode"
            >
              <text>{{ mode }}</text>
            </view>
          </view>
          <text class="form-helper">开始销售后会立即创建一条待售记录，后续再补定价或结算信息。</text>
        </view>
      </view>

      <view class="form-card">
        <view class="form-group">
          <text class="form-label">底价（选填）</text>
          <view class="price-input-wrapper">
            <text class="price-symbol">¥</text>
            <input
              v-model="floorPriceInput"
              type="digit"
              class="price-input"
              placeholder="暂未定价可留空"
            />
          </view>
          <text class="form-helper">底价是内部参考价，不再作为进入待售的前置条件。</text>
        </view>
      </view>

      <view class="form-card">
        <view class="form-group">
          <text class="form-label">买家信息（选填）</text>
          <input v-model="form.buyer_info" class="sale-input" placeholder="姓名 / 联系方式" />
        </view>
        <view class="form-group">
          <text class="form-label">备注（选填）</text>
          <textarea v-model="form.notes" class="sale-textarea" placeholder="补充来源、销售备注等..." />
        </view>
      </view>
    </view>

    <view class="fixed-bottom">
      <BSubmitButton
        :disabled="!selectedDog"
        :loading="submitState === 'submitting'"
        :success="submitState === 'success'"
        @click="submit"
      >{{ submitButtonText }}</BSubmitButton>
      <text class="submit-note">开始后犬只状态变为「待售」</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'

type SaleMode = '自售' | '代理' | '代卖'
type SelectedDog = {
  _id: string
  name: string
  role: string
  gender: string
  breed?: string
}

const saleModeOptions: SaleMode[] = ['自售', '代理', '代卖']

const selectedDog = ref<SelectedDog | null>(null)
const dogLocked = ref(false)
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const floorPriceInput = ref('')

const form = reactive({
  sale_mode: '自售' as SaleMode,
  buyer_info: '',
  notes: '',
})

const lockedDogCandidates = computed(() => {
  if (!dogLocked.value || !selectedDog.value) return undefined
  return [selectedDog.value]
})

const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '提交中...'
  if (submitState.value === 'success') return '已开始销售'
  return '确认开始销售'
})

const { run: createSale } = useCloudCall('finance-service', 'createSaleRecord', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

function decodeQueryText(value: string | undefined) {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

async function submit() {
  if (!selectedDog.value?._id) return
  submitState.value = 'submitting'
  try {
    const res = await createSale({
      dog_id: selectedDog.value._id,
      sale_mode: form.sale_mode,
      floor_price: floorPriceInput.value ? parseFloat(floorPriceInput.value) : null,
      buyer_info: form.buyer_info || null,
      notes: form.notes || null,
    })
    if (res) {
      submitState.value = 'success'
      queueSubmitFeedback({ message: '已开始销售' })
      await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
      uni.navigateBack()
    }
  } catch {
    submitState.value = 'idle'
  } finally {
    if (submitState.value !== 'success') submitState.value = 'idle'
  }
}

onLoad((options?: Record<string, any>) => {
  const dogId = options?.dogId || ''
  if (!dogId) return
  selectedDog.value = {
    _id: dogId,
    name: decodeQueryText(options?.dogName),
    role: '幼崽',
    gender: '',
  }
  dogLocked.value = true
})
</script>

<style lang="scss" scoped>
.dog-picker-area {
  padding: 0 16px 16px;
}

.form-section {
  padding: 0 16px;
}

.form-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 20px 16px;
  box-shadow: var(--shadow);
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 18px;

  &:last-child {
    margin-bottom: 0;
  }
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 8px;
  display: block;
}

.sale-mode-pills {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.sale-mode-pill {
  min-width: 76px;
  height: 38px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid rgba(203, 165, 92, 0.25);
  background: rgba(203, 165, 92, 0.08);
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;

  &--active {
    border-color: var(--amber);
    background: var(--amber-soft);
    color: var(--amber-dark, var(--amber));
  }
}

.price-input-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1.5px solid var(--text-4);
  border-radius: 14px;
  padding: 0 16px;
  height: 56px;
  background: var(--bg);
  transition: border-color 0.2s;

  &:focus-within {
    border-color: var(--primary);
  }
}

.price-symbol {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: var(--text-3);
}

.price-input {
  flex: 1;
  border: none;
  background: transparent;
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: var(--text-1);
}

.sale-input {
  height: 48px;
  border-radius: 14px;
  border: 1.5px solid var(--text-4);
  background: var(--bg);
  padding: 0 16px;
  font-size: 14px;
  color: var(--text-1);
  font-family: var(--font-body);
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--primary);
  }
}

.sale-textarea {
  border-radius: 14px;
  border: 1.5px solid var(--text-4);
  background: var(--bg);
  padding: 14px 16px;
  font-size: 14px;
  color: var(--text-1);
  font-family: var(--font-body);
  min-height: 80px;
  line-height: 1.5;
  resize: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--primary);
  }
}

.form-helper {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.5;
  display: block;
}

.submit-note {
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
  margin-top: 10px;
  display: block;
  line-height: 1.4;
}
</style>
