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
      <view class="card-feed">
        <view class="detail-summary" :class="`detail-summary--${cardColor}`">
          <view class="detail-summary__main">
            <view class="detail-summary__tag">
              <text class="detail-summary__tag-text">{{ typeLabel }}</text>
            </view>
            <text class="detail-summary__title">{{ summaryTitle }}</text>
            <text class="detail-summary__sub">{{ record.dog_name || '未知犬只' }} · {{ formatDate(record.date) }}</text>
            <view v-if="summaryFact" class="detail-summary__facts">
              <view class="detail-summary__fact" :class="summaryFact.tone ? `detail-summary__fact--${summaryFact.tone}` : ''">
                <text class="material-icons-round detail-summary__fact-icon">{{ summaryFact.icon || 'schedule' }}</text>
                <text class="detail-summary__fact-label">{{ summaryFact.label }}</text>
                <text class="detail-summary__fact-value">{{ summaryFact.value }}</text>
              </view>
            </view>
          </view>
          <view class="detail-summary__meta">
            <text class="detail-summary__meta-value">{{ summaryMeta }}</text>
            <text class="detail-summary__meta-label">{{ summaryMetaLabel }}</text>
          </view>
        </view>
      </view>

      <view class="section-label">
        <view class="section-dot" :class="`section-dot--${cardColor}`" />
        <text class="section-text">核心信息</text>
      </view>
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
              <text class="info-row-value info-row-value--note" :style="{ color: record.notes ? 'var(--text-1)' : 'var(--text-3)' }">{{ record.notes || '暂无补充说明' }}</text>
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
      <view v-if="record.created_by_name" class="section-label">
        <view class="section-dot section-dot--blue" />
        <text class="section-text">关联信息</text>
      </view>
      <view v-if="record.created_by_name" class="created-info">
        <text>创建人: {{ record.created_by_name }} · {{ formatDateTime(record.created_at) }}</text>
      </view>

      <!-- 操作按钮 -->
      <view class="section-label">
        <view class="section-dot section-dot--red" />
        <text class="section-text">操作</text>
      </view>
      <view class="action-area">
        <view class="record-action-card">
          <view class="record-action-card__glow" />
          <view class="record-action-card__row">
            <BButton class="record-action-card__primary" variant="filled" :color="actionButtonColor" @click="goEdit">编辑记录</BButton>
            <BButton class="record-action-card__secondary" variant="ghost" color="red" @click="confirmDelete">删除</BButton>
          </view>
          <text class="record-action-card__note">删除后不可恢复；编辑会保留来源页承接与返回体验。</text>
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
let hasShownOnce = false
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
const summaryTitle = computed(() => {
  if (record.value?.type === 'vaccination') return record.value?.details?.vaccine_type || record.value?.details?.vaccine_name || '疫苗记录'
  if (record.value?.type === 'deworming') return record.value?.details?.drug_name || dewormingTypeLabel.value || '驱虫记录'
  if (record.value?.type === 'illness') return record.value?.details?.condition || '疾病记录'
  return '健康记录'
})
const summaryMeta = computed(() => {
  if (record.value?.type === 'illness') return record.value?.details?.treatment_status || '观察中'
  if (record.value?.type === 'deworming') return dewormingTypeLabel.value
  return typeLabel.value
})
const summaryMetaLabel = computed(() => {
  if (record.value?.type === 'illness') return '当前状态'
  if (record.value?.type === 'deworming') return '驱虫类型'
  return '当前记录'
})
const actionButtonColor = computed(() => {
  if (cardColor.value === 'red') return 'red'
  if (cardColor.value === 'teal') return 'teal'
  return 'blue'
})
const summaryFact = computed(() => {
  if (!record.value) return null

  if (record.value.type === 'illness') {
    return {
      label: '病程',
      value: formatIllnessCourseText(record.value.date),
      tone: 'red',
      icon: 'timeline',
    }
  }

  if (record.value.type === 'vaccination' && nextReminderShortText.value) {
    return {
      label: '下次提醒',
      value: nextReminderShortText.value,
      tone: 'blue',
      icon: 'schedule',
    }
  }

  return null
})

const nextReminderText = computed(() => {
  const ts = record.value?.details?.next_reminder_date
  if (!ts) return ''
  const days = Math.ceil((ts - Date.now()) / 86400000)
  if (days < 0) return `下次提醒日期已过 ${Math.abs(days)} 天`
  if (days === 0) return '今天需要进行下次接种'
  return `距下次提醒还有 ${days} 天（${formatDate(ts)}）`
})

