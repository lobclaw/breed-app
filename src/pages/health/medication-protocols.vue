<template>
  <view class="page">
    <BPageHeader title="用药方案">
      <template #right>
        <view class="header-add" @click="openSheet()">
          <text class="material-icons-round" style="font-size: 18px;">add</text>
          <text class="header-add__text">新建</text>
        </view>
      </template>
    </BPageHeader>

    <!-- 骨架屏：按真实卡片布局 -->
    <view v-if="loading" class="list">
      <view v-for="i in 3" :key="i" class="proto-card proto-card--skeleton">
        <view class="proto-card__header">
          <view class="sk sk-avatar" />
          <view class="sk sk-name" />
        </view>
        <view class="proto-card__tags">
          <view class="sk sk-tag" />
          <view class="sk sk-tag sk-tag--wide" />
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <BEmpty
      v-else-if="protocols.length === 0"
      icon="medication"
      title="暂无用药方案"
      description="添加常用的用药方案，方便快速录入"
      actionText="新建方案"
      @action="openSheet()"
    />

    <!-- 方案列表 -->
    <view v-else class="list">
      <view
        v-for="(p, idx) in protocols"
        :key="p._id"
        class="proto-card"
      >
        <view class="proto-card__header">
          <view class="proto-card__icon">
            <text class="material-icons-round" style="font-size: 18px; color: var(--plum);">medication</text>
          </view>
          <text class="proto-card__name">{{ p.name }}</text>
          <view class="proto-card__delete" @click="askDelete(idx)">
            <text class="material-icons-round" style="font-size: 18px; color: var(--red);">delete_outline</text>
          </view>
        </view>
        <view class="proto-card__tags">
          <view class="proto-tag proto-tag--plum">{{ p.drug_name }}</view>
          <view v-if="p.duration_days" class="proto-tag proto-tag--teal">{{ p.duration_days }}天疗程</view>
          <view v-if="protocolDosageText(p)" class="proto-tag proto-tag--dim">{{ protocolDosageText(p) }}</view>
          <view v-if="p.method" class="proto-tag proto-tag--dim">{{ p.method }}</view>
        </view>
        <text v-if="p.notes" class="proto-card__notes">{{ p.notes }}</text>
      </view>
    </view>

    <!-- 新建 BSheet -->
    <BSheet v-model:visible="showSheet" title="新建方案" height="auto">
      <view class="sheet-form">
        <view class="field-group">
          <text class="field-label">方案名称</text>
          <input v-model="form.name" class="form-input" placeholder="如：黄体酮保胎" :focus="showSheet" />
        </view>
        <view class="field-group">
          <text class="field-label">药品名称</text>
          <input v-model="form.drug_name" class="form-input" placeholder="药品名称" />
        </view>
        <view class="field-group">
          <text class="field-label">疗程天数 <text class="field-optional">（选填）</text></text>
          <input v-model="form.duration_days" class="form-input" type="number" placeholder="天数" />
        </view>
        <view class="field-group">
          <text class="field-label">备注 <text class="field-optional">（选填）</text></text>
          <input v-model="form.notes" class="form-input" placeholder="用法用量等" />
        </view>
        <view class="sheet-actions">
          <BSubmitButton :disabled="!canSave" @click="saveProtocol">保存方案</BSubmitButton>
        </view>
      </view>
    </BSheet>

    <!-- 删除确认 -->
    <BDeleteConfirm
      v-model:visible="showDeleteConfirm"
      title="删除方案"
      content="删除后不可恢复"
      @confirm="confirmDelete"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BDeleteConfirm from '@/components/layout/BDeleteConfirm.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import { localSyncRuntime } from '@/localdb/runtime'
import { useProtocolStore } from '@/stores/protocolStore'
import { formatMedicationDosage } from '@/utils/medicationDisplay'

const protocolStore = useProtocolStore()
const protocols = computed(() => protocolStore.list)
const loading = ref(protocolStore.list.length === 0)

const showSheet = ref(false)
const showDeleteConfirm = ref(false)
const deletingIndex = ref(-1)
const form = reactive({ name: '', drug_name: '', duration_days: '', notes: '' })

const canSave = computed(() => !!form.name.trim() && !!form.drug_name.trim())

const { run: addProtocol } = useCloudCall('health-service', 'addMedicationProtocol', { successMessage: '已添加' })
const { run: removeProtocol } = useCloudCall('health-service', 'removeMedicationProtocol', { successMode: 'silent' })

