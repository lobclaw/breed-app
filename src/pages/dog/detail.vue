<template>
  <!-- 加载骨架屏 -->
  <BSkeleton v-if="loading" :rows="3" :avatar="true" />

  <!-- 主内容 -->
  <view class="dog-detail" v-else-if="dog">
    <!-- 头部信息 -->
    <view class="dog-detail__header">
      <DogAvatar :name="dog.name" :size="128" />
      <view class="dog-detail__header-info">
        <text class="dog-detail__name">{{ dog.name || '未命名' }}</text>
        <text class="dog-detail__meta">{{ dog.gender }} · {{ dog.role }} · {{ dog.breed }}</text>
        <!-- 状态标签 — 使用 BTag 组件 + 功能色映射 -->
        <view class="dog-detail__statuses">
          <BTag
            v-for="(s, idx) in statuses"
            :key="idx"
            :label="s.type"
            :color="statusColorMap[s.type] || 'primary'"
          />
        </view>
      </view>
    </view>

    <!-- 基础信息卡片 -->
    <view class="dog-detail__card">
      <view class="dog-detail__card-title">基础信息</view>
      <view class="dog-detail__field">
        <text class="dog-detail__label">出生日期</text>
        <text class="dog-detail__value">{{ dog.birth_date ? formatDate(dog.birth_date) : '未知' }}</text>
      </view>
      <view class="dog-detail__field" v-if="dog.birth_date">
        <text class="dog-detail__label">年龄</text>
        <text class="dog-detail__value">{{ formatAge(dog.birth_date) }}</text>
      </view>
      <view class="dog-detail__field">
        <text class="dog-detail__label">去向</text>
        <text class="dog-detail__value">{{ dog.disposition }}</text>
      </view>
      <view class="dog-detail__field" v-if="dog.latest_weight">
        <text class="dog-detail__label">最新体重</text>
        <text class="dog-detail__value">{{ formatWeight(dog.latest_weight) }}</text>
      </view>
      <view class="dog-detail__field" v-if="dog.owner_info">
        <text class="dog-detail__label">主人信息</text>
        <text class="dog-detail__value">{{ dog.owner_info }}</text>
      </view>
    </view>

    <!-- Tab 切换 — 使用 BTabBar 组件 -->
    <BTabBar :tabs="tabs" v-model="activeTab" />

    <!-- Tab 内容 -->
    <view class="dog-detail__tab-content">
      <!-- 繁育历史 -->
      <view v-if="activeTab === 'breeding'">
        <BEmpty
          v-if="cycles.length === 0"
          icon="child_care"
          title="暂无繁育记录"
          description="添加第一条繁育记录开始跟踪"
          actionText="添加记录"
          @action="addRecord"
        />
        <view
          v-for="cycle in cycles"
          :key="cycle._id"
          class="dog-detail__record"
          @click="goToCycle(cycle._id)"
        >
          <view class="dog-detail__record-header">
            <text class="dog-detail__record-title">繁育周期 · {{ cycle.status }}</text>
            <text class="dog-detail__record-date">{{ formatDate(cycle.created_at) }}</text>
          </view>
          <text v-if="cycle.sire_name" class="dog-detail__record-sub">种公: {{ cycle.sire_name }}</text>
        </view>
      </view>

      <!-- 健康记录 -->
      <view v-if="activeTab === 'health'">
        <BEmpty
          v-if="healthRecords.length === 0"
          icon="healing"
          title="暂无健康记录"
          description="记录疫苗、驱虫、疾病等信息"
        />
        <view v-for="record in healthRecords" :key="record._id" class="dog-detail__record">
          <view class="dog-detail__record-header">
            <text class="dog-detail__record-title">{{ typeLabel(record.type) }}</text>
            <text class="dog-detail__record-date">{{ formatDate(record.date) }}</text>
          </view>
          <text v-if="record.notes" class="dog-detail__record-sub">{{ record.notes }}</text>
        </view>
      </view>

      <!-- 财务 -->
      <view v-if="activeTab === 'finance'">
        <BEmpty
          icon="account_balance_wallet"
          title="财务功能将在第二批开发"
          description="敬请期待"
        />
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view class="dog-detail__actions">
      <button class="dog-detail__btn" @click="editDog">编辑</button>
      <button class="dog-detail__btn dog-detail__btn--primary" @click="addRecord">+ 添加记录</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import DogAvatar from '@/components/common/DogAvatar.vue'
import BTag from '@/components/base/BTag.vue'
import BTabBar from '@/components/layout/BTabBar.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import { useCloudCall } from '@/composables/useCloudCall'
import type { Dog, DeriveStatus } from '@/types/dog'

const dog = ref<Dog | null>(null)
const statuses = ref<DeriveStatus[]>([])
const cycles = ref<any[]>([])
const healthRecords = ref<any[]>([])
const activeTab = ref('breeding')
const loading = ref(true)
let dogId = ''

