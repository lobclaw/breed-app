import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveSyncScopeForRoute } from '../../src/localdb/scope-registry'

function readWorkspaceFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

describe('local-first source contract', () => {
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

  it('应确保已迁移的页面详情读取不再直接依赖云端 detail 接口', () => {
    const pageReadContracts: Array<{ file: string; forbiddenReads: string[] }> = [
      {
        file: 'src/pages/record/breeding-detail.vue',
        forbiddenReads: ['getBreedingRecordDetail'],
      },
      {
        file: 'src/pages/record/health-detail.vue',
        forbiddenReads: ['getHealthRecordDetail'],
      },
      {
        file: 'src/pages/record/medication-detail.vue',
        forbiddenReads: ['getMedicationTaskDetail'],
      },
      {
        file: 'src/pages/breeding/cycle.vue',
        forbiddenReads: ['getCycleDetail'],
      },
      {
        file: 'src/pages/breeding/litter.vue',
        forbiddenReads: ['getLitterDetail'],
      },
      {
        file: 'src/pages/health/batch-weight.vue',
        forbiddenReads: ['getActiveLitters'],
      },
      {
        file: 'src/pages/sale/list.vue',
        forbiddenReads: ['getSaleList'],
      },
      {
        file: 'src/pages/sale/agents.vue',
        forbiddenReads: ['getAgentList'],
      },
      {
        file: 'src/pages/sale/detail.vue',
        forbiddenReads: ['getSaleDetail', 'getAgentList'],
      },
      {
        file: 'src/pages/finance/expense-detail.vue',
        forbiddenReads: ['getExpenseDetail'],
      },
      {
        file: 'src/pages/finance/income-detail.vue',
        forbiddenReads: ['getIncomeDetail'],
      },
      {
        file: 'src/pages/finance/stats.vue',
        forbiddenReads: ['getFinancialSummary'],
      },
      {
        file: 'src/pages/finance/projection.vue',
        forbiddenReads: ['getProjectionParams'],
      },
    ]

    for (const { file, forbiddenReads } of pageReadContracts) {
      const source = readWorkspaceFile(file)

      for (const signature of forbiddenReads) {
        expect(source, `${file} should not read via ${signature}`).not.toContain(signature)
      }
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
