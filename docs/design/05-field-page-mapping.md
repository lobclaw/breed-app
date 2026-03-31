# 字段-页面映射（Field-Page Mapping）

> 基于数据模型（01-data-model.md）与页面清单（page-inventory.md），将每个字段映射到读写页面。
> 最后更新：2026-03-28

---

## 一、dogs 集合

### dogs._id
- 写入: [系统自动生成]
- 读取: [所有关联页面内部使用，不直接显示]
- 联动: 无

### dogs.name
- 写入: [D-3 新建犬只页, D-4 编辑犬只页, D-16 添加幼崽表单, R-8b 生产向导步骤2]
- 读取: [D-1 犬只列表页, D-2 犬只详情页(Hero + 顶栏), D-15 窝详情页(幼崽列表), D-18 繁育周期详情页, S-5 销售详情页, 首页卡片]
- 联动: 冗余到 breeding_cycles.dam_name/sire_name, litters.dam_name/sire_name, sale_records.dog_name, expenses.dog_names, incomes.dog_name

### dogs.gender
- 写入: [D-3 新建犬只页, D-4 编辑犬只页, R-8b 生产向导步骤2]
- 读取: [D-2 犬只详情页(Hero子行 + 详细信息区), D-1 犬只列表页, D-15 窝详情页(幼崽列表gender tag), D-5 犬只筛选面板]
- 联动: 外部种公自动锁定为「公」

### dogs.role
- 写入: [D-3 新建犬只页(角色选择器), D-4 编辑犬只页, D-12 幼崽升级为种狗确认]
- 读取: [D-2 犬只详情页(角色标签), D-1 犬只列表页, D-5 犬只筛选面板, 各处 BDogPicker roleFilter]
- 联动: 升级时 role 幼崽->种狗, disposition 自留->在养

### dogs.disposition
- 写入: [D-7 标记退休确认, D-8 标记已故确认, D-9 标记领养表单, D-10 标记赠送表单, D-11 取消退休确认, D-12 幼崽升级为种狗确认, S-2 设定底价(待售), S-3 预定表单, S-4 完成交易表单, S-6 退款表单, S-7 定金取消表单]
- 读取: [D-2 犬只详情页(详细信息区), D-1 犬只列表页, D-5 犬只筛选面板, D-15 窝详情页(幼崽disposition tag)]
- 联动: 变更时可能触发繁育周期状态变更（阻止/中断）

### dogs.species
- 写入: [D-3 新建犬只页(V1 自动填入「犬」，不在表单显示)]
- 读取: [不直接显示]
- 联动: 预留字段，V1 不使用

### dogs.breed
- 写入: [D-3 新建犬只页, D-4 编辑犬只页]
- 读取: [D-2 犬只详情页(Hero子行 + 详细信息区), S-5 销售详情页]
- 联动: 无

### dogs.birth_date
- 写入: [D-3 新建犬只页, D-4 编辑犬只页]
- 读取: [D-2 犬只详情页(年龄统计 + 详细信息区), D-1 犬只列表页]
- 联动: 用于计算年龄（formatAge 动态派生）

### dogs.purchase_date
- 写入: [D-3 新建犬只页(仅种狗), D-4 编辑犬只页]
- 读取: [D-2 犬只详情页(详细信息区，v-if)]
- 联动: 无

### dogs.purchase_price
- 写入: [D-3 新建犬只页(仅种狗), D-4 编辑犬只页]
- 读取: [D-2 犬只详情页(详细信息区，v-if), F-8 种母投资回报页(买入价)]
- 联动: 计入种母投资回报

### dogs.latest_weight
- 写入: [系统自动同步——录入 dog_weights 后更新]
- 读取: [D-2 犬只详情页(快捷统计条体重), D-15 窝详情页(幼崽列表体重)]
- 联动: 缓存字段，从 dog_weights 最新记录同步

### dogs.family_id
- 写入: [系统自动注入（云对象 _before 拦截器）]
- 读取: [所有查询隐式过滤，不直接显示]
- 联动: 数据隔离

### dogs.origin_litter_id
- 写入: [R-8 生产记录向导(创建幼崽时自动填入)]
- 读取: [D-2 犬只详情页(D-S1 基础信息区「来源窝」)]
- 联动: 升级为种狗后继续保留

### dogs.owner_info
- 写入: [D-3 新建犬只页(仅外部种公), D-4 编辑犬只页]
- 读取: [D-2 犬只详情页(应显示在详细信息区)]
- 联动: 无

### dogs.disposition_date
- 写入: [D-7 标记退休确认(退休日期), D-8 标记已故确认(死亡日期), D-9 标记领养表单(领养日期), D-10 标记赠送表单(赠送日期)]
- 读取: [D-2 犬只详情页(应显示在详细信息区)]
- 联动: 取消退休时清除

### dogs.disposition_notes
- 写入: [D-7 标记退休确认(退休原因), D-8 标记已故确认(死因), D-9 标记领养表单(领养说明), D-10 标记赠送表单(受赠人信息)]
- 读取: [D-2 犬只详情页(应显示在详细信息区)]
- 联动: 取消退休时清除

### dogs.deleted_at
- 写入: [D-14 删除犬只确认(软删除), M-19 回收站(恢复/永久删除)]
- 读取: [M-19 回收站页]
- 联动: 软删除后默认列表不显示，关联记录不级联删除

### dogs.created_at
- 写入: [系统自动生成]
- 读取: [不直接显示]
- 联动: 无

### dogs.updated_at
- 写入: [系统自动更新]
- 读取: [不直接显示]
- 联动: 无

---

## 二、breeding_cycles 集合

