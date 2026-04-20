<!--
  犬只详情页 (D-2)
  设计稿：docs/ui/pages-dog-detail.html
  紧凑 Hero + 快捷统计 + Tab 切换（概览/繁育/健康/财务）
  + D-6 ~ D-14 状态变更弹窗/Sheet
-->
<template>
  <!-- 加载骨架屏 -->
  <BSkeleton v-if="loading" :rows="3" :avatar="true" />

  <!-- 主内容 -->
  <view class="dog-detail" v-else-if="dog">

    <!-- ==================== 顶部导航栏 ==================== -->
    <view class="dog-detail__topbar">
      <view class="dog-detail__back-btn" @click="goBack">
        <text class="material-icons-round">arrow_back_ios_new</text>
      </view>
      <text class="dog-detail__topbar-title">{{ dog.name || '未命名' }}</text>
      <view class="dog-detail__topbar-cta" @click="addRecord">
        <text class="material-icons-round dog-detail__topbar-cta-icon">add</text>
        <text class="dog-detail__topbar-cta-text">添加记录</text>
      </view>
      <view class="dog-detail__topbar-more" @click="showMore = true">
        <text class="material-icons-round">more_horiz</text>
      </view>
    </view>

    <BSubmitBanner :message="submitBannerMessage" />

    <!-- ==================== 紧凑 Hero ==================== -->
    <view class="dog-detail__hero">
      <view class="dog-detail__hero-avatar" :class="heroAvatarClass">
        <text class="material-icons-round dog-detail__hero-avatar-icon">pets</text>
      </view>
      <view class="dog-detail__hero-info">
        <text class="dog-detail__hero-name">{{ dog.name || '未命名' }} </text>
        <text class="dog-detail__hero-sub">
          {{ dog.breed || '马尔济斯' }} · {{ dog.gender }}<text v-if="dog.birth_date"> · {{ formatAge(dog.birth_date) }}</text>
        </text>
        <view class="dog-detail__hero-tags">
          <!-- 活跃状态标签（带箭头，可点击） -->
          <view
            v-for="(s, idx) in statuses"
            :key="'status-' + idx"
            class="dog-detail__hero-tag"
            :class="statusToneClass(s.type, 'hero')"
            @click="handleStatusTap(s)"
          >
            <text class="dog-detail__hero-tag-text">{{ s.label || s.type }}</text>
            <text class="material-icons-round dog-detail__hero-tag-arrow">chevron_right</text>
          </view>
          <!-- 角色标签（静态，带边框） -->
          <view class="dog-detail__hero-tag dog-detail__hero-tag--static">
            <text class="dog-detail__hero-tag-text">{{ dog.role || '种狗' }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ==================== 快捷统计条 ==================== -->
    <view class="dog-detail__stats">
      <view class="dog-detail__stat-item">
        <text class="material-icons-round dog-detail__stat-icon">cake</text>
        <text class="dog-detail__stat-value">{{ dog.birth_date ? formatAge(dog.birth_date) : '未知' }}</text>
        <text class="dog-detail__stat-label">年龄</text>
      </view>
      <view class="dog-detail__stat-item" @click="openWeightChart">
        <text class="material-icons-round dog-detail__stat-icon">monitor_weight</text>
        <text class="dog-detail__stat-value">{{ dog.latest_weight ? formatWeight(dog.latest_weight) : '—' }}</text>
        <text class="dog-detail__stat-label">体重</text>
      </view>
      <view class="dog-detail__stat-item">
        <text class="material-icons-round dog-detail__stat-icon">child_friendly</text>
        <text class="dog-detail__stat-value">{{ cycles.length }}窝</text>
        <text class="dog-detail__stat-label">繁育</text>
      </view>
    </view>

    <!-- ==================== Tab 栏 ==================== -->
    <view class="dog-detail__tab-bar">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="dog-detail__tab-item"
        :class="{ 'dog-detail__tab-item--active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <text class="dog-detail__tab-label">{{ tab.label }}</text>
      </view>
    </view>

    <!-- ==================== Tab 内容 ==================== -->
    <view class="dog-detail__tab-content">

      <!-- ========== 概览 Tab ========== -->
      <view v-if="activeTab === 'overview'" class="dog-detail__pane">

        <!-- 当前状态 -->
        <view v-if="statuses.length > 0" class="dog-detail__section">
          <view class="dog-detail__sec dog-detail__sec--rose">
            <text class="dog-detail__sec-text">当前状态</text>
          </view>

          <view class="dog-detail__status-merged">
            <view
              v-for="(s, idx) in statuses"
              :key="'st-' + idx"
              class="dog-detail__status-row"
              :class="statusToneClass(s.type, 'row')"
              @click="handleStatusTap(s)"
            >
              <view class="dog-detail__st-header">
                <view class="dog-detail__st-left">
                  <view class="dog-detail__st-icon" :class="statusToneClass(s.type, 'icon')">
                    <text class="material-icons-round">{{ statusIconMap[s.type] || 'info' }}</text>
                  </view>
                  <view class="dog-detail__st-body">
                    <text class="dog-detail__st-title">{{ statusTitle(s) }}</text>
                    <text v-if="statusSub(s)" class="dog-detail__st-sub">{{ statusSub(s) }}</text>
                  </view>
                </view>
                <text class="material-icons-round dog-detail__st-chevron">chevron_right</text>
              </view>
              <!-- 进度条 -->
              <view v-if="s.progress" class="dog-detail__st-progress">
                <view class="dog-detail__st-progress-track">
                  <view
                    class="dog-detail__st-progress-fill"
                    :class="statusToneClass(s.type, 'progress')"
                    :style="{ width: Math.min(100, Math.round(s.progress.current / s.progress.total * 100)) + '%' }"
                  />
                </view>
                <text class="dog-detail__st-progress-text" :class="statusToneClass(s.type, 'progressText')">{{ statusProgressText(s) }}</text>
              </view>
              <!-- 元信息 -->
              <view v-if="statusMeta(s).length > 0" class="dog-detail__st-meta">
                <view v-for="(m, mi) in statusMeta(s)" :key="mi" class="dog-detail__st-meta-item">
                  <text class="material-icons-round dog-detail__st-meta-icon">{{ m.icon }}</text>
                  <text class="dog-detail__st-meta-text">{{ m.text }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 最近健康记录 -->
        <view class="dog-detail__section">
          <view class="dog-detail__sec dog-detail__sec--green">
            <text class="dog-detail__sec-text">最近健康记录</text>
            <text class="dog-detail__sec-link" @click="activeTab = 'health'">查看全部</text>
          </view>

          <view v-if="healthRecords.length > 0" class="dog-detail__rec-list">
            <view
              v-for="record in healthRecords.slice(0, 3)"
              :key="record._id || record.id"
              class="dog-detail__rec-item"
              @click="goToHealthDetail(record._id || record.id)"
            >
              <view class="dog-detail__rec-icon" :class="`dog-detail__rec-icon--${healthIconColor(record.type)}`">
                <text class="material-icons-round">{{ healthIcon(record.type) }}</text>
              </view>
              <view class="dog-detail__rec-body">
                <text class="dog-detail__rec-title">{{ recentHealthRecordTitle(record) }}</text>
                <text class="dog-detail__rec-sub">{{ formatDate(record.date) }}</text>
              </view>
              <view
                v-if="illnessStatusLabel(record)"
                class="dog-detail__rec-tag"
                :class="`dog-detail__rec-tag--${illnessStatusTone(record)}`"
              >
                <text class="dog-detail__rec-tag-text">{{ illnessStatusLabel(record) }}</text>
              </view>
              <text class="material-icons-round dog-detail__rec-chevron">chevron_right</text>
            </view>
          </view>
          <BEmpty
            v-else
            icon="healing"
            title="暂无健康记录"
            description="记录疫苗、驱虫、疾病等信息"
          />
        </view>

        <!-- 详细信息（可折叠） -->
        <view class="dog-detail__section">
          <view class="dog-detail__collapse-head" :class="{ 'dog-detail__collapse-head--open': infoExpanded }" @click="infoExpanded = !infoExpanded">
            <view class="dog-detail__collapse-head-text">
              <text class="material-icons-round">info_outline</text>
              <text>详细信息</text>
            </view>
            <text class="material-icons-round dog-detail__collapse-arrow">expand_more</text>
          </view>
          <view v-if="infoExpanded" class="dog-detail__collapse-body">
            <view class="dog-detail__info-row">
              <text class="dog-detail__info-row-label">性别</text>
              <text class="dog-detail__info-row-value">{{ dog.gender }}</text>
            </view>
            <view class="dog-detail__info-row">
              <text class="dog-detail__info-row-label">品种</text>
              <text class="dog-detail__info-row-value">{{ dog.breed || '马尔济斯' }}</text>
            </view>
            <view class="dog-detail__info-row">
              <text class="dog-detail__info-row-label">出生日期</text>
              <text class="dog-detail__info-row-value">{{ dog.birth_date ? formatDate(dog.birth_date) : '—' }}</text>
            </view>
            <view v-if="dog.purchase_date" class="dog-detail__info-row">
              <text class="dog-detail__info-row-label">购入日期</text>
              <text class="dog-detail__info-row-value">{{ formatDate(dog.purchase_date) }}</text>
            </view>
            <view v-if="dog.purchase_price" class="dog-detail__info-row">
              <text class="dog-detail__info-row-label">购入价格</text>
              <text class="dog-detail__info-row-value">¥{{ dog.purchase_price.toLocaleString() }}</text>
            </view>
            <view class="dog-detail__info-row">
              <text class="dog-detail__info-row-label">去向</text>
              <text class="dog-detail__info-row-value">{{ dog.disposition || '—' }}</text>
            </view>
            <view v-if="dog.disposition_date" class="dog-detail__info-row">
              <text class="dog-detail__info-row-label">处置日期</text>
              <text class="dog-detail__info-row-value">{{ formatDate(dog.disposition_date) }}</text>
            </view>
            <view v-if="dog.disposition_notes" class="dog-detail__info-row">
              <text class="dog-detail__info-row-label">处置备注</text>
              <text class="dog-detail__info-row-value">{{ dog.disposition_notes }}</text>
            </view>
            <view v-if="dog.owner_info" class="dog-detail__info-row">
              <text class="dog-detail__info-row-label">主人信息</text>
              <text class="dog-detail__info-row-value">{{ dog.owner_info }}</text>
            </view>
            <view v-if="dog.origin_litter_id" class="dog-detail__info-row" @click="goToOriginLitter(dog.origin_litter_id)">
              <text class="dog-detail__info-row-label">来源窝</text>
              <text class="dog-detail__info-row-value" style="color: var(--primary); text-decoration: underline;">查看窝信息</text>
            </view>
            <view v-if="dog.latest_weight" class="dog-detail__info-row">
              <text class="dog-detail__info-row-label">最新体重</text>
              <text class="dog-detail__info-row-value">{{ formatWeight(dog.latest_weight) }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- ========== 繁育 Tab ========== -->
      <view v-if="activeTab === 'breeding'" class="dog-detail__pane">
        <!-- 发情中快捷操作 -->
        <view v-if="isInEstrus" class="breeding-estrus-banner">
          <view class="breeding-estrus-banner__info">
            <text class="material-icons-round breeding-estrus-banner__icon">favorite</text>
            <view>
              <text class="breeding-estrus-banner__title">发情中</text>
              <text class="breeding-estrus-banner__sub">记录本次发情进展</text>
            </view>
          </view>
          <view class="breeding-estrus-banner__actions">
            <view class="breeding-estrus-banner__btn" @click="navigateToRecordByPage('heat-observation')">
              <text>发情观察</text>
            </view>
            <view class="breeding-estrus-banner__btn" @click="navigateToRecordByPage('breeding-follicle')">
              <text>卵泡检查</text>
            </view>
            <view class="breeding-estrus-banner__btn breeding-estrus-banner__btn--primary" @click="navigateToRecordByPage('breeding-mating')">
              <text>配种记录</text>
            </view>
          </view>
        </view>

        <BEmpty
          v-if="cycles.length === 0"
          icon="child_care"
          title="暂无繁育记录"
          description="添加第一条繁育记录开始跟踪"
          actionText="添加记录"
          @action="addRecord"
        />
        <view v-else>
          <!-- 当前进行中周期（突出显示） -->
          <view v-if="activeCycle" class="breeding-active-cycle" @click="goToCycle(activeCycle._id)">
            <view class="breeding-active-cycle__header">
              <view class="breeding-active-cycle__dot" />
              <text class="breeding-active-cycle__label">进行中</text>
              <text class="material-icons-round breeding-active-cycle__chevron">chevron_right</text>
            </view>
            <text class="breeding-active-cycle__title">{{ activeCycle.title || '当前繁育周期' }}</text>
            <text class="breeding-active-cycle__sub">开始于 {{ formatDate(activeCycle.created_at) }}<text v-if="activeCycle.sire_name"> · 种公: {{ activeCycle.sire_name }}</text></text>
            <!-- 里程碑节点 -->
            <view class="breeding-milestones">
              <template v-for="(node, ni) in cycleNodes(activeCycle)" :key="ni">
                <view
                  class="breeding-milestone"
                  :class="node.active ? 'breeding-milestone--active' : node.done ? 'breeding-milestone--done' : 'breeding-milestone--pending'"
                >
                  <view class="breeding-milestone__dot" />
                  <text class="breeding-milestone__label">{{ node.key }}</text>
                </view>
                <view
                  v-if="ni < 3"
                  class="breeding-milestone-line"
                  :class="node.done && cycleNodes(activeCycle)[ni + 1]?.done ? 'breeding-milestone-line--done' : ''"
                />
              </template>
            </view>
            <!-- 孕期进度 -->
            <view v-if="activeCycleProgress" class="breeding-active-cycle__progress-wrap">
              <view class="breeding-active-cycle__progress-track">
                <view class="breeding-active-cycle__progress-fill" :style="{ width: activeCycleProgress.pct + '%' }" />
              </view>
              <text class="breeding-active-cycle__progress-label">{{ activeCycleProgress.label }}</text>
            </view>
          </view>

          <!-- 历史周期列表 -->
          <view v-if="pastCycles.length > 0">
            <view class="dog-detail__sec dog-detail__sec--rose">
              <text class="dog-detail__sec-text">繁育历史</text>
            </view>
            <view
              v-for="cycle in pastCycles"
              :key="cycle._id"
              class="dog-detail__cycle-card"
              @click="goToCycle(cycle._id)"
            >
              <view class="dog-detail__rec-icon" :class="cycle.status === '已生产' ? 'dog-detail__rec-icon--green' : 'dog-detail__rec-icon--gray'">
                <text class="material-icons-round">{{ cycle.status === '已生产' ? 'check_circle' : 'close' }}</text>
              </view>
              <view class="dog-detail__cycle-body">
                <text class="dog-detail__cycle-title">{{ cycle.title || '繁育周期' }}</text>
                <text class="dog-detail__cycle-sub">{{ formatDate(cycle.created_at) }}<text v-if="cycle.sire_name"> · 种公: {{ cycle.sire_name }}</text></text>
              </view>
              <view v-if="cycle.status" class="dog-detail__rec-tag" :class="cycle.status === '已生产' ? 'dog-detail__rec-tag--green' : 'dog-detail__rec-tag--gray'">
                <text class="dog-detail__rec-tag-text">{{ cycle.status }}</text>
              </view>
              <text class="material-icons-round dog-detail__rec-chevron">chevron_right</text>
            </view>
          </view>

          <!-- 窝列表 -->
          <view v-if="litters.length > 0">
            <view class="dog-detail__sec dog-detail__sec--green">
              <text class="dog-detail__sec-text">窝列表</text>
              <view class="dog-detail__sec-badge">
                <text class="dog-detail__sec-badge-text">{{ litters.length }}窝</text>
              </view>
            </view>
            <view class="dog-detail__rec-list">
              <view v-for="litter in litters" :key="litter._id" class="dog-detail__litter-item" @click="goToOriginLitter(litter._id)">
                <view class="dog-detail__litter-meta">
                  <text class="dog-detail__litter-date">{{ formatDate(litter.birth_date) }}</text>
                  <text v-if="litter.sire_name" class="dog-detail__litter-sire">种公: {{ litter.sire_name }}</text>
                </view>
                <view class="dog-detail__litter-content">
                  <view v-if="litter.pupStats" class="dog-detail__pup-chips">
                    <view class="dog-detail__pup-chip dog-detail__pup-chip--total">
                      <text class="dog-detail__pup-chip-text">共{{ litter.pupStats.total }}只</text>
                    </view>
                    <view v-if="litter.pupStats.alive > 0" class="dog-detail__pup-chip dog-detail__pup-chip--alive">
                      <text class="dog-detail__pup-chip-text">在养{{ litter.pupStats.alive }}</text>
                    </view>
                    <view v-if="litter.pupStats.sold > 0" class="dog-detail__pup-chip dog-detail__pup-chip--sold">
                      <text class="dog-detail__pup-chip-text">已售{{ litter.pupStats.sold }}</text>
                    </view>
                    <view v-if="litter.pupStats.available > 0" class="dog-detail__pup-chip dog-detail__pup-chip--avail">
                      <text class="dog-detail__pup-chip-text">可售{{ litter.pupStats.available }}</text>
                    </view>
                  </view>
                  <text class="material-icons-round dog-detail__rec-chevron">chevron_right</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- ========== 健康 Tab ========== -->
      <view v-if="activeTab === 'health'" class="dog-detail__pane">
        <!-- 体重快捷操作 -->
        <view class="dog-detail__weight-actions">
          <view class="dog-detail__weight-btn" @click="openWeightEntry">
            <text class="material-icons-round" style="font-size: 16px; color: var(--blue);">add</text>
            <text class="dog-detail__weight-btn-text">记录体重</text>
          </view>
          <view class="dog-detail__weight-btn" @click="openWeightChart">
            <text class="material-icons-round" style="font-size: 16px; color: var(--teal);">show_chart</text>
            <text class="dog-detail__weight-btn-text">体重趋势</text>
          </view>
        </view>

        <BEmpty
          v-if="healthRecords.length === 0 && medStatuses.length === 0"
          icon="healing"
          title="暂无健康记录"
          description="记录疫苗、驱虫、疾病等信息"
        />
        <view v-else>
          <!-- 用药中 -->
          <view v-if="medStatuses.length > 0" class="dog-detail__health-group">
            <view class="dog-detail__sec dog-detail__sec--plum">
              <text class="dog-detail__sec-text">用药中</text>
              <view class="dog-detail__sec-badge">
                <text class="dog-detail__sec-badge-text">{{ medStatuses.length }}</text>
              </view>
            </view>
            <view class="dog-detail__rec-list">
              <view v-for="s in medStatuses" :key="s.taskId || s.detail" class="dog-detail__rec-item" @click="handleStatusTap(s)">
                <view class="dog-detail__rec-icon dog-detail__rec-icon--plum">
                  <text class="material-icons-round">medication</text>
                </view>
                <view class="dog-detail__rec-body">
                  <text class="dog-detail__rec-title">{{ s.detail || '用药' }}</text>
                  <text v-if="s.progress" class="dog-detail__rec-sub">第{{ s.progress.current }}天 / 共{{ s.progress.total }}天</text>
                </view>
                <text class="material-icons-round dog-detail__rec-chevron">chevron_right</text>
              </view>
            </view>
          </view>
          <!-- 疫苗 -->
          <view v-if="vaccineRecords.length > 0" class="dog-detail__health-group">
            <view class="dog-detail__sec dog-detail__sec--blue">
              <text class="dog-detail__sec-text">疫苗</text>
              <view class="dog-detail__sec-badge">
                <text class="dog-detail__sec-badge-text">{{ vaccineRecords.length }}</text>
              </view>
            </view>
            <view class="dog-detail__rec-list">
              <view
                v-for="record in vaccineRecords"
                :key="record._id || record.id"
                class="dog-detail__rec-item"
                @click="goToHealthDetail(record._id || record.id)"
              >
                <view class="dog-detail__rec-icon dog-detail__rec-icon--blue">
                  <text class="material-icons-round">vaccines</text>
                </view>
                <view class="dog-detail__rec-body">
                  <text class="dog-detail__rec-title">{{ recordSubtitle(record) || '疫苗接种' }}</text>
                  <text class="dog-detail__rec-sub">{{ formatDate(record.date) }}</text>
                </view>
                <text class="material-icons-round dog-detail__rec-chevron">chevron_right</text>
              </view>
            </view>
          </view>
          <!-- 驱虫 -->
          <view v-if="dewormingRecords.length > 0" class="dog-detail__health-group">
            <view class="dog-detail__sec dog-detail__sec--teal">
              <text class="dog-detail__sec-text">驱虫</text>
              <view class="dog-detail__sec-badge">
                <text class="dog-detail__sec-badge-text">{{ dewormingRecords.length }}</text>
              </view>
            </view>
            <view class="dog-detail__rec-list">
              <view
                v-for="record in dewormingRecords"
                :key="record._id || record.id"
                class="dog-detail__rec-item"
                @click="goToHealthDetail(record._id || record.id)"
              >
                <view class="dog-detail__rec-icon dog-detail__rec-icon--teal">
                  <text class="material-icons-round">bug_report</text>
                </view>
                <view class="dog-detail__rec-body">
                  <text class="dog-detail__rec-title">{{ recordSubtitle(record) || '驱虫处理' }}</text>
                  <text class="dog-detail__rec-sub">{{ formatDate(record.date) }}</text>
                </view>
                <text class="material-icons-round dog-detail__rec-chevron">chevron_right</text>
              </view>
            </view>
          </view>
          <!-- 疾病 -->
          <view v-if="illnessRecords.length > 0" class="dog-detail__health-group">
            <view class="dog-detail__sec dog-detail__sec--red">
              <text class="dog-detail__sec-text">疾病</text>
              <view class="dog-detail__sec-badge">
                <text class="dog-detail__sec-badge-text">{{ illnessRecords.length }}</text>
              </view>
            </view>
            <view class="dog-detail__rec-list">
              <view
                v-for="record in illnessRecords"
                :key="record._id || record.id"
                class="dog-detail__rec-item"
                @click="goToHealthDetail(record._id || record.id)"
              >
                <view class="dog-detail__rec-icon dog-detail__rec-icon--red">
                  <text class="material-icons-round">healing</text>
                </view>
                <view class="dog-detail__rec-body">
                  <text class="dog-detail__rec-title">{{ recordSubtitle(record) || '疾病记录' }}</text>
                  <text class="dog-detail__rec-sub">{{ formatDate(record.date) }}</text>
                </view>
                <view
                  v-if="illnessStatusLabel(record)"
                  class="dog-detail__rec-tag"
                  :class="`dog-detail__rec-tag--${illnessStatusTone(record)}`"
                >
                  <text class="dog-detail__rec-tag-text">{{ illnessStatusLabel(record) }}</text>
                </view>
                <text class="material-icons-round dog-detail__rec-chevron">chevron_right</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- ========== 财务 Tab ========== -->
      <view v-if="activeTab === 'finance'" class="dog-detail__pane">
        <!-- 快捷操作 -->
        <view class="dog-detail__finance-links">
          <view class="dog-detail__finance-link" @click="goToExpenseAdd()">
            <text class="material-icons-round" style="font-size: 20px; color: var(--red);">remove_circle</text>
            <text class="dog-detail__finance-link-text">记录支出</text>
          </view>
          <view class="dog-detail__finance-link" @click="goToIncomeAdd()">
            <text class="material-icons-round" style="font-size: 20px; color: var(--green);">add_circle</text>
            <text class="dog-detail__finance-link-text">记录收入</text>
          </view>
          <view v-if="dog?.role === '种狗' && dog?.gender === '母'" class="dog-detail__finance-link" @click="goToDamRoi()">
            <text class="material-icons-round" style="font-size: 20px; color: var(--primary);">trending_up</text>
            <text class="dog-detail__finance-link-text">投资回报</text>
          </view>
        </view>
        <!-- 财务汇总 -->
        <view v-if="dogFinance" class="dog-detail__fin-summary">
          <view class="dog-detail__fin-grid">
            <view class="dog-detail__fin-cell">
              <text class="dog-detail__fin-cell-label">购入成本</text>
              <text class="dog-detail__fin-cell-value dog-detail__fin-cell-value--red">{{ formatAmount(dogFinance.purchaseCost || 0) }}</text>
            </view>
            <view class="dog-detail__fin-cell">
              <text class="dog-detail__fin-cell-label">直接费用</text>
              <text class="dog-detail__fin-cell-value dog-detail__fin-cell-value--red">{{ formatAmount(dogFinance.directExpenses || 0) }}</text>
            </view>
            <view class="dog-detail__fin-cell">
              <text class="dog-detail__fin-cell-label">销售收入</text>
              <text class="dog-detail__fin-cell-value dog-detail__fin-cell-value--green">{{ formatAmount(dogFinance.salesIncome || 0) }}</text>
            </view>
            <view class="dog-detail__fin-cell">
              <text class="dog-detail__fin-cell-label">净利润</text>
              <text
                class="dog-detail__fin-cell-value"
                :class="(dogFinance.netProfit || 0) >= 0 ? 'dog-detail__fin-cell-value--green' : 'dog-detail__fin-cell-value--red'"
              >{{ formatAmount(dogFinance.netProfit || 0) }}</text>
            </view>
          </view>
        </view>
        <!-- 最近交易 -->
        <view v-if="dogFinance?.recent?.length > 0">
          <view class="dog-detail__sec dog-detail__sec--teal">
            <text class="dog-detail__sec-text">最近交易</text>
          </view>
          <view class="dog-detail__rec-list">
            <view v-for="tx in dogFinance.recent" :key="tx._id" class="dog-detail__rec-item">
              <view class="dog-detail__rec-icon" :class="tx._txType === 'income' ? 'dog-detail__rec-icon--green' : 'dog-detail__rec-icon--red'">
                <text class="material-icons-round">{{ tx._txType === 'income' ? 'add_circle' : 'remove_circle' }}</text>
              </view>
              <view class="dog-detail__rec-body">
                <text class="dog-detail__rec-title">{{ tx.category || (tx._txType === 'income' ? '收入' : '支出') }}</text>
                <text class="dog-detail__rec-sub">{{ formatDate(tx.date) }}</text>
              </view>
              <text
                class="dog-detail__rec-amount"
                :class="tx._txType === 'income' ? 'dog-detail__rec-amount--green' : 'dog-detail__rec-amount--red'"
              >{{ tx._txType === 'income' ? '+' : '-' }}¥{{ (tx.amount || 0).toLocaleString() }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- ==================== 更多操作菜单 ==================== -->
    <view v-if="showMore" class="dog-detail__overlay" @click="showMore = false" @touchmove.prevent />
    <view class="dog-detail__action-sheet" :class="{ 'dog-detail__action-sheet--show': showMore }">
      <view class="dog-detail__action-sheet-handle" />
      <view class="dog-detail__action-sheet-item" @click="editDog">
        <view class="dog-detail__action-sheet-icon dog-detail__action-sheet-icon--blue">
          <text class="material-icons-round">edit</text>
        </view>
        <view class="dog-detail__action-sheet-text">
          <text class="dog-detail__action-sheet-title">编辑信息</text>
          <text class="dog-detail__action-sheet-desc">修改犬只基础信息</text>
        </view>
      </view>
      <view class="dog-detail__action-sheet-item" @click="openStatusSheet">
        <view class="dog-detail__action-sheet-icon dog-detail__action-sheet-icon--amber">
          <text class="material-icons-round">flag</text>
        </view>
        <view class="dog-detail__action-sheet-text">
          <text class="dog-detail__action-sheet-title">标记状态</text>
          <text class="dog-detail__action-sheet-desc">生病、康复等状态变更</text>
        </view>
      </view>
      <view class="dog-detail__action-sheet-item" @click="openDispositionSheet">
        <view class="dog-detail__action-sheet-icon dog-detail__action-sheet-icon--plum">
          <text class="material-icons-round">swap_horiz</text>
        </view>
        <view class="dog-detail__action-sheet-text">
          <text class="dog-detail__action-sheet-title">去向管理</text>
          <text class="dog-detail__action-sheet-desc">已故、领养、赠送、退休等</text>
        </view>
      </view>
      <view class="dog-detail__action-sheet-sep" />
      <view class="dog-detail__action-sheet-item" @click="openDeleteConfirm">
        <view class="dog-detail__action-sheet-icon dog-detail__action-sheet-icon--red">
          <text class="material-icons-round">delete_outline</text>
        </view>
        <view class="dog-detail__action-sheet-text">
          <text class="dog-detail__action-sheet-title dog-detail__action-sheet-title--danger">删除犬只</text>
          <text class="dog-detail__action-sheet-desc">移入回收站，30天内可恢复</text>
        </view>
      </view>
    </view>

    <!-- ==================== D-6: 快速标记状态 Sheet ==================== -->
    <BSheet v-model:visible="showStatusSheet" title="标记状态">
      <view class="status-sheet__dog-info">
        <text class="status-sheet__dog-emoji">&#x1F436;</text>
        <text class="status-sheet__dog-name">{{ dog.name || '未命名' }}</text>
      </view>
      <view class="status-grid status-grid--3col">
        <view class="status-card status-card--red" @click="selectIllness">
          <text class="status-card__emoji">&#x1F912;</text>
          <text class="status-card__label">生病</text>
          <text class="status-card__sub">录入疾病记录</text>
        </view>
        <view class="status-card status-card--plum" @click="openMedication">
          <text class="status-card__emoji">&#x1F48A;</text>
          <text class="status-card__label">开始用药</text>
          <text class="status-card__sub">添加用药计划</text>
        </view>
        <view class="status-card status-card--green" @click="openRecoveryConfirm">
          <text class="status-card__emoji">&#x2705;</text>
          <text class="status-card__label">标记康复</text>
          <text class="status-card__sub">退出生病状态</text>
        </view>
      </view>
      <view class="status-sheet__cancel" @click="showStatusSheet = false">
        <text class="status-sheet__cancel-text">取消</text>
      </view>
    </BSheet>

    <!-- ==================== D-7: 退休确认 Modal ==================== -->
    <BModal
      v-model:visible="showRetireModal"
      title="标记退休"
      confirm-text="确认退休"
      @confirm="doRetire"
    >
      <view class="modal-form">
        <view class="modal-form__group">
          <text class="modal-form__label">退休日期 *</text>
          <picker mode="date" :value="retireDate" @change="retireDate = $event.detail.value">
            <view class="modal-form__input">
              <text class="modal-form__input-text">{{ retireDate }}</text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
        </view>
        <view class="modal-form__group">
          <text class="modal-form__label">退休原因（选填）</text>
          <input v-model="retireReason" class="modal-form__text-input" placeholder="如：年龄过大/健康问题..." />
        </view>
      </view>
    </BModal>

    <!-- ==================== D-8: 已故确认 Modal ==================== -->
    <BModal
      v-model:visible="showDeceasedModal"
      title="标记已故"
      confirm-text="确认"
      :danger="true"
      @confirm="doDeceased"
    >
      <text class="modal-desc">此操作将取消所有未完成的提醒任务。</text>
      <view class="modal-form">
        <view class="modal-form__group">
          <text class="modal-form__label">日期 *</text>
          <picker mode="date" :value="deceasedDate" @change="deceasedDate = $event.detail.value">
            <view class="modal-form__input">
              <text class="modal-form__input-text">{{ deceasedDate }}</text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
        </view>
        <view class="modal-form__group">
          <text class="modal-form__label">备注（可选）</text>
          <input v-model="deceasedCause" class="modal-form__text-input" placeholder="死因等信息" />
        </view>
      </view>
    </BModal>

    <!-- ==================== D-9: 领养表单 Sheet ==================== -->
    <BSheet v-model:visible="showAdoptionSheet" title="标记领养">
      <view class="sheet-form">
        <view class="sheet-form__group">
          <text class="sheet-form__label">领养日期 *</text>
          <picker mode="date" :value="adoptionDate" @change="adoptionDate = $event.detail.value">
            <view class="sheet-form__input">
              <text class="sheet-form__input-text">{{ adoptionDate }}</text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
        </view>
        <view class="sheet-form__group">
          <text class="sheet-form__label">领养说明（选填）</text>
          <input v-model="adoptionNotes" class="sheet-form__text-input" placeholder="备注信息..." />
        </view>
        <view class="sheet-form__group">
          <text class="sheet-form__label">领养费（选填）</text>
          <view class="sheet-form__price-input">
            <text class="sheet-form__price-symbol">¥</text>
            <input v-model="adoptionFee" class="sheet-form__price-value" type="digit" placeholder="0" />
          </view>
          <text class="sheet-form__helper">有领养费将自动录入一笔收入</text>
        </view>
        <view class="sheet-form__actions">
          <view class="sheet-form__btn sheet-form__btn--primary" @click="doAdoption">
            <text class="sheet-form__btn-text" style="color: #fff;">确认领养</text>
          </view>
          <view class="sheet-form__btn sheet-form__btn--cancel" @click="showAdoptionSheet = false">
            <text class="sheet-form__btn-text" style="color: var(--text-2);">取消</text>
          </view>
        </view>
      </view>
    </BSheet>

    <!-- ==================== D-10: 赠送表单 Sheet ==================== -->
    <BSheet v-model:visible="showGiftSheet" title="标记赠送">
      <view class="sheet-form">
        <view class="sheet-form__group">
          <text class="sheet-form__label">赠送日期 *</text>
          <picker mode="date" :value="giftDate" @change="giftDate = $event.detail.value">
            <view class="sheet-form__input">
              <text class="sheet-form__input-text">{{ giftDate }}</text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
        </view>
        <view class="sheet-form__group">
          <text class="sheet-form__label">受赠人信息（选填）</text>
          <input v-model="giftRecipient" class="sheet-form__text-input" placeholder="受赠人姓名或联系方式..." />
        </view>
        <view class="sheet-form__actions">
          <view class="sheet-form__btn sheet-form__btn--primary" @click="doGift">
            <text class="sheet-form__btn-text" style="color: #fff;">确认赠送</text>
          </view>
          <view class="sheet-form__btn sheet-form__btn--cancel" @click="showGiftSheet = false">
            <text class="sheet-form__btn-text" style="color: var(--text-2);">取消</text>
          </view>
        </view>
      </view>
    </BSheet>

    <!-- ==================== D-11: 取消退休确认 Modal ==================== -->
    <BModal
      v-model:visible="showCancelRetireModal"
      title="取消退休"
      content="确认恢复在养状态？犬只将重新回到活跃种狗列表中。"
      confirm-text="确认恢复"
      @confirm="doCancelRetire"
    />

    <!-- ==================== D-12: 幼崽升级为种狗确认 Modal ==================== -->
    <BModal
      v-model:visible="showPromoteModal"
      title="升级为种狗"
      content="确认将此幼崽升级为种狗？角色将从「幼崽」变更为「种狗」，去向变为「在养」。"
      confirm-text="确认升级"
      @confirm="doPromote"
    />

    <!-- ==================== D-13: 康复确认 Modal ==================== -->
    <BModal
      v-model:visible="showRecoveryModal"
      title="标记康复"
      confirm-text="确认康复"
      @confirm="doRecovery"
    >
      <text class="modal-desc">确认犬只已康复？将退出当前生病状态。</text>
      <view class="modal-form">
        <view class="modal-form__group">
          <text class="modal-form__label">康复日期</text>
          <picker mode="date" :value="recoveryDate" @change="recoveryDate = $event.detail.value">
            <view class="modal-form__input">
              <text class="modal-form__input-text">{{ recoveryDate }}</text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
        </view>
      </view>
    </BModal>

    <!-- ==================== D-14: 删除犬只确认 Modal ==================== -->
    <BDeleteConfirm
      v-model:visible="showDeleteModal"
      title="删除犬只"
      :content="`确认删除「${dog.name || '未命名'}」？删除后将移入回收站。`"
      @confirm="doDelete"
    />

    <!-- ==================== D-20: 单犬体重录入 Sheet ==================== -->
    <BSheet v-model:visible="showWeightEntry" title="记录体重">
      <view class="weight-entry">
        <view class="weight-entry__dog-row">
          <view class="weight-entry__dog-avatar">
            <text class="material-icons-round" style="font-size: 16px; color: #fff;">pets</text>
          </view>
          <view class="weight-entry__dog-info">
            <text class="weight-entry__dog-name">{{ dog.name || '未命名' }}</text>
            <text class="weight-entry__last-weight">
              上次体重：{{ dog.latest_weight ? formatWeight(dog.latest_weight) : '暂无记录' }}
            </text>
          </view>
        </view>

        <view class="weight-entry__form">
          <view class="weight-entry__field">
            <text class="weight-entry__label">体重 (kg)</text>
            <view class="weight-entry__input-wrap">
              <input
                v-model="weightInput"
                class="weight-entry__input"
                type="digit"
                placeholder="请输入体重"
              />
              <text class="weight-entry__unit">kg</text>
            </view>
          </view>

          <view class="weight-entry__field">
            <text class="weight-entry__label">日期</text>
            <picker mode="date" :value="weightDateStr" @change="weightDateStr = $event.detail.value">
              <view class="weight-entry__date-picker">
                <text class="weight-entry__date-text">{{ weightDateStr }}</text>
                <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
              </view>
            </picker>
          </view>

          <view class="weight-entry__field">
            <text class="weight-entry__label">备注（选填）</text>
            <input
              v-model="weightNotes"
              class="weight-entry__notes-input"
              placeholder="如：饭前/饭后..."
            />
          </view>
        </view>

        <view class="weight-entry__actions">
          <button
            class="submit-btn weight-entry__save-btn"
            :class="{ 'submit-btn--success': weightSubmitState === 'success' }"
            :disabled="weightSubmitState !== 'idle'"
            @click="saveWeight"
          >
            {{ weightSaveButtonText }}
          </button>
        </view>
      </view>
    </BSheet>

    <!-- ==================== D-21: 体重趋势详情 Sheet ==================== -->
    <BSheet v-model:visible="showWeightChart" title="体重趋势" height="75vh">
      <view class="weight-chart">
        <!-- 简易趋势图占位 -->
        <view class="weight-chart__graph">
          <view v-if="weightHistory.length < 2" class="weight-chart__graph-empty">
            <text class="material-icons-round" style="font-size: 40px; color: var(--text-4);">show_chart</text>
            <text class="weight-chart__graph-empty-text">至少需要2条记录才能显示趋势</text>
          </view>
          <view v-else class="weight-chart__svg-area">
            <!-- SVG 折线图 -->
            <view class="weight-chart__axis">
              <text class="weight-chart__axis-label">{{ weightChartMax }}kg</text>
              <view class="weight-chart__axis-line" />
              <text class="weight-chart__axis-label">{{ weightChartMin }}kg</text>
            </view>
            <view class="weight-chart__bars">
              <view
                v-for="(w, idx) in weightTrendRecords"
                :key="idx"
                class="weight-chart__bar-col"
              >
                <view
                  class="weight-chart__bar"
                  :style="{ height: weightBarHeight(w.weight) + '%' }"
                />
                <text class="weight-chart__bar-label">{{ formatWeightKg(w.weight) }}</text>
                <text class="weight-chart__bar-date">{{ formatShortDate(w.date) }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 增长率 -->
        <view v-if="growthRate !== null" class="weight-chart__growth">
          <text class="material-icons-round" style="font-size: 16px;" :style="{ color: growthRate >= 0 ? 'var(--green)' : 'var(--red)' }">
            {{ growthRate >= 0 ? 'trending_up' : 'trending_down' }}
          </text>
          <text class="weight-chart__growth-text">
            近期增长率：{{ growthRate >= 0 ? '+' : '' }}{{ growthRate.toFixed(1) }}%
          </text>
        </view>

        <!-- 最近10条记录 -->
        <view class="weight-chart__section-title">
          <text>最近记录</text>
        </view>
        <view v-if="recentWeightRecords.length === 0" class="weight-chart__empty-list">
          <text class="weight-chart__empty-text">暂无体重记录</text>
        </view>
        <view v-else class="weight-chart__list">
          <view
            v-for="(record, idx) in recentWeightRecords.slice(0, 10)"
            :key="idx"
            class="weight-chart__record"
          >
            <view class="weight-chart__rec-icon">
              <text class="material-icons-round" style="font-size: 16px; color: var(--blue);">monitor_weight</text>
            </view>
            <view class="weight-chart__rec-body">
              <text class="weight-chart__rec-weight">{{ formatWeight(record.weight) }}</text>
              <text class="weight-chart__rec-date">{{ formatDate(record.date) }}</text>
              <text v-if="record.notes" class="weight-chart__rec-note">{{ record.notes }}</text>
            </view>
            <text
              v-if="recentWeightRecords[idx + 1]"
              class="weight-chart__rec-diff"
              :style="{ color: record.weight >= recentWeightRecords[idx + 1].weight ? 'var(--green)' : 'var(--red)' }"
            >
              {{ record.weight >= recentWeightRecords[idx + 1].weight ? '+' : '' }}{{ formatWeight(record.weight - recentWeightRecords[idx + 1].weight) }}
            </text>
          </view>
        </view>
      </view>
    </BSheet>

    <!-- ==================== 添加记录 Sheet ==================== -->
    <BSheet v-model:visible="showAddRecordSheet" title="添加记录" height="78vh">
      <view class="add-record-list">
        <view class="add-record-context">
          <view class="add-record-context__badge">
            <text class="material-icons-round add-record-context__badge-icon">pets</text>
          </view>
          <view class="add-record-context__body">
            <view class="add-record-context__title-row">
              <text class="add-record-context__title">{{ dog?.name || '当前犬只' }}</text>
              <text v-if="activeCycle?._id" class="add-record-context__status">{{ activeCycle.status || '进行中' }}</text>
            </view>
            <text class="add-record-context__sub">{{ activeCycle?._id ? '繁育记录将自动带入当前周期' : '按业务分组快速记录' }}</text>
          </view>
        </view>
        <view
          v-for="group in addRecordGroups"
          :key="group.key"
          class="add-record-group"
        >
          <view class="add-record-group__head">
            <view class="add-record-group__meta">
              <text class="add-record-group__title">{{ group.title }}</text>
              <text class="add-record-group__count">{{ group.items.length }}项</text>
            </view>
            <text
              v-if="group.key === 'breeding' && activeCycle?._id"
              class="add-record-group__hint"
            >将自动带入当前周期</text>
          </view>
          <view class="add-record-group__body">
            <view
              v-for="item in group.items"
              :key="item.page"
              class="add-record-item"
              :class="{ 'add-record-item--full': item.layout === 'full' }"
              @click="navigateToRecord(item)"
            >
              <view class="add-record-item__icon" :style="{ background: item.iconBg }">
                <text class="material-icons-round" :style="{ color: item.color, fontSize: '20px' }">{{ item.icon }}</text>
              </view>
              <view class="add-record-item__content">
                <text class="add-record-item__label">{{ item.label }}</text>
                <text class="add-record-item__desc">{{ item.desc }}</text>
              </view>
              <view class="add-record-item__action">
                <text class="material-icons-round add-record-item__arrow">chevron_right</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </BSheet>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BModal from '@/components/layout/BModal.vue'
import BDeleteConfirm from '@/components/layout/BDeleteConfirm.vue'
import { useCloudCall } from '@/composables/useCloudCall'
import { consumeSubmitFeedback } from '@/composables/useSubmitFeedback'
import { useDogStore } from '@/stores/dogStore'
import type { Dog, DeriveStatus } from '@/types/dog'
import { resolveDogDetailStatusRoute } from '@/utils/dogDetailNavigation'
import { getDogStatusTone, getHealthTypeTone } from '@/utils/themeSemantics'

const dog = ref<Dog | null>(null)
const statuses = ref<DeriveStatus[]>([])
const cycles = ref<any[]>([])
const healthRecords = ref<any[]>([])
const activeTab = ref('overview')
const loading = ref(true)
const showMore = ref(false)
const showAddRecordSheet = ref(false)
const infoExpanded = ref(false)
const submitBannerMessage = ref('')
let dogId = ''
let submitBannerTimer: ReturnType<typeof setTimeout> | null = null
let hasLoadedOnce = false
let latestLoadToken = 0

const tabs = [
  { key: 'overview', label: '概览' },
  { key: 'breeding', label: '繁育' },
  { key: 'health', label: '健康' },
  { key: 'finance', label: '财务' },
]

type AddRecordItem = {
  icon: string
  iconBg: string
  color: string
  label: string
  desc: string
  page: string
  url?: string
  kind: 'breeding' | 'health' | 'medication'
  layout?: 'default' | 'full'
}

// 状态 → 功能色映射
const statusColorMap: Record<string, 'amber' | 'rose' | 'green' | 'red' | 'plum'> = {
  '发情中': getDogStatusTone('发情中').color as 'amber',
  '怀孕中': getDogStatusTone('怀孕中').color as 'rose',
  '哺乳中': getDogStatusTone('哺乳中').color as 'green',
  '生病中': getDogStatusTone('生病中').color as 'red',
  '用药中': getDogStatusTone('用药中').color as 'plum',
}

// 状态 → 图标映射
const statusIconMap: Record<string, string> = {
  '发情中': 'local_fire_department',
  '怀孕中': 'favorite',
  '哺乳中': 'child_friendly',
  '生病中': 'sick',
  '用药中': 'medication',
}

// Hero avatar 颜色 — 与 BDogPicker 保持一致
const heroAvatarClass = computed(() => {
  const d = dog.value
  if (!d) return 'dog-detail__hero-avatar--primary'
  if (d.role === '幼崽') return 'dog-detail__hero-avatar--amber'
  if (d.role === '外部种公') return 'dog-detail__hero-avatar--blue'
  if (d.gender === '母') return 'dog-detail__hero-avatar--rose'
  if (d.gender === '公') return 'dog-detail__hero-avatar--teal'
  return 'dog-detail__hero-avatar--primary'
})

// 繁育周期计算属性
const isInEstrus = computed(() => statuses.value.some((s: any) => s.type === '发情中'))
const TERMINAL_CYCLE_STATUSES = ['已生产', '失败', '放弃']
const activeCycle = computed(() => cycles.value.find((c: any) => !TERMINAL_CYCLE_STATUSES.includes(c.status)))
const pastCycles = computed(() => cycles.value.filter((c: any) => TERMINAL_CYCLE_STATUSES.includes(c.status)))

const medStatuses = computed(() => statuses.value.filter((s: DeriveStatus) => s.type === '用药中'))
const vaccineRecords = computed(() => healthRecords.value.filter((r: any) => r.type === 'vaccination'))
const dewormingRecords = computed(() => healthRecords.value.filter((r: any) => r.type === 'deworming'))
const illnessRecords = computed(() => healthRecords.value.filter((r: any) => r.type === 'illness'))
const latestIllnessRecord = computed(() => illnessRecords.value[0] || null)
const activeCycleProgress = computed(() => {
  const pregStatus = statuses.value.find((s: DeriveStatus) => s.type === '怀孕中')
  if (!pregStatus?.progress) return null
  const pct = Math.min(100, Math.round(pregStatus.progress.current / pregStatus.progress.total * 100))
  return { pct, label: pregStatus.detail || `孕期第${pregStatus.progress.current}天` }
})

const litters = ref<any[]>([])
const dogFinance = ref<any>(null)

const { run: fetchDetail } = useCloudCall<{ data: Dog }>('dog-service', 'getDogDetail')
const { run: fetchCycles } = useCloudCall<{ data: any[] }>('breeding-service', 'getCycleHistory')
const { run: fetchHealth } = useCloudCall<{ data: any[] }>('health-service', 'getHealthHistory')
const { run: fetchLitters } = useCloudCall<{ data: any[] }>('breeding-service', 'getLittersByDam')
const { run: fetchDogFinance } = useCloudCall<{ data: any }>('finance-service', 'getDogFinanceSummary')
const { run: cleanupDuplicateIllnesses } = useCloudCall('health-service', 'cleanupDuplicateIllnesses', {
  showLoading: false,
})
const { run: updateDisposition } = useCloudCall('dog-service', 'updateDisposition', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: updateStatus } = useCloudCall('dog-service', 'updateStatus', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: deleteDog } = useCloudCall('dog-service', 'deleteDog', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: promoteToBreeder } = useCloudCall('dog-service', 'promoteToBreeder', { successMode: 'silent', loadingMode: 'local', throwOnError: true })

// ==================== 工具函数 ====================

function formatDate(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayStr() {
  return formatDate(Date.now())
}

function formatAge(birthTs: number) {
  const days = Math.floor((Date.now() - birthTs) / 86400000)
  if (days < 30) return `${days}天`
  if (days < 365) return `${Math.floor(days / 30)}月龄`
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  return months > 0 ? `${years}岁${months}月` : `${years}岁`
}

function formatWeight(grams: number) {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)}kg` : `${grams}g`
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    vaccination: '疫苗',
    deworming: '驱虫',
    illness: '疾病',
  }
  return map[type] || type
}

/** 记录副标题：病名/疫苗型号/驱虫药，优先 details 字段，fallback notes */
function recordSubtitle(record: any) {
  if (record.type === 'illness') return record.details?.condition || record.notes || null
  if (record.type === 'vaccination') {
    const vaccineType = record.details?.vaccine_type || record.details?.vaccine_name
    return vaccineType ? `疫苗 · ${vaccineType}` : (record.notes || null)
  }
  if (record.type === 'deworming') return record.details?.drug_name || record.notes || null
  return record.notes || null
}

function recentHealthRecordTitle(record: any) {
  const subtitle = recordSubtitle(record)
  if (record?.type === 'vaccination' || record?.type === 'deworming') {
    return subtitle || typeLabel(record?.type)
  }
  if (record?.type === 'illness') {
    return subtitle ? `${typeLabel(record.type)} · ${subtitle}` : '疾病记录'
  }
  return subtitle || typeLabel(record?.type)
}

function illnessStatusLabel(record: any) {
  if (record?.type !== 'illness') return ''
  return record.details?.treatment_status || ''
}

function illnessStatusTone(record: any) {
  const status = illnessStatusLabel(record)
  if (status === '已康复') return 'green'
  if (status === '治疗中') return 'amber'
  return 'red'
}

function healthIcon(type: string) {
  const map: Record<string, string> = {
    vaccination: 'vaccines',
    deworming: 'bug_report',
    illness: 'healing',
  }
  return map[type] || 'healing'
}

function healthIconColor(type: string) {
  return getHealthTypeTone(type).color
}

function splitStatusDetail(detail?: string | null) {
  const raw = `${detail || ''}`.trim()
  if (!raw) return { primary: '', secondary: '' }

  const dotParts = raw.split('·').map(part => part.trim()).filter(Boolean)
  if (dotParts.length > 1) {
    return {
      primary: dotParts[0],
      secondary: dotParts.slice(1).join(' · '),
    }
  }

  const spaceParts = raw.split(/\s+/).filter(Boolean)
  if (spaceParts.length > 1) {
    return {
      primary: spaceParts[0],
      secondary: spaceParts.slice(1).join(' '),
    }
  }

  return { primary: raw, secondary: '' }
}

function getIllnessStartTs() {
  const startTs = latestIllnessRecord.value?.details?.start_date
  if (typeof startTs === 'number') return startTs
  return typeof latestIllnessRecord.value?.date === 'number' ? latestIllnessRecord.value.date : null
}

function getElapsedDaysFromTs(startTs?: number | null) {
  if (typeof startTs !== 'number') return null
  return Math.max(1, Math.floor((Date.now() - startTs) / 86400000) + 1)
}

function statusTitle(s: DeriveStatus): string {
  if (s.type === '怀孕中' && s.progress) return `${s.type} · 第${s.progress.current}天`
  if (s.type === '发情中') {
    const day = s.progress?.current || activeCycle.value?.day_count
    return day ? `${s.type} · 第${day}天` : s.type
  }
  if (s.type === '哺乳中' && s.progress) return `${s.type} · 第${s.progress.current}天`
  if (s.type === '用药中') {
    const med = splitStatusDetail(s.detail).primary || s.label || s.type
    return s.progress ? `${med} · 第${s.progress.current}天` : med
  }
  if (s.type === '生病中') {
    const illnessName = s.label || latestIllnessRecord.value?.details?.condition || s.type
    const day = getElapsedDaysFromTs(getIllnessStartTs())
    return day ? `${illnessName} · 第${day}天` : illnessName
  }
  return s.label || s.type
}

function statusSub(s: DeriveStatus): string {
  if (s.type === '用药中') {
    return splitStatusDetail(s.detail).secondary
  }
  if (s.type === '生病中') {
    const treatmentStatus = latestIllnessRecord.value?.details?.treatment_status
    return treatmentStatus || s.detail || latestIllnessRecord.value?.notes || '查看症状与治疗状态'
  }
  if (s.type === '发情中') {
    const startTs = activeCycle.value?.start_date || activeCycle.value?.created_at
    return startTs ? `当前周期开始于 ${formatDate(startTs)}` : '当前繁育周期进行中'
  }
  return s.detail || ''
}

function statusProgressText(s: DeriveStatus): string {
  if (!s.progress) return ''
  return `${s.progress.current}/${s.progress.total}天`
}

function statusMeta(s: DeriveStatus): Array<{ icon: string; text: string }> {
  if (Array.isArray(s.meta) && s.meta.length > 0) return s.meta

  if (s.type === '生病中') {
    const items: Array<{ icon: string; text: string }> = []
    const treatmentStatus = latestIllnessRecord.value?.details?.treatment_status
    const dateTs = getIllnessStartTs()
    const day = getElapsedDaysFromTs(dateTs)
    if (treatmentStatus) items.push({ icon: 'healing', text: treatmentStatus })
    if (day) items.push({ icon: 'schedule', text: `第${day}天` })
    if (typeof dateTs === 'number') items.push({ icon: 'event', text: `开始于 ${formatDate(dateTs)}` })
    return items
  }

  if (s.type === '发情中') {
    const items: Array<{ icon: string; text: string }> = []
    const startTs = activeCycle.value?.start_date || activeCycle.value?.created_at
    const day = s.progress?.current || activeCycle.value?.day_count
    if (typeof startTs === 'number') items.push({ icon: 'event', text: `开始于 ${formatDate(startTs)}` })
    if (day) items.push({ icon: 'schedule', text: `第${day}天` })
    return items
  }

  return []
}

function statusToneClass(type: string, prefix: 'hero' | 'row' | 'icon' | 'progress' | 'progressText') {
  if (type === '生病中') return `dog-detail__st-${prefix}--illness`
  const tone = statusColorMap[type] || 'rose'
  if (prefix === 'hero') return `dog-detail__hero-tag--${tone}`
  if (prefix === 'row') return `dog-detail__status-row--${tone}`
  if (prefix === 'icon') return `dog-detail__st-icon--${tone}`
  if (prefix === 'progressText') return `dog-detail__st-progress-text--${tone}`
  return `dog-detail__st-progress-fill--${tone}`
}

function cycleNodes(cycle: any) {
  const st = cycle.status || ''
  return [
    { key: '发情', done: true, active: st === '发情中' },
    { key: '配种', done: st !== '发情中', active: false },
    { key: '确孕', done: ['怀孕中', '临产中', '已生产'].includes(st), active: st === '怀孕中' },
    { key: '分娩', done: st === '已生产', active: st === '临产中' },
  ]
}

function formatAmount(amount: number) {
  if (!amount) return '¥0'
  return amount >= 10000 ? `¥${(amount / 10000).toFixed(1)}万` : `¥${amount.toLocaleString()}`
}

function goBack() {
  uni.navigateBack()
}

function showSubmitBanner(message: string) {
  submitBannerMessage.value = message
  if (submitBannerTimer) clearTimeout(submitBannerTimer)
  submitBannerTimer = setTimeout(() => {
    submitBannerMessage.value = ''
  }, 2200)
}

function goToCycle(cycleId: string) {
  if (!cycleId) {
    uni.showToast({ title: '周期信息缺失', icon: 'none' })
    return
  }
  uni.navigateTo({
    url: `/pages/breeding/cycle?id=${cycleId}`,
    fail() {
      uni.showToast({ title: '周期页打开失败', icon: 'none' })
    },
  })
}

function editDog() {
  showMore.value = false
  uni.navigateTo({ url: `/pages/dog/add?id=${dogId}` })
}

const addRecordGroups = [
  {
    key: 'breeding',
    title: '繁育',
    items: [
      { icon: 'whatshot', iconBg: 'var(--icon-rose)', color: 'var(--rose)', label: '发情记录', desc: '记录发情开始', page: 'breeding-heat', kind: 'breeding' },
      { icon: 'monitor_heart', iconBg: 'var(--icon-amber)', color: 'var(--amber)', label: '发情观察', desc: '补充观察日志', page: 'heat-observation', kind: 'breeding' },
      { icon: 'biotech', iconBg: 'var(--icon-teal)', color: 'var(--teal)', label: '卵泡检查', desc: '记录发育情况', page: 'breeding-follicle', kind: 'breeding' },
      { icon: 'favorite', iconBg: 'var(--icon-rose)', color: 'var(--rose)', label: '配种记录', desc: '进入配种节点', page: 'breeding-mating', kind: 'breeding' },
      { icon: 'pregnant_woman', iconBg: 'var(--icon-green)', color: 'var(--green)', label: '孕检记录', desc: '确认怀孕结果', page: 'breeding-pregnancy', kind: 'breeding' },
      { icon: 'medical_services', iconBg: 'var(--icon-blue)', color: 'var(--blue)', label: '产检记录', desc: '补录产检结果', page: 'breeding-prenatal', kind: 'breeding' },
      { icon: 'schedule', iconBg: 'var(--icon-amber)', color: 'var(--amber)', label: '临产监测', desc: '观察临产信号', page: 'breeding-prelabor', kind: 'breeding' },
      { icon: 'child_friendly', iconBg: 'var(--icon-rose)', color: 'var(--rose)', label: '生产记录', desc: '记录分娩结果', page: 'birth-wizard', url: '/pages/breeding/birth-wizard', kind: 'breeding' },
      { icon: 'warning', iconBg: 'var(--icon-red)', color: 'var(--red)', label: '异常终止', desc: '记录终止结果', page: 'breeding-termination', kind: 'breeding' },
    ] as AddRecordItem[],
  },
  {
    key: 'health',
    title: '健康',
    items: [
      { icon: 'vaccines', iconBg: 'var(--icon-blue)', color: 'var(--blue)', label: '疫苗记录', desc: '接种与提醒', page: 'health-vaccination', kind: 'health' },
      { icon: 'shield', iconBg: 'var(--icon-teal)', color: 'var(--teal)', label: '驱虫记录', desc: '内驱外驱补录', page: 'health-deworming', kind: 'health' },
      { icon: 'sick', iconBg: 'var(--icon-red)', color: 'var(--red)', label: '疾病记录', desc: '症状与治疗状态', page: 'health-illness', kind: 'health', layout: 'full' },
    ] as AddRecordItem[],
  },
  {
    key: 'medication',
    title: '用药',
    items: [
      { icon: 'medication', iconBg: 'var(--icon-plum)', color: 'var(--plum)', label: '开始用药', desc: '创建连续用药任务', page: 'health-medication', kind: 'medication', layout: 'full' },
    ] as AddRecordItem[],
  },
]

function addRecord() {
  showAddRecordSheet.value = true
}

function navigateToRecord(item: AddRecordItem) {
  if (item.url === '/pages/breeding/birth-wizard' && !activeCycle.value?._id) {
    uni.showToast({ title: '当前无可记录的繁育周期', icon: 'none' })
    return
  }

  showAddRecordSheet.value = false
  const dogName = encodeURIComponent(dog.value?.name || '')
  const cycleQuery = item.kind === 'breeding' && activeCycle.value?._id ? `&cycleId=${activeCycle.value._id}` : ''
  const damNameQuery = item.url === '/pages/breeding/birth-wizard'
    ? `&damName=${dogName}`
    : ''
  const baseUrl = item.url || `/pages/record/${item.page}`
  uni.navigateTo({
    url: `${baseUrl}?dogId=${dogId}&dogName=${dogName}&locked=true${cycleQuery}${damNameQuery}`,
    fail() {
      uni.showToast({ title: '页面打开失败', icon: 'none' })
    },
  })
}

function navigateToRecordByPage(page: string) {
  const target = addRecordGroups.flatMap(group => group.items).find(item => item.page === page)
  if (!target) {
    uni.showToast({ title: '入口暂不可用', icon: 'none' })
    return
  }
  navigateToRecord(target)
}

function goToHealthDetail(recordId?: string) {
  const normalizedId = typeof recordId === 'string' ? recordId.trim() : ''
  if (!normalizedId) {
    uni.showToast({ title: '记录信息缺失', icon: 'none' })
    return
  }
  uni.navigateTo({
    url: `/pages/record/health-detail?id=${normalizedId}`,
    fail() {
      uni.showToast({ title: '详情打开失败', icon: 'none' })
    },
  })
}

function goToOriginLitter(litterId: string) {
  uni.navigateTo({
    url: `/pages/breeding/litter?id=${litterId}`,
    fail() {
      uni.showToast({ title: '窝详情打开失败', icon: 'none' })
    },
  })
}

function goToExpenseAdd() {
  uni.navigateTo({ url: `/pages/finance/expense-add?dogId=${dogId}` })
}

function goToIncomeAdd() {
  uni.navigateTo({ url: `/pages/finance/expense-add?type=income&dogId=${dogId}` })
}

function goToDamRoi() {
  uni.navigateTo({ url: `/pages/finance/dam-roi?damId=${dogId}` })
}

function handleStatusTap(status: DeriveStatus) {
  const url = resolveDogDetailStatusRoute(status)
  if (url) {
    uni.navigateTo({
      url,
      fail() {
        uni.showToast({ title: '详情打开失败', icon: 'none' })
      },
    })
    return
  }
  openStatusSheet()
}

// ==================== D-6: 快速标记状态 ====================

const showStatusSheet = ref(false)

function openStatusSheet() {
  showMore.value = false
  showStatusSheet.value = true
}

// ==================== 去向管理 ====================

function openDispositionSheet() {
  showMore.value = false

  // 根据当前状态构建选项
  let items: string[] = []
  const d = dog.value
  if (!d) return

  if (d.role === '幼崽') {
    items = ['升级为种犬', '标记已故', '送领养', '赠送']
  } else if (d.disposition === '已退休') {
    items = ['取消退休', '标记已故']
  } else {
    // 在养 / 自留 / 默认
    items = ['标记已故', '送领养', '赠送', '退休']
  }

  uni.showActionSheet({
    itemList: items,
    success: (res) => {
      const selected = items[res.tapIndex]
      switch (selected) {
        case '标记已故':
          deceasedDate.value = todayStr()
          deceasedCause.value = ''
          showDeceasedModal.value = true
          break
        case '送领养':
          adoptionDate.value = todayStr()
          adoptionNotes.value = ''
          adoptionFee.value = ''
          showAdoptionSheet.value = true
          break
        case '赠送':
          giftDate.value = todayStr()
          giftRecipient.value = ''
          showGiftSheet.value = true
          break
        case '退休':
          retireDate.value = todayStr()
          retireReason.value = ''
          showRetireModal.value = true
          break
        case '取消退休':
          showCancelRetireModal.value = true
          break
        case '升级为种犬':
          showPromoteModal.value = true
          break
      }
    },
  })
}

function selectIllness() {
  showStatusSheet.value = false
  // 跳转到疾病记录表单
  uni.navigateTo({ url: `/pages/record/health-illness?dogId=${dogId}` })
}

function openMedication() {
  showStatusSheet.value = false
  uni.navigateTo({ url: `/pages/record/health-medication?dogId=${dogId}&dogName=${encodeURIComponent(dog.value?.name || '')}` })
}

// ==================== D-7: 退休确认 ====================

const showRetireModal = ref(false)
const retireDate = ref(todayStr())
const retireReason = ref('')

function openRetireConfirm() {
  showStatusSheet.value = false
  retireDate.value = todayStr()
  retireReason.value = ''
  showRetireModal.value = true
}

async function doRetire() {
  await updateDisposition(dogId, '已退休', {
    date: new Date(retireDate.value + 'T00:00:00+08:00').getTime(),
    reason: retireReason.value || null,
  })
  showRetireModal.value = false
  await loadData()
}

// ==================== D-8: 已故确认 ====================

const showDeceasedModal = ref(false)
const deceasedDate = ref(todayStr())
const deceasedCause = ref('')

async function doDeceased() {
  await updateDisposition(dogId, '已故', {
    date: new Date(deceasedDate.value + 'T00:00:00+08:00').getTime(),
    cause: deceasedCause.value || null,
  })
  showDeceasedModal.value = false
  await loadData()
}

// ==================== D-9: 领养表单 ====================

const showAdoptionSheet = ref(false)
const adoptionDate = ref(todayStr())
const adoptionNotes = ref('')
const adoptionFee = ref('')

async function doAdoption() {
  await updateDisposition(dogId, '已领养', {
    date: new Date(adoptionDate.value + 'T00:00:00+08:00').getTime(),
    notes: adoptionNotes.value || null,
    fee: adoptionFee.value ? Number(adoptionFee.value) : null,
  })
  showAdoptionSheet.value = false
  await loadData()
}

// ==================== D-10: 赠送表单 ====================

const showGiftSheet = ref(false)
const giftDate = ref(todayStr())
const giftRecipient = ref('')

async function doGift() {
  await updateDisposition(dogId, '已赠送', {
    date: new Date(giftDate.value + 'T00:00:00+08:00').getTime(),
    recipient: giftRecipient.value || null,
  })
  showGiftSheet.value = false
  await loadData()
}

// ==================== D-11: 取消退休 ====================

const showCancelRetireModal = ref(false)

async function doCancelRetire() {
  await updateDisposition(dogId, '在养', {})
  showCancelRetireModal.value = false
  await loadData()
}

// ==================== D-12: 幼崽升级为种狗 ====================

const showPromoteModal = ref(false)

async function doPromote() {
  await promoteToBreeder(dogId)
  showPromoteModal.value = false
  await loadData()
}

// ==================== D-13: 康复确认 ====================

const showRecoveryModal = ref(false)
const recoveryDate = ref(todayStr())

function openRecoveryConfirm() {
  showStatusSheet.value = false
  recoveryDate.value = todayStr()
  showRecoveryModal.value = true
}

async function doRecovery() {
  await updateStatus(dogId, 'recover', {
    date: new Date(recoveryDate.value + 'T00:00:00+08:00').getTime(),
  })
  showRecoveryModal.value = false
  await loadData()
}

// ==================== D-20: 单犬体重录入 ====================

const showWeightEntry = ref(false)
const weightInput = ref('')
const weightDateStr = ref(todayStr())
const weightNotes = ref('')
const weightSubmitState = ref<'idle' | 'submitting' | 'success'>('idle')

const weightSaveButtonText = computed(() => {
  if (weightSubmitState.value === 'submitting') return '保存中...'
  if (weightSubmitState.value === 'success') return '已保存'
  return '保存'
})

const { run: addWeightRecord } = useCloudCall('health-service', 'addWeightRecord', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

function openWeightEntry() {
  weightInput.value = ''
  weightDateStr.value = todayStr()
  weightNotes.value = ''
  weightSubmitState.value = 'idle'
  showWeightEntry.value = true
}

async function saveWeight() {
  if (weightSubmitState.value !== 'idle') return
  const kg = parseFloat(weightInput.value)
  if (!kg || kg <= 0) {
    uni.showToast({ title: '请输入有效体重', icon: 'none' })
    return
  }
  // 转换为克存储
  const grams = Math.round(kg * 1000)
  const dateTs = new Date(weightDateStr.value + 'T00:00:00+08:00').getTime()
  weightSubmitState.value = 'submitting'
  try {
    const res = await addWeightRecord({
      dog_id: dogId,
      weight: grams,
      date: dateTs,
      notes: weightNotes.value || null,
    })
    if (!res) {
      weightSubmitState.value = 'idle'
      return
    }

    if (dog.value) {
      dog.value = {
        ...dog.value,
        latest_weight: grams,
      }
    }
    weightHistory.value = [
      {
        weight: grams,
        date: dateTs,
        notes: weightNotes.value || undefined,
        created_at: Date.now(),
      },
      ...weightHistory.value.filter(item => !(item.weight === grams && item.date === dateTs)).slice(0, 19),
    ]

    weightSubmitState.value = 'success'
    showSubmitBanner('已保存体重')
    await new Promise(resolve => setTimeout(resolve, 180))
    showWeightEntry.value = false
    weightSubmitState.value = 'idle'
    loadData({ silent: true })
    loadWeightHistory()
  } catch (error) {
    weightSubmitState.value = 'idle'
    throw error
  }
}

// ==================== D-21: 体重趋势详情 ====================

const showWeightChart = ref(false)
const weightHistory = ref<Array<{ weight: number; date: number; notes?: string; created_at?: number }>>([])

function sortWeightRecordsDesc(records: Array<{ date: number; created_at?: number }>) {
  return [...records].sort((a, b) => {
    if (b.date !== a.date) return b.date - a.date
    return (b.created_at || 0) - (a.created_at || 0)
  })
}

function sortWeightRecordsAsc(records: Array<{ date: number; created_at?: number }>) {
  return [...records].sort((a, b) => {
    if (a.date !== b.date) return a.date - b.date
    return (a.created_at || 0) - (b.created_at || 0)
  })
}

const recentWeightRecords = computed(() => sortWeightRecordsDesc(weightHistory.value))
const weightTrendRecords = computed(() => sortWeightRecordsAsc(recentWeightRecords.value.slice(0, 10)))

const { run: fetchWeightHistory } = useCloudCall<{ data: Array<{ weight: number; date: number; notes?: string; created_at?: number }> }>('health-service', 'getWeightHistory')

async function loadWeightHistory() {
  const res = await fetchWeightHistory(dogId)
  if (res?.data) {
    weightHistory.value = sortWeightRecordsDesc(res.data)
  }
}

function openWeightChart() {
  loadWeightHistory()
  showWeightChart.value = true
}

function formatWeightKg(grams: number) {
  return (grams / 1000).toFixed(1)
}

function formatShortDate(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const weightChartMax = computed(() => {
  if (weightTrendRecords.value.length === 0) return 0
  const max = Math.max(...weightTrendRecords.value.map(w => w.weight))
  return (max / 1000).toFixed(1)
})

const weightChartMin = computed(() => {
  if (weightTrendRecords.value.length === 0) return 0
  const min = Math.min(...weightTrendRecords.value.map(w => w.weight))
  return (min / 1000).toFixed(1)
})

function weightBarHeight(grams: number) {
  const records = weightTrendRecords.value
  const max = Math.max(...records.map(w => w.weight))
  const min = Math.min(...records.map(w => w.weight))
  if (max === min) return 50
  return 20 + ((grams - min) / (max - min)) * 60
}

const growthRate = computed(() => {
  const records = recentWeightRecords.value
  if (records.length < 2) return null
  const latest = records[0].weight
  const previous = records[1].weight
  if (previous === 0) return null
  return ((latest - previous) / previous) * 100
})

// ==================== D-14: 删除犬只 ====================

const showDeleteModal = ref(false)

function openDeleteConfirm() {
  showMore.value = false
  showDeleteModal.value = true
}

async function doDelete() {
  await deleteDog(dogId)
  useDogStore().removeDog(dogId)
  showDeleteModal.value = false
  uni.navigateBack()
}

// ==================== 数据加载 ====================

async function loadData({ silent = false, shouldCleanup = false }: { silent?: boolean; shouldCleanup?: boolean } = {}) {
  const loadToken = ++latestLoadToken
  const showSkeleton = !silent && !hasLoadedOnce

  if (showSkeleton) {
    loading.value = true
  }

  try {
    if (shouldCleanup) {
      await cleanupDuplicateIllnesses({ dog_id: dogId }).catch(() => {})
    }

    const [detailRes, cyclesRes, healthRes, littersRes, financeRes] = await Promise.all([
      fetchDetail(dogId),
      fetchCycles(dogId),
      fetchHealth(dogId),
      fetchLitters(dogId),
      fetchDogFinance(dogId),
    ])

    if (loadToken !== latestLoadToken) return

    if (detailRes?.data) {
      dog.value = detailRes.data
      statuses.value = detailRes.data.statuses || []
    }
    if (cyclesRes?.data) {
      cycles.value = cyclesRes.data
    }
    if (healthRes?.data) {
      healthRecords.value = healthRes.data
    }
    if (littersRes?.data) {
      litters.value = littersRes.data
    }
    if (financeRes?.data) {
      dogFinance.value = financeRes.data
    }
    hasLoadedOnce = true
  } finally {
    if (showSkeleton && loadToken === latestLoadToken) {
      loading.value = false
    }
  }
}

onLoad((query) => {
  dogId = query?.id || ''
  if (dogId) {
    loadData({ shouldCleanup: true })
  } else {
    loading.value = false
  }
})

onShow(() => {
  const feedback = consumeSubmitFeedback('/pages/dog/detail')
  if (feedback?.message) {
    showSubmitBanner(feedback.message)
  }
  if (feedback && dogId) {
    loadData({ silent: true, shouldCleanup: true })
  }
})
</script>

<style lang="scss" scoped>
.dog-detail {
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}

/* ==================== 顶部导航栏 ==================== */
.dog-detail__topbar {
  display: flex;
  align-items: center;
  padding: 6px 16px;
  gap: 6px;
  flex-shrink: 0;
}
.dog-detail__back-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-1);
  transition: background 0.12s ease;
  .material-icons-round { font-family: 'Material Icons Round'; font-size: 22px; }
  &:active { background: var(--card-dim); }
}
.dog-detail__topbar-title {
  flex: 1;
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 800;
  color: var(--text-1);
}
.dog-detail__topbar-cta {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 6px 14px 6px 10px;
  border-radius: var(--radius-btn);
  background: var(--primary);
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 2px 10px rgba(234, 62, 119, 0.25);
  transition: all 0.12s ease;
  &:active { transform: scale(0.92); opacity: 0.85; }
}
.dog-detail__topbar-cta-icon {
  font-family: 'Material Icons Round';
  font-size: 16px;
  color: #FFFFFF;
}
.dog-detail__topbar-cta-text {
  font-size: 13px;
  font-weight: 700;
  color: #FFFFFF;
}
.dog-detail__topbar-more {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  transition: background 0.12s ease;
  .material-icons-round { font-family: 'Material Icons Round'; font-size: 22px; }
  &:active { background: var(--card-dim); }
}

/* ==================== 紧凑 Hero ==================== */
.dog-detail__hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 4px var(--space-page) 14px;
  flex-shrink: 0;
}
.dog-detail__hero-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  &--primary { background: linear-gradient(135deg, var(--primary), var(--amber)); box-shadow: 0 4px 14px rgba(234, 62, 119, 0.2); }
  &--rose { background: linear-gradient(135deg, #ea3e77, #f0789a); box-shadow: 0 4px 14px rgba(234, 62, 119, 0.2); }
  &--amber { background: linear-gradient(135deg, #e89b3e, #f0b868); box-shadow: 0 4px 14px rgba(232, 155, 62, 0.2); }
  &--blue { background: linear-gradient(135deg, #4a8dd4, #72a8e0); box-shadow: 0 4px 14px rgba(74, 141, 212, 0.2); }
  &--teal { background: linear-gradient(135deg, #3da88e, #5cc0a8); box-shadow: 0 4px 14px rgba(61, 168, 142, 0.2); }
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dog-detail__hero-avatar-icon {
  font-family: 'Material Icons Round';
  color: #FFFFFF;
  font-size: 28px;
}
.dog-detail__hero-info {
  flex: 1;
  min-width: 0;
}
.dog-detail__hero-name {
  display: block;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.2;
  margin-right: 6px;
}
.dog-detail__hero-sub {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  margin-top: 2px;
  line-height: 1.35;
}
.dog-detail__hero-tags {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.dog-detail__hero-tag {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px 3px 10px;
  border-radius: var(--radius-tag);
  transition: all 0.12s ease;
  &:active { transform: scale(0.92); opacity: 0.8; }
}
.dog-detail__hero-tag-text {
  font-size: 11px;
  font-weight: 700;
}
.dog-detail__hero-tag-arrow {
  font-family: 'Material Icons Round';
  font-size: 12px;
}
.dog-detail__hero-tag--rose {
  background: var(--rose-soft);
  .dog-detail__hero-tag-text, .dog-detail__hero-tag-arrow { color: var(--rose); }
}
.dog-detail__hero-tag--plum {
  background: var(--plum-soft);
  .dog-detail__hero-tag-text, .dog-detail__hero-tag-arrow { color: var(--plum); }
}
.dog-detail__hero-tag--amber {
  background: var(--amber-soft);
  .dog-detail__hero-tag-text, .dog-detail__hero-tag-arrow { color: var(--amber); }
}
.dog-detail__hero-tag--green {
  background: var(--green-soft);
  .dog-detail__hero-tag-text, .dog-detail__hero-tag-arrow { color: var(--green); }
}
.dog-detail__st-hero--illness {
  background: rgba(224, 82, 82, 0.1);
  .dog-detail__hero-tag-text, .dog-detail__hero-tag-arrow { color: var(--red); }
}
.dog-detail__hero-tag--red {
  background: var(--red-soft);
  .dog-detail__hero-tag-text, .dog-detail__hero-tag-arrow { color: var(--red); }
}
.dog-detail__hero-tag--static {
  background: transparent;
  border: 1.5px solid var(--text-4);
  padding: 3px 10px;
  cursor: default;
  .dog-detail__hero-tag-text { color: var(--text-3); }
  &:active { transform: none; opacity: 1; }
}

/* ==================== 快捷统计条 ==================== */
.dog-detail__stats {
  display: flex;
  margin: 0 var(--space-page) 10px;
  background: var(--card);
  border-radius: var(--radius-row);
  box-shadow: var(--shadow);
  overflow: hidden;
  flex-shrink: 0;
}
.dog-detail__stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px;
  gap: 1px;
  & + & { border-left: 1px solid rgba(216, 203, 189, 0.2); }
}
.dog-detail__stat-icon {
  font-family: 'Material Icons Round';
  font-size: 15px;
  color: var(--text-3);
}
.dog-detail__stat-value {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.3;
}
.dog-detail__stat-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-3);
}

/* ==================== Tab 栏 ==================== */
.dog-detail__tab-bar {
  display: flex;
  padding: 0 var(--space-page);
  border-bottom: 1px solid rgba(216, 203, 189, 0.2);
  background: var(--bg);
  flex-shrink: 0;
}
.dog-detail__tab-item {
  flex: 1;
  text-align: center;
  padding: 10px 0 11px;
  position: relative;
  cursor: pointer;
  transition: color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}
.dog-detail__tab-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
}
.dog-detail__tab-item--active .dog-detail__tab-label {
  color: var(--primary);
  font-weight: 700;
}
.dog-detail__tab-item--active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 20%;
  right: 20%;
  height: 2.5px;
  border-radius: 2px;
  background: var(--primary);
}

/* ==================== Tab 内容 ==================== */
.dog-detail__tab-content {
  flex: 1;
  overflow-y: auto;
}
.dog-detail__pane {
  padding: 12px var(--space-page) 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.dog-detail__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ==================== Section 标签 ==================== */
.dog-detail__sec {
  display: flex;
  align-items: center;
  gap: 8px;
  &::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
}
.dog-detail__sec--rose::before { background: var(--rose); }
.dog-detail__sec--green::before { background: var(--green); }
.dog-detail__sec--blue::before { background: var(--blue); }
.dog-detail__sec--teal::before { background: var(--teal); }
.dog-detail__sec--amber::before { background: var(--amber); }
.dog-detail__sec--plum::before { background: var(--plum); }
.dog-detail__sec--red::before { background: var(--red); }
.dog-detail__sec-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.3px;
}
.dog-detail__sec-link {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary);
}
.dog-detail__health-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dog-detail__health-group + .dog-detail__health-group {
  margin-top: 4px;
}
.dog-detail__sec-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--card-dim);
  border-radius: 999px;
  padding: 2px 8px;
}
.dog-detail__sec-badge-text {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  color: var(--text-2);
}

/* ==================== 合并状态卡片 ==================== */
.dog-detail__status-merged {
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  overflow: hidden;
  position: relative;
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 30%);
    pointer-events: none;
    border-radius: var(--radius-card);
  }
  & > * { position: relative; z-index: 1; }
}
.dog-detail__status-row {
  padding: 14px 16px 13px 18px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  cursor: pointer;
  transition: background 0.12s ease;
  border-left: 3.5px solid transparent;
  &:active { background: rgba(234, 62, 119, 0.03); }
  & + & { border-top: 1px solid rgba(216, 203, 189, 0.18); }
}
.dog-detail__status-row--rose { border-left-color: var(--rose); }
.dog-detail__status-row--plum { border-left-color: var(--plum); }
.dog-detail__status-row--red { border-left-color: var(--red); }
.dog-detail__st-row--illness {
  border-left-color: rgba(224, 82, 82, 0.72);
  background: linear-gradient(135deg, rgba(224, 82, 82, 0.08) 0%, transparent 34%);
}
.dog-detail__status-row--amber { border-left-color: var(--amber); }
.dog-detail__status-row--green { border-left-color: var(--green); }

.dog-detail__st-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.dog-detail__st-left {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}
.dog-detail__st-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  .material-icons-round { font-family: 'Material Icons Round'; font-size: 18px; }
}
.dog-detail__st-icon--rose { background: var(--icon-rose); .material-icons-round { color: var(--rose); } }
.dog-detail__st-icon--plum { background: var(--icon-plum); .material-icons-round { color: var(--plum); } }
.dog-detail__st-icon--red { background: var(--icon-red); .material-icons-round { color: var(--red); } }
.dog-detail__st-icon--illness { background: rgba(255, 217, 212, 0.8); .material-icons-round { color: var(--red); } }
.dog-detail__st-icon--amber { background: var(--icon-amber); .material-icons-round { color: var(--amber); } }
.dog-detail__st-icon--green { background: var(--icon-green); .material-icons-round { color: var(--green); } }
.dog-detail__st-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dog-detail__st-title {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.25;
}
.dog-detail__st-sub {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  line-height: 1.35;
}
.dog-detail__st-chevron {
  font-family: 'Material Icons Round';
  color: var(--text-4);
  font-size: 20px;
  flex-shrink: 0;
}

/* ==================== 记录列表 ==================== */
.dog-detail__rec-list {
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.dog-detail__rec-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px 12px 16px;
  cursor: pointer;
  transition: background 0.12s ease;
  &:active { background: rgba(234, 62, 119, 0.03); }
  & + & { border-top: 1px solid rgba(216, 203, 189, 0.12); }
}
.dog-detail__rec-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  .material-icons-round { font-family: 'Material Icons Round'; font-size: 17px; }
}
.dog-detail__rec-icon--blue { background: var(--icon-blue); .material-icons-round { color: var(--blue); } }
.dog-detail__rec-icon--teal { background: var(--icon-teal); .material-icons-round { color: var(--teal); } }
.dog-detail__rec-icon--plum { background: var(--icon-plum); .material-icons-round { color: var(--plum); } }
.dog-detail__rec-icon--rose { background: var(--icon-rose); .material-icons-round { color: var(--rose); } }
.dog-detail__rec-icon--green { background: var(--icon-green); .material-icons-round { color: var(--green); } }
.dog-detail__rec-icon--red { background: var(--icon-red); .material-icons-round { color: var(--red); } }
.dog-detail__rec-icon--amber { background: var(--icon-amber); .material-icons-round { color: var(--amber); } }
.dog-detail__rec-icon--gray { background: var(--card-dim); .material-icons-round { color: var(--text-3); } }
.dog-detail__rec-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.dog-detail__rec-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dog-detail__rec-sub {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
  margin-top: 2px;
  display: block;
}
.dog-detail__rec-chevron {
  font-family: 'Material Icons Round';
  color: var(--text-4);
  font-size: 18px;
}
.dog-detail__rec-tag {
  padding: 3px 8px;
  border-radius: var(--radius-tag);
}
.dog-detail__rec-tag-text {
  font-size: 11px;
  font-weight: 600;
}
.dog-detail__rec-tag--green {
  background: var(--green-soft);
  .dog-detail__rec-tag-text { color: var(--green); }
}
.dog-detail__rec-tag--amber {
  background: var(--amber-soft);
  .dog-detail__rec-tag-text { color: var(--amber); }
}
.dog-detail__rec-tag--red {
  background: var(--red-soft);
  .dog-detail__rec-tag-text { color: var(--red); }
}
.dog-detail__rec-tag--gray {
  background: var(--card-dim);
  border: 1px solid var(--text-4);
  .dog-detail__rec-tag-text { color: var(--text-3); }
}
.dog-detail__rec-tag--rose {
  background: var(--rose-soft);
  .dog-detail__rec-tag-text { color: var(--rose); }
}

/* ==================== 繁育周期卡片 ==================== */
.dog-detail__cycle-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px 16px 14px 18px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  border-left: 3.5px solid transparent;
  &:active {
    transform: scale(0.975);
    box-shadow: 0 1px 6px rgba(234, 62, 119, 0.04);
  }
}
.dog-detail__cycle-body {
  flex: 1;
  min-width: 0;
}
.dog-detail__cycle-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}
.dog-detail__cycle-sub {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  margin-top: 2px;
}

/* ==================== 发情中 Banner ==================== */
.breeding-estrus-banner {
  background: var(--amber-soft);
  border-radius: 14px;
  padding: 12px 14px;
  margin-bottom: 10px;
  border: 1px solid rgba(232, 155, 62, 0.2);
}
.breeding-estrus-banner__info {
  display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
}
.breeding-estrus-banner__icon { font-size: 22px; color: var(--amber); }
.breeding-estrus-banner__title { display: block; font-size: 14px; font-weight: 700; color: var(--amber); }
.breeding-estrus-banner__sub { display: block; font-size: 12px; color: var(--text-2); }
.breeding-estrus-banner__actions { display: flex; gap: 8px; }
.breeding-estrus-banner__btn {
  flex: 1; height: 34px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 999px; border: 1.5px solid var(--amber);
  font-size: 13px; font-weight: 600; color: var(--amber);
  &:active { opacity: 0.7; }
  &--primary { background: var(--amber); color: #fff; border-color: transparent; }
}

/* ==================== 进行中周期卡片 ==================== */
.breeding-active-cycle {
  background: var(--card);
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 10px;
  border-left: 3.5px solid var(--rose);
  box-shadow: var(--shadow);
  &:active { opacity: 0.8; }
}
.breeding-active-cycle__header {
  display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
}
.breeding-active-cycle__dot {
  width: 8px; height: 8px; border-radius: 50%; background: var(--rose);
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.breeding-active-cycle__label { font-size: 11px; font-weight: 700; color: var(--rose); flex: 1; }
.breeding-active-cycle__chevron { font-size: 16px; color: var(--text-4); }
.breeding-active-cycle__title { display: block; font-size: 15px; font-weight: 700; color: var(--text-1); margin-bottom: 2px; }
.breeding-active-cycle__sub { display: block; font-size: 12px; color: var(--text-2); }
.breeding-active-cycle__status-badge {
  display: inline-block; margin-top: 8px;
  padding: 2px 10px; border-radius: 999px;
  background: var(--rose-soft); font-size: 11px; font-weight: 700; color: var(--rose);
}

/* ==================== 可折叠详细信息 ==================== */
.dog-detail__collapse-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--card);
  border-radius: var(--radius-row);
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: all 0.12s ease;
  -webkit-tap-highlight-color: transparent;
  &:active { transform: scale(0.98); }
}
.dog-detail__collapse-head--open {
  border-radius: var(--radius-row) var(--radius-row) 0 0;
  box-shadow: none;
}
.dog-detail__collapse-head-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  .material-icons-round { font-family: 'Material Icons Round'; font-size: 18px; color: var(--text-3); }
}
.dog-detail__collapse-arrow {
  font-family: 'Material Icons Round';
  color: var(--text-4);
  font-size: 20px;
  transition: transform 0.2s ease;
}
.dog-detail__collapse-head--open .dog-detail__collapse-arrow {
  transform: rotate(180deg);
}
.dog-detail__collapse-body {
  background: var(--card);
  border-radius: 0 0 var(--radius-row) var(--radius-row);
  padding: 0 16px 12px;
  box-shadow: var(--shadow);
}
.dog-detail__info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid rgba(216, 203, 189, 0.18);
  &:last-child { border-bottom: none; }
}
.dog-detail__info-row-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-3);
}
.dog-detail__info-row-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

/* ==================== 更多操作菜单 ==================== */
.dog-detail__overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  background: rgba(26, 26, 46, 0.35);
}
.dog-detail__action-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 21;
  background: var(--card);
  border-radius: 20px 20px 0 0;
  padding: 8px 0 34px;
  transform: translateY(100%);
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.dog-detail__action-sheet--show {
  transform: translateY(0);
}
.dog-detail__action-sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--text-4);
  margin: 4px auto 12px;
}
.dog-detail__action-sheet-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 24px;
  cursor: pointer;
  transition: background 0.1s ease;
  -webkit-tap-highlight-color: transparent;
  &:active { background: rgba(234, 62, 119, 0.04); }
}
.dog-detail__action-sheet-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  .material-icons-round { font-family: 'Material Icons Round'; font-size: 20px; }
}
.dog-detail__action-sheet-icon--blue { background: var(--icon-blue); .material-icons-round { color: var(--blue); } }
.dog-detail__action-sheet-icon--amber { background: var(--icon-amber); .material-icons-round { color: var(--amber); } }
.dog-detail__action-sheet-icon--teal { background: var(--icon-teal); .material-icons-round { color: var(--teal); } }
.dog-detail__action-sheet-icon--red { background: var(--icon-red); .material-icons-round { color: var(--red); } }
.dog-detail__action-sheet-icon--plum { background: var(--icon-plum); .material-icons-round { color: var(--plum); } }
.dog-detail__action-sheet-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dog-detail__action-sheet-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}
.dog-detail__action-sheet-title--danger {
  color: var(--red);
}
.dog-detail__action-sheet-desc {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}
.dog-detail__action-sheet-sep {
  height: 1px;
  background: rgba(216, 203, 189, 0.2);
  margin: 4px 24px;
}

/* ==================== D-6: 状态标记 Sheet ==================== */
.status-sheet__dog-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.status-sheet__dog-emoji {
  font-size: 20px;
}
.status-sheet__dog-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  &--3col { grid-template-columns: 1fr 1fr 1fr; }
  gap: 10px;
  margin-bottom: 12px;
}
.status-card {
  padding: 14px;
  border-radius: var(--radius-card);
  cursor: pointer;
  transition: all 0.12s ease;
  &:active { transform: scale(0.96); }
}
.status-card--red { background: var(--red-soft); }
.status-card--plum { background: var(--plum-soft); }
.status-card--green { background: var(--green-soft); }
.status-card--amber { background: var(--amber-soft); }
.status-card__emoji {
  display: block;
  font-size: 24px;
  margin-bottom: 6px;
}
.status-card__label {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 6px;
}
.status-card__sub {
  display: block;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-3);
  margin-top: 2px;
}
.status-sheet__cancel {
  text-align: center;
  padding: 8px;
  margin-top: 4px;
}
.status-sheet__cancel-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
}

/* ==================== Modal 内表单样式 ==================== */
.modal-desc {
  display: block;
  font-size: 14px;
  color: var(--text-2);
  text-align: center;
  margin-bottom: 16px;
  line-height: 1.5;
}
.modal-form {
  margin-top: 4px;
}
.modal-form__group {
  margin-bottom: 14px;
  &:last-child { margin-bottom: 0; }
}
.modal-form__label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 6px;
}
.modal-form__input {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 14px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  background: var(--bg);
}
.modal-form__input-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.modal-form__text-input {
  width: 100%;
  height: 44px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  padding: 0 14px;
  font-size: 14px;
  color: var(--text-1);
  background: var(--bg);
}

/* ==================== Sheet 内表单样式 ==================== */
.sheet-form {
  padding-bottom: 16px;
}
.sheet-form__group {
  margin-bottom: 16px;
  &:last-child { margin-bottom: 0; }
}
.sheet-form__label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 8px;
}
.sheet-form__input {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 14px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  background: var(--bg);
}
.sheet-form__input-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.sheet-form__text-input {
  width: 100%;
  height: 44px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  padding: 0 14px;
  font-size: 14px;
  color: var(--text-1);
  background: var(--bg);
}
.sheet-form__price-input {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 44px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  padding: 0 14px;
  background: var(--bg);
}
.sheet-form__price-symbol {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-3);
}
.sheet-form__price-value {
  flex: 1;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  border: none;
  background: transparent;
}
.sheet-form__helper {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 6px;
}
.sheet-form__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}
.sheet-form__btn {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-btn);
  transition: transform 0.12s ease, opacity 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
}
.sheet-form__btn--primary {
  background: var(--primary);
}
.sheet-form__btn--cancel {
  background: var(--card-dim);
}
.sheet-form__btn-text {
  font-size: 15px;
  font-weight: 600;
}

/* ==================== 体重快捷操作 ==================== */
.dog-detail__weight-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.dog-detail__weight-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 0;
  background: var(--card);
  border-radius: var(--radius-row);
  box-shadow: var(--shadow);
  transition: all 0.12s ease;
  &:active { transform: scale(0.94); opacity: 0.85; }
}
.dog-detail__weight-btn-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

/* ==================== D-20: 体重录入 Sheet ==================== */
.weight-entry {
  padding-bottom: 20px;
}
.weight-entry__dog-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.weight-entry__dog-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.weight-entry__dog-info { flex: 1; }
.weight-entry__dog-name {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  display: block;
}
.weight-entry__last-weight {
  font-size: 12px;
  color: var(--text-3);
  display: block;
  margin-top: 2px;
}
.weight-entry__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.weight-entry__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.weight-entry__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
}
.weight-entry__input-wrap {
  display: flex;
  align-items: center;
  height: 48px;
  border-radius: 14px;
  border: 1px solid var(--text-4);
  background: var(--card);
  padding: 0 16px;
}
.weight-entry__input {
  flex: 1;
  font-size: 16px;
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--text-1);
  border: none;
  background: transparent;
  outline: none;
}
.weight-entry__unit {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-3);
  flex-shrink: 0;
}
.weight-entry__date-picker {
  height: 48px;
  border-radius: 14px;
  border: 1px solid var(--text-4);
  background: var(--card);
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.weight-entry__date-text {
  font-size: 14px;
  color: var(--text-1);
}
.weight-entry__notes-input {
  height: 48px;
  border-radius: 14px;
  border: 1px solid var(--text-4);
  background: var(--card);
  padding: 0 16px;
  font-size: 14px;
  color: var(--text-1);
}
.weight-entry__actions {
  margin-top: 20px;
}
.weight-entry__save-btn {
  width: 100%;
  min-height: 50px;
  box-shadow: var(--shadow-fab);
}

/* ==================== D-21: 体重趋势详情 Sheet ==================== */
.weight-chart {
  padding-bottom: 20px;
}
.weight-chart__graph {
  background: var(--bg);
  border-radius: var(--radius-card);
  padding: 16px;
  margin-bottom: 16px;
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.weight-chart__graph-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.weight-chart__graph-empty-text {
  font-size: 13px;
  color: var(--text-3);
}
.weight-chart__svg-area {
  width: 100%;
  display: flex;
  gap: 12px;
}
.weight-chart__axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  width: 40px;
  flex-shrink: 0;
}
.weight-chart__axis-label {
  font-size: 10px;
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--text-3);
}
.weight-chart__axis-line {
  flex: 1;
  width: 1px;
  background: var(--text-4);
  margin: 4px 0;
}
.weight-chart__bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 120px;
}
.weight-chart__bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
  justify-content: flex-end;
}
.weight-chart__bar {
  width: 100%;
  max-width: 20px;
  background: linear-gradient(180deg, var(--primary), var(--rose));
  border-radius: 4px 4px 0 0;
  min-height: 4px;
}
.weight-chart__bar-label {
  font-size: 9px;
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--text-1);
}
.weight-chart__bar-date {
  font-size: 8px;
  color: var(--text-3);
}
.weight-chart__growth {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: var(--card);
  border-radius: var(--radius-row);
  box-shadow: var(--shadow);
  margin-bottom: 16px;
}
.weight-chart__growth-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.weight-chart__section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
  margin-bottom: 10px;
}
.weight-chart__empty-list {
  padding: 20px 0;
  text-align: center;
}
.weight-chart__empty-text {
  font-size: 13px;
  color: var(--text-3);
}
.weight-chart__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-group-gap);
}
.weight-chart__record {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--card);
  border-radius: var(--radius-row);
  box-shadow: var(--shadow);
}
.weight-chart__rec-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-icon);
  background: var(--icon-blue);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.weight-chart__rec-body {
  flex: 1;
}
.weight-chart__rec-weight {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  display: block;
}
.weight-chart__rec-date {
  font-size: 12px;
  color: var(--text-3);
  display: block;
  margin-top: 2px;
}
.weight-chart__rec-note {
  font-size: 12px;
  color: var(--text-2);
  display: block;
  margin-top: 4px;
  line-height: 1.35;
}
.weight-chart__rec-diff {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

/* 财务 Tab 链接 */
.dog-detail__finance-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dog-detail__finance-link {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--card);
  border-radius: var(--radius-row);
  padding: 14px 16px;
  box-shadow: var(--shadow);
  transition: transform 0.12s ease;
  &:active { transform: scale(0.975); }
}

.dog-detail__finance-link-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

/* ==================== A: 状态卡进度条 + 元信息 ==================== */
.dog-detail__st-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dog-detail__st-progress-track {
  flex: 1;
  height: 5px;
  background: rgba(216, 203, 189, 0.25);
  border-radius: 3px;
  overflow: hidden;
}
.dog-detail__st-progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
  &--rose { background: linear-gradient(90deg, var(--rose), var(--amber)); }
  &--plum { background: linear-gradient(90deg, var(--plum), var(--rose)); }
  &--red { background: linear-gradient(90deg, var(--red), #f08e8e); }
  &--illness { background: linear-gradient(90deg, rgba(224, 82, 82, 0.92), rgba(240, 142, 142, 0.92)); }
  &--amber { background: linear-gradient(90deg, var(--amber), #f0c072); }
  &--green { background: linear-gradient(90deg, var(--green), #78c894); }
}
.dog-detail__st-progress-text {
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}
.dog-detail__st-progress-text--rose { color: var(--rose); }
.dog-detail__st-progress-text--plum { color: var(--plum); }
.dog-detail__st-progress-text--red { color: var(--red); }
.dog-detail__st-progress-text--illness { color: rgba(224, 82, 82, 0.8); }
.dog-detail__st-progress-text--amber { color: var(--amber); }
.dog-detail__st-progress-text--green { color: var(--green); }
.dog-detail__st-meta {
  display: flex;
  gap: 8px 10px;
  flex-wrap: wrap;
}
.dog-detail__st-meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 20px;
}
.dog-detail__st-meta-icon {
  font-family: 'Material Icons Round';
  font-size: 13px;
  color: var(--text-3);
}
.dog-detail__st-meta-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
}

/* ==================== C: 繁育里程碑 ==================== */
.breeding-milestones {
  display: flex;
  align-items: flex-start;
  margin-top: 12px;
  margin-bottom: 2px;
}
.breeding-milestone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.breeding-milestone__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-4);
  border: 2px solid var(--text-4);
}
.breeding-milestone__label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-3);
}
.breeding-milestone--done .breeding-milestone__dot {
  background: var(--rose);
  border-color: var(--rose);
}
.breeding-milestone--done .breeding-milestone__label {
  color: var(--rose);
}
.breeding-milestone--active .breeding-milestone__dot {
  background: var(--rose);
  border-color: var(--rose);
  box-shadow: 0 0 0 3px var(--rose-soft);
  animation: pulse 1.5s ease-in-out infinite;
}
.breeding-milestone--active .breeding-milestone__label {
  color: var(--rose);
  font-weight: 700;
}
.breeding-milestone-line {
  flex: 1;
  height: 2px;
  background: var(--text-4);
  margin-top: 4px;
  margin-bottom: 18px;
}
.breeding-milestone-line--done {
  background: var(--rose);
}
.breeding-active-cycle__progress-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.breeding-active-cycle__progress-track {
  flex: 1;
  height: 5px;
  background: rgba(216, 203, 189, 0.25);
  border-radius: 3px;
  overflow: hidden;
}
.breeding-active-cycle__progress-fill {
  height: 100%;
  background: var(--rose);
  border-radius: 3px;
  transition: width 0.4s ease;
}
.breeding-active-cycle__progress-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  flex-shrink: 0;
}

/* ==================== D: 产仔记录 ==================== */
.dog-detail__litter-item {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  & + & { border-top: 1px solid rgba(216, 203, 189, 0.12); }
  &:active { background: rgba(234, 62, 119, 0.03); }
}
.dog-detail__litter-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dog-detail__litter-content { display: flex; align-items: center; gap: 12px; }
.dog-detail__litter-date {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.dog-detail__litter-sire {
  font-size: 12px;
  color: var(--text-3);
}
.dog-detail__pup-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.dog-detail__pup-chip {
  padding: 3px 9px;
  border-radius: var(--radius-tag);
}
.dog-detail__pup-chip-text {
  font-size: 11px;
  font-weight: 700;
}
.dog-detail__pup-chip--total {
  background: var(--card-dim);
  .dog-detail__pup-chip-text { color: var(--text-2); }
}
.dog-detail__pup-chip--alive {
  background: var(--green-soft);
  .dog-detail__pup-chip-text { color: var(--green); }
}
.dog-detail__pup-chip--sold {
  background: var(--icon-blue);
  .dog-detail__pup-chip-text { color: var(--blue); }
}
.dog-detail__pup-chip--avail {
  background: var(--amber-soft);
  .dog-detail__pup-chip-text { color: var(--amber); }
}

/* ==================== F: 财务汇总 ==================== */
.dog-detail__fin-summary {
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.dog-detail__fin-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.dog-detail__fin-cell {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  &:nth-child(2) { border-left: 1px solid rgba(216, 203, 189, 0.15); }
  &:nth-child(3), &:nth-child(4) { border-top: 1px solid rgba(216, 203, 189, 0.15); }
  &:nth-child(4) { border-left: 1px solid rgba(216, 203, 189, 0.15); }
}
.dog-detail__fin-cell-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
}
.dog-detail__fin-cell-value {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 800;
  color: var(--text-1);
}
.dog-detail__fin-cell-value--red { color: var(--red); }
.dog-detail__fin-cell-value--green { color: var(--green); }

/* 交易金额 */
.dog-detail__rec-amount {
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}
.dog-detail__rec-amount--green { color: var(--green); }
.dog-detail__rec-amount--red { color: var(--red); }

/* ==================== 添加记录 Sheet ==================== */
.add-record-list {
  padding-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.add-record-context {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 2px 0;
}

.add-record-context__badge {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary-soft), rgba(255, 240, 232, 0.9));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.add-record-context__badge-icon {
  font-size: 18px;
  color: var(--primary);
}

.add-record-context__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.add-record-context__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.add-record-context__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.2;
}

.add-record-context__status {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--amber-soft);
  color: var(--amber);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.add-record-context__sub {
  font-size: 11px;
  line-height: 1.35;
  color: var(--text-3);
}

.add-record-group {
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  overflow: hidden;
  border: 1px solid rgba(184, 160, 138, 0.08);
}
.add-record-group__head {
  padding: 10px 12px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.add-record-group__meta {
  display: flex;
  align-items: center;
  gap: 6px;
}
.add-record-group__title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.3px;
}
.add-record-group__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 18px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--card-dim);
  font-size: 10px;
  font-weight: 700;
  color: var(--text-3);
}
.add-record-group__hint {
  font-size: 10px;
  font-weight: 600;
  color: var(--primary);
  background: var(--primary-soft);
  padding: 3px 8px;
  border-radius: 999px;
  flex-shrink: 0;
}
.add-record-group__body {
  padding: 0 10px 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.add-record-item {
  min-height: 76px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 11px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(250, 246, 243, 0.96));
  border: 1px solid rgba(184, 160, 138, 0.10);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
  transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;

  &:active {
    transform: scale(0.98);
    opacity: 0.86;
  }
}
.add-record-item--full {
  grid-column: 1 / -1;
}
.add-record-item__icon {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.add-record-item__content {
  flex: 1;
  min-width: 0;
}
.add-record-item__label {
  display: block;
  font-size: 14px;
  line-height: 1.2;
  font-weight: 700;
  color: var(--text-1);
}
.add-record-item__desc {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.25;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.add-record-item__action {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.add-record-item__arrow {
  font-size: 16px;
  color: var(--text-4);
}

@media (max-width: 380px) {
  .add-record-group__body {
    grid-template-columns: 1fr;
  }

  .add-record-item--full {
    grid-column: auto;
  }

  .add-record-context {
    align-items: flex-start;
  }
}
</style>
