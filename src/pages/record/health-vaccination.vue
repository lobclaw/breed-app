<template>
  <view class="page">
    <BPageHeader title="录入疫苗记录" />

    <view class="form-body">
      <!-- 选择犬只 -->
      <view class="field-group">
        <view class="field-label"><text>选择犬只</text></view>
        <BDogPicker v-model="selectedDogs" :multiple="true" title="选择犬只" />
      </view>

      <!-- 标记为待办 (由 BFormOptions 渲染) -->

      <!-- 疫苗类型 -->
      <view class="field-group">
        <view class="field-label"><text>疫苗类型</text></view>
        <view class="pill-select">
          <view
            v-for="vt in vaccineTypes"
            :key="vt"
            class="pill-select__item"
            :class="{ 'pill-select__item--active': details.vaccine_type === vt }"
            @click="details.vaccine_type = vt"
          >
            <text>{{ vt }}</text>
          </view>
          <!-- 自定义值（已输入时显示为选中 pill） -->
          <view
            v-if="customVaccine"
            class="pill-select__item"
            :class="{ 'pill-select__item--active': details.vaccine_type === customVaccine }"
            @click="details.vaccine_type = customVaccine"
          >
            <text>{{ customVaccine }}</text>
          </view>
          <!-- + 自定义按钮 -->
          <view class="pill-select__add" @click="addCustomVaccine">
            <text class="material-icons-round" style="font-size: 14px;">add</text>
            <text>自定义</text>
          </view>
        </view>
      </view>

      <!-- 日期 + 待办 + 下次提醒（公共组件） -->
      <BFormOptions
        v-model:date="date"
        v-model:isTodo="isTodo"
        v-model:enableReminder="enableReminder"
        v-model:reminderDate="reminderDate"
        :reminderDays="computedReminderDays"
        :hideTodo="fromTask"
        dateLabel="接种日期"
      />

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
        <textarea v-model="notes" class="form-textarea" :auto-height="true" placeholder="输入备注信息..." />
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

    <!-- 自定义输入弹窗 -->
    <BModal
      v-model:visible="showCustomModal"
      title="自定义疫苗"
      @confirm="onCustomConfirm"
    >
      <view class="custom-input-wrap">
        <input
          v-model="customInput"
          class="custom-input"
          placeholder="输入疫苗名称"
          :focus="showCustomModal"
        />
      </view>
    </BModal>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { useAuth } from '@/composables/useAuth'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BModal from '@/components/layout/BModal.vue'
import BFormOptions from '@/components/form/BFormOptions.vue'

const { currentFamily } = useAuth()

const selectedDogs = ref<any[]>([])
const date = ref<number | null>(null)
const notes = ref('')
const costInput = ref('')
const details = reactive<Record<string, any>>({})
const submitting = ref(false)
const isTodo = ref(false)
const enableReminder = ref(true)
const reminderDate = ref<number | null>(null)
const fromTask = ref(false)

// 根据选中犬只的 role 动态计算提醒间隔
const computedReminderDays = computed(() => {
  const settings = currentFamily.value?.settings
  const puppyDays = settings?.default_vaccine_interval_puppy ?? 21
  const adultDays = settings?.default_vaccine_interval_adult ?? 365
  if (selectedDogs.value.length === 0) return puppyDays
  const hasAdult = selectedDogs.value.some((d: any) => d.role === '种狗' || d.role === '外部种公')
  const hasPuppy = selectedDogs.value.some((d: any) => d.role === '幼崽' || !d.role)
  if (hasAdult && !hasPuppy) return adultDays
  if (hasPuppy && !hasAdult) return puppyDays
  // 混选：取较短间隔，用户可手动调整
  return Math.min(puppyDays, adultDays)
})

const vaccineTypes = ['卫佳5', '卫佳8', '卫佳10', '狂犬']
const customVaccine = ref('')
const showCustomModal = ref(false)
const customInput = ref('')

function addCustomVaccine() {
  customInput.value = ''
  showCustomModal.value = true
}

function onCustomConfirm() {
  if (customInput.value.trim()) {
    customVaccine.value = customInput.value.trim()
    details.vaccine_type = customVaccine.value
  }
  showCustomModal.value = false
}


const canSubmit = computed(() => {
  return selectedDogs.value.length > 0 && !!date.value && !!details.vaccine_type
})

// 日期/提醒相关逻辑由 BFormOptions 组件处理

