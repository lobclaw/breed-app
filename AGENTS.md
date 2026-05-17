# 宠物繁育管理 APP

## 项目定位

个人使用的犬类繁育管理工具，当前服务 30-50 只马尔济斯犬。目标不是通用平台，而是让繁育者每天快速看清最该处理的事项、可靠记录、持续迭代。

## 快速入口

- 协作入口只认 `AGENTS.md`；当前开放任务看 `TODOS.md`，无开放 TODO 时不凭空新增任务，除非审查发现明确阻断问题
- 总索引：`docs/README.md`
- 路线图：`docs/ROADMAP.md`
- 产品事实源：`docs/design/01-data-model.md`、`docs/design/02-features.md`
- 工程事实源：`docs/design/03-tech-stack.md`、`docs/design/04-implementation.md`
- 字段/页面低频映射：`docs/design/05-field-page-mapping.md`
- 记录表单验收：`docs/record-form-acceptance.md`
- 测试清库：`docs/测试清库.md`

## 当前状态

- 技术栈：UniApp（Vue 3 + TypeScript + Pinia）+ UniCloud 云对象（支付宝云）+ UniCloud MongoDB
- 阶段：Phase 1 已完成；`Local-First Foundation` 已完成整体收口，当前进入稳定化与小步验收阶段
- 已完成主线：页面级 scope、本地事务、outbox、`_sync` 幂等 ack、同步状态 UX、在线优先边界、Network 验收、图片附件 local-first 基础收口
- 当前重点：真实设备 Network 复验、多端并发、冲突/失败/待上传入口体验、独立小边界性能与类型质量维护
- 下一版本 UX 种子：为短时可逆动作补 `Undo / 可撤销`，优先覆盖首页完成/跳过、销售取消、回收站恢复

## 协作原则

- 先确认上下文与假设；有歧义先说明 tradeoff
- 只做用户明确要求的最小改动，只改直接相关文件，不顺手抽象或扩散优化
- review / 验收反馈先给问题、风险、定位，再给摘要
- 提交信息使用 conventional commits
- 数据模型或字段语义变化先改 `docs/design/01-data-model.md`
- 产品规则变化先改 `docs/design/02-features.md`
- 技术/架构边界变化先改 `docs/design/03-tech-stack.md` / `docs/design/04-implementation.md`

## 实现结构

### LocalDB Runtime

- `src/localdb/runtime.ts` 只暴露 `localSyncRuntime` 门面
- runtime 内部按 pull / outbox / attachments / scope-sync / home-snapshot / local-builders / mutation helpers / dog / task / health / medication / breeding / litter / settings / finance / sale / agent 拆分到 `src/localdb/runtime/*`
- 本地写入入口统一走 `localSyncRuntime.*Locally`；业务页面不得直接调用 runtime 内部 mutation 模块，避免绕过 outbox、pending upload、issue refresh 与 flush 节流
- 高频本地读取优先走 readonly LocalDB API
- runtime mutation 写入统一走 `localDb.transactRows` 行级事务，回调内按已知 collection + id 使用 `getRow/upsertRow/updateRow/deleteRow`
- 新增或修改 `src/localdb/runtime/*-mutations.ts` 不得回退到 `localDb.transact`、`runLocalMutation`、批量整表 upsert 或 `tables.*` 数组重写
- `localDb.transact` 仅作为兼容 API 保留给非 runtime-mutation 调用方

### 本地读模型

- `src/localdb/domain-repository.ts` 是本地读模型 barrel 门面
- 读模型按 dogs / breeding / health / finance / sale / settings-recycle 拆到 `src/localdb/domain-repository/*`
- 纯派生逻辑优先放 `src/localdb/domain-services/*`，例如财务展示、销售状态、健康/用药状态、繁育状态；repository 只负责读取与组装

### 首页与缓存

- 首页 snapshot 按 `familyId + 日期范围 + collection revisions` memo 投影，`taskStore` 不再持久化首页业务卡片
- 首页由 `pages/home/index.vue` 编排；Header、卡片区、列表、底部 sheet 在 `pages/home/components/*`
- 首页工作台分组、sheet 状态、focus / 来源页承接、高频 suppression、批量进度缓存放在 `pages/home/composables/*`
- 本地 pending 操作日志文案优先使用 mutation 的 `logSnapshot` 名称快照，缺失时再 best-effort 查询本地表
- `SqliteAdapter` 仅在运行环境不支持 SQLite 时 fallback 到 legacy storage；真实读写错误必须抛出，不得静默降级造成双写分裂

