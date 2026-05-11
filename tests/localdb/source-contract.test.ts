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
    const repositorySource = readWorkspaceFile('src/localdb/domain-repository.ts')

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
    const repositorySource = readWorkspaceFile('src/localdb/domain-repository.ts')

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
    const repositorySource = readWorkspaceFile('src/localdb/domain-repository.ts')

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
