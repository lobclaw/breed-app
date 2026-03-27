<!--
  犬只详情页 (D-2)
  设计稿：docs/ui/pages-dog-detail.html
  紧凑 Hero + 快捷统计 + Tab 切换（概览/繁育/健康/财务）
-->
<template>
  <!-- 加载骨架屏 -->
  <BSkeleton v-if="loading" :rows="3" :avatar="true" />

  <!-- 主内容 -->
  <view class="dog-detail" v-else-if="dog">

    <!-- ==================== 顶部导航栏 ==================== -->
    <view class="dog-detail__topbar">
      <view class="dog-detail__back-btn" @click="goBack">
        <text class="material-icons-round">arrow_back_ios_new</text>
      </view>
      <text class="dog-detail__topbar-title">{{ dog.name || '未命名' }}</text>
      <view class="dog-detail__topbar-cta" @click="addRecord">
        <text class="material-icons-round dog-detail__topbar-cta-icon">add</text>
        <text class="dog-detail__topbar-cta-text">添加记录</text>
      </view>
      <view class="dog-detail__topbar-more" @click="showMore = true">
        <text class="material-icons-round">more_horiz</text>
      </view>
    </view>

    <!-- ==================== 紧凑 Hero ==================== -->
    <view class="dog-detail__hero">
      <view class="dog-detail__hero-avatar">
        <text class="material-icons-round dog-detail__hero-avatar-icon">pets</text>
      </view>
      <view class="dog-detail__hero-info">
        <text class="dog-detail__hero-name">{{ dog.name || '未命名' }}</text>
        <text class="dog-detail__hero-sub">
          {{ dog.breed || '马尔济斯' }} · {{ dog.gender }}<text v-if="dog.birth_date"> · {{ formatAge(dog.birth_date) }}</text>
        </text>
        <view class="dog-detail__hero-tags">
          <!-- 活跃状态标签（带箭头，可点击） -->
          <view
            v-for="(s, idx) in statuses"
            :key="'status-' + idx"
            class="dog-detail__hero-tag"
            :class="`dog-detail__hero-tag--${statusColorMap[s.type] || 'primary'}`"
          >
            <text class="dog-detail__hero-tag-text">{{ s.type }}</text>
            <text class="material-icons-round dog-detail__hero-tag-arrow">chevron_right</text>
          </view>
          <!-- 角色标签（静态，带边框） -->
          <view class="dog-detail__hero-tag dog-detail__hero-tag--static">
            <text class="dog-detail__hero-tag-text">{{ dog.role || '种狗' }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ==================== 快捷统计条 ==================== -->
    <view class="dog-detail__stats">
      <view class="dog-detail__stat-item">
        <text class="material-icons-round dog-detail__stat-icon">cake</text>
        <text class="dog-detail__stat-value">{{ dog.birth_date ? formatAge(dog.birth_date) : '未知' }}</text>
        <text class="dog-detail__stat-label">年龄</text>
      </view>
      <view class="dog-detail__stat-item">
        <text class="material-icons-round dog-detail__stat-icon">monitor_weight</text>
        <text class="dog-detail__stat-value">{{ dog.latest_weight ? formatWeight(dog.latest_weight) : '—' }}</text>
        <text class="dog-detail__stat-label">体重</text>
      </view>
      <view class="dog-detail__stat-item">
        <text class="material-icons-round dog-detail__stat-icon">child_friendly</text>
        <text class="dog-detail__stat-value">{{ cycles.length }}窝</text>
        <text class="dog-detail__stat-label">繁育</text>
      </view>
    </view>

    <!-- ==================== Tab 栏 ==================== -->
    <view class="dog-detail__tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="dog-detail__tab-item"
        :class="{ 'dog-detail__tab-item--active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <text class="dog-detail__tab-label">{{ tab.label }}</text>
      </view>
    </view>

    <!-- ==================== Tab 内容 ==================== -->
    <view class="dog-detail__tab-content">

      <!-- ========== 概览 Tab ========== -->
      <view v-if="activeTab === 'overview'" class="dog-detail__pane">

        <!-- 当前状态 -->
        <view v-if="statuses.length > 0" class="dog-detail__section">
          <view class="dog-detail__sec dog-detail__sec--rose">
            <text class="dog-detail__sec-text">当前状态</text>
          </view>

          <view class="dog-detail__status-merged">
            <view
              v-for="(s, idx) in statuses"
              :key="'st-' + idx"
              class="dog-detail__status-row"
              :class="`dog-detail__status-row--${statusColorMap[s.type] || 'rose'}`"
            >
              <view class="dog-detail__st-header">
                <view class="dog-detail__st-left">
                  <view class="dog-detail__st-icon" :class="`dog-detail__st-icon--${statusColorMap[s.type] || 'rose'}`">
                    <text class="material-icons-round">{{ statusIconMap[s.type] || 'info' }}</text>
                  </view>
                  <view>
                    <text class="dog-detail__st-title">{{ s.type }}</text>
                    <text v-if="s.detail" class="dog-detail__st-sub">{{ s.detail }}</text>
                  </view>
                </view>
                <text class="material-icons-round dog-detail__st-chevron">chevron_right</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 最近健康记录 -->
        <view class="dog-detail__section">
          <view class="dog-detail__sec dog-detail__sec--green">
            <text class="dog-detail__sec-text">最近健康记录</text>
            <text class="dog-detail__sec-link" @click="activeTab = 'health'">查看全部</text>
          </view>

          <view v-if="healthRecords.length > 0" class="dog-detail__rec-list">
            <view
              v-for="record in healthRecords.slice(0, 3)"
              :key="record._id"
              class="dog-detail__rec-item"
            >
              <view class="dog-detail__rec-icon" :class="`dog-detail__rec-icon--${healthIconColor(record.type)}`">
                <text class="material-icons-round">{{ healthIcon(record.type) }}</text>
              </view>
              <view class="dog-detail__rec-body">
                <text class="dog-detail__rec-title">{{ typeLabel(record.type) }}<text v-if="record.notes"> · {{ record.notes }}</text></text>
                <text class="dog-detail__rec-sub">{{ formatDate(record.date) }}</text>
              </view>
              <text class="material-icons-round dog-detail__rec-chevron">chevron_right</text>
            </view>
          </view>
          <BEmpty
            v-else
            icon="healing"
            title="暂无健康记录"
            description="记录疫苗、驱虫、疾病等信息"
          />
        </view>

        <!-- 详细信息（可折叠） -->
        <view class="dog-detail__section">
          <view class="dog-detail__collapse-head" :class="{ 'dog-detail__collapse-head--open': infoExpanded }" @click="infoExpanded = !infoExpanded">
            <view class="dog-detail__collapse-head-text">
              <text class="material-icons-round">info_outline</text>
              <text>详细信息</text>
            </view>
            <text class="material-icons-round dog-detail__collapse-arrow">expand_more</text>
          </view>
          <view v-if="infoExpanded" class="dog-detail__collapse-body">
            <view class="dog-detail__info-row">
              <text class="dog-detail__info-row-label">性别</text>
              <text class="dog-detail__info-row-value">{{ dog.gender }}</text>
            </view>
            <view class="dog-detail__info-row">
              <text class="dog-detail__info-row-label">品种</text>
              <text class="dog-detail__info-row-value">{{ dog.breed || '马尔济斯' }}</text>
            </view>
            <view class="dog-detail__info-row">
              <text class="dog-detail__info-row-label">出生日期</text>
              <text class="dog-detail__info-row-value">{{ dog.birth_date ? formatDate(dog.birth_date) : '—' }}</text>
            </view>
            <view class="dog-detail__info-row">
              <text class="dog-detail__info-row-label">去向</text>
              <text class="dog-detail__info-row-value">{{ dog.disposition || '—' }}</text>
            </view>
            <view v-if="dog.latest_weight" class="dog-detail__info-row">
              <text class="dog-detail__info-row-label">最新体重</text>
              <text class="dog-detail__info-row-value">{{ formatWeight(dog.latest_weight) }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- ========== 繁育 Tab ========== -->
      <view v-if="activeTab === 'breeding'" class="dog-detail__pane">
        <BEmpty
          v-if="cycles.length === 0"
          icon="child_care"
          title="暂无繁育记录"
          description="添加第一条繁育记录开始跟踪"
          actionText="添加记录"
          @action="addRecord"
        />
        <view v-else>
          <view class="dog-detail__sec dog-detail__sec--rose">
            <text class="dog-detail__sec-text">繁育历史</text>
          </view>
          <view
            v-for="cycle in cycles"
            :key="cycle._id"
            class="dog-detail__cycle-card"
            @click="goToCycle(cycle._id)"
          >
            <view class="dog-detail__rec-icon" :class="cycle.status === '已生产' ? 'dog-detail__rec-icon--green' : 'dog-detail__rec-icon--gray'">
              <text class="material-icons-round">{{ cycle.status === '已生产' ? 'check_circle' : 'close' }}</text>
            </view>
            <view class="dog-detail__cycle-body">
              <text class="dog-detail__cycle-title">{{ cycle.title || '繁育周期' }}</text>
              <text class="dog-detail__cycle-sub">{{ formatDate(cycle.created_at) }}<text v-if="cycle.sire_name"> · 种公: {{ cycle.sire_name }}</text></text>
            </view>
            <view v-if="cycle.status" class="dog-detail__rec-tag" :class="cycle.status === '已生产' ? 'dog-detail__rec-tag--green' : 'dog-detail__rec-tag--gray'">
              <text class="dog-detail__rec-tag-text">{{ cycle.status }}</text>
            </view>
            <text class="material-icons-round dog-detail__rec-chevron">chevron_right</text>
          </view>
        </view>
      </view>

      <!-- ========== 健康 Tab ========== -->
      <view v-if="activeTab === 'health'" class="dog-detail__pane">
        <BEmpty
          v-if="healthRecords.length === 0"
          icon="healing"
          title="暂无健康记录"
          description="记录疫苗、驱虫、疾病等信息"
        />
        <view v-else>
          <view class="dog-detail__sec dog-detail__sec--blue">
            <text class="dog-detail__sec-text">健康记录</text>
            <view class="dog-detail__sec-badge">
              <text class="dog-detail__sec-badge-text">{{ healthRecords.length }}</text>
            </view>
          </view>
          <view class="dog-detail__rec-list">
            <view
              v-for="record in healthRecords"
              :key="record._id"
              class="dog-detail__rec-item"
            >
              <view class="dog-detail__rec-icon" :class="`dog-detail__rec-icon--${healthIconColor(record.type)}`">
                <text class="material-icons-round">{{ healthIcon(record.type) }}</text>
              </view>
              <view class="dog-detail__rec-body">
                <text class="dog-detail__rec-title">{{ typeLabel(record.type) }}<text v-if="record.notes"> · {{ record.notes }}</text></text>
                <text class="dog-detail__rec-sub">{{ formatDate(record.date) }}</text>
              </view>
              <text class="material-icons-round dog-detail__rec-chevron">chevron_right</text>
            </view>
          </view>
        </view>
      </view>

      <!-- ========== 财务 Tab ========== -->
      <view v-if="activeTab === 'finance'" class="dog-detail__pane">
        <BEmpty
          icon="account_balance_wallet"
          title="财务功能将在第二批开发"
          description="敬请期待"
        />
      </view>
    </view>

    <!-- ==================== 更多操作菜单 ==================== -->
    <view v-if="showMore" class="dog-detail__overlay" @click="showMore = false" />
    <view class="dog-detail__action-sheet" :class="{ 'dog-detail__action-sheet--show': showMore }">
      <view class="dog-detail__action-sheet-handle" />
      <view class="dog-detail__action-sheet-item" @click="editDog">
        <view class="dog-detail__action-sheet-icon dog-detail__action-sheet-icon--blue">
          <text class="material-icons-round">edit</text>
        </view>
        <view class="dog-detail__action-sheet-text">
          <text class="dog-detail__action-sheet-title">编辑信息</text>
          <text class="dog-detail__action-sheet-desc">修改犬只基础信息</text>
        </view>
      </view>
      <view class="dog-detail__action-sheet-item" @click="showMore = false">
        <view class="dog-detail__action-sheet-icon dog-detail__action-sheet-icon--amber">
          <text class="material-icons-round">flag</text>
        </view>
        <view class="dog-detail__action-sheet-text">
          <text class="dog-detail__action-sheet-title">标记状态</text>
          <text class="dog-detail__action-sheet-desc">生病、康复等状态变更</text>
        </view>
      </view>
      <view class="dog-detail__action-sheet-sep" />
      <view class="dog-detail__action-sheet-item" @click="showMore = false">
        <view class="dog-detail__action-sheet-icon dog-detail__action-sheet-icon--red">
          <text class="material-icons-round">delete_outline</text>
        </view>
        <view class="dog-detail__action-sheet-text">
          <text class="dog-detail__action-sheet-title dog-detail__action-sheet-title--danger">删除犬只</text>
          <text class="dog-detail__action-sheet-desc">移入回收站，30天内可恢复</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import { useCloudCall } from '@/composables/useCloudCall'
import type { Dog, DeriveStatus } from '@/types/dog'

const dog = ref<Dog | null>(null)
const statuses = ref<DeriveStatus[]>([])
const cycles = ref<any[]>([])
const healthRecords = ref<any[]>([])
const activeTab = ref('overview')
const loading = ref(true)
const showMore = ref(false)
const infoExpanded = ref(false)
let dogId = ''

const tabs = [
  { key: 'overview', label: '概览' },
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

// 状态 → 图标映射
const statusIconMap: Record<string, string> = {
  '发情中': 'local_fire_department',
  '怀孕中': 'favorite',
  '哺乳中': 'child_friendly',
  '生病中': 'sick',
  '用药中': 'medication',
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

function healthIcon(type: string) {
  const map: Record<string, string> = {
    vaccination: 'vaccines',
    deworming: 'bug_report',
    illness: 'healing',
  }
  return map[type] || 'healing'
}

function healthIconColor(type: string) {
  const map: Record<string, string> = {
    vaccination: 'blue',
    deworming: 'teal',
    illness: 'plum',
  }
  return map[type] || 'blue'
}

function goBack() {
  uni.navigateBack()
}

function goToCycle(cycleId: string) {
  uni.navigateTo({ url: `/pages/breeding/cycle?id=${cycleId}` })
}

function editDog() {
  showMore.value = false
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
  display: flex;
  flex-direction: column;
}

/* ==================== 顶部导航栏 ==================== */
.dog-detail__topbar {
  display: flex;
  align-items: center;
  padding: 6px 16px;
  gap: 6px;
  flex-shrink: 0;
}
.dog-detail__back-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-1);
  transition: background 0.12s ease;
  .material-icons-round { font-family: 'Material Icons Round'; font-size: 22px; }
  &:active { background: var(--card-dim); }
}
.dog-detail__topbar-title {
  flex: 1;
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 800;
  color: var(--text-1);
}
.dog-detail__topbar-cta {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 6px 14px 6px 10px;
  border-radius: var(--radius-btn);
  background: var(--primary);
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 2px 10px rgba(234, 62, 119, 0.25);
  transition: all 0.12s ease;
  &:active { transform: scale(0.92); opacity: 0.85; }
}
.dog-detail__topbar-cta-icon {
  font-family: 'Material Icons Round';
  font-size: 16px;
  color: #FFFFFF;
}
.dog-detail__topbar-cta-text {
  font-size: 13px;
  font-weight: 700;
  color: #FFFFFF;
}
.dog-detail__topbar-more {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  transition: background 0.12s ease;
  .material-icons-round { font-family: 'Material Icons Round'; font-size: 22px; }
  &:active { background: var(--card-dim); }
}

/* ==================== 紧凑 Hero ==================== */
.dog-detail__hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 4px var(--space-page) 14px;
  flex-shrink: 0;
}
.dog-detail__hero-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(234, 62, 119, 0.2);
}
.dog-detail__hero-avatar-icon {
  font-family: 'Material Icons Round';
  color: #FFFFFF;
  font-size: 28px;
}
.dog-detail__hero-info {
  flex: 1;
  min-width: 0;
}
.dog-detail__hero-name {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.2;
}
.dog-detail__hero-sub {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  margin-top: 2px;
}
.dog-detail__hero-tags {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.dog-detail__hero-tag {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px 3px 10px;
  border-radius: var(--radius-tag);
  transition: all 0.12s ease;
  &:active { transform: scale(0.92); opacity: 0.8; }
}
.dog-detail__hero-tag-text {
  font-size: 11px;
  font-weight: 700;
}
.dog-detail__hero-tag-arrow {
  font-family: 'Material Icons Round';
  font-size: 12px;
}
.dog-detail__hero-tag--rose {
  background: var(--rose-soft);
  .dog-detail__hero-tag-text, .dog-detail__hero-tag-arrow { color: var(--rose); }
}
.dog-detail__hero-tag--plum {
  background: var(--plum-soft);
  .dog-detail__hero-tag-text, .dog-detail__hero-tag-arrow { color: var(--plum); }
}
.dog-detail__hero-tag--amber {
  background: var(--amber-soft);
  .dog-detail__hero-tag-text, .dog-detail__hero-tag-arrow { color: var(--amber); }
}
.dog-detail__hero-tag--green {
  background: var(--green-soft);
  .dog-detail__hero-tag-text, .dog-detail__hero-tag-arrow { color: var(--green); }
}
.dog-detail__hero-tag--red {
  background: var(--red-soft);
  .dog-detail__hero-tag-text, .dog-detail__hero-tag-arrow { color: var(--red); }
}
.dog-detail__hero-tag--static {
  background: transparent;
  border: 1.5px solid var(--text-4);
  padding: 3px 10px;
  cursor: default;
  .dog-detail__hero-tag-text { color: var(--text-3); }
  &:active { transform: none; opacity: 1; }
}

/* ==================== 快捷统计条 ==================== */
.dog-detail__stats {
  display: flex;
  margin: 0 var(--space-page) 10px;
  background: var(--card);
  border-radius: var(--radius-row);
  box-shadow: var(--shadow);
  overflow: hidden;
  flex-shrink: 0;
}
.dog-detail__stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px;
  gap: 1px;
  & + & { border-left: 1px solid rgba(216, 203, 189, 0.2); }
}
.dog-detail__stat-icon {
  font-family: 'Material Icons Round';
  font-size: 15px;
  color: var(--text-3);
}
.dog-detail__stat-value {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.3;
}
.dog-detail__stat-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-3);
}

