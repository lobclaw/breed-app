### 三、财务模块

> **MongoDB 适配说明：** 所有集合（collections）使用软删除（deleted_at 字段）。自动创建的费用记录（source_type=auto）在财务模块 UI 中为只读，不可编辑。

#### 3.1 核心设计：收支分开存储

收入和支出使用独立的集合，但在 APP 财务页面展示为统一的流水列表（收入红色、支出绿色；中式记账：红色=进账/吉利，绿色=出账）。

**支出文档 Expense**

```
{
  _id
  total_amount（总金额）
  category（分类）
  date（timestamp 毫秒数，默认今天）
  linked_cycle_id → BreedingCycle（选填，繁育过程费用）
  linked_litter_id → Litter（选填，窝/幼崽阶段费用）
  linked_dog_ids: [dog_id, ...]（关联犬只数组，选填）
  dam_name（冗余：种母名称，选填）
  dog_names: [string, ...]（冗余：关联犬只名称数组，选填）
  litter_number（冗余：窝号，选填）
  images（图片凭证，选填）
  notes（备注，选填）
  source_type: 'manual' | 'auto'（手动录入还是自动从繁育/健康记录同步）
  source_record_id（选填，来源记录ID）
  created_by → User
  created_at                        // timestamp 毫秒数，forceDefaultValue: $env.now
  updated_at                        // timestamp 毫秒数
  deleted_at（软删除标记，选填）      // timestamp 毫秒数，默认 null
  family_id → Family
}
```

> **注意：** 不再使用单独的关联表。犬只关联直接通过 `linked_dog_ids` 数组存储在 Expense 文档上。冗余字段（dam_name、dog_names、litter_number）用于列表展示时避免额外查询。

**四种关联方式（互斥，每笔费用只选一种）：**

| 关联方式 | 用途 | 示例 |
|---------|------|------|
| linked_cycle_id | 繁育过程费用（生产前） | 配种费、孕检费 |
| linked_litter_id | 窝级别费用（生产后） | 整窝幼犬奶粉 |
| linked_dog_ids | 犬只个体费用 | 成犬疫苗、个体医疗 |
| 无关联 | 共用开销 | 房租、狗粮、水电 |

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

#### 3.2 收入

**所有收入统一记录在 incomes 集合中（详见「五、收入模块」），SaleRecord 不再参与财务计算。**

**财务页面展示统一流水时：** 查询 incomes 表（收入，红色）+ Expense 表（支出，绿色），按日期合并排序。

**月度/年度统计时：** 总收入 = sum(incomes.amount)。

#### 3.3 统计报表

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

**统一流水展示：** 合并 incomes（红色）+ expenses（绿色），按 date 排序。

**每只幼崽均摊成本：** 窝直接成本 / 存活幼崽数 = 平均每只成本。定价参考。存活幼崽数为 0 时不计算均摊（显示「无存活幼崽」），窝成本全部归入种母投资回报。

### 四、销售模块

#### 4.1 销售记录 SaleRecord

```
{
  _id
  dog_id → Dog
  dog_name（冗余：犬只名称，用于列表展示避免联表查询）
  status: 待售/已预定/已成交/已退款/定金取消
  floor_price（底价）
  deposit_amount（定金金额，选填）
  deposit_date（定金日期，timestamp 毫秒数，选填）
  agreed_price（预定时谈好的价格，选填）
  received_amount（到手价，已成交时必填）
  seller_agent_id → Agent（代理人，选填）
  platform（平台，选填）
  date（成交日期，timestamp 毫秒数，选填，已成交时必填）
  delivery_date（交付日期，timestamp 毫秒数，选填）
  buyer_info（买家信息，选填）
  refund_amount（退款金额，选填）
  refund_reason（退款原因，选填）
  refund_date（退款日期，timestamp 毫秒数，选填）
  deposit_kept_amount（定金取消时保留的金额，选填）
  notes
  created_by → User
  created_at                        // timestamp 毫秒数，forceDefaultValue: $env.now
  updated_at                        // timestamp 毫秒数
  deleted_at（软删除标记，选填）      // timestamp 毫秒数，默认 null
  family_id → Family
}
```

#### 4.2 销售三阶段流程

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

#### 4.3 平台预设选项

按此顺序排列：线下、微信、小红书、抖音、快手、闲鱼

支持用户自定义添加新平台。

#### 4.4 退款处理

在销售记录上增加「退款」操作，原始记录保留：

- 全额退款：幼崽状态从「已售」回退为「待售」或「在养」，该笔收入归零
- 部分退款：幼崽状态不变，实际收入 = 到手价 - 退款金额
- 退款原因选填
- 窝利润和种母投资回报自动重新计算

#### 4.5 定金取消

| 场景 | 处理 | 幼崽状态 |
|------|------|---------|
| 买家取消，定金不退（你留下） | 定金保留金额计为收入 | 回到「待售」 |
| 买家取消，定金退还 | 无收入 | 回到「待售」 |
| 买家取消，定金部分退还 | 实际保留金额计为收入 | 回到「待售」 |

> **退款/定金取消后的 SaleRecord 为终态**，不可重新进入「已预定」或「已成交」。如需重新销售该犬，创建新的 SaleRecord。一只犬可以有多条 SaleRecord（历史记录）。

#### 4.6 代理人/中间人管理

**Agent 集合**（独立集合，不嵌入其他文档）

```
{
  _id
  name
  contact_info（联系方式，选填）
  family_id → Family
  created_at                        // timestamp 毫秒数，forceDefaultValue: $env.now
  updated_at                        // timestamp 毫秒数
  deleted_at（软删除标记，选填）      // timestamp 毫秒数，默认 null
}
```

- 简单联系人列表
- SaleRecord.seller_agent_id 关联代理人
- 代理人详情页展示：经手中的交易、待收款汇总、历史已完成交易
- 代理人列表同时作为销售记录「卖出人」字段的预设选项
- 入口：销售记录的「卖出人」字段中管理，或「我的」页面「合作代理人」入口

### 五、收入模块

#### 5.1 收入记录 Income

所有收入统一记录在 incomes 集合中，SaleRecord 不再参与财务计算。

```
{
  _id
  dog_id → Dog（选填）
  dog_name（冗余）
  type: 销售 / 定金保留 / 领养 / 退款 / 其他
  amount（金额，退款为负数）
  date（timestamp 毫秒数）
  source_sale_id → SaleRecord（选填，来源销售记录）
  notes
  family_id → Family
  created_by → User
  created_at                        // timestamp 毫秒数，forceDefaultValue: $env.now
  updated_at                        // timestamp 毫秒数
  deleted_at（软删除标记，选填）      // timestamp 毫秒数，默认 null
}
```

#### 5.2 自动生成 Income 的触发规则

| 触发事件 | 云对象操作 |
|---------|-----------|
| SaleRecord 进入「已成交」 | 创建 Income(type=销售, amount=received_amount) |
| SaleRecord 退款 | 创建 Income(type=退款, amount=-refund_amount) |
| SaleRecord 定金取消（保留） | 创建 Income(type=定金保留, amount=deposit_kept_amount) |
| 犬只领养（有费用） | 创建 Income(type=领养, amount=领养费) |
| SaleRecord 编辑 received_amount | 更新对应 Income.amount |
| SaleRecord 编辑 deposit_kept_amount | 更新对应 Income.amount |
| SaleRecord 编辑 refund_amount | 更新对应 Income.amount |
