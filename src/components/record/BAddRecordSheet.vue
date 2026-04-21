<template>
  <BSheet v-model:visible="sheetVisible" :title="title" :height="height">
    <view class="add-record-list">
      <view class="add-record-context">
        <view class="add-record-context__badge">
          <BEntityIcon class="add-record-context__badge-icon" :size="18" color="#fff" />
        </view>
        <view class="add-record-context__body">
          <view class="add-record-context__title-row">
            <text class="add-record-context__title">{{ contextTitle || '当前犬只' }}</text>
            <text v-if="contextStatus" class="add-record-context__status">{{ contextStatus }}</text>
          </view>
          <text class="add-record-context__sub">{{ contextSub }}</text>
        </view>
      </view>

      <view
        v-for="group in groups"
        :key="group.key"
        class="add-record-group"
      >
        <view class="add-record-group__head">
          <view class="add-record-group__meta">
            <text class="add-record-group__title">{{ group.title }}</text>
            <text class="add-record-group__count">{{ group.items.length }}项</text>
          </view>
          <text v-if="group.hint" class="add-record-group__hint">{{ group.hint }}</text>
        </view>
        <view class="add-record-group__body">
          <view
            v-for="item in group.items"
            :key="item.page"
            class="add-record-item"
            :class="{ 'add-record-item--full': item.layout === 'full' }"
            @click="emit('select', item)"
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BSheet from '@/components/layout/BSheet.vue'
import type { AddRecordGroup, AddRecordItem } from '@/utils/addRecordSheet'

const props = withDefaults(defineProps<{
  visible: boolean
  title?: string
  height?: string
  contextTitle?: string
  contextStatus?: string
  contextSub: string
  groups: AddRecordGroup[]
}>(), {
  title: '添加记录',
  height: '78vh',
  contextTitle: '',
  contextStatus: '',
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  select: [item: AddRecordItem]
}>()

const sheetVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})
</script>

<style lang="scss" scoped>
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