## 核心红线

- 代码标识符用英文；注释用中文；文档用中文
- 业务日期字段统一为北京时间口径 timestamp 毫秒数；唯一例外是 `families.settings.morning_summary_time` 的 `HH:MM`
- 用户只选日期时按“所选年月日 + 当前本地时分秒毫秒”构造；按“天”消费时统一按北京时间换算边界
- 统计值实时查询，不做预存
- Local-First 页面简单读走本地镜像 / projection，多集合写入、状态推进、批量操作走本地事务 + outbox，再由云对象同步校验
- Local-First 迁移后，页面读取优先走 `src/localdb` 本地镜像 / projection；clientDB/JQL 仅用于同步 pull 或在线优先边界
- 支持软删除的集合统一用 `deleted_at`；回收站当前仅纳入 `dogs`、`expenses`、`incomes`、`agents`、`medication_protocols`
- 云函数内禁止使用未定义常量；毫秒常量直接写字面量 `86400000`

## Local-First Contract

- 本地数据库是 UI 事实源；云端负责同步、校验、幂等 ack 与冲突返回，不退回“等云返回再显示/提交”
- 页面进入统一：设置 active scope → 先读本地渲染 → `syncScope(scopeKey)` 后台校正；本地为空时只 full pull 当前 scope
- 写入必须先本地行级事务并写 `outbox_mutations`；写同步不受 TTL 限制
- 必须保留 in-flight 去重、scope TTL、手动刷新绕过 TTL、失败指数退避、collection cursor 与 scope freshness 分离
- 所有 workspace 级缓存必须按当前 `familyId` 隔离；包括 `sync_state`、scope freshness、active scope、core sync meta、store snapshot、recent actions、提交反馈、首页聚焦/折叠、财务最近分类与入口筛选等
- 没有当前 `familyId` 时不得写入全局业务缓存；消费缓存时必须校验 payload `familyId` 与当前家庭一致
- 切换账号/家庭后不得复用上一家庭的 cursor、TTL、in-flight promise、projection、路由预填或短时 UI 反馈
- 所有 `local-first` 页面统一接入 `usePageSync`；选择器、store、表单候选与提交不得绕过 localdb / sync runtime
- 本地写入使用语义 mutation，例如 `dog.create`、`task.complete`、`breeding.addRecord`、`health.recoverIllnesses`、`finance.addExpense`、`sale.complete`、`settings.update`
- 云对象核心写方法统一支持 `_sync.clientMutationId / deviceId / baseVersions / clientEntityIds / clientTimestamp`，返回 `ack / clientMutationId / touchedEntities / resyncScopes / conflict`
- 同一 mutation 重放不得重复创建、重复收款、重复推进状态；永久删除后本地移除，并防止后续 pull 复活旧数据
- 同步 UX 区分 `pending_sync`、`sync_failed`、`conflict`、`synced`、`pending_upload`，并提供对应入口

## Scope 与在线优先

- 首页只处理 `home` scope：`dogs`、`tasks`、`health_records`、`medication_tasks`；不得预拉非首页数据
- 主要 local-first scope：`dog-list`、`dog-detail:{dogId}`、`record-entry`、`record-form-support`、`breeding-cycle:{cycleId}`、`litter:{litterId}`、`health-record:{recordId}`、`medication-task:{taskId}`、`weight-batch`、`finance-list`、`finance-detail:{type}:{id}`、`finance-report:*`、`sale-list`、`sale-detail:{id}`、`agent-list`、`kennel-dashboard`、`settings-local`、`recycle`
- 在线优先：`uni-id-pages/*`、家庭 setup/join/invite/members、`profile/operation-log`、`profile/backup`、账号头像上传、token/账号资料/改密/绑定手机/注销账号；断网时明确提示“当前功能需要联网”
- 操作日志是云端审计账本，不迁入完整 local-first；离线只展示本地 pending 操作与最近日志缓存，并弱提示
- 备份页保持 online-first：备份、恢复、导出、修复、下载云文件和自动备份开关都必须联网；只允许缓存只读信息
- `operation_logs` 未部署时操作日志页静默降级为空列表，不向前端抛 `not found collection`
- 旧重定向页：`record/health`、`record/breeding` 只做跳转承接
- 静态无同步：`profile/about` 等纯说明页
- 服务端定时权威：每日审计、自动关闭周期、晨间摘要只在云端执行；客户端只同步最终实体变化

