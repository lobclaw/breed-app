<template>
  <view class="home">
    <!-- Header: 问候 + 头像 -->
    <view class="header">
        <view class="header-top">
        <view class="greeting-text">
          <text class="greeting-title">{{ greetingText }}</text>
          <text class="greeting-sub">{{ greetingSubText }}</text>
        </view>
        <view class="avatar">
          <text class="material-icons-round" style="color: #fff; font-size: 22px;">pets</text>
        </view>
      </view>
      <!-- 摘要 Pills: 逾期 / 流程 / 提醒 / 疗程 -->
      <view class="summary-pills">
        <view
          v-for="pill in summaryPills"
          :key="pill.key"
          class="pill"
          :class="pill.pillClass"
          @click="scrollToSection(pill.key)"
        >
          <view class="pill-dot" :style="{ background: pill.dotColor }" />
          <text class="pill-label">{{ pill.label }}</text>
          <text class="pill-num">{{ pill.count }}</text>
        </view>
      </view>
    </view>

    <!-- 7天预览条 -->
    <WeekStrip
      :selected-date="selectedDate"
      :day-counts="dayCounts"
      @select="onDateSelect"
      @jump-today="jumpToToday"
      @toggle-calendar="toggleCalendar"
    />

    <BSubmitToast
      :message="submitToastMessage"
      :dismissing="submitToastClosing"
    />

    <!-- 智能卡片区 -->
    <scroll-view scroll-y scroll-with-animation class="card-area" :scroll-top="cardAreaScrollTop" @scroll="onCardAreaScroll">
      <!-- ===== 今日模式：单列表（逾期在最上面，今日紧随其后） ===== -->
      <template v-if="viewMode === 'today'">
        <view v-if="cards.length > 0" id="section-today">
          <view v-for="section in todaySections" :key="section.key">
            <view
              v-if="section.cards.length > 0"
              class="home-section"
              :class="`home-section--${section.key}`"
              :id="`section-${section.key}`"
            >
              <view class="section-label">
                <view class="section-dot" :style="{ background: section.dotColor }" />
                <text class="section-text">{{ section.title }}</text>
                <view class="section-badge"><text class="section-badge-text">{{ section.cards.length }}</text></view>
              </view>
              <view v-if="section.groups?.length" class="section-groups">
                <view
                  v-for="group in section.groups"
                  :key="group.key"
                  v-show="group.cards.length > 0"
                  class="section-group"
                >
                  <view class="subsection-label">
                    <text class="subsection-text">{{ group.title }}</text>
                    <view class="subsection-badge"><text class="subsection-badge-text">{{ group.cards.length }}</text></view>
                  </view>
                  <BreedingProcessGroupCard v-if="isBreedingMilestoneGroup(group)" :group="group" @action="onAction" />
                  <view v-else class="card-feed">
                    <view
                      v-for="card in group.cards"
                      :id="`home-card-${card.id}`"
                      :key="card.id"
                      class="home-card-anchor"
                      :class="{ 'home-card-anchor--focus': focusedHomeCardId === card.id }"
                    >
                      <SmartCard
                        :card="card"
                        :completing="completingCards.has(card.id)"
                        :completed="completedCards.has(card.id)"
                        @complete="onComplete" @postpone="onPostpone"
                        @batch-complete="onBatchComplete" @batch-skip="onBatchSkip" @batch-complete-med="onBatchCompleteMed"
                        @action="onAction" @record-dose="onRecordDose"
                      />
                    </view>
                  </view>
                </view>
              </view>
              <view v-else class="card-feed">
                <view
                  v-for="card in section.cards"
                  :id="`home-card-${card.id}`"
                  :key="card.id"
                  class="home-card-anchor"
                  :class="{ 'home-card-anchor--focus': focusedHomeCardId === card.id }"
                >
                  <SmartCard
                    :card="card"
                    :completing="completingCards.has(card.id)"
                    :completed="completedCards.has(card.id)"
                    @complete="onComplete" @postpone="onPostpone"
                    @batch-complete="onBatchComplete" @batch-skip="onBatchSkip" @batch-complete-med="onBatchCompleteMed"
                    @action="onAction" @record-dose="onRecordDose"
                  />
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 空状态 -->
        <BEmpty
          v-if="!loading && cards.length === 0"
          icon="pets"
          title="犬群一切正常"
          description="暂无待办事项"
        />
      </template>

      <!-- ===== 指定日期模式：分层列表 ===== -->
      <template v-else>
        <view v-if="dayCards.length > 0">
          <view class="section-label">
            <view class="section-dot" style="background: var(--blue);" />
            <text class="section-text">{{ formatFullDate(selectedDate) }}</text>
            <view class="section-badge"><text class="section-badge-text">{{ dayCards.length }}</text></view>
          </view>
          <view v-for="section in daySections" :key="section.key">
            <view
              v-if="section.cards.length > 0"
              class="home-section"
              :class="`home-section--${section.key}`"
              :id="`section-${section.key}`"
            >
              <view class="section-label section-label--nested">
                <view class="section-dot" :style="{ background: section.dotColor }" />
                <text class="section-text">{{ section.title }}</text>
                <view class="section-badge"><text class="section-badge-text">{{ section.cards.length }}</text></view>
              </view>
              <view v-if="section.groups?.length" class="section-groups">
                <view
                  v-for="group in section.groups"
                  :key="group.key"
                  v-show="group.cards.length > 0"
                  class="section-group"
                >
                  <view class="subsection-label">
                    <text class="subsection-text">{{ group.title }}</text>
                    <view class="subsection-badge"><text class="subsection-badge-text">{{ group.cards.length }}</text></view>
                  </view>
                  <BreedingProcessGroupCard v-if="isBreedingMilestoneGroup(group)" :group="group" @action="onAction" />
                  <view v-else class="card-feed">
                    <view
                      v-for="card in group.cards"
                      :id="`home-card-${card.id}`"
                      :key="card.id"
                      class="home-card-anchor"
                      :class="{ 'home-card-anchor--focus': focusedHomeCardId === card.id }"
                    >
                      <SmartCard
                        :card="card"
                        :completing="completingCards.has(card.id)"
                        :completed="completedCards.has(card.id)"
                        @complete="onComplete" @postpone="onPostpone"
                        @batch-complete="onBatchComplete" @batch-skip="onBatchSkip" @batch-complete-med="onBatchCompleteMed"
                        @action="onAction" @record-dose="onRecordDose"
                      />
                    </view>
                  </view>
                </view>
              </view>
              <view v-else class="card-feed">
                <view
                  v-for="card in section.cards"
                  :id="`home-card-${card.id}`"
                  :key="card.id"
                  class="home-card-anchor"
                  :class="{ 'home-card-anchor--focus': focusedHomeCardId === card.id }"
                >
                  <SmartCard
                    :card="card"
                    :completing="completingCards.has(card.id)"
                    :completed="completedCards.has(card.id)"
                    @complete="onComplete" @postpone="onPostpone"
                    @batch-complete="onBatchComplete" @batch-skip="onBatchSkip" @batch-complete-med="onBatchCompleteMed"
                    @action="onAction" @record-dose="onRecordDose"
                  />
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 空状态（指定日期） -->
        <BEmpty
          v-if="!loading && dayCards.length === 0"
          icon="event_available"
          :title="formatFullDate(selectedDate)"
          description="当天没有待办事项"
        />
      </template>

      <!-- 加载骨架屏 -->
      <view v-if="loading" class="card-feed">
        <BSkeleton :rows="3" />
      </view>
    </scroll-view>

    <!-- 底部导航栏 -->
    <BNavBar current="home" />

    <!-- H-3: 快速完成任务 Sheet -->
    <BSheet v-model:visible="showQuickComplete" title="完成任务">
      <view class="form-sheet task-sheet">
        <view v-if="quickCompleteTask" class="task-sheet__info">
          <BIconBox icon="check_circle" color="green" :size="36" />
          <view class="task-sheet__info-text">
            <text class="task-sheet__task-title">{{ quickCompleteTask.title || '任务' }}</text>
            <text class="task-sheet__dog-name">{{ quickCompleteTask.dog_name || '' }}</text>
          </view>
        </view>
        <view class="form-sheet__field">
          <text class="form-sheet__label">备注（选填）</text>
          <input v-model="quickCompleteNotes" class="form-sheet__input" placeholder="添加备注..." />
        </view>
        <view class="form-sheet__field">
          <text class="form-sheet__label">完成日期</text>
          <view class="form-sheet__select" @click="showQuickCompleteDatePicker = true">
            <text class="form-sheet__select-text">{{ quickCompleteDateStr }}</text>
            <text class="material-icons-round form-sheet__select-icon">calendar_today</text>
          </view>
        </view>
      </view>
      <template #footer>
        <view class="task-sheet__actions">
          <view class="task-sheet__btn task-sheet__btn--cancel" @click="showQuickComplete = false">
            <text style="color: var(--text-2); font-size: 14px; font-weight: 600;">取消</text>
          </view>
          <view class="task-sheet__btn task-sheet__btn--confirm" @click="confirmQuickComplete">
            <text style="color: #fff; font-size: 14px; font-weight: 600;">确认完成</text>
          </view>
        </view>
      </template>
    </BSheet>

    <!-- H-4: 推迟任务 Sheet -->
    <BSheet v-model:visible="showPostponeModal" title="推迟任务">
      <view class="form-sheet task-sheet">
        <!-- 犬只信息 -->
        <view v-if="postponeTaskInfo" class="postpone-info">
          <text class="postpone-info__text">{{ postponeTaskInfo.title ? postponeTaskInfo.dogName + ' · ' + postponeTaskInfo.title : postponeTaskInfo.dogName }}</text>
          <view v-if="postponeTaskInfo.isOverdue" class="postpone-info__tag">
            <text>逾期{{ postponeTaskInfo.overdueDays }}天</text>
          </view>
        </view>

        <view class="form-sheet__field">
          <text class="form-sheet__label">推迟到</text>
          <view class="form-sheet__select" @click="showPostponeDatePicker = true">
            <text class="form-sheet__select-text">{{ postponeDateStr }}</text>
            <text class="material-icons-round form-sheet__select-icon">calendar_today</text>
          </view>
          <view class="task-sheet__quick-dates">
            <view class="task-sheet__quick-date" :class="{ active: postponeQuick === 'tomorrow' }" @click="setPostponeQuick('tomorrow')">
              <text>明天</text>
            </view>
            <view class="task-sheet__quick-date" :class="{ active: postponeQuick === 'dayAfter' }" @click="setPostponeQuick('dayAfter')">
              <text>后天</text>
            </view>
            <view class="task-sheet__quick-date" :class="{ active: postponeQuick === 'nextWeek' }" @click="setPostponeQuick('nextWeek')">
              <text>下周</text>
            </view>
          </view>
        </view>
      </view>
      <template #footer>
        <view class="task-sheet__actions">
          <view class="task-sheet__btn task-sheet__btn--cancel" @click="showPostponeModal = false">
            <text style="color: var(--text-2); font-size: 14px; font-weight: 600;">取消</text>
          </view>
          <view class="task-sheet__btn task-sheet__btn--confirm" @click="doPostpone">
            <text style="color: #fff; font-size: 14px; font-weight: 600;">确认推迟</text>
          </view>
        </view>
      </template>
    </BSheet>

    <!-- H-5: 批量完成任务 Sheet -->
    <BSheet v-model:visible="showBatchComplete" :title="batchCompleteTitle">
      <view class="task-sheet">
        <view class="task-sheet__select-bar">
          <view class="task-sheet__select-toggle" @click="toggleSelectAll">
            <view class="task-sheet__checkbox" :class="{ checked: isAllSelected }">
              <text v-if="isAllSelected" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text>
            </view>
            <text class="task-sheet__select-label">
              {{ isAllSelected ? '取消全选' : '全选' }}（{{ batchSelectedCount }}/{{ batchDogList.length }}）
            </text>
          </view>
        </view>
        <scroll-view scroll-y class="task-sheet__dog-list">
          <view
            v-for="dog in batchDogList"
            :key="dog.id"
            class="task-sheet__dog-item"
            @click="toggleBatchDog(dog.id)"
          >
            <view class="task-sheet__checkbox" :class="{ checked: batchSelected[dog.id] }">
              <text v-if="batchSelected[dog.id]" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text>
            </view>
            <view class="task-sheet__dog-avatar">
              <BEntityIcon :size="14" color="#fff" />
            </view>
            <text class="task-sheet__dog-name-text">{{ dog.name }}</text>
            <text v-if="dog.completed" class="task-sheet__done-badge">已完成</text>
          </view>
        </scroll-view>
        <view class="task-sheet__actions">
          <view class="task-sheet__btn task-sheet__btn--cancel" @click="showBatchComplete = false">
            <text style="color: var(--text-2); font-size: 14px; font-weight: 600;">取消</text>
          </view>
          <view
            class="task-sheet__btn task-sheet__btn--confirm"
            :class="{ disabled: batchSelectedCount === 0 }"
            @click="confirmBatchComplete"
          >
            <text style="color: #fff; font-size: 14px; font-weight: 600;">
              完成（{{ batchSelectedCount }}）
            </text>
          </view>
        </view>
      </view>
    </BSheet>

    <BSheet v-model:visible="showSickBatch" title="疾病批量操作">
      <view class="task-sheet">
        <view class="task-sheet__select-bar">
          <view class="task-sheet__select-toggle" @click="toggleSelectAllSickBatch">
            <view class="task-sheet__checkbox" :class="{ checked: isAllSickBatchSelected }">
              <text v-if="isAllSickBatchSelected" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text>
            </view>
            <text class="task-sheet__select-label">
              {{ isAllSickBatchSelected ? '取消全选' : '全选' }}（{{ sickBatchSelectedCount }}/{{ sickBatchList.length }}）
            </text>
          </view>
        </view>
        <scroll-view scroll-y class="task-sheet__dog-list">
          <view
            v-for="item in sickBatchList"
            :key="item.id"
            class="task-sheet__dog-item"
            @click="toggleSickBatchItem(item.id)"
          >
            <view class="task-sheet__checkbox" :class="{ checked: sickBatchSelected[item.id] }">
              <text v-if="sickBatchSelected[item.id]" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text>
            </view>
            <view class="task-sheet__dog-avatar task-sheet__dog-avatar--illness">
              <text class="material-icons-round" style="color: #fff; font-size: 14px;">sick</text>
            </view>
            <view class="task-sheet__dog-copy">
              <text class="task-sheet__dog-name-text">{{ item.name }}</text>
              <text class="task-sheet__dog-detail-text">{{ item.illness }} · {{ item.treatmentStatus || '观察中' }} · 第{{ item.daysSick || 1 }}天</text>
            </view>
          </view>
        </scroll-view>
        <view class="task-sheet__actions task-sheet__actions--triple">
          <view
            class="task-sheet__btn task-sheet__btn--sick-secondary"
            :class="{ disabled: sickBatchSelectedCount === 0 }"
            @click="confirmSickBatchAction('recover')"
          >
            <text class="task-sheet__btn-label task-sheet__btn-label--success">康复</text>
          </view>
          <view
            class="task-sheet__btn task-sheet__btn--sick-warning"
            :class="{ disabled: sickBatchSelectedCount === 0 }"
            @click="confirmSickBatchAction('update_status')"
          >
            <text class="task-sheet__btn-label task-sheet__btn-label--warning">开始治疗</text>
          </view>
          <view
            class="task-sheet__btn task-sheet__btn--sick-primary"
            :class="{ disabled: sickBatchSelectedCount === 0 }"
            @click="confirmSickBatchAction('start_medication')"
          >
            <text class="task-sheet__btn-label task-sheet__btn-label--primary">开始用药</text>
          </view>
        </view>
      </view>
    </BSheet>

    <BSheet v-model:visible="showMedBatch" title="今日用药批量操作">
      <view class="task-sheet">
        <view class="task-sheet__select-bar">
          <view class="task-sheet__select-toggle" @click="toggleSelectAllMedBatch">
            <view class="task-sheet__checkbox" :class="{ checked: isAllMedBatchSelected }">
              <text v-if="isAllMedBatchSelected" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text>
            </view>
            <text class="task-sheet__select-label">
              {{ isAllMedBatchSelected ? '取消全选' : '全选' }}（{{ medBatchSelectedCount }}/{{ medBatchList.length }}）
            </text>
          </view>
        </view>
        <scroll-view scroll-y class="task-sheet__dog-list">
          <view
            v-for="item in medBatchList"
            :key="item.id"
            class="task-sheet__dog-item"
            @click="toggleMedBatchItem(item.id)"
          >
            <view class="task-sheet__checkbox" :class="{ checked: medBatchSelected[item.id] }">
              <text v-if="medBatchSelected[item.id]" style="color: #fff; font-size: 12px; font-weight: 700;">&#10003;</text>
            </view>
            <view class="task-sheet__dog-avatar task-sheet__dog-avatar--plum">
              <text class="material-icons-round" style="color: #fff; font-size: 14px;">medication</text>
            </view>
            <view class="task-sheet__dog-copy">
              <text class="task-sheet__dog-name-text">{{ item.name }}</text>
              <text class="task-sheet__dog-detail-text">{{ item.detail }}</text>
            </view>
          </view>
        </scroll-view>
        <view class="task-sheet__actions">
          <view
            class="task-sheet__btn task-sheet__btn--sick-secondary"
            :class="{ disabled: medBatchRecoverCount === 0 }"
            @click="confirmMedBatchRecover"
          >
            <text class="task-sheet__btn-label task-sheet__btn-label--success">批量康复</text>
          </view>
          <view
            class="task-sheet__btn task-sheet__btn--sick-primary"
            :class="{ disabled: medBatchSelectedCount === 0 }"
            @click="confirmMedBatchComplete"
          >
            <text class="task-sheet__btn-label task-sheet__btn-label--primary">完成今日用药</text>
          </view>
        </view>
      </view>
    </BSheet>

    <BSheet v-model:visible="showBreedingActionSheet" :title="breedingActionCard?.dogName || '繁育流程'">
      <view class="breeding-action-sheet">
        <view v-if="breedingActionCard" class="breeding-action-sheet__context">
          <view class="breeding-action-sheet__badge">
            <BEntityIcon :role="breedingActionCard?.role" color="var(--amber)" :size="18" />
          </view>
          <view class="breeding-action-sheet__copy">
            <view class="breeding-action-sheet__meta-row">
              <text class="breeding-action-sheet__eyebrow">当前阶段</text>
              <text v-if="breedingActionSummary.stageTag" class="breeding-action-sheet__status">{{ breedingActionSummary.stageTag }}</text>
            </view>
            <text class="breeding-action-sheet__title">{{ breedingActionStageTitle || '繁育流程' }}</text>
            <text class="breeding-action-sheet__primary">{{ breedingActionSummary.primaryLabel || '时间待确认' }}</text>
            <text v-if="breedingActionSummary.secondaryLabel" class="breeding-action-sheet__sub">{{ breedingActionSummary.secondaryLabel }}</text>
            <text
              v-if="breedingActionSummary.alertLabel"
              class="breeding-action-sheet__alert"
              :class="{ 'breeding-action-sheet__alert--danger': breedingActionAlertDanger }"
            >
              {{ breedingActionSummary.alertLabel }}
            </text>
          </view>
        </view>
        <view class="breeding-action-sheet__list">
          <view
            v-for="item in breedingActionItems"
            :key="item.key"
            class="breeding-action-sheet__item"
            :class="`breeding-action-sheet__item--${item.tone}`"
            @click="selectBreedingAction(item.key)"
          >
            <view
              class="breeding-action-sheet__icon-wrap"
              :class="`breeding-action-sheet__icon-wrap--${item.tone}`"
              :style="{ background: item.iconBg }"
            >
              <text
                class="material-icons-round breeding-action-sheet__icon"
                :class="`breeding-action-sheet__icon--${item.tone}`"
                :style="{ color: item.iconColor }"
              >{{ item.icon }}</text>
            </view>
            <view class="breeding-action-sheet__item-copy">
              <text class="breeding-action-sheet__label">{{ item.label }}</text>
              <text class="breeding-action-sheet__hint">{{ item.description }}</text>
            </view>
            <text class="material-icons-round breeding-action-sheet__arrow">arrow_forward</text>
          </view>
        </view>
      </view>
    </BSheet>

    <!-- 健康关注卡：操作菜单 -->
    <BSheet v-model:visible="showSickMenu" :title="sickMenuDog?.dogName || ''">
      <view class="sick-menu-body">
        <view
          v-for="(item, idx) in sickMenuItems"
          :key="idx"
          class="sick-menu-item"
          :class="`sick-menu-item--${getSickMenuTone(item.action)}`"
          @click="onSickMenuSelect(item)"
        >
          <view class="sick-menu-item__icon-wrap" :class="`sick-menu-item__icon-wrap--${getSickMenuTone(item.action)}`">
            <text class="material-icons-round sick-menu-item__icon" :class="`sick-menu-item__icon--${getSickMenuTone(item.action)}`">{{ item.icon }}</text>
          </view>
          <text class="sick-menu-item__label">{{ item.label }}</text>
        </view>
      </view>
    </BSheet>

    <!-- 健康关注卡：停止用药确认 -->
    <BSheet v-model:visible="showStopConfirm" title="">
      <view class="stop-confirm-body">
        <view class="stop-confirm-icon-wrap">
          <text class="material-icons-round stop-confirm-icon">medication_liquid</text>
        </view>
        <text class="stop-confirm-title">停止用药</text>
        <text class="stop-confirm-desc">确定停止 <text class="stop-confirm-bold">{{ stopConfirmData?.dogName }}</text> 的 <text class="stop-confirm-bold">{{ stopConfirmData?.drugName || '用药' }}</text> 吗？</text>
        <text class="stop-confirm-sub">{{ [stopConfirmData?.dosageStr, stopConfirmData?.progress].filter(Boolean).join(' · ') }}{{ stopConfirmData?.progress ? ' · 剩余任务将被取消' : '剩余用药任务将被取消' }}</text>
        <view class="stop-confirm-actions">
          <view class="stop-confirm-btn stop-confirm-btn--cancel" @click="showStopConfirm = false">
            <text>继续用药</text>
          </view>
          <view class="stop-confirm-btn stop-confirm-btn--danger" @click="confirmStopMedication">
            <text style="color: #fff;">确认停止</text>
          </view>
        </view>
      </view>
    </BSheet>

    <BDateTimePicker
      v-model:visible="showHomeDatePicker"
      :model-value="selectedDate"
      :day-dot-counts="dayCounts"
      date-only
      mode="date"
      value-type="timestamp"
      @calendar-range-change="onHomeCalendarRangeChange"
      @confirm="onHomeCalendarConfirm"
    />

    <BDateTimePicker
      v-model:visible="showQuickCompleteDatePicker"
      :model-value="quickCompleteDate"
      mode="date"
      value-type="timestamp"
      @confirm="onQuickCompleteDateConfirm"
    />

    <BDateTimePicker
      v-model:visible="showPostponeDatePicker"
      :model-value="postponeDate"
      mode="date"
      value-type="timestamp"
      @confirm="onPostponeDateConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, getCurrentInstance, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import WeekStrip from '@/components/week-strip/WeekStrip.vue'