### breeding_cycles._id
- 写入: [系统自动生成——录入发情/卵泡/配种记录时自动创建]
- 读取: [内部使用]
- 联动: 关联 breeding_records.cycle_id, litters.cycle_id, expenses.linked_cycle_id

### breeding_cycles.dam_id
- 写入: [创建周期时从 breeding_record.dog_id 自动填入]
- 读取: [D-18 繁育周期详情页, D-2 犬只详情页(繁育历史)]
- 联动: foreignKey -> dogs

### breeding_cycles.dam_name
- 写入: [创建时冗余填入]
- 读取: [D-18 繁育周期详情页, D-2 犬只详情页(繁育历史)]
- 联动: 冗余字段

### breeding_cycles.sire_id
- 写入: [配种记录提交时从 details.sire_id 同步]
- 读取: [D-18 繁育周期详情页]
- 联动: foreignKey -> dogs

### breeding_cycles.sire_name
- 写入: [配种记录提交时冗余填入]
- 读取: [D-18 繁育周期详情页, D-2 犬只详情页(繁育历史列表)]
- 联动: 冗余字段

### breeding_cycles.family_id
- 写入: [系统自动注入]
- 读取: [查询过滤]
- 联动: 数据隔离

### breeding_cycles.status
- 写入: [系统自动流转——发情中/怀孕中/已生产/失败/放弃, D-22 关闭发情确认, R-9 异常终止妊娠表单]
- 读取: [D-18 繁育周期详情页(状态流转图), D-2 犬只详情页(繁育历史状态标签)]
- 联动: 终态（已生产/失败/放弃）不可再转换

### breeding_cycles.created_at
- 写入: [系统自动生成]
- 读取: [D-2 犬只详情页(繁育历史日期), D-18 繁育周期详情页]
- 联动: 无

### breeding_cycles.updated_at
- 写入: [系统自动更新]
- 读取: [不直接显示]
- 联动: 无

---

## 三、breeding_records 集合

### 公共字段

### breeding_records._id
- 写入: [系统自动生成]
- 读取: [内部使用]
- 联动: 无

### breeding_records.type
- 写入: [各繁育记录表单(R-2~R-9)自动设置]
- 读取: [D-18 繁育周期详情页(时间线图标/标签), R-20 繁育记录详情页]
- 联动: 决定 details 结构

### breeding_records.cycle_id
- 写入: [各繁育记录表单自动关联当前周期]
- 读取: [内部使用]
- 联动: foreignKey -> breeding_cycles

### breeding_records.dog_id
- 写入: [各繁育记录表单(选择种母)]
- 读取: [R-20 繁育记录详情页]
- 联动: foreignKey -> dogs

### breeding_records.family_id
- 写入: [系统自动注入]
- 读取: [查询过滤]
- 联动: 数据隔离

### breeding_records.date
- 写入: [各繁育记录表单(日期选择)]
- 读取: [D-18 繁育周期详情页(时间线日期), R-20 繁育记录详情页]
- 联动: 配种日期用于计算预产期

### breeding_records.cost
- 写入: [各繁育记录表单(费用选填)]
- 读取: [R-20 繁育记录详情页, D-18 繁育周期详情页(关联费用)]
- 联动: 自动创建 expenses 记录(source_type=auto)

### breeding_records.notes
- 写入: [各繁育记录表单(备注选填)]
- 读取: [R-20 繁育记录详情页, D-18 繁育周期详情页(时间线)]
- 联动: 无

### breeding_records.details
- 写入: [各繁育记录表单(类型特有字段)]
- 读取: [R-20 繁育记录详情页]
- 联动: 见下方各类型详细映射

### breeding_records.created_by
- 写入: [系统自动注入当前用户]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### breeding_records.created_at / updated_at
- 写入: [系统自动]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### 类型: heat（发情记录）

### breeding_records.details.start_date
- 写入: [R-2 发情记录表单(发情开始日期，即 form.date)]
- 读取: [R-20 繁育记录详情页, D-18 繁育周期详情页]
- 联动: 无

### breeding_records.details.end_date
- 写入: [系统自动(配种/超时关闭时), D-22 关闭发情确认]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### breeding_records.details.end_reason
- 写入: [系统自动(自然结束/已配种/手动关闭)]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### 类型: follicle_check（卵泡检查）

### breeding_records.details.left_count
- 写入: [R-3 卵泡检查表单]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### breeding_records.details.left_size
- 写入: [R-3 卵泡检查表单]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### breeding_records.details.right_count
- 写入: [R-3 卵泡检查表单]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### breeding_records.details.right_size
- 写入: [R-3 卵泡检查表单]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### breeding_records.details.result
- 写入: [R-3 卵泡检查表单(pill-select: 发育良好/发育不良/其他)]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### 类型: mating（配种记录）

### breeding_records.details.sire_id
- 写入: [R-4 配种记录表单(选择种公)]
- 读取: [R-20 繁育记录详情页]
- 联动: 同步到 breeding_cycles.sire_id

### breeding_records.details.method
- 写入: [R-4 配种记录表单(自然交配/人工授精)]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### breeding_records.details.mating_number
- 写入: [R-4 配种记录表单(自动递增)]
- 读取: [R-20 繁育记录详情页, R-4 配种记录表单(显示)]
- 联动: 无

### breeding_records.details.expected_checkup_date
- 写入: [R-4 配种记录表单(自动计算 date+25, 应可手动修改)]
- 读取: [R-20 繁育记录详情页, R-4 配种记录表单(自动计算卡片), D-18 繁育周期详情页]
- 联动: 生成孕检提醒 task

