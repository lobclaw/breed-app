<template>
  <view class="page" :class="{ 'heat-observation-page': breedingType === 'heat_observation' }">
    <BPageHeader :title="pageTitle" :subtitle="pageSubtitle" />

    <view v-if="loading" class="loading-state">
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else class="form-body" :class="{ 'heat-observation__content': breedingType === 'heat_observation' }">
      <template v-if="isEdit">
        <view class="field-group">
          <view class="field-label"><text>记录类型</text></view>
          <view class="type-display">
            <text>{{ typeLabel }}</text>
          </view>
        </view>
      </template>

      <template v-if="breedingType === 'heat_observation'">
        <view class="field-group">
          <view class="field-label"><text>选择种母</text></view>
          <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" :readonly="dogLocked" />
        </view>

        <view class="heat-observation__section">
          <view class="heat-observation__label">
            <view class="heat-observation__label-dot" />
            <text class="heat-observation__label-text">外阴状态</text>
          </view>
          <view class="heat-observation__segments">
            <view
              v-for="option in vulvaOptions"
              :key="option"
              class="heat-observation__segment"
              :class="{ 'heat-observation__segment--active': vulvaStatus === option }"
              @click="vulvaStatus = option"
            >
              <text class="heat-observation__segment-text">{{ option }}</text>
            </view>
          </view>
        </view>

        <view class="heat-observation__section">
          <view class="heat-observation__label">
            <view class="heat-observation__label-dot" />
            <text class="heat-observation__label-text">分泌物状态</text>
          </view>
          <view class="heat-observation__segments heat-observation__segments--grid">
            <view
              v-for="option in dischargeOptions"
              :key="option"
              class="heat-observation__segment"
              :class="{ 'heat-observation__segment--active': dischargeStatus === option }"
              @click="dischargeStatus = option"
            >
              <text class="heat-observation__segment-text">{{ option }}</text>
            </view>
          </view>
        </view>

        <view class="heat-observation__section">
          <view class="heat-observation__label">
            <view class="heat-observation__label-dot" />
            <text class="heat-observation__label-text">行为征兆</text>
          </view>
          <view class="heat-observation__symptom-grid">
            <view
              v-for="symptom in symptoms"
              :key="symptom"
              class="heat-observation__symptom"
              :class="{ 'heat-observation__symptom--selected': selectedSymptoms.includes(symptom) }"
              @click="toggleSymptom(symptom)"
            >
              <text
                v-if="selectedSymptoms.includes(symptom)"
                class="material-icons-round"
                style="font-size: 16px; color: var(--primary);"
              >check</text>
              <text class="heat-observation__symptom-text">{{ symptom }}</text>
            </view>
          </view>
        </view>

        <view class="heat-observation__section">
          <view class="heat-observation__label">
            <view class="heat-observation__label-dot" />
            <text class="heat-observation__label-text">补充说明</text>
            <text class="heat-observation__label-optional">（选填）</text>
          </view>
          <textarea
            v-model="notes"
            class="heat-observation__textarea"
            placeholder="补充观察到的其他情况..."
            :maxlength="500"
          />
        </view>
      </template>

      <template v-else>
        <view class="field-group">
          <view class="field-label"><text>选择种母</text></view>
          <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" :readonly="dogLocked" />
        </view>

        <view class="field-group">
          <view class="field-label"><text>{{ dateLabel }}</text></view>
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

        <template v-if="breedingType === 'follicle_check'">
          <view class="field-group">
            <view class="field-label"><text>左侧卵泡</text></view>
            <view class="inline-fields">
              <view class="inline-fields__item">
                <input v-model="details.left_count" class="form-input" type="number" placeholder="数量" />
              </view>
              <view class="inline-fields__item">
                <input v-model="details.left_size" class="form-input" type="text" placeholder="大小 (如 1.2cm)" />
              </view>
            </view>
          </view>

          <view class="field-group">
            <view class="field-label"><text>右侧卵泡</text></view>
            <view class="inline-fields">
              <view class="inline-fields__item">
                <input v-model="details.right_count" class="form-input" type="number" placeholder="数量" />
              </view>
              <view class="inline-fields__item">
                <input v-model="details.right_size" class="form-input" type="text" placeholder="大小 (如 1.0cm)" />
              </view>
            </view>
          </view>

          <view class="field-group">
            <view class="field-label"><text>检查结果</text></view>
            <view class="pill-select">
              <view
                v-for="result in follicleResults"
                :key="result"
                class="pill-select__item"
                :class="{ 'pill-select__item--active': details.result === result }"
                @click="details.result = result"
              >
                <text>{{ result }}</text>
              </view>
            </view>
          </view>
        </template>

        <template v-if="breedingType === 'mating'">
          <view class="field-group">
            <view class="field-label"><text>选择种公</text></view>
            <BDogPicker v-model="selectedSire" genderFilter="公" title="选择种公" />
          </view>

          <view class="field-group">
            <view class="field-label"><text>配种方式</text></view>
            <view class="pill-select">
              <view
                v-for="method in matingMethods"
                :key="method"
                class="pill-select__item"
                :class="{ 'pill-select__item--active': details.method === method }"
                @click="details.method = method"
              >
                <text>{{ method }}</text>
              </view>
            </view>
          </view>

          <view class="field-group">
            <view class="field-label"><text>第几次配种</text></view>
            <view class="display-field">
              <text>第 {{ details.mating_number || 1 }} 次（本周期）</text>
            </view>
          </view>

          <view class="field-group">
            <view class="field-label"><text>系统自动计算</text></view>
            <view class="auto-card">
              <view class="auto-card__row">
                <text class="material-icons-round auto-card__icon">event_available</text>
                <text class="auto-card__label">预计孕检日</text>
                <text class="auto-card__value">{{ estimatedCheckDate }}</text>
              </view>
              <picker mode="date" :value="manualDueDateStr" @change="onDueDateChange">
                <view class="auto-card__row">
                  <text class="material-icons-round auto-card__icon">child_friendly</text>
                  <text class="auto-card__label">预计预产期</text>
                  <text class="auto-card__value" :style="manualDueDate ? 'color: var(--primary);' : ''">{{ estimatedDueDate }}</text>
                  <text class="material-icons-round auto-card__edit">edit</text>
                </view>
              </picker>
              <view class="auto-card__hint">
                <text class="material-icons-round auto-card__hint-icon">info_outline</text>
                <text>可手动修改预产期</text>
              </view>
            </view>
          </view>
        </template>

        <template v-if="breedingType === 'pregnancy_check'">
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

          <view v-if="details.confirmed === '是'" class="field-group">
            <view class="field-label"><text>幼崽数量</text></view>
            <input v-model="details.puppy_count" class="form-input" type="number" placeholder="B超估计数量" />
          </view>

          <view class="field-group">
            <view class="field-label">
              <text>检查图片</text>
              <text class="field-label__optional">（选填）</text>
            </view>
            <BImageUpload v-model="images" :max="6" />
          </view>
        </template>

        <template v-if="breedingType === 'prenatal_check'">
          <view class="field-group">
            <view class="field-label"><text>检查结果</text></view>
            <textarea v-model="details.results" class="form-textarea" :auto-height="true" placeholder="填写检查结果" />
          </view>
        </template>

        <template v-if="breedingType === 'pre_labor'">
          <view class="field-group">
            <view class="field-label"><text>体温 (°C)</text></view>
            <input v-model="details.temperature" class="form-input" type="digit" placeholder="如 37.5" />
          </view>

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

          <view class="field-group">
            <view class="field-label">
              <text>食欲变化</text>
              <text class="field-label__optional">（选填）</text>
            </view>
            <input v-model="details.appetite_change" class="form-input" placeholder="如：食欲减退" />
          </view>

          <view class="field-group">
            <view class="field-label">
              <text>其他征兆</text>
              <text class="field-label__optional">（选填）</text>
            </view>
            <input v-model="details.other_signs" class="form-input" placeholder="如：焦躁、喘气" />
          </view>

          <view v-if="showTempWarning" class="temp-warning">
            <text class="material-icons-round" style="font-size: 18px; color: var(--amber);">warning</text>
            <text>体温低于 37.1°C，注意观察，可能 24 小时内生产</text>
          </view>
        </template>

        <template v-if="breedingType === 'abnormal_termination'">
          <view class="field-group">
            <view class="field-label"><text>类型</text></view>
            <view class="pill-select">
              <view
                v-for="terminationType in terminationTypes"
                :key="terminationType"
                class="pill-select__item"
                :class="{ 'pill-select__item--active': details.termination_type === terminationType }"
                @click="details.termination_type = terminationType"
              >
                <text>{{ terminationType }}</text>
              </view>
            </view>
          </view>
        </template>

        <view v-if="showCostField" class="field-group">
          <view class="field-label">
            <text>{{ costLabel }}</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <view class="input-prefix-wrapper">
            <text class="input-prefix">¥</text>
            <input v-model="costInput" class="form-input form-input--prefixed" type="digit" placeholder="0.00" />
          </view>
        </view>

        <view class="field-group">
          <view class="field-label">
            <text>{{ notesLabel }}</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <textarea v-model="notes" class="form-textarea" :auto-height="true" :placeholder="notesPlaceholder" />
        </view>

        <BExtraArrangementSection
          v-model:enabled="extraArrangementEnabled"
          v-model:kind="extraArrangementKind"
          v-model:dueDate="extraArrangementDate"
          v-model:notes="extraArrangementNotes"
        />
      </template>
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
      <view v-if="breedingType === 'heat_observation'" class="heat-observation__time" @click="pickTime">
        <text class="material-icons-round" style="font-size: 14px; color: var(--text-3);">schedule</text>
        <text class="heat-observation__time-text">{{ displayTime }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useCloudCall } from '@/composables/useCloudCall'
