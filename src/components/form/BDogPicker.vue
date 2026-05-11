<!--
  BDogPicker — 犬只选择器（自包含）
  两种使用模式：
  1. 完整模式（推荐）：v-model 绑定选中犬只，组件自带触发卡片
     <BDogPicker v-model="selectedDog" title="选择种母" roleFilter="种狗" genderFilter="母" />
  2. Sheet 模式：仅弹出列表，触发器由调用方控制
     <BDogPicker v-model:visible="show" @select="onSelect" />
-->
<template>
  <!-- 模式 1：带触发卡片 -->
  <template v-if="hasModelValue">
    <!-- 多选已选中：标签列表 -->
    <template v-if="multiple && selectedDogList.length > 0">
      <view class="b-dog-tags" @click="openSheet">
        <view v-for="dog in selectedDogList" :key="dog._id" class="b-dog-tag" :class="avatarColorClass(dog)">
          <BEntityIcon :role="dog.role" :size="12" color="#fff" />
          <text class="b-dog-tag__name">{{ dog.name }}</text>
          <text class="b-dog-tag__remove" @click.stop="removeDog(dog._id)">×</text>
        </view>
        <view class="b-dog-tag b-dog-tag--add">
          <text class="material-icons-round" style="font-size: 14px; color: var(--primary);">add</text>
        </view>
      </view>
    </template>
    <!-- 单选已选中：卡片 -->
    <template v-else-if="!multiple && singleDog">
      <view class="b-dog-card" :class="{ 'b-dog-card--readonly': readonly }" @click="readonly ? undefined : openSheet()">
        <view class="b-dog-card__avatar" :class="avatarColorClass(singleDog)">
          <BEntityIcon :role="singleDog.role" :size="20" color="#fff" />
        </view>
        <view class="b-dog-card__info">
          <text class="b-dog-card__name">{{ singleDog.name }}</text>
          <text class="b-dog-card__meta">{{ singleDog.breed || '马尔济斯' }}<template v-if="singleDog.gender"> · {{ singleDog.gender }}</template></text>
        </view>
        <text v-if="readonly" class="material-icons-round" style="font-size: 18px; color: var(--text-4);">lock</text>
        <text v-else class="material-icons-round" style="font-size: 18px; color: var(--text-4);">chevron_right</text>
      </view>
    </template>
    <!-- 未选中：空态 -->
    <view v-else class="b-dog-card-empty" @click="openSheet">
      <BEntityIcon :size="18" color="var(--text-3)" />
      <text>{{ placeholder }}</text>
    </view>
  </template>

  <!-- Sheet 弹出列表 -->
  <BSheet v-model:visible="sheetVisible" :title="title" height="70%">
    <!-- 搜索栏 -->
    <view class="b-dog-picker__search">
      <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">search</text>
      <input
        v-model="searchKeyword"
        class="b-dog-picker__search-input"
        placeholder="搜索犬只名字..."
        confirm-type="search"
      />
      <text
        v-if="searchKeyword"
        class="material-icons-round b-dog-picker__search-clear"
        @click="searchKeyword = ''"
      >close</text>
    </view>

    <!-- 筛选栏 -->
    <view v-if="visibleFilterTabs.length || multiple" class="b-dog-picker__filter-row">
      <scroll-view
        v-if="visibleFilterTabs.length"
        scroll-x
        class="b-dog-picker__filters-scroll"
        show-scrollbar="false"
        enhanced
      >
        <view class="b-dog-picker__filters">
          <view
            v-for="f in visibleFilterTabs"
            :key="f.value"
            class="b-dog-picker__filter"
            :class="{ 'b-dog-picker__filter--active': isFilterActive(f.value) }"
            @click="selectFilter(f.value)"
          >
            <text>{{ f.label }}</text>
          </view>
        </view>
      </scroll-view>
      <view v-if="multiple && filteredDogs.length > 0" class="b-dog-picker__select-all" @click="toggleSelectAll">
        <text>{{ isAllSelected ? '取消全选' : '全选' }}</text>
      </view>
    </view>

    <!-- 加载态 -->
    <BSkeleton v-if="loading" :rows="4" />

    <!-- 空状态 -->
    <BEmpty
      v-else-if="!filteredDogs.length"
      icon="pets"
      :title="emptyTitle"
      :description="emptyDescription"
    />

    <!-- 列表 -->
    <view v-else class="b-dog-picker__list">
      <view
        v-for="dog in filteredDogs"
        :key="dog._id"
        class="b-dog-picker__item"
        @click="toggleDog(dog)"
      >
        <view class="b-dog-picker__avatar" :class="avatarColorClass(dog)">
          <BEntityIcon :role="dog.role" :size="18" color="#fff" />
        </view>
        <view class="b-dog-picker__info">
          <view class="b-dog-picker__title-row">
            <text class="b-dog-picker__name">{{ dog.name || '未命名' }}</text>
            <view v-if="dogHealthStatusTags(dog).length" class="b-dog-picker__health-tags">
              <text
                v-for="tag in dogHealthStatusTags(dog)"
                :key="tag.key"
                class="b-dog-picker__health-tag"
                :class="`b-dog-picker__health-tag--${tag.tone}`"
              >
                {{ tag.label }}
              </text>
            </view>
            <text v-if="dogExtraMetaText(dog)" class="b-dog-picker__extra-meta">
              {{ dogExtraMetaText(dog) }}
            </text>
            <text
              v-if="props.showBreedingStage && dogBreedingStageTag(dog)"
              class="b-dog-picker__stage-tag"
              :class="`b-dog-picker__stage-tag--${dogBreedingStageTag(dog)?.tone}`"
            >
              {{ dogBreedingStageTag(dog)?.text }}
            </text>
          </view>
          <text class="b-dog-picker__meta">
            {{ dogMetaText(dog) }}
          </text>
        </view>
        <view
          class="b-dog-picker__check"
          :class="{ 'b-dog-picker__check--active': isSelected(dog._id) }"
        >
          <text v-if="isSelected(dog._id)" class="material-icons-round" style="font-size: 16px; color: #fff;">check</text>
        </view>
      </view>
    </view>

  </BSheet>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useDogStore } from '@/stores/dogStore'
