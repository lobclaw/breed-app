<template>
  <view class="page" :class="{ 'heat-observation-page': breedingType === 'heat_observation' }">
    <BPageHeader :title="pageTitle" :subtitle="pageSubtitle" />

    <view v-if="loading" class="record-form-skeleton" :class="{ 'record-form-skeleton--heat-observation': breedingType === 'heat_observation' }">
      <view
        v-for="(block, index) in skeletonBlocks"
        :key="`${block.kind}-${index}`"
        class="field-group record-form-skeleton__group"
      >
        <view class="record-form-skeleton__label" :class="{ 'record-form-skeleton__label--short': block.labelWidth === 'short' }" />

        <template v-if="block.kind === 'picker' || block.kind === 'display' || block.kind === 'input'">
          <view class="record-form-skeleton__control record-form-skeleton__shimmer" />
        </template>

        <template v-else-if="block.kind === 'date'">
          <view class="record-form-skeleton__control record-form-skeleton__shimmer" />
          <view class="record-form-skeleton__chip-row">
            <view v-for="chip in 3" :key="chip" class="record-form-skeleton__chip record-form-skeleton__shimmer" />
          </view>
        </template>

        <template v-else-if="block.kind === 'inline'">
          <view class="record-form-skeleton__inline-row">
            <view v-for="cell in 2" :key="cell" class="record-form-skeleton__inline-cell record-form-skeleton__shimmer" />
          </view>
        </template>

        <template v-else-if="block.kind === 'choice'">
          <view class="record-form-skeleton__choice-row" :class="{ 'record-form-skeleton__choice-row--grid': block.grid }">
            <view
              v-for="option in block.count || 3"
              :key="option"
              class="record-form-skeleton__choice record-form-skeleton__shimmer"
            />
          </view>
        </template>

        <template v-else-if="block.kind === 'symptoms'">
          <view class="record-form-skeleton__symptom-grid">
            <view v-for="option in 4" :key="option" class="record-form-skeleton__symptom record-form-skeleton__shimmer" />
          </view>
        </template>

        <template v-else-if="block.kind === 'auto-card'">
          <view class="record-form-skeleton__panel">
            <view v-for="row in 2" :key="row" class="record-form-skeleton__panel-row">
              <view class="record-form-skeleton__panel-icon record-form-skeleton__shimmer" />
              <view class="record-form-skeleton__panel-copy">
                <view class="record-form-skeleton__panel-line record-form-skeleton__panel-line--label record-form-skeleton__shimmer" />
                <view class="record-form-skeleton__panel-line record-form-skeleton__panel-line--value record-form-skeleton__shimmer" />
              </view>
            </view>
            <view class="record-form-skeleton__panel-hint record-form-skeleton__shimmer" />
          </view>
        </template>

        <template v-else-if="block.kind === 'textarea'">
          <view class="record-form-skeleton__textarea record-form-skeleton__shimmer" />
        </template>

        <template v-else-if="block.kind === 'extra'">
          <view class="record-form-skeleton__panel record-form-skeleton__panel--extra">
            <view class="record-form-skeleton__toggle-row">
              <view class="record-form-skeleton__toggle-copy">
                <view class="record-form-skeleton__panel-line record-form-skeleton__panel-line--label record-form-skeleton__shimmer" />
                <view class="record-form-skeleton__panel-line record-form-skeleton__panel-line--sub record-form-skeleton__shimmer" />
              </view>
              <view class="record-form-skeleton__toggle record-form-skeleton__shimmer" />
            </view>
            <view class="record-form-skeleton__panel-line record-form-skeleton__panel-line--full record-form-skeleton__shimmer" />
            <view class="record-form-skeleton__textarea record-form-skeleton__textarea--compact record-form-skeleton__shimmer" />
          </view>
        </template>
      </view>
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
          <BDogPicker
            v-model="selectedDog"
            :candidate-dogs="breedingCandidateDogs"
            title="选择种母"
            :readonly="dogLocked"
            :empty-title="breedingPickerEmptyState.title"
            :empty-description="breedingPickerEmptyState.description"
            :show-breeding-stage="true"
          />
        </view>

        <view class="field-group">
          <view class="field-label"><text>日期</text></view>
          <view class="form-input form-input--picker" @click="showRecordDateTimePicker = true">
            <text>{{ recordDateTimeStr || '请选择日期时间' }}</text>
            <text class="material-icons-round form-input__suffix">calendar_today</text>
          </view>
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
          <BDogPicker
            v-if="isHeatMultiCreate"
            v-model="selectedDogs"
            :multiple="true"
            :candidate-dogs="breedingCandidateDogs"
            title="选择种母"
            placeholder="点击选择种母"
            :empty-title="breedingPickerEmptyState.title"
            :empty-description="breedingPickerEmptyState.description"
            :extra-meta-map="latestHeatMetaMap"
            :show-breeding-stage="true"
          />
          <BDogPicker
            v-else
            v-model="selectedDog"
            :candidate-dogs="breedingCandidateDogs"
            title="选择种母"
            :readonly="dogLocked"
            :empty-title="breedingPickerEmptyState.title"
            :empty-description="breedingPickerEmptyState.description"
            :extra-meta-map="latestHeatMetaMap"
            :show-breeding-stage="true"
          />
        </view>

        <view class="field-group">
          <view class="field-label"><text>{{ dateLabel }}</text></view>
          <view class="form-input form-input--picker" @click="showDatePicker = true">
            <text>{{ dateStr || '请选择日期' }}</text>
            <text class="material-icons-round form-input__suffix">calendar_today</text>
          </view>
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
            <BDogPicker v-model="selectedSire" genderFilter="公" :includeExternalSires="true" title="选择种公" :show-breeding-stage="true" />
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
            <view class="field-label"><text>第几脚</text></view>
            <view class="display-field">
              <text>{{ matingNumberPreviewText }}</text>
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
              <view class="auto-card__row" @click="showDueDatePicker = true">
                <text class="material-icons-round auto-card__icon">child_friendly</text>
                <text class="auto-card__label">预计预产期</text>
                <text class="auto-card__value" :style="manualDueDate ? 'color: var(--primary);' : ''">{{ estimatedDueDate }}</text>
                <text class="material-icons-round auto-card__edit">edit</text>
              </view>
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
            <view class="field-hint">检查结果和检查图片至少填写一项</view>
          </view>

          <view class="field-group">
            <view class="field-label">
              <text>检查图片</text>
              <text class="field-label__optional">（选填）</text>
            </view>
            <BImageUpload v-model="images" :max="6" />
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
                v-for="terminationType in visibleTerminationTypes"
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

    <view class="fixed-bottom" :class="{ 'fixed-bottom--heat-observation': breedingType === 'heat_observation' }">
      <view v-if="loading" class="record-form-skeleton__submit-wrap">
        <view class="record-form-skeleton__submit record-form-skeleton__shimmer" />
      </view>
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

    <BDateTimePicker
      v-model:visible="showDatePicker"
      :model-value="date"
      mode="date"
      value-type="timestamp"
      @confirm="onDateConfirm"
    />

    <BDateTimePicker
      v-model:visible="showRecordDateTimePicker"
      :model-value="recordTime"
      mode="date"
      value-type="timestamp"
      @confirm="onRecordDateTimeConfirm"
    />

    <BDateTimePicker
      v-model:visible="showDueDatePicker"
      :model-value="manualDueDate || (date ? date + 59 * 86400000 : null)"
      mode="date"
      value-type="timestamp"
      @confirm="onDueDateConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRecordSubmitState } from '@/composables/useRecordSubmitState'
