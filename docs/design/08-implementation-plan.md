# 八、Phase 1 实现计划

> **生成时间：** 2026-03-26（工程审查后）
> **依据：** 设计文档 01-07 + 工程审查确认的 9 项架构决策

## 1. 总览

### 1.1 Phase 1 范围（路径 A，四批交付）

| 批次 | 内容 | 核心集合 | 预估页面数 |
|------|------|---------|-----------|
| 第一批 | 犬只档案 + 繁育流程 + 基础提醒 | dogs, breeding_cycles, breeding_records, litters, tasks | ~20 |
| 第二批 | 财务模块 + 销售流程 | expenses, incomes, sale_records | ~12 |
| 第三批 | 首页智能卡片 + 自动化逻辑 | tasks（增强） | ~8 |
| 第四批 | 协作 + 用药方案库 + 代理人 + 批量体重 | families（增强）, medication_protocols, agents, dog_weights | ~14 |

### 1.2 开发原则

- **每步先后端再前端：** 云对象 + vitest 测试 → 前端页面
- **测试覆盖：** 云对象目标 80%+ 覆盖率
- **数据隔离：** 所有操作通过 `_before` 拦截器注入 `familyId`
- **增量交付：** 每批完成后可独立使用

---

## 2. 基础设施（所有批次前置）

### 2.1 认证 + 家庭初始化

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

## 3. 第一批：犬只档案 + 繁育流程 + 基础提醒

### 3.1 犬只档案

**云对象：dog-service**

| 方法 | 说明 | 涉及集合 | 复杂度 |
|------|------|---------|--------|
| `getDogListWithStatus()` | 犬只列表 + 实时派生状态 | dogs + breeding_cycles + health_records + medication_tasks | 高 |
| `getDogDetail(dogId)` | 犬只详情 + 完整状态 | dogs + 关联集合 | 中 |
| `createDog(data)` | 创建犬只（含外部种公） | dogs | 低 |
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
   b. health_records where type=illness and details.is_recovered=false → 生病中
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

### 3.2 繁育流程

**云对象：breeding-service**

| 方法 | 说明 | 涉及集合 | 复杂度 |
|------|------|---------|--------|
| `addBreedingRecord(data)` | 录入繁育记录（8种type） | breeding_records + breeding_cycles + tasks + expenses | 高 |
| `getCycleDetail(cycleId)` | 周期详情 + 所有子记录 | breeding_cycles + breeding_records + litters | 中 |
| `getCycleHistory(damId)` | 某母犬的繁育历史 | breeding_cycles + breeding_records | 中 |
| `closeCycle(cycleId, reason)` | 手动关闭周期（放弃/失败） | breeding_cycles + tasks | 中 |
| `addBirthRecord(data)` | 生产记录（步骤式向导） | breeding_records + litters + dogs(幼崽) + tasks + expenses | 高 |
| `getLitterDetail(litterId)` | 窝详情 + 幼崽列表 | litters + dogs | 低 |
| `addPuppyToLitter(litterId, data)` | 后续添加幼崽 | dogs + litters | 低 |
| `confirmWeaning(litterId)` | 确认断奶 | litters + tasks | 低 |

**addBreedingRecord 核心逻辑：**

```
1. 校验 type 特有字段（云对象层校验）
2. 如果无进行中周期 → 自动创建 breeding_cycle（发情/卵泡/配种触发）
3. 创建 breeding_record
4. 状态转换：配种 → cycle.status=怀孕中
5. 生成 tasks（孕检提醒/预产期提醒/etc）
6. 如有 cost → 创建 expense 记录
7. 写入后校验（三层保障第二层）
```

**addBirthRecord 核心逻辑：**

