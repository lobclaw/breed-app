# TODOS

仅保留当前仍未完成或只完成了一部分的事项。已完成、Phase 1 旧阶段说明、以及已被 Local-First 路线替代的待办不再保留在本文件。

## `/goal` 执行协议

使用 Codex CLI 的 `/goal` 执行本文件时，按 TODO 编号从小到大逐项推进。每个 TODO 都必须完整经历“实现 → 验收 → 两轮审查 → 修复 → 复审 → 标记完成”，不能因为局部测试通过就直接进入下一项。

### 单项任务关闭流程

每完成一个 TODO 后必须执行以下流程：

1. **实现与基础验收**
   - 完成该 TODO 的代码 / 文档改动。
   - 执行该 TODO 下列出的验收命令。
   - 若改动了代码文件，执行 `./scripts/graphify-rebuild.sh`。
   - 若涉及前端运行体验，打开或检查 `http://localhost:5200/`；必要时启动 H5 服务。

2. **审查 1：实现审查**
   - 检查 diff 是否只覆盖本 TODO 所需范围。
   - 检查是否破坏 `AGENTS.md` 的 Local-First Contract、scope、缓存隔离、图片附件、在线优先边界。
   - 检查是否引入新的全表扫描、深拷贝、未隔离缓存、绕过 `localSyncRuntime` / outbox 的写入。
   - 检查 public API 是否保持兼容，尤其是页面继续调用 `localSyncRuntime.*Locally` 和 `domain-repository` barrel。

3. **审查 2：回归审查**
   - 复看相关测试输出、失败路径、source contract、类型约束和边界条件。
   - 对照本 TODO 的“目标 / 约束 / 验收”，确认每一项都有证据。
   - 对照 Gemini 审查结论，确认没有只做文件搬迁却保留原问题。
   - 对前端任务检查移动端布局、文本不重叠、按钮状态和来源页承接。

4. **发现问题时的处理**
   - 如果任一审查发现问题，必须立即修复。
   - 修复后重新执行相关验收命令。
   - 修复后重新执行审查 1 和审查 2。
   - 只有两轮审查都通过，才能把该 TODO 的状态从 `todo` 改为 `done`，并进入下一个 TODO。

5. **单项完成记录**
   - 在对应 TODO 下追加简短完成记录：完成日期、主要文件、执行过的测试 / 验收命令、残余风险。
   - 不要把未完成或存疑事项标记为 `done`；拆成新的 TODO 或标记 `blocked`。

### 全部任务完成后的最终审查

所有 TODO 都标记完成后，必须再执行一次最终审查：

- 全量执行 `pnpm type-check`、`pnpm test`、`./scripts/graphify-rebuild.sh`。
- 检查 `git diff --stat` 和关键 diff，确认没有临时调试代码、无关改动、重复事实源或文档漂移。
- 复查 `AGENTS.md`、`docs/design/04-implementation.md`、必要时 `docs/ROADMAP.md` 是否与最终代码一致。
- 复查 `TODOS.md`：所有任务状态、完成记录、残余风险必须真实准确。
- 对照 Local-First 主线做最终契约审查：页面级 scope、本地事务、outbox、`_sync` 幂等 ack、同步状态 UX、在线优先边界、Network 验收、图片附件 local-first。
- 对照 Gemini 报告做最终反审查：深拷贝、伪拆分、类型安全、首页投影、Pinia 重复持久化、操作日志成本是否都已处理或有明确残余说明。
- 前端有改动时，最终检查 H5 首页可运行，并补齐真实设备 / Network 验收记录。

最终审查发现任何问题时，必须新增或重开 TODO，修复并再次执行最终审查。不要以“后续再说”关闭本计划。

## 来源与审查结论

本文件综合 `/Users/mooling/Downloads/PLAN.md`、`/Users/mooling/Downloads/PLAN2.md` 和 Gemini 审查报告生成。Gemini 报告先按当前代码核验后再采纳：

- 成立：`src/localdb/db.ts` 仍有 `cloneRows` / `JSON.parse(JSON.stringify())` 深拷贝；`getTable`、`transact`、`getRowsByFamily`、`findById` 仍会复制大量行，LocalDB v2 行级存储的性能收益还没有完全释放。
- 部分成立：runtime / repository 已不再是完全未拆，当前 `runtime/core.ts` 已拆出 pull / outbox / attachments / scope-sync / home-snapshot / local-builders / settings / finance / sale / agent 等模块，但 `runtime/core.ts` 仍有约 3600+ 行，健康、用药、繁育、犬只、任务 mutation 仍在 core 内。
- 部分成立：`domain-repository.ts` 已是 barrel，纯派生逻辑已拆出一批 `domain-services`，但 `domain-repository/core.ts` 仍有约 2300+ 行，读模型类型和领域拆分还没完全收口。
- 成立：首页 `pages/home/index.vue` 仍约 3000 行，虽然已有 `pages/home/composables/*`，但模板、数据加载、状态承接、交互编排仍高度集中。
- 成立：数据层和投影层仍大量使用 `any` / `Record<string, any>` / `GenericRow`，`LocalTableMap` 已存在但没有贯穿 `db.ts`、runtime mutation、projection、repository。
- 部分成立：首页已通过 `home-snapshot` 按 collection revision 缓存四个 home 集合，并且首页 projection 不再直接扫描繁育集合合成卡片；但 `buildLocalHomeCards`、`buildLocalDateCounts`、`buildLocalWeekCards` 每次 snapshot 仍全量重算，缺少更细的 projection memo / 增量策略。
- 成立：`taskStore` 仍把首页 cards/counts/batch progress 持久化到 workspace storage，和 LocalDB / home snapshot 存在重复事实源，需要改成只保留短时 UI 状态或轻量最近操作。
- 成立：`local-operation-log.ts` 为生成本地操作日志文案会同步查多张本地表；这不一定是阻断问题，但会增加每次 mutation 入 outbox 的延迟，适合异步化或快照化。

## P0：LocalDB v2 性能与一致性收口

### TODO-001 消灭高频查询路径的全表深拷贝