## 云对象 / UniCloud 红线

- 云端目标是支付宝云内置 UniCloud 数据库；不得把 DCloud 扩展数据库 MongoDB native API 当作可用能力，例如 `databaseForNative().collection().dropIndex()` 不适用于当前云空间
- 云数据库索引以 `uniCloud-alipay/database/*.index.json` 和控制台索引管理为准；旧索引清理走控制台手动删除，不写云对象自动删索引
- 云对象使用 `uniCloud-alipay/cloudfunctions/common/*` 公共模块时，必须在对应云对象 `package.json` 显式声明 `file:../common/...` 依赖；不能只依赖本地相对路径 fallback
- `breed-auth`、`breed-sync`、`attachment-gc` 这类公共模块变更后，必须重新部署依赖它们的云对象；至少核对 `family-service`、`dog-service`、`task-service`、`health-service`、`finance-service`、`breeding-service`
- 本地云函数通过不代表云端可用；云端 500 先看 uniCloud 函数日志真实堆栈，再判断是缺依赖、运行时 API 不支持、数据库索引/集合缺失，还是业务逻辑异常
- 云对象代码优先使用当前云运行时稳妥语法；新增 `Object.fromEntries`、`Array.prototype.flatMap`、复杂 optional chaining 等运行时相关语法时，要确认云端 Node 版本支持或提供兼容写法
- 云数据库 command 能力要做兼容判断；例如 `db.command.elemMatch` 不一定在所有运行环境可用，认证/同步关键路径要有 fallback 或测试覆盖

## 领域红线

### 账号与登录

