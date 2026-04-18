<template>
  <view class="page">
    <BPageHeader :title="pageTitle" />

    <view v-if="loading" class="loading-state">
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else class="form-body">
      <view v-if="!isEdit" class="field-group">
        <view class="field-label"><text>选择犬只</text></view>
        <BDogPicker v-model="selectedDogs" :multiple="true" title="选择犬只" />
      </view>

      <view v-else class="field-group">
        <view class="field-label"><text>记录类型</text></view>
        <view class="type-display">
          <text>{{ typeLabel }}</text>
        </view>
      </view>

      <template v-if="resolvedType === 'vaccination'">
        <view class="field-group">
          <view class="field-label"><text>疫苗类型</text></view>
          <view class="pill-select">
            <view
              v-for="vaccine in vaccineTypes"
              :key="vaccine"
              class="pill-select__item"
              :class="{ 'pill-select__item--active': details.vaccine_type === vaccine }"
              @click="details.vaccine_type = vaccine"
              @longpress="PRESET_VACCINE_TYPES.includes(vaccine) ? undefined : deleteCustomValue('vaccination', vaccine)"
            >
              <text>{{ vaccine }}</text>
            </view>
            <view
              v-if="customVaccine && !vaccineTypes.includes(customVaccine)"
              class="pill-select__item"
              :class="{ 'pill-select__item--active': details.vaccine_type === customVaccine }"
              @click="details.vaccine_type = customVaccine"
            >
              <text>{{ customVaccine }}</text>
            </view>
            <view class="pill-select__add" @click="openCustomModal('vaccination')">
              <text class="material-icons-round" style="font-size: 14px;">add</text>
              <text>自定义</text>
            </view>
          </view>
        </view>
      </template>

      <template v-if="resolvedType === 'deworming'">
        <view class="field-group">
          <view class="field-label"><text>驱虫类型</text></view>
          <view class="pill-select">
            <view
              v-for="dewormingType in dewormingTypes"
              :key="dewormingType.value"
              class="pill-select__item"
              :class="{ 'pill-select__item--active': details.deworming_type === dewormingType.value }"
              @click="details.deworming_type = dewormingType.value"
            >
              <text>{{ dewormingType.label }}</text>
            </view>
          </view>
        </view>

        <view class="field-group">
          <view class="field-label">
            <text>驱虫药品</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <view class="pill-options">
            <view
              v-for="drug in dewormDrugs"
              :key="drug"
              class="pill-option"
              :class="{ active: details.drug_name === drug }"
              @click="details.drug_name = drug"
              @longpress="isPresetDrug(drug) ? undefined : deleteCustomValue('deworming', drug)"
            >
              <text>{{ drug }}</text>
            </view>
            <view
              v-if="customDrug && !dewormDrugs.includes(customDrug)"
              class="pill-option"
              :class="{ active: details.drug_name === customDrug }"
              @click="details.drug_name = customDrug"
            >
              <text>{{ customDrug }}</text>
            </view>
            <view class="pill-add" @click="openCustomModal('deworming')">
              <text class="material-icons-round" style="font-size: 14px;">add</text>
              <text>自定义</text>
            </view>
          </view>
        </view>
      </template>

      <template v-if="resolvedType === 'illness'">
        <view class="field-group">
          <view class="field-label"><text>病症类型</text></view>
          <view class="pill-options">
            <view
              v-for="condition in conditionTypes"
              :key="condition"
              class="pill-option"
              :class="{ active: details.condition === condition }"
              @click="details.condition = condition"
              @longpress="PRESET_CONDITION_TYPES.includes(condition) ? undefined : deleteCustomValue('illness', condition)"
            >
              <text>{{ condition }}</text>
            </view>
            <view
              v-if="customCondition && !conditionTypes.includes(customCondition)"
              class="pill-option"
              :class="{ active: details.condition === customCondition }"
              @click="details.condition = customCondition"
            >
              <text>{{ customCondition }}</text>
            </view>
            <view class="pill-add" @click="openCustomModal('illness')">
              <text class="material-icons-round" style="font-size: 14px;">add</text>
              <text>自定义</text>
            </view>
          </view>
        </view>

        <view class="field-group">
          <view class="field-label"><text>严重程度</text></view>
          <view class="pill-select">
            <view
              v-for="severity in severityLevels"
              :key="severity"
              class="pill-select__item"
              :class="{ 'pill-select__item--active': details.severity === severity }"
              @click="details.severity = severity"
            >
              <text>{{ severity }}</text>
            </view>
          </view>
        </view>
      </template>

      <BFormOptions
        v-model:date="date"
        v-model:isTodo="isTodo"
        v-model:enableReminder="enableReminder"
        v-model:reminderDate="reminderDate"
        :reminderDays="reminderDays"
        :reminderLabel="reminderLabel"
        :reminderHint="reminderHint"
        :hideTodo="hideTodo"
        :dateLabel="dateLabel"
      />

      <template v-if="resolvedType === 'illness'">
        <view class="field-group">
          <view class="field-label"><text>治疗状态</text></view>
          <view class="pill-select">
            <view
              v-for="status in treatmentStatuses"
              :key="status"
              class="pill-select__item"
              :class="{ 'pill-select__item--active': details.treatment_status === status }"
              @click="details.treatment_status = status"
            >
              <text>{{ status }}</text>
            </view>
          </view>
        </view>
      </template>

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

      <view class="field-group">
        <view class="field-label">
          <text>备注</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <textarea
          v-model="notes"
          class="form-textarea"
          :auto-height="true"
          :placeholder="resolvedType === 'illness' ? '描述症状详情...' : '输入备注信息...'"
        />
      </view>
    </view>

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

    <BModal
      v-model:visible="showDeleteConfirm"
      :title="`删除「${pendingDeleteVal}」？`"
      confirmText="删除"
      :danger="true"
      @confirm="handleDeleteConfirm"
    />

    <BModal
      v-model:visible="showCustomModal"
      :title="customModalTitle"
      @confirm="handleCustomConfirm"
    >
      <view class="custom-input-wrap">
        <input
          v-model="customInput"
          class="custom-input"
          :placeholder="customModalPlaceholder"
          :focus="showCustomModal"
        />
      </view>
    </BModal>

    <BModal
      v-model:visible="showMedPrompt"
      title="需要用药吗？"
      confirmText="去创建用药"
      cancelText="暂不需要"
      @confirm="goToMedication"
      @cancel="finishAndBack"
    >
      <view class="med-prompt">
        <text class="med-prompt__text">可以为生病的犬只创建连续用药任务</text>
      </view>
    </BModal>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useCloudCall } from '@/composables/useCloudCall'