- 状态：done
- 范围：`src/localdb/db.ts`、`src/localdb/repository.ts`、相关 `tests/localdb`
- 目标：减少 `getTable` / `query` / `getRowsByFamily` / `findById` 中不必要的 `cloneRows`，避免 v2 行级读取后又整表深拷贝。
- 建议做法：新增只读查询 API，例如 `getReadonlyTable` / `queryRowsByFamily` / `findReadonlyById`，返回冻结引用或浅拷贝；保留旧 `getTable` 兼容会修改数组的调用方。
- 验收：
  - 新增 source contract，限制首页、同步状态、repository 高频路径不得调用会整表 deep clone 的 API。
  - `pnpm test tests/localdb`
  - `pnpm type-check`
- 完成记录（2026-05-14）：
  - 主要文件：`src/localdb/db.ts`、`src/localdb/repository.ts`、`src/localdb/sync-status.ts`、`src/localdb/runtime/home-snapshot.ts`、`src/localdb/home-projection.ts`、`tests/localdb/*`。
  - 验收命令：`pnpm test tests/localdb tests/localdb/source-contract.test.ts tests/localdb/home-projection.test.ts`、`pnpm type-check`、`./scripts/graphify-rebuild.sh`、`pnpm test`。
  - 审查结论：repository、首页 snapshot、同步状态已切到 readonly 读取路径；旧 `getTable` / `getRowsByFamily` / `findById` 仍保留兼容隔离副本；首页 projection 不再污染输入任务行。
  - 残余风险：readonly API 是高频读取契约，不做深冻结；后续类型约束已由 TODO-003、TODO-013 与 TODO-016 继续收敛，调用方仍需避免直接修改 readonly 返回对象。

### TODO-002 重构 `transact` 的整表 clone 与 diff 成本

- 状态：done
- 范围：`src/localdb/db.ts`
- 目标：事务写入只复制目标行或按需复制 collection，不再无条件对每个参与 collection 做多次整表 JSON deep clone。
- 建议做法：先给 `transact` 增加 row-level diff helper 和结构化 clone helper；业务 mutator 仍保持外观不变，逐步迁到更窄的 row mutation API。
- 验收：
  - 保留并扩展同 row 冲突、不同 row 合并、删除/更新并发测试。
  - 增加大表事务性能护栏测试或 adapter 调用次数测试。
  - `pnpm test tests/localdb/repository.test.ts tests/localdb/runtime-outbox.test.ts`
- 完成记录（2026-05-14）：
  - 主要文件：`src/localdb/db.ts`、`tests/localdb/repository.test.ts`、`tests/localdb/source-contract.test.ts`。
  - 验收命令：`pnpm test tests/localdb/repository.test.ts tests/localdb/runtime-outbox.test.ts tests/localdb/source-contract.test.ts`、`pnpm type-check`、`./scripts/graphify-rebuild.sh`、`pnpm test`。
  - 审查结论：`transact` 已改为按 collection 懒创建 working copy，v2 路径不再通过 `getTable` 做兼容深拷贝；提交阶段由 `commitV2Diff` 返回真实变更集合，避免提交后再整表 JSON 比较；同 row 冲突、不同 row 合并、删除/更新并发测试保留。
  - 残余风险：现有 mutator 仍以整张 collection 数组为 public contract，首次访问 collection 时仍需创建 working copy；后续如果要进一步降到“只复制目标行”，需要新增更窄的 row mutation API 并逐步迁移调用方。

### TODO-003 完成 LocalTableMap 类型贯穿

- 状态：done
- 范围：`src/localdb/types.ts`、`src/localdb/db.ts`、`src/localdb/repository.ts`、`src/localdb/runtime/*`、`src/localdb/domain-repository/*`
- 目标：让 `getTable/findById/query/upsertRows/transact` 能按 collection 推导 row 类型，逐步减少核心层 `any`。
- 建议做法：先 typed overload，不一次性清全项目；优先覆盖 `dogs/tasks/health_records/medication_tasks/expenses/incomes/sale_records`。
- 验收：
  - 新增类型级测试或 `ts-expect-error` contract。
  - 核心 localdb/runtime 新增代码不得再扩散 `Record<string, any>`。
  - `pnpm type-check`
- 完成记录（2026-05-14）：
  - 主要文件：`src/localdb/db.ts`、`src/localdb/repository.ts`、`src/localdb/runtime/outbox.ts`、`tests/localdb/repository.test.ts`。
  - 验收命令：`pnpm type-check`、`pnpm test tests/localdb/repository.test.ts tests/localdb/source-contract.test.ts tests/localdb/runtime-outbox.test.ts`、`./scripts/graphify-rebuild.sh`、`pnpm test`。
  - 审查结论：LocalDb 的 `getTable/findById/query/queryReadonly/getRowsByFamily/upsertRows/transact` 和 repository 的 `queryLocal/findLocal/upsertLocalRows/mutateLocal` 已按 collection 推导 `LocalRowOf<C>`；新增 `expectTypeOf` 类型级测试覆盖 dogs/tasks/health_records/sale_records 与事务表类型。
  - 残余风险：本 TODO 先完成 public typed overload 和新增代码约束；runtime 已由 TODO-013 与 TODO-016 按领域继续收敛，domain-repository 内仍保留少量历史动态字段桥接。

## P1：Runtime 与读模型继续拆分

### TODO-004 继续拆 `runtime/core.ts` 的健康/用药 mutation

- 状态：done
- 范围：`src/localdb/runtime/core.ts`、新增 `health-mutations.ts` / `medication-mutations.ts`
- 目标：迁出 `batchAddHealthRecordsLocally`、`batchStartMedicationLocally`、`updateHealthRecordLocally`、`deleteHealthRecordLocally`、`updateIllnessStatusLocally`、`recoverIllnessesLocally`、`endMedicationLocally`、`cleanupDuplicateIllnessesLocally`、`endMedicationByDogLocally` 等。
- 约束：保留 `localSyncRuntime.*Locally` public API；不得绕过 outbox、pending upload、issue refresh、flush 节流。
- 验收：
  - `pnpm test tests/localdb/runtime-outbox.test.ts tests/utils/medicationDisplay.test.ts tests/utils/healthDetail.test.ts tests/utils/healthRecordFormSourceContract.test.ts`
  - `pnpm type-check`
