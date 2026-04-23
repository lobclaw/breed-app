<template>
  <view class="page">
    <!-- 骨架屏 -->
    <template v-if="!litter && loading">
      <view class="litter-skeleton">
        <view class="litter-skeleton__header">
          <view class="litter-skeleton__back litter-skeleton__shimmer" />
          <view class="litter-skeleton__title litter-skeleton__shimmer" />
          <view class="litter-skeleton__edit litter-skeleton__shimmer" />
        </view>

        <view class="card-feed">
          <view class="litter-skeleton__summary">
            <view v-for="row in 6" :key="row" class="litter-skeleton__info-row">
              <view class="litter-skeleton__label litter-skeleton__shimmer" />
              <view
                class="litter-skeleton__value litter-skeleton__shimmer"
                :class="'litter-skeleton__value--' + row"
              />
            </view>
          </view>

          <view class="litter-skeleton__stats">
            <view v-for="stat in 2" :key="stat" class="litter-skeleton__stat">
              <view class="litter-skeleton__stat-num litter-skeleton__shimmer" />
              <view class="litter-skeleton__stat-label litter-skeleton__shimmer" />
            </view>
          </view>

          <view class="litter-skeleton__section">
            <view class="litter-skeleton__section-dot litter-skeleton__shimmer" />
            <view class="litter-skeleton__section-title litter-skeleton__shimmer" />
            <view class="litter-skeleton__badge litter-skeleton__shimmer" />
          </view>

          <view class="litter-skeleton__puppy-card">
            <view class="litter-skeleton__avatar litter-skeleton__shimmer" />
            <view class="litter-skeleton__puppy-main">
              <view class="litter-skeleton__puppy-name litter-skeleton__shimmer" />
              <view class="litter-skeleton__puppy-meta">
                <view class="litter-skeleton__chip litter-skeleton__shimmer" />
                <view class="litter-skeleton__weight litter-skeleton__shimmer" />
              </view>
            </view>
            <view class="litter-skeleton__status litter-skeleton__shimmer" />
          </view>
        </view>
      </view>

      <view class="action-dock action-dock--skeleton">
        <view class="action-dock__panel">
          <view class="action-dock__row">
            <view class="litter-skeleton__dock-btn litter-skeleton__shimmer" />
            <view class="litter-skeleton__dock-btn litter-skeleton__dock-btn--ghost litter-skeleton__shimmer" />
          </view>
          <view class="litter-skeleton__dock-cta litter-skeleton__shimmer" />
        </view>
      </view>
    </template>

    <template v-if="litter">
      <!-- 顶栏 -->
      <BPageHeader :title="litter.dam_name + (litter.litter_number ? `第${litter.litter_number}窝` : '窝')">
        <template #right>
          <view class="edit-btn" @click="showEditSheet = true">
            <text class="material-icons-round" style="font-size: 18px; color: var(--text-2);">edit</text>
          </view>
        </template>
      </BPageHeader>

      <BSubmitBanner :message="submitBannerMessage" />

      <view class="card-feed">
        <!-- 摘要信息卡 -->
        <view class="summary-card">
          <view class="info-rows">
            <view class="info-row">
              <text class="info-label">种母</text>
              <text class="info-value">{{ litter.dam_name }} · 马尔济斯</text>
            </view>
            <view class="info-row">
              <text class="info-label">种公</text>
              <text class="info-value">{{ litter.sire_name || '未知' }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">生产日期</text>
              <text class="info-value">{{ formatDate(litter.birth_date) }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">生产方式</text>
              <text class="info-value">{{ litter.birth_type }}</text>
            </view>
            <view class="info-row">
              <text class="info-label">状态</text>
              <view class="info-value-row">
                <text class="info-value">{{ litter.weaned_at ? '已断奶' : '哺乳中' }}</text>
                <BTag v-if="!litter.weaned_at" label="断奶需确认" color="amber" />
              </view>
            </view>
            <view v-if="litter.birth_notes" class="info-row">
              <text class="info-label">经验心得</text>
              <text class="info-value">{{ litter.birth_notes }}</text>
            </view>
          </view>
        </view>

        <!-- 数据统计行 -->
        <view class="stats-row">
          <view class="stat-col">
            <text class="stat-num">{{ litter.total_born }}</text>
            <text class="stat-label">出生</text>
          </view>
          <view class="stat-col">
            <text class="stat-num">{{ litter.born_alive }}</text>
            <text class="stat-label">存活</text>
          </view>
          <view v-if="soldCount > 0" class="stat-col">
            <text class="stat-num">{{ soldCount }}</text>
            <text class="stat-label">已售</text>
          </view>
        </view>

        <!-- 幼崽列表 -->
        <BSectionLabel title="幼崽" color="rose" :badge="puppies.length" />

        <view
          v-for="puppy in puppies"
          :key="puppy._id"
          class="puppy-card"
          @click="goToDog(puppy._id)"
        >
          <view class="puppy-avatar">
            <BEntityIcon role="幼崽" color="var(--rose)" :size="18" />
          </view>
          <view class="puppy-info">
            <text class="puppy-name">{{ puppy.name || '未命名' }}</text>
            <view class="puppy-meta">
              <view class="gender-tag" :class="puppy.gender === '公' ? 'gender-male' : 'gender-female'">
                <text>{{ puppy.gender }}</text>
              </view>
              <text v-if="puppy.latest_weight" class="puppy-weight">{{ puppy.latest_weight }}g</text>
            </view>
          </view>
          <view class="disposition-tag" :class="dispClass(puppy.disposition)">
            <text>{{ dispLabel(puppy.disposition) }}</text>
          </view>
        </view>

        <!-- 空状态 -->
        <BEmpty
          v-if="puppies.length === 0"
          icon="pets"
          title="暂无幼崽记录"
          description="点击下方按钮添加幼崽"
          actionText="添加幼崽"
          @action="addPuppy"
        />

        <!-- 窝利润 -->
        <template v-if="hasProfit">
          <BSectionLabel title="窝利润" color="green" />
          <BCard color="green" :pressable="false">
            <view class="profit-row">
              <text class="profit-label">收入</text>
              <text class="profit-value" style="color: var(--red);">¥{{ (litter.income || 0).toLocaleString() }}</text>
            </view>
            <view class="profit-row">
              <text class="profit-label">支出</text>
              <text class="profit-value" style="color: var(--green);">¥{{ (litter.expense || 0).toLocaleString() }}</text>
            </view>
            <view class="profit-divider" />
            <view class="profit-row" style="padding-top: 8px;">
              <text class="profit-label">净利润</text>
              <text class="profit-net">¥{{ ((litter.income || 0) - (litter.expense || 0)).toLocaleString() }}</text>
            </view>
          </BCard>
        </template>

      </view>

      <view class="action-dock">
        <view class="action-dock__panel">
          <view class="action-dock__row">
            <BButton color="teal" class="action-dock__btn" @click="goWeightEntry">
              <text class="material-icons-round action-dock__icon">monitor_weight</text>
              记录体重
            </BButton>
            <BButton variant="ghost" class="action-dock__btn action-dock__btn--ghost" @click="addPuppy">
              <text class="material-icons-round action-dock__icon">add</text>
              添加幼崽
            </BButton>
          </view>
          <BButton
            v-if="!litter.weaned_at"
            color="amber"
            size="large"
            class="action-dock__cta"
            :loading="weaning"
            @click="confirmWeaning"
          >
            <text class="material-icons-round action-dock__icon">check_circle</text>
            确认断奶
          </BButton>
        </view>
      </view>
    </template>

    <BSheet v-model:visible="showEditSheet" title="编辑窝信息" height="auto">
      <view class="edit-sheet">
        <view class="edit-sheet__item" @click="editBirthDate">
          <view class="edit-sheet__icon">
            <text class="material-icons-round">event</text>
          </view>
          <view class="edit-sheet__content">
            <text class="edit-sheet__title">修改生产日期</text>
            <text class="edit-sheet__desc">仅支持在原日期前后 3 天内调整</text>
          </view>
          <text class="material-icons-round edit-sheet__arrow">chevron_right</text>
        </view>
        <view class="edit-sheet__item" @click="editNotes">
          <view class="edit-sheet__icon edit-sheet__icon--notes">
            <text class="material-icons-round">sticky_note_2</text>
          </view>
          <view class="edit-sheet__content">
            <text class="edit-sheet__title">修改备注</text>
            <text class="edit-sheet__desc">更新这窝的生产备注和经验心得</text>
          </view>
          <text class="material-icons-round edit-sheet__arrow">chevron_right</text>
        </view>
      </view>
    </BSheet>

    <BSheet v-model:visible="showEditFormSheet" :title="editFormTitle" height="auto">
      <view class="edit-form-sheet">
        <text v-if="editFormHint" class="edit-form-sheet__hint">{{ editFormHint }}</text>

        <view v-if="editMode === 'birth_date'" class="edit-form-sheet__group">
          <text class="edit-form-sheet__label">生产日期</text>
          <view class="edit-form-sheet__picker" @click="showBirthDatePicker = true">
            <text class="edit-form-sheet__picker-text">{{ editBirthDateDisplayText || '请选择生产日期' }}</text>
            <text class="material-icons-round edit-form-sheet__picker-icon">calendar_today</text>
          </view>
        </view>

        <view v-else-if="editMode === 'notes'" class="edit-form-sheet__group">
          <text class="edit-form-sheet__label">备注（选填）</text>
          <textarea
            v-model="editNotesValue"
            class="edit-form-sheet__textarea"
            :maxlength="300"
            :auto-height="true"
            placeholder="记录这窝的生产备注、经验心得或补充说明"
          />
        </view>

        <view v-else-if="editMode === 'puppy_name'" class="edit-form-sheet__group">
          <text class="edit-form-sheet__label">幼崽名称（选填）</text>
          <input
            v-model="editSingleLineValue"
            class="edit-form-sheet__input"
            placeholder="未填写时将按默认口径创建"
          />
        </view>

        <view class="edit-form-sheet__actions">
          <view class="edit-form-sheet__btn edit-form-sheet__btn--cancel" @click="closeEditFormSheet">
            <text class="edit-form-sheet__btn-text" style="color: var(--text-2);">取消</text>
          </view>
          <view
            class="edit-form-sheet__btn edit-form-sheet__btn--primary"
            :class="{ 'edit-form-sheet__btn--disabled': promptSubmitting }"
            @click="handlePromptConfirm"
          >
            <text class="edit-form-sheet__btn-text" style="color: #fff;">保存</text>
          </view>
        </view>
      </view>
    </BSheet>

    <BDateTimePicker
      v-model:visible="showBirthDatePicker"
      :model-value="editBirthDateValue"
      mode="date"
      value-type="timestamp"
      @confirm="onBirthDateConfirm"
    />

    <BModal
      v-model:visible="showWeaningConfirm"
      title="确认断奶"
      content="确认该窝幼崽已完成断奶？"
      confirmText="确认断奶"
      @confirm="handleWeaningConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { consumeSubmitFeedback, queueSubmitFeedback } from '@/composables/useSubmitFeedback'
import BEntityIcon from '@/components/base/BEntityIcon.vue'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BCard from '@/components/base/BCard.vue'
import BTag from '@/components/base/BTag.vue'
import BButton from '@/components/base/BButton.vue'
import BSectionLabel from '@/components/base/BSectionLabel.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BSubmitBanner from '@/components/feedback/BSubmitBanner.vue'
import BSheet from '@/components/layout/BSheet.vue'
import BModal from '@/components/layout/BModal.vue'
import BDateTimePicker from '@/components/form/BDateTimePicker.vue'
import { formatDateInputValue } from '@/utils/date'

const litter = ref<any>(null)
const puppies = ref<any[]>([])
const weaning = ref(false)
const loading = ref(true)
let litterId = ''
let sourceTaskId = ''

const { run: fetchDetail } = useCloudCall<{ data: any }>('breeding-service', 'getLitterDetail')
const { run: doWeaning } = useCloudCall('breeding-service', 'confirmWeaning', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: doAddPuppy } = useCloudCall('breeding-service', 'addPuppyToLitter', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: doUpdateBirthDate } = useCloudCall('breeding-service', 'updateBirthDate', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: doUpdateNotes } = useCloudCall('breeding-service', 'updateLitter', { successMode: 'silent', loadingMode: 'local', throwOnError: true })
const { run: completeTask } = useCloudCall('task-service', 'completeTask', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

// 编辑表单 Sheet 状态
const editMode = ref<'birth_date' | 'notes' | 'puppy_name' | ''>('')
const showEditFormSheet = ref(false)
const showBirthDatePicker = ref(false)
const editFormTitle = ref('')
const editFormHint = ref('')
const editBirthDateValue = ref<number | null>(null)
const editNotesValue = ref('')
const editSingleLineValue = ref('')
const promptSubmitting = ref(false)
const showEditSheet = ref(false)
const showWeaningConfirm = ref(false)
const submitBannerMessage = ref('')
let promptResolve: ((val: string | number | null) => Promise<void>) | null = null
let submitBannerTimer: ReturnType<typeof setTimeout> | null = null

const editBirthDateDisplayText = computed(() => formatDateInputValue(editBirthDateValue.value))

function openPrompt(
  mode: 'birth_date' | 'notes' | 'puppy_name',
  title: string,
  value: string | number | null,
  callback: (val: string | number | null) => Promise<void>,
  hint = '',
) {
  editMode.value = mode
  editFormTitle.value = title
  editFormHint.value = hint
  if (mode === 'birth_date') {
    editBirthDateValue.value = typeof value === 'number' ? value : null
  } else if (mode === 'notes') {
    editNotesValue.value = typeof value === 'string' ? value : ''
  } else {
    editSingleLineValue.value = typeof value === 'string' ? value : ''
  }
  promptResolve = callback
  showEditFormSheet.value = true
}

function closeEditFormSheet() {
  showEditFormSheet.value = false
  showBirthDatePicker.value = false
  promptResolve = null
  editMode.value = ''
}

async function handlePromptConfirm() {
  if (!promptResolve || promptSubmitting.value) return
  promptSubmitting.value = true
  try {
    const currentValue = editMode.value === 'birth_date'
      ? editBirthDateValue.value
      : editMode.value === 'notes'
        ? editNotesValue.value
        : editSingleLineValue.value
    await promptResolve(currentValue)
    closeEditFormSheet()
  } catch (e: any) {
    uni.showToast({ title: e.message || '操作失败', icon: 'none' })
  } finally {
    promptSubmitting.value = false
  }
}

function onBirthDateConfirm(value: number | string) {
  if (typeof value !== 'number') return
  editBirthDateValue.value = value
}

const soldCount = computed(() => puppies.value.filter(p => p.disposition === 'sold').length)
const hasProfit = computed(() => litter.value && ((litter.value.income || 0) > 0 || (litter.value.expense || 0) > 0))

function formatDate(ts: number) {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function goToDog(dogId: string) {
  uni.navigateTo({ url: `/pages/dog/detail?id=${dogId}` })
}

function goWeightEntry() {
  uni.navigateTo({ url: `/pages/health/batch-weight?litterId=${litterId}` })
}

function editBirthDate() {
  showEditSheet.value = false
  openPrompt(
    'birth_date',
    '修改生产日期',
    litter.value?.birth_date || null,
    async (val) => {
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        throw new Error('请输入生产日期')
      }
      await doUpdateBirthDate(litterId, val)
      await loadData()
    },
    '生产日期只能调整 ±3 天',
  )
}

function editNotes() {
  showEditSheet.value = false
  openPrompt(
    'notes',
    '修改备注',
    litter.value?.birth_notes || '',
    async (val) => {
      await doUpdateNotes(litterId, { birth_notes: val || '' })
      await loadData()
    },
  )
}

function dispClass(disposition: string) {
  const map: Record<string, string> = {
    keeping: 'disp-keeping',
    for_sale: 'disp-for-sale',
    sold: 'disp-sold',
    gifted: 'disp-gifted',
  }
  return map[disposition] || 'disp-keeping'
}

function dispLabel(disposition: string) {
  const map: Record<string, string> = {
    keeping: '在养',
    for_sale: '待售',
    sold: '已售',
    gifted: '已赠送',
  }
  return map[disposition] || '在养'
}

function showSubmitBanner(message: string) {
  submitBannerMessage.value = message
  if (submitBannerTimer) clearTimeout(submitBannerTimer)
  submitBannerTimer = setTimeout(() => {
    submitBannerMessage.value = ''
  }, 2200)
}

async function loadData() {
  loading.value = true
  const res = await fetchDetail(litterId)
  if (res?.data) {
    litter.value = res.data.litter
    puppies.value = res.data.puppies || []
  }
  loading.value = false
}

async function confirmWeaning() {
  showWeaningConfirm.value = true
}

async function handleWeaningConfirm() {
  weaning.value = true
  try {
    await doWeaning(litterId)
    if (sourceTaskId) {
      await completeTask(sourceTaskId)
      queueSubmitFeedback({
        message: '已确认断奶并处理待办',
        homeSection: 'breeding',
        completedTaskIds: [sourceTaskId],
        suppressTaskIds: [sourceTaskId],
        refreshHome: true,
      })
    }
    loadData()
  } finally {
    weaning.value = false
  }
}

function addPuppy() {
  openPrompt(
    'puppy_name',
    '添加幼崽',
    '',
    async (val) => {
      await doAddPuppy(litterId, { name: val || '' })
      await loadData()
    },
  )
}

onLoad((query) => {
  litterId = query?.id || ''
  sourceTaskId = query?.taskId || ''
  if (litterId) loadData()
})

onShow(() => {
  const feedback = consumeSubmitFeedback('/pages/breeding/litter')
  if (feedback?.message) {
    showSubmitBanner(feedback.message)
  }
  if (feedback && litterId) {
    loadData()
  }
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: calc(156px + env(safe-area-inset-bottom, 0px));
}

.card-feed {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);
  padding-bottom: 12px;
}

.litter-skeleton {
  min-height: 100vh;
  overflow: hidden;
}

.litter-skeleton__shimmer {
  background: linear-gradient(
    90deg,
    var(--card-dim) 25%,
    rgba(255, 255, 255, 0.28) 50%,
    var(--card-dim) 75%
  );
  background-size: 200% 100%;
  animation: litter-skeleton-shimmer 1.5s infinite;
}

.litter-skeleton__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 38px var(--space-page) 14px;
}

.litter-skeleton__back,
.litter-skeleton__edit {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
}

.litter-skeleton__title {
  width: 124px;
  height: 20px;
  border-radius: 999px;
}

.litter-skeleton__edit {
  margin-left: auto;
  background-color: var(--card);
}

.litter-skeleton__summary {
  background: var(--card-dim);
  border-radius: var(--radius-card);
  padding: 16px;
}

.litter-skeleton__info-row {
  min-height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border-bottom: 1px solid rgba(216, 203, 189, 0.42);

  &:last-child {
    border-bottom: none;
  }
}

.litter-skeleton__label {
  width: 42px;
  height: 12px;
  border-radius: 999px;
  flex-shrink: 0;
}

.litter-skeleton__value {
  height: 14px;
  border-radius: 999px;
}

.litter-skeleton__value--1 { width: 92px; }
.litter-skeleton__value--2 { width: 38px; }
.litter-skeleton__value--3 { width: 88px; }
.litter-skeleton__value--4 { width: 52px; }
.litter-skeleton__value--5 { width: 94px; }
.litter-skeleton__value--6 { width: 72px; }

.litter-skeleton__stats {
  display: flex;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px 0;
  box-shadow: var(--shadow);
}

.litter-skeleton__stat {
  flex: 1;
  min-height: 42px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  position: relative;

  & + &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 15%;
    width: 1px;
    height: 70%;
    background: var(--text-4);
    opacity: 0.5;
  }
}

.litter-skeleton__stat-num {
  width: 22px;
  height: 20px;
  border-radius: 999px;
}

.litter-skeleton__stat-label {
  width: 28px;
  height: 11px;
  border-radius: 999px;
}

.litter-skeleton__section {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
}

.litter-skeleton__section-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.litter-skeleton__section-title {
  width: 32px;
  height: 13px;
  border-radius: 999px;
}

.litter-skeleton__badge {
  width: 24px;
  height: 22px;
  border-radius: 999px;
  margin-left: 2px;
}

.litter-skeleton__puppy-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--card);
  border-radius: var(--radius-row);
  padding: 12px 14px;
  box-shadow: var(--shadow);
}

