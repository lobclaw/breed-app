<!--
  犬只列表页 (D-1)
  搜索优先 + 档案筛选 + 当前状态可见
-->
<template>
  <view class="page dog-list">
    <view class="primary-page-header">
      <view class="primary-page-header__row">
        <text class="primary-page-header__title">档案</text>
        <view class="primary-page-header__actions">
          <view class="primary-page-header__action primary-page-header__action--primary" @click="goToAdd">
            <text class="primary-page-header__icon primary-page-header__icon--primary">add</text>
          </view>
          <view class="primary-page-header__action" @click="showFilterSheet = true">
            <text class="primary-page-header__icon">filter_list</text>
          </view>
        </view>
      </view>
    </view>

    <BSubmitBanner :message="submitBannerMessage" />

    <view class="dog-list__search">
      <text class="dog-list__search-icon material-icons-round">search</text>
      <input
        v-model="searchKeyword"
        class="dog-list__search-input"
        placeholder="搜索犬只..."
        confirm-type="search"
      />
      <text
        v-if="searchKeyword"
        class="dog-list__search-clear material-icons-round"
        @click="searchKeyword = ''"
      >close</text>
    </view>

    <BChipFilterStrip v-model="activeFilter" :options="filterOptions" />

    <view v-if="appliedFilterChips.length" class="dog-list__applied-filters">
      <view
        v-for="chip in appliedFilterChips"
        :key="`${chip.group}-${chip.value}`"
        class="dog-list__applied-chip primary-page-applied-chip"
        @click="removeAppliedFilter(chip.group, chip.value)"
      >
        <text class="dog-list__applied-chip-text primary-page-applied-chip-text">{{ chip.label }}</text>
        <text class="dog-list__applied-chip-icon primary-page-applied-chip-icon material-icons-round">close</text>
      </view>
      <text class="dog-list__applied-clear" @click="resetAdvancedFilters">清空</text>
    </view>

    <view v-if="loading" class="primary-page-loading">
      <BSkeleton :rows="4" avatar />
    </view>

    <view v-else-if="filteredDogs.length" class="dog-list__content">
      <view
        v-for="dog in filteredDogs"
        :key="dog._id"
        :id="dogCardId(dog._id)"
        class="dog-list__card"
        :class="[cardBarClass(dog), { 'dog-list__card--fresh': highlightedDogId === dog._id }]"
        @click="goToDetail(dog._id)"
      >
        <view class="dog-list__card-row">
          <view
            class="dog-list__card-icon"
            :class="[cardIconBgClass(dog), cardRingClass(dog)]"
          >
            <BEntityIcon class="dog-list__card-entity-icon" :role="dog.role" :color="entityIconColor(dog)" :size="16" />
          </view>

          <view class="dog-list__card-main">
            <text class="dog-list__card-name">{{ dog.name || '未命名' }}</text>
            <text class="dog-list__card-sub">{{ dog.basicInfoText }}</text>
          </view>

          <view class="dog-list__card-side">
            <view
              class="dog-list__side-tag dog-list__side-tag--disposition"
              :class="dispositionTagClass(dog)"
            >
              <text class="dog-list__side-tag-text">{{ dog.displayDisposition }}</text>
            </view>
            <view
              class="dog-list__side-tag dog-list__side-tag--role"
              :class="roleTagClass(dog)"
            >
              <text class="dog-list__side-tag-text">{{ roleLabel(dog) }}</text>
            </view>
          </view>
        </view>

        <view v-if="dog.statusTags.length || dog.statusOverflowCount" class="dog-list__card-statuses">
          <view
            v-for="tag in dog.statusTags"
            :key="tag.key"
            class="dog-list__status-tag"
            :class="tag.className"
          >
            <text class="dog-list__status-tag-text">{{ tag.label }}</text>
          </view>
          <view v-if="dog.statusOverflowCount" class="dog-list__status-tag dog-list__status-tag--more">
            <text class="dog-list__status-tag-text">+{{ dog.statusOverflowCount }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-else class="primary-page-empty">
      <BEmpty
        icon="pets"
        title="暂无犬只"
        description="点击右上角 + 添加第一只犬"
        action-text="添加犬只"
        @action="goToAdd"
      />
    </view>

    <BNavBar current="dog" />

    <BSheet v-model:visible="showFilterSheet" title="筛选">
      <view class="filter-panel">
        <view class="filter-section">
          <text class="filter-section__label">性别</text>
          <view class="filter-pills">
            <view
              v-for="opt in genderOptions"
              :key="opt.value"
              class="filter-pill"
              :class="{ 'filter-pill--active': advFilters.genders.includes(opt.value) }"
              @click="toggleFilter('genders', opt.value)"
            >
              <text class="filter-pill__text">{{ opt.label }}</text>
            </view>
          </view>
        </view>

        <view class="filter-section">
          <text class="filter-section__label">角色</text>
          <view class="filter-pills">
            <view
              v-for="opt in roleOptions"
              :key="opt.value"
              class="filter-pill"
              :class="{ 'filter-pill--active': advFilters.roles.includes(opt.value) }"
              @click="toggleFilter('roles', opt.value)"
            >
              <text class="filter-pill__text">{{ opt.label }}</text>
            </view>
          </view>
        </view>

        <view class="filter-section">
          <text class="filter-section__label">品种</text>
          <view class="filter-pills">
            <view
              v-for="opt in breedOptions"
              :key="opt.value"
              class="filter-pill"
              :class="{ 'filter-pill--active': advFilters.breeds.includes(opt.value) }"
              @click="toggleFilter('breeds', opt.value)"
            >
              <text class="filter-pill__text">{{ opt.label }}</text>
            </view>
          </view>
        </view>

        <view class="filter-section">
          <text class="filter-section__label">去向</text>
          <view class="filter-pills">
            <view
              v-for="opt in dispositionOptions"
              :key="opt.value"
              class="filter-pill"
              :class="{ 'filter-pill--active': advFilters.dispositions.includes(opt.value) }"
              @click="toggleFilter('dispositions', opt.value)"
            >
              <text class="filter-pill__text">{{ opt.label }}</text>
            </view>
          </view>
        </view>

        <view class="filter-section">
          <text class="filter-section__label">状态</text>
          <view class="filter-pills">
            <view
              v-for="opt in statusOptions"
              :key="opt.value"
              class="filter-pill"
              :class="{ 'filter-pill--active': advFilters.statuses.includes(opt.value) }"
              @click="toggleFilter('statuses', opt.value)"
            >
              <text class="filter-pill__text">{{ opt.label }}</text>
            </view>
          </view>
        </view>

        <view class="filter-actions">
          <view class="filter-actions__btn filter-actions__btn--ghost" @click="resetAdvancedFilters">
            <text class="filter-actions__btn-text" style="color: var(--text-2);">重置</text>
          </view>
          <view class="filter-actions__btn filter-actions__btn--primary" @click="applyAdvancedFilters">
            <text class="filter-actions__btn-text" style="color: #fff;">应用筛选</text>
          </view>
        </view>
      </view>
    </BSheet>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import BChipFilterStrip from '@/components/base/BChipFilterStrip.vue'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import BNavBar from '@/components/layout/BNavBar.vue'
import BSheet from '@/components/layout/BSheet.vue'
import { consumeSubmitFeedback } from '@/composables/useSubmitFeedback'
import { useDogStore } from '@/stores/dogStore'
import type { DeriveStatus, DeriveStatusType, DogDisposition, DogWithStatus } from '@/types/dog'
import { buildCompactDeriveStatusTitle } from '@/utils/dogStatusCopy'
import { getDogStatusTone } from '@/utils/themeSemantics'

type QuickFilterValue = 'all' | 'breeding' | 'puppy' | 'sale' | 'external'
type FilterGroup = 'genders' | 'roles' | 'breeds' | 'dispositions' | 'statuses'
type TagColor = 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal'

interface AppliedFilterChip {
  group: FilterGroup
  value: string
  label: string
}

interface StatusTagItem {
  key: string
  label: string
  className: string
}

interface DogListItem extends DogWithStatus {
  activeStatuses: DeriveStatus[]
  primaryStatus?: DeriveStatus
  primaryStatusTitle: string
  secondaryStatuses: DeriveStatus[]
  secondaryOverflowCount: number
  secondaryStatusInlineText: string
  metaInfoText: string
  basicInfoText: string
  displayDisposition: DogDisposition
  hasHighlightedDisposition: boolean
  sortBucket: number
  statusPriority: number
  isActiveStatusDog: boolean
  statusTags: StatusTagItem[]
  statusOverflowCount: number
}

const DEFAULT_DISPOSITION: DogDisposition = '在养'
const MAX_SECONDARY_STATUS_TAGS = 2
const MAX_STATUS_TAGS = 3
const BREEDING_STATUS_TYPES = new Set<DeriveStatusType>(['发情中', '怀孕中', '哺乳中'])
const dogs = ref<DogWithStatus[]>([])
const loading = ref(true)
const activeFilter = ref<QuickFilterValue>('all')
const showFilterSheet = ref(false)
const searchKeyword = ref('')
const submitBannerMessage = ref('')
const highlightedDogId = ref('')
const dogStore = useDogStore()
let submitBannerTimer: ReturnType<typeof setTimeout> | null = null
let highlightTimer: ReturnType<typeof setTimeout> | null = null
let pendingFeedbackDogId = ''
let pendingFeedbackHiddenMessage = ''

const filterOptions: Array<{ label: string; value: QuickFilterValue }> = [
  { label: '全部', value: 'all' },
  { label: '种狗', value: 'breeding' },
  { label: '幼崽', value: 'puppy' },
  { label: '待售', value: 'sale' },
  { label: '外部种公', value: 'external' },
]

const genderOptions = [
  { label: '公', value: '公' },
  { label: '母', value: '母' },
]

const roleOptions = [
  { label: '种狗', value: '种狗' },
  { label: '幼崽', value: '幼崽' },
  { label: '外部种公', value: '外部种公' },
]

const dispositionOptions = [
  { label: '在养', value: '在养' },
  { label: '自留', value: '自留' },
  { label: '待售', value: '待售' },
  { label: '已预定', value: '已预定' },
  { label: '已售', value: '已售' },
  { label: '已退休', value: '已退休' },
  { label: '已领养', value: '已领养' },
  { label: '已赠送', value: '已赠送' },
  { label: '已故', value: '已故' },
]

const statusOptions = [
  { label: '发情中', value: '发情中' },
  { label: '怀孕中', value: '怀孕中' },
  { label: '哺乳中', value: '哺乳中' },
  { label: '生病中', value: '生病中' },
  { label: '用药中', value: '用药中' },
]

const breedOptions = computed<Array<{ label: string; value: string }>>(() => {
  const values = new Set(
    dogs.value.map(dog => normalizeBreed(dog)),
  )

  return [...values]
    .sort(compareString)
    .map(value => ({ label: value, value }))
})

const filterLabelMap = computed<Record<FilterGroup, Record<string, string>>>(() => ({
  genders: Object.fromEntries(genderOptions.map(opt => [opt.value, opt.label])),
  roles: Object.fromEntries(roleOptions.map(opt => [opt.value, opt.label])),
  breeds: Object.fromEntries(breedOptions.value.map(opt => [opt.value, opt.label])),
  dispositions: Object.fromEntries(dispositionOptions.map(opt => [opt.value, opt.label])),
  statuses: Object.fromEntries(statusOptions.map(opt => [opt.value, opt.label])),
}))

const advFilters = reactive({
  genders: [] as string[],
  roles: [] as string[],
  breeds: [] as string[],
  dispositions: [] as string[],
  statuses: [] as string[],
})

const appliedFilters = reactive({
  genders: [] as string[],
  roles: [] as string[],
  breeds: [] as string[],
  dispositions: [] as string[],
  statuses: [] as string[],
})

const STATUS_PRIORITY_MAP: Record<string, number> = {
  生病中: 1,
  用药中: 2,
  怀孕中: 3,
  哺乳中: 4,
  发情中: 5,
  正常: 99,
}

function splitStatusDetail(detail?: string | null) {
  const raw = `${detail || ''}`.trim()
  if (!raw) return { primary: '', secondary: '' }

  const dotParts = raw.split('·').map(part => part.trim()).filter(Boolean)
  if (dotParts.length > 1) {
    return {
      primary: dotParts[0],
      secondary: dotParts.slice(1).join(' · '),
    }
  }

  const spaceParts = raw.split(/\s+/).filter(Boolean)
  if (spaceParts.length > 1) {
    return {
      primary: spaceParts[0],
      secondary: spaceParts.slice(1).join(' '),
    }
  }

  return { primary: raw, secondary: '' }
}

function getStatusPriority(type?: string) {
  return STATUS_PRIORITY_MAP[type || '正常'] || STATUS_PRIORITY_MAP.正常
}

function normalizeDisposition(dog: DogWithStatus): DogDisposition {
  return (dog.disposition || DEFAULT_DISPOSITION) as DogDisposition
}

function normalizeBreed(dog: Pick<DogWithStatus, 'breed'>) {
  return dog.breed?.trim() || '马尔济斯'
}

function normalizeGender(dog: Pick<DogWithStatus, 'gender'>) {
  return dog.gender === '公' || dog.gender === '母' ? dog.gender : ''
}

function isWeakDisposition(disposition: DogDisposition) {
  return disposition === '在养' || disposition === '自留'
}

function isInactiveDisposition(disposition: DogDisposition) {
  return ['已售', '已领养', '已赠送', '已退休', '已故'].includes(disposition)
}

function compareString(a?: string | null, b?: string | null) {
  return `${a || ''}`.localeCompare(`${b || ''}`, 'zh-Hans-CN')
}

function sortStatuses(statuses: DeriveStatus[]) {
  return [...statuses]
    .filter(status => status.type !== '正常')
    .sort((a, b) => {
      const priorityDiff = getStatusPriority(a.type) - getStatusPriority(b.type)
      if (priorityDiff !== 0) return priorityDiff

      const activityDiff = (b.activityTs || 0) - (a.activityTs || 0)
      if (activityDiff !== 0) return activityDiff

      return compareString(a.label || a.type, b.label || b.type)
    })
}

function statusTitle(status: DeriveStatus): string {
  return buildCompactDeriveStatusTitle(status, {
    nameOverride: status.type === '用药中' ? splitStatusDetail(status.detail).primary : undefined,
  })
}

function secondaryStatusLabel(status: DeriveStatus) {
  if (status.type === '生病中') return '生病中'
  if (status.type === '用药中') return '用药中'
  return status.type
}

function buildMetaInfoText(dog: DogWithStatus) {
  const parts = [normalizeBreed(dog)]
  const gender = normalizeGender(dog)
  if (gender) parts.push(gender)
  if (dog.birth_date) parts.push(formatAge(dog.birth_date))
  parts.push(roleLabel(dog))
  return parts.join(' · ')
}

function buildBasicInfoText(dog: DogWithStatus) {
  const parts = [normalizeBreed(dog)]
  const gender = normalizeGender(dog)
  if (gender) parts.push(gender)
  if (dog.birth_date) parts.push(formatAge(dog.birth_date))
  return parts.join(' · ')
}

function buildSecondaryStatusInlineText(activeStatuses: DeriveStatus[]) {
  const secondaryCount = Math.max(0, activeStatuses.length - 1)
  if (secondaryCount === 0) return ''
  if (secondaryCount === 1) return secondaryStatusLabel(activeStatuses[1])
  return `+${secondaryCount}`
}

function statusTagLabel(status: DeriveStatus) {
  return buildCompactDeriveStatusTitle(status, {
    nameOverride: status.type === '用药中' ? splitStatusDetail(status.detail).primary : undefined,
  })
}

function statusTagClass(status: DeriveStatus) {
  if (isIllnessStatus(status.type)) return 'dog-list__status-tag--illness'
  return `dog-list__status-tag--${statusColor(status.type)}`
}

function isBreedingStatus(status: DeriveStatus) {
  return BREEDING_STATUS_TYPES.has(status.type)
}

function pickVisibleStatusTags(activeStatuses: DeriveStatus[]) {
  const visibleStatuses = activeStatuses.slice(0, MAX_STATUS_TAGS)
  const breedingStatus = activeStatuses.find(isBreedingStatus)
  if (!breedingStatus || visibleStatuses.some(isBreedingStatus)) return visibleStatuses

  visibleStatuses[visibleStatuses.length - 1] = breedingStatus
  return visibleStatuses
}

function buildStatusTags(activeStatuses: DeriveStatus[]) {
  return pickVisibleStatusTags(activeStatuses).map((status, index) => ({
    key: `${status.type}-${status.activityTs || 0}-${index}`,
    label: statusTagLabel(status),
    className: statusTagClass(status),
  }))
}

function buildDogListItem(dog: DogWithStatus): DogListItem {
  const activeStatuses = sortStatuses(dog.statuses || [])
  const primaryStatus = activeStatuses[0]
  const secondaryStatuses = activeStatuses.slice(1, 1 + MAX_SECONDARY_STATUS_TAGS)
  const secondaryOverflowCount = Math.max(0, activeStatuses.length - 1 - MAX_SECONDARY_STATUS_TAGS)
  const displayDisposition = normalizeDisposition(dog)
  const hasHighlightedDisposition = !isWeakDisposition(displayDisposition)
  const statusTags = buildStatusTags(activeStatuses)
  const statusOverflowCount = Math.max(0, activeStatuses.length - MAX_STATUS_TAGS)
  const sortBucket = isInactiveDisposition(displayDisposition)
    ? 4
    : dog.role === '种狗'
      ? 1
      : dog.role === '幼崽'
        ? 2
        : 3

  return {
    ...dog,
    activeStatuses,
    primaryStatus,
    primaryStatusTitle: primaryStatus ? statusTitle(primaryStatus) : '',
    secondaryStatuses,
    secondaryOverflowCount,
    secondaryStatusInlineText: buildSecondaryStatusInlineText(activeStatuses),
    metaInfoText: buildMetaInfoText(dog),
    basicInfoText: buildBasicInfoText(dog),
    displayDisposition,
    hasHighlightedDisposition,
    sortBucket,
    statusPriority: primaryStatus ? getStatusPriority(primaryStatus.type) : STATUS_PRIORITY_MAP.正常,
    isActiveStatusDog: activeStatuses.length > 0,
    statusTags,
    statusOverflowCount,
  }
}

const appliedFilterChips = computed<AppliedFilterChip[]>(() => {
  const chips: AppliedFilterChip[] = []
  ;(Object.keys(appliedFilters) as FilterGroup[]).forEach(group => {
    appliedFilters[group].forEach(value => {
      chips.push({
        group,
        value,
        label: filterLabelMap.value[group][value] || value,
      })
    })
  })
  return chips
})

const filteredDogs = computed<DogListItem[]>(() => {
  let result = dogs.value.map(buildDogListItem)

  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    result = result.filter(dog => `${dog.name || ''}`.toLowerCase().includes(kw))
  }

  if (activeFilter.value === 'breeding') result = result.filter(dog => dog.role === '种狗')
  else if (activeFilter.value === 'puppy') result = result.filter(dog => dog.role === '幼崽')
  else if (activeFilter.value === 'sale') result = result.filter(dog => dog.displayDisposition === '待售')
  else if (activeFilter.value === 'external') result = result.filter(dog => dog.role === '外部种公')

  if (appliedFilters.genders.length > 0) {
    result = result.filter(dog => appliedFilters.genders.includes(dog.gender))
  }
  if (appliedFilters.roles.length > 0) {
    result = result.filter(dog => appliedFilters.roles.includes(dog.role))
  }
  if (appliedFilters.breeds.length > 0) {
    result = result.filter(dog => appliedFilters.breeds.includes(normalizeBreed(dog)))
  }
  if (appliedFilters.dispositions.length > 0) {
    result = result.filter(dog => appliedFilters.dispositions.includes(dog.displayDisposition))
  }
  if (appliedFilters.statuses.length > 0) {
    result = result.filter(dog => dog.activeStatuses.some(status => appliedFilters.statuses.includes(status.type)))
  }

  return result.sort((a, b) => {
    const bucketDiff = a.sortBucket - b.sortBucket
    if (bucketDiff !== 0) return bucketDiff

    const activeDiff = Number(b.isActiveStatusDog) - Number(a.isActiveStatusDog)
    if (activeDiff !== 0) return activeDiff

    const statusDiff = a.statusPriority - b.statusPriority
    if (statusDiff !== 0) return statusDiff

    return compareString(a.name, b.name)
  })
})

