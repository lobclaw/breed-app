# 实现计划（后端 + 前端）

> **生成时间：** 2026-03-26（后端）/ 2026-03-27（前端）
> **依据：** 设计文档 01-03 + 工程审查 + design-system.md + page-inventory.md + 20 个 HTML 原型

---

## Part 1: 后端实现计划

### 1. 总览

#### 1.1 Phase 1 范围（路径 A，四批交付）

| 批次 | 内容 | 核心集合 | 预估页面数 |
|------|------|---------|-----------|
| 第一批 | 犬只档案 + 繁育流程 + 基础提醒 | dogs, breeding_cycles, breeding_records, litters, tasks | ~20 |
| 第二批 | 财务模块 + 销售流程 | expenses, incomes, sale_records | ~12 |
| 第三批 | 首页智能卡片 + 自动化逻辑 | tasks（增强） | ~8 |
| 第四批 | 协作 + 用药方案库 + 代理人 + 批量体重 | families（增强）, medication_protocols, agents, dog_weights | ~14 |

#### 1.2 开发原则

- **每步先后端再前端：** 云对象 + vitest 测试 → 前端页面
- **测试覆盖：** 云对象目标 80%+ 覆盖率
- **数据隔离：** 所有操作通过 `_before` 拦截器注入 `familyId`
- **增量交付：** 每批完成后可独立使用

---

### 2. 基础设施（所有批次前置）

#### 2.1 认证 + 家庭初始化

**目标：** 用户能注册/登录，创建家庭，进入主界面。

**云对象：family-service**

| 方法 | 说明 | 涉及集合 |
|------|------|---------|
| `createFamily(name)` | 创建家庭 + 自动添加创建者为 creator | families |
| `getFamilyInfo()` | 获取当前用户的家庭信息 | families |
| `updateSettings(settings)` | 更新家庭设置（默认断奶龄等） | families |

**公共模块：common/auth.js**

| 功能 | 说明 |
|------|------|
| `_before` 拦截器 | 验证 token → 获取 uid → 查询 family → 注入 familyId + role |
| 权限检查 | 根据 role 判断操作权限（V1 简化：creator/admin 全权限，helper 受限） |

**前端页面：**

| 页面 | 路径 | 说明 |
|------|------|------|
| 登录/注册 | uni-id-pages（插件） | 直接使用预置 UI |
| 创建/加入家庭 | pages/family/setup | 新用户首次进入引导 |

**前端基础组件：**

| 组件 | 路径 | 说明 |
|------|------|------|
| useCloudCall | composables/useCloudCall.ts | 云对象调用封装（loading/error/retry） |
| useAuth | composables/useAuth.ts | 登录状态 + 用户信息 |
| DogAvatar | components/common/DogAvatar.vue | 犬只头像（复用于所有列表） |
| DogPicker | components/common/DogPicker.vue | 犬只选择器 |
| BottomSheet | components/bottom-sheet/BottomSheet.vue | 底部弹出表单壳 |

**开发顺序：**
1. 配置 uni-id-pages 插件
2. 实现 common/auth.js 拦截器
3. 实现 family-service 云对象 + 测试
4. 前端引导页面
5. useCloudCall / useAuth composables
6. 基础通用组件

---

### 3. 第一批：犬只档案 + 繁育流程 + 基础提醒

#### 3.1 犬只档案

**云对象：dog-service**

| 方法 | 说明 | 涉及集合 | 复杂度 |
|------|------|---------|--------|
| `getDogListWithStatus()` | 犬只列表 + 实时派生状态 | dogs + breeding_cycles + health_records + medication_tasks | 高 |
| `getDogDetail(dogId)` | 犬只详情 + 完整状态 | dogs + 关联集合 | 中 |
| `createDog(data)` | 创建犬只（含外部种公）。当 `purchase_price` 有值时自动创建对应 expense 记录（category=购入，linked_dog_ids=[newDogId]） | dogs + expenses | 低 |
| `updateDog(dogId, data)` | 更新犬只基础信息 | dogs | 低 |
| `updateDogName(dogId, newName)` | 改名 + 批量更新冗余字段 | dogs + tasks + sale_records + incomes + breeding_cycles + litters + expenses | 高 |
| `changeDisposition(dogId, disposition, data)` | 变更去向（含异常状态转换处理） | dogs + breeding_cycles + tasks | 高 |
| `softDeleteDog(dogId)` | 软删除 | dogs | 低 |
| `restoreDog(dogId)` | 恢复 | dogs | 低 |
| `upgradePuppyToBreeder(dogId)` | 幼崽升级为种狗 | dogs | 低 |

