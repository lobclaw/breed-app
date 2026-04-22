<template>
  <view class="page">
    <BPageHeader title="通知设置" />

    <!-- 推送总开关 -->
    <view class="toggle-group">
      <text class="toggle-group__label">推送总开关</text>
      <view class="toggle-card">
        <view class="option-row" @click="togglePushEnabled">
          <text class="option-row__text">接收推送通知</text>
          <view class="custom-toggle" :class="{ 'custom-toggle--on': pushEnabled }">
            <view class="custom-toggle__knob" />
          </view>
        </view>
      </view>
    </view>

    <!-- 提醒类型 -->
    <view class="toggle-group">
      <text class="toggle-group__label">提醒类型</text>
      <view class="toggle-card">
        <view v-for="item in notifTypes" :key="item.key" class="option-row" @click="item.disabled ? null : toggleType(item.key)">
          <view class="option-row__label-wrap">
            <text class="option-row__text">{{ item.label }}</text>
            <text v-if="item.sub" class="option-row__sub">{{ item.sub }}</text>
          </view>
          <view
            class="custom-toggle"
            :class="{ 'custom-toggle--on': item.enabled, 'custom-toggle--disabled': item.disabled }"
          >
            <view class="custom-toggle__knob" />
          </view>
        </view>
      </view>
    </view>

    <!-- 晨间摘要 -->
    <view class="toggle-group">
      <text class="toggle-group__label">晨间摘要</text>
      <view class="toggle-card">
        <view class="option-row" @click="toggleSummaryEnabled">
          <text class="option-row__text">每日晨间摘要</text>
          <view class="custom-toggle" :class="{ 'custom-toggle--on': summaryEnabled }">
            <view class="custom-toggle__knob" />
          </view>
        </view>
        <view class="option-row" v-if="summaryEnabled">
          <text class="option-row__text">推送时间</text>
          <picker mode="time" :value="summaryTime" @change="onTimeChange">
            <text class="time-value">{{ summaryTime }}</text>
          </picker>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import type { FamilySettings, NotificationTypes } from '@/types/family'

type NotificationTypeKey = keyof NotificationTypes

interface NotificationTypeItem {
  key: NotificationTypeKey
  label: string
  sub: string
  enabled: boolean
  disabled: boolean
}

const pushEnabled = ref(true)
const summaryEnabled = ref(true)
const summaryTime = ref('09:00')
const saveToken = ref(0)

const notifTypes = reactive<NotificationTypeItem[]>([
  { key: 'breeding', label: '繁育节点提醒', sub: '配种 / 孕检 / 预产期', enabled: true, disabled: false },
  { key: 'vaccination', label: '疫苗/驱虫提醒', sub: '', enabled: true, disabled: false },
  { key: 'medication', label: '每日用药提醒', sub: '', enabled: true, disabled: false },
  { key: 'care_group', label: '护理群组提醒', sub: '', enabled: true, disabled: false },
  { key: 'overdue', label: '逾期提醒', sub: '不可关闭', enabled: true, disabled: true },
])

const { run: updateSettings } = useCloudCall('family-service', 'updateSettings')
const { run: getFamilyInfo } = useCloudCall<{ data: { settings?: FamilySettings } }>('family-service', 'getFamilyInfo')

interface NotificationFormState {
  pushEnabled: boolean
  summaryEnabled: boolean
  summaryTime: string
  notificationTypes: NotificationTypes
}

function buildNotificationTypes(): NotificationTypes {
  const types: NotificationTypes = {
    breeding: true,
    vaccination: true,
    medication: true,
    care_group: true,
    overdue: true,
  }

  notifTypes.forEach((item) => {
    if (item.key === 'overdue') {
      types.overdue = true
      return
    }
    types[item.key] = item.enabled
  })

  return types
}

function captureState(): NotificationFormState {
  return {
    pushEnabled: pushEnabled.value,
    summaryEnabled: summaryEnabled.value,
    summaryTime: summaryTime.value,
    notificationTypes: { ...buildNotificationTypes() },
  }
}

function applyState(state: NotificationFormState) {
  pushEnabled.value = state.pushEnabled
  summaryEnabled.value = state.summaryEnabled
  summaryTime.value = state.summaryTime

  notifTypes.forEach((item) => {
    item.enabled = item.key === 'overdue'
      ? true
      : state.notificationTypes[item.key as NotificationTypeKey]
  })
}

function onTimeChange(e: any) {
  const prevState = captureState()
  summaryTime.value = e.detail.value
  saveSettings(prevState)
}

function togglePushEnabled() {
  const prevState = captureState()
  pushEnabled.value = !pushEnabled.value
  saveSettings(prevState)
}

function toggleSummaryEnabled() {
  const prevState = captureState()
  summaryEnabled.value = !summaryEnabled.value
  saveSettings(prevState)
}

function toggleType(key: string) {
  const prevState = captureState()
  const item = notifTypes.find(n => n.key === key)
  if (item && !item.disabled) item.enabled = !item.enabled
  saveSettings(prevState)
}

async function saveSettings(prevState: NotificationFormState) {
  const requestToken = ++saveToken.value
  const res = await updateSettings({
    push_enabled: pushEnabled.value,
    morning_summary_enabled: summaryEnabled.value,
    morning_summary_time: summaryTime.value,
    notification_types: buildNotificationTypes(),
  })

  if (!res && requestToken === saveToken.value) {
    applyState(prevState)
  }
}

onMounted(async () => {
  const res = await getFamilyInfo()
  if (res?.data?.settings) {
    const s = res.data.settings
    applyState({
      pushEnabled: s.push_enabled ?? true,
      summaryEnabled: s.morning_summary_enabled ?? true,
      summaryTime: s.morning_summary_time || '09:00',
      notificationTypes: {
        breeding: s.notification_types?.breeding ?? true,
        vaccination: s.notification_types?.vaccination ?? true,
        medication: s.notification_types?.medication ?? true,
        care_group: s.notification_types?.care_group ?? true,
        overdue: true,
      },
    })
  }
})
</script>

<style lang="scss" scoped>
/* ==================== TOGGLE GROUP ==================== */
.toggle-group {
  padding: 0 var(--space-page);
  margin-bottom: 20px;

  &__label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
    letter-spacing: 0.5px;
    padding: 0 4px 8px;
    display: block;
  }
}

.toggle-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 4px 16px;
  box-shadow: var(--shadow);
}

/* ==================== OPTION ROW ==================== */
.option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid rgba(216, 203, 189, 0.15);

  &:last-child { border-bottom: none; }

  &__label-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  &__text {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    flex: 1;
  }

  &__sub {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-3);
  }
}

/* ==================== CUSTOM TOGGLE ==================== */
.custom-toggle {
  width: 42px;
  height: 24px;
  border-radius: 12px;
  background: var(--text-4);
  position: relative;
  transition: background 0.2s ease;
  flex-shrink: 0;

  &__knob {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    position: absolute;
    top: 2px;
    left: 2px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    transition: left 0.2s ease;
  }

  &--on {
    background: var(--primary);
    .custom-toggle__knob { left: 20px; }
  }

  &--disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

/* ==================== TIME PICKER ==================== */
.time-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--primary);
  padding: 4px 12px;
  background: var(--primary-soft);
  border-radius: var(--radius-tag);
}
</style>
