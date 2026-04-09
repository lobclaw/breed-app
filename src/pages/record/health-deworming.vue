<template>
  <view class="page">
    <BPageHeader title="录入驱虫记录" />

    <view class="form-body">
      <!-- 选择犬只 -->
      <view class="field-group">
        <view class="field-label"><text>选择犬只</text></view>
        <BDogPicker v-model="selectedDogs" :multiple="true" title="选择犬只" />
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
        <view class="field-label">
          <text>驱虫药品</text>
          <text class="field-label__optional">（选填）</text>
        </view>
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

      <!-- 日期 + 待办 + 下次提醒（公共组件） -->
      <BFormOptions
        v-model:date="date"
        v-model:isTodo="isTodo"
        v-model:enableReminder="enableReminder"
        v-model:reminderDate="reminderDate"
        :reminderDays="computedReminderDays"
        :hideTodo="fromTask"
        dateLabel="日期"
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
        <textarea v-model="notes" class="form-textarea" placeholder="输入备注信息..." :auto-height="true" />
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

    <BModal
      v-model:visible="showDeleteConfirm"
      :title="`删除「${pendingDeleteVal}」？`"
      confirmText="删除"
      :danger="true"
      @confirm="handleDeleteConfirm"
    />

    <!-- 自定义药品输入弹窗 -->
    <BModal
      v-model:visible="showCustomModal"
      title="自定义药品"
      @confirm="onCustomConfirm"
    >
      <view class="custom-input-wrap">
        <input
          v-model="customInput"
          class="custom-input"
          placeholder="输入药品名称"
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
import BModal from '@/components/layout/BModal.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BFormOptions from '@/components/form/BFormOptions.vue'

const { currentFamily, loadFamily } = useAuth()

const selectedDogs = ref<any[]>([])
const date = ref<number | null>(null)
const notes = ref('')
const costInput = ref('')
const details = reactive<Record<string, any>>({ deworming_type: 'internal' })
const submitting = ref(false)
const isTodo = ref(false)
const enableReminder = ref(false)
const reminderDate = ref<number | null>(null)
const fromTask = ref(false)

// 根据选中犬只的 role 动态计算驱虫提醒间隔
const computedReminderDays = computed(() => {
  const settings = currentFamily.value?.settings
  const puppyDays = settings?.default_deworming_interval_puppy ?? 14
  const adultDays = settings?.default_deworming_interval_adult ?? 90
  if (selectedDogs.value.length === 0) return puppyDays
  const hasAdult = selectedDogs.value.some((d: any) => d.role === '种狗' || d.role === '外部种公')
  const hasPuppy = selectedDogs.value.some((d: any) => d.role === '幼崽' || !d.role)
  if (hasAdult && !hasPuppy) return adultDays
  if (hasPuppy && !hasAdult) return puppyDays
  return Math.min(puppyDays, adultDays)
})

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
const deletedCustomDrugs = ref<string[]>([])
// 根据当前选中的驱虫类型，合并预设 + 用户自定义药品（过滤乐观删除）
const dewormDrugs = computed(() => {
  const subtype = details.deworming_type || 'internal'
  const preset = PRESET_DEWORMING_DRUGS[subtype] || []
  const customSettings = currentFamily.value?.settings?.custom_deworming_drugs || {}
  const custom = (customSettings[subtype] || []).filter((v: string) => !deletedCustomDrugs.value.includes(v))
  const all = [...preset, ...custom]
  return [...new Set(all)]
})
const customDrug = ref('')
const showCustomModal = ref(false)
const customInput = ref('')
const showDeleteConfirm = ref(false)
const pendingDeleteVal = ref('')
let confirmDeleteFn: (() => Promise<void>) | null = null

function addCustomDrug() {
  customInput.value = ''
  showCustomModal.value = true
}

const { run: updateFamilySettings } = useCloudCall('family-service', 'updateSettings')

function isPresetDrug(drug: string): boolean {
  const subtype = details.deworming_type || 'internal'
  return (PRESET_DEWORMING_DRUGS[subtype] || []).includes(drug)
}

