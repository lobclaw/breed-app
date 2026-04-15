# 宠物繁育管理 APP

## 项目概述

个人使用的犬类繁育管理工具，管理 30-50 只马尔济斯犬。使用 Codex / Claude Code 进行 AI 辅助开发。

## 设计文档

所有已确认的设计文档位于 `docs/design/`：
- `01-data-model.md` — 产品概述 + 完整数据模型 + 财务/销售/收入模块 + 统计报表
- `02-features.md` — 首页设计 + 提醒系统 + 状态系统 + 协作权限 + 导航结构 + 决策日志
- `03-tech-stack.md` — 技术选型 + 费用估算 + 图片上传规范
- `04-implementation.md` — Phase 1 实现计划（后端云对象 + 前端 UI 组件库 + 页面还原）
- `05-field-page-mapping.md` — 字段-页面映射 + 实现审计结果
- `archive/06-unicloud-validation.md` — UniCloud 技术验证报告（已归档）
- `archive/07-design-audit.md` — 设计审查报告（已归档，所有问题已修复）

## 技术栈

- 前端：UniApp（Vue 3 + TypeScript + Pinia）
- 后端：UniCloud 云对象（支付宝云）
- 数据库：UniCloud MongoDB（14 个集合）
- 推送：UniPush 2.0 / 认证：uni-id / 存储：UniCloud 云存储
- IDE：HBuilderX + Codex / Claude Code

## 当前阶段

Phase 1 功能 + 性能优化完成，进入验收测试阶段。

## GSD 项目状态

- GSD 已初始化，项目上下文位于 `.planning/PROJECT.md`。
- 当前 GSD 里程碑：`首页工作台密度自适应优化`，路线图位于 `.planning/ROADMAP.md`。
- 当前焦点：Phase 1 `Workbench Contract & Test Foundation`，下一步使用 `$gsd-plan-phase 1`。
- 当前路线固定为 6 阶段：契约/测试底座 → 繁育步骤工作台 → 健康批量优先工作台 → 用药状态工作台 → 逾期/计数/防闪回校准 → 今日重点。
- 需求与覆盖关系位于 `.planning/REQUIREMENTS.md`，研究结论位于 `.planning/research/SUMMARY.md`。

## 开发约定

- 代码：变量名/函数名用英文，注释用中文。文档用中文。
- 所有日期使用 timestamp 毫秒数（Number）存储，时区统一北京时间（UTC+8）
- 数据模型变更需先更新设计文档再写代码
- 提交信息使用 conventional commits 格式
- 简单读取走 clientDB/JQL，涉及多集合写入的操作走云对象
- 支持软删除的集合使用 deleted_at 字段（见 01 文档软删除范围矩阵）
- 统计值实时查询计算，不预存（当前规模不需要优化）

### 样式约定

- **common.scss 全局导入**：所有公共样式（输入框、字段组、固定底部按钮、信息行等）定义在 `src/styles/common.scss`，通过 `App.vue` 全局导入。页面 scoped style 仅写差异部分，禁止重复定义。
- **BFormOptions 组件**：健康记录表单继续使用 `BFormOptions`，封装"标记为待办"开关 + 日期选择（今天/明天/后天 chips）+ 提醒开关。疫苗/驱虫页当前使用显式文案「创建下次待办」，默认关闭。繁育表单不再复用 `BFormOptions`，统一改用繁育专用的 `BExtraArrangementSection`。
- **记录表单提交反馈**：创建待办/保存记录默认采用“局部 loading + 弱成功反馈”方案，不再优先使用全屏 `showLoading(mask)` + 成功 toast。提交中由底部按钮承接状态，成功后短暂停留即返回，来源页再用轻量 banner/弱提示承接结果。
- **提交按钮三态**：记录表单提交按钮统一支持 `默认 / 提交中 / 成功瞬态` 三态；成功态仅短暂展示，用于降低“点了没反应”的不确定感，不额外叠加强成功 toast。
- **Pill 选择器 vs 分段控件**：表单中的互斥选项（如生产方式、驱虫类型）使用 pill-select 样式（card-dim 背景、无边框、胶囊圆角）；Segmented Control 仅用于视图/标签页切换（如"疫苗/驱虫/疾病" tab）。
- **滚动锁定**：BSheet、BModal、BDeleteConfirm 打开时锁定页面滚动。
- **box-sizing**：全局设置 `box-sizing: border-box`（App.vue）。

## V1 已知限制

- **单家庭模式**：V1 假设一个用户只属于一个家庭。云对象 `_before` 拦截器基于此假设直接从用户信息注入 `familyId`。未来支持多家庭需重构 auth 拦截器。
- **在线优先**：V1 不支持离线操作和冲突解决。需联网使用。

## 重要设计原则

- **先记录，后自动化**：V1 核心是帮用户记录信息，自动化逻辑分阶段添加
- **以注意力单元组织首页**：不是纯犬优先也不是纯事件优先，匹配繁育者实际思维
- **状态语言优于日期语言**：显示「孕期第58天」而非「3月26日」
- **YAGNI**：只做当前确认的需求，不提前设计未讨论的功能

## 用药任务模块

### 重复用药检测（`src/pages/record/health-medication.vue`）

- **同药名视为唯一**：同一犬只同一药名只允许一个进行中任务，不支持并存（剂量相同无重复创建必要）
- **弹窗分两段**：「将创建（N只）」无重复犬 + 「已有同名任务（M只）」可勾选覆盖，默认不勾选
- **覆盖 = 取消旧任务 + 创建新任务**：云函数 `batchStartMedication` 接受可选 `override_dog_ids`，先将该犬同名进行中任务设为 `已取消`，再创建新任务
- **提交只创建最终犬只**：`finalDogIds = cleanDogIds + overrideDogIds`，未勾选的重复犬直接跳过
- **全选按钮**：弹窗「已有同名任务」区块右侧有「全选/取消全选」，同样在 `BDogPicker` 多选模式下提供全选

### 云函数常量规范

- 云函数内**禁止使用未定义常量**（如曾出现的 `DAY_MS is not defined` bug）
- 毫秒常量统一写字面量 `86400000`，不定义全局 `DAY_MS`

## 首页日历红点（WeekStrip）

### 数据流

