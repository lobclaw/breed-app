<!--
  BInput — 表单输入框
  标签 + 输入框 + 错误提示，支持各种 input 类型
  Props:
    label — 输入框标签
    modelValue — 绑定值
    placeholder — 占位文字
    type — input 类型（默认 text）
    optional — 是否选填（显示"（选填）"）
    error — 错误提示文字
    disabled — 禁用状态
-->
<template>
  <view class="b-input" :class="{ 'b-input--error': error, 'b-input--disabled': disabled }">
    <view v-if="label" class="b-input__label-row">
      <text class="b-input__label">{{ label }}</text>
      <text v-if="optional" class="b-input__optional">（选填）</text>
    </view>
    <view class="b-input__wrap">
      <input
        class="b-input__field"
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="onInput"
      />
      <slot name="suffix" />
    </view>
    <text v-if="error" class="b-input__error">{{ error }}</text>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  label?: string
  modelValue: string | number
  placeholder?: string
  type?: string
  optional?: boolean
  error?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function onInput(e: any) {
  emit('update:modelValue', e.detail.value)
}
</script>

<style lang="scss" scoped>
.b-input {
  margin-bottom: 16px;

  &__label-row {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-bottom: 8px;
  }

  &__label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
  }

  &__optional {
    font-size: 13px;
    color: var(--text-3);
  }

  &__wrap {
    display: flex;
    align-items: center;
    background: var(--card);
    border: 1.5px solid var(--text-4);
    border-radius: var(--radius-row);
    padding: 12px 14px;
    transition: border-color 0.2s ease;
  }

  &__field {
    flex: 1;
    font-size: 15px;
    color: var(--text-1);
    background: transparent;
    border: none;
    outline: none;
  }

  &--error .b-input__wrap {
    border-color: var(--red);
  }

  &__error {
    font-size: 12px;
    color: var(--red);
    margin-top: 4px;
    display: block;
  }

  &--disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}
</style>
