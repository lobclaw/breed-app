# UniCloud 技术验证报告

> **归档说明：** 本文档仅保留为历史技术验证证据，不再作为日常实现入口。当前有效的技术规则、架构边界与实现约束以 `docs/design/03-tech-stack.md` 和 `docs/design/04-implementation.md` 为准。

> 本报告对照 UniCloud 官方文档，逐项验证设计文档（01-05）中的技术假设。每个发现标注为：
> - **MISMATCH** = 设计与 UniCloud 实际能力不符，必须修正
> - **WARNING** = 设计可行但有风险或非最佳实践，建议调整
> - **CONFIRMED** = 设计与 UniCloud 文档一致，无需修改

> **更新说明（2026-03-22）：** 以下 MISMATCH #1-#5 已在设计文档中修正完毕。本文保留原始描述供参考。

---

## 1. 数据类型（bsonType）

### 1.1 MISMATCH: `deleted_at`、`created_at`、`updated_at` 的类型声明不一致

**设计文档说的：** 在 01-overview-and-data-model.md 中，`deleted_at` 声明为 `"Date | null"`，`created_at` 和 `updated_at` 声明为 `"Date"`。但日期存储约定中写道"所有业务日期和系统时间戳统一使用 timestamp 毫秒数（Number 类型）存储"。

**UniCloud 实际支持：** DB Schema 支持的 bsonType 包括 `timestamp`（毫秒数 Number）和 `date`（JavaScript Date 对象）两种。UniCloud 推荐使用 `forceDefaultValue: {"$env": "now"}` 自动生成时间戳，此功能返回的是**毫秒级 timestamp（Number）**，不是 Date 对象。

**问题：** 设计中存在自相矛盾——约定说用 timestamp 毫秒数，但字段类型写的是 `Date`。按照 UniCloud 的 `$env: now` 机制，返回的是 Number 类型的毫秒时间戳。

**修正建议：**
- `created_at` 和 `updated_at` 的 bsonType 应为 `"timestamp"`（即 Number 毫秒数），配合 `forceDefaultValue: {"$env": "now"}`
- `deleted_at` 的 bsonType 应为 `"timestamp"`，默认值为 null
- 统一所有文档中的类型声明，消除 `"Date"` 和 `"Number"` 的混用

### 1.2 MISMATCH: details 内部子字段的日期类型

**设计文档说的：** breeding_records 的 details 中多处使用 `"Date"` 类型，例如 `details.start_date`、`details.end_date`、`details.expected_checkup_date`、`details.expected_due_date`，以及 health_records 中的 `details.next_reminder_date`、`details.start_date`、`details.end_date`。

**问题：** 既然约定统一使用 timestamp 毫秒数，这些 details 内的日期字段也应声明为 Number（timestamp），而非 Date。

**修正建议：** 将所有 `details` 内的日期字段统一改为 `"Number"`（timestamp 毫秒数），与顶层约定一致。

### 1.3 WARNING: expenses.date 声明为 String

**设计文档说的：** 在 01-overview-and-data-model.md 的 expenses 集合中，`date` 字段声明为 `"String"` 并注释为 `// YYYY-MM-DD 格式`。但在 02-financial-and-sales.md 中同一字段却写的是 `timestamp 毫秒数，默认今天`。

**问题：** 两份文档对 expenses.date 的类型定义矛盾。

**修正建议：** 统一为 timestamp 毫秒数（Number），与全局约定一致。如需按日期分组统计，可使用聚合管道中的 `dateToString` 转换。

### 1.4 CONFIRMED: timestamp 毫秒数方案

**设计文档说的：** 所有业务日期使用 timestamp 毫秒数（Number）存储。

**UniCloud 实际支持：** DB Schema 的 bsonType `"timestamp"` 就是毫秒级数字。`$env: now` 返回的也是毫秒时间戳。JQL 中可以用 `new Date().getTime()` 进行比较，聚合中可以用 `dateToString` + `add(new Date(0), field)` 转换为可读日期。

**结论：** 方案合理，与 UniCloud 最佳实践一致。

---

## 2. JQL 联表查询与 foreignKey