import { useRecordSubmitState } from '@/composables/useRecordSubmitState'
import { buildRecordFeedbackMessage, queueSubmitFeedback, wait } from '@/composables/useSubmitFeedback'
import { resolveBreedingRouteQuery } from '@/utils/recordFormRoutes'
import { getDefaultExtraArrangementDate, type ExtraArrangementKind } from '@/utils/breedingExtraArrangement'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BExtraArrangementSection from '@/components/form/BExtraArrangementSection.vue'
import BImageUpload from '@/components/form/BImageUpload.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'

type BreedingRecordType =
  | 'heat'
  | 'follicle_check'
  | 'mating'
  | 'pregnancy_check'
  | 'prenatal_check'
  | 'pre_labor'
  | 'abnormal_termination'
  | 'heat_observation'

const props = withDefaults(defineProps<{
  mode: 'create' | 'edit'
  type?: BreedingRecordType
  recordId?: string
  query?: Record<string, string>
}>(), {
  type: undefined,
  recordId: '',
  query: () => ({}),
})

const isEdit = computed(() => props.mode === 'edit')

const breedingType = computed<BreedingRecordType | ''>(() => {
  return (isEdit.value ? currentRecord.value?.type : props.type) || ''
})

const typeLabels: Record<BreedingRecordType, string> = {
  heat: '发情',
  follicle_check: '卵泡检查',
  mating: '配种',
  pregnancy_check: '孕检',
  prenatal_check: '产检',
  pre_labor: '临产监测',
  abnormal_termination: '异常终止',
  heat_observation: '发情观察',
}

