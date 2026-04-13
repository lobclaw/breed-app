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

      <!-- 性别（编辑模式锁定） -->
      <view class="form-field">
        <view class="field-label">
          <text>性别</text>
          <text v-if="isEdit" class="field-label__locked">
            <text class="material-icons-round" style="font-size: 12px; vertical-align: middle;">lock</text> 创建后不可修改
          </text>
        </view>
        <view class="pill-select" :class="{ 'pill-select--locked': isEdit }">
          <view
            class="pill-select__item"
            :class="{ 'pill-select__item--active': form.gender === '母' }"
            @click="!isEdit && form.role !== '外部种公' && (form.gender = '母')"
          >
            <text>母</text>
          </view>
          <view
            class="pill-select__item"
            :class="{ 'pill-select__item--active': form.gender === '公' }"
            @click="!isEdit && (form.gender = '公')"
          >
            <text>公</text>
          </view>
        </view>
      </view>

      <!-- 品种（编辑模式锁定） -->
      <view class="form-field">
        <view class="field-label">
          <text>品种</text>
          <text v-if="isEdit" class="field-label__locked">
            <text class="material-icons-round" style="font-size: 12px; vertical-align: middle;">lock</text> 创建后不可修改
          </text>
        </view>
        <view class="pill-select" :class="{ 'pill-select--locked': isEdit }">
          <view
            v-for="b in breedOptions"
            :key="b"
            class="pill-select__item"
            :class="{ 'pill-select__item--active': form.breed === b }"
            @click="!isEdit && (form.breed = b)"
            @longpress="(!isEdit && !PRESET_BREEDS.includes(b)) ? deleteCustomBreed(b) : undefined"
          >
            <text>{{ b }}</text>
          </view>
          <view
            v-if="customBreed && !breedOptions.includes(customBreed)"
            class="pill-select__item"
            :class="{ 'pill-select__item--active': form.breed === customBreed }"
            @click="!isEdit && (form.breed = customBreed)"
          >
            <text>{{ customBreed }}</text>
          </view>
          <view v-if="!isEdit" class="pill-select__add" @click="addCustomBreed">
            <text class="material-icons-round" style="font-size: 14px;">add</text>
            <text>自定义</text>
          </view>
        </view>
      </view>

      <!-- 出生日期 -->
      <view class="form-field">
        <view class="field-label">
          <text>出生日期</text>
          <text v-if="form.role === '外部种公'" class="field-label__optional">（选填）</text>
        </view>
        <picker mode="date" :value="birthDateStr" @change="onBirthDateChange">
          <view class="field-input field-input--picker">
            <text :class="{ 'placeholder-text': !form.birth_date }">
              {{ form.birth_date ? birthDateStr : '请选择日期' }}
            </text>
            <text class="material-icons-round field-input__icon">calendar_today</text>
          </view>
        </picker>
      </view>

      <!-- 购入日期（种狗） -->
      <view v-if="form.role === '种狗'" class="form-field">
        <view class="field-label">
          <text>购入日期</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <picker mode="date" :value="purchaseDateStr" @change="onPurchaseDateChange">
          <view class="field-input field-input--picker">
            <text :class="{ 'placeholder-text': !form.purchase_date }">
              {{ form.purchase_date ? purchaseDateStr : '年 / 月 / 日' }}
            </text>
            <text class="material-icons-round field-input__icon">calendar_today</text>
          </view>
        </picker>
      </view>

      <!-- 购入价格（种狗） -->
      <view v-if="form.role === '种狗'" class="form-field">
        <view class="field-label">
          <text>购入价格</text>
          <text class="field-label__optional">（选填）</text>
        </view>
        <view class="field-input-prefix">
          <text class="field-input-prefix__symbol">¥</text>
          <input v-model="purchasePriceInput" class="field-input field-input--prefixed" type="digit" placeholder="0" />
        </view>
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

    <!-- 固定底部按钮 -->
    <view class="fixed-bottom">
      <button
        class="submit-btn"
        :loading="submitting"
        :disabled="!canSubmit || submitting"
        @click="submit"
      >
        {{ isEdit ? '保存修改' : '创建犬只' }}
      </button>
    </view>

    <BModal
      v-model:visible="showDeleteConfirm"
      :title="`删除「${pendingDeleteVal}」？`"
      confirmText="删除"
      :danger="true"
      @confirm="handleDeleteConfirm"
    />

    <!-- 自定义品种弹窗 -->
    <BModal
      v-model:visible="showBreedModal"
      title="自定义品种"
      @confirm="onBreedConfirm"
    >
      <view class="custom-input-wrap">
        <input
          v-model="breedInput"
          class="custom-input"
          placeholder="输入品种名称"
          :focus="showBreedModal"
        />
      </view>
    </BModal>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import { useAuth } from '@/composables/useAuth'
import BPageHeader from '@/components/layout/BPageHeader.vue'
import BModal from '@/components/layout/BModal.vue'
import { useDogStore } from '@/stores/dogStore'

const dogStore = useDogStore()
const { currentFamily, loadFamily } = useAuth()

const isEdit = ref(false)
let editDogId = ''

const form = reactive({
  name: '',
  gender: '母' as '公' | '母' | '',
  role: '种狗' as string,
  breed: '马尔济斯',
  birth_date: null as number | null,
  purchase_date: null as number | null,
  owner_info: '',
})

const purchasePriceInput = ref('')

const submitting = ref(false)

