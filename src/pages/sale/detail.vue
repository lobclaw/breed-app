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
              <view class="stepper-line__fill" :style="stepperFillStyle" />
            </view>
            <!-- 待售 -->
            <view class="stepper-step">
              <view class="stepper-dot" :class="getStepperDotClass(0)">
                <text v-if="stepIndex >= 0" class="material-icons-round" style="font-size: 16px; color: #fff;">check</text>
                <text v-else>1</text>
              </view>
              <text class="stepper-label" :class="getStepperLabelClass(0)">待售</text>
              <text v-if="sale.floor_price" class="stepper-amount">¥{{ sale.floor_price?.toLocaleString() }}</text>
            </view>
            <!-- 已预定 -->
            <view class="stepper-step">
              <view class="stepper-dot" :class="getStepperDotClass(1)">
                <text v-if="stepIndex >= 1" class="material-icons-round" style="font-size: 16px; color: #fff;">check</text>
                <text v-else>2</text>
              </view>
              <text class="stepper-label" :class="getStepperLabelClass(1)">已预定</text>
              <text v-if="sale.deposit_amount" class="stepper-amount" style="color: var(--red);">定金 ¥{{ sale.deposit_amount?.toLocaleString() }}</text>
            </view>
            <!-- 终态 -->
            <view class="stepper-step">
              <view class="stepper-dot" :class="getStepperDotClass(2)">
                <text v-if="stepIndex >= 2" class="material-icons-round" style="font-size: 16px; color: #fff;">{{ finalStepIcon }}</text>
                <text v-else>3</text>
              </view>
              <text class="stepper-label" :class="getStepperLabelClass(2)">{{ finalStepLabel }}</text>
              <text v-if="finalStepAmountText" class="stepper-amount" :style="{ color: finalStepAmountColor }">{{ finalStepAmountText }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 价格详情 -->
      <view v-if="hasPriceDetails" class="detail-section">
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
            <text class="detail-label">{{ agreedPriceLabel }}</text>
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
            <text class="detail-label">{{ refundDateLabel }}</text>
            <text class="detail-value">{{ formatDate(sale.refund_date) }}</text>
          </view>
          <view class="detail-row" v-if="depositRefundAmount != null">
            <text class="detail-label">退还定金</text>
            <text class="detail-value">¥{{ depositRefundAmount.toLocaleString() }}</text>
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
          <view
            class="detail-row"
            :class="{ 'detail-row--action': canEditSaleMode }"
            @click="openSaleModeSheet"
          >
            <text class="detail-label">销售方式</text>
            <view class="detail-action-value">
              <text class="detail-value">{{ saleModeText }}</text>
              <text v-if="canEditSaleMode" class="material-icons-round detail-action-icon">chevron_right</text>
            </view>
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
      <view class="sale-action-area" v-if="sale.status === '待售'">
        <button class="action-btn action-btn--ghost" @click="openDepositModal">收定金</button>
        <button class="action-btn action-btn--primary" @click="openCompleteModal">直接成交</button>
      </view>

      <view class="sale-action-area" v-if="sale.status === '已预定'">
        <button class="action-btn action-btn--primary" @click="openCompleteModal">完成交易</button>
        <button class="action-btn action-btn--ghost-red" @click="openCancelSheet">取消预定</button>
      </view>

      <view class="sale-action-area" v-if="sale.status === '已成交' && (sale.settlement_status !== '已结算' || canRefund)">
        <button
          v-if="sale.settlement_status !== '已结算'"
          class="action-btn action-btn--primary"
          @click="openSettleModal"
        >补录结算</button>
        <button v-if="canRefund" class="action-btn action-btn--ghost-red" @click="openRefundSheet">退款</button>
      </view>
    </template>

    <!-- 收定金 Sheet -->
    <BSheet :visible="showDepositModal" title="收定金" @update:visible="showDepositModal = $event">
      <view class="sale-flow-form">
        <view class="sale-flow-field">
          <text class="sale-flow-label">定金金额</text>
          <view class="sheet-amount-input">
            <text class="sheet-amount-input__symbol">¥</text>
            <input v-model="depositForm.deposit_amount" type="digit" placeholder="请输入金额" class="sheet-amount-input__control" />
          </view>
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">约定价（选填）</text>
          <view class="sheet-amount-input">
            <text class="sheet-amount-input__symbol">¥</text>
            <input v-model="depositForm.agreed_price" type="digit" placeholder="请输入金额" class="sheet-amount-input__control" />
          </view>
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">买家信息（选填）</text>
          <input v-model="depositForm.buyer_info" placeholder="填写姓名、微信或备注" class="sale-flow-input" />
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">销售方式</text>
          <view class="sale-flow-pills">
            <view
              v-for="option in saleModeOptions"
              :key="option.label"
              class="sale-flow-pill"
              :class="{ 'sale-flow-pill--active': depositForm.sale_mode === option.value }"
              @click="depositForm.sale_mode = option.value"
            >
              <text>{{ option.label }}</text>
            </view>
          </view>
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">平台（选填）</text>
          <view class="sale-flow-pills">
            <view
              v-for="p in platformLabels"
              :key="p"
              class="sale-flow-pill"
              :class="{ 'sale-flow-pill--active': depositForm.platform === p }"
              @click="depositForm.platform = depositForm.platform === p ? '' : p"
            >
              <text>{{ p }}</text>
            </view>
          </view>
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">选择代理人（选填）</text>
          <view class="sale-flow-select" @click="openAgentSheet(depositForm.agent_id, (agent) => { depositForm.agent_id = agent._id; depositForm.agent_name = agent.name })">
            <text class="sale-flow-select__text" :class="{ 'sale-flow-select__text--placeholder': !depositForm.agent_name }">
              {{ depositForm.agent_name || '选择代理人' }}
            </text>
            <text class="material-icons-round sale-flow-select__icon">chevron_right</text>
          </view>
        </view>
      </view>
      <template #footer>
        <view class="sale-flow-footer">
          <button class="sale-flow-submit sale-flow-submit--primary" :disabled="!depositForm.deposit_amount" @click="doDeposit">确认收定金</button>
        </view>
      </template>
    </BSheet>

    <!-- 完成交易 Sheet -->
    <BSheet :visible="showCompleteModal" title="完成交易" @update:visible="showCompleteModal = $event">
      <view class="sale-flow-form">
        <view class="sale-flow-field">
          <text class="sale-flow-label">到手价（选填）</text>
          <view class="sheet-amount-input">
            <text class="sheet-amount-input__symbol">¥</text>
            <input v-model="completeForm.received_amount" type="digit" placeholder="结算后再补可留空" class="sheet-amount-input__control" />
          </view>
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">约定价（选填）</text>
          <view class="sheet-amount-input">
            <text class="sheet-amount-input__symbol">¥</text>
            <input v-model="completeForm.agreed_price" type="digit" placeholder="请输入金额" class="sheet-amount-input__control" />
          </view>
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">买家信息（选填）</text>
          <input v-model="completeForm.buyer_info" placeholder="填写姓名、微信或备注" class="sale-flow-input" />
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">销售方式</text>
          <view class="sale-flow-pills">
            <view
              v-for="option in saleModeOptions"
              :key="option.label"
              class="sale-flow-pill"
              :class="{ 'sale-flow-pill--active': completeForm.sale_mode === option.value }"
              @click="completeForm.sale_mode = option.value"
            >
              <text>{{ option.label }}</text>
            </view>
          </view>
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">平台（选填）</text>
          <view class="sale-flow-pills">
            <view
              v-for="p in platformLabels"
              :key="p"
              class="sale-flow-pill"
              :class="{ 'sale-flow-pill--active': completeForm.platform === p }"
              @click="completeForm.platform = completeForm.platform === p ? '' : p"
            >
              <text>{{ p }}</text>
            </view>
          </view>
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">交付日期（选填）</text>
          <view class="sale-flow-select" @click="showDeliveryDatePicker = true">
            <text class="sale-flow-select__text" :class="{ 'sale-flow-select__text--placeholder': !deliveryDateText }">
              {{ deliveryDateText || '选择日期' }}
            </text>
            <text class="material-icons-round sale-flow-select__icon">calendar_today</text>
          </view>
        </view>
      </view>
      <template #footer>
        <view class="sale-flow-footer">
          <button class="sale-flow-submit sale-flow-submit--primary" @click="doComplete">确认成交</button>
        </view>
      </template>
    </BSheet>

    <!-- 补录结算 Sheet -->
    <BSheet :visible="showSettleModal" title="补录结算" @update:visible="showSettleModal = $event">
      <view class="sale-flow-form">
        <view class="sale-flow-field">
          <text class="sale-flow-label">到手价</text>
          <view class="sheet-amount-input">
            <text class="sheet-amount-input__symbol">¥</text>
            <input v-model="settleForm.received_amount" type="digit" placeholder="请输入金额" class="sheet-amount-input__control" />
          </view>
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">约定价（选填）</text>
          <view class="sheet-amount-input">
            <text class="sheet-amount-input__symbol">¥</text>
            <input v-model="settleForm.agreed_price" type="digit" placeholder="请输入金额" class="sheet-amount-input__control" />
          </view>
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">结算状态</text>
          <view class="sale-flow-pills sale-flow-pills--segmented">
            <view
              v-for="option in settlementStatusOptions"
              :key="option"
              class="sale-flow-pill"
              :class="{ 'sale-flow-pill--active': settleForm.settlement_status === option }"
              @click="settleForm.settlement_status = option"
            >
              <text>{{ option }}</text>
            </view>
          </view>
        </view>
      </view>
      <template #footer>
        <view class="sale-flow-footer">
          <button class="sale-flow-submit sale-flow-submit--primary" :disabled="!settleForm.received_amount" @click="doSettle">确认结算</button>
        </view>
      </template>
    </BSheet>

    <!-- 修改销售方式 Sheet -->
    <BSheet :visible="showSaleModeSheet" title="修改销售方式" @update:visible="showSaleModeSheet = $event">
      <view class="sale-flow-form">
        <view class="sale-flow-field">
          <text class="sale-flow-label">销售方式</text>
          <view class="sale-flow-pills">
            <view
              v-for="option in saleModeOptions"
              :key="option.label"
              class="sale-flow-pill"
              :class="{ 'sale-flow-pill--active': saleModeForm.sale_mode === option.value }"
              @click="saleModeForm.sale_mode = option.value"
            >
              <text>{{ option.label }}</text>
            </view>
          </view>
        </view>
      </view>
      <template #footer>
        <view class="sale-flow-footer">
          <button class="sale-flow-submit sale-flow-submit--primary" @click="doUpdateSaleMode">保存</button>
        </view>
      </template>
    </BSheet>

    <!-- 取消预定弹窗已迁移到 S-7 BSheet -->

    <!-- S-6: 退款表单 BSheet -->
    <BSheet :visible="showRefundSheet" title="退款" @update:visible="showRefundSheet = $event">
      <view class="sale-flow-form">
        <view class="sale-flow-toggle">
          <view
            class="sale-flow-toggle__item"
            :class="{ 'sale-flow-toggle__item--active': refundSheetForm.type === 'full' }"
            @click="refundSheetForm.type = 'full'; refundSheetForm.refund_amount = String(sale?.received_amount || '')"
          >
            <text>全额退款</text>
          </view>
          <view
            class="sale-flow-toggle__item"
            :class="{ 'sale-flow-toggle__item--active': refundSheetForm.type === 'partial' }"
            @click="refundSheetForm.type = 'partial'; refundSheetForm.refund_amount = ''"
          >
            <text>部分退款</text>
          </view>
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">退款金额</text>
          <view class="sheet-amount-input" :class="{ 'sheet-amount-input--disabled': refundSheetForm.type === 'full' }">
            <text class="sheet-amount-input__symbol">¥</text>
            <input
              v-model="refundSheetForm.refund_amount"
              type="digit"
              :placeholder="`最多 ${sale?.received_amount || ''}`"
              class="sheet-amount-input__control"
              :disabled="refundSheetForm.type === 'full'"
            />
          </view>
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">退款原因（选填）</text>
          <view class="sale-flow-pills">
            <view
              v-for="r in refundReasons"
              :key="r"
              class="sale-flow-pill"
              :class="{ 'sale-flow-pill--active': refundSheetForm.refund_reason === r }"
              @click="refundSheetForm.refund_reason = r"
            >
              <text>{{ r }}</text>
            </view>
          </view>
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">退款日期（选填）</text>
          <view class="sale-flow-select" @click="showRefundDatePicker = true">
            <text class="sale-flow-select__text" :class="{ 'sale-flow-select__text--placeholder': !refundDateText }">
              {{ refundDateText || '选择日期' }}
            </text>
            <text class="material-icons-round sale-flow-select__icon">calendar_today</text>
          </view>
        </view>
      </view>
      <template #footer>
        <view class="sale-flow-footer">
          <button
            class="sale-flow-submit sale-flow-submit--red"
            :disabled="!refundSheetForm.refund_amount"
            @click="doRefundSheet"
          >确认退款</button>
        </view>
      </template>
    </BSheet>

    <!-- S-7: 定金取消 BSheet -->
    <BSheet :visible="showCancelSheet" title="取消预定" @update:visible="showCancelSheet = $event">
      <view class="sale-flow-form">
        <view class="sale-flow-field">
          <text class="sale-flow-label">取消原因（选填）</text>
          <input v-model="cancelSheetForm.reason" class="sale-flow-input" placeholder="输入取消原因" />
        </view>
        <view class="sale-flow-field">
          <text class="sale-flow-label">退还定金（选填）</text>
          <view class="sheet-amount-input">
            <text class="sheet-amount-input__symbol">¥</text>
            <input
              v-model="cancelSheetForm.refund_amount"
              type="digit"
              :placeholder="`定金总额 ${sale?.deposit_amount || 0}`"
              class="sheet-amount-input__control"
            />
          </view>
          <text class="sale-flow-helper">留空或输入 0 表示不退还定金</text>
        </view>
      </view>
      <template #footer>
        <view class="sale-flow-footer">
          <button
            class="sale-flow-submit sale-flow-submit--red"
            @click="doCancelSheet"
          >确认取消预定</button>
        </view>
      </template>
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

type SaleMode = '自售' | '代理' | '代卖' | null

const saleModeOptions: Array<{ label: string; value: SaleMode }> = [
  { label: '待定', value: null },
  { label: '自售', value: '自售' },
  { label: '代理', value: '代理' },
  { label: '代卖', value: '代卖' },
]

const sale = ref<any>(null)
const saleId = ref('')

const showDepositModal = ref(false)
const showCompleteModal = ref(false)
const showSettleModal = ref(false)
const showSaleModeSheet = ref(false)
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
  if (!canRefund.value) return
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
  sale_mode: null as SaleMode,
  platform: '',
  agent_id: '',
  agent_name: '',
})