/* ==================== Tab 栏 ==================== */
.dog-detail__tab-bar {
  display: flex;
  padding: 0 var(--space-page);
  border-bottom: 1px solid rgba(216, 203, 189, 0.2);
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 5;
  flex-shrink: 0;
}
.dog-detail__tab-item {
  flex: 1;
  text-align: center;
  padding: 10px 0 11px;
  position: relative;
  cursor: pointer;
  transition: color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}
.dog-detail__tab-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
}
.dog-detail__tab-item--active .dog-detail__tab-label {
  color: var(--primary);
  font-weight: 700;
}
.dog-detail__tab-item--active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 20%;
  right: 20%;
  height: 2.5px;
  border-radius: 2px;
  background: var(--primary);
}

/* ==================== Tab 内容 ==================== */
.dog-detail__tab-content {
  flex: 1;
  overflow-y: auto;
}
.dog-detail__pane {
  padding: 16px var(--space-page) 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ==================== Section 标签 ==================== */
.dog-detail__sec {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: -4px;
  &::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
}
.dog-detail__sec--rose::before { background: var(--rose); }
.dog-detail__sec--green::before { background: var(--green); }
.dog-detail__sec--blue::before { background: var(--blue); }
.dog-detail__sec--teal::before { background: var(--teal); }
.dog-detail__sec--amber::before { background: var(--amber); }
.dog-detail__sec--plum::before { background: var(--plum); }
.dog-detail__sec-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.3px;
}
.dog-detail__sec-link {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
}
.dog-detail__sec-badge {
  background: var(--card-dim);
  padding: 2px 8px;
  border-radius: var(--radius-badge);
}
.dog-detail__sec-badge-text {
  font-size: 12px;
  font-weight: 800;
  color: var(--text-2);
}

