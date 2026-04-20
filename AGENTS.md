# 宠物繁育管理 APP

## 项目定位

个人使用的犬类繁育管理工具，当前服务 30-50 只马尔济斯犬。目标不是做通用平台，而是帮助繁育者把每天最该处理的事项快速看清、可靠记录、可持续迭代。

## 文档入口

- 协作入口以 `AGENTS.md` 为准，其他同类协作文件不再维护
- 总索引：`docs/README.md`
- 当前路线图：`docs/ROADMAP.md`
- 产品事实源：`docs/design/01-data-model.md`、`docs/design/02-features.md`
- 工程事实源：`docs/design/03-tech-stack.md`、`docs/design/04-implementation.md`
- 低频映射与审计：`docs/design/05-field-page-mapping.md`
- 记录表单验收：`docs/record-form-acceptance.md`

## 当前状态

- 技术栈：UniApp（Vue 3 + TypeScript + Pinia）+ UniCloud 云对象（支付宝云）+ UniCloud MongoDB
- 产品阶段：Phase 1 功能与性能优化已完成，当前进入验收测试与首页工作台密度优化阶段
- 当前里程碑：`首页工作台密度自适应优化`
- 当前焦点：Phase 1 `Workbench Contract & Test Foundation`
- 固定路线：契约/测试底座 → 繁育步骤工作台 → 健康批量优先工作台 → 用药状态工作台 → 逾期/计数/防闪回校准 → 今日重点

## 开发约定

- 代码变量名/函数名用英文，注释用中文，文档用中文
- 所有日期统一使用 timestamp 毫秒数（`Number`），业务口径按北京时间（UTC+8）
- 数据模型变更先更新 `docs/design/01-data-model.md`，再改代码
- 简单读取走 clientDB/JQL；多集合写入、状态推进、批量操作走云对象
- 支持软删除的集合统一使用 `deleted_at`
- 统计值实时查询计算，不做预存
- 提交信息使用 conventional commits

## 通用协作原则

- 先确认上下文和假设，再动手；遇到歧义先说明 tradeoff，不要默认猜测
- 只做用户明确要求的最小改动，不提前引入抽象、配置化或“顺手优化”
- 只改和当前任务直接相关的文件，避免波及无关代码、注释和格式
- 复杂任务先定义可验证的完成标准，再实现并验证
- 做 review 或验收反馈时，先给问题、风险和定位，再给摘要

## 执行 Checklist

- 改数据模型或字段语义前：先核对并更新 `docs/design/01-data-model.md`
- 改首页相关功能前：先核对固定结构、红点口径、提交承接和防闪回规则
- 改繁育、健康、用药流程前：先核对任务生成条件、状态推进和唯一性约束
- 改云对象或详情页刷新逻辑前：先检查多集合写入边界、timestamp 口径和重复请求风险
- 改完后：验证是否破坏来源页承接、局部移除、suppression 和 latest token 保护

## UI 与交互红线

- 公共样式统一放 `src/styles/common.scss`，由 `App.vue` 全局导入；页面 `scoped style` 只写差异
- 全局设置 `box-sizing: border-box`
- 详情页首屏信息区优先保证“可见和可点”；不要为了视觉压缩使用会遮挡内容的 sticky/负 margin 组合
- `BSheet`、`BModal`、`BDeleteConfirm` 打开时锁定页面滚动
- 表单中的互斥选项使用 pill-select；Segmented Control 仅用于视图/标签切换
- 记录表单提交反馈统一为“局部 loading + 弱成功反馈 + 来源页承接”；提交按钮统一支持 `默认 / 提交中 / 成功瞬态` 三态
- 犬只详情 Hero 区的犬名与副信息必须明确断行或留白，避免挤成同一行
- 犬只详情的「添加记录」弹窗与首页 FAB 统一设计语言，但保持对象上下文变体：
  保留一步直达；优先展示当前犬只/当前周期上下文；使用高密分组宫格；不回退成首页 FAB 的两层结构
- 犬只详情的「添加记录」弹窗与首页共享的记录类型图标/背景色，统一以首页「全部记录类型」为准；详情页只保留对象上下文文案差异

## 组件口径

- `BFormOptions` 仅用于健康记录表单；繁育表单统一使用 `BExtraArrangementSection`
- 记录表单按业务域统一：`HealthRecordForm`、`BreedingRecordForm`、`MedicationTaskForm`
- `/pages/record/*` 路由继续保留，对外是稳定 contract；新增/编辑逻辑不要重新散回各页
- 提交三态、旧 query 兼容和来源页反馈优先走共享逻辑（如 `useRecordSubmitState`、`recordFormRoutes`），不要单页复制
- `BDogPicker` 多选模式不保留确认按钮；点选、全选、取消全选实时回传；全选只作用于当前 `filteredDogs`

## 首页任务系统

### 固定结构

