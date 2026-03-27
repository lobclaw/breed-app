<!--
  创建/加入家庭页 (A-4)
  新用户首次登录后引导创建犬舍
-->
<template>
  <view class="family-setup">
    <view class="family-setup__content">
      <!-- 品牌图标 -->
      <view class="family-setup__icon">
        <text class="material-icons-round" style="font-size: 48px; color: #FFFFFF;">pets</text>
      </view>

      <text class="family-setup__title">创建你的犬舍</text>
      <text class="family-setup__desc">为你的犬舍取一个名字，开始管理繁育事务</text>

      <!-- 输入框 -->
      <view class="family-setup__input-wrap">
        <input
          v-model="familyName"
          class="family-setup__input"
          placeholder="犬舍名称"
          maxlength="20"
        />
      </view>

      <!-- 邀请码（加入已有家庭） -->
      <view class="family-setup__divider">
        <view class="family-setup__divider-line" />
        <text class="family-setup__divider-text">或</text>
        <view class="family-setup__divider-line" />
      </view>

      <view class="family-setup__input-wrap">
        <input
          v-model="inviteCode"
          class="family-setup__input"
          placeholder="输入邀请码加入家庭"
          maxlength="10"
        />
      </view>

      <!-- 创建按钮 -->
      <BButton
        color="primary"
        size="large"
        :loading="creating"
        :disabled="!canSubmit"
        style="width: 100%; margin-top: 20px;"
        @click="create"
      >
        {{ inviteCode.trim() ? '加入家庭' : '创建家庭' }}
      </BButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '@/composables/useAuth'
import BButton from '@/components/base/BButton.vue'

const { createFamily } = useAuth()
const familyName = ref('')
const inviteCode = ref('')
const creating = ref(false)

const canSubmit = computed(() => familyName.value.trim() || inviteCode.value.trim())

async function create() {
  if (!canSubmit.value) return
  creating.value = true
  try {
    if (inviteCode.value.trim()) {
      // 加入已有家庭（后续实现 joinFamily）
      uni.showToast({ title: '加入功能开发中', icon: 'none' })
    } else {
      await createFamily(familyName.value.trim())
      uni.showToast({ title: '创建成功', icon: 'success' })
      setTimeout(() => {
        uni.reLaunch({ url: '/pages/home/index' })
      }, 1000)
    }
  } catch (e: any) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' })
  } finally {
    creating.value = false
  }
}
</script>

<style lang="scss" scoped>
.family-setup {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 40px;
}

.family-setup__content {
  width: 100%;
  text-align: center;
}

.family-setup__icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
}

.family-setup__title {
  display: block;
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: var(--text-1);
  margin-bottom: 8px;
}

.family-setup__desc {
  display: block;
  font-size: 14px;
  color: var(--text-2);
  margin-bottom: 32px;
  line-height: 1.5;
}

.family-setup__input-wrap {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  border: 1.5px solid var(--text-4);
}

.family-setup__input {
  font-size: 16px;
  text-align: center;
  color: var(--text-1);
}

.family-setup__divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 20px 0;
}

.family-setup__divider-line {
  flex: 1;
  height: 1px;
  background: var(--text-4);
}

.family-setup__divider-text {
  font-size: 13px;
  color: var(--text-3);
}
</style>
