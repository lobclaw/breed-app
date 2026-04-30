<template>
  <view class="record-legacy-redirect" />
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { usePageSync } from '@/composables/usePageSync'

const BREEDING_ROUTE_MAP: Record<string, string> = {
  heat: '/pages/record/breeding-heat',
  follicle_check: '/pages/record/breeding-follicle',
  mating: '/pages/record/breeding-mating',
  pregnancy_check: '/pages/record/breeding-pregnancy',
  prenatal_check: '/pages/record/breeding-prenatal',
  pre_labor: '/pages/record/breeding-prelabor',
  abnormal_termination: '/pages/record/breeding-termination',
  heat_observation: '/pages/record/heat-observation',
}
usePageSync({ routePath: 'pages/record/breeding' })

function buildRedirectUrl(query: Record<string, any>) {
  const type = String(query?.type || '').trim()
  const target = BREEDING_ROUTE_MAP[type] || '/pages/record/index'
  const params = new URLSearchParams()

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })

  const queryString = params.toString()
  return queryString ? `${target}?${queryString}` : target
}

onLoad((query) => {
  const url = buildRedirectUrl((query || {}) as Record<string, any>)
  uni.redirectTo({
    url,
    fail() {
      uni.navigateTo({ url })
    },
  })
})
</script>

<style lang="scss" scoped>
.record-legacy-redirect {
  min-height: 100vh;
}
</style>