const createTitles: Record<BreedingRecordType, string> = {
  heat: '录入发情记录',
  follicle_check: '录入卵泡检查',
  mating: '录入配种记录',
  pregnancy_check: '录入孕检记录',
  prenatal_check: '录入产检记录',
  pre_labor: '录入临产监测',
  abnormal_termination: '录入异常终止',
  heat_observation: '录入发情观察',
}

const loading = ref(false)
const currentRecord = ref<any>(null)
const selectedDog = ref<any>(null)
const selectedSire = ref<any>(null)
const dogLocked = ref(false)
const cycleId = ref('')
const prefillTaskId = ref('')
const date = ref<number | null>(null)
const recordTime = ref(new Date())
const notes = ref('')
const costInput = ref('')
const images = ref<string[]>([])
const details = reactive<Record<string, any>>({})
const manualDueDate = ref<number | null>(null)
const extraArrangementEnabled = ref(false)
const extraArrangementKind = ref<ExtraArrangementKind>('contact_doctor')
const extraArrangementDate = ref<number | null>(getDefaultExtraArrangementDate())
const extraArrangementNotes = ref('')
const dateChipActive = ref<'today' | 'yesterday' | 'dayBefore' | ''>('today')
const vulvaStatus = ref('')
const dischargeStatus = ref('')
const selectedSymptoms = ref<string[]>([])