```
1. 创建 breeding_record (type=birth)
2. 创建 litter
3. 逐只创建幼崽 dogs（role=幼崽, origin_litter_id=litterId）
4. cycle.status → 已生产
5. 生成 tasks：首次驱虫(+14d)、首次疫苗(+42d)、断奶确认(+45d)
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

### 3.3 健康管理

**云对象：health-service**

| 方法 | 说明 | 涉及集合 | 复杂度 |
|------|------|---------|--------|
| `addHealthRecord(data)` | 录入健康记录（vaccination/deworming/illness） | health_records + tasks + expenses | 中 |
| `getHealthHistory(dogId, type?)` | 某犬的健康记录 | health_records | 低 |
| `startMedication(data)` | 开始连续用药 | medication_tasks + tasks | 中 |
| `completeDailyMedication(taskId)` | 标记今日用药完成 | medication_tasks + tasks | 低 |
| `endMedication(medicationTaskId)` | 提前结束用药 | medication_tasks + tasks | 低 |

**前端页面：**

| 页面 | 路径 | 说明 |
|------|------|------|
| 录入健康记录 | pages/record/health | Schema 驱动表单 |
| 健康记录列表 | 犬只详情 Tab 内 | 嵌入犬只详情页 |
| 开始用药 | pages/health/medication | 用药表单 |

### 3.4 任务系统（基础版）

**云对象：task-service**

| 方法 | 说明 | 涉及集合 | 复杂度 |
|------|------|---------|--------|
| `getHomeCards(date?)` | 获取首页卡片数据（含合并算法） | tasks + dogs | 高 |
| `completeTask(taskId)` | 标记任务完成 | tasks | 低 |
| `postponeTask(taskId, newDate, reason?)` | 推迟任务 | tasks | 低 |
| `cancelTasksByCycle(cycleId)` | 周期关闭时批量取消 | tasks | 低 |
| `_timing_dailyAudit()` | 每日审计（三层保障第三层） | tasks + breeding_records + health_records + medication_tasks | 高 |
| `_timing_autoCloseCycles()` | 自动关闭过期发情周期 | breeding_cycles + tasks | 中 |

**getHomeCards 服务端合并算法：**

```
1. 查询 tasks where status=pending and due_date in range
2. 按 priority 分组：overdue / today / upcoming
3. 合并规则：
   a. 同 litter_id → 窝级别合并
   b. 同 type + 同 due_date + 3只以上 → 批量合并
   c. 同 dog_id → 单犬多任务合并
   d. 其余 → 个体卡片
