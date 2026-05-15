<template>
  <view>
    <BSheet v-model:visible="quickCompleteVisible" title="完成任务">
      <view class="form-sheet task-sheet">
        <view v-if="quickCompleteTask" class="task-sheet__info">
          <BIconBox icon="check_circle" color="green" :size="36" />
          <view class="task-sheet__info-text">
            <text class="task-sheet__task-title">{{ quickCompleteTask.title || '任务' }}</text>
            <text class="task-sheet__dog-name">{{ quickCompleteTask.dog_name || '' }}</text>
          </view>
        </view>
        <view class="form-sheet__field">
          <text class="form-sheet__label">备注（选填）</text>
          <input v-model="quickCompleteNotesModel" class="form-sheet__input" placeholder="添加备注..." />
        </view>
        <view class="form-sheet__field">
          <text class="form-sheet__label">完成日期</text>
          <view class="form-sheet__select" @click="$emit('open-quick-complete-date')">
            <text class="form-sheet__select-text">{{ quickCompleteDateStr }}</text>
            <text class="material-icons-round form-sheet__select-icon">calendar_today</text>
          </view>
        </view>
      </view>
      <template #footer>
        <view class="task-sheet__actions">
          <view class="task-sheet__btn task-sheet__btn--cancel" @click="quickCompleteVisible = false">
            <text style="color: var(--text-2); font-size: 14px; font-weight: 600;">取消</text>
          </view>
          <view class="task-sheet__btn task-sheet__btn--confirm" @click="$emit('confirm-quick-complete')">
            <text style="color: #fff; font-size: 14px; font-weight: 600;">确认完成</text>
          </view>
        </view>
      </template>
    </BSheet>

    <BSheet v-model:visible="postponeVisible" title="推迟任务">
      <view class="form-sheet task-sheet">
        <view v-if="postponeTaskInfo" class="postpone-info">
          <text class="postpone-info__text">{{ postponeTaskInfo.title ? postponeTaskInfo.dogName + ' · ' + postponeTaskInfo.title : postponeTaskInfo.dogName }}</text>
          <view v-if="postponeTaskInfo.isOverdue" class="postpone-info__tag">
            <text>逾期{{ postponeTaskInfo.overdueDays }}天</text>
          </view>
        </view>
        <view class="form-sheet__field">
          <text class="form-sheet__label">推迟到</text>
          <view class="form-sheet__select" @click="$emit('open-postpone-date')">
            <text class="form-sheet__select-text">{{ postponeDateStr }}</text>
            <text class="material-icons-round form-sheet__select-icon">calendar_today</text>
          </view>
          <view class="task-sheet__quick-dates">
            <view class="task-sheet__quick-date" :class="{ active: postponeQuick === 'tomorrow' }" @click="$emit('set-postpone-quick', 'tomorrow')"><text>明天</text></view>
            <view class="task-sheet__quick-date" :class="{ active: postponeQuick === 'dayAfter' }" @click="$emit('set-postpone-quick', 'dayAfter')"><text>后天</text></view>
            <view class="task-sheet__quick-date" :class="{ active: postponeQuick === 'nextWeek' }" @click="$emit('set-postpone-quick', 'nextWeek')"><text>下周</text></view>
          </view>
        </view>
      </view>
      <template #footer>
        <view class="task-sheet__actions">
          <view class="task-sheet__btn task-sheet__btn--cancel" @click="postponeVisible = false"><text style="color: var(--text-2); font-size: 14px; font-weight: 600;">取消</text></view>
          <view class="task-sheet__btn task-sheet__btn--confirm" @click="$emit('confirm-postpone')"><text style="color: #fff; font-size: 14px; font-weight: 600;">确认推迟</text></view>
        </view>
      </template>
    </BSheet>

    <BSheet v-model:visible="batchCompleteVisible" :title="batchCompleteTitle">
      <view class="task-sheet">
        <view class="task-sheet__select-bar">
          <view class="task-sheet__select-toggle" @click="$emit('toggle-select-all')">
            <view class="task-sheet__checkbox" :class="{ checked: isAllSelected }"><text v-if="isAllSelected" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text></view>
            <text class="task-sheet__select-label">{{ isAllSelected ? '取消全选' : '全选' }}（{{ batchSelectedCount }}/{{ batchDogList.length }}）</text>
          </view>
        </view>
        <scroll-view scroll-y class="task-sheet__dog-list">
          <view v-for="dog in batchDogList" :key="dog.id" class="task-sheet__dog-item" @click="$emit('toggle-batch-dog', dog.id)">
            <view class="task-sheet__checkbox" :class="{ checked: batchSelected[dog.id] }"><text v-if="batchSelected[dog.id]" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text></view>
            <view class="task-sheet__dog-avatar"><BEntityIcon :size="14" color="#fff" /></view>
            <text class="task-sheet__dog-name-text">{{ dog.name }}</text>
            <text v-if="dog.completed" class="task-sheet__done-badge">已完成</text>
          </view>
        </scroll-view>
        <view class="task-sheet__actions">
          <view class="task-sheet__btn task-sheet__btn--cancel" @click="batchCompleteVisible = false"><text style="color: var(--text-2); font-size: 14px; font-weight: 600;">取消</text></view>
          <view class="task-sheet__btn task-sheet__btn--confirm" :class="{ disabled: batchSelectedCount === 0 }" @click="$emit('confirm-batch-complete')"><text style="color: #fff; font-size: 14px; font-weight: 600;">完成（{{ batchSelectedCount }}）</text></view>
        </view>
      </view>
    </BSheet>

    <BSheet v-model:visible="sickBatchVisible" title="疾病批量操作">
      <view class="task-sheet">
        <view class="task-sheet__select-bar">
          <view class="task-sheet__select-toggle" @click="$emit('toggle-select-all-sick-batch')">
            <view class="task-sheet__checkbox" :class="{ checked: isAllSickBatchSelected }"><text v-if="isAllSickBatchSelected" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text></view>
            <text class="task-sheet__select-label">{{ isAllSickBatchSelected ? '取消全选' : '全选' }}（{{ sickBatchSelectedCount }}/{{ sickBatchList.length }}）</text>
          </view>
        </view>
        <scroll-view scroll-y class="task-sheet__dog-list">
          <view v-for="item in sickBatchList" :key="item.id" class="task-sheet__dog-item" @click="$emit('toggle-sick-batch-item', item.id)">
            <view class="task-sheet__checkbox" :class="{ checked: sickBatchSelected[item.id] }"><text v-if="sickBatchSelected[item.id]" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text></view>
            <view class="task-sheet__dog-avatar task-sheet__dog-avatar--illness"><text class="material-icons-round" style="color: #fff; font-size: 14px;">sick</text></view>
            <view class="task-sheet__dog-copy"><text class="task-sheet__dog-name-text">{{ item.name }}</text><text class="task-sheet__dog-detail-text">{{ item.illness }} · {{ item.treatmentStatus || '观察中' }} · 第{{ item.daysSick || 1 }}天</text></view>
          </view>
        </scroll-view>
        <view class="task-sheet__actions task-sheet__actions--triple">
          <view class="task-sheet__btn task-sheet__btn--sick-secondary" :class="{ disabled: sickBatchSelectedCount === 0 }" @click="$emit('confirm-sick-batch-action', 'recover')"><text class="task-sheet__btn-label task-sheet__btn-label--success">康复</text></view>
          <view class="task-sheet__btn task-sheet__btn--sick-warning" :class="{ disabled: sickBatchSelectedCount === 0 }" @click="$emit('confirm-sick-batch-action', 'update_status')"><text class="task-sheet__btn-label task-sheet__btn-label--warning">开始治疗</text></view>
          <view class="task-sheet__btn task-sheet__btn--sick-primary" :class="{ disabled: sickBatchSelectedCount === 0 }" @click="$emit('confirm-sick-batch-action', 'start_medication')"><text class="task-sheet__btn-label task-sheet__btn-label--primary">开始用药</text></view>
        </view>
      </view>
    </BSheet>

    <BSheet v-model:visible="medBatchVisible" title="今日用药批量操作">
      <view class="task-sheet">
        <view class="task-sheet__select-bar">
          <view class="task-sheet__select-toggle" @click="$emit('toggle-select-all-med-batch')">
            <view class="task-sheet__checkbox" :class="{ checked: isAllMedBatchSelected }"><text v-if="isAllMedBatchSelected" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text></view>
            <text class="task-sheet__select-label">{{ isAllMedBatchSelected ? '取消全选' : '全选' }}（{{ medBatchSelectedCount }}/{{ medBatchList.length }}）</text>
          </view>
        </view>
        <scroll-view scroll-y class="task-sheet__dog-list">
          <view v-for="item in medBatchList" :key="item.id" class="task-sheet__dog-item" @click="$emit('toggle-med-batch-item', item.id)">
            <view class="task-sheet__checkbox" :class="{ checked: medBatchSelected[item.id] }"><text v-if="medBatchSelected[item.id]" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text></view>
            <view class="task-sheet__dog-avatar task-sheet__dog-avatar--plum"><text class="material-icons-round" style="color: #fff; font-size: 14px;">medication</text></view>
            <view class="task-sheet__dog-copy"><text class="task-sheet__dog-name-text">{{ item.name }}</text><text class="task-sheet__dog-detail-text">{{ item.detail }}</text></view>
          </view>
        </scroll-view>
        <view class="task-sheet__actions">
          <view class="task-sheet__btn task-sheet__btn--sick-secondary" :class="{ disabled: medBatchRecoverCount === 0 }" @click="$emit('confirm-med-batch-recover')"><text class="task-sheet__btn-label task-sheet__btn-label--success">批量康复</text></view>
          <view class="task-sheet__btn task-sheet__btn--sick-primary" :class="{ disabled: medBatchSelectedCount === 0 }" @click="$emit('confirm-med-batch-complete')"><text class="task-sheet__btn-label task-sheet__btn-label--primary">完成今日用药</text></view>
        </view>
      </view>
    </BSheet>

    <BSheet v-model:visible="breedingActionVisible" :title="breedingActionCard?.dogName || '繁育流程'">
      <view class="breeding-action-sheet">
        <view v-if="breedingActionCard" class="breeding-action-sheet__context">
          <view class="breeding-action-sheet__badge"><BEntityIcon :role="breedingActionCard?.role" color="var(--amber)" :size="18" /></view>
          <view class="breeding-action-sheet__copy">
            <view class="breeding-action-sheet__meta-row"><text class="breeding-action-sheet__eyebrow">当前阶段</text><text v-if="breedingActionSummary.stageTag" class="breeding-action-sheet__status">{{ breedingActionSummary.stageTag }}</text></view>
            <text class="breeding-action-sheet__title">{{ breedingActionStageTitle || '繁育流程' }}</text>
            <text class="breeding-action-sheet__primary">{{ breedingActionSummary.primaryLabel || '时间待确认' }}</text>
            <text v-if="breedingActionSummary.secondaryLabel" class="breeding-action-sheet__sub">{{ breedingActionSummary.secondaryLabel }}</text>
            <text v-if="breedingActionSummary.alertLabel" class="breeding-action-sheet__alert" :class="{ 'breeding-action-sheet__alert--danger': breedingActionAlertDanger }">{{ breedingActionSummary.alertLabel }}</text>
          </view>
        </view>
        <view class="breeding-action-sheet__list">
          <view v-for="item in breedingActionItems" :key="item.key" class="breeding-action-sheet__item" :class="`breeding-action-sheet__item--${item.tone}`" @click="$emit('select-breeding-action', item.key)">
            <view class="breeding-action-sheet__icon-wrap" :class="`breeding-action-sheet__icon-wrap--${item.tone}`" :style="{ background: item.iconBg }"><text class="material-icons-round breeding-action-sheet__icon" :class="`breeding-action-sheet__icon--${item.tone}`" :style="{ color: item.iconColor }">{{ item.icon }}</text></view>
            <view class="breeding-action-sheet__item-copy"><text class="breeding-action-sheet__label">{{ item.label }}</text><text class="breeding-action-sheet__hint">{{ item.description }}</text></view>
            <text class="material-icons-round breeding-action-sheet__arrow">arrow_forward</text>
          </view>
        </view>
      </view>
    </BSheet>

    <BSheet v-model:visible="sickMenuVisible" :title="sickMenuDog?.dogName || ''">
      <view class="sick-menu-body">
        <view v-for="(item, idx) in sickMenuItems" :key="idx" class="sick-menu-item" :class="`sick-menu-item--${getSickMenuTone(item.action)}`" @click="$emit('select-sick-menu', item)">
          <view class="sick-menu-item__icon-wrap" :class="`sick-menu-item__icon-wrap--${getSickMenuTone(item.action)}`"><text class="material-icons-round sick-menu-item__icon" :class="`sick-menu-item__icon--${getSickMenuTone(item.action)}`">{{ item.icon }}</text></view>
          <text class="sick-menu-item__label">{{ item.label }}</text>
        </view>
      </view>
    </BSheet>

    <BSheet v-model:visible="stopConfirmVisible" title="">
      <view class="stop-confirm-body">
        <view class="stop-confirm-icon-wrap"><text class="material-icons-round stop-confirm-icon">medication_liquid</text></view>
        <text class="stop-confirm-title">停止用药</text>
        <text class="stop-confirm-desc">确定停止 <text class="stop-confirm-bold">{{ stopConfirmData?.dogName }}</text> 的 <text class="stop-confirm-bold">{{ stopConfirmData?.drugName || '用药' }}</text> 吗？</text>
        <text class="stop-confirm-sub">{{ [stopConfirmData?.dosageStr, stopConfirmData?.progress].filter(Boolean).join(' · ') }}{{ stopConfirmData?.progress ? ' · 剩余任务将被取消' : '剩余用药任务将被取消' }}</text>
        <view class="stop-confirm-actions">
          <view class="stop-confirm-btn stop-confirm-btn--cancel" @click="stopConfirmVisible = false"><text>继续用药</text></view>
          <view class="stop-confirm-btn stop-confirm-btn--danger" @click="$emit('confirm-stop-medication')"><text style="color: #fff;">确认停止</text></view>
        </view>
      </view>
    </BSheet>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BSheet from '@/components/layout/BSheet.vue'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BIconBox from '@/components/base/BIconBox.vue'
