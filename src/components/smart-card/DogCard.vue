<!--
  DogCard — 个体犬只卡片
  健康类：完成(自动创建记录) + 推迟 + 跳过。点卡片→跳转表单
  繁育额外安排：完成 + 推迟 + 跳过。点卡片→跳转详情或记录页
-->
<template>
  <view class="card" :class="[`card--${barColor}`, { 'card--illness': cardVariant === 'illness' }]" @click="goRecordTask(visibleTasks[0])">
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
      <view v-if="hiddenTaskCount > 0" class="tag-expand" @click.stop="tasksExpanded = !tasksExpanded">
        <text class="tag-expand-text">{{ taskExpandText }}</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view v-if="!acting" class="card-actions">
      <!-- 健康类与额外安排显示"完成"按钮 -->
      <view
        v-if="isHealthType || isExtraArrangementType"
        class="btn btn--primary"
        :class="cardVariant === 'illness' ? 'btn--primary-illness' : `btn--primary-${barColor}`"
        @click.stop="onComplete(visibleTasks[0]?._id, completeMode)"
      >
        <text class="material-icons-round btn-icon btn-icon--white">check_circle</text>
        <text class="btn-text btn-text--white">完成</text>
      </view>
      <view class="btn btn--secondary" :class="cardVariant === 'illness' ? 'btn--secondary-illness' : `btn--secondary-${barColor}`" @click.stop="$emit('postpone', visibleTasks[0]?._id)">
        <text class="btn-text" :class="cardVariant === 'illness' ? 'btn-text--illness' : `btn-text--${barColor}`">推迟</text>
      </view>
      <view class="btn-skip" @click.stop="onComplete(visibleTasks[0]?._id, 'skip')">
        <text class="btn-skip-text">跳过</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getHealthTypeTone, isIllnessTaskType } from '@/utils/themeSemantics'

const HEALTH_TYPES = ['vaccination', 'deworming', 'medication']
const EXTRA_ARRANGEMENT_TYPES = ['breeding_extra_arrangement']
const TASK_COMPACT_LIMIT = 3

const props = defineProps<{ card: any }>()
const emit = defineEmits<{
  (e: 'complete', taskId: string, mode?: string): void
  (e: 'postpone', taskId: string): void
  (e: 'action', payload: { type: string; data: any }): void
}>()

const acting = ref(false)
const tasksExpanded = ref(false)
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

const allTasks = computed(() => props.card.tasks || [])
const hiddenTaskCount = computed(() => Math.max(0, allTasks.value.length - TASK_COMPACT_LIMIT))
const taskExpandText = computed(() => (tasksExpanded.value ? '收起' : `还有 ${hiddenTaskCount.value} 项，展开`))
const visibleTasks = computed(() => {
  if (tasksExpanded.value) return allTasks.value
  return allTasks.value.slice(0, TASK_COMPACT_LIMIT)
})
const firstTaskType = computed(() => visibleTasks.value[0]?.type || '')
const isHealthType = computed(() => HEALTH_TYPES.includes(firstTaskType.value))
const isExtraArrangementType = computed(() => EXTRA_ARRANGEMENT_TYPES.includes(firstTaskType.value))
const completeMode = computed(() => (isHealthType.value ? 'auto' : 'manual'))
const primaryTaskTone = computed(() => getHealthTypeTone(firstTaskType.value, props.card.priority))

const domainColor = computed(() => {
  if (props.card.domain === 'breeding') return 'amber'
  if (props.card.domain === 'medication') return 'plum'
  return 'blue'
})

const barColor = computed(() => {
  if (props.card.priority === 'overdue') return 'red'
  if (props.card.domain !== 'breeding' && props.card.domain !== 'medication') return primaryTaskTone.value.color
  return domainColor.value
})
const cardVariant = computed(() => primaryTaskTone.value.variant)

const typeMap: Record<string, string> = {
  vaccination: '/pages/record/health-vaccination',
  deworming: '/pages/record/health-deworming',
  illness: '/pages/record/health-illness',
  heat: '/pages/record/breeding-heat',
  follicle_check: '/pages/record/breeding-follicle',
  mating: '/pages/record/breeding-mating',
  pregnancy_check: '/pages/record/breeding-pregnancy',
  birth: '/pages/breeding/birth-wizard',
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
    } else if (stepType === 'mating') {
      url = '/pages/record/breeding-mating'
    } else if (stepType === 'pregnancy_check') {
      url = '/pages/record/breeding-pregnancy'
    } else if (stepType === 'birth') {
      const birthParams: string[] = []
      if (task.cycle_id) birthParams.push(`cycleId=${task.cycle_id}`)
      if (props.card.dogName) birthParams.push(`damName=${encodeURIComponent(props.card.dogName)}`)
      uni.navigateTo({ url: `/pages/breeding/birth-wizard?${birthParams.join('&')}` })
      return
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
  if (isIllnessTaskType(task?.type)) return 'red'
  return domainColor.value
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
  &--illness {
    border-left-color: rgba(224, 82, 82, 0.72);
    &::before { background: linear-gradient(135deg, rgba(224, 82, 82, 0.12) 0%, transparent 34%); }
  }
  &--blue { border-left-color: var(--blue); &::before { background: linear-gradient(135deg, var(--blue-soft) 0%, transparent 40%); } }
  &--amber { border-left-color: var(--amber); &::before { background: linear-gradient(135deg, var(--amber-soft) 0%, transparent 40%); } }
  &--plum { border-left-color: var(--plum); &::before { background: linear-gradient(135deg, var(--plum-soft) 0%, transparent 40%); } }
  &--teal { border-left-color: var(--teal); &::before { background: linear-gradient(135deg, var(--teal-soft) 0%, transparent 40%); } }
}