4. 排序：overdue(红) → today(黄) → upcoming(蓝)
5. 截断：每区域最多 8 张卡片
```

**前端页面（第一批简化版）：**

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | pages/home/index | 三区设计（简化版，第三批完善） |

> **第一批首页为简化版：** 只展示任务列表（无智能卡片合并），第三批再实现完整卡片系统。

### 3.5 第一批开发顺序

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

## 4. 第二批：财务模块 + 销售流程

### 4.1 财务管理

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

### 4.2 销售流程

**cloud对象：finance-service（扩展）**

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
| 录入支出 | pages/finance/expense-add | 表单 |
| 录入收入 | pages/finance/income-add | 表单 |
| 销售列表 | pages/sale/list | 三阶段状态筛选 |
| 销售详情 | pages/sale/detail | 流程进度 + 操作按钮 |
| 创建销售 | pages/sale/create | 选犬 + 填信息 |

### 4.3 第二批开发顺序

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

## 5. 第三批：首页智能卡片 + 自动化

### 5.1 完善首页

| 任务 | 说明 |
|------|------|
| Zone 1 状态摘要栏 | 需处理/今日/本周计数 + 点击滚动 |
| 7 天预览条 | WeekStrip 组件 + 点击切换日期 |
| 月历展开 | 点击月份标题展开完整月历 |
| 智能卡片系统 | 4 种卡片类型 + 合并算法 |
| 卡片内操作 | BottomSheet 快速完成 |
| 逾期处理 | 推迟 + 原因 + 视觉升级 |

**前端组件：**

| 组件 | 路径 |
|------|------|
| SmartCard（壳） | components/smart-card/SmartCard.vue |
| DogCard（个体） | components/smart-card/DogCard.vue |
| CareGroupCard（群组） | components/smart-card/CareGroupCard.vue |
| BatchCard（批量） | components/smart-card/BatchCard.vue |
| MedicationCard（用药） | components/smart-card/MedicationCard.vue |
| WeekStrip | components/week-strip/WeekStrip.vue |

### 5.2 FAB Action Sheet

| 任务 | 说明 |
|------|------|
| FAB 按钮 | 底部导航中间 "+" |
| Action Sheet | 智能推荐 3 + 常用 4 + 全部入口 |
| R-1 全部记录类型 | 15 种记录类型图标网格 |

### 5.3 第三批开发顺序

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

## 6. 第四批：协作 + 辅助功能

### 6.1 协作

**云对象：family-service（扩展）**

| 方法 | 说明 |
|------|------|
| `generateInviteLink()` | 生成邀请链接 |
| `joinFamily(inviteCode)` | 通过邀请码加入家庭 |
| `updateMemberRole(userId, role)` | 调整成员角色 |
| `removeMember(userId)` | 移除成员 |
| `getMemberList()` | 成员列表 |

### 6.2 用药方案库 + 代理人

**clientDB 直读直写（简单 CRUD）：**
- medication_protocols：方案名称/药品列表/默认疗程
- agents：代理人姓名/联系方式/备注

### 6.3 批量体重录入

**云对象：health-service（扩展）**

| 方法 | 说明 |
|------|------|
| `batchAddWeights(litterId, weights[])` | 批量录入一窝幼崽体重 |
| `getWeightHistory(dogId)` | 体重历史 + 增减趋势 |

### 6.4 推送通知

| 任务 | 说明 |
|------|------|
| UniPush 2.0 集成 | 厂商通道配置 |
| 晨间摘要 | _timing 定时推送（07:00 默认） |
| 即时推送 | 逾期任务 / 紧急提醒 |

### 6.5 第四批开发顺序

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

## 7. 云对象 API 完整清单

| 云对象 | 方法数 | 集中在 |
|--------|--------|--------|
| dog-service | 9 | 第一批 |
| breeding-service | 8 | 第一批 |
| health-service | 7 | 第一批 + 第四批 |
| task-service | 6 | 第一批 + 第三批 |
| finance-service | 12 | 第二批 |
| family-service | 8 | 基础设施 + 第四批 |
| **总计** | **50** | |

---

## 8. 测试策略

### 8.1 vitest 测试重点

| 优先级 | 测试目标 | 示例 |
|--------|---------|------|
| P0 | 繁育状态机转换 | 配种→怀孕中、生产→已生产、异常转换阻止 |
| P0 | 任务预生成 | 配种→生成孕检+预产期任务、疫苗→生成下次任务 |
| P0 | 销售状态流转 | 意向→收定金→完成、取消→退款 |
| P1 | 犬只状态派生 | 多状态叠加、边界条件 |
| P1 | 卡片合并算法 | 窝级别>批量>个体优先级 |
| P1 | 财务统计 | 窝利润、种母ROI、月度汇总 |
| P2 | 权限检查 | 协助者不能访问财务、不能创建繁育记录 |
| P2 | 软删除 + 恢复 | 删除后查询不可见、恢复后数据完整 |

### 8.2 测试文件结构

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

## 9. 每日审计 + 定时任务

### 9.1 定时任务清单

| 任务 | 时间 | 云对象 | 方法 |
|------|------|--------|------|
| 每日审计 | 02:00 UTC+8 | task-service | `_timing_dailyAudit()` |
| 自动关闭过期发情 | 02:00 UTC+8 | task-service | `_timing_autoCloseCycles()` |
| 晨间摘要推送 | 07:00 UTC+8（可配置） | task-service | `_timing_morningSummary()` |
| 过期任务清理 | 03:00 UTC+8 | task-service | `_timing_cleanupOldTasks()` |

### 9.2 每日审计检查项

1. **有记录无任务：** 扫描最近 N 天的 breeding_records/health_records，检查应生成但缺失的 task
2. **护理规则无任务：** 扫描活跃护理规则（care_rules），检查对应状态的犬只是否都有 pending task
3. **过期发情：** breeding_cycle.status=发情中 且 >21 天无配种 → 自动关闭
4. **任务 priority 更新：** pending 且 due_date < 今天 → priority 改为 overdue

---

## 10. 关键风险 + 缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 事务 10 文档限制 | 大窝生产记录（8+幼崽）超限 | 分批写入 + 写入后校验 |
| 冗余字段写放大（改名） | 改名需更新 6 个集合 | 低频操作，顺序写入 + 审计兜底 |
| getDogListWithStatus N+3 查询 | 犬只多时性能 | 用集合级查询（非逐犬），30-50 犬毫秒级 |
| 首页卡片合并复杂度 | 逻辑 bug 导致重复/遗漏 | 独立单元测试覆盖所有合并场景 |
| UniCloud 免费额度 | 开发期间高频调试消耗 RU | 开发环境用 mock，联调时注意 |

---

## 11. 里程碑检查点

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