- 公开产品心智只有“登录”，不提供独立“注册账号”入口；手机号一键登录或验证码登录验证通过后，未使用过的手机号自动创建账号并登录
- App 端优先本机号码一键登录；一键登录不可用、取消或用户切换账号时，回到手机号验证码登录；手机号 + 密码登录仅作为已设置密码用户的备用入口
- 登录页参考抖音类移动端布局：自定义顶部关闭/返回 + 帮助，正文大标题左对齐，手机号输入整块浅底圆角，主 CTA 强粉色，协议在 CTA 下方弱化展示，其他登录方式沉到底部
- 登录页只保留 `login-withoutpwd` 作为主页面；验证码登录与手机号密码登录在同页切换，`login-withpwd` 仅做旧入口兼容重定向
- 登录、找回密码等 `uni-id-pages` 认证页统一使用 `login-page.scss` 的登录风格：自定义顶部、左对齐标题说明、54px 白底弱粉边框输入框、强粉主按钮、弱化协议/辅助链接
- 认证页主按钮的浅粉未满足条件态仍可点击，点击后走表单校验并给 toast 提示；真正不可交互状态才用原生 `disabled`
- 验证码登录主链固定为两步：`login-withoutpwd` 校验手机号与协议 → 必要时弹公共协议确认弹窗 → 弹 `uni-popup-captcha(scene="send-sms-code")` → 发送 `login-by-sms` 短信 → 进入 `login-smscode`
- 协议确认弹窗必须使用公共组件；用户点同意时要同步勾选协议并继续原本待执行动作
- `login-smscode` 只保留短信验证码输入链路：6 位固定格输入、登录按钮、倒计时/重新获取入口；不得内嵌 `uni-id-pages-sms-form` 或常驻展示图形验证码
- 短信验证码输入未满 6 位时登录按钮保持浅粉但可点击，点击 toast“请输入短信验证码”；填满 6 位后自动登录，按钮文案显示“登录中...”
- 登录短信重发倒计时固定为 300 秒；重新获取时必须再次弹 `uni-popup-captcha(scene="send-sms-code")`
- 短信验证码防刷必须在 `uni-id-co` 云端 `sendSmsCode` 链路做权威控制，不得只靠前端倒计时；同手机号同场景 5 分钟 1 次，同设备同场景 10 分钟 3 次 / 1 小时 8 次，同 IP 同场景 10 分钟 5 次 / 1 小时 15 次，多手机号切换命中后 30 分钟冷却
- 短信发送防刷必须使用 `opendb-verify-codes` 的原子发送占位：先创建确定性 `_id` 占位，再检查限流，再发送短信；并发 duplicate 只能按 `uni-id-sms-send-too-frequent` 处理，不能退回“先查后写”
- 短信占位状态必须区分 `pending / sent / failed / blocked`；限流只统计非 `failed` 占位，发送失败必须标记 `failed` 或释放占位；`failed` 复用必须用 `_id + status=failed` 条件更新，且只允许抢占一次
- 找回密码 `reset-pwd-by-sms` 发送短信时，未注册手机号按成功返回但不发短信、不写可用验证码，只保留限流占位；前端统一展示发送成功/倒计时，不暴露账号是否存在
- 验证码登录测试模式只提示用户手动输入 `123456`，不得自动填入；前端 300 秒倒计时、`login-by-sms.codeExpiresIn` 与云端测试模式有效期必须一致
- 密码输入框如需显示/隐藏密码，优先使用左侧眼睛入口并关闭 `uni-easyinput` 内置右侧小眼睛
- 登录页手机号密码模式的辅助入口文案固定用“忘记密码”；点击后不校验、不携带当前手机号，直接进入找回密码页，由找回页重新输入手机号
- 找回密码页只走手机号找回主链，不展示“返回登录 / 邮箱找回”底部辅助链接；页面使用自定义导航，避免原生标题与页面标题重复
- 找回密码流程固定为单页：手机号、短信验证码、新密码、再次输入密码、底部用户协议、主按钮“完成”；点击获取短信验证码时弹 `uni-popup-captcha(scene="send-sms-code")`，通过后发送 `reset-pwd-by-sms` 短信并启动 300 秒倒计时
- 找回密码验证码使用现有 `uni-captcha` 免费图形验证码，不接阿里云/腾讯云/滑动拼图
- 短信码在点击“完成”时由 `resetPwdBySms` 校验并重置密码，成功后自动用手机号 + 新密码登录
- 账号密码规则统一为 `8-20 位，至少包含字母、数字、符号的任意两种`；前端 `password.js`、`uni-id-pages/config.js`、云端 `uni-id-co` validator 与 `uni-config-center/uni-id/config.json` 必须同步
- 认证页输入框真实输入与 placeholder 字号统一为 `15px`；包含登录手机号/密码、找回手机号、图形验证码、短信验证码等嵌套 `uni-easyinput` 场景
- 账号昵称不作为首次登录阻塞项；创建或加入家庭时填写当前成员在该家庭内的 `members.nickname`，默认可由手机号尾号生成，成员列表、操作日志和犬舍总览优先展示家庭成员称呼
- `uni-id-pages/*`、家庭创建/加入/成员管理均保持 online-first；不要接入 local-first outbox

### 图片附件

- 业务图片遵守 Local-First：选择后先压缩并保存本地持久引用，业务记录立即保存；同步 worker 再上传并替换为云 `fileID`
- 统一入口使用 `src/utils/imageAttachment.ts`；`BImageUpload`、财务、繁育、健康图片入口不得直接调用 `uniCloud.uploadFile`，不得长期保存 `res.tempFilePaths`
- 普通业务图片目标 `<=350KB`；健康/繁育记录图片目标 `<=450KB`；头像目标 `<=180KB`
- 云端引用不得直接传给 `<image>` 或 `previewImage`；必须通过 `resolveImageDisplayUrl(s)` 转 display URL
- 图片事实源只保存云 `fileID` 或待上传本地引用；已上传图片的本地显示缓存写入 `image_cache_entries`，不回写业务字段、不进云同步
- 待上传图片成功上传后，替换业务记录和 outbox payload 时必须同步写入 `fileID -> local_src` 缓存映射
- 附件上传失败不得阻塞业务记录保存；保留本地引用、`pending_upload` 与 `_upload_error`，由同步状态入口继续处理
- 同步状态页和备份页不得把内部 `attachment.*` 当普通用户问题暴露；非开发模式只展示可理解的记录入口和处理动作

### 高频业务