import { useAuth } from '@/composables/useAuth'
import { getBeijingOrdinalDay } from '@/utils/date'
import { buildCompactDeriveStatusTitle } from '@/utils/dogStatusCopy'
import { getDogStatusTone } from '@/utils/themeSemantics'
import type { DeriveStatus } from '@/types/dog'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BSheet from '../layout/BSheet.vue'
import BSkeleton from '../feedback/BSkeleton.vue'
import BEmpty from '../feedback/BEmpty.vue'

interface Dog {
  _id: string
  name: string
  gender: string
  role: string
  breed?: string
  birth_date?: number | null
  disposition?: string
  [key: string]: any
}

const props = withDefaults(defineProps<{
  /** 选中的犬只（v-model）。单选: Dog | null，多选: Dog[] */
  modelValue?: Dog | Dog[] | null
  /** Sheet 可见性（v-model:visible），仅 sheet-only 模式 */
  visible?: boolean
  /** sheet-only 模式下的已选 ID */
  selectedIds?: string[]
  /** 是否多选 */
  multiple?: boolean
  /** 角色过滤 */
  roleFilter?: string
  /** 性别过滤 */
  genderFilter?: string
  /** 是否包含外部种公（默认不包含） */
  includeExternalSires?: boolean
  /** Sheet 标题 */
  title?: string
  /** 只读模式：显示已选犬只但不允许修改 */
  readonly?: boolean
  /** 空态占位文字 */
  placeholder?: string
  /** 排除的犬只 ID */
  excludeIds?: string[]
  /** 显式候选犬只；传入后不再从 store 自行筛选 */
  candidateDogs?: Dog[] | undefined
  /** 空态标题 */
  emptyTitle?: string
  /** 空态描述 */
  emptyDescription?: string
  /** 按犬只 ID 展示的额外副信息 */
  extraMetaMap?: Record<string, string>
  /** 是否展示繁育阶段标签 */
  showBreedingStage?: boolean
  /** 是否在名字右侧展示当前疾病/用药标签 */
  showHealthStatusTags?: boolean
  /** 头像配色变体 */
  avatarVariant?: 'default' | 'sire'
}>(), {
  modelValue: undefined,
  visible: undefined,
  selectedIds: () => [],
  multiple: false,
  roleFilter: '',
  genderFilter: '',
  includeExternalSires: false,
  title: '选择犬只',
  placeholder: '点击选择犬只',
  readonly: false,
  excludeIds: () => [],
  candidateDogs: undefined,
  emptyTitle: '暂无犬只',
  emptyDescription: '没有符合条件的犬只',
  extraMetaMap: () => ({}),
  showBreedingStage: false,
  showHealthStatusTags: false,
  avatarVariant: 'default',
})

