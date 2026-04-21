import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/dog/detail.vue'), 'utf8')

describe('dog detail breeding tab source contract', () => {
  it('应在犬只详情中接入当前周期摘要时间线与历史周期摘要', () => {
    expect(source).toContain('activeCycleSummary.timeline')
    expect(source).toContain('historyCycleCards')
    expect(source).toContain('breeding-active-cycle__timeline-item')
    expect(source).toContain('summaryTitle')
    expect(source).toContain('summarySubtitle')
  })

  it('应让时间线节点顶部对齐，并仅为当前/下一步保留特殊标题色', () => {
    expect(source).toContain('align-items: flex-start;')
    expect(source).toContain('justify-content: flex-start;')
    expect(source).toContain('align-self: stretch;')
    expect(source).toContain('padding-top: 3px;')
    expect(source).toContain("item.kind === 'upcoming' ? 'breeding-active-cycle__timeline-title--gray' : ''")
    expect(source).toContain("item.kind === 'current' ? `breeding-active-cycle__timeline-title--${item.tone}` : ''")
    expect(source).not.toContain('.breeding-active-cycle__timeline-title--teal')
    expect(source).not.toContain('.breeding-active-cycle__timeline-title--green')
    expect(source).not.toContain('.breeding-active-cycle__timeline-title--blue')
  })

  it('应只在繁育 Tab 懒加载当前周期详情，并支持来源页返回刷新', () => {
    expect(source).toContain("useCloudCall<{ data: BreedingCycleDetailResponse }>('breeding-service', 'getCycleDetail'")
    expect(source).toContain('watch([activeTab, activeCycleId]')
    expect(source).toContain("if (tab === 'breeding')")
    expect(source).toContain('refreshBreedingSummary')
    expect(source).toContain("refreshBreedingSummary: activeTab.value === 'breeding'")
  })
})
