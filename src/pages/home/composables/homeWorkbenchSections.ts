export function uniqueSourceCards(rows: Array<{ sourceCard?: any }> = []) {
  const cardMap = new Map<string, any>()
  for (const row of rows) {
    const card = row?.sourceCard
    if (!card?.id || cardMap.has(card.id)) continue
    cardMap.set(card.id, card)
  }
  return Array.from(cardMap.values())
}

export function mapWorkbenchGroupsToCards(groups: Array<{
  key: string
  title: string
  rows: Array<{ sourceCard?: any }>
  visibleRows?: Array<{ sourceCard?: any }>
  hiddenCount?: number
}> = []) {
  return groups
    .map(group => ({
      key: group.key,
      title: group.title,
      cards: uniqueSourceCards(group.rows || []),
      visibleCards: uniqueSourceCards(group.visibleRows || []),
      hiddenCount: group.hiddenCount || 0,
    }))
    .filter(group => group.cards.length > 0)
}

export function isBreedingMilestoneGroup(group: { cards?: any[] } = {}) {
  const cardsInGroup = group.cards || []
  if (!cardsInGroup.length) return false
  return cardsInGroup.every((card: any) => card?.tasks?.[0]?.type === 'breeding_milestone')
}
