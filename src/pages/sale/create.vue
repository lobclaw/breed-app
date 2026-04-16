<template>
  <view class="page">
    <!-- 顶栏 -->
    <BPageHeader title="设定底价" />

    <!-- 犬只选择 -->
    <view class="dog-picker-area">
      <BDogPicker v-model="selectedDog" title="选择犬只" />
    </view>

    <!-- 表单 -->
    <view class="form-section">
      <view class="form-card">
        <view class="form-group">
          <text class="form-label">底价</text>
          <view class="price-input-wrapper">
            <text class="price-symbol">¥</text>
            <input
              v-model="floorPriceInput"
              type="digit"
              class="price-input"
              placeholder="输入底价"
            />
          </view>
          <text class="form-helper">底价是给代理人的最低出售价，实际到手价不应低于此值</text>
        </view>
      </view>

      <!-- 买家信息 + 备注 -->
      <view class="form-card">
        <view class="form-group">
          <text class="form-label">买家信息（选填）</text>
          <input v-model="form.buyer_info" class="sale-input" placeholder="姓名/联系方式" />
        </view>
        <view class="form-group">
          <text class="form-label">备注（选填）</text>
          <textarea v-model="form.notes" class="sale-textarea" placeholder="添加备注..." />
        </view>
      </view>
    </view>

    <!-- 固定底部按钮 -->
    <view class="fixed-bottom">
      <button
        class="submit-btn"
        :disabled="!selectedDog"
        :loading="submitState === 'submitting'"
        :class="{ 'submit-btn--success': submitState === 'success' }"
        @click="submit"
      >{{ submitButtonText }}</button>
      <text class="submit-note">设定后犬只状态变为「待售」</text>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useCloudCall } from '@/composables/useCloudCall'
import { queueSubmitFeedback, wait } from '@/composables/useSubmitFeedback'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'

const selectedDog = ref<any>(null)
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const floorPriceInput = ref('')

const form = reactive({
  buyer_info: '',
  notes: '',
})

const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '提交中...'
  if (submitState.value === 'success') return '已创建'
  return '确认设定底价'
})

const { run: createSale } = useCloudCall('finance-service', 'createSaleRecord', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

async function submit() {
  submitState.value = 'submitting'
  try {
    const res = await createSale({
      dog_id: selectedDog.value?._id || '',
      floor_price: floorPriceInput.value ? parseFloat(floorPriceInput.value) : null,
      buyer_info: form.buyer_info || null,
      notes: form.notes || null,
    })
    if (res) {
      submitState.value = 'success'
      queueSubmitFeedback({ message: '已创建销售记录' })
      await wait(140)
      uni.navigateBack()
    }
  } catch {
    submitState.value = 'idle'
  } finally {
    if (submitState.value !== 'success') submitState.value = 'idle'
  }
}
</script>

<style lang="scss" scoped>

/* ==================== DOG PICKER AREA ==================== */
.dog-picker-area {
  padding: 0 16px 16px;
}

/* ==================== FORM ==================== */
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
  &:last-child { margin-bottom: 0; }
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 8px;
  display: block;
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

  &:focus-within { border-color: var(--primary); }
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
  &:focus { border-color: var(--primary); }
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
  &:focus { border-color: var(--primary); }
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
