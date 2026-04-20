<template>
  <view class="page">
    <BPageHeader title="繁育记录详情">
      <template #right>
        <view class="header-actions">
          <view v-if="canEdit" class="header-action" @click="goEdit">
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
      <BSkeleton :rows="6" />
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
            <text class="detail-summary__sub">{{ record.dog_name || '未知犬只' }} · {{ summaryDateText }}</text>
          </view>
          <view class="detail-summary__meta">
            <text class="detail-summary__meta-value">{{ summaryMeta }}</text>
            <text class="detail-summary__meta-label">当前记录</text>
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

            <!-- 发情 -->
            <template v-if="record.type === 'heat'">
              <view class="info-row">
                <text class="info-row-label">种母</text>
                <view class="info-row-value">
                  <view class="mini-avatar">
                    <text class="material-icons-round" style="color: #fff; font-size: 14px;">pets</text>
                  </view>
                  <text>{{ record.dog_name || '未知' }}</text>
                </view>
              </view>
              <view class="info-row">
                <text class="info-row-label">发情开始日期</text>
                <text class="info-row-value">{{ formatDate(record.date) }}</text>
              </view>
              <view class="info-row" v-if="record.details?.symptoms">
                <text class="info-row-label">症状</text>
                <text class="info-row-value">{{ record.details.symptoms }}</text>
              </view>
            </template>

            <!-- 配种 -->
            <template v-if="record.type === 'mating'">
              <view class="info-row">
                <text class="info-row-label">种母</text>
                <view class="info-row-value">
                  <view class="mini-avatar">
                    <text class="material-icons-round" style="color: #fff; font-size: 14px;">pets</text>
                  </view>
                  <text>{{ record.dog_name || '未知' }}</text>
                </view>
              </view>
              <view class="info-row" v-if="getMatingSireName(record.details)">
                <text class="info-row-label">种公</text>
                <view class="info-row-value">
                  <view class="mini-avatar">
                    <text class="material-icons-round" style="color: #fff; font-size: 14px;">pets</text>
                  </view>
                  <text>{{ getMatingSireName(record.details) }}</text>
                </view>
              </view>
              <view class="info-row">
                <text class="info-row-label">配种日期</text>
                <text class="info-row-value">{{ formatDate(record.date) }}</text>
              </view>
              <view class="info-row" v-if="getMatingMethod(record.details)">
                <text class="info-row-label">配种方式</text>
                <text class="info-row-value">{{ getMatingMethod(record.details) }}</text>
              </view>
              <view class="info-row" v-if="getMatingNumber(record.details)">
                <text class="info-row-label">脚次</text>
                <text class="info-row-value">第{{ getMatingNumber(record.details) }}脚</text>
              </view>
              <view class="info-row" v-if="getExpectedCheckDate(record.details)">
                <text class="info-row-label">预计孕检日</text>
                <text class="info-row-value">{{ formatDate(getExpectedCheckDate(record.details)) }}</text>
              </view>
              <view class="info-row" v-if="getExpectedDueDate(record.details)">
                <text class="info-row-label">预计预产期</text>
                <text class="info-row-value">{{ formatDate(getExpectedDueDate(record.details)) }}</text>
              </view>
            </template>

            <!-- 发情观察 -->
            <template v-if="record.type === 'heat_observation'">
              <view class="info-row">
                <text class="info-row-label">种母</text>
                <view class="info-row-value">
                  <view class="mini-avatar">
                    <text class="material-icons-round" style="color: #fff; font-size: 14px;">pets</text>
                  </view>
                  <text>{{ record.dog_name || '未知' }}</text>
                </view>
              </view>
              <view class="info-row">
                <text class="info-row-label">观察时间</text>
                <text class="info-row-value">{{ formatDateTime(record.date) }}</text>
              </view>
              <view class="info-row" v-if="record.details?.vulva_status">
                <text class="info-row-label">外阴状态</text>
                <text class="info-row-value">{{ record.details.vulva_status }}</text>
              </view>
              <view class="info-row" v-if="record.details?.discharge_status">
                <text class="info-row-label">分泌物状态</text>
                <text class="info-row-value">{{ record.details.discharge_status }}</text>
              </view>
              <view class="info-row" v-if="record.details?.symptoms?.length">
                <text class="info-row-label">观察征兆</text>
                <text class="info-row-value">{{ record.details.symptoms.join(' / ') }}</text>
              </view>
            </template>

            <!-- 孕检 -->
            <template v-if="record.type === 'pregnancy_check'">
              <view class="info-row">
                <text class="info-row-label">犬只</text>
                <view class="info-row-value">
                  <view class="mini-avatar">
                    <text class="material-icons-round" style="color: #fff; font-size: 14px;">pets</text>
                  </view>
                  <text>{{ record.dog_name || '未知' }}</text>
                </view>
              </view>
              <view class="info-row">
                <text class="info-row-label">检查日期</text>
                <text class="info-row-value">{{ formatDate(record.date) }}</text>
              </view>
              <view class="info-row" v-if="record.details?.result">
                <text class="info-row-label">结果</text>
                <text class="info-row-value">{{ record.details.result }}</text>
              </view>
              <view class="info-row" v-if="record.details?.fetus_count">
                <text class="info-row-label">胎儿数</text>
                <text class="info-row-value">{{ record.details.fetus_count }}只</text>
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

      <!-- 关联信息 -->
      <view v-if="record.cycle_id || record.created_by_name" class="section-label" style="margin-top: 8px;">
        <view class="section-dot section-dot--blue" />
        <text class="section-text">关联信息</text>
      </view>
      <view v-if="record.cycle_id" class="card-feed">
        <BCard color="blue" :pressable="false">
          <view class="info-rows">
            <view class="info-row">
              <text class="info-row-label">所属周期</text>
              <view class="info-row-value">
                <view class="link-text-row" @click="goToCycle">
                  <text class="link-text">查看繁育周期</text>
                  <text class="material-icons-round" style="font-size: 16px; color: var(--primary);">chevron_right</text>
                </view>
              </view>
            </view>
            <view class="info-row" v-if="record.created_by_name">
              <text class="info-row-label">创建人</text>
              <text class="info-row-value">{{ record.created_by_name }} · {{ formatDateTime(record.created_at) }}</text>
            </view>
          </view>
        </BCard>
      </view>

      <!-- 创建信息（无关联周期时） -->
      <view v-if="!record.cycle_id && record.created_by_name" class="created-info">
        <text>创建人: {{ record.created_by_name }} · {{ formatDateTime(record.created_at) }}</text>
      </view>

      <!-- 操作按钮 -->
      <view class="section-label">
        <view class="section-dot section-dot--red" />
        <text class="section-text">操作</text>
      </view>
      <view class="action-area">
        <view class="btn-row">
          <BButton v-if="canEdit" variant="ghost" @click="goEdit">编辑</BButton>
          <BButton v-if="canDelete" variant="ghost" color="red" @click="confirmDelete">删除</BButton>
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
        <view v-if="canEdit" class="more-action-item" @click="handleEditFromMore">
          <text class="material-icons-round" style="font-size: 20px; color: var(--text-2);">edit</text>
          <text class="more-action-label">编辑记录</text>
        </view>
        <view v-if="canDelete" class="more-action-item" @click="handleDeleteFromMore">
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
  heat: { label: '发情', tagColor: 'amber', cardColor: 'amber' },
  heat_observation: { label: '发情观察', tagColor: 'amber', cardColor: 'amber' },
  mating: { label: '配种', tagColor: 'rose', cardColor: 'rose' },
  pregnancy_check: { label: '孕检', tagColor: 'blue', cardColor: 'blue' },
  birth: { label: '生产', tagColor: 'green', cardColor: 'green' },
}