import { buildRecordFeedbackMessage, queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import {
  getLocalBreedingRecordDetail,
  listLocalLatestHeatDatesByDogIds,
  getLocalNextMatingNumberPreview,
  getLocalTaskById,
} from '@/localdb/domain-repository'
import { findLocal } from '@/localdb'
import { localSyncRuntime } from '@/localdb/runtime'
import { resolveBreedingRouteQuery } from '@/utils/recordFormRoutes'
import { getDefaultExtraArrangementDate, type ExtraArrangementKind } from '@/utils/breedingExtraArrangement'
import { getBreedingDogPickerEmptyState, getEligibleBreedingDogs } from '@/utils/breedingDogEligibility'
import { buildTimestampFromDayOffset, formatDateInputValue } from '@/utils/date'
import { useDogStore } from '@/stores/dogStore'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BDateTimePicker from '@/components/form/BDateTimePicker.vue'
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
const { currentFamily } = useAuth()

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
const selectedDogs = ref<any[]>([])
const selectedSire = ref<any>(null)
const dogLocked = ref(false)
const cycleId = ref('')
const prefillTaskId = ref('')
const prefillTaskIsPersisted = ref(false)
const date = ref<number | null>(null)
const recordTime = ref<number>(Date.now())
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
const showDatePicker = ref(false)
const showRecordDateTimePicker = ref(false)
const showDueDatePicker = ref(false)
const vulvaStatus = ref('')
const dischargeStatus = ref('')
const selectedSymptoms = ref<string[]>([])
const matingPreviewRequestToken = ref(0)
const latestHeatRequestToken = ref(0)
const cycleStatusRequestToken = ref(0)
const latestHeatDates = ref<Record<string, number>>({})
const currentCycleStatus = ref('')

const matingMethods = ['人工授精', '自然交配']
const follicleResults = ['发育中', '已成熟', '发育不良', '其他']
const ABANDON_MATING_TERMINATION = '放弃配种'
const pregnancyTerminationTypes = ['流产', '死胎', '医疗终止', '未怀孕']
const terminationTypes = [ABANDON_MATING_TERMINATION, ...pregnancyTerminationTypes]
const vulvaOptions = ['硬/肿胀', '开始软化', '明显松软']
const dischargeOptions = ['鲜红较多', '暗红减少', '淡粉/草黄色', '接近透明']
const symptoms = ['主动靠近公犬', '接受爬跨', '翘尾侧偏', '频繁排尿', '舔舐外阴增多']
const dogStore = useDogStore()

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
  return `${selectedDog.value.gender || ''} · ${roleDisplayText(selectedDog.value.role)}`
})