.card-header { display: flex; align-items: flex-start; gap: 12px; }
.card-icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  &--red { background: var(--icon-red); }
  &--blue { background: var(--icon-blue); }
  &--amber { background: var(--icon-amber); }
  &--plum { background: var(--icon-plum); }
  &--teal { background: var(--icon-teal); }
}
.card-title-area { flex: 1; min-width: 0; }
.card-name { display: block; font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text-1); line-height: 1.3; }
.card-sub { display: block; font-size: 12px; color: var(--text-2); margin-top: 1px; }

.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.tag {
  font-size: 11px; font-weight: 700; padding: 6px 14px; border-radius: 999px;
  &--red { background: var(--red-soft); box-shadow: 0 1px 4px rgba(224, 82, 82, 0.2); .tag-text { color: var(--red); } }
  &--blue { background: var(--blue-soft); box-shadow: 0 1px 4px rgba(74, 141, 212, 0.2); .tag-text { color: var(--blue); } }
  &--amber { background: var(--amber-soft); box-shadow: 0 1px 4px rgba(232, 155, 62, 0.2); .tag-text { color: var(--amber); } }
  &--plum { background: var(--plum-soft); box-shadow: 0 1px 4px rgba(134, 104, 176, 0.2); .tag-text { color: var(--plum); } }
  &--teal { background: var(--teal-soft); box-shadow: 0 1px 4px rgba(61, 168, 160, 0.18); .tag-text { color: var(--teal); } }
}
.tag-text { font-size: 11px; font-weight: 600; }
.tag-expand {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--card-dim);
  &:active { opacity: 0.75; }
}
.tag-expand-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
}

.card-actions { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
.btn {
  min-height: 34px;
  padding: 8px 18px;
  min-width: 64px;
  border-radius: 999px;
  border: none;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
  &--primary-red { background: linear-gradient(135deg, rgba(224, 82, 82, 0.92), rgba(240, 134, 91, 0.92)); }
  &--primary-amber { background: linear-gradient(135deg, rgba(242, 167, 62, 0.92), rgba(255, 192, 108, 0.92)); }
  &--primary-blue { background: linear-gradient(135deg, rgba(71, 144, 255, 0.92), rgba(101, 177, 255, 0.92)); }
  &--primary-plum { background: linear-gradient(135deg, rgba(145, 116, 219, 0.94), rgba(178, 149, 242, 0.94)); }
  &--primary-teal { background: linear-gradient(135deg, rgba(39, 171, 171, 0.92), rgba(90, 194, 194, 0.92)); }
  &--primary-illness { background: linear-gradient(135deg, rgba(224, 82, 82, 0.92), rgba(240, 134, 91, 0.92)); }
  &--secondary {
    background: rgba(255, 255, 255, 0.72);
    border: 1.5px solid transparent;
  }
  &--secondary-red { border-color: rgba(224, 82, 82, 0.18); background: linear-gradient(180deg, rgba(224, 82, 82, 0.06), rgba(224, 82, 82, 0.03)); }
  &--secondary-amber { border-color: rgba(242, 167, 62, 0.18); background: linear-gradient(180deg, rgba(242, 167, 62, 0.06), rgba(242, 167, 62, 0.03)); }
  &--secondary-blue { border-color: rgba(71, 144, 255, 0.18); background: linear-gradient(180deg, rgba(71, 144, 255, 0.06), rgba(71, 144, 255, 0.03)); }
  &--secondary-plum { border-color: rgba(145, 116, 219, 0.18); background: linear-gradient(180deg, rgba(145, 116, 219, 0.06), rgba(145, 116, 219, 0.03)); }
  &--secondary-teal { border-color: rgba(39, 171, 171, 0.18); background: linear-gradient(180deg, rgba(39, 171, 171, 0.06), rgba(39, 171, 171, 0.03)); }
  &--secondary-illness { border-color: rgba(224, 82, 82, 0.18); background: linear-gradient(180deg, rgba(224, 82, 82, 0.06), rgba(224, 82, 82, 0.03)); }
}
.btn-icon { font-size: 16px; flex-shrink: 0; &--white { color: #FFFFFF; } }
.btn-text {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  &--white { color: #FFFFFF; }
  &--red { color: var(--red); }
  &--illness { color: var(--red); }
  &--blue { color: var(--blue); }
  &--amber { color: var(--amber); }
  &--plum { color: var(--plum); }
  &--teal { color: var(--teal); }
}
.btn-skip {
  min-height: 34px;
  padding: 8px 12px;
  display: inline-flex;
  align-items: center;
  &:active { opacity: 0.5; }
}
.btn-skip-text {
  font-size: 12px;
  color: var(--text-3);
}
</style>