### 2.1 CONFIRMED: foreignKey 声明方式正确

**设计文档说的：** Schema 中声明 foreignKey 用于 JQL 联表查询，不做数据库层面的外键约束。

**UniCloud 实际支持：** foreignKey 在 DB Schema 中通过 `"foreignKey": "tableName._id"` 声明，仅用于 JQL 联表查询时的自动关联，不是数据库级约束。这与设计完全一致。

### 2.2 WARNING: JQL 联表查询每次只能有一个 foreignKey 生效

**设计文档说的：** 多个集合有多个 foreignKey（如 breeding_records 有 cycle_id、dog_id、family_id 三个外键）。

**UniCloud 实际限制：** JQL 文档明确说明 "only one active per query"——每次联表查询只能激活一个外键关联。如果需要同时关联多个表，需要使用 getTemp 临时表方式。

**影响：** 设计中依赖冗余字段（dam_name、sire_name 等）来避免 JOIN 是**正确的策略**。但在需要联表查询的场景中，注意每次只能 JOIN 一个表。

### 2.3 CONFIRMED: getTemp 临时表联表查询

**UniCloud 实际支持：** 推荐使用 getTemp 临时表方式进行联表查询，可以先在子表上做过滤再 JOIN，性能更好。设计中的冗余字段策略可以减少联表需求，这是合理的。

### 2.4 WARNING: JQL 查询结果最大 1000 条

**UniCloud 实际限制：** JQL 查询默认 limit 为 100，最大为 1000。

**影响：** 在犬只数量 30-50 只的场景下不会触及此限制，但如果 tasks 集合或 expenses 集合数据量增长，需要注意分页。设计中已提到分页策略（首屏 10 条，滚动加载），这是正确的。

---

## 3. 聚合管道（Aggregation Pipeline）

### 3.1 CONFIRMED: 聚合管道支持财务计算需求

**设计文档说的：** 所有统计数据通过 MongoDB 聚合管道实时计算。

**UniCloud 实际支持：** 支持完整的聚合管道阶段：match、group、sort、project、lookup、unwind、limit、skip、addFields、replaceRoot、bucket、count 等。支持的累加操作符包括 $sum、$avg、$min、$max、$first、$last、$push、$addToSet 等。

**结论：** 单窝利润、种母 ROI、月度/年度总账的计算需求完全可以通过聚合管道实现。

### 3.2 WARNING: group 阶段有 100MB 内存限制

**UniCloud 实际限制：** 聚合管道的 group 阶段有 100MB 内存使用限制。

**影响：** 在 30-50 只犬的规模下不会触及此限制。但如果未来数据量大幅增长（数年的费用记录累积），年度统计查询可能需要注意。建议在聚合管道中尽早使用 match 阶段过滤数据。

### 3.3 WARNING: 聚合管道与 clientDB 的关系

**UniCloud 实际限制：** clientDB 文档中没有明确提到聚合支持。JQL 提供了简化的 `groupBy` + `groupField` 语法（支持 count、sum、avg、min、max），但完整的聚合管道需要在云函数/云对象中使用。

**影响：** 设计中将财务统计放在云对象中（`策略：财务统计 → 云对象`）是正确的。JQL 的 groupBy 语法可以处理简单统计，但跨集合的复杂聚合必须走云对象。

---

## 4. 云对象（Cloud Objects）

### 4.1 MISMATCH: 云对象中的事务支持

**设计文档说的：** 05-tech-stack.md 将录入繁育记录、生产记录、销售状态流转等操作分配给云对象，这些操作涉及多集合写入（如创建 BreedingCycle + 生成 Task + 创建 Expense）。

**UniCloud 实际支持：** 事务支持（`runTransaction` / `startTransaction`）在**云函数数据库 API 文档**中有记载，但**云对象文档中没有提及事务**。事务需要通过 `db.startTransaction()` 或 `db.runTransaction()` 调用。

**关键限制：**
- 事务内只能进行**单记录操作**（不能用 where 批量更新，只能用 doc 指定单条）
- 事务必须在 **10 秒内**完成
- 不能在事务中进行批量 add（只能单条）

