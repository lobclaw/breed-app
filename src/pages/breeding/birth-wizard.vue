<template>
  <view class="page">
    <!-- 顶栏 + 步骤指示器 -->
    <view class="page-header">
      <view class="back-btn" @click="onBack">
        <text class="material-icons-round" style="font-size: 20px; color: var(--text-1);">arrow_back_ios_new</text>
      </view>
      <text class="page-title">记录生产</text>
      <view class="step-dots">
        <view
          v-for="i in 3"
          :key="i"
          class="step-dot"
          :class="{
            'step-dot--active': step === i,
            'step-dot--done': step > i,
          }"
        />
      </view>
    </view>

    <!-- Step 1: 生产信息 -->
    <view v-if="step === 1" class="form-area">
      <!-- 母犬信息卡 -->
      <view class="form-section">
        <view class="section-title">
          <view class="section-dot" style="background: var(--rose);" />
          <text>母犬信息</text>
        </view>
        <view class="dog-info-card">
          <view class="dog-info-row">
            <view class="dog-avatar">
              <BEntityIcon :size="22" color="#fff" />
            </view>
            <view class="dog-info-text">
              <text class="dog-name">{{ damName }}</text>
              <text class="dog-breed">马尔济斯 · 种母</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 生产信息 -->
      <view class="form-section">
        <view class="section-title">
          <view class="section-dot" style="background: var(--primary);" />
          <text>生产信息</text>
        </view>

        <view class="form-field">
          <text class="field-label">实际生产日期</text>
          <picker mode="date" :value="birthDateStr" @change="onBirthDateChange">
            <view class="field-input-wrap">
              <text class="field-input-text" :class="{ 'field-input-text--empty': !form.birth_date }">
                {{ form.birth_date ? birthDateStr : '请选择' }}
              </text>
              <text class="material-icons-round" style="font-size: 18px; color: var(--text-3);">calendar_today</text>
            </view>
          </picker>
          <view class="date-chips">
            <view
              v-for="chip in dateChips"
              :key="chip.label"
              class="date-chip"
              :class="{ 'date-chip--active': chip.ts === form.birth_date }"
              @click="form.birth_date = chip.ts"
            >
              <text>{{ chip.label }}</text>
            </view>
          </view>
        </view>

        <view class="form-field">
          <text class="field-label">生产方式</text>
          <view class="pill-select">
            <view
              v-for="t in birthTypes"
              :key="t"
              class="pill-select__item"
              :class="{ 'pill-select__item--active': form.birth_type === t }"
              @click="form.birth_type = t"
            >
              <text>{{ t }}</text>
            </view>
          </view>
        </view>

        <view class="form-field">
          <text class="field-label">费用 <text class="optional">（选填）</text></text>
          <view class="field-wrapper">
            <text class="field-prefix">¥</text>
            <input v-model="costInput" class="field-input" type="digit" placeholder="如剖腹产费用" />
          </view>
        </view>
      </view>
    </view>

    <!-- Step 2: 录入幼崽 -->
    <view v-if="step === 2" class="form-area">
      <view class="form-section">
        <view class="section-title">
          <view class="section-dot" style="background: var(--rose);" />
          <text>幼崽录入</text>
          <view class="count-badge">
            <text>已添加 {{ puppies.length }} 只</text>
          </view>
        </view>

        <view v-for="(puppy, idx) in puppies" :key="idx" class="puppy-card">
          <view class="puppy-card-header">
            <text class="puppy-number">幼崽 {{ idx + 1 }}</text>
            <view class="puppy-header-right">
              <view class="toggle-row">
                <text class="toggle-label-text">存活</text>
                <view class="toggle" :class="{ 'toggle--off': puppy.alive === false }" @click="puppy.alive = !puppy.alive">
                  <view class="toggle-knob" />
                </view>
              </view>
              <view v-if="puppies.length > 1" class="puppy-delete" @click="removePuppy(idx)">
                <text class="material-icons-round" style="font-size: 18px;">close</text>
              </view>
            </view>
          </view>

          <view class="puppy-fields">
            <view class="form-field">
              <text class="field-label">性别</text>
              <view class="pill-select">
                <view class="pill-select__item" :class="{ 'pill-select__item--active': puppy.gender === '母' }" @click="puppy.gender = '母'">
                  <text>母</text>
                </view>
                <view class="pill-select__item" :class="{ 'pill-select__item--active': puppy.gender === '公' }" @click="puppy.gender = '公'">
                  <text>公</text>
                </view>
              </view>
            </view>

            <view class="form-field">
              <text class="field-label">出生体重</text>
              <view class="field-wrapper">
                <input v-model="puppy.weight" class="field-input" type="digit" placeholder="克" style="padding-right: 32px;" />
                <text class="field-suffix">g</text>
              </view>
            </view>

            <view class="form-field full-width">
              <text class="field-label">标识/昵称 <text class="optional">（选填）</text></text>
              <input v-model="puppy.name" class="field-input" :placeholder="`${damName}窝-${idx + 1}号`" />
              <text class="field-help">未填写时将自动生成默认名称</text>
            </view>
          </view>
        </view>

        <!-- 添加幼崽 -->
        <view class="add-puppy-card" @click="addPuppy">
          <text class="material-icons-round" style="font-size: 22px; color: var(--primary);">add</text>
          <text style="font-size: 14px; font-weight: 700; color: var(--primary);">添加下一只</text>
        </view>
      </view>
    </view>

    <!-- Step 3: 确认 -->
    <view v-if="step === 3" class="form-area">
      <view class="form-section">
        <view class="section-title">
          <view class="section-dot" style="background: var(--rose);" />
          <text>生产摘要</text>
        </view>
        <view class="summary-card">
          <view class="summary-row">
            <text class="summary-label">母犬</text>
            <text class="summary-value">{{ damName }}</text>
          </view>
          <view class="summary-row">
            <text class="summary-label">生产日期</text>
            <text class="summary-value">{{ birthDateStr }}</text>
          </view>
          <view class="summary-row">
            <text class="summary-label">生产方式</text>
            <text class="summary-value">{{ form.birth_type }}</text>
          </view>
          <view class="summary-row">
            <text class="summary-label">幼崽</text>
            <text class="summary-value summary-value--highlight">
              共 {{ puppies.length }} 只（{{ maleCount }}公{{ femaleCount }}母）· 存活 {{ aliveCount }} 只
            </text>
          </view>
          <view class="summary-row">
            <text class="summary-label">费用</text>
            <text class="summary-value">¥{{ costInput || '0' }}</text>
          </view>
        </view>
      </view>

      <view class="form-section">
        <view class="section-title">
          <view class="section-dot" style="background: var(--green);" />
          <text>幼崽详情</text>
        </view>
        <view v-for="(puppy, idx) in puppies" :key="idx" class="puppy-summary-item">
          <view class="puppy-summary-icon">
            <text style="font-size: 14px;">{{ puppy.alive === false ? '💀' : puppy.gender === '公' ? '♂' : '♀' }}</text>
          </view>
          <text class="puppy-summary-text">
            {{ puppy.name || `${damName}窝-${idx + 1}号` }}
            <text style="color: var(--text-3);"> · {{ puppy.gender }}{{ puppy.weight ? ` · ${puppy.weight}g` : '' }}{{ puppy.alive === false ? ' · 死胎' : '' }}</text>
          </text>
          <text class="material-icons-round" style="font-size: 16px; color: var(--primary);">check_circle</text>
        </view>
      </view>

      <view class="form-section">
        <view class="section-title">
          <view class="section-dot" style="background: var(--primary);" />
          <text>后续安排</text>
        </view>

        <view class="followup-card">
          <view class="form-field">
            <text class="field-label">经验心得 <text class="optional">（选填）</text></text>
            <textarea
              v-model="form.birth_notes"
              class="field-textarea"
              maxlength="300"
              placeholder="记录生产过程、照护要点或后续观察重点"
            />
          </view>

          <view class="form-field" style="margin-bottom: 0;">
            <view class="check-row" @click="form.create_first_deworming_task = !form.create_first_deworming_task">
              <view class="check-row__box" :class="{ 'check-row__box--checked': form.create_first_deworming_task }">
                <text v-if="form.create_first_deworming_task" class="check-row__icon material-icons-round">check</text>
              </view>
              <view class="check-row__content">
                <text class="check-row__label">首次驱虫提醒</text>
                <text class="check-row__desc">仅创建待办，后续补录时再选择具体驱虫类型</text>
              </view>
            </view>

            <view class="check-row" @click="form.create_first_vaccination_task = !form.create_first_vaccination_task">
              <view class="check-row__box" :class="{ 'check-row__box--checked': form.create_first_vaccination_task }">
                <text v-if="form.create_first_vaccination_task" class="check-row__icon material-icons-round">check</text>
              </view>
              <view class="check-row__content">
                <text class="check-row__label">首次疫苗提醒</text>
                <text class="check-row__desc">仅创建待办，后续补录时再选择具体疫苗类型</text>
              </view>
            </view>

            <text class="field-help field-help--tight">幼崽昵称未填写时将自动生成默认名称</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部按钮 -->
    <view class="btn-footer">
      <view v-if="step > 1" class="btn-back" @click="step--">
        <text class="material-icons-round" style="font-size: 18px;">arrow_back</text>
      </view>
      <button
        v-if="step < 3"
        class="btn-next"
        :disabled="!canNext"
        @click="step++"
      >
        <text>{{ step === 1 ? '下一步：录入幼崽' : '下一步：确认' }}</text>
        <text class="material-icons-round" style="font-size: 18px;">arrow_forward</text>
      </button>
      <button
        v-if="step === 3"
        class="btn-next"
        :disabled="submitState === 'submitting'"
        @click="submit"
      >
        <text>{{ submitButtonText }}</text>
        <text v-if="submitState !== 'submitting'" class="material-icons-round" style="font-size: 18px;">check</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { queueSubmitFeedback, SUBMIT_SUCCESS_FEEDBACK_DELAY_MS, wait } from '@/composables/useSubmitFeedback'
