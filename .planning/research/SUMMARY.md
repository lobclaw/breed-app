# Research Summary: 首页工作台密度自适应

**Milestone:** TODO-29 首页工作台密度自适应优化  
**Synthesized from:** `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`  
**Overall confidence:** HIGH for architecture and scope; MEDIUM for exact density thresholds until UAT with 30-50 dog data.

## Key Findings

- This milestone is a **homepage presentation and reconciliation problem**, not a new backend/product model. Keep the existing UniApp Vue 3 + TypeScript + Pinia + UniCloud stack and do not introduce a UI framework, virtual list, date library, new cloud object, or persisted dashboard aggregate.
- Preserve the homepage semantic layers exactly: `逾期 / 繁育 / 健康 / 用药`. Density adaptation should happen **inside each section**, not by rebuilding a unified task pool or adding summary cards, sheets, or second-level pages.
- `task-service` should remain the source of homepage facts: `sectionType`, `domain`, `cardType`, `priority`, `tasks`, `dogs`, `progress`, WeekStrip counts, and business grouping semantics. Frontend density logic should consume this contract and decide row/card/fold rendering.
- Add a tested frontend workbench adapter, such as `homeWorkbench.ts`, that transforms already-filtered cards into renderable sections, groups, compact rows, fold counts, and priority ordering. It must be pure: no cloud calls, routing, suppression timers, toast, or direct card mutation.
- Keep `home/index.vue` as the orchestration and side-effect boundary for loading, `latestLoadToken`, suppression, WeekStrip red dots, optimistic removal, cross-page feedback, and cloud actions. New row/group components should emit typed events instead of calling services directly.
- The highest-risk areas are not visual polish. They are semantic regressions: breeding accidentally becoming batchable, health batch completion losing real `health_record` creation, medication falling back to legacy `tasks(type='medication')`, red-dot drift, and stale responses reviving completed cards.

## Recommended Scope

- Build a **sectioned workbench view model** over existing cards:
  - `逾期`: show urgent items first, compress only after preserving visible urgency and total hidden count.
  - `繁育`: group main workflow by `breeding_milestone.details.step_type`; render single dog/litter rows; keep `额外安排` as a separate child layer.
  - `健康`: preserve true backend `BatchCard` semantics for vaccination/deworming; use compact rows only for non-batch reminders and disease observation density.
  - `用药`: keep `medication_tasks` as source of truth; order rows by 未完成 -> 部分完成 -> 已完成, weakening or folding completed rows when dense.
- Add or align types for the homepage card/workbench contract so density rules do not spread through `any` structures.
- Add homepage-specific components for section/group/row/fold rendering. Keep existing `SmartCard`, `DogCard`, `BatchCard`, `MedicationCard`, and `SickObservationCard` as compatibility and complex-interaction renderers.
- Use explicit fold controls such as “还有 X 项/只” and keep all raw items in memory. No silent `slice(0, 12)` behavior at server or frontend display layer.
- Initial threshold guidance:
  - 逾期: show top 3-4, then explicit expansion.
  - 繁育: group by step, show up to 4 rows per step before expansion.
  - 健康: preserve batch cards; compact/fold large single reminder groups.
  - 用药: show unfinished and partial rows first; fold/weakly display completed rows when count is high.

## Recommended Phase Order

1. **Contract Freeze + Pure Adapter**
   - Create the workbench view-model helper and tests before visual changes.
   - Cover section order, breeding step grouping, extra arrangement separation, health batch preservation, medication ordering, hidden counts, and adapter purity.
   - Rationale: establishes a safe transformation layer without touching fragile load/suppression logic.

2. **Breeding Density Rows**
   - Replace breeding section rendering with step groups and single dog/litter rows.
   - Preserve `follicle_check`, `pregnancy_check`, `weaning_confirm` routing and pass `dogId + dogName + cycleId + taskId + locked=true`.
   - Keep extra arrangements task-only: complete/postpone/skip must not create `breeding_record` or advance the main state machine.
   - Rationale: largest density gain with relatively low write risk because main actions navigate rather than bulk-write.

3. **Health Batch-First Layout**
   - Keep backend-created batch cards as the only batch-completion surface.
   - Add compact grouping for non-batch health rows while preserving subtype keys: `vaccine_type`, `deworming_type`, and `drug_name`.
   - Ensure partial batch completion updates `tasks`, `dogs`, `progress.total`, and title count from backend-authoritative `completedTasks`.
   - Rationale: high product value, but high semantic risk because completion must create real `health_record`.