const nextReminderShortText = computed(() => {
  const ts = record.value?.details?.next_reminder_date
  if (!ts) return ''
  const days = Math.ceil((ts - Date.now()) / 86400000)
  if (days < 0) return `已过 ${Math.abs(days)} 天`
  if (days === 0) return '今天'
  return `${days}天后`
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

function formatIllnessCourseText(ts: number | undefined): string {
  if (!ts) return '病程未记录'
  const days = Math.max(1, Math.floor((Date.now() - ts) / 86400000) + 1)
  return `病程第${days}天`
}

function formatAmount(n: number): string {
  return n.toLocaleString('zh-CN')
}

const { run: fetchRecord } = useCloudCall('health-service', 'getHealthRecordDetail')
const { run: deleteRecord } = useCloudCall('health-service', 'deleteHealthRecord', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

async function loadRecord() {
  loading.value = true
  const result = await fetchRecord({ id: recordId })
  if (result) {
    record.value = result.data || result
  }
  loading.value = false
}

function resolveHealthRecordId(query?: Record<string, unknown> | null) {
  const id = typeof query?.id === 'string' ? query.id.trim() : ''
  if (id) return id
  const recordId = typeof query?.recordId === 'string' ? query.recordId.trim() : ''
  if (recordId) return recordId
  return typeof query?.record_id === 'string' ? query.record_id.trim() : ''
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
  recordId = resolveHealthRecordId(query as Record<string, unknown>)
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
  if (!hasShownOnce) {
    hasShownOnce = true
    return
  }
  if (recordId) loadRecord()
})
</script>

<style lang="scss" scoped>

.page {
  padding-bottom: 40px;
}

.detail-summary {
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  box-shadow: var(--shadow);
}
.detail-summary--blue { background: linear-gradient(135deg, var(--blue-soft), rgba(255, 255, 255, 0.98)); }
.detail-summary--teal { background: linear-gradient(135deg, rgba(61, 168, 160, 0.12), rgba(255, 255, 255, 0.98)); }
.detail-summary--red { background: linear-gradient(135deg, var(--red-soft), rgba(255, 255, 255, 0.98)); }
.detail-summary__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.detail-summary__tag {
  width: fit-content;
  padding: 4px 10px;
  border-radius: var(--radius-tag);
  background: rgba(255, 255, 255, 0.86);
}
.detail-summary__tag-text {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-2);
}
.detail-summary__title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-1);
}
.detail-summary__sub {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
}
.detail-summary__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.detail-summary__fact {
  min-width: 0;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.detail-summary__fact--red { background: rgba(255, 240, 240, 0.94); }
.detail-summary__fact--green { background: rgba(240, 255, 244, 0.94); }
.detail-summary__fact--amber { background: rgba(255, 249, 240, 0.94); }
.detail-summary__fact--blue { background: rgba(240, 247, 255, 0.96); }
.detail-summary__fact--teal { background: rgba(240, 255, 254, 0.96); }
.detail-summary__fact-icon {
  font-size: 13px;
  color: var(--text-3);
}
.detail-summary__fact-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-3);
}
.detail-summary__fact-value {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-1);
}
.detail-summary__meta {
  min-width: 68px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.detail-summary__meta-value {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 800;
  color: var(--text-1);
}
.detail-summary__meta-label {
  font-size: 11px;
  color: var(--text-3);
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

  &--note {
    max-width: 180px;
    text-align: right;
    line-height: 1.45;
    font-weight: 500;
  }
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

.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px 10px;
}
.section-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.section-dot--blue { background: var(--blue); }
.section-dot--teal { background: var(--teal); }
.section-dot--red { background: var(--red); }
.section-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.5px;
}

/* ==================== CREATED INFO ==================== */
.created-info {
  margin: 0 16px 8px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(74, 141, 212, 0.08);
  font-size: 11px;
  color: var(--text-3);
  text-align: center;
}

.record-action-card {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  border: 1px solid rgba(224, 82, 82, 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(250, 246, 243, 0.98));
  box-shadow: 0 10px 30px rgba(101, 74, 145, 0.06);
  padding: 14px;
}
.record-action-card__glow {
  position: absolute;
  top: -32px;
  right: -18px;
  width: 120px;
  height: 120px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(224, 82, 82, 0.1), rgba(224, 82, 82, 0));
  pointer-events: none;
}
.record-action-card__row {
  position: relative;
  display: flex;
  gap: 10px;
}
.record-action-card__primary {
  flex: 1;
  min-width: 0;
  min-height: 50px;
  border-radius: 16px;
}
.record-action-card__secondary {
  min-width: 104px;
  min-height: 50px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
  border-color: rgba(224, 82, 82, 0.16);
}
.record-action-card__note {
  position: relative;
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-3);
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
