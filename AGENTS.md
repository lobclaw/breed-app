# 宠物繁育管理 APP

## 定位

个人使用的犬类繁育管理工具，当前服务 30-50 只马尔济斯犬。目标不是通用平台，而是让繁育者每天快速看清最该处理的事项、可靠记录、持续迭代。

## 文档入口

- 协作入口只认 `AGENTS.md`；总索引看 `docs/README.md`；路线图看 `docs/ROADMAP.md`
- 产品事实源：`docs/design/01-data-model.md`、`docs/design/02-features.md`
- 工程事实源：`docs/design/03-tech-stack.md`、`docs/design/04-implementation.md`
- 字段/页面低频映射：`docs/design/05-field-page-mapping.md`
- 记录表单验收：`docs/record-form-acceptance.md`
- 测试清库：`docs/测试清库.md`

## 当前阶段

- 技术栈：UniApp（Vue 3 + TypeScript + Pinia）+ UniCloud 云对象（支付宝云）+ UniCloud MongoDB
- 阶段：Phase 1 已完成；当前处于 `Local-First Foundation` 收口
- 已完成：全量 `local-first` 页面接入页面级 scope、`usePageSync` 与本地事实源；核心读写、回收站、配置、财务、销售、记录表单已接入本地事务 + outbox + `_sync` ack
- 当前重点：真实设备 Network 验收、冲突/失败/待上传入口体验、多端并发回归
- 固定路线：scope registry → 本地 projection/repository → 本地读 → 本地事务 + outbox → `_sync` 幂等 ack → 同步状态 UX → Network 验收
- 下一版本 UX 种子：在当前弱成功反馈基线上，为短时可逆动作补 `Undo / 可撤销`，优先覆盖首页完成/跳过、销售取消、回收站恢复

## 协作原则

- 先确认上下文与假设；有歧义先说明 tradeoff
- 只做用户明确要求的最小改动，只改直接相关文件，不顺手抽象、配置化或扩散优化
- 数据模型或字段语义变更前，先更新 `docs/design/01-data-model.md`
- 产品规则变化同步 `docs/design/02-features.md`；工程边界变化同步 `docs/design/03-tech-stack.md` / `docs/design/04-implementation.md`
- review / 验收反馈先给问题、风险、定位，再给摘要
- 提交信息使用 conventional commits

## 核心红线

- 代码标识符用英文；注释用中文；文档用中文
- 除 `families.settings.morning_summary_time` 外，业务日期字段统一为北京时间口径 timestamp 毫秒数；用户只选日期时按“所选年月日 + 当前本地时分秒毫秒”构造
- 按“天”消费的查询、分组、红点、逾期、第 X 天，统一读取 timestamp 后按北京时间换算日边界
- 统计值实时查询，不做预存；简单读取走 clientDB/JQL，多集合写入、状态推进、批量操作走云对象
- Local-First 迁移后，页面读取优先走 `src/localdb` 本地镜像 / projection；clientDB/JQL 仅用于同步 pull 或尚未迁移的在线优先边界
- 支持软删除的集合统一用 `deleted_at`；回收站当前仅纳入 `dogs`、`expenses`、`incomes`、`agents`、`medication_protocols`
- 通知设置统一放 `families.settings`；晨间摘要默认 `09:00`；`morning_summary_time` 是唯一北京时间 `HH:MM` 模板字段
- `care_group` 仅保留配置与数据结构，未接入自动任务链路，入口默认隐藏
- 云函数内禁止使用未定义常量；毫秒常量直接写字面量 `86400000`

## Local-First Contract

- 本地数据库是 UI 事实源；云端只负责同步、校验、幂等 ack 与冲突返回；不要退回“等云返回再显示/提交”
- 读同步受页面 scope + TTL 控制；写同步不受 TTL 控制，用户写入后必须立即本地事务并写入 `outbox_mutations`
- 页面进入统一：设置 active scope → 先读本地渲染 → `syncScope(scopeKey)` 后台校正；本地为空时只 full pull 当前 scope
- `App.vue` 只初始化 localdb、认证、网络监听和 sync worker；回前台/网络恢复时 flush outbox，并按当前 active scope TTL 同步
- 必须保留 in-flight 去重、scope TTL、手动刷新绕过 TTL、失败指数退避、collection cursor 与 scope freshness 分离
- 推荐 TTL：`home=20s`；普通列表 `120s`；财务/统计/销售列表 `300s`；详情 `45s`；配置 `300s`；后台 core mirror `10min`
- 所有 `local-first` 页面统一接入 `usePageSync`；选择器、store、表单候选与提交不得绕过 localdb / sync runtime
- 本地写入使用语义 mutation，例如 `dog.create`、`task.complete`、`breeding.addRecord`、`health.recoverIllnesses`、`finance.addExpense`、`sale.complete`、`settings.update`
- 云对象核心写方法统一支持 `_sync.clientMutationId / deviceId / baseVersions / clientEntityIds / clientTimestamp`，返回 `ack / clientMutationId / touchedEntities / resyncScopes / conflict`
- 同一 mutation 重放不得重复创建、重复收款、重复推进状态；永久删除后本地移除，并防止后续 pull 复活旧数据
- 同步 UX 区分 `pending_sync`、`sync_failed`、`conflict`、`synced`、`pending_upload`，并提供对应入口

