# Technology Stack Research: 首页工作台密度自适应

**Project:** breed-app  
**Research type:** Stack dimension for brownfield homepage workbench density adaptation  
**Researched:** 2026-04-15  
**Overall confidence:** HIGH for codebase-fit recommendations; MEDIUM for UI verification coverage because the repo currently lacks Vue component tests.

## Executive Recommendation

继续使用现有 **UniApp Vue 3 + TypeScript + Pinia + UniCloud 云对象** 栈，不引入新的 UI 框架、状态库、虚拟列表库、日期库或后端服务。这个 milestone 的主要难点不是技术选型，而是把现有首页大文件中的「展示密度策略」从「数据加载/乐观更新/红点同步」中拆出来，形成小而可测的首页专用抽象。

推荐做法：

1. **后端继续由 `task-service` 产出首页事实协议**：卡片属于哪个业务域、哪个 section、哪些任务、哪些犬只、哪些 medication task，仍由 `uniCloud-alipay/cloudfunctions/task-service/index.obj.js` 负责。
2. **前端新增首页工作台布局层**：在 Vue 侧根据 `sectionType/domain/cardType/tasks/dogs` 计算「展开、轻量 row、折叠、查看更多、今日重点」等纯展示结构。
3. **把密度规则做成纯函数 + 薄组件**：不要把更多 computed 和模板分支塞回 `src/pages/home/index.vue`；这个页面已经承担加载、WeekStrip、suppression、局部承接和动作处理。
4. **测试优先覆盖纯函数和 `task-service` 协议**：现有 Vitest 适合测云对象与工具函数，不适合直接测 UniApp 页面交互；因此新增的密度计算应尽量脱离 DOM。

## Current Stack Baseline

| Layer | Keep | Version / Location | Confidence | Rationale |
|-------|------|--------------------|------------|-----------|
| App framework | UniApp Vue 3 | `@dcloudio/uni-* 3.0.0-4080420251103001`, `src/manifest.json` | HIGH | 现有 H5/App/支付宝小程序构建、页面路由、云对象调用都基于 UniApp。 |
| UI framework | Vue 3 SFC + `<script setup>` | `vue ^3.4.21`, resolved `3.5.31` | HIGH | 首页和卡片组件已是 Vue 3 SFC；Vue 官方支持 Composition API、provide/inject、typed injection keys。 |
| State | Pinia + pinia-plugin-unistorage | `src/stores/taskStore.ts` | HIGH | 首页已用 `taskStore.cards/counts` 做 stale-while-revalidate 缓存；密度状态不需要全局化。 |
| Backend | UniCloud cloud objects | `uniCloud-alipay/cloudfunctions/task-service/index.obj.js` | HIGH | 首页卡片聚合、计数、任务完成/推迟已集中在 `task-service`。 |
| Styling | SCSS + design tokens | `src/styles/tokens.scss`, `src/styles/common.scss` | HIGH | 现有颜色域和公共控件样式已定义；新首页行/折叠组件应复用 tokens。 |
| Tests | Vitest Node tests | `vitest.config.ts`, `tests/cloud-objects/task-service.test.ts` | HIGH | 现有测试覆盖云对象和工具函数；密度规则应做成纯函数以复用这套测试。 |

## Reuse These Existing Pieces

### Homepage Data And Refresh Contract

Reuse:
- `src/pages/home/index.vue`
  - `loadAll()`
  - `loadTodayCards()`
  - `loadWeekCache()`
  - `loadDateCounts()`
  - `latestLoadToken`
  - `suppressedTaskMap`
  - `filterSuppressedCards()`
  - `syncCardMeta()`
  - `removeCardLocally()`
  - `applyHomeFeedback()`
- `src/stores/taskStore.ts`
  - `cards`
  - `counts`
  - stale-while-revalidate pattern
- `src/components/week-strip/WeekStrip.vue`
  - `dayCounts` red-dot display
  - today/future date selection behavior

Why:
- These are the fragile guards that prevent homepage flashback, stale response overwrite, red-dot mismatch, and partial batch metadata drift.
- Density adaptation is a view transformation and should not change the load pipeline unless the task-service response protocol changes.

Do not:
- Move WeekStrip counts to a separate request chain.
- Write `dayCounts[todayTs]` inside `loadDateCounts()`.
- Remove `latestLoadToken`.
- Remove suppression filtering after optimistic completion.
- Reintroduce server or frontend hard truncation such as `cards.slice(0, 12)`.

