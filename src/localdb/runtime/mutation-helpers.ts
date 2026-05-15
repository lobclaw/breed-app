import { createClientMutationId, getOrCreateDeviceId } from '@/localdb/id'
import type { SyncAckPayload, SyncMetadata } from '@/localdb/types'

export function getNow() {
  return Date.now()
}

export function getFamilyId(familyId: string) {
  if (!familyId) throw new Error('缺少家庭 ID，无法执行本地优先写入')
  return familyId
}

export function buildSyncMeta(baseVersions: Record<string, number> = {}, extras: Partial<SyncMetadata> = {}): SyncMetadata {
  return {
    clientMutationId: extras.clientMutationId || createClientMutationId('mutation'),
    deviceId: getOrCreateDeviceId(),
    baseVersions,
    clientTimestamp: getNow(),
    ...extras,
  }
}

export function buildLocalAck(syncMeta: SyncMetadata, touchedEntities: SyncAckPayload['touchedEntities'] = []): SyncAckPayload {
  return {
    ack: 'accepted',
    clientMutationId: syncMeta.clientMutationId,
    touchedEntities,
    resyncScopes: touchedEntities?.map(entity => entity.collection) || [],
    conflict: null,
  }
}
