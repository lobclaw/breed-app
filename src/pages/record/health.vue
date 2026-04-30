<template>
  <view class="record-legacy-redirect" />
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { usePageSync } from '@/composables/usePageSync'

const HEALTH_ROUTE_MAP: Record<string, string> = {
  vaccination: '/pages/record/health-vaccination',
  deworming: '/pages/record/health-deworming',
  illness: '/pages/record/health-illness',
  medication: '/pages/record/health-medication',
}
usePageSync({ routePath: 'pages/record/health' })

function buildRedirectUrl(query: Record<string, any>) {
  const type = String(query?.type || '').trim()
  const target = HEALTH_ROUTE_MAP[type] || '/pages/record/index'
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
