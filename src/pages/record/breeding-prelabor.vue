<!--
  R-7 临产监测：快速监测日志
-->
<template>
  <view class="prelabor-monitor">
    <BPageHeader title="录入临产监测" :subtitle="headerSubtitle" />

    <view class="prelabor-monitor__dog-card" :class="{ 'prelabor-monitor__dog-card--locked': dogLocked }" @click="openDogPicker">
      <view class="prelabor-monitor__dog-card-bg" />
      <view class="prelabor-monitor__dog-info">
        <view class="prelabor-monitor__dog-avatar">
          <text class="material-icons-round">pets</text>
        </view>
        <view class="prelabor-monitor__dog-detail">
          <view class="prelabor-monitor__dog-title-row">
            <text class="prelabor-monitor__dog-name">{{ selectedDog?.name || '选择种母' }}</text>
            <text v-if="selectedDog" class="prelabor-monitor__dog-stage-tag">{{ getPregnancyDayText(selectedDog) }}</text>
          </view>
          <text class="prelabor-monitor__dog-meta">{{ selectedDogMeta }}</text>
        </view>
      </view>
      <text class="material-icons-round prelabor-monitor__dog-arrow">{{ dogLocked ? 'lock' : 'chevron_right' }}</text>
    </view>

    <view class="prelabor-monitor__content">
      <view v-if="trendItems.length" class="prelabor-monitor__context-card">
        <view class="prelabor-monitor__last-record">
          <view class="prelabor-monitor__last-icon">
            <text class="material-icons-round">history</text>
          </view>
          <view class="prelabor-monitor__last-info">
            <text class="prelabor-monitor__last-label">{{ lastRecordLabel }}</text>
            <text class="prelabor-monitor__last-value">{{ lastRecordSummary }}</text>
          </view>
        </view>

        <view class="prelabor-monitor__trend">
          <template v-for="(item, idx) in trendItems" :key="`${item.time}-${idx}`">
            <view class="prelabor-monitor__trend-item">
              <text
                class="prelabor-monitor__trend-num"
                :class="{
                  'prelabor-monitor__trend-num--current': idx === trendItems.length - 1,
                  'prelabor-monitor__trend-num--danger': item.temp < LOW_TEMP_THRESHOLD && idx === trendItems.length - 1,
                }"
              >
                {{ item.temp.toFixed(1) }}
              </text>
              <view
                class="prelabor-monitor__trend-bar"
                :class="getTempBarClass(item.temp)"
                :style="{ height: getTempBarHeight(item.temp) + 'px' }"
              />
              <text class="prelabor-monitor__trend-time" :class="{ 'prelabor-monitor__trend-time--current': idx === trendItems.length - 1 }">
                {{ item.label }}
              </text>
            </view>
            <text v-if="idx < trendItems.length - 1" class="material-icons-round prelabor-monitor__trend-arrow">trending_down</text>
          </template>
        </view>

        <view v-if="showLaborAlert" class="prelabor-monitor__alert">
          <text class="material-icons-round prelabor-monitor__alert-icon">warning</text>
          <text class="prelabor-monitor__alert-text">体温持续下降至37.2°C以下，可能24小时内生产</text>
        </view>
      </view>

      <view class="prelabor-monitor__section">
        <view class="prelabor-monitor__label">
          <view class="prelabor-monitor__label-dot" />
          <text class="prelabor-monitor__label-text">本次体温</text>
        </view>
        <view class="prelabor-monitor__temp-card">
          <view class="prelabor-monitor__temp-left">
            <input
              v-model="temperature"
              class="prelabor-monitor__temp-input"
              :class="{ 'prelabor-monitor__temp-input--empty': !temperature.trim() }"
              type="digit"
              placeholder="输入"
              placeholder-style="color: var(--text-4); font-size: 24px; font-weight: 700;"
              :maxlength="4"
            />
            <text class="prelabor-monitor__temp-unit" :class="{ 'prelabor-monitor__temp-unit--empty': !temperature.trim() }">°C</text>
          </view>
          <view class="prelabor-monitor__temp-right" @click="showDateTimePicker = true">
            <text class="prelabor-monitor__temp-time-label">测量时间</text>
            <view class="prelabor-monitor__temp-time-row">
              <text class="prelabor-monitor__temp-time">{{ displayTime }}</text>
              <text class="material-icons-round prelabor-monitor__temp-time-icon">schedule</text>
            </view>
          </view>
        </view>
      </view>

      <view class="prelabor-monitor__section">
        <view class="prelabor-monitor__label">
          <view class="prelabor-monitor__label-dot" />
          <text class="prelabor-monitor__label-text">观察到的征兆</text>
        </view>
        <view class="prelabor-monitor__symptom-grid">
          <view
            v-for="symptom in symptoms"
            :key="symptom"
            class="prelabor-monitor__symptom"
            :class="{ 'prelabor-monitor__symptom--selected': selectedSymptoms.includes(symptom) }"
            @click="toggleSymptom(symptom)"
          >
            <text v-if="selectedSymptoms.includes(symptom)" class="material-icons-round prelabor-monitor__symptom-check">check</text>
            <text class="prelabor-monitor__symptom-text">{{ symptom }}</text>
          </view>
        </view>
      </view>

      <view class="prelabor-monitor__section">
        <view class="prelabor-monitor__label">
          <view class="prelabor-monitor__label-dot" />
          <text class="prelabor-monitor__label-text">补充说明</text>
          <text class="prelabor-monitor__label-optional">（选填）</text>
        </view>
        <textarea
          v-model="notes"
          class="prelabor-monitor__textarea"
          placeholder="补充观察到的其他情况..."
          :maxlength="500"
        />
      </view>

      <view class="fixed-bottom">
        <BSubmitButton
          :loading="submitState === 'submitting'"
          :success="submitState === 'success'"
          :disabled="!canSubmit || submitState === 'submitting'"
          @click="handleSave"
        >
          {{ submitButtonText }}
        </BSubmitButton>
      </view>
    </view>

    <BDogPicker
      v-model:visible="dogPickerVisible"
      title="选择种母"
      role-filter="种狗"
      gender-filter="母"
      :selected-ids="selectedDogIds"
      :candidate-dogs="candidateDogs"
      :extra-meta-map="candidateDueMetaMap"
      :empty-title="pickerEmptyState.title"
      :empty-description="pickerEmptyState.description"
      :show-breeding-stage="true"
      @select="onDogSelect"
    />

    <BDateTimePicker
      v-model:visible="showDateTimePicker"
      :model-value="recordTime"
      mode="datetime"
      value-type="timestamp"
      @confirm="onDateTimeConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import { queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import { useRecordSubmitState } from '@/composables/useRecordSubmitState'