import { useAuth } from '@/composables/useAuth'
import { useRecordSubmitState } from '@/composables/useRecordSubmitState'
import { buildRecordFeedbackMessage, buildTaskFeedbackMessage, queueSubmitFeedback, wait } from '@/composables/useSubmitFeedback'
import { resolveHealthCreateRouteQuery } from '@/utils/recordFormRoutes'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BFormOptions from '@/components/form/BFormOptions.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BModal from '@/components/layout/BModal.vue'

type HealthRecordType = 'vaccination' | 'deworming' | 'illness'
type CustomModalKind = 'vaccination' | 'deworming' | 'illness' | ''
type DewormSubtype = 'internal' | 'external' | 'combo'

const props = withDefaults(defineProps<{
  mode: 'create' | 'edit'
  type?: HealthRecordType
  recordId?: string
  query?: Record<string, string>
}>(), {
  type: undefined,
  recordId: '',
  query: () => ({}),
})

const { currentFamily, loadFamily } = useAuth()

const isEdit = computed(() => props.mode === 'edit')
const loading = ref(false)
const currentRecord = ref<any>(null)
const selectedDogs = ref<any[]>([])
const date = ref<number | null>(null)
const notes = ref('')
const costInput = ref('')
const details = reactive<Record<string, any>>({})
const fromTask = ref(false)
const sourceTaskIds = ref<string[]>([])
const isTodo = ref(false)
const enableReminder = ref(false)
const reminderDate = ref<number | null>(null)
const showMedPrompt = ref(false)
const savedRecordId = ref('')

const resolvedType = computed<HealthRecordType | ''>(() => {
  return (isEdit.value ? currentRecord.value?.type : props.type) || ''
})

const typeLabels: Record<HealthRecordType, string> = {
  vaccination: '疫苗',
  deworming: '驱虫',
  illness: '疾病',
}

const pageTitle = computed(() => {
  if (isEdit.value) return '编辑健康记录'
  return resolvedType.value ? `录入${typeLabels[resolvedType.value]}记录` : '录入健康记录'
})

