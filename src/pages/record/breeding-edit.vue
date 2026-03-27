<template>
  <view class="page">
    <BPageHeader title="编辑繁育记录" />

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

      <!-- ============ 发情记录 ============ -->
      <template v-if="form.type === 'heat'">
        <view class="field-group">
          <view class="field-label"><text>发情开始日期</text></view>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <view class="form-input form-input--picker">
              <text>{{ dateStr || '请选择日期' }}</text>
              <text class="material-icons-round form-input__suffix">calendar_today</text>
            </view>
          </picker>
        </view>

        <view class="field-group">
          <view class="field-label">
            <text>备注</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <textarea v-model="form.notes" class="form-textarea" placeholder="记录观察到的症状、行为变化等" />
        </view>
      </template>

      <!-- ============ 卵泡检查 ============ -->
      <template v-if="form.type === 'follicle_check'">
        <view class="field-group">
          <view class="field-label"><text>检查日期</text></view>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <view class="form-input form-input--picker">
              <text>{{ dateStr || '请选择日期' }}</text>
              <text class="material-icons-round form-input__suffix">calendar_today</text>
            </view>
          </picker>
        </view>

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
          <view class="segmented-control">
            <view
              v-for="r in follicleResults"
              :key="r"
              class="seg-option"
              :class="{ active: details.result === r }"
              @click="details.result = r"
            >
              <text>{{ r }}</text>
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
            <input v-model="costInput" class="form-input form-input--prefixed" type="digit" placeholder="0.00" />
          </view>
        </view>

        <view class="field-group">
          <view class="field-label">
            <text>备注</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <textarea v-model="form.notes" class="form-textarea" placeholder="补充检查说明" />
        </view>
      </template>

      <!-- ============ 配种记录 ============ -->
      <template v-if="form.type === 'mating'">
        <view class="field-group">
          <view class="field-label"><text>配种日期</text></view>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <view class="form-input form-input--picker">
              <text>{{ dateStr || '请选择日期' }}</text>
              <text class="material-icons-round form-input__suffix">calendar_today</text>
            </view>
          </picker>
        </view>

        <view class="field-group">
          <view class="field-label"><text>配种方式</text></view>
          <view class="segmented-control">
            <view
              v-for="m in matingMethods"
              :key="m"
              class="seg-option"
              :class="{ active: details.method === m }"
              @click="details.method = m"
            >
              <text>{{ m }}</text>
            </view>
          </view>
        </view>

        <view class="field-group">
          <view class="field-label">
            <text>借配费用</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <view class="input-prefix-wrapper">
            <text class="input-prefix">¥</text>
            <input v-model="costInput" class="form-input form-input--prefixed" type="digit" placeholder="0.00" />
          </view>
        </view>

        <view class="field-group">
          <view class="field-label">
            <text>备注</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <textarea v-model="form.notes" class="form-textarea" placeholder="配种情况、注意事项等" />
        </view>
      </template>

      <!-- ============ 孕检 ============ -->
      <template v-if="form.type === 'pregnancy_check'">
        <view class="field-group">
          <view class="field-label"><text>检查日期</text></view>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <view class="form-input form-input--picker">
              <text>{{ dateStr || '请选择日期' }}</text>
              <text class="material-icons-round form-input__suffix">calendar_today</text>
            </view>
          </picker>
        </view>

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
            <text class="toggle-label-text">{{ details.confirmed === '是' ? '是' : '否' }}</text>
          </view>
        </view>

        <view v-if="details.confirmed === '是'" class="field-group">
          <view class="field-label"><text>幼崽数量</text></view>
          <input v-model="details.puppy_count" class="form-input" type="number" placeholder="B超估计数量" />
        </view>

        <view class="field-group">
          <view class="field-label">
            <text>费用</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <view class="input-prefix-wrapper">
            <text class="input-prefix">¥</text>
            <input v-model="costInput" class="form-input form-input--prefixed" type="digit" placeholder="0.00" />
          </view>
        </view>

        <view class="field-group">
          <view class="field-label">
            <text>备注</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <textarea v-model="form.notes" class="form-textarea" placeholder="检查结果详情、医生建议等" />
        </view>
      </template>

      <!-- ============ 产检 ============ -->
      <template v-if="form.type === 'prenatal_check'">
        <view class="field-group">
          <view class="field-label"><text>检查日期</text></view>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <view class="form-input form-input--picker">
              <text>{{ dateStr || '请选择日期' }}</text>
              <text class="material-icons-round form-input__suffix">calendar_today</text>
            </view>
          </picker>
        </view>

        <view class="field-group">
          <view class="field-label"><text>检查结果</text></view>
          <textarea v-model="details.results" class="form-textarea" placeholder="填写检查结果" />
        </view>

        <view class="field-group">
          <view class="field-label">
            <text>费用</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <view class="input-prefix-wrapper">
            <text class="input-prefix">¥</text>
            <input v-model="costInput" class="form-input form-input--prefixed" type="digit" placeholder="0.00" />
          </view>
        </view>

        <view class="field-group">
          <view class="field-label">
            <text>备注</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <textarea v-model="form.notes" class="form-textarea" placeholder="补充说明" />
        </view>
      </template>

      <!-- ============ 临产监测 ============ -->
      <template v-if="form.type === 'pre_labor'">
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
          <view class="field-label"><text>体温 (&#176;C)</text></view>
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
            <text class="toggle-label-text">{{ details.nesting_behavior ? '有' : '无' }}</text>
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
            <text>备注</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <textarea v-model="form.notes" class="form-textarea" placeholder="补充说明" />
        </view>
      </template>

      <!-- ============ 异常终止 ============ -->
      <template v-if="form.type === 'abnormal_termination'">
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
          <view class="field-label"><text>类型</text></view>
          <view class="segmented-control">
            <view
              v-for="tt in terminationTypes"
              :key="tt"
              class="seg-option"
              :class="{ active: details.termination_type === tt }"
              @click="details.termination_type = tt"
            >
              <text>{{ tt }}</text>
            </view>
          </view>
        </view>

        <view class="field-group">
          <view class="field-label">
            <text>备注</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <textarea v-model="form.notes" class="form-textarea" placeholder="补充说明" />
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
  'heat': '发情',
  'follicle_check': '卵泡检查',
  'mating': '配种',
  'pregnancy_check': '孕检',
  'prenatal_check': '产检',
  'pre_labor': '临产监测',
  'abnormal_termination': '异常终止',
}

