# Coding Conventions

**Analysis Date:** 2026-04-15

## Naming Patterns

**Files:**
- 页面文件使用 kebab-case 或业务名短横线：`src/pages/record/health-vaccination.vue`、`src/pages/record/breeding-heat.vue`、`src/pages/finance/litter-profit.vue`。
- 基础组件和业务组件使用 PascalCase，并按职责分目录：`src/components/base/BButton.vue`、`src/components/form/BDogPicker.vue`、`src/components/layout/BSheet.vue`、`src/components/smart-card/SmartCard.vue`。
- composable 使用 `useXxx.ts`：`src/composables/useCloudCall.ts`、`src/composables/useSubmitFeedback.ts`、`src/composables/useAuth.ts`。
- Pinia store 使用领域名 + `Store.ts`：`src/stores/dogStore.ts`、`src/stores/taskStore.ts`、`src/stores/protocolStore.ts`。
- 类型文件按领域拆分：`src/types/health.ts`、`src/types/task.ts`、`src/types/breeding.ts`、`src/types/finance.ts`。
- 云对象入口固定为 `index.obj.js`，每个服务一个目录：`uniCloud-alipay/cloudfunctions/health-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/task-service/index.obj.js`。

**Functions:**
- 前端函数使用 camelCase 动词短语：`submit`、`buildDetails`、`setDateChip` 位于 `src/pages/record/health-vaccination.vue` 和 `src/pages/record/breeding-heat.vue`。
- composable 导出函数使用 camelCase：`cloudCall`、`queueSubmitFeedback`、`consumeSubmitFeedback` 位于 `src/composables/useCloudCall.ts` 和 `src/composables/useSubmitFeedback.ts`。
- 云对象公开方法使用 camelCase：`addHealthRecord`、`batchAddHealthRecords`、`batchStartMedication` 位于 `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`。
- 云对象内部 helper 使用 camelCase，并放在 `module.exports` 外：`validateDetails`、`saveCustomType`、`autoCompletePendingTasks` 位于 `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`；`mergeTasks` 在 `uniCloud-alipay/cloudfunctions/task-service/index.obj.js` 测试环境导出。
- UniCloud 生命周期方法保留 `_before` / `_after` 命名：`uniCloud-alipay/cloudfunctions/family-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/task-service/index.obj.js`。

**Variables:**
- 前端响应式变量使用 camelCase，并用状态含义命名：`selectedDogs`、`submitState`、`sourceTaskIds` 位于 `src/pages/record/health-vaccination.vue`；`dayCounts`、`latestLoadToken`、`suppressedTaskMap` 位于 `src/pages/home/index.vue`。
- 表单对象可用 `reactive` 命名为 `form`，细分对象可用 `details`：`src/pages/record/breeding-heat.vue`、`src/pages/record/health-vaccination.vue`。
- 云数据库字段、请求 payload 字段、集合字段使用 snake_case：`dog_id`、`family_id`、`deleted_at`、`created_at` 位于 `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`、`src/types/health.ts`。
- 常量使用全大写或稳定业务名：`PRESET_VACCINE_TYPES` 位于 `src/pages/record/health-vaccination.vue` 和 `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`；毫秒天数在云函数内优先使用字面量 `86400000`，相关测试也使用 `86400000` 或局部 `DAY_MS`，见 `tests/cloud-objects/task-service.test.ts`。

**Types:**
- TypeScript 类型使用 PascalCase：`HealthRecord`、`MedicationTask` 位于 `src/types/health.ts`；`Task`、`TaskStatus` 位于 `src/types/task.ts`。
- 字符串联合类型用于固定枚举：`HealthRecordType`、`DewormingType` 位于 `src/types/health.ts`；`ExtraArrangementKind` 由 `as const` 推导，位于 `src/utils/breedingExtraArrangement.ts`。
- 组件 props 和 emits 使用内联泛型声明：`defineProps` / `defineEmits` 位于 `src/components/base/BButton.vue`、`src/components/form/BDogPicker.vue`、`src/components/layout/BModal.vue`。

## Code Style