const matingMethods = ['人工授精', '自然交配']
const follicleResults = ['发育中', '已成熟', '发育不良', '其他']
const terminationTypes = ['流产', '死胎', '医疗终止', '确认未怀孕']
const vulvaOptions = ['硬/肿胀', '开始软化', '明显松软']
const dischargeOptions = ['鲜红较多', '暗红减少', '淡粉/草黄色', '接近透明']
const symptoms = ['主动靠近公犬', '接受爬跨', '翘尾侧偏', '频繁排尿', '舔舐外阴增多']

const pageTitle = computed(() => {
  if (isEdit.value) return breedingType.value === 'heat_observation' ? '编辑发情观察' : '编辑繁育记录'
  return breedingType.value ? createTitles[breedingType.value] : '录入繁育记录'
})

const typeLabel = computed(() => {
  if (!breedingType.value) return ''
  return typeLabels[breedingType.value]
})

const pageSubtitle = computed(() => {
  if (breedingType.value !== 'heat_observation' || !selectedDog.value) return ''
  return `${selectedDog.value.gender || ''} · ${selectedDog.value.role || ''}`
})

const submitIdleLabel = computed(() => isEdit.value ? '保存修改' : '保存记录')
const submitSuccessLabel = computed(() => '已保存')

const { submitState, submitButtonText, markSubmitting, markSuccess, resetSubmitState } = useRecordSubmitState({
  idleLabel: submitIdleLabel,
  successLabel: submitSuccessLabel,
})

const dateLabel = computed(() => {
  if (breedingType.value === 'heat') return '发情开始日期'
  if (breedingType.value === 'follicle_check') return '检查日期'
  if (breedingType.value === 'mating') return '配种日期'
  if (breedingType.value === 'pregnancy_check') return '检查日期'
  if (breedingType.value === 'prenatal_check') return '检查日期'
  return '日期'
})

const costLabel = computed(() => breedingType.value === 'mating' ? '借配费用' : '费用')
const notesLabel = computed(() => breedingType.value === 'heat' ? '记录备注' : '备注')
const notesPlaceholder = computed(() => {
  if (breedingType.value === 'heat') return '记录观察到的症状、行为变化等'
  if (breedingType.value === 'follicle_check') return '补充检查说明'
  if (breedingType.value === 'mating') return '配种情况、注意事项等'
  if (breedingType.value === 'pregnancy_check') return '检查结果详情、医生建议等'
  return '补充说明'
})

const showCostField = computed(() => {
  return breedingType.value === 'follicle_check'
    || breedingType.value === 'mating'
    || breedingType.value === 'pregnancy_check'
    || breedingType.value === 'prenatal_check'
})

const estimatedCheckDate = computed(() => {
  if (!date.value) return '--'
  const targetDate = new Date(date.value + 21 * 86400000)
  return `${targetDate.getMonth() + 1}月${targetDate.getDate()}日`
})

const estimatedDueDate = computed(() => {
  const targetTs = manualDueDate.value || (date.value ? date.value + 59 * 86400000 : null)
  if (!targetTs) return '--'
  const targetDate = new Date(targetTs)
  return `${targetDate.getMonth() + 1}月${targetDate.getDate()}日`
})

const showTempWarning = computed(() => {
  const temperature = parseFloat(details.temperature)
  return !Number.isNaN(temperature) && temperature > 0 && temperature < 37.1
})

const dateStr = computed(() => {
  if (!date.value) return ''
  const targetDate = new Date(date.value)
  return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`
})

const manualDueDateStr = computed(() => {
  const targetTs = manualDueDate.value || (date.value ? date.value + 59 * 86400000 : null)
  if (!targetTs) return ''
  const targetDate = new Date(targetTs)
  return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`
})

