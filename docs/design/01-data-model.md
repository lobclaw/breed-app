# 犬类繁育管理应用 — 概述与数据模型

## 一、产品概述

### 核心定位

一个犬类繁育管理工具，首先解决创建者自身的管理痛点。当前管理 30-50 只马尔济斯犬，使用外部种公借配，有家人协助日常喂养和清洁。

### 核心痛点（优先级）

1. 配种/孕期/预产期时间节点管理混乱
2. 疫苗/驱虫提醒遗漏
3. 成本利润核算不清

### V1 范围（路径A，分阶段开发）

- **第一批：** 犬只档案 + 繁育流程 + 基础提醒
- **第二批：** 财务模块 + 销售流程
- **第三批：** 首页智能卡片 + 自动化逻辑
- **第四批：** 协作 + 用药方案库 + 代理人管理 + 批量体重

### 明确不做的（V1）

会员体系、广告、增值服务、微信小程序、普通养宠用户模式、素材台账/成长相册、洗护记录、AI 助手、电子合同、血统关系图、多宠物家庭管理

### 平台

iOS + Android（跨平台开发）

### 数据模型预留

`species` 字段预留猫品类支持，后续加猫几乎零成本。

---

## 二、数据模型

> **存储说明：** 使用 MongoDB（UniCloud）。Schema 中的 foreignKey 声明仅用于 JQL 联表查询，不做数据库层面的外键约束。支持软删除的集合添加 `deleted_at`（默认 null）实现软删除（见下方软删除范围矩阵）。
>
> **软删除说明：** 软删除（设置 deleted_at）仅用于**用户误操作的撤销场景**（30 天回收站）。正常的 disposition 变更（已故/已售/已领养/已赠送/已退休）不触发软删除，而是通过 disposition 字段管理。犬只软删除时，其关联记录（breeding_records、health_records、dog_weights、tasks 等）不级联软删除，保持原样。恢复犬只时数据自然完整。

> **软删除范围矩阵：**
>
> | 集合 | 支持软删除 | 级联删除 | 查询默认过滤 | 报表中可见 |
> |------|-----------|---------|-------------|-----------|
> | dogs | 是 | 否 | 是 | 否（回收站可见） |
> | breeding_cycles | 否 | — | — | 是（历史记录） |
> | breeding_records | 否 | — | — | 是 |
> | litters | 否 | — | — | 是 |
> | health_records | 否 | — | — | 是 |
> | medication_tasks | 否 | — | — | 是 |
> | dog_weights | 否 | — | — | 是 |
> | tasks | 否 | — | — | 是 |
> | expenses | 是 | 否 | 是 | 否（回收站可见） |
> | incomes | 是 | 否 | 是 | 否（回收站可见） |
> | sale_records | 是 | 否 | 是 | 否（回收站可见） |
> | agents | 是 | 否 | 是 | 否 |
> | families | 否 | — | — | — |
> | medication_protocols | 是 | 否 | 是 | 否 |
>
> **恢复策略：** 恢复犬只时，由于关联记录未级联删除，数据自然完整。恢复费用/收入/销售记录时，只恢复该条记录本身。

> **日期存储约定：** 所有业务日期（出生日期、配种日期、疫苗日期等）和系统时间戳（created_at、updated_at，以及支持软删除的集合的 deleted_at）统一使用 timestamp 毫秒数（Number 类型）存储。显示时由前端转换为 YYYY-MM-DD 格式。时区统一使用北京时间（UTC+8）。

### 2.1 犬只档案（dogs 集合）

#### 核心字段

```json
{
  "_id": "ObjectId",
  "name": "String",              // 昵称，选填——新生幼崽可以没名字，系统自动生成默认编号如「花花3窝-1号」
  "gender": "String",            // 公/母
  "role": "String",              // 种狗/幼崽/外部种公
  "disposition": "String",       // 在养/待售/已预定/已售/已领养/已赠送/自留/已退休/已故
  "species": "String",           // 犬/猫（预留）
  "breed": "String",             // 品种
  "birth_date": "Number",          // timestamp 毫秒数
  "purchase_date": "Number",       // 选填，timestamp 毫秒数
  "purchase_price": "Number",    // 选填，同步财务模块。有值时 createDog 自动创建 expense 记录（category=购入）
  "latest_weight": "Number",     // 缓存字段，单位：克（g），从体重记录同步最新值
  "family_id": "String",         // foreignKey → families
  "origin_litter_id": "String",  // 选填，幼崽创建时自动填入所属窝 ID，升级为种狗后继续保留。foreignKey → litters
  "owner_info": "String",       // 选填，外部种公的主人信息（姓名/犬舍名）
  "disposition_date": "Number",   // 选填，timestamp 毫秒数。disposition 变为已故/已领养/已赠送/已退休时填入
  "disposition_notes": "String",  // 选填，备注（死因/领养说明/退休原因等自由填写）
  "deleted_at": "Number | null",    // timestamp 毫秒数，默认 null
  "created_at": "Number",          // timestamp 毫秒数，forceDefaultValue: $env.now
  "updated_at": "Number"           // timestamp 毫秒数
}
```

