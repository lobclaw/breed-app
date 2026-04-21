<template>
  <view class="page">
    <!-- 骨架屏 -->
    <BSkeleton v-if="!cycle && loading" :rows="4" />

    <template v-if="cycle">
      <!-- 顶栏 -->
      <BPageHeader :title="pageTitle">
        <template #right>
          <BTag :label="cycle.status" :color="statusColor(cycle.status)" />
        </template>
      </BPageHeader>
      <BSubmitBanner :message="submitBannerMessage" />

      <!-- 周期信息卡片 -->
      <view class="card-feed">
        <BCard color="rose" :pressable="false">
          <view class="dam-row">
            <view class="dam-avatar">
              <text class="material-icons-round" style="font-size: 17px; color: #fff;">pets</text>
            </view>
            <view class="dam-info">
              <text class="dam-name">{{ cycle.dam_name }}</text>
              <text class="dam-breed">马尔济斯 · 种母</text>
            </view>
          </view>
          <view class="info-rows">
            <view class="info-row">
              <text class="info-label">种公</text>
              <text class="info-value">{{ cycle.sire_name || '未知' }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">开始日期</text>
              <text class="info-value">{{ formatDate(cycle.start_date || cycle.created_at) }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">当前状态</text>
              <text class="info-value info-value--highlight" :style="{ color: `var(--${statusColor(cycle.status)})` }">
                {{ currentStatusText }}
              </text>
            </view>
            <view v-if="expectedDueDateText" class="info-row">
              <text class="info-label">预产期</text>
              <text class="info-value">{{ expectedDueDateText }}</text>
            </view>
          </view>
        </BCard>

        <!-- 时间线 -->
        <BSectionLabel title="繁育时间线" color="teal" />

        <view class="timeline">
          <view
            v-for="(record, idx) in timelineRecords"
            :key="record._id"
            class="timeline-item"
            :class="{ 'timeline-item--future': record._is_future }"
            @click="onRecordTap(record)"
          >
            <view class="timeline-track">
              <view
                class="timeline-dot"
                :class="record._is_future ? 'timeline-dot--hollow' : 'timeline-dot--filled'"
                :style="{ color: `var(--${timelineDotColor(record)})` }"
              />
              <view v-if="idx < timelineRecords.length - 1" class="timeline-line" />
            </view>
            <view class="timeline-content">
              <view class="timeline-card" :class="{ 'timeline-card--future': record._is_future }">
                <view class="timeline-head">
                  <text class="timeline-date" :class="{ 'timeline-date--future': record._is_future }">{{ formatShortDate(record.date) }}</text>
                  <text v-if="idx === 0" class="timeline-badge">最新</text>
                </view>
                <view class="timeline-main">
                  <view class="timeline-copy">
                    <text class="timeline-desc" :class="{ 'timeline-desc--future': record._is_future }">
                      {{ typeLabel(record.type) }}
                    </text>
                    <text
                      v-for="(detail, detailIdx) in timelineDetailLines(record)"
                      :key="`${record._id}-detail-${detailIdx}`"
                      class="timeline-detail"
                      :class="{ 'timeline-detail--future': record._is_future }"
                    >
                      {{ detail }}
                    </text>
                  </view>
                  <view class="timeline-chevron" :class="{ 'timeline-chevron--future': record._is_future }">
                    <text class="material-icons-round" style="font-size: 16px; color: var(--text-4);">chevron_right</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 空状态 -->
        <BEmpty
          v-if="timelineRecords.length === 0"
          icon="timeline"
          title="暂无记录"
          description="点击下方按钮添加繁育记录"
        />

        <!-- 费用 -->
        <template v-if="totalCost > 0">
          <BSectionLabel title="周期费用" color="amber" />
          <BCard color="amber" :pressable="false">
            <view v-for="item in costItems" :key="item.id" class="cost-row">
              <text class="cost-label">{{ item.label }}</text>
              <text class="cost-value">¥{{ item.amount.toLocaleString() }}</text>
            </view>
            <view class="cost-divider" />
            <view class="cost-row" style="padding-top: 6px;">
              <text class="cost-label" style="font-weight: 700;">合计</text>
              <text class="cost-total">¥{{ totalCost.toLocaleString() }}</text>
            </view>
          </BCard>
        </template>

        <!-- 窝信息 -->
        <template v-if="litter">
          <BSectionLabel title="窝信息" color="green" />
          <BCard color="green" @click="goToLitter(litter._id)">
            <view class="info-rows">
              <view class="info-row">
                <text class="info-label">生产日期</text>
                <text class="info-value">{{ formatDate(litter.birth_date) }}</text>
              </view>
              <view class="info-row">
                <text class="info-label">生产方式</text>
                <text class="info-value">{{ litter.birth_type }}</text>
              </view>
              <view class="info-row">
                <text class="info-label">存活</text>
                <text class="info-value">{{ litter.born_alive }}/{{ litter.total_born }}</text>
              </view>
              <view class="info-row">
                <text class="info-label">断奶</text>
                <text class="info-value" :style="{ color: litter.weaned_at ? 'var(--green)' : 'var(--amber)' }">
                  {{ litter.weaned_at ? '已断奶' : '未断奶' }}
                </text>
              </view>
            </view>
          </BCard>
        </template>

        <!-- 操作按钮 -->
        <view v-if="!isTerminal" class="action-col">
          <BButton color="primary" size="large" @click="addRecord" style="width: 100%;">
            <text class="material-icons-round" style="font-size: 16px; margin-right: 6px;">add_circle</text>
            添加记录
          </BButton>
          <BButton v-if="cycle.status === '怀孕中'" color="green" size="large" @click="addBirth" style="width: 100%;">
            <text class="material-icons-round" style="font-size: 16px; margin-right: 6px;">child_care</text>
            录入生产
          </BButton>
          <BButton variant="ghost" size="large" @click="closeCycleAction" style="width: 100%; color: var(--red);">
            <text class="material-icons-round" style="font-size: 16px; margin-right: 6px;">warning</text>
            记录异常终止
          </BButton>
        </view>
      </view>

      <BAddRecordSheet
        v-model:visible="showAddRecordSheet"
        :context-title="cycle.dam_name || '当前种母'"
        :context-status="cycle.status || ''"
        context-sub="将自动带入当前周期"
        :groups="cycleAddRecordGroups"
        @select="navigateToRecord"
      />
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import type { BreedingCycleDetailResponse, BreedingCycleExpense } from '@/types/breeding'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BCard from '@/components/base/BCard.vue'
import BTag from '@/components/base/BTag.vue'
import BButton from '@/components/base/BButton.vue'
import BSectionLabel from '@/components/base/BSectionLabel.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import BAddRecordSheet from '@/components/record/BAddRecordSheet.vue'
import { consumeSubmitFeedback } from '@/composables/useSubmitFeedback'
import type { AddRecordItem } from '@/utils/addRecordSheet'
import { createCycleBreedingAddRecordGroups } from '@/utils/addRecordSheet'

const cycle = ref<any>(null)
const records = ref<any[]>([])
const litter = ref<any>(null)
const expenses = ref<BreedingCycleExpense[]>([])
const loading = ref(true)
const showAddRecordSheet = ref(false)
let cycleId = ''
const submitBannerMessage = ref('')
let submitBannerTimer: ReturnType<typeof setTimeout> | null = null
let hasLoadedOnce = false

const { run: fetchDetail } = useCloudCall<{ data: BreedingCycleDetailResponse }>('breeding-service', 'getCycleDetail')
const { run: doClose } = useCloudCall('breeding-service', 'closeCycle', { successMessage: '已关闭' })

const pageTitle = computed(() => {
  if (!cycle.value?.dam_name) return '繁育周期'
  const cycleNumber = Number(cycle.value?.cycle_number)
  return cycleNumber > 0 ? `${cycle.value.dam_name} · 第${cycleNumber}次繁育` : `${cycle.value.dam_name} · 繁育周期`
})

const isTerminal = computed(() => {
  return cycle.value && ['已生产', '失败', '放弃'].includes(cycle.value.status)
})

const cycleAddRecordGroups = computed(() => createCycleBreedingAddRecordGroups(cycle.value?.status))

const timelineRecords = computed(() => {
  return [...records.value].sort((a, b) => {
    const dateDiff = (b?.date || 0) - (a?.date || 0)
    if (dateDiff !== 0) return dateDiff
    const updatedDiff = (b?.updated_at || b?.created_at || 0) - (a?.updated_at || a?.created_at || 0)
    if (updatedDiff !== 0) return updatedDiff
    return `${b?._id || ''}`.localeCompare(`${a?._id || ''}`)
  })
})

const latestMatingRecord = computed(() => {
  return records.value
    .filter(record => record.type === 'mating')
    .sort((a, b) => {
      const dateDiff = (b?.date || 0) - (a?.date || 0)
      if (dateDiff !== 0) return dateDiff
      return (b?.updated_at || b?.created_at || 0) - (a?.updated_at || a?.created_at || 0)
    })[0] || null
})

const pregnancyDayCount = computed(() => {
  if (cycle.value?.status !== '怀孕中') return null
  const startTs = cycle.value?.mated_at || latestMatingRecord.value?.date
  if (typeof startTs !== 'number') return null
  return Math.max(1, Math.floor((startOfDay(Date.now()) - startOfDay(startTs)) / 86400000) + 1)
})

const expectedDueDate = computed(() => {
  if (cycle.value?.status !== '怀孕中') return null
  const dueTs = latestMatingRecord.value?.details?.expected_due_date
  if (typeof dueTs === 'number') return dueTs
  const startTs = cycle.value?.mated_at || latestMatingRecord.value?.date
  if (typeof startTs !== 'number') return null
  return startTs + 59 * 86400000
})

const expectedDueDateText = computed(() => {
  return typeof expectedDueDate.value === 'number' ? formatDate(expectedDueDate.value) : ''
})

const currentStatusText = computed(() => {
  if (!cycle.value?.status) return '-'
  if (cycle.value.status === '怀孕中' && pregnancyDayCount.value) {
    return `${cycle.value.status} · 第${pregnancyDayCount.value}天`
  }

  if (cycle.value.status === '发情中') {
    const startTs = cycle.value?.start_date || cycle.value?.created_at
    if (typeof startTs === 'number') {
      const day = Math.max(1, Math.floor((startOfDay(Date.now()) - startOfDay(startTs)) / 86400000) + 1)
      return `${cycle.value.status} · 第${day}天`
    }
  }

  if (cycle.value.day_count) {
    return `${cycle.value.status} · 第${cycle.value.day_count}天`
  }

  return cycle.value.status
})

const costItems = computed(() => {
  if (!expenses.value.length) return []
  return expenses.value
    .filter(item => Number(item.total_amount) > 0)
    .map(item => ({
      id: item._id,
      label: item.notes || item.category || '支出',
      amount: Number(item.total_amount) || 0,
    }))
})

const totalCost = computed(() => costItems.value.reduce((s, i) => s + i.amount, 0))

const TYPE_LABELS: Record<string, string> = {
  heat: '发情', heat_observation: '发情观察', follicle_check: '卵泡检查', mating: '配种',
  pregnancy_check: '孕检', prenatal_check: '产检',
  pre_labor: '临产监测', birth: '生产', abnormal_termination: '异常终止',
}

const DOT_COLORS: Record<string, string> = {
  heat: 'amber', heat_observation: 'amber', follicle_check: 'teal', mating: 'rose',
  pregnancy_check: 'green', prenatal_check: 'blue',
  pre_labor: 'amber', birth: 'green', abnormal_termination: 'red',
}

function typeLabel(type: string) { return TYPE_LABELS[type] || type }
function dotColor(type: string) { return DOT_COLORS[type] || 'primary' }
function timelineDotColor(record: any) { return record?._is_future ? 'text-4' : dotColor(record?.type) }

function statusColor(status: string) {
  const map: Record<string, string> = {
    '发情中': 'amber', '怀孕中': 'rose', '已生产': 'green', '失败': 'red', '放弃': 'red',
  }
  return (map[status] || 'rose') as any
}

function startOfDay(ts: number) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function formatDate(ts: number) {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatShortDate(ts: number) {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function timelineDetailLines(record: any) {
  const lines: string[] = []

  if (record.type === 'mating' && record.details) {
    const parts = [
      record.details.method || '自然交配',
      record.details.sire_name || '未知',
      record.details.mating_number ? `第${record.details.mating_number}脚` : '',
    ].filter(Boolean)
    if (parts.length > 0) lines.push(parts.join(' · '))
  }

  if (record.type === 'heat_observation' && record.details) {
    const parts = [
      record.details.vulva_status || '外阴状态待补充',
      record.details.discharge_status || '',
      Array.isArray(record.details.symptoms) && record.details.symptoms.length > 0 ? record.details.symptoms.join(' / ') : '',
    ].filter(Boolean)
    if (parts.length > 0) lines.push(parts.join(' · '))
  }

  if (record.type === 'follicle_check' && record.details) {
    const left = record.details.left_count
    const right = record.details.right_count
    const counts = `左${left ?? '?'}右${right ?? '?'}`
    lines.push(`${counts} · 发育良好`)
  }

  if (record.type === 'pregnancy_check' && record.details) {
    const result = record.details.result || (record.details.confirmed ? '确认怀孕' : '')
    const count = record.details.count || record.details.fetus_count
    const parts = [result]
    if (count) parts.push(`${count}只`)
    if (parts.filter(Boolean).length > 0) lines.push(parts.filter(Boolean).join(' · '))
  }

  if (record.notes) {
    lines.push(record.notes)
  }

  return lines
}

function showSubmitBanner(message: string) {
  submitBannerMessage.value = message
  if (submitBannerTimer) clearTimeout(submitBannerTimer)
  submitBannerTimer = setTimeout(() => {
    submitBannerMessage.value = ''
  }, 2200)
}

function goToLitter(id: string) {
  uni.navigateTo({ url: `/pages/breeding/litter?id=${id}` })
}

function onRecordTap(record: any) {
  uni.navigateTo({ url: `/pages/record/breeding-detail?id=${record._id}` })
}

function addRecord() {
  showAddRecordSheet.value = true
}

function navigateToRecord(item: AddRecordItem) {
  showAddRecordSheet.value = false
  const baseUrl = item.url || `/pages/record/${item.page}`
  uni.navigateTo({
    url: `${baseUrl}?cycleId=${cycleId}&dogId=${cycle.value.dam_id}&dogName=${encodeURIComponent(cycle.value.dam_name)}&locked=true`,
    fail() {
      uni.showToast({ title: '页面打开失败', icon: 'none' })
    },
  })
}

function addBirth() {
  uni.navigateTo({ url: `/pages/breeding/birth-wizard?cycleId=${cycleId}&damName=${encodeURIComponent(cycle.value.dam_name)}` })
}

async function closeCycleAction() {
  uni.showActionSheet({
    itemList: ['放弃（未配种）', '失败（确认未怀孕/流产）'],
    success: async (res) => {
      const reason = res.tapIndex === 0 ? '放弃' : '失败'
      await doClose(cycleId, reason)
      loadData()
    },
  })
}

async function loadData() {
  loading.value = true
  const res = await fetchDetail(cycleId)
  if (res?.data) {
    cycle.value = res.data.cycle
    records.value = res.data.records
    litter.value = res.data.litter
    expenses.value = res.data.expenses || []
  }
  loading.value = false
  hasLoadedOnce = true
}

onLoad((query) => {
  cycleId = query?.id || ''
  if (cycleId) loadData()
})

onShow(() => {
  const feedback = consumeSubmitFeedback('/pages/breeding/cycle')
  if (feedback?.message) {
    showSubmitBanner(feedback.message)
  }
  if (cycleId && hasLoadedOnce) loadData()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

.card-feed {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);
}

/* 母犬信息行 */
.dam-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.dam-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ea3e77, #e89b3e);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dam-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  display: block;
}

.dam-breed {
  font-size: 11px;
  color: var(--text-2);
  display: block;
}

/* 信息行 */
.info-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.info-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.info-value--highlight {
  font-weight: 700;
}

/* 时间线 */
.timeline {
  position: relative;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  position: relative;
  transition: background 0.12s ease;

  &:active {
    transform: scale(0.992);
  }
}

.timeline-track {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  flex-shrink: 0;
  width: 16px;
  position: relative;
  align-self: stretch;
  padding-top: 30px;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  z-index: 2;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.9);

  &--filled {
    background: currentColor;
  }

  &--hollow {
    background: var(--bg);
    border: 2px solid currentColor;
  }
}

.timeline-line {
  width: 2px;
  flex: 1;
  background: rgba(216, 203, 189, 0.42);
  border-radius: 999px;
  margin-top: 5px;
}

.timeline-content {
  flex: 1;
  min-width: 0;
}

.timeline-card {
  position: relative;
  background: var(--card);
  border-radius: 18px;
  box-shadow: 0 2px 10px rgba(234, 62, 119, 0.045);
  padding: 12px 48px 12px 14px;
  border: 1px solid rgba(216, 203, 189, 0.18);
}

.timeline-card--future {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(252, 247, 243, 0.98));
  border-color: rgba(216, 203, 189, 0.24);
}

.timeline-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 7px;
}

.timeline-date {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--card-dim);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  font-family: var(--font-display);
}

.timeline-date--future {
  background: rgba(216, 203, 189, 0.16);
  color: var(--text-3);
}

.timeline-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(61, 168, 160, 0.1);
  color: var(--teal);
  font-size: 10px;
  font-weight: 700;
}

.timeline-main {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.timeline-copy {
  flex: 1;
  min-width: 0;
}

.timeline-desc {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.4;
  display: block;
}

.timeline-desc--future {
  color: var(--text-2);
}

.timeline-detail {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 4px;
  display: block;
  line-height: 1.5;
}

.timeline-detail--future {
  color: var(--text-4);
}

.timeline-chevron {
  position: absolute;
  top: 50%;
  right: 14px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 240, 232, 0.8);
}

.timeline-chevron--future {
  background: rgba(248, 240, 232, 0.9);
}

/* 费用 */
.cost-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
}

.cost-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
}

.cost-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  font-family: var(--font-display);
}

.cost-divider {
  height: 1px;
  background: var(--text-4);
  opacity: 0.4;
  margin: 4px 0;
}

.cost-total {
  font-size: 15px;
  font-weight: 800;
  color: var(--primary);
  font-family: var(--font-display);
}

/* 操作按钮 */
.action-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 2px;
}
</style>