function toggleFilter(group: FilterGroup, value: string) {
  const idx = advFilters[group].indexOf(value)
  if (idx >= 0) advFilters[group].splice(idx, 1)
  else advFilters[group].push(value)
}

function syncAppliedFiltersFromDraft() {
  appliedFilters.genders = [...advFilters.genders]
  appliedFilters.roles = [...advFilters.roles]
  appliedFilters.breeds = [...advFilters.breeds]
  appliedFilters.dispositions = [...advFilters.dispositions]
  appliedFilters.statuses = [...advFilters.statuses]
}

function applyAdvancedFilters() {
  syncAppliedFiltersFromDraft()
  showFilterSheet.value = false
}

function resetAdvancedFilters() {
  advFilters.genders = []
  advFilters.roles = []
  advFilters.breeds = []
  advFilters.dispositions = []
  advFilters.statuses = []
  syncAppliedFiltersFromDraft()
  showFilterSheet.value = false
}

function removeAppliedFilter(group: FilterGroup, value: string) {
  advFilters[group] = advFilters[group].filter(item => item !== value)
  appliedFilters[group] = appliedFilters[group].filter(item => item !== value)
}

function statusColor(type: DeriveStatusType): TagColor {
  return getDogStatusTone(type).color
}

function isIllnessStatus(type: DeriveStatusType) {
  return getDogStatusTone(type).variant === 'illness'
}