### breeding_records.details.expected_due_date
- 写入: [R-4 配种记录表单(自动计算 date+63, 应可手动修改)]
- 读取: [R-20 繁育记录详情页, R-4 配种记录表单(自动计算卡片), D-18 繁育周期详情页, 首页卡片(预产期倒计时)]
- 联动: 生成预产期提醒 task

### breeding_records.details.is_due_date_manual
- 写入: [R-4 配种记录表单(手动修改预产期时设为 true)]
- 读取: [R-21 繁育记录编辑页(决定是否自动重算)]
- 联动: 编辑配种日期时，若非手动覆盖则自动重算预产期

### 类型: pregnancy_check（孕检）

### breeding_records.details.confirmed
- 写入: [R-5 孕检记录表单(是/否)]
- 读取: [R-20 繁育记录详情页]
- 联动: 确认未怀孕 -> cycle.status=失败

### breeding_records.details.puppy_count
- 写入: [R-5 孕检记录表单(幼崽数量选填)]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### breeding_records.details.images
- 写入: [R-5 孕检记录表单(B超图片上传)]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### 类型: prenatal_check（产检）

### breeding_records.details.results
- 写入: [R-6 产检记录表单]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### 类型: pre_labor（临产监测）

### breeding_records.details.temperature
- 写入: [R-7 临产监测表单]
- 读取: [R-20 繁育记录详情页]
- 联动: 低于 37.1 触发额外提醒

### breeding_records.details.nesting_behavior
- 写入: [R-7 临产监测表单(toggle)]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### breeding_records.details.appetite_change
- 写入: [R-7 临产监测表单]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### breeding_records.details.other_signs
- 写入: [R-7 临产监测表单]
- 读取: [R-20 繁育记录详情页]
- 联动: 无

### 类型: birth（生产记录）

### breeding_records.details.litter_id
- 写入: [R-8 生产记录向导(创建窝后自动填入)]
- 读取: [R-20 繁育记录详情页, D-18 繁育周期详情页(跳转窝详情)]
- 联动: foreignKey -> litters

### breeding_records.details.birth_type
- 写入: [R-8a 步骤1(顺产/难产/剖腹产)]
- 读取: [R-20 繁育记录详情页]
- 联动: 同步到 litters.birth_type

### 类型: abnormal_termination（异常终止妊娠）

### breeding_records.details.termination_type
- 写入: [R-9 异常终止妊娠表单(流产/死胎/医疗终止/确认未怀孕)]
- 读取: [R-20 繁育记录详情页]
- 联动: cycle.status -> 失败

---

## 四、litters 集合

### litters._id
- 写入: [R-8 生产记录向导(创建窝时生成)]
- 读取: [内部使用]
- 联动: dogs.origin_litter_id, expenses.linked_litter_id

### litters.cycle_id
- 写入: [R-8 生产记录向导(自动关联当前繁育周期)]
- 读取: [D-18 繁育周期详情页(关联窝信息)]
- 联动: foreignKey -> breeding_cycles (1:1)

### litters.dam_id
- 写入: [R-8 生产记录向导(自动填入)]
- 读取: [D-15 窝详情页]
- 联动: 冗余字段

### litters.dam_name
- 写入: [R-8 生产记录向导(冗余填入)]
- 读取: [D-15 窝详情页(标题 + 种母信息), D-18 繁育周期详情页]
- 联动: 冗余字段

### litters.sire_id
- 写入: [R-8 生产记录向导(从周期冗余)]
- 读取: [D-15 窝详情页]
- 联动: 冗余字段

### litters.sire_name
- 写入: [R-8 生产记录向导(冗余填入)]
- 读取: [D-15 窝详情页(种公信息)]
- 联动: 冗余字段

### litters.family_id
- 写入: [系统自动注入]
- 读取: [查询过滤]
- 联动: 数据隔离

### litters.birth_date
- 写入: [R-8a 步骤1(实际生产日期), D-15 窝详情页(修改生产日期，±3天)]
- 读取: [D-15 窝详情页(生产日期), D-18 繁育周期详情页, D-S6 窝列表区]
- 联动: 决定窝号排序

### litters.birth_type
- 写入: [R-8a 步骤1(顺产/难产/剖腹产)]
- 读取: [D-15 窝详情页(生产方式), D-18 繁育周期详情页]
- 联动: 同步到 breeding_records(type=birth).details.birth_type

### litters.birth_notes
- 写入: [R-8c 步骤3(经验心得选填)]
- 读取: [D-15 窝详情页(应显示经验心得)]
- 联动: 无

### litters.weaned_at
- 写入: [D-17 确认断奶(断奶日期)]
- 读取: [D-15 窝详情页(断奶状态显示), D-18 繁育周期详情页]
- 联动: 确认断奶后退出哺乳中状态

### litters.created_by
- 写入: [系统自动注入当前用户]
- 读取: [不直接显示]
- 联动: 无

### litters.created_at / updated_at
- 写入: [系统自动]
- 读取: [不直接显示]
- 联动: 无

---

## 五、health_records 集合

### 公共字段

### health_records._id
- 写入: [系统自动生成]
- 读取: [内部使用]
- 联动: 无

### health_records.type
- 写入: [各健康记录表单(R-10~R-12)自动设置: vaccination/deworming/illness]
- 读取: [D-2 犬只详情页(D-S3 健康记录区图标/标签), R-22 健康记录详情页]
- 联动: 决定 details 结构

### health_records.dog_id
- 写入: [各健康记录表单(选择犬只)]
- 读取: [R-22 健康记录详情页]
- 联动: foreignKey -> dogs

### health_records.family_id
- 写入: [系统自动注入]
- 读取: [查询过滤]
- 联动: 数据隔离

