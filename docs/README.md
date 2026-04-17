# 文档索引

## 目标

这套文档只保留三层：

- `AGENTS.md`：协作约束、开发口径、当前非代码规则
- `docs/design/`：产品与工程的长期事实源
- `docs/ROADMAP.md`：当前路线、阶段目标与验收重点

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

## 归档文档

- `docs/design/archive/06-unicloud-validation.md`
- `docs/design/archive/07-design-audit.md`

归档文档只保留决策证据，不再作为日常修改入口。

## 维护规则

- 数据模型变化先改 `01-data-model.md`
- 产品口径变化先改 `02-features.md`
- 技术与架构边界变化先改 `03-tech-stack.md`
- 实现阶段与测试口径变化先改 `04-implementation.md`
- 页面或字段责任变化先改 `05-field-page-mapping.md`
- `AGENTS.md` 只保留摘要和协作约束，不重复长篇设计内容
