<template>
  <view class="page">
    <view class="primary-page-header">
      <view class="primary-page-header__row">
        <text class="primary-page-header__title">财务</text>
        <view class="primary-page-header__actions">
          <view class="primary-page-header__action primary-page-header__action--primary" @click="showAddSheet = true">
            <text class="primary-page-header__icon primary-page-header__icon--primary">add</text>
          </view>
          <view class="primary-page-header__action" @click="goToStats">
            <text class="primary-page-header__icon">bar_chart</text>
          </view>
        </view>
      </view>

      <view class="month-selector">
        <text
          class="material-icons-round month-selector__arrow"
          :class="{ 'month-selector__arrow--disabled': monthNavigationDisabled }"
          @click="changeMonth(-1)"
        >chevron_left</text>
        <text class="month-selector__text">{{ monthLabel }}</text>
        <text
          class="material-icons-round month-selector__arrow"
          :class="{ 'month-selector__arrow--disabled': monthNavigationDisabled }"
          @click="changeMonth(1)"
        >chevron_right</text>
      </view>
    </view>

    <view class="summary-card">
      <view class="summary-card__item">
        <text class="summary-card__label">{{ summaryPrefix }}收入</text>
        <text class="summary-card__amount summary-card__amount--income">+¥{{ formatNum(summary.totalIncome) }}</text>
      </view>
      <view class="summary-card__divider" />
      <view class="summary-card__item">
        <text class="summary-card__label">{{ summaryPrefix }}支出</text>
        <text class="summary-card__amount summary-card__amount--expense">-¥{{ formatNum(summary.totalExpense) }}</text>
      </view>
      <view class="summary-card__divider" />
      <view class="summary-card__item">
        <text class="summary-card__label">净利润</text>
        <text class="summary-card__amount" :class="profitAmountClass">{{ formatSignedAmount(summary.netProfit) }}</text>
      </view>
    </view>

    <view class="filter-tabs primary-page-tabs primary-page-tabs--section">
      <view
        v-for="f in typeFilters"
        :key="f.value"
        class="filter-tab primary-page-tab"
        :class="{ 'filter-tab--active primary-page-tab--active': appliedFilters.type === f.value }"
        @click="switchTypeTab(f.value)"
      >
        <text>{{ f.label }}</text>
      </view>
      <view class="filter-tabs__spacer primary-page-tabs__spacer" />
      <view class="filter-entry primary-page-filter-action" @click="showFilterSheet = true">
        <text class="primary-page-filter-icon" :class="{ 'primary-page-filter-icon--active': hasActiveFilters }">tune</text>
      </view>
    </view>

    <view v-if="activeFilterChips.length" class="active-filters">
      <view class="active-filters__clear-all" @click="clearAllFilters">
        <text>清空全部</text>
      </view>
      <scroll-view scroll-x class="active-filters__scroll" show-scrollbar="false" enhanced>
        <view class="active-filters__track">
          <view
            v-for="chip in activeFilterChips"
            :key="chip.key"
            class="active-filters__chip primary-page-applied-chip"
          >
            <text class="active-filters__chip-text primary-page-applied-chip-text">{{ chip.label }}</text>
            <text class="material-icons-round active-filters__chip-icon primary-page-applied-chip-icon" @click="clearFilterChip(chip.key)">close</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <view v-if="loading" class="primary-page-loading">
      <BSkeleton :rows="4" />
    </view>

    <view v-else-if="transactions.length > 0" class="card-feed">
      <view
        v-for="tx in transactions"
        :key="tx._id"
        class="flow-card"
        :class="tx._txType === 'income' ? 'flow-card--income' : 'flow-card--expense'"
        @click="goToTxDetail(tx)"
      >
        <view class="flow-item">
          <view class="flow-dot" :class="tx._txType === 'income' ? 'flow-dot--income' : 'flow-dot--expense'" />
          <BIconBox :icon="getFlowIcon(tx)" :color="getFlowIconColor(tx)" />
          <view class="flow-middle">
            <text class="flow-desc">{{ tx._txType === 'expense' ? tx.category : tx.type }}</text>
            <text class="flow-sub">{{ getFlowSubTitle(tx) }}</text>
            <text v-if="getFlowMeta(tx)" class="flow-meta">{{ getFlowMeta(tx) }}</text>
          </view>
          <view class="flow-right">
            <text class="flow-amount" :class="tx._txType === 'income' ? 'flow-amount--income' : 'flow-amount--expense'">
              {{ tx._txType === 'income' ? '+' : '-' }}¥{{ formatNum(getTransactionAmount(tx)) }}
            </text>
            <text class="flow-date">{{ formatDate(tx.date) }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="primary-page-empty">
      <BEmpty
        icon="receipt_long"
        title="暂无收支记录"
        description="点击右上角 + 开始记录"
      />
    </view>

    <BSheet v-model:visible="showAddSheet" title="添加记录" height="auto">
      <view class="add-sheet">
        <view class="add-sheet__item add-sheet__item--expense" @click="goToExpenseAdd">
          <view class="add-sheet__icon add-sheet__icon--expense">
            <text class="material-icons-round" style="font-size: 20px; color: var(--green);">remove_circle</text>
          </view>
          <view class="add-sheet__info">
            <text class="add-sheet__title add-sheet__title--expense">记录支出</text>
            <text class="add-sheet__desc">食品、医疗、日常开销等</text>
          </view>
          <text class="material-icons-round" style="font-size: 18px; color: var(--text-4);">chevron_right</text>
        </view>
        <view class="add-sheet__item add-sheet__item--income" @click="goToIncomeAdd">
          <view class="add-sheet__icon add-sheet__icon--income">
            <text class="material-icons-round" style="font-size: 20px; color: var(--red);">add_circle</text>
          </view>
          <view class="add-sheet__info">
            <text class="add-sheet__title add-sheet__title--income">记录收入</text>
            <text class="add-sheet__desc">幼犬销售、定金等</text>
          </view>
          <text class="material-icons-round" style="font-size: 18px; color: var(--text-4);">chevron_right</text>
        </view>
      </view>
    </BSheet>

    <BSheet v-model:visible="showFilterSheet" title="筛选流水" height="78%">
      <view class="filter-sheet">
        <view class="filter-sheet__hero">
          <text class="filter-sheet__eyebrow">多条件组合筛选</text>
          <text class="filter-sheet__hint">组合多个条件，快速定位这段时间内的收入和支出流水</text>
        </view>

        <view class="filter-sheet__content">
          <view class="filter-section filter-section--card">
            <view class="filter-section__head">
              <text class="filter-section__title">时间范围</text>
            </view>
            <view class="filter-chip-row">
            <view
              v-for="option in dateRangeOptions"
              :key="option.value"
              class="filter-chip filter-chip--segment"
              :class="{ 'filter-chip--active': draftFilters.dateRange === option.value }"
              @click="setDraftDateRange(option.value)"
            >
              <text>{{ option.label }}</text>
            </view>
            </view>
            <view v-if="draftFilters.dateRange === 'custom'" class="custom-date-row">
              <picker mode="date" :value="draftStartDateStr" @change="onDraftDateChange('start', $event)">
                <view class="custom-date-card">
                  <text class="custom-date-card__label">开始日期</text>
                  <text class="custom-date-card__value">{{ draftStartDateStr || '请选择' }}</text>
                </view>
              </picker>
              <picker mode="date" :value="draftEndDateStr" @change="onDraftDateChange('end', $event)">
                <view class="custom-date-card">
                  <text class="custom-date-card__label">结束日期</text>
                  <text class="custom-date-card__value">{{ draftEndDateStr || '请选择' }}</text>
                </view>
              </picker>
            </view>
          </view>

          <view class="filter-section filter-section--card">
            <view class="filter-section__head">
              <text class="filter-section__title">交易类型</text>
            </view>
            <view class="filter-chip-row">
            <view
              v-for="f in typeFilters"
              :key="f.value"
              class="filter-chip filter-chip--segment"
              :class="{ 'filter-chip--active': draftFilters.type === f.value }"
              @click="setDraftType(f.value)"
            >
              <text>{{ f.label }}</text>
            </view>
          </view>
          </view>

          <view v-if="draftFilters.type !== 'expense'" class="filter-section filter-section--card">
            <view class="filter-section__head">
              <text class="filter-section__title">收入分类</text>
              <text v-if="draftFilters.selectedIncomeTypes.length" class="filter-section__meta">{{ draftFilters.selectedIncomeTypes.length }} 项已选</text>
            </view>
            <view class="filter-chip-row">
            <view
              v-for="incomeType in incomeTypeOptions"
              :key="incomeType"
              class="filter-chip filter-chip--segment filter-chip--segment-compact"
              :class="{ 'filter-chip--active': draftFilters.selectedIncomeTypes.includes(incomeType) }"
              @click="toggleDraftIncomeType(incomeType)"
            >
              <text>{{ incomeType }}</text>
            </view>
          </view>
          </view>

          <view v-if="draftFilters.type !== 'income'" class="filter-section filter-section--card">
            <view class="filter-section__head">
              <text class="filter-section__title">支出分类</text>
            </view>
            <text class="filter-section__helper">可先选分组，也可直接点具体分类</text>
            <text class="filter-section__subhead">支出分组</text>
            <view class="filter-chip-row">
            <view
              v-for="group in expenseGroupOptions"
              :key="group.key"
              class="filter-chip filter-chip--segment filter-chip--segment-compact"
              :class="{ 'filter-chip--active': draftFilters.selectedExpenseGroups.includes(group.key) }"
              @click="toggleDraftExpenseGroup(group.key)"
            >
              <text>{{ group.label }}</text>
            </view>
            </view>

            <view class="grouped-category-list">
              <view
                v-for="group in groupedExpenseCategories"
                :key="group.key"
                class="grouped-category-card"
                :class="{
                  'grouped-category-card--active': draftFilters.selectedExpenseGroups.includes(group.key) || getGroupSelectionCount(group.key) > 0,
                }"
              >
                <view class="grouped-category-card__head">
                  <view class="grouped-category-card__title-wrap">
                    <view class="grouped-category-card__dot" :class="`grouped-category-card__dot--${group.key}`" />
                    <text class="grouped-category-card__title">{{ group.label }}</text>
                  </view>
                  <text
                    v-if="getGroupSelectionBadge(group.key)"
                    class="grouped-category-card__badge"
                  >{{ getGroupSelectionBadge(group.key) }}</text>
                </view>
                <view class="filter-chip-row filter-chip-row--sub">
                  <view
                    v-for="category in group.items"
                    :key="category.name"
                    class="filter-chip filter-chip--soft"
                    :class="{ 'filter-chip--active-soft': draftFilters.selectedExpenseCategories.includes(category.name) }"
                    @click="toggleDraftExpenseCategory(category.name)"
                  >
                    <text>{{ category.name }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>

          <view class="filter-section filter-section--card">
            <view class="filter-section__head">
              <text class="filter-section__title">关联对象</text>
            </view>
            <view
              class="filter-toggle"
              :class="{ 'filter-toggle--active': draftFilters.unlinkedOnly }"
              @click="toggleDraftUnlinkedOnly"
            >
              <view class="filter-toggle__copy">
                <text class="filter-toggle__title">仅看无关联</text>
                <text class="filter-toggle__desc">打开后将忽略犬只、窝和繁育周期的筛选条件</text>
              </view>
              <view class="filter-toggle__switch" :class="{ 'filter-toggle__switch--on': draftFilters.unlinkedOnly }">
                <view class="filter-toggle__thumb" />
              </view>
            </view>

            <view class="link-filter-list">
            <view
              class="link-filter-card"
              :class="{ 'link-filter-card--disabled': draftFilters.unlinkedOnly }"
              @click="!draftFilters.unlinkedOnly && (showDogPicker = true)"
            >
              <view class="link-filter-card__lead">
                <view class="link-filter-card__icon">
                  <text class="material-icons-round" style="font-size: 16px; color: var(--primary);">pets</text>
                </view>
                <view class="link-filter-card__copy">
                  <view class="link-filter-card__head">
                    <text class="link-filter-card__title">犬只</text>
                    <text v-if="draftFilters.selectedDogNames.length" class="material-icons-round link-filter-card__clear" @click.stop="clearDraftLink('dog')">close</text>
                  </view>
                  <text class="link-filter-card__value" :class="{ 'link-filter-card__value--placeholder': !draftFilters.selectedDogNames.length }">
                    {{ formatSelectionSummary(draftFilters.selectedDogNames, draftFilters.unlinkedOnly ? '已禁用' : '按犬只筛选') }}
                  </text>
                </view>
              </view>
              <text class="material-icons-round link-filter-card__arrow">chevron_right</text>
            </view>

            <view
              v-if="draftFilters.type !== 'income'"
              class="link-filter-card"
              :class="{ 'link-filter-card--disabled': draftFilters.unlinkedOnly }"
              @click="!draftFilters.unlinkedOnly && (showLitterPicker = true)"
            >
              <view class="link-filter-card__lead">
                <view class="link-filter-card__icon">
                  <text class="material-icons-round" style="font-size: 16px; color: var(--primary);">child_care</text>
                </view>
                <view class="link-filter-card__copy">
                  <view class="link-filter-card__head">
                    <text class="link-filter-card__title">窝</text>
                    <text v-if="draftFilters.selectedLitterNames.length" class="material-icons-round link-filter-card__clear" @click.stop="clearDraftLink('litter')">close</text>
                  </view>
                  <text class="link-filter-card__value" :class="{ 'link-filter-card__value--placeholder': !draftFilters.selectedLitterNames.length }">
                    {{ formatSelectionSummary(draftFilters.selectedLitterNames, draftFilters.unlinkedOnly ? '已禁用' : '按窝筛选') }}
                  </text>
                </view>
              </view>
              <text class="material-icons-round link-filter-card__arrow">chevron_right</text>
            </view>

            <view
              v-if="draftFilters.type !== 'income'"
              class="link-filter-card"
              :class="{ 'link-filter-card--disabled': draftFilters.unlinkedOnly }"
              @click="!draftFilters.unlinkedOnly && (showCyclePicker = true)"
            >
              <view class="link-filter-card__lead">
                <view class="link-filter-card__icon">
                  <text class="material-icons-round" style="font-size: 16px; color: var(--primary);">autorenew</text>
                </view>
                <view class="link-filter-card__copy">
                  <view class="link-filter-card__head">
                    <text class="link-filter-card__title">繁育周期</text>
                    <text v-if="draftFilters.selectedCycleNames.length" class="material-icons-round link-filter-card__clear" @click.stop="clearDraftLink('cycle')">close</text>
                  </view>
                  <text class="link-filter-card__value" :class="{ 'link-filter-card__value--placeholder': !draftFilters.selectedCycleNames.length }">
                    {{ formatSelectionSummary(draftFilters.selectedCycleNames, draftFilters.unlinkedOnly ? '已禁用' : '按繁育周期筛选') }}
                  </text>
                </view>
              </view>
              <text class="material-icons-round link-filter-card__arrow">chevron_right</text>
            </view>
          </view>
          </view>

          <view class="filter-section filter-section--card">
            <view class="filter-section__head">
              <text class="filter-section__title">排序</text>
            </view>
            <view class="filter-chip-row">
              <view
                v-for="option in sortOptions"
                :key="option.value"
                class="filter-chip filter-chip--segment filter-chip--segment-compact"
                :class="{ 'filter-chip--active': draftFilters.sort === option.value }"
                @click="draftFilters.sort = option.value"
              >
                <text>{{ option.label }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="filter-actions filter-actions--sticky">
          <button class="filter-actions__reset" @click="resetDraftFilters">重置</button>
          <button class="filter-actions__apply" :disabled="!canApplyDraftFilters" @click="applyDraftFilters">应用筛选</button>
        </view>
      </view>
    </BSheet>

    <BDogPicker
      v-model:visible="showDogPicker"
      title="选择犬只"
      :multiple="true"
      :selected-ids="draftFilters.selectedDogIds"
      @selectMultiple="onDogFiltersSelected"
    />

    <BLitterSelector
      v-model:visible="showLitterPicker"
      :multiple="true"
      :selected-ids="draftFilters.selectedLitterIds"
      @selectMultiple="onLitterFiltersSelected"
    />

    <BCycleSelector
      v-model:visible="showCyclePicker"
      :multiple="true"
      :selected-ids="draftFilters.selectedCycleIds"
      @selectMultiple="onCycleFiltersSelected"
    />

    <BNavBar current="finance" />
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BNavBar from '@/components/layout/BNavBar.vue'
import BIconBox from '@/components/base/BIconBox.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'
import BLitterSelector from '@/components/form/BLitterSelector.vue'
import BCycleSelector from '@/components/form/BCycleSelector.vue'
import {
  DEFAULT_EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_GROUPS,
  FINANCE_DATE_RANGE_OPTIONS,
  FINANCE_SORT_OPTIONS,
  INCOME_TYPES,
  getExpenseCategoryGroupKey,
  getExpenseCategoryGroupLabel,
  groupExpenseCategories,
  normalizeExpenseCategoryGroupKey,
} from '@/constants/financeCategories'
import type { ExpenseCategory, ExpenseCategoryGroupKey } from '@/types/finance'

type FinanceFilterType = '' | 'income' | 'expense'
type FinanceDateRangeValue = typeof FINANCE_DATE_RANGE_OPTIONS[number]['value']
type FinanceSortValue = typeof FINANCE_SORT_OPTIONS[number]['value']

interface FinanceFilterState {
  type: FinanceFilterType
  dateRange: FinanceDateRangeValue
  selectedIncomeTypes: string[]
  selectedExpenseGroups: ExpenseCategoryGroupKey[]
  selectedExpenseCategories: string[]
  selectedDogIds: string[]
  selectedDogNames: string[]
  selectedLitterIds: string[]
  selectedLitterNames: string[]
  selectedCycleIds: string[]
  selectedCycleNames: string[]
  unlinkedOnly: boolean
  sort: FinanceSortValue
  customStartDate: number
  customEndDate: number
}

const typeFilters: Array<{ label: string; value: FinanceFilterType }> = [
  { label: '全部', value: '' },
  { label: '收入', value: 'income' },
  { label: '支出', value: 'expense' },
]

const dateRangeOptions = FINANCE_DATE_RANGE_OPTIONS
const sortOptions = FINANCE_SORT_OPTIONS
const incomeTypeOptions = [...INCOME_TYPES]
const expenseGroupOptions = [...EXPENSE_CATEGORY_GROUPS]

const transactions = ref<any[]>([])
const loading = ref(false)
const showAddSheet = ref(false)
const showFilterSheet = ref(false)
const showDogPicker = ref(false)
const showLitterPicker = ref(false)
const showCyclePicker = ref(false)
const currentMonth = ref(new Date())
const categories = ref<ExpenseCategory[]>(DEFAULT_EXPENSE_CATEGORIES.map(item => ({ ...item })))

const summary = reactive({
  totalIncome: 0,
  totalExpense: 0,
  netProfit: 0,
})

function monthStartTs(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime()
}

function monthEndTs(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime()
}

function createDefaultFilters(date = currentMonth.value): FinanceFilterState {
  return {
    type: '',
    dateRange: 'this_month',
    selectedIncomeTypes: [],
    selectedExpenseGroups: [],
    selectedExpenseCategories: [],
    selectedDogIds: [],
    selectedDogNames: [],
    selectedLitterIds: [],
    selectedLitterNames: [],
    selectedCycleIds: [],
    selectedCycleNames: [],
    unlinkedOnly: false,
    sort: 'date_desc',
    customStartDate: monthStartTs(date),
    customEndDate: monthEndTs(date),
  }
}

const appliedFilters = reactive<FinanceFilterState>(createDefaultFilters())
const draftFilters = reactive<FinanceFilterState>(createDefaultFilters())

function syncDraftWithApplied() {
  Object.assign(draftFilters, { ...appliedFilters })
}

function uniqStrings(values: string[] = []) {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeCategories(rawCategories: any[]) {
  const merged = new Map<string, ExpenseCategory>()
  for (const item of DEFAULT_EXPENSE_CATEGORIES) {
    merged.set(item.name, { ...item })
  }
  for (const item of rawCategories || []) {
    if (!item) continue
    const name = typeof item === 'string' ? item : item.name
    if (!name) continue
    const parentGroup = typeof item === 'string'
      ? 'other'
      : normalizeExpenseCategoryGroupKey(item.parent_group || getExpenseCategoryGroupKey(name))
    merged.set(name, {
      name,
      parent_group: parentGroup,
      is_default: !!merged.get(name)?.is_default,
    })
  }
  return Array.from(merged.values())
}

function normalizeFilters(input: FinanceFilterState): FinanceFilterState {
  const next = {
    ...input,
    selectedIncomeTypes: uniqStrings(input.selectedIncomeTypes).filter(type => incomeTypeOptions.includes(type as any)),
    selectedExpenseGroups: uniqStrings(input.selectedExpenseGroups).filter((group): group is ExpenseCategoryGroupKey => {
      return expenseGroupOptions.some(item => item.key === group)
    }),
    selectedExpenseCategories: uniqStrings(input.selectedExpenseCategories),
    selectedDogIds: uniqStrings(input.selectedDogIds),
    selectedDogNames: uniqStrings(input.selectedDogNames),
    selectedLitterIds: uniqStrings(input.selectedLitterIds),
    selectedLitterNames: uniqStrings(input.selectedLitterNames),
    selectedCycleIds: uniqStrings(input.selectedCycleIds),
    selectedCycleNames: uniqStrings(input.selectedCycleNames),
    customStartDate: input.customStartDate || monthStartTs(currentMonth.value),
    customEndDate: input.customEndDate || monthEndTs(currentMonth.value),
  }

  if (next.type === 'income') {
    next.selectedExpenseGroups = []
    next.selectedExpenseCategories = []
    next.selectedLitterIds = []
    next.selectedLitterNames = []
    next.selectedCycleIds = []
    next.selectedCycleNames = []
  }

  if (next.type === 'expense') {
    next.selectedIncomeTypes = []
  }

  const validCategories = new Set(categories.value.map(item => item.name))
  next.selectedExpenseCategories = next.selectedExpenseCategories.filter(name => validCategories.has(name))

  if (next.unlinkedOnly) {
    next.selectedDogIds = []
    next.selectedDogNames = []
    next.selectedLitterIds = []
    next.selectedLitterNames = []
    next.selectedCycleIds = []
    next.selectedCycleNames = []
  }

  if (next.dateRange !== 'custom') {
    next.customStartDate = monthStartTs(currentMonth.value)
    next.customEndDate = monthEndTs(currentMonth.value)
  }

  return next
}

const groupedExpenseCategories = computed(() => groupExpenseCategories(categories.value))

const monthNavigationDisabled = computed(() => appliedFilters.dateRange === 'custom')

const monthLabel = computed(() => {
  if (appliedFilters.dateRange === 'custom') {
    return `${formatDateRangeLabel(appliedFilters.customStartDate)} - ${formatDateRangeLabel(appliedFilters.customEndDate)}`
  }

  if (appliedFilters.dateRange === 'this_year') {
    return `${currentMonth.value.getFullYear()}年`
  }

  if (appliedFilters.dateRange === 'this_quarter') {
    const quarter = Math.floor(currentMonth.value.getMonth() / 3) + 1
    return `${currentMonth.value.getFullYear()}年 Q${quarter}`
  }

  const displayDate = new Date(currentMonth.value)
  if (appliedFilters.dateRange === 'last_month') {
    displayDate.setMonth(displayDate.getMonth() - 1)
  }
  return `${displayDate.getFullYear()}年${displayDate.getMonth() + 1}月`
})

const summaryPrefix = computed(() => {
  if (appliedFilters.dateRange === 'custom') return '所选范围'
  const option = dateRangeOptions.find(item => item.value === appliedFilters.dateRange)
  return option?.label || '当前范围'
})

const profitAmountClass = computed(() => {
  if (summary.netProfit > 0) return 'summary-card__amount--profit-positive'
  if (summary.netProfit < 0) return 'summary-card__amount--profit-negative'
  return 'summary-card__amount--profit-neutral'
})

const hasActiveFilters = computed(() => {
  return appliedFilters.type !== ''
    || appliedFilters.dateRange !== 'this_month'
    || appliedFilters.selectedIncomeTypes.length > 0
    || appliedFilters.selectedExpenseGroups.length > 0
    || appliedFilters.selectedExpenseCategories.length > 0
    || appliedFilters.selectedDogIds.length > 0
    || appliedFilters.selectedLitterIds.length > 0
    || appliedFilters.selectedCycleIds.length > 0
    || appliedFilters.unlinkedOnly
    || appliedFilters.sort !== 'date_desc'
})

const activeFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string }> = []
  if (appliedFilters.type) {
    chips.push({
      key: 'type',
      label: typeFilters.find(item => item.value === appliedFilters.type)?.label || '全部',
    })
  }
  if (appliedFilters.dateRange !== 'this_month') {
    chips.push({
      key: 'dateRange',
      label: appliedFilters.dateRange === 'custom' ? '自定义时间' : monthLabel.value,
    })
  }
  if (appliedFilters.selectedIncomeTypes.length) {
    chips.push({
      key: 'incomeTypes',
      label: `收入 ${appliedFilters.selectedIncomeTypes.length}项`,
    })
  }
  if (appliedFilters.selectedExpenseGroups.length) {
    chips.push({
      key: 'expenseGroups',
      label: `支出分组 ${appliedFilters.selectedExpenseGroups.length}项`,
    })
  }
  if (appliedFilters.selectedExpenseCategories.length) {
    chips.push({
      key: 'expenseCategories',
      label: `支出分类 ${appliedFilters.selectedExpenseCategories.length}项`,
    })
  }
  if (appliedFilters.selectedDogNames.length) chips.push({ key: 'dogs', label: `犬只 ${appliedFilters.selectedDogNames.length}项` })
  if (appliedFilters.selectedLitterNames.length) chips.push({ key: 'litters', label: `窝 ${appliedFilters.selectedLitterNames.length}项` })
  if (appliedFilters.selectedCycleNames.length) chips.push({ key: 'cycles', label: `繁育周期 ${appliedFilters.selectedCycleNames.length}项` })
  if (appliedFilters.unlinkedOnly) chips.push({ key: 'unlinkedOnly', label: '仅看无关联' })
  if (appliedFilters.sort !== 'date_desc') {
    chips.push({
      key: 'sort',
      label: sortOptions.find(item => item.value === appliedFilters.sort)?.label || '最近记录',
    })
  }
  return chips
})

