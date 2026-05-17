import { createClientMutationId, createStableEntityId } from '@/localdb/id'
import { localDb } from '@/localdb/db'
import { LOCAL_MUTATION_TYPES, type LocalMutationPayload, type LocalMutationType } from '@/localdb/mutation-registry'
import { findLocal as findLocalRow } from '@/localdb/repository'
import { buildLocalAck, buildSyncMeta, getFamilyId, getNow } from '@/localdb/runtime/mutation-helpers'
import type { BusinessCollectionName, LocalRowOf, SyncMetadata } from '@/localdb/types'

type AgentRow = LocalRowOf<'agents'> & {
  contact_info?: unknown
}
export interface AgentMutationPayload {
  name?: unknown
  contact_info?: unknown
}

export interface RuntimeMutationContext {
  enqueueMutation(
    type: LocalMutationType,
    familyId: string,
    payload: LocalMutationPayload,
    collectionScope: BusinessCollectionName[],
    syncMeta: SyncMetadata,
  ): Promise<void>
}

export async function addAgentLocally(ctx: RuntimeMutationContext, familyIdInput: string, data: AgentMutationPayload) {
  const familyId = getFamilyId(familyIdInput)
  const name = String(data.name || '').trim()
  if (!name) throw new Error('请填写中间商姓名')
  const now = getNow()
  const agentId = createStableEntityId('agent')
  const agent = {
    _id: agentId,
    family_id: familyId,
    name,
    contact_info: data.contact_info || null,
    created_by: '',
    deleted_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    _local_pending: true,
  }
  const syncMeta = buildSyncMeta({}, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.CREATE_AGENT),
    clientEntityIds: { agents: agentId },
  })
  await localDb.transactRows('agents', async (rows) => {
    await rows.upsertRow(agent as AgentRow)
  })
  await ctx.enqueueMutation(LOCAL_MUTATION_TYPES.CREATE_AGENT, familyId, { ...data, name, _sync: syncMeta }, ['agents'], syncMeta)
  return {
    data: { agentId },
    ...buildLocalAck(syncMeta, [{ collection: 'agents', id: agentId, version: 0, updatedAt: now }]),
  }
}

export async function updateAgentLocally(ctx: RuntimeMutationContext, familyIdInput: string, agentId: string, data: AgentMutationPayload) {
  const familyId = getFamilyId(familyIdInput)
  const agent = await findLocalRow<AgentRow>('agents', agentId)
  if (!agent || agent.family_id !== familyId || agent.deleted_at) throw new Error('中间商不存在')
  const name = String(data.name || '').trim()
  if (!name) throw new Error('请填写中间商姓名')
  const now = getNow()
  const syncMeta = buildSyncMeta({ [agentId]: Number(agent.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.UPDATE_AGENT),
  })
  await localDb.transactRows('agents', async (rows) => {
    const current = await rows.getRow(agentId)
    if (!current || current.family_id !== familyId || current.deleted_at) throw new Error('中间商不存在')
    await rows.updateRow(agentId, row => ({
      ...row,
      name,
      contact_info: data.contact_info || null,
      updated_at: now,
      _local_pending: true,
    } as AgentRow))
  })
  await ctx.enqueueMutation(LOCAL_MUTATION_TYPES.UPDATE_AGENT, familyId, { id: agentId, ...data, name, _sync: syncMeta }, ['agents'], syncMeta)
  return {
    message: '已更新',
    ...buildLocalAck(syncMeta, [{ collection: 'agents', id: agentId, version: Number(agent.version || 0), updatedAt: now }]),
  }
}

export async function removeAgentLocally(ctx: RuntimeMutationContext, familyIdInput: string, agentId: string) {
  const familyId = getFamilyId(familyIdInput)
  const agent = await findLocalRow<AgentRow>('agents', agentId)
  if (!agent || agent.family_id !== familyId) throw new Error('中间商不存在')
  const now = getNow()
  const syncMeta = buildSyncMeta({ [agentId]: Number(agent.version || 0) }, {
    clientMutationId: createClientMutationId(LOCAL_MUTATION_TYPES.REMOVE_AGENT),
  })
  await localDb.transactRows('agents', async (rows) => {
    const current = await rows.getRow(agentId)
    if (!current || current.family_id !== familyId) throw new Error('中间商不存在')
    await rows.updateRow(agentId, row => ({
      ...row,
      deleted_at: now,
      updated_at: now,
      _local_pending: true,
    }))
  })
  await ctx.enqueueMutation(LOCAL_MUTATION_TYPES.REMOVE_AGENT, familyId, { id: agentId, _sync: syncMeta }, ['agents'], syncMeta)
  return {
    message: '已删除',
    ...buildLocalAck(syncMeta, [{ collection: 'agents', id: agentId, version: Number(agent.version || 0), updatedAt: now, deletedAt: now }]),
  }
}