const typeLabel = computed(() => typeLabels[form.type] || form.type)

const matingMethods = ['自然交配', '人工授精']
const follicleResults = ['发育中', '已成熟', '发育不良', '其他']
const terminationTypes = ['流产', '死胎', '医疗终止', '确认未怀孕']

const dateStr = computed(() => {
  if (!form.date) return ''
  const d = new Date(form.date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const canSubmit = computed(() => {
  return !!form.type && !!form.date
})

function onDateChange(e: any) {
  form.date = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
}

const { run: getRecord } = useCloudCall('breeding-service', 'getBreedingRecordDetail', {
  showLoading: false,
})

const { run: updateRecord } = useCloudCall('breeding-service', 'updateBreedingRecord', {
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

      // 填充 details
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

  if (form.type === 'heat') {
    d.start_date = details.start_date || form.date
  }

  if (form.type === 'follicle_check') {
    d.left_count = parseInt(details.left_count) || 0
    d.left_size = parseFloat(details.left_size) || 0
    d.right_count = parseInt(details.right_count) || 0
    d.right_size = parseFloat(details.right_size) || 0
    if (details.result) d.result = details.result
  }

  if (form.type === 'mating') {
    if (details.sire_id) d.sire_id = details.sire_id
    if (details.sire_name) d.sire_name = details.sire_name
    d.method = details.method || '自然交配'
    d.mating_number = parseInt(details.mating_number) || 1
  }

  if (form.type === 'pregnancy_check') {
    if (details.confirmed) d.confirmed = details.confirmed
    if (details.puppy_count) d.puppy_count = parseInt(details.puppy_count)
  }

  if (form.type === 'prenatal_check') {
    if (details.results) d.results = details.results
  }

  if (form.type === 'pre_labor') {
    if (details.temperature) d.temperature = parseFloat(details.temperature)
    d.nesting_behavior = !!details.nesting_behavior
    if (details.appetite_change) d.appetite_change = details.appetite_change
    if (details.other_signs) d.other_signs = details.other_signs
  }

  if (form.type === 'abnormal_termination') {
    if (details.termination_type) d.termination_type = details.termination_type
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

/* ---- Inline Fields ---- */
.inline-fields {
  display: flex;
  gap: 10px;

  &__item {
    flex: 1;
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

/* ---- Toggle ---- */
.toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toggle-track {
  width: 48px;
  height: 28px;
  border-radius: 14px;
  background: var(--text-4);
  position: relative;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  padding: 2px;
}

.toggle-track.on {
  background: var(--primary);
}

.toggle-knob {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s;
}

.toggle-track.on .toggle-knob {
  transform: translateX(20px);
}

.toggle-label-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
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
