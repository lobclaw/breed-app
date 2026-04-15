# Architecture Research: Homepage Workbench Density Adaptation

**Project:** breed-app  
**Domain:** 首页注意力工作台 / home attention  
**Researched:** 2026-04-15  
**Confidence:** HIGH for current code boundaries and data flow; MEDIUM for proposed display thresholds until UI validation with real task volume.

## Executive Recommendation

首页密度自适应应作为现有 home attention 架构上的一层 **前端工作台视图模型**，而不是重写任务系统、另建统一待办池、或把所有展示逻辑搬进云函数。当前 `task-service.getHomeCards/getWeekCards/getDateCounts` 已经承担事实源聚合、分层、卡片合并和 WeekStrip 数据供给；下一阶段应该保留这个边界，在 `src/pages/home/index.vue` 与 `SmartCard` 组件之间增加可测试的密度适配层。

推荐方向：

1. 后端继续返回 `cards + sections + counts`，并保持 `sectionType/domain/cardType/priority/tasks/dogs/progress` 为基础契约。
2. 前端新增 `useHomeWorkbench` 或 `homeWorkbench.ts`，把原始 cards 转换为 `WorkbenchSection[]`，负责区块内分组、行/卡选择、折叠阈值、今日重点抽取。
3. UI 从“所有内容都走大卡片”逐步升级为“区块容器 + 分组标题 + 行组件 / 现有卡片混排”，但所有完成、推迟、跳转、suppression、WeekStrip 红点仍回到 `home/index.vue` 现有动作处理链路。
4. 第一阶段不要改数据库，也不要改 `tasks` / `medication_tasks` 的事实源。只在必要时给 card payload 增加向后兼容的显示元数据。

## Current Architecture Facts

### Backend Aggregation Boundary

`uniCloud-alipay/cloudfunctions/task-service/index.obj.js` 是首页数据聚合所有者：

- `getHomeCards()` 聚合今日/逾期 pending tasks、未来繁育主流程 tasks、今日已完成 tasks、未康复 illness、进行中 `medication_tasks`。
- `getWeekCards(startDate, endDate)` 为未来日期切换提供预缓存卡片。
- `getDateCounts(startDate, endDate)` 为 WeekStrip 红点提供按日计数，并包含只有疗程状态时的未来红点兜底。
- `buildSectionedCards()` 已经返回稳定分层：
  - `workflow` → 繁育主流程
  - `extra_arrangements` → 繁育额外安排
  - `reminders` → 健康提醒与疾病观察
  - `therapy` → 今日用药
- `mergeTasks()` 已经包含关键业务合并规则：
  - 繁育主流程 / 额外安排一任务一卡，避免批量完成心智。
  - 健康类可按窝、同类同天批量合并。
  - 用药由 `medication_tasks` 计算今日状态。
  - 疾病观察留在健康提醒，不混入今日用药。

结论：密度适配不应绕过 `task-service` 自行查询 `tasks`、`health_records` 或 `medication_tasks`。后端已有足够语义，前端应消费 card contract。

### Frontend State Boundary

`src/pages/home/index.vue` 当前承担：

- stale-while-revalidate 首屏缓存：从 `taskStore.cards/counts` 先渲染，再后台刷新。
- 并行加载：`loadAll()` 同时请求 `getHomeCards`、`getWeekCards`、`getDateCounts`。
- latest token 防旧响应覆盖：`latestLoadToken` 保护 `loadTodayCards/loadWeekCache/loadDateCounts`。
- 分层渲染：通过 `card.sectionType`、`card.priority` 计算 `todaySections/daySections/summaryPills`。
- 乐观动作：`removeCardLocally()`、`syncWeekCache()`、`syncCardMeta()`。
- 短期 suppression：`suppressedTaskMap`、`filterSuppressedCards()` 防卡片闪回。
- WeekStrip 红点修正：`loadAll()` 的 `Promise.all` 完成后以实际可见 cards 修正今天红点。
- 跨页面提交承接：`applyHomeFeedback()` 消费记录页返回的 `completedTaskIds/suppressTaskIds/removeBatchCard`。

