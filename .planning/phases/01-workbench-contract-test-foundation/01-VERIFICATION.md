---
phase: 01-workbench-contract-test-foundation
verified: 2026-04-16T02:07:45Z
status: human_needed
score: 13/13 must-haves verified
human_verification:
  - test: "DogCard hidden task expand/collapse"
    expected: "A dog card with more than 3 tasks shows '还有 X 项，展开', expands inline to all task tags, then shows '收起' without navigating or completing a task."
    why_human: "The code path is verified statically, but visual placement and click behavior need device/browser confirmation."
  - test: "BatchCard hidden dog expand/collapse"
    expected: "A batch card with more than 12 dogs shows '还有 X 只，展开', expands inline to all dog chips, then shows '收起' without opening a sheet, navigating, or changing checked dogs."
    why_human: "The code path is verified statically, but visual placement and touch behavior need device/browser confirmation."
  - test: "Current home rendering unchanged"
    expected: "The home page still renders the existing section/card UI while computed todayWorkbench/dayWorkbench exist only as integration state."
    why_human: "Template wiring was checked, but visual regression requires running the app."
---

# Phase 1: Workbench Contract & Test Foundation Verification Report

**Phase Goal:** 开发者可以在不触碰云调用、路由、toast、suppression 和红点副作用的前提下，可靠生成首页工作台视图模型。  
**Verified:** 2026-04-16T02:07:45Z  
**Status:** human_needed  
**Re-verification:** No - initial verification

## Goal Achievement

