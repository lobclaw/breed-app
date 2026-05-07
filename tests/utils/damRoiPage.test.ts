import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(testDir, '../../src/pages/finance/dam-roi.vue'), 'utf8')

describe('dam ROI page contract', () => {
  it('从详情入口进入时应从本地犬只镜像补全种母资料', () => {
    expect(source).toContain("import { localDb } from '@/localdb/db'")
    expect(source).toContain("const localDam = await localDb.findById<any>('dogs', damId)")
    expect(source).toContain('void hydrateSelectedDam(damId)')
  })

  it('种母选择卡片应展示品种、性别和年龄', () => {
    expect(source).toContain("{{ hasSelectedDam ? selectedDamMeta : '选择一只种母查看累计回报与各窝表现' }}")
    expect(source).toContain("selectedDam.value.birth_date ? formatAge(selectedDam.value.birth_date) : ''")
    expect(source).toContain("return parts.join(' · ')")
  })

  it('切换种母时应默认选中当前种母', () => {
    expect(source).toContain(':selected-ids="hasSelectedDam ? [selectedDam._id] : []"')
  })

  it('各窝表现卡片应可进入单窝利润页', () => {
    expect(source).toContain('class="litter-item" @click="goToLitterProfit(litter)"')
    expect(source).toContain('<text class="litter-item__subprofit">{{ litter.profitHint }}</text>')
    expect(source).toContain('class="material-icons-round litter-item__chevron">chevron_right</text>')
    expect(source).not.toContain('class="litter-item__profit-row"')
    expect(source).toContain('function goToLitterProfit(litter: any)')
    expect(source).toContain('url: `/pages/finance/litter-profit?litterId=${litter.id}&litterName=${litterName}`')
  })
})
