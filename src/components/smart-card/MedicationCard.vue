<!--
  MedicationCard — 今日用药卡
  展示需要今日用药的犬只：sick_with_med / med_only
  支持多药展开（点行主体展开/折叠）和计次给药（每次给药点一下，达到 frequency 自动完成）
-->
<template>
  <view class="card card--plum">
    <view class="card-header">
      <view class="card-icon card-icon--plum">
        <text class="material-icons-round" style="font-size: 20px; color: var(--plum);">medication</text>
      </view>
      <view class="card-title-area">
        <text class="card-name">{{ card.groupTitle || '今日用药' }}</text>
        <text class="card-sub">{{ card.dogs?.length || 0 }}只犬</text>
      </view>
      <view v-if="medDogCount > 0" class="fraction-badge">
        <text class="fraction-badge-text">{{ doneCount }}/{{ medDogCount }}</text>
      </view>
    </view>

    <view class="health-list">
      <template v-for="dog in actionableDogs" :key="dog.dogId">
        <!-- 主行：点击行主体展开/折叠（多药时）-->
        <view
          class="health-row"
          :class="{ 'health-row--done': dogState(dog) === 'done' }"
          @click="onRowClick(dog)"
        >
          <!-- 左侧：给药按钮（高频单药）/ 三态 checkbox（其余）-->
          <template v-if="dogState(dog) === 'done'">
            <view class="cb-box cb-box--done">
              <text class="cb-check">✓</text>
            </view>
          </template>
          <template v-else-if="isHighFreq(dog)">
            <!-- 单药但每日多次：显示计次给药按钮 -->
            <view class="give-btn" @click.stop="onGiveDose(dog.allMedTasks[0])">
              <text class="give-btn__label">给药</text>
              <text class="give-btn__count">{{ getLocalDoses(dog.allMedTasks[0]._id, dog.allMedTasks[0].doses_given) }}/{{ dog.allMedTasks[0].details?.frequency }}次</text>
            </view>
          </template>
          <template v-else>
            <!-- 单药 freq=1 或多药：三态 checkbox（□ / − / ✓）-->
            <view
              class="cb-box"
              :class="dogState(dog) === 'partial' ? 'cb-box--partial' : 'cb-box--empty'"
              @click.stop="onMainCb(dog)"
            >
              <text v-if="dogState(dog) === 'partial'" class="cb-check">—</text>
            </view>
          </template>

          <!-- 犬只名 -->
          <text class="health-row__name">{{ dog.dogName }}</text>

          <!-- 信息区 -->
          <view class="health-row__info">
            <template v-if="dog.state === 'sick_with_med'">
              <text class="health-row__illness">{{ dog.illnessNames || dog.illness }}</text>
              <text v-if="relationLabel(dog)" class="health-row__badge health-row__badge--plum">{{ relationLabel(dog) }}</text>
              <text v-if="dog.treatmentStatus" class="health-row__badge health-row__badge--amber">{{ dog.treatmentStatus }}</text>
            </template>
            <text class="health-row__drug">{{ dog.drugName }}</text>
            <text v-if="dog.state !== 'sick_with_med' && relationLabel(dog)" class="health-row__meta health-row__meta--relation">{{ relationLabel(dog) }}</text>
            <!-- 单药：内联显示详情 -->
            <template v-if="!hasMultiDrug(dog)">
              <text v-if="dog.dosageStr" class="health-row__dosage">{{ dog.dosageStr }}</text>
              <text v-if="dog.progress" class="health-row__tag">{{ dog.progress }}</text>
              <text v-if="dog.methodFreq" class="health-row__meta">{{ dog.methodFreq }}</text>
            </template>
          </view>

          <!-- 多药展开箭头 -->
          <text v-if="hasMultiDrug(dog)" class="health-row__chevron material-icons-round">
            {{ expandedDogs.has(dog.dogId) ? 'expand_less' : 'expand_more' }}
          </text>

          <!-- 动作按钮（未完成时显示）-->
          <template v-if="dogState(dog) !== 'done'">
            <view v-if="dog.state === 'sick_with_med'" class="health-row__action" @click.stop="onSickAction(dog)">
              <text class="health-row__action-text">康复</text>
              <text class="material-icons-round health-row__action-icon">chevron_right</text>
            </view>
            <view v-else-if="dog.state === 'med_only'" class="health-row__action health-row__action--stop" @click.stop="onStopMedication(dog)">
              <text class="health-row__action-text health-row__action-text--stop">停药</text>
              <text class="material-icons-round health-row__action-icon health-row__action-icon--stop">chevron_right</text>
            </view>
          </template>
        </view>

        <!-- 展开子行（多药时）-->
        <template v-if="hasMultiDrug(dog) && expandedDogs.has(dog.dogId)">
          <view
            v-for="task in dog.allMedTasks"
            :key="task._id"
            class="health-sub-row"
            :class="{ 'health-sub-row--done': isTaskDone(task) }"
          >
            <!-- 已完成标记 or 给药按钮 -->
            <view v-if="isTaskDone(task)" class="sub-done">
              <text class="sub-done__check">✓</text>
            </view>
            <view v-else class="give-btn give-btn--sm" @click="onGiveDose(task)">
              <text class="give-btn__label">给药</text>
              <text v-if="(task.details?.frequency || 1) > 1" class="give-btn__count">
                {{ getLocalDoses(task._id, task.doses_given) }}/{{ task.details.frequency }}次
              </text>
            </view>

            <!-- 药品信息 -->
            <text class="sub-row__drug">{{ task.details?.drug_name }}</text>
            <text v-if="task.dosageStr" class="sub-row__dosage">{{ task.dosageStr }}</text>
            <text v-if="task.progress" class="sub-row__tag">{{ task.progress }}</text>
            <text v-if="task.methodFreq" class="sub-row__meta">{{ task.methodFreq }}</text>
          </view>
        </template>
      </template>
    </view>

    <!-- 底部按钮（有未完成任务时显示）-->
    <view v-if="hasPendingMed && !acting" class="card-actions__btns">
      <view class="btn btn--filled btn--plum" @click="batchComplete">
        <text class="material-icons-round btn-icon btn-icon--white">check_circle</text>
        <text class="btn-text btn-text--white">完成</text>
      </view>
      <view class="btn btn--ghost-plum" @click="showBatchActions">
        <text class="btn-text btn-text--plum">批量操作</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  getMedicationTodayProgress,
  hasMedicationMissedHistory,
  startOfMedicationDay,
} from '@/utils/medicationState'