**影响：** 云对象可以使用数据库事务（因为云对象本质是云函数的封装），但需要注意单记录限制。例如生产记录中"批量创建幼崽"不能在一个事务中用数组 add，需要逐条创建。

**修正建议：**
- 在设计文档中明确标注哪些操作需要事务保护
- 对于"创建 Litter + 批量创建幼崽 + 生成 Task"这类操作，需要在事务中逐条 add
- 考虑到 10 秒限制，批量操作（如 12 只成犬批量驱虫）可能需要分批处理而非一个事务

### 4.2 CONFIRMED: 云对象方法间不能互调

**UniCloud 实际限制：** "一个云对象导出的不同方法之间不能互相调用"。

**影响：** 如果多个云对象方法需要共享逻辑（如任务生成），需要将共享代码提取到 module.exports 之外的函数中。设计文档未提及此点，实现时需注意。

### 4.3 CONFIRMED: _before / _after 拦截器

**UniCloud 实际支持：** 云对象支持 `_before` 和 `_after` 拦截器，可用于统一的权限验证和日志记录。设计中未明确提及使用拦截器，但建议在实现时利用此功能做权限校验。

### 4.4 WARNING: 云对象参数大小限制

**UniCloud 实际限制：**
- 支付宝云：6MB
- 阿里云：2MB
- 腾讯云：5MB

**影响：** 设计选用支付宝云（6MB），批量体重录入、批量驱虫等操作的参数不会超限。但如果传递大量图片数据（B 超图片），应确保使用云存储 fileID 而非 base64 数据。

---

## 5. 权限系统（DB Schema Permissions）

### 5.1 CONFIRMED: 三级角色模型可通过 uni-id RBAC 实现

**设计文档说的：** 创建者 / 管理员 / 协助者三级角色。

**UniCloud 实际支持：** uni-id 实现了标准 RBAC 模型：
- `uni-id-roles` 表存储角色（role_id, permission 数组）
- `uni-id-permissions` 表存储权限
- 用户 role 字段为数组，可同时拥有多个角色
- DB Schema 权限表达式支持 `'role_id' in auth.role` 和 `'perm_id' in auth.permission`

**结论：** 可以创建 `creator`、`admin`、`helper` 三个自定义角色，并在 DB Schema 中配置相应权限。

### 5.2 WARNING: 权限表达式中 family_id 数据隔离的实现

**设计文档说的：** 所有集合都有 `family_id` 字段用于数据隔离。

**UniCloud 权限表达式可用变量：** `auth.uid`、`auth.role`、`auth.permission`、`doc`（当前文档）、`now`。

**问题：** 权限表达式无法直接获取"当前用户属于哪个 family"。要实现 family_id 数据隔离，权限表达式需要使用 `get()` 跨表查询：

```
"read": "get(`database.families.${doc.family_id}`).members.user_id == auth.uid"
```

但这种写法有两个限制：
1. `get()` 查询的是整个文档，检查嵌入数组中的元素是否匹配 auth.uid **语法上较复杂**
2. 每次权限校验都需要额外查询 families 表，有性能开销

**修正建议：**
- 方案A：在用户文档（uni-id-users）上缓存 `family_id` 字段，然后权限表达式用 `get('database.uni-id-users.${auth.uid}').family_id == doc.family_id`
- 方案B：将 family_id 数据隔离逻辑放在云对象的 `_before` 拦截器中统一处理，clientDB 查询时也通过云对象中转
- 方案C（推荐）：对于 clientDB 直查的简单场景，前端查询时始终带上 `where('family_id == $currentUserFamilyId')`，配合 Schema 权限做兜底

### 5.3 CONFIRMED: admin 角色自动绕过权限

**UniCloud 实际支持：** 拥有 `admin` 角色的用户自动绕过所有 DB Schema 权限校验。

**影响：** 设计中的"创建者"角色如果赋予 `admin` 角色，将自动获得全部权限。但需注意 `admin` 是 uni-id 的内置超级角色，绕过所有权限——包括字段级 write 限制。如果不希望创建者能修改某些系统字段，不要使用 `admin` 角色，而是创建自定义的 `creator` 角色。

