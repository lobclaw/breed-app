<!--
  BLitterSelector — 窝选择器
  BSheet-based picker，列出活跃窝次供选择
  Props:
    visible — 是否显示 (v-model)
    familyId — 家庭 ID
    multiple — 是否多选
    selectedIds — 已选窝 ID 列表
  Emits:
    select(litter) — 选中窝次
    selectMultiple(litters) — 多选回传
    update:visible — 关闭面板
-->
<template>
  <BSheet v-model:visible="sheetVisible" title="选择窝" height="62%">
    <view class="b-litter-selector__search">
      <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">search</text>
      <input
        v-model="searchKeyword"
        class="b-litter-selector__search-input"
        placeholder="搜索母犬名或窝号..."
        confirm-type="search"
      />
      <text
        v-if="searchKeyword"
        class="material-icons-round b-litter-selector__search-clear"
        @click="searchKeyword = ''"
      >close</text>
    </view>

    <!-- 加载态 -->
    <BSkeleton v-if="loading" :rows="3" />

    <!-- 空状态 -->
    <BEmpty
      v-else-if="!filteredLitters.length"
      :icon="searchKeyword ? 'search_off' : 'child_friendly'"
      :title="searchKeyword ? '没有匹配的窝' : emptyTitle"
      :description="searchKeyword ? '换个关键词试试，或清空搜索查看全部窝次' : emptyDescription"
    />

    <!-- 列表 -->
    <view v-else class="b-litter-selector">
      <view
        v-for="litter in filteredLitters"
        :key="litter._id"
        class="b-litter-selector__item"
        :class="{ 'b-litter-selector__item--active': isSelected(litter._id) }"
        @click="handleSelect(litter)"
      >
        <view class="b-litter-selector__avatar">
          <BEntityIcon kind="litter" :size="18" color="#fff" />
        </view>
        <view class="b-litter-selector__info">
          <text class="b-litter-selector__title">{{ formatLitterTitle(litter) }}</text>
          <text class="b-litter-selector__meta">
            出生日期 {{ formatDate(litter.birthDate) }} · 存活 {{ litter.aliveCount || litter.puppyCount || 0 }}/{{ litter.totalCount || litter.puppyCount || 0 }}
          </text>
        </view>
        <view
          class="b-litter-selector__radio"
          :class="{ 'b-litter-selector__radio--active': isSelected(litter._id) }"
        >
          <text
            v-if="props.multiple && isSelected(litter._id)"
            class="material-icons-round"
            style="font-size: 14px; color: #fff;"
          >check</text>
        </view>
      </view>
    </view>
  </BSheet>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useCloudCall } from '@/composables/useCloudCall'
import BEntityIcon from '../base/BEntityIcon.vue'
import BSheet from '../layout/BSheet.vue'
import BSkeleton from '../feedback/BSkeleton.vue'
import BEmpty from '../feedback/BEmpty.vue'

interface Litter {
  _id: string
  damName?: string
  litterNumber?: number
  birthDate?: number
  puppyCount?: number
  aliveCount?: number
  totalCount?: number
  [key: string]: any
}

