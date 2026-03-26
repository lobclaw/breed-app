<template>
  <view class="invite">
    <view class="invite__section">
      <text class="invite__desc">生成邀请码，有效期24小时。协助者加入后可查看任务和标记完成。</text>

      <view v-if="inviteCode" class="invite__code-wrap">
        <text class="invite__code">{{ inviteCode }}</text>
        <button class="invite__copy" size="mini" @click="copyCode">复制</button>
      </view>

      <button class="invite__btn" :loading="generating" @click="generate">
        {{ inviteCode ? '重新生成' : '生成邀请码' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useCloudCall } from '@/composables/useCloudCall'

const inviteCode = ref('')
const generating = ref(false)

const { run: generateCode } = useCloudCall<{ data: { code: string } }>('family-service', 'generateInviteLink', { showLoading: true })

async function generate() {
  generating.value = true
  const res = await generateCode()
  if (res?.data?.code) inviteCode.value = res.data.code
  generating.value = false
}

function copyCode() {
  uni.setClipboardData({
    data: inviteCode.value,
    success: () => uni.showToast({ title: '已复制', icon: 'success' }),
  })
}
</script>

<style scoped>
.invite { min-height: 100vh; background: #f5f5f5; }
.invite__section { background: #fff; margin: 16rpx 32rpx; border-radius: 16rpx; padding: 40rpx; text-align: center; }
.invite__desc { font-size: 28rpx; color: #666; display: block; margin-bottom: 40rpx; }
.invite__code-wrap { display: flex; align-items: center; justify-content: center; gap: 16rpx; margin-bottom: 40rpx; }
.invite__code { font-size: 56rpx; font-weight: 700; color: #007AFF; letter-spacing: 8rpx; }
.invite__copy { font-size: 24rpx !important; }
.invite__btn { width: 100%; height: 88rpx; border-radius: 44rpx; background: #007AFF; color: #fff; font-size: 32rpx; }
</style>
