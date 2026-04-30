function getSyncMeta(input, fallback = null) {
  if (input && typeof input === 'object' && input._sync && typeof input._sync === 'object') {
    return input._sync
  }
  if (fallback && typeof fallback === 'object') return fallback
  return null
}

function buildTouchedEntity(collection, entity) {
  return {
    collection,
    id: entity._id,
    version: Number(entity.version || 0),
    updatedAt: Number(entity.updated_at || entity.created_at || 0),
    deletedAt: entity.deleted_at ?? null,
  }
}

function buildSyncAck(syncMeta, {
  ack = 'accepted',
  touchedEntities = [],
  resyncScopes = [],
  conflict = null,
} = {}) {
  return {
    ack,
    clientMutationId: syncMeta?.clientMutationId || null,
    touchedEntities,
    resyncScopes,
    conflict,
  }
}

function buildConflictAck(syncMeta, {
  collection,
  entityId,
  baseVersion,
  serverVersion,
  reason = 'version_mismatch',
}) {
  return buildSyncAck(syncMeta, {
    ack: 'conflict',
    resyncScopes: [collection],
    conflict: {
      collection,
      entityId,
      baseVersion,
      serverVersion,
      reason,
    },
  })
}

function isCollectionMissingError(error) {
  const message = error?.message || error?.errMsg || ''
  return typeof message === 'string' && message.toLowerCase().includes('not found collection')
}

async function findAppliedMutation(db, familyId, clientMutationId) {
  if (!clientMutationId) return null
  const mutationId = `${familyId}:${clientMutationId}`
  try {
    const { data } = await db.collection('sync_mutations').doc(mutationId).get()
    return data && data.length > 0 ? data[0] : null
  } catch (error) {
    if (isCollectionMissingError(error)) {
      console.warn('[breed-sync] sync_mutations collection missing, skip idempotency lookup')
      return null
    }
    throw error
  }
}

async function markMutationApplied(db, familyId, clientMutationId, response) {
  if (!clientMutationId) return
  const now = Date.now()
  const mutationId = `${familyId}:${clientMutationId}`
  const payload = {
    _id: mutationId,
    family_id: familyId,
    client_mutation_id: clientMutationId,
    response,
    created_at: now,
    updated_at: now,
  }

  try {
    const { data } = await db.collection('sync_mutations').doc(mutationId).get()
    if (data && data.length > 0) {
      await db.collection('sync_mutations').doc(mutationId).update({
        response,
        updated_at: now,
      })
      return
    }

    await db.collection('sync_mutations').add(payload)
  } catch (error) {
    if (isCollectionMissingError(error)) {
      console.warn('[breed-sync] sync_mutations collection missing, skip idempotency mark')
      return
    }
    throw error
  }
}

function getBaseVersion(syncMeta, entityId) {
  if (!syncMeta?.baseVersions || !entityId) return null
  if (!(entityId in syncMeta.baseVersions)) return null
  return Number(syncMeta.baseVersions[entityId] || 0)
}

function getServerVersion(entity) {
  return Number(entity?.version || 0)
}

function buildVersionUpdate(dbCmd, now) {
  return {
    updated_at: now,
    version: dbCmd.inc(1),
  }
}

function buildVersionedCreate(data, now = Date.now()) {
  return {
    version: 1,
    created_at: now,
    updated_at: now,
    ...data,
  }
}

module.exports = {
  getSyncMeta,
  buildTouchedEntity,
  buildSyncAck,
  buildConflictAck,
  isCollectionMissingError,
  findAppliedMutation,
  markMutationApplied,
  getBaseVersion,
  getServerVersion,
  buildVersionUpdate,
  buildVersionedCreate,
}
