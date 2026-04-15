---
phase: 01-workbench-contract-test-foundation
plan: "03"
subsystem: ui
tags: [home-workbench, smart-card, vue, vitest, graphify]

requires:
  - phase: 01-workbench-contract-test-foundation
    provides: Typed home workbench adapter from Plan 01 and task-service invariant coverage from Plan 02.
provides:
  - Computed-only `todayWorkbench` and `dayWorkbench` integration on the home page.
  - Inline expand/collapse controls for hidden DogCard task tags.
  - Inline expand/collapse controls for hidden BatchCard dog chips.
  - Integrated Phase 1 validation gate covering type-check, focused tests, full suite, and graphify rebuild.
affects: [home-workbench, phase-02, phase-03, phase-04, phase-06, smart-card]

tech-stack:
  added: []
  patterns:
    - Computed workbench models derive from already-filtered homepage card arrays.
    - Compact card rows disclose hidden items through local expand/collapse controls.

key-files:
  created:
    - .planning/phases/01-workbench-contract-test-foundation/01-03-SUMMARY.md
  modified:
    - src/pages/home/index.vue
    - src/components/smart-card/DogCard.vue
    - src/components/smart-card/BatchCard.vue

key-decisions:
  - "Kept current homepage rendering intact; `todayWorkbench` and `dayWorkbench` are computed integration points for later visual phases."
  - "Expanded DogCard and BatchCard hidden-item disclosure with component-local state only, without Sheet, route, backend, or parent event ownership changes."

patterns-established:
  - "Homepage workbench state is available beside existing `todaySections` and `daySections` without replacing them."
  - "Smart-card compact limits use named constants plus hidden-count text rather than silent `slice(...)` caps."

requirements-completed: [WB-01, WB-02, WB-03, WB-04, WB-05, VERIFY-01]

duration: 4min
completed: 2026-04-15
---

# Phase 01 Plan 03: Home Workbench Integration Summary

**Computed homepage workbench state plus explicit smart-card expand controls for hidden tasks and dogs.**

## Performance

- **Duration:** 4min
- **Started:** 2026-04-15T11:49:43Z
- **Completed:** 2026-04-15T11:52:51Z
- **Tasks:** 3
- **Files modified:** 3 implementation files plus this summary

## Accomplishments

- Wired `buildHomeWorkbench` into `src/pages/home/index.vue` as `todayWorkbench` and `dayWorkbench`, both derived from the same filtered card arrays used by current rendering.
- Replaced DogCard's silent 3-task cap with `TASK_COMPACT_LIMIT`, `hiddenTaskCount`, and inline `还有 X 项，展开` / `收起` controls.
- Replaced BatchCard's silent 12-dog cap with `DOG_COMPACT_LIMIT`, `hiddenDogCount`, and inline `还有 X 只，展开` / `收起` controls.
- Ran the Phase 1 integrated validation gate and refreshed graphify after code changes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add computed workbench integration without rendering changes** - `b0a4150` (feat)
2. **Task 2: Replace visible smart-card silent caps with inline expand controls** - `d9ee22f` (feat)
3. **Task 3: Run Phase 1 integrated validation and graph refresh** - `6af3be7` (chore, empty validation commit)

## Files Created/Modified

- `src/pages/home/index.vue` - Imports `buildHomeWorkbench` and computes `todayWorkbench` / `dayWorkbench` beside existing section state.
- `src/components/smart-card/DogCard.vue` - Adds local task expansion state and hidden task disclosure control.
- `src/components/smart-card/BatchCard.vue` - Adds local dog expansion state and hidden dog disclosure control.
- `.planning/phases/01-workbench-contract-test-foundation/01-03-SUMMARY.md` - Captures execution outcome and validation.

## Decisions Made

- Kept `todaySections`, `daySections`, summary pills, cloud calls, route handlers, toast feedback, suppression, optimistic removal, batch metadata sync, latest-token protection, and `dayCounts` correction page-owned and unchanged.
- Used component-local `ref` state for expand/collapse so controls do not navigate, open sheets, mutate checked dog state, or call backend APIs.
- Created an empty Task 3 validation commit because graphify rebuilt successfully without leaving tracked artifact changes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `./scripts/graphify-rebuild.sh` reported updated graph outputs, but the rebuilt tracked files were unchanged relative to git. No generated graph changes were committed.
- `state update-progress` reported 100% completion but left stale 67% progress text in `STATE.md`; the state metadata was corrected before the final docs commit.

## Known Stubs

None. Stub-pattern scan found only existing empty/reset state assignments and an existing input placeholder; no new UI-facing stub or placeholder data was introduced.

## User Setup Required

None - no external service configuration required.

## Verification

- `rg -n "import \\{ buildHomeWorkbench \\} from '@/utils/homeWorkbench'" src/pages/home/index.vue` - passed
- `rg -n "const todayWorkbench = computed\\(\\(\\) => buildHomeWorkbench\\(cards\\.value, \\{ visibleRowLimit: 4 \\}\\)\\)" src/pages/home/index.vue` - passed
- `rg -n "const dayWorkbench = computed\\(\\(\\) => buildHomeWorkbench\\(dayCards\\.value, \\{ visibleRowLimit: 4 \\}\\)\\)" src/pages/home/index.vue` - passed
- `rg -n "latestLoadToken|filterSuppressedCards|syncCardMeta|removeCardLocally|applyHomeFeedback|dayCounts\\.value\\[todayTs\\]" src/pages/home/index.vue` - passed
- `rg -n "TASK_COMPACT_LIMIT|tasksExpanded|hiddenTaskCount|taskExpandText" src/components/smart-card/DogCard.vue` - passed
- `rg -n "DOG_COMPACT_LIMIT|dogsExpanded|hiddenDogCount|dogExpandText" src/components/smart-card/BatchCard.vue` - passed
- `rg -n "visibleTasks = computed\\(\\(\\) => \\(props\\.card\\.tasks \\|\\| \\[\\]\\)\\.slice\\(0, 3\\)\\)|visibleDogs = computed\\(\\(\\) => \\(props\\.card\\.dogs \\|\\| \\[\\]\\)\\.slice\\(0, 12\\)\\)" src/components/smart-card/DogCard.vue src/components/smart-card/BatchCard.vue` - no matches, passed
- `rg -n "BSheet|BottomSheet|uniCloud|useCloudCall|showActionSheet" src/components/smart-card/DogCard.vue src/components/smart-card/BatchCard.vue` - no matches, passed
- `pnpm type-check` - passed
- `pnpm type-check && pnpm test tests/utils/homeWorkbench.test.ts` - passed
- `pnpm test tests/utils/homeWorkbench.test.ts tests/cloud-objects/task-service.test.ts` - passed, 38 tests
- `pnpm test` - passed, 88 tests
- `./scripts/graphify-rebuild.sh` - passed, rebuilt 1212 nodes and 1731 edges

## Next Phase Readiness

Phase 2 can consume `todayWorkbench` / `dayWorkbench` without moving homepage side effects. Current DogCard and BatchCard paths now satisfy WB-04 by disclosing hidden work while later dense section UI remains deferred.

## Self-Check: PASSED

- Found summary file: `.planning/phases/01-workbench-contract-test-foundation/01-03-SUMMARY.md`.
- Found implementation files: `src/pages/home/index.vue`, `src/components/smart-card/DogCard.vue`, `src/components/smart-card/BatchCard.vue`.
- Found task commits: `b0a4150`, `d9ee22f`, `6af3be7`.

---
*Phase: 01-workbench-contract-test-foundation*
*Completed: 2026-04-15*
