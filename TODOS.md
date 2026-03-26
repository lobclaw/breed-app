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

## 下一步

开始 Phase 1 第一批开发，按 `08-implementation-plan.md` 的 Step 0-10 执行。