const props = defineProps<{ card: any }>()
const emit = defineEmits<{
  (e: 'complete', taskId: string, allDone?: boolean): void
  (e: 'batch-complete-med', medicationTaskIds: string[]): void
  (e: 'action', payload: { type: string; data: any }): void
  (e: 'record-dose', payload: { medicationTaskId: string }): void
}>()

// 防止重复点击
const acting = ref(false)

// 展开/折叠状态
const expandedDogs = ref(new Set<string>())

// 乐观 doses 计数（在后端刷新前提供即时反馈）
const localDoses = ref(new Map<string, number>())
const todayTs = startOfMedicationDay(Date.now())

function getLocalDoses(taskId: string, baseDoses: number): number {
  return localDoses.value.has(taskId) ? localDoses.value.get(taskId)! : (baseDoses || 0)
}

// 用药犬只列表（sick_with_med + med_only）
const actionableDogs = computed(() => props.card.dogs || [])

// --- 状态判断 ---

function isTaskDone(task: any): boolean {
  return getTaskTodayProgress(task) === 'done'
}

function getTaskTodayProgress(task: any): 'empty' | 'partial' | 'done' {
  return getMedicationTodayProgress(task, {
    todayTs,
    localTodayDoses: getLocalDoses(task._id, task.doses_given || 0),
  })
}

function hasTaskMissed(task: any): boolean {
  return hasMedicationMissedHistory(task, { todayTs })
}

function dogState(dog: any): 'empty' | 'partial' | 'done' {
  const allTasks: any[] = dog.allMedTasks || []
  if (allTasks.length === 0) {
    // 旧数据兼容：没有 allMedTasks 时退回 completed 字段
    return dog.completed ? 'done' : 'empty'
  }
  const progressStates = allTasks.map(task => getTaskTodayProgress(task))
  if (progressStates.every(state => state === 'done')) return 'done'
  if (progressStates.some(state => state !== 'empty')) return 'partial'
  return 'empty'
}

function hasDogMissed(dog: any): boolean {
  const allTasks: any[] = dog.allMedTasks || []
  return allTasks.some(task => hasTaskMissed(task))
}

function dogStatusLabel(dog: any): string {
  if (hasDogMissed(dog)) return '漏服'
  const state = dogState(dog)
  if (state === 'partial') return '部分完成'
  if (state === 'empty') return '待完成'
  return '已完成'
}

function taskStatusLabel(task: any): string {
  if (hasTaskMissed(task)) return '漏服'
  const progress = getTaskTodayProgress(task)
  if (progress === 'partial') return '部分完成'
  if (progress === 'empty') return '待完成'
  return '已完成'
}

function relationLabel(dog: any): string {
  if (dog?.relationType === 'linked') return '关联疾病'
  if (dog?.relationType === 'fallback') return '推断关联'
  return '独立用药'
}

