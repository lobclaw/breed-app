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
          </view>
          <view class="detail-skeleton-card__meta">
            <view class="detail-skeleton detail-skeleton--meta-value" />
            <view class="detail-skeleton detail-skeleton--meta-label" />
          </view>
        </view>
      </view>

      <view class="section-label">
        <view class="section-dot section-dot--amber" />
        <text class="section-text">核心信息</text>
      </view>
      <view class="card-feed">
        <view class="detail-skeleton-panel">
          <view v-for="row in 7" :key="`breeding-info-${row}`" class="detail-skeleton-row">
            <view class="detail-skeleton detail-skeleton--label" :class="{ 'detail-skeleton--label-short': row > 5 }" />
            <view class="detail-skeleton-row__value" :class="{ 'detail-skeleton-row__value--stack': row === 2 }">
              <template v-if="row === 1">
                <view class="detail-skeleton detail-skeleton--pill" />
              </template>
              <template v-else-if="row === 2">
                <view class="detail-skeleton detail-skeleton--avatar" />
                <view class="detail-skeleton detail-skeleton--value" />
              </template>
              <template v-else>
                <view class="detail-skeleton detail-skeleton--value" />
              </template>
            </view>
          </view>
        </view>
      </view>

      <view class="section-label" style="margin-top: 8px;">
        <view class="section-dot section-dot--blue" />
        <text class="section-text">关联信息</text>
      </view>
      <view class="card-feed">
        <view class="detail-skeleton-panel">
          <view v-for="row in 2" :key="`breeding-related-${row}`" class="detail-skeleton-row">
            <view class="detail-skeleton detail-skeleton--label" />
            <view class="detail-skeleton-row__value">
              <view class="detail-skeleton detail-skeleton--value" />
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
                    <BEntityIcon :size="14" color="#fff" />
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
                    <BEntityIcon :size="14" color="#fff" />
                  </view>
                  <text>{{ record.dog_name || '未知' }}</text>
                </view>
              </view>
              <view class="info-row" v-if="getMatingSireName(record.details)">
                <text class="info-row-label">种公</text>
                <view class="info-row-value">
                  <view class="mini-avatar mini-avatar--sire">
                    <BEntityIcon :size="14" color="#fff" />
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
                    <BEntityIcon :size="14" color="#fff" />
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
                    <BEntityIcon :size="14" color="#fff" />
                  </view>
                  <text>{{ record.dog_name || '未知' }}</text>
                </view>
              </view>
              <view class="info-row">
                <text class="info-row-label">检查日期</text>
                <text class="info-row-value">{{ formatDate(record.date) }}</text>
              </view>
              <view class="info-row" v-if="getPregnancyResult(record.details)">
                <text class="info-row-label">结果</text>
                <text class="info-row-value">{{ getPregnancyResult(record.details) }}</text>
              </view>
              <view class="info-row" v-if="getPregnancyPuppyCount(record.details)">
                <text class="info-row-label">胎儿数</text>
                <text class="info-row-value">{{ getPregnancyPuppyCount(record.details) }}只</text>
              </view>
            </template>

            <!-- 卵泡检查 -->
            <template v-if="record.type === 'follicle_check'">
              <view class="info-row">
                <text class="info-row-label">犬只</text>
                <view class="info-row-value">
                  <view class="mini-avatar">
                    <BEntityIcon :size="14" color="#fff" />
                  </view>
                  <text>{{ record.dog_name || '未知' }}</text>
                </view>
              </view>
              <view class="info-row">
                <text class="info-row-label">检查日期</text>
                <text class="info-row-value">{{ formatDate(record.date) }}</text>
              </view>
              <view class="info-row">
                <text class="info-row-label">左侧卵泡</text>
                <text class="info-row-value">{{ getFollicleSideText(record.details, 'left') }}</text>
              </view>
              <view class="info-row">
                <text class="info-row-label">右侧卵泡</text>
                <text class="info-row-value">{{ getFollicleSideText(record.details, 'right') }}</text>
              </view>
              <view class="info-row" v-if="record.details?.result">
                <text class="info-row-label">检查结果</text>
                <text class="info-row-value">{{ record.details.result }}</text>
              </view>
            </template>

            <!-- 产检 -->
            <template v-if="record.type === 'prenatal_check'">
              <view class="info-row">
                <text class="info-row-label">犬只</text>
                <view class="info-row-value">
                  <view class="mini-avatar">
                    <BEntityIcon :size="14" color="#fff" />
                  </view>
                  <text>{{ record.dog_name || '未知' }}</text>
                </view>
              </view>
              <view class="info-row">
                <text class="info-row-label">检查日期</text>
                <text class="info-row-value">{{ formatDate(record.date) }}</text>
              </view>
              <view class="info-row" v-if="record.details?.results">
                <text class="info-row-label">检查结果</text>
                <text class="info-row-value">{{ record.details.results }}</text>
              </view>
            </template>

            <!-- 临产监测 -->
            <template v-if="record.type === 'pre_labor'">
              <view class="info-row">
                <text class="info-row-label">犬只</text>
                <view class="info-row-value">
                  <view class="mini-avatar">
                    <BEntityIcon :size="14" color="#fff" />
                  </view>
                  <text>{{ record.dog_name || '未知' }}</text>
                </view>
              </view>
              <view class="info-row">
                <text class="info-row-label">记录时间</text>
                <text class="info-row-value">{{ formatDateTime(record.date) }}</text>
              </view>
              <view class="info-row" v-if="record.details?.temperature !== undefined && record.details?.temperature !== null">
                <text class="info-row-label">体温</text>
                <text class="info-row-value">{{ record.details.temperature }}°C</text>
              </view>
              <view class="info-row" v-if="preLaborSymptomText">
                <text class="info-row-label">观察到的征兆</text>
                <text class="info-row-value">{{ preLaborSymptomText }}</text>
              </view>
            </template>

            <!-- 生产 -->
            <template v-if="record.type === 'birth'">
              <view class="info-row">
                <text class="info-row-label">犬只</text>
                <view class="info-row-value">
                  <view class="mini-avatar">
                    <BEntityIcon :size="14" color="#fff" />
                  </view>
                  <text>{{ record.dog_name || '未知' }}</text>
                </view>
              </view>
              <view class="info-row">
                <text class="info-row-label">生产日期</text>
                <text class="info-row-value">{{ formatDate(record.date) }}</text>
              </view>
              <view class="info-row" v-if="record.details?.birth_type">
                <text class="info-row-label">生产方式</text>
                <text class="info-row-value">{{ record.details.birth_type }}</text>
              </view>
              <view class="info-row" v-if="record.details?.total_born">
                <text class="info-row-label">幼崽总数</text>
                <text class="info-row-value">{{ record.details.total_born }}只</text>
              </view>
              <view class="info-row" v-if="record.details?.born_alive !== undefined">
                <text class="info-row-label">存活幼崽</text>
                <text class="info-row-value">{{ record.details.born_alive || 0 }}只</text>
              </view>
              <view class="info-row" v-if="record.details?.born_dead">
                <text class="info-row-label">死胎</text>
                <text class="info-row-value">{{ record.details.born_dead }}只</text>
              </view>
            </template>

            <!-- 异常终止 -->
            <template v-if="record.type === 'abnormal_termination'">
              <view class="info-row">
                <text class="info-row-label">犬只</text>
                <view class="info-row-value">
                  <view class="mini-avatar">
                    <BEntityIcon :size="14" color="#fff" />
                  </view>
                  <text>{{ record.dog_name || '未知' }}</text>
                </view>
              </view>
              <view class="info-row">
                <text class="info-row-label">记录日期</text>
                <text class="info-row-value">{{ formatDate(record.date) }}</text>
              </view>
              <view class="info-row" v-if="record.details?.termination_type">
                <text class="info-row-label">终止类型</text>
                <text class="info-row-value">{{ record.details.termination_type }}</text>
              </view>
            </template>

            <!-- 通用字段 -->
            <view class="info-row" v-if="record.cost">
              <text class="info-row-label">费用</text>
              <text class="info-row-value" style="color: var(--green);">¥{{ formatAmount(record.cost) }}</text>
            </view>
            <view class="info-row">
              <text class="info-row-label">补充说明</text>
              <text class="info-row-value" :style="{ color: record.notes ? 'var(--text-1)' : 'var(--text-3)' }">{{ record.notes || '—' }}</text>
            </view>
            <view v-if="showRecordImages" class="image-section">
              <view class="info-row image-section__header">
                <text class="info-row-label">检查图片</text>
                <text class="info-row-value">{{ recordImageRefs.length }}张</text>
              </view>
              <view class="image-gallery">
                <template v-for="(img, idx) in recordImageRefs" :key="idx">
                  <image
                    v-if="resolveImageSafeSrc(img, imageDisplayUrls[idx])"
                    :src="resolveImageSafeSrc(img, imageDisplayUrls[idx])"
                    class="image-thumb"
                    mode="aspectFill"
                    @click="previewImage(idx)"
                  />
                </template>
              </view>
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
              <text class="info-row-value">{{ cycleLinkText }}</text>
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
        <view v-if="canDelete" class="more-action-item" @click="handleDeleteFromMore">
          <text class="material-icons-round" style="font-size: 20px; color: var(--red);">delete</text>
          <text class="more-action-label" style="color: var(--red);">删除记录</text>
        </view>
      </view>
    </BSheet>

    <BModal
      v-model:visible="showDeleteConfirm"
      title="确认删除"
      content="删除后不可恢复，确定要删除这条繁育记录吗？"
      confirmText="删除"
      :danger="true"
      @confirm="handleDeleteConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import { getLocalBreedingRecordDetail } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import { consumeSubmitFeedback, queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import { resolveImageDisplayUrls, resolveImageSafeSrc } from '@/utils/imageAttachment'
