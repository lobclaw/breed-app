# 宠物繁育管理 APP

## 项目定位

个人使用的犬类繁育管理工具，当前服务 30-50 只马尔济斯犬。目标不是做通用平台，而是帮助繁育者把每天最该处理的事项快速看清、可靠记录、可持续迭代。

## 文档入口

- 协作入口以 `AGENTS.md` 为准，其他同类协作文件不再维护
- 总索引：`docs/README.md`
- 当前路线图：`docs/ROADMAP.md`
- 产品事实源：`docs/design/01-data-model.md`、`docs/design/02-features.md`
- 工程事实源：`docs/design/03-tech-stack.md`、`docs/design/04-implementation.md`
- 低频映射与审计：`docs/design/05-field-page-mapping.md`
- 记录表单验收：`docs/record-form-acceptance.md`

## 当前状态

- 技术栈：UniApp（Vue 3 + TypeScript + Pinia）+ UniCloud 云对象（支付宝云）+ UniCloud MongoDB
- 产品阶段：Phase 1 功能与性能优化已完成，当前进入验收测试与首页工作台密度优化阶段
- 当前里程碑：`首页工作台密度自适应优化`
- 当前焦点：Phase 1 `Workbench Contract & Test Foundation`
- 家庭协作域已接入 `操作日志` V1：页面路由保持 `/pages/profile/operation-log`，读取统一走 `family-service.getOperationLogs`
- `护理规则 / care_group` 当前仅保留配置与数据结构，尚未真正接入自动任务生成链路；该能力后置到后续版本实现，现阶段入口默认隐藏，不作为已上线能力验收
- 固定路线：契约/测试底座 → 繁育步骤工作台 → 健康批量优先工作台 → 用药状态工作台 → 逾期/计数/防闪回校准 → 今日重点

## 协作总原则

- 先确认上下文和假设，再动手；遇到歧义先说明 tradeoff，不要默认猜测
- 只做用户明确要求的最小改动，不提前引入抽象、配置化或“顺手优化”
- 只改和当前任务直接相关的文件，避免波及无关代码、注释和格式
- 数据模型或字段语义变更前，先更新 `docs/design/01-data-model.md`
- 做 review / 验收反馈时，先给问题、风险和定位，再给摘要

## 高频工程约定

- 代码变量名/函数名用英文，注释用中文，文档用中文
- 除 `families.settings.morning_summary_time` 外，所有业务日期字段统一使用 timestamp 毫秒数（`Number`），业务口径按北京时间（UTC+8）
- 业务日期字段默认保留真实时分秒毫秒，不再要求写入 `00:00:00.000`
- 用户只选择“日期”时，前端按“所选年月日 + 当前本地时分秒毫秒”构造 timestamp；显式时间页继续以用户选定时间为准
- 任何按“天”消费的逻辑（查询 / 分组 / 红点 / 逾期 / 第 X 天）统一在读取 timestamp 后按北京时间换算日边界
- 简单读取走 clientDB/JQL；多集合写入、状态推进、批量操作走云对象
- 支持软删除的集合统一使用 `deleted_at`
- 新增操作日志集合：`operation_logs`
- 回收站当前纳入：`dogs`、`expenses`、`incomes`、`agents`、`medication_protocols`；统一由 `family-service` 聚合查询、恢复和永久删除
- 通知设置统一存放在 `families.settings`
  - `push_enabled`
  - `morning_summary_enabled`
  - `morning_summary_time`
  - `notification_types`
- 晨间摘要默认时间统一为 `09:00`
- `families.settings.morning_summary_time` 是唯一保留为北京时间 `HH:MM` 的每日触发模板字段，不参与 timestamp 统一口径
- 统计值实时查询计算，不做预存
- 提交信息使用 conventional commits

## 执行 Checklist

- 改首页相关功能前：先核对固定结构、红点口径、提交承接、防闪回和 latest token 保护
- 改繁育、健康、用药流程前：先核对任务生成条件、状态推进和唯一性约束
- 改通知设置、晨间摘要或推送逻辑前：先核对是否仍写入 `families.settings`，以及是否按家庭北京时间 `HH:MM` 分钟级命中
- 改家庭协作或关键写操作前：先核对是否需要补 / 改 `operation_logs` 记录；日志只记录“用户主动触发的顶层业务动作”
- 改云对象或详情页刷新逻辑前：先检查多集合写入边界、timestamp 口径、北京时间按天换算逻辑和重复请求风险
- 改完后：验证是否破坏来源页承接、局部移除、suppression 和 latest token 保护

