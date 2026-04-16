<template>
  <view class="page">
    <BPageHeader title="健康记录详情">
      <template #right>
        <view class="header-actions">
          <view class="header-action" @click="goEdit">
            <text class="material-icons-round" style="font-size: 22px; color: var(--text-2);">edit</text>
          </view>
          <view class="header-action" @click="showMore = true">
            <text class="material-icons-round" style="font-size: 22px; color: var(--text-2);">more_horiz</text>
          </view>
        </view>
      </template>
    </BPageHeader>

    <BSubmitBanner :message="submitBannerMessage" />

    <!-- 加载中 -->
    <view v-if="loading" class="card-feed">
      <BSkeleton :rows="5" />
    </view>

    <!-- 详情内容 -->
    <template v-if="!loading && record">
      <!-- 记录信息卡片 -->
      <view class="card-feed">
        <BCard :color="cardColor" :pressable="false">
          <view class="info-rows">
            <view class="info-row">
              <text class="info-row-label">记录类型</text>
              <view class="info-row-value">
                <BTag :label="typeLabel" :color="tagColor" />
              </view>
            </view>

            <view class="info-row">
              <text class="info-row-label">犬只</text>
              <view class="info-row-value">
                <view class="mini-avatar">
                  <text class="material-icons-round" style="color: #fff; font-size: 14px;">pets</text>
                </view>
                <text>{{ record.dog_name || '未知' }}</text>
              </view>
            </view>

            <!-- 疫苗特有字段 -->
            <template v-if="record.type === 'vaccination'">
              <view class="info-row">
                <text class="info-row-label">疫苗类型</text>
                <text class="info-row-value">{{ record.details?.vaccine_type || record.details?.vaccine_name || '—' }}</text>
              </view>
              <view class="info-row">
                <text class="info-row-label">接种日期</text>
                <text class="info-row-value">{{ formatDate(record.date) }}</text>
              </view>
              <view class="info-row" v-if="record.details?.next_reminder_date">
                <text class="info-row-label">下次提醒</text>
                <text class="info-row-value">{{ formatDate(record.details.next_reminder_date) }}</text>
              </view>
            </template>

            <!-- 驱虫特有字段 -->
            <template v-if="record.type === 'deworming'">
              <view class="info-row">
                <text class="info-row-label">驱虫类型</text>
                <text class="info-row-value">{{ dewormingTypeLabel }}</text>
              </view>
              <view class="info-row" v-if="record.details?.drug_name">
                <text class="info-row-label">药品名称</text>
                <text class="info-row-value">{{ record.details.drug_name }}</text>
              </view>
              <view class="info-row">
                <text class="info-row-label">日期</text>
                <text class="info-row-value">{{ formatDate(record.date) }}</text>
              </view>
            </template>

            <!-- 疾病特有字段 -->
            <template v-if="record.type === 'illness'">
              <view class="info-row" v-if="record.details?.condition">
                <text class="info-row-label">病症类型</text>
                <text class="info-row-value">{{ record.details.condition }}</text>
              </view>
              <view class="info-row" v-if="record.details?.severity">
                <text class="info-row-label">严重程度</text>
                <view class="info-row-value">
                  <BTag :label="record.details.severity" :color="severityColor" />
                </view>
              </view>
              <view class="info-row">
                <text class="info-row-label">发病日期</text>
                <text class="info-row-value">{{ formatDate(record.date) }}</text>
              </view>
              <view class="info-row" v-if="record.details?.treatment_status">
                <text class="info-row-label">治疗状态</text>
                <view class="info-row-value">
                  <BTag :label="record.details.treatment_status" :color="treatmentStatusColor" />
                </view>
              </view>
            </template>

            <!-- 通用字段 -->
            <view class="info-row" v-if="record.cost">
              <text class="info-row-label">费用</text>
              <text class="info-row-value" style="color: var(--green);">¥{{ formatAmount(record.cost) }}</text>
            </view>
            <view class="info-row">
              <text class="info-row-label">备注</text>
              <text class="info-row-value" :style="{ color: record.notes ? 'var(--text-1)' : 'var(--text-3)' }">{{ record.notes || '—' }}</text>
            </view>
          </view>
        </BCard>
      </view>

      <!-- 下次提醒 Banner -->
      <view v-if="nextReminderText" class="info-banner amber">
        <text class="material-icons-round" style="font-size: 16px; flex-shrink: 0; margin-top: 1px;">schedule</text>
        <text>{{ nextReminderText }}</text>
      </view>

      <!-- 创建信息 -->
      <view v-if="record.created_by_name" class="created-info">
        <text>创建人: {{ record.created_by_name }} · {{ formatDateTime(record.created_at) }}</text>
      </view>

      <!-- 操作按钮 -->
      <view class="action-area">
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

    <!-- 更多操作 Sheet -->
    <BSheet v-model:visible="showMore" title="更多操作">
      <view class="more-actions">
        <view class="more-action-item" @click="handleEditFromMore">
          <text class="material-icons-round" style="font-size: 20px; color: var(--text-2);">edit</text>
          <text class="more-action-label">编辑记录</text>
        </view>
        <view class="more-action-item" @click="handleDeleteFromMore">
          <text class="material-icons-round" style="font-size: 20px; color: var(--red);">delete</text>
          <text class="more-action-label" style="color: var(--red);">删除记录</text>
        </view>
      </view>
    </BSheet>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { consumeSubmitFeedback, queueSubmitFeedback, wait } from '@/composables/useSubmitFeedback'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import BCard from '@/components/base/BCard.vue'
