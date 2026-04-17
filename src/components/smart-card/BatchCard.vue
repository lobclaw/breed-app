<!--
  BatchCard — 批量操作卡片
  设计稿：home-v1-final.html Card 4 (bar-blue, 月度驱虫)
  左色条(蓝) + 图标 + 标题 + checkbox 列表 + 进度条 + 批量按钮
-->
<template>
  <view class="card" :class="[`card--${cardTone.color}`, { 'card--illness': cardTone.variant === 'illness' }]">
    <view class="card-header" @click="goProcess">
      <view class="card-icon" :class="`card-icon--${cardTone.color}`">
        <text style="font-size: 20px;">💉</text>
      </view>
      <view class="card-title-area">
        <text class="card-name">{{ card.groupTitle }}</text>
        <text class="card-sub">{{ card.dogs?.length || 0 }}只犬</text>
      </view>
      <!-- 分数角标 -->
      <view class="fraction-badge" :class="`fraction-badge--${cardTone.color}`">
        <text class="fraction-badge-text" :class="`fraction-badge-text--${cardTone.color}`">{{ doneCount }}/{{ totalDogs }}</text>
      </view>
    </view>

    <!-- Checkbox 列表 -->
    <view class="checkbox-list">
      <view
        v-for="dog in visibleDogs"
        :key="dog.dogId"
        class="checkbox-item"
        :class="{ 'checkbox-item--checked': dog.completed || checkedDogs.has(dog.dogId) }"
        @click="toggleDog(dog)"
      >
        <view class="cb-box" :class="(dog.completed || checkedDogs.has(dog.dogId)) ? 'cb-box--done' : 'cb-box--empty'">
          <text v-if="dog.completed || checkedDogs.has(dog.dogId)" class="cb-check">✓</text>
        </view>
        <text class="cb-label">{{ dog.dogName }}</text>
      </view>
      <view v-if="hiddenDogCount > 0" class="dog-expand" @click.stop="dogsExpanded = !dogsExpanded">
        <text class="dog-expand-text">{{ dogExpandText }}</text>
      </view>
    </view>

    <!-- 进度条 -->
    <view class="progress-area">
      <view class="progress-track">
        <view class="progress-fill" :style="progressFillStyle" />
      </view>
    </view>

    <!-- 操作按钮 -->
    <view v-if="!acting" class="card-actions">
      <view class="btn btn--primary" :class="`btn--primary-${cardTone.color}`" @click="batchComplete">
        <text class="material-icons-round btn-icon btn-icon--white">check_circle</text>
        <text class="btn-text btn-text--white">完成</text>
      </view>
      <view class="btn btn--secondary" :class="`btn--secondary-${cardTone.color}`" @click="batchPostpone">
        <text class="btn-text" :class="`btn-text--${cardTone.color}`">推迟</text>
      </view>
      <view class="btn-skip" @click="batchSkip">
        <text class="btn-skip-text">跳过</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDogStore } from '@/stores/dogStore'
import { getHealthTypeTone } from '@/utils/themeSemantics'

const dogStore = useDogStore()
const DOG_COMPACT_LIMIT = 12

const props = defineProps<{ card: any }>()
const emit = defineEmits<{
  (e: 'complete', taskId: string, mode?: boolean | string): void
  (e: 'batch-complete', payload: { taskIds: string[]; autoRecord?: boolean }): void
  (e: 'batch-skip', taskIds: string[]): void
  (e: 'postpone', taskIds: string | string[], title?: string): void
  (e: 'action', payload: any): void
}>()

const checkedDogs = ref(new Set<string>())
const acting = ref(false)
const dogsExpanded = ref(false)

function toggleDog(dog: any) {
  if (dog.completed || checkedDogs.value.has(dog.dogId)) return
  const task = props.card.tasks?.find((t: any) => t.dog_id === dog.dogId || t.dogId === dog.dogId)
  if (!task) return
  checkedDogs.value.add(dog.dogId)
  // 检查是否全部完成（后端已完成 + 本地勾选）
  const allDone = allDogs.value.every((d: any) => d.completed || checkedDogs.value.has(d.dogId))
  emit('complete', task._id, allDone ? 'batch-auto' : 'batch-auto-partial')
}

