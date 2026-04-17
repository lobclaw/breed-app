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
- **下一版本反馈优化方向**：在现有“局部 loading + 弱成功反馈 + 来源页承接”基线上，优先为短时可逆动作补 `Undo / 可撤销` 交互（如首页完成/跳过、销售取消、回收站恢复），不要回退为强 success toast 驱动。
- **提交按钮三态**：记录表单提交按钮统一支持 `默认 / 提交中 / 成功瞬态` 三态；成功态仅短暂展示，用于降低“点了没反应”的不确定感，不额外叠加强成功 toast。
- **Pill 选择器 vs 分段控件**：表单中的互斥选项（如生产方式、驱虫类型）使用 pill-select 样式（card-dim 背景、无边框、胶囊圆角）；Segmented Control 仅用于视图/标签页切换（如"疫苗/驱虫/疾病" tab）。
- **财务关联入口**：支出关联支持 `犬只 / 窝 / 繁育周期 / 无关联`，收入只支持 `犬只 / 无关联`；点选即生效，不要再加二次确认按钮。
- **犬只选择器实时选择**：`BDogPicker` 多选模式不保留底部确认按钮，点选/全选/取消全选必须实时回传。
- **财务收入入口口径**：统一记账页以 `pages/finance/expense-add.vue?type=income` 为准，`income-add.vue` 视为弃用；收入手动类型维持 `销售 / 定金保留 / 领养 / 其他`。
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

## 首页任务系统（2026-04 当前口径）

- **首页固定分层**：顶部 pills 和正文区块统一为 `逾期 / 繁育 / 健康 / 用药`
- **今天页顺序**：`逾期待处理` → `繁育流程` → `健康提醒` → `今日用药`
- **首页颜色语义分层**：一级模块色只表达模块归属，`逾期=强 red`、`繁育` 保持繁育色、`健康=blue`、`用药=plum`；不要把模块色直接等同于具体任务类型色
- **健康二级类型颜色**：`疫苗=blue`、`驱虫=teal`、`疾病=柔和 red`、`用药执行=plum`；`rose` 继续保留给繁育/怀孕链路，不再承接疾病主视觉
- **疾病入口全局统一红色**：所有疾病相关入口/卡片/标签/记录 icon/FAB 项都必须使用疾病红语义，禁止再出现 `illness -> plum/rose/blue` 的分裂配置；`BFabSheet` 等快捷入口里的“疾病”也必须是 red family
- **首页动作命名分层**：单条入口统一用 `处理`，集合入口统一用 `批量操作`；不要在首页同时并存 `批量处理` / `批量操作` 两套底部按钮文案
- **首页按钮层级统一**：卡片内动作统一遵循“主 CTA / 次 CTA / 文本动作”三级层级；主 CTA 用实底并可带图标，次 CTA 用浅底或描边且默认不带图标，`收起` 这类弱动作只用文本样式
- **同卡动作风格要同构**：`疾病观察` 与 `今日用药` 的底部动作区必须保持同一布局语言，不允许一张卡是主按钮+文本动作，另一张卡变成完全不同的按钮体系；只允许按模块色系区分 `red` / `plum`
- **单行 chip 只做次级动作**：列表行右侧的 `处理 / 康复 / 停药` 统一视为次级 action chip，颜色跟随卡片语义但必须弱于底部批量按钮，不能抢主 CTA 层级
- **批量 Sheet 命名统一**：从首页卡片进入的批量动作 Sheet 统一使用 `XX批量操作` 命名，例如 `疾病批量操作`、`今日用药批量操作`；不要再出现 `批量处理`、`批量操作`、`更多操作` 混用
- **疾病与用药的首页归属**：`疾病` 不整体并入 `用药`；`观察中 / 治疗中但未开药` 留在 `健康`，只有形成具体 medication task 后才进入 `用药`
- **逾期覆盖规则**：繁育/健康待办一旦逾期，统一升级为逾期强红；疾病本身默认使用“柔和 red”，不要和逾期强红混成同一层级
- **不做摘要/二级页/Sheet**：当前首页保持卡片直出，不要擅自改回摘要卡或统一任务池
- **健康提醒是建议型**：疫苗/驱虫记录默认只计算建议日期；只有显式 `create_task=true` / 勾选「创建下次待办」才生成下次任务
- **批量健康卡完成语义**：从首页批量完成疫苗/驱虫时，必须同时创建真实 `health_record`，不能只把 task 标记完成
- **繁育流程是推进器**：当前主链按 `发情 → 建议卵泡检查 → 配种 → 建议孕检 → 生产 → 确认断奶`
- **繁育表单不再有“下次提醒”**：发情 / 卵泡 / 配种 / 孕检 / 产检 / 临产 / 异常终止页统一移除 `skip_reminder / next_reminder_date / enableReminder` 旧逻辑
- **额外安排是手动附加事项**：繁育表单可顺手添加 `额外安排`，字段仅 `kind + due_date + notes`，由 `breeding-service.addBreedingRecord` 同次提交创建 `breeding_extra_arrangement`
- **额外安排的归属与展示**：周期类繁育页创建的额外安排默认挂 `cycle_id`；首页仍在 `繁育` 大区块内，但单独放在 `额外安排` 子层，不混入 `健康提醒`
- **额外安排完成语义**：完成 / 推迟 / 跳过仅作用于任务本身，不生成 `breeding_record`，不改变主流程状态机
- **流程卡跳转规则**：`breeding_milestone` 必须按 `details.step_type` 路由；`follicle_check` → 卵泡页，`pregnancy_check` → 孕检页，`weaning_confirm` → 窝详情页
- **流程卡参数承接**：从首页进入繁育流程页时，必须传 `dogId + dogName + cycleId + taskId + locked=true`，保证犬只预填且锁定
- **首页卡片不可静默截断**：返回和展示首页卡片时，不要再恢复 `slice(0, 12)` 这类硬截断
- **批量卡 key 必须带子类型**：疫苗/驱虫批量卡 ID 要包含 `vaccine_type` / `deworming_type + drug_name`，避免同天不同子类型 key 冲突
- **返回首页先承接后刷新**：记录页/待办页提交成功后，优先用前端本地状态承接首页变化，再做后台刷新；不要回到“等待首页全量重拉后才看到变化”的交互。
- **批量卡只移除真实完成子集**：从首页批量卡进入记录页时，返回后只能按后端真实 `completedTasks` 局部移除已完成任务。只有当 `completedTasks.length === sourceTaskIds.length` 时，才允许整张批量卡消失。
- **首页短期抑制防闪回**：刚提交成功并在首页已局部移除的任务，需要短时间加入 suppression 集合；服务端刷新返回时先过滤这些 task，避免“卡片刚消失又立刻刷回来”。
- **局部承接要同步批量卡元数据**：批量卡部分完成时，除了过滤 `tasks`，还要同步 `dogs`、`progress.total`、标题里的“X只”数量，不能只删 task 列表导致卡面信息失真。

