# TODOS

## Phase 1 开发前

### ~~TODO-1: 初始化 git 仓库 + UniApp 项目脚手架~~ ✅
已完成。项目已初始化，远程仓库 https://github.com/lobclaw/breed-app

### ~~TODO-2: 写 Phase 1 实现计划文档~~ ✅
已完成。见 `docs/design/08-implementation-plan.md`

### TODO-3: 验证设计审查 HIGH 级问题的修复
**What:** 开发时验证 H1-H5 是否在设计文档中真正解决：
- H1: 软删除查询范围（01 软删除范围矩阵）
- H2: 繁育状态机异常转换（01 异常状态转换规则表）
- H3: 首页卡片合并规则（03 合并优先级 + 冲突场景示例）
- H4: 窝号动态计算边界（01 窝号边界处理）
- H5: 图片上传规范（05 section 5.7）
**Why:** 审查报告标注这些问题已解决，但需要在实现时再次确认。
**Context:** 07-design-audit.md 记录了所有问题。各问题的修复位置已标注。
**Depends on:** 开发过程中逐步验证

### ~~TODO-4: 修复 breeding_cycles 软删除文档矛盾~~ ✅
已确认无矛盾。01 文档 schema 和 DB schema 文件均无 deleted_at，与软删除矩阵一致。所有标注「否」的集合 schema 文件均已正确。

### ~~TODO-5: 护理规则任务的审计逻辑设计~~ ✅
已完成。在 03 文档 Layer 3 审计范围中补充了 care_rules 独立审计逻辑：通过 `dog_id + type=care_group + title 匹配` 判断任务是否存在。

### ~~TODO-6: 显式标注 V1 单家庭限制~~ ✅
已确认。CLAUDE.md 和 04 文档 section 8.4 均已标注。

## 工程审查确认的架构决策

以下决策在 /plan-eng-review (2026-03-26) 中确认，开发时直接执行：

1. **云对象组织:** 6个按业务模块分（dog/breeding/health/finance/task/family-service）
2. **状态管理:** 混合模式（Pinia 缓存低频 + composables 清查高频）
3. **事务一致性:** 顺序写入 + 每日审计兜底，不做跨集合回滚
4. **犬只状态查询:** 云对象聚合查询（服务端组装）
5. **首页卡片:** 服务端合并算法（task-service.getHomeCards()）
6. **数据隔离:** common/ auth 拦截器（_before 注入 familyId）
7. **错误处理:** 云对象 _after 统一包装 + 前端 useCloudCall() 封装
8. **首页缓存:** 前端 5 分钟缓存，操作后主动刷新
9. **测试策略:** vitest 测试云对象 + 工具函数，目标 80%+ 云对象覆盖率

## ~~待办：首页优化第二轮~~ ✅ 全部完成（2026-04-01）

### ~~TODO-7: 拆健康关注卡为两张独立卡片~~ ✅
**What:** 当前健康关注卡混合了可操作内容（用药 checkbox）和纯信息内容（疾病观察）。拆为：
- **今日用药卡**：sick_with_med + med_only，有 checkbox + 完成/推迟按钮
- **疾病观察卡**：sick_only，只有康复按钮 + 折叠逻辑
- sick_with_med 只在用药卡出现（不重复）
**Why:** 顶级 app 的共同规则：可操作的和纯信息的永远不混在同一个容器里。当前合并导致按钮归属不清、进度计数矛盾（6只犬但 0/2）、折叠逻辑复杂。
**Effort:** 涉及后端 mergeTasks Round 1 拆分 + 前端 MedicationCard 拆为两个组件

### TODO-19: 页面 FAB 改为顶部右上角按钮（消除与底部导航 + 的视觉冲突）
**What:** 档案页和财务页右下角的 FAB 浮动按钮和底部导航栏中间的 "+" 按钮视觉冲突（同色同形同区域）。改为顶部右上角按钮：
- 档案页：标题栏右侧 "+" → 添加犬只
- 财务页：标题栏右侧 "+" → 添加收支
- 去掉页面内的 FAB 组件
- 底部导航 "+" 保持不变（通用 BFabSheet 智能推荐）
**Why:** 顶级 app 规则：同一屏幕只有一个"添加"圆按钮。通用入口在底部导航，页面专属入口在顶部，位置和语义分离。
**Effort:** S（两个页面改按钮位置，去掉 FAB 组件引用）