import type { HomeBreedingActionKey } from '@/utils/homeBreedingActions'

type BatchDogSelectionItem = { id: string; name: string; completed: boolean; taskId?: string }
type SickBatchAction = 'recover' | 'update_status' | 'start_medication'

const props = defineProps<{
  showQuickComplete: boolean
  quickCompleteTask: any
  quickCompleteNotes: string
  quickCompleteDateStr: string
  showPostponeModal: boolean
  postponeTaskInfo: any
  postponeDateStr: string
  postponeQuick: string
  showBatchComplete: boolean
  batchCompleteTitle: string
  batchDogList: BatchDogSelectionItem[]
  batchSelected: Record<string, boolean>
  batchSelectedCount: number
  isAllSelected: boolean
  showSickBatch: boolean
  sickBatchList: any[]
  sickBatchSelected: Record<string, boolean>
  sickBatchSelectedCount: number
  isAllSickBatchSelected: boolean
  showMedBatch: boolean
  medBatchList: any[]
  medBatchSelected: Record<string, boolean>
  medBatchSelectedCount: number
  medBatchRecoverCount: number
  isAllMedBatchSelected: boolean
  showBreedingActionSheet: boolean
  breedingActionCard: any
  breedingActionSummary: any
  breedingActionStageTitle: string
  breedingActionAlertDanger: boolean
  breedingActionItems: any[]
  showSickMenu: boolean
  sickMenuDog: any
  sickMenuItems: any[]
  showStopConfirm: boolean
  stopConfirmData: any
}>()