function goProcess() {
  const firstTask = props.card.tasks?.[0]
  const taskType = firstTask?.type || ''
  const dogs = props.card.dogs || []
  const taskIds = props.card.tasks?.filter((t: any) => t.status === 'pending').map((t: any) => t._id).join(',')

  // 构建犬只 JSON（同步传递，避免异步查询）
  // 从 dogStore 补充 role 信息，用于表单动态计算提醒间隔
  const dogStoreList = dogStore.list
  const dogList = dogs.map((d: any) => {
    const stored = dogStoreList.find((s: any) => s._id === d.dogId)
    return { _id: d.dogId, name: d.dogName, role: stored?.role || '幼崽' }
  })
  const dogsParam = encodeURIComponent(JSON.stringify(dogList))

  // 传递任务详情用于预填表单
  const detailsParam = firstTask?.details
    ? '&details=' + encodeURIComponent(JSON.stringify(firstTask.details))
    : ''

  const typePageMap: Record<string, string> = {
    vaccination: '/pages/record/health-vaccination',
    deworming: '/pages/record/health-deworming',
    illness: '/pages/record/health-illness',
  }
  const page = typePageMap[taskType] || '/pages/record/health-vaccination'
  uni.navigateTo({ url: `${page}?batchDogs=${dogsParam}&taskIds=${taskIds}${detailsParam}` })
}

function batchPostpone() {
  const pendingTasks = props.card.tasks || []
  if (pendingTasks.length === 0) return
  const taskIds = pendingTasks.map((t: any) => t._id)
  emit('postpone', taskIds, props.card.groupTitle || '批量推迟')
}

const allDogs = computed(() => props.card.dogs || [])
const hiddenDogCount = computed(() => Math.max(0, allDogs.value.length - DOG_COMPACT_LIMIT))
const dogExpandText = computed(() => (dogsExpanded.value ? '收起' : `还有 ${hiddenDogCount.value} 只，展开`))
const visibleDogs = computed(() => {
  if (dogsExpanded.value) return allDogs.value
  return allDogs.value.slice(0, DOG_COMPACT_LIMIT)
})
const totalDogs = computed(() => allDogs.value.length)
const doneCount = computed(() => checkedDogs.value.size)
const firstTaskType = computed(() => props.card.tasks?.[0]?.type || '')
const cardTone = computed(() => {
  if (props.card.priority === 'overdue') return getHealthTypeTone(firstTaskType.value, 'overdue')
  if (props.card.domain !== 'breeding' && props.card.domain !== 'medication') return getHealthTypeTone(firstTaskType.value)
  if (props.card.domain === 'breeding') return { color: 'amber', variant: 'default' as const }
  if (props.card.domain === 'medication') return { color: 'plum', variant: 'default' as const }
  return { color: 'blue', variant: 'default' as const }
})
const progressPct = computed(() => {
  if (!totalDogs.value) return 0
  return Math.round((doneCount.value / totalDogs.value) * 100)
})
const progressFillStyle = computed(() => {
  const colorMap: Record<string, string> = {
    red: 'var(--red)',
    blue: 'var(--blue)',
    amber: 'var(--amber)',
    plum: 'var(--plum)',
    teal: 'var(--teal)',
  }
  const color = colorMap[cardTone.value.color] || 'var(--blue)'
  return {
    width: `${progressPct.value}%`,
    background: `linear-gradient(90deg, ${color}, ${color})`,
  }
})

function batchComplete() {
  if (acting.value) return
  acting.value = true

  const taskIds = props.card.tasks.filter((t: any) => t.status === 'pending').map((t: any) => t._id)
  // 批量完成时直接全勾，强调“整张卡已完成”，避免逐个勾选拖慢退场
  ;(props.card.dogs || []).forEach((dog: any) => {
    if (!dog.completed) checkedDogs.value.add(dog.dogId)
  })
  emit('batch-complete', { taskIds, autoRecord: true })
}

function batchSkip() {
  if (acting.value) return
  acting.value = true
  // 跳过所有：仅标记 done，不创建记录（无完成特效，仅滑出）
  const taskIds = props.card.tasks.filter((t: any) => t.status === 'pending').map((t: any) => t._id)
  emit('batch-skip', taskIds)
}
</script>

<style lang="scss" scoped>
.card {
  position: relative; background: var(--card); border-radius: 16px;
  padding: 16px 16px 16px 18px; border-left: 3.5px solid transparent;
  box-shadow: var(--shadow); overflow: hidden;
  /* 批量卡片整体不可点击，不加按压反馈 */
  &::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; }
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
  width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  &--red { background: var(--icon-red); }
  &--blue { background: var(--icon-blue); }
  &--amber { background: var(--icon-amber); }
  &--plum { background: var(--icon-plum); }
  &--teal { background: var(--icon-teal); }
}
.card-title-area { flex: 1; }
.card-name { display: block; font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text-1); }
.card-sub { display: block; font-size: 12px; color: var(--text-2); margin-top: 1px; }