## Scope 与在线优先边界

- 首页只处理 `home` scope：`dogs`、`tasks`、`health_records`、`medication_tasks`；不得预拉财务、销售、窝、代理人、协议等非首页数据
- 主要 local-first scope：`dog-list`、`dog-detail:{dogId}`、`record-entry`、`record-form-support`、`breeding-cycle:{cycleId}`、`litter:{litterId}`、`health-record:{recordId}`、`medication-task:{taskId}`、`weight-batch`、`finance-list`、`finance-detail:{type}:{id}`、`finance-report:*`、`sale-list`、`sale-detail:{id}`、`agent-list`、`kennel-dashboard`、`settings-local`、`recycle`
- 在线优先：`uni-id-pages/*`、家庭 setup/join/invite/members、`profile/operation-log`、`profile/backup`、云存储上传、token/账号资料/改密/绑定手机/注销账号；断网时必须明确提示“当前功能需要联网”
- `operation_logs` 未部署时操作日志页静默降级为空列表，不得向前端抛 `not found collection`
- 旧重定向页：`record/health`、`record/breeding`、`finance/income-add` 只做跳转承接，不再当真实业务页维护
- 静态无同步：`profile/about` 等纯说明页
- 服务端定时权威：每日审计、自动关闭周期、晨间摘要只在云端执行；客户端只同步最终实体变化
- 图片/附件第一版在线上传；业务主体可离线创建，附件失败时标记 `pending_upload`

## 高频业务红线

- 首页固定四层：`逾期 / 繁育 / 用药 / 健康`；今天页顺序固定为 `逾期待处理` → `繁育流程` → `今日用药` → `健康提醒`
- 首页红点和区块计数以全部事项数为准，不随折叠后的可见卡片数变化；`breeding_milestone` 按 `cycle_id` 或 `litter_id` 去重；来源页提交后先本地承接，再后台刷新并防闪回
- 繁育主链固定：`发情 → 建议卵泡检查 → 配种 → 建议孕检 → 生产 → 确认断奶`；真实关闭依赖记录页提交成功
- 繁育自由入口候选：`发情` 隐藏发情中/怀孕中/哺乳中种母；`卵泡检查`、`配种` 显示未配种种母（空闲与发情中），隐藏怀孕中/哺乳中
- `放弃本次繁育` 是周期级独立管理动作，所有未终态周期可在周期详情 `... 更多操作` 执行；只将周期状态置为 `放弃` 并取消相关未完成提醒，不创建繁育记录
- `异常终止记录` 是记录级事实：发情中只显示 `放弃配种`，提交后创建 `abnormal_termination` 记录并将周期置为 `放弃`；怀孕中显示 `流产 / 死胎 / 医疗终止 / 未怀孕`，提交后创建记录并将周期置为 `失败`
- 异常终止类型文案固定用 `未怀孕`，不要再显示 `确认未怀孕`；`确认未怀孕` 仅可保留在孕检表单“确认怀孕（是/否）”语境
- 周期时间线终止展示区分来源：无异常终止记录的放弃周期显示 `本次繁育已放弃` + `放弃于 YYYY-MM-DD`；有 `abnormal_termination` 记录的周期显示 `本次繁育已终止` + `异常终止：{termination_type}`
- 犬只详情繁育历史中，带 `abnormal_termination` 记录的终态周期结果显示 `异常终止`，不要显示 `已放弃` / `未成功`
- `heat_observation` 只能挂已有 `发情中` 周期；不自动补周期、不推进主链、不生成任务、不联动费用
- 记录自由入口先筛候选再进表单；锁定入口继续兼容 `dogId + dogName + cycleId + locked=true + taskId`
- 繁育候选标签只在繁育入口显式开启：当前发情/怀孕显示 `发情第 X 天` / `怀孕第 X 天`；无当前发情状态但有历史发情记录时显示 `上次发情：YYYY-MM-DD`
- 健康提醒默认建议型，只有显式 `create_task=true` 或勾选“创建下次待办”才生成任务；首页批量完成疫苗/驱虫必须同时创建真实 `health_record`
- 疫苗候选不展示繁育阶段标签；有历史疫苗记录时在名字后显示 `上次疫苗：YYYY-MM-DD`
- 驱虫候选不展示繁育阶段标签；有历史驱虫记录时在名字后显示 `上次驱虫：YYYY-MM-DD`
- 疾病记录与用药任务候选在名字右侧展示当前疾病/当前用药标签，文案与颜色沿用档案列表状态标签口径
- 疾病康复统一走 `health-service.recoverIllnesses`；同狗同未康复病名不得重复创建，服务端必须兜底
- 同犬同药名只允许一个进行中用药任务；覆盖语义是“取消旧任务 + 创建新任务”
- 收入统一入口为 `pages/finance/expense-add.vue?type=income`；`income-add.vue` 弃用；`sale_records` 当前不纳入回收站
- 销售“开始销售”走 `finance-service.createSaleRecord`，创建 `sale_records.status=待售` 并把犬只 `disposition` 切到 `待售`
- 开始销售候选必须先走本地投影过滤：仅 `幼崽` 且 `disposition in 在养/自留/待售`，并排除已有 `待售/已预定` 销售记录的犬只；`定金取消` 后再次销售只在同犬最新可重启取消记录展示入口，创建新销售记录，旧记录不复用；提交仍由本地事务与云对象兜底校验
- 完成交易允许 `received_amount` 为空；为空时写 `已成交 + 未结算`，不自动生成销售收入；补结算走 `finance-service.settleSale`
- 未结算成交不得退款；退款金额必须 `> 0` 且不超过 `received_amount`；定金取消的保留金额必须在 `0..deposit_amount` 内，前端、本地事务、云对象三层都要校验
- 销售列表和详情必须使用同一归一化口径，稳定展示 `sale_mode`、`settlement_status`、`agent_name` 与犬只基础信息

