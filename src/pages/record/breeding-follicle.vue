<!--
  卵泡检查 (R-3)
  独立页面，从 breeding.vue 拆分
-->
<template>
  <view class="page">
    <BPageHeader title="录入卵泡检查" />

    <view class="form-body">
      <!-- 选择种母 -->
      <view class="field-group">
        <view class="field-label"><text>选择种母</text></view>
        <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" :readonly="dogLocked" />
      </view>

      <!-- 日期 + 待办 + 下次提醒（公共组件） -->
      <BFormOptions
        v-model:date="date"
        v-model:isTodo="isTodo"
        v-model:enableReminder="enableReminder"
        v-model:reminderDate="reminderDate"
        :reminderDays="14"
        dateLabel="检查日期"
      />

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
        <view class="pill-select">
          <view
            v-for="r in follicleResults"
            :key="r"
            class="pill-select__item"
            :class="{ 'pill-select__item--active': details.result === r }"
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
        <textarea v-model="form.notes" class="form-textarea" :auto-height="true" placeholder="补充检查说明" />
      </view>

    </view>

    <!-- 固定底部按钮 -->
    <view class="fixed-bottom">
      <button
        class="submit-btn"
        :loading="submitting"
        :disabled="!canSubmit || submitting"
        @click="submit"
      >
        {{ isTodo ? '创建待办' : '保存记录' }}
      </button>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BFormOptions from '@/components/form/BFormOptions.vue'

let cycleId = ''
const selectedDog = ref<any>(null)
const dogLocked = ref(false)

const form = reactive({
  notes: '',
})

const date = ref<number | null>(null)
const isTodo = ref(false)
const enableReminder = ref(true)
const reminderDate = ref<number | null>(null)
const costInput = ref('')
const details = reactive<Record<string, any>>({})
const submitting = ref(false)

const follicleResults = ['发育中', '已成熟', '发育不良', '其他']

const canSubmit = computed(() => {
  return !!date.value && !!details.left_count
})

const { run: addRecord } = useCloudCall('breeding-service', 'addBreedingRecord', {
  successMessage: '已保存',
  showLoading: true,
  loadingText: '保存中...',
})

const { run: addTask } = useCloudCall('task-service', 'createManualTask', {
  showLoading: true,
  loadingText: '创建待办中...',
})

const { run: fetchTask } = useCloudCall('task-service', 'getTask')
const { run: completeTask } = useCloudCall('task-service', 'completeTask')

let prefillTaskId = ''

async function submit() {
  submitting.value = true
  try {
    if (isTodo.value) {
      const rd = enableReminder.value
        ? (reminderDate.value || (date.value ? date.value + 14 * 86400000 : null))
        : null
      await addTask({
        card_type: 'individual',
        dog_id: selectedDog.value?._id || '',
        dog_name: selectedDog.value?.name || '',
        type: 'follicle_check',
        title: '卵泡检查',
        due_date: date.value,
        status: 'pending',
        priority: 'upcoming',
        next_reminder_date: rd,
        details: {
          cost: costInput.value ? parseFloat(costInput.value) : null,
          notes: form.notes || null,
        },
      })
      uni.showToast({ title: '已创建待办', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 1000)
    } else {
      const cost = costInput.value ? parseFloat(costInput.value) : null
      const res = await addRecord({
        type: 'follicle_check',
        dog_id: selectedDog.value?._id || '',
        cycle_id: cycleId || undefined,
        date: date.value,
        cost: cost && cost > 0 ? cost : null,
        notes: form.notes || null,
        details: {
          left_count: parseInt(details.left_count) || 0,
          left_size: parseFloat(details.left_size) || 0,
          right_count: parseInt(details.right_count) || 0,
          right_size: parseFloat(details.right_size) || 0,
          ...(details.result ? { result: details.result } : {}),
        },
        skip_reminder: !enableReminder.value,
      })
      if (res) {
        if (prefillTaskId) await completeTask(prefillTaskId)
        uni.navigateBack()
      }
    }
  } finally {
    submitting.value = false
  }
}

// 日期初始化和待办模式切换由 BFormOptions 组件内部处理

onLoad(async (query) => {
  cycleId = query?.cycleId || ''
  if (query?.dogId) {
    selectedDog.value = { _id: query.dogId, name: decodeURIComponent(query.dogName || ''), gender: '母', role: '种狗' }
    if (query.locked === 'true') dogLocked.value = true
  }
  if (query?.taskId) {
    prefillTaskId = query.taskId
    const res = await fetchTask(query.taskId)
    if (res?.data?.details) {
      const d = res.data.details
      if (d.cost) costInput.value = String(d.cost)
      if (d.notes) form.notes = d.notes
    }
  }
})
</script>

<style lang="scss" scoped>
</style>