const draftStartDateStr = computed(() => formatDateInput(draftFilters.customStartDate))
const draftEndDateStr = computed(() => formatDateInput(draftFilters.customEndDate))
const canApplyDraftFilters = computed(() => {
  if (draftFilters.dateRange !== 'custom') return true
  return !!draftFilters.customStartDate && !!draftFilters.customEndDate && draftFilters.customEndDate >= draftFilters.customStartDate
})

const { run: fetchTransactions } = useCloudCall<{ data: any[] }>('finance-service', 'getTransactionList')
const { run: fetchSummary } = useCloudCall<{ data: any }>('finance-service', 'getFinancialSummary')
const { run: fetchCategories } = useCloudCall<{ data: ExpenseCategory[] }>('finance-service', 'getExpenseCategories')

function buildQueryPayload(filters: FinanceFilterState) {
  const payload: Record<string, any> = {
    type: filters.type || undefined,
    incomeTypes: filters.selectedIncomeTypes.length ? filters.selectedIncomeTypes : undefined,
    expenseCategoryGroups: filters.selectedExpenseGroups.length ? filters.selectedExpenseGroups : undefined,
    expenseCategories: filters.selectedExpenseCategories.length ? filters.selectedExpenseCategories : undefined,
    dogIds: filters.selectedDogIds.length ? filters.selectedDogIds : undefined,
    litterIds: filters.selectedLitterIds.length ? filters.selectedLitterIds : undefined,
    cycleIds: filters.selectedCycleIds.length ? filters.selectedCycleIds : undefined,
    unlinkedOnly: filters.unlinkedOnly || undefined,
    sort: filters.sort,
  }

  if (filters.dateRange === 'custom') {
    payload.dateRange = {
      value: 'custom',
      startDate: filters.customStartDate,
      endDate: filters.customEndDate,
    }
  } else {
    payload.dateRange = filters.dateRange
    payload.year = currentMonth.value.getFullYear()
    payload.month = currentMonth.value.getMonth() + 1
    payload.period = filters.dateRange === 'this_year' ? 'yearly' : 'monthly'
  }

  return payload
}

