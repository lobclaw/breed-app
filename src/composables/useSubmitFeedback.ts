const STORAGE_KEY = 'submit_feedback_v1'

export interface SubmitFeedbackPayload {
  message: string
  targetRoute?: string
  completedTaskIds?: string[]
  removeBatchCard?: boolean
  createdDate?: number | null
  createdCount?: number
  skippedCount?: number
  refreshHome?: boolean
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
  const nextPayload = {
    ...payload,
    targetRoute: normalizeRoute(payload.targetRoute || inferPreviousRoute()),
  }
  if (!nextPayload.targetRoute) return nextPayload
  uni.setStorageSync(STORAGE_KEY, JSON.stringify(nextPayload))
  return nextPayload
}

export function consumeSubmitFeedback(currentRoute: string) {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (!raw) return null
    const payload = JSON.parse(raw) as SubmitFeedbackPayload
    if (normalizeRoute(payload.targetRoute) !== normalizeRoute(currentRoute)) {
      return null
    }
    uni.removeStorageSync(STORAGE_KEY)
    return payload
  } catch {
    uni.removeStorageSync(STORAGE_KEY)
    return null
  }
}

export function buildTaskFeedbackMessage(created: number, skipped: number) {
  if (created > 0 && skipped > 0) return `已创建 ${created} 条待办，跳过 ${skipped} 条`
  if (created > 0) return created === 1 ? '已创建待办' : `已创建 ${created} 条待办`
  if (skipped > 0) return skipped === 1 ? '已有相同待办，已跳过' : `已有相同待办，已跳过 ${skipped} 条`
  return '已处理待办'
}

export function buildRecordFeedbackMessage(savedCount: number, completedTaskCount = 0) {
  if (savedCount > 1 && completedTaskCount > 0) {
    return `已保存 ${savedCount} 条记录，并处理 ${completedTaskCount} 条待办`
  }
  if (savedCount > 1) return `已保存 ${savedCount} 条记录`
  if (completedTaskCount > 0) return completedTaskCount === 1 ? '已保存并处理待办' : `已保存并处理 ${completedTaskCount} 条待办`
  return '已保存记录'
}
