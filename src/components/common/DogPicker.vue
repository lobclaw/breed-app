<template>
  <view class="dog-picker">
    <view class="dog-picker__trigger" @click="open">
      <view v-if="selectedDogs.length > 0" class="dog-picker__selected">
        <view v-for="dog in selectedDogs" :key="dog._id" class="dog-picker__tag">
          <DogAvatar :name="dog.name" :size="40" />
          <text class="dog-picker__tag-name">{{ dog.name }}</text>
          <text v-if="multiple" class="dog-picker__tag-remove" @click.stop="removeDog(dog._id)">×</text>
        </view>
      </view>
      <text v-else class="dog-picker__placeholder">{{ placeholder }}</text>
    </view>

    <!-- 选择弹窗 -->
    <uni-popup ref="popupRef" type="bottom">
      <view class="dog-picker__popup">
        <view class="dog-picker__header">
          <text class="dog-picker__title">选择犬只</text>
          <text class="dog-picker__confirm" @click="confirm">确定</text>
        </view>

        <!-- 筛选栏 -->
        <view class="dog-picker__filters">
          <view
            v-for="filter in filters"
            :key="filter.value"
            class="dog-picker__filter-item"
            :class="{ 'dog-picker__filter-item--active': activeFilter === filter.value }"
            @click="activeFilter = filter.value"
          >
            <text>{{ filter.label }}</text>
          </view>
        </view>

        <!-- 犬只列表 -->
        <scroll-view scroll-y class="dog-picker__list">
          <view
            v-for="dog in filteredDogs"
            :key="dog._id"
            class="dog-picker__item"
            :class="{ 'dog-picker__item--selected': isSelected(dog._id) }"
            @click="toggleDog(dog)"
          >
            <DogAvatar :name="dog.name" :size="64" />
            <view class="dog-picker__item-info">
              <text class="dog-picker__item-name">{{ dog.name }}</text>
              <text class="dog-picker__item-meta">{{ dog.gender }} · {{ roleLabel(dog.role) }}</text>
            </view>
            <view v-if="isSelected(dog._id)" class="dog-picker__check">✓</view>
          </view>
          <view v-if="filteredDogs.length === 0" class="dog-picker__empty">
            <text>暂无犬只</text>
          </view>
        </scroll-view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import DogAvatar from './DogAvatar.vue'

interface DogOption {
  _id: string
  name: string
  gender: string
  role: string
}

const props = withDefaults(defineProps<{
  /** 可选犬只列表 */
  dogs?: DogOption[]
  /** 已选中的犬只 ID */
  modelValue?: string | string[]
  /** 是否多选 */
  multiple?: boolean
  /** 占位文字 */
  placeholder?: string
  /** 可选角色筛选 */
  roleFilter?: string[]
}>(), {
  dogs: () => [],
  modelValue: () => [],
  multiple: false,
  placeholder: '请选择犬只',
  roleFilter: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
}>()

const popupRef = ref()
const activeFilter = ref('all')
const tempSelected = ref<string[]>([])

const filters = [
  { label: '全部', value: 'all' },
  { label: '种母', value: '种狗_母' },
  { label: '种公', value: '种狗_公' },
  { label: '幼崽', value: '幼崽' },
  { label: '外部种公', value: '外部种公' },
]

const filteredDogs = computed(() => {
  if (activeFilter.value === 'all') return props.dogs
  return props.dogs.filter(dog => {
    if (activeFilter.value === '种狗_母') return dog.role === '种狗' && dog.gender === '母'
    if (activeFilter.value === '种狗_公') return dog.role === '种狗' && dog.gender === '公'
    return dog.role === activeFilter.value
  })
})

function roleLabel(role: string) {
  if (role === '种狗') return '种犬'
  return role
}

const selectedDogs = computed(() => {
  const ids = Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue].filter(Boolean)
  return props.dogs.filter(d => ids.includes(d._id))
})

function isSelected(dogId: string) {
  return tempSelected.value.includes(dogId)
}

function open() {
  const ids = Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue].filter(Boolean)
  tempSelected.value = [...ids]
  popupRef.value?.open()
}

function toggleDog(dog: DogOption) {
  if (props.multiple) {
    const idx = tempSelected.value.indexOf(dog._id)
    if (idx >= 0) {
      tempSelected.value.splice(idx, 1)
    } else {
      tempSelected.value.push(dog._id)
    }
  } else {
    tempSelected.value = [dog._id]
  }
}

function removeDog(dogId: string) {
  const ids = Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue].filter(Boolean)
  const updated = ids.filter(id => id !== dogId)
  emit('update:modelValue', props.multiple ? updated : (updated[0] || ''))
}

function confirm() {
  emit('update:modelValue', props.multiple ? tempSelected.value : (tempSelected.value[0] || ''))
  popupRef.value?.close()
}
</script>

<style scoped>
.dog-picker__trigger {
  min-height: 72rpx;
  padding: 16rpx 24rpx;
  background: #f8f8f8;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
}

.dog-picker__placeholder {
  color: #999;
  font-size: 28rpx;
}

.dog-picker__selected {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.dog-picker__tag {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: #fff;
  border-radius: 32rpx;
  padding: 4rpx 16rpx 4rpx 4rpx;
}

.dog-picker__tag-name {
  font-size: 26rpx;
}

.dog-picker__tag-remove {
  font-size: 32rpx;
  color: #999;
  padding: 0 8rpx;
}

.dog-picker__popup {
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  max-height: 70vh;
}

.dog-picker__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 32rpx;
  border-bottom: 1rpx solid #eee;
}

.dog-picker__title {
  font-size: 32rpx;
  font-weight: 600;
}

.dog-picker__confirm {
  font-size: 30rpx;
  color: #007AFF;
}

.dog-picker__filters {
  display: flex;
  gap: 16rpx;
  padding: 20rpx 32rpx;
  overflow-x: auto;
}

.dog-picker__filter-item {
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
  background: #f5f5f5;
  font-size: 26rpx;
  white-space: nowrap;
}

.dog-picker__filter-item--active {
  background: #007AFF;
  color: #fff;
}

.dog-picker__list {
  max-height: 50vh;
  padding: 0 32rpx;
}

.dog-picker__item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.dog-picker__item--selected {
  background: #f0f7ff;
  margin: 0 -32rpx;
  padding: 20rpx 32rpx;
}

.dog-picker__item-info {
  flex: 1;
}

.dog-picker__item-name {
  font-size: 30rpx;
  font-weight: 500;
}

.dog-picker__item-meta {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
}

.dog-picker__check {
  color: #007AFF;
  font-size: 36rpx;
  font-weight: bold;
}

.dog-picker__empty {
  text-align: center;
  padding: 60rpx 0;
  color: #999;
  font-size: 28rpx;
}
</style>
