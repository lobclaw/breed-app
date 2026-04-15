# Phase 1: Workbench Contract & Test Foundation - Context

**Gathered:** 2026-04-15  
**Status:** Ready for planning  
**Source:** User-provided planning notes + GSD roadmap Phase 1

<domain>

## Phase Boundary

This phase builds the safe foundation for the later homepage density work. It does not implement the full visible UI redesign yet. It creates a typed, pure workbench adapter and test coverage so later phases can render:

- 繁育流程: `步骤分组 + 单犬/单窝行`
- 健康提醒: batch-first grouping while preserving true health record completion
- 用药: `未完成 / 部分完成 / 已完成` ordering
- 今日重点: derived later from the finalized workbench model

Current Phase 1 must deliver only the contract/test foundation:

- Typed workbench view model.
- Pure adapter from already-filtered homepage cards to sections/groups/rows/hidden counts.
- Minimal component/event contract if needed.
- Tests for the adapter and relevant `task-service` invariants.

</domain>

<decisions>

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

</decisions>

<canonical_refs>

## Canonical References

Downstream agents MUST read these before planning or implementing.

### GSD Planning

- `.planning/PROJECT.md` — current project context and core value.
- `.planning/REQUIREMENTS.md` — Phase 1 requirement IDs `WB-01..05`, `VERIFY-01..02`.
- `.planning/ROADMAP.md` — phase boundary, success criteria, and later phase sequencing.
- `.planning/research/SUMMARY.md` — milestone-level research synthesis.
- `.planning/research/ARCHITECTURE.md` — recommended frontend workbench view-model layer.
- `.planning/research/PITFALLS.md` — fragile areas and prevention strategies.

### Project Rules

- `AGENTS.md` — homepage task rules, graphify rules, submit feedback rules, WeekStrip red-dot invariants.
- `docs/design/02-features.md` — homepage design and reminder rules.
- `graphify-out/GRAPH_REPORT.md` — code graph overview.
- `graphify/worksets/home-attention.json` — focused workset for homepage attention code.

### Likely Code Targets

- `src/pages/home/index.vue` — homepage orchestration, loading, suppression, optimistic removal, dayCounts, sections rendering.
- `src/types/task.ts` — current task/card related types.
- `src/stores/taskStore.ts` — cached homepage cards/counts.
- `src/components/smart-card/SmartCard.vue` — current smart-card dispatcher.
- `src/components/smart-card/DogCard.vue` — current individual card routing/events.
- `src/components/smart-card/BatchCard.vue` — current health batch card semantics.
- `src/components/smart-card/MedicationCard.vue` — current medication card semantics.
- `src/components/smart-card/SickObservationCard.vue` — current disease observation card.
- `uniCloud-alipay/cloudfunctions/task-service/index.obj.js` — source of homepage card facts and `mergeTasks`.
- `tests/cloud-objects/task-service.test.ts` — existing task-service tests.

</canonical_refs>

<specifics>

## Specific Ideas

- Preferred new files if planner agrees:
  - `src/types/home-workbench.ts`
  - `src/utils/homeWorkbench.ts`
  - `tests/utils/homeWorkbench.test.ts`
- Adapter should provide explicit hidden counts instead of truncating data.
- Test fixtures should cover:
  - multiple `breeding_milestone` cards sharing the same `step_type`
  - `breeding_extra_arrangement` kept separate from workflow
  - health `batch` card preserved
  - health subtype key separation
  - `medication` rows ordered by state
  - overdue priority above business domain sections
  - input immutability
- `task-service` tests should keep guarding:
  - `breeding_milestone` does not become a batch card
  - same-day vaccination/deworming subtype groups do not collide
  - future medication-only dates still get WeekStrip red dots

</specifics>

<deferred>

## Deferred Ideas

- Full breeding step-row UI belongs to Phase 2.
- Health batch-first UI belongs to Phase 3.
- Medication incomplete/partial/done UI belongs to Phase 4.
- Overdue compression and final count calibration belong to Phase 5.
- `今日重点` belongs to Phase 6.

</deferred>

---

*Phase: 01-workbench-contract-test-foundation*  
*Context gathered: 2026-04-15 via user planning notes*