function getTransactionAmount(tx: any) {
  return tx._txType === 'expense' ? (tx.total_amount || 0) : Math.abs(tx.amount || 0)
}

function formatNum(n: number) {
  if (n == null) return '0'
  return n.toLocaleString()
}

function formatSignedAmount(n: number) {
  if (!n) return '¥0'
  const sign = n > 0 ? '+' : '-'
  return `${sign}¥${formatNum(Math.abs(n))}`
}

function formatDate(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function formatDateInput(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateRangeLabel(ts: number) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function toPickerTimestamp(dateStr: string) {
  return new Date(`${dateStr}T00:00:00+08:00`).getTime()
}

function formatSelectionSummary(names: string[], placeholder: string) {
  if (!names.length) return placeholder
  if (names.length <= 2) return names.join('、')
  return `${names.slice(0, 2).join('、')} +${names.length - 2}`
}

function getGroupSelectionCount(groupKey: ExpenseCategoryGroupKey) {
  const group = groupedExpenseCategories.value.find(item => item.key === groupKey)
  if (!group) return 0
  return group.items.filter(item => draftFilters.selectedExpenseCategories.includes(item.name)).length
}

function getGroupSelectionBadge(groupKey: ExpenseCategoryGroupKey) {
  const count = getGroupSelectionCount(groupKey)
  const groupSelected = draftFilters.selectedExpenseGroups.includes(groupKey)
  if (groupSelected && count > 0) return `分组 + ${count}项`
  if (groupSelected) return '分组已选'
  if (count > 0) return `${count}项已选`
  return ''
}

function getFlowIcon(tx: any) {
  if (tx._txType === 'income') {
    if (tx.type === '定金保留') return 'savings'
    return 'paid'
  }
  const map: Record<string, string> = {
    食品: 'restaurant',
    营养品: 'medication',
    医疗: 'local_hospital',
    配种费: 'favorite',
    固定开销: 'home',
  }
  return map[tx.category] || 'receipt_long'
}

function getFlowIconColor(tx: any): 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal' {
  return tx._txType === 'income' ? 'red' : 'green'
}

function getFlowSubTitle(tx: any) {
  if (tx._txType === 'expense') return tx.category_group_label || getExpenseCategoryGroupLabel(getExpenseCategoryGroupKey(tx.category))
  return tx.dog_name || '收入记录'
}

function getFlowMeta(tx: any) {
  if (tx._txType === 'income') return ''
  if (tx.dog_names?.length) return tx.dog_names.join('、')
  if (tx.linked_litter_id) {
    const damName = tx.dam_name || '关联窝'
    const litterNumber = tx.litter_number ? ` · 第${tx.litter_number}窝` : ''
    return `${damName}${litterNumber}`
  }
  if (tx.linked_cycle_id) {
    return tx.dam_name ? `${tx.dam_name} · 繁育周期` : '繁育周期'
  }
  return ''
}

async function loadCategories() {
  const res = await fetchCategories()
  if (res?.data?.length) {
    categories.value = normalizeCategories(res.data)
  } else {
    categories.value = normalizeCategories(DEFAULT_EXPENSE_CATEGORIES)
  }
}

async function loadPage() {
  const hasData = transactions.value.length > 0
  if (!hasData) loading.value = true

  const payload = buildQueryPayload(appliedFilters)
  const [txResult, sumResult] = await Promise.all([
    fetchTransactions(payload),
    fetchSummary(payload),
  ])

  transactions.value = txResult?.data || []
  summary.totalIncome = sumResult?.data?.totalIncome || 0
  summary.totalExpense = sumResult?.data?.totalExpense || 0
  summary.netProfit = sumResult?.data?.netProfit || 0
  loading.value = false
}

function syncAndReload(next: FinanceFilterState) {
  Object.assign(appliedFilters, normalizeFilters(next))
  syncDraftWithApplied()
  loadPage()
}

function switchTypeTab(type: FinanceFilterType) {
  syncAndReload({
    ...appliedFilters,
    type,
  })
}

function changeMonth(delta: number) {
  if (monthNavigationDisabled.value) return
  const date = new Date(currentMonth.value)
  if (appliedFilters.dateRange === 'this_year') {
    date.setFullYear(date.getFullYear() + delta)
  } else if (appliedFilters.dateRange === 'this_quarter') {
    date.setMonth(date.getMonth() + (delta * 3))
  } else {
    date.setMonth(date.getMonth() + delta)
  }
  currentMonth.value = date
  loadPage()
}

function setDraftDateRange(value: FinanceDateRangeValue) {
  draftFilters.dateRange = value
  if (value !== 'custom') {
    draftFilters.customStartDate = monthStartTs(currentMonth.value)
    draftFilters.customEndDate = monthEndTs(currentMonth.value)
  }
}

function setDraftType(value: FinanceFilterType) {
  draftFilters.type = value
  Object.assign(draftFilters, normalizeFilters(draftFilters))
}

function toggleArrayValue<T extends string>(list: T[], value: T) {
  return list.includes(value)
    ? list.filter(item => item !== value)
    : [...list, value]
}

function toggleDraftIncomeType(value: string) {
  draftFilters.selectedIncomeTypes = toggleArrayValue(draftFilters.selectedIncomeTypes, value)
}

function toggleDraftExpenseGroup(value: ExpenseCategoryGroupKey) {
  draftFilters.selectedExpenseGroups = toggleArrayValue(draftFilters.selectedExpenseGroups, value)
}

function toggleDraftExpenseCategory(value: string) {
  draftFilters.selectedExpenseCategories = toggleArrayValue(draftFilters.selectedExpenseCategories, value)
}

function toggleDraftUnlinkedOnly() {
  draftFilters.unlinkedOnly = !draftFilters.unlinkedOnly
  Object.assign(draftFilters, normalizeFilters(draftFilters))
}

function onDraftDateChange(kind: 'start' | 'end', event: any) {
  const value = toPickerTimestamp(event.detail.value)
  if (kind === 'start') draftFilters.customStartDate = value
  else draftFilters.customEndDate = value
}

function clearDraftLink(kind: 'dog' | 'litter' | 'cycle') {
  if (kind === 'dog') {
    draftFilters.selectedDogIds = []
    draftFilters.selectedDogNames = []
  } else if (kind === 'litter') {
    draftFilters.selectedLitterIds = []
    draftFilters.selectedLitterNames = []
  } else {
    draftFilters.selectedCycleIds = []
    draftFilters.selectedCycleNames = []
  }
}

function onDogFiltersSelected(dogs: any[]) {
  draftFilters.selectedDogIds = uniqStrings((dogs || []).map(dog => dog?._id || ''))
  draftFilters.selectedDogNames = uniqStrings((dogs || []).map(dog => dog?.name || ''))
}

function onLitterFiltersSelected(litters: any[]) {
  draftFilters.selectedLitterIds = uniqStrings((litters || []).map(litter => litter?._id || ''))
  draftFilters.selectedLitterNames = uniqStrings((litters || []).map((litter) => {
    return litter?.damName
      ? `${litter.damName} · 第${litter.litterNumber || '?'}窝`
      : '关联窝'
  }))
}

function onCycleFiltersSelected(cycles: any[]) {
  draftFilters.selectedCycleIds = uniqStrings((cycles || []).map(cycle => cycle?._id || ''))
  draftFilters.selectedCycleNames = uniqStrings((cycles || []).map((cycle) => {
    return cycle?.damName
      ? `${cycle.damName} · 第${cycle.cycleNumber || '?'}次繁育`
      : '繁育周期'
  }))
}

function applyDraftFilters() {
  if (!canApplyDraftFilters.value) {
    uni.showToast({ title: '请先选择完整的自定义日期', icon: 'none' })
    return
  }
  Object.assign(appliedFilters, normalizeFilters({ ...draftFilters }))
  showFilterSheet.value = false
  syncDraftWithApplied()
  loadPage()
}

function resetDraftFilters() {
  Object.assign(draftFilters, createDefaultFilters(currentMonth.value))
}

function clearFilterChip(key: string) {
  const next = { ...appliedFilters }
  if (key === 'type') next.type = ''
  if (key === 'dateRange') {
    next.dateRange = 'this_month'
    next.customStartDate = monthStartTs(currentMonth.value)
    next.customEndDate = monthEndTs(currentMonth.value)
  }
  if (key === 'incomeTypes') next.selectedIncomeTypes = []
  if (key === 'expenseGroups') next.selectedExpenseGroups = []
  if (key === 'expenseCategories') next.selectedExpenseCategories = []
  if (key === 'dogs') {
    next.selectedDogIds = []
    next.selectedDogNames = []
  }
  if (key === 'litters') {
    next.selectedLitterIds = []
    next.selectedLitterNames = []
  }
  if (key === 'cycles') {
    next.selectedCycleIds = []
    next.selectedCycleNames = []
  }
  if (key === 'unlinkedOnly') next.unlinkedOnly = false
  if (key === 'sort') next.sort = 'date_desc'
  syncAndReload(next)
}

function clearAllFilters() {
  syncAndReload(createDefaultFilters(currentMonth.value))
}

function goToStats() {
  uni.navigateTo({ url: '/pages/finance/stats' })
}

function goToExpenseAdd() {
  showAddSheet.value = false
  uni.navigateTo({ url: '/pages/finance/expense-add' })
}

function goToIncomeAdd() {
  showAddSheet.value = false
  uni.navigateTo({ url: '/pages/finance/expense-add?type=income' })
}

function goToTxDetail(tx: any) {
  if (tx._txType === 'expense') {
    uni.navigateTo({ url: `/pages/finance/expense-detail?id=${tx._id}` })
    return
  }
  uni.navigateTo({ url: `/pages/finance/income-detail?id=${tx._id}` })
}

onShow(async () => {
  await loadCategories()
  syncDraftWithApplied()
  await loadPage()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

.month-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: var(--primary-page-subsection-gap) 0 0;

  &__text {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__arrow {
    font-family: 'Material Icons Round';
    font-size: 20px;
    color: var(--text-2);

    &:active {
      transform: scale(0.9);
    }

    &--disabled {
      color: var(--text-4);
      pointer-events: none;
    }
  }
}

.summary-card {
  margin: 0 var(--space-page);
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 18px 20px;
  box-shadow: var(--shadow);
  display: flex;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
  border-left: 3.5px solid var(--primary);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%);
    pointer-events: none;
  }

  & > * {
    position: relative;
    z-index: 1;
  }

  &__item {
    flex: 1;
    text-align: center;
  }

  &__label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    display: block;
    margin-bottom: 4px;
  }

  &__amount {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 800;
  }

  &__amount--income { color: var(--red); }
  &__amount--expense { color: var(--green); }
  &__amount--profit-positive { color: var(--primary); }
  &__amount--profit-negative { color: var(--red); }
  &__amount--profit-neutral { color: var(--text-2); }

  &__divider {
    width: 1px;
    background: var(--text-4);
    opacity: 0.5;
    margin: 0 8px;
  }
}

