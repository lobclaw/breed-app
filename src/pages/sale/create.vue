<template>
  <view class="page">
    <BPageHeader :title="pageTitle" />

    <view class="dog-picker-area">
      <BDogPicker
        v-model="selectedDog"
        title="选择犬只"
        :readonly="dogLocked"
        :candidate-dogs="dogPickerCandidates"
        :empty-title="dogLocked ? '犬只信息缺失' : '暂无犬只'"
        :empty-description="dogLocked ? '请返回来源页重新进入' : '没有可开始销售的幼崽'"
      />
    </view>

    <view class="form-section">
      <view class="form-card">
        <view class="form-group">
          <text class="form-label">销售路径</text>
          <view class="sale-mode-pills sale-flow-mode-pills">
            <view
              v-for="mode in saleFlowModeOptions"
              :key="mode.value"
              class="sale-mode-pill"
              :class="{ 'sale-mode-pill--active': saleFlowMode === mode.value }"
              @click="selectSaleFlowMode(mode.value)"
            >
              <text>{{ mode.label }}</text>
            </view>
          </view>
          <text class="form-helper">{{ flowModeDescription }}</text>
        </view>
      </view>

      <view class="form-card">
        <view class="form-group">
          <text class="form-label">销售方式</text>
          <view class="sale-mode-pills">
            <view
              v-for="mode in visibleSaleModeOptions"
              :key="mode.label"
              class="sale-mode-pill"
              :class="{ 'sale-mode-pill--active': form.sale_mode === mode.value }"
              @click="selectSaleMode(mode.value)"
            >
              <text>{{ mode.label }}</text>
            </view>
          </view>
          <text class="form-helper">{{ saleModeDescription }}</text>
        </view>
        <view v-if="shouldShowAgentPicker" class="form-group">
          <text class="form-label">代理人（选填）</text>
          <view class="sale-select" @click="openAgentSheet">
            <text class="sale-select__text" :class="{ 'sale-select__text--placeholder': !form.agent_name }">
              {{ form.agent_name || '选择代理人' }}
            </text>
            <text class="material-icons-round sale-select__icon">chevron_right</text>
          </view>
        </view>
      </view>

      <view v-if="!isDirectComplete" class="form-card">
        <view class="form-group">
          <text class="form-label">底价（选填）</text>
          <view class="price-input-wrapper">
            <text class="price-symbol">¥</text>
            <input
              v-model="floorPriceInput"
              type="digit"
              class="price-input"
              placeholder="暂未定价可留空"
            />
          </view>
          <text class="form-helper">底价是内部参考价，不再作为进入待售的前置条件。</text>
        </view>
      </view>

      <view v-if="isDirectComplete" class="form-card">
        <view class="form-group">
          <text class="form-label">到手价（选填）</text>
          <view class="price-input-wrapper">
            <text class="price-symbol">¥</text>
            <input
              v-model="receivedAmountInput"
              type="digit"
              class="price-input"
              placeholder="结算后再补可留空"
            />
          </view>
          <text class="form-helper">留空时先标记成交，不自动生成销售收入。</text>
        </view>
        <view class="form-group">
          <text class="form-label">约定价（选填）</text>
          <view class="price-input-wrapper">
            <text class="price-symbol">¥</text>
            <input
              v-model="agreedPriceInput"
              type="digit"
              class="price-input"
              placeholder="请输入金额"
            />
          </view>
        </view>
        <view class="form-group">
          <text class="form-label">平台（选填）</text>
          <view class="sale-mode-pills">
            <view
              v-for="platform in platformOptions"
              :key="platform"
              class="sale-mode-pill"
              :class="{ 'sale-mode-pill--active': form.platform === platform }"
              @click="form.platform = form.platform === platform ? '' : platform"
            >
              <text>{{ platform }}</text>
            </view>
          </view>
        </view>
        <view class="form-group">
          <text class="form-label">交付日期（选填）</text>
          <view class="sale-select" @click="showDeliveryDatePicker = true">
            <text class="sale-select__text" :class="{ 'sale-select__text--placeholder': !deliveryDateText }">
              {{ deliveryDateText || '选择日期' }}
            </text>
            <text class="material-icons-round sale-select__icon">calendar_today</text>
          </view>
        </view>
      </view>

      <view class="form-card">
        <view class="form-group">
          <text class="form-label">买家信息（选填）</text>
          <input v-model="form.buyer_info" class="sale-input" placeholder="姓名 / 联系方式" />
        </view>
        <view class="form-group">
          <text class="form-label">备注（选填）</text>
          <textarea v-model="form.notes" class="sale-textarea" placeholder="补充来源、销售备注等..." />
        </view>
      </view>
    </view>

    <view class="fixed-bottom">
      <BSubmitButton
        :inactive="!selectedDog"
        inactive-tip="请选择要销售的犬只"
        :loading="submitState === 'submitting'"
        :success="submitState === 'success'"
        @click="submit"
      >{{ submitButtonText }}</BSubmitButton>
      <text class="submit-note">{{ submitNote }}</text>
    </view>

    <BDateTimePicker
      v-model:visible="showDeliveryDatePicker"
      :model-value="form.delivery_date"
      mode="date"
      value-type="timestamp"
      @confirm="onDeliveryDateConfirm"
    />

    <BSheet :visible="showAgentSheet" title="选择代理人" @update:visible="showAgentSheet = $event">
      <view v-if="agentLoading" class="agent-select-loading">
        <BSkeleton :rows="3" />
      </view>
      <view v-else class="agent-select-list">
        <view class="agent-add-entry" @click="goToAgentManage">
          <view class="agent-add-entry__icon">
            <text class="material-icons-round">add</text>
          </view>
          <text class="agent-add-entry__text">新增代理人</text>
          <text class="material-icons-round agent-add-entry__arrow">chevron_right</text>
        </view>

        <template v-if="agentList.length > 0">
          <view
            v-for="agent in agentList"
            :key="agent._id"
            class="agent-select-item"
            :class="{ 'agent-select-item--active': form.agent_id === agent._id }"
            @click="selectAgent(agent)"
          >
            <view class="agent-select-avatar">
              <text class="material-icons-round agent-select-avatar__icon">person</text>
            </view>
            <view class="agent-select-info">
              <text class="agent-select-name">{{ agent.name }}</text>
              <text v-if="agent.contact_info" class="agent-select-contact">{{ agent.contact_info }}</text>
            </view>
            <text v-if="form.agent_id === agent._id" class="material-icons-round agent-select-check">check_circle</text>
          </view>
        </template>
        <BEmpty v-else icon="handshake" title="暂无代理人" description="可前往代理人管理添加" />
      </view>
    </BSheet>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import { queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import { listLocalAgents, listLocalSaleCandidateDogs } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BDateTimePicker from '@/components/form/BDateTimePicker.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import { formatDateInputValue } from '@/utils/date'

type SaleMode = '自售' | '代理' | '代卖' | null
type SaleFlowMode = 'start' | 'direct-complete'
type SelectedDog = {
  _id: string
  name: string
  role: string
  gender: string
  breed?: string
}

const saleFlowModeOptions: Array<{ label: string; value: SaleFlowMode }> = [
  { label: '开始销售', value: 'start' },
  { label: '直接成交', value: 'direct-complete' },
]

const saleModeOptions: Array<{ label: string; value: SaleMode }> = [
  { label: '待定', value: null },
  { label: '自售', value: '自售' },
  { label: '代理', value: '代理' },
  { label: '代卖', value: '代卖' },
]

const platformOptions = ['线下', '微信', '小红书', '抖音', '快手', '闲鱼']

const selectedDog = ref<SelectedDog | null>(null)
const saleCandidateDogs = ref<SelectedDog[]>([])
const dogLocked = ref(false)
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const saleFlowMode = ref<SaleFlowMode>('start')
const floorPriceInput = ref('')
const receivedAmountInput = ref('')
const agreedPriceInput = ref('')
const showDeliveryDatePicker = ref(false)
const showAgentSheet = ref(false)
const agentLoading = ref(false)
const agentList = ref<any[]>([])
const { currentFamily } = useAuth()
usePageSync({ routePath: 'pages/sale/create' })

const form = reactive({
  sale_mode: null as SaleMode,
  platform: '',
  agent_id: '',
  agent_name: '',
  delivery_date: null as number | null,
  buyer_info: '',
  notes: '',
})

const lockedDogCandidates = computed(() => {
  if (!dogLocked.value || !selectedDog.value) return undefined
  return [selectedDog.value]
})

const dogPickerCandidates = computed(() => lockedDogCandidates.value ?? saleCandidateDogs.value)
const isDirectComplete = computed(() => saleFlowMode.value === 'direct-complete')
const pageTitle = computed(() => (isDirectComplete.value ? '直接成交' : '开始销售'))
const deliveryDateText = computed(() => formatDateInputValue(form.delivery_date))
const visibleSaleModeOptions = computed(() => (
  isDirectComplete.value
    ? saleModeOptions.filter(mode => mode.value !== null)
    : saleModeOptions
))
const shouldShowAgentPicker = computed(() => isDirectComplete.value && ['代理', '代卖'].includes(String(form.sale_mode || '')))

const flowModeDescription = computed(() => (
  isDirectComplete.value
    ? '已经卖掉了，直接记成交。'
    : '先把幼崽纳入销售池，后续可收定金或完成交易。'
))

const saleModeDescription = computed(() => {
  if (!form.sale_mode) {
    return isDirectComplete.value
      ? '请选择这笔成交的销售方式。'
      : '先进入销售池，成交路径确定后可在详情页或成交表单中补选。'
  }
  const map: Record<Exclude<SaleMode, null>, string> = {
    自售: '自己对接买家，后续可直接收定金或完成交易。',
    代理: '由代理人协助介绍买家，适合需要记录代理人或平台来源的销售。',
    代卖: '交给合作方代为销售，成交后再按实际回款补录结算。',
  }
  return map[form.sale_mode]
})

function selectSaleFlowMode(mode: SaleFlowMode) {
  saleFlowMode.value = mode
  if (mode === 'direct-complete' && !form.sale_mode) {
    form.sale_mode = '自售'
  }
  if (mode !== 'direct-complete') {
    clearAgent()
  }
}

function selectSaleMode(mode: SaleMode) {
  form.sale_mode = mode
  if (!['代理', '代卖'].includes(String(mode || ''))) {
    clearAgent()
  }
}

function clearAgent() {
  form.agent_id = ''
  form.agent_name = ''
}

const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '提交中...'
  if (submitState.value === 'success') return isDirectComplete.value ? '已成交' : '已开始销售'
  return isDirectComplete.value ? '确认成交' : '确认开始销售'
})