import BEntityIcon from '@/components/base/BEntityIcon.vue'

let cycleId = ''
const damName = ref('花花')

const step = ref(1)
const submitState = ref<'idle' | 'submitting' | 'success'>('idle')
const costInput = ref('')

const form = reactive({
  birth_date: null as number | null,
  birth_type: '顺产',
  birth_notes: '',
  create_first_deworming_task: false,
  create_first_vaccination_task: false,
})

const birthTypes = ['顺产', '助产', '剖腹产']

interface PuppyEntry {
  name: string
  gender: '公' | '母'
  weight: string
  alive: boolean
}

const puppies = reactive<PuppyEntry[]>([
  { name: '', gender: '母', weight: '', alive: true },
])

const aliveCount = computed(() => puppies.filter(p => p.alive !== false).length)
const deadCount = computed(() => puppies.filter(p => p.alive === false).length)
const maleCount = computed(() => puppies.filter(p => p.gender === '公').length)
const femaleCount = computed(() => puppies.filter(p => p.gender === '母').length)

const birthDateStr = computed(() => {
  if (!form.birth_date) return ''
  const d = new Date(form.birth_date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const dateChips = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return [
    { label: '今天', ts: today.getTime() },
    { label: '昨天', ts: today.getTime() - 86400000 },
    { label: '前天', ts: today.getTime() - 172800000 },
  ]
})

const canNext = computed(() => {
  if (step.value === 1) return !!form.birth_date
  if (step.value === 2) return puppies.length > 0
  return true
})

const submitButtonText = computed(() => {
  if (submitState.value === 'submitting') return '保存中...'
  if (submitState.value === 'success') return '已保存'
  return '提交生产记录'
})

function onBack() {
  if (step.value > 1) {
    step.value--
  } else {
    uni.navigateBack({ delta: 1 })
  }
}

function onBirthDateChange(e: any) {
  form.birth_date = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
}

function addPuppy() {
  puppies.push({ name: '', gender: '母', weight: '', alive: true })
}

function removePuppy(idx: number) {
  puppies.splice(idx, 1)
}

const { run: addBirthRecord } = useCloudCall('breeding-service', 'addBirthRecord', {
  successMode: 'silent',
  loadingMode: 'local',
  throwOnError: true,
})

async function submit() {
  submitState.value = 'submitting'
  try {
    const cost = costInput.value ? parseFloat(costInput.value) : null

    const res = await addBirthRecord({
      cycle_id: cycleId,
      birth_date: form.birth_date,
      birth_type: form.birth_type,
      birth_notes: form.birth_notes || null,
      create_first_deworming_task: form.create_first_deworming_task,
      create_first_vaccination_task: form.create_first_vaccination_task,
      cost: cost && cost > 0 ? cost : null,
      puppies: puppies.map(p => ({
        name: p.name.trim() || '',
        gender: p.gender,
        weight: p.weight ? parseFloat(p.weight) : null,
        alive: p.alive,
      })),
    })

    if (res) {
      submitState.value = 'success'
      queueSubmitFeedback({
        message: '已保存生产记录',
        homeSection: 'breeding',
        homeAnchorKey: 'breeding-step:weaning_confirm',
      })
      await wait(SUBMIT_SUCCESS_FEEDBACK_DELAY_MS)
      uni.navigateBack({ delta: 1 })
    }
  } catch {
    submitState.value = 'idle'
  } finally {
    if (submitState.value !== 'success') submitState.value = 'idle'
  }
}

onLoad((query) => {
  cycleId = query?.cycleId || ''
  if (!cycleId) {
    uni.showToast({ title: '缺少周期信息', icon: 'none' })
  }
  if (query?.damName) damName.value = query.damName

  // 默认日期为今天
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  form.birth_date = today.getTime()
})
</script>

<style lang="scss" scoped>
.page {
  padding-bottom: 100px;
}

/* 顶栏 */
.page-header {
  display: flex;
  align-items: center;
  padding: 8px var(--space-page) 12px;
  gap: 12px;
}

.back-btn {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  background: var(--card);
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.12s ease;
  &:active { transform: scale(0.9); }
}

.page-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-1);
  font-family: var(--font-display);
  flex: 1;
}

