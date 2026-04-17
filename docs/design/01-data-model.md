# 犬类繁育管理应用：概述与数据模型

## 1. 产品范围

### 核心定位

个人使用的犬类繁育管理工具，当前服务 30-50 只马尔济斯犬，重点解决：

1. 繁育节点容易遗漏
2. 疫苗/驱虫/疾病/用药容易分散
3. 成本、收入、销售链路不够清楚

### V1 范围

- 犬只档案
- 繁育流程与窝管理
- 健康记录、疾病、连续用药
- 首页任务与提醒
- 财务、收入、销售
- 家庭协作

### V1 不做

- 普通养宠用户模式
- 会员/广告/增值服务
- 微信小程序
- AI 助手
- 电子合同、血统关系图、成长相册
- 多家庭复杂租户模型

## 2. 全局数据规则

### 日期

- 所有业务日期与系统时间统一使用 timestamp 毫秒数（`Number`）
- 业务判断统一按北京时间（UTC+8）
- 前端负责展示格式化

### 软删除

只对“需要撤销恢复”的集合启用 `deleted_at`：

| 集合 | 软删除 |
|------|--------|
| `dogs` | 是 |
| `expenses` | 是 |
| `incomes` | 是 |
| `sale_records` | 是 |
| `agents` | 是 |
| `medication_protocols` | 是 |

其余业务历史集合保留真实记录，不做软删除。

### 事实源原则

- 犬只当前状态实时推导，不预存
- 首页提醒由 `tasks` 和 `medication_tasks` 提供
- 健康记录与任务分离：记录是真实发生，任务是待处理提醒
- 统计值实时查询计算，不做预聚合

## 3. 核心集合

### 3.1 `dogs`

用途：犬只基础档案与经营身份。

关键字段：

- `name`
- `gender`
- `role`：`种狗 / 幼崽 / 外部种公`
- `disposition`：`在养 / 待售 / 已预定 / 已售 / 已领养 / 已赠送 / 自留 / 已退休 / 已故`
- `breed`
- `birth_date`
- `purchase_date`
- `purchase_price`
- `latest_weight`
- `origin_litter_id`
- `owner_info`
- `disposition_date`
- `disposition_notes`
- `family_id`
- `deleted_at`

规则：

- `role` 表示经营身份，`disposition` 表示当前去向
- 外部种公与普通犬只共用同一集合，通过 `role=外部种公` 区分
- 幼崽升级为种狗时保留 `origin_litter_id`
- 已退休仍在健康管理范围内，不再参与繁育
- 已故犬只保留档案与历史数据，未完成任务自动取消

### 3.2 `breeding_cycles`

用途：一条母犬一次繁育主流程。

关键字段：

- `dam_id` / `dam_name`
- `sire_id` / `sire_name`
- `status`
- `family_id`
- `created_at` / `updated_at`

状态：

- `发情中`
- `怀孕中`
- `已生产`
- `失败`
- `放弃`

规则：

- 录入发情、卵泡、配种时，如无进行中周期则自动创建
- 配种后直接进入 `怀孕中`
- 生产后进入 `已生产`
- 未配种超时或手动关闭进入 `放弃`
- 未怀孕、流产、医疗终止进入 `失败`

### 3.3 `litters`

用途：一窝幼崽与其母犬、父犬、出生信息。

关键字段：

- `cycle_id`
- `dam_id` / `dam_name`
- `sire_id` / `sire_name`
- `birth_date`
- `birth_type`
- `birth_notes`
- `weaned_at`
- `family_id`

规则：

- 生产记录创建时同步创建
- 断奶由 `weaned_at` 表示
- 幼崽犬只通过 `origin_litter_id` 关联

### 3.4 `breeding_records`

用途：繁育流程中的所有业务记录。

公共字段：

- `type`
- `cycle_id`
- `dog_id`
- `date`
- `cost`
- `notes`
- `details`
- `family_id`
- `created_by`

记录类型：

- `heat`
- `follicle_check`
- `mating`
- `pregnancy_check`
- `prenatal_check`
- `pre_labor`
- `birth`
- `abnormal_termination`

规则：

- 公共字段在顶层，类型特有字段收口到 `details`
- 繁育记录负责推进主流程状态
- 繁育表单已移除旧的“下次提醒”模型
- 额外安排不是 `breeding_record`，而是独立任务语义