结论：下一阶段可以拆出密度适配计算，但不要把动作副作用分散到每个行组件。首页页面仍应是动作协调者。

### Component Boundary

当前 `src/components/smart-card/` 是卡片渲染层：

- `SmartCard.vue` 按 `card.cardType` 分发。
- `DogCard.vue` 负责单犬任务，繁育跳转依赖 `task.details.step_type`、`cycle_id`、`taskId`、`locked=true`。
- `BatchCard.vue` 负责健康批量任务，包含勾选、批量表单跳转、批量完成/推迟/跳过。
- `MedicationCard.vue` 负责今日用药，包含犬只行、多药展开、计次给药、完成今日剂量。
- `SickObservationCard.vue` 负责疾病观察动作。

结论：密度适配需要新增 **工作台区块/行组件**，但不要把现有 `SmartCard` 直接改成巨型组件。推荐保留现有卡片作为兼容渲染，逐步引入更轻的 row renderers。

## Recommended Architecture

### Data Flow

```text
UniCloud collections
  tasks / medication_tasks / health_records / dogs
        |
        v
task-service
  getHomeCards / getWeekCards / getDateCounts
  - family scoped queries
  - task/card aggregation
  - sectionType/domain/cardType annotation
        |
        v
taskStore + home/index.vue local state
  - cached raw cards
  - latestLoadToken
  - suppression filtering
  - dayCounts/weekCache
        |
        v
Home Workbench Adapter (new)
  raw cards -> WorkbenchSection[]
  - section grouping
  - density mode
  - row/card selection
  - focus extraction
  - collapsed/visible counts
        |
        v
Workbench UI Components (new + existing SmartCard)
  - HomeWorkbenchSection
  - BreedingStepGroup
  - BreedingTaskRow
  - HealthBatchGroup / HealthTaskRow
  - MedicationWorkbenchGroup / MedicationRow
  - SmartCard fallback
        |
        v
home/index.vue action handlers
  complete / batchComplete / postpone / recordDose / feedback
        |
        v
task-service / health-service / breeding record pages
```

Direction is one-way for data: backend aggregate → frontend cache/suppression → view model → render. Actions flow back through existing handlers, not through row-local cloud calls.

### Component And Service Boundaries

| Boundary | Owns | Must Not Own |
|----------|------|--------------|
| `task-service` | Querying collections, building canonical card payloads, assigning `sectionType/domain/cardType`, preserving business grouping semantics | UI density thresholds, fold state, viewport-specific layout, local suppression |
| `taskStore` | Raw home card/cache persistence for stale-while-revalidate and FAB recommendations | Workbench grouping state, folded group state, optimistic mutations beyond existing cache sync |
| `home/index.vue` | Loading orchestration, latest token, suppression, WeekStrip counts, action side effects, cross-page feedback | Detailed section grouping algorithms once extracted |
| `homeWorkbench.ts` / `useHomeWorkbench.ts` | Pure transform from raw cards to renderable workbench sections | Cloud calls, mutation of `cards`, suppression timers, route navigation |
| Workbench section components | Rendering section headers, groups, rows, fold controls, empty states | Calling cloud services directly, changing task/card identity |
| Existing `SmartCard` components | Backward-compatible full-card rendering and complex interactions already implemented | Cross-section grouping or global density decisions |

## Proposed Frontend Shape

Add a small home-domain module:

```text
src/pages/home/
  index.vue                  # orchestration remains here
  homeWorkbench.ts            # pure transform, unit-testable
  components/
    HomeFocusStrip.vue        # optional "今日重点"
    HomeWorkbenchSection.vue  # section shell
    BreedingStepGroup.vue     # step grouping
    BreedingTaskRow.vue       # single dog/litter flow row
    HealthBatchGroup.vue      # batch-first health group
    HealthTaskRow.vue         # fallback single health row
    MedicationWorkbench.vue   # state-ordered medication rows
```

