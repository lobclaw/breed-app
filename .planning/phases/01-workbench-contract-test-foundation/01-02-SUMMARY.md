---
phase: 01-workbench-contract-test-foundation
plan: "02"
subsystem: testing
tags: [vitest, task-service, home-workbench, unicloud]

requires: []
provides:
  - task-service invariant coverage for deworming subtype batch keys
  - task-service invariant coverage for future medication-only WeekStrip cards
  - task-service invariant coverage for weaning_confirm non-batch workflow cards
affects: [phase-01, health-batch-first-workbench, medication-state-workbench, breeding-step-workbench]

tech-stack:
  added: []
  patterns:
    - cloud-object characterization tests through taskService._mergeTasks and taskService.getWeekCards

key-files:
  created:
    - .planning/phases/01-workbench-contract-test-foundation/01-02-SUMMARY.md
  modified:
    - tests/cloud-objects/task-service.test.ts

key-decisions:
  - "Kept VERIFY-02 as backend invariant coverage only; no task-service production code changes were needed."
  - "Used getWeekCards, not only getDateCounts, to prove future medication-only days expose actual therapy cards."

patterns-established:
  - "Health batch identity tests assert subtype-bearing card IDs, not just card counts."
  - "Breeding milestone tests assert mergeTasks leaves workflow cards unsectioned until buildSectionedCards annotates them."

requirements-completed: [WB-04, VERIFY-02]

duration: 4min
completed: 2026-04-15
---

# Phase 01 Plan 02: Task-Service Invariant Coverage Summary

**Cloud-object tests now lock health subtype batch keys, future medication-only therapy cards, and weaning workflow non-batch behavior.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-15T11:39:48Z
- **Completed:** 2026-04-15T11:42:07Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added deworming subtype collision coverage proving `deworming_type + drug_name` creates distinct same-day batch card IDs.
- Added `getWeekCards` coverage proving future medication-only days return a real `sections.therapy` medication card, not only red-dot counts.
- Added weaning confirmation coverage proving `breeding_milestone` tasks with `litter_id` remain individual breeding dog workflow cards and never become batch cards.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add deworming subtype collision test** - `5012237` (test)
2. **Task 2: Add future medication card and weaning non-batch tests** - `809a8d5` (test)

**Plan metadata:** recorded in the final docs commit for this plan.

## Files Created/Modified

- `tests/cloud-objects/task-service.test.ts` - Added VERIFY-02 backend invariant tests for health subtype keys, future medication cards, and breeding workflow non-batch behavior.
- `.planning/phases/01-workbench-contract-test-foundation/01-02-SUMMARY.md` - Captures execution outcome, verification, and state handoff.

## Decisions Made

- Kept the plan test-only because the backend implementation already satisfied the new invariants.
- Treated the TDD RED runs as characterization checks: the newly added tests passed against existing production code, so no GREEN implementation commit was required.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The TDD RED expectation did not fail because the behavior already existed. I verified this by running the focused suite after adding each task's tests and kept the scope to test coverage only.
- A parallel executor created or modified files outside this plan's ownership; those files were not staged or committed by this plan.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `pnpm test tests/cloud-objects/task-service.test.ts` - passed, 28 tests.
- `./scripts/graphify-rebuild.sh` - passed, rebuilt graphify output with 1177 nodes and 1661 edges.
- Stub scan on `tests/cloud-objects/task-service.test.ts` - no TODO/FIXME/placeholder stub patterns found.

## Next Phase Readiness

Phase 1 can rely on backend facts for VERIFY-02: workbench UI changes can assume health subtype batch IDs do not collide, future medication-only dates have actual cards, and weaning confirmation workflow items stay non-batch.

## Self-Check: PASSED

- Found `.planning/phases/01-workbench-contract-test-foundation/01-02-SUMMARY.md`.
- Found `tests/cloud-objects/task-service.test.ts`.
- Found task commit `5012237`.
- Found task commit `809a8d5`.

---
*Phase: 01-workbench-contract-test-foundation*
*Completed: 2026-04-15*
