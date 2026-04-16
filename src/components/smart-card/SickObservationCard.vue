<!--
  SickObservationCard — 疾病观察卡
  展示仅生病未用药的犬只（sick_only），无 checkbox
  操作：标记康复 / 开始治疗 / 开始用药
-->
<template>
  <view class="card" :class="cardClasses">
    <view class="card-header">
      <view class="card-icon" :class="`card-icon--${cardTone.color}`">
        <text class="material-icons-round sick-icon">sick</text>
      </view>
      <view class="card-title-area">
        <text class="card-name">{{ card.groupTitle || '疾病观察' }}</text>
        <text class="card-sub">{{ card.dogs?.length || 0 }}只犬观察中</text>
      </view>
    </view>

    <!-- 折叠摘要栏（≥3只且折叠时） -->
    <view v-if="dogs.length >= 3 && collapsed" class="collapse-bar" @click="toggleCollapse">
      <view class="sick-dot" :class="`sick-dot--${summarySeverity}`" />
      <text class="collapse-text">{{ dogs.length }}只犬观察中</text>
      <text class="material-icons-round collapse-arrow">expand_more</text>
    </view>

    <!-- 展开列表 -->
    <view v-if="!collapsed || dogs.length < 3" class="sick-list">
      <view
        v-for="dog in dogs"
        :key="dog.dogId"
        class="sick-row"
        :class="{ 'sick-row--removing': dog._removing }"
      >
        <view class="sick-dot" :class="`sick-dot--${dotClass(dog)}`" />
        <text class="sick-row__name">{{ dog.dogName }}</text>
        <view class="sick-row__info">
          <text v-if="dog.illness" class="sick-row__illness">{{ dog.illness }}</text>
          <text class="sick-row__badge sick-row__badge--amber">{{ dog.treatmentStatus || '观察中' }}</text>
          <text class="sick-row__days">第{{ dog.daysSick || 1 }}天</text>
        </view>
        <text class="sick-row__action" @click.stop="onAction(dog)">处理</text>
      </view>
    </view>

    <!-- 收起按钮 -->
    <view v-if="!collapsed && dogs.length >= 3" class="collapse-footer" @click="toggleCollapse">
      <text class="collapse-footer__text">收起</text>
      <text class="material-icons-round collapse-footer__icon">expand_less</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { getHealthTypeTone } from '@/utils/themeSemantics'

const props = defineProps<{ card: any }>()
const emit = defineEmits<{
  (e: 'action', payload: { type: string; data: any }): void
}>()

const dogs = computed(() => props.card.dogs || [])
const cardTone = computed(() => getHealthTypeTone('illness', props.card.priority))
const cardClasses = computed(() => [
  `card--${cardTone.value.color}`,
  {
    'card--illness': cardTone.value.variant === 'illness',
    'card--overdue': cardTone.value.variant === 'overdue',
  },
])

// 折叠（≥3只默认折叠）
const COLLAPSE_KEY = 'sick_obs_collapsed'
const _stored = uni.getStorageSync(COLLAPSE_KEY)
// uni.getStorageSync 返回 '' 表示 key 不存在，默认折叠；false 表示用户已展开
const collapsed = ref(_stored === false ? false : true)

function toggleCollapse() {
  collapsed.value = !collapsed.value
  uni.setStorageSync(COLLAPSE_KEY, collapsed.value)
}

function dotClass(dog: any): 'gray' | 'amber' | 'red' {
  const s = dog?.severity
  if (s === '严重') return 'red'
  if (s === '中等') return 'amber'
  return 'gray'
}

// 摘要栏圆点颜色取最高严重度
const summarySeverity = computed(() => {
  const severities = dogs.value.map((d: any) => d.severity)
  if (severities.includes('严重')) return 'red'
  if (severities.includes('中等')) return 'amber'
  return 'gray'
})

