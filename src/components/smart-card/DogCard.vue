<!--
  DogCard — 个体犬只卡片
  健康类：完成(自动创建记录) + 推迟 + 跳过。点卡片→跳转表单
  繁育类：推迟 + 跳过。点卡片→跳转表单（唯一处理入口）
-->
<template>
  <view class="card" :class="`card--${barColor}`" @click="goRecordTask(visibleTasks[0])">
    <!-- 头部 -->
    <view class="card-header">
      <view class="card-icon" :class="`card-icon--${barColor}`">
        <text style="font-size: 20px;">🐩</text>
      </view>
      <view class="card-title-area">
        <text class="card-name">{{ card.dogName }}</text>
        <text class="card-sub">{{ card.breed || '马尔济斯' }}<text v-if="card.statusLabel"> · {{ card.statusLabel }}</text></text>
      </view>
    </view>

    <!-- 任务标签 -->
    <view v-if="card.tasks?.length" class="tags">
      <view
        v-for="task in visibleTasks"
        :key="task._id"
        class="tag"
        :class="`tag--${taskColor(task)}`"
      >
        <text class="tag-text">{{ taskDisplayTitle(task) }}</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view v-if="!acting" class="card-actions">
      <!-- 健康类与额外安排显示"完成"按钮 -->
      <view v-if="isHealthType || isExtraArrangementType" class="btn btn--ghost-green" @click.stop="onComplete(visibleTasks[0]?._id, completeMode)">
        <text class="btn-text btn-text--green">完成</text>
      </view>
      <view class="btn btn--ghost" @click.stop="$emit('postpone', visibleTasks[0]?._id)">
        <text class="btn-text btn-text--ghost">推迟</text>
      </view>
      <view class="btn-skip" @click.stop="onComplete(visibleTasks[0]?._id, 'skip')">
        <text class="btn-skip-text">跳过</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const HEALTH_TYPES = ['vaccination', 'deworming', 'medication']
const EXTRA_ARRANGEMENT_TYPES = ['breeding_extra_arrangement']

const props = defineProps<{ card: any }>()
const emit = defineEmits<{
  (e: 'complete', taskId: string, mode?: string): void
  (e: 'postpone', taskId: string): void
  (e: 'action', payload: { type: string; data: any }): void
}>()

const acting = ref(false)
let actingTimer: ReturnType<typeof setTimeout> | null = null

function onComplete(taskId: string, mode: string) {
  if (acting.value) return
  acting.value = true
  if (actingTimer) clearTimeout(actingTimer)
  actingTimer = setTimeout(() => {
    acting.value = false
    actingTimer = null
  }, 1800)
  emit('complete', taskId, mode)
}

watch(() => props.card?.tasks?.length, () => {
  if (actingTimer) {
    clearTimeout(actingTimer)
    actingTimer = null
  }
  acting.value = false
})

const visibleTasks = computed(() => (props.card.tasks || []).slice(0, 3))
const firstTaskType = computed(() => visibleTasks.value[0]?.type || '')
const isHealthType = computed(() => HEALTH_TYPES.includes(firstTaskType.value))
const isExtraArrangementType = computed(() => EXTRA_ARRANGEMENT_TYPES.includes(firstTaskType.value))
const completeMode = computed(() => (isHealthType.value ? 'auto' : 'manual'))

const barColor = computed(() => {
  if (props.card.priority === 'overdue') return 'red'
  return 'green'
})

const typeMap: Record<string, string> = {
  vaccination: '/pages/record/health-vaccination',
  deworming: '/pages/record/health-deworming',
  illness: '/pages/record/health-illness',
  heat: '/pages/record/breeding-heat',
  follicle_check: '/pages/record/breeding-follicle',
  mating: '/pages/record/breeding-mating',
  pregnancy_check: '/pages/record/breeding-pregnancy',
  prenatal_check: '/pages/record/breeding-prenatal',
  pre_labor: '/pages/record/breeding-prelabor',
}

