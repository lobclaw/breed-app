<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
// @ts-ignore
import uniIdPageInit from '@/uni_modules/uni-id-pages/init.js';
import { useAuth } from '@/composables/useAuth';

onLaunch(async () => {
  console.log("App Launch");
  // 初始化 uni-id-pages（检查登录方式配置、绑定事件）
  uniIdPageInit();
  // 初始化认证状态（恢复登录、监听事件）
  const { init } = useAuth();
  await init();
});
onShow(() => {
  console.log("App Show");
});
onHide(() => {
  console.log("App Hide");
});
</script>
<style></style>
