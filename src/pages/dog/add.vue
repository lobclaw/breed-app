<template>
  <view class="dog-add">
    <view class="dog-add__form">
      <!-- 角色选择 -->
      <view class="dog-add__section">
        <text class="dog-add__section-title">角色</text>
        <view class="dog-add__roles">
          <view
            v-for="r in roleOptions"
            :key="r.value"
            class="dog-add__role"
            :class="{ 'dog-add__role--active': form.role === r.value }"
            @click="form.role = r.value"
          >
            <text>{{ r.label }}</text>
          </view>
        </view>
      </view>

      <!-- 基础信息 -->
      <view class="dog-add__section">
        <text class="dog-add__section-title">基础信息</text>

        <view class="dog-add__field">
          <text class="dog-add__label">名称</text>
          <input
            v-model="form.name"
            class="dog-add__input"
            placeholder="犬只名称（幼崽可留空）"
          />
        </view>

        <view class="dog-add__field">
          <text class="dog-add__label">性别</text>
          <view class="dog-add__gender">
            <view
              class="dog-add__gender-btn"
              :class="{ 'dog-add__gender-btn--active': form.gender === '母' }"
              @click="form.gender = '母'"
            >
              <text>♀ 母</text>
            </view>
            <view
              class="dog-add__gender-btn"
              :class="{ 'dog-add__gender-btn--active': form.gender === '公' }"
              @click="form.gender = '公'"
            >
              <text>♂ 公</text>
            </view>
          </view>
        </view>

        <view class="dog-add__field">
          <text class="dog-add__label">品种</text>
          <input
            v-model="form.breed"
            class="dog-add__input"
            placeholder="如：马尔济斯"
          />
        </view>

        <view class="dog-add__field">
          <text class="dog-add__label">出生日期</text>
          <picker mode="date" :value="birthDateStr" @change="onBirthDateChange">
            <text class="dog-add__picker-text" :class="{ 'dog-add__picker-text--placeholder': !form.birth_date }">
              {{ form.birth_date ? birthDateStr : '请选择' }}
            </text>
          </picker>
        </view>

        <!-- 外部种公额外字段 -->
        <view v-if="form.role === '外部种公'" class="dog-add__field">
          <text class="dog-add__label">主人信息</text>
          <input
            v-model="form.owner_info"
            class="dog-add__input"
            placeholder="主人姓名/犬舍名（选填）"
          />
        </view>
      </view>
    </view>

    <!-- 提交按钮 -->
    <view class="dog-add__footer">
      <button
        class="dog-add__submit"
        :loading="submitting"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{ isEdit ? '保存修改' : '添加犬只' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'

const isEdit = ref(false)
let editDogId = ''

const form = reactive({
  name: '',
  gender: '' as '公' | '母' | '',
  role: '种狗' as string,
  breed: '马尔济斯',
  birth_date: null as number | null,
  owner_info: '',
})

const submitting = ref(false)

const roleOptions = [
  { label: '种狗', value: '种狗' },
  { label: '幼崽', value: '幼崽' },
  { label: '外部种公', value: '外部种公' },
]

const canSubmit = computed(() => {
  if (!form.gender) return false
  if (!form.role) return false
  // 幼崽可以不填名称
  if (form.role !== '幼崽' && !form.name.trim()) return false
  // 外部种公锁定为公
  if (form.role === '外部种公' && form.gender !== '公') return false
  return true
})

const birthDateStr = computed(() => {
  if (!form.birth_date) return ''
  const d = new Date(form.birth_date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

function onBirthDateChange(e: any) {
  const dateStr = e.detail.value
  form.birth_date = new Date(dateStr + 'T00:00:00+08:00').getTime()
}

const { run: createDog } = useCloudCall('dog-service', 'createDog', { successMessage: '已添加' })
const { run: updateDog } = useCloudCall('dog-service', 'updateDog', { successMessage: '已更新' })
const { run: fetchDetail } = useCloudCall<{ data: any }>('dog-service', 'getDogDetail')

async function submit() {
  submitting.value = true

  try {
    if (isEdit.value) {
      await updateDog(editDogId, {
        gender: form.gender,
        role: form.role,
        breed: form.breed,
        birth_date: form.birth_date,
        owner_info: form.owner_info || null,
      })
    } else {
      await createDog({
        name: form.name.trim(),
        gender: form.gender,
        role: form.role,
        breed: form.breed,
        birth_date: form.birth_date,
        owner_info: form.owner_info || null,
      })
    }

    uni.navigateBack()
  } finally {
    submitting.value = false
  }
}

onLoad(async (query) => {
  if (query?.id) {
    isEdit.value = true
    editDogId = query.id
    uni.setNavigationBarTitle({ title: '编辑犬只' })

    const res = await fetchDetail(editDogId)
    if (res?.data) {
      const dog = res.data
      form.name = dog.name || ''
      form.gender = dog.gender
      form.role = dog.role
      form.breed = dog.breed || ''
      form.birth_date = dog.birth_date
      form.owner_info = dog.owner_info || ''
    }
  }
})
</script>

<style lang="scss" scoped>
.dog-add {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 70px;
}

.dog-add__form {
  padding: 8px 16px;
}

.dog-add__section {
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: var(--shadow);
}

.dog-add__section-title {
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--text-1);
  margin-bottom: 10px;
}

.dog-add__roles {
  display: flex;
  gap: 8px;
}

.dog-add__role {
  flex: 1;
  text-align: center;
  padding: 8px;
  border-radius: var(--radius-row);
  background: var(--bg);
  font-size: 14px;
  color: var(--text-2);
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.dog-add__role--active {
  background: var(--primary);
  color: var(--card);
}

.dog-add__field {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--bg);
}

.dog-add__field:last-child {
  border-bottom: none;
}

.dog-add__label {
  width: 80px;
  font-size: 14px;
  color: var(--text-1);
  flex-shrink: 0;
}

.dog-add__input {
  flex: 1;
  font-size: 14px;
  color: var(--text-1);
}

.dog-add__gender {
  display: flex;
  gap: 8px;
  flex: 1;
}

.dog-add__gender-btn {
  flex: 1;
  text-align: center;
  padding: 6px;
  border-radius: var(--radius-row);
  background: var(--bg);
  font-size: 14px;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.dog-add__gender-btn--active {
  background: var(--primary);
  color: var(--card);
}

.dog-add__picker-text {
  font-size: 14px;
  color: var(--text-1);
}

.dog-add__picker-text--placeholder {
  color: var(--text-4);
}

.dog-add__footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px 16px;
  background: var(--card);
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  box-shadow: var(--shadow);
}

.dog-add__submit {
  width: 100%;
  height: 44px;
  border-radius: var(--radius-btn);
  background: var(--primary);
  color: var(--card);
  font-size: 16px;
  font-family: var(--font-display);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
  &:active { transform: scale(0.975); }
}

.dog-add__submit[disabled] {
  opacity: 0.5;
}
</style>
