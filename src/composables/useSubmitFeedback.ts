import { useAuth } from '@/composables/useAuth'
import { getWorkspaceCacheKey } from '@/utils/authScopedCache'

const STORAGE_KEY = 'submit_feedback_v1'
export const SUBMIT_SUCCESS_FEEDBACK_DELAY_MS = 520

export type HomeFeedbackSection = 'overdue' | 'breeding' | 'reminders' | 'therapy'

export interface SubmitFeedbackPayload {
  message: string
  familyId?: string
  targetRoute?: string
  targetDogId?: string
  homeSection?: HomeFeedbackSection
  homeAnchorKey?: string
  completedTaskIds?: string[]
  suppressTaskIds?: string[]
  removeBatchCard?: boolean
  createdDate?: number | null
  createdCount?: number
  skippedCount?: number
  refreshHome?: boolean
  undoAction?: {
    key: string
    label: string
    expiresAt: number
  }
}

function getCurrentFamilyId() {
  const { currentFamily } = useAuth()
  return currentFamily.value?._id || ''
}

function getSubmitFeedbackStorageKey(familyId = getCurrentFamilyId()) {
  return familyId ? getWorkspaceCacheKey('submit-feedback', familyId) : ''
}

function normalizeRoute(route?: string) {
  if (!route) return ''
  return route.startsWith('/') ? route : `/${route}`
}

export function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function inferPreviousRoute() {
  const pages = getCurrentPages()
  if (pages.length < 2) return ''
  const prev = pages[pages.length - 2]
  return normalizeRoute(prev?.route)
}

export function queueSubmitFeedback(payload: SubmitFeedbackPayload) {
  const familyId = payload.familyId || getCurrentFamilyId()
  const nextPayload = {
    ...payload,
    familyId,
    targetRoute: normalizeRoute(payload.targetRoute || inferPreviousRoute()),
  }
  const storageKey = getSubmitFeedbackStorageKey(familyId)
  if (!nextPayload.targetRoute || !storageKey) return nextPayload
  uni.removeStorageSync(STORAGE_KEY)
  uni.setStorageSync(storageKey, JSON.stringify(nextPayload))
  return nextPayload
}

export function consumeSubmitFeedback(currentRoute: string) {
  const familyId = getCurrentFamilyId()
  const storageKey = getSubmitFeedbackStorageKey(familyId)
  if (!storageKey) return null
  try {
    const raw = uni.getStorageSync(storageKey)
    if (!raw) return null
    const payload = JSON.parse(raw) as SubmitFeedbackPayload
    if ((payload.familyId || '') !== familyId) {
      uni.removeStorageSync(storageKey)
      return null
    }
    if (normalizeRoute(payload.targetRoute) !== normalizeRoute(currentRoute)) {
      return null
    }
    uni.removeStorageSync(storageKey)
    return payload
  } catch {
    uni.removeStorageSync(storageKey)
    return null
  }
}

export function buildTaskFeedbackMessage(created: number, skipped: number) {
  if (created > 0 && skipped > 0) return `已创建 ${created} 条待办，跳过 ${skipped} 条`
  if (created > 0) return created === 1 ? '已创建待办' : `已创建 ${created} 条待办`
  if (skipped > 0) return skipped === 1 ? '今天已有相同事项，已跳过' : `今天已有相同事项，已跳过 ${skipped} 条`
  return '已处理待办'
}

export function buildRecordFeedbackMessage(savedCount: number, completedTaskCount = 0, skippedCount = 0) {
  if (savedCount > 0 && skippedCount > 0 && completedTaskCount > 0) {
    return `已保存 ${savedCount} 条记录，跳过 ${skippedCount} 条，并处理 ${completedTaskCount} 条待办`
  }
  if (savedCount > 0 && skippedCount > 0) {
    return `已保存 ${savedCount} 条记录，跳过 ${skippedCount} 条`
  }
  if (savedCount === 0 && skippedCount > 0) {
    return skippedCount === 1 ? '今日已有相同记录，已跳过' : `今日已有相同记录，已跳过 ${skippedCount} 条`
  }
  if (savedCount > 1 && completedTaskCount > 0) {
    return `已保存 ${savedCount} 条记录，并处理 ${completedTaskCount} 条待办`
  }
  if (savedCount > 1) return `已保存 ${savedCount} 条记录`
  if (completedTaskCount > 0) return completedTaskCount === 1 ? '已保存并处理待办' : `已保存并处理 ${completedTaskCount} 条待办`
  return '已保存记录'
}