function buildDetails() {
  const d: Record<string, any> = {}
  d.vaccine_type = details.vaccine_type
  const rd = reminderDate.value || (date.value ? date.value + computedReminderDays.value * 86400000 : null)
  if (enableReminder.value && rd) d.next_reminder_date = rd
  return d
}

const { run: addRecord } = useCloudCall('health-service', 'addHealthRecord', {
  showLoading: true,
  loadingText: '保存中...',
})

const { run: addTask } = useCloudCall('task-service', 'createManualTask', {
  showLoading: true,
  loadingText: '创建待办中...',
})

const { run: fetchTask } = useCloudCall('task-service', 'getTask')

async function submit() {
  submitting.value = true
  try {
    if (isTodo.value) {
      // 创建待办任务
      const rd = enableReminder.value
        ? (reminderDate.value || (date.value ? date.value + computedReminderDays.value * 86400000 : null))
        : null
      let created = 0
      for (const dog of selectedDogs.value) {
        const res = await addTask({
          card_type: 'individual',
          dog_id: dog._id,
          dog_name: dog.name,
          type: 'vaccination',
          title: '疫苗',
          due_date: date.value,
          status: 'pending',
          priority: 'upcoming',
          next_reminder_date: rd,
          details: {
            vaccine_type: details.vaccine_type || null,
            cost: costInput.value ? parseFloat(costInput.value) : null,
            notes: notes.value || null,
          },
        })
        if (res?.data && !res.data.skipped) created++
      }
      if (created > 0) {
        uni.showToast({ title: `已创建 ${created} 条待办`, icon: 'success' })
      } else {
        uni.showToast({ title: '已有相同待办，未重复创建', icon: 'none' })
      }
    } else {
      // 正常录入健康记录
      const cost = costInput.value ? parseFloat(costInput.value) : null
      const perDogCost = cost && selectedDogs.value.length > 1
        ? Math.round(cost / selectedDogs.value.length * 100) / 100
        : cost

      let allCompletedTasks: any[] = []
      for (const dog of selectedDogs.value) {
        const res = await addRecord({
          type: 'vaccination',
          dog_id: dog._id,
          date: date.value,
          cost: perDogCost && perDogCost > 0 ? perDogCost : null,
          notes: notes.value || null,
          details: buildDetails(),
          skip_reminder: !enableReminder.value,
        })
        if (res?.data?.completedTasks?.length) {
          allCompletedTasks.push(...res.data.completedTasks)
        }
      }

      // 提示
      if (allCompletedTasks.length > 0) {
        const names = allCompletedTasks.map((t: any) => t.dog_name).join('、')
        uni.showToast({
          title: `已保存，自动完成 ${allCompletedTasks.length} 条待办（${names}）`,
          icon: 'none',
          duration: 2500,
        })
      } else {
        uni.showToast({
          title: selectedDogs.value.length > 1
            ? `已保存 ${selectedDogs.value.length} 条记录`
            : '已保存',
          icon: 'success',
        })
      }
    }
    setTimeout(() => uni.navigateBack(), 1000)
  } finally {
    submitting.value = false
  }
}

onLoad(async (query) => {
  // 从待办/批量入口进入时隐藏"标记为待办"
  if (query?.taskId || query?.batchDogs) {
    fromTask.value = true
  }
  // 从待办预填
  if (query?.taskId) {
    const res = await fetchTask(query.taskId)
    if (res?.data?.details) {
      const d = res.data.details
      if (d.vaccine_type) details.vaccine_type = d.vaccine_type
      if (d.cost) costInput.value = String(d.cost)
      if (d.notes) notes.value = d.notes
    }
  }
  // 从批量卡片预选犬只（同步，零延迟）
  if (query?.batchDogs) {
    try {
      const dogs = JSON.parse(decodeURIComponent(query.batchDogs))
      selectedDogs.value = dogs
    } catch { /* ignore */ }
  }
  // 从批量卡片预填表单详情
  if (query?.details) {
    try {
      const d = JSON.parse(decodeURIComponent(query.details))
      if (d.vaccine_type) details.vaccine_type = d.vaccine_type
      if (d.cost) costInput.value = String(d.cost)
      if (d.notes) notes.value = d.notes
    } catch { /* ignore */ }
  }
})

// 日期初始化和待办模式切换由 BFormOptions 组件内部处理
</script>

<style lang="scss" scoped>
</style>