## 用药任务模块

- **用药不进入逾期区**：`medication_task` 即使今日未处理，也继续留在 `今日用药` 模块，不抬到 `逾期待处理`
- **用药未处理状态语义**：当天内显示 `待完成 / 部分完成`；过了当天且该日剂量未补满时显示 `漏服`；主语义仍是 `plum`，`漏服` 只作为辅语义红色提醒，不把整卡升级成逾期强红
- **详情页与首页一致**：`medication-detail` 的执行记录要区分 `待完成 / 漏服 / 已完成 / future`；首页 `MedicationCard` 与详情页应共用同一套“漏服”判断，不要各写一套内联逻辑
- **今日用药底部动作口径**：`完成` 是主 CTA，`批量操作` 是次 CTA；不要把 `批量康复` 直接做成与 `完成` 并列的第二个主按钮
- **今日用药批量操作范围**：批量能力应收纳进 `今日用药批量操作` Sheet，由 Sheet 承载 `完成今日用药`、`批量康复` 等集合动作；不要在卡片底部继续扩散多个并列主按钮
- **今日用药行内动作风格**：行内 `康复 / 停药` 必须和 `疾病观察` 的单行 `处理` 处于同一弱动作层级，仅换语义色系，不得使用比底部批量按钮更强的视觉强调

### 重复用药检测（`src/pages/record/health-medication.vue`）

- **同药名视为唯一**：同一犬只同一药名只允许一个进行中任务，不支持并存（剂量相同无重复创建必要）
- **弹窗分两段**：「将创建（N只）」无重复犬 + 「已有同名任务（M只）」可勾选覆盖，默认不勾选
- **覆盖 = 取消旧任务 + 创建新任务**：云函数 `batchStartMedication` 接受可选 `override_dog_ids`，先将该犬同名进行中任务设为 `已取消`，再创建新任务
- **提交只创建最终犬只**：`finalDogIds = cleanDogIds + overrideDogIds`，未勾选的重复犬直接跳过
- **全选按钮**：弹窗「已有同名任务」区块右侧有「全选/取消全选」，同样在 `BDogPicker` 多选模式下提供全选

