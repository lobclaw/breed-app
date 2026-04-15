# Codebase Structure

**Analysis Date:** 2026-04-15

## Directory Layout

```text
breed-app/
├── AGENTS.md                         # Project instructions and domain rules for agents
├── package.json                      # UniApp/Vite/Vitest scripts and dependencies
├── vite.config.ts                    # UniApp Vite plugin and dev server config
├── tsconfig.json                     # Vue/TypeScript compiler settings and @ alias
├── src/                              # UniApp frontend source root
│   ├── main.ts                       # Vue app factory and Pinia setup
│   ├── App.vue                       # App lifecycle, auth/theme init, global style imports
│   ├── pages.json                    # UniApp route/tab/auth configuration
│   ├── manifest.json                 # UniApp platform/provider configuration
│   ├── pages/                        # Route-level Vue pages grouped by domain
│   ├── components/                   # Shared UI, layout, form, smart-card components
│   ├── composables/                  # Reusable client behavior and cloud call wrappers
│   ├── stores/                       # Pinia stores with unistorage persistence
│   ├── styles/                       # Design tokens, fonts, global common SCSS
│   ├── types/                        # Shared TypeScript domain types
│   ├── utils/                        # Small domain helpers
│   ├── static/                       # Bundled fonts and tab assets
│   └── uni_modules/                  # DCloud frontend plugin modules
├── uniCloud-alipay/                  # UniCloud Alipay backend root
│   ├── cloudfunctions/               # Business and plugin cloud objects/common modules
│   └── database/                     # UniCloud MongoDB collection schemas
├── docs/design/                      # Confirmed product, data, feature, and implementation docs
├── graphify/                         # Workset definitions for focused code graph navigation
├── graphify-out/                     # Generated code graph, report, cache, and visualization
├── scripts/                          # Graphify helper scripts
├── tests/                            # Vitest tests for cloud objects and utilities
└── .planning/codebase/               # Generated mapper reference documents
```

## Directory Purposes

**`src/`:**
- Purpose: All application frontend code compiled by UniApp/Vite.
- Contains: App entry files, pages, components, composables, Pinia stores, SCSS, TS types, assets, and DCloud frontend plugins.
- Key files: `src/main.ts`, `src/App.vue`, `src/pages.json`, `src/manifest.json`.

**`src/pages/`:**
- Purpose: Route-level screens; each `.vue` file maps to a route in `src/pages.json`.
- Contains: Domain subdirectories for home, dog profile, records, breeding, health, finance, sales, family, and profile settings.
- Key files: `src/pages/home/index.vue`, `src/pages/dog/list.vue`, `src/pages/dog/detail.vue`, `src/pages/record/health-medication.vue`, `src/pages/breeding/birth-wizard.vue`, `src/pages/finance/index.vue`.

**`src/pages/home/`:**
- Purpose: Home attention system and batch task processing.
- Contains: `src/pages/home/index.vue` for cards, WeekStrip, optimistic task handling, and submit feedback; `src/pages/home/batch-process.vue` for batch task handling.
- Key files: `src/pages/home/index.vue`, `src/pages/home/batch-process.vue`.

**`src/pages/dog/`:**
- Purpose: Dog list, detail, creation, and editing flows.
- Contains: `src/pages/dog/list.vue`, `src/pages/dog/detail.vue`, `src/pages/dog/add.vue`.
- Key files: `src/pages/dog/list.vue` uses `src/stores/dogStore.ts`; `src/pages/dog/detail.vue` aggregates dog, breeding, health, litter, finance, and weight data.

**`src/pages/record/`:**
- Purpose: Record entry/detail/edit screens for breeding, health, medication, observations, and monitor flows.
- Contains: Breeding forms `src/pages/record/breeding-heat.vue`, `src/pages/record/breeding-follicle.vue`, `src/pages/record/breeding-mating.vue`, `src/pages/record/breeding-pregnancy.vue`, `src/pages/record/breeding-prenatal.vue`, `src/pages/record/breeding-prelabor.vue`, `src/pages/record/breeding-termination.vue`; health forms `src/pages/record/health-vaccination.vue`, `src/pages/record/health-deworming.vue`, `src/pages/record/health-illness.vue`, `src/pages/record/health-medication.vue`; detail/edit pages.
- Key files: `src/pages/record/health-medication.vue`, `src/pages/record/health-vaccination.vue`, `src/pages/record/breeding-mating.vue`, `src/pages/record/breeding-detail.vue`, `src/pages/record/health-detail.vue`.