Keep these under `src/pages/home/` first. They are home-specific and should not be promoted to `src/components/` until another page needs them.

### Workbench View Model

Recommended minimal types:

```typescript
type WorkbenchSectionKey = 'overdue' | 'breeding' | 'reminders' | 'therapy'
type WorkbenchDensity = 'expanded' | 'compact' | 'collapsed'
type WorkbenchItemKind = 'card' | 'row' | 'group'

interface WorkbenchSection {
  key: WorkbenchSectionKey
  title: string
  dotColor: string
  count: number
  density: WorkbenchDensity
  groups: WorkbenchGroup[]
  hiddenCount: number
}

interface WorkbenchGroup {
  key: string
  title: string
  sectionType?: 'workflow' | 'workflow_extra' | 'reminders' | 'therapy'
  count: number
  items: WorkbenchItem[]
  hiddenCount: number
}

interface WorkbenchItem {
  key: string
  kind: WorkbenchItemKind
  card: any
  task?: any
  dog?: any
  actionIds: string[]
  priority: 'overdue' | 'today' | 'upcoming'
  domain: 'breeding' | 'health' | 'medication'
}
```

This adapter should be deterministic and side-effect free:

```typescript
const todayWorkbench = computed(() =>
  buildHomeWorkbench({
    cards: cards.value,
    mode: 'today',
    now: Date.now(),
    thresholds: HOME_WORKBENCH_THRESHOLDS,
  })
)
```

No `uniCloud`, no `uni.navigateTo`, no `uni.showToast` in this module.

## Section Integration Rules

### Overdue

Overdue should remain a top-level section and retain red styling. Density adaptation should not hide overdue items behind a summary. If there are many overdue items, group by domain first:

1. 繁育逾期
2. 健康逾期
3. 用药逾期 if applicable

Use compact rows after the first few items, but keep all overdue counts visible. Actions still use the source card/task IDs and existing `onComplete/onPostpone/onBatchComplete`.

### Breeding

Breeding should become the first density-adapted section because the milestone requires it and because current cards are intentionally one-task-one-card.

Recommended grouping:

- `当前流程`
  - group by `task.details.step_type`
  - display step labels in process order:
    1. `follicle_check` 建议卵泡检查
    2. `mating` 配种
    3. `pregnancy_check` 建议孕检
    4. `birth` / production-related route if present
    5. `weaning_confirm` 确认断奶
    6. unknown fallback by due date
- `额外安排`
  - group by `details.kind` or due date bucket
  - completion is task-only and must not create `breeding_record`

Rendering recommendation:

- Use `BreedingTaskRow` for normal density: dog/litter name, state-language subtitle, due/overdue label, primary route affordance.
- Use existing `DogCard` as fallback for unknown card shapes.
- Never convert breeding flow into `BatchCard`, even if many cards share the same step and date.

Routing must continue to use existing `DogCard` rules:

- `breeding_milestone.details.step_type === 'follicle_check'` → `/pages/record/breeding-follicle`
- `pregnancy_check` → `/pages/record/breeding-pregnancy`
- `weaning_confirm` with `litter_id` → `/pages/breeding/litter`
- pass `dogId + dogName + cycleId + taskId + locked=true` for record pages.

### Health Reminders

Health should remain batch-friendly. The current backend already creates `BatchCard` for same-type same-day multi-dog health tasks and has tests protecting subtype keys.

Recommended display:

- If `card.cardType === 'batch'`, keep the batch group prominent.
- If the section has many single dog health cards of related subtype, show grouped compact rows, but do not invent batch completion unless backend card is batch.
- Batch groups should retain `dogs`, `tasks`, `progress`, and `groupTitle` exactly enough for `syncCardMeta()` to update partial completion.
- Do not show system-suggested future vaccination/deworming dates unless they are explicit tasks. Health reminders remain confirmed reminders, not advice rows.

### Medication / Therapy

Medication density should adapt inside the existing therapy section, not become health reminders.

Recommended ordering:

