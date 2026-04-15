# Testing Patterns

**Analysis Date:** 2026-04-15

## Test Framework

**Runner:**
- Vitest `^1.6.0` is configured in `vitest.config.ts`.
- Test environment is Node, configured as `environment: 'node'` in `vitest.config.ts`.
- Test files are included by `include: ['tests/**/*.test.ts']` in `vitest.config.ts`.
- Vue component tests are not detected; existing tests focus on cloud-object behavior and utilities under `tests/`.

**Assertion Library:**
- Vitest globals are enabled through `globals: true` in `vitest.config.ts`.
- Tests import `describe`, `it`, `expect`, `beforeEach`, and sometimes `vi` from `vitest`: `tests/cloud-objects/task-service.test.ts`、`tests/cloud-objects/family-service.test.ts`。

**Run Commands:**
```bash
pnpm test              # Run all tests with vitest run
pnpm test:watch        # Run Vitest in watch mode
pnpm test:coverage     # Run Vitest coverage with v8 provider
pnpm type-check        # Run vue-tsc --noEmit for src TypeScript/Vue files
```

## Test File Organization

**Location:**
- Cloud-object tests live under `tests/cloud-objects/`: `tests/cloud-objects/health-service.test.ts`、`tests/cloud-objects/task-service.test.ts`、`tests/cloud-objects/breeding-service.test.ts`。
- Shared test infrastructure lives under `tests/helpers/`: `tests/helpers/mock-unicloud.ts`。
- Utility tests live under `tests/utils/`: `tests/utils/date.test.ts`。

**Naming:**
- Test files use `*.test.ts`, matching `vitest.config.ts`.
- Cloud-object test names mirror service directory names: `tests/cloud-objects/finance-service.test.ts` maps to `uniCloud-alipay/cloudfunctions/finance-service/index.obj.js`.
- Utility tests use the utility/domain name: `tests/utils/date.test.ts`.

**Structure:**
```text
tests/
├── cloud-objects/          # UniCloud service behavior tests
│   ├── breeding-service.test.ts
│   ├── family-service.test.ts
│   ├── finance-service.test.ts
│   ├── health-service.test.ts
│   └── task-service.test.ts
├── helpers/
│   └── mock-unicloud.ts    # In-memory uniCloud database and context mock
└── utils/
    └── date.test.ts        # Small utility/config smoke tests
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import {
  resetDB,
  seedCollection,
  createMockUniCloud,
  createCloudObjectContext,
} from '../helpers/mock-unicloud'

const mockUniCloud = createMockUniCloud()
;(globalThis as any).uniCloud = mockUniCloud
process.env.NODE_ENV = 'test'
const taskService = require('../../uniCloud-alipay/cloudfunctions/task-service/index.obj.js')

describe('task-service', () => {
  const db = mockUniCloud.database()
  const familyId = 'fam_1'

  beforeEach(() => {
    resetDB()
    seedCollection('families', [{ _id: familyId, name: '测试犬舍' }])
  })

  describe('业务分组', () => {
    it('应验证具体行为', async () => {
      // seed -> act -> assert
    })
  })
})
```
- The pattern above is used in `tests/cloud-objects/task-service.test.ts` and `tests/cloud-objects/breeding-service.test.ts`.
- Some tests validate core database mutations directly through the mock db instead of invoking the full cloud object, as seen in `tests/cloud-objects/finance-service.test.ts` and `tests/cloud-objects/health-service.test.ts`.
- Tests use Chinese `describe`/`it` descriptions that state expected behavior: `tests/cloud-objects/task-service.test.ts`、`tests/cloud-objects/health-service.test.ts`。

**Patterns:**
- Use `beforeEach(resetDB + seedCollection)` to isolate every test: `tests/cloud-objects/task-service.test.ts`、`tests/cloud-objects/finance-service.test.ts`。
- Seed required family and dog records explicitly; do not rely on cross-test state: `tests/cloud-objects/health-service.test.ts`、`tests/cloud-objects/breeding-service.test.ts`。
- Use stable IDs such as `fam_1`, `dog_1`, `task_1`, `cycle_1` for readable assertions: `tests/cloud-objects/task-service.test.ts`。
- Assert both mutation result and persisted state by querying `db.collection(...).doc(...).get()`: `tests/cloud-objects/health-service.test.ts`、`tests/cloud-objects/finance-service.test.ts`。

## Mocking

**Framework:** Vitest `vi` plus custom UniCloud in-memory mock.