const typeLabel = computed(() => typeMap[record.value?.type]?.label || record.value?.type || '未知')
const tagColor = computed(() => typeMap[record.value?.type]?.tagColor || 'green')
const cardColor = computed(() => typeMap[record.value?.type]?.cardColor || 'green')
const canEdit = computed(() => record.value?.type !== 'heat_observation')
const canDelete = computed(() => record.value?.type === 'heat_observation')

function getMatingSireName(details: Record<string, any> = {}) {
  return details.sire_name || details.male_name || ''
}

function getMatingMethod(details: Record<string, any> = {}) {
  return details.method || details.mating_method || ''
}

function getMatingNumber(details: Record<string, any> = {}) {
  const value = Number(details.mating_number || details.mating_count)
  return value > 0 ? value : null
}

function getExpectedCheckDate(details: Record<string, any> = {}) {
  return details.expected_checkup_date || details.expected_check_date || null
}

function getExpectedDueDate(details: Record<string, any> = {}) {
  return details.expected_due_date || null
}

const summaryTitle = computed(() => {
  if (record.value?.type === 'heat') return '发情开始'
  if (record.value?.type === 'mating') {
    const sireName = getMatingSireName(record.value?.details)
    return sireName ? `与 ${sireName} 配种` : '配种记录'
  }
  if (record.value?.type === 'heat_observation') return '发情周期观察'
  if (record.value?.type === 'pregnancy_check') return record.value?.details?.result || '孕检记录'
  return typeLabel.value
})
const summaryMeta = computed(() => {
  if (record.value?.type === 'mating') {
    const matingNumber = getMatingNumber(record.value?.details)
    if (matingNumber) return `第${matingNumber}脚`
  }
  if (record.value?.type === 'pregnancy_check' && record.value?.details?.fetus_count) return `${record.value.details.fetus_count}只`
  if (record.value?.type === 'heat_observation') return '观察日志'
  return typeLabel.value
})
const summaryDateText = computed(() => record.value?.type === 'heat_observation' ? formatDateTime(record.value?.date) : formatDate(record.value?.date))

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