function openSheet() {
  form.name = ''
  form.drug_name = ''
  form.duration_days = ''
  form.notes = ''
  showSheet.value = true
}

function protocolDosageText(protocol: { dosage?: string | number | null; dosage_unit?: string | null }) {
  return formatMedicationDosage(protocol.dosage, protocol.dosage_unit)
}

async function saveProtocol() {
  if (!canSave.value) return
  showSheet.value = false

  const newP = {
    name: form.name.trim(),
    drug_name: form.drug_name.trim(),
    duration_days: form.duration_days ? parseInt(form.duration_days) : null,
    notes: form.notes.trim() || null,
  }

  // 乐观更新：立即加入列表（临时占位）
  const tempId = `tmp_${Date.now()}`
  protocolStore.list = [...protocolStore.list, { ...newP, _id: tempId } as any]

  addProtocol(newP).then(() => {
    // 后台静默刷新，替换临时数据
    protocolStore.fetchFromServer()
  }).catch(() => {
    protocolStore.list = protocolStore.list.filter((p: any) => p._id !== tempId)
    uni.showToast({ title: '添加失败，请重试', icon: 'none' })
  })
}

function askDelete(index: number) {
  deletingIndex.value = index
  showDeleteConfirm.value = true
}

function confirmDelete() {
  const index = deletingIndex.value
  if (index < 0) return
  const p = protocols.value[index]
  const prev = [...protocolStore.list]

  // 乐观删除
  protocolStore.list = protocolStore.list.filter((_: any, i: number) => i !== index)
  showDeleteConfirm.value = false

  removeProtocol(p._id).catch(() => {
    protocolStore.list = prev
    uni.showToast({ title: '删除失败，请重试', icon: 'none' })
  })
}

onShow(async () => {
  await localSyncRuntime.setActiveScope('settings-local')
  // stale-while-revalidate：有缓存立即显示，后台静默刷新
  await protocolStore.ensure()
  loading.value = false
})
</script>

<style lang="scss" scoped>
/* ==================== LIST ==================== */
.list {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ==================== PROTO CARD ==================== */
.proto-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px 16px;
  box-shadow: var(--shadow);

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__icon {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-icon);
    background: var(--icon-plum);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__name {
    flex: 1;
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__delete {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    &:active { background: var(--card-dim); }
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 4px;
  }

  &__notes {
    font-size: 12px;
    color: var(--text-3);
    margin-top: 6px;
    display: block;
    line-height: 1.4;
  }
}

/* ==================== PROTO TAGS ==================== */
.proto-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 20px;

  &--plum { background: var(--icon-plum); color: var(--plum); }
  &--teal { background: var(--teal-soft); color: var(--teal); }
  &--dim { background: var(--card-dim); color: var(--text-3); }
}

/* ==================== SKELETON ==================== */
.sk {
  border-radius: 4px;
  background: linear-gradient(90deg, var(--card-dim) 25%, var(--bg) 50%, var(--card-dim) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.sk-avatar { width: 32px; height: 32px; border-radius: var(--radius-icon); flex-shrink: 0; }
.sk-name { height: 14px; border-radius: 7px; flex: 1; }
.sk-tag { height: 20px; width: 60px; border-radius: 20px; }
.sk-tag--wide { width: 80px; }

.proto-card--skeleton .proto-card__header { margin-bottom: 10px; }
.proto-card--skeleton .proto-card__tags { gap: 6px; }

/* ==================== HEADER ADD ==================== */
.header-add {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--primary);
  padding: 6px 14px 6px 10px;
  border-radius: 20px;
  background: var(--primary-soft);
  transition: all 0.12s ease;
  &:active { transform: scale(0.92); background: var(--icon-rose); }
  &__text { font-size: 13px; font-weight: 700; }
}

/* ==================== SHEET FORM ==================== */
.sheet-form {
  padding: 0 var(--space-page) var(--space-page);
}

.field-group { margin-bottom: 16px; }

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 8px;
  display: block;
}

.field-optional {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-4);
}

.form-input {
  width: 100%;
  height: 44px;
  border: 1.5px solid var(--text-4);
  border-radius: var(--radius-date);
  padding: 0 14px;
  font-size: 15px;
  color: var(--text-1);
  background: var(--bg);
  box-sizing: border-box;
}

.sheet-actions { margin-top: 8px; }
</style>
