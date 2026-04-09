<template>
  <view class="page">
    <BPageHeader title="录入疾病记录" />

    <view class="form-body">
      <!-- 选择犬只 -->
      <view class="field-group">
        <view class="field-label"><text>选择犬只</text></view>
        <BDogPicker v-model="selectedDogs" :multiple="true" title="选择犬只" />
      </view>

      <!-- 病症类型 -->
      <view class="field-group">
        <view class="field-label"><text>病症类型</text></view>
        <view class="pill-options">
          <view
            v-for="c in conditionTypes"
            :key="c"
            class="pill-option"
            :class="{ active: details.condition === c }"
            @click="details.condition = c"
            @longpress="PRESET_CONDITION_TYPES.includes(c) ? undefined : deleteCustomCondition(c)"
          >
            <text>{{ c }}</text>
          </view>
          <view
            v-if="customCondition && !conditionTypes.includes(customCondition)"
            class="pill-option"
            :class="{ active: details.condition === customCondition }"
            @click="details.condition = customCondition"
          >
            <text>{{ customCondition }}</text>
          </view>
          <view class="pill-add" @click="addCustomCondition">
            <text class="material-icons-round" style="font-size: 14px;">add</text>
            <text>自定义</text>
          </view>
        </view>
      </view>

      <!-- 严重程度 -->
      <view class="field-group">
        <view class="field-label"><text>严重程度</text></view>
        <view class="pill-select">
          <view
            v-for="s in severityLevels"
            :key="s"
            class="pill-select__item"
            :class="{ 'pill-select__item--active': details.severity === s }"
            @click="details.severity = s"
          >
            <text>{{ s }}</text>
          </view>
        </view>
      </view>

      <!-- 日期 + 待办 + 下次提醒（公共组件） -->
      <BFormOptions
        v-model:date="date"
        v-model:isTodo="isTodo"
        v-model:enableReminder="enableReminder"
        v-model:reminderDate="reminderDate"
        :reminderDays="7"
        :hideTodo="true"
        dateLabel="发病日期"
      />

      <!-- 治疗状态 -->
      <view class="field-group">
        <view class="field-label"><text>治疗状态</text></view>
        <view class="pill-select">
          <view
            v-for="s in treatmentStatuses"
            :key="s"
            class="pill-select__item"
            :class="{ 'pill-select__item--active': details.treatment_status === s }"
            @click="details.treatment_status = s"
          >
            <text>{{ s }}</text>
          </view>
        </view>
      </view>

      <!-- 费用 -->
      <view class="field-group">
        <view class="field-label">
          <text>费用</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <view class="input-prefix-wrapper">
          <text class="input-prefix">¥</text>
          <input v-model="costInput" class="form-input form-input--prefixed" type="digit" placeholder="请输入金额" />
        </view>
      </view>

      <!-- 备注 -->
      <view class="field-group">
        <view class="field-label">
          <text>备注</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <textarea v-model="notes" class="form-textarea" :auto-height="true" placeholder="描述症状详情..." />
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
        保存记录
      </button>
    </view>

    <BModal
      v-model:visible="showDeleteConfirm"
      :title="`删除「${pendingDeleteVal}」？`"
      confirmText="删除"
      :danger="true"
      @confirm="handleDeleteConfirm"
    />

    <!-- 自定义病症输入弹窗 -->
    <BModal
      v-model:visible="showCustomModal"
      title="自定义病症"
      @confirm="onCustomConfirm"
    >
      <view class="custom-input-wrap">
        <input
          v-model="customInput"
          class="custom-input"
          placeholder="输入病症名称"
          :focus="showCustomModal"
        />
      </view>
    </BModal>

    <!-- 保存后：是否需要用药 -->
    <BModal
      v-model:visible="showMedPrompt"
      title="需要用药吗？"
      confirmText="去创建用药"
      cancelText="暂不需要"
      @confirm="goToMedication"
      @cancel="finishAndBack"
    >
      <view style="text-align: center; padding: 8px 0;">
        <text style="font-size: 14px; color: var(--text-2);">可以为生病的犬只创建连续用药任务</text>
      </view>
    </BModal>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { useAuth } from '@/composables/useAuth'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BModal from '@/components/layout/BModal.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BFormOptions from '@/components/form/BFormOptions.vue'

