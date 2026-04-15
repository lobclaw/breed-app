# Phase 1: Workbench Contract & Test Foundation - Research

**Researched:** 2026-04-15  
**Domain:** UniApp Vue 3 homepage workbench adapter, smart-card contract, Vitest guardrails  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

## Implementation Decisions

### Homepage Structure

- Keep the homepage layer order as `逾期待处理 -> 繁育流程 -> 健康提醒 -> 今日用药`.
- Do not add secondary pages.
- Do not add Sheet-based detail views.
- Do not reintroduce a unified task pool.
- Density adaptation happens inside sections, not by replacing sections with summary cards.

### Workbench Adapter

- Add frontend-derived workbench state first; reduce backend protocol risk.
- Backend remains the source of card facts through current `task-service` outputs.
- Adapter consumes already-filtered cards after homepage suppression filtering.
- Adapter must not call cloud services, perform navigation, show toasts, mutate input cards, or update suppression/red-dot state.
- Adapter should expose derived groups such as:
  - `breedingStepGroups`
  - `healthReminderGroups`
  - `medicationStateGroups`
  - later `todayHighlights`

### Breeding Direction For Later Phases

- `breeding_milestone` is already fixed to not enter `BatchCard`.
- Later UI should group `繁育流程 > 当前流程` by `details.step_type`:
  - `follicle_check` -> `建议卵泡检查`
  - `pregnancy_check` -> `建议孕检`
  - `weaning_confirm` -> `确认断奶`
  - unknown values fall back to task title.
- Each breeding row still represents one independent task.
- No checkbox, `0/N`, or batch-complete behavior for breeding workflow.
- Extra arrangements remain separate from the main workflow.

### Health Direction For Later Phases

- Health batch cards remain the true batch-completion surface.
- Vaccination/deworming same type and same date with multiple dogs should remain grouped.
- Health subtype identity must include `vaccine_type` or `deworming_type + drug_name`.
- Disease observation remains in the health domain, not medication.

### Medication Direction For Later Phases

- Medication domain remains purple.
- Medication grouping/order should be based on `medication_tasks`.
- Later UI sorts medication rows as `未完成 -> 部分完成 -> 已完成`.
- Completed medication rows may be weakened/folded later, but not hidden silently.
- The existing `MedicationCard` can be adapted internally later; Phase 1 does not need to replace it.

### Today Focus Direction For Later Phases

- `今日重点` is a derived entrance layer, not a new task type.
- It should be added only after section workbench state is stable.
- It should show at most 3-5 high-priority items.
- Clicking a focus item should scroll/navigate to the original section item.
- It must not own completion/postpone/skip semantics.

### Out Of Scope For Phase 1

- Implementing `BreedingFlowGroup` / `BreedingFlowRow` visual UI.
- Implementing health dense UI.
- Implementing medication folded done state.
- Implementing `TodayHighlights`.
- Changing health/breeding/medication generation rules.
- Resolving the `MedicationCard` inline `康复` green color decision.

### Claude's Discretion

None explicit in CONTEXT.md. Research discretion is limited to recommending minimal file/type/helper/test structure that satisfies the locked decisions.

### Deferred Ideas (OUT OF SCOPE)

## Deferred Ideas

- Full breeding step-row UI belongs to Phase 2.
- Health batch-first UI belongs to Phase 3.
- Medication incomplete/partial/done UI belongs to Phase 4.
- Overdue compression and final count calibration belong to Phase 5.
- `今日重点` belongs to Phase 6.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WB-01 | 首页继续固定展示 `逾期 / 繁育 / 健康 / 用药` 四层语义，不恢复统一待办池。 | Existing `todaySections` already uses this order in `src/pages/home/index.vue`; adapter should preserve it as `WORKBENCH_SECTION_ORDER`. |
| WB-02 | 首页 workbench view model 能从已过滤的 cards 生成区块、组、行、隐藏数量和排序信息。 | Add `src/types/home-workbench.ts` and `src/utils/homeWorkbench.ts`; tests assert sections, groups, rows, counts, hidden counts, and sort ranks. |
| WB-03 | Workbench adapter 必须是纯函数，不发起云调用、不修改输入 cards、不处理 toast、路由或 suppression。 | Keep adapter under `src/utils/`, with no imports from `uni`, `uniCloud`, Vue, Pinia, or page composables; immutability test freezes/clones fixtures. |
| WB-04 | 首页不得在服务端或前端静默硬截断卡片；数量过多时必须用显式展开/收起承接。 | Backend test already guards no 12-card truncation; adapter must expose `hiddenCount`/`visibleRows`/`allRows`, and current `DogCard`/`BatchCard` `slice` usage must be bypassed or converted in later UI work. |
| WB-05 | 新增工作台组件只 emit typed events，云调用、乐观移除、suppression 和红点同步仍由 `src/pages/home/index.vue` 统一处理。 | If Phase 1 adds minimal components, place them under `src/pages/home/components/` and type emits; keep action handlers in `home/index.vue`. |
| VERIFY-01 | 为 workbench adapter 添加单元测试，覆盖区块顺序、繁育分组、健康批量保留、用药排序、隐藏数量和输入不可变。 | Add `tests/utils/homeWorkbench.test.ts`; use inline fixtures mirroring current SmartCard payloads. |
| VERIFY-02 | 扩展 `task-service` 测试，确认繁育流程不进入 batch、健康 subtype key 不冲突、未来用药红点存在。 | Existing `tests/cloud-objects/task-service.test.ts` covers most; add/strengthen deworming subtype key and future medication `getWeekCards` card presence. |
</phase_requirements>

