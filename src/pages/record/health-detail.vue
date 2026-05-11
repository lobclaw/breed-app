<template>
  <view class="page">
    <BPageHeader :title="pageTitle">
      <template #right>
        <view class="header-actions">
          <view v-if="canEdit" class="header-action" @click="goEdit">
            <text class="material-icons-round" style="font-size: 22px; color: var(--text-2);">edit</text>
          </view>
          <view v-if="hasMoreActions" class="header-action" @click="showMore = true">
            <text class="material-icons-round" style="font-size: 22px; color: var(--text-2);">more_horiz</text>
          </view>
        </view>
      </template>
    </BPageHeader>

    <BSubmitBanner :message="submitBannerMessage" />

    <!-- 加载中 -->
    <template v-if="loading">
      <view class="card-feed">
        <view class="detail-skeleton-card detail-skeleton-card--summary">
          <view class="detail-skeleton-card__main">
            <view class="detail-skeleton detail-skeleton--tag" />
            <view class="detail-skeleton detail-skeleton--title" />
            <view class="detail-skeleton detail-skeleton--sub" />
            <view class="detail-skeleton-card__fact">
              <view class="detail-skeleton detail-skeleton--icon" />
              <view class="detail-skeleton detail-skeleton--fact-label" />
              <view class="detail-skeleton detail-skeleton--fact-value" />
            </view>
          </view>
          <view class="detail-skeleton-card__meta">
            <view class="detail-skeleton detail-skeleton--meta-value" />
            <view class="detail-skeleton detail-skeleton--meta-label" />
          </view>
        </view>
      </view>

      <view class="section-label">
        <view class="section-dot section-dot--red" />
        <text class="section-text">核心信息</text>
      </view>
      <view class="card-feed">
        <view class="detail-skeleton-panel">
          <view v-for="row in 6" :key="`health-info-${row}`" class="detail-skeleton-row">
            <view class="detail-skeleton detail-skeleton--label" :class="{ 'detail-skeleton--label-short': row > 4 }" />
            <view class="detail-skeleton-row__value" :class="{ 'detail-skeleton-row__value--stack': row === 2 }">
              <template v-if="row === 1 || row === 4">
                <view class="detail-skeleton detail-skeleton--pill" />
              </template>
              <template v-else-if="row === 2">
                <view class="detail-skeleton detail-skeleton--avatar" />
                <view class="detail-skeleton detail-skeleton--value" />
              </template>
              <template v-else-if="row === 6">
                <view class="detail-skeleton detail-skeleton--note" />
              </template>
              <template v-else>
                <view class="detail-skeleton detail-skeleton--value" />
              </template>
            </view>
          </view>
        </view>
      </view>

    </template>

    <!-- 详情内容 -->
    <template v-if="!loading && record">
      <view class="card-feed">
        <view class="detail-summary" :class="`detail-summary--${cardColor}`">
          <view class="detail-summary__main">
            <view v-if="summaryTagText" class="detail-summary__tag">
              <text
                class="detail-summary__tag-text"
                :class="{ 'detail-summary__tag-text--green': isRecoveredIllness }"
              >
                {{ summaryTagText }}
              </text>
            </view>
            <text class="detail-summary__title">{{ summaryTitle }}</text>
            <template v-if="summarySubtitleLines.length > 0">
              <text
                v-for="(line, index) in summarySubtitleLines"
                :key="`summary-sub-${index}`"
                class="detail-summary__sub"
              >
                {{ line }}
              </text>
            </template>
            <view v-if="summaryFact" class="detail-summary__facts">
              <view class="detail-summary__fact" :class="summaryFact.tone ? `detail-summary__fact--${summaryFact.tone}` : ''">
                <text class="material-icons-round detail-summary__fact-icon">{{ summaryFact.icon || 'schedule' }}</text>
                <text class="detail-summary__fact-label">{{ summaryFact.label }}</text>
                <text class="detail-summary__fact-value">{{ summaryFact.value }}</text>
              </view>
            </view>
          </view>
          <view
            v-if="summaryMeta"
            class="detail-summary__meta"
            :class="{ 'detail-summary__meta--green': isRecoveredIllness }"
          >
            <text class="detail-summary__meta-value">{{ summaryMeta }}</text>
            <text class="detail-summary__meta-label">{{ summaryMetaLabel }}</text>
          </view>
        </view>
      </view>

      <view class="section-label">
        <view class="section-dot" :class="`section-dot--${cardColor}`" />
        <text class="section-text">{{ detailSectionTitle }}</text>
      </view>
      <!-- 记录信息卡片 -->
      <view class="card-feed">
        <BCard :color="cardColor" :pressable="false">
          <view class="info-rows">
            <view v-if="record.type !== 'illness'" class="info-row">
              <text class="info-row-label">记录类型</text>
              <view class="info-row-value">
                <BTag :label="typeLabel" :color="tagColor" />
              </view>
            </view>

            <view v-if="record.type !== 'illness'" class="info-row">
              <text class="info-row-label">犬只</text>
              <view class="info-row-value">
                <view class="mini-avatar">
                  <BEntityIcon :size="14" color="#fff" />
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
              <view v-if="illnessSymptomTags.length > 0" class="detail-block detail-block--symptoms">
                <view class="detail-block__head">
                  <text class="detail-block__title">症状表现</text>
                  <text class="detail-block__meta">{{ illnessSymptomCount }}项</text>
                </view>
                <view class="symptom-grid">
                  <text
                    v-for="symptom in illnessSymptomTags"
                    :key="symptom"
                    class="symptom-chip"
                    :class="{ 'symptom-chip--recovered': isRecoveredIllness }"
                  >
                    {{ symptom }}
                  </text>
                </view>
              </view>
              <view v-if="record.date" class="info-row">
                <text class="info-row-label">发病日期</text>
                <text class="info-row-value">{{ formatDate(record.date) }}</text>
              </view>
              <view v-if="isRecoveredIllness && illnessRecoveryDate" class="info-row">
                <text class="info-row-label">康复日期</text>
                <text class="info-row-value">{{ formatDate(illnessRecoveryDate) }}</text>
              </view>
              <view v-if="illnessDurationDays" class="info-row">
                <text class="info-row-label">{{ isRecoveredIllness ? '持续时长' : '当前病程' }}</text>
                <text class="info-row-value">{{ isRecoveredIllness ? `持续${illnessDurationDays}天` : `第${illnessDurationDays}天` }}</text>
              </view>
              <view v-if="record.cost" class="info-row">
                <text class="info-row-label">费用</text>
                <text class="info-row-value" style="color: var(--green);">¥{{ formatAmount(record.cost) }}</text>
              </view>
              <view v-if="record.notes" class="info-row info-row--top">
                <text class="info-row-label">补充说明</text>
                <text class="info-row-value info-row-value--note">{{ record.notes }}</text>
              </view>
              <view v-if="!hasIllnessDetailRows" class="detail-empty-hint">暂无更多病情细节</view>
            </template>

            <!-- 通用字段 -->
            <view class="info-row" v-if="record.type !== 'illness' && record.cost">
              <text class="info-row-label">费用</text>
              <text class="info-row-value" style="color: var(--green);">¥{{ formatAmount(record.cost) }}</text>
            </view>
            <view class="info-row" v-if="record.type !== 'illness'">
              <text class="info-row-label">备注</text>
              <text class="info-row-value info-row-value--note" :style="{ color: record.notes ? 'var(--text-1)' : 'var(--text-3)' }">{{ record.notes || '暂无补充说明' }}</text>
            </view>
          </view>
        </BCard>
      </view>

      <template v-if="record.type === 'illness' && linkedMedicationTasks.length > 0">
        <view class="section-label">
          <view class="section-dot section-dot--plum" />
          <text class="section-text">关联用药</text>
        </view>
        <view class="card-feed">
          <BCard color="plum" :pressable="false">
            <view class="linked-med-list">
              <view
                v-for="taskItem in linkedMedicationTasks"
                :key="taskItem.taskId"
                class="linked-med-item"
                @click="goToMedicationDetail(taskItem.taskId)"
              >
                <view class="linked-med-item__main">
                  <text class="linked-med-item__title">{{ taskItem.medicationName }}</text>
                  <text class="linked-med-item__sub">{{ linkedMedicationSummary(taskItem) }}</text>
                </view>
                <view class="linked-med-item__side">
                  <BTag :label="linkedMedicationStatusLabel(taskItem)" :color="linkedMedicationStatusColor(taskItem)" />
                  <text class="material-icons-round linked-med-item__chevron">chevron_right</text>
                </view>
              </view>
            </view>
          </BCard>
        </view>
      </template>

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

      <view v-if="record.type === 'illness' && primaryIllnessAction" class="action-area action-area--red">
        <view class="health-action-card">
          <view class="health-action-card__glow" />
          <view class="health-action-card__body">
            <view class="health-action__row">
              <view v-if="canRecoverIllness" class="health-action__secondary-wrap">
                <BButton
                  class="health-action__secondary"
                  variant="ghost"
                  color="green"
                  @click="markRecovered"
                >
                  <view class="health-action__secondary-inner">
                    <text class="material-icons-round health-action__secondary-icon">check_circle</text>
                    <text>标记康复</text>
                  </view>
                </BButton>
              </view>
              <BButton
                class="health-action__primary"
                variant="filled"
                color="red"
                size="large"
                @click="handlePrimaryIllnessAction"
              >
                <view class="health-action__primary-inner">
                  <text class="material-icons-round health-action__primary-icon">medication</text>
                  <text>{{ primaryIllnessAction.label }}</text>
                </view>
              </BButton>
            </view>
            <text class="action-note health-action__note">{{ primaryIllnessAction.note }}</text>
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

    <!-- 更多操作 Sheet -->
    <BSheet v-model:visible="showMore" title="更多操作">
      <view class="more-actions">
        <view
          v-for="action in moreActions"
          :key="action.key"
          class="more-action-item"
          @click="handleMoreAction(action.key)"
        >
          <text class="material-icons-round" :style="{ fontSize: '20px', color: action.tone === 'danger' ? 'var(--red)' : 'var(--text-2)' }">{{ action.icon }}</text>
          <text class="more-action-label" :class="{ 'more-action-label--danger': action.tone === 'danger' }">{{ action.label }}</text>
        </view>
      </view>
    </BSheet>

    <BModal
      v-model:visible="showDeleteConfirm"
      title="确认删除"
      content="删除后不可恢复，确定要删除这条健康记录吗？"
      confirmText="删除"
      :danger="true"
      @confirm="handleDeleteConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import { getLocalHealthRecordDetail } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import { consumeSubmitFeedback, queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import BCard from '@/components/base/BCard.vue'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BTag from '@/components/base/BTag.vue'
