# 九、UI 实现计划

> **生成时间：** 2026-03-27
> **依据：** design-system.md + page-inventory.md + 20 个 HTML 原型 + 08-implementation-plan.md
> **目标：** UI 一比一还原设计稿，高质量精品代码，组件化、有注释、去冗余

---

## 1. 总览

### 1.1 设计资产

| 资产 | 数量 | 位置 |
|------|------|------|
| 设计系统文档 | 1 | docs/ui/design-system.md |
| 页面清单 | 1 | docs/ui/page-inventory.md |
| HTML 原型 | 20 | docs/ui/\*.html |
| 唯一屏幕总计 | 110 | 41 页面 + 27 Sheet + 25 Modal + 3 Step + 14 Sub-view |

### 1.2 当前实现 vs 设计目标

| 维度 | 当前状态 | 目标 |
|------|---------|------|
| 页面数 | 25 页（功能完成，UI 粗糙） | 41 页面 + 27 Sheet + 25 Modal |
| 设计系统 | 无（各页面硬编码样式） | 统一 CSS 变量 + 组件库 |
| 暗色模式 | 未实现 | 完整支持 |
| 组件复用 | 5 个基础组件 | 29 个标准组件 |

### 1.3 开发原则

- **设计令牌优先**：所有颜色、间距、圆角使用 CSS 变量，零硬编码
- **组件化**：提取共享 UI 组件，单一职责，Props 驱动
- **一比一还原**：像素级还原 HTML 原型，每页完成后对比验收
- **精品代码**：有注释说明设计意图，去除冗余样式，保持一致性
- **渐进式**：先建设计系统 → 再造组件 → 最后组装页面

---

## 2. 设计系统实现

### 2.1 颜色令牌（src/styles/tokens.scss）

```scss
// 浅色模式
:root {
  // 品牌色
  --primary: #ea3e77;
  --primary-soft: #fff0f2;

  // 背景
  --bg: #fdf8f9;
  --card: #FFFFFF;
  --card-dim: #FFF0E8;

  // 文字（暖棕色系）
  --text-1: #1a1a2e;
  --text-2: #8B7355;
  --text-3: #B8A08A;
  --text-4: #D8CBBD;

  // 功能色 × 7
  --red / --red-soft / --icon-red
  --amber / --amber-soft / --icon-amber
  --green / --green-soft / --icon-green
  --blue / --blue-soft / --icon-blue
  --plum / --plum-soft / --icon-plum
  --rose / --rose-soft / --icon-rose
  --teal / --teal-soft / --icon-teal

  // 阴影（粉调暖影）
  --shadow: 0 2px 12px rgba(234,62,119,0.06);
  --shadow-lg: 0 6px 24px rgba(234,62,119,0.1);

  // 导航
  --nav-bg: rgba(255,255,255,0.85);
  --nav-border: rgba(234,62,119,0.08);
}

// 暗色模式
.dark { /* 覆盖所有变量 */ }
```

### 2.2 字体系统

| 用途 | 字体 | 字号 | 字重 |
|------|------|------|------|
| 页面标题 | Plus Jakarta Sans | 24px | 800 |
| 状态大字 | Plus Jakarta Sans | 20px | 700 |
| 摘要数字 | Plus Jakarta Sans | 18px | 700 |
| 卡片标题 | Plus Jakarta Sans | 15px | 600 |
| 正文/按钮 | System + PingFang SC | 13px | 500/600 |
| 导航标签 | System | 10px | 500 |

### 2.3 间距系统

| 名称 | 值 | 用途 |
|------|-----|------|
| --space-page | 20px | 页面水平内边距 |
| --space-card | 16px | 卡片内边距（上/右/下） |
| --space-card-left | 18px | 卡片左内边距（左边框对齐） |
| --space-card-gap | 12px | 卡片间距 |
| --space-header-top | 12px | 头部顶部间距 |
| --space-item | 8px | 标签/按钮/复选框间距 |

### 2.4 圆角系统

| 名称 | 值 | 用途 |
|------|-----|------|
| --radius-card | 16px | 卡片 |
| --radius-row | 14px | 列表行 |
| --radius-date | 12px | 日期框 |
| --radius-icon | 10px | 图标方块 |
| --radius-pill | 999px | 按钮/胶囊 |
| --radius-checkbox | 6px | 复选框 |

