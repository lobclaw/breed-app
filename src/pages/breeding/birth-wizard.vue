<template>
  <view class="wizard">
    <!-- 步骤指示器 -->
    <view class="wizard__steps">
      <view v-for="i in 3" :key="i" class="wizard__step" :class="{ 'wizard__step--active': step >= i, 'wizard__step--current': step === i }">
        <text>{{ i }}</text>
      </view>
    </view>

    <!-- Step 1: 基本信息 -->
    <view v-if="step === 1" class="wizard__content">
      <view class="wizard__section">
        <text class="wizard__section-title">生产信息</text>

        <view class="wizard__field">
          <text class="wizard__label">生产日期</text>
          <picker mode="date" :value="birthDateStr" @change="onBirthDateChange">
            <text class="wizard__picker" :class="{ 'wizard__picker--empty': !form.birth_date }">
              {{ form.birth_date ? birthDateStr : '请选择' }}
            </text>
          </picker>
        </view>

        <view class="wizard__field">
          <text class="wizard__label">生产方式</text>
          <view class="wizard__options">
            <view
              v-for="t in birthTypes"
              :key="t"
              class="wizard__option"
              :class="{ 'wizard__option--active': form.birth_type === t }"
              @click="form.birth_type = t"
            >
              <text>{{ t }}</text>
            </view>
          </view>
        </view>

        <view class="wizard__field">
          <text class="wizard__label">费用(¥)</text>
          <input v-model="costInput" class="wizard__input" type="digit" placeholder="选填" />
        </view>

        <view class="wizard__field">
          <text class="wizard__label">备注</text>
          <input v-model="form.birth_notes" class="wizard__input" placeholder="选填" />
        </view>
      </view>
    </view>

    <!-- Step 2: 录入幼崽 -->
    <view v-if="step === 2" class="wizard__content">
      <view class="wizard__section">
        <text class="wizard__section-title">幼崽信息（{{ puppies.length }}只）</text>

        <view v-for="(puppy, idx) in puppies" :key="idx" class="wizard__puppy">
          <view class="wizard__puppy-header">
            <text class="wizard__puppy-num">#{{ idx + 1 }}</text>
            <text v-if="puppies.length > 1" class="wizard__puppy-remove" @click="removePuppy(idx)">删除</text>
          </view>

          <view class="wizard__field">
            <text class="wizard__label">名称</text>
            <input v-model="puppy.name" class="wizard__input" placeholder="选填，可稍后命名" />
          </view>

          <view class="wizard__field">
            <text class="wizard__label">性别</text>
            <view class="wizard__options">
              <view
                class="wizard__option"
                :class="{ 'wizard__option--active': puppy.gender === '母' }"
                @click="puppy.gender = '母'"
              >
                <text>♀ 母</text>
              </view>
              <view
                class="wizard__option"
                :class="{ 'wizard__option--active': puppy.gender === '公' }"
                @click="puppy.gender = '公'"
              >
                <text>♂ 公</text>
              </view>
            </view>
          </view>

          <view class="wizard__field">
            <text class="wizard__label">体重(g)</text>
            <input v-model="puppy.weight" class="wizard__input" type="digit" placeholder="选填" />
          </view>

          <view class="wizard__field">
            <text class="wizard__label">状态</text>
            <view class="wizard__options">
              <view
                class="wizard__option"
                :class="{ 'wizard__option--active': puppy.alive !== false }"
                @click="puppy.alive = true"
              >
                <text>存活</text>
              </view>
              <view
                class="wizard__option wizard__option--dead"
                :class="{ 'wizard__option--active': puppy.alive === false }"
                @click="puppy.alive = false"
              >
                <text>死胎</text>
              </view>
            </view>
          </view>
        </view>

        <view class="wizard__add-puppy" @click="addPuppy">
          <text>+ 添加幼崽</text>
        </view>
      </view>
    </view>

    <!-- Step 3: 确认 -->
    <view v-if="step === 3" class="wizard__content">
      <view class="wizard__section">
        <text class="wizard__section-title">确认信息</text>

        <view class="wizard__summary">
          <view class="wizard__summary-row">
            <text class="wizard__summary-label">生产日期</text>
            <text>{{ birthDateStr }}</text>
          </view>
          <view class="wizard__summary-row">
            <text class="wizard__summary-label">生产方式</text>
            <text>{{ form.birth_type }}</text>
          </view>
          <view class="wizard__summary-row">
            <text class="wizard__summary-label">总数</text>
            <text>{{ puppies.length }}只</text>
          </view>
          <view class="wizard__summary-row">
            <text class="wizard__summary-label">存活</text>
            <text>{{ aliveCount }}只</text>
          </view>
          <view v-if="deadCount > 0" class="wizard__summary-row">
            <text class="wizard__summary-label">死胎</text>
            <text class="wizard__summary-dead">{{ deadCount }}只</text>
          </view>
          <view v-if="costInput" class="wizard__summary-row">
            <text class="wizard__summary-label">费用</text>
            <text>¥{{ costInput }}</text>
          </view>
        </view>

        <view class="wizard__puppy-list">
          <view v-for="(puppy, idx) in puppies" :key="idx" class="wizard__puppy-preview">
            <text class="wizard__puppy-preview-name">{{ puppy.name || `幼崽${idx + 1}` }}</text>
            <text class="wizard__puppy-preview-info">
              {{ puppy.gender }} {{ puppy.weight ? `· ${puppy.weight}g` : '' }} {{ puppy.alive === false ? '· 死胎' : '' }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部导航 -->
    <view class="wizard__footer">
      <button v-if="step > 1" class="wizard__btn" @click="step--">上一步</button>
      <button
        v-if="step < 3"
        class="wizard__btn wizard__btn--primary"
        :disabled="!canNext"
        @click="step++"
      >
        下一步
      </button>
      <button
        v-if="step === 3"
        class="wizard__btn wizard__btn--primary"
        :loading="submitting"
        @click="submit"
      >
        提交生产记录
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'

let cycleId = ''

const step = ref(1)
const submitting = ref(false)
const costInput = ref('')

const form = reactive({
  birth_date: null as number | null,
  birth_type: '顺产',
  birth_notes: '',
})

const birthTypes = ['顺产', '难产', '剖腹产']

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

const birthDateStr = computed(() => {
  if (!form.birth_date) return ''
  const d = new Date(form.birth_date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const canNext = computed(() => {
  if (step.value === 1) return !!form.birth_date
  if (step.value === 2) return puppies.length > 0
  return true
})

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
  successMessage: '生产记录已保存',
  showLoading: true,
  loadingText: '保存中...',
})

async function submit() {
  submitting.value = true
  try {
    const cost = costInput.value ? parseFloat(costInput.value) : null

    const res = await addBirthRecord({
      cycle_id: cycleId,
      birth_date: form.birth_date,
      birth_type: form.birth_type,
      birth_notes: form.birth_notes || null,
      cost: cost && cost > 0 ? cost : null,
      puppies: puppies.map(p => ({
        name: p.name.trim() || '',
        gender: p.gender,
        weight: p.weight ? parseFloat(p.weight) : null,
        alive: p.alive,
      })),
    })

    if (res) {
      // 返回两级（回到周期详情）
      uni.navigateBack({ delta: 1 })
    }
  } finally {
    submitting.value = false
  }
}

onLoad((query) => {
  cycleId = query?.cycleId || ''
  if (!cycleId) {
    uni.showToast({ title: '缺少周期信息', icon: 'none' })
  }

  // 默认日期为今天
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  form.birth_date = today.getTime()
})
</script>

<style scoped>
.wizard {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 140rpx;
}

.wizard__steps {
  display: flex;
  justify-content: center;
  gap: 40rpx;
  padding: 32rpx;
  background: #fff;
}

.wizard__step {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #e0e0e0;
  color: #999;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wizard__step--active {
  background: #007AFF;
  color: #fff;
}

.wizard__step--current {
  box-shadow: 0 0 0 4rpx rgba(0, 122, 255, 0.3);
}

.wizard__content {
  padding: 16rpx 32rpx;
}

.wizard__section {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
}

.wizard__section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}

.wizard__field {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.wizard__field:last-child {
  border-bottom: none;
}

.wizard__label {
  width: 160rpx;
  font-size: 28rpx;
  color: #333;
  flex-shrink: 0;
}

.wizard__input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.wizard__picker {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.wizard__picker--empty {
  color: #ccc;
}

.wizard__options {
  display: flex;
  gap: 12rpx;
  flex: 1;
}

.wizard__option {
  padding: 10rpx 24rpx;
  border-radius: 20rpx;
  background: #f5f5f5;
  font-size: 26rpx;
  color: #666;
}

.wizard__option--active {
  background: #007AFF;
  color: #fff;
}

.wizard__option--dead.wizard__option--active {
  background: #FF3B30;
}

.wizard__puppy {
  background: #fafafa;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 16rpx;
}

.wizard__puppy-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.wizard__puppy-num {
  font-size: 26rpx;
  font-weight: 600;
  color: #007AFF;
}

.wizard__puppy-remove {
  font-size: 24rpx;
  color: #FF3B30;
}

.wizard__add-puppy {
  text-align: center;
  padding: 24rpx;
  color: #007AFF;
  font-size: 28rpx;
  border: 2rpx dashed #007AFF;
  border-radius: 12rpx;
  margin-top: 8rpx;
}

.wizard__summary {
  margin-bottom: 24rpx;
}

.wizard__summary-row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  font-size: 28rpx;
  color: #333;
}

.wizard__summary-label {
  color: #999;
}

.wizard__summary-dead {
  color: #FF3B30;
}

.wizard__puppy-list {
  border-top: 1rpx solid #f0f0f0;
  padding-top: 16rpx;
}

.wizard__puppy-preview {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  font-size: 26rpx;
}

.wizard__puppy-preview-name {
  color: #333;
  font-weight: 500;
}

.wizard__puppy-preview-info {
  color: #999;
}

.wizard__footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 20rpx;
  padding: 20rpx 32rpx;
  background: #fff;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
}

.wizard__btn {
  flex: 1;
  height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  background: #f5f5f5;
  color: #333;
}

.wizard__btn--primary {
  background: #007AFF;
  color: #fff;
}

.wizard__btn--primary[disabled] {
  opacity: 0.5;
}
</style>
