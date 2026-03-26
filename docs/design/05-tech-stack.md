# 五、技术选型

## 5.1 技术栈

| 层级 | 选择 | 说明 |
|------|------|------|
| 前端框架 | UniApp（Vue 3 + TypeScript） | 传统 uni-app，不用 uni-app x |
| 状态管理 | Pinia + Composables | Pinia 管全局状态，Composables 管页面局部状态 |
| 后端 | UniCloud 云对象（支付宝云） | 所有写操作走云对象，简单读取走 clientDB/JQL |
| 数据库 | UniCloud MongoDB | 支付宝云版，MongoDB 4.0 兼容 |
| 认证 | uni-id | 内置用户体系、Token 管理、RBAC |
| 推送 | UniPush 2.0 | 基于个推，集成国内厂商通道（华为/小米/OPPO/vivo） |
| 文件存储 | UniCloud 云存储 | 图片压缩后上传，CDN 加速 |
| 日期处理 | dayjs | 3KB，轻量 |
| UI 基础 | uni-ui（按需引入） | 仅用 uni-popup、uni-icons 等基础组件 |
| 表单校验 | async-validator | 无 DOM 依赖，跨端适用 |
| 开发工具 | HBuilderX + Claude Code | HBuilderX 管部署，Claude Code 写代码 |

## 5.2 选型决策理由

### 为什么选 UniCloud 而不是自建服务器

- **成本**：免费额度覆盖自用场景（3 用户 / 30-50 犬 = 0 元/月）
- **零运维**：不用管服务器安全更新、备份、SSL、扩容
- **国内服务器**：支付宝云数据在中国大陆，低延迟
- **clientDB**：前端直查数据库，简单 CRUD 开发效率极高
- **集成生态**：uni-id（认证）、UniPush（推送）、云存储开箱即用

### 为什么选 MongoDB 而不是 PostgreSQL

- UniCloud 只支持 MongoDB，不支持 PostgreSQL/MySQL
- 通过数据模型优化（冗余展示字段、tasks 预生成、实时聚合查询）弥补 MongoDB 的关系查询短板
- 30-50 犬的数据量极小，MongoDB 的聚合管道完全够用

### 为什么选 UniApp 而不是 React Native

- UniCloud 的 clientDB/JQL 只和 UniApp 深度集成
- 选了 UniCloud 就等于选了 UniApp
- 未来如需微信小程序，UniApp 可同代码库编译（虽然 V1 不做）
- UniPush 对国内安卓厂商通道的集成是原生优势

### 为什么不用 uni-app x

- uni-app x 生态尚年轻，插件兼容性不足
- 犬舍管理 APP 不涉及复杂动画或大列表性能瓶颈
- WebView 渲染在现代手机上完全满足需求
- 保持良好的组件抽象，未来迁移到 uni-app x 成本低

## 5.3 费用估算

### 免费额度（支付宝云开发者版）

| 资源 | 免费额度 | 自用场景使用率 |
|------|---------|-------------|
| 云函数 GBs | 1,000 | <10% |
| 云函数调用 | 1.5 万次/月 | ~10% |
| 数据库读 RU | 500/天 | ~40-50%（优化后） |
| 数据库写 WU | 300/天 | ~10% |
| 数据库容量 | 2 GB | <5% |
| 云存储 | 5 GB | 20-40% |
| CDN 流量 | 1 GB/月 | 可控 |

### 各规模费用

| 用户数 | 月费 |
|--------|------|
| 3（自用） | 0 元 |
| 10 | ~0.1 元 |
| 100 | ~1.5 元 |
| 1,000 | ~25 元 |
| 10,000 | ~120 元 |

### 超出 300+ 用户时的备选

自建 VPS + PocketBase/Supabase 的固定成本（~8-33 元/月）在 300+ 用户时比 UniCloud 按量计费更便宜。届时可评估迁移。

## 5.4 数据库集合设计（MongoDB 适配版）

### 集合清单（14 个）

```
核心集合：
  dogs                 犬只档案
  breeding_cycles      繁育周期
  litters              窝
  breeding_records     所有繁育子记录（type 区分）
  health_records       所有健康记录（type 区分）
  medication_tasks     进行中的用药任务

首页/提醒：
  tasks                预生成的待办/提醒

财务集合：
  expenses             所有支出（含冗余上下文）
  incomes              所有收入（销售/定金保留/领养/退款）
  sale_records         销售记录（管流程，不管钱）

辅助：
  dog_weights          体重历史
  medication_protocols 用药方案库
  agents               代理人
  families             家庭（嵌入 members 数组 + care_rules 数组）

+ uni-id 自带的 users 集合
```