const completeForm = reactive({
  received_amount: '',
  agreed_price: '',
  buyer_info: '',
  sale_mode: null as SaleMode,
  platform: '',
  delivery_date: null as number | null,
})

const settleForm = reactive({
  received_amount: '',
  agreed_price: '',
  settlement_status: '已结算' as '已结算' | '部分结算',
})

const saleModeForm = reactive({
  sale_mode: null as SaleMode,
})

const deliveryDateText = computed(() => formatDateInputValue(completeForm.delivery_date))
const refundDateText = computed(() => formatDateInputValue(refundSheetForm.refund_date))

const hasPriceDetails = computed(() => {
  const detail = sale.value
  if (!detail) return false
  return Boolean(
    detail.floor_price
    || detail.deposit_amount
    || detail.agreed_price
    || detail.received_amount != null
    || detail.refund_amount
    || detail.refund_date
    || (detail.deposit_kept_amount != null && detail.status === '定金取消')
  )
})

const canRefund = computed(() => Number(sale.value?.received_amount || 0) > 0)
const canEditSaleMode = computed(() => ['待售', '已预定', '已成交'].includes(String(sale.value?.status || '')))
const saleModeText = computed(() => formatSaleMode(sale.value?.sale_mode))
const isDepositCancelled = computed(() => sale.value?.status === '定金取消')
const agreedPriceLabel = computed(() => isDepositCancelled.value ? '约定成交价' : '成交价')
const refundDateLabel = computed(() => isDepositCancelled.value ? '取消日期' : '退款日期')
const depositRefundAmount = computed(() => {
  const detail = sale.value
  if (!detail || detail.status !== '定金取消' || detail.deposit_kept_amount == null) return null
  const depositAmount = Number(detail.deposit_amount || 0)
  const keptAmount = Number(detail.deposit_kept_amount || 0)
  if (!Number.isFinite(depositAmount) || !Number.isFinite(keptAmount)) return null
  return Math.max(0, depositAmount - keptAmount)
})
const finalStepLabel = computed(() => {
  const status = sale.value?.status
  if (status === '定金取消') return '定金取消'
  if (status === '已退款') return '已退款'
  return '已成交'
})
const finalStepIcon = computed(() => {
  const status = sale.value?.status
  return status === '定金取消' || status === '已退款' ? 'close' : 'check'
})
const finalStepAmountText = computed(() => {
  const detail = sale.value
  if (!detail) return ''
  if (detail.status === '定金取消') {
    if (detail.deposit_kept_amount == null) return ''
    const keptAmount = Number(detail.deposit_kept_amount || 0)
    return keptAmount > 0 ? `保留 ¥${keptAmount.toLocaleString()}` : '全额退还'
  }
  if (detail.status === '已退款' && detail.refund_amount) {
    return `退款 ¥${Number(detail.refund_amount).toLocaleString()}`
  }
  if (detail.received_amount != null) {
    return `到手 ¥${Number(detail.received_amount).toLocaleString()}`
  }
  if (detail.status === '已成交' && detail.settlement_status) return detail.settlement_status
  return ''
})
const finalStepAmountColor = computed(() => {
  const status = sale.value?.status
  if (status === '已退款') return 'var(--green)'
  if (status === '定金取消') return 'var(--text-3)'
  if (sale.value?.status === '已成交' && sale.value?.received_amount == null) return 'var(--amber)'
  return 'var(--red)'
})