function roleDisplayText(role?: string | null) {
  if (role === '种狗') return '种犬'
  return role || ''
}

const isHeatMultiCreate = computed(() => !isEdit.value && breedingType.value === 'heat' && !dogLocked.value)
const shouldShowLatestHeatMeta = computed(() => {
  return !isEdit.value
    && !dogLocked.value
    && ['heat', 'follicle_check', 'mating'].includes(breedingType.value)
})

const breedingCandidateDogs = computed(() => {
  if (!breedingType.value) return []
  return getEligibleBreedingDogs(dogStore.list, breedingType.value)
})

const breedingPickerEmptyState = computed(() => {
  if (!breedingType.value) {
    return { title: '暂无犬只', description: '没有符合条件的犬只' }
  }
  return getBreedingDogPickerEmptyState(breedingType.value, dogStore.list, breedingCandidateDogs.value)
})

const latestHeatMetaMap = computed(() => {
  if (!shouldShowLatestHeatMeta.value) return {}
  const currentHeatDogIds = new Set(
    breedingCandidateDogs.value
      .filter((dog: any) => hasCurrentHeatStatus(dog))
      .map((dog: any) => dog._id),
  )
  return Object.entries(latestHeatDates.value).reduce<Record<string, string>>((map, [dogId, ts]) => {
    if (currentHeatDogIds.has(dogId)) return map
    const text = formatDateOnly(ts)
    if (text) map[dogId] = `上次发情：${text}`
    return map
  }, {})
})

const selectedDogCycleStatus = computed(() => {
  const statuses = Array.isArray(selectedDog.value?.statuses) ? selectedDog.value.statuses : []
  const activeStatuses = statuses.filter((status: any) => status?.type === '发情中' || status?.type === '怀孕中')
  const matchedStatus = cycleId.value
    ? activeStatuses.find((status: any) => status?.cycleId === cycleId.value)
    : activeStatuses[0]
  return matchedStatus?.type || ''
})

const terminationCycleStatus = computed(() => currentCycleStatus.value || selectedDogCycleStatus.value)

