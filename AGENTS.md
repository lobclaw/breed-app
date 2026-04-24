# 宠物繁育管理 APP

## 定位

个人使用的犬类繁育管理工具，当前服务 30-50 只马尔济斯犬。目标不是通用平台，而是让繁育者每天能快速看清最该处理的事项、可靠记录、持续迭代。

## 文档入口

- 协作入口只认 `AGENTS.md`；总索引 `docs/README.md`；路线图 `docs/ROADMAP.md`
- 产品事实源：`docs/design/01-data-model.md`、`docs/design/02-features.md`
- 工程事实源：`docs/design/03-tech-stack.md`、`docs/design/04-implementation.md`
- 低频映射：`docs/design/05-field-page-mapping.md`
- 记录表单验收：`docs/record-form-acceptance.md`
- 测试环境清库：`docs/测试清库.md`

## 当前状态

- 技术栈：UniApp（Vue 3 + TypeScript + Pinia）+ UniCloud 云对象（支付宝云）+ UniCloud MongoDB
- 阶段：Phase 1 功能与性能优化已完成；当前进入 `Local-First Foundation` 架构升级验收与补齐
- 当前 local-first 状态：首页、部分表单与部分写路径已接入本地事实源 / outbox；全 App 页面级 sync scope、本地读路径和配置/销售/统计等边界仍需继续补齐
- 固定路线：页面级 scope registry → 本地 projection/repository → 核心页面本地读 → 核心写入本地事务 + outbox → 云端 `_sync` 幂等 ack → 同步状态/冲突/失败 UX → Network 验收
- 家庭协作已接入 `operation_logs` V1；路由保持 `/pages/profile/operation-log`，统一走 `family-service.getOperationLogs`
- `care_group` 仅保留配置与数据结构，未接入自动任务链路，入口默认隐藏，不按已上线能力验收

## 协作原则

- 先确认上下文与假设；有歧义先说明 tradeoff，不默认猜
- 只做用户明确要求的最小改动，只改直接相关文件，不顺手抽象、配置化或扩散优化
- 数据模型或字段语义变更前，先更新 `docs/design/01-data-model.md`
- review / 验收反馈先给问题、风险、定位，再给摘要

## 核心工程 Contract

- 代码标识符用英文；注释用中文；文档用中文
- 除 `families.settings.morning_summary_time` 外，业务日期字段统一为北京时间口径的 timestamp 毫秒数（`Number`）；字段保留真实时分秒毫秒；用户只选“日期”时，前端按“所选年月日 + 当前本地时分秒毫秒”构造 timestamp
- 凡按“天”消费的逻辑（查询 / 分组 / 红点 / 逾期 / 第 X 天）统一在读取 timestamp 后按北京时间换算日边界
- 简单读取走 clientDB/JQL；多集合写入、状态推进、批量操作走云对象
- Local-First 迁移后，页面读取优先走 `src/localdb` 本地镜像 / 本地 projection；clientDB/JQL 仅用于同步 pull 或尚未迁移的在线优先边界
- 支持软删除的集合统一使用 `deleted_at`
- 回收站当前纳入：`dogs`、`expenses`、`incomes`、`agents`、`medication_protocols`；统一由 `family-service` 聚合查询 / 恢复 / 永久删除
- 通知设置统一放 `families.settings`：`push_enabled`、`morning_summary_enabled`、`morning_summary_time`、`notification_types`；晨间摘要默认时间 `09:00`；`morning_summary_time` 是唯一保留为北京时间 `HH:MM` 的模板字段
- 统计值实时查询，不做预存
- 提交信息使用 conventional commits

## Local-First / 同步 Contract