#### 自动派生状态（不存储，实时计算）

发情中 / 怀孕中 / 哺乳中 / 生病中 / 用药中 / 正常

#### 双字段身份模型

两个字段组合确定犬只身份：

- **role（角色）** = 这只犬在你的经营中扮演什么角色
- **disposition（处置/去向）** = 这只犬当前的状态

组合示例：

| role | disposition | 含义 |
|------|------------|------|
| 幼崽 | 在养 | 正在养的幼崽 |
| 幼崽 | 待售 | 准备卖的幼崽 |
| 幼崽 | 已售 | 已卖出的幼崽 |
| 幼崽 | 已领养 | 被领养的幼崽 |
| 幼崽 | 已赠送 | 赠送的幼崽 |
| 幼崽 | 自留 | 留下来养的幼崽 |
| 种狗 | 在养 | 正在繁育的种狗 |
| 种狗 | 已退休 | 退休不繁育了 |
| 种狗 | 已领养 | 退休后被领养 |
| 种狗 | 已赠送 | 退休后赠送 |
| 种狗 | 已故 | 去世了 |
| 外部种公 | 在养 | 还在合作的外部种公 |

#### 外部种公说明

- 和普通犬只在同一个 dogs 集合中，通过 `role=外部种公` 区分
- 字段较少（name, breed, gender 锁定为公, owner_info 选填）
- 不参与健康管理、财务统计
- 仅用于配种关联
- 有 `family_id` 做数据隔离

#### 幼崽升级为种狗

- `role`: 幼崽 → 种狗
- `origin_litter_id` 保留（记录她来自哪一窝）
- 所有历史记录（体重、疫苗、健康）通过 `dog_id` 天然继承
- `disposition`: 自留 → 在养

#### 已退休犬只

- disposition 变为已退休时，填入 `disposition_date`（退休日期）和 `disposition_notes`（退休原因等备注）
- 不再出现在繁育流程中（配种选择列表不显示）
- 仍在健康管理范围内（疫苗、驱虫提醒继续）
- 退出所有繁育相关护理群组
- 可逆：可取消退休状态（清除 `disposition_date` 和 `disposition_notes`）
- 可进入领养/赠送流程（简单记录，不走销售三阶段）

#### 已故犬只

- disposition 变为已故时，填入 `disposition_date`（死亡日期）和 `disposition_notes`（死因等备注），夭折也使用已故状态，在 `disposition_notes` 中注明「夭折」
- 档案保留但标记为已故，默认列表隐藏，可筛选查看
- 财务历史数据保留，继续计入统计
- 所有未完成提醒自动取消
- 怀孕母犬死亡 → 关联繁育记录标记为异常终止
- 幼崽夭折 → 窝中该幼崽标记为夭折，存活数自动更新

#### 领养记录（退休犬/幼崽）

disposition 变为已领养时，填入 `disposition_date`（领养日期）和 `disposition_notes`（领养说明等备注）。领养费如有则直接在 Income（收入）表中录入。

不走 `SaleRecord` 的三阶段流程。

#### 已赠送

disposition 变为已赠送时，填入 `disposition_date`（赠送日期）和 `disposition_notes`（受赠人信息等备注）。

---

### 2.2 繁育周期（breeding_cycles 集合）

```json
{
  "_id": "ObjectId",
  "dam_id": "String",           // foreignKey → dogs（种母）
  "dam_name": "String",         // 冗余字段，避免查询时 JOIN
  "sire_id": "String",          // foreignKey → dogs（可以是外部种公）
  "sire_name": "String",        // 冗余字段，避免查询时 JOIN
  "family_id": "String",         // foreignKey → families（数据隔离）
  // cycle_number 动态计算，不存储——按 dam_id 的历史周期按日期排序的序号
  "status": "String",           // 发情中 / 怀孕中 / 已生产 / 失败 / 放弃
  "created_at": "Number",          // timestamp 毫秒数，forceDefaultValue: $env.now
  "updated_at": "Number"           // timestamp 毫秒数
}
```