type SaleStatusTone = 'amber' | 'blue' | 'green' | 'red' | 'gray'

function normalizeSaleModeValue(mode?: string | null): SaleMode {
  const normalized = String(mode || '').trim()
  return normalized === '自售' || normalized === '代理' || normalized === '代卖' ? normalized : null
}

function formatSaleMode(mode?: string | null) {
  return normalizeSaleModeValue(mode) || '待定'
}

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
    '定金取消': 2,
  }
  return map[sale.value.status] ?? -1
})

const stepperFillWidth = computed(() => {
  if (stepIndex.value >= 2) return '100%'
  if (stepIndex.value >= 1) return '50%'
  return '0%'
})

const stepperFillStyle = computed(() => ({
  width: stepperFillWidth.value,
  background: getSaleStatusTone(sale.value?.status) === 'gray'
    ? 'var(--text-3)'
    : `var(--${getSaleStatusTone(sale.value?.status)})`,
}))

function getSaleStatusTone(status?: string): SaleStatusTone {
  const map: Record<string, SaleStatusTone> = {
    '待售': 'amber',
    '已预定': 'blue',
    '已成交': 'green',
    '已退款': 'red',
    '定金取消': 'gray',
  }
  return map[status || ''] || 'amber'
}

function getStepperTone(step: number): SaleStatusTone {
  if (sale.value?.status === '已退款' && step === 2) return 'red'
  if (sale.value?.status === '定金取消' && step === 2) return 'gray'
  if (step === 0) return 'amber'
  if (step === 1) return 'blue'
  return 'green'
}

