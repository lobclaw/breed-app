<template>
  <view class="page">
    <!-- 骨架屏 -->
    <template v-if="!cycle && loading">
      <BPageHeader :title="pageTitle">
        <template #right>
          <view class="primary-page-header__actions">
            <view class="cycle-skeleton-action cycle-skeleton-action--primary" />
            <view class="cycle-skeleton-action" />
          </view>
        </template>
      </BPageHeader>

      <view class="card-feed cycle-skeleton-feed">
        <view class="cycle-skeleton-card cycle-skeleton-card--summary">
          <view class="dam-row">
            <view class="cycle-skeleton cycle-skeleton--avatar" />
            <view class="dam-info">
              <view class="dam-title-row">
                <view class="cycle-skeleton cycle-skeleton--title" />
                <view class="cycle-skeleton cycle-skeleton--pill" />
              </view>
              <view class="cycle-skeleton cycle-skeleton--sub" />
            </view>
          </view>
          <view class="info-rows">
            <view v-for="row in 4" :key="`cycle-summary-${row}`" class="info-row">
              <view class="cycle-skeleton cycle-skeleton--label" :class="{ 'cycle-skeleton--label-short': row > 3 }" />
              <view class="cycle-skeleton cycle-skeleton--value" :class="{ 'cycle-skeleton--value-strong': row === 4 }" />
            </view>
          </view>
        </view>

        <view class="cycle-skeleton-section">
          <view class="cycle-skeleton-section__dot cycle-skeleton-section__dot--amber" />
          <view class="cycle-skeleton cycle-skeleton--section-label" />
        </view>
        <view class="cycle-skeleton-card cycle-skeleton-card--cost">
          <view class="cost-row">
            <view class="cycle-skeleton cycle-skeleton--cost-label" />
            <view class="cycle-skeleton cycle-skeleton--cost-value" />
          </view>
          <view class="cost-divider" />
          <view class="cost-row" style="padding-top: 6px;">
            <view class="cycle-skeleton cycle-skeleton--cost-label cycle-skeleton--cost-label-strong" />
            <view class="cycle-skeleton cycle-skeleton--cost-total" />
          </view>
        </view>

        <view class="cycle-skeleton-section">
          <view class="cycle-skeleton-section__dot cycle-skeleton-section__dot--teal" />
          <view class="cycle-skeleton cycle-skeleton--section-label cycle-skeleton--section-label-wide" />
        </view>
        <view class="cycle-skeleton-timeline">
          <view
            v-for="item in 3"
            :key="`cycle-timeline-${item}`"
            class="cycle-skeleton-timeline-item"
          >
            <view class="cycle-skeleton-timeline-track">
              <view
                class="cycle-skeleton-timeline-dot"
                :class="{
                  'cycle-skeleton-timeline-dot--current': item === 1,
                  'cycle-skeleton-timeline-dot--rose': item === 2,
                  'cycle-skeleton-timeline-dot--teal': item === 3,
                }"
              />
              <view v-if="item < 3" class="cycle-skeleton-timeline-line" />
            </view>
            <view class="cycle-skeleton-card cycle-skeleton-card--timeline">
              <view class="timeline-head">
                <view class="cycle-skeleton cycle-skeleton--timeline-date" />
              </view>
              <view class="cycle-skeleton-timeline-main">
                <view class="cycle-skeleton-timeline-copy">
                  <view class="cycle-skeleton cycle-skeleton--timeline-title" />
                  <view class="cycle-skeleton cycle-skeleton--timeline-detail" />
                  <view v-if="item === 1" class="cycle-skeleton cycle-skeleton--timeline-detail cycle-skeleton--timeline-detail-short" />
                </view>
                <view v-if="item > 1" class="cycle-skeleton cycle-skeleton--timeline-chevron" />
              </view>
            </view>
          </view>
        </view>
      </view>
    </template>

    <template v-if="cycle">
      <!-- 顶栏 -->
      <BPageHeader :title="pageTitle">
        <template #right>
          <view v-if="hasHeaderActions" class="primary-page-header__actions">
            <view v-if="canAddRecord" class="primary-page-header__action primary-page-header__action--primary" @click="addRecord">
              <text class="primary-page-header__icon primary-page-header__icon--primary">add</text>
            </view>
            <view v-if="hasMoreActions" class="primary-page-header__action" @click="showMoreActions = true">
              <text class="primary-page-header__icon">more_horiz</text>
            </view>
          </view>
        </template>
      </BPageHeader>
      <BSubmitBanner :message="submitBannerMessage" />

      <!-- 周期信息卡片 -->
      <view class="card-feed">
        <BCard color="rose" :pressable="false">
          <view class="dam-row">
            <view class="dam-avatar">
              <BEntityIcon :size="17" color="#fff" />
            </view>
            <view class="dam-info">
              <view class="dam-title-row">
                <text class="dam-name">{{ cycle.dam_name }}</text>
                <BTag :label="currentStatusText" :color="currentStatusTagColor" />
              </view>
              <text class="dam-breed">马尔济斯 · 种母</text>
            </view>
          </view>
          <view class="info-rows">
            <view class="info-row">
              <text class="info-label">种公</text>
              <text class="info-value">{{ resolvedSireName || '未知' }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">发情日期</text>
              <text class="info-value">{{ formatDate(cycle.start_date || cycle.created_at) }}</text>
            </view>
            <view v-if="firstMatingDateText" class="info-row">
              <text class="info-label">首配日期</text>
              <text class="info-value">{{ firstMatingDateText }}</text>
            </view>
            <view v-if="expectedDueDateText" class="info-row">
              <text class="info-label">预产期</text>
              <view class="info-value info-value--due">
                <text class="info-value__date">{{ expectedDueDateText }}</text>
                <text class="info-value__separator">·</text>
                <text class="info-value__relative">{{ expectedDueDateRelativeText }}</text>
              </view>
            </view>
          </view>
        </BCard>

        <!-- 窝信息 -->
        <template v-if="litter">
          <view class="litter-section-head">
            <BSectionLabel title="窝信息" color="green" />
            <view class="litter-section-head__action" @click="goToLitter(litter._id)">
              <text class="litter-section-head__action-text">查看详情</text>
              <text class="material-icons-round litter-section-head__action-icon">chevron_right</text>
            </view>
          </view>
          <BCard class="litter-link-card" color="green" @click="goToLitter(litter._id)">
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
          <BSectionLabel v-if="expenseDetailItems.length" title="费用明细" color="green" />
          <BCard v-if="expenseDetailItems.length" color="green" :pressable="false">
            <view v-for="item in expenseDetailItems" :key="item.id" class="cost-row">
              <view class="cost-detail-main">
                <text class="cost-label">{{ item.label }}</text>
                <text class="cost-detail-date">{{ item.subtitle ? `${item.subtitle} · ${item.dateText}` : item.dateText }}</text>
              </view>
              <text class="cost-value">¥{{ item.amount.toLocaleString() }}</text>
            </view>
          </BCard>
        </template>

        <!-- 时间线 -->
        <BSectionLabel title="繁育时间线" color="teal" />

        <view class="timeline">
          <view
            v-for="(item, idx) in timelineItems"
            :key="item.key"
            class="timeline-item"
            :class="[
              `timeline-item--${item.kind}`,
              item.isFuture ? 'timeline-item--future' : '',
              item.clickable ? 'timeline-item--clickable' : '',
            ]"
            @click="onTimelineItemTap(item)"
          >
            <view class="timeline-track">
              <view
                class="timeline-dot"
                :class="[
                  item.kind === 'upcoming' ? 'timeline-dot--hollow' : 'timeline-dot--filled',
                  `timeline-dot--${item.tone}`,
                  item.isActive ? 'timeline-dot--current' : '',
                ]"
              />
              <view
                v-if="idx < timelineItems.length - 1"
                class="timeline-line"
                :class="item.kind === 'upcoming' ? 'timeline-line--future' : ''"
              />
            </view>
            <view class="timeline-content">
              <view
                class="timeline-card"
                :class="[
                  item.isFuture ? 'timeline-card--future' : '',
                  item.kind === 'current' ? 'timeline-card--current' : '',
                ]"
              >
                <view class="timeline-head">
                  <text class="timeline-date" :class="item.isFuture ? 'timeline-date--future' : ''">{{ item.dateLabel }}</text>
                  <text v-if="item.badgeLabel" class="timeline-badge">{{ item.badgeLabel }}</text>
                </view>
                <view class="timeline-main">
                  <view class="timeline-copy">
                    <text
                      class="timeline-desc"
                      :class="[
                        item.isFuture ? 'timeline-desc--future' : '',
                        item.kind === 'current' ? `timeline-desc--${item.tone}` : '',
                      ]"
                    >
                      {{ item.title }}
                    </text>
                    <text
                      v-for="(detail, detailIdx) in item.detailLines"
                      :key="`${item.key}-detail-${detailIdx}`"
                      class="timeline-detail"
                      :class="item.isFuture ? 'timeline-detail--future' : ''"
                    >
                      {{ detail }}
                    </text>
                  </view>
                  <view v-if="item.clickable" class="timeline-chevron" :class="item.isFuture ? 'timeline-chevron--future' : ''">
                    <text class="material-icons-round" style="font-size: 16px; color: var(--text-4);">chevron_right</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 空状态 -->
        <BEmpty
          v-if="timelineItems.length === 0"
          icon="timeline"
          title="暂无记录"
          description="点击右上角按钮添加繁育记录"
        />
      </view>

      <BAddRecordSheet
        v-model:visible="showAddRecordSheet"
        :context-title="cycle.dam_name || '当前种母'"
        :context-status="cycle.status || ''"
        context-sub="将自动带入当前周期"
        :groups="cycleAddRecordGroups"
        @select="navigateToRecord"
      />

      <BSheet v-model:visible="showMoreActions" title="更多操作">
        <view class="more-actions">
          <view v-if="canAbandonCycle" class="more-action-item" @click="handleAbandonCycleFromMore">
            <text class="material-icons-round" style="font-size: 20px; color: var(--amber);">block</text>
            <text class="more-action-label">放弃本次繁育</text>
          </view>
        </view>
      </BSheet>

      <BSheet v-model:visible="showCloseCycleSheet" title="放弃本次繁育" height="auto">
        <view class="close-cycle-sheet">
          <view class="close-cycle-sheet__notice">
            <text class="material-icons-round close-cycle-sheet__notice-icon">info</text>
            <text class="close-cycle-sheet__notice-text">确认后会直接将本次繁育标记为放弃，并取消相关未完成提醒。</text>
          </view>
          <view class="close-cycle-sheet__options">
            <view
              class="close-cycle-sheet__option"
              :class="{ 'close-cycle-sheet__option--disabled': closeCycleSubmitting }"
              @click="closeCycleAsAbandoned"
            >
              <view class="close-cycle-sheet__option-icon close-cycle-sheet__option-icon--amber">
                <text class="material-icons-round">block</text>
              </view>
              <view class="close-cycle-sheet__option-copy">
                <text class="close-cycle-sheet__option-title">确认放弃本次繁育</text>
                <text class="close-cycle-sheet__option-desc">不创建繁育记录，仅关闭当前繁育。</text>
              </view>
              <text class="material-icons-round close-cycle-sheet__option-arrow">chevron_right</text>
            </view>
          </view>
        </view>
      </BSheet>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import { buildExpenseDisplayInfo, getLocalBreedingCycleDetail } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import type { BreedingCycleDetailResponse, BreedingCycleExpense } from '@/types/breeding'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BTag from '@/components/base/BTag.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BCard from '@/components/base/BCard.vue'