const visibleTerminationTypes = computed(() => {
  if (isEdit.value) return terminationTypes
  if (terminationCycleStatus.value === '发情中') return [ABANDON_MATING_TERMINATION]
  return pregnancyTerminationTypes
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

const matingNumberPreviewText = computed(() => `第 ${details.mating_number || 1} 脚（本周期自动计算）`)

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

const recordDateTimeStr = computed(() => formatDateInputValue(recordTime.value))

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

const hasPrenatalCheckContent = computed(() => {
  return !!String(details.results || '').trim() || images.value.length > 0
})

const canSubmit = computed(() => {
  if (submitState.value === 'submitting') return false
  if (breedingType.value === 'heat_observation') {
    return !!selectedDog.value && !!vulvaStatus.value && !!dischargeStatus.value
  }
  if (isHeatMultiCreate.value) {
    return selectedDogs.value.length > 0 && !!date.value
  }
  if (!selectedDog.value || !date.value) return false
  if (breedingType.value === 'follicle_check') return !!details.left_count
  if (breedingType.value === 'mating') return !!selectedSire.value
  if (breedingType.value === 'prenatal_check') return hasPrenatalCheckContent.value
  if (breedingType.value === 'abnormal_termination') return visibleTerminationTypes.value.includes(details.termination_type)
  return true
})

type BreedingSkeletonBlockKind =
  | 'picker'
  | 'date'
  | 'inline'
  | 'choice'
  | 'display'
  | 'auto-card'
  | 'textarea'
  | 'extra'
  | 'input'
  | 'symptoms'

interface BreedingSkeletonBlock {
  kind: BreedingSkeletonBlockKind
  count?: number
  grid?: boolean
  labelWidth?: 'default' | 'short'
}

const skeletonBlocks = computed<BreedingSkeletonBlock[]>(() => {
  const blocks: BreedingSkeletonBlock[] = []

  if (isEdit.value) {
    blocks.push({ kind: 'display', labelWidth: 'short' })
  }

  if (breedingType.value === 'heat_observation') {
    return [
      ...blocks,
      { kind: 'picker' },
      { kind: 'display' },
      { kind: 'choice', count: 3 },
      { kind: 'choice', count: 4, grid: true },
      { kind: 'symptoms' },
      { kind: 'textarea' },
    ]
  }

  blocks.push({ kind: 'picker' }, { kind: 'date' })

  if (breedingType.value === 'follicle_check') {
    blocks.push(
      { kind: 'inline' },
      { kind: 'inline' },
      { kind: 'choice', count: 4 },
    )
  } else if (breedingType.value === 'mating') {
    blocks.push(
      { kind: 'picker' },
      { kind: 'choice', count: 2 },
      { kind: 'display' },
      { kind: 'auto-card' },
    )
  } else if (breedingType.value === 'pregnancy_check') {
    blocks.push(
      { kind: 'choice', count: 2 },
      { kind: 'input' },
    )
  } else if (breedingType.value === 'prenatal_check') {
    blocks.push({ kind: 'textarea' })
  } else if (breedingType.value === 'pre_labor') {
    blocks.push(
      { kind: 'input' },
      { kind: 'choice', count: 2 },
      { kind: 'input' },
      { kind: 'input' },
    )
  } else if (breedingType.value === 'abnormal_termination') {
    blocks.push({ kind: 'choice', count: visibleTerminationTypes.value.length || 4, grid: true })
  }

  if (showCostField.value) {
    blocks.push({ kind: 'input' })
  }

  blocks.push({ kind: 'textarea' }, { kind: 'extra' })
  return blocks
})

function resetDetails() {
  currentRecord.value = null
  selectedDog.value = null
  selectedDogs.value = []
  selectedSire.value = null
  dogLocked.value = false
  cycleId.value = ''
  prefillTaskId.value = ''
  prefillTaskIsPersisted.value = false
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
  recordTime.value = Date.now()
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

function formatDateOnly(ts?: number | null) {
  if (!ts) return ''
  const targetDate = new Date(ts + 8 * 60 * 60 * 1000)
  return `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 1).padStart(2, '0')}-${String(targetDate.getUTCDate()).padStart(2, '0')}`
}

function hasCurrentHeatStatus(dog: Record<string, any>) {
  const statuses = Array.isArray(dog?.statuses) ? dog.statuses : []
  return statuses.some((status: any) => status?.type === '发情中')
}

async function refreshCurrentCycleStatus() {
  const requestToken = ++cycleStatusRequestToken.value
  const id = cycleId.value
  if (!id) {
    currentCycleStatus.value = ''
    return
  }

  const cycle = await findLocal<any>('breeding_cycles', id).catch(() => null)
  if (requestToken !== cycleStatusRequestToken.value) return
  currentCycleStatus.value = cycle?.status || ''
}

async function refreshLatestHeatDates() {
  const requestToken = ++latestHeatRequestToken.value
  const familyId = currentFamily.value?._id || ''
  if (!shouldShowLatestHeatMeta.value || !familyId) {
    latestHeatDates.value = {}
    return
  }

  const dogIds = breedingCandidateDogs.value.map((dog: any) => dog._id).filter(Boolean)
  if (dogIds.length === 0) {
    latestHeatDates.value = {}
    return
  }

  const dates = await listLocalLatestHeatDatesByDogIds(familyId, dogIds)
  if (requestToken !== latestHeatRequestToken.value) return
  latestHeatDates.value = dates
}

function setDateChip(chip: 'today' | 'yesterday' | 'dayBefore') {
  dateChipActive.value = chip
  const offsetMap = { today: 0, yesterday: -1, dayBefore: -2 }
  date.value = buildTimestampFromDayOffset(offsetMap[chip])
}

function onDateConfirm(value: number | string) {
  if (typeof value !== 'number') return
  date.value = value
  dateChipActive.value = ''
}

function onRecordDateTimeConfirm(value: number | string) {
  if (typeof value !== 'number') return
  recordTime.value = value
}

function onDueDateConfirm(value: number | string) {
  if (typeof value !== 'number') return
  manualDueDate.value = value
}

function toggleSymptom(symptom: string) {
  const index = selectedSymptoms.value.indexOf(symptom)
  if (index >= 0) {
    selectedSymptoms.value.splice(index, 1)
  } else {
    selectedSymptoms.value.push(symptom)
  }
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
    if (images.value.length > 0) built.images = images.value
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

function buildHeatBatchFeedbackMessage(savedCount: number, failedCount: number) {
  if (failedCount > 0) return `已保存 ${savedCount} 条记录，${failedCount} 只未保存`
  return buildRecordFeedbackMessage(savedCount)
}

function getBreedingHomeAnchorKey(type: BreedingRecordType, detailPayload: Record<string, any>) {
  if (type === 'heat') return 'breeding-step:follicle_check'
  if (type === 'follicle_check') return 'breeding-step:mating'
  if (type === 'mating') return 'breeding-step:pregnancy_check'
  if (type === 'pregnancy_check') return detailPayload.confirmed === '是' ? 'breeding-step:birth' : ''
  if (type === 'prenatal_check' || type === 'pre_labor') return 'breeding-step:birth'
  return ''
}

function resolveBreedingHomeAnchorKey(detailPayload: Record<string, any>) {
  const type = breedingType.value
  if (!type) return ''
  return getBreedingHomeAnchorKey(type, detailPayload)
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

async function refreshMatingNumberPreview() {
  if (breedingType.value !== 'mating' || isEdit.value) return

  const dogId = selectedDog.value?._id
  if (!dogId) {
    details.mating_number = 1
    return
  }

  const requestToken = ++matingPreviewRequestToken.value
  try {
    const data = await getLocalNextMatingNumberPreview(currentFamily.value?._id || '', {
      dogId,
      cycleId: cycleId.value || undefined,
    })
    if (requestToken !== matingPreviewRequestToken.value) return

    details.mating_number = Number(data.mating_number) || 1
    if (!cycleId.value && data.cycle_id) {
      cycleId.value = data.cycle_id
    }
  } catch {
    if (requestToken !== matingPreviewRequestToken.value) return
    details.mating_number = 1
  }
}

async function loadCreateState() {
  resetDetails()
  const routeQuery = resolveBreedingRouteQuery(props.query)
  cycleId.value = routeQuery.cycleId
  prefillTaskId.value = routeQuery.taskId
  selectedDog.value = routeQuery.selectedDog
  dogLocked.value = routeQuery.dogLocked

  if (breedingType.value === 'heat_observation') {
    recordTime.value = Date.now()
  } else {
    setDateChip('today')
  }

  if (!dogLocked.value && breedingType.value) {
    await dogStore.ensure().catch(() => {})
  }

  if (prefillTaskId.value) {
    const task = await getLocalTaskById(currentFamily.value?._id || '', prefillTaskId.value)
    if (task) {
      prefillTaskIsPersisted.value = true
      applyTaskPrefill(task)
    }
  }

  await refreshCurrentCycleStatus()
}

async function loadEditState() {
  if (!props.recordId) {
    loading.value = false
    return
  }

  loading.value = true
  try {
    resetDetails()
    const record = await getLocalBreedingRecordDetail(currentFamily.value?._id || '', props.recordId)
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
      recordTime.value = record.date || Date.now()
      vulvaStatus.value = record.details?.vulva_status || ''
      dischargeStatus.value = record.details?.discharge_status || ''
      selectedSymptoms.value = [...(record.details?.symptoms || [])]
    } else {
      date.value = record.date || null
      Object.assign(details, record.details || {})
      if (record.type === 'mating') {
        details.method = record.details?.method || record.details?.mating_method || '人工授精'
        details.mating_number = record.details?.mating_number || record.details?.mating_count || 1
        selectedSire.value = record.details?.sire_id
          ? { _id: record.details.sire_id, name: record.details.sire_name || record.details?.male_name || '' }
          : null
        manualDueDate.value = record.details?.is_due_date_manual ? (record.details?.expected_due_date || null) : null
      }
      if (record.type === 'pregnancy_check' || record.type === 'prenatal_check') {
        images.value = [...(record.details?.images || [])]
      }
      if (record.type === 'pregnancy_check') {
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
  if (isHeatMultiCreate.value) {
    const detailPayload = buildDetails()
    const result = await localSyncRuntime.batchAddBreedingRecordsLocally(currentFamily.value?._id || '', {
      dog_ids: selectedDogs.value.map((dog: any) => dog._id),
      type: 'heat',
      date: date.value,
      notes: notes.value || null,
      details: detailPayload,
      extra_arrangement: extraArrangementPayload.value,
    })
    const records = result?.data?.records || []
    const failed = result?.data?.failed || []

    if (records.length === 0) {
      const reason = failed[0]?.reason || '未保存任何记录'
      uni.showToast({ title: reason, icon: 'none' })
      throw new Error(reason)
    }

    markSuccess()
    queueSubmitFeedback({
      message: buildHeatBatchFeedbackMessage(records.length, failed.length),
      homeSection: 'breeding',
      homeAnchorKey: getBreedingHomeAnchorKey('heat', detailPayload),
      refreshHome: true,
    })
    await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
    uni.navigateBack({ delta: 1 })
    return result
  }

  const detailPayload = buildDetails()
  const payload: Record<string, any> = {
    type: breedingType.value,
    dog_id: selectedDog.value?._id || '',
    cycle_id: cycleId.value || undefined,
    notes: notes.value || null,
  }

  if (breedingType.value === 'heat_observation') {
    payload.date = recordTime.value
    payload.details = detailPayload
  } else {
    payload.date = date.value
    payload.cost = getCostValue()
    payload.details = detailPayload
    payload.extra_arrangement = extraArrangementPayload.value
  }

  const result = await localSyncRuntime.addBreedingRecordLocally(currentFamily.value?._id || '', payload)
  if (prefillTaskId.value && prefillTaskIsPersisted.value) {
    await localSyncRuntime.completeTaskLocally(currentFamily.value?._id || '', prefillTaskId.value)
  }

  markSuccess()

  if (breedingType.value === 'heat_observation') {
    queueSubmitFeedback({ message: '已保存观察记录' })
  } else {
    const completedTaskIds = prefillTaskId.value && prefillTaskIsPersisted.value ? [prefillTaskId.value] : []
    queueSubmitFeedback({
      message: buildRecordFeedbackMessage(1, completedTaskIds.length),
      homeSection: 'breeding',
      homeAnchorKey: resolveBreedingHomeAnchorKey(detailPayload),
      completedTaskIds,
      suppressTaskIds: completedTaskIds,
      refreshHome: true,
    })
  }

  await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
  uni.navigateBack({ delta: 1 })
  return result
}

async function submitEdit() {
  const detailPayload = buildDetails()
  const payload: Record<string, any> = {
    id: props.recordId,
    notes: notes.value || null,
    details: detailPayload,
  }

  if (breedingType.value === 'heat_observation') {
    payload.date = recordTime.value
    payload.cost = null
  } else {
    payload.date = date.value
    payload.cost = getCostValue()
    payload.extra_arrangement = extraArrangementPayload.value || null
  }

  await localSyncRuntime.updateBreedingRecordLocally(currentFamily.value?._id || '', payload)
  markSuccess()
  queueSubmitFeedback({
    message: breedingType.value === 'heat_observation' ? '已更新观察记录' : '已更新繁育记录',
    homeSection: breedingType.value === 'heat_observation' ? undefined : 'breeding',
    homeAnchorKey: breedingType.value === 'heat_observation' ? undefined : resolveBreedingHomeAnchorKey(detailPayload),
    refreshHome: breedingType.value !== 'heat_observation',
  })
  await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
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

watch(
  [breedingType, isEdit, () => selectedDog.value?._id || '', cycleId],
  async ([type, editing]) => {
    if (type !== 'mating' || editing) return
    await refreshMatingNumberPreview()
  },
  { immediate: true }
)

watch(
  cycleId,
  () => {
    void refreshCurrentCycleStatus()
  },
  { immediate: true }
)

watch(
  [breedingType, visibleTerminationTypes],
  ([type, options]) => {
    if (type !== 'abnormal_termination') return
    if (details.termination_type && !options.includes(details.termination_type)) {
      details.termination_type = ''
    }
  },
  { immediate: true }
)

watch(
  [shouldShowLatestHeatMeta, () => currentFamily.value?._id || '', () => breedingCandidateDogs.value.map((dog: any) => dog._id).join(',')],
  () => {
    void refreshLatestHeatDates()
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.field-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-3);
}

.record-form-skeleton {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.record-form-skeleton__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.record-form-skeleton__label {
  width: 84px;
  height: 12px;
  border-radius: 999px;
  background: var(--card-dim);
}

.record-form-skeleton__label--short {
  width: 62px;
}

.record-form-skeleton__control,
.record-form-skeleton__inline-cell,
.record-form-skeleton__choice,
.record-form-skeleton__panel,
.record-form-skeleton__textarea,
.record-form-skeleton__submit,
.record-form-skeleton__time-dot,
.record-form-skeleton__time-line,
.record-form-skeleton__toggle,
.record-form-skeleton__symptom,
.record-form-skeleton__chip,
.record-form-skeleton__panel-icon,
.record-form-skeleton__panel-line {
  background: linear-gradient(
    90deg,
    var(--card-dim) 25%,
    rgba(255, 255, 255, 0.22) 50%,
    var(--card-dim) 75%
  );
  background-size: 200% 100%;
  animation: breeding-record-skeleton-shimmer 1.5s infinite;
}

.record-form-skeleton__control {
  height: 48px;
  border-radius: 14px;
}

.record-form-skeleton__chip-row {
  display: flex;
  gap: 8px;
}

.record-form-skeleton__chip {
  width: 56px;
  height: 28px;
  border-radius: 999px;
}

.record-form-skeleton__inline-row {
  display: flex;
  gap: 10px;
}

.record-form-skeleton__inline-cell {
  flex: 1;
  height: 48px;
  border-radius: 14px;
}

.record-form-skeleton__choice-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.record-form-skeleton__choice-row--grid .record-form-skeleton__choice {
  width: calc(50% - 4px);
}

.record-form-skeleton__choice {
  min-width: 78px;
  width: calc(33.333% - 6px);
  height: 40px;
  border-radius: 999px;
}

.record-form-skeleton__symptom-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.record-form-skeleton__symptom {
  height: 48px;
  border-radius: 14px;
}

.record-form-skeleton__panel {
  border-radius: 16px;
  background-color: var(--card);
  padding: 14px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.record-form-skeleton__panel--extra {
  gap: 14px;
}

.record-form-skeleton__panel-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.record-form-skeleton__panel-icon {
  width: 20px;
  height: 20px;
  border-radius: 8px;
  flex-shrink: 0;
}

.record-form-skeleton__panel-copy {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.record-form-skeleton__panel-line {
  height: 10px;
  border-radius: 999px;
}

.record-form-skeleton__panel-line--label {
  width: 34%;
}

.record-form-skeleton__panel-line--value {
  width: 58%;
}

.record-form-skeleton__panel-line--sub {
  width: 46%;
}

.record-form-skeleton__panel-line--full {
  width: 100%;
}

.record-form-skeleton__panel-hint {
  width: 42%;
  height: 10px;
  border-radius: 999px;
}

.record-form-skeleton__textarea {
  height: 104px;
  border-radius: 16px;
}

.record-form-skeleton__textarea--compact {
  height: 82px;
}

.record-form-skeleton__toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.record-form-skeleton__toggle-copy {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.record-form-skeleton__toggle {
  width: 52px;
  height: 30px;
  border-radius: 999px;
  flex-shrink: 0;
}

.record-form-skeleton__submit-wrap {
  width: 100%;
}

.record-form-skeleton__submit {
  width: 100%;
  height: 52px;
  border-radius: 999px;
}

.record-form-skeleton__time {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}

.record-form-skeleton__time-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.record-form-skeleton__time-line {
  width: 54px;
  height: 12px;
  border-radius: 999px;
}

@keyframes breeding-record-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
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

.fixed-bottom--heat-observation {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
