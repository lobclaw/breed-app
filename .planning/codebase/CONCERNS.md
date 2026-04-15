# Codebase Concerns

**Analysis Date:** 2026-04-15

## Tech Debt

**Monolithic page and cloud-object files:**
- Issue: Several core workflows are implemented as large, mixed-responsibility files that combine UI state, navigation, optimistic updates, validation, persistence calls, and domain rules.
- Files: `src/pages/dog/detail.vue` (2973 lines), `src/pages/home/index.vue` (1532 lines), `uniCloud-alipay/cloudfunctions/task-service/index.obj.js` (1375 lines), `uniCloud-alipay/cloudfunctions/health-service/index.obj.js` (1159 lines), `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js` (951 lines), `uniCloud-alipay/cloudfunctions/finance-service/index.obj.js` (949 lines).
- Impact: Small behavioral changes require scanning broad state surfaces and increase regression risk in homepage cards, breeding flow, medication tasks, and finance/sales.
- Fix approach: Extract domain helpers behind tested pure functions first, then split cloud-object methods by workflow while preserving existing public method names.

**Multi-collection writes without transactions or durable compensation:**
- Issue: Core commands write multiple collections sequentially and rely on comments, post-write checks, or silent catches instead of atomicity.
- Files: `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js` (`addBreedingRecord`, `addBirthRecord`), `uniCloud-alipay/cloudfunctions/health-service/index.obj.js` (`batchAddHealthRecords`, `batchStartMedication`, `addWeightRecord`), `uniCloud-alipay/cloudfunctions/finance-service/index.obj.js` (`completeSale`, `cancelSale`), `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js` (`updateDogName`, `changeDisposition`).
- Impact: Partial failure can leave records without tasks, expenses without source records, sales without matching dog disposition, or stale denormalized dog names.
- Fix approach: Use UniCloud transactions where collection count and platform limits allow; otherwise add idempotency keys, family-scoped reconciliation jobs, and explicit repair methods surfaced in admin UI.

**Denormalized name sync is incomplete and partially unscoped:**
- Issue: `updateDogName` only updates `tasks`, `breeding_cycles`, and `litters`, and its related collection writes omit `family_id` filters.
- Files: `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js:306`, `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js:308`, `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js:317`.
- Impact: `health_records`, `expenses`, `incomes`, `sale_records`, and `medication_tasks` can retain stale `dog_name` / `dog_names`. Omitted `family_id` filters make correctness depend on globally unique IDs and increase blast radius if IDs are reused or imported.
- Fix approach: Centralize dog display-name derivation or maintain a family-scoped denormalized-field update list that covers every stored name field.

