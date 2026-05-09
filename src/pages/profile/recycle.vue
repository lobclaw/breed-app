<template>
  <view class="page">
    <BPageHeader title="回收站" />

    <!-- 骨架屏 -->
    <view v-if="loading" style="padding: 0 16px;">
      <BSkeleton :rows="3" />
    </view>

    <!-- 已删除项目列表 -->
    <view v-else-if="deletedItems.length > 0" class="recycle-list">
      <view v-for="item in deletedItems" :key="item._id" class="recycle-card">
        <view class="recycle-card__left">
          <view class="recycle-card__icon" :class="`recycle-card__icon--${item.type}`">
            <text class="material-icons-round" style="font-size: 20px; color: #fff;">{{ getIcon(item.type) }}</text>
          </view>
          <view class="recycle-card__info">
            <text class="recycle-card__name">{{ item.name }}</text>
            <view class="recycle-card__summary-row">
              <text class="recycle-card__type">{{ item.type_label }}</text>
              <text v-if="item.summary" class="recycle-card__summary">{{ item.summary }}</text>
            </view>
            <view class="recycle-card__meta">
              <text class="recycle-card__date">删除于 {{ formatDate(item.deleted_at) }}</text>
              <text class="recycle-card__remain" :class="{ 'recycle-card__remain--urgent': item.days_remaining <= 3 }">
                {{ item.days_remaining }}天后永久删除
              </text>
            </view>
          </view>
        </view>
        <view class="recycle-card__actions">
          <view class="recycle-card__btn recycle-card__btn--restore" @click="restoreItem(item)">
            <text class="material-icons-round" style="font-size: 18px; color: var(--green);">restore</text>
          </view>
          <view class="recycle-card__btn recycle-card__btn--delete" @click="permanentDelete(item)">
            <text class="material-icons-round" style="font-size: 18px; color: var(--red);">delete_forever</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <BEmpty
      v-else
      icon="delete_sweep"
      title="回收站为空"
      description="被删除的犬只、财务、代理人与用药方案会在这里保留30天"
    />

    <BModal
      v-model:visible="showConfirmModal"
      :title="confirmTitle"
      :content="confirmContent"
      :confirmText="confirmText"
      :danger="confirmDanger"
      @confirm="handleConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import { listLocalRecycleItems } from '@/localdb/domain-repository'
import { localSyncRuntime } from '@/localdb/runtime'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BModal from '@/components/layout/BModal.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import { useProtocolStore } from '@/stores/protocolStore'
import type { RecycleBinItem, RecycleItemType } from '@/types/recycle'
import { getBeijingDateParts } from '@/utils/date'

const protocolStore = useProtocolStore()
const { currentFamily } = useAuth()
const deletedItems = ref<RecycleBinItem[]>([])
const loading = ref(true)
const showConfirmModal = ref(false)
const confirmTitle = ref('')
const confirmContent = ref('')
const confirmText = ref('确定')
const confirmDanger = ref(false)
let confirmAction: (() => Promise<void>) | null = null
usePageSync({ routePath: 'pages/profile/recycle' })

function getIcon(type: RecycleItemType): string {
  const map: Record<RecycleItemType, string> = {
    dog: 'pets',
    expense: 'receipt_long',
    income: 'payments',
    agent: 'support_agent',
    medication_protocol: 'medication',
  }
  return map[type] || 'description'
}

function formatDate(ts: number): string {
  if (!ts) return ''
  const d = getBeijingDateParts(ts)
  return `${d.month}月${d.day}日`
}

async function syncRecycleSideEffects(type: RecycleItemType) {
  if (type === 'medication_protocol') {
    await protocolStore.reload()
  }
}

async function load() {
  loading.value = true
  const familyId = currentFamily.value?._id || ''
  if (!familyId) {
    deletedItems.value = []
    loading.value = false
    return
  }
  localSyncRuntime.setCurrentFamilyId(familyId)
  deletedItems.value = await listLocalRecycleItems(familyId)
  loading.value = false
}

async function restoreItem(item: RecycleBinItem) {
  confirmTitle.value = '确认恢复'
  confirmContent.value = `恢复「${item.name}」？`
  confirmText.value = '恢复'
  confirmDanger.value = false
  confirmAction = async () => {
    await localSyncRuntime.restoreRecycleItemLocally(currentFamily.value?._id || '', item.type, item._id)
    await syncRecycleSideEffects(item.type)
    deletedItems.value = deletedItems.value.filter(current => current._id !== item._id)
  }
  showConfirmModal.value = true
}

async function permanentDelete(item: RecycleBinItem) {
  confirmTitle.value = '永久删除'
  confirmContent.value = `「${item.name}」将被永久删除，无法恢复`
  confirmText.value = '永久删除'
  confirmDanger.value = true
  confirmAction = async () => {
    await localSyncRuntime.permanentDeleteRecycleItemLocally(currentFamily.value?._id || '', item.type, item._id)
    await syncRecycleSideEffects(item.type)
    deletedItems.value = deletedItems.value.filter(current => current._id !== item._id)
  }
  showConfirmModal.value = true
}

async function handleConfirm() {
  if (confirmAction) {
    await confirmAction()
  }
}

onShow(() => load())
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

/* ==================== RECYCLE LIST ==================== */
.recycle-list {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recycle-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--card);
  border-radius: var(--radius-row);
  padding: 14px 12px 14px 14px;
  box-shadow: var(--shadow);

  &__left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  &__icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-icon);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &--dog { background: var(--amber); }
    &--expense { background: var(--red); }
    &--income { background: var(--green); }
    &--agent { background: var(--teal); }
    &--medication_protocol { background: var(--plum); }
  }

  &__info { flex: 1; min-width: 0; }

  &__name {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__summary-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    min-width: 0;
  }

  &__type {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    color: var(--text-2);
    padding: 2px 6px;
    border-radius: 999px;
    background: var(--card-dim);
  }

  &__summary {
    min-width: 0;
    font-size: 12px;
    color: var(--text-3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }

  &__date {
    font-size: 11px;
    color: var(--text-3);
  }

  &__remain {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    padding: 1px 6px;
    border-radius: var(--radius-tag);
    background: var(--card-dim);

    &--urgent {
      color: var(--red);
      background: var(--red-soft);
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  &__btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease;
    &:active { background: var(--card-dim); }
  }
}
</style>
