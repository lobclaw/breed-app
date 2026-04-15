# 宠物繁育管理 APP

## What This Is

这是一个个人使用的犬类繁育管理工具，服务于 30-50 只马尔济斯犬的日常管理、繁育流程、健康提醒、用药疗程、财务销售和家庭协作。项目已经是一个运行中的 UniApp + UniCloud brownfield 应用，当前 GSD 初始化的重点不是从零建设，而是把后续迭代纳入可持续规划。

当前最重要的产品方向是把首页从“卡片直出列表”升级为更适合大数量犬群的工作台：保留 `逾期 / 繁育 / 健康 / 用药` 四层语义，同时在区块内部按数量和业务性质自适应展示。

## Core Value

让繁育者每天打开首页时，能快速知道最该处理什么，并且处理动作会可靠地回写到真实记录。

## Requirements

### Validated

- ✓ 犬只档案可管理犬只基础信息、角色、去向、状态和详情聚合 — existing
- ✓ 繁育记录已形成周期驱动流程，支持发情、卵泡、配种、孕检、生产、断奶和异常终止 — existing
- ✓ 健康记录支持疫苗、驱虫、疾病、体重和连续用药 — existing
- ✓ 首页已按 `逾期 / 繁育 / 健康 / 用药` 分层展示，不再使用单一待办池 — existing
- ✓ 健康提醒已改为建议型，疫苗/驱虫默认只计算建议日期，显式创建才生成下次待办 — existing
- ✓ 繁育流程已改为推进器，主流程由后端记录驱动自动推进 — existing
- ✓ 繁育表单支持 `额外安排`，并在首页繁育区单独子层展示 — existing
- ✓ 用药疗程使用 `medication_tasks` 作为事实源，和普通健康提醒分离 — existing
- ✓ 批量健康卡完成时会创建真实 `health_record`，不只是标记 task completed — existing
- ✓ 财务和销售模块已具备支出、收入、销售记录、代理人和统计入口 — existing
- ✓ 家庭、成员、角色、邀请和单家庭鉴权基础已接入 — existing
- ✓ 设计文档、代码库地图和 graphify 工作集已建立，可支持后续 AI 辅助迭代 — existing

### Active

- [ ] 首页繁育区从大卡片直出升级为“流程步骤分组 + 单犬/单窝轻量行”，不再出现批量完成心智。
- [ ] 首页健康区保留真正适合批量处理的批量卡，并在同类数量较多时优先展示批量组。
- [ ] 首页用药区按未完成、部分完成、已完成组织，未完成置顶，已完成弱化或折叠。
- [ ] 首页增加“今日重点”，从逾期、繁育、健康和用药中抽取最重要的 3-5 件事。
- [ ] 首页密度自适应：大数量任务时避免无限大卡片列表，少量任务时保持直观展开。
- [ ] 首页工作台改造不得破坏现有乐观移除、suppression、防闪回和 WeekStrip 红点规则。

### Out of Scope

- 二级页、Sheet 或摘要卡整体重做 — 当前已明确短期不做，先保留首页直出框架并做区块内部渐进优化。
- 完整日历模块替代 WeekStrip — 当前首页继续使用周历条，月历展开暂不作为本轮重点。
- 重新设计全局数据模型 — 本轮以现有 `tasks`、`medication_tasks`、`breeding_cycles`、`health_records` 为事实源收口，不做大迁移。
- 生产页 birth wizard 接入额外安排 — 已明确本期不接入，生产后的安排留给窝上下文处理。
- 普通养宠用户模式、会员体系、广告、增值服务、微信小程序、AI 助手、电子合同、血统关系图 — V1 明确不做。

## Context

项目由 Claude Code 起步开发，后续迁移到 Codex 继续迭代。当前代码库采用 UniApp Vue 3 前端与 UniCloud 支付宝云对象后端，业务服务集中在 `dog-service`、`breeding-service`、`health-service`、`finance-service`、`task-service`、`family-service`。

已确认的产品设计文档在 `docs/design/`，代码库地图在 `.planning/codebase/`，graphify 输出在 `graphify-out/`，并配置了 `home-attention`、`breeding-record`、`health-medication` 等重点 workset。架构判断和大范围修改前应优先读取这些资料。

最近一轮首页任务系统已经完成多项关键收口：健康提醒建议型、繁育流程推进器、额外安排、疾病/用药分流、颜色按业务域统一、健康批量卡真实落记录、首页短期抑制防闪回。后续优化应建立在这些规则之上，避免回到“统一待办池”或“所有内容批量卡化”的旧模型。

代码库关注点包括：首页页面和 `task-service` 文件较大，首页乐观状态与后台刷新容易产生闪回，时间边界需要注意北京时间口径，云对象多集合写入缺少事务，前端页面/组件工作流测试不足。

## Constraints

- **Tech stack**: 继续使用 UniApp Vue 3 + TypeScript + Pinia + UniCloud 支付宝云对象 — 已有代码、部署和文档都基于该栈。
- **Data scope**: V1 面向单家庭、30-50 只犬 — 不提前扩展为多家庭、多租户 SaaS 或普通养宠用户模式。
- **Date handling**: 所有业务日期使用 timestamp 毫秒数，显示与判断按北京时间 UTC+8 — 避免逾期天数和红点错位。
- **Homepage contract**: 首页固定四层 `逾期 / 繁育 / 健康 / 用药` — 不恢复统一待办池，不把疾病观察伪装成用药。
- **Health reminders**: 疫苗/驱虫默认只建议，不静默续链 — 只有用户显式创建才生成下次待办。
- **Breeding workflow**: 主流程由记录驱动自动推进，额外安排只是手动附加事项 — 完成额外安排不得改变状态机。
- **Medication source**: 用药疗程以 `medication_tasks` 为事实源 — 不再依赖旧 `tasks(type='medication')` 作为主数据。
- **Implementation safety**: 修改首页时必须保留 latest token、suppression、局部承接、批量卡元数据同步和 WeekStrip 红点同步规则 — 这些是防闪回和防错计数的关键保护。
- **Documentation**: 数据模型变更先更新设计文档；代码变更后重建 graphify — 保持后续会话可接续。

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 首页固定按 `逾期 / 繁育 / 健康 / 用药` 分层 | 用户注意力先按事情性质分配，比统一待办池更清楚 | ✓ Good |
| 健康提醒改为建议型 | 避免系统无声铺未来链，减少误提醒和误完成 | ✓ Good |
| 繁育主链改为流程推进器 | 繁育不是普通待办，而是一条记录驱动的业务流程 | ✓ Good |
| 繁育表单使用 `额外安排`，不再用“下次提醒” | 主流程自动推进，用户手动事项应和主链语义分离 | ✓ Good |
| 用药恢复紫色、健康使用蓝色、繁育使用琥珀、逾期使用红色 | 颜色按业务域统一，减少旧卡片类型驱动的视觉混乱 | ✓ Good |
| 后续首页方向为“分层首页 + 区块内工作台 + 密度自适应” | 面对 20+ 繁育计划、20+ 健康提醒、10+ 用药提醒时，大卡片直出空间效率不足 | — Pending |
| 当前 GSD 活跃目标聚焦 TODO-29 首页工作台密度自适应优化 | 项目已有 Phase 1 功能，GSD 初始化应服务下一阶段而不是重做既有路线 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-15 after initialization*
