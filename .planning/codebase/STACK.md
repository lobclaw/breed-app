# Technology Stack

**Analysis Date:** 2026-04-15

## Languages

**Primary:**
- TypeScript - 前端业务代码、组合式函数、Pinia store、类型定义；入口和核心路径包括 `src/main.ts`, `src/composables/useCloudCall.ts`, `src/composables/useAuth.ts`, `src/stores/taskStore.ts`, `src/types/index.ts`。
- Vue Single File Components - UniApp 页面和组件使用 Vue 3 SFC；页面集中在 `src/pages/`, 组件集中在 `src/components/`, 全局入口为 `src/App.vue`。
- JavaScript - UniCloud 云对象和 DCloud 插件云函数使用 CommonJS JavaScript；业务云对象位于 `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/family-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/finance-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`。

**Secondary:**
- SCSS - 全局 tokens、字体、公共样式由 `src/App.vue` 导入，源文件包括 `src/styles/tokens.scss`, `src/styles/fonts.scss`, `src/styles/common.scss`。
- JSON / JSONC - UniApp manifest、路由、数据库 schema、云函数包配置使用 JSON；关键文件包括 `src/manifest.json`, `src/pages.json`, `uniCloud-alipay/database/*.schema.json`, `uniCloud-alipay/cloudfunctions/*/package.json`。
- Markdown - 产品和技术设计文档位于 `docs/design/`, 当前技术选型依据集中在 `docs/design/03-tech-stack.md` 和 `docs/design/04-implementation.md`。

## Runtime

**Environment:**
- UniApp Vue 3 runtime - `src/manifest.json` 设置 `"vueVersion": "3"`，通过 `@dcloudio/vite-plugin-uni` 构建。
- Target platforms - `package.json` 提供 `dev:h5`, `dev:app`, `dev:mp-alipay`, `build:h5`, `build:app`, `build:mp-alipay`；`src/manifest.json` 配置 `app-plus`, `h5`, `mp-alipay`，并声明 `uniCloud.provider = "alipay"`。
- UniCloud cloud object runtime - 云端业务逻辑运行在 UniCloud 支付宝云对象中，目录为 `uniCloud-alipay/cloudfunctions/`；Node.js 版本未在 `package.json`, `.nvmrc`, `.node-version` 中固定。
- HBuilderX deployment runtime - 设计文档要求使用 HBuilderX 管理 UniCloud 部署和打包；依据为 `docs/design/03-tech-stack.md`。

**Package Manager:**
- pnpm - `pnpm-lock.yaml` 使用 lockfileVersion `9.0`，`pnpm-workspace.yaml` 存在并配置 `ignoredBuiltDependencies`。
- Lockfile: present - `pnpm-lock.yaml` 锁定实际解析版本，例如 `vue@3.5.31`, `typescript@4.9.5`, `vitest@1.6.1`。

## Frameworks

**Core:**
- UniApp `3.0.0-4080420251103001` - 跨端应用框架；核心包在 `package.json` 中包括 `@dcloudio/uni-app`, `@dcloudio/uni-app-plus`, `@dcloudio/uni-components`, `@dcloudio/uni-h5`, `@dcloudio/uni-mp-alipay`。
- Vue `^3.4.21` / resolved `3.5.31` - 前端组件框架；`src/main.ts` 使用 `createSSRApp(App)` 创建应用。
- Pinia `^2.1.7` / resolved `2.3.1` - 全局状态管理；`src/main.ts` 创建 Pinia 实例，store 示例包括 `src/stores/dogStore.ts`, `src/stores/protocolStore.ts`, `src/stores/taskStore.ts`。
- pinia-plugin-unistorage `^0.1.2` - Pinia 持久化到 UniApp storage；`src/main.ts` 通过 `pinia.use(createUnistorage())` 注册。
- UniCloud cloud objects - 业务服务以云对象组织，前端通过 `uniCloud.importObject` 调用；封装位置为 `src/composables/useCloudCall.ts`。

**Testing:**
- Vitest `^1.6.0` / resolved `1.6.1` - 测试运行器；配置文件为 `vitest.config.ts`。
- V8 coverage provider - `vitest.config.ts` 覆盖范围包含 `uniCloud-alipay/cloudfunctions/**/*.js` 和 `src/utils/**/*.ts`。
- @dcloudio/uni-automator `3.0.0-4080420251103001` - DCloud 自动化测试支持包；声明在 `package.json`。

**Build/Dev:**
- Vite `5.2.8` - 开发服务器和构建工具；配置文件为 `vite.config.ts`，开发端口固定为 `5200`。
- @dcloudio/vite-plugin-uni `3.0.0-4080420251103001` - UniApp Vite 插件；`vite.config.ts` 通过 `plugins: [uni()]` 启用。
- TypeScript `^4.9.4` / resolved `4.9.5` - 类型检查；`tsconfig.json` 继承 `@vue/tsconfig/tsconfig.json`。
- vue-tsc `^1.0.24` / resolved `1.8.27` - Vue 类型检查；脚本为 `pnpm type-check`，配置来自 `package.json`。
- Sass `^1.98.0` - SCSS 预处理；`vite.config.ts` 为 `scss` 配置 `silenceDeprecations`。

## Key Dependencies