4. **Medication Row Ordering + Folded Done State**
   - Improve density inside `今日用药` without changing medication facts.
   - Preserve dose-count semantics, multi-drug expansion, local dose optimism, and `health-service.recordMedicationDose` / `batchCompleteMedicationDay`.
   - Rationale: medication has distinct state and should be adapted after the shared section shell is stable.

5. **Overdue Compression + Count Calibration**
   - Apply urgency-first compression to overdue items and audit all pills, badges, WeekStrip red dots, and empty states.
   - Rationale: count and red-dot correctness should be verified after section rendering and group metadata are stable.

6. **Optional Later: 今日重点**
   - Only derive a focus strip from the finalized workbench model.
   - It should scroll/deep-link to original sections, not become another task list.

## Non-Negotiable Constraints

- Homepage layers and order remain fixed: `逾期待处理 → 繁育流程 → 健康提醒 → 今日用药`.
- Do not create a unified task pool, summary-card replacement, second-level list page, or Sheet-based workbench.
- Do not bypass `task-service` with direct clientDB/JQL reads for homepage grouping.
- Do not add server-side or silent frontend truncation. Fold visually, preserve data and counts.
- Keep `latestLoadToken` across `loadAll/loadTodayCards/loadWeekCache/loadDateCounts`.
- Keep suppression filtering after server responses and ensure the workbench adapter consumes already-filtered cards.
- Keep today `dayCounts[todayTs]` correction after `Promise.all`, based on actual visible cards, not `counts.today`.
- Future medication-only dates must still show WeekStrip red dots and cards.
- Breeding workflow rows are never batch-completable. They are individual progress entrances.
- `breeding_milestone` routing must use `details.step_type`; `weaning_confirm` goes to litter detail.
- Health batch completion must create real `health_record`; frontend-only task completion is invalid.
- Batch health partial completion may remove only backend-confirmed `completedTasks`; whole card/group disappears only when all source tasks are completed.
- `sick_only` remains in `健康`, not `用药`.
- Medication workbench must use `medication_tasks`, not legacy `tasks(type='medication')`.
- New components should emit events and let `home/index.vue` perform cloud actions, local reconciliation, suppression, and red-dot updates.
- Date handling must respect timestamp milliseconds and Beijing day boundaries; avoid new ad hoc day math unless tested.

## Deferred / Anti-Features

- Defer user-configurable density modes until business thresholds are validated.
- Defer `今日重点` until section-level density and reconciliation are stable.
- Defer morning/evening work modes, AI summaries, cross-section risk scoring, role-specific workbench behavior, and full calendar replacement.
- Avoid new Pinia store state for purely local fold preferences unless component state becomes unmanageable.
- Avoid a new `home-service`, `workbench_cards` collection, persisted dashboard aggregate, or new runtime dependency.
- Avoid generic “complete visible” actions where folded rows make the target set ambiguous.
- Avoid passing large dense batch payloads through route URLs; if larger batch navigation is introduced later, prefer IDs or a short-lived context token.

## Verification Focus

- Unit tests:
  - `task-service` still returns untruncated cards and distinct `workflow`, `workflow_extra`, `reminders`, `therapy`.
  - `breeding_milestone` never becomes a batch card.
  - Health batch keys include vaccine/deworming subtype fields.
  - Future breeding workflow tasks remain visible in today’s breeding flow.
  - Future medication-only dates retain red dots.
  - Workbench adapter preserves section order, groups breeding by `step_type`, keeps extra arrangements separate, preserves health batch items, sorts therapy rows, reports hidden counts, and does not mutate input.
- Interaction tests or focused component checks:
  - Breeding rows emit route payloads with locked dog/cycle/task context.
  - Health batch rows emit source task IDs without dropping partial-completion metadata.
  - Medication rows emit `medicationTaskId` and do not call cloud services directly.
- Manual UAT:
  - 20+ breeding tasks across several steps show grouped rows with explicit expansion and no batch completion.
  - 12 dogs same vaccine plus 3 dogs another vaccine produce separate health groups.
  - Completing 2 of 5 health batch items leaves a 3-dog card/group with correct title, `dogs`, and `progress.total`.
  - Medication rows sort 未完成 -> 部分完成 -> 已完成, with multi-dose and multi-drug cases intact.
  - Completing or postponing a compact row updates locally before refresh and does not flash back during suppression.
  - Today all-done state clears pills and today red dot according to visible cards, not `counts.today`.
  - Switching dates after optimistic updates does not revive suppressed tasks from `weekCache`.
- Minimum command pass:
  - `pnpm type-check`
  - `pnpm test tests/cloud-objects/task-service.test.ts`
  - `pnpm test tests/cloud-objects/health-service.test.ts`
  - `pnpm test tests/cloud-objects/breeding-service.test.ts`
  - `pnpm test`

