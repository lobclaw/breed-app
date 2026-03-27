<template>
  <view class="sale-create">
    <view class="sale-create__section">
      <!-- 选择犬只 -->
      <view class="sale-create__field">
        <text class="sale-create__label">选择犬只 *</text>
        <picker :range="dogNames" @change="onDogChange">
          <text class="sale-create__picker" :class="{ 'sale-create__picker--placeholder': !form.dog_id }">
            {{ selectedDogName || '请选择犬只' }}
          </text>
        </picker>
      </view>

      <!-- 底价 -->
      <view class="sale-create__field">
        <text class="sale-create__label">底价(¥)</text>
        <input v-model="floorPriceInput" class="sale-create__input" type="digit" placeholder="选填" />
      </view>

      <!-- 买家信息 -->
      <view class="sale-create__field">
        <text class="sale-create__label">买家信息</text>
        <input v-model="form.buyer_info" class="sale-create__input" placeholder="选填" />
      </view>

      <!-- 备注 -->
      <view class="sale-create__field">
        <text class="sale-create__label">备注</text>
        <input v-model="form.notes" class="sale-create__input" placeholder="选填" />
      </view>
    </view>

    <view class="sale-create__footer">
      <button class="sale-create__submit" :loading="submitting" :disabled="!form.dog_id" @click="submit">
        创建销售记录
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'

const dogs = ref<any[]>([])
const submitting = ref(false)
const floorPriceInput = ref('')

const form = reactive({
  dog_id: '',
  buyer_info: '',
  notes: '',
})

const dogNames = computed(() => dogs.value.map(d => d.name))
const selectedDogName = computed(() => {
  const dog = dogs.value.find(d => d._id === form.dog_id)
  return dog?.name || ''
})

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
  // 加载可售犬只（在养 + 自留状态）
  const res = await fetchDogs()
  if (res?.data) {
    dogs.value = res.data.filter((d: any) => ['在养', '自留'].includes(d.disposition))
  }
})
</script>

<style scoped>
.sale-create { min-height: 100vh; background: #f5f5f5; padding-bottom: 140rpx; }
.sale-create__section { background: #fff; margin: 16rpx 32rpx; border-radius: 16rpx; padding: 24rpx; }
.sale-create__field { padding: 20rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.sale-create__field:last-child { border-bottom: none; }
.sale-create__label { font-size: 28rpx; color: #333; margin-bottom: 12rpx; display: block; }
.sale-create__input { font-size: 28rpx; color: #333; }
.sale-create__picker { font-size: 28rpx; color: #333; padding: 8rpx 0; }
.sale-create__picker--placeholder { color: #ccc; }
.sale-create__footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 20rpx 32rpx; background: #fff; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); }
.sale-create__submit { width: 100%; height: 88rpx; border-radius: 44rpx; background: #007AFF; color: #fff; font-size: 32rpx; }
.sale-create__submit[disabled] { opacity: 0.5; }
</style>
