<template>
  <view class="page">
    <BPageHeader title="默认参数" />

    <view class="settings-card">
      <view
        v-for="item in settingsItems"
        :key="item.key"
        class="settings-row"
        @click="startEdit(item)"
      >
        <view class="settings-row__left">
          <text class="settings-row__label">{{ item.label }}</text>
          <text v-if="item.unit" class="settings-row__unit">{{ item.unit }}</text>
        </view>
        <view class="settings-row__right">
          <text v-if="editingKey !== item.key" class="settings-row__value">{{ item.value }}</text>
          <input
            v-else
            :value="editingValue"
            :type="item.inputType || 'number'"
            class="settings-row__input"
            :focus="editingKey === item.key"
            @input="editingValue = $event.detail.value"
            @blur="finishEdit(item)"
            @confirm="finishEdit(item)"
          />
          <text class="material-icons-round settings-row__icon">edit</text>
        </view>
      </view>
    </view>

    <!-- 保存按钮 -->
    <view class="save-area">
      <button class="save-btn" :loading="saving" @click="saveAll">保存设置</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'

interface SettingItem {
  key: string
  label: string
  unit?: string
  value: string
  inputType?: string
}

const editingKey = ref('')
const editingValue = ref('')
const saving = ref(false)

const settingsItems = reactive<SettingItem[]>([
  { key: 'default_weaning_days', label: '默认断奶龄', unit: '天', value: '45' },
  { key: 'vaccine_interval_days', label: '疫苗间隔', unit: '天', value: '21' },
  { key: 'puppy_deworming_interval_days', label: '幼犬驱虫间隔', unit: '天', value: '14' },
  { key: 'adult_deworming_interval_days', label: '成犬驱虫间隔', unit: '天', value: '30' },
  { key: 'morning_summary_time', label: '晨间摘要时间', value: '07:00', inputType: 'text' },
])

const { run: getSettings } = useCloudCall<{ data: Record<string, any> }>('family-service', 'getSettings')
const { run: updateSettings } = useCloudCall('family-service', 'updateSettings', {
  successMessage: '已保存',
  showLoading: true,
})

function startEdit(item: SettingItem) {
  editingKey.value = item.key
  editingValue.value = item.value
}

function finishEdit(item: SettingItem) {
  if (editingValue.value !== '') {
    item.value = editingValue.value
  }
  editingKey.value = ''
}

async function saveAll() {
  saving.value = true
  try {
    const data: Record<string, any> = {}
    for (const item of settingsItems) {
      if (item.inputType === 'text') {
        data[item.key] = item.value
      } else {
        data[item.key] = parseInt(item.value, 10) || 0
      }
    }
    await updateSettings(data)
  } finally {
    saving.value = false
  }
}

async function loadSettings() {
  const res = await getSettings()
  if (res?.data) {
    for (const item of settingsItems) {
      if (res.data[item.key] != null) {
        item.value = String(res.data[item.key])
      }
    }
  }
}

onShow(() => loadSettings())
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

.settings-card {
  margin: 0 16px;
  background: var(--card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  transition: background 0.15s ease;
  &:active { background: var(--card-dim); }
  &:not(:last-child) { border-bottom: 0.5px solid var(--card-dim); }

  &__left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__label {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
  }

  &__unit {
    font-size: 12px;
    color: var(--text-3);
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__value {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--primary);
  }

  &__input {
    width: 80px;
    height: 36px;
    border: 1.5px solid var(--primary);
    border-radius: var(--radius-date);
    padding: 0 10px;
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
    background: var(--bg);
    text-align: right;
  }

  &__icon {
    font-family: 'Material Icons Round';
    font-size: 18px;
    color: var(--text-4);
  }
}

.save-area {
  padding: 24px 16px;
}

.save-btn {
  width: 100%;
  height: 50px;
  border-radius: var(--radius-btn);
  border: none;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  background: var(--primary);
  box-shadow: 0 4px 16px rgba(234, 62, 119, 0.25);
  transition: all 0.12s ease;
  &:active { transform: scale(0.97); opacity: 0.9; }
}
</style>
