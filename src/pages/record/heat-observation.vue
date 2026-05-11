<template>
  <BreedingRecordForm v-if="ready" :mode="recordId ? 'edit' : 'create'" type="heat_observation" :record-id="recordId" :query="routeQuery" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { usePageSync } from '@/composables/usePageSync'
import { resolveRecordFormEditId } from '@/utils/recordFormRoutes'
import BreedingRecordForm from '@/components/record/BreedingRecordForm.vue'

const ready = ref(false)
const routeQuery = ref<Record<string, string>>({})
const recordId = ref('')
usePageSync({ routePath: 'pages/record/heat-observation' })

onLoad((query) => {
  routeQuery.value = { ...(query || {}) } as Record<string, string>
  recordId.value = resolveRecordFormEditId(routeQuery.value)
  ready.value = true
})
</script>