const typeLabel = computed(() => {
  if (!resolvedType.value) return ''
  return typeLabels[resolvedType.value]
})

const dateLabel = computed(() => {
  if (resolvedType.value === 'vaccination') return '接种日期'
  if (resolvedType.value === 'illness') return '发病日期'
  return '日期'
})

const submitIdleLabel = computed(() => {
  if (isEdit.value) return '保存修改'
  if (isTodo.value) return '创建待办'
  return '保存记录'
})

const submitSuccessLabel = computed(() => {
  if (isEdit.value) return '已保存'
  if (isTodo.value) return '已创建'
  return '已保存'
})

const { submitState, submitButtonText, markSubmitting, markSuccess, resetSubmitState } = useRecordSubmitState({
  idleLabel: submitIdleLabel,
  successLabel: submitSuccessLabel,
})

const reminderDays = computed(() => {
  if (resolvedType.value === 'illness') return 7
  const settings = currentFamily.value?.settings
  const isVaccination = resolvedType.value === 'vaccination'
  const puppyDays = isVaccination
    ? settings?.default_vaccine_interval_puppy ?? 21
    : settings?.default_deworming_interval_puppy ?? 14
  const adultDays = isVaccination
    ? settings?.default_vaccine_interval_adult ?? 365
    : settings?.default_deworming_interval_adult ?? 90

  if (selectedDogs.value.length === 0) return puppyDays

  const hasAdult = selectedDogs.value.some((dog: any) => dog.role === '种狗' || dog.role === '外部种公')
  const hasPuppy = selectedDogs.value.some((dog: any) => dog.role === '幼崽' || !dog.role)
  if (hasAdult && !hasPuppy) return adultDays
  if (hasPuppy && !hasAdult) return puppyDays
  return Math.min(puppyDays, adultDays)
})

const reminderLabel = computed(() => {
  if (isEdit.value || resolvedType.value === 'illness') return '下次提醒'
  return '创建下次待办'
})

const reminderHint = computed(() => {
  if (resolvedType.value === 'vaccination' || resolvedType.value === 'deworming') {
    return '建议日期已自动计算，可手动修改'
  }
  return '默认7天后，可手动修改'
})

const hideTodo = computed(() => {
  return isEdit.value || fromTask.value || resolvedType.value === 'illness'
})

const PRESET_VACCINE_TYPES = ['卫佳5', '卫佳8', '卫佳10', '狂犬']
const PRESET_CONDITION_TYPES = ['感冒', '腹泻', '寄生虫', '皮肤病', '眼部', '骨骼', '犬瘟', '细小', '其他']
const PRESET_DEWORMING_DRUGS: Record<DewormSubtype, string[]> = {
  internal: ['拜宠清', '海乐妙', '犬心保'],
  external: ['福来恩', '大宠爱'],
  combo: ['超可信', '博来恩'],
}

const dewormingTypes = [
  { label: '内驱', value: 'internal' },
  { label: '外驱', value: 'external' },
  { label: '内外同驱', value: 'combo' },
]

const severityLevels = ['轻微', '中等', '严重']
const treatmentStatuses = ['观察中', '治疗中', '已康复', '慢性管理']

const deletedCustomVaccines = ref<string[]>([])
const deletedCustomDrugs = ref<string[]>([])
const deletedCustomConditions = ref<string[]>([])
const customVaccine = ref('')
const customDrug = ref('')
const customCondition = ref('')
const showDeleteConfirm = ref(false)
const pendingDeleteVal = ref('')
let confirmDeleteFn: (() => Promise<void>) | null = null

const showCustomModal = ref(false)
const customModalKind = ref<CustomModalKind>('')
const customInput = ref('')

const customModalTitle = computed(() => {
  if (customModalKind.value === 'vaccination') return '自定义疫苗'
  if (customModalKind.value === 'deworming') return '自定义药品'
  return '自定义病症'
})

const customModalPlaceholder = computed(() => {
  if (customModalKind.value === 'vaccination') return '输入疫苗名称'
  if (customModalKind.value === 'deworming') return '输入药品名称'
  return '输入病症名称'
})

const vaccineTypes = computed(() => {
  const custom = (currentFamily.value?.settings?.custom_vaccine_types || [])
    .filter((value: string) => !deletedCustomVaccines.value.includes(value))
  return [...new Set([...PRESET_VACCINE_TYPES, ...custom])]
})

