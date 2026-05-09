# 实现计划与当前落点

## 1. 文档用途

本文件只保留三类信息：

1. 当前已经落地的实现边界
2. 仍在持续演进的服务/页面责任
3. 验收与下一步执行顺序

详细路线与阶段目标请看 `docs/ROADMAP.md`。

## 2. 当前实现状态

### 已完成的大块能力

- 犬只档案、详情、状态聚合
- 繁育周期、繁育记录、生产与窝管理
- 健康记录、疾病、连续用药
- 首页四层任务结构
- 财务、收入、销售、代理人
- 家庭与单家庭权限基础

### 当前里程碑

Local-First Foundation：

- 核心业务读写已升级为“本地事务 + outbox + 后台同步”
- `local-first` 页面已统一接入页面级 scope 与 `usePageSync`
- 产品按“本地优先单主端”落地，但同步底座保留升级到多端并发的能力
- 当前剩余重点转为 Network 验收、冲突 UX 与附件失败/重试体验补强

## 3. 服务边界

### `family-service`

负责：

- 创建家庭
- 获取家庭信息
- 更新家庭设置
- 回收站聚合查询
- 回收站恢复与永久删除路由
- 数据备份、导出与安全数据修复
- 在线优先的家庭协作与 `operation_logs`
- 依赖 `_before` 注入 `familyId`
- `operation_logs` schema 尚未部署时，操作日志页静默降级为空列表，不向前端抛 `not found collection`

### `dog-service`

负责：

- 犬只列表与详情聚合
- 创建、编辑、软删除、恢复
- 去向变更与相关约束处理
- 幼崽升级为种狗
- 改名后的冗余字段同步

### `breeding-service`

负责：

- 录入繁育记录
- 自动创建/推进 `breeding_cycles`
- 生产向导与窝创建
- 断奶确认
- 繁育额外安排同次创建
- 繁育成本写入支出

### `health-service`

负责：

- 疫苗/驱虫/疾病记录
- 疾病唯一性校验
- 显式创建健康待办
- 开始、记录、结束连续用药

### `task-service`

负责：

- 任务写操作收口与同步 ack
- 完成、推迟、跳过普通任务
- 每日审计、自动关闭

### `finance-service`

负责：

- 支出、收入、销售记录
- 关联犬只/窝/周期
- 统计汇总与详情展示

## 4. Local-First 底座

### `src/localdb`

负责：

- 本地持久化适配器（SQLite / IndexedDB / fallback）
- 业务集合镜像与系统集合管理
- 本地查询、事务、outbox、sync state、conflict state
- 设备 ID、客户端稳定 ID 与同步元数据

### `sync worker`

负责：

- 顺序重放 `outbox_mutations`
- 离线暂停、指数退避、应用重启恢复、回前台续传
- 写接口 ack 处理与按集合增量拉取
- 冲突记录下沉到 `sync_conflicts`

## 5. 前端边界

### 首页

首页是编排层，负责：

- 从本地实体投影四层工作台、WeekStrip 与日期计数
- latest token 保护
- 迁移期的 suppression 兼容保护
- 本地事务后的即时反馈与后台同步触发
- 首页任务日历继续复用 `BDateTimePicker`，通过纯日期模式与日期计数缓存展示任务红点
- 统一处理路由、banner/弱提示与同步失败兜底

首页不应该：

- 在子组件里直接调用云对象
- 静默截断数据
- 自行拼装远端首页事实

### 表单

当前共识：

- 健康表单继续使用 `BFormOptions`
- 繁育表单使用 `BExtraArrangementSection`
- 提交反馈采用局部 loading + 弱成功反馈；逐步迁移到本地事务优先
- 提交按钮统一走 `默认 / 提交中 / 成功瞬态` 三态，成功瞬态当前统一为 `520ms`
- 下一版本交互优化优先补 `Undo / 可撤销`，重点覆盖首页完成/跳过、销售取消、回收站恢复等短时可逆动作

## 6. 当前接入顺序

### 第一批接入

