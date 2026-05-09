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
- 主线：页面级 scope、本地事务、outbox、`_sync` 幂等 ack、同步状态 UX、在线优先边界、Network 验收
- 当前重点：真实设备 Network、多端并发、冲突/失败/待上传入口体验、图片附件 local-first 收口
- 下一版本 UX 种子：为短时可逆动作补 `Undo / 可撤销`，优先覆盖首页完成/跳过、销售取消、回收站恢复

## 协作原则

- 先确认上下文与假设；有歧义先说明 tradeoff
- 只做用户明确要求的最小改动，只改直接相关文件，不顺手抽象或扩散优化
- 数据模型或字段语义变化先改 `docs/design/01-data-model.md`
- 产品规则变化先改 `docs/design/02-features.md`
- 技术/架构边界变化先改 `docs/design/03-tech-stack.md` / `docs/design/04-implementation.md`
- review / 验收反馈先给问题、风险、定位，再给摘要
- 提交信息使用 conventional commits

## 核心红线

- 代码标识符用英文；注释用中文；文档用中文
- 业务日期字段统一为北京时间口径 timestamp 毫秒数；唯一例外是 `families.settings.morning_summary_time` 的 `HH:MM`
- 用户只选日期时按“所选年月日 + 当前本地时分秒毫秒”构造；按“天”消费时统一按北京时间换算边界
- 统计值实时查询，不做预存；简单读走 clientDB/JQL，多集合写入、状态推进、批量操作走云对象
- Local-First 迁移后，页面读取优先走 `src/localdb` 本地镜像 / projection；clientDB/JQL 仅用于同步 pull 或在线优先边界
- 支持软删除的集合统一用 `deleted_at`；回收站当前仅纳入 `dogs`、`expenses`、`incomes`、`agents`、`medication_protocols`
- 云函数内禁止使用未定义常量；毫秒常量直接写字面量 `86400000`

## 云对象 / UniCloud 部署红线

- 云端目标是支付宝云内置 UniCloud 数据库；不得把 DCloud 扩展数据库 MongoDB native API 当作可用能力，例如 `databaseForNative().collection().dropIndex()` 不适用于当前云空间
- 云数据库索引以 `uniCloud-alipay/database/*.index.json` 和控制台索引管理为准；旧索引清理走控制台手动删除，不写云对象自动删索引
- 云对象使用 `uniCloud-alipay/cloudfunctions/common/*` 公共模块时，必须在对应云对象 `package.json` 显式声明 `file:../common/...` 依赖；不能只依赖本地相对路径 fallback
- `breed-auth`、`breed-sync`、`attachment-gc` 这类公共模块变更后，必须重新部署依赖它们的云对象；至少核对 `family-service`、`dog-service`、`task-service`、`health-service`、`finance-service`、`breeding-service`
- 本地云函数通过不代表云端可用；云端 500 先看 uniCloud 函数日志真实堆栈，再判断是缺依赖、运行时 API 不支持、数据库索引/集合缺失，还是业务逻辑异常
- 云对象代码优先使用当前云运行时稳妥语法；新增 `Object.fromEntries`、`Array.prototype.flatMap`、复杂 optional chaining 等运行时相关语法时，要确认云端 Node 版本支持或提供兼容写法
- 云数据库 command 能力要做兼容判断；例如 `db.command.elemMatch` 不一定在所有运行环境可用，认证/同步关键路径要有 fallback 或测试覆盖

## Local-First Contract

- 本地数据库是 UI 事实源；云端负责同步、校验、幂等 ack 与冲突返回，不退回“等云返回再显示/提交”
- 页面进入统一：设置 active scope → 先读本地渲染 → `syncScope(scopeKey)` 后台校正；本地为空时只 full pull 当前 scope
- 写入必须先本地事务并写 `outbox_mutations`；写同步不受 TTL 限制
- 必须保留 in-flight 去重、scope TTL、手动刷新绕过 TTL、失败指数退避、collection cursor 与 scope freshness 分离
- 所有 `local-first` 页面统一接入 `usePageSync`；选择器、store、表单候选与提交不得绕过 localdb / sync runtime
- 本地写入使用语义 mutation，例如 `dog.create`、`task.complete`、`breeding.addRecord`、`health.recoverIllnesses`、`finance.addExpense`、`sale.complete`、`settings.update`
- 云对象核心写方法统一支持 `_sync.clientMutationId / deviceId / baseVersions / clientEntityIds / clientTimestamp`，返回 `ack / clientMutationId / touchedEntities / resyncScopes / conflict`
- 同一 mutation 重放不得重复创建、重复收款、重复推进状态；永久删除后本地移除，并防止后续 pull 复活旧数据
- 同步 UX 区分 `pending_sync`、`sync_failed`、`conflict`、`synced`、`pending_upload`，并提供对应入口

