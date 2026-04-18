# 宠物繁育管理 APP

## 项目定位

个人使用的犬类繁育管理工具，当前服务 30-50 只马尔济斯犬。目标不是做通用宠物平台，而是帮助繁育者把每天最该处理的事项快速看清、可靠记录、可持续迭代。

## 文档入口

- 协作入口以 `AGENTS.md` 为准，其他同类协作文件不再维护
- 总索引：`docs/README.md`
- 当前路线图：`docs/ROADMAP.md`
- 产品事实源：`docs/design/01-data-model.md`、`docs/design/02-features.md`
- 工程事实源：`docs/design/03-tech-stack.md`、`docs/design/04-implementation.md`
- 低频映射与审计：`docs/design/05-field-page-mapping.md`

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
- 先定义可验证的完成标准，再实现并验证结果，复杂任务要有明确检查点

## 输出与协作补充

- 提交信息保持简洁，使用 conventional commits，标题优先表达变更意图与原因，避免冗长罗列实现细节
- 做 review 或验收反馈时，先给问题、风险和定位，再给摘要；避免寒暄式空话
- `AGENTS.md` 只保留高频协作规则、当前阶段、关键红线和执行 checklist；长篇背景、设计细节与低频说明统一回收到 `docs/`
- 以上约束仅作用于输出表达和文档组织，不得牺牲上下文确认、风险说明、tradeoff 暴露和结果验证

## 任务执行 Checklist

- 改数据模型或字段语义前，先核对并更新 `docs/design/01-data-model.md`
- 改首页相关功能前，先核对固定结构、红点口径、提交承接和防闪回规则
- 改繁育、健康、用药流程前，先核对任务生成条件、状态推进和唯一性约束
- 改云对象或详情页刷新逻辑前，先检查多集合写入边界、timestamp 口径和重复请求风险
- 改完后先验证是否破坏来源页承接、局部移除、suppression 和 latest token 保护

## UI 与交互约束

- 公共样式统一放 `src/styles/common.scss`，由 `App.vue` 全局导入；页面 `scoped style` 只写差异
- 全局设置 `box-sizing: border-box`
- 详情页首屏信息区优先保证“可见和可点”；不要为了视觉压缩使用会遮挡内容的 sticky/负 margin 组合
- `BSheet`、`BModal`、`BDeleteConfirm` 打开时锁定页面滚动
- 表单中的互斥选项使用 pill-select；Segmented Control 仅用于视图/标签切换
- 记录表单提交反馈统一为“局部 loading + 弱成功反馈 + 来源页承接”，不要退回强 success toast 驱动
- 提交按钮统一支持 `默认 / 提交中 / 成功瞬态` 三态
- 后续反馈优化优先补 `Undo / 可撤销`

## 组件口径

- `BFormOptions` 仅用于健康记录表单，封装“标记为待办 + 日期 chips + 提醒开关”
- 疫苗/驱虫页使用显式文案「创建下次待办」，默认关闭
- 繁育表单不再复用 `BFormOptions`，统一使用 `BExtraArrangementSection`
- `BDogPicker` 多选模式不保留确认按钮；点选、全选、取消全选都要实时回传
- `BDogPicker` 的全选只作用于当前 `filteredDogs`

## 首页任务系统口径

### 固定结构

- 首页固定四层：`逾期 / 繁育 / 健康 / 用药`
- 今天页顺序固定：`逾期待处理` → `繁育流程` → `健康提醒` → `今日用药`
- 当前首页保持卡片直出，不要恢复统一任务池、摘要卡、二级页或通用 Sheet
- 繁育主链 milestone 在首页按过程状态卡展示，不按普通待办卡展示
- 繁育主链的建议日期只做流程判断参考，不升级为逾期待办
- 繁育步骤组优先使用“单步骤一张卡 + 组内犬只列表行”结构，不回退为每犬独立大卡
- `breeding_extra_arrangement` 继续保持独立卡片，不并入繁育步骤组总卡

### 颜色与命名