- 目标口径：本地数据库是 UI 事实源；云端是同步、校验、幂等 ack 与冲突返回源；不要退回“页面等云接口返回后再显示/提交”的在线优先体验
- 读同步和写同步分离：读同步受页面 scope + TTL 控制；写同步不受 TTL 控制，用户写入后必须立即本地事务、写入 `outbox_mutations`，有网就尽快 flush
- 页面进入统一流程：设置 active scope → 先读本地并渲染 → `syncScope(scopeKey)` 后台校正；本地为空时只 full pull 当前 scope，不全量拉全 App
- App 生命周期：`App.vue` 只初始化 localdb、认证、网络监听和 sync worker；回前台/网络恢复时 flush outbox，并按当前 active scope 的 TTL 同步，不直接拉全 core
- 必须实现 in-flight 去重、scope TTL、手动刷新绕过 TTL、失败指数退避、collection cursor 与 scope freshness 分离
- 推荐 TTL：`home=20s`；普通列表 `120s`；财务/统计/销售列表 `300s`；详情 `45s`；配置类 `300s`；后台 core mirror `10min` 且低优先级分批执行
- 首页只处理首页 scope：`dogs`、`tasks`、`health_records`、`medication_tasks`；首页不得预拉财务、销售、窝、代理人、协议等非首页数据
- 其他页面必须使用自己的 sync scope：犬只、犬只详情、记录入口、繁育周期、窝、健康详情、用药详情、财务、财务报表、销售、代理人、犬舍总览、配置、体重、回收站分别按域同步
- 选择器与 store 不得绕过 localdb：`BDogPicker`、`BLitterSelector`、`BCycleSelector`、`BFinanceLinkSheet`、`dogStore`、`protocolStore`、`taskStore` 都应读本地 projection/cache，不直接 cloudCall/clientDB
- 表单组件不得绕过 sync runtime：`BreedingRecordForm`、`HealthRecordForm`、`MedicationTaskForm` 的候选筛选、预填、提交应优先本地；重复疾病/重复用药/下一脚配种号本地预检，云端最终校验
- 本地写入必须使用语义 mutation，不存页面 patch；例如 `dog.create`、`task.complete`、`breeding.addRecord`、`health.recoverIllnesses`、`finance.addExpense`、`sale.complete`、`settings.update`
- 云对象核心写方法统一支持 `_sync.clientMutationId / deviceId / baseVersions / clientEntityIds / clientTimestamp`，返回 `ack / clientMutationId / touchedEntities / resyncScopes / conflict`
- `sync_mutations` 记录已应用 mutation；同一 mutation 重放不得重复创建、重复收款、重复推进状态
- 软删除统一以 `deleted_at` 作为 tombstone；永久删除后本地移除，并防止后续 pull 复活旧数据
- 同步状态 UX 必须区分 `pending_sync`、`sync_failed`、`conflict`、`synced`、`pending_upload`，并提供待同步/失败/冲突/待上传入口
- 开发态必须能观测 sync：scope key、collections、force/delta、TTL skip reason、in-flight dedupe、pull rows count、outbox flush result

## Scope / 在线优先边界

- `home`：首页、WeekStrip、FAB 推荐、`home/batch-process`
- `dog-list` / `dog-detail:{dogId}`：犬只列表、详情、状态、体重、繁育/健康/财务摘要
- `record-entry` / `record-form-support`：记录入口、候选犬/周期/窝、任务详情、记录详情、重复校验、下一脚配种号
- `breeding-cycle:{cycleId}` / `litter:{litterId}`：繁育周期、窝详情、繁育记录、相关任务与费用
- `health-record:{recordId}` / `medication-task:{taskId}` / `weight-batch`：健康详情、疾病、用药、批量体重
- `finance-list` / `finance-detail:{type}:{id}` / `finance-report:*`：财务首页、收支详情/编辑、统计、未来预估、母犬 ROI、单窝利润
- `sale-list` / `sale-detail:{id}` / `agent-list`：销售列表、开始销售、销售详情、定金/尾款/结算/取消、代理人管理
- `kennel-dashboard`：`profile/index` 犬舍总览，覆盖经营/繁育/财务/销售汇总
- `settings-local`：通知、默认参数、护理规则、财务分类/分类组、用药方案库；家庭成员/权限/邀请不属于此 scope
- `recycle`：`dogs`、`expenses`、`incomes`、`agents`、`medication_protocols` 的 deleted rows 聚合、恢复、永久删除
- 在线优先：`uni-id-pages/*`、`family/setup`、`family/join`、`family/invite`、`family/members`、`profile/operation-log`、`profile/backup`、云存储上传、token/账号资料/改密/绑定手机/注销账号
- 静态无同步：`profile/about` 等纯说明页
- 服务端定时权威：每日审计、自动关闭周期、晨间摘要只在云端执行；客户端只同步最终实体变化，不本地伪造审计/摘要结果
- `income-add.vue` 视为旧入口，统一重定向或收敛到 `finance/expense-add?type=income`，不要维护第二套收入写路径
- `sale_records` 当前不纳入回收站；未定义自动收入与犬只去向回滚前不要顺手接入回收站
- 备份导出只包含云端已同步数据；若存在 pending outbox / pending upload，备份页必须提示数据尚未完全同步
- 图片/附件第一版在线上传；业务主体可离线创建，但附件失败时标记 `pending_upload`，不能显示为完整同步

