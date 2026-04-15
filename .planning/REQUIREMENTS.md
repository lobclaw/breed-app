# Requirements: 宠物繁育管理 APP

**Defined:** 2026-04-15  
**Core Value:** 让繁育者每天打开首页时，能快速知道最该处理什么，并且处理动作会可靠地回写到真实记录。

## v1 Requirements

Requirements for the current GSD milestone: **首页工作台密度自适应优化**.

### Workbench Contract

- [x] **WB-01**: 首页继续固定展示 `逾期 / 繁育 / 健康 / 用药` 四层语义，不恢复统一待办池。
- [x] **WB-02**: 首页 workbench view model 能从已过滤的 cards 生成区块、组、行、隐藏数量和排序信息。
- [x] **WB-03**: Workbench adapter 必须是纯函数，不发起云调用、不修改输入 cards、不处理 toast、路由或 suppression。
- [x] **WB-04**: 首页不得在服务端或前端静默硬截断卡片；数量过多时必须用显式展开/收起承接。
- [x] **WB-05**: 新增工作台组件只 emit typed events，云调用、乐观移除、suppression 和红点同步仍由 `src/pages/home/index.vue` 统一处理。

### Breeding Workbench

- [ ] **BREED-01**: 繁育主流程按 `breeding_milestone.details.step_type` 分组展示，例如卵泡检查、孕检、断奶确认。
- [ ] **BREED-02**: 每条繁育主流程项必须保持单犬/单窝独立行，不显示 checkbox、`0/N` 或批量完成。
- [ ] **BREED-03**: 繁育流程行点击后必须按 `step_type` 跳到正确入口，并传 `dogId + dogName + cycleId + taskId + locked=true`。
- [ ] **BREED-04**: `额外安排` 继续显示在繁育区子层，样式弱于主流程，但不混入健康提醒。
- [ ] **BREED-05**: 完成、推迟、跳过 `额外安排` 只更新 task 本身，不生成 `breeding_record`，不推进主流程状态机。

### Health Workbench

- [ ] **HEALTH-01**: 健康区继续保留真正适合批量处理的疫苗/驱虫批量卡。
- [ ] **HEALTH-02**: 同日同类健康批量组必须按 `vaccine_type` 或 `deworming_type + drug_name` 区分，不能串组。
- [ ] **HEALTH-03**: 批量健康完成必须以后端返回的 `completedTasks` 为准，且必须创建真实 `health_record`。
- [ ] **HEALTH-04**: 批量健康部分完成后，首页必须同步 `tasks`、`dogs`、`progress.total` 和标题数量，不能只删 task 列表。
- [ ] **HEALTH-05**: 疾病观察继续归属健康区，整体使用健康语义，不进入今日用药。

### Medication Workbench

- [ ] **MED-01**: 今日用药区必须以 `medication_tasks` 为事实源，不回退到旧 `tasks(type='medication')` 模型。
- [ ] **MED-02**: 用药区按 `未完成 → 部分完成 → 已完成` 排序，未完成和部分完成优先展示。
- [ ] **MED-03**: 已完成用药项在数量较多时弱化或折叠，但必须允许用户明确展开查看。
- [ ] **MED-04**: 用药行必须保留单次/多次剂量、疗程天数、多药品展示和今日打卡语义。
- [ ] **MED-05**: 用药行操作必须继续走现有 `health-service.recordMedicationDose`、`batchCompleteMedicationDay` 或结束用药流程。

### Overdue And Counts

- [ ] **COUNT-01**: 逾期区继续最高优先级展示，数量较多时先展示最紧急项，再用显式展开承接剩余项。
- [ ] **COUNT-02**: 顶部 pills 数字必须反映真实待处理量，不能只统计当前展开可见行。
- [ ] **COUNT-03**: WeekStrip 红点必须与实际可见卡片/工作台项一致，不能依赖 `counts.today` 作为今日红点事实。
- [ ] **COUNT-04**: 乐观移除后，suppression 期间服务端或 weekCache 刷新不得让刚完成的事项闪回。
- [ ] **COUNT-05**: 未来日期只有用药疗程状态时，WeekStrip 仍必须显示红点并能打开对应内容。

### Today Focus