## Summary

Phase 1 should be planned as a contract and validation slice, not a visual rewrite. The current source of homepage truth is `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`, which returns cards with `sectionType`, `domain`, `cardType`, `priority`, `tasks`, `dogs`, `progress`, and `sections`. The current side-effect boundary is `src/pages/home/index.vue`, which owns `latestLoadToken`, suppression filtering, local removal, batch metadata sync, WeekStrip red-dot correction, cloud calls, navigation responses, and submit feedback consumption.

The safest plan is to add a pure frontend adapter between already-filtered `cards` and rendering. It should produce a typed workbench view model with four semantic sections, deterministic groups, rows, counts, hidden counts, and ordering metadata. It must not import or call `uni`, `uniCloud`, `useCloudCall`, Pinia stores, route APIs, toasts, suppression state, or red-dot state.

**Primary recommendation:** Add `src/types/home-workbench.ts`, `src/utils/homeWorkbench.ts`, and `tests/utils/homeWorkbench.test.ts`; extend `tests/cloud-objects/task-service.test.ts` only for missing backend invariants.

## Project Constraints (from CLAUDE.md)

- Code identifiers are English; comments and project docs are Chinese.
- All business dates are timestamp milliseconds; timezone expectation is Beijing time UTC+8.
- Data model changes must update design docs before code. Phase 1 should avoid data model changes.
- Commit messages use conventional commits.
- Simple reads can use clientDB/JQL, but multi-collection writes go through cloud objects. Phase 1 should not add reads/writes.
- Soft-delete collections use `deleted_at`; not directly relevant to this phase.
- Statistics are calculated live; do not add precomputed workbench collections.
- Homepage fixed layers and body sections are `逾期 / 繁育 / 健康 / 用药`; today order is `逾期待处理 -> 繁育流程 -> 健康提醒 -> 今日用药`.
- Do not add summary cards, secondary pages, Sheets, or a unified task pool for this milestone.
- Health reminders are suggestive; vaccination/deworming tasks are generated only when explicitly requested.
- Batch health completion must create real `health_record` records.
- Breeding workflow is a progress engine; `breeding_milestone` routes by `details.step_type` and must pass `dogId + dogName + cycleId + taskId + locked=true`.
- Breeding extra arrangements stay in the breeding section, separate from health; completing them updates only the task.
- Homepage cards must not be silently truncated.
- Batch health card IDs must include `vaccine_type` or `deworming_type + drug_name`.
- Return-to-home behavior must locally reconcile before background refresh.
- Batch cards may remove only backend-confirmed completed tasks; partial completion must sync `tasks`, `dogs`, `progress.total`, and title count.
- Suppression filtering prevents completed tasks flashing back during refresh.
- WeekStrip `dayCounts[todayTs]` must be corrected after `Promise.all`, based on actual visible cards, not `counts.today`.
- Future medication-only dates must have red dots and corresponding cards.
- Do not remove latest-token protection from `loadAll/loadTodayCards/loadWeekCache/loadDateCounts`.
- Cloud functions must not use undefined constants; project note says cloud milliseconds should use `86400000` literals, while existing task-service currently defines `DAY_MS`.
- Before architecture/codebase questions, read `graphify-out/GRAPH_REPORT.md`; home-attention workset is the relevant scope.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| UniApp / `@dcloudio/uni-*` | `3.0.0-4080420251103001` | Cross-platform app runtime and Alipay Mini Program target | Locked project framework; do not change for Phase 1. |
| Vue | `3.5.31` resolved | SFC rendering and computed state | Existing app framework; adapter should be framework-independent but consumed by Vue computed state. |
| TypeScript | `4.9.5` resolved | Types for adapter and view model | Existing compiler; keep types compatible with TS 4.9. |
| Pinia | `2.3.1` resolved | Existing task cache store | Adapter should consume arrays from page/store but not own store state. |
| UniCloud cloud objects | project runtime | `task-service`, `health-service`, `breeding-service` | Existing backend source of homepage facts and writes. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | `1.6.1` | Unit and cloud-object tests | Add adapter tests and task-service invariant tests. |
| vue-tsc | `1.8.27` CLI / reports TS `4.9.5` | Type-check Vue/TS source | Run after adding types/helpers. |
| Vite | `5.2.8` | Build/test config base | Existing config provides alias `@` and Uni plugin. |
| graphify scripts | local executable | Knowledge graph freshness | Required after code changes in execution phases; research did not change code. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure `src/utils/homeWorkbench.ts` | Vue composable `useHomeWorkbench` | A composable invites reactive/page imports; pure util is easier to test and proves WB-03. |
| Inline computed sections in `home/index.vue` | Keep current computed blocks | Current page is already 1532 lines; pure helper reduces risk without moving side effects. |
| Backend grouping protocol change | Add `display` fields to task-service cards | Higher contract risk; Phase 1 should derive from current cards first. |
| Component tests with Vue Test Utils | Add `@vue/test-utils` | New dependency and DOM setup not needed for pure adapter foundation. |

