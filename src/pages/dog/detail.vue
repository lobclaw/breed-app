<!--
  犬只详情页 (D-2)
  设计稿：docs/ui/pages-dog-detail.html
  紧凑 Hero + 快捷统计 + Tab 切换（概览/繁育/健康/财务）
  + D-6 ~ D-14 状态变更弹窗/Sheet
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
      <view class="dog-detail__action-sheet-item" @click="openStatusSheet">
        <view class="dog-detail__action-sheet-icon dog-detail__action-sheet-icon--amber">
          <text class="material-icons-round">flag</text>
        </view>
        <view class="dog-detail__action-sheet-text">
          <text class="dog-detail__action-sheet-title">标记状态</text>
          <text class="dog-detail__action-sheet-desc">生病、康复等状态变更</text>
        </view>
      </view>
      <view class="dog-detail__action-sheet-sep" />
      <view class="dog-detail__action-sheet-item" @click="openDeleteConfirm">
        <view class="dog-detail__action-sheet-icon dog-detail__action-sheet-icon--red">
          <text class="material-icons-round">delete_outline</text>
        </view>
        <view class="dog-detail__action-sheet-text">
          <text class="dog-detail__action-sheet-title dog-detail__action-sheet-title--danger">删除犬只</text>
          <text class="dog-detail__action-sheet-desc">移入回收站，30天内可恢复</text>
        </view>
      </view>
    </view>

    <!-- ==================== D-6: 快速标记状态 Sheet ==================== -->
    <BSheet v-model:visible="showStatusSheet" title="标记状态">
      <view class="status-sheet__dog-info">
        <text class="status-sheet__dog-emoji">&#x1F436;</text>
        <text class="status-sheet__dog-name">{{ dog.name || '未命名' }}</text>
      </view>
      <view class="status-grid">
        <view class="status-card status-card--red" @click="selectIllness">
          <text class="status-card__emoji">&#x1F912;</text>
          <text class="status-card__label">生病</text>
          <view class="status-card__pills">
            <text class="status-card__pill">感冒</text>
            <text class="status-card__pill">腹泻</text>
            <text class="status-card__pill">皮肤病</text>
            <text class="status-card__pill">其他</text>
          </view>
        </view>
        <view class="status-card status-card--plum" @click="openMedication">
          <text class="status-card__emoji">&#x1F48A;</text>
          <text class="status-card__label">开始用药</text>
        </view>
        <view class="status-card status-card--green" @click="openRecoveryConfirm">
          <text class="status-card__emoji">&#x2705;</text>
          <text class="status-card__label">标记康复</text>
        </view>
        <view class="status-card status-card--amber" @click="openRetireConfirm">
          <text class="status-card__emoji">&#x1F3E5;</text>
          <text class="status-card__label">退休</text>
        </view>
      </view>
      <view class="status-sheet__cancel" @click="showStatusSheet = false">
        <text class="status-sheet__cancel-text">取消</text>
      </view>
    </BSheet>

    <!-- ==================== D-7: 退休确认 Modal ==================== -->
    <BModal
      v-model:visible="showRetireModal"
      title="标记退休"
      confirm-text="确认退休"
      @confirm="doRetire"
    >
      <view class="modal-form">
        <view class="modal-form__group">
          <text class="modal-form__label">退休日期 *</text>
          <picker mode="date" :value="retireDate" @change="retireDate = $event.detail.value">
            <view class="modal-form__input">
              <text class="modal-form__input-text">{{ retireDate }}</text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
        </view>
        <view class="modal-form__group">
          <text class="modal-form__label">退休原因（选填）</text>
          <input v-model="retireReason" class="modal-form__text-input" placeholder="如：年龄过大/健康问题..." />
        </view>
      </view>
    </BModal>

    <!-- ==================== D-8: 已故确认 Modal ==================== -->
    <BModal
      v-model:visible="showDeceasedModal"
      title="标记已故"
      confirm-text="确认"
      :danger="true"
      @confirm="doDeceased"
    >
      <text class="modal-desc">此操作将取消所有未完成的提醒任务。</text>
      <view class="modal-form">
        <view class="modal-form__group">
          <text class="modal-form__label">日期 *</text>
          <picker mode="date" :value="deceasedDate" @change="deceasedDate = $event.detail.value">
            <view class="modal-form__input">
              <text class="modal-form__input-text">{{ deceasedDate }}</text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
        </view>
        <view class="modal-form__group">
          <text class="modal-form__label">备注（可选）</text>
          <input v-model="deceasedCause" class="modal-form__text-input" placeholder="死因等信息" />
        </view>
      </view>
    </BModal>

    <!-- ==================== D-9: 领养表单 Sheet ==================== -->
    <BSheet v-model:visible="showAdoptionSheet" title="标记领养">
      <view class="sheet-form">
        <view class="sheet-form__group">
          <text class="sheet-form__label">领养日期 *</text>
          <picker mode="date" :value="adoptionDate" @change="adoptionDate = $event.detail.value">
            <view class="sheet-form__input">
              <text class="sheet-form__input-text">{{ adoptionDate }}</text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
        </view>
        <view class="sheet-form__group">
          <text class="sheet-form__label">领养说明（选填）</text>
          <input v-model="adoptionNotes" class="sheet-form__text-input" placeholder="备注信息..." />
        </view>
        <view class="sheet-form__group">
          <text class="sheet-form__label">领养费（选填）</text>
          <view class="sheet-form__price-input">
            <text class="sheet-form__price-symbol">¥</text>
            <input v-model="adoptionFee" class="sheet-form__price-value" type="digit" placeholder="0" />
          </view>
          <text class="sheet-form__helper">有领养费将自动录入一笔收入</text>
        </view>
        <view class="sheet-form__actions">
          <view class="sheet-form__btn sheet-form__btn--primary" @click="doAdoption">
            <text class="sheet-form__btn-text" style="color: #fff;">确认领养</text>
          </view>
          <view class="sheet-form__btn sheet-form__btn--cancel" @click="showAdoptionSheet = false">
            <text class="sheet-form__btn-text" style="color: var(--text-2);">取消</text>
          </view>
        </view>
      </view>
    </BSheet>

    <!-- ==================== D-10: 赠送表单 Sheet ==================== -->
    <BSheet v-model:visible="showGiftSheet" title="标记赠送">
      <view class="sheet-form">
        <view class="sheet-form__group">
          <text class="sheet-form__label">赠送日期 *</text>
          <picker mode="date" :value="giftDate" @change="giftDate = $event.detail.value">
            <view class="sheet-form__input">
              <text class="sheet-form__input-text">{{ giftDate }}</text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
        </view>
        <view class="sheet-form__group">
          <text class="sheet-form__label">受赠人信息（选填）</text>
          <input v-model="giftRecipient" class="sheet-form__text-input" placeholder="受赠人姓名或联系方式..." />
        </view>
        <view class="sheet-form__actions">
          <view class="sheet-form__btn sheet-form__btn--primary" @click="doGift">
            <text class="sheet-form__btn-text" style="color: #fff;">确认赠送</text>
          </view>
          <view class="sheet-form__btn sheet-form__btn--cancel" @click="showGiftSheet = false">
            <text class="sheet-form__btn-text" style="color: var(--text-2);">取消</text>
          </view>
        </view>
      </view>
    </BSheet>

    <!-- ==================== D-11: 取消退休确认 Modal ==================== -->
    <BModal
      v-model:visible="showCancelRetireModal"
      title="取消退休"
      content="确认恢复在养状态？犬只将重新回到活跃种狗列表中。"
      confirm-text="确认恢复"
      @confirm="doCancelRetire"
    />

    <!-- ==================== D-12: 幼崽升级为种狗确认 Modal ==================== -->
    <BModal
      v-model:visible="showPromoteModal"
      title="升级为种狗"
      content="确认将此幼崽升级为种狗？角色将从「幼崽」变更为「种狗」，去向变为「在养」。"
      confirm-text="确认升级"
      @confirm="doPromote"
    />

    <!-- ==================== D-13: 康复确认 Modal ==================== -->
    <BModal
      v-model:visible="showRecoveryModal"
      title="标记康复"
      confirm-text="确认康复"
      @confirm="doRecovery"
    >
      <text class="modal-desc">确认犬只已康复？将退出当前生病状态。</text>
      <view class="modal-form">
        <view class="modal-form__group">
          <text class="modal-form__label">康复日期</text>
          <picker mode="date" :value="recoveryDate" @change="recoveryDate = $event.detail.value">
            <view class="modal-form__input">
              <text class="modal-form__input-text">{{ recoveryDate }}</text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
        </view>
      </view>
    </BModal>

    <!-- ==================== D-14: 删除犬只确认 Modal ==================== -->
    <BDeleteConfirm
      v-model:visible="showDeleteModal"
      title="删除犬只"
      :content="`确认删除「${dog.name || '未命名'}」？删除后将移入回收站。`"
      @confirm="doDelete"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BModal from '@/components/layout/BModal.vue'