const displayTime = computed(() => {
  const hours = String(recordTime.value.getHours()).padStart(2, '0')
  const minutes = String(recordTime.value.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
})

const extraArrangementPayload = computed(() => {
  if (breedingType.value === 'heat_observation') return undefined
  if (!extraArrangementEnabled.value || !extraArrangementDate.value) return undefined
  return {
    kind: extraArrangementKind.value || 'contact_doctor',
    due_date: extraArrangementDate.value,
    notes: extraArrangementNotes.value || null,
    anchor_type: 'cycle',
  }
})

const canSubmit = computed(() => {
  if (submitState.value === 'submitting') return false
  if (breedingType.value === 'heat_observation') {
    return !!selectedDog.value && !!vulvaStatus.value && !!dischargeStatus.value
  }
  if (!selectedDog.value || !date.value) return false
  if (breedingType.value === 'follicle_check') return !!details.left_count
  if (breedingType.value === 'mating') return !!selectedSire.value
  if (breedingType.value === 'abnormal_termination') return !!details.termination_type
  return true
})

const { run: fetchTask } = useCloudCall('task-service', 'getTask')
const { run: completeTask } = useCloudCall('task-service', 'completeTask', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})
const { run: addRecord } = useCloudCall('breeding-service', 'addBreedingRecord', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})
const { run: getRecord } = useCloudCall('breeding-service', 'getBreedingRecordDetail', {
  showLoading: false,
})
const { run: updateRecord } = useCloudCall('breeding-service', 'updateBreedingRecord', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

function resetDetails() {
  currentRecord.value = null
  selectedDog.value = null
  selectedSire.value = null
  dogLocked.value = false
  cycleId.value = ''
  prefillTaskId.value = ''
  date.value = null
  notes.value = ''
  costInput.value = ''
  images.value = []
  manualDueDate.value = null
  extraArrangementEnabled.value = false
  extraArrangementKind.value = 'contact_doctor'
  extraArrangementDate.value = getDefaultExtraArrangementDate()
  extraArrangementNotes.value = ''
  dateChipActive.value = 'today'
  recordTime.value = new Date()
  vulvaStatus.value = ''
  dischargeStatus.value = ''
  selectedSymptoms.value = []

  Object.keys(details).forEach(key => {
    delete details[key]
  })

  if (props.type === 'mating') {
    details.method = '人工授精'
    details.mating_number = 1
  }
  if (props.type === 'pregnancy_check') {
    details.confirmed = '否'
  }
  if (props.type === 'pre_labor') {
    details.nesting_behavior = false
  }
}

function setDateChip(chip: 'today' | 'yesterday' | 'dayBefore') {
  dateChipActive.value = chip
  const targetDate = new Date()
  targetDate.setHours(0, 0, 0, 0)
  if (chip === 'yesterday') targetDate.setDate(targetDate.getDate() - 1)
  if (chip === 'dayBefore') targetDate.setDate(targetDate.getDate() - 2)
  date.value = targetDate.getTime()
}

function onDateChange(event: any) {
  date.value = new Date(event.detail.value + 'T00:00:00+08:00').getTime()
  dateChipActive.value = ''
}

function onDueDateChange(event: any) {
  manualDueDate.value = new Date(event.detail.value + 'T00:00:00+08:00').getTime()
}

function toggleSymptom(symptom: string) {
  const index = selectedSymptoms.value.indexOf(symptom)
  if (index >= 0) {
    selectedSymptoms.value.splice(index, 1)
  } else {
    selectedSymptoms.value.push(symptom)
  }
}

function pickTime() {
  // #ifdef APP-PLUS || MP
  uni.showActionSheet({
    itemList: ['使用当前时间'],
    success: () => {
      recordTime.value = new Date()
    },
  })
  // #endif
}

function buildDetails() {
  const built: Record<string, any> = {}

  if (breedingType.value === 'heat') {
    built.start_date = date.value
  }

  if (breedingType.value === 'follicle_check') {
    built.left_count = parseInt(details.left_count) || 0
    built.left_size = parseFloat(details.left_size) || 0
    built.right_count = parseInt(details.right_count) || 0
    built.right_size = parseFloat(details.right_size) || 0
    if (details.result) built.result = details.result
  }

  if (breedingType.value === 'mating') {
    built.sire_id = selectedSire.value?._id || details.sire_id || ''
    built.sire_name = selectedSire.value?.name || details.sire_name || ''
    built.method = details.method || '人工授精'
    built.mating_number = parseInt(details.mating_number) || 1
    built.expected_checkup_date = date.value ? date.value + 21 * 86400000 : undefined
    built.expected_due_date = manualDueDate.value || (date.value ? date.value + 59 * 86400000 : undefined)
    built.is_due_date_manual = !!manualDueDate.value
  }

  if (breedingType.value === 'pregnancy_check') {
    if (details.confirmed) built.confirmed = details.confirmed
    if (details.puppy_count) built.puppy_count = parseInt(details.puppy_count)
    if (images.value.length > 0) built.images = images.value
  }

  if (breedingType.value === 'prenatal_check') {
    if (details.results) built.results = details.results
  }

  if (breedingType.value === 'pre_labor') {
    if (details.temperature) built.temperature = parseFloat(details.temperature)
    built.nesting_behavior = !!details.nesting_behavior
    if (details.appetite_change) built.appetite_change = details.appetite_change
    if (details.other_signs) built.other_signs = details.other_signs
  }

  if (breedingType.value === 'abnormal_termination') {
    if (details.termination_type) built.termination_type = details.termination_type
  }

  if (breedingType.value === 'heat_observation') {
    built.vulva_status = vulvaStatus.value
    built.discharge_status = dischargeStatus.value
    built.symptoms = selectedSymptoms.value
  }

  return built
}

function getCostValue() {
  const cost = costInput.value ? parseFloat(costInput.value) : null
  return cost && cost > 0 ? cost : null
}

function applyTaskPrefill(task: any) {
  if (!task) return

  if (!selectedDog.value && task.dog_id) {
    selectedDog.value = {
      _id: task.dog_id,
      name: task.dog_name || '',
      gender: '母',
      role: '种狗',
    }
    dogLocked.value = true
  } else if (selectedDog.value?._id && task.dog_id === selectedDog.value._id && task.dog_name) {
    selectedDog.value = {
      ...selectedDog.value,
      name: selectedDog.value.name || task.dog_name,
    }
    dogLocked.value = true
  }

  const taskDetails = task.details || {}
  if (taskDetails.method) details.method = taskDetails.method
  if (taskDetails.notes) notes.value = taskDetails.notes
  if (taskDetails.cost) costInput.value = String(taskDetails.cost)
}

async function loadCreateState() {
  resetDetails()
  const routeQuery = resolveBreedingRouteQuery(props.query)
  cycleId.value = routeQuery.cycleId
  prefillTaskId.value = routeQuery.taskId
  selectedDog.value = routeQuery.selectedDog
  dogLocked.value = routeQuery.dogLocked

  if (breedingType.value === 'heat_observation') {
    recordTime.value = new Date()
  } else {
    setDateChip('today')
  }

  if (prefillTaskId.value) {
    const taskRes = await fetchTask(prefillTaskId.value)
    if (taskRes?.data) applyTaskPrefill(taskRes.data)
  }
}

async function loadEditState() {
  if (!props.recordId) {
    loading.value = false
    return
  }

  loading.value = true
  try {
    resetDetails()
    const record = await getRecord({ id: props.recordId })
    if (!record) return

    currentRecord.value = record
    selectedDog.value = {
      _id: record.dog_id,
      name: record.dog_name || '',
      gender: '母',
      role: '种狗',
    }
    dogLocked.value = true
    cycleId.value = record.cycle_id || ''
    notes.value = record.notes || ''
    costInput.value = record.cost ? String(record.cost) : ''

    if (record.type === 'heat_observation') {
      recordTime.value = new Date(record.date || Date.now())
      vulvaStatus.value = record.details?.vulva_status || ''
      dischargeStatus.value = record.details?.discharge_status || ''
      selectedSymptoms.value = [...(record.details?.symptoms || [])]
    } else {
      date.value = record.date || null
      Object.assign(details, record.details || {})
      if (record.type === 'mating') {
        details.method = record.details?.method || '人工授精'
        selectedSire.value = record.details?.sire_id
          ? { _id: record.details.sire_id, name: record.details.sire_name || '' }
          : null
        manualDueDate.value = record.details?.is_due_date_manual ? (record.details?.expected_due_date || null) : null
      }
      if (record.type === 'pregnancy_check') {
        images.value = [...(record.details?.images || [])]
        details.confirmed = record.details?.confirmed || '否'
      }
      if (record.type === 'pre_labor' && details.nesting_behavior === undefined) {
        details.nesting_behavior = false
      }
    }

    if (record.extra_arrangement) {
      extraArrangementEnabled.value = true
      extraArrangementKind.value = record.extra_arrangement.kind || 'contact_doctor'
      extraArrangementDate.value = record.extra_arrangement.due_date || getDefaultExtraArrangementDate()
      extraArrangementNotes.value = record.extra_arrangement.notes || ''
    }
  } finally {
    loading.value = false
  }
}

async function submitCreate() {
  const payload: Record<string, any> = {
    type: breedingType.value,
    dog_id: selectedDog.value?._id || '',
    cycle_id: cycleId.value || undefined,
    notes: notes.value || null,
  }

  if (breedingType.value === 'heat_observation') {
    payload.date = recordTime.value.getTime()
    payload.details = buildDetails()
  } else {
    payload.date = date.value
    payload.cost = getCostValue()
    payload.details = buildDetails()
    payload.extra_arrangement = extraArrangementPayload.value
  }

  const result = await addRecord(payload)
  if (prefillTaskId.value) {
    await completeTask(prefillTaskId.value)
  }

  markSuccess()

  if (breedingType.value === 'heat_observation') {
    queueSubmitFeedback({ message: '已保存观察记录' })
  } else {
    const completedTaskIds = prefillTaskId.value ? [prefillTaskId.value] : []
    queueSubmitFeedback({
      message: buildRecordFeedbackMessage(1, prefillTaskId.value ? 1 : 0),
      completedTaskIds,
      suppressTaskIds: completedTaskIds,
      refreshHome: true,
    })
  }

  await wait(140)
  uni.navigateBack({ delta: 1 })
  return result
}

async function submitEdit() {
  const payload: Record<string, any> = {
    id: props.recordId,
    notes: notes.value || null,
    details: buildDetails(),
  }

  if (breedingType.value === 'heat_observation') {
    payload.date = recordTime.value.getTime()
    payload.cost = null
  } else {
    payload.date = date.value
    payload.cost = getCostValue()
    payload.extra_arrangement = extraArrangementPayload.value || null
  }

  await updateRecord(payload)
  markSuccess()
  queueSubmitFeedback({
    message: breedingType.value === 'heat_observation' ? '已更新观察记录' : '已更新繁育记录',
    refreshHome: breedingType.value !== 'heat_observation',
  })
  await wait(140)
  uni.navigateBack({ delta: 1 })
}

async function submit() {
  if (!canSubmit.value || submitState.value === 'submitting') return
  markSubmitting()
  try {
    if (isEdit.value) {
      await submitEdit()
    } else {
      await submitCreate()
    }
  } catch {
    resetSubmitState()
  } finally {
    if (submitState.value !== 'success') {
      resetSubmitState()
    }
  }
}

onMounted(async () => {
  loading.value = true
  try {
    if (isEdit.value) {
      await loadEditState()
    } else {
      await loadCreateState()
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
}

.inline-fields {
  gap: 10px;
}

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
    flex: 1;
    font-size: 14px;
    color: var(--text-2);
  }

  &__value {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__edit {
    font-size: 16px;
    color: var(--text-3);
    margin-left: 4px;
  }

  &__hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    font-size: 12px;
    color: var(--text-3);
  }

  &__hint-icon {
    font-size: 16px;
    color: var(--amber);
  }
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

.heat-observation-page {
  min-height: 100vh;
  background: var(--bg);
}

.heat-observation__content {
  gap: 20px;
}

.heat-observation__section {}

.heat-observation__label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.heat-observation__label-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--rose);
  flex-shrink: 0;
}

.heat-observation__label-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
}

.heat-observation__label-optional {
  font-size: 13px;
  color: var(--text-4);
}

.heat-observation__segments {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.heat-observation__segments--grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.heat-observation__segment {
  min-height: 42px;
  padding: 0 16px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: var(--card);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.heat-observation__segment--active {
  background: var(--primary-soft);
  border-color: var(--primary);
}

.heat-observation__segment-text {
  font-size: 14px;
  color: var(--text-2);
}

.heat-observation__symptom-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.heat-observation__symptom {
  min-height: 42px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: var(--card);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
}

.heat-observation__symptom--selected {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.heat-observation__symptom-text {
  font-size: 13px;
  color: var(--text-2);
}

.heat-observation__textarea {
  min-height: 120px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: var(--card);
  padding: 14px 16px;
  font-size: 14px;
  color: var(--text-1);
  width: 100%;
}

.heat-observation__time {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.heat-observation__time-text {
  font-size: 13px;
  color: var(--text-3);
}
</style>