### Smart Card Rendering

Reuse:
- `src/components/smart-card/SmartCard.vue`
- `src/components/smart-card/DogCard.vue`
- `src/components/smart-card/BatchCard.vue`
- `src/components/smart-card/MedicationCard.vue`
- `src/components/smart-card/SickObservationCard.vue`
- `src/components/smart-card/CareGroupCard.vue`

Why:
- Current card components already encode important domain behavior:
  - Breeding milestone routing by `details.step_type`.
  - Batch health completion emits `autoRecord`.
  - Medication rows support dose counting, multi-drug expansion, and completion states.
  - Sick observation has a working collapse pattern backed by `uni.setStorageSync`.

Recommended use:
- Keep `SmartCard` for high-action cards and existing batch/medication workflows.
- Add lighter row components for dense workbench groups instead of mutating every existing card into a compact mode.

Avoid:
- A generic `density="compact"` prop that forces all card types to support every layout mode. It will spread density concerns into domain components and make medication/batch semantics harder to reason about.

### Cloud APIs

Reuse:
- `task-service.getHomeCards`
- `task-service.getWeekCards`
- `task-service.getDateCounts`
- `task-service.completeTask`
- `task-service.batchCompleteTask`
- `task-service.postponeTask`
- `health-service.recordMedicationDose`
- `health-service.batchCompleteMedicationDay`
- `health-service.updateIllnessStatus`
- `health-service.endMedicationByDog`
- `src/composables/useCloudCall.ts`

Why:
- The homepage is already correctly routed through cloud objects rather than clientDB/JQL.
- The cloud-object boundary enforces family scope through `breed-auth` and centralizes cross-collection writes.

Avoid:
- Direct clientDB/JQL reads from the homepage for extra grouping data.
- A new `home-service` cloud object.
- A new `workbench_cards` collection or persisted dashboard aggregate for V1.

## New Abstractions To Add

### 1. `src/types/home-workbench.ts`

Add a typed homepage protocol file for cards and density groups.

Recommended contents:

```ts
export type HomeSectionKey = 'overdue' | 'breeding' | 'reminders' | 'therapy'
export type HomeGroupKey = 'workflow-main' | 'workflow-extra' | string
export type HomeDensity = 'expanded' | 'grouped' | 'collapsed'

export interface HomeCardTask {
  _id: string
  type: string
  due_date?: number
  dog_id?: string
  dog_name?: string
  cycle_id?: string
  litter_id?: string
  details?: Record<string, any>
  status?: string
}

export interface HomeCard {
  id: string
  cardType: 'dog' | 'care_group' | 'batch' | 'medication' | 'health_attention' | 'sick_observation'
  sectionType?: 'workflow' | 'workflow_extra' | 'reminders' | 'therapy'
  domain?: 'breeding' | 'health' | 'medication'
  priority: 'overdue' | 'today' | 'upcoming'
  tasks?: HomeCardTask[]
  dogs?: any[]
  groupTitle?: string
  dogId?: string
  dogName?: string
  progress?: { done: number; total: number }
  [key: string]: any
}
```

Why:
- `SmartCard.vue` currently defines `SmartCardData` locally while `home/index.vue` and `taskStore.ts` use `any`.
- Density adaptation will add more grouping logic; without a shared type, regressions will hide behind `any`.

Confidence: HIGH.

### 2. `src/utils/homeWorkbench.ts`

Add pure, framework-light functions for layout decisions.

Recommended functions:
- `buildTodaySections(cards: HomeCard[]): HomeWorkbenchSection[]`
- `buildDaySections(dayCards: HomeCard[]): HomeWorkbenchSection[]`
- `groupBreedingWorkflow(cards: HomeCard[]): HomeWorkbenchGroup[]`
- `groupHealthReminders(cards: HomeCard[]): HomeWorkbenchGroup[]`
- `groupMedicationRows(card: HomeCard): MedicationRowGroups`
- `computeDensity(count: number, section: HomeSectionKey): HomeDensity`
- `rankFocusItems(sections: HomeWorkbenchSection[], limit = 5): HomeFocusItem[]`

