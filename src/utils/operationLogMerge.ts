export interface MergeableOperationLog {
  _id: string
  actor_user_id?: string
  action_type?: string
  target_type?: string
  target_id?: string
  target_name?: string
  summary?: string
  clientMutationId?: string
  created_at: number
}

const DUPLICATE_WINDOW_MS = 120000

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function normalizeMutationId(value: unknown) {
  return normalizeText(value)
}

function shouldSuppressLocalLog(localLog: MergeableOperationLog, remoteLog: MergeableOperationLog) {
  const localMutationId = normalizeMutationId(localLog.clientMutationId)
  const remoteMutationId = normalizeMutationId(remoteLog.clientMutationId)

  if (localMutationId && remoteMutationId) {
    return localMutationId === remoteMutationId
  }

  if (normalizeText(localLog.actor_user_id) !== normalizeText(remoteLog.actor_user_id)) return false
  if (normalizeText(localLog.action_type) !== normalizeText(remoteLog.action_type)) return false

  const localTargetType = normalizeText(localLog.target_type)
  const remoteTargetType = normalizeText(remoteLog.target_type)
  if (localTargetType && remoteTargetType && localTargetType !== remoteTargetType) return false

  const localTargetId = normalizeText(localLog.target_id)
  const remoteTargetId = normalizeText(remoteLog.target_id)
  if (localTargetId && remoteTargetId && localTargetId !== remoteTargetId) return false

  const localSummary = normalizeText(localLog.summary)
  const remoteSummary = normalizeText(remoteLog.summary)
  if (localSummary && remoteSummary && localSummary !== remoteSummary) return false

  if (!localTargetId || !remoteTargetId) {
    const localTargetName = normalizeText(localLog.target_name)
    const remoteTargetName = normalizeText(remoteLog.target_name)
    if (localTargetName && remoteTargetName && localTargetName !== remoteTargetName) return false
  }

  const localCreatedAt = Number(localLog.created_at || 0)
  const remoteCreatedAt = Number(remoteLog.created_at || 0)
  if (!localCreatedAt || !remoteCreatedAt) return false
  if (remoteCreatedAt < localCreatedAt) return false

  return remoteCreatedAt - localCreatedAt <= DUPLICATE_WINDOW_MS
}

export function mergeOperationLogs<T extends MergeableOperationLog>(localLogs: T[], remoteLogs: T[]) {
  const remoteMutationIds = new Set(
    remoteLogs
      .map(log => normalizeMutationId(log.clientMutationId))
      .filter(Boolean),
  )

  const filteredLocalLogs = localLogs.filter((localLog) => {
    const localMutationId = normalizeMutationId(localLog.clientMutationId)
    if (localMutationId && remoteMutationIds.has(localMutationId)) return false

    return !remoteLogs.some(remoteLog => shouldSuppressLocalLog(localLog, remoteLog))
  })

  return [...filteredLocalLogs, ...remoteLogs]
    .sort((left, right) => Number(right.created_at || 0) - Number(left.created_at || 0))
}
