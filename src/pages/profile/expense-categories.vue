<template>
  <view class="page">
    <BPageHeader title="支出分类管理" />

    <!-- 骨架屏 -->
    <view v-if="loading" style="padding: 0 16px;">
      <BSkeleton :rows="3" />
    </view>

    <!-- 分类列表 -->
    <view v-else-if="categories.length > 0" class="cat-list">
      <view v-for="cat in categories" :key="cat._id || cat.name" class="cat-card">
        <view class="cat-card__left">
          <view class="cat-card__icon-box" :style="{ background: cat.color || 'var(--amber-soft)' }">
            <text class="material-icons-round" style="font-size: 20px;" :style="{ color: cat.icon_color || 'var(--amber)' }">{{ cat.icon || 'label' }}</text>
          </view>
          <text class="cat-card__name">{{ cat.name }}</text>
          <text v-if="cat.is_default" class="material-icons-round cat-card__lock">lock</text>
        </view>
        <view class="cat-card__actions" v-if="!cat.is_default">
          <text class="material-icons-round cat-card__edit" @click="startEdit(cat)">edit</text>
          <text class="material-icons-round cat-card__delete" @click="removeCat(cat._id)">delete_outline</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <BEmpty
      v-else
      icon="category"
      title="暂无支出分类"
      description="添加自定义支出分类"
      actionText="+ 添加分类"
      @action="showAddForm = true"
    />

    <!-- 添加/编辑表单 -->
    <view v-if="showAddForm" class="form-area">
      <view class="form-card">
        <view class="form-group">
          <text class="form-label">分类名称 *</text>
          <input v-model="form.name" class="form-input" placeholder="如：玩具、美容" />
        </view>
        <view class="form-group">
          <text class="form-label">图标</text>
          <view class="icon-grid">
            <view
              v-for="ic in iconOptions"
              :key="ic"
              class="icon-grid__item"
              :class="{ 'icon-grid__item--active': form.icon === ic }"
              @click="form.icon = ic"
            >
              <text class="material-icons-round" style="font-size: 22px;">{{ ic }}</text>
            </view>
          </view>
        </view>
        <view class="form-actions">
          <button class="form-btn form-btn--ghost" @click="cancelForm">取消</button>
          <button class="form-btn form-btn--primary" :disabled="!form.name" @click="saveCat">{{ editingId ? '更新' : '保存' }}</button>
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

interface ExpenseCategory {
  _id: string
  name: string
  icon?: string
  icon_color?: string
  color?: string
  is_default?: boolean
}

const categories = ref<ExpenseCategory[]>([])
const loading = ref(true)
const showAddForm = ref(false)
const editingId = ref('')

const iconOptions = [
  'restaurant', 'medication', 'vaccines', 'local_hospital',
  'pets', 'home', 'shopping_bag', 'build',
  'directions_car', 'cleaning_services', 'content_cut', 'spa',
]

const form = reactive({
  name: '',
  icon: 'label',
})

const { run: fetchCategories } = useCloudCall<{ data: ExpenseCategory[] }>('finance-service', 'getExpenseCategories')
const { run: addCategory } = useCloudCall('finance-service', 'addExpenseCategory', { successMessage: '已添加' })
const { run: updateCategory } = useCloudCall('finance-service', 'updateExpenseCategory', { successMessage: '已更新' })
const { run: deleteCategory } = useCloudCall('finance-service', 'removeExpenseCategory', { successMessage: '已删除' })

async function load() {
  loading.value = true
  const res = await fetchCategories()
  if (res?.data) categories.value = res.data
  loading.value = false
}

function startEdit(cat: ExpenseCategory) {
  editingId.value = cat._id
  form.name = cat.name
  form.icon = cat.icon || 'label'
  showAddForm.value = true
}

function cancelForm() {
  showAddForm.value = false
  editingId.value = ''
  form.name = ''
  form.icon = 'label'
}

async function saveCat() {
  if (editingId.value) {
    await updateCategory(editingId.value, { name: form.name, icon: form.icon })
  } else {
    await addCategory({ name: form.name, icon: form.icon })
  }
  cancelForm()
  load()
}

async function removeCat(id: string) {
  uni.showModal({
    title: '确认删除',
    content: '删除后不可恢复',
    success: async (res) => {
      if (res.confirm) {
        await deleteCategory(id)
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

/* ==================== CATEGORY LIST ==================== */
.cat-list {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cat-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--card);
  border-radius: var(--radius-row);
  padding: 12px 14px;
  box-shadow: var(--shadow);

  &__left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__icon-box {
    width: 38px;
    height: 38px;
    border-radius: var(--radius-icon);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
  }

  &__lock {
    font-family: 'Material Icons Round';
    font-size: 14px;
    color: var(--text-4);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__edit {
    font-family: 'Material Icons Round';
    font-size: 20px;
    color: var(--text-3);
    padding: 4px;
    border-radius: 50%;
    transition: background 0.15s;
    &:active { background: var(--card-dim); }
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
}

/* ==================== ICON GRID ==================== */
.icon-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  margin-top: 8px;

  &__item {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    border-radius: var(--radius-icon);
    background: var(--bg);
    color: var(--text-3);
    transition: all 0.15s ease;
    &:active { transform: scale(0.9); }

    &--active {
      background: var(--primary-soft);
      color: var(--primary);
      border: 1.5px solid var(--primary);
    }
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
