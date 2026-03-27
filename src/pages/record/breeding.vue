<template>
  <view class="breed-form">
    <!-- 记录类型选择 -->
    <view class="breed-form__section">
      <text class="breed-form__section-title">记录类型</text>
      <view class="breed-form__types">
        <view
          v-for="t in typeOptions"
          :key="t.value"
          class="breed-form__type"
          :class="{ 'breed-form__type--active': form.type === t.value }"
          @click="form.type = t.value"
        >
          <text>{{ t.label }}</text>
        </view>
      </view>
    </view>

    <!-- 公共字段 -->
    <view class="breed-form__section">
      <text class="breed-form__section-title">基本信息</text>

      <view class="breed-form__field">
        <text class="breed-form__label">日期</text>
        <picker mode="date" :value="dateStr" @change="onDateChange">
          <text class="breed-form__picker" :class="{ 'breed-form__picker--empty': !form.date }">
            {{ form.date ? dateStr : '请选择日期' }}
          </text>
        </picker>
      </view>

      <view class="breed-form__field">
        <text class="breed-form__label">费用(¥)</text>
        <input
          v-model="costInput"
          class="breed-form__input"
          type="digit"
          placeholder="选填"
        />
      </view>

      <view class="breed-form__field">
        <text class="breed-form__label">备注</text>
        <input
          v-model="form.notes"
          class="breed-form__input"
          placeholder="选填"
        />
      </view>
    </view>

    <!-- 发情详情 -->
    <view v-if="form.type === 'heat'" class="breed-form__section">
      <text class="breed-form__section-title">发情详情</text>

      <view class="breed-form__field">
        <text class="breed-form__label">开始日期</text>
        <picker mode="date" :value="heatStartStr" @change="onHeatStartChange">
          <text class="breed-form__picker" :class="{ 'breed-form__picker--empty': !details.start_date }">
            {{ details.start_date ? heatStartStr : '同上方日期' }}
          </text>
        </picker>
      </view>
    </view>

    <!-- 卵泡检查详情 -->
    <view v-if="form.type === 'follicle_check'" class="breed-form__section">
      <text class="breed-form__section-title">卵泡检查</text>

      <view class="breed-form__row">
        <view class="breed-form__half">
          <text class="breed-form__sub-label">左侧数量</text>
          <input v-model="details.left_count" class="breed-form__input" type="number" placeholder="0" />
        </view>
        <view class="breed-form__half">
          <text class="breed-form__sub-label">左侧大小(mm)</text>
          <input v-model="details.left_size" class="breed-form__input" type="digit" placeholder="0" />
        </view>
      </view>

      <view class="breed-form__row">
        <view class="breed-form__half">
          <text class="breed-form__sub-label">右侧数量</text>
          <input v-model="details.right_count" class="breed-form__input" type="number" placeholder="0" />
        </view>
        <view class="breed-form__half">
          <text class="breed-form__sub-label">右侧大小(mm)</text>
          <input v-model="details.right_size" class="breed-form__input" type="digit" placeholder="0" />
        </view>
      </view>

      <view class="breed-form__field">
        <text class="breed-form__label">结果</text>
        <picker :range="follicleResults" :value="follicleResultIndex" @change="onFollicleResultChange">
          <text class="breed-form__picker">{{ details.result || '请选择' }}</text>
        </picker>
      </view>
    </view>

    <!-- 配种详情 -->
    <view v-if="form.type === 'mating'" class="breed-form__section">
      <text class="breed-form__section-title">配种详情</text>

      <view class="breed-form__field">
        <text class="breed-form__label">种公</text>
        <picker :range="sireNames" :value="sireIndex" @change="onSireChange">
          <text class="breed-form__picker" :class="{ 'breed-form__picker--empty': !details.sire_name }">
            {{ details.sire_name || '请选择种公' }}
          </text>
        </picker>
      </view>

      <view class="breed-form__field">
        <text class="breed-form__label">方式</text>
        <view class="breed-form__inline-options">
          <view
            v-for="m in matingMethods"
            :key="m"
            class="breed-form__option"
            :class="{ 'breed-form__option--active': details.method === m }"
            @click="details.method = m"
          >
            <text>{{ m }}</text>
          </view>
        </view>
      </view>

      <view class="breed-form__field">
        <text class="breed-form__label">第几次</text>
        <input v-model="details.mating_number" class="breed-form__input" type="number" placeholder="1" />
      </view>
    </view>

    <!-- 孕检详情 -->
    <view v-if="form.type === 'pregnancy_check'" class="breed-form__section">
      <text class="breed-form__section-title">孕检详情</text>

      <view class="breed-form__field">
        <text class="breed-form__label">是否怀孕</text>
        <view class="breed-form__inline-options">
          <view
            v-for="c in ['是', '否']"
            :key="c"
            class="breed-form__option"
            :class="{ 'breed-form__option--active': details.confirmed === c }"
            @click="details.confirmed = c"
          >
            <text>{{ c }}</text>
          </view>
        </view>
      </view>

      <view class="breed-form__field">
        <text class="breed-form__label">胎数</text>
        <input v-model="details.puppy_count" class="breed-form__input" type="number" placeholder="选填" />
      </view>
    </view>

    <!-- 产检详情 -->
    <view v-if="form.type === 'prenatal_check'" class="breed-form__section">
      <text class="breed-form__section-title">产检详情</text>

      <view class="breed-form__field">
        <text class="breed-form__label">检查结果</text>
        <input v-model="details.results" class="breed-form__input" placeholder="填写检查结果" />
      </view>
    </view>

    <!-- 临产监测详情 -->
    <view v-if="form.type === 'pre_labor'" class="breed-form__section">
      <text class="breed-form__section-title">临产监测</text>

      <view class="breed-form__field">
        <text class="breed-form__label">体温(°C)</text>
        <input v-model="details.temperature" class="breed-form__input" type="digit" placeholder="选填" />
      </view>

      <view class="breed-form__field">
        <text class="breed-form__label">刨窝行为</text>
        <switch :checked="details.nesting_behavior" @change="details.nesting_behavior = $event.detail.value" />
      </view>

      <view class="breed-form__field">
        <text class="breed-form__label">食欲变化</text>
        <input v-model="details.appetite_change" class="breed-form__input" placeholder="选填" />
      </view>

      <view class="breed-form__field">
        <text class="breed-form__label">其他征兆</text>
        <input v-model="details.other_signs" class="breed-form__input" placeholder="选填" />
      </view>
    </view>

    <!-- 异常终止详情 -->
    <view v-if="form.type === 'abnormal_termination'" class="breed-form__section">
      <text class="breed-form__section-title">异常终止</text>

      <view class="breed-form__field">
        <text class="breed-form__label">类型</text>
        <picker :range="terminationTypes" :value="terminationIndex" @change="onTerminationChange">
          <text class="breed-form__picker">{{ details.termination_type || '请选择' }}</text>
        </picker>
      </view>
    </view>

    <!-- 体温预警 -->
    <view v-if="showTempWarning" class="breed-form__warning">
      <text>体温低于 37.1°C，注意观察，可能 24 小时内生产</text>
    </view>

    <!-- 提交按钮 -->
    <view class="breed-form__footer">
      <button
        class="breed-form__submit"
        :loading="submitting"
        :disabled="!canSubmit"
        @click="submit"
      >
        保存记录
      </button>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'