const emit = defineEmits<{
  'update:modelValue': [value: Dog | Dog[] | null]
  'update:visible': [value: boolean]
  select: [dog: Dog]
  selectMultiple: [dogs: Dog[]]
}>()

// 判断使用哪种模式
const hasModelValue = computed(() => props.modelValue !== undefined)

// 单选时的犬只对象
const singleDog = computed(() => {
  if (props.multiple) return null
  if (Array.isArray(props.modelValue)) return props.modelValue[0] || null
  return props.modelValue || null
})

// 多选时的犬只列表
const selectedDogList = computed(() => {
  if (!props.multiple) return []
  if (Array.isArray(props.modelValue)) return props.modelValue
  return props.modelValue ? [props.modelValue] : []
})

// 移除某只已选犬只（多选模式）
function removeDog(dogId: string) {
  if (!Array.isArray(props.modelValue)) return
  const updated = props.modelValue.filter(d => d._id !== dogId)
  emit('update:modelValue', updated)
}

// Sheet 可见性（两种模式共用）
const internalVisible = ref(false)

const sheetVisible = computed({
  get: () => {
    if (props.visible !== undefined) return props.visible
    return internalVisible.value
  },
  set: (val: boolean) => {
    if (props.visible !== undefined) {
      emit('update:visible', val)
    }
    internalVisible.value = val
  },
})

function openSheet() {
  sheetVisible.value = true
}

const loading = ref(false)
const dogs = ref<Dog[]>([])
const selectedIds = ref<string[]>([])
const activeFilter = ref('all')
const activeBreedFilter = ref('all')
const searchKeyword = ref('')
const PRESET_BREEDS = ['马尔济斯', '西施', '约克夏']

const filterTabs = computed(() => {
  if (props.candidateDogs !== undefined) return []
  if (props.roleFilter || props.genderFilter) return []
  return [
    { label: '全部', value: 'all' },
    { label: '种母', value: 'dam' },
    { label: '种公', value: 'sire' },
    { label: '幼崽', value: 'puppy' },
  ]
})

const shouldShowBreedFilter = computed(() => (
  props.candidateDogs !== undefined || !!props.roleFilter || !!props.genderFilter
))

const breedFilterTabs = computed(() => {
  if (!shouldShowBreedFilter.value) return []

  const customBreeds = currentFamily.value?.settings?.custom_breed_types || []
  const values = new Set<string>(['all', ...PRESET_BREEDS])
  for (const breed of customBreeds) {
    const value = `${breed || ''}`.trim()
    if (value) values.add(value)
  }
  for (const dog of visibleDogs.value) {
    values.add(normalizeBreed(dog))
  }

  const custom = [...values]
    .filter(value => value !== 'all' && !PRESET_BREEDS.includes(value))
    .sort(compareString)

  return [
    { label: '全部', value: 'all' },
    ...PRESET_BREEDS.map(value => ({ label: value, value })),
    ...custom.map(value => ({ label: value, value })),
  ]
})