- 首页固定四层：`逾期 / 繁育 / 健康 / 用药`
- 今天页顺序固定：`逾期待处理` → `繁育流程` → `健康提醒` → `今日用药`
- 当前首页保持卡片直出，不恢复统一任务池、摘要卡、二级页或通用 Sheet
- 繁育主链 milestone 在首页按过程状态卡展示，不按普通待办卡展示
- 繁育步骤组优先使用“单步骤一张卡 + 组内犬只列表行”结构
- `breeding_extra_arrangement` 继续保持独立卡片，不并入繁育步骤组总卡

### 颜色、命名、动作

- 一级模块色只表达模块归属：`逾期=强 red`、`繁育=繁育色`、`健康=blue`、`用药=plum`
- 健康二级类型：`疫苗=blue`、`驱虫=teal`、`疾病=柔和 red`、`用药执行=plum`
- 疾病相关入口、卡片、标签、记录 icon、FAB 项统一使用红色语义
- 单条动作统一用 `处理`，集合动作统一用 `批量操作`
- 卡片动作统一遵循“主 CTA / 次 CTA / 文本动作”三级层级
- 卡头标题只表达卡片类型，不拼数量；副标题表达对象规模；右侧角标表达进度或项数

### 业务归属与防闪回

- 疾病不整体并入用药；观察中或治疗中但未开药仍留在健康区
- `medication_task` 即使未处理也留在 `今日用药`，不抬到逾期区
- 繁育主链是推进器，不是批量任务池；额外安排属于繁育区独立子层，不混入健康提醒
- 来源页提交成功后，先做前端本地承接，再做后台刷新
- 批量卡返回后只能移除后端真实 `completedTasks`
- 只有 `completedTasks.length === sourceTaskIds.length` 时整张批量卡才可消失
- 本地局部移除后要加入短期 suppression，服务端刷新时先过滤，避免闪回
- 修改首页加载链路时必须保留 latest token 保护；`dayCounts[todayTs]` 必须在 `Promise.all` 后统一写入
- 今日红点以实际可见卡片数为准，不能依赖后端 `counts.today`；未来日期只有用药卡也必须有红点

## 繁育口径

- 当前主链：`发情 → 建议卵泡检查 → 配种 → 建议孕检 → 生产 → 确认断奶`
- 主链 milestone 在首页只允许作为过程状态参考，真实关闭依赖记录页提交成功
- `heat_observation` 属于繁育域，只允许挂已有且状态为 `发情中` 的周期；不自动补建周期、不推进主链、不生成任务、不联动费用
- 发情、卵泡、配种、孕检、产检、临产、异常终止页都移除旧的“下次提醒”逻辑
- 发情观察入口只放繁育链路：犬只详情 `发情中` Banner、繁育周期详情的 `添加记录`、首页 `建议卵泡检查` 行弱动作 `观察`
- 首页 `建议卵泡检查` 行允许弱文本动作 `直接配种` 直达配种记录页；这不是任务态 `跳过`
- 首页 `建议孕检` 行允许弱文本动作 `继续配种` 直达配种记录页；这不是任务态 `跳过`，也不能提前关闭当前孕检 milestone
- 首页繁育步骤分组标题中，`mating` 组显示为 `建议配种`；卡片内阶段小标签仍保持 `配种`
- 首页 `配种` 行文案优先显示 `发情第 X 天`，其次显示 `卵泡检查后第 Y 天`；超窗时单独显示 `建议配种窗已过 Z 天`
- 配种方式选项顺序统一为 `人工授精` 在前、`自然交配` 在后；新建与编辑默认选中 `人工授精`
- 配种记录中的 `details.mating_number` 表示“本周期第几脚”；由系统按同周期已有配种记录数自动递增计算，前端只展示不允许手改
- 首页 `建议孕检`、`待产` 等后续主链文案可读取 `mating_number`，按“距第 N 脚配种第 X 天”展示
- 首页 `待产` 行允许补充弱文本动作 `产检`；只要当前 `birth` milestone 仍挂周期且可进入上下文，就常驻显示
- 首页 `待产` 行允许补充弱文本动作 `临产`；仅在距预产期 5 天内显示，预产期当天和超期后仍可继续进入 `临产监测`
- 额外安排字段只包含 `kind + due_date + notes`，由 `breeding-service.addBreedingRecord` 同次提交创建
- 繁育记录编辑页与新增页共用同一套 `BExtraArrangementSection` 口径；编辑时只同步当前记录关联的额外安排任务
- 完成、推迟、跳过额外安排只作用于任务本身，不生成 `breeding_record`
- `breeding_milestone` 必须按 `details.step_type` 路由；新生成的 `mating` milestone 需要带 `details.heat_date` 和 `details.follicle_check_date`
- 孕检记录在 `confirmed=是` 提交成功后，必须继续生成下一步 `birth` milestone；首页流程不断链，`处理` 直达 `birth-wizard`
- 首页 `birth` milestone 的阶段标题显示为 `待产`，日期口径显示为 `预产期`；不改实际记录页入口与状态推进
- 首页 `待产` 行的 `产检 / 临产` 都属于上下文快捷入口，不关闭 `birth` milestone，不影响首页计数、红点、suppression 和来源页承接规则
- 首页进入繁育流程页时必须传 `dogId + dogName + cycleId + taskId + locked=true`
- 犬只详情的「添加记录」弹窗需要提供 `生产记录` 入口，并直达 `birth-wizard`；缺少当前周期时提示不可记录，不进入空页
- `birth-wizard` Step 2 的幼崽昵称字段保持 `选填`；未填写时需给出弱提示，并在提交生产记录时自动写入默认名 `<母犬名>窝-<录入序号>号`
- `birth-wizard` Step 3 需要提供 `经验心得（选填）`，并允许显式勾选 `首次驱虫提醒 / 首次疫苗提醒`
- 生产记录页勾选的 `首次驱虫提醒 / 首次疫苗提醒` 只创建普通健康待办，不创建真实 `health_record`，且仅对存活幼崽生效
- 繁育记录删除当前仅开放给 `heat_observation`

