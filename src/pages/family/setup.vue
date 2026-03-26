<template>
  <view class="family-setup">
    <view class="family-setup__content">
      <text class="family-setup__title">创建你的犬舍</text>
      <text class="family-setup__desc">为你的犬舍取一个名字，开始管理繁育事务</text>

      <view class="family-setup__input-wrap">
        <input
          v-model="familyName"
          class="family-setup__input"
          placeholder="犬舍名称"
          maxlength="20"
        />
      </view>

      <button
        class="family-setup__btn"
        :disabled="!familyName.trim() || creating"
        :loading="creating"
        @click="create"
      >
        创建家庭
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'

const { createFamily } = useAuth()
const familyName = ref('')
const creating = ref(false)

async function create() {
  if (!familyName.value.trim()) return
  creating.value = true
  try {
    await createFamily(familyName.value.trim())
    uni.showToast({ title: '创建成功', icon: 'success' })
    setTimeout(() => {
      uni.switchTab({ url: '/pages/home/index' })
    }, 1000)
  } catch (e: any) {
    uni.showToast({ title: e.message || '创建失败', icon: 'none' })
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.family-setup { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f5f5f5; padding: 64rpx; }
.family-setup__content { width: 100%; text-align: center; }
.family-setup__title { display: block; font-size: 44rpx; font-weight: 700; color: #333; margin-bottom: 16rpx; }
.family-setup__desc { display: block; font-size: 28rpx; color: #999; margin-bottom: 60rpx; }
.family-setup__input-wrap { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 40rpx; }
.family-setup__input { font-size: 32rpx; text-align: center; }
.family-setup__btn { width: 100%; height: 88rpx; border-radius: 44rpx; background: #007AFF; color: #fff; font-size: 32rpx; }
.family-setup__btn[disabled] { opacity: 0.5; }
</style>