### health_records.date
- 写入: [各健康记录表单(日期选择)]
- 读取: [D-2 犬只详情页(D-S3 日期显示), R-22 健康记录详情页]
- 联动: 无

### health_records.cost
- 写入: [各健康记录表单(费用选填)]
- 读取: [R-22 健康记录详情页]
- 联动: 自动创建 expenses 记录(source_type=auto)

### health_records.notes
- 写入: [各健康记录表单(备注选填)]
- 读取: [D-2 犬只详情页(D-S3 记录列表中 notes 尾部), R-22 健康记录详情页]
- 联动: 无

### health_records.created_by
- 写入: [系统自动注入]
- 读取: [R-22 健康记录详情页]
- 联动: 无

### health_records.created_at / updated_at
- 写入: [系统自动]
- 读取: [R-22 健康记录详情页]
- 联动: 无

### 类型: vaccination（疫苗记录）

### health_records.details.vaccine_type
- 写入: [R-10 疫苗记录表单]
- 读取: [R-22 健康记录详情页]
- 联动: 无

### health_records.details.next_reminder_date
- 写入: [R-10 疫苗记录表单(自动计算，可修改)]
- 读取: [R-22 健康记录详情页, 首页卡片(疫苗提醒)]
- 联动: 生成 task 提醒

### 类型: deworming（驱虫记录）

### health_records.details.deworming_type
- 写入: [R-11 驱虫记录表单(internal/external/combo)]
- 读取: [R-22 健康记录详情页]
- 联动: 无

### health_records.details.drug_name
- 写入: [R-11 驱虫记录表单]
- 读取: [R-22 健康记录详情页]
- 联动: 无

### health_records.details.next_reminder_date
- 写入: [R-11 驱虫记录表单(自动计算，可修改)]
- 读取: [R-22 健康记录详情页, 首页卡片(驱虫提醒)]
- 联动: 生成 task 提醒

### 类型: illness（疾病记录）

### health_records.details.start_date
- 写入: [R-12 疾病记录表单(开始日期)]
- 读取: [R-22 健康记录详情页]
- 联动: 无

### health_records.details.end_date
- 写入: [D-13 标记康复确认(康复日期)]
- 读取: [R-22 健康记录详情页]
- 联动: 退出生病中状态

### health_records.details.condition
- 写入: [R-12 疾病记录表单(病症选择)]
- 读取: [R-22 健康记录详情页]
- 联动: 无

### health_records.details.severity
- 写入: [R-12 疾病记录表单(严重程度选填)]
- 读取: [R-22 健康记录详情页]
- 联动: 无

### health_records.details.treatment_status
- 写入: [R-12 疾病记录表单(治疗中/已康复/慢性管理), D-13 标记康复确认]
- 读取: [R-22 健康记录详情页]
- 联动: 无

---

## 六、expenses 集合

### expenses._id
- 写入: [系统自动生成]
- 读取: [内部使用]
- 联动: 无

### expenses.family_id
- 写入: [系统自动注入]
- 读取: [查询过滤]
- 联动: 数据隔离

### expenses.total_amount
- 写入: [R-16 支出录入表单, F-5 编辑支出页, 繁育/健康记录cost字段自动同步]
- 读取: [F-1 财务主页(流水列表金额), F-3 支出详情页(record.amount), F-6 统计总览页, F-7 单窝利润, F-8 种母ROI]
- 联动: 多犬分摊 = total_amount / linked_dog_ids.length

### expenses.category
- 写入: [R-16 支出录入表单(R-16a 分类选择Sheet), F-5 编辑支出页]
- 读取: [F-1 财务主页(流水列表分类标签), F-3 支出详情页(category tag), F-S2 分类支出视图]
- 联动: 无

### expenses.date
- 写入: [R-16 支出录入表单, F-5 编辑支出页]
- 读取: [F-1 财务主页(流水列表日期), F-3 支出详情页]
- 联动: 无

### expenses.linked_cycle_id
- 写入: [R-16 支出录入表单(R-16b 关联选择Sheet), 繁育记录cost自动同步]
- 读取: [F-3 支出详情页(关联方式)]
- 联动: foreignKey -> breeding_cycles

### expenses.linked_litter_id
- 写入: [R-16 支出录入表单(R-16b 关联选择Sheet)]
- 读取: [F-3 支出详情页(关联方式)]
- 联动: foreignKey -> litters

### expenses.linked_dog_ids
- 写入: [R-16 支出录入表单(R-16b 关联选择Sheet -> G-1 犬只选择器)]
- 读取: [F-3 支出详情页(关联犬只列表)]
- 联动: foreignKey -> dogs[]

### expenses.source_type
- 写入: [R-16 手动录入设为 manual, 繁育/健康记录自动设为 auto]
- 读取: [F-3 支出详情页(来源标签), F-1 财务主页]
- 联动: auto 类型在财务模块只读

### expenses.source_record_id
- 写入: [自动同步时指向原始繁育/健康记录ID]
- 读取: [F-3 支出详情页(可选跳转来源)]
- 联动: 无

### expenses.images
- 写入: [R-16 支出录入表单(图片凭证), F-5 编辑支出页]
- 读取: [F-3 支出详情页(图片预览)]
- 联动: 无

### expenses.dam_name
- 写入: [自动冗余填入]
- 读取: [F-1 财务主页(流水列表)]
- 联动: 冗余字段

### expenses.dog_names
- 写入: [自动冗余填入]
- 读取: [F-1 财务主页(流水列表)]
- 联动: 冗余字段

### expenses.litter_number
- 写入: [自动冗余填入]
- 读取: [F-1 财务主页(流水列表)]
- 联动: 冗余字段