import BreedingProcessGroupCard from '@/components/smart-card/BreedingProcessGroupCard.vue'
import SmartCard from '@/components/smart-card/SmartCard.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSubmitToast from '@/components/feedback/BSubmitToast.vue'
import BNavBar from '@/components/layout/BNavBar.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BIconBox from '@/components/base/BIconBox.vue'
import BDateTimePicker from '@/components/form/BDateTimePicker.vue'
import { usePageSync } from '@/composables/usePageSync'
import { useTaskStore } from '@/stores/taskStore'
import { localSyncRuntime } from '@/localdb/runtime'
import { consumeSubmitFeedback } from '@/composables/useSubmitFeedback'
import type { HomeCardFocusTarget } from '@/utils/homeCardFocus'
import { deriveBreedingMilestoneViewModel } from '@/utils/breedingMilestone'
import { buildBreedingMilestoneSummary } from '@/utils/breedingMilestoneSummary'
import type { HomeBreedingActionKey } from '@/utils/homeBreedingActions'
import {
  getHomeBreedingActionItems,
  openHomeBreedingAction,
} from '@/utils/homeBreedingActions'
import { buildHomeWorkbench } from '@/utils/homeWorkbench'
import { buildTimestampFromDayOffset, formatDateInputValue, getBeijingDayStart, getBeijingElapsedDays } from '@/utils/date'
import { buildMedicationDetailUrl } from '@/utils/dogDetailNavigation'
import type { MedicationRouteIllnessLink } from '@/utils/recordFormRoutes'
import { getBatchCardDogId } from '@/utils/batchCardProgress'

const { hasFamily, currentFamily, loadFamily } = useAuth()
const taskStore = useTaskStore()
usePageSync({ routePath: 'pages/home/index' })

// stale-while-revalidate：先用 taskStore 缓存渲染，后台刷新
const cards = ref<any[]>(taskStore.cards)
const counts = reactive({
  today: taskStore.counts.today || 0,
  week: taskStore.counts.week || 0,
  month30: taskStore.counts.month30 || 0,
  hasOverdue: taskStore.counts.hasOverdue || false,
})
const dayCards = ref<any[]>([])
const viewMode = ref<'today' | 'date'>('today')
const hasCachedData = cards.value.length > 0
const loading = ref(!hasCachedData)
const cardAreaScrollTop = ref(0)
const dayCounts = ref<Record<number, number>>({})
const submitToastMessage = ref('')
const submitToastClosing = ref(false)
let submitToastTimer: ReturnType<typeof setTimeout> | null = null
let submitToastHideTimer: ReturnType<typeof setTimeout> | null = null
const suppressedTaskMap = ref<Record<string, number>>({})
const localBatchCardProgressMap = ref<Record<string, { dogs: any[]; completedDogIds: string[] }>>(taskStore.batchCardProgress || {})
const pageInstance = getCurrentInstance()
const HOME_SUBMIT_TOAST_DURATION_MS = 1800
const focusedHomeCardId = ref('')
const pendingHomeCardFocusTarget = ref<HomeCardFocusTarget | ''>('')
let focusedHomeCardTimer: ReturnType<typeof setTimeout> | null = null
const isHomeActive = ref(false)
const showHomeDatePicker = ref(false)