**状态派生逻辑（getDogListWithStatus 内部）：**

```
1. 查询所有在养犬只 → dogs[]
2. 并行查询：
   a. breeding_cycles where status in [发情中, 怀孕中] → 发情中/怀孕中
   b. health_records where type=illness and details.treatment_status!=已康复 → 生病中
   c. medication_tasks where status=active → 用药中
3. 推导哺乳中：breeding_cycles.status=已生产 + litter.weaned_at=null
4. 组装结果返回
```

**前端页面：**

| 页面 | 路径 | 说明 |
|------|------|------|
| 犬只列表 | pages/dog/list | 筛选（性别/角色/去向）+ 状态标签 |
| 犬只详情 | pages/dog/detail | 基础信息 + 状态 + Tab（繁育/健康/财务） |
| 新增犬只 | pages/dog/add | 表单（BottomSheet 或全页面） |
| 编辑犬只 | pages/dog/edit | 复用新增表单 |
| 变更去向 | pages/dog/disposition | 底部弹出：选择去向 + 填写信息 |

**clientDB 直读（不走云对象）：**
- 犬只基础编辑（简单字段更新）
- 体重记录查询

#### 3.2 繁育流程

**云对象：breeding-service**

| 方法 | 说明 | 涉及集合 | 复杂度 |
|------|------|---------|--------|
| `addBreedingRecord(data)` | 录入繁育记录（8种type）。当前主流程按「发情→建议卵泡检查→配种→建议孕检→生产→确认断奶」推进 | breeding_records + breeding_cycles + tasks + expenses | 高 |
| `getCycleDetail(cycleId)` | 周期详情 + 所有子记录 | breeding_cycles + breeding_records + litters | 中 |
| `getCycleHistory(damId)` | 某母犬的繁育历史 | breeding_cycles + breeding_records | 中 |
| `closeCycle(cycleId, reason)` | 手动关闭周期（放弃/失败） | breeding_cycles + tasks | 中 |
| `addBirthRecord(data)` | 生产记录（步骤式向导）。当前仅自动创建「确认断奶」流程节点，不再自动铺首驱/首免链 | breeding_records + litters + dogs(幼崽) + tasks + expenses | 高 |
| `getLitterDetail(litterId)` | 窝详情 + 幼崽列表 | litters + dogs | 低 |
| `addPuppyToLitter(litterId, data)` | 后续添加幼崽 | dogs + litters | 低 |
| `confirmWeaning(litterId)` | 确认断奶 | litters + tasks | 低 |

**addBreedingRecord 核心逻辑：**

```
1. 校验 type 特有字段（云对象层校验）
2. 如果无进行中周期 → 自动创建 breeding_cycle（发情/卵泡/配种触发）
3. 创建 breeding_record
4. 状态转换：配种 → cycle.status=怀孕中
5. 根据记录类型推进主流程：
   - 发情 → 生成「建议卵泡检查」
   - 配种 → 生成「建议孕检」，预计预产日仅写入副信息
   - 孕检失败/异常终止 → 结束当前流程并清理未完成节点
6. 如有 cost → 创建 expense 记录
7. 写入后校验（三层保障第二层）
```

**addBirthRecord 核心逻辑：**

```
1. 创建 breeding_record (type=birth)
2. 创建 litter
3. 逐只创建幼崽 dogs（role=幼崽, origin_litter_id=litterId）
4. cycle.status → 已生产
5. 清理当前周期未完成节点，仅生成「确认断奶」(+默认45d，可配置)
6. 如有 cost → 创建 expense
7. 注意事务 10 文档限制：幼崽多时分批
```

**前端页面：**

| 页面 | 路径 | 说明 |
|------|------|------|
| 繁育周期详情 | pages/breeding/cycle | 时间线展示所有子记录 |
| 录入繁育记录 | pages/record/breeding | Schema 驱动表单（按 type 切换） |
| 生产记录向导 | pages/breeding/birth-wizard | 3 步向导 |
| 窝详情 | pages/breeding/litter | 幼崽列表 + 体重 + 窝利润 |

