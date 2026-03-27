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

<style lang="scss" scoped>
.sale-list {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 60px;
}

.sale-list__filters {
  display: flex;
  gap: 6px;
  padding: 8px 16px;
  background: var(--card);
  overflow-x: auto;
}

.sale-list__filter {
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  background: var(--bg);
  font-size: 13px;
  color: var(--text-2);
  white-space: nowrap;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.sale-list__filter--active {
  background: var(--primary);
  color: var(--card);
}

.sale-list__items {
  padding: 8px 16px;
}

.sale-list__item {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 12px;
  margin-bottom: 6px;
  box-shadow: var(--shadow);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.sale-list__item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.sale-list__item-name {
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--text-1);
}

.sale-list__item-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: var(--radius-tag);
}

.sale-list__item-status--待售 {
  background: var(--amber-soft);
  color: var(--amber);
}

.sale-list__item-status--已预定 {
  background: var(--blue-soft);
  color: var(--blue);
}

.sale-list__item-status--已成交 {
  background: var(--green-soft);
  color: var(--green);
}

.sale-list__item-status--已退款 {
  background: var(--bg);
  color: var(--text-3);
}

.sale-list__item-status--定金取消 {
  background: var(--bg);
  color: var(--text-3);
}

.sale-list__item-info {
  font-size: 13px;
  color: var(--text-3);
}

.sale-list__empty {
  text-align: center;
  padding: 40px;
  color: var(--text-3);
  font-size: 14px;
}

.sale-list__fab {
  position: fixed;
  right: 16px;
  bottom: 60px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--card);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: var(--shadow-fab);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}
</style>
