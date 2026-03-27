<!--
  批量处理页 (H-6)
  将同类型任务聚合，支持批量勾选完成
-->
<template>
  <view class="batch-page">
    <BPageHeader title="批量处理" />

    <!-- 加载骨架屏 -->
    <BSkeleton v-if="loading" :rows="4" />

    <!-- 空状态 -->
    <BEmpty
      v-if="!loading && taskGroups.length === 0"
      icon="checklist"
      title="暂无可批量处理的任务"
      description="同类型的多犬任务会在这里聚合"
    />

    <!-- 任务分组列表 -->
    <view v-if="!loading && taskGroups.length > 0" class="batch-page__body">
      <view
        v-for="group in taskGroups"
        :key="group.type"
        class="batch-page__group"
      >
        <!-- 组标题 -->
        <view class="batch-page__group-header">
          <view class="batch-page__group-icon" :class="`batch-page__group-icon--${group.color}`">
            <text class="material-icons-round">{{ group.icon }}</text>
          </view>
          <view class="batch-page__group-info">
            <text class="batch-page__group-title">{{ group.title }}</text>
            <text class="batch-page__group-sub">{{ group.items.length }}只犬需处理</text>
          </view>
          <view class="batch-page__toggle" @click="toggleGroupAll(group)">
            <text class="batch-page__toggle-text">
              {{ isGroupAllSelected(group) ? '取消全选' : '全选' }}
            </text>
          </view>
        </view>

        <!-- 任务列表 -->
        <view class="batch-page__items">
          <view
            v-for="item in group.items"
            :key="item.id"
            class="batch-page__item"
            @click="toggleItem(item.id)"
          >
            <view class="batch-page__checkbox" :class="{ 'batch-page__checkbox--checked': selected.has(item.id) }">
              <text v-if="selected.has(item.id)" class="material-icons-round batch-page__check-icon">check</text>
            </view>
            <view class="batch-page__item-avatar">
              <text class="material-icons-round">pets</text>
            </view>
            <view class="batch-page__item-body">
              <text class="batch-page__item-name">{{ item.dogName }}</text>
              <text class="batch-page__item-detail">{{ item.detail }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部固定操作栏 -->
    <view v-if="!loading && taskGroups.length > 0" class="batch-page__bottom">
      <view class="batch-page__bottom-inner">
        <view
          class="batch-page__complete-btn"
          :class="{ 'batch-page__complete-btn--disabled': selected.size === 0 }"
          @click="batchComplete"
        >
          <text class="material-icons-round batch-page__complete-icon">check_circle</text>
          <text class="batch-page__complete-text">完成选中 ({{ selected.size }})</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import { useCloudCall } from '@/composables/useCloudCall'

interface TaskItem {
  id: string
  dogId: string
  dogName: string
  detail: string
  taskType: string
}

interface TaskGroup {
  type: string
  title: string
  icon: string
  color: string
  items: TaskItem[]
}

const loading = ref(true)
const taskGroups = ref<TaskGroup[]>([])
const selected = reactive(new Set<string>())

const { run: fetchBatchTasks } = useCloudCall<{ data: TaskGroup[] }>('reminder-service', 'getBatchTasks')
const { run: completeTasks } = useCloudCall('reminder-service', 'batchComplete', {
  successMessage: '批量完成成功',
  showLoading: true,
  loadingText: '处理中...',
})

function isGroupAllSelected(group: TaskGroup): boolean {
  return group.items.every(item => selected.has(item.id))
}

function toggleGroupAll(group: TaskGroup) {
  const allSelected = isGroupAllSelected(group)
  group.items.forEach(item => {
    if (allSelected) {
      selected.delete(item.id)
    } else {
      selected.add(item.id)
    }
  })
}

function toggleItem(id: string) {
  if (selected.has(id)) {
    selected.delete(id)
  } else {
    selected.add(id)
  }
}

async function batchComplete() {
  if (selected.size === 0) return
  const ids = Array.from(selected)
  const res = await completeTasks({ taskIds: ids })
  if (res) {
    // 移除已完成的项
    ids.forEach(id => selected.delete(id))
    await loadData()
    // 如果没有剩余任务，返回上一页
    if (taskGroups.value.length === 0) {
      uni.navigateBack()
    }
  }
}

async function loadData() {
  loading.value = true
  try {
    const res = await fetchBatchTasks()
    if (res?.data) {
      taskGroups.value = res.data
    }
  } finally {
    loading.value = false
  }
}

onLoad(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.batch-page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

/* ---- 任务分组列表 ---- */
.batch-page__body {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);
}

/* ---- 组卡片 ---- */
.batch-page__group {
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.batch-page__group-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: var(--space-card) var(--space-card) 12px var(--space-card-left);
}

.batch-page__group-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .material-icons-round {
    font-size: 18px;
    color: #fff;
  }

  &--blue { background: var(--blue); }
  &--green { background: var(--green); }
  &--amber { background: var(--amber); }
  &--plum { background: var(--plum); }
  &--rose { background: var(--rose); }
  &--teal { background: var(--teal); }
  &--red { background: var(--red); }
}

.batch-page__group-info {
  flex: 1;
  min-width: 0;
}

.batch-page__group-title {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  display: block;
}

.batch-page__group-sub {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
  display: block;
}

.batch-page__toggle {
  padding: 6px 12px;
  border-radius: var(--radius-btn);
  background: var(--primary-soft);
  transition: all 0.12s ease;

  &:active {
    transform: scale(0.92);
    opacity: 0.85;
  }
}

.batch-page__toggle-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
}

/* ---- 任务条目 ---- */
.batch-page__items {
  padding: 0 var(--space-card) var(--space-card) var(--space-card-left);
  display: flex;
  flex-direction: column;
  gap: var(--space-group-gap);
}

.batch-page__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-row);
  background: var(--bg);
  transition: all 0.12s ease;

  &:active {
    transform: scale(0.98);
    opacity: 0.85;
  }
}

.batch-page__checkbox {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-checkbox);
  border: 2px solid var(--text-4);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;

  &--checked {
    background: var(--primary);
    border-color: var(--primary);
  }
}

.batch-page__check-icon {
  font-size: 14px;
  color: #fff;
}

.batch-page__item-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .material-icons-round {
    font-size: 16px;
    color: #fff;
  }
}

.batch-page__item-body {
  flex: 1;
  min-width: 0;
}

.batch-page__item-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  display: block;
}

.batch-page__item-detail {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
  display: block;
}

/* ---- 底部固定操作栏 ---- */
.batch-page__bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--card);
  box-shadow: 0 -2px 12px rgba(234, 62, 119, 0.06);
  z-index: 100;
}

.batch-page__bottom-inner {
  padding: 12px var(--space-page) env(safe-area-inset-bottom, 20px);
}

.batch-page__complete-btn {
  height: 50px;
  border-radius: var(--radius-btn);
  background: var(--primary);
  box-shadow: var(--shadow-fab);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.12s ease;

  &:active {
    transform: scale(0.94);
    opacity: 0.85;
  }

  &--disabled {
    opacity: 0.4;
    pointer-events: none;
  }
}

.batch-page__complete-icon {
  font-size: 20px;
  color: #fff;
}

.batch-page__complete-text {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  color: #fff;
}
</style>
