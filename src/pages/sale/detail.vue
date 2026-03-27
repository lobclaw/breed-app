<template>
  <view class="page">
    <!-- 骨架屏 -->
    <view v-if="!sale" style="padding: 16px;">
      <BSkeleton :rows="3" />
    </view>

    <template v-else>
      <!-- 顶栏 -->
      <BPageHeader title="销售详情">
        <template #right>
          <BTag :label="sale.status" :color="getStatusTagColor(sale.status)" />
        </template>
      </BPageHeader>

      <!-- 犬只卡片 -->
      <view class="dog-card" :style="{ borderLeftColor: getDogCardBorderColor(sale.status) }">
        <view class="dog-avatar">
          <text class="material-icons-round" style="color: #fff; font-size: 22px;">pets</text>
        </view>
        <view class="dog-info">
          <text class="dog-name">{{ sale.dog_name }}</text>
          <text class="dog-meta">{{ sale.breed || '马尔济斯' }}{{ sale.sex ? ' · ' + sale.sex : '' }}{{ sale.age_text ? ' · ' + sale.age_text : '' }}</text>
        </view>
      </view>

      <!-- 状态时间线 -->
      <view class="timeline-section">
        <view class="timeline-card">
          <view class="stepper">
            <view class="stepper-line">
              <view class="stepper-line__fill" :style="{ width: stepperFillWidth }" />
            </view>
            <!-- 待售 -->
            <view class="stepper-step">
              <view class="stepper-dot" :class="{ 'stepper-dot--done': stepIndex >= 0 }">
                <text v-if="stepIndex >= 0" class="material-icons-round" style="font-size: 16px; color: #fff;">check</text>
                <text v-else>1</text>
              </view>
              <text class="stepper-label" :class="{ 'stepper-label--done': stepIndex >= 0 }">待售</text>
              <text v-if="sale.floor_price" class="stepper-amount">¥{{ sale.floor_price?.toLocaleString() }}</text>
            </view>
            <!-- 已预定 -->
            <view class="stepper-step">
              <view class="stepper-dot" :class="{ 'stepper-dot--done': stepIndex >= 1 }">
                <text v-if="stepIndex >= 1" class="material-icons-round" style="font-size: 16px; color: #fff;">check</text>
                <text v-else>2</text>
              </view>
              <text class="stepper-label" :class="{ 'stepper-label--done': stepIndex >= 1 }">已预定</text>
              <text v-if="sale.deposit_amount" class="stepper-amount" style="color: var(--red);">定金 ¥{{ sale.deposit_amount?.toLocaleString() }}</text>
            </view>
            <!-- 已成交 -->
            <view class="stepper-step">
              <view class="stepper-dot" :class="{ 'stepper-dot--done': stepIndex >= 2, 'stepper-dot--fail': sale.status === '已退款' }">
                <text v-if="stepIndex >= 2" class="material-icons-round" style="font-size: 16px; color: #fff;">check</text>
                <text v-else>3</text>
              </view>
              <text class="stepper-label" :class="{ 'stepper-label--done': stepIndex >= 2 }">已成交</text>
              <text v-if="sale.received_amount" class="stepper-amount" style="color: var(--red);">到手 ¥{{ sale.received_amount?.toLocaleString() }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 价格详情 -->
      <view class="detail-section">
        <view class="detail-card">
          <view class="detail-row" v-if="sale.floor_price">
            <text class="detail-label">底价</text>
            <text class="detail-value">¥{{ sale.floor_price?.toLocaleString() }}</text>
          </view>
          <view class="detail-row" v-if="sale.deposit_amount">
            <text class="detail-label">定金</text>
            <view style="display: flex; align-items: center; gap: 6px;">
              <text class="detail-value" style="color: var(--red);">¥{{ sale.deposit_amount?.toLocaleString() }}</text>
              <text v-if="sale.deposit_date" style="font-weight: 500; font-size: 12px; color: var(--text-3);">{{ formatDate(sale.deposit_date) }}</text>
            </view>
          </view>
          <view class="detail-row" v-if="sale.agreed_price">
            <text class="detail-label">成交价</text>
            <text class="detail-value detail-value--price">¥{{ sale.agreed_price?.toLocaleString() }}</text>
          </view>
          <view class="detail-row" v-if="sale.received_amount">
            <text class="detail-label">到手价</text>
            <text class="detail-value detail-value--price">¥{{ sale.received_amount?.toLocaleString() }}</text>
          </view>
          <view class="detail-row" v-if="sale.agreed_price && sale.received_amount && sale.agreed_price > sale.received_amount">
            <text class="detail-label">差额（佣金）</text>
            <text class="detail-value" style="color: var(--green);">¥{{ (sale.agreed_price - sale.received_amount).toLocaleString() }}</text>
          </view>
          <view class="detail-row" v-if="sale.refund_amount">
            <text class="detail-label">退款金额</text>
            <text class="detail-value" style="color: var(--green);">¥{{ sale.refund_amount?.toLocaleString() }}</text>
          </view>
          <view class="detail-row" v-if="sale.deposit_kept_amount != null && sale.status === '定金取消'">
            <text class="detail-label">定金保留</text>
            <text class="detail-value">¥{{ sale.deposit_kept_amount?.toLocaleString() }}</text>
          </view>
        </view>
      </view>

      <!-- 交易信息 -->
      <view class="detail-section">
        <view class="detail-card">
          <view class="detail-row" v-if="sale.agent_name">
            <text class="detail-label">卖出人</text>
            <text class="detail-value">{{ sale.agent_name }}</text>
          </view>
          <view class="detail-row" v-if="sale.platform">
            <text class="detail-label">平台</text>
            <view>
              <text class="platform-pill">{{ sale.platform }}</text>
            </view>
          </view>
          <view class="detail-row" v-if="sale.delivery_date">
            <text class="detail-label">交付日期</text>
            <text class="detail-value">{{ formatDate(sale.delivery_date) }}</text>
          </view>
          <view class="detail-row" v-if="sale.buyer_info">
            <text class="detail-label">买家</text>
            <text class="detail-value">{{ sale.buyer_info }}</text>
          </view>
          <view class="detail-row" v-if="sale.refund_reason">
            <text class="detail-label">退款原因</text>
            <text class="detail-value">{{ sale.refund_reason }}</text>
          </view>
          <view class="detail-row" v-if="sale.notes">
            <text class="detail-label">备注</text>
            <text class="detail-value">{{ sale.notes }}</text>
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="action-area" v-if="sale.status === '待售'">
        <button class="action-btn action-btn--ghost" @click="showDepositModal = true">收定金</button>
        <button class="action-btn action-btn--filled-green" @click="showCompleteModal = true">直接成交</button>
      </view>

      <view class="action-area" v-if="sale.status === '已预定'">
        <button class="action-btn action-btn--filled-green" @click="showCompleteModal = true">完成交易</button>
        <button class="action-btn action-btn--ghost-red" @click="showCancelModal = true">取消预定</button>
      </view>

      <view class="action-area" v-if="sale.status === '已成交'">
        <button class="action-btn action-btn--ghost-red" @click="showRefundModal = true">退款</button>
      </view>
    </template>

    <!-- 收定金弹窗 -->
    <view class="modal-mask" v-if="showDepositModal" @click.self="showDepositModal = false">
      <view class="modal-content">
        <text class="modal-title">收定金</text>
        <view class="modal-field">
          <text class="modal-label">定金金额(¥) *</text>
          <input v-model="depositForm.deposit_amount" type="digit" placeholder="必填" class="modal-input" />
        </view>
        <view class="modal-field">
          <text class="modal-label">约定价(¥)</text>
          <input v-model="depositForm.agreed_price" type="digit" placeholder="选填" class="modal-input" />
        </view>
        <view class="modal-field">
          <text class="modal-label">买家信息</text>
          <input v-model="depositForm.buyer_info" placeholder="选填" class="modal-input" />
        </view>
        <view class="modal-field">
          <text class="modal-label">平台</text>
          <view class="modal-pills">
            <view
              v-for="p in platforms"
              :key="p"
              class="modal-pill"
              :class="{ 'modal-pill--active': depositForm.platform === p }"
              @click="depositForm.platform = depositForm.platform === p ? '' : p"
            >
              <text>{{ p }}</text>
            </view>
          </view>
        </view>
        <view class="modal-actions">
          <button class="modal-btn" @click="showDepositModal = false">取消</button>
          <button class="modal-btn modal-btn--primary" :disabled="!depositForm.deposit_amount" @click="doDeposit">确认</button>
        </view>
      </view>
    </view>

    <!-- 完成交易弹窗 -->
    <view class="modal-mask" v-if="showCompleteModal" @click.self="showCompleteModal = false">
      <view class="modal-content">
        <text class="modal-title">完成交易</text>
        <view class="modal-field">
          <text class="modal-label">到手价(¥) *</text>
          <input v-model="completeForm.received_amount" type="digit" placeholder="必填" class="modal-input" />
        </view>
        <view class="modal-field">
          <text class="modal-label">买家信息</text>
          <input v-model="completeForm.buyer_info" placeholder="选填" class="modal-input" />
        </view>
        <view class="modal-field">
          <text class="modal-label">平台</text>
          <view class="modal-pills">
            <view
              v-for="p in platforms"
              :key="p"
              class="modal-pill"
              :class="{ 'modal-pill--active': completeForm.platform === p }"
              @click="completeForm.platform = completeForm.platform === p ? '' : p"
            >
              <text>{{ p }}</text>
            </view>
          </view>
        </view>
        <view class="modal-actions">
          <button class="modal-btn" @click="showCompleteModal = false">取消</button>
          <button class="modal-btn modal-btn--primary" :disabled="!completeForm.received_amount" @click="doComplete">确认</button>
        </view>
      </view>
    </view>

    <!-- 取消预定弹窗 -->
    <view class="modal-mask" v-if="showCancelModal" @click.self="showCancelModal = false">
      <view class="modal-content">
        <text class="modal-title">取消预定</text>
        <view class="modal-field">
          <text class="modal-label">定金保留金额(¥)</text>
          <input v-model="cancelForm.deposit_kept_amount" type="digit" placeholder="0 = 全额退还定金" class="modal-input" />
        </view>
        <view class="modal-field">
          <text class="modal-label">取消原因</text>
          <input v-model="cancelForm.refund_reason" placeholder="选填" class="modal-input" />
        </view>
        <view class="modal-actions">
          <button class="modal-btn" @click="showCancelModal = false">取消</button>
          <button class="modal-btn modal-btn--warn" @click="doCancel">确认取消</button>
        </view>
      </view>
    </view>

    <!-- 退款弹窗 -->
    <view class="modal-mask" v-if="showRefundModal" @click.self="showRefundModal = false">
      <view class="modal-content">
        <text class="modal-title">退款</text>
        <view class="modal-field">
          <text class="modal-label">退款金额(¥) *</text>
          <input v-model="refundForm.refund_amount" type="digit" :placeholder="`最多 ${sale?.received_amount || ''}`" class="modal-input" />
        </view>
        <view class="modal-field">
          <text class="modal-label">退款原因</text>
          <input v-model="refundForm.refund_reason" placeholder="选填" class="modal-input" />
        </view>
        <view class="modal-actions">
          <button class="modal-btn" @click="showRefundModal = false">取消</button>
          <button class="modal-btn modal-btn--warn" :disabled="!refundForm.refund_amount" @click="doRefund">确认退款</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BTag from '@/components/base/BTag.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'

const sale = ref<any>(null)
const saleId = ref('')

const showDepositModal = ref(false)
const showCompleteModal = ref(false)
const showCancelModal = ref(false)
const showRefundModal = ref(false)

const platforms = ['线下', '微信', '小红书', '抖音', '快手', '闲鱼']

const depositForm = reactive({
  deposit_amount: '',
  agreed_price: '',
  buyer_info: '',
  platform: '',
})

const completeForm = reactive({
  received_amount: '',
  buyer_info: '',
  platform: '',
})

const cancelForm = reactive({
  deposit_kept_amount: '',
  refund_reason: '',
})

const refundForm = reactive({
  refund_amount: '',
  refund_reason: '',
})

const stepIndex = computed(() => {
  if (!sale.value) return -1
  const map: Record<string, number> = {
    '待售': 0,
    '已预定': 1,
    '已成交': 2,
    '已退款': 2,
    '定金取消': 1,
  }
  return map[sale.value.status] ?? -1
})

const stepperFillWidth = computed(() => {
  if (stepIndex.value >= 2) return '100%'
  if (stepIndex.value >= 1) return '50%'
  return '0%'
})

function getStatusTagColor(status: string): 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal' | 'primary' {
  const map: Record<string, any> = {
    '待售': 'amber',
    '已预定': 'blue',
    '已成交': 'green',
    '已退款': 'red',
    '定金取消': 'amber',
  }
  return map[status] || 'amber'
}