**`src/pages/breeding/`:**
- Purpose: Cycle and litter lifecycle screens outside generic record entry.
- Contains: `src/pages/breeding/cycle.vue`, `src/pages/breeding/litter.vue`, `src/pages/breeding/birth-wizard.vue`.
- Key files: `src/pages/breeding/birth-wizard.vue` writes birth/litter/puppy flow; `src/pages/breeding/litter.vue` handles weaning and litter updates.

**`src/pages/health/`:**
- Purpose: Health operational screens that are not single health record forms.
- Contains: `src/pages/health/batch-weight.vue`, `src/pages/health/medication-protocols.vue`.
- Key files: `src/pages/health/batch-weight.vue`, `src/pages/health/medication-protocols.vue`.

**`src/pages/finance/`:**
- Purpose: Expense/income list, add/edit/detail, stats, ROI, litter profit, and projection screens.
- Contains: `src/pages/finance/index.vue`, `expense-*`, `income-*`, `stats.vue`, `litter-profit.vue`, `dam-roi.vue`, `projection.vue`.
- Key files: `src/pages/finance/index.vue`, `src/pages/finance/expense-add.vue`, `src/pages/finance/income-add.vue`, `src/pages/finance/stats.vue`.

**`src/pages/sale/`:**
- Purpose: Sale lifecycle and agent management.
- Contains: `src/pages/sale/list.vue`, `src/pages/sale/detail.vue`, `src/pages/sale/create.vue`, `src/pages/sale/agents.vue`.
- Key files: `src/pages/sale/detail.vue` calls deposit/complete/cancel sale methods in `finance-service`.

**`src/pages/family/`:**
- Purpose: Family onboarding, invite/join, and member management.
- Contains: `src/pages/family/setup.vue`, `src/pages/family/invite.vue`, `src/pages/family/join.vue`, `src/pages/family/members.vue`.
- Key files: `src/pages/family/setup.vue`, `src/pages/family/members.vue`.

**`src/pages/profile/`:**
- Purpose: Profile tab, app settings, family settings, care rules, backup/recycle, operation log, and expense category management.
- Contains: `src/pages/profile/index.vue`, `notifications.vue`, `defaults.vue`, `care-rules.vue`, `backup.vue`, `recycle.vue`, `operation-log.vue`, `expense-categories.vue`, `about.vue`.
- Key files: `src/pages/profile/index.vue`, `src/pages/profile/care-rules.vue`, `src/pages/profile/expense-categories.vue`.

**`src/components/base/`:**
- Purpose: Small presentational primitives.
- Contains: `BButton`, `BCard`, `BCheckbox`, `BIconBox`, `BPill`, `BProgress`, `BSectionLabel`, `BTag`.
- Key files: `src/components/base/BButton.vue`, `src/components/base/BTag.vue`, `src/components/base/BIconBox.vue`.

**`src/components/layout/`:**
- Purpose: Structural UI, navigation, overlays, sheets, modals, and page headers.
- Contains: `BNavBar`, `BFabSheet`, `BSheet`, `BModal`, `BDeleteConfirm`, `BPageHeader`, `BTabBar`.
- Key files: `src/components/layout/BNavBar.vue`, `src/components/layout/BFabSheet.vue`, `src/components/layout/BSheet.vue`, `src/components/layout/BModal.vue`.

**`src/components/form/`:**
- Purpose: Reusable form controls for dog/cycle/litter selection, dates, image upload, form reminder options, and breeding extra arrangements.
- Contains: `BDogPicker`, `BCycleSelector`, `BLitterSelector`, `BDatePicker`, `BImageUpload`, `BInput`, `BFormOptions`, `BExtraArrangementSection`.
- Key files: `src/components/form/BDogPicker.vue`, `src/components/form/BFormOptions.vue`, `src/components/form/BExtraArrangementSection.vue`.

**`src/components/smart-card/`:**
- Purpose: Home attention card rendering.
- Contains: `SmartCard` dispatcher and card variants `DogCard`, `BatchCard`, `MedicationCard`, `CareGroupCard`, `SickObservationCard`.
- Key files: `src/components/smart-card/SmartCard.vue`, `src/components/smart-card/MedicationCard.vue`, `src/components/smart-card/BatchCard.vue`.

