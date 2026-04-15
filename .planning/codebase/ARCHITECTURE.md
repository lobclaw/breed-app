# Architecture

**Analysis Date:** 2026-04-15

## Pattern Overview

**Overall:** UniApp client + UniCloud cloud-object backend, organized by business domains and protected by a family-scoped auth layer.

**Key Characteristics:**
- Frontend pages are Vue 3 SFCs under `src/pages/`; shared UI is under `src/components/`; cloud access is centralized through `src/composables/useCloudCall.ts`.
- Backend business logic is implemented as UniCloud cloud objects under `uniCloud-alipay/cloudfunctions/*-service/index.obj.js`.
- Data ownership is family-scoped: business collections contain `family_id`, and cloud object `_before` hooks inject `this.uid`, `this.familyId`, and `this.role`.
- Client state uses Pinia stores with `pinia-plugin-unistorage` for stale-while-revalidate caches in `src/stores/dogStore.ts`, `src/stores/taskStore.ts`, and `src/stores/protocolStore.ts`.
- Business modules use timestamp milliseconds for dates and store local time expectations in page/composable logic such as `src/pages/home/index.vue` and record forms under `src/pages/record/`.

## Layers

**Application Shell:**
- Purpose: Bootstrap Vue, Pinia, theme, auth, uni-id-pages, and cloud prewarm.
- Location: `src/main.ts`, `src/App.vue`
- Contains: `createSSRApp(App)`, Pinia registration, global style imports, `onLaunch` initialization.
- Depends on: `pinia`, `pinia-plugin-unistorage`, `src/composables/useAuth.ts`, `src/composables/useTheme.ts`, `src/uni_modules/uni-id-pages/init.js`.
- Used by: UniApp runtime and all pages configured in `src/pages.json`.

**Routing And Navigation:**
- Purpose: Define all application pages, protected route patterns, native tab entries, and uni-id-pages plugin routes.
- Location: `src/pages.json`
- Contains: Main tabs `pages/home/index`, `pages/dog/list`, `pages/finance/index`, `pages/profile/index`; feature pages under `pages/record/`, `pages/breeding/`, `pages/health/`, `pages/sale/`, `pages/family/`.
- Depends on: UniApp router and `uniIdRouter`.
- Used by: Page code calling `uni.navigateTo`, `uni.switchTab`, `uni.redirectTo`, and the custom bottom nav in `src/components/layout/BNavBar.vue`.

**Page Layer:**
- Purpose: Own screen-level state, query parameters, form composition, cloud calls, and navigation.
- Location: `src/pages/`
- Contains: Domain folders `src/pages/home/`, `src/pages/dog/`, `src/pages/record/`, `src/pages/breeding/`, `src/pages/health/`, `src/pages/finance/`, `src/pages/sale/`, `src/pages/family/`, `src/pages/profile/`.
- Depends on: `src/components/`, `src/composables/useCloudCall.ts`, `src/composables/useAuth.ts`, `src/stores/`, `src/types/`.
- Used by: UniApp routes declared in `src/pages.json`.

**Component Layer:**
- Purpose: Provide reusable UI primitives, form controls, layout shells, feedback states, smart cards, and week calendar strip.
- Location: `src/components/`
- Contains: Base components in `src/components/base/`, layout components in `src/components/layout/`, form components in `src/components/form/`, feedback components in `src/components/feedback/`, smart-card renderers in `src/components/smart-card/`, week strip in `src/components/week-strip/WeekStrip.vue`.
- Depends on: Vue props/emits, CSS tokens from `src/styles/tokens.scss`, domain types where needed.
- Used by: Feature pages and composed components such as `src/components/layout/BFabSheet.vue`.

**Composable Layer:**
- Purpose: Centralize reusable client behavior that is not screen-specific.
- Location: `src/composables/`
- Contains: `src/composables/useCloudCall.ts` for cloud object calls, `src/composables/useAuth.ts` for uni-id/family state, `src/composables/useTheme.ts` for theme state, `src/composables/useSubmitFeedback.ts` for cross-page submit feedback.
- Depends on: UniApp globals `uni` and `uniCloud`, Vue `ref`/`computed`, type files under `src/types/`.
- Used by: Pages and stores.

**Client Store Layer:**
- Purpose: Cache frequently used data and support optimistic or stale-while-revalidate UI.
- Location: `src/stores/`
- Contains: `src/stores/dogStore.ts`, `src/stores/taskStore.ts`, `src/stores/protocolStore.ts`.
- Depends on: `pinia`, `pinia-plugin-unistorage`, `src/composables/useCloudCall.ts`.
- Used by: `src/pages/home/index.vue`, `src/pages/dog/list.vue`, `src/components/layout/BFabSheet.vue`, health medication pages.

