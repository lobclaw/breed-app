<!--
  BFabSheet — FAB Action Sheet（全局快速记录入口）
  独立组件，可在任何 Tab 页面使用
  Props: visible (v-model)
-->
<template>
  <view v-if="visible" class="sheet-mask">
    <view class="sheet-mask__overlay" @click="close" @touchmove.prevent />
    <view class="sheet-panel">
      <view class="sheet-handle"><view class="sheet-bar" /></view>

      <!-- 视图 1: 智能推荐 + 常用录入 -->
      <template v-if="!allRecordsView">
        <!-- 智能推荐 -->
        <template v-if="recommendations.length > 0">
          <text class="sheet-section-title">智能推荐</text>
          <view class="rec-list">
            <view v-for="rec in recommendations" :key="rec.label" class="rec-card" @click="doAction(rec)">
              <view class="rec-icon" :class="`rec-icon--${rec.iconColor}`">
                <text class="material-icons-round">{{ rec.materialIcon }}</text>
              </view>
              <view class="rec-text">
                <text class="rec-title">{{ rec.label }}</text>
                <text class="rec-sub">{{ rec.sub }}</text>
              </view>
              <view class="rec-right">
                <view v-if="rec.tag" class="rec-tag" :class="`rec-tag--${rec.tagColor}`">
                  <text class="rec-tag-text">{{ rec.tag }}</text>
                </view>
                <text class="material-icons-round rec-chevron">chevron_right</text>
              </view>
            </view>
          </view>
        </template>

        <view class="sheet-separator" />

        <text class="sheet-section-title">常用录入</text>
        <view class="quick-actions">
          <view
            v-for="qa in quickActionBtns"
            :key="qa.label"
            class="quick-action-btn"
            @click="doAction(qa)"
          >
            <view class="qa-icon" :class="`qa-icon--${qa.iconColor}`">
              <text class="material-icons-round">{{ qa.materialIcon }}</text>
            </view>
            <text class="qa-label">{{ qa.label }}</text>
          </view>
        </view>

        <view class="sheet-separator" />

        <view class="sheet-footer-link" @click="allRecordsView = true">
          <text class="sheet-footer-link-text">全部记录类型</text>
          <text class="material-icons-round" style="font-size: 16px; color: var(--primary);">arrow_forward</text>
        </view>
      </template>

      <!-- 视图 2: 全部记录类型 -->
      <template v-else>
        <view class="all-records-header">
          <view class="all-records-back" @click="allRecordsView = false">
            <text class="material-icons-round" style="font-size: 20px; color: var(--text-1);">arrow_back_ios_new</text>
          </view>
          <text class="all-records-title">全部记录类型</text>
        </view>

        <scroll-view scroll-y style="max-height: 580px;">
          <view class="all-records-body">
            <view v-for="group in recordGroups" :key="group.label" class="cat-card" :class="`cat-card--${group.color}`">
              <view class="cat-header">
                <view class="cat-dot" :style="{ background: `var(--${group.color})` }" />
                <text class="cat-title">{{ group.label }}</text>
              </view>
              <view class="cat-grid">
                <view v-for="item in group.items" :key="item.label" class="cat-item" @click="doAction(item)">
                  <view class="cat-icon" :style="{ background: item.iconBg }">
                    <text class="material-icons-round" :style="{ color: item.iconColor }">{{ item.icon }}</text>
                  </view>
                  <text class="cat-label">{{ item.label }}</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import { getHealthTypeTone } from '@/utils/themeSemantics'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const taskStore = useTaskStore()
const allRecordsView = ref(false)

const recommendations = computed(() => taskStore.buildSmartRecommendations())

watch(() => props.visible, (v) => {
  if (v) taskStore.ensure()
})

const quickActionBtns = [
  { materialIcon: 'payments', iconColor: 'green', label: '记账', url: '/pages/finance/expense-add' },
  { materialIcon: 'vaccines', iconColor: 'blue', label: '疫苗', url: '/pages/record/health-vaccination' },
  { materialIcon: 'shield', iconColor: 'teal', label: '驱虫', url: '/pages/record/health-deworming' },
  { materialIcon: 'monitor_weight', iconColor: 'teal', label: '体重', url: '/pages/health/batch-weight' },
]

