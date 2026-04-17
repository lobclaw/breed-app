<template>
  <view class="page">
    <BPageHeader title="编辑健康记录" />

    <view v-if="loading" class="loading-state">
      <text class="loading-text">加载中...</text>
    </view>

    <view v-else class="form-body">
      <!-- 记录类型（只读展示） -->
      <view class="field-group">
        <view class="field-label"><text>记录类型</text></view>
        <view class="type-display">
          <text>{{ typeLabel }}</text>
        </view>
      </view>

      <!-- ============ 疫苗 ============ -->
      <template v-if="form.type === 'vaccination'">
        <view class="field-group">
          <view class="field-label"><text>疫苗类型</text></view>
          <view class="pill-options">
            <view
              v-for="vt in vaccineTypes"
              :key="vt"
              class="pill-option"
              :class="{ active: details.vaccine_type === vt }"
              @click="details.vaccine_type = vt"
              @longpress="PRESET_VACCINE_TYPES.includes(vt) ? undefined : deleteCustomVaccine(vt)"
            >
              <text>{{ vt }}</text>
            </view>
            <view
              v-if="customVaccine && !vaccineTypes.includes(customVaccine)"
              class="pill-option"
              :class="{ active: details.vaccine_type === customVaccine }"
              @click="details.vaccine_type = customVaccine"
            >
              <text>{{ customVaccine }}</text>
            </view>
            <view class="pill-add" @click="addCustomVaccine">
              <text class="material-icons-round" style="font-size: 14px;">add</text>
              <text>自定义</text>
            </view>
          </view>
        </view>

        <view class="field-group">
          <view class="field-label"><text>接种日期</text></view>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <view class="form-input form-input--picker">
              <text>{{ dateStr || '请选择日期' }}</text>
              <text class="material-icons-round form-input__suffix">calendar_today</text>
            </view>
          </picker>
        </view>

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
          <textarea v-model="form.notes" class="form-textarea" :auto-height="true" placeholder="输入备注信息..." />
        </view>
      </template>

      <!-- ============ 驱虫 ============ -->
      <template v-if="form.type === 'deworming'">
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

        <view class="field-group">
          <view class="field-label"><text>驱虫药品</text></view>
          <view class="pill-options">
            <view
              v-for="drug in dewormDrugs"
              :key="drug"
              class="pill-option"
              :class="{ active: details.drug_name === drug }"
              @click="details.drug_name = drug"
              @longpress="isPresetDrug(drug) ? undefined : deleteCustomDrug(drug)"
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
            <view class="pill-add" @click="addCustomDrug">
              <text class="material-icons-round" style="font-size: 14px;">add</text>
              <text>自定义</text>
            </view>
          </view>
        </view>

        <view class="field-group">
          <view class="field-label"><text>日期</text></view>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <view class="form-input form-input--picker">
              <text>{{ dateStr || '请选择日期' }}</text>
              <text class="material-icons-round form-input__suffix">calendar_today</text>
            </view>
          </picker>
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
            <text>备注</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <textarea v-model="form.notes" class="form-textarea" :auto-height="true" placeholder="输入备注信息..." />
        </view>
      </template>

      <!-- ============ 疾病 ============ -->
      <template v-if="form.type === 'illness'">
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

        <view class="field-group">
          <view class="field-label"><text>发病日期</text></view>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <view class="form-input form-input--picker">
              <text>{{ dateStr || '请选择日期' }}</text>
              <text class="material-icons-round form-input__suffix">calendar_today</text>
            </view>
          </picker>
        </view>

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
          <textarea v-model="form.notes" class="form-textarea" :auto-height="true" placeholder="描述症状详情..." />
        </view>
      </template>

    </view>

    <!-- 固定底部按钮 -->
    <view class="fixed-bottom">
      <button
        class="submit-btn"
        :loading="submitting"
        :disabled="!canSubmit || submitting"
        @click="submit"
      >
        保存修改
      </button>
    </view>

    <BModal
      v-model:visible="showDeleteConfirm"
      :title="`删除「${pendingDeleteVal}」？`"
      confirmText="删除"
      :danger="true"
      @confirm="handleDeleteConfirm"
    />

    <!-- 自定义疫苗输入弹窗 -->
    <BModal
      v-model:visible="showVaccineModal"
      title="自定义疫苗"
      @confirm="onVaccineConfirm"
    >
      <view class="custom-input-wrap">
        <input
          v-model="vaccineInput"
          class="custom-input"
          placeholder="输入疫苗名称"
          :focus="showVaccineModal"
        />
      </view>
    </BModal>
    <!-- 自定义药品输入弹窗 -->
    <BModal
      v-model:visible="showDrugModal"
      title="自定义药品"
      @confirm="onDrugConfirm"
    >
      <view class="custom-input-wrap">
        <input
          v-model="drugInput"
          class="custom-input"
          placeholder="输入药品名称"
          :focus="showDrugModal"
        />
      </view>
    </BModal>
    <!-- 自定义病症输入弹窗 -->
    <BModal
      v-model:visible="showConditionModal"
      title="自定义病症"
      @confirm="onConditionConfirm"
    >
      <view class="custom-input-wrap">
        <input
          v-model="conditionInput"
          class="custom-input"
          placeholder="输入病症名称"
          :focus="showConditionModal"
        />
      </view>
    </BModal>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { queueSubmitFeedback, wait } from '@/composables/useSubmitFeedback'
