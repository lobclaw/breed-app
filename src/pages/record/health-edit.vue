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
          <textarea v-model="form.notes" class="form-textarea" placeholder="输入备注信息..." />
        </view>
      </template>

      <!-- ============ 驱虫 ============ -->
      <template v-if="form.type === 'deworming'">
        <view class="field-group">
          <view class="field-label"><text>驱虫类型</text></view>
          <view class="segmented-control">
            <view
              v-for="dt in dewormingTypes"
              :key="dt.value"
              class="seg-option"
              :class="{ active: details.deworming_type === dt.value }"
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
            >
              <text>{{ drug }}</text>
            </view>
          </view>
          <input
            v-model="details.drug_name"
            class="form-input form-input--mt"
            placeholder="或输入自定义药品名称"
          />
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
          <textarea v-model="form.notes" class="form-textarea" placeholder="输入备注信息..." />
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
            >
              <text>{{ c }}</text>
            </view>
          </view>
        </view>

        <view class="field-group">
          <view class="field-label"><text>严重程度</text></view>
          <view class="segmented-control">
            <view
              v-for="s in severityLevels"
              :key="s"
              class="seg-option"
              :class="{ active: details.severity === s }"
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
          <view class="segmented-control">
            <view
              v-for="s in treatmentStatuses"
              :key="s"
              class="seg-option"
              :class="{ active: details.treatment_status === s }"
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
          <textarea v-model="form.notes" class="form-textarea" placeholder="描述症状详情..." />
        </view>
      </template>

      <!-- 提交按钮 -->
      <view class="submit-area">
        <button
          class="submit-btn"
          :loading="submitting"
          :disabled="!canSubmit"
          @click="submit"
        >
          保存修改
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'

let recordId = ''

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
  successMessage: '已更新',
  showLoading: true,
})

async function loadRecord(id: string) {
  loading.value = true
  try {
    const res = await getRecord({ id })
    if (res) {
      const data = res as any
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
    const cost = costInput.value ? parseFloat(costInput.value) : null
    const res = await updateRecord({
      id: recordId,
      date: form.date,
      cost: cost && cost > 0 ? cost : null,
      notes: form.notes || null,
      details: buildDetails(),
    })
    if (res) {
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
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.loading-text {
  font-size: 14px;
  color: var(--text-3);
}

.form-body {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: 20px;
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

/* ---- Field Group ---- */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  display: flex;
  align-items: baseline;
  gap: 4px;

  &__optional {
    font-size: 12px;
    font-weight: 400;
    color: var(--text-3);
  }
}

/* ---- Text inputs ---- */
.form-input {
  height: 48px;
  border-radius: 14px;
  border: 1px solid var(--text-4);
  background: var(--card);
  padding: 0 16px;
  font-size: 14px;
  color: var(--text-1);
  font-family: var(--font-body);
  outline: none;
  display: flex;
  align-items: center;
  transition: border-color 0.2s;

  &::placeholder {
    color: var(--text-3);
  }

  &--picker {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__suffix {
    font-size: 18px;
    color: var(--text-3);
  }

  &--prefixed {
    padding-left: 34px;
  }

  &--mt {
    margin-top: 8px;
  }
}

/* ---- Textarea ---- */
.form-textarea {
  border-radius: 14px;
  border: 1px solid var(--text-4);
  background: var(--card);
  padding: 14px 16px;
  font-size: 14px;
  color: var(--text-1);
  font-family: var(--font-body);
  outline: none;
  resize: none;
  min-height: 80px;
  line-height: 1.5;

  &::placeholder {
    color: var(--text-3);
  }
}

/* ---- Prefix wrapper ---- */
.input-prefix-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-prefix {
  position: absolute;
  left: 16px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-3);
  pointer-events: none;
  z-index: 1;
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

/* ---- Pill options ---- */
.pill-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill-option {
  padding: 8px 16px;
  border-radius: var(--radius-btn);
  background: var(--card-dim);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  transition: all 0.2s ease;

  &.active {
    background: var(--primary);
    color: white;
  }
}

/* ---- Helper text ---- */
.helper-text {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
  margin-top: -4px;
}

/* ---- Submit area ---- */
.submit-area {
  padding: 8px 0 20px;
}

.submit-btn {
  height: 50px;
  border-radius: var(--radius-btn);
  border: none;
  font-size: 15px;
  font-weight: 700;
  color: white;
  background: var(--primary);
  box-shadow: 0 4px 16px rgba(234, 62, 119, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  transition: all 0.12s ease;
  width: 100%;

  &:active {
    transform: scale(0.94);
    opacity: 0.85;
  }

  &[disabled] {
    opacity: 0.4;
  }
}
</style>
