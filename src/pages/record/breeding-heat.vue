<template>
  <BreedingRecordForm v-if="ready" mode="create" type="heat" :query="routeQuery" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { usePageSync } from '@/composables/usePageSync'
import BreedingRecordForm from '@/components/record/BreedingRecordForm.vue'

const ready = ref(false)
const routeQuery = ref<Record<string, string>>({})
usePageSync({ routePath: 'pages/record/breeding-heat' })

onLoad((query) => {
  routeQuery.value = { ...(query || {}) } as Record<string, string>
  ready.value = true
})
</script>