## Scope 与在线优先边界

- 首页只处理 `home` scope：`dogs`、`tasks`、`health_records`、`medication_tasks`；不得预拉非首页数据
- 主要 local-first scope：`dog-list`、`dog-detail:{dogId}`、`record-entry`、`record-form-support`、`breeding-cycle:{cycleId}`、`litter:{litterId}`、`health-record:{recordId}`、`medication-task:{taskId}`、`weight-batch`、`finance-list`、`finance-detail:{type}:{id}`、`finance-report:*`、`sale-list`、`sale-detail:{id}`、`agent-list`、`kennel-dashboard`、`settings-local`、`recycle`
- 在线优先：`uni-id-pages/*`、家庭 setup/join/invite/members、`profile/operation-log`、`profile/backup`、账号头像上传、token/账号资料/改密/绑定手机/注销账号；断网时明确提示“当前功能需要联网”
- 操作日志是云端审计账本，不迁入完整 local-first；离线只展示本地 pending 操作与最近日志缓存，并弱提示
- 备份页保持 online-first：备份、恢复、导出、修复、下载云文件和自动备份开关都必须联网；只允许缓存只读信息
- `operation_logs` 未部署时操作日志页静默降级为空列表，不向前端抛 `not found collection`
- 旧重定向页：`record/health`、`record/breeding`、`finance/income-add` 只做跳转承接
- 静态无同步：`profile/about` 等纯说明页
- 服务端定时权威：每日审计、自动关闭周期、晨间摘要只在云端执行；客户端只同步最终实体变化

## 图片附件红线

- 业务图片遵守 Local-First：选择后先压缩并保存本地持久引用，业务记录立即保存；同步 worker 再上传并替换为云 `fileID`
- 统一入口使用 `src/utils/imageAttachment.ts`；`BImageUpload`、财务、繁育、健康图片入口不得直接调用 `uniCloud.uploadFile`，不得长期保存 `res.tempFilePaths`
- 普通业务图片目标 `<=350KB`；健康/繁育记录图片目标 `<=450KB`；头像目标 `<=180KB`
- 云端引用不得直接传给 `<image>` 或 `previewImage`；必须通过 `resolveImageDisplayUrl(s)` 转 display URL
- 图片事实源只保存云 `fileID` 或待上传本地引用；已上传图片的本地显示缓存写入 `image_cache_entries`，不回写业务字段、不进云同步
- 待上传图片成功上传后，替换业务记录和 outbox payload 时必须同步写入 `fileID -> local_src` 缓存映射
- 附件上传失败不得阻塞业务记录保存；保留本地引用、`pending_upload` 与 `_upload_error`，由同步状态入口继续处理
- 同步状态页和备份页不得把内部 `attachment.*` 当普通用户问题暴露；非开发模式只展示可理解的记录入口和处理动作

## 高频业务红线

- 首页固定四层：`逾期 / 繁育 / 用药 / 健康`；今天页顺序固定为 `逾期待处理` → `繁育流程` → `今日用药` → `健康提醒`
- 首页红点和区块计数以全部事项数为准；`breeding_milestone` 按 `cycle_id` 或 `litter_id` 去重；来源页提交后先本地承接，再后台刷新并防闪回
- 繁育主链固定：`发情 → 建议卵泡检查 → 配种 → 建议孕检 → 生产 → 确认断奶`
- 自由入口候选：`发情` 隐藏发情中/怀孕中/哺乳中种母；`卵泡检查`、`配种` 显示未配种种母，隐藏怀孕中/哺乳中
- 异常终止文案固定用 `未怀孕`；`确认未怀孕` 仅用于孕检表单“确认怀孕（是/否）”语境
- `heat_observation` 只能挂已有 `发情中` 周期；不自动补周期、不推进主链、不生成任务、不联动费用
- 健康提醒默认建议型；只有显式 `create_task=true` 或勾选“创建下次待办”才生成任务
- 疾病康复统一走 `health-service.recoverIllnesses`；同犬同未康复病名不得重复创建
- 同犬同药名只允许一个进行中用药任务；覆盖语义是“取消旧任务 + 创建新任务”
- 收入统一入口为 `pages/finance/expense-add.vue?type=income`；`income-add.vue` 弃用
- 销售候选必须先走本地投影过滤；完成交易允许 `received_amount` 为空，未结算成交不得退款

