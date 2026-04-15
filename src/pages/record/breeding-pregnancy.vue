<!--
  孕检记录 (R-5)
  独立页面，从 breeding.vue 拆分
-->
<template>
  <view class="page">
    <BPageHeader title="录入孕检记录" />

    <view class="form-body">
      <!-- 选择种母 -->
      <view class="field-group">
        <view class="field-label"><text>选择种母</text></view>
        <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" :readonly="dogLocked" />
      </view>

      <view class="field-group">
        <view class="field-label"><text>检查日期</text></view>
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

      <!-- 确认怀孕 -->
      <view class="field-group">
        <view class="field-label"><text>确认怀孕</text></view>
        <view class="toggle-row">
          <view
            class="toggle-track"
            :class="{ on: details.confirmed === '是' }"
            @click="details.confirmed = details.confirmed === '是' ? '否' : '是'"
          >
            <view class="toggle-knob" />
          </view>
          <text class="toggle-label">{{ details.confirmed === '是' ? '是' : '否' }}</text>
        </view>
      </view>

      <!-- 幼崽数量 (conditional) -->
      <view v-if="details.confirmed === '是'" class="field-group">
        <view class="field-label"><text>幼崽数量</text></view>
        <input v-model="details.puppy_count" class="form-input" type="number" placeholder="B超估计数量" />
      </view>

      <!-- 费用 -->
      <view class="field-group">
        <view class="field-label">
          <text>费用</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <view class="input-prefix-wrapper">
          <text class="input-prefix">¥</text>
          <input v-model="costInput" class="form-input form-input--prefixed" type="digit" placeholder="0.00" />
        </view>
      </view>

      <!-- 图片 -->
      <view class="field-group">
        <view class="field-label">
          <text>检查图片</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <BImageUpload v-model="images" :max="6" />
      </view>

      <!-- 记录备注 -->
      <view class="field-group">
        <view class="field-label">
          <text>记录备注</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <textarea v-model="form.notes" class="form-textarea" :auto-height="true" placeholder="检查结果详情、医生建议等" />
      </view>

      <BExtraArrangementSection
        v-model:enabled="extraArrangementEnabled"
        v-model:kind="extraArrangementKind"
        v-model:dueDate="extraArrangementDate"
        v-model:notes="extraArrangementNotes"
      />

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
import BImageUpload from '@/components/form/BImageUpload.vue'
import BExtraArrangementSection from '@/components/form/BExtraArrangementSection.vue'
import { getDefaultExtraArrangementDate, type ExtraArrangementKind } from '@/utils/breedingExtraArrangement'

let cycleId = ''
const selectedDog = ref<any>(null)
const dogLocked = ref(false)

const form = reactive({
  notes: '',
})

const date = ref<number | null>(null)
const costInput = ref('')
const images = ref<string[]>([])
const details = reactive<Record<string, any>>({})
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const extraArrangementEnabled = ref(false)
const extraArrangementKind = ref<ExtraArrangementKind>('contact_doctor')
const extraArrangementDate = ref<number | null>(getDefaultExtraArrangementDate())
const extraArrangementNotes = ref('')
const dateChipActive = ref<'today' | 'yesterday' | 'dayBefore' | ''>('today')

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
    const cost = costInput.value ? parseFloat(costInput.value) : null
    const d: Record<string, any> = {}
    if (details.confirmed) d.confirmed = details.confirmed
    if (details.puppy_count) d.puppy_count = parseInt(details.puppy_count)
    if (images.value.length > 0) d.images = images.value

    const res = await addRecord({
      type: 'pregnancy_check',
      dog_id: selectedDog.value?._id || '',
      cycle_id: cycleId || undefined,
      date: date.value,
      cost: cost && cost > 0 ? cost : null,
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
    const taskDogName = query?.dogName ? decodeURIComponent(query.dogName) : ''
    selectedDog.value = {
      _id: query.dogId,
      name: taskDogName,
      gender: '母',
      role: '种狗',
    }
    if (query?.locked === 'true' || !!taskDogName) dogLocked.value = true
  }
  if (query?.taskId) {
    prefillTaskId = query.taskId
    const res = await fetchTask(query.taskId)
    if (res?.data?.dog_name && selectedDog.value?._id === res.data.dog_id) {
      selectedDog.value = {
        ...selectedDog.value,
        name: selectedDog.value.name || res.data.dog_name,
      }
      dogLocked.value = true
    }
    if (res?.data?.details) {
      const d = res.data.details
      if (d.cost) costInput.value = String(d.cost)
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

</style>