import BSectionLabel from '@/components/base/BSectionLabel.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import BAddRecordSheet from '@/components/record/BAddRecordSheet.vue'
import BSheet from '@/components/layout/BSheet.vue'
import { consumeSubmitFeedback } from '@/composables/useSubmitFeedback'
import type { AddRecordItem } from '@/utils/addRecordSheet'
import { createCycleBreedingAddRecordGroups } from '@/utils/addRecordSheet'
import {
  buildBreedingTimelineCurrentTitle,
  getBreedingTimelineExpectedDueDate,
  formatRelativeDayLabel,
  buildBreedingTimelineSyntheticItems,
  getBreedingTimelineCurrentStatusTone,
  getBreedingTimelineRecordTone,
  type BreedingTimelineKind,
  type BreedingTimelineTone,
} from '@/utils/breedingTimeline'
import { normalizeExpenseCategoryName } from '@/constants/financeCategories'

const cycle = ref<any>(null)
const records = ref<any[]>([])
const litter = ref<any>(null)
const expenses = ref<BreedingCycleExpense[]>([])
const loading = ref(true)
const showAddRecordSheet = ref(false)
const showMoreActions = ref(false)
const showCloseCycleSheet = ref(false)
const closeCycleSubmitting = ref(false)
let cycleId = ''
const submitBannerMessage = ref('')
let submitBannerTimer: ReturnType<typeof setTimeout> | null = null
let hasLoadedOnce = false
const MORE_ACTION_CLOSE_DELAY_MS = 180
const { currentFamily } = useAuth()
usePageSync({ routePath: 'pages/breeding/cycle' })