import { buildBreedingRecordEditUrl } from '@/utils/recordFormRoutes'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BCard from '@/components/base/BCard.vue'
import BTag from '@/components/base/BTag.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BModal from '@/components/layout/BModal.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'

const record = ref<any>(null)
const loading = ref(true)
const showMore = ref(false)
const showDeleteConfirm = ref(false)
const imageDisplayUrls = ref<string[]>([])

let recordId = ''
let hasShownOnce = false
const submitBannerMessage = ref('')
let submitBannerTimer: ReturnType<typeof setTimeout> | null = null
const { currentFamily } = useAuth()
usePageSync({ routePath: 'pages/record/breeding-detail' })

const typeMap: Record<string, { label: string; tagColor: any; cardColor: any }> = {
  heat: { label: '发情', tagColor: 'amber', cardColor: 'amber' },
  heat_observation: { label: '发情观察', tagColor: 'amber', cardColor: 'amber' },
  follicle_check: { label: '卵泡检查', tagColor: 'teal', cardColor: 'teal' },
  mating: { label: '配种', tagColor: 'rose', cardColor: 'rose' },
  pregnancy_check: { label: '孕检', tagColor: 'green', cardColor: 'green' },
  prenatal_check: { label: '产检', tagColor: 'blue', cardColor: 'blue' },
  pre_labor: { label: '临产监测', tagColor: 'amber', cardColor: 'amber' },
  birth: { label: '生产', tagColor: 'green', cardColor: 'green' },
  abnormal_termination: { label: '异常终止', tagColor: 'red', cardColor: 'red' },
}