const submitNote = computed(() => (
  isDirectComplete.value
    ? '成交后犬只状态变为「已售」；到手价留空会标记为未结算'
    : '开始后犬只状态变为「待售」'
))

function parseOptionalAmount(value: string, label: string) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return null
  const amount = Number(trimmed)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`请填写有效的${label}`)
  }
  return amount
}

function decodeQueryText(value: string | undefined) {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function onDeliveryDateConfirm(value: number | string) {
  if (typeof value !== 'number') return
  form.delivery_date = value
}

async function openAgentSheet() {
  const familyId = currentFamily.value?._id || ''
  showAgentSheet.value = true
  agentLoading.value = true
  if (!familyId) {
    agentList.value = []
    agentLoading.value = false
    return
  }
  localSyncRuntime.setCurrentFamilyId(familyId)
  agentList.value = await listLocalAgents(familyId)
  agentLoading.value = false
}

function selectAgent(agent: any) {
  form.agent_id = agent._id || ''
  form.agent_name = agent.name || ''
  showAgentSheet.value = false
}

function goToAgentManage() {
  showAgentSheet.value = false
  uni.navigateTo({ url: '/pages/sale/agents' })
}

async function submit() {
  if (!selectedDog.value?._id) return
  submitState.value = 'submitting'
  try {
    const familyId = currentFamily.value?._id || ''
    localSyncRuntime.setCurrentFamilyId(familyId)
    const res = isDirectComplete.value
      ? await localSyncRuntime.directCompleteSaleLocally(familyId, {
          dog_id: selectedDog.value._id,
          sale_mode: form.sale_mode,
          received_amount: parseOptionalAmount(receivedAmountInput.value, '到手价'),
          agreed_price: parseOptionalAmount(agreedPriceInput.value, '约定价'),
          buyer_info: form.buyer_info || null,
          platform: form.platform || null,
          agent_id: shouldShowAgentPicker.value ? form.agent_id || null : null,
          agent_name: shouldShowAgentPicker.value ? form.agent_name || null : null,
          delivery_date: form.delivery_date || null,
          notes: form.notes || null,
          date: Date.now(),
        })
      : await localSyncRuntime.createSaleRecordLocally(familyId, {
          dog_id: selectedDog.value._id,
          sale_mode: form.sale_mode,
          floor_price: floorPriceInput.value ? parseFloat(floorPriceInput.value) : null,
          buyer_info: form.buyer_info || null,
          notes: form.notes || null,
        })
    if (res) {
      submitState.value = 'success'
      queueSubmitFeedback({ message: isDirectComplete.value ? '已成交' : '已开始销售' })
      await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
      uni.navigateBack()
    }
  } catch (error: any) {
    uni.showToast({ title: error?.message || (isDirectComplete.value ? '直接成交失败' : '开始销售失败'), icon: 'none' })
    submitState.value = 'idle'
  } finally {
    if (submitState.value !== 'success') submitState.value = 'idle'
  }
}

async function loadSaleCandidateDogs() {
  if (dogLocked.value) return
  const familyId = currentFamily.value?._id || ''
  localSyncRuntime.setCurrentFamilyId(familyId)
  saleCandidateDogs.value = await listLocalSaleCandidateDogs(familyId)
}

onLoad((options?: Record<string, any>) => {
  const dogId = options?.dogId || ''
  if (!dogId) {
    void loadSaleCandidateDogs()
    return
  }
  selectedDog.value = {
    _id: dogId,
    name: decodeQueryText(options?.dogName),
    role: '幼崽',
    gender: '',
  }
  dogLocked.value = true
})

onShow(() => {
  void loadSaleCandidateDogs()
  if (shouldShowAgentPicker.value) {
    const familyId = currentFamily.value?._id || ''
    if (familyId) {
      localSyncRuntime.setCurrentFamilyId(familyId)
      void listLocalAgents(familyId).then((items) => {
        agentList.value = items
      })
    }
  }
})
</script>

<style lang="scss" scoped>
.dog-picker-area {
  padding: 0 16px 16px;
}

.form-section {
  padding: 0 16px;
}

.form-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 20px 16px;
  box-shadow: var(--shadow);
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 18px;

  &:last-child {
    margin-bottom: 0;
  }
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 8px;
  display: block;
}