**Formatting:**
- 未检测到 Prettier、ESLint 或 Biome 配置；项目格式以现有文件风格为准，配置文件只有 `package.json`、`tsconfig.json`、`vite.config.ts`、`vitest.config.ts`。
- TypeScript/Vue 文件多使用单引号且不写分号：`src/composables/useCloudCall.ts`、`src/stores/taskStore.ts`、`src/pages/home/index.vue`。
- 少量文件保留双引号和分号，应按邻近文件风格维护：`src/App.vue` 使用双引号导入和分号。
- Vue SFC 顺序为 `<template>`、`<script setup lang="ts">`、`<style lang="scss" scoped>`：`src/pages/record/breeding-heat.vue`、`src/pages/record/health-vaccination.vue`。
- 云对象是 CommonJS JavaScript，使用 `require`、`module.exports`、`const db = uniCloud.database()`：`uniCloud-alipay/cloudfunctions/family-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/health-service/index.obj.js`。

**Linting:**
- 未检测到 lint 脚本或 lint 配置；`package.json` 只提供 `type-check`、`test`、`test:watch`、`test:coverage` 和 UniApp build/dev scripts。
- 类型检查命令是 `pnpm type-check`，底层执行 `vue-tsc --noEmit`，配置来自 `tsconfig.json`。
- 路径别名只配置 `@/* -> ./src/*`，见 `tsconfig.json` 和 `vitest.config.ts`。

## Import Organization

**Order:**
1. 框架与运行时导入，例如 `vue`、`@dcloudio/uni-app`：`src/pages/record/health-vaccination.vue`、`src/pages/home/index.vue`。
2. composables、stores、utils、types，例如 `@/composables/useCloudCall`、`@/stores/taskStore`、`@/utils/breedingExtraArrangement`：`src/pages/home/index.vue`、`src/pages/record/breeding-heat.vue`。
3. 组件导入，例如 `BPageHeader`、`BDogPicker`、`BSheet`：`src/pages/record/health-medication.vue`、`src/components/form/BDogPicker.vue`。

**Path Aliases:**
- 应使用 `@/` 引用 `src` 内模块：`src/pages/record/health-vaccination.vue`、`src/pages/home/index.vue`、`src/stores/dogStore.ts`。
- 组件内部相邻目录有相对导入：`src/components/form/BDogPicker.vue` 使用 `../layout/BSheet.vue`、`../feedback/BSkeleton.vue`。
- 云对象使用 CommonJS 路径和 UniCloud 公共模块名：`uniCloud-alipay/cloudfunctions/health-service/index.obj.js` 使用 `require('breed-auth/auth')`。

## Error Handling

**Patterns:**
- 前端云对象调用统一走 `useCloudCall` 或 `cloudCall`，它会导入云对象、处理 `errCode`、设置 `loading/error`、弹 toast，并可通过 `throwOnError` 抛错给页面：`src/composables/useCloudCall.ts`。
- 表单提交优先使用局部状态和弱成功反馈；`submitState: 'idle' | 'submitting' | 'success'`、`successMode: 'silent'`、`loadingMode: 'local'`、`wait(140)` 后 `uni.navigateBack()` 是记录页主模式：`src/pages/record/health-vaccination.vue`、`src/pages/record/breeding-heat.vue`。
- 可恢复或缓存型失败使用空 `catch` 保留旧状态：`src/stores/dogStore.ts` 的 `fetchFromServer`、`src/stores/taskStore.ts` 的 `fetchFromServer`。
- 用户可见校验错误通过云对象 `throw new Error('中文提示')`，再由 `_after` 变成 `errCode/errMsg`：`uniCloud-alipay/cloudfunctions/family-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/health-service/index.obj.js`。
- 权限错误使用 `requireFamily`、`requireAdmin` 统一抛出：`uniCloud-alipay/cloudfunctions/family-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`。
- 非关键后置写入允许降级并记录日志，例如保存自定义类型失败不阻断主记录：`uniCloud-alipay/cloudfunctions/health-service/index.obj.js` 的 `saveCustomType`。

## Logging

**Framework:** console

