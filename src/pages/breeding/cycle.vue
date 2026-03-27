<template>
  <view class="cycle" v-if="cycle">
    <!-- 周期头部 -->
    <view class="cycle__header">
      <view class="cycle__status" :class="`cycle__status--${cycle.status}`">
        <text>{{ cycle.status }}</text>
      </view>
      <text class="cycle__dam">{{ cycle.dam_name }}</text>
      <text v-if="cycle.sire_name" class="cycle__sire">种公: {{ cycle.sire_name }}</text>
    </view>

    <!-- 时间线 -->
    <view class="cycle__timeline">
      <view v-for="record in records" :key="record._id" class="cycle__record">
        <view class="cycle__dot" :class="`cycle__dot--${record.type}`" />
        <view class="cycle__record-content">
          <view class="cycle__record-header">
            <text class="cycle__record-type">{{ typeLabel(record.type) }}</text>
            <text class="cycle__record-date">{{ formatDate(record.date) }}</text>
          </view>
          <text v-if="record.notes" class="cycle__record-notes">{{ record.notes }}</text>
          <text v-if="record.cost" class="cycle__record-cost">¥{{ record.cost }}</text>
          <!-- 类型特有信息 -->
          <view v-if="record.type === 'mating' && record.details" class="cycle__record-detail">
            <text>种公: {{ record.details.sire_name || '未知' }}</text>
          </view>
          <view v-if="record.type === 'follicle_check' && record.details" class="cycle__record-detail">
            <text>左{{ record.details.left_count }}({{ record.details.left_size }}mm) 右{{ record.details.right_count }}({{ record.details.right_size }}mm)</text>
          </view>
        </view>
      </view>

      <view v-if="records.length === 0" class="cycle__empty">
        <text>暂无记录</text>
      </view>
    </view>

    <!-- 窝信息 -->
    <view v-if="litter" class="cycle__litter" @click="goToLitter(litter._id)">
      <text class="cycle__litter-title">窝信息</text>
      <view class="cycle__litter-info">
        <text>{{ formatDate(litter.birth_date) }} · {{ litter.birth_type }}</text>
        <text>存活 {{ litter.born_alive }}/{{ litter.total_born }}</text>
        <text v-if="litter.weaned_at">已断奶</text>
        <text v-else class="cycle__litter-weaning">未断奶</text>
      </view>
    </view>

    <!-- 底部操作 -->
    <view class="cycle__actions" v-if="!isTerminal">
      <button class="cycle__btn cycle__btn--primary" @click="addRecord">+ 添加记录</button>
      <button v-if="cycle.status === '怀孕中'" class="cycle__btn cycle__btn--birth" @click="addBirth">录入生产</button>
      <button class="cycle__btn" @click="closeCycleAction">关闭周期</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'

const cycle = ref<any>(null)
const records = ref<any[]>([])
const litter = ref<any>(null)
let cycleId = ''

const { run: fetchDetail } = useCloudCall<{ data: any }>('breeding-service', 'getCycleDetail')
const { run: doClose } = useCloudCall('breeding-service', 'closeCycle', { successMessage: '已关闭' })

const isTerminal = computed(() => {
  return cycle.value && ['已生产', '失败', '放弃'].includes(cycle.value.status)
})

const TYPE_LABELS: Record<string, string> = {
  heat: '发情', follicle_check: '卵泡检查', mating: '配种',
  pregnancy_check: '孕检', prenatal_check: '产检',
  pre_labor: '临产监测', birth: '生产', abnormal_termination: '异常终止',
}

function typeLabel(type: string) { return TYPE_LABELS[type] || type }

function formatDate(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function goToLitter(id: string) {
  uni.navigateTo({ url: `/pages/breeding/litter?id=${id}` })
}

function addRecord() {
  uni.navigateTo({ url: `/pages/record/breeding?cycleId=${cycleId}&dogId=${cycle.value.dam_id}` })
}

function addBirth() {
  uni.navigateTo({ url: `/pages/breeding/birth-wizard?cycleId=${cycleId}` })
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
  const res = await fetchDetail(cycleId)
  if (res?.data) {
    cycle.value = res.data.cycle
    records.value = res.data.records
    litter.value = res.data.litter
  }
}

onLoad((query) => {
  cycleId = query?.id || ''
  if (cycleId) loadData()
})
</script>

<style lang="scss" scoped>
.cycle {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 70px;
}

.cycle__header {
  background: var(--card);
  padding: 16px;
  box-shadow: var(--shadow);
}

.cycle__status {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--radius-tag);
  font-size: 12px;
  margin-bottom: 6px;
}

.cycle__status--发情中 {
  background: var(--amber-soft);
  color: var(--amber);
}

.cycle__status--怀孕中 {
  background: var(--rose-soft);
  color: var(--rose);
}

.cycle__status--已生产 {
  background: var(--green-soft);
  color: var(--green);
}

.cycle__status--失败 {
  background: var(--bg);
  color: var(--text-3);
}

.cycle__status--放弃 {
  background: var(--bg);
  color: var(--text-3);
}

.cycle__dam {
  display: block;
  font-size: 18px;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--text-1);
  margin-top: 4px;
}

.cycle__sire {
  display: block;
  font-size: 13px;
  color: var(--text-3);
  margin-top: 2px;
}

.cycle__timeline {
  padding: 12px 16px;
}

.cycle__record {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  position: relative;
  padding-left: 4px;
}

.cycle__record::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 12px;
  bottom: -12px;
  width: 1px;
  background: var(--text-4);
}

.cycle__record:last-child::before {
  display: none;
}

.cycle__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--primary);
  flex-shrink: 0;
  margin-top: 2px;
  z-index: 1;
}

.cycle__dot--heat {
  background: var(--amber);
}

.cycle__dot--mating {
  background: var(--red);
}

.cycle__dot--birth {
  background: var(--green);
}

.cycle__record-content {
  flex: 1;
  background: var(--card);
  border-radius: var(--radius-row);
  padding: 8px 10px;
  box-shadow: var(--shadow);
}

.cycle__record-header {
  display: flex;
  justify-content: space-between;
}

.cycle__record-type {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-1);
}

.cycle__record-date {
  font-size: 12px;
  color: var(--text-3);
}

.cycle__record-notes {
  display: block;
  font-size: 12px;
  color: var(--text-2);
  margin-top: 4px;
}

.cycle__record-cost {
  display: block;
  font-size: 12px;
  color: var(--amber);
  font-family: var(--font-display);
  margin-top: 2px;
}

.cycle__record-detail {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-2);
}

.cycle__empty {
  text-align: center;
  padding: 30px;
  color: var(--text-3);
  font-size: 14px;
}

.cycle__litter {
  background: var(--card);
  margin: 8px 16px;
  border-radius: var(--radius-card);
  padding: 12px;
  box-shadow: var(--shadow);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.cycle__litter-title {
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--text-1);
  margin-bottom: 6px;
}

.cycle__litter-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
  color: var(--text-2);
}

.cycle__litter-weaning {
  color: var(--amber);
}

.cycle__actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 10px;
  padding: 10px 16px;
  background: var(--card);
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  box-shadow: var(--shadow);
}

.cycle__btn {
  flex: 1;
  height: 40px;
  border-radius: var(--radius-btn);
  font-size: 14px;
  background: var(--bg);
  color: var(--text-1);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.cycle__btn--primary {
  background: var(--primary);
  color: var(--card);
}

.cycle__btn--birth {
  background: var(--green);
  color: var(--card);
}
</style>