### TODO-18: 犬只详情页整体 UI 对齐设计稿
**What:** 犬只详情页（pages/dog/detail.vue）整体布局和设计稿差距大，需要逐区域对齐：
- Hero 区：头像、名字、品种·性别·年龄、状态标签、角色标签的排版和间距
- 快捷统计条：年龄/体重/繁育窝数的图标和数字样式
- Tab 区：概览/繁育/健康/财务的切换样式
- 概览 tab：最近健康记录列表样式（TODO-11）、详细信息区折叠面板样式
- 繁育 tab：当前周期时间线卡片（TODO-17）、历史周期列表
- 健康 tab：记录体重/体重趋势按钮、健康记录列表
- 财务 tab：收支汇总和记录列表
- 更多菜单（...按钮）：BSheet 替代原生 ActionSheet（TODO-13）
- 参考设计稿 D-2 及 D-S1~S6 子视图，保留现有功能按钮
**Why:** 当前实现功能基本完整，但 UI 排版和设计稿差距明显，影响整体品质感。
**Effort:** L（逐区域调整样式，不改功能逻辑）

### TODO-17: 繁育 tab 三个问题修复
**What:**
1. **BUG：提交发情记录后不刷新** — 提交后繁育 tab 数据不更新，需要手动刷新才能看到新记录
2. **缺少发情观察入口** — 当前周期处于"发情中"时，应有入口录入每日发情观察（heat-observation.vue 已存在但无入口）
3. **当前周期样式不符合设计稿** — 当前实现是列表行样式（和历史周期一样），设计稿是时间线卡片：
   - 卡片标题：第N次繁育周期 + 种公名 + 状态标签
   - 时间线节点：发情记录 → 卵泡检查 → 配种 → 孕检确认 → 怀孕中(第X天) → 待生产
   - 每个节点显示日期+摘要，已完成节点实心圆，未完成空心圆
   - 参考设计稿图2
**Why:** 繁育管理是 app 核心功能之一，当前实现与设计稿差距大，体验粗糙。
**Effort:** L（时间线组件开发 + 数据聚合 + 发情观察入口 + 刷新逻辑修复）

### TODO-16: "标记状态"面板简化 + "去向管理"UI优化
**What:**
标记状态面板简化：
- 去掉"退休"（已在去向管理）
- 去掉病种子选项（在疾病表单里选）
- 保留三项：记录疾病（→疾病表单）、开始用药（→用药表单）、标记康复（多条疾病时弹选择）
- 跳转表单时锁定当前犬只（配合 TODO-14）

去向管理 UI 优化：
- 原生 ActionSheet → BSheet + 图标列表（和全局风格统一）
- 每个操作（已故/领养/赠送/退休）点击后弹确认 BSheet（日期+备注+确认按钮）
- 参考设计文档 disposition 字段定义（01-data-model.md）
**Why:** 标记状态面板选项混乱（生病和康复方向相反、退休重复、病种不该在这选）。去向管理操作不可逆需确认。
**Effort:** M

### TODO-15: 编辑犬只接口不生效 + 可编辑字段限制（BUG + 优化）
**What:**
- BUG：编辑犬只提交后修改不生效（昵称等未更新），需排查后端 updateDog 接口
- 优化：编辑页面限制可修改字段
  - 可编辑：名字、角色（幼崽→种狗方向）、芯片号、出生日期（加确认）、来源、备注、照片、购入价格
  - 不可编辑：性别、品种（生物学属性，录入后锁定，显示为只读）
**Why:** 性别和品种改了会影响繁育逻辑和数据一致性。编辑不生效是功能缺陷。
**Effort:** M（排查后端 bug + 前端编辑页字段分为可编辑/只读两组）

