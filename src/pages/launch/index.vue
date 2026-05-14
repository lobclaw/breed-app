<template>
  <view class="launch-page">
    <view class="launch-page__mark">
      <text class="material-icons-round launch-page__icon">pets</text>
    </view>
    <text class="launch-page__title">繁育管理</text>
    <text class="launch-page__status">{{ statusText }}</text>
    <view v-if="errorText" class="launch-page__retry">
      <text class="launch-page__error">{{ errorText }}</text>
      <BButton
        color="primary"
        size="medium"
        :loading="checking"
        :disabled="checking"
        @click="decideRoute"
      >
        重试
      </BButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow, onUnload } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import BButton from '@/components/base/BButton.vue'

const { init, isLoggedIn, hasFamily, loadFamily } = useAuth()

const statusText = ref('正在确认登录状态')
const errorText = ref('')
const checking = ref(false)
let pageAlive = true

function reLaunch(url: string) {
  if (!pageAlive) return
  uni.reLaunch({ url })
}

async function decideRoute() {
  if (checking.value) return
  checking.value = true
  errorText.value = ''
  try {
    statusText.value = '正在确认登录状态'
    await init()
    if (!pageAlive) return

    if (!isLoggedIn.value) {
      reLaunch('/uni_modules/uni-id-pages/pages/login/login-withoutpwd')
      return
    }

    statusText.value = '正在确认犬舍信息'
    const loadResult = await loadFamily()
    if (!pageAlive) return

    if (loadResult === 'loaded' && hasFamily.value) {
      reLaunch('/pages/home/index')
      return
    }

    if (loadResult === 'no_family') {
      reLaunch('/pages/family/setup')
      return
    }

    errorText.value = '网络异常，请稍后重试'
  } catch (e: any) {
    errorText.value = e?.message || '网络异常，请稍后重试'
  } finally {
    if (pageAlive) checking.value = false
  }
}

onShow(() => {
  pageAlive = true
  void decideRoute()
})

onUnload(() => {
  pageAlive = false
})
</script>

<style lang="scss" scoped>
.launch-page {
  min-height: 100vh;
  padding: 40px;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.launch-page__mark {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-float);
  margin-bottom: 20px;
}

.launch-page__icon {
  font-size: 42px;
  color: #fff;
}

.launch-page__title {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 800;
  color: var(--text-1);
}

.launch-page__status {
  margin-top: 10px;
  font-size: 14px;
  color: var(--text-2);
}

.launch-page__retry {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.launch-page__error {
  font-size: 13px;
  color: var(--red);
}
</style>