/* ==================== 合并状态卡片 ==================== */
.dog-detail__status-merged {
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  overflow: hidden;
  position: relative;
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 30%);
    pointer-events: none;
    border-radius: var(--radius-card);
  }
  & > * { position: relative; z-index: 1; }
}
.dog-detail__status-row {
  padding: 14px 16px 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
  transition: background 0.12s ease;
  border-left: 3.5px solid transparent;
  &:active { background: rgba(234, 62, 119, 0.03); }
  & + & { border-top: 1px solid rgba(216, 203, 189, 0.18); }
}
.dog-detail__status-row--rose { border-left-color: var(--rose); }
.dog-detail__status-row--plum { border-left-color: var(--plum); }
.dog-detail__status-row--red { border-left-color: var(--red); }
.dog-detail__status-row--amber { border-left-color: var(--amber); }
.dog-detail__status-row--green { border-left-color: var(--green); }

.dog-detail__st-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dog-detail__st-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dog-detail__st-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  .material-icons-round { font-family: 'Material Icons Round'; font-size: 18px; }
}
.dog-detail__st-icon--rose { background: var(--icon-rose); .material-icons-round { color: var(--rose); } }
.dog-detail__st-icon--plum { background: var(--icon-plum); .material-icons-round { color: var(--plum); } }
.dog-detail__st-icon--red { background: var(--icon-red); .material-icons-round { color: var(--red); } }
.dog-detail__st-icon--amber { background: var(--icon-amber); .material-icons-round { color: var(--amber); } }
.dog-detail__st-icon--green { background: var(--icon-green); .material-icons-round { color: var(--green); } }
.dog-detail__st-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}
.dog-detail__st-sub {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  margin-top: 1px;
}
.dog-detail__st-chevron {
  font-family: 'Material Icons Round';
  color: var(--text-4);
  font-size: 20px;
  flex-shrink: 0;
}

