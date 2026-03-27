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
      description="被删除的犬只和记录会在这里保留30天"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'

interface DeletedItem {
  _id: string
  name: string
  type: 'dog' | 'record' | 'sale'
  deleted_at: number
  days_remaining: number
}

const deletedItems = ref<DeletedItem[]>([])
const loading = ref(true)

const { run: fetchDeleted } = useCloudCall<{ data: DeletedItem[] }>('family-service', 'getDeletedItems')
const { run: doRestore } = useCloudCall('family-service', 'restoreItem', { successMessage: '已恢复' })
const { run: doDelete } = useCloudCall('family-service', 'permanentDeleteItem', { successMessage: '已永久删除' })

function getIcon(type: string): string {
  const map: Record<string, string> = { dog: 'pets', record: 'description', sale: 'receipt_long' }
  return map[type] || 'description'
}

function formatDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

async function load() {
  loading.value = true
  const res = await fetchDeleted()
  if (res?.data) deletedItems.value = res.data
  loading.value = false
}

async function restoreItem(item: DeletedItem) {
  uni.showModal({
    title: '确认恢复',
    content: `恢复「${item.name}」？`,
    success: async (res) => {
      if (res.confirm) {
        await doRestore({ id: item._id, type: item.type })
        load()
      }
    },
  })
}

async function permanentDelete(item: DeletedItem) {
  uni.showModal({
    title: '永久删除',
    content: `「${item.name}」将被永久删除，无法恢复`,
    confirmColor: '#e05252',
    success: async (res) => {
      if (res.confirm) {
        await doDelete({ id: item._id, type: item.type })
        load()
      }
    },
  })
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
    &--record { background: var(--blue); }
    &--sale { background: var(--green); }
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

  &__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
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