**Patterns:**
```typescript
const mockUniCloud = createMockUniCloud()
;(globalThis as any).uniCloud = mockUniCloud

const db = mockUniCloud.database()

beforeEach(() => {
  resetDB()
  seedCollection('dogs', [{ _id: 'dog_1', family_id: 'fam_1', deleted_at: null }])
})
```
- `createMockUniCloud` returns `database()`, `auth()`, and `request` stubs in `tests/helpers/mock-unicloud.ts`.
- `createDbCommand` supports common command operators such as `push`, `pull`, `inc`, `set`, `lt`, `lte`, `gt`, `gte`, `eq`, `neq`, and `in` in `tests/helpers/mock-unicloud.ts`.
- The query chain supports `doc`, `where`, `field`, `orderBy`, `limit`, `get`, `count`, `add`, `update`, and `remove` in `tests/helpers/mock-unicloud.ts`.
- Nested dot-path reads and writes are supported through `getNestedValue` and `setNestedValue` in `tests/helpers/mock-unicloud.ts`.

**What to Mock:**
- Mock `globalThis.uniCloud` before requiring cloud-object files that call `uniCloud.database()` at module load: `tests/cloud-objects/task-service.test.ts`、`tests/cloud-objects/breeding-service.test.ts`。
- Mock cloud-object `this` with `createCloudObjectContext` when testing methods that use `this.uid`, `this.familyId`, `this.role`, `this.getUniIdToken`, or `this.getMethodName`: `tests/helpers/mock-unicloud.ts`、`tests/cloud-objects/breeding-service.test.ts`。
- Mock local permission helpers inline only when the module path is not loadable in Node; `tests/cloud-objects/family-service.test.ts` defines `requireAdmin` and `requireFamily` for focused permission tests.

**What NOT to Mock:**
- Do not mock the in-memory database for regular cloud-object behavior; use `seedCollection` and real query-chain operations from `tests/helpers/mock-unicloud.ts`.
- Do not mock `Date.now()` by default; existing tests compute relative timestamps with `Date.now()` and `86400000`, as in `tests/cloud-objects/task-service.test.ts` and `tests/cloud-objects/health-service.test.ts`.
- Do not introduce browser/DOM assumptions in current tests; the configured environment is Node in `vitest.config.ts`.

## Fixtures and Factories

**Test Data:**
```typescript
seedCollection('families', [{
  _id: familyId,
  name: '测试犬舍',
  settings: {
    default_weaning_days: 45,
    default_vaccine_interval: 21,
    default_deworming_interval_puppy: 14,
    default_deworming_interval_adult: 90,
  },
}])
```
- Family fixtures with settings appear in `tests/cloud-objects/task-service.test.ts`、`tests/cloud-objects/health-service.test.ts`、`tests/cloud-objects/breeding-service.test.ts`。
- Dog fixtures include `family_id` and `deleted_at: null` when cloud-object logic filters active dogs: `tests/cloud-objects/health-service.test.ts`、`tests/cloud-objects/breeding-service.test.ts`。
- Task fixtures include `_id`, `family_id`, `status`, `due_date`, `type`, `details`, and source fields as needed: `tests/cloud-objects/task-service.test.ts`。
- Finance fixtures include soft-delete fields and source fields such as `deleted_at` and `source_type`: `tests/cloud-objects/finance-service.test.ts`。

**Location:**
- Fixtures are inline in each test file rather than shared factory files: `tests/cloud-objects/finance-service.test.ts`、`tests/cloud-objects/health-service.test.ts`。
- Shared helper state is only the mock database and context utilities in `tests/helpers/mock-unicloud.ts`.

## Coverage

**Requirements:** No enforced threshold detected in `vitest.config.ts`.

**View Coverage:**
```bash
pnpm test:coverage
```
- Coverage provider is `v8`, configured in `vitest.config.ts`.
- Coverage includes `uniCloud-alipay/cloudfunctions/**/*.js` and `src/utils/**/*.ts`, configured in `vitest.config.ts`.
- Coverage does not include `src/pages/**/*.vue`, `src/components/**/*.vue`, `src/composables/**/*.ts`, or `src/stores/**/*.ts` in the current config.

## Test Types

**Unit Tests:**
- Utility smoke tests live in `tests/utils/date.test.ts`.
- Pure helper-style functions can be exposed only in test mode; `uniCloud-alipay/cloudfunctions/task-service/index.obj.js` exports `_mergeTasks` when `process.env.NODE_ENV === 'test'`, and `tests/cloud-objects/task-service.test.ts` imports it.

**Integration Tests:**
- Cloud-object tests are lightweight integration tests against the in-memory UniCloud mock: `tests/cloud-objects/task-service.test.ts`、`tests/cloud-objects/breeding-service.test.ts`、`tests/cloud-objects/health-service.test.ts`。
- Tests that call cloud-object methods must invoke them with `method.call(ctx, args...)` when the method depends on `this`: `tests/cloud-objects/task-service.test.ts` calls `taskService.batchCompleteTask.call(ctx, ...)`; `tests/cloud-objects/breeding-service.test.ts` calls `breedingService.addBreedingRecord.call(ctx, ...)`。
- Tests that only validate data transformations can operate directly on `db.collection(...)` and assert final state: `tests/cloud-objects/finance-service.test.ts`。