**Legacy medication model compatibility remains in active code paths:**
- Issue: The task service still merges old `tasks.type === 'medication'` records with new `medication_tasks` records.
- Files: `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:141`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:225`, `src/components/smart-card/MedicationCard.vue:159`, `uniCloud-alipay/cloudfunctions/health-service/index.obj.js:866`.
- Impact: Homepage medication behavior depends on two data models with different statuses and field names, making duplicate detection, completion, and progress display fragile.
- Fix approach: Add a one-time migration and remove old daily task compatibility after verifying no production data depends on it.

**Planning/docs-only features are wired in UI before backend support:**
- Issue: Some profile and finance UI paths call cloud methods or show controls that have no implementation.
- Files: `src/pages/profile/backup.vue:77`, `src/pages/profile/recycle.vue:68`, `src/pages/profile/recycle.vue:69`, `src/pages/finance/expense-add.vue:214`, `src/pages/finance/income-add.vue:174`, `src/pages/home/index.vue:659`.
- Impact: Users can reach dead ends for backup export, recycle restore/delete, finance linking, and month calendar.
- Fix approach: Hide or disable entry points until the matching cloud method exists, or implement the backend slice with tests before exposing the navigation.

## Known Bugs

**Medication detail page calls a non-existent cloud object:**
- Symptoms: The medication detail page imports `medication-service` methods, but no `uniCloud-alipay/cloudfunctions/medication-service` exists.
- Files: `src/pages/record/medication-detail.vue:254`, `src/pages/record/medication-detail.vue:255`, `src/pages/record/medication-detail.vue:259`, `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`.
- Trigger: Opening `/pages/record/medication-detail?id=...`.
- Workaround: Use homepage medication cards or health-service methods directly; the detail page requires refactor to `health-service` (`recordMedicationDose`, `endMedication`) and `actual_start_date` fields.

**Medication detail page expects old field names and statuses:**
- Symptoms: The page reads `task.start_date`, `task.end_date`, `task.completed_dates`, `task.completed_map`, and `status === 'active'`, while current records use `actual_start_date`, `duration_days`, `daily_doses`, and Chinese statuses such as `进行中`.
- Files: `src/pages/record/medication-detail.vue:58`, `src/pages/record/medication-detail.vue:173`, `src/pages/record/medication-detail.vue:202`, `src/pages/record/medication-detail.vue:217`, `uniCloud-alipay/database/medication_tasks.schema.json`.
- Trigger: Any medication task detail render after the current `medication_tasks` model is used.
- Workaround: Use `src/components/smart-card/MedicationCard.vue` for operational completion until the detail page is aligned.

**Profile backup contract mismatch:**
- Symptoms: Backup page reads `last_backup` / `auto_backup` and calls `exportData`; family service returns `lastBackupDate` / `autoBackupEnabled` and does not define `exportData`.
- Files: `src/pages/profile/backup.vue:76`, `src/pages/profile/backup.vue:77`, `src/pages/profile/backup.vue:90`, `src/pages/profile/backup.vue:100`, `uniCloud-alipay/cloudfunctions/family-service/index.obj.js:434`.
- Trigger: Opening backup settings and attempting backup/export or toggling auto backup.
- Workaround: Treat backup UI as non-functional until response fields and methods are implemented consistently.

**Recycle bin restore/delete methods are missing:**
- Symptoms: Recycle page calls `restoreItem` and `permanentDeleteItem`, but family service only implements `getDeletedItems`.
- Files: `src/pages/profile/recycle.vue:67`, `src/pages/profile/recycle.vue:68`, `src/pages/profile/recycle.vue:69`, `uniCloud-alipay/cloudfunctions/family-service/index.obj.js:414`.
- Trigger: Tapping restore or permanent delete in recycle bin.
- Workaround: Use `dog-service.restoreDog` for dogs; no generic record/sale recycle path exists.

**Quick complete sheet is dead and has a wrong completeTask signature:**
- Symptoms: `showQuickComplete` / `quickCompleteTask` are declared and rendered but never assigned; if triggered, `doCompleteTask(taskId, quickCompleteDate, notes)` passes a timestamp into `completeTask(taskId, autoRecord)`.
- Files: `src/pages/home/index.vue:159`, `src/pages/home/index.vue:463`, `src/pages/home/index.vue:1065`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:931`.
- Trigger: Any future code that opens the quick-complete sheet.
- Workaround: Use existing card complete/postpone actions; remove the dead sheet or add a dedicated cloud method for completion date/notes.

**Cycle selector uses stale status/date fields:**
- Symptoms: `BCycleSelector` sorts by `start_date`, reads `cycle_number` / `record_count`, and checks English status `pregnant`, while current cycle data uses Chinese statuses and does not write `start_date` in `addBreedingRecord`.
- Files: `src/components/form/BCycleSelector.vue:143`, `src/components/form/BCycleSelector.vue:150`, `src/components/form/BCycleSelector.vue:167`, `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js:340`.
- Trigger: Opening cycle selector for breeding-related forms.
- Workaround: Prefer cycle IDs supplied by homepage/task navigation; align selector with `created_at`, dynamic cycle number, and Chinese statuses.

## Security Considerations