const typeLabel = computed(() => typeMap[record.value?.type]?.label || record.value?.type || '未知')
const pageTitle = computed(() => {
  if (!record.value) return '繁育记录详情'
  const dogName = record.value?.dog_name || '未知犬只'
  return `${dogName} · ${typeLabel.value}详情`
})
const tagColor = computed(() => typeMap[record.value?.type]?.tagColor || 'green')
const cardColor = computed(() => typeMap[record.value?.type]?.cardColor || 'green')
const canEdit = computed(() => !loading.value && !!record.value && Boolean(buildBreedingRecordEditUrl(record.value.type, recordId)))
const canDelete = computed(() => !loading.value && !!record.value && record.value.type === 'heat_observation')
const hasMoreActions = computed(() => canDelete.value)
const recordImageRefs = computed(() => {
  const images = record.value?.details?.images || record.value?.images || []
  return Array.isArray(images) ? images.filter(Boolean) : []
})
const showRecordImages = computed(() => {
  return ['pregnancy_check', 'prenatal_check'].includes(record.value?.type)
    && recordImageRefs.value.length > 0
})
const preLaborSymptoms = computed(() => {
  if (record.value?.type !== 'pre_labor') return []
  return normalizePreLaborSymptoms(record.value?.details || {})
})
const preLaborSymptomText = computed(() => preLaborSymptoms.value.join('、'))
const preLaborSummaryMeta = computed(() => {
  if (preLaborSymptoms.value.length > 0) return `${preLaborSymptoms.value.length}项征兆`
  if (record.value?.details?.temperature !== undefined && record.value?.details?.temperature !== null) return '仅体温'
  if (record.value?.notes) return '有补充'
  return '监测中'
})
const heatObservationSummaryMeta = computed(() => {
  const details = record.value?.details || {}
  const discharge = String(details.discharge_status || '').trim()
  if (discharge) return discharge
  const vulva = String(details.vulva_status || '').trim()
  if (vulva) return vulva
  const symptoms = Array.isArray(details.symptoms) ? details.symptoms.filter(Boolean) : []
  if (symptoms.length > 0) return `${symptoms.length}项征兆`
  if (record.value?.notes) return '有补充'
  return '观察记录'
})
const cycleLinkText = computed(() => {
  const cycleNumber = Number(record.value?.cycle_number || 0)
  return cycleNumber > 0 ? `第${cycleNumber}次繁育` : '繁育周期'
})

