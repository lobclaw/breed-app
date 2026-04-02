<!--
  BatchCard — 批量操作卡片
  设计稿：home-v1-final.html Card 4 (bar-blue, 月度驱虫)
  左色条(蓝) + 图标 + 标题 + checkbox 列表 + 进度条 + 批量按钮
-->
<template>
  <view class="card" :class="card.priority === 'overdue' ? 'card--red' : 'card--blue'">
    <view class="card-header" @click="goProcess">
      <view class="card-icon" :class="card.priority === 'overdue' ? 'card-icon--red' : 'card-icon--blue'">
        <text style="font-size: 20px;">💉</text>
      </view>
      <view class="card-title-area">
        <text class="card-name">{{ card.groupTitle }}</text>
        <text class="card-sub">{{ card.dogs?.length || 0 }}只犬</text>
      </view>
      <!-- 分数角标 -->
      <view class="fraction-badge">
        <text class="fraction-badge-text">{{ doneCount }}/{{ totalDogs }}</text>
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
    </view>

    <!-- 进度条 -->
    <view class="progress-area">
      <view class="progress-track">
        <view class="progress-fill" :style="{ width: progressPct + '%' }" />
      </view>
    </view>

    <!-- 操作按钮 -->
    <view v-if="!acting" class="card-actions">
      <view class="btn btn--ghost-green" @click="batchComplete">
        <text class="btn-text btn-text--green">完成</text>
      </view>
      <view class="btn btn--ghost" @click="batchPostpone">
        <text class="btn-text btn-text--ghost">推迟</text>
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

const dogStore = useDogStore()

const props = defineProps<{ card: any }>()
const emit = defineEmits<{
  (e: 'complete', taskId: string, allDone?: boolean): void
  (e: 'batch-complete', taskIds: string[]): void
  (e: 'batch-skip', taskIds: string[]): void
  (e: 'postpone', taskIds: string | string[], title?: string): void
  (e: 'action', payload: any): void
}>()

const checkedDogs = ref(new Set<string>())
const acting = ref(false)

function toggleDog(dog: any) {
  if (dog.completed || checkedDogs.value.has(dog.dogId)) return
  const task = props.card.tasks?.find((t: any) => t.dog_id === dog.dogId || t.dogId === dog.dogId)
  if (!task) return
  checkedDogs.value.add(dog.dogId)
  // 检查是否全部完成（后端已完成 + 本地勾选）
  const allDogs = props.card.dogs || []
  const allDone = allDogs.every((d: any) => d.completed || checkedDogs.value.has(d.dogId))
  emit('complete', task._id, allDone)
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

const visibleDogs = computed(() => (props.card.dogs || []).slice(0, 12))
const totalDogs = computed(() => (props.card.dogs || []).length)
const doneCount = computed(() => checkedDogs.value.size)
const progressPct = computed(() => {
  if (!totalDogs.value) return 0
  return Math.round((doneCount.value / totalDogs.value) * 100)
})

function batchComplete() {
  if (acting.value) return
  acting.value = true

  const taskIds = props.card.tasks.filter((t: any) => t.status === 'pending').map((t: any) => t._id)

  // 逐一勾选所有未打钩的犬只，再触发完成动画
  const unchecked = (props.card.dogs || []).filter((d: any) => !d.completed && !checkedDogs.value.has(d.dogId))
  unchecked.forEach((dog: any, i: number) => {
    setTimeout(() => checkedDogs.value.add(dog.dogId), i * 40)
  })
  setTimeout(() => emit('batch-complete', taskIds), unchecked.length * 40)
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
  &--blue { border-left-color: var(--blue); &::before { background: linear-gradient(135deg, var(--blue-soft) 0%, transparent 40%); } }
  &--red { border-left-color: var(--red); &::before { background: linear-gradient(135deg, var(--red-soft) 0%, transparent 40%); } }
}

.card-header { display: flex; align-items: flex-start; gap: 12px; }
.card-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; &--blue { background: var(--icon-blue); } &--red { background: var(--icon-red); } }
.card-title-area { flex: 1; }
.card-name { display: block; font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text-1); }
.card-sub { display: block; font-size: 12px; color: var(--text-2); margin-top: 1px; }

/* 分数角标 */
.fraction-badge { background: var(--primary-soft); padding: 3px 10px; border-radius: 999px; }
.fraction-badge-text { font-family: var(--font-display); font-size: 13px; font-weight: 800; color: var(--primary); }

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

/* 进度条 */
.progress-area { margin-top: 12px; }
.progress-track { height: 5px; background: var(--card-dim); border-radius: 999px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--primary), var(--amber)); transition: width 0.6s ease; }

.card-actions { display: flex; gap: 8px; margin-top: 14px; }
.btn {
  padding: 8px 18px; border-radius: 999px; border: none;
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
  &--filled.btn--blue { background: var(--blue); }
  &--ghost { background: transparent; border: 1.5px solid var(--text-4); }
  &--ghost-green { background: transparent; border: 1.5px solid var(--green); }
}
.btn-text { font-family: var(--font-display); font-size: 13px; font-weight: 700; &--white { color: #FFFFFF; } &--ghost { color: var(--text-2); } &--green { color: var(--green); } }
.btn-skip { padding: 8px 12px; &:active { opacity: 0.5; } }
.btn-skip-text { font-size: 12px; color: var(--text-3); }
</style>