## 健康与用药口径

- 健康提醒默认是建议型；只有显式 `create_task=true` 或勾选「创建下次待办」才生成任务
- 首页批量完成疫苗/驱虫必须同时创建真实 `health_record`
- 同一犬只同一药名只允许一个进行中的用药任务
- 已超过疗程天数的旧用药任务，在同狗同药名重复检测/创建链路中先自动收口为 `已完成`
- 重复用药弹窗分为“将创建”和“已有同名任务”两段；重复犬默认不勾选覆盖
- 覆盖的语义是“取消旧任务 + 创建新任务”
- 用药任务主状态表达疗程是否结束；未全量完成时通过详情页或副文案表达 `部分完成`
- 用药详情页的主实体是 `medication_task`；跳转和详情查询优先使用用药任务 ID

## 犬只状态与疾病唯一性

- 犬只详情“当前状态”表达当前仍生效且需要理解/处理的状态集合，不是时间线
- 犬只详情“当前状态”卡按“标题 + 副标题 + 进度 + 辅助信息”层级展示；优先表达当前业务含义，不退化成只有状态名的一行列表
- 状态优先级统一：`疾病` → `用药` → `怀孕/哺乳` → `发情`
- 状态点击口径：`生病中 → 健康记录详情`、`用药中 → 用药任务详情`、`怀孕/哺乳/发情 → 繁育周期详情`，只有缺少稳定标识时才回退到状态操作入口
- 犬只详情状态跳转和健康/用药列表跳转必须兼容 camelCase 与 snake_case；至少兼容 `recordId/record_id`、`taskId/task_id/medication_task_id`、`cycleId/cycle_id`
- 犬只详情“用药中”状态按药名聚合时，必须优先展示最新疗程：先比 `actual_start_date`，再比 `updated_at/created_at`
- 犬只详情“生病中”状态优先显示 `病名 + 第 X 天`；病程天数优先取 `illness.details.start_date`，缺失时回退 `record.date`
- 犬只列表疾病只占一个 tag；多个疾病做摘要聚合
- 同一只狗在 `details.treatment_status !== 已康复` 时，不允许存在同病名重复疾病记录；前端可预检查，但 `health-service` 必须做服务端兜底
- 发现历史重复疾病时，保留最近活跃的一条，其余做软性收口并迁移引用

## 财务与入口口径

- 统一记账页入口为 `pages/finance/expense-add.vue?type=income`；`income-add.vue` 视为弃用
- 收入手动类型固定为 `销售 / 定金保留 / 领养 / 其他`
- 支出关联支持 `犬只 / 窝 / 繁育周期 / 无关联`
- 收入关联只支持 `犬只 / 无关联`
- 点选关联即生效，不增加二次确认

## 云函数与页面刷新

- 云函数内禁止使用未定义常量
- 毫秒常量直接写字面量 `86400000`，不要定义全局 `DAY_MS`
- 详情页如果既要首屏加载又要子页返回刷新，必须避免 `onLoad` 和紧随其后的 `onShow` 双请求
- 犬只详情页从子页返回时默认保留现有内容并静默后台刷新；只有首屏加载才进入整页骨架
- 犬只详情页的静默刷新只在来源页有提交反馈时触发；实现时要保留 latest token / 请求令牌保护
- 详情页路由参数改口径时要保留旧入口兼容；例如主口径改为 `id` 后，仍需兼容历史 `taskId`、`recordId/record_id`、`medicationTaskId/medication_task_id`
- 当前记录域重构后的回归验证优先按 `docs/record-form-acceptance.md` 执行

## 已知限制

- V1 是单家庭模式；`_before` 拦截器默认从用户信息直接注入 `familyId`
- V1 在线优先，不支持离线操作和冲突解决

## graphify

- 做架构或代码结构判断前，先看 `graphify-out/GRAPH_REPORT.md`
- 业务域明确时，优先看对应 `graphify/worksets/`
- 当前高频 workset：`home-attention`、`breeding-record`、`health-medication`、`shared-form-system`、`finance`、`dog-profile`、`family-auth`、`sales-flow`、`health-ops`
- 可用 `./scripts/graphify-workset.sh show <workset>` 查看范围
- 若 `graphify-out/graph.json` 缺失，先在仓库根目录执行 `$graphify .`
- 仅在本次会话修改了代码文件后，才需要执行 `./scripts/graphify-rebuild.sh`
