<!--
  临产监测 (R-7)
  独立页面，从 breeding.vue 拆分
-->
<template>
  <view class="page">
    <BPageHeader title="录入临产监测" />

    <view class="form-body">
      <!-- 选择种母 -->
      <view class="field-group">
        <view class="field-label"><text>选择种母</text></view>
        <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" :readonly="dogLocked" />
      </view>

      <!-- 日期 + 待办 + 下次提醒（公共组件） -->
      <BFormOptions
        v-model:date="date"
        v-model:isTodo="isTodo"
        v-model:enableReminder="enableReminder"
        v-model:reminderDate="reminderDate"
        :reminderDays="1"
        dateLabel="日期"
      />

      <!-- 体温 -->
      <view class="field-group">
        <view class="field-label"><text>体温 (°C)</text></view>
        <input v-model="details.temperature" class="form-input" type="digit" placeholder="如 37.5" />
      </view>

      <!-- 刨窝行为 -->
      <view class="field-group">
        <view class="field-label"><text>刨窝行为</text></view>
        <view class="toggle-row">
          <view
            class="toggle-track"
            :class="{ on: details.nesting_behavior }"
            @click="details.nesting_behavior = !details.nesting_behavior"
          >
            <view class="toggle-knob" />
          </view>
          <text class="toggle-label">{{ details.nesting_behavior ? '有' : '无' }}</text>
        </view>
      </view>

      <!-- 食欲变化 -->
      <view class="field-group">
        <view class="field-label">
          <text>食欲变化</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <input v-model="details.appetite_change" class="form-input" placeholder="如：食欲减退" />
      </view>

      <!-- 其他征兆 -->
      <view class="field-group">
        <view class="field-label">
          <text>其他征兆</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <input v-model="details.other_signs" class="form-input" placeholder="如：焦躁、喘气" />
      </view>

      <!-- 备注 -->
      <view class="field-group">
        <view class="field-label">
          <text>备注</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <textarea v-model="form.notes" class="form-textarea" :auto-height="true" placeholder="补充说明" />
      </view>

      <!-- 体温预警 -->
      <view v-if="showTempWarning" class="temp-warning">
        <text class="material-icons-round" style="font-size:18px;color:var(--amber);">warning</text>
        <text>体温低于 37.1°C，注意观察，可能 24 小时内生产</text>
      </view>

    </view>

    <!-- 固定底部按钮 -->
    <view class="fixed-bottom">
      <button
        class="submit-btn"
        :loading="submitting"
        :disabled="!canSubmit || submitting"
        @click="submit"
      >
        {{ isTodo ? '创建待办' : '保存记录' }}
      </button>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BFormOptions from '@/components/form/BFormOptions.vue'

let cycleId = ''
const selectedDog = ref<any>(null)
const dogLocked = ref(false)

const form = reactive({
  notes: '',
})

const date = ref<number | null>(null)
const isTodo = ref(false)
const enableReminder = ref(true)
const reminderDate = ref<number | null>(null)
const details = reactive<Record<string, any>>({
  nesting_behavior: false,
})
const submitting = ref(false)

const showTempWarning = computed(() => {
  const temp = parseFloat(details.temperature)
  return !isNaN(temp) && temp < 37.1 && temp > 0
})

const canSubmit = computed(() => {
  return !!date.value && !!selectedDog.value
})

const { run: addRecord } = useCloudCall('breeding-service', 'addBreedingRecord', {
  successMessage: '已保存',
  showLoading: true,
  loadingText: '保存中...',
})

const { run: addTask } = useCloudCall('task-service', 'createManualTask', {
  showLoading: true,
  loadingText: '创建待办中...',
})

const { run: fetchTask } = useCloudCall('task-service', 'getTask')
const { run: completeTask } = useCloudCall('task-service', 'completeTask')

let prefillTaskId = ''

async function submit() {
  submitting.value = true
  try {
    if (isTodo.value) {
      const rd = enableReminder.value
        ? (reminderDate.value || (date.value ? date.value + 1 * 86400000 : null))
        : null
      await addTask({
        card_type: 'individual',
        dog_id: selectedDog.value?._id || '',
        dog_name: selectedDog.value?.name || '',
        type: 'pre_labor',
        title: '临产监测',
        due_date: date.value,
        status: 'pending',
        priority: 'upcoming',
        next_reminder_date: rd,
        details: {
          notes: form.notes || null,
        },
      })
      uni.showToast({ title: '已创建待办', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 1000)
    } else {
      const d: Record<string, any> = {}
      if (details.temperature) d.temperature = parseFloat(details.temperature)
      d.nesting_behavior = !!details.nesting_behavior
      if (details.appetite_change) d.appetite_change = details.appetite_change
      if (details.other_signs) d.other_signs = details.other_signs

      const res = await addRecord({
        type: 'pre_labor',
        dog_id: selectedDog.value?._id || '',
        cycle_id: cycleId || undefined,
        date: date.value,
        cost: null,
        notes: form.notes || null,
        details: d,
        skip_reminder: !enableReminder.value,
      })
      if (res) {
        if (prefillTaskId) await completeTask(prefillTaskId)
        uni.navigateBack()
      }
    }
  } finally {
    submitting.value = false
  }
}

// 日期初始化和待办模式切换由 BFormOptions 组件内部处理

onLoad(async (query) => {
  cycleId = query?.cycleId || ''
  if (query?.dogId) {
    selectedDog.value = { _id: query.dogId, name: decodeURIComponent(query.dogName || ''), gender: '母', role: '种狗' }
    if (query.locked === 'true') dogLocked.value = true
  }
  if (query?.taskId) {
    prefillTaskId = query.taskId
    const res = await fetchTask(query.taskId)
    if (res?.data?.details) {
      const d = res.data.details
      if (d.notes) form.notes = d.notes
    }
  }
})
</script>

<style lang="scss" scoped>

.toggle-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toggle-track {
  width: 52px;
  height: 30px;
  border-radius: var(--radius-btn);
  background: var(--text-4);
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;

  &.on {
    background: var(--primary);
  }
}

.toggle-knob {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  position: absolute;
  top: 3px;
  left: 3px;
  transition: transform 0.2s;
  box-shadow: 0 1px 4px rgba(234, 62, 119, 0.06);

  .toggle-track.on & {
    transform: translateX(22px);
  }
}

.toggle-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}

.temp-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--amber-soft);
  border-radius: var(--radius-row);
  font-size: 13px;
  color: var(--amber);
  margin-bottom: 16px;
}

</style>
