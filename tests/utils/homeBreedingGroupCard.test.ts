import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))

describe('home breeding group collapse', () => {
  it('首页 workbench 为繁育分组保留 2 条可见项并透传 hiddenCount', () => {
    const homeSource = readFileSync(resolve(testDir, '../../src/pages/home/index.vue'), 'utf8')

    expect(homeSource).toContain('buildHomeWorkbench(cards.value, { visibleRowLimit: 2 })')
    expect(homeSource).toContain('buildHomeWorkbench(dayCards.value, { visibleRowLimit: 2 })')
    expect(homeSource).toContain('visibleCards: uniqueSourceCards(group.visibleRows || [])')
    expect(homeSource).toContain('hiddenCount: group.hiddenCount || 0')
  })

  it('繁育分组卡默认折叠并提供底部展开收起入口', () => {
    const groupCardSource = readFileSync(resolve(testDir, '../../src/components/smart-card/BreedingProcessGroupCard.vue'), 'utf8')

    expect(groupCardSource).toContain('const expanded = ref(false)')
    expect(groupCardSource).toContain("return allCards.value.slice(0, 2)")
    expect(groupCardSource).toContain("const expandText = computed(() => (expanded.value ? '收起' : `还有 ${hiddenCount.value} 条，展开`))")
    expect(groupCardSource).toContain('v-if="hiddenCount > 0"')
    expect(groupCardSource).toContain('class="group-expand"')
    expect(groupCardSource).toContain("{{ expanded ? 'expand_less' : 'expand_more' }}")
  })

  it('展开状态仅在当前组件内生效，不写本地存储', () => {
    const groupCardSource = readFileSync(resolve(testDir, '../../src/components/smart-card/BreedingProcessGroupCard.vue'), 'utf8')

    expect(groupCardSource).toContain("watch(() => props.group?.key")
    expect(groupCardSource).not.toContain('setStorageSync')
    expect(groupCardSource).not.toContain('getStorageSync')
  })

  it('繁育分组卡改为整行进繁育详情，处理按钮保留动作入口', () => {
    const groupCardSource = readFileSync(resolve(testDir, '../../src/components/smart-card/BreedingProcessGroupCard.vue'), 'utf8')

    expect(groupCardSource).toContain('@click="goDetail(item.card)"')
    expect(groupCardSource).toContain('@click.stop="goProcess(item.card)"')
    expect(groupCardSource).toContain('@click.stop="goDogDetail(item.card)"')
    expect(groupCardSource).toContain('openHomeBreedingDetail(card)')
    expect(groupCardSource).toContain("uni.navigateTo({ url: `/pages/dog/detail?id=${card.dogId}` })")
    expect(groupCardSource).toContain('openHomeBreedingAction(card, \'process\')')
  })

  it('单犬繁育卡保留头像进犬详情，卡片主体进繁育详情', () => {
    const singleCardSource = readFileSync(resolve(testDir, '../../src/components/smart-card/BreedingProcessCard.vue'), 'utf8')

    expect(singleCardSource).toContain('@click="onCardTap"')
    expect(singleCardSource).toContain('@click.stop="onAvatarTap"')
    expect(singleCardSource).toContain('openHomeBreedingDetail(props.card)')
    expect(singleCardSource).toContain("uni.navigateTo({ url: `/pages/dog/detail?id=${encodeURIComponent(props.card.dogId)}` })")
  })
})