### expenses.notes
- 写入: [R-16 支出录入表单, F-5 编辑支出页]
- 读取: [F-3 支出详情页(备注)]
- 联动: 无

### expenses.created_by
- 写入: [系统自动注入]
- 读取: [F-3 支出详情页(创建人)]
- 联动: 无

### expenses.deleted_at
- 写入: [GM-3 删除费用记录确认]
- 读取: [M-19 回收站]
- 联动: 软删除

### expenses.created_at / updated_at
- 写入: [系统自动]
- 读取: [F-3 支出详情页(创建时间)]
- 联动: 无

---

## 七、incomes 集合

### incomes._id
- 写入: [系统自动生成]
- 读取: [内部使用]
- 联动: 无

### incomes.dog_id
- 写入: [R-17 收入录入表单(关联犬只选填), 销售成交/退款/定金取消自动填入]
- 读取: [F-4 收入详情页(关联犬只)]
- 联动: foreignKey -> dogs

### incomes.dog_name
- 写入: [自动冗余填入]
- 读取: [F-4 收入详情页(linked_dog_name), F-1 财务主页(流水列表)]
- 联动: 冗余字段

### incomes.type
- 写入: [R-17 收入录入表单(销售/定金保留/领养/其他), 系统自动(退款)]
- 读取: [F-4 收入详情页(type_label tag), F-1 财务主页]
- 联动: 无

### incomes.amount
- 写入: [R-17 收入录入表单, 销售成交自动(received_amount), 退款自动(-refund_amount), 定金保留自动(deposit_kept_amount)]
- 读取: [F-4 收入详情页(金额), F-1 财务主页(流水列表), F-6 统计总览页, F-7 单窝利润, F-8 种母ROI]
- 联动: 退款为负数

### incomes.date
- 写入: [R-17 收入录入表单, 系统自动]
- 读取: [F-4 收入详情页(日期), F-1 财务主页(流水列表)]
- 联动: 无

### incomes.source_sale_id
- 写入: [销售成交/退款/定金取消时自动填入 SaleRecord ID]
- 读取: [F-4 收入详情页(来源销售记录链接)]
- 联动: foreignKey -> sale_records

### incomes.notes
- 写入: [R-17 收入录入表单]
- 读取: [F-4 收入详情页(备注)]
- 联动: 无

### incomes.family_id
- 写入: [系统自动注入]
- 读取: [查询过滤]
- 联动: 数据隔离

### incomes.created_by
- 写入: [系统自动注入]
- 读取: [F-4 收入详情页(创建人)]
- 联动: 无

### incomes.deleted_at
- 写入: [GM-4 删除收入记录确认]
- 读取: [M-19 回收站]
- 联动: 软删除

### incomes.created_at / updated_at
- 写入: [系统自动]
- 读取: [F-4 收入详情页(创建时间)]
- 联动: 无

---

## 八、sale_records 集合

### sale_records._id
- 写入: [系统自动生成]
- 读取: [内部使用]
- 联动: incomes.source_sale_id

### sale_records.dog_id
- 写入: [S-2 设定底价]
- 读取: [S-5 销售详情页(犬只卡片)]
- 联动: foreignKey -> dogs

### sale_records.dog_name
- 写入: [S-2 自动冗余填入]
- 读取: [S-5 销售详情页(犬只名称), S-1 销售记录列表]
- 联动: 冗余字段

### sale_records.status
- 写入: [S-2(待售), S-3(已预定), S-4(已成交), S-6(已退款), S-7(定金取消)]
- 读取: [S-5 销售详情页(状态tag + 步骤条), S-1 销售记录列表(分组)]
- 联动: 同步 dogs.disposition

### sale_records.floor_price
- 写入: [S-2 设定底价]
- 读取: [S-5 销售详情页(底价), S-10 到手价低于底价提示]
- 联动: 无

### sale_records.deposit_amount
- 写入: [S-3 预定表单(收定金弹窗)]
- 读取: [S-5 销售详情页(定金)]
- 联动: 无

### sale_records.deposit_date
- 写入: [S-3 预定表单(系统自动记录)]
- 读取: [S-5 销售详情页(定金日期)]
- 联动: 无

### sale_records.agreed_price
- 写入: [S-3 预定表单(约定价选填), S-4 完成交易表单]
- 读取: [S-5 销售详情页(成交价)]
- 联动: 无

### sale_records.received_amount
- 写入: [S-4 完成交易表单(到手价必填)]
- 读取: [S-5 销售详情页(到手价)]
- 联动: 自动创建 income(type=销售)

### sale_records.seller_agent_id
- 写入: [S-3 预定表单(S-9 选择代理人), S-4 完成交易表单]
- 读取: [S-5 销售详情页(卖出人)]
- 联动: foreignKey -> agents

### sale_records.platform
- 写入: [S-3 预定表单(S-8 选择平台), S-4 完成交易表单]
- 读取: [S-5 销售详情页(平台)]
- 联动: 无

### sale_records.date
- 写入: [S-4 完成交易表单(成交日期)]
- 读取: [S-5 销售详情页]
- 联动: 无

### sale_records.delivery_date
- 写入: [S-4 完成交易表单(交付日期选填)]
- 读取: [S-5 销售详情页(交付日期)]
- 联动: 无

### sale_records.buyer_info
- 写入: [S-3 预定表单(买家信息选填)]
- 读取: [S-5 销售详情页(买家)]
- 联动: 无

### sale_records.refund_amount
- 写入: [S-6 退款表单(退款金额)]
- 读取: [S-5 销售详情页(退款金额)]
- 联动: 自动创建 income(type=退款, amount=-refund_amount)

