<!--
  BImageUpload — 图片上传组件
  3列网格展示已上传图片，支持添加、预览、删除
  Props:
    modelValue — 图片 URL 数组
    max — 最大数量（默认 9）
  Emits:
    update:modelValue — URL 数组变化
-->
<template>
  <view class="b-image-upload">
    <!-- 已上传图片 -->
    <view
      v-for="(url, index) in images"
      :key="`${url}_${index}`"
      class="b-image-upload__item"
      @click="previewImage(index)"
      @longpress="confirmDelete(index)"
    >
      <image v-if="displayImageUrls[index]" class="b-image-upload__img" :src="displayImageUrls[index]" mode="aspectFill" />
      <view v-else class="b-image-upload__placeholder">
        <text class="material-icons-round b-image-upload__placeholder-icon">image</text>
      </view>
      <view class="b-image-upload__delete" @click.stop="confirmDelete(index)">
        <text class="material-icons-round" style="font-size: 14px; color: #FFFFFF;">close</text>
      </view>
    </view>

    <!-- 添加按钮 -->
    <view
      v-if="images.length < max"
      class="b-image-upload__add"
      :class="{ 'b-image-upload__add--loading': choosing }"
      @click="chooseImage"
    >
      <text class="material-icons-round b-image-upload__add-icon">add</text>
      <text class="b-image-upload__add-text">{{ images.length }}/{{ max }}</text>
    </view>

    <BModal
      v-model:visible="showDeleteConfirm"
      title="删除图片"
      content="确定要删除这张图片吗？"
      confirmText="删除"
      :danger="true"
      @confirm="handleDeleteConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BModal from '@/components/layout/BModal.vue'
import { chooseLocalImages, resolveImageDisplayUrls, resolveImageSafeSrc } from '@/utils/imageAttachment'

const props = withDefaults(defineProps<{
  modelValue?: string[]
  max?: number
}>(), {
  modelValue: () => [],
  max: 9,
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const images = computed(() => props.modelValue || [])
const displayUrls = ref<string[]>([])
const displayImageUrls = computed(() => images.value.map((url, index) => {
  return resolveImageSafeSrc(url, displayUrls.value[index])
}))
const showDeleteConfirm = ref(false)
const pendingDeleteIndex = ref(-1)
const choosing = ref(false)

async function refreshDisplayUrls() {
  const currentImages = images.value
  const urls = await resolveImageDisplayUrls(currentImages)
  if (currentImages !== images.value) return
  displayUrls.value = urls
}

watch(images, () => {
  void refreshDisplayUrls()
}, { immediate: true })

async function chooseImage() {
  if (choosing.value) return
  const remaining = props.max - images.value.length
  if (remaining <= 0) return

  choosing.value = true
  try {
    const result = await chooseLocalImages(remaining, { profile: 'record' })
    if (result.paths.length) {
      emit('update:modelValue', [...images.value, ...result.paths])
    }
    if (result.warnings.length) {
      uni.showToast({ title: result.warnings[0], icon: 'none' })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '选择图片失败'
    uni.showToast({ title: message, icon: 'none' })
  } finally {
    choosing.value = false
  }
}

async function previewImage(index: number) {
  const urls = await resolveImageDisplayUrls(images.value)
  uni.previewImage({
    current: urls[index] || index,
    urls,
  })
}

function confirmDelete(index: number) {
  pendingDeleteIndex.value = index
  showDeleteConfirm.value = true
}

function handleDeleteConfirm() {
  if (pendingDeleteIndex.value < 0) return
  const updated = [...images.value]
  updated.splice(pendingDeleteIndex.value, 1)
  emit('update:modelValue', updated)
  pendingDeleteIndex.value = -1
}
</script>

<style lang="scss" scoped>
.b-image-upload {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;

  &__item {
    position: relative;
    aspect-ratio: 1;
    border-radius: var(--radius-row);
    overflow: hidden;
    transition: transform 0.12s ease;
    &:active { transform: scale(0.94); }
  }

  &__img {
    width: 100%;
    height: 100%;
  }

  &__placeholder {
    width: 100%;
    height: 100%;
    background: var(--card-dim);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__placeholder-icon {
    font-family: 'Material Icons Round';
    font-size: 24px;
    color: var(--text-4);
  }

  &__delete {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__add {
    aspect-ratio: 1;
    border-radius: var(--radius-row);
    border: 2px dashed var(--text-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all 0.12s ease;
    background: transparent;

    &:active { transform: scale(0.94); border-color: var(--primary); }

    &--loading {
      opacity: 0.58;
      pointer-events: none;
    }
  }

  &__add-icon {
    font-family: 'Material Icons Round';
    font-size: 28px;
    color: var(--text-4);
  }

  &__add-text {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
  }
}
</style>