/* ==================== 记录列表 ==================== */
.dog-detail__rec-list {
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.dog-detail__rec-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px 12px 16px;
  cursor: pointer;
  transition: background 0.12s ease;
  &:active { background: rgba(234, 62, 119, 0.03); }
  & + & { border-top: 1px solid rgba(216, 203, 189, 0.12); }
}
.dog-detail__rec-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  .material-icons-round { font-family: 'Material Icons Round'; font-size: 17px; }
}
.dog-detail__rec-icon--blue { background: var(--icon-blue); .material-icons-round { color: var(--blue); } }
.dog-detail__rec-icon--teal { background: var(--icon-teal); .material-icons-round { color: var(--teal); } }
.dog-detail__rec-icon--plum { background: var(--icon-plum); .material-icons-round { color: var(--plum); } }
.dog-detail__rec-icon--rose { background: var(--icon-rose); .material-icons-round { color: var(--rose); } }
.dog-detail__rec-icon--green { background: var(--icon-green); .material-icons-round { color: var(--green); } }
.dog-detail__rec-icon--red { background: var(--icon-red); .material-icons-round { color: var(--red); } }
.dog-detail__rec-icon--amber { background: var(--icon-amber); .material-icons-round { color: var(--amber); } }
.dog-detail__rec-icon--gray { background: var(--card-dim); .material-icons-round { color: var(--text-3); } }
.dog-detail__rec-body {
  flex: 1;
  min-width: 0;
}
.dog-detail__rec-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.dog-detail__rec-sub {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
  margin-top: 1px;
}
.dog-detail__rec-chevron {
  font-family: 'Material Icons Round';
  color: var(--text-4);
  font-size: 18px;
}
.dog-detail__rec-tag {
  padding: 3px 8px;
  border-radius: var(--radius-tag);
}
.dog-detail__rec-tag-text {
  font-size: 11px;
  font-weight: 600;
}
.dog-detail__rec-tag--green {
  background: var(--green-soft);
  .dog-detail__rec-tag-text { color: var(--green); }
}
.dog-detail__rec-tag--gray {
  background: var(--card-dim);
  border: 1px solid var(--text-4);
  .dog-detail__rec-tag-text { color: var(--text-3); }
}
.dog-detail__rec-tag--rose {
  background: var(--rose-soft);
  .dog-detail__rec-tag-text { color: var(--rose); }
}