## UI / 路由红线

- 公共样式统一放 `src/styles/common.scss` 并由 `App.vue` 全局导入；页面 `scoped style` 只写差异
- `BSheet`、`BModal`、`BDeleteConfirm` 打开时锁滚动，关闭时先退场动画再卸载
- 表单互斥选项用 pill-select；Segmented Control 只用于视图 / 标签切换；表单底部主 CTA 用 `BSubmitButton`
- 提交反馈统一为“局部 loading + 弱成功反馈 + 来源页承接”；提交按钮固定默认 / 提交中 / 成功瞬态三态，成功瞬态 `520ms`
- `BDogPicker` 默认不展示繁育阶段；健康/财务/销售选择器不得被繁育状态污染
- `BDogPicker` 的健康状态标签仅在疾病记录、用药任务等健康上下文显式传入 `showHealthStatusTags` 时展示
- 详情页首屏优先可见可点；避免遮挡内容的 sticky / 负 margin；操作入口收口为一个稳定主操作入口 + 一个 more
- `/pages/profile/index` 定位为犬舍总览页；原“我的”菜单收纳进左侧抽屉
- 路由参数改口径时保留旧入口兼容，至少兼容 `recordId/record_id`、`taskId/task_id/medication_task_id`、`cycleId/cycle_id`

## 改动 Checklist

- 改首页：核对固定结构、红点口径、提交承接、防闪回、latest token、suppression
- 改 local-first / 同步：核对 scope registry、TTL、active scope、collection cursor、scope freshness、outbox flush、Network 请求数量
- 改繁育 / 健康 / 用药：核对任务生成条件、状态推进、唯一性约束、记录表单验收、终态展示联动
- 改销售：核对候选过滤、进行中唯一性、未结算退款拦截、金额边界、列表/详情归一化
- 改家庭协作 / 云对象 / 详情页刷新：核对 `operation_logs`、多集合写入边界、北京时间按天换算、重复请求与 latest token、云对象 `package.json` 公共依赖、云端函数日志
- 改云数据库索引：核对 `.index.json` 与查询排序一致；新增索引先部署新索引，旧索引只通过控制台清理，不写云对象清理脚本
- 改图片 / 附件：核对本地持久保存、目标体积压缩、云 fileID 解析、`image_cache_entries` 命中、`pending_upload`、失效重选、上传去重、outbox 引用替换

## 测试 / 验收

- 常规回归：`pnpm type-check`、`pnpm test`
- `tests/` 是开发/CI 护栏，不进入正式 app 包；源码约束和边界测试需随功能保留
- Local-First 必测：`tests/localdb`、核心云对象 `_sync` 幂等测试、页面 source contract
- 在线优先边界必测：`tests/utils/onlineFirstBoundary.test.ts`
- 操作日志缓存必测：`tests/utils/operationLogCache.test.ts`
- 图片附件必测：`tests/utils/imageAttachment.test.ts`、`tests/utils/imageUploadFlow.test.ts`、`tests/localdb/runtime-outbox.test.ts`、`tests/utils/backupPage.test.ts`、`tests/localdb/repository.test.ts`
- Network 验收：进入首页不拉非首页 scope；TTL 内切页不重复 pull；同一 scope 并发只发一个请求；手动刷新只强制当前 scope

## graphify

- 做架构或代码结构判断前先看 `graphify-out/GRAPH_REPORT.md`
- 业务域明确时优先看 `graphify/worksets/`；高频 workset：`home-attention`、`breeding-record`、`health-medication`、`shared-form-system`、`finance`、`dog-profile`、`family-auth`、`sales-flow`、`health-ops`
- 可用 `./scripts/graphify-workset.sh show <workset>` 查看范围
- 若 `graphify-out/graph.json` 缺失，先在仓库根目录执行 `$graphify .`
- 仅在本次会话修改了代码文件后，才需要执行 `./scripts/graphify-rebuild.sh`
