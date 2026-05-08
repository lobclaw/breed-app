import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/dog/list.vue'), 'utf8')

describe('dog list page source contract', () => {
  it('应消费 submit feedback 并显示弱成功反馈', () => {
    expect(source).toContain("import { consumeSubmitFeedback } from '@/composables/useSubmitFeedback'")
    expect(source).toContain("const feedback = consumeSubmitFeedback('/pages/dog/list')")
    expect(source).toContain('<BSubmitBanner :message="submitBannerMessage" />')
    expect(source).toContain('function showSubmitBanner(message: string)')
    expect(source).toContain('showSubmitBanner(feedback.message)')
  })

  it('当新犬只在当前结果中可见时应自动定位并短暂高亮', () => {
    expect(source).toContain("const visibleDog = filteredDogs.value.find(dog => dog._id === pendingFeedbackDogId)")
    expect(source).toContain('highlightDogOnce(pendingFeedbackDogId)')
    expect(source).toContain('await scrollToDogCard(pendingFeedbackDogId)')
    expect(source).toContain(":id=\"dogCardId(dog._id)\"")
    expect(source).toContain("'dog-list__card--fresh': highlightedDogId === dog._id")
  })

  it('当新犬只被当前筛选或搜索挡住时应保留上下文并只提示未显示', () => {
    expect(source).toContain("const targetDog = dogs.value.find(dog => dog._id === pendingFeedbackDogId)")
    expect(source).toContain("pendingFeedbackHiddenMessage = `${feedback.message}，当前筛选下未显示`")
    expect(source).not.toContain("searchKeyword.value = ''")
    expect(source).not.toContain("activeFilter.value = 'all'")
  })

  it('应继续保留现有默认业务排序逻辑而不是切到 created_at 倒序', () => {
    expect(source).toContain('const bucketDiff = a.sortBucket - b.sortBucket')
    expect(source).toContain('const activeDiff = Number(b.isActiveStatusDog) - Number(a.isActiveStatusDog)')
    expect(source).toContain('const statusDiff = a.statusPriority - b.statusPriority')
    expect(source).not.toContain('b.created_at - a.created_at')
  })

  it('状态标签最多显示 3 个，并且有繁育状态时必须进入可见标签', () => {
    expect(source).toContain('const MAX_STATUS_TAGS = 3')
    expect(source).toContain("const BREEDING_STATUS_TYPES = new Set<DeriveStatusType>(['发情中', '怀孕中', '哺乳中'])")
    expect(source).toContain('function pickVisibleStatusTags(activeStatuses: DeriveStatus[])')
    expect(source).toContain('const breedingStatus = activeStatuses.find(isBreedingStatus)')
    expect(source).toContain('visibleStatuses[visibleStatuses.length - 1] = breedingStatus')
    expect(source).toContain('return pickVisibleStatusTags(activeStatuses).map((status, index) => ({')
  })

  it('外部种公列表卡片不展示在养这类去向标签', () => {
    expect(source).toContain('v-if="shouldShowDispositionTag(dog)"')
    expect(source).toContain("function shouldShowDispositionTag(dog: DogListItem) {")
    expect(source).toContain("return dog.role !== '外部种公'")
  })

  it('应通过历史快捷筛选展示历史去向犬只，并切换去向筛选项', () => {
    expect(source).toContain("type QuickFilterValue = 'all' | 'breeding' | 'puppy' | 'sale' | 'external' | 'history'")
    expect(source).toContain("{ label: '历史', value: 'history' }")
    expect(source).toContain("const CURRENT_DISPOSITIONS: DogDisposition[] = ['在养', '自留', '待售', '已预定']")
    expect(source).toContain("const HISTORY_DISPOSITIONS: DogDisposition[] = ['已售', '已领养', '已赠送', '已退休', '已故']")
    expect(source).toContain("listLocalDogsWithStatus(familyId, { dispositions: HISTORY_DISPOSITIONS })")
    expect(source).toContain("isHistoryView.value ? historyDispositionOptions : currentDispositionOptions")
    expect(source).toContain('<text class="filter-section__label">范围</text>')
    expect(source).toContain('<text class="filter-pill__text">当前档案</text>')
    expect(source).toContain('<text class="filter-pill__text">历史档案</text>')
    expect(source).toContain('<view v-if="!isHistoryView" class="filter-section">')
    expect(source).toContain('function setArchiveScope(history: boolean)')
  })

  it('筛选弹层操作按钮应放入固定底部 footer', () => {
    expect(source).toContain('<template #footer>')
    expect(source).toContain('class="filter-actions__btn filter-actions__btn--ghost"')
    expect(source).toContain('class="filter-actions__btn filter-actions__btn--primary"')
    expect(source).toContain('padding: 10px var(--space-page) calc(env(safe-area-inset-bottom, 20px) + 12px);')
  })

  it('已应用筛选的清空入口应使用弱灰小号样式', () => {
    expect(source).toContain('.dog-list__applied-clear')
    expect(source).toContain('font-size: 11px;')
    expect(source).toContain('font-weight: 700;')
    expect(source).toContain('color: var(--text-3);')
  })

  it('应让出生当天的列表年龄最低显示为 1 天', () => {
    expect(source).toContain('const days = getBeijingOrdinalDay(birthTs) || 1')
    expect(source).not.toContain('const days = Math.floor((now - birthTs) / 86400000)')
  })

  it('从档案页进入新建页时应显式传回跳目标路由，并在后台刷新后继续尝试承接新犬只', () => {
    expect(source).toContain("uni.navigateTo({ url: `/pages/dog/add?targetRoute=${encodeURIComponent('/pages/dog/list')}` })")
    expect(source).toContain("pendingFeedbackDogId = feedback.targetDogId")
    expect(source).toContain('void tryRevealPendingDog()')
  })
})
