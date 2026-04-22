<!--
  BSubmitButton — 表单提交按钮
  统一承接提交三态：默认 / 提交中 / 成功
-->
<template>
  <button
    class="submit-btn"
    :class="{ 'submit-btn--success': success }"
    :disabled="disabled || loading"
    :loading="loading"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  loading?: boolean
  success?: boolean
  disabled?: boolean
}>(), {
  loading: false,
  success: false,
  disabled: false,
})

defineEmits<{ click: [] }>()
</script>
