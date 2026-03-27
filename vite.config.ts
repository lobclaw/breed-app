import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  server: {
    port: 5200,
  },
  css: {
    preprocessorOptions: {
      scss: {
        // uni_modules 第三方插件使用旧版 sass API，抑制弃用警告
        silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin'],
      },
    },
  },
});
