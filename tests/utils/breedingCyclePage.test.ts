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
    expect(source).toContain('@click="onRecordTap(record)"')
    expect(source).toContain("/pages/record/breeding-detail?id=${record._id}")
  })

  it('应让时间线轨道顶部对齐并保持点与点之间连线贯通', () => {
    expect(source).toContain('align-items: flex-start;')
    expect(source).toContain('justify-content: flex-start;')
    expect(source).toContain('align-self: stretch;')
    expect(source).toContain('padding-top: 30px;')
    expect(source).toContain('background: rgba(216, 203, 189, 0.42);')
  })

  it('应收敛未来节点和历史节点的颜色语义', () => {
    expect(source).toContain("heat: 'amber'")
    expect(source).toContain("record?._is_future ? 'text-4' : dotColor(record?.type)")
    expect(source).toContain("class=\"timeline-desc\" :class=\"{ 'timeline-desc--future': record._is_future }\"")
    expect(source).toContain('.timeline-desc--future')
    expect(source).toContain('.timeline-detail--future')
    expect(source).not.toContain("record._is_future ? { color: 'var(--primary)' } : {}")
  })
})