const dewormDrugs = computed(() => {
  const subtype = getDewormSubtype()
  const preset = PRESET_DEWORMING_DRUGS[subtype] || []
  const customSettings = (currentFamily.value?.settings?.custom_deworming_drugs || {
    internal: [],
    external: [],
    combo: [],
  }) as Record<DewormSubtype, string[]>
  const custom = (customSettings[subtype] || []).filter((value: string) => !deletedCustomDrugs.value.includes(value))
  return [...new Set([...preset, ...custom])]
})

const conditionTypes = computed(() => {
  const custom = (currentFamily.value?.settings?.custom_condition_types || [])
    .filter((value: string) => !deletedCustomConditions.value.includes(value))
  return [...new Set([...PRESET_CONDITION_TYPES, ...custom])]
})

const canSubmit = computed(() => {
  if (!resolvedType.value || !date.value) return false
  if (!isEdit.value && selectedDogs.value.length === 0) return false
  if (resolvedType.value === 'vaccination') return !!details.vaccine_type
  if (resolvedType.value === 'deworming') return !!details.deworming_type
  return !!details.condition
})

const { run: updateFamilySettings } = useCloudCall('family-service', 'updateSettings')
const { run: fetchTask } = useCloudCall('task-service', 'getTask')
const { run: batchAddTask } = useCloudCall('task-service', 'batchCreateManualTasks', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})
const { run: batchAddRecord } = useCloudCall('health-service', 'batchAddHealthRecords', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})
const { run: getRecord } = useCloudCall('health-service', 'getHealthRecordDetail', {
  showLoading: false,
})
const { run: updateRecord } = useCloudCall('health-service', 'updateHealthRecord', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})
const { run: checkDuplicateIllness } = useCloudCall('health-service', 'checkDuplicateIllness', {
  showLoading: false,
})

function getDewormSubtype(): DewormSubtype {
  const subtype = String(details.deworming_type || 'internal')
  if (subtype === 'external' || subtype === 'combo') return subtype
  return 'internal'
}

function resetFormState() {
  currentRecord.value = null
  selectedDogs.value = []
  date.value = null
  notes.value = ''
  costInput.value = ''
  fromTask.value = false
  sourceTaskIds.value = []
  isTodo.value = false
  enableReminder.value = false
  reminderDate.value = null
  showMedPrompt.value = false
  savedRecordId.value = ''
  customVaccine.value = ''
  customDrug.value = ''
  customCondition.value = ''

  Object.keys(details).forEach(key => {
    delete details[key]
  })
  if (props.type === 'deworming') {
    details.deworming_type = 'internal'
  }
  if (props.type === 'illness') {
    details.treatment_status = '观察中'
    details.severity = '轻微'
  }
}

function applyPrefillDetails(prefill: Record<string, any>) {
  if (!prefill) return

  if (resolvedType.value === 'vaccination' && prefill.vaccine_type) {
    details.vaccine_type = prefill.vaccine_type
  }
  if (resolvedType.value === 'deworming') {
    if (prefill.deworming_type) details.deworming_type = prefill.deworming_type
    if (prefill.drug_name) details.drug_name = prefill.drug_name
  }
  if (resolvedType.value === 'illness') {
    if (prefill.condition) details.condition = prefill.condition
    if (prefill.severity) details.severity = prefill.severity
    if (prefill.treatment_status) details.treatment_status = prefill.treatment_status
  }
  if (prefill.cost) costInput.value = String(prefill.cost)
  if (prefill.notes) notes.value = prefill.notes
}

function applyTaskDog(task: any) {
  if (!task?.dog_id) return
  if (selectedDogs.value.length > 0) return
  selectedDogs.value = [{
    _id: task.dog_id,
    name: task.dog_name || '',
  }]
}

async function loadCreateQuery() {
  resetFormState()
  const routeQuery = resolveHealthCreateRouteQuery(props.query)
  fromTask.value = routeQuery.fromTask
  sourceTaskIds.value = routeQuery.sourceTaskIds
  selectedDogs.value = routeQuery.selectedDogs
  applyPrefillDetails(routeQuery.details)

  if (routeQuery.sourceTaskIds[0]) {
    const taskRes = await fetchTask(routeQuery.sourceTaskIds[0])
    if (taskRes?.data) {
      applyTaskDog(taskRes.data)
      applyPrefillDetails(taskRes.data.details || {})
    }
  }
}

