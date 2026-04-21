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
      :key="url"
      class="b-image-upload__item"
      @click="previewImage(index)"
      @longpress="confirmDelete(index)"
    >
      <image class="b-image-upload__img" :src="url" mode="aspectFill" />
      <view class="b-image-upload__delete" @click.stop="confirmDelete(index)">
        <text class="material-icons-round" style="font-size: 14px; color: #FFFFFF;">close</text>
      </view>
    </view>

    <!-- 添加按钮 -->
    <view
      v-if="images.length < max"
      class="b-image-upload__add"
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
import { computed, ref } from 'vue'
import BModal from '@/components/layout/BModal.vue'

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
const showDeleteConfirm = ref(false)
const pendingDeleteIndex = ref(-1)

function chooseImage() {
  const remaining = props.max - images.value.length
  if (remaining <= 0) return

  uni.chooseImage({
    count: remaining,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: async (res) => {
      const newUrls: string[] = []
      for (const path of res.tempFilePaths) {
        try {
          const uploadRes = await uniCloud.uploadFile({
            filePath: path,
            cloudPath: `images/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`,
          })
          if (uploadRes.fileID) {
            newUrls.push(uploadRes.fileID)
          }
        } catch (e) {
          console.error('上传图片失败', e)
          uni.showToast({ title: '上传失败', icon: 'none' })
        }
      }
      if (newUrls.length) {
        emit('update:modelValue', [...images.value, ...newUrls])
      }
    },
  })
}

function previewImage(index: number) {
  uni.previewImage({
    current: index,
    urls: images.value,
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