### sale_records.refund_reason
- 写入: [S-6 退款表单(退款原因选填)]
- 读取: [S-5 销售详情页(退款原因)]
- 联动: 无

### sale_records.refund_date
- 写入: [S-6 退款表单(退款日期)]
- 读取: [S-5 销售详情页(应显示退款日期)]
- 联动: 无

### sale_records.deposit_kept_amount
- 写入: [S-7 定金取消表单(保留金额)]
- 读取: [S-5 销售详情页(定金保留)]
- 联动: 如有保留金额 -> 自动创建 income(type=定金保留)

### sale_records.notes
- 写入: [S-3 预定表单, S-4 完成交易表单]
- 读取: [S-5 销售详情页(备注)]
- 联动: 无

### sale_records.created_by
- 写入: [系统自动注入]
- 读取: [S-5 销售详情页]
- 联动: 无

### sale_records.deleted_at
- 写入: [GM-5 删除销售记录确认]
- 读取: [M-19 回收站]
- 联动: 软删除

### sale_records.family_id
- 写入: [系统自动注入]
- 读取: [查询过滤]
- 联动: 数据隔离

### sale_records.created_at / updated_at
- 写入: [系统自动]
- 读取: [S-5 销售详情页]
- 联动: 无

---

## 九、families 集合

### families._id
- 写入: [A-4 创建家庭页]
- 读取: [内部使用]
- 联动: 所有集合的 family_id

### families.name
- 写入: [A-4 创建家庭页(犬舍名称), M-2 家庭管理页(编辑)]
- 读取: [M-1 我的主页(家庭/犬舍名称), M-2 家庭管理页]
- 联动: 无

### families.creator_id
- 写入: [A-4 创建家庭页(自动注入)]
- 读取: [M-2 家庭管理页(标识创建者)]
- 联动: 无

### families.members[]
- 写入: [A-4 创建/加入家庭页, M-3 生成邀请链接, M-4 成员角色调整, M-5 移除成员]
- 读取: [M-2 家庭管理页(成员列表)]
- 联动: 无

### families.members[].user_id
- 写入: [加入家庭时自动填入]
- 读取: [M-2 家庭管理页]
- 联动: foreignKey -> users

### families.members[].role
- 写入: [A-4(creator), M-3(默认 helper), M-4 成员角色调整]
- 读取: [M-2 家庭管理页(角色显示)]
- 联动: 决定权限

### families.members[].status
- 写入: [邀请/加入/移除时更新: active/invited/removed]
- 读取: [M-2 家庭管理页(状态显示)]
- 联动: 无

### families.members[].joined_at
- 写入: [加入时自动填入]
- 读取: [M-2 家庭管理页]
- 联动: 无

### families.members[].removed_at
- 写入: [M-5 移除成员时填入]
- 读取: [不直接显示]
- 联动: 无

### families.care_rules[]
- 写入: [M-16 新增/编辑护理规则]
- 读取: [M-15 护理规则列表页, 首页智能卡片(Phase 3)]
- 联动: 触发护理任务生成

### families.care_rules[].status_trigger
- 写入: [M-16(怀孕中/哺乳中/生病中/用药中)]
- 读取: [M-15 护理规则列表页]
- 联动: 无

### families.care_rules[].task_description
- 写入: [M-16]
- 读取: [M-15 护理规则列表页, 首页卡片]
- 联动: 无

### families.care_rules[].frequency
- 写入: [M-16(每日/每周/自定义)]
- 读取: [M-15 护理规则列表页]
- 联动: 无

### families.settings.default_weaning_days
- 写入: [M-17 默认参数设置页]
- 读取: [D-17 确认断奶(断奶龄判断), 首页卡片(断奶提醒)]
- 联动: 无

### families.settings.default_vaccine_interval_puppy
- 写入: [M-17 默认参数设置页]
- 读取: [R-10 疫苗记录表单(幼犬自动计算下次提醒日期)]
- 联动: 无

### families.settings.default_vaccine_interval_adult
- 写入: [M-17 默认参数设置页]
- 读取: [R-10 疫苗记录表单(种狗自动计算下次提醒日期)]
- 联动: 无

### families.settings.default_deworming_interval_puppy
- 写入: [M-17 默认参数设置页]
- 读取: [R-11 驱虫记录表单(幼犬自动计算下次提醒)]
- 联动: 无

### families.settings.default_deworming_interval_adult
- 写入: [M-17 默认参数设置页]
- 读取: [R-11 驱虫记录表单(成犬自动计算下次提醒)]
- 联动: 无

### families.settings.morning_summary_time
- 写入: [M-6 通知设置页]
- 读取: [M-6 通知设置页]
- 联动: 控制晨间摘要推送时间

### families.settings.custom_vaccine_types
- 写入: [M-17 默认参数设置页(或 R-10 中自定义)]
- 读取: [R-10 疫苗记录表单(疫苗类型选项)]
- 联动: 无

### families.settings.custom_deworming_drugs
- 写入: [M-17 默认参数设置页(或 R-11 中自定义)]
- 读取: [R-11 驱虫记录表单(药品选项)]
- 联动: 无

### families.created_at / updated_at
- 写入: [系统自动]
- 读取: [不直接显示]
- 联动: 无

---

## 十、agents 集合

### agents._id
- 写入: [M-12 新增代理人]
- 读取: [内部使用]
- 联动: sale_records.seller_agent_id

### agents.name
- 写入: [M-12 新增/编辑代理人]
- 读取: [M-10 代理人列表页, M-11 代理人详情页, S-9 选择代理人Sheet, S-5 销售详情页(agent_name)]
- 联动: 冗余到 sale 显示

