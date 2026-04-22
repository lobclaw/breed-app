<template>
  <view class="page">
    <BPageHeader title="支出分类管理">
      <template #right>
        <view class="header-add" @click="showCreateSheet = true">
          <text class="material-icons-round" style="font-size: 18px;">add</text>
          <text class="header-add__text">新建</text>
        </view>
      </template>
    </BPageHeader>

    <view v-if="loading" class="group-list">
      <view v-for="i in 3" :key="i" class="group-card group-card--skeleton">
        <view class="sk sk-title" />
        <view v-for="j in 2" :key="j" class="group-row group-row--skeleton">
          <view class="sk sk-name" />
          <view class="sk sk-icon" />
        </view>
      </view>
    </view>

    <view v-else class="group-list">
      <view v-for="group in groupedCategories" :key="group.key" class="group-card">
        <view class="group-card__header">
          <view class="group-card__title-wrap">
            <view class="group-card__dot" :style="{ background: getExpenseCategoryGroupColor(group.key) }" />
            <view class="group-card__copy">
              <text class="group-card__title">{{ group.label }}</text>
              <text class="group-card__count">{{ group.items.length }}项</text>
            </view>
          </view>

          <view class="group-card__actions">
            <view v-if="group.is_default" class="group-card__lock">
              <text class="material-icons-round" style="font-size: 14px; color: var(--text-4);">lock</text>
            </view>
            <template v-else>
              <text class="material-icons-round group-card__action" @click="openGroupSheet(group)">edit</text>
              <text class="material-icons-round group-card__action" @click="askDelete('group', group)">delete_outline</text>
            </template>
          </view>
        </view>

        <template v-if="group.items.length">
          <view
            v-for="cat in group.items"
            :key="cat.name"
            class="group-row"
          >
            <view class="group-row__left">
              <view class="group-row__dot" :style="{ background: getExpenseCategoryGroupColor(group.key) }" />
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
                @click="!cat.is_default && openCategorySheet(cat)"
              >edit</text>
              <text
                class="material-icons-round group-row__delete"
                :class="{ 'group-row__action--disabled': cat.is_default }"
                @click="!cat.is_default && askDelete('category', cat)"
              >delete_outline</text>
            </view>
          </view>
        </template>

        <view v-else class="group-card__empty">
          <text>该分组下暂无分类</text>
        </view>
      </view>
    </view>

    <text class="hint-text">预设分组和预设分类不可编辑或删除；删除自定义分组前需先迁移或删除其下分类</text>

    <BSheet v-model:visible="showCreateSheet" title="新建内容" height="auto">
      <view class="create-sheet">
        <view class="create-item" @click="openGroupSheet()">
          <view class="create-item__icon">
            <text class="material-icons-round" style="font-size: 18px; color: var(--primary);">folder</text>
          </view>
          <view class="create-item__copy">
            <text class="create-item__title">新建分组</text>
            <text class="create-item__desc">先创建一级支出分组，再往下挂分类</text>
          </view>
          <text class="material-icons-round create-item__arrow">chevron_right</text>
        </view>

        <view class="create-item" @click="openCategorySheet()">
          <view class="create-item__icon">
            <text class="material-icons-round" style="font-size: 18px; color: var(--primary);">category</text>
          </view>
          <view class="create-item__copy">
            <text class="create-item__title">新建分类</text>
            <text class="create-item__desc">创建实际记账使用的二级分类</text>
          </view>
          <text class="material-icons-round create-item__arrow">chevron_right</text>
        </view>
      </view>
    </BSheet>

    <BSheet v-model:visible="showGroupSheet" :title="editingGroupKey ? '编辑分组' : '新建分组'" height="auto">
      <view class="sheet-form">
        <view class="field-group">
          <text class="field-label">分组名称</text>
          <input
            v-model="groupFormLabel"
            class="form-input"
            placeholder="如：美容护理"
            :focus="showGroupSheet"
          />
        </view>

        <view class="sheet-actions">
          <BSubmitButton
            :disabled="!groupFormLabel.trim() || groupSubmitting"
            :loading="groupSubmitting"
            @click="saveGroup"
          >
            {{ editingGroupKey ? '保存修改' : '新建分组' }}
          </BSubmitButton>
        </view>
      </view>
    </BSheet>

    <BSheet v-model:visible="showCategorySheet" :title="editingCategoryName ? '编辑分类' : '新建分类'" height="auto">
      <view class="sheet-form">
        <view class="field-group">
          <text class="field-label">分类名称</text>
          <input
            v-model="categoryFormName"
            class="form-input"
            placeholder="如：玩具、美容"
            :focus="showCategorySheet"
          />
        </view>

        <view class="field-group">
          <text class="field-label">所属分组</text>
          <view class="group-pills">
            <view
              v-for="group in groups"
              :key="group.key"
              class="group-pill"
              :class="{ 'group-pill--active': categoryFormParentGroup === group.key }"
              @click="categoryFormParentGroup = group.key"
            >
              <text>{{ group.label }}</text>
            </view>
          </view>
        </view>

        <view class="sheet-actions">
          <BSubmitButton
            :disabled="!categoryFormName.trim() || !categoryFormParentGroup || categorySubmitting"
            :loading="categorySubmitting"
            @click="saveCategory"
          >
            {{ editingCategoryName ? '保存修改' : '新建分类' }}
          </BSubmitButton>
        </view>
      </view>
    </BSheet>

    <BDeleteConfirm
      v-model:visible="showDeleteConfirm"
      :title="deleteTargetType === 'group' ? '删除分组' : '删除分类'"
      :content="deleteConfirmContent"
      @confirm="confirmDelete"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BSubmitButton from '@/components/base/BSubmitButton.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BDeleteConfirm from '@/components/layout/BDeleteConfirm.vue'