**E2E Tests:**
- Not used. No Playwright, Cypress, or UniAutomator test files are detected under `tests/`.
- `@dcloudio/uni-automator` is installed in `package.json`, but no e2e scripts or automator specs are detected.

**Component Tests:**
- Not detected. Components such as `src/components/form/BDogPicker.vue`, `src/components/layout/BSheet.vue`, and `src/components/smart-card/SmartCard.vue` do not have colocated tests.

## Cloud-Object Testing

**Loading Services:**
- Set `globalThis.uniCloud` before `require(...)` because cloud-object files initialize `const db = uniCloud.database()` at module scope: `tests/cloud-objects/task-service.test.ts` and `tests/cloud-objects/breeding-service.test.ts`.
- Set `process.env.NODE_ENV = 'test'` before requiring modules that expose test-only helpers: `tests/cloud-objects/task-service.test.ts` and `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`.
- Use CommonJS `require` for cloud-object files, not ESM import: `tests/cloud-objects/task-service.test.ts`、`tests/cloud-objects/breeding-service.test.ts`。

**Context:**
```typescript
const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })
await taskService.batchCompleteTask.call(ctx, ['task_1'], true)
```
- `createCloudObjectContext` defaults to `uid: 'test_uid'`, `familyId: 'test_family_id'`, `role: 'creator'`, `token: 'mock_token'`, and empty method name in `tests/helpers/mock-unicloud.ts`.
- Override `familyId`, `uid`, `role`, or `methodName` per test when authorization or audit fields matter: `tests/cloud-objects/breeding-service.test.ts`、`tests/cloud-objects/task-service.test.ts`。

**Database Assertions:**
- Verify writes through the mock database after invoking the cloud object; examples include created health records in `tests/cloud-objects/task-service.test.ts` and created breeding extra arrangements in `tests/cloud-objects/breeding-service.test.ts`.
- When testing soft delete, assert `deleted_at` or `status` fields instead of expecting hard removal: `tests/cloud-objects/finance-service.test.ts`、`tests/cloud-objects/task-service.test.ts`。
- When testing batch behavior, assert both count and per-record metadata, such as dog names, task types, group ids, or card ids: `tests/cloud-objects/task-service.test.ts`。

**Date Rules:**
- Store and assert dates as timestamp milliseconds; existing tests use `Date.now()` plus `86400000` offsets: `tests/cloud-objects/task-service.test.ts`、`tests/cloud-objects/health-service.test.ts`。
- For day-boundary behavior, normalize with `setHours(0, 0, 0, 0)` in the test, as in `tests/cloud-objects/task-service.test.ts`.
- Use exact expectations for known boundary bugs, such as overdue day counts and red-dot counts in `tests/cloud-objects/task-service.test.ts`.

## Common Patterns

**Async Testing:**
```typescript
it('批量健康完成启用 autoRecord 时应创建 health_record', async () => {
  seedCollection('tasks', [/* pending tasks */])
  const ctx = createCloudObjectContext({ familyId, uid: 'user_1' })

  await taskService.batchCompleteTask.call(ctx, ['vac_batch_1', 'vac_batch_2'], true)

  const { data: records } = await db.collection('health_records').get()
  expect(records).toHaveLength(2)
})
```
- This call-and-assert pattern is used in `tests/cloud-objects/task-service.test.ts`.
- Prefer explicit seed data and final database assertions over snapshots; no snapshot tests are detected.

**Error Testing:**
```typescript
it('协助者不能更新设置', () => {
  expect(() => requireAdmin('helper')).toThrow('权限不足')
})
```
- Synchronous error testing appears in `tests/cloud-objects/family-service.test.ts`.
- For cloud-object validation errors, call the method with `createCloudObjectContext` and use `await expect(...).rejects.toThrow(...)` when adding new tests; existing cloud objects throw user-facing Chinese `Error` messages in `uniCloud-alipay/cloudfunctions/health-service/index.obj.js` and `uniCloud-alipay/cloudfunctions/family-service/index.obj.js`.

**Card/Merge Testing:**
- Use test-only `_mergeTasks` for card grouping behavior, and assert `cardType`, `domain`, `sectionType`, `groupTitle`, and card `id`: `tests/cloud-objects/task-service.test.ts`。
- Preserve homepage behavior tests for known business rules: no silent 12-card truncation, subtype-specific batch keys, breeding extra arrangement sectioning, medication red dots, and overdue day counts in `tests/cloud-objects/task-service.test.ts`.

**Useful Commands:**
```bash
pnpm test tests/cloud-objects/task-service.test.ts
pnpm test tests/cloud-objects/health-service.test.ts
pnpm test -- --reporter=verbose
pnpm type-check
```
- Vitest accepts a test file path after `pnpm test` because `package.json` maps `test` to `vitest run`.
- Use `pnpm test:coverage` before relying on coverage numbers; only cloudfunctions and utils are included by `vitest.config.ts`.

---

*Testing analysis: 2026-04-15*
