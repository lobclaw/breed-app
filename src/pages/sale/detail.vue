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
          <BEntityIcon :size="22" color="#fff" />
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
              <text v-if="sale.received_amount != null" class="stepper-amount" style="color: var(--red);">到手 ¥{{ sale.received_amount?.toLocaleString() }}</text>
              <text v-else-if="sale.status === '已成交' && sale.settlement_status" class="stepper-amount" style="color: var(--amber);">{{ sale.settlement_status }}</text>
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
              <text v-if="sale.deposit_date" style="font-weight: 500; font-size: 12px; color: var(--text-3);">{{ formatDate(sale.deposit_date) }}(自动记录)</text>
            </view>
          </view>
          <view class="detail-row" v-if="sale.agreed_price">
            <text class="detail-label">成交价</text>
            <text class="detail-value detail-value--price">¥{{ sale.agreed_price?.toLocaleString() }}</text>
          </view>
          <view class="detail-row" v-if="sale.received_amount != null">
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
          <view class="detail-row" v-if="sale.refund_date">
            <text class="detail-label">退款日期</text>
            <text class="detail-value">{{ formatDate(sale.refund_date) }}</text>
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
          <view class="detail-row" v-if="sale.date && sale.date !== sale.created_at">
            <text class="detail-label">成交日期</text>
            <text class="detail-value">{{ formatDate(sale.date) }}</text>
          </view>
          <view class="detail-row" v-if="sale.created_at">
            <text class="detail-label">创建日期</text>
            <text class="detail-value">{{ formatDate(sale.created_at) }}</text>
          </view>
          <view class="detail-row" v-if="sale.sale_mode">
            <text class="detail-label">销售方式</text>
            <text class="detail-value">{{ sale.sale_mode }}</text>
          </view>
          <view class="detail-row" v-if="sale.status === '已成交' && sale.settlement_status">
            <text class="detail-label">结算状态</text>
            <text class="detail-value" :style="sale.settlement_status === '已结算' ? 'color: var(--green);' : 'color: var(--amber);'">
              {{ sale.settlement_status }}
            </text>
          </view>
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
        <button class="action-btn action-btn--ghost-red" @click="openCancelSheet">取消预定</button>
      </view>

      <view class="action-area" v-if="sale.status === '已成交'">
        <button
          v-if="sale.settlement_status !== '已结算'"
          class="action-btn action-btn--filled-green"
          @click="openSettleModal"
        >补录结算</button>
        <button class="action-btn action-btn--ghost-red" @click="openRefundSheet">退款</button>
      </view>
    </template>

    <!-- 收定金弹窗 -->
    <view class="modal-mask" v-if="showDepositModal" @click.self="showDepositModal = false" @touchmove.prevent>
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
              v-for="p in platformLabels"
              :key="p"
              class="modal-pill"
              :class="{ 'modal-pill--active': depositForm.platform === p }"
              @click="depositForm.platform = depositForm.platform === p ? '' : p"
            >
              <text>{{ p }}</text>
            </view>
          </view>
        </view>
        <view class="modal-field">
          <text class="modal-label">选择代理人</text>
          <view class="sheet-select" @click="openAgentSheet(depositForm.agent_id, (agent) => { depositForm.agent_id = agent._id; depositForm.agent_name = agent.name })">
            <text :style="{ color: depositForm.agent_name ? 'var(--text-1)' : 'var(--text-3)' }">
              {{ depositForm.agent_name || '选择代理人' }}
            </text>
            <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">chevron_right</text>
          </view>
        </view>
        <view class="modal-actions">
          <button class="modal-btn" @click="showDepositModal = false">取消</button>
          <button class="modal-btn modal-btn--primary" :disabled="!depositForm.deposit_amount" @click="doDeposit">确认</button>
        </view>
      </view>
    </view>

    <!-- 完成交易弹窗 -->
    <view class="modal-mask" v-if="showCompleteModal" @click.self="showCompleteModal = false" @touchmove.prevent>
      <view class="modal-content">
        <text class="modal-title">完成交易</text>
        <view class="modal-field">
          <text class="modal-label">到手价(¥)</text>
          <input v-model="completeForm.received_amount" type="digit" placeholder="选填，结算后再补" class="modal-input" />
        </view>
        <view class="modal-field">
          <text class="modal-label">约定价(¥)</text>
          <input v-model="completeForm.agreed_price" type="digit" placeholder="选填" class="modal-input" />
        </view>
        <view class="modal-field">
          <text class="modal-label">买家信息</text>
          <input v-model="completeForm.buyer_info" placeholder="选填" class="modal-input" />
        </view>
        <view class="modal-field">
          <text class="modal-label">平台</text>
          <view class="modal-pills">
            <view
              v-for="p in platformLabels"
              :key="p"
              class="modal-pill"
              :class="{ 'modal-pill--active': completeForm.platform === p }"
              @click="completeForm.platform = completeForm.platform === p ? '' : p"
            >
              <text>{{ p }}</text>
            </view>
          </view>
        </view>
        <view class="modal-field">
          <text class="modal-label">交付日期</text>
          <view @click="showDeliveryDatePicker = true">
            <input :value="deliveryDateText" placeholder="选填" class="modal-input" disabled />
          </view>
        </view>
        <view class="modal-actions">
          <button class="modal-btn" @click="showCompleteModal = false">取消</button>
          <button class="modal-btn modal-btn--primary" @click="doComplete">确认</button>
        </view>
      </view>
    </view>

    <view class="modal-mask" v-if="showSettleModal" @click.self="showSettleModal = false" @touchmove.prevent>
      <view class="modal-content">
        <text class="modal-title">补录结算</text>
        <view class="modal-field">
          <text class="modal-label">到手价(¥) *</text>
          <input v-model="settleForm.received_amount" type="digit" placeholder="必填" class="modal-input" />
        </view>
        <view class="modal-field">
          <text class="modal-label">约定价(¥)</text>
          <input v-model="settleForm.agreed_price" type="digit" placeholder="选填" class="modal-input" />
        </view>
        <view class="modal-field">
          <text class="modal-label">结算状态</text>
          <view class="modal-pills">
            <view
              v-for="option in settlementStatusOptions"
              :key="option"
              class="modal-pill"
              :class="{ 'modal-pill--active': settleForm.settlement_status === option }"
              @click="settleForm.settlement_status = option"
            >
              <text>{{ option }}</text>
            </view>
          </view>
        </view>
        <view class="modal-actions">
          <button class="modal-btn" @click="showSettleModal = false">取消</button>
          <button class="modal-btn modal-btn--primary" :disabled="!settleForm.received_amount" @click="doSettle">确认</button>
        </view>
      </view>
    </view>

    <!-- 取消预定弹窗已迁移到 S-7 BSheet -->

    <!-- S-6: 退款表单 BSheet -->
    <BSheet :visible="showRefundSheet" title="退款" @update:visible="showRefundSheet = $event">
      <view class="sheet-form">
        <!-- 全额/部分退款 -->
        <view class="sheet-toggle">
          <view
            class="sheet-toggle__item"
            :class="{ 'sheet-toggle__item--active': refundSheetForm.type === 'full' }"
            @click="refundSheetForm.type = 'full'; refundSheetForm.refund_amount = String(sale?.received_amount || '')"
          >
            <text>全额退款</text>
          </view>
          <view
            class="sheet-toggle__item"
            :class="{ 'sheet-toggle__item--active': refundSheetForm.type === 'partial' }"
            @click="refundSheetForm.type = 'partial'; refundSheetForm.refund_amount = ''"
          >
            <text>部分退款</text>
          </view>
        </view>
        <!-- 退款金额 -->
        <view class="sheet-field">
          <text class="sheet-label">退款金额(¥) *</text>
          <input
            v-model="refundSheetForm.refund_amount"
            type="digit"
            :placeholder="`最多 ${sale?.received_amount || ''}`"
            class="sheet-input"
            :disabled="refundSheetForm.type === 'full'"
          />
        </view>
        <!-- 退款原因 -->
        <view class="sheet-field">
          <text class="sheet-label">退款原因</text>
          <view class="sheet-select" @click="showRefundReasonPicker = !showRefundReasonPicker">
            <text :style="{ color: refundSheetForm.refund_reason ? 'var(--text-1)' : 'var(--text-3)' }">
              {{ refundSheetForm.refund_reason || '选择原因' }}
            </text>
            <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">expand_more</text>
          </view>
          <view v-if="showRefundReasonPicker" class="sheet-options">
            <view
              v-for="r in refundReasons"
              :key="r"
              class="sheet-option"
              :class="{ 'sheet-option--active': refundSheetForm.refund_reason === r }"
              @click="refundSheetForm.refund_reason = r; showRefundReasonPicker = false"
            >
              <text>{{ r }}</text>
            </view>
          </view>
        </view>
        <!-- 退款日期 -->
        <view class="sheet-field">
          <text class="sheet-label">退款日期</text>
          <view class="sheet-select" @click="showRefundDatePicker = true">
            <text :style="{ color: refundDateText ? 'var(--text-1)' : 'var(--text-3)' }">
              {{ refundDateText || '选择日期' }}
            </text>
            <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
          </view>
        </view>
        <!-- 确认退款 -->
        <button
          class="sheet-btn sheet-btn--red"
          :disabled="!refundSheetForm.refund_amount"
          @click="doRefundSheet"
        >确认退款</button>
      </view>
    </BSheet>

    <!-- S-7: 定金取消 BSheet -->
    <BSheet :visible="showCancelSheet" title="取消预定" @update:visible="showCancelSheet = $event">
      <view class="sheet-form">
        <view class="sheet-field">
          <text class="sheet-label">取消原因</text>
          <input v-model="cancelSheetForm.reason" class="sheet-input" placeholder="输入取消原因" />
        </view>
        <view class="sheet-field">
          <text class="sheet-label">退还定金(¥)</text>
          <input
            v-model="cancelSheetForm.refund_amount"
            type="digit"
            :placeholder="`定金总额 ${sale?.deposit_amount || 0}`"
            class="sheet-input"
          />
          <text class="sheet-helper">留空或输入 0 表示不退还定金</text>
        </view>
        <button
          class="sheet-btn sheet-btn--red"
          @click="doCancelSheet"
        >确认取消预定</button>
      </view>
    </BSheet>

    <!-- S-8: 平台选择器已移除（定金/成交弹窗使用内联 pills） -->

    <!-- S-9: 代理人选择器 BSheet -->
    <BSheet :visible="showAgentSheet" title="选择代理人" @update:visible="showAgentSheet = $event">
      <view v-if="agentLoading" style="padding: 20px 0;">
        <BSkeleton :rows="3" />
      </view>
      <view v-else-if="agentList.length > 0" class="agent-select-list">
        <view
          v-for="agent in agentList"
          :key="agent._id"
          class="agent-select-item"
          :class="{ 'agent-select-item--active': agentSheetValue === agent._id }"
          @click="selectAgent(agent)"
        >
          <view class="agent-select-avatar">
            <text class="material-icons-round" style="color: #fff; font-size: 18px;">person</text>
          </view>
          <view class="agent-select-info">
            <text class="agent-select-name">{{ agent.name }}</text>
            <text v-if="agent.contact_info" class="agent-select-contact">{{ agent.contact_info }}</text>
          </view>
          <text v-if="agentSheetValue === agent._id" class="material-icons-round" style="font-size: 20px; color: var(--primary);">check_circle</text>
        </view>
      </view>
      <BEmpty v-else icon="handshake" title="暂无代理人" description="请先在设置中添加代理人" />
    </BSheet>

    <!-- S-10: 价格预警 BModal -->
    <BModal
      :visible="showPriceWarning"
      title="价格预警"
      confirmText="仍然继续"
      cancelText="返回修改"
      :danger="true"
      @update:visible="showPriceWarning = $event"
      @confirm="confirmPriceWarning"
      @cancel="showPriceWarning = false"
    >
      <view class="price-warn">
        <text class="material-icons-round price-warn__icon">warning</text>
        <text class="price-warn__msg">到手价低于底价</text>
        <view class="price-warn__compare">
          <view class="price-warn__row">
            <text class="price-warn__label">底价</text>
            <text class="price-warn__val">¥{{ sale?.floor_price?.toLocaleString() }}</text>
          </view>
          <view class="price-warn__row">
            <text class="price-warn__label">到手价</text>
            <text class="price-warn__val price-warn__val--red">¥{{ priceWarningReceived?.toLocaleString() }}</text>
          </view>
          <view class="price-warn__row">
            <text class="price-warn__label">差额</text>
            <text class="price-warn__val price-warn__val--red">-¥{{ ((sale?.floor_price || 0) - (priceWarningReceived || 0)).toLocaleString() }}</text>
          </view>
        </view>
      </view>
    </BModal>

    <BDateTimePicker
      v-model:visible="showDeliveryDatePicker"
      :model-value="completeForm.delivery_date"
      mode="date"
      value-type="timestamp"
      @confirm="onDeliveryDateConfirm"
    />

    <BDateTimePicker
      v-model:visible="showRefundDatePicker"
      :model-value="refundSheetForm.refund_date"
      mode="date"
      value-type="timestamp"
      @confirm="onRefundDateConfirm"
    />

    <!-- 退款弹窗已迁移到 S-6 BSheet -->
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import { getLocalSaleDetail, listLocalAgents } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BTag from '@/components/base/BTag.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BModal from '@/components/layout/BModal.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BDateTimePicker from '@/components/form/BDateTimePicker.vue'
import { formatDateInputValue } from '@/utils/date'