const visibleFilterTabs = computed(() => (
  breedFilterTabs.value.length ? breedFilterTabs.value : filterTabs.value
))

const filteredDogs = computed(() => {
  let list = visibleDogs.value

  // 搜索过滤
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    list = list.filter(d => d.name?.toLowerCase().includes(kw))
  }

  // 角色过滤
  if (activeFilter.value === 'dam') return list.filter(d => d.role === '种狗' && d.gender === '母')
  if (activeFilter.value === 'sire') return list.filter(d => d.role === '种狗' && d.gender === '公')
  if (activeFilter.value === 'puppy') return list.filter(d => d.role === '幼崽')
  if (breedFilterTabs.value.length && activeBreedFilter.value !== 'all') {
    return list.filter(d => normalizeBreed(d) === activeBreedFilter.value)
  }
  return list
})

const sourceDogs = computed(() => props.candidateDogs !== undefined ? props.candidateDogs : dogs.value)

const visibleDogs = computed(() => (
  (
    props.includeExternalSires
      ? sourceDogs.value
      : sourceDogs.value.filter(d => d.role !== '外部种公')
  ).filter(d => !props.excludeIds.includes(d._id))
))

const dogStore = useDogStore()
const { currentFamily } = useAuth()

// 组件挂载时预加载
dogStore.ensure()

watch(() => sheetVisible.value, (val) => {
  if (val) {
    selectedIds.value = !hasModelValue.value
      ? [...(props.selectedIds || [])]
      : []
    searchKeyword.value = ''
    if (!breedFilterTabs.value.some(tab => tab.value === activeBreedFilter.value)) {
      activeBreedFilter.value = 'all'
    }
    loadDogs()
  }
})

watch(breedFilterTabs, (tabs) => {
  if (!tabs.some(tab => tab.value === activeBreedFilter.value)) {
    activeBreedFilter.value = 'all'
  }
})

watch(() => props.selectedIds, (val) => {
  if (!hasModelValue.value) {
    selectedIds.value = [...(val || [])]
  }
}, { deep: true })

async function loadDogs() {
  if (props.candidateDogs !== undefined) {
    loading.value = false
    return
  }

  if (dogStore.loaded) {
    dogs.value = dogStore.getFiltered(props.roleFilter, props.genderFilter)
    loading.value = false
    // 后台刷新
    dogStore.fetchFromServer().then(() => {
      dogs.value = dogStore.getFiltered(props.roleFilter, props.genderFilter)
    })
  } else {
    loading.value = true
    await dogStore.ensure()
    dogs.value = dogStore.getFiltered(props.roleFilter, props.genderFilter)
    loading.value = false
  }
}

const isAllSelected = computed(() => {
  if (filteredDogs.value.length === 0) return false
  return filteredDogs.value.every(d => isSelected(d._id))
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    // 取消全选：从当前 modelValue 中移除 filteredDogs 里的所有犬
    if (hasModelValue.value && props.multiple) {
      const filteredIds = new Set(filteredDogs.value.map(d => d._id))
      const current = Array.isArray(props.modelValue) ? props.modelValue : []
      const next = current.filter(d => !filteredIds.has(d._id))
      emit('update:modelValue', next)
      emitSelectedMultiple(next)
    } else {
      selectedIds.value = selectedIds.value.filter(
        id => !filteredDogs.value.some(d => d._id === id)
      )
      emitSelectedMultiple()
    }
  } else {
    // 全选：将 filteredDogs 中未选中的都加入
    if (hasModelValue.value && props.multiple) {
      const current = Array.isArray(props.modelValue) ? [...props.modelValue] : []
      const currentIds = new Set(current.map(d => d._id))
      for (const dog of filteredDogs.value) {
        if (!currentIds.has(dog._id)) current.push(dog)
      }
      emit('update:modelValue', current)
      emitSelectedMultiple(current)
    } else {
      const currentSet = new Set(selectedIds.value)
      for (const dog of filteredDogs.value) {
        if (!currentSet.has(dog._id)) selectedIds.value.push(dog._id)
      }
      emitSelectedMultiple()
    }
  }
}

