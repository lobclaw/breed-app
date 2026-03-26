<template>
  <view class="dog-avatar" :style="{ width: size + 'rpx', height: size + 'rpx' }">
    <image
      v-if="src"
      :src="src"
      class="dog-avatar__img"
      mode="aspectFill"
    />
    <view v-else class="dog-avatar__placeholder" :style="{ backgroundColor: bgColor }">
      <text class="dog-avatar__text" :style="{ fontSize: fontSize + 'rpx' }">
        {{ initial }}
      </text>
    </view>
    <!-- 状态指示点 -->
    <view
      v-if="statusDot"
      class="dog-avatar__dot"
      :style="{ backgroundColor: statusDotColor }"
    />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** 犬只名称，用于生成首字母 */
  name?: string
  /** 头像图片 URL */
  src?: string
  /** 尺寸（rpx） */
  size?: number
  /** 是否显示状态点 */
  statusDot?: boolean
  /** 状态点颜色 */
  statusDotColor?: string
}>(), {
  name: '',
  src: '',
  size: 80,
  statusDot: false,
  statusDotColor: '#4CAF50',
})

const initial = computed(() => {
  if (!props.name) return '?'
  return props.name.charAt(0)
})

const fontSize = computed(() => Math.round(props.size * 0.4))

// 根据名字生成固定颜色
const bgColor = computed(() => {
  const colors = ['#FF7043', '#AB47BC', '#42A5F5', '#66BB6A', '#FFA726', '#26C6DA', '#EC407A', '#8D6E63']
  if (!props.name) return colors[0]
  let hash = 0
  for (let i = 0; i < props.name.length; i++) {
    hash = props.name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
})
</script>

<style scoped>
.dog-avatar {
  position: relative;
  border-radius: 50%;
  overflow: visible;
  flex-shrink: 0;
}

.dog-avatar__img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.dog-avatar__placeholder {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dog-avatar__text {
  color: #ffffff;
  font-weight: 600;
}

.dog-avatar__dot {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  border: 2rpx solid #ffffff;
}
</style>
