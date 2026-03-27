<template>
  <view class="page">
    <!-- 顶栏 -->
    <BPageHeader title="设定底价" />

    <!-- 犬只选择卡片 -->
    <view class="dog-card" v-if="selectedDog" @click="showDogPicker = true">
      <view class="dog-avatar">
        <text class="material-icons-round" style="color: #fff; font-size: 22px;">pets</text>
      </view>
      <view class="dog-info">
        <text class="dog-name">{{ selectedDog.name }}</text>
        <text class="dog-meta">{{ selectedDog.breed || '马尔济斯' }}{{ selectedDog.sex ? ' · ' + selectedDog.sex : '' }}</text>
      </view>
      <BTag :label="selectedDog.disposition || '在养'" color="amber" />
    </view>

    <!-- 空选择卡片 -->
    <view class="dog-card dog-card--empty" v-else @click="showDogPicker = true">
      <text class="material-icons-round" style="font-size: 22px; color: var(--text-3);">pets</text>
      <text style="font-size: 14px; color: var(--text-3); flex: 1;">点击选择犬只</text>
      <text class="material-icons-round" style="font-size: 18px; color: var(--text-4);">chevron_right</text>
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
    </view>

    <!-- 提交 -->
    <view class="submit-area">
      <button
        class="submit-btn"
        :disabled="!form.dog_id"
        :loading="submitting"
        @click="submit"
      >确认设定底价</button>
      <text class="submit-note">设定后犬只状态变为「待售」</text>
    </view>

    <!-- 犬只选择器 Picker -->
    <picker
      v-if="dogs.length > 0"
      :range="dogNames"
      :value="dogPickerIdx"
      @change="onDogChange"
      style="display: none;"
      ref="dogPickerRef"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BTag from '@/components/base/BTag.vue'

const dogs = ref<any[]>([])
const submitting = ref(false)
const floorPriceInput = ref('')
const showDogPicker = ref(false)
const dogPickerIdx = ref(0)

const form = reactive({
  dog_id: '',
  buyer_info: '',
  notes: '',
})

const dogNames = computed(() => dogs.value.map(d => d.name))
const selectedDog = computed(() => dogs.value.find(d => d._id === form.dog_id) || null)

function onDogChange(e: any) {
  const idx = e.detail.value
  if (dogs.value[idx]) {
    form.dog_id = dogs.value[idx]._id
  }
}

const { run: fetchDogs } = useCloudCall<{ data: any[] }>('dog-service', 'getDogListWithStatus')
const { run: createSale } = useCloudCall('finance-service', 'createSaleRecord', {
  successMessage: '已创建',
  showLoading: true,
})

async function submit() {
  submitting.value = true
  try {
    const res = await createSale({
      dog_id: form.dog_id,
      floor_price: floorPriceInput.value ? parseFloat(floorPriceInput.value) : null,
      buyer_info: form.buyer_info || null,
      notes: form.notes || null,
    })
    if (res) uni.navigateBack()
  } finally {
    submitting.value = false
  }
}

onLoad(async () => {
  const res = await fetchDogs()
  if (res?.data) {
    dogs.value = res.data.filter((d: any) => ['在养', '自留'].includes(d.disposition))
  }
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

/* ==================== DOG CARD ==================== */
.dog-card {
  margin: 0 16px 16px;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  overflow: hidden;
  border-left: 3.5px solid var(--amber);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 100%;
    background: linear-gradient(135deg, var(--amber-soft) 0%, transparent 40%);
    pointer-events: none;
  }

  & > * { position: relative; z-index: 1; }

  &--empty {
    border-left-color: var(--text-4);
    &::before { background: none; }
  }
}

.dog-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dog-info { flex: 1; min-width: 0; }

.dog-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  display: block;
}

.dog-meta {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 2px;
  display: block;
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

.form-helper {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.5;
  display: block;
}

/* ==================== SUBMIT ==================== */
.submit-area {
  padding: 16px 16px 24px;
}

.submit-btn {
  width: 100%;
  height: 50px;
  border-radius: var(--radius-btn);
  border: none;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  background: var(--primary);
  box-shadow: 0 4px 16px rgba(234, 62, 119, 0.25);
  transition: all 0.12s ease;
  &:active { transform: scale(0.97); opacity: 0.9; }

  &[disabled] { opacity: 0.5; }
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