### 5.4 WARNING: 协助者权限的精细控制

**设计文档说的：** 协助者不能查看/操作财务数据、销售管理、繁育记录等。

**UniCloud 实际支持：** DB Schema 权限可以基于角色控制 read/create/update/delete，例如：

```json
"permission": {
  "read": "'admin' in auth.role || 'creator' in auth.role",
  "create": "'admin' in auth.role || 'creator' in auth.role"
}
```

**可行性：** 完全可以实现。在 expenses、incomes、sale_records 等集合的 Schema 中限制 read 权限为管理员角色，协助者将无法通过 clientDB 读取这些数据。

但如果协助者需要通过云对象间接触发财务相关操作（如标记任务完成时自动创建费用记录），云对象中的数据库操作不受 clientDB Schema 权限约束。

---

## 6. clientDB 使用边界

### 6.1 CONFIRMED: clientDB vs 云对象的分工合理

**设计文档说的：** 简单 CRUD 走 clientDB，复杂业务逻辑走云对象。

**UniCloud 实际支持的 clientDB 操作：** 读取、创建、更新、删除，受 DB Schema 权限控制。

**clientDB 不支持的操作：**
- `set()` 方法
- `db.command.inc()` 等更新操作符
- `{'a.b.c': 1}` 点号嵌套更新语法（必须用完整嵌套对象）
- 事务
- 完整聚合管道（只支持简化的 groupBy/groupField）

**结论：** 设计中的分工完全合理。需要注意的是 clientDB 不支持 `inc()` 操作符，所以即使是简单的计数器更新也需要走云对象或在前端读取后写入。

### 6.2 WARNING: clientDB 的嵌套更新限制

**UniCloud 实际限制：** clientDB 不能使用 `{'a.b.c': 1}` 格式更新嵌套字段，必须用 `{a:{b:{c:1}}}` 完整嵌套对象。

**影响：** families 集合中嵌入的 `members` 数组和 `care_rules` 数组，在 clientDB 中更新特定元素会比较麻烦。建议将 families 的 members/care_rules 修改操作放在云对象中处理。

---

## 7. uni-id 认证系统

### 7.1 CONFIRMED: 邀请机制可实现

**设计文档说的：** 创建者/管理员生成邀请链接，被邀请人点击注册加入。

**UniCloud 实际支持：**
- uni-id 内置邀请码系统：`autoSetInviteCode: true` 自动生成 6 位邀请码
- `forceInviteCode: true` 可强制注册时必须填写邀请码
- 用户文档自动记录 `my_invite_code` 和 `inviter_uid`

**注意：** uni-id 的邀请码系统是针对**用户裂变增长**设计的（记录上下级关系），不是针对"加入家庭"设计的。"邀请加入家庭"需要自定义实现：
1. 生成包含 family_id 的邀请链接/码
2. 注册后通过云对象将用户添加到 families.members 数组
3. 设置用户的角色

**修正建议：** 不要直接使用 uni-id 的邀请码功能来实现"邀请加入家庭"，而是自定义邀请逻辑。uni-id 的邀请码可以作为补充（用于用户增长追踪），但家庭邀请需要单独实现。

### 7.2 CONFIRMED: Token 管理自动化

**UniCloud 实际支持：**
- Token 自动存储为 `uni_id_token`
- 自动随请求发送
- 支持自动续期（配置 `tokenExpiresThreshold`）
- 云对象通过 `this.getUniIdToken()` 获取

**结论：** 与设计中使用 uni-id 的方案一致。

### 7.3 WARNING: 多应用隔离（dcloud_appid）

**UniCloud 实际支持：** uni-id 支持通过 `dcloud_appid` 数组控制用户可访问的应用。

**影响：** 当前设计只涉及一个应用（犬类繁育管理），无需此功能。但如果未来拆分为"管理员端"和"协助者端"，可以利用此机制。

---

## 8. 云存储

### 8.1 CONFIRMED: 文件上传模式正确

**设计文档说的：** 使用 UniCloud 云存储，图片压缩后上传，CDN 加速。