#### 3.3 健康管理

**云对象：health-service**

| 方法 | 说明 | 涉及集合 | 复杂度 |
|------|------|---------|--------|
| `addHealthRecord(data)` | 录入健康记录（vaccination/deworming/illness）。支持显式 `create_task=true` 创建下次提醒；默认只计算建议日期，不自动续链 | health_records + tasks + expenses | 中 |
| `getHealthHistory(dogId, type?)` | 某犬的健康记录 | health_records | 低 |
| `startMedication(data)` | 开始连续用药（疗程状态独立于普通 tasks） | medication_tasks + tasks | 中 |
| `completeDailyMedication(taskId)` | 标记今日用药完成 | medication_tasks + tasks | 低 |
| `endMedication(medicationTaskId)` | 提前结束用药 | medication_tasks + tasks | 低 |

**前端页面：**

| 页面 | 路径 | 说明 |
|------|------|------|
| 录入健康记录 | pages/record/health | Schema 驱动表单 |
| 健康记录列表 | 犬只详情 Tab 内 | 嵌入犬只详情页 |
| 开始用药 | pages/health/medication | 用药表单 |

#### 3.4 任务系统（基础版）

**云对象：task-service**

| 方法 | 说明 | 涉及集合 | 复杂度 |
|------|------|---------|--------|
| `getHomeCards(date?)` | 获取首页卡片数据（按逾期/繁育/健康/用药分层输出） | tasks + dogs | 高 |
| `completeTask(taskId)` | 标记任务完成 | tasks | 低 |
| `postponeTask(taskId, newDate, reason?)` | 推迟任务 | tasks | 低 |
| `createManualTask(data)` | 用户手动创建待办任务（表单"标记为待办"开关触发），支持指定犬只、标题、日期 | tasks | 低 |
| `cancelTasksByCycle(cycleId)` | 周期关闭时批量取消 | tasks | 低 |
| `_timing_dailyAudit()` | 每日审计（三层保障第三层） | tasks + breeding_records + health_records + medication_tasks | 高 |
| `_timing_autoCloseCycles()` | 自动关闭过期发情周期 | breeding_cycles + tasks | 中 |

**getHomeCards 当前服务端输出规则：**

```
1. 查询 tasks where status=pending and due_date in range
2. 单独汇总 medication_tasks + illness 状态，组装「今日用药」卡片
3. 将首页数据分成四类：
   a. overdue：已过期事项
   b. workflow：繁育主流程节点
   c. reminders：健康提醒（仅显示已确认创建的提醒）
   d. therapy：疗程状态
4. 各区块内部再按既有合并规则生成个体卡 / 批量卡 / 窝卡
5. 首页顶部 pills 采用「逾期 / 繁育 / 健康 / 用药」，点击后滚动到对应区块
```

> **2026-04 当前实现：** 首页今日视图已按四区块分层展示；暂不做摘要卡、二级页或 Sheet，保持现有卡片直出布局。

#### 3.5 第一批开发顺序

```
Step 0: 基础设施（auth + family + 通用组件）
  ↓
Step 1: dog-service 云对象 + 测试
  ↓
Step 2: 犬只列表/详情/新增页面
  ↓
Step 3: breeding-service 云对象 + 测试
  ↓
Step 4: 繁育记录表单 + 周期详情页面
  ↓
Step 5: 生产记录向导 + 窝详情页面
  ↓
Step 6: health-service 云对象 + 测试
  ↓
Step 7: 健康记录表单页面
  ↓
Step 8: task-service 基础方法 + 测试
  ↓
Step 9: 首页简化版（任务列表）
  ↓
Step 10: _timing 定时任务 + 每日审计
```

---

### 4. 第二批：财务模块 + 销售流程

#### 4.1 财务管理

**云对象：finance-service**

| 方法 | 说明 | 涉及集合 | 复杂度 |
|------|------|---------|--------|
| `addExpense(data)` | 手动录入支出 | expenses | 低 |
| `addIncome(data)` | 手动录入收入 | incomes | 低 |
| `getFinancialSummary(period)` | 月度/年度统计 | expenses + incomes | 中 |
| `getLitterProfit(litterId)` | 单窝利润 | expenses + incomes + litters | 中 |
| `getDamROI(damId)` | 种母 ROI | expenses + incomes + breeding_cycles + litters | 中 |
| `getTransactionList(filters)` | 收支流水列表（合并展示） | expenses + incomes | 低 |
| `softDeleteExpense(id)` | 软删除支出 | expenses | 低 |
| `softDeleteIncome(id)` | 软删除收入 | incomes | 低 |

