# 宠物繁育管理 APP

## 项目概述

个人使用的犬类繁育管理工具，管理 30-50 只马尔济斯犬。使用 Codex 进行 AI 辅助开发。

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
- IDE：HBuilderX + Codex

## 当前阶段

Phase 1 功能 + 性能优化完成，进入验收测试阶段。

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
- **BFormOptions 组件**：所有记录表单（繁育/健康/财务）统一使用 `BFormOptions` 组件，封装"标记为待办"开关 + 日期选择（今天/明天/后天 chips）+ "下次提醒"开关。
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

- `dayCounts` 由 `getDateCounts` 从 `tasks` 集合（`status: pending`）聚合返回，**不含**用药卡/健康关注卡
- `loadAll()` 并行执行 `loadTodayCards()` + `loadDateCounts()` + `loadWeekCache()`，存在时序竞争

### 红点同步规则

- **必须在 `Promise.all` 之后**写 `dayCounts[todayTs]`，不能在子函数内写（会被后完成的 `loadDateCounts` 覆盖）
- **以实际可见卡片数为准**：`cards.value.length === 0` → 强制 0；cards 非空且服务端返回 0 → 补 1
- **不依赖 `counts.today`**：该字段含「用药卡计 1」逻辑，即使今日剂量全给完也可能为 1，不能作为红点依据
- **乐观更新**：卡片被 `removeCardLocally` 移除时，同步 `dayCounts[startOfDay(Date.now())] = counts.today`

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

gstack 技能和路由规则见 `~/AGENTS.md`（全局配置，避免重复）。

如果 gstack 技能不起作用：`cd .Codex/skills/gstack && ./setup`

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If the question is inside a clear business domain, prefer the matching workset in `graphify/worksets/` before reading raw files
- Current priority worksets:
  - `health-medication`: medication form, duplicate detection, medication card, `batchStartMedication`
  - `home-attention`: home cards, WeekStrip, `dayCounts`, `getDateCounts`
  - `breeding-record`: breeding forms, birth wizard, cycle/litter flow, `breeding-service`
  - `shared-form-system`: `BFormOptions`, selectors, sheet/modal interactions, form consistency
  - `finance`: finance pages, ROI/profit/projection/stats, `finance-service`
  - `dog-profile`: dog list/detail/add, disposition/status, `dog-service`
  - `family-auth`: family setup/invite/join/members, `useAuth`, `family-service`, `uni-id-co`
  - `sales-flow`: sale list/create/detail/agents, sale-income-dog linking
  - `health-ops`: vaccination/deworming/illness, batch weight, medication protocols, `health-service`
- Use `./scripts/graphify-workset.sh show <workset>` to inspect scope and `./scripts/graphify-workset.sh build <workset>` to create a smaller staged corpus + code graph
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- If `graphify-out/graph.json` is missing, run `$graphify .` once from the repo root to create the initial graph
- After modifying code files in this session, run `./scripts/graphify-rebuild.sh` to keep the graph current
