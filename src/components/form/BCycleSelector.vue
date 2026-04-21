<!--
  BCycleSelector — 繁育周期选择器
  BSheet-based picker，列出繁育周期供选择
  Props:
    visible — 是否显示 (v-model)
    damId — 按母犬过滤（可选）
    multiple — 是否多选
    selectedIds — 已选周期 ID 列表
  Emits:
    select(cycle) — 选中周期
    selectMultiple(cycles) — 多选回传
    update:visible — 关闭面板
-->
<template>
  <BSheet v-model:visible="sheetVisible" title="选择繁育周期" height="50%">
    <!-- 加载态 -->
    <BSkeleton v-if="loading" :rows="3" />

    <!-- 空状态 -->
    <BEmpty
      v-else-if="!cycles.length"
      icon="cycle"
      title="暂无繁育周期"
      description="当前没有可选的繁育周期记录"
    />

    <!-- 列表 -->
    <view v-else class="b-cycle-selector">
      <!-- 活跃周期 -->
      <view
        v-for="cycle in activeCycles"
        :key="cycle._id"
        class="b-cycle-selector__item"
        @click="handleSelect(cycle)"
      >
        <view class="b-cycle-selector__info">
          <text class="b-cycle-selector__title">{{ cycle.damName || '未知母犬' }}</text>
          <text class="b-cycle-selector__meta">
            第{{ cycle.cycleNumber || '?' }}次繁育 · {{ cycle.statusLabel }} · {{ cycle.detail }}
          </text>
        </view>
        <view class="b-cycle-selector__tag" :class="getTagClass(cycle.status)">
          <text class="b-cycle-selector__tag-text">{{ cycle.statusLabel }}</text>
        </view>
        <view
          class="b-cycle-selector__radio"
          :class="{ 'b-cycle-selector__radio--active': isSelected(cycle._id) }"
        >
          <text
            v-if="props.multiple && isSelected(cycle._id)"
            class="material-icons-round"
            style="font-size: 14px; color: #fff;"
          >check</text>
        </view>
      </view>

      <!-- 已完成周期分隔 -->
      <view v-if="closedCycles.length && activeCycles.length" class="b-cycle-selector__divider">
        <text class="b-cycle-selector__divider-text">已完成</text>
      </view>

      <!-- 已关闭周期 -->
      <view
        v-for="cycle in closedCycles"
        :key="cycle._id"
        class="b-cycle-selector__item"
        @click="handleSelect(cycle)"
      >
        <view class="b-cycle-selector__info">
          <text class="b-cycle-selector__title">{{ cycle.damName || '未知母犬' }}</text>
          <text class="b-cycle-selector__meta">
            第{{ cycle.cycleNumber || '?' }}次繁育 · {{ cycle.detail }}
          </text>
        </view>
        <view class="b-cycle-selector__tag b-cycle-selector__tag--green">
          <text class="b-cycle-selector__tag-text">已完成</text>
        </view>
        <view
          class="b-cycle-selector__radio"
          :class="{ 'b-cycle-selector__radio--active': isSelected(cycle._id) }"
        >
          <text
            v-if="props.multiple && isSelected(cycle._id)"
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
import BSheet from '../layout/BSheet.vue'
import BSkeleton from '../feedback/BSkeleton.vue'
import BEmpty from '../feedback/BEmpty.vue'

interface Cycle {
  _id: string
  damName?: string
  cycleNumber?: number
  status?: string
  statusLabel: string
  detail: string
  startDate?: number
  recordCount?: number
  [key: string]: any
}

