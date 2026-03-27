/**
 * 主题管理
 * 暗色模式切换 + 持久化存储
 */
import { ref, watch } from 'vue'

type ThemeMode = 'light' | 'dark' | 'system'

const mode = ref<ThemeMode>('light')
const isDark = ref(false)

/** 初始化主题（App 启动时调用） */
function initTheme() {
  const saved = uni.getStorageSync('theme_mode') as ThemeMode
  if (saved) {
    mode.value = saved
  }
  applyTheme()
}

/** 切换主题 */
function setTheme(newMode: ThemeMode) {
  mode.value = newMode
  uni.setStorageSync('theme_mode', newMode)
  applyTheme()
}

/** 应用主题到页面 */
function applyTheme() {
  if (mode.value === 'system') {
    // 跟随系统（仅 APP 端支持）
    const systemInfo = uni.getSystemInfoSync()
    isDark.value = systemInfo.theme === 'dark'
  } else {
    isDark.value = mode.value === 'dark'
  }

  // 在 H5 端通过 class 切换
  // #ifdef H5
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  // #endif
}

export function useTheme() {
  return {
    mode,
    isDark,
    initTheme,
    setTheme,
  }
}