#### 4.2 销售流程

**云对象：finance-service（扩展）**

| 方法 | 说明 | 涉及集合 | 复杂度 |
|------|------|---------|--------|
| `createSaleRecord(data)` | 创建销售记录（意向阶段） | sale_records | 低 |
| `receiveSaleDeposit(saleId, amount)` | 收定金 → 已预定 | sale_records + incomes + dogs | 中 |
| `completeSale(saleId, finalAmount)` | 完成交易 → 已售 | sale_records + incomes + dogs + tasks | 中 |
| `cancelSale(saleId, reason)` | 取消销售 | sale_records + incomes(退款) + dogs | 中 |
| `getSaleList(filters)` | 销售记录列表 | sale_records | 低 |

**前端页面：**

| 页面 | 路径 | 说明 |
|------|------|------|
| 财务首页 | pages/finance/index | 统一流水 + 筛选 + 统计入口 |
| 统计视图 | pages/finance/stats | 月度/年度/窝利润/种母ROI |
| 记账（支出/收入统一） | pages/finance/expense-add | 顶部 Segmented Control 切换支出/收入模式，?type=income 参数切换默认模式。income-add 页面已弃用 |
| 销售列表 | pages/sale/list | 三阶段状态筛选 |
| 销售详情 | pages/sale/detail | 流程进度 + 操作按钮 |
| 创建销售 | pages/sale/create | 选犬 + 填信息 |

#### 4.3 第二批开发顺序

```
Step 11: finance-service 基础方法（CRUD）+ 测试
  ↓
Step 12: 财务流水页面 + 录入页面
  ↓
Step 13: 财务统计方法 + 统计页面
  ↓
Step 14: 销售流程云对象方法 + 测试
  ↓
Step 15: 销售页面（列表/详情/创建）
  ↓
Step 16: 繁育记录 cost → 自动创建 expense 联调
```

---

### 5. 第三批：首页智能卡片 + 自动化

#### 5.1 完善首页

| 任务 | 说明 |
|------|------|
| Zone 1 状态摘要栏 | 需处理/今日/本周计数 + 点击滚动 |
| 7 天预览条 | WeekStrip 组件 + 点击切换日期 |
| 月历展开 | 点击月份标题展开完整月历 |
| 智能卡片系统 | 4 种卡片类型 + 合并算法 |
| 卡片内操作 | BottomSheet 快速完成 |
| 逾期处理 | 推迟 + 原因 + 视觉升级 |

#### 5.2 FAB Action Sheet

| 任务 | 说明 |
|------|------|
| FAB 按钮 | 底部导航中间 "+" |
| Action Sheet | 智能推荐 3 + 常用 4 + 全部入口 |
| R-1 全部记录类型 | 15 种记录类型图标网格 |

#### 5.3 第三批开发顺序

```
Step 17: WeekStrip 组件
  ↓
Step 18: 4 种 SmartCard 组件
  ↓
Step 19: getHomeCards 合并算法完善 + 测试
  ↓
Step 20: 首页三区集成
  ↓
Step 21: FAB Action Sheet + R-1 页面
  ↓
Step 22: BottomSheet 快速完成流程
```

---

### 6. 第四批：协作 + 辅助功能

#### 6.1 协作

**云对象：family-service（扩展）**

| 方法 | 说明 |
|------|------|
| `generateInviteLink()` | 生成邀请链接 |
| `joinFamily(inviteCode)` | 通过邀请码加入家庭 |
| `updateMemberRole(userId, role)` | 调整成员角色 |
| `removeMember(userId)` | 移除成员 |
| `getMemberList()` | 成员列表 |

#### 6.2 用药方案库 + 代理人

**clientDB 直读直写（简单 CRUD）：**
- medication_protocols：方案名称/药品列表/默认疗程
- agents：代理人姓名/联系方式/备注

#### 6.3 批量体重录入

**云对象：health-service（扩展）**

| 方法 | 说明 |
|------|------|
| `batchAddWeights(litterId, weights[])` | 批量录入一窝幼崽体重 |
| `getWeightHistory(dogId)` | 体重历史 + 增减趋势 |