- 固定四层：`逾期 / 繁育 / 健康 / 用药`
- 首页、WeekStrip、今日计数
- 首页上的完成、推迟、给药、康复、停药等即时动作
- `tasks / medication_tasks / health_records / dogs` 本地镜像与投影
- `task-service / health-service` 首页相关写接口幂等化与 ack 化

### 第二批接入

- 犬只列表、犬只详情、健康与用药详情
- 记录表单的离线创建与客户端稳定 ID
- 财务、回收站与更多增量拉取覆盖面

### 当前收尾状态

- 犬只、繁育、健康、用药、财务、销售、代理人、回收站、配置页均已接入本地读路径
- 核心写路径已收口到本地事务 + outbox，并由各域云对象处理 `_sync` 幂等 ack
- 销售流程已补齐本地候选过滤、列表/详情归一化投影，以及退款/定金取消金额边界的前端、本地事务、云对象三层校验
- 备份页已接入 pending outbox / pending upload 阻断提示
- 同步状态页已接入 pending / failed / conflict / pending upload 统计、当前 active scope、最近同步时间与失败/冲突重试；`flushOutbox` 前会先上传本地附件，成功后替换本地行与 outbox payload 并清除 `pending_upload`
- 低频页面、日期选择器与繁育摘要展示统一读取 timestamp 后按北京时间格式化/计算日历差值，避免海外设备本地时区影响业务日期展示
- 在线优先页已补断网联网提示
- 旧入口 `pages/record/health`、`pages/record/breeding`、`pages/finance/income-add` 已归类为 `redirect-deprecated`

## 7. 当前重点页面

### 核心页面

- `pages/home/index.vue`
- `pages/dog/list.vue`
- `pages/dog/detail.vue`
- `pages/profile/recycle.vue`
- `pages/record/breeding*.vue`
- `pages/record/health*.vue`
- `pages/health/medication*.vue`
- `pages/breeding/litter.vue`
- `pages/finance/*.vue`

### 高风险页面或模块

- 首页本地投影与 `task-service` / `health-service` 同步边界
- `src/localdb` 与 sync worker
- 销售流程的 `listLocalSaleCandidateDogs`、`listLocalSales/getLocalSaleDetail` 归一化、`finance.cancelSale` 本地与云端金额边界
- 用药详情与首页用药卡的一致性
- 疾病记录编辑与唯一性校验
- 批量健康完成后的本地事务与自动记录

## 8. 测试策略

### 必测方向

- 本地事务成功后 UI 立即可见，重启后本地数据仍在
- outbox 重试、重复重放时不重复创建、不重复推进状态
- ack / touchedEntities / version / conflict contract
- 云对象业务约束
- 首页本地投影纯函数行为
- 首页繁育主链本地合成 milestone 不得进入普通任务 suppression，避免未成熟复查后同一合成 id 的下一张卡被隐藏
- 批量健康完成是否真实落 `health_record`
- 首页批量健康卡单只完成后是否保留 `1/2` 等局部进度承接
- 首页批量健康卡是否只在全部完成后整卡退场
- 用药状态排序、漏服判断、批量操作
- WeekStrip 红点与首页可见内容一致性

### 当前建议命令

```bash
pnpm type-check
pnpm test tests/localdb
pnpm test tests/cloud-objects/task-service.test.ts
pnpm test tests/cloud-objects/health-service.test.ts
pnpm test tests/cloud-objects/breeding-service.test.ts
pnpm test
```

## 9. 验收重点

### 首页

- 首屏不等云端首页聚合
- 计数、红点、局部承接、防闪回与本地实体持续一致
- 繁育不被误做成批量完成

### 健康

- 批量完成创建真实记录
- 同类 key 不冲突
- 疾病观察仍留在健康区

### 用药

- 首页与详情页共用同一套状态语义
- 完成、漏服、康复、停药动作口径一致

## 10. 下一步执行顺序

以 `docs/ROADMAP.md` 为准，当前固定顺序：

1. 真实设备 Network 验收与断网/恢复网络回归
2. 多端并发场景与 `_sync` 冲突测试继续补齐
3. 冲突详情处理与人工合并 UX 继续补强
4. 在保持 current contract 的前提下，再评估多端同步升级能力
