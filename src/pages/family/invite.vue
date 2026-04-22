<template>
  <view class="page">
    <!-- 顶栏 -->
    <BPageHeader title="邀请成员" />

    <view class="content">
      <!-- 邀请卡片 -->
      <view class="invite-card">
        <!-- 图标 -->
        <view class="invite-icon">
          <text class="material-icons-round" style="font-size: 28px; color: var(--primary);">group_add</text>
        </view>

        <!-- 说明 -->
        <text class="invite-desc">生成邀请码，有效期24小时。协助者加入后可查看任务和标记完成。</text>

        <!-- 邀请码展示 -->
        <view v-if="inviteCode" class="code-area">
          <text class="code-text">{{ inviteCode }}</text>
          <view class="code-actions">
            <view class="copy-btn" @click="copyCode">
              <text class="material-icons-round" style="font-size: 16px; color: var(--primary);">content_copy</text>
              <text class="copy-text">复制邀请码</text>
            </view>
          </view>
          <button
            class="regen-action"
            :class="{ 'regen-action--loading': generating }"
            :disabled="generating"
            @click="generate"
          >
            <view class="regen-action__icon">
              <text class="material-icons-round" :class="{ 'regen-action__spin': generating }">autorenew</text>
            </view>
            <view class="regen-action__body">
              <text class="regen-action__title">重新生成邀请码</text>
              <text class="regen-action__subtitle">原邀请码会立即失效</text>
            </view>
            <text class="material-icons-round regen-action__arrow">chevron_right</text>
          </button>
        </view>

        <!-- 有效期提示 -->
        <view v-if="inviteCode" class="hint-box">
          <text class="material-icons-round" style="font-size: 16px; color: var(--amber);">schedule</text>
          <text class="hint-text">邀请码24小时内有效，过期需重新生成</text>
        </view>

        <!-- 生成按钮 -->
        <BSubmitButton
          v-if="!inviteCode"
          :loading="generating"
          :disabled="generating"
          @click="generate"
        >
          <text>生成邀请码</text>
        </BSubmitButton>
      </view>

      <!-- 使用说明 -->
      <view class="help-card">
        <text class="help-title">如何邀请？</text>
        <view class="help-step">
          <view class="step-num"><text>1</text></view>
          <text class="step-text">点击「生成邀请码」获取6位码</text>
        </view>
        <view class="help-step">
          <view class="step-num"><text>2</text></view>
          <text class="step-text">将邀请码分享给家人或助手</text>
        </view>
        <view class="help-step">
          <view class="step-num"><text>3</text></view>
          <text class="step-text">对方在「加入家庭」页面输入邀请码</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSubmitButton from '@/components/base/BSubmitButton.vue'

const inviteCode = ref('')
const generating = ref(false)

const { run: generateCode } = useCloudCall<{ data: { code: string } }>('family-service', 'generateInviteLink', {
  successMode: 'silent',
})

async function generate() {
  if (generating.value) return
  generating.value = true
  try {
    const res = await generateCode()
    if (res?.data?.code) inviteCode.value = res.data.code
  } finally {
    generating.value = false
  }
}

function copyCode() {
  uni.setClipboardData({
    data: inviteCode.value,
    success: () => uni.showToast({ title: '已复制', icon: 'success' }),
  })
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
}

.content {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);
}

/* 邀请卡片 */
.invite-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 24px 20px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.invite-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.invite-desc {
  font-size: 14px;
  color: var(--text-2);
  text-align: center;
  line-height: 1.5;
}

/* 邀请码 */
.code-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 16px 0;
  background: var(--card-dim);
  border-radius: var(--radius-row);
}

.code-text {
  font-size: 32px;
  font-weight: 800;
  font-family: var(--font-display);
  color: var(--primary);
  letter-spacing: 6px;
}

.code-actions {
  display: flex;
  align-items: center;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: var(--radius-tag);
  background: var(--primary-soft);
  transition: all 0.12s ease;
  &:active { transform: scale(0.94); }
}

.copy-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
}

.regen-action {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  margin-top: 4px;
  border: 1px solid rgba(233, 83, 132, 0.14);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 248, 244, 0.98) 100%),
    rgba(255, 255, 255, 0.82);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 10px 24px rgba(233, 83, 132, 0.08);
  text-align: left;
  transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
}

.regen-action:active:not(:disabled) {
  transform: scale(0.985);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 6px 16px rgba(233, 83, 132, 0.1);
}

.regen-action:disabled {
  opacity: 0.6;
}

.regen-action__icon {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, rgba(233, 83, 132, 0.12) 0%, rgba(233, 83, 132, 0.05) 100%);
  color: var(--primary);
  flex-shrink: 0;
}

.regen-action__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.regen-action__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.3;
}

.regen-action__subtitle {
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.3;
}

.regen-action__arrow {
  font-size: 18px;
  color: rgba(233, 83, 132, 0.7);
  flex-shrink: 0;
}

.regen-action__spin {
  animation: regen-spin 0.9s linear infinite;
}

.regen-action--loading .regen-action__title {
  color: var(--primary);
}

@keyframes regen-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 提示 */
.hint-box {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--amber-soft);
  border-radius: 10px;
  width: 100%;
}

.hint-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  line-height: 1.4;
}

/* 使用说明 */
.help-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 16px 20px;
  box-shadow: var(--shadow);
}

.help-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 12px;
  display: block;
}

.help-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.step-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 800;
  color: var(--primary);
  font-family: var(--font-display);
}

.step-text {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.4;
}
</style>
