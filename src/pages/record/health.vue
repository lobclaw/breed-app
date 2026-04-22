<template>
  <view class="page">
    <BPageHeader title="录入健康记录" />

    <view class="form-body">
      <!-- 记录类型选择 (segmented) -->
      <view class="field-group">
        <view class="field-label"><text>记录类型</text></view>
        <view class="segmented-control">
          <view
            v-for="t in typeOptions"
            :key="t.value"
            class="seg-option"
            :class="{ active: form.type === t.value }"
            @click="form.type = t.value"
          >
            <text>{{ t.label }}</text>
          </view>
        </view>
      </view>

      <!-- ============ 疫苗 (R-10) ============ -->
      <template v-if="form.type === 'vaccination'">
        <!-- 选择犬只 -->
        <view class="field-group">
          <view class="field-label"><text>选择犬只</text></view>
          <BDogPicker v-model="selectedDog" title="选择犬只" />
        </view>

        <!-- 疫苗类型 -->
        <view class="field-group">
          <view class="field-label"><text>疫苗类型</text></view>
          <view class="pill-options">
            <view
              v-for="vt in vaccineTypes"
              :key="vt"
              class="pill-option"
              :class="{ active: details.vaccine_type === vt }"
              @click="details.vaccine_type = vt"
            >
              <text>{{ vt }}</text>
            </view>
          </view>
          <input
            v-model="details.vaccine_type"
            class="form-input form-input--mt"
            placeholder="或输入自定义疫苗名称"
          />
        </view>

        <!-- 接种日期 -->
        <view class="field-group">
          <view class="field-label"><text>接种日期</text></view>
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

        <!-- 下次提醒日期 -->
        <view class="field-group">
          <view class="field-label"><text>下次提醒日期</text></view>
          <picker mode="date" :value="nextVaccineDateStr" @change="onNextVaccineDateChange">
            <view class="form-input form-input--picker">
              <text>{{ nextVaccineDateStr || '默认21天后' }}</text>
              <text class="material-icons-round form-input__suffix">calendar_today</text>
            </view>
          </picker>
          <text class="helper-text">自动计算：接种日期 + 21天，可手动修改</text>
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
          <textarea v-model="form.notes" class="form-textarea" placeholder="输入备注信息..." />
        </view>
      </template>

      <!-- ============ 驱虫 (R-11) ============ -->
      <template v-if="form.type === 'deworming'">
        <view class="field-group">
          <view class="field-label"><text>选择犬只</text></view>
          <BDogPicker v-model="selectedDog" title="选择犬只" />
        </view>

        <!-- 驱虫类型 -->
        <view class="field-group">
          <view class="field-label"><text>驱虫类型</text></view>
          <view class="pill-select">
            <view
              v-for="dt in dewormingTypes"
              :key="dt.value"
              class="pill-select__item"
              :class="{ 'pill-select__item--active': details.deworming_type === dt.value }"
              @click="details.deworming_type = dt.value"
            >
              <text>{{ dt.label }}</text>
            </view>
          </view>
        </view>

        <!-- 驱虫药品 -->
        <view class="field-group">
          <view class="field-label"><text>驱虫药品</text></view>
          <view class="pill-options">
            <view
              v-for="drug in dewormDrugs"
              :key="drug"
              class="pill-option"
              :class="{ active: details.drug_name === drug }"
              @click="details.drug_name = drug"
            >
              <text>{{ drug }}</text>
            </view>
          </view>
          <input
            v-model="details.drug_name"
            class="form-input form-input--mt"
            placeholder="或输入自定义药品名称"
          />
          <view class="protocol-link" @click="openProtocolPicker">
            <text class="material-icons-round" style="font-size: 14px; color: var(--primary);">medication</text>
            <text style="font-size: 12px; color: var(--primary); font-weight: 600;">从方案选择</text>
          </view>
        </view>

        <!-- 日期 -->
        <view class="field-group">
          <view class="field-label"><text>日期</text></view>
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

        <!-- 下次提醒日期 -->
        <view class="field-group">
          <view class="field-label"><text>下次提醒日期</text></view>
          <picker mode="date" :value="nextDewormDateStr" @change="onNextDewormDateChange">
            <view class="form-input form-input--picker">
              <text>{{ nextDewormDateStr || '默认90天后' }}</text>
              <text class="material-icons-round form-input__suffix">calendar_today</text>
            </view>
          </picker>
          <text class="helper-text">自动计算：日期 + 90天，可手动修改</text>
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
          <textarea v-model="form.notes" class="form-textarea" placeholder="输入备注信息..." />
        </view>
      </template>

      <!-- ============ 疾病 (R-12) ============ -->
      <template v-if="form.type === 'illness'">
        <view class="field-group">
          <view class="field-label"><text>选择犬只</text></view>
          <BDogPicker v-model="selectedDog" title="选择犬只" />
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
            >
              <text>{{ c }}</text>
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

        <!-- 发病日期 -->
        <view class="field-group">
          <view class="field-label"><text>发病日期</text></view>
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
          <textarea v-model="form.notes" class="form-textarea" placeholder="描述症状详情..." />
        </view>
      </template>

      <!-- 提交按钮 -->
      <view class="submit-area">
        <BSubmitButton
          :loading="submitState === 'submitting'"
          :success="submitState === 'success'"
          :disabled="!canSubmit || submitState === 'submitting'"
          @click="submit"
        >
          {{ submitButtonText }}
        </BSubmitButton>
      </view>
    </view>

    <!-- ==================== R-14: 用药方案选择器 Sheet ==================== -->
    <BSheet v-model:visible="showProtocolPicker" title="选择用药方案">
      <view class="protocol-picker">
        <view v-if="protocols.length === 0" class="protocol-picker__empty">
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
                {{ protocol.drug_name }} · {{ protocol.dosage }} · {{ protocol.duration }}天
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

    <!-- ==================== R-15: 保存为方案确认 Modal ==================== -->
    <BModal
      v-model:visible="showSaveProtocol"
      title="保存为用药方案"
      confirm-text="保存"
      @confirm="doSaveProtocol"
    >
      <view class="save-protocol">
        <text class="save-protocol__desc">将本次用药记录保存为方案，方便下次快速填写。</text>
        <view class="save-protocol__field">
          <text class="save-protocol__label">方案名称</text>
          <input
            v-model="protocolName"
            class="save-protocol__input"
            placeholder="如：驱虫常规方案"
          />
        </view>
      </view>
    </BModal>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { buildRecordFeedbackMessage, queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BModal from '@/components/layout/BModal.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'

const selectedDog = ref<any>(null)

const form = reactive({
  type: 'vaccination' as string,
  date: null as number | null,
  notes: '',
})

const costInput = ref('')
const details = reactive<Record<string, any>>({})
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const dateChipActive = ref('today')

const typeOptions = [
  { label: '疫苗', value: 'vaccination' },
  { label: '驱虫', value: 'deworming' },
  { label: '疾病', value: 'illness' },
]

const vaccineTypes = ['卫佳5', '卫佳8', '卫佳10', '狂犬']

const dewormingTypes = [
  { label: '内驱', value: 'internal' },
  { label: '外驱', value: 'external' },
  { label: '内外同驱', value: 'combo' },
]

const dewormDrugs = ['拜宠清', '海乐妙', '犬心保']

const conditionTypes = ['感冒', '腹泻', '寄生虫', '皮肤病', '眼部', '骨骼', '犬瘟', '细小', '其他']
const severityLevels = ['轻微', '中等', '严重']
const treatmentStatuses = ['治疗中', '已康复', '慢性管理']

// 切换类型时重置 details
watch(() => form.type, () => {
  Object.keys(details).forEach(k => delete details[k])
  if (form.type === 'deworming') {
    details.deworming_type = 'internal'
  }
  if (form.type === 'illness') {
    details.treatment_status = '治疗中'
    details.severity = '轻微'
  }
})

const dateStr = computed(() => {
  if (!form.date) return ''
  const d = new Date(form.date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const nextVaccineDateStr = computed(() => {
  const ts = details.next_reminder_date || (form.date ? form.date + 21 * 86400000 : null)
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const canSubmit = computed(() => {
  if (!form.type || !form.date) return false
  if (form.type === 'vaccination' && !details.vaccine_type) return false
  if (form.type === 'deworming' && !details.deworming_type) return false
  return true
})

const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '提交中...'
  if (submitState.value === 'success') return '已保存'
  return '保存记录'
})

function setDateChip(chip: string) {
  dateChipActive.value = chip
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  if (chip === 'yesterday') now.setDate(now.getDate() - 1)
  if (chip === 'dayBefore') now.setDate(now.getDate() - 2)
  form.date = now.getTime()
}

function onDateChange(e: any) {
  form.date = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
  dateChipActive.value = ''
}

function onNextVaccineDateChange(e: any) {
  details.next_reminder_date = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
}

const nextDewormDateStr = computed(() => {
  if (!details.next_reminder_date && !form.date) return ''
  const ts = details.next_reminder_date || (form.date ? form.date + 90 * 86400000 : null)
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

function onNextDewormDateChange(e: any) {
  details.next_reminder_date = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
}

function buildDetails() {
  const d: Record<string, any> = {}

  if (form.type === 'vaccination') {
    d.vaccine_type = details.vaccine_type
    if (details.next_reminder_date) d.next_reminder_date = details.next_reminder_date
  }

  if (form.type === 'deworming') {
    d.deworming_type = details.deworming_type
    if (details.drug_name) d.drug_name = details.drug_name
    d.next_reminder_date = details.next_reminder_date || (form.date ? form.date + 90 * 86400000 : undefined)
  }

  if (form.type === 'illness') {
    if (details.condition) d.condition = details.condition
    d.treatment_status = details.treatment_status || '治疗中'
    d.start_date = form.date
    if (details.severity) d.severity = details.severity
  }

  return d
}

const { run: addRecord } = useCloudCall('health-service', 'addHealthRecord', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

async function submit() {
  submitState.value = 'submitting'
  try {
    const cost = costInput.value ? parseFloat(costInput.value) : null
    const res = await addRecord({
      type: form.type,
      dog_id: selectedDog.value?._id || '',
      date: form.date,
      cost: cost && cost > 0 ? cost : null,
      notes: form.notes || null,
      details: buildDetails(),
    })

    if (res) {
      submitState.value = 'success'
      queueSubmitFeedback({
        message: buildRecordFeedbackMessage(1),
        homeSection: 'reminders',
      })
      // 如果是驱虫类型且有药品信息，提示保存为方案
      if (form.type === 'deworming' && details.drug_name) {
        offerSaveAsProtocol()
      } else {
        await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
        uni.navigateBack()
      }
    }
  } catch {
    submitState.value = 'idle'
  } finally {
    if (submitState.value !== 'success') submitState.value = 'idle'
  }
}

// ==================== R-14: 用药方案选择器 ====================

interface MedicationProtocol {
  _id: string
  name: string
  drug_name: string
  dosage: string
  duration: number
  notes?: string
}

const showProtocolPicker = ref(false)
const protocols = ref<MedicationProtocol[]>([])

const { run: fetchProtocols } = useCloudCall<{ data: MedicationProtocol[] }>('health-service', 'getMedicationProtocols')

async function openProtocolPicker() {
  const res = await fetchProtocols()
  if (res?.data) {
    protocols.value = res.data
  }
  showProtocolPicker.value = true
}

function applyProtocol(protocol: MedicationProtocol) {
  // 将方案数据填入表单
  details.drug_name = protocol.drug_name
  details.dosage = protocol.dosage
  details.duration = protocol.duration
  if (protocol.notes) {
    form.notes = protocol.notes
  }
  showProtocolPicker.value = false
}

function goToNewProtocol() {
  showProtocolPicker.value = false
  uni.navigateTo({ url: '/pages/health/medication-protocols' })
}

// ==================== R-15: 保存为用药方案 ====================

const showSaveProtocol = ref(false)
const protocolName = ref('')

const { run: saveProtocol } = useCloudCall('health-service', 'saveMedicationProtocol', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

function offerSaveAsProtocol() {
  protocolName.value = ''
  showSaveProtocol.value = true
}

async function doSaveProtocol() {
  if (!protocolName.value.trim()) {
    uni.showToast({ title: '请输入方案名称', icon: 'none' })
    return
  }
  await saveProtocol({
    name: protocolName.value.trim(),
    drug_name: details.drug_name || '',
    dosage: details.dosage || '',
    duration: details.duration || 0,
    notes: form.notes || null,
  })
  showSaveProtocol.value = false
  await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
  uni.navigateBack()
}

onLoad((query) => {

  // 支持 type 预选（从首页快捷入口进入）
  if (query?.type && ['vaccination', 'deworming', 'illness'].includes(query.type)) {
    form.type = query.type
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  form.date = today.getTime()
})
</script>

<style lang="scss" scoped>

.page {
  padding-bottom: 40px;
}

/* ---- Textarea (size override) ---- */
.form-textarea {
  padding: 14px 16px;
  min-height: 80px;
}

/* ---- Segmented control ---- */
.segmented-control {
  display: flex;
  gap: 0;
  border-radius: var(--radius-btn);
  background: var(--card-dim);
  padding: 3px;
  overflow: hidden;
}

.seg-option {
  flex: 1;
  text-align: center;
  padding: 10px 10px;
  border-radius: var(--radius-btn);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  transition: all 0.2s ease;
  white-space: nowrap;

  &.active {
    background: var(--primary);
    color: white;
    box-shadow: 0 2px 8px rgba(234, 62, 119, 0.2);
  }
}

/* ---- Date quick chips ---- */
.date-chips {
  display: flex;
  gap: 6px;
  margin-top: -2px;
}

.date-chip {
  padding: 4px 12px;
  border-radius: var(--radius-btn);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
  background: var(--card-dim);
  transition: all 0.12s ease;

  &:active {
    transform: scale(0.92);
  }

  &.active {
    background: var(--primary);
    color: #fff;
    box-shadow: 0 2px 8px rgba(234, 62, 119, 0.25);
  }
}

/* ---- Helper text (margin override) ---- */
.helper-text {
  margin-top: -4px;
}

/* ---- Submit area ---- */
.submit-area {
  padding: 8px 0 20px;
}

/* ==================== R-14: 用药方案选择器 ==================== */
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

/* ==================== R-15: 保存为方案 Modal ==================== */
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
</style>
