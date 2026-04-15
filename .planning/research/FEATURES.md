# Feature Landscape: 首页工作台密度自适应

**Domain:** 犬舍繁育管理 App 首页工作台
**Milestone:** 分层首页 + 区块内工作台 + 密度自适应
**Researched:** 2026-04-15
**Confidence:** HIGH for local product rules and current code constraints; MEDIUM for exact numeric thresholds until UI prototype/UAT confirms density.

## Scope Decision

本里程碑应解决一个具体问题：30-50 只犬同时产生大量繁育、健康和用药事项时，首页不能继续无限堆大卡片，但也不能退回摘要卡、二级页、Sheet 或统一待办池。

推荐产品口径：保留顶部 pills 与正文四层 `逾期 / 繁育 / 健康 / 用药`，只改造每个区块内部的展示密度、分组、排序和折叠。少量事项仍直接展开；大量同类事项改为工作台式分组和轻量行；所有被折叠内容必须有明确数量和可展开入口，禁止静默截断。

## Table Stakes For This Milestone

这些是本里程碑必须交付的用户可见行为。缺少任一项，TODO-29 的核心目标就没有完成。

| Feature | Required Behavior | Testable Acceptance | Notes |
|---------|-------------------|---------------------|-------|
| 四层首页壳保持不变 | 顶部 pills 仍为 `逾期 / 繁育 / 健康 / 用药`；正文顺序仍为 `逾期待处理 → 繁育流程 → 健康提醒 → 今日用药` | 给定四类卡片同时存在时，页面顺序和 pill 文案不变；点击 pill 滚动到对应区块 | 不新增统一“今日待办”池 |
| 区块级密度状态 | 每个区块支持 `少量展开 / 多量压缩 / 手动展开` 三种状态 | 当区块项目数超过阈值时，默认只展示前 N 项并显示“还有 X 项”；点击后在原区块内展开，不跳转 | 建议初始阈值：逾期 3，繁育每步骤 4，健康每批量组 4，用药未完成全显、已完成折叠 |
| 无静默截断 | 所有隐藏项必须通过“还有 X 项/只”显式暴露 | 构造 20 张卡片时，DOM/数据层仍保留完整数量，UI 显示隐藏数量；不得出现 `slice(0, 12)` 这类无提示截断 | 可以限制默认可见项，但不能丢数据或不告知 |
| 逾期区轻量压缩 | 逾期少量时大卡片展开；逾期多量时展示最严重前 3 条 + 展开入口 | 逾期 5 条时默认显示 3 条，排序为逾期天数降序、同天按 due_date 升序；展开后显示全部 | 逾期仍是提醒，不做惩罚式全屏警告 |
| 繁育流程按步骤分组 | 繁育主流程不再以散乱大卡片直出，改为按步骤分组：`建议卵泡检查 / 配种相关 / 建议孕检 / 待生产 / 确认断奶` 等 | 给定多个 `breeding_milestone.details.step_type`，页面按 step_type 分组；每组内为单犬/单窝轻量行 | 分组名可随现有状态机细化，但必须来自流程步骤，不按日期粗暴分组 |
| 繁育行是推进入口 | 繁育组内每一行代表一只犬或一窝，展示犬名/窝名、状态语言、到期/逾期、下一动作 | 点击 `follicle_check` 行进入卵泡页；`pregnancy_check` 进入孕检页；`weaning_confirm` 进入窝详情页；参数含 `dogId + dogName + cycleId + taskId + locked=true` | 保留现有路线规则 |
| 繁育不批量完成 | 繁育主流程行不显示 checkbox 或“批量完成” | 多个同步骤繁育任务出现时，只能逐犬/逐窝进入记录或对单项推迟/跳过 | 繁育是记录驱动流程，不是批量待办 |
| 额外安排独立子层 | `breeding_extra_arrangement` 仍在繁育区，但放在“额外安排”子层，不混入主流程或健康 | 给定主流程 + 额外安排，繁育区显示两个子层；完成额外安排不创建 `breeding_record`，不改变周期状态 | 额外安排可用轻量行，允许完成/推迟/跳过 |
| 健康区保留批量价值 | 疫苗/驱虫同类、同天、同子类型/药名、2 只以上时优先显示批量组；单犬事项显示轻量行或单犬卡 | 给定同天不同 vaccine_type，不合并；同天同 deworming_type 但 drug_name 不同，不合并；批量完成创建真实 `health_record` | 批量 key 必须包含子类型，避免冲突 |
| 健康批量部分完成准确回写 | 批量卡部分完成后，只移除后端确认的 `completedTasks`，并同步犬只列表、进度和标题数量 | 5 只批量只完成 2 只后，卡片仍存在，标题/进度变为 3 只待处理；只有全部完成才整卡消失 | 这是当前首页防错核心合同 |
| 疾病观察留在健康区 | `sick_only` 展示为疾病观察，不进入今日用药；多只观察中默认按严重程度压缩 | 给定 4 只观察中犬，默认显示压缩摘要，严重度取最高；展开后每行有处理入口 | 可沿用 `SickObservationCard` 的折叠语义 |
| 用药未完成优先 | 今日用药按 `未完成 → 部分完成 → 已完成` 排序；未完成和部分完成默认展开，已完成默认弱化/折叠 | 给定 3 只未给、2 只部分、5 只已完成，前两组可见，已完成显示“已完成 5 只”折叠入口 | 用药事实源仍是 `medication_tasks` |
| 用药行保留剂次语义 | 单药每日多次保留“给药 X/Y 次”；多药犬可展开子药品；整犬完成和单剂次完成都要有即时反馈 | 点击给药后本地剂次立即变化；后台刷新不闪回；多药犬 partial 状态显示中间态 | 不把多剂次疗程简化成一次 checkbox |
| 计数与红点一致 | pill 计数、区块 badge、WeekStrip 红点都以实际可见工作台数据为准，但不依赖 `counts.today` 判断今日红点 | 今日无卡片时今日红点为 0；有用药卡但服务端 pending tasks 为 0 时仍有红点 | 保留 `latestLoadToken` 和 `dayCounts` Promise.all 后写入规则 |
| 乐观移除与防闪回 | 所有完成、推迟、跳过后的局部承接继续生效，后台刷新不得把刚处理项闪回 | 提交后卡片/行立即变化；2.5 秒 suppression 窗口内服务端旧响应不会复活卡片 | 新的 row/group 也要接入 suppression，而不是只支持旧 card |
| 空状态不退化 | 某区块无内容时不显示空区块；全部为空时显示“犬群一切正常” | 无事项时只有全局空状态；某一区块无事项时 pill count 为 0 且正文不占空白 | 避免密度优化后出现大量空标题 |