function cardBarClass(dog: DogListItem) {
  if (dog.primaryStatus) {
    if (isIllnessStatus(dog.primaryStatus.type)) return 'dog-list__card--bar-illness'
    return `dog-list__card--bar-${statusColor(dog.primaryStatus.type)}`
  }
  if (dog.role === '外部种公') return 'dog-list__card--bar-blue'
  if (dog.role === '幼崽') return 'dog-list__card--bar-amber'
  return 'dog-list__card--bar-green'
}

function cardIconBgClass(dog: DogListItem) {
  if (dog.primaryStatus) {
    if (isIllnessStatus(dog.primaryStatus.type)) return 'dog-list__card-icon--illness'
    return `dog-list__card-icon--${statusColor(dog.primaryStatus.type)}`
  }
  if (dog.role === '外部种公') return 'dog-list__card-icon--blue'
  if (dog.role === '幼崽') return 'dog-list__card-icon--amber'
  return 'dog-list__card-icon--green'
}

function cardRingClass(dog: DogListItem) {
  if (dog.primaryStatus) {
    if (isIllnessStatus(dog.primaryStatus.type)) return 'dog-list__card-icon--ring-illness'
    return `dog-list__card-icon--ring-${statusColor(dog.primaryStatus.type)}`
  }
  if (dog.role === '外部种公') return 'dog-list__card-icon--ring-blue'
  if (dog.role === '幼崽') return 'dog-list__card-icon--ring-amber'
  return 'dog-list__card-icon--ring-green'
}