import BButton from '@/components/base/BButton.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BModal from '@/components/layout/BModal.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import { buildMedicationDetailUrl } from '@/utils/dogDetailNavigation'
import { getBeijingDayDiff, getBeijingOrdinalDay } from '@/utils/date'
import { buildHealthRecordEditUrl } from '@/utils/recordFormRoutes'

const record = ref<any>(null)
const loading = ref(true)
const showMore = ref(false)
const showDeleteConfirm = ref(false)

let recordId = ''
let hasShownOnce = false
const submitBannerMessage = ref('')
let submitBannerTimer: ReturnType<typeof setTimeout> | null = null
const { currentFamily } = useAuth()
usePageSync({ routePath: 'pages/record/health-detail' })

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
const cardColor = computed(() => {
  if (record.value?.type === 'illness' && isRecoveredIllness.value) return 'green'
  return typeMap[record.value?.type]?.cardColor || 'green'
})
const pageTitle = computed(() => {
  const dogName = record.value?.dog_name
  if (!dogName) return '健康记录详情'
  if (record.value?.type === 'vaccination') return `${dogName} · 疫苗详情`
  if (record.value?.type === 'deworming') return `${dogName} · 驱虫详情`
  if (record.value?.type === 'illness') return `${dogName} · 疾病详情`
  return `${dogName} · 健康记录详情`
})
const canEdit = computed(() => !loading.value && !!record.value && Boolean(buildHealthRecordEditUrl(record.value.type, recordId)))
const isIllnessRecord = computed(() => record.value?.type === 'illness')
const illnessStatus = computed(() => record.value?.details?.treatment_status || '观察中')
const isRecoveredIllness = computed(() => isIllnessRecord.value && illnessStatus.value === '已康复')
const canRecoverIllness = computed(() => isIllnessRecord.value && illnessStatus.value !== '已康复')
const canStartMedication = computed(() => isIllnessRecord.value && illnessStatus.value !== '已康复')
const canDeleteRecord = computed(() => !loading.value && !!record.value)
const linkedMedicationTasks = computed(() => Array.isArray(record.value?.linkedMedicationTasks) ? record.value.linkedMedicationTasks : [])
const activeLinkedMedicationTask = computed(() => linkedMedicationTasks.value.find((item: any) => item.status === 'active') || null)
const primaryIllnessAction = computed<null | { key: 'view_medication' | 'start_medication'; label: string; note: string }>(() => {
  if (!isIllnessRecord.value || illnessStatus.value === '已康复') return null
  if (activeLinkedMedicationTask.value) {
    return {
      key: 'view_medication',
      label: '查看用药',
      note: '直接查看疗程进度、今日执行情况与停药去向。',
    }
  }
  return {
    key: 'start_medication',
    label: '开始用药',
    note: '为这条疾病创建连续用药任务，并保持与病程的明确关联。',
  }
})
const hasMoreActions = computed(() => moreActions.value.length > 0)
const moreActions = computed(() => {
  const actions: Array<{ key: 'recover' | 'start_medication' | 'delete'; label: string; icon: string; tone?: 'danger' }> = []

  if (canStartMedication.value) {
    actions.push({
      key: 'start_medication',
      label: activeLinkedMedicationTask.value ? '新增一轮用药' : '开始用药',
      icon: 'medication',
    })
  }

  if (canDeleteRecord.value) {
    actions.push({ key: 'delete', label: '删除记录', icon: 'delete', tone: 'danger' })
  }

  return actions
})

