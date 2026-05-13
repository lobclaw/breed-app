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
        @click="openEditSheet(p)"
      >
        <view class="proto-card__header">
          <view class="proto-card__icon">
            <text class="material-icons-round" style="font-size: 18px; color: var(--plum);">medication</text>
          </view>
          <view class="proto-card__title-block">
            <text class="proto-card__name">{{ p.name }}</text>
            <text class="proto-card__drug">{{ p.drug_name }}</text>
          </view>
          <view class="proto-card__actions">
            <view class="proto-card__action" @click.stop="openEditSheet(p)">
              <text class="material-icons-round" style="font-size: 17px; color: var(--text-3);">edit</text>
            </view>
            <view class="proto-card__action" @click.stop="askDelete(idx)">
              <text class="material-icons-round" style="font-size: 18px; color: var(--red);">delete_outline</text>
            </view>
          </view>
        </view>
        <view class="proto-card__tags">
          <view v-if="protocolDosageText(p)" class="proto-tag proto-tag--dim">{{ protocolDosageText(p) }}</view>
          <view v-if="protocolMethodText(p)" class="proto-tag proto-tag--dim">{{ protocolMethodText(p) }}</view>
          <view v-if="protocolFrequencyText(p)" class="proto-tag proto-tag--teal">{{ protocolFrequencyText(p) }}</view>
          <view v-if="p.duration_days" class="proto-tag proto-tag--dim">{{ p.duration_days }}天疗程</view>
        </view>
        <text v-if="p.notes" class="proto-card__notes">{{ p.notes }}</text>
      </view>
    </view>

    <!-- 新建 BSheet -->
    <BSheet v-model:visible="showSheet" :title="sheetTitle" height="auto">
      <view class="form-sheet">
        <view class="form-sheet__field">
          <text class="form-sheet__label">方案名称</text>
          <input v-model="form.name" class="form-sheet__input" placeholder="如：黄体酮保胎" :focus="showSheet" />
        </view>
        <view class="form-sheet__field">
          <text class="form-sheet__label">药品名称</text>
          <input v-model="form.drug_name" class="form-sheet__input" placeholder="药品名称" />
        </view>
        <view class="form-sheet__field">
          <text class="form-sheet__label">剂量</text>
          <view class="protocol-dosage">
            <input v-model="form.dosage" class="form-sheet__input protocol-dosage__input" type="digit" placeholder="剂量" />
            <view class="pill-select protocol-dosage__units">
              <view
                v-for="unit in dosageUnits"
                :key="unit.value"
                class="pill-select__item protocol-pill"
                :class="{
                  'pill-select__item--active': form.dosage_unit === unit.value,
                  'pill-select__item--disabled': isDosageUnitDisabled(unit.value),
                }"
                @click="selectDosageUnit(unit.value)"
              >
                <text>{{ unit.label }}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="form-sheet__field">
          <text class="form-sheet__label">给药方式</text>
          <view class="pill-select">
            <view
              v-for="item in methods"
              :key="item.value"
              class="pill-select__item protocol-pill"
              :class="{ 'pill-select__item--active': form.method === item.value }"
              @click="selectMethod(item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>
        </view>
        <view class="form-sheet__field">
          <text class="form-sheet__label">频率</text>
          <view class="pill-select">
            <view
              v-for="item in frequencies"
              :key="item.value"
              class="pill-select__item protocol-pill"
              :class="{ 'pill-select__item--active': form.frequency === item.value }"
              @click="form.frequency = item.value"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>
        </view>
        <view class="form-sheet__field">
          <text class="form-sheet__label">疗程天数（选填）</text>
          <input v-model="form.duration_days" class="form-sheet__input" type="number" placeholder="天数" />
        </view>
        <view class="form-sheet__field">
          <text class="form-sheet__label">注意事项（选填）</text>
          <input v-model="form.notes" class="form-sheet__input" placeholder="如：饭后服用、过敏慎用、观察食欲" />
        </view>
      </view>
      <template #footer>
        <view class="form-sheet__footer">
          <button class="form-sheet__submit" :class="{ 'form-sheet__submit--inactive': !canSave }" @click="saveProtocol">{{ submitText }}</button>
        </view>
      </template>
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
import { useAuth } from '@/composables/useAuth'
import { usePageSync } from '@/composables/usePageSync'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BDeleteConfirm from '@/components/layout/BDeleteConfirm.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import { localSyncRuntime } from '@/localdb/runtime'
import { useProtocolStore, type MedicationProtocol } from '@/stores/protocolStore'
import { formatMedicationDosage, formatMedicationFrequency, formatMedicationMethod } from '@/utils/medicationDisplay'

const { currentFamily } = useAuth()
const protocolStore = useProtocolStore()
const protocols = computed(() => protocolStore.list)
const loading = ref(protocolStore.list.length === 0)
usePageSync({ routePath: 'pages/health/medication-protocols' })

const showSheet = ref(false)
const showDeleteConfirm = ref(false)
const deletingIndex = ref(-1)
const editingId = ref('')
const form = reactive({
  name: '',
  drug_name: '',
  dosage: '',
  dosage_unit: 'mg',
  method: 'oral',
  frequency: 'once_daily',
  duration_days: '',
  notes: '',
})