function goRecordTask(task: any) {
  if (!task) return
  const params: string[] = []
  if (props.card.dogId) params.push(`dogId=${props.card.dogId}`)
  if (props.card.dogName) params.push(`dogName=${encodeURIComponent(props.card.dogName)}`)
  if (task._id) params.push(`taskId=${task._id}`)
  if (task.cycle_id) params.push(`cycleId=${task.cycle_id}`)

  if (task.type === 'breeding_extra_arrangement' && task.cycle_id) {
    uni.navigateTo({ url: `/pages/breeding/cycle?id=${task.cycle_id}` })
    return
  }

  let url = typeMap[task.type] || '/pages/record/health-vaccination'
  if (task.type === 'breeding_milestone') {
    params.push('locked=true')
    const stepType = task.details?.step_type
    if (stepType === 'follicle_check') {
      url = '/pages/record/breeding-follicle'
    } else if (stepType === 'pregnancy_check') {
      url = '/pages/record/breeding-pregnancy'
    } else if (stepType === 'weaning_confirm' && task.litter_id) {
      const litterParams = [`id=${task.litter_id}`]
      if (task._id) litterParams.push(`taskId=${task._id}`)
      uni.navigateTo({ url: `/pages/breeding/litter?${litterParams.join('&')}` })
      return
    } else {
      url = '/pages/record/breeding-heat'
    }
  }
  uni.navigateTo({ url: url + '?' + params.join('&') })
}

function taskDisplayTitle(task: any) {
  if (!task) return ''
  if (task.type === 'vaccination') {
    if (task.details?.vaccine_type) return `疫苗 · ${task.details.vaccine_type}`
    return task.title || '疫苗'
  }
  if (task.type === 'deworming') return task.details?.drug_name || task.title || '驱虫'
  if (task.type === 'illness') return task.details?.condition || task.title || '疾病'
  if (task.type === 'breeding_extra_arrangement') return task.title || '额外安排'
  return task.title || ''
}

function taskColor(task: any) {
  if (task.priority === 'overdue') return 'red'
  if (task.type === 'breeding_extra_arrangement') return 'rose'
  if (task.type === 'vaccination' || task.type === 'deworming') return 'amber'
  return 'green'
}
</script>

<style lang="scss" scoped>
.card {
  position: relative;
  background: var(--card);
  border-radius: 16px;
  padding: 16px 16px 16px 18px;
  border-left: 3.5px solid transparent;
  box-shadow: var(--shadow);
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:active { transform: scale(0.975); }

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none;
    z-index: 0;
  }
  > * { position: relative; z-index: 1; }

  &--red { border-left-color: var(--red); &::before { background: linear-gradient(135deg, var(--red-soft) 0%, transparent 40%); } }
  &--green { border-left-color: var(--green); &::before { background: linear-gradient(135deg, var(--green-soft) 0%, transparent 40%); } }
  &--amber { border-left-color: var(--amber); &::before { background: linear-gradient(135deg, var(--amber-soft) 0%, transparent 40%); } }
  &--rose { border-left-color: var(--rose); &::before { background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%); } }
}

.card-header { display: flex; align-items: flex-start; gap: 12px; }
.card-icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  &--red { background: var(--icon-red); }
  &--green { background: var(--icon-green); }
  &--amber { background: var(--icon-amber); }
  &--rose { background: var(--icon-rose); }
}
.card-title-area { flex: 1; min-width: 0; }
.card-name { display: block; font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text-1); line-height: 1.3; }
.card-sub { display: block; font-size: 12px; color: var(--text-2); margin-top: 1px; }

.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.tag {
  font-size: 11px; font-weight: 700; padding: 6px 14px; border-radius: 999px;
  &--red { background: var(--red-soft); box-shadow: 0 1px 4px rgba(224, 82, 82, 0.2); .tag-text { color: var(--red); } }
  &--amber { background: var(--amber-soft); box-shadow: 0 1px 4px rgba(232, 155, 62, 0.2); .tag-text { color: var(--amber); } }
  &--green { background: var(--green-soft); box-shadow: 0 1px 4px rgba(61, 174, 111, 0.2); .tag-text { color: var(--green); } }
  &--rose { background: var(--rose-soft); box-shadow: 0 1px 4px rgba(234, 62, 119, 0.2); .tag-text { color: var(--rose); } }
}
.tag-text { font-size: 11px; font-weight: 600; }

.card-actions { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
.btn {
  padding: 8px 18px; border-radius: 999px; border: none;
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
  &--ghost { background: transparent; border: 1.5px solid var(--text-4); }
  &--ghost-green { background: transparent; border: 1.5px solid var(--green); }
}
.btn-text {
  font-family: var(--font-display); font-size: 13px; font-weight: 700;
  &--ghost { color: var(--text-2); }
  &--green { color: var(--green); }
}
.btn-skip {
  padding: 8px 12px;
  &:active { opacity: 0.5; }
}
.btn-skip-text {
  font-size: 12px;
  color: var(--text-3);
}
</style>