## Differentiators / Nice-To-Have Later

这些功能有价值，但不应压进本次核心里程碑，除非 table stakes 已稳定并有剩余容量。

| Feature | Value Proposition | Complexity | Defer Reason |
|---------|-------------------|------------|--------------|
| 今日重点 Top 3-5 | 从逾期、繁育、健康、用药中抽取最重要事项，减少每日首次扫描成本 | Medium | 容易变成新的摘要层；当前规则要求不做摘要卡/二级页/Sheet。先把区块内排序做好 |
| 用户自定义密度 | 用户选择“紧凑/标准/展开”，记住每个区块偏好 | Medium | 需要持久化偏好和更多 UAT；当前先用业务阈值即可 |
| 早晚工作模式 | 上午突出用药/健康，下午突出繁育记录或复查 | Medium | 需要真实使用习惯验证，当前没有证据支持固定时段规则 |
| 跨区块智能置顶 | 某只犬同时有繁育和健康风险时，在相关区块加联动提示 | High | 容易制造重复和解释成本；需要风险评分模型 |
| 月历/完整日历工作台 | 超越 WeekStrip 查看整月任务密度 | Medium | 当前明确不以完整日历替代 WeekStrip |
| 协作者视图差异 | 主人/协助者看到不同操作密度和权限按钮 | High | 角色权限矩阵尚未系统收口，先不要扩大首页行为面 |
| 语音/AI 日报 | 生成“今天先做什么”的自然语言摘要 | High | V1 原则是先记录后自动化，且不应影响可靠记录闭环 |

## Anti-Features To Avoid Now

| Anti-Feature | Why Avoid | What To Do Instead |
|--------------|-----------|-------------------|
| 恢复统一任务池 | 会破坏 `逾期 / 繁育 / 健康 / 用药` 的注意力分层，用户无法判断事项性质 | 保留四层，只在区块内部聚合 |
| 用摘要卡替代正文工作台 | 当前首页规则明确不做摘要卡；摘要会让用户多点一次才能处理 | 在每个区块内直接展示可操作行和显式展开 |
| 新增二级页或 Sheet 承载列表 | 会把“今天要做什么”藏起来，也违反当前“不做二级页/Sheet”口径 | “查看更多”只在原区块内展开 |
| 繁育流程批量完成 | 繁育记录需要观察细节，批量完成会污染状态机 | 繁育只做单犬/单窝推进入口 |
| 健康建议静默变任务 | 疫苗/驱虫默认只是建议日期，静默续链会制造误提醒 | 只有显式 `create_task=true` 才进入健康提醒 |
| 批量健康只标记 task 完成 | 会产生“看似完成但无健康记录”的假数据 | 批量完成必须创建真实 `health_record` |
| 疾病观察混入今日用药 | 观察中犬没有给药 checkbox，混入用药会让进度分母失真 | `sick_only` 留在健康区疾病观察 |
| 用药回退到旧 `tasks(type=medication)` 事实源 | 当前疗程事实源是 `medication_tasks`，旧兼容路径已是风险点 | 新工作台只围绕 `medication_tasks` 设计 |
| 静默 `slice` 截断犬只/卡片 | 30-50 犬场景会直接藏掉待处理事项 | 显式“还有 X 项/只”，并支持展开 |
| 用 `counts.today` 驱动今日红点 | 该字段包含用药兜底逻辑，可能与实际可见卡片不一致 | 红点以实际可见卡片和 `dayCounts` 同步规则为准 |
| 完成额外安排推进繁育状态 | 额外安排只是手动附加事项，不是主流程节点 | 只更新该安排任务状态 |
| 大范围数据模型重做 | 本里程碑目标是展示与聚合协议，不是重构业务事实源 | 复用 `tasks`、`medication_tasks`、`health_records`、`breeding_cycles` |

