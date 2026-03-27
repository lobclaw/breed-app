<template>
  <view class="page">
    <BPageHeader title="数据备份" />

    <!-- 备份状态卡片 -->
    <view class="backup-card">
      <view class="backup-card__icon-box">
        <text class="material-icons-round" style="font-size: 32px; color: var(--blue);">cloud_done</text>
      </view>
      <text class="backup-card__title">数据备份与导出</text>
      <text class="backup-card__desc">将犬只档案、繁育记录、财务数据导出为文件</text>
      <view v-if="lastBackupDate" class="backup-card__last">
        <text class="material-icons-round" style="font-size: 14px; color: var(--text-3);">history</text>
        <text class="backup-card__last-text">上次备份：{{ lastBackupDate }}</text>
      </view>
    </view>

    <!-- 导出选项 -->
    <view class="export-section">
      <text class="section-label">导出格式</text>
      <view class="export-options">
        <view
          class="export-option"
          :class="{ 'export-option--active': exportFormat === 'json' }"
          @click="exportFormat = 'json'"
        >
          <text class="material-icons-round export-option__icon">data_object</text>
          <view class="export-option__info">
            <text class="export-option__name">JSON</text>
            <text class="export-option__desc">完整数据备份，可用于数据恢复</text>
          </view>
          <text v-if="exportFormat === 'json'" class="material-icons-round" style="font-size: 20px; color: var(--primary);">check_circle</text>
        </view>
        <view
          class="export-option"
          :class="{ 'export-option--active': exportFormat === 'csv' }"
          @click="exportFormat = 'csv'"
        >
          <text class="material-icons-round export-option__icon">table_chart</text>
          <view class="export-option__info">
            <text class="export-option__name">CSV</text>
            <text class="export-option__desc">表格格式，可用 Excel 打开查看</text>
          </view>
          <text v-if="exportFormat === 'csv'" class="material-icons-round" style="font-size: 20px; color: var(--primary);">check_circle</text>
        </view>
      </view>
    </view>

    <!-- 导出按钮 -->
    <view class="export-area">
      <button class="export-btn" :loading="exporting" @click="startExport">
        <text v-if="!exporting" class="material-icons-round" style="font-size: 20px; color: #fff; margin-right: 8px;">download</text>
        导出数据
      </button>

      <!-- 进度条 -->
      <view v-if="exporting" class="export-progress">
        <view class="export-progress__bar">
          <view class="export-progress__fill" :style="{ width: exportProgress + '%' }" />
        </view>
        <text class="export-progress__text">{{ exportProgress }}%</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCloudCall } from '@/composables/useCloudCall'
import BPageHeader from '@/components/layout/BPageHeader.vue'

const exportFormat = ref<'json' | 'csv'>('json')
const exporting = ref(false)
const exportProgress = ref(0)
const lastBackupDate = ref('')

const { run: getBackupInfo } = useCloudCall<{ data: { last_backup?: number } }>('family-service', 'getBackupInfo')
const { run: exportData } = useCloudCall<{ data: { url: string } }>('family-service', 'exportData', {
  showLoading: false,
})

function formatDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function loadInfo() {
  const res = await getBackupInfo()
  if (res?.data?.last_backup) {
    lastBackupDate.value = formatDate(res.data.last_backup)
  }
}

async function startExport() {
  exporting.value = true
  exportProgress.value = 0

  // 模拟进度推进
  const timer = setInterval(() => {
    if (exportProgress.value < 90) {
      exportProgress.value += Math.floor(Math.random() * 15) + 5
      if (exportProgress.value > 90) exportProgress.value = 90
    }
  }, 300)

  try {
    const res = await exportData({ format: exportFormat.value })
    exportProgress.value = 100
    clearInterval(timer)

    if (res?.data?.url) {
      uni.showToast({ title: '导出成功', icon: 'success' })
      // V1: 提示用户下载链接
    } else {
      uni.showToast({ title: '导出完成', icon: 'success' })
    }
    loadInfo()
  } catch {
    clearInterval(timer)
    uni.showToast({ title: '导出失败', icon: 'none' })
  } finally {
    setTimeout(() => {
      exporting.value = false
      exportProgress.value = 0
    }, 1000)
  }
}

onShow(() => loadInfo())
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: var(--bg);
  padding-bottom: 40px;
}

/* ==================== BACKUP CARD ==================== */
.backup-card {
  margin: 0 16px 20px;
  background: var(--card);
  border-radius: var(--radius-card);
  padding: 24px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;

  &__icon-box {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--blue-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }

  &__title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 800;
    color: var(--text-1);
    margin-bottom: 6px;
  }

  &__desc {
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.5;
    margin-bottom: 12px;
  }

  &__last {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border-radius: var(--radius-tag);
    background: var(--bg);
  }

  &__last-text {
    font-size: 12px;
    color: var(--text-3);
  }
}

/* ==================== EXPORT OPTIONS ==================== */
.export-section {
  padding: 0 16px;
  margin-bottom: 20px;
}

.section-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.5px;
  padding: 0 4px 8px;
  display: block;
}

.export-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.export-option {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--card);
  border-radius: var(--radius-row);
  box-shadow: var(--shadow);
  border: 1.5px solid transparent;
  transition: all 0.15s ease;
  &:active { transform: scale(0.975); }

  &--active {
    border-color: var(--primary);
    background: var(--primary-soft);
  }

  &__icon {
    font-family: 'Material Icons Round';
    font-size: 24px;
    color: var(--text-3);
    .export-option--active & { color: var(--primary); }
  }

  &__info { flex: 1; min-width: 0; }

  &__name {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
    display: block;
  }

  &__desc {
    font-size: 12px;
    color: var(--text-3);
    margin-top: 2px;
    display: block;
  }
}

/* ==================== EXPORT BUTTON ==================== */
.export-area {
  padding: 0 16px;
}

.export-btn {
  width: 100%;
  height: 50px;
  border-radius: var(--radius-btn);
  border: none;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  background: var(--primary);
  box-shadow: 0 4px 16px rgba(234, 62, 119, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;
  &:active { transform: scale(0.97); opacity: 0.9; }
}

.export-progress {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;

  &__bar {
    flex: 1;
    height: 6px;
    border-radius: var(--radius-progress);
    background: var(--card-dim);
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: var(--radius-progress);
    background: var(--primary);
    transition: width 0.3s ease;
  }

  &__text {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
    color: var(--primary);
    min-width: 40px;
    text-align: right;
  }
}
</style>