- `dayCounts` 由 `getDateCounts` 聚合返回，**包含**普通 pending tasks，也包含未来日期仅有疗程状态时的红点兜底
- `loadAll()` 并行执行 `loadTodayCards()` + `loadDateCounts()` + `loadWeekCache()`，存在时序竞争

### 红点同步规则

- **必须在 `Promise.all` 之后**写 `dayCounts[todayTs]`，不能在子函数内写（会被后完成的 `loadDateCounts` 覆盖）
- **以实际可见卡片数为准**：`cards.value.length === 0` → 强制 0；cards 非空且服务端返回 0 → 补 1
- **不依赖 `counts.today`**：该字段含「用药卡计 1」逻辑，即使今日剂量全给完也可能为 1，不能作为红点依据
- **乐观更新**：卡片被 `removeCardLocally` 移除时，同步 `dayCounts[startOfDay(Date.now())] = counts.today`
- **未来日期一致性**：如果某天只有 `medication_tasks` 形成的“今日用药”卡，也应该有红点；不能出现“无红点但点进去有卡”

### `counts.today` 计算说明（后端）

```
counts.today = pendingTasks.length - oldMedCount + (hasHealthCard ? 1 : 0)
```
只要有进行中用药任务（`activeMedications.length > 0`），即使今日剂量全给完，`counts.today` 仍为 1。
**这是已知行为，不是 bug**；红点不应依赖此值。

## BDogPicker 组件（`src/components/form/BDogPicker.vue`）

- **多选模式全选**：筛选栏右侧显示「全选/取消全选」，作用于当前 `filteredDogs`（按筛选 tab 过滤后的结果），不影响其他 tab 下已选犬只
- `isAllSelected` 基于 `filteredDogs` 判断，支持局部全选（如只全选「种母」tab）

## BSheet 组件（`src/components/layout/BSheet.vue`）

- 滚动条隐藏：`scrollbar-width: none` + `&::-webkit-scrollbar { display: none }` + `:deep(::-webkit-scrollbar) { display: none }`
- 内部列表横向滚动条同样隐藏

## gstack

gstack 技能和路由规则见 `~/CLAUDE.md`（全局配置，避免重复）。

如果 gstack 技能不起作用：`cd .claude/skills/gstack && ./setup`

<!-- GSD:project-start source:PROJECT.md -->
## Project

**宠物繁育管理 APP**

这是一个个人使用的犬类繁育管理工具，服务于 30-50 只马尔济斯犬的日常管理、繁育流程、健康提醒、用药疗程、财务销售和家庭协作。项目已经是一个运行中的 UniApp + UniCloud brownfield 应用，当前 GSD 初始化的重点不是从零建设，而是把后续迭代纳入可持续规划。

当前最重要的产品方向是把首页从“卡片直出列表”升级为更适合大数量犬群的工作台：保留 `逾期 / 繁育 / 健康 / 用药` 四层语义，同时在区块内部按数量和业务性质自适应展示。

**Core Value:** 让繁育者每天打开首页时，能快速知道最该处理什么，并且处理动作会可靠地回写到真实记录。

### Constraints