- 首页固定四层：`逾期 / 繁育 / 用药 / 健康`；今天页顺序固定为 `逾期待处理` → `繁育流程` → `今日用药` → `健康提醒`
- 首页红点和区块计数以全部事项数为准；`breeding_milestone` 按 `cycle_id` 或 `litter_id` 去重；来源页提交后先本地承接，再后台刷新并防闪回
- 繁育主链固定：`发情 → 建议卵泡检查 → 配种 → 建议孕检 → 生产 → 确认断奶`
- 自由入口候选：`发情` 隐藏发情中/怀孕中/哺乳中种母；`卵泡检查`、`配种` 显示未配种种母，隐藏怀孕中/哺乳中
- 异常终止文案固定用 `未怀孕`；`确认未怀孕` 仅用于孕检表单“确认怀孕（是/否）”语境
- `heat_observation` 只能挂已有 `发情中` 周期；不自动补周期、不推进主链、不生成任务、不联动费用
- 健康提醒默认建议型；只有显式 `create_task=true` 或勾选“创建下次待办”才生成任务
- 疾病康复统一走 `health-service.recoverIllnesses`；同犬同未康复病名不得重复创建
- 同犬同药名只允许一个进行中用药任务；覆盖语义是“取消旧任务 + 创建新任务”
- 收入统一入口为 `pages/finance/expense-add.vue?type=income`；旧 `income-add.vue` 已移除
- 销售候选必须先走本地投影过滤；完成交易允许 `received_amount` 为空，未结算成交不得退款

### UI 与路由

- 公共样式统一放 `src/styles/common.scss` 并由 `App.vue` 全局导入；页面 `scoped style` 只写差异
- `BSheet`、`BModal`、`BDeleteConfirm` 打开时锁滚动，关闭时先退场动画再卸载
- 表单互斥选项用 pill-select；Segmented Control 只用于视图 / 标签切换；表单底部主 CTA 用 `BSubmitButton`
- 表单单选用粉色实底 pill；多选用浅底卡片 + check + 粉色文字；不得把多选做成单选实底样式
- 主按钮体验以 `src/styles/tokens.scss` 的按钮 token 为事实源；高度、颜色、阴影、禁用/暗态透明度不得在页面里散写新规格
- 普通业务主按钮优先用 `BButton`，表单提交主 CTA 用 `BSubmitButton`；登录页、平台能力按钮、局部原生 `button` 可保留原生实现，但必须桥接同一套 token / 公共暗态样式
- 校验型未满足条件态使用 `inactive / inactiveTip` 或对应 `--inactive` 公共 class：按钮保持暗态、可点击、有按压反馈并 toast 提示；不要用原生 `disabled` 阻断用户反馈
- 真正不可交互状态才用原生 `disabled`，包括提交中、同步中、上传/下载中、导出/恢复中、联网/权限不可用等；这些状态不得为了提示而变成可重复点击
- 提交反馈统一为“局部 loading + 弱成功反馈 + 来源页承接”；提交按钮固定默认 / 提交中 / 成功瞬态三态，成功瞬态 `520ms`
- 繁育/健康记录采用“同类型新增编辑同页”：无 `id` 为新增，有 `id/recordId/record_id` 为编辑；不得新增或恢复 `breeding-edit`、`health-edit` 独立编辑页
- 记录详情页、重复记录提示、同步状态页附件处理入口都必须按记录 `type` 直达对应类型页；生产 `birth` 不走普通繁育编辑页，需单独设计窝次/幼犬编辑链路
- `BDogPicker` 默认不展示繁育阶段；健康/财务/销售选择器不得被繁育状态污染
- `BDogPicker` 的健康状态标签仅在疾病记录、用药任务等健康上下文显式传入 `showHealthStatusTags` 时展示
- 繁育单犬上下文统一用 `BBreedingContextCard`，卡片自身承载“选择种母”标题；外层不再额外加“选择种母”字段 label；多犬发情批量创建继续用 `BDogPicker multiple` 并保留外层字段 label
- 繁育上下文卡副信息只表达候选范围或周期信息，如 `发情中的种母`、`未配种的种母`、`怀孕中的种母`、`发情中或怀孕中的种母`；不得使用“选择后显示繁育周期信息”这类实现说明
- 繁育上下文阶段标签按周期 context 优先计算，发情显示 `发情第N天`，怀孕显示 `怀孕第N天`；只有周期 context 缺失时才退回犬只状态粗标签
- 繁育字段标题不使用小圆点；小圆点只用于详情页/页面中的大分区标题，如 `核心信息`、`关联信息`
- 犬只头像颜色语义固定：种母/母犬用 `linear-gradient(135deg, var(--rose), var(--amber))`，种公/外部种公用蓝色，幼崽用琥珀/幼崽语义色；主按钮和选中态纯粉不等同于种母头像色
- 详情页首屏优先可见可点；避免遮挡内容的 sticky / 负 margin；操作入口收口为一个稳定主操作入口 + 一个 more
- `/pages/profile/index` 定位为犬舍总览页；原“我的”菜单收纳进左侧抽屉
- 路由参数改口径时保留旧入口兼容，至少兼容 `recordId/record_id`、`taskId/task_id/medication_task_id`、`cycleId/cycle_id`