- 一级模块色只表达模块归属：`逾期=强 red`、`繁育=繁育色`、`健康=blue`、`用药=plum`
- 健康二级类型：`疫苗=blue`、`驱虫=teal`、`疾病=柔和 red`、`用药执行=plum`
- 疾病相关入口、卡片、标签、记录 icon、FAB 项统一使用红色语义
- 单条动作统一用 `处理`，集合动作统一用 `批量操作`
- 从首页进入的批量 Sheet 统一命名为 `XX批量操作`

### 卡片与动作层级

- 卡片动作统一遵循“主 CTA / 次 CTA / 文本动作”三级层级
- 主 CTA 用实底，可带图标；次 CTA 用浅底或描边；弱动作仅文本
- 行内 chip 只做次级动作，强度必须弱于卡片底部主按钮
- `疾病观察` 与 `今日用药` 的底部动作布局保持同构，只允许模块色不同

### 卡头信息

- 标题只表达卡片类型，不拼数量
- 副标题表达对象规模，如 `12只犬`
- 右侧角标表达进度或项数，如 `0/12`、`14项`
- `疾病观察` 固定口径：标题=`疾病观察`，副标题=`X只犬`，角标=`X项`
- 疫苗/驱虫批量卡 `groupTitle` 只保留业务标题，数量放副标题
- 首页分区/子分区/卡头角标统一对齐 `docs/ui/home-v1-final.html#H-1` 的轻量圆角标风格，不使用过厚的胶囊感

### 业务归属

- 疾病不整体并入用药；观察中或治疗中但未开药仍留在健康区
- `medication_task` 即使未处理也留在 `今日用药`，不抬到逾期区
- 繁育主链是推进器，不是批量任务池
- 额外安排属于繁育区独立子层，不混入健康提醒
- 繁育主链卡主动作统一为 `处理`，不提供 `推迟 / 跳过`

### 提交返回与防闪回

- 来源页提交成功后，先做前端本地承接，再做后台刷新
- 批量卡返回后只能移除后端真实 `completedTasks`
- 只有 `completedTasks.length === sourceTaskIds.length` 时整张批量卡才可消失
- 本地局部移除后要加入短期 suppression，服务端刷新时先过滤，避免闪回
- 批量卡部分完成时，要同步 `tasks`、`dogs`、`progress.total`、副标题数量和角标

## 首页红点与加载链路

- `loadAll()` 并行执行 `loadTodayCards()`、`loadDateCounts()`、`loadWeekCache()`
- 修改首页加载链路时必须保留 latest token 保护
- `dayCounts[todayTs]` 必须在 `Promise.all` 后统一写入
- 今日红点以实际可见卡片数为准，不能依赖后端 `counts.today`
- 未来日期如果只有用药卡，也必须有红点

## 繁育口径

- 当前主链：`发情 → 建议卵泡检查 → 配种 → 建议孕检 → 生产 → 确认断奶`
- 主链 milestone 在首页只允许作为过程状态参考，真实关闭依赖记录页提交成功
- 繁育主链首页展示口径：组标题表达步骤，组内单犬只保留 `犬名 + 弱步骤标签 + 时间主线 + 处理`；`建议卵泡检查` 行可补充弱文本动作 `观察 / 直接配种`
- `heat_observation` 归属繁育域，作为发情周期内补充观察日志写入 `breeding_records`，不归到 `health_records`
- `heat_observation` 只允许挂已有且状态为 `发情中` 的周期；不自动补建周期，不推进主链，不生成任务，不联动费用
- `heat_observation` 表单固定为 `外阴状态 + 分泌物状态 + 行为征兆 + 备注`，其中 `分泌物状态` 为必填
- 发情、卵泡、配种、孕检、产检、临产、异常终止页都移除旧的“下次提醒”逻辑
- 发情观察入口放在繁育链路：犬只详情 `发情中` Banner、繁育周期详情的 `添加记录`、首页 `建议卵泡检查` 行的弱文本动作 `观察`；不放健康入口/FAB
- 首页 `建议卵泡检查` 行允许弱文本动作 `直接配种` 直达配种记录页；这不是任务态 `跳过`
- 配种方式选项顺序统一为 `人工授精` 在前、`自然交配` 在后；新建与编辑配种记录默认选中 `人工授精`
- 额外安排字段只包含 `kind + due_date + notes`
- 额外安排由 `breeding-service.addBreedingRecord` 同次提交创建 `breeding_extra_arrangement`
- 完成、推迟、跳过额外安排只作用于任务本身，不生成 `breeding_record`
- `breeding_milestone` 必须按 `details.step_type` 路由
- 首页进入繁育流程页时必须传 `dogId + dogName + cycleId + taskId + locked=true`
- 繁育记录删除当前仅开放给 `heat_observation`；主链记录默认不提供删除入口，避免破坏周期状态语义

