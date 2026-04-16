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
      <!-- 选择犬只 -->
      <view class="field-group">
        <view class="field-label"><text>选择犬只</text></view>
        <BDogPicker v-model="selectedDogs" :multiple="true" title="选择犬只" />
      </view>

      <!-- 药品名称 -->
      <view class="field-group">
        <view class="field-label"><text>药品名称</text></view>
        <input v-model="drugName" class="form-input" type="text" placeholder="请输入药品名称" />
      </view>

      <!-- 剂量与单位 -->
      <view class="field-group">
        <view class="field-label"><text>剂量与单位</text></view>
        <view class="dosage-row">
          <input v-model="dosage" class="form-input dosage-row__input" type="digit" placeholder="剂量" />
          <view class="pill-select dosage-row__unit">
            <view
              v-for="u in dosageUnits"
              :key="u.value"
              class="pill-select__item"
              :class="{ 'pill-select__item--active': dosageUnit === u.value }"
              @click="dosageUnit = u.value"
            >
              <text>{{ u.label }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 给药方式 -->
      <view class="field-group">
        <view class="field-label"><text>给药方式</text></view>
        <view class="pill-select">
          <view
            v-for="m in methods"
            :key="m.value"
            class="pill-select__item"
            :class="{ 'pill-select__item--active': method === m.value }"
            @click="method = m.value"
          >
            <text>{{ m.label }}</text>
          </view>
        </view>
      </view>

      <!-- 频率 -->
      <view class="field-group">
        <view class="field-label"><text>频率</text></view>
        <view class="pill-select">
          <view
            v-for="f in frequencies"
            :key="f.value"
            class="pill-select__item"
            :class="{ 'pill-select__item--active': frequency === f.value }"
            @click="frequency = f.value"
          >
            <text>{{ f.label }}</text>
          </view>
        </view>
      </view>

      <!-- 持续天数 -->
      <view class="field-group">
        <view class="field-label"><text>持续天数</text></view>
        <view class="input-suffix-wrapper">
          <input v-model="durationDays" class="form-input form-input--suffixed" type="number" placeholder="默认1天" />
          <text class="input-suffix">天</text>
        </view>
      </view>

      <!-- 开始日期 -->
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

      <!-- 费用（选填） -->
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

      <!-- 注意事项 -->
      <view class="field-group">
        <view class="field-label">
          <text>注意事项</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <textarea v-model="notes" class="form-textarea" :auto-height="true" placeholder="输入注意事项..." />
      </view>

      <!-- 保存为常用方案 -->
      <view class="save-check" @click="saveAsProtocol = !saveAsProtocol">
        <view class="save-check__box" :class="{ 'save-check__box--checked': saveAsProtocol }">
          <text v-if="saveAsProtocol" class="material-icons-round" style="font-size: 16px; color: #fff;">check</text>
        </view>
        <text class="save-check__label">保存为常用方案</text>
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

    <!-- 用药方案选择器 Sheet -->
    <BSheet v-model:visible="showProtocolPicker" title="选择用药方案">
      <view class="protocol-picker">
        <!-- 骨架屏 -->
        <view v-if="protocolLoading" class="protocol-picker__skeleton">
          <view v-for="i in 2" :key="i" class="skeleton-item">
            <view class="skeleton-icon" />
            <view class="skeleton-body">
              <view class="skeleton-line skeleton-line--title" />
              <view class="skeleton-line skeleton-line--sub" />
            </view>
          </view>
        </view>
        <!-- 空态 -->
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

    <!-- 同名用药确认 Modal -->
    <BModal
      v-model:visible="showDupModal"
      :title="cleanDogs.length > 0 ? '部分犬只已有同名任务' : '所有犬只已有同名任务'"
      :confirmText="dupConfirmText"
      cancelText="取消"
      @confirm="dupResolve?.(true)"
      @cancel="dupResolve?.(false)"
    >
      <view class="dup-dialog">
        <!-- 无重复犬 → 直接创建 -->
        <view v-if="cleanDogs.length > 0" class="dup-section">
          <text class="dup-section__title dup-section__title--ok">将创建（{{ cleanDogs.length }}只）</text>
          <view v-for="dog in cleanDogs" :key="dog._id" class="dup-row">
            <text class="dup-row__name">{{ dog.name }}</text>
            <text class="dup-row__tag">新建</text>
          </view>
        </view>

        <view v-if="cleanDogs.length > 0" class="dup-divider" />

        <!-- 有重复犬 → 可勾选覆盖 -->
        <view class="dup-section">
          <view class="dup-section__header">
            <text class="dup-section__title dup-section__title--warn">已有同名任务（{{ dupList.length }}只）</text>
            <text class="dup-section__select-all" @click="toggleAllOverride">
              {{ dupOverrideDogIds.length === dupList.length ? '取消全选' : '全选' }}
            </text>
          </view>
          <text class="dup-section__hint">勾选后将覆盖旧任务</text>
          <view
            v-for="(dup, i) in dupList"
            :key="i"
            class="dup-row dup-row--selectable"
            @click="toggleOverride(dup.dog_id)"
          >
            <view class="dup-check-box" :class="{ 'dup-check-box--checked': dupOverrideDogIds.includes(dup.dog_id) }">
              <text v-if="dupOverrideDogIds.includes(dup.dog_id)" class="material-icons-round" style="font-size: 13px; color: #fff;">check</text>
            </view>
            <text class="dup-row__name">{{ dup.dogName }}</text>
            <text class="dup-row__progress">第{{ dup.day }}/{{ dup.totalDays }}天</text>
          </view>
        </view>
      </view>
    </BModal>

    <!-- 保存方案命名 Modal -->
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
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { buildTaskFeedbackMessage, queueSubmitFeedback, wait } from '@/composables/useSubmitFeedback'
import { useProtocolStore, type MedicationProtocol } from '@/stores/protocolStore'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BModal from '@/components/layout/BModal.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'

const selectedDogs = ref<any[]>([])
const drugName = ref('')
const dosage = ref('')
const dosageUnit = ref('mg')
const method = ref('oral')
const frequency = ref('once_daily')
const durationDays = ref('')
const notes = ref('')
const costInput = ref('')
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')

// 日期
const today = new Date()
today.setHours(0, 0, 0, 0)
const date = ref<number>(today.getTime())
const chipActive = ref('today')

const dateStr = computed(() => {
  if (!date.value) return ''
  const d = new Date(date.value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

function onDateChange(e: any) {
  date.value = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
  chipActive.value = ''
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const diff = (now.getTime() - date.value) / 86400000
  if (diff === 0) chipActive.value = 'today'
  else if (diff === 1) chipActive.value = 'yesterday'
  else if (diff === 2) chipActive.value = 'dayBefore'
}

function setChip(chip: string) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const map: Record<string, number> = { today: 0, yesterday: -1, dayBefore: -2 }
  date.value = now.getTime() + (map[chip] || 0) * 86400000
  chipActive.value = chip
}
const saveAsProtocol = ref(false)
const illnessRecordId = ref('')

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
  const n = parseInt(durationDays.value)
  return n > 0 ? n : 1
})

const canSubmit = computed(() => {
  return selectedDogs.value.length > 0
    && !!drugName.value.trim()
    && !!dosage.value
    && !!date.value
})

const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '提交中...'
  if (submitState.value === 'success') return '已创建'
  return '创建用药任务'
})

