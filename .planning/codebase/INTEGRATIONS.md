# External Integrations

**Analysis Date:** 2026-04-15

## APIs & External Services

**UniCloud Cloud Objects:**
- Business cloud APIs - 前端通过 `src/composables/useCloudCall.ts` 调用 `uniCloud.importObject(serviceName, { customUI: true })`，页面使用 `useCloudCall(...)` 访问云对象方法。
  - SDK/Client: UniApp global `uniCloud` from DCloud runtime.
  - Auth: `uni_id_token` from uni-id runtime; cloud objects read it via `this.getUniIdToken()` in files such as `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`.
- `dog-service` - 犬只档案 CRUD、状态派生、去向变更；云对象位于 `uniCloud-alipay/cloudfunctions/dog-service/index.obj.js`，前端调用示例在 `src/pages/dog/detail.vue` 和 `src/pages/dog/add.vue`。
  - SDK/Client: `useCloudCall('dog-service', ...)` in `src/composables/useCloudCall.ts`.
  - Auth: `breed-auth` via `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`.
- `family-service` - 家庭创建、成员、设置、护理规则、回收站、备份信息；云对象位于 `uniCloud-alipay/cloudfunctions/family-service/index.obj.js`，前端认证入口在 `src/composables/useAuth.ts`。
  - SDK/Client: `useCloudCall('family-service', ...)`.
  - Auth: `breed-auth`, with `createFamily`, `joinFamily`, `getFamilyInfo` allowed before a family exists.
- `breeding-service` - 繁育周期、繁育记录、生产向导、窝详情；云对象位于 `uniCloud-alipay/cloudfunctions/breeding-service/index.obj.js`，前端调用示例在 `src/pages/record/breeding-heat.vue`, `src/pages/breeding/cycle.vue`, `src/pages/breeding/litter.vue`。
  - SDK/Client: `useCloudCall('breeding-service', ...)`.
  - Auth: `breed-auth`.
- `health-service` - 健康记录、批量健康记录、用药任务、用药方案、体重记录；云对象位于 `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`，前端调用示例在 `src/pages/record/health-medication.vue`, `src/pages/home/index.vue`, `src/pages/health/batch-weight.vue`。
  - SDK/Client: `useCloudCall('health-service', ...)`.
  - Auth: `breed-auth`.
- `finance-service` - 收支 CRUD、销售流程、代理人、财务统计、费用分类；云对象位于 `uniCloud-alipay/cloudfunctions/finance-service/index.obj.js`，前端调用示例在 `src/pages/finance/expense-add.vue`, `src/pages/sale/detail.vue`, `src/pages/profile/expense-categories.vue`。
  - SDK/Client: `useCloudCall('finance-service', ...)`.
  - Auth: `breed-auth`.
- `task-service` - 首页卡片、日期红点、任务完成/推迟、批量完成、定时审计；云对象位于 `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`，前端调用示例在 `src/pages/home/index.vue` 和 `src/pages/home/batch-process.vue`。
  - SDK/Client: `useCloudCall('task-service', ...)`.
  - Auth: `breed-auth`, except `_timing*` methods bypass family auth in `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`.

**DCloud Plugin Cloud APIs:**
- `uni-id-co` - DCloud uni-id 用户中心云对象，提供注册、登录、短信验证码、第三方登录、绑定、注销、push cid 绑定等能力；云对象 package 在 `uniCloud-alipay/cloudfunctions/uni-id-co/package.json`，页面路由在 `src/pages.json`。
  - SDK/Client: `uniCloud.importObject("uni-id-co")` used by uni-id-pages plugin under `src/uni_modules/uni-id-pages/`.
  - Auth: uni-id config-center at `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.json` (sensitive config file; do not quote values).