**`src/components/feedback/`:**
- Purpose: Empty, skeleton, network, permission, and submit feedback components.
- Contains: `BEmpty`, `BSkeleton`, `BNetworkError`, `BPermissionError`, `BSubmitBanner`.
- Key files: `src/components/feedback/BSubmitBanner.vue`, `src/components/feedback/BSkeleton.vue`.

**`src/components/week-strip/`:**
- Purpose: Week-based date strip for home red dots and day switching.
- Contains: `src/components/week-strip/WeekStrip.vue`.
- Key files: `src/components/week-strip/WeekStrip.vue`.

**`src/composables/`:**
- Purpose: Cross-page behavior and shared client state outside Pinia.
- Contains: `src/composables/useCloudCall.ts`, `src/composables/useAuth.ts`, `src/composables/useTheme.ts`, `src/composables/useSubmitFeedback.ts`.
- Key files: `src/composables/useCloudCall.ts` and `src/composables/useAuth.ts`.

**`src/stores/`:**
- Purpose: Persisted client caches and recommendations.
- Contains: `src/stores/dogStore.ts`, `src/stores/taskStore.ts`, `src/stores/protocolStore.ts`.
- Key files: `src/stores/taskStore.ts` for home cards and FAB recommendations; `src/stores/protocolStore.ts` for medication protocols.

**`src/types/`:**
- Purpose: Shared TypeScript domain types.
- Contains: `src/types/dog.ts`, `src/types/family.ts`, `src/types/breeding.ts`, `src/types/health.ts`, `src/types/finance.ts`, `src/types/task.ts`, `src/types/index.ts`.
- Key files: `src/types/index.ts` aggregates exported types.

**`src/styles/`:**
- Purpose: Global design language and shared SCSS.
- Contains: `src/styles/tokens.scss`, `src/styles/fonts.scss`, `src/styles/common.scss`, `src/styles/mixins.scss`.
- Key files: `src/App.vue` imports `tokens.scss`, `fonts.scss`, and `common.scss`.

**`src/static/`:**
- Purpose: Bundled static assets.
- Contains: Fonts in `src/static/fonts/` and tab icons in `src/static/tab/`.
- Key files: `src/static/fonts/MaterialIconsRound.woff2`, `src/static/fonts/PlusJakartaSans.woff2`, `src/static/tab/home.png`.

**`src/uni_modules/`:**
- Purpose: DCloud frontend plugins and generated plugin code.
- Contains: `uni-id-pages`, `uni-id-common`, `uni-captcha`, `uni-popup`, `uni-icons`, `uni-forms`, `uni-easyinput`, `uni-scss`, `uni-transition`, `uni-config-center`, `uni-open-bridge-common`.
- Key files: `src/uni_modules/uni-id-pages/init.js`, `src/uni_modules/uni-id-pages/pages/login/login-withpwd.vue`.

**`uniCloud-alipay/cloudfunctions/`:**
- Purpose: UniCloud backend cloud objects and common modules for Alipay cloud.
- Contains: Business services `dog-service`, `family-service`, `breeding-service`, `health-service`, `finance-service`, `task-service`; plugin services `uni-id-co`, `uni-captcha-co`; shared modules under `common/`.
- Key files: `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`.

**`uniCloud-alipay/cloudfunctions/common/`:**
- Purpose: Shared cloud dependencies used by cloud objects.
- Contains: `breed-auth`, `uni-id-common`, `uni-config-center`, `uni-captcha`, `uni-open-bridge-common`, `uni-cloud-s2s`.
- Key files: `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`.

**`uniCloud-alipay/database/`:**
- Purpose: UniCloud MongoDB collection schemas and indexes.
- Contains: Business schemas such as `dogs.schema.json`, `tasks.schema.json`, `breeding_records.schema.json`, `health_records.schema.json`, `expenses.schema.json`; uni-id/openDB schemas and indexes.
- Key files: `uniCloud-alipay/database/dogs.schema.json`, `uniCloud-alipay/database/families.schema.json`, `uniCloud-alipay/database/tasks.schema.json`, `uniCloud-alipay/database/medication_tasks.schema.json`.