const { run: fetchRecord } = useCloudCall('breeding-service', 'getBreedingRecordDetail')
const { run: deleteRecord } = useCloudCall('breeding-service', 'deleteBreedingRecord', {
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

function goEdit() {
  showMore.value = false
  uni.navigateTo({ url: `/pages/record/breeding-edit?id=${recordId}` })
}

function handleEditFromMore() {
  goEdit()
}

function goToCycle() {
  if (record.value?.cycle_id) {
    uni.navigateTo({ url: `/pages/breeding/cycle?id=${record.value.cycle_id}` })
  }
}

function confirmDelete() {
  showMore.value = false
  uni.showModal({
    title: '确认删除',
    content: '删除后不可恢复，确定要删除这条繁育记录吗？',
    confirmColor: '#e05252',
    async success(res) {
      if (res.confirm) {
        const result = await deleteRecord(recordId)
        if (result) {
          queueSubmitFeedback({ message: '已删除繁育记录' })
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
  const feedback = consumeSubmitFeedback('/pages/record/breeding-detail')
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
.detail-summary--amber { background: linear-gradient(135deg, var(--amber-soft), rgba(255, 255, 255, 0.98)); }
.detail-summary--rose { background: linear-gradient(135deg, var(--rose-soft), rgba(255, 255, 255, 0.98)); }
.detail-summary--blue { background: linear-gradient(135deg, var(--blue-soft), rgba(255, 255, 255, 0.98)); }
.detail-summary--green { background: linear-gradient(135deg, var(--green-soft), rgba(255, 255, 255, 0.98)); }
.detail-summary__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.detail-summary__tag {
  width: fit-content;
  padding: 4px 10px;
  border-radius: var(--radius-tag);
  background: rgba(255, 255, 255, 0.76);
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
.detail-summary__meta {
  min-width: 68px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.76);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.detail-summary__meta-value {
  font-size: 14px;
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

/* ==================== SECTION LABEL ==================== */
.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px var(--space-page) 10px;
}
.section-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.section-dot--amber { background: var(--amber); }
.section-dot--rose { background: var(--rose); }
.section-dot--blue { background: var(--blue); }
.section-dot--green { background: var(--green); }
.section-dot--red { background: var(--red); }
.section-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.5px;
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