import { getLocalBreedingCycleDetail, listLocalPreLaborTemperatureHistory } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import { useDogStore } from '@/stores/dogStore'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BDateTimePicker from '@/components/form/BDateTimePicker.vue'
import { formatTimeInputValue, getBeijingDateParts, getBeijingDayDiff } from '@/utils/date'
import { getBirthCycleIdFromDog, getBreedingDogPickerEmptyState, getEligibleBreedingDogs } from '@/utils/breedingDogEligibility'
import { resolveBreedingRouteQuery } from '@/utils/recordFormRoutes'

interface TempRecord {
  temp: number
  label: string
  time: number
  symptoms?: string[]
}

const LOW_TEMP_THRESHOLD = 37.2

const { currentFamily } = useAuth()
const dogStore = useDogStore()
usePageSync({ routePath: 'pages/record/breeding-prelabor' })

const routeQuery = ref<Record<string, string>>({})
const selectedDog = ref<any>(null)
const dogLocked = ref(false)
const dogPickerVisible = ref(false)
const cycleId = ref('')
const cycleDetail = ref<any>(null)
const tempHistory = ref<TempRecord[]>([])
const temperature = ref('')
const recordTime = ref(Date.now())
const showDateTimePicker = ref(false)
const selectedSymptoms = ref<string[]>([])
const notes = ref('')

