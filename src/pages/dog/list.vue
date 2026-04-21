<!--
  犬只列表页 (D-1)
  搜索优先 + 档案筛选 + 当前状态可见
-->
<template>
  <view class="dog-list">
    <view class="dog-list__header">
      <view class="dog-list__header-actions">
        <view class="dog-list__header-add" @click="goToAdd">
          <text class="material-icons-round" style="font-size: 22px; color: var(--primary);">add</text>
        </view>
        <text class="dog-list__filter-icon material-icons-round" @click="showFilterSheet = true">filter_list</text>
      </view>
    </view>

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

    <scroll-view scroll-x class="dog-list__filters">
      <view class="dog-list__filters-inner">
        <view
          v-for="filter in filterOptions"
          :key="filter.value"
          class="dog-list__chip"
          :class="{ 'dog-list__chip--active': activeFilter === filter.value }"
          @click="activeFilter = filter.value"
        >
          <text class="dog-list__chip-text">{{ filter.label }}</text>
        </view>
      </view>
    </scroll-view>

    <view v-if="appliedFilterChips.length" class="dog-list__applied-filters">
      <view
        v-for="chip in appliedFilterChips"
        :key="`${chip.group}-${chip.value}`"
        class="dog-list__applied-chip"
        @click="removeAppliedFilter(chip.group, chip.value)"
      >
        <text class="dog-list__applied-chip-text">{{ chip.label }}</text>
        <text class="dog-list__applied-chip-icon material-icons-round">close</text>
      </view>
      <text class="dog-list__applied-clear" @click="resetAdvancedFilters">清空</text>
    </view>

    <view v-if="loading" class="dog-list__skeleton-wrap">
      <BSkeleton :rows="4" avatar />
    </view>

    <view v-else class="dog-list__content">
      <view
        v-for="dog in filteredDogs"
        :key="dog._id"
        class="dog-list__card"
        :class="cardBarClass(dog)"
        @click="goToDetail(dog._id)"
      >
        <view class="dog-list__card-row">
          <view
            class="dog-list__card-icon"
            :class="[cardIconBgClass(dog), cardRingClass(dog)]"
          >
            <text class="dog-list__card-emoji">{{ dog.role === '幼崽' ? '🐶' : '🐩' }}</text>
          </view>

          <view class="dog-list__card-main">
            <view class="dog-list__card-top">
              <text class="dog-list__card-name">{{ dog.name || '未命名' }}</text>
              <view
                v-if="shouldShowDispositionTag(dog)"
                class="dog-list__disposition-tag"
                :class="dispositionTagClass(dog)"
              >
                <text class="dog-list__disposition-tag-text">{{ dog.displayDisposition }}</text>
              </view>
            </view>
            <text
              class="dog-list__card-meta-line"
            >
              <text
                v-if="dog.primaryStatusTitle"
                class="dog-list__card-status-inline"
                :class="primaryStatusTextClass(dog)"
              >
                {{ dog.primaryStatusTitle }}
              </text>
              <text v-if="dog.primaryStatusTitle" class="dog-list__card-meta-text"> · </text>
              <text class="dog-list__card-meta-text">{{ dog.metaInfoText }}</text>
              <text v-if="dog.secondaryStatusInlineText" class="dog-list__card-meta-text"> · {{ dog.secondaryStatusInlineText }}</text>
            </text>
          </view>
        </view>
      </view>

      <BEmpty
        v-if="filteredDogs.length === 0"
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
          <view class="filter-actions__btn filter-actions__btn--primary" @click="applyAdvancedFilters">
            <text class="filter-actions__btn-text" style="color: #fff;">应用筛选</text>
          </view>
          <view class="filter-actions__btn filter-actions__btn--ghost" @click="resetAdvancedFilters">
            <text class="filter-actions__btn-text" style="color: var(--text-2);">重置</text>
          </view>
        </view>
      </view>
    </BSheet>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BNavBar from '@/components/layout/BNavBar.vue'
import BSheet from '@/components/layout/BSheet.vue'
import { useDogStore } from '@/stores/dogStore'
import type { DeriveStatus, DeriveStatusType, DogDisposition, DogWithStatus } from '@/types/dog'
import { getDogStatusTone } from '@/utils/themeSemantics'

type QuickFilterValue = 'all' | 'breeding' | 'puppy' | 'for-sale' | 'external'
type FilterGroup = 'genders' | 'roles' | 'dispositions' | 'statuses'
type TagColor = 'red' | 'amber' | 'green' | 'blue' | 'plum' | 'rose' | 'teal'

interface AppliedFilterChip {
  group: FilterGroup
  value: string
  label: string
}

interface DogListItem extends DogWithStatus {
  activeStatuses: DeriveStatus[]
  primaryStatus?: DeriveStatus
  primaryStatusTitle: string
  secondaryStatuses: DeriveStatus[]
  secondaryOverflowCount: number
  secondaryStatusInlineText: string
  metaInfoText: string
  displayDisposition: DogDisposition
  hasHighlightedDisposition: boolean
  sortBucket: number
  statusPriority: number
  isActiveStatusDog: boolean
}

