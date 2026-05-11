<template>
  <HealthRecordForm v-if="ready" :mode="recordId ? 'edit' : 'create'" type="deworming" :record-id="recordId" :query="routeQuery" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { usePageSync } from '@/composables/usePageSync'
import { resolveRecordFormEditId } from '@/utils/recordFormRoutes'
import HealthRecordForm from '@/components/record/HealthRecordForm.vue'

const ready = ref(false)
const routeQuery = ref<Record<string, string>>({})
const recordId = ref('')
usePageSync({ routePath: 'pages/record/health-deworming' })

onLoad((query) => {
  routeQuery.value = { ...(query || {}) } as Record<string, string>
  recordId.value = resolveRecordFormEditId(routeQuery.value)
  ready.value = true
})
</script>
