<!--
  批量处理页 (H-6)
  将同类型任务聚合，支持批量勾选完成
-->
<template>
  <view class="page">
    <BPageHeader title="批量处理" />

    <!-- 加载骨架屏 -->
    <BSkeleton v-if="loading" :rows="4" />

    <!-- 空状态 -->
    <BEmpty
      v-if="!loading && taskGroups.length === 0"
      icon="checklist"
      title="暂无可批量处理的任务"
      description="同类型的多犬任务会在这里聚合"
    />

    <!-- 任务分组列表 -->
    <view v-if="!loading && taskGroups.length > 0" class="batch-page__body">
      <view
        v-for="group in taskGroups"
        :key="group.type"
        class="batch-page__group"
      >
        <!-- 组标题 -->
        <view class="batch-page__group-header">
          <view class="batch-page__group-icon" :class="`batch-page__group-icon--${group.color}`">
            <text class="material-icons-round">{{ group.icon }}</text>
          </view>
          <view class="batch-page__group-info">
            <text class="batch-page__group-title">{{ group.title }}</text>
            <text class="batch-page__group-sub">{{ group.items.length }}只犬需处理</text>
          </view>
          <view class="batch-page__toggle" @click="toggleGroupAll(group)">
            <text class="batch-page__toggle-text">
              {{ isGroupAllSelected(group) ? '取消全选' : '全选' }}
            </text>
          </view>
        </view>

        <!-- 任务列表 -->
        <view class="batch-page__items">
          <view
            v-for="item in group.items"
            :key="item.id"
            class="batch-page__item"
            @click="toggleItem(item.id)"
          >
            <view class="batch-page__checkbox" :class="{ 'batch-page__checkbox--checked': selected.has(item.id) }">
              <text v-if="selected.has(item.id)" class="material-icons-round batch-page__check-icon">check</text>
            </view>
            <view class="batch-page__item-avatar">
              <BEntityIcon :size="18" color="#fff" />
            </view>
            <view class="batch-page__item-body">
              <text class="batch-page__item-name">{{ item.dogName }}</text>
              <text class="batch-page__item-detail">{{ item.detail }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 录入信息 -->
      <view class="form-body" v-if="taskGroups.length > 0">
        <!-- 疫苗类型（仅 vaccination） -->
        <view v-if="passedType === 'vaccination'" class="field-group">
          <view class="field-label"><text>疫苗类型</text></view>
          <view class="pill-select">
            <view v-for="vt in vaccineTypes" :key="vt" class="pill-select__item" :class="{'pill-select__item--active': formData.vaccine_type === vt}" @click="formData.vaccine_type = vt">
              <text>{{ vt }}</text>
            </view>
          </view>
        </view>

        <!-- 驱虫药品（仅 deworming） -->
        <view v-if="passedType === 'deworming'" class="field-group">
          <view class="field-label"><text>驱虫药品</text></view>
          <view class="pill-select">
            <view v-for="drug in dewormDrugs" :key="drug" class="pill-select__item" :class="{'pill-select__item--active': formData.drug_name === drug}" @click="formData.drug_name = drug">
              <text>{{ drug }}</text>
            </view>
          </view>
        </view>

        <!-- 驱虫类型（仅 deworming） -->
        <view v-if="passedType === 'deworming'" class="field-group">
          <view class="field-label"><text>驱虫类型</text></view>
          <view class="pill-select">
            <view v-for="dt in dewormingTypes" :key="dt.value" class="pill-select__item" :class="{'pill-select__item--active': formData.deworming_type === dt.value}" @click="formData.deworming_type = dt.value">
              <text>{{ dt.label }}</text>
            </view>
          </view>
        </view>

        <!-- 日期 -->
        <view class="field-group">
          <view class="field-label"><text>日期</text></view>
          <view class="form-input form-input--picker" @click="showDatePicker = true">
            <text>{{ dateStr }}</text>
            <text class="material-icons-round form-input__suffix">calendar_today</text>
          </view>
        </view>

        <!-- 费用（选填） -->
        <view class="field-group">
          <view class="field-label"><text>费用</text><text class="field-label__optional">（选填，自动均分）</text></view>
          <view class="input-prefix-wrapper">
            <text class="input-prefix">¥</text>
            <input v-model="costInput" class="form-input form-input--prefixed" type="digit" placeholder="总费用，自动按勾选数量均分" />
          </view>
          <text v-if="costInput && selected.size > 0" class="helper-text">
            每只均摊：¥{{ perDogCost }}
          </text>
        </view>
      </view>
    </view>

    <!-- 底部固定操作栏 -->
    <view v-if="!loading && taskGroups.length > 0" class="fixed-bottom">
      <BSubmitButton
        :inactive="!canBatchComplete"
        :inactive-tip="batchCompleteInactiveTip"
        @click="batchComplete"
      >
        确认完成 ({{ selected.size }}只)
      </BSubmitButton>
    </view>

    <BDateTimePicker
      v-model:visible="showDatePicker"
      :model-value="formDate"
      mode="date"
      value-type="timestamp"
      @confirm="onDateConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BDateTimePicker from '@/components/form/BDateTimePicker.vue'
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import { listLocalTasksByIds } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import { getHealthTypeTone } from '@/utils/themeSemantics'
import { buildTimestampFromDayOffset, formatDateInputValue } from '@/utils/date'

interface TaskItem {
  id: string
  dogId: string
  dogName: string
  detail: string
  taskType: string
}
usePageSync({ routePath: 'pages/home/batch-process' })

interface TaskGroup {
  type: string
  title: string
  icon: string
  color: string
  items: TaskItem[]
}

const loading = ref(true)
const taskGroups = ref<TaskGroup[]>([])
const selected = reactive(new Set<string>())
let passedTaskIds: string[] = []
let passedType = ''
const showDatePicker = ref(false)
const { currentFamily } = useAuth()

const formData = reactive({
  vaccine_type: '',
  drug_name: '',
  deworming_type: 'internal',
})
const costInput = ref('')
const formDate = ref(Date.now())

const vaccineTypes = ['卫佳5', '卫佳8', '卫佳10', '狂犬']
const dewormDrugs = ['拜宠清', '海乐妙', '犬心保']
const dewormingTypes = [
  { label: '内驱', value: 'internal' },
  { label: '外驱', value: 'external' },
  { label: '内外同驱', value: 'combo' },
]

const dateStr = computed(() => {
  return formatDateInputValue(formDate.value)
})

function onDateConfirm(value: number | string) {
  if (typeof value !== 'number') return
  formDate.value = value
}

const perDogCost = computed(() => {
  const total = parseFloat(costInput.value)
  if (!total || selected.size === 0) return '0'
  return (Math.round(total / selected.size * 100) / 100).toFixed(2)
})

const canBatchComplete = computed(() => {
  if (selected.size === 0) return false
  if (passedType === 'vaccination' && !formData.vaccine_type) return false
  return true
})

const batchCompleteInactiveTip = computed(() => {
  if (selected.size === 0) return '请选择要处理的犬只'
  if (passedType === 'vaccination' && !formData.vaccine_type) return '请选择疫苗类型'
  return '请补全必填信息'
})

function isGroupAllSelected(group: TaskGroup): boolean {
  return group.items.every(item => selected.has(item.id))
}

function toggleGroupAll(group: TaskGroup) {
  const allSelected = isGroupAllSelected(group)
  group.items.forEach(item => {
    if (allSelected) {
      selected.delete(item.id)
    } else {
      selected.add(item.id)
    }
  })
}

function toggleItem(id: string) {
  if (selected.has(id)) {
    selected.delete(id)
  } else {
    selected.add(id)
  }
}

async function batchComplete() {
  if (!canBatchComplete.value) {
    uni.showToast({ title: batchCompleteInactiveTip.value, icon: 'none' })
    return
  }

  const ids = Array.from(selected)
  const cost = costInput.value ? parseFloat(costInput.value) : null
  const perCost = cost && selected.size > 0
    ? Math.round(cost / selected.size * 100) / 100
    : null

  // 获取选中项的犬只信息
  const selectedItems = taskGroups.value.flatMap(g => g.items).filter(item => ids.includes(item.id))

  const details: Record<string, any> = {}
  if (passedType === 'vaccination' && formData.vaccine_type) {
    details.vaccine_type = formData.vaccine_type
  }
  if (passedType === 'deworming') {
    details.deworming_type = formData.deworming_type
    if (formData.drug_name) details.drug_name = formData.drug_name
  }

  const result = await localSyncRuntime.batchAddHealthRecordsLocally(currentFamily.value?._id || '', {
    dog_ids: selectedItems.map(item => item.dogId),
    type: passedType,
    date: formDate.value,
    cost: cost,
    notes: null,
    details,
    create_task: false,
    source_task_ids: ids,
  })
  const completedTaskIds = new Set((result?.data?.completedTasks || []).map((task: any) => task._id).filter(Boolean))
  const completedRecordCount = Number(result?.data?.count || 0)
  const skippedCount = Number(result?.data?.skipped || 0)
  if (completedRecordCount === 0 && skippedCount > 0) {
    uni.showToast({ title: `今日已有相同记录，已跳过 ${skippedCount} 条`, icon: 'none' })
    return
  }

  // 更新 UI
  taskGroups.value.forEach(g => {
    g.items = g.items.filter(item => !completedTaskIds.has(item.id))
  })
  taskGroups.value = taskGroups.value.filter(g => g.items.length > 0)
  Array.from(selected).forEach((id) => {
    if (completedTaskIds.has(id)) selected.delete(id)
  })

  uni.showToast({
    title: skippedCount > 0 ? `已完成 ${completedRecordCount} 条，跳过 ${skippedCount} 条` : `已完成 ${completedRecordCount} 条记录`,
    icon: 'success',
  })
  if (taskGroups.value.length === 0) {
    setTimeout(() => uni.navigateBack(), 1000)
  }
}

const typeLabels: Record<string, { title: string; icon: string; color: string }> = {
  vaccination: { title: '疫苗', icon: 'vaccines', color: 'blue' },
  deworming: { title: '驱虫', icon: 'shield', color: 'teal' },
  illness: { title: '疾病', icon: 'sick', color: getHealthTypeTone('illness').color },
  breeding_milestone: { title: '繁育', icon: 'favorite', color: 'rose' },
  medication: { title: '用药', icon: 'medication', color: 'plum' },
}

async function loadData() {
  loading.value = true
  try {
    if (passedTaskIds.length > 0) {
      const rows = await listLocalTasksByIds(currentFamily.value?._id || '', passedTaskIds)
      if (rows.length > 0) {
        const meta = typeLabels[passedType] || { title: passedType, icon: 'assignment', color: 'green' }
        taskGroups.value = [{
          type: passedType,
          title: meta.title,
          icon: meta.icon,
          color: meta.color,
          items: rows.map((t: any) => ({
            id: t._id,
            dogId: t.dog_id,
            dogName: t.dog_name || '未知',
            detail: t.title || '',
            taskType: t.type,
          })),
        }]
        taskGroups.value[0].items.forEach(item => selected.add(item.id))
      }
    }
  } finally {
    loading.value = false
  }
}

onLoad((query) => {
  passedType = query?.type || ''
  passedTaskIds = query?.taskIds ? query.taskIds.split(',') : []
  formDate.value = buildTimestampFromDayOffset(0)
  loadData()
})
</script>

<style lang="scss" scoped>
/* 使用全局 .page 类 */

/* ---- 任务分组列表 ---- */
.batch-page__body {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);
}