const { currentFamily, loadFamily } = useAuth()

const selectedDogs = ref<any[]>([])
const date = ref<number | null>(null)
const notes = ref('')
const costInput = ref('')
const details = reactive<Record<string, any>>({ treatment_status: '观察中', severity: '轻微' })
const fromTask = ref(false)
const submitting = ref(false)
const isTodo = ref(false)
const enableReminder = ref(false)
const reminderDate = ref<number | null>(null)
const showMedPrompt = ref(false)
const savedRecordId = ref('')

const PRESET_CONDITION_TYPES = ['感冒', '腹泻', '寄生虫', '皮肤病', '眼部', '骨骼', '犬瘟', '细小', '其他']
const deletedCustomConditions = ref<string[]>([])
const conditionTypes = computed(() => {
  const custom = (currentFamily.value?.settings?.custom_condition_types || [])
    .filter((v: string) => !deletedCustomConditions.value.includes(v))
  const all = [...PRESET_CONDITION_TYPES, ...custom]
  return [...new Set(all)]
})
const customCondition = ref('')
const showCustomModal = ref(false)
const customInput = ref('')
const showDeleteConfirm = ref(false)
const pendingDeleteVal = ref('')
let confirmDeleteFn: (() => Promise<void>) | null = null

function addCustomCondition() {
  customInput.value = ''
  showCustomModal.value = true
}

const { run: updateFamilySettings } = useCloudCall('family-service', 'updateSettings')

function deleteCustomCondition(val: string) {
  pendingDeleteVal.value = val
  confirmDeleteFn = async () => {
    uni.vibrateShort()
    deletedCustomConditions.value.push(val)
    if (details.condition === val) details.condition = ''
    if (customCondition.value === val) customCondition.value = ''
    const existing = currentFamily.value?.settings?.custom_condition_types || []
    const updated = existing.filter((v: string) => v !== val)
    try {
      await updateFamilySettings({ custom_condition_types: updated })
      await loadFamily()
      deletedCustomConditions.value = deletedCustomConditions.value.filter(v => v !== val)
    } catch {
      deletedCustomConditions.value = deletedCustomConditions.value.filter(v => v !== val)
      uni.showToast({ title: '删除失败', icon: 'none' })
    }
  }
  showDeleteConfirm.value = true
}

async function handleDeleteConfirm() {
  if (confirmDeleteFn) { await confirmDeleteFn(); confirmDeleteFn = null }
}

async function onCustomConfirm() {
  const val = customInput.value.trim()
  if (!val) { showCustomModal.value = false; return }

  customCondition.value = val
  details.condition = val
  showCustomModal.value = false

  if (!PRESET_CONDITION_TYPES.includes(val)) {
    const existing = currentFamily.value?.settings?.custom_condition_types || []
    if (!existing.includes(val)) {
      await updateFamilySettings({ custom_condition_types: [...existing, val] })
      await loadFamily()
    }
  }
}
const severityLevels = ['轻微', '中等', '严重']
const treatmentStatuses = ['观察中', '治疗中', '已康复', '慢性管理']

const canSubmit = computed(() => {
  return selectedDogs.value.length > 0 && !!date.value
})

// 日期/提醒相关逻辑由 BFormOptions 组件处理

function buildDetails() {
  const d: Record<string, any> = {}
  if (details.condition) d.condition = details.condition
  d.treatment_status = details.treatment_status || '观察中'
  d.start_date = date.value
  if (details.severity) d.severity = details.severity
  const rd = reminderDate.value || (date.value ? date.value + 7 * 86400000 : null)
  if (enableReminder.value && rd) d.next_reminder_date = rd
  return d
}

