<template>
  <view class="home">
    <!-- Zone 1: 状态摘要栏 -->
    <view class="home__summary">
      <view class="home__summary-item home__summary-item--overdue" @click="scrollToSection('overdue')">
        <text class="home__summary-count">{{ overdueTasks.length }}</text>
        <text class="home__summary-label">需处理</text>
      </view>
      <view class="home__summary-item home__summary-item--today" @click="scrollToSection('today')">
        <text class="home__summary-count">{{ todayTasks.length }}</text>
        <text class="home__summary-label">今日</text>
      </view>
      <view class="home__summary-item" @click="scrollToSection('upcoming')">
        <text class="home__summary-count">{{ upcomingTasks.length }}</text>
        <text class="home__summary-label">本周</text>
      </view>
    </view>

    <!-- Zone 2: 任务列表（简化版，第三批再升级为智能卡片） -->
    <scroll-view scroll-y class="home__tasks" :scroll-into-view="scrollTarget">
      <!-- 逾期 -->
      <view v-if="overdueTasks.length > 0" id="section-overdue" class="home__section">
        <text class="home__section-title home__section-title--overdue">需立即处理</text>
        <view v-for="task in overdueTasks" :key="task._id" class="home__task-card home__task-card--overdue">
          <view class="home__task-header">
            <text class="home__task-dog">{{ task.dog_name }}</text>
            <text class="home__task-badge home__task-badge--overdue">逾期</text>
          </view>
          <text class="home__task-title">{{ task.title }}</text>
          <view class="home__task-actions">
            <button size="mini" type="primary" @click="completeTask(task._id)">完成</button>
            <button size="mini" @click="postponeTask(task._id)">推迟</button>
          </view>
        </view>
      </view>

      <!-- 今日 -->
      <view v-if="todayTasks.length > 0" id="section-today" class="home__section">
        <text class="home__section-title home__section-title--today">今日待办</text>
        <view v-for="task in todayTasks" :key="task._id" class="home__task-card">
          <view class="home__task-header">
            <text class="home__task-dog">{{ task.dog_name }}</text>
            <text class="home__task-type">{{ task.type }}</text>
          </view>
          <text class="home__task-title">{{ task.title }}</text>
          <view class="home__task-actions">
            <button size="mini" type="primary" @click="completeTask(task._id)">完成</button>
          </view>
        </view>
      </view>

      <!-- 即将到来 -->
      <view v-if="upcomingTasks.length > 0" id="section-upcoming" class="home__section">
        <text class="home__section-title">即将到来</text>
        <view v-for="task in upcomingTasks" :key="task._id" class="home__task-card home__task-card--upcoming">
          <view class="home__task-header">
            <text class="home__task-dog">{{ task.dog_name }}</text>
            <text class="home__task-due">{{ formatDate(task.due_date) }}</text>
          </view>
          <text class="home__task-title">{{ task.title }}</text>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="allTasks.length === 0 && !loading" class="home__empty">
        <text class="home__empty-text">犬群一切正常</text>
        <text class="home__empty-sub">暂无待办事项</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCloudCall } from '@/composables/useCloudCall'

interface Task {
  _id: string
  dog_name: string
  title: string
  type: string
  due_date: number
  priority: string
  status: string
}

const allTasks = ref<Task[]>([])
const loading = ref(true)
const scrollTarget = ref('')

const { run: fetchTasks } = useCloudCall<{ data: Task[] }>('task-service', 'getHomeCards')
const { run: doComplete } = useCloudCall('task-service', 'completeTask', { successMessage: '已完成' })
const { run: doPostpone } = useCloudCall('task-service', 'postponeTask')

const overdueTasks = computed(() => allTasks.value.filter(t => t.priority === 'overdue'))
const todayTasks = computed(() => allTasks.value.filter(t => t.priority === 'today'))
const upcomingTasks = computed(() => allTasks.value.filter(t => t.priority === 'upcoming'))

function scrollToSection(section: string) {
  scrollTarget.value = `section-${section}`
}

function formatDate(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

async function loadTasks() {
  loading.value = true
  const result = await fetchTasks()
  if (result?.data) {
    allTasks.value = result.data
  }
  loading.value = false
}

async function completeTask(taskId: string) {
  await doComplete(taskId)
  await loadTasks()
}

async function postponeTask(taskId: string) {
  // 简化版：推迟到明天
  const tomorrow = Date.now() + 86400000
  await doPostpone(taskId, tomorrow)
  await loadTasks()
}

onMounted(() => {
  loadTasks()
})
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: #f5f5f5;
}

.home__summary {
  display: flex;
  justify-content: space-around;
  padding: 40rpx 32rpx 24rpx;
  background: #fff;
}

.home__summary-item {
  text-align: center;
  padding: 16rpx 32rpx;
  border-radius: 16rpx;
}

.home__summary-count {
  display: block;
  font-size: 48rpx;
  font-weight: 700;
}

.home__summary-item--overdue .home__summary-count { color: #FF3B30; }
.home__summary-item--today .home__summary-count { color: #FF9500; }

.home__summary-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
}

.home__tasks {
  padding: 24rpx 32rpx;
  height: calc(100vh - 200rpx);
}

.home__section {
  margin-bottom: 32rpx;
}

.home__section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #666;
  margin-bottom: 16rpx;
}

.home__section-title--overdue { color: #FF3B30; }
.home__section-title--today { color: #FF9500; }

.home__task-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.home__task-card--overdue {
  border-left: 6rpx solid #FF3B30;
}

.home__task-card--upcoming {
  opacity: 0.8;
}

.home__task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.home__task-dog {
  font-size: 30rpx;
  font-weight: 600;
}

.home__task-badge--overdue {
  font-size: 22rpx;
  color: #FF3B30;
  background: #FFF0F0;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.home__task-type {
  font-size: 22rpx;
  color: #999;
}

.home__task-due {
  font-size: 24rpx;
  color: #999;
}

.home__task-title {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 16rpx;
}

.home__task-actions {
  display: flex;
  gap: 16rpx;
}

.home__empty {
  text-align: center;
  padding: 120rpx 0;
}

.home__empty-text {
  display: block;
  font-size: 34rpx;
  color: #333;
  margin-bottom: 12rpx;
}

.home__empty-sub {
  font-size: 28rpx;
  color: #999;
}
</style>
