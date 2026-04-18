<template>
  <view class="page">
    <BPageHeader title="录入繁育记录" />

    <!-- 记录类型选择 (segmented pill row) -->
    <view class="form-body">
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

      <!-- ============ 发情记录 (R-2) ============ -->
      <template v-if="form.type === 'heat'">
        <!-- 选择种母 -->
        <view class="field-group">
          <view class="field-label"><text>选择种母</text></view>
          <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" />
        </view>

        <!-- 发情开始日期 -->
        <view class="field-group">
          <view class="field-label"><text>发情开始日期</text></view>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <input type="text" class="form-input" :value="dateStr" placeholder="请选择日期" disabled />
          </picker>
          <view class="date-chips">
            <text
              class="date-chip"
              :class="{ active: dateChipActive === 'today' }"
              @click="setDateChip('today')"
            >今天</text>
            <text
              class="date-chip"
              :class="{ active: dateChipActive === 'yesterday' }"
              @click="setDateChip('yesterday')"
            >昨天</text>
            <text
              class="date-chip"
              :class="{ active: dateChipActive === 'dayBefore' }"
              @click="setDateChip('dayBefore')"
            >前天</text>
          </view>
        </view>

        <!-- 备注 -->
        <view class="field-group">
          <view class="field-label">
            <text>备注</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <textarea
            v-model="form.notes"
            class="form-textarea"
            placeholder="记录观察到的症状、行为变化等"
          />
        </view>
      </template>

      <!-- ============ 卵泡检查 (R-3) ============ -->
      <template v-if="form.type === 'follicle_check'">
        <view class="field-group">
          <view class="field-label"><text>选择种母</text></view>
          <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" />
        </view>

        <view class="field-group">
          <view class="field-label"><text>检查日期</text></view>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <input type="text" class="form-input" :value="dateStr" placeholder="请选择日期" disabled />
          </picker>
          <view class="date-chips">
            <text class="date-chip" :class="{ active: dateChipActive === 'today' }" @click="setDateChip('today')">今天</text>
            <text class="date-chip" :class="{ active: dateChipActive === 'yesterday' }" @click="setDateChip('yesterday')">昨天</text>
            <text class="date-chip" :class="{ active: dateChipActive === 'dayBefore' }" @click="setDateChip('dayBefore')">前天</text>
          </view>
        </view>

        <!-- 左侧卵泡 -->
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

        <!-- 右侧卵泡 -->
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

        <!-- 检查结果 -->
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

        <!-- 费用 -->
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

        <!-- 备注 -->
        <view class="field-group">
          <view class="field-label">
            <text>备注</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <textarea v-model="form.notes" class="form-textarea" placeholder="补充检查说明" />
        </view>
      </template>

      <!-- ============ 配种记录 (R-4) ============ -->
      <template v-if="form.type === 'mating'">
        <view class="field-group">
          <view class="field-label"><text>选择种母</text></view>
          <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" />
        </view>

        <view class="field-group">
          <view class="field-label"><text>选择种公</text></view>
          <BDogPicker v-model="selectedSire" genderFilter="公" title="选择种公" />
        </view>

        <view class="field-group">
          <view class="field-label"><text>配种日期</text></view>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <input type="text" class="form-input" :value="dateStr" placeholder="请选择日期" disabled />
          </picker>
          <view class="date-chips">
            <text class="date-chip" :class="{ active: dateChipActive === 'today' }" @click="setDateChip('today')">今天</text>
            <text class="date-chip" :class="{ active: dateChipActive === 'yesterday' }" @click="setDateChip('yesterday')">昨天</text>
            <text class="date-chip" :class="{ active: dateChipActive === 'dayBefore' }" @click="setDateChip('dayBefore')">前天</text>
          </view>
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
          <view class="field-label"><text>第几次配种</text></view>
          <view class="display-field">
            <text>第 {{ details.mating_number || 1 }} 次（本周期）</text>
          </view>
        </view>

        <!-- 自动计算卡片 -->
        <view class="field-group">
          <view class="field-label"><text>系统自动计算</text></view>
          <view class="auto-card">
            <view class="auto-card__row">
              <text class="material-icons-round auto-card__icon">event_available</text>
              <text class="auto-card__label">预计孕检日</text>
              <text class="auto-card__value">{{ estimatedCheckDate }}</text>
            </view>
            <view class="auto-card__row">
              <text class="material-icons-round auto-card__icon">child_friendly</text>
              <text class="auto-card__label">预计预产期</text>
              <text class="auto-card__value">{{ estimatedDueDate }}</text>
            </view>
            <view class="auto-card__hint">
              <text class="material-icons-round" style="font-size:16px;color:var(--amber);">info_outline</text>
              <text>可手动修改预产期</text>
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

      <!-- ============ 孕检记录 (R-5) ============ -->
      <template v-if="form.type === 'pregnancy_check'">
        <view class="field-group">
          <view class="field-label"><text>选择种母</text></view>
          <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" />
        </view>

        <view class="field-group">
          <view class="field-label"><text>检查日期</text></view>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <input type="text" class="form-input" :value="dateStr" placeholder="请选择日期" disabled />
          </picker>
          <view class="date-chips">
            <text class="date-chip" :class="{ active: dateChipActive === 'today' }" @click="setDateChip('today')">今天</text>
            <text class="date-chip" :class="{ active: dateChipActive === 'yesterday' }" @click="setDateChip('yesterday')">昨天</text>
            <text class="date-chip" :class="{ active: dateChipActive === 'dayBefore' }" @click="setDateChip('dayBefore')">前天</text>
          </view>
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
            <text class="toggle-label">{{ details.confirmed === '是' ? '是' : '否' }}</text>
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

      <!-- ============ 产检 (R-6) ============ -->
      <template v-if="form.type === 'prenatal_check'">
        <view class="field-group">
          <view class="field-label"><text>选择种母</text></view>
          <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" />
        </view>

        <view class="field-group">
          <view class="field-label"><text>检查日期</text></view>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <input type="text" class="form-input" :value="dateStr" placeholder="请选择日期" disabled />
          </picker>
          <view class="date-chips">
            <text class="date-chip" :class="{ active: dateChipActive === 'today' }" @click="setDateChip('today')">今天</text>
            <text class="date-chip" :class="{ active: dateChipActive === 'yesterday' }" @click="setDateChip('yesterday')">昨天</text>
            <text class="date-chip" :class="{ active: dateChipActive === 'dayBefore' }" @click="setDateChip('dayBefore')">前天</text>
          </view>
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

      <!-- ============ 临产监测 (R-7) ============ -->
      <template v-if="form.type === 'pre_labor'">
        <view class="field-group">
          <view class="field-label"><text>选择种母</text></view>
          <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" />
        </view>

        <view class="field-group">
          <view class="field-label"><text>日期</text></view>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <input type="text" class="form-input" :value="dateStr" placeholder="请选择日期" disabled />
          </picker>
          <view class="date-chips">
            <text class="date-chip" :class="{ active: dateChipActive === 'today' }" @click="setDateChip('today')">今天</text>
            <text class="date-chip" :class="{ active: dateChipActive === 'yesterday' }" @click="setDateChip('yesterday')">昨天</text>
            <text class="date-chip" :class="{ active: dateChipActive === 'dayBefore' }" @click="setDateChip('dayBefore')">前天</text>
          </view>
        </view>

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

        <view class="field-group">
          <view class="field-label">
            <text>备注</text>
            <text class="field-label__optional">（选填）</text>
          </view>
          <textarea v-model="form.notes" class="form-textarea" placeholder="补充说明" />
        </view>
      </template>

      <!-- ============ 异常终止 (R-9) ============ -->
      <template v-if="form.type === 'abnormal_termination'">
        <view class="field-group">
          <view class="field-label"><text>选择犬只</text></view>
          <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" />
        </view>

        <view class="field-group">
          <view class="field-label"><text>日期</text></view>
          <picker mode="date" :value="dateStr" @change="onDateChange">
            <input type="text" class="form-input" :value="dateStr" placeholder="请选择日期" disabled />
          </picker>
          <view class="date-chips">
            <text class="date-chip" :class="{ active: dateChipActive === 'today' }" @click="setDateChip('today')">今天</text>
            <text class="date-chip" :class="{ active: dateChipActive === 'yesterday' }" @click="setDateChip('yesterday')">昨天</text>
            <text class="date-chip" :class="{ active: dateChipActive === 'dayBefore' }" @click="setDateChip('dayBefore')">前天</text>
          </view>
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

      <!-- 体温预警 -->
      <view v-if="showTempWarning" class="temp-warning">
        <text class="material-icons-round" style="font-size:18px;color:var(--amber);">warning</text>
        <text>体温低于 37.1°C，注意观察，可能 24 小时内生产</text>
      </view>

      <!-- 提交按钮 -->
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

  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { buildRecordFeedbackMessage, queueSubmitFeedback, wait } from '@/composables/useSubmitFeedback'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'

