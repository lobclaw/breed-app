import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/dog/detail.vue'), 'utf8')

describe('dog detail loading contract', () => {
  it('应将首屏整页骨架改为页面专属拟真骨架', () => {
    expect(source).toContain(`v-if="pageLoadStage === 'bootstrapping'" class="dog-detail dog-detail--skeleton"`)
    expect(source).toContain('class="dog-detail__topbar dog-detail__topbar--skeleton"')
    expect(source).toContain('class="dog-detail__hero dog-detail__hero--skeleton"')
    expect(source).toContain('class="dog-detail__status-merged dog-detail__status-merged--skeleton"')
    expect(source).toContain('class="dog-detail__collapse-head dog-detail__collapse-head--skeleton"')
    expect(source).not.toContain('<BSkeleton v-if="loading" :rows="3" :avatar="true" />')
  })

  it('应将首屏加载拆成 bootstrapping 与概览区渐进式回填', () => {
    expect(source).toContain(`const pageLoadStage = ref<'bootstrapping' | 'ready'>('bootstrapping')`)
    expect(source).toContain('const healthRecordsLoaded = ref(false)')
    expect(source).toContain('const cyclesLoaded = ref(false)')
    expect(source).toContain('const overviewHydrating = computed(() => !!dog.value && (!healthRecordsLoaded.value || showTertiaryStatSkeleton.value))')
    expect(source).toContain("const showBootstrapSkeleton = !silent && !hasLoadedOnce")
    expect(source).toContain("pageLoadStage.value = 'bootstrapping'")
    expect(source).toContain("pageLoadStage.value = 'ready'")
    expect(source).toContain('listLocalDogHealthHistory')
    expect(source).toContain('listLocalDogMedicationHistory')
    expect(source).toContain('getLocalDogFinanceSummary')
  })

  it('应让概览与各 tab 在数据未回齐时使用局部骨架而非提前空态', () => {
    expect(source).toContain('v-if="showTertiaryStatSkeleton" class="dog-detail__stat-value-skeleton dog-detail__skeleton-shimmer"')
    expect(source).toContain('v-if="!healthRecordsLoaded" class="dog-detail__rec-list dog-detail__rec-list--skeleton"')
    expect(source).toContain('v-if="!breedingTabLoaded" class="dog-detail__tab-loading"')
    expect(source).toContain('v-if="!healthTabLoaded" class="dog-detail__tab-loading"')
    expect(source).toContain('v-if="!financeLoaded" class="dog-detail__tab-loading"')
    expect(source).toContain('const breedingTabLoaded = computed(() => cyclesLoaded.value && littersLoaded.value)')
    expect(source).toContain('const healthTabLoaded = computed(() => healthRecordsLoaded.value && medicationHistoryLoaded.value)')
  })

  it('应保留来源页返回静默刷新，不回退整页骨架', () => {
    expect(source).toContain("if (dogId && (feedback || hasLoadedOnce)) {")
    expect(source).toContain('loadData({')
    expect(source).toContain('silent: hasLoadedOnce,')
    expect(source).toContain("refreshBreedingSummary: !!feedback && activeTab.value === 'breeding'")
  })
})
