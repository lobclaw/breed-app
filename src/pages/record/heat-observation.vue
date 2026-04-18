<!--
  R-19 发情观察 — 快速监测日志模式
  录入发情期观察数据：外阴状态 + 分泌物状态 + 行为征兆 + 补充说明
-->
<template>
  <view class="page heat-observation">
    <!-- 页面标题栏 -->
    <BPageHeader title="录入发情观察" :subtitle="headerSubtitle" />

    <!-- 犬只选择 -->
    <view class="form-body heat-observation__content">
      <BDogPicker v-model="selectedDog" roleFilter="种狗" genderFilter="母" title="选择种母" :readonly="dogLocked" />

      <!-- 外阴状态分段选择 -->
      <view class="heat-observation__section">
        <view class="heat-observation__label">
          <view class="heat-observation__label-dot" />
          <text class="heat-observation__label-text">外阴状态</text>
        </view>
        <view class="heat-observation__segments">
          <view
            v-for="opt in vulvaOptions"
            :key="opt"
            class="heat-observation__segment"
            :class="{ 'heat-observation__segment--active': vulvaStatus === opt }"
            @click="vulvaStatus = opt"
          >
            <text class="heat-observation__segment-text">{{ opt }}</text>
          </view>
        </view>
      </view>

      <!-- 分泌物状态分段选择 -->
      <view class="heat-observation__section">
        <view class="heat-observation__label">
          <view class="heat-observation__label-dot" />
          <text class="heat-observation__label-text">分泌物状态</text>
        </view>
        <view class="heat-observation__segments heat-observation__segments--grid">
          <view
            v-for="opt in dischargeOptions"
            :key="opt"
            class="heat-observation__segment"
            :class="{ 'heat-observation__segment--active': dischargeStatus === opt }"
            @click="dischargeStatus = opt"
          >
            <text class="heat-observation__segment-text">{{ opt }}</text>
          </view>
        </view>
      </view>

      <!-- 征兆勾选 -->
      <view class="heat-observation__section">
        <view class="heat-observation__label">
          <view class="heat-observation__label-dot" />
          <text class="heat-observation__label-text">行为征兆</text>
        </view>
        <view class="heat-observation__symptom-grid">
          <view
            v-for="s in symptoms"
            :key="s"
            class="heat-observation__symptom"
            :class="{ 'heat-observation__symptom--selected': selectedSymptoms.includes(s) }"
            @click="toggleSymptom(s)"
          >
            <text
              v-if="selectedSymptoms.includes(s)"
              class="material-icons-round"
              style="font-size: 16px; color: var(--primary);"
            >check</text>
            <text class="heat-observation__symptom-text">{{ s }}</text>
          </view>
        </view>
      </view>

      <!-- 补充说明 -->
      <view class="heat-observation__section">
        <view class="heat-observation__label">
          <view class="heat-observation__label-dot" />
          <text class="heat-observation__label-text">补充说明</text>
          <text class="heat-observation__label-optional">（选填）</text>
        </view>
        <textarea
          v-model="notes"
          class="heat-observation__textarea"
          placeholder="补充观察到的其他情况..."
          :maxlength="500"
        />
      </view>
    </view>

    <view class="fixed-bottom">
      <button
        class="submit-btn"
        :class="{ 'submit-btn--success': submitState === 'success' }"
        :disabled="!canSubmit || submitState === 'submitting'"
        @click="handleSave"
      >
        {{ submitButtonText }}
      </button>
      <view class="heat-observation__time" @click="pickTime">
        <text class="material-icons-round" style="font-size: 14px; color: var(--text-3);">schedule</text>
        <text class="heat-observation__time-text">{{ displayTime }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { queueSubmitFeedback, wait } from '@/composables/useSubmitFeedback'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BDogPicker from '@/components/form/BDogPicker.vue'

// 犬只选择
const selectedDog = ref<any>(null)
const dogLocked = ref(false)
const cycleId = ref('')

// 外阴状态选项
const vulvaOptions = ['硬/肿胀', '开始软化', '明显松软']
const vulvaStatus = ref('')
const dischargeOptions = ['鲜红较多', '暗红减少', '淡粉/草黄色', '接近透明']
const dischargeStatus = ref('')

// 征兆列表
const symptoms = [
  '主动靠近公犬',
  '接受爬跨',
  '翘尾侧偏',
  '频繁排尿',
  '舔舐外阴增多',
]
const selectedSymptoms = ref<string[]>([])

// 备注
const notes = ref('')

// 时间
const recordTime = ref(new Date())
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const displayTime = computed(() => {
  const h = String(recordTime.value.getHours()).padStart(2, '0')
  const m = String(recordTime.value.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
})
const canSubmit = computed(() => {
  return !!selectedDog.value && !!vulvaStatus.value && !!dischargeStatus.value && submitState.value !== 'submitting'
})
const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '提交中...'
  if (submitState.value === 'success') return '已保存'
  return '保存记录'
})