import BDeleteConfirm from '@/components/layout/BDeleteConfirm.vue'
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
const { run: updateDisposition } = useCloudCall('dog-service', 'updateDisposition', { successMessage: '操作成功' })
const { run: updateStatus } = useCloudCall('dog-service', 'updateStatus', { successMessage: '状态已更新' })
const { run: deleteDog } = useCloudCall('dog-service', 'deleteDog', { successMessage: '已删除' })
const { run: promoteToBreeeder } = useCloudCall('dog-service', 'promoteToBreeder', { successMessage: '已升级为种狗' })

// ==================== 工具函数 ====================

function formatDate(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayStr() {
  return formatDate(Date.now())
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

// ==================== D-6: 快速标记状态 ====================

const showStatusSheet = ref(false)

function openStatusSheet() {
  showMore.value = false
  showStatusSheet.value = true
}

function selectIllness() {
  showStatusSheet.value = false
  // 跳转到疾病记录表单
  uni.navigateTo({ url: `/pages/record/health?dogId=${dogId}&type=illness` })
}

function openMedication() {
  showStatusSheet.value = false
  uni.navigateTo({ url: `/pages/record/health?dogId=${dogId}&type=medication` })
}

// ==================== D-7: 退休确认 ====================

const showRetireModal = ref(false)
const retireDate = ref(todayStr())
const retireReason = ref('')

function openRetireConfirm() {
  showStatusSheet.value = false
  retireDate.value = todayStr()
  retireReason.value = ''
  showRetireModal.value = true
}

async function doRetire() {
  await updateDisposition(dogId, '已退休', {
    date: new Date(retireDate.value + 'T00:00:00+08:00').getTime(),
    reason: retireReason.value || null,
  })
  showRetireModal.value = false
  await loadData()
}

// ==================== D-8: 已故确认 ====================

const showDeceasedModal = ref(false)
const deceasedDate = ref(todayStr())
const deceasedCause = ref('')

async function doDeceased() {
  await updateDisposition(dogId, '已故', {
    date: new Date(deceasedDate.value + 'T00:00:00+08:00').getTime(),
    cause: deceasedCause.value || null,
  })
  showDeceasedModal.value = false
  await loadData()
}

// ==================== D-9: 领养表单 ====================

const showAdoptionSheet = ref(false)
const adoptionDate = ref(todayStr())
const adoptionNotes = ref('')
const adoptionFee = ref('')

async function doAdoption() {
  await updateDisposition(dogId, '已领养', {
    date: new Date(adoptionDate.value + 'T00:00:00+08:00').getTime(),
    notes: adoptionNotes.value || null,
    fee: adoptionFee.value ? Number(adoptionFee.value) : null,
  })
  showAdoptionSheet.value = false
  await loadData()
}

// ==================== D-10: 赠送表单 ====================

const showGiftSheet = ref(false)
const giftDate = ref(todayStr())
const giftRecipient = ref('')

async function doGift() {
  await updateDisposition(dogId, '已赠送', {
    date: new Date(giftDate.value + 'T00:00:00+08:00').getTime(),
    recipient: giftRecipient.value || null,
  })
  showGiftSheet.value = false
  await loadData()
}

// ==================== D-11: 取消退休 ====================

const showCancelRetireModal = ref(false)

async function doCancelRetire() {
  await updateDisposition(dogId, '在养', {})
  showCancelRetireModal.value = false
  await loadData()
}

// ==================== D-12: 幼崽升级为种狗 ====================

const showPromoteModal = ref(false)

async function doPromote() {
  await promoteToBreeeder(dogId)
  showPromoteModal.value = false
  await loadData()
}

// ==================== D-13: 康复确认 ====================

const showRecoveryModal = ref(false)
const recoveryDate = ref(todayStr())

function openRecoveryConfirm() {
  showStatusSheet.value = false
  recoveryDate.value = todayStr()
  showRecoveryModal.value = true
}

async function doRecovery() {
  await updateStatus(dogId, 'recover', {
    date: new Date(recoveryDate.value + 'T00:00:00+08:00').getTime(),
  })
  showRecoveryModal.value = false
  await loadData()
}

// ==================== D-14: 删除犬只 ====================

const showDeleteModal = ref(false)

function openDeleteConfirm() {
  showMore.value = false
  showDeleteModal.value = true
}

async function doDelete() {
  await deleteDog(dogId)
  showDeleteModal.value = false
  uni.navigateBack()
}

// ==================== 数据加载 ====================

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

/* ==================== D-6: 状态标记 Sheet ==================== */
.status-sheet__dog-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.status-sheet__dog-emoji {
  font-size: 20px;
}
.status-sheet__dog-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}
.status-card {
  padding: 14px;
  border-radius: var(--radius-card);
  cursor: pointer;
  transition: all 0.12s ease;
  &:active { transform: scale(0.96); }
}
.status-card--red { background: var(--red-soft); }
.status-card--plum { background: var(--plum-soft); }
.status-card--green { background: var(--green-soft); }
.status-card--amber { background: var(--amber-soft); }
.status-card__emoji {
  display: block;
  font-size: 24px;
  margin-bottom: 6px;
}
.status-card__label {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 6px;
}
.status-card__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.status-card__pill {
  padding: 3px 8px;
  border-radius: var(--radius-tag);
  font-size: 10px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-2);
}
.status-sheet__cancel {
  text-align: center;
  padding: 8px;
  margin-top: 4px;
}
.status-sheet__cancel-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
}

