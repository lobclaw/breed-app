import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/breeding/cycle.vue'), 'utf8')

describe('breeding cycle page source contract', () => {
  it('应保留卡片式时间线结构和记录跳转入口', () => {
    expect(source).toContain('timeline-card')
    expect(source).toContain('timeline-chevron')
    expect(source).toContain('timeline-badge')
    expect(source).toContain('@click="onTimelineItemTap(item)"')
    expect(source).toContain("/pages/record/breeding-detail?id=${item.recordId}")
  })

  it('应让时间线轨道顶部对齐并保持点与点之间连线贯通', () => {
    expect(source).toContain('align-items: flex-start;')
    expect(source).toContain('justify-content: flex-start;')
    expect(source).toContain('align-self: stretch;')
    expect(source).toContain('padding-top: 30px;')
    expect(source).toContain('background: rgba(216, 203, 189, 0.42);')
  })

  it('应在详情页顶部接入当前状态和下一步合成节点，而不是给第一条记录打最新', () => {
    expect(source).toContain('buildBreedingTimelineSyntheticItems')
    expect(source).toContain("dateLabel: item.kind === 'current' ? '当前' : '下一步'")
    expect(source).not.toContain('idx === 0')
    expect(source).not.toContain('最新')
  })

  it('应在周期摘要卡为种公名称提供最近配种记录 fallback', () => {
    expect(source).toContain('const resolvedSireName = computed(() => {')
    expect(source).toContain("const latestMatingRecord = timelineRecords.value.find(record => record?.type === 'mating')")
    expect(source).toContain("String(matingDetails.sire_name || matingDetails.male_name || '').trim()")
    expect(source).toContain("{{ resolvedSireName || '未知' }}")
  })

  it('应让窝信息卡显式表现为可进入详情', () => {
    expect(source).toContain('litter-section-head__action')
    expect(source).toContain('查看详情')
    expect(source).toContain('litter-link-card__hint')
    expect(source).toContain('进入窝详情')
    expect(source).toContain('@click="goToLitter(litter._id)"')
  })

  it('周期费用应优先显示归一化分类而不是备注', () => {
    expect(source).toContain('const costByCategory = new Map<string, number>()')
    expect(source).toContain("const label = item.category ? normalizeExpenseCategoryName(item.category) : '支出'")
    expect(source).toContain('costByCategory.set(label, (costByCategory.get(label) || 0) + Number(item.total_amount || 0))')
    expect(source).toContain('return Array.from(costByCategory.entries()).map(([label, amount]) => ({')
    expect(source).not.toContain("label: item.notes || item.category || '支出'")
  })

  it('应收敛未来节点和历史节点的颜色语义，并复用共享 tone helper', () => {
    expect(source).toContain('getBreedingTimelineRecordTone')
    expect(source).toContain('getBreedingTimelineCurrentStatusTone')
    expect(source).toContain("tone: record._is_future ? 'gray' as const : getBreedingTimelineRecordTone(record.type)")
    expect(source).toContain("class=\"timeline-desc\"")
    expect(source).toContain('.timeline-desc--future')
    expect(source).toContain('.timeline-detail--future')
    expect(source).toContain('.timeline-desc--rose')
  })
})