// ==================== 提交 ====================

const { run: batchStartMedication } = useCloudCall('health-service', 'batchStartMedication', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

const { run: batchCheckDuplicate } = useCloudCall<{ data: any[] }>('health-service', 'batchCheckDuplicateMedication')

const frequencyLabels: Record<string, string> = {
  once_daily: '每日1次',
  twice_daily: '每日2次',
  three_daily: '每日3次',
}

const unitLabels: Record<string, string> = {
  ml: '毫升',
  mg: '毫克',
  tablet: '片',
}

const methodLabels: Record<string, string> = {
  oral: '口服',
  injection: '注射',
}

async function submit() {
  submitState.value = 'submitting'
  try {
    const drug = drugName.value.trim()
    const dogIds = selectedDogs.value.map((d: any) => d._id)

    // 批量检查同药名重复（一次调用）
    const dupRes = await batchCheckDuplicate(dogIds, drug)
    dupList.value = dupRes?.data || []
    if (dupList.value.length > 0) {
      dupOverrideDogIds.value = []
      showDupModal.value = true
      const confirmed = await new Promise<boolean>((resolve) => {
        dupResolve.value = resolve
      })
      showDupModal.value = false
      dupResolve.value = null
      if (!confirmed || dupFinalCount.value === 0) {
        submitState.value = 'idle'
        return
      }
    }

    // 计算最终创建犬只：无重复的 + 用户选择覆盖的
    const dupDogIdSet = new Set(dupList.value.map((d: any) => d.dog_id))
    const cleanDogIds = dogIds.filter(id => !dupDogIdSet.has(id))
    const overrideDogIds = [...dupOverrideDogIds.value]
    const finalDogIds = [...cleanDogIds, ...overrideDogIds]

    // 批量创建用药任务（一次调用）
    const freqMap: Record<string, number> = { once_daily: 1, twice_daily: 2, three_daily: 3 }
    await batchStartMedication({
      dog_ids: finalDogIds,
      override_dog_ids: overrideDogIds.length > 0 ? overrideDogIds : undefined,
      drug_name: drug,
      dosage: dosage.value,
      dosage_unit: dosageUnit.value,
      method: methodLabels[method.value] || method.value,
      frequency: freqMap[frequency.value] || 1,
      duration_days: parsedDuration.value,
      actual_start_date: date.value,
      notes: notes.value || null,
      cost: costInput.value ? parseFloat(costInput.value) : null,
      protocol_id: null,
      illnessRecordId: selectedDogs.value.length === 1 ? (illnessRecordId.value || null) : null,
    })
    const created = finalDogIds.length
    const skipped = Math.max(0, dogIds.length - finalDogIds.length)
    submitState.value = 'success'
    queueSubmitFeedback({
      message: buildTaskFeedbackMessage(created, skipped),
      createdDate: date.value,
      createdCount: created,
      skippedCount: skipped,
      refreshHome: true,
    })

    // 如果勾选了保存为方案，弹出命名弹窗
    if (saveAsProtocol.value) {
      protocolName.value = ''
      showNameModal.value = true
    } else {
      await wait(140)
      uni.navigateBack()
    }
  } catch {
    submitState.value = 'idle'
  } finally {
    if (submitState.value !== 'success') submitState.value = 'idle'
  }
}

// ==================== 用药方案选择器 ====================


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
  if (protocol.duration_days) durationDays.value = String(protocol.duration_days)
  if (protocol.dosage_unit) dosageUnit.value = protocol.dosage_unit
  if (protocol.method) method.value = protocol.method
  if (protocol.frequency) frequency.value = protocol.frequency
  if (protocol.notes) notes.value = protocol.notes
  showProtocolPicker.value = false
}