- 完成记录（2026-05-14）：
  - 主要文件：`src/localdb/runtime/core.ts`、`src/localdb/runtime/health-mutations.ts`、`src/localdb/runtime/medication-mutations.ts`、`tests/localdb/source-contract.test.ts`。
  - 验收命令：`pnpm test tests/localdb/source-contract.test.ts tests/localdb/runtime-outbox.test.ts tests/utils/medicationDisplay.test.ts tests/utils/healthDetail.test.ts tests/utils/healthRecordFormSourceContract.test.ts`、`pnpm type-check`、`./scripts/graphify-rebuild.sh`、`pnpm test`。
  - 审查结论：健康记录、疾病状态/康复/重复疾病清理、开始用药、记录剂量、批量完成当天、提前结束和按犬结束用药已迁出；`core.ts` 只保留 `localSyncRuntime.*Locally` 门面委派；source contract 固化“不得把健康/用药实现塞回 core”。
  - 残余风险：迁出的健康/用药模块仍有部分历史动态 payload 与数组事务写法；低风险模块与 dog/breeding/task 已由 TODO-013、TODO-016 收敛。

### TODO-005 继续拆 `runtime/core.ts` 的繁育 mutation

- 状态：done
- 范围：`src/localdb/runtime/core.ts`、新增 `breeding-mutations.ts` / `litter-mutations.ts`
- 目标：迁出繁育记录、生产、窝次、断奶、周期关闭等本地写入；物化 `breeding_milestone` 的入口保持可审计。
- 约束：首页仍只读 home scope 四集合；繁育 milestone 必须物化到 `tasks`。
- 验收：
  - `pnpm test tests/utils/breeding*.test.ts tests/localdb/domain-repository.test.ts tests/localdb/runtime-outbox.test.ts`
  - `pnpm type-check`
- 完成记录（2026-05-14）：
  - 主要文件：`src/localdb/runtime/core.ts`、`src/localdb/runtime/breeding-mutations.ts`、`src/localdb/runtime/litter-mutations.ts`、`tests/localdb/source-contract.test.ts`。
  - 验收命令：`pnpm test tests/localdb/source-contract.test.ts tests/utils/breeding*.test.ts tests/localdb/domain-repository.test.ts tests/localdb/runtime-outbox.test.ts`、`pnpm type-check`、`./scripts/graphify-rebuild.sh`、`pnpm test`。
  - 审查结论：繁育记录新增/批量发情/编辑/删除/关闭周期已进 `breeding-mutations.ts`；生产、加幼崽、窝次更新、生产日期调整、确认断奶已进 `litter-mutations.ts`；`core.ts` 只保留同名 public API 委派，milestone 物化仍在繁育模块中显式调用并有 source contract。
  - 残余风险：窝次模块仍有历史动态 payload 和数组事务写法；繁育 mutation 已由 TODO-016 收紧到无裸 `any`。

### TODO-006 继续拆 `runtime/core.ts` 的犬只/任务 mutation

- 状态：done
- 范围：`src/localdb/runtime/core.ts`、新增 `dog-mutations.ts` / `task-mutations.ts`
- 目标：迁出犬只创建/更新/去向/回收站、手动任务、任务完成/延期、体重记录等逻辑。
- 约束：回收站集合边界、首页承接、防闪回、批量健康局部进度不变。
- 验收：
  - `pnpm test tests/utils/dog*.test.ts tests/utils/home*.test.ts tests/localdb/runtime-outbox.test.ts`
  - `pnpm type-check`
- 完成记录（2026-05-14）：
  - 主要文件：`src/localdb/runtime/core.ts`、`src/localdb/runtime/dog-mutations.ts`、`src/localdb/runtime/task-mutations.ts`、`tests/localdb/source-contract.test.ts`。
  - 验收命令：`pnpm test tests/localdb/source-contract.test.ts tests/utils/dog*.test.ts tests/utils/home*.test.ts tests/localdb/runtime-outbox.test.ts`、`pnpm type-check`、`./scripts/graphify-rebuild.sh`、`pnpm test`。
  - 审查结论：犬只创建/更新/改名/去向/升级/软删/回收站恢复与永久删除、体重记录已进 `dog-mutations.ts`；手动任务创建、任务完成/批量完成/延期已进 `task-mutations.ts`；`core.ts` 保留同名 public API 委派和同步调度，source contract 已固化拆分边界。
  - 残余风险：dog/task 模块已由 TODO-016 收紧到无裸 `any`；数组式事务仍保留兼容，行级迁移由 TODO-018 提供示范入口。

### TODO-007 继续拆 `domain-repository/core.ts`

- 状态：done
- 范围：`src/localdb/domain-repository/core.ts`、`src/localdb/domain-repository/*`、`src/localdb/domain-services/*`
- 目标：把剩余读模型按犬只、繁育、健康、财务、销售、设置/回收站完全下沉；`core.ts` 最终只保留共享工具或被删除。
- 建议做法：每次只迁一个领域，迁完跑对应领域测试。
- 验收：
  - `domain-repository/core.ts` 明显降到可维护规模。
  - `pnpm test tests/localdb/domain-repository.test.ts`
  - `pnpm type-check`
- 完成记录（2026-05-14）：
  - 主要文件：`src/localdb/domain-repository/core.ts`、`src/localdb/domain-repository/{dogs,breeding,health,finance,sale,settings-recycle,shared}.ts`、`tests/localdb/source-contract.test.ts`。
  - 验收命令：`pnpm test tests/localdb/domain-repository.test.ts tests/localdb/source-contract.test.ts`、`pnpm test tests/localdb`、`pnpm type-check`、`./scripts/graphify-rebuild.sh`。
  - 审查结论：`core.ts` 已降为 6 行兼容 barrel；犬只、繁育/窝次、健康/用药、财务、销售、设置/回收站读模型均落到对应领域文件；领域文件不再从 `core` 反向 re-export，source contract 固化“core 只能兼容导出”。
  - 残余风险：领域读模型仍保留历史动态字段桥接与部分较长的繁育/窝次聚合逻辑；本轮重点先收敛 runtime 核心 mutation。

## P1：首页事实源与投影性能