#### 6.4 推送通知

| 任务 | 说明 |
|------|------|
| UniPush 2.0 集成 | 厂商通道配置 |
| 晨间摘要 | _timing 定时推送（07:00 默认） |
| 即时推送 | 逾期任务 / 紧急提醒 |

#### 6.5 第四批开发顺序

```
Step 23: 邀请/加入家庭云对象 + 页面
  ↓
Step 24: 成员管理 + 角色权限
  ↓
Step 25: 用药方案库页面（clientDB）
  ↓
Step 26: 代理人管理页面（clientDB）
  ↓
Step 27: 批量体重录入
  ↓
Step 28: UniPush 集成 + 晨间摘要
  ↓
Step 29: 通知设置页面
  ↓
Step 30: 我的页面（个人信息/设置/数据备份）
```

---

### 7. 云对象 API 完整清单

| 云对象 | 方法数 | 集中在 |
|--------|--------|--------|
| dog-service | 9 | 第一批 |
| breeding-service | 8 | 第一批 |
| health-service | 7 | 第一批 + 第四批 |
| task-service | 7 | 第一批 + 第三批 |
| finance-service | 12 | 第二批 |
| family-service | 8 | 基础设施 + 第四批 |
| **总计** | **51** | |

---

### 8. 测试策略

#### 8.1 vitest 测试重点

| 优先级 | 测试目标 | 示例 |
|--------|---------|------|
| P0 | 繁育状态机转换 | 配种→怀孕中、生产→已生产、异常转换阻止 |
| P0 | 任务预生成 | 配种→生成建议孕检任务、生产→生成确认断奶任务、疫苗在 create_task=true 时生成下次任务 |
| P0 | 销售状态流转 | 意向→收定金→完成、取消→退款 |
| P1 | 犬只状态派生 | 多状态叠加、边界条件 |
| P1 | 卡片合并算法 | 窝级别>批量>个体优先级 |
| P1 | 财务统计 | 窝利润、种母ROI、月度汇总 |
| P2 | 权限检查 | 协助者不能访问财务、不能创建繁育记录 |
| P2 | 软删除 + 恢复 | 删除后查询不可见、恢复后数据完整 |

#### 8.2 测试文件结构

```
tests/
├── cloud-objects/
│   ├── dog-service.test.ts
│   ├── breeding-service.test.ts
│   ├── health-service.test.ts
│   ├── task-service.test.ts
│   ├── finance-service.test.ts
│   └── family-service.test.ts
├── utils/
│   ├── date.test.ts
│   ├── status-derive.test.ts
│   └── card-merge.test.ts
└── helpers/
    └── mock-unicloud.ts          # UniCloud API mock
```

---

### 9. 每日审计 + 定时任务

#### 9.1 定时任务清单

| 任务 | 时间 | 云对象 | 方法 |
|------|------|--------|------|
| 每日审计 | 02:00 UTC+8 | task-service | `_timing_dailyAudit()` |
| 自动关闭过期发情 | 02:00 UTC+8 | task-service | `_timing_autoCloseCycles()` |
| 晨间摘要推送 | 07:00 UTC+8（可配置） | task-service | `_timing_morningSummary()` |
| 过期任务清理 | 03:00 UTC+8 | task-service | `_timing_cleanupOldTasks()` |

#### 9.2 每日审计检查项

1. **有记录无任务：** 扫描最近 N 天的 breeding_records/health_records，检查应生成但缺失的 task
2. **护理规则无任务：** 扫描活跃护理规则（care_rules），检查对应状态的犬只是否都有 pending task
3. **过期发情：** breeding_cycle.status=发情中 且 >21 天无配种 → 自动关闭
4. **任务 priority 更新：** pending 且 due_date < 今天 → priority 改为 overdue

---

### 10. 关键风险 + 缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 事务 10 文档限制 | 大窝生产记录（8+幼崽）超限 | 分批写入 + 写入后校验 |
| 冗余字段写放大（改名） | 改名需更新 6 个集合 | 低频操作，顺序写入 + 审计兜底 |
| getDogListWithStatus N+3 查询 | 犬只多时性能 | 用集合级查询（非逐犬），30-50 犬毫秒级 |
| 首页卡片合并复杂度 | 逻辑 bug 导致重复/遗漏 | 独立单元测试覆盖所有合并场景 |
| UniCloud 免费额度 | 开发期间高频调试消耗 RU | 开发环境用 mock，联调时注意 |