## UI 与交互红线

### 通用

- 公共样式统一放 `src/styles/common.scss`，由 `App.vue` 全局导入；页面 `scoped style` 只写差异
- 全局设置 `box-sizing: border-box`
- `BSheet`、`BModal`、`BDeleteConfirm` 打开时锁定页面滚动，关闭时统一先走退场动画再卸载
- 表单互斥选项使用 pill-select；Segmented Control 仅用于视图 / 标签切换
- 提交反馈统一为“局部 loading + 弱成功反馈 + 来源页承接”；提交按钮统一支持 `默认 / 提交中 / 成功瞬态` 三态
- 提交成功瞬态统一使用 `520ms`
- 详情页首屏信息区优先保证“可见和可点”；不要为了视觉压缩使用会遮挡内容的 sticky / 负 margin 组合
- 详情页若引入加载态，骨架必须按真实页面结构拟真；不要退回成几条通用灰线
- 详情页操作入口避免“顶部按钮 + more + 底部操作区”三重重复；应收口为“一个稳定主操作入口 + 一个承接补充动作的 more”

### 一级页头

- 多动作时，主 CTA（如 `+`）固定放在动作组左侧，工具型动作放其右侧
- 一级页头主按钮统一走 `primary-page-header__action--primary`

### 详情页与弹窗

- 犬只详情 Hero 区的犬名与副信息必须明确断行或留白
- 犬只详情 / 繁育周期详情的“添加记录”入口统一复用高密 `BSheet`，不要回退到原生 `ActionSheet`
- 繁育周期详情页保留完整原始记录时间线，但历史记录不再承担“当前 / 最新”语义
- 窝详情页右上角编辑入口统一使用 `BSheet`；备注 / 经验心得类输入默认使用多行 `textarea`
- 编辑犬只页不允许直接修改 `role`

## 组件与路由口径

- `BFormOptions` 仅用于健康记录表单；繁育表单统一使用 `BExtraArrangementSection`
- `BButton` 只承接通用操作按钮；表单底部主 CTA 一律使用 `BSubmitButton`
- 记录表单按业务域统一：`HealthRecordForm`、`BreedingRecordForm`、`MedicationTaskForm`
- `/pages/record/*` 路由继续保留，对外是稳定 contract；新增 / 编辑逻辑不要重新散回各页
- 提交三态、旧 query 兼容和来源页反馈优先走共享逻辑，不要单页复制
- 记录表单若引入首屏骨架，`edit` 态必须在进入 loading 前就拿到稳定类型
- 必填项未满足时，`BSubmitButton` 应直接禁用
- `BDogPicker` 多选模式不保留确认按钮；点选、全选、取消全选实时回传
- `BLitterSelector`、`BDogPicker` 等“单纯选择”型 Sheet 列表项不额外放 chevron

## 首页任务系统

- 首页固定四层：`逾期 / 繁育 / 健康 / 用药`
- 今天页顺序固定：`逾期待处理` → `繁育流程` → `健康提醒` → `今日用药`
- 当前首页保持卡片直出，不恢复统一任务池、摘要卡、二级页或通用 Sheet
- 繁育主链 milestone 在首页按过程状态卡展示，不按普通待办卡展示
- `breeding_extra_arrangement` 继续保持独立卡片，不并入繁育步骤组总卡
- 一级模块色只表达模块归属：`逾期=强 red`、`繁育=繁育色`、`健康=blue`、`用药=plum`
- 单条动作统一用 `处理`，集合动作统一用 `批量操作`
- 卡片动作统一遵循“主 CTA / 次 CTA / 文本动作”三级层级
- 疾病不整体并入用药；观察中或治疗中但未开药仍留在健康区
- `medication_task` 即使未处理也留在 `今日用药`，不抬到逾期区
- 首页 / 周视图 / 红点对 `breeding_milestone` 必须按 `cycle_id` 或 `litter_id` 去重；若有历史残留重复 pending milestone，同一只狗 / 同一窝只保留最新一条
- 晨间摘要当前类型固定为 `breeding / vaccination / medication / care_group / overdue`，其中 `overdue` 不可关闭
- 来源页提交成功后，先做前端本地承接，再做后台刷新
- 批量卡返回后只能移除后端真实 `completedTasks`
- 本地局部移除后要加入短期 suppression，服务端刷新时先过滤，避免闪回
- `dayCounts[todayTs]` 必须在 `Promise.all` 后统一写入
- 今日红点以实际可见卡片数为准，不能依赖后端 `counts.today`

