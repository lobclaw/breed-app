import { ref, type Ref } from 'vue'
import { getBatchCardDogId } from '@/utils/batchCardProgress'

type HomeCounts = {
  today: number
  week: number
  month30: number
  hasOverdue: boolean
}

type BatchProgress = {
  dogs: any[]
  completedDogIds: string[]
}

export function useHomeBatchProgress(options: {
  cards: Ref<any[]>
  counts: HomeCounts
  getFamilyId: () => string
  isTaskSuppressed: (taskId?: string) => boolean
  taskStore: any
}) {
  const localBatchCardProgressMap = ref<Record<string, BatchProgress>>({})

  function syncTaskStoreBatchProgress() {
    const familyId = options.getFamilyId()
    if (!familyId) return
    if (options.taskStore.familyId && options.taskStore.familyId !== familyId) return
    options.taskStore.familyId = familyId
    options.taskStore.batchCardProgress = { ...localBatchCardProgressMap.value }
  }

  function hydrateLocalBatchCardProgress() {
    const familyId = options.getFamilyId()
    if (!familyId || options.taskStore.familyId !== familyId) {
      localBatchCardProgressMap.value = {}
      return
    }
    localBatchCardProgressMap.value = { ...(options.taskStore.batchCardProgress || {}) }
  }

  function resetLocalBatchCardProgress() {
    localBatchCardProgressMap.value = {}
    options.taskStore.batchCardProgress = {}
  }

  function cloneBatchDog(dog: any) {
    return dog && typeof dog === 'object' ? { ...dog } : dog
  }

  function isHealthBatchCard(card: any) {
    return card?.cardType === 'batch' && card?.domain === 'health'
  }

  function normalizeIllnessCondition(condition: unknown) {
    return typeof condition === 'string' ? condition.trim() : ''
  }

  function getIllnessPrimaryCondition(details: Record<string, any> = {}) {
    return normalizeIllnessCondition(details.primary_condition || details.condition || '')
  }

  function getHealthTaskVariantKey(task: any) {
    if (!task) return ''
    if (task.type === 'vaccination') {
      return `vaccination:${task.details?.vaccine_type || ''}`
    }
    if (task.type === 'deworming') {
      return `deworming:${task.details?.deworming_type || ''}:${task.details?.drug_name || ''}`
    }
    if (task.type === 'illness') {
      return `illness:${getIllnessPrimaryCondition(task.details || {})}`
    }
    return task.type || ''
  }

  function getHealthBatchCardId(task: any) {
    const variantKey = getHealthTaskVariantKey(task)
    if (!variantKey || !task?.due_date) return ''
    return `batch-${variantKey}-${task.due_date}`
  }

  function restorePersistedHealthBatchCards(cardList: any[] = []) {
    const nextCards = (cardList || []).map((card: any) => ({
      ...card,
      tasks: Array.isArray(card?.tasks) ? [...card.tasks] : card?.tasks,
      dogs: Array.isArray(card?.dogs) ? card.dogs.map((dog: any) => cloneBatchDog(dog)) : card?.dogs,
    }))

    const existingBatchIds = new Set(
      nextCards
        .filter((card: any) => isHealthBatchCard(card))
        .map((card: any) => card.id)
        .filter(Boolean),
    )

    Object.entries(localBatchCardProgressMap.value).forEach(([cardId, progress]) => {
      if (!progress?.dogs?.length || existingBatchIds.has(cardId)) return

      const matchedTasks: any[] = []
      const matchedMeta: Array<{ cardIdx: number; taskIds: string[] }> = []

      nextCards.forEach((card: any, cardIdx: number) => {
        if (card?.cardType !== 'dog' || card?.domain !== 'health') return
        const matched = (card.tasks || []).filter((task: any) => getHealthBatchCardId(task) === cardId)
        if (!matched.length) return
        matchedTasks.push(...matched)
        matchedMeta.push({ cardIdx, taskIds: matched.map((task: any) => task._id).filter(Boolean) })
      })

      if (!matchedTasks.length) return

      matchedMeta.forEach(({ cardIdx, taskIds }) => {
        const card = nextCards[cardIdx]
        if (!card) return
        const remainingTasks = (card.tasks || []).filter((task: any) => !taskIds.includes(task._id))
        if (!remainingTasks.length) {
          nextCards[cardIdx] = null
          return
        }
        card.tasks = remainingTasks
      })

      const pendingTaskByDogId = new Map<string, any>()
      matchedTasks.forEach((task: any) => {
        const dogId = task.dog_id || task.dogId
        if (dogId && !pendingTaskByDogId.has(dogId)) pendingTaskByDogId.set(dogId, task)
      })

      const mergedDogs = (progress.dogs || []).map((dog: any) => {
        const dogId = getBatchCardDogId(dog)
        const pendingTask = dogId ? pendingTaskByDogId.get(dogId) : null
        return {
          ...cloneBatchDog(dog),
          taskId: pendingTask?._id || dog?.taskId || '',
          completed: !pendingTask,
        }
      })

      nextCards.push({
        cardType: 'batch',
        id: cardId,
        domain: 'health',
        sectionType: 'reminders',
        priority: matchedTasks[0]?.priority || 'today',
        groupTitle: matchedTasks[0]?.display_title || matchedTasks[0]?.title || '',
        dogs: mergedDogs,
        tasks: matchedTasks,
        progress: {
          done: mergedDogs.filter((dog: any) => dog?.completed).length,
          total: mergedDogs.length,
        },
      })
    })

    return nextCards.filter(Boolean)
  }

  function syncTaskStoreHomeCache() {
    const familyId = options.getFamilyId()
    if (!familyId) return
    options.taskStore.setRecommendationInput(familyId, options.cards.value, options.counts)
    options.taskStore.batchCardProgress = { ...localBatchCardProgressMap.value }
  }

  function pruneLocalBatchCardProgress(cardList: any[] = []) {
    const activeCardIds = new Set(
      (cardList || [])
        .filter((card: any) => isHealthBatchCard(card))
        .map((card: any) => card.id)
        .filter(Boolean),
    )

    const next = Object.fromEntries(
      Object.entries(localBatchCardProgressMap.value).filter(([cardId]) => activeCardIds.has(cardId)),
    )

    localBatchCardProgressMap.value = next
    syncTaskStoreBatchProgress()
  }

  function updateLocalBatchCardProgress(cardId: string, dogs: any[]) {
    if (!cardId) return
    const completedDogIds = (dogs || [])
      .filter((dog: any) => dog?.completed)
      .map((dog: any) => getBatchCardDogId(dog))
      .filter(Boolean) as string[]

    if (!completedDogIds.length) {
      const next = { ...localBatchCardProgressMap.value }
      delete next[cardId]
      localBatchCardProgressMap.value = next
      syncTaskStoreBatchProgress()
      return
    }

    localBatchCardProgressMap.value = {
      ...localBatchCardProgressMap.value,
      [cardId]: {
        dogs: (dogs || []).map(cloneBatchDog),
      completedDogIds,
    },
  }
    syncTaskStoreBatchProgress()
  }

  function clearLocalBatchCardProgress(cardId?: string) {
    if (!cardId) return
    if (!localBatchCardProgressMap.value[cardId]) return
    const next = { ...localBatchCardProgressMap.value }
    delete next[cardId]
    localBatchCardProgressMap.value = next
    syncTaskStoreBatchProgress()
  }

  function applyLocalBatchCardProgress(card: any) {
    if (!isHealthBatchCard(card)) return card
    const progress = localBatchCardProgressMap.value[card.id]
    if (!progress) return card

    const completedDogIdSet = new Set(progress.completedDogIds)
    const pendingDogMap = new Map<string, any>()
    ;(card.dogs || []).forEach((dog: any) => {
      const dogId = getBatchCardDogId(dog)
      if (dogId) pendingDogMap.set(dogId, dog)
    })

    const mergedDogs: any[] = []
    ;(progress.dogs || []).forEach((dog: any) => {
      const dogId = getBatchCardDogId(dog)
      if (!dogId) return

      if (pendingDogMap.has(dogId)) {
        mergedDogs.push({
          ...cloneBatchDog(dog),
          ...cloneBatchDog(pendingDogMap.get(dogId)),
          completed: false,
        })
        pendingDogMap.delete(dogId)
        return
      }

      if (completedDogIdSet.has(dogId)) {
        mergedDogs.push({
          ...cloneBatchDog(dog),
          completed: true,
        })
      }
    })

    pendingDogMap.forEach((dog) => {
      mergedDogs.push({
        ...cloneBatchDog(dog),
        completed: false,
      })
    })

    card.dogs = mergedDogs
    if (card.progress) {
      card.progress = {
        ...card.progress,
        done: mergedDogs.filter((dog: any) => dog?.completed).length,
        total: mergedDogs.length,
      }
    }
    return card
  }

  function markBatchDogCompleted(card: any, taskId: string) {
    if (!isHealthBatchCard(card) || !taskId) return
    const targetTask = (card.tasks || []).find((task: any) => task?._id === taskId)
    if (!targetTask) return

    const targetDogId = targetTask.dog_id || targetTask.dogId
    if (!targetDogId) return

    const nextDogs = (card.dogs || []).map((dog: any) => {
      const dogId = getBatchCardDogId(dog)
      if (dogId !== targetDogId) return dog
      return {
        ...cloneBatchDog(dog),
        completed: true,
      }
    })

    card.dogs = nextDogs
    updateLocalBatchCardProgress(card.id, nextDogs)
  }

  function syncCardMeta(card: any, remainingTasks: any[]) {
    if (!card) return null
    card.tasks = remainingTasks

    if (isHealthBatchCard(card)) {
      const dogIdSet = new Set(remainingTasks.map((task: any) => task.dog_id || task.dogId).filter(Boolean))
      card.dogs = (card.dogs || [])
        .map((dog: any) => {
          const dogId = getBatchCardDogId(dog)
          if (!dogId) return dog
          return {
            ...cloneBatchDog(dog),
            completed: !dogIdSet.has(dogId),
          }
        })
        .filter((dog: any) => {
          const dogId = getBatchCardDogId(dog)
          return !dogId || dog.completed || dogIdSet.has(dogId)
        })

      if (card.progress) {
        card.progress = {
          ...card.progress,
          done: card.dogs.filter((dog: any) => dog?.completed).length,
          total: card.dogs.length,
        }
      }
      updateLocalBatchCardProgress(card.id, card.dogs || [])
    } else if (card.cardType === 'batch' || card.cardType === 'care_group') {
      const dogIdSet = new Set(remainingTasks.map((t: any) => t.dog_id || t.dogId).filter(Boolean))
      card.dogs = (card.dogs || []).filter((dog: any) => dogIdSet.has(dog.dogId || dog.dog_id))
      if (card.progress) {
        card.progress = { ...card.progress, total: card.dogs.length }
      }
    }

    return card
  }

  function filterSuppressedCards(cardList: any[]) {
    return restorePersistedHealthBatchCards(cardList).map((card: any) => {
      const nextCard = applyLocalBatchCardProgress(card)
      if (!nextCard?.tasks?.length) return nextCard
      const remainingTasks = nextCard.tasks.filter((task: any) => !options.isTaskSuppressed(task._id))
      if (remainingTasks.length === nextCard.tasks.length) return nextCard
      if (remainingTasks.length === 0) return null
      return syncCardMeta({ ...nextCard, dogs: Array.isArray(nextCard.dogs) ? [...nextCard.dogs] : nextCard.dogs }, remainingTasks)
    }).filter(Boolean)
  }

  return {
    applyLocalBatchCardProgress,
    clearLocalBatchCardProgress,
    filterSuppressedCards,
    hydrateLocalBatchCardProgress,
    isHealthBatchCard,
    localBatchCardProgressMap,
    markBatchDogCompleted,
    pruneLocalBatchCardProgress,
    resetLocalBatchCardProgress,
    syncCardMeta,
    syncTaskStoreHomeCache,
    updateLocalBatchCardProgress,
  }
}