## 改动前后 Checklist

- 改首页：先核对固定结构、红点口径、提交承接、防闪回、latest token
- 改 local-first / 同步：先核对 scope registry、TTL、active scope、collection cursor、scope freshness、outbox flush、Network 请求数量
- 改繁育 / 健康 / 用药：先核对任务生成条件、状态推进、唯一性约束
- 改通知 / 晨间摘要 / 推送：先核对是否仍写入 `families.settings`，以及是否按家庭北京时间 `HH:MM` 分钟级命中
- 改家庭协作 / 关键写操作 / 云对象 / 详情页刷新：先核对 `operation_logs`、多集合写入边界、北京时间按天换算逻辑、重复请求风险
- 改完后：验证来源页承接、局部移除、suppression、latest token、scope TTL、in-flight 去重、outbox 重放是否仍成立

## UI / 组件 / 路由 Contract

- 样式：公共样式统一放 `src/styles/common.scss` 并由 `App.vue` 全局导入；页面 `scoped style` 只写差异；全局统一 `box-sizing: border-box`
- 弹层：`BSheet`、`BModal`、`BDeleteConfirm` 打开时锁滚动，关闭时先退场动画再卸载
- 交互：表单互斥选项用 pill-select；Segmented Control 只用于视图 / 标签切换；提交反馈统一为“局部 loading + 弱成功反馈 + 来源页承接”；提交按钮固定 `默认 / 提交中 / 成功瞬态` 三态，成功瞬态 `520ms`
- 详情页：首屏优先保证“可见和可点”；不要用遮挡内容的 sticky / 负 margin；若有骨架必须拟真；操作入口收口为“一个稳定主操作入口 + 一个 more”
- `我的` 页：`/pages/profile/index` 当前定位为犬舍总览页，不再以长列表菜单作为主体；页头主标题优先显示家庭名，副标题显示成员昵称与角色；页面主体先展示经营/繁育汇总卡，再展示管理入口；原“我的”页菜单收纳进左侧抽屉，底部导航保持不变，抽屉内容需可滚动且默认隐藏滚动条
- 页头与详情：一级页头多动作时主 CTA 在左、工具动作在右，主按钮走 `primary-page-header__action--primary`；犬只详情 Hero 需明确断行 / 留白；犬只详情与繁育周期详情“添加记录”统一复用高密 `BSheet`；繁育周期详情保留完整原始时间线但历史记录不承担“当前 / 最新”语义；窝详情右上角编辑入口统一用 `BSheet`，备注 / 经验心得默认多行 `textarea`；编辑犬只页不允许直接修改 `role`
- 组件与路由：`BFormOptions` 仅用于健康记录表单，繁育表单统一用 `BExtraArrangementSection`；`BButton` 只承接通用操作按钮，表单底部主 CTA 一律用 `BSubmitButton`
- 记录表单：统一为 `HealthRecordForm`、`BreedingRecordForm`、`MedicationTaskForm`；`/pages/record/*` 是稳定 contract；提交三态、旧 query 兼容、来源页反馈优先走共享逻辑；若有首屏骨架，`edit` 态必须在 loading 前拿到稳定类型；必填未满足时 `BSubmitButton` 直接禁用
- 选择器：`BDogPicker` 多选模式不保留确认按钮，点选 / 全选 / 取消全选实时回传；`BLitterSelector`、`BDogPicker` 等纯选择型 Sheet 列表项不额外放 chevron

## 首页工作台 Contract