#### 创建时机

录入以下任何事件时，如果该犬当前没有进行中的周期，自动创建：

- 发情记录
- 卵泡检查
- 配种记录

#### 状态流转

```
创建 → 发情中
  ├→ 配种 → 怀孕中（配种后直接进入怀孕中，不存在中间态。孕检为可选操作，不影响状态。）
  │     ├→ 生产 → 已生产
  │     └→ 确认未怀孕 / 流产 / 医疗终止 → 失败
  └→ 未配种（手动关闭或 21 天自动关闭）→ 放弃
```

#### 异常状态转换规则

当犬只 disposition 发生变更时，进行中的繁育周期需要处理：

| 犬只变更 | 周期状态 | 处理 |
|---------|---------|------|
| disposition → 已故 | 发情中/怀孕中 | 周期自动标记为「中断」，关联 tasks 全部取消 |
| disposition → 已退休 | 发情中 | 周期自动关闭为「放弃」，关联 tasks 取消 |
| disposition → 已退休 | 怀孕中 | **阻止退休操作**，提示「该犬当前怀孕中，请先完成生产或记录异常终止」|
| disposition → 已领养/已赠送 | 任何进行中 | **阻止操作**，提示「该犬有进行中的繁育周期」|

**发情自动关闭：**
- 条件：breeding_cycle.status = 发情中 且 创建时间超过 21 天 且 无配种记录
- 执行：每日审计定时函数（02:00 UTC+8）检查并关闭
- 动作：cycle.status → 放弃，发送推送通知「{犬名}发情期未配种，已自动关闭」

**终态定义：**
- 已生产、失败、放弃 均为终态，不可再转换
- 如需重新繁育，创建新的 breeding_cycle

---

### 2.3 窝（litters 集合）

```json
{
  "_id": "ObjectId",
  "cycle_id": "String",         // foreignKey → breeding_cycles（1:1 关系，一个成功的周期对应一窝）
  "dam_id": "String",           // 冗余字段，避免通过 cycle 二跳查询
  "dam_name": "String",         // 冗余字段
  "sire_id": "String",          // 冗余字段
  "sire_name": "String",        // 冗余字段
  "family_id": "String",         // foreignKey → families（数据隔离）
  "birth_date": "Number",          // timestamp 毫秒数
  "birth_type": "String",       // 顺产 / 难产 / 剖腹产
  "birth_notes": "String",      // 经验心得，选填
  "weaned_at": "Number | null",  // timestamp 毫秒数，确认断奶时填入，null=未断奶
  "created_by": "String",        // foreignKey → users
  "created_at": "Number",          // timestamp 毫秒数，forceDefaultValue: $env.now
  "updated_at": "Number"           // timestamp 毫秒数
}
```

#### 创建时机

录入生产记录时创建：

- 系统先创建 Litter → 再创建各幼崽档案（`litter_id` 指向该窝）
- 支持分次添加幼崽（生产可能持续数小时，不需要一次录完）
- 窝详情页保留「+ 添加幼崽」按钮

#### 窝编号（litter_number）

动态计算，按 `dam_id` 的历史 Litter 按 `birth_date` 排序的序号，不存储。

> **窝号边界处理：**
> - 窝号为动态计算值（按 dam_id 的历史 Litter 按 birth_date 排序），不存储
> - **出生日期编辑限制：** 窝创建后，birth_date 仅允许在同一周内微调（±3天），不允许跨月修改。跨月修改可能导致窝号变化，影响关联费用和历史记录的语义
> - **已软删除的窝不参与序号计算：** 查询时过滤 `deleted_at == null`
> - **UI 显示：** 列表和报表中同时显示窝号和出生日期（如「第3窝 · 2026-03-22」），避免单独依赖序号

---

### 2.4 繁育子记录（breeding_records 集合）

所有繁育子记录合并到一个 `breeding_records` 集合中，通过 `type` 字段区分记录类型。公共字段在顶层，类型特有字段放在 `details` 嵌套对象中。

#### 公共字段

