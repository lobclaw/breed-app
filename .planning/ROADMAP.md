# Roadmap: 首页工作台密度自适应优化

## Overview

本里程碑把现有首页从大卡片直出升级为区块内工作台：继续固定 `逾期 / 繁育 / 健康 / 用药` 四层语义，不引入统一任务池、二级页、Sheet 或新的后端事实源。路线先冻结 workbench contract 和测试基础，再分别稳定繁育、健康、用药三个业务区块，随后校准逾期、计数、WeekStrip 和防闪回，最后仅在工作台模型稳定后派生 `今日重点`。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Workbench Contract & Test Foundation** - 建立纯 workbench adapter、typed event 边界和低风险测试护栏。
- [ ] **Phase 2: Breeding Step Workbench** - 繁育主流程按 step_type 分组为单犬/单窝推进行，额外安排保持独立子层。
- [ ] **Phase 3: Health Batch-First Workbench** - 健康区保留疫苗/驱虫批量价值，并保证部分完成和疾病观察语义正确。
- [ ] **Phase 4: Medication State Workbench** - 今日用药按未完成、部分完成、已完成组织，并保留疗程剂次语义。
- [ ] **Phase 5: Overdue, Counts & Reconciliation Calibration** - 校准逾期压缩、pill 数字、WeekStrip 红点、suppression 和阶段验证。
- [ ] **Phase 6: Today Focus From Workbench Model** - 从稳定后的工作台模型派生今日重点导航层，不创建第二套任务系统。

## Phase Details

### Phase 1: Workbench Contract & Test Foundation
**Goal**: 开发者可以在不触碰云调用、路由、toast、suppression 和红点副作用的前提下，可靠生成首页工作台视图模型。
**Depends on**: Nothing (first phase)
**Requirements**: WB-01, WB-02, WB-03, WB-04, WB-05, VERIFY-01, VERIFY-02
**Success Criteria** (what must be TRUE):
  1. 开发者可以调用纯 workbench adapter，从已过滤 cards 得到四层区块、组、行、隐藏数量和排序信息，且输入 cards 保持不可变。
  2. 首页仍固定呈现 `逾期 / 繁育 / 健康 / 用药` 四层语义，数量过多时只通过显式展开/收起承接，不静默硬截断。
  3. 新增工作台组件只向 `src/pages/home/index.vue` emit typed events；云调用、路由、乐观移除、suppression 和红点同步仍由首页统一处理。
  4. 单元测试覆盖区块顺序、繁育分组、健康批量保留、用药排序、隐藏数量、输入不可变、繁育不进 batch、健康 subtype key 和未来用药红点。
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Define the workbench view-model contract, pure adapter, and adapter tests.
- [ ] 01-02-PLAN.md — Strengthen task-service invariant tests for subtype keys, future medication cards, and breeding non-batch behavior.
- [ ] 01-03-PLAN.md — Wire computed-only workbench state into the home page and run integrated validation.
**UI hint**: yes

### Phase 2: Breeding Step Workbench
**Goal**: 用户可以在繁育区按流程步骤处理每只犬或每窝的下一步，而不会看到批量完成心智。
**Depends on**: Phase 1
**Requirements**: BREED-01, BREED-02, BREED-03, BREED-04, BREED-05
**Success Criteria** (what must be TRUE):
  1. 用户在繁育区看到主流程按 `breeding_milestone.details.step_type` 分组展示，例如卵泡检查、孕检和断奶确认。
  2. 每个繁育主流程事项显示为单犬/单窝独立轻量行，不出现 checkbox、`0/N`、完成全部或批量完成入口。
  3. 用户点击繁育流程行时会按 `step_type` 进入正确页面，并携带 `dogId + dogName + cycleId + taskId + locked=true`。
  4. `额外安排` 继续在繁育区独立子层展示，完成、推迟、跳过只更新任务本身，不创建 `breeding_record`，不推进主流程状态机。
**Plans**: TBD
**UI hint**: yes

### Phase 3: Health Batch-First Workbench
**Goal**: 用户可以在健康区高效处理真正适合批量执行的疫苗/驱虫事项，同时疾病观察和部分完成状态保持可信。
**Depends on**: Phase 2
**Requirements**: HEALTH-01, HEALTH-02, HEALTH-03, HEALTH-04, HEALTH-05
**Success Criteria** (what must be TRUE):
  1. 健康区继续优先展示适合批量处理的疫苗/驱虫批量组，且同日同类任务按 `vaccine_type` 或 `deworming_type + drug_name` 正确拆分。
  2. 用户完成批量健康事项后，后端创建真实 `health_record`，首页只移除后端返回的 `completedTasks`。
  3. 批量健康部分完成后，首页同步剩余 `tasks`、`dogs`、`progress.total` 和标题数量；只有全部完成时整组才消失。
  4. 疾病观察继续归属健康区，使用健康语义展示，不进入今日用药。
**Plans**: TBD
**UI hint**: yes