const pageTitle = computed(() => {
  if (!cycle.value?.dam_name) return '繁育周期'
  const cycleNumber = Number(cycle.value?.cycle_number)
  return cycleNumber > 0 ? `${cycle.value.dam_name} · 第${cycleNumber}次繁育` : `${cycle.value.dam_name} · 繁育周期`
})

const isTerminal = computed(() => {
  return cycle.value && ['已生产', '失败', '放弃'].includes(cycle.value.status)
})

const cycleAddRecordGroups = computed(() => createCycleBreedingAddRecordGroups(cycle.value?.status, { records: records.value }))
const canAddRecord = computed(() => !loading.value && !!cycle.value && !isTerminal.value)
const canAbandonCycle = computed(() => canAddRecord.value)
const hasMoreActions = computed(() => canAbandonCycle.value)
const hasHeaderActions = computed(() => canAddRecord.value || hasMoreActions.value)

const timelineRecords = computed(() => {
  return [...records.value].sort((a, b) => {
    const dateDiff = (b?.date || 0) - (a?.date || 0)
    if (dateDiff !== 0) return dateDiff
    const updatedDiff = (b?.updated_at || b?.created_at || 0) - (a?.updated_at || a?.created_at || 0)
    if (updatedDiff !== 0) return updatedDiff
    return `${b?._id || ''}`.localeCompare(`${a?._id || ''}`)
  })
})

