# Graphify Worksets

## 目标

当前根图谱 `graphify-out/` 适合做全局导航，但它主要帮助我们快速定位页面/组件，不够适合跨业务域影响分析。

为减少无效读文件和无效搜索，这个项目补充了业务域级别的 Graphify workset：

- 根图谱：先缩小到业务域
- workset：把设计文档、前端页面、共享组件、类型、云对象放进同一个小语料
- 原始文件：只在 workset 仍不够时再继续深读

## 当前 workset

### `health-medication`

适用场景：

- 用药表单
- 重复用药检测与覆盖
- 批量创建/取消旧任务
- 今日用药卡与详情页联动
- 用药和疾病状态的联动

入口命令：

```bash
./scripts/graphify-workset.sh show health-medication
./scripts/graphify-workset.sh build health-medication
```

### `home-attention`

适用场景：

- 首页卡片聚合
- WeekStrip 红点
- `dayCounts` / `counts.today` 差异
- 今日卡片、周缓存、首页动作
- 首页和健康用药卡的联动

入口命令：

```bash
./scripts/graphify-workset.sh show home-attention
./scripts/graphify-workset.sh build home-attention
```

### `breeding-record`

适用场景：

- 发情到生产整条繁育记录链路
- 配种后预计孕检日 / 预产期字段
- 繁育记录详情、编辑、周期和窝联动
- `breeding-service` 的校验、状态迁移和任务创建

入口命令：

```bash
./scripts/graphify-workset.sh show breeding-record
./scripts/graphify-workset.sh build breeding-record
```

### `shared-form-system`

适用场景：

- `BFormOptions` 规则和复用边界
- BDogPicker / BCycleSelector / BLitterSelector 联动
- BSheet / BModal / BDeleteConfirm 的表单弹层行为
- 排查记录表单之间的样式和交互一致性

入口命令：

```bash
./scripts/graphify-workset.sh show shared-form-system
./scripts/graphify-workset.sh build shared-form-system
```

### `finance`

适用场景：

- 财务首页和统一流水
- 手动收入/支出录入与编辑
- 窝利润、母犬 ROI、预测、统计
- `finance-service` 的聚合和财务联动

入口命令：

```bash
./scripts/graphify-workset.sh show finance
./scripts/graphify-workset.sh build finance
```

### `dog-profile`

适用场景：

- 犬只列表、详情、新增/编辑
- 去向和状态字段
- 档案字段缺失或冗余字段同步
- `dog-service` 对 breeding / health / finance 的联动

入口命令：

```bash
./scripts/graphify-workset.sh show dog-profile
./scripts/graphify-workset.sh build dog-profile
```

### `family-auth`

适用场景：

- 单家庭模式假设
- 家庭创建、邀请、加入、成员权限
- `useAuth` 恢复家庭上下文
- `family-service` / `uni-id-co` 认证链路

入口命令：

```bash
./scripts/graphify-workset.sh show family-auth
./scripts/graphify-workset.sh build family-auth
```

### `sales-flow`

适用场景：

- 销售列表、创建、详情
- 代理人管理
- 销售状态与犬只去向 / 收入记录联动
- 销售相关字段审计和缺失排查

入口命令：

```bash
./scripts/graphify-workset.sh show sales-flow
./scripts/graphify-workset.sh build sales-flow
```

### `health-ops`

适用场景：

- 疫苗 / 驱虫 / 疾病记录
- 健康记录详情与编辑
- 批量体重与犬只体重历史
- 用药方案库与健康运营批量入口
- `health-service` 的健康记录、体重、用药剂量补录链路

入口命令：

```bash
./scripts/graphify-workset.sh show health-ops
./scripts/graphify-workset.sh build health-ops
```

## 推荐工作流

1. 先读根图谱 [graphify-out/GRAPH_REPORT.md](/Users/mooling/Projects/breed-app/graphify-out/GRAPH_REPORT.md)
2. 判断问题属于哪个业务域
3. 先 `show` 对应 workset，确认范围
4. 需要更深上下文时再 `build` 对应 workset
5. 先读 workset 图谱，再读 workset 内原始文件
6. 只有 workset 不够时，才扩大到仓库级搜索

## 自动匹配

如果你不想手动判断 workset，可以直接让脚本按关键词自动匹配：

```bash
./scripts/graphify-workset.sh suggest "首页红点为什么不更新"
./scripts/graphify-workset.sh auto "销售详情没显示退款日期"
./scripts/graphify-workset.sh auto-build "疫苗和驱虫表单逻辑"
```

说明：

- `suggest`：返回最可能的前几个 workset + 匹配理由
- `auto`：只返回最佳 workset 名称，适合脚本链路调用
- `auto-build`：自动选出最佳 workset 并直接构建

也可以用 npm script：

```bash
pnpm graphify:suggest "首页红点为什么不更新"
pnpm graphify:auto "家庭邀请失败"
pnpm graphify:auto-build "母犬 ROI 计算不对"
```

## 一键入口

如果你希望只记一个命令，可以直接用：

```bash
./scripts/graphify-start.sh "首页红点为什么不更新"
```

它会自动完成：

1. 根据问题匹配最佳 workset
2. 构建该 workset
3. 输出对应 `GRAPH_REPORT.md` 和 manifest 路径

也可以用：

```bash
pnpm graphify:start "首页红点为什么不更新"
```

## 生成位置

workset 的构建产物会放在未跟踪目录：

```bash
.graphify-worksets/<workset>/corpus/graphify-out/
```

例如：

```bash
.graphify-worksets/health-medication/corpus/graphify-out/GRAPH_REPORT.md
```

`build` 默认会先生成这个业务域的 staged corpus，再用 Graphify 的 `_rebuild_code` 生成代码图谱。
如果需要把 `docs/design` 之类的文档也纳入完整语义图谱，请进入对应 `corpus/` 后再运行一次 `/graphify .`。

## 维护规则

- 业务域新增关键页面、共享组件、云对象后，要同步更新 `graphify/worksets/*.json`
- 如果改了业务代码，并且根目录 `graphify-out/graph.json` 已存在，仍然要执行 `./scripts/graphify-rebuild.sh`
- workset 用来缩小范围，不替代根图谱