## Feature Dependencies

```text
task-service 分组协议
  → 首页区块渲染器
  → 区块密度阈值与展开状态
  → pill/badge/WeekStrip 计数一致性

breeding_milestone.details.step_type
  → 繁育步骤分组
  → 单犬/单窝行路由
  → 表单 locked 参数承接

health batch key(type + subtype + drug + date)
  → 健康批量组
  → 批量完成真实 health_record
  → 部分完成后元数据同步

medication_tasks + allMedTasks/doses_given
  → 用药未完成/部分/已完成排序
  → 剂次级乐观更新
  → 完成后 suppression 防闪回

suppressedTaskMap + latestLoadToken + syncCardMeta/dayCounts
  → 所有新 row/group 操作的可靠局部承接
```

## Recommended MVP Cut

1. **先改聚合协议但保持旧卡兼容**：`task-service.getHomeCards/getWeekCards` 返回现有 cards 的同时，补充可渲染的 grouped sections。前端先用新协议渲染当前日，未来日期随后接上。
2. **优先做繁育步骤工作台**：这是当前大卡片直出最不符合业务心智的区域。主流程按 step_type 分组，组内单犬/单窝轻量行，额外安排单独子层。
3. **再做健康批量密度**：保留现有 BatchCard 的真实记录语义，重点补齐同类分组、显式展开、部分完成后的标题/进度/犬只元数据同步。
4. **接着做用药排序折叠**：不用重做疗程模型，只调整卡内排序和已完成折叠，保留高频给药、多药展开和 partial 状态。
5. **最后做逾期区压缩和全局计数校准**：逾期区和 pills/WeekStrip 最容易暴露计数错误，放在新分组稳定后整体校验。

**Defer:** 独立“今日重点”模块。当前可以通过逾期置顶、繁育步骤排序、用药未完成优先来达到 80% 的重点筛选效果。等工作台稳定后，再评估是否需要一个不违反“无摘要卡”规则的轻量重点带。

## UAT Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| 20 个繁育流程任务分布在 4 个 step_type | 繁育区显示 4 个步骤组；每组默认最多 4 行；无批量完成按钮；展开后可见全部 |
| 1 个繁育任务逾期、5 个今日健康任务、3 个用药任务 | 正文顺序仍为逾期、繁育、健康、用药；逾期 pill 为 1；用药未完成在最前 |
| 12 只犬同天同疫苗，另 3 只同天另一疫苗 | 健康区显示两组，不跨疫苗类型合并；每组标题数量正确 |
| 批量健康卡完成其中 2/5 只 | 卡片不消失；剩余犬只为 3；标题、progress.total、dogs 列表同步 |
| 4 只疾病观察，1 只严重，2 只中等，1 只轻微 | 健康区疾病观察默认压缩；摘要严重度为红色；展开后每只犬有处理入口 |
| 3 只用药犬：未给、部分、多药已完成 | 排序为未给、部分、已完成；已完成默认折叠或弱化；多药犬可展开子药 |
| 完成一个新轻量行后立即后台刷新 | 行立即消失或状态变化；旧响应不闪回；今日红点按可见事项同步 |
| 今日所有事项完成 | 四个 pill 计数归零；今日红点归零；显示“犬群一切正常” |

## Sources

- `.planning/PROJECT.md` — 当前活跃目标、首页工作台方向、范围约束。
- `.planning/codebase/ARCHITECTURE.md` — 首页 attention flow、Smart Cards、cloud object 边界。
- `.planning/codebase/CONCERNS.md` — 首页 optimistic state、suppression、WeekStrip、批量健康语义等 fragile areas。
- `docs/design/02-features.md` — 首页固定结构、注意力单元、卡片合并规则、提醒来源和交互原则。
- `TODOS.md` — TODO-29 首页工作台密度自适应优化。
- `AGENTS.md` — 当前首页任务系统强约束、红点同步规则、批量卡完成语义。
- `graphify/worksets/home-attention.json` — 首页注意力业务域涉及文件范围。
- `src/pages/home/index.vue` — 当前四区块、pills、latest token、suppression、dayCounts 行为。
- `uniCloud-alipay/cloudfunctions/task-service/index.obj.js` — 当前分层聚合、繁育/健康/用药 card 构造规则。
- `src/components/smart-card/DogCard.vue`、`BatchCard.vue`、`MedicationCard.vue`、`SickObservationCard.vue` — 当前卡片交互和密度限制实现。
