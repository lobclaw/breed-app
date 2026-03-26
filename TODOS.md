# TODOS

## Phase 1 开发前

### TODO-1: 初始化 git 仓库 + UniApp 项目脚手架
**What:** git init + .gitignore + 创建 UniApp Vue3+TS 项目 + Pinia + vitest + 基础目录结构 + 14 个 DB Schema 文件
**Why:** 当前项目只有设计文档，没有代码和 git。这是所有开发的起点。
**Context:** 项目结构已在 05-tech-stack.md 5.6 节定义。DB Schema 已在 01 和 05 中完整描述。需要 HBuilderX 创建 UniApp 项目（不支持 VS Code）。vitest 用于测试云对象和工具函数。
**Depends on:** 无

### TODO-2: 写 Phase 1 实现计划文档
**What:** 从设计文档提取 Phase 1 的具体实现计划：开发顺序、每个云对象的 API 方法列表、页面开发顺序、依赖关系
**Why:** 设计文档定义了"做什么"，实现计划定义"怎么做"和"先后顺序"。没有实现计划，开发容易陷入随机顺序。
**Context:** Phase 1 包含 ~54 页面、9 个集合、6 个云对象。建议开发顺序：基础设施(auth+family) → 犬只档案 → 繁育流程 → 健康管理 → 任务系统 → 首页。每步都先写云对象+测试，再写前端页面。
**Depends on:** TODO-1

### TODO-3: 验证设计审查 HIGH 级问题的修复
**What:** 开发时验证 H1-H5 是否在设计文档中真正解决：
- H1: 软删除查询范围（01 软删除范围矩阵）
- H2: 繁育状态机异常转换（01 异常状态转换规则表）
- H3: 首页卡片合并规则（03 合并优先级 + 冲突场景示例）
- H4: 窝号动态计算边界（01 窝号边界处理）
- H5: 图片上传规范（05 section 5.7）
**Why:** 审查报告标注这些问题已解决，但需要在实现时再次确认。
**Context:** 07-design-audit.md 记录了所有问题。各问题的修复位置已标注。
**Depends on:** TODO-2

### TODO-4: 修复 breeding_cycles 软删除文档矛盾
**What:** 01 文档中 breeding_cycles schema 包含 deleted_at 字段，但软删除范围矩阵标注「否」。需统一：移除 schema 中的 deleted_at（矩阵已明确不支持）。
**Why:** 外部独立审查发现的文档矛盾。开发时可能导致实现与设计不一致。
**Context:** 01-overview-and-data-model.md 第38行（所有集合统一添加 deleted_at）需加例外说明，第178行 breeding_cycles schema 的 deleted_at 需移除。同时检查 breeding_records 等同样标注「否」的集合是否有相同问题。
**Depends on:** 无（开发前修复）

### TODO-5: 护理规则任务的审计逻辑设计
**What:** 三层保障的第三层（每日审计）需为护理规则（care group）任务设计独立的检查逻辑。护理任务是模板驱动的（无 source_record），不能用「有记录无任务」的通用审计逻辑。
**Why:** 外部审查发现审计层对护理任务存在盲区。不处理会导致护理提醒丢失时无法自动补救。
**Context:** 03 文档 section 6.2 定义了三层保障。护理任务的审计应检查「是否存在活跃的护理规则但无对应待办任务」，而非检查源记录。
**Depends on:** TODO-2

### TODO-6: 显式标注 V1 单家庭限制
**What:** 在 CLAUDE.md 和 04-collaboration-and-navigation.md 中显式标注 V1 限制：一个用户只能属于一个家庭。_before 拦截器基于此假设注入 familyId。
**Why:** 当前设计隐含此限制但未显式文档化。未来扩展多家庭时，auth 拦截器需重构。
**Context:** 05-tech-stack.md 的 _before 拦截器设计假设 familyId 可从用户信息直接获取。04 文档的角色体系也基于单家庭。
**Depends on:** 无（开发前标注）

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
