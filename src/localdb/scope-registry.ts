import type { BusinessCollectionName } from '@/localdb/types'

export type SyncScopeMode = 'local-first' | 'online-first' | 'static' | 'redirect-deprecated'

export interface SyncScopeDefinition {
  key: string
  mode: SyncScopeMode
  ttlMs: number
  collections: BusinessCollectionName[]
  routeMatchers: Array<string | RegExp>
  label: string
}

export interface ResolvedSyncScope {
  key: string
  mode: SyncScopeMode
  ttlMs: number
  collections: BusinessCollectionName[]
  routeKey: string
  routePath: string
}

const DETAIL_TTL_MS = 45000
const LIST_TTL_MS = 120000
const CONFIG_TTL_MS = 300000
const FINANCE_TTL_MS = 300000

export const SYNC_SCOPE_REGISTRY: SyncScopeDefinition[] = [
  {
    key: 'launch-online',
    label: '启动鉴权',
    mode: 'online-first',
    ttlMs: 0,
    collections: [],
    routeMatchers: ['pages/launch/index'],
  },
  {
    key: 'home',
    label: '首页',
    mode: 'local-first',
    ttlMs: 20000,
    collections: ['dogs', 'tasks', 'health_records', 'medication_tasks'],
    routeMatchers: ['pages/home/index', 'pages/home/batch-process'],
  },
  {
    key: 'dog-list',
    label: '犬只列表',
    mode: 'local-first',
    ttlMs: LIST_TTL_MS,
    collections: ['dogs', 'health_records', 'medication_tasks', 'breeding_cycles'],
    routeMatchers: ['pages/dog/list', 'pages/dog/add'],
  },
  {
    key: 'dog-detail',
    label: '犬只详情',
    mode: 'local-first',
    ttlMs: DETAIL_TTL_MS,
    collections: ['dogs', 'health_records', 'medication_tasks', 'breeding_cycles', 'litters', 'breeding_records', 'expenses', 'incomes', 'sale_records', 'dog_weights'],
    routeMatchers: ['pages/dog/detail'],
  },
  {
    key: 'record-entry',
    label: '记录入口',
    mode: 'local-first',
    ttlMs: LIST_TTL_MS,
    collections: ['dogs', 'breeding_cycles', 'litters', 'health_records', 'medication_protocols'],
    routeMatchers: [
      'pages/record/index',
      /^pages\/record\/(breeding-heat|breeding-follicle|breeding-mating|breeding-pregnancy|breeding-prenatal|breeding-prelabor|breeding-termination|health-vaccination|health-deworming|health-illness|health-medication|heat-observation)$/,
    ],
  },
  {
    key: 'record-form-support',
    label: '记录表单支持',
    mode: 'local-first',
    ttlMs: DETAIL_TTL_MS,
    collections: ['dogs', 'breeding_cycles', 'litters', 'health_records', 'medication_tasks', 'tasks', 'medication_protocols'],
    routeMatchers: ['pages/record/breeding-detail', 'pages/breeding/birth-wizard'],
  },
  {
    key: 'breeding-cycle',
    label: '繁育周期',
    mode: 'local-first',
    ttlMs: DETAIL_TTL_MS,
    collections: ['breeding_cycles', 'breeding_records', 'tasks', 'litters', 'expenses'],
    routeMatchers: ['pages/breeding/cycle'],
  },
  {
    key: 'litter',
    label: '窝详情',
    mode: 'local-first',
    ttlMs: DETAIL_TTL_MS,
    collections: ['litters', 'dogs', 'tasks', 'health_records', 'expenses'],
    routeMatchers: ['pages/breeding/litter'],
  },
  {
    key: 'health-record',
    label: '健康记录详情',
    mode: 'local-first',
    ttlMs: DETAIL_TTL_MS,
    collections: ['health_records', 'dogs', 'medication_tasks', 'tasks'],
    routeMatchers: ['pages/record/health-detail'],
  },
  {
    key: 'medication-task',
    label: '用药任务详情',
    mode: 'local-first',
    ttlMs: DETAIL_TTL_MS,
    collections: ['medication_tasks', 'health_records', 'dogs'],
    routeMatchers: ['pages/record/medication-detail'],
  },
  {
    key: 'weight-batch',
    label: '批量体重',
    mode: 'local-first',
    ttlMs: LIST_TTL_MS,
    collections: ['dogs', 'litters', 'dog_weights'],
    routeMatchers: ['pages/health/batch-weight'],
  },
  {
    key: 'finance-list',
    label: '财务列表',
    mode: 'local-first',
    ttlMs: FINANCE_TTL_MS,
    collections: ['expenses', 'incomes', 'sale_records', 'dogs', 'litters', 'breeding_cycles', 'agents'],
    routeMatchers: ['pages/finance/index'],
  },
  {
    key: 'finance-report',
    label: '财务报表',
    mode: 'local-first',
    ttlMs: FINANCE_TTL_MS,
    collections: ['expenses', 'incomes', 'sale_records', 'dogs', 'litters', 'breeding_cycles', 'agents'],
    routeMatchers: ['pages/finance/stats', 'pages/finance/projection', 'pages/finance/dam-roi', 'pages/finance/litter-profit'],
  },
  {
    key: 'finance-detail',
    label: '财务详情',
    mode: 'local-first',
    ttlMs: DETAIL_TTL_MS,
    collections: ['expenses', 'incomes', 'sale_records', 'dogs', 'litters', 'breeding_cycles', 'agents'],
    routeMatchers: ['pages/finance/expense-detail', 'pages/finance/income-detail', 'pages/finance/expense-edit', 'pages/finance/income-edit', 'pages/finance/expense-add'],
  },
  {
    key: 'sale-list',
    label: '销售列表',
    mode: 'local-first',
    ttlMs: FINANCE_TTL_MS,
    collections: ['sale_records', 'dogs', 'agents', 'incomes'],
    routeMatchers: ['pages/sale/list', 'pages/sale/create'],
  },
  {
    key: 'sale-detail',
    label: '销售详情',
    mode: 'local-first',
    ttlMs: DETAIL_TTL_MS,
    collections: ['sale_records', 'dogs', 'agents', 'incomes', 'expenses'],
    routeMatchers: ['pages/sale/detail'],
  },
  {
    key: 'agent-list',
    label: '代理人',
    mode: 'local-first',
    ttlMs: FINANCE_TTL_MS,
    collections: ['agents', 'sale_records'],
    routeMatchers: ['pages/sale/agents'],
  },
  {
    key: 'kennel-dashboard',
    label: '犬舍总览',
    mode: 'local-first',
    ttlMs: FINANCE_TTL_MS,
    collections: ['families', 'dogs', 'litters', 'expenses', 'incomes', 'sale_records', 'breeding_cycles', 'health_records', 'medication_tasks'],
    routeMatchers: ['pages/profile/index'],
  },
  {
    key: 'settings-local',
    label: '本地配置',
    mode: 'local-first',
    ttlMs: CONFIG_TTL_MS,
    collections: ['families', 'medication_protocols'],
    routeMatchers: ['pages/profile/notifications', 'pages/profile/defaults', 'pages/profile/care-rules', 'pages/profile/expense-categories', 'pages/health/medication-protocols'],
  },
  {
    key: 'recycle',
    label: '回收站',
    mode: 'local-first',
    ttlMs: CONFIG_TTL_MS,
    collections: ['dogs', 'expenses', 'incomes', 'agents', 'medication_protocols'],
    routeMatchers: ['pages/profile/recycle'],
  },
  {
    key: 'auth-online',
    label: '鉴权',
    mode: 'online-first',
    ttlMs: 0,
    collections: [],
    routeMatchers: [
      /^uni_modules\/uni-id-pages\/pages\/login\/.+$/,
      /^uni_modules\/uni-id-pages\/pages\/register\/.+$/,
      /^uni_modules\/uni-id-pages\/pages\/retrieve\/.+$/,
      /^uni_modules\/uni-id-pages\/pages\/userinfo\/.+$/,
      'uni_modules/uni-id-pages/pages/common/webview/webview',
    ],
  },
  {
    key: 'family-setup-online',
    label: '家庭创建加入',
    mode: 'online-first',
    ttlMs: 0,
    collections: [],
    routeMatchers: ['pages/family/setup', 'pages/family/join'],
  },
  {
    key: 'family-members-online',
    label: '家庭成员',
    mode: 'online-first',
    ttlMs: 0,
    collections: [],
    routeMatchers: ['pages/family/invite', 'pages/family/members'],
  },
  {
    key: 'operation-log-online',
    label: '操作日志',
    mode: 'online-first',
    ttlMs: 0,
    collections: [],
    routeMatchers: ['pages/profile/operation-log'],
  },
  {
    key: 'backup-online',
    label: '备份导出',
    mode: 'online-first',
    ttlMs: 0,
    collections: [],
    routeMatchers: ['pages/profile/backup'],
  },
  {
    key: 'redirect-deprecated',
    label: '废弃重定向页',
    mode: 'redirect-deprecated',
    ttlMs: 0,
    collections: [],
    routeMatchers: ['pages/record/health', 'pages/record/breeding'],
  },
  {
    key: 'static-none',
    label: '静态页',
    mode: 'static',
    ttlMs: 0,
    collections: [],
    routeMatchers: ['pages/profile/about', 'pages/profile/sync-status', 'uni_modules/uni-id-pages/pages/common/legal'],
  },
]