```json
{
  "_id": "ObjectId",
  "type": "String",             // heat / follicle_check / mating / pregnancy_check / prenatal_check / pre_labor / birth / abnormal_termination
  "cycle_id": "String",         // foreignKey → breeding_cycles
  "dog_id": "String",           // foreignKey → dogs
  "family_id": "String",        // foreignKey → families（数据隔离）
  "date": "Number",              // timestamp 毫秒数
  "cost": "Number",             // 选填，有费用的记录 → 自动创建 Expense 记录
  "notes": "String",
  "details": "Object",          // 类型特有字段（见下方各类型说明）
  "created_by": "String",       // foreignKey → users
  "created_at": "Number",          // timestamp 毫秒数，forceDefaultValue: $env.now
  "updated_at": "Number"           // timestamp 毫秒数
}
```

#### 各类型 details 定义

**发情记录（type: "heat"）**

```json
{
  "details": {
    "start_date": "Number",          // timestamp 毫秒数
    "end_date": "Number",            // 选填，timestamp 毫秒数
    "end_reason": "String"        // 自然结束 / 已配种 / 手动关闭，选填
  }
}
```

**退出逻辑：**

- 配种 → `end_reason=已配种`
- 手动标记 → `手动关闭`
- 超过 21 天未操作 → 系统自动关闭（`end_reason=自然结束`），同步将 `BreedingCycle.status` 设为「放弃」

**卵泡检查（type: "follicle_check"）**

```json
{
  "details": {
    "left_count": "Number",       // 左侧卵泡数量
    "left_size": "Number",        // 左侧卵泡大小
    "right_count": "Number",      // 右侧卵泡数量
    "right_size": "Number",       // 右侧卵泡大小
    "result": "String"            // 发育良好 / 发育不良 / 其他
  }
}
```

**配种记录（type: "mating"）**

```json
{
  "details": {
    "sire_id": "String",                // foreignKey → dogs（外部种公）
    "method": "String",                  // 自然交配 / 人工授精
    "mating_number": "Number",           // 第几次配种，同一周期可多次，通常间隔 24-48h
    "expected_checkup_date": "Number",    // timestamp 毫秒数，默认 = date + 25，可手动修改
    "expected_due_date": "Number",       // timestamp 毫秒数，默认 = date + 63，可手动修改
    "is_due_date_manual": "Boolean"      // 标记预产期是否被手动覆盖，修改配种日期时如果未手动覆盖则自动重算
  }
}
```

**孕检（type: "pregnancy_check"）**

```json
{
  "details": {
    "confirmed": "String",        // 是 / 否
    "puppy_count": "Number",      // 确认几只，选填
    "images": ["String"]          // B超图片
  }
}
```

**产检（type: "prenatal_check"）**

```json
{
  "details": {
    "results": "String"
  }
}
```

**临产监测（type: "pre_labor"）**

```json
{
  "details": {
    "temperature": "Number",           // 选填
    "nesting_behavior": "Boolean",     // 是否刨窝
    "appetite_change": "String",       // 食欲变化，选填
    "other_signs": "String"            // 其他征兆，选填
  }
}
```

> 如果录入体温低于阈值（如 37.1°C），额外提醒「注意观察，可能 24 小时内生产」。

**生产记录（type: "birth"）**

```json
{
  "details": {
    "litter_id": "String",        // foreignKey → litters（生产时创建的窝）
    "birth_type": "String"        // 顺产 / 难产 / 剖腹产
  }
}
```

**异常终止妊娠（type: "abnormal_termination"）**

```json
{
  "details": {
    "termination_type": "String"  // 流产 / 死胎 / 医疗终止 / 确认未怀孕
  }
}
```

处理逻辑：

- 状态 → `BreedingCycle.status = 失败`
- 已产生的费用保留在该周期下
- 所有该周期的未完成提醒自动取消
- 孕期护理群组自动退出

> 所有卵泡检查、孕检、产检、临产监测、生产记录都是**可选的**。不做不影响流程推进。

---

### 2.5 健康记录（health_records 集合）

所有健康记录合并到一个 `health_records` 集合中，通过 `type` 字段区分记录类型。公共字段在顶层，类型特有字段放在 `details` 嵌套对象中。

#### 公共字段

```json
{
  "_id": "ObjectId",
  "type": "String",             // vaccination / deworming / illness
  "dog_id": "String",           // foreignKey → dogs
  "family_id": "String",        // foreignKey → families（数据隔离）
  "date": "Number",              // timestamp 毫秒数
  "cost": "Number",             // 选填 → 自动创建 Expense 记录
  "notes": "String",
  "created_by": "String",       // foreignKey → users
  "created_at": "Number",          // timestamp 毫秒数，forceDefaultValue: $env.now
  "updated_at": "Number"           // timestamp 毫秒数
}
```

#### 各类型 details 定义

