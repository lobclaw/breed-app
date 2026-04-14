<!--
  异常终止 (R-9)
  独立页面，从 breeding.vue 拆分
-->
<template>
  <view class="page">
    <BPageHeader title="录入异常终止" />

    <view class="form-body">
      <!-- 选择犬只 -->
      <view class="field-group">
        <view class="field-label"><text>选择犬只</text></view>
        <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" :readonly="dogLocked" />
      </view>

      <view class="field-group">
        <view class="field-label"><text>日期</text></view>
        <picker mode="date" :value="dateStr" @change="onDateChange">
          <view class="form-input form-input--picker">
            <text>{{ dateStr || '请选择日期' }}</text>
            <text class="material-icons-round form-input__suffix">calendar_today</text>
          </view>
        </picker>
        <view class="date-chips">
          <text class="date-chip" :class="{ active: dateChipActive === 'today' }" @click="setDateChip('today')">今天</text>
          <text class="date-chip" :class="{ active: dateChipActive === 'yesterday' }" @click="setDateChip('yesterday')">昨天</text>
          <text class="date-chip" :class="{ active: dateChipActive === 'dayBefore' }" @click="setDateChip('dayBefore')">前天</text>
        </view>
      </view>

      <BExtraArrangementSection
        v-model:enabled="extraArrangementEnabled"
        v-model:kind="extraArrangementKind"
        v-model:dueDate="extraArrangementDate"
        v-model:notes="extraArrangementNotes"
      />

      <!-- 类型 -->
      <view class="field-group">
        <view class="field-label"><text>类型</text></view>
        <view class="pill-select">
          <view
            v-for="tt in terminationTypes"
            :key="tt"
            class="pill-select__item"
            :class="{ 'pill-select__item--active': details.termination_type === tt }"
            @click="details.termination_type = tt"
          >
            <text>{{ tt }}</text>
          </view>
        </view>
      </view>

      <!-- 备注 -->
      <view class="field-group">
        <view class="field-label">
          <text>备注</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <textarea v-model="form.notes" class="form-textarea" :auto-height="true" placeholder="补充说明" />
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
import { buildRecordFeedbackMessage, queueSubmitFeedback, wait } from '@/composables/useSubmitFeedback'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BExtraArrangementSection from '@/components/form/BExtraArrangementSection.vue'
import { getDefaultExtraArrangementDate, type ExtraArrangementKind } from '@/utils/breedingExtraArrangement'

let cycleId = ''
const selectedDog = ref<any>(null)
const dogLocked = ref(false)

const form = reactive({
  notes: '',
})

const date = ref<number | null>(null)
const details = reactive<Record<string, any>>({})
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const extraArrangementEnabled = ref(false)
const extraArrangementKind = ref<ExtraArrangementKind>('contact_doctor')
const extraArrangementDate = ref<number | null>(getDefaultExtraArrangementDate())
const extraArrangementNotes = ref('')
const dateChipActive = ref<'today' | 'yesterday' | 'dayBefore' | ''>('today')

const terminationTypes = ['流产', '死胎', '医疗终止', '确认未怀孕']

const canSubmit = computed(() => {
  return !!date.value && !!selectedDog.value
})

const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '提交中...'
  if (submitState.value === 'success') return '已保存'
  return '保存记录'
})

const { run: addRecord } = useCloudCall('breeding-service', 'addBreedingRecord', {
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
const dateStr = computed(() => {
  if (!date.value) return ''
  const d = new Date(date.value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const extraArrangementPayload = computed(() => {
  if (!extraArrangementEnabled.value || !extraArrangementDate.value) return undefined
  return {
    kind: extraArrangementKind.value || 'contact_doctor',
    due_date: extraArrangementDate.value,
    notes: extraArrangementNotes.value || null,
    anchor_type: 'cycle',
  }
})

function setDateChip(chip: 'today' | 'yesterday' | 'dayBefore') {
  dateChipActive.value = chip
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  if (chip === 'yesterday') now.setDate(now.getDate() - 1)
  if (chip === 'dayBefore') now.setDate(now.getDate() - 2)
  date.value = now.getTime()
}

function onDateChange(e: any) {
  date.value = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
  dateChipActive.value = ''
}

async function submit() {
  submitState.value = 'submitting'
  try {
    const d: Record<string, any> = {}
    if (details.termination_type) d.termination_type = details.termination_type

    const res = await addRecord({
      type: 'abnormal_termination',
      dog_id: selectedDog.value?._id || '',
      cycle_id: cycleId || undefined,
      date: date.value,
      cost: null,
      notes: form.notes || null,
      details: d,
      extra_arrangement: extraArrangementPayload.value,
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
  } catch {
    submitState.value = 'idle'
  } finally {
    if (submitState.value !== 'success') submitState.value = 'idle'
  }
}

onLoad(async (query) => {
  setDateChip('today')
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
</style>