- `uni-captcha-co` - DCloud 图形验证码云对象；package 位于 `uniCloud-alipay/cloudfunctions/uni-captcha-co/package.json`，数据表为 `uniCloud-alipay/database/opendb-verify-codes.schema.json`。
  - SDK/Client: `uni-captcha` plugin from `src/uni_modules/uni-captcha/package.json`.
  - Auth: config-center through `uniCloud-alipay/cloudfunctions/common/uni-config-center/`.
- Third-party platform bridge - `uni-open-bridge-common` and `uni-cloud-s2s` support platform access tokens and server-to-server flows for uni-id login providers; modules live in `uniCloud-alipay/cloudfunctions/common/uni-open-bridge-common/package.json` and `uniCloud-alipay/cloudfunctions/common/uni-cloud-s2s/package.json`.
  - SDK/Client: `uni-id-co` modules under `uniCloud-alipay/cloudfunctions/uni-id-co/module/`.
  - Auth: `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-open-bridge/config.json` (sensitive config file; do not quote values).

**HTTP / Third-Party Network Calls:**
- Custom business HTTP integrations are not detected in business cloud objects under `uniCloud-alipay/cloudfunctions/*-service/index.obj.js`.
- H5 development proxy exists in `src/manifest.json` as `/api -> https://api.next.bspapp.com`; business code does not call this proxy directly in detected files.
- `src/pages/record/medication-detail.vue` references `useCloudCall('medication-service', ...)`, but no `uniCloud-alipay/cloudfunctions/medication-service/` directory is present; current implemented medication APIs are in `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`.

## Data Storage

**Databases:**
- UniCloud MongoDB on Alipay cloud - Provider is configured in `src/manifest.json` and schemas live in `uniCloud-alipay/database/`.
  - Connection: UniCloud project binding from HBuilderX / `src/manifest.json`; no `.env*` connection strings detected.
  - Client: `uniCloud.database()` in cloud objects such as `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/task-service/index.obj.js`, `uniCloud-alipay/cloudfunctions/finance-service/index.obj.js`.
- Business collections - Use committed schemas for `dogs`, `breeding_cycles`, `breeding_records`, `litters`, `health_records`, `medication_tasks`, `tasks`, `expenses`, `incomes`, `sale_records`, `dog_weights`, `medication_protocols`, `agents`, `families`.
  - Connection: `uniCloud-alipay/database/dogs.schema.json`, `uniCloud-alipay/database/breeding_cycles.schema.json`, `uniCloud-alipay/database/breeding_records.schema.json`, `uniCloud-alipay/database/litters.schema.json`, `uniCloud-alipay/database/health_records.schema.json`, `uniCloud-alipay/database/medication_tasks.schema.json`, `uniCloud-alipay/database/tasks.schema.json`, `uniCloud-alipay/database/expenses.schema.json`, `uniCloud-alipay/database/incomes.schema.json`, `uniCloud-alipay/database/sale_records.schema.json`, `uniCloud-alipay/database/dog_weights.schema.json`, `uniCloud-alipay/database/medication_protocols.schema.json`, `uniCloud-alipay/database/agents.schema.json`, `uniCloud-alipay/database/families.schema.json`.
  - Client: Business cloud objects with family isolation through `breed-auth`.
- Uni-id / OpenDB collections - Authentication, verification, device, roles, permissions, and logs use `uniCloud-alipay/database/uni-id-users.schema.json`, `uniCloud-alipay/database/uni-id-device.schema.json`, `uniCloud-alipay/database/uni-id-log.schema.json`, `uniCloud-alipay/database/uni-id-roles.schema.json`, `uniCloud-alipay/database/uni-id-permissions.schema.json`, `uniCloud-alipay/database/opendb-device.schema.json`, `uniCloud-alipay/database/opendb-verify-codes.schema.json`, `uniCloud-alipay/database/opendb-tempdata.schema.json`, `uniCloud-alipay/database/opendb-frv-logs.schema.json`.
  - Connection: UniCloud database.
  - Client: `uni-id-co`, `uni-id-common`, `uni-captcha-co`.