Why:
- The existing `todaySections`, `daySections`, `breedingGroups`, and summary pill counts are inline computed blocks in `home/index.vue`.
- Moving layout-only derivation to pure functions makes it testable with Vitest and prevents the page from becoming larger.
- It also keeps the cloud object focused on domain truth rather than viewport/display thresholds.

Confidence: HIGH.

### 3. `src/components/home-workbench/`

Add a small homepage-specific component folder.

Recommended components:
- `HomeSection.vue`: renders a section header, badge, optional group list, and overflow toggle.
- `HomeSectionGroup.vue`: renders a subsection label plus either card feed or compact rows.
- `HomeWorkbenchRow.vue`: compact row for single dog/litter workflow items.
- `HomeOverflowToggle.vue`: `还有 X 件事项` / `收起` toggle.
- `HomeFocusStrip.vue`: optional later component for 「今日重点」.

Why:
- These are homepage layout components, not generic design-system primitives.
- Keeping them outside `smart-card/` avoids turning existing domain cards into a layout-policy grab bag.
- The existing page template already duplicates section rendering between today mode and date mode; these components remove duplication without changing data flow.

Confidence: HIGH.

### 4. Optional `useHomeWorkbenchState`

Add only if collapse/expand state starts to sprawl.

Recommended location:
- `src/pages/home/useHomeWorkbenchState.ts` or `src/composables/useHomeWorkbenchState.ts`

Recommended responsibilities:
- Persist per-section expanded/collapsed choices with `uni.getStorageSync` / `uni.setStorageSync`.
- Keep keys stable by section and group, for example `home_workbench:breeding:follicle_check`.

Why:
- `SickObservationCard` already uses local storage for collapse preference.
- Section collapse state is UI-only and should not enter Pinia unless another tab/page needs it.

Confidence: MEDIUM. Add after first component extraction, not before.

## Backend Protocol Choices

### Keep `task-service` As The Card Protocol Owner

Current `task-service` already:
- Splits sections into `workflow`, `extra_arrangements`, `reminders`, `therapy`.
- Marks cards with `sectionType` and `domain`.
- Keeps breeding workflow out of batch-card merging.
- Produces subtype-safe batch IDs for vaccine/deworming keys.
- Returns full cards without silent 12-card truncation.

Recommendation:
- Evolve `buildSectionedCards()` and `mergeTasks()` only when the frontend lacks stable facts to group correctly.
- Export additional test-only helpers if new backend grouping rules are added, following the existing `_mergeTasks` pattern under `NODE_ENV === 'test'`.

### Add Server Fields Only For Domain Facts

Allowed additions:
- `workflowStepType` derived from `task.details.step_type`.
- `workflowStepOrder` for ordering `follicle_check`, `mating`, `pregnancy_check`, `weaning_confirm`.
- `workbenchGroupKey` when grouping must be stable across frontend and backend.
- `displaySubtitle` if repeated formatting is currently duplicated between cards and rows.

Do not add server fields for:
- `isCollapsed`
- `visibleLimit`
- `densityMode`
- viewport-specific layout choices

Why:
- Backend should own business grouping facts.
- Frontend should own presentation density and user-controlled expansion state.

Confidence: HIGH.

## Section-Specific Stack Choices

### 逾期

Use:
- Existing overdue priority from `task-service`.
- `HomeSection.vue` overflow toggle.
- `SmartCard` for the first few urgent items.

Recommended density rule:
- 1-4 cards: expanded.
- 5+ cards: show top 3-4 by `overdueDays` / due date, then `HomeOverflowToggle`.

Avoid:
- Moving overdue items into a separate page or sheet in this milestone.
- Changing `priority === 'overdue'` semantics.

Confidence: HIGH.

### 繁育

Use:
- `sectionType === 'workflow'`
- `sectionType === 'workflow_extra'`
- `task.details.step_type`
- `DogCard` routing logic as the source of current page routing requirements.

Recommended density rule:
- Group main workflow by step: `发情/卵泡/配种/孕检/生产/断奶`.
- Inside each group, render compact dog/litter rows for large counts.
- Keep `SmartCard`/`DogCard` style for small counts or especially urgent rows.
- Keep extra arrangements in a separate subgroup.

Avoid:
- Batch completion UI for breeding workflow.
- Treating `breeding_extra_arrangement` completion as a breeding record.
- Rewriting the breeding state machine as frontend logic.

Confidence: HIGH.

### 健康