**疫苗记录（type: "vaccination"）**

```json
{
  "details": {
    "vaccine_type": "String",          // 疫苗类型
    "next_reminder_date": "Number"      // timestamp 毫秒数，下次提醒日期，可配置间隔
  }
}
```

**驱虫记录（type: "deworming"）**

```json
{
  "details": {
    "deworming_type": "String",        // internal（内驱）/ external（外驱）/ combo（内外同驱）
    "drug_name": "String",             // 驱虫药品名
    "next_reminder_date": "Number"     // timestamp 毫秒数，下次提醒日期，可配置间隔
  }
}
```

**疾病记录（type: "illness"）**

```json
{
  "details": {
    "start_date": "Number",             // timestamp 毫秒数
    "end_date": "Number",               // 选填，timestamp 毫秒数，康复时填入
    "condition": "String",             // 病症：感冒/腹泻/皮肤病/犬瘟/细小等
    "severity": "String",              // 严重程度，选填
    "treatment_status": "String"       // 观察中 / 治疗中 / 已康复 / 慢性管理
  }
}
```

#### 用药任务（medication_tasks 集合）

```json
{
  "_id": "ObjectId",
  "dog_id": "String",           // foreignKey → dogs
  "family_id": "String",        // foreignKey → families
  "protocol_id": "String",      // 选填，从哪个方案生成的，foreignKey → medication_protocols
  "drug_name": "String",
  "dosage": "Number",           // 剂量
  "dosage_unit": "String",      // 单位：毫升/毫克/片
  "method": "String",           // 口服 / 注射
  "frequency": "Number",        // 每日X次
  "duration_days": "Number",    // 持续天数
  "actual_start_date": "Number",   // timestamp 毫秒数
  "status": "String",           // 进行中 / 已完成 / 已取消
  "notes": "String",            // 注意事项，如「两个头孢分早晚不能一起用」
  "created_at": "Number",          // timestamp 毫秒数，forceDefaultValue: $env.now
  "updated_at": "Number"           // timestamp 毫秒数
}
```

> `day_progress` = 当前日期 - `actual_start_date`（动态计算）

> **用药频率说明：**
> - `frequency` 字段含义为「每日给药次数」（Number），例如 1=每日1次, 2=每日2次, 3=每日3次
> - V1 阶段每日标记一次完成（不区分每次用药），首页卡片显示「第X天/共N天」进度
> - 如果 frequency > 1，卡片额外显示频率信息：「每日2次 · 口服」
> - 不引入 dosing_schedule（具体时间点），用户自行安排给药时间
> - 未来版本可扩展为每次独立标记 + 时间点提醒

#### 用药方案库（medication_protocols 集合）

```json
{
  "_id": "ObjectId",
  "family_id": "String",        // foreignKey → families
  "name": "String",             // 方案名称，如「幼犬感冒-细菌性」
  "target_condition": "String", // 适用病症
  "weight_range": "String",     // 适用体重范围，选填
  "drugs": [
    {
      "drug_name": "String",
      "dosage_per_kg": "Number",     // 按体重换算剂量
      "dosage_fixed": "Number",      // 固定剂量
      "dosage_unit": "String",
      "method": "String",
      "frequency": "Number"
    }
  ],
  "duration_days": "Number",    // 选填
  "notes": "String",            // 注意事项
  "deleted_at": "Number | null",    // timestamp 毫秒数，默认 null
  "created_at": "Number",          // timestamp 毫秒数，forceDefaultValue: $env.now
  "updated_at": "Number"           // timestamp 毫秒数
}
```

使用方式：

- 支持按体重自动换算剂量（需要犬只有体重数据）
- 一键应用：选方案 → 选犬只（可多选）→ 生成 MedicationTask
- 录入用药后可一键「保存为方案」
- 入口：用药记录录入时可选「从方案库选择」，或在设置中管理

---

### 2.6 体重记录（dog_weights 集合）

> **独立集合，不嵌入 dogs 文档。** 由于 UniCloud 按每 4KB 读取计费，频繁的体重记录嵌入会导致读取犬只档案时 RU 成本过高。

```json
{
  "_id": "ObjectId",
  "dog_id": "String",           // foreignKey → dogs
  "family_id": "String",        // foreignKey → families
  "weight": "Number",           // 统一存克（g），显示时超过 1000g 自动转为 kg
  "measured_at": "Number",        // timestamp 毫秒数
  "created_at": "Number",          // timestamp 毫秒数，forceDefaultValue: $env.now
  "updated_at": "Number"           // timestamp 毫秒数
}
```