function goToNewProtocol() {
  showProtocolPicker.value = false
  uni.navigateTo({ url: '/pages/health/medication-protocols' })
}

// ==================== 保存为方案 ====================

const showNameModal = ref(false)
const protocolName = ref('')

// 同名用药确认弹窗
const showDupModal = ref(false)
const dupList = ref<any[]>([])
const dupOverrideDogIds = ref<string[]>([])
const dupResolve = ref<((v: boolean) => void) | null>(null)

const cleanDogs = computed(() => {
  const dupDogIdSet = new Set(dupList.value.map((d: any) => d.dog_id))
  return selectedDogs.value.filter((d: any) => !dupDogIdSet.has(d._id))
})
const dupFinalCount = computed(() => cleanDogs.value.length + dupOverrideDogIds.value.length)
const dupConfirmText = computed(() =>
  dupFinalCount.value === 0 ? '跳过（不创建）' : `确认创建（${dupFinalCount.value}只）`
)

function toggleOverride(dogId: string) {
  const idx = dupOverrideDogIds.value.indexOf(dogId)
  if (idx === -1) dupOverrideDogIds.value.push(dogId)
  else dupOverrideDogIds.value.splice(idx, 1)
}

function toggleAllOverride() {
  if (dupOverrideDogIds.value.length === dupList.value.length) {
    dupOverrideDogIds.value = []
  } else {
    dupOverrideDogIds.value = dupList.value.map((d: any) => d.dog_id)
  }
}

const { run: saveProtocol } = useCloudCall('health-service', 'addMedicationProtocol', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

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
  // 刷新 store，方案库页面和选择器都会同步更新
  protocolStore.reload()
  await wait(140)
  uni.navigateBack()
}

// 从疾病页面跳转过来时预选犬只，并读取关联的疾病记录 ID
onLoad((query) => {
  if (query?.batchDogs) {
    try {
      const dogs = JSON.parse(decodeURIComponent(query.batchDogs))
      selectedDogs.value = dogs
    } catch { /* ignore */ }
  }
  if (query?.illnessRecordId) {
    illnessRecordId.value = query.illnessRecordId
  }
})
</script>

<style lang="scss" scoped>

/* ---- 剂量行 ---- */
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

/* ---- 天数后缀 ---- */
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

/* ---- Header 右侧胶囊按钮 ---- */
.header-add {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--primary);
  padding: 6px 14px 6px 10px;
  border-radius: 20px;
  background: var(--primary-soft);
  transition: all 0.12s ease;
  &:active { transform: scale(0.92); background: var(--icon-rose); }

  &__text {
    font-size: 13px;
    font-weight: 700;
  }
}

