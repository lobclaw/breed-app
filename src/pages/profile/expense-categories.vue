<template>
  <view class="page">
    <BPageHeader title="支出分类管理">
      <template #right>
        <view v-if="!showAddForm" class="header-add" @click="showAddForm = true">
          <text class="material-icons-round" style="font-size: 18px;">add</text>
          <text class="header-add__text">新建</text>
        </view>
      </template>
    </BPageHeader>

    <!-- 骨架屏 -->
    <view v-if="loading" style="padding: 0 16px;">
      <BSkeleton :rows="3" />
    </view>

    <!-- 分类列表 -->
    <view v-else-if="categories.length > 0" class="cat-list">
      <view v-for="cat in categories" :key="cat._id || cat.name" class="cat-card">
        <view class="cat-card__left">
          <text class="cat-card__drag">≡</text>
          <text class="cat-card__name">{{ cat.name }}</text>
        </view>
        <view class="cat-card__actions">
          <text class="material-icons-round cat-card__edit" @click="startEdit(cat)">edit</text>
          <text
            class="material-icons-round cat-card__delete"
            :class="{ 'cat-card__delete--disabled': cat.is_default }"
            @click="!cat.is_default && removeCat(cat._id)"
          >delete_outline</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <BEmpty
      v-else
      icon="category"
      title="暂无支出分类"
      description="添加自定义支出分类"
      actionText="新建分类"
      @action="showAddForm = true"
    />

    <!-- 提示文字 -->
    <text v-if="!loading && categories.length > 0" class="hint-text">预设分类不可删除</text>

    <!-- 添加/编辑表单 -->
    <view v-if="showAddForm" class="form-area">
      <view class="form-card">
        <view class="form-group">
          <text class="form-label">分类名称 *</text>
          <input v-model="form.name" class="form-input" placeholder="如：玩具、美容" />
        </view>
        <view class="form-actions">
          <button class="form-btn form-btn--ghost" @click="cancelForm">取消</button>
          <button class="form-btn form-btn--primary" :disabled="!form.name" @click="saveCat">{{ editingId ? '更新' : '保存' }}</button>
        </view>
      </view>
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

const CACHE_KEY = 'expense_categories_cache'

// 从缓存初始化
function readCache(): ExpenseCategory[] {
  try { return JSON.parse(uni.getStorageSync(CACHE_KEY) || '[]') } catch { return [] }
}

const categories = ref<ExpenseCategory[]>(readCache())
const loading = ref(categories.value.length === 0)
const showAddForm = ref(false)
const editingId = ref('')

const form = reactive({
  name: '',
})

const { run: fetchCategories } = useCloudCall<{ data: ExpenseCategory[] }>('finance-service', 'getExpenseCategories')
const { run: addCategory } = useCloudCall('finance-service', 'addExpenseCategory', { successMessage: '已添加' })
const { run: updateCategory } = useCloudCall('finance-service', 'updateExpenseCategory', { successMessage: '已更新' })
const { run: deleteCategory } = useCloudCall('finance-service', 'removeExpenseCategory', { successMessage: '已删除' })

async function load() {
  if (categories.value.length === 0) loading.value = true
  const res = await fetchCategories()
  if (res?.data) {
    categories.value = res.data
    try { uni.setStorageSync(CACHE_KEY, JSON.stringify(res.data)) } catch { /* ignore */ }
  }
  loading.value = false
}

function startEdit(cat: ExpenseCategory) {
  editingId.value = cat._id
  form.name = cat.name
  showAddForm.value = true
}

function cancelForm() {
  showAddForm.value = false
  editingId.value = ''
  form.name = ''
}

async function saveCat() {
  if (editingId.value) {
    await updateCategory(editingId.value, { name: form.name })
  } else {
    await addCategory({ name: form.name })
  }
  cancelForm()
  try { uni.removeStorageSync(CACHE_KEY) } catch { /* ignore */ }
  load()
}

async function removeCat(id: string) {
  uni.showModal({
    title: '确认删除',
    content: '删除后不可恢复',
    success: async (res) => {
      if (res.confirm) {
        await deleteCategory(id)
        try { uni.removeStorageSync(CACHE_KEY) } catch { /* ignore */ }
        load()
      }
    },
  })
}

onShow(() => load())
</script>

<style lang="scss" scoped>
/* ==================== CATEGORY LIST ==================== */
.cat-list {
  padding: 0 var(--space-page);
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

  &__drag {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-4);
    line-height: 1;
  }

  &__name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-1);
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

    &--disabled {
      color: var(--text-4);
      pointer-events: none;
    }
  }
}

/* ==================== HINT TEXT ==================== */
.hint-text {
  display: block;
  text-align: center;
  font-size: 12px;
  color: var(--text-3);
  padding: 12px var(--space-page) 0;
}

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

  &__text {
    font-size: 13px;
    font-weight: 700;
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
</style>
