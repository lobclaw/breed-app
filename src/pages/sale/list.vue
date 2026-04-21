<template>
  <view class="page">
    <!-- 页面标题 -->
    <view class="primary-page-header">
      <view class="primary-page-header__row">
        <text class="primary-page-header__title">销售管理</text>
      </view>
    </view>

    <!-- 状态筛选 Tabs -->
    <view class="filter-tabs primary-page-tabs primary-page-tabs--flush">
      <view
        v-for="f in statusFilters"
        :key="f.value"
        class="filter-tab primary-page-tab"
        :class="{ 'filter-tab--active primary-page-tab--active': activeFilter === f.value }"
        @click="activeFilter = f.value; load()"
      >
        <text>{{ f.label }}</text>
      </view>
    </view>

    <!-- 骨架屏 -->
    <view v-if="loading" class="primary-page-loading">
      <BSkeleton :rows="4" />
    </view>

    <!-- 列表 -->
    <view v-else-if="sales.length > 0" class="card-feed">
      <view
        v-for="sale in sales"
        :key="sale._id"
        class="sale-card"
        :class="getSaleCardColor(sale.status)"
        @click="goToDetail(sale._id)"
      >
        <view class="card-row">
          <BIconBox
            :icon="getSaleIcon(sale.status)"
            :color="getSaleIconColor(sale.status)"
          />
          <view class="card-middle">
            <text class="card-name">{{ sale.dog_name }}</text>
            <text class="card-sub">{{ sale.breed || '马尔济斯' }}{{ sale.sex ? ' · ' + sale.sex : '' }}</text>
          </view>
          <view class="card-right">
            <BTag :label="sale.status" :color="getStatusTagColor(sale.status)" />
            <text class="sale-price" :style="getSalePriceStyle(sale)">{{ getSalePriceText(sale) }}</text>
          </view>
        </view>
        <!-- 代理人 + 平台 行 -->
        <view v-if="sale.agent_name || sale.platform" class="sale-extra">
          <text class="sale-agent">{{ sale.agent_name ? '代理人：' + sale.agent_name : '' }}</text>
          <text v-if="sale.platform" class="platform-badge">{{ sale.platform }}</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="primary-page-empty">
      <BEmpty
        icon="storefront"
        title="暂无销售记录"
        description="设定底价后犬只进入待售状态"
        actionText="+ 创建销售"
        @action="goToCreate"
      />
    </view>

    <!-- 底部导航 -->
    <BNavBar current="finance" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BNavBar from '@/components/layout/BNavBar.vue'
import BIconBox from '@/components/base/BIconBox.vue'
import BTag from '@/components/base/BTag.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'

const CACHE_KEY = 'sale_list_cache'
function readSaleCache(): any[] {
  try { return JSON.parse(uni.getStorageSync(CACHE_KEY) || '[]') } catch { return [] }
}

const sales = ref<any[]>(readSaleCache())
const loading = ref(sales.value.length === 0)
const activeFilter = ref('')

const statusFilters = [
  { label: '全部', value: '' },
  { label: '待售', value: '待售' },
  { label: '已预定', value: '已预定' },
  { label: '已成交', value: '已成交' },
  { label: '已退款', value: '已退款' },
  { label: '定金取消', value: '定金取消' },
]

const { run: fetchSales } = useCloudCall<{ data: any[] }>('finance-service', 'getSaleList')

async function load() {
  if (sales.value.length === 0) loading.value = true
  const filters: any = {}
  if (activeFilter.value) filters.status = activeFilter.value
  const res = await fetchSales(filters)
  if (res?.data) {
    sales.value = res.data
    // 只缓存"全部"筛选结果
    if (!activeFilter.value) {
      try { uni.setStorageSync(CACHE_KEY, JSON.stringify(res.data)) } catch { /* ignore */ }
    }
  }
  loading.value = false
}

function goToDetail(id: string) {
  uni.navigateTo({ url: `/pages/sale/detail?id=${id}` })
}

function goToCreate() {
  uni.navigateTo({ url: '/pages/sale/create' })
}