const emit = defineEmits<{
  (event: 'update:showQuickComplete', value: boolean): void
  (event: 'update:quickCompleteNotes', value: string): void
  (event: 'update:showPostponeModal', value: boolean): void
  (event: 'update:showBatchComplete', value: boolean): void
  (event: 'update:showSickBatch', value: boolean): void
  (event: 'update:showMedBatch', value: boolean): void
  (event: 'update:showBreedingActionSheet', value: boolean): void
  (event: 'update:showSickMenu', value: boolean): void
  (event: 'update:showStopConfirm', value: boolean): void
  (event: 'open-quick-complete-date'): void
  (event: 'open-postpone-date'): void
  (event: 'confirm-quick-complete'): void
  (event: 'set-postpone-quick', value: string): void
  (event: 'confirm-postpone'): void
  (event: 'toggle-select-all'): void
  (event: 'toggle-batch-dog', id: string): void
  (event: 'confirm-batch-complete'): void
  (event: 'toggle-select-all-sick-batch'): void
  (event: 'toggle-sick-batch-item', id: string): void
  (event: 'confirm-sick-batch-action', action: SickBatchAction): void
  (event: 'toggle-select-all-med-batch'): void
  (event: 'toggle-med-batch-item', id: string): void
  (event: 'confirm-med-batch-recover'): void
  (event: 'confirm-med-batch-complete'): void
  (event: 'select-breeding-action', key: HomeBreedingActionKey): void
  (event: 'select-sick-menu', item: any): void
  (event: 'confirm-stop-medication'): void
}>()