function entityIconColor(dog: DogListItem) {
  if (dog.primaryStatus) {
    if (isIllnessStatus(dog.primaryStatus.type)) return 'rgba(224, 82, 82, 0.82)'
    return `var(--${statusColor(dog.primaryStatus.type)})`
  }
  if (dog.role === '外部种公') return 'var(--blue)'
  if (dog.role === '幼崽') return 'var(--amber)'
  return 'var(--green)'
}

function primaryStatusTextClass(dog: DogListItem) {
  if (!dog.primaryStatus) return ''
  if (isIllnessStatus(dog.primaryStatus.type)) return 'dog-list__card-status-inline--illness'
  return `dog-list__card-status-inline--${statusColor(dog.primaryStatus.type)}`
}

function dispositionTagClass(dog: DogListItem) {
  const map: Record<DogDisposition, string> = {
    在养: 'dog-list__side-tag--green',
    自留: 'dog-list__side-tag--muted',
    待售: 'dog-list__disposition-tag--amber',
    已预定: 'dog-list__disposition-tag--blue',
    已售: 'dog-list__disposition-tag--teal',
    已领养: 'dog-list__disposition-tag--blue',
    已赠送: 'dog-list__disposition-tag--plum',
    已退休: 'dog-list__disposition-tag--rose',
    已故: 'dog-list__disposition-tag--red',
  }

  return map[dog.displayDisposition]
}

