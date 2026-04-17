<template>
  <BSheet v-model:visible="sheetVisible" title="选择分类" height="auto">
    <view class="income-sheet">
      <template v-if="recentTypes.length">
        <text class="income-sheet__section-title">最近使用</text>
        <view class="income-sheet__recent-row">
          <view
            v-for="item in recentTypes"
            :key="`recent-${item}`"
            class="income-sheet__recent-btn"
            :class="{ 'income-sheet__recent-btn--active': item === modelValue }"
            @click="selectType(item)"
          >
            <view
              class="income-sheet__recent-icon"
              :style="{ background: getTypeMeta(item).bg }"
            >
              <text class="material-icons-round income-sheet__recent-icon-text">{{ getTypeMeta(item).icon }}</text>
            </view>
            <text class="income-sheet__recent-text">{{ item }}</text>
          </view>
        </view>
      </template>

      <text class="income-sheet__section-title">全部分类</text>
      <view class="income-sheet__grid">
        <view
          v-for="item in types"
          :key="item"
          class="income-sheet__card"
          :class="{ 'income-sheet__card--selected': item === modelValue }"
          @click="selectType(item)"
        >
          <view
            class="income-sheet__icon"
            :style="{ background: getTypeMeta(item).bg }"
          >
            <text class="material-icons-round income-sheet__icon-text">{{ getTypeMeta(item).icon }}</text>
          </view>
          <view class="income-sheet__content">
            <text class="income-sheet__name">{{ item }}</text>
            <text class="income-sheet__desc">{{ getTypeMeta(item).desc }}</text>
          </view>
        </view>
      </view>
    </view>
  </BSheet>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BSheet from '@/components/layout/BSheet.vue'

const props = defineProps<{
  visible: boolean
  modelValue: string
  types: string[]
  recentTypes?: string[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:modelValue': [value: string]
}>()

const sheetVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

const recentTypes = computed(() =>
  (props.recentTypes || []).filter(item => props.types.includes(item)).slice(0, 2),
)

const TYPE_META: Record<string, { icon: string; bg: string; desc: string }> = {
  '销售': { icon: 'sell', bg: '#FFD9E2', desc: '幼犬销售、尾款回收' },
  '定金保留': { icon: 'savings', bg: '#FFE7C7', desc: '取消后保留的定金' },
  '领养': { icon: 'volunteer_activism', bg: '#F6D8E9', desc: '领养费、安置费用' },
  '其他': { icon: 'more_horiz', bg: '#E8E1DA', desc: '补录收入或其他进账' },
}

function getTypeMeta(name: string) {
  return TYPE_META[name] || { icon: 'payments', bg: '#FFD9E2', desc: '手动记录收入' }
}

function selectType(name: string) {
  emit('update:modelValue', name)
  emit('update:visible', false)
}
</script>

<style lang="scss" scoped>
.income-sheet {
  padding-bottom: 24px;

  &__section-title {
    display: block;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  &__recent-row {
    display: flex;
    gap: 10px;
    margin-bottom: 24px;
  }

  &__recent-btn {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border-radius: 16px;
    background: linear-gradient(180deg, #fff6f2 0%, #fff0ea 100%);
    border: 2px solid transparent;
    transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease;

    &:active { transform: scale(0.97); }

    &--active {
      border-color: var(--red);
      background: linear-gradient(180deg, #ffe8ef 0%, #ffdfe8 100%);
      box-shadow: 0 8px 18px rgba(224, 82, 82, 0.08);
    }
  }

  &__recent-icon {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__recent-icon-text {
    font-size: 18px;
    color: #5e4b4b;
  }

  &__recent-text {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  &__card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: 18px;
    border: 2px solid transparent;
    background: linear-gradient(180deg, #fff7f3 0%, #fff1eb 100%);
    transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;

    &:active { transform: scale(0.97); }

    &--selected {
      border-color: var(--red);
      background: linear-gradient(180deg, #ffe9ef 0%, #ffe1e9 100%);
      box-shadow: 0 10px 24px rgba(224, 82, 82, 0.1);
    }
  }

  &__icon {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__icon-text {
    font-size: 22px;
    color: #5e4b4b;
  }

  &__content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__desc {
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-3);
  }
}
</style>