async function loadEditRecord() {
  if (!props.recordId) {
    loading.value = false
    return
  }

  loading.value = true
  try {
    resetFormState()
    const record = await getRecord({ id: props.recordId })
    if (!record) return

    currentRecord.value = record
    date.value = record.date || null
    notes.value = record.notes || ''
    costInput.value = record.cost ? String(record.cost) : ''
    Object.assign(details, record.details || {})
    enableReminder.value = Boolean(record.details?.next_reminder_date)
    reminderDate.value = record.details?.next_reminder_date || null

    if (record.type === 'illness' && !details.treatment_status) {
      details.treatment_status = '观察中'
    }
    if (record.type === 'illness' && !details.severity) {
      details.severity = '轻微'
    }
    if (record.type === 'deworming' && !details.deworming_type) {
      details.deworming_type = 'internal'
    }
  } finally {
    loading.value = false
  }
}

function openCustomModal(kind: CustomModalKind) {
  customModalKind.value = kind
  customInput.value = ''
  showCustomModal.value = true
}

async function saveCustomValue(kind: CustomModalKind, value: string) {
  if (!value) return

  if (kind === 'vaccination') {
    customVaccine.value = value
    details.vaccine_type = value
    if (!PRESET_VACCINE_TYPES.includes(value)) {
      const existing = currentFamily.value?.settings?.custom_vaccine_types || []
      if (!existing.includes(value)) {
        await updateFamilySettings({ custom_vaccine_types: [...existing, value] })
        await loadFamily()
      }
    }
    return
  }

  if (kind === 'deworming') {
    customDrug.value = value
    details.drug_name = value
    const subtype = getDewormSubtype()
    const preset = PRESET_DEWORMING_DRUGS[subtype] || []
    if (!preset.includes(value)) {
      const customSettings = (currentFamily.value?.settings?.custom_deworming_drugs || {
        internal: [],
        external: [],
        combo: [],
      }) as Record<DewormSubtype, string[]>
      const existing = customSettings[subtype] || []
      if (!existing.includes(value)) {
        await updateFamilySettings({
          custom_deworming_drugs: {
            ...customSettings,
            [subtype]: [...existing, value],
          },
        })
        await loadFamily()
      }
    }
    return
  }

  customCondition.value = value
  details.condition = value
  if (!PRESET_CONDITION_TYPES.includes(value)) {
    const existing = currentFamily.value?.settings?.custom_condition_types || []
    if (!existing.includes(value)) {
      await updateFamilySettings({ custom_condition_types: [...existing, value] })
      await loadFamily()
    }
  }
}

async function handleCustomConfirm() {
  const value = customInput.value.trim()
  showCustomModal.value = false
  if (!value || !customModalKind.value) return
  await saveCustomValue(customModalKind.value, value)
}

async function deleteCustomValue(kind: CustomModalKind, value: string) {
  pendingDeleteVal.value = value
  confirmDeleteFn = async () => {
    if (kind === 'vaccination') {
      deletedCustomVaccines.value.push(value)
      if (details.vaccine_type === value) details.vaccine_type = ''
      if (customVaccine.value === value) customVaccine.value = ''
      const existing = currentFamily.value?.settings?.custom_vaccine_types || []
      await updateFamilySettings({ custom_vaccine_types: existing.filter((item: string) => item !== value) })
      await loadFamily()
      deletedCustomVaccines.value = deletedCustomVaccines.value.filter(item => item !== value)
      return
    }

    if (kind === 'deworming') {
      deletedCustomDrugs.value.push(value)
      if (details.drug_name === value) details.drug_name = ''
      if (customDrug.value === value) customDrug.value = ''
      const subtype = getDewormSubtype()
      const customSettings = (currentFamily.value?.settings?.custom_deworming_drugs || {
        internal: [],
        external: [],
        combo: [],
      }) as Record<DewormSubtype, string[]>
      await updateFamilySettings({
        custom_deworming_drugs: {
          ...customSettings,
          [subtype]: (customSettings[subtype] || []).filter((item: string) => item !== value),
        },
      })
      await loadFamily()
      deletedCustomDrugs.value = deletedCustomDrugs.value.filter(item => item !== value)
      return
    }

    deletedCustomConditions.value.push(value)
    if (details.condition === value) details.condition = ''
    if (customCondition.value === value) customCondition.value = ''
    const existing = currentFamily.value?.settings?.custom_condition_types || []
    await updateFamilySettings({ custom_condition_types: existing.filter((item: string) => item !== value) })
    await loadFamily()
    deletedCustomConditions.value = deletedCustomConditions.value.filter(item => item !== value)
  }
  showDeleteConfirm.value = true
}