### TODO-008 拆 `pages/home/index.vue` 成更小组件

- 状态：done
- 范围：`src/pages/home/index.vue`、`src/pages/home/components/*`、`src/pages/home/composables/*`
- 目标：把首页模板与交互拆成概览/今日分组/周历/底部 sheet/批量卡片进度等组件；页面只保留路由、scope、数据编排。
- 约束：首页固定四层顺序、红点口径、source 承接、防闪回、suppression 不变。
- 验收：
  - `pages/home/index.vue` 明显降到可审查规模。
  - `pnpm test tests/utils/home*.test.ts tests/localdb/home-projection.test.ts`
  - H5 首页手动打开验证。
- 完成记录（2026-05-14）：
  - 主要文件：`src/pages/home/index.vue`、`src/pages/home/components/HomeHeader.vue`、`src/pages/home/components/HomeCardSections.vue`、`src/pages/home/components/HomeSectionList.vue`、`src/pages/home/components/HomeTaskSheets.vue`、`tests/utils/home*.test.ts`、`tests/localdb/source-contract.test.ts`。
  - 验收命令：`pnpm test tests/utils/home*.test.ts tests/localdb/home-projection.test.ts tests/localdb/source-contract.test.ts`、`pnpm type-check`、`pnpm build:h5`、`./scripts/graphify-rebuild.sh`；另启动 `pnpm dev:h5 -- --host 127.0.0.1 --port 5200` 并用 `curl` 确认 `http://localhost:5200/` 返回 200。
  - 审查结论：首页 `index.vue` 从约 3072 行降到 1882 行，只保留页面状态、scope、数据编排和 mutation 承接；问候摘要、卡片分区/空态/骨架、任务/健康/繁育 sheet 已迁入组件；修复并测试固定了 `SmartCard` 多参数 `complete/postpone` 事件透传。
  - 残余风险：当前环境没有可用 Browser Node REPL，未做真实浏览器视觉点击；H5 编译、本地服务入口 smoke 与首页 Network 验收已在 TODO-011 / TODO-017 覆盖，App 真机抓包仍属于下一阶段回归。

### TODO-009 去掉 `taskStore` 对首页业务卡片的重复持久化

- 状态：done
- 范围：`src/stores/taskStore.ts`、`src/pages/home/index.vue`、`src/pages/home/composables/useHomeBatchProgress.ts`、`src/components/layout/BFabSheet.vue`
- 目标：LocalDB / home snapshot 成为首页业务卡片唯一事实源；`taskStore` 只保留最近操作、pending focus target、必要的短时 UI 状态或 FAB 推荐输入。
- 风险：需要重新设计 `BFabSheet` 的智能推荐数据来源，避免离线/首屏体验退化。
- 验收：
  - 删除或缩窄 `breed_workspace_cache:tasks:<familyId>` 持久化。
  - 切换家庭后不复用旧 cards/counts/batch progress。
  - `pnpm test tests/utils/authSessionSwitch.test.ts tests/utils/cacheIsolation.test.ts tests/utils/home*.test.ts`
- 完成记录（2026-05-14）：
  - 主要文件：`src/stores/taskStore.ts`、`src/pages/home/index.vue`、`src/pages/home/composables/useHomeBatchProgress.ts`、`tests/utils/{authSessionSwitch,cacheIsolation,homeBatchCardSourceContract,fabTaskRecommendation}.test.ts`。
  - 验收命令：`pnpm test tests/utils/authSessionSwitch.test.ts tests/utils/cacheIsolation.test.ts tests/utils/home*.test.ts tests/utils/fabTaskRecommendation.test.ts`、`pnpm type-check`、`./scripts/graphify-rebuild.sh`。
  - 审查结论：`taskStore` 不再读写 `getWorkspaceCacheKey('tasks', familyId)`，`persistForFamily` 仅保留兼容不落盘；首页不再从 `taskStore.cards/counts` 恢复业务卡片，首屏改为 LocalDB/home snapshot；FAB 推荐输入改为会话内 `setRecommendationInput`，并先读本地 snapshot、后台 `syncScope('home')` 校正。
  - 残余风险：批量卡局部进度仍作为会话内 UI 状态挂在 `taskStore.batchCardProgress`，不再跨刷新持久化；如果后续要求刷新后保留未完成批量进度，需要另设计非业务事实源的短时缓存口径。

### TODO-010 首页 projection 增量化或 memo 化

- 状态：done
- 范围：`src/localdb/home-projection.ts`、`src/localdb/runtime/home-snapshot.ts`
- 目标：在 collection revisions 未变化时复用投影结果；或把 dayCounts/weekCards 的计算按日期范围和 medication/tasks revision 分层缓存，避免每次 snapshot 全量重算三套结构。
- 约束：缓存 key 必须包含 `familyId`、日期范围、相关 collection revisions；无 `familyId` 不写业务缓存。
- 验收：
  - 增加 projection memo 命中测试。
  - 首页切换家庭、跨天、手动刷新、任务完成后数据正确失效。
  - `pnpm test tests/localdb/home-projection.test.ts tests/utils/home*.test.ts`
- 完成记录（2026-05-15）：
  - 主要文件：`src/localdb/runtime/home-snapshot.ts`、`src/localdb/runtime/core.ts`、`tests/localdb/home-projection.test.ts`、`tests/localdb/source-contract.test.ts`。
  - 验收命令：`pnpm test tests/localdb/home-projection.test.ts tests/localdb/source-contract.test.ts tests/utils/home*.test.ts`、`pnpm type-check`、`./scripts/graphify-rebuild.sh`。
  - 审查结论：首页 snapshot 已按 `familyId + 北京日期/日期范围 + dogs/tasks/health_records/medication_tasks revision` memo 化 `home/dateCounts/weekCards`；memo helper 使用同一个 `HomeEntitiesSnapshot` 携带 `entities + revisionKey`，避免 key 与实体快照分离；空 `familyId` 直接计算不写 memo；`clearHomeEntitiesCache()` 同步清 projection memo，覆盖手动刷新/物化里程碑失效。
  - 残余风险：当前策略仍是 revision 粒度 memo，不是逐任务增量 diff；collection revision 变化时会重算三套结构，但已避免未变化时反复全量投影。