const recordGroups = [
  {
    label: '繁育记录', color: 'rose',
    items: [
      { icon: 'whatshot', iconBg: 'var(--icon-rose)', iconColor: 'var(--rose)', label: '发情', url: '/pages/record/breeding-heat' },
      { icon: 'biotech', iconBg: 'var(--icon-teal)', iconColor: 'var(--teal)', label: '卵泡', url: '/pages/record/breeding-follicle' },
      { icon: 'favorite', iconBg: 'var(--icon-rose)', iconColor: 'var(--rose)', label: '配种', url: '/pages/record/breeding-mating' },
      { icon: 'stethoscope', iconBg: 'var(--icon-green)', iconColor: 'var(--green)', label: '孕检', url: '/pages/record/breeding-pregnancy' },
      { icon: 'assignment', iconBg: 'var(--icon-blue)', iconColor: 'var(--blue)', label: '产检', url: '/pages/record/breeding-prenatal' },
      { icon: 'thermostat', iconBg: 'var(--icon-plum)', iconColor: 'var(--plum)', label: '临产', url: '/pages/record/breeding-prelabor' },
      { icon: 'child_friendly', iconBg: 'var(--icon-rose)', iconColor: 'var(--rose)', label: '生产', url: '/pages/breeding/birth-wizard' },
      { icon: 'warning', iconBg: 'var(--icon-red)', iconColor: 'var(--red)', label: '异常终止', url: '/pages/record/breeding-termination' },
    ],
  },
  {
    label: '健康记录', color: 'green',
    items: [
      { icon: 'vaccines', iconBg: 'var(--icon-blue)', iconColor: 'var(--blue)', label: '疫苗', url: '/pages/record/health-vaccination' },
      { icon: 'shield', iconBg: 'var(--icon-teal)', iconColor: 'var(--teal)', label: '驱虫', url: '/pages/record/health-deworming' },
      { icon: 'sick', iconBg: 'var(--icon-red)', iconColor: `var(--${getHealthTypeTone('illness').color})`, label: '疾病', url: '/pages/record/health-illness' },
      { icon: 'medication', iconBg: 'var(--icon-plum)', iconColor: 'var(--plum)', label: '用药', url: '/pages/record/health-medication' },
      { icon: 'monitor_weight', iconBg: 'var(--icon-teal)', iconColor: 'var(--teal)', label: '体重', url: '/pages/health/batch-weight' },
    ],
  },
  {
    label: '财务记录', color: 'amber',
    items: [
      { icon: 'payments', iconBg: 'var(--icon-green)', iconColor: 'var(--green)', label: '支出', url: '/pages/finance/expense-add' },
      { icon: 'account_balance', iconBg: 'var(--icon-red)', iconColor: 'var(--red)', label: '收入', url: '/pages/finance/expense-add?type=income' },
    ],
  },
]

function close() {
  allRecordsView.value = false
  emit('update:visible', false)
  // #ifdef H5
  document.body.style.overflow = ''
  // #endif
}

function doAction(action: { url: string; label?: string }) {
  // 记录操作用于智能推荐
  const keyMap: Record<string, string> = {
    '/pages/finance/expense-add': 'expense',
    '/pages/finance/expense-add?type=income': 'income',
    '/pages/record/health-vaccination': 'vaccination',
    '/pages/record/health-deworming': 'deworming',
    '/pages/record/health-illness': 'illness',
    '/pages/record/breeding-heat': 'heat',
    '/pages/record/breeding-mating': 'mating',
    '/pages/health/batch-weight': 'weight',
  }
  const key = keyMap[action.url]
  if (key) taskStore.trackAction(key)

  close()
  uni.navigateTo({ url: action.url })
}
</script>

<style lang="scss" scoped>
.sheet-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 200;
  display: flex;
  align-items: flex-end;

  &__overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: var(--mask);
  }
}

.sheet-panel {
  position: relative;
  z-index: 1;
  background: var(--card);
  border-radius: 24px 24px 0 0;
  width: 100%;
  padding: 12px 20px calc(20px + env(safe-area-inset-bottom, 34px));
  box-shadow: 0 -6px 30px rgba(234, 62, 119, 0.1);
}

.sheet-handle { display: flex; justify-content: center; padding: 4px 0 12px; }
.sheet-bar { width: 36px; height: 4px; background: var(--text-4); border-radius: 2px; }
.sheet-section-title { display: block; font-size: 12px; font-weight: 700; color: var(--text-3); letter-spacing: 0.5px; margin-bottom: 10px; }
.sheet-separator { height: 0.5px; background: var(--card-dim); margin: 4px 0 16px; }