**UniCloud 实际支持：**
- `uniCloud.uploadFile()` 支持客户端直传（推荐，减少带宽成本）
- 单文件上限 5GB
- 支付宝云支持文件夹级别权限控制
- 返回 fileID 用于后续访问

### 8.2 WARNING: 支付宝云的文件 URL 格式

**UniCloud 实际情况：** 腾讯云/支付宝云返回 `cloud://` 格式的 fileID，需要通过 `getTempFileURL()` 转换为可访问的 HTTP URL。阿里云直接返回 HTTP URL。

**影响：** 设计选用支付宝云，存储在数据库中的 fileID（如 expenses.images、pregnancy_check.images）需要在显示前调用 `getTempFileURL()` 转换。建议在前端封装统一的图片展示组件处理此逻辑。

### 8.3 WARNING: 文件删除安全

**UniCloud 实际建议：** "文件删除是高风险操作，应通过云函数并做权限验证，而非客户端直接删除。"

**修正建议：** 图片删除操作应通过云对象处理，不要让客户端直接调用 deleteFile。

---

## 9. 推送通知（UniPush 2.0）

### 9.1 WARNING: UniPush 不直接支持定时推送

**设计文档说的：** 每日定时推送晨间摘要（默认早上 7:00）。

**UniCloud 实际支持：** UniPush 2.0 文档中**没有提及定时/计划推送功能**。UniPush 只提供即时推送 API。

**修正建议：** 晨间摘要推送需要通过**定时云函数 + UniPush API** 组合实现：
1. 创建定时云函数，配置 cron 表达式为每日 7:00（如 `0 0 7 * * *`）
2. 云函数中查询每个用户的当日待办
3. 调用 UniPush API 逐一推送

这是标准做法，完全可行。

### 9.2 WARNING: 角色过滤推送需要自定义逻辑

**设计文档说的：** 管理员收到所有推送，协助者只收到日常护理类推送。

**UniCloud 实际支持：** UniPush 支持按 user_id 定向推送（通过 uni-id 集成），但**不直接支持按角色过滤**。

**修正建议：** 在定时云函数中实现推送过滤逻辑：
1. 查询 families.members 获取所有成员及其角色
2. 根据角色决定推送内容：管理员推送全部，协助者只推日常护理类
3. 分别调用 UniPush API 推送

### 9.3 CONFIRMED: uni-id 集成的设备管理

**UniCloud 实际支持：** uni-id-pages 自动管理 user_id 与 push_clientid 的映射关系（登录/登出/切换/续期/注销 5 个时机自动同步），依赖 `uni-id-device` 和 `opendb-device` 表。

---

## 10. 数据库触发器

### 10.1 MISMATCH: 设计未利用 schema.ext.js 数据库触发器

**设计文档说的：** 任务生成通过云对象同步创建，未提及数据库触发器。

**UniCloud 实际支持：** UniCloud 提供 `schema.ext.js` 数据库触发器机制（JQL 触发器），支持以下事件：
- beforeCreate / afterCreate
- beforeUpdate / afterUpdate
- beforeDelete / afterDelete
- beforeRead / afterRead

**关键限制：** 触发器**只对 JQL 操作生效**，传统 MongoDB API 不触发。

**建议：** 虽然设计中将复杂操作放在云对象中是正确的（因为云对象中的传统 DB 操作不触发 schema.ext.js），但以下场景可以考虑使用触发器：

| 场景 | 当前设计 | 可用触发器优化 |
|------|---------|---------------|
| `created_at` / `updated_at` 自动填充 | 未明确 | `beforeCreate` 和 `beforeUpdate` 自动写入时间戳 |
| clientDB 简单编辑时的数据同步 | 未处理 | `afterUpdate` 在犬只改名时触发冗余字段更新 |
| 软删除的 `deleted_at` 审计 | 未处理 | `beforeUpdate` 校验软删除操作的权限 |

**但要注意：** 云对象中如果使用传统 `db.collection().doc().update()` 而非 JQL 的 `dbJQL.collection().doc().update()`，触发器不会执行。如果想在云对象中也触发 schema.ext.js，必须使用 `uniCloud.databaseForJQL()` 而非 `uniCloud.database()`。