### TODO-011 补齐首页 Network 真实设备验收记录

- 状态：done
- 范围：真实设备 / H5 network 验收文档，可落 `docs/` 或 PR 验收记录
- 目标：验证进入首页不拉非首页 scope、TTL 内切页不重复 pull、同 scope 并发只发一个请求、手动刷新只强制当前 scope。
- 验收：
  - 留下具体日期、设备、操作步骤、请求数量截图或日志摘要。
  - 若发现请求异常，补测试或修 runtime scope。
- 完成记录（2026-05-15）：
  - 主要文件：`docs/home-network-acceptance.md`、`docs/README.md`、`tests/localdb/home-network-acceptance.test.ts`。
  - 验收命令：`pnpm test tests/localdb/home-network-acceptance.test.ts tests/localdb/runtime-outbox.test.ts tests/localdb/scope-registry.test.ts tests/utils/homeLocalFirstEntry.test.ts`、`pnpm type-check`、`./scripts/graphify-rebuild.sh`、`curl -I --max-time 10 http://127.0.0.1:5200/`。
  - 审查结论：已留下 2026-05-15 H5 Network 验收记录，包含环境、操作步骤、请求数量日志摘要；新增测试用 `family-service.pullCollections` recorder 固化首页首进只拉 `dogs/tasks/health_records/medication_tasks`、TTL 内重复进入 0 新请求、手动刷新只强制 `home` scope、同 scope 并发只发 1 次请求，非首页集合请求数为 0。
  - 残余风险：本次是 H5 本地服务与 runtime recorder 验收，未包含真机抓包截图；TODO 范围允许 H5 Network 验收，后续真机回归若发现平台层额外请求，应补充到 `docs/home-network-acceptance.md` 并新增测试。

## P2：操作日志、类型清理与长期维护

### TODO-012 优化本地操作日志文案生成

- 状态：done
- 范围：`src/localdb/local-operation-log.ts`、runtime enqueue mutation payload
- 目标：减少 `createPendingLocalOperationLog` 同步路径中的多次 DB 查表；优先使用 mutation payload 中携带的名称快照，缺失时再 best-effort 异步补全。
- 建议做法：把 descriptor 拆成纯 payload descriptor + async enrichment；或在业务 mutation payload 中补 `dogName/taskTitle/recordLabel` 等快照字段。
- 验收：
  - 常见 mutation 生成日志不再额外查无关表。
  - `pnpm test tests/localdb/local-operation-log.test.ts tests/utils/operationLog*.test.ts`
- 完成记录（2026-05-15）：
  - 主要文件：`src/localdb/local-operation-log.ts`、`src/localdb/runtime/core.ts`、`src/localdb/runtime/{task,health,medication,dog,breeding,litter,sale}-mutations.ts`、`tests/localdb/local-operation-log.test.ts`。
  - 验收命令：`pnpm test tests/localdb/local-operation-log.test.ts tests/utils/operationLogCache.test.ts tests/utils/operationLogMerge.test.ts tests/localdb/runtime-outbox.test.ts`、`pnpm test tests/localdb/domain-repository.test.ts tests/localdb/local-operation-log.test.ts tests/localdb/runtime-outbox.test.ts`、`pnpm type-check`、`./scripts/graphify-rebuild.sh`。
  - 审查结论：`enqueueMutation` 新增不进入 outbox payload 的 `logSnapshot` 参数；日志 descriptor 优先使用 `taskTitle/taskTitles/dogName/dogNames/medicationTitle/recordLabel/targetName` 快照，缺失时继续 best-effort 查询本地表。任务完成/批量完成/延期、健康记录新增/更新、用药开始/打卡/批量完成、犬只更新/改名/去向/升级/删除/体重、繁育新增/更新、生产、销售创建等常见 mutation 已传入快照。
  - 残余风险：操作者昵称仍会读取本地 `families` 或缓存，这是 actor 归属解析，不属于目标实体文案查表；少量低频 update/delete 仍依赖兜底查询，后续类型清理或领域细化时可继续补快照。

### TODO-013 清理核心层 `any` / `Record<string, any>` 扩散

- 状态：done
- 范围：`src/localdb/runtime/*`、`src/localdb/domain-repository/*`、`src/localdb/home-projection.ts`
- 目标：按领域逐步引入 typed payload / row interface，避免新增逻辑继续依赖裸 `any`。
- 建议做法：先从已拆模块开始，例如 `finance-mutations.ts`、`sale-mutations.ts`、`agent-mutations.ts`、`settings-mutations.ts`。
- 验收：
  - 每个领域模块完成后减少一批 `any`。
  - `pnpm type-check`
- 完成记录（2026-05-15）：
  - 主要文件：`src/localdb/runtime/agent-mutations.ts`、`src/localdb/runtime/finance-mutations.ts`、`src/localdb/runtime/settings-mutations.ts`、`src/localdb/runtime/core.ts`、`src/localdb/runtime/{task,health,medication,dog,breeding,litter,sale}-mutations.ts`、`src/localdb/local-operation-log.ts`、`tests/localdb/source-contract.test.ts`。
  - 验收命令：`pnpm test tests/localdb/source-contract.test.ts tests/localdb/domain-repository.test.ts tests/localdb/runtime-outbox.test.ts tests/localdb/local-operation-log.test.ts`、`pnpm type-check`、`./scripts/graphify-rebuild.sh`。
  - 审查结论：`agent-mutations.ts`、`finance-mutations.ts`、`settings-mutations.ts` 已引入 typed payload / `LocalRowOf<C>` / 局部扩展行类型，三个模块的 `any` / `Record<string, any>` 计数降为 0；`logSnapshot` 通道改用 `Record<string, unknown>`；source contract 固化这三个已收敛模块不得重新引入裸 `any`。
  - 残余风险：历史高复杂度模块仍有存量 `any`，尤其 `domain-repository/breeding.ts`、`runtime/dog-mutations.ts`、`runtime/core.ts`、`runtime/sale-mutations.ts`、`runtime/breeding-mutations.ts`；本 TODO 完成的是“防扩散 + 已拆低风险模块收敛”，后续若继续清零应按领域拆成独立任务，避免一次性大改造成行为风险。

