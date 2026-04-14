<template>
  <view class="page">
    <!-- 骨架屏 -->
    <BSkeleton v-if="!litter && loading" :rows="4" :avatar="true" />

    <template v-if="litter">
      <!-- 顶栏 -->
      <BPageHeader :title="litter.dam_name + (litter.litter_number ? `第${litter.litter_number}窝` : '窝')">
        <template #right>
          <view class="edit-btn" @click="onEdit">
            <text class="material-icons-round" style="font-size: 18px; color: var(--text-2);">edit</text>
          </view>
        </template>
      </BPageHeader>

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
            <text style="font-size: 18px;">{{ puppyEmoji(puppy) }}</text>
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

        <!-- 操作按钮 -->
        <view class="action-buttons">
          <view class="action-row">
            <BButton color="teal" @click="goWeightEntry" style="flex: 1;">
              <text class="material-icons-round" style="font-size: 16px; margin-right: 6px;">monitor_weight</text>
              记录体重
            </BButton>
            <BButton variant="ghost" @click="addPuppy" style="flex: 1;">
              <text class="material-icons-round" style="font-size: 16px; margin-right: 6px;">add</text>
              添加幼崽
            </BButton>
          </view>
          <BButton
            v-if="!litter.weaned_at"
            color="amber"
            size="large"
            :loading="weaning"
            @click="confirmWeaning"
            style="width: 100%;"
          >
            <text class="material-icons-round" style="font-size: 16px; margin-right: 6px;">check_circle</text>
            确认断奶
          </BButton>
        </view>
      </view>
    </template>

    <!-- 共享输入弹窗 -->
    <BModal
      v-model:visible="showPrompt"
      :title="promptTitle"
      :content="promptContent"
      @confirm="handlePromptConfirm"
    >
      <view class="custom-input-wrap">
        <input
          v-model="promptInput"
          class="custom-input"
          :placeholder="promptPlaceholder"
        />
      </view>
    </BModal>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { queueSubmitFeedback } from '@/composables/useSubmitFeedback'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BCard from '@/components/base/BCard.vue'
import BTag from '@/components/base/BTag.vue'
import BButton from '@/components/base/BButton.vue'
import BSectionLabel from '@/components/base/BSectionLabel.vue'
import BSkeleton from '@/components/feedback/BSkeleton.vue'
import BEmpty from '@/components/feedback/BEmpty.vue'
import BModal from '@/components/layout/BModal.vue'

const litter = ref<any>(null)
const puppies = ref<any[]>([])
const weaning = ref(false)
const loading = ref(true)
let litterId = ''
let sourceTaskId = ''

const { run: fetchDetail } = useCloudCall<{ data: any }>('breeding-service', 'getLitterDetail')
const { run: doWeaning } = useCloudCall('breeding-service', 'confirmWeaning', { successMessage: '已确认断奶' })
const { run: doAddPuppy } = useCloudCall('breeding-service', 'addPuppyToLitter', { successMessage: '已添加' })
const { run: doUpdateBirthDate } = useCloudCall('breeding-service', 'updateBirthDate', { successMessage: '已更新' })
const { run: doUpdateNotes } = useCloudCall('breeding-service', 'updateLitter', { successMessage: '备注已更新' })
const { run: completeTask } = useCloudCall('task-service', 'completeTask', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

// 共享输入弹窗状态
const showPrompt = ref(false)
const promptTitle = ref('')
const promptContent = ref('')
const promptPlaceholder = ref('')
const promptInput = ref('')
let promptResolve: ((val: string) => Promise<void>) | null = null

function openPrompt(title: string, placeholder: string, value: string, callback: (val: string) => Promise<void>, content = '') {
  promptTitle.value = title
  promptContent.value = content
  promptPlaceholder.value = placeholder
  promptInput.value = value
  promptResolve = callback
  showPrompt.value = true
}

async function handlePromptConfirm() {
  if (promptResolve) {
    try {
      await promptResolve(promptInput.value)
    } catch (e: any) {
      uni.showToast({ title: e.message || '操作失败', icon: 'none' })
    }
  }
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

function onEdit() {
  uni.showActionSheet({
    itemList: ['修改生产日期', '修改备注'],
    success: (res) => {
      if (res.tapIndex === 0) {
        openPrompt(
          '修改生产日期',
          formatDate(litter.value?.birth_date),
          formatDate(litter.value?.birth_date),
          async (val) => {
            const newDate = new Date(val + 'T00:00:00+08:00').getTime()
            await doUpdateBirthDate(litterId, newDate)
            loadData()
          },
          '生产日期只能调整 ±3 天',
        )
      } else if (res.tapIndex === 1) {
        openPrompt(
          '修改备注',
          '输入备注内容',
          litter.value?.birth_notes || '',
          async (val) => {
            await doUpdateNotes(litterId, { birth_notes: val || '' })
            loadData()
          },
        )
      }
    },
  })
}

function puppyEmoji(puppy: any) {
  const emojis = ['🐾', '🐶', '🐕', '🐩']
  const idx = puppies.value.indexOf(puppy)
  return emojis[idx % emojis.length]
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
  uni.showModal({
    title: '确认断奶',
    content: '确认该窝幼崽已完成断奶？',
    success: async (res) => {
      if (res.confirm) {
        weaning.value = true
        try {
          await doWeaning(litterId)
          if (sourceTaskId) {
            await completeTask(sourceTaskId)
            queueSubmitFeedback({
              message: '已确认断奶并处理待办',
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
    },
  })
}

function addPuppy() {
  openPrompt(
    '添加幼崽',
    '幼崽名称（选填）',
    '',
    async (val) => {
      await doAddPuppy(litterId, { name: val || '' })
      loadData()
    },
  )
}

onLoad((query) => {
  litterId = query?.id || ''
  sourceTaskId = query?.taskId || ''
  if (litterId) loadData()
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

.card-feed {
  padding: 0 var(--space-page);
  display: flex;
  flex-direction: column;
  gap: var(--space-card-gap);
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
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-row {
  display: flex;
  gap: 8px;
}
</style>