/* 步骤指示器 */
.step-dots {
  display: flex;
  gap: 6px;
  align-items: center;
}

.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-4);
  transition: all 0.2s ease;

  &--active {
    background: var(--primary);
    width: 20px;
    border-radius: var(--radius-progress);
  }

  &--done {
    background: var(--primary);
  }
}

/* 表单区域 */
.form-area {
  padding: 0 var(--space-page);
}

.form-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.5px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.count-badge {
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 12px;
  font-weight: 800;
  padding: 2px 10px;
  border-radius: var(--radius-tag);
  margin-left: auto;
}

/* 母犬信息卡 */
.dog-info-card {
  background: var(--card-dim);
  border-radius: var(--radius-row);
  padding: 14px 16px;
}

.dog-info-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dog-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ea3e77, #e89b3e);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dog-info-text {
  flex: 1;
}

.dog-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
  display: block;
}

.dog-breed {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 1px;
  display: block;
}

/* 表单字段 */
.form-field {
  margin-bottom: 14px;
}

.field-label {
  font-weight: 700;
  color: var(--text-2);
  margin-bottom: 6px;
  align-items: center;
}

.optional {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
}

.field-input-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 44px;
  border-radius: 12px;
  border: 1.5px solid var(--text-4);
  background: var(--card);
  padding: 0 14px;
}

