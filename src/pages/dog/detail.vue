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
      <text
        class="dog-detail__topbar-title"
        :class="{ 'dog-detail__topbar-title--visible': showCompactTopbarTitle }"
      >
        {{ dog.name || '未命名' }}
      </text>
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
        <BEntityIcon :role="dog.role" class="dog-detail__hero-avatar-icon" :size="24" color="#fff" />
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
        <text class="material-icons-round dog-detail__stat-icon">{{ tertiaryStatIcon }}</text>
        <text class="dog-detail__stat-value">{{ tertiaryStatValue }}</text>
        <text class="dog-detail__stat-label">{{ tertiaryStatLabel }}</text>
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
              <view class="breeding-active-cycle__eyebrow">
                <view class="breeding-active-cycle__dot" />
                <text class="breeding-active-cycle__label">进行中</text>
              </view>
              <view class="dog-detail__rec-tag dog-detail__rec-tag--rose">
                <text class="dog-detail__rec-tag-text">进行中</text>
              </view>
            </view>
            <text class="breeding-active-cycle__title">{{ activeCycleSummary.title }}</text>
            <text class="breeding-active-cycle__sub">{{ activeCycleSummary.subtitle }}</text>

            <view v-if="activeCycleDetailLoading" class="breeding-active-cycle__loading">
              <text class="breeding-active-cycle__loading-text">正在加载当前周期摘要...</text>
            </view>

            <view v-else-if="activeCycleSummary.timeline.length > 0" class="breeding-active-cycle__timeline">
              <view
                v-for="(item, idx) in activeCycleSummary.timeline"
                :key="`${activeCycle._id}-${item.key}`"
                class="breeding-active-cycle__timeline-item"
                :class="`breeding-active-cycle__timeline-item--${item.kind}`"
              >
                <view class="breeding-active-cycle__timeline-rail">
                  <view
                    class="breeding-active-cycle__timeline-dot"
                    :class="[
                      `breeding-active-cycle__timeline-dot--${item.tone}`,
                      `breeding-active-cycle__timeline-dot--${item.kind}`,
                    ]"
                  />
                  <view
                    v-if="idx < activeCycleSummary.timeline.length - 1"
                    class="breeding-active-cycle__timeline-line"
                  />
                </view>
                <view class="breeding-active-cycle__timeline-copy">
                  <text
                    class="breeding-active-cycle__timeline-title"
                    :class="[
                      item.kind === 'upcoming' ? 'breeding-active-cycle__timeline-title--gray' : '',
                      item.kind === 'current' ? `breeding-active-cycle__timeline-title--${item.tone}` : '',
                    ]"
                  >
                    {{ item.title }}
                  </text>
                  <text
                    v-if="item.summary"
                    class="breeding-active-cycle__timeline-sub"
                    :class="item.kind === 'upcoming' ? 'breeding-active-cycle__timeline-sub--gray' : ''"
                  >
                    {{ item.summary }}
                  </text>
                </view>
              </view>
            </view>

            <view v-else class="breeding-active-cycle__empty">
              <text class="breeding-active-cycle__empty-text">当前周期已建立，等待录入关键繁育记录</text>
            </view>

            <view v-if="activeCycleSummary.stageSummary" class="breeding-active-cycle__footer">
              <text class="breeding-active-cycle__footer-text">{{ activeCycleSummary.stageSummary }}</text>
              <text class="material-icons-round breeding-active-cycle__chevron">chevron_right</text>
            </view>
          </view>

          <!-- 历史周期列表 -->
          <view v-if="pastCycles.length > 0">
            <view class="dog-detail__sec dog-detail__sec--rose">
              <text class="dog-detail__sec-text">繁育历史</text>
            </view>
            <view class="dog-detail__cycle-list">
              <view
                v-for="cycle in historyCycleCards"
                :key="cycle._id"
                class="dog-detail__cycle-card"
                @click="goToCycle(cycle._id)"
              >
                <view class="dog-detail__rec-icon" :class="cycle.status === '已生产' ? 'dog-detail__rec-icon--green' : 'dog-detail__rec-icon--gray'">
                  <text class="material-icons-round">{{ cycle.status === '已生产' ? 'check_circle' : 'close' }}</text>
                </view>
                <view class="dog-detail__cycle-body">
                  <text class="dog-detail__cycle-title">{{ cycle.summaryTitle }}</text>
                  <text v-if="cycle.summaryMeta" class="dog-detail__cycle-meta">{{ cycle.summaryMeta }}</text>
                  <text v-if="cycle.summaryResult" class="dog-detail__cycle-result">{{ cycle.summaryResult }}</text>
                </view>
                <view v-if="cycle.status" class="dog-detail__rec-tag" :class="cycle.status === '已生产' ? 'dog-detail__rec-tag--green' : 'dog-detail__rec-tag--gray'">
                  <text class="dog-detail__rec-tag-text">{{ cycle.status }}</text>
                </view>
                <text class="material-icons-round dog-detail__rec-chevron">chevron_right</text>
              </view>
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
            <view class="dog-detail__litter-list">
              <view v-for="litter in litterCards" :key="litter._id" class="dog-detail__litter-item" @click="goToOriginLitter(litter._id)">
                <view class="dog-detail__litter-main">
                  <view class="dog-detail__litter-copy">
                    <view class="dog-detail__litter-title-row">
                      <text class="dog-detail__litter-date">{{ litter.summaryTitle }}</text>
                      <text v-if="litter.summaryNumber" class="dog-detail__litter-number">{{ litter.summaryNumber }}</text>
                    </view>
                    <text v-if="litter.summarySire" class="dog-detail__litter-sire">{{ litter.summarySire }}</text>
                    <view v-if="litter.chips.length > 0" class="dog-detail__pup-chips">
                      <view
                        v-for="chip in litter.chips"
                        :key="chip.key"
                        class="dog-detail__pup-chip"
                        :class="`dog-detail__pup-chip--${chip.tone}`"
                      >
                        <text class="dog-detail__pup-chip-text">{{ chip.label }}</text>
                      </view>
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
          v-if="healthRecords.length === 0 && medicationRecords.length === 0"
          icon="healing"
          title="暂无健康记录"
          description="记录疫苗、驱虫、疾病、用药等信息"
        />
        <view v-else>
          <!-- 用药 -->
          <view v-if="medicationRecords.length > 0" class="dog-detail__health-group">
            <view class="dog-detail__sec dog-detail__sec--plum">
              <text class="dog-detail__sec-text">用药</text>
              <view class="dog-detail__sec-badge">
                <text class="dog-detail__sec-badge-text">{{ medicationRecords.length }}</text>
              </view>
            </view>
            <view class="dog-detail__rec-list">
              <view
                v-for="record in medicationRecords"
                :key="record._id || record.id"
                class="dog-detail__rec-item"
                @click="goToMedicationDetail(record._id || record.id)"
              >
                <view class="dog-detail__rec-icon dog-detail__rec-icon--plum">
                  <text class="material-icons-round">medication</text>
                </view>
                <view class="dog-detail__rec-body">
                  <text class="dog-detail__rec-title">{{ medicationRecordTitle(record) }}</text>
                  <text class="dog-detail__rec-sub">{{ medicationRecordSub(record) }}</text>
                </view>
                <view class="dog-detail__rec-tag" :class="`dog-detail__rec-tag--${medicationRecordTagTone(record)}`">
                  <text class="dog-detail__rec-tag-text">{{ medicationRecordTagText(record) }}</text>
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
      <view v-if="hasHealthActions" class="dog-detail__action-sheet-item" @click="openStatusSheet">
        <view class="dog-detail__action-sheet-icon dog-detail__action-sheet-icon--amber">
          <text class="material-icons-round">flag</text>
        </view>
        <view class="dog-detail__action-sheet-text">
          <text class="dog-detail__action-sheet-title">健康操作</text>
          <text class="dog-detail__action-sheet-desc">康复、治疗推进等快捷操作</text>
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
    <BSheet v-model:visible="showStatusSheet" title="健康操作">
      <view class="status-sheet__dog-info">
        <view class="status-sheet__dog-avatar" :class="heroAvatarClass">
          <BEntityIcon :role="dog?.role" :size="18" color="#fff" />
        </view>
        <view class="status-sheet__dog-copy">
          <text class="status-sheet__dog-name">{{ dog.name || '未命名' }}</text>
          <text class="status-sheet__dog-sub">{{ healthActionSummary }}</text>
        </view>
      </view>
      <view class="status-sheet__actions">
        <view
          v-for="action in healthActions"
          :key="action.key"
          class="status-sheet__action-row"
          @click="handleHealthAction(action.key)"
        >
          <view class="status-sheet__action-left">
            <view class="status-sheet__action-icon" :class="`status-sheet__action-icon--${action.tone}`">
              <text class="material-icons-round">{{ action.icon }}</text>
            </view>
            <view class="status-sheet__action-copy">
              <text class="status-sheet__action-title">{{ action.title }}</text>
              <text class="status-sheet__action-sub">{{ action.sub }}</text>
            </view>
          </view>
          <text class="material-icons-round status-sheet__action-chevron">chevron_right</text>
        </view>
      </view>
    </BSheet>

    <!-- ==================== 去向管理 Sheet ==================== -->
    <BSheet v-model:visible="showDispositionSheet" title="去向管理">
      <view class="status-sheet__dog-info">
        <view class="status-sheet__dog-avatar" :class="heroAvatarClass">
          <BEntityIcon :role="dog?.role" :size="18" color="#fff" />
        </view>
        <view class="status-sheet__dog-copy">
          <text class="status-sheet__dog-name">{{ dog.name || '未命名' }}</text>
          <text class="status-sheet__dog-sub">{{ dispositionActionSummary }}</text>
        </view>
      </view>
      <view class="status-sheet__actions">
        <view
          v-for="action in dispositionActions"
          :key="action.key"
          class="status-sheet__action-row"
          @click="handleDispositionActionItem(action)"
        >
          <view class="status-sheet__action-left">
            <view class="status-sheet__action-icon" :class="`status-sheet__action-icon--${action.tone}`">
              <text class="material-icons-round">{{ action.icon }}</text>
            </view>
            <view class="status-sheet__action-copy">
              <text class="status-sheet__action-title" :class="action.tone === 'red' ? 'status-sheet__action-title--danger' : ''">{{ action.title }}</text>
              <text class="status-sheet__action-sub">{{ action.sub }}</text>
            </view>
          </view>
          <text class="material-icons-round status-sheet__action-chevron">chevron_right</text>
        </view>
      </view>
    </BSheet>

    <!-- ==================== D-7: 退休表单 Sheet ==================== -->
    <BSheet v-model:visible="showRetireSheet" title="标记退休">
      <view class="sheet-form">
        <view class="status-sheet__dog-info">
          <view class="status-sheet__dog-avatar" :class="heroAvatarClass">
            <BEntityIcon :role="dog?.role" :size="18" color="#fff" />
          </view>
          <view class="status-sheet__dog-copy">
            <text class="status-sheet__dog-name">{{ dog.name || '未命名' }}</text>
            <text class="status-sheet__dog-sub">{{ dispositionActionSummary }}</text>
          </view>
        </view>
        <view class="sheet-form__group">
          <text class="sheet-form__label">退休日期 *</text>
          <picker mode="date" :value="retireDate" @change="retireDate = $event.detail.value">
            <view class="sheet-form__input">
              <text class="sheet-form__input-text">{{ retireDate }}</text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
        </view>
        <view class="sheet-form__group">
          <text class="sheet-form__label">退休原因（选填）</text>
          <input v-model="retireReason" class="sheet-form__text-input" placeholder="如：年龄过大/健康问题..." />
        </view>
        <view class="sheet-form__actions">
          <view class="sheet-form__btn sheet-form__btn--cancel" @click="showRetireSheet = false">
            <text class="sheet-form__btn-text" style="color: var(--text-2);">取消</text>
          </view>
          <view class="sheet-form__btn sheet-form__btn--primary" @click="doRetire">
            <text class="sheet-form__btn-text" style="color: #fff;">确认退休</text>
          </view>
        </view>
      </view>
    </BSheet>

    <!-- ==================== D-8: 已故表单 Sheet ==================== -->
    <BSheet v-model:visible="showDeceasedSheet" title="标记已故">
      <view class="sheet-form">
        <view class="status-sheet__dog-info">
          <view class="status-sheet__dog-avatar" :class="heroAvatarClass">
            <BEntityIcon :role="dog?.role" :size="18" color="#fff" />
          </view>
          <view class="status-sheet__dog-copy">
            <text class="status-sheet__dog-name">{{ dog.name || '未命名' }}</text>
            <text class="status-sheet__dog-sub">{{ dispositionActionSummary }}</text>
          </view>
        </view>
        <view class="sheet-form__danger-note">
          <text class="material-icons-round sheet-form__danger-icon">warning</text>
          <text class="sheet-form__danger-text">此操作将取消所有未完成的提醒任务。</text>
        </view>
        <view class="sheet-form__group">
          <text class="sheet-form__label">日期 *</text>
          <picker mode="date" :value="deceasedDate" @change="deceasedDate = $event.detail.value">
            <view class="sheet-form__input">
              <text class="sheet-form__input-text">{{ deceasedDate }}</text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
        </view>
        <view class="sheet-form__group">
          <text class="sheet-form__label">备注（可选）</text>
          <input v-model="deceasedCause" class="sheet-form__text-input" placeholder="死因等信息" />
        </view>
        <view class="sheet-form__actions">
          <view class="sheet-form__btn sheet-form__btn--cancel" @click="showDeceasedSheet = false">
            <text class="sheet-form__btn-text" style="color: var(--text-2);">取消</text>
          </view>
          <view class="sheet-form__btn sheet-form__btn--danger" @click="doDeceased">
            <text class="sheet-form__btn-text" style="color: #fff;">确认标记已故</text>
          </view>
        </view>
      </view>
    </BSheet>

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
          <view class="sheet-form__btn sheet-form__btn--cancel" @click="showAdoptionSheet = false">
            <text class="sheet-form__btn-text" style="color: var(--text-2);">取消</text>
          </view>
          <view class="sheet-form__btn sheet-form__btn--primary" @click="doAdoption">
            <text class="sheet-form__btn-text" style="color: #fff;">确认领养</text>
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
          <view class="sheet-form__btn sheet-form__btn--cancel" @click="showGiftSheet = false">
            <text class="sheet-form__btn-text" style="color: var(--text-2);">取消</text>
          </view>
          <view class="sheet-form__btn sheet-form__btn--primary" @click="doGift">
            <text class="sheet-form__btn-text" style="color: #fff;">确认赠送</text>
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

    <!-- ==================== D-13: 康复表单 Sheet ==================== -->
    <BSheet v-model:visible="showRecoverySheet" title="标记康复">
      <view class="sheet-form">
        <view class="status-sheet__dog-info">
          <view class="status-sheet__dog-avatar" :class="heroAvatarClass">
            <BEntityIcon :role="dog?.role" :size="18" color="#fff" />
          </view>
          <view class="status-sheet__dog-copy">
            <text class="status-sheet__dog-name">{{ dog.name || '未命名' }}</text>
            <text class="status-sheet__dog-sub">{{ healthActionSummary }}</text>
          </view>
        </view>
        <view class="sheet-form__group">
          <text class="sheet-form__label">康复日期</text>
          <picker mode="date" :value="recoveryDate" @change="recoveryDate = $event.detail.value">
            <view class="sheet-form__input">
              <text class="sheet-form__input-text">{{ recoveryDate }}</text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
        </view>
        <view class="sheet-form__actions">
          <view class="sheet-form__btn sheet-form__btn--cancel" @click="showRecoverySheet = false">
            <text class="sheet-form__btn-text" style="color: var(--text-2);">取消</text>
          </view>
          <view class="sheet-form__btn sheet-form__btn--primary" @click="doRecovery">
            <text class="sheet-form__btn-text" style="color: #fff;">确认康复</text>
          </view>
        </view>
      </view>
    </BSheet>

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
            <BEntityIcon :role="dog?.role" :size="16" color="#fff" />
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
          <BSubmitButton
            class="weight-entry__save-btn"
            :loading="weightSubmitState === 'submitting'"
            :success="weightSubmitState === 'success'"
            :disabled="weightSubmitState === 'submitting' || !canSubmitWeight"
            @click="saveWeight"
          >
            {{ weightSaveButtonText }}
          </BSubmitButton>
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

    <BAddRecordSheet
      v-model:visible="showAddRecordSheet"
      :context-title="dog?.name || '当前犬只'"
      :context-status="activeCycle?.status || ''"
      :context-sub="activeCycle?._id ? '繁育记录将自动带入当前周期' : '按业务分组快速记录'"
      :groups="addRecordGroups"
      @select="navigateToRecord"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { onLoad, onPageScroll, onShow } from '@dcloudio/uni-app'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BModal from '@/components/layout/BModal.vue'