const props = defineProps<{
  visible: boolean
  damId?: string
  multiple?: boolean
  selectedIds?: string[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  select: [cycle: Cycle]
  selectMultiple: [cycles: Cycle[]]
}>()

const sheetVisible = computed({
  get: () => props.visible,
  set: (val: boolean) => emit('update:visible', val),
})

const loading = ref(false)
const cycles = ref<Cycle[]>([])
const selected = ref('')
const selectedIdsState = ref<string[]>([])

const activeCycles = computed(() => cycles.value.filter(c => c.status !== 'completed'))
const closedCycles = computed(() => cycles.value.filter(c => c.status === 'completed'))

const STATUS_MAP: Record<string, string> = {
  heat: '发情中',
  mating: '配种中',
  pregnant: '怀孕中',
  whelping: '待产',
  nursing: '哺乳中',
  preparing: '准备中',
  completed: '已完成',
}

watch(() => props.visible, async (val) => {
  if (val) {
    selectedIdsState.value = [...(props.selectedIds || [])]
    await fetchCycles()
  }
})

watch(() => props.selectedIds, (val) => {
  if (props.multiple) {
    selectedIdsState.value = [...(val || [])]
  }
}, { deep: true })

async function fetchCycles() {
  loading.value = true
  try {
    const db = uniCloud.database()
    let query: any = db.collection('breeding_cycles')
    if (props.damId) {
      query = query.where(`dam_id == "${props.damId}"`)
    }
    const res = await query
      .orderBy('start_date', 'desc')
      .limit(50)
      .get()

    cycles.value = (res.result?.data || []).map((item: any) => ({
      _id: item._id,
      damName: item.dam_name,
      cycleNumber: item.cycle_number,
      status: item.status,
      statusLabel: STATUS_MAP[item.status] || item.status || '未知',
      detail: formatDetail(item),
      startDate: item.start_date,
      recordCount: item.record_count || 0,
      ...item,
    }))
  } catch (e) {
    console.error('获取繁育周期失败', e)
    cycles.value = []
  } finally {
    loading.value = false
  }
}

function formatDetail(item: any): string {
  if (item.status === 'pregnant' && item.start_date) {
    const days = Math.floor((Date.now() - item.start_date) / 86400000)
    return `第${days}天`
  }
  if (item.start_date) {
    return formatDate(item.start_date)
  }
  return `${item.record_count || 0}条记录`
}

function formatDate(ts?: number): string {
  if (!ts) return '--'
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getTagClass(status?: string): string {
  if (status === 'pregnant' || status === 'whelping') return 'b-cycle-selector__tag--rose'
  if (status === 'completed') return 'b-cycle-selector__tag--green'
  return 'b-cycle-selector__tag--gray'
}

function handleSelect(cycle: Cycle) {
  if (props.multiple) {
    if (isSelected(cycle._id)) {
      selectedIdsState.value = selectedIdsState.value.filter(id => id !== cycle._id)
    } else {
      selectedIdsState.value = [...selectedIdsState.value, cycle._id]
    }
    emit('selectMultiple', cycles.value.filter(item => selectedIdsState.value.includes(item._id)))
    return
  }
  selected.value = cycle._id
  emit('select', cycle)
  sheetVisible.value = false
}

function isSelected(id: string) {
  if (props.multiple) return selectedIdsState.value.includes(id)
  return selected.value === id
}
</script>

<style lang="scss" scoped>
.b-cycle-selector {
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

  &__tag {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: var(--radius-tag);
    flex-shrink: 0;

    &--rose {
      background: var(--rose-soft);
    }
    &--green {
      background: var(--green-soft);
    }
    &--gray {
      background: var(--card-dim);
    }
  }

  &__tag-text {
    font-size: 11px;
    font-weight: 700;
  }

  .b-cycle-selector__tag--rose &__tag-text { color: var(--rose); }
  .b-cycle-selector__tag--green &__tag-text { color: var(--green); }
  .b-cycle-selector__tag--gray &__tag-text { color: var(--text-3); }

  &__tag--rose .b-cycle-selector__tag-text { color: var(--rose); }
  &__tag--green .b-cycle-selector__tag-text { color: var(--green); }
  &__tag--gray .b-cycle-selector__tag-text { color: var(--text-3); }

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

  &__divider {
    padding: 12px 0 6px;
  }

  &__divider-text {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
  }
}
</style>