### MongoDB 适配策略

#### 策略 1：合并同类集合

- **breeding_records**：8 种繁育子记录合并为一个集合，用 `type` 字段区分（heat/follicle_check/mating/pregnancy_check/prenatal_check/pre_labor/birth/abnormal_termination）
- **health_records**：疫苗/驱虫/疾病合并为一个集合，用 `type` 字段区分（vaccination/deworming/illness）
- 公共字段在顶层，类型特有字段放 `details` 嵌套对象

```javascript
// breeding_records 示例
{
  _id, cycle_id, dog_id, type, date, cost, notes, family_id,
  details: {
    // type=mating: { sire_id, method, mating_number, expected_due_date, ... }
    // type=follicle_check: { left_count, left_size, right_count, right_size, result }
    // type=pre_labor: { temperature, nesting_behavior, ... }
  }
}
```

#### 策略 2：冗余展示字段，避免 JOIN

| 冗余字段 | 存在于 | 理由 |
|---------|--------|------|
| dog_name | tasks, sale_records, incomes | 首页/列表高频展示 |
| dog_names（数组） | expenses | 列表高频展示（多犬费用） |
| dam_name, sire_name | breeding_cycles, litters | 繁育历史展示 |
| dam_name | expenses（仅 linked_cycle_id/linked_litter_id 关联时） | 财务列表展示母犬名 |
| litter_number | expenses | 财务列表展示 |

犬只改名时（极低频），云函数批量更新所有冗余字段。

#### 策略 3：实时查询计算，不预存统计值

- **不预计算** litter.stats（窝利润）、dog.stats（种母ROI）
- 查看时通过聚合管道实时计算（30-50 犬规模毫秒级完成）
- 财务统计从 Income + Expense 两个集合聚合，不再从 SaleRecord 读取金额
- 唯一的缓存字段：`Dog.latest_weight`
- 理由：预计算引入的一致性风险 > 性能收益（在此规模下）

#### 策略 4：预生成 tasks 集合优化首页

- 录入记录时自动创建对应的 task（疫苗→下次疫苗 task，配种→孕检 task + 预产期 task）
- 首页加载 = 1 次查询 tasks 集合
- 已完成 task 超过 30 天定期清理

#### 策略 5：状态实时推导，不存储

- 犬只的当前状态（发情中/怀孕中/哺乳中/生病中/用药中）不存储在 dog 文档上
- 每次需要时从 breeding_cycles/health_records/medication_tasks 实时查询推导
- 30-50 犬规模下，3 个并行查询毫秒级完成

#### 策略 6：多犬费用用数组存储

```javascript
// expenses 文档
{
  total_amount: 300,
  linked_dog_ids: ['dog_id_1', 'dog_id_2'],  // 替代关联表
  dog_names: ['小白', '豆豆'],                 // 冗余展示用
  // 分摊金额 = total_amount / linked_dog_ids.length（动态计算）
}
```

### 嵌入 vs 独立集合决策

| 数据 | 决策 | 理由 |
|------|------|------|
| dog_weights | **独立集合** | 避免 dog 文档膨胀增加 RU 消耗 |
| family_members | **嵌入 families** | 最多 5-10 人，数据极小 |
| care_group_rules | **嵌入 families** | 最多 10 条，低频变更 |

### 索引设计

```
tasks:        { family_id: 1, status: 1, due_date: 1 }
dogs:         { family_id: 1, disposition: 1, role: 1 }
breeding_records: { cycle_id: 1, type: 1, date: 1 }
breeding_cycles:  { dam_id: 1, status: 1, created_at: -1 }
health_records:   { dog_id: 1, type: 1, date: -1 }
expenses:     { family_id: 1, date: -1 }
              { linked_cycle_id: 1 }
              { linked_litter_id: 1 }
              { linked_dog_ids: 1 }
incomes:      { family_id: 1, date: -1 }
              { dog_id: 1 }
              { source_sale_id: 1 }
medication_tasks: { dog_id: 1, status: 1 }
litters:      { dam_id: 1, birth_date: -1 }
dog_weights:  { dog_id: 1, measured_at: -1 }
sale_records: { family_id: 1, status: 1 }
              { dog_id: 1 }
agents:       { family_id: 1 }
medication_protocols: { family_id: 1 }
```

### Schema 验证策略

合并集合（breeding_records、health_records）中不同 type 的记录有不同的必填字段，但 UniCloud DB Schema 只能在集合级别定义校验规则，无法按 type 条件校验。

**两层验证：**