function onAction(dog: any) {
  const items: { icon: string; label: string; action: string }[] = [
    { icon: 'check_circle', label: '标记康复', action: 'recover' },
    { icon: 'medication', label: '开始用药', action: 'start_medication' },
  ]
  if (dog.treatmentStatus === '观察中') {
    items.splice(1, 0, { icon: 'medical_services', label: '开始治疗', action: 'update_status' })
  }
  emit('action', { type: 'show_sick_menu', data: { dog, items } })
}
</script>

<style lang="scss" scoped>
.card {
  position: relative; background: var(--card); border-radius: 16px;
  padding: 16px 16px 16px 18px; border-left: 3.5px solid transparent;
  box-shadow: var(--shadow); overflow: hidden;
  &::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; }
  > * { position: relative; z-index: 1; }
  &--red { border-left-color: var(--red); &::before { background: linear-gradient(135deg, var(--red-soft) 0%, transparent 40%); } }
  &--illness {
    border-left-color: rgba(224, 82, 82, 0.72);
    &::before { background: linear-gradient(135deg, rgba(224, 82, 82, 0.12) 0%, transparent 34%); }
  }
  &--overdue {
    border-left-color: var(--red);
    box-shadow: 0 4px 18px rgba(224, 82, 82, 0.14);
    &::before { background: linear-gradient(135deg, rgba(224, 82, 82, 0.18) 0%, transparent 40%); }
  }
}

.card-header { display: flex; align-items: flex-start; gap: 12px; }
.card-icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  &--red { background: var(--icon-red); }
}
.sick-icon { font-size: 20px; color: var(--red); }
.card-title-area { flex: 1; }
.card-name { display: block; font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--text-1); }
.card-sub { display: block; font-size: 12px; color: var(--text-2); margin-top: 1px; }

/* 折叠栏 */
.collapse-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 0; margin-top: 4px;
  border-top: 0.5px solid var(--card-dim);
  &:active { opacity: 0.7; }
}
.collapse-text { flex: 1; font-size: 12px; font-weight: 600; color: var(--text-3); }
.collapse-arrow { font-size: 18px; color: var(--text-3); }

/* 犬只列表 */
.sick-list { display: flex; flex-direction: column; gap: 0; margin-top: 10px; }
.sick-row {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 0;
  border-bottom: 0.5px solid var(--card-dim);
  transition: opacity 0.3s ease, transform 0.3s ease;
  &:last-child { border-bottom: none; }
  &--removing {
    opacity: 0;
    transform: translateX(-30%);
    pointer-events: none;
  }
}
.sick-row__name {
  font-size: 13px; font-weight: 700; color: var(--text-1);
  width: 40px; flex-shrink: 0;
}
.sick-row__info {
  flex: 1; display: flex; align-items: center; gap: 6px;
  flex-wrap: wrap; min-width: 0;
}
.sick-row__illness { font-size: 12px; font-weight: 700; color: var(--red); }
.sick-row__badge {
  font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px;
  &--amber { background: var(--amber-soft); color: var(--amber); }
}
.sick-row__days { font-size: 11px; color: var(--text-3); }
.sick-row__action {
  font-size: 11px; font-weight: 700; color: var(--red);
  padding: 2px 8px; border-radius: 4px;
  background: var(--red-soft);
  flex-shrink: 0;
  &:active { transform: scale(0.9); opacity: 0.8; }
}

/* 生病状态圆点 */
.sick-dot {
  width: 18px; height: 18px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  &::after { content: ''; width: 8px; height: 8px; border-radius: 50%; }
  &--gray { background: var(--card-dim); &::after { background: var(--text-3); } }
  &--amber { background: var(--amber-soft); &::after { background: var(--amber); } }
  &--red { background: var(--red-soft); &::after { background: var(--red); } }
}

/* 收起按钮 */
.collapse-footer {
  display: flex; align-items: center; justify-content: center; gap: 2px;
  padding: 8px 0 0;
  &:active { opacity: 0.6; }
}
.collapse-footer__text { font-size: 11px; color: var(--text-3); font-weight: 600; }
.collapse-footer__icon { font-size: 14px; color: var(--text-3); }
</style>