// 选中日期（0点 timestamp）
const selectedDate = ref(getBeijingDayStart(Date.now()))
const isSelectedToday = computed(() => selectedDate.value === getBeijingDayStart(Date.now()))
const todayWorkbench = computed(() => buildHomeWorkbench(cards.value, { visibleRowLimit: 2 }))
const dayWorkbench = computed(() => buildHomeWorkbench(dayCards.value, { visibleRowLimit: 2 }))
const breedingGroups = computed(() => mapWorkbenchGroupsToCards(todayWorkbench.value.sections.breeding.groups))
const breedingCardsCount = computed(() => breedingGroups.value.reduce((sum, group) => sum + group.cards.length, 0))
const dayBreedingGroups = computed(() => mapWorkbenchGroupsToCards(dayWorkbench.value.sections.breeding.groups))
const daySections = computed(() => [
  {
    key: 'breeding',
    title: '繁育流程',
    dotColor: 'var(--amber)',
    cards: dayBreedingGroups.value.flatMap(group => group.cards),
    groups: dayBreedingGroups.value,
  },
  {
    key: 'therapy',
    title: '今日用药',
    dotColor: 'var(--plum)',
    cards: dayCards.value.filter(card => card.sectionType === 'therapy' && card.priority !== 'overdue'),
  },
  {
    key: 'reminders',
    title: '健康提醒',
    dotColor: 'var(--blue)',
    cards: dayCards.value.filter(card => card.sectionType === 'reminders' && card.priority !== 'overdue'),
  },
])
const todaySections = computed(() => [
  {
    key: 'overdue',
    title: '逾期待处理',
    dotColor: 'var(--red)',
    cards: cards.value.filter(card => card.priority === 'overdue'),
  },
  {
    key: 'breeding',
    title: '繁育流程',
    dotColor: 'var(--amber)',
    cards: breedingGroups.value.flatMap(group => group.cards),
    groups: breedingGroups.value,
  },
  {
    key: 'therapy',
    title: '今日用药',
    dotColor: 'var(--plum)',
    cards: cards.value.filter(card => card.sectionType === 'therapy' && card.priority !== 'overdue'),
  },
  {
    key: 'reminders',
    title: '健康提醒',
    dotColor: 'var(--blue)',
    cards: cards.value.filter(card => card.sectionType === 'reminders' && card.priority !== 'overdue'),
  },
])
const activeSummarySections = computed(() => viewMode.value === 'today' ? todaySections.value : daySections.value)
const summaryPills = computed(() => [
  {
    key: 'overdue',
    label: '逾期',
    count: activeSummarySections.value.find(section => section.key === 'overdue')?.cards.length || 0,
    dotColor: 'var(--red)',
    pillClass: 'pill-red',
  },
  {
    key: 'breeding',
    label: '繁育',
    count: activeSummarySections.value.find(section => section.key === 'breeding')?.cards.length || 0,
    dotColor: 'var(--amber)',
    pillClass: 'pill-amber',
  },
  {
    key: 'reminders',
    label: '健康',
    count: activeSummarySections.value.find(section => section.key === 'reminders')?.cards.length || 0,
    dotColor: 'var(--blue)',
    pillClass: 'pill-blue',
  },
  {
    key: 'therapy',
    label: '用药',
    count: activeSummarySections.value.find(section => section.key === 'therapy')?.cards.length || 0,
    dotColor: 'var(--plum)',
    pillClass: 'pill-plum',
  },
])
function mapWorkbenchGroupsToCards(groups: Array<{
  key: string
  title: string
  rows: Array<{ sourceCard?: any }>
  visibleRows?: Array<{ sourceCard?: any }>
  hiddenCount?: number
}> = []) {
  return groups
    .map(group => ({
      key: group.key,
      title: group.title,
      cards: uniqueSourceCards(group.rows || []),
      visibleCards: uniqueSourceCards(group.visibleRows || []),
      hiddenCount: group.hiddenCount || 0,
    }))
    .filter(group => group.cards.length > 0)
}

function uniqueSourceCards(rows: Array<{ sourceCard?: any }> = []) {
  const cardMap = new Map<string, any>()
  for (const row of rows) {
    const card = row?.sourceCard
    if (!card?.id || cardMap.has(card.id)) continue
    cardMap.set(card.id, card)
  }
  return Array.from(cardMap.values())
}

function isBreedingMilestoneGroup(group: { cards?: any[] } = {}) {
  const cardsInGroup = group.cards || []
  if (!cardsInGroup.length) return false
  return cardsInGroup.every((card: any) => card?.tasks?.[0]?.type === 'breeding_milestone')
}

// H-3: 快速完成
const showQuickComplete = ref(false)
const quickCompleteTask = ref<any>(null)
const quickCompleteNotes = ref('')
const quickCompleteDate = ref(Date.now())
const showQuickCompleteDatePicker = ref(false)

const quickCompleteDateStr = computed(() => {
  return formatDateInputValue(quickCompleteDate.value)
})

function onQuickCompleteDateConfirm(value: number | string) {
  if (typeof value !== 'number') return
  quickCompleteDate.value = value
}

// H-4: 推迟弹窗
const showPostponeModal = ref(false)
const postponeTaskId = ref<string | string[]>('')
const postponeDate = ref(buildTimestampFromDayOffset(1))
const postponeQuick = ref('tomorrow')
const showPostponeDatePicker = ref(false)

type BatchDogSelectionItem = {
  id: string
  name: string
  completed: boolean
  taskId?: string
}

const postponeDateStr = computed(() => {
  return formatDateInputValue(postponeDate.value)
})

function setPostponeQuick(option: string) {
  postponeQuick.value = option
  const offsetMap: Record<string, number> = {
    tomorrow: 1,
    dayAfter: 2,
    nextWeek: 7,
  }
  postponeDate.value = buildTimestampFromDayOffset(offsetMap[option] || 1)
}

// H-5: 批量完成
const showBatchComplete = ref(false)
const batchCompleteTitle = ref('批量完成')
const batchDogList = ref<BatchDogSelectionItem[]>([])
const batchSelected = reactive<Record<string, boolean>>({})
let batchTaskIdByDogId: Record<string, string> = {}
const showSickBatch = ref(false)
const sickBatchList = ref<Array<{
  id: string
  dogId: string
  name: string
  illness: string
  treatmentStatus: string
  daysSick: number
  illnessId: string
  symptomSummary?: string
}>>([])
const sickBatchSelected = reactive<Record<string, boolean>>({})
const showMedBatch = ref(false)
const medBatchList = ref<Array<{ id: string; dogId: string; name: string; detail: string; medicationTaskIds: string[]; illnessId: string; illnessIds: string[] }>>([])
const medBatchSelected = reactive<Record<string, boolean>>({})
const showBreedingActionSheet = ref(false)
const breedingActionCard = ref<any>(null)

const batchSelectedCount = computed(() => Object.values(batchSelected).filter(Boolean).length)
const isAllSelected = computed(() => {
  const uncompleted = batchDogList.value.filter(d => !d.completed)
  return uncompleted.length > 0 && uncompleted.every(d => batchSelected[d.id])
})
const sickBatchSelectedCount = computed(() => Object.values(sickBatchSelected).filter(Boolean).length)
const isAllSickBatchSelected = computed(() => sickBatchList.value.length > 0 && sickBatchList.value.every(item => sickBatchSelected[item.id]))
const medBatchSelectedCount = computed(() => Object.values(medBatchSelected).filter(Boolean).length)
const isAllMedBatchSelected = computed(() => medBatchList.value.length > 0 && medBatchList.value.every(item => medBatchSelected[item.id]))
const medBatchRecoverCount = computed(() => medBatchList.value.filter(item => medBatchSelected[item.id] && item.illnessIds.length > 0).length)
const breedingActionTask = computed(() => breedingActionCard.value?.tasks?.[0] || null)
const breedingActionMilestone = computed(() => {
  return breedingActionTask.value ? deriveBreedingMilestoneViewModel(breedingActionTask.value) : null
})
const breedingActionItems = computed(() => getHomeBreedingActionItems(breedingActionCard.value))
const breedingActionStageTitle = computed(() => breedingActionMilestone.value?.stageTitle || '')
const breedingActionAlertDanger = computed(() => !!breedingActionMilestone.value?.isAlertDanger)
const breedingActionSummary = computed(() => {
  const milestone = breedingActionMilestone.value
  if (!milestone) {
    return {
      stageTag: '',
      primaryLabel: '选择要执行的繁育动作',
      secondaryLabel: '',
      alertLabel: '',
    }
  }
  return buildBreedingMilestoneSummary(milestone)
})

function toggleSelectAll() {
  const uncompleted = batchDogList.value.filter(d => !d.completed)
  if (isAllSelected.value) {
    uncompleted.forEach(d => { batchSelected[d.id] = false })
  } else {
    uncompleted.forEach(d => { batchSelected[d.id] = true })
  }
}

function toggleBatchDog(id: string) {
  const dog = batchDogList.value.find(d => d.id === id)
  if (dog?.completed) return
  batchSelected[id] = !batchSelected[id]
}

function toggleSelectAllSickBatch() {
  const nextValue = !isAllSickBatchSelected.value
  sickBatchList.value.forEach((item) => {
    sickBatchSelected[item.id] = nextValue
  })
}

function toggleSickBatchItem(id: string) {
  sickBatchSelected[id] = !sickBatchSelected[id]
}

function toggleSelectAllMedBatch() {
  const nextValue = !isAllMedBatchSelected.value
  medBatchList.value.forEach((item) => {
    medBatchSelected[item.id] = nextValue
  })
}

function toggleMedBatchItem(id: string) {
  medBatchSelected[id] = !medBatchSelected[id]
}

function startOfDay(ts: number) {
  return getBeijingDayStart(ts)
}

function getOverdueDays(dueDate?: number | null) {
  if (!dueDate) return 1
  const diff = getBeijingElapsedDays(dueDate, Date.now())
  return Math.max(1, diff)
}

/** 问候语（按时段） */
const greetingText = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const greetingSubText = computed(() => {
  const suffix = isSelectedToday.value ? '今日概览' : '当日安排'
  return `${formatFullDate(selectedDate.value)} · ${suffix}`
})

/** 完整日期：3月22日 周六 */
const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
function formatFullDate(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekDays[d.getDay()]}`
}

function getCurrentFamilyId() {
  return currentFamily.value?._id || ''
}

async function fetchCards() {
  return localSyncRuntime.getHomeCards()
}

async function fetchDateCounts(startDate: number, endDate: number) {
  return localSyncRuntime.getDateCounts(startDate, endDate)
}

async function fetchWeekCards(startDate: number, endDate: number) {
  return localSyncRuntime.getWeekCards(startDate, endDate)
}

async function doCompleteTask(taskId: string, autoRecord?: boolean) {
  const familyId = getCurrentFamilyId()
  if (!familyId) return null
  return localSyncRuntime.completeTaskLocally(familyId, taskId, Boolean(autoRecord))
}

async function doPostponeTask(taskId: string, newDate: number) {
  const familyId = getCurrentFamilyId()
  if (!familyId) return null
  return localSyncRuntime.postponeTasksLocally(familyId, [taskId], newDate)
}

async function doBatchComplete(taskIds: string[], autoRecord?: boolean) {
  const familyId = getCurrentFamilyId()
  if (!familyId) return null
  return localSyncRuntime.batchCompleteTasksLocally(familyId, taskIds, Boolean(autoRecord))
}

async function doBatchPostponeTask(taskIds: string[], newDate: number) {
  const familyId = getCurrentFamilyId()
  if (!familyId) return null
  return localSyncRuntime.postponeTasksLocally(familyId, taskIds, newDate)
}

async function doRecordMedDose(medicationTaskId: string) {
  const familyId = getCurrentFamilyId()
  if (!familyId) return null
  return localSyncRuntime.recordMedicationDoseLocally(familyId, medicationTaskId)
}

async function doBatchCompleteMedDay(medicationTaskIds: string[]) {
  const familyId = getCurrentFamilyId()
  if (!familyId) return null
  return localSyncRuntime.batchCompleteMedicationDayLocally(familyId, medicationTaskIds)
}

async function recoverIllnesses(input: { illnessIds: string[]; medicationTaskIds?: string[] }) {
  const familyId = getCurrentFamilyId()
  if (!familyId) return null
  return localSyncRuntime.recoverIllnessesLocally(familyId, input.illnessIds || [], input.medicationTaskIds || [])
}

async function batchUpdateIllnessStatus(input: { illnessIds: string[]; status: string }) {
  const familyId = getCurrentFamilyId()
  if (!familyId) return null
  return localSyncRuntime.updateIllnessStatusLocally(familyId, input.illnessIds || [], input.status)
}

// 7天卡片缓存：{ [dayTimestamp]: Card[] }
type WeekCacheEntry = { cards: any[] }
const weekCache = ref<Record<number, WeekCacheEntry>>({})
const loadedDateCountRanges = new Set<string>()
let latestLoadToken = 0

type CalendarRangeChangePayload = {
  startDate: number
  endDate: number
  year: number
  month: number
}

function onCardAreaScroll(event: any) {
  cardAreaScrollTop.value = event?.detail?.scrollTop || 0
}

function scrollToSection(section: string) {
  const normalized = section === 'workflow' ? 'breeding' : section
  scrollToAnchor(`section-${normalized}`)
}

function scrollToAnchor(targetId: string) {
  if (!targetId || !pageInstance) return
  nextTick(() => {
    setTimeout(() => {
      const query = uni.createSelectorQuery().in(pageInstance)
      query.select('.card-area').boundingClientRect()
      query.select(`#${targetId}`).boundingClientRect()
      query.exec((result) => {
        const [scrollViewRect, targetRect] = result || []
        if (!scrollViewRect || !targetRect) return
        const nextTop = Math.max(0, cardAreaScrollTop.value + targetRect.top - scrollViewRect.top - 10)
        cardAreaScrollTop.value = nextTop
      })
    }, 20)
  })
}

function hydrateHomeFromTaskStore() {
  if (!taskStore.cards.length) return
  localBatchCardProgressMap.value = { ...(taskStore.batchCardProgress || {}) }
  cards.value = taskStore.cards
  counts.today = taskStore.counts.today || 0
  counts.week = taskStore.counts.week || 0
  counts.month30 = taskStore.counts.month30 || 0
  counts.hasOverdue = taskStore.counts.hasOverdue || false
}

function getHomeFocusSection(target: HomeCardFocusTarget) {
  return target === 'medication' ? 'therapy' : 'reminders'
}

function getHomeFocusCard(target: HomeCardFocusTarget) {
  return cards.value.find(card => card.cardType === target)
}

