<template>
  <view class="page">
    <BPageHeader title="护理规则">
      <template #right>
        <view class="header-add" @click="openAddModal">
          <text class="material-icons-round" style="font-size: 18px;">add</text>
          <text class="header-add__text">新建</text>
        </view>
      </template>
    </BPageHeader>

    <!-- 规则列表 -->
    <view v-if="rules.length > 0" class="rule-list">
      <view
        v-for="(rule, idx) in rules"
        :key="idx"
        class="rule-card"
        :class="triggerColorClass(rule.status_trigger)"
      >
        <view class="rule-card__header">
          <text class="rule-card__title">{{ rule.task_description }}</text>
          <text
            class="material-icons-round rule-card__delete"
            @click="askDelete(idx)"
          >delete_outline</text>
        </view>
        <text class="rule-card__meta">触发：{{ rule.status_trigger }} · {{ rule.frequency || '每日' }}</text>
      </view>
    </view>

    <!-- 空状态 -->
    <BEmpty
      v-else
      icon="rule"
      title="暂无护理规则"
      description="添加自动触发的护理任务规则"
      actionText="新建规则"
      @action="openAddModal"
    />

    <!-- 推荐模板 -->
    <view v-if="availableTemplates.length > 0" class="template-section">
      <text class="template-section__label">推荐模板</text>
      <view v-for="(tpl, idx) in availableTemplates" :key="idx" class="template-card">
        <view class="template-card__content">
          <text class="template-card__title">{{ tpl.task_description }}</text>
          <text class="template-card__meta">触发：{{ tpl.status_trigger }} · {{ tpl.frequency }}</text>
        </view>
        <button
          class="template-card__btn"
          :disabled="!!enablingTemplateKey"
          :loading="enablingTemplateKey === getTemplateKey(tpl)"
          @click="enableTemplate(tpl)"
        >
          {{ enablingTemplateKey === getTemplateKey(tpl) ? '启用中' : '+ 启用' }}
        </button>
      </view>
    </view>

    <!-- 删除确认 -->
    <BDeleteConfirm
      v-model:visible="showDeleteConfirm"
      title="删除护理规则"
      :content="`删除后不可恢复`"
      @confirm="confirmDelete"
    />

    <!-- 新建规则 Sheet -->
    <BSheet v-model:visible="showModal" title="新建护理规则" height="auto">
      <view class="form-sheet">
        <view class="form-sheet__field">
          <text class="form-sheet__label">触发条件</text>
          <view class="form-sheet__pills">
            <text
              v-for="opt in triggerOptions"
              :key="opt"
              class="form-sheet__pill"
              :class="{ 'form-sheet__pill--active': form.status_trigger === opt }"
              @click="selectTrigger(opt)"
            >{{ opt }}</text>
            <text
              class="form-sheet__pill"
              :class="{ 'form-sheet__pill--active': isCustomTrigger }"
              @click="selectTrigger('自定义')"
            >自定义</text>
          </view>
          <input
            v-if="isCustomTrigger"
            v-model="form.customTrigger"
            class="form-sheet__input care-rule-custom-input"
            placeholder="请输入触发条件"
          />
        </view>

        <view class="form-sheet__field">
          <text class="form-sheet__label">任务描述</text>
          <input
            v-model="form.task_description"
            class="form-sheet__input"
            placeholder="如：每日喂钙铁"
          />
        </view>

        <view class="form-sheet__field">
          <text class="form-sheet__label">频率</text>
          <view class="form-sheet__pills">
            <text
              v-for="freq in frequencyOptions"
              :key="freq"
              class="form-sheet__pill"
              :class="{ 'form-sheet__pill--active': form.frequency === freq }"
              @click="form.frequency = freq"
            >{{ freq }}</text>
          </view>
        </view>
      </view>
      <template #footer>
        <view class="form-sheet__footer">
          <BSubmitButton
            :loading="submitState === 'submitting'"
            :success="submitState === 'success'"
            :disabled="submitState === 'submitting'"
            @click="onConfirm"
          >
            {{ submitButtonText }}
          </BSubmitButton>
        </view>
      </template>
    </BSheet>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import { listLocalCareRules } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BDeleteConfirm from '@/components/layout/BDeleteConfirm.vue'