### agents.contact_info
- 写入: [M-12 新增/编辑代理人(选填)]
- 读取: [M-10 代理人列表页, M-11 代理人详情页]
- 联动: 无

### agents.family_id
- 写入: [系统自动注入]
- 读取: [查询过滤]
- 联动: 数据隔离

### agents.deleted_at
- 写入: [代理人删除时设置]
- 读取: [查询过滤]
- 联动: 软删除

### agents.created_at / updated_at
- 写入: [系统自动]
- 读取: [不直接显示]
- 联动: 无

---

## 十一、medication_protocols 集合

### medication_protocols._id
- 写入: [M-9 新建方案, R-15 保存为方案确认]
- 读取: [内部使用]
- 联动: medication_tasks.protocol_id

### medication_protocols.family_id
- 写入: [系统自动注入]
- 读取: [查询过滤]
- 联动: 数据隔离

### medication_protocols.name
- 写入: [M-9 新建方案, M-8 方案编辑, R-15 保存为方案确认]
- 读取: [M-7 方案库列表页, M-8 方案详情页, R-14 从方案库选择]
- 联动: 无

### medication_protocols.target_condition
- 写入: [M-9 / M-8]
- 读取: [M-7 方案库列表页(适用病症), M-8 方案详情页]
- 联动: 无

### medication_protocols.weight_range
- 写入: [M-9 / M-8(选填)]
- 读取: [M-8 方案详情页, R-14 从方案库选择]
- 联动: 无

### medication_protocols.drugs[]
- 写入: [M-9 / M-8]
- 读取: [M-7 方案库列表页(药品数量), M-8 方案详情页(药品列表)]
- 联动: 应用方案时生成 medication_tasks

### medication_protocols.drugs[].drug_name
- 写入: [M-9 / M-8]
- 读取: [M-8 方案详情页]
- 联动: 无

### medication_protocols.drugs[].dosage_per_kg
- 写入: [M-9 / M-8]
- 读取: [M-8 方案详情页, R-14(按体重换算)]
- 联动: 自动换算 = dosage_per_kg * dog.latest_weight / 1000

### medication_protocols.drugs[].dosage_fixed
- 写入: [M-9 / M-8]
- 读取: [M-8 方案详情页]
- 联动: 无

### medication_protocols.drugs[].dosage_unit
- 写入: [M-9 / M-8]
- 读取: [M-8 方案详情页]
- 联动: 无

### medication_protocols.drugs[].method
- 写入: [M-9 / M-8]
- 读取: [M-8 方案详情页]
- 联动: 无

### medication_protocols.drugs[].frequency
- 写入: [M-9 / M-8]
- 读取: [M-8 方案详情页]
- 联动: 无

### medication_protocols.duration_days
- 写入: [M-9 / M-8(选填)]
- 读取: [M-8 方案详情页]
- 联动: 无

### medication_protocols.notes
- 写入: [M-9 / M-8]
- 读取: [M-8 方案详情页]
- 联动: 无

### medication_protocols.deleted_at
- 写入: [方案删除时]
- 读取: [查询过滤]
- 联动: 软删除

### medication_protocols.created_at / updated_at
- 写入: [系统自动]
- 读取: [不直接显示]
- 联动: 无

---

## 十二、dog_weights 集合

### dog_weights._id
- 写入: [系统自动生成]
- 读取: [内部使用]
- 联动: 无

### dog_weights.dog_id
- 写入: [D-20 单犬体重录入, D-19 批量体重录入]
- 读取: [D-S4 体重曲线区, D-21 体重曲线详情]
- 联动: foreignKey -> dogs

### dog_weights.family_id
- 写入: [系统自动注入]
- 读取: [查询过滤]
- 联动: 数据隔离

### dog_weights.weight
- 写入: [D-20 单犬体重录入, D-19 批量体重录入]
- 读取: [D-S4 体重曲线区(曲线图 + 记录列表), D-21 体重曲线详情, D-19 批量体重(显示上次体重和增减)]
- 联动: 同步最新值到 dogs.latest_weight

### dog_weights.measured_at
- 写入: [D-20 单犬体重录入(日期), D-19 批量体重录入(日期)]
- 读取: [D-S4 体重曲线区, D-21 体重曲线详情]
- 联动: 无

### dog_weights.created_at / updated_at
- 写入: [系统自动]
- 读取: [不直接显示]
- 联动: 无

---

## 附录：实现审计结果

> 基于 2026-03-27 对 src/pages/ 目录下实际 Vue 文件的代码审查。

### 审计方法

逐一比对数据模型字段与实际页面实现，检查「应有但缺失」的字段。

### 发现的差距

#### 1. dogs 集合 vs dog/detail.vue

| 字段 | 应显示页面 | 当前状态 |
|------|-----------|---------|
| `dogs.disposition_date` | D-2 犬只详情页（详细信息区） | **缺失** — 详细信息区不显示 disposition_date，但退休/已故/领养/赠送表单中有写入（retireDate, deceasedDate 等）。写入正常，读取缺失。 |
| `dogs.disposition_notes` | D-2 犬只详情页（详细信息区） | **缺失** — 详细信息区不显示 disposition_notes。同上，写入正常但读取缺失。用户无法在详情页看到退休原因、死因、领养说明等。 |
| `dogs.owner_info` | D-2 犬只详情页（详细信息区，外部种公） | **缺失** — 详细信息区（infoExpanded 折叠面板）中没有 owner_info 行。add.vue 中可编辑，但 detail.vue 不显示。 |
| `dogs.origin_litter_id` | D-2 犬只详情页（D-S1 基础信息区「来源窝」） | **缺失** — 详细信息区没有显示来源窝链接。页面清单 D-S1 明确列出应显示「来源窝」。 |