1. 犬只/药品未完成 today dose
2. partially completed multi-dose/multi-drug rows
3. completed rows weak or folded

Current `MedicationCard.vue` already contains row-level logic: `dogState`, multi-drug expansion, local dose count, batch complete. Prefer extracting/reshaping that logic into `MedicationWorkbench.vue` only if the row design needs more density. Keep actions emitting:

- `record-dose` with `medicationTaskId`
- `batch-complete-med` with `medicationTaskIds`
- `action` for recover/start treatment/stop medication

Do not route medication completion through `task-service.batchCompleteTask`; new model uses `health-service.recordMedicationDose` and `health-service.batchCompleteMedicationDay`.

## Data Contract Suggestions

### Keep Existing Required Fields

Density adaptation depends on these existing fields and should treat them as required:

| Field | Use |
|-------|-----|
| `card.id` | render key, animation state, optimistic removal |
| `card.cardType` | renderer selection |
| `card.sectionType` | section placement |
| `card.domain` | color/domain semantics |
| `card.priority` | overdue/today/upcoming placement |
| `card.tasks[]` | source task IDs, due dates, details, completion |
| `card.dogs[]` | batch/medication row data |
| `card.progress` | batch metadata |
| `task._id` | completion, suppression, week cache sync |
| `task.type` | action semantics |
| `task.details.step_type` | breeding milestone routing |

### Add Optional Display Metadata, Not New Facts

If backend changes are needed, add optional fields that describe semantic grouping, not UI layout:

```javascript
{
  sectionType: 'workflow',
  domain: 'breeding',
  display: {
    groupKey: 'breeding_step:pregnancy_check',
    groupLabel: '建议孕检',
    sortRank: 30,
    subjectType: 'dog',
    subjectId: 'dog_1',
    subjectName: '花花',
    densityHint: 'row'
  }
}
```

Rules:

- `display.*` must be additive and optional so old cards still render.
- `sortRank` should express business order, not pixel layout.
- `densityHint` may suggest `row` vs `card`, but frontend decides based on counts.
- Do not put folded/expanded state in backend response.
- Do not pre-truncate cards server-side.

### Preserve Sections In Week Cache

`getWeekCards()` already returns both `cards` and `sections`, but frontend currently stores only `cards` in `weekCache`. Density adaptation can still work from cards, but for consistency it should either:

- continue deriving sections entirely from `cards`, or
- store `{ cards, sections }` in `weekCache` and use the same adapter for today and date views.

Recommendation: derive from cards for Phase 1 to reduce contract changes; consider preserving `sections` in a later cleanup.

## Cache And Optimistic Actions

### Rules To Preserve

These protections are fragile and must remain intact:

- `loadAll()` increments `latestLoadToken` and all loaders ignore stale tokens.
- `loadAll()` updates today `dayCounts` only after `Promise.all`.
- `dayCounts[todayTs]` uses actual visible cards, not `counts.today`.
- `filterSuppressedCards()` runs after server data returns.
- `removeCardLocally()` updates `cards`, `dayCards`, `weekCache`, `counts.today`, and `dayCounts`.
- `syncCardMeta()` updates batch `tasks`, `dogs`, `progress.total`, and title count after partial removal.
- Cross-page health record submit uses backend `completedTasks` as authoritative and only removes full batch when all source task IDs completed.

### Adapter Implication

The workbench adapter must consume already-filtered `cards.value` and `dayCards.value`. It must not maintain its own task suppression list. Otherwise the same card can be hidden in one view and visible in another.

Correct sequence:

```text
server result
  -> pruneSuppressedTasks()
  -> filterSuppressedCards()
  -> assign cards/dayCards/weekCache
  -> buildHomeWorkbench(cards)
  -> render
```

For local actions:

```text
row action emits task/card IDs
  -> home/index.vue existing handler
  -> removeCardLocally / syncCardMeta / syncWeekCache
  -> adapter recomputes from mutated cards
  -> cloud call / refresh
```