const quickCompleteVisible = model('showQuickComplete', 'update:showQuickComplete')
const quickCompleteNotesModel = model('quickCompleteNotes', 'update:quickCompleteNotes')
const postponeVisible = model('showPostponeModal', 'update:showPostponeModal')
const batchCompleteVisible = model('showBatchComplete', 'update:showBatchComplete')
const sickBatchVisible = model('showSickBatch', 'update:showSickBatch')
const medBatchVisible = model('showMedBatch', 'update:showMedBatch')
const breedingActionVisible = model('showBreedingActionSheet', 'update:showBreedingActionSheet')
const sickMenuVisible = model('showSickMenu', 'update:showSickMenu')
const stopConfirmVisible = model('showStopConfirm', 'update:showStopConfirm')

function model(prop: keyof typeof props, event: string) {
  return computed({
    get: () => props[prop] as any,
    set: value => emit(event as any, value),
  })
}

function getSickMenuTone(action?: string) {
  if (action === 'recover') return 'success'
  if (action === 'start_medication') return 'plum'
  return 'illness'
}
</script>

<style lang="scss" scoped>
.task-sheet { display: flex; flex-direction: column; gap: 16px; padding-bottom: 12px; }
.task-sheet__info { display: flex; align-items: center; gap: 12px; padding: 4px 0 8px; }
.task-sheet__info-text { flex: 1; }
.task-sheet__task-title { display: block; font-size: 15px; font-weight: 700; color: var(--text-1); }
.task-sheet__dog-name { display: block; font-size: 13px; color: var(--text-2); margin-top: 2px; }
.postpone-info { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--card-dim); border-radius: 12px; margin-bottom: 16px; }
.postpone-info__text { flex: 1; font-size: 14px; font-weight: 600; color: var(--text-1); }
.postpone-info__tag { padding: 2px 8px; border-radius: 999px; background: var(--red-soft); font-size: 11px; font-weight: 700; color: var(--red); }
.task-sheet__quick-dates { display: flex; gap: 8px; }
.task-sheet__quick-date { padding: 6px 14px; border-radius: var(--radius-btn); background: var(--card-dim); font-size: 13px; font-weight: 600; color: var(--text-2); transition: all 0.12s ease; &:active { transform: scale(0.92); } &.active { background: var(--primary); color: #fff; box-shadow: 0 2px 8px rgba(234, 62, 119, 0.25); } }
.task-sheet__actions { display: flex; gap: 12px; margin-top: 4px; }
.task-sheet__actions--triple { gap: 8px; }
.task-sheet__btn { flex: 1; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-btn); transition: transform 0.12s ease, opacity 0.12s ease; &:active { transform: scale(0.94); opacity: 0.85; } &--cancel { background: var(--card-dim); } &--confirm { background: var(--primary); } &--warning { background: var(--amber); } &.disabled { opacity: 0.4; pointer-events: none; } }
.task-sheet__btn-label { font-size: 14px; font-weight: 700; letter-spacing: 0.2px; &--success { color: #2f8f68; } &--warning { color: #fff; } &--primary { color: #fff; } }
.task-sheet__btn--sick-secondary { background: linear-gradient(180deg, rgba(72, 190, 137, 0.14), rgba(72, 190, 137, 0.08)); border: 1px solid rgba(72, 190, 137, 0.18); }
.task-sheet__btn--sick-warning { background: linear-gradient(180deg, #f3b45a, #eda342); box-shadow: 0 6px 14px rgba(237, 163, 66, 0.18); }
.task-sheet__btn--sick-primary { background: linear-gradient(135deg, rgba(147, 102, 201, 0.96), rgba(119, 86, 188, 0.96)); box-shadow: 0 8px 18px rgba(132, 94, 194, 0.2); }
.task-sheet__select-bar { padding: 4px 0; }
.task-sheet__select-toggle { display: flex; align-items: center; gap: 10px; transition: transform 0.12s ease; &:active { transform: scale(0.95); } }
.task-sheet__select-label { font-size: 14px; font-weight: 600; color: var(--text-2); }
.task-sheet__checkbox { width: 20px; height: 20px; border-radius: var(--radius-checkbox); border: 2px solid var(--text-4); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s ease, border-color 0.15s ease; &.checked { background: var(--green); border-color: var(--green); } }
.task-sheet__dog-list { max-height: 280px; }
.task-sheet__dog-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(216, 203, 189, 0.2); transition: transform 0.12s ease; &:active { transform: scale(0.97); } &:last-child { border-bottom: none; } }
.task-sheet__dog-avatar { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, var(--rose), var(--amber)); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.task-sheet__dog-avatar--illness { background: linear-gradient(135deg, var(--red), #ef8d70); }
.task-sheet__dog-avatar--plum { background: linear-gradient(135deg, var(--plum), #8e7de2); }
.task-sheet__dog-copy { flex: 1; min-width: 0; }
.task-sheet__dog-name-text { display: block; font-size: 14px; font-weight: 600; color: var(--text-1); }
.task-sheet__dog-detail-text { display: block; margin-top: 2px; font-size: 11px; color: var(--text-3); }
.task-sheet__done-badge { font-size: 11px; font-weight: 600; color: var(--green); background: var(--green-soft); padding: 2px 8px; border-radius: var(--radius-tag); }
.breeding-action-sheet { padding: 2px 0 16px; }
.breeding-action-sheet__context { display: flex; align-items: center; gap: 10px; margin: 0 12px 14px; padding: 10px 12px; border-radius: 16px; background: linear-gradient(180deg, rgba(255, 249, 240, 0.94), rgba(255, 246, 235, 0.88)); border: 1px solid rgba(232, 155, 62, 0.1); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7); }
.breeding-action-sheet__badge { width: 34px; height: 34px; border-radius: 12px; background: linear-gradient(180deg, rgba(242, 167, 62, 0.16), rgba(242, 167, 62, 0.1)); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.breeding-action-sheet__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.breeding-action-sheet__meta-row { display: flex; align-items: center; gap: 8px; }
.breeding-action-sheet__eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.3px; color: var(--text-3); }
.breeding-action-sheet__title { font-size: 14px; font-weight: 700; color: var(--text-1); }
.breeding-action-sheet__status { display: inline-flex; align-items: center; min-height: 18px; padding: 0 7px; border-radius: 999px; background: rgba(242, 167, 62, 0.12); color: var(--amber); font-size: 10px; font-weight: 700; flex-shrink: 0; }
.breeding-action-sheet__primary { font-size: 13px; font-weight: 700; line-height: 1.35; color: var(--text-1); }
.breeding-action-sheet__sub { display: block; font-size: 11px; line-height: 1.4; color: var(--text-3); }
.breeding-action-sheet__alert { display: block; font-size: 11px; font-weight: 700; line-height: 1.4; color: var(--text-3); }
.breeding-action-sheet__alert--danger { color: var(--red); }
.breeding-action-sheet__list { display: flex; flex-direction: column; gap: 10px; }
.breeding-action-sheet__item { display: flex; align-items: center; gap: 12px; margin: 0 12px; min-height: 68px; padding: 0 16px; border-radius: 16px; border: 1px solid rgba(216, 203, 189, 0.2); background: rgba(255, 255, 255, 0.96); transition: transform 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease; &:active { transform: scale(0.98); opacity: 0.9; } &--primary { background: linear-gradient(135deg, #f3b45a, #eaa552); border-color: rgba(232, 155, 62, 0.2); box-shadow: 0 12px 22px rgba(232, 155, 62, 0.18); } &--amber { border-color: rgba(242, 167, 62, 0.16); box-shadow: 0 4px 12px rgba(242, 167, 62, 0.06); } &--rose { border-color: rgba(234, 62, 119, 0.14); box-shadow: 0 4px 12px rgba(234, 62, 119, 0.05); } &--blue { border-color: rgba(78, 150, 226, 0.14); box-shadow: 0 4px 12px rgba(78, 150, 226, 0.05); } &--green { border-color: rgba(72, 190, 137, 0.14); box-shadow: 0 4px 12px rgba(72, 190, 137, 0.05); } }
.breeding-action-sheet__icon-wrap { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; .breeding-action-sheet__item--primary & { background: rgba(255, 255, 255, 0.22); } }
.breeding-action-sheet__icon { font-size: 18px; }
.breeding-action-sheet__item-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.breeding-action-sheet__label { font-size: 15px; font-weight: 700; color: var(--text-1); .breeding-action-sheet__item--primary & { color: #fff; } }
.breeding-action-sheet__hint { font-size: 11px; line-height: 1.35; color: var(--text-3); .breeding-action-sheet__item--primary & { color: rgba(255, 255, 255, 0.82); } }
.breeding-action-sheet__arrow { font-size: 18px; color: var(--text-4); flex-shrink: 0; .breeding-action-sheet__item--primary & { color: rgba(255, 255, 255, 0.86); } }
.sick-menu-body { padding: 4px 0 16px; }
.sick-menu-item { display: flex; align-items: center; gap: 14px; margin: 0 12px 8px; padding: 14px 16px; border-radius: 16px; border: 1px solid transparent; transition: transform 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease; &:last-child { margin-bottom: 0; } &:active { transform: scale(0.98); opacity: 0.9; } &--success { background: linear-gradient(180deg, rgba(72, 190, 137, 0.12), rgba(72, 190, 137, 0.06)); border-color: rgba(72, 190, 137, 0.14); } &--illness { background: linear-gradient(180deg, rgba(224, 82, 82, 0.1), rgba(224, 82, 82, 0.05)); border-color: rgba(224, 82, 82, 0.12); } &--plum { background: linear-gradient(180deg, rgba(147, 102, 201, 0.12), rgba(147, 102, 201, 0.06)); border-color: rgba(132, 94, 194, 0.14); box-shadow: 0 8px 18px rgba(132, 94, 194, 0.08); } }
.sick-menu-item__icon-wrap { width: 34px; height: 34px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; &--success { background: rgba(72, 190, 137, 0.14); } &--illness { background: rgba(224, 82, 82, 0.12); } &--plum { background: rgba(147, 102, 201, 0.14); } }
.sick-menu-item__icon { font-size: 18px; &--success { color: #2f8f68; } &--illness { color: var(--red); } &--plum { color: var(--plum); } }
.sick-menu-item__label { font-size: 15px; font-weight: 600; color: var(--text-1); }
.stop-confirm-body { padding: 4px 20px 24px; text-align: center; }
.stop-confirm-icon-wrap { width: 52px; height: 52px; border-radius: 16px; background: var(--red-soft); margin: 0 auto 14px; display: flex; align-items: center; justify-content: center; }
.stop-confirm-icon { font-size: 26px; color: var(--red); }
.stop-confirm-title { display: block; font-size: 18px; font-weight: 800; color: var(--text-1); font-family: var(--font-display); margin-bottom: 10px; }
.stop-confirm-desc { display: block; font-size: 15px; color: var(--text-2); line-height: 1.6; }
.stop-confirm-bold { font-weight: 700; color: var(--text-1); }
.stop-confirm-sub { display: block; font-size: 13px; color: var(--text-3); margin-top: 6px; }
.stop-confirm-actions { display: flex; gap: 12px; margin-top: 24px; }
.stop-confirm-btn { flex: 1; padding: 14px; border-radius: 14px; text-align: center; font-size: 15px; font-weight: 700; transition: transform 0.12s, opacity 0.12s; &:active { transform: scale(0.96); opacity: 0.85; } &--cancel { background: var(--card-dim); color: var(--text-2); } &--danger { background: var(--red); color: #fff; } }
</style>