.filter-tabs {
  &__spacer {
    flex: 1;
  }
}

.active-filters {
  padding: var(--primary-page-subsection-gap) var(--space-page) 0;
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;

  &__scroll {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
  }

  &__track {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding-right: 2px;
  }

  &__chip-icon {
    color: rgba(191, 65, 111, 0.72);
  }

  &__clear-all {
    flex-shrink: 0;
    min-height: 32px;
    padding: 0 2px 0 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-3);
    white-space: nowrap;
  }
}

.card-feed {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: var(--primary-page-section-gap);
}

.flow-card {
  background: var(--card);
  border-radius: var(--primary-page-card-radius);
  padding: var(--space-card);
  padding-left: var(--space-card-left);
  position: relative;
  box-shadow: var(--primary-page-card-shadow);
  overflow: hidden;
  border-left: var(--primary-page-card-bar-width) solid transparent;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:active {
    transform: scale(var(--primary-page-card-active-scale));
    box-shadow: var(--primary-page-card-shadow-active);
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  & > * {
    position: relative;
    z-index: 1;
  }

  &--income {
    border-left-color: var(--red);

    &::before {
      background: linear-gradient(135deg, var(--red-soft) 0%, transparent 40%);
    }
  }

  &--expense {
    border-left-color: var(--green);

    &::before {
      background: linear-gradient(135deg, var(--green-soft) 0%, transparent 40%);
    }
  }
}

.flow-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.flow-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &--income { background: var(--red); }
  &--expense { background: var(--green); }
}

