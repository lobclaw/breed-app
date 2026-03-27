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

<style scoped>
.cycle { min-height: 100vh; background: #f5f5f5; padding-bottom: 140rpx; }
.cycle__header { background: #fff; padding: 32rpx; }
.cycle__status { display: inline-block; padding: 6rpx 20rpx; border-radius: 8rpx; font-size: 24rpx; margin-bottom: 12rpx; }
.cycle__status--发情中 { background: #FFF3E0; color: #E65100; }
.cycle__status--怀孕中 { background: #FCE4EC; color: #C62828; }
.cycle__status--已生产 { background: #E8F5E9; color: #2E7D32; }
.cycle__status--失败 { background: #f5f5f5; color: #999; }
.cycle__status--放弃 { background: #f5f5f5; color: #999; }
.cycle__dam { display: block; font-size: 36rpx; font-weight: 700; color: #333; margin-top: 8rpx; }
.cycle__sire { display: block; font-size: 26rpx; color: #999; margin-top: 4rpx; }

.cycle__timeline { padding: 24rpx 32rpx; }
.cycle__record { display: flex; gap: 20rpx; margin-bottom: 24rpx; position: relative; padding-left: 8rpx; }
.cycle__record::before { content: ''; position: absolute; left: 11rpx; top: 24rpx; bottom: -24rpx; width: 2rpx; background: #e0e0e0; }
.cycle__record:last-child::before { display: none; }
.cycle__dot { width: 24rpx; height: 24rpx; border-radius: 50%; background: #007AFF; flex-shrink: 0; margin-top: 4rpx; z-index: 1; }
.cycle__dot--heat { background: #FF9500; }
.cycle__dot--mating { background: #FF3B30; }
.cycle__dot--birth { background: #4CAF50; }
.cycle__record-content { flex: 1; background: #fff; border-radius: 12rpx; padding: 16rpx 20rpx; }
.cycle__record-header { display: flex; justify-content: space-between; }
.cycle__record-type { font-size: 28rpx; font-weight: 500; color: #333; }
.cycle__record-date { font-size: 24rpx; color: #999; }
.cycle__record-notes { display: block; font-size: 24rpx; color: #666; margin-top: 8rpx; }
.cycle__record-cost { display: block; font-size: 24rpx; color: #FF9500; margin-top: 4rpx; }
.cycle__record-detail { margin-top: 8rpx; font-size: 24rpx; color: #666; }
.cycle__empty { text-align: center; padding: 60rpx; color: #999; font-size: 28rpx; }

.cycle__litter { background: #fff; margin: 16rpx 32rpx; border-radius: 16rpx; padding: 24rpx; }
.cycle__litter-title { font-size: 30rpx; font-weight: 600; color: #333; margin-bottom: 12rpx; }
.cycle__litter-info { display: flex; flex-wrap: wrap; gap: 16rpx; font-size: 26rpx; color: #666; }
.cycle__litter-weaning { color: #FF9500; }

.cycle__actions { position: fixed; bottom: 0; left: 0; right: 0; display: flex; gap: 20rpx; padding: 20rpx 32rpx; background: #fff; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); }
.cycle__btn { flex: 1; height: 80rpx; border-radius: 40rpx; font-size: 28rpx; background: #f5f5f5; color: #333; }
.cycle__btn--primary { background: #007AFF; color: #fff; }
.cycle__btn--birth { background: #4CAF50; color: #fff; }
</style>