function roleTagClass(dog: DogListItem) {
  if (dog.role === '种狗') return 'dog-list__side-tag--role-primary'
  return 'dog-list__side-tag--role-muted'
}

function roleLabel(dog: DogWithStatus) {
  if (dog.role === '外部种公') return '外部种公'
  if (dog.role === '幼崽') return '幼崽'
  return '种狗'
}

function formatAge(birthTs: number) {
  const now = Date.now()
  const days = Math.floor((now - birthTs) / 86400000)
  if (days < 30) return `${days}天`
  if (days < 365) return `${Math.floor(days / 30)}月龄`
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  return months > 0 ? `${years}岁${months}月` : `${years}岁`
}

function goToDetail(dogId: string) {
  uni.navigateTo({ url: `/pages/dog/detail?id=${dogId}` })
}

function goToAdd() {
  uni.navigateTo({ url: `/pages/dog/add?targetRoute=${encodeURIComponent('/pages/dog/list')}` })
}

function dogCardId(dogId: string) {
  return `dog-card-${dogId}`
}

function showSubmitBanner(message: string) {
  submitBannerMessage.value = message
  if (submitBannerTimer) clearTimeout(submitBannerTimer)
  submitBannerTimer = setTimeout(() => {
    submitBannerMessage.value = ''
  }, 2600)
}