function getStepperDotClass(step: number) {
  const active = stepIndex.value >= step
  const tone = getStepperTone(step)
  return {
    [`stepper-dot--${tone}`]: active,
  }
}

function getStepperLabelClass(step: number) {
  const active = stepIndex.value >= step
  const tone = getStepperTone(step)
  return {
    [`stepper-label--${tone}`]: active,
  }
}

function getStatusTagColor(status: string): 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal' | 'primary' | 'gray' {
  const map: Record<string, any> = {
    '待售': 'amber',
    '已预定': 'blue',
    '已成交': 'green',
    '已退款': 'red',
    '定金取消': 'gray',
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
  completeForm.sale_mode = normalizeSaleModeValue(detail.sale_mode)
  completeForm.platform = detail.platform || ''
  completeForm.delivery_date = null
}

async function refreshSale() {
  await load()
}

function openSettleModal() {
  settleForm.received_amount = sale.value?.received_amount != null ? String(sale.value.received_amount) : ''
  settleForm.agreed_price = sale.value?.agreed_price != null ? String(sale.value.agreed_price) : ''
  settleForm.settlement_status = sale.value?.settlement_status === '部分结算' ? '部分结算' : '已结算'
  showSettleModal.value = true
}

function openDepositModal() {
  depositForm.deposit_amount = ''
  depositForm.agreed_price = sale.value?.agreed_price != null ? String(sale.value.agreed_price) : ''
  depositForm.buyer_info = sale.value?.buyer_info || ''
  depositForm.sale_mode = normalizeSaleModeValue(sale.value?.sale_mode)
  depositForm.platform = sale.value?.platform || ''
  depositForm.agent_id = sale.value?.seller_agent_id || ''
  depositForm.agent_name = sale.value?.seller_agent_name || sale.value?.agent_name || ''
  showDepositModal.value = true
}