.flow-middle {
  flex: 1;
  min-width: 0;
}

.flow-desc {
  font-size: var(--primary-page-card-title-size);
  font-weight: var(--primary-page-card-title-weight);
  color: var(--text-1);
  line-height: var(--primary-page-card-title-line-height);
  display: block;
}

.flow-sub {
  font-size: var(--primary-page-card-subtitle-size);
  color: var(--primary-page-card-subtitle-color);
  margin-top: 2px;
  display: block;
}

.flow-meta {
  font-size: var(--primary-page-card-meta-size);
  color: var(--primary-page-card-meta-color);
  line-height: var(--primary-page-card-meta-line-height);
  margin-top: 2px;
  display: block;
}

.flow-right {
  text-align: right;
  flex-shrink: 0;
}

.flow-amount {
  font-family: var(--font-display);
  font-size: var(--primary-page-card-accent-size);
  font-weight: var(--primary-page-card-accent-weight);
  display: block;

  &--income { color: var(--red); }
  &--expense { color: var(--green); }
}

.flow-date {
  font-size: var(--primary-page-card-meta-size);
  color: var(--primary-page-card-meta-color);
  margin-top: 2px;
  display: block;
}

.add-sheet {
  padding: 0 var(--space-page) var(--space-page);
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: var(--radius-card);
    border: 1px solid transparent;

    &:active {
      opacity: 0.75;
      transform: scale(0.985);
    }

    &--expense {
      background: linear-gradient(135deg, rgba(61, 174, 111, 0.14) 0%, rgba(61, 174, 111, 0.07) 100%);
      border-color: rgba(61, 174, 111, 0.12);
    }

    &--income {
      background: linear-gradient(135deg, rgba(224, 82, 82, 0.14) 0%, rgba(224, 82, 82, 0.07) 100%);
      border-color: rgba(224, 82, 82, 0.12);
    }
  }

  &__icon {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-icon);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &--expense {
      background: rgba(61, 174, 111, 0.2);
    }

    &--income {
      background: rgba(224, 82, 82, 0.2);
    }
  }

  &__info {
    flex: 1;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
    display: block;

    &--expense { color: var(--green); }
    &--income { color: var(--red); }
  }

  &__desc {
    font-size: 12px;
    color: var(--text-3);
    margin-top: 2px;
    display: block;
  }
}

