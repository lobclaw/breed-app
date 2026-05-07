import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveSyncScopeForRoute } from '../../src/localdb/scope-registry'

function readWorkspaceFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('local-first source contract', () => {
  it('usePageSync 不应在页面 onShow 中触发 core mirror', () => {
    const source = readWorkspaceFile('src/composables/usePageSync.ts')
    expect(source).not.toContain('localSyncRuntime.resume(')
    expect(source).toContain('localSyncRuntime.setCurrentFamilyId(familyId)')
    expect(source).toContain('resolveSyncScopeForRoute(options.routePath, query)')
    const routeBranch = source.slice(source.indexOf('const resolved = resolveSyncScopeForRoute'))
    expect(routeBranch.indexOf('scopeKey = resolved?.key ||')).toBeLessThan(routeBranch.indexOf('await localSyncRuntime.setActiveScope(scopeKey)'))
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
    const repositorySource = readWorkspaceFile('src/localdb/domain-repository.ts')

    expect(pickerSource).toContain('const days = Math.max(1, Math.floor((Date.now() - birthTs) / 86400000))')
    expect(pickerSource).not.toContain('const days = Math.floor((Date.now() - birthTs) / 86400000)')
    expect(repositorySource).toContain('const days = Math.max(1, Math.floor((Date.now() - birthTs) / 86400000))')
    expect(repositorySource).not.toContain('const days = Math.floor((Date.now() - birthTs) / 86400000)')
  })

  it('BDogPicker 的 sheet-only 单选也应支持 selectedIds 默认选中态', () => {
    const pickerSource = readWorkspaceFile('src/components/form/BDogPicker.vue')
    expect(pickerSource).toContain('selectedIds.value = !hasModelValue.value')
    expect(pickerSource).toContain('if (!hasModelValue.value) {')
    expect(pickerSource).not.toContain('selectedIds.value = !hasModelValue.value && props.multiple')
    expect(pickerSource).not.toContain('if (!hasModelValue.value && props.multiple) {')
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
        file: 'src/pages/record/prelabor-monitor.vue',
        forbiddenReads: ['uniCloud.database(', "useCloudCall('breeding-service', 'addBreedingRecord'"],
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
        file: 'src/pages/finance/income-add.vue',
        forbiddenReads: ['useCloudCall', 'cloudCall(', 'uniCloud.database('],
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