Do not let row components mutate `card.tasks` or `card.dogs` directly except through existing controlled handlers.

## Safe Build Order

### Phase 1: Contract Audit And Pure Adapter

Goal: no UI redesign yet, no backend changes.

- Add `homeWorkbench.ts` with pure grouping from current `cards`.
- Add unit tests using representative fixtures:
  - breeding main flow + extra arrangements
  - health batch + single health cards
  - medication card
  - overdue mixed domains
  - partial batch metadata after removed task
- Wire computed workbench data in `home/index.vue` behind existing render or console-free development path.

Why first: this establishes a tested contract without touching fragile cloud calls or optimistic state.

### Phase 2: Breeding Section Density

Goal: integrate the most important density gain with lowest write-risk.

- Add `HomeWorkbenchSection`, `BreedingStepGroup`, `BreedingTaskRow`.
- Replace only breeding section rendering.
- Keep fallback to `SmartCard` for unknown cards.
- Preserve existing route params and extra-arrangement completion semantics.
- Verify no batch card appears for `breeding_milestone`.

Why second: breeding flow is one-task-one-card by design and needs row density, but actions mostly navigate rather than auto-create records.

### Phase 3: Health Section Batch-First Layout

Goal: improve density while preserving true batch semantics.

- Render existing `BatchCard` or a `HealthBatchGroup` for backend batch cards.
- Use compact rows only for non-batch health cards.
- Keep batch completion wired through existing `onBatchComplete` and record-page feedback.
- Add tests for `syncCardMeta` with partial completion and title/progress update.

Why third: health batch completion creates real `health_record`; it is high value but more failure-prone than breeding navigation.

### Phase 4: Medication State Ordering

Goal: improve therapy section density without changing medication facts.

- Extract current medication row ordering into a workbench renderer.
- Preserve local dose optimism in one place.
- Ensure completed rows can be weak/folded without hiding pending medication.
- Keep `medication_tasks` as the source and use `health-service` methods only.

Why fourth: medication has local dose state and multi-drug expansion; it should be changed after the adapter and section shells are stable.

### Phase 5: 今日重点

Goal: add top focus extraction after sections are stable.

- Compute focus items from the same workbench model.
- Select 3-5 items using deterministic priority:
  1. overdue
  2. breeding step due now / near-term critical
  3. pending medication
  4. health batch with many dogs
- Focus items should deep-link or scroll to original section, not duplicate completion state.

Why last: focus depends on stable section grouping and should not become a separate task list.

## Testing Implications

### Backend Tests

Extend `tests/cloud-objects/task-service.test.ts` only where backend contract changes:

- `getHomeCards` still returns untruncated cards.
- `sections.workflow` and `sections.extra_arrangements` remain distinct.
- `breeding_milestone` never becomes `batch`.
- health batch key includes subtype fields:
  - vaccination uses `vaccine_type`
  - deworming uses `deworming_type + drug_name`
- `getDateCounts` still creates future medication red dots.
- `getWeekCards` returns date cards with section metadata when contract is preserved.

### Pure Adapter Tests

Add new Vitest tests for `homeWorkbench.ts`:

- mixed cards produce section order `overdue -> breeding -> reminders -> therapy`.
- breeding flow groups by `details.step_type` in process order.
- extra arrangements stay under breeding but separate from main flow.
- health batch cards remain batch items; health single cards do not become fake batch actions.
- therapy rows sort pending before completed.
- hidden/fold counts equal raw item counts.
- adapter is pure: input object identity is not mutated.

### Frontend Interaction Tests

Current project lacks Vue workflow tests. For this milestone, add at least focused component tests or lightweight integration tests for:

- Row click emits the same payload expected by `home/index.vue`.
- Breeding row navigation params include `dogId`, `dogName`, `cycleId`, `taskId`, `locked=true`.
- Batch health completion emits task IDs without dropping partial completion.
- Medication row dose action emits `medicationTaskId` and does not call cloud service directly.

### Manual UAT

Use seeded data or a test family with:

