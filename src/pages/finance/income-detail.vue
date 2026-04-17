<template>
  <view class="page">
    <BPageHeader title="收入详情" />

    <BSubmitBanner :message="submitBannerMessage" />

    <!-- 加载中 -->
    <view v-if="loading" class="card-feed">
      <BSkeleton :rows="4" />
    </view>

    <!-- 详情内容 -->
    <template v-if="!loading && record">
      <!-- 金额展示 -->
      <view class="amount-card">
        <text class="amount-value income">+¥{{ formatAmount(record.amount) }}</text>
        <view class="amount-meta">
          <BTag :label="record.type_label || '销售'" color="red" />
          <text class="amount-date">{{ formatDate(record.date) }}</text>
        </view>
      </view>

      <!-- 详情卡片 -->
      <view class="card-feed">
        <BCard color="red" :pressable="false">
          <view class="info-rows">
            <view class="info-row" v-if="record.linked_dog_name">
              <text class="info-row-label">关联犬只</text>
              <view class="info-row-value">
                <view class="mini-avatar">
                  <text class="material-icons-round" style="color: #fff; font-size: 14px;">pets</text>
                </view>
                <text>{{ record.linked_dog_name }}</text>
              </view>
            </view>
            <view class="info-row" v-if="record.sale_id">
              <text class="info-row-label">来源销售记录</text>
              <view class="info-row-value">
                <view class="link-text-row" @click="goToSale">
                  <text class="link-text">查看销售详情</text>
                  <text class="material-icons-round" style="font-size: 16px; color: var(--primary);">chevron_right</text>
                </view>
              </view>
            </view>
            <view class="info-row">
              <text class="info-row-label">来源</text>
              <view class="info-row-value">
                <BTag
                  :label="record.source === 'auto' ? '自动生成' : '手动录入'"
                  :color="record.source === 'auto' ? 'plum' : 'green'"
                />
              </view>
            </view>
            <view class="info-row" v-if="record.notes">
              <text class="info-row-label">备注</text>
              <text class="info-row-value">{{ record.notes }}</text>
            </view>
          </view>
        </BCard>
      </view>

      <!-- 创建信息 -->
      <view class="created-info">
        <text>创建人: {{ record.created_by_name || '系统' }} · {{ formatDateTime(record.created_at) }}</text>
      </view>

      <!-- 自动生成提示 -->
      <view v-if="record.source === 'auto'" class="info-banner blue">
        <text class="material-icons-round" style="font-size: 16px; flex-shrink: 0; margin-top: 1px;">info</text>
        <text>此记录由系统自动生成，如需修改请在销售记录中操作</text>
      </view>

      <!-- 操作按钮（手动记录才显示） -->
      <view v-if="record.source !== 'auto'" class="action-area">
        <view class="btn-row">
          <BButton variant="ghost" @click="goEdit">编辑</BButton>
          <BButton variant="ghost" color="red" @click="confirmDelete">删除</BButton>
        </view>
      </view>
    </template>

    <!-- 空状态 -->
    <BEmpty
      v-if="!loading && !record"
      icon="search_off"
      title="记录不存在"
      description="可能已被删除"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { consumeSubmitFeedback, queueSubmitFeedback, wait } from '@/composables/useSubmitFeedback'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import BCard from '@/components/base/BCard.vue'
import BTag from '@/components/base/BTag.vue'
import BButton from '@/components/base/BButton.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'

const record = ref<any>(null)
const loading = ref(true)
const submitBannerMessage = ref('')
let submitBannerTimer: ReturnType<typeof setTimeout> | null = null
let hasLoadedOnce = false

let recordId = ''

function formatDate(ts: number | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTime(ts: number | undefined): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${formatDate(ts)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatAmount(n: number): string {
  return n.toLocaleString('zh-CN')
}

const { run: fetchRecord } = useCloudCall('finance-service', 'getIncomeDetail')
const { run: deleteRecord } = useCloudCall('finance-service', 'deleteIncome', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

async function loadRecord() {
  loading.value = true
  const result = await fetchRecord(recordId)
  if (result?.data) {
    record.value = result.data
  }
  loading.value = false
  hasLoadedOnce = true
}

function goEdit() {
  uni.navigateTo({ url: `/pages/finance/income-edit?id=${recordId}` })
}

function goToSale() {
  if (record.value?.sale_id) {
    uni.navigateTo({ url: `/pages/sale/detail?id=${record.value.sale_id}` })
  }
}

function confirmDelete() {
  uni.showModal({
    title: '确认删除',
    content: '删除后不可恢复，确定要删除这条收入记录吗？',
    confirmColor: '#e05252',
    async success(res) {
      if (res.confirm) {
        const result = await deleteRecord(recordId)
        if (result) {
          queueSubmitFeedback({ message: '已删除收入记录' })
          await wait(140)
          uni.navigateBack()
        }
      }
    },
  })
}

function showSubmitBanner(message: string) {
  submitBannerMessage.value = message
  if (submitBannerTimer) clearTimeout(submitBannerTimer)
  submitBannerTimer = setTimeout(() => {
    submitBannerMessage.value = ''
  }, 2200)
}

onLoad((query) => {
  recordId = query?.id || ''
  if (recordId) {
    loadRecord()
  } else {
    loading.value = false
  }
})

onShow(() => {
  const feedback = consumeSubmitFeedback('/pages/finance/income-detail')
  if (feedback?.message) {
    showSubmitBanner(feedback.message)
  }
  if (recordId && hasLoadedOnce) {
    loadRecord()
  }
})
</script>

<style lang="scss" scoped>

.page {
  padding-bottom: 40px;
}

/* ==================== AMOUNT CARD ==================== */
.amount-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px 16px;
}
.amount-value {
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 800;
  &.income { color: var(--red); }
}
.amount-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}
.amount-date {
  font-size: 13px;
  color: var(--text-2);
}

/* ==================== CARD FEED ==================== */
.card-feed {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);
  margin-bottom: 8px;
}

/* ==================== INFO ROWS ==================== */
.info-rows {
  display: flex;
  flex-direction: column;
}
.info-row-label {
  flex-shrink: 0;
}
.info-row-value {
  text-align: right;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ==================== MINI AVATAR ==================== */
.mini-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--rose), var(--amber));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ==================== LINK ==================== */
.link-text-row {
  display: flex;
  align-items: center;
  gap: 4px;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.95); }
}
.link-text {
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
}

/* ==================== INFO BANNER ==================== */
.info-banner {
  margin: 8px 16px 12px;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  &.blue { background: var(--blue-soft); color: var(--blue); }
}

/* ==================== CREATED INFO ==================== */
.created-info {
  padding: 12px 16px 4px;
  font-size: 11px;
  color: var(--text-3);
  text-align: center;
}

</style>