const symptoms = ['刨窝/做窝', '焦躁不安', '食欲减退', '喘气加快', '阴道分泌物', '可见宫缩', '乳汁分泌', '拒食']

const { submitState, submitButtonText, markSubmitting, markSuccess, resetSubmitState } = useRecordSubmitState({
  idleLabel: '保存记录',
  successLabel: '已保存',
})

const candidateDogs = computed(() => getEligibleBreedingDogs(dogStore.list, 'pre_labor'))
const pickerEmptyState = computed(() => getBreedingDogPickerEmptyState('pre_labor', dogStore.list, candidateDogs.value))
const candidateDueMetaMap = computed(() => {
  return candidateDogs.value.reduce<Record<string, string>>((map, dog: any) => {
    const meta = buildDogDueMeta(dog)
    if (meta) map[dog._id] = meta
    return map
  }, {})
})
const selectedDogIds = computed(() => selectedDog.value?._id ? [selectedDog.value._id] : [])
const displayTime = computed(() => {
  const parts = getBeijingDateParts(recordTime.value)
  return `${parts.month}月${parts.day}日 ${formatTimeInputValue(recordTime.value)}`
})
const currentTemp = computed(() => parseTemperature(temperature.value))
const hasObservationContent = computed(() => {
  return currentTemp.value !== null
    || selectedSymptoms.value.length > 0
    || notes.value.trim().length > 0
})
const canSubmit = computed(() => !!selectedDog.value && hasObservationContent.value && submitState.value !== 'submitting')

const expectedDueDate = computed(() => {
  const records = cycleDetail.value?.records || []
  const latestMating = [...records]
    .filter((record: any) => record?.type === 'mating')
    .sort((left: any, right: any) => Number(right.date || right.created_at || 0) - Number(left.date || left.created_at || 0))[0]
  const date = Number(latestMating?.details?.expected_due_date || 0)
  if (date > 0) return date
  const matingDate = Number(cycleDetail.value?.cycle?.mated_at || latestMating?.date || 0)
  return matingDate > 0 ? matingDate + 59 * 86400000 : null
})

const dueText = computed(() => {
  if (!expectedDueDate.value) return ''
  const diff = getBeijingDayDiff(expectedDueDate.value, Date.now())
  if (diff > 0) return `距预产期${diff}天`
  if (diff === 0) return '预产期今天'
  return `预产期已过${Math.abs(diff)}天`
})

const headerSubtitle = computed(() => {
  return selectedDog.value ? '记录体温与临产征兆' : '先选择怀孕中的种母'
})

const selectedDogMeta = computed(() => {
  if (!selectedDog.value) return '怀孕中的种母会显示在这里'
  return expectedDueSummary.value || buildDogDueMeta(selectedDog.value) || '待同步预产期'
})

const expectedDueSummary = computed(() => {
  if (!expectedDueDate.value) return ''
  const parts = getBeijingDateParts(expectedDueDate.value)
  return [`预产期 ${parts.month}月${parts.day}日`, dueText.value].filter(Boolean).join(' · ')
})

const trendItems = computed<TempRecord[]>(() => {
  const items = [...tempHistory.value]
  if (currentTemp.value !== null) {
    items.push({
      temp: currentTemp.value,
      label: '现在',
      time: recordTime.value,
      symptoms: [...selectedSymptoms.value],
    })
  }
  return items.slice(-4)
})

const lastHistoryRecord = computed(() => tempHistory.value[tempHistory.value.length - 1] || null)
const lastRecordLabel = computed(() => lastHistoryRecord.value ? `上次监测 · ${lastHistoryRecord.value.label}` : '本次监测')
const lastRecordSummary = computed(() => {
  const record = lastHistoryRecord.value
  if (!record) return currentTemp.value !== null ? `${currentTemp.value.toFixed(1)}°C` : '暂无历史记录'
  const symptomText = (record.symptoms || []).slice(0, 2).join(' / ')
  return `${record.temp.toFixed(1)}°C${symptomText ? ` · ${symptomText}` : ''}`
})