### TODO-14: 从犬只详情页进入录入表单时自动选中当前犬只
**What:** 从犬只详情页点"添加记录"跳转到各录入表单（疫苗/驱虫/疾病/配种等），当前犬只应自动选中且不可修改：
- URL 传递 `dogId` + `dogName` + `locked=true` 参数
- 表单页 onLoad 时如果有 `dogId`，自动选中该犬并锁定选择器（显示为只读，不可点击）
- 从 FAB/首页进入时无 `locked` 参数，犬只选择器正常可用
**Why:** 从犬只详情页进入，犬只已确定，让用户再选一次是多余操作，还可能误选其他犬。
**Effort:** M（涉及所有录入表单页的 onLoad 逻辑 + BDogPicker 增加 locked/readonly 模式）

### TODO-13: 犬只详情页"添加记录"弹窗样式统一
**What:** 犬只详情页的"添加记录"和繁育 tab 的"添加记录"使用原生 `uni.showActionSheet`（白底分隔线风格），和 app 整体设计不一致。改为 BSheet + 图标列表，和首页健康关注卡操作菜单一致：
- 每个选项带 material icon + 文字
- BSheet 底部弹出，圆角，有拖拽手柄
- 统一所有页面的 ActionSheet 为 BSheet 风格
**Why:** 原生弹窗和 app 的圆角、品牌色、字体不一致，体验割裂。
**Effort:** M（涉及犬只详情页 detail.vue 的多个 ActionSheet 替换）

### TODO-12: 单犬体重录入接口缺失（BUG）
**What:** 犬只详情页"记录体重"保存报错 `Method[addWeightRecord] was not found`。前端调用 `health-service.addWeightRecord`，但后端只有 `batchAddWeights`（批量接口，给窝用的）。需要在 health-service 添加 `addWeightRecord` 方法，支持单犬体重录入。
**Why:** 单犬体重录入完全不可用。
**Effort:** S（后端加一个方法，创建 health_record type=weight + 更新 dog.latest_weight）

### TODO-11: 犬只详情页健康记录列表样式优化
**What:** 概览页"最近健康记录"和健康 tab"健康记录"列表样式问题：
- 类型名称和日期紧贴无间距（"疾病 · QA 测试2026-03-31" → "疾病 · QA 测试 · 2026-03-31"）
- "疫苗 · 32026-03-30" 疫苗类型和日期粘连
- 图标、文字、日期、箭头间距不均
- 健康 tab 的"健康记录 1"badge 样式和全局不统一
**Why:** 当前排版粗糙，信息可读性差。参考设计稿 D-2 犬只详情页 D-S3 健康记录区的布局规范。
**Effort:** S（前端样式调整 + 数据格式化）
**参考:** docs/design/05-field-page-mapping.md D-S3 健康记录区字段映射

### TODO-10: 犬只档案列表状态标签显示疾病名称
**What:** 当前犬只列表的健康状态标签只显示"生病中"，多条疾病时出现重复的"生病中 生病中"。改为显示具体疾病名称：
- 1号：`生病中 生病中` → `测试感冒` `感冒`
- 大桥：`生病中 生病中` → `感冒` `腹泻`
- 4号：`生病中 用药中` → `寄生虫` `用药中`
**Why:** "生病中"没有信息量，重复显示更无意义。疾病名称让用户在列表页就能了解每只犬的健康状况。
**Effort:** S（修改犬只列表页的状态标签渲染逻辑，从 health_records 取 condition 字段）

### TODO-9: 疾病观察卡圆点颜色按严重程度区分
**What:** 当前 sick_only 行的圆点统一红色。改为按疾病严重程度变色：
- 轻微 → 灰色（低优先级，不抢注意力）
- 中等 → 琥珀色/橙色（需要关注）
- 严重 → 红色（紧急，优先处理）
**Why:** 用户扫一眼颜色就知道哪只犬需要优先处理，零额外 UI 元素。
**Effort:** S（后端 mergeTasks 传 severity 字段 + 前端 sick-dot 样式按 severity 变色）

