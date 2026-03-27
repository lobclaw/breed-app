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

<style lang="scss" scoped>
.join {
  min-height: 100vh;
  background: var(--bg);
}

.join__section {
  background: var(--card);
  margin: 8px 16px;
  border-radius: var(--radius-card);
  padding: 20px;
  text-align: center;
  box-shadow: var(--shadow);
}

.join__desc {
  font-size: 14px;
  color: var(--text-2);
  display: block;
  margin-bottom: 20px;
}

.join__input {
  font-size: 24px;
  font-weight: 700;
  font-family: var(--font-display);
  text-align: center;
  letter-spacing: 6px;
  color: var(--text-1);
  border-bottom: 2px solid var(--primary);
  padding: 10px;
  margin-bottom: 20px;
  text-transform: uppercase;
}

.join__btn {
  width: 100%;
  height: 44px;
  border-radius: var(--radius-btn);
  background: var(--primary);
  color: var(--card);
  font-size: 16px;
  font-family: var(--font-display);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.join__btn[disabled] {
  opacity: 0.5;
}
</style>
