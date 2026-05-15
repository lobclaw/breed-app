import { nextTick, ref, type Ref } from 'vue'
import type { HomeCardFocusTarget } from '@/utils/homeCardFocus'

function getHomeFocusSection(target: HomeCardFocusTarget) {
  return target === 'medication' ? 'therapy' : 'reminders'
}

export function useHomeFocus(options: {
  cards: Ref<any[]>
  scrollToSection: (section: string) => void
  scrollToAnchor: (targetId: string) => void
  openAggregateAction: (target: HomeCardFocusTarget) => boolean
}) {
  const focusedHomeCardId = ref('')
  const pendingHomeCardFocusTarget = ref<HomeCardFocusTarget | ''>('')
  let focusedHomeCardTimer: ReturnType<typeof setTimeout> | null = null

  function getHomeFocusCard(target: HomeCardFocusTarget) {
    return options.cards.value.find(card => card.cardType === target)
  }

  function highlightHomeCard(cardId: string) {
    focusedHomeCardId.value = cardId
    if (focusedHomeCardTimer) clearTimeout(focusedHomeCardTimer)
    focusedHomeCardTimer = setTimeout(() => {
      focusedHomeCardId.value = ''
    }, 1800)
  }

  function applyPendingHomeCardFocus() {
    const target = pendingHomeCardFocusTarget.value
    if (!target) return
    const targetCard = getHomeFocusCard(target)
    pendingHomeCardFocusTarget.value = ''
    if (!targetCard?.id) {
      options.scrollToSection(getHomeFocusSection(target))
      return
    }
    highlightHomeCard(targetCard.id)
    options.scrollToAnchor(`home-card-${targetCard.id}`)
    setTimeout(() => {
      options.openAggregateAction(target)
    }, 220)
  }

  function scheduleHomeCardFocus(target: HomeCardFocusTarget) {
    pendingHomeCardFocusTarget.value = target
    nextTick(() => {
      setTimeout(() => {
        applyPendingHomeCardFocus()
      }, 80)
    })
  }

  function clearHomeCardFocus() {
    focusedHomeCardId.value = ''
    pendingHomeCardFocusTarget.value = ''
  }

  function disposeHomeFocus() {
    if (focusedHomeCardTimer) clearTimeout(focusedHomeCardTimer)
    focusedHomeCardTimer = null
  }

  return {
    focusedHomeCardId,
    pendingHomeCardFocusTarget,
    applyPendingHomeCardFocus,
    clearHomeCardFocus,
    disposeHomeFocus,
    getHomeFocusCard,
    scheduleHomeCardFocus,
  }
}