**`docs/design/`:**
- Purpose: Confirmed design source of truth.
- Contains: Data model, feature, tech stack, implementation, field/page mapping docs, and archived validation/audit docs.
- Key files: `docs/design/01-data-model.md`, `docs/design/02-features.md`, `docs/design/03-tech-stack.md`, `docs/design/04-implementation.md`, `docs/design/05-field-page-mapping.md`.

**`graphify/` and `graphify-out/`:**
- Purpose: Code graph and domain workset navigation.
- Contains: Worksets under `graphify/worksets/`, graph report in `graphify-out/GRAPH_REPORT.md`, graph data in `graphify-out/graph.json`.
- Key files: `graphify/worksets/home-attention.json`, `graphify/worksets/breeding-record.json`, `graphify/worksets/health-medication.json`, `graphify-out/GRAPH_REPORT.md`.

**`tests/`:**
- Purpose: Vitest tests for cloud object behavior and utilities.
- Contains: `tests/cloud-objects/`, `tests/helpers/`, `tests/utils/`.
- Key files: `tests/cloud-objects/family-service.test.ts`.

## Key File Locations

**Entry Points:**
- `src/main.ts`: Creates Vue app and installs Pinia persistence.
- `src/App.vue`: Initializes app-level theme/auth/uni-id and imports global SCSS.
- `src/pages.json`: Registers routes, tabBar, and uni-id route protection.
- `src/manifest.json`: Declares UniApp app/platform/UniCloud provider settings.

**Configuration:**
- `package.json`: Scripts for `dev:h5`, `dev:app`, `dev:mp-alipay`, builds, tests, and type checking.
- `vite.config.ts`: UniApp Vite plugin, dev port `5200`, and Sass deprecation options.
- `tsconfig.json`: `@/*` alias to `src/*`, UniApp types, and `src/uni_modules/**` exclusion.
- `vitest.config.ts`: Test runner config and coverage scope.

**Core Logic:**
- `src/composables/useCloudCall.ts`: Frontend cloud object call wrapper.
- `src/composables/useAuth.ts`: Client auth, family cache, uni-id event integration.
- `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`: Cloud auth/family role enforcement.
- `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`: Home card aggregation, task completion, day counts, scheduled task logic.
- `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js`: Breeding records, cycle transitions, litter/birth/weaning logic.
- `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`: Health records, medication, protocols, weights.
- `uniCloud-alipay/cloudfunctions/finance-service/index.obj.js`: Expenses, incomes, stats, sale flow, agents, categories.
- `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`: Dog CRUD, derived status, disposition, soft delete/restore.
- `uniCloud-alipay/cloudfunctions/family-service/index.obj.js`: Family creation, settings, members, care rules, profile support.

**Domain Page Clusters:**
- `src/pages/home/index.vue`: Home attention card UX and WeekStrip coordination.
- `src/pages/dog/list.vue`, `src/pages/dog/detail.vue`, `src/pages/dog/add.vue`: Dog profile workflows.
- `src/pages/record/health-vaccination.vue`, `src/pages/record/health-deworming.vue`, `src/pages/record/health-illness.vue`, `src/pages/record/health-medication.vue`: Health record workflows.
- `src/pages/record/breeding-heat.vue`, `src/pages/record/breeding-follicle.vue`, `src/pages/record/breeding-mating.vue`, `src/pages/record/breeding-pregnancy.vue`, `src/pages/record/breeding-prenatal.vue`, `src/pages/record/breeding-prelabor.vue`, `src/pages/record/breeding-termination.vue`: Breeding record workflows.
- `src/pages/breeding/cycle.vue`, `src/pages/breeding/litter.vue`, `src/pages/breeding/birth-wizard.vue`: Cycle/litter workflows.
- `src/pages/finance/` and `src/pages/sale/`: Finance and sale workflows.
- `src/pages/family/` and `src/pages/profile/`: Family, settings, and profile workflows.

**Testing:**
- `tests/cloud-objects/family-service.test.ts`: Existing cloud-object style unit tests.
- `tests/helpers/`: Shared test helpers.
- `tests/utils/`: Utility test location.
- `vitest.config.ts`: Test discovery and coverage config.

## Naming Conventions