#### 规则与交互

- `Dog.latest_weight` 作为缓存字段，每次录入自动更新
- **批量体重录入：** 选窝 → 所有幼崽列出 → 逐只输入 → 显示上次体重和增减 → 体重下降自动标黄
- 体重历史可查看曲线图
- **入口：** 窝详情页「记录体重」按钮 / 快速记录

---

### 2.7 家庭（families 集合）

家庭成员和护理群组规则直接嵌入家庭文档，不作为独立集合。

```json
{
  "_id": "ObjectId",
  "name": "String",
  "creator_id": "String",        // foreignKey → users，创建者
  "members": [
    {
      "user_id": "String",       // foreignKey → users
      "role": "String",          // creator / admin / helper
      "status": "String",        // active / invited / removed
      "joined_at": "Number",       // timestamp 毫秒数
      "removed_at": "Number"      // 选填，timestamp 毫秒数，移除时填入
    }
  ],
  "care_rules": [
    {
      "status_trigger": "String", // 触发状态：怀孕中 / 哺乳中 / 生病中 / 用药中 等
      "task_description": "String", // 任务描述，如「每日喂钙铁」
      "frequency": "String"       // 每日 / 每周 / 自定义
    }
  ],
  "settings": {
    "default_weaning_days": "Number",    // 默认断奶龄（天），默认 45
    "default_vaccine_interval_puppy": "Number",  // 幼犬疫苗间隔（天），默认 21
    "default_vaccine_interval_adult": "Number",  // 成犬疫苗间隔（天），默认 365
    "default_deworming_interval_puppy": "Number", // 幼犬驱虫间隔（天），默认 14
    "default_deworming_interval_adult": "Number", // 成犬驱虫间隔（天），默认 90
    "morning_summary_time": "String",    // 晨间摘要推送时间，默认 "07:00"
    "custom_vaccine_types": ["String"],  // 用户自定义疫苗类型，预设: ["卫佳5", "卫佳8", "卫佳10", "狂犬"]
    "custom_deworming_drugs": {          // 用户自定义驱虫药品，按类型分组
      "internal": ["String"],            // 预设: ["拜宠清", "海乐妙", "犬心保"]
      "external": ["String"],            // 预设: ["福来恩", "大宠爱"]
      "combo": ["String"]               // 预设: ["超可信", "博来恩"]
    }
  },
  "created_at": "Number",          // timestamp 毫秒数，forceDefaultValue: $env.now
  "updated_at": "Number"           // timestamp 毫秒数
}
```

---

### 2.8 费用记录（expenses 集合）

费用记录支持三种互斥关联方式（linked_cycle_id / linked_litter_id / linked_dog_ids），包含冗余字段以减少联表查询。

```json
{
  "_id": "ObjectId",
  "family_id": "String",           // foreignKey → families
  "total_amount": "Number",        // 总金额
  "category": "String",            // 费用分类（食品/营养品/消耗品/日常用品/固定开销/交通/医疗/配种费/其他，可自定义）
  "date": "Number",                // timestamp 毫秒数
  "linked_cycle_id": "String",     // 选填，繁育过程费用（配种费、孕检费等），foreignKey → breeding_cycles
  "linked_litter_id": "String",    // 选填，窝级别费用（幼犬奶粉等），foreignKey → litters
  "linked_dog_ids": ["String"],    // 选填，犬只个体费用，foreignKey → dogs。分摊金额 = total_amount / 数组长度（动态计算）
  "source_type": "String",         // manual（手动录入）/ auto（繁育/健康记录自动同步）
  "source_record_id": "String",    // 选填，来源记录 ID（auto 类型时指向原始繁育/健康记录）
  "images": ["String"],            // 图片凭证（云存储 fileID）
  "dam_name": "String",            // 冗余字段，母犬名称
  "dog_names": ["String"],         // 冗余字段，关联犬只名称列表
  "litter_number": "Number",       // 冗余字段，窝编号
  "notes": "String",
  "created_by": "String",          // foreignKey → users
  "deleted_at": "Number | null",    // timestamp 毫秒数，默认 null
  "created_at": "Number",          // timestamp 毫秒数，forceDefaultValue: $env.now
  "updated_at": "Number"           // timestamp 毫秒数
}
```