type CycleTimelineItem = {
  key: string
  kind: BreedingTimelineKind
  type: string
  tone: BreedingTimelineTone
  title: string
  detailLines: string[]
  dateLabel: string
  badgeLabel: string
  isFuture: boolean
  isActive: boolean
  clickable: boolean
  recordId?: string
}

const expectedDueDate = computed(() => {
  if (cycle.value?.status !== '怀孕中') return null
  return getBreedingTimelineExpectedDueDate(cycle.value, timelineRecords.value)
})

const expectedDueDateText = computed(() => {
  return typeof expectedDueDate.value === 'number' ? formatDate(expectedDueDate.value) : ''
})
const expectedDueDateRelativeText = computed(() => {
  return typeof expectedDueDate.value === 'number' ? formatRelativeDayLabel(expectedDueDate.value) : ''
})

const currentStatusText = computed(() => {
  if (!cycle.value?.status) return '-'
  if (cycle.value.status === '已生产' && typeof litter.value?.weaned_at === 'number') return '已完成'
  if (cycle.value.status === '失败' || cycle.value.status === '放弃') return '已终止'
  return buildBreedingTimelineCurrentTitle(cycle.value, timelineRecords.value, Date.now(), { litter: litter.value }) || cycle.value.status
})
const currentStatusTone = computed(() => {
  if (!cycle.value?.status) return 'rose'
  return getBreedingTimelineCurrentStatusTone(cycle.value, { litter: litter.value })
})
const currentStatusTagColor = computed<'primary' | 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal'>(() => {
  return currentStatusTone.value === 'gray' ? 'plum' : currentStatusTone.value
})
const firstMatingDate = computed(() => {
  const matingDates = records.value
    .filter(record => record?.type === 'mating' && Number(record?.date) > 0)
    .map(record => Number(record.date))
    .sort((a, b) => a - b)
  return matingDates[0] || null
})
const firstMatingDateText = computed(() => {
  return typeof firstMatingDate.value === 'number' ? formatDate(firstMatingDate.value) : ''
})
const resolvedSireName = computed(() => {
  const cycleSireName = String(cycle.value?.sire_name || '').trim()
  if (cycleSireName) return cycleSireName

  const latestMatingRecord = timelineRecords.value.find(record => record?.type === 'mating')
  const matingDetails = latestMatingRecord?.details || {}
  return String(matingDetails.sire_name || matingDetails.male_name || '').trim()
})