const dewormingTypeLabel = computed(() => {
  const t = record.value?.details?.deworming_type
  return dewormingTypeMap[t] || t || '—'
})

const illnessPrimaryCondition = computed(() => {
  const details = record.value?.details || {}
  return String(details.primary_condition || details.condition || '').trim()
})
const illnessSymptomTags = computed<string[]>(() => {
  const tags = Array.isArray(record.value?.details?.symptom_tags)
    ? record.value.details.symptom_tags
      .map((item: unknown) => typeof item === 'string' ? item.trim() : '')
      .filter(Boolean)
    : []
  return Array.from(new Set(tags))
})
const illnessSymptomCount = computed(() => illnessSymptomTags.value.length)
const hasIllnessDetailRows = computed(() => illnessSymptomCount.value > 0 || !!record.value?.notes || !!record.value?.cost)
const detailSectionTitle = computed(() => record.value?.type === 'illness' ? '病情细节' : '核心信息')
const summaryTagText = computed(() => {
  if (record.value?.type === 'vaccination') return ''
  if (record.value?.type === 'illness') return illnessStatus.value
  return typeLabel.value
})

const summaryTitle = computed(() => {
  if (record.value?.type === 'vaccination') return record.value?.details?.vaccine_type || record.value?.details?.vaccine_name || '疫苗记录'
  if (record.value?.type === 'deworming') return record.value?.details?.drug_name || dewormingTypeLabel.value || '驱虫记录'
  if (record.value?.type === 'illness') return illnessPrimaryCondition.value || '疾病'
  return '健康记录'
})
const summarySubtitleLines = computed(() => {
  if (record.value?.type === 'illness') {
    return []
  }
  return [`${record.value?.dog_name || '未知犬只'} · ${formatDate(record.value?.date)}`]
})
const summaryMeta = computed(() => {
  if (record.value?.type === 'illness') {
    return record.value?.details?.severity || (illnessSymptomCount.value > 0 ? `${illnessSymptomCount.value}项` : '')
  }
  if (record.value?.type === 'deworming') return dewormingTypeLabel.value
  return typeLabel.value
})
const summaryMetaLabel = computed(() => {
  if (record.value?.type === 'illness') {
    return record.value?.details?.severity && illnessSymptomCount.value > 0 ? `${illnessSymptomCount.value}项症状` : '症状概况'
  }
  if (record.value?.type === 'deworming') return '驱虫类型'
  return '当前记录'
})
const summaryFact = computed(() => {
  if (!record.value) return null

  if (record.value.type === 'illness') return null

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

const illnessDurationDays = computed(() => {
  if (!record.value?.date) return null
  const endTs = isRecoveredIllness.value ? (illnessRecoveryDate.value || Date.now()) : Date.now()
  return getBeijingOrdinalDay(record.value.date, endTs)
})

const illnessRecoveryDate = computed(() => {
  if (!isRecoveredIllness.value) return null
  return record.value?.details?.recovery_date || record.value?.details?.recovered_at || record.value?.recovered_at || record.value?.updated_at || null
})

const nextReminderText = computed(() => {
  const ts = record.value?.details?.next_reminder_date
  if (!ts) return ''
  const days = getBeijingDayDiff(ts, Date.now())
  if (days < 0) return `下次提醒日期已过 ${Math.abs(days)} 天`
  if (days === 0) return '今天需要进行下次接种'
  return `距下次提醒还有 ${days} 天（${formatDate(ts)}）`
})

const nextReminderShortText = computed(() => {
  const ts = record.value?.details?.next_reminder_date
  if (!ts) return ''
  const days = getBeijingDayDiff(ts, Date.now())
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

function getIllnessCourseDay(ts: number | undefined): number | null {
  if (!ts) return null
  return getBeijingOrdinalDay(ts)
}

function formatAmount(n: number): string {
  return n.toLocaleString('zh-CN')
}

function linkedMedicationStatusLabel(taskItem: any) {
  if (taskItem?.status === 'completed') return '已完成'
  if (taskItem?.status === 'cancelled') return '已取消'
  return '用药中'
}

function linkedMedicationStatusColor(taskItem: any): 'plum' | 'green' | 'gray' {
  if (taskItem?.status === 'completed') return 'green'
  if (taskItem?.status === 'cancelled') return 'gray'
  return 'plum'
}

function linkedMedicationSummary(taskItem: any) {
  const parts = [
    taskItem?.startedAt ? `开始于 ${formatDate(taskItem.startedAt)}` : '',
    taskItem?.endedAt ? `结束于 ${formatDate(taskItem.endedAt)}` : '',
    taskItem?.todayCompleted ? '今日已完成' : '',
  ].filter(Boolean)
  return parts.join(' · ') || '查看疗程详情'
}

async function loadRecord() {
  loading.value = true
  const familyId = currentFamily.value?._id || ''
  if (!familyId) {
    record.value = null
    loading.value = false
    return
  }
  localSyncRuntime.setCurrentFamilyId(familyId)
  record.value = await getLocalHealthRecordDetail(familyId, recordId)
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
  const url = buildHealthRecordEditUrl(record.value?.type, recordId)
  if (!url) {
    uni.showToast({ title: '当前记录暂不支持编辑', icon: 'none' })
    return
  }
  uni.navigateTo({ url })
}

function goToMedicationDetail(taskId: string) {
  if (!taskId) return
  uni.navigateTo({ url: buildMedicationDetailUrl(taskId) })
}

function confirmDelete() {
  showMore.value = false
  showDeleteConfirm.value = true
}

async function handleDeleteConfirm() {
  const result = await localSyncRuntime.deleteHealthRecordLocally(currentFamily.value?._id || '', recordId)
  if (result) {
    queueSubmitFeedback({ message: '已删除健康记录' })
    await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
    uni.navigateBack()
  }
}

async function markRecovered() {
  if (!recordId) return
  showMore.value = false
  const result = await localSyncRuntime.recoverIllnessesLocally(
    currentFamily.value?._id || '',
    [recordId],
    linkedMedicationTasks.value.map((item: any) => item.taskId || item.id).filter(Boolean),
    Date.now(),
  )
  if (result) {
    showSubmitBanner('已标记康复')
    await loadRecord()
  }
}

function openMedicationFromIllness() {
  if (!record.value?.dog_id) {
    uni.showToast({ title: '犬只信息缺失', icon: 'none' })
    return
  }
  showMore.value = false
  const dogName = encodeURIComponent(record.value?.dog_name || '')
  uni.navigateTo({
    url: `/pages/record/health-medication?dogId=${record.value.dog_id}&dogName=${dogName}&illnessRecordId=${recordId}`,
  })
}

function handlePrimaryIllnessAction() {
  if (!primaryIllnessAction.value) return
  if (primaryIllnessAction.value.key === 'view_medication' && activeLinkedMedicationTask.value?.taskId) {
    goToMedicationDetail(activeLinkedMedicationTask.value.taskId)
    return
  }
  openMedicationFromIllness()
}

function handleMoreAction(actionKey: 'recover' | 'start_medication' | 'delete') {
  if (actionKey === 'recover') {
    markRecovered()
    return
  }
  if (actionKey === 'start_medication') {
    openMedicationFromIllness()
    return
  }
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
  padding-bottom: calc(188px + env(safe-area-inset-bottom));
}

.detail-skeleton-card,
.detail-skeleton-panel,
.detail-skeleton-action {
  position: relative;
  overflow: hidden;
  background: var(--card);
  border-radius: 16px;
  box-shadow: var(--shadow);
}
.detail-skeleton-card::after,
.detail-skeleton-panel::after,
.detail-skeleton-action::after,
.detail-skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.56) 50%, transparent 100%);
  animation: detail-skeleton-shimmer 1.5s infinite;
}
.detail-skeleton-card--summary {
  padding: 16px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.detail-skeleton-card__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail-skeleton-card__fact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  margin-top: 4px;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
}
.detail-skeleton-card__meta {
  min-width: 68px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
}
.detail-skeleton-panel {
  padding: 2px 0;
}
.detail-skeleton-row {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.detail-skeleton-row + .detail-skeleton-row {
  border-top: 1px solid rgba(216, 203, 189, 0.12);
}
.detail-skeleton-row__value {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 120px;
}
.detail-skeleton-row__value--stack {
  min-width: 140px;
}
.detail-skeleton-action {
  padding: 14px 16px 16px;
}
.detail-skeleton-action__glow {
  position: absolute;
  right: -18px;
  bottom: -22px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 237, 237, 0.95) 0%, rgba(255, 237, 237, 0) 72%);
}
.detail-skeleton-action__row {
  position: relative;
  display: flex;
  gap: 12px;
}
.detail-skeleton {
  position: relative;
  overflow: hidden;
  border-radius: 999px;
  background: var(--card-dim);
}
.detail-skeleton--tag {
  width: 52px;
  height: 24px;
}
.detail-skeleton--title {
  width: 120px;
  max-width: 55%;
  height: 20px;
}
.detail-skeleton--sub {
  width: 150px;
  max-width: 70%;
  height: 13px;
}
.detail-skeleton--icon {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}
.detail-skeleton--fact-label {
  width: 28px;
  height: 10px;
}
.detail-skeleton--fact-value {
  width: 52px;
  height: 12px;
}
.detail-skeleton--meta-value {
  width: 42px;
  height: 18px;
}
.detail-skeleton--meta-label {
  width: 38px;
  height: 11px;
}
.detail-skeleton--label {
  width: 72px;
  height: 12px;
}
.detail-skeleton--label-short {
  width: 52px;
}
.detail-skeleton--value {
  width: 86px;
  height: 14px;
}
.detail-skeleton--pill {
  width: 50px;
  height: 24px;
}
.detail-skeleton--avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}
.detail-skeleton--note {
  width: 112px;
  height: 14px;
}
.detail-skeleton--button {
  height: 46px;
  border-radius: 999px;
}
.detail-skeleton--button-primary {
  flex: 1;
}
.detail-skeleton--button-secondary {
  width: 120px;
}
.detail-skeleton--action-note {
  width: 190px;
  max-width: 88%;
  height: 12px;
  margin-top: 14px;
}