const tabs = [
  { key: 'breeding', label: '繁育' },
  { key: 'health', label: '健康' },
  { key: 'finance', label: '财务' },
]

// 状态 → 功能色映射
const statusColorMap: Record<string, 'amber' | 'rose' | 'green' | 'red' | 'plum'> = {
  '发情中': 'amber',
  '怀孕中': 'rose',
  '哺乳中': 'green',
  '生病中': 'red',
  '用药中': 'plum',
}

const { run: fetchDetail } = useCloudCall<{ data: Dog }>('dog-service', 'getDogDetail')
const { run: fetchCycles } = useCloudCall<{ data: any[] }>('breeding-service', 'getCycleHistory')
const { run: fetchHealth } = useCloudCall<{ data: any[] }>('health-service', 'getHealthHistory')

function formatDate(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatAge(birthTs: number) {
  const days = Math.floor((Date.now() - birthTs) / 86400000)
  if (days < 30) return `${days}天`
  if (days < 365) return `${Math.floor(days / 30)}月龄`
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  return months > 0 ? `${years}岁${months}月` : `${years}岁`
}

function formatWeight(grams: number) {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)}kg` : `${grams}g`
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    vaccination: '疫苗',
    deworming: '驱虫',
    illness: '疾病',
  }
  return map[type] || type
}

function goToCycle(cycleId: string) {
  uni.navigateTo({ url: `/pages/breeding/cycle?id=${cycleId}` })
}

function editDog() {
  uni.navigateTo({ url: `/pages/dog/add?id=${dogId}` })
}

function addRecord() {
  uni.navigateTo({ url: `/pages/record/breeding?dogId=${dogId}` })
}

async function loadData() {
  loading.value = true
  try {
    const [detailRes, cyclesRes, healthRes] = await Promise.all([
      fetchDetail(dogId),
      fetchCycles(dogId),
      fetchHealth(dogId),
    ])

    if (detailRes?.data) {
      dog.value = detailRes.data
    }
    if (cyclesRes?.data) {
      cycles.value = cyclesRes.data
    }
    if (healthRes?.data) {
      healthRecords.value = healthRes.data
    }
  } finally {
    loading.value = false
  }
}

onLoad((query) => {
  dogId = query?.id || ''
  if (dogId) loadData()
})
</script>

<style lang="scss" scoped>
.dog-detail {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 70px; // 为底部操作栏留空间
}

// 头部：头像 + 名字 + 状态标签
.dog-detail__header {
  display: flex;
  gap: 12px;
  padding: 16px var(--space-page);
  background: var(--card);
  align-items: center;
}

.dog-detail__header-info {
  flex: 1;
}

.dog-detail__name {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
}

.dog-detail__meta {
  font-size: 13px;
  color: var(--text-3);
  margin-top: 3px;
}

.dog-detail__statuses {
  display: flex;
  gap: var(--space-tag-gap);
  margin-top: 6px;
  flex-wrap: wrap;
}

// 基础信息卡片
.dog-detail__card {
  background: var(--card);
  margin: var(--space-card-gap) var(--space-page);
  border-radius: var(--radius-card);
  padding: var(--space-card);
  box-shadow: var(--shadow);
}

.dog-detail__card-title {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-1);
}

.dog-detail__field {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--card-dim);
}

.dog-detail__field:last-child {
  border-bottom: none;
}

.dog-detail__label {
  font-size: 14px;
  color: var(--text-3);
}

.dog-detail__value {
  font-size: 14px;
  color: var(--text-1);
}

// Tab 内容区
.dog-detail__tab-content {
  padding: 8px var(--space-page);
}

// 记录卡片（繁育/健康）— 可点击带按压效果
.dog-detail__record {
  background: var(--card);
  border-radius: var(--radius-row);
  padding: 10px var(--space-card);
  margin-bottom: var(--space-card-gap);
  box-shadow: var(--shadow);
  transition: transform 0.12s ease, opacity 0.12s ease;

  &:active {
    transform: scale(0.97);
    opacity: 0.85;
  }
}

.dog-detail__record-header {
  display: flex;
  justify-content: space-between;
}

.dog-detail__record-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-1);
}

.dog-detail__record-date {
  font-size: 12px;
  color: var(--text-3);
}

.dog-detail__record-sub {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 4px;
}

// 底部操作栏
.dog-detail__actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 10px;
  padding: 10px var(--space-page);
  background: var(--card);
  box-shadow: var(--shadow-lg);
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
}

.dog-detail__btn {
  flex: 1;
  height: 40px;
  border-radius: var(--radius-btn);
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card-dim);
  color: var(--text-1);
  transition: transform 0.12s ease, opacity 0.12s ease;

  // 按压效果
  &:active {
    transform: scale(0.96);
    opacity: 0.85;
  }

  &--primary {
    background: var(--primary);
    color: #fff;
  }
}
</style>
