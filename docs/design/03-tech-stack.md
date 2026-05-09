# 技术选型

## 1. 当前技术栈

| 层级 | 选择 |
|------|------|
| 前端 | UniApp + Vue 3 + TypeScript |
| 状态管理 | Pinia + composables + `src/localdb` |
| 本地持久化 | App 端 SQLite 适配器；H5 / 开发环境 IndexedDB 适配器；受限环境回退内存/`uni` storage |
| 后端 | UniCloud 云对象（支付宝云） |
| 数据库 | UniCloud MongoDB |
| 认证 | uni-id |
| 推送 | UniPush 2.0 |
| 存储 | UniCloud 云存储 |
| 工具 | HBuilderX + Codex |

## 2. 选型结论

### 为什么继续用 UniCloud

- 当前规模低成本甚至可接近 0 元
- 省掉服务器、鉴权、存储、推送的单独运维
- 现有代码、部署、文档已围绕 UniCloud 成形

### 为什么接受 MongoDB

- 当前数据量小，聚合与实时查询足够
- 通过冗余展示字段、预生成任务、服务端收口状态推进来弥补关系能力不足
- 比起提前设计复杂统计缓存，实时计算更稳

### 为什么继续用 UniApp

- 与 UniCloud、clientDB、UniPush、uni-id 的整合成本最低
- 现有应用已经落地
- 当前业务并不需要切到更重的原生方案

## 3. 当前架构分工

### 前端

- 页面负责展示、路由与本地事务后的即时反馈
- 共享组件负责一致 UI 与交互
- Pinia 只保留 UI 状态、轻量派生状态与页面间临时桥接
- `src/localdb` 负责业务事实源、本地查询、outbox 与同步状态
- composables 负责页面级逻辑抽离与 local-first runtime 编排

### 后端

- 云对象负责多集合写入、状态推进、权限兜底、批量操作与同步 ack
- `_before` 拦截器负责鉴权与 `familyId` 注入
- 定时任务负责每日审计和自动关闭

### 查询边界

| 场景 | 方式 |
|------|------|
| 页面读取 | 本地 `localdb` 查询 / 本地投影 |
| 增量拉取 | clientDB / JQL，必要时补窄接口 |
| 多集合写入 | 云对象 |
| 业务状态推进 | 云对象 |
| outbox 重放 | sync worker 直接调用各域现有云对象写方法 |

## 4. 数据库策略

### 4.1 当前集合

14 个主要业务集合：

- `dogs`
- `breeding_cycles`
- `litters`
- `breeding_records`
- `health_records`
- `medication_tasks`
- `tasks`
- `expenses`
- `incomes`
- `sale_records`
- `families`
- `agents`
- `dog_weights`
- `medication_protocols`

本地系统集合：

- `outbox_mutations`
- `sync_state`
- `sync_conflicts`
- `local_meta`

### 4.2 MongoDB 适配策略

- 同类记录合并集合，类型差异收口到 `details`
- 冗余高频展示字段，减少 JOIN
- 首页继续使用 `tasks` / `medication_tasks` / `health_records` / 繁育集合做本地投影，不新增远端首页事实表
- 犬只状态与统计值实时推导，不预存
- 多犬费用用数组存储，不设计额外关联表

### 4.3 本地镜像策略

- 核心业务集合本地全量镜像；页面默认从本地镜像读
- 同步以 `updated_at` 增量拉取，以 `deleted_at` tombstone 收口删除
- 所有同步管理对象补充 `version`，客户端按 `baseVersions` 做乐观并发校验
- 客户端新增实体先生成稳定 `_id`，保证离线创建可先建立关联

### 4.4 索引方向

优先保障：

- 首页按家庭 + 状态 + 日期查询
- 犬只列表按家庭 + 去向 + 角色查询
- 记录列表按 `dog_id` / `cycle_id` / `date` 查询
- 财务列表按家庭 + 日期查询

## 5. 云对象与事务约束

### 5.1 原则

- 云对象方法是写操作的唯一收口
- 方法间不要互调
- 权限判断在 `_before` 收口
- 所有写接口统一支持可选 `_sync` 元数据：`clientMutationId`、`deviceId`、`baseVersions`、`clientTimestamp`
- 所有写接口统一返回 `ack / clientMutationId / touchedEntities / resyncScopes / conflict`
- 同一个 `clientMutationId` 重放时必须幂等
- 云函数内禁止使用未定义常量
- 毫秒常量直接写字面量 `86400000`，不要定义全局 `DAY_MS`

### 5.2 风险