## 犬只档案状态口径

- **详情页“当前状态”不是时间线**：`当前状态` 区块表达“当前仍然生效且需要理解/处理的状态集合”，不按发生时间排序；时间维度由“最近健康记录”承接
- **详情页状态排序**：犬只详情 `statuses` 统一按处理优先级排序：`疾病` → `用药` → `怀孕/哺乳` → `发情`；不要再依赖后端 `push` 顺序
- **详情页顶部与正文顺序一致**：Hero 区状态标签与“当前状态”列表必须复用同一份排序结果，避免顶部和下方顺序打架
- **详情页疾病展示兜底去重**：即使存在脏数据，`当前状态` 里的疾病也要按病名去重显示，不能再次出现两个同病名（如两个“感冒”）
- **档案列表标签优先级**：犬只列表卡片标签同样按处理优先级展示，`发情中` 放后于 `疾病 / 用药 / 怀孕 / 哺乳`
- **档案列表疾病摘要**：列表里疾病只占一个 tag；多个疾病显示为 `感冒/腹泻`，3 个及以上用 `感冒/腹泻等3项`
- **档案列表用药摘要**：列表里用药保持一个聚合 tag，`1项 -> 用药中`，`多项 -> 用药中·N项`

## 疾病记录唯一性

- **同狗同病名未康复不可重复**：同一只狗在 `details.treatment_status !== 已康复` 期间，不允许再创建或编辑出相同 `details.condition` 的疾病记录
- **重复疾病优先引导编辑**：命中重复时，不再允许继续新建；前端应提示“已有进行中的 XX 记录”，并优先引导去编辑原记录
- **前后端双重校验**：疾病录入/编辑页可做前端预检查减少挫败感，但 `health-service` 必须做服务端兜底校验，不能只靠前端
- **历史重复清理口径**：发现已有“同狗 + 同病名 + 未康复”脏数据时，优先保留最近活跃的一条，其余记录做软性收口（如改为 `已康复` 并记录 merge 信息），不要物理删除
- **关联引用不断链**：清理历史重复疾病时，若有 `tasks.source_record_id` 等引用旧疾病记录，必须迁移到保留的主记录，避免详情/首页跳转断链

### 云函数常量规范

- 云函数内**禁止使用未定义常量**（如曾出现的 `DAY_MS is not defined` bug）
- 毫秒常量统一写字面量 `86400000`，不定义全局 `DAY_MS`

## 首页日历红点（WeekStrip）

### 数据流

- `dayCounts` 由 `getDateCounts` 聚合返回，**包含**普通 pending tasks，也包含未来日期仅有疗程状态时的红点兜底
- `loadAll()` 并行执行 `loadTodayCards()` + `loadDateCounts()` + `loadWeekCache()`，存在时序竞争
- 首页加载链路已加 **latest token** 保护；修改 `loadAll/loadTodayCards/loadWeekCache/loadDateCounts` 时不要去掉“只认最新请求”的逻辑，否则卡片可能乐观移除后又被旧响应刷回

### 红点同步规则

- **必须在 `Promise.all` 之后**写 `dayCounts[todayTs]`，不能在子函数内写（会被后完成的 `loadDateCounts` 覆盖）
- **以实际可见卡片数为准**：`cards.value.length === 0` → 强制 0；cards 非空且服务端返回 0 → 补 1
- **不依赖 `counts.today`**：该字段含「用药卡计 1」逻辑，即使今日剂量全给完也可能为 1，不能作为红点依据
- **乐观更新**：卡片被 `removeCardLocally` 移除时，同步 `dayCounts[startOfDay(Date.now())] = counts.today`
- **未来日期一致性**：如果某天只有 `medication_tasks` 形成的“今日用药”卡，也应该有红点；不能出现“无红点但点进去有卡”

## 页面刷新时机

- **`onLoad` / `onShow` 防双请求**：详情页若需要“首次进入加载 + 子页返回刷新”，必须避免首屏 `onLoad` 与紧随其后的 `onShow` 各打一次请求。推荐加 `hasLoadedOnce` 之类标记，只在首次加载完成后再允许 `onShow` 刷新。

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
- Current graphify status is expected to be **active and up to date**; if `GRAPH_REPORT.md` / `graph.json` timestamps are stale after code changes, rebuild before继续做架构判断