function highlightDogOnce(dogId: string) {
  highlightedDogId.value = dogId
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => {
    if (highlightedDogId.value === dogId) highlightedDogId.value = ''
  }, 2600)
}

async function scrollToDogCard(dogId: string) {
  await nextTick()
  setTimeout(() => {
    uni.pageScrollTo({
      selector: `#${dogCardId(dogId)}`,
      duration: 280,
      offsetTop: 88,
    })
  }, 80)
}

async function tryRevealPendingDog() {
  if (!pendingFeedbackDogId) return false

  const visibleDog = filteredDogs.value.find(dog => dog._id === pendingFeedbackDogId)
  if (visibleDog) {
    highlightDogOnce(pendingFeedbackDogId)
    await scrollToDogCard(pendingFeedbackDogId)
    pendingFeedbackDogId = ''
    pendingFeedbackHiddenMessage = ''
    return true
  }

  const targetDog = dogs.value.find(dog => dog._id === pendingFeedbackDogId)
  if (targetDog) {
    if (pendingFeedbackHiddenMessage) showSubmitBanner(pendingFeedbackHiddenMessage)
    pendingFeedbackDogId = ''
    pendingFeedbackHiddenMessage = ''
    return false
  }

  return false
}

async function applyDogListFeedback() {
  const feedback = consumeSubmitFeedback('/pages/dog/list')
  if (!feedback?.message) return

  showSubmitBanner(feedback.message)

  if (!feedback.targetDogId) return

  pendingFeedbackDogId = feedback.targetDogId
  pendingFeedbackHiddenMessage = `${feedback.message}，当前筛选下未显示`
  await tryRevealPendingDog()
}

async function loadDogs() {
  if (dogStore.list.length > 0) {
    dogs.value = dogStore.list
    loading.value = false
    dogStore.fetchFromServer().then(() => {
      dogs.value = dogStore.list
      void tryRevealPendingDog()
    })
  } else {
    loading.value = true
    await dogStore.ensure()
    dogs.value = dogStore.list
    loading.value = false
    await tryRevealPendingDog()
  }
}

onShow(() => {
  loadDogs().then(() => applyDogListFeedback())
})
</script>

<style lang="scss" scoped>
.dog-list {
  --primary-page-section-gap: 14px;
  --primary-page-subsection-gap: 8px;
  --primary-page-card-radius: var(--radius-card);
  --primary-page-card-shadow: 0 4px 14px rgba(45, 27, 20, 0.05);
  --primary-page-card-shadow-active: 0 2px 8px rgba(45, 27, 20, 0.06);
  --primary-page-card-bar-width: 3px;
  --primary-page-card-active-scale: 0.975;
  --primary-page-card-title-size: 15px;
  --primary-page-card-title-weight: 700;
  --primary-page-card-title-line-height: 1.2;
  --primary-page-card-subtitle-size: 12px;
  --primary-page-card-subtitle-line-height: 1.25;
  --primary-page-card-subtitle-color: var(--text-2);
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

.dog-list__search {
  margin: 0 var(--space-page);
  height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--card);
  border-radius: var(--radius-btn);
  padding: 0 16px;
  box-shadow: var(--shadow);
}