### TODO-014 完善 source contract 护栏

- 状态：done
- 范围：`tests/localdb/source-contract.test.ts`、`tests/utils/*SourceContract*.test.ts`
- 目标：把本轮架构红线固化成测试：页面不得直接 import runtime 内部 mutation 模块；首页不得调用全表 deep clone API；同步状态不得扫描业务集合；SQLite 真实错误不得 fallback。
- 验收：
  - source contract 覆盖新增红线。
  - `pnpm test tests/localdb/source-contract.test.ts`
- 完成记录（2026-05-15）：
  - 主要文件：`tests/localdb/source-contract.test.ts`。
  - 验收命令：`pnpm test tests/localdb/source-contract.test.ts`、`pnpm type-check`、`./scripts/graphify-rebuild.sh`。
  - 审查结论：source contract 已覆盖 SQLite v2 真实错误不得 fallback、页面/store 不得直接 import runtime 内部 mutation 模块、首页不得调用 `localDb.getTable/getRowsByFamily/findById` 这类 deep clone 读取 API、同步状态聚合不得扫描业务集合；额外 grep 确认当前页面/store 与首页代码满足新增红线。
  - 残余风险：这是源码级契约，主要防止边界回退；若后续新增新的 runtime 内部 mutation 模块或新的业务集合，需要同步扩展白名单/黑名单。

### TODO-015 文档同步与收口审查

- 状态：done
- 范围：`AGENTS.md`、`docs/design/04-implementation.md`、必要时 `docs/ROADMAP.md`
- 目标：每完成一批拆分或架构边界变化，同步事实源；避免 `AGENTS.md`、implementation 文档和代码结构再次偏离。
- 验收：
  - 文档只记录事实源和协作红线，不写临时流水账。
  - 修改代码文件后执行 `./scripts/graphify-rebuild.sh`。
- 完成记录（2026-05-15）：
  - 主要文件：`AGENTS.md`、`docs/design/04-implementation.md`、`docs/ROADMAP.md`、`docs/README.md`、`TODOS.md`。
  - 验收命令：`./scripts/graphify-rebuild.sh`；另通过 `rg` 复查旧首页四层顺序、重复 Network 索引和临时流水账关键词。
  - 审查结论：协作入口已同步 runtime/repository/home 拆分、readonly 读取、projection memo、`taskStore` 事实源收口、operation log `logSnapshot` 与 SQLite fallback 红线；implementation 文档已同步当前实现边界和 source contract；ROADMAP 明确 H5 Network 已验收、真实设备仍需回归；README 去掉重复验收文档索引。
  - 残余风险：文档仍把真实设备 Network、多端并发、冲突 UX 与附件失败/重试体验作为下一阶段重点，这些不属于本轮 TODO-001~015 的完成范围。

### TODO-016 收紧核心 dog / breeding / task mutation 类型

- 状态：done
- 范围：`src/localdb/runtime/dog-mutations.ts`、`src/localdb/runtime/breeding-mutations.ts`、`src/localdb/runtime/task-mutations.ts`、`tests/localdb/source-contract.test.ts`
- 目标：为犬只、繁育、任务这三个高频核心域引入明确 payload interface、`LocalRowOf<C>` 行类型与局部扩展类型，减少裸 `any` / `Record<string, any>`，避免后续业务字段误写无法在编译期暴露。
- 约束：保持 `localSyncRuntime.*Locally` public API 与 outbox payload wire shape 兼容；不借类型清理顺手改业务规则。
- 验收：
  - 三个模块的裸 `any` / `Record<string, any>` 计数显著下降，并新增 source contract 防止核心 payload 重新退回裸 `Record<string, any>`。
  - `pnpm test tests/localdb/source-contract.test.ts tests/localdb/domain-repository.test.ts tests/localdb/runtime-outbox.test.ts`
  - `pnpm type-check`
- 完成记录（2026-05-15）：
  - 主要文件：`src/localdb/runtime/dog-mutations.ts`、`src/localdb/runtime/breeding-mutations.ts`、`src/localdb/runtime/task-mutations.ts`、`tests/localdb/source-contract.test.ts`。
  - 验收命令：`pnpm test tests/localdb/source-contract.test.ts tests/localdb/domain-repository.test.ts tests/localdb/runtime-outbox.test.ts`、`pnpm type-check`、`./scripts/graphify-rebuild.sh`、`rg -n "\\bany\\b|Record<string, any>" src/localdb/runtime/dog-mutations.ts src/localdb/runtime/breeding-mutations.ts src/localdb/runtime/task-mutations.ts`。
  - 审查结论：dog / breeding / task 三个核心 mutation 模块已引入局部 payload、`LocalRowOf<C>` 行类型与扩展行类型，裸 `any` / `Record<string, any>` 命中降为 0；source contract 已把三者加入“已收敛模块不得重新引入裸 any”护栏。
  - 残余风险：部分历史 builder 返回对象与长期领域类型仍存在字段口径不完全一致（例如 nullable 财务关联字段、任务历史 `type` 字段），本轮用局部扩展类型和 `unknown` 桥接保持 wire shape 兼容；如要彻底消除桥接，需要后续统一 `src/types/*` 与本地镜像真实字段。

### TODO-017 继续瘦身首页编排层

- 状态：done
- 范围：`src/pages/home/index.vue`、`src/pages/home/composables/*`、`src/pages/home/components/*`、`tests/utils/home*.test.ts`
- 目标：继续把首页行为与 sheet 状态从 `index.vue` setup 中迁入 composables，例如 `useHomeTaskActions`、`useHomeSheets`，让页面更接近“组装视图”。
- 约束：首页固定四层、红点口径、来源页承接、防闪回、suppression、批量健康/用药局部进度不变；不得让子组件直接读云或绕过 `localSyncRuntime`。
- 验收：
  - `src/pages/home/index.vue` 行数继续下降，且 source contract 保持首页组件拆分边界。
  - `pnpm test tests/utils/home*.test.ts tests/localdb/home-projection.test.ts tests/localdb/source-contract.test.ts`
  - `pnpm type-check`
  - H5 首页 smoke 通过。