const dosageUnits = [
  { label: '毫升', value: 'ml' },
  { label: '毫克', value: 'mg' },
  { label: '片', value: 'tablet' },
]

const methods = [
  { label: '口服', value: 'oral' },
  { label: '注射', value: 'injection' },
]

const frequencies = [
  { label: '每日1次', value: 'once_daily' },
  { label: '每日2次', value: 'twice_daily' },
  { label: '每日3次', value: 'three_daily' },
]

const canSave = computed(() => !!form.name.trim() && !!form.drug_name.trim() && !!form.dosage)
const isEditing = computed(() => !!editingId.value)
const sheetTitle = computed(() => isEditing.value ? '编辑方案' : '新建方案')
const submitText = computed(() => isEditing.value ? '保存修改' : '保存方案')

function openSheet() {
  editingId.value = ''
  form.name = ''
  form.drug_name = ''
  form.dosage = ''
  form.dosage_unit = 'mg'
  form.method = 'oral'
  form.frequency = 'once_daily'
  form.duration_days = ''
  form.notes = ''
  showSheet.value = true
}

function normalizeFormFrequency(value: MedicationProtocol['frequency']) {
  const rawValue = String(value || '').trim()
  if (rawValue === '2') return 'twice_daily'
  if (rawValue === '3') return 'three_daily'
  if (rawValue === 'once_daily' || rawValue === 'twice_daily' || rawValue === 'three_daily') return rawValue
  return 'once_daily'
}

function openEditSheet(protocol: MedicationProtocol) {
  editingId.value = protocol._id
  form.name = protocol.name || ''
  form.drug_name = protocol.drug_name || ''
  form.dosage = protocol.dosage === null || protocol.dosage === undefined ? '' : String(protocol.dosage)
  form.method = protocol.method || 'oral'
  form.dosage_unit = protocol.dosage_unit || (form.method === 'injection' ? 'ml' : 'mg')
  form.frequency = normalizeFormFrequency(protocol.frequency)
  form.duration_days = protocol.duration_days ? String(protocol.duration_days) : ''
  form.notes = protocol.notes || ''
  showSheet.value = true
}

function isDosageUnitDisabled(unitValue: string) {
  return form.method === 'injection' && unitValue !== 'ml'
}

function selectDosageUnit(unitValue: string) {
  if (isDosageUnitDisabled(unitValue)) return
  form.dosage_unit = unitValue
}

function selectMethod(methodValue: string) {
  form.method = methodValue
  if (methodValue === 'injection') form.dosage_unit = 'ml'
}

function protocolDosageText(protocol: { dosage?: string | number | null; dosage_unit?: string | null }) {
  return formatMedicationDosage(protocol.dosage, protocol.dosage_unit)
}

function protocolFrequencyText(protocol: { frequency?: string | number | null }) {
  return formatMedicationFrequency(protocol.frequency)
}

function protocolMethodText(protocol: { method?: string | null }) {
  return formatMedicationMethod(protocol.method)
}

async function saveProtocol() {
  if (!canSave.value) {
    uni.showToast({ title: '请补全必填信息', icon: 'none' })
    return
  }
  showSheet.value = false

  const newP = {
    name: form.name.trim(),
    drug_name: form.drug_name.trim(),
    dosage: form.dosage || null,
    dosage_unit: form.dosage_unit || null,
    method: form.method || null,
    frequency: form.frequency || null,
    duration_days: form.duration_days ? parseInt(form.duration_days) : null,
    notes: form.notes.trim() || null,
  }

  try {
    if (editingId.value) {
      await localSyncRuntime.updateMedicationProtocolLocally(currentFamily.value?._id || '', editingId.value, newP)
    } else {
      await localSyncRuntime.addMedicationProtocolLocally(currentFamily.value?._id || '', newP)
    }
    await protocolStore.reload()
  } catch {
    uni.showToast({ title: isEditing.value ? '保存失败，请重试' : '添加失败，请重试', icon: 'none' })
  }
}

function askDelete(index: number) {
  deletingIndex.value = index
  showDeleteConfirm.value = true
}

function confirmDelete() {
  const index = deletingIndex.value
  if (index < 0) return
  const p = protocols.value[index]
  showDeleteConfirm.value = false
  localSyncRuntime.removeMedicationProtocolLocally(currentFamily.value?._id || '', p._id).then(() => {
    protocolStore.reload()
  }).catch(() => {
    uni.showToast({ title: '删除失败，请重试', icon: 'none' })
  })
}

onShow(async () => {
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

  &__title-block {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  &__name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
    line-height: 1.25;
  }

  &__drug {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-3);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  &__action {
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

.protocol-dosage {
  display: flex;
  gap: 10px;
}

.protocol-dosage__input {
  flex: 1;
  min-width: 0;
}

.protocol-dosage__units {
  flex: 0 0 auto;
  align-items: center;
}

.protocol-pill {
  min-height: 34px;
  box-sizing: border-box;
  padding: 8px 14px;
}

.pill-select__item--disabled {
  opacity: 0.4;
}
</style>