/* ==================== 繁育周期卡片 ==================== */
.dog-detail__cycle-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px 16px 14px 18px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  border-left: 3.5px solid transparent;
  &:active {
    transform: scale(0.975);
    box-shadow: 0 1px 6px rgba(234, 62, 119, 0.04);
  }
}
.dog-detail__cycle-body {
  flex: 1;
  min-width: 0;
}
.dog-detail__cycle-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}
.dog-detail__cycle-sub {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  margin-top: 2px;
}

/* ==================== 可折叠详细信息 ==================== */
.dog-detail__collapse-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--card);
  border-radius: var(--radius-row);
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: all 0.12s ease;
  -webkit-tap-highlight-color: transparent;
  &:active { transform: scale(0.98); }
}
.dog-detail__collapse-head--open {
  border-radius: var(--radius-row) var(--radius-row) 0 0;
  box-shadow: none;
}
.dog-detail__collapse-head-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  .material-icons-round { font-family: 'Material Icons Round'; font-size: 18px; color: var(--text-3); }
}
.dog-detail__collapse-arrow {
  font-family: 'Material Icons Round';
  color: var(--text-4);
  font-size: 20px;
  transition: transform 0.2s ease;
}
.dog-detail__collapse-head--open .dog-detail__collapse-arrow {
  transform: rotate(180deg);
}
.dog-detail__collapse-body {
  background: var(--card);
  border-radius: 0 0 var(--radius-row) var(--radius-row);
  padding: 0 16px 12px;
  box-shadow: var(--shadow);
}
.dog-detail__info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid rgba(216, 203, 189, 0.18);
  &:last-child { border-bottom: none; }
}
.dog-detail__info-row-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-3);
}
.dog-detail__info-row-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