**关联规则（三选一，互斥）：**
- `linked_cycle_id` → 繁育过程费用（生产前，如配种费、孕检费）
- `linked_litter_id` → 窝级别费用（生产后，如幼犬奶粉、整窝驱虫药）
- `linked_dog_ids` → 犬只个体费用（如成犬疫苗、个体医疗）
- 均不填 → 共用开销（如房租、狗粮、水电）

**source_type=auto 的费用在财务模块中为只读**，修改需回到来源记录操作。

**多犬费用处理：**

- 通过 linked_dog_ids 数组关联多只犬
- 不存储分摊金额，动态计算：total_amount / linked_dog_ids.length
- 修改总额自动生效、增删关联犬自动生效
- 不支持不均分——如需精确分配，录两笔

**默认支出分类（可自定义增删改）：**

食品、营养品、消耗品、日常用品、固定开销、交通、医疗、配种费、其他

**繁育记录费用自动同步：**

繁育流程中录入费用时（配种费、孕检费、生产费等），系统自动创建 Expense 记录：

- source_type = 'auto'
- linked_cycle_id = 对应周期
- 用户无需手动操作
- 财务页面可见所有费用，不会遗漏
- **自动创建的记录（source_type=auto）在财务模块 UI 中为只读**，需要在来源模块修改

---

### 2.9 收入记录（incomes 集合）

所有收入统一记录在 incomes 集合中，SaleRecord 不再参与财务计算。

```json
{
  "_id": "ObjectId",
  "dog_id": "String",           // foreignKey → dogs（选填）
  "dog_name": "String",         // 冗余字段
  "type": "String",             // 销售 / 定金保留 / 领养 / 退款 / 其他
  "amount": "Number",           // 金额，退款为负数
  "date": "Number",             // timestamp 毫秒数
  "source_sale_id": "String",   // 选填，来源销售记录，foreignKey → sale_records
  "notes": "String",
  "family_id": "String",        // foreignKey → families
  "created_by": "String",       // foreignKey → users
  "deleted_at": "Number | null",    // timestamp 毫秒数，默认 null
  "created_at": "Number",          // timestamp 毫秒数，forceDefaultValue: $env.now
  "updated_at": "Number"           // timestamp 毫秒数
}
```

#### 自动生成 Income 的触发规则

| 触发事件 | 云对象操作 |
|---------|-----------|
| SaleRecord 进入「已成交」 | 创建 Income(type=销售, amount=received_amount) |
| SaleRecord 退款 | 创建 Income(type=退款, amount=-refund_amount) |
| SaleRecord 定金取消（保留） | 创建 Income(type=定金保留, amount=deposit_kept_amount) |
| 犬只领养（有费用） | 创建 Income(type=领养, amount=领养费) |
| SaleRecord 编辑 received_amount | 更新对应 Income.amount |
| SaleRecord 编辑 deposit_kept_amount | 更新对应 Income.amount |
| SaleRecord 编辑 refund_amount | 更新对应 Income.amount |

**财务页面展示统一流水时：** 查询 incomes 表（收入，红色）+ Expense 表（支出，绿色），按日期合并排序。中式记账：红色=进账/吉利，绿色=出账。

---

### 2.10 销售记录（sale_records 集合）

```json
{
  "_id": "ObjectId",
  "dog_id": "String",           // foreignKey → dogs
  "dog_name": "String",         // 冗余字段，用于列表展示避免联表查询
  "status": "String",           // 待售/已预定/已成交/已退款/定金取消
  "floor_price": "Number",      // 底价
  "deposit_amount": "Number",   // 定金金额，选填
  "deposit_date": "Number",     // 定金日期，timestamp 毫秒数，选填
  "agreed_price": "Number",     // 预定时谈好的价格，选填
  "received_amount": "Number",  // 到手价，已成交时必填
  "seller_agent_id": "String",  // foreignKey → agents（代理人，选填）
  "platform": "String",         // 平台，选填
  "date": "Number",             // 成交日期，timestamp 毫秒数，选填，已成交时必填
  "delivery_date": "Number",    // 交付日期，timestamp 毫秒数，选填
  "buyer_info": "String",       // 买家信息，选填
  "refund_amount": "Number",    // 退款金额，选填
  "refund_reason": "String",    // 退款原因，选填
  "refund_date": "Number",      // 退款日期，timestamp 毫秒数，选填
  "deposit_kept_amount": "Number", // 定金取消时保留的金额，选填
  "notes": "String",
  "created_by": "String",       // foreignKey → users
  "deleted_at": "Number | null",    // timestamp 毫秒数，默认 null
  "created_at": "Number",          // timestamp 毫秒数，forceDefaultValue: $env.now
  "updated_at": "Number",          // timestamp 毫秒数
  "family_id": "String"         // foreignKey → families
}
```

