<!--
  MedicationCard — 今日用药卡
  展示需要今日用药的犬只：sick_with_med / med_only
  两种行状态：sick_with_med（生病+用药）/ med_only（仅用药）
-->
<template>
  <view class="card card--plum">
    <view class="card-header">
      <view class="card-icon card-icon--plum">
        <text class="material-icons-round" style="font-size: 20px; color: var(--plum);">health_and_safety</text>
      </view>
      <view class="card-title-area">
        <text class="card-name">{{ card.groupTitle || '今日用药' }}</text>
        <text class="card-sub">{{ card.dogs?.length || 0 }}只犬</text>
      </view>
      <view v-if="medDogCount > 0" class="fraction-badge">
        <text class="fraction-badge-text">{{ doneCount }}/{{ medDogCount }}</text>
      </view>
    </view>

    <!-- 用药犬只（sick_with_med + med_only，有 checkbox） -->
    <view class="health-list">
      <view
        v-for="dog in actionableDogs"
        :key="dog.dogId"
        class="health-row"
        :class="{ 'health-row--done': dog.completed || checkedDogs.has(dog.dogId) }"
        @click="toggleDog(dog)"
      >
        <template v-if="dog.state === 'sick_with_med'">
          <view class="cb-box" :class="(dog.completed || checkedDogs.has(dog.dogId)) ? 'cb-box--done' : 'cb-box--empty'">
            <text v-if="dog.completed || checkedDogs.has(dog.dogId)" class="cb-check">✓</text>
          </view>
          <text class="health-row__name">{{ dog.dogName }}</text>
          <view class="health-row__info">
            <text class="health-row__illness">{{ dog.illness }}</text>
            <text v-if="dog.treatmentStatus" class="health-row__badge health-row__badge--amber">{{ dog.treatmentStatus }}</text>
            <text class="health-row__drug">{{ dog.drugName }}</text>
            <text v-if="dog.dosageStr" class="health-row__dosage">{{ dog.dosageStr }}</text>
            <text v-if="dog.progress" class="health-row__tag">{{ dog.progress }}</text>
            <text v-if="dog.methodFreq" class="health-row__meta">{{ dog.methodFreq }}</text>
          </view>
          <text v-if="!(dog.completed || checkedDogs.has(dog.dogId))" class="health-row__action" @click.stop="onSickAction(dog)">康复</text>
        </template>
        <template v-else>
          <view class="cb-box" :class="(dog.completed || checkedDogs.has(dog.dogId)) ? 'cb-box--done' : 'cb-box--empty'">
            <text v-if="dog.completed || checkedDogs.has(dog.dogId)" class="cb-check">✓</text>
          </view>
          <text class="health-row__name">{{ dog.dogName }}</text>
          <view class="health-row__info">
            <text class="health-row__drug">{{ dog.drugName || '用药' }}</text>
            <text v-if="dog.dosageStr" class="health-row__dosage">{{ dog.dosageStr }}</text>
            <text v-if="dog.progress" class="health-row__tag">{{ dog.progress }}</text>
            <text v-if="dog.methodFreq" class="health-row__meta">{{ dog.methodFreq }}</text>
          </view>
          <text v-if="!(dog.completed || checkedDogs.has(dog.dogId))" class="health-row__action health-row__action--stop" @click.stop="onStopMedication(dog)">停药</text>
        </template>
      </view>
    </view>

    <!-- 按钮组 -->
    <view v-if="hasPendingMed" class="card-actions__btns">
      <view class="btn btn--filled btn--plum" @click="batchComplete">
        <text class="btn-text btn-text--white">完成</text>
      </view>
      <view class="btn btn--ghost" @click="batchPostpone">
        <text class="btn-text btn-text--ghost">推迟</text>
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{ card: any }>()
const emit = defineEmits<{
  (e: 'complete', taskId: string, allDone?: boolean): void
  (e: 'batch-complete', taskIds: string[]): void
  (e: 'postpone', taskIds: string | string[], title?: string): void
  (e: 'action', payload: { type: string; data: any }): void
}>()