**Database schema permissions are broadly open or auth-only without family isolation:**
- Risk: Several custom schemas use `permission: true`; others require only `auth.uid != null`. Direct clientDB/JQL paths can bypass cloud-object `_before` family injection unless every query adds `family_id`.
- Files: `uniCloud-alipay/database/dogs.schema.json:4`, `uniCloud-alipay/database/health_records.schema.json:4`, `uniCloud-alipay/database/breeding_records.schema.json:4`, `uniCloud-alipay/database/families.schema.json:4`, `uniCloud-alipay/database/sale_records.schema.json:4`, `uniCloud-alipay/database/tasks.schema.json:4`, `uniCloud-alipay/database/expenses.schema.json:4`, `uniCloud-alipay/database/incomes.schema.json:4`.
- Current mitigation: Cloud objects consistently call `verifyAndGetFamily` and use `family_id` in most server queries.
- Recommendations: Tighten schemas to authenticated/family-scoped permission expressions; restrict direct collection writes; add tests that simulate cross-family clientDB access.

**Direct clientDB queries omit family filters and use string interpolation:**
- Risk: `prelabor-monitor` and `BCycleSelector` query collections from the client using interpolated IDs and no `family_id` guard.
- Files: `src/pages/record/prelabor-monitor.vue:215`, `src/pages/record/prelabor-monitor.vue:217`, `src/components/form/BCycleSelector.vue:137`, `src/components/form/BCycleSelector.vue:140`.
- Current mitigation: Data entry routes normally supply IDs from already authorized pages.
- Recommendations: Move these reads behind cloud-object methods or add parameterized JQL with `family_id == $currentUserFamilyId` and schema-level family restrictions.

**Role permissions are not enforced across most business services:**
- Risk: Helpers can call most dog, health, breeding, task, finance, and sale methods because `_before` only requires family membership.
- Files: `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js:11`, `uniCloud-alipay/cloudfunctions/health-service/index.obj.js:292`, `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js:292`, `uniCloud-alipay/cloudfunctions/finance-service/index.obj.js:16`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:550`, `docs/design/04-implementation.md:435`.
- Current mitigation: Some admin-only checks exist for family settings and dog deletion (`requireAdmin`).
- Recommendations: Define a role matrix per method and enforce `requireAdmin` or helper-limited permissions in every cloud object.

**Client-side image upload has no ownership envelope:**
- Risk: `BImageUpload` uploads directly to `images/...` using timestamp plus `Math.random` and stores only file IDs in records. There is no size/MIME validation beyond `chooseImage`, no family/user path, and deleting from a form only removes the reference.
- Files: `src/components/form/BImageUpload.vue:59`, `src/components/form/BImageUpload.vue:67`, `src/components/form/BImageUpload.vue:69`, `src/components/form/BImageUpload.vue:93`.
- Current mitigation: `uni.chooseImage` uses compressed images.
- Recommendations: Route uploads through a cloud-object signed path or family-scoped prefix, validate type/size, and garbage-collect orphaned files.

## Performance Bottlenecks

**No custom indexes are defined for high-cardinality query patterns:**
- Problem: Custom collections have no `.index.json` files, while services query heavily by `family_id`, `status`, `due_date`, `dog_id`, `cycle_id`, `litter_id`, and `deleted_at`.
- Files: `uniCloud-alipay/database/tasks.schema.json`, `uniCloud-alipay/database/health_records.schema.json`, `uniCloud-alipay/database/medication_tasks.schema.json`, `uniCloud-alipay/database/breeding_cycles.schema.json`, `uniCloud-alipay/database/dogs.schema.json`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:581`, `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js:43`.
- Cause: Only `opendb-device.index.json` and `uni-id-device.index.json` exist.
- Improvement path: Add compound indexes for homepage/date counts, dog detail, active medication, active illness, finance list, and soft-delete queries before data volume grows beyond the current 30-50 dog target.

**Homepage aggregation performs multiple collection scans per refresh:**
- Problem: `getHomeCards`, `getDateCounts`, and `getWeekCards` each query tasks, health records, and medication tasks; `src/pages/home/index.vue` runs them in parallel on every `onShow`.
- Files: `src/pages/home/index.vue:629`, `src/pages/home/index.vue:1096`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:581`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:691`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:737`.
- Cause: Real-time calculation is preferred over precomputed summaries.
- Improvement path: Keep real-time calculation for V1 but add indexes, request dedupe, and eventual pagination/cursors for tasks and health records.

**Hard query limits can silently hide data at larger scale:**
- Problem: Core queries use fixed `limit(50)`, `limit(100)`, or `limit(200)`.
- Files: `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:584`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:590`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:593`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:740`, `uniCloud-alipay/cloudfunctions/finance-service/index.obj.js:155`, `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js:819`.
- Cause: Current expected scale is small.
- Improvement path: Document limits in UI, sort deterministically, and introduce pagination before importing historical data.