const { currentFamily } = useAuth()
usePageSync({ routePath: 'pages/sale/detail' })

const sale = ref<any>(null)
const saleId = ref('')

const showDepositModal = ref(false)
const showCompleteModal = ref(false)
const showSettleModal = ref(false)
const showDeliveryDatePicker = ref(false)
const showRefundDatePicker = ref(false)

const platforms = [
  { label: '线下', icon: 'storefront' },
  { label: '微信', icon: 'chat' },
  { label: '小红书', icon: 'auto_stories' },
  { label: '抖音', icon: 'music_note' },
  { label: '快手', icon: 'play_circle' },
  { label: '闲鱼', icon: 'shopping_bag' },
]
const platformLabels = platforms.map(p => p.label)
const settlementStatusOptions: Array<'已结算' | '部分结算'> = ['已结算', '部分结算']

/* S-6: 退款表单 */
const showRefundSheet = ref(false)
const showRefundReasonPicker = ref(false)
const refundReasons = ['质量问题', '买家反悔', '健康问题', '买卖双方协商', '其他']
const refundSheetForm = reactive({
  type: 'full' as 'full' | 'partial',
  refund_amount: '',
  refund_reason: '',
  refund_date: null as number | null,
})

/* S-7: 定金取消 */
const showCancelSheet = ref(false)
const cancelSheetForm = reactive({
  reason: '',
  refund_amount: '',
})

