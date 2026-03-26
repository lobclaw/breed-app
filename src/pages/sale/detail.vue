<template>
  <view class="sale-detail" v-if="sale">
    <!-- 状态头 -->
    <view class="sale-detail__header" :class="`sale-detail__header--${sale.status}`">
      <text class="sale-detail__status">{{ sale.status }}</text>
      <text class="sale-detail__dog-name">{{ sale.dog_name }}</text>
    </view>

    <!-- 价格信息 -->
    <view class="sale-detail__section">
      <view class="sale-detail__row" v-if="sale.floor_price">
        <text class="sale-detail__label">底价</text>
        <text class="sale-detail__value">¥{{ sale.floor_price }}</text>
      </view>
      <view class="sale-detail__row" v-if="sale.deposit_amount">
        <text class="sale-detail__label">定金</text>
        <text class="sale-detail__value">¥{{ sale.deposit_amount }}</text>
      </view>
      <view class="sale-detail__row" v-if="sale.agreed_price">
        <text class="sale-detail__label">约定价</text>
        <text class="sale-detail__value">¥{{ sale.agreed_price }}</text>
      </view>
      <view class="sale-detail__row" v-if="sale.received_amount">
        <text class="sale-detail__label">到手价</text>
        <view class="sale-detail__value-wrap">
          <text class="sale-detail__value sale-detail__value--income">¥{{ sale.received_amount }}</text>
          <text v-if="sale.floor_price && sale.received_amount < sale.floor_price" class="sale-detail__warning">低于底价</text>
        </view>
      </view>
      <view class="sale-detail__row" v-if="sale.refund_amount">
        <text class="sale-detail__label">退款金额</text>
        <text class="sale-detail__value sale-detail__value--refund">¥{{ sale.refund_amount }}</text>
      </view>
      <view class="sale-detail__row" v-if="sale.deposit_kept_amount != null && sale.status === '定金取消'">
        <text class="sale-detail__label">定金保留</text>
        <text class="sale-detail__value">¥{{ sale.deposit_kept_amount }}</text>
      </view>
    </view>

    <!-- 交易信息 -->
    <view class="sale-detail__section">
      <view class="sale-detail__row" v-if="sale.buyer_info">
        <text class="sale-detail__label">买家信息</text>
        <text class="sale-detail__value">{{ sale.buyer_info }}</text>
      </view>
      <view class="sale-detail__row" v-if="sale.platform">
        <text class="sale-detail__label">平台</text>
        <text class="sale-detail__value">{{ sale.platform }}</text>
      </view>
      <view class="sale-detail__row" v-if="sale.deposit_date">
        <text class="sale-detail__label">定金日期</text>
        <text class="sale-detail__value">{{ formatDate(sale.deposit_date) }}</text>
      </view>
      <view class="sale-detail__row" v-if="sale.date">
        <text class="sale-detail__label">成交日期</text>
        <text class="sale-detail__value">{{ formatDate(sale.date) }}</text>
      </view>
      <view class="sale-detail__row" v-if="sale.delivery_date">
        <text class="sale-detail__label">交付日期</text>
        <text class="sale-detail__value">{{ formatDate(sale.delivery_date) }}</text>
      </view>
      <view class="sale-detail__row" v-if="sale.refund_reason">
        <text class="sale-detail__label">退款原因</text>
        <text class="sale-detail__value">{{ sale.refund_reason }}</text>
      </view>
      <view class="sale-detail__row" v-if="sale.notes">
        <text class="sale-detail__label">备注</text>
        <text class="sale-detail__value">{{ sale.notes }}</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="sale-detail__actions" v-if="sale.status === '待售'">
      <button class="sale-detail__btn sale-detail__btn--deposit" @click="showDepositModal = true">收定金</button>
      <button class="sale-detail__btn sale-detail__btn--complete" @click="showCompleteModal = true">直接成交</button>
    </view>

    <view class="sale-detail__actions" v-if="sale.status === '已预定'">
      <button class="sale-detail__btn sale-detail__btn--complete" @click="showCompleteModal = true">完成交易</button>
      <button class="sale-detail__btn sale-detail__btn--cancel" @click="showCancelModal = true">取消预定</button>
    </view>

    <view class="sale-detail__actions" v-if="sale.status === '已成交'">
      <button class="sale-detail__btn sale-detail__btn--cancel" @click="showRefundModal = true">退款</button>
    </view>

    <!-- 收定金弹窗 -->
    <view class="sale-detail__modal" v-if="showDepositModal" @click.self="showDepositModal = false">
      <view class="sale-detail__modal-content">
        <text class="sale-detail__modal-title">收定金</text>
        <view class="sale-detail__modal-field">
          <text class="sale-detail__modal-label">定金金额(¥) *</text>
          <input v-model="depositForm.deposit_amount" type="digit" placeholder="必填" class="sale-detail__modal-input" />
        </view>
        <view class="sale-detail__modal-field">
          <text class="sale-detail__modal-label">约定价(¥)</text>
          <input v-model="depositForm.agreed_price" type="digit" placeholder="选填" class="sale-detail__modal-input" />
        </view>
        <view class="sale-detail__modal-field">
          <text class="sale-detail__modal-label">买家信息</text>
          <input v-model="depositForm.buyer_info" placeholder="选填" class="sale-detail__modal-input" />
        </view>
        <view class="sale-detail__modal-field">
          <text class="sale-detail__modal-label">平台</text>
          <view class="sale-detail__platforms">
            <view
              v-for="p in platforms"
              :key="p"
              class="sale-detail__platform"
              :class="{ 'sale-detail__platform--active': depositForm.platform === p }"
              @click="depositForm.platform = depositForm.platform === p ? '' : p"
            >
              <text>{{ p }}</text>
            </view>
          </view>
        </view>
        <view class="sale-detail__modal-actions">
          <button class="sale-detail__modal-btn" @click="showDepositModal = false">取消</button>
          <button class="sale-detail__modal-btn sale-detail__modal-btn--primary" :disabled="!depositForm.deposit_amount" @click="doDeposit">确认</button>
        </view>
      </view>
    </view>

    <!-- 完成交易弹窗 -->
    <view class="sale-detail__modal" v-if="showCompleteModal" @click.self="showCompleteModal = false">
      <view class="sale-detail__modal-content">
        <text class="sale-detail__modal-title">完成交易</text>
        <view class="sale-detail__modal-field">
          <text class="sale-detail__modal-label">到手价(¥) *</text>
          <input v-model="completeForm.received_amount" type="digit" placeholder="必填" class="sale-detail__modal-input" />
        </view>
        <view class="sale-detail__modal-field">
          <text class="sale-detail__modal-label">买家信息</text>
          <input v-model="completeForm.buyer_info" placeholder="选填" class="sale-detail__modal-input" />
        </view>
        <view class="sale-detail__modal-field">
          <text class="sale-detail__modal-label">平台</text>
          <view class="sale-detail__platforms">
            <view
              v-for="p in platforms"
              :key="p"
              class="sale-detail__platform"
              :class="{ 'sale-detail__platform--active': completeForm.platform === p }"
              @click="completeForm.platform = completeForm.platform === p ? '' : p"
            >
              <text>{{ p }}</text>
            </view>
          </view>
        </view>
        <view class="sale-detail__modal-actions">
          <button class="sale-detail__modal-btn" @click="showCompleteModal = false">取消</button>
          <button class="sale-detail__modal-btn sale-detail__modal-btn--primary" :disabled="!completeForm.received_amount" @click="doComplete">确认</button>
        </view>
      </view>
    </view>

    <!-- 取消预定弹窗 -->
    <view class="sale-detail__modal" v-if="showCancelModal" @click.self="showCancelModal = false">
      <view class="sale-detail__modal-content">
        <text class="sale-detail__modal-title">取消预定</text>
        <view class="sale-detail__modal-field">
          <text class="sale-detail__modal-label">定金保留金额(¥)</text>
          <input v-model="cancelForm.deposit_kept_amount" type="digit" placeholder="0 = 全额退还定金" class="sale-detail__modal-input" />
        </view>
        <view class="sale-detail__modal-field">
          <text class="sale-detail__modal-label">取消原因</text>
          <input v-model="cancelForm.refund_reason" placeholder="选填" class="sale-detail__modal-input" />
        </view>
        <view class="sale-detail__modal-actions">
          <button class="sale-detail__modal-btn" @click="showCancelModal = false">取消</button>
          <button class="sale-detail__modal-btn sale-detail__modal-btn--warn" @click="doCancel">确认取消</button>
        </view>
      </view>
    </view>

    <!-- 退款弹窗 -->
    <view class="sale-detail__modal" v-if="showRefundModal" @click.self="showRefundModal = false">
      <view class="sale-detail__modal-content">
        <text class="sale-detail__modal-title">退款</text>
        <view class="sale-detail__modal-field">
          <text class="sale-detail__modal-label">退款金额(¥) *</text>
          <input v-model="refundForm.refund_amount" type="digit" :placeholder="`最多 ${sale.received_amount}`" class="sale-detail__modal-input" />
        </view>
        <view class="sale-detail__modal-field">
          <text class="sale-detail__modal-label">退款原因</text>
          <input v-model="refundForm.refund_reason" placeholder="选填" class="sale-detail__modal-input" />
        </view>
        <view class="sale-detail__modal-actions">
          <button class="sale-detail__modal-btn" @click="showRefundModal = false">取消</button>
          <button class="sale-detail__modal-btn sale-detail__modal-btn--warn" :disabled="!refundForm.refund_amount" @click="doRefund">确认退款</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'

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
    // 预填完成交易表单
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