---

### 11. 里程碑检查点

| 检查点 | 完成标志 | 可交付 |
|--------|---------|--------|
| M0：基础设施 | 能登录 + 创建家庭 | — |
| M1：犬只档案 | 能增删改查犬只 + 看到状态 | 可以开始录入犬只数据 |
| M2：繁育流程 | 能记录完整繁育周期 | 核心痛点 #1 解决 |
| M3：健康管理 | 疫苗/驱虫/用药 + 自动提醒 | 核心痛点 #2 解决 |
| M4：首页任务 | 看到待办列表 | 基础可用版本 |
| M5：财务 | 收支记录 + 统计 | 核心痛点 #3 解决 |
| M6：销售 | 完整销售流程 | — |
| M7：智能首页 | 卡片系统完善 | 完整体验 |
| M8：协作 | 多用户 + 角色权限 | — |
| M9：发布 | 打包 + 上架 | Phase 1 完成 |

---

## Part 2: 前端 UI 实现计划

> **设计资产：** design-system.md（设计令牌）+ page-inventory.md（110 屏清单）+ 20 个 HTML 原型（docs/ui/*.html）
>
> **原则：** 设计令牌优先（零硬编码）→ 组件化（单一职责）→ 一比一还原 HTML 原型 → 精品代码

### 12. 组件库设计

#### 12.1 组件清单（按优先级）

**Tier 1：基础组件（所有页面依赖）**

| 组件 | 路径 | Props | 设计稿来源 |
|------|------|-------|-----------|
| BCard | components/base/BCard.vue | type(颜色), title, subtitle, icon | 所有卡片页面 |
| BButton | components/base/BButton.vue | variant(filled/ghost), color, size, loading | 全局 |
| BIconBox | components/base/BIconBox.vue | icon, color, size(36/28) | 卡片头部、列表项 |
| BTag | components/base/BTag.vue | label, color | 状态标签 |
| BPill | components/base/BPill.vue | count, color, label | 摘要数字 |
| BCheckbox | components/base/BCheckbox.vue | v-model, label | 任务完成 |
| BProgress | components/base/BProgress.vue | value, max, gradient | 用药进度 |
| BSectionLabel | components/base/BSectionLabel.vue | title, color, badge | 分区标题 |

**Tier 2：布局组件**

| 组件 | 路径 | 说明 |
|------|------|------|
| BSheet | components/layout/BSheet.vue | 底部弹出面板（handle + 动画 + 高度自适应） |
| BModal | components/layout/BModal.vue | 居中确认弹窗 |
| BTabBar | components/layout/BTabBar.vue | 页面内 Tab 切换（下划线指示器） |
| BNavBar | components/layout/BNavBar.vue | 底部导航栏（毛玻璃 + FAB） |
| BPageHeader | components/layout/BPageHeader.vue | 页面标题栏 |

**Tier 3：表单组件**

| 组件 | 路径 | 说明 |
|------|------|------|
| BInput | components/form/BInput.vue | 输入框（含标签、错误状态） |
| BDatePicker | components/form/BDatePicker.vue | 日期选择（今天/昨天快捷 + 日历） |
| BDogPicker | components/form/BDogPicker.vue | 犬只选择器（自包含模式：自渲染触发卡片 + 搜索 + 彩色头像，v-model 支持单选/多选数组） |
| BLitterSelector | components/form/BLitterSelector.vue | 窝选择面板 |
| BCycleSelector | components/form/BCycleSelector.vue | 繁育周期选择面板 |
| BImageUpload | components/form/BImageUpload.vue | 图片上传（拍照/相册 + 压缩） |
| BSegmentedControl | components/form/BSegmentedControl.vue | 分段选择器（仅用于视图/标签页切换） |
| BFormOptions | components/form/BFormOptions.vue | 表单公共选项组（待办开关 + 日期选择含今天/昨天/前天 chips + 提醒开关）。支持 `hideTodo` prop 隐藏待办开关，并可通过 `reminderLabel/reminderHint` 定制文案。繁育表单使用待办逻辑；疫苗/驱虫表单使用「创建下次待办」显式开关；疾病表单隐藏待办，仅保留复查提醒；用药表单不使用此组件（改用简单日期选择）；财务表单不使用此组件 |

**Tier 4：数据展示组件**

| 组件 | 路径 | 说明 |
|------|------|------|
| BWeightChart | components/data/BWeightChart.vue | 迷你体重折线图（SVG） |
| BTrendLine | components/data/BTrendLine.vue | 4-6 点趋势线 |
| BTimeline | components/data/BTimeline.vue | 繁育/健康记录时间线 |
| BSkeleton | components/feedback/BSkeleton.vue | 骨架屏加载占位 |
| BEmpty | components/feedback/BEmpty.vue | 空状态提示 |

#### 12.2 组件命名规范

- 前缀 `B`（Breed）避免与 uni-ui 冲突
- 文件名 PascalCase：`BCard.vue`
- CSS 类名 BEM：`.b-card__header`、`.b-card__body`
- 所有颜色引用 CSS 变量，禁止硬编码 hex

---

### 13. 页面实现计划

#### 13.1 实现顺序（6 个 Tier）

```
Tier 0: 设计系统基建
  tokens.scss + 主题切换 + Plus Jakarta Sans 字体引入
    ↓
Tier 1: 基础组件库（8 个）
  BCard, BButton, BIconBox, BTag, BPill, BCheckbox, BProgress, BSectionLabel
    ↓
Tier 2: 布局 + 表单组件（12 个）
  BSheet, BModal, BTabBar, BNavBar, BPageHeader
  BInput, BDatePicker, BDogSelector, BImageUpload, BSegmentedControl
    ↓
Tier 3: 核心页面重构（高频使用）
  H-1 首页, D-1 犬只列表, D-2 犬只详情, D-3 新建犬只
    ↓
Tier 4: 表单页面（记录录入）
  R-2~R-9 繁育记录, R-10~R-13 健康记录, R-16/R-17 财务记录
    ↓
Tier 5: 剩余页面
  财务统计, 销售流程, 设置页, 协作页, 监控页
```

#### 13.2 繁育记录表单

> **实现说明（2026-03-28）：** 繁育记录已从单一 breeding.vue 拆分为 7 个独立页面：breeding-heat、breeding-follicle、breeding-mating、breeding-pregnancy、breeding-prenatal、breeding-prelabor、breeding-termination。每个页面包含 BFormOptions（待办/提醒开关）和固定底部提交按钮。

7 种类型（birth 跳转 birth-wizard），每个独立页面：

| type | 特有字段 | 涉及选择器 |
|------|---------|-----------|
| heat | 观察描述 | BDogSelector（种母） |
| follicle_check | 卵泡大小、建议配种时间 | BDogSelector + BCycleSelector |
| mating | 种公选择、配种方式、费用 | BDogSelector × 2 |
| pregnancy_check | 孕检方式、结果 | BCycleSelector |
| prenatal_check | 检查项目、体重 | BCycleSelector |
| pre_labor | 体温、预产期 | BCycleSelector |
| birth | → 跳转 birth-wizard | — |
| abnormal_termination | 终止原因、处理方式 | BCycleSelector |

#### 13.3 健康记录表单

> **实现说明（2026-04-13 更新）：**
> - 健康记录已从单一 health.vue 拆分为 3 个独立页面：health-vaccination、health-deworming、health-illness（medication 独立于 R-13）
> - 疫苗/驱虫表单：BFormOptions 使用显式「创建下次待办」开关，默认关闭；从待办/批量入口进入时隐藏待办开关
> - 疾病表单：BFormOptions 隐藏待办开关（hideTodo=true），保留复查提醒。保存后如果 treatment_status≠已康复，弹出"需要用药吗？"跳转用药页面
> - 用药表单：不使用 BFormOptions，改用简单日期选择。无待办开关、无下次提醒（startMedication 不支持）
> - 疫苗/驱虫提醒间隔根据犬只 role 动态计算：种狗用 adult 间隔，幼崽用 puppy 间隔
> - 录入健康记录后自动完成该犬同类型的 pending 待办；当前匹配规则为「同犬 + 同类型 + 同子类型」，驱虫额外比对 `drug_name`

| type | 特有字段 |
|------|---------|
| vaccination | 疫苗名称、接种部位、批号、建议日期/创建下次待办 |
| deworming | 药品名称、剂量、内/外驱 |
| illness | 症状描述、严重程度、诊断 |
| medication | 药品、剂量、频次、疗程天数 |

---

### 14. HTML 原型 → 页面映射表

| HTML 原型文件 | 覆盖页面 | 对应代码文件 |
|--------------|---------|-------------|
| home-v1-final.html | H-1 首页 | pages/home/index.vue |
| pages-list.html | D-1 犬只列表, D-5 筛选面板 | pages/dog/list.vue |
| pages-dog-detail.html | D-2 犬只详情, D-S1~S6 子视图 | pages/dog/detail.vue |
| pages-wizard-newdog.html | D-3 新建犬只, D-4 编辑犬只 | pages/dog/add.vue |
| pages-detail-views.html | D-15 窝详情, D-18 周期详情 | pages/breeding/litter.vue, cycle.vue |
| pages-litter-cycle-weight.html | 窝/周期/体重详细视图 | pages/breeding/*.vue |
| pages-breeding-forms.html | R-2~R-9 繁育记录表单 | pages/record/breeding-*.vue |
| pages-health-finance-forms.html | R-10~R-13 健康, R-16~R-17 财务 | pages/record/health-*.vue, finance/ |
| pages-expense-redesign.html | R-16 支出重设计 | pages/finance/expense-add.vue |
| pages-fab-action-sheet.html | R-0 FAB, R-1 全部记录类型 | pages/record/index.vue |
| pages-financial-stats.html | F-6~F-9 财务统计 | pages/finance/stats.vue |
| pages-sales-flow.html | S-1~S-10 销售流程 | pages/sale/*.vue |
| pages-sheets-modals.html | 通用 Sheet/Modal 模板 | components/layout/BSheet.vue, BModal.vue |
| pages-remaining.html | D-6~D-14 状态变更 | pages/dog/detail.vue 内嵌 |
| pages-pickers.html | G-1~G-8 选择器组件 | components/form/B*Selector.vue |
| pages-settings.html | M-1~M-21 设置页 | pages/profile/*.vue |
| pages-missing-forms.html | 缺失表单补全 | 按需创建 |
| pages-monitor-logs.html | R-19 观察日志 | 新建 |
| pages-r7-monitor.html | 快速监控模式 | 新建 |
| pages-weight-monitor.html | D-19 批量体重 | pages/health/batch-weight.vue |

---

### 15. 验收标准

#### 15.1 页面级验收

- [ ] **像素对比**：与 HTML 原型在 375px 宽度下对比，误差 ≤ 2px
- [ ] **颜色一致**：所有颜色引用 CSS 变量，无硬编码 hex
- [ ] **暗色模式**：切换后所有元素正确变色，无白色残留
- [ ] **交互效果**：按压缩放、过渡动画与设计系统一致
- [ ] **空状态**：无数据时显示设计稿中的空状态提示
- [ ] **加载状态**：请求中显示骨架屏
- [ ] **响应式**：320px ~ 428px 宽度范围内布局正常

#### 15.2 代码级验收

- [ ] **零硬编码**：grep 检查无 `#ea3e77` 等硬编码色值（tokens 文件除外）
- [ ] **组件复用**：相同 UI 模式使用相同组件，不重复实现
- [ ] **类型安全**：组件 Props 有 TypeScript 类型定义
- [ ] **注释规范**：组件头部注释说明用途，复杂逻辑有行内注释
- [ ] **样式隔离**：使用 scoped style，不污染全局
- [ ] **无冗余**：不重复定义 tokens 中已有的变量值

---

### 16. 开发排期

| Tier | 内容 | 输出 | 估时 |
|------|------|------|------|
| 0 | 设计系统基建 | tokens + mixins + 字体 + 主题切换 | 0.5 天 |
| 1 | 基础组件库（8 个） | 8 个可复用组件 | 1 天 |
| 2 | 布局 + 表单组件（12 个） | 12 个可复用组件 | 1.5 天 |
| 3 | 核心页面重构（4 页） | 首页 + 列表 + 详情 + 新建 | 2 天 |
| 4 | 表单页面（~15 页） | 繁育/健康/财务记录表单 | 2 天 |
| 5 | 剩余页面（~30 页） | 统计/销售/设置/协作/监控 | 3 天 |
| **合计** | | **110 个屏幕** | **~10 天** |

> 以上为 Claude Code 辅助开发估时，非人工估时。