import { useAuth } from '@/composables/useAuth'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BModal from '@/components/layout/BModal.vue'

const { currentFamily, loadFamily } = useAuth()

let recordId = ''
const currentRecord = ref<any>(null)

const loading = ref(true)
const submitting = ref(false)
const costInput = ref('')

const form = reactive({
  type: '' as string,
  date: null as number | null,
  notes: '',
})

const details = reactive<Record<string, any>>({})

const typeLabels: Record<string, string> = {
  'vaccination': '疫苗',
  'deworming': '驱虫',
  'illness': '疾病',
}

const typeLabel = computed(() => typeLabels[form.type] || form.type)

const { run: updateFamilySettings } = useCloudCall('family-service', 'updateSettings')

const PRESET_VACCINE_TYPES = ['卫佳5', '卫佳8', '卫佳10', '狂犬']
const deletedCustomVaccines = ref<string[]>([])
const vaccineTypes = computed(() => {
  const custom = (currentFamily.value?.settings?.custom_vaccine_types || [])
    .filter((v: string) => !deletedCustomVaccines.value.includes(v))
  const all = [...PRESET_VACCINE_TYPES, ...custom]
  return [...new Set(all)]
})
const showDeleteConfirm = ref(false)
const pendingDeleteVal = ref('')
let confirmDeleteFn: (() => Promise<void>) | null = null

async function handleDeleteConfirm() {
  if (confirmDeleteFn) { await confirmDeleteFn(); confirmDeleteFn = null }
}

const customVaccine = ref('')
const showVaccineModal = ref(false)
const vaccineInput = ref('')

function addCustomVaccine() {
  vaccineInput.value = ''
  showVaccineModal.value = true
}

function deleteCustomVaccine(val: string) {
  pendingDeleteVal.value = val
  confirmDeleteFn = async () => {
    uni.vibrateShort()
    deletedCustomVaccines.value.push(val)
    if (details.vaccine_type === val) details.vaccine_type = ''
    if (customVaccine.value === val) customVaccine.value = ''
    const existing = currentFamily.value?.settings?.custom_vaccine_types || []
    const updated = existing.filter((v: string) => v !== val)
    try {
      await updateFamilySettings({ custom_vaccine_types: updated })
      await loadFamily()
      deletedCustomVaccines.value = deletedCustomVaccines.value.filter(v => v !== val)
    } catch {
      deletedCustomVaccines.value = deletedCustomVaccines.value.filter(v => v !== val)
      uni.showToast({ title: '删除失败', icon: 'none' })
    }
  }
  showDeleteConfirm.value = true
}

async function onVaccineConfirm() {
  const val = vaccineInput.value.trim()
  if (!val) { showVaccineModal.value = false; return }
  customVaccine.value = val
  details.vaccine_type = val
  showVaccineModal.value = false
  if (!PRESET_VACCINE_TYPES.includes(val)) {
    const existing = currentFamily.value?.settings?.custom_vaccine_types || []
    if (!existing.includes(val)) {
      await updateFamilySettings({ custom_vaccine_types: [...existing, val] })
      await loadFamily()
    }
  }
}

