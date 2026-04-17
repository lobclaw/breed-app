# 宠物繁育管理 APP

## 项目概述

个人使用的犬类繁育管理工具，管理 30-50 只马尔济斯犬。当前是一个持续迭代中的 UniApp + UniCloud 应用，使用精简的正式文档体系维护上下文。

## 文档入口

- 总索引：`docs/README.md`
- 路线图：`docs/ROADMAP.md`
- 产品事实源：`docs/design/01-data-model.md`、`docs/design/02-features.md`
- 工程事实源：`docs/design/03-tech-stack.md`、`docs/design/04-implementation.md`
- 字段/页面映射：`docs/design/05-field-page-mapping.md`

## 技术栈

- 前端：UniApp（Vue 3 + TypeScript + Pinia）
- 后端：UniCloud 云对象（支付宝云）
- 数据库：UniCloud MongoDB
- 推送：UniPush 2.0 / 认证：uni-id / 存储：UniCloud 云存储
- IDE：HBuilderX + Codex / Claude Code

## 当前阶段

Phase 1 功能 + 性能优化完成，当前进入验收测试与首页工作台密度优化阶段。

## 当前路线

- 当前里程碑：`首页工作台密度自适应优化`
- 当前焦点：Phase 1 `Workbench Contract & Test Foundation`
- 固定顺序：契约/测试底座 → 繁育步骤工作台 → 健康批量优先工作台 → 用药状态工作台 → 逾期/计数/防闪回校准 → 今日重点

## 开发约定

- 代码：变量名/函数名用英文，注释用中文。文档用中文。
- 所有日期使用 timestamp 毫秒数（Number）存储，时区统一北京时间（UTC+8）。
- 数据模型变更需先更新设计文档再写代码。
- 提交信息使用 conventional commits。
- 简单读取走 clientDB/JQL，涉及多集合写入的操作走云对象。
- 支持软删除的集合使用 `deleted_at` 字段。
- 统计值实时查询计算，不预存。

## 关键约束

- 首页固定四层：`逾期 / 繁育 / 健康 / 用药`
- 健康提醒默认只建议，不静默续链
- 繁育主流程由记录驱动自动推进，额外安排不改变状态机
- 用药以 `medication_tasks` 为事实源
- 首页加载链路必须保留 latest token、suppression、局部承接与 WeekStrip 红点同步规则

## graphify

- 架构判断前先看 `graphify-out/GRAPH_REPORT.md`
- 业务域明确时优先使用 `graphify/worksets/`
- 修改代码文件后运行 `./scripts/graphify-rebuild.sh`
