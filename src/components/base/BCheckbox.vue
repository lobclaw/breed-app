<!--
  BCheckbox — 自定义复选框
  18x18 方块，选中为绿底白勾，未选为描边
  Props:
    modelValue — 是否选中
    label — 标签文字
-->
<template>
  <view class="b-checkbox" :class="{ 'b-checkbox--checked': modelValue }" @click="toggle">
    <view class="b-checkbox__box">
      <text v-if="modelValue" class="b-checkbox__check">&#10003;</text>
    </view>
    <text class="b-checkbox__label" :class="{ 'b-checkbox__label--done': modelValue }">{{ label }}</text>
  </view>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  label: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

function toggle() {
  emit('update:modelValue', !props.modelValue)
}
</script>

<style lang="scss" scoped>
.b-checkbox {
  display: flex;
  align-items: center;
  gap: 10px;
  transition: transform 0.15s ease;

  &:active { transform: scale(0.85); }

  &__box {
    width: 18px;
    height: 18px;
    border-radius: var(--radius-checkbox);
    border: 2px solid var(--text-4);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  &--checked .b-checkbox__box {
    background: var(--green);
    border-color: var(--green);
  }

  &__check {
    color: #FFFFFF;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
  }

  &__label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-1);
    transition: color 0.15s ease;

    &--done {
      color: var(--text-3);
      text-decoration: line-through;
    }
  }
}
</style>
