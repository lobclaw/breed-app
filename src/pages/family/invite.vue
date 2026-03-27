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

<style lang="scss" scoped>
.invite {
  min-height: 100vh;
  background: var(--bg);
}

.invite__section {
  background: var(--card);
  margin: 8px 16px;
  border-radius: var(--radius-card);
  padding: 20px;
  text-align: center;
  box-shadow: var(--shadow);
}

.invite__desc {
  font-size: 14px;
  color: var(--text-2);
  display: block;
  margin-bottom: 20px;
}

.invite__code-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
}

.invite__code {
  font-size: 28px;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--primary);
  letter-spacing: 4px;
}

.invite__copy {
  font-size: 12px;
}

.invite__btn {
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
</style>