function getDogCardBorderColor(status: string) {
  const map: Record<string, string> = {
    '待售': 'var(--amber)',
    '已预定': 'var(--blue)',
    '已成交': 'var(--green)',
    '已退款': 'var(--red)',
    '定金取消': 'var(--text-4)',
  }
  return map[status] || 'var(--amber)'
}

const { run: fetchDetail } = useCloudCall<{ data: any }>('finance-service', 'getSaleDetail')
const { run: receiveDeposit } = useCloudCall('finance-service', 'receiveSaleDeposit', { successMessage: '已收定金', showLoading: true })
const { run: completeSale } = useCloudCall('finance-service', 'completeSale', { successMessage: '交易完成', showLoading: true })
const { run: cancelSale } = useCloudCall('finance-service', 'cancelSale', { successMessage: '已取消', showLoading: true })

function formatDate(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function load() {
  const res = await fetchDetail(saleId.value)
  if (res?.data) {
    sale.value = res.data
    if (res.data.buyer_info) completeForm.buyer_info = res.data.buyer_info
    if (res.data.platform) completeForm.platform = res.data.platform
    if (res.data.agreed_price) completeForm.received_amount = String(res.data.agreed_price)
  }
}

async function doDeposit() {
  const res = await receiveDeposit(saleId.value, {
    deposit_amount: parseFloat(depositForm.deposit_amount),
    agreed_price: depositForm.agreed_price ? parseFloat(depositForm.agreed_price) : null,
    buyer_info: depositForm.buyer_info || null,
    platform: depositForm.platform || null,
  })
  if (res) {
    showDepositModal.value = false
    load()
  }
}

async function doComplete() {
  const res = await completeSale(saleId.value, {
    received_amount: parseFloat(completeForm.received_amount),
    buyer_info: completeForm.buyer_info || null,
    platform: completeForm.platform || null,
  })
  if (res) {
    showCompleteModal.value = false
    load()
  }
}

async function doCancel() {
  const res = await cancelSale(saleId.value, {
    deposit_kept_amount: cancelForm.deposit_kept_amount ? parseFloat(cancelForm.deposit_kept_amount) : 0,
    refund_reason: cancelForm.refund_reason || null,
  })
  if (res) {
    showCancelModal.value = false
    load()
  }
}

async function doRefund() {
  const res = await cancelSale(saleId.value, {
    refund_amount: parseFloat(refundForm.refund_amount),
    refund_reason: refundForm.refund_reason || null,
  })
  if (res) {
    showRefundModal.value = false
    load()
  }
}

onLoad((options: any) => {
  if (options?.id) {
    saleId.value = options.id
    load()
  }
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

/* ==================== DOG CARD ==================== */
.dog-card {
  margin: 0 16px 16px;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  overflow: hidden;
  border-left: 3.5px solid var(--amber);

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 100%;
    background: linear-gradient(135deg, var(--amber-soft) 0%, transparent 40%);
    pointer-events: none;
  }

  & > * { position: relative; z-index: 1; }
}

.dog-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dog-info { flex: 1; min-width: 0; }

.dog-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  display: block;
}

.dog-meta {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 2px;
  display: block;
}

/* ==================== TIMELINE ==================== */
.timeline-section {
  padding: 0 16px;
  margin-bottom: 16px;
}

.timeline-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 20px 16px;
  box-shadow: var(--shadow);
}