**Cloud API Layer:**
- Purpose: Encapsulate business writes, cross-collection reads, workflow transitions, and derived card/stat data.
- Location: `uniCloud-alipay/cloudfunctions/`
- Contains: `dog-service`, `family-service`, `breeding-service`, `health-service`, `finance-service`, `task-service`, plus DCloud plugin cloud objects `uni-id-co` and `uni-captcha-co`.
- Depends on: `uniCloud.database()`, shared auth module `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`, UniCloud runtime hooks `_before` and `_after`.
- Used by: Frontend calls through `src/composables/useCloudCall.ts` and direct prewarm in `src/App.vue`.

**Shared Cloud Auth Layer:**
- Purpose: Verify uni-id tokens, map user to a single active family, enforce family/admin access, and normalize auth errors.
- Location: `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`
- Contains: `verifyAndGetFamily`, `requireFamily`, `requireAdmin`, `createAuthError`.
- Depends on: `uni-id-common`, `uniCloud.database()`, `families.members` records.
- Used by: Business cloud objects including `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/family-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`.

**Database Schema Layer:**
- Purpose: Define UniCloud MongoDB collection shapes, permissions, relationships, and required fields.
- Location: `uniCloud-alipay/database/`
- Contains: Business schemas `dogs`, `families`, `breeding_cycles`, `breeding_records`, `litters`, `health_records`, `medication_tasks`, `tasks`, `expenses`, `incomes`, `sale_records`, `dog_weights`, `medication_protocols`, `agents`; plugin schemas for uni-id/openDB.
- Depends on: UniCloud database deployment.
- Used by: All cloud objects and any clientDB/JQL access.

**Design And Knowledge Layer:**
- Purpose: Store confirmed product decisions, field/page mappings, technical choices, and code graph navigation.
- Location: `docs/design/`, `graphify-out/`, `graphify/worksets/`
- Contains: `docs/design/01-data-model.md`, `docs/design/02-features.md`, `docs/design/03-tech-stack.md`, `docs/design/04-implementation.md`, `docs/design/05-field-page-mapping.md`, `graphify-out/GRAPH_REPORT.md`, domain worksets under `graphify/worksets/`.
- Depends on: Project workflow.
- Used by: Planning, implementation, and architecture/codebase investigation.

## Data Flow

**Authenticated App Launch:**

1. UniApp starts `src/main.ts`, creates the Vue SSR app, installs Pinia, and mounts `src/App.vue`.
2. `src/App.vue` initializes theme through `src/composables/useTheme.ts`.
3. `src/App.vue` initializes uni-id-pages through `src/uni_modules/uni-id-pages/init.js`.
4. `src/App.vue` calls `useAuth().init()` from `src/composables/useAuth.ts`.
5. `src/composables/useAuth.ts` reads `uniCloud.getCurrentUserInfo()` and `uni_id_token`, restores cached family data from `breed_family_cache`, and refreshes family data through `family-service.getFamilyInfo`.
6. `src/pages.json` `uniIdRouter.needLogin` protects main route groups and sends unauthenticated users to `uni_modules/uni-id-pages/pages/login/login-withpwd`.

**Cloud Object Call:**

1. A page or store creates a call wrapper with `useCloudCall('service-name', 'methodName')` in `src/composables/useCloudCall.ts`.
2. `useCloudCall` imports the cloud object with `uniCloud.importObject(serviceName, { customUI: true })`.
3. UniCloud executes the cloud object's `_before` hook, which calls `verifyAndGetFamily(this.getUniIdToken(), this.getClientInfo())`.
4. The cloud object method reads/writes collections through `uniCloud.database()`.
5. `_after` converts thrown errors into `{ errCode, errMsg }`; `useCloudCall` turns those into toasts/errors unless configured otherwise.
6. Page state, Pinia stores, or local optimistic state are updated from the returned `{ data: ... }` payload.

**Home Attention Flow:**

