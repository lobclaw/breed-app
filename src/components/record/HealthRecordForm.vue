<template>
  <view class="page">
    <BPageHeader :title="pageTitle" />

    <view v-if="loading" class="health-form-skeleton">
      <view
        v-for="(block, index) in skeletonBlocks"
        :key="`${block.kind}-${index}`"
        class="field-group health-form-skeleton__group"
      >
        <view class="health-form-skeleton__label" :class="{ 'health-form-skeleton__label--short': block.labelWidth === 'short' }" />

        <template v-if="block.kind === 'picker' || block.kind === 'input'">
          <view class="health-form-skeleton__control health-form-skeleton__shimmer" />
        </template>

        <template v-else-if="block.kind === 'choice'">
          <view class="health-form-skeleton__choice-row" :class="{ 'health-form-skeleton__choice-row--grid': block.grid }">
            <view
              v-for="option in block.count || 3"
              :key="option"
              class="health-form-skeleton__choice health-form-skeleton__shimmer"
            />
          </view>
        </template>

        <template v-else-if="block.kind === 'options-card'">
          <view class="health-form-skeleton__panel">
            <view class="health-form-skeleton__control health-form-skeleton__shimmer" />
            <view class="health-form-skeleton__toggle-row">
              <view class="health-form-skeleton__toggle-copy">
                <view class="health-form-skeleton__panel-line health-form-skeleton__panel-line--label health-form-skeleton__shimmer" />
                <view class="health-form-skeleton__panel-line health-form-skeleton__panel-line--sub health-form-skeleton__shimmer" />
              </view>
              <view class="health-form-skeleton__toggle health-form-skeleton__shimmer" />
            </view>
            <view class="health-form-skeleton__toggle-row">
              <view class="health-form-skeleton__toggle-copy">
                <view class="health-form-skeleton__panel-line health-form-skeleton__panel-line--label health-form-skeleton__shimmer" />
                <view class="health-form-skeleton__panel-line health-form-skeleton__panel-line--sub health-form-skeleton__shimmer" />
              </view>
              <view class="health-form-skeleton__toggle health-form-skeleton__shimmer" />
            </view>
          </view>
        </template>

        <template v-else-if="block.kind === 'textarea'">
          <view class="health-form-skeleton__textarea health-form-skeleton__shimmer" />
        </template>
      </view>
    </view>

    <view v-else class="form-body">
      <view v-if="!isEdit" class="field-group">
        <view class="field-label"><text>选择犬只</text></view>
        <BDogPicker
          v-model="selectedDogs"
          :multiple="true"
          title="选择犬只"
          :extra-meta-map="latestHealthMetaMap"
          :show-health-status-tags="shouldShowHealthStatusTags"
        />
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
          <view class="field-label"><text>主疾病</text></view>
          <view class="pill-options">
            <view
              v-for="condition in conditionTypes"
              :key="condition"
              class="pill-option"
              :class="{ active: details.primary_condition === condition }"
              @click="setPrimaryCondition(condition)"
              @longpress="PRESET_CONDITION_TYPES.includes(condition) ? undefined : deleteCustomValue('illness', condition)"
            >
              <text>{{ condition }}</text>
            </view>
            <view
              v-if="customCondition && !conditionTypes.includes(customCondition)"
              class="pill-option"
              :class="{ active: details.primary_condition === customCondition }"
              @click="setPrimaryCondition(customCondition)"
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
          <view class="field-label">
            <text>症状表现</text>
            <text class="field-label__optional">（选填，可多选）</text>
          </view>
          <view class="pill-options">
            <view
              v-for="symptom in symptomTagOptions"
              :key="symptom"
              class="pill-option"
              :class="{ active: selectedSymptomTags.includes(symptom) }"
              @click="toggleSymptomTag(symptom)"
              @longpress="PRESET_SYMPTOM_TAGS.includes(symptom) ? undefined : deleteCustomValue('symptom', symptom)"
            >
              <text>{{ symptom }}</text>
            </view>
            <view
              v-if="customSymptom && !symptomTagOptions.includes(customSymptom)"
              class="pill-option"
              :class="{ active: selectedSymptomTags.includes(customSymptom) }"
              @click="toggleSymptomTag(customSymptom)"
            >
              <text>{{ customSymptom }}</text>
            </view>
            <view class="pill-add" @click="openCustomModal('symptom')">
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
          <text>补充说明</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <textarea
          v-model="notes"
          class="form-textarea"
          :auto-height="true"
          :placeholder="resolvedType === 'illness' ? '描述症状详情...' : '补充未覆盖的记录情况'"
        />
      </view>
    </view>

    <view class="fixed-bottom">
      <view v-if="loading" class="health-form-skeleton__submit health-form-skeleton__shimmer" />
      <BSubmitButton
        v-else
        :loading="submitState === 'submitting'"
        :success="submitState === 'success'"
        :disabled="!canSubmit || submitState === 'submitting'"
        @click="submit"
      >
        {{ submitButtonText }}
      </BSubmitButton>
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

    <BModal
      v-model:visible="showDuplicateIllnessModal"
      title="已有进行中的疾病"
      :content="duplicateIllnessContent"
      confirmText="去编辑"
      cancelText="知道了"
      @confirm="handleDuplicateIllnessConfirm"
      @cancel="handleDuplicateIllnessClose"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRecordSubmitState } from '@/composables/useRecordSubmitState'