function openCompleteModal() {
  completeForm.received_amount = ''
  completeForm.agreed_price = sale.value?.agreed_price != null ? String(sale.value.agreed_price) : ''
  completeForm.buyer_info = sale.value?.buyer_info || ''
  completeForm.sale_mode = normalizeSaleModeValue(sale.value?.sale_mode)
  completeForm.platform = sale.value?.platform || ''
  completeForm.delivery_date = null
  showCompleteModal.value = true
}

function openSaleModeSheet() {
  if (!canEditSaleMode.value) return
  saleModeForm.sale_mode = normalizeSaleModeValue(sale.value?.sale_mode)
  showSaleModeSheet.value = true
}

async function doDeposit() {
  const familyId = currentFamily.value?._id || ''
  localSyncRuntime.setCurrentFamilyId(familyId)
  const res = await localSyncRuntime.receiveSaleDepositLocally(familyId, saleId.value, {
    deposit_amount: parseFloat(depositForm.deposit_amount),
    agreed_price: depositForm.agreed_price ? parseFloat(depositForm.agreed_price) : null,
    buyer_info: depositForm.buyer_info || null,
    sale_mode: depositForm.sale_mode,
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
      const familyId = currentFamily.value?._id || ''
      localSyncRuntime.setCurrentFamilyId(familyId)
      const res = await localSyncRuntime.completeSaleLocally(familyId, saleId.value, {
        received_amount: receivedAmount,
        agreed_price: completeForm.agreed_price ? parseFloat(completeForm.agreed_price) : null,
        buyer_info: completeForm.buyer_info || null,
        sale_mode: completeForm.sale_mode,
        platform: completeForm.platform || null,
        delivery_date: deliveryDate,
        date: Date.now(),
      })
      if (res) {
        showCompleteModal.value = false
        await refreshSale()
      }
    })
    return
  }

  const familyId = currentFamily.value?._id || ''
  localSyncRuntime.setCurrentFamilyId(familyId)
  const res = await localSyncRuntime.completeSaleLocally(familyId, saleId.value, {
    received_amount: receivedAmount,
    agreed_price: completeForm.agreed_price ? parseFloat(completeForm.agreed_price) : null,
    buyer_info: completeForm.buyer_info || null,
    sale_mode: completeForm.sale_mode,
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
  const familyId = currentFamily.value?._id || ''
  localSyncRuntime.setCurrentFamilyId(familyId)
  const res = await localSyncRuntime.settleSaleLocally(familyId, saleId.value, {
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

async function doUpdateSaleMode() {
  const familyId = currentFamily.value?._id || ''
  localSyncRuntime.setCurrentFamilyId(familyId)
  const res = await localSyncRuntime.updateSaleModeLocally(familyId, saleId.value, {
    sale_mode: saleModeForm.sale_mode,
  })
  if (res) {
    showSaleModeSheet.value = false
    await refreshSale()
  }
}

// doCancel 和 doRefund 已迁移到 doCancelSheet 和 doRefundSheet

/* S-6 退款提交 */
async function doRefundSheet() {
  const amount = parseFloat(refundSheetForm.refund_amount)
  if (!amount || amount <= 0) return
  const receivedAmount = Number(sale.value?.received_amount || 0)
  if (!receivedAmount || amount > receivedAmount) {
    uni.showToast({ title: '退款金额不能超过到手价', icon: 'none' })
    return
  }
  const familyId = currentFamily.value?._id || ''
  localSyncRuntime.setCurrentFamilyId(familyId)
  const res = await localSyncRuntime.cancelSaleLocally(familyId, saleId.value, {
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
  const depositAmount = Number(sale.value?.deposit_amount || 0)
  const refundAmt = cancelSheetForm.refund_amount ? parseFloat(cancelSheetForm.refund_amount) : 0
  if (!Number.isFinite(refundAmt) || refundAmt < 0 || refundAmt > depositAmount) {
    uni.showToast({ title: '退还定金不能超过定金总额', icon: 'none' })
    return
  }
  const kept = depositAmount - refundAmt
  const familyId = currentFamily.value?._id || ''
  localSyncRuntime.setCurrentFamilyId(familyId)
  const res = await localSyncRuntime.cancelSaleLocally(familyId, saleId.value, {
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

  &--amber { background: var(--amber); color: #fff; }
  &--blue { background: var(--blue); color: #fff; }
  &--green { background: var(--green); color: #fff; }
  &--red { background: var(--red); color: #fff; }
  &--gray { background: var(--text-3); color: #fff; }
}

.stepper-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  text-align: center;
  line-height: 1.3;

  &--amber { color: var(--amber); }
  &--blue { color: var(--blue); }
  &--green { color: var(--green); }
  &--red { color: var(--red); }
  &--gray { color: var(--text-3); }
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

  &--action {
    cursor: pointer;
  }
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

.detail-action-value {
  display: flex;
  align-items: center;
  gap: 4px;
}

.detail-action-icon {
  font-size: 18px;
  color: var(--text-3);
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
.sale-action-area {
  padding: 2px 16px 24px;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 12px;
}

.action-btn {
  flex: 1;
  min-width: 0;
  width: auto;
  height: 48px;
  margin: 0;
  border-radius: 16px;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  border: none;
  box-sizing: border-box;
  transition: all 0.12s ease;
  padding: 0;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  &:active { transform: scale(0.97); opacity: 0.9; }

  &::after {
    border: none;
  }

  &--primary {
    background: var(--primary);
    color: #fff;
    box-shadow: 0 8px 18px rgba(234, 62, 119, 0.2);
  }

  &--ghost {
    background: var(--card);
    border: 1.5px solid rgba(184, 160, 140, 0.38);
    color: var(--text-2);
  }

  &--ghost-red {
    background: var(--card);
    border: 1.5px solid rgba(224, 82, 82, 0.28);
    color: var(--red);
  }
}

/* ==================== SALE FLOW SHEETS ==================== */
.sale-flow-form {
  padding-bottom: 12px;
}

.sale-flow-field {
  margin-bottom: 16px;
}

.sale-flow-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
  margin-bottom: 8px;
  display: block;
}

.sheet-amount-input {
  width: 100%;
  height: 56px;
  box-sizing: border-box;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg);
  transition: border-color 0.16s ease, background 0.16s ease;

  &:focus-within {
    border-color: rgba(234, 62, 119, 0.42);
    background: var(--card);
  }

  &--disabled {
    background: var(--card-dim);
  }
}

.sheet-amount-input__symbol {
  flex: 0 0 auto;
  font-family: var(--font-display);
  font-size: 21px;
  font-weight: 800;
  line-height: 1;
  color: var(--text-3);
}

.sheet-amount-input__control {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  background: transparent;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1;
  padding: 0;
}

.sale-flow-input,
.sale-flow-select {
  width: 100%;
  height: 48px;
  box-sizing: border-box;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  padding: 0 14px;
  background: var(--bg);
  font-size: 14px;
  color: var(--text-1);
  transition: border-color 0.16s ease, background 0.16s ease, transform 0.12s ease;
}

.sale-flow-input:focus {
  border-color: rgba(234, 62, 119, 0.42);
  background: var(--card);
}

.sale-flow-select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;

  &:active {
    transform: scale(0.99);
    border-color: rgba(234, 62, 119, 0.36);
    background: var(--card);
  }
}

.sale-flow-select__text {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: var(--text-1);

  &--placeholder {
    color: var(--text-3);
  }
}

.sale-flow-select__icon {
  flex: 0 0 auto;
  font-size: 18px;
  line-height: 1;
  color: var(--text-3);
}

.sale-flow-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  &--segmented {
    flex-wrap: nowrap;
  }

  &--segmented .sale-flow-pill {
    flex: 1;
    justify-content: center;
  }
}

.sale-flow-pill {
  min-height: 34px;
  box-sizing: border-box;
  padding: 7px 16px;
  border-radius: var(--radius-pill);
  background: var(--card-dim);
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease, color 0.12s ease;

  &:active {
    transform: scale(0.94);
  }

  &--active {
    background: var(--primary);
    border-color: var(--primary);
    color: #fff;
  }
}

.sale-flow-toggle {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
}

.sale-flow-toggle__item {
  flex: 1;
  min-width: 0;
  height: 48px;
  border-radius: var(--radius-btn);
  background: var(--card-dim);
  color: var(--text-2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  transition: transform 0.12s ease, background 0.12s ease, color 0.12s ease;

  &:active {
    transform: scale(0.96);
  }

  &--active {
    background: var(--primary);
    color: #fff;
  }
}

.sale-flow-helper {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 6px;
  display: block;
}

.sale-flow-footer {
  padding: 10px var(--space-page) calc(env(safe-area-inset-bottom, 0px) + 12px);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), var(--card) 22%);
}

.sale-flow-submit {
  width: 100%;
  height: 52px;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-btn);
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s ease, opacity 0.12s ease;

  &:active {
    transform: scale(0.97);
    opacity: 0.9;
  }

  &::after {
    border: none;
  }

  &[disabled] {
    opacity: 0.5;
  }

  &--primary {
    background: var(--primary);
  }

  &--red {
    background: var(--red);
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