**Files:**
- Vue page files use kebab-case under domain folders: `src/pages/record/health-medication.vue`, `src/pages/breeding/birth-wizard.vue`, `src/pages/profile/expense-categories.vue`.
- Reusable Vue components use `B` prefix and PascalCase where part of the local design system: `src/components/layout/BSheet.vue`, `src/components/form/BDogPicker.vue`, `src/components/base/BButton.vue`.
- Smart card variants use PascalCase with `Card` suffix: `src/components/smart-card/MedicationCard.vue`, `src/components/smart-card/BatchCard.vue`.
- Pinia store files use lower camel domain names with `Store` suffix: `src/stores/dogStore.ts`, `src/stores/taskStore.ts`, `src/stores/protocolStore.ts`.
- Composables use `useX.ts`: `src/composables/useCloudCall.ts`, `src/composables/useAuth.ts`, `src/composables/useTheme.ts`.
- Cloud objects use service directory names with `-service` and an `index.obj.js`: `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`.
- Database schemas use collection name plus `.schema.json`: `uniCloud-alipay/database/health_records.schema.json`.
- Type files use domain names: `src/types/dog.ts`, `src/types/breeding.ts`, `src/types/task.ts`.

**Directories:**
- Page directories are business-domain nouns: `src/pages/home/`, `src/pages/dog/`, `src/pages/record/`, `src/pages/breeding/`, `src/pages/finance/`, `src/pages/sale/`, `src/pages/family/`.
- Component directories group by UI role, not business domain: `src/components/base/`, `src/components/layout/`, `src/components/form/`, `src/components/feedback/`, `src/components/smart-card/`.
- Cloud object directories group by backend service boundary: `uniCloud-alipay/cloudfunctions/dog-service/`, `uniCloud-alipay/cloudfunctions/task-service/`.
- Database collection files use plural snake_case collection names: `breeding_records`, `medication_tasks`, `sale_records`.

## Where to Add New Code

**New Route Page:**
- Primary code: Add a `.vue` page under the matching domain directory in `src/pages/`.
- Route registration: Add the route entry to `src/pages.json`.
- Shared components: Put reusable UI in `src/components/` if another page can use it; keep one-off screen UI inside the page.
- Types: Add domain types to `src/types/<domain>.ts` and re-export through `src/types/index.ts` when shared.

**New Home Card Type:**
- Backend aggregation: Add card construction and grouping in `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`.
- Frontend rendering: Add or extend a card variant under `src/components/smart-card/` and dispatch from `src/components/smart-card/SmartCard.vue`.
- Home behavior: Wire actions in `src/pages/home/index.vue`.
- Types: Update `src/types/task.ts` if the card payload shape is shared.
- Workset: Update `graphify/worksets/home-attention.json` if new files become central to the home domain.

**New Dog Profile Feature:**
- Page UI: Add to `src/pages/dog/detail.vue`, `src/pages/dog/list.vue`, or a new `src/pages/dog/*.vue` route.
- Backend: Add dog-owned operations to `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`.
- Store/cache: Use `src/stores/dogStore.ts` for dog list cache changes.
- Schema: Update `uniCloud-alipay/database/dogs.schema.json` only after updating the design docs in `docs/design/`.

**New Breeding Workflow Feature:**
- Form/page: Add under `src/pages/record/` for record entry or `src/pages/breeding/` for cycle/litter views.
- Backend: Add workflow and cross-collection writes to `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js`.
- Tasks/home: Add milestone or card logic to `uniCloud-alipay/cloudfunctions/task-service/index.obj.js` when it appears on home.
- Shared form pieces: Add to `src/components/form/` when reused by multiple breeding forms.
- Design: Update `docs/design/01-data-model.md`, `docs/design/02-features.md`, or `docs/design/05-field-page-mapping.md` before schema or payload changes.

**New Health Or Medication Feature:**
- Health record forms: Add under `src/pages/record/health-*.vue`.
- Health operational screens: Add under `src/pages/health/`.
- Backend: Use `uniCloud-alipay/cloudfunctions/health-service/index.obj.js` for records, medication, protocols, and weights.
- Home task integration: Use `uniCloud-alipay/cloudfunctions/task-service/index.obj.js` for card/date-count behavior.
- Protocol cache: Use `src/stores/protocolStore.ts` for medication protocols shared across pages.

**New Finance Or Sale Feature:**
- Finance pages: Add under `src/pages/finance/`.
- Sale pages: Add under `src/pages/sale/`.
- Backend: Use `uniCloud-alipay/cloudfunctions/finance-service/index.obj.js` for expenses, incomes, sales, agents, categories, and stats.
- Schema: Add/update collection schema under `uniCloud-alipay/database/` only after design docs are updated.