.filter-sheet {
  padding: 0 0 24px;

  &__hero {
    margin: 0 2px 14px;
    padding: 2px 0 16px;
  }

  &__eyebrow {
    display: block;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--primary);
    margin-bottom: 6px;
  }

  &__hint {
    display: block;
    font-size: 12px;
    line-height: 1.55;
    color: var(--text-3);
  }

  &__content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 112px;
  }
}

.filter-section {
  &--card {
    background: rgba(255, 255, 255, 0.98);
    border: 1px solid rgba(216, 203, 189, 0.4);
    border-radius: 22px;
    padding: 16px 14px 15px;
    box-shadow: 0 10px 24px rgba(99, 70, 49, 0.045);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  &__title {
    display: block;
    font-size: 14px;
    font-weight: 800;
    color: var(--text-1);
  }

  &__meta {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 700;
    color: var(--primary);
    background: rgba(240, 88, 136, 0.1);
    padding: 4px 8px;
    border-radius: 999px;
  }

  &__subhead {
    display: block;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
    margin-bottom: 10px;
  }

  &__helper {
    display: block;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-3);
    margin: -2px 0 14px;
  }
}

.grouped-category-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.grouped-category-card {
  background: rgba(255, 249, 245, 0.96);
  border: 1px solid rgba(216, 203, 189, 0.3);
  border-radius: 18px;
  padding: 13px 12px 12px;
  transition: all 0.18s ease;

  &--active {
    background: linear-gradient(180deg, rgba(255, 244, 247, 0.98) 0%, rgba(255, 250, 247, 1) 100%);
    border-color: rgba(240, 88, 136, 0.24);
    box-shadow: 0 8px 18px rgba(240, 88, 136, 0.08);
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }

  &__title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;

    &--feeding { background: #f59a3f; }
    &--health { background: #e56767; }
    &--breeding { background: #d68ae8; }
    &--operations { background: #5d9ce8; }
    &--other { background: #9b8f86; }
  }

  &__title {
    font-size: 13px;
    font-weight: 800;
    color: var(--text-1);
  }

  &__badge {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 700;
    color: var(--primary);
    background: rgba(240, 88, 136, 0.1);
    border-radius: 999px;
    padding: 4px 8px;
  }
}

.filter-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  &--sub {
    margin-top: 0;
  }
}

.filter-chip {
  padding: 8px 13px;
  border-radius: 999px;
  background: rgba(255, 244, 236, 0.86);
  border: 1px solid rgba(216, 203, 189, 0.18);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  transition: all 0.16s ease;

  &:active {
    transform: scale(0.96);
  }

  &--segment {
    min-height: 38px;
    padding: 9px 15px;
    background: rgba(252, 239, 229, 0.96);
    border-color: rgba(216, 203, 189, 0.32);
    font-weight: 700;
    color: var(--text-2);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }

  &--segment-compact {
    min-height: 36px;
    padding: 8px 14px;
    font-size: 12px;
  }

  &--active {
    background: linear-gradient(135deg, rgba(240, 88, 136, 0.16) 0%, rgba(255, 240, 242, 0.95) 100%);
    border-color: rgba(240, 88, 136, 0.4);
    color: var(--primary);
    box-shadow: 0 6px 16px rgba(240, 88, 136, 0.1);
  }

  &--soft {
    background: rgba(255, 250, 246, 0.92);
    border-color: rgba(216, 203, 189, 0.14);
    color: var(--text-2);
  }

  &--soft.filter-chip--active {
    background: linear-gradient(135deg, rgba(240, 88, 136, 0.2) 0%, rgba(255, 236, 241, 0.98) 100%);
    border-color: rgba(240, 88, 136, 0.46);
    color: #b93465;
    box-shadow: 0 6px 16px rgba(240, 88, 136, 0.12);
    font-weight: 700;
  }

  &--active-soft {
    background: linear-gradient(135deg, rgba(240, 88, 136, 0.12) 0%, rgba(255, 247, 249, 0.98) 100%);
    border-color: rgba(240, 88, 136, 0.24);
    color: var(--primary);
    box-shadow: 0 4px 14px rgba(240, 88, 136, 0.08);
  }
}

.custom-date-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.custom-date-card {
  padding: 13px 12px;
  border-radius: 18px;
  background: rgba(255, 250, 246, 0.98);
  border: 1px solid rgba(216, 203, 189, 0.32);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);

  &__label {
    display: block;
    font-size: 12px;
    color: var(--text-3);
    margin-bottom: 4px;
  }

  &__value {
    display: block;
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }
}

.link-filter-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filter-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(216, 203, 189, 0.34);
  box-shadow: 0 4px 12px rgba(99, 70, 49, 0.03);
  margin-bottom: 12px;

  &--active {
    background: linear-gradient(135deg, rgba(240, 88, 136, 0.09) 0%, rgba(255, 249, 250, 1) 100%);
    border-color: rgba(240, 88, 136, 0.28);
  }

  &__copy {
    flex: 1;
    min-width: 0;
  }

  &__title {
    display: block;
    font-size: 13px;
    font-weight: 800;
    color: var(--text-1);
  }

  &__desc {
    display: block;
    font-size: 11px;
    line-height: 1.45;
    color: var(--text-3);
    margin-top: 3px;
  }

  &__switch {
    width: 42px;
    height: 24px;
    border-radius: 999px;
    background: rgba(216, 203, 189, 0.62);
    padding: 3px;
    display: flex;
    align-items: center;
    transition: all 0.18s ease;

    &--on {
      justify-content: flex-end;
      background: rgba(240, 88, 136, 0.34);
    }
  }

  &__thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  }
}