const costItems = computed(() => {
  if (!expenses.value.length) return []
  const costByCategory = new Map<string, number>()
  expenses.value
    .filter(item => Number(item.total_amount) > 0)
    .forEach((item) => {
      const label = item.category ? normalizeExpenseCategoryName(item.category) : '支出'
      costByCategory.set(label, (costByCategory.get(label) || 0) + Number(item.total_amount || 0))
    })
  return Array.from(costByCategory.entries()).map(([label, amount]) => ({
    id: label,
    label,
    amount,
  }))
})

const expenseDetailItems = computed(() => {
  const sourceRecordMap = new Map(records.value.map(record => [record._id, record]))
  return expenses.value
    .filter(item => Number(item.total_amount) > 0)
    .map((item) => {
      const display = buildExpenseDisplayInfo(item, sourceRecordMap, '周期费用')
      return {
        id: item._id,
        label: display.title,
        subtitle: display.subtitle,
        dateText: formatShortDate(item.date),
        amount: Number(item.total_amount || 0),
      }
    })
})

const totalCost = computed(() => costItems.value.reduce((s, i) => s + i.amount, 0))

const TYPE_LABELS: Record<string, string> = {
  heat: '发情', heat_observation: '发情观察', follicle_check: '卵泡检查', mating: '配种',
  pregnancy_check: '孕检', prenatal_check: '产检',
  pre_labor: '临产监测', birth: '生产', abnormal_termination: '异常终止',
}

function typeLabel(type: string) { return TYPE_LABELS[type] || type }

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

const timelineItems = computed<CycleTimelineItem[]>(() => {
  const syntheticItems = buildBreedingTimelineSyntheticItems(cycle.value, timelineRecords.value, Date.now(), { litter: litter.value }).map(item => ({
    key: `synthetic-${item.key}`,
    kind: item.kind,
    type: item.type,
    tone: item.tone,
    title: item.title,
    detailLines: item.summary ? [item.summary] : [],
    dateLabel: item.label,
    badgeLabel: '',
    isFuture: item.kind === 'upcoming',
    isActive: item.kind === 'current' && item.label === '当前',
    clickable: false,
  }))

  const recordItems = timelineRecords.value.map((record: any) => ({
    key: record._id,
    kind: 'record' as const,
    type: record.type,
    tone: record._is_future ? 'gray' as const : getBreedingTimelineRecordTone(record.type),
    title: typeLabel(record.type),
    detailLines: timelineDetailLines(record),
    dateLabel: formatShortDate(record.date),
    badgeLabel: '',
    isFuture: !!record._is_future,
    isActive: false,
    clickable: true,
    recordId: record._id,
  }))

  return [...syntheticItems, ...recordItems]
})

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

