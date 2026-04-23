import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))

function readSource(path: string) {
  return readFileSync(resolve(testDir, path), 'utf8')
}

describe('page loading skeletons', () => {
  it('共享繁育和健康记录表单用骨架替换首屏文字 loading', () => {
    const breedingSource = readSource('../../src/components/record/BreedingRecordForm.vue')
    const healthSource = readSource('../../src/components/record/HealthRecordForm.vue')

    expect(breedingSource).toContain('class="record-form-skeleton"')
    expect(breedingSource).toContain('const skeletonBlocks = computed<BreedingSkeletonBlock[]>(() => {')
    expect(breedingSource).toContain('class="record-form-skeleton__submit record-form-skeleton__shimmer"')
    expect(breedingSource).not.toContain('加载中...')
    expect(breedingSource).not.toContain('class="loading-state"')

    expect(healthSource).toContain('class="health-form-skeleton"')
    expect(healthSource).toContain('const skeletonBlocks = computed<HealthSkeletonBlock[]>(() => {')
    expect(healthSource).toContain('class="health-form-skeleton__submit health-form-skeleton__shimmer"')
    expect(healthSource).not.toContain('加载中...')
    expect(healthSource).not.toContain('class="loading-state"')
  })

  it('财务编辑页首屏改为拟真骨架并保留底部按钮占位', () => {
    const expenseSource = readSource('../../src/pages/finance/expense-edit.vue')
    const incomeSource = readSource('../../src/pages/finance/income-edit.vue')

    expect(expenseSource).toContain('class="finance-edit-skeleton"')
    expect(expenseSource).toContain('class="finance-edit-skeleton__submit finance-edit-skeleton__shimmer"')
    expect(expenseSource).not.toContain('加载中...')

    expect(incomeSource).toContain('class="finance-income-skeleton"')
    expect(incomeSource).toContain('class="finance-income-skeleton__submit finance-income-skeleton__shimmer"')
    expect(incomeSource).not.toContain('加载中...')
  })

  it('操作日志页首屏和追加加载都使用列表骨架', () => {
    const source = readSource('../../src/pages/profile/operation-log.vue')

    expect(source).toContain('v-if="loading && !logs.length" class="log-list"')
    expect(source).toContain('v-if="loadingMore && logs.length" class="log-list log-list--append"')
    expect(source).toContain('class="log-item log-item--skeleton"')
    expect(source).toContain('class="log-icon log-icon--skeleton log-skeleton__shimmer"')
    expect(source).toContain('>加载更多<')
    expect(source).not.toContain('加载中...')
  })

  it('犬只详情繁育 Tab 的当前周期摘要改为局部骨架', () => {
    const source = readSource('../../src/pages/dog/detail.vue')

    expect(source).toContain('v-if="activeCycleDetailLoading" class="breeding-active-cycle__loading"')
    expect(source).toContain('class="breeding-active-cycle__skeleton"')
    expect(source).toContain('class="breeding-active-cycle__skeleton-dot breeding-active-cycle__skeleton-shimmer"')
    expect(source).toContain('@keyframes active-cycle-skeleton-shimmer')
    expect(source).not.toContain('正在加载当前周期摘要...')
  })

  it('窝详情页首屏使用拟真骨架并保留底部操作区占位', () => {
    const source = readSource('../../src/pages/breeding/litter.vue')

    expect(source).toContain('class="litter-skeleton__summary"')
    expect(source).toContain('class="litter-skeleton__stats"')
    expect(source).toContain('class="litter-skeleton__dock-cta litter-skeleton__shimmer"')
    expect(source).toContain('@keyframes litter-skeleton-shimmer')
    expect(source).not.toContain('<BSkeleton v-if="!litter && loading"')
  })
})