const headerSubtitle = computed(() => {
  if (selectedDog.value) return `${selectedDog.value.gender || ''} · ${selectedDog.value.role || ''}`
  return ''
})

onLoad((query: any) => {
  cycleId.value = query?.cycleId || ''
  if (query?.dogId) {
    selectedDog.value = {
      _id: query.dogId,
      name: query?.dogName ? decodeURIComponent(query.dogName) : '',
      gender: '母',
      role: '种狗',
    }
    if (query?.locked === 'true' || query?.dogName) dogLocked.value = true
  }
})

function toggleSymptom(s: string) {
  const idx = selectedSymptoms.value.indexOf(s)
  if (idx >= 0) {
    selectedSymptoms.value.splice(idx, 1)
  } else {
    selectedSymptoms.value.push(s)
  }
}

function pickTime() {
  // #ifdef APP-PLUS || MP
  uni.showActionSheet({
    itemList: ['使用当前时间'],
    success: () => {
      recordTime.value = new Date()
    },
  })
  // #endif
}

const { run: addBreedingRecord } = useCloudCall('breeding-service', 'addBreedingRecord', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

async function handleSave() {
  if (submitState.value === 'submitting') return
  if (!selectedDog.value) {
    uni.showToast({ title: '请选择犬只', icon: 'none' })
    return
  }
  if (!vulvaStatus.value) {
    uni.showToast({ title: '请选择外阴状态', icon: 'none' })
    return
  }
  if (!dischargeStatus.value) {
    uni.showToast({ title: '请选择分泌物状态', icon: 'none' })
    return
  }

  submitState.value = 'submitting'
  try {
    const res = await addBreedingRecord({
      type: 'heat_observation',
      dog_id: selectedDog.value._id,
      cycle_id: cycleId.value || undefined,
      date: recordTime.value.getTime(),
      details: {
        vulva_status: vulvaStatus.value,
        discharge_status: dischargeStatus.value,
        symptoms: selectedSymptoms.value,
      },
      notes: notes.value || null,
    })
    if (res) {
      submitState.value = 'success'
      queueSubmitFeedback({ message: '已保存观察记录' })
      await wait(140)
      uni.navigateBack({ delta: 1 })
    }
  } catch {
    submitState.value = 'idle'
  } finally {
    if (submitState.value !== 'success') submitState.value = 'idle'
  }
}
</script>

<style lang="scss" scoped>
.heat-observation {
  min-height: 100vh;
  background: var(--bg);

  /* 内容 */
  &__content {
    gap: 20px;
  }

  &__section {}

  /* 分区标签 */
  &__label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__label-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--rose);
    flex-shrink: 0;
  }

  &__label-text {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
  }

  &__label-optional {
    font-size: 13px;
    font-weight: 400;
    color: var(--text-3);
  }

  /* 分段选择器 */
  &__segments {
    display: flex;
    gap: 8px;
  }

  &__segments--grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  &__segment {
    flex: 1;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: var(--card-dim);
    transition: all 0.15s ease;
    &:active { transform: scale(0.94); filter: brightness(0.95); }

    &--active {
      background: var(--rose);
      box-shadow: 0 4px 12px rgba(234, 62, 119, 0.25);
    }
  }

  &__segment-text {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-2);
  }

  &__segment--active &__segment-text {
    color: #FFFFFF;
  }

  /* 征兆网格 */
  &__symptom-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  &__symptom {
    height: 44px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    border-radius: 14px;
    background: var(--card-dim);
    transition: all 0.12s ease;
    &:active { transform: scale(0.94); filter: brightness(0.95); }

    &--selected {
      background: var(--primary-soft);
    }
  }

  &__symptom-text {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-2);
  }

  &__symptom--selected &__symptom-text {
    color: var(--primary);
    font-weight: 600;
  }

  /* 文本域 */
  &__textarea {
    width: 100%;
    min-height: 60px;
    padding: 12px 14px;
    border: 1.5px solid var(--text-4);
    border-radius: 14px;
    background: var(--card);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    color: var(--text-1);
    transition: border-color 0.15s ease;
  }

  &__time {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin-top: 10px;
  }

  &__time-text {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
  }
}
</style>