// 把犬只数据和可选操作传给父组件，由父组件渲染 BSheet
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

// 用药犬只（sick_with_med + med_only）
const actionableDogs = computed(() => props.card.dogs || [])

const checkedDogs = ref(new Set<string>())

function toggleDog(dog: any) {
  if (dog.completed || checkedDogs.value.has(dog.dogId)) return
  const task = props.card.tasks?.find((t: any) => t.dog_id === dog.dogId || t.dogId === dog.dogId)
  if (!task) return
  checkedDogs.value.add(dog.dogId)
  const allDone = (props.card.dogs || []).every((d: any) => d.completed || checkedDogs.value.has(d.dogId))
  emit('complete', task._id, allDone)
}

const medDogCount = computed(() => (props.card.dogs || []).length)
const doneCount = computed(() =>
  (props.card.dogs || []).filter((d: any) => d.completed || checkedDogs.value.has(d.dogId)).length
)
const hasPendingMed = computed(() => doneCount.value < medDogCount.value)

function batchComplete() {
  const taskIds = (props.card.tasks || []).map((t: any) => t._id)
  emit('batch-complete', taskIds)
}

function batchPostpone() {
  const taskIds = (props.card.tasks || []).map((t: any) => t._id)
  if (taskIds.length > 0) {
    emit('postpone', taskIds, props.card.groupTitle || '今日用药')
  }
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

.fraction-badge { background: var(--plum-soft); padding: 3px 10px; border-radius: 999px; }
.fraction-badge-text { font-family: var(--font-display); font-size: 13px; font-weight: 800; color: var(--plum); }

/* 健康列表 */
.health-list { display: flex; flex-direction: column; gap: 0; margin-top: 10px; }
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
.health-row__illness {
  font-size: 12px; font-weight: 700; color: var(--red);
}
.health-row__sep {
  font-size: 10px; color: var(--text-4); margin: 0 -1px;
}
.health-row__drug {
  font-size: 12px; font-weight: 700; color: var(--plum);
}
.health-row__dosage {
  font-size: 11px; font-weight: 600; color: var(--text-2);
}
.health-row__tag {
  font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px;
  background: var(--plum-soft); color: var(--plum);
}
.health-row__badge {
  font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px;
  &--amber { background: var(--amber-soft); color: var(--amber); }
}
.health-row__days {
  font-size: 11px; color: var(--text-3);
}
.health-row__action {
  font-size: 11px; font-weight: 700; color: var(--green);
  padding: 2px 8px; border-radius: 4px;
  background: var(--green-soft);
  box-shadow: 0 1px 4px rgba(61, 174, 111, 0.2);
  flex-shrink: 0;
  &:active { transform: scale(0.9); box-shadow: none; }
  &--stop {
    color: var(--text-2);
    background: var(--card-dim);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  }
}
.health-row__meta {
  font-size: 10px; color: var(--text-3);
}

/* Checkbox */
.cb-box {
  width: 18px; height: 18px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: transform 0.15s ease; &:active { transform: scale(0.85); }
  &--done { background: var(--green); }
  &--empty { border: 2px solid var(--text-4); background: transparent; }
}
.cb-check { font-size: 10px; color: #FFFFFF; font-weight: 700; }

.card-actions__btns { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.btn {
  padding: 8px 18px; border-radius: 999px; border: 1.5px solid transparent;
  min-width: 64px; box-sizing: border-box;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
  &--filled.btn--plum { background: var(--plum); border-color: var(--plum); }
  &--ghost { background: transparent; border-color: var(--text-4); }
}
.btn-text { font-family: var(--font-display); font-size: 13px; font-weight: 700; &--white { color: #FFFFFF; } &--ghost { color: var(--text-2); } }


</style>