.stepper {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  position: relative;
  padding: 0 4px;
}

.stepper-line {
  position: absolute;
  top: 14px;
  left: 32px;
  right: 32px;
  height: 3px;
  background: var(--card-dim);
  border-radius: var(--radius-progress);
  z-index: 0;

  &__fill {
    height: 100%;
    border-radius: var(--radius-progress);
    background: var(--green);
    transition: width 0.4s ease;
  }
}

.stepper-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 1;
  flex: 1;
}

.stepper-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  background: var(--card-dim);
  color: var(--text-3);

  &--done {
    background: var(--green);
    color: #fff;
  }

  &--fail {
    background: var(--red);
    color: #fff;
  }
}

.stepper-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  text-align: center;
  line-height: 1.3;

  &--done { color: var(--green); }
}

.stepper-amount {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-2);
  text-align: center;
}

/* ==================== DETAIL CARDS ==================== */
.detail-section {
  padding: 0 16px;
  margin-bottom: 16px;
}

.detail-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--card-dim);

  &:last-child { border-bottom: none; }
}

.detail-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-3);
}

.detail-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);

  &--price {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 800;
    color: var(--red);
  }
}

.platform-pill {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--radius-tag);
  background: var(--amber-soft);
  color: var(--amber);
  font-size: 12px;
  font-weight: 600;
}