- Client-side direct DB usage - Limited direct `uniCloud.database()` calls exist in `src/components/form/BCycleSelector.vue` and `src/pages/record/prelabor-monitor.vue`; most business writes use cloud objects through `src/composables/useCloudCall.ts`.
  - Connection: UniCloud client database runtime.
  - Client: UniApp `uniCloud.database()`.

**File Storage:**
- UniCloud 云存储 is the selected storage platform in design docs; storage specification is in `docs/design/03-tech-stack.md`.
- Business image flow currently uses local image selection in finance forms: `uni.chooseImage` in `src/pages/finance/expense-add.vue`, `src/pages/finance/expense-edit.vue`, `src/pages/finance/income-add.vue`, `src/pages/finance/income-edit.vue`; selected temp file paths are stored in payload fields such as `images` / `photos`.
- Business code does not currently show `uniCloud.uploadFile()` usage outside plugin cloud code; detected upload calls are in `uni-id-co` plugin modules under `uniCloud-alipay/cloudfunctions/uni-id-co/module/` for third-party avatar / real-name verification support.
- Static bundled assets live under `src/static/`, including `src/static/tab/*.png` and `src/static/fonts/*.woff2`.

**Caching:**
- Client storage - `src/composables/useAuth.ts` caches family data with `uni.setStorageSync('breed_family_cache', ...)`; `src/composables/useTheme.ts` stores theme mode under `theme_mode`; `src/stores/taskStore.ts` stores local task-related state.
- Pinia persistence - `src/main.ts` installs `pinia-plugin-unistorage` via `createUnistorage()`.
- Server-side Redis - No business usage detected in `uniCloud-alipay/cloudfunctions/*-service/index.obj.js`; DCloud `uni-open-bridge-common` includes cache/redis support under `uniCloud-alipay/cloudfunctions/common/uni-open-bridge-common/`.

## Authentication & Identity

**Auth Provider:**
- uni-id with uni-id-pages - Login/register/userinfo pages are routed in `src/pages.json`, initialized in `src/App.vue`, and integrated in `src/composables/useAuth.ts`.
  - Implementation: `src/App.vue` calls `uniIdPageInit()` from `src/uni_modules/uni-id-pages/init.js` and then `useAuth().init()`.
  - Token source: `uniCloud.getCurrentUserInfo()` and storage key `uni_id_token` are read in `src/composables/useAuth.ts`.
  - Cloud validation: `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js` creates `uni-id-common` instance and calls `checkToken(token)`.
- Family identity layer - Project-level authorization maps the uni-id user to a single active family membership in `families.members`.
  - Implementation: `verifyAndGetFamily()` in `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js` queries `families` with `members.elemMatch({ user_id, status: 'active' })`.
  - Roles: `creator`, `admin`, `helper` are encoded in `uniCloud-alipay/database/families.schema.json` and enforced by `requireAdmin()` / `requireFamily()` in `uniCloud-alipay/cloudfunctions/common/breed-auth/auth.js`.
- Route protection - `src/pages.json` uses `uniIdRouter.needLogin` to protect all main app page groups and uses `uni_modules/uni-id-pages/pages/login/login-withpwd` as the login route.

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, OpenTelemetry, external logging SDK, or monitoring service dependency appears in `package.json` or business cloud objects.

**Logs:**
- Client console logging - `src/App.vue` logs app show/hide, and `src/composables/useAuth.ts` warns on family load failures.
- Cloud console logging - Business cloud objects use `console.log` for narrow helper failures such as `saveCustomType` in `uniCloud-alipay/cloudfunctions/health-service/index.obj.js`.
- Auth and operation logs - uni-id logs are modeled by `uniCloud-alipay/database/uni-id-log.schema.json`; project operation log data is surfaced by `family-service.getOperationLogs()` in `uniCloud-alipay/cloudfunctions/family-service/index.obj.js`.

## CI/CD & Deployment