function onTimelineItemTap(item: CycleTimelineItem) {
  if (!item.clickable || !item.recordId) return
  uni.navigateTo({ url: `/pages/record/breeding-detail?id=${item.recordId}` })
}

function addRecord() {
  showMoreActions.value = false
  showAddRecordSheet.value = true
}

function runAfterMoreSheetClose(task: () => void) {
  showMoreActions.value = false
  setTimeout(task, MORE_ACTION_CLOSE_DELAY_MS)
}

function navigateToRecord(item: AddRecordItem) {
  showAddRecordSheet.value = false
  const damName = encodeURIComponent(cycle.value?.dam_name || '')
  const dogId = cycle.value?.dam_id || ''

  if (item.page === 'birth-wizard') {
    uni.navigateTo({
      url: `/pages/breeding/birth-wizard?cycleId=${cycleId}&damName=${damName}&dogId=${dogId}&dogName=${damName}&locked=true`,
      fail() {
        uni.showToast({ title: '页面打开失败', icon: 'none' })
      },
    })
    return
  }

  const baseUrl = item.url || `/pages/record/${item.page}`
  uni.navigateTo({
    url: `${baseUrl}?cycleId=${cycleId}&dogId=${dogId}&dogName=${damName}&locked=true`,
    fail() {
      uni.showToast({ title: '页面打开失败', icon: 'none' })
    },
  })
}

function handleAbandonCycleFromMore() {
  runAfterMoreSheetClose(() => {
    showCloseCycleSheet.value = true
  })
}

async function closeCycleAsAbandoned() {
  if (closeCycleSubmitting.value) return
  closeCycleSubmitting.value = true
  try {
    await localSyncRuntime.closeBreedingCycleLocally(currentFamily.value?._id || '', cycleId, '放弃')
    showCloseCycleSheet.value = false
    showSubmitBanner('已记录放弃本次繁育')
    await loadData()
  } catch (error: any) {
    uni.showToast({ title: error?.message || '操作失败，请重试', icon: 'none' })
  } finally {
    closeCycleSubmitting.value = false
  }
}

async function loadData() {
  loading.value = true
  const familyId = currentFamily.value?._id || ''
  if (!familyId) {
    cycle.value = null
    records.value = []
    litter.value = null
    expenses.value = []
    loading.value = false
    hasLoadedOnce = true
    return
  }
  localSyncRuntime.setCurrentFamilyId(familyId)
  const detail = await getLocalBreedingCycleDetail(familyId, cycleId)
  cycle.value = detail?.cycle || null
  records.value = detail?.records || []
  litter.value = detail?.litter || null
  expenses.value = detail?.expenses || []
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

.cycle-skeleton-card,
.cycle-skeleton,
.cycle-skeleton-action {
  position: relative;
  overflow: hidden;
}

.cycle-skeleton-card,
.cycle-skeleton-action {
  background: var(--card);
  box-shadow: 0 4px 14px rgba(45, 27, 20, 0.04);
}

.cycle-skeleton-card::after,
.cycle-skeleton::after,
.cycle-skeleton-action::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.58) 50%, transparent 100%);
  animation: cycle-skeleton-shimmer 1.5s infinite;
}

.cycle-skeleton-feed {
  gap: 12px;
}

.cycle-skeleton-action {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
}

.cycle-skeleton-action--primary {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, var(--primary-soft) 100%);
}

