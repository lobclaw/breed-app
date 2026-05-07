import { describe, expect, it } from 'vitest'
import { getAllSyncRouteCoverage, resolveSyncScopeForRoute } from '../../src/localdb/scope-registry'

describe('sync scope registry', () => {
  it('应覆盖首页、犬只、财务、记录和在线优先页面', () => {
    const coverage = getAllSyncRouteCoverage()
    const keys = coverage.map(item => item.key)

    expect(keys).toContain('home')
    expect(keys).toContain('dog-list')
    expect(keys).toContain('finance-list')
    expect(keys).toContain('record-entry')
    expect(keys).toContain('auth-online')
    expect(keys).toContain('operation-log-online')
  })

  it('应为详情页解析稳定的动态 scope key', () => {
    expect(resolveSyncScopeForRoute('pages/dog/detail', { id: 'dog_1' })?.key).toBe('dog-detail:dog_1')
    expect(resolveSyncScopeForRoute('pages/breeding/cycle', { cycleId: 'cycle_1' })?.key).toBe('breeding-cycle:cycle_1')
    expect(resolveSyncScopeForRoute('pages/record/health-detail', { record_id: 'record_1' })?.key).toBe('health-record:record_1')
    expect(resolveSyncScopeForRoute('pages/record/medication-detail', { medication_task_id: 'med_1' })?.key).toBe('medication-task:med_1')
  })

  it('犬舍总览应同步家庭镜像以支持昵称本地写入', () => {
    const scope = resolveSyncScopeForRoute('pages/profile/index')
    expect(scope?.key).toBe('kennel-dashboard')
    expect(scope?.collections).toContain('families')
  })

  it('应把静态页、在线优先页和废弃重定向页正确归类', () => {
    expect(resolveSyncScopeForRoute('pages/profile/about')?.mode).toBe('static')
    expect(resolveSyncScopeForRoute('pages/profile/backup')?.mode).toBe('online-first')
    expect(resolveSyncScopeForRoute('pages/record/health')?.mode).toBe('redirect-deprecated')
    expect(resolveSyncScopeForRoute('pages/record/breeding')?.mode).toBe('redirect-deprecated')
    expect(resolveSyncScopeForRoute('pages/finance/income-add')?.mode).toBe('redirect-deprecated')
  })
})
