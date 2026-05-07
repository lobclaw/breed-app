import { localDb } from '@/localdb/db'
import { LOCAL_MUTATION_TYPES, type LocalMutationType } from '@/localdb/mutation-registry'
import type { LocalOperationLogRow, MutationStatus, SyncMetadata } from '@/localdb/types'

const BREEDING_RECORD_LABEL_MAP: Record<string, string> = {
  heat: '发情记录',
  heat_observation: '发情观察',
  follicle_check: '卵泡检查记录',
  mating: '配种记录',
  pregnancy_check: '孕检记录',
  prenatal_check: '产检记录',
  pre_labor: '临产记录',
  abnormal_termination: '异常终止记录',
  birth: '生产记录',
}

const HEALTH_RECORD_LABEL_MAP: Record<string, string> = {
  vaccination: '疫苗记录',
  deworming: '驱虫记录',
  illness: '疾病记录',
}

const LOCAL_OPERATION_STATUS_TEXT: Record<MutationStatus, string> = {
  pending: '待同步',
  processing: '同步中',
  synced: '已同步',
  failed: '同步失败',
  conflict: '同步冲突',
}

const FAMILY_CACHE_KEY = 'breed_family_cache'
const UNI_ID_USER_INFO_KEY = 'uni-id-pages-userInfo'

function normalizeDogName(dog: Record<string, any> | null | undefined) {
  return dog?.name || dog?.dog_name || '未命名犬只'
}

function readStorageObject(key: string): Record<string, any> | null {
  try {
    const raw = uni.getStorageSync(key)
    if (!raw) return null
    if (typeof raw === 'string') return JSON.parse(raw)
    if (typeof raw === 'object') return raw as Record<string, any>
  } catch {
    return null
  }
  return null
}

function findActiveMemberName(family: Record<string, any> | null | undefined, actorUserId: string) {
  const member = (family?.members || []).find((item: any) => item.user_id === actorUserId && item.status === 'active')
  return String(member?.nickname || '').trim()
}

function getCachedActorName(actorUserId: string) {
  const cachedFamily = readStorageObject(FAMILY_CACHE_KEY)
  const familyMemberName = findActiveMemberName(cachedFamily, actorUserId)
  if (familyMemberName) return familyMemberName

  const userInfo = readStorageObject(UNI_ID_USER_INFO_KEY)
  const userId = String(userInfo?._id || userInfo?.uid || '').trim()
  if (userId && userId !== actorUserId) return ''
  return String(userInfo?.nickname || userInfo?.username || '').trim()
}

function getCurrentUserId() {
  try {
    return String((uniCloud as any)?.getCurrentUserInfo?.()?.uid || '').trim()
  } catch {
    return ''
  }
}

async function resolveCurrentActor(familyId: string) {
  const actorUserId = getCurrentUserId()
  if (!actorUserId) return { actorUserId: '', actorName: '我' }
  const family = await localDb.findById<any>('families', familyId)
  const localMemberName = findActiveMemberName(family, actorUserId)
  const cachedActorName = getCachedActorName(actorUserId)
  return {
    actorUserId,
    actorName: localMemberName || cachedActorName || actorUserId,
  }
}

async function getTaskTitles(taskIds: string[]) {
  const uniqueIds = [...new Set(taskIds.filter(Boolean))]
  if (!uniqueIds.length) return []
  const rows = await localDb.query<any>('tasks', row => uniqueIds.includes(row._id))
  const rowMap = new Map(rows.map(row => [row._id, row]))
  return uniqueIds.map(id => String(rowMap.get(id)?.title || '').trim()).filter(Boolean)
}

async function getMedicationTitles(taskIds: string[]) {
  const uniqueIds = [...new Set(taskIds.filter(Boolean))]
  if (!uniqueIds.length) return []
  const rows = await localDb.query<any>('medication_tasks', row => uniqueIds.includes(row._id))
  const rowMap = new Map(rows.map(row => [row._id, row]))
  return uniqueIds.map((id) => {
    const row = rowMap.get(id)
    if (!row) return ''
    return String(row.drug_name || row.title || '').trim()
  }).filter(Boolean)
}