@keyframes detail-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
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
.detail-summary--green { background: linear-gradient(135deg, var(--green-soft), rgba(255, 255, 255, 0.98)); }
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
.detail-summary__tag-text--green {
  color: var(--green);
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
.detail-summary__meta--green {
  background: rgba(255, 255, 255, 0.82);
}
.detail-summary__meta--green .detail-summary__meta-value {
  color: var(--green);
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
.detail-block {
  padding: 4px 0 16px;
}
.detail-block--symptoms {
  border-bottom: 1px solid rgba(216, 203, 189, 0.16);
  margin-bottom: 2px;
}
.detail-block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.detail-block__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-2);
}
.detail-block__meta {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
}
.info-row--top {
  align-items: flex-start;
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
    flex-wrap: wrap;
    justify-content: flex-end;
    max-width: 220px;
  }

  &--note {
    max-width: 180px;
    text-align: right;
    line-height: 1.45;
    font-weight: 500;
  }
}

.symptom-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(224, 82, 82, 0.07);
  color: var(--red);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.symptom-chip--recovered {
  background: rgba(50, 186, 120, 0.08);
  color: var(--green);
}

.symptom-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 12px 10px;
}

.detail-empty-hint {
  padding: 16px 0 8px;
  text-align: center;
  font-size: 12px;
  color: var(--text-3);
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
.section-dot--green { background: var(--green); }
.section-dot--plum { background: var(--plum); }
.section-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.5px;
}