- 支付宝云事务能力有限，不能假设复杂跨集合事务天然可用
- 幼崽批量创建、大批量状态迁移要按可回滚步骤设计
- 多集合写入后需补验证与审计，而不是只依赖一次提交成功
- 首版按“单主端优先”落地，但底座必须保留升级到多端并发同步的能力

## 6. 本地优先运行时

### 6.1 写路径

- 所有本地优先写操作先执行本地事务：改本地实体、写 outbox、立即刷新 UI
- sync worker 顺序重放 outbox，支持离线暂停、指数退避、前后台切换续传与应用重启恢复
- 幂等依赖 `clientMutationId`；append-only 创建依赖客户端 `_id` + mutation 幂等

### 6.2 拉取路径

- 应用启动、回到前台、网络恢复、写入 ack 后按集合增量拉取
- `local-first` 页面统一通过 `usePageSync` 接入 active scope、TTL、手动刷新与后台校正
- 旧兼容入口可归类为 `redirect-deprecated`，只做跳转承接，不再承担真实同步责任
- 若某集合 clientDB/JQL 无法安全做增量拉取，则只为该域补最小同步接口，不新增通用 sync-service
- 家庭协作、邀请、角色、登录鉴权、`operation_logs` 保持在线优先，不进入第一版离线写入
- 在线优先页面断网时直接提示“当前功能需要联网”，避免等待云调用超时后再模糊报错
- 在线优先页可做只读缓存兜底：家庭成员页展示已缓存家庭信息，操作日志页展示本地 pending 操作与最近云端日志缓存，备份页展示最近备份信息/历史
- 所有会改变云端状态的在线优先动作仍必须先通过统一联网守卫，不写入 outbox，不做本地乐观提交
- 操作日志缓存签名使用稳定 `rangeKey + actorUserIds + actionTypes`；云端查询可继续使用实时 `start/end`，但缓存匹配不得写入动态 `Date.now()` 结果

## 7. 首页与提醒架构

### 7.1 首页事实源

- 普通待办与提醒：`tasks`
- 连续用药与当天剂量状态：`medication_tasks`
- 犬只状态：`breeding_cycles + health_records + medication_tasks`
- 首页四层由本地实体投影得到；远端不再作为首页交互事实源

### 7.2 关键保护

- 首页保持 `latestLoadToken`
- 迁移期允许 `suppression` 兼容，但最终以本地实体真实状态消除闪回
- WeekStrip 红点不能依赖 `counts.today`
- 批量健康完成必须创建真实 `health_record`

## 8. 日期与删除规则

- 所有日期统一为毫秒时间戳
- 时区统一按 UTC+8
- 业务日期字段允许保留真实时分秒毫秒；不要要求业务写入统一归零点
- 任何按“天”查询、统计、分组、红点、逾期判断，统一在读取 timestamp 后按北京时间起止边界计算
- 软删除统一用 `deleted_at`
- 支持软删除的集合只用于可恢复场景，不用于真实业务历史

## 9. 前端约束

- 公共样式走 `src/styles/common.scss`
- 页面只写差异样式
- 表单互斥选择统一使用 pill-select
- 弹层打开时锁定滚动
- 表单提交反馈统一为局部 loading + 弱成功反馈
- 表单主 CTA 统一支持 `默认 / 提交中 / 成功瞬态` 三态，成功瞬态当前口径为 `520ms`
- 业务图片附件遵循 Local-First：选择后先压缩并保存本地持久引用，业务记录立即保存；同步前再通过 `uniCloud.uploadFile` 上传并回填云 `fileID`
- 普通业务图片目标 `<=350KB`；健康/繁育记录图片目标 `<=450KB`；头像目标 `<=180KB`
- 云存储 `fileID` 不直接作为 `<image>` / `previewImage` 地址使用；展示前统一走 `resolveImageDisplayUrl(s)`，优先命中 `image_cache_entries` 本地缓存，未命中批量取云端临时 URL 并 best-effort 回填缓存
- Local-First 页面同步按当前 scope 批量拉取集合，首页只同步首页集合；非首页数据进入对应页面后再同步
- 下一阶段对短时可逆动作优先补 `Undo / 可撤销`，不回退为强 success toast 驱动

## 10. 成本结论

当前自用和小规模协作场景下，UniCloud 成本可接受，优先级高于迁移。只有在明显超出当前使用规模时，才评估迁移到自建或其他 BaaS。

## 11. 当前不做

- 退回到在线优先交互
- 引入新的远端首页事实源或持久化 workbench 聚合
- 为统计或状态增加预存缓存表
- 为 V1 提前设计多家庭 SaaS 架构
- 把家庭协作写入、邀请、角色变更、`operation_logs` 纳入第一版离线写入