function highlightHomeCard(cardId: string) {
  focusedHomeCardId.value = cardId
  if (focusedHomeCardTimer) clearTimeout(focusedHomeCardTimer)
  focusedHomeCardTimer = setTimeout(() => {
    focusedHomeCardId.value = ''
  }, 1800)
}

function openSickBatchFromCard(card: any) {
  sickBatchList.value = (card?.dogs || []).map((dog: any) => ({
    id: dog.illnessId || `${dog.dogId}-${dog.illness}-${dog._createdAt || 0}`,
    illnessId: dog.illnessId || '',
    dogId: dog.dogId,
    name: dog.dogName,
    illness: dog.illness || '生病',
    symptomSummary: dog.symptomSummary || '',
    treatmentStatus: dog.treatmentStatus || '观察中',
    daysSick: dog.daysSick || 1,
  }))
  Object.keys(sickBatchSelected).forEach(key => delete sickBatchSelected[key])
  sickBatchList.value.forEach((item) => {
    sickBatchSelected[item.id] = true
  })
  showSickBatch.value = true
}

function openMedBatchFromCard(card: any) {
  medBatchList.value = (card?.dogs || []).map((dog: any, index: number) => ({
    id: dog.dogId || `med-${index}`,
    dogId: dog.dogId,
    name: dog.dogName,
    detail: [dog.illnessNames || dog.illness, dog.drugName, dog.progress].filter(Boolean).join(' · '),
    medicationTaskIds: (dog.allMedTasks || []).map((task: any) => task._id).filter(Boolean),
    illnessId: dog.illnessId || '',
    illnessIds: Array.isArray(dog.illnessIds) ? dog.illnessIds.filter(Boolean) : (dog.illnessId ? [dog.illnessId] : []),
  }))
  Object.keys(medBatchSelected).forEach(key => delete medBatchSelected[key])
  medBatchList.value.forEach((item) => {
    medBatchSelected[item.id] = true
  })
  showMedBatch.value = true
}

function openHomeAggregateAction(target: HomeCardFocusTarget) {
  const targetCard = getHomeFocusCard(target)
  if (!targetCard) return false
  if (target === 'sick_observation') {
    openSickBatchFromCard(targetCard)
    return true
  }
  if (target === 'medication') {
    openMedBatchFromCard(targetCard)
    return true
  }
  return false
}

function applyPendingHomeCardFocus() {
  const target = pendingHomeCardFocusTarget.value
  if (!target) return
  const targetCard = getHomeFocusCard(target)
  pendingHomeCardFocusTarget.value = ''
  if (!targetCard?.id) {
    scrollToSection(getHomeFocusSection(target))
    return
  }
  highlightHomeCard(targetCard.id)
  scrollToAnchor(`home-card-${targetCard.id}`)
  setTimeout(() => {
    openHomeAggregateAction(target)
  }, 220)
}

function scheduleHomeCardFocus(target: HomeCardFocusTarget) {
  pendingHomeCardFocusTarget.value = target
  nextTick(() => {
    setTimeout(() => {
      applyPendingHomeCardFocus()
    }, 80)
  })
}

/** 加载今日卡片（逾期+今日合并为单列表） */
async function loadTodayCards(loadToken = latestLoadToken) {
  const hasData = cards.value.length > 0
  if (!hasData) loading.value = true

  const result = await fetchCards()
  if (loadToken !== latestLoadToken) return
  if (result) {
    pruneSuppressedTasks()
    cards.value = filterSuppressedCards(result.cards || [])
    counts.today = result.counts?.today || 0
    counts.week = result.counts?.week || 0
    counts.month30 = result.counts?.month30 || 0
    counts.hasOverdue = result.counts?.hasOverdue || false
    pruneLocalBatchCardProgress(cards.value)
    syncTaskStoreHomeCache()
    syncTodayDayCountFromVisibleCards()
  }
  loading.value = false
}

/** 加载未来日期的卡片缓存（今天+未来6天，用于 WeekStrip 点击） */
async function loadWeekCache(loadToken = latestLoadToken) {
  const DAY_MS = 86400000
  const todayTs = startOfDay(Date.now())
  // 只缓存今天之后的未来日期（过去日期不可点击）
  const start = todayTs + DAY_MS
  const end = todayTs + 7 * DAY_MS - 1 // 未来 6 天
  const result = await fetchWeekCards(start, end)
  if (loadToken !== latestLoadToken) return
  if (result) {
    pruneSuppressedTasks()
    const cache: Record<number, WeekCacheEntry> = {}
    for (const [k, v] of Object.entries(result)) {
      const dayData = v as { cards?: any[] }
      cache[Number(k)] = {
        cards: filterSuppressedCards(dayData.cards || []),
      }
    }
    weekCache.value = cache
  }
}

async function loadDateCounts(loadToken = latestLoadToken) {
  const DAY_MS = 86400000
  const todayTs = startOfDay(Date.now())
  // 只查询今天到本周日的范围（过去日期不显示红点）
  const end = todayTs + 7 * DAY_MS - 1
  await ensureDateCountsRange(todayTs, end, { loadToken, force: true })
}

/** 并行加载所有首页数据 */
async function loadAll() {
  const loadToken = ++latestLoadToken
  loadedDateCountRanges.clear()
  await Promise.all([loadTodayCards(loadToken), loadWeekCache(loadToken), loadDateCounts(loadToken)])
  if (loadToken !== latestLoadToken) return
  // 两个请求都完成后：以实际可见卡片数修正今天的红点
  // 不依赖 counts.today（它含用药卡，即使今日剂量全给完仍为 1）
  syncTodayDayCountFromVisibleCards()
}

async function onDateSelect(ts: number) {
  const normalizedTs = startOfDay(ts)
  selectedDate.value = normalizedTs
  const todayTs = startOfDay(Date.now())
  if (normalizedTs === todayTs) {
    // 切回今天：显示今日模式
    viewMode.value = 'today'
    dayCards.value = []
    loading.value = false
  } else {
    const cachedEntry = weekCache.value[normalizedTs]
    viewMode.value = 'date'
    if (cachedEntry) {
      // 已缓存日期：零延迟读取
      dayCards.value = cachedEntry.cards
      loading.value = false
      return
    }

    const loadToken = latestLoadToken
    dayCards.value = []
    loading.value = true
    try {
      const result = await fetchWeekCards(normalizedTs, normalizedTs + 86400000 - 1)
      if (loadToken !== latestLoadToken || selectedDate.value !== normalizedTs) return
      pruneSuppressedTasks()
      const dayData = (result as any)?.[normalizedTs] || (result as any)?.[String(normalizedTs)]
      const cardsForDay = filterSuppressedCards(dayData?.cards || [])
      weekCache.value = {
        ...weekCache.value,
        [normalizedTs]: { cards: cardsForDay },
      }
      dayCards.value = cardsForDay
    } finally {
      if (loadToken === latestLoadToken && selectedDate.value === normalizedTs && viewMode.value === 'date') {
        loading.value = false
      }
    }
  }
}

async function refreshDayCacheFromLocal(dayTs: number) {
  const normalizedTs = startOfDay(dayTs)
  const todayTs = startOfDay(Date.now())

  if (normalizedTs === todayTs) {
    await loadTodayCards()
    return
  }

  const result = await fetchWeekCards(normalizedTs, normalizedTs + 86400000 - 1)
  pruneSuppressedTasks()
  const dayData = (result as any)?.[normalizedTs] || (result as any)?.[String(normalizedTs)]
  const cardsForDay = filterSuppressedCards(dayData?.cards || [])
  weekCache.value = {
    ...weekCache.value,
    [normalizedTs]: { cards: cardsForDay },
  }

  const nextCounts = { ...dayCounts.value }
  if (cardsForDay.length > 0) {
    nextCounts[normalizedTs] = cardsForDay.length
  } else {
    delete nextCounts[normalizedTs]
  }
  dayCounts.value = nextCounts

  if (viewMode.value === 'date' && selectedDate.value === normalizedTs) {
    dayCards.value = cardsForDay
    loading.value = false
  }
}

async function refreshWeekCacheFromLocal(extraDays: number[] = []) {
  const DAY_MS = 86400000
  const todayTs = startOfDay(Date.now())
  const start = todayTs + DAY_MS
  const end = todayTs + 7 * DAY_MS - 1
  const result = await fetchWeekCards(start, end)
  const nextCache = { ...weekCache.value }

  Object.keys(nextCache).forEach((key) => {
    const ts = Number(key)
    if (ts >= start && ts <= end) delete nextCache[ts]
  })

  pruneSuppressedTasks()
  if (result) {
    for (const [key, value] of Object.entries(result)) {
      const dayData = value as { cards?: any[] }
      nextCache[Number(key)] = {
        cards: filterSuppressedCards(dayData.cards || []),
      }
    }
  }
  weekCache.value = nextCache
  await ensureDateCountsRange(todayTs, end, { force: true })

  const extraDaySet = new Set(
    extraDays
      .map(day => startOfDay(day))
      .filter(day => day !== todayTs && (day < start || day > end)),
  )
  for (const day of extraDaySet) {
    await refreshDayCacheFromLocal(day)
  }
}

async function refreshHomeAfterLocalMutation(extraDays: number[] = []) {
  const selectedTs = selectedDate.value
  await waitForPendingCardExits()
  await loadTodayCards()
  await refreshWeekCacheFromLocal(extraDays)
  if (selectedTs !== startOfDay(Date.now())) {
    await refreshDayCacheFromLocal(selectedTs)
  }
}

function toggleCalendar() {
  showHomeDatePicker.value = true
}

function jumpToToday() {
  void onDateSelect(startOfDay(Date.now()))
}

async function onHomeCalendarRangeChange(payload: CalendarRangeChangePayload) {
  await ensureDateCountsRange(payload.startDate, payload.endDate)
}

function onHomeCalendarConfirm(value: number | string) {
  if (typeof value !== 'number') return
  const dayTs = getBeijingDayStart(value)
  const todayTs = startOfDay(Date.now())
  if (dayTs < todayTs) {
    uni.showToast({ title: '过去日期暂不可查看', icon: 'none' })
    return
  }
  void onDateSelect(dayTs)
}

function buildDateCountRangeKey(startDate: number, endDate: number) {
  return `${startDate}:${endDate}`
}

function syncTodayDayCountFromVisibleCards() {
  const todayTs = startOfDay(Date.now())
  dayCounts.value[todayTs] = cards.value.length
}

function mergeDateCountsRange(startDate: number, endDate: number, nextCounts?: Record<number, number>) {
  const merged = { ...dayCounts.value }
  Object.keys(merged).forEach((key) => {
    const ts = Number(key)
    if (ts >= startDate && ts <= endDate) {
      delete merged[ts]
    }
  })
  Object.entries(nextCounts || {}).forEach(([key, count]) => {
    const ts = Number(key)
    if (count > 0) {
      merged[ts] = count
    }
  })
  dayCounts.value = merged
}

async function ensureDateCountsRange(
  startDate: number,
  endDate: number,
  options: { loadToken?: number; force?: boolean } = {},
) {
  const todayTs = startOfDay(Date.now())
  if (endDate < todayTs) return
  const normalizedStart = Math.max(startOfDay(startDate), todayTs)
  const normalizedEnd = Math.max(normalizedStart, endDate)

  const rangeKey = buildDateCountRangeKey(normalizedStart, normalizedEnd)
  if (!options.force && loadedDateCountRanges.has(rangeKey)) return

  const result = await fetchDateCounts(normalizedStart, normalizedEnd)
  if (options.loadToken !== undefined && options.loadToken !== latestLoadToken) return

  mergeDateCountsRange(normalizedStart, normalizedEnd, result || {})
  loadedDateCountRanges.add(rangeKey)
}

function dismissSubmitToast() {
  if (submitToastTimer) clearTimeout(submitToastTimer)
  if (submitToastHideTimer) clearTimeout(submitToastHideTimer)
  if (!submitToastMessage.value) {
    submitToastClosing.value = false
    return
  }
  submitToastClosing.value = true
  submitToastHideTimer = setTimeout(() => {
    submitToastMessage.value = ''
    submitToastClosing.value = false
  }, 220)
}

function showSubmitToast(message: string) {
  submitToastMessage.value = message
  submitToastClosing.value = false
  if (submitToastTimer) clearTimeout(submitToastTimer)
  if (submitToastHideTimer) clearTimeout(submitToastHideTimer)
  submitToastTimer = setTimeout(() => {
    dismissSubmitToast()
  }, HOME_SUBMIT_TOAST_DURATION_MS)
}

function pruneSuppressedTasks() {
  const now = Date.now()
  Object.entries(suppressedTaskMap.value).forEach(([taskId, expiresAt]) => {
    if (expiresAt <= now) delete suppressedTaskMap.value[taskId]
  })
}

function addSuppressedTasks(taskIds: string[] = [], duration = 2500) {
  if (!taskIds.length) return
  const expiresAt = Date.now() + duration
  taskIds.forEach(taskId => {
    if (taskId) suppressedTaskMap.value[taskId] = expiresAt
  })
}

function filterSuppressibleTaskIds(taskIds: string[] = []) {
  return taskIds.filter(taskId => taskId && !taskId.startsWith('synthetic_breeding_milestone:'))
}

function isTaskSuppressed(taskId?: string) {
  if (!taskId) return false
  pruneSuppressedTasks()
  return !!suppressedTaskMap.value[taskId]
}

function cloneBatchDog(dog: any) {
  return dog && typeof dog === 'object' ? { ...dog } : dog
}

function isHealthBatchCard(card: any) {
  return card?.cardType === 'batch' && card?.domain === 'health'
}

function normalizeIllnessCondition(condition: unknown) {
  return typeof condition === 'string' ? condition.trim() : ''
}

