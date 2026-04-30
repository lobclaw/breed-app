<template>
  <BreedingRecordForm v-if="ready" mode="edit" :record-id="recordId" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { usePageSync } from '@/composables/usePageSync'
import { resolveRecordFormEditId } from '@/utils/recordFormRoutes'
import BreedingRecordForm from '@/components/record/BreedingRecordForm.vue'

const ready = ref(false)
const recordId = ref('')
usePageSync({ routePath: 'pages/record/breeding-edit' })

onLoad((query) => {
  recordId.value = resolveRecordFormEditId((query || {}) as Record<string, string>)
  ready.value = true
})
</script>