**Patterns:**
- 生产代码只在生命周期或兜底场景少量使用 `console.log` / `console.warn`：`src/App.vue`、`uniCloud-alipay/cloudfunctions/health-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/task-service/index.obj.js`。
- 云对象补偿或审计日志使用带前缀的消息，便于定位：`[saveCustomType] failed:` 位于 `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`；`[batchCompleteTask] auto-record failed:` 位于 `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`。
- 新增业务逻辑不要用 console 替代用户反馈；用户反馈使用 `useCloudCall` toast 或 `BSubmitBanner`，见 `src/composables/useCloudCall.ts` 和 `src/pages/home/index.vue`。

## Comments

**When to Comment:**
- 注释使用中文，重点解释业务规则、平台限制、流程语义和非显然的并发/乐观更新逻辑：`src/pages/home/index.vue`、`uniCloud-alipay/cloudfunctions/task-service/index.obj.js`。
- Vue 组件顶部可写中文块注释说明用途、Props、Events：`src/components/base/BButton.vue`、`src/components/form/BDogPicker.vue`、`src/components/layout/BModal.vue`。
- 云对象顶部写服务职责说明，方法上写业务块注释：`uniCloud-alipay/cloudfunctions/health-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/family-service/index.obj.js`。
- 简单赋值和直观模板结构不需要注释；页面 scoped style 中只保留分区注释，参考 `src/pages/record/health-medication.vue`。

**JSDoc/TSDoc:**
- composable 使用接口注释和 `@example`：`src/composables/useCloudCall.ts`。
- TypeScript 类型文件使用字段中文行内注释解释冗余字段和业务含义：`src/types/health.ts`、`src/types/task.ts`。
- 测试 helper 使用 JSDoc 描述 mock 能力：`tests/helpers/mock-unicloud.ts`。

## Function Design

**Size:** 页面函数应围绕单一 UI 行为或一次提交组织。`src/pages/record/breeding-heat.vue` 的 `submit` 只负责组装繁育记录、完成来源任务、排队首页反馈；`src/pages/home/index.vue` 的首页行为较多，但拆成 `loadTodayCards`、`loadWeekCache`、`loadDateCounts`、`removeCardLocally`、`applyHomeFeedback` 等函数。

**Parameters:** 前端页面函数多从闭包中的 `ref/reactive` 读取表单状态；云对象公开方法接收单个 `data` 对象或少量标量参数，例如 `batchStartMedication(data)` 位于 `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`，`postponeTask(taskId, newDate, reason)` 位于 `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`。

**Return Values:** 云对象返回统一包裹的 `{ data: ... }`，例如 `addHealthRecord` 返回 `{ data: { recordId, completedTasks } }`，`batchStartMedication` 返回 `{ data: { count, medications } }`，路径为 `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`。

**Async Flow:** 独立查询可用 `Promise.all` 并行，尤其是首页加载和云对象多集合查询：`src/pages/home/index.vue` 的 `loadAll`、`uniCloud-alipay/cloudfunctions/finance-service/index.obj.js` 的统计/详情查询、`uniCloud-alipay/cloudfunctions/dog-service/index.obj.js` 的犬只状态查询。

## Module Design

**Exports:** 
- Vue 组件使用 `<script setup lang="ts">`，不显式 default export：`src/components/form/BDogPicker.vue`、`src/pages/record/health-vaccination.vue`。
- composable 和 util 使用命名导出：`src/composables/useSubmitFeedback.ts`、`src/utils/breedingExtraArrangement.ts`。
- Pinia store 使用 `export const useXStore = defineStore(...)`：`src/stores/dogStore.ts`、`src/stores/taskStore.ts`。
- 云对象只通过 `module.exports = { _before, _after, methods... }` 暴露公开方法：`uniCloud-alipay/cloudfunctions/family-service/index.obj.js`、`uniCloud-alipay/cloudfunctions/task-service/index.obj.js`。

**Barrel Files:**
- 类型有 `src/types/index.ts` 作为基础类型入口，领域类型仍直接从各文件导入：`src/types/health.ts`、`src/types/task.ts`。
- 组件没有统一 barrel；页面直接从具体路径导入组件：`src/pages/home/index.vue`、`src/pages/record/health-medication.vue`。

## UI/Form Conventions

