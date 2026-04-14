<!--
  配种记录 (R-4)
  独立页面，从 breeding.vue 拆分
-->
<template>
  <view class="page">
    <BPageHeader title="录入配种记录" />

    <view class="form-body">
      <!-- 选择种母 -->
      <view class="field-group">
        <view class="field-label"><text>选择种母</text></view>
        <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" :readonly="dogLocked" />
      </view>

      <!-- 选择种公 -->
      <view class="field-group">
        <view class="field-label"><text>选择种公</text></view>
        <BDogPicker v-model="selectedSire" genderFilter="公" title="选择种公" />
      </view>

      <view class="field-group">
        <view class="field-label"><text>配种日期</text></view>
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

      <!-- 配种方式 -->
      <view class="field-group">
        <view class="field-label"><text>配种方式</text></view>
        <view class="pill-select">
          <view
            v-for="m in matingMethods"
            :key="m"
            class="pill-select__item"
            :class="{ 'pill-select__item--active': details.method === m }"
            @click="details.method = m"
          >
            <text>{{ m }}</text>
          </view>
        </view>
      </view>

      <!-- 第几次配种 -->
      <view class="field-group">
        <view class="field-label"><text>第几次配种</text></view>
        <view class="display-field">
          <text>第 {{ details.mating_number || 1 }} 次（本周期）</text>
        </view>
      </view>

      <!-- 自动计算卡片 -->
      <view class="field-group">
        <view class="field-label"><text>系统自动计算</text></view>
        <view class="auto-card">
          <view class="auto-card__row">
            <text class="material-icons-round auto-card__icon">event_available</text>
            <text class="auto-card__label">预计孕检日</text>
            <text class="auto-card__value">{{ estimatedCheckDate }}</text>
          </view>
          <picker mode="date" :value="manualDueDateStr" @change="onDueDateChange">
            <view class="auto-card__row" style="cursor: pointer;">
              <text class="material-icons-round auto-card__icon">child_friendly</text>
              <text class="auto-card__label">预计预产期</text>
              <text class="auto-card__value" :style="manualDueDate ? 'color: var(--primary);' : ''">{{ estimatedDueDate }}</text>
              <text class="material-icons-round" style="font-size: 16px; color: var(--text-3); margin-left: 4px;">edit</text>
            </view>
          </picker>
          <view class="auto-card__hint">
            <text class="material-icons-round" style="font-size:16px;color:var(--amber);">info_outline</text>
            <text>可手动修改预产期</text>
          </view>
        </view>
      </view>

      <BExtraArrangementSection
        v-model:enabled="extraArrangementEnabled"
        v-model:kind="extraArrangementKind"
        v-model:dueDate="extraArrangementDate"
        v-model:notes="extraArrangementNotes"
      />

      <!-- 借配费用 -->
      <view class="field-group">
        <view class="field-label">
          <text>借配费用</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <view class="input-prefix-wrapper">
          <text class="input-prefix">¥</text>
          <input v-model="costInput" class="form-input form-input--prefixed" type="digit" placeholder="0.00" />
        </view>
      </view>

      <!-- 备注 -->
      <view class="field-group">
        <view class="field-label">
          <text>备注</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <textarea v-model="form.notes" class="form-textarea" :auto-height="true" placeholder="配种情况、注意事项等" />
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
const selectedSire = ref<any>(null)

const form = reactive({
  notes: '',
})

const date = ref<number | null>(null)
const costInput = ref('')
const details = reactive<Record<string, any>>({
  method: '自然交配',
  mating_number: 1,
})
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const manualDueDate = ref<number | null>(null)
const extraArrangementEnabled = ref(false)
const extraArrangementKind = ref<ExtraArrangementKind>('contact_doctor')
const extraArrangementDate = ref<number | null>(getDefaultExtraArrangementDate())
const extraArrangementNotes = ref('')
const dateChipActive = ref<'today' | 'yesterday' | 'dayBefore' | ''>('today')

const matingMethods = ['自然交配', '人工授精']

const canSubmit = computed(() => {
  return !!date.value && !!selectedSire.value && !!selectedDog.value
})

const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '提交中...'
  if (submitState.value === 'success') return '已保存'
  return '保存记录'
})

const estimatedCheckDate = computed(() => {
  if (!date.value) return '--'
  const d = new Date(date.value + 21 * 86400000)
  return `${d.getMonth() + 1}月${d.getDate()}日`
})

const estimatedDueDate = computed(() => {
  const ts = manualDueDate.value || (date.value ? date.value + 59 * 86400000 : null)
  if (!ts) return '--'
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
})

const dateStr = computed(() => {
  if (!date.value) return ''
  const d = new Date(date.value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const manualDueDateStr = computed(() => {
  const ts = manualDueDate.value || (date.value ? date.value + 59 * 86400000 : null)
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

function onDueDateChange(e: any) {
  manualDueDate.value = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
}

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
const extraArrangementPayload = computed(() => {
  if (!extraArrangementEnabled.value || !extraArrangementDate.value) return undefined
  return {
    kind: extraArrangementKind.value || 'contact_doctor',
    due_date: extraArrangementDate.value,
    notes: extraArrangementNotes.value || null,
    anchor_type: 'cycle',
  }
})

async function submit() {
  submitState.value = 'submitting'
  try {
    const cost = costInput.value ? parseFloat(costInput.value) : null
    const res = await addRecord({
      type: 'mating',
      dog_id: selectedDog.value?._id || '',
      cycle_id: cycleId || undefined,
      date: date.value,
      cost: cost && cost > 0 ? cost : null,
      notes: form.notes || null,
      details: {
        sire_id: selectedSire.value?._id || '',
        sire_name: selectedSire.value?.name || '',
        method: details.method || '自然交配',
        mating_number: parseInt(details.mating_number) || 1,
        expected_checkup_date: date.value ? date.value + 21 * 86400000 : undefined,
        expected_due_date: manualDueDate.value || (date.value ? date.value + 59 * 86400000 : undefined),
        is_due_date_manual: !!manualDueDate.value,
      },
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
      if (d.method) details.method = d.method
      if (d.cost) costInput.value = String(d.cost)
      if (d.notes) form.notes = d.notes
    }
  }
})
</script>

<style lang="scss" scoped>

.display-field {
  width: 100%;
  height: 48px;
  border-radius: 14px;
  background: var(--card-dim);
  padding: 0 16px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-2);
  display: flex;
  align-items: center;
  border: 1px solid transparent;
}

.auto-card {
  background: var(--card-dim);
  border-radius: 14px;
  padding: 16px;

  &__row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;

    &:not(:last-child) {
      border-bottom: 1px solid rgba(184, 160, 138, 0.15);
    }
  }

  &__icon {
    font-size: 18px;
    color: var(--primary);
  }

  &__label {
    font-size: 13px;
    color: var(--text-2);
    flex: 1;
  }

  &__value {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding-top: 8px;

    text:not(.material-icons-round) {
      font-size: 12px;
      color: var(--text-3);
    }
  }
}

</style>