.linked-med-list {
  display: flex;
  flex-direction: column;
}

.linked-med-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(216, 203, 189, 0.16);
  &:last-child { border-bottom: none; }
  &:active { opacity: 0.72; }
}

.linked-med-item__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.linked-med-item__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}

.linked-med-item__sub {
  font-size: 12px;
  color: var(--text-3);
}

.linked-med-item__side {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.linked-med-item__chevron {
  font-size: 18px;
  color: var(--text-3);
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

.action-area {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  padding: 12px 16px calc(8px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(252, 248, 248, 0) 0%, rgba(252, 248, 248, 0.94) 18%, rgba(252, 248, 248, 0.98) 100%);
}

.health-action-card {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  border: 1px solid rgba(230, 93, 93, 0.12);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 245, 245, 0.96));
  box-shadow: 0 10px 30px rgba(190, 86, 86, 0.08);
}

.health-action-card__glow {
  position: absolute;
  top: -42px;
  right: -18px;
  width: 132px;
  height: 132px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(230, 93, 93, 0.16), rgba(230, 93, 93, 0));
  pointer-events: none;
}

.health-action-card__body {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
}

.health-action__row {
  display: flex;
  align-items: stretch;
  gap: 10px;
}

.health-action__secondary-wrap {
  flex: 0 0 auto;
  display: flex;
}

.health-action__primary {
  flex: 1;
  min-width: 0;
  min-height: 52px;
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(230, 93, 93, 0.22);
}

.health-action__secondary {
  min-width: 114px;
  min-height: 52px;
  padding: 0 10px;
  border-radius: 18px;
  border-color: rgba(50, 186, 120, 0.18);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(243, 255, 248, 0.9));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.82);
  color: var(--green);
}

.health-action__primary-inner,
.health-action__secondary-inner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.health-action__primary-icon {
  font-size: 18px;
  color: #fff;
}

.health-action__secondary-icon {
  font-size: 16px;
  color: var(--green);
}

.action-note {
  display: block;
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
}

.health-action__note {
  margin-top: 2px;
}

@media (max-width: 360px) {
  .health-action__row {
    flex-direction: column;
  }

  .health-action__secondary {
    width: 100%;
  }
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
.more-action-label--danger {
  color: var(--red);
}
</style>