function getSaleCardColor(status: string) {
  const map: Record<string, string> = {
    '待售': 'sale-card--gray',
    '已预定': 'sale-card--amber',
    '已成交': 'sale-card--green',
    '已退款': 'sale-card--red',
    '定金取消': 'sale-card--gray',
  }
  return map[status] || 'sale-card--gray'
}

function getSaleIcon(status: string) {
  const map: Record<string, string> = {
    '待售': 'storefront',
    '已预定': 'bookmark',
    '已成交': 'check_circle',
    '已退款': 'undo',
    '定金取消': 'cancel',
  }
  return map[status] || 'storefront'
}

function getSaleIconColor(status: string): 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal' {
  const map: Record<string, any> = {
    '已预定': 'amber',
    '已成交': 'green',
    '已退款': 'red',
  }
  return map[status] || 'amber'
}

function getStatusTagColor(status: string): 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal' | 'primary' {
  const map: Record<string, any> = {
    '待售': 'amber',
    '已预定': 'amber',
    '已成交': 'green',
    '已退款': 'red',
    '定金取消': 'amber',
  }
  return map[status] || 'amber'
}

function getSalePriceText(sale: any) {
  if (sale.status === '待售') return `底价 ¥${(sale.floor_price || 0).toLocaleString()}`
  if (sale.status === '已预定') return `定金 ¥${(sale.deposit_amount || 0).toLocaleString()}`
  if (sale.status === '已成交') return `到手 ¥${(sale.received_amount || 0).toLocaleString()}`
  if (sale.status === '已退款') return `退款 ¥${(sale.refund_amount || 0).toLocaleString()}`
  if (sale.status === '定金取消') return `保留 ¥${(sale.deposit_kept_amount || 0).toLocaleString()}`
  return ''
}

function getSalePriceStyle(sale: any) {
  if (sale.status === '已成交') return 'color: var(--red);'
  if (sale.status === '已退款') return 'color: var(--green);'
  if (sale.status === '定金取消') return 'color: var(--red);'
  return ''
}

onShow(() => load())
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

/* ==================== FILTER TABS ==================== */
.filter-tabs {
}

/* ==================== CARD FEED ==================== */
.card-feed {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: var(--primary-page-section-gap);
}

.sale-card {
  background: var(--card);
  border-radius: var(--primary-page-card-radius);
  padding: var(--space-card);
  padding-left: var(--space-card-left);
  position: relative;
  box-shadow: var(--primary-page-card-shadow);
  overflow: hidden;
  border-left: var(--primary-page-card-bar-width) solid transparent;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:active {
    transform: scale(var(--primary-page-card-active-scale));
    box-shadow: var(--primary-page-card-shadow-active);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 100%;
    pointer-events: none;
  }

  & > * { position: relative; z-index: 1; }

  &--gray {
    border-left-color: var(--text-4);
    &::before { background: linear-gradient(135deg, rgba(216,203,189,0.15) 0%, transparent 40%); }
  }

  &--amber {
    border-left-color: var(--amber);
    &::before { background: linear-gradient(135deg, var(--amber-soft) 0%, transparent 40%); }
  }

  &--green {
    border-left-color: var(--green);
    &::before { background: linear-gradient(135deg, var(--green-soft) 0%, transparent 40%); }
  }

  &--red {
    border-left-color: var(--red);
    &::before { background: linear-gradient(135deg, var(--red-soft) 0%, transparent 40%); }
  }
}

.card-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-middle {
  flex: 1;
  min-width: 0;
}

.card-name {
  font-size: var(--primary-page-card-title-size);
  font-weight: var(--primary-page-card-title-weight);
  color: var(--text-1);
  line-height: var(--primary-page-card-title-line-height);
  display: block;
}

.card-sub {
  font-size: var(--primary-page-card-subtitle-size);
  color: var(--primary-page-card-subtitle-color);
  margin-top: 1px;
  display: block;
}

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.sale-price {
  font-family: var(--font-display);
  font-size: var(--primary-page-card-accent-size);
  font-weight: var(--primary-page-card-accent-weight);
  color: var(--text-1);
}

.sale-extra {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.sale-agent {
  font-size: var(--primary-page-card-meta-size);
  color: var(--primary-page-card-meta-color);
}

.platform-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-tag);
  background: var(--card-dim);
  color: var(--text-2);
}
</style>