### 2.5 交互效果

| 元素 | 按压效果 | 过渡时间 |
|------|---------|---------|
| 卡片 | scale(0.975) + 阴影收缩 | 0.15s |
| 按钮 | scale(0.94) + opacity(0.85) | 0.12s |
| FAB | scale(0.88) + 阴影收缩 | 0.15s |
| 复选框 | scale(0.85) | 0.15s |
| 导航项 | scale(0.85) | 0.12s |

---

## 3. 组件库设计

### 3.1 组件清单（按优先级）

#### Tier 1：基础组件（所有页面依赖）

| 组件 | 路径 | Props | 设计稿来源 |
|------|------|-------|-----------|
| BCard | components/base/BCard.vue | type(颜色), title, subtitle, icon | 所有卡片页面 |
| BButton | components/base/BButton.vue | variant(filled/ghost), color, size, loading | 全局 |
| BIconBox | components/base/BIconBox.vue | icon, color, size(36/28) | 卡片头部、列表项 |
| BTag | components/base/BTag.vue | label, color | 状态标签 |
| BPill | components/base/BPill.vue | count, color, label | 摘要数字 |
| BCheckbox | components/base/BCheckbox.vue | v-model, label | 任务完成 |
| BProgress | components/base/BProgress.vue | value, max, gradient | 用药进度 |
| BSectionLabel | components/base/BSectionLabel.vue | title, color, badge | 分区标题 |

#### Tier 2：布局组件

| 组件 | 路径 | 说明 |
|------|------|------|
| BSheet | components/layout/BSheet.vue | 底部弹出面板（handle + 动画 + 高度自适应） |
| BModal | components/layout/BModal.vue | 居中确认弹窗 |
| BTabBar | components/layout/BTabBar.vue | 页面内 Tab 切换（下划线指示器） |
| BNavBar | components/layout/BNavBar.vue | 底部导航栏（毛玻璃 + FAB） |
| BPageHeader | components/layout/BPageHeader.vue | 页面标题栏 |

#### Tier 3：表单组件

| 组件 | 路径 | 说明 |
|------|------|------|
| BInput | components/form/BInput.vue | 输入框（含标签、错误状态） |
| BDatePicker | components/form/BDatePicker.vue | 日期选择（今天/昨天快捷 + 日历） |
| BDogSelector | components/form/BDogSelector.vue | 犬只选择面板（单选/多选 + 智能预过滤） |
| BLitterSelector | components/form/BLitterSelector.vue | 窝选择面板 |
| BCycleSelector | components/form/BCycleSelector.vue | 繁育周期选择面板 |
| BImageUpload | components/form/BImageUpload.vue | 图片上传（拍照/相册 + 压缩） |
| BSegmentedControl | components/form/BSegmentedControl.vue | 分段选择器 |

#### Tier 4：数据展示组件

| 组件 | 路径 | 说明 |
|------|------|------|
| BWeightChart | components/data/BWeightChart.vue | 迷你体重折线图（SVG） |
| BTrendLine | components/data/BTrendLine.vue | 4-6 点趋势线 |
| BTimeline | components/data/BTimeline.vue | 繁育/健康记录时间线 |
| BSkeleton | components/feedback/BSkeleton.vue | 骨架屏加载占位 |
| BEmpty | components/feedback/BEmpty.vue | 空状态提示 |

### 3.2 组件命名规范

- 前缀 `B`（Breed）避免与 uni-ui 冲突
- 文件名 PascalCase：`BCard.vue`
- CSS 类名 BEM：`.b-card__header`、`.b-card__body`
- 所有颜色引用 CSS 变量，禁止硬编码 hex

### 3.3 验收标准（每个组件）

- [ ] Props 有 TypeScript 类型定义
- [ ] 支持浅色/暗色模式
- [ ] 按压/hover 交互效果符合设计系统
- [ ] 与 HTML 原型像素级对比一致
- [ ] 有简明注释说明组件用途和关键 Props
- [ ] 无冗余样式（不重复定义已在 tokens 中的值）

---

## 4. 页面实现计划

### 4.1 实现顺序（6 个 Tier）