<style scoped>
.sale-detail { min-height: 100vh; background: #f5f5f5; padding-bottom: 140rpx; }

.sale-detail__header { padding: 40rpx 32rpx; text-align: center; }
.sale-detail__header--待售 { background: linear-gradient(135deg, #FFF3E0, #FFE0B2); }
.sale-detail__header--已预定 { background: linear-gradient(135deg, #E3F2FD, #BBDEFB); }
.sale-detail__header--已成交 { background: linear-gradient(135deg, #E8F5E9, #C8E6C9); }
.sale-detail__header--已退款 { background: linear-gradient(135deg, #f5f5f5, #e0e0e0); }
.sale-detail__header--定金取消 { background: linear-gradient(135deg, #f5f5f5, #e0e0e0); }
.sale-detail__status { display: block; font-size: 24rpx; color: #666; margin-bottom: 8rpx; }
.sale-detail__dog-name { font-size: 40rpx; font-weight: 700; color: #333; }

.sale-detail__section { background: #fff; margin: 16rpx 32rpx; border-radius: 16rpx; padding: 24rpx; }
.sale-detail__row { display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.sale-detail__row:last-child { border-bottom: none; }
.sale-detail__label { font-size: 28rpx; color: #999; }
.sale-detail__value { font-size: 28rpx; color: #333; font-weight: 500; }
.sale-detail__value-wrap { display: flex; align-items: center; gap: 8rpx; }
.sale-detail__value--income { color: #FF3B30; }
.sale-detail__value--refund { color: #FF3B30; }
.sale-detail__warning { font-size: 22rpx; color: #fff; background: #FF3B30; padding: 2rpx 12rpx; border-radius: 8rpx; }

.sale-detail__actions { display: flex; gap: 16rpx; padding: 24rpx 32rpx; }
.sale-detail__btn { flex: 1; height: 80rpx; border-radius: 40rpx; font-size: 30rpx; line-height: 80rpx; padding: 0; }
.sale-detail__btn--deposit { background: #E3F2FD; color: #1565C0; }
.sale-detail__btn--complete { background: #E8F5E9; color: #2E7D32; }
.sale-detail__btn--cancel { background: #f5f5f5; color: #999; }

/* 弹窗 */
.sale-detail__modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.sale-detail__modal-content { background: #fff; border-radius: 24rpx; padding: 40rpx; width: 85%; max-width: 600rpx; }
.sale-detail__modal-title { font-size: 34rpx; font-weight: 700; color: #333; display: block; margin-bottom: 32rpx; text-align: center; }
.sale-detail__modal-field { margin-bottom: 24rpx; }
.sale-detail__modal-label { font-size: 26rpx; color: #666; margin-bottom: 8rpx; display: block; }
.sale-detail__modal-input { border: 1rpx solid #e0e0e0; border-radius: 12rpx; padding: 16rpx; font-size: 28rpx; }
.sale-detail__platforms { display: flex; flex-wrap: wrap; gap: 12rpx; }
.sale-detail__platform { padding: 8rpx 20rpx; border-radius: 16rpx; background: #f5f5f5; font-size: 24rpx; color: #666; }
.sale-detail__platform--active { background: #007AFF; color: #fff; }
.sale-detail__modal-actions { display: flex; gap: 16rpx; margin-top: 32rpx; }
.sale-detail__modal-btn { flex: 1; height: 72rpx; border-radius: 36rpx; font-size: 28rpx; background: #f5f5f5; color: #666; line-height: 72rpx; padding: 0; }
.sale-detail__modal-btn--primary { background: #007AFF; color: #fff; }
.sale-detail__modal-btn--warn { background: #FF3B30; color: #fff; }
.sale-detail__modal-btn[disabled] { opacity: 0.5; }
</style>
