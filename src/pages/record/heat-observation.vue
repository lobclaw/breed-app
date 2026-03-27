<!--
  R-19 发情观察 — 快速监测日志模式
  录入发情期观察数据：外阴状态 + 征兆勾选 + 补充说明
-->
<template>
  <view class="heat-observation">
    <!-- 页面标题栏 -->
    <BPageHeader title="录入发情观察" :subtitle="headerSubtitle" />

    <!-- 犬只选择卡片 -->
    <view class="heat-observation__dog-card" @click="showDogPicker = true">
      <view class="heat-observation__dog-card-bg" />
      <view class="heat-observation__dog-info">
        <view class="heat-observation__avatar">
          <text class="material-icons-round" style="font-size: 22px; color: #FFFFFF;">pets</text>
        </view>
        <view class="heat-observation__dog-detail">
          <text class="heat-observation__dog-name">{{ selectedDog?.name || '点击选择犬只' }}</text>
          <text class="heat-observation__dog-meta">{{ selectedDog?.meta || '请先选择一只犬' }}</text>
        </view>
      </view>
      <text class="material-icons-round" style="font-size: 20px; color: var(--text-4); position: relative; z-index: 1;">chevron_right</text>
    </view>

    <!-- 主要内容 -->
    <view class="heat-observation__content">

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

      <!-- 征兆勾选 -->
      <view class="heat-observation__section">
        <view class="heat-observation__label">
          <view class="heat-observation__label-dot" />
          <text class="heat-observation__label-text">观察到的征兆</text>
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

      <!-- 时间 + 保存 -->
      <view class="heat-observation__bottom">
        <view class="heat-observation__save-btn" @click="handleSave">
          <text class="heat-observation__save-text">保存记录</text>
        </view>
        <view class="heat-observation__time" @click="pickTime">
          <text class="material-icons-round" style="font-size: 14px; color: var(--text-3);">schedule</text>
          <text class="heat-observation__time-text">{{ displayTime }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onLoad } from '@dcloudio/uni-app'
import BPageHeader from '@/components/layout/BPageHeader.vue'

// 接收页面参数（如从犬只详情页跳入）
const dogId = ref('')
const selectedDog = ref<{ name: string; meta: string; id: string } | null>(null)
const showDogPicker = ref(false)

// 外阴状态选项
const vulvaOptions = ['硬/肿胀', '开始软化', '完全松软']
const vulvaStatus = ref('')

// 征兆列表
const symptoms = ['桃子硬', '桃子软', '接受爬跨', '出血量变化', '行为异常', '外阴肿胀', '频繁排尿', '食欲变化']
const selectedSymptoms = ref<string[]>([])

// 备注
const notes = ref('')

// 时间
const recordTime = ref(new Date())
const displayTime = computed(() => {
  const h = String(recordTime.value.getHours()).padStart(2, '0')
  const m = String(recordTime.value.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
})

const headerSubtitle = computed(() => {
  if (selectedDog.value) return selectedDog.value.meta
  return ''
})

onLoad((query: any) => {
  if (query?.dogId) {
    dogId.value = query.dogId
    // 加载犬只信息
    loadDogInfo(query.dogId)
  }
  if (query?.dogName) {
    selectedDog.value = {
      id: query.dogId || '',
      name: query.dogName,
      meta: query.dogMeta || '马尔济斯 · 种母',
    }
  }
})

async function loadDogInfo(id: string) {
  try {
    const db = uniCloud.database()
    const res = await db.collection('dogs').doc(id).get()
    const dog = res.result?.data?.[0]
    if (dog) {
      selectedDog.value = {
        id: dog._id,
        name: dog.name,
        meta: `${dog.breed || '马尔济斯'} · ${dog.role || '种母'}`,
      }
    }
  } catch (e) {
    console.error('加载犬只信息失败', e)
  }
}

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

async function handleSave() {
  if (!selectedDog.value) {
    uni.showToast({ title: '请选择犬只', icon: 'none' })
    return
  }
  if (!vulvaStatus.value) {
    uni.showToast({ title: '请选择外阴状态', icon: 'none' })
    return
  }

  uni.showLoading({ title: '保存中...' })
  try {
    const db = uniCloud.database()
    await db.collection('health_records').add({
      type: 'heat_observation',
      dog_id: selectedDog.value.id,
      vulva_status: vulvaStatus.value,
      symptoms: selectedSymptoms.value,
      notes: notes.value,
      record_time: recordTime.value.getTime(),
      created_at: Date.now(),
    })
    uni.hideLoading()
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack({ delta: 1 })
    }, 1200)
  } catch (e) {
    uni.hideLoading()
    console.error('保存失败', e)
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.heat-observation {
  min-height: 100vh;
  background: var(--bg);

  /* 犬只选择卡片 */
  &__dog-card {
    margin: 0 var(--space-page) 12px;
    background: var(--card);
    border-radius: var(--radius-card);
    padding: 14px 16px;
    box-shadow: var(--shadow);
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
    transition: all 0.15s ease;
    &:active { transform: scale(0.975); }
  }

  &__dog-card-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%);
    border-radius: var(--radius-card);
    pointer-events: none;
  }

  &__dog-info {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    z-index: 1;
  }

  &__avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ea3e77, #e89b3e);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__dog-detail {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__dog-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
  }

  &__dog-meta {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-3);
  }

  /* 内容 */
  &__content {
    padding: 0 var(--space-page) 32px;
    display: flex;
    flex-direction: column;
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

  /* 底部 */
  &__bottom {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 4px;
  }

  &__save-btn {
    width: 100%;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-btn);
    background: var(--rose);
    box-shadow: 0 4px 16px rgba(234, 62, 119, 0.25);
    transition: all 0.12s ease;
    &:active { transform: scale(0.94); opacity: 0.85; }
  }

  &__save-text {
    font-size: 15px;
    font-weight: 700;
    color: #FFFFFF;
  }

  &__time {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  &__time-text {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-3);
  }
}
</style>