```
Tier 0: 设计系统基建
  tokens.scss + 主题切换 + Plus Jakarta Sans 字体引入
    ↓
Tier 1: 基础组件库（8 个）
  BCard, BButton, BIconBox, BTag, BPill, BCheckbox, BProgress, BSectionLabel
    ↓
Tier 2: 布局 + 表单组件（12 个）
  BSheet, BModal, BTabBar, BNavBar, BPageHeader
  BInput, BDatePicker, BDogSelector, BImageUpload, BSegmentedControl
    ↓
Tier 3: 核心页面重构（高频使用）
  H-1 首页, D-1 犬只列表, D-2 犬只详情, D-3 新建犬只
    ↓
Tier 4: 表单页面（记录录入）
  R-2~R-9 繁育记录, R-10~R-13 健康记录, R-16/R-17 财务记录
    ↓
Tier 5: 剩余页面
  财务统计, 销售流程, 设置页, 协作页, 监控页
```

### 4.2 Tier 0：设计系统基建

| 任务 | 文件 | 说明 |
|------|------|------|
| 创建设计令牌 | src/styles/tokens.scss | 颜色/间距/圆角/阴影/字体 CSS 变量 |
| 创建混入 | src/styles/mixins.scss | 常用样式模式：卡片阴影、按压效果、文字截断 |
| 引入字体 | src/styles/fonts.scss | Plus Jakarta Sans（标题/数字用） |
| 全局导入 | src/App.vue | 导入 tokens + 暗色模式 class 切换 |
| 更新 uni.scss | src/uni.scss | 引用 tokens 中的变量 |

### 4.3 Tier 1-2：组件库（详见第 3 节）

### 4.4 Tier 3：核心页面重构

#### H-1 首页（home-v1-final.html）

| 区域 | 现状 | 目标 | 涉及组件 |
|------|------|------|---------|
| 状态摘要栏 | 数字裸显示 | 3 个 BPill（需处理/今日/本周） | BPill |
| 7 天预览条 | WeekStrip 基础版 | 带事件圆点 + 今日高亮 + 月份标题可展开 | 重构 WeekStrip |
| 智能卡片区 | SmartCard 基础版 | 4 种卡片完全还原设计稿样式 | BCard + 4 个子卡片 |
| FAB 按钮 | 简单 "+" | 50px 玫瑰粉 + 阴影 + 按压效果 | BNavBar |
| 底部导航 | pages.json 原生 | 84px 毛玻璃 + FAB 偏移 | BNavBar |

#### D-1 犬只列表（pages-list.html）

| 区域 | 现状 | 目标 | 涉及组件 |
|------|------|------|---------|
| 搜索栏 | 无 | 搜索输入框 + 筛选按钮 | BInput |
| 筛选 chips | 简单 text 按钮 | 彩色筛选标签（性别/角色/状态） | BTag |
| 犬只卡片 | 基础列表行 | 左侧头像 + 名称年龄 + 状态标签 + 右侧箭头 | BCard, BTag, DogAvatar |
| 筛选面板 | 无 | 底部弹出多选面板 | BSheet |

#### D-2 犬只详情（pages-dog-detail.html）

| 区域 | 现状 | 目标 | 涉及组件 |
|------|------|------|---------|
| 头部信息 | 基础文字 | 大头像 + 名称 + 状态标签行 + 基础信息网格 | DogAvatar, BTag |
| Tab 栏 | 简单切换 | 下划线指示器 Tab | BTabBar |
| 繁育历史 | 文字列表 | 时间线布局 + 周期卡片 | BTimeline |
| 健康记录 | 文字列表 | 分类图标 + 时间线 | BTimeline, BIconBox |
| 体重曲线 | 无 | SVG 折线图 + 记录列表 | BWeightChart |

#### D-3 新建犬只（pages-wizard-newdog.html）

| 区域 | 现状 | 目标 | 涉及组件 |
|------|------|------|---------|
| 表单布局 | 原生 input | 设计系统 BInput + 分组 | BInput |
| 性别选择 | 原生 | 图标卡片选择器 | BCard |
| 角色选择 | 原生 | 角色说明卡片 | BCard |
| 日期选择 | 原生 picker | BDatePicker（今天/昨天快捷） | BDatePicker |

### 4.5 Tier 4：表单页面

#### 繁育记录表单（pages-breeding-forms.html）

8 种类型，共享表单框架，按 type 切换字段：