const { run: batchAddRecord } = useCloudCall('health-service', 'batchAddHealthRecords', {
  showLoading: true,
  loadingText: '保存中...',
})

const { run: fetchTask } = useCloudCall('task-service', 'getTask')

async function submit() {
  submitting.value = true
  try {
    // 批量录入健康记录（一次云调用）
    const res = await batchAddRecord({
      dog_ids: selectedDogs.value.map((d: any) => d._id),
      type: 'illness',
      date: date.value,
      cost: costInput.value ? parseFloat(costInput.value) : null,
      notes: notes.value || null,
      details: buildDetails(),
      skip_reminder: !enableReminder.value,
    })

    const allCompletedTasks = res?.data?.completedTasks || []

    // 单犬时保存 recordId，供跳转用药页时关联疾病状态升级
    if (selectedDogs.value.length === 1 && res?.data?.records?.[0]?.recordId) {
      savedRecordId.value = res.data.records[0].recordId
    }

    if (allCompletedTasks.length > 0) {
      const names = allCompletedTasks.map((t: any) => t.dog_name).join('、')
      uni.showToast({ title: `自动完成 ${allCompletedTasks.length} 条待办（${names}）`, icon: 'none', duration: 2500 })
    }

    // 如果犬只还在治疗中，提示是否需要用药
    if (details.treatment_status !== '已康复') {
      showMedPrompt.value = true
    } else {
      setTimeout(() => uni.navigateBack(), 1000)
    }
  } finally {
    submitting.value = false
  }
}

onLoad(async (query) => {
  if (query?.taskId || query?.batchDogs) {
    fromTask.value = true
  }
  if (query?.taskId) {
    const res = await fetchTask(query.taskId)
    if (res?.data) {
      const task = res.data
      // 预选犬只
      if (task.dog_id && task.dog_name) {
        selectedDogs.value = [{ _id: task.dog_id, name: task.dog_name }]
      }
      // 预填表单详情
      const d = task.details
      if (d) {
        if (d.condition) details.condition = d.condition
        if (d.severity) details.severity = d.severity
        if (d.treatment_status) details.treatment_status = d.treatment_status
        if (d.cost) costInput.value = String(d.cost)
        if (d.notes) notes.value = d.notes
      }
    }
  }
  // 从批量卡片预选犬只（同步，零延迟）
  if (query?.batchDogs) {
    try {
      const dogs = JSON.parse(decodeURIComponent(query.batchDogs))
      selectedDogs.value = dogs
    } catch { /* ignore */ }
  }
  // 从批量卡片预填表单详情
  if (query?.details) {
    try {
      const d = JSON.parse(decodeURIComponent(query.details))
      if (d.condition) details.condition = d.condition
      if (d.severity) details.severity = d.severity
      if (d.treatment_status) details.treatment_status = d.treatment_status
      if (d.cost) costInput.value = String(d.cost)
      if (d.notes) notes.value = d.notes
    } catch { /* ignore */ }
  }
})

function goToMedication() {
  showMedPrompt.value = false
  const dogList = selectedDogs.value.map((d: any) => ({ _id: d._id, name: d.name }))
  const dogsParam = encodeURIComponent(JSON.stringify(dogList))
  // 单犬时传疾病记录 ID，用药页保存后自动将该疾病升级为"治疗中"
  const illnessParam = savedRecordId.value && selectedDogs.value.length === 1
    ? `&illnessRecordId=${savedRecordId.value}`
    : ''
  uni.redirectTo({ url: `/pages/record/health-medication?batchDogs=${dogsParam}${illnessParam}` })
}

function finishAndBack() {
  showMedPrompt.value = false
  setTimeout(() => uni.navigateBack(), 300)
}
</script>

<style lang="scss" scoped>
</style>