## Fragile Areas

**Homepage optimistic state and refresh suppression:**
- Files: `src/pages/home/index.vue:566`, `src/pages/home/index.vue:631`, `src/pages/home/index.vue:677`, `src/pages/home/index.vue:747`, `src/pages/home/index.vue:953`, `src/stores/taskStore.ts`.
- Why fragile: Cards are removed locally, suppressed for 2500 ms, then reconciled against background refreshes. Several actions fire cloud calls without awaiting or checking failure (`doCompleteTask`, `doPostponeTask`, `doBatchComplete`).
- Safe modification: Preserve `latestLoadToken`, suppression filtering, `syncCardMeta`, and WeekStrip red-dot adjustments together; add tests around partial batch completion and failed cloud calls.
- Test coverage: Cloud task aggregation is tested in `tests/cloud-objects/task-service.test.ts`; Vue optimistic UI behavior is not covered.

**Batch health completion semantics:**
- Files: `src/pages/record/health-vaccination.vue:293`, `src/pages/record/health-deworming.vue:338`, `uniCloud-alipay/cloudfunctions/health-service/index.obj.js:393`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:844`, `src/pages/home/index.vue:953`.
- Why fragile: Frontend local removal depends on `completedTasks`, `sourceTaskIds`, `removeBatchCard`, and suppression IDs matching backend auto-completion results exactly.
- Safe modification: Treat backend `completedTasks` as authoritative and only remove completed subset; avoid restoring hard truncation or frontend-only task completion.
- Test coverage: Backend aggregation has tests; cross-page submit feedback and card metadata sync do not.

**Breeding state machine and task routing:**
- Files: `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js:10`, `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js:151`, `src/components/smart-card/DogCard.vue:114`, `src/pages/record/breeding-heat.vue`, `src/pages/record/breeding-mating.vue`, `src/pages/breeding/litter.vue`.
- Why fragile: Workflow task `details.step_type`, `cycleId`, `taskId`, and locked dog params must line up across cloud-generated tasks and record pages.
- Safe modification: Update task generation, DogCard routing, and record-page prefill together. Add a test for every `step_type` route.
- Test coverage: `tests/cloud-objects/breeding-service.test.ts` covers generation; page routing is not covered.

**Timezone-sensitive day boundaries:**
- Files: `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:37`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:575`, `src/pages/home/index.vue:617`, `src/pages/record/health-vaccination.vue:242`, `src/pages/record/health-deworming.vue:279`, `src/pages/record/medication-detail.vue:163`.
- Why fragile: Code uses `new Date()` and `setHours(0,0,0,0)` without explicitly pinning Beijing time, while project convention requires UTC+8.
- Safe modification: Centralize Beijing start-of-day/date parsing helpers and use them in cloud objects and frontend.
- Test coverage: `tests/utils/date.test.ts` only checks timestamp shape; it does not verify UTC+8 boundaries.

**Family auth single-family assumption:**
- Files: `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js:34`, `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js:44`, `uniCloud-alipay/cloudfunctions/family-service/index.obj.js:56`, `docs/design/02-features.md:476`.
- Why fragile: `verifyAndGetFamily` selects the first active family with `.limit(1)`, and multiple-family support requires auth, UI, and data-access changes.
- Safe modification: Keep all code family-id explicit; do not introduce implicit global state that assumes only one family beyond the auth helper.
- Test coverage: `tests/cloud-objects/family-service.test.ts` covers single-family behavior only.

## Scaling Limits

**Current data model favors live computation over persisted aggregates:**
- Current capacity: Designed for personal use with 30-50 dogs.
- Limit: Finance summaries, dog detail statuses, homepage counts, and litter profits run live queries and in-memory reductions.
- Scaling path: Add indexes first; if household/history size grows materially, add materialized summary collections for read-heavy dashboards.