/* ==================== ACTION BUTTONS ==================== */
.action-area {
  padding: 12px 16px 24px;
  display: flex;
  gap: 10px;
}

.action-btn {
  flex: 1;
  height: 48px;
  border-radius: var(--radius-btn);
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  border: none;
  transition: all 0.12s ease;
  line-height: 48px;
  padding: 0;
  &:active { transform: scale(0.97); opacity: 0.9; }

  &--filled-green {
    background: var(--green);
    color: #fff;
  }

  &--ghost {
    background: transparent;
    border: 1.5px solid var(--text-4);
    color: var(--text-2);
  }

  &--ghost-red {
    background: transparent;
    border: 1.5px solid var(--red);
    color: var(--red);
  }
}

/* ==================== MODALS ==================== */
.modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: var(--mask);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 20px;
  width: 85%;
  max-width: 320px;
  box-shadow: var(--shadow-lg);
}

.modal-title {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 700;
  color: var(--text-1);
  display: block;
  margin-bottom: 16px;
  text-align: center;
}

.modal-field {
  margin-bottom: 12px;
}

.modal-label {
  font-size: 13px;
  color: var(--text-2);
  margin-bottom: 6px;
  display: block;
}

.modal-input {
  width: 100%;
  height: 44px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  padding: 0 14px;
  font-size: 14px;
  color: var(--text-1);
  background: var(--bg);
}

.modal-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.modal-pill {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  background: var(--card-dim);
  font-size: 12px;
  color: var(--text-2);
  transition: transform 0.12s ease;
  &:active { transform: scale(0.94); }

  &--active {
    background: var(--primary);
    color: #fff;
  }
}

.modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.modal-btn {
  flex: 1;
  height: 40px;
  border-radius: var(--radius-btn);
  font-size: 14px;
  font-weight: 600;
  background: var(--bg);
  color: var(--text-2);
  line-height: 40px;
  padding: 0;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.94); }

  &--primary {
    background: var(--primary);
    color: #fff;
  }

  &--warn {
    background: var(--red);
    color: #fff;
  }

  &[disabled] { opacity: 0.5; }
}
</style>