import {
  buildExpenseCategoryGroups,
  getExpenseCategoryGroupColor,
  groupExpenseCategories,
  normalizeExpenseCategories,
} from '@/constants/financeCategories'
import type { ExpenseCategory, ExpenseCategoryGroup } from '@/types/finance'

const CATEGORY_CACHE_KEY = 'expense_categories_cache'
const GROUP_CACHE_KEY = 'expense_category_groups_cache'

function readCategoryCache() {
  try {
    return JSON.parse(uni.getStorageSync(CATEGORY_CACHE_KEY) || '[]')
  } catch {
    return []
  }
}

function readGroupCache() {
  try {
    return JSON.parse(uni.getStorageSync(GROUP_CACHE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveCategoryCache(data: ExpenseCategory[]) {
  try {
    uni.setStorageSync(CATEGORY_CACHE_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

function saveGroupCache(data: ExpenseCategoryGroup[]) {
  try {
    uni.setStorageSync(GROUP_CACHE_KEY, JSON.stringify(data))
  } catch {
    // ignore
  }
}

const groups = ref<ExpenseCategoryGroup[]>(buildExpenseCategoryGroups(readGroupCache()))
const categories = ref<ExpenseCategory[]>(normalizeExpenseCategories(readCategoryCache(), groups.value))
const groupedCategories = computed(() => groupExpenseCategories(categories.value, groups.value, true))
const loading = ref(true)

const showCreateSheet = ref(false)
const showGroupSheet = ref(false)
const showCategorySheet = ref(false)
const showDeleteConfirm = ref(false)

const editingGroupKey = ref('')
const groupFormLabel = ref('')
const groupSubmitting = ref(false)

const editingCategoryName = ref('')
const categoryFormName = ref('')
const categoryFormParentGroup = ref('other')
const categorySubmitting = ref(false)

const deleteTargetType = ref<'group' | 'category'>('category')
const deletingKey = ref('')
const deletingLabel = ref('')
const deleteSubmitting = ref(false)

const deleteConfirmContent = computed(() => {
  if (deleteTargetType.value === 'group') {
    return `删除分组「${deletingLabel.value}」后不可恢复；若分组下仍有分类会被阻止删除`
  }
  return `删除分类「${deletingLabel.value}」后不可恢复，历史账单中该分类名称保持不变`
})

const { run: fetchCategories } = useCloudCall<{ data: ExpenseCategory[] }>('finance-service', 'getExpenseCategories')
const { run: fetchGroups } = useCloudCall<{ data: ExpenseCategoryGroup[] }>('finance-service', 'getExpenseCategoryGroups')
const { run: addCategory } = useCloudCall('finance-service', 'addExpenseCategory', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: updateCategory } = useCloudCall('finance-service', 'updateExpenseCategory', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: deleteCategory } = useCloudCall('finance-service', 'removeExpenseCategory', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: addGroup } = useCloudCall<{ data: ExpenseCategoryGroup }>('finance-service', 'addExpenseCategoryGroup', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: updateGroup } = useCloudCall('finance-service', 'updateExpenseCategoryGroup', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: deleteGroup } = useCloudCall('finance-service', 'removeExpenseCategoryGroup', { successMode: 'silent', loadingMode: 'local', throwOnError: true })

async function load() {
  try {
    const [groupRes, categoryRes] = await Promise.all([
      fetchGroups(),
      fetchCategories(),
    ])

    groups.value = buildExpenseCategoryGroups(groupRes?.data || [])
    categories.value = normalizeExpenseCategories(categoryRes?.data || [], groups.value)
    saveGroupCache(groups.value)
    saveCategoryCache(categories.value)
  } catch {
    uni.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function openGroupSheet(group?: ExpenseCategoryGroup) {
  showCreateSheet.value = false
  editingGroupKey.value = group?.key || ''
  groupFormLabel.value = group?.label || ''
  showGroupSheet.value = true
}

function openCategorySheet(category?: ExpenseCategory) {
  showCreateSheet.value = false
  editingCategoryName.value = category?.name || ''
  categoryFormName.value = category?.name || ''
  categoryFormParentGroup.value = category?.parent_group || 'other'
  showCategorySheet.value = true
}

async function saveGroup() {
  const label = groupFormLabel.value.trim()
  if (!label) return

  groupSubmitting.value = true
  try {
    if (editingGroupKey.value) {
      await updateGroup({ key: editingGroupKey.value, label })
    } else {
      await addGroup({ label })
    }
    showGroupSheet.value = false
    await load()
  } catch (error: any) {
    uni.showToast({ title: error?.message || '保存失败，请重试', icon: 'none' })
  } finally {
    groupSubmitting.value = false
  }
}

async function saveCategory() {
  const name = categoryFormName.value.trim()
  if (!name || !categoryFormParentGroup.value) return

  categorySubmitting.value = true
  try {
    if (editingCategoryName.value) {
      await updateCategory({
        oldName: editingCategoryName.value,
        newName: name,
        parentGroup: categoryFormParentGroup.value,
      })
    } else {
      await addCategory({
        name,
        parentGroup: categoryFormParentGroup.value,
      })
    }
    showCategorySheet.value = false
    await load()
  } catch (error: any) {
    uni.showToast({ title: error?.message || '保存失败，请重试', icon: 'none' })
  } finally {
    categorySubmitting.value = false
  }
}

function askDelete(type: 'group' | 'category', target: ExpenseCategoryGroup | ExpenseCategory) {
  deleteTargetType.value = type
  deletingKey.value = type === 'group' ? (target as ExpenseCategoryGroup).key : (target as ExpenseCategory).name
  deletingLabel.value = type === 'group' ? (target as ExpenseCategoryGroup).label : (target as ExpenseCategory).name
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (deleteSubmitting.value) return

  deleteSubmitting.value = true
  try {
    if (deleteTargetType.value === 'group') {
      await deleteGroup({ key: deletingKey.value })
    } else {
      await deleteCategory({ name: deletingKey.value })
    }
    showDeleteConfirm.value = false
    await load()
  } catch (error: any) {
    uni.showToast({ title: error?.message || '删除失败，请重试', icon: 'none' })
  } finally {
    deleteSubmitting.value = false
  }
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
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  &__title-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  &__dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
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

  &__actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__action {
    font-size: 20px;
    color: var(--text-3);
  }

  &__lock {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 20px;
  }

  &__empty {
    padding: 10px 0 4px;
    font-size: 12px;
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

.create-sheet {
  padding: 0 var(--space-page) var(--space-page);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.create-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  background: var(--card-dim);

  &__icon {
    width: 40px;
    height: 40px;
    border-radius: 14px;
    background: var(--primary-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__desc {
    font-size: 12px;
    color: var(--text-3);
  }

  &__arrow {
    font-size: 18px;
    color: var(--text-4);
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