async function getDogNames(dogIds: string[]) {
  const uniqueIds = [...new Set(dogIds.filter(Boolean))]
  if (!uniqueIds.length) return []
  const rows = await localDb.query<any>('dogs', row => uniqueIds.includes(row._id))
  const rowMap = new Map(rows.map(row => [row._id, row]))
  return uniqueIds.map(id => normalizeDogName(rowMap.get(id))).filter(Boolean)
}

async function getDogName(dogId: string) {
  if (!dogId) return '未命名犬只'
  const dog = await localDb.findById<any>('dogs', dogId)
  return normalizeDogName(dog)
}

async function getEntityName(collection: 'expenses' | 'incomes' | 'agents' | 'medication_protocols', id: string, fallback = '') {
  if (!id) return fallback
  const entity = await localDb.findById<any>(collection, id)
  if (!entity) return fallback
  if (collection === 'agents') return String(entity.name || fallback || '未命名代理人')
  if (collection === 'medication_protocols') return String(entity.name || fallback || '未命名方案')
  return String(entity.category || entity.type || fallback || '未命名记录')
}

function toCountLabel(count: number, unit: string) {
  return count > 1 ? `${count}${unit}` : ''
}

async function buildOperationDescriptor(type: LocalMutationType, payload: Record<string, any>) {
  switch (type) {
    case LOCAL_MUTATION_TYPES.CREATE_DOG: {
      return {
        actionType: 'create',
        domain: 'dog',
        targetType: 'dog',
        targetId: String(payload._sync?.clientEntityIds?.dogs || ''),
        targetName: String(payload.name || '未命名犬只'),
        summary: `新增了犬只 ${payload.name || '未命名犬只'}`,
      }
    }
    case LOCAL_MUTATION_TYPES.UPDATE_DOG:
    case LOCAL_MUTATION_TYPES.UPDATE_DOG_NAME: {
      const dogName = payload.name || await getDogName(String(payload.id || payload.dogId || ''))
      return {
        actionType: 'update',
        domain: 'dog',
        targetType: 'dog',
        targetId: String(payload.id || payload.dogId || ''),
        targetName: dogName,
        summary: `更新了 ${dogName} 的档案`,
      }
    }
    case LOCAL_MUTATION_TYPES.CHANGE_DOG_DISPOSITION: {
      const dogName = await getDogName(String(payload.id || payload.dogId || ''))
      return {
        actionType: 'status_change',
        domain: 'dog',
        targetType: 'dog',
        targetId: String(payload.id || payload.dogId || ''),
        targetName: dogName,
        summary: `更新了 ${dogName} 的去向状态`,
      }
    }
    case LOCAL_MUTATION_TYPES.UPGRADE_PUPPY_TO_BREEDER: {
      const dogName = await getDogName(String(payload.id || payload.dogId || ''))
      return {
        actionType: 'update',
        domain: 'dog',
        targetType: 'dog',
        targetId: String(payload.id || payload.dogId || ''),
        targetName: dogName,
        summary: `将 ${dogName} 升级为种狗`,
      }
    }
    case LOCAL_MUTATION_TYPES.SOFT_DELETE_DOG: {
      const dogName = await getDogName(String(payload.id || payload.dogId || ''))
      return {
        actionType: 'delete',
        domain: 'dog',
        targetType: 'dog',
        targetId: String(payload.id || payload.dogId || ''),
        targetName: dogName,
        summary: `删除了犬只 ${dogName}`,
      }
    }
    case LOCAL_MUTATION_TYPES.RESTORE_DOG:
    case LOCAL_MUTATION_TYPES.RECYCLE_RESTORE: {
      return {
        actionType: 'restore',
        domain: type === LOCAL_MUTATION_TYPES.RECYCLE_RESTORE ? 'recycle' : 'dog',
        targetType: String(payload.type || 'item'),
        targetId: String(payload.id || ''),
        targetName: '',
        summary: '恢复了回收站项目',
      }
    }
    case LOCAL_MUTATION_TYPES.RECYCLE_PERMANENT_DELETE: {
      return {
        actionType: 'delete',
        domain: 'recycle',
        targetType: String(payload.type || 'item'),
        targetId: String(payload.id || ''),
        targetName: '',
        summary: '永久删除了回收站项目',
      }
    }
    case LOCAL_MUTATION_TYPES.BATCH_CREATE_TASKS: {
      const count = Array.isArray(payload.dogs)
        ? payload.dogs.length
        : Array.isArray(payload.dog_ids)
          ? payload.dog_ids.length
          : 1
      return {
        actionType: 'create',
        domain: 'task',
        targetType: 'task_batch',
        targetId: String(payload._sync?.clientMutationId || ''),
        targetName: toCountLabel(count, '个任务'),
        summary: count > 1 ? `批量创建了 ${count} 个任务` : '创建了任务',
      }
    }
    case LOCAL_MUTATION_TYPES.COMPLETE_TASK: {
      const titles = await getTaskTitles([String(payload.taskId || '')])
      const title = titles[0] || '任务'
      return {
        actionType: 'complete',
        domain: 'task',
        targetType: 'task',
        targetId: String(payload.taskId || ''),
        targetName: title,
        summary: `完成了任务 ${title}`.trim(),
      }
    }
    case LOCAL_MUTATION_TYPES.BATCH_COMPLETE_TASK: {
      const titles = await getTaskTitles(Array.isArray(payload.taskIds) ? payload.taskIds : [])
      return {
        actionType: 'complete',
        domain: 'task',
        targetType: 'task_batch',
        targetId: String(payload._sync?.clientMutationId || ''),
        targetName: toCountLabel(titles.length || (payload.taskIds || []).length, '个任务'),
        summary: `批量完成了 ${titles.length || (payload.taskIds || []).length} 个任务`,
      }
    }
    case LOCAL_MUTATION_TYPES.POSTPONE_TASK:
    case LOCAL_MUTATION_TYPES.BATCH_POSTPONE_TASK: {
      const ids = Array.isArray(payload.taskIds) ? payload.taskIds : [String(payload.taskId || '')]
      const titles = await getTaskTitles(ids)
      const count = titles.length || ids.filter(Boolean).length
      return {
        actionType: 'postpone',
        domain: 'task',
        targetType: count > 1 ? 'task_batch' : 'task',
        targetId: String(payload.taskId || payload._sync?.clientMutationId || ''),
        targetName: count > 1 ? `${count}个任务` : (titles[0] || '任务'),
        summary: count > 1 ? `批量推迟了 ${count} 个任务` : `推迟了任务 ${titles[0] || '任务'}`,
      }
    }
    case LOCAL_MUTATION_TYPES.CREATE_HEALTH_RECORDS: {
      const dogNames = await getDogNames(Array.isArray(payload.dog_ids) ? payload.dog_ids : [])
      const label = HEALTH_RECORD_LABEL_MAP[String(payload.type || '')] || '健康记录'
      return {
        actionType: 'create',
        domain: 'health',
        targetType: 'health_record',
        targetId: String(payload._sync?.clientMutationId || ''),
        targetName: dogNames.length === 1 ? dogNames[0] : `${dogNames.length}只犬`,
        summary: dogNames.length === 1
          ? `为 ${dogNames[0]} 新增了${label}`
          : `批量新增了 ${dogNames.length} 条${label}`,
      }
    }
    case LOCAL_MUTATION_TYPES.UPDATE_HEALTH_RECORD: {
      const dogName = await getDogName(String(payload.dog_id || ''))
      return {
        actionType: 'update',
        domain: 'health',
        targetType: 'health_record',
        targetId: String(payload.id || ''),
        targetName: dogName,
        summary: `更新了 ${dogName} 的健康记录`,
      }
    }
    case LOCAL_MUTATION_TYPES.DELETE_HEALTH_RECORD: {
      return {
        actionType: 'delete',
        domain: 'health',
        targetType: 'health_record',
        targetId: String(payload.id || ''),
        targetName: '',
        summary: '删除了健康记录',
      }
    }
    case LOCAL_MUTATION_TYPES.CREATE_MEDICATION_TASKS: {
      const dogNames = await getDogNames(Array.isArray(payload.dog_ids) ? payload.dog_ids : [])
      const drugName = String(payload.drug_name || '').trim() || '用药任务'
      return {
        actionType: 'create',
        domain: 'medication',
        targetType: 'medication_task',
        targetId: String(payload._sync?.clientMutationId || ''),
        targetName: drugName,
        summary: dogNames.length === 1
          ? `为 ${dogNames[0]} 开始了用药 ${drugName}`
          : `批量开始了 ${drugName} 用药`,
      }
    }
    case LOCAL_MUTATION_TYPES.RECORD_MEDICATION_DOSE: {
      const titles = await getMedicationTitles([String(payload.medicationTaskId || '')])
      return {
        actionType: 'update',
        domain: 'medication',
        targetType: 'medication_task',
        targetId: String(payload.medicationTaskId || ''),
        targetName: titles[0] || '用药任务',
        summary: `记录了 ${titles[0] || '用药任务'} 的执行进度`,
      }
    }
    case LOCAL_MUTATION_TYPES.BATCH_COMPLETE_MEDICATION_DAY: {
      const titles = await getMedicationTitles(Array.isArray(payload.medicationTaskIds) ? payload.medicationTaskIds : [])
      return {
        actionType: 'complete',
        domain: 'medication',
        targetType: 'medication_task_batch',
        targetId: String(payload._sync?.clientMutationId || ''),
        targetName: `${titles.length || (payload.medicationTaskIds || []).length}个用药任务`,
        summary: `完成了 ${titles.length || (payload.medicationTaskIds || []).length} 个用药任务的今日执行`,
      }
    }
    case LOCAL_MUTATION_TYPES.END_MEDICATION:
    case LOCAL_MUTATION_TYPES.END_MEDICATION_BY_DOG: {
      return {
        actionType: 'complete',
        domain: 'medication',
        targetType: 'medication_task',
        targetId: String(payload.id || payload.dogId || ''),
        targetName: '',
        summary: '结束了进行中的用药任务',
      }
    }
    case LOCAL_MUTATION_TYPES.RECOVER_ILLNESSES: {
      const count = Array.isArray(payload.illnessIds) ? payload.illnessIds.length : 0
      return {
        actionType: 'complete',
        domain: 'health',
        targetType: count > 1 ? 'illness_batch' : 'illness',
        targetId: String(payload._sync?.clientMutationId || ''),
        targetName: count > 1 ? `${count}条疾病` : '',
        summary: count > 1 ? `批量标记了 ${count} 条疾病已康复` : '标记了疾病已康复',
      }
    }
    case LOCAL_MUTATION_TYPES.UPDATE_ILLNESS_STATUS: {
      const count = Array.isArray(payload.illnessIds) ? payload.illnessIds.length : 0
      return {
        actionType: 'status_change',
        domain: 'health',
        targetType: count > 1 ? 'illness_batch' : 'illness',
        targetId: String(payload._sync?.clientMutationId || ''),
        targetName: count > 1 ? `${count}条疾病` : '',
        summary: count > 1 ? `批量更新了 ${count} 条疾病状态` : '更新了疾病状态',
      }
    }
    case LOCAL_MUTATION_TYPES.ADD_DOG_WEIGHT: {
      const dogName = await getDogName(String(payload.dog_id || payload.dogId || ''))
      return {
        actionType: 'create',
        domain: 'health',
        targetType: 'dog_weight',
        targetId: String(payload._sync?.clientEntityIds?.dog_weights || ''),
        targetName: dogName,
        summary: `为 ${dogName} 记录了体重`,
      }
    }
    case LOCAL_MUTATION_TYPES.CREATE_BREEDING_RECORD:
    case LOCAL_MUTATION_TYPES.BATCH_CREATE_BREEDING_RECORDS: {
      const dogNames = await getDogNames(Array.isArray(payload.dog_ids) ? payload.dog_ids : [String(payload.dog_id || '')])
      const label = BREEDING_RECORD_LABEL_MAP[String(payload.type || '')] || '繁育记录'
      return {
        actionType: 'create',
        domain: 'breeding',
        targetType: 'breeding_record',
        targetId: String(payload._sync?.clientMutationId || ''),
        targetName: dogNames.length === 1 ? dogNames[0] : `${dogNames.length}只犬`,
        summary: dogNames.length === 1
          ? `为 ${dogNames[0]} 新增了${label}`
          : `批量新增了 ${dogNames.length} 条${label}`,
      }
    }
    case LOCAL_MUTATION_TYPES.ADD_BIRTH_RECORD: {
      const dogName = await getDogName(String(payload.dam_id || payload.dog_id || ''))
      return {
        actionType: 'create',
        domain: 'breeding',
        targetType: 'breeding_record',
        targetId: String(payload._sync?.clientEntityIds?.breeding_records || ''),
        targetName: dogName,
        summary: `为 ${dogName} 新增了生产记录`,
      }
    }
    case LOCAL_MUTATION_TYPES.UPDATE_BREEDING_RECORD: {
      return {
        actionType: 'update',
        domain: 'breeding',
        targetType: 'breeding_record',
        targetId: String(payload.id || ''),
        targetName: '',
        summary: '更新了繁育记录',
      }
    }
    case LOCAL_MUTATION_TYPES.DELETE_BREEDING_RECORD: {
      return {
        actionType: 'delete',
        domain: 'breeding',
        targetType: 'breeding_record',
        targetId: String(payload.id || ''),
        targetName: '',
        summary: '删除了繁育记录',
      }
    }
    case LOCAL_MUTATION_TYPES.CLOSE_BREEDING_CYCLE: {
      return {
        actionType: 'status_change',
        domain: 'breeding',
        targetType: 'breeding_cycle',
        targetId: String(payload.cycleId || ''),
        targetName: '',
        summary: '关闭了繁育周期',
      }
    }
    case LOCAL_MUTATION_TYPES.ADD_PUPPY_TO_LITTER: {
      return {
        actionType: 'create',
        domain: 'breeding',
        targetType: 'litter',
        targetId: String(payload.litterId || ''),
        targetName: String(payload.name || '幼崽'),
        summary: `为窝新增了幼崽 ${payload.name || ''}`.trim(),
      }
    }
    case LOCAL_MUTATION_TYPES.UPDATE_LITTER:
    case LOCAL_MUTATION_TYPES.UPDATE_LITTER_BIRTH_DATE: {
      return {
        actionType: 'update',
        domain: 'breeding',
        targetType: 'litter',
        targetId: String(payload.litterId || payload.id || ''),
        targetName: '',
        summary: '更新了窝信息',
      }
    }
    case LOCAL_MUTATION_TYPES.CONFIRM_WEANING: {
      return {
        actionType: 'complete',
        domain: 'breeding',
        targetType: 'litter',
        targetId: String(payload.litterId || ''),
        targetName: '',
        summary: '确认了断奶',
      }
    }
    case LOCAL_MUTATION_TYPES.CREATE_EXPENSE: {
      return {
        actionType: 'create',
        domain: 'finance',
        targetType: 'expense',
        targetId: String(payload._sync?.clientEntityIds?.expenses || ''),
        targetName: String(payload.category || '支出'),
        summary: `新增了支出 ${payload.category || ''}`.trim(),
      }
    }
    case LOCAL_MUTATION_TYPES.CREATE_INCOME: {
      return {
        actionType: 'create',
        domain: 'finance',
        targetType: 'income',
        targetId: String(payload._sync?.clientEntityIds?.incomes || ''),
        targetName: String(payload.type || '收入'),
        summary: `新增了收入 ${payload.type || ''}`.trim(),
      }
    }
    case LOCAL_MUTATION_TYPES.UPDATE_EXPENSE: {
      const name = await getEntityName('expenses', String(payload.id || ''), String(payload.category || '支出'))
      return {
        actionType: 'update',
        domain: 'finance',
        targetType: 'expense',
        targetId: String(payload.id || ''),
        targetName: name,
        summary: `更新了支出 ${name}`,
      }
    }
    case LOCAL_MUTATION_TYPES.UPDATE_INCOME: {
      const name = await getEntityName('incomes', String(payload.id || ''), String(payload.type || '收入'))
      return {
        actionType: 'update',
        domain: 'finance',
        targetType: 'income',
        targetId: String(payload.id || ''),
        targetName: name,
        summary: `更新了收入 ${name}`,
      }
    }
    case LOCAL_MUTATION_TYPES.DELETE_EXPENSE: {
      return {
        actionType: 'delete',
        domain: 'finance',
        targetType: 'expense',
        targetId: String(payload.id || ''),
        targetName: '',
        summary: '删除了支出记录',
      }
    }
    case LOCAL_MUTATION_TYPES.DELETE_INCOME: {
      return {
        actionType: 'delete',
        domain: 'finance',
        targetType: 'income',
        targetId: String(payload.id || ''),
        targetName: '',
        summary: '删除了收入记录',
      }
    }
    case LOCAL_MUTATION_TYPES.CREATE_SALE_RECORD: {
      const dogName = await getDogName(String(payload.dog_id || ''))
      return {
        actionType: 'create',
        domain: 'sale',
        targetType: 'sale_record',
        targetId: String(payload._sync?.clientEntityIds?.sale_records || ''),
        targetName: dogName,
        summary: `开始了 ${dogName} 的销售流程`,
      }
    }
    case LOCAL_MUTATION_TYPES.RECEIVE_SALE_DEPOSIT:
    case LOCAL_MUTATION_TYPES.CANCEL_SALE:
    case LOCAL_MUTATION_TYPES.SETTLE_SALE:
    case LOCAL_MUTATION_TYPES.UPDATE_SALE_MODE:
    case LOCAL_MUTATION_TYPES.COMPLETE_SALE: {
      return {
        actionType: type === LOCAL_MUTATION_TYPES.COMPLETE_SALE ? 'complete' : 'update',
        domain: 'sale',
        targetType: 'sale_record',
        targetId: String(payload.id || ''),
        targetName: '',
        summary: type === LOCAL_MUTATION_TYPES.COMPLETE_SALE
          ? '完成了销售交易'
          : type === LOCAL_MUTATION_TYPES.RECEIVE_SALE_DEPOSIT
            ? '登记了销售定金'
            : type === LOCAL_MUTATION_TYPES.SETTLE_SALE
              ? '补录了销售结算'
              : type === LOCAL_MUTATION_TYPES.UPDATE_SALE_MODE
                ? '修改了销售方式'
                : '取消了销售记录',
      }
    }
    case LOCAL_MUTATION_TYPES.CREATE_AGENT: {
      return {
        actionType: 'create',
        domain: 'sale',
        targetType: 'agent',
        targetId: String(payload._sync?.clientEntityIds?.agents || ''),
        targetName: String(payload.name || '未命名代理人'),
        summary: `新增了代理人 ${payload.name || '未命名代理人'}`,
      }
    }
    case LOCAL_MUTATION_TYPES.UPDATE_AGENT: {
      const name = String(payload.name || await getEntityName('agents', String(payload.id || ''), '未命名代理人'))
      return {
        actionType: 'update',
        domain: 'sale',
        targetType: 'agent',
        targetId: String(payload.id || ''),
        targetName: name,
        summary: `更新了代理人 ${name}`,
      }
    }
    case LOCAL_MUTATION_TYPES.REMOVE_AGENT: {
      return {
        actionType: 'delete',
        domain: 'sale',
        targetType: 'agent',
        targetId: String(payload.id || ''),
        targetName: '',
        summary: '删除了代理人',
      }
    }
    case LOCAL_MUTATION_TYPES.UPDATE_FAMILY_SETTINGS:
    case LOCAL_MUTATION_TYPES.UPDATE_NICKNAME:
    case LOCAL_MUTATION_TYPES.UPDATE_EXPENSE_CATEGORY_GROUP:
    case LOCAL_MUTATION_TYPES.UPDATE_EXPENSE_CATEGORY: {
      return {
        actionType: 'update',
        domain: 'settings',
        targetType: 'family_settings',
        targetId: '',
        targetName: '',
        summary: '更新了设置',
      }
    }
    case LOCAL_MUTATION_TYPES.ADD_CARE_RULE:
    case LOCAL_MUTATION_TYPES.ADD_EXPENSE_CATEGORY_GROUP:
    case LOCAL_MUTATION_TYPES.ADD_EXPENSE_CATEGORY:
    case LOCAL_MUTATION_TYPES.ADD_MEDICATION_PROTOCOL: {
      return {
        actionType: 'create',
        domain: 'settings',
        targetType: 'settings_item',
        targetId: '',
        targetName: String(payload.name || payload.label || payload.drug_name || ''),
        summary: '新增了设置项',
      }
    }
    case LOCAL_MUTATION_TYPES.REMOVE_CARE_RULE:
    case LOCAL_MUTATION_TYPES.REMOVE_EXPENSE_CATEGORY_GROUP:
    case LOCAL_MUTATION_TYPES.REMOVE_EXPENSE_CATEGORY:
    case LOCAL_MUTATION_TYPES.REMOVE_MEDICATION_PROTOCOL: {
      return {
        actionType: 'delete',
        domain: type === LOCAL_MUTATION_TYPES.REMOVE_MEDICATION_PROTOCOL ? 'medication' : 'settings',
        targetType: 'settings_item',
        targetId: String(payload.id || ''),
        targetName: '',
        summary: type === LOCAL_MUTATION_TYPES.REMOVE_MEDICATION_PROTOCOL ? '删除了用药方案' : '删除了设置项',
      }
    }
    default:
      return {
        actionType: 'update',
        domain: String((type as string).split('.')[0] || 'unknown'),
        targetType: 'unknown',
        targetId: '',
        targetName: '',
        summary: '执行了一项操作',
      }
  }
}

export async function createPendingLocalOperationLog(
  type: LocalMutationType,
  familyId: string,
  payload: Record<string, any>,
  syncMeta: SyncMetadata,
) {
  const descriptor = await buildOperationDescriptor(type, payload)
  if (!descriptor.summary) return null
  const actor = await resolveCurrentActor(familyId)
  const now = Number(syncMeta.clientTimestamp || Date.now())

  return {
    _id: `local_operation_${syncMeta.clientMutationId}`,
    family_id: familyId,
    client_mutation_id: syncMeta.clientMutationId,
    mutation_type: type,
    actor_user_id: actor.actorUserId || null,
    actor_name: actor.actorName || '我',
    action_type: descriptor.actionType,
    domain: descriptor.domain,
    target_type: descriptor.targetType,
    target_id: descriptor.targetId,
    target_name: descriptor.targetName,
    summary: descriptor.summary,
    status: 'pending',
    last_error: null,
    meta: null,
    created_at: now,
    updated_at: now,
  } satisfies LocalOperationLogRow
}

export function getLocalOperationStatusText(status: MutationStatus) {
  return LOCAL_OPERATION_STATUS_TEXT[status] || ''
}
