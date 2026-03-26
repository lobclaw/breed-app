<template>
  <view class="notif">
    <view class="notif__section">
      <text class="notif__section-title">晨间摘要</text>
      <view class="notif__row">
        <text class="notif__label">每日推送时间</text>
        <picker mode="time" :value="summaryTime" @change="onTimeChange">
          <text class="notif__value">{{ summaryTime }}</text>
        </picker>
      </view>
    </view>

    <view class="notif__section">
      <text class="notif__section-title">推送类型</text>
      <view class="notif__row" v-for="item in notifTypes" :key="item.key">
        <text class="notif__label">{{ item.label }}</text>
        <switch :checked="item.enabled" @change="toggleType(item.key)" />
      </view>
    </view>

    <view class="notif__section">
      <text class="notif__section-title">其他</text>
      <view class="notif__row">
        <text class="notif__label">逾期任务提醒</text>
        <switch :checked="overdueEnabled" @change="overdueEnabled = !overdueEnabled; saveSettings()" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useCloudCall } from '@/composables/useCloudCall'

const summaryTime = ref('07:00')
const overdueEnabled = ref(true)

const notifTypes = reactive([
  { key: 'vaccination', label: '疫苗提醒', enabled: true },
  { key: 'deworming', label: '驱虫提醒', enabled: true },
  { key: 'breeding', label: '繁育提醒', enabled: true },
  { key: 'medication', label: '用药提醒', enabled: true },
  { key: 'care_group', label: '护理群组', enabled: true },
])

const { run: updateSettings } = useCloudCall('family-service', 'updateSettings')

function onTimeChange(e: any) {
  summaryTime.value = e.detail.value
  saveSettings()
}

function toggleType(key: string) {
  const item = notifTypes.find(n => n.key === key)
  if (item) item.enabled = !item.enabled
  saveSettings()
}

async function saveSettings() {
  await updateSettings({
    morning_summary_time: summaryTime.value,
  })
}

onMounted(() => {
  // V1 使用默认值，后续从 family settings 加载
})
</script>

<style scoped>
.notif { min-height: 100vh; background: #f5f5f5; }
.notif__section { background: #fff; margin: 16rpx 32rpx; border-radius: 16rpx; padding: 24rpx; }
.notif__section-title { font-size: 28rpx; font-weight: 600; color: #333; margin-bottom: 16rpx; display: block; }
.notif__row { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.notif__row:last-child { border-bottom: none; }
.notif__label { font-size: 28rpx; color: #333; }
.notif__value { font-size: 28rpx; color: #007AFF; }
</style>