#### 销售三阶段流程

**阶段一「待售」：**

- 设定底价

**阶段二「已预定」：**

- 定金金额（必填）
- 定金日期
- 买家信息（选填）
- 成交价（选填——已谈好就填，没谈好先空着）
- 到手价（选填）
- 卖出人/代理人（选填）
- 平台（选填）

**阶段三「已成交」：**

- 已预定阶段填过的字段自动带入，用户确认或修改
- 到手价（必填，其余选填）
- 交付日期
- 完成后自动生成收入记录

**收入统计规则：** 只有「已成交」的到手价才计入实际收入。已预定阶段填了价格的，在窝统计里可以展示预计收入（不计入实际利润）。

**到手价 < 底价时，系统标红提示「低于底价」。**

#### 平台预设选项

按此顺序排列：线下、微信、小红书、抖音、快手、闲鱼

支持用户自定义添加新平台。

#### 退款处理

在销售记录上增加「退款」操作，原始记录保留：

- 全额退款：幼崽状态从「已售」回退为「待售」或「在养」，该笔收入归零
- 部分退款：幼崽状态不变，实际收入 = 到手价 - 退款金额
- 退款原因选填
- 窝利润和种母投资回报自动重新计算

#### 定金取消

| 场景 | 处理 | 幼崽状态 |
|------|------|---------|
| 买家取消，定金不退（你留下） | 定金保留金额计为收入 | 回到「待售」 |
| 买家取消，定金退还 | 无收入 | 回到「待售」 |
| 买家取消，定金部分退还 | 实际保留金额计为收入 | 回到「待售」 |

> **退款/定金取消后的 SaleRecord 为终态**，不可重新进入「已预定」或「已成交」。如需重新销售该犬，创建新的 SaleRecord。一只犬可以有多条 SaleRecord（历史记录）。

#### 代理人/中间人管理

**agents 集合**（独立集合，不嵌入其他文档）

```json
{
  "_id": "ObjectId",
  "name": "String",
  "contact_info": "String",     // 联系方式，选填
  "family_id": "String",        // foreignKey → families
  "deleted_at": "Number | null",    // timestamp 毫秒数，默认 null
  "created_at": "Number",          // timestamp 毫秒数，forceDefaultValue: $env.now
  "updated_at": "Number"           // timestamp 毫秒数
}
```

- 简单联系人列表
- SaleRecord.seller_agent_id 关联代理人
- 代理人详情页展示：经手中的交易、待收款汇总、历史已完成交易
- 代理人列表同时作为销售记录「卖出人」字段的预设选项
- 入口：销售记录的「卖出人」字段中管理，或「我的」页面「合作代理人」入口

---

### 2.11 统计报表

> **所有统计数据均通过 MongoDB 聚合管道（aggregation pipeline）实时计算，不做预计算存储。** 在 30-50 只犬的规模下，聚合查询为毫秒级响应。不在 litter 或 dog 文档上存储 stats 字段。

**第一层：单窝利润**

```
收入 = sum(incomes.amount where dog_id in 该窝幼崽)
支出 = linked_cycle_id=该窝周期的Expense（繁育过程费用）
     + linked_litter_id=该窝的Expense（窝级别费用）
     + 该窝各幼崽通过linked_dog_ids关联的Expense（幼崽个体费用）
净利润 = 收入 - 支出
```

**第二层：单只种母投资回报**

```
sum(incomes.amount for puppies across all litters of this dam)
- 买入价格（purchase_price）
- 所有窝总支出
- 该犬通过linked_dog_ids关联的个体费用（疫苗/驱虫/医疗）
= 该种母累计净收益
```

**第三层：月度/年度总账**

```
月度净利润 = sum(incomes.amount) - sum(expenses.total_amount)
```

**第四层：未来预估**

- 系统综合以下信息给出建议值：
  - 历史数据（每只种母平均多久一窝）
  - 当前在役种母数量
  - 年轻犬只是否到达可繁育年龄（根据历史平均首次配种年龄推算，有发情记录的更精准）
- 用户可手动修改所有预估参数
- 依赖数据积累，V1先做好数据录入和前三层统计，预估功能在数据积累后开启

**每只幼崽均摊成本：** 窝直接成本 / 存活幼崽数 = 平均每只成本。定价参考。存活幼崽数为 0 时不计算均摊（显示「无存活幼崽」），窝成本全部归入种母投资回报。