.litter-skeleton__avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  flex-shrink: 0;
}

.litter-skeleton__puppy-main {
  flex: 1;
  min-width: 0;
}

.litter-skeleton__puppy-name {
  width: 86px;
  height: 14px;
  border-radius: 999px;
}

.litter-skeleton__puppy-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.litter-skeleton__chip {
  width: 24px;
  height: 18px;
  border-radius: var(--radius-tag);
}

.litter-skeleton__weight {
  width: 38px;
  height: 12px;
  border-radius: 999px;
}

.litter-skeleton__status {
  width: 42px;
  height: 20px;
  border-radius: var(--radius-tag);
  flex-shrink: 0;
}

.litter-skeleton__dock-btn,
.litter-skeleton__dock-cta {
  position: relative;
  flex: 1;
  min-height: 48px;
  border-radius: 999px;
}

.litter-skeleton__dock-btn--ghost {
  background-color: rgba(255, 255, 255, 0.82);
}

.litter-skeleton__dock-cta {
  width: 100%;
  margin-top: 10px;
  min-height: 50px;
  flex: none;
}

@keyframes litter-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.edit-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card);
  box-shadow: var(--shadow);
  transition: transform 0.12s ease;
  &:active { transform: scale(0.9); }
}

.edit-sheet {
  padding-bottom: 10px;
}

