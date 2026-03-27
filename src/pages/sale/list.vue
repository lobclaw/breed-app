<template>
  <view class="sale-list">
    <!-- 状态筛选 -->
    <view class="sale-list__filters">
      <view
        v-for="f in statusFilters"
        :key="f.value"
        class="sale-list__filter"
        :class="{ 'sale-list__filter--active': activeFilter === f.value }"
        @click="activeFilter = f.value; load()"
      >
        <text>{{ f.label }}</text>
      </view>
    </view>

    <!-- 列表 -->
    <view class="sale-list__items">
      <view v-for="sale in sales" :key="sale._id" class="sale-list__item" @click="goToDetail(sale._id)">
        <view class="sale-list__item-header">
          <text class="sale-list__item-name">{{ sale.dog_name }}</text>
          <text class="sale-list__item-status" :class="`sale-list__item-status--${sale.status}`">{{ sale.status }}</text>
        </view>
        <view class="sale-list__item-info">
          <text v-if="sale.floor_price">底价 ¥{{ sale.floor_price }}</text>
          <text v-if="sale.received_amount"> · 到手 ¥{{ sale.received_amount }}</text>
          <text v-if="sale.deposit_amount"> · 定金 ¥{{ sale.deposit_amount }}</text>
        </view>
      </view>

      <view v-if="sales.length === 0 && !loading" class="sale-list__empty">
        <text>暂无销售记录</text>
      </view>
    </view>

    <!-- FAB -->
    <view class="sale-list__fab" @click="goToCreate">
      <text>+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'

const sales = ref<any[]>([])
const loading = ref(true)
const activeFilter = ref('')

const statusFilters = [
  { label: '全部', value: '' },
  { label: '待售', value: '待售' },
  { label: '已预定', value: '已预定' },
  { label: '已成交', value: '已成交' },
]

const { run: fetchSales } = useCloudCall<{ data: any[] }>('finance-service', 'getSaleList')

async function load() {
  loading.value = true
  const filters: any = {}
  if (activeFilter.value) filters.status = activeFilter.value
  const res = await fetchSales(filters)
  if (res?.data) sales.value = res.data
  loading.value = false
}

function goToDetail(id: string) {
  uni.navigateTo({ url: `/pages/sale/detail?id=${id}` })
}

function goToCreate() {
  uni.navigateTo({ url: '/pages/sale/create' })
}

onShow(() => load())
</script>

<style scoped>
.sale-list { min-height: 100vh; background: #f5f5f5; padding-bottom: 120rpx; }
.sale-list__filters { display: flex; gap: 12rpx; padding: 16rpx 32rpx; background: #fff; overflow-x: auto; }
.sale-list__filter { padding: 10rpx 24rpx; border-radius: 20rpx; background: #f5f5f5; font-size: 26rpx; color: #666; white-space: nowrap; }
.sale-list__filter--active { background: #007AFF; color: #fff; }
.sale-list__items { padding: 16rpx 32rpx; }
.sale-list__item { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 12rpx; }
.sale-list__item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8rpx; }
.sale-list__item-name { font-size: 30rpx; font-weight: 600; color: #333; }
.sale-list__item-status { font-size: 24rpx; padding: 4rpx 16rpx; border-radius: 8rpx; }
.sale-list__item-status--待售 { background: #FFF3E0; color: #E65100; }
.sale-list__item-status--已预定 { background: #E3F2FD; color: #1565C0; }
.sale-list__item-status--已成交 { background: #E8F5E9; color: #2E7D32; }
.sale-list__item-status--已退款 { background: #f5f5f5; color: #999; }
.sale-list__item-status--定金取消 { background: #f5f5f5; color: #999; }
.sale-list__item-info { font-size: 26rpx; color: #999; }
.sale-list__empty { text-align: center; padding: 80rpx; color: #999; font-size: 28rpx; }
.sale-list__fab { position: fixed; right: 32rpx; bottom: 120rpx; width: 96rpx; height: 96rpx; border-radius: 50%; background: #007AFF; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 48rpx; box-shadow: 0 4rpx 16rpx rgba(0,122,255,0.3); }
</style>