**Page Shell:**
- 页面使用 `.page`、`.form-body`、`.field-group`、`.field-label`、`.fixed-bottom`、`.submit-btn` 等全局类，定义在 `src/styles/common.scss` 并由 `src/App.vue` 全局导入。
- 页面 scoped style 只写差异部分；纯使用公共表单样式的页面可保留空 scoped style，例如 `src/pages/record/breeding-heat.vue` 和 `src/pages/record/health-vaccination.vue`。
- 全局 `box-sizing: border-box` 在 `src/App.vue`，新样式不需要重复设置。

**Controls:**
- 互斥表单选项使用 `.pill-select` / `.pill-select__item`，例如疫苗类型、给药方式、频率：`src/pages/record/health-vaccination.vue`、`src/pages/record/health-medication.vue`。
- 视图切换或首页分层使用 pills/section 控件，不要把表单互斥选项改成 segmented control；首页 summary pills 在 `src/pages/home/index.vue`。
- 日期选择使用 UniApp `picker mode="date"`，日期写入 timestamp 毫秒数，并用 `new Date(value + 'T00:00:00+08:00').getTime()` 解析选择值：`src/components/form/BFormOptions.vue`、`src/pages/record/breeding-heat.vue`、`src/pages/home/index.vue`。
- 快捷日期 chips 统一用 `今天/昨天/前天` 或 `今天/明天/后天`，并以当天 0 点 timestamp 为准：`src/components/form/BFormOptions.vue`、`src/components/form/BExtraArrangementSection.vue`。

**Record Forms:**
- 健康疫苗/驱虫表单继续使用 `BFormOptions` 管理待办、日期、下次提醒：`src/pages/record/health-vaccination.vue`、`src/pages/record/health-deworming.vue`、`src/components/form/BFormOptions.vue`。
- 繁育记录表单使用 `BExtraArrangementSection`，额外安排字段为 `enabled/kind/dueDate/notes`，提交时转成 `extra_arrangement`：`src/pages/record/breeding-heat.vue`、`src/components/form/BExtraArrangementSection.vue`。
- 犬只选择使用 `BDogPicker`，多选全选语义基于当前 `filteredDogs`，支持 `roleFilter`、`genderFilter`、`readonly`：`src/components/form/BDogPicker.vue`。
- 记录页从首页任务进入时要承接 `taskId`、`taskIds`、`batchDogs`、`details`，并在提交后通过 `queueSubmitFeedback` 把 `completedTaskIds`、`suppressTaskIds`、`removeBatchCard` 传回首页：`src/pages/record/health-vaccination.vue`、`src/composables/useSubmitFeedback.ts`。

**Feedback and Navigation:**
- 提交按钮使用三态：默认、提交中、成功瞬态；成功后短暂停留再 `uni.navigateBack()`：`src/pages/record/health-vaccination.vue`、`src/pages/record/breeding-heat.vue`。
- 首页接收提交反馈用 `consumeSubmitFeedback('/pages/home/index')`，展示 `BSubmitBanner` 并先做本地乐观移除，再后台刷新：`src/pages/home/index.vue`、`src/components/feedback/BSubmitBanner.vue`。
- BSheet/BModal 打开时锁定滚动并通过遮罩关闭；滚动条隐藏规则在 `src/components/layout/BSheet.vue`，居中弹窗规则在 `src/components/layout/BModal.vue`。
- 删除确认优先用 `BDeleteConfirm` 或 `BModal danger`，软删除文案和 30 天恢复提示在 `src/components/layout/BDeleteConfirm.vue`。

**Home Attention Rules:**
- 首页加载链路使用 `latestLoadToken` 防止旧响应覆盖新状态；修改 `loadAll`、`loadTodayCards`、`loadWeekCache`、`loadDateCounts` 时保留 token 判断：`src/pages/home/index.vue`.
- `dayCounts` 的今天红点在 `Promise.all` 后按 `cards.value.length` 修正，不依赖后端 `counts.today`：`src/pages/home/index.vue`.
- 乐观移除必须同步 `cards`、`dayCards`、`weekCache`、`dayCounts` 和批量卡元数据，相关函数是 `removeCardLocally`、`syncWeekCache`、`syncCardMeta`、`filterSuppressedCards`：`src/pages/home/index.vue`.

---

*Convention analysis: 2026-04-15*