/* ---- 组卡片 ---- */
.batch-page__group {
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.batch-page__group-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: var(--space-card) var(--space-card) 12px var(--space-card-left);
}

.batch-page__group-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .material-icons-round {
    font-size: 18px;
    color: #fff;
  }

  &--blue { background: var(--blue); }
  &--green { background: var(--green); }
  &--amber { background: var(--amber); }
  &--plum { background: var(--plum); }
  &--rose { background: var(--rose); }
  &--teal { background: var(--teal); }
  &--red { background: var(--red); }
}

.batch-page__group-info {
  flex: 1;
  min-width: 0;
}

.batch-page__group-title {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  display: block;
}

.batch-page__group-sub {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
  display: block;
}

.batch-page__toggle {
  padding: 6px 12px;
  border-radius: var(--radius-btn);
  background: var(--primary-soft);
  transition: all 0.12s ease;

  &:active {
    transform: scale(0.92);
    opacity: 0.85;
  }
}

.batch-page__toggle-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
}

/* ---- 任务条目 ---- */
.batch-page__items {
  padding: 0 var(--space-card) var(--space-card) var(--space-card-left);
  display: flex;
  flex-direction: column;
  gap: var(--space-group-gap);
}

.batch-page__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-row);
  background: var(--bg);
  transition: all 0.12s ease;

  &:active {
    transform: scale(0.98);
    opacity: 0.85;
  }
}

.batch-page__checkbox {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-checkbox);
  border: 2px solid var(--text-4);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;

  &--checked {
    background: var(--primary);
    border-color: var(--primary);
  }
}

.batch-page__check-icon {
  font-size: 14px;
  color: #fff;
}

.batch-page__item-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .material-icons-round {
    font-size: 16px;
    color: #fff;
  }
}

.batch-page__item-body {
  flex: 1;
  min-width: 0;
}

.batch-page__item-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  display: block;
}

.batch-page__item-detail {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
  display: block;
}

/* 使用全局 .form-body 类（flex + gap: 16px） */
/* 使用全局 .fixed-bottom + .submit-btn 类 */
</style>