| type | 特有字段 | 涉及选择器 |
|------|---------|-----------|
| heat | 观察描述 | BDogSelector（种母） |
| follicle_check | 卵泡大小、建议配种时间 | BDogSelector + BCycleSelector |
| mating | 种公选择、配种方式、费用 | BDogSelector × 2 |
| pregnancy_check | 孕检方式、结果 | BCycleSelector |
| prenatal_check | 检查项目、体重 | BCycleSelector |
| pre_labor | 体温、预产期 | BCycleSelector |
| birth | → 跳转 birth-wizard | — |
| abnormal_termination | 终止原因、处理方式 | BCycleSelector |

#### 健康记录表单（pages-health-finance-forms.html）

| type | 特有字段 |
|------|---------|
| vaccination | 疫苗名称、接种部位、批号、下次提醒 |
| deworming | 药品名称、剂量、内/外驱 |
| illness | 症状描述、严重程度、诊断 |
| medication | 药品、剂量、频次、疗程天数 |

### 4.6 Tier 5：剩余页面

| 模块 | 页面 | 设计稿 |
|------|------|--------|
| 财务统计 | F-1~F-9 | pages-financial-stats.html, pages-expense-redesign.html |
| 销售流程 | S-1~S-10 | pages-sales-flow.html |
| 设置页 | M-1~M-21 | pages-settings.html |
| FAB Action Sheet | R-0, R-1 | pages-fab-action-sheet.html |
| 监控日志 | 快速监控模式 | pages-monitor-logs.html, pages-r7-monitor.html |
| 体重监控 | D-19 | pages-weight-monitor.html |

---

## 5. 文件结构

```
src/
├── styles/
│   ├── tokens.scss          # 设计令牌（颜色/间距/圆角/阴影）
│   ├── mixins.scss           # 常用混入（卡片阴影、按压效果等）
│   ├── fonts.scss            # Plus Jakarta Sans 引入
│   └── transitions.scss      # 全局过渡动画
├── components/
│   ├── base/                 # 基础组件
│   │   ├── BCard.vue
│   │   ├── BButton.vue
│   │   ├── BIconBox.vue
│   │   ├── BTag.vue
│   │   ├── BPill.vue
│   │   ├── BCheckbox.vue
│   │   ├── BProgress.vue
│   │   └── BSectionLabel.vue
│   ├── layout/               # 布局组件
│   │   ├── BSheet.vue
│   │   ├── BModal.vue
│   │   ├── BTabBar.vue
│   │   ├── BNavBar.vue
│   │   └── BPageHeader.vue
│   ├── form/                 # 表单组件
│   │   ├── BInput.vue
│   │   ├── BDatePicker.vue
│   │   ├── BDogSelector.vue
│   │   ├── BLitterSelector.vue
│   │   ├── BCycleSelector.vue
│   │   ├── BImageUpload.vue
│   │   └── BSegmentedControl.vue
│   ├── data/                 # 数据展示组件
│   │   ├── BWeightChart.vue
│   │   ├── BTrendLine.vue
│   │   └── BTimeline.vue
│   ├── feedback/             # 反馈组件
│   │   ├── BSkeleton.vue
│   │   └── BEmpty.vue
│   ├── smart-card/           # 智能卡片（已有，需重构样式）
│   │   ├── SmartCard.vue
│   │   ├── DogCard.vue
│   │   ├── BatchCard.vue
│   │   ├── CareGroupCard.vue
│   │   └── MedicationCard.vue
│   └── common/               # 已有通用组件（需更新样式）
│       ├── DogAvatar.vue
│       ├── DogPicker.vue
│       └── BottomSheet.vue
```

---

## 6. 验收标准

### 6.1 页面级验收

每个页面完成后，执行以下检查：

- [ ] **像素对比**：与 HTML 原型在 375px 宽度下对比，误差 ≤ 2px
- [ ] **颜色一致**：所有颜色引用 CSS 变量，无硬编码 hex
- [ ] **暗色模式**：切换后所有元素正确变色，无白色残留
- [ ] **交互效果**：按压缩放、过渡动画与设计系统一致
- [ ] **空状态**：无数据时显示设计稿中的空状态提示
- [ ] **加载状态**：请求中显示骨架屏
- [ ] **响应式**：320px ~ 428px 宽度范围内布局正常

### 6.2 代码级验收