let cycleId = ''
let dogId = ''

// 种公列表（配种时选择）
const sires = ref<{ _id: string; name: string }[]>([])
const sireNames = computed(() => sires.value.map(s => s.name))

const form = reactive({
  type: 'heat' as string,
  date: null as number | null,
  cost: null as number | null,
  notes: '',
})

const costInput = ref('')
const details = reactive<Record<string, any>>({})
const submitting = ref(false)

const typeOptions = [
  { label: '发情', value: 'heat' },
  { label: '卵泡检查', value: 'follicle_check' },
  { label: '配种', value: 'mating' },
  { label: '孕检', value: 'pregnancy_check' },
  { label: '产检', value: 'prenatal_check' },
  { label: '临产监测', value: 'pre_labor' },
  { label: '异常终止', value: 'abnormal_termination' },
]

const matingMethods = ['自然交配', '人工授精']
const follicleResults = ['发育良好', '发育不良', '其他']
const terminationTypes = ['流产', '死胎', '医疗终止', '确认未怀孕']

const follicleResultIndex = computed(() => {
  return Math.max(0, follicleResults.indexOf(details.result || ''))
})

const terminationIndex = computed(() => {
  return Math.max(0, terminationTypes.indexOf(details.termination_type || ''))
})

// 切换类型时重置 details
watch(() => form.type, () => {
  Object.keys(details).forEach(k => delete details[k])
  if (form.type === 'mating') {
    details.method = '自然交配'
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

const heatStartStr = computed(() => {
  if (!details.start_date) return ''
  const d = new Date(details.start_date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const showTempWarning = computed(() => {
  if (form.type !== 'pre_labor') return false
  const temp = parseFloat(details.temperature)
  return !isNaN(temp) && temp < 37.1 && temp > 0
})

const canSubmit = computed(() => {
  if (!form.type || !form.date) return false
  if (form.type === 'mating' && !details.sire_id) return false
  if (form.type === 'follicle_check' && !details.left_count) return false
  return true
})

function onDateChange(e: any) {
  form.date = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
}

function onHeatStartChange(e: any) {
  details.start_date = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
}

function onFollicleResultChange(e: any) {
  details.result = follicleResults[e.detail.value]
}

function onTerminationChange(e: any) {
  details.termination_type = terminationTypes[e.detail.value]
}

const sireIndex = computed(() => {
  if (!details.sire_id) return 0
  return Math.max(0, sires.value.findIndex(s => s._id === details.sire_id))
})

function onSireChange(e: any) {
  const idx = e.detail.value
  const sire = sires.value[idx]
  if (sire) {
    details.sire_id = sire._id
    details.sire_name = sire.name
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
    d.sire_id = details.sire_id
    d.sire_name = details.sire_name
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

const { run: addRecord } = useCloudCall('breeding-service', 'addBreedingRecord', {
  successMessage: '已保存',
  showLoading: true,
  loadingText: '保存中...',
})

async function submit() {
  submitting.value = true
  try {
    const cost = costInput.value ? parseFloat(costInput.value) : null
    const res = await addRecord({
      type: form.type,
      dog_id: dogId,
      cycle_id: cycleId || undefined,
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

const { run: loadSires } = useCloudCall<{ data: any[] }>('dog-service', 'getDogListWithStatus')

async function fetchSires() {
  const res = await loadSires({ gender: '公' })
  if (res?.data) {
    sires.value = res.data.map((d: any) => ({ _id: d._id, name: d.name }))
  }
}

onLoad((query) => {
  cycleId = query?.cycleId || ''
  dogId = query?.dogId || ''

  // 默认日期为今天
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  form.date = today.getTime()

  // 预加载种公列表
  fetchSires()
})
</script>

<style lang="scss" scoped>
.breed-form {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 70px;
}

.breed-form__section {
  background: var(--card);
  margin: 8px 16px;
  border-radius: var(--radius-card);
  padding: 12px;
  box-shadow: var(--shadow);
}

.breed-form__section:first-child {
  margin-top: 8px;
}

.breed-form__section-title {
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--text-1);
  margin-bottom: 10px;
  display: block;
}

.breed-form__types {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.breed-form__type {
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  background: var(--bg);
  font-size: 13px;
  color: var(--text-2);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.breed-form__type--active {
  background: var(--primary);
  color: var(--card);
}

.breed-form__field {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--bg);
}

.breed-form__field:last-child {
  border-bottom: none;
}

.breed-form__label {
  width: 80px;
  font-size: 14px;
  color: var(--text-1);
  flex-shrink: 0;
}

.breed-form__input {
  flex: 1;
  font-size: 14px;
  color: var(--text-1);
}

.breed-form__picker {
  flex: 1;
  font-size: 14px;
  color: var(--text-1);
}

.breed-form__picker--empty {
  color: var(--text-4);
}

.breed-form__row {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.breed-form__half {
  flex: 1;
}

.breed-form__sub-label {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 4px;
  display: block;
}

.breed-form__inline-options {
  display: flex;
  gap: 6px;
  flex: 1;
}

.breed-form__option {
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  background: var(--bg);
  font-size: 13px;
  color: var(--text-2);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.breed-form__option--active {
  background: var(--primary);
  color: var(--card);
}

.breed-form__warning {
  margin: 0 16px;
  padding: 10px 12px;
  background: var(--amber-soft);
  border-radius: var(--radius-row);
  font-size: 13px;
  color: var(--amber);
}

.breed-form__footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px 16px;
  background: var(--card);
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  box-shadow: var(--shadow);
}

.breed-form__submit {
  width: 100%;
  height: 44px;
  border-radius: var(--radius-btn);
  background: var(--primary);
  color: var(--card);
  font-size: 16px;
  font-family: var(--font-display);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.breed-form__submit[disabled] {
  opacity: 0.5;
}
</style>