.edit-sheet__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 2px;
  border-bottom: 1px solid rgba(216, 203, 189, 0.32);

  &:last-child {
    border-bottom: none;
  }
}

.edit-sheet__icon {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: rgba(232, 155, 62, 0.14);
  color: var(--amber);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.edit-sheet__icon--notes {
  background: rgba(234, 62, 119, 0.12);
  color: var(--rose);
}

.edit-sheet__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.edit-sheet__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}

.edit-sheet__desc {
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-3);
}

.edit-sheet__arrow {
  font-size: 18px;
  color: var(--text-4);
  flex-shrink: 0;
}

.edit-form-sheet {
  padding-bottom: 10px;
}

.edit-form-sheet__hint {
  display: block;
  margin-bottom: 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-3);
}

.edit-form-sheet__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-form-sheet__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
}

.edit-form-sheet__picker {
  min-height: 48px;
  border-radius: 16px;
  border: 1px solid rgba(216, 203, 189, 0.7);
  background: rgba(250, 246, 243, 0.84);
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.edit-form-sheet__picker-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

.edit-form-sheet__picker-icon {
  font-size: 18px;
  color: var(--text-3);
  flex-shrink: 0;
}

.edit-form-sheet__textarea {
  width: 100%;
  min-height: 132px;
  border-radius: 18px;
  border: 1px solid rgba(216, 203, 189, 0.7);
  background: rgba(250, 246, 243, 0.84);
  padding: 14px;
  box-sizing: border-box;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-1);
}