/* 智能推荐 */
.rec-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.rec-card {
  display: flex; align-items: center; gap: 12px;
  background: var(--card); border-radius: 14px; padding: 12px 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  border: 1px solid var(--card-dim);
  transition: transform 0.12s ease;
  &:active { transform: scale(0.97); }
}
.rec-icon {
  width: 40px; height: 40px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  .material-icons-round { font-size: 20px; color: #fff; }
  &--red { background: var(--red); }
  &--amber { background: var(--amber); }
  &--green { background: var(--green); }
  &--blue { background: var(--blue); }
  &--teal { background: var(--teal); }
  &--rose { background: var(--rose); }
  &--plum { background: var(--plum); }
}
.rec-text { flex: 1; min-width: 0; }
.rec-title { display: block; font-size: 14px; font-weight: 700; color: var(--text-1); line-height: 1.3; }
.rec-sub { display: block; font-size: 11px; color: var(--text-3); margin-top: 1px; }
.rec-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.rec-tag {
  padding: 2px 8px; border-radius: var(--radius-tag); font-size: 10px; font-weight: 700;
  &--red { background: var(--red-soft); color: var(--red); }
  &--amber { background: var(--amber-soft); color: var(--amber); }
  &--green { background: var(--green-soft); color: var(--green); }
  &--plum { background: var(--plum-soft); color: var(--plum); }
}
.rec-tag-text { font-size: 10px; font-weight: 700; }
.rec-chevron { font-size: 16px; color: var(--text-4); }

/* 常用录入 */
.quick-actions { display: flex; justify-content: space-between; margin-bottom: 20px; }
.quick-action-btn {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  width: 60px; transition: transform 0.12s ease;
  &:active { transform: scale(0.88); }
}
.qa-icon {
  width: 44px; height: 44px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  .material-icons-round { font-size: 22px; color: #fff; }
  &--green { background: var(--green); }
  &--blue { background: var(--blue); }
  &--teal { background: var(--teal); }
  &--amber { background: var(--amber); }
  &--red { background: var(--red); }
  &--rose { background: var(--rose); }
  &--plum { background: var(--plum); }
}
.qa-label { font-size: 11px; font-weight: 600; color: var(--text-2); }

/* 底部链接 */
.sheet-footer-link { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 14px 0; border: 1.5px solid var(--primary); border-radius: 999px; transition: all 0.12s ease; &:active { transform: scale(0.96); opacity: 0.85; } }
.sheet-footer-link-text { font-size: 13px; font-weight: 700; color: var(--primary); }

/* 全部记录类型 */
.all-records-header { display: flex; align-items: center; gap: 8px; padding: 0 0 12px; }
.all-records-back { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; &:active { background: var(--card-dim); } }
.all-records-title { font-size: 15px; font-weight: 700; color: var(--text-1); }
.all-records-body { display: flex; flex-direction: column; gap: 12px; }

.cat-card {
  background: var(--card); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; position: relative; border-left: 3.5px solid transparent;
  &::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 16px; pointer-events: none; }
  & > * { position: relative; z-index: 1; }
  &--rose { border-left-color: var(--rose); &::before { background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 35%); } }
  &--green { border-left-color: var(--green); &::before { background: linear-gradient(135deg, var(--green-soft) 0%, transparent 35%); } }
  &--amber { border-left-color: var(--amber); &::before { background: linear-gradient(135deg, var(--amber-soft) 0%, transparent 35%); } }
  &--teal { border-left-color: var(--teal); &::before { background: linear-gradient(135deg, var(--teal-soft) 0%, transparent 35%); } }
}
.cat-header { display: flex; align-items: center; gap: 8px; padding: 12px 16px 6px; }
.cat-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.cat-title { font-size: 12px; font-weight: 700; color: var(--text-3); letter-spacing: 0.3px; }
.cat-grid { padding: 4px 10px 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; }
.cat-item { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 8px 4px; border-radius: 12px; transition: all 0.12s ease; &:active { transform: scale(0.90); background: rgba(234, 62, 119, 0.04); } }
.cat-icon { width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; .material-icons-round { font-size: 20px; } }
.cat-label { font-size: 11px; font-weight: 600; color: var(--text-1); text-align: center; line-height: 1.2; }
</style>