const dewormingTypes = [
  { label: '内驱', value: 'internal' },
  { label: '外驱', value: 'external' },
  { label: '内外同驱', value: 'combo' },
]

const PRESET_DEWORMING_DRUGS: Record<string, string[]> = {
  internal: ['拜宠清', '海乐妙', '犬心保'],
  external: ['福来恩', '大宠爱'],
  combo: ['超可信', '博来恩'],
}
type DewormDrugMap = Record<'internal' | 'external' | 'combo', string[]>
const deletedCustomDrugs = ref<string[]>([])
const dewormDrugs = computed(() => {
  const subtype = (details.deworming_type || 'internal') as keyof DewormDrugMap
  const preset = PRESET_DEWORMING_DRUGS[subtype] || []
  const customSettings = (currentFamily.value?.settings?.custom_deworming_drugs || { internal: [], external: [], combo: [] }) as DewormDrugMap
  const custom = (customSettings[subtype] || []).filter((v: string) => !deletedCustomDrugs.value.includes(v))
  const all = [...preset, ...custom]
  return [...new Set(all)]
})
const customDrug = ref('')
const showDrugModal = ref(false)
const drugInput = ref('')

function isPresetDrug(drug: string): boolean {
  const subtype = (details.deworming_type || 'internal') as keyof DewormDrugMap
  return (PRESET_DEWORMING_DRUGS[subtype] || []).includes(drug)
}

function deleteCustomDrug(val: string) {
  pendingDeleteVal.value = val
  confirmDeleteFn = async () => {
    uni.vibrateShort()
    deletedCustomDrugs.value.push(val)
    if (details.drug_name === val) details.drug_name = ''
    if (customDrug.value === val) customDrug.value = ''
    const subtype = (details.deworming_type || 'internal') as keyof DewormDrugMap
    const customSettings = (currentFamily.value?.settings?.custom_deworming_drugs || { internal: [], external: [], combo: [] }) as DewormDrugMap
    const updated = { ...customSettings, [subtype]: (customSettings[subtype] || []).filter((v: string) => v !== val) }
    try {
      await updateFamilySettings({ custom_deworming_drugs: updated })
      await loadFamily()
      deletedCustomDrugs.value = deletedCustomDrugs.value.filter(v => v !== val)
    } catch {
      deletedCustomDrugs.value = deletedCustomDrugs.value.filter(v => v !== val)
      uni.showToast({ title: '删除失败', icon: 'none' })
    }
  }
  showDeleteConfirm.value = true
}

function addCustomDrug() {
  drugInput.value = ''
  showDrugModal.value = true
}

async function onDrugConfirm() {
  const val = drugInput.value.trim()
  if (!val) { showDrugModal.value = false; return }
  customDrug.value = val
  details.drug_name = val
  showDrugModal.value = false
  const subtype = (details.deworming_type || 'internal') as keyof DewormDrugMap
  if (!(PRESET_DEWORMING_DRUGS[subtype] || []).includes(val)) {
    const customSettings = (currentFamily.value?.settings?.custom_deworming_drugs || { internal: [], external: [], combo: [] }) as DewormDrugMap
    const existing = customSettings[subtype] || []
    if (!existing.includes(val)) {
      await updateFamilySettings({ custom_deworming_drugs: { ...customSettings, [subtype]: [...existing, val] } })
      await loadFamily()
    }
  }
}

const PRESET_CONDITION_TYPES = ['感冒', '腹泻', '寄生虫', '皮肤病', '眼部', '骨骼', '犬瘟', '细小', '其他']
const deletedCustomConditions = ref<string[]>([])
const conditionTypes = computed(() => {
  const custom = (currentFamily.value?.settings?.custom_condition_types || [])
    .filter((v: string) => !deletedCustomConditions.value.includes(v))
  const all = [...PRESET_CONDITION_TYPES, ...custom]
  return [...new Set(all)]
})
const customCondition = ref('')
const showConditionModal = ref(false)
const conditionInput = ref('')