**Critical:**
- `@dcloudio/uni-*` packages `3.0.0-4080420251103001` - 决定 UniApp 编译目标和平台能力；声明于 `package.json`。
- `vue` `^3.4.21` - 所有页面和组件的运行基础；入口为 `src/main.ts` 和 `src/App.vue`。
- `pinia` `^2.1.7` - 跨页面状态基础；入口注册在 `src/main.ts`，具体 store 在 `src/stores/`。
- `pinia-plugin-unistorage` `^0.1.2` - storage 持久化基础；注册在 `src/main.ts`。
- `uni-id-pages` `1.1.27` - 登录、注册、用户资料页面插件；插件包在 `src/uni_modules/uni-id-pages/package.json`，路由接入在 `src/pages.json`。
- `uni-id-common` `1.0.19` - 云端 token 校验和刷新；前端插件在 `src/uni_modules/uni-id-common/package.json`，云端公共模块在 `uniCloud-alipay/cloudfunctions/common/uni-id-common/package.json`。
- `breed-auth` `1.0.0` - 项目自定义云端鉴权公共模块；实现位于 `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`，被业务云对象 package 通过 `file:../common/breed-auth` 依赖。

**Infrastructure:**
- `uni-config-center` `0.0.3` - UniCloud 插件配置中心；前端插件在 `src/uni_modules/uni-config-center/package.json`，云端公共模块在 `uniCloud-alipay/cloudfunctions/common/uni-config-center/package.json`。
- `uni-captcha` / `uni-captcha-co` - 图形验证码能力；前端插件在 `src/uni_modules/uni-captcha/package.json`，云对象在 `uniCloud-alipay/cloudfunctions/uni-captcha-co/package.json`。
- `uni-open-bridge-common` `1.2.1` plugin metadata / cloud common `1.0.0` - 第三方平台凭据管理；插件在 `src/uni_modules/uni-open-bridge-common/package.json`，云端公共模块在 `uniCloud-alipay/cloudfunctions/common/uni-open-bridge-common/package.json`。
- `uni-cloud-s2s` `1.0.1` - DCloud server-to-server common module；云端公共模块在 `uniCloud-alipay/cloudfunctions/common/uni-cloud-s2s/package.json`。
- `uni-ui` modules - 基础 UI 插件包括 `src/uni_modules/uni-icons/package.json`, `src/uni_modules/uni-popup/package.json`, `src/uni_modules/uni-forms/package.json`, `src/uni_modules/uni-easyinput/package.json`, `src/uni_modules/uni-scss/package.json`, `src/uni_modules/uni-transition/package.json`。

## Configuration

**Environment:**
- No `.env*` files detected at repo depth 3; do not add runtime secrets to source files.
- UniCloud provider is configured in `src/manifest.json` as `"provider": "alipay"` under `uniCloud`.
- DCloud app identity is configured in `src/manifest.json` with `"appid": "__UNI__571E902"` and app version metadata.
- Auth routing is configured in `src/pages.json` under `uniIdRouter`, with login page `uni_modules/uni-id-pages/pages/login/login-withpwd` and protected route patterns for `pages/home/.*`, `pages/dog/.*`, `pages/finance/.*`, `pages/profile/.*`, `pages/breeding/.*`, `pages/record/.*`, `pages/sale/.*`, `pages/family/.*`, `pages/health/.*`.
- UniCloud config-center files exist at `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.json`, `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-ad/config.json`, `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-open-bridge/config.json`; treat these as sensitive configuration and do not quote values.

**Build:**
- Vite config: `vite.config.ts` uses `@dcloudio/vite-plugin-uni`, server port `5200`, and Sass deprecation silencing for Uni modules.
- TypeScript config: `tsconfig.json` sets `baseUrl: "."`, alias `"@/*": ["./src/*"]`, libs `esnext` and `dom`, types `@dcloudio/types`, and excludes `src/uni_modules/**`.
- Test config: `vitest.config.ts` uses Node environment, `tests/**/*.test.ts`, globals, V8 coverage, and alias `@` to `src`.
- App manifest: `src/manifest.json` configures App permissions, H5 proxy `/api -> https://api.next.bspapp.com`, mp-alipay component usage, and disabled `uniStatistics`.
- Pages config: `src/pages.json` lists application pages, uni-id-pages plugin routes, global style, and tabBar icon paths under `src/static/tab/`.

## Platform Requirements

**Development:**
- Use pnpm for dependency install and scripts because `pnpm-lock.yaml` is the committed lockfile and `package.json` scripts assume package-managed CLIs.
- Use HBuilderX for UniCloud deployment, app cloud packaging, and platform-specific debugging per `docs/design/03-tech-stack.md`.
- Use Vite dev server for H5 with `pnpm dev:h5`; local dev port is `5200` from `vite.config.ts`.
- Use `pnpm type-check` for Vue/TypeScript validation and `pnpm test` / `pnpm test:coverage` for Vitest from `package.json`.

**Production:**
- Primary backend target is UniCloud on Alipay cloud; cloud root is `uniCloud-alipay/` and provider is declared in `src/manifest.json`.
- Supported build targets are H5, App, and Alipay Mini Program through scripts in `package.json`.
- Database schemas are committed under `uniCloud-alipay/database/` and must be deployed through UniCloud/HBuilderX alongside cloud objects in `uniCloud-alipay/cloudfunctions/`.
- Static assets are bundled from `src/static/`, including tab icons and fonts at `src/static/tab/` and `src/static/fonts/`.

---

*Stack analysis: 2026-04-15*
