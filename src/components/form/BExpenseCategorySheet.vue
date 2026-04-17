<template>
  <BSheet v-model:visible="sheetVisible" title="选择分类" height="auto">
    <view class="category-sheet">
      <template v-if="recentCategories.length">
        <text class="category-sheet__section-title">最近使用</text>
        <view class="category-sheet__recent-row">
          <view
            v-for="item in recentCategories"
            :key="`recent-${item}`"
            class="category-sheet__recent-btn"
            :class="{ 'category-sheet__recent-btn--active': item === modelValue }"
            @click="selectCategory(item)"
          >
            <text class="material-icons-round category-sheet__recent-icon">{{ getCategoryMeta(item).icon }}</text>
            <text class="category-sheet__recent-text">{{ item }}</text>
          </view>
        </view>
      </template>

      <text class="category-sheet__section-title">全部分类</text>
      <view class="category-sheet__grid">
        <view
          v-for="item in categories"
          :key="item"
          class="category-sheet__item"
          :class="{ 'category-sheet__item--selected': item === modelValue }"
          @click="selectCategory(item)"
        >
          <view
            class="category-sheet__icon"
            :style="{ background: getCategoryMeta(item).bg }"
          >
            <text class="material-icons-round category-sheet__icon-text">{{ getCategoryMeta(item).icon }}</text>
          </view>
          <text class="category-sheet__name">{{ item }}</text>
        </view>

        <view class="category-sheet__item category-sheet__item--dashed" @click="openManage">
          <view class="category-sheet__icon category-sheet__icon--dashed">
            <text class="material-icons-round category-sheet__icon-text category-sheet__icon-text--muted">add</text>
          </view>
          <text class="category-sheet__name">自定义+</text>
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
  categories: string[]
  recentCategories?: string[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:modelValue': [value: string]
  manage: []
}>()

const sheetVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

const recentCategories = computed(() =>
  (props.recentCategories || []).filter(item => props.categories.includes(item)).slice(0, 2),
)

const CATEGORY_META: Record<string, { icon: string; bg: string }> = {
  '食品': { icon: 'restaurant', bg: '#FFD4DE' },
  '营养品': { icon: 'medication', bg: '#E4D8F4' },
  '消耗品': { icon: 'shopping_bag', bg: '#D4E8F8' },
  '日常用品': { icon: 'home', bg: '#D0F0EC' },
  '固定开销': { icon: 'pin_drop', bg: '#FFD9D4' },
  '交通': { icon: 'directions_car', bg: '#D4E8F8' },
  '医疗': { icon: 'local_hospital', bg: '#D0F0DC' },
  '配种费': { icon: 'favorite', bg: '#FFD4DE' },
  '其他': { icon: 'more_horiz', bg: 'var(--card-dim)' },
}

function getCategoryMeta(name: string) {
  return CATEGORY_META[name] || { icon: 'category', bg: 'var(--amber-soft)' }
}

function selectCategory(name: string) {
  emit('update:modelValue', name)
  emit('update:visible', false)
}

function openManage() {
  emit('update:visible', false)
  emit('manage')
}
</script>

<style lang="scss" scoped>
.category-sheet {
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
    justify-content: center;
    gap: 8px;
    padding: 12px;
    border-radius: 14px;
    background: var(--card-dim);
    border: 2px solid transparent;
    transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease;

    &:active { transform: scale(0.97); }

    &--active {
      border-color: var(--primary);
      background: var(--primary-soft);
    }
  }

  &__recent-icon {
    font-size: 16px;
    color: var(--text-1);
  }

  &__recent-text {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  &__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 4px 10px;
    border-radius: 16px;
    border: 2px solid transparent;
    transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease;

    &:active { transform: scale(0.97); }

    &--selected {
      border-color: var(--primary);
      background: var(--primary-soft);
    }
  }

  &__icon {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;

    &--dashed {
      border: 2px dashed var(--text-4);
      background: transparent;
    }
  }

  &__icon-text {
    font-size: 22px;
    color: #555;

    &--muted {
      color: var(--text-3);
    }
  }

  &__name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-1);
    text-align: center;
    line-height: 1.3;
  }
}
</style>