const showLaborAlert = computed(() => {
  const targetTemp = currentTemp.value ?? lastHistoryRecord.value?.temp ?? null
  return targetTemp !== null && targetTemp < LOW_TEMP_THRESHOLD
})

onLoad((query) => {
  routeQuery.value = { ...(query || {}) } as Record<string, string>
})

onMounted(async () => {
  await dogStore.ensure().catch(() => {})
  applyRouteQuery()
  if (!selectedDog.value && candidateDogs.value.length === 1) {
    selectedDog.value = candidateDogs.value[0]
    cycleId.value = getBirthCycleIdFromDog(candidateDogs.value[0])
  }
})

watch(
  [() => currentFamily.value?._id || '', () => selectedDog.value?._id || ''],
  ([familyId, dogId]) => {
    if (!familyId || !dogId) {
      tempHistory.value = []
      return
    }
    void loadTempHistory(dogId)
  },
  { immediate: true },
)

watch(
  [() => currentFamily.value?._id || '', cycleId],
  ([familyId, id]) => {
    if (!familyId || !id) {
      cycleDetail.value = null
      return
    }
    void loadCycleContext()
  },
  { immediate: true },
)

watch(
  () => selectedDog.value,
  (dog) => {
    if (!dog || cycleId.value) return
    cycleId.value = getBirthCycleIdFromDog(dog)
  },
)

function applyRouteQuery() {
  const resolved = resolveBreedingRouteQuery(routeQuery.value)
  selectedDog.value = resolved.selectedDog
  cycleId.value = resolved.cycleId
  dogLocked.value = resolved.dogLocked
}

function openDogPicker() {
  if (dogLocked.value) return
  dogPickerVisible.value = true
}

function onDogSelect(dog: any) {
  selectedDog.value = dog
  cycleId.value = getBirthCycleIdFromDog(dog)
}

async function loadTempHistory(dogId: string) {
  try {
    const records = await listLocalPreLaborTemperatureHistory(currentFamily.value?._id || '', dogId)
    tempHistory.value = records.map((record: any) => ({
      temp: record.temp || 0,
      label: formatTimeLabel(record.time),
      time: record.time,
      symptoms: record.symptoms || [],
    }))
  } catch (error) {
    console.error('加载体温记录失败', error)
  }
}

async function loadCycleContext() {
  cycleDetail.value = await getLocalBreedingCycleDetail(currentFamily.value?._id || '', cycleId.value).catch(() => null)
}

function formatTimeLabel(ts: number): string {
  const date = new Date(ts)
  const diffDays = getBeijingDayDiff(Date.now(), ts)
  const hour = date.getHours()
  const period = hour < 12 ? '早' : hour < 18 ? '午' : '晚'

  if (diffDays === 0) return `今${period}`
  if (diffDays === 1) return `昨${period}`
  return `${diffDays}天前`
}

function parseTemperature(value: string) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return null
  const temp = Number.parseFloat(trimmed)
  return Number.isFinite(temp) ? temp : null
}

function getTempBarClass(temp: number): string {
  if (temp >= 37.8) return 'prelabor-monitor__trend-bar--high'
  if (temp >= LOW_TEMP_THRESHOLD) return 'prelabor-monitor__trend-bar--mid'
  return 'prelabor-monitor__trend-bar--low'
}

function getTempBarHeight(temp: number): number {
  const clamped = Math.max(36, Math.min(39, temp))
  return 4 + ((clamped - 36) / 3) * 22
}

function toggleSymptom(symptom: string) {
  const index = selectedSymptoms.value.indexOf(symptom)
  if (index >= 0) {
    selectedSymptoms.value.splice(index, 1)
  } else {
    selectedSymptoms.value.push(symptom)
  }
}

function onDateTimeConfirm(value: number | string) {
  if (typeof value !== 'number') return
  recordTime.value = value
}

function getPregnancyStatus(dog: Record<string, any> | null | undefined) {
  const statuses = dog && Array.isArray(dog.statuses) ? dog.statuses : []
  return statuses.find((item: any) => item?.type === '怀孕中') || null
}