.link-filter-card {
  padding: 13px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(216, 203, 189, 0.34);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-shadow: 0 4px 12px rgba(99, 70, 49, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.72);

  &--disabled {
    opacity: 0.56;
  }

  &__lead {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__icon {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    background: rgba(240, 88, 136, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__copy {
    flex: 1;
    min-width: 0;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  &__title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
  }

  &__clear {
    font-size: 16px;
    color: var(--text-4);
  }

  &__value {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--placeholder {
      color: var(--text-3);
      font-weight: 500;
    }
  }

  &__arrow {
    font-size: 18px;
    color: var(--text-4);
    flex-shrink: 0;
  }
}

.filter-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;

  &--sticky {
    position: sticky;
    bottom: 0;
    z-index: 3;
    padding: 18px var(--space-page) calc(env(safe-area-inset-bottom, 0px) + 14px);
    margin: 0 calc(var(--space-page) * -1) -20px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 252, 249, 0.94) 24%, rgba(255, 255, 255, 0.985) 100%);
    border-top: 1px solid rgba(216, 203, 189, 0.24);
    box-shadow: 0 -12px 28px rgba(77, 52, 31, 0.06);
    backdrop-filter: blur(10px);
  }

  &__reset,
  &__apply {
    flex: 1;
    height: 48px;
    border-radius: 18px;
    border: none;
    padding: 0 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    box-sizing: border-box;
    -webkit-appearance: none;

    &::after {
      border: none;
    }
  }

  &__reset {
    background: rgba(255, 244, 236, 0.98);
    border: 1px solid rgba(216, 203, 189, 0.72);
    color: var(--text-2);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
  }

  &__apply {
    background: linear-gradient(135deg, var(--primary) 0%, #ff6f98 100%);
    color: #fff;
    border: 1px solid rgba(240, 88, 136, 0.2);
    box-shadow: 0 12px 24px rgba(240, 88, 136, 0.22);

    &[disabled] {
      opacity: 0.45;
      color: #fff;
    }
  }
}
</style>
