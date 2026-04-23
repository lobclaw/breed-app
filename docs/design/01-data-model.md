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
- 除每日触发模板类字段外，业务日期字段不再要求写到 `00:00:00.000`
- 用户只选择“日期”时，前端默认使用“所选年月日 + 选择当下的当前时分秒毫秒”生成 timestamp
- 任何按“天”消费的逻辑，必须在读取 timestamp 后再按北京时间换算日边界
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
- `heat_observation`
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
- `mating.details.mating_number` 表示“本周期第几脚”，由系统按同周期已有配种记录数自动递增计算
- `heat_observation` 属于发情周期内补充观察日志，不推进主链、不生成任务、不修改周期状态、不联动费用
- `heat_observation.details` 结构化记录 `vulva_status`、`discharge_status`、`symptoms`
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
- 疾病记录继续保持“一条记录 = 一个主疾病/病程”
- `details.primary_condition` 为疾病主字段；为兼容旧逻辑，新写入时继续同步写 `details.condition`
- `details.symptom_tags` 用于保存症状/表现，可多选，不参与唯一性校验
- 同一犬只在未康复期间，不允许存在同主疾病重复疾病记录

### 3.6 `medication_tasks`

用途：连续用药疗程的事实源。

关键字段：

- `dog_id`
- `drug_name`
- `source_record_id`
- `status`
- `start_date`
- `duration_days`
- `frequency`
- `details`
- `family_id`

规则：

- 首页“今日用药”以该集合为事实源
- `source_record_id` 优先关联疾病记录；允许为空，用于独立创建或历史兼容数据
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

- 首页提醒、额外安排、主链里程碑与手动待办统一由该集合承载
- 任务是否完成只表达“待处理事实”，不替代真实业务记录
- `breeding_milestone(details.step_type=follicle_check)` 额外维护：
  `follicle_check_count`（本周期累计卵泡检查次数）、
  `follicle_result`（最近一次检查结果）、
  `latest_follicle_check_date`（最近一次检查日期）、
  `abnormal_result`（最近一次是否为发育不良）

### 3.8 `operation_logs`

用途：记录家庭内成员主动触发的关键顶层业务动作，供“操作日志”页统一查询。

关键字段：

- `family_id`
- `actor_user_id`
- `actor_name`
- `action_type`
- `domain`
- `target_type`
- `target_id`
- `target_name`
- `summary`
- `meta`
- `created_at`

规则：

- 只记录“用户主动发起的顶层业务动作”，不记录只读查询、定时任务和内部连带写入
- 一次业务动作只记一条日志，不展开自动创建的收入、费用、任务、幼崽等副作用
- `summary` 直接存储列表展示文案，前端不再二次拼装复杂语义
- 日志默认长期保留，不纳入回收站
- 首页固定按 `逾期 / 繁育 / 健康 / 用药` 分层消费任务
- `medication_tasks` 不并回普通 `tasks` 模型

### 3.8 财务域

#### `expenses`

用途：所有支出。

关键字段：

- `total_amount`
- `category`
- `category_group_label`
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

规则：

- `category` 保存二级分类名称；当前预设目录固定为：
- `喂养营养`：`食品 / 营养品`
- `医疗健康`：`医疗 / 疫苗驱虫 / 检查化验`
- `繁育投入`：`配种费 / 孕检产检 / 生产育幼`
- `日常运营`：`消耗品 / 日常用品 / 固定开销 / 交通 / 洗护美容 / 设备器材`
- `其他`：`其他`
- `category_group_label` 不单独持久化，查询时按分类映射为顶层用途分组：`喂养营养 / 医疗健康 / 繁育投入 / 日常运营 / 其他`
- 顶层分组只用于筛选、统计与展示聚合，真实记账字段仍以 `category` 为准

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

规则：

- 手动收入类型固定为 `销售 / 定金保留 / 领养 / 其他`
- 自动收入当前固定包含 `退款`
- 读取历史数据时兼容旧值：
- `定金` 统一按 `定金保留` 消费
- `领养费` 统一按 `领养` 消费
- `配种费收入` 统一按 `其他` 消费
- 兼容只作用于读取、筛选、统计与展示；新写入统一使用当前口径

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

其中 `families` 至少包含：

- `name`
- `creator_id`
- `members`
- `care_rules`
- `settings`
- `invite_code`
- `invite_expires`

其中 `families.settings` 至少包含：

- `default_weaning_days`
- `default_vaccine_interval_puppy`
- `default_vaccine_interval_adult`
- `default_deworming_interval_puppy`
- `default_deworming_interval_adult`
- `push_enabled`
- `morning_summary_enabled`
- `morning_summary_time`
- `notification_types`
- `custom_vaccine_types`
- `custom_deworming_drugs`
- `custom_condition_types`
- `custom_breed_types`

其中 `families.settings.notification_types` 结构为：

- `breeding`
- `vaccination`
- `medication`
- `care_group`
- `overdue`

其中 `families.settings.custom_expense_categories` 结构为：

- `name`
- `parent_group`

其中 `families.settings.custom_expense_category_groups` 结构为：

- `key`
- `label`

规则：

- 通知设置统一存放在 `families.settings`
- `invite_code` 表示当前家庭有效邀请码；可为空或缺失
- `invite_expires` 表示邀请码失效时间，使用 timestamp 毫秒数
- `morning_summary_time` 使用北京时间 `HH:MM` 字符串
- `morning_summary_time` 是唯一保留为 `HH:MM` 的每日触发模板字段，不参与 timestamp 统一口径
- `notification_types.overdue` 固定为 `true`
- 自定义支出分组统一存放在 `custom_expense_category_groups`
- 自定义支出分组使用 `{ key, label }`；`key` 由服务端生成且不可变，`label` 可编辑
- 自定义支出分类必须带 `parent_group`
- `custom_expense_categories.parent_group` 引用支出分组 `key`
- 历史字符串数组格式兼容读取，但写回时统一升级为对象数组
- 未识别或缺失分组的历史分类默认归到 `其他`

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
- `follicle_check` 只有在 `details.result === 已成熟` 时才推进到 `配种`
- 当前首页下一步取最近一次卵泡检查结果；`发育中 / 发育不良 / 其他` 继续停留在 `建议卵泡检查`
- 首页 `建议卵泡检查` 卡片固定表达“发情第 X 天 + 最近一次检查摘要 + 最近一次异常提示”，不再显示 `卵泡检查后第 X 天`
- 多次复查时首页只显示累计检查次数与最近一次距今天数，不展开历史复查明细
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
