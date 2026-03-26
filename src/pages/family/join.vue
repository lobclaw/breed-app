<template>
  <view class="join">
    <view class="join__section">
      <text class="join__desc">输入管理员分享的6位邀请码加入家庭</text>
      <input v-model="code" class="join__input" placeholder="邀请码" maxlength="6" />
      <button class="join__btn" :loading="joining" :disabled="code.length < 6" @click="doJoin">加入家庭</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useCloudCall } from '@/composables/useCloudCall'

const code = ref('')
const joining = ref(false)

const { run: joinFamily } = useCloudCall<{ data: any }>('family-service', 'joinFamily', { successMessage: '已加入', showLoading: true })

async function doJoin() {
  joining.value = true
  const res = await joinFamily(code.value)
  if (res?.data) {
    uni.showToast({ title: `已加入「${res.data.familyName}」`, icon: 'success' })
    setTimeout(() => uni.switchTab({ url: '/pages/home/index' }), 1500)
  }
  joining.value = false
}
</script>

<style scoped>
.join { min-height: 100vh; background: #f5f5f5; }
.join__section { background: #fff; margin: 16rpx 32rpx; border-radius: 16rpx; padding: 40rpx; text-align: center; }
.join__desc { font-size: 28rpx; color: #666; display: block; margin-bottom: 40rpx; }
.join__input { font-size: 48rpx; font-weight: 700; text-align: center; letter-spacing: 12rpx; color: #333; border-bottom: 4rpx solid #007AFF; padding: 20rpx; margin-bottom: 40rpx; text-transform: uppercase; }
.join__btn { width: 100%; height: 88rpx; border-radius: 44rpx; background: #007AFF; color: #fff; font-size: 32rpx; }
.join__btn[disabled] { opacity: 0.5; }
</style>