**URL-encoded batch payloads are bounded by platform URL length:**
- Current capacity: Batch card navigation serializes selected dog lists and details into query params.
- Limit: Large batches or richer dog payloads can exceed mini-program/app route URL limits.
- Files: `src/components/smart-card/BatchCard.vue:115`, `src/pages/record/health-vaccination.vue:349`, `src/pages/record/health-deworming.vue:394`, `src/pages/record/health-medication.vue:524`.
- Scaling path: Store transient batch context in Pinia/storage keyed by a short token, or re-fetch dogs by task IDs on the destination page.

## Dependencies at Risk

**UniCloud schema permissions and clientDB behavior are critical to security:**
- Risk: The app relies on cloud-object methods for isolation, but schema permissions still allow broader direct database access patterns.
- Impact: Any new direct clientDB/JQL feature can accidentally expose cross-family data.
- Migration plan: Adopt restrictive schemas and a small set of audited cloud-object read methods for every business domain.

**UniPush path is stubbed:**
- Risk: Morning summary increments `pushCount` without sending notifications.
- Impact: Reminder reliability depends on users opening the app/homepage.
- Files: `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:1318`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js:1358`.
- Migration plan: Configure UniPush 2.0, store push client IDs, and add integration tests/manual UAT for push delivery.

## Missing Critical Features

**Operation log is not implemented:**
- Problem: Family service returns an empty list for operation logs.
- Blocks: Auditability for multi-user changes, data repair diagnosis, and destructive action traceability.
- Files: `uniCloud-alipay/cloudfunctions/family-service/index.obj.js:406`, `src/pages/profile/operation-log.vue`.

**Backup/export/repair workflow is not implemented end-to-end:**
- Problem: UI exposes backup/export/repair controls without working cloud methods or matching field contracts.
- Blocks: User-controlled data export and recovery from partial multi-write failures.
- Files: `src/pages/profile/backup.vue:77`, `src/pages/profile/backup.vue:154`, `uniCloud-alipay/cloudfunctions/family-service/index.obj.js:434`.

**Generic recycle bin is partial:**
- Problem: Only deleted dogs are listed; restore/permanent delete methods are missing from family service.
- Blocks: Restoring or permanently deleting other soft-deleted records promised by the UI copy.
- Files: `uniCloud-alipay/cloudfunctions/family-service/index.obj.js:414`, `src/pages/profile/recycle.vue:67`.

## Test Coverage Gaps

**Frontend workflow tests are absent:**
- What's not tested: Vue pages/components, optimistic homepage removal, WeekStrip red dots, modal/sheet behavior, query-param prefill, and submit feedback consumption.
- Files: `src/pages/home/index.vue`, `src/components/week-strip/WeekStrip.vue`, `src/components/smart-card/BatchCard.vue`, `src/pages/record/health-vaccination.vue`, `src/pages/record/health-deworming.vue`.
- Risk: UI regressions can pass `npm test`.
- Priority: High.

**Security and schema permission tests are absent:**
- What's not tested: Cross-family direct clientDB/JQL reads/writes, helper role restrictions, open schema permissions, and image upload authorization.
- Files: `uniCloud-alipay/database/*.schema.json`, `src/pages/record/prelabor-monitor.vue`, `src/components/form/BCycleSelector.vue`, `src/components/form/BImageUpload.vue`.
- Risk: Data isolation issues can ship unnoticed.
- Priority: High.

**Cloud-object unit tests use a mock database, not UniCloud behavior:**
- What's not tested: Real JQL permission expressions, UniCloud update semantics for nested fields, index usage, transaction behavior, timing triggers, and platform date/timezone behavior.
- Files: `tests/helpers/mock-unicloud.ts`, `tests/cloud-objects/task-service.test.ts`, `tests/cloud-objects/health-service.test.ts`, `tests/cloud-objects/breeding-service.test.ts`.
- Risk: Platform-specific bugs remain invisible to local Vitest.
- Priority: Medium.

**Verification status:**
- `npm test` passes: 6 test files, 75 tests.
- `npm run type-check` passes.
- `npm test -- --runInBand` is not a valid Vitest command and fails with `Unknown option --runInBand`; use `npm test`.

---

*Concerns audit: 2026-04-15*