**Installation:**

No new packages are required. Use existing project dependencies:

```bash
pnpm install
```

**Version verification:** Verified locally with `pnpm list --depth 0`, `pnpm-lock.yaml`, `npx vitest --version`, and `npx vue-tsc --version` on 2026-04-15. No registry verification was needed because this phase should not add or upgrade dependencies.

## Current Code Contract

### Files Plans Must Read

| File | Why |
|------|-----|
| `src/pages/home/index.vue` | Owns current section computed state, loading, suppression, local removal, WeekStrip red dots, and all card event handlers. |
| `src/types/task.ts` | Existing task type is minimal and does not cover current SmartCard shape; planner should add a new home-workbench type file instead of overloading it. |
| `src/stores/taskStore.ts` | Caches raw cards/counts and builds FAB recommendations from current card shape. Do not store workbench groups here in Phase 1. |
| `src/components/smart-card/SmartCard.vue` | Defines current `SmartCardData` and event names; new typed events should align with these. |
| `src/components/smart-card/DogCard.vue` | Breeding route contract and current silent `visibleTasks.slice(0, 3)`. |
| `src/components/smart-card/BatchCard.vue` | Health batch semantics and current silent `visibleDogs.slice(0, 12)`. |
| `src/components/smart-card/MedicationCard.vue` | Medication state logic: `empty`, `partial`, `done`, multi-drug expansion, `record-dose`, `batch-complete-med`. |
| `src/components/smart-card/SickObservationCard.vue` | Disease observation remains health-domain and has its own local fold behavior. |
| `src/composables/useSubmitFeedback.ts` | Defines `completedTaskIds`, `suppressTaskIds`, and `removeBatchCard` feedback contract used by home reconciliation. |
| `src/pages/record/health-vaccination.vue` and `src/pages/record/health-deworming.vue` | Source of backend-authoritative `completedTasks` return-to-home feedback for partial batch completion. |
| `uniCloud-alipay/cloudfunctions/task-service/index.obj.js` | Homepage fact source: `getHomeCards`, `getWeekCards`, `getDateCounts`, `buildSectionedCards`, `mergeTasks`, `computeMedItemsForDay`. |
| `tests/cloud-objects/task-service.test.ts` | Existing invariant tests and best place for VERIFY-02 additions. |
| `tests/helpers/mock-unicloud.ts` | In-memory cloud-object test harness. |
| `vitest.config.ts` | Includes `tests/**/*.test.ts`; coverage currently includes cloudfunctions and `src/utils/**/*.ts`, so adapter under `src/utils` is covered. |

### Existing Functions To Preserve

| Function / Computed | Location | Planning Implication |
|---------------------|----------|----------------------|
| `todaySections` / `daySections` / `summaryPills` | `home/index.vue` | Replace or wrap with adapter output, preserving labels/order/count semantics. |
| `loadAll` | `home/index.vue` | Keep parallel `Promise.all` and today red-dot correction after all loads. |
| `loadTodayCards` / `loadWeekCache` / `loadDateCounts` | `home/index.vue` | Keep `latestLoadToken` checks and suppression filtering before adapter use. |
| `filterSuppressedCards` | `home/index.vue` | Adapter must consume already-filtered cards; do not duplicate suppression. |
| `syncCardMeta` | `home/index.vue` | Partial batch completion relies on updating `tasks`, `dogs`, `progress.total`, and group title. |
| `removeCardLocally` / `syncWeekCache` | `home/index.vue` | Row/component events should flow into these existing handlers. |
| `applyHomeFeedback` | `home/index.vue` | Record pages return backend `completedTasks`; adapter must not decide completion truth. |
| `getTaskVariantKey` | `task-service` | Current health subtype identity includes vaccine/deworming fields; keep tests around it through `mergeTasks` or a test export if needed. |
| `buildSectionedCards` | `task-service` | Canonical backend sectioning: `workflow`, `extra_arrangements`, `reminders`, `therapy`. |
| `mergeTasks` | `task-service` | Current merge rules prevent breeding batch and preserve health batch. |
| `computeMedItemsForDay` | `task-service` | Current medication facts come from `medication_tasks`; adapter should only sort derived card/dog rows. |