/* 分数角标 */
.fraction-badge {
  padding: 3px 10px; border-radius: 999px;
  &--red { background: var(--red-soft); }
  &--blue { background: var(--blue-soft); }
  &--amber { background: var(--amber-soft); }
  &--plum { background: var(--plum-soft); }
  &--teal { background: var(--teal-soft); }
}
.fraction-badge-text {
  font-family: var(--font-display); font-size: 13px; font-weight: 800;
  &--red { color: var(--red); }
  &--blue { color: var(--blue); }
  &--amber { color: var(--amber); }
  &--plum { color: var(--plum); }
  &--teal { color: var(--teal); }
}

/* Checkbox 列表 */
.checkbox-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.checkbox-item { display: flex; align-items: center; gap: 5px; }
.checkbox-item--checked .cb-label { color: var(--text-3); text-decoration: line-through; }
.cb-box {
  width: 18px; height: 18px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: transform 0.15s ease; &:active { transform: scale(0.85); }
  &--done { background: var(--green); }
  &--empty { border: 2px solid var(--text-4); background: transparent; }
}
.cb-check { font-size: 10px; color: #FFFFFF; font-weight: 700; }
.cb-label { font-size: 12px; font-weight: 600; color: var(--text-1); }
.dog-expand {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 999px;
  background: var(--card-dim);
  &:active { opacity: 0.75; }
}
.dog-expand-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}

/* 进度条 */
.progress-area { margin-top: 12px; }
.progress-track { height: 5px; background: var(--card-dim); border-radius: 999px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 999px; transition: width 0.6s ease; }

.card-actions { display: flex; gap: 8px; margin-top: 14px; }
.btn {
  min-height: 34px;
  padding: 0 18px;
  border-radius: 999px;
  border: none;
  min-width: 64px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
  &--primary {
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.08);
  }
  &--primary-red { background: linear-gradient(135deg, rgba(224, 82, 82, 0.92), rgba(240, 134, 91, 0.92)); }
  &--primary-blue { background: linear-gradient(135deg, rgba(71, 144, 255, 0.92), rgba(101, 177, 255, 0.92)); }
  &--primary-amber { background: linear-gradient(135deg, rgba(242, 167, 62, 0.92), rgba(255, 192, 108, 0.92)); }
  &--primary-plum { background: linear-gradient(135deg, rgba(145, 116, 219, 0.94), rgba(178, 149, 242, 0.94)); }
  &--primary-teal { background: linear-gradient(135deg, rgba(39, 171, 171, 0.92), rgba(90, 194, 194, 0.92)); }
  &--secondary {
    background: rgba(255, 255, 255, 0.72);
    border: 1.5px solid transparent;
  }
  &--secondary-red { border-color: rgba(224, 82, 82, 0.18); background: linear-gradient(180deg, rgba(224, 82, 82, 0.06), rgba(224, 82, 82, 0.03)); }
  &--secondary-blue { border-color: rgba(71, 144, 255, 0.18); background: linear-gradient(180deg, rgba(71, 144, 255, 0.06), rgba(71, 144, 255, 0.03)); }
  &--secondary-amber { border-color: rgba(242, 167, 62, 0.18); background: linear-gradient(180deg, rgba(242, 167, 62, 0.06), rgba(242, 167, 62, 0.03)); }
  &--secondary-plum { border-color: rgba(145, 116, 219, 0.18); background: linear-gradient(180deg, rgba(145, 116, 219, 0.06), rgba(145, 116, 219, 0.03)); }
  &--secondary-teal { border-color: rgba(39, 171, 171, 0.18); background: linear-gradient(180deg, rgba(39, 171, 171, 0.06), rgba(39, 171, 171, 0.03)); }
}
.btn-icon {
  font-size: 16px;
  flex-shrink: 0;
  &--white { color: #FFFFFF; }
}
.btn-text {
  font-family: var(--font-display); font-size: 13px; font-weight: 700;
  &--white { color: #FFFFFF; }
  &--red { color: var(--red); }
  &--illness { color: var(--red); }
  &--blue { color: var(--blue); }
  &--amber { color: var(--amber); }
  &--plum { color: var(--plum); }
  &--teal { color: var(--teal); }
}
.btn-skip { padding: 8px 12px; &:active { opacity: 0.5; } }
.btn-skip-text { font-size: 12px; color: var(--text-3); }
</style>
