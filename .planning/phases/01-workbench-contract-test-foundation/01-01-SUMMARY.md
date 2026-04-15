---
phase: 01-workbench-contract-test-foundation
plan: "01"
subsystem: ui
tags: [home-workbench, adapter, vitest, typescript]

requires: []
provides:
  - Typed home workbench view model and SmartCard-compatible event payload union.
  - Pure cards-to-workbench adapter with four fixed semantic sections.
  - Adapter tests for grouping, counts, immutability, medication state order, and purity.
affects: [home-workbench, phase-01, phase-02, phase-03, phase-04, phase-06]

tech-stack:
  added: []
  patterns:
    - Pure frontend adapter over already-filtered home cards.
    - Source fact preservation through sourceCard, sourceTask, and sourceDog references.

key-files:
  created:
    - src/types/home-workbench.ts
    - src/utils/homeWorkbench.ts
    - tests/utils/homeWorkbench.test.ts
  modified: []

key-decisions:
  - "Workbench state is derived from already-filtered cards; cloud calls, routing, toast, suppression, and red-dot state stay page-owned."
  - "Breeding workflow rows are task-level rows grouped visually by step_type; health batch cards remain card-level rows."
  - "Medication workbench rows are dog-level rows grouped and sorted as pending, partial, then done."

patterns-established:
  - "WorkbenchSection and WorkbenchGroup both expose rows, visibleRows, hiddenCount, count, and sortRank."
  - "Adapter purity is guarded by a source-text Vitest test against page/cloud boundary strings."

requirements-completed: [WB-01, WB-02, WB-03, WB-04, WB-05, VERIFY-01]

duration: 6min
completed: 2026-04-15
---

# Phase 01 Plan 01: Workbench Contract & Adapter Summary

**Typed workbench contract plus pure card adapter for four-section home density rendering**

## Performance

- **Duration:** 6min
- **Started:** 2026-04-15T11:39:23Z
- **Completed:** 2026-04-15T11:45:26Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added `HomeWorkbenchModel`, section/group/row contracts, permissive card/task/dog facades, and the `HomeWorkbenchEvent` union matching current SmartCard emits.
- Implemented `buildHomeWorkbench(cards, options)` as a pure adapter that produces `逾期 / 繁育 / 健康 / 用药` sections, group metadata, visible row limits, hidden counts, and total counts.
- Locked adapter behavior with Vitest coverage for overdue priority, breeding step grouping, extra arrangements, health subtype grouping, batch source preservation, medication ordering, immutability, and static purity.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define workbench model and typed event contract** - `34f5fda` (feat)
2. **Task 2 RED: Add failing adapter behavior tests** - `5501069` (test)
3. **Task 2 GREEN: Implement pure cards-to-workbench adapter** - `660308c` (feat)
4. **Task 3: Add static purity guardrails for adapter boundary** - `c8fab2a` (test)

## Files Created/Modified

- `src/types/home-workbench.ts` - Workbench section order, source facades, row/group/section model, options, and typed event union.
- `src/utils/homeWorkbench.ts` - Pure adapter and section metadata for deterministic workbench grouping.
- `tests/utils/homeWorkbench.test.ts` - Adapter behavior suite and source-text purity guard.

## Decisions Made

- Kept the adapter independent from Vue, Pinia, UniCloud, navigation, toast, suppression, and WeekStrip red-dot state.
- Used explicit `visibleRows` and `hiddenCount` rather than hard truncation, so later UI can render fold controls without losing source work.
- Preserved original source objects by reference instead of deep-cloning business facts.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- The TDD red run failed because `@/utils/homeWorkbench` did not exist yet, which was expected for Task 2.
- A parallel executor completed Plan 01-02 while this plan was running; no owned files overlapped and no changes were reverted.

## Verification

- `pnpm type-check` - passed
- `pnpm test tests/utils/homeWorkbench.test.ts` - passed, 10 tests
- `pnpm type-check && pnpm test tests/utils/homeWorkbench.test.ts` - passed
- `./scripts/graphify-rebuild.sh` - passed, rebuilt graphify output

## Known Stubs

None. Stub-pattern scan only found default test/helper parameters and adapter option defaults; no UI-facing placeholder data was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 01-03 can wire computed-only workbench state into `src/pages/home/index.vue` without changing existing cloud calls, optimistic removal, suppression, or WeekStrip red-dot ownership. Later visual phases can consume `rows`, `visibleRows`, and `hiddenCount` directly.

## Self-Check: PASSED

- Found created files: `src/types/home-workbench.ts`, `src/utils/homeWorkbench.ts`, `tests/utils/homeWorkbench.test.ts`, and this summary.
- Found commits: `34f5fda`, `5501069`, `660308c`, `c8fab2a`.

---
*Phase: 01-workbench-contract-test-foundation*
*Completed: 2026-04-15*