## Architecture Patterns

### Recommended Project Structure

```text
src/
├── types/
│   └── home-workbench.ts       # Workbench view-model and typed event payloads
├── utils/
│   └── homeWorkbench.ts        # Pure cards -> workbench adapter
└── pages/home/
    └── index.vue               # Side effects stay here; consumes adapter output

tests/
├── utils/
│   └── homeWorkbench.test.ts   # VERIFY-01
└── cloud-objects/
    └── task-service.test.ts    # VERIFY-02 extensions
```

### Pattern 1: Pure Adapter Boundary

**What:** `buildHomeWorkbench(cards, options)` takes already-filtered SmartCard payloads and returns deterministic sections/groups/rows.

**When to use:** Any homepage display computation that is not a cloud call, route, toast, suppression, or red-dot update.

**Example:**

```typescript
// Source: existing src/pages/home/index.vue computed sections and task-service card shape.
export function buildHomeWorkbench(cards: HomeCard[], options: BuildHomeWorkbenchOptions): HomeWorkbenchModel {
  const sourceCards = [...cards]
  return {
    sections: WORKBENCH_SECTION_ORDER.map(key => buildSection(key, sourceCards, options)),
  }
}
```

### Pattern 2: Facts Versus View Rows

**What:** Keep raw card/task objects as facts and wrap them in view rows with derived metadata.

**When to use:** Breeding step groups, health batch preservation, medication state ordering, hidden counts.

**Example:**

```typescript
export interface WorkbenchRow {
  id: string
  kind: 'card' | 'task' | 'dog-medication'
  cardId: string
  taskIds: string[]
  sourceCard: HomeCard
  sourceTask?: HomeTask
  state?: 'pending' | 'partial' | 'done'
  sortRank: number
}
```

### Pattern 3: Typed Event Boundary

**What:** New components emit payloads; `home/index.vue` handles the same side effects it handles today.

**When to use:** Any Phase 1 minimal component shell or future Phase 2 row component.

**Example:**

```typescript
export type WorkbenchEvent =
  | { type: 'complete'; taskId: string; mode?: boolean | string }
  | { type: 'postpone'; taskIds: string | string[]; title?: string }
  | { type: 'record-dose'; medicationTaskId: string }
  | { type: 'action'; actionType: string; data: unknown }
```

### Anti-Patterns To Avoid

- **Universal task row with one complete action:** Breeding, health, medication, and illness have different write semantics.
- **Adapter imports `uni` or `useCloudCall`:** Violates WB-03 and makes tests brittle.
- **Workbench groups stored in Pinia:** Store raw cards; derive workbench from current filtered cards.
- **Server or component `slice` as density strategy:** Use explicit `hiddenCount` and expand/fold state.
- **Medication derived from legacy `tasks(type='medication')`:** Current source is `medication_tasks`; legacy merge is compatibility only.
- **Backend changes for Phase 1:** Avoid unless a missing invariant test exposes an existing bug.

## Recommended View Model

Use explicit names that match product language and later phases:

```typescript
export type WorkbenchSectionKey = 'overdue' | 'breeding' | 'reminders' | 'therapy'
export type WorkbenchGroupKind = 'overdue-domain' | 'breeding-step' | 'breeding-extra' | 'health-batch' | 'health-single' | 'medication-state'
export type WorkbenchRowKind = 'card' | 'task' | 'medication-dog'
export type MedicationRowState = 'pending' | 'partial' | 'done'

export interface HomeWorkbenchModel {
  sections: WorkbenchSection[]
  sectionOrder: WorkbenchSectionKey[]
  totalCount: number
}

export interface WorkbenchSection {
  key: WorkbenchSectionKey
  title: string
  dotColor: string
  count: number
  groups: WorkbenchGroup[]
  rows: WorkbenchRow[]
  hiddenCount: number
  sortRank: number
}

export interface WorkbenchGroup {
  key: string
  kind: WorkbenchGroupKind
  title: string
  count: number
  rows: WorkbenchRow[]
  hiddenCount: number
  sortRank: number
}
```