.dog-list__search-icon {
  font-family: 'Material Icons Round';
  font-size: 20px;
  color: var(--text-3);
}

.dog-list__search-input {
  flex: 1;
  height: 44px;
  line-height: 44px;
  font-size: 14px;
  color: var(--text-1);
  background: transparent;
  border: none;
  outline: none;
  font-family: var(--font-body);
}

.dog-list__search-clear {
  font-size: 18px;
  color: var(--text-3);
  padding: 4px;
}

.dog-list__applied-filters {
  margin: var(--primary-page-subsection-gap) var(--space-page) 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.dog-list__applied-clear {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
}

.dog-list__applied-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dog-list__applied-chip {
  box-shadow: none;
  border-color: rgba(240, 88, 136, 0.18);
  background: rgba(255, 245, 248, 0.92);
  &:active { opacity: 0.8; }
}

.dog-list__content {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: var(--primary-page-section-gap);
}

.dog-list__card {
  background: var(--card);
  border-radius: var(--primary-page-card-radius);
  padding: 12px 14px 11px;
  padding-left: 15px;
  position: relative;
  box-shadow: var(--primary-page-card-shadow);
  overflow: hidden;
  border-left: var(--primary-page-card-bar-width) solid transparent;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  cursor: pointer;
  &:active {
    transform: scale(var(--primary-page-card-active-scale));
    box-shadow: var(--primary-page-card-shadow-active);
  }
}

.dog-list__card--fresh {
  box-shadow: 0 0 0 2px rgba(234, 62, 119, 0.18), 0 8px 18px rgba(234, 62, 119, 0.08);
  background: linear-gradient(135deg, rgba(255, 250, 252, 0.98), rgba(255, 246, 249, 0.94));
}

.dog-list__card::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.66;
}

.dog-list__card--bar-red { border-left-color: var(--red); }
.dog-list__card--bar-illness { border-left-color: rgba(224, 82, 82, 0.72); }
.dog-list__card--bar-rose { border-left-color: var(--rose); }
.dog-list__card--bar-green { border-left-color: var(--green); }
.dog-list__card--bar-blue { border-left-color: var(--blue); }
.dog-list__card--bar-plum { border-left-color: var(--plum); }
.dog-list__card--bar-teal { border-left-color: var(--teal); }
.dog-list__card--bar-amber { border-left-color: var(--amber); }

.dog-list__card--bar-red::before { background: linear-gradient(135deg, rgba(255, 241, 239, 0.84) 0%, transparent 38%); }
.dog-list__card--bar-illness::before { background: linear-gradient(135deg, rgba(255, 241, 239, 0.8) 0%, transparent 38%); }
.dog-list__card--bar-rose::before { background: linear-gradient(135deg, rgba(255, 243, 247, 0.82) 0%, transparent 38%); }
.dog-list__card--bar-green::before { background: linear-gradient(135deg, rgba(241, 251, 246, 0.8) 0%, transparent 38%); }
.dog-list__card--bar-blue::before { background: linear-gradient(135deg, rgba(241, 247, 255, 0.82) 0%, transparent 38%); }
.dog-list__card--bar-plum::before { background: linear-gradient(135deg, rgba(247, 243, 252, 0.82) 0%, transparent 38%); }
.dog-list__card--bar-teal::before { background: linear-gradient(135deg, rgba(240, 251, 249, 0.82) 0%, transparent 38%); }
.dog-list__card--bar-amber::before { background: linear-gradient(135deg, rgba(255, 247, 236, 0.82) 0%, transparent 38%); }

.dog-list__card > * {
  position: relative;
  z-index: 1;
}

.dog-list__card-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.dog-list__card-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2px solid transparent;
  margin-top: 1px;
}

.dog-list__card-entity-icon {
  line-height: 1;
}

.dog-list__card-icon--red { background: var(--icon-red); }
.dog-list__card-icon--illness { background: rgba(255, 217, 212, 0.78); }
.dog-list__card-icon--rose { background: var(--icon-rose); }
.dog-list__card-icon--green { background: var(--icon-green); }
.dog-list__card-icon--blue { background: var(--icon-blue); }
.dog-list__card-icon--plum { background: var(--icon-plum); }
.dog-list__card-icon--teal { background: var(--icon-teal); }
.dog-list__card-icon--amber { background: var(--icon-amber); }