const { currentFamily, refreshFamilyFromLocal, ensureFamilyLocalMirror } = useAuth()
usePageSync({ routePath: 'pages/profile/care-rules' })

const rules = ref<any[]>([])

const triggerOptions = ['怀孕中', '哺乳中', '生病中', '用药中']
const frequencyOptions = ['每日', '每周', '每两周']

const templates = [
  { status_trigger: '怀孕中', task_description: '怀孕期每日喂钙铁', frequency: '每日' },
  { status_trigger: '哺乳中', task_description: '哺乳期增加营养', frequency: '每日' },
  { status_trigger: '生病中', task_description: '生病期每日量体温', frequency: '每日' },
]

// 过滤掉已启用的模板
const availableTemplates = computed(() =>
  templates.filter(tpl =>
    !rules.value.some((r: any) =>
      r.status_trigger === tpl.status_trigger && r.task_description === tpl.task_description
    )
  )
)

const showModal = ref(false)
const showDeleteConfirm = ref(false)
const deletingIndex = ref(-1)
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const enablingTemplateKey = ref('')
const deleteSubmitting = ref(false)
const form = reactive({
  status_trigger: '',
  customTrigger: '',
  task_description: '',
  frequency: '每日',
})

const isCustomTrigger = computed(() =>
  form.status_trigger === '自定义' || (form.status_trigger && !triggerOptions.includes(form.status_trigger))
)

const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '保存中...'
  if (submitState.value === 'success') return '已保存'
  return '保存规则'
})

function selectTrigger(opt: string) {
  if (opt === '自定义') {
    form.status_trigger = '自定义'
    form.customTrigger = ''
  } else {
    form.status_trigger = opt
    form.customTrigger = ''
  }
}

async function loadLocalRules() {
  const familyId = currentFamily.value?._id || ''
  if (!familyId) {
    rules.value = []
    return
  }
  localSyncRuntime.setCurrentFamilyId(familyId)
  rules.value = await listLocalCareRules(familyId)
}

function openAddModal() {
  form.status_trigger = ''
  form.customTrigger = ''
  form.task_description = ''
  form.frequency = '每日'
  submitState.value = 'idle'
  showModal.value = true
}

function triggerColorClass(trigger: string) {
  if (trigger.includes('怀孕') || trigger.includes('哺乳')) return 'rule-card--rose'
  if (trigger.includes('生病') || trigger.includes('用药')) return 'rule-card--teal'
  return 'rule-card--rose'
}

async function onConfirm() {
  if (submitState.value === 'submitting') return
  const trigger = isCustomTrigger.value ? form.customTrigger.trim() : form.status_trigger
  if (!trigger || !form.task_description.trim()) {
    uni.showToast({ title: '请填写触发条件和任务描述', icon: 'none' })
    return  // manualClose=true，验证失败弹窗保持打开
  }
  const newRule = {
    status_trigger: trigger,
    task_description: form.task_description.trim(),
    frequency: form.frequency,
  }
  submitState.value = 'submitting'
  try {
    const familyId = currentFamily.value?._id || ''
    localSyncRuntime.setCurrentFamilyId(familyId)
    await ensureFamilyLocalMirror(familyId)
    await localSyncRuntime.addCareRuleLocally(familyId, newRule)
    await refreshFamilyFromLocal(familyId)
    await loadLocalRules()
    submitState.value = 'success'
    setTimeout(() => {
      showModal.value = false
      submitState.value = 'idle'
    }, 520)
  } catch (error: any) {
    submitState.value = 'idle'
    uni.showToast({ title: error?.message || '添加失败，请重试', icon: 'none' })
  }
}