The phase goal is achieved by automated verification: the typed contract exists, `buildHomeWorkbench` is pure, home computes workbench models from already-filtered state, side-effect ownership remains in `src/pages/home/index.vue`, and the invariant test suites pass. Status is `human_needed` only because Phase 1 includes visible expand/collapse controls whose final UI behavior should be checked manually.

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Developer can import `buildHomeWorkbench` and get exactly four semantic sections in order. | VERIFIED | `WORKBENCH_SECTION_ORDER` is `['overdue', 'breeding', 'reminders', 'therapy']`; test asserts `sectionOrder`. |
| 2 | Workbench rows preserve all source work while exposing `visibleRows` and `hiddenCount`. | VERIFIED | `WorkbenchSection`/`WorkbenchGroup` include `rows`, `visibleRows`, `hiddenCount`; tests assert 3 rows with 2 visible and 1 hidden. |
| 3 | Breeding milestone grouping is visual only; each workflow row carries one `taskId` and no batch metadata. | VERIFIED | `buildTaskRows` emits `kind: 'task'`, `taskId`, `sourceTask`; task-service tests prove breeding milestones do not become batch cards. |
| 4 | Health batch cards remain card rows with original tasks, dogs, and progress preserved. | VERIFIED | Adapter test checks `sourceCard.tasks`, `sourceCard.dogs`, and `sourceCard.progress` preserve original references. |
| 5 | Medication dog rows sort pending before partial before done. | VERIFIED | Adapter uses `MEDICATION_STATE_RANK`; tests assert pending, partial, done row order. |
| 6 | Adapter is pure: no cloud calls, routing, toast, Vue/Pinia, suppression, or red-dot state. | VERIFIED | Static source test forbids those strings; direct grep found no forbidden boundary dependency in `src/utils/homeWorkbench.ts`. |
| 7 | Task-service tests prove deworming subtype keys include both `deworming_type` and `drug_name`. | VERIFIED | Test `不同驱虫类型和药名的同日任务不应合并到同一批量卡`; production `getTaskVariantKey` returns `deworming:type:drug`. |
| 8 | Task-service tests prove future medication-only dates return therapy cards, not only red-dot counts. | VERIFIED | `getWeekCards` test seeds `med_future_week_1` and asserts `sections.therapy` contains one medication card. |
| 9 | Task-service tests prove `weaning_confirm` milestones remain individual workflow cards and never batch cards. | VERIFIED | Test `确认断奶繁育流程节点带 litter_id 也不应合并为批量卡` asserts dog cards and no batch. |
| 10 | Home can compute today's workbench model from already-suppressed `cards.value` without replacing rendering. | VERIFIED | `todayWorkbench = computed(() => buildHomeWorkbench(cards.value, { visibleRowLimit: 4 }))`; template still loops `todaySections`. |
| 11 | Home can compute selected future day's workbench model from already-suppressed `dayCards.value` without replacing rendering. | VERIFIED | `dayWorkbench = computed(() => buildHomeWorkbench(dayCards.value, { visibleRowLimit: 4 }))`; template still loops `daySections`. |
| 12 | DogCard task tags and BatchCard dog chips disclose hidden items with expand/collapse instead of silent hiding. | VERIFIED | `hiddenTaskCount/tasksExpanded` and `hiddenDogCount/dogsExpanded` exist; old exact silent cap patterns are absent. |
| 13 | Cloud calls, route handlers, toast, suppression, optimistic removal, batch metadata sync, latest token, and red-dot correction remain page-owned. | VERIFIED | `useCloudCall`, `navigateTo`, `showToast`, `suppressedTaskMap`, `removeCardLocally`, `syncCardMeta`, `latestLoadToken`, and `dayCounts` logic remain in `src/pages/home/index.vue`. |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/types/home-workbench.ts` | Workbench model and typed event contract | VERIFIED | Exports section order, model types, and `HomeWorkbenchEvent`; no side-effect imports. |
| `src/utils/homeWorkbench.ts` | Pure cards-to-workbench adapter | VERIFIED | Exports `WORKBENCH_SECTION_META` and `buildHomeWorkbench`; groups sections, rows, hidden counts, medication states. |
| `tests/utils/homeWorkbench.test.ts` | Adapter behavior and purity tests | VERIFIED | 10 tests cover section order, grouping, preservation, hidden counts, immutability, and boundary purity. |
| `tests/cloud-objects/task-service.test.ts` | Backend invariant coverage | VERIFIED | 28 task-service tests include subtype keys, future medication cards, and breeding non-batch behavior. |
| `src/pages/home/index.vue` | Computed-only workbench integration point | VERIFIED | Imports `buildHomeWorkbench`, computes `todayWorkbench` and `dayWorkbench`, leaves current rendering and side-effect ownership in page. |
| `src/components/smart-card/DogCard.vue` | Explicit hidden task disclosure | VERIFIED | Adds `TASK_COMPACT_LIMIT`, `tasksExpanded`, `hiddenTaskCount`, `taskExpandText`, and `@click.stop` local toggle. |
| `src/components/smart-card/BatchCard.vue` | Explicit hidden dog disclosure | VERIFIED | Adds `DOG_COMPACT_LIMIT`, `dogsExpanded`, `hiddenDogCount`, `dogExpandText`, and `@click.stop` local toggle. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `tests/utils/homeWorkbench.test.ts` | `src/utils/homeWorkbench.ts` | `import buildHomeWorkbench` | WIRED | gsd-tools verified pattern; tests invoke adapter directly. |
| `src/utils/homeWorkbench.ts` | `src/types/home-workbench.ts` | type imports/constants | WIRED | gsd-tools verified type-only imports from `@/types/home-workbench`. |
| `tests/cloud-objects/task-service.test.ts` | `uniCloud-alipay/cloudfunctions/task-service/index.obj.js` | `_mergeTasks` and `getWeekCards` | WIRED | gsd-tools verified `_mergeTasks|getWeekCards`; focused tests passed. |
| `src/pages/home/index.vue` | `src/utils/homeWorkbench.ts` | computed `buildHomeWorkbench` calls | WIRED | Manual verification: lines compute from `cards.value` and `dayCards.value`; gsd-tools regex failed only because the plan pattern was malformed. |
| `src/components/smart-card/DogCard.vue` | `card.tasks` | `visibleTasks`, `hiddenTaskCount`, `tasksExpanded` | WIRED | Local computed state reads all tasks and toggles visibility with `@click.stop`. |
| `src/components/smart-card/BatchCard.vue` | `card.dogs` | `visibleDogs`, `hiddenDogCount`, `dogsExpanded` | WIRED | Local computed state reads all dogs and toggles visibility with `@click.stop`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `src/pages/home/index.vue` | `todayWorkbench` | `cards.value` populated by `fetchCards()` / `task-service.getHomeCards`, then `filterSuppressedCards` | Yes - cloud call result is used; no static fixture fallback | FLOWING |
| `src/pages/home/index.vue` | `dayWorkbench` | `dayCards.value` from `weekCache`, populated by `fetchWeekCards()` / `task-service.getWeekCards`, then `filterSuppressedCards` | Yes - cloud call result is used; no static fixture fallback | FLOWING |
| `src/utils/homeWorkbench.ts` | section/group/row model | readonly `HomeCard[]` passed by page/tests | Yes - preserves `sourceCard`, `sourceTask`, `sourceDog`; no hardcoded empty data | FLOWING |
| `src/utils/homeWorkbench.ts` | medication row state | `card.dogs[].allMedTasks` generated by `task-service.computeMedItemsForDay` and rendered by `MedicationCard` | Yes - production task-service creates `allMedTasks` with dose facts | FLOWING |
| `src/components/smart-card/DogCard.vue` | `visibleTasks` | `props.card.tasks` | Yes - renders existing card tasks; hidden remainder disclosed via count | FLOWING |
| `src/components/smart-card/BatchCard.vue` | `visibleDogs` | `props.card.dogs` | Yes - renders existing card dogs; hidden remainder disclosed via count | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| TypeScript/Vue compilation | `pnpm type-check` | `vue-tsc --noEmit` exited 0 | PASS |
| Focused Phase 1 tests | `pnpm test tests/utils/homeWorkbench.test.ts tests/cloud-objects/task-service.test.ts` | 2 files passed, 38 tests passed | PASS |
| Full test suite | `pnpm test` | 7 files passed, 88 tests passed | PASS |
| No old silent hard-cap patterns | `rg "slice(0, 12)|slice(0, 3)" ...` | no matches in home adapter/smart-card paths | PASS |
| Adapter boundary purity | `rg "uniCloud|useCloudCall|from 'vue'|..." src/types/home-workbench.ts src/utils/homeWorkbench.ts` | no matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| WB-01 | 01-01, 01-03 | 首页继续固定展示 `逾期 / 繁育 / 健康 / 用药` 四层语义，不恢复统一待办池。 | SATISFIED | `WORKBENCH_SECTION_ORDER` and existing `todaySections`/`daySections` preserve four sections. |
| WB-02 | 01-01, 01-03 | Workbench view model 能从已过滤 cards 生成区块、组、行、隐藏数量和排序信息。 | SATISFIED | `buildHomeWorkbench(cards.value/dayCards.value)` returns sections/groups/rows/counts/sort ranks; tests pass. |
| WB-03 | 01-01, 01-03 | Adapter 是纯函数，不发云调用、不修改输入、不处理 toast、路由或 suppression。 | SATISFIED | Static purity test and grep verify no side-effect dependencies; immutability test passes. |
| WB-04 | 01-01, 01-02, 01-03 | 首页不得静默硬截断；数量过多时显式展开/收起。 | SATISFIED | Backend 13-card test passes; DogCard/BatchCard expose hidden counts and expand controls; old exact caps absent. |
| WB-05 | 01-01, 01-03 | 新增工作台组件只 emit typed events；云调用、乐观移除、suppression 和红点同步仍由首页处理。 | SATISFIED | `HomeWorkbenchEvent` exists; no new side-effect component introduced; page still owns all cloud/route/toast/reconciliation functions. |
| VERIFY-01 | 01-01, 01-03 | Adapter 单测覆盖区块顺序、繁育分组、健康批量保留、用药排序、隐藏数量、输入不可变。 | SATISFIED | `tests/utils/homeWorkbench.test.ts` passed 10 tests covering these cases. |
| VERIFY-02 | 01-02 | `task-service` 测试确认繁育不进 batch、健康 subtype key 不冲突、未来用药红点存在。 | SATISFIED | `tests/cloud-objects/task-service.test.ts` passed 28 tests, including the required added invariants. |

No Phase 1 requirement IDs from `.planning/REQUIREMENTS.md` are orphaned. The roadmap maps exactly `WB-01`, `WB-02`, `WB-03`, `WB-04`, `WB-05`, `VERIFY-01`, and `VERIFY-02` to Phase 1, and every ID appears in at least one plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| None blocking | - | - | - | Grep found only benign initial state/default parameters and an existing input placeholder. No TODO/FIXME, placeholder implementation, hardcoded empty rendered data, or console-only implementation blocks the phase goal. |

### Human Verification Required

### 1. DogCard Hidden Task Expansion

**Test:** Open a dog card with more than 3 tasks and tap the inline expand control.  
**Expected:** It shows `还有 X 项，展开`, expands all task tags inline, then shows `收起`; no navigation or task action fires.  
**Why human:** Static checks prove the local toggle exists, but visual placement and event behavior need app/device confirmation.

### 2. BatchCard Hidden Dog Expansion

**Test:** Open a batch card with more than 12 dogs and tap the inline expand control.  
**Expected:** It shows `还有 X 只，展开`, expands all dog chips inline, then shows `收起`; no sheet, route, backend call, or selection change is triggered.  
**Why human:** Static checks prove the local toggle exists, but visual placement and touch behavior need app/device confirmation.

### 3. Home Rendering Regression

**Test:** Load the home page in today mode and selected-date mode.  
**Expected:** The existing card UI still renders from `todaySections` and `daySections`; the new workbench computed state does not change visible layout yet.  
**Why human:** The template was checked statically, but visual regression requires running the app.

### Gaps Summary

No implementation gaps were found. Automated verification confirms the Phase 1 contract, adapter, backend invariants, and low-risk home integration. Manual UI checks remain for visual/touch confirmation of the smart-card expand controls and unchanged home rendering.

---

_Verified: 2026-04-16T02:07:45Z_  
_Verifier: Claude (gsd-verifier)_