.sale-mode-pills {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.sale-flow-mode-pills {
  flex-wrap: nowrap;

  .sale-mode-pill {
    flex: 1;
    min-width: 0;
  }
}

.sale-mode-pill {
  min-width: 76px;
  height: 38px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid rgba(203, 165, 92, 0.25);
  background: rgba(203, 165, 92, 0.08);
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;

  &--active {
    border-color: var(--amber);
    background: var(--amber-soft);
    color: var(--amber-dark, var(--amber));
  }
}

.sale-select {
  height: 48px;
  border-radius: 14px;
  border: 1.5px solid var(--text-4);
  background: var(--bg);
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sale-select__text {
  font-size: 14px;
  color: var(--text-1);
}

.sale-select__text--placeholder {
  color: var(--text-3);
}

.sale-select__icon {
  font-size: 20px;
  color: var(--text-3);
}

.agent-select-loading {
  padding: 20px 0;
}

.agent-select-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 20px;
}

.agent-add-entry {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-row);
  background: var(--primary-soft);
  border: 1.5px dashed rgba(234, 62, 119, 0.22);
  transition: all 0.15s ease;

  &:active {
    transform: scale(0.975);
  }
}

.agent-add-entry__icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--card);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  flex-shrink: 0;
}

.agent-add-entry__text {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}