### Phase 4: Medication State Workbench
**Goal**: 用户可以在今日用药区优先看到未完成和部分完成疗程，并仍能准确处理剂次、疗程和多药品场景。
**Depends on**: Phase 3
**Requirements**: MED-01, MED-02, MED-03, MED-04, MED-05
**Success Criteria** (what must be TRUE):
  1. 今日用药区以 `medication_tasks` 为事实源，不回退到旧 `tasks(type='medication')` 模型。
  2. 用药事项按 `未完成 → 部分完成 → 已完成` 排序，未完成和部分完成优先展示。
  3. 已完成用药项在数量较多时弱化或折叠，用户仍可明确展开查看。
  4. 用药行保留单次/多次剂量、疗程天数、多药品展示和今日打卡语义，操作继续走现有 `health-service` 用药流程。
**Plans**: TBD
**UI hint**: yes

### Phase 5: Overdue, Counts & Reconciliation Calibration
**Goal**: 用户看到的逾期事项、顶部数字、WeekStrip 红点和本地乐观状态彼此一致，高密度场景下不会闪回或错计数。
**Depends on**: Phase 4
**Requirements**: COUNT-01, COUNT-02, COUNT-03, COUNT-04, COUNT-05, VERIFY-03, VERIFY-04, VERIFY-05
**Success Criteria** (what must be TRUE):
  1. 逾期区继续最高优先级展示；数量较多时先显示最紧急项，并用显式展开入口承接剩余项。
  2. 顶部 pills 数字反映真实待处理量，不只统计当前展开可见行。
  3. WeekStrip 红点与实际可见卡片或工作台项一致，今日红点不依赖 `counts.today`，未来仅有用药疗程状态的日期也有红点和内容。
  4. 乐观移除后，suppression 期间服务端刷新或 weekCache 切换不会让刚完成的事项闪回。
  5. 阶段性实现通过 `pnpm type-check`、重点 cloud-object 测试、`pnpm test`、`./scripts/graphify-rebuild.sh`，并完成 20+ 繁育、20+ 健康、10+ 用药等高密度 UAT。
**Plans**: TBD
**UI hint**: yes

### Phase 6: Today Focus From Workbench Model
**Goal**: 用户可以在工作台稳定后看到 3-5 个最高优先级事项的聚焦入口，但所有业务动作仍回到原区块语义。
**Depends on**: Phase 5
**Requirements**: FOCUS-01, FOCUS-02, FOCUS-03
**Success Criteria** (what must be TRUE):
  1. `今日重点` 只在区块工作台稳定后出现，并从逾期、繁育、健康、用药的 workbench model 派生 3-5 个最高优先级事项。
  2. 用户点击 `今日重点` 项时会定位到原区块或原事项，不进入新的任务列表、二级页或 Sheet。
  3. `今日重点` 不改变原区块的完成、推迟、跳过、记录创建和用药打卡语义。
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Workbench Contract & Test Foundation | 0/TBD | Not started | - |
| 2. Breeding Step Workbench | 0/TBD | Not started | - |
| 3. Health Batch-First Workbench | 0/TBD | Not started | - |
| 4. Medication State Workbench | 0/TBD | Not started | - |
| 5. Overdue, Counts & Reconciliation Calibration | 0/TBD | Not started | - |
| 6. Today Focus From Workbench Model | 0/TBD | Not started | - |

## Coverage

| Requirement | Phase |
|-------------|-------|
| WB-01 | Phase 1 |
| WB-02 | Phase 1 |
| WB-03 | Phase 1 |
| WB-04 | Phase 1 |
| WB-05 | Phase 1 |
| BREED-01 | Phase 2 |
| BREED-02 | Phase 2 |
| BREED-03 | Phase 2 |
| BREED-04 | Phase 2 |
| BREED-05 | Phase 2 |
| HEALTH-01 | Phase 3 |
| HEALTH-02 | Phase 3 |
| HEALTH-03 | Phase 3 |
| HEALTH-04 | Phase 3 |
| HEALTH-05 | Phase 3 |
| MED-01 | Phase 4 |
| MED-02 | Phase 4 |
| MED-03 | Phase 4 |
| MED-04 | Phase 4 |
| MED-05 | Phase 4 |
| COUNT-01 | Phase 5 |
| COUNT-02 | Phase 5 |
| COUNT-03 | Phase 5 |
| COUNT-04 | Phase 5 |
| COUNT-05 | Phase 5 |
| FOCUS-01 | Phase 6 |
| FOCUS-02 | Phase 6 |
| FOCUS-03 | Phase 6 |
| VERIFY-01 | Phase 1 |
| VERIFY-02 | Phase 1 |
| VERIFY-03 | Phase 5 |
| VERIFY-04 | Phase 5 |
| VERIFY-05 | Phase 5 |

**Coverage:** 33/33 v1 requirements mapped; no orphaned requirements; no duplicate phase ownership.
