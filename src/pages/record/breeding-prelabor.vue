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
        :loading="submitState === 'submitting'"
        :class="{ 'submit-btn--success': submitState === 'success' }"
        :disabled="!canSubmit || submitState === 'submitting'"
        @click="submit"
      >
        {{ submitButtonText }}
      </button>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { buildRecordFeedbackMessage, buildTaskFeedbackMessage, queueSubmitFeedback, wait } from '@/composables/useSubmitFeedback'
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
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')

const showTempWarning = computed(() => {
  const temp = parseFloat(details.temperature)
  return !isNaN(temp) && temp < 37.1 && temp > 0
})

const canSubmit = computed(() => {
  return !!date.value && !!selectedDog.value
})

const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '提交中...'
  if (submitState.value === 'success') return isTodo.value ? '已创建' : '已保存'
  return isTodo.value ? '创建待办' : '保存记录'
})

const { run: addRecord } = useCloudCall('breeding-service', 'addBreedingRecord', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

const { run: addTask } = useCloudCall('task-service', 'batchCreateManualTasks', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

const { run: fetchTask } = useCloudCall('task-service', 'getTask')
const { run: completeTask } = useCloudCall('task-service', 'completeTask', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

let prefillTaskId = ''

async function submit() {
  submitState.value = 'submitting'
  try {
    if (isTodo.value) {
      const rd = enableReminder.value
        ? (reminderDate.value || (date.value ? date.value + 1 * 86400000 : null))
        : null
      const res = await addTask({
        dogs: [{ dog_id: selectedDog.value?._id || '', dog_name: selectedDog.value?.name || '' }],
        card_type: 'individual',
        type: 'pre_labor',
        title: '临产监测',
        due_date: date.value,
        next_reminder_date: rd,
        details: {
          notes: form.notes || null,
        },
      })
      const created = res?.data?.created || 0
      const skipped = res?.data?.skipped || 0
      submitState.value = 'success'
      queueSubmitFeedback({
        message: buildTaskFeedbackMessage(created, skipped),
        createdDate: date.value,
        createdCount: created,
        skippedCount: skipped,
        refreshHome: true,
      })
      await wait(140)
      uni.navigateBack()
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
        submitState.value = 'success'
        const completedTaskIds = prefillTaskId ? [prefillTaskId] : []
        queueSubmitFeedback({
          message: buildRecordFeedbackMessage(1, prefillTaskId ? 1 : 0),
          completedTaskIds,
          suppressTaskIds: completedTaskIds,
          refreshHome: true,
        })
        await wait(140)
        uni.navigateBack()
      }
    }
  } catch {
    submitState.value = 'idle'
  } finally {
    if (submitState.value !== 'success') submitState.value = 'idle'
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