function isSelected(id: string) {
  // v-model 模式
  if (hasModelValue.value) {
    if (props.multiple && Array.isArray(props.modelValue)) {
      return props.modelValue.some(d => d._id === id)
    }
    if (!props.multiple && singleDog.value) {
      return singleDog.value._id === id
    }
  }
  // sheet-only 模式
  return selectedIds.value.includes(id)
}

function toggleDog(dog: Dog) {
  if (props.multiple) {
    if (hasModelValue.value) {
      // v-model 多选模式：直接更新 modelValue 数组
      const current = Array.isArray(props.modelValue) ? [...props.modelValue] : []
      const idx = current.findIndex(d => d._id === dog._id)
      if (idx >= 0) {
        current.splice(idx, 1)
      } else {
        current.push(dog)
      }
      emit('update:modelValue', current)
      emit('selectMultiple', current)
    } else {
      // sheet-only 多选：用内部 selectedIds
      const idx = selectedIds.value.indexOf(dog._id)
      if (idx >= 0) {
        selectedIds.value.splice(idx, 1)
      } else {
        selectedIds.value.push(dog._id)
      }
      emitSelectedMultiple()
    }
  } else {
    // 单选：选中即关闭
    if (hasModelValue.value) {
      emit('update:modelValue', dog)
    }
    emit('select', dog)
    sheetVisible.value = false
  }
}

function emitSelectedMultiple(override?: Dog[]) {
  if (!props.multiple) return
  if (hasModelValue.value) {
    const selected = override || (Array.isArray(props.modelValue) ? props.modelValue : [])
    emit('selectMultiple', selected)
    return
  }
  const selected = override || dogs.value.filter(d => selectedIds.value.includes(d._id))
  emit('selectMultiple', selected)
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    '种狗': '种犬',
    '幼崽': '幼崽',
    '外部种公': '外部种公',
  }
  return map[role] || role
}

function dogMetaText(dog: Dog) {
  const parts = [normalizeBreed(dog)]
  if (dog.gender) parts.push(dog.gender)
  const ageText = formatAge(dog.birth_date)
  if (ageText) parts.push(ageText)
  parts.push(roleLabel(dog.role))
  return parts.join(' · ')
}