Recommended section order:

```typescript
export const WORKBENCH_SECTION_ORDER = ['overdue', 'breeding', 'reminders', 'therapy'] as const
```

Recommended group keys:

- `breeding-step:${stepType || 'unknown'}`
- `breeding-extra:${kind || 'other'}`
- `health-batch:${card.id}`
- `health-single:${task.type}:${subtypeKey || 'default'}`
- `medication-state:pending`, `medication-state:partial`, `medication-state:done`
- `overdue:${domain || sectionType}`

Recommended row identity:

- Prefer card ID plus task ID where a row represents one task: `${card.id}:${task._id}`.
- For medication dog rows, prefer `${card.id}:${dog.dogId}` and include `medicationTaskIds` from `dog.allMedTasks`.
- Preserve `sourceCard` references read-only; do not clone/mutate business objects in the adapter.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Backend homepage aggregation | New `home-service`, dashboard collection, clientDB reads | Existing `task-service.getHomeCards/getWeekCards/getDateCounts` | Existing service already owns family scope, sections, medication future dots, health/breeding semantics. |
| Cloud-object testing harness | New database mock | `tests/helpers/mock-unicloud.ts` | Existing tests already rely on it and support query/update operators needed here. |
| Date storage model | New date object/string model | Timestamp milliseconds and current helper patterns | Project convention and tests rely on timestamp ms. |
| UI state persistence for groups | New Pinia store | Local component/page fold state later; adapter returns hidden counts | Phase 1 contract only needs deterministic derivation. |
| Batch completion truth | Frontend selected-row truth | Backend `completedTasks` from health record pages and `syncCardMeta` | Partial completion must create real records and remove only confirmed tasks. |
| Medication progress engine | New task model | Existing `medication_tasks` via task-service and health-service | Avoids legacy medication task regression. |

**Key insight:** Phase 1 is about making the transformation layer explicit and testable. Custom backend protocols, new persistence, or component-owned side effects would expand the blast radius before the contract is proven.

## Common Pitfalls

### Pitfall 1: Mistaking Visual Grouping For Batch Semantics

**What goes wrong:** Breeding rows sharing `step_type` are turned into batch cards.  
**Why it happens:** "Group by step" can be misread as "complete all same-step tasks".  
**How to avoid:** Adapter may group breeding visually, but each row keeps one task, no checkbox/progress, and no batch-complete event.  
**Warning signs:** `breeding_milestone` appears in a `batch` card, group has `0/N`, or a breeding group emits multiple task IDs for completion.

### Pitfall 2: Silent Truncation Survives Inside Existing Cards

**What goes wrong:** Backend returns all cards, but `DogCard.visibleTasks` and `BatchCard.visibleDogs` silently hide items.  
**Why it happens:** Existing components use `slice(0, 3)` and `slice(0, 12)` for compact rendering.  
**How to avoid:** Adapter must expose hidden counts. Later UI should render explicit expand/fold or replace those render paths for dense sections.  
**Warning signs:** Test fixture has 13 dogs/tasks but the model has no `hiddenCount`, or UI text does not show hidden item count.

### Pitfall 3: Adapter Consumes Unsuppressed Cards

**What goes wrong:** Completed tasks flash back in workbench rows after refresh.  
**Why it happens:** Adapter is called before `filterSuppressedCards`.  
**How to avoid:** Call adapter only after `cards.value = filterSuppressedCards(...)` and after local removal state has been applied.  
**Warning signs:** Adapter has suppression maps or its own task-removal logic.

### Pitfall 4: Medication Sorting Reads UI Text Instead Of Task State

**What goes wrong:** Completed medication rows appear above unfinished rows or legacy fields are used.  
**Why it happens:** MedicationCard has UI-local `dogState`; backend dog rows have `allMedTasks`, `doses_given`, and `details.frequency`.  
**How to avoid:** Adapter derives `pending/partial/done` from `dog.allMedTasks` and `task.status`/`doses_given >= frequency`, matching MedicationCard logic.  
**Warning signs:** Code checks Chinese card title or old `completed_dates`.

### Pitfall 5: Health Subtype Keys Collapse

**What goes wrong:** Same-day different vaccines or deworming drugs become one group.  
**Why it happens:** Group key uses only type and date.  
**How to avoid:** Keep using task-service subtype logic: vaccination includes `vaccine_type`; deworming includes `deworming_type + drug_name`.  
**Warning signs:** Batch card ID or adapter group key lacks subtype fields.

### Pitfall 6: Counts Drift From Raw Work