**New Family/Profile Setting:**
- Family onboarding/member pages: Add under `src/pages/family/`.
- Profile settings pages: Add under `src/pages/profile/`.
- Backend: Use `uniCloud-alipay/cloudfunctions/family-service/index.obj.js`.
- Auth state: Extend `src/composables/useAuth.ts` only for app-wide auth/family concerns.

**New Cloud Object Method:**
- Implementation: Add to the matching `uniCloud-alipay/cloudfunctions/*-service/index.obj.js`.
- Auth: Keep standard `_before` and `_after` patterns; use `requireFamily` and `requireAdmin` from `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`.
- Return shape: Prefer `{ data: ... }` for successful business payloads.
- Frontend call: Use `src/composables/useCloudCall.ts`; avoid direct `uniCloud.importObject` in pages except startup prewarm patterns like `src/App.vue`.
- Tests: Add focused tests under `tests/cloud-objects/` when logic is testable without full UniCloud runtime.

**New Database Collection:**
- Schema: Add `uniCloud-alipay/database/<collection>.schema.json`.
- Backend access: Add writes/reads in an existing domain service or a new `*-service` cloud object if the domain boundary is new.
- Family scope: Include `family_id` for family-owned data and enforce it in cloud queries.
- Design docs: Update `docs/design/01-data-model.md` and relevant feature/field mapping docs first.

**New Shared UI Component:**
- Primitive visual element: Add to `src/components/base/`.
- Modal, sheet, navigation, or page shell: Add to `src/components/layout/`.
- Input/select/date/upload form element: Add to `src/components/form/`.
- Feedback/loading/empty/error state: Add to `src/components/feedback/`.
- Home card renderer: Add to `src/components/smart-card/`.
- Styles: Prefer existing tokens in `src/styles/tokens.scss` and common utilities in `src/styles/common.scss`.

**Utilities:**
- Shared helpers: Add to `src/utils/` for small pure functions such as `src/utils/breedingExtraArrangement.ts`.
- Business logic with database writes: Put in cloud objects, not `src/utils/`.
- Page-only helpers: Keep inside the `.vue` page script when no other module needs them.

## Special Directories

**`.planning/codebase/`:**
- Purpose: Generated codebase reference documents consumed by GSD planning/execution.
- Generated: Yes
- Committed: Project workflow-dependent
- Guidance: Add mapper docs here only when invoked by mapping workflows; do not mix runtime application code into this directory.

**`graphify-out/`:**
- Purpose: Generated knowledge graph and navigation report.
- Generated: Yes
- Committed: Present in workspace
- Guidance: Read `graphify-out/GRAPH_REPORT.md` before architecture/codebase questions and use `graphify/worksets/` for focused business domains.

**`.graphify-worksets/`:**
- Purpose: Generated staged corpora for graphify worksets.
- Generated: Yes
- Committed: Project workflow-dependent
- Guidance: Use `./scripts/graphify-workset.sh show <workset>` and `./scripts/graphify-workset.sh build <workset>` rather than manually editing generated corpus files.

**`dist/`:**
- Purpose: UniApp build output.
- Generated: Yes
- Committed: Typically no
- Guidance: Do not place source files here.

**`src/uni_modules/`:**
- Purpose: DCloud frontend plugin modules.
- Generated: Partly vendor-managed
- Committed: Yes
- Guidance: Prefer project-level wrappers and pages over editing plugin internals unless the feature explicitly targets a DCloud plugin.

**`uniCloud-alipay/cloudfunctions/*/node_modules/`:**
- Purpose: Cloud object local dependencies generated from each cloud function package.
- Generated: Yes
- Committed: Present in workspace
- Guidance: Edit source modules under `uniCloud-alipay/cloudfunctions/common/` or cloud object package declarations, not copied dependency contents under service `node_modules/`.

**`uniCloud-alipay/cloudfunctions/common/uni-config-center/`:**
- Purpose: UniCloud plugin configuration.
- Generated: Project/deployment config
- Committed: Present in workspace
- Guidance: Treat config files as sensitive; do not quote secrets or tokens in docs or logs.

**`docs/design/archive/`:**
- Purpose: Archived validation/audit design docs.
- Generated: No
- Committed: Yes
- Guidance: Use active design docs in `docs/design/` first; archived docs are historical reference only.

---

*Structure analysis: 2026-04-15*