function addCustomCondition() {
  conditionInput.value = ''
  showConditionModal.value = true
}

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

async function onConditionConfirm() {
  const val = conditionInput.value.trim()
  if (!val) { showConditionModal.value = false; return }
  customCondition.value = val
  details.condition = val
  showConditionModal.value = false
  if (!PRESET_CONDITION_TYPES.includes(val)) {
    const existing = currentFamily.value?.settings?.custom_condition_types || []
    if (!existing.includes(val)) {
      await updateFamilySettings({ custom_condition_types: [...existing, val] })
      await loadFamily()
    }
  }
}

const severityLevels = ['轻微', '中等', '严重']
const treatmentStatuses = ['治疗中', '已康复', '慢性管理']

const dateStr = computed(() => {
  if (!form.date) return ''
  const d = new Date(form.date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const nextVaccineDateStr = computed(() => {
  if (!details.next_reminder_date) return ''
  const d = new Date(details.next_reminder_date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const canSubmit = computed(() => {
  if (!form.type || !form.date) return false
  if (form.type === 'vaccination' && !details.vaccine_type) return false
  if (form.type === 'deworming' && !details.deworming_type) return false
  return true
})

function onDateChange(e: any) {
  form.date = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
}

function onNextVaccineDateChange(e: any) {
  details.next_reminder_date = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
}

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

async function loadRecord(id: string) {
  loading.value = true
  try {
    const res = await getRecord({ id })
    if (res) {
      const data = res as any
      currentRecord.value = data
      form.type = data.type || ''
      form.date = data.date || null
      form.notes = data.notes || ''
      costInput.value = data.cost ? String(data.cost) : ''

      if (data.details) {
        Object.keys(data.details).forEach((k) => {
          details[k] = data.details[k]
        })
      }
    }
  } finally {
    loading.value = false
  }
}

async function handleDuplicateIllnessIfNeeded(): Promise<boolean> {
  if (form.type !== 'illness') return false

  const condition = String(details.condition || '').trim()
  const treatmentStatus = details.treatment_status || '治疗中'
  const dogId = currentRecord.value?.dog_id
  if (!condition || !dogId || treatmentStatus === '已康复') return false

  const res = await checkDuplicateIllness({
    dog_ids: [dogId],
    condition,
    exclude_record_id: recordId,
  })
  const duplicate = res?.data?.duplicates?.[0]
  if (!duplicate?.recordId) return false

  await new Promise<void>((resolve) => {
    uni.showModal({
      title: '已有进行中的疾病',
      content: `${currentRecord.value?.dog_name || '该犬'} 已有未康复的「${condition}」记录，去编辑原记录吗？`,
      confirmText: '去编辑',
      cancelText: '知道了',
      success: (modalRes) => {
        if (modalRes.confirm) {
          uni.redirectTo({ url: `/pages/record/health-edit?id=${duplicate.recordId}` })
        }
        resolve()
      },
      fail: () => resolve(),
    })
  })

  return true
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
  }

  if (form.type === 'illness') {
    if (details.condition) d.condition = details.condition
    d.treatment_status = details.treatment_status || '治疗中'
    d.start_date = form.date
    if (details.severity) d.severity = details.severity
  }

  return d
}

async function submit() {
  submitting.value = true
  try {
    if (await handleDuplicateIllnessIfNeeded()) return

    const cost = costInput.value ? parseFloat(costInput.value) : null
    const res = await updateRecord({
      id: recordId,
      date: form.date,
      cost: cost && cost > 0 ? cost : null,
      notes: form.notes || null,
      details: buildDetails(),
    })
    if (res) {
      queueSubmitFeedback({ message: '已更新健康记录' })
      await wait(140)
      uni.navigateBack()
    }
  } finally {
    submitting.value = false
  }
}

onLoad((query) => {
  recordId = query?.id || ''
  if (recordId) {
    loadRecord(recordId)
  } else {
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

/* ---- Type Display ---- */
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

/* ---- Helper text (margin override) ---- */
.helper-text {
  margin-top: -4px;
}
</style>