### 3.5 `health_records`

用途：疫苗、驱虫、疾病三类健康记录。

公共字段：

- `type`
- `dog_id`
- `date`
- `cost`
- `notes`
- `details`
- `family_id`
- `created_by`

记录类型：

- `vaccination`
- `deworming`
- `illness`

规则：

- 疫苗/驱虫默认只生成建议日期，不自动创建下一条待办
- 只有显式 `create_task=true` 才生成任务
- 同一犬只在未康复期间，不允许存在同病名重复疾病记录

### 3.6 `medication_tasks`

用途：连续用药疗程的事实源。

关键字段：

- `dog_id`
- `drug_name`
- `status`
- `start_date`
- `duration_days`
- `frequency`
- `details`
- `family_id`

规则：

- 首页“今日用药”以该集合为事实源
- 同一犬只同一药名只允许一个进行中任务
- 今日剂量状态区分 `待完成 / 部分完成 / 已完成 / 漏服`

### 3.7 `tasks`

用途：首页待办、健康提醒、繁育里程碑、额外安排等可操作任务。

典型来源：

- 健康记录显式创建的下一次提醒
- 繁育主链自动推进出的 milestone
- 用户手动待办
- 繁育额外安排

规则：

- 首页固定按 `逾期 / 繁育 / 健康 / 用药` 分层消费任务
- `medication_tasks` 不并回普通 `tasks` 模型

### 3.8 财务域

#### `expenses`

用途：所有支出。

关键字段：

- `total_amount`
- `category`
- `date`
- `linked_cycle_id`
- `linked_litter_id`
- `linked_dog_ids`
- `source_type`
- `source_record_id`
- `dog_names`
- `dam_name`
- `litter_number`
- `family_id`
- `deleted_at`

#### `incomes`

用途：所有收入。

关键字段：

- `dog_id` / `dog_name`
- `type`
- `amount`
- `date`
- `source_sale_id`
- `notes`
- `family_id`
- `deleted_at`

#### `sale_records`

用途：销售流程，不直接承担统计事实源。

关键字段：

- `dog_id` / `dog_name`
- `status`
- `floor_price`
- `deposit_amount`
- `agreed_price`
- `received_amount`
- `seller_agent_id`
- `platform`
- `buyer_info`
- `refund_amount`
- `deposit_kept_amount`
- `family_id`
- `deleted_at`

规则：

- 财务统计从 `expenses + incomes` 实时聚合
- `sale_records` 负责销售状态流转与上下文

### 3.9 辅助集合

- `families`：家庭、成员、角色、配置
- `agents`：代理人/中间人
- `dog_weights`：体重历史
- `medication_protocols`：用药方案库

## 4. 自动推导状态

犬只状态不写回 `dogs`，由以下事实实时推导：

- `发情中 / 怀孕中 / 哺乳中`：来自 `breeding_cycles + litters`
- `生病中`：来自未康复 `health_records(type=illness)`
- `用药中`：来自 `medication_tasks`

优先级：

`疾病` → `用药` → `怀孕/哺乳` → `发情`

## 5. 关键业务规则

### 繁育

- 主链固定为 `发情 → 建议卵泡检查 → 配种 → 建议孕检 → 生产 → 确认断奶`
- 额外安排只影响任务，不推进主流程
- 生产后只自动生成“确认断奶”，不再静默铺首驱/首免链

### 健康

- 疫苗/驱虫是建议型提醒
- 首页批量完成时必须创建真实 `health_record`
- 疾病记录要求前后端双重唯一性校验

### 首页

- 固定四层：`逾期 / 繁育 / 健康 / 用药`
- 批量卡 key 必须带健康子类型，避免冲突
- 用药即使未处理也不提升到逾期区

## 6. 当前集合清单

V1 当前主要业务集合共 14 个：

1. `dogs`
2. `breeding_cycles`
3. `litters`
4. `breeding_records`
5. `health_records`
6. `medication_tasks`
7. `tasks`
8. `expenses`
9. `incomes`
10. `sale_records`
11. `families`
12. `agents`
13. `dog_weights`
14. `medication_protocols`

另有 `uni-id` 自带用户集合。