1. `src/pages/home/index.vue` renders cached `taskStore.cards` and `taskStore.counts` immediately when available.
2. `loadAll()` runs `task-service.getHomeCards`, `task-service.getDateCounts`, and `task-service.getWeekCards` in parallel through `src/composables/useCloudCall.ts`.
3. `uniCloud-alipay/cloudfunctions/task-service/index.obj.js` queries `tasks`, `health_records`, `medication_tasks`, and related dog data, then merges raw records into SmartCard-shaped cards.
4. `src/pages/home/index.vue` splits returned cards into overdue, breeding workflow, health reminder, and medication sections.
5. Card actions call `task-service.completeTask`, `task-service.batchCompleteTask`, `task-service.postponeTask`, `health-service.recordMedicationDose`, `health-service.batchCompleteMedicationDay`, or `health-service.updateIllnessStatus`.
6. Optimistic local removal and suppression in `src/pages/home/index.vue` prevent visible cards from reappearing while backend refreshes are in flight.

**Breeding Record Flow:**

1. Record pages under `src/pages/record/breeding-*.vue` gather dog, cycle, date, type-specific details, and optional extra arrangement data.
2. Pages submit to `breeding-service.addBreedingRecord` in `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js`.
3. `breeding-service` creates or reuses a `breeding_cycles` document, inserts a `breeding_records` document, updates cycle status according to `STATUS_TRANSITIONS`, and clears/creates `tasks` milestones.
4. Birth flow in `src/pages/breeding/birth-wizard.vue` calls `breeding-service.addBirthRecord`, which creates `litters`, puppy `dogs`, initial weight records, expenses, and weaning tasks.
5. Litter management in `src/pages/breeding/litter.vue` calls `breeding-service.getLitterDetail`, `confirmWeaning`, `addPuppyToLitter`, `updateBirthDate`, and `updateLitter`.

**Health And Medication Flow:**

1. Health pages under `src/pages/record/health-*.vue` submit vaccination, deworming, illness, and medication data.
2. `health-service.addHealthRecord` and `health-service.batchAddHealthRecords` insert `health_records`, optionally create `tasks`, and create expenses when costs are supplied.
3. `src/pages/record/health-medication.vue` checks duplicates through `health-service.batchCheckDuplicateMedication` before calling `health-service.batchStartMedication`.
4. `health-service.batchStartMedication` creates or overrides `medication_tasks`, creates daily medication `tasks`, records costs, and links active illness records when applicable.
5. Medication progress actions from `src/pages/home/index.vue` call `health-service.recordMedicationDose`, `batchCompleteMedicationDay`, or `endMedicationByDog`.

**Finance And Sales Flow:**

1. Finance pages under `src/pages/finance/` and sale pages under `src/pages/sale/` call `finance-service`.
2. `finance-service.addExpense` and `finance-service.addIncome` write `expenses` and `incomes`.
3. `finance-service.createSaleRecord`, `receiveSaleDeposit`, `completeSale`, and `cancelSale` coordinate `sale_records`, `incomes`, and related `dogs.disposition`.
4. Financial summaries such as `getFinancialSummary`, `getLitterProfit`, and `getDamROI` compute from existing collections at query time.

**State Management:**
- Use local `ref`/`reactive` state inside pages for forms and screen-only UI.
- Use `src/stores/dogStore.ts` for cached dog lists and derived dog filter workflows.
- Use `src/stores/taskStore.ts` for cached home cards/counts and FAB recommendations.
- Use `src/stores/protocolStore.ts` for medication protocols shared by protocol management and medication forms.
- Use `src/composables/useAuth.ts` as a singleton reactive auth/family source, not as a Pinia store.

## Key Abstractions

**Cloud Call Wrapper:**
- Purpose: Standardize `uniCloud.importObject` calls, loading state, toast handling, and error normalization.
- Examples: `src/composables/useCloudCall.ts`, `src/pages/home/index.vue`, `src/pages/finance/index.vue`, `src/pages/record/health-medication.vue`.
- Pattern: Pages destructure `const { run } = useCloudCall<ServiceReturn>('service', 'method', options)` and call `await run(...)`.

**Family-Scoped Auth Context:**
- Purpose: Make every business cloud method operate inside a single family and role context.
- Examples: `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`, `uniCloud-alipay/cloudfunctions/family-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`.
- Pattern: Cloud object `_before` sets `this.uid`, `this.familyId`, and `this.role`, then calls `requireFamily` except for explicitly permitted onboarding methods.

**Smart Cards:**
- Purpose: Convert raw tasks, active medication, illness, care, and breeding workflow state into UI-ready home cards.
- Examples: `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`, `src/components/smart-card/SmartCard.vue`, `src/components/smart-card/DogCard.vue`, `src/components/smart-card/MedicationCard.vue`, `src/components/smart-card/BatchCard.vue`.
- Pattern: Backend composes card payloads; frontend renders by `cardType` and emits actions back to `src/pages/home/index.vue`.

