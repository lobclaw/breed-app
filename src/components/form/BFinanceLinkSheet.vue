<template>
  <BSheet v-model:visible="sheetVisible" title="选择关联" height="auto">
    <view class="link-sheet">
      <view class="link-sheet__cards">
        <view class="link-sheet__card" @click="pick('dogs')">
          <view class="link-sheet__icon link-sheet__icon--dogs">
            <text class="material-icons-round">pets</text>
          </view>
          <view class="link-sheet__body">
            <text class="link-sheet__title">关联犬只</text>
            <text class="link-sheet__desc">{{ isIncomeMode ? '选择一只犬只（可选）' : '选择一只或多只犬只' }}</text>
          </view>
        </view>

        <view v-if="!isIncomeMode" class="link-sheet__card" @click="pick('litter')">
          <view class="link-sheet__icon link-sheet__icon--litter">
            <text class="material-icons-round">holiday_village</text>
          </view>
          <view class="link-sheet__body">
            <text class="link-sheet__title">关联窝</text>
            <text class="link-sheet__desc">关联到某一窝（计入窝成本）</text>
          </view>
        </view>

        <view v-if="!isIncomeMode" class="link-sheet__card" @click="pick('cycle')">
          <view class="link-sheet__icon link-sheet__icon--cycle">
            <text class="material-icons-round">autorenew</text>
          </view>
          <view class="link-sheet__body">
            <text class="link-sheet__title">关联繁育周期</text>
            <text class="link-sheet__desc">关联到繁育过程费用</text>
          </view>
        </view>
      </view>

      <view class="link-sheet__clear" @click="pick('none')">
        <text class="material-icons-round">link_off</text>
        <text>无关联</text>
      </view>
    </view>
  </BSheet>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BSheet from '@/components/layout/BSheet.vue'

const props = defineProps<{
  visible: boolean
  mode?: 'expense' | 'income'
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  select: [kind: 'dogs' | 'litter' | 'cycle' | 'none']
}>()

const sheetVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

const isIncomeMode = computed(() => props.mode === 'income')

function pick(kind: 'dogs' | 'litter' | 'cycle' | 'none') {
  emit('select', kind)
  emit('update:visible', false)
}
</script>

<style lang="scss" scoped>
.link-sheet {
  padding-bottom: 20px;

  &__cards {
    display: grid;
    gap: 10px;
  }

  &__card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 12px;
    border-radius: 16px;
    background: linear-gradient(180deg, #fff8f4 0%, #fff2ec 100%);
    border: 1px solid rgba(216, 203, 189, 0.35);
  }

  &__icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .material-icons-round {
      font-size: 20px;
      color: #5f5353;
    }

    &--dogs { background: #e8f1ff; }
    &--litter { background: #e6f6f2; }
    &--cycle { background: #f3e9ff; }
  }

  &__body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__desc {
    font-size: 12px;
    color: var(--text-3);
  }

  &__clear {
    margin-top: 12px;
    height: 42px;
    border-radius: 14px;
    border: 1px dashed var(--text-4);
    color: var(--text-3);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
  }
}
</style>