function getPregnancyDayText(dog: Record<string, any> | null | undefined) {
  const status = getPregnancyStatus(dog)
  const day = Number(status?.progress?.current || 0)
  return Number.isFinite(day) && day > 0 ? `怀孕第${Math.floor(day)}天` : '怀孕中'
}

function buildDogDueMeta(dog: Record<string, any> | null | undefined) {
  const status = getPregnancyStatus(dog)
  const metaTexts: string[] = Array.isArray(status?.meta)
    ? status.meta.map((item: any) => String(item?.text || '').trim()).filter(Boolean)
    : []
  const due = metaTexts.find(text => text.includes('预产期')) || ''
  const remain = metaTexts.find(text => text.includes('还有') || text.includes('已过')) || ''
  return [due, remain].filter(Boolean).join(' · ')
}

function buildDetailPayload() {
  const details: Record<string, any> = {
    symptoms: [...selectedSymptoms.value],
    nesting_behavior: selectedSymptoms.value.includes('刨窝/做窝'),
  }
  const temp = currentTemp.value
  if (temp !== null) details.temperature = temp
  if (selectedSymptoms.value.includes('食欲减退')) details.appetite_change = '食欲减退'

  const otherSigns = selectedSymptoms.value.filter(item => item !== '刨窝/做窝' && item !== '食欲减退')
  if (otherSigns.length > 0) details.other_signs = otherSigns.join('、')

  return details
}

async function handleSave() {
  if (!selectedDog.value) {
    uni.showToast({ title: '请选择犬只', icon: 'none' })
    return
  }
  if (!hasObservationContent.value) {
    uni.showToast({ title: '请填写体温、征兆或补充说明', icon: 'none' })
    return
  }
  const temp = currentTemp.value
  if (temp !== null && (temp < 35 || temp > 42)) {
    uni.showToast({ title: '请输入有效体温', icon: 'none' })
    return
  }

  markSubmitting()
  try {
    await localSyncRuntime.addBreedingRecordLocally(currentFamily.value?._id || '', {
      type: 'pre_labor',
      dog_id: selectedDog.value?._id || '',
      cycle_id: cycleId.value || undefined,
      date: recordTime.value,
      details: buildDetailPayload(),
      notes: notes.value || null,
    })
    markSuccess()
    queueSubmitFeedback({
      message: '已保存临产监测',
      homeSection: 'breeding',
      homeAnchorKey: 'breeding-step:birth',
      refreshHome: true,
    })
    await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
    uni.navigateBack({ delta: 1 })
  } catch {
    resetSubmitState()
  } finally {
    if (submitState.value !== 'success') {
      resetSubmitState()
    }
  }
}
</script>