**What goes wrong:** Pills/counts show visible rows rather than true total work, or hidden rows are not counted.  
**Why it happens:** Folded workbench rows replace raw cards as the count source.  
**How to avoid:** `count` should represent total rows/cards in the section; `hiddenCount` separately represents folded-away rows.  
**Warning signs:** Expanding a group changes top pill count.

## Code Examples

### Adapter Purity Test

```typescript
import { describe, expect, it } from 'vitest'
import { buildHomeWorkbench } from '@/utils/homeWorkbench'

it('不修改输入 cards', () => {
  const cards = [makeBreedingCard('task_1', 'follicle_check')]
  const before = JSON.stringify(cards)

  buildHomeWorkbench(cards, { visibleLimit: 3 })

  expect(JSON.stringify(cards)).toBe(before)
})
```

### Breeding Group Fixture

```typescript
const follicleCards = [
  makeBreedingCard('breed_1', 'follicle_check', '花花'),
  makeBreedingCard('breed_2', 'follicle_check', '米米'),
  makeBreedingCard('breed_3', 'pregnancy_check', '可可'),
]

const model = buildHomeWorkbench(follicleCards, { visibleLimit: 2 })
expect(model.sections.find(s => s.key === 'breeding')?.groups.map(g => g.key)).toEqual([
  'breeding-step:follicle_check',
  'breeding-step:pregnancy_check',
])
```

### Medication State Derivation

```typescript
function medicationDogState(dog: any): 'pending' | 'partial' | 'done' {
  const tasks = dog.allMedTasks || []
  const done = tasks.filter((task: any) => {
    const frequency = task.details?.frequency || 1
    return task.status === 'completed' || (task.doses_given || 0) >= frequency
  }).length
  if (done === 0) return 'pending'
  if (done === tasks.length) return 'done'
  return 'partial'
}
```

## Concrete Test Fixtures

### Adapter Fixtures

Use inline factories in `tests/utils/homeWorkbench.test.ts`:

- `makeBreedingMilestoneCard(id, stepType, dogName, dueOffset)` returns a `dog` card with `sectionType: 'workflow'`, `domain: 'breeding'`, `tasks: [{ type: 'breeding_milestone', details: { step_type }, cycle_id }]`.
- `makeBreedingExtraCard(id, kind)` returns `sectionType: 'workflow_extra'`, `type: 'breeding_extra_arrangement'`.
- `makeHealthBatchCard(id, type, subtype, dogs)` returns `cardType: 'batch'`, `sectionType: 'reminders'`, `domain: 'health'`, with `dogs`, `tasks`, `progress`.
- `makeHealthSingleCard(id, type, details)` returns `cardType: 'dog'`, `sectionType: 'reminders'`.
- `makeMedicationCard(dogs)` returns `cardType: 'medication'`, `sectionType: 'therapy'`, `domain: 'medication'`, and dog rows with `allMedTasks`.
- `makeOverdueCard(domain, sectionType)` sets `priority: 'overdue'` and `overdueDays`.

### Required Adapter Assertions

- Section order equals `['overdue', 'breeding', 'reminders', 'therapy']`.
- Overdue section contains mixed-domain overdue cards and remains first.
- Breeding workflow groups by `details.step_type`; unknown step falls back to task title.
- Breeding extra arrangements stay in breeding but in a separate group.
- Breeding rows each contain one `taskId`; no batch progress fields are introduced.
- Health batch card remains a card/batch row, with original `tasks`, `dogs`, and `progress` count preserved.
- Health subtype groups distinguish `vaccination:卫佳5` from `vaccination:狂犬` and `deworming:internal:海乐妙` from `deworming:external:福来恩`.
- Medication dog rows sort `pending -> partial -> done`.
- Hidden counts are explicit: all rows remain accessible through `rows` while `visibleRows`/`hiddenCount` show fold metadata.
- Input cards are not mutated.

### Required Task-Service Additions

Existing tests already cover:

- `breeding_milestone` same-day same-step does not become `batch`.
- Vaccine subtype keys avoid same-day collision.
- Future medication-only date has `getDateCounts` red dot.
- Home cards are not silently truncated to 12.
- Workflow and extra arrangements remain distinct sections.
- Future breeding workflow appears on today homepage.

Add or strengthen:

- Same-day deworming subtype collision: `deworming_type + drug_name` must produce separate batch IDs/groups.
- `getWeekCards` future medication-only day returns a therapy card, not only a red dot.
- `breeding_milestone` with `weaning_confirm` and `litter_id` still returns `cardType: 'dog'`/`sectionType: 'workflow'`, never batch.