| 层级 | 负责什么 | 在哪里 |
|------|---------|--------|
| DB Schema | 公共字段校验（_id, type, dog_id, date, family_id 等必填） | UniCloud 控制台配置 |
| 云对象 | 类型特有字段校验（如 mating 必须有 sire_id，follicle_check 必须有 left_count 等） | 云对象代码中 |

**DB Schema 示例（breeding_records）：**
```json
{
  "bsonType": "object",
  "required": ["type", "cycle_id", "dog_id", "date", "family_id"],
  "properties": {
    "type": { "bsonType": "string", "enum": ["heat","follicle_check","mating","pregnancy_check","prenatal_check","pre_labor","birth","abnormal_termination"] },
    "cycle_id": { "bsonType": "string" },
    "dog_id": { "bsonType": "string" },
    "date": { "bsonType": "number" },
    "cost": { "bsonType": "number" },
    "notes": { "bsonType": "string" },
    "details": { "bsonType": "object" },
    "family_id": { "bsonType": "string" }
  }
}
```

**云对象中的类型校验：**
```javascript
// 按 type 校验 details 中的必填字段
if (data.type === 'mating' && !data.details?.sire_id) {
  throw new Error('配种记录必须选择种公')
}
if (data.type === 'follicle_check' && data.details?.left_count === undefined) {
  throw new Error('卵泡检查必须填写左侧数量')
}
```

**原则：DB Schema 管结构，云对象管业务。**

> **DB Schema 仅在 JQL 操作时生效。** 云对象中使用 `uniCloud.database()` 的传统 API 操作不受 Schema 权限约束。如需在云对象中也触发 Schema 校验，使用 `uniCloud.databaseForJQL()`。

## 5.5 架构模式

### 云对象注意事项

> **云对象方法必须使用普通函数定义，禁止箭头函数。** 箭头函数会导致 `this` 指向不正确，无法使用 `this.getUniIdToken()` 等内置方法。

> **注意：云对象的 `_timing` 定时方法不触发 `_before`/`_after` 拦截器。** 晨间摘要推送和每日审计等定时任务不能依赖拦截器中的鉴权和初始化逻辑，需要在 `_timing` 方法内部独立处理。

### JQL/clientDB vs 云对象的分工

| 操作类型 | 走哪条路 | 理由 |
|---------|---------|------|
| 犬只列表查询/筛选 | clientDB (JQL) | 简单读取，直接前端查 |
| 犬只档案基础编辑 | clientDB | 简单更新 |
| 体重记录查询 | clientDB | 简单读取 |
| 用药方案库 CRUD | clientDB | 简单 CRUD |
| 代理人 CRUD | clientDB | 简单 CRUD |
| 收入记录查询 | clientDB (JQL) | 简单读取 |

> **clientDB 写操作限制：** 不支持 `set()` 方法、`db.command.inc()` 等更新操作符、`{'a.b.c': 1}` 点号路径更新。任何需要原子操作或点号路径更新的场景必须走云对象。

| 录入繁育记录 | **云对象** | 需要创建/更新 BreedingCycle + 生成 Task + 创建 Expense |
| 生产记录 | **云对象** | 创建 Litter + 批量创建幼崽 + 生成 Task |
| 录入疫苗/驱虫 | **云对象** | 需要生成下次提醒 Task |
| 标记任务完成 | **云对象** | 更新 Task + 可能更新犬只状态 |
| 销售状态流转 | **云对象** | 更新 SaleRecord + Dog.disposition + 生成收入 |
| 财务统计 | **云对象** | 跨集合聚合计算 |
| 首页数据 | **云对象** | 一个 getHomeData() 返回全部首页数据 |
| 退休/死亡 | **云对象** | 级联取消提醒、退出护理群组 |

### 事务限制（UniCloud 支付宝云）

- 事务内只能进行**单记录操作**（`doc().update()`），不能用 `where().update()` 批量更新
- 事务内不能使用数组批量 `add([])`，只能逐条 `add({})`
- 事务必须在 **10 秒内**完成
- 一个事务最多操作约 **10 个文档**

影响：
- 「创建 Litter + 批量创建幼崽 + 生成 Task」需要逐条 add，注意 10 秒超时
- 批量操作（如 12 只成犬批量驱虫）如果超过 10 个文档，需要分批处理或不使用事务
- 不使用事务时，通过「写入后校验 + 每日审计」保证数据一致性

### 任务生成三层防护

1. **写入时同步生成**：云对象中录入记录后直接创建 task
2. **写入后校验**：创建完成后立刻查询验证 task 存在，不存在则补生成
3. **每日凌晨巡检**：定时云函数扫描所有「应有提醒但无提醒」的记录，自动补生成