.cycle-skeleton-card {
  border-radius: 18px;
  border: 1px solid rgba(216, 203, 189, 0.16);
}

.cycle-skeleton-card--summary {
  padding: 16px 14px;
}

.cycle-skeleton-card--cost {
  padding: 14px;
}

.cycle-skeleton-card--timeline {
  flex: 1;
  padding: 12px 48px 12px 14px;
}

.cycle-skeleton {
  border-radius: 999px;
  background: var(--card-dim);
}

.cycle-skeleton--avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(234, 62, 119, 0.18), rgba(232, 155, 62, 0.18));
}

.cycle-skeleton--title {
  width: 82px;
  max-width: 46%;
  height: 18px;
}

.cycle-skeleton--sub {
  width: 112px;
  max-width: 70%;
  height: 11px;
  margin-top: 6px;
}

.cycle-skeleton--pill {
  width: 56px;
  height: 24px;
}

.cycle-skeleton--label {
  width: 54px;
  height: 12px;
}

.cycle-skeleton--label-short {
  width: 44px;
}

.cycle-skeleton--value {
  width: 88px;
  height: 13px;
}

.cycle-skeleton--value-strong {
  width: 74px;
  background: rgba(234, 62, 119, 0.15);
}

.cycle-skeleton-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0 0 2px;
}

.cycle-skeleton-section__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cycle-skeleton-section__dot--amber {
  background: rgba(232, 155, 62, 0.78);
}

.cycle-skeleton-section__dot--teal {
  background: rgba(61, 168, 160, 0.78);
}

.cycle-skeleton--section-label {
  width: 48px;
  height: 11px;
}

.cycle-skeleton--section-label-wide {
  width: 64px;
}

.cycle-skeleton--cost-label {
  width: 52px;
  height: 13px;
}

.cycle-skeleton--cost-label-strong {
  width: 40px;
}

.cycle-skeleton--cost-value {
  width: 72px;
  height: 16px;
}

.cycle-skeleton--cost-total {
  width: 86px;
  height: 20px;
  background: rgba(234, 62, 119, 0.15);
}

.cycle-skeleton-timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cycle-skeleton-timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.cycle-skeleton-timeline-track {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 16px;
  align-self: stretch;
  padding-top: 30px;
}

.cycle-skeleton-timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(216, 203, 189, 0.56);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.92);
  position: relative;
  z-index: 2;
}

.cycle-skeleton-timeline-dot--current {
  background: rgba(234, 62, 119, 0.9);

  &::after {
    content: '';
    position: absolute;
    inset: -5px;
    border-radius: 999px;
    border: 2px solid rgba(234, 62, 119, 0.34);
  }
}

.cycle-skeleton-timeline-dot--rose {
  background: rgba(234, 62, 119, 0.82);
}

.cycle-skeleton-timeline-dot--teal {
  background: rgba(61, 168, 160, 0.82);
}

.cycle-skeleton-timeline-line {
  width: 2px;
  flex: 1;
  margin-top: 5px;
  border-radius: 999px;
  background: rgba(216, 203, 189, 0.38);
}

.cycle-skeleton-timeline-main {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.cycle-skeleton-timeline-copy {
  flex: 1;
  min-width: 0;
}

.cycle-skeleton--timeline-date {
  width: 48px;
  height: 22px;
}

.cycle-skeleton--timeline-title {
  width: 88px;
  height: 16px;
}

.cycle-skeleton--timeline-detail {
  width: 132px;
  max-width: 88%;
  height: 11px;
  margin-top: 6px;
}

.cycle-skeleton--timeline-detail-short {
  width: 98px;
}

.cycle-skeleton--timeline-chevron {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 240, 232, 0.76);
  flex-shrink: 0;
}

@keyframes cycle-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}

.card-feed {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);
}

.litter-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: -6px;

  :deep(.b-section-label) {
    flex: 1;
    min-width: 0;
  }
}