- [ ] **FOCUS-01**: 在区块工作台稳定后，首页可增加 `今日重点`，从逾期、繁育、健康、用药中抽取 3-5 个最高优先级事项。
- [ ] **FOCUS-02**: `今日重点` 只能作为导航/聚焦层，点击应定位到原区块或原事项，不能成为第二套任务列表。
- [ ] **FOCUS-03**: `今日重点` 不得改变原区块的完成、推迟、跳过和记录创建语义。

### Verification

- [x] **VERIFY-01**: 为 workbench adapter 添加单元测试，覆盖区块顺序、繁育分组、健康批量保留、用药排序、隐藏数量和输入不可变。
- [x] **VERIFY-02**: 扩展 `task-service` 测试，确认繁育流程不进入 batch、健康 subtype key 不冲突、未来用药红点存在。
- [ ] **VERIFY-03**: 完成阶段性实现后必须通过 `pnpm type-check`、重点 cloud-object 测试和 `pnpm test`。
- [ ] **VERIFY-04**: 修改代码后必须运行 `./scripts/graphify-rebuild.sh`，保持 graphify 知识图可接续。
- [ ] **VERIFY-05**: 需要人工 UAT 覆盖 20+ 繁育、20+ 健康、10+ 用药、健康批量部分完成、WeekStrip 切日期、防闪回等高密度场景。

## v2 Requirements

Deferred beyond this milestone.

### Advanced Workbench

- **ADV-01**: 用户可自定义每个区块的密度阈值或默认展开策略。
- **ADV-02**: 支持按早/晚班、角色权限或协作者视角定制首页工作台。
- **ADV-03**: 支持完整日历视图替代或扩展 WeekStrip。
- **ADV-04**: 支持跨区块 AI 摘要或风险评分。
- **ADV-05**: 支持用短 token 或临时上下文承接超大批量记录页跳转，避免 URL 参数过长。

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| 统一任务池重构 | 已确认首页按业务性质分层，统一池会重新混淆流程、提醒和疗程状态 |
| 二级页/Sheet 承载首页列表 | 当前短期明确不做，先在首页直出框架内做密度优化 |
| 新增 UI 框架或虚拟列表库 | 当前规模和 UniApp 兼容性不需要，引入依赖会增加跨端风险 |
| 新增 `home-service` 或 dashboard 聚合集合 | `task-service` 已是首页事实源，本轮不做持久化汇总模型 |
| 繁育批量完成 | 繁育是流程推进，不是同类健康执行任务，批量完成会破坏业务语义 |
| 健康提醒自动续链 | 健康提醒已确认建议型，只有显式创建才生成下次任务 |
| 用药回退到旧 medication task | 当前事实源是 `medication_tasks`，旧模型只可作为兼容，不可作为新功能基础 |
| 生产页 birth wizard 接入额外安排 | 已明确本期不接入，避免范围扩大 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WB-01 | Phase 1 | Complete |
| WB-02 | Phase 1 | Complete |
| WB-03 | Phase 1 | Complete |
| WB-04 | Phase 1 | Complete |
| WB-05 | Phase 1 | Complete |
| BREED-01 | Phase 2 | Pending |
| BREED-02 | Phase 2 | Pending |
| BREED-03 | Phase 2 | Pending |
| BREED-04 | Phase 2 | Pending |
| BREED-05 | Phase 2 | Pending |
| HEALTH-01 | Phase 3 | Pending |
| HEALTH-02 | Phase 3 | Pending |
| HEALTH-03 | Phase 3 | Pending |
| HEALTH-04 | Phase 3 | Pending |
| HEALTH-05 | Phase 3 | Pending |
| MED-01 | Phase 4 | Pending |
| MED-02 | Phase 4 | Pending |
| MED-03 | Phase 4 | Pending |
| MED-04 | Phase 4 | Pending |
| MED-05 | Phase 4 | Pending |
| COUNT-01 | Phase 5 | Pending |
| COUNT-02 | Phase 5 | Pending |
| COUNT-03 | Phase 5 | Pending |
| COUNT-04 | Phase 5 | Pending |
| COUNT-05 | Phase 5 | Pending |
| FOCUS-01 | Phase 6 | Pending |
| FOCUS-02 | Phase 6 | Pending |
| FOCUS-03 | Phase 6 | Pending |
| VERIFY-01 | Phase 1 | Complete |
| VERIFY-02 | Phase 1 | Complete |
| VERIFY-03 | Phase 5 | Pending |
| VERIFY-04 | Phase 5 | Pending |
| VERIFY-05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-04-15*  
*Last updated: 2026-04-15 after roadmap creation*