.edit-form-sheet__input {
  width: 100%;
  height: 48px;
  border-radius: 16px;
  border: 1px solid rgba(216, 203, 189, 0.7);
  background: rgba(250, 246, 243, 0.84);
  padding: 0 14px;
  box-sizing: border-box;
  font-size: 14px;
  color: var(--text-1);
}

.edit-form-sheet__actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.edit-form-sheet__btn {
  flex: 1;
  height: 46px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s ease, opacity 0.12s ease;

  &:active {
    transform: scale(0.96);
    opacity: 0.88;
  }
}

.edit-form-sheet__btn--cancel {
  background: var(--card-dim);
}

.edit-form-sheet__btn--primary {
  background: var(--primary);
  box-shadow: 0 8px 18px rgba(234, 62, 119, 0.18);
}

.edit-form-sheet__btn--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.edit-form-sheet__btn-text {
  font-size: 14px;
  font-weight: 700;
}

/* 摘要信息卡 */
.summary-card {
  background: var(--card-dim);
  border-radius: var(--radius-card);
  padding: 16px;
}

.info-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.info-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.info-value-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 统计行 */
.stats-row {
  display: flex;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 14px 0;
  box-shadow: var(--shadow);
}

.stat-col {
  flex: 1;
  text-align: center;
  position: relative;

  & + & {
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 15%;
      height: 70%;
      width: 1px;
      background: var(--text-4);
      opacity: 0.5;
    }
  }
}