**Breeding Cycle State Machine:**
- Purpose: Keep breeding records, cycle status, milestone tasks, birth/litter state, and weaning linked.
- Examples: `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js`, `src/pages/record/breeding-heat.vue`, `src/pages/breeding/birth-wizard.vue`, `src/pages/breeding/litter.vue`.
- Pattern: Record type drives status transitions and task creation; pages should submit records to `breeding-service` rather than mutate cycle/task collections directly.

**Health Reminder And Medication Task Split:**
- Purpose: Separate health records (`health_records`) from suggested/generated tasks (`tasks`) and active treatment courses (`medication_tasks`).
- Examples: `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`, `src/pages/record/health-vaccination.vue`, `src/pages/record/health-medication.vue`.
- Pattern: Vaccination/deworming/illness records go through `health-service`; medication courses go through `health-service` medication methods; home cards are aggregated by `task-service`.

**Reusable Form Controls:**
- Purpose: Keep dog, cycle, litter, date, image, reminder, and extra-arrangement UI consistent across pages.
- Examples: `src/components/form/BDogPicker.vue`, `src/components/form/BCycleSelector.vue`, `src/components/form/BLitterSelector.vue`, `src/components/form/BDatePicker.vue`, `src/components/form/BImageUpload.vue`, `src/components/form/BFormOptions.vue`, `src/components/form/BExtraArrangementSection.vue`.
- Pattern: Add new form controls under `src/components/form/`; domain pages own data mapping into cloud payloads.

**Design Tokens And Global Styles:**
- Purpose: Provide color, radius, typography, common field, button, sheet, and layout styles.
- Examples: `src/styles/tokens.scss`, `src/styles/fonts.scss`, `src/styles/common.scss`, `src/App.vue`.
- Pattern: `src/App.vue` imports global styles once; page scoped styles should only define page-specific layout differences.

## Entry Points

**UniApp App Factory:**
- Location: `src/main.ts`
- Triggers: UniApp runtime.
- Responsibilities: Create the Vue app, create Pinia, install `pinia-plugin-unistorage`, return `{ app, Pinia }`.

**App Lifecycle:**
- Location: `src/App.vue`
- Triggers: `onLaunch`, `onShow`, `onHide`.
- Responsibilities: Initialize theme, uni-id-pages, auth, global styles, and prewarm `health-service.ping`.

**Route Manifest:**
- Location: `src/pages.json`
- Triggers: UniApp router and build process.
- Responsibilities: Register pages, native tabBar, protected route patterns, uni-id login route, global navigation style.

**Home Page:**
- Location: `src/pages/home/index.vue`
- Triggers: First tab route and `onShow`.
- Responsibilities: Load family state, render attention cards, WeekStrip red dots, optimistic card actions, and cross-page submit feedback.

**Custom Bottom Navigation:**
- Location: `src/components/layout/BNavBar.vue`
- Triggers: Mounted by tab pages.
- Responsibilities: Switch between main tabs and open `src/components/layout/BFabSheet.vue`.

**Business Cloud Objects:**
- Location: `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/family-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/finance-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`
- Triggers: `uniCloud.importObject` calls from pages/stores and UniCloud scheduled `_timing*` methods in `task-service`.
- Responsibilities: Validate inputs, enforce family scope, perform cross-collection operations, return `{ data: ... }`.

**Auth Cloud Module:**
- Location: `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`
- Triggers: Cloud object `_before` hooks.
- Responsibilities: Validate token, resolve active family membership, enforce admin/family access, create auth errors.

**Database Schemas:**
- Location: `uniCloud-alipay/database/*.schema.json`
- Triggers: UniCloud deployment and database permission enforcement.
- Responsibilities: Declare collection fields, required fields, enum values, permissions, and foreign-key metadata.

## Domain Boundaries

**Family And Auth:**
- Owns: `families`, uni-id user/session integration, members, roles, family settings, care rules, invite/join flows.
- Frontend: `src/composables/useAuth.ts`, `src/pages/family/`, `src/pages/profile/defaults.vue`, `src/pages/profile/care-rules.vue`, `src/pages/profile/notifications.vue`.
- Backend: `uniCloud-alipay/cloudfunctions/family-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`, `uniCloud-alipay/cloudfunctions/uni-id-co/`.
- Rule: Cross-domain cloud methods should consume `this.familyId`; do not reimplement token/family lookup outside `breed-auth`.