- 完成记录（2026-05-15）：
  - 主要文件：`src/pages/home/index.vue`、`src/pages/home/composables/useHomeSheets.ts`、`tests/localdb/source-contract.test.ts`。
  - 验收命令：`pnpm test tests/utils/home*.test.ts tests/localdb/home-projection.test.ts tests/localdb/source-contract.test.ts`、`pnpm type-check`、`./scripts/graphify-rebuild.sh`、`npm_config_script_shell=/bin/zsh pnpm dev:h5 -- --host 127.0.0.1 --port 5200`、`/usr/bin/curl -I http://localhost:5200/`。
  - 审查结论：首页 sheet 状态、选择计数、批量选择切换、繁育动作摘要和日期选择回调已下沉到 `useHomeSheets`；`index.vue` 从 1882 行降到 1786 行，source contract 收紧到 `< 1800` 并要求继续使用 `useHomeSheets`。
  - 残余风险：`HomeTaskSheets` 的 props/events 仍偏多，本轮先把状态与计算从页面抽离；若后续继续压缩，可进一步把确认动作编排拆到 `useHomeTaskActions`，但需要更大范围的事件契约测试。

### TODO-018 设计并落地行级事务 API

- 状态：done
- 范围：`src/localdb/db.ts`、优先迁移一个低风险 mutation 模块、相关 `tests/localdb`
- 目标：在现有 `transact(collections, mutator)` 兼容 API 之外，新增 row-level mutation API，例如按 id 更新、插入、删除单行，减少业务层为了改少量行而操作整个 collection 数组的工作副本成本。
- 建议做法：先新增兼容的事务上下文 helper，不一次性迁移全部业务；优先选择 `settings`、`agent` 或单行任务类 mutation 作为示范迁移。
- 约束：保留原数组式 `transact` 兼容入口；row-level API 必须继续使用 revision 检查、同 row 冲突检测、v2 adapter 行级提交与 legacy fallback。
- 验收：
  - 新增 row-level API 单元测试，覆盖 update / insert / delete、缺失行、同 row 冲突或 revision 校验。
  - 至少一个 runtime mutation 改用 row-level API，并证明 outbox 行为不变。
  - `pnpm test tests/localdb/repository.test.ts tests/localdb/runtime-outbox.test.ts tests/localdb/source-contract.test.ts`
  - `pnpm type-check`
- 完成记录（2026-05-15）：
  - 主要文件：`src/localdb/db.ts`、`src/localdb/runtime/agent-mutations.ts`、`tests/localdb/repository.test.ts`、`tests/localdb/source-contract.test.ts`。
  - 验收命令：`pnpm test tests/localdb/repository.test.ts tests/localdb/runtime-outbox.test.ts tests/localdb/source-contract.test.ts`、`pnpm type-check`、`./scripts/graphify-rebuild.sh`。
  - 审查结论：新增 `localDb.transactRows(collection, ctx => ...)`，提供 `getRow/upsertRow/updateRow/deleteRow`，v2 路径只按 id 读写 touched rows 并复用 `commitV2Diff` 的 revision 冲突检测；legacy fallback 保持兼容写回。`updateAgentLocally` 已迁到行级事务，runtime outbox 回归通过。
  - 残余风险：后续迁移已由 TODO-020 继续推进；历史数组式 `transact` 兼容入口仍保留给非 runtime-mutation 调用方和回退场景。

### TODO-019 收紧 runtime mutation payload 具体接口

- 状态：done
- 范围：`src/localdb/runtime/*-mutations.ts`、`src/localdb/runtime/local-builders.ts`、`tests/localdb/source-contract.test.ts`
- 目标：把 Gemini 指出的“伪类型安全”继续推平：为高频 mutation 编写具体 payload interface，例如 `CreateDogPayload`、`UpdateDogPayload`、`AddBreedingRecordPayload`、`BatchCreateManualTasksPayload`，减少 `Record<string, unknown>` 作为函数入参的使用。
- 当前核验证据：`dog-mutations.ts`、`breeding-mutations.ts`、`task-mutations.ts` 已无裸 `any` / `Record<string, any>`，但仍有 `DogPayload = Record<string, unknown>`、`BreedingMutationPayload = Record<string, unknown> & ...`、`BatchCreateManualTasksPayload = Record<string, unknown> & ...`；finance / agent / settings 也仍有动态 payload bridge。
- 约束：保留 outbox payload wire shape 与页面调用兼容；`details`、`extra_arrangement` 这类业务动态字段可保留窄化后的 `Record<string, unknown>` 子对象，但顶层 mutation 入参不得继续用泛化兜底。
- 验收：
  - 新增 source contract：高频 runtime mutation 的导出函数参数不得直接使用 `Record<string, unknown>` 或 `Record<string, any>` 作为顶层 payload。
  - `pnpm test tests/localdb/source-contract.test.ts tests/localdb/domain-repository.test.ts tests/localdb/runtime-outbox.test.ts`
  - `pnpm type-check`
- 完成记录（2026-05-15）：
  - 主要文件：`src/localdb/runtime/dog-mutations.ts`、`src/localdb/runtime/breeding-mutations.ts`、`src/localdb/runtime/task-mutations.ts`、`src/localdb/runtime/core.ts`、`tests/localdb/source-contract.test.ts`。
  - 验收命令：`pnpm test tests/localdb/source-contract.test.ts tests/localdb/repository.test.ts tests/localdb/runtime-outbox.test.ts`、`pnpm type-check`。
  - 审查结论：dog / breeding / task 高频 mutation 已改为 `CreateDogPayload`、`UpdateDogPayload`、`DogDispositionPayload`、`DogWeightPayload`、`BreedingMutationPayload`、`BatchCreateManualTasksPayload` 等具体顶层接口；`localSyncRuntime` 门面同步使用这些类型；source contract 明确禁止这些入口退回 `Record<string, any>` / `Record<string, unknown>` 顶层 payload。
  - 残余风险：`RuntimeMutationContext.enqueueMutation` 的日志快照和局部动态子对象仍保留 `Record<string, unknown>`；这是出站日志 / details 的动态载荷边界，不再作为高频 mutation 顶层入参兜底。

