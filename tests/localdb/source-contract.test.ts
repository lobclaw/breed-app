import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveSyncScopeForRoute } from '../../src/localdb/scope-registry'

function readWorkspaceFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

function listSourceFiles(relativeDir: string): string[] {
  const absoluteDir = join(process.cwd(), relativeDir)
  return readdirSync(absoluteDir).flatMap((entry) => {
    const absolutePath = join(absoluteDir, entry)
    const relativePath = `${relativeDir}/${entry}`
    if (statSync(absolutePath).isDirectory()) return listSourceFiles(relativePath)
    return /\.(vue|ts)$/.test(entry) ? [relativePath] : []
  })
}

describe('local-first source contract', () => {
  it('SQLite v2 真实错误不得静默 fallback 到 UniStorage', () => {
    const adapterSource = readWorkspaceFile('src/localdb/adapter.ts')
    const sqliteSource = adapterSource.slice(adapterSource.indexOf('class SqliteAdapter'))

    expect(sqliteSource).toContain("if (!this.isSupported()) return this.fallback.putRows(collection, rows)")
    expect(sqliteSource).toContain("if (!this.isSupported()) return this.fallback.replaceRows(collection, rows)")
    expect(sqliteSource).toContain('throw error')
    expect(sqliteSource).not.toContain('await this.fallback.putRows(collection, rows)')
    expect(sqliteSource).not.toContain('await this.fallback.replaceRows(collection, rows)')
  })

  it('usePageSync 不应在页面 onShow 中触发 core mirror', () => {
    const source = readWorkspaceFile('src/composables/usePageSync.ts')
    expect(source).not.toContain('localSyncRuntime.resume(')
    expect(source).toContain('localSyncRuntime.setCurrentFamilyId(familyId)')
    expect(source).toContain('resolveSyncScopeForRoute(options.routePath, query)')
    expect(source).toContain('async function persistActiveScope(scope: string)')
    expect(source).toContain('if (!familyId || !scope) return')
    const runtimeSource = readWorkspaceFile('src/localdb/runtime/core.ts')
    expect(runtimeSource).toContain('if (!this.currentFamilyId) return')
    expect(runtimeSource).toContain("if (!this.currentFamilyId) return ''")
    const routeBranch = source.slice(source.indexOf('const resolved = resolveSyncScopeForRoute'))
    expect(routeBranch.indexOf('scopeKey = resolved?.key ||')).toBeLessThan(routeBranch.indexOf('await persistActiveScope(scopeKey)'))
    const persistBranch = source.slice(source.indexOf('async function persistActiveScope'))
    expect(persistBranch.indexOf('localSyncRuntime.setCurrentFamilyId(familyId)')).toBeLessThan(persistBranch.indexOf('await localSyncRuntime.setActiveScope(scope)'))
  })

  it('高频本地读取路径应使用 readonly LocalDB API，避免整表深拷贝', () => {
    const repositorySource = readWorkspaceFile('src/localdb/repository.ts')
    const dbSource = readWorkspaceFile('src/localdb/db.ts')
    const homeSnapshotSource = readWorkspaceFile('src/localdb/runtime/home-snapshot.ts')
    const scopeSyncSource = readWorkspaceFile('src/localdb/runtime/scope-sync.ts')
    const syncStatusSource = readWorkspaceFile('src/localdb/sync-status.ts')

    expect(repositorySource).toContain('localDb.queryReadonly')
    expect(repositorySource).toContain('localDb.findReadonlyById')
    expect(repositorySource).not.toContain('localDb.query<T>')
    expect(repositorySource).not.toContain('localDb.findById<T>')

    expect(homeSnapshotSource).toContain('getReadonlyTable')
    expect(homeSnapshotSource).toContain('getRowsByFamilyReadonly')
    expect(homeSnapshotSource).not.toContain('getRowsByFamily<any>')
    expect(homeSnapshotSource).not.toContain('getTable<any>')

    expect(syncStatusSource).toContain('queryReadonly')
    expect(syncStatusSource).toContain('getReadonlyTable')
    expect(syncStatusSource).toContain('getRowsByFamilyReadonly')
    expect(syncStatusSource).not.toContain('getOutbox()')
    expect(syncStatusSource).not.toContain('getTable<any>')

    const hasCollectionsDataSource = scopeSyncSource.slice(scopeSyncSource.indexOf('export async function hasCollectionsData'))
    expect(hasCollectionsDataSource).toContain('localDb.getReadonlyTable(collection)')
    expect(hasCollectionsDataSource).not.toContain('localDb.getTable')
    expect(hasCollectionsDataSource).not.toContain('getTable<any>')

    const transactSource = dbSource.slice(dbSource.indexOf('async transact'), dbSource.indexOf('private async commitV2Diff'))
    expect(transactSource).toContain('createTransactionTables')
    expect(transactSource).toContain('getReadonlyTable<StoredLocalRow>')
    expect(transactSource).not.toContain('this.getTable<any>')
    expect(transactSource).not.toContain('cloneRows(tables[collection])')

    const rowTransactionSource = dbSource.slice(dbSource.indexOf('async transactRows'), dbSource.indexOf('private async commitV2Diff'))
    expect(rowTransactionSource).toContain('async getRow(id)')
    expect(rowTransactionSource).toContain('async updateRow(id, patch)')
    expect(rowTransactionSource).toContain('async deleteRow(id)')
    expect(rowTransactionSource).toContain('adapter.getRow(collection, id)')
    expect(rowTransactionSource).not.toContain('createTransactionTables')
    expect(rowTransactionSource).not.toContain('getReadonlyTable<any>')
  })

  it('LocalDB 存储边界不应保留裸 any 或 Record<string, any>', () => {
    const dbSource = readWorkspaceFile('src/localdb/db.ts')
    const adapterSource = readWorkspaceFile('src/localdb/adapter.ts')

    for (const [file, source] of [
      ['src/localdb/db.ts', dbSource],
      ['src/localdb/adapter.ts', adapterSource],
    ] as const) {
      expect(source, `${file} should parse dynamic storage through explicit boundary types`).not.toMatch(/\bany\b|Record<string, any>|as unknown as/)
      expect(source, `${file} should not use any-specific LocalDB helpers`).not.toMatch(/query<any>|findById<any>|getTable<any>|getReadonlyTable<any>/)
    }
  })

  it('至少一个低风险 runtime mutation 应使用行级事务 API', () => {
    const agentSource = readWorkspaceFile('src/localdb/runtime/agent-mutations.ts')
    const dogSource = readWorkspaceFile('src/localdb/runtime/dog-mutations.ts')
    const taskSource = readWorkspaceFile('src/localdb/runtime/task-mutations.ts')
    expect(agentSource).toContain("localDb.transactRows('agents'")
    expect(agentSource).toContain('rows.updateRow(agentId')
    expect(dogSource).toContain("localDb.transactRows('dogs'")
    expect(dogSource).toContain('await rows.deleteRow(id)')
    expect(taskSource).toContain("localDb.transactRows('tasks'")
    expect(taskSource).toContain('await rows.updateRow(task._id')
  })

  it('runtime mutation 不得回退到整表事务或批量整表写入', () => {
    const mutationFiles = listSourceFiles('src/localdb/runtime')
      .filter(file => /-mutations\.ts$/.test(file))

    expect(mutationFiles.length).toBeGreaterThan(0)
    for (const file of mutationFiles) {
      const source = readWorkspaceFile(file)
      expect(source, `${file} should use row-level local transactions`).not.toMatch(/localDb\.transact\(/)
      expect(source, `${file} should not use repository full-table mutation helper`).not.toMatch(/\brunLocalMutation\(/)
      expect(source, `${file} should not import repository full-table mutation helper`).not.toContain('mutateLocal as runLocalMutation')
      expect(source, `${file} should not call bulk local upsert helpers`).not.toMatch(/\bupsertLocalRows\(|localDb\.upsertRows\(/)
      expect(source, `${file} should not rewrite transaction table arrays`).not.toMatch(/\btables\./)
    }
  })

  it('业务页面和 store 不得直接 import runtime 内部 mutation 模块', () => {
    const appSourceFiles = [
      ...listSourceFiles('src/pages'),
      ...listSourceFiles('src/components'),
      ...listSourceFiles('src/composables'),
      ...listSourceFiles('src/stores'),
    ]
    const forbiddenRuntimeMutationImport = /@\/localdb\/runtime\/(agent|breeding|dog|finance|health|litter|medication|sale|settings|task)-mutations/

    for (const file of appSourceFiles) {
      const source = readWorkspaceFile(file)
      expect(source, `${file} should use localSyncRuntime facade`).not.toMatch(forbiddenRuntimeMutationImport)
    }
  })

  it('首页代码不得直接调用会 deep clone 的 LocalDB API', () => {
    const homeFiles = [
      'src/pages/home/index.vue',
      ...listSourceFiles('src/pages/home/components'),
      ...listSourceFiles('src/pages/home/composables'),
    ]
    const forbiddenDeepCloneRead = /localDb\.(getTable|getRowsByFamily|findById)(<[^>]+>)?\(/

    for (const file of homeFiles) {
      const source = readWorkspaceFile(file)
      expect(source, `${file} should read through localSyncRuntime/home snapshot`).not.toMatch(forbiddenDeepCloneRead)
    }
  })

  it('同步状态聚合只能读取系统集合，不得扫描业务集合', () => {
    const syncStatusSource = readWorkspaceFile('src/localdb/sync-status.ts')
    const systemCollections = ['outbox_mutations', 'sync_conflicts', 'sync_state', 'sync_issues']
    const businessCollections = [
      'dogs',
      'tasks',
      'health_records',
      'medication_tasks',
      'breeding_cycles',
      'breeding_records',
      'expenses',
      'incomes',
      'sale_records',
      'families',
      'agents',
      'dog_weights',
      'medication_protocols',
    ]

    for (const collection of systemCollections) {
      expect(syncStatusSource).toContain(`'${collection}'`)
    }
    for (const collection of businessCollections) {
      expect(syncStatusSource, `sync-status should not scan ${collection}`).not.toContain(`'${collection}'`)
    }
  })

  it('mutation 入队后 pending upload issue 刷新应收窄到附件相关行', () => {
    const runtimeSource = readWorkspaceFile('src/localdb/runtime/core.ts')
    const syncIssuesSource = readWorkspaceFile('src/localdb/sync-issues.ts')
    const enqueueMutationSource = runtimeSource.slice(
      runtimeSource.indexOf('async enqueueMutation'),
      runtimeSource.indexOf('async getLocalOperationLogs'),
    )
    const issueRefreshSource = runtimeSource.slice(
      runtimeSource.indexOf('private async refreshPendingUploadIssuesForMutation'),
      runtimeSource.indexOf('async getLocalOperationLogs'),
    )

    expect(enqueueMutationSource).toContain('this.refreshPendingUploadIssuesForMutation')
    expect(enqueueMutationSource).not.toContain('refreshPendingUploadIssuesForCollections(collectionScope, familyId)')
    expect(issueRefreshSource).toContain('collectPendingUploadRecordIds(collection, payload, syncMeta)')
    expect(issueRefreshSource).toContain('syncIssueService.refreshPendingUploadIssuesForRows(collection, familyId, recordIds)')
    expect(issueRefreshSource).not.toContain('refreshPendingUploadIssuesForCollections')
    expect(syncIssuesSource).toContain('async refreshPendingUploadIssuesForRows')
  })

  it('手动重试 outbox 应使用行级事务', () => {
    const runtimeSource = readWorkspaceFile('src/localdb/runtime/core.ts')
    const retrySource = runtimeSource.slice(
      runtimeSource.indexOf('async retryFailedOutboxNow'),
      runtimeSource.indexOf('async syncPendingAttachmentsNow'),
    )

    expect(retrySource).toContain("localDb.transactRows(['outbox_mutations', 'local_operation_logs', 'sync_conflicts'] as const")
    expect(retrySource).toContain("rows.updateRow('outbox_mutations'")
    expect(retrySource).toContain("rows.updateRow('sync_conflicts'")
    expect(retrySource).toContain("rows.updateRow('local_operation_logs'")
    expect(retrySource).not.toContain('localDb.transact(')
    expect(retrySource).not.toContain('tables.')
  })

  it('附件上传成功后的本地引用替换应使用行级事务', () => {
    const attachmentsSource = readWorkspaceFile('src/localdb/runtime/attachments.ts')
    const uploadSource = attachmentsSource.slice(
      attachmentsSource.indexOf('export async function uploadPendingAttachmentsForFamily'),
    )

    expect(uploadSource).toContain("localDb.transactRows([...uploadCollections, 'outbox_mutations'] as const")
    expect(uploadSource).toContain('localDb.getRowsByFamilyReadonly<AttachmentRow>(collection, familyId)')
    expect(uploadSource).toContain("rows.getRow(collection, sourceRow._id)")
    expect(uploadSource).toContain("rows.updateRow('outbox_mutations', mutation._id")
    expect(uploadSource).not.toContain('localDb.transact(')
    expect(uploadSource).not.toContain('localDb.query<AttachmentRow>')
    expect(uploadSource).not.toContain('tables.')
  })

  it('恢复 processing outbox 应使用行级事务', () => {
    const outboxSource = readWorkspaceFile('src/localdb/runtime/outbox.ts')
    const recoverSource = outboxSource.slice(
      outboxSource.indexOf('export async function recoverStaleProcessingOutbox'),
      outboxSource.indexOf('export function rebaseMutationForConflict'),
    )

    expect(recoverSource).toContain("localDb.transactRows(['outbox_mutations', 'local_operation_logs'] as const")
    expect(recoverSource).toContain('localDb.getRowsByFamilyReadonly')
    expect(recoverSource).toContain("rows.updateRow('outbox_mutations'")
    expect(recoverSource).toContain("rows.updateRow('local_operation_logs'")
    expect(recoverSource).not.toContain('localDb.transact(')
    expect(recoverSource).not.toContain('tables.')
  })

  it('更新 outbox 状态应使用行级事务', () => {
    const outboxSource = readWorkspaceFile('src/localdb/runtime/outbox.ts')
    const statusSource = outboxSource.slice(
      outboxSource.indexOf('export async function updateOutboxStatus'),
      outboxSource.indexOf('export async function recoverStaleProcessingOutbox'),
    )

    expect(statusSource).toContain("localDb.transactRows(['outbox_mutations', 'local_operation_logs', 'sync_conflicts'] as const")
    expect(statusSource).toContain("rows.updateRow('outbox_mutations'")
    expect(statusSource).toContain("rows.deleteRow('local_operation_logs', logId)")
    expect(statusSource).toContain("rows.updateRow('sync_conflicts'")
    expect(statusSource).not.toContain('localDb.transact(')
    expect(statusSource).not.toContain('tables.')
  })

  it('同步 ack touched entity 应使用行级事务', () => {
    const outboxSource = readWorkspaceFile('src/localdb/runtime/outbox.ts')
    const ackSource = outboxSource.slice(
      outboxSource.indexOf('export async function applySyncAck'),
    )

    expect(ackSource).toContain('localDb.transactRows(touchedCollections')
    expect(ackSource).toContain('rows.updateRow(touched.collection, touched.id')
    expect(ackSource).not.toContain('localDb.transact(')
    expect(ackSource).not.toContain('applyTouchedEntityVersions')
    expect(ackSource).not.toContain('tables.')
  })

  it('首页 snapshot 应按 family/date/revision memo 投影并保持实体快照一致', () => {
    const homeSnapshotSource = readWorkspaceFile('src/localdb/runtime/home-snapshot.ts')
    const runtimeSource = readWorkspaceFile('src/localdb/runtime/core.ts')

    expect(homeSnapshotSource).toContain('const HOME_PROJECTION_MEMO_LIMIT = 24')
    expect(homeSnapshotSource).toContain('const homeProjectionMemo = new Map<string, unknown>()')
    expect(homeSnapshotSource).toContain('type HomeEntitiesSnapshot')
    expect(homeSnapshotSource).toContain('async function getHomeEntitiesSnapshot')
    expect(homeSnapshotSource).toContain('return { revisionKey, entities }')
    expect(homeSnapshotSource).toContain('homeProjectionMemo.clear()')
    expect(homeSnapshotSource).toContain('`home:${familyId}:${todayKey}:${revisionKey}`')
    expect(homeSnapshotSource).toContain('`dateCounts:${familyId}:${getBeijingDayStart(startDate)}:${getBeijingDayStart(endDate)}:${revisionKey}`')
    expect(homeSnapshotSource).toContain('`weekCards:${familyId}:${getBeijingDayStart(startDate)}:${getBeijingDayStart(endDate)}:${todayKey}:${revisionKey}`')
    expect(homeSnapshotSource).toContain('if (!familyId) return buildLocalHomeCards(entities, now, familyId)')
    expect(homeSnapshotSource).toContain('if (!familyId) return buildLocalDateCounts(entities, startDate, endDate, familyId)')
    expect(homeSnapshotSource).toContain('if (!familyId) return buildLocalWeekCards(entities, startDate, endDate, now, familyId)')

    const homeCardsSource = homeSnapshotSource.slice(
      homeSnapshotSource.indexOf('export async function getMemoizedHomeCards'),
      homeSnapshotSource.indexOf('export async function getMemoizedHomeDateCounts'),
    )
    expect(homeCardsSource).toContain('const { entities, revisionKey } = await getHomeEntitiesSnapshot(familyId)')
    expect(homeCardsSource).not.toContain('getHomeRevisionKey(familyId)')

    expect(runtimeSource).toContain('getMemoizedHomeCards')
    expect(runtimeSource).toContain('getMemoizedHomeDateCounts')
    expect(runtimeSource).toContain('getMemoizedHomeWeekCards')
    expect(runtimeSource).not.toContain('buildLocalHomeCards')
    expect(runtimeSource).not.toContain('buildLocalDateCounts')
    expect(runtimeSource).not.toContain('buildLocalWeekCards')
  })

  it('繁育 milestone 物化应使用 readonly 读取与行级事务写入', () => {
    const homeSnapshotSource = readWorkspaceFile('src/localdb/runtime/home-snapshot.ts')
    const materializeSource = homeSnapshotSource.slice(
      homeSnapshotSource.indexOf('export async function materializeBreedingMilestonesForFamily'),
      homeSnapshotSource.indexOf('export async function buildHomeSnapshot'),
    )

    expect(materializeSource).toContain("localDb.getRowsByFamilyReadonly('tasks', familyId)")
    expect(materializeSource).toContain("localDb.getRowsByFamilyReadonly('breeding_cycles', familyId)")
    expect(materializeSource).toContain("localDb.getRowsByFamilyReadonly('breeding_records', familyId)")
    expect(materializeSource).toContain("localDb.transactRows('tasks'")
    expect(materializeSource).toContain('await rows.upsertRow(task)')
    expect(materializeSource).not.toContain('localDb.transact(')
    expect(materializeSource).not.toContain('tables.tasks')
  })

  it('健康与用药本地 mutation 应从 runtime core 下沉到领域模块', () => {
    const coreSource = readWorkspaceFile('src/localdb/runtime/core.ts')
    const healthSource = readWorkspaceFile('src/localdb/runtime/health-mutations.ts')
    const medicationSource = readWorkspaceFile('src/localdb/runtime/medication-mutations.ts')

    expect(coreSource).toContain("import * as healthMutations from '@/localdb/runtime/health-mutations'")
    expect(coreSource).toContain("import * as medicationMutations from '@/localdb/runtime/medication-mutations'")

    const healthFacade = coreSource.slice(
      coreSource.indexOf('async batchAddHealthRecordsLocally'),
      coreSource.indexOf('async addBreedingRecordLocally'),
    )
    expect(healthFacade).toContain('return healthMutations.batchAddHealthRecordsLocally')
    expect(healthFacade).toContain('return medicationMutations.batchStartMedicationLocally')
    expect(healthFacade).not.toContain('buildLocalHealthRecord')
    expect(healthFacade).not.toContain('buildLocalMedicationExpense')

    const tailFacade = coreSource.slice(coreSource.indexOf('async recordMedicationDoseLocally'))
    expect(tailFacade).toContain('return medicationMutations.recordMedicationDoseLocally')
    expect(tailFacade).toContain('return healthMutations.updateHealthRecordLocally')
    expect(tailFacade).toContain('return healthMutations.cleanupDuplicateIllnessesLocally')
    expect(tailFacade).toContain('return medicationMutations.endMedicationByDogLocally')
    expect(tailFacade).not.toContain('const linkedExpenses = await localDb.query')
    expect(tailFacade).not.toContain('const overriddenMedicationTasks = overrideDogIdSet.size')

    expect(healthSource).toContain('export async function batchAddHealthRecordsLocally')
    expect(healthSource).toContain('export async function recoverIllnessesLocally')
    expect(medicationSource).toContain('export async function batchStartMedicationLocally')
    expect(medicationSource).toContain('export async function endMedicationLocally')
  })

  it('繁育与窝次本地 mutation 应从 runtime core 下沉到领域模块', () => {
    const coreSource = readWorkspaceFile('src/localdb/runtime/core.ts')
    const breedingSource = readWorkspaceFile('src/localdb/runtime/breeding-mutations.ts')
    const litterSource = readWorkspaceFile('src/localdb/runtime/litter-mutations.ts')

    expect(coreSource).toContain("import * as breedingMutations from '@/localdb/runtime/breeding-mutations'")
    expect(coreSource).toContain("import * as litterMutations from '@/localdb/runtime/litter-mutations'")

    const breedingFacade = coreSource.slice(
      coreSource.indexOf('async addBreedingRecordLocally'),
      coreSource.indexOf('async addExpenseLocally'),
    )
    expect(breedingFacade).toContain('return breedingMutations.addBreedingRecordLocally')
    expect(breedingFacade).toContain('return litterMutations.addBirthRecordLocally')
    expect(breedingFacade).toContain('return breedingMutations.closeBreedingCycleLocally')
    expect(breedingFacade).toContain('return litterMutations.confirmWeaningLocally')
    expect(breedingFacade).not.toContain('buildLocalBreedingRecord')
    expect(breedingFacade).not.toContain('materializeBreedingMilestonesForFamily(familyId)')
    expect(breedingFacade).not.toContain('buildLocalDog(familyId')

    expect(breedingSource).toContain('export async function addBreedingRecordLocally')
    expect(breedingSource).toContain('export async function updateBreedingRecordLocally')
    expect(breedingSource).toContain('export async function closeBreedingCycleLocally')
    expect(litterSource).toContain('export async function addBirthRecordLocally')
    expect(litterSource).toContain('export async function updateLitterBirthDateLocally')
    expect(litterSource).toContain('export async function confirmWeaningLocally')
  })

  it('犬只与任务本地 mutation 应从 runtime core 下沉到领域模块', () => {
    const coreSource = readWorkspaceFile('src/localdb/runtime/core.ts')
    const dogSource = readWorkspaceFile('src/localdb/runtime/dog-mutations.ts')
    const taskSource = readWorkspaceFile('src/localdb/runtime/task-mutations.ts')

    expect(coreSource).toContain("import * as dogMutations from '@/localdb/runtime/dog-mutations'")
    expect(coreSource).toContain("import * as taskMutations from '@/localdb/runtime/task-mutations'")

    const dogFacade = coreSource.slice(
      coreSource.indexOf('async createDogLocally'),
      coreSource.indexOf('async ensureHomeData'),
    )
    expect(dogFacade).toContain('return dogMutations.createDogLocally')
    expect(dogFacade).toContain('return dogMutations.changeDogDispositionLocally')
    expect(dogFacade).toContain('return dogMutations.permanentDeleteRecycleItemLocally')
    expect(dogFacade).not.toContain('buildLocalDog(')
    expect(dogFacade).not.toContain('parseAdoptionFeeAmount')

    const taskFacade = coreSource.slice(
      coreSource.indexOf('async batchCreateManualTasksLocally'),
      coreSource.indexOf('async recordMedicationDoseLocally'),
    )
    expect(taskFacade).toContain('return taskMutations.batchCreateManualTasksLocally')
    expect(taskFacade).toContain('return dogMutations.addWeightRecordLocally')
    expect(taskFacade).toContain('return taskMutations.completeTaskLocally')
    expect(taskFacade).toContain('return taskMutations.postponeTasksLocally')
    expect(taskFacade).not.toContain('buildLocalTaskFromManualPayload')
    expect(taskFacade).not.toContain('buildLocalHealthExpense')

    expect(dogSource).toContain('export async function createDogLocally')
    expect(dogSource).toContain('export async function addWeightRecordLocally')
    expect(taskSource).toContain('export async function batchCreateManualTasksLocally')
    expect(taskSource).toContain('export async function completeTaskLocally')
  })

  it('已收敛的 runtime 领域模块不应重新引入裸 any', () => {
    const typedRuntimeModules = [
      'src/localdb/runtime/attachments.ts',
      'src/localdb/runtime/agent-mutations.ts',
      'src/localdb/runtime/breeding-mutations.ts',
      'src/localdb/runtime/core.ts',
      'src/localdb/runtime/dog-mutations.ts',
      'src/localdb/runtime/finance-mutations.ts',
      'src/localdb/runtime/health-mutations.ts',
      'src/localdb/runtime/home-snapshot.ts',
      'src/localdb/runtime/local-builders.ts',
      'src/localdb/runtime/litter-mutations.ts',
      'src/localdb/runtime/medication-mutations.ts',
      'src/localdb/runtime/outbox.ts',
      'src/localdb/runtime/pull.ts',
      'src/localdb/runtime/sale-mutations.ts',
      'src/localdb/runtime/scope-sync.ts',
      'src/localdb/runtime/settings-mutations.ts',
      'src/localdb/runtime/task-mutations.ts',
    ]

    for (const file of typedRuntimeModules) {
      const source = readWorkspaceFile(file)
      expect(source, `${file} should keep typed rows/payloads`).not.toMatch(/\bany\b|Record<string, any>/)
      expect(source, `${file} should not hide row shape mismatches behind double casts`).not.toContain('as unknown as')
    }
  })

  it('任务类型应兼容当前本地 priority/postpone_count 行结构', () => {
    const taskTypeSource = readWorkspaceFile('src/types/task.ts')

    expect(taskTypeSource).toContain("export type TaskPriority = 'overdue' | 'today' | 'upcoming'")
    expect(taskTypeSource).toContain('priority?: TaskPriority')
    expect(taskTypeSource).toContain('postpone_count?: number')
    expect(taskTypeSource).toContain('source_collection?: string | null')
    expect(taskTypeSource).toContain('details?: Record<string, unknown> | null')
  })

  it('Local-First 对齐的领域类型不应保留裸 any', () => {
    const typeFiles = [
      'src/types/breeding.ts',
      'src/types/finance.ts',
      'src/types/health.ts',
      'src/types/task.ts',
      'src/types/index.ts',
    ]

    for (const file of typeFiles) {
      const source = readWorkspaceFile(file)
      expect(source, `${file} should not weaken domain contracts with any`).not.toMatch(/\bany\b|Record<string, any>/)
    }
  })

  it('高频 runtime mutation 顶层 payload 不得退回泛化 Record', () => {
    const coreSource = readWorkspaceFile('src/localdb/runtime/core.ts')
    const mutationRegistrySource = readWorkspaceFile('src/localdb/mutation-registry.ts')
    const agentSource = readWorkspaceFile('src/localdb/runtime/agent-mutations.ts')
    const dogSource = readWorkspaceFile('src/localdb/runtime/dog-mutations.ts')
    const breedingSource = readWorkspaceFile('src/localdb/runtime/breeding-mutations.ts')
    const healthSource = readWorkspaceFile('src/localdb/runtime/health-mutations.ts')
    const medicationSource = readWorkspaceFile('src/localdb/runtime/medication-mutations.ts')
    const litterSource = readWorkspaceFile('src/localdb/runtime/litter-mutations.ts')
    const financeSource = readWorkspaceFile('src/localdb/runtime/finance-mutations.ts')
    const saleSource = readWorkspaceFile('src/localdb/runtime/sale-mutations.ts')
    const settingsSource = readWorkspaceFile('src/localdb/runtime/settings-mutations.ts')
    const taskSource = readWorkspaceFile('src/localdb/runtime/task-mutations.ts')

    expect(dogSource).toContain('export interface CreateDogPayload')
    expect(dogSource).toContain('export interface UpdateDogPayload')
    expect(dogSource).toContain('data: CreateDogPayload')
    expect(dogSource).toContain('data: UpdateDogPayload')
    expect(dogSource).not.toContain('type DogPayload = Record<string, unknown>')
    expect(dogSource).not.toContain('interface DynamicDogPayload')
    expect(dogSource).not.toContain('extends DynamicDogPayload')

    expect(breedingSource).toContain('export interface BreedingMutationPayload')
    expect(breedingSource).not.toContain('type BreedingMutationPayload = Record<string, unknown>')
    expect(breedingSource).not.toContain('interface DynamicBreedingPayload')
    expect(breedingSource).not.toContain('extends DynamicBreedingPayload')

    expect(taskSource).toContain('export interface BatchCreateManualTasksPayload')
    expect(taskSource).not.toContain('type BatchCreateManualTasksPayload = Record<string, unknown>')
    expect(taskSource).not.toContain('export interface BatchCreateManualTasksPayload {\n  [key: string]: unknown')
    expect(mutationRegistrySource).toContain('export type LocalMutationPayload = Record<string, unknown>')
    expect(mutationRegistrySource).not.toContain('export type LocalMutationPayload = Record<string, any>')

    expect(agentSource).toContain('export interface AgentMutationPayload')
    expect(healthSource).toContain('export interface BatchAddHealthRecordsPayload')
    expect(healthSource).toContain('export interface UpdateHealthRecordPayload')
    expect(medicationSource).toContain('export interface BatchStartMedicationPayload')
    expect(medicationSource).toContain('export interface EndMedicationPayload')
    expect(litterSource).toContain('export interface AddBirthRecordPayload')
    expect(litterSource).toContain('export interface AddPuppyToLitterPayload')
    expect(litterSource).toContain('export interface UpdateLitterPayload')
    expect(financeSource).toContain('export interface ExpenseMutationPayload')
    expect(financeSource).toContain('export interface IncomeMutationPayload')
    expect(saleSource).toContain('export interface CreateSaleRecordPayload')
    expect(saleSource).toContain('export interface CompleteSalePayload')
    expect(settingsSource).toContain('export interface MedicationProtocolInput')
    expect(healthSource).toContain('data: BatchAddHealthRecordsPayload')
    expect(healthSource).toContain('data: UpdateHealthRecordPayload')
    expect(medicationSource).toContain('data: BatchStartMedicationPayload')
    expect(medicationSource).toContain('data: EndMedicationPayload')
    expect(litterSource).toContain('data: AddBirthRecordPayload')
    expect(litterSource).toContain('puppyData: AddPuppyToLitterPayload')
    expect(litterSource).toContain('data: UpdateLitterPayload')
    expect(saleSource).toContain('data: CreateSaleRecordPayload')
    expect(saleSource).toContain('data: UpdateSaleModePayload')
    expect(saleSource).toContain('data: ReceiveSaleDepositPayload')
    expect(saleSource).toContain('data: CompleteSalePayload')
    expect(saleSource).toContain('data: SettleSalePayload')
    expect(saleSource).toContain('data: CancelSalePayload')
    for (const source of [healthSource, medicationSource, litterSource, financeSource, saleSource, settingsSource]) {
      expect(source).not.toMatch(/export async function \w+\([^)]*(data|puppyData): Record<string, any>/)
      expect(source).not.toContain('as unknown as')
    }

    expect(coreSource).toContain('async createDogLocally(familyIdInput: string, data: CreateDogPayload)')
    expect(coreSource).toContain('async updateDogLocally(familyIdInput: string, dogId: string, data: UpdateDogPayload)')
    expect(coreSource).toContain('async changeDogDispositionLocally(familyIdInput: string, dogId: string, newDisposition: string, data: DogDispositionPayload')
    expect(coreSource).toContain('async batchCreateManualTasksLocally(familyIdInput: string, data: BatchCreateManualTasksPayload)')
    expect(coreSource).toContain('async batchAddHealthRecordsLocally(familyIdInput: string, data: BatchAddHealthRecordsPayload)')
    expect(coreSource).toContain('async batchStartMedicationLocally(familyIdInput: string, data: BatchStartMedicationPayload)')
    expect(coreSource).toContain('async addBreedingRecordLocally(familyIdInput: string, data: BreedingMutationPayload)')
    expect(coreSource).toContain('async updateBreedingRecordLocally(familyIdInput: string, data: BreedingMutationPayload)')
    expect(coreSource).toContain('async addBirthRecordLocally(familyIdInput: string, data: AddBirthRecordPayload)')
    expect(coreSource).toContain('async addExpenseLocally(familyIdInput: string, data: ExpenseMutationPayload)')
    expect(coreSource).toContain('async createSaleRecordLocally(familyIdInput: string, data: CreateSaleRecordPayload)')
    expect(coreSource).toContain('async addAgentLocally(familyIdInput: string, data: AgentMutationPayload)')
    expect(coreSource).toContain('async updateFamilySettingsLocally(familyIdInput: string, settings: FamilySettingsPatch)')
    expect(coreSource).toContain('async addWeightRecordLocally(familyIdInput: string, data: DogWeightPayload)')

    const mutationFacadeSource = coreSource.slice(
      coreSource.indexOf('async batchCreateManualTasksLocally'),
      coreSource.indexOf('async ensureHomeData'),
    )
    expect(mutationFacadeSource).not.toMatch(/async \w+\([^)]*(data|settings|rule|puppyData): Record<string, any>/)
    expect(mutationFacadeSource).not.toMatch(/as \w+Payload/)
  })

  it('高频记录表单提交 payload 应使用 runtime 门面的具体类型', () => {
    const healthFormSource = readWorkspaceFile('src/components/record/HealthRecordForm.vue')
    const breedingFormSource = readWorkspaceFile('src/components/record/BreedingRecordForm.vue')
    const medicationFormSource = readWorkspaceFile('src/components/record/MedicationTaskForm.vue')
    const breedingContextCardSource = readWorkspaceFile('src/components/record/BBreedingContextCard.vue')

    expect(healthFormSource).toContain('type BatchAddHealthRecordsPayload')
    expect(healthFormSource).toContain('type UpdateHealthRecordPayload')
    expect(healthFormSource).toContain('const payload: BatchAddHealthRecordsPayload')
    expect(healthFormSource).toContain('const payload: UpdateHealthRecordPayload')
    expect(healthFormSource).not.toContain('const payload: Record<string, any>')
    expect(healthFormSource).not.toMatch(/\bany\b|Record<string, any>|as any/)

    expect(breedingFormSource).toContain('type BreedingMutationPayload')
    expect(breedingFormSource).toContain('const payload: BreedingMutationPayload')
    expect(breedingFormSource).not.toContain('const payload: Record<string, any>')
    expect(breedingFormSource).not.toMatch(/\bany\b|Record<string, any>|as any/)

    expect(medicationFormSource).toContain('type MedicationFormDog = Dog')
    expect(medicationFormSource).not.toMatch(/\bany\b|Record<string, any>|as any/)
    expect(breedingContextCardSource).not.toMatch(/\bany\b|Record<string, any>|as any/)
  })

  it('类型收口不得改变代理联系方式与犬只去向边界', () => {
    const agentSource = readWorkspaceFile('src/localdb/runtime/agent-mutations.ts')
    const dogSource = readWorkspaceFile('src/localdb/runtime/dog-mutations.ts')
    const localBuildersSource = readWorkspaceFile('src/localdb/runtime/local-builders.ts')

    expect(agentSource).toContain('contact_info: data.contact_info || null')
    expect(agentSource).not.toContain('notes: data.contact_info')
    expect(localBuildersSource).toContain('data.due_date != null && data.due_date <= now')
    expect(localBuildersSource).not.toContain('Number(data.due_date || 0) <= now')

    const updateDogSource = dogSource.slice(
      dogSource.indexOf('export async function updateDogLocally'),
      dogSource.indexOf('export async function updateDogNameLocally'),
    )
    expect(updateDogSource).toContain('role: dog.role')
    expect(updateDogSource).toContain('disposition: dog.disposition')
    expect(updateDogSource).not.toContain('role: data.role')
    expect(updateDogSource).not.toContain('disposition: data.disposition')
  })

  it('本地读模型应按领域拆分，core 只保留兼容导出', () => {
    const coreSource = readWorkspaceFile('src/localdb/domain-repository/core.ts')
    const dogSource = readWorkspaceFile('src/localdb/domain-repository/dogs.ts')
    const breedingSource = readWorkspaceFile('src/localdb/domain-repository/breeding.ts')
    const healthSource = readWorkspaceFile('src/localdb/domain-repository/health.ts')
    const financeSource = readWorkspaceFile('src/localdb/domain-repository/finance.ts')
    const saleSource = readWorkspaceFile('src/localdb/domain-repository/sale.ts')
    const settingsSource = readWorkspaceFile('src/localdb/domain-repository/settings-recycle.ts')

    expect(coreSource.trim().split('\n').length).toBeLessThanOrEqual(20)
    expect(coreSource).toContain("export * from './dogs'")
    expect(coreSource).toContain("export * from './breeding'")
    expect(coreSource).toContain("export * from './health'")
    expect(coreSource).toContain("export * from './finance'")
    expect(coreSource).toContain("export * from './sale'")
    expect(coreSource).toContain("export * from './settings-recycle'")
    expect(coreSource).not.toContain('export async function')
    expect(coreSource).not.toContain('localDb.query')

    for (const source of [dogSource, breedingSource, healthSource, financeSource, saleSource, settingsSource]) {
      expect(source).not.toContain("from '@/localdb/domain-repository/core'")
      expect(source).not.toContain("from './core'")
    }

    expect(dogSource).toContain('export async function listLocalDogsWithStatus')
    expect(dogSource).toContain('export async function getLocalDogDetail')
    expect(dogSource).not.toMatch(/\bany\b|Record<string, any>|query<any>|findById<any>|as any/)
    expect(breedingSource).toContain('export async function listLocalBreedingCycles')
    expect(breedingSource).toContain('export async function getLocalLitterDetail')
    expect(healthSource).toContain('export async function getLocalMedicationTaskDetail')
    expect(financeSource).toContain('export async function getLocalTransactionList')
    expect(saleSource).toContain('export async function listLocalSales')
    expect(settingsSource).toContain('export async function listLocalRecycleItems')
    expect(settingsSource).not.toMatch(/\bany\b|Record<string, any>|query<any>|findById<any>|as any/)
  })

  it('母犬 ROI 不应按窝重复调用单窝利润全量查询', () => {
    const breedingSource = readWorkspaceFile('src/localdb/domain-repository/breeding.ts')
    const damRoiSource = breedingSource.slice(
      breedingSource.indexOf('export async function getLocalDamRoi'),
      breedingSource.indexOf('function attachCycleNumbers'),
    )

    expect(damRoiSource).not.toContain('getLocalLitterProfit(')
    expect(damRoiSource).toContain('buildLitterProfitContext(')
    expect(damRoiSource).toContain('buildLocalLitterProfitFromRows(')
  })

  it('首页页面应只保留编排，核心模板下沉到组件', () => {
    const homeSource = readWorkspaceFile('src/pages/home/index.vue')
    const headerSource = readWorkspaceFile('src/pages/home/components/HomeHeader.vue')
    const cardSectionsSource = readWorkspaceFile('src/pages/home/components/HomeCardSections.vue')
    const sectionListSource = readWorkspaceFile('src/pages/home/components/HomeSectionList.vue')
    const sheetsSource = readWorkspaceFile('src/pages/home/components/HomeTaskSheets.vue')
    const taskActionsSource = readWorkspaceFile('src/pages/home/composables/useHomeTaskActions.ts')

    expect(homeSource.split('\n').length).toBeLessThan(1750)
    expect(homeSource).toContain('HomeHeader')
    expect(homeSource).toContain('HomeCardSections')
    expect(homeSource).toContain('HomeTaskSheets')
    expect(homeSource).toContain('useHomeSheets')
    expect(homeSource).toContain('useHomeTaskActions')
    expect(homeSource).not.toContain('BreedingProcessGroupCard')
    expect(homeSource).not.toContain('SmartCard')
    expect(homeSource).not.toContain('<BSheet')
    expect(homeSource).not.toContain('localSyncRuntime.completeTaskLocally')
    expect(homeSource).not.toContain('localSyncRuntime.postponeTasksLocally')
    expect(homeSource).not.toContain('localSyncRuntime.batchCompleteTasksLocally')
    expect(homeSource).not.toContain('localSyncRuntime.recordMedicationDoseLocally')
    expect(homeSource).not.toContain('localSyncRuntime.batchCompleteMedicationDayLocally')
    expect(homeSource).not.toContain('localSyncRuntime.recoverIllnessesLocally')
    expect(homeSource).not.toContain('localSyncRuntime.updateIllnessStatusLocally')
    expect(homeSource).not.toContain('localSyncRuntime.endMedicationByDogLocally')

    expect(headerSource).toContain('summaryPills')
    expect(cardSectionsSource).toContain('HomeSectionList')
    expect(sectionListSource).toContain('SmartCard')
    expect(sectionListSource).toContain('BreedingProcessGroupCard')
    expect(sheetsSource).toContain('<BSheet')
    expect(sheetsSource).toContain('confirm-quick-complete')
    expect(taskActionsSource).toContain('completeTaskLocally')
    expect(taskActionsSource).toContain('postponeTasksLocally')
    expect(taskActionsSource).toContain('recoverIllnessesLocally')
  })

  it('应确保纯选择组件不再直接读取云端', () => {
    const selectorFiles = [
      'src/components/form/BDogPicker.vue',
      'src/components/form/BLitterSelector.vue',
      'src/components/form/BCycleSelector.vue',
      'src/components/form/BFinanceLinkSheet.vue',
    ]

    for (const file of selectorFiles) {
      const source = readWorkspaceFile(file)
      expect(source).not.toContain('useCloudCall')
      expect(source).not.toContain('cloudCall(')
      expect(source).not.toContain('uniCloud.database(')
    }
  })

  it('应让选择器与本地派生销售犬龄最低显示为 1 天', () => {
    const pickerSource = readWorkspaceFile('src/components/form/BDogPicker.vue')
    const repositorySource = readWorkspaceFile('src/localdb/domain-repository/sale.ts')

    expect(pickerSource).toContain('const days = getBeijingOrdinalDay(birthTs) || 1')
    expect(pickerSource).not.toContain('const days = Math.floor((Date.now() - birthTs) / 86400000)')
    expect(repositorySource).toContain('const days = getBeijingOrdinalDay(birthTs) || 1')
    expect(repositorySource).not.toContain('const days = Math.floor((Date.now() - birthTs) / 86400000)')
  })

  it('BDogPicker 的 sheet-only 单选也应支持 selectedIds 默认选中态', () => {
    const pickerSource = readWorkspaceFile('src/components/form/BDogPicker.vue')
    expect(pickerSource).toContain('selectedIds.value = !hasModelValue.value')
    expect(pickerSource).toContain('if (!hasModelValue.value) {')
    expect(pickerSource).not.toContain('selectedIds.value = !hasModelValue.value && props.multiple')
    expect(pickerSource).not.toContain('if (!hasModelValue.value && props.multiple) {')
  })

  it('BDogPicker 在带角色候选的选择器中应保底显示品种横向筛选', () => {
    const pickerSource = readWorkspaceFile('src/components/form/BDogPicker.vue')
    expect(pickerSource).toContain("const PRESET_BREEDS = ['马尔济斯', '西施', '约克夏']")
    expect(pickerSource).toContain("props.candidateDogs !== undefined || !!props.roleFilter || !!props.genderFilter")
    expect(pickerSource).toContain("const customBreeds = currentFamily.value?.settings?.custom_breed_types || []")
    expect(pickerSource).toContain('class="b-dog-picker__filters-scroll"')
    expect(pickerSource).toContain('scroll-x')
  })

  it('BDogPicker 应在候选犬名字后展示繁育阶段天数', () => {
    const pickerSource = readWorkspaceFile('src/components/form/BDogPicker.vue')
    const breedingFormSource = readWorkspaceFile('src/components/record/BreedingRecordForm.vue')
    expect(pickerSource).toContain('class="b-dog-picker__stage-tag"')
    expect(pickerSource).toContain('showBreedingStage?: boolean')
    expect(pickerSource).toContain('showBreedingStage: false')
    expect(pickerSource).toContain('props.showBreedingStage && dogBreedingStageTag(dog)')
    expect(pickerSource).not.toContain('props.showBreedingStage && dogBreedingStageTag(singleDog)')
    expect(pickerSource).toContain('function dogBreedingStageTag')
    expect(pickerSource).toContain('发情第${day}天')
    expect(pickerSource).toContain('怀孕第${day}天')
    expect(breedingFormSource).toContain(':show-breeding-stage="true"')
  })

  it('疾病和用药犬只选择器应在名字右侧展示当前疾病与用药标签', () => {
    const pickerSource = readWorkspaceFile('src/components/form/BDogPicker.vue')
    const healthFormSource = readWorkspaceFile('src/components/record/HealthRecordForm.vue')
    const medicationFormSource = readWorkspaceFile('src/components/record/MedicationTaskForm.vue')

    expect(pickerSource).toContain('showHealthStatusTags?: boolean')
    expect(pickerSource).toContain('showHealthStatusTags: false')
    expect(pickerSource).toContain('class="b-dog-picker__health-tag"')
    expect(pickerSource).toContain("status?.type === '生病中' || status?.type === '用药中'")
    expect(pickerSource).toContain('buildCompactDeriveStatusTitle')
    expect(pickerSource).toContain('getDogStatusTone')
    expect(healthFormSource).toContain(':show-health-status-tags="shouldShowHealthStatusTags"')
    expect(healthFormSource).toContain("resolvedType.value === 'illness'")
    expect(medicationFormSource).toContain(':show-health-status-tags="true"')
  })

  it('发情、卵检、配种候选应通过本地记录展示上次发情日期', () => {
    const formSource = readWorkspaceFile('src/components/record/BreedingRecordForm.vue')
    const pickerSource = readWorkspaceFile('src/components/form/BDogPicker.vue')
    const repositorySource = readWorkspaceFile('src/localdb/domain-repository/breeding.ts')

    expect(formSource).toContain('listLocalLatestHeatDatesByDogIds')
    expect(formSource).toContain(':extra-meta-map="latestHeatMetaMap"')
    expect(formSource).not.toContain(':extra-meta-map="breedingDogExtraMetaMap"')
    expect(formSource.match(/:extra-meta-map="latestHeatMetaMap"/g)?.length).toBe(2)
    expect(formSource).toContain("&& ['heat', 'follicle_check', 'mating'].includes(breedingType.value)")
    expect(formSource).toContain('function hasCurrentHeatStatus')
    expect(formSource).toContain('if (currentHeatDogIds.has(dogId)) return map')
    expect(formSource).toContain('`上次发情：${text}`')
    expect(pickerSource).toContain('extraMetaMap?: Record<string, string>')
    expect(pickerSource).toContain('class="b-dog-picker__extra-meta"')
    expect(pickerSource).toContain("avatarVariant?: 'default' | 'sire'")
    expect(pickerSource).toContain("if (props.avatarVariant === 'sire') return 'b-dog-picker__avatar--blue'")
    expect(pickerSource).toContain('&--rose { background: linear-gradient(135deg, var(--rose), var(--amber)); }')
    expect(pickerSource).not.toContain('#ea3e77, #f0789a')
    expect(repositorySource).toContain('export async function listLocalLatestHeatDatesByDogIds')
    expect(repositorySource).toContain("row.type === 'heat'")
    expect(repositorySource).toContain('!row.deleted_at')
  })

  it('单犬繁育记录页应使用专用繁育上下文卡，临产监测也复用该组件', () => {
    const formSource = readWorkspaceFile('src/components/record/BreedingRecordForm.vue')
    const prelaborSource = readWorkspaceFile('src/pages/record/breeding-prelabor.vue')
    const contextCardSource = readWorkspaceFile('src/components/record/BBreedingContextCard.vue')

    expect(formSource).toContain('BBreedingContextCard')
    expect(formSource).toContain('v-if="isHeatMultiCreate"')
    expect(prelaborSource).toContain('BBreedingContextCard')
    expect(prelaborSource).not.toContain('prelabor-monitor__label-dot')
    expect(contextCardSource).toContain('b-breeding-context-card')
    expect(contextCardSource).toContain("readonly ? 'lock' : 'chevron_right'")
    expect(contextCardSource).toContain("emptyMeta: '繁育周期信息'")
    expect(contextCardSource).not.toContain('选择后显示繁育周期信息')
  })

  it('疫苗候选应通过本地记录展示上次疫苗日期，且不展示繁育阶段', () => {
    const formSource = readWorkspaceFile('src/components/record/HealthRecordForm.vue')
    const repositorySource = readWorkspaceFile('src/localdb/domain-repository/health.ts')

    expect(formSource).toContain('listLocalLatestVaccinationDatesByDogIds')
    expect(formSource).toContain(':extra-meta-map="latestHealthMetaMap"')
    expect(formSource).toContain('latestVaccinationMetaMap')
    expect(formSource).toContain('resolvedType.value === \'vaccination\'')
    expect(formSource).toContain('`上次疫苗：${text}`')
    expect(formSource).not.toContain(':show-breeding-stage="true"')
    expect(repositorySource).toContain('export async function listLocalLatestVaccinationDatesByDogIds')
    expect(repositorySource).toContain("row.type === 'vaccination'")
    expect(repositorySource).toContain('!row.deleted_at')
  })

  it('驱虫候选应通过本地记录展示上次驱虫日期，且不展示繁育阶段', () => {
    const formSource = readWorkspaceFile('src/components/record/HealthRecordForm.vue')
    const repositorySource = readWorkspaceFile('src/localdb/domain-repository/health.ts')

    expect(formSource).toContain('listLocalLatestDewormingDatesByDogIds')
    expect(formSource).toContain(':extra-meta-map="latestHealthMetaMap"')
    expect(formSource).toContain('latestDewormingMetaMap')
    expect(formSource).toContain('resolvedType.value === \'deworming\'')
    expect(formSource).toContain('`上次驱虫：${text}`')
    expect(formSource).not.toContain(':show-breeding-stage="true"')
    expect(repositorySource).toContain('export async function listLocalLatestDewormingDatesByDogIds')
    expect(repositorySource).toContain("row.type === 'deworming'")
    expect(repositorySource).toContain('!row.deleted_at')
  })

  it('应确保已迁移的页面详情读取不再直接依赖云端 detail 接口', () => {
    const pageReadContracts: Array<{ file: string; forbiddenReads: string[] }> = [
      {
        file: 'src/components/record/HealthRecordForm.vue',
        forbiddenReads: [
          'useCloudCall',
          'cloudCall(',
          "useCloudCall('task-service', 'getTask')",
          "useCloudCall('health-service', 'getHealthRecordDetail'",
          "useCloudCall('health-service', 'checkDuplicateIllness'",
        ],
      },
      {
        file: 'src/components/record/MedicationTaskForm.vue',
        forbiddenReads: [
          'useCloudCall',
          "useCloudCall('health-service', 'getHealthRecordDetail'",
          "useCloudCall<{ data: any[] }>('health-service', 'getHealthHistory'",
          "useCloudCall<{ data: any[] }>('health-service', 'batchCheckDuplicateMedication')",
        ],
      },
      {
        file: 'src/components/record/BreedingRecordForm.vue',
        forbiddenReads: [
          'useCloudCall',
          "useCloudCall('task-service', 'getTask')",
          "useCloudCall('breeding-service', 'getBreedingRecordDetail'",
          "useCloudCall('breeding-service', 'getNextMatingNumber'",
        ],
      },
      {
        file: 'src/pages/record/breeding-detail.vue',
        forbiddenReads: ['getBreedingRecordDetail', 'useCloudCall', 'cloudCall('],
      },
      {
        file: 'src/pages/record/health-detail.vue',
        forbiddenReads: ['getHealthRecordDetail', 'useCloudCall', 'cloudCall('],
      },
      {
        file: 'src/pages/record/medication-detail.vue',
        forbiddenReads: ['getMedicationTaskDetail', 'useCloudCall', 'cloudCall('],
      },
      {
        file: 'src/pages/breeding/cycle.vue',
        forbiddenReads: ['getCycleDetail', 'useCloudCall', 'cloudCall('],
      },
      {
        file: 'src/pages/breeding/litter.vue',
        forbiddenReads: ['getLitterDetail', 'useCloudCall', 'cloudCall('],
      },
      {
        file: 'src/pages/dog/detail.vue',
        forbiddenReads: [
          'useCloudCall',
          'cloudCall(',
          'getDogDetail',
          'getCycleHistory',
          'getCycleDetail',
          'getHealthHistory',
          'getMedicationHistory',
          'getLittersByDam',
          'getDogFinanceSummary',
          'getDamRoi',
          'getSaleList',
          'getWeightHistory',
        ],
      },
      {
        file: 'src/pages/health/batch-weight.vue',
        forbiddenReads: ['getActiveLitters', 'batchAddWeights', 'useCloudCall'],
      },
      {
        file: 'src/pages/record/health.vue',
        forbiddenReads: ['useCloudCall', 'cloudCall(', 'uniCloud.database('],
      },
      {
        file: 'src/pages/record/breeding.vue',
        forbiddenReads: ['useCloudCall', 'cloudCall(', 'uniCloud.database('],
      },
      {
        file: 'src/pages/home/batch-process.vue',
        forbiddenReads: ['getTasksByIds', 'batchCompleteTask', 'addHealthRecord', 'useCloudCall'],
      },
      {
        file: 'src/pages/sale/list.vue',
        forbiddenReads: ['getSaleList'],
      },
      {
        file: 'src/pages/sale/create.vue',
        forbiddenReads: ['useCloudCall', 'cloudCall('],
      },
      {
        file: 'src/pages/sale/agents.vue',
        forbiddenReads: ['getAgentList', 'useCloudCall', 'cloudCall('],
      },
      {
        file: 'src/pages/sale/detail.vue',
        forbiddenReads: ['getSaleDetail', 'getAgentList', 'useCloudCall', 'cloudCall(', 'forceSyncScope('],
      },
      {
        file: 'src/pages/profile/index.vue',
        forbiddenReads: ['useCloudCall', 'cloudCall(', 'loadFamily'],
      },
      {
        file: 'src/pages/profile/notifications.vue',
        forbiddenReads: ['useCloudCall', 'cloudCall(', 'uniCloud.database(', 'loadFamily'],
      },
      {
        file: 'src/pages/profile/defaults.vue',
        forbiddenReads: ['useCloudCall', 'cloudCall(', 'uniCloud.database(', 'loadFamily'],
      },
      {
        file: 'src/pages/profile/care-rules.vue',
        forbiddenReads: ['useCloudCall', 'cloudCall(', 'uniCloud.database(', 'loadFamily'],
      },
      {
        file: 'src/pages/profile/expense-categories.vue',
        forbiddenReads: ['useCloudCall', 'cloudCall(', 'uniCloud.database(', 'loadFamily'],
      },
      {
        file: 'src/pages/health/medication-protocols.vue',
        forbiddenReads: ['useCloudCall', 'cloudCall(', 'uniCloud.database('],
      },
      {
        file: 'src/pages/finance/expense-detail.vue',
        forbiddenReads: ['getExpenseDetail', 'useCloudCall', 'cloudCall(', 'forceSyncScope('],
      },
      {
        file: 'src/pages/finance/income-detail.vue',
        forbiddenReads: ['getIncomeDetail', 'useCloudCall', 'cloudCall(', 'forceSyncScope('],
      },
      {
        file: 'src/pages/finance/stats.vue',
        forbiddenReads: ['getFinancialSummary'],
      },
      {
        file: 'src/pages/finance/index.vue',
        forbiddenReads: ['getTransactionList', 'getExpenseCategories', 'getExpenseCategoryGroups'],
      },
      {
        file: 'src/pages/finance/expense-add.vue',
        forbiddenReads: ['getExpenseCategories', 'getDogDetail', 'useCloudCall', 'cloudCall('],
      },
      {
        file: 'src/pages/finance/expense-edit.vue',
        forbiddenReads: ['getExpenseDetail', 'getExpenseCategories', 'useCloudCall', 'cloudCall('],
      },
      {
        file: 'src/pages/finance/income-edit.vue',
        forbiddenReads: ['getIncomeDetail', 'useCloudCall', 'cloudCall('],
      },
      {
        file: 'src/pages/finance/projection.vue',
        forbiddenReads: ['getProjectionParams'],
      },
      {
        file: 'src/pages/finance/dam-roi.vue',
        forbiddenReads: ['getDamRoi'],
      },
      {
        file: 'src/pages/finance/litter-profit.vue',
        forbiddenReads: ['getLitterProfit'],
      },
      {
        file: 'src/pages/dog/add.vue',
        forbiddenReads: ['useCloudCall', 'cloudCall(', 'loadFamily'],
      },
      {
        file: 'src/pages/breeding/birth-wizard.vue',
        forbiddenReads: ['useCloudCall', 'cloudCall('],
      },
    ]

    for (const { file, forbiddenReads } of pageReadContracts) {
      const source = readWorkspaceFile(file)

      for (const signature of forbiddenReads) {
        expect(source, `${file} should not read via ${signature}`).not.toContain(signature)
      }
    }
  })

  it('应确保 local-first 页面统一接入 usePageSync', () => {
    const pagesConfig = JSON.parse(readWorkspaceFile('src/pages.json'))
    const localFirstRoutes: string[] = []

    for (const page of pagesConfig.pages || []) {
      const path = String(page?.path || '').trim()
      if (!path) continue
      const resolved = resolveSyncScopeForRoute(path)
      if (resolved?.mode === 'local-first') {
        localFirstRoutes.push(path)
      }
    }

    for (const routePath of localFirstRoutes) {
      const source = readWorkspaceFile(`src/${routePath}.vue`)
      expect(source, `${routePath} should use usePageSync`).toContain('usePageSync(')
    }
  })

  it('应为 pages.json 中每个路由提供同步归类', () => {
    const pagesConfig = JSON.parse(readWorkspaceFile('src/pages.json'))
    const routes: string[] = []

    for (const page of pagesConfig.pages || []) {
      routes.push(page.path)
    }

    for (const subPackage of pagesConfig.subPackages || []) {
      for (const page of subPackage.pages || []) {
        routes.push(`${subPackage.root}/${page.path}`)
      }
    }

    for (const route of routes) {
      expect(resolveSyncScopeForRoute(route), `missing scope for ${route}`).not.toBeNull()
    }
  })
})
