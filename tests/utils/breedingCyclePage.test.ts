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

  it('应在详情页顶部接入状态合成节点并使用合成标签，而不是给第一条记录打最新', () => {
    expect(source).toContain('buildBreedingTimelineSyntheticItems')
    expect(source).toContain('dateLabel: item.label')
    expect(source).toContain("isActive: item.kind === 'current' && item.label === '当前'")
    expect(source).toContain("item.isActive ? 'timeline-dot--current' : ''")
    expect(source).toContain("if (cycle.value.status === '已生产' && typeof litter.value?.weaned_at === 'number') return '已完成'")
    expect(source).toContain("if (cycle.value.status === '失败' || cycle.value.status === '放弃') return '已终止'")
    expect(source).not.toContain('idx === 0')
    expect(source).not.toContain('最新')
  })

  it('应在周期摘要卡为种公名称提供最近配种记录 fallback', () => {
    expect(source).toContain('const resolvedSireName = computed(() => {')
    expect(source).toContain("const latestMatingRecord = timelineRecords.value.find(record => record?.type === 'mating')")
    expect(source).toContain("String(matingDetails.sire_name || matingDetails.male_name || '').trim()")
    expect(source).toContain("{{ resolvedSireName || '未知' }}")
  })

  it('应仅在窝信息标题行保留详情入口', () => {
    expect(source).toContain('BSectionLabel title="窝信息"')
    expect(source).toContain('litter-section-head__action')
    expect(source).toContain('查看详情')
    expect(source).not.toContain('litter-link-card__hint')
    expect(source).not.toContain('进入窝详情')
    expect(source).toContain('@click="goToLitter(litter._id)"')
  })

  it('应把窝信息放在周期概要之后、费用和时间线之前', () => {
    const summaryIndex = source.indexOf('<!-- 周期信息卡片 -->')
    const litterIndex = source.indexOf('<!-- 窝信息 -->')
    const costIndex = source.indexOf('<!-- 费用 -->')
    const timelineIndex = source.indexOf('<!-- 时间线 -->')
    expect(summaryIndex).toBeGreaterThanOrEqual(0)
    expect(litterIndex).toBeGreaterThan(summaryIndex)
    expect(costIndex).toBeGreaterThan(litterIndex)
    expect(timelineIndex).toBeGreaterThan(costIndex)
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

  it('应把记录入口归到添加记录，更多操作只保留未配种放弃', () => {
    expect(source).toContain('const hasMatingRecord = computed(() => records.value.some(record => record?.type === \'mating\'))')
    expect(source).toContain("cycle.value?.status === '发情中'")
    expect(source).toContain('!hasMatingRecord.value')
    expect(source).toContain('const hasMoreActions = computed(() => canAbandonCycle.value)')
    expect(source).toContain('<text class="more-action-label">放弃本周期</text>')
    expect(source).toContain('createCycleBreedingAddRecordGroups(cycle.value?.status, { records: records.value })')
    expect(source).toContain("if (item.page === 'birth-wizard')")
    expect(source).toContain('/pages/breeding/birth-wizard?cycleId=${cycleId}&damName=${damName}')
    expect(source).not.toContain('const canAddBirth')
    expect(source).not.toContain('handleAddBirthFromMore')
    expect(source).not.toContain('goToTerminationRecord')
    expect(source).not.toContain('more-action-label--danger')
  })

  it('应在周期摘要中突出预产期相对天数', () => {
    expect(source).toContain('class="info-value info-value--due"')
    expect(source).toContain('class="info-value__date"')
    expect(source).toContain('class="info-value__separator"')
    expect(source).toContain('class="info-value__relative"')
    expect(source).toContain('{{ expectedDueDateRelativeText }}')
    expect(source).toContain('gap: 4px;')
    expect(source).toContain('color: var(--primary);')
  })
})
