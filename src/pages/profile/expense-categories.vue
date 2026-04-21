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

    <view v-if="loading" class="group-list">
      <view v-for="i in 3" :key="i" class="group-card group-card--skeleton">
        <view class="sk sk-title" />
        <view v-for="j in 3" :key="j" class="group-row group-row--skeleton">
          <view class="sk sk-name" />
          <view class="sk sk-icon" />
        </view>
      </view>
    </view>

    <view v-else-if="groupedCategories.length > 0" class="group-list">
      <view v-for="group in groupedCategories" :key="group.key" class="group-card">
        <view class="group-card__header">
          <text class="group-card__title">{{ group.label }}</text>
          <text class="group-card__count">{{ group.items.length }}项</text>
        </view>

        <view
          v-for="cat in group.items"
          :key="cat.name"
          class="group-row"
        >
          <view class="group-row__left">
            <view class="group-row__dot" :class="`group-row__dot--${group.key}`" />
            <view class="group-row__info">
              <text class="group-row__name">{{ cat.name }}</text>
              <text class="group-row__meta">{{ cat.is_default ? '预设分类' : '自定义分类' }}</text>
            </view>
            <view v-if="cat.is_default" class="group-row__lock">
              <text class="material-icons-round" style="font-size: 12px; color: var(--text-4);">lock</text>
            </view>
          </view>

          <view class="group-row__actions">
            <text
              class="material-icons-round group-row__edit"
              :class="{ 'group-row__action--disabled': cat.is_default }"
              @click="!cat.is_default && openSheet(cat)"
            >edit</text>
            <text
              class="material-icons-round group-row__delete"
              :class="{ 'group-row__action--disabled': cat.is_default }"
              @click="!cat.is_default && askDelete(cat.name)"
            >delete_outline</text>
          </view>
        </view>
      </view>
    </view>

    <BEmpty
      v-else
      icon="category"
      title="暂无支出分类"
      description="添加自定义支出分类"
      actionText="新建分类"
      @action="openSheet()"
    />

    <text v-if="!loading && groupedCategories.length > 0" class="hint-text">预设分类不可编辑或删除；自定义分类必须归属于一个用途分组</text>

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

        <view class="field-group">
          <text class="field-label">所属分组</text>
          <view class="group-pills">
            <view
              v-for="group in EXPENSE_CATEGORY_GROUPS"
              :key="group.key"
              class="group-pill"
              :class="{ 'group-pill--active': formParentGroup === group.key }"
              @click="formParentGroup = group.key"
            >
              <text>{{ group.label }}</text>
            </view>
          </view>
        </view>

        <view class="sheet-actions">
          <button class="submit-btn" :disabled="!formName.trim() || !formParentGroup" @click="saveCat">
            {{ editingName ? '保存修改' : '新建分类' }}
          </button>
        </view>
      </view>
    </BSheet>

    <BDeleteConfirm
      v-model:visible="showDeleteConfirm"
      title="删除分类"
      :content="`删除「${deletingName}」后不可恢复，历史账单中该分类名称保持不变`"
      @confirm="confirmDelete"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BDeleteConfirm from '@/components/layout/BDeleteConfirm.vue'
import {
  DEFAULT_EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_GROUPS,
  getExpenseCategoryGroupKey,
  groupExpenseCategories,
  normalizeExpenseCategoryGroupKey,
} from '@/constants/financeCategories'
import type { ExpenseCategory, ExpenseCategoryGroupKey } from '@/types/finance'

const CACHE_KEY = 'expense_categories_cache'

function normalizeCategories(rawCategories: any[]) {
  const merged = new Map<string, ExpenseCategory>()
  for (const item of DEFAULT_EXPENSE_CATEGORIES) {
    merged.set(item.name, { ...item })
  }
  for (const item of rawCategories || []) {
    if (!item) continue
    const name = typeof item === 'string' ? item : item.name
    if (!name) continue
    const parentGroup = typeof item === 'string'
      ? 'other'
      : normalizeExpenseCategoryGroupKey(item.parent_group || getExpenseCategoryGroupKey(name))
    merged.set(name, {
      name,
      parent_group: parentGroup,
      is_default: !!merged.get(name)?.is_default,
    })
  }
  return Array.from(merged.values())
}

function readCache(): ExpenseCategory[] {
  try {
    return normalizeCategories(JSON.parse(uni.getStorageSync(CACHE_KEY) || '[]'))
  } catch {
    return normalizeCategories(DEFAULT_EXPENSE_CATEGORIES)
  }
}