- 首页固定四层：`逾期 / 繁育 / 健康 / 用药`
- 今天页顺序固定：`逾期待处理` → `繁育流程` → `健康提醒` → `今日用药`
- 首页继续卡片直出，不恢复统一任务池、摘要卡、二级页或通用 Sheet；繁育主链 milestone 在首页按过程状态卡展示，不按普通待办卡展示；`breeding_extra_arrangement` 保持独立卡片
- `BFabSheet` 的“智能推荐”首张待办卡固定为三层信息：`标题 / 动作说明 / 弱上下文`；后两张 recent / fallback 推荐继续保持简版两行，不扩成任务详情卡
- 一级模块色只表达归属：`逾期=强 red`、`繁育=繁育色`、`健康=blue`、`用药=plum`；单条动作统一用 `处理`，集合动作统一用 `批量操作`；卡片动作层级固定“主 CTA / 次 CTA / 文本动作”
- 疾病不整体并入用药；观察中或治疗中但未开药仍留在健康区
- `medication_task` 即使未处理也留在 `今日用药`，不抬到逾期区
- 首页 / 周视图 / 红点对 `breeding_milestone` 必须按 `cycle_id` 或 `litter_id` 去重；同狗 / 同窝若有残留重复 pending milestone，只保留最新一条
- 晨间摘要类型固定为 `breeding / vaccination / medication / care_group / overdue`，其中 `overdue` 不可关闭
- 来源页提交成功后先做前端本地承接，再做后台刷新；批量卡返回后只能移除后端真实 `completedTasks`；本地局部移除后要加短期 suppression，服务端刷新时先过滤，避免闪回
- `dayCounts[todayTs]` 必须在 `Promise.all` 后统一写入
- 今日红点以实际可见卡片数为准，不能依赖后端 `counts.today`

## 繁育 Contract

- 主链固定：`发情 → 建议卵泡检查 → 配种 → 建议孕检 → 生产 → 确认断奶`；首页中的主链 milestone 只表达过程状态，真实关闭依赖记录页提交成功
- `heat_observation` 只能挂已有且状态为 `发情中` 的周期；不自动补周期、不推进主链、不生成任务、不联动费用
- 发情、卵泡、配种、孕检、产检、临产、异常终止页都移除旧“下次提醒”
- 自由入口先筛候选再进表单：
  - `发情 / 卵泡检查 / 配种`：仅无 `发情中 / 怀孕中 / 哺乳中` 状态的 `种狗 + 母`
  - `发情观察`：仅 `发情中` 且带 `cycleId`
  - `孕检 / 产检 / 临产`：仅 `怀孕中` 且带 `cycleId`
  - `异常终止`：仅 `发情中` 或 `怀孕中` 且带 `cycleId`
- 自由入口不承接“继续录入当前周期”；继续录入必须走首页流程、犬只详情、周期详情等锁定入口
- 锁定入口继续允许带 `dogId + dogName + cycleId + locked=true`，也可再带 `taskId`
- FAB 首张待办命中 `breeding_milestone` 时，点击直接走锁定记录页，不绕到周期详情；`birth`、`weaning_confirm` 继续保留各自例外跳转
- 首页繁育表达：
-  - `建议卵泡检查`：第 1 行 `发情第 X 天`；第 2 行检查摘要；异常时第 3 行红字 `最近一次检查提示发育不良`
-  - `配种`：第 1 行 `发情第 X 天`；第 2 行黄字 `卵检后第 Y 天`；超窗时第 3 行红字 `建议配种日期已过 Z 天`
-  - `建议孕检`：第 1 行 `配种第 X 天`；第 2 行黄字完整动作文案；若有 `mating_number`，显示 `第 N 脚配种第 X 天`
-  - `待产`：允许弱文本动作 `产检 / 临产`；`产检` 常驻，`临产` 仅距预产期 5 天内显示，二者都不关闭 `birth` milestone
- 配种方式顺序固定 `人工授精` 在前、`自然交配` 在后；新建与编辑默认选中 `人工授精`
- `details.mating_number` 表示本周期第几脚，由系统按同周期已有配种记录数自动递增；前端只展示不允许手改
- 额外安排字段只包含 `kind + due_date + notes`，由 `breeding-service.addBreedingRecord` 同次提交创建；完成 / 推迟 / 跳过额外安排只作用于任务，不生成 `breeding_record`
- `birth-wizard` Step 2 幼崽昵称保持 `选填`，为空时自动写入 `<母犬名>窝-<录入序号>号`；Step 3 需要 `经验心得（选填）` 与 `首次驱虫提醒 / 首次疫苗提醒`
- 生产记录页勾选的 `首次驱虫提醒 / 首次疫苗提醒` 只创建普通健康待办，不创建真实 `health_record`，且仅对存活幼崽生效
- 生产后默认只自动生成 `确认断奶` milestone；首驱 / 首免不再静默自动铺链；当前允许删除的繁育记录仅 `heat_observation`