function dogExtraMetaText(dog: Dog) {
  return props.extraMetaMap?.[dog._id] || ''
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

function medicationStatusName(status: DeriveStatus) {
  return splitStatusDetail(status.detail).primary || status.label || '用药'
}

function statusTagLabel(status: DeriveStatus) {
  if (status.type === '用药中' && Number(status.count || 0) >= 2) {
    return `${medicationStatusName(status)}等${Number(status.count)}项`
  }

  return buildCompactDeriveStatusTitle(status, {
    nameOverride: status.type === '用药中' ? splitStatusDetail(status.detail).primary : undefined,
  })
}

function healthStatusTagTone(status: DeriveStatus) {
  return getDogStatusTone(status.type).variant === 'illness'
    ? 'illness'
    : getDogStatusTone(status.type).color
}

function dogHealthStatusTags(dog: Dog) {
  if (!props.showHealthStatusTags) return []
  const statuses = Array.isArray(dog.statuses) ? dog.statuses : []
  return statuses
    .filter((status): status is DeriveStatus => status?.type === '生病中' || status?.type === '用药中')
    .slice(0, 2)
    .map((status, index) => ({
      key: `${status.type}-${status.recordId || status.taskId || status.activityTs || index}`,
      label: statusTagLabel(status),
      tone: healthStatusTagTone(status),
    }))
}

function dogBreedingStageTag(dog: Dog) {
  const statuses = Array.isArray(dog.statuses) ? dog.statuses : []
  const heatStatus = statuses.find(status => status?.type === '发情中')
  if (heatStatus) {
    const day = getStatusDayCount(heatStatus)
    return {
      text: day ? `发情第${day}天` : '发情中',
      tone: 'heat',
    }
  }

  const pregnantStatus = statuses.find(status => status?.type === '怀孕中')
  if (pregnantStatus) {
    const day = getStatusDayCount(pregnantStatus)
    return {
      text: day ? `怀孕第${day}天` : '怀孕中',
      tone: 'pregnant',
    }
  }

  return null
}

function getStatusDayCount(status: Record<string, any>) {
  const progressDay = Number(status?.progress?.current)
  if (Number.isFinite(progressDay) && progressDay > 0) return Math.floor(progressDay)

  const texts = Array.isArray(status?.meta)
    ? status.meta.map((item: any) => `${item?.text || ''}`)
    : []
  const dayText = texts.find(text => /^第\s*\d+\s*天$/.test(text))
  const matched = dayText?.match(/^第\s*(\d+)\s*天$/)
  return matched ? Number(matched[1]) : null
}

function normalizeBreed(dog: Pick<Dog, 'breed'>) {
  return dog.breed?.trim() || '马尔济斯'
}

function compareString(a?: string | null, b?: string | null) {
  return `${a || ''}`.localeCompare(`${b || ''}`, 'zh-Hans-CN')
}

function isFilterActive(value: string) {
  return breedFilterTabs.value.length
    ? activeBreedFilter.value === value
    : activeFilter.value === value
}

function selectFilter(value: string) {
  if (breedFilterTabs.value.length) {
    activeBreedFilter.value = value
  } else {
    activeFilter.value = value
  }
}

function avatarColorClass(dog: Dog) {
  if (props.avatarVariant === 'sire') return 'b-dog-picker__avatar--blue'
  if (dog.role === '幼崽') return 'b-dog-picker__avatar--amber'
  if (dog.role === '外部种公') return 'b-dog-picker__avatar--blue'
  if (dog.gender === '母') return 'b-dog-picker__avatar--rose'
  if (dog.gender === '公') return 'b-dog-picker__avatar--blue'
  return 'b-dog-picker__avatar--teal'
}

function formatAge(birthTs?: number | null) {
  if (!birthTs) return ''
  const days = getBeijingOrdinalDay(birthTs) || 1
  if (days < 30) return `${days}天`
  if (days < 365) return `${Math.floor(days / 30)}月龄`
  const y = Math.floor(days / 365)
  const m = Math.floor((days % 365) / 30)
  return m > 0 ? `${y}岁${m}月` : `${y}岁`
}
</script>

<style lang="scss" scoped>
/* ==================== 触发卡片（模式 1） ==================== */
.b-dog-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--card);
  border-radius: 14px;
  border: 1px solid var(--text-4);
  transition: all 0.15s ease;

  &:active { transform: scale(0.98); }
  &--readonly { pointer-events: none; opacity: 0.8; }

  &__avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary), var(--amber));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-2);
    margin-top: 2px;
    display: block;
  }
}

/* ---- 多选标签列表 ---- */
.b-dog-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 14px;
  background: var(--card);
  border-radius: 14px;
  border: 1px solid var(--text-4);
  min-height: 48px;
  align-items: center;
}

.b-dog-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px 4px 6px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--primary), var(--amber));

  &__name {
    font-size: 12px;
    font-weight: 600;
    color: #fff;
  }

  &__remove {
    font-size: 16px;
    color: rgba(255, 255, 255, 0.7);
    margin-left: 2px;
    line-height: 1;
  }

  &--add {
    background: var(--card-dim);
    padding: 6px 10px;
    border: 1px dashed var(--text-4);
  }
}