function hasMultiDrug(dog: any): boolean {
  return Array.isArray(dog.allMedTasks) && dog.allMedTasks.length > 1
}

function isHighFreq(dog: any): boolean {
  if (hasMultiDrug(dog)) return false
  const task = dog.allMedTasks?.[0]
  return !!task && (task.details?.frequency || 1) > 1
}

// --- 交互 ---

function onRowClick(dog: any) {
  if (hasMultiDrug(dog)) toggleExpand(dog.dogId)
}

function toggleExpand(dogId: string) {
  if (expandedDogs.value.has(dogId)) {
    expandedDogs.value.delete(dogId)
  } else {
    expandedDogs.value.add(dogId)
  }
}

function onMainCb(dog: any) {
  if (dogState(dog) === 'done') return
  const allTasks: any[] = dog.allMedTasks || []
  if (allTasks.length === 0) return
  const pendingTasks = allTasks.filter(t => !isTaskDone(t))
  // 乐观更新：本地立即标记该犬所有用药为已完成
  for (const t of pendingTasks) {
    localDoses.value.set(t._id, t.details?.frequency || 1)
  }
  // 批量完成该犬的所有用药
  const medIds = pendingTasks.map(t => t._id)
  if (medIds.length > 0) {
    emit('batch-complete-med', medIds)
  }
}

function onGiveDose(task: any) {
  if (isTaskDone(task)) return
  // 乐观更新
  const current = getLocalDoses(task._id, task.doses_given || 0)
  localDoses.value.set(task._id, current + 1)
  emit('record-dose', { medicationTaskId: task._id })
}

function onSickAction(dog: any) {
  const items: { icon: string; label: string; action: string }[] = [
    { icon: 'check_circle', label: '标记康复', action: 'recover' },
  ]
  if (dog.treatmentStatus === '观察中') {
    items.push({ icon: 'medical_services', label: '开始治疗', action: 'update_status' })
  }
  emit('action', { type: 'show_sick_menu', data: { dog, items } })
}

function onStopMedication(dog: any) {
  emit('action', { type: 'show_stop_confirm', data: { dogId: dog.dogId, dogName: dog.dogName, drugName: dog.drugName, dosageStr: dog.dosageStr, progress: dog.progress } })
}

// --- 底部按钮 ---

const medDogCount = computed(() => (props.card.dogs || []).length)
const doneCount = computed(() =>
  (props.card.dogs || []).filter((d: any) => dogState(d) === 'done').length
)
const hasPendingMed = computed(() => doneCount.value < medDogCount.value)

function batchComplete() {
  if (acting.value) return
  acting.value = true

  // 乐观更新：同时勾选所有未完成犬只
  const undone = (props.card.dogs || []).filter((d: any) => dogState(d) !== 'done')
  for (const dog of undone) {
    const allTasks: any[] = dog.allMedTasks || []
    for (const t of allTasks) {
      if (!isTaskDone(t)) {
        localDoses.value.set(t._id, t.details?.frequency || 1)
      }
    }
  }

  // 收集所有活跃的 medication_task IDs
  const medIds = props.card.medicationTaskIds || []
  setTimeout(() => {
    emit('batch-complete-med', medIds)
  }, 120)
}

function showBatchActions() {
  emit('action', { type: 'show_med_batch', data: { dogs: props.card.dogs || [], medicationTaskIds: props.card.medicationTaskIds || [] } })
}
</script>

<style lang="scss" scoped>
.card {
  position: relative; background: var(--card); border-radius: 16px;
  padding: 16px 16px 16px 18px; border-left: 3.5px solid transparent;
  box-shadow: var(--shadow); overflow: hidden;
  &::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; }
  > * { position: relative; z-index: 1; }
  &--plum { border-left-color: var(--plum); &::before { background: linear-gradient(135deg, var(--plum-soft) 0%, transparent 40%); } }
}

.card-header { display: flex; align-items: flex-start; gap: 12px; }
.card-icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  &--plum { background: var(--icon-plum); }
}
.card-title-area { flex: 1; }
.card-name { display: block; font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text-1); }
.card-sub { display: block; font-size: 12px; color: var(--text-2); margin-top: 1px; }

.fraction-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--plum-soft);
  min-width: 44px;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
}
.fraction-badge-text { font-family: var(--font-display); font-size: 13px; font-weight: 800; line-height: 1; color: var(--plum); }

/* 健康列表 */
.health-list { display: flex; flex-direction: column; gap: 0; margin-top: 10px; }

