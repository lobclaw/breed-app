<!--
  BNavBar — 底部导航栏
  设计稿：home-v1-final.html .bottom-nav
  5 栏：首页、档案、FAB(+)、财务、我的
  中间 FAB 上浮 -10px，渐变粉橙 + 阴影
-->
<template>
  <view class="b-nav">
    <!-- 首页 -->
    <view class="b-nav__item" :class="{ 'b-nav__item--active': current === 'home' }" @click="switchTab('home')">
      <text class="b-nav__icon material-icons-round">home</text>
      <text class="b-nav__label">首页</text>
    </view>

    <!-- 档案 -->
    <view class="b-nav__item" :class="{ 'b-nav__item--active': current === 'dog' }" @click="switchTab('dog')">
      <text class="b-nav__icon material-icons-round">pets</text>
      <text class="b-nav__label">档案</text>
    </view>

    <!-- FAB 中央按钮 -->
    <view class="b-nav__fab" @click="$emit('fab-click')">
      <text class="b-nav__fab-icon material-icons-round">add</text>
    </view>

    <!-- 财务 -->
    <view class="b-nav__item" :class="{ 'b-nav__item--active': current === 'finance' }" @click="switchTab('finance')">
      <text class="b-nav__icon material-icons-round">receipt_long</text>
      <text class="b-nav__label">财务</text>
    </view>

    <!-- 我的 -->
    <view class="b-nav__item" :class="{ 'b-nav__item--active': current === 'profile' }" @click="switchTab('profile')">
      <text class="b-nav__icon material-icons-round">person</text>
      <text class="b-nav__label">我的</text>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  /** 当前激活的 tab：home / dog / finance / profile */
  current: string
}>()

defineEmits<{ 'fab-click': [] }>()

const TAB_MAP: Record<string, string> = {
  home: '/pages/home/index',
  dog: '/pages/dog/list',
  finance: '/pages/finance/index',
  profile: '/pages/profile/index',
}

function switchTab(tab: string) {
  uni.switchTab({ url: TAB_MAP[tab] })
}
</script>

<style lang="scss" scoped>
.b-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 84px;
  /* 去掉毛玻璃，用纯白底 */
  background: var(--card);
  border-top: 0.5px solid var(--nav-border);
  display: flex;
  align-items: flex-start;
  justify-content: space-around;
  padding-top: 8px;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  z-index: 100;
}

/* 普通 tab 项 */
.b-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 50px;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.85); }
}
.b-nav__icon {
  font-family: 'Material Icons Round';
  font-size: 24px;
  color: var(--text-3);
}
.b-nav__label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-3);
}
.b-nav__item--active {
  .b-nav__icon { color: var(--primary); }
  .b-nav__label { color: var(--primary); }
}

/* 中央 FAB 按钮 */
.b-nav__fab {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: -10px; /* 上浮效果 */
  box-shadow: 0 4px 16px rgba(234, 62, 119, 0.3);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:active {
    transform: scale(0.88);
    box-shadow: 0 2px 8px rgba(234, 62, 119, 0.2);
  }
}
.b-nav__fab-icon {
  font-family: 'Material Icons Round';
  font-size: 28px;
  color: #FFFFFF;
}
</style>