/* ==================== 更多操作菜单 ==================== */
.dog-detail__overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  background: rgba(26, 26, 46, 0.35);
}
.dog-detail__action-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 21;
  background: var(--card);
  border-radius: 20px 20px 0 0;
  padding: 8px 0 34px;
  transform: translateY(100%);
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.dog-detail__action-sheet--show {
  transform: translateY(0);
}
.dog-detail__action-sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--text-4);
  margin: 4px auto 12px;
}
.dog-detail__action-sheet-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 24px;
  cursor: pointer;
  transition: background 0.1s ease;
  -webkit-tap-highlight-color: transparent;
  &:active { background: rgba(234, 62, 119, 0.04); }
}
.dog-detail__action-sheet-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  .material-icons-round { font-family: 'Material Icons Round'; font-size: 20px; }
}
.dog-detail__action-sheet-icon--blue { background: var(--icon-blue); .material-icons-round { color: var(--blue); } }
.dog-detail__action-sheet-icon--amber { background: var(--icon-amber); .material-icons-round { color: var(--amber); } }
.dog-detail__action-sheet-icon--teal { background: var(--icon-teal); .material-icons-round { color: var(--teal); } }
.dog-detail__action-sheet-icon--red { background: var(--icon-red); .material-icons-round { color: var(--red); } }
.dog-detail__action-sheet-text {
  flex: 1;
}
.dog-detail__action-sheet-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}
.dog-detail__action-sheet-title--danger {
  color: var(--red);
}
.dog-detail__action-sheet-desc {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  margin-top: 1px;
}
.dog-detail__action-sheet-sep {
  height: 1px;
  background: rgba(216, 203, 189, 0.2);
  margin: 4px 24px;
}
</style>