async function handleDeleteConfirm() {
  if (!confirmDeleteFn) return
  try {
    await confirmDeleteFn()
  } catch {
    uni.showToast({ title: '删除失败', icon: 'none' })
  } finally {
    confirmDeleteFn = null
  }
}

function isPresetDrug(drug: string) {
  const subtype = getDewormSubtype()
  return (PRESET_DEWORMING_DRUGS[subtype] || []).includes(drug)
}

function buildReminderDate() {
  if (!enableReminder.value || !date.value) return null
  return reminderDate.value || (date.value + reminderDays.value * 86400000)
}

function buildDetails() {
  const nextReminderDate = buildReminderDate()
  const built: Record<string, any> = {}

  if (resolvedType.value === 'vaccination') {
    built.vaccine_type = details.vaccine_type
    if (nextReminderDate) built.next_reminder_date = nextReminderDate
  }

  if (resolvedType.value === 'deworming') {
    built.deworming_type = details.deworming_type
    if (details.drug_name) built.drug_name = details.drug_name
    if (nextReminderDate) built.next_reminder_date = nextReminderDate
  }

  if (resolvedType.value === 'illness') {
    built.condition = details.condition
    built.treatment_status = details.treatment_status || '观察中'
    built.start_date = date.value
    if (details.severity) built.severity = details.severity
    if (nextReminderDate) built.next_reminder_date = nextReminderDate
  }

  return built
}

async function handleDuplicateIllnessIfNeeded() {
  if (resolvedType.value !== 'illness') return false

  const condition = String(details.condition || '').trim()
  const treatmentStatus = details.treatment_status || '观察中'
  if (!condition || treatmentStatus === '已康复') return false

  const dogIds = isEdit.value
    ? [currentRecord.value?.dog_id].filter(Boolean)
    : selectedDogs.value.map((dog: any) => dog._id)
  if (dogIds.length === 0) return false

  const duplicateRes = await checkDuplicateIllness({
    dog_ids: dogIds,
    condition,
    exclude_record_id: isEdit.value ? props.recordId : undefined,
  })
  const duplicates = duplicateRes?.data?.duplicates || []
  if (duplicates.length === 0) return false

  if (duplicates.length === 1 && dogIds.length === 1) {
    const duplicate = duplicates[0]
    await new Promise<void>((resolve) => {
      uni.showModal({
        title: '已有进行中的疾病',
        content: `${isEdit.value ? currentRecord.value?.dog_name : selectedDogs.value[0]?.name || '该犬'} 已有未康复的「${condition}」记录，去编辑原记录吗？`,
        confirmText: '去编辑',
        cancelText: '知道了',
        success: (modalRes) => {
          if (modalRes.confirm && duplicate.recordId) {
            if (isEdit.value) {
              uni.redirectTo({ url: `/pages/record/health-edit?id=${duplicate.recordId}` })
            } else {
              uni.navigateTo({ url: `/pages/record/health-edit?id=${duplicate.recordId}` })
            }
          }
          resolve()
        },
        fail: () => resolve(),
      })
    })
  } else {
    const nameMap = new Map(selectedDogs.value.map((dog: any) => [dog._id, dog.name]))
    if (isEdit.value && currentRecord.value?.dog_id) {
      nameMap.set(currentRecord.value.dog_id, currentRecord.value.dog_name)
    }
    const dogNames = [...new Set(duplicates.map((item: any) => nameMap.get(item.dogId)).filter(Boolean))]
    uni.showToast({
      title: `${dogNames.join('、')} 已有进行中的「${condition}」记录`,
      icon: 'none',
    })
  }

  return true
}