function openRefundSheet() {
  refundSheetForm.type = 'full'
  refundSheetForm.refund_amount = String(sale.value?.received_amount || '')
  refundSheetForm.refund_reason = ''
  refundSheetForm.refund_date = null
  showRefundSheet.value = true
}

function openCancelSheet() {
  cancelSheetForm.reason = ''
  cancelSheetForm.refund_amount = ''
  showCancelSheet.value = true
}

/* S-8: 平台选择器已移除（内联 pills 替代） */

/* S-9: 代理人选择器 */
const showAgentSheet = ref(false)
const agentSheetValue = ref('')
const agentList = ref<any[]>([])
const agentLoading = ref(false)
let agentCallback: ((agent: any) => void) | null = null

/* S-10: 价格预警 */
const showPriceWarning = ref(false)
const priceWarningReceived = ref<number | null>(null)
let priceWarningCallback: (() => void) | null = null

const depositForm = reactive({
  deposit_amount: '',
  agreed_price: '',
  buyer_info: '',
  platform: '',
  agent_id: '',
  agent_name: '',
})

const completeForm = reactive({
  received_amount: '',
  agreed_price: '',
  buyer_info: '',
  platform: '',
  delivery_date: null as number | null,
})

const settleForm = reactive({
  received_amount: '',
  agreed_price: '',
  settlement_status: '已结算' as '已结算' | '部分结算',
})