watch(recordImageRefs, async (images) => {
  imageDisplayUrls.value = await resolveImageDisplayUrls(images, { familyId: currentFamily.value?._id || '' })
}, { immediate: true })

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

function getPregnancyResult(details: Record<string, any> = {}) {
  if (details.result) return details.result
  if (details.confirmed === '是' || details.confirmed === true) return '确认怀孕'
  if (details.confirmed === '否' || details.confirmed === false) return '未怀孕'
  return ''
}

function getPregnancyPuppyCount(details: Record<string, any> = {}) {
  const value = Number(details.fetus_count || details.puppy_count || details.count)
  return value > 0 ? value : null
}

function getFollicleSideText(details: Record<string, any> = {}, side: 'left' | 'right') {
  const countKey = side === 'left' ? 'left_count' : 'right_count'
  const sizeKey = side === 'left' ? 'left_size' : 'right_size'
  const count = details[countKey]
  const size = details[sizeKey]
  const parts = []
  if (count !== undefined && count !== null && count !== '') parts.push(`${count}个`)
  if (size !== undefined && size !== null && size !== '') parts.push(`${size}`)
  return parts.length > 0 ? parts.join(' · ') : '—'
}

const summaryTitle = computed(() => {
  if (record.value?.type === 'heat') return '发情开始'
  if (record.value?.type === 'follicle_check') return record.value?.details?.result || '卵泡检查'
  if (record.value?.type === 'mating') {
    const sireName = getMatingSireName(record.value?.details)
    return sireName ? `与 ${sireName} 配种` : '配种记录'
  }
  if (record.value?.type === 'heat_observation') return '发情周期观察'
  if (record.value?.type === 'pregnancy_check') return getPregnancyResult(record.value?.details) || '孕检记录'
  if (record.value?.type === 'prenatal_check') return record.value?.details?.results || '产检记录'
  if (record.value?.type === 'pre_labor') {
    const temperature = record.value?.details?.temperature
    return temperature !== undefined && temperature !== null ? `体温 ${temperature}°C` : '临产监测'
  }
  if (record.value?.type === 'birth') return record.value?.details?.birth_type || '生产记录'
  if (record.value?.type === 'abnormal_termination') return record.value?.details?.termination_type || '异常终止'
  return typeLabel.value
})
const summaryMeta = computed(() => {
  if (record.value?.type === 'follicle_check') {
    const left = record.value?.details?.left_count
    const right = record.value?.details?.right_count
    return `左${left ?? '—'} 右${right ?? '—'}`
  }
  if (record.value?.type === 'mating') {
    const matingNumber = getMatingNumber(record.value?.details)
    if (matingNumber) return `第${matingNumber}脚`
  }
  if (record.value?.type === 'pregnancy_check' && getPregnancyPuppyCount(record.value?.details)) {
    return `${getPregnancyPuppyCount(record.value?.details)}只`
  }
  if (record.value?.type === 'heat_observation') return heatObservationSummaryMeta.value
  if (record.value?.type === 'pre_labor') return preLaborSummaryMeta.value
  if (record.value?.type === 'birth' && record.value?.details?.born_alive !== undefined) {
    return `存活${record.value.details.born_alive || 0}只`
  }
  if (record.value?.type === 'abnormal_termination' && record.value?.details?.termination_type) {
    return record.value.details.termination_type
  }
  return typeLabel.value
})
const summaryDateText = computed(() => ['heat_observation', 'pre_labor'].includes(record.value?.type) ? formatDateTime(record.value?.date) : formatDate(record.value?.date))

