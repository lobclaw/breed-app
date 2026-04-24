<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
// @ts-ignore
import uniIdPageInit from '@/uni_modules/uni-id-pages/init.js';
import { useAuth } from '@/composables/useAuth';
import { useTheme } from '@/composables/useTheme';
import { localSyncRuntime } from '@/localdb/runtime';

onLaunch(async () => {
  // 初始化主题（暗色模式）
  const { initTheme } = useTheme();
  initTheme();
  // 初始化 uni-id-pages（检查登录方式配置、绑定事件）
  uniIdPageInit();
  // 初始化认证状态（恢复登录、监听事件）
  const { init } = useAuth();
  await init();
  await localSyncRuntime.init();
});
onShow(() => {
  console.log("App Show");
  const { currentFamily } = useAuth();
  const familyId = currentFamily.value?._id || '';
  if (familyId) {
    void localSyncRuntime.resume(familyId);
  }
});
onHide(() => {
  console.log("App Hide");
});
</script>
<style lang="scss">
@import '@/styles/tokens.scss';
@import '@/styles/fonts.scss';
@import '@/styles/common.scss';

/* 全局基础样式 */
*, *::before, *::after {
  box-sizing: border-box;
}

page {
  background-color: var(--bg);
  color: var(--text-1);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

/* 隐藏原生 tabBar，使用自定义 BNavBar */
uni-tabbar, .uni-tabbar {
  display: none !important;
}
</style>
