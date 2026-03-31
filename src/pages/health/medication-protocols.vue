<template>
  <view class="page">
    <!-- 顶栏 -->
    <BPageHeader title="用药方案">
      <template #right>
        <view v-if="!showAdd" class="header-add" @click="showAdd = true">
          <text class="material-icons-round" style="font-size: 18px;">add</text>
          <text class="header-add__text">新建</text>
        </view>
      </template>
    </BPageHeader>

    <!-- 骨架屏 -->
    <BSkeleton v-if="loading" :rows="3" />

    <!-- 空状态 -->
    <BEmpty
      v-if="!loading && protocols.length === 0 && !showAdd"
      icon="medication"
      title="暂无用药方案"
      description="添加常用的用药方案，方便快速录入"
      actionText="新建方案"
      @action="showAdd = true"
    />

    <!-- 方案列表 -->
    <view class="list" v-if="protocols.length > 0">
      <BCard
        v-for="(p, idx) in protocols"
        :key="idx"
        color="plum"
        :pressable="false"
      >
        <view class="protocol-header">
          <view class="protocol-title-row">
            <view class="protocol-icon">
              <text class="material-icons-round" style="font-size: 18px; color: var(--plum);">medication</text>
            </view>
            <text class="protocol-name">{{ p.name }}</text>
          </view>
          <view class="protocol-delete" @click="remove(idx)">
            <text class="material-icons-round" style="font-size: 16px;">delete_outline</text>
          </view>
        </view>
        <view class="protocol-body">
          <view class="protocol-info-row">
            <BTag :label="p.drug_name" color="plum" />
            <BTag :label="`${p.duration_days}天疗程`" color="teal" />
          </view>
          <text v-if="p.notes" class="protocol-notes">{{ p.notes }}</text>
        </view>
      </BCard>
    </view>

    <!-- 添加表单 -->
    <view v-if="showAdd" class="form-area">
      <view class="form-card">
        <view class="form-title-row">
          <view class="form-icon">
            <text class="material-icons-round" style="font-size: 18px; color: var(--primary);">add_circle</text>
          </view>
          <text class="form-title">新建方案</text>
        </view>

        <view class="form-field">
          <text class="field-label">方案名称</text>
          <input v-model="form.name" class="field-input" placeholder="如：黄体酮保胎" />
        </view>

        <view class="form-field">
          <text class="field-label">药品名称</text>
          <input v-model="form.drug_name" class="field-input" placeholder="药品名称" />
        </view>

        <view class="form-field">
          <text class="field-label">疗程天数</text>
          <input v-model="form.duration_days" class="field-input" type="number" placeholder="天数" />
        </view>

        <view class="form-field">
          <text class="field-label">备注 <text class="optional">（选填）</text></text>
          <input v-model="form.notes" class="field-input" placeholder="用法用量等备注" />
        </view>

        <view class="form-actions">
          <BButton variant="ghost" @click="showAdd = false" style="flex: 1;">取消</BButton>
          <BButton color="primary" :disabled="!canSave" @click="save" style="flex: 1;">保存</BButton>
        </view>
      </view>
    </view>

    <!-- FAB 按钮 -->
    <view v-if="!showAdd && protocols.length > 0" class="fab" @click="showAdd = true">
      <text class="material-icons-round" style="font-size: 24px; color: #fff;">add</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BCard from '@/components/base/BCard.vue'
import BTag from '@/components/base/BTag.vue'
import BButton from '@/components/base/BButton.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'

import { useProtocolStore } from '@/stores/protocolStore'

const protocolStore = useProtocolStore()
const protocols = computed(() => protocolStore.list)
const loading = ref(protocolStore.list.length === 0)
const showAdd = ref(false)

const form = reactive({ name: '', drug_name: '', duration_days: '', notes: '' })

const canSave = computed(() => form.name && form.drug_name && parseInt(form.duration_days) > 0)

const { run: addProtocol } = useCloudCall('health-service', 'addMedicationProtocol', { successMessage: '已添加' })
const { run: removeProtocol } = useCloudCall('health-service', 'removeMedicationProtocol', { successMessage: '已删除' })

async function load() {
  if (protocolStore.list.length === 0) loading.value = true
  await protocolStore.fetchFromServer()
  loading.value = false
}

async function save() {
  await addProtocol({
    name: form.name,
    drug_name: form.drug_name,
    duration_days: parseInt(form.duration_days),
    notes: form.notes || null,
  })
  form.name = ''
  form.drug_name = ''
  form.duration_days = ''
  form.notes = ''
  showAdd.value = false
  load()
}

async function remove(idx: number) {
  uni.showModal({
    title: '确认删除',
    content: '删除后不可恢复',
    success: async (res) => {
      if (res.confirm) {
        const p = protocols.value[idx]
        await removeProtocol(p._id)
        try { uni.removeStorageSync(CACHE_KEY) } catch { /* ignore */ }
        load()
      }
    }
  })
}

onShow(() => load())
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

/* 列表 */
.list {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);
}

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

  &__text {
    font-size: 13px;
    font-weight: 700;
  }
}

/* 方案卡片 */
.protocol-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.protocol-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.protocol-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-icon);
  background: var(--icon-plum);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.protocol-name {
  font-size: 15px;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--text-1);
}

.protocol-delete {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-4);
  transition: all 0.12s ease;
  &:active {
    transform: scale(0.85);
    color: var(--red);
    background: var(--red-soft);
  }
}

.protocol-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.protocol-info-row {
  display: flex;
  gap: var(--space-tag-gap);
  flex-wrap: wrap;
}

.protocol-notes {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.4;
}

/* 表单 */
.form-area {
  padding: 0 var(--space-page);
}

.form-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: var(--space-card);
  box-shadow: var(--shadow);
}

.form-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.form-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-icon);
  background: var(--icon-rose);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.form-title {
  font-size: 15px;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--text-1);
}

.form-field {
  margin-bottom: 14px;
}

.field-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.optional {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
}

.field-input {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  border: 1.5px solid var(--text-4);
  background: var(--card);
  padding: 0 14px;
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--primary);
  }
}

.form-actions {
  display: flex;
  gap: var(--space-btn-gap);
  margin-top: 4px;
}

/* FAB */
.fab {
  position: fixed;
  right: 20px;
  bottom: calc(20px + env(safe-area-inset-bottom));
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ea3e77, #e89b3e);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-fab);
  transition: transform 0.15s ease;
  &:active {
    transform: scale(0.88);
    box-shadow: 0 2px 8px rgba(234, 62, 119, 0.2);
  }
}
</style>
