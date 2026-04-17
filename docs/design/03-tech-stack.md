# 技术选型

## 1. 当前技术栈

| 层级 | 选择 |
|------|------|
| 前端 | UniApp + Vue 3 + TypeScript |
| 状态管理 | Pinia + composables |
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

- 页面负责展示、路由、本地状态承接、乐观更新
- 共享组件负责一致 UI 与交互
- composables 负责页面级逻辑抽离

### 后端

- 云对象负责多集合写入、状态推进、权限兜底、批量操作
- `_before` 拦截器负责鉴权与 `familyId` 注入
- 定时任务负责每日审计和自动关闭

### 查询边界

| 场景 | 方式 |
|------|------|
| 简单读取 | clientDB / JQL |
| 多集合写入 | 云对象 |
| 业务状态推进 | 云对象 |
| 首页聚合与批量操作 | 云对象 |

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

### 4.2 MongoDB 适配策略

- 同类记录合并集合，类型差异收口到 `details`
- 冗余高频展示字段，减少 JOIN
- 首页使用预生成 `tasks`
- 犬只状态与统计值实时推导，不预存
- 多犬费用用数组存储，不设计额外关联表

### 4.3 索引方向

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

### 5.2 风险

- 支付宝云事务能力有限，不能假设复杂跨集合事务天然可用
- 幼崽批量创建、大批量状态迁移要按可回滚步骤设计
- 多集合写入后需补验证与审计，而不是只依赖一次提交成功

## 6. 首页与提醒架构

### 6.1 首页事实源

- 普通待办与提醒：`tasks`
- 连续用药与当天剂量状态：`medication_tasks`
- 犬只状态：`breeding_cycles + health_records + medication_tasks`

### 6.2 关键保护

- 首页保持 `latestLoadToken`
- 本地乐观承接后使用 suppression 防闪回
- WeekStrip 红点不能依赖 `counts.today`
- 批量健康完成必须创建真实 `health_record`

## 7. 日期与删除规则

- 所有日期统一为毫秒时间戳
- 时区统一按 UTC+8
- 软删除统一用 `deleted_at`
- 支持软删除的集合只用于可恢复场景，不用于真实业务历史

## 8. 前端约束

- 公共样式走 `src/styles/common.scss`
- 页面只写差异样式
- 表单互斥选择统一使用 pill-select
- 弹层打开时锁定滚动
- 表单提交反馈统一为局部 loading + 弱成功反馈

## 9. 成本结论

当前自用和小规模协作场景下，UniCloud 成本可接受，优先级高于迁移。只有在明显超出当前使用规模时，才评估迁移到自建或其他 BaaS。

## 10. 当前不做

- 新增运行时依赖来重构首页
- 引入新的首页事实源或持久化 workbench 聚合
- 为统计或状态增加预存缓存表
- 为 V1 提前设计多家庭 SaaS 架构
