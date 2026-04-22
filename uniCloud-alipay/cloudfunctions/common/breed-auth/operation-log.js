const db = uniCloud.database()

function isOperationLogCollectionMissingError(error) {
  const message = error?.message || error?.errMsg || ''
  return typeof message === 'string' && message.toLowerCase().includes('not found collection')
}

async function resolveActorName(familyId, actorUserId) {
  if (!actorUserId) return '未知用户'

  try {
    if (familyId) {
      const { data: familyData } = await db.collection('families')
        .doc(familyId)
        .field({ members: true })
        .get()
      const family = familyData?.[0] || familyData
      const member = (family?.members || []).find(item => item.user_id === actorUserId)
      if (member?.nickname) return member.nickname
    }
  } catch (error) {
    console.warn('[operation-log] resolve actor from family failed:', error.message)
  }

  try {
    const { data: users } = await db.collection('uni-id-users')
      .where({ _id: actorUserId })
      .field({ nickname: true, username: true })
      .limit(1)
      .get()
    const user = users?.[0]
    if (user?.nickname) return user.nickname
    if (user?.username) return user.username
  } catch (error) {
    console.warn('[operation-log] resolve actor from user failed:', error.message)
  }

  return actorUserId
}

async function writeOperationLog({
  familyId,
  actorUserId,
  actorName,
  actionType,
  domain,
  targetType,
  targetId,
  targetName,
  summary,
  meta = null,
  createdAt,
}) {
  if (!familyId || !actorUserId || !summary) {
    throw new Error('操作日志参数不完整')
  }

  const now = createdAt || Date.now()
  const resolvedActorName = actorName || await resolveActorName(familyId, actorUserId)

  const logData = {
    family_id: familyId,
    actor_user_id: actorUserId,
    actor_name: resolvedActorName || actorUserId,
    action_type: actionType || 'update',
    domain: domain || 'unknown',
    target_type: targetType || 'unknown',
    target_id: targetId || '',
    target_name: targetName || '',
    summary,
    meta: meta && typeof meta === 'object' ? meta : null,
    created_at: now,
  }

  const { id } = await db.collection('operation_logs').add(logData)
  return { id, ...logData }
}

async function safeWriteOperationLog(payload) {
  try {
    return await writeOperationLog(payload)
  } catch (error) {
    if (isOperationLogCollectionMissingError(error)) {
      console.warn('[operation-log] collection missing, skip write')
      return null
    }
    console.warn('[operation-log] write failed:', error.message)
    return null
  }
}

module.exports = {
  isOperationLogCollectionMissingError,
  resolveActorName,
  writeOperationLog,
  safeWriteOperationLog,
}