## 繁育口径

### 主链与任务

- 当前主链：`发情 → 建议卵泡检查 → 配种 → 建议孕检 → 生产 → 确认断奶`
- 主链 milestone 在首页只允许作为过程状态参考，真实关闭依赖记录页提交成功
- `heat_observation` 属于繁育域，只允许挂已有且状态为 `发情中` 的周期；不自动补建周期、不推进主链、不生成任务、不联动费用
- 发情、卵泡、配种、孕检、产检、临产、异常终止页都移除旧的“下次提醒”逻辑

### 自由入口与锁定入口

- 自由入口统一先筛候选再进表单
  - `发情 / 卵泡检查 / 配种`：只显示没有 `发情中 / 怀孕中 / 哺乳中` 状态的 `种狗 + 母`
  - `发情观察`：仅 `发情中` 且带 `cycleId`
  - `孕检 / 产检 / 临产`：仅 `怀孕中` 且带 `cycleId`
  - `异常终止`：仅 `发情中` 或 `怀孕中` 且带 `cycleId`
- 自由入口不承接“当前进行中周期继续录入”；继续录入必须走首页流程、犬只详情、周期详情等锁定上下文入口
- 锁定入口继续允许带 `dogId + dogName + cycleId + locked=true`，或再带 `taskId`

### 首页繁育表达

- 首页 `建议卵泡检查` 行：
  - 第一行固定 `发情第 X 天`
  - 第二行显示检查摘要
  - 异常时第三行红字显示 `最近一次检查提示发育不良`
- 首页 `配种` 行：
  - 第一行固定 `发情第 X 天`
  - 第二行黄色辅助信息显示 `卵检后第 Y 天`
  - 超窗时第三行红字显示 `建议配种日期已过 Z 天`
- 首页 `建议孕检` 行：
  - 第一行固定 `配种第 X 天`
  - 第二行黄色辅助信息显示完整动作文案
  - 如读取 `mating_number`，使用 `第 N 脚配种第 X 天`
- 首页 `待产` 行允许弱文本动作 `产检 / 临产`
  - `产检` 常驻显示
  - `临产` 仅在距预产期 5 天内显示
  - 都不关闭 `birth` milestone

### 记录表单与 Birth Wizard

- 配种方式选项顺序统一为 `人工授精` 在前、`自然交配` 在后；新建与编辑默认选中 `人工授精`
- `details.mating_number` 表示“本周期第几脚”；由系统按同周期已有配种记录数自动递增计算，前端只展示不允许手改
- 额外安排字段只包含 `kind + due_date + notes`，由 `breeding-service.addBreedingRecord` 同次提交创建
- 完成、推迟、跳过额外安排只作用于任务本身，不生成 `breeding_record`
- `birth-wizard` Step 2 幼崽昵称保持 `选填`；为空时自动写入默认名 `<母犬名>窝-<录入序号>号`
- `birth-wizard` Step 3 需要提供 `经验心得（选填）` 与 `首次驱虫提醒 / 首次疫苗提醒`
- 生产记录页勾选的 `首次驱虫提醒 / 首次疫苗提醒` 只创建普通健康待办，不创建真实 `health_record`，且仅对存活幼崽生效
- 生产后默认只自动生成 `确认断奶` milestone；首驱 / 首免不再静默自动铺链
- 繁育记录删除当前仅开放给 `heat_observation`

## 健康与用药口径

- 健康提醒默认是建议型；只有显式 `create_task=true` 或勾选“创建下次待办”才生成任务
- 首页批量完成疫苗 / 驱虫必须同时创建真实 `health_record`
- 疾病记录详情页的 `more` 不再重复放 `编辑记录`；应优先承接 `标记康复`、`开始用药` 等直接业务动作
- 同一犬只同一药名只允许一个进行中的用药任务
- 已超过疗程天数的旧用药任务，在同狗同药名重复检测 / 创建链路中先自动收口为 `已完成`
- 重复用药弹窗分为“将创建”和“已有同名任务”两段；重复犬默认不勾选覆盖
- 覆盖语义是“取消旧任务 + 创建新任务”
- 用药任务主状态表达疗程是否结束；未全量完成时通过详情页或副文案表达 `部分完成`
- 用药详情页主实体是 `medication_task`；跳转和详情查询优先使用用药任务 ID
- 回收站恢复或永久删除 `medication_protocol` 后必须刷新 `protocolStore`

