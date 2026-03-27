<template>
  <view class="health-form">
    <!-- 记录类型选择 -->
    <view class="health-form__section">
      <text class="health-form__section-title">记录类型</text>
      <view class="health-form__types">
        <view
          v-for="t in typeOptions"
          :key="t.value"
          class="health-form__type"
          :class="{ 'health-form__type--active': form.type === t.value }"
          @click="form.type = t.value"
        >
          <text>{{ t.label }}</text>
        </view>
      </view>
    </view>

    <!-- 公共字段 -->
    <view class="health-form__section">
      <text class="health-form__section-title">基本信息</text>

      <view class="health-form__field">
        <text class="health-form__label">日期</text>
        <picker mode="date" :value="dateStr" @change="onDateChange">
          <text class="health-form__picker" :class="{ 'health-form__picker--empty': !form.date }">
            {{ form.date ? dateStr : '请选择日期' }}
          </text>
        </picker>
      </view>

      <view class="health-form__field">
        <text class="health-form__label">费用(¥)</text>
        <input v-model="costInput" class="health-form__input" type="digit" placeholder="选填" />
      </view>

      <view class="health-form__field">
        <text class="health-form__label">备注</text>
        <input v-model="form.notes" class="health-form__input" placeholder="选填" />
      </view>
    </view>

    <!-- 疫苗详情 -->
    <view v-if="form.type === 'vaccination'" class="health-form__section">
      <text class="health-form__section-title">疫苗详情</text>

      <view class="health-form__field">
        <text class="health-form__label">疫苗类型</text>
        <input v-model="details.vaccine_type" class="health-form__input" placeholder="如：六联、狂犬" />
      </view>

      <view class="health-form__field">
        <text class="health-form__label">下次日期</text>
        <picker mode="date" :value="nextVaccineDateStr" @change="onNextVaccineDateChange">
          <text class="health-form__picker" :class="{ 'health-form__picker--empty': !details.next_reminder_date }">
            {{ details.next_reminder_date ? nextVaccineDateStr : '默认21天后' }}
          </text>
        </picker>
      </view>
    </view>

    <!-- 驱虫详情 -->
    <view v-if="form.type === 'deworming'" class="health-form__section">
      <text class="health-form__section-title">驱虫详情</text>

      <view class="health-form__field">
        <text class="health-form__label">驱虫类型</text>
        <view class="health-form__options">
          <view
            v-for="dt in dewormingTypes"
            :key="dt.value"
            class="health-form__option"
            :class="{ 'health-form__option--active': details.deworming_type === dt.value }"
            @click="details.deworming_type = dt.value"
          >
            <text>{{ dt.label }}</text>
          </view>
        </view>
      </view>

      <view class="health-form__field">
        <text class="health-form__label">药品名称</text>
        <input v-model="details.drug_name" class="health-form__input" placeholder="选填" />
      </view>
    </view>

    <!-- 疾病详情 -->
    <view v-if="form.type === 'illness'" class="health-form__section">
      <text class="health-form__section-title">疾病详情</text>

      <view class="health-form__field">
        <text class="health-form__label">病症</text>
        <input v-model="details.condition" class="health-form__input" placeholder="如：感冒、腹泻、皮肤病" />
      </view>

      <view class="health-form__field">
        <text class="health-form__label">治疗状态</text>
        <view class="health-form__options">
          <view
            v-for="s in treatmentStatuses"
            :key="s"
            class="health-form__option"
            :class="{ 'health-form__option--active': details.treatment_status === s }"
            @click="details.treatment_status = s"
          >
            <text>{{ s }}</text>
          </view>
        </view>
      </view>

      <view class="health-form__field">
        <text class="health-form__label">严重程度</text>
        <input v-model="details.severity" class="health-form__input" placeholder="选填" />
      </view>
    </view>

    <!-- 提交按钮 -->
    <view class="health-form__footer">
      <button
        class="health-form__submit"
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

let dogId = ''

const form = reactive({
  type: 'vaccination' as string,
  date: null as number | null,
  notes: '',
})

const costInput = ref('')
const details = reactive<Record<string, any>>({})
const submitting = ref(false)

const typeOptions = [
  { label: '疫苗', value: 'vaccination' },
  { label: '驱虫', value: 'deworming' },
  { label: '疾病', value: 'illness' },
]

const dewormingTypes = [
  { label: '内驱', value: 'internal' },
  { label: '外驱', value: 'external' },
  { label: '内外同驱', value: 'combo' },
]

const treatmentStatuses = ['治疗中', '已康复', '慢性管理']

// 切换类型时重置 details
watch(() => form.type, () => {
  Object.keys(details).forEach(k => delete details[k])
  if (form.type === 'deworming') {
    details.deworming_type = 'internal'
  }
  if (form.type === 'illness') {
    details.treatment_status = '治疗中'
  }
})

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

const { run: addRecord } = useCloudCall('health-service', 'addHealthRecord', {
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
  dogId = query?.dogId || ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  form.date = today.getTime()
})
</script>

<style scoped>
.health-form {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 140rpx;
}

.health-form__section {
  background: #fff;
  margin: 16rpx 32rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}

.health-form__section:first-child {
  margin-top: 16rpx;
}

.health-form__section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}

.health-form__types {
  display: flex;
  gap: 16rpx;
}

.health-form__type {
  flex: 1;
  text-align: center;
  padding: 16rpx;
  border-radius: 12rpx;
  background: #f5f5f5;
  font-size: 28rpx;
  color: #666;
}

.health-form__type--active {
  background: #007AFF;
  color: #fff;
}

.health-form__field {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.health-form__field:last-child {
  border-bottom: none;
}

.health-form__label {
  width: 160rpx;
  font-size: 28rpx;
  color: #333;
  flex-shrink: 0;
}

.health-form__input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.health-form__picker {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.health-form__picker--empty {
  color: #ccc;
}

.health-form__options {
  display: flex;
  gap: 12rpx;
  flex: 1;
  flex-wrap: wrap;
}

.health-form__option {
  padding: 10rpx 24rpx;
  border-radius: 20rpx;
  background: #f5f5f5;
  font-size: 26rpx;
  color: #666;
}

.health-form__option--active {
  background: #007AFF;
  color: #fff;
}

.health-form__footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 32rpx;
  background: #fff;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
}

.health-form__submit {
  width: 100%;
  height: 88rpx;
  border-radius: 44rpx;
  background: #007AFF;
  color: #fff;
  font-size: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.health-form__submit[disabled] {
  opacity: 0.5;
}
</style>