function getIllnessPrimaryCondition(details: Record<string, any> = {}) {
  return normalizeIllnessCondition(details.primary_condition || details.condition || '')
}

function getHealthTaskVariantKey(task: any) {
  if (!task) return ''
  if (task.type === 'vaccination') {
    return `vaccination:${task.details?.vaccine_type || ''}`
  }
  if (task.type === 'deworming') {
    return `deworming:${task.details?.deworming_type || ''}:${task.details?.drug_name || ''}`
  }
  if (task.type === 'illness') {
    return `illness:${getIllnessPrimaryCondition(task.details || {})}`
  }
  return task.type || ''
}

function getHealthBatchCardId(task: any) {
  const variantKey = getHealthTaskVariantKey(task)
  if (!variantKey || !task?.due_date) return ''
  return `batch-${variantKey}-${task.due_date}`
}

function restorePersistedHealthBatchCards(cardList: any[] = []) {
  const nextCards = (cardList || []).map((card: any) => ({
    ...card,
    tasks: Array.isArray(card?.tasks) ? [...card.tasks] : card?.tasks,
    dogs: Array.isArray(card?.dogs) ? card.dogs.map((dog: any) => cloneBatchDog(dog)) : card?.dogs,
  }))

  const existingBatchIds = new Set(
    nextCards
      .filter((card: any) => isHealthBatchCard(card))
      .map((card: any) => card.id)
      .filter(Boolean),
  )

  Object.entries(localBatchCardProgressMap.value).forEach(([cardId, progress]) => {
    if (!progress?.dogs?.length || existingBatchIds.has(cardId)) return

    const matchedTasks: any[] = []
    const matchedMeta: Array<{ cardIdx: number; taskIds: string[] }> = []

    nextCards.forEach((card: any, cardIdx: number) => {
      if (card?.cardType !== 'dog' || card?.domain !== 'health') return
      const matched = (card.tasks || []).filter((task: any) => getHealthBatchCardId(task) === cardId)
      if (!matched.length) return
      matchedTasks.push(...matched)
      matchedMeta.push({ cardIdx, taskIds: matched.map((task: any) => task._id).filter(Boolean) })
    })

    if (!matchedTasks.length) return

    matchedMeta.forEach(({ cardIdx, taskIds }) => {
      const card = nextCards[cardIdx]
      if (!card) return
      const remainingTasks = (card.tasks || []).filter((task: any) => !taskIds.includes(task._id))
      if (!remainingTasks.length) {
        nextCards[cardIdx] = null
        return
      }
      card.tasks = remainingTasks
    })

    const pendingTaskByDogId = new Map<string, any>()
    matchedTasks.forEach((task: any) => {
      const dogId = task.dog_id || task.dogId
      if (dogId && !pendingTaskByDogId.has(dogId)) pendingTaskByDogId.set(dogId, task)
    })

    const mergedDogs = (progress.dogs || []).map((dog: any) => {
      const dogId = getBatchCardDogId(dog)
      const pendingTask = dogId ? pendingTaskByDogId.get(dogId) : null
      return {
        ...cloneBatchDog(dog),
        taskId: pendingTask?._id || dog?.taskId || '',
        completed: !pendingTask,
      }
    })

    nextCards.push({
      cardType: 'batch',
      id: cardId,
      domain: 'health',
      sectionType: 'reminders',
      priority: matchedTasks[0]?.priority || 'today',
      groupTitle: matchedTasks[0]?.display_title || matchedTasks[0]?.title || '',
      dogs: mergedDogs,
      tasks: matchedTasks,
      progress: {
        done: mergedDogs.filter((dog: any) => dog?.completed).length,
        total: mergedDogs.length,
      },
    })
  })

  return nextCards.filter(Boolean)
}

function syncTaskStoreHomeCache() {
  taskStore.cards = cards.value
  taskStore.counts = {
    today: counts.today,
    week: counts.week,
    month30: counts.month30,
    hasOverdue: counts.hasOverdue,
  }
  taskStore.batchCardProgress = { ...localBatchCardProgressMap.value }
  taskStore.loaded = true
}

function pruneLocalBatchCardProgress(cardList: any[] = []) {
  const activeCardIds = new Set(
    (cardList || [])
      .filter((card: any) => isHealthBatchCard(card))
      .map((card: any) => card.id)
      .filter(Boolean),
  )

  const next = Object.fromEntries(
    Object.entries(localBatchCardProgressMap.value).filter(([cardId]) => activeCardIds.has(cardId)),
  )

  localBatchCardProgressMap.value = next
  taskStore.batchCardProgress = { ...next }
}

function updateLocalBatchCardProgress(cardId: string, dogs: any[]) {
  if (!cardId) return
  const completedDogIds = (dogs || [])
    .filter((dog: any) => dog?.completed)
    .map((dog: any) => getBatchCardDogId(dog))
    .filter(Boolean) as string[]

  if (!completedDogIds.length) {
    const next = { ...localBatchCardProgressMap.value }
    delete next[cardId]
    localBatchCardProgressMap.value = next
    taskStore.batchCardProgress = { ...next }
    return
  }

  localBatchCardProgressMap.value = {
    ...localBatchCardProgressMap.value,
    [cardId]: {
      dogs: (dogs || []).map(cloneBatchDog),
      completedDogIds,
    },
  }
  taskStore.batchCardProgress = { ...localBatchCardProgressMap.value }
}

function clearLocalBatchCardProgress(cardId?: string) {
  if (!cardId) return
  if (!localBatchCardProgressMap.value[cardId]) return
  const next = { ...localBatchCardProgressMap.value }
  delete next[cardId]
  localBatchCardProgressMap.value = next
  taskStore.batchCardProgress = { ...next }
}

function applyLocalBatchCardProgress(card: any) {
  if (!isHealthBatchCard(card)) return card
  const progress = localBatchCardProgressMap.value[card.id]
  if (!progress) return card

  const completedDogIdSet = new Set(progress.completedDogIds)
  const pendingDogMap = new Map<string, any>()
  ;(card.dogs || []).forEach((dog: any) => {
    const dogId = getBatchCardDogId(dog)
    if (dogId) pendingDogMap.set(dogId, dog)
  })

  const mergedDogs: any[] = []
  ;(progress.dogs || []).forEach((dog: any) => {
    const dogId = getBatchCardDogId(dog)
    if (!dogId) return

    if (pendingDogMap.has(dogId)) {
      mergedDogs.push({
        ...cloneBatchDog(dog),
        ...cloneBatchDog(pendingDogMap.get(dogId)),
        completed: false,
      })
      pendingDogMap.delete(dogId)
      return
    }

    if (completedDogIdSet.has(dogId)) {
      mergedDogs.push({
        ...cloneBatchDog(dog),
        completed: true,
      })
    }
  })

  pendingDogMap.forEach((dog) => {
    mergedDogs.push({
      ...cloneBatchDog(dog),
      completed: false,
    })
  })

  card.dogs = mergedDogs
  if (card.progress) {
    card.progress = {
      ...card.progress,
      done: mergedDogs.filter((dog: any) => dog?.completed).length,
      total: mergedDogs.length,
    }
  }
  return card
}

function markBatchDogCompleted(card: any, taskId: string) {
  if (!isHealthBatchCard(card) || !taskId) return
  const targetTask = (card.tasks || []).find((task: any) => task?._id === taskId)
  if (!targetTask) return

  const targetDogId = targetTask.dog_id || targetTask.dogId
  if (!targetDogId) return

  const nextDogs = (card.dogs || []).map((dog: any) => {
    const dogId = getBatchCardDogId(dog)
    if (dogId !== targetDogId) return dog
    return {
      ...cloneBatchDog(dog),
      completed: true,
    }
  })

  card.dogs = nextDogs
  updateLocalBatchCardProgress(card.id, nextDogs)
}

function syncCardMeta(card: any, remainingTasks: any[]) {
  if (!card) return null
  card.tasks = remainingTasks

  if (isHealthBatchCard(card)) {
    const dogIdSet = new Set(remainingTasks.map((task: any) => task.dog_id || task.dogId).filter(Boolean))
    card.dogs = (card.dogs || [])
      .map((dog: any) => {
        const dogId = getBatchCardDogId(dog)
        if (!dogId) return dog
        return {
          ...cloneBatchDog(dog),
          completed: !dogIdSet.has(dogId),
        }
      })
      .filter((dog: any) => {
        const dogId = getBatchCardDogId(dog)
        return !dogId || dog.completed || dogIdSet.has(dogId)
      })

    if (card.progress) {
      card.progress = {
        ...card.progress,
        done: card.dogs.filter((dog: any) => dog?.completed).length,
        total: card.dogs.length,
      }
    }
    updateLocalBatchCardProgress(card.id, card.dogs || [])
  } else if (card.cardType === 'batch' || card.cardType === 'care_group') {
    const dogIdSet = new Set(remainingTasks.map((t: any) => t.dog_id || t.dogId).filter(Boolean))
    card.dogs = (card.dogs || []).filter((dog: any) => dogIdSet.has(dog.dogId || dog.dog_id))
    if (card.progress) {
      card.progress = { ...card.progress, total: card.dogs.length }
    }
  }

  return card
}

function filterSuppressedCards(cardList: any[]) {
  return restorePersistedHealthBatchCards(cardList).map((card: any) => {
    const nextCard = applyLocalBatchCardProgress(card)
    if (!nextCard?.tasks?.length) return nextCard
    const remainingTasks = nextCard.tasks.filter((task: any) => !isTaskSuppressed(task._id))
    if (remainingTasks.length === nextCard.tasks.length) return nextCard
    if (remainingTasks.length === 0) return null
    return syncCardMeta({ ...nextCard, dogs: Array.isArray(nextCard.dogs) ? [...nextCard.dogs] : nextCard.dogs }, remainingTasks)
  }).filter(Boolean)
}

// 乐观更新：标记正在消失的卡片
const completingCards = ref(new Set<string>())
const completedCards = ref(new Set<string>())
const pendingCardExitPromises = new Set<Promise<void>>()
const CARD_COMPLETE_CONFIRM_MS = 280
const CARD_EXIT_MS = 220
const SICK_ROW_EXIT_MS = 350

function trackCardExit(promise: Promise<void>) {
  pendingCardExitPromises.add(promise)
  promise.finally(() => pendingCardExitPromises.delete(promise))
  return promise
}

async function waitForPendingCardExits() {
  if (!pendingCardExitPromises.size) return
  await Promise.allSettled(Array.from(pendingCardExitPromises))
}

function markCardCompleted(cardId: string) {
  const next = new Set(completedCards.value)
  next.add(cardId)
  completedCards.value = next
}

function clearCardCompleted(cardId: string) {
  const next = new Set(completedCards.value)
  next.delete(cardId)
  completedCards.value = next
}

function markCardCompleting(cardId: string) {
  const next = new Set(completingCards.value)
  next.add(cardId)
  completingCards.value = next
}

function clearCardCompleting(cardId: string) {
  const next = new Set(completingCards.value)
  next.delete(cardId)
  completingCards.value = next
}

function removeCardLocally(taskId: string, forceRemoveCard = false, showSuccess = true) {
  const lists = [cards, dayCards]
  for (const list of lists) {
    const idx = list.value.findIndex(c => c.tasks?.some((t: any) => t._id === taskId) || c.id === taskId)
    if (idx < 0) continue
    const card = list.value[idx]
    const isBatchPartialComplete = isHealthBatchCard(card) && !forceRemoveCard
    const remainingTasks = card.tasks?.filter((t: any) => t._id !== taskId) || []
    if (remainingTasks.length === 0 || forceRemoveCard) {
      clearLocalBatchCardProgress(card.id)
      if (showSuccess) {
        // 完成：极短确认后退场，优先保证首页操作流畅
        markCardCompleted(card.id)
        trackCardExit(new Promise((resolve) => {
          setTimeout(() => {
            clearCardCompleted(card.id)
            markCardCompleting(card.id)
            setTimeout(() => {
              const currentIdx = list.value.findIndex(c => c.id === card.id)
              if (currentIdx >= 0) {
                list.value.splice(currentIdx, 1)
                counts.today = Math.max(0, counts.today - 1)
                syncTodayDayCountFromVisibleCards()
              }
              clearCardCompleting(card.id)
              resolve()
            }, CARD_EXIT_MS)
          }, CARD_COMPLETE_CONFIRM_MS)
        }))
      } else {
        // 推迟/跳过：直接滑出
        markCardCompleting(card.id)
        trackCardExit(new Promise((resolve) => {
          setTimeout(() => {
            const currentIdx = list.value.findIndex(c => c.id === card.id)
            if (currentIdx >= 0) {
              list.value.splice(currentIdx, 1)
              counts.today = Math.max(0, counts.today - 1)
              syncTodayDayCountFromVisibleCards()
            }
            clearCardCompleting(card.id)
            resolve()
          }, CARD_EXIT_MS)
        }))
      }
    } else {
      if (isBatchPartialComplete) markBatchDogCompleted(card, taskId)
      syncCardMeta(card, remainingTasks)
    }
    break
  }
  syncWeekCache(taskId)
  syncTaskStoreHomeCache()
}

/** 从 weekCache 中移除指定 task */
function syncWeekCache(taskId: string) {
  for (const [dayTs, entry] of Object.entries(weekCache.value)) {
    const cachedCards = entry?.cards || []
    const cardIdx = cachedCards.findIndex(c => c.tasks?.some((t: any) => t._id === taskId))
    if (cardIdx < 0) continue
    const card = cachedCards[cardIdx]
    const isBatchPartialComplete = isHealthBatchCard(card)
    const remaining = card.tasks?.filter((t: any) => t._id !== taskId) || []
    if (remaining.length === 0) {
      clearLocalBatchCardProgress(card.id)
      cachedCards.splice(cardIdx, 1)
    } else {
      if (isBatchPartialComplete) markBatchDogCompleted(card, taskId)
      syncCardMeta(card, remaining)
    }
    // 更新 dayCounts
    const ts = Number(dayTs)
    if (remaining.length === 0 && dayCounts.value[ts]) {
      dayCounts.value[ts] = Math.max(0, dayCounts.value[ts] - 1)
    }
    break
  }
}