- **Tech stack**: 继续使用 UniApp Vue 3 + TypeScript + Pinia + UniCloud 支付宝云对象 — 已有代码、部署和文档都基于该栈。
- **Data scope**: V1 面向单家庭、30-50 只犬 — 不提前扩展为多家庭、多租户 SaaS 或普通养宠用户模式。
- **Date handling**: 所有业务日期使用 timestamp 毫秒数，显示与判断按北京时间 UTC+8 — 避免逾期天数和红点错位。
- **Homepage contract**: 首页固定四层 `逾期 / 繁育 / 健康 / 用药` — 不恢复统一待办池，不把疾病观察伪装成用药。
- **Health reminders**: 疫苗/驱虫默认只建议，不静默续链 — 只有用户显式创建才生成下次待办。
- **Breeding workflow**: 主流程由记录驱动自动推进，额外安排只是手动附加事项 — 完成额外安排不得改变状态机。
- **Medication source**: 用药疗程以 `medication_tasks` 为事实源 — 不再依赖旧 `tasks(type='medication')` 作为主数据。
- **Implementation safety**: 修改首页时必须保留 latest token、suppression、局部承接、批量卡元数据同步和 WeekStrip 红点同步规则 — 这些是防闪回和防错计数的关键保护。
- **Documentation**: 数据模型变更先更新设计文档；代码变更后重建 graphify — 保持后续会话可接续。
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript - 前端业务代码、组合式函数、Pinia store、类型定义；入口和核心路径包括 `src/main.ts`, `src/composables/useCloudCall.ts`, `src/composables/useAuth.ts`, `src/stores/taskStore.ts`, `src/types/index.ts`。
- Vue Single File Components - UniApp 页面和组件使用 Vue 3 SFC；页面集中在 `src/pages/`, 组件集中在 `src/components/`, 全局入口为 `src/App.vue`。
- JavaScript - UniCloud 云对象和 DCloud 插件云函数使用 CommonJS JavaScript；业务云对象位于 `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/family-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/finance-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`。
- SCSS - 全局 tokens、字体、公共样式由 `src/App.vue` 导入，源文件包括 `src/styles/tokens.scss`, `src/styles/fonts.scss`, `src/styles/common.scss`。
- JSON / JSONC - UniApp manifest、路由、数据库 schema、云函数包配置使用 JSON；关键文件包括 `src/manifest.json`, `src/pages.json`, `uniCloud-alipay/database/*.schema.json`, `uniCloud-alipay/cloudfunctions/*/package.json`。
- Markdown - 产品和技术设计文档位于 `docs/design/`, 当前技术选型依据集中在 `docs/design/03-tech-stack.md` 和 `docs/design/04-implementation.md`。
## Runtime
- UniApp Vue 3 runtime - `src/manifest.json` 设置 `"vueVersion": "3"`，通过 `@dcloudio/vite-plugin-uni` 构建。
- Target platforms - `package.json` 提供 `dev:h5`, `dev:app`, `dev:mp-alipay`, `build:h5`, `build:app`, `build:mp-alipay`；`src/manifest.json` 配置 `app-plus`, `h5`, `mp-alipay`，并声明 `uniCloud.provider = "alipay"`。
- UniCloud cloud object runtime - 云端业务逻辑运行在 UniCloud 支付宝云对象中，目录为 `uniCloud-alipay/cloudfunctions/`；Node.js 版本未在 `package.json`, `.nvmrc`, `.node-version` 中固定。
- HBuilderX deployment runtime - 设计文档要求使用 HBuilderX 管理 UniCloud 部署和打包；依据为 `docs/design/03-tech-stack.md`。
- pnpm - `pnpm-lock.yaml` 使用 lockfileVersion `9.0`，`pnpm-workspace.yaml` 存在并配置 `ignoredBuiltDependencies`。
- Lockfile: present - `pnpm-lock.yaml` 锁定实际解析版本，例如 `vue@3.5.31`, `typescript@4.9.5`, `vitest@1.6.1`。
## Frameworks
- UniApp `3.0.0-4080420251103001` - 跨端应用框架；核心包在 `package.json` 中包括 `@dcloudio/uni-app`, `@dcloudio/uni-app-plus`, `@dcloudio/uni-components`, `@dcloudio/uni-h5`, `@dcloudio/uni-mp-alipay`。
- Vue `^3.4.21` / resolved `3.5.31` - 前端组件框架；`src/main.ts` 使用 `createSSRApp(App)` 创建应用。
- Pinia `^2.1.7` / resolved `2.3.1` - 全局状态管理；`src/main.ts` 创建 Pinia 实例，store 示例包括 `src/stores/dogStore.ts`, `src/stores/protocolStore.ts`, `src/stores/taskStore.ts`。
- pinia-plugin-unistorage `^0.1.2` - Pinia 持久化到 UniApp storage；`src/main.ts` 通过 `pinia.use(createUnistorage())` 注册。
- UniCloud cloud objects - 业务服务以云对象组织，前端通过 `uniCloud.importObject` 调用；封装位置为 `src/composables/useCloudCall.ts`。
- Vitest `^1.6.0` / resolved `1.6.1` - 测试运行器；配置文件为 `vitest.config.ts`。
- V8 coverage provider - `vitest.config.ts` 覆盖范围包含 `uniCloud-alipay/cloudfunctions/**/*.js` 和 `src/utils/**/*.ts`。
- @dcloudio/uni-automator `3.0.0-4080420251103001` - DCloud 自动化测试支持包；声明在 `package.json`。
- Vite `5.2.8` - 开发服务器和构建工具；配置文件为 `vite.config.ts`，开发端口固定为 `5200`。
- @dcloudio/vite-plugin-uni `3.0.0-4080420251103001` - UniApp Vite 插件；`vite.config.ts` 通过 `plugins: [uni()]` 启用。
- TypeScript `^4.9.4` / resolved `4.9.5` - 类型检查；`tsconfig.json` 继承 `@vue/tsconfig/tsconfig.json`。
- vue-tsc `^1.0.24` / resolved `1.8.27` - Vue 类型检查；脚本为 `pnpm type-check`，配置来自 `package.json`。
- Sass `^1.98.0` - SCSS 预处理；`vite.config.ts` 为 `scss` 配置 `silenceDeprecations`。
## Key Dependencies
- `@dcloudio/uni-*` packages `3.0.0-4080420251103001` - 决定 UniApp 编译目标和平台能力；声明于 `package.json`。
- `vue` `^3.4.21` - 所有页面和组件的运行基础；入口为 `src/main.ts` 和 `src/App.vue`。
- `pinia` `^2.1.7` - 跨页面状态基础；入口注册在 `src/main.ts`，具体 store 在 `src/stores/`。
- `pinia-plugin-unistorage` `^0.1.2` - storage 持久化基础；注册在 `src/main.ts`。
- `uni-id-pages` `1.1.27` - 登录、注册、用户资料页面插件；插件包在 `src/uni_modules/uni-id-pages/package.json`，路由接入在 `src/pages.json`。
- `uni-id-common` `1.0.19` - 云端 token 校验和刷新；前端插件在 `src/uni_modules/uni-id-common/package.json`，云端公共模块在 `uniCloud-alipay/cloudfunctions/common/uni-id-common/package.json`。
- `breed-auth` `1.0.0` - 项目自定义云端鉴权公共模块；实现位于 `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`，被业务云对象 package 通过 `file:../common/breed-auth` 依赖。
- `uni-config-center` `0.0.3` - UniCloud 插件配置中心；前端插件在 `src/uni_modules/uni-config-center/package.json`，云端公共模块在 `uniCloud-alipay/cloudfunctions/common/uni-config-center/package.json`。
- `uni-captcha` / `uni-captcha-co` - 图形验证码能力；前端插件在 `src/uni_modules/uni-captcha/package.json`，云对象在 `uniCloud-alipay/cloudfunctions/uni-captcha-co/package.json`。
- `uni-open-bridge-common` `1.2.1` plugin metadata / cloud common `1.0.0` - 第三方平台凭据管理；插件在 `src/uni_modules/uni-open-bridge-common/package.json`，云端公共模块在 `uniCloud-alipay/cloudfunctions/common/uni-open-bridge-common/package.json`。
- `uni-cloud-s2s` `1.0.1` - DCloud server-to-server common module；云端公共模块在 `uniCloud-alipay/cloudfunctions/common/uni-cloud-s2s/package.json`。
- `uni-ui` modules - 基础 UI 插件包括 `src/uni_modules/uni-icons/package.json`, `src/uni_modules/uni-popup/package.json`, `src/uni_modules/uni-forms/package.json`, `src/uni_modules/uni-easyinput/package.json`, `src/uni_modules/uni-scss/package.json`, `src/uni_modules/uni-transition/package.json`。
## Configuration
- No `.env*` files detected at repo depth 3; do not add runtime secrets to source files.
- UniCloud provider is configured in `src/manifest.json` as `"provider": "alipay"` under `uniCloud`.
- DCloud app identity is configured in `src/manifest.json` with `"appid": "__UNI__571E902"` and app version metadata.
- Auth routing is configured in `src/pages.json` under `uniIdRouter`, with login page `uni_modules/uni-id-pages/pages/login/login-withpwd` and protected route patterns for `pages/home/.*`, `pages/dog/.*`, `pages/finance/.*`, `pages/profile/.*`, `pages/breeding/.*`, `pages/record/.*`, `pages/sale/.*`, `pages/family/.*`, `pages/health/.*`.
- UniCloud config-center files exist at `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.json`, `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-ad/config.json`, `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-open-bridge/config.json`; treat these as sensitive configuration and do not quote values.
- Vite config: `vite.config.ts` uses `@dcloudio/vite-plugin-uni`, server port `5200`, and Sass deprecation silencing for Uni modules.
- TypeScript config: `tsconfig.json` sets `baseUrl: "."`, alias `"@/*": ["./src/*"]`, libs `esnext` and `dom`, types `@dcloudio/types`, and excludes `src/uni_modules/**`.
- Test config: `vitest.config.ts` uses Node environment, `tests/**/*.test.ts`, globals, V8 coverage, and alias `@` to `src`.
- App manifest: `src/manifest.json` configures App permissions, H5 proxy `/api -> https://api.next.bspapp.com`, mp-alipay component usage, and disabled `uniStatistics`.
- Pages config: `src/pages.json` lists application pages, uni-id-pages plugin routes, global style, and tabBar icon paths under `src/static/tab/`.
## Platform Requirements
- Use pnpm for dependency install and scripts because `pnpm-lock.yaml` is the committed lockfile and `package.json` scripts assume package-managed CLIs.
- Use HBuilderX for UniCloud deployment, app cloud packaging, and platform-specific debugging per `docs/design/03-tech-stack.md`.
- Use Vite dev server for H5 with `pnpm dev:h5`; local dev port is `5200` from `vite.config.ts`.
- Use `pnpm type-check` for Vue/TypeScript validation and `pnpm test` / `pnpm test:coverage` for Vitest from `package.json`.
- Primary backend target is UniCloud on Alipay cloud; cloud root is `uniCloud-alipay/` and provider is declared in `src/manifest.json`.
- Supported build targets are H5, App, and Alipay Mini Program through scripts in `package.json`.
- Database schemas are committed under `uniCloud-alipay/database/` and must be deployed through UniCloud/HBuilderX alongside cloud objects in `uniCloud-alipay/cloudfunctions/`.
- Static assets are bundled from `src/static/`, including tab icons and fonts at `src/static/tab/` and `src/static/fonts/`.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- 页面文件使用 kebab-case 或业务名短横线：`src/pages/record/health-vaccination.vue`、`src/pages/record/breeding-heat.vue`、`src/pages/finance/litter-profit.vue`。
- 基础组件和业务组件使用 PascalCase，并按职责分目录：`src/components/base/BButton.vue`、`src/components/form/BDogPicker.vue`、`src/components/layout/BSheet.vue`、`src/components/smart-card/SmartCard.vue`。
- composable 使用 `useXxx.ts`：`src/composables/useCloudCall.ts`、`src/composables/useSubmitFeedback.ts`、`src/composables/useAuth.ts`。
- Pinia store 使用领域名 + `Store.ts`：`src/stores/dogStore.ts`、`src/stores/taskStore.ts`、`src/stores/protocolStore.ts`。
- 类型文件按领域拆分：`src/types/health.ts`、`src/types/task.ts`、`src/types/breeding.ts`、`src/types/finance.ts`。
- 云对象入口固定为 `index.obj.js`，每个服务一个目录：`uniCloud-alipay/cloudfunctions/health-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/task-service/index.obj.js`。
- 前端函数使用 camelCase 动词短语：`submit`、`buildDetails`、`setDateChip` 位于 `src/pages/record/health-vaccination.vue` 和 `src/pages/record/breeding-heat.vue`。
- composable 导出函数使用 camelCase：`cloudCall`、`queueSubmitFeedback`、`consumeSubmitFeedback` 位于 `src/composables/useCloudCall.ts` 和 `src/composables/useSubmitFeedback.ts`。
- 云对象公开方法使用 camelCase：`addHealthRecord`、`batchAddHealthRecords`、`batchStartMedication` 位于 `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`。
- 云对象内部 helper 使用 camelCase，并放在 `module.exports` 外：`validateDetails`、`saveCustomType`、`autoCompletePendingTasks` 位于 `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`；`mergeTasks` 在 `uniCloud-alipay/cloudfunctions/task-service/index.obj.js` 测试环境导出。
- UniCloud 生命周期方法保留 `_before` / `_after` 命名：`uniCloud-alipay/cloudfunctions/family-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/task-service/index.obj.js`。
- 前端响应式变量使用 camelCase，并用状态含义命名：`selectedDogs`、`submitState`、`sourceTaskIds` 位于 `src/pages/record/health-vaccination.vue`；`dayCounts`、`latestLoadToken`、`suppressedTaskMap` 位于 `src/pages/home/index.vue`。
- 表单对象可用 `reactive` 命名为 `form`，细分对象可用 `details`：`src/pages/record/breeding-heat.vue`、`src/pages/record/health-vaccination.vue`。
- 云数据库字段、请求 payload 字段、集合字段使用 snake_case：`dog_id`、`family_id`、`deleted_at`、`created_at` 位于 `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`、`src/types/health.ts`。
- 常量使用全大写或稳定业务名：`PRESET_VACCINE_TYPES` 位于 `src/pages/record/health-vaccination.vue` 和 `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`；毫秒天数在云函数内优先使用字面量 `86400000`，相关测试也使用 `86400000` 或局部 `DAY_MS`，见 `tests/cloud-objects/task-service.test.ts`。
- TypeScript 类型使用 PascalCase：`HealthRecord`、`MedicationTask` 位于 `src/types/health.ts`；`Task`、`TaskStatus` 位于 `src/types/task.ts`。
- 字符串联合类型用于固定枚举：`HealthRecordType`、`DewormingType` 位于 `src/types/health.ts`；`ExtraArrangementKind` 由 `as const` 推导，位于 `src/utils/breedingExtraArrangement.ts`。
- 组件 props 和 emits 使用内联泛型声明：`defineProps` / `defineEmits` 位于 `src/components/base/BButton.vue`、`src/components/form/BDogPicker.vue`、`src/components/layout/BModal.vue`。
## Code Style
- 未检测到 Prettier、ESLint 或 Biome 配置；项目格式以现有文件风格为准，配置文件只有 `package.json`、`tsconfig.json`、`vite.config.ts`、`vitest.config.ts`。
- TypeScript/Vue 文件多使用单引号且不写分号：`src/composables/useCloudCall.ts`、`src/stores/taskStore.ts`、`src/pages/home/index.vue`。
- 少量文件保留双引号和分号，应按邻近文件风格维护：`src/App.vue` 使用双引号导入和分号。
- Vue SFC 顺序为 `<template>`、`<script setup lang="ts">`、`<style lang="scss" scoped>`：`src/pages/record/breeding-heat.vue`、`src/pages/record/health-vaccination.vue`。
- 云对象是 CommonJS JavaScript，使用 `require`、`module.exports`、`const db = uniCloud.database()`：`uniCloud-alipay/cloudfunctions/family-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/health-service/index.obj.js`。
- 未检测到 lint 脚本或 lint 配置；`package.json` 只提供 `type-check`、`test`、`test:watch`、`test:coverage` 和 UniApp build/dev scripts。
- 类型检查命令是 `pnpm type-check`，底层执行 `vue-tsc --noEmit`，配置来自 `tsconfig.json`。
- 路径别名只配置 `@/* -> ./src/*`，见 `tsconfig.json` 和 `vitest.config.ts`。
## Import Organization
- 应使用 `@/` 引用 `src` 内模块：`src/pages/record/health-vaccination.vue`、`src/pages/home/index.vue`、`src/stores/dogStore.ts`。
- 组件内部相邻目录有相对导入：`src/components/form/BDogPicker.vue` 使用 `../layout/BSheet.vue`、`../feedback/BSkeleton.vue`。
- 云对象使用 CommonJS 路径和 UniCloud 公共模块名：`uniCloud-alipay/cloudfunctions/health-service/index.obj.js` 使用 `require('breed-auth/auth')`。
## Error Handling
- 前端云对象调用统一走 `useCloudCall` 或 `cloudCall`，它会导入云对象、处理 `errCode`、设置 `loading/error`、弹 toast，并可通过 `throwOnError` 抛错给页面：`src/composables/useCloudCall.ts`。
- 表单提交优先使用局部状态和弱成功反馈；`submitState: 'idle' | 'submitting' | 'success'`、`successMode: 'silent'`、`loadingMode: 'local'`、`wait(140)` 后 `uni.navigateBack()` 是记录页主模式：`src/pages/record/health-vaccination.vue`、`src/pages/record/breeding-heat.vue`。
- 可恢复或缓存型失败使用空 `catch` 保留旧状态：`src/stores/dogStore.ts` 的 `fetchFromServer`、`src/stores/taskStore.ts` 的 `fetchFromServer`。
- 用户可见校验错误通过云对象 `throw new Error('中文提示')`，再由 `_after` 变成 `errCode/errMsg`：`uniCloud-alipay/cloudfunctions/family-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/health-service/index.obj.js`。
- 权限错误使用 `requireFamily`、`requireAdmin` 统一抛出：`uniCloud-alipay/cloudfunctions/family-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`。
- 非关键后置写入允许降级并记录日志，例如保存自定义类型失败不阻断主记录：`uniCloud-alipay/cloudfunctions/health-service/index.obj.js` 的 `saveCustomType`。
## Logging
- 生产代码只在生命周期或兜底场景少量使用 `console.log` / `console.warn`：`src/App.vue`、`uniCloud-alipay/cloudfunctions/health-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/task-service/index.obj.js`。
- 云对象补偿或审计日志使用带前缀的消息，便于定位：`[saveCustomType] failed:` 位于 `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`；`[batchCompleteTask] auto-record failed:` 位于 `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`。
- 新增业务逻辑不要用 console 替代用户反馈；用户反馈使用 `useCloudCall` toast 或 `BSubmitBanner`，见 `src/composables/useCloudCall.ts` 和 `src/pages/home/index.vue`。
## Comments
- 注释使用中文，重点解释业务规则、平台限制、流程语义和非显然的并发/乐观更新逻辑：`src/pages/home/index.vue`、`uniCloud-alipay/cloudfunctions/task-service/index.obj.js`。
- Vue 组件顶部可写中文块注释说明用途、Props、Events：`src/components/base/BButton.vue`、`src/components/form/BDogPicker.vue`、`src/components/layout/BModal.vue`。
- 云对象顶部写服务职责说明，方法上写业务块注释：`uniCloud-alipay/cloudfunctions/health-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/family-service/index.obj.js`。
- 简单赋值和直观模板结构不需要注释；页面 scoped style 中只保留分区注释，参考 `src/pages/record/health-medication.vue`。
- composable 使用接口注释和 `@example`：`src/composables/useCloudCall.ts`。
- TypeScript 类型文件使用字段中文行内注释解释冗余字段和业务含义：`src/types/health.ts`、`src/types/task.ts`。
- 测试 helper 使用 JSDoc 描述 mock 能力：`tests/helpers/mock-unicloud.ts`。
## Function Design
## Module Design
- Vue 组件使用 `<script setup lang="ts">`，不显式 default export：`src/components/form/BDogPicker.vue`、`src/pages/record/health-vaccination.vue`。
- composable 和 util 使用命名导出：`src/composables/useSubmitFeedback.ts`、`src/utils/breedingExtraArrangement.ts`。
- Pinia store 使用 `export const useXStore = defineStore(...)`：`src/stores/dogStore.ts`、`src/stores/taskStore.ts`。
- 云对象只通过 `module.exports = { _before, _after, methods... }` 暴露公开方法：`uniCloud-alipay/cloudfunctions/family-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/task-service/index.obj.js`。
- 类型有 `src/types/index.ts` 作为基础类型入口，领域类型仍直接从各文件导入：`src/types/health.ts`、`src/types/task.ts`。
- 组件没有统一 barrel；页面直接从具体路径导入组件：`src/pages/home/index.vue`、`src/pages/record/health-medication.vue`。
## UI/Form Conventions
- 页面使用 `.page`、`.form-body`、`.field-group`、`.field-label`、`.fixed-bottom`、`.submit-btn` 等全局类，定义在 `src/styles/common.scss` 并由 `src/App.vue` 全局导入。
- 页面 scoped style 只写差异部分；纯使用公共表单样式的页面可保留空 scoped style，例如 `src/pages/record/breeding-heat.vue` 和 `src/pages/record/health-vaccination.vue`。
- 全局 `box-sizing: border-box` 在 `src/App.vue`，新样式不需要重复设置。
- 互斥表单选项使用 `.pill-select` / `.pill-select__item`，例如疫苗类型、给药方式、频率：`src/pages/record/health-vaccination.vue`、`src/pages/record/health-medication.vue`。
- 视图切换或首页分层使用 pills/section 控件，不要把表单互斥选项改成 segmented control；首页 summary pills 在 `src/pages/home/index.vue`。
- 日期选择使用 UniApp `picker mode="date"`，日期写入 timestamp 毫秒数，并用 `new Date(value + 'T00:00:00+08:00').getTime()` 解析选择值：`src/components/form/BFormOptions.vue`、`src/pages/record/breeding-heat.vue`、`src/pages/home/index.vue`。
- 快捷日期 chips 统一用 `今天/昨天/前天` 或 `今天/明天/后天`，并以当天 0 点 timestamp 为准：`src/components/form/BFormOptions.vue`、`src/components/form/BExtraArrangementSection.vue`。
- 健康疫苗/驱虫表单继续使用 `BFormOptions` 管理待办、日期、下次提醒：`src/pages/record/health-vaccination.vue`、`src/pages/record/health-deworming.vue`、`src/components/form/BFormOptions.vue`。
- 繁育记录表单使用 `BExtraArrangementSection`，额外安排字段为 `enabled/kind/dueDate/notes`，提交时转成 `extra_arrangement`：`src/pages/record/breeding-heat.vue`、`src/components/form/BExtraArrangementSection.vue`。
- 犬只选择使用 `BDogPicker`，多选全选语义基于当前 `filteredDogs`，支持 `roleFilter`、`genderFilter`、`readonly`：`src/components/form/BDogPicker.vue`。
- 记录页从首页任务进入时要承接 `taskId`、`taskIds`、`batchDogs`、`details`，并在提交后通过 `queueSubmitFeedback` 把 `completedTaskIds`、`suppressTaskIds`、`removeBatchCard` 传回首页：`src/pages/record/health-vaccination.vue`、`src/composables/useSubmitFeedback.ts`。
- 提交按钮使用三态：默认、提交中、成功瞬态；成功后短暂停留再 `uni.navigateBack()`：`src/pages/record/health-vaccination.vue`、`src/pages/record/breeding-heat.vue`。
- 首页接收提交反馈用 `consumeSubmitFeedback('/pages/home/index')`，展示 `BSubmitBanner` 并先做本地乐观移除，再后台刷新：`src/pages/home/index.vue`、`src/components/feedback/BSubmitBanner.vue`。
- BSheet/BModal 打开时锁定滚动并通过遮罩关闭；滚动条隐藏规则在 `src/components/layout/BSheet.vue`，居中弹窗规则在 `src/components/layout/BModal.vue`。
- 删除确认优先用 `BDeleteConfirm` 或 `BModal danger`，软删除文案和 30 天恢复提示在 `src/components/layout/BDeleteConfirm.vue`。
- 首页加载链路使用 `latestLoadToken` 防止旧响应覆盖新状态；修改 `loadAll`、`loadTodayCards`、`loadWeekCache`、`loadDateCounts` 时保留 token 判断：`src/pages/home/index.vue`.
- `dayCounts` 的今天红点在 `Promise.all` 后按 `cards.value.length` 修正，不依赖后端 `counts.today`：`src/pages/home/index.vue`.
- 乐观移除必须同步 `cards`、`dayCards`、`weekCache`、`dayCounts` 和批量卡元数据，相关函数是 `removeCardLocally`、`syncWeekCache`、`syncCardMeta`、`filterSuppressedCards`：`src/pages/home/index.vue`.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Frontend pages are Vue 3 SFCs under `src/pages/`; shared UI is under `src/components/`; cloud access is centralized through `src/composables/useCloudCall.ts`.
- Backend business logic is implemented as UniCloud cloud objects under `uniCloud-alipay/cloudfunctions/*-service/index.obj.js`.
- Data ownership is family-scoped: business collections contain `family_id`, and cloud object `_before` hooks inject `this.uid`, `this.familyId`, and `this.role`.
- Client state uses Pinia stores with `pinia-plugin-unistorage` for stale-while-revalidate caches in `src/stores/dogStore.ts`, `src/stores/taskStore.ts`, and `src/stores/protocolStore.ts`.
- Business modules use timestamp milliseconds for dates and store local time expectations in page/composable logic such as `src/pages/home/index.vue` and record forms under `src/pages/record/`.
## Layers
- Purpose: Bootstrap Vue, Pinia, theme, auth, uni-id-pages, and cloud prewarm.
- Location: `src/main.ts`, `src/App.vue`
- Contains: `createSSRApp(App)`, Pinia registration, global style imports, `onLaunch` initialization.
- Depends on: `pinia`, `pinia-plugin-unistorage`, `src/composables/useAuth.ts`, `src/composables/useTheme.ts`, `src/uni_modules/uni-id-pages/init.js`.
- Used by: UniApp runtime and all pages configured in `src/pages.json`.
- Purpose: Define all application pages, protected route patterns, native tab entries, and uni-id-pages plugin routes.
- Location: `src/pages.json`
- Contains: Main tabs `pages/home/index`, `pages/dog/list`, `pages/finance/index`, `pages/profile/index`; feature pages under `pages/record/`, `pages/breeding/`, `pages/health/`, `pages/sale/`, `pages/family/`.
- Depends on: UniApp router and `uniIdRouter`.
- Used by: Page code calling `uni.navigateTo`, `uni.switchTab`, `uni.redirectTo`, and the custom bottom nav in `src/components/layout/BNavBar.vue`.
- Purpose: Own screen-level state, query parameters, form composition, cloud calls, and navigation.
- Location: `src/pages/`
- Contains: Domain folders `src/pages/home/`, `src/pages/dog/`, `src/pages/record/`, `src/pages/breeding/`, `src/pages/health/`, `src/pages/finance/`, `src/pages/sale/`, `src/pages/family/`, `src/pages/profile/`.
- Depends on: `src/components/`, `src/composables/useCloudCall.ts`, `src/composables/useAuth.ts`, `src/stores/`, `src/types/`.
- Used by: UniApp routes declared in `src/pages.json`.
- Purpose: Provide reusable UI primitives, form controls, layout shells, feedback states, smart cards, and week calendar strip.
- Location: `src/components/`
- Contains: Base components in `src/components/base/`, layout components in `src/components/layout/`, form components in `src/components/form/`, feedback components in `src/components/feedback/`, smart-card renderers in `src/components/smart-card/`, week strip in `src/components/week-strip/WeekStrip.vue`.
- Depends on: Vue props/emits, CSS tokens from `src/styles/tokens.scss`, domain types where needed.
- Used by: Feature pages and composed components such as `src/components/layout/BFabSheet.vue`.
- Purpose: Centralize reusable client behavior that is not screen-specific.
- Location: `src/composables/`
- Contains: `src/composables/useCloudCall.ts` for cloud object calls, `src/composables/useAuth.ts` for uni-id/family state, `src/composables/useTheme.ts` for theme state, `src/composables/useSubmitFeedback.ts` for cross-page submit feedback.
- Depends on: UniApp globals `uni` and `uniCloud`, Vue `ref`/`computed`, type files under `src/types/`.
- Used by: Pages and stores.
- Purpose: Cache frequently used data and support optimistic or stale-while-revalidate UI.
- Location: `src/stores/`
- Contains: `src/stores/dogStore.ts`, `src/stores/taskStore.ts`, `src/stores/protocolStore.ts`.
- Depends on: `pinia`, `pinia-plugin-unistorage`, `src/composables/useCloudCall.ts`.
- Used by: `src/pages/home/index.vue`, `src/pages/dog/list.vue`, `src/components/layout/BFabSheet.vue`, health medication pages.
- Purpose: Encapsulate business writes, cross-collection reads, workflow transitions, and derived card/stat data.
- Location: `uniCloud-alipay/cloudfunctions/`
- Contains: `dog-service`, `family-service`, `breeding-service`, `health-service`, `finance-service`, `task-service`, plus DCloud plugin cloud objects `uni-id-co` and `uni-captcha-co`.
- Depends on: `uniCloud.database()`, shared auth module `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`, UniCloud runtime hooks `_before` and `_after`.
- Used by: Frontend calls through `src/composables/useCloudCall.ts` and direct prewarm in `src/App.vue`.
- Purpose: Verify uni-id tokens, map user to a single active family, enforce family/admin access, and normalize auth errors.
- Location: `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`
- Contains: `verifyAndGetFamily`, `requireFamily`, `requireAdmin`, `createAuthError`.
- Depends on: `uni-id-common`, `uniCloud.database()`, `families.members` records.
- Used by: Business cloud objects including `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/family-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`.
- Purpose: Define UniCloud MongoDB collection shapes, permissions, relationships, and required fields.
- Location: `uniCloud-alipay/database/`
- Contains: Business schemas `dogs`, `families`, `breeding_cycles`, `breeding_records`, `litters`, `health_records`, `medication_tasks`, `tasks`, `expenses`, `incomes`, `sale_records`, `dog_weights`, `medication_protocols`, `agents`; plugin schemas for uni-id/openDB.
- Depends on: UniCloud database deployment.
- Used by: All cloud objects and any clientDB/JQL access.
- Purpose: Store confirmed product decisions, field/page mappings, technical choices, and code graph navigation.
- Location: `docs/design/`, `graphify-out/`, `graphify/worksets/`
- Contains: `docs/design/01-data-model.md`, `docs/design/02-features.md`, `docs/design/03-tech-stack.md`, `docs/design/04-implementation.md`, `docs/design/05-field-page-mapping.md`, `graphify-out/GRAPH_REPORT.md`, domain worksets under `graphify/worksets/`.
- Depends on: Project workflow.
- Used by: Planning, implementation, and architecture/codebase investigation.
## Data Flow
- Use local `ref`/`reactive` state inside pages for forms and screen-only UI.
- Use `src/stores/dogStore.ts` for cached dog lists and derived dog filter workflows.
- Use `src/stores/taskStore.ts` for cached home cards/counts and FAB recommendations.
- Use `src/stores/protocolStore.ts` for medication protocols shared by protocol management and medication forms.
- Use `src/composables/useAuth.ts` as a singleton reactive auth/family source, not as a Pinia store.
## Key Abstractions
- Purpose: Standardize `uniCloud.importObject` calls, loading state, toast handling, and error normalization.
- Examples: `src/composables/useCloudCall.ts`, `src/pages/home/index.vue`, `src/pages/finance/index.vue`, `src/pages/record/health-medication.vue`.
- Pattern: Pages destructure `const { run } = useCloudCall<ServiceReturn>('service', 'method', options)` and call `await run(...)`.
- Purpose: Make every business cloud method operate inside a single family and role context.
- Examples: `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`, `uniCloud-alipay/cloudfunctions/family-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`.
- Pattern: Cloud object `_before` sets `this.uid`, `this.familyId`, and `this.role`, then calls `requireFamily` except for explicitly permitted onboarding methods.
- Purpose: Convert raw tasks, active medication, illness, care, and breeding workflow state into UI-ready home cards.
- Examples: `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`, `src/components/smart-card/SmartCard.vue`, `src/components/smart-card/DogCard.vue`, `src/components/smart-card/MedicationCard.vue`, `src/components/smart-card/BatchCard.vue`.
- Pattern: Backend composes card payloads; frontend renders by `cardType` and emits actions back to `src/pages/home/index.vue`.
- Purpose: Keep breeding records, cycle status, milestone tasks, birth/litter state, and weaning linked.
- Examples: `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js`, `src/pages/record/breeding-heat.vue`, `src/pages/breeding/birth-wizard.vue`, `src/pages/breeding/litter.vue`.
- Pattern: Record type drives status transitions and task creation; pages should submit records to `breeding-service` rather than mutate cycle/task collections directly.
- Purpose: Separate health records (`health_records`) from suggested/generated tasks (`tasks`) and active treatment courses (`medication_tasks`).
- Examples: `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`, `src/pages/record/health-vaccination.vue`, `src/pages/record/health-medication.vue`.
- Pattern: Vaccination/deworming/illness records go through `health-service`; medication courses go through `health-service` medication methods; home cards are aggregated by `task-service`.
- Purpose: Keep dog, cycle, litter, date, image, reminder, and extra-arrangement UI consistent across pages.
- Examples: `src/components/form/BDogPicker.vue`, `src/components/form/BCycleSelector.vue`, `src/components/form/BLitterSelector.vue`, `src/components/form/BDatePicker.vue`, `src/components/form/BImageUpload.vue`, `src/components/form/BFormOptions.vue`, `src/components/form/BExtraArrangementSection.vue`.
- Pattern: Add new form controls under `src/components/form/`; domain pages own data mapping into cloud payloads.
- Purpose: Provide color, radius, typography, common field, button, sheet, and layout styles.
- Examples: `src/styles/tokens.scss`, `src/styles/fonts.scss`, `src/styles/common.scss`, `src/App.vue`.
- Pattern: `src/App.vue` imports global styles once; page scoped styles should only define page-specific layout differences.
## Entry Points
- Location: `src/main.ts`
- Triggers: UniApp runtime.
- Responsibilities: Create the Vue app, create Pinia, install `pinia-plugin-unistorage`, return `{ app, Pinia }`.
- Location: `src/App.vue`
- Triggers: `onLaunch`, `onShow`, `onHide`.
- Responsibilities: Initialize theme, uni-id-pages, auth, global styles, and prewarm `health-service.ping`.
- Location: `src/pages.json`
- Triggers: UniApp router and build process.
- Responsibilities: Register pages, native tabBar, protected route patterns, uni-id login route, global navigation style.
- Location: `src/pages/home/index.vue`
- Triggers: First tab route and `onShow`.
- Responsibilities: Load family state, render attention cards, WeekStrip red dots, optimistic card actions, and cross-page submit feedback.
- Location: `src/components/layout/BNavBar.vue`
- Triggers: Mounted by tab pages.
- Responsibilities: Switch between main tabs and open `src/components/layout/BFabSheet.vue`.
- Location: `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/family-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/finance-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`
- Triggers: `uniCloud.importObject` calls from pages/stores and UniCloud scheduled `_timing*` methods in `task-service`.
- Responsibilities: Validate inputs, enforce family scope, perform cross-collection operations, return `{ data: ... }`.
- Location: `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`
- Triggers: Cloud object `_before` hooks.
- Responsibilities: Validate token, resolve active family membership, enforce admin/family access, create auth errors.
- Location: `uniCloud-alipay/database/*.schema.json`
- Triggers: UniCloud deployment and database permission enforcement.
- Responsibilities: Declare collection fields, required fields, enum values, permissions, and foreign-key metadata.
## Domain Boundaries
- Owns: `families`, uni-id user/session integration, members, roles, family settings, care rules, invite/join flows.
- Frontend: `src/composables/useAuth.ts`, `src/pages/family/`, `src/pages/profile/defaults.vue`, `src/pages/profile/care-rules.vue`, `src/pages/profile/notifications.vue`.
- Backend: `uniCloud-alipay/cloudfunctions/family-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`, `uniCloud-alipay/cloudfunctions/uni-id-co/`.
- Rule: Cross-domain cloud methods should consume `this.familyId`; do not reimplement token/family lookup outside `breed-auth`.
- Owns: `dogs`, dog status derivation, dog detail aggregation, disposition changes, puppy promotion, soft delete/restore.
- Frontend: `src/pages/dog/list.vue`, `src/pages/dog/detail.vue`, `src/pages/dog/add.vue`, `src/stores/dogStore.ts`.
- Backend: `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`.
- Rule: Derived statuses come from breeding cycles, litters, illness records, and medication tasks; do not persist these UI statuses as independent dog fields unless design docs change.
- Owns: `tasks` aggregation, home card grouping, overdue/today/week counts, task completion, postponement, scheduled audits.
- Frontend: `src/pages/home/index.vue`, `src/pages/home/batch-process.vue`, `src/components/smart-card/`, `src/components/week-strip/WeekStrip.vue`, `src/stores/taskStore.ts`.
- Backend: `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`.
- Rule: Home card shape is backend-composed; pages should avoid duplicating full card aggregation logic.
- Owns: `breeding_cycles`, `breeding_records`, `litters`, breeding milestone tasks, birth/weaning flow, extra arrangements.
- Frontend: `src/pages/record/breeding-*.vue`, `src/pages/breeding/cycle.vue`, `src/pages/breeding/birth-wizard.vue`, `src/pages/breeding/litter.vue`, `src/types/breeding.ts`.
- Backend: `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js`, with task interactions in `task-service`.
- Rule: Record creation must flow through `breeding-service.addBreedingRecord`; birth must flow through `breeding-service.addBirthRecord`.
- Owns: `health_records`, `dog_weights`, vaccination/deworming/illness forms, batch health creation, illness status, weight history.
- Frontend: `src/pages/record/health-*.vue`, `src/pages/health/batch-weight.vue`, `src/types/health.ts`.
- Backend: `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`.
- Rule: Batch vaccination/deworming cards completed from home must create real `health_records`, not only complete `tasks`.
- Owns: `medication_tasks`, medication dose progress, duplicate drug detection, medication protocol library.
- Frontend: `src/pages/record/health-medication.vue`, `src/pages/record/medication-detail.vue`, `src/pages/health/medication-protocols.vue`, `src/stores/protocolStore.ts`.
- Backend: `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`, home aggregation in `task-service`.
- Rule: Active medication APIs live in `health-service`; use that service for new medication workflows.
- Owns: `expenses`, `incomes`, `sale_records`, `agents`, finance summaries, sale deposits/completion/cancellation, expense categories.
- Frontend: `src/pages/finance/`, `src/pages/sale/`, `src/pages/profile/expense-categories.vue`, `src/types/finance.ts`.
- Backend: `uniCloud-alipay/cloudfunctions/finance-service/index.obj.js`.
- Rule: Sales state changes should flow through `finance-service` so `sale_records`, `incomes`, and dog disposition stay coordinated.
## Error Handling
- Use cloud object `_after` error normalization in business services such as `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`.
- Use `src/composables/useCloudCall.ts` options for `showError`, `showLoading`, `successMessage`, `successMode`, `loadingMode`, and `throwOnError`.
- Keep network and business error display at the page/composable boundary, not inside reusable UI components.
- Use `BNetworkError` and `BPermissionError` under `src/components/feedback/` for page-level states when needed.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
