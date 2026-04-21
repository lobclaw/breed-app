<template>
  <text
    class="b-entity-icon material-icons-round"
    :style="{ fontSize: size + 'px', color }"
  >{{ resolvedIcon }}</text>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { getDogEntityIcon, type DogEntityKind } from '@/utils/iconRegistry'

const props = withDefaults(defineProps<{
  role?: string | null
  kind?: DogEntityKind
  icon?: string
  size?: number
  color?: string
}>(), {
  role: '',
  kind: 'dog',
  icon: '',
  size: 18,
  color: '#fff',
})

const resolvedIcon = computed(() => {
  if (props.icon) return props.icon
  return getDogEntityIcon({ role: props.role, kind: props.kind })
})
</script>

<style scoped>
.b-entity-icon {
  font-family: 'Material Icons Round';
  line-height: 1;
}
</style>