.agent-add-entry__arrow {
  font-size: 18px;
  color: var(--text-3);
}

.agent-select-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-row);
  background: var(--bg);
  transition: all 0.15s ease;

  &:active {
    transform: scale(0.975);
  }

  &--active {
    background: var(--primary-soft);
    border: 1.5px solid var(--primary);
  }
}

.agent-select-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.agent-select-avatar__icon {
  color: #fff;
  font-size: 18px;
}

.agent-select-info {
  flex: 1;
  min-width: 0;
}

.agent-select-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  display: block;
}

.agent-select-contact {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
  display: block;
}

.agent-select-check {
  font-size: 20px;
  color: var(--primary);
}

.price-input-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1.5px solid var(--text-4);
  border-radius: 14px;
  padding: 0 16px;
  height: 56px;
  background: var(--bg);
  transition: border-color 0.2s;

  &:focus-within {
    border-color: var(--primary);
  }
}

.price-symbol {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: var(--text-3);
}

.price-input {
  flex: 1;
  border: none;
  background: transparent;
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: var(--text-1);
}

.sale-input {
  height: 48px;
  border-radius: 14px;
  border: 1.5px solid var(--text-4);
  background: var(--bg);
  padding: 0 16px;
  font-size: 14px;
  color: var(--text-1);
  font-family: var(--font-body);
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--primary);
  }
}

.sale-textarea {
  border-radius: 14px;
  border: 1.5px solid var(--text-4);
  background: var(--bg);
  padding: 14px 16px;
  font-size: 14px;
  color: var(--text-1);
  font-family: var(--font-body);
  min-height: 80px;
  line-height: 1.5;
  resize: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--primary);
  }
}

.form-helper {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 8px;
  line-height: 1.5;
  display: block;
}

.submit-note {
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
  margin-top: 10px;
  display: block;
  line-height: 1.4;
}
</style>
