---
phase: 1
slug: workbench-contract-test-foundation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-15
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `1.6.1` |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm test tests/utils/homeWorkbench.test.ts tests/cloud-objects/task-service.test.ts` |
| **Full suite command** | `pnpm test` |
| **Type command** | `pnpm type-check` |
| **Estimated runtime** | ~30-90 seconds locally |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test tests/utils/homeWorkbench.test.ts tests/cloud-objects/task-service.test.ts`
- **After every plan wave:** Run `pnpm type-check && pnpm test`
- **Before `$gsd-verify-work`:** Full suite must be green
- **After code changes:** Run `./scripts/graphify-rebuild.sh`
- **Max feedback latency:** 120 seconds for targeted checks, excluding graphify rebuild

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | WB-01, WB-02, WB-03, WB-04, VERIFY-01 | unit | `pnpm test tests/utils/homeWorkbench.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | WB-05 | type/unit | `pnpm type-check && pnpm test tests/utils/homeWorkbench.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | VERIFY-02 | cloud-object integration | `pnpm test tests/cloud-objects/task-service.test.ts` | ✅ | ⬜ pending |
| 1-03-01 | 03 | 2 | WB-01, WB-02, WB-04, WB-05 | integration/type | `pnpm type-check && pnpm test tests/utils/homeWorkbench.test.ts tests/cloud-objects/task-service.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/types/home-workbench.ts` — shared view-model and event payload types for `WB-02` and `WB-05`
- [ ] `src/utils/homeWorkbench.ts` — pure adapter for `WB-01`, `WB-02`, `WB-03`, `WB-04`, and `VERIFY-01`
- [ ] `tests/utils/homeWorkbench.test.ts` — adapter unit tests for `VERIFY-01`
- [ ] `tests/cloud-objects/task-service.test.ts` additions — subtype and future medication coverage for `VERIFY-02`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No visible UX regression on current home page after behind-the-scenes adapter integration | WB-01, WB-05 | Phase 1 may wire computed state without replacing UI; visual rendering remains page-level | Run H5/app manually, open home page with existing data, confirm current sections still render and card actions still respond |
| Graphify remains current after code changes | VERIFY-04 inherited from milestone rules | Graph rebuild output is a local artifact check, not a unit test | Run `./scripts/graphify-rebuild.sh` and confirm it exits 0 |

---

## Validation Dimensions

| Dimension | Required Check |
|-----------|----------------|
| Contract shape | `HomeWorkbenchModel` has exactly four top-level semantic sections and stable section order |
| Purity | `src/utils/homeWorkbench.ts` does not import or call `uni`, `uniCloud`, Vue, Pinia, toast, navigation, suppression, or red-dot utilities |
| Input safety | Frozen/deep-cloned fixture comparison proves no card/task/dog mutation |
| Section counts | Total counts represent all work; `hiddenCount` represents only folded/hidden rows |
| Breeding semantics | Main workflow groups by `details.step_type`; each row remains one task and has no batch affordance metadata |
| Extra arrangement semantics | Extra arrangements remain a breeding sublayer, not health reminders |
| Health semantics | Backend batch cards are preserved as batch rows with `tasks`, `dogs`, and `progress` |
| Subtype identity | Vaccine and deworming subtype keys remain distinct in cloud tests |
| Medication semantics | Medication rows derive from medication card facts and sort pending, partial, done |
| Red-dot invariant | Future medication-only dates have both counts and cards in task-service tests |
| Side-effect boundary | New components, if added, emit typed events only; `src/pages/home/index.vue` still owns cloud calls and reconciliation |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency target < 120s for targeted checks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-15
