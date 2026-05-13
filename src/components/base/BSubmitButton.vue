<!--
  BSubmitButton — 表单提交按钮
  统一承接提交三态：默认 / 提交中 / 成功
-->
<template>
  <button
    class="submit-btn"
    :class="{
      'submit-btn--success': success,
      'submit-btn--inactive': inactive,
    }"
    :disabled="disabled || loading"
    :loading="loading"
    @click="handleClick"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  loading?: boolean
  success?: boolean
  disabled?: boolean
  inactive?: boolean
  inactiveTip?: string
}>(), {
  loading: false,
  success: false,
  disabled: false,
  inactive: false,
  inactiveTip: '',
})

const emit = defineEmits<{ click: [] }>()

function handleClick() {
  if (props.inactive) {
    uni.showToast({ title: props.inactiveTip || '请补全必填信息', icon: 'none' })
    return
  }
  emit('click')
}
</script>
