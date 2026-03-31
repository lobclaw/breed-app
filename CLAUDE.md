# 宠物繁育管理 APP

## 项目概述

个人使用的犬类繁育管理工具，管理 30-50 只马尔济斯犬。使用 Claude Code 进行 AI 辅助开发。

## 设计文档

所有已确认的设计文档位于 `docs/design/`：
- `01-data-model.md` — 产品概述 + 完整数据模型 + 财务/销售/收入模块 + 统计报表
- `02-features.md` — 首页设计 + 提醒系统 + 状态系统 + 协作权限 + 导航结构 + 决策日志
- `03-tech-stack.md` — 技术选型 + 费用估算 + 图片上传规范
- `04-implementation.md` — Phase 1 实现计划（后端云对象 + 前端 UI 组件库 + 页面还原）
- `05-field-page-mapping.md` — 字段-页面映射 + 实现审计结果
- `archive/06-unicloud-validation.md` — UniCloud 技术验证报告（已归档）
- `archive/07-design-audit.md` — 设计审查报告（已归档，所有问题已修复）

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

### 样式约定

- **common.scss 全局导入**：所有公共样式（输入框、字段组、固定底部按钮、信息行等）定义在 `src/styles/common.scss`，通过 `App.vue` 全局导入。页面 scoped style 仅写差异部分，禁止重复定义。
- **BFormOptions 组件**：所有记录表单（繁育/健康/财务）统一使用 `BFormOptions` 组件，封装"标记为待办"开关 + 日期选择（今天/明天/后天 chips）+ "下次提醒"开关。
- **Pill 选择器 vs 分段控件**：表单中的互斥选项（如生产方式、驱虫类型）使用 pill-select 样式（card-dim 背景、无边框、胶囊圆角）；Segmented Control 仅用于视图/标签页切换（如"疫苗/驱虫/疾病" tab）。
- **滚动锁定**：BSheet、BModal、BDeleteConfirm 打开时锁定页面滚动。
- **box-sizing**：全局设置 `box-sizing: border-box`（App.vue）。

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
