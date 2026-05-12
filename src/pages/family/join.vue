<template>
  <view class="page">
    <!-- 顶栏 -->
    <BPageHeader title="加入家庭" />

    <view class="content">
      <!-- 加入卡片 -->
      <view class="join-card">
        <!-- 图标 -->
        <view class="join-icon">
          <text class="material-icons-round" style="font-size: 28px; color: var(--green);">home</text>
        </view>

        <!-- 说明 -->
        <text class="join-desc">输入管理员分享的6位邀请码加入家庭</text>

        <!-- 邀请码输入 -->
        <view class="code-input-area">
          <view class="member-name-wrap">
            <input
              v-model="memberNickname"
              class="member-name-input"
              type="text"
              placeholder="我的称呼"
              maxlength="20"
              :adjust-position="true"
            />
          </view>

          <view class="code-input-wrap">
            <input
              v-model="code"
              class="code-input"
              type="text"
              placeholder="· · · · · ·"
              maxlength="6"
              :adjust-position="true"
            />
          </view>
          <text class="code-hint">请输入6位邀请码</text>
        </view>

        <!-- 加入按钮 -->
        <BButton
          color="primary"
          size="large"
          :loading="joining"
          :disabled="code.length < 6"
          @click="doJoin"
          style="width: 100%;"
        >
          加入家庭
        </BButton>
      </view>

      <!-- 说明 -->
      <view class="info-card">
        <view class="info-item">
          <text class="material-icons-round" style="font-size: 16px; color: var(--teal);">info</text>
          <text class="info-text">邀请码由管理员生成，有效期24小时</text>
        </view>
        <view class="info-item">
          <text class="material-icons-round" style="font-size: 16px; color: var(--teal);">visibility</text>
          <text class="info-text">加入后你可以查看犬只和任务信息</text>
        </view>
        <view class="info-item">
          <text class="material-icons-round" style="font-size: 16px; color: var(--teal);">check_circle</text>
          <text class="info-text">协助者可以标记任务完成和录入数据</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useCloudCall } from '@/composables/useCloudCall'
import { queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BButton from '@/components/base/BButton.vue'

const code = ref('')
const memberNickname = ref(buildDefaultMemberNickname())
const joining = ref(false)

const { run: joinFamily } = useCloudCall<{ data: any }>('family-service', 'joinFamily', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

function buildDefaultMemberNickname() {
  const userInfo = uni.getStorageSync('uni-id-pages-userInfo') || {}
  const mobile = String(userInfo.mobile || '').trim()
  return mobile.length >= 4 ? `用户${mobile.slice(-4)}` : '用户'
}

function getMemberNickname() {
  return memberNickname.value.trim() || buildDefaultMemberNickname()
}

async function doJoin() {
  joining.value = true
  try {
    const res = await joinFamily({ invite_code: code.value, nickname: getMemberNickname() })
    if (res?.data) {
      queueSubmitFeedback({
        message: `已加入「${res.data.familyName}」`,
        targetRoute: '/pages/home/index',
      })
      await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
      uni.switchTab({ url: '/pages/home/index' })
    }
  } finally {
    joining.value = false
  }
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

/* 加入卡片 */
.join-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 24px 20px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.join-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--green-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}

.join-desc {
  font-size: 14px;
  color: var(--text-2);
  text-align: center;
  line-height: 1.5;
}

/* 邀请码输入 */
.code-input-area {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.member-name-wrap {
  width: 100%;
}

.member-name-input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border: 1px solid rgba(216, 203, 189, 0.7);
  border-radius: var(--radius-row);
  background: var(--card);
  color: var(--text-1);
  font-size: 15px;
  text-align: center;
}

.code-input-wrap {
  width: 100%;
  background: var(--card-dim);
  border-radius: var(--radius-row);
  padding: 4px;
  border: 2px solid transparent;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: var(--primary);
  }
}

.code-input {
  width: 100%;
  height: 56px;
  font-size: 28px;
  font-weight: 800;
  font-family: var(--font-display);
  text-align: center;
  letter-spacing: 8px;
  color: var(--text-1);
  background: transparent;
  text-transform: uppercase;
  caret-color: var(--primary);
}

.code-hint {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

/* 说明信息 */
.info-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 16px 20px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.info-text {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.4;
  flex: 1;
}
</style>
