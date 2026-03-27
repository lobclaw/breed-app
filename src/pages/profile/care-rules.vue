<template>
  <view class="page">
    <BPageHeader title="护理规则" />

    <!-- 骨架屏 -->
    <view v-if="loading" style="padding: 0 16px;">
      <BSkeleton :rows="3" />
    </view>

    <!-- 规则列表 -->
    <view v-else-if="rules.length > 0" class="rule-list">
      <view v-for="rule in rules" :key="rule._id" class="rule-card">
        <view class="rule-card__header">
          <view class="rule-card__trigger-badge">
            <text class="material-icons-round" style="font-size: 16px; color: var(--amber);">bolt</text>
            <text class="rule-card__trigger">{{ rule.trigger }}</text>
          </view>
          <text
            class="material-icons-round rule-card__delete"
            @click="removeRule(rule._id)"
          >delete_outline</text>
        </view>
        <text class="rule-card__desc">{{ rule.description }}</text>
        <view v-if="rule.frequency" class="rule-card__meta">
          <text class="material-icons-round" style="font-size: 14px; color: var(--text-3);">repeat</text>
          <text class="rule-card__freq">{{ rule.frequency }}</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <BEmpty
      v-else
      icon="rule"
      title="暂无护理规则"
      description="添加自动触发的护理任务规则"
      actionText="+ 添加规则"
      @action="showAddForm = true"
    />

    <!-- 添加表单 -->
    <view v-if="showAddForm" class="form-area">
      <view class="form-card">
        <view class="form-group">
          <text class="form-label">触发条件 *</text>
          <input v-model="form.trigger" class="form-input" placeholder="如：幼犬出生后第3天" />
        </view>
        <view class="form-group">
          <text class="form-label">任务描述 *</text>
          <input v-model="form.description" class="form-input" placeholder="如：首次驱虫" />
        </view>
        <view class="form-group">
          <text class="form-label">频率 <text style="font-weight: 500; color: var(--text-3); font-size: 11px;">（选填）</text></text>
          <input v-model="form.frequency" class="form-input" placeholder="如：每14天重复" />
        </view>
        <view class="form-actions">
          <button class="form-btn form-btn--ghost" @click="cancelAdd">取消</button>
          <button class="form-btn form-btn--primary" :disabled="!form.trigger || !form.description" @click="addRule">保存</button>
        </view>
      </view>
    </view>

    <!-- FAB -->
    <view class="page-fab" v-if="!showAddForm" @click="showAddForm = true">
      <text class="material-icons-round" style="font-size: 28px; color: #fff;">add</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'

const rules = ref<any[]>([])
const loading = ref(true)
const showAddForm = ref(false)

const form = reactive({
  trigger: '',
  description: '',
  frequency: '',
})

const { run: fetchRules } = useCloudCall<{ data: any[] }>('family-service', 'getCareRules')
const { run: createRule } = useCloudCall('family-service', 'addCareRule', { successMessage: '已添加' })
const { run: deleteRule } = useCloudCall('family-service', 'removeCareRule', { successMessage: '已删除' })

async function load() {
  loading.value = true
  const res = await fetchRules()
  if (res?.data) rules.value = res.data
  loading.value = false
}

function cancelAdd() {
  showAddForm.value = false
  form.trigger = ''
  form.description = ''
  form.frequency = ''
}

async function addRule() {
  await createRule({
    trigger: form.trigger,
    description: form.description,
    frequency: form.frequency || null,
  })
  cancelAdd()
  load()
}

async function removeRule(id: string) {
  uni.showModal({
    title: '确认删除',
    content: '删除后不可恢复',
    success: async (res) => {
      if (res.confirm) {
        await deleteRule(id)
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
  padding-bottom: 100px;
}

/* ==================== RULE LIST ==================== */
.rule-list {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rule-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  &__trigger-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: var(--radius-tag);
    background: var(--amber-soft);
  }

  &__trigger {
    font-size: 12px;
    font-weight: 700;
    color: var(--amber);
  }

  &__delete {
    font-family: 'Material Icons Round';
    font-size: 20px;
    color: var(--red);
    padding: 4px;
    border-radius: 50%;
    transition: background 0.15s;
    &:active { background: var(--card-dim); }
  }

  &__desc {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-1);
    display: block;
    line-height: 1.4;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
  }

  &__freq {
    font-size: 12px;
    color: var(--text-3);
  }
}

/* ==================== FORM ==================== */
.form-area { padding: 16px; }

.form-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 20px 16px;
  box-shadow: var(--shadow);
}

.form-group {
  margin-bottom: 16px;
  &:last-of-type { margin-bottom: 0; }
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 8px;
  display: block;
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
  transition: border-color 0.2s;
  &:focus { border-color: var(--primary); }
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.form-btn {
  flex: 1;
  height: 44px;
  border-radius: var(--radius-btn);
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  line-height: 44px;
  padding: 0;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.94); }

  &--primary { background: var(--primary); color: #fff; }
  &--ghost { background: transparent; border: 1.5px solid var(--text-4); color: var(--text-2); }
  &[disabled] { opacity: 0.5; }
}

/* ==================== FAB ==================== */
.page-fab {
  position: fixed;
  bottom: 40px;
  right: 20px;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-fab);
  z-index: 50;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  &:active { transform: scale(0.88); box-shadow: 0 2px 8px rgba(234, 62, 119, 0.2); }
}
</style>