**Hosting:**
- UniCloud Alipay cloud - Backend cloud objects and database schemas are under `uniCloud-alipay/`; provider is configured in `src/manifest.json`.
- UniApp build targets - H5, App, and Alipay Mini Program builds are scripted in `package.json`.
- Deployment tooling - Design docs specify HBuilderX for UniCloud deployment and cloud packaging in `docs/design/03-tech-stack.md`.

**CI Pipeline:**
- None detected - No `.github/workflows`, GitLab CI, or other CI config found during stack scan; validation commands are local scripts in `package.json`.

## Environment Configuration

**Required env vars:**
- Not detected in repo - no `.env*` files found at searched depth, and `package.json` scripts do not reference environment variables.
- UniCloud project/provider config is file-based through `src/manifest.json` and HBuilderX project binding.
- Sensitive service config is expected in `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.json`, `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-ad/config.json`, and `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-open-bridge/config.json`; do not commit or quote secret values from these files.

**Secrets location:**
- UniCloud config-center files - `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.json`, `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-ad/config.json`, `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-open-bridge/config.json`.
- HBuilderX / DCloud project settings - implied by `src/manifest.json` and UniCloud deployment flow, not represented as environment variables in this repo.

## Push, SMS & Cloud Integrations

**Push:**
- Device schemas exist for UniPush / uni-id device mapping: `uniCloud-alipay/database/opendb-device.schema.json` and `uniCloud-alipay/database/uni-id-device.schema.json`.
- `uni-id-co` exposes set-push-cid support through modules under `uniCloud-alipay/cloudfunctions/uni-id-co/module/utils/`.
- Business push sending is not wired in current business code; `uniCloud-alipay/cloudfunctions/task-service/index.obj.js` has `_timing_morningSummary()` and a placeholder comment for `uniCloud.sendSms` or uni-push.

**SMS / Email / Captcha:**
- SMS code routes are present through uni-id-pages in `src/pages.json` and `uni-id-co` in `uniCloud-alipay/cloudfunctions/uni-id-co/package.json`.
- `uni-id-co` declares `uni-cloud-sms` extension in `uniCloud-alipay/cloudfunctions/uni-id-co/package.json`.
- Captcha support is installed through `src/uni_modules/uni-captcha/package.json`, `uniCloud-alipay/cloudfunctions/common/uni-captcha/package.json`, and `uniCloud-alipay/cloudfunctions/uni-captcha-co/package.json`.
- Verify-code storage uses `uniCloud-alipay/database/opendb-verify-codes.schema.json`.

**Alipay / Third-Party Identity:**
- Alipay Mini Program target is enabled by `@dcloudio/uni-mp-alipay` in `package.json` and `mp-alipay` config in `src/manifest.json`.
- uni-id-co includes Alipay login/bind/unbind modules under `uniCloud-alipay/cloudfunctions/uni-id-co/module/login/` and `uniCloud-alipay/cloudfunctions/uni-id-co/module/relate/`.
- Third-party credentials are managed by config-center and open bridge modules at `uniCloud-alipay/cloudfunctions/common/uni-open-bridge-common/` and `uniCloud-alipay/cloudfunctions/common/uni-cloud-s2s/`.

## Webhooks & Callbacks

**Incoming:**
- None detected in business services - cloud objects expose UniCloud methods rather than HTTP webhook endpoints; business cloud object files are under `uniCloud-alipay/cloudfunctions/*-service/index.obj.js`.
- DCloud plugin callback-like flows are handled inside `uni-id-co` modules under `uniCloud-alipay/cloudfunctions/uni-id-co/module/`.

**Outgoing:**
- None detected for custom business webhooks - no business `httpclient`, `uni.request`, or third-party webhook calls were found in `uniCloud-alipay/cloudfunctions/*-service/index.obj.js`.
- Potential outgoing DCloud platform calls are encapsulated inside `uni-id-co`, `uni-open-bridge-common`, and `uni-cloud-s2s` plugin modules under `uniCloud-alipay/cloudfunctions/common/`.

---

*Integration audit: 2026-04-15*