### 10.2 CONFIRMED: 定时云函数支持每日巡检

**设计文档说的：** 每日凌晨巡检定时云函数扫描并补生成任务。

**UniCloud 实际支持：** 定时触发器支持 cron 表达式，支付宝云最小间隔 1 秒，超时限制 3 小时。完全可以实现每日巡检逻辑。

---

## 11. 索引设计

### 11.1 CONFIRMED: 复合索引支持

**UniCloud 实际支持：** 支持复合索引、唯一索引、稀疏索引。索引通过 uniCloud Web 控制台或 `db_init.json` 文件配置，不在 DB Schema 中定义。

**设计文档中的索引设计（如 `tasks: { family_id: 1, status: 1, due_date: 1 }`）格式正确。**

### 11.2 WARNING: 索引不在 Schema 中定义

**设计文档暗示的：** 索引设计列在了 05-tech-stack.md 中。

**UniCloud 实际情况：** 索引需要在 Web 控制台手动创建，或通过 `db_init.json` 初始化。Schema JSON 文件不支持索引定义。

**建议：** 在项目中创建 `db_init.json` 文件来管理索引定义，确保开发/测试/生产环境一致。

---

## 12. 软删除

### 12.1 WARNING: UniCloud 无内置软删除支持

**设计文档说的：** 所有集合统一添加 `deleted_at`（默认 null）实现软删除，查询时默认过滤 `deleted_at == null`。

**UniCloud 实际情况：** DB Schema 没有内置的软删除机制。需要手动实现：
1. 每个查询都需要手动添加 `where('deleted_at == null')` 条件
2. "删除"操作实际执行 update 而非 delete
3. Schema 的 `delete` 权限不适用于软删除（因为是 update 操作）

**修正建议：**
- 在 DB Schema 的 `delete` 权限设为 `false`（禁止真删除）
- 软删除通过 `update` 权限控制
- 前端 clientDB 查询时统一封装 `where` 条件
- 云对象中统一封装软删除和查询过滤逻辑
- 考虑使用 schema.ext.js 的 `beforeRead` 触发器自动注入 `deleted_at == null` 条件（但只对 JQL 查询生效）

---

## 13. 集合数量与文档大小限制

### 13.1 CONFIRMED: 14 个集合无问题

**UniCloud 实际支持：** 一个数据库可以包含多个集合，文档中未提及集合数量上限。14 个业务集合 + uni-id 自带集合完全在合理范围内。

### 13.2 WARNING: 文档大小限制未明确

**UniCloud 文档中未明确记载单个文档大小限制。** MongoDB 标准限制为 16MB/文档。

**影响：** families 集合中嵌入的 members 数组（最多 5-10 人）和 care_rules 数组（最多 10 条）不会超限。但如果 care_rules 未来大幅增长，需注意。

---

## 14. 其他发现

### 14.1 WARNING: 离线支持的冲突处理

**设计文档说的：** 本地优先写入 + 后台队列同步，冲突策略 Last Write Wins。

**UniCloud 实际情况：** UniCloud 不提供内置的离线同步机制。`Last Write Wins` 策略需要完全自定义实现。

**风险：** 多用户协作场景（管理员 + 协助者同时操作）下，LWW 可能导致数据丢失。例如两人同时标记不同任务完成，如果操作缓存在本地后同步，可能互相覆盖。

**建议：** V1 阶段可以简化为"无网络时提示用户，恢复后重试"，而非实现完整离线队列。真正需要离线支持时再评估方案。

### 14.2 WARNING: JQL 不支持两个数据库字段之间的比较

**UniCloud 实际限制：** JQL 的简单条件中不支持两个字段的比较（如 `where('field1 > field2')`）。

**影响：** 设计中"到手价 < 底价时标红提示"需要在前端或云对象中比较，不能通过 JQL 查询直接筛选。在当前设计中这不是问题（前端展示时比较即可），但如果需要查询"所有低于底价的销售记录"，需要使用聚合管道。

### 14.3 MISMATCH: 首页查询示例语法错误

**设计文档说的：** `db.tasks.find({ family_id, status: 'pending', due_date: { $lte: endOfWeek }, deleted_at: null }).sort({ due_date: 1 })`