<style lang="scss" scoped>
.prelabor-monitor {
  min-height: 100vh;
  background: var(--bg);

  :deep(.b-page-header) {
    align-items: flex-start;
    padding-bottom: 12px;
  }

  :deep(.b-page-header__title) {
    font-size: 16px;
    font-weight: 700;
  }

  :deep(.b-page-header__subtitle) {
    font-size: 12px;
    color: var(--text-3);
  }

  &__dog-card {
    margin: 0 var(--space-page) 12px;
    padding: 14px 16px;
    border-radius: 16px;
    background: var(--card);
    box-shadow: var(--shadow);
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
    transition: all 0.15s ease;

    &:active {
      transform: scale(0.975);
      box-shadow: 0 1px 6px rgba(234, 62, 119, 0.04);
    }

    &--locked:active {
      transform: none;
    }
  }

  &__dog-card-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%);
    pointer-events: none;
  }

  &__dog-info {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    position: relative;
    z-index: 1;
  }

  &__dog-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--rose), var(--amber));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .material-icons-round {
      font-size: 22px;
      color: #fff;
    }
  }

  &__dog-detail {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__dog-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  &__dog-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__dog-stage-tag {
    max-width: 74px;
    padding: 2px 6px;
    border-radius: 999px;
    background: var(--primary-soft);
    color: var(--primary);
    font-size: 10px;
    font-weight: 700;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
  }

  &__dog-meta {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__dog-arrow {
    font-size: 20px;
    color: var(--text-4);
    position: relative;
    z-index: 1;
    margin-left: 12px;
    flex-shrink: 0;
  }

  &__content {
    padding: 0 var(--space-page) 114px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  &__label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__label-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--rose);
    flex-shrink: 0;
  }

  &__label-text {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
  }

  &__label-optional {
    font-size: 13px;
    font-weight: 400;
    color: var(--text-3);
  }

  &__context-card {
    background: var(--card);
    border-radius: 16px;
    box-shadow: var(--shadow);
    overflow: hidden;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 35%);
      pointer-events: none;
    }
  }

  &__context-card > * {
    position: relative;
    z-index: 1;
  }

  &__last-record {
    padding: 14px 16px 10px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__last-icon {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: #FFD4DE;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .material-icons-round {
      font-size: 17px;
      color: var(--rose);
    }
  }

  &__last-info {
    flex: 1;
    min-width: 0;
  }

  &__last-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
  }

  &__last-value {
    display: block;
    margin-top: 1px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__trend {
    padding: 10px 16px 8px;
    display: flex;
    align-items: flex-end;
    gap: 6px;
  }

  &__trend-item {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  &__trend-num {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-2);

    &--current {
      font-size: 15px;
      font-weight: 800;
      color: var(--rose);
    }

    &--danger {
      color: var(--red);
    }
  }

  &__trend-bar {
    width: 100%;
    min-height: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;

    &--high {
      background: rgba(61, 174, 111, 0.2);
    }

    &--mid {
      background: rgba(232, 155, 62, 0.2);
    }

    &--low {
      background: linear-gradient(135deg, var(--rose), var(--red));
      box-shadow: 0 2px 8px rgba(224, 82, 82, 0.25);
    }
  }

  &__trend-time {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-4);

    &--current {
      color: var(--rose);
      font-weight: 700;
    }
  }

  &__trend-arrow {
    align-self: center;
    margin-bottom: 18px;
    font-size: 14px;
    color: var(--text-4);
    flex-shrink: 0;
  }

  &__alert {
    padding: 10px 16px;
    border-top: 1px solid rgba(216, 203, 189, 0.15);
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--red);
  }

  &__alert-icon {
    font-size: 16px;
    color: var(--red);
  }

  &__alert-text {
    font-size: 12px;
    font-weight: 700;
    color: var(--red);
  }

  &__temp-card {
    background: var(--card);
    border-radius: 16px;
    padding: 16px;
    box-shadow: var(--shadow);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__temp-left {
    display: flex;
    align-items: baseline;
    gap: 4px;
    min-width: 0;
  }

  &__temp-input {
    width: 90px;
    border: none;
    background: transparent;
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 800;
    color: var(--text-1);

    &--empty {
      font-family: var(--font-body);
      font-size: 24px;
      font-weight: 700;
      color: var(--text-4);
    }
  }

  &__temp-unit {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-2);

    &--empty {
      color: var(--text-4);
    }
  }

  &__temp-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;
  }

  &__temp-time-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-3);
  }

  &__temp-time-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__temp-time {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__temp-time-icon {
    font-size: 15px;
    color: var(--text-2);
  }

  &__symptom-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  &__symptom {
    height: 44px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    border-radius: 14px;
    background: var(--card-dim);
    transition: all 0.12s ease;

    &:active {
      transform: scale(0.94);
      filter: brightness(0.95);
    }

    &--selected {
      background: var(--primary-soft);
    }
  }

  &__symptom-check {
    font-size: 16px;
    color: var(--primary);
  }

  &__symptom-text {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-2);
  }

  &__symptom--selected &__symptom-text {
    color: var(--primary);
    font-weight: 600;
  }

  &__textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 60px;
    padding: 12px 14px;
    border: 1.5px solid var(--text-4);
    border-radius: 14px;
    background: var(--card);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    color: var(--text-1);
  }
}
</style>