function isMedicationTaskPending(task: any) {
  const frequency = Number(task?.details?.frequency || 1)
  const dosesGiven = Number(task?.doses_given || 0)
  return task?.status !== 'completed' && dosesGiven < frequency
}

function patchMedicationCards(
  updater: (card: any) => { nextCard?: any; removeCard?: boolean } | null,
) {
  let shouldRemoveCard = false

  for (const list of [cards, dayCards]) {
    const idx = list.value.findIndex(card => card.cardType === 'medication')
    if (idx < 0) continue
    const currentCard = list.value[idx]
    const result = updater(currentCard)
    if (!result) continue
    if (result.removeCard) {
      shouldRemoveCard = true
      continue
    }
    if (result.nextCard) {
      list.value[idx] = result.nextCard
    }
  }

  if (shouldRemoveCard) {
    removeCardLocally('medication', true)
  }
}

function markMedicationTasksCompletedLocally(medicationTaskIds: string[] = []) {
  const taskIdSet = new Set(medicationTaskIds.filter(Boolean))
  if (!taskIdSet.size) return

  patchMedicationCards((card) => {
    let touched = false
    const nextDogs = (card.dogs || []).map((dog: any) => {
      const allMedTasks = Array.isArray(dog.allMedTasks) ? dog.allMedTasks : []
      const nextTasks = allMedTasks.map((task: any) => {
        if (!taskIdSet.has(task._id)) return task
        touched = true
        return {
          ...task,
          doses_given: Number(task?.details?.frequency || 1),
          status: 'completed',
        }
      })
      if (nextTasks === allMedTasks) return dog
      return {
        ...dog,
        completed: nextTasks.every((task: any) => !isMedicationTaskPending(task)),
        allMedTasks: nextTasks,
      }
    })

    if (!touched) return null

    const nextCard = {
      ...card,
      dogs: nextDogs,
      medicationTaskIds: (card.medicationTaskIds || []).filter((id: string) => !taskIdSet.has(id)),
    }
    const hasPendingMedication = nextDogs.some((dog: any) =>
      (dog.allMedTasks || []).some((task: any) => isMedicationTaskPending(task)),
    )

    return hasPendingMedication ? { nextCard } : { removeCard: true }
  })
}

function removeMedicationDogsLocally(dogIds: string[] = []) {
  const dogIdSet = new Set(dogIds.filter(Boolean))
  if (!dogIdSet.size) return

  patchMedicationCards((card) => {
    const currentDogs = Array.isArray(card.dogs) ? card.dogs : []
    const nextDogs = currentDogs.filter((dog: any) => !dogIdSet.has(dog.dogId))
    if (nextDogs.length === currentDogs.length) return null

    const nextMedicationTaskIds = nextDogs.flatMap((dog: any) =>
      (dog.allMedTasks || [])
        .filter((task: any) => isMedicationTaskPending(task))
        .map((task: any) => task._id)
        .filter(Boolean),
    )

    if (nextDogs.length === 0 || nextMedicationTaskIds.length === 0) {
      return { removeCard: true }
    }

    return {
      nextCard: {
        ...card,
        dogs: nextDogs,
        medicationTaskIds: nextMedicationTaskIds,
      },
    }
  })
}

function updateSickDogsStatusLocally(illnessIds: string[] = [], status = '治疗中') {
  const illnessIdSet = new Set(illnessIds.filter(Boolean))
  if (!illnessIdSet.size) return

  const sickCard = cards.value.find(card => card.cardType === 'sick_observation')
  if (!sickCard) return
  ;(sickCard.dogs || []).forEach((dog: any) => {
    if (illnessIdSet.has(dog.illnessId)) {
      dog.treatmentStatus = status
    }
  })
}

async function onComplete(taskId: string, mode?: boolean | string) {
  const completeAndRefresh = async (autoRecord = false) => {
    const result = await doCompleteTask(taskId, autoRecord)
    if (!result) {
      await loadTodayCards()
      return
    }
    addSuppressedTasks(result?.data?.completedTaskIds || [taskId])
    await refreshHomeAfterLocalMutation()
  }

  // 批量卡片全部勾完
  if (mode === true) {
    removeCardLocally(taskId)
    await completeAndRefresh()
    return
  }
  // 批量卡片部分勾选
  if (mode === false) {
    await completeAndRefresh()
    return
  }
  if (mode === 'batch-auto') {
    removeCardLocally(taskId, true)
    await completeAndRefresh(true)
    return
  }
  if (mode === 'batch-auto-partial') {
    const result = await doCompleteTask(taskId, true)
    if (!result) {
      await loadTodayCards()
      return
    }
    removeCardLocally(taskId, false, false)
    addSuppressedTasks(result?.data?.completedTaskIds || [taskId])
    await refreshHomeAfterLocalMutation()
    return
  }
  // DogCard "完成" (mode='auto'): 一键完成 + 自动创建记录
  if (mode === 'auto') {
    removeCardLocally(taskId)
    await completeAndRefresh(true)
    return
  }
  // DogCard "跳过" (mode='skip'): 仅标记 done，不创建记录
  if (mode === 'skip') {
    removeCardLocally(taskId, false, false)
    await completeAndRefresh()
    return
  }
  // 兜底
  removeCardLocally(taskId)
  await completeAndRefresh()
}

const postponeTaskInfo = ref<any>(null)

function onPostpone(taskIds: string | string[], title?: string) {
  postponeTaskId.value = taskIds
  postponeDate.value = Date.now() + 86400000
  postponeQuick.value = 'tomorrow'

  const firstId = Array.isArray(taskIds) ? taskIds[0] : taskIds
  const allCards = [...cards.value, ...dayCards.value]
  const card = allCards.find(c => c.tasks?.some((t: any) => t._id === firstId))
  const task = card?.tasks?.find((t: any) => t._id === firstId)

  // 批量推迟显示批量标题，单条显示犬名
  const isBatch = Array.isArray(taskIds) && taskIds.length > 1
  postponeTaskInfo.value = {
    dogName: isBatch ? (title || card?.groupTitle || '') : (card?.dogName || task?.dog_name || ''),
    title: isBatch ? '' : (task?.title || card?.groupTitle || ''),
    isOverdue: card?.priority === 'overdue',
    overdueDays: card?.priority === 'overdue' && task?.due_date ? getOverdueDays(task.due_date) : 0,
  }
  showPostponeModal.value = true
}

function onPostponeDateConfirm(value: number | string) {
  if (typeof value !== 'number') return
  postponeDate.value = value
  postponeQuick.value = ''
}

async function doPostpone() {
  const taskIds = postponeTaskId.value
  showPostponeModal.value = false

  const ids = Array.isArray(taskIds) ? taskIds : [taskIds]
  const targetDayTs = startOfDay(postponeDate.value)

  if (ids.length > 1) {
    // 批量推迟：找到卡片直接整张移除
    const lists = [cards, dayCards]
    for (const list of lists) {
      const idx = list.value.findIndex(c => c.tasks?.some((t: any) => ids.includes(t._id)))
      if (idx >= 0) {
        const card = list.value[idx]
        markCardCompleting(card.id)
        trackCardExit(new Promise((resolve) => {
          setTimeout(() => {
            const ci = list.value.findIndex(c => c.id === card.id)
            if (ci >= 0) {
              list.value.splice(ci, 1)
              counts.today = Math.max(0, counts.today - 1)
              syncTodayDayCountFromVisibleCards()
            }
            clearCardCompleting(card.id)
            resolve()
          }, 450)
        }))
        break
      }
    }
    // 同步 weekCache（只用第一条 ID 定位卡片，避免重复减计数）
    syncWeekCache(ids[0])
  } else {
    // 单条推迟
    removeCardLocally(ids[0], false, false)
  }

  // 后台静默调接口
  let result: any = null
  if (ids.length > 1) {
    result = await doBatchPostponeTask(ids, postponeDate.value)
  } else if (ids[0]) {
    result = await doPostponeTask(ids[0], postponeDate.value)
  }

  if (!result) {
    await loadTodayCards()
    return
  }

  await refreshHomeAfterLocalMutation([targetDayTs])
}

async function onBatchComplete(payload: any) {
  // 打开批量完成 Sheet (H-5)
  if (payload && payload.dogs) {
    batchCompleteTitle.value = payload.title || '批量完成'
    batchTaskIdByDogId = (payload.dogs || []).reduce((map: Record<string, string>, dog: any) => {
      if (dog?.id && dog?.taskId) map[dog.id] = dog.taskId
      return map
    }, {})
    batchDogList.value = (payload.dogs || []).map((dog: any) => ({
      ...dog,
      taskId: dog?.taskId || batchTaskIdByDogId[dog?.id] || '',
    }))
    Object.keys(batchSelected).forEach(k => delete batchSelected[k])
    batchDogList.value.forEach((d: any) => {
      if (!d.completed) batchSelected[d.id] = false
    })
    showBatchComplete.value = true
    return
  }
  // 数组方式（BatchCard/MedicationCard 的"完成"按钮）— 整张卡片移除
  const taskIds = Array.isArray(payload) ? payload : (payload?.taskIds || [])
  const autoRecord = !Array.isArray(payload) && !!payload?.autoRecord
  if (taskIds.length > 0) {
    removeCardLocally(taskIds[0], true)
  }
  const result = await doBatchComplete(taskIds, autoRecord)
  if (!result) {
    await loadTodayCards()
    return
  }
  addSuppressedTasks(result?.data?.completedTaskIds || taskIds)
  await refreshHomeAfterLocalMutation()
}

async function onBatchSkip(taskIds: string[]) {
  if (taskIds.length > 0) removeCardLocally(taskIds[0], true, false)
  const result = await doBatchComplete(taskIds)
  if (!result) {
    await loadTodayCards()
    return
  }
  addSuppressedTasks(result?.data?.completedTaskIds || taskIds)
  await refreshHomeAfterLocalMutation()
}

async function onRecordDose({ medicationTaskId }: { medicationTaskId: string }) {
  const result = await doRecordMedDose(medicationTaskId)
  if (!result) {
    await loadTodayCards()
    return
  }
  if (result?.data?.completed || result?.data?.allComplete) {
    await refreshHomeAfterLocalMutation()
  }
}

async function onBatchCompleteMed(medicationTaskIds: string[]) {
  if (medicationTaskIds.length === 0) return
  markMedicationTasksCompletedLocally(medicationTaskIds)
  const result = await doBatchCompleteMedDay(medicationTaskIds)
  if (!result) {
    await loadTodayCards()
    return
  }
  const completedMedicationTaskIds = result?.data?.completedMedicationTaskIds || medicationTaskIds
  const fullyCompletedMedicationTaskIds = result?.data?.fullyCompletedMedicationTaskIds || []
  if (
    completedMedicationTaskIds.length !== medicationTaskIds.length
    || fullyCompletedMedicationTaskIds.length > 0
  ) {
    await refreshHomeAfterLocalMutation()
    return
  }
  await refreshHomeAfterLocalMutation()
}

function applyHomeFeedback(payload: any) {
  addSuppressedTasks(filterSuppressibleTaskIds(payload?.suppressTaskIds || payload?.completedTaskIds || []))
  const shouldKeepBreedingCardInPlace = payload?.homeSection === 'breeding'
    && typeof payload?.homeAnchorKey === 'string'
    && payload.homeAnchorKey.startsWith('breeding-step:')

  if (payload?.completedTaskIds?.length && !shouldKeepBreedingCardInPlace) {
    if (payload.removeBatchCard) {
      removeCardLocally(payload.completedTaskIds[0], true)
    } else {
      payload.completedTaskIds.forEach((taskId: string) => removeCardLocally(taskId))
    }
  }

  if (payload?.createdDate && payload?.createdCount) {
    const createdTs = startOfDay(payload.createdDate)
    dayCounts.value[createdTs] = (dayCounts.value[createdTs] || 0) + payload.createdCount
    if (createdTs === startOfDay(Date.now())) {
      counts.today += payload.createdCount
    }
  }
}

async function endMedication(dogId: string) {
  const familyId = getCurrentFamilyId()
  if (!familyId) return null
  return localSyncRuntime.endMedicationByDogLocally(familyId, dogId)
}

/** 乐观移除疾病观察卡中的观察项（带淡出动画） */
function removeSickDogLocally(dogId: string, illnessId?: string) {
  const list = cards
  const idx = list.value.findIndex(c => c.cardType === 'sick_observation')
  if (idx < 0) return
  const card = list.value[idx]
  const currentDogs = Array.isArray(card.dogs) ? card.dogs : []
  let touched = false
  const nextDogs = currentDogs.map((dog: any) => {
    if (!(illnessId ? dog.illnessId === illnessId : dog.dogId === dogId)) return dog
    touched = true
    return { ...dog, _removing: true }
  })
  if (!touched) return

  // 标记淡出动画
  list.value[idx] = { ...card, dogs: nextDogs }

  trackCardExit(new Promise((resolve) => {
    setTimeout(() => {
      const currentIdx = list.value.findIndex(c => c.id === card.id)
      if (currentIdx < 0) {
        resolve()
        return
      }
      const currentCard = list.value[currentIdx]
      const remaining = (currentCard.dogs || []).filter((dog: any) => (
        illnessId ? dog.illnessId !== illnessId : dog.dogId !== dogId
      ))
      if (remaining.length === 0) {
        // 最后一只：整张卡片滑出
        markCardCompleting(currentCard.id)
        setTimeout(() => {
          const ci = list.value.findIndex(c => c.id === currentCard.id)
          if (ci >= 0) {
            list.value.splice(ci, 1)
            counts.today = Math.max(0, counts.today - 1)
            syncTodayDayCountFromVisibleCards()
            syncTaskStoreHomeCache()
          }
          clearCardCompleting(currentCard.id)
          resolve()
        }, CARD_EXIT_MS)
      } else {
        list.value[currentIdx] = { ...currentCard, dogs: remaining }
        syncTaskStoreHomeCache()
        resolve()
      }
    }, SICK_ROW_EXIT_MS)
  }))
}

