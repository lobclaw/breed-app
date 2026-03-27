<template>
  <view class="page">
    <BPageHeader :title="isEdit ? '编辑犬只' : '新建犬只'" />

    <!-- 角色选择器 -->
    <view class="role-selector">
      <view
        v-for="r in roleOptions"
        :key="r.value"
        class="role-selector__option"
        :class="{ 'role-selector__option--active': form.role === r.value }"
        @click="form.role = r.value"
      >
        <text>{{ r.label }}</text>
      </view>
    </view>

    <!-- 幼崽提示 -->
    <view v-if="form.role === '幼崽'" class="form-section">
      <view class="hint-box">
        <text class="hint-box__icon material-icons-round">info</text>
        <text class="hint-box__text">如果是刚出生的幼崽，建议通过「生产记录」创建，可自动关联母犬和窝信息</text>
      </view>
    </view>

    <!-- 表单字段 -->
    <view class="form-section">
      <!-- 昵称 -->
      <view class="form-field">
        <view class="field-label">
          <text>昵称</text>
          <text v-if="form.role === '幼崽'" class="field-label__optional">（选填）</text>
        </view>
        <input
          v-model="form.name"
          class="field-input"
          :placeholder="form.role === '幼崽' ? '选填，可稍后设置' : '请输入犬只名称'"
        />
      </view>

      <!-- 性别 -->
      <view class="form-field">
        <view class="field-label"><text>性别</text></view>
        <view class="segmented">
          <view
            class="seg-option"
            :class="{ active: form.gender === '公', locked: form.role === '外部种公' && form.gender === '母' }"
            @click="form.gender = '公'"
          >
            <text>公</text>
          </view>
          <view
            class="seg-option"
            :class="{ active: form.gender === '母', locked: form.role === '外部种公' }"
            @click="form.role !== '外部种公' && (form.gender = '母')"
          >
            <text>母</text>
          </view>
        </view>
      </view>

      <!-- 品种 -->
      <view class="form-field">
        <view class="field-label"><text>品种</text></view>
        <input v-model="form.breed" class="field-input" placeholder="如：马尔济斯" />
      </view>

      <!-- 出生日期 -->
      <view class="form-field">
        <view class="field-label"><text>出生日期</text></view>
        <picker mode="date" :value="birthDateStr" @change="onBirthDateChange">
          <view class="field-input field-input--picker">
            <text :class="{ 'placeholder-text': !form.birth_date }">
              {{ form.birth_date ? birthDateStr : '请选择日期' }}
            </text>
            <text class="material-icons-round field-input__icon">calendar_today</text>
          </view>
        </picker>
      </view>

      <!-- 外部种公额外字段 -->
      <view v-if="form.role === '外部种公'" class="form-field">
        <view class="field-label">
          <text>主人信息</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <input
          v-model="form.owner_info"
          class="field-input"
          placeholder="主人姓名/犬舍名"
        />
      </view>
    </view>

    <!-- 提交按钮 -->
    <view class="btn-footer">
      <button
        class="btn-full"
        :class="{ 'btn-full--disabled': !canSubmit }"
        :loading="submitting"
        :disabled="!canSubmit"
        @click="submit"
      >
        <text v-if="!isEdit" class="material-icons-round" style="font-size: 20px;">add_circle</text>
        {{ isEdit ? '保存修改' : '创建犬只' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'

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
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 100px;
}

/* ---- 角色选择器 ---- */
.role-selector {
  display: flex;
  background: var(--card-dim);
  border-radius: 14px;
  padding: 4px;
  gap: 3px;
  margin: 0 var(--space-page) 16px;

  &__option {
    flex: 1;
    height: 42px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-2);
    transition: all 0.2s ease;

    &--active {
      background: var(--primary);
      color: #fff;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(234, 62, 119, 0.25);
    }
  }
}

/* ---- 幼崽提示 ---- */
.hint-box {
  background: var(--amber-soft);
  border-radius: 12px;
  padding: 10px 14px;
  display: flex;
  align-items: flex-start;
  gap: 8px;

  &__icon {
    font-size: 18px;
    color: var(--amber);
    flex-shrink: 0;
    margin-top: 1px;
  }

  &__text {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-2);
    line-height: 1.5;
  }
}

/* ---- 表单区域 ---- */
.form-section {
  padding: 0 var(--space-page);
  margin-bottom: 16px;
}

/* ---- 表单字段 ---- */
.form-field {
  margin-bottom: 14px;
}

.field-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-2);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;

  &__optional {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-3);
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
  outline: none;
  transition: border-color 0.2s;

  &:focus {
    border-color: var(--primary);
  }

  &::placeholder {
    color: var(--text-3);
    font-weight: 500;
  }

  &--picker {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__icon {
    font-size: 18px;
    color: var(--text-3);
  }
}

.placeholder-text {
  color: var(--text-3);
  font-weight: 500;
}

/* ---- 性别切换 (segmented) ---- */
.segmented {
  display: flex;
  background: var(--card-dim);
  border-radius: 12px;
  padding: 3px;
  gap: 2px;
}

.seg-option {
  flex: 1;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  transition: all 0.2s ease;

  &.active {
    background: var(--card);
    color: var(--primary);
    font-weight: 700;
    box-shadow: var(--shadow);
  }

  &.locked {
    opacity: 0.5;
  }
}

/* ---- 提交按钮 ---- */
.btn-footer {
  padding: 16px var(--space-page) 0;
}

.btn-full {
  width: 100%;
  height: 50px;
  border-radius: var(--radius-btn);
  border: none;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  background: var(--primary);
  box-shadow: 0 4px 16px rgba(234, 62, 119, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.12s ease;

  &:active:not(.btn-full--disabled) {
    transform: scale(0.97);
    opacity: 0.9;
  }

  &--disabled {
    opacity: 0.4;
  }
}
</style>