const DEFAULT_DISPOSITION: DogDisposition = '在养'
const MAX_SECONDARY_STATUS_TAGS = 2
const dogs = ref<DogWithStatus[]>([])
const loading = ref(true)
const activeFilter = ref<QuickFilterValue>('all')
const showFilterSheet = ref(false)
const searchKeyword = ref('')
const dogStore = useDogStore()

const filterOptions: Array<{ label: string; value: QuickFilterValue }> = [
  { label: '全部', value: 'all' },
  { label: '种狗', value: 'breeding' },
  { label: '幼崽', value: 'puppy' },
  { label: '待售', value: 'for-sale' },
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

const filterLabelMap: Record<FilterGroup, Record<string, string>> = {
  genders: Object.fromEntries(genderOptions.map(opt => [opt.value, opt.label])),
  roles: Object.fromEntries(roleOptions.map(opt => [opt.value, opt.label])),
  dispositions: Object.fromEntries(dispositionOptions.map(opt => [opt.value, opt.label])),
  statuses: Object.fromEntries(statusOptions.map(opt => [opt.value, opt.label])),
}

const advFilters = reactive({
  genders: [] as string[],
  roles: [] as string[],
  dispositions: [] as string[],
  statuses: [] as string[],
})

const appliedFilters = reactive({
  genders: [] as string[],
  roles: [] as string[],
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

function getStatusDayText(status: DeriveStatus) {
  if (status.progress?.current) return `第${status.progress.current}天`
  const dayMeta = (status.meta || []).find(item => /^第\d+天$/.test(item.text))
  return dayMeta?.text || ''
}

function statusTitle(status: DeriveStatus): string {
  if (status.type === '怀孕中' && status.progress) return `${status.type} · 第${status.progress.current}天`
  if (status.type === '发情中') {
    const dayText = getStatusDayText(status)
    return dayText ? `${status.type} · ${dayText}` : status.type
  }
  if (status.type === '哺乳中') {
    const dayText = getStatusDayText(status)
    return dayText ? `${status.type} · ${dayText}` : status.type
  }
  if (status.type === '用药中') {
    const med = splitStatusDetail(status.detail).primary || status.label || status.type
    return status.progress ? `${med} · 第${status.progress.current}天` : med
  }
  if (status.type === '生病中') {
    const dayMeta = (status.meta || []).find(item => item.text.startsWith('第'))
    const illnessName = status.label || status.type
    if (dayMeta?.text) return `${illnessName} · ${dayMeta.text}`
    return illnessName
  }
  return status.label || status.type
}

function secondaryStatusLabel(status: DeriveStatus) {
  if (status.type === '生病中') return '生病中'
  if (status.type === '用药中') return '用药中'
  return status.type
}

function buildMetaInfoText(dog: DogWithStatus) {
  const parts = [dog.breed || '马尔济斯']
  if (dog.birth_date) parts.push(formatAge(dog.birth_date))
  parts.push(roleLabel(dog))
  return parts.join(' · ')
}

function buildSecondaryStatusInlineText(activeStatuses: DeriveStatus[]) {
  const secondaryCount = Math.max(0, activeStatuses.length - 1)
  if (secondaryCount === 0) return ''
  if (secondaryCount === 1) return secondaryStatusLabel(activeStatuses[1])
  return `+${secondaryCount}`
}

function buildDogListItem(dog: DogWithStatus): DogListItem {
  const activeStatuses = sortStatuses(dog.statuses || [])
  const primaryStatus = activeStatuses[0]
  const secondaryStatuses = activeStatuses.slice(1, 1 + MAX_SECONDARY_STATUS_TAGS)
  const secondaryOverflowCount = Math.max(0, activeStatuses.length - 1 - MAX_SECONDARY_STATUS_TAGS)
  const displayDisposition = normalizeDisposition(dog)
  const hasHighlightedDisposition = !isWeakDisposition(displayDisposition)
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
    displayDisposition,
    hasHighlightedDisposition,
    sortBucket,
    statusPriority: primaryStatus ? getStatusPriority(primaryStatus.type) : STATUS_PRIORITY_MAP.正常,
    isActiveStatusDog: activeStatuses.length > 0,
  }
}

const appliedFilterChips = computed<AppliedFilterChip[]>(() => {
  const chips: AppliedFilterChip[] = []
  ;(Object.keys(appliedFilters) as FilterGroup[]).forEach(group => {
    appliedFilters[group].forEach(value => {
      chips.push({
        group,
        value,
        label: filterLabelMap[group][value] || value,
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
  else if (activeFilter.value === 'for-sale') result = result.filter(dog => dog.displayDisposition === '待售')
  else if (activeFilter.value === 'external') result = result.filter(dog => dog.role === '外部种公')

  if (appliedFilters.genders.length > 0) {
    result = result.filter(dog => appliedFilters.genders.includes(dog.gender))
  }
  if (appliedFilters.roles.length > 0) {
    result = result.filter(dog => appliedFilters.roles.includes(dog.role))
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

function primaryStatusTextClass(dog: DogListItem) {
  if (!dog.primaryStatus) return ''
  if (isIllnessStatus(dog.primaryStatus.type)) return 'dog-list__card-status-inline--illness'
  return `dog-list__card-status-inline--${statusColor(dog.primaryStatus.type)}`
}

function shouldShowDispositionTag(dog: DogListItem) {
  return dog.hasHighlightedDisposition
}

function dispositionTagClass(dog: DogListItem) {
  if (!dog.hasHighlightedDisposition) return 'dog-list__disposition-tag--muted'

  const map: Record<DogDisposition, string> = {
    在养: 'dog-list__disposition-tag--muted',
    自留: 'dog-list__disposition-tag--muted',
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
  uni.navigateTo({ url: '/pages/dog/add' })
}

async function loadDogs() {
  if (dogStore.list.length > 0) {
    dogs.value = dogStore.list
    loading.value = false
    dogStore.fetchFromServer().then(() => {
      dogs.value = dogStore.list
    })
  } else {
    loading.value = true
    await dogStore.ensure()
    dogs.value = dogStore.list
    loading.value = false
  }
}

onShow(() => {
  loadDogs()
})
</script>

<style lang="scss" scoped>
.dog-list {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

.dog-list__header {
  padding: 8px var(--space-page) 0;
  display: flex;
  justify-content: flex-end;
}

.dog-list__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dog-list__header-add {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.12s ease;
  &:active { background: var(--primary-soft); }
}

.dog-list__filter-icon {
  font-family: 'Material Icons Round';
  font-size: 24px;
  color: var(--text-2);
  padding: 6px;
}

.dog-list__search {
  margin: 8px 16px 0;
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

.dog-list__filters {
  white-space: nowrap;
}

.dog-list__filters-inner {
  display: flex;
  gap: 8px;
  padding: 10px 16px 0;
}

.dog-list__chip {
  font-size: 13px;
  font-weight: 600;
  padding: 6px 16px;
  border-radius: var(--radius-tag);
  white-space: nowrap;
  background: var(--card);
  color: var(--text-2);
  border: 1.5px solid var(--text-4);
  transition: transform 0.12s ease;
  &:active { transform: scale(0.94); }
}

.dog-list__chip--active {
  background: var(--primary);
  border-color: var(--primary);
  .dog-list__chip-text { color: #fff; }
}

.dog-list__chip-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.dog-list__applied-filters {
  margin: 8px 16px 0;
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: var(--radius-tag);
  background: var(--primary-soft);
  &:active { opacity: 0.8; }
}

.dog-list__applied-chip-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
}

.dog-list__applied-chip-icon {
  font-family: 'Material Icons Round';
  font-size: 14px;
  color: var(--primary);
}

.dog-list__skeleton-wrap {
  padding: 14px 16px 0;
}

.dog-list__content {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.dog-list__card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 10px 12px;
  padding-left: 13px;
  position: relative;
  box-shadow: 0 4px 14px rgba(45, 27, 20, 0.05);
  overflow: hidden;
  border-left: 3px solid transparent;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  cursor: pointer;
  &:active {
    transform: scale(0.975);
    box-shadow: 0 2px 8px rgba(45, 27, 20, 0.06);
  }
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
  align-items: center;
  gap: 10px;
}

.dog-list__card-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2px solid transparent;
}

.dog-list__card-emoji {
  font-size: 16px;
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
}

.dog-list__card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dog-list__card-name {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dog-list__card-meta-line {
  display: block;
  font-size: 12px;
  line-height: 1.35;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dog-list__card-status-inline {
  font-size: 12px;
  font-weight: 700;
}

.dog-list__card-meta-text {
  font-size: 12px;
  color: var(--text-2);
}

.dog-list__disposition-tag {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: var(--radius-tag);
}

.dog-list__disposition-tag-text {
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
}

.dog-list__disposition-tag--amber {
  background: var(--amber-soft);
  .dog-list__disposition-tag-text { color: var(--amber); }
}

.dog-list__disposition-tag--blue {
  background: var(--blue-soft);
  .dog-list__disposition-tag-text { color: var(--blue); }
}

.dog-list__disposition-tag--teal {
  background: var(--teal-soft);
  .dog-list__disposition-tag-text { color: var(--teal); }
}

.dog-list__disposition-tag--plum {
  background: var(--plum-soft);
  .dog-list__disposition-tag-text { color: var(--plum); }
}

.dog-list__disposition-tag--rose {
  background: var(--rose-soft);
  .dog-list__disposition-tag-text { color: var(--rose); }
}

.dog-list__disposition-tag--red {
  background: var(--red-soft);
  .dog-list__disposition-tag-text { color: var(--red); }
}

.dog-list__card-status-inline--red { color: var(--red); }
.dog-list__card-status-inline--illness { color: rgba(201, 70, 70, 1); }
.dog-list__card-status-inline--rose { color: var(--rose); }
.dog-list__card-status-inline--green { color: var(--green); }
.dog-list__card-status-inline--blue { color: var(--blue); }
.dog-list__card-status-inline--plum { color: var(--plum); }
.dog-list__card-status-inline--teal { color: var(--teal); }
.dog-list__card-status-inline--amber { color: var(--amber); }

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
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.filter-actions__btn {
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
