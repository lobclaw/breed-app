# 当前路线图

## 当前目标

当前主线是在现有 UniApp + UniCloud 应用之上，完成 `Local-First Foundation` 的最后验收与收口，确保页面级 scope、本地事实源、核心写路径、在线优先边界与测试约束全部稳定。

## 当前里程碑

`Local-First Foundation 收口与验收`

本轮原则：

- 保持“本地数据库是 UI 事实源，云端负责同步校验与幂等 ack”
- 不退回页面直接等云端返回的在线优先交互
- 所有 `local-first` 页面统一走 `usePageSync + scope registry`
- 在线优先边界保持收敛，并在断网时给出明确联网提示

## 固定阶段顺序

1. 页面级 scope 与路由归类稳定
2. 本地读路径与本地事务写路径收口
3. `_sync` 幂等 / 冲突 / tombstone contract 稳定
4. 同步状态 UX 与备份/上传边界收口
5. Network 验收与真实设备回归

## 各阶段目标

### 1. 页面级 scope 与路由归类稳定

- 所有 `local-first` 页面接入 `usePageSync`
- `online-first / static / redirect-deprecated` 边界清晰
- 手动刷新只 force 当前 scope，不放大全局拉取

### 2. 本地读路径与本地事务写路径收口

- 页面、选择器、store 首屏统一读本地 projection
- 核心写操作统一走本地事务 + outbox
- 来源页承接、局部移除与弱成功反馈保持稳定

### 3. `_sync` 幂等 / 冲突 / tombstone contract 稳定

- 核心云对象写方法支持 `clientMutationId / deviceId / baseVersions / clientTimestamp`
- 重放不重复创建、不重复推进、不复活 tombstone
- 冲突时保留本地结果并记录到 `sync_conflicts`

### 4. 同步状态 UX 与备份/上传边界收口

- 同步状态至少覆盖 `pending / failed / conflict / pendingUpload`
- 备份导出在存在 pending outbox / pending upload 时明确阻止继续；同步前先尝试上传本地附件并替换 outbox payload
- 在线优先页断网时明确提示“当前功能需要联网”

### 5. Network 验收与真实设备回归

- 首页不预拉非首页 scope
- TTL 内切页不重复 pull，同 scope 并发只发一个请求
- 断网写入立即可见，恢复网络后自动 flush 并应用 ack

## 当前非目标

- 重做数据模型
- 新增远端首页事实源
- 提前扩展到多家庭 SaaS 模型
- 第一版就完成复杂 CRDT 或自动冲突合并
- 复杂附件管理超出 `pending_upload` 第一版边界：如删除云文件、压缩转码、进度条、多文件并发控制

## 当前验收重点

### Local-First 一致性

- 页面进入统一执行：active scope → 本地渲染 → 后台 sync
- 记录页返回后先本地承接再刷新
- outbox 重放、冲突记录、tombstone 删除链路保持一致
- 销售流程需覆盖本地候选过滤、列表/详情归一化、未结算退款拦截、退款与定金取消金额边界

### 在线优先边界

- 家庭协作、`operation_logs`、备份、账号资料与上传继续在线优先
- 断网时直接提示联网要求，不用超时错误替代

### Network 行为

- 首页只拉首页 scope
- 财务/销售/配置列表遵守自己的 TTL
- 手动刷新只针对当前页面 scope 生效

## 更新规则

- 路线变化时先更新本文件
- 如果变化涉及产品规则，再同步更新 `docs/design/02-features.md`
- 如果变化涉及工程边界，再同步更新 `docs/design/03-tech-stack.md` 与 `docs/design/04-implementation.md`
