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

首页工作台密度自适应优化：

- 不改后端事实源
- 不改首页四层语义
- 通过 workbench adapter 和更轻量的区块呈现提升密度

## 3. 服务边界

### `family-service`

负责：

- 创建家庭
- 获取家庭信息
- 更新家庭设置
- 回收站聚合查询
- 回收站恢复与永久删除路由
- 依赖 `_before` 注入 `familyId`

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

- 首页卡片协议
- 完成、推迟、跳过普通任务
- 日期计数与 WeekStrip 基础数据
- 每日审计、自动关闭

### `finance-service`

负责：

- 支出、收入、销售记录
- 关联犬只/窝/周期
- 统计汇总与详情展示

## 4. 前端边界

### 首页

首页是编排层，负责：

- `loadAll / loadTodayCards / loadDateCounts / loadWeekCache`
- latest token 保护
- suppression 防闪回
- 本地承接与后台刷新
- 首页任务日历继续复用 `BDateTimePicker`，通过纯日期模式与日期计数缓存展示任务红点
- 统一处理路由、云调用、banner/弱提示

首页不应该：

- 在子组件里直接调用云对象
- 静默截断数据
- 自行改写后端事实

### 表单

当前共识：

- 健康表单继续使用 `BFormOptions`
- 繁育表单使用 `BExtraArrangementSection`
- 提交反馈采用局部 loading + 弱成功反馈

## 5. 当前首页工作台的实现方向

### 不变的约束

- 固定四层：`逾期 / 繁育 / 健康 / 用药`
- 不恢复统一任务池
- 不新增首页专属持久化聚合
- 不改 `medication_tasks` 的事实源地位

### 本轮改造方式

1. 保持 `task-service` 输出业务事实
2. 在前端增加纯 workbench adapter
3. 由 adapter 生成 section / group / row / hidden-count 视图模型
4. 首页继续承担副作用与本地承接

## 6. 当前重点页面

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

- 首页与 `task-service`
- 用药详情与首页用药卡的一致性
- 疾病记录编辑与唯一性校验
- 批量健康完成后的局部承接

## 7. 测试策略

### 必测方向

- 云对象业务约束
- 首页 contract 与 adapter 纯函数行为
- 批量健康完成是否真实落 `health_record`
- 用药状态排序、漏服判断、批量操作
- WeekStrip 红点与首页可见内容一致性

### 当前建议命令

```bash
pnpm type-check
pnpm test tests/cloud-objects/task-service.test.ts
pnpm test tests/cloud-objects/health-service.test.ts
pnpm test tests/cloud-objects/breeding-service.test.ts
pnpm test
```

## 8. 验收重点

### 首页

- 大数量任务时不再靠大卡片硬堆
- 计数、红点、局部承接、防闪回保持一致
- 繁育不被误做成批量完成

### 健康

- 批量完成创建真实记录
- 同类 key 不冲突
- 疾病观察仍留在健康区

### 用药

- 首页与详情页共用同一套状态语义
- 完成、漏服、康复、停药动作口径一致

## 9. 下一步执行顺序

以 `docs/ROADMAP.md` 为准，当前固定顺序：

1. Workbench Contract & Test Foundation
2. Breeding Step Workbench
3. Health Batch-First Workbench
4. Medication State Workbench
5. Overdue, Counts & Reconciliation Calibration
6. Today Focus
