<template>
  <view class="page">
    <BPageHeader title="支出分类管理">
      <template #right>
        <view class="header-add" @click="openSheet()">
          <text class="material-icons-round" style="font-size: 18px;">add</text>
          <text class="header-add__text">新建</text>
        </view>
      </template>
    </BPageHeader>

    <!-- 骨架屏：按真实卡片布局 -->
    <view v-if="loading" class="cat-list">
      <view v-for="i in 6" :key="i" class="cat-card cat-card--skeleton">
        <view class="cat-card__left">
          <view class="sk sk-drag" />
          <view class="sk sk-name" />
        </view>
        <view class="cat-card__actions">
          <view class="sk sk-icon" />
          <view class="sk sk-icon" />
        </view>
      </view>
    </view>

    <!-- 分类列表 -->
    <view v-else-if="categories.length > 0" class="cat-list">
      <view v-for="cat in categories" :key="cat.name" class="cat-card">
        <view class="cat-card__left">
          <text class="cat-card__drag">≡</text>
          <text class="cat-card__name">{{ cat.name }}</text>
          <view v-if="cat.is_default" class="cat-card__lock">
            <text class="material-icons-round" style="font-size: 12px; color: var(--text-4);">lock</text>
          </view>
        </view>
        <view class="cat-card__actions">
          <text
            class="material-icons-round cat-card__edit"
            :class="{ 'cat-card__edit--disabled': cat.is_default }"
            @click="!cat.is_default && openSheet(cat)"
          >edit</text>
          <text
            class="material-icons-round cat-card__delete"
            :class="{ 'cat-card__delete--disabled': cat.is_default }"
            @click="!cat.is_default && askDelete(cat.name)"
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
      @action="openSheet()"
    />

    <!-- 提示文字 -->
    <text v-if="!loading && categories.length > 0" class="hint-text">预设分类不可编辑或删除</text>

    <!-- 新建/编辑 BSheet -->
    <BSheet v-model:visible="showSheet" :title="editingName ? '编辑分类' : '新建分类'" height="auto">
      <view class="sheet-form">
        <view class="field-group">
          <text class="field-label">分类名称</text>
          <input
            v-model="formName"
            class="form-input"
            placeholder="如：玩具、美容"
            :focus="showSheet"
          />
        </view>
        <view class="sheet-actions">
          <button class="submit-btn" :disabled="!formName.trim()" @click="saveCat">
            {{ editingName ? '保存修改' : '新建分类' }}
          </button>
        </view>
      </view>
    </BSheet>

    <!-- 删除确认 -->
    <BDeleteConfirm
      v-model:visible="showDeleteConfirm"
      title="删除分类"
      :content="`删除「${deletingName}」后不可恢复，历史账单中该分类名称保持不变`"
      @confirm="confirmDelete"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BDeleteConfirm from '@/components/layout/BDeleteConfirm.vue'

interface ExpenseCategory {
  name: string
  is_default?: boolean
}

const CACHE_KEY = 'expense_categories_cache'

function readCache(): ExpenseCategory[] {
  try { return JSON.parse(uni.getStorageSync(CACHE_KEY) || '[]') } catch { return [] }
}
function saveCache(data: ExpenseCategory[]) {
  try { uni.setStorageSync(CACHE_KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

const categories = ref<ExpenseCategory[]>(readCache())
const loading = ref(categories.value.length === 0)
const showSheet = ref(false)
const formName = ref('')
const editingName = ref('')       // 空字符串 = 新建，非空 = 编辑中的原名称
const showDeleteConfirm = ref(false)
const deletingName = ref('')

const { run: fetchCategories } = useCloudCall<{ data: ExpenseCategory[] }>('finance-service', 'getExpenseCategories')
const { run: addCategory } = useCloudCall('finance-service', 'addExpenseCategory', { successMessage: '已添加' })
const { run: updateCategory } = useCloudCall('finance-service', 'updateExpenseCategory', { successMessage: '已更新' })
const { run: deleteCategory } = useCloudCall('finance-service', 'removeExpenseCategory', { successMessage: '已删除' })

async function load() {
  const res = await fetchCategories()
  if (res?.data) {
    categories.value = res.data
    saveCache(res.data)
  }
  loading.value = false
}

function openSheet(cat?: ExpenseCategory) {
  editingName.value = cat ? cat.name : ''
  formName.value = cat ? cat.name : ''
  showSheet.value = true
}

function saveCat() {
  const name = formName.value.trim()
  if (!name) return
  showSheet.value = false

  if (editingName.value) {
    // 乐观更新：重命名
    const idx = categories.value.findIndex(c => c.name === editingName.value)
    if (idx !== -1) {
      const updated = [...categories.value]
      updated[idx] = { ...updated[idx], name }
      categories.value = updated
      saveCache(categories.value)
    }
    updateCategory({ oldName: editingName.value, newName: name }).catch(() => {
      // 回滚
      load()
      uni.showToast({ title: '更新失败，请重试', icon: 'none' })
    })
  } else {
    // 乐观更新：新建
    const newCat: ExpenseCategory = { name, is_default: false }
    categories.value = [...categories.value, newCat]
    saveCache(categories.value)
    addCategory({ name }).catch(() => {
      categories.value = categories.value.filter(c => c.name !== name)
      saveCache(categories.value)
      uni.showToast({ title: '添加失败，请重试', icon: 'none' })
    })
  }
}

function askDelete(name: string) {
  deletingName.value = name
  showDeleteConfirm.value = true
}

function confirmDelete() {
  const name = deletingName.value
  // 乐观删除
  const prev = [...categories.value]
  categories.value = categories.value.filter(c => c.name !== name)
  saveCache(categories.value)
  showDeleteConfirm.value = false
  deleteCategory({ name }).catch(() => {
    categories.value = prev
    saveCache(prev)
    uni.showToast({ title: '删除失败，请重试', icon: 'none' })
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
    gap: 10px;
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

  &__lock {
    display: flex;
    align-items: center;
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
    &--disabled { color: var(--text-4); pointer-events: none; }
  }

  &__delete {
    font-family: 'Material Icons Round';
    font-size: 20px;
    color: var(--red);
    padding: 4px;
    border-radius: 50%;
    transition: background 0.15s;
    &:active { background: var(--card-dim); }
    &--disabled { color: var(--text-4); pointer-events: none; }
  }
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
.sk-drag { width: 16px; height: 16px; border-radius: 3px; }
.sk-name { height: 14px; border-radius: 7px; }
.cat-card--skeleton .cat-card__left { flex: 1; }
.cat-card--skeleton:nth-child(odd) .sk-name { width: 72px; }
.cat-card--skeleton:nth-child(even) .sk-name { width: 56px; }
.sk-icon { width: 28px; height: 28px; border-radius: 50%; }

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
