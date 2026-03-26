# 宠物繁育管理 APP

## 项目概述

个人使用的犬类繁育管理工具，管理 30-50 只马尔济斯犬。使用 Claude Code 进行 AI 辅助开发。

## 设计文档

所有已确认的设计文档位于 `docs/design/`：
- `01-overview-and-data-model.md` — 产品概述 + 完整数据模型
- `02-financial-and-sales.md` — 财务模块 + 销售模块
- `03-home-screen-and-reminders.md` — 首页设计 + 提醒系统 + 状态系统
- `04-collaboration-and-navigation.md` — 协作权限 + 导航结构 + 决策日志
- `05-tech-stack.md` — 技术选型 + 费用估算 + 图片上传规范
- `06-unicloud-validation.md` — UniCloud 技术验证报告
- `07-design-audit.md` — 设计审查报告（已完成，所有问题已修复）

## 技术栈

- 前端：UniApp（Vue 3 + TypeScript + Pinia）
- 后端：UniCloud 云对象（支付宝云）
- 数据库：UniCloud MongoDB（14 个集合）
- 推送：UniPush 2.0 / 认证：uni-id / 存储：UniCloud 云存储
- IDE：HBuilderX + Claude Code

## 当前阶段

设计阶段已完成（brainstorming + 技术选型）。下一步：实现计划。开发路径为 Path A（分四批交付）。

## 开发约定

- 代码：变量名/函数名用英文，注释用中文。文档用中文。
- 所有日期使用 timestamp 毫秒数（Number）存储，时区统一北京时间（UTC+8）
- 数据模型变更需先更新设计文档再写代码
- 提交信息使用 conventional commits 格式
- 简单读取走 clientDB/JQL，涉及多集合写入的操作走云对象
- 支持软删除的集合使用 deleted_at 字段（见 01 文档软删除范围矩阵）
- 统计值实时查询计算，不预存（当前规模不需要优化）

## V1 已知限制

- **单家庭模式**：V1 假设一个用户只属于一个家庭。云对象 `_before` 拦截器基于此假设直接从用户信息注入 `familyId`。未来支持多家庭需重构 auth 拦截器。
- **在线优先**：V1 不支持离线操作和冲突解决。需联网使用。

## 重要设计原则

- **先记录，后自动化**：V1 核心是帮用户记录信息，自动化逻辑分阶段添加
- **以注意力单元组织首页**：不是纯犬优先也不是纯事件优先，匹配繁育者实际思维
- **状态语言优于日期语言**：显示「孕期第58天」而非「3月26日」
- **YAGNI**：只做当前确认的需求，不提前设计未讨论的功能

## gstack

使用 gstack 的 `/browse` 技能进行所有网页浏览，**永远不要使用 `mcp__claude-in-chrome__*` 工具**。

可用技能：
- `/office-hours` `/plan-ceo-review` `/plan-eng-review` `/plan-design-review`
- `/design-consultation` `/review` `/ship` `/land-and-deploy`
- `/canary` `/benchmark` `/browse` `/qa` `/qa-only`
- `/design-review` `/setup-browser-cookies` `/setup-deploy`
- `/retro` `/investigate` `/document-release` `/codex`
- `/cso` `/careful` `/freeze` `/guard` `/unfreeze` `/gstack-upgrade`

如果 gstack 技能不起作用，运行以下命令重新构建：
```bash
cd .claude/skills/gstack && ./setup
```