## UI / 路由红线

- 公共样式统一放 `src/styles/common.scss` 并由 `App.vue` 全局导入；页面 `scoped style` 只写差异
- `BSheet`、`BModal`、`BDeleteConfirm` 打开时锁滚动，关闭时先退场动画再卸载
- 表单互斥选项用 pill-select；Segmented Control 只用于视图 / 标签切换；表单底部主 CTA 用 `BSubmitButton`
- 提交反馈统一为“局部 loading + 弱成功反馈 + 来源页承接”；提交按钮固定默认 / 提交中 / 成功瞬态三态，成功瞬态 `520ms`
- 下一轮交互优化优先给短时可逆动作补 `Undo / 可撤销`，不要回退到强 success toast 驱动
- `BDogPicker` 默认不展示繁育阶段；只有繁育表单/生产/临产等繁育入口显式传入 `showBreedingStage` 才显示发情/怀孕标签，健康/财务/销售选择器不得被繁育状态污染
- `BDogPicker` 的健康状态标签仅在疾病记录、用药任务等健康上下文显式传入 `showHealthStatusTags` 时展示，不作为全局默认
- 详情页首屏优先可见可点；避免遮挡内容的 sticky / 负 margin；操作入口收口为一个稳定主操作入口 + 一个 more
- `/pages/profile/index` 定位为犬舍总览页，不再以长列表菜单为主体；原“我的”菜单收纳进左侧抽屉
- 路由参数改口径时保留旧入口兼容，至少兼容 `recordId/record_id`、`taskId/task_id/medication_task_id`、`cycleId/cycle_id`

## 改动 Checklist

- 改首页：核对固定结构、红点口径、提交承接、防闪回、latest token、suppression
- 改 local-first / 同步：核对 scope registry、TTL、active scope、collection cursor、scope freshness、outbox flush、Network 请求数量
- 改繁育 / 健康 / 用药：核对任务生成条件、状态推进、唯一性约束、记录表单验收；改终态展示时同步核对周期详情时间线、犬只详情繁育历史、本地投影携带的终止记录摘要
- 改销售：核对可售候选过滤、同犬只进行中唯一性、未结算退款拦截、退款/定金取消金额边界、销售列表/详情归一化
- 改通知 / 晨间摘要 / 推送：核对 `families.settings` 与北京时间 `HH:MM` 分钟级命中
- 改家庭协作 / 云对象 / 详情页刷新：核对 `operation_logs`、多集合写入边界、北京时间按天换算、重复请求与 latest token
- 改完后：验证来源页承接、局部移除、scope TTL、in-flight 去重、outbox 重放、冲突/失败/待上传状态

## 测试 / 验收

- 常规回归：`pnpm type-check`、`pnpm test`
- Local-First 必测：`tests/localdb`、核心云对象 `_sync` 幂等测试、页面 source contract 中 scope 与本地读写约束
- Network 验收：进入首页不拉非首页 scope；TTL 内切页不重复 pull；同一 scope 并发只发一个请求；手动刷新只强制当前 scope
- 从零验证需同时清 UniCloud 业务数据与本地 IndexedDB/SQLite/localStorage；清库方式见 `docs/测试清库.md`
- 清云端测试数据使用 `dev-reset-service`；默认只清业务/同步数据，显式 `RESET_TEST_DATA_AND_AUTH` 才清账号数据

## graphify

- 做架构或代码结构判断前先看 `graphify-out/GRAPH_REPORT.md`
- 业务域明确时优先看 `graphify/worksets/`；高频 workset：`home-attention`、`breeding-record`、`health-medication`、`shared-form-system`、`finance`、`dog-profile`、`family-auth`、`sales-flow`、`health-ops`
- 可用 `./scripts/graphify-workset.sh show <workset>` 查看范围
- 若 `graphify-out/graph.json` 缺失，先在仓库根目录执行 `$graphify .`
- 仅在本次会话修改了代码文件后，才需要执行 `./scripts/graphify-rebuild.sh`
