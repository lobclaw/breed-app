<template>
  <view class="page">
    <!-- 骨架屏 -->
    <BSkeleton v-if="!cycle && loading" :rows="4" />

    <template v-if="cycle">
      <!-- 顶栏 -->
      <BPageHeader :title="`${cycle.dam_name} · 第${cycle.cycle_number || ''}次繁育`">
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
                {{ cycle.status }}{{ cycle.day_count ? ` · 第${cycle.day_count}天` : '' }}
              </text>
            </view>
          </view>
        </BCard>

        <!-- 时间线 -->
        <BSectionLabel title="繁育时间线" color="teal" />

        <view class="timeline">
          <view
            v-for="(record, idx) in records"
            :key="record._id"
            class="timeline-item"
            @click="onRecordTap(record)"
          >
            <view class="timeline-track">
              <view
                class="timeline-dot"
                :class="record._is_future ? 'timeline-dot--hollow' : 'timeline-dot--filled'"
                :style="{ color: `var(--${dotColor(record.type)})` }"
              />
              <view v-if="idx < records.length - 1" class="timeline-line" />
            </view>
            <view class="timeline-content">
              <text class="timeline-date">{{ formatShortDate(record.date) }}</text>
              <text class="timeline-desc" :style="record._is_future ? { color: 'var(--primary)' } : {}">
                {{ typeLabel(record.type) }}
              </text>
              <text v-if="record.notes" class="timeline-detail">{{ record.notes }}</text>
              <!-- 类型特有信息 -->
              <text v-if="record.type === 'mating' && record.details" class="timeline-detail">
                {{ record.details.method || '自然交配' }} · {{ record.details.sire_name || '未知' }}
              </text>
              <text v-if="record.type === 'heat_observation' && record.details" class="timeline-detail">
                {{ record.details.vulva_status || '外阴状态待补充' }}<text v-if="record.details.discharge_status"> · {{ record.details.discharge_status }}</text><text v-if="record.details.symptoms?.length"> · {{ record.details.symptoms.join(' / ') }}</text>
              </text>
              <text v-if="record.type === 'follicle_check' && record.details" class="timeline-detail">
                左{{ record.details.left_count }}右{{ record.details.right_count }} · 发育良好
              </text>
              <text v-if="record.type === 'pregnancy_check' && record.details" class="timeline-detail">
                确认怀孕 · {{ record.details.count || '?' }}只
              </text>
            </view>
            <view class="timeline-chevron">
              <text class="material-icons-round" style="font-size: 16px; color: var(--text-4);">chevron_right</text>
            </view>
          </view>
        </view>

        <!-- 空状态 -->
        <BEmpty
          v-if="records.length === 0"
          icon="timeline"
          title="暂无记录"
          description="点击下方按钮添加繁育记录"
        />

        <!-- 费用 -->
        <template v-if="totalCost > 0">
          <BSectionLabel title="周期费用" color="amber" />
          <BCard color="amber" :pressable="false">
            <view v-for="item in costItems" :key="item.label" class="cost-row">
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
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BCard from '@/components/base/BCard.vue'
import BTag from '@/components/base/BTag.vue'
import BButton from '@/components/base/BButton.vue'
import BSectionLabel from '@/components/base/BSectionLabel.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import { consumeSubmitFeedback } from '@/composables/useSubmitFeedback'

const cycle = ref<any>(null)
const records = ref<any[]>([])
const litter = ref<any>(null)
const loading = ref(true)
let cycleId = ''
const submitBannerMessage = ref('')
let submitBannerTimer: ReturnType<typeof setTimeout> | null = null
let hasLoadedOnce = false

const { run: fetchDetail } = useCloudCall<{ data: any }>('breeding-service', 'getCycleDetail')
const { run: doClose } = useCloudCall('breeding-service', 'closeCycle', { successMessage: '已关闭' })

const isTerminal = computed(() => {
  return cycle.value && ['已生产', '失败', '放弃'].includes(cycle.value.status)
})

const costItems = computed(() => {
  if (!records.value.length) return []
  return records.value
    .filter(r => r.cost && r.cost > 0)
    .map(r => ({ label: typeLabel(r.type), amount: r.cost }))
})

const totalCost = computed(() => costItems.value.reduce((s, i) => s + i.amount, 0))

const TYPE_LABELS: Record<string, string> = {
  heat: '发情', heat_observation: '发情观察', follicle_check: '卵泡检查', mating: '配种',
  pregnancy_check: '孕检', prenatal_check: '产检',
  pre_labor: '临产监测', birth: '生产', abnormal_termination: '异常终止',
}

const DOT_COLORS: Record<string, string> = {
  heat: 'text-3', heat_observation: 'amber', follicle_check: 'teal', mating: 'rose',
  pregnancy_check: 'green', prenatal_check: 'blue',
  pre_labor: 'amber', birth: 'green', abnormal_termination: 'red',
}

function typeLabel(type: string) { return TYPE_LABELS[type] || type }
function dotColor(type: string) { return DOT_COLORS[type] || 'primary' }

function statusColor(status: string) {
  const map: Record<string, string> = {
    '发情中': 'amber', '怀孕中': 'rose', '已生产': 'green', '失败': 'red', '放弃': 'red',
  }
  return (map[status] || 'rose') as any
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
  // 显示操作菜单选择记录类型
  const itemList = cycle.value?.status === '发情中'
    ? ['发情记录', '发情观察', '卵泡检查', '配种记录', '孕检记录', '产检记录', '临产监测', '异常终止']
    : ['发情记录', '卵泡检查', '配种记录', '孕检记录', '产检记录', '临产监测', '异常终止']
  const pages = cycle.value?.status === '发情中'
    ? ['breeding-heat', 'heat-observation', 'breeding-follicle', 'breeding-mating', 'breeding-pregnancy', 'breeding-prenatal', 'breeding-prelabor', 'breeding-termination']
    : ['breeding-heat', 'breeding-follicle', 'breeding-mating', 'breeding-pregnancy', 'breeding-prenatal', 'breeding-prelabor', 'breeding-termination']
  uni.showActionSheet({
    itemList,
    success: (res) => {
      const page = pages[res.tapIndex]
      uni.navigateTo({ url: `/pages/record/${page}?cycleId=${cycleId}&dogId=${cycle.value.dam_id}&dogName=${encodeURIComponent(cycle.value.dam_name)}&locked=true` })
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
}

.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  position: relative;
  padding-bottom: 20px;
  transition: background 0.12s ease;

  &:last-child {
    padding-bottom: 0;
  }

  &:active {
    background: var(--card-dim);
    border-radius: 12px;
  }
}

.timeline-track {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 20px;
  position: relative;
}

.timeline-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
  z-index: 2;

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
  background: var(--text-4);
  margin-top: 4px;
}

.timeline-content {
  flex: 1;
  min-width: 0;
}

.timeline-date {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  font-family: var(--font-display);
}

.timeline-desc {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  margin-top: 2px;
  line-height: 1.4;
  display: block;
}

.timeline-detail {
  font-size: 11px;
  color: var(--text-2);
  margin-top: 1px;
  display: block;
}

.timeline-chevron {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin-top: 4px;
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