## 健康与用药口径

- 健康提醒默认是建议型；只有显式 `create_task=true` 或勾选「创建下次待办」才生成任务
- 首页批量完成疫苗/驱虫必须同时创建真实 `health_record`
- 同一犬只同一药名只允许一个进行中的用药任务
- 重复用药弹窗分为“将创建”和“已有同名任务”两段；重复犬默认不勾选覆盖
- 覆盖的语义是“取消旧任务 + 创建新任务”

## 犬只状态与疾病唯一性

- 犬只详情“当前状态”表达当前仍生效且需要理解/处理的状态集合，不是时间线
- 状态优先级统一：`疾病` → `用药` → `怀孕/哺乳` → `发情`
- 犬只详情状态点击口径：优先进入对应业务详情/流程；`生病中 → 健康记录详情`、`用药中 → 用药任务详情`、`怀孕/哺乳/发情 → 繁育周期详情`，只有缺少稳定标识时才回退到状态操作入口
- 犬只详情状态跳转和健康/用药列表跳转必须兼容 camelCase 与 snake_case 标识字段；至少兼容 `recordId/record_id`、`taskId/task_id/medication_task_id`、`cycleId/cycle_id`
- 犬只列表疾病只占一个 tag；多个疾病做摘要聚合
- 同一只狗在 `details.treatment_status !== 已康复` 时，不允许存在同病名重复疾病记录
- 前端可预检查，但 `health-service` 必须做服务端兜底校验
- 发现历史重复疾病时，保留最近活跃的一条，其余做软性收口并迁移引用

## 财务与入口口径

- 统一记账页入口为 `pages/finance/expense-add.vue?type=income`
- `income-add.vue` 视为弃用
- 收入手动类型固定为 `销售 / 定金保留 / 领养 / 其他`
- 支出关联支持 `犬只 / 窝 / 繁育周期 / 无关联`
- 收入关联只支持 `犬只 / 无关联`
- 点选关联即生效，不增加二次确认

## 云函数与页面刷新

- 云函数内禁止使用未定义常量
- 毫秒常量直接写字面量 `86400000`，不要定义全局 `DAY_MS`
- 详情页如果既要首屏加载又要子页返回刷新，必须避免 `onLoad` 和紧随其后的 `onShow` 双请求
- 详情页路由参数改口径时要保留旧入口兼容；例如详情页主口径改为 `id` 后，仍需兼容历史 `taskId` 等旧查询参数

## 已知限制

- V1 是单家庭模式；`_before` 拦截器默认从用户信息直接注入 `familyId`
- V1 在线优先，不支持离线操作和冲突解决

## graphify

本项目的知识图谱位于 `graphify-out/`。

- 做架构或代码结构判断前，先看 `graphify-out/GRAPH_REPORT.md`
- 业务域明确时，优先看对应 `graphify/worksets/`
- 当前高频 workset：
  - `home-attention`
  - `breeding-record`
  - `health-medication`
  - `shared-form-system`
  - `finance`
  - `dog-profile`
  - `family-auth`
  - `sales-flow`
  - `health-ops`
- 可用 `./scripts/graphify-workset.sh show <workset>` 查看范围
- 若 `graphify-out/graph.json` 缺失，先在仓库根目录执行 `$graphify .`
- 仅在本次会话修改了代码文件后，才需要执行 `./scripts/graphify-rebuild.sh`
