import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/health/batch-weight.vue'), 'utf8')

describe('batch-weight source contract', () => {
  it('应在选中窝次后补齐本地窝详情和幼崽列表', () => {
    expect(source).toContain('getLocalLitterDetail')
    expect(source).toContain('await getLocalLitterDetail(familyId, litter._id)')
    expect(source).toContain('puppies.value = buildNormalizedPuppies(detail?.puppies || litter.puppies || [])')
  })

  it('应按北京时间出生第 1 天起算，并用窝级存活数展示摘要', () => {
    expect(source).toContain('getBeijingDayStart(Date.now()) - getBeijingDayStart(selectedLitter.value.birth_date)')
    expect(source).toContain('Math.max(1, Math.floor')
    expect(source).toContain('const livePuppyCount = computed(() => {')
    expect(source).toContain('const totalPuppyCount = computed(() => {')
    expect(source).toContain('selectedLitter.value?.born_alive ?? selectedLitter.value?.aliveCount')
    expect(source).toContain('selectedLitter.value?.total_born ?? selectedLitter.value?.totalCount')
    expect(source).toContain('存活 {{ livePuppyCount }}/{{ totalPuppyCount }}')
  })
})