function normalizeRoutePath(routePath: string) {
  return String(routePath || '').replace(/^\//, '').replace(/\?.*$/, '')
}

export function getSyncScopeDefinition(scopeKey: string) {
  return SYNC_SCOPE_REGISTRY.find(scope => scope.key === scopeKey) || null
}

export function matchSyncScopeForRoute(routePath: string) {
  const normalized = normalizeRoutePath(routePath)
  return SYNC_SCOPE_REGISTRY.find((scope) => scope.routeMatchers.some((matcher) => (
    typeof matcher === 'string'
      ? matcher === normalized
      : matcher.test(normalized)
  ))) || null
}

function resolveDetailScopeKey(baseKey: string, query: Record<string, unknown>) {
  if (baseKey === 'dog-detail') {
    return `${baseKey}:${query.id || query.dogId || query.dog_id || ''}`.replace(/:$/, '')
  }
  if (baseKey === 'breeding-cycle') {
    return `${baseKey}:${query.id || query.cycleId || query.cycle_id || ''}`.replace(/:$/, '')
  }
  if (baseKey === 'litter') {
    return `${baseKey}:${query.id || query.litterId || query.litter_id || ''}`.replace(/:$/, '')
  }
  if (baseKey === 'health-record') {
    return `${baseKey}:${query.id || query.recordId || query.record_id || ''}`.replace(/:$/, '')
  }
  if (baseKey === 'medication-task') {
    return `${baseKey}:${query.id || query.taskId || query.task_id || query.medicationTaskId || query.medication_task_id || ''}`.replace(/:$/, '')
  }
  if (baseKey === 'finance-detail') {
    const type = query.type || query.txType || query.tx_type || ''
    const id = query.id || query.recordId || query.record_id || ''
    return [baseKey, type, id].filter(Boolean).join(':')
  }
  if (baseKey === 'sale-detail') {
    return `${baseKey}:${query.id || ''}`.replace(/:$/, '')
  }
  return baseKey
}

export function resolveSyncScopeForRoute(routePath: string, query: Record<string, unknown> = {}): ResolvedSyncScope | null {
  const matched = matchSyncScopeForRoute(routePath)
  if (!matched) return null

  return {
    key: resolveDetailScopeKey(matched.key, query),
    mode: matched.mode,
    ttlMs: matched.ttlMs,
    collections: [...matched.collections],
    routeKey: matched.key,
    routePath: normalizeRoutePath(routePath),
  }
}

export function getAllSyncRouteCoverage() {
  return SYNC_SCOPE_REGISTRY.map(scope => ({
    key: scope.key,
    mode: scope.mode,
    ttlMs: scope.ttlMs,
    collections: scope.collections,
    routeMatchers: scope.routeMatchers,
  }))
}