.stat-num {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-1);
  font-family: var(--font-display);
  display: block;
}

.stat-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  margin-top: 2px;
  display: block;
}

/* 幼崽卡片 */
.puppy-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--card);
  border-radius: var(--radius-row);
  padding: 12px 14px;
  box-shadow: var(--shadow);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.puppy-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--card-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.puppy-info {
  flex: 1;
  min-width: 0;
}

.puppy-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.3;
  display: block;
}

.puppy-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
}

.gender-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--radius-tag);
}

.gender-male {
  background: var(--blue-soft);
  color: var(--blue);
}

.gender-female {
  background: var(--rose-soft);
  color: var(--rose);
}

.puppy-weight {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
}

.disposition-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: var(--radius-tag);
  flex-shrink: 0;
}

.disp-keeping { background: var(--card-dim); color: var(--text-3); }
.disp-for-sale { background: var(--amber-soft); color: var(--amber); }
.disp-sold { background: var(--green-soft); color: var(--green); }
.disp-gifted { background: var(--blue-soft); color: var(--blue); }

/* 利润 */
.profit-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.profit-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
}

.profit-value {
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-display);
}

.profit-divider {
  height: 1px;
  background: var(--text-4);
  opacity: 0.4;
  margin: 4px 0;
}

.profit-net {
  font-size: 22px;
  font-weight: 800;
  color: var(--primary);
  font-family: var(--font-display);
}