import { buildRecordFeedbackMessage, buildTaskFeedbackMessage, queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import {
  findLocalDuplicateIllnesses,
  getLocalHealthRecordDetail,
  getLocalTaskById,
  listLocalLatestDewormingDatesByDogIds,
  listLocalLatestVaccinationDatesByDogIds,
} from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import { buildHealthRecordEditUrl, resolveHealthCreateRouteQuery, type MedicationRouteIllnessLink } from '@/utils/recordFormRoutes'
import { useDogStore } from '@/stores/dogStore'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BFormOptions from '@/components/form/BFormOptions.vue'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BModal from '@/components/layout/BModal.vue'

type HealthRecordType = 'vaccination' | 'deworming' | 'illness'
type CustomModalKind = 'vaccination' | 'deworming' | 'illness' | 'symptom' | ''
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
const dogStore = useDogStore()

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
const savedIllnessLinks = ref<MedicationRouteIllnessLink[]>([])
const latestVaccinationRequestToken = ref(0)
const latestVaccinationDates = ref<Record<string, number>>({})
const latestDewormingRequestToken = ref(0)
const latestDewormingDates = ref<Record<string, number>>({})

const resolvedType = computed<HealthRecordType | ''>(() => {
  return (isEdit.value ? currentRecord.value?.type || props.type : props.type) || ''
})

const typeLabels: Record<HealthRecordType, string> = {
  vaccination: '疫苗',
  deworming: '驱虫',
  illness: '疾病',
}

const pageTitle = computed(() => {
  if (isEdit.value && resolvedType.value) return `编辑${typeLabels[resolvedType.value]}记录`
  if (isEdit.value) return '编辑健康记录'
  return resolvedType.value ? `录入${typeLabels[resolvedType.value]}记录` : '录入健康记录'
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

const latestVaccinationMetaMap = computed(() => {
  if (!shouldShowLatestVaccinationMeta.value) return {}
  return Object.entries(latestVaccinationDates.value).reduce<Record<string, string>>((map, [dogId, ts]) => {
    const text = formatDateOnly(ts)
    if (text) map[dogId] = `上次疫苗：${text}`
    return map
  }, {})
})

const shouldShowLatestVaccinationMeta = computed(() => {
  return !isEdit.value && resolvedType.value === 'vaccination'
})

const latestDewormingMetaMap = computed(() => {
  if (!shouldShowLatestDewormingMeta.value) return {}
  return Object.entries(latestDewormingDates.value).reduce<Record<string, string>>((map, [dogId, ts]) => {
    const text = formatDateOnly(ts)
    if (text) map[dogId] = `上次驱虫：${text}`
    return map
  }, {})
})

const shouldShowLatestDewormingMeta = computed(() => {
  return !isEdit.value && resolvedType.value === 'deworming'
})

const latestHealthMetaMap = computed(() => {
  if (resolvedType.value === 'deworming') return latestDewormingMetaMap.value
  return latestVaccinationMetaMap.value
})

const shouldShowHealthStatusTags = computed(() => {
  return !isEdit.value && resolvedType.value === 'illness'
})

const PRESET_VACCINE_TYPES = ['卫佳5', '卫佳8', '卫佳10', '狂犬']
const PRESET_CONDITION_TYPES = ['感冒', '腹泻', '寄生虫', '皮肤病', '眼部', '骨骼', '犬瘟', '细小', '其他']
const PRESET_SYMPTOM_TAGS = ['精神差', '食欲差', '呕吐', '腹泻', '咳嗽', '流鼻涕', '发热', '皮肤瘙痒', '抓挠', '分泌物']
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
const deletedCustomSymptoms = ref<string[]>([])
const customVaccine = ref('')
const customDrug = ref('')
const customCondition = ref('')
const customSymptom = ref('')
const showDeleteConfirm = ref(false)
const pendingDeleteVal = ref('')
let confirmDeleteFn: (() => Promise<void>) | null = null
const showDuplicateIllnessModal = ref(false)
const duplicateIllnessContent = ref('')
const duplicateIllnessRecordId = ref('')
const duplicateIllnessUseRedirect = ref(false)

const showCustomModal = ref(false)
const customModalKind = ref<CustomModalKind>('')
const customInput = ref('')

const customModalTitle = computed(() => {
  if (customModalKind.value === 'vaccination') return '自定义疫苗'
  if (customModalKind.value === 'deworming') return '自定义药品'
  if (customModalKind.value === 'symptom') return '自定义症状表现'
  return '自定义主疾病'
})

const customModalPlaceholder = computed(() => {
  if (customModalKind.value === 'vaccination') return '输入疫苗名称'
  if (customModalKind.value === 'deworming') return '输入药品名称'
  if (customModalKind.value === 'symptom') return '输入症状表现'
  return '输入主疾病名称'
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

const symptomTagOptions = computed(() => {
  const settings = (currentFamily.value?.settings || {}) as Record<string, any>
  const custom = (settings.custom_symptom_tags || [])
    .filter((value: string) => !deletedCustomSymptoms.value.includes(value))
  return [...new Set([...PRESET_SYMPTOM_TAGS, ...custom])]
})

const selectedSymptomTags = computed(() => Array.isArray(details.symptom_tags) ? details.symptom_tags : [])

const canSubmit = computed(() => {
  if (!resolvedType.value || !date.value) return false
  if (!isEdit.value && selectedDogs.value.length === 0) return false
  if (resolvedType.value === 'vaccination') return !!details.vaccine_type
  if (resolvedType.value === 'deworming') return !!details.deworming_type
  return !!String(details.primary_condition || details.condition || '').trim()
})

type HealthSkeletonBlockKind = 'picker' | 'choice' | 'options-card' | 'input' | 'textarea'

interface HealthSkeletonBlock {
  kind: HealthSkeletonBlockKind
  count?: number
  grid?: boolean
  labelWidth?: 'default' | 'short'
}

const skeletonBlocks = computed<HealthSkeletonBlock[]>(() => {
  const blocks: HealthSkeletonBlock[] = []

  if (!isEdit.value) {
    blocks.push({ kind: 'picker' })
  }

  if (resolvedType.value === 'vaccination') {
    blocks.push({ kind: 'choice', count: 5, grid: true })
  } else if (resolvedType.value === 'deworming') {
    blocks.push(
      { kind: 'choice', count: 3 },
      { kind: 'choice', count: 4, grid: true },
    )
  } else if (resolvedType.value === 'illness') {
    blocks.push(
      { kind: 'choice', count: 5, grid: true },
      { kind: 'choice', count: 6, grid: true },
      { kind: 'choice', count: 3 },
    )
  }

  blocks.push({ kind: 'options-card' })

  if (resolvedType.value === 'illness') {
    blocks.push({ kind: 'choice', count: 4 })
  }

  blocks.push({ kind: 'input' }, { kind: 'textarea' })
  return blocks
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
  savedIllnessLinks.value = []
  customVaccine.value = ''
  customDrug.value = ''
  customCondition.value = ''
  customSymptom.value = ''

  Object.keys(details).forEach(key => {
    delete details[key]
  })
  if (props.type === 'deworming') {
    details.deworming_type = 'internal'
  }
  if (props.type === 'illness') {
    details.treatment_status = '观察中'
    details.severity = '轻微'
    details.symptom_tags = []
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
    const primaryCondition = prefill.primary_condition || prefill.condition
    if (primaryCondition) setPrimaryCondition(primaryCondition)
    details.symptom_tags = normalizeSymptomTags(prefill.symptom_tags)
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

function formatDateOnly(ts?: number | null) {
  if (!ts) return ''
  const targetDate = new Date(ts + 8 * 60 * 60 * 1000)
  return `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 1).padStart(2, '0')}-${String(targetDate.getUTCDate()).padStart(2, '0')}`
}

async function refreshLatestVaccinationDates() {
  const requestToken = ++latestVaccinationRequestToken.value
  const familyId = currentFamily.value?._id || ''
  if (!shouldShowLatestVaccinationMeta.value || !familyId) {
    latestVaccinationDates.value = {}
    return
  }

  await dogStore.ensure().catch(() => {})
  const dogIds = dogStore.list.map((dog: any) => dog._id).filter(Boolean)
  if (dogIds.length === 0) {
    latestVaccinationDates.value = {}
    return
  }

  const dates = await listLocalLatestVaccinationDatesByDogIds(familyId, dogIds)
  if (requestToken !== latestVaccinationRequestToken.value) return
  latestVaccinationDates.value = dates
}

async function refreshLatestDewormingDates() {
  const requestToken = ++latestDewormingRequestToken.value
  const familyId = currentFamily.value?._id || ''
  if (!shouldShowLatestDewormingMeta.value || !familyId) {
    latestDewormingDates.value = {}
    return
  }

  await dogStore.ensure().catch(() => {})
  const dogIds = dogStore.list.map((dog: any) => dog._id).filter(Boolean)
  if (dogIds.length === 0) {
    latestDewormingDates.value = {}
    return
  }

  const dates = await listLocalLatestDewormingDatesByDogIds(familyId, dogIds)
  if (requestToken !== latestDewormingRequestToken.value) return
  latestDewormingDates.value = dates
}

async function loadCreateQuery() {
  resetFormState()
  const routeQuery = resolveHealthCreateRouteQuery(props.query)
  fromTask.value = routeQuery.fromTask
  sourceTaskIds.value = routeQuery.sourceTaskIds
  selectedDogs.value = routeQuery.selectedDogs
  applyPrefillDetails(routeQuery.details)

  if (routeQuery.sourceTaskIds[0]) {
    const task = await getLocalTaskById(currentFamily.value?._id || '', routeQuery.sourceTaskIds[0])
    if (task) {
      applyTaskDog(task)
      applyPrefillDetails((task as any).details || {})
    }
  }

  void refreshLatestVaccinationDates()
  void refreshLatestDewormingDates()
}

async function loadEditRecord() {
  if (!props.recordId) {
    loading.value = false
    return
  }

  loading.value = true
  try {
    resetFormState()
    const record = await getLocalHealthRecordDetail(currentFamily.value?._id || '', props.recordId)
    if (!record) return

    currentRecord.value = record
    date.value = record.date || null
    notes.value = record.notes || ''
    costInput.value = record.cost ? String(record.cost) : ''
    Object.assign(details, record.details || {})
    if (record.type === 'illness') {
      setPrimaryCondition(String(record.details?.primary_condition || record.details?.condition || '').trim())
      details.symptom_tags = normalizeSymptomTags(record.details?.symptom_tags)
    }
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

function normalizeSymptomTags(value: unknown) {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .map(item => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean))]
}

function ensureSymptomTags() {
  const normalized = normalizeSymptomTags(details.symptom_tags)
  details.symptom_tags = normalized
  return normalized
}

function setPrimaryCondition(value: string) {
  details.primary_condition = value
  details.condition = value
}

function toggleSymptomTag(value: string) {
  const next = ensureSymptomTags()
  const index = next.indexOf(value)
  if (index >= 0) {
    next.splice(index, 1)
  } else {
    next.push(value)
  }
  details.symptom_tags = [...next]
}

async function saveCustomValue(kind: CustomModalKind, value: string) {
  if (!value) return

  if (kind === 'vaccination') {
    customVaccine.value = value
    details.vaccine_type = value
    if (!PRESET_VACCINE_TYPES.includes(value)) {
      const existing = currentFamily.value?.settings?.custom_vaccine_types || []
      if (!existing.includes(value)) {
        await localSyncRuntime.updateFamilySettingsLocally(currentFamily.value?._id || '', { custom_vaccine_types: [...existing, value] })
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
        await localSyncRuntime.updateFamilySettingsLocally(currentFamily.value?._id || '', {
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

  if (kind === 'illness') {
    customCondition.value = value
    setPrimaryCondition(value)
    if (!PRESET_CONDITION_TYPES.includes(value)) {
      const existing = currentFamily.value?.settings?.custom_condition_types || []
      if (!existing.includes(value)) {
        await localSyncRuntime.updateFamilySettingsLocally(currentFamily.value?._id || '', { custom_condition_types: [...existing, value] })
        await loadFamily()
      }
    }
    return
  }

  customSymptom.value = value
  toggleSymptomTag(value)
  if (!PRESET_SYMPTOM_TAGS.includes(value)) {
    const settings = (currentFamily.value?.settings || {}) as Record<string, any>
    const existing = settings.custom_symptom_tags || []
    if (!existing.includes(value)) {
      await localSyncRuntime.updateFamilySettingsLocally(currentFamily.value?._id || '', { custom_symptom_tags: [...existing, value] })
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
      await localSyncRuntime.updateFamilySettingsLocally(currentFamily.value?._id || '', { custom_vaccine_types: existing.filter((item: string) => item !== value) })
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
      await localSyncRuntime.updateFamilySettingsLocally(currentFamily.value?._id || '', {
        custom_deworming_drugs: {
          ...customSettings,
          [subtype]: (customSettings[subtype] || []).filter((item: string) => item !== value),
        },
      })
      await loadFamily()
      deletedCustomDrugs.value = deletedCustomDrugs.value.filter(item => item !== value)
      return
    }

    if (kind === 'symptom') {
      deletedCustomSymptoms.value.push(value)
      details.symptom_tags = ensureSymptomTags().filter(item => item !== value)
      if (customSymptom.value === value) customSymptom.value = ''
      const settings = (currentFamily.value?.settings || {}) as Record<string, any>
      const existing = settings.custom_symptom_tags || []
      await localSyncRuntime.updateFamilySettingsLocally(currentFamily.value?._id || '', { custom_symptom_tags: existing.filter((item: string) => item !== value) })
      await loadFamily()
      deletedCustomSymptoms.value = deletedCustomSymptoms.value.filter(item => item !== value)
      return
    }

    deletedCustomConditions.value.push(value)
    if (details.primary_condition === value) details.primary_condition = ''
    if (details.condition === value) details.condition = ''
    if (customCondition.value === value) customCondition.value = ''
    const existing = currentFamily.value?.settings?.custom_condition_types || []
    await localSyncRuntime.updateFamilySettingsLocally(currentFamily.value?._id || '', { custom_condition_types: existing.filter((item: string) => item !== value) })
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
    const primaryCondition = String(details.primary_condition || details.condition || '').trim()
    built.primary_condition = primaryCondition
    built.condition = primaryCondition
    built.symptom_tags = ensureSymptomTags()
    built.treatment_status = details.treatment_status || '观察中'
    built.start_date = date.value
    if (details.severity) built.severity = details.severity
    if (nextReminderDate) built.next_reminder_date = nextReminderDate
  }

  return built
}

function buildIllnessRouteLinks(records: any[], detailPayload: Record<string, any>) {
  if (!Array.isArray(records) || records.length === 0) return []

  const primaryCondition = String(detailPayload.primary_condition || detailPayload.condition || '').trim()
  const symptomTags = Array.isArray(detailPayload.symptom_tags)
    ? detailPayload.symptom_tags
      .map((item: unknown) => typeof item === 'string' ? item.trim() : '')
      .filter(Boolean)
    : []
  const symptomSummary = symptomTags.length <= 2
    ? symptomTags.join(' / ')
    : `${symptomTags.slice(0, 2).join(' / ')} 等${symptomTags.length}项`
  const treatmentStatus = String(detailPayload.treatment_status || '观察中').trim()

  return records.reduce<MedicationRouteIllnessLink[]>((list, record: any) => {
      const illnessRecordId = typeof record?.recordId === 'string' ? record.recordId.trim() : ''
      const dogId = typeof record?.dog_id === 'string' ? record.dog_id.trim() : ''
      if (!illnessRecordId || !dogId) return list

      list.push({
        dogId,
        illnessRecordId,
        primaryCondition,
        symptomSummary,
        treatmentStatus,
      })

      return list
    }, [])
}

function getHealthHomeAnchorKey(type: string, detailPayload: Record<string, any>, isTodo: boolean) {
  if (type === 'illness') return 'health-illness:observation'
  if (!isTodo) return ''
  if (type === 'vaccination') {
    return `health-subtype:vaccination:${detailPayload.vaccine_type || 'unknown'}`
  }
  if (type === 'deworming') {
    return `health-subtype:deworming:${detailPayload.deworming_type || 'unknown'}:${detailPayload.drug_name || 'unknown'}`
  }
  return ''
}

function summarizeDogNames(names: string[] = []) {
  const clean = [...new Set(names.map(name => String(name || '').trim()).filter(Boolean))]
  if (clean.length <= 2) return clean.join('、')
  return `${clean.slice(0, 2).join('、')}等${clean.length}只`
}

function showSkippedDuplicateToast(
  skippedDogs: Array<{ dog_name?: string; reason?: string }> = [],
  kind: 'record' | 'task' = 'record',
) {
  if (!skippedDogs.length) return
  const names = summarizeDogNames(skippedDogs.map(item => item.dog_name || ''))
  if (!names) return
  uni.showToast({
    title: kind === 'task'
      ? `${names}今天已有相同事项，已跳过`
      : `${names}今日已有相同记录，已跳过`,
    icon: 'none',
  })
}

async function handleDuplicateIllnessIfNeeded() {
  if (resolvedType.value !== 'illness') return false

  const condition = String(details.primary_condition || details.condition || '').trim()
  const treatmentStatus = details.treatment_status || '观察中'
  if (!condition || treatmentStatus === '已康复') return false

  const dogIds = isEdit.value
    ? [currentRecord.value?.dog_id].filter(Boolean)
    : selectedDogs.value.map((dog: any) => dog._id)
  if (dogIds.length === 0) return false

  const duplicates = await findLocalDuplicateIllnesses(
    currentFamily.value?._id || '',
    dogIds,
    condition,
    isEdit.value ? props.recordId : '',
  )
  if (duplicates.length === 0) return false

  if (duplicates.length === 1 && dogIds.length === 1) {
    const duplicate = duplicates[0]
    await new Promise<void>((resolve) => {
      duplicateIllnessContent.value = `${isEdit.value ? currentRecord.value?.dog_name : selectedDogs.value[0]?.name || '该犬'} 已有未康复的「${condition}」记录，去编辑原记录吗？`
      duplicateIllnessRecordId.value = duplicate.recordId || ''
      duplicateIllnessUseRedirect.value = isEdit.value
      showDuplicateIllnessModal.value = true
      duplicateIllnessResolve = resolve
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

let duplicateIllnessResolve: (() => void) | null = null

function handleDuplicateIllnessClose() {
  if (duplicateIllnessResolve) {
    duplicateIllnessResolve()
    duplicateIllnessResolve = null
  }
}

function handleDuplicateIllnessConfirm() {
  if (duplicateIllnessRecordId.value) {
    const url = buildHealthRecordEditUrl('illness', duplicateIllnessRecordId.value)
    if (!url) {
      handleDuplicateIllnessClose()
      return
    }
    if (duplicateIllnessUseRedirect.value) {
      uni.redirectTo({ url })
    } else {
      uni.navigateTo({ url })
    }
  }
  handleDuplicateIllnessClose()
}

async function submitCreateRecord() {
  const cost = costInput.value ? parseFloat(costInput.value) : null
  const detailPayload = buildDetails()

  if (isTodo.value && resolvedType.value !== 'illness') {
    const result = await localSyncRuntime.batchCreateManualTasksLocally(currentFamily.value?._id || '', {
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
    const skippedDogs = result?.data?.skippedDogs || []
    if (created === 0 && skipped > 0) {
      showSkippedDuplicateToast(skippedDogs, 'task')
      return false
    }
    markSuccess()
    queueSubmitFeedback({
      message: buildTaskFeedbackMessage(created, skipped),
      homeSection: 'reminders',
      homeAnchorKey: getHealthHomeAnchorKey(resolvedType.value, detailPayload, true),
      createdDate: date.value,
      createdCount: created,
      skippedCount: skipped,
      refreshHome: true,
    })
    return true
  }

  const payload: Record<string, any> = {
    dog_ids: selectedDogs.value.map((dog: any) => dog._id),
    type: resolvedType.value,
    date: date.value,
    cost: cost && cost > 0 ? cost : null,
    notes: notes.value || null,
    details: detailPayload,
  }

  if (resolvedType.value === 'illness') {
    payload.skip_reminder = !enableReminder.value
  } else {
    payload.create_task = enableReminder.value
  }

  const result = await localSyncRuntime.batchAddHealthRecordsLocally(currentFamily.value?._id || '', payload)
  const savedCount = result?.data?.count || 0
  const skippedCount = result?.data?.skipped || 0
  const skippedDogs = result?.data?.skippedDogs || []
  const completedTasks = result?.data?.completedTasks || []
  const completedTaskIds = completedTasks.map((task: any) => task._id).filter(Boolean)
  const suppressTaskIds = sourceTaskIds.value.length > 0 ? sourceTaskIds.value : completedTaskIds
  if (savedCount === 0 && skippedCount > 0) {
    showSkippedDuplicateToast(skippedDogs, 'record')
    return false
  }

  if (resolvedType.value === 'illness') {
    const illnessLinks = buildIllnessRouteLinks(result?.data?.records || [], detailPayload)
    savedIllnessLinks.value = illnessLinks
    if (selectedDogs.value.length === 1 && illnessLinks[0]?.illnessRecordId) {
      savedRecordId.value = illnessLinks[0].illnessRecordId
    }
  }

  markSuccess()
  queueSubmitFeedback({
    message: buildRecordFeedbackMessage(savedCount, completedTasks.length, skippedCount),
    homeSection: 'reminders',
    homeAnchorKey: getHealthHomeAnchorKey(resolvedType.value, detailPayload, isTodo.value),
    completedTaskIds,
    suppressTaskIds,
    skippedCount,
    removeBatchCard: sourceTaskIds.value.length > 0
      && completedTaskIds.length > 0
      && completedTaskIds.length === sourceTaskIds.value.length,
    refreshHome: true,
  })
  return true
}

async function submitEditRecord() {
  const cost = costInput.value ? parseFloat(costInput.value) : null
  const detailPayload = buildDetails()
  await localSyncRuntime.updateHealthRecordLocally(currentFamily.value?._id || '', {
    id: props.recordId,
    date: date.value,
    cost: cost && cost > 0 ? cost : null,
    notes: notes.value || null,
    details: detailPayload,
  })
  markSuccess()
  queueSubmitFeedback({
    message: '已更新健康记录',
    homeSection: 'reminders',
    homeAnchorKey: getHealthHomeAnchorKey(resolvedType.value, detailPayload, isTodo.value),
  })
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
      await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
      uni.navigateBack()
      return
    }

    const created = await submitCreateRecord()
    if (!created) {
      resetSubmitState()
      return
    }

    if (resolvedType.value === 'illness' && details.treatment_status !== '已康复') {
      showMedPrompt.value = true
      return
    }

    await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
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
  const illnessLinksParam = savedIllnessLinks.value.length > 1
    ? `&illnessLinks=${encodeURIComponent(JSON.stringify(savedIllnessLinks.value))}`
    : ''
  uni.redirectTo({ url: `/pages/record/health-medication?batchDogs=${dogsParam}${illnessParam}${illnessLinksParam}` })
}

function finishAndBack() {
  showMedPrompt.value = false
  setTimeout(() => uni.navigateBack(), SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
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

watch(
  [shouldShowLatestVaccinationMeta, () => currentFamily.value?._id || '', () => dogStore.list.map((dog: any) => dog._id).join(',')],
  () => {
    void refreshLatestVaccinationDates()
  },
  { immediate: true },
)

watch(
  [shouldShowLatestDewormingMeta, () => currentFamily.value?._id || '', () => dogStore.list.map((dog: any) => dog._id).join(',')],
  () => {
    void refreshLatestDewormingDates()
  },
  { immediate: true },
)
</script>

<style lang="scss" scoped>
.health-form-skeleton {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.health-form-skeleton__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.health-form-skeleton__label {
  width: 84px;
  height: 12px;
  border-radius: 999px;
  background: var(--card-dim);
}

.health-form-skeleton__label--short {
  width: 62px;
}

.health-form-skeleton__control,
.health-form-skeleton__choice,
.health-form-skeleton__panel,
.health-form-skeleton__panel-line,
.health-form-skeleton__toggle,
.health-form-skeleton__textarea,
.health-form-skeleton__submit {
  background: linear-gradient(
    90deg,
    var(--card-dim) 25%,
    rgba(255, 255, 255, 0.22) 50%,
    var(--card-dim) 75%
  );
  background-size: 200% 100%;
  animation: health-record-skeleton-shimmer 1.5s infinite;
}

.health-form-skeleton__control {
  height: 48px;
  border-radius: 14px;
}

.health-form-skeleton__choice-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.health-form-skeleton__choice-row--grid .health-form-skeleton__choice {
  width: calc(50% - 4px);
}

.health-form-skeleton__choice {
  min-width: 76px;
  width: calc(33.333% - 6px);
  height: 40px;
  border-radius: 999px;
}

.health-form-skeleton__panel {
  border-radius: 16px;
  background-color: var(--card);
  padding: 14px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.health-form-skeleton__toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.health-form-skeleton__toggle-copy {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.health-form-skeleton__panel-line {
  height: 10px;
  border-radius: 999px;
}

.health-form-skeleton__panel-line--label {
  width: 38%;
}

.health-form-skeleton__panel-line--sub {
  width: 56%;
}

.health-form-skeleton__toggle {
  width: 52px;
  height: 30px;
  border-radius: 999px;
  flex-shrink: 0;
}

.health-form-skeleton__textarea {
  height: 104px;
  border-radius: 16px;
}

.health-form-skeleton__submit {
  width: 100%;
  height: 52px;
  border-radius: 999px;
}

@keyframes health-record-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
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
