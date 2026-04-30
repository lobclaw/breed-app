<template>
  <HealthRecordForm v-if="ready" mode="create" type="deworming" :query="routeQuery" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { usePageSync } from '@/composables/usePageSync'
import HealthRecordForm from '@/components/record/HealthRecordForm.vue'

const ready = ref(false)
const routeQuery = ref<Record<string, string>>({})
usePageSync({ routePath: 'pages/record/health-deworming' })

onLoad((query) => {
  routeQuery.value = { ...(query || {}) } as Record<string, string>
  ready.value = true
})
</script>