function deleteCustomDrug(val: string) {
  pendingDeleteVal.value = val
  confirmDeleteFn = async () => {
    uni.vibrateShort()
    deletedCustomDrugs.value.push(val)
    if (details.drug_name === val) details.drug_name = ''
    if (customDrug.value === val) customDrug.value = ''
    const subtype = details.deworming_type || 'internal'
    const customSettings = currentFamily.value?.settings?.custom_deworming_drugs || {}
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

async function handleDeleteConfirm() {
  if (confirmDeleteFn) { await confirmDeleteFn(); confirmDeleteFn = null }
}

async function onCustomConfirm() {
  const val = customInput.value.trim()
  if (!val) { showCustomModal.value = false; return }

  customDrug.value = val
  details.drug_name = val
  showCustomModal.value = false

  // 立即保存到 family settings
  const subtype = details.deworming_type || 'internal'
  const presetList = PRESET_DEWORMING_DRUGS[subtype] || []
  if (!presetList.includes(val)) {
    const customSettings = currentFamily.value?.settings?.custom_deworming_drugs || {}
    const existing = customSettings[subtype] || []
    if (!existing.includes(val)) {
      const updated = { ...customSettings, [subtype]: [...existing, val] }
      await updateFamilySettings({ custom_deworming_drugs: updated })
      await loadFamily()
    }
  }
}

const canSubmit = computed(() => {
  return selectedDogs.value.length > 0 && !!date.value && !!details.deworming_type
})

// 日期/提醒相关逻辑由 BFormOptions 组件处理

function buildDetails() {
  const d: Record<string, any> = {}
  d.deworming_type = details.deworming_type
  if (details.drug_name) d.drug_name = details.drug_name
  const rd = reminderDate.value || (date.value ? date.value + computedReminderDays.value * 86400000 : null)
  if (enableReminder.value && rd) d.next_reminder_date = rd
  return d
}

const { run: batchAddRecord } = useCloudCall('health-service', 'batchAddHealthRecords', {
  showLoading: true,
  loadingText: '保存中...',
})

const { run: batchAddTask } = useCloudCall('task-service', 'batchCreateManualTasks', {
  showLoading: true,
  loadingText: '创建待办中...',
})

const { run: fetchTask } = useCloudCall('task-service', 'getTask')


const dewormingTypeLabels: Record<string, string> = {
  internal: '内驱',
  external: '外驱',
  combo: '内外同驱',
}

async function submit() {
  submitting.value = true
  try {
    if (isTodo.value) {
      // 批量创建待办任务（一次云调用）
      const rd = enableReminder.value
        ? (reminderDate.value || (date.value ? date.value + computedReminderDays.value * 86400000 : null))
        : null
      const res = await batchAddTask({
        dogs: selectedDogs.value.map((d: any) => ({ dog_id: d._id, dog_name: d.name })),
        card_type: 'individual',
        type: 'deworming',
        title: '驱虫',
        due_date: date.value,
        next_reminder_date: rd,
        details: {
          deworming_type: details.deworming_type || null,
          drug_name: details.drug_name || null,
          cost: costInput.value ? parseFloat(costInput.value) : null,
          notes: notes.value || null,
        },
      })
      const created = res?.data?.created || 0
      if (created === 0) {
        uni.showToast({ title: '已有相同待办，未重复创建', icon: 'none' })
      }
    } else {
      // 批量录入健康记录（一次云调用）
      const res = await batchAddRecord({
        dog_ids: selectedDogs.value.map((d: any) => d._id),
        type: 'deworming',
        date: date.value,
        cost: costInput.value ? parseFloat(costInput.value) : null,
        notes: notes.value || null,
        details: buildDetails(),
        skip_reminder: !enableReminder.value,
      })

      const allCompletedTasks = res?.data?.completedTasks || []
      if (allCompletedTasks.length > 0) {
        const names = allCompletedTasks.map((t: any) => t.dog_name).join('、')
        uni.showToast({
          title: `自动完成 ${allCompletedTasks.length} 条待办（${names}）`,
          icon: 'none',
          duration: 2500,
        })
      }

      // 如果有自定义药品，刷新家庭设置以便下次显示
      if (customDrug.value) loadFamily()
    }
    setTimeout(() => uni.navigateBack(), 1000)
  } finally {
    submitting.value = false
  }
}

onLoad(async (query) => {
  if (query?.taskId || query?.batchDogs) {
    fromTask.value = true
  }
  if (query?.taskId) {
    const res = await fetchTask(query.taskId)
    if (res?.data?.details) {
      const d = res.data.details
      if (d.deworming_type) details.deworming_type = d.deworming_type
      if (d.drug_name) details.drug_name = d.drug_name
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
      if (d.deworming_type) details.deworming_type = d.deworming_type
      if (d.drug_name) details.drug_name = d.drug_name
      if (d.cost) costInput.value = String(d.cost)
      if (d.notes) notes.value = d.notes
    } catch { /* ignore */ }
  }
})
</script>

<style lang="scss" scoped>
</style>
