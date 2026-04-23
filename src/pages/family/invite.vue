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
        <view v-if="hasActiveInvite" class="invite-active-state">
          <view class="code-area">
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
          <view class="hint-box">
            <text class="material-icons-round" style="font-size: 16px; color: var(--amber);">schedule</text>
            <text class="hint-text">{{ activeHintText }}</text>
          </view>
        </view>

        <view v-else-if="hasExpired" class="invite-expired-state">
          <view class="invite-expired-state__icon">
            <text class="material-icons-round" style="font-size: 18px; color: var(--amber);">schedule</text>
          </view>
          <view class="invite-expired-state__body">
            <text class="invite-expired-state__title">上一个邀请码已过期</text>
            <text class="invite-expired-state__text">重新生成后可继续分享给家人或助手</text>
          </view>
        </view>

        <!-- 生成按钮 -->
        <BSubmitButton
          v-if="!hasActiveInvite"
          :loading="generating"
          :disabled="generating"
          @click="generate"
        >
          <text>{{ primaryButtonText }}</text>
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
import { computed, onUnmounted, ref } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { useAuth } from '@/composables/useAuth'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSubmitButton from '@/components/base/BSubmitButton.vue'

const { currentFamily, loadFamily } = useAuth()

const inviteCode = ref<string>('')
const inviteExpiresAt = ref<number | null>(null)
const nowTs = ref(Date.now())
const generating = ref(false)
let latestInviteSyncToken = 0
let countdownIntervalTimer: ReturnType<typeof setInterval> | null = null
let countdownAlignTimer: ReturnType<typeof setTimeout> | null = null

const { run: generateCode } = useCloudCall<{ data: { code: string; invite_expires?: number } }>('family-service', 'generateInviteLink', {
  successMode: 'silent',
})

const hasStoredInvite = computed(() => !!inviteCode.value && typeof inviteExpiresAt.value === 'number')
const hasExpired = computed(() => hasStoredInvite.value && (inviteExpiresAt.value as number) <= nowTs.value)
const hasActiveInvite = computed(() => hasStoredInvite.value && (inviteExpiresAt.value as number) > nowTs.value)
const primaryButtonText = computed(() => hasExpired.value ? '重新生成邀请码' : '生成邀请码')
const activeHintText = computed(() => {
  if (!hasActiveInvite.value) return '邀请码24小时内有效，过期需重新生成'
  return `邀请码${formatInviteRemaining(inviteExpiresAt.value, nowTs.value)}，过期需重新生成`
})

function updateNowTs() {
  nowTs.value = Date.now()
}

function normalizeInviteCode(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

function normalizeInviteExpires(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function syncInviteFromFamilyState() {
  inviteCode.value = normalizeInviteCode(currentFamily.value?.invite_code)
  inviteExpiresAt.value = normalizeInviteExpires(currentFamily.value?.invite_expires)
  updateNowTs()
}

function clearInviteState() {
  inviteCode.value = ''
  inviteExpiresAt.value = null
  updateNowTs()
}

function getNextInviteSyncToken() {
  latestInviteSyncToken += 1
  return latestInviteSyncToken
}

function clearCountdownTimer() {
  if (countdownIntervalTimer) {
    clearInterval(countdownIntervalTimer)
    countdownIntervalTimer = null
  }
  if (countdownAlignTimer) {
    clearTimeout(countdownAlignTimer)
    countdownAlignTimer = null
  }
}

function startCountdownTimer() {
  clearCountdownTimer()
  updateNowTs()
  const delay = 60000 - (Date.now() % 60000)
  countdownAlignTimer = setTimeout(() => {
    updateNowTs()
    countdownIntervalTimer = setInterval(() => {
      updateNowTs()
    }, 60000)
  }, delay)
}

function formatInviteRemaining(expiresAt: number | null, baseTs: number) {
  if (!expiresAt || expiresAt <= baseTs) return '已过期'
  const remainingMinutes = Math.ceil((expiresAt - baseTs) / 60000)
  if (remainingMinutes <= 1) return '不足1分钟'
  const hours = Math.floor(remainingMinutes / 60)
  const minutes = remainingMinutes % 60
  if (hours <= 0) return `还剩${minutes}分钟`
  if (minutes === 0) return `还剩${hours}小时`
  return `还剩${hours}小时${minutes}分钟`
}

async function refreshInviteState() {
  const syncToken = getNextInviteSyncToken()
  updateNowTs()
  const loadResult = await loadFamily()
  if (syncToken !== latestInviteSyncToken) return

  if (loadResult === 'loaded') {
    syncInviteFromFamilyState()
    return
  }

  if (loadResult === 'no_family') {
    clearInviteState()
  }
}

async function generate() {
  if (generating.value) return
  const syncToken = getNextInviteSyncToken()
  generating.value = true
  try {
    const res = await generateCode()
    if (syncToken !== latestInviteSyncToken) return

    if (res?.data?.code) {
      inviteCode.value = normalizeInviteCode(res.data.code)
      inviteExpiresAt.value = normalizeInviteExpires(res.data.invite_expires)
      updateNowTs()
      if (currentFamily.value) {
        currentFamily.value.invite_code = inviteCode.value
        currentFamily.value.invite_expires = inviteExpiresAt.value || undefined
      }
    }

    const loadResult = await loadFamily()
    if (syncToken !== latestInviteSyncToken) return
    if (loadResult === 'loaded') syncInviteFromFamilyState()
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

syncInviteFromFamilyState()

onShow(() => {
  syncInviteFromFamilyState()
  startCountdownTimer()
  void refreshInviteState()
})

onHide(() => {
  clearCountdownTimer()
})

onUnmounted(() => {
  clearCountdownTimer()
})
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

.invite-active-state {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.invite-expired-state {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px;
  border-radius: var(--radius-row);
  background: linear-gradient(180deg, rgba(255, 249, 240, 0.96) 0%, rgba(255, 255, 255, 0.98) 100%);
  border: 1px solid rgba(232, 155, 62, 0.16);
}

.invite-expired-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.invite-expired-state__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.invite-expired-state__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.3;
}

.invite-expired-state__text {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.4;
}

/* 邀请码 */
.code-area {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  padding: 20px 16px 16px;
  background: var(--card-dim);
  border-radius: var(--radius-row);
}

.code-text {
  font-size: 32px;
  font-weight: 800;
  font-family: var(--font-display);
  color: var(--primary);
  letter-spacing: 6px;
  text-align: center;
}

.code-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
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
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  margin: 16px 0 0;
  box-sizing: border-box;
  border: none;
  border-radius: var(--radius-row);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 250, 247, 0.98) 100%);
  box-shadow: none;
  outline: none;
  text-align: left;
  line-height: normal;
  min-height: 52px;
  position: relative;
  overflow: hidden;
  transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease, background 0.12s ease;
}

.regen-action::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid rgba(233, 83, 132, 0.12);
  border-radius: inherit;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    0 3px 10px rgba(233, 83, 132, 0.05);
  pointer-events: none;
}

.regen-action::after {
  display: none;
}

.regen-action > * {
  position: relative;
  z-index: 1;
}

.regen-action:active:not(:disabled) {
  transform: scale(0.985);
  box-shadow:
    0 2px 8px rgba(233, 83, 132, 0.08);
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
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.3;
}

.regen-action__subtitle {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.3;
}

.regen-action__arrow {
  font-size: 18px;
  color: rgba(233, 83, 132, 0.5);
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