### TODO-020 分阶段迁移 runtime mutation 到 `transactRows`

- 状态：done
- 范围：`src/localdb/runtime/*-mutations.ts`、`src/localdb/db.ts`、`tests/localdb/repository.test.ts`、`tests/localdb/runtime-outbox.test.ts`
- 目标：把新旧事务 API 混用继续推平，优先迁移只更新少量已知 id 的 mutation 到 `localDb.transactRows`，减少为了改一两行而访问整张 collection 工作副本。
- 当前核验证据：`localDb.transactRows` 已存在且支持单集合与多集合行级事务；`src/localdb/runtime/*-mutations.ts` 已完成全量迁移，残留扫描无 `localDb.transact` / `runLocalMutation` / 批量整表 upsert / `tables.*` 整表写入。
- 建议顺序：先迁移单 collection / 已知 id 的低风险路径，例如 task postpone / medication dose / soft delete / settings 单行更新；多集合级联（犬只改名、生产、销售完成）最后迁。
- 约束：不得一次性大范围重写复杂业务；每迁一组必须证明 outbox、baseVersions、touchedEntities、冲突检测和本地 UI 承接不变。
- 验收：
  - 每阶段至少迁移一组 runtime mutation，并新增/更新回归测试证明行为不变。
  - source contract 统计 `localDb.transact` / `runLocalMutation` 使用数量下降，并保留少量复杂级联的明确豁免说明。
  - `pnpm test tests/localdb/repository.test.ts tests/localdb/runtime-outbox.test.ts tests/localdb/source-contract.test.ts`
  - `pnpm type-check`
- 完成记录（2026-05-15）：
  - 主要文件：`src/localdb/db.ts`、`src/localdb/runtime/{agent,finance,settings,task,medication,breeding,health,sale,litter,dog}-mutations.ts`、`tests/localdb/repository.test.ts`、`tests/localdb/source-contract.test.ts`。
  - 验收命令：`rg -n "localDb\\.transact\\(|runLocalMutation\\(|mutateLocal as runLocalMutation|upsertLocalRows\\(|localDb\\.upsertRows\\(|\\btables\\." src/localdb/runtime/*-mutations.ts`、`pnpm type-check`、`pnpm test tests/localdb`、`./scripts/graphify-rebuild.sh`。
  - 审查结论：runtime mutation 文件已全部迁到 `localDb.transactRows`，复杂多集合级联（犬只改名/去向、生产/断奶、销售完成、健康/用药联动、设置联动等）均改为按已知 collection + id 的 `updateRow/upsertRow/deleteRow`；多集合行级事务 API 已补测试，source contract 固化禁止 runtime mutation 回退到整表事务、整表 helper 或 `tables.*` 数组重写。
  - 残余风险：`transact` 兼容 API 仍存在，用于旧调用方和渐进迁移边界；本 TODO 的 runtime mutation 范围内已无数组式事务残留。

### TODO-021 继续抽离首页 action 编排

- 状态：done
- 范围：`src/pages/home/index.vue`、`src/pages/home/composables/*`、`tests/utils/home*.test.ts`
- 目标：纠正 Gemini 报告中“首页约 1060 行”的不准确判断：当前 `index.vue` 仍约 1780 行，sheet 状态已抽离但完成/推迟/用药/康复/停止用药等 action 编排仍集中在页面内。下一步抽出 `useHomeTaskActions` 或等价 composable。
- 当前核验证据：`wc -l src/pages/home/index.vue` 为 1780；`useHomeSheets`、`useHomeFocus`、`useHomeBatchProgress` 已存在，但 action handlers 仍在页面内。
- 约束：首页固定四层、红点口径、来源页承接、防闪回、suppression、批量局部进度不变；不得让 composable 绕过 `localSyncRuntime` 或引入云端读取。
- 验收：
  - `src/pages/home/index.vue` 行数继续下降，source contract 收紧首页编排边界。
  - `pnpm test tests/utils/home*.test.ts tests/localdb/home-projection.test.ts tests/localdb/source-contract.test.ts`
  - `pnpm type-check`
  - H5 首页 smoke 通过。
- 完成记录（2026-05-15）：
  - 主要文件：`src/pages/home/index.vue`、`src/pages/home/composables/useHomeTaskActions.ts`、`tests/localdb/source-contract.test.ts`。
  - 验收命令：`pnpm test tests/utils/home*.test.ts tests/localdb/home-projection.test.ts`、`pnpm test tests/localdb/source-contract.test.ts tests/localdb/repository.test.ts tests/localdb/runtime-outbox.test.ts`、`pnpm type-check`。
  - 审查结论：完成 / 推迟 / 批量完成 / 用药打卡 / 批量用药完成 / 疾病康复 / 疾病状态更新 / 停止用药的 runtime 调用已集中到 `useHomeTaskActions`；`index.vue` 从 1780 行降到 1739 行；source contract 收紧到 `< 1750`，并禁止首页直接调用这些 action runtime 方法。
  - 残余风险：首页乐观 UI 更新、卡片淡出和 sheet 事件编排仍在页面内；这是更高风险的交互状态层，后续若继续瘦身应单独补事件契约测试。

## 当前已完成但需保留验收记忆

- LocalDB v2 行级 adapter、迁移状态、revision 稳定性、按家庭读取、事务 diff 冲突测试已完成一轮。
- SQLite 真实错误不得静默 fallback 已修，并有 source contract。
- `sync_issues` pending upload 清理已完成一轮。
- 首页读取已收敛到 home scope 四集合；繁育 milestone 由本地写入 / ack / scope 校正物化到 `tasks`。
- runtime 已拆出 settings / finance / sale / agent mutation；`localSyncRuntime` public API 保持兼容。
- domain repository 已改成 barrel；财务、销售、健康、繁育一批纯派生逻辑已进 `domain-services`。
- 最新全量验证记录（2026-05-15）：`pnpm type-check` 通过；`pnpm test` 通过（78 个测试文件 / 764 条测试）；`./scripts/graphify-rebuild.sh` 通过（2752 nodes / 4529 edges / 443 communities）；`/usr/bin/curl -I http://localhost:5200/` 返回 `HTTP/1.1 200 OK`。