**UniCloud 实际语法：** UniCloud 不支持标准 MongoDB 的 `find()` 语法。应使用：

```javascript
// clientDB JQL 方式
db.collection('tasks')
  .where(`family_id=="${familyId}" && status=="pending" && due_date<=${endOfWeek} && deleted_at==null`)
  .orderBy('due_date asc')
  .get()
```

或在云对象中：

```javascript
// 传统方式
db.collection('tasks')
  .where({
    family_id: familyId,
    status: 'pending',
    due_date: db.command.lte(endOfWeek),
    deleted_at: null
  })
  .orderBy('due_date', 'asc')
  .get()
```

### 14.4 CONFIRMED: `forceDefaultValue` 适用于 created_at / created_by

**UniCloud 实际支持：**
- `forceDefaultValue: {"$env": "now"}` → 自动填充服务器时间戳
- `forceDefaultValue: {"$env": "uid"}` → 自动填充当前用户 ID
- `forceDefaultValue: {"$env": "clientIP"}` → 自动填充客户端 IP

这些在 clientDB 操作时自动生效，客户端无法覆盖。但注意：**`updated_at` 的自动更新需要通过 schema.ext.js 的 `beforeUpdate` 触发器实现**，`forceDefaultValue` 只在创建时生效。

### 14.5 WARNING: Schema 的 fieldRules 可简化部分校验

**UniCloud 实际支持：** `fieldRules` 支持跨字段校验规则，例如：

```json
"fieldRules": [{
  "rule": "end_date == null || create_date < end_date",
  "errorMessage": "结束时间必须晚于创建时间"
}]
```

**建议：** 设计中部分由云对象负责的校验可以通过 fieldRules 在 Schema 层面实现，例如：
- expenses 的三个关联字段互斥校验
- sale_records 状态流转的合法性校验

---

## 总结

### 必须修正的问题（MISMATCH）

| # | 问题 | 影响范围 | 修正方向 |
|---|------|---------|---------|
| 1 | `deleted_at`/`created_at`/`updated_at` 类型声明为 `Date` 而非 `timestamp` | 所有集合 | 统一为 bsonType `"timestamp"`（Number 毫秒数） |
| 2 | details 内日期字段声明为 `Date` | breeding_records, health_records | 统一为 Number（timestamp 毫秒数） |
| 3 | expenses.date 两处文档矛盾（String vs Number） | expenses 集合 | 统一为 Number（timestamp 毫秒数） |
| 4 | 首页查询示例使用标准 MongoDB 语法 | 文档示例 | 改为 JQL 或 UniCloud DB API 语法 |
| 5 | 未考虑事务的单记录限制 | 云对象中的批量操作 | 标注哪些操作需要逐条执行 |

### 需要关注的风险（WARNING）

| # | 风险 | 建议 |
|---|------|------|
| 1 | JQL 每次只能 JOIN 一个外键 | 继续保持冗余字段策略，必要时用 getTemp |
| 2 | family_id 数据隔离在 Schema 权限中实现较复杂 | 在 uni-id-users 上缓存 family_id，或通过云对象统一处理 |
| 3 | uni-id 邀请码不等于"邀请加入家庭" | 需自定义家庭邀请逻辑 |
| 4 | 支付宝云 fileID 需要 getTempFileURL 转换 | 前端封装统一图片组件 |
| 5 | UniPush 不支持定时推送 | 定时云函数 + UniPush API 组合实现 |
| 6 | 离线 LWW 策略有数据丢失风险 | V1 先做简单的网络检测提示 |
| 7 | clientDB 不支持 inc() 等更新操作符 | 计数器更新走云对象 |
| 8 | updated_at 自动更新需要 schema.ext.js | 实现 beforeUpdate 触发器 |
| 9 | 云对象方法间不能互调 | 共享逻辑提取到 module.exports 外部 |
| 10 | 聚合 group 阶段 100MB 内存限制 | 聚合前尽早 match 过滤 |
| 11 | schema.ext.js 只对 JQL 操作生效 | 云对象中需要触发器时使用 databaseForJQL() |