// 健康关注卡：操作菜单状态
const showSickMenu = ref(false)
const sickMenuDog = ref<any>(null)
const sickMenuItems = ref<any[]>([])
type SickBatchAction = 'recover' | 'update_status' | 'start_medication'

// 健康关注卡：停止用药确认状态
const showStopConfirm = ref(false)
const stopConfirmData = ref<any>(null)

function selectBreedingAction(actionKey: HomeBreedingActionKey) {
  const card = breedingActionCard.value
  showBreedingActionSheet.value = false
  if (!card) return
  openHomeBreedingAction(card, actionKey)
}

function onAction(payload: { type: string; data: any }) {
  if (payload.type === 'viewDog' && payload.data?.dogId) {
    uni.navigateTo({ url: `/pages/dog/detail?id=${payload.data.dogId}` })
  } else if (payload.type === 'show_breeding_actions' && payload.data?.card) {
    breedingActionCard.value = payload.data.card
    showBreedingActionSheet.value = true
  } else if (payload.type === 'show_sick_menu') {
    // 打开操作菜单 BSheet
    sickMenuDog.value = payload.data.dog
    sickMenuItems.value = payload.data.items
    showSickMenu.value = true
  } else if (payload.type === 'show_sick_batch') {
    openSickBatchFromCard({ dogs: payload.data?.dogs || [] })
  } else if (payload.type === 'show_med_batch') {
    openMedBatchFromCard({ dogs: payload.data?.dogs || [] })
  } else if (payload.type === 'show_stop_confirm') {
    // 打开停止用药确认 BSheet
    stopConfirmData.value = payload.data
    showStopConfirm.value = true
  } else if (payload.type === 'recover') {
    const rawIllnessIds: unknown[] = [
      ...(Array.isArray(payload.data?.illnessIds) ? payload.data.illnessIds : []),
      payload.data?.illnessId,
    ]
    const illnessIds: string[] = [...new Set(
      rawIllnessIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0),
    )]
    const rawMedicationTaskIds: unknown[] = Array.isArray(payload.data?.medicationTaskIds)
      ? payload.data.medicationTaskIds
      : []
    const medicationTaskIds: string[] = [...new Set(
      rawMedicationTaskIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0),
    )]
    if (!illnessIds.length) return

    if (medicationTaskIds.length > 0) {
      removeMedicationDogsLocally(payload.data?.dogId ? [payload.data.dogId] : [])
    } else {
      removeSickDogLocally(payload.data?.dogId, illnessIds[0])
    }

    void recoverIllnesses({ illnessIds, medicationTaskIds }).then(async (result) => {
      if (!result) {
        await loadTodayCards()
        return
      }
      await refreshHomeAfterLocalMutation()
    })
  } else if (payload.type === 'update_status' && payload.data?.illnessId) {
    // 就地更新状态标签（不移除行）
    updateSickDogsStatusLocally([payload.data.illnessId], payload.data.status)
    void batchUpdateIllnessStatus({ illnessIds: [payload.data.illnessId], status: payload.data.status }).then(async (result) => {
      if (!result) await loadTodayCards()
    })
  } else if (payload.type === 'stop_medication' && payload.data?.dogId) {
    endMedication(payload.data.dogId).then(async (result) => {
      if (!result) {
        return loadTodayCards()
      }
      const cancelledMedicationTaskIds = result?.data?.cancelledMedicationTaskIds || []
      if (cancelledMedicationTaskIds.length > 0) {
        removeMedicationDogsLocally([payload.data.dogId])
        await refreshHomeAfterLocalMutation()
      } else {
        return loadTodayCards()
      }
      return null
    })
  }
}

async function confirmMedBatchComplete() {
  const selectedItems = medBatchList.value.filter(item => medBatchSelected[item.id])
  if (selectedItems.length === 0) return
  showMedBatch.value = false

  const medIds = selectedItems.flatMap(item => item.medicationTaskIds)
  if (medIds.length > 0) {
    markMedicationTasksCompletedLocally(medIds)
    const result = await doBatchCompleteMedDay(medIds)
    if (!result) {
      await loadTodayCards()
      return
    }
    const completedMedicationTaskIds = result?.data?.completedMedicationTaskIds || medIds
    if (completedMedicationTaskIds.length !== medIds.length) {
      await refreshHomeAfterLocalMutation()
      return
    }
    await refreshHomeAfterLocalMutation()
  }
}

async function confirmMedBatchRecover() {
  const selectedItems = medBatchList.value.filter(item => medBatchSelected[item.id] && item.illnessIds.length > 0)
  if (selectedItems.length === 0) return
  showMedBatch.value = false

  const illnessIds = [...new Set(selectedItems.flatMap(item => item.illnessIds).filter(Boolean))]
  const medicationTaskIds = [...new Set(selectedItems.flatMap(item => item.medicationTaskIds).filter(Boolean))]

  const result = await recoverIllnesses({ illnessIds, medicationTaskIds })
  if (!result) {
    await loadTodayCards()
    return
  }
  if (result?.data?.recoveredIllnessIds?.length) {
    removeMedicationDogsLocally(selectedItems.map(item => item.dogId))
    await refreshHomeAfterLocalMutation()
  } else {
    await loadTodayCards()
  }
}

async function confirmSickBatchAction(action: SickBatchAction) {
  const selectedItems = sickBatchList.value.filter(item => sickBatchSelected[item.id])
  if (selectedItems.length === 0) return

  showSickBatch.value = false

  if (action === 'recover') {
    const illnessIds = [...new Set(selectedItems.map(item => item.illnessId).filter(Boolean))]
    selectedItems.forEach((item) => {
      removeSickDogLocally(item.dogId, item.illnessId)
    })
    const result = await recoverIllnesses({ illnessIds })
    if (!result) {
      await loadTodayCards()
      return
    }
    await refreshHomeAfterLocalMutation()
    return
  }

  if (action === 'update_status') {
    const illnessIds = [...new Set(selectedItems.map(item => item.illnessId).filter(Boolean))]
    updateSickDogsStatusLocally(illnessIds, '治疗中')
    const result = await batchUpdateIllnessStatus({ illnessIds, status: '治疗中' })
    if (!result) await loadTodayCards()
    return
  }

  const duplicateDogIds = new Set<string>()
  const seenDogIds = new Set<string>()
  selectedItems.forEach((item) => {
    if (seenDogIds.has(item.dogId)) duplicateDogIds.add(item.dogId)
    seenDogIds.add(item.dogId)
  })
  if (duplicateDogIds.size > 0) {
    uni.showToast({ title: '同一犬多条疾病请逐条开始用药', icon: 'none' })
    return
  }

  navigateToMedicationFromIllnesses(selectedItems)
}

function getSickMenuTone(action?: string) {
  if (action === 'recover') return 'success'
  if (action === 'start_medication') return 'plum'
  return 'illness'
}

function onSickMenuSelect(item: any) {
  showSickMenu.value = false
  const dog = sickMenuDog.value
  if (!dog) return

  if (item.action === 'recover') {
    const rawIllnessIds: unknown[] = [
      ...(Array.isArray(dog.illnessIds) ? dog.illnessIds : []),
      dog.illnessId,
    ]
    const illnessIds: string[] = [...new Set(
      rawIllnessIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0),
    )]
    const medicationTaskIds = (dog.allMedTasks || [])
      .map((task: any) => task?._id)
      .filter(Boolean)
    onAction({
      type: 'recover',
      data: {
        dogId: dog.dogId,
        dogName: dog.dogName,
        illnessId: illnessIds[0] || '',
        illnessIds,
        medicationTaskIds,
      },
    })
  } else if (item.action === 'update_status') {
    onAction({ type: 'update_status', data: { dogId: dog.dogId, status: '治疗中', illnessId: dog.illnessId } })
  } else if (item.action === 'view_medication' && dog.linkedMedicationTaskId) {
    uni.navigateTo({ url: buildMedicationDetailUrl(dog.linkedMedicationTaskId) })
  } else if (item.action === 'start_medication') {
    navigateToMedicationFromIllnesses([{
      dogId: dog.dogId,
      name: dog.dogName,
      illnessId: dog.illnessId || '',
      illness: dog.illness || '生病',
      symptomSummary: dog.symptomSummary || '',
      treatmentStatus: dog.treatmentStatus || '观察中',
    }])
  }
}

function navigateToMedicationFromIllnesses(items: Array<{
  dogId: string
  name: string
  illnessId?: string
  illness?: string
  symptomSummary?: string
  treatmentStatus?: string
}>) {
  const dogList = items.map(item => ({ _id: item.dogId, name: item.name }))
  const illnessParam = items.length === 1 && items[0].illnessId
    ? `&illnessRecordId=${items[0].illnessId}`
    : ''
  const illnessLinks = items.reduce<MedicationRouteIllnessLink[]>((list, item) => {
    const illnessRecordId = typeof item.illnessId === 'string' ? item.illnessId.trim() : ''
    if (!illnessRecordId) return list

    list.push({
      dogId: item.dogId,
      illnessRecordId,
      primaryCondition: item.illness || '生病',
      symptomSummary: item.symptomSummary || '',
      treatmentStatus: item.treatmentStatus || '观察中',
    })
    return list
  }, [])
  const illnessLinksParam = illnessLinks.length > 1
    ? `&illnessLinks=${encodeURIComponent(JSON.stringify(illnessLinks))}`
    : ''

  uni.navigateTo({ url: `/pages/record/health-medication?batchDogs=${encodeURIComponent(JSON.stringify(dogList))}${illnessParam}${illnessLinksParam}` })
}

function confirmStopMedication() {
  showStopConfirm.value = false
  if (stopConfirmData.value) {
    onAction({ type: 'stop_medication', data: stopConfirmData.value })
  }
}

async function confirmQuickComplete() {
  if (!quickCompleteTask.value) return
  const taskId = quickCompleteTask.value._id || quickCompleteTask.value.id
  showQuickComplete.value = false

  // 乐观更新：立即触发消失动画
  removeCardLocally(taskId)

  // 后台静默调接口
  const result = await doCompleteTask(taskId)
  if (!result) {
    await loadTodayCards()
  } else {
    addSuppressedTasks(result?.data?.completedTaskIds || [taskId])
    await refreshHomeAfterLocalMutation()
  }
  quickCompleteNotes.value = ''
  quickCompleteTask.value = null
}

async function confirmBatchComplete() {
  if (batchSelectedCount.value === 0) return
  const selectedIds = Object.entries(batchSelected)
    .filter(([, v]) => v)
    .map(([k]) => k)

  const taskIdsToComplete = selectedIds
    .map(id => batchTaskIdByDogId[id] || batchDogList.value.find(dog => dog.id === id)?.taskId || '')
    .filter(Boolean)
  const result = await doBatchComplete(taskIdsToComplete)
  if (!result) {
    await loadTodayCards()
    return
  }
  addSuppressedTasks(result?.data?.completedTaskIds || taskIdsToComplete)
  showBatchComplete.value = false

  if (taskIdsToComplete.length === batchDogList.value.filter(dog => !dog.completed).length) {
    if (taskIdsToComplete.length > 0) removeCardLocally(taskIdsToComplete[0], true)
  } else {
    taskIdsToComplete.forEach(taskId => removeCardLocally(taskId))
  }
  await refreshHomeAfterLocalMutation()
}

onShow(async () => {
  isHomeActive.value = true
  const feedback = consumeSubmitFeedback('/pages/home/index')
  const pendingTarget = taskStore.consumePendingHomeTarget()
  let deferredTarget: HomeCardFocusTarget | '' = ''
  if (feedback?.message) {
    applyHomeFeedback(feedback)
    showSubmitToast(feedback.message)
  }

  // 确保家庭信息已加载
  if (!hasFamily.value) {
    const loadResult = await loadFamily()
    if (loadResult === 'error' && !hasFamily.value) {
      return
    }
  }
  // 没有家庭则跳转创建页
  if (!hasFamily.value) {
    uni.navigateTo({ url: '/pages/family/setup' })
    return
  }
  const familyId = getCurrentFamilyId()
  if (!familyId) return
  localSyncRuntime.setCurrentFamilyId(familyId)
  await localSyncRuntime.setActiveScope('home')
  selectedDate.value = startOfDay(Date.now())
  viewMode.value = 'today'
  dayCards.value = []

  if (pendingTarget) {
    hydrateHomeFromTaskStore()
    if (getHomeFocusCard(pendingTarget)) {
      scheduleHomeCardFocus(pendingTarget)
    } else {
      deferredTarget = pendingTarget
    }
  }

  // 首页回到前台先读本地事实源，云端同步只做后台校正，避免表单返回后卡片延迟出现。
  await loadAll()
  void localSyncRuntime.flushOutbox(familyId)
    .then(() => localSyncRuntime.syncScope('home'))
    .then(() => {
      if (isHomeActive.value) void loadAll()
    })
  if (deferredTarget) {
    scheduleHomeCardFocus(deferredTarget)
  }
})

onHide(() => {
  isHomeActive.value = false
})