### TODO-8: 驱虫表单优化
**What:**
- 驱虫类型默认选中"内驱"（当前无默认值，用户每次需要手动点）
- 驱虫药品标签加"（选填）"提示
- 球虫清/甲硝唑等连续多天用药场景，引导用户使用"开始用药"流程而非驱虫表单
**Why:** 繁育场景 90% 是内驱常规驱虫，默认值减少操作。多天疗程（球虫/滴虫）本质是用药疗程，驱虫表单只能录单次。
**Effort:** S（前端改 health-deworming.vue 默认值 + 标签文案）

### TODO-20: 财务列表筛选全部不生效（BUG）
**What:** 财务页月份切换、收入/支出 tab、分类筛选三个维度均不生效，始终显示全部数据。
**根因：** 后端 `finance-service.getTransactionList` 只处理 `startDate`/`endDate` 参数，前端传的 `month`/`year`/`type`/`category` 全部被忽略。
**需修复：**
- 后端 `getTransactionList` 接收 `{ month, year, type, category }` 并构建正确的日期范围查询 + 类型/分类过滤
- 收入(`incomes`)和支出(`expenses`)分开按类型过滤（全部时两表都查，收入只查 incomes，支出只查 expenses）
- 分类筛选：expenses 按 `category` 过滤，incomes 不过滤（分类仅适用于支出）
**Effort:** S（纯后端，改 getTransactionList 约 20 行）

### TODO-21: 财务汇总和统计不随月份变化（BUG）
**What:** 财务主页汇总卡片（本月收入/支出/净利润）和财务统计页，切换月份后数据不更新，始终显示当前月。
**根因：** 后端 `getFinancialSummary(period)` 接收的是整个对象 `{period, month, year}`，但内部做 `period === 'yearly'` 字符串比较（永远 false），并始终用 `new Date()` 作为时间基准，完全忽略传入的 month/year。
**需修复：**
- 后端 `getFinancialSummary` 解构 `{ period, month, year }` 并按 month/year 计算 startDate/endDate
- 年度模式下按 year 计算全年范围
**Effort:** S（纯后端，改 getFinancialSummary 约 10 行）

### TODO-22: 财务统计页 UI 优化
**What:** `finance/stats.vue` UI 与设计稿差距明显，需要按设计稿重新排版：
- 汇总卡片样式（2x2 网格当前过于简陋）
- 支出分类和收入来源的条形图样式（颜色、圆角、间距）
- 月度/年度切换控件样式
- 月份选择器与主页保持一致
**Why:** 统计页是财务模块的核心数据呈现，当前实现信息密度低、可读性差。
**Effort:** M（前端 stats.vue 样式调整，TODO-21 修完后数据自然正确）

### TODO-23: 财务分类筛选弹窗样式优化
**What:** 财务页的分类筛选 BSheet（点击 tune 图标弹出）样式需对齐设计稿：
- 当前是简单列表行，需要改为 pill-select 风格（胶囊圆角、选中高亮）
- "全部分类"放在最前面
- 支出分类和收入分类按当前 activeFilter（收入/支出 tab）动态显示对应选项
**Why:** 收入没有 category 字段，当 tab 选"收入"时显示支出分类是误导性的。
**Effort:** S（前端 index.vue 分类选项动态化 + pill 样式）

### TODO-24: 用药方案库优化（骨架屏 + 缓存 + 新建弹窗）
**What:**
1. **骨架屏**：当前 `<BSkeleton :rows="3" />` 是通用占位，需改为按真实卡片比例的骨架（方案名行 + 两个 tag 行）
2. **缓存优先**：有 protocolStore 缓存时直接显示（无骨架屏闪烁），后台静默刷新
3. **新建改为 BSheet**：当前点击"新建"展开页面内嵌表单（`showAdd = true`），改为从底部弹出 BSheet，包含：方案名、药品名、疗程天数、给药方式/频率、备注、保存按钮
**Why:** 内嵌表单破坏列表布局，BSheet 是 app 统一交互模式（和首页停止用药确认一致）。
**Effort:** M（骨架屏 S + 缓存策略 S + 新建改 BSheet M）