Use:
- Existing `BatchCard` for vaccination/deworming groups that are genuinely batchable.
- Existing `SickObservationCard` collapse pattern for disease observation.
- `task-service` grouping rules for subtype-specific batch keys.

Recommended density rule:
- Preserve batch cards when `cardType === 'batch'`.
- For many single dog reminders, group by task variant (`vaccination:vaccine_type`, `deworming:type/drug`, `illness:condition`) and show compact rows.
- Keep all underlying tasks in memory so partial completion and metadata sync remain correct.

Avoid:
- Completing health reminders in frontend only.
- Mixing sick-only observation into 今日用药.
- Reusing breeding row UI for health batch actions.

Confidence: HIGH.

### 用药

Use:
- Existing `MedicationCard.vue` row state computation:
  - `empty`
  - `partial`
  - `done`
- `medication_tasks` as the source of truth through `health-service`.

Recommended density rule:
- In `MedicationCard` or a new child row component, sort rows: unfinished, partial, done.
- Show unfinished and partial rows first.
- Weakly display or collapse done rows when count is high.

Avoid:
- Reintroducing old `tasks(type='medication')` as a primary model.
- Creating a separate medication dashboard service.
- Flattening medication rows into generic task rows; dose-count semantics are unique.

Confidence: HIGH.

## Libraries And Dependencies

### Do Not Add New Runtime Dependencies

Avoid:
- UI libraries such as Vant/Ant Design/Mint UI.
- Virtual-list libraries.
- VueUse.
- dayjs/date-fns.
- XState or other state-machine libraries.
- Drag/drop, charting, calendar, or gesture libraries.

Why:
- Current task volume is 30-50 dogs, not thousands of rows.
- UniApp cross-platform compatibility is more valuable than web-only convenience.
- The existing risks are business-state and refresh synchronization bugs, not missing third-party UI primitives.
- Existing SCSS tokens, B components, and card components are sufficient for the milestone.

Confidence: HIGH.

### Use Built-In Vue And UniApp Capabilities

Use:
- Vue `computed` for derived sections and counts.
- Vue props/emits for component boundaries.
- Optional Vue provide/inject only if several nested homepage components need the same action handlers.
- UniApp `scroll-view` only as already used by the homepage; keep cross-platform behavior simple.
- `uni.getStorageSync` / `uni.setStorageSync` for local UI collapse preferences.

Why:
- Vue official docs support typed `provide`/`inject` with `InjectionKey`, but this should remain optional. Props/emits are clearer unless action-handler threading becomes noisy.
- Current homepage already uses `scroll-view`, and the milestone does not require a new scroll engine.

Confidence: HIGH for computed/props/emits; MEDIUM for provide/inject because it is useful only if component nesting deepens.

## Explicit Anti-Choices

Do not introduce:
- A new global `homeWorkbenchStore` in Pinia for purely local expansion state.
- A new database collection for precomputed workbench groups.
- A new cloud object just for homepage display.
- Frontend direct database queries for dogs/tasks/health records.
- A generic task pool that recombines `逾期 / 繁育 / 健康 / 用药`.
- A second-level page, sheet-based summary, or full dashboard rewrite for this milestone.
- Infinite scroll/pagination that hides task counts from WeekStrip and summary pills.
- H5-only DOM measurement as a layout requirement.

Also avoid:
- Hard-coded color hex values in new components; use `var(--red)`, `var(--amber)`, `var(--blue)`, `var(--plum)`, `var(--card-dim)`.
- Duplicating `.form-input`, pill-select, section label, or card-feed styling that belongs in `common.scss` or local homepage components.
- New date helper logic that ignores the project timestamp/UTC+8 convention. If date rules are touched, first centralize and test day-boundary helpers.

## Testing And Tooling Commands

Minimum validation for this milestone:

```bash
pnpm type-check
pnpm test tests/cloud-objects/task-service.test.ts
pnpm test
pnpm dev:h5
```

When adding pure density helpers:

```bash
pnpm test tests/utils/home-workbench.test.ts
```

If `task-service` grouping protocol changes:

```bash
pnpm test tests/cloud-objects/task-service.test.ts
```

If Vue files or homepage behavior changes:

```bash
pnpm type-check
pnpm dev:h5
```

Manual verification needed:
- H5 homepage with small and large seeded card counts.
- Alipay mini program or HBuilderX preview for `scroll-view`, sticky-ish header behavior, and text wrapping.
- Partial batch health completion: only completed subset disappears.
- Medication completion: unfinished/partial/done row ordering updates without losing dose count behavior.
- WeekStrip red dots after local removal and background refresh.