- [ ] **零硬编码**：grep 检查无 `#ea3e77` 等硬编码色值（tokens 文件除外）
- [ ] **组件复用**：相同 UI 模式使用相同组件，不重复实现
- [ ] **类型安全**：组件 Props 有 TypeScript 类型定义
- [ ] **注释规范**：组件头部注释说明用途，复杂逻辑有行内注释
- [ ] **样式隔离**：使用 scoped style，不污染全局
- [ ] **无冗余**：不重复定义 tokens 中已有的变量值

### 6.3 性能验收

- [ ] **首屏渲染**：< 1.5s（H5 模式）
- [ ] **列表滚动**：50 条犬只列表流畅（无卡顿）
- [ ] **图片加载**：使用 lazy-load，有占位图

---

## 7. 开发排期

### 7.1 按 Tier 排期

| Tier | 内容 | 输出 | 估时 |
|------|------|------|------|
| 0 | 设计系统基建 | tokens + mixins + 字体 + 主题切换 | 0.5 天 |
| 1 | 基础组件库（8 个） | 8 个可复用组件 | 1 天 |
| 2 | 布局 + 表单组件（12 个） | 12 个可复用组件 | 1.5 天 |
| 3 | 核心页面重构（4 页） | 首页 + 列表 + 详情 + 新建 | 2 天 |
| 4 | 表单页面（~15 页） | 繁育/健康/财务记录表单 | 2 天 |
| 5 | 剩余页面（~30 页） | 统计/销售/设置/协作/监控 | 3 天 |
| **合计** | | **110 个屏幕** | **~10 天** |

> 以上为 Claude Code 辅助开发估时，非人工估时。

### 7.2 并行策略

UI 和开发可并行推进：

```
并行轨道 1（UI 基建）          并行轨道 2（功能修复/测试）
─────────────────────         ─────────────────────
Tier 0: 设计令牌              验证登录流程
Tier 1: 基础组件              上传云函数到云端
Tier 2: 布局组件              tabBar 图标
    ↓                              ↓
    └──────── 合流 ────────────────┘
                ↓
         Tier 3: 核心页面重构
                ↓
         Tier 4: 表单页面
                ↓
         Tier 5: 剩余页面
```

---

## 8. HTML 原型 → 页面映射表

| HTML 原型文件 | 覆盖页面 | 对应代码文件 |
|--------------|---------|-------------|
| home-v1-final.html | H-1 首页 | pages/home/index.vue |
| pages-list.html | D-1 犬只列表, D-5 筛选面板 | pages/dog/list.vue |
| pages-dog-detail.html | D-2 犬只详情, D-S1~S6 子视图 | pages/dog/detail.vue |
| pages-wizard-newdog.html | D-3 新建犬只, D-4 编辑犬只 | pages/dog/add.vue |
| pages-detail-views.html | D-15 窝详情, D-18 周期详情 | pages/breeding/litter.vue, cycle.vue |
| pages-litter-cycle-weight.html | 窝/周期/体重详细视图 | pages/breeding/\*.vue |
| pages-breeding-forms.html | R-2~R-9 繁育记录表单 | pages/record/breeding.vue |
| pages-health-finance-forms.html | R-10~R-13 健康, R-16~R-17 财务 | pages/record/health.vue, finance/ |
| pages-expense-redesign.html | R-16 支出重设计 | pages/finance/expense-add.vue |
| pages-fab-action-sheet.html | R-0 FAB, R-1 全部记录类型 | 新建：pages/record/index.vue |
| pages-financial-stats.html | F-6~F-9 财务统计 | pages/finance/stats.vue |
| pages-sales-flow.html | S-1~S-10 销售流程 | pages/sale/\*.vue |
| pages-sheets-modals.html | 通用 Sheet/Modal 模板 | components/layout/BSheet.vue, BModal.vue |
| pages-remaining.html | D-6~D-14 状态变更 | pages/dog/detail.vue 内嵌 |
| pages-pickers.html | G-1~G-8 选择器组件 | components/form/B\*Selector.vue |
| pages-settings.html | M-1~M-21 设置页 | pages/profile/\*.vue |
| pages-missing-forms.html | 缺失表单补全 | 按需创建 |
| pages-monitor-logs.html | R-19 观察日志 | 新建 |
| pages-r7-monitor.html | 快速监控模式 | 新建 |
| pages-weight-monitor.html | D-19 批量体重 | pages/health/batch-weight.vue |