## 犬只状态口径

- 犬只详情“当前状态”表达当前仍生效且需要理解 / 处理的状态集合，不是时间线
- 状态优先级统一：`疾病` → `用药` → `怀孕 / 哺乳` → `发情`
- 状态点击口径：
  - `生病中 → 健康记录详情`
  - `用药中 → 用药任务详情`
  - `怀孕 / 哺乳 / 发情 → 繁育周期详情`
- 状态主文案带天数时统一用紧凑式：`发情第X天 / 怀孕第X天 / 哺乳第X天 / 病名第X天 / 药名第X天`
- 跳转和查询必须兼容 camelCase 与 snake_case：至少兼容 `recordId/record_id`、`taskId/task_id/medication_task_id`、`cycleId/cycle_id`
- 同一只狗在 `details.treatment_status !== 已康复` 时，不允许存在同病名重复疾病记录；前端可预检查，但 `health-service` 必须做服务端兜底

## 财务与入口口径

- 统一记账页入口为 `pages/finance/expense-add.vue?type=income`；`income-add.vue` 视为弃用
- 收入手动类型固定为 `销售 / 定金保留 / 领养 / 其他`
- 财务首页筛选采用“顶部 `全部 / 收入 / 支出` + 统一高级筛选入口”结构
- 财务首页已生效筛选条件必须显式显示为 chips，并支持单个清除与一键清空
- 财务首页筛选默认规则：同维度多选取并集，不同维度之间取交集；`仅看无关联` 与任意关联对象互斥
- 收入关联只支持 `犬只 / 无关联`
- 支出关联支持 `犬只 / 窝 / 繁育周期 / 无关联`
- 自定义支出分类必须带 `parent_group`
- `sale_records` 当前不纳入回收站，未定义自动收入与犬只去向回滚前不要顺手接入
- 财务统计页底部模块固定命名为 `专项报表`，不跟随上方时间维度切换
- `未来预估` 页禁止先展示硬编码默认参数再异步覆盖；合法 `0` 值必须可覆盖默认值
- `单窝利润` 页费用归类中，若同一笔 expense 同时关联 `linked_cycle_id` 与 `linked_litter_id`，只允许统计一次，并优先归入“窝级别费用”

## 云函数与页面刷新

- 云函数内禁止使用未定义常量
- 毫秒常量直接写字面量 `86400000`，不要定义全局 `DAY_MS`
- `operation_logs` 若尚未部署到云端，操作日志页必须静默降级为空列表，不得向前端抛出 `not found collection`
- 详情页如果既要首屏加载又要子页返回刷新，必须避免 `onLoad` 和紧随其后的 `onShow` 双请求
- 犬只详情页从子页返回时默认保留现有内容并静默后台刷新；只有首屏加载才进入整页骨架
- 犬只详情页的静默刷新只在来源页有提交反馈时触发；实现时要保留 latest token / 请求令牌保护
- 详情页路由参数改口径时要保留旧入口兼容；主口径改为 `id` 后，仍需兼容历史 `taskId`、`recordId/record_id`、`medicationTaskId/medication_task_id`
- 当前记录域重构后的回归验证优先按 `docs/record-form-acceptance.md` 执行

## 已知限制

- V1 是单家庭模式；`_before` 拦截器默认从用户信息直接注入 `familyId`
- V1 在线优先，不支持离线操作和冲突解决
- `operation_logs` 需要随数据库 schema 一并部署后才会开始真实积累日志；未部署阶段页面只显示空态

## graphify

- 做架构或代码结构判断前，先看 `graphify-out/GRAPH_REPORT.md`
- 业务域明确时，优先看对应 `graphify/worksets/`
- 当前高频 workset：`home-attention`、`breeding-record`、`health-medication`、`shared-form-system`、`finance`、`dog-profile`、`family-auth`、`sales-flow`、`health-ops`
- 可用 `./scripts/graphify-workset.sh show <workset>` 查看范围
- 若 `graphify-out/graph.json` 缺失，先在仓库根目录执行 `$graphify .`
- 仅在本次会话修改了代码文件后，才需要执行 `./scripts/graphify-rebuild.sh`