/* ---- 保存为方案复选框 ---- */
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
  background: var(--primary);
  border-color: var(--primary);
}
.save-check__label {
  font-size: 14px;
  color: var(--text-2);
}

/* ==================== 用药方案选择器 ==================== */
.protocol-picker {
  padding-bottom: 20px;
}
.protocol-picker__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 30px 0;
}
.protocol-picker__empty-text {
  font-size: 13px;
  color: var(--text-3);
}
.protocol-picker__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-group-gap);
}
.protocol-picker__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg);
  border-radius: var(--radius-row);
  transition: all 0.12s ease;
  &:active { transform: scale(0.98); opacity: 0.85; }
}
.protocol-picker__item-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-icon);
  background: var(--icon-plum);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.protocol-picker__item-body {
  flex: 1;
  min-width: 0;
}
.protocol-picker__item-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  display: block;
}
.protocol-picker__item-detail {
  font-size: 12px;
  color: var(--text-3);
  display: block;
  margin-top: 2px;
}
.protocol-picker__footer {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}
.protocol-picker__new-link {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border-radius: var(--radius-btn);
  background: var(--primary-soft);
  transition: all 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
}
.protocol-picker__new-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
}

/* ==================== 保存为方案 Modal ==================== */
.save-protocol {
  margin-top: 4px;
}
.save-protocol__desc {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
  display: block;
  text-align: center;
  margin-bottom: 16px;
}
.save-protocol__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.save-protocol__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
}
.save-protocol__input {
  height: 44px;
  border-radius: 14px;
  border: 1px solid var(--text-4);
  background: var(--bg);
  padding: 0 14px;
  font-size: 14px;
  color: var(--text-1);
  font-family: var(--font-body);
}

/* 骨架屏 */
@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}
.protocol-picker__skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0 20px;
}
.skeleton-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--bg);
  border-radius: var(--radius-row);
}
.skeleton-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-icon);
  background: linear-gradient(90deg, var(--card-dim) 25%, rgba(255,255,255,0.4) 50%, var(--card-dim) 75%);
  background-size: 400px 100%;
  animation: shimmer 1.2s ease infinite;
  flex-shrink: 0;
}
.skeleton-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.skeleton-line {
  border-radius: 4px;
  background: linear-gradient(90deg, var(--card-dim) 25%, rgba(255,255,255,0.4) 50%, var(--card-dim) 75%);
  background-size: 400px 100%;
  animation: shimmer 1.2s ease infinite;
  &--title { width: 60%; height: 14px; }
  &--sub { width: 80%; height: 10px; }
}

/* ---- 同名用药确认弹窗 ---- */
.dup-dialog {
  display: flex; flex-direction: column; gap: 12px;
  margin-top: 4px;
}
.dup-section {
  display: flex; flex-direction: column; gap: 6px;
}
.dup-section__header {
  display: flex; align-items: center; justify-content: space-between;
}
.dup-section__title {
  font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
}
.dup-section__title--ok { color: var(--text-3); }
.dup-section__title--warn { color: var(--plum); }
.dup-section__select-all {
  font-size: 12px; font-weight: 600; color: var(--plum);
  padding: 2px 8px; border-radius: 6px;
  background: var(--plum-soft);
  &:active { opacity: 0.7; }
}
.dup-section__hint {
  font-size: 11px; color: var(--text-4);
  margin-top: -2px; margin-bottom: 2px;
}
.dup-divider {
  height: 1px; background: var(--card-dim);
}
.dup-row {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 10px;
  background: var(--card-dim);
}
.dup-row--selectable {
  cursor: pointer;
  &:active { opacity: 0.7; }
}
.dup-row__name {
  font-size: 14px; font-weight: 700; color: var(--text-1);
  min-width: 40px;
}
.dup-row__progress {
  font-size: 11px; font-weight: 700; color: var(--plum);
  padding: 2px 8px; border-radius: 4px;
  background: var(--plum-soft);
  margin-left: auto;
}
.dup-row__tag {
  font-size: 11px; font-weight: 700; color: var(--primary);
  padding: 2px 8px; border-radius: 4px;
  background: var(--primary-soft);
  margin-left: auto;
}
.dup-check-box {
  width: 20px; height: 20px; border-radius: 6px;
  border: 2px solid var(--text-4);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
}
.dup-check-box--checked {
  background: var(--plum); border-color: var(--plum);
}
</style>