/* 操作按钮 */
.action-dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  padding: 14px var(--space-page) calc(14px + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(180deg, rgba(250, 246, 243, 0) 0%, rgba(250, 246, 243, 0.9) 24%, rgba(250, 246, 243, 0.98) 100%);
}

.action-dock__panel {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  padding: 12px;
  background: rgba(255, 252, 249, 0.94);
  border: 1px solid rgba(216, 203, 189, 0.38);
  box-shadow: 0 -4px 24px rgba(77, 52, 31, 0.08);
  backdrop-filter: blur(12px);
}

.action-dock__panel::before {
  content: '';
  position: absolute;
  top: -34px;
  right: -6px;
  width: 118px;
  height: 118px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(232, 155, 62, 0.16) 0%, rgba(255, 255, 255, 0) 72%);
  pointer-events: none;
}

.action-dock__row {
  position: relative;
  display: flex;
  gap: 10px;
}

.action-dock__btn {
  flex: 1;
  min-height: 48px;
}

.action-dock__btn--ghost {
  background: rgba(255, 255, 255, 0.82);
  border-color: rgba(175, 150, 124, 0.34) !important;
  color: var(--text-2) !important;
}

.action-dock__cta {
  position: relative;
  width: 100%;
  margin-top: 10px;
  min-height: 50px;
  box-shadow: 0 10px 24px rgba(232, 155, 62, 0.24);
}

.action-dock__icon {
  font-size: 16px;
  margin-right: 6px;
}
</style>