#### 2. dogs 集合 vs dog/add.vue

| 字段 | 应显示页面 | 当前状态 |
|------|-----------|---------|
| `dogs.name` | D-4 编辑犬只页 | **不完整** — 编辑模式下 name 字段不在 updateDog 的参数中（只传 gender, role, breed 等），编辑时无法修改犬只名称。创建时正常。 |
| `dogs.disposition` | D-3/D-4 | 正常 — disposition 不在新建/编辑表单中是对的（通过状态变更操作管理），设计正确。 |

#### 3. litters 集合 vs breeding/litter.vue

| 字段 | 应显示页面 | 当前状态 |
|------|-----------|---------|
| `litters.birth_notes` | D-15 窝详情页（经验心得） | **缺失** — 摘要信息卡中没有显示 birth_notes（经验心得）。birth-wizard.vue 中可写入 birth_notes，但 litter.vue 不显示。编辑菜单引用的是 `litter.notes` 而非 `litter.birth_notes`，字段名不匹配。 |

#### 4. breeding_records details 字段 vs 各表单页面

| 字段 | 应显示页面 | 当前状态 |
|------|-----------|---------|
| `details.expected_checkup_date` (mating) | R-4 配种记录表单 | **不完整** — 表单显示了自动计算的预计孕检日和预产期，但未将 expected_checkup_date 和 expected_due_date 写入 details 对象。submit() 中 details 只包含 sire_id, sire_name, method, mating_number，缺少这两个日期字段。 |
| `details.expected_due_date` (mating) | R-4 配种记录表单 | **缺失** — 同上，未写入 details。 |
| `details.is_due_date_manual` (mating) | R-4 配种记录表单 | **缺失** — 表单中无手动修改预产期的交互，也无 is_due_date_manual 字段写入。提示文字「可手动修改预产期」但没有实际的编辑入口。 |
| `details.images` (pregnancy_check) | R-5 孕检记录表单 | **缺失** — 表单中没有图片上传组件（B超图片上传），只有 confirmed 和 puppy_count。 |
| `details.start_date` (heat) | R-2 发情记录表单 | 正常 — 写入 `details: { start_date: form.date }`。但 end_date 和 end_reason 不在表单中是设计上正确的（系统自动填写）。 |

#### 5. sale_records 集合 vs sale/detail.vue

| 字段 | 应显示页面 | 当前状态 |
|------|-----------|---------|
| `sale_records.refund_date` | S-5 销售详情页 | **缺失** — 退款表单中可写入 refund_date，但详情页没有显示退款日期行。 |
| `sale_records.date`（成交日期） | S-5 销售详情页 | **缺失** — 交易信息区域没有显示成交日期字段。完成交易表单写入了 delivery_date 但未单独写入 sale.date（成交日期）。 |
| `sale_records.created_by` | S-5 销售详情页 | **缺失** — 详情页没有显示创建人信息。 |

#### 6. expenses 集合 vs finance/expense-detail.vue

| 字段 | 应显示页面 | 当前状态 |
|------|-----------|---------|
| `expenses.total_amount` | F-3 支出详情页 | 正常 — 显示为 record.amount（字段名映射可能在后端完成）。 |
| `expenses.linked_cycle_id` | F-3 支出详情页 | **不明确** — 详情页显示 `record.linked_ref`（文字描述）和 `record.linked_dogs`（犬只列表），但没有直接显示 linked_cycle_id 或 linked_litter_id 的关联方式名称和跳转链接。后端可能将这些转换为 linked_ref 文字。 |
| `expenses.dam_name` | F-1 财务主页 | 正常 — 由后端在流水列表中使用。 |
| `expenses.dog_names` | F-1 财务主页 | 正常 — 由后端在流水列表中使用。 |
| `expenses.litter_number` | F-1 财务主页 | 正常 — 由后端在流水列表中使用。 |

#### 7. incomes 集合 vs finance/income-detail.vue

| 字段 | 应显示页面 | 当前状态 |
|------|-----------|---------|
| 所有字段 | F-4 收入详情页 | 基本正常 — amount, type, dog_name, source_sale_id, notes, source, created_by 均有显示。 |

### 审计总结

**高优先级缺失（直接影响用户使用）：**

1. **dog/detail.vue 缺少 4 个字段显示** — disposition_date, disposition_notes, owner_info, origin_litter_id 在详细信息区均不显示。用户在退休/已故等操作中填写了这些信息，但之后无处查看。
2. **dog/add.vue 编辑模式不传 name** — 编辑犬只时无法修改名称。
3. **breeding/litter.vue 不显示 birth_notes** — 生产时填写的经验心得在窝详情页无法查看。且编辑菜单引用了 `notes` 而数据模型用的是 `birth_notes`。
4. **breeding-mating.vue 不写入计算日期** — expected_checkup_date, expected_due_date, is_due_date_manual 未写入 details 对象。表单只展示了计算结果但未持久化，导致后续无法使用这些日期生成提醒任务。
5. **breeding-pregnancy.vue 缺少图片上传** — 孕检表单没有 B 超图片上传功能。

**中优先级缺失：**

6. **sale/detail.vue 不显示 refund_date** — 退款日期已录入但详情页不展示。
7. **sale/detail.vue 不显示成交日期(date)** — 只显示 delivery_date（交付日期），缺少成交日期。
8. **sale/detail.vue 不显示 created_by** — 无创建人信息。
9. **配种表单缺少手动修改预产期入口** — 提示文字说「可手动修改预产期」但无实际编辑交互。
