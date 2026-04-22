<template>
  <view class="page">
    <BPageHeader title="支出详情" />

    <BSubmitBanner :message="submitBannerMessage" />

    <!-- 加载中 -->
    <view v-if="loading" class="card-feed">
      <BSkeleton :rows="5" />
    </view>

    <!-- 详情内容 -->
    <template v-if="!loading && record">
      <!-- 金额展示 -->
      <view class="amount-card">
        <text class="amount-value expense">-¥{{ formatAmount(record.amount) }}</text>
        <view class="amount-meta">
          <BTag :label="record.category || '其他'" color="green" />
          <text class="amount-date">{{ formatDate(record.date) }}</text>
        </view>
      </view>

      <!-- 详情卡片 -->
      <view class="card-feed">
        <BCard color="green" :pressable="false">
          <view class="info-rows">
            <view class="info-row" v-if="record.linked_dogs && record.linked_dogs.length">
              <text class="info-row-label">关联犬只</text>
              <view class="info-row-value">
                <view v-for="dog in record.linked_dogs" :key="dog._id" class="dog-chip" @click="goToDog(dog._id)">
                  <view class="mini-avatar">
                    <BEntityIcon :size="14" color="#fff" />
                  </view>
                  <text>{{ dog.name }}</text>
                </view>
              </view>
            </view>
            <view class="info-row" v-if="record.linked_ref">
              <text class="info-row-label">关联方式</text>
              <text class="info-row-value info-row-value--wrap">{{ record.linked_ref }}</text>
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
            <view class="info-row">
              <text class="info-row-label">图片凭证</text>
              <text class="info-row-value" :style="{ color: record.images?.length ? 'var(--text-1)' : 'var(--text-3)' }">
                {{ record.images?.length ? `${record.images.length}张` : '—' }}
              </text>
            </view>
            <!-- 图片预览 -->
            <view v-if="record.images?.length" class="image-gallery">
              <image
                v-for="(img, idx) in record.images"
                :key="idx"
                :src="img"
                class="image-thumb"
                mode="aspectFill"
                @click="previewImage(img)"
              />
            </view>
            <view class="info-row">
              <text class="info-row-label">备注</text>
              <text class="info-row-value" :style="{ color: record.notes ? 'var(--text-1)' : 'var(--text-3)' }">
                {{ record.notes || '—' }}
              </text>
            </view>
          </view>
        </BCard>
      </view>

      <!-- 创建信息 -->
      <view v-if="record.source === 'auto' || record.created_by_name" class="created-info">
        <text>创建人: {{ record.source === 'auto' ? '系统' : record.created_by_name }} · {{ formatDateTime(record.created_at) }}</text>
      </view>

      <!-- 自动生成提示 -->
      <view v-if="record.source === 'auto'" class="info-banner blue">
        <text class="material-icons-round" style="font-size: 16px; flex-shrink: 0; margin-top: 1px;">info</text>
        <text>此记录由系统自动生成，如需修改请在原始记录中操作</text>
      </view>

      <!-- 操作按钮（手动记录才显示） -->
      <view v-if="record.source !== 'auto'" class="action-area action-area--green">
        <view class="detail-action-card">
          <view class="detail-action-card__glow" />
          <view class="detail-action-card__row">
            <BButton class="detail-action-card__primary" variant="filled" color="green" @click="goEdit">编辑记录</BButton>
            <BButton class="detail-action-card__secondary" variant="ghost" color="red" @click="confirmDelete">删除记录</BButton>
          </view>
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

    <BModal
      v-model:visible="showDeleteConfirm"
      title="确认删除"
      content="删除后不可恢复，确定要删除这条支出记录吗？"
      confirmText="删除"
      :danger="true"
      @confirm="handleDeleteConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { consumeSubmitFeedback, queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import BCard from '@/components/base/BCard.vue'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BTag from '@/components/base/BTag.vue'
import BButton from '@/components/base/BButton.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BModal from '@/components/layout/BModal.vue'

const record = ref<any>(null)
const loading = ref(true)
const submitBannerMessage = ref('')
const showDeleteConfirm = ref(false)
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

const { run: fetchRecord } = useCloudCall('finance-service', 'getExpenseDetail')
const { run: deleteRecord } = useCloudCall('finance-service', 'deleteExpense', {
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

function previewImage(url: string) {
  uni.previewImage({
    current: url,
    urls: record.value?.images || [url],
  })
}

function goEdit() {
  uni.navigateTo({ url: `/pages/finance/expense-edit?id=${recordId}` })
}

function goToDog(dogId: string) {
  uni.navigateTo({ url: `/pages/dog/detail?id=${dogId}` })
}

function confirmDelete() {
  showDeleteConfirm.value = true
}

async function handleDeleteConfirm() {
  const result = await deleteRecord(recordId)
  if (result) {
    queueSubmitFeedback({ message: '已删除支出记录' })
    await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
    uni.navigateBack()
  }
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
  const feedback = consumeSubmitFeedback('/pages/finance/expense-detail')
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
  &.expense { color: var(--green); }
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

  &--wrap {
    max-width: 200px;
    text-align: right;
    line-height: 1.4;
  }
}

/* ==================== IMAGE GALLERY ==================== */
.image-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 0 4px;
}
.image-thumb {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  background: var(--card-dim);
  object-fit: cover;
}

/* ==================== DOG CHIP ==================== */
.dog-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.95); }
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
