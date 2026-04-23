<template>
  <BDateTimePicker
    :visible="visible"
    :model-value="modelValue"
    mode="date"
    value-type="timestamp"
    @update:visible="emit('update:visible', $event)"
    @update:modelValue="handleUpdate"
  />
</template>

<script setup lang="ts">
import BDateTimePicker from './BDateTimePicker.vue'

const props = defineProps<{
  visible: boolean
  modelValue?: number | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:modelValue': [value: number]
}>()

function handleUpdate(value: number | string) {
  if (typeof value !== 'number') return
  emit('update:modelValue', value)
}
</script>