/* 主行 */
.health-row {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 0;
  border-bottom: 0.5px solid var(--card-dim);
  &:last-child { border-bottom: none; }
}
.health-row--done { opacity: 0.45; }
.health-row--done .health-row__name { text-decoration: line-through; }
.health-row__name {
  font-size: 13px; font-weight: 700; color: var(--text-1);
  width: 40px; flex-shrink: 0;
}
.health-row__info {
  flex: 1; display: flex; align-items: center; gap: 6px;
  flex-wrap: wrap; min-width: 0;
}
.health-row__illness { font-size: 12px; font-weight: 700; color: var(--red); }
.health-row__drug { font-size: 12px; font-weight: 700; color: var(--plum); }
.health-row__dosage { font-size: 11px; font-weight: 600; color: var(--text-2); }
.health-row__tag {
  font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px;
  background: var(--plum-soft); color: var(--plum);
}
.health-row__badge {
  font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px;
  &--amber { background: var(--amber-soft); color: var(--amber); }
  &--plum { background: var(--plum-soft); color: var(--plum); }
}
.health-row__meta {
  font-size: 10px;
  color: var(--text-3);
  &--relation { color: var(--plum); font-weight: 600; }
}
.health-row__chevron {
  font-size: 18px; color: var(--text-3); flex-shrink: 0;
}
.health-row__action {
  min-width: 54px;
  height: 28px;
  padding: 0 8px 0 10px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(72, 190, 137, 0.10), rgba(72, 190, 137, 0.06));
  border: 1px solid rgba(72, 190, 137, 0.14);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  flex-shrink: 0;
  &:active { transform: scale(0.9); }
  &--stop {
    background: linear-gradient(180deg, rgba(147, 102, 201, 0.08), rgba(147, 102, 201, 0.04));
    border-color: rgba(132, 94, 194, 0.12);
  }
}
.health-row__action-text {
  font-size: 11px;
  font-weight: 700;
  color: #2f8f68;
  &--stop { color: var(--plum); }
}
.health-row__action-icon {
  font-size: 14px;
  color: #2f8f68;
  &--stop { color: var(--plum); }
}

/* 展开子行 */
.health-sub-row {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 0 6px 26px;
  border-bottom: 0.5px solid var(--card-dim);
  &:last-child { border-bottom: none; }
  &--done { opacity: 0.45; }
  &--done .sub-row__drug { text-decoration: line-through; }
}
.sub-done {
  width: 32px; height: 20px; border-radius: 6px;
  background: var(--green); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.sub-done__check { font-size: 10px; color: #FFFFFF; font-weight: 700; }
.sub-row__drug { font-size: 12px; font-weight: 600; color: var(--text-1); }
.sub-row__dosage { font-size: 11px; color: var(--text-2); }
.sub-row__tag {
  font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px;
  background: var(--plum-soft); color: var(--plum);
}
.sub-row__meta { font-size: 10px; color: var(--text-3); }

/* 给药按钮 */
.give-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: var(--plum); border-radius: 6px; padding: 2px 6px;
  flex-shrink: 0; min-width: 32px;
  &:active { transform: scale(0.9); }
  &--sm { min-width: 32px; }
}
.give-btn__label { font-size: 10px; font-weight: 700; color: #FFFFFF; line-height: 1.3; }
.give-btn__count { font-size: 9px; color: rgba(255,255,255,0.8); line-height: 1.2; }

/* Checkbox */
.cb-box {
  width: 18px; height: 18px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: transform 0.15s ease; &:active { transform: scale(0.85); }
  &--done { background: var(--green); }
  &--empty { border: 2px solid var(--text-4); background: transparent; }
  &--partial { background: var(--plum-soft); border: 2px solid var(--plum); }
}
.cb-check { font-size: 10px; color: #FFFFFF; font-weight: 700; }
.cb-box--partial .cb-check { color: var(--plum); }

.card-actions__btns { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.btn {
  min-height: 34px;
  padding: 8px 18px;
  border-radius: 999px;
  border: 1.5px solid transparent;
  min-width: 64px;
  box-sizing: border-box;
  display: flex; align-items: center; justify-content: center;
  gap: 6px;
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
  &--filled.btn--plum { background: var(--plum); border-color: var(--plum); }
  &--ghost { background: transparent; border-color: var(--text-4); }
  &--ghost-plum { background: linear-gradient(180deg, rgba(147, 102, 201, 0.08), rgba(147, 102, 201, 0.04)); border-color: rgba(132, 94, 194, 0.16); }
}
.btn-icon { font-size: 16px; &--white { color: #FFFFFF; } }
.btn-text { font-family: var(--font-display); font-size: 13px; font-weight: 700; &--white { color: #FFFFFF; } &--ghost { color: var(--text-2); } &--plum { color: var(--plum); } }
</style>