/* ==================== Modal 内表单样式 ==================== */
.modal-desc {
  display: block;
  font-size: 14px;
  color: var(--text-2);
  text-align: center;
  margin-bottom: 16px;
  line-height: 1.5;
}
.modal-form {
  margin-top: 4px;
}
.modal-form__group {
  margin-bottom: 14px;
  &:last-child { margin-bottom: 0; }
}
.modal-form__label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 6px;
}
.modal-form__input {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 14px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  background: var(--bg);
}
.modal-form__input-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.modal-form__text-input {
  width: 100%;
  height: 44px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  padding: 0 14px;
  font-size: 14px;
  color: var(--text-1);
  background: var(--bg);
}

/* ==================== Sheet 内表单样式 ==================== */
.sheet-form {
  padding-bottom: 16px;
}
.sheet-form__group {
  margin-bottom: 16px;
  &:last-child { margin-bottom: 0; }
}
.sheet-form__label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 8px;
}
.sheet-form__input {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 14px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  background: var(--bg);
}
.sheet-form__input-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.sheet-form__text-input {
  width: 100%;
  height: 44px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  padding: 0 14px;
  font-size: 14px;
  color: var(--text-1);
  background: var(--bg);
}
.sheet-form__price-input {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 44px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  padding: 0 14px;
  background: var(--bg);
}
.sheet-form__price-symbol {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-3);
}
.sheet-form__price-value {
  flex: 1;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  border: none;
  background: transparent;
}
.sheet-form__helper {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 6px;
}
.sheet-form__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}
.sheet-form__btn {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-btn);
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
}
.sheet-form__btn--primary {
  background: var(--primary);
}
.sheet-form__btn--cancel {
  background: var(--card-dim);
}
.sheet-form__btn-text {
  font-size: 15px;
  font-weight: 600;
}
</style>
