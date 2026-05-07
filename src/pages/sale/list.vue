<template>
  <view class="page">
    <BPageHeader title="销售管理">
      <template #right>
        <view class="primary-page-header__action primary-page-header__action--primary" @click="goToCreate">
          <text class="primary-page-header__icon primary-page-header__icon--primary">add</text>
        </view>
      </template>
    </BPageHeader>

    <BChipFilterStrip v-model="activeFilter" :options="statusFilters" @change="load" />

    <view v-if="loading" class="primary-page-loading">
      <BSkeleton :rows="4" />
    </view>

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
            <text class="card-sub">{{ getSaleSubtitle(sale) }}</text>
          </view>
          <view class="card-right">
            <BTag :label="sale.status" :color="getStatusTagColor(sale.status)" />
            <text class="sale-price" :style="getSalePriceStyle(sale)">{{ getSalePriceText(sale) }}</text>
          </view>
        </view>
        <view v-if="sale.agent_name || sale.platform" class="sale-extra">
          <text class="sale-agent">{{ sale.agent_name ? '代理人：' + sale.agent_name : '' }}</text>
          <text v-if="sale.platform" class="platform-badge">{{ sale.platform }}</text>
        </view>
      </view>
    </view>

    <view v-else class="primary-page-empty">
      <BEmpty
        icon="storefront"
        title="暂无销售记录"
        description="开始销售后犬只进入待售状态"
        actionText="+ 开始销售"
        @action="goToCreate"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import BChipFilterStrip from '@/components/base/BChipFilterStrip.vue'
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import { listLocalSales } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BIconBox from '@/components/base/BIconBox.vue'
import BTag from '@/components/base/BTag.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'

const { currentFamily } = useAuth()
usePageSync({ routePath: 'pages/sale/list' })

const sales = ref<any[]>([])
const loading = ref(true)
const activeFilter = ref('')

const statusFilters: Array<{ label: string; value: string }> = [
  { label: '全部', value: '' },
  { label: '待售', value: '待售' },
  { label: '已预定', value: '已预定' },
  { label: '已成交', value: '已成交' },
  { label: '已退款', value: '已退款' },
  { label: '定金取消', value: '定金取消' },
]

async function load() {
  loading.value = true
  const familyId = currentFamily.value?._id || ''
  if (!familyId) {
    sales.value = []
    loading.value = false
    return
  }
  localSyncRuntime.setCurrentFamilyId(familyId)
  sales.value = await listLocalSales(familyId, {
    status: activeFilter.value || undefined,
  })
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

function getSaleSubtitle(sale: any) {
  const parts = [
    sale.sale_mode || '待定',
    sale.breed || '马尔济斯',
    sale.sex || sale.gender || '',
  ].filter(Boolean)
  return parts.join(' · ')
}

function getSalePriceText(sale: any) {
  if (sale.status === '待售') {
    return sale.floor_price ? `底价 ¥${sale.floor_price.toLocaleString()}` : '未定价'
  }
  if (sale.status === '已预定') return `定金 ¥${(sale.deposit_amount || 0).toLocaleString()}`
  if (sale.status === '已成交') {
    if (sale.settlement_status === '部分结算') return '部分结算'
    if (sale.received_amount != null) return `到手 ¥${sale.received_amount.toLocaleString()}`
    return '未结算'
  }
  if (sale.status === '已退款') return `退款 ¥${(sale.refund_amount || 0).toLocaleString()}`
  if (sale.status === '定金取消') {
    return sale.deposit_kept_amount ? `保留 ¥${sale.deposit_kept_amount.toLocaleString()}` : '已取消'
  }
  return ''
}

function getSalePriceStyle(sale: any) {
  if (sale.status === '已成交' && sale.settlement_status === '部分结算') return 'color: var(--amber);'
  if (sale.status === '已成交' && sale.received_amount != null) return 'color: var(--red);'
  if (sale.status === '已成交') return 'color: var(--amber);'
  if (sale.status === '已退款') return 'color: var(--green);'
  if (sale.status === '定金取消') return 'color: var(--red);'
  if (sale.status === '待售' && !sale.floor_price) return 'color: var(--text-3);'
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
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    pointer-events: none;
  }

  & > * {
    position: relative;
    z-index: 1;
  }

  &--gray {
    border-left-color: var(--text-4);

    &::before {
      background: linear-gradient(135deg, rgba(216, 203, 189, 0.15) 0%, transparent 40%);
    }
  }

  &--amber {
    border-left-color: var(--amber);

    &::before {
      background: linear-gradient(135deg, var(--amber-soft) 0%, transparent 40%);
    }
  }

  &--green {
    border-left-color: var(--green);

    &::before {
      background: linear-gradient(135deg, var(--green-soft) 0%, transparent 40%);
    }
  }

  &--red {
    border-left-color: var(--red);

    &::before {
      background: linear-gradient(135deg, var(--red-soft) 0%, transparent 40%);
    }
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
  gap: 6px;
  flex-shrink: 0;
}

.sale-price {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
}

.sale-extra {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-left: 40px;
  flex-wrap: wrap;
}

.sale-agent {
  font-size: 12px;
  color: var(--text-3);
}

.platform-badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--amber-soft);
  color: var(--amber);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}
</style>