**Dog Profile:**
- Owns: `dogs`, dog status derivation, dog detail aggregation, disposition changes, puppy promotion, soft delete/restore.
- Frontend: `src/pages/dog/list.vue`, `src/pages/dog/detail.vue`, `src/pages/dog/add.vue`, `src/stores/dogStore.ts`.
- Backend: `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`.
- Rule: Derived statuses come from breeding cycles, litters, illness records, and medication tasks; do not persist these UI statuses as independent dog fields unless design docs change.

**Home Attention And Tasks:**
- Owns: `tasks` aggregation, home card grouping, overdue/today/week counts, task completion, postponement, scheduled audits.
- Frontend: `src/pages/home/index.vue`, `src/pages/home/batch-process.vue`, `src/components/smart-card/`, `src/components/week-strip/WeekStrip.vue`, `src/stores/taskStore.ts`.
- Backend: `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`.
- Rule: Home card shape is backend-composed; pages should avoid duplicating full card aggregation logic.

**Breeding:**
- Owns: `breeding_cycles`, `breeding_records`, `litters`, breeding milestone tasks, birth/weaning flow, extra arrangements.
- Frontend: `src/pages/record/breeding-*.vue`, `src/pages/breeding/cycle.vue`, `src/pages/breeding/birth-wizard.vue`, `src/pages/breeding/litter.vue`, `src/types/breeding.ts`.
- Backend: `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js`, with task interactions in `task-service`.
- Rule: Record creation must flow through `breeding-service.addBreedingRecord`; birth must flow through `breeding-service.addBirthRecord`.

**Health Operations:**
- Owns: `health_records`, `dog_weights`, vaccination/deworming/illness forms, batch health creation, illness status, weight history.
- Frontend: `src/pages/record/health-*.vue`, `src/pages/health/batch-weight.vue`, `src/types/health.ts`.
- Backend: `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`.
- Rule: Batch vaccination/deworming cards completed from home must create real `health_records`, not only complete `tasks`.

**Medication:**
- Owns: `medication_tasks`, medication dose progress, duplicate drug detection, medication protocol library.
- Frontend: `src/pages/record/health-medication.vue`, `src/pages/record/medication-detail.vue`, `src/pages/health/medication-protocols.vue`, `src/stores/protocolStore.ts`.
- Backend: `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`, home aggregation in `task-service`.
- Rule: Active medication APIs live in `health-service`; use that service for new medication workflows.

**Finance And Sales:**
- Owns: `expenses`, `incomes`, `sale_records`, `agents`, finance summaries, sale deposits/completion/cancellation, expense categories.
- Frontend: `src/pages/finance/`, `src/pages/sale/`, `src/pages/profile/expense-categories.vue`, `src/types/finance.ts`.
- Backend: `uniCloud-alipay/cloudfunctions/finance-service/index.obj.js`.
- Rule: Sales state changes should flow through `finance-service` so `sale_records`, `incomes`, and dog disposition stay coordinated.

## Error Handling

**Strategy:** Cloud objects throw normal `Error` objects for validation and permission failures, then `_after` converts them into `{ errCode, errMsg }`; frontend `useCloudCall` converts returned `errCode` into UI errors.

**Patterns:**
- Use cloud object `_after` error normalization in business services such as `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`.
- Use `src/composables/useCloudCall.ts` options for `showError`, `showLoading`, `successMessage`, `successMode`, `loadingMode`, and `throwOnError`.
- Keep network and business error display at the page/composable boundary, not inside reusable UI components.
- Use `BNetworkError` and `BPermissionError` under `src/components/feedback/` for page-level states when needed.

## Cross-Cutting Concerns

**Logging:** Use `console.warn` sparingly on client-side recoverable failures such as `src/composables/useAuth.ts`; cloud objects primarily return normalized errors through `_after`.

**Validation:** Validate user input in pages for immediate UX, then validate authoritatively in cloud objects before writes. Examples include `src/pages/record/health-medication.vue` and `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`.

**Authentication:** Use uni-id-pages on the client and `breed-auth` on the server. Do not call business cloud object methods without their standard `_before` family context unless the method is a clearly marked scheduled `_timing*` method.

**Authorization:** Use `requireFamily` for all family-owned data and `requireAdmin` for admin-only mutations such as family settings, member roles, and protected dog operations.

**Dates:** Store dates as millisecond timestamps. Convert picker strings to timestamps in page code, e.g. `new Date(e.detail.value + 'T00:00:00+08:00').getTime()` in record pages.

**Soft Delete:** Use `deleted_at: null` filtering for collections that support soft deletion, especially `dogs`, `expenses`, and `incomes`; restore/delete flows are surfaced through profile/recycle pages and family/dog/finance services.

---

*Architecture analysis: 2026-04-15*