function saveCache(data: ExpenseCategory[]) {
  try {
    uni.setStorageSync(CACHE_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

const categories = ref<ExpenseCategory[]>(readCache())
const groupedCategories = computed(() => groupExpenseCategories(categories.value))
const loading = ref(categories.value.length === 0)
const showSheet = ref(false)
const formName = ref('')
const formParentGroup = ref<ExpenseCategoryGroupKey>('other')
const editingName = ref('')
const showDeleteConfirm = ref(false)
const deletingName = ref('')

const { run: fetchCategories } = useCloudCall<{ data: ExpenseCategory[] }>('finance-service', 'getExpenseCategories')
const { run: addCategory } = useCloudCall('finance-service', 'addExpenseCategory', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: updateCategory } = useCloudCall('finance-service', 'updateExpenseCategory', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: deleteCategory } = useCloudCall('finance-service', 'removeExpenseCategory', { successMode: 'silent', loadingMode: 'local', throwOnError: true })

async function load() {
  const res = await fetchCategories()
  if (res?.data) {
    categories.value = normalizeCategories(res.data)
    saveCache(categories.value)
  }
  loading.value = false
}

function openSheet(cat?: ExpenseCategory) {
  editingName.value = cat ? cat.name : ''
  formName.value = cat ? cat.name : ''
  formParentGroup.value = cat?.parent_group || 'other'
  showSheet.value = true
}

function saveCat() {
  const name = formName.value.trim()
  if (!name || !formParentGroup.value) return

  showSheet.value = false

  if (editingName.value) {
    const idx = categories.value.findIndex(item => item.name === editingName.value)
    const prev = [...categories.value]
    if (idx !== -1) {
      const updated = [...categories.value]
      updated[idx] = {
        ...updated[idx],
        name,
        parent_group: formParentGroup.value,
      }
      categories.value = normalizeCategories(updated)
      saveCache(categories.value)
    }
    updateCategory({
      oldName: editingName.value,
      newName: name,
      parentGroup: formParentGroup.value,
    }).catch(() => {
      categories.value = prev
      saveCache(prev)
      uni.showToast({ title: '更新失败，请重试', icon: 'none' })
    })
    return
  }

  const newCategory: ExpenseCategory = {
    name,
    parent_group: formParentGroup.value,
    is_default: false,
  }
  const prev = [...categories.value]
  categories.value = normalizeCategories([...categories.value, newCategory])
  saveCache(categories.value)
  addCategory({ name, parentGroup: formParentGroup.value }).catch(() => {
    categories.value = prev
    saveCache(prev)
    uni.showToast({ title: '添加失败，请重试', icon: 'none' })
  })
}

function askDelete(name: string) {
  deletingName.value = name
  showDeleteConfirm.value = true
}

function confirmDelete() {
  const prev = [...categories.value]
  categories.value = categories.value.filter(item => item.name !== deletingName.value)
  saveCache(categories.value)
  showDeleteConfirm.value = false
  deleteCategory({ name: deletingName.value }).catch(() => {
    categories.value = prev
    saveCache(prev)
    uni.showToast({ title: '删除失败，请重试', icon: 'none' })
  })
}

onShow(() => load())
</script>

<style lang="scss" scoped>
.group-list {
  padding: 0 var(--space-page) 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px;
  box-shadow: var(--shadow);

  &--skeleton {
    padding: 18px 14px;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  &__title {
    font-size: 15px;
    font-weight: 800;
    color: var(--text-1);
  }

  &__count {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
  }
}

.group-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid rgba(216, 203, 189, 0.16);

  &--skeleton {
    border-top: none;
  }

  &:first-of-type {
    border-top: none;
  }

  &__left {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;

    &--feeding { background: #f59a3f; }
    &--health { background: #e56767; }
    &--breeding { background: #d68ae8; }
    &--operations { background: #5d9ce8; }
    &--other { background: #9b8f86; }
  }

  &__info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__name {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__meta {
    font-size: 12px;
    color: var(--text-3);
  }

  &__lock {
    display: flex;
    align-items: center;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__edit,
  &__delete {
    font-size: 20px;
    color: var(--text-3);
  }

  &__action--disabled {
    color: var(--text-4);
    pointer-events: none;
  }
}

.sheet-form {
  padding: 0 var(--space-page) var(--space-page);
}

.field-group {
  margin-bottom: 16px;
}

.field-label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 10px;
}

.group-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.group-pill {
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--card-dim);
  border: 1px solid rgba(216, 203, 189, 0.35);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);

  &--active {
    background: var(--primary-soft);
    border-color: var(--primary);
    color: var(--primary);
  }
}

.sheet-actions {
  margin-top: 8px;
}

.submit-btn {
  width: 100%;
  height: 44px;
  border-radius: 14px;
  border: none;
  background: var(--primary);
  color: #fff;
  font-size: 14px;
  font-weight: 700;

  &[disabled] {
    opacity: 0.45;
  }
}

.hint-text {
  display: block;
  padding: 4px var(--space-page) 28px;
  font-size: 12px;
  color: var(--text-3);
}

.header-add {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--primary);

  &__text {
    font-size: 13px;
    font-weight: 700;
  }
}

.sk {
  border-radius: 10px;
  background: linear-gradient(90deg, #efe8e2 25%, #f8f3ef 50%, #efe8e2 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite linear;
}

.sk-title {
  width: 120px;
  height: 18px;
  margin-bottom: 14px;
}

.sk-name {
  width: 120px;
  height: 14px;
}

.sk-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