.field-input-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);

  &--empty {
    color: var(--text-3);
    font-weight: 500;
  }
}

.field-input {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  border: 1.5px solid var(--text-4);
  background: var(--card);
  padding: 0 14px;
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--primary);
  }
}

.field-help {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-3);

  &--tight {
    margin-top: 10px;
  }
}

.field-textarea {
  width: 100%;
  min-height: 92px;
  border-radius: 12px;
  border: 1.5px solid var(--text-4);
  background: var(--card);
  padding: 12px 14px;
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.5;
  box-sizing: border-box;
}

.field-wrapper {
  position: relative;
}

.field-prefix {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  font-weight: 700;
  color: var(--text-2);
}

.field-suffix {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-3);
}

.field-wrapper .field-input {
  padding-left: 32px;
}

/* 日期快捷 */
.date-chips {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.date-chip {
  padding: 4px 12px;
  border-radius: var(--radius-tag);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
  background: var(--card-dim);
  transition: all 0.12s ease;
  &:active { transform: scale(0.92); filter: brightness(0.95); }

  &--active {
    background: var(--primary);
    color: #fff;
    box-shadow: 0 2px 8px rgba(234, 62, 119, 0.25);
  }
}

/* 幼崽卡片 */
.puppy-card {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow);
  margin-bottom: 10px;
  position: relative;
  overflow: hidden;
  border-left: 3.5px solid var(--rose);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    background: linear-gradient(135deg, var(--rose-soft) 0%, transparent 40%);
    pointer-events: none;
  }

  & > * {
    position: relative;
    z-index: 1;
  }
}