async function submitCreateRecord() {
  const cost = costInput.value ? parseFloat(costInput.value) : null

  if (isTodo.value && resolvedType.value !== 'illness') {
    const result = await batchAddTask({
      dogs: selectedDogs.value.map((dog: any) => ({ dog_id: dog._id, dog_name: dog.name })),
      card_type: 'individual',
      type: resolvedType.value,
      title: resolvedType.value === 'vaccination'
        ? (details.vaccine_type ? `疫苗 · ${details.vaccine_type}` : '疫苗')
        : '驱虫',
      due_date: date.value,
      next_reminder_date: buildReminderDate(),
      details: {
        vaccine_type: resolvedType.value === 'vaccination' ? (details.vaccine_type || null) : null,
        deworming_type: resolvedType.value === 'deworming' ? (details.deworming_type || null) : null,
        drug_name: resolvedType.value === 'deworming' ? (details.drug_name || null) : null,
        cost: cost && cost > 0 ? cost : null,
        notes: notes.value || null,
      },
    })

    const created = result?.data?.created || 0
    const skipped = result?.data?.skipped || 0
    markSuccess()
    queueSubmitFeedback({
      message: buildTaskFeedbackMessage(created, skipped),
      createdDate: date.value,
      createdCount: created,
      skippedCount: skipped,
      refreshHome: true,
    })
    return
  }

  const payload: Record<string, any> = {
    dog_ids: selectedDogs.value.map((dog: any) => dog._id),
    type: resolvedType.value,
    date: date.value,
    cost: cost && cost > 0 ? cost : null,
    notes: notes.value || null,
    details: buildDetails(),
  }

  if (resolvedType.value === 'illness') {
    payload.skip_reminder = !enableReminder.value
  } else {
    payload.create_task = enableReminder.value
  }

  const result = await batchAddRecord(payload)
  const completedTasks = result?.data?.completedTasks || []
  const completedTaskIds = completedTasks.map((task: any) => task._id).filter(Boolean)
  const suppressTaskIds = sourceTaskIds.value.length > 0 ? sourceTaskIds.value : completedTaskIds

  if (resolvedType.value === 'illness' && selectedDogs.value.length === 1 && result?.data?.records?.[0]?.recordId) {
    savedRecordId.value = result.data.records[0].recordId
  }

  markSuccess()
  queueSubmitFeedback({
    message: buildRecordFeedbackMessage(selectedDogs.value.length, completedTasks.length),
    completedTaskIds,
    suppressTaskIds,
    removeBatchCard: sourceTaskIds.value.length > 0
      && completedTaskIds.length > 0
      && completedTaskIds.length === sourceTaskIds.value.length,
    refreshHome: true,
  })
}

async function submitEditRecord() {
  const cost = costInput.value ? parseFloat(costInput.value) : null
  await updateRecord({
    id: props.recordId,
    date: date.value,
    cost: cost && cost > 0 ? cost : null,
    notes: notes.value || null,
    details: buildDetails(),
  })
  markSuccess()
  queueSubmitFeedback({ message: '已更新健康记录' })
}

async function submit() {
  if (!canSubmit.value || submitState.value === 'submitting') return
  markSubmitting()
  try {
    if (await handleDuplicateIllnessIfNeeded()) {
      resetSubmitState()
      return
    }

    if (isEdit.value) {
      await submitEditRecord()
      await wait(140)
      uni.navigateBack()
      return
    }

    await submitCreateRecord()

    if (resolvedType.value === 'illness' && details.treatment_status !== '已康复') {
      showMedPrompt.value = true
      return
    }

    await wait(140)
    uni.navigateBack()
  } catch {
    resetSubmitState()
  } finally {
    if (submitState.value !== 'success') {
      resetSubmitState()
    }
  }
}

function goToMedication() {
  showMedPrompt.value = false
  const dogList = selectedDogs.value.map((dog: any) => ({ _id: dog._id, name: dog.name }))
  const dogsParam = encodeURIComponent(JSON.stringify(dogList))
  const illnessParam = savedRecordId.value && selectedDogs.value.length === 1
    ? `&illnessRecordId=${savedRecordId.value}`
    : ''
  uni.redirectTo({ url: `/pages/record/health-medication?batchDogs=${dogsParam}${illnessParam}` })
}

function finishAndBack() {
  showMedPrompt.value = false
  setTimeout(() => uni.navigateBack(), 140)
}

onMounted(async () => {
  loading.value = true
  try {
    if (isEdit.value) {
      await loadEditRecord()
    } else {
      await loadCreateQuery()
      loading.value = false
    }
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.loading-state {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.loading-text {
  font-size: 14px;
  color: var(--text-3);
}

.type-display {
  height: 48px;
  border-radius: 14px;
  background: var(--card-dim);
  padding: 0 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  display: flex;
  align-items: center;
}

.med-prompt {
  text-align: center;
  padding: 8px 0;
}

.med-prompt__text {
  font-size: 14px;
  color: var(--text-2);
}
</style>