## 健康 / 用药 / 犬只状态 Contract

- 健康提醒默认是建议型；只有显式 `create_task=true` 或勾选“创建下次待办”才生成任务
- 首页批量完成疫苗 / 驱虫必须同时创建真实 `health_record`
- 疾病记录详情页的 `more` 不再重复放 `编辑记录`；优先承接 `标记康复`、`开始用药` 等直接动作
- 用药：同一犬只同一药名只允许一个进行中的用药任务；同狗同药名重复检测 / 创建时若旧任务已超疗程，先自动收口为 `已完成`；重复用药弹窗分“将创建”和“已有同名任务”两段，重复犬默认不勾选覆盖，覆盖语义是“取消旧任务 + 创建新任务”
- 单犬创建用药任务时，若所选犬存在未康复疾病，应提供 `关联疾病（选填）`；仅 1 条未康复疾病时默认选中，多条时用户选择；多犬创建继续使用入口带入的 `illness_links`，不做复杂二次选择
- 用药任务主状态表达疗程是否结束；未全量完成时通过详情页或副文案表达 `部分完成`；用药详情页主实体是 `medication_task`，跳转和查询优先使用用药任务 ID；回收站恢复或永久删除 `medication_protocol` 后必须刷新 `protocolStore`
- 疾病 `标记康复` 必须通过 `health-service.recoverIllnesses` 一次性收口：标记疾病 `已康复`，并取消显式关联的进行中 `medication_tasks` 及旧 daily `tasks`；首页单个/批量康复、今日用药批量康复、疾病详情、犬只详情入口口径一致，避免前端多接口并发
- 犬只状态：表达当前仍生效且需要理解 / 处理的状态集合，不是时间线；优先级 `疾病` → `用药` → `怀孕 / 哺乳` → `发情`；点击分别跳到健康记录详情 / 用药任务详情 / 繁育周期详情；带天数时统一紧凑式 `发情第X天 / 怀孕第X天 / 哺乳第X天 / 病名第X天 / 药名第X天`
- 状态图标口径：`怀孕中= pregnant_woman`、`哺乳中= child_care`、`待产= child_friendly`；不要把 `favorite`、`pets`、`local_drink` 重新用于这三个状态，避免和配种、通用犬只、饮水语义混淆
- 跳转和查询必须兼容 camelCase 与 snake_case，至少兼容 `recordId/record_id`、`taskId/task_id/medication_task_id`、`cycleId/cycle_id`
- 同一只狗在 `details.treatment_status !== 已康复` 时，不允许存在同病名重复疾病记录；前端可预检查，但 `health-service` 必须服务端兜底

## 财务 Contract

- 统一记账入口为 `pages/finance/expense-add.vue?type=income`；`income-add.vue` 视为弃用；收入手动类型固定为 `销售 / 定金保留 / 领养 / 其他`
- 财务首页筛选结构固定为“顶部 `全部 / 收入 / 支出` + 统一高级筛选入口”；已生效筛选条件必须显式显示为 chips，并支持单个清除与一键清空
- 默认筛选规则：同维度多选取并集，不同维度取交集；`仅看无关联` 与任意关联对象互斥；收入关联只支持 `犬只 / 无关联`，支出关联支持 `犬只 / 窝 / 繁育周期 / 无关联`
- 自定义支出分类必须带 `parent_group`
- `sale_records` 当前不纳入回收站；在未定义自动收入与犬只去向回滚前不要顺手接入
- 财务统计页底部模块固定命名 `专项报表`，不跟随上方时间维度切换
- `未来预估` 禁止先展示硬编码默认值再异步覆盖；合法 `0` 值必须能覆盖默认值
- `单窝利润` 中若同一笔 expense 同时关联 `linked_cycle_id` 与 `linked_litter_id`，只统计一次，并优先归入“窝级别费用”

## 销售 Contract