function normalizePreLaborSymptoms(details: Record<string, any> = {}) {
  const legacyLabelMap: Record<string, string> = {
    刨窝: '刨窝/做窝',
    焦躁: '焦躁不安',
    喘气: '喘气加快',
    分泌物: '阴道分泌物',
    宫缩: '可见宫缩',
    乳汁: '乳汁分泌',
  }
  const normalize = (item: any) => {
    const label = String(item || '').trim()
    return legacyLabelMap[label] || label
  }

  if (Array.isArray(details.symptoms)) {
    return details.symptoms
      .map(normalize)
      .filter(Boolean)
  }

  const normalized = String(details.symptoms || '')
    .split(/[、，,\s]+/)
    .map(normalize)
    .filter(Boolean)

  if (details.nesting_behavior && !normalized.includes('刨窝/做窝')) {
    normalized.push('刨窝/做窝')
  }
  const appetiteChange = normalize(details.appetite_change)
  if (appetiteChange && !normalized.includes(appetiteChange)) {
    normalized.push(appetiteChange)
  }
  if (details.other_signs) {
    String(details.other_signs)
      .split(/[、，,\s]+/)
      .map(normalize)
      .filter(Boolean)
      .forEach((item) => {
        if (!normalized.includes(item)) normalized.push(item)
      })
  }

  return normalized
}

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

async function loadRecord() {
  loading.value = true
  const familyId = currentFamily.value?._id || ''
  if (!familyId) {
    record.value = null
    loading.value = false
    return
  }
  localSyncRuntime.setCurrentFamilyId(familyId)
  record.value = await getLocalBreedingRecordDetail(familyId, recordId)
  loading.value = false
}

function goEdit() {
  showMore.value = false
  const url = buildBreedingRecordEditUrl(record.value?.type, recordId)
  if (!url) {
    uni.showToast({ title: '当前记录暂不支持编辑', icon: 'none' })
    return
  }
  uni.navigateTo({ url })
}

async function previewImage(index: number) {
  const urls = imageDisplayUrls.value.length
    ? imageDisplayUrls.value
    : await resolveImageDisplayUrls(recordImageRefs.value, { familyId: currentFamily.value?._id || '' })
  uni.previewImage({
    current: urls[index] || index,
    urls,
  })
}

function confirmDelete() {
  showMore.value = false
  showDeleteConfirm.value = true
}

async function handleDeleteConfirm() {
  const result = await localSyncRuntime.deleteBreedingRecordLocally(currentFamily.value?._id || '', recordId)
  if (result) {
    queueSubmitFeedback({ message: '已删除繁育记录' })
    await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
    uni.navigateBack()
  }
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
.detail-skeleton-card__meta {
  min-width: 68px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.76);
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
  background: radial-gradient(circle, rgba(255, 243, 225, 0.95) 0%, rgba(255, 243, 225, 0) 72%);
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
  width: 58px;
  height: 24px;
}
.detail-skeleton--title {
  width: 132px;
  max-width: 58%;
  height: 20px;
}
.detail-skeleton--sub {
  width: 168px;
  max-width: 72%;
  height: 13px;
}
.detail-skeleton--meta-value {
  width: 52px;
  height: 16px;
}
.detail-skeleton--meta-label {
  width: 42px;
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
  width: 88px;
  height: 14px;
}
.detail-skeleton--pill {
  width: 56px;
  height: 24px;
}
.detail-skeleton--avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
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
.detail-summary--amber { background: linear-gradient(135deg, var(--amber-soft), rgba(255, 255, 255, 0.98)); }
.detail-summary--rose { background: linear-gradient(135deg, var(--rose-soft), rgba(255, 255, 255, 0.98)); }
.detail-summary--blue { background: linear-gradient(135deg, var(--blue-soft), rgba(255, 255, 255, 0.98)); }
.detail-summary--teal { background: linear-gradient(135deg, rgba(61, 168, 160, 0.12), rgba(255, 255, 255, 0.98)); }
.detail-summary--green { background: linear-gradient(135deg, var(--green-soft), rgba(255, 255, 255, 0.98)); }
.detail-summary--red { background: linear-gradient(135deg, var(--red-soft), rgba(255, 255, 255, 0.98)); }
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

.image-section {
  padding: 2px 0 12px;
}
.image-section__header {
  border-bottom: none;
  padding-bottom: 8px;
}
.image-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0;
}
.image-thumb {
  width: 78px;
  height: 78px;
  border-radius: 10px;
  background: var(--card-dim);
  object-fit: cover;
  flex-shrink: 0;
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

.mini-avatar--sire {
  background: linear-gradient(135deg, #4a8dd4, #72a8e0);
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
.section-dot--teal { background: var(--teal); }
.section-dot--green { background: var(--green); }
.section-dot--red { background: var(--red); }
.section-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.5px;
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