## 改动 Checklist

- 改首页：核对固定结构、红点口径、提交承接、防闪回、latest token、suppression
- 改按钮 / 表单 CTA：核对是否使用 `BButton` / `BSubmitButton` 或公共 token，校验型暗态是否可点击 toast，提交中/系统忙碌是否仍为真 `disabled`
- 改 local-first / 同步：核对 scope registry、TTL、active scope、collection cursor、scope freshness、outbox flush、Network 请求数量
- 改缓存 / 会话隔离：核对所有 `uni.setStorageSync/getStorageSync`、Pinia 持久化、local meta、短时反馈与路由预填是否带 `familyId`
- 改繁育 / 健康 / 用药：核对任务生成条件、状态推进、唯一性约束、记录表单验收、终态展示联动
- 改销售：核对候选过滤、进行中唯一性、未结算退款拦截、金额边界、列表/详情归一化
- 改登录 / 家庭成员：核对登录口径、一键登录兜底、验证码链路、300 秒倒计时、测试码手动输入、找回密码单页流、短信防刷云端原子占位、密码规则、协议展示、`families.members.nickname`
- 改家庭协作 / 云对象 / 详情页刷新：核对 `operation_logs`、多集合写入边界、北京时间按天换算、重复请求与 latest token、云对象 `package.json` 公共依赖、云端函数日志
- 改云数据库索引：核对 `.index.json` 与查询排序一致；新增索引先部署新索引，旧索引只通过控制台清理
- 改图片 / 附件：核对本地持久保存、目标体积压缩、云 fileID 解析、`image_cache_entries` 命中、`pending_upload`、失效重选、上传去重、outbox 引用替换

## 测试 / 验收

- 常规回归：`pnpm type-check`、`pnpm test`
- `tests/` 是开发/CI 护栏，不进入正式 app 包；源码约束和边界测试需随功能保留
- Local-First 必测：`tests/localdb`、核心云对象 `_sync` 幂等测试、页面 source contract
- 改 runtime mutation 必测：`pnpm test tests/localdb/source-contract.test.ts tests/localdb/repository.test.ts tests/localdb/runtime-outbox.test.ts`
- 改 runtime mutation 必须确认 `src/localdb/runtime/*-mutations.ts` 无 `localDb.transact(`、`runLocalMutation(`、`upsertLocalRows(`、`localDb.upsertRows(`、`tables.*`
- 在线优先边界必测：`tests/utils/onlineFirstBoundary.test.ts`
- 账号会话缓存隔离必测：`tests/utils/cacheIsolation.test.ts`、`tests/utils/authSessionSwitch.test.ts`，涉及同步元数据时补 `tests/localdb/runtime-outbox.test.ts`
- 操作日志缓存必测：`tests/utils/operationLogCache.test.ts`
- 图片附件必测：`tests/utils/imageAttachment.test.ts`、`tests/utils/imageUploadFlow.test.ts`、`tests/localdb/runtime-outbox.test.ts`、`tests/utils/backupPage.test.ts`、`tests/localdb/repository.test.ts`
- Network 验收：进入首页不拉非首页 scope；TTL 内切页不重复 pull；同一 scope 并发只发一个请求；手动刷新只强制当前 scope

## graphify

- 做架构或代码结构判断前先看 `graphify-out/GRAPH_REPORT.md`
- 业务域明确时优先看 `graphify/worksets/`
- 高频 workset：`home-attention`、`breeding-record`、`health-medication`、`shared-form-system`、`finance`、`dog-profile`、`family-auth`、`sales-flow`、`health-ops`
- 可用 `./scripts/graphify-workset.sh show <workset>` 查看范围
- 若 `graphify-out/graph.json` 缺失，先在仓库根目录执行 `$graphify .`
- 仅在本次会话修改了代码文件后，才需要执行 `./scripts/graphify-rebuild.sh`
