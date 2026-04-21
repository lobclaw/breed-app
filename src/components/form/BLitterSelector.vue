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
  <BSheet v-model:visible="sheetVisible" title="选择窝" height="50%">
    <!-- 加载态 -->
    <BSkeleton v-if="loading" :rows="3" />

    <!-- 空状态 -->
    <BEmpty
      v-else-if="!litters.length"
      icon="child_friendly"
      title="暂无窝记录"
      description="当前没有活跃的窝次数据"
    />

    <!-- 列表 -->
    <view v-else class="b-litter-selector">
      <view
        v-for="litter in litters"
        :key="litter._id"
        class="b-litter-selector__item"
        @click="handleSelect(litter)"
      >
        <view class="b-litter-selector__info">
          <text class="b-litter-selector__title">{{ litter.damName || '未知母犬' }}</text>
          <text class="b-litter-selector__meta">
            第{{ litter.litterNumber || '?' }}窝 · {{ formatDate(litter.birthDate) }} · {{ litter.puppyCount || 0 }}只
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
import BSheet from '../layout/BSheet.vue'
import BSkeleton from '../feedback/BSkeleton.vue'
import BEmpty from '../feedback/BEmpty.vue'

interface Litter {
  _id: string
  damName?: string
  litterNumber?: number
  birthDate?: number
  puppyCount?: number
  [key: string]: any
}

const props = defineProps<{
  visible: boolean
  familyId?: string
  multiple?: boolean
  selectedIds?: string[]
}>()

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

const { run: fetchAllLitters } = useCloudCall<{ data: any[] }>('breeding-service', 'getAllLitters')

watch(() => props.visible, async (val) => {
  if (val) {
    selectedIdsState.value = [...(props.selectedIds || [])]
    await fetchLitters()
  }
})

watch(() => props.selectedIds, (val) => {
  if (props.multiple) {
    selectedIdsState.value = [...(val || [])]
  }
}, { deep: true })

async function fetchLitters() {
  loading.value = true
  try {
    const res = await fetchAllLitters()
    litters.value = (res?.data || []).map((item: any) => ({
      _id: item._id,
      damName: item.dam_name,
      litterNumber: item.litter_number,
      birthDate: item.birth_date,
      puppyCount: item.total_born,
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
</script>

<style lang="scss" scoped>
.b-litter-selector {
  display: flex;
  flex-direction: column;
  gap: 2px;

  &__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid rgba(216, 203, 189, 0.15);
    transition: all 0.12s ease;

    &:last-child { border-bottom: none; }
    &:active { opacity: 0.7; }
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
