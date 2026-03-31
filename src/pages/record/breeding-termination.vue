<!--
  异常终止 (R-9)
  独立页面，从 breeding.vue 拆分
-->
<template>
  <view class="page">
    <BPageHeader title="录入异常终止" />

    <view class="form-body">
      <!-- 选择犬只 -->
      <view class="field-group">
        <view class="field-label"><text>选择犬只</text></view>
        <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" :readonly="dogLocked" />
      </view>

      <!-- 日期 + 待办 + 下次提醒（公共组件） -->
      <BFormOptions
        v-model:date="date"
        v-model:isTodo="isTodo"
        v-model:enableReminder="enableReminder"
        v-model:reminderDate="reminderDate"
        :reminderDays="0"
        dateLabel="日期"
      />

      <!-- 类型 -->
      <view class="field-group">
        <view class="field-label"><text>类型</text></view>
        <view class="pill-select">
          <view
            v-for="tt in terminationTypes"
            :key="tt"
            class="pill-select__item"
            :class="{ 'pill-select__item--active': details.termination_type === tt }"
            @click="details.termination_type = tt"
          >
            <text>{{ tt }}</text>
          </view>
        </view>
      </view>

      <!-- 备注 -->
      <view class="field-group">
        <view class="field-label">
          <text>备注</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <textarea v-model="form.notes" class="form-textarea" :auto-height="true" placeholder="补充说明" />
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
const enableReminder = ref(false) // 异常终止默认不提醒
const reminderDate = ref<number | null>(null)
const details = reactive<Record<string, any>>({})
const submitting = ref(false)

const terminationTypes = ['流产', '死胎', '医疗终止', '确认未怀孕']

const canSubmit = computed(() => {
  return !!date.value && !!selectedDog.value
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
      await addTask({
        card_type: 'individual',
        dog_id: selectedDog.value?._id || '',
        dog_name: selectedDog.value?.name || '',
        type: 'abnormal_termination',
        title: '异常终止',
        due_date: date.value,
        status: 'pending',
        priority: 'upcoming',
        details: {
          notes: form.notes || null,
        },
      })
      uni.showToast({ title: '已创建待办', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 1000)
    } else {
      const d: Record<string, any> = {}
      if (details.termination_type) d.termination_type = details.termination_type

      const res = await addRecord({
        type: 'abnormal_termination',
        dog_id: selectedDog.value?._id || '',
        cycle_id: cycleId || undefined,
        date: date.value,
        cost: null,
        notes: form.notes || null,
        details: d,
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
      if (d.notes) form.notes = d.notes
    }
  }
})
</script>

<style lang="scss" scoped>
</style>
