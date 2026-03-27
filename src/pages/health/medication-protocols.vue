<template>
  <view class="protocols">
    <view class="protocols__list">
      <view v-for="(p, idx) in protocols" :key="idx" class="protocols__item">
        <view class="protocols__item-header">
          <text class="protocols__item-name">{{ p.name }}</text>
          <button size="mini" type="warn" @click="remove(idx)">删除</button>
        </view>
        <text class="protocols__item-drug">{{ p.drug_name }} · {{ p.duration_days }}天</text>
        <text v-if="p.notes" class="protocols__item-notes">{{ p.notes }}</text>
      </view>
    </view>

    <view v-if="protocols.length === 0 && !loading" class="protocols__empty">
      <text>暂无用药方案，点击下方添加</text>
    </view>

    <!-- 添加表单 -->
    <view class="protocols__add" v-if="showAdd">
      <view class="protocols__form">
        <input v-model="form.name" class="protocols__input" placeholder="方案名称（如：黄体酮保胎）" />
        <input v-model="form.drug_name" class="protocols__input" placeholder="药品名称" />
        <input v-model="form.duration_days" class="protocols__input" type="number" placeholder="疗程天数" />
        <input v-model="form.notes" class="protocols__input" placeholder="备注（选填）" />
        <view class="protocols__form-actions">
          <button class="protocols__btn" @click="showAdd = false">取消</button>
          <button class="protocols__btn protocols__btn--primary" :disabled="!canSave" @click="save">保存</button>
        </view>
      </view>
    </view>

    <view class="protocols__fab" @click="showAdd = true" v-if="!showAdd">
      <text>+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'

const protocols = ref<any[]>([])
const loading = ref(true)
const showAdd = ref(false)

const form = reactive({ name: '', drug_name: '', duration_days: '', notes: '' })

const canSave = computed(() => form.name && form.drug_name && parseInt(form.duration_days) > 0)

// 用药方案存储在 medication_protocols 集合（clientDB 直读直写，但这里用云对象简化）
// 由于 V1 简单，直接用 family settings 的扩展或独立集合都行
// 这里使用 clientDB 风格但走云对象包装
const { run: fetchProtocols } = useCloudCall<{ data: any[] }>('health-service', 'getMedicationProtocols')
const { run: addProtocol } = useCloudCall('health-service', 'addMedicationProtocol', { successMessage: '已添加' })
const { run: removeProtocol } = useCloudCall('health-service', 'removeMedicationProtocol', { successMessage: '已删除' })

async function load() {
  loading.value = true
  const res = await fetchProtocols()
  if (res?.data) protocols.value = res.data
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
        load()
      }
    }
  })
}

onShow(() => load())
</script>

<style lang="scss" scoped>
.protocols {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 60px;
}

.protocols__list {
  padding: 8px 16px;
}

.protocols__item {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 12px;
  margin-bottom: 6px;
  box-shadow: var(--shadow);
}

.protocols__item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.protocols__item-name {
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--text-1);
}

.protocols__item-drug {
  font-size: 13px;
  color: var(--text-2);
  display: block;
}

.protocols__item-notes {
  font-size: 12px;
  color: var(--text-3);
  display: block;
  margin-top: 2px;
}

.protocols__empty {
  text-align: center;
  padding: 40px;
  color: var(--text-3);
  font-size: 14px;
}

.protocols__add {
  padding: 8px 16px;
}

.protocols__form {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 12px;
  box-shadow: var(--shadow);
}

.protocols__input {
  border-bottom: 1px solid var(--card-dim);
  padding: 10px 0;
  font-size: 14px;
  color: var(--text-1);
}

.protocols__form-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.protocols__btn {
  flex: 1;
  height: 36px;
  border-radius: var(--radius-btn);
  font-size: 14px;
  background: var(--bg);
  color: var(--text-2);
  line-height: 36px;
  padding: 0;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.protocols__btn--primary {
  background: var(--primary);
  color: var(--card);
}

.protocols__btn[disabled] {
  opacity: 0.5;
}

.protocols__fab {
  position: fixed;
  right: 16px;
  bottom: 60px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--card);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: var(--shadow-fab);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}
</style>