function getTemplateKey(tpl: typeof templates[0]) {
  return `${tpl.status_trigger}__${tpl.task_description}`
}

async function enableTemplate(tpl: typeof templates[0]) {
  if (enablingTemplateKey.value) return
  enablingTemplateKey.value = getTemplateKey(tpl)
  const newRule = { status_trigger: tpl.status_trigger, task_description: tpl.task_description, frequency: tpl.frequency }
  try {
    const familyId = currentFamily.value?._id || ''
    localSyncRuntime.setCurrentFamilyId(familyId)
    await ensureFamilyLocalMirror(familyId)
    await localSyncRuntime.addCareRuleLocally(familyId, newRule)
    await refreshFamilyFromLocal(familyId)
    await loadLocalRules()
  } catch (error: any) {
    uni.showToast({ title: error?.message || '启用失败，请重试', icon: 'none' })
  } finally {
    enablingTemplateKey.value = ''
  }
}

function askDelete(index: number) {
  deletingIndex.value = index
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (deleteSubmitting.value) return
  const index = deletingIndex.value
  if (index < 0) return
  deleteSubmitting.value = true
  try {
    const familyId = currentFamily.value?._id || ''
    localSyncRuntime.setCurrentFamilyId(familyId)
    await ensureFamilyLocalMirror(familyId)
    await localSyncRuntime.removeCareRuleLocally(familyId, index)
    await refreshFamilyFromLocal(familyId)
    await loadLocalRules()
    showDeleteConfirm.value = false
  } catch (error: any) {
    uni.showToast({ title: error?.message || '删除失败，请重试', icon: 'none' })
  } finally {
    deleteSubmitting.value = false
  }
}

onShow(() => {
  void loadLocalRules()
})
</script>

<style lang="scss" scoped>
/* ==================== HEADER ADD ==================== */
.header-add {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--primary);
  padding: 6px 14px 6px 10px;
  border-radius: 20px;
  background: var(--primary-soft);
  transition: all 0.12s ease;
  &:active { transform: scale(0.92); background: var(--icon-rose); }

  &__text {
    font-size: 13px;
    font-weight: 700;
  }
}

/* ==================== RULE LIST ==================== */
.rule-list {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rule-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow);
  border-left: 4px solid var(--text-4);

  &--rose {
    border-left-color: var(--rose);
    background: linear-gradient(135deg, var(--rose-soft) 0%, var(--card) 60%);
  }

  &--teal {
    border-left-color: var(--teal);
    background: linear-gradient(135deg, var(--teal-soft) 0%, var(--card) 60%);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  &__title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__delete {
    font-family: 'Material Icons Round';
    font-size: 20px;
    color: var(--red);
    padding: 4px;
    border-radius: 50%;
    transition: background 0.15s;
    &:active { background: var(--card-dim); }
  }

  &__meta {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
    display: block;
  }
}

/* ==================== TEMPLATE SECTION ==================== */
.template-section {
  padding: 24px 16px 0;

  &__label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
    letter-spacing: 0.5px;
    padding: 0 4px 10px;
    display: block;
  }
}

.template-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1.5px dashed var(--text-4);
  border-radius: var(--radius-card);
  background: var(--card-dim);
  margin-bottom: 8px;

  &__content {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-2);
    display: block;
  }

  &__meta {
    font-size: 11px;
    color: var(--text-3);
    display: block;
    margin-top: 2px;
  }

  &__btn {
    border-radius: var(--radius-btn);
    border: 1.5px solid var(--primary);
    background: transparent;
    font-size: 12px;
    font-weight: 700;
    color: var(--primary);
    flex-shrink: 0;
    margin-left: 12px;
    transition: all 0.12s ease;
    &:active { transform: scale(0.94); background: var(--primary-soft); }
  }
}

.care-rule-custom-input {
  margin-top: 8px;
}
</style>