- 顶层销售状态保持 `待售 / 已预定 / 已成交 / 已退款 / 定金取消`；`已成交` 与 `settlement_status` 分离，后者当前使用 `未结算 / 部分结算 / 已结算`
- `待售` 表示已手动纳入销售池，不再要求先填写 `floor_price`；`floor_price` 仅表示内部参考底价，可为空
- “开始销售”提交仍走 `finance-service.createSaleRecord`；仅 `幼崽` 且 `disposition ∈ {在养, 自留}` 可开始销售；同一犬只同一时刻只允许一条进行中的销售记录
- 开始销售后必须同时满足两件事：创建一条 `sale_records.status=待售` 记录；犬只 `disposition` 切到 `待售`
- 销售创建页 `/pages/sale/create` 当前正式语义是“开始销售”，支持来源页透传 `dogId + dogName` 锁定犬只；犬只详情幼崽去向管理需提供“开始销售”入口
- 销售创建页字段口径固定为：犬只、`sale_mode`（默认 `自售`）、`floor_price`（选填）、`buyer_info`（选填）、`notes`（选填）
- 销售列表与详情必须按新语义展示：`待售` 无底价时显示“未定价”；`已成交` 且无 `received_amount` 时显示“未结算”，不要渲染 `¥0`
- 完成交易仍走 `finance-service.completeSale`，允许 `received_amount` 为空；为空时写入 `status=已成交`、`settlement_status=未结算`，且不自动生成销售收入
- 成交后补结算统一走 `finance-service.settleSale`；补录 `received_amount` 后再创建或更新自动收入；详情页需提供“补录结算”入口
- `finance-service.getSaleList/getSaleDetail` 返回值必须走销售归一化口径，稳定包含 `sale_mode`、`settlement_status`、`agent_name`

## 云函数 / 刷新 / 限制

- 云函数内禁止使用未定义常量；毫秒常量直接写字面量 `86400000`，不要定义全局 `DAY_MS`
- `operation_logs` 若尚未部署到云端，操作日志页必须静默降级为空列表，不得向前端抛 `not found collection`
- 详情页刷新：若既要首屏加载又要子页返回刷新，必须避免 `onLoad` 与紧随其后的 `onShow` 双请求；犬只详情从子页返回时默认保留现有内容并静默后台刷新，只有首屏加载才进入整页骨架；静默刷新只在来源页有提交反馈时触发，且必须保留 latest token / 请求令牌保护
- 详情页路由参数改口径时必须保留旧入口兼容；主口径改为 `id` 后仍需兼容 `taskId`、`recordId/record_id`、`medicationTaskId/medication_task_id`
- 当前记录域重构后的回归验证优先按 `docs/record-form-acceptance.md` 执行
- 已知限制：V1 单家庭模式；`_before` 默认从用户信息注入 `familyId`；当前是 Local-First Foundation，尚未完成全 App 页面级 scope 覆盖与所有写入冲突 UX；`operation_logs` 需随 schema 部署后才会真实积累，未部署阶段只显示空态

## 测试 / 清库 / 验收

- 常规回归：`pnpm type-check`、`pnpm test`
- Local-First 必测：`tests/localdb`、核心云对象 `_sync` 幂等测试、页面 source contract 中 scope 与本地读写约束
- Network 验收：进入首页不拉非首页 scope；TTL 内切页不重复 pull；同一 scope 并发只发一个请求；手动刷新只强制当前 scope
- 清库文档见 `docs/测试清库.md`；测试环境从零验证时需同时清 UniCloud 业务数据与本地 IndexedDB/SQLite/localStorage
- 清云端测试数据使用 `dev-reset-service`；默认只清业务/同步数据，显式 `RESET_TEST_DATA_AND_AUTH` 才清账号数据

## graphify

- 做架构或代码结构判断前先看 `graphify-out/GRAPH_REPORT.md`
- 业务域明确时优先看 `graphify/worksets/`
- 高频 workset：`home-attention`、`breeding-record`、`health-medication`、`shared-form-system`、`finance`、`dog-profile`、`family-auth`、`sales-flow`、`health-ops`
- 可用 `./scripts/graphify-workset.sh show <workset>` 查看范围
- 若 `graphify-out/graph.json` 缺失，先在仓库根目录执行 `$graphify .`
- 仅在本次会话修改了代码文件后，才需要执行 `./scripts/graphify-rebuild.sh`
