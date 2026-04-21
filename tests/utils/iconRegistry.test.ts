import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  BREEDING_RECORD_ITEMS,
  FINANCE_RECORD_ITEMS,
  HEALTH_RECORD_ITEMS,
  getDogEntityIcon,
  getQuickActionButtons,
  getRecordCatalogGroups,
  getTaskActionMeta,
} from '@/utils/iconRegistry'

const testDir = dirname(fileURLToPath(import.meta.url))

describe('iconRegistry', () => {
  it('按角色优先返回犬只实体图标', () => {
    expect(getDogEntityIcon({ role: '种狗' })).toBe('pets')
    expect(getDogEntityIcon({ role: '外部种公' })).toBe('pets')
    expect(getDogEntityIcon({ role: '幼崽' })).toBe('child_friendly')
    expect(getDogEntityIcon({ kind: 'litter' })).toBe('child_friendly')
  })

  it('统一记录入口配置应包含繁育、健康、财务三组', () => {
    const groups = getRecordCatalogGroups()

    expect(groups.map(group => group.label)).toEqual(['繁育记录', '健康记录', '财务记录'])
    expect(BREEDING_RECORD_ITEMS.some(item => item.label === '生产记录' && item.icon === 'child_friendly')).toBe(true)
    expect(HEALTH_RECORD_ITEMS.some(item => item.label === '用药' && item.icon === 'medication')).toBe(true)
    expect(HEALTH_RECORD_ITEMS.find(item => item.page === 'health-illness')?.layout).not.toBe('full')
    expect(FINANCE_RECORD_ITEMS.some(item => item.label === '支出' && item.icon === 'payments')).toBe(true)
  })

  it('快捷入口与智能推荐应复用统一图标元数据', () => {
    const quickActions = getQuickActionButtons()
    const taskMeta = getTaskActionMeta()

    expect(quickActions.map(item => item.label)).toEqual(['记账', '疫苗', '驱虫', '体重'])
    expect(taskMeta.vaccination).toMatchObject({ materialIcon: 'vaccines', iconColor: 'blue' })
    expect(taskMeta.illness).toMatchObject({ materialIcon: 'sick', iconColor: 'red' })
  })

  it('高频页面源码中不应再出现犬只 emoji', () => {
    const files = [
      '../../src/components/smart-card/BreedingProcessCard.vue',
      '../../src/components/smart-card/BreedingProcessGroupCard.vue',
      '../../src/components/smart-card/DogCard.vue',
      '../../src/pages/dog/list.vue',
      '../../src/pages/breeding/litter.vue',
    ]

    for (const file of files) {
      const source = readFileSync(resolve(testDir, file), 'utf8')
      expect(source).not.toMatch(/[🐩🐶🐾🐕🐱🐈]/u)
    }
  })
})