### TODO-25: 合作代理人新建改为 BSheet
**What:** `sale/agents.vue` 点击"新建"目前是 `showAdd = true` 展开页面内嵌表单，和用药方案库是同一问题。改为从底部弹出 BSheet，包含：代理人姓名、联系方式（选填）、保存/取消按钮。编辑现有代理人也应走同一 BSheet（复用，editingId 控制标题和操作）。
**Why:** 内嵌表单出现在列表下方，布局突兀，和 app 整体 BSheet 交互模式不一致。
**Effort:** S（和 TODO-24 同模式，改 agents.vue）

### TODO-26: 护理规则三个问题
**What:**
1. **验证失败弹窗自动关闭（BUG）**：BModal 的 `confirm()` 方法硬编码 `emit('update:visible', false)`，无论 `@confirm` 回调验证是否通过都会关闭弹窗。修复：BModal 增加 `:manual-close` prop（默认 false），设为 true 时 confirm 只 emit 事件不自动关闭，由父组件控制 visible。care-rules.vue 中验证失败时不设 `showModal = false`，验证通过后手动关闭。
2. **新建/启用/删除后刷新慢（BUG）**：`addCareRule` / `removeCareRule` 后调用 `loadFamily()` 走网络全量重载，操作有明显延迟。改为乐观更新：直接修改 `currentFamily.value.care_rules` 数组 + 同步本地缓存，无需等待网络。
3. **启用模板按钮无反馈**：点击"+ 启用"后等待 loadFamily() 期间没有加载状态，应加 loading 状态或改为乐观更新（同上）。
**Effort:** M（BModal 改 1 个组件 S + care-rules.vue 乐观更新 M）

### TODO-27: 护理规则删除弹窗 UI 优化 + 乐观删除
**What:**
1. **删除确认弹窗改用 BDeleteConfirm**：当前用 `uni.showModal`（原生系统弹窗），项目已有 `BDeleteConfirm` 组件（警告图标 + 红色确认按钮 + "30天内可恢复"提示）完全没有使用。直接替换。
2. **乐观删除**：当前点击确认后调用 `removeCareRule` + `loadFamily()`，列表等网络请求完成才消失，体感很卡。改为：立即从 `currentFamily.value.care_rules` 数组中 splice 该项（乐观更新），然后后台静默调用接口；接口失败时恢复并 toast 提示。
**Why:** BDeleteConfirm 是专为此场景设计的组件，不用是浪费。乐观删除是用户期望的即时反馈。
**Effort:** S（care-rules.vue 改 removeRule 约 15 行 + 引入 BDeleteConfirm）

### TODO-28: 支出分类管理三个问题
**What:**
1. **骨架屏按真实布局**：当前 `<BSkeleton :rows="3" />` 是通用占位，真实的 `cat-card` 是"drag handle + 分类名称 + 编辑/删除按钮"横排布局。骨架屏应改为与此匹配的行内结构。
2. **乐观更新代替清缓存**：当前 `saveCat`/`removeCat` 成功后都是 `uni.removeStorageSync(CACHE_KEY)` + `load()`（清缓存再走网络），体感慢。改为乐观更新：直接修改 `categories.value` 数组 + `uni.setStorageSync` 更新缓存，接口在后台静默执行；失败时恢复并 toast。
3. **新建/编辑改为 BSheet**：当前 `showAddForm = true` 展开页面内嵌表单。改为 BSheet 弹出，包含：分类名称输入框 + 保存/取消按钮。编辑和新建复用同一 BSheet（editingId 区分标题）。
**Why:** 三个问题和 TODO-24/25/26 同一类型，统一交互模式，统一体验。
**Effort:** M（骨架屏 S + 乐观更新 S + BSheet 改造 S，共约 60 行）

