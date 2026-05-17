# TODOS

仅保留当前仍未完成或只完成了一部分的事项。已完成、Phase 1 旧阶段说明、以及已被 Local-First 路线替代的待办不再保留在本文件。

## `/goal` 执行协议

使用 Codex 的 goal 模式执行本文件时，按 TODO 编号从小到大逐项推进。每个 TODO 都必须完整经历“实现 → 验收 → 审查 1 → 修复 → 审查 2 → 修复 → 复验 → 完成记录”，不能因为类型检查或局部测试通过就直接进入下一项。

### 单项任务关闭流程

1. 完成该 TODO 的最小相关改动，只改范围内文件；不得借性能 / 类型 / 拆分任务顺手改变业务语义。
2. 执行该 TODO 列出的验收命令；如果修改了代码文件，必须执行 `./scripts/graphify-rebuild.sh`。
3. 审查 1：检查 diff 范围、业务语义、Local-First Contract、scope / outbox / pending upload / cache isolation、性能热点和 source contract 是否符合目标。
4. 修复审查 1 发现的全部问题，并重新执行相关验收。
5. 审查 2：从回归角度复看测试证据、失败路径、兼容性、边界条件和是否满足本 TODO 的每条验收。
6. 修复审查 2 发现的全部问题，并重新执行相关验收。
7. 两轮审查都通过后，在对应 TODO 下追加完成记录：完成日期、主要文件、执行过的验收命令、两轮审查结论、残余风险。

### 全部任务完成后的整体收口

所有开放 TODO 都完成后，必须再进行两轮整体审查和修复：

1. 整体审查 1：检查 `git diff --stat`、关键 diff、架构边界、Local-First Contract、性能热点、类型边界、缓存隔离和文档漂移。发现问题时新增或重开 TODO，修复并重新验收。
2. 整体审查 2：全量复查验收证据，至少执行 `pnpm type-check`、`pnpm test`、`./scripts/graphify-rebuild.sh`；涉及前端体验时补 H5 smoke / 必要的 Network 验收。发现问题时继续修复并重新执行两轮整体审查。
3. 两轮整体审查时顺手评估下一批候选优化是否需要升级为新 TODO：销售 / 财务自动收入的领域 factory、财务 / 犬只详情大数组响应式 `shallowRef` 优化、犬名等冗余字段的显式级联维护服务。只在有明确收益和可控边界时新增，不要打断当前 `TODO-022` 至 `TODO-028`。
4. 只有两轮整体审查都通过，才能把 `TODOS.md` 改回“当前没有开放 TODO”。

## 当前状态

截至 2026-05-15，`TODO-001` 至 `TODO-028` 已按本文件协议完成并移除。

当前没有开放 TODO。

整体收口记录（2026-05-15）：

- 整体审查 1：检查 `git diff --stat`、关键 Local-First diff、类型边界、pending upload、scope full-pull、繁育 milestone、犬只详情财务拆分与 source contract；未发现需要新增或重开 TODO 的阻断问题。
- 整体审查 2：复跑 `pnpm type-check`、`pnpm test`、`./scripts/graphify-rebuild.sh`，并补 H5 smoke：`curl -I http://localhost:5200/` 返回 `HTTP/1.1 200 OK`。
- 下一批候选优化评估：销售 / 财务自动收入领域 factory、犬只详情大数组 `shallowRef`、犬名冗余字段级联维护均有潜在收益，但需要独立领域验收，当前没有足够小且明确的边界放入本文件。
