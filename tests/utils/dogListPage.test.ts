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

  it('从档案页进入新建页时应显式传回跳目标路由，并在后台刷新后继续尝试承接新犬只', () => {
    expect(source).toContain("uni.navigateTo({ url: `/pages/dog/add?targetRoute=${encodeURIComponent('/pages/dog/list')}` })")
    expect(source).toContain("pendingFeedbackDogId = feedback.targetDogId")
    expect(source).toContain('void tryRevealPendingDog()')
  })
})