.puppy-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.puppy-number {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}

.puppy-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.puppy-delete {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-4);
  transition: all 0.12s ease;
  &:active {
    transform: scale(0.85);
    color: var(--red);
    background: var(--red-soft);
  }
}

.puppy-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;

  .form-field {
    margin-bottom: 0;
  }

  .full-width {
    grid-column: 1 / -1;
  }
}

/* Toggle */
.toggle-row {
  display: flex;
  align-items: center;
}

.toggle-label-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
  margin-right: 8px;
}

.toggle {
  width: 46px;
  height: 26px;
  border-radius: var(--radius-progress);
  background: var(--primary);
  position: relative;
  transition: background 0.2s ease;
}

.toggle--off {
  background: var(--text-4);
}

.toggle-knob {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  position: absolute;
  top: 2px;
  right: 2px;
  box-shadow: 0 1px 4px rgba(234, 62, 119, 0.06);
  transition: all 0.2s ease;
}

.toggle--off .toggle-knob {
  right: auto;
  left: 2px;
}

/* 添加幼崽 */
.add-puppy-card {
  border: 2px dashed var(--text-4);
  border-radius: var(--radius-card);
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.15s ease;
  &:active { transform: scale(0.98); }
}

/* 摘要卡片 */
.summary-card {
  background: var(--card-dim);
  border-radius: var(--radius-row);
  padding: 16px;
  margin-bottom: 12px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;

  &:not(:last-child) {
    border-bottom: 1px solid rgba(216, 203, 189, 0.3);
  }
}

.summary-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
}

.summary-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);

  &--highlight {
    color: var(--primary);
  }
}

/* 幼崽摘要列表 */
.puppy-summary-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--card);
  border-radius: 12px;
  margin-bottom: 6px;
  box-shadow: var(--shadow);
}

.puppy-summary-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--rose-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.puppy-summary-text {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.followup-card {
  background: var(--card-dim);
  border-radius: var(--radius-row);
  padding: 16px;
}

.check-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;

  &:not(:last-of-type) {
    border-bottom: 1px solid rgba(216, 203, 189, 0.28);
  }
}

.check-row__box {
  width: 20px;
  height: 20px;
  border-radius: 7px;
  border: 1.5px solid var(--text-4);
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;

  &--checked {
    background: var(--primary);
    border-color: var(--primary);
  }
}

.check-row__icon {
  font-size: 13px;
  color: #fff;
}

.check-row__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.check-row__label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}

.check-row__desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-3);
}

/* 底部按钮 */
.btn-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 10px;
  padding: 16px var(--space-page);
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  background: var(--bg);
}

.btn-back {
  width: 50px;
  height: 50px;
  border-radius: var(--radius-btn);
  background: var(--card);
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-1);
  transition: transform 0.12s ease;
  &:active { transform: scale(0.94); }
}

.btn-next {
  flex: 1;
  height: 50px;
  border-radius: var(--radius-btn);
  background: var(--primary);
  color: #fff;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.12s ease;
  box-shadow: 0 4px 16px rgba(234, 62, 119, 0.25);

  &:active:not([disabled]) {
    transform: scale(0.97);
    opacity: 0.9;
  }

  &[disabled] {
    opacity: 0.5;
  }
}
</style>
