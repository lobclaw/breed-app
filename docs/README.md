# 文档索引

## 目标

这套文档只保留三层：

- `AGENTS.md`：唯一协作入口，包含协作约束、开发口径、当前阶段与任务执行 checklist
- `docs/design/`：产品与工程的长期事实源
- `docs/ROADMAP.md`：当前路线、阶段目标与验收重点

## 当前高频口径

- 除 `families.settings.morning_summary_time` 外，业务日期字段统一使用毫秒级 timestamp，并保留真实时分秒毫秒
- 用户只选择“日期”时，前端按“所选年月日 + 当前本地时分秒毫秒”构造 timestamp
- 任何按“天”消费的逻辑，统一在读取 timestamp 后按北京时间换算日边界，不依赖库里值是零点
- 当前协作主线是 `Local-First Foundation` 收口：页面级 scope、本地事务、`_sync` 幂等 ack、在线优先边界与 Network 验收

## 推荐阅读顺序

### 新会话快速进入

1. `AGENTS.md`
2. `docs/ROADMAP.md`
3. `docs/design/01-data-model.md`
4. `docs/design/03-tech-stack.md`

### 做产品或数据模型判断

1. `docs/design/01-data-model.md`
2. `docs/design/02-features.md`
3. `docs/design/03-tech-stack.md`

### 做实现或验收判断

1. `docs/design/04-implementation.md`
2. `docs/design/05-field-page-mapping.md`
3. `docs/ROADMAP.md`

## 设计文档

- `docs/design/01-data-model.md`：产品范围、核心集合、状态/软删除/日期规则
- `docs/design/02-features.md`：首页、提醒、状态、协作、导航的当前口径
- `docs/design/03-tech-stack.md`：技术栈、集合策略、云对象边界、成本与约束
- `docs/design/04-implementation.md`：当前实现状态、服务边界、测试与近期执行顺序
- `docs/design/05-field-page-mapping.md`：字段归属、页面写入口、核心审计结论

## 路线文档

- `docs/ROADMAP.md`：当前里程碑路线、阶段目标、验收重点、非目标

## 验收文档

- `docs/record-form-acceptance.md`：记录表单统一重构后的手工验收清单

## 归档文档

- `docs/design/archive/06-unicloud-validation.md`

归档文档只保留决策证据，不再作为日常修改入口。其中 `06-unicloud-validation.md` 仅作为历史技术验证记录，现行规则以 `docs/design/03-tech-stack.md` 与 `docs/design/04-implementation.md` 为准。

## 维护规则

- 数据模型变化先改 `01-data-model.md`
- 产品口径变化先改 `02-features.md`
- 技术与架构边界变化先改 `03-tech-stack.md`
- 实现阶段与测试口径变化先改 `04-implementation.md`
- 页面或字段责任变化先改 `05-field-page-mapping.md`
- `AGENTS.md` 是唯一协作入口；其他同类协作文件不再维护
- `AGENTS.md` 只保留协作约束、当前阶段、关键红线与任务执行 checklist，不重复长篇设计内容