- 20+ breeding flow tasks across multiple step types.
- 20+ health reminders with at least two batch groups and several single cards.
- 10+ active medication rows including multi-dose and multi-drug cases.
- Mixed overdue tasks across breeding and health.
- Partial batch completion from record page where only some `sourceTaskIds` complete.

Verify:

- no card flashes back after successful completion;
- WeekStrip today red dot follows visible card count;
- future medication-only dates show red dots and cards;
- partial batch card metadata stays accurate;
- breeding flow never offers batch completion;
- returning from record pages updates local homepage before refresh.

## Anti-Patterns To Avoid

### Rebuilding A Unified Task Pool

Do not collapse sections into one global list and then derive domains on the client. The project explicitly moved away from a single task pool.

### Server-Side UI Truncation

Do not reintroduce `slice(0, 12)` or server-side card limits for display. Density adaptation should fold visually while preserving full data and counts.

### Backend-Owned Fold State

Fold/expand state is viewport and user-session UI state. Keep it local to frontend components or page state.

### New Row Components Calling Cloud Objects

Rows should emit typed events. `home/index.vue` should remain the side-effect boundary so suppression, cache, and red-dot updates stay centralized.

### Fake Health Batch Actions

Only backend-created batch cards should get batch completion. Grouped compact rows may look dense, but if they are not a backend batch card, they should not auto-create records in bulk.

### Medication Through Legacy `tasks`

Do not add new medication daily tasks to `tasks` for workbench convenience. Current source is `medication_tasks`; legacy compatibility remains only for old data.

## Fragile Areas To Protect

| Area | Risk | Protection |
|------|------|------------|
| latest-token loading | old server response can overwrite optimistic local state | keep `latestLoadToken` on all three load paths |
| suppression | completed card flashes back during refresh | adapter consumes filtered cards only |
| WeekStrip red dots | today red dot can disagree with visible cards | update today count after `Promise.all`, based on visible cards |
| partial batch completion | card title/progress/dogs can become inaccurate | keep `syncCardMeta()` or extract it with tests before changing rendering |
| breeding routing | wrong form or missing lock can create records under wrong dog/cycle | preserve `step_type` routing and params |
| medication local dose state | double taps or refresh can show wrong progress | keep local dose optimism scoped to medication component and refresh after health-service calls |
| timezone | overdue/day counts can drift from Beijing expectation | avoid new date helpers until UTC+8 handling is centralized; test boundary cases |

## Roadmap Implications

Recommended phase order:

1. **Workbench Adapter Foundation** - create pure grouping layer and tests before UI changes.
2. **Breeding Density Rows** - highest density gain, safest because most actions navigate rather than auto-write.
3. **Health Batch-First Layout** - preserve true batch semantics and backend-completed task authority.
4. **Medication Row Ordering** - handle pending/partial/done after core workbench structure is stable.
5. **Today Focus Strip** - derive from finalized workbench model to avoid a second task system.

Phase flags:

- Phase 2 needs route-param regression testing for every `breeding_milestone.details.step_type`.
- Phase 3 needs deeper testing around `completedTasks`, `sourceTaskIds`, `removeBatchCard`, suppression, and `syncCardMeta`.
- Phase 4 needs manual UAT for multi-drug, high-frequency dosing, and stop/recover actions.
- Any phase touching `loadAll/loadTodayCards/loadWeekCache/loadDateCounts` should be treated as high risk.

## Sources

- `.planning/PROJECT.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/CONCERNS.md`
- `graphify-out/GRAPH_REPORT.md`
- `graphify/worksets/home-attention.json`
- `docs/design/02-features.md`
- `AGENTS.md`
- `src/pages/home/index.vue`
- `src/stores/taskStore.ts`
- `src/types/task.ts`
- `src/components/smart-card/SmartCard.vue`
- `src/components/smart-card/DogCard.vue`
- `src/components/smart-card/BatchCard.vue`
- `src/components/smart-card/MedicationCard.vue`
- `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`
- `tests/cloud-objects/task-service.test.ts`