## State Of The Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unified task pool | Fixed `逾期 / 繁育 / 健康 / 用药` semantic sections | 2026-04 milestone context | Adapter must preserve section identity first. |
| Health reminders auto-chain | Health tasks are explicit, suggested dates are not tasks by default | Current project rules | Workbench cannot invent future advice rows. |
| Breeding reminders as generic tasks | Breeding workflow as progress engine with `breeding_milestone` | Current project rules | Group visually but keep independent route rows. |
| Medication as old `tasks(type='medication')` | `medication_tasks` as fact source | Current project rules | Adapter sorts medication card dog rows; no new task model. |
| Card truncation by `slice` | Explicit expand/fold with hidden counts | Phase 1 target | Adapter must make hidden counts available before UI rewrites. |

**Deprecated/outdated:**

- `src/types/task.ts` `CardType = 'breeding' | 'health' | 'medication' | 'care'` is older than current SmartCard `cardType` values. Do not base the workbench contract on this union without updating/adding types.
- `taskStore._getTaskUrl` still routes `breeding_milestone` to cycle detail and old medication detail paths; Phase 1 should not expand FAB behavior, but planners should avoid using it as the canonical routing contract.
- `DogCard.visibleTasks.slice(0, 3)` and `BatchCard.visibleDogs.slice(0, 12)` are incompatible with WB-04 unless later UI exposes hidden counts.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Vitest, package scripts | Yes | `v22.16.0` | Use project-supported local Node if platform issues appear. |
| pnpm | Scripts and lockfile | Yes | `10.12.1` | npm is not preferred because lockfile is pnpm. |
| Vitest | Adapter and cloud-object tests | Yes | `1.6.1` | None needed. |
| vue-tsc | Type checking | Yes | CLI reports `Version 4.9.5` TypeScript | None needed. |
| graphify rebuild script | Post-code-change graph freshness | Yes | local executable `scripts/graphify-rebuild.sh` | Manual graphify run only if script fails. |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `1.6.1` |
| Config file | `vitest.config.ts` |
| Environment | Node |
| Include pattern | `tests/**/*.test.ts` |
| Coverage include | `uniCloud-alipay/cloudfunctions/**/*.js`, `src/utils/**/*.ts` |
| Quick run command | `pnpm test tests/utils/homeWorkbench.test.ts tests/cloud-objects/task-service.test.ts` |
| Full suite command | `pnpm test` |
| Type command | `pnpm type-check` |

### Phase Requirements To Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WB-01 | Workbench sections stay `overdue -> breeding -> reminders -> therapy`. | unit | `pnpm test tests/utils/homeWorkbench.test.ts` | No, Wave 0 |
| WB-02 | Adapter creates sections, groups, rows, counts, hidden counts, sort ranks. | unit | `pnpm test tests/utils/homeWorkbench.test.ts` | No, Wave 0 |
| WB-03 | Adapter is pure and input immutable. | unit | `pnpm test tests/utils/homeWorkbench.test.ts` | No, Wave 0 |
| WB-04 | Backend remains untruncated; adapter exposes hidden counts rather than silent slice. | unit/integration | `pnpm test tests/utils/homeWorkbench.test.ts tests/cloud-objects/task-service.test.ts` | Partial; adapter test missing |
| WB-05 | Workbench event payload types exist; side effects stay in `home/index.vue`. | type/unit | `pnpm type-check` plus adapter/component event tests if components added | Type file missing |
| VERIFY-01 | Adapter coverage for order, breeding grouping, health batch, medication sort, hidden counts, immutability. | unit | `pnpm test tests/utils/homeWorkbench.test.ts` | No, Wave 0 |
| VERIFY-02 | Task-service coverage for no breeding batch, subtype keys, future medication red dot/card. | cloud-object integration | `pnpm test tests/cloud-objects/task-service.test.ts` | Yes, needs additions |

### Sampling Rate

- **Per task commit:** `pnpm test tests/utils/homeWorkbench.test.ts tests/cloud-objects/task-service.test.ts`
- **Per wave merge:** `pnpm type-check && pnpm test`
- **Phase gate:** `pnpm type-check`, targeted adapter/task-service tests, full `pnpm test`, then `./scripts/graphify-rebuild.sh` after code changes.

### Validation Dimensions For VALIDATION.md