/* ---- 空态 ---- */
.b-dog-card-empty {
  width: 100%;
  height: 60px;
  border-radius: 14px;
  border: 1px dashed var(--text-4);
  background: var(--card);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.2s;

  .material-icons-round {
    font-size: 20px;
    color: var(--text-4);
  }

  text:not(.material-icons-round) {
    font-size: 14px;
    color: var(--text-4);
    font-weight: 500;
  }
}

/* ==================== 搜索栏 ==================== */
.b-dog-picker__search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  background: var(--card-dim);
  border-radius: 20px;
  margin-bottom: 12px;
}

.b-dog-picker__search-input {
  flex: 1;
  height: 40px;
  line-height: 40px;
  font-size: 13px;
  color: var(--text-1);
  background: transparent;
  border: none;
  outline: none;
}

.b-dog-picker__search-clear {
  font-size: 18px;
  color: var(--text-3);
  padding: 2px;
}

/* ==================== Sheet 内列表 ==================== */
.b-dog-picker__filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.b-dog-picker__filters-scroll {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.b-dog-picker__filters {
  display: inline-flex;
  gap: 8px;
  min-width: max-content;
}

.b-dog-picker__select-all {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
  padding: 4px 10px;
  border-radius: 12px;
  background: var(--primary-soft);
  white-space: nowrap;
  &:active { opacity: 0.7; }
}

.b-dog-picker__filter {
  padding: 6px 14px;
  border-radius: var(--radius-btn);
  background: var(--card-dim);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  white-space: nowrap;
  transition: all 0.12s ease;

  &--active {
    background: var(--primary);
    color: #fff;
  }
}

.b-dog-picker__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.b-dog-picker__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 4px 12px 0;
  border-bottom: 1px solid rgba(216, 203, 189, 0.15);
  transition: all 0.12s ease;
  overflow: hidden;

  &:last-child { border-bottom: none; }
  &:active { opacity: 0.7; }

  &--selected {
    opacity: 1;
  }
}

.b-dog-picker__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &--rose { background: linear-gradient(135deg, var(--rose), var(--amber)); }
  &--amber { background: linear-gradient(135deg, #e89b3e, #f0b868); }
  &--blue { background: linear-gradient(135deg, #4a8dd4, #72a8e0); }
  &--teal { background: linear-gradient(135deg, #3da88e, #5cc0a8); }
}

.b-dog-picker__info {
  flex: 1;
  min-width: 0;
}

.b-dog-picker__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-bottom: 2px;
}

.b-dog-picker__name {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  display: inline-block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.b-dog-picker__health-tags {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  min-width: 0;
}

.b-dog-picker__health-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 18px;
  max-width: 96px;
  padding: 0 7px;
  border-radius: var(--radius-tag);
  font-size: 10px;
  font-weight: 600;
  line-height: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &--illness {
    color: rgba(201, 70, 70, 1);
    background: rgba(255, 228, 223, 0.95);
  }

  &--plum {
    color: var(--plum);
    background: var(--plum-soft);
  }
}

.b-dog-picker__stage-tag {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  line-height: 18px;

  &--heat {
    color: #e89b3e;
    background: rgba(245, 179, 65, 0.12);
  }

  &--pregnant {
    color: var(--primary);
    background: rgba(234, 62, 119, 0.1);
  }
}

.b-dog-picker__meta {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.b-dog-picker__extra-meta {
  display: inline-block;
  flex-shrink: 0;
  max-width: 150px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.b-dog-picker__check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--text-4);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;

  &--active {
    border-color: var(--primary);
    background: var(--primary);
  }
}

.b-dog-picker__footer {
  padding: 12px 0 0;
}

.b-dog-picker__confirm {
  height: 44px;
  border-radius: var(--radius-btn);
  background: var(--primary);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;

  &:active { transform: scale(0.96); opacity: 0.85; }
}
</style>
