<template>
  <view class="page">
    <BPageHeader title="创建用药任务">
      <template #right>
        <view class="header-add" @click="openProtocolPicker">
          <text class="material-icons-round" style="font-size: 18px;">medication</text>
          <text class="header-add__text">从方案库选择</text>
        </view>
      </template>
    </BPageHeader>

    <view class="form-body">
      <view class="field-group">
        <view class="field-label"><text>选择犬只</text></view>
        <BDogPicker v-model="selectedDogs" :multiple="true" title="选择犬只" />
      </view>

      <view class="field-group">
        <view class="field-label"><text>药品名称</text></view>
        <input v-model="drugName" class="form-input" type="text" placeholder="请输入药品名称" />
      </view>

      <view class="field-group">
        <view class="field-label"><text>剂量与单位</text></view>
        <view class="dosage-row">
          <input v-model="dosage" class="form-input dosage-row__input" type="digit" placeholder="剂量" />
          <view class="pill-select dosage-row__unit">
            <view
              v-for="unit in dosageUnits"
              :key="unit.value"
              class="pill-select__item"
              :class="{ 'pill-select__item--active': dosageUnit === unit.value }"
              @click="dosageUnit = unit.value"
            >
              <text>{{ unit.label }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="field-group">
        <view class="field-label"><text>给药方式</text></view>
        <view class="pill-select">
          <view
            v-for="medicationMethod in methods"
            :key="medicationMethod.value"
            class="pill-select__item"
            :class="{ 'pill-select__item--active': method === medicationMethod.value }"
            @click="method = medicationMethod.value"
          >
            <text>{{ medicationMethod.label }}</text>
          </view>
        </view>
      </view>

      <view class="field-group">
        <view class="field-label"><text>频率</text></view>
        <view class="pill-select">
          <view
            v-for="item in frequencies"
            :key="item.value"
            class="pill-select__item"
            :class="{ 'pill-select__item--active': frequency === item.value }"
            @click="frequency = item.value"
          >
            <text>{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="field-group">
        <view class="field-label"><text>持续天数</text></view>
        <view class="input-suffix-wrapper">
          <input v-model="durationDays" class="form-input form-input--suffixed" type="number" placeholder="默认1天" />
          <text class="input-suffix">天</text>
        </view>
      </view>

      <view class="field-group">
        <view class="field-label"><text>开始日期</text></view>
        <picker mode="date" :value="dateStr" @change="onDateChange">
          <view class="form-input form-input--picker">
            <text>{{ dateStr || '请选择日期' }}</text>
            <text class="material-icons-round form-input__suffix">calendar_today</text>
          </view>
        </picker>
        <view class="date-chips">
          <text class="date-chip" :class="{ active: chipActive === 'today' }" @click="setChip('today')">今天</text>
          <text class="date-chip" :class="{ active: chipActive === 'yesterday' }" @click="setChip('yesterday')">昨天</text>
          <text class="date-chip" :class="{ active: chipActive === 'dayBefore' }" @click="setChip('dayBefore')">前天</text>
        </view>
      </view>

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
          <text>注意事项</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <textarea v-model="notes" class="form-textarea" :auto-height="true" placeholder="输入注意事项..." />
      </view>

      <view class="save-check" @click="saveAsProtocol = !saveAsProtocol">
        <view class="save-check__box" :class="{ 'save-check__box--checked': saveAsProtocol }">
          <text v-if="saveAsProtocol" class="material-icons-round" style="font-size: 16px; color: #fff;">check</text>
        </view>
        <text class="save-check__label">保存为常用方案</text>
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

    <BSheet v-model:visible="showProtocolPicker" title="选择用药方案">
      <view class="protocol-picker">
        <view v-if="protocolLoading" class="protocol-picker__skeleton">
          <view v-for="index in 2" :key="index" class="skeleton-item">
            <view class="skeleton-icon" />
            <view class="skeleton-body">
              <view class="skeleton-line skeleton-line--title" />
              <view class="skeleton-line skeleton-line--sub" />
            </view>
          </view>
        </view>
        <view v-else-if="protocols.length === 0" class="protocol-picker__empty">
          <text class="material-icons-round" style="font-size: 36px; color: var(--text-4);">medication</text>
          <text class="protocol-picker__empty-text">暂无已保存的方案</text>
        </view>
        <view v-else class="protocol-picker__list">
          <view
            v-for="protocol in protocols"
            :key="protocol._id"
            class="protocol-picker__item"
            @click="applyProtocol(protocol)"
          >
            <view class="protocol-picker__item-icon">
              <text class="material-icons-round" style="font-size: 18px; color: var(--plum);">medication</text>
            </view>
            <view class="protocol-picker__item-body">
              <text class="protocol-picker__item-name">{{ protocol.name }}</text>
              <text class="protocol-picker__item-detail">
                {{ protocol.drug_name }}{{ protocol.dosage ? ' · ' + protocol.dosage + (protocol.dosage_unit || 'mg') : '' }}{{ protocol.duration_days ? ' · ' + protocol.duration_days + '天' : '' }}
              </text>
            </view>
            <text class="material-icons-round" style="font-size: 18px; color: var(--text-4);">chevron_right</text>
          </view>
        </view>
        <view class="protocol-picker__footer">
          <view class="protocol-picker__new-link" @click="goToNewProtocol">
            <text class="material-icons-round" style="font-size: 16px; color: var(--primary);">add</text>
            <text class="protocol-picker__new-text">新建方案</text>
          </view>
        </view>
      </view>
    </BSheet>

    <BModal
      v-model:visible="showDupModal"
      :title="dupModalTitle"
      :confirmText="dupConfirmText"
      cancelText="取消"
      @confirm="dupResolve?.(true)"
      @cancel="dupResolve?.(false)"
    >
      <view class="dup-dialog">
        <text class="dup-dialog__summary">{{ dupModalSummary }}</text>

        <view v-if="dupList.length === 1" class="dup-single-card" @click="toggleOverride(dupList[0].dog_id)">
          <view class="dup-single-card__main">
            <view class="dup-check-box" :class="{ 'dup-check-box--checked': dupOverrideDogIds.includes(dupList[0].dog_id) }">
              <text v-if="dupOverrideDogIds.includes(dupList[0].dog_id)" class="material-icons-round" style="font-size: 13px; color: #fff;">check</text>
            </view>
            <view class="dup-single-card__body">
              <text class="dup-single-card__name">{{ dupList[0].dogName }}</text>
              <text class="dup-single-card__progress">当前疗程进度：第{{ dupList[0].day }}/{{ dupList[0].totalDays }}天</text>
            </view>
          </view>
          <text class="dup-single-card__hint">勾选后将取消旧任务并创建新任务</text>
        </view>

        <template v-else>
          <view v-if="cleanDogs.length > 0" class="dup-section">
            <text class="dup-section__title dup-section__title--ok">将创建（{{ cleanDogs.length }}只）</text>
            <view v-for="dog in cleanDogs" :key="dog._id" class="dup-row">
              <text class="dup-row__name">{{ dog.name }}</text>
              <text class="dup-row__tag">新建</text>
            </view>
          </view>

          <view v-if="cleanDogs.length > 0" class="dup-divider" />

          <view class="dup-section">
            <view class="dup-section__header">
              <text class="dup-section__title dup-section__title--warn">已有同名任务（{{ dupList.length }}只）</text>
              <text class="dup-section__select-all" @click="toggleAllOverride">
                {{ dupOverrideDogIds.length === dupList.length ? '取消全选' : '全选' }}
              </text>
            </view>
            <text class="dup-section__hint">勾选后将取消旧任务并创建新任务</text>
            <view
              v-for="(dup, index) in dupList"
              :key="index"
              class="dup-row dup-row--selectable"
              @click="toggleOverride(dup.dog_id)"
            >
              <view class="dup-check-box" :class="{ 'dup-check-box--checked': dupOverrideDogIds.includes(dup.dog_id) }">
                <text v-if="dupOverrideDogIds.includes(dup.dog_id)" class="material-icons-round" style="font-size: 13px; color: #fff;">check</text>
              </view>
              <view class="dup-row__body">
                <text class="dup-row__name">{{ dup.dogName }}</text>
                <text class="dup-row__progress">第{{ dup.day }}/{{ dup.totalDays }}天</text>
              </view>
            </view>
          </view>
        </template>
      </view>
    </BModal>

    <BModal
      v-model:visible="showNameModal"
      title="保存为用药方案"
      confirm-text="保存"
      @confirm="doSaveProtocol"
    >
      <view class="save-protocol">
        <text class="save-protocol__desc">将本次用药设置保存为方案，方便下次快速填写。</text>
        <view class="save-protocol__field">
          <text class="save-protocol__label">方案名称</text>
          <input
            v-model="protocolName"
            class="save-protocol__input"
            placeholder="如：消炎常规方案"
          />
        </view>
      </view>
    </BModal>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCloudCall } from '@/composables/useCloudCall'
import { useRecordSubmitState } from '@/composables/useRecordSubmitState'
import { buildTaskFeedbackMessage, queueSubmitFeedback, wait } from '@/composables/useSubmitFeedback'
import { resolveMedicationRouteQuery } from '@/utils/recordFormRoutes'
import { useProtocolStore, type MedicationProtocol } from '@/stores/protocolStore'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BModal from '@/components/layout/BModal.vue'

const props = withDefaults(defineProps<{
  query?: Record<string, string>
}>(), {
  query: () => ({}),
})

const selectedDogs = ref<any[]>([])
const drugName = ref('')
const dosage = ref('')
const dosageUnit = ref('mg')
const method = ref('oral')
const frequency = ref('once_daily')
const durationDays = ref('')
const notes = ref('')
const costInput = ref('')
const illnessRecordId = ref('')
const saveAsProtocol = ref(false)

const { submitState, submitButtonText, markSubmitting, markSuccess, resetSubmitState } = useRecordSubmitState({
  idleLabel: '创建用药任务',
  successLabel: '已创建',
})

const today = new Date()
today.setHours(0, 0, 0, 0)
const date = ref<number>(today.getTime())
const chipActive = ref('today')

const dateStr = computed(() => {
  const targetDate = new Date(date.value)
  return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`
})

const dosageUnits = [
  { label: '毫升', value: 'ml' },
  { label: '毫克', value: 'mg' },
  { label: '片', value: 'tablet' },
]
const methods = [
  { label: '口服', value: 'oral' },
  { label: '注射', value: 'injection' },
]
const frequencies = [
  { label: '每日1次', value: 'once_daily' },
  { label: '每日2次', value: 'twice_daily' },
  { label: '每日3次', value: 'three_daily' },
]

const parsedDuration = computed(() => {
  const parsed = parseInt(durationDays.value)
  return parsed > 0 ? parsed : 1
})

const canSubmit = computed(() => {
  return selectedDogs.value.length > 0
    && !!drugName.value.trim()
    && !!dosage.value
    && !!date.value
})

function onDateChange(event: any) {
  date.value = new Date(event.detail.value + 'T00:00:00+08:00').getTime()
  chipActive.value = ''
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = (now.getTime() - date.value) / 86400000
  if (diff === 0) chipActive.value = 'today'
  else if (diff === 1) chipActive.value = 'yesterday'
  else if (diff === 2) chipActive.value = 'dayBefore'
}

function setChip(chip: string) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const offsets: Record<string, number> = { today: 0, yesterday: -1, dayBefore: -2 }
  date.value = now.getTime() + (offsets[chip] || 0) * 86400000
  chipActive.value = chip
}

const { run: batchStartMedication } = useCloudCall('health-service', 'batchStartMedication', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})
const { run: batchCheckDuplicate } = useCloudCall<{ data: any[] }>('health-service', 'batchCheckDuplicateMedication')
const { run: saveProtocol } = useCloudCall('health-service', 'addMedicationProtocol', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

async function submit() {
  if (!canSubmit.value || submitState.value === 'submitting') return
  markSubmitting()
  try {
    const drug = drugName.value.trim()
    const dogIds = selectedDogs.value.map((dog: any) => dog._id)

    const duplicateRes = await batchCheckDuplicate(dogIds, drug)
    dupList.value = duplicateRes?.data || []
    if (dupList.value.length > 0) {
      dupOverrideDogIds.value = []
      showDupModal.value = true
      const confirmed = await new Promise<boolean>((resolve) => {
        dupResolve.value = resolve
      })
      showDupModal.value = false
      dupResolve.value = null
      if (!confirmed || dupFinalCount.value === 0) {
        resetSubmitState()
        return
      }
    }

    const duplicateDogIds = new Set(dupList.value.map((item: any) => item.dog_id))
    const cleanDogIds = dogIds.filter(dogId => !duplicateDogIds.has(dogId))
    const overrideDogIds = [...dupOverrideDogIds.value]
    const finalDogIds = [...cleanDogIds, ...overrideDogIds]
    const frequencyMap: Record<string, number> = { once_daily: 1, twice_daily: 2, three_daily: 3 }
    const methodLabels: Record<string, string> = { oral: '口服', injection: '注射' }

    await batchStartMedication({
      dog_ids: finalDogIds,
      override_dog_ids: overrideDogIds.length > 0 ? overrideDogIds : undefined,
      drug_name: drug,
      dosage: dosage.value,
      dosage_unit: dosageUnit.value,
      method: methodLabels[method.value] || method.value,
      frequency: frequencyMap[frequency.value] || 1,
      duration_days: parsedDuration.value,
      actual_start_date: date.value,
      notes: notes.value || null,
      cost: costInput.value ? parseFloat(costInput.value) : null,
      protocol_id: null,
      illnessRecordId: selectedDogs.value.length === 1 ? (illnessRecordId.value || null) : null,
    })

    const created = finalDogIds.length
    const skipped = Math.max(0, dogIds.length - finalDogIds.length)
    markSuccess()
    queueSubmitFeedback({
      message: buildTaskFeedbackMessage(created, skipped),
      createdDate: date.value,
      createdCount: created,
      skippedCount: skipped,
      refreshHome: true,
    })

    if (saveAsProtocol.value) {
      protocolName.value = ''
      showNameModal.value = true
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

const protocolStore = useProtocolStore()
const showProtocolPicker = ref(false)
const protocolLoading = ref(false)
const protocols = computed(() => protocolStore.list)

async function openProtocolPicker() {
  showProtocolPicker.value = true
  if (protocolStore.list.length === 0) protocolLoading.value = true
  await protocolStore.ensure()
  protocolLoading.value = false
}

function applyProtocol(protocol: MedicationProtocol) {
  drugName.value = protocol.drug_name || ''
  dosage.value = protocol.dosage || ''
  durationDays.value = protocol.duration_days ? String(protocol.duration_days) : ''
  dosageUnit.value = protocol.dosage_unit || 'mg'
  method.value = protocol.method || 'oral'
  frequency.value = protocol.frequency || 'once_daily'
  notes.value = protocol.notes || ''
  showProtocolPicker.value = false
}

function goToNewProtocol() {
  showProtocolPicker.value = false
  uni.navigateTo({ url: '/pages/health/medication-protocols' })
}

const showNameModal = ref(false)
const protocolName = ref('')

async function doSaveProtocol() {
  if (!protocolName.value.trim()) {
    uni.showToast({ title: '请输入方案名称', icon: 'none' })
    return
  }
  await saveProtocol({
    name: protocolName.value.trim(),
    drug_name: drugName.value.trim(),
    dosage: dosage.value || null,
    dosage_unit: dosageUnit.value || null,
    method: method.value || null,
    frequency: frequency.value || null,
    duration_days: parseInt(durationDays.value) || null,
    notes: notes.value || null,
  })
  showNameModal.value = false
  protocolStore.reload()
  await wait(140)
  uni.navigateBack()
}

const showDupModal = ref(false)
const dupList = ref<any[]>([])
const dupOverrideDogIds = ref<string[]>([])
const dupResolve = ref<((value: boolean) => void) | null>(null)

const cleanDogs = computed(() => {
  const duplicateDogIds = new Set(dupList.value.map((item: any) => item.dog_id))
  return selectedDogs.value.filter((dog: any) => !duplicateDogIds.has(dog._id))
})

const dupModalTitle = computed(() => {
  if (dupList.value.length === 1) return '发现同名用药任务'
  return cleanDogs.value.length > 0 ? '部分犬只有同名任务' : '这些犬只已有同名任务'
})

const dupModalSummary = computed(() => {
  if (dupList.value.length === 1) return '当前犬只已有同名用药任务，可按需替换为新的疗程。'
  if (cleanDogs.value.length > 0) return '未重复的犬只会直接创建；勾选重复项后会取消旧任务并创建新任务。'
  return '这些犬只都已有同名用药任务，勾选后会取消旧任务并创建新任务。'
})

const dupFinalCount = computed(() => cleanDogs.value.length + dupOverrideDogIds.value.length)
const dupConfirmText = computed(() => {
  return dupFinalCount.value === 0 ? '跳过（不创建）' : `确认创建（${dupFinalCount.value}只）`
})

function toggleOverride(dogId: string) {
  const index = dupOverrideDogIds.value.indexOf(dogId)
  if (index === -1) {
    dupOverrideDogIds.value.push(dogId)
  } else {
    dupOverrideDogIds.value.splice(index, 1)
  }
}

function toggleAllOverride() {
  if (dupOverrideDogIds.value.length === dupList.value.length) {
    dupOverrideDogIds.value = []
  } else {
    dupOverrideDogIds.value = dupList.value.map((item: any) => item.dog_id)
  }
}

onMounted(() => {
  const routeQuery = resolveMedicationRouteQuery(props.query)
  selectedDogs.value = routeQuery.selectedDogs
  illnessRecordId.value = routeQuery.illnessRecordId
})
</script>

<style lang="scss" scoped>
.dosage-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dosage-row__input {
  flex: 1;
}

.dosage-row__unit {
  flex: 2;
}

.input-suffix-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-suffix {
  position: absolute;
  right: 14px;
  font-size: 14px;
  color: var(--text-3);
  pointer-events: none;
}

.form-input--suffixed {
  padding-right: 40px;
}

.header-add {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--primary);
  padding: 6px 14px 6px 10px;
  border-radius: 20px;
  background: var(--primary-soft);
  transition: all 0.12s ease;

  &:active {
    transform: scale(0.92);
    background: var(--icon-rose);
  }
}

.header-add__text {
  font-size: 13px;
  font-weight: 700;
}

.save-check {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}

.save-check__box {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 2px solid var(--text-4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.save-check__box--checked {
  border-color: var(--primary);
  background: var(--primary);
}

.save-check__label {
  font-size: 14px;
  color: var(--text-2);
}

.dup-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dup-dialog__summary {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-2);
  text-align: center;
}

.dup-single-card {
  padding: 14px 14px 12px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(255, 244, 247, 0.96), rgba(255, 255, 255, 0.98));
  border: 1px solid rgba(214, 102, 140, 0.14);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dup-single-card__main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dup-single-card__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dup-single-card__name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
}

.dup-single-card__progress {
  font-size: 13px;
  color: var(--text-2);
}

.dup-single-card__hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-3);
}

.dup-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dup-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dup-section__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}

.dup-section__title--ok {
  color: var(--green);
}

.dup-section__title--warn {
  color: var(--plum);
}

.dup-section__select-all {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
}

.dup-section__hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-3);
}

.dup-divider {
  height: 1px;
  background: rgba(15, 23, 42, 0.08);
}

.dup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--card-dim);
}

.dup-row--selectable {
  justify-content: flex-start;
  gap: 12px;
  background: linear-gradient(180deg, rgba(248, 244, 255, 0.96), rgba(255, 255, 255, 0.98));
  border: 1px solid rgba(134, 104, 176, 0.1);
}

.dup-row__body {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: 1;
}

.dup-row__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

.dup-row__tag,
.dup-row__progress {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-3);
}

.dup-check-box {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 1.5px solid rgba(134, 104, 176, 0.3);
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dup-check-box--checked {
  border-color: var(--primary);
  background: var(--primary);
}
</style>