| Dimension | Check |
|-----------|-------|
| Contract shape | `HomeWorkbenchModel` has exactly four top-level semantic sections and stable `sectionOrder`. |
| Purity | Adapter has no `uni`, `uniCloud`, Vue, Pinia, toast, navigation, suppression, or red-dot imports/calls. |
| Input safety | Frozen/deep-cloned fixture comparison shows no card/task/dog mutation. |
| Section counts | Counts represent total work, while `hiddenCount` represents only folded/hidden rows. |
| Breeding semantics | Main workflow grouped by `step_type`; every row remains one task; no batch affordance metadata. |
| Extra arrangement semantics | Extra arrangements are breeding sublayer rows, not health reminders. |
| Health semantics | Backend batch cards are preserved as batch rows with `tasks`, `dogs`, `progress`. |
| Subtype identity | Vaccine and deworming subtype keys remain distinct. |
| Medication semantics | Rows derive from medication card dogs/allMedTasks and sort pending, partial, done. |
| Red-dot invariant | Future medication-only dates have both count and cards in task-service tests. |
| Side-effect boundary | New components, if added, emit typed events only; home page still owns cloud calls and reconciliation. |

### Wave 0 Gaps

- [ ] `src/types/home-workbench.ts` - shared view-model and event payload types for WB-02/WB-05.
- [ ] `src/utils/homeWorkbench.ts` - pure adapter for WB-01/WB-04/VERIFY-01.
- [ ] `tests/utils/homeWorkbench.test.ts` - adapter unit tests for VERIFY-01.
- [ ] `tests/cloud-objects/task-service.test.ts` additions - deworming subtype key and future medication `getWeekCards` card presence for VERIFY-02.

## Open Questions

1. **Should Phase 1 wire adapter output into `home/index.vue` rendering, or only compute it behind the current UI?**
   - What we know: Success criteria mention typed event boundary and homepage behavior, but out-of-scope excludes full visual UI.
   - What's unclear: Whether minimal section rendering must use adapter immediately.
   - Recommendation: Plan a low-risk computed integration (`const todayWorkbench = computed(...)`) and keep existing SmartCard render unless explicit hidden-count UI is required for WB-04.

2. **How strict should WB-04 be in Phase 1 for existing `DogCard`/`BatchCard` slices?**
   - What we know: Backend no-truncation is already tested; component-local slices still exist.
   - What's unclear: Whether Phase 1 must remove those UI slices or only create the contract that later phases consume.
   - Recommendation: Treat silent slices as a Phase 1 validation finding; adapter must expose hidden counts, and any Phase 1 component shell must render explicit expand/fold. Full card replacement can wait for later phases.

3. **Should `src/types/task.ts` be expanded or should a separate home card type be introduced?**
   - What we know: `src/types/task.ts` is stale relative to SmartCard card types.
   - What's unclear: How much of the current `any` card shape should be formalized now.
   - Recommendation: Add `src/types/home-workbench.ts` with minimal local `HomeCard`/`HomeTask` interfaces and leave broad task refactoring out of scope.

## Sources

### Primary (HIGH confidence)

- `.planning/phases/01-workbench-contract-test-foundation/01-CONTEXT.md` - locked phase decisions and scope.
- `.planning/REQUIREMENTS.md` - WB/VERIFY requirement IDs.
- `.planning/ROADMAP.md` - Phase 1 goal and success criteria.
- `CLAUDE.md` and `AGENTS.md` - project constraints, homepage invariants, graphify rules.
- `graphify-out/GRAPH_REPORT.md` and `graphify/worksets/home-attention.json` - code graph and relevant home-attention file set.
- `.planning/research/SUMMARY.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md` - milestone architecture and risk synthesis.
- `src/pages/home/index.vue` - current page orchestration, sections, suppression, red-dot and action boundary.
- `src/components/smart-card/*.vue` - current SmartCard contract and component-local semantics.
- `src/stores/taskStore.ts` - raw card cache and FAB recommendation dependency.
- `src/composables/useSubmitFeedback.ts` and health record pages - return-to-home feedback contract.
- `uniCloud-alipay/cloudfunctions/task-service/index.obj.js` - homepage card facts and backend grouping.
- `tests/cloud-objects/task-service.test.ts`, `tests/helpers/mock-unicloud.ts`, `vitest.config.ts` - validation infrastructure.
- `package.json`, `pnpm-lock.yaml`, `pnpm list --depth 0` - locked stack versions.

### Secondary (MEDIUM confidence)

- `docs/design/02-features.md` - product-level homepage/card design. Some older card limits conflict with the current WB-04 direction and should be superseded by phase constraints.
- `.planning/codebase/TESTING.md`, `.planning/codebase/CONCERNS.md` - codebase testing and risk audits.

### Tertiary (LOW confidence)

- None. No web-only findings used.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - verified from local package files and installed tools.
- Architecture: HIGH - based on current source files, graphify workset, and milestone research.
- Pitfalls: HIGH - based on existing code paths and tests; UI slice remediation strictness remains an open planning question.
- Validation: HIGH - existing Vitest infrastructure is clear; component-level testing remains absent by project design.

**Research date:** 2026-04-15  
**Valid until:** 2026-05-15, or earlier if homepage/task-service contracts change.