let cycleId = ''
const selectedDog = ref<any>(null)
const selectedSire = ref<any>(null)

const form = reactive({
  type: 'heat' as string,
  date: null as number | null,
  cost: null as number | null,
  notes: '',
})

const costInput = ref('')
const details = reactive<Record<string, any>>({})
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const dateChipActive = ref('today')

const typeOptions = [
  { label: '发情', value: 'heat' },
  { label: '卵泡', value: 'follicle_check' },
  { label: '配种', value: 'mating' },
  { label: '孕检', value: 'pregnancy_check' },
  { label: '产检', value: 'prenatal_check' },
  { label: '临产', value: 'pre_labor' },
  { label: '异常', value: 'abnormal_termination' },
]

const matingMethods = ['人工授精', '自然交配']
const follicleResults = ['发育中', '已成熟', '发育不良', '其他']
const terminationTypes = ['流产', '死胎', '医疗终止', '确认未怀孕']

// 切换类型时重置 details
watch(() => form.type, () => {
  Object.keys(details).forEach(k => delete details[k])
  if (form.type === 'mating') {
    details.method = '人工授精'
    details.mating_number = 1
  }
  if (form.type === 'pre_labor') {
    details.nesting_behavior = false
  }
})

const dateStr = computed(() => {
  if (!form.date) return ''
  const d = new Date(form.date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const showTempWarning = computed(() => {
  if (form.type !== 'pre_labor') return false
  const temp = parseFloat(details.temperature)
  return !isNaN(temp) && temp < 37.1 && temp > 0
})

const canSubmit = computed(() => {
  if (!form.type || !form.date) return false
  if (form.type === 'mating' && !selectedSire.value) return false
  if (form.type === 'follicle_check' && !details.left_count) return false
  return true
})

const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '提交中...'
  if (submitState.value === 'success') return '已保存'
  return '保存记录'
})

// 自动计算日期
const estimatedCheckDate = computed(() => {
  if (!form.date) return '--'
  const d = new Date(form.date + 21 * 86400000)
  return `${d.getMonth() + 1}月${d.getDate()}日`
})

const estimatedDueDate = computed(() => {
  if (!form.date) return '--'
  const d = new Date(form.date + 59 * 86400000)
  return `${d.getMonth() + 1}月${d.getDate()}日`
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
    d.sire_id = selectedSire.value?._id || ''
    d.sire_name = selectedSire.value?.name || ''
    d.method = details.method || '人工授精'
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

const { run: addRecord } = useCloudCall('breeding-service', 'addBreedingRecord', {
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
      cycle_id: cycleId || undefined,
      date: form.date,
      cost: cost && cost > 0 ? cost : null,
      notes: form.notes || null,
      details: buildDetails(),
    })

    if (res) {
      submitState.value = 'success'
      queueSubmitFeedback({
        message: buildRecordFeedbackMessage(1),
      })
      await wait(140)
      uni.navigateBack()
    }
  } catch {
    submitState.value = 'idle'
  } finally {
    if (submitState.value !== 'success') submitState.value = 'idle'
  }
}

onLoad((query) => {
  cycleId = query?.cycleId || ''

  // 如果 query 传入了有效的 type，设置表单类型
  const validTypes = typeOptions.map(t => t.value)
  if (query?.type && validTypes.includes(query.type)) {
    form.type = query.type
  }

  // 默认日期为今天
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  form.date = today.getTime()
})
</script>

<style lang="scss" scoped>

.page {
  padding-bottom: 40px;
}

/* ---- Segmented control ---- */
.segmented-control {
  display: flex;
  background: var(--card-dim);
  border-radius: var(--radius-btn);
  padding: 3px;
  gap: 2px;
}

.seg-option {
  flex: 1;
  text-align: center;
  padding: 10px 8px;
  border-radius: var(--radius-btn);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  transition: all 0.2s ease;
  white-space: nowrap;

  &.active {
    background: var(--primary);
    color: #fff;
    box-shadow: 0 2px 8px rgba(234, 62, 119, 0.25);
  }
}

/* ---- Toggle ---- */
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

/* ---- Display field ---- */
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
  border: 1px solid transparent;
}

/* ---- Auto-calculated card ---- */
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
    font-size: 13px;
    color: var(--text-2);
    flex: 1;
  }

  &__value {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding-top: 8px;

    text:not(.material-icons-round) {
      font-size: 12px;
      color: var(--text-3);
    }
  }
}

/* ---- Date quick chips ---- */
.date-chips {
  display: flex;
  gap: 6px;
  margin-top: 6px;
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

/* ---- Temperature warning ---- */
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

/* ---- Submit button (margin override) ---- */
.submit-btn {
  margin-top: 24px;
}
</style>