### 日期约定

所有日期使用 timestamp 毫秒数（Number 类型）存储，时区统一北京时间（UTC+8）。

### 软删除

支持软删除的集合增加 `deleted_at` 字段（默认 null），删除操作标记时间戳而非真删。查询时默认过滤 `deleted_at == null`。提供 30 天回收站功能。具体哪些集合支持软删除见 01 文档软删除范围矩阵。

### 数据备份

每周定时云函数导出全量 JSON 到云存储 + 可下载到本地设备。

### 推送策略

- V1：UniPush 系统级推送（APP 端）
- 后续可选：企业微信应用消息（0 成本，补充推送渠道）

### 认证要求

- **uni-id-pages**：提供预置的登录/注册 UI（支持手机号+验证码、用户名密码、微信登录等），可直接使用，无需从零开发认证页面
- **Apple 登录**：如果 App 支持任何第三方登录（微信、一键登录等），iOS App Store 审核**强制要求**同时提供 Apple 登录。V1 上架 iOS 时必须集成
- **Token 管理**：uni-id 自动处理 Token 的存储、携带、续期，前端无需手动管理

### 打包发布注意事项

- **开发工具**：uniCloud 项目仅支持 HBuilderX 开发，不支持 VS Code 等其他 IDE
- **Android 签名**：签名证书一旦确定不可更换，否则用户无法升级。首次打包时认真配置
- **iOS 真机调试**：2022 年 9 月起必须使用自定义基座，标准基座不可用于真机调试
- **云打包**：推荐使用云打包（无需本地 Android Studio / Xcode 环境），适合快速测试和发布

## 5.6 前端架构

### 项目结构

```
src/
├── pages/                    # 页面
│   ├── home/index.vue        # 首页（三区设计）
│   ├── dog/detail.vue        # 犬只详情
│   ├── dog/list.vue          # 档案列表
│   ├── breeding/cycle.vue    # 繁育周期
│   ├── breeding/litter.vue   # 窝详情
│   ├── record/add.vue        # 通用记录添加（Schema 驱动）
│   ├── finance/index.vue     # 财务
│   └── profile/index.vue     # 我的
├── components/
│   ├── smart-card/           # 智能卡片（壳 + 4 种内容组件）
│   ├── bottom-sheet/         # 底部弹出表单
│   ├── dynamic-form/         # Schema 驱动的动态表单
│   ├── week-strip/           # 7 天预览条
│   └── common/               # 通用组件（DogAvatar, DogPicker 等）
├── stores/                   # Pinia Store
├── composables/              # 组合式函数
├── form-schemas/             # 表单 Schema 定义
├── types/                    # TypeScript 类型
└── utils/                    # 工具函数（dayjs 封装、状态文案等）
```

### 性能优化

- 客户端缓存：犬只列表等低变频数据缓存到 uni.setStorageSync
- 字段投影：查询时只返回需要的字段，减少 RU 消耗
- 图片压缩：上传前压缩到 30-50KB 缩略图
- 分页加载：列表首屏 10 条，滚动加载更多
- 首页数据缓存 5 分钟，避免重复查询

### 离线支持

本地优先写入 + 后台队列同步：
- 写入操作先存本地（uni.setStorageSync）
- 检测到网络后上传到 UniCloud
- 冲突策略：Last Write Wins + 时间戳

## 5.7 图片上传规范

| 参数 | 值 |
|------|---|
| 最大单张大小 | 5 MB（上传前客户端压缩） |
| 支持格式 | JPG, PNG, HEIC（iOS 自动转 JPG） |
| 压缩策略 | 上传前压缩至最大 1920px 宽，质量 80% |
| 缩略图 | 客户端生成 200px 缩略图，用于列表展示 |
| 存储路径 | `/{family_id}/images/{collection}/{record_id}/{timestamp}.jpg` |
| CDN | UniCloud 云存储自带 CDN 加速 |
| 删除策略 | 图片随记录软删除，30天回收站过期后永久删除 |

**上传错误处理：**
- 网络失败 → 显示重试按钮，保留本地缓存
- 文件过大 → 提示「图片过大，已自动压缩」（客户端自动压缩后重试）
- 存储配额不足 → 提示「云存储空间不足」+ 引导清理或升级

**配额预估：**
- 每条记录平均 1-2 张图片，压缩后约 200-500KB
- 30-50 只犬 × 平均每年 20 条记录 × 2 张 × 400KB ≈ 500MB/年
- 5GB 免费额度可支撑约 10 年使用