import BTag from '@/components/base/BTag.vue'
import BButton from '@/components/base/BButton.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'

const record = ref<any>(null)
const loading = ref(true)
const showMore = ref(false)

let recordId = ''
const submitBannerMessage = ref('')
let submitBannerTimer: ReturnType<typeof setTimeout> | null = null

const typeMap: Record<string, { label: string; tagColor: any; cardColor: any }> = {
  vaccination: { label: '疫苗', tagColor: 'blue', cardColor: 'blue' },
  deworming: { label: '驱虫', tagColor: 'teal', cardColor: 'teal' },
  illness: { label: '疾病', tagColor: 'red', cardColor: 'red' },
}

const dewormingTypeMap: Record<string, string> = {
  internal: '内驱',
  external: '外驱',
  combo: '内外同驱',
}

const typeLabel = computed(() => typeMap[record.value?.type]?.label || record.value?.type || '未知')
const tagColor = computed(() => typeMap[record.value?.type]?.tagColor || 'green')
const cardColor = computed(() => typeMap[record.value?.type]?.cardColor || 'green')

const dewormingTypeLabel = computed(() => {
  const t = record.value?.details?.deworming_type
  return dewormingTypeMap[t] || t || '—'
})

const severityColor = computed(() => {
  const s = record.value?.details?.severity
  if (s === '严重') return 'red'
  if (s === '中等') return 'amber'
  return 'green'
})

const treatmentStatusColor = computed(() => {
  const s = record.value?.details?.treatment_status
  if (s === '治疗中') return 'amber'
  if (s === '已康复') return 'green'
  return 'plum'
})

const nextReminderText = computed(() => {
  const ts = record.value?.details?.next_reminder_date
  if (!ts) return ''
  const days = Math.ceil((ts - Date.now()) / 86400000)
  if (days < 0) return `下次提醒日期已过 ${Math.abs(days)} 天`
  if (days === 0) return '今天需要进行下次接种'
  return `距下次提醒还有 ${days} 天（${formatDate(ts)}）`
})

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

const { run: fetchRecord } = useCloudCall('health-service', 'getHealthRecord')
const { run: deleteRecord } = useCloudCall('health-service', 'deleteHealthRecord', {
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
}

function goEdit() {
  showMore.value = false
  uni.navigateTo({ url: `/pages/record/health-edit?id=${recordId}` })
}

function handleEditFromMore() {
  goEdit()
}

function confirmDelete() {
  showMore.value = false
  uni.showModal({
    title: '确认删除',
    content: '删除后不可恢复，确定要删除这条健康记录吗？',
    confirmColor: '#e05252',
    async success(res) {
      if (res.confirm) {
        const result = await deleteRecord(recordId)
        if (result) {
          queueSubmitFeedback({ message: '已删除健康记录' })
          await wait(140)
          uni.navigateBack()
        }
      }
    },
  })
}

function handleDeleteFromMore() {
  confirmDelete()
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
  const feedback = consumeSubmitFeedback('/pages/record/health-detail')
  if (feedback?.message) {
    showSubmitBanner(feedback.message)
  }
})
</script>

<style lang="scss" scoped>

.page {
  padding-bottom: 40px;
}

/* ==================== HEADER ACTIONS ==================== */
.header-actions {
  display: flex;
  gap: 4px;
}
.header-action {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, transform 0.12s ease;
  &:active { background: var(--card-dim); transform: scale(0.85); }
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
  &.amber { background: var(--amber-soft); color: var(--amber); }
  &.blue { background: var(--blue-soft); color: var(--blue); }
}

/* ==================== CREATED INFO ==================== */
.created-info {
  padding: 12px 16px 4px;
  font-size: 11px;
  color: var(--text-3);
  text-align: center;
}

/* ==================== MORE ACTIONS ==================== */
.more-actions {
  display: flex;
  flex-direction: column;
  padding-bottom: 12px;
}
.more-action-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 4px;
  border-bottom: 1px solid rgba(216, 203, 189, 0.2);
  transition: transform 0.12s ease;
  &:active { transform: scale(0.97); }
  &:last-child { border-bottom: none; }
}
.more-action-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}
</style>
