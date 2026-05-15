# 首页 Network 验收记录

## 2026-05-15 H5 验收

- 验收类型：H5 本地验收 + runtime Network 回放测试。
- 设备 / 环境：macOS 26.3.1 (a)，Node v22.16.0，pnpm 10.12.1。
- H5 入口：`http://localhost:5200/`。
- 相关测试：`tests/localdb/runtime-outbox.test.ts` 的“首页 Network 验收：只拉 home scope、TTL 内不重复拉取、手动刷新只强制当前 scope、同 scope 并发去重”。

## 操作与请求摘要

1. 启动 H5：
   - 命令：`npm_config_script_shell=/bin/zsh pnpm dev:h5 -- --host 127.0.0.1 --port 5200`
   - 结果：Vite dev server ready，Local URL 为 `http://localhost:5200/`。
2. 校验 H5 入口：
   - 命令：`/usr/bin/curl -I http://localhost:5200/`
   - 结果：`HTTP/1.1 200 OK`，`Content-Type: text/html`。
3. 首页首次同步：
   - 触发：`localSyncRuntime.syncScope('home', { force: true })`
   - 请求数：1 次 `family-service.pullCollections`
   - collections：`dogs`、`tasks`、`health_records`、`medication_tasks`
   - 未出现：`breeding_cycles`、`breeding_records`、`expenses`、`incomes`、`sale_records`
4. TTL 内再次进入首页：
   - 触发：`localSyncRuntime.syncScope('home')`
   - 新增请求数：0
   - 结果：`skipped = true`，`skipReason = ttl:20000`
5. 手动刷新当前首页 scope：
   - 触发：`localSyncRuntime.syncActiveScope({ force: true })`
   - 新增请求数：1 次 `family-service.pullCollections`
   - collections：仍只包含首页四集合
6. 同一 scope 并发同步：
   - 触发：并发两次 `localSyncRuntime.syncScope('home', { force: true })`
   - 新增请求数：1 次 `family-service.pullCollections`
   - 结果：第二个调用复用第一个 in-flight promise，返回同一个结果对象

## 验收结论

- 进入首页不拉非首页 scope：通过。
- TTL 内切回首页不重复 pull：通过。
- 同一 scope 并发只发一个请求：通过。
- 手动刷新只强制当前 `home` scope：通过。

## 验收命令

- `pnpm test tests/localdb/runtime-outbox.test.ts tests/localdb/scope-registry.test.ts tests/utils/homeLocalFirstEntry.test.ts`
- `pnpm test tests/localdb/source-contract.test.ts`
- `npm_config_script_shell=/bin/zsh pnpm dev:h5 -- --host 127.0.0.1 --port 5200`
- `/usr/bin/curl -I http://localhost:5200/`

## 残余说明

本记录使用 H5 本地环境和可复验的 runtime Network 回放日志完成首页 Network 验收；未额外使用 App 真机抓包。若需要补 App 真机证据，按同一四步操作在 HBuilderX 运行到设备后，用 Network 面板或代理抓包追加截图。