watch(() => taskStore.pendingHomeTarget, (target) => {
  if (!isHomeActive.value || !target) return
  taskStore.consumePendingHomeTarget()
  scheduleHomeCardFocus(target)
})
</script>

<style lang="scss" scoped>
/* 首页 — 一比一还原 home-v1-final.html */
.home {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

/* ==================== HEADER ==================== */
.header {
  padding: 12px 20px 0;
}
.header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.greeting-title {
  display: block;
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.3;
}
.greeting-sub {
  display: block;
  font-size: 13px;
  color: var(--text-2);
  margin-top: 2px;
}
.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* ==================== SUMMARY PILLS ==================== */
.summary-pills {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 16px;
  padding-bottom: 16px;
}
.pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  padding: 8px 0;
  border-radius: 16px;
  transition: transform 0.12s ease, filter 0.12s ease;
  &:active { transform: scale(0.95); filter: brightness(0.95); }
}
.pill-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pill-label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
.pill-num {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}
.pill-red {
  background: var(--red-soft);
  .pill-label, .pill-num { color: var(--red); }
}
.pill-amber {
  background: var(--amber-soft);
  .pill-label, .pill-num { color: var(--amber); }
}
.pill-blue {
  background: var(--blue-soft);
  .pill-label, .pill-num { color: var(--blue); }
}
.pill-plum {
  background: var(--plum-soft);
  .pill-label, .pill-num { color: var(--plum); }
}

/* ==================== SECTION LABELS ==================== */
.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px 10px;
  border-radius: 16px;
  transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}
.section-label--nested {
  padding-top: 2px;
}
.section-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.section-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.5px;
}
.section-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--card-dim);
  border-radius: 999px;
  padding: 2px 8px;
}
.section-badge-text {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  color: var(--text-2);
}

.section-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.subsection-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 20px 8px;
  border-radius: 14px;
  transition: background 0.18s ease, box-shadow 0.18s ease;
}

.subsection-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
}

.subsection-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--card-dim);
  border-radius: 999px;
  padding: 2px 7px;
}

.subsection-badge-text {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  color: var(--text-2);
}

/* ==================== CARD FEED ==================== */
.card-area {
  flex: 1;
}
.card-feed {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 10px;
}

.home-card-anchor {
  position: relative;
  border-radius: 20px;
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}

.home-card-anchor--focus {
  box-shadow: 0 0 0 2px rgba(234, 170, 69, 0.24), 0 12px 30px rgba(234, 170, 69, 0.16);
  transform: translateY(-2px);
  animation: home-card-focus-pulse 1.05s ease-out 1;
}

.home-card-anchor--focus::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 24px;
  border: 2px solid rgba(234, 170, 69, 0.34);
  box-shadow: 0 0 0 6px rgba(234, 170, 69, 0.08);
  pointer-events: none;
  animation: home-card-focus-ring 1.05s ease-out 1;
}

@keyframes home-card-focus-pulse {
  0% {
    transform: translateY(0) scale(0.992);
    box-shadow: 0 0 0 0 rgba(234, 170, 69, 0);
  }
  38% {
    transform: translateY(-2px) scale(1.01);
    box-shadow: 0 0 0 2px rgba(234, 170, 69, 0.24), 0 16px 34px rgba(234, 170, 69, 0.18);
  }
  100% {
    transform: translateY(-2px) scale(1);
    box-shadow: 0 0 0 2px rgba(234, 170, 69, 0.24), 0 12px 30px rgba(234, 170, 69, 0.16);
  }
}

@keyframes home-card-focus-ring {
  0% {
    opacity: 0;
    transform: scale(0.98);
  }
  28% {
    opacity: 1;
    transform: scale(1.01);
  }
  100% {
    opacity: 0.72;
    transform: scale(1);
  }
}

.home-section + .home-section {
  margin-top: 4px;
}

.section-group > :deep(.group-card) {
  margin: 0 16px 10px;
}

/* ==================== TASK SHEETS (H-3, H-4, H-5) ==================== */
.task-sheet {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 12px;
}
.task-sheet__info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0 8px;
}
.task-sheet__info-text {
  flex: 1;
}
.task-sheet__task-title {
  display: block;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
}
.task-sheet__dog-name {
  display: block;
  font-size: 13px;
  color: var(--text-2);
  margin-top: 2px;
}
/* ---- 推迟任务犬只信息 ---- */
.postpone-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--card-dim);
  border-radius: 12px;
  margin-bottom: 16px;

  &__text {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
  }

  &__tag {
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--red-soft);
    font-size: 11px;
    font-weight: 700;
    color: var(--red);
  }
}

.task-sheet__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.task-sheet__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
}
.task-sheet__input {
  width: 100%;
  font-size: 15px;
  color: var(--text-1);
  padding: 10px 14px;
  border: 1.5px solid var(--text-4);
  border-radius: 14px;
  background: var(--card);
}
.task-sheet__picker {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 15px;
  color: var(--text-1);
  padding: 10px 14px;
  border: 1.5px solid var(--text-4);
  border-radius: 14px;
}
.task-sheet__quick-dates {
  display: flex;
  gap: 8px;
}
.task-sheet__quick-date {
  padding: 6px 14px;
  border-radius: var(--radius-btn);
  background: var(--card-dim);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  transition: all 0.12s ease;
  &:active { transform: scale(0.92); }
  &.active {
    background: var(--primary);
    color: #fff;
    box-shadow: 0 2px 8px rgba(234, 62, 119, 0.25);
  }
}
.task-sheet__actions {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}
.task-sheet__actions--triple {
  gap: 8px;
}
.task-sheet__btn {
  flex: 1;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-btn);
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
  &--cancel { background: var(--card-dim); }
  &--confirm { background: var(--primary); }
  &--warning { background: var(--amber); }
  &.disabled { opacity: 0.4; pointer-events: none; }
}
.task-sheet__btn-label {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.2px;
  &--success { color: #2f8f68; }
  &--warning { color: #fff; }
  &--primary { color: #fff; }
}
.task-sheet__btn--sick-secondary {
  background: linear-gradient(180deg, rgba(72, 190, 137, 0.14), rgba(72, 190, 137, 0.08));
  border: 1px solid rgba(72, 190, 137, 0.18);
}
.task-sheet__btn--sick-warning {
  background: linear-gradient(180deg, #f3b45a, #eda342);
  box-shadow: 0 6px 14px rgba(237, 163, 66, 0.18);
}
.task-sheet__btn--sick-primary {
  background: linear-gradient(135deg, rgba(147, 102, 201, 0.96), rgba(119, 86, 188, 0.96));
  box-shadow: 0 8px 18px rgba(132, 94, 194, 0.2);
}

/* H-5: 批量完成 */
.task-sheet__select-bar {
  padding: 4px 0;
}
.task-sheet__select-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.95); }
}
.task-sheet__select-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
}
.task-sheet__checkbox {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-checkbox);
  border: 2px solid var(--text-4);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease;
  &.checked {
    background: var(--green);
    border-color: var(--green);
  }
}
.task-sheet__dog-list {
  max-height: 280px;
}
.task-sheet__dog-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(216, 203, 189, 0.2);
  transition: transform 0.12s ease;
  &:active { transform: scale(0.97); }
  &:last-child { border-bottom: none; }
}
.task-sheet__dog-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--rose), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.task-sheet__dog-avatar--illness {
  background: linear-gradient(135deg, var(--red), #ef8d70);
}
.task-sheet__dog-avatar--plum {
  background: linear-gradient(135deg, var(--plum), #8e7de2);
}
.task-sheet__dog-copy {
  flex: 1;
  min-width: 0;
}
.task-sheet__dog-name-text {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.task-sheet__dog-detail-text {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-3);
}
.task-sheet__done-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--green);
  background: var(--green-soft);
  padding: 2px 8px;
  border-radius: var(--radius-tag);
}

/* 繁育动作菜单 */
.breeding-action-sheet {
  padding: 2px 0 16px;
}

.breeding-action-sheet__context {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 12px 14px;
  padding: 10px 12px;
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255, 249, 240, 0.94), rgba(255, 246, 235, 0.88));
  border: 1px solid rgba(232, 155, 62, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.breeding-action-sheet__badge {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(242, 167, 62, 0.16), rgba(242, 167, 62, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.breeding-action-sheet__copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.breeding-action-sheet__meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.breeding-action-sheet__eyebrow {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3px;
  color: var(--text-3);
}

.breeding-action-sheet__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}

.breeding-action-sheet__status {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 7px;
  border-radius: 999px;
  background: rgba(242, 167, 62, 0.12);
  color: var(--amber);
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

.breeding-action-sheet__primary {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--text-1);
}

.breeding-action-sheet__sub {
  display: block;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-3);
}

.breeding-action-sheet__alert {
  display: block;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--text-3);
}

.breeding-action-sheet__alert--danger {
  color: var(--red);
}

.breeding-action-sheet__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.breeding-action-sheet__item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 12px;
  min-height: 68px;
  padding: 0 16px;
  border-radius: 16px;
  border: 1px solid rgba(216, 203, 189, 0.2);
  background: rgba(255, 255, 255, 0.96);
  transition: transform 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;

  &:active {
    transform: scale(0.98);
    opacity: 0.9;
  }

  &--primary {
    background: linear-gradient(135deg, #f3b45a, #eaa552);
    border-color: rgba(232, 155, 62, 0.2);
    box-shadow: 0 12px 22px rgba(232, 155, 62, 0.18);
  }

  &--amber {
    border-color: rgba(242, 167, 62, 0.16);
    box-shadow: 0 4px 12px rgba(242, 167, 62, 0.06);
  }

  &--rose {
    border-color: rgba(234, 62, 119, 0.14);
    box-shadow: 0 4px 12px rgba(234, 62, 119, 0.05);
  }

  &--blue {
    border-color: rgba(78, 150, 226, 0.14);
    box-shadow: 0 4px 12px rgba(78, 150, 226, 0.05);
  }

  &--green {
    border-color: rgba(72, 190, 137, 0.14);
    box-shadow: 0 4px 12px rgba(72, 190, 137, 0.05);
  }
}

.breeding-action-sheet__icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .breeding-action-sheet__item--primary & {
    background: rgba(255, 255, 255, 0.22);
  }
}

.breeding-action-sheet__icon {
  font-size: 18px;
}

.breeding-action-sheet__item-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.breeding-action-sheet__label {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);

  .breeding-action-sheet__item--primary & {
    color: #fff;
  }
}

.breeding-action-sheet__hint {
  font-size: 11px;
  line-height: 1.35;
  color: var(--text-3);

  .breeding-action-sheet__item--primary & {
    color: rgba(255, 255, 255, 0.82);
  }
}

.breeding-action-sheet__arrow {
  font-size: 18px;
  color: var(--text-4);
  flex-shrink: 0;

  .breeding-action-sheet__item--primary & {
    color: rgba(255, 255, 255, 0.86);
  }
}

/* 健康关注操作菜单 */
.sick-menu-body { padding: 4px 0 16px; }
.sick-menu-item {
  display: flex; align-items: center; gap: 14px;
  margin: 0 12px 8px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid transparent;
  transition: transform 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease;
  &:last-child { margin-bottom: 0; }
  &:active { transform: scale(0.98); opacity: 0.9; }
  &--success {
    background: linear-gradient(180deg, rgba(72, 190, 137, 0.12), rgba(72, 190, 137, 0.06));
    border-color: rgba(72, 190, 137, 0.14);
  }
  &--illness {
    background: linear-gradient(180deg, rgba(224, 82, 82, 0.1), rgba(224, 82, 82, 0.05));
    border-color: rgba(224, 82, 82, 0.12);
  }
  &--plum {
    background: linear-gradient(180deg, rgba(147, 102, 201, 0.12), rgba(147, 102, 201, 0.06));
    border-color: rgba(132, 94, 194, 0.14);
    box-shadow: 0 8px 18px rgba(132, 94, 194, 0.08);
  }
}
.sick-menu-item__icon-wrap {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  &--success { background: rgba(72, 190, 137, 0.14); }
  &--illness { background: rgba(224, 82, 82, 0.12); }
  &--plum { background: rgba(147, 102, 201, 0.14); }
}
.sick-menu-item__icon {
  font-size: 18px;
  &--success { color: #2f8f68; }
  &--illness { color: var(--red); }
  &--plum { color: var(--plum); }
}
.sick-menu-item__label { font-size: 15px; font-weight: 600; color: var(--text-1); }

/* 停止用药确认 */
.stop-confirm-body { padding: 4px 20px 24px; text-align: center; }
.stop-confirm-icon-wrap {
  width: 52px; height: 52px; border-radius: 16px;
  background: var(--red-soft);
  margin: 0 auto 14px;
  display: flex; align-items: center; justify-content: center;
}
.stop-confirm-icon { font-size: 26px; color: var(--red); }
.stop-confirm-title {
  display: block; font-size: 18px; font-weight: 800;
  color: var(--text-1); font-family: var(--font-display);
  margin-bottom: 10px;
}
.stop-confirm-desc {
  display: block; font-size: 15px; color: var(--text-2); line-height: 1.6;
}
.stop-confirm-bold { font-weight: 700; color: var(--text-1); }
.stop-confirm-sub {
  display: block; font-size: 13px; color: var(--text-3); margin-top: 6px;
}
.stop-confirm-actions { display: flex; gap: 12px; margin-top: 24px; }
.stop-confirm-btn {
  flex: 1; padding: 14px; border-radius: 14px; text-align: center;
  font-size: 15px; font-weight: 700;
  transition: transform 0.12s, opacity 0.12s;
  &:active { transform: scale(0.96); opacity: 0.85; }
  &--cancel { background: var(--card-dim); color: var(--text-2); }
  &--danger { background: var(--red); color: #fff; }
}
</style>