.litter-section-head__action {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 2px 6px 8px;
  flex-shrink: 0;
}

.litter-section-head__action-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
}

.litter-section-head__action-icon {
  font-size: 16px;
  color: var(--primary);
}

.litter-link-card {
  border-right: 1px solid rgba(61, 168, 160, 0.18);
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

.dam-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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

.info-value--due {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
}

.info-value__date {
  color: var(--text-1);
  white-space: nowrap;
}

.info-value__separator {
  color: var(--text-4);
  font-weight: 700;
}

.info-value__relative {
  color: var(--primary);
  font-weight: 800;
  white-space: nowrap;
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

  &--clickable:active {
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
  position: relative;
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

  &--amber { color: var(--amber); }
  &--teal { color: var(--teal); }
  &--rose { color: var(--rose); }
  &--green { color: var(--green); }
  &--blue { color: var(--blue); }
  &--gray { color: var(--text-4); }
  &--red { color: var(--red); }

  &--current {
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.92);

    &::after {
      content: '';
      position: absolute;
      inset: -5px;
      border-radius: 999px;
      border: 2px solid currentColor;
      opacity: 0.45;
      animation: breeding-cycle-timeline-pulse 1.8s ease-out infinite;
    }
  }
}

.timeline-line {
  width: 2px;
  flex: 1;
  background: rgba(216, 203, 189, 0.42);
  border-radius: 999px;
  margin-top: 5px;
}

.timeline-line--future {
  background: rgba(216, 203, 189, 0.34);
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

.timeline-card--current {
  border-color: rgba(234, 62, 119, 0.12);
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
  background: rgba(234, 62, 119, 0.1);
  color: var(--rose);
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

.timeline-desc--amber { color: var(--amber); }
.timeline-desc--rose { color: var(--rose); }
.timeline-desc--green { color: var(--green); }
.timeline-desc--red { color: var(--red); }

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

@keyframes breeding-cycle-timeline-pulse {
  0% {
    transform: scale(0.88);
    opacity: 0.56;
  }
  70% {
    transform: scale(1.28);
    opacity: 0;
  }
  100% {
    transform: scale(1.28);
    opacity: 0;
  }
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

.cost-detail-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cost-detail-date {
  font-size: 11px;
  color: var(--text-3);
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

/* 更多操作 */
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

  &:active {
    transform: scale(0.97);
  }

  &:last-child {
    border-bottom: none;
  }
}

.more-action-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}

/* 放弃周期 */
.close-cycle-sheet {
  padding-bottom: 12px;
}

.close-cycle-sheet__notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 2px 4px 14px;
  margin-bottom: 4px;
}

.close-cycle-sheet__notice-icon {
  font-size: 17px;
  color: var(--amber);
  flex-shrink: 0;
  margin-top: 1px;
}

.close-cycle-sheet__notice-text {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.55;
  font-weight: 600;
  color: var(--text-3);
}

.close-cycle-sheet__options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.close-cycle-sheet__option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: var(--radius-row);
  background: var(--card);
  border: 1px solid rgba(216, 203, 189, 0.28);
  transition: transform 0.12s ease, opacity 0.12s ease;

  &:active {
    transform: scale(0.98);
  }
}

.close-cycle-sheet__option--disabled {
  opacity: 0.58;
  pointer-events: none;
}

.close-cycle-sheet__option-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .material-icons-round {
    font-size: 19px;
  }
}

.close-cycle-sheet__option-icon--amber {
  background: var(--icon-amber);
  color: var(--amber);
}

.close-cycle-sheet__option-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.close-cycle-sheet__option-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--text-1);
}

.close-cycle-sheet__option-desc {
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-3);
  font-weight: 600;
}

.close-cycle-sheet__option-arrow {
  font-size: 18px;
  color: var(--text-4);
  flex-shrink: 0;
}
</style>