const props = withDefaults(defineProps<{
  visible: boolean
  familyId?: string
  multiple?: boolean
  selectedIds?: string[]
  activeOnly?: boolean
}>(), {
  multiple: false,
  selectedIds: () => [],
  activeOnly: false,
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  select: [litter: Litter]
  selectMultiple: [litters: Litter[]]
}>()

const sheetVisible = computed({
  get: () => props.visible,
  set: (val: boolean) => emit('update:visible', val),
})

const loading = ref(false)
const litters = ref<Litter[]>([])
const selected = ref('')
const selectedIdsState = ref<string[]>([])
const searchKeyword = ref('')

const { run: fetchAllLitters } = useCloudCall<{ data: any[] }>('breeding-service', 'getAllLitters')
const { run: fetchActiveLitters } = useCloudCall<{ data: any[] }>('breeding-service', 'getActiveLitters')

const filteredLitters = computed(() => {
  if (!searchKeyword.value.trim()) return litters.value
  const keyword = searchKeyword.value.trim().toLowerCase()
  return litters.value.filter((litter) => {
    const title = formatLitterTitle(litter).toLowerCase()
    const keywords = [
      litter.damName || '',
      title,
      litter.litterNumber ? `第${litter.litterNumber}窝` : '',
      litter.litterNumber ? `${litter.litterNumber}窝` : '',
    ]
    return keywords.some(item => item.toLowerCase().includes(keyword))
  })
})

const emptyTitle = computed(() => props.activeOnly ? '暂无活跃窝记录' : '暂无窝记录')
const emptyDescription = computed(() => (
  props.activeOnly ? '当前没有未断奶的窝次数据' : '当前没有可选择的窝次数据'
))

watch(() => props.visible, async (val) => {
  if (val) {
    selectedIdsState.value = [...(props.selectedIds || [])]
    selected.value = props.selectedIds?.[0] || ''
    searchKeyword.value = ''
    await fetchLitters()
  }
})

watch(() => props.selectedIds, (val) => {
  selectedIdsState.value = [...(val || [])]
  selected.value = val?.[0] || ''
}, { deep: true })

async function fetchLitters() {
  loading.value = true
  try {
    const res = props.activeOnly ? await fetchActiveLitters() : await fetchAllLitters()
    litters.value = (res?.data || []).map((item: any) => ({
      _id: item._id,
      damName: item.dam_name,
      litterNumber: item.litter_number,
      birthDate: item.birth_date,
      puppyCount: (item.puppies || []).length || item.born_alive || item.total_born,
      aliveCount: item.born_alive || (item.puppies || []).length || item.total_born,
      totalCount: item.total_born || item.born_alive || (item.puppies || []).length,
      ...item,
    }))
  } catch (e) {
    litters.value = []
  } finally {
    loading.value = false
  }
}

function handleSelect(litter: Litter) {
  if (props.multiple) {
    if (isSelected(litter._id)) {
      selectedIdsState.value = selectedIdsState.value.filter(id => id !== litter._id)
    } else {
      selectedIdsState.value = [...selectedIdsState.value, litter._id]
    }
    emit('selectMultiple', litters.value.filter(item => selectedIdsState.value.includes(item._id)))
    return
  }
  selected.value = litter._id
  emit('select', litter)
  sheetVisible.value = false
}

function isSelected(id: string) {
  if (props.multiple) return selectedIdsState.value.includes(id)
  return selected.value === id
}

function formatDate(ts?: number): string {
  if (!ts) return '--'
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatLitterTitle(litter: Litter): string {
  const damName = litter.damName || '未知母犬'
  return `${damName}${litter.litterNumber ? `第${litter.litterNumber}窝` : '窝'}`
}
</script>

<style lang="scss" scoped>
.b-litter-selector__search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  background: var(--card-dim);
  border-radius: 20px;
  margin-bottom: 12px;
}

.b-litter-selector__search-input {
  flex: 1;
  height: 40px;
  line-height: 40px;
  font-size: 13px;
  color: var(--text-1);
  background: transparent;
  border: none;
  outline: none;
}

.b-litter-selector__search-clear {
  font-size: 18px;
  color: var(--text-3);
  padding: 2px;
}

.b-litter-selector {
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: 18px;
    background: rgba(255, 252, 249, 0.96);
    border: 1px solid rgba(216, 203, 189, 0.26);
    box-shadow: 0 8px 20px rgba(77, 52, 31, 0.04);
    transition: transform 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;

    &:active {
      opacity: 0.92;
      transform: scale(0.985);
    }
  }

  &__item--active {
    border-color: rgba(234, 62, 119, 0.28);
    background: linear-gradient(180deg, rgba(255, 250, 252, 0.98), rgba(255, 244, 247, 0.95));
    box-shadow: 0 10px 22px rgba(234, 62, 119, 0.08);
  }

  &__avatar {
    width: 40px;
    height: 40px;
    border-radius: 14px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--rose) 0%, #c5527a 100%);
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
    display: block;
    margin-bottom: 2px;
  }

  &__meta {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-3);
    display: block;
  }

  &__radio {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid var(--text-4);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
    transition: border-color 0.12s ease;

    &--active {
      border-color: var(--primary);

      &::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--primary);
      }
    }
  }
}
</style>