After modifying code files in this repo, run:

```bash
./scripts/graphify-rebuild.sh
```

## Recommended Implementation Shape

Phase-suitable stack plan:

1. **Type and pure helper extraction**
   - Add `src/types/home-workbench.ts`.
   - Add `src/utils/homeWorkbench.ts`.
   - Move current `todaySections`, `daySections`, `breedingGroups`, and summary pill derivation into pure helpers.
   - Add Vitest coverage for section ordering and density thresholds.

2. **Component extraction without behavior changes**
   - Add `src/components/home-workbench/HomeSection.vue`.
   - Add `HomeSectionGroup.vue` and `HomeOverflowToggle.vue`.
   - Replace duplicated today/date template branches with shared rendering components.
   - Keep `loadAll`, suppression, WeekStrip, and action handlers in `home/index.vue`.

3. **Density adaptation per section**
   - Breeding: group by workflow step and render compact rows at high counts.
   - Health: preserve `BatchCard`; compact only non-batch single reminders.
   - Medication: sort rows by empty/partial/done; collapse done rows when high count.
   - Overdue: show top urgent items and overflow toggle.

4. **Optional 今日重点**
   - Add `rankFocusItems()` and `HomeFocusStrip.vue` after section behavior is stable.
   - Keep it derived from existing cards; do not create a backend endpoint yet.

## Confidence Assessment

| Recommendation | Confidence | Reason |
|----------------|------------|--------|
| Keep UniApp/Vue 3/UniCloud and add no runtime dependency | HIGH | Existing package, routing, cloud calls, and components are already aligned; density need is presentation logic. |
| Keep `task-service` as card protocol owner | HIGH | Existing tests and service methods already cover homepage card generation, sectioning, counts, and task actions. |
| Add typed homepage protocol | HIGH | Current `any` use will make density grouping risky; type extraction is low-cost and local. |
| Add pure `homeWorkbench` helper functions | HIGH | Fits current Vitest tooling and reduces risk in the 1500+ line homepage file. |
| Add homepage-specific components under `components/home-workbench` | HIGH | Avoids polluting smart-card domain components with layout policy. |
| Use provide/inject for action handlers | MEDIUM | Official Vue supports it, but props/emits are clearer unless component nesting becomes noisy. |
| Do not add virtualization | HIGH | Data volume is small-to-medium; grouping/collapse solves the real UX issue with less cross-platform risk. |
| Do not add persisted dashboard aggregates | HIGH | Current app intentionally uses live computation for V1; indexes and grouping are enough for 30-50 dogs. |

## Sources

Local code and planning:
- `.planning/PROJECT.md`
- `.planning/codebase/STACK.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/CONCERNS.md`
- `.planning/codebase/TESTING.md`
- `docs/design/02-features.md`
- `TODOS.md`
- `graphify-out/GRAPH_REPORT.md`
- `graphify/worksets/home-attention.json`
- `package.json`
- `src/pages/home/index.vue`
- `src/stores/taskStore.ts`
- `src/components/week-strip/WeekStrip.vue`
- `src/components/smart-card/SmartCard.vue`
- `src/components/smart-card/DogCard.vue`
- `src/components/smart-card/BatchCard.vue`
- `src/components/smart-card/MedicationCard.vue`
- `src/components/smart-card/SickObservationCard.vue`
- `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`
- `tests/cloud-objects/task-service.test.ts`

Official docs checked:
- Vue Composition API dependency injection: https://vuejs.org/api/composition-api-dependency-injection.html
- UniApp page documentation: https://en.uniapp.dcloud.io/tutorial/page.html
- UniApp scroll-view documentation attempted via official URL: https://en.uniapp.dcloud.io/component/scroll-view.html

## Open Questions

- Whether this milestone should include a tiny seed/test fixture generator for high-density homepage scenarios. Current tests can validate backend grouping, but visual density still needs manual seeded-data verification.
- Whether `src/types/task.ts` should be updated or replaced later. It appears older than the current SmartCard/task-service protocol, but changing it globally is outside this stack-focused research.
- Whether date boundary helpers should be centralized before or after homepage density work. It is a known fragile area, but not required unless the milestone touches due-date grouping.