const PRESET_BREEDS = ['马尔济斯', '西施', '约克夏']
const deletedCustomBreeds = ref<string[]>([])
const breedOptions = computed(() => {
  const custom = (currentFamily.value?.settings?.custom_breed_types || [])
    .filter((v: string) => !deletedCustomBreeds.value.includes(v))
  const all = [...PRESET_BREEDS, ...custom]
  return [...new Set(all)]
})
const customBreed = ref('')
const showBreedModal = ref(false)
const breedInput = ref('')
const showDeleteConfirm = ref(false)
const pendingDeleteVal = ref('')
let confirmDeleteFn: (() => Promise<void>) | null = null

function addCustomBreed() {
  breedInput.value = ''
  showBreedModal.value = true
}

const { run: updateFamilySettings } = useCloudCall('family-service', 'updateSettings')

function deleteCustomBreed(val: string) {
  pendingDeleteVal.value = val
  confirmDeleteFn = async () => {
    uni.vibrateShort()
    deletedCustomBreeds.value.push(val)
    if (form.breed === val) form.breed = PRESET_BREEDS[0]
    if (customBreed.value === val) customBreed.value = ''
    const existing = currentFamily.value?.settings?.custom_breed_types || []
    const updated = existing.filter((v: string) => v !== val)
    try {
      await updateFamilySettings({ custom_breed_types: updated })
      await loadFamily()
      deletedCustomBreeds.value = deletedCustomBreeds.value.filter(v => v !== val)
    } catch {
      deletedCustomBreeds.value = deletedCustomBreeds.value.filter(v => v !== val)
      uni.showToast({ title: '删除失败', icon: 'none' })
    }
  }
  showDeleteConfirm.value = true
}

async function handleDeleteConfirm() {
  if (confirmDeleteFn) { await confirmDeleteFn(); confirmDeleteFn = null }
}

async function onBreedConfirm() {
  if (!breedInput.value.trim()) { showBreedModal.value = false; return }

  const val = breedInput.value.trim()
  customBreed.value = val
  form.breed = val
  showBreedModal.value = false

  if (!PRESET_BREEDS.includes(val)) {
    const existing = currentFamily.value?.settings?.custom_breed_types || []
    if (!existing.includes(val)) {
      await updateFamilySettings({ custom_breed_types: [...existing, val] })
      await loadFamily()
    }
  }
}

// 切换角色时自动设置性别（编辑模式不触发，避免覆盖已加载的性别）
watch(() => form.role, (role) => {
  if (isEdit.value) return
  form.gender = role === '外部种公' ? '公' : '母'
})

const roleOptions = [
  { label: '种狗', value: '种狗' },
  { label: '幼崽', value: '幼崽' },
  { label: '外部种公', value: '外部种公' },
]

const canSubmit = computed(() => {
  if (!form.gender) return false
  if (!form.role) return false
  if (form.role !== '幼崽' && !form.name.trim()) return false
  if (form.role === '外部种公' && form.gender !== '公') return false
  // 种狗和幼崽必须填出生日期，外部种公选填
  if (form.role !== '外部种公' && !form.birth_date) return false
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

const purchaseDateStr = computed(() => {
  if (!form.purchase_date) return ''
  const d = new Date(form.purchase_date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

function onPurchaseDateChange(e: any) {
  form.purchase_date = new Date(e.detail.value + 'T00:00:00+08:00').getTime()
}

const { run: createDog } = useCloudCall('dog-service', 'createDog', { successMessage: '已添加' })
const { run: updateDog } = useCloudCall('dog-service', 'updateDog', { successMessage: '已更新' })
const { run: updateDogName } = useCloudCall('dog-service', 'updateDogName')
const { run: fetchDetail } = useCloudCall<{ data: any }>('dog-service', 'getDogDetail')
let originalName = ''

async function submit() {
  submitting.value = true

  try {
    const dogData = {
      name: form.name.trim(),
      gender: form.gender,
      role: form.role,
      breed: form.breed,
      birth_date: form.birth_date,
      purchase_date: form.purchase_date || null,
      purchase_price: purchasePriceInput.value ? parseFloat(purchasePriceInput.value) : null,
      owner_info: form.owner_info || null,
    }

    if (isEdit.value) {
      await updateDog(editDogId, dogData)
      // 名称变更时单独调用（updateDog 不处理 name；幼崽可清空名称）
      if (dogData.name !== originalName) {
        await updateDogName(editDogId, dogData.name)
      }
      // 更新缓存
      dogStore.updateDog(editDogId, dogData as any)
    } else {
      const res = await createDog(dogData)
      // 新增到缓存
      if (res?.data?._id) {
        dogStore.addDog({ _id: res.data._id, ...dogData } as any)
      }
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
      originalName = dog.name || ''
      form.gender = dog.gender
      form.role = dog.role
      form.breed = dog.breed || ''
      form.birth_date = dog.birth_date
      form.purchase_date = dog.purchase_date || null
      form.owner_info = dog.owner_info || ''
      if (dog.purchase_price) purchasePriceInput.value = String(dog.purchase_price)
    }
  }
})
</script>

<style lang="scss" scoped>

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
  font-weight: 700;
  color: var(--text-2);
  margin-bottom: 6px;
  align-items: center;

  &__optional {
    font-size: 11px;
    font-weight: 500;
  }
  &__locked {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-4);
    margin-left: 6px;
  }
  display: flex;
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
  box-sizing: border-box;
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

.field-input-prefix {
  position: relative;
  display: flex;
  align-items: center;

  &__symbol {
    position: absolute;
    left: 16px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-3);
    z-index: 1;
    pointer-events: none;
  }
}

.field-input--prefixed {
  padding-left: 34px;
}

/* ---- Pill 单选 (locked modifier) ---- */
.pill-select__item {
  &.locked {
    opacity: 0.5;
  }
}
.pill-select--locked {
  pointer-events: none;
  opacity: 0.75;
}

</style>