.dog-list__card-icon--ring-red { border-color: var(--red); }
.dog-list__card-icon--ring-illness { border-color: rgba(224, 82, 82, 0.68); }
.dog-list__card-icon--ring-rose { border-color: var(--rose); }
.dog-list__card-icon--ring-green { border-color: var(--green); }
.dog-list__card-icon--ring-blue { border-color: var(--blue); }
.dog-list__card-icon--ring-plum { border-color: var(--plum); }
.dog-list__card-icon--ring-teal { border-color: var(--teal); }
.dog-list__card-icon--ring-amber { border-color: var(--amber); }

.dog-list__card-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding-top: 1px;
}

.dog-list__card-name {
  font-size: var(--primary-page-card-title-size);
  font-weight: var(--primary-page-card-title-weight);
  color: var(--text-1);
  line-height: var(--primary-page-card-title-line-height);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dog-list__card-sub {
  display: block;
  font-size: var(--primary-page-card-subtitle-size);
  line-height: var(--primary-page-card-subtitle-line-height);
  color: var(--primary-page-card-subtitle-color);
  margin-top: 4px;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dog-list__card-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.dog-list__side-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  padding: 3px 8px;
  border-radius: var(--radius-tag);
}

.dog-list__side-tag-text {
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.dog-list__side-tag--muted {
  background: rgba(216, 203, 189, 0.22);
  .dog-list__side-tag-text { color: var(--text-2); }
}

.dog-list__side-tag--green {
  background: var(--green-soft);
  .dog-list__side-tag-text { color: var(--green); }
}

.dog-list__disposition-tag--amber {
  background: var(--amber-soft);
  .dog-list__side-tag-text { color: var(--amber); }
}

.dog-list__disposition-tag--blue {
  background: var(--blue-soft);
  .dog-list__side-tag-text { color: var(--blue); }
}

.dog-list__disposition-tag--teal {
  background: var(--teal-soft);
  .dog-list__side-tag-text { color: var(--teal); }
}

.dog-list__disposition-tag--plum {
  background: var(--plum-soft);
  .dog-list__side-tag-text { color: var(--plum); }
}

.dog-list__disposition-tag--rose {
  background: var(--rose-soft);
  .dog-list__side-tag-text { color: var(--rose); }
}

.dog-list__disposition-tag--red {
  background: var(--red-soft);
  .dog-list__side-tag-text { color: var(--red); }
}

.dog-list__side-tag--role-primary {
  background: rgba(240, 88, 136, 0.1);
  .dog-list__side-tag-text { color: var(--primary); }
}

.dog-list__side-tag--role-muted {
  background: rgba(216, 203, 189, 0.18);
  .dog-list__side-tag-text { color: var(--text-3); }
}

.dog-list__card-statuses {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
  justify-content: flex-start;
}

.dog-list__status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 11px;
  border-radius: var(--radius-tag);
}

.dog-list__status-tag-text {
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.dog-list__status-tag--more {
  background: rgba(216, 203, 189, 0.18);
  .dog-list__status-tag-text { color: var(--text-3); }
}

.dog-list__status-tag--illness {
  background: rgba(255, 228, 223, 0.95);
  .dog-list__status-tag-text { color: rgba(201, 70, 70, 1); }
}

.dog-list__status-tag--red {
  background: var(--red-soft);
  .dog-list__status-tag-text { color: var(--red); }
}

.dog-list__status-tag--rose {
  background: var(--rose-soft);
  .dog-list__status-tag-text { color: var(--rose); }
}

.dog-list__status-tag--green {
  background: var(--green-soft);
  .dog-list__status-tag-text { color: var(--green); }
}

.dog-list__status-tag--blue {
  background: var(--blue-soft);
  .dog-list__status-tag-text { color: var(--blue); }
}

.dog-list__status-tag--plum {
  background: var(--plum-soft);
  .dog-list__status-tag-text { color: var(--plum); }
}

.dog-list__status-tag--teal {
  background: var(--teal-soft);
  .dog-list__status-tag-text { color: var(--teal); }
}

.dog-list__status-tag--amber {
  background: var(--amber-soft);
  .dog-list__status-tag-text { color: var(--amber); }
}

.filter-panel {
  padding-bottom: 16px;
}

.filter-section {
  margin-bottom: 16px;
}

.filter-section__label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  margin-bottom: 8px;
}

.filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-pill {
  padding: 6px 14px;
  border-radius: var(--radius-tag);
  font-size: 12px;
  font-weight: 600;
  border: 1.5px solid var(--text-4);
  background: transparent;
  color: var(--text-2);
  transition: all 0.12s ease;
  &:active { transform: scale(0.94); }
}

.filter-pill--active {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--primary);
  .filter-pill__text { color: var(--primary); }
}

.filter-pill__text {
  font-size: 12px;
  font-weight: 600;
}

.filter-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.filter-actions__btn {
  flex: 1;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-btn);
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
}

.filter-actions__btn--primary {
  background: var(--primary);
}

.filter-actions__btn--ghost {
  background: transparent;
  border: 1.5px solid var(--text-4);
}

.filter-actions__btn-text {
  font-size: 15px;
  font-weight: 600;
}
</style>