import BDeleteConfirm from '@/components/layout/BDeleteConfirm.vue'
import BAddRecordSheet from '@/components/record/BAddRecordSheet.vue'
import { useCloudCall } from '@/composables/useCloudCall'
import { consumeSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import { useDogStore } from '@/stores/dogStore'
import type { Dog, DeriveStatus } from '@/types/dog'
import { buildMedicationDetailUrl, resolveDogDetailStatusRoute } from '@/utils/dogDetailNavigation'
import { formatMedicationDosage } from '@/utils/medicationDisplay'
import { buildCompactDeriveStatusTitle } from '@/utils/dogStatusCopy'
import { getDogStatusTone, getHealthTypeTone } from '@/utils/themeSemantics'
import type { AddRecordItem } from '@/utils/addRecordSheet'
import { createAllAddRecordGroups } from '@/utils/addRecordSheet'
import type { BreedingCycleDetailResponse } from '@/types/breeding'
import { buildActiveCycleSummaryViewModel, buildHistoryCycleSummaryViewModel } from '@/utils/dogBreedingSummary'

const dog = ref<Dog | null>(null)
const statuses = ref<DeriveStatus[]>([])
const cycles = ref<any[]>([])
const healthRecords = ref<any[]>([])
const medicationRecords = ref<any[]>([])
const activeTab = ref('overview')
const loading = ref(true)
const showMore = ref(false)
const showAddRecordSheet = ref(false)
const infoExpanded = ref(false)
const submitBannerMessage = ref('')
const showCompactTopbarTitle = ref(false)
const TOPBAR_TITLE_SCROLL_THRESHOLD = 36
const activeCycleSummaryDetail = ref<BreedingCycleDetailResponse | null>(null)
const activeCycleSummaryCache = ref<Record<string, BreedingCycleDetailResponse>>({})
let dogId = ''
let submitBannerTimer: ReturnType<typeof setTimeout> | null = null
let hasLoadedOnce = false
let latestLoadToken = 0
let latestActiveCycleSummaryToken = 0

const tabs = computed(() => {
  if (dog.value?.role === '幼崽') {
    return [
      { key: 'overview', label: '概览' },
      { key: 'health', label: '健康' },
      { key: 'finance', label: '财务' },
    ]
  }

  return [
    { key: 'overview', label: '概览' },
    { key: 'breeding', label: '繁育' },
    { key: 'health', label: '健康' },
    { key: 'finance', label: '财务' },
  ]
})

const isPuppyDetail = computed(() => dog.value?.role === '幼崽')

const tertiaryStatIcon = computed(() => isPuppyDetail.value ? 'route' : 'child_friendly')
const tertiaryStatValue = computed(() => isPuppyDetail.value ? (dog.value?.disposition || '在养') : `${cycles.value.length}窝`)
const tertiaryStatLabel = computed(() => isPuppyDetail.value ? '去向' : '繁育')

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

onPageScroll(({ scrollTop }) => {
  showCompactTopbarTitle.value = scrollTop > TOPBAR_TITLE_SCROLL_THRESHOLD
})

// 繁育周期计算属性
const isInEstrus = computed(() => statuses.value.some((s: any) => s.type === '发情中'))
const TERMINAL_CYCLE_STATUSES = ['已生产', '失败', '放弃']
const activeCycle = computed(() => cycles.value.find((c: any) => !TERMINAL_CYCLE_STATUSES.includes(c.status)))
const pastCycles = computed(() => cycles.value.filter((c: any) => TERMINAL_CYCLE_STATUSES.includes(c.status)))
const activeCycleId = computed(() => activeCycle.value?._id || '')

const vaccineRecords = computed(() => healthRecords.value.filter((r: any) => r.type === 'vaccination'))
const dewormingRecords = computed(() => healthRecords.value.filter((r: any) => r.type === 'deworming'))
const illnessRecords = computed(() => healthRecords.value.filter((r: any) => r.type === 'illness'))
const latestIllnessRecord = computed(() => illnessRecords.value[0] || null)
const latestActiveIllnessRecord = computed(() => illnessRecords.value.find((record: any) => illnessStatusLabel(record) !== '已康复') || null)
const activeMedicationRecords = computed(() => medicationRecords.value.filter((record: any) => record.status === 'active'))
const canQuickStartMedication = computed(() => !!latestActiveIllnessRecord.value && activeMedicationRecords.value.length === 0)
const canQuickRecover = computed(() => !!latestActiveIllnessRecord.value)
type DispositionActionKey = 'promote' | 'deceased' | 'adoption' | 'gift' | 'retire' | 'cancel-retire'
type DispositionAction = {
  key: DispositionActionKey
  icon: string
  title: string
  sub: string
  tone: 'amber' | 'red' | 'green' | 'teal' | 'plum' | 'blue'
}
const healthActions = computed(() => {
  const actions: Array<{
    key: 'start-medication' | 'recover'
    icon: string
    title: string
    sub: string
    tone: 'plum' | 'green'
  }> = []

  if (canQuickStartMedication.value) {
    const illnessName = latestActiveIllnessRecord.value?.details?.condition || '当前疾病'
    actions.push({
      key: 'start-medication',
      icon: 'medication',
      title: '开始用药',
      sub: `为${illnessName}创建连续用药任务`,
      tone: 'plum',
    })
  }

  if (canQuickRecover.value) {
    const illnessName = latestActiveIllnessRecord.value?.details?.condition || '当前疾病'
    actions.push({
      key: 'recover',
      icon: 'check_circle',
      title: '标记康复',
      sub: `结束${illnessName}当前状态`,
      tone: 'green',
    })
  }

  return actions
})
const hasHealthActions = computed(() => healthActions.value.length > 0)
const healthActionSummary = computed(() => {
  if (latestActiveIllnessRecord.value) {
    const illnessName = latestActiveIllnessRecord.value.details?.condition || '当前疾病'
    const treatmentStatus = illnessStatusLabel(latestActiveIllnessRecord.value) || '观察中'
    return `${illnessName} · ${treatmentStatus}`
  }
  if (activeMedicationRecords.value.length > 0) {
    return `进行中用药 ${activeMedicationRecords.value.length} 项`
  }
  return '当前暂无可快捷处理的健康状态'
})
const dispositionActions = computed<DispositionAction[]>(() => {
  const d = dog.value
  if (!d) return []

  if (d.role === '幼崽') {
    return [
      { key: 'promote', icon: 'trending_up', title: '升级为种犬', sub: '切换为种狗身份并恢复在养状态', tone: 'amber' },
      { key: 'adoption', icon: 'volunteer_activism', title: '送领养', sub: '登记领养去向与领养费用', tone: 'green' },
      { key: 'gift', icon: 'redeem', title: '赠送', sub: '登记受赠对象与赠送日期', tone: 'teal' },
      { key: 'deceased', icon: 'heart_broken', title: '标记已故', sub: '结束当前状态并取消未完成任务', tone: 'red' },
    ]
  }

  if (d.disposition === '已退休') {
    return [
      { key: 'cancel-retire', icon: 'replay', title: '取消退休', sub: '恢复在养状态并回到活跃犬只列表', tone: 'blue' },
      { key: 'deceased', icon: 'heart_broken', title: '标记已故', sub: '结束当前状态并取消未完成任务', tone: 'red' },
    ]
  }

  return [
    { key: 'adoption', icon: 'volunteer_activism', title: '送领养', sub: '登记领养去向与领养费用', tone: 'green' },
    { key: 'retire', icon: 'bedtime', title: '退休', sub: '结束繁育身份并保留健康管理', tone: 'plum' },
    { key: 'gift', icon: 'redeem', title: '赠送', sub: '登记受赠对象与赠送日期', tone: 'teal' },
    { key: 'deceased', icon: 'heart_broken', title: '标记已故', sub: '结束当前状态并取消未完成任务', tone: 'red' },
  ]
})
const dispositionActionSummary = computed(() => {
  const d = dog.value
  if (!d) return '请选择去向管理动作'
  return `${d.role || '种狗'} · ${d.disposition || '在养'}`
})

const litters = ref<any[]>([])
const dogFinance = ref<any>(null)
const litterByCycleId = computed(() => {
  const map = new Map<string, any>()
  for (const litter of litters.value) {
    if (litter?.cycle_id) {
      map.set(litter.cycle_id, litter)
    }
  }
  return map
})
const activeCycleSummary = computed(() => buildActiveCycleSummaryViewModel(
  activeCycleSummaryDetail.value?.cycle || activeCycle.value || null,
  activeCycleSummaryDetail.value?.records || [],
))
const historyCycleCards = computed(() => {
  return pastCycles.value.map((cycle: any) => {
    const summary = buildHistoryCycleSummaryViewModel(cycle, litterByCycleId.value.get(cycle._id) || null)
    return {
      ...cycle,
      summaryTitle: summary.title,
      summaryMeta: summary.meta,
      summaryResult: summary.result,
    }
  })
})
const litterCards = computed(() => {
  return litters.value.map((litter: any) => {
    const totalCount = getLitterTotalCount(litter)
    const aliveCount = getLitterAliveCount(litter)
    const keptCount = Number(litter?.pupStats?.kept) || 0
    const availableCount = Number(litter?.pupStats?.available) || 0
    const soldCount = Number(litter?.pupStats?.sold) || 0

    const chips = [
      totalCount > 0 ? { key: 'total', label: `共${totalCount}只`, tone: 'total' } : null,
      aliveCount > 0 ? { key: 'alive', label: `存活${aliveCount}`, tone: 'alive' } : null,
      keptCount > 0 ? { key: 'kept', label: `在养${keptCount}`, tone: 'kept' } : null,
      availableCount > 0 ? { key: 'available', label: `待售${availableCount}`, tone: 'avail' } : null,
      soldCount > 0 ? { key: 'sold', label: `已售${soldCount}`, tone: 'sold' } : null,
    ].filter(Boolean)

    return {
      ...litter,
      summaryTitle: formatDate(litter.birth_date),
      summaryNumber: Number.isFinite(Number(litter.litter_number)) && Number(litter.litter_number) > 0 ? `第${litter.litter_number}窝` : '',
      summarySire: litter.sire_name ? `种公: ${litter.sire_name}` : '',
      chips,
    }
  })
})

const { run: fetchDetail } = useCloudCall<{ data: Dog }>('dog-service', 'getDogDetail')
const { run: fetchCycles } = useCloudCall<{ data: any[] }>('breeding-service', 'getCycleHistory')
const { loading: activeCycleDetailLoading, run: fetchCycleDetail } = useCloudCall<{ data: BreedingCycleDetailResponse }>('breeding-service', 'getCycleDetail', {
  showError: false,
})
const { run: fetchHealth } = useCloudCall<{ data: any[] }>('health-service', 'getHealthHistory')
const { run: fetchMedicationHistory } = useCloudCall<{ data: any[] }>('health-service', 'getMedicationHistory')
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

function medicationRecordTitle(record: any) {
  const dosageText = formatMedicationDosage(record?.dosage, record?.dosage_unit)
  const parts = [record?.drug_name || '用药', dosageText, record?.method].filter(Boolean)
  return parts.join(' · ')
}

function medicationRecordTagText(record: any) {
  if (record?.status === 'active') return '用药中'
  if (record?.status === 'completed') return '已完成'
  if (record?.status === 'cancelled') return '已取消'
  return '用药'
}

function medicationRecordTagTone(record: any) {
  if (record?.status === 'active') return 'plum'
  if (record?.status === 'completed') return 'green'
  return 'gray'
}

function medicationRecordSub(record: any) {
  if (record?.status === 'active' && record?.progress) {
    return `第${record.progress.current}天 / 共${record.progress.total}天`
  }

  const startText = typeof record?.start_date === 'number'
    ? `${formatDate(record.start_date)} 开始`
    : '开始日期未知'

  if (typeof record?.completed_dose_count === 'number' && typeof record?.total_dose_count === 'number' && record.total_dose_count > 0) {
    const summary = record.status === 'completed'
      ? `已完成 ${record.completed_dose_count}/${record.total_dose_count} 次`
      : `已执行 ${record.completed_dose_count}/${record.total_dose_count} 次`
    return `${startText} · ${summary}`
  }

  return startText
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
  return buildCompactDeriveStatusTitle(s, {
    dayCount: s.type === '发情中'
      ? (s.progress?.current || activeCycle.value?.day_count)
      : s.type === '生病中'
        ? getElapsedDaysFromTs(getIllnessStartTs())
        : undefined,
    nameOverride: s.type === '用药中'
      ? splitStatusDetail(s.detail).primary
      : s.type === '生病中'
        ? (s.label || latestIllnessRecord.value?.details?.condition || '')
        : undefined,
  })
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
  if (s.type === '哺乳中') {
    return s.detail || '当前处于哺乳照护阶段'
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

function getLitterTotalCount(litter: any) {
  const totalBorn = Number(litter?.total_born)
  if (Number.isFinite(totalBorn) && totalBorn > 0) return totalBorn
  const total = Number(litter?.pupStats?.total)
  return Number.isFinite(total) && total > 0 ? total : 0
}

function getLitterAliveCount(litter: any) {
  const bornAlive = Number(litter?.born_alive)
  if (Number.isFinite(bornAlive) && bornAlive >= 0) return bornAlive
  const alive = Number(litter?.pupStats?.alive)
  return Number.isFinite(alive) && alive >= 0 ? alive : 0
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

async function ensureActiveCycleSummary(force = false) {
  const cycleId = activeCycleId.value
  if (!cycleId) {
    activeCycleSummaryDetail.value = null
    return
  }

  if (!force && activeCycleSummaryCache.value[cycleId]) {
    activeCycleSummaryDetail.value = activeCycleSummaryCache.value[cycleId]
    return
  }

  const requestToken = ++latestActiveCycleSummaryToken
  const result = await fetchCycleDetail(cycleId)
  if (requestToken !== latestActiveCycleSummaryToken) return

  const detail = result?.data || null
  if (!detail) return

  activeCycleSummaryCache.value = {
    ...activeCycleSummaryCache.value,
    [cycleId]: detail,
  }
  activeCycleSummaryDetail.value = detail
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

const addRecordGroups = computed(() => createAllAddRecordGroups({
  includeBreedingHint: !!activeCycle.value?._id,
  allowBreeding: dog.value?.role !== '幼崽',
}))

function addRecord() {
  showAddRecordSheet.value = true
}

function navigateToRecord(item: AddRecordItem) {
  if (item.url === '/pages/breeding/birth-wizard' && !activeCycle.value?._id) {
    uni.showToast({ title: '当前无可记录的繁育周期', icon: 'none' })
    return
  }

  showAddRecordSheet.value = false
  if (item.page === 'batch-weight' || item.url === '/pages/health/batch-weight') {
    nextTick(() => {
      openWeightEntry()
    })
    return
  }

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
  const target = addRecordGroups.value.flatMap(group => group.items).find(item => item.page === page)
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

function goToMedicationDetail(taskId?: string) {
  const normalizedId = typeof taskId === 'string' ? taskId.trim() : ''
  if (!normalizedId) {
    uni.showToast({ title: '用药信息缺失', icon: 'none' })
    return
  }

  uni.navigateTo({
    url: buildMedicationDetailUrl(normalizedId),
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
  if (!hasHealthActions.value) {
    uni.showToast({ title: '当前暂无可执行的健康操作', icon: 'none' })
    return
  }
  showStatusSheet.value = true
}

// ==================== 去向管理 ====================

const showDispositionSheet = ref(false)

function openDispositionSheet() {
  showMore.value = false
  showDispositionSheet.value = true
}

function handleDispositionAction(actionKey: DispositionActionKey) {
  showDispositionSheet.value = false

  switch (actionKey) {
    case 'deceased':
      deceasedDate.value = todayStr()
      deceasedCause.value = ''
      showDeceasedSheet.value = true
      return
    case 'adoption':
      adoptionDate.value = todayStr()
      adoptionNotes.value = ''
      adoptionFee.value = ''
      showAdoptionSheet.value = true
      return
    case 'gift':
      giftDate.value = todayStr()
      giftRecipient.value = ''
      showGiftSheet.value = true
      return
    case 'retire':
      retireDate.value = todayStr()
      retireReason.value = ''
      showRetireSheet.value = true
      return
    case 'cancel-retire':
      showCancelRetireModal.value = true
      return
    case 'promote':
      showPromoteModal.value = true
      return
  }
}

function handleDispositionActionItem(action: DispositionAction) {
  handleDispositionAction(action.key)
}

function openMedication() {
  showStatusSheet.value = false
  const dogName = encodeURIComponent(dog.value?.name || '')
  const illnessParam = latestActiveIllnessRecord.value?._id ? `&illnessRecordId=${latestActiveIllnessRecord.value._id}` : ''
  uni.navigateTo({ url: `/pages/record/health-medication?dogId=${dogId}&dogName=${dogName}${illnessParam}` })
}

function handleHealthAction(actionKey: 'start-medication' | 'recover') {
  if (actionKey === 'start-medication') {
    openMedication()
    return
  }
  openRecoveryConfirm()
}

// ==================== D-7: 退休确认 ====================

const showRetireSheet = ref(false)
const retireDate = ref(todayStr())
const retireReason = ref('')

function openRetireConfirm() {
  showStatusSheet.value = false
  retireDate.value = todayStr()
  retireReason.value = ''
  showRetireSheet.value = true
}

async function doRetire() {
  await updateDisposition(dogId, '已退休', {
    date: new Date(retireDate.value + 'T00:00:00+08:00').getTime(),
    reason: retireReason.value || null,
  })
  showRetireSheet.value = false
  await loadData()
}

// ==================== D-8: 已故确认 ====================

const showDeceasedSheet = ref(false)
const deceasedDate = ref(todayStr())
const deceasedCause = ref('')

async function doDeceased() {
  await updateDisposition(dogId, '已故', {
    date: new Date(deceasedDate.value + 'T00:00:00+08:00').getTime(),
    cause: deceasedCause.value || null,
  })
  showDeceasedSheet.value = false
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

const showRecoverySheet = ref(false)
const recoveryDate = ref(todayStr())

function openRecoveryConfirm() {
  showStatusSheet.value = false
  recoveryDate.value = todayStr()
  showRecoverySheet.value = true
}

async function doRecovery() {
  await updateStatus(dogId, 'recover', {
    date: new Date(recoveryDate.value + 'T00:00:00+08:00').getTime(),
  })
  showRecoverySheet.value = false
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
const canSubmitWeight = computed(() => {
  const kg = parseFloat(weightInput.value)
  return Number.isFinite(kg) && kg > 0 && !!weightDateStr.value
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
    await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
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
type WeightRecord = { weight: number; date: number; notes?: string; created_at?: number }

const weightHistory = ref<WeightRecord[]>([])

function sortWeightRecordsDesc(records: WeightRecord[]) {
  return [...records].sort((a, b) => {
    if (b.date !== a.date) return b.date - a.date
    return (b.created_at || 0) - (a.created_at || 0)
  })
}

function sortWeightRecordsAsc(records: WeightRecord[]) {
  return [...records].sort((a, b) => {
    if (a.date !== b.date) return a.date - b.date
    return (a.created_at || 0) - (b.created_at || 0)
  })
}

const recentWeightRecords = computed(() => sortWeightRecordsDesc(weightHistory.value))
const weightTrendRecords = computed(() => sortWeightRecordsAsc(recentWeightRecords.value.slice(0, 10)))

const { run: fetchWeightHistory } = useCloudCall<{ data: WeightRecord[] }>('health-service', 'getWeightHistory')

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

async function loadData({
  silent = false,
  shouldCleanup = false,
  refreshBreedingSummary = false,
}: {
  silent?: boolean
  shouldCleanup?: boolean
  refreshBreedingSummary?: boolean
} = {}) {
  const loadToken = ++latestLoadToken
  const showSkeleton = !silent && !hasLoadedOnce

  if (showSkeleton) {
    loading.value = true
  }

  try {
    if (shouldCleanup) {
      await cleanupDuplicateIllnesses({ dog_id: dogId }).catch(() => {})
    }

    const detailRes = await fetchDetail(dogId)

    if (loadToken !== latestLoadToken) return

    if (detailRes?.data) {
      dog.value = detailRes.data
      statuses.value = detailRes.data.statuses || []
      if (detailRes.data.role === '幼崽' && activeTab.value === 'breeding') {
        activeTab.value = 'overview'
      }
    }

    const isPuppy = detailRes?.data?.role === '幼崽'
    const [healthRes, medicationRes, financeRes, cyclesRes, littersRes] = await Promise.all([
      fetchHealth(dogId),
      fetchMedicationHistory(dogId),
      fetchDogFinance(dogId),
      isPuppy ? Promise.resolve(null) : fetchCycles(dogId),
      isPuppy ? Promise.resolve(null) : fetchLitters(dogId),
    ])

    if (loadToken !== latestLoadToken) return

    if (isPuppy) {
      cycles.value = []
      litters.value = []
      activeCycleSummaryDetail.value = null
    } else {
      if (cyclesRes?.data) {
        cycles.value = cyclesRes.data
      }
      if (littersRes?.data) {
        litters.value = littersRes.data
      }
    }
    if (healthRes?.data) {
      healthRecords.value = healthRes.data
    }
    if (medicationRes?.data) {
      medicationRecords.value = medicationRes.data
    }
    if (financeRes?.data) {
      dogFinance.value = financeRes.data
    }

    const nextActiveCycleId = isPuppy
      ? ''
      : (cyclesRes?.data || []).find((cycle: any) => !TERMINAL_CYCLE_STATUSES.includes(cycle.status))?._id || ''
    if (!nextActiveCycleId || isPuppy) {
      activeCycleSummaryDetail.value = null
    } else if (refreshBreedingSummary) {
      const nextCache = { ...activeCycleSummaryCache.value }
      delete nextCache[nextActiveCycleId]
      activeCycleSummaryCache.value = nextCache
      activeCycleSummaryDetail.value = null
    } else {
      activeCycleSummaryDetail.value = activeCycleSummaryCache.value[nextActiveCycleId] || null
    }

    if (!isPuppy && refreshBreedingSummary && activeTab.value === 'breeding' && nextActiveCycleId) {
      await ensureActiveCycleSummary(true)
    }

    hasLoadedOnce = true
  } finally {
    if (showSkeleton && loadToken === latestLoadToken) {
      loading.value = false
    }
  }
}

watch([activeTab, activeCycleId], async ([tab, cycleId], [, previousCycleId]) => {
  if (!cycleId) {
    activeCycleSummaryDetail.value = null
    return
  }

  if (cycleId !== previousCycleId) {
    activeCycleSummaryDetail.value = activeCycleSummaryCache.value[cycleId] || null
  }

  if (tab === 'breeding') {
    await ensureActiveCycleSummary()
  }
})

watch(tabs, (nextTabs) => {
  if (!nextTabs.some(tab => tab.key === activeTab.value)) {
    activeTab.value = 'overview'
  }
})

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
    loadData({
      silent: true,
      shouldCleanup: true,
      refreshBreedingSummary: activeTab.value === 'breeding',
    })
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
  opacity: 0;
  transform: translateY(-2px);
  transition: opacity 0.18s ease, transform 0.18s ease;
  pointer-events: none;
}
.dog-detail__topbar-title--visible {
  opacity: 1;
  transform: translateY(0);
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
.dog-detail__rec-tag--plum {
  background: var(--plum-soft);
  .dog-detail__rec-tag-text { color: var(--plum); }
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
  padding: 15px 16px 15px 18px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
  border-left: 3.5px solid transparent;
  &:active {
    transform: scale(0.975);
    box-shadow: 0 1px 6px rgba(234, 62, 119, 0.04);
  }
}
.dog-detail__cycle-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dog-detail__cycle-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.dog-detail__cycle-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}
.dog-detail__cycle-meta,
.dog-detail__cycle-result {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  line-height: 1.4;
}
.dog-detail__cycle-result {
  color: var(--text-3);
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.breeding-active-cycle__eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
}
.breeding-active-cycle__dot {
  width: 8px; height: 8px; border-radius: 50%; background: var(--rose);
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.breeding-active-cycle__label { font-size: 11px; font-weight: 700; color: var(--rose); }
.breeding-active-cycle__chevron { font-size: 16px; color: var(--text-4); }
.breeding-active-cycle__title {
  display: block;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 2px;
}
.breeding-active-cycle__sub {
  display: block;
  font-size: 12px;
  color: var(--text-2);
}
.breeding-active-cycle__loading {
  padding: 14px 0 6px;
}
.breeding-active-cycle__loading-text,
.breeding-active-cycle__empty-text,
.breeding-active-cycle__footer-text {
  font-size: 12px;
  color: var(--text-3);
}
.breeding-active-cycle__timeline {
  margin-top: 12px;
}
.breeding-active-cycle__timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  & + & {
    margin-top: 10px;
  }

  &--upcoming {
    .breeding-active-cycle__timeline-line {
      background: rgba(216, 203, 189, 0.34);
    }
  }

  &--current {
    .breeding-active-cycle__timeline-title {
      font-size: 13px;
    }
  }
}
.breeding-active-cycle__timeline-rail {
  width: 14px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  align-self: stretch;
  flex-shrink: 0;
  padding-top: 3px;
}
.breeding-active-cycle__timeline-dot {
  width: 10px;
  height: 10px;
  position: relative;
  border-radius: 50%;
  background: var(--text-4);
  border: 2px solid transparent;

  &--amber { background: var(--amber); }
  &--teal { background: var(--teal); }
  &--rose { background: var(--rose); }
  &--green { background: var(--green); }
  &--blue { background: var(--blue); }
  &--gray { background: var(--text-4); }
  &--red { background: var(--red); }

  &--upcoming {
    border-color: rgba(216, 203, 189, 0.45);
  }

  &--current {
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.92);

    &::after {
      content: '';
      position: absolute;
      inset: -5px;
      border-radius: 999px;
      border: 2px solid currentColor;
      opacity: 0.45;
      animation: breeding-active-cycle-pulse 1.8s ease-out infinite;
    }
  }
}
.breeding-active-cycle__timeline-dot--amber.breeding-active-cycle__timeline-dot--current { color: rgba(239, 161, 54, 0.46); }
.breeding-active-cycle__timeline-dot--teal.breeding-active-cycle__timeline-dot--current { color: rgba(67, 166, 161, 0.46); }
.breeding-active-cycle__timeline-dot--rose.breeding-active-cycle__timeline-dot--current { color: rgba(255, 108, 148, 0.42); }
.breeding-active-cycle__timeline-dot--green.breeding-active-cycle__timeline-dot--current { color: rgba(75, 168, 94, 0.4); }
.breeding-active-cycle__timeline-dot--blue.breeding-active-cycle__timeline-dot--current { color: rgba(74, 134, 232, 0.4); }
.breeding-active-cycle__timeline-dot--gray.breeding-active-cycle__timeline-dot--current { color: rgba(164, 148, 132, 0.36); }
.breeding-active-cycle__timeline-dot--red.breeding-active-cycle__timeline-dot--current { color: rgba(224, 82, 82, 0.38); }
.breeding-active-cycle__timeline-line {
  width: 2px;
  flex: 1;
  margin-top: 5px;
  background: rgba(216, 203, 189, 0.42);
  border-radius: 999px;
}
.breeding-active-cycle__timeline-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.breeding-active-cycle__timeline-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
}
.breeding-active-cycle__timeline-title--rose { color: var(--rose); }
.breeding-active-cycle__timeline-title--amber { color: var(--amber); }
.breeding-active-cycle__timeline-title--gray { color: var(--text-3); }
.breeding-active-cycle__timeline-title--red { color: var(--red); }
.breeding-active-cycle__timeline-sub {
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-3);
  margin-top: 2px;
}
.breeding-active-cycle__timeline-sub--gray {
  color: var(--text-4);
}
.breeding-active-cycle__empty {
  padding-top: 12px;
}
.breeding-active-cycle__footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(216, 203, 189, 0.18);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.breeding-active-cycle__footer-text {
  flex: 1;
}

@keyframes breeding-active-cycle-pulse {
  0% {
    transform: scale(0.88);
    opacity: 0.56;
  }
  70% {
    transform: scale(1.28);
    opacity: 0;
  }
  100% {
    transform: scale(1.28);
    opacity: 0;
  }
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
  gap: 10px;
  margin-bottom: 16px;
}
.status-sheet__dog-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.status-sheet__dog-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.status-sheet__dog-name {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}
.status-sheet__dog-sub {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}
.status-sheet__actions {
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.status-sheet__action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 14px 14px 16px;
  cursor: pointer;
  transition: background 0.12s ease;
  &:active { background: rgba(234, 62, 119, 0.03); }
  & + & { border-top: 1px solid rgba(216, 203, 189, 0.12); }
}
.status-sheet__action-left {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}
.status-sheet__action-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  .material-icons-round { font-family: 'Material Icons Round'; font-size: 18px; }
}
.status-sheet__action-icon--plum {
  background: var(--icon-plum);
  .material-icons-round { color: var(--plum); }
}
.status-sheet__action-icon--green {
  background: var(--icon-green);
  .material-icons-round { color: var(--green); }
}
.status-sheet__action-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.status-sheet__action-title {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.25;
}
.status-sheet__action-title--danger {
  color: var(--red);
}
.status-sheet__action-sub {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  line-height: 1.35;
}
.status-sheet__action-chevron {
  font-family: 'Material Icons Round';
  color: var(--text-4);
  font-size: 20px;
  flex-shrink: 0;
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
  flex-direction: row;
  gap: 10px;
  margin-top: 20px;
}
.sheet-form__btn {
  flex: 1;
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
.sheet-form__btn--danger {
  background: var(--red);
}
.sheet-form__btn--cancel {
  background: var(--card-dim);
}
.sheet-form__btn-text {
  font-size: 15px;
  font-weight: 600;
}
.sheet-form__danger-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-row);
  background: rgba(255, 107, 107, 0.08);
  margin-bottom: 16px;
}
.sheet-form__danger-icon {
  font-family: 'Material Icons Round';
  font-size: 18px;
  color: var(--red);
  flex-shrink: 0;
  margin-top: 1px;
}
.sheet-form__danger-text {
  flex: 1;
  font-size: 13px;
  line-height: 1.5;
  color: var(--red);
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

/* ==================== D: 产仔记录 ==================== */
.dog-detail__litter-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dog-detail__litter-item {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  box-shadow: var(--shadow);
  &:active { background: rgba(234, 62, 119, 0.03); }
}
.dog-detail__litter-main {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.dog-detail__litter-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dog-detail__litter-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.dog-detail__litter-date {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}
.dog-detail__litter-number {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  background: var(--card-dim);
  border-radius: var(--radius-tag);
  padding: 3px 8px;
}
.dog-detail__litter-sire {
  font-size: 12px;
  line-height: 1.35;
  color: var(--text-2);
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
.dog-detail__pup-chip--kept {
  background: rgba(75, 168, 94, 0.12);
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

</style>