const deliveryDateText = computed(() => formatDateInputValue(completeForm.delivery_date))
const refundDateText = computed(() => formatDateInputValue(refundSheetForm.refund_date))

function onDeliveryDateConfirm(value: number | string) {
  if (typeof value !== 'number') return
  completeForm.delivery_date = value
}

function onRefundDateConfirm(value: number | string) {
  if (typeof value !== 'number') return
  refundSheetForm.refund_date = value
}

// cancelForm 和 refundForm 已迁移到 S-6/S-7 BSheet

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

const { run: receiveDeposit } = useCloudCall('finance-service', 'receiveSaleDeposit', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: completeSale } = useCloudCall('finance-service', 'completeSale', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: settleSale } = useCloudCall('finance-service', 'settleSale', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: cancelSale } = useCloudCall('finance-service', 'cancelSale', { successMode: 'silent', loadingMode: 'local', throwOnError: true })

function formatDate(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function load() {
  const familyId = currentFamily.value?._id || ''
  if (!familyId || !saleId.value) {
    sale.value = null
    return
  }
  localSyncRuntime.setCurrentFamilyId(familyId)
  const detail = await getLocalSaleDetail(familyId, saleId.value)
  sale.value = detail
  if (!detail) return
  completeForm.received_amount = ''
  completeForm.agreed_price = detail.agreed_price != null ? String(detail.agreed_price) : ''
  completeForm.buyer_info = detail.buyer_info || ''
  completeForm.platform = detail.platform || ''
  completeForm.delivery_date = null
}

async function refreshSale() {
  const familyId = currentFamily.value?._id || ''
  if (!familyId || !saleId.value) {
    await load()
    return
  }
  localSyncRuntime.setCurrentFamilyId(familyId)
  await localSyncRuntime.resume(familyId)
  await localSyncRuntime.forceSyncScope(`sale-detail:${saleId.value}`)
  await load()
}

function openSettleModal() {
  settleForm.received_amount = sale.value?.received_amount != null ? String(sale.value.received_amount) : ''
  settleForm.agreed_price = sale.value?.agreed_price != null ? String(sale.value.agreed_price) : ''
  settleForm.settlement_status = sale.value?.settlement_status === '部分结算' ? '部分结算' : '已结算'
  showSettleModal.value = true
}

async function doDeposit() {
  const res = await receiveDeposit(saleId.value, {
    deposit_amount: parseFloat(depositForm.deposit_amount),
    agreed_price: depositForm.agreed_price ? parseFloat(depositForm.agreed_price) : null,
    buyer_info: depositForm.buyer_info || null,
    platform: depositForm.platform || null,
    agent_id: depositForm.agent_id || null,
    agent_name: depositForm.agent_name || null,
  })
  if (res) {
    showDepositModal.value = false
    await refreshSale()
  }
}

async function doComplete() {
  const hasReceivedAmount = completeForm.received_amount.trim() !== ''
  const receivedAmount = hasReceivedAmount ? parseFloat(completeForm.received_amount) : null
  if (hasReceivedAmount && (!receivedAmount || receivedAmount <= 0)) return

  // 到手价低于底价时触发价格预警
  const deliveryDate = completeForm.delivery_date || null

  if (sale.value?.floor_price && receivedAmount != null && receivedAmount < sale.value.floor_price) {
    checkPriceWarning(receivedAmount, async () => {
      const res = await completeSale(saleId.value, {
        received_amount: receivedAmount,
        agreed_price: completeForm.agreed_price ? parseFloat(completeForm.agreed_price) : null,
        buyer_info: completeForm.buyer_info || null,
        platform: completeForm.platform || null,
        delivery_date: deliveryDate,
        date: Date.now(),
      })
      if (res) {
        showCompleteModal.value = false
        load()
      }
    })
    return
  }

  const res = await completeSale(saleId.value, {
    received_amount: receivedAmount,
    agreed_price: completeForm.agreed_price ? parseFloat(completeForm.agreed_price) : null,
    buyer_info: completeForm.buyer_info || null,
    platform: completeForm.platform || null,
    delivery_date: deliveryDate,
    date: Date.now(),
  })
  if (res) {
    showCompleteModal.value = false
    await refreshSale()
  }
}

async function doSettle() {
  const receivedAmount = parseFloat(settleForm.received_amount)
  if (!receivedAmount || receivedAmount <= 0) return
  const res = await settleSale(saleId.value, {
    received_amount: receivedAmount,
    agreed_price: settleForm.agreed_price ? parseFloat(settleForm.agreed_price) : null,
    settlement_status: settleForm.settlement_status,
    date: Date.now(),
  })
  if (res) {
    showSettleModal.value = false
    await refreshSale()
  }
}

// doCancel 和 doRefund 已迁移到 doCancelSheet 和 doRefundSheet

/* S-6 退款提交 */
async function doRefundSheet() {
  const amount = parseFloat(refundSheetForm.refund_amount)
  if (!amount || amount <= 0) return
  const res = await cancelSale(saleId.value, {
    refund_amount: amount,
    refund_reason: refundSheetForm.refund_reason || null,
    refund_date: refundSheetForm.refund_date || Date.now(),
  })
  if (res) {
    showRefundSheet.value = false
    await refreshSale()
  }
}

/* S-7 定金取消提交 */
async function doCancelSheet() {
  const refundAmt = cancelSheetForm.refund_amount ? parseFloat(cancelSheetForm.refund_amount) : 0
  const kept = (sale.value?.deposit_amount || 0) - refundAmt
  const res = await cancelSale(saleId.value, {
    deposit_kept_amount: kept > 0 ? kept : 0,
    refund_reason: cancelSheetForm.reason || null,
  })
  if (res) {
    showCancelSheet.value = false
    await refreshSale()
  }
}

async function openAgentSheet(currentId: string, cb: (agent: any) => void) {
  const familyId = currentFamily.value?._id || ''
  agentSheetValue.value = currentId
  agentCallback = cb
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
  agentSheetValue.value = agent._id
  if (agentCallback) agentCallback(agent)
  showAgentSheet.value = false
}

/* S-10 价格预警 */
function checkPriceWarning(receivedAmount: number, onConfirm: () => void) {
  if (sale.value?.floor_price && receivedAmount < sale.value.floor_price) {
    priceWarningReceived.value = receivedAmount
    priceWarningCallback = onConfirm
    showPriceWarning.value = true
    return true
  }
  return false
}

function confirmPriceWarning() {
  showPriceWarning.value = false
  if (priceWarningCallback) priceWarningCallback()
}

onLoad((options: any) => {
  if (options?.id) {
    saleId.value = options.id
    void load()
  }
})

onShow(() => {
  if (saleId.value) {
    void load()
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

/* ==================== SHEET FORM (S-6, S-7) ==================== */
.sheet-form {
  padding-bottom: 20px;
}

.sheet-field {
  margin-bottom: 16px;
}

.sheet-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 8px;
  display: block;
}

.sheet-input {
  width: 100%;
  height: 44px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  padding: 0 14px;
  font-size: 15px;
  color: var(--text-1);
  background: var(--bg);
  transition: border-color 0.2s;
  &:focus { border-color: var(--primary); }
  &[disabled] { opacity: 0.6; background: var(--card-dim); }
}

.sheet-select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  padding: 0 14px;
  background: var(--bg);
  font-size: 14px;
}

.sheet-options {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sheet-option {
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

.sheet-helper {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 6px;
  display: block;
}

.sheet-toggle {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;

  &__item {
    flex: 1;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-btn);
    font-size: 13px;
    font-weight: 600;
    background: var(--card-dim);
    color: var(--text-2);
    transition: all 0.15s ease;
    &:active { transform: scale(0.94); }

    &--active {
      background: var(--primary);
      color: #fff;
    }
  }
}

.sheet-btn {
  width: 100%;
  height: 48px;
  border-radius: var(--radius-btn);
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  border: none;
  color: #fff;
  margin-top: 20px;
  transition: all 0.12s ease;
  &:active { transform: scale(0.97); opacity: 0.9; }
  &[disabled] { opacity: 0.5; }

  &--red { background: var(--red); }
  &--primary { background: var(--primary); }
}

/* ==================== PLATFORM GRID (S-8) ==================== */
.platform-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding-bottom: 20px;

  &__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 8px;
    border-radius: var(--radius-card);
    background: var(--bg);
    transition: all 0.15s ease;
    &:active { transform: scale(0.94); }

    &--active {
      background: var(--primary-soft);
      border: 1.5px solid var(--primary);
    }
  }

  &__icon {
    font-family: 'Material Icons Round';
    font-size: 28px;
    color: var(--text-2);
    .platform-grid__item--active & { color: var(--primary); }
  }

  &__label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1);
  }
}

/* ==================== AGENT SELECT LIST (S-9) ==================== */
.agent-select-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 20px;
}

.agent-select-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-row);
  background: var(--bg);
  transition: all 0.15s ease;
  &:active { transform: scale(0.975); }

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

.agent-select-info { flex: 1; min-width: 0; }

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

/* ==================== PRICE WARNING (S-10) ==================== */
.price-warn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0 4px;

  &__icon {
    font-family: 'Material Icons Round';
    font-size: 40px;
    color: var(--amber);
    margin-bottom: 8px;
  }

  &__msg {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
    margin-bottom: 16px;
  }

  &__compare {
    width: 100%;
    background: var(--bg);
    border-radius: var(--radius-date);
    padding: 12px 16px;
  }

  &__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    &:not(:last-child) { border-bottom: 1px solid var(--card-dim); }
  }

  &__label {
    font-size: 13px;
    color: var(--text-3);
  }

  &__val {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);

    &--red { color: var(--red); }
  }
}
</style>
